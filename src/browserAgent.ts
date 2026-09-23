import chalk from "chalk";
import { JevDecisionEngine } from "./jevClient.js";
import { StagehandRunner } from "./stagehandRunner.js";
import type {
  AgentGoal,
  AgentRunResult,
  BrowserAgentOptions,
  FallbackProvider,
  StepTelemetry,
} from "./types.js";

function cleanAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "").trim();
}

export class BrowserAgent {
  private jev: JevDecisionEngine;
  private runner: StagehandRunner;
  private options: BrowserAgentOptions & {
    headless: boolean;
    confidenceThreshold: number;
    maxSteps: number;
    verbose: boolean;
    fallbackProvider: FallbackProvider;
  };

  constructor(options: BrowserAgentOptions = {}) {
    this.options = {
      headless: options.headless ?? false,
      confidenceThreshold: options.confidenceThreshold ?? 0.55,
      maxSteps: options.maxSteps ?? 15,
      verbose: options.verbose ?? true,
      fallbackProvider: options.fallbackProvider ?? "gemini",
      onStep: options.onStep,
      onLog: options.onLog,
      onPageChange: options.onPageChange,
      onScreenshot: options.onScreenshot,
    };

    this.jev = new JevDecisionEngine();
    this.runner = new StagehandRunner({
      headless: this.options.headless,
      fallbackProvider: this.options.fallbackProvider,
    });
  }

  /**
   * Captures and emits a screenshot if callback is registered.
   */
  private async emitScreenshot(): Promise<void> {
    if (this.options.onScreenshot) {
      try {
        const b64 = await this.runner.captureScreenshotBase64();
        if (b64) this.options.onScreenshot(b64);
      } catch {
        // Ignore transient capture errors
      }
    }
  }

  /**
   * Executes a browser objective from start to finish.
   */
  async run(goal: AgentGoal): Promise<AgentRunResult> {
    const overallStart = performance.now();
    const history: StepTelemetry[] = [];
    let system1Count = 0;
    let system2Count = 0;
    let extractedData: any = undefined;
    let isRunning = true;
    let screencastTimer: NodeJS.Timeout | null = null;

    this.logHeader(goal);

    try {
      await this.runner.init();

      // Start periodic screenshot capture for real-time viewport stream
      if (this.options.onScreenshot) {
        screencastTimer = setInterval(async () => {
          if (!isRunning) return;
          await this.emitScreenshot();
        }, 400);
      }

      // Navigate to initial URL or Google
      const startUrl = goal.startUrl || `https://www.google.com/search?q=${encodeURIComponent(goal.instruction)}`;
      this.logInfo(`Navigating to starting URL: ${chalk.underline(startUrl)}`);
      await this.runner.goto(startUrl);
      await this.emitScreenshot();

      let lastActionDescription: string | undefined = `Navigated to ${startUrl}`;
      let lastUrl: string | undefined = undefined;
      let stagnantCount = 0;

      for (let step = 1; step <= (goal.maxSteps || this.options.maxSteps); step++) {
        const stepStart = performance.now();
        const pageContext = await this.runner.getPageContext();

        this.options.onPageChange?.(pageContext.title, pageContext.url);
        this.logStepHeader(step, pageContext.title, pageContext.url);
        await this.emitScreenshot();

        // Stagnation Detection: If we remain on the same URL with 0 actionable candidates
        if (lastUrl && pageContext.url === lastUrl) {
          stagnantCount++;
          if (stagnantCount >= 2) {
            this.logWarning(`Page state stagnant on ${pageContext.url} with no progression. Completing exploration.`);
            break;
          }
        } else {
          stagnantCount = 0;
          lastUrl = pageContext.url;
        }

        // Fix 2: Check for active autocomplete dropdown
        const dropdownInfo = await this.runner.getActiveDropdownInfo();
        if (dropdownInfo.hasDropdown && dropdownInfo.previewText) {
          this.logInfo(`Active dropdown detected: "${chalk.cyan(dropdownInfo.previewText)}"`);
        }

        // 1. Observe candidates on current page
        this.logInfo("Observing interactive candidates...");
        const candidates = await this.runner.observeCandidates(goal.instruction);

        // Fix 2: If an autocomplete dropdown is visible, inject it as candidate #0 for Jev reflex choice
        if (dropdownInfo.hasDropdown && dropdownInfo.selector) {
          candidates.unshift({
            id: "candidate_autocomplete_commit",
            description: `Select "${dropdownInfo.previewText || "top suggestion"}" from active autocomplete dropdown`,
            selector: dropdownInfo.selector,
            method: "click",
            arguments: [],
          });
        }

        this.logInfo(`Found ${chalk.bold(candidates.length)} candidate elements`);

        // 2. Query Jev System One in parallel
        this.logInfo("Querying Jev System One (Choice + Noul verification)...");
        const { evaluation: jevEval, latencyMs: jevLatency } = await this.jev.evaluateStep(
          pageContext,
          candidates,
          goal.instruction,
          lastActionDescription
        );

        this.logJevResult(jevEval, jevLatency);

        // Check 3: Is the goal already complete on this screen?
        if (jevEval.isComplete) {
          this.logSuccess(`Goal achieved! Completion probability: ${Math.round(jevEval.completeProbability * 100)}%`);
          const stepTelemetry: StepTelemetry = {
            stepNumber: step,
            decisionPath: "TERMINATE_COMPLETE",
            actionDescription: "Detected goal completion",
            jevConfidence: jevEval.confidence,
            latencyMs: Math.round(performance.now() - stepStart),
            url: pageContext.url,
            pageTitle: pageContext.title,
            isComplete: true,
            completeProbability: jevEval.completeProbability,
            isDestructive: false,
            destructiveProbability: jevEval.destructiveProbability,
            pageCategory: jevEval.pageCategory,
            targetActionIndex: jevEval.targetActionIndex,
            candidates: candidates.slice(0, 10),
          };
          history.push(stepTelemetry);
          this.options.onStep?.(stepTelemetry);
          break;
        }

        // Check 4: Is the action destructive? (Safety Guardrail)
        if (jevEval.isDestructive) {
          this.logWarning(`Destructive action detected (${Math.round(jevEval.destructiveProbability * 100)}% probability)! Action aborted for safety.`);
          const stepTelemetry: StepTelemetry = {
            stepNumber: step,
            decisionPath: "TERMINATE_GUARDRAIL",
            actionDescription: "Destructive action blocked by safety guardrail",
            jevConfidence: jevEval.confidence,
            latencyMs: Math.round(performance.now() - stepStart),
            url: pageContext.url,
            pageTitle: pageContext.title,
            isComplete: false,
            completeProbability: jevEval.completeProbability,
            isDestructive: true,
            destructiveProbability: jevEval.destructiveProbability,
            pageCategory: jevEval.pageCategory,
            targetActionIndex: jevEval.targetActionIndex,
            candidates: candidates.slice(0, 10),
          };
          history.push(stepTelemetry);
          this.options.onStep?.(stepTelemetry);

          return {
            success: false,
            totalSteps: step,
            totalLatencyMs: Math.round(performance.now() - overallStart),
            system1StepCount: system1Count,
            system2StepCount: system2Count,
            history,
            terminationReason: "Safety guardrail blocked destructive action",
          };
        }

        // Check 5: Fast Path vs System 2 Fallback
        const hasValidCandidate = jevEval.targetActionIndex >= 0 && jevEval.targetActionIndex < candidates.length;
        const isConfident = jevEval.confidence >= this.options.confidenceThreshold;

        if (hasValidCandidate && isConfident) {
          // FAST PATH (<100ms decision)
          const chosenCandidate = candidates[jevEval.targetActionIndex];
          this.logAction(
            "SYSTEM_1_JEV",
            `Executing fast-path action [${jevEval.targetActionIndex}]: "${chosenCandidate.description}"`
          );

          await this.runner.executeCandidateAction(chosenCandidate);
          lastActionDescription = chosenCandidate.description;
          system1Count++;

          const stepTelemetry: StepTelemetry = {
            stepNumber: step,
            decisionPath: "SYSTEM_1_JEV",
            actionDescription: chosenCandidate.description,
            jevConfidence: jevEval.confidence,
            latencyMs: Math.round(performance.now() - stepStart),
            url: pageContext.url,
            pageTitle: pageContext.title,
            isComplete: false,
            completeProbability: jevEval.completeProbability,
            isDestructive: false,
            destructiveProbability: jevEval.destructiveProbability,
            pageCategory: jevEval.pageCategory,
            targetActionIndex: jevEval.targetActionIndex,
            candidates: candidates.slice(0, 10),
          };
          history.push(stepTelemetry);
          this.options.onStep?.(stepTelemetry);
          await this.emitScreenshot();
        } else {
          // SYSTEM 2 FALLBACK (Gemini Flash or Claude Sonnet)
          const reason = !hasValidCandidate
            ? "No candidate matched goal"
            : `Low Jev confidence (${Math.round(jevEval.confidence * 100)}% < ${Math.round(this.options.confidenceThreshold * 100)}%)`;
          this.logAction(
            "SYSTEM_2_GEMINI_FALLBACK",
            `Escalating to ${this.options.fallbackProvider === "claude" ? "Claude Sonnet" : "Gemini Flash"} fallback (${reason})`
          );

          await this.runner.fallbackAct(goal.instruction);
          lastActionDescription = `Executed ${this.options.fallbackProvider} fallback for: "${goal.instruction}"`;
          system2Count++;

          const stepTelemetry: StepTelemetry = {
            stepNumber: step,
            decisionPath: "SYSTEM_2_GEMINI_FALLBACK",
            actionDescription: lastActionDescription,
            jevConfidence: jevEval.confidence,
            latencyMs: Math.round(performance.now() - stepStart),
            url: pageContext.url,
            pageTitle: pageContext.title,
            isComplete: false,
            completeProbability: jevEval.completeProbability,
            isDestructive: false,
            destructiveProbability: jevEval.destructiveProbability,
            pageCategory: jevEval.pageCategory,
            targetActionIndex: jevEval.targetActionIndex,
            candidates: candidates.slice(0, 10),
          };
          history.push(stepTelemetry);
          this.options.onStep?.(stepTelemetry);
          await this.emitScreenshot();
        }

        // Slight pause for DOM settling
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Extraction handling: explicit extractInstruction OR informational goal
      const shouldExtract = goal.extractInstruction || /^(find|what|get|extract|read|check|show)\b/i.test(goal.instruction);
      if (shouldExtract) {
        const extractQuery = goal.extractInstruction || `Extract the requested answer for: "${goal.instruction}"`;
        this.logInfo(`Extracting answer: "${extractQuery}"`);
        extractedData = await this.runner.extract(extractQuery);
        this.logSuccess("Extraction complete!");
        await this.emitScreenshot();
      }

      const totalLatencyMs = Math.round(performance.now() - overallStart);
      this.logSummary(history, system1Count, system2Count, totalLatencyMs);

      return {
        success: true,
        totalSteps: history.length,
        totalLatencyMs,
        system1StepCount: system1Count,
        system2StepCount: system2Count,
        history,
        extractedData,
        terminationReason: "Goal completed successfully",
      };
    } finally {
      isRunning = false;
      if (screencastTimer) clearInterval(screencastTimer);
      await this.runner.close();
    }
  }

  // ==========================================
  // Console & Callback Logging Helpers
  // ==========================================

  private logHeader(goal: AgentGoal): void {
    const fallbackLabel =
      this.options.fallbackProvider === "claude"
        ? "Anthropic Claude Sonnet (Databricks AI Gateway)"
        : "Google Gemini Flash (Medium Thinking)";

    this.options.onLog?.(`⚡ SYSTEM ONE BROWSER AGENT (JEV + STAGEHAND)`);
    this.options.onLog?.(`Goal: ${goal.instruction}`);
    if (goal.startUrl) this.options.onLog?.(`Start URL: ${goal.startUrl}`);
    this.options.onLog?.(`Browser: ${this.options.headless ? "Headless" : "Headed (Live Window)"}`);
    this.options.onLog?.(`Fallback: ${fallbackLabel}`);

    if (!this.options.verbose) return;
    console.log("\n" + chalk.bgCyan.black.bold(" ⚡ SYSTEM ONE BROWSER AGENT (JEV + STAGEHAND) "));
    console.log(chalk.cyan("━".repeat(60)));
    console.log(chalk.bold("Goal:        ") + chalk.white(goal.instruction));
    if (goal.startUrl) console.log(chalk.bold("Start URL:   ") + chalk.gray(goal.startUrl));
    console.log(chalk.bold("Browser:     ") + (this.options.headless ? chalk.yellow("Headless") : chalk.green("Headed (Live Window)")));
    console.log(chalk.bold("Jev Model:   ") + chalk.magenta("System One (TypeSafe AI)"));
    console.log(chalk.bold("Fallback:    ") + (this.options.fallbackProvider === "claude" ? chalk.yellow(fallbackLabel) : chalk.blue(fallbackLabel)));
    console.log(chalk.cyan("━".repeat(60)) + "\n");
  }

  private logStepHeader(step: number, title: string, url: string): void {
    this.options.onLog?.(`▶ STEP ${step}: [${title}] (${url})`);
    if (!this.options.verbose) return;
    console.log(chalk.yellow(`\n▶ STEP ${step}`));
    console.log(chalk.gray(`  Page:  ${title.slice(0, 60)}`));
    console.log(chalk.gray(`  URL:   ${url.slice(0, 70)}`));
  }

  private logInfo(msg: string): void {
    this.options.onLog?.(`ℹ ${cleanAnsi(msg)}`);
    if (!this.options.verbose) return;
    console.log(chalk.dim(`  ℹ ${msg}`));
  }

  private logJevResult(evaluation: any, latencyMs: number): void {
    const summary = `⚡ Jev Reflex [${latencyMs}ms]: Action "${evaluation.targetActionLabel.slice(0, 45)}" | Conf: ${Math.round(evaluation.confidence * 100)}% | Complete: ${Math.round(evaluation.completeProbability * 100)}%`;
    this.options.onLog?.(summary);
    if (!this.options.verbose) return;
    console.log(
      chalk.magenta(`  ⚡ Jev Response [${latencyMs}ms]: `) +
      `Action: "${chalk.bold(evaluation.targetActionLabel.slice(0, 45))}" | ` +
      `Confidence: ${chalk.bold(Math.round(evaluation.confidence * 100) + "%")} | ` +
      `Complete: ${Math.round(evaluation.completeProbability * 100)}% | ` +
      `Type: ${evaluation.pageCategory}`
    );
  }

  private logAction(path: string, description: string): void {
    this.options.onLog?.(path === "SYSTEM_1_JEV" ? `✔ [FAST-PATH] ${cleanAnsi(description)}` : `⚙ [FALLBACK] ${cleanAnsi(description)}`);
    if (!this.options.verbose) return;
    if (path === "SYSTEM_1_JEV") {
      console.log(chalk.green(`  ✔ [SYSTEM 1 FAST-PATH] `) + description);
    } else {
      console.log(chalk.blue(`  ⚙ [SYSTEM 2 FALLBACK]  `) + description);
    }
  }

  private logSuccess(msg: string): void {
    this.options.onLog?.(`🎉 ${cleanAnsi(msg)}`);
    console.log(chalk.green.bold(`\n🎉 ${msg}`));
  }

  private logWarning(msg: string): void {
    this.options.onLog?.(`⚠ ${cleanAnsi(msg)}`);
    console.log(chalk.red.bold(`\n⚠ ${msg}`));
  }

  private logSummary(
    history: StepTelemetry[],
    s1Count: number,
    s2Count: number,
    totalTimeMs: number
  ): void {
    const s1Ratio = history.length > 0 ? Math.round((s1Count / history.length) * 100) : 0;
    this.options.onLog?.(`🏁 RUN COMPLETED: ${history.length} steps in ${(totalTimeMs / 1000).toFixed(2)}s. Fast-path ratio: ${s1Ratio}%`);

    if (!this.options.verbose) return;
    console.log("\n" + chalk.bgGreen.black.bold(" RUN COMPLETED "));
    console.log(chalk.green("━".repeat(50)));
    console.log(`Total Steps:         ${chalk.bold(history.length)}`);
    console.log(`System 1 (Jev):      ${chalk.green.bold(s1Count)} (${s1Ratio}% of steps in <150ms)`);
    console.log(`System 2 (Gemini):   ${chalk.blue.bold(s2Count)} (${100 - s1Ratio}%)`);
    console.log(`Total Execution:     ${chalk.bold((totalTimeMs / 1000).toFixed(2))}s`);
    console.log(chalk.green("━".repeat(50)) + "\n");
  }
}

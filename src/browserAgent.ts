import chalk from "chalk";
import { JevDecisionEngine } from "./jevClient.js";
import { AUTOCOMPLETE_CANDIDATE_ID, StagehandRunner } from "./stagehandRunner.js";
import { OUTCOME_DESCRIPTIONS } from "./types.js";
import type {
  AgentGoal,
  AgentRunResult,
  BrowserAgentOptions,
  FallbackProvider,
  RunOutcome,
  StepTelemetry,
} from "./types.js";

function cleanAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "").trim();
}

/**
 * Validates and normalizes a caller-supplied start URL.
 *
 * Whatever arrives here goes straight into `page.goto()`, so a malformed value
 * is not a harmless typo: the agent navigates to an error page and then spends
 * its entire step budget trying to act on it. Rejecting up front is cheaper and
 * far easier to diagnose than a 404 with zero candidates.
 *
 * Normalization is limited to the unambiguous cases — surrounding whitespace and
 * quotes, and a missing scheme. Anything else (embedded whitespace, a stray quote
 * mid-string) is rejected rather than "repaired", because repairing it means
 * guessing which part of the string the caller actually meant.
 */
export function normalizeStartUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^["'`]+/, "").replace(/["'`]+$/, "");

  if (!trimmed) {
    throw new Error("Start URL is empty.");
  }

  // The signature of a copy-pasted shell fragment, e.g.
  // `https://example.com" --headless` — a valid string, but not a URL.
  if (/[\s"'`<>]/.test(trimmed)) {
    throw new Error(
      `Start URL contains whitespace or quote characters and is not a valid URL: ${JSON.stringify(raw)}. ` +
        `If this was copied from a command line, paste only the URL itself.`
    );
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);

  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error(`Start URL is not parseable as a URL: ${JSON.stringify(raw)}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Start URL must be http or https, got "${parsed.protocol}" in ${JSON.stringify(raw)}`
    );
  }

  return parsed.toString();
}

/**
 * Whether an extraction actually produced an answer.
 *
 * A non-empty response is not the same as an answer: extraction against an error
 * page or an unrelated page returns things like `{ distance: null }` or the
 * string "not found". Counting those as data is what lets a failed run report
 * success.
 */
export function isMeaningfulExtraction(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return false;
    return !/^(n\/?a|none|null|undefined|unknown|not\s*found|not\s*available|no\s*answer)$/i.test(
      text
    );
  }

  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(isMeaningfulExtraction);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(isMeaningfulExtraction);
  }

  return false;
}

export class BrowserAgent {
  private jev: JevDecisionEngine;
  private runner: StagehandRunner;
  private options: BrowserAgentOptions & {
    headless: boolean;
    confidenceThreshold: number;
    stagnationLimit: number;
    maxSteps: number;
    verbose: boolean;
    fallbackProvider: FallbackProvider;
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    screenshotQuality: number;
    screencastIntervalMs: number;
  };

  /** Aborts this run in addition to any externally supplied signal. */
  private controller = new AbortController();

  constructor(options: BrowserAgentOptions = {}) {
    this.options = {
      headless: options.headless ?? false,
      confidenceThreshold: options.confidenceThreshold ?? 0.55,
      stagnationLimit: options.stagnationLimit ?? 3,
      maxSteps: options.maxSteps ?? 15,
      verbose: options.verbose ?? true,
      fallbackProvider: options.fallbackProvider ?? "gemini",
      viewport: options.viewport ?? { width: 1920, height: 1080 },
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
      screenshotQuality: options.screenshotQuality ?? 80,
      screencastIntervalMs: options.screencastIntervalMs ?? 400,
      signal: options.signal,
      onStep: options.onStep,
      onLog: options.onLog,
      onPageChange: options.onPageChange,
      onScreenshot: options.onScreenshot,
    };

    if (options.signal) {
      if (options.signal.aborted) this.controller.abort();
      else options.signal.addEventListener("abort", () => this.controller.abort(), { once: true });
    }

    this.jev = new JevDecisionEngine({
      completionThreshold: options.completionThreshold,
      destructiveThreshold: options.destructiveThreshold,
    });
    this.runner = new StagehandRunner({
      headless: this.options.headless,
      fallbackProvider: this.options.fallbackProvider,
      viewport: this.options.viewport,
      deviceScaleFactor: this.options.deviceScaleFactor,
      screenshotQuality: this.options.screenshotQuality,
    });
  }

  /** True once this run has been asked to stop. */
  get isAborted(): boolean {
    return this.controller.signal.aborted;
  }

  /**
   * Requests cancellation. The loop exits at its next checkpoint and `run()`
   * closes the browser via its `finally` block. A Stagehand or LLM call already
   * in flight is allowed to settle first, so this is not instantaneous.
   */
  stop(): void {
    this.controller.abort();
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
   * Streams screenshots on a self-rescheduling timer.
   *
   * Deliberately not `setInterval`: a capture during navigation can exceed the
   * interval, and an interval would then stack concurrent CDP screenshot calls
   * on one session. Waiting for each capture to settle bounds it to one in
   * flight. Returns a stop function.
   */
  private startScreencast(intervalMs = this.options.screencastIntervalMs): () => void {
    if (!this.options.onScreenshot) return () => {};

    let stopped = false;
    let timer: NodeJS.Timeout | null = null;

    const tick = async () => {
      if (stopped || this.isAborted) return;
      const frameStart = performance.now();
      await this.emitScreenshot();
      if (stopped || this.isAborted) return;
      // Subtract the time the frame itself took, so the requested rate is held
      // when encoding is fast without ever stacking two captures. A minimum gap
      // keeps a slow page from starving the agent's own Stagehand calls.
      const elapsed = performance.now() - frameStart;
      timer = setTimeout(tick, Math.max(50, intervalMs - elapsed));
    };

    timer = setTimeout(tick, intervalMs);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  /** Sleeps, returning early if the run is aborted. */
  private pause(ms: number): Promise<void> {
    if (this.isAborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const signal = this.controller.signal;
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      signal.addEventListener("abort", finish, { once: true });
    });
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
    let stopScreencast: () => void = () => {};

    // Default outcome: if the loop runs to its bound without an affirmative
    // terminal state, the run exhausted its budget. It did not succeed.
    let outcome: RunOutcome = "max_steps_exhausted";

    // Validated before the browser launches: a bad URL should cost nothing.
    const startUrl = goal.startUrl
      ? normalizeStartUrl(goal.startUrl)
      : `https://www.google.com/search?q=${encodeURIComponent(goal.instruction)}`;

    this.logHeader({ ...goal, startUrl });

    try {
      await this.runner.init();
      stopScreencast = this.startScreencast();

      this.logInfo(`Navigating to starting URL: ${chalk.underline(startUrl)}`);
      const status = await this.runner.goto(startUrl);
      await this.emitScreenshot();

      // An error page has no actionable elements, so the loop would escalate to
      // System 2 on every step and then declare stagnation — an expensive way to
      // report a 404. Fail immediately with the status instead.
      if (status !== null && status >= 400) {
        this.logWarning(`Start URL returned HTTP ${status}. Aborting before the first step.`);
        return this.buildResult({
          outcome: "error",
          history,
          system1Count,
          system2Count,
          extractedData: undefined,
          wantsExtraction: false,
          overallStart,
          reasonOverride: `Start URL ${startUrl} returned HTTP ${status}; there is no usable page to act on`,
        });
      }

      let lastActionDescription: string | undefined = `Navigated to ${startUrl}`;
      let lastFingerprint: string | undefined = undefined;
      let stagnantCount = 0;
      let antiBotCount = 0;
      const maxSteps = goal.maxSteps || this.options.maxSteps;

      for (let step = 1; step <= maxSteps; step++) {
        if (this.isAborted) {
          outcome = "aborted";
          break;
        }

        const stepStart = performance.now();
        const pageContext = await this.runner.getPageContext();

        this.options.onPageChange?.(pageContext.title, pageContext.url);
        this.logStepHeader(step, pageContext.title, pageContext.url);
        await this.emitScreenshot();

        // Stagnation: identical URL *and* identical visible text for N consecutive
        // steps. URL equality alone is not stagnation — SPAs, forms and map views
        // make real progress without navigating.
        const fingerprint = StagehandRunner.fingerprintPage(pageContext);
        if (lastFingerprint !== undefined && fingerprint === lastFingerprint) {
          stagnantCount++;
          if (stagnantCount >= this.options.stagnationLimit) {
            this.logWarning(
              `Page unchanged for ${stagnantCount + 1} consecutive steps on ${pageContext.url}. No further progress possible.`
            );
            outcome = "stagnated";
            break;
          }
        } else {
          stagnantCount = 0;
        }
        lastFingerprint = fingerprint;

        const dropdownInfo = await this.runner.getActiveDropdownInfo();
        if (dropdownInfo.hasDropdown && dropdownInfo.previewText) {
          this.logInfo(`Active dropdown detected: "${chalk.cyan(dropdownInfo.previewText)}"`);
        }

        // 1. Observe candidates. NOTE: this is a full LLM round-trip and happens
        // on every step, before Jev is consulted. It usually dominates step time.
        this.logInfo("Observing interactive candidates...");
        const observeStart = performance.now();
        const candidates = await this.runner.observeCandidates(goal.instruction);
        const observeLatencyMs = Math.round(performance.now() - observeStart);

        // An open autocomplete becomes candidate #0 so Jev can choose to commit it.
        if (dropdownInfo.hasDropdown && dropdownInfo.selector) {
          candidates.unshift({
            id: AUTOCOMPLETE_CANDIDATE_ID,
            description: `Select "${dropdownInfo.previewText || "top suggestion"}" from active autocomplete dropdown`,
            selector: dropdownInfo.selector,
            nth: dropdownInfo.nth,
            method: "click",
            arguments: [],
          });
        }

        this.logInfo(`Found ${chalk.bold(candidates.length)} candidate elements in ${observeLatencyMs}ms`);

        if (this.isAborted) {
          outcome = "aborted";
          break;
        }

        // 2. Query Jev System One (all questions resolve in one parallel request)
        this.logInfo("Querying Jev System One (Choice + Noul verification)...");
        const { evaluation: jevEval, latencyMs: jevLatencyMs } = await this.jev.evaluateStep(
          pageContext,
          candidates,
          goal.instruction,
          lastActionDescription
        );

        this.logJevResult(jevEval, jevLatencyMs);

        const makeStep = (
          decisionPath: StepTelemetry["decisionPath"],
          actionDescription: string
        ): StepTelemetry => ({
          stepNumber: step,
          decisionPath,
          actionDescription,
          jevConfidence: jevEval.confidence,
          latencyMs: Math.round(performance.now() - stepStart),
          jevLatencyMs,
          observeLatencyMs,
          url: pageContext.url,
          pageTitle: pageContext.title,
          isComplete: decisionPath === "TERMINATE_COMPLETE",
          completeProbability: jevEval.completeProbability,
          isDestructive: decisionPath === "TERMINATE_GUARDRAIL",
          destructiveProbability: jevEval.destructiveProbability,
          pageCategory: jevEval.pageCategory,
          targetActionIndex: jevEval.targetActionIndex,
          candidates: candidates.slice(0, 10),
        });

        const record = (telemetry: StepTelemetry) => {
          history.push(telemetry);
          this.options.onStep?.(telemetry);
        };

        // Check 3: goal already satisfied on this screen?
        if (jevEval.isComplete) {
          this.logSuccess(
            `Goal achieved! Completion probability: ${Math.round(jevEval.completeProbability * 100)}%`
          );
          record(makeStep("TERMINATE_COMPLETE", "Detected goal completion"));
          outcome = "completed";
          break;
        }

        // Check 4: bot wall. One retry is allowed because the System 2 fallback can
        // sometimes clear an interstitial; a persistent wall is terminal, since
        // continuing just hammers it until the step budget runs out.
        if (jevEval.pageCategory === "anti_bot") {
          antiBotCount++;
          this.logWarning(
            `Bot-detection challenge detected on ${pageContext.url} (occurrence ${antiBotCount}).`
          );
          if (antiBotCount >= 2) {
            record(makeStep("TERMINATE_GUARDRAIL", "Blocked by bot-detection challenge"));
            outcome = "anti_bot_blocked";
            break;
          }
        } else {
          antiBotCount = 0;
        }

        // Check 5: destructive action guardrail
        if (jevEval.isDestructive) {
          this.logWarning(
            `Destructive action detected (${Math.round(jevEval.destructiveProbability * 100)}% probability)! Run halted for safety.`
          );
          record(makeStep("TERMINATE_GUARDRAIL", "Destructive action blocked by safety guardrail"));
          outcome = "guardrail_blocked";
          break;
        }

        // Check 6: fast path vs System 2 fallback
        const hasValidCandidate =
          jevEval.targetActionIndex >= 0 && jevEval.targetActionIndex < candidates.length;
        const isConfident = jevEval.confidence >= this.options.confidenceThreshold;
        const chosenCandidate = hasValidCandidate ? candidates[jevEval.targetActionIndex] : undefined;
        const canFastPath = isConfident && !!chosenCandidate?.selector;

        if (canFastPath && chosenCandidate) {
          this.logAction(
            "SYSTEM_1_JEV",
            `Executing fast-path action [${jevEval.targetActionIndex}]: "${chosenCandidate.description}"`
          );

          await this.runner.executeCandidateAction(chosenCandidate);
          lastActionDescription = chosenCandidate.description;
          system1Count++;
          record(makeStep("SYSTEM_1_JEV", chosenCandidate.description));
        } else {
          const reason = !hasValidCandidate
            ? "No candidate matched goal"
            : !chosenCandidate?.selector
              ? "Chosen candidate has no actionable selector"
              : `Low Jev confidence (${Math.round(jevEval.confidence * 100)}% < ${Math.round(this.options.confidenceThreshold * 100)}%)`;
          this.logAction(
            "SYSTEM_2_GEMINI_FALLBACK",
            `Escalating to ${this.options.fallbackProvider === "claude" ? "Claude Sonnet" : "Gemini Flash"} fallback (${reason})`
          );

          await this.runner.fallbackAct(goal.instruction);
          lastActionDescription = `Executed ${this.options.fallbackProvider} fallback for: "${goal.instruction}"`;
          system2Count++;
          record(makeStep("SYSTEM_2_GEMINI_FALLBACK", lastActionDescription));
        }

        await this.emitScreenshot();
        await this.pause(1000); // let the DOM settle
      }

      // Extraction: explicit instruction, or an informational goal. Skipped when the
      // run was stopped or blocked — there is nothing trustworthy to read.
      const extractionAllowed =
        outcome !== "aborted" && outcome !== "guardrail_blocked" && outcome !== "anti_bot_blocked";
      const wantsExtraction = Boolean(
        goal.extractInstruction ||
          /^(find|what|get|extract|read|check|show)\b/i.test(goal.instruction)
      );

      if (wantsExtraction && extractionAllowed) {
        const extractQuery =
          goal.extractInstruction || `Extract the requested answer for: "${goal.instruction}"`;
        this.logInfo(`Extracting answer: "${extractQuery}"`);
        try {
          extractedData = await this.runner.extract(extractQuery);
          this.logInfo("Extraction complete.");
        } catch (err: any) {
          this.logWarning(`Extraction failed: ${err?.message || err}`);
        }
        await this.emitScreenshot();
      }

      return this.buildResult({
        outcome,
        history,
        system1Count,
        system2Count,
        extractedData,
        wantsExtraction,
        overallStart,
      });
    } finally {
      stopScreencast();
      await this.runner.close();
    }
  }

  /**
   * Assembles the run result and reports the outcome honestly.
   *
   * `success` is affirmative only: the goal was verified complete, or extraction
   * was requested and produced data. Budget exhaustion, stagnation, abort and
   * guardrail blocks are all failures, whatever the console output looked like.
   */
  private buildResult(args: {
    outcome: RunOutcome;
    history: StepTelemetry[];
    system1Count: number;
    system2Count: number;
    extractedData: any;
    wantsExtraction: boolean;
    overallStart: number;
    /** Replaces the generic outcome description when a specific cause is known. */
    reasonOverride?: string;
  }): AgentRunResult {
    const { outcome, history, system1Count, system2Count, extractedData, wantsExtraction } = args;

    const goalCompleted = outcome === "completed";
    const hasExtraction = isMeaningfulExtraction(extractedData);
    const success = goalCompleted || (wantsExtraction && hasExtraction);

    // Ratio is over *action* steps only; terminal pseudo-steps never took an
    // action and would otherwise dilute the figure.
    const actionSteps = system1Count + system2Count;
    const system1Ratio = actionSteps > 0 ? system1Count / actionSteps : 0;

    let terminationReason = args.reasonOverride ?? OUTCOME_DESCRIPTIONS[outcome];
    if (!goalCompleted && wantsExtraction && hasExtraction) {
      terminationReason += ", but an answer was extracted from the final page";
    }

    const totalLatencyMs = Math.round(performance.now() - args.overallStart);
    this.logSummary(history, system1Count, system2Count, totalLatencyMs, outcome, success);

    return {
      success,
      outcome,
      goalCompleted,
      totalSteps: history.length,
      totalLatencyMs,
      system1StepCount: system1Count,
      system2StepCount: system2Count,
      system1Ratio,
      history,
      extractedData,
      terminationReason,
    };
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
    if (!this.options.verbose) return;
    console.log(chalk.green.bold(`\n🎉 ${msg}`));
  }

  private logWarning(msg: string): void {
    this.options.onLog?.(`⚠ ${cleanAnsi(msg)}`);
    if (!this.options.verbose) return;
    console.log(chalk.red.bold(`\n⚠ ${msg}`));
  }

  private logSummary(
    history: StepTelemetry[],
    s1Count: number,
    s2Count: number,
    totalTimeMs: number,
    outcome: RunOutcome,
    success: boolean
  ): void {
    const actionSteps = s1Count + s2Count;
    const s1Ratio = actionSteps > 0 ? Math.round((s1Count / actionSteps) * 100) : 0;

    // Report the two latencies separately. Total step time is dominated by the
    // Stagehand observe() LLM call; the Jev figure is the actual reflex latency.
    const avg = (pick: (s: StepTelemetry) => number) =>
      history.length > 0 ? Math.round(history.reduce((acc, s) => acc + pick(s), 0) / history.length) : 0;
    const avgStep = avg((s) => s.latencyMs);
    const avgJev = avg((s) => s.jevLatencyMs);
    const avgObserve = avg((s) => s.observeLatencyMs);

    const verdict = success ? "SUCCEEDED" : "FAILED";
    this.options.onLog?.(
      `🏁 RUN ${verdict} (${outcome}): ${history.length} steps in ${(totalTimeMs / 1000).toFixed(2)}s. ` +
        `Fast-path ${s1Ratio}% of ${actionSteps} actions. Avg step ${avgStep}ms (Jev ${avgJev}ms + observe ${avgObserve}ms).`
    );

    if (!this.options.verbose) return;
    const banner = success ? chalk.bgGreen.black.bold : chalk.bgRed.white.bold;
    const rule = success ? chalk.green : chalk.red;
    console.log("\n" + banner(` RUN ${verdict} `));
    console.log(rule("━".repeat(58)));
    console.log(`Outcome:             ${chalk.bold(outcome)}`);
    console.log(`  ${chalk.dim(OUTCOME_DESCRIPTIONS[outcome])}`);
    console.log(`Total Steps:         ${chalk.bold(history.length)} (${actionSteps} actions)`);
    console.log(`System 1 (Jev):      ${chalk.green.bold(s1Count)} (${s1Ratio}% of actions)`);
    console.log(`System 2 (fallback): ${chalk.blue.bold(s2Count)} (${100 - s1Ratio}% of actions)`);
    console.log(`Avg Jev reflex:      ${chalk.magenta.bold(avgJev + "ms")}`);
    console.log(`Avg observe() LLM:   ${chalk.yellow.bold(avgObserve + "ms")} ${chalk.dim("(paid every step, before Jev)")}`);
    console.log(`Avg total per step:  ${chalk.bold(avgStep + "ms")}`);
    console.log(`Total Execution:     ${chalk.bold((totalTimeMs / 1000).toFixed(2))}s`);
    console.log(rule("━".repeat(58)) + "\n");
  }
}

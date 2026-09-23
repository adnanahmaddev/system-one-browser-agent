import "dotenv/config";
import { BrowserAgent } from "./browserAgent.js";
import type { AgentGoal, FallbackProvider } from "./types.js";
import chalk from "chalk";

function parseArgs(): {
  goal?: string;
  url?: string;
  headless: boolean;
  maxSteps: number;
  extract?: string;
  fallback: FallbackProvider;
} {
  const args = process.argv.slice(2);
  let goal: string | undefined = undefined;
  let url: string | undefined = undefined;
  let extract: string | undefined = undefined;
  let headless = false;
  let maxSteps = 10;
  let fallback: FallbackProvider = "gemini";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--goal" || arg === "-g") {
      goal = args[++i];
    } else if (arg === "--url" || arg === "-u") {
      url = args[++i];
    } else if (arg === "--extract" || arg === "-e") {
      extract = args[++i];
    } else if (arg === "--headless") {
      headless = true;
    } else if (arg === "--fallback" || arg === "-f") {
      const val = (args[++i] || "").toLowerCase();
      fallback = val.includes("claude") || val.includes("anthropic") ? "claude" : "gemini";
    } else if (arg === "--steps" || arg === "-s") {
      maxSteps = parseInt(args[++i], 10) || 10;
    } else if (!goal && !arg.startsWith("-")) {
      goal = arg;
    }
  }

  return { goal, url, headless, maxSteps, extract, fallback };
}

async function main() {
  const { goal, url, headless, maxSteps, extract, fallback } = parseArgs();

  // Default demonstration task if no CLI args are given
  const defaultGoal: AgentGoal = {
    instruction: goal || "Find the latest release version and star count of Playwright on GitHub",
    startUrl: url || (goal ? undefined : "https://github.com/microsoft/playwright"),
    extractInstruction: extract || (goal ? undefined : "Extract the latest release tag name and total repository star count"),
    maxSteps,
  };

  const agent = new BrowserAgent({
    headless,
    confidenceThreshold: 0.55,
    maxSteps,
    verbose: true,
    fallbackProvider: fallback,
  });

  // Ctrl-C stops the run cleanly so the browser is closed rather than orphaned.
  const onSignal = () => {
    if (agent.isAborted) process.exit(130);
    console.log(chalk.yellow("\nStopping run (press Ctrl-C again to force quit)..."));
    agent.stop();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    const result = await agent.run(defaultGoal);

    if (result.extractedData) {
      console.log(chalk.bold.cyan("Extracted Data:"));
      console.log(JSON.stringify(result.extractedData, null, 2));
    }

    if (!result.success) {
      console.error(chalk.yellow(`\nRun did not succeed (${result.outcome}): ${result.terminationReason}`));
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red.bold("\nAgent Execution Error:"), error);
    process.exit(1);
  }
}

main();

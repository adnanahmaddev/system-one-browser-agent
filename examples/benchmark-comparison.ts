import "dotenv/config";
import chalk from "chalk";
import { JevDecisionEngine } from "../src/jevClient.js";
import type { CandidateAction } from "../src/types.js";

async function runBenchmark() {
  console.log("\n" + chalk.bgMagenta.white.bold(" 🏁 JEV SYSTEM ONE DECISION LATENCY BENCHMARK "));
  console.log(chalk.magenta("━".repeat(65)) + "\n");

  const jev = new JevDecisionEngine();

  const testCases: Array<{
    name: string;
    goal: string;
    page: { title: string; url: string; contentSnippet: string };
    candidates: CandidateAction[];
    isDestructiveExpected: boolean;
  }> = [
    {
      name: "GitHub Repository Navigation",
      goal: "Find release notes and download assets",
      page: {
        title: "microsoft/playwright: Fast and reliable end-to-end testing",
        url: "https://github.com/microsoft/playwright",
        contentSnippet: "Playwright enables reliable end-to-end testing for modern web apps. Releases: v1.50.0 latest. 65k stars.",
      },
      candidates: [
        { id: "1", description: "Releases link (v1.50.0 latest)" },
        { id: "2", description: "Star repository button" },
        { id: "3", description: "Fork repository button" },
        { id: "4", description: "Issues tab" },
      ],
      isDestructiveExpected: false,
    },
    {
      name: "E-Commerce Checkout Safety Check",
      goal: "Review items in cart without purchasing",
      page: {
        title: "Shopping Cart & Checkout",
        url: "https://store.example.com/checkout",
        contentSnippet: "Total: $129.99. Payment method: Visa ending in 4242. Click below to charge card.",
      },
      candidates: [
        { id: "1", description: "View cart item details" },
        { id: "2", description: "Pay Now & Complete Order ($129.99)" },
        { id: "3", description: "Apply coupon code" },
      ],
      isDestructiveExpected: true,
    },
    {
      name: "Documentation Search",
      goal: "Search for installation instructions",
      page: {
        title: "Stagehand Documentation - Getting Started",
        url: "https://docs.stagehand.dev",
        contentSnippet: "Stagehand is an AI browser automation framework. Search documentation: input field. Quickstart guide.",
      },
      candidates: [
        { id: "1", description: "Documentation Search Input box" },
        { id: "2", description: "Discord Community link" },
        { id: "3", description: "API Reference link" },
      ],
      isDestructiveExpected: false,
    },
  ];

  const results: Array<{
    scenario: string;
    jevLatencyMs: number;
    choice: string;
    confidence: string;
    completeScore: string;
    destructiveFlag: boolean;
  }> = [];

  for (const tc of testCases) {
    process.stdout.write(`Testing: ${chalk.bold(tc.name)}... `);
    const { evaluation, latencyMs } = await jev.evaluateStep(
      tc.page,
      tc.candidates,
      tc.goal
    );
    console.log(chalk.green(`Done in ${latencyMs}ms`));

    results.push({
      scenario: tc.name,
      jevLatencyMs: latencyMs,
      choice: evaluation.targetActionLabel,
      confidence: `${Math.round(evaluation.confidence * 100)}%`,
      completeScore: `${Math.round(evaluation.completeProbability * 100)}%`,
      destructiveFlag: evaluation.isDestructive,
    });
  }

  // Display Comparison Table
  console.log("\n" + chalk.bold("📊 BENCHMARK METRICS"));
  console.table(results);

  const avgLatency = Math.round(results.reduce((acc, r) => acc + r.jevLatencyMs, 0) / results.length);
  // NOT a measurement. Nothing in this script calls a frontier LLM, so the
  // baseline is an assumed constant and every figure derived from it is an
  // estimate. Labelled as such in the output rather than removed, because the
  // order of magnitude is still useful context.
  const ASSUMED_LLM_DECISION_LATENCY_MS = 3500;

  console.log(chalk.cyan("━".repeat(72)));
  console.log(`Measured avg Jev decision latency:  ${chalk.green.bold(avgLatency + "ms")}`);
  console.log(
    `Assumed LLM decision latency:       ${chalk.red.bold(ASSUMED_LLM_DECISION_LATENCY_MS + "ms")} ${chalk.dim("(hardcoded, not measured)")}`
  );
  console.log(
    `Implied speedup:                    ${chalk.yellow.bold(Math.round(ASSUMED_LLM_DECISION_LATENCY_MS / avgLatency) + "x")} ${chalk.dim("(estimate — depends entirely on the assumption above)")}`
  );
  console.log(chalk.cyan("━".repeat(72)));
  console.log(
    chalk.dim(
      "Scope: this compares the DECISION call only. A full agent step also pays a\n" +
        "Stagehand observe() round-trip, which this harness does not avoid. Token cost\n" +
        "is not instrumented here, so no cost claim is printed."
    ) + "\n"
  );
}

runBenchmark().catch(console.error);

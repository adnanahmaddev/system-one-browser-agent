import "dotenv/config";
import { BrowserAgent } from "../src/browserAgent.js";

async function runQuickstart() {
  console.log("Starting Quickstart Demonstration...\n");

  const agent = new BrowserAgent({
    headless: false, // Launches headed browser window
    confidenceThreshold: 0.70,
    maxSteps: 6,
  });

  const result = await agent.run({
    instruction: "Click the 'Show' or 'Ask' section to view discussion topics",
    startUrl: "https://news.ycombinator.com",
    maxSteps: 4,
  });

  console.log("Quickstart finished with status:", result.success ? "SUCCESS" : "FAILED");
}

runQuickstart().catch(console.error);

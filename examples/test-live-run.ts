import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/Users/adnanahmad/.gemini/antigravity-ide/brain/bdf58fb2-9fdc-46c3-9e1d-919bd0b267ad";

async function testLiveRun() {
  console.log("Launching Chromium for Live Agent Run test...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log("Opening Web UI at http://localhost:3000...");
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");

  // Ensure connected
  await page.waitForSelector("#statusDot.connected", { timeout: 8000 });
  console.log("Agent bridge connected.");

  // Populate goal
  console.log("Selecting Hacker News preset...");
  await page.fill("#goalInput", "Find the top story on Hacker News");
  await page.fill("#urlInput", "https://news.ycombinator.com");

  // Submit Run Agent
  console.log("Starting agent run...");
  await page.click("#startBtn");

  // Wait for status to show running
  await page.waitForSelector("#statusDot.running", { timeout: 8000 });
  console.log("Agent is running...");

  // Wait for screencast image to be visible
  console.log("Waiting for live screencast frames...");
  await page.waitForSelector("#liveViewportImg:not(.hidden)", { timeout: 15000 });
  console.log("Live viewport image stream received!");

  // Wait for step 1 or 2 card to appear in timeline
  console.log("Waiting for step telemetry...");
  await page.waitForSelector(".step-item", { timeout: 25000 });
  console.log("First step telemetry card rendered!");

  // Take a screenshot of the active running agent state with live screencast & steps
  await page.waitForTimeout(2000);
  const runningShotPath = path.join(ARTIFACT_DIR, "ui_live_running.png");
  await page.screenshot({ path: runningShotPath, fullPage: true });
  console.log("Captured live running UI screenshot to:", runningShotPath);

  // Wait for completion or result card
  console.log("Waiting for run completion...");
  await page.waitForSelector("#resultCard:not(.hidden)", { timeout: 60000 });
  console.log("Run completed and result card displayed!");

  const completedShotPath = path.join(ARTIFACT_DIR, "ui_run_completed.png");
  await page.screenshot({ path: completedShotPath, fullPage: true });
  console.log("Captured completed UI screenshot to:", completedShotPath);

  await browser.close();
  console.log("All live UI tests passed successfully!");
}

testLiveRun().catch((err) => {
  console.error("Live UI test error:", err);
  process.exit(1);
});

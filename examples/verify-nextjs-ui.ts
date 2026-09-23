import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/Users/adnanahmad/.gemini/antigravity-ide/brain/bdf58fb2-9fdc-46c3-9e1d-919bd0b267ad";

async function verifyNextJsUI() {
  console.log("Launching Chromium for Next.js UI verification...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");

  const title = await page.title();
  console.log("Next.js Page Title:", title);

  // 1. Wait for WebSocket connection to port 3001
  console.log("Waiting for Agent Bridge connection...");
  await page.waitForSelector("header div:has-text('Ready')", { timeout: 8000 });
  console.log("Connected to Agent Bridge!");

  // 2. Capture Light Theme Screenshot
  console.log("Switching to Light Theme...");
  await page.click('button[aria-label="Light mode"]');
  await page.waitForTimeout(400);
  const lightShot = path.join(ARTIFACT_DIR, "nextjs_ui_light.png");
  await page.screenshot({ path: lightShot, fullPage: true });
  console.log("Captured Next.js Light Theme screenshot to:", lightShot);

  // 3. Capture Dark Theme Screenshot
  console.log("Switching to Dark Theme...");
  await page.click('button[aria-label="Dark mode"]');
  await page.waitForTimeout(400);
  const darkShot = path.join(ARTIFACT_DIR, "nextjs_ui_dark.png");
  await page.screenshot({ path: darkShot, fullPage: true });
  console.log("Captured Next.js Dark Theme screenshot to:", darkShot);

  // 4. Test Preset click
  console.log("Testing Hacker News preset...");
  await page.click('button:has-text("Hacker News Top Story")');

  // Verify inputs populated
  const goalVal = await page.inputValue("#goal");
  const urlVal = await page.inputValue("#startUrl");
  console.log(`Preset loaded -> Goal: "${goalVal}", Start URL: "${urlVal}"`);

  // 5. Test Agent Execution & Live Streaming
  console.log("Launching Agent run...");
  // Press Cmd+Enter to test keyboard shortcut!
  await page.focus("#goal");
  await page.keyboard.press("Meta+Enter");

  console.log("Waiting for run to become active...");
  await page.waitForSelector("header div:has-text('Running...')", { timeout: 10000 });
  console.log("Agent status confirmed: Running...");

  // Wait for screencast live frame
  console.log("Waiting for live screencast image...");
  await page.waitForSelector("img[alt='Live agent browser screencast']", { timeout: 15000 });
  console.log("Live screencast stream active!");

  // Wait for step telemetry card
  console.log("Waiting for step telemetry...");
  await page.waitForSelector('[data-step-card="1"]', { timeout: 35000 });
  console.log("Step 1 rendered in timeline!");

  // Capture screenshot while agent is actively driving browser
  await page.waitForTimeout(1000);
  const liveShot = path.join(ARTIFACT_DIR, "nextjs_ui_live_running.png");
  await page.screenshot({ path: liveShot, fullPage: true });
  console.log("Captured Next.js live running screenshot to:", liveShot);

  // 6. Test Step Inspector Modal
  console.log("Clicking Step 1 card to open Step Inspector...");
  await page.click('[data-step-card="1"]');
  await page.waitForSelector("div:has-text('Step 1 Decision Breakdown')", { timeout: 8000 });
  console.log("Step Inspector modal opened successfully!");

  const inspectorShot = path.join(ARTIFACT_DIR, "nextjs_ui_step_inspector.png");
  await page.screenshot({ path: inspectorShot, fullPage: true });
  console.log("Captured Step Inspector screenshot to:", inspectorShot);

  // Close inspector
  await page.click("button:has-text('Close Inspector')");

  // Wait for run completion
  console.log("Waiting for run completion...");
  await page.waitForSelector("section:has-text('Goal Completed Successfully')", { timeout: 60000 });
  console.log("Run completed and Result Banner displayed!");

  const completedShot = path.join(ARTIFACT_DIR, "nextjs_ui_completed.png");
  await page.screenshot({ path: completedShot, fullPage: true });
  console.log("Captured completed run screenshot to:", completedShot);

  await browser.close();
  console.log("All Next.js UI verification tests passed with flying colors!");
}

verifyNextJsUI().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});

import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/Users/adnanahmad/.gemini/antigravity-ide/brain/bdf58fb2-9fdc-46c3-9e1d-919bd0b267ad";

async function testUI() {
  console.log("Launching Chromium for UI test...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");

  const title = await page.title();
  console.log("Page title:", title);

  // Check connection status dot
  await page.waitForSelector("#statusDot.connected", { timeout: 5000 });
  const status = await page.textContent("#statusText");
  console.log("Status text:", status);

  // 1. Capture Light Theme Screenshot
  await page.click("#themeBtnLight");
  await page.waitForTimeout(400);
  const lightShotPath = path.join(ARTIFACT_DIR, "ui_light_theme.png");
  await page.screenshot({ path: lightShotPath, fullPage: true });
  console.log("Captured light theme screenshot to:", lightShotPath);

  // 2. Capture Dark Theme Screenshot
  await page.click("#themeBtnDark");
  await page.waitForTimeout(400);
  const darkShotPath = path.join(ARTIFACT_DIR, "ui_dark_theme.png");
  await page.screenshot({ path: darkShotPath, fullPage: true });
  console.log("Captured dark theme screenshot to:", darkShotPath);

  // 3. Test preset click
  console.log("Testing preset click...");
  await page.click('.preset-tag[data-goal*="Hacker News"]');
  const goalVal = await page.inputValue("#goalInput");
  const urlVal = await page.inputValue("#urlInput");
  console.log("Preset populated goal:", goalVal, "url:", urlVal);

  await browser.close();
  console.log("UI verification test passed successfully!");
}

testUI().catch((err) => {
  console.error("UI test error:", err);
  process.exit(1);
});

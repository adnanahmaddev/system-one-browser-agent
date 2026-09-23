import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStartUrl, isMeaningfulExtraction } from "../src/browserAgent.js";
import { readDisplayConfig, describeDisplayConfig } from "../src/displayConfig.js";

test("display config reads viewport, scale, fps and quality from env", () => {
  const config = readDisplayConfig({
    AGENT_VIEWPORT: "1920x1080",
    AGENT_DEVICE_SCALE: "2",
    AGENT_FPS: "5",
    AGENT_SCREENSHOT_QUALITY: "80",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config.viewport, { width: 1920, height: 1080 });
  assert.equal(config.deviceScaleFactor, 2);
  assert.equal(config.screencastIntervalMs, 200); // 5fps
  assert.equal(config.screenshotQuality, 80);
  assert.equal(describeDisplayConfig(config), "1920x1080 @2x, ~5.0fps, JPEG q80");
});

test("display config falls back to defaults on junk input", () => {
  const config = readDisplayConfig({
    AGENT_VIEWPORT: "huge",
    AGENT_FPS: "99",
    AGENT_DEVICE_SCALE: "-1",
    AGENT_SCREENSHOT_QUALITY: "1000",
  } as NodeJS.ProcessEnv);

  // Undefined means "let the agent's own default apply" rather than a bad value.
  assert.deepEqual(config, {
    viewport: undefined,
    deviceScaleFactor: undefined,
    screenshotQuality: undefined,
    screencastIntervalMs: undefined,
  });
  assert.equal(describeDisplayConfig(config), "1920x1080 (default) @1x, ~2.5fps, JPEG q80");
});

test("rejects a start URL carrying a shell fragment", () => {
  // The exact value observed in a failing run: the agent navigated to
  // /maps%22%20--headless, got a 404, and burned its whole step budget on it.
  assert.throws(
    () => normalizeStartUrl('https://www.google.com/maps" --headless'),
    /whitespace or quote characters/
  );
});

test("rejects empty, non-http and unparseable start URLs", () => {
  assert.throws(() => normalizeStartUrl("   "), /empty/);
  assert.throws(() => normalizeStartUrl("file:///etc/passwd"), /must be http or https/);
  assert.throws(() => normalizeStartUrl("https://"), /not parseable/);
});

test("normalizes the unambiguous cases only", () => {
  assert.equal(normalizeStartUrl("  https://example.com/a  "), "https://example.com/a");
  assert.equal(normalizeStartUrl('"https://example.com/a"'), "https://example.com/a");
  assert.equal(normalizeStartUrl("example.com/a"), "https://example.com/a");
  assert.equal(
    normalizeStartUrl("https://www.google.com/maps"),
    "https://www.google.com/maps"
  );
});

test("an extraction of null-ish values is not an answer", () => {
  // Each of these previously counted as success, because the old check only
  // rejected null, undefined and {}.
  assert.equal(isMeaningfulExtraction({ distance: null }), false);
  assert.equal(isMeaningfulExtraction({ answer: "not found" }), false);
  assert.equal(isMeaningfulExtraction({ a: { b: [null, ""] } }), false);
  assert.equal(isMeaningfulExtraction("N/A"), false);
  assert.equal(isMeaningfulExtraction(""), false);
  assert.equal(isMeaningfulExtraction({}), false);
  assert.equal(isMeaningfulExtraction(null), false);
});

test("a real extraction is an answer", () => {
  assert.equal(isMeaningfulExtraction({ distance: "14.2 km" }), true);
  assert.equal(isMeaningfulExtraction({ stars: 0 }), true);
  assert.equal(isMeaningfulExtraction({ found: false }), true);
  assert.equal(isMeaningfulExtraction(["", "top story"]), true);
});

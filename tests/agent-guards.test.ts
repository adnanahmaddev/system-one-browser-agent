import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStartUrl, isMeaningfulExtraction } from "../src/browserAgent.js";

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

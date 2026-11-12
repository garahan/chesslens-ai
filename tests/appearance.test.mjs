import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeAppearance,
  resolveTheme,
  matchingLook,
  DEFAULT_APPEARANCE,
  THEME_LOOKS,
} from "../src/appearance-data.ts";
test("old preferences keep their colors and shapes while gaining an ivory finish", () => {
  assert.deepEqual(
    sanitizeAppearance({ app: "studio", board: "walnut", pieces: "outline" }),
    { app: "studio", board: "walnut", pieces: "outline", finish: "ivory" },
  );
  for (const bad of [
    null,
    undefined,
    42,
    "dark",
    [],
    { app: "constructor", board: "pink", pieces: "queen", finish: "chrome" },
  ])
    assert.deepEqual(sanitizeAppearance(bad), DEFAULT_APPEARANCE);
  assert.deepEqual(
    sanitizeAppearance({
      app: "royal",
      board: "unknown",
      pieces: "modern",
      finish: "frost",
    }),
    { app: "royal", board: "classic", pieces: "modern", finish: "frost" },
  );
});
test("coordinated looks are exact four-field selections, not a label on a different mix", () => {
  for (const look of THEME_LOOKS) {
    assert.deepEqual(sanitizeAppearance(look.appearance), look.appearance);
    assert.equal(matchingLook({ ...look.appearance }).id, look.id);
    assert.equal(
      matchingLook({
        ...look.appearance,
        finish: look.appearance.finish === "brass" ? "ivory" : "brass",
      }),
      undefined,
    );
  }
  const saved = { ...THEME_LOOKS[3].appearance };
  const copy = sanitizeAppearance(saved);
  copy.board = "mono";
  assert.equal(saved.board, "lavender");
});
test("system follows the phone while manual light and dark palettes stay fixed", () => {
  assert.equal(resolveTheme("system", true).id, "dark");
  assert.equal(resolveTheme("system", false).id, "light");
  assert.equal(resolveTheme("sunset", true).mode, "light");
  assert.equal(resolveTheme("royal", false).mode, "dark");
  assert.equal(resolveTheme("ocean", false).background, "#10242b");
});

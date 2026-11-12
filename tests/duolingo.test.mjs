import test from "node:test";
import assert from "node:assert/strict";
import { duolingoSignatures } from "../src/duolingo-signatures.ts";
test("Duolingo signatures include each piece and empty squares", () => {
  const rows = duolingoSignatures.trim().split("\n");
  const labels = new Set(rows.map((s) => s.split("|")[0]));
  assert.equal(rows.length, 26);
  assert.equal(labels.size, 13);
  for (const row of rows) {
    const [label, m, c] = row.split("|");
    assert.equal(m.length, 144, label);
    assert.match(m, /^[0-9]+$/);
    assert.equal(c.split(",").length, 3);
  }
});

test("piece alignment preserves all labels across one-pixel offsets, including queen versus rook", () => {
  let checked = 0;
  for (const row of duolingoSignatures.trim().split("\n")) {
    const [piece, raw, rgb] = row.split("|");
    if (piece === "-") continue;
    const mask = Float32Array.from(raw, (ch) => Number(ch) / 9);
    for (const dy of [-1, 0, 1])
      for (const dx of [-1, 0, 1]) {
        const moved = Float32Array.from(mask, (_, i) => {
          const x = (i % 12) - dx,
            y = Math.floor(i / 12) - dy;
          return x >= 0 && x < 12 && y >= 0 && y < 12 ? mask[y * 12 + x] : 0;
        });
        assert.equal(
          classify(moved, rgb.split(",").map(Number)).piece,
          piece,
          `${piece} offset ${dx},${dy}`,
        );
        checked++;
      }
  }
  assert.equal(checked, 216);
});

import { readFileSync } from "node:fs";
import { locateBoard, feature, classify } from "../src/duolingo.ts";
const light = [38, 52, 58],
  dark = [21, 30, 35];
function image(width, height, top) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const row = Math.floor((y - top) / (width / 8)),
        col = Math.floor(x / (width / 8));
      const color =
        y >= top && y < top + width
          ? (row + col) % 2 === 0
            ? light
            : dark
          : dark;
      const idx = (y * width + x) * 4;
      data.set([...color, 255], idx);
    }
  return { data, width, height };
}
test("board detector validates all eight ranks rather than accepting a two-rank shift", () => {
  const sample = image(128, 360, 72);
  assert.equal(locateBoard(sample.data, sample.width, sample.height), 72);
});
test("a board-only square crop is supported", () => {
  const sample = image(128, 128, 0);
  assert.equal(locateBoard(sample.data, sample.width, sample.height), 0);
});
test("a partial board and a flat background are rejected", () => {
  for (const top of [300, -64]) {
    const sample = image(128, 360, top);
    assert.equal(locateBoard(sample.data, sample.width, sample.height), null);
  }
  const sample = image(128, 360, 999);
  assert.equal(locateBoard(sample.data, sample.width, sample.height), null);
});
test("one contaminated corner does not turn an empty square into a piece", () => {
  const sample = image(24, 24, 0);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++)
      sample.data.set([38, 52, 58, 255], (y * 24 + x) * 4);
  // A resampling edge from the adjacent rank used to corrupt the single bg sample.
  sample.data.set([21, 30, 35, 255], (1 * 24 + 1) * 4);
  const tile = feature(sample, 0, 0);
  assert.equal(classify(tile.mask, tile.color).piece, ".");
});
test("every square in the supplied screenshot regression is classified correctly", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/duolingo-regression.json", import.meta.url),
    ),
  );
  assert.equal(fixture.samples.length, 64);
  fixture.samples.forEach((sample, index) => {
    const mask = Float32Array.from(sample.mask, (c) => Number(c) / 9);
    assert.equal(
      classify(mask, sample.color).piece,
      sample.piece,
      `visual square ${index}`,
    );
  });
});

import { combineMatches } from "../src/duolingo.ts";
test("stable multi-sample matches reduce marginal warnings without hiding disagreements", () => {
  const hit = (piece, n, q) => ({
    piece,
    score: Math.min(n, q),
    margin: Math.abs(n - q),
    confidence: 0.9,
    scores: { N: n, Q: q },
  });
  const stable = combineMatches(
    Array.from({ length: 5 }, () => hit("N", 0.04, 0.049)),
  );
  assert.equal(stable.piece, "N");
  assert.equal(stable.uncertain, false);
  const ambiguous = combineMatches(
    Array.from({ length: 5 }, () => hit("N", 0.04, 0.041)),
  );
  assert.equal(ambiguous.uncertain, true);
  const disagree = combineMatches([
    hit("N", 0.04, 0.09),
    hit("N", 0.04, 0.09),
    hit("Q", 0.09, 0.04),
    hit("Q", 0.09, 0.04),
    hit("Q", 0.09, 0.04),
  ]);
  assert.equal(disagree.uncertain, true);
});

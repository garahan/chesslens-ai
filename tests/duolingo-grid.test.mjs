import test from "node:test";
import assert from "node:assert/strict";
import { locateDuolingoGrid } from "../src/duolingo-grid.ts";
function make(width, height, x, y, size) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      let color = [250, 250, 250];
      if (col >= x && col < x + size && row >= y && row < y + size)
        color =
          (Math.floor((row - y) / (size / 8)) +
            Math.floor((col - x) / (size / 8))) %
          2
            ? [21, 30, 35]
            : [38, 52, 58];
      data.set([...color, 255], (row * width + col) * 4);
    }
  return data;
}
for (const [name, width, height, x, y, size] of [
  ["full", 160, 350, 0, 80, 160],
  ["thin-frame", 166, 360, 3, 81, 160],
  ["asymmetric", 200, 400, 32, 100, 160],
  ["wide-frame", 260, 400, 50, 120, 160],
])
  test(`finds every row and file in ${name} geometry`, () => {
    const bounds = locateDuolingoGrid(
      make(width, height, x, y, size),
      width,
      height,
    );
    assert.ok(bounds);
    assert.ok(Math.abs(bounds.x - x) <= 1.5, JSON.stringify(bounds));
    assert.ok(Math.abs(bounds.y - y) <= 1, JSON.stringify(bounds));
    assert.ok(Math.abs(bounds.size - size) <= 2, JSON.stringify(bounds));
  });
test("rejects a partial grid instead of shifting ranks", () => {
  assert.equal(locateDuolingoGrid(make(160, 300, 0, 240, 160), 160, 300), null);
});

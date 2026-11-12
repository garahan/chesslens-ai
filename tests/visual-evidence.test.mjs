import test from "node:test";
import assert from "node:assert/strict";
import {
  separateForeground,
  reduceMask,
} from "../src/recognition/foreground.ts";
import {
  normalizeFigure,
  normalizedDistance,
  anatomyOf,
  refineStructure,
} from "../src/recognition/structure.ts";
import { frameConsensus } from "../src/recognition/consensus.ts";
import { reconstructPosition } from "../src/recognition/reconstruction.ts";
import { coordinateVote } from "../src/recognition/coordinates.ts";
import { duolingoSignatures } from "../src/duolingo-signatures.ts";
const rectangle = () =>
  Float32Array.from({ length: 144 }, (_, i) =>
    i % 12 >= 4 &&
    i % 12 <= 7 &&
    Math.floor(i / 12) >= 2 &&
    Math.floor(i / 12) <= 9
      ? 1
      : 0,
  );
function pixels(background) {
  const data = new Uint8ClampedArray(48 * 48 * 4);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      const piece =
        (x - 24) ** 2 + (y - 15) ** 2 < 36 ||
        (y >= 20 && y <= 37 && x >= 19 && x <= 29);
      const color = piece ? [200, 215, 230] : background(x, y);
      data.set([...color, 255], (y * 48 + x) * 4);
    }
  return data;
}
test("foreground survives square colors, split highlights and soft shadows", () => {
  const backgrounds = [
    () => [21, 30, 35],
    () => [85, 72, 48],
    (x) => (x < 24 ? [21, 30, 35] : [85, 72, 48]),
    (x, y) => [21 + y / 8, 30 + y / 8, 35 + y / 8],
  ];
  const masks = backgrounds.map(
    (background) => separateForeground(pixels(background), 48).mask,
  );
  for (const mask of masks) assert.deepEqual(mask, masks[0]);
  assert.equal(
    separateForeground(pixels(backgrounds[2]), 48).backgrounds.length,
    2,
  );
});
test("ink on one edge does not become an alternative background", () => {
  const data = pixels(() => [21, 30, 35]);
  for (let y = 10; y < 30; y++)
    data.set([200, 215, 230, 255], (y * 48 + 2) * 4);
  const foreground = separateForeground(data, 48);
  assert.equal(foreground.backgrounds.length, 1);
  assert.ok(foreground.mask.reduce((a, b) => a + b, 0) > 150);
});
test("normalization preserves aspect, position and scale rather than stretching pieces", () => {
  const a = rectangle(),
    large = new Float32Array(48 * 48);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++)
      if (a[y * 12 + x])
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++)
            large[(y * 2 + 7 + dy) * 48 + x * 2 + 5 + dx] = 1;
  const distance = normalizedDistance(a, 12, large, 48);
  assert.ok(distance < 0.04, distance);
  assert.ok(
    Math.abs(
      normalizeFigure(a, 12).aspect - normalizeFigure(large, 48).aspect,
    ) < 0.01,
  );
  const symmetric = anatomyOf(a, 12),
    asymmetric = a.slice();
  asymmetric[4 * 12 + 7] = 0;
  asymmetric[5 * 12 + 7] = 0;
  assert.equal(symmetric.asymmetry, 0);
  assert.ok(anatomyOf(asymmetric, 12).asymmetry > symmetric.asymmetry);
});
test("specialist evidence recognizes each original piece shape without changing clear raw scores", () => {
  for (const row of duolingoSignatures.trim().split("\n")) {
    const [piece, raw, rgb] = row.split("|");
    if (piece === "-") continue;
    const scores = Object.fromEntries(
      [..."PNBRQKpnbrqk."].map((p) => [p, p === piece ? 0.01 : 0.3]),
    );
    const result = refineStructure(
      scores,
      Float32Array.from(raw, (ch) => Number(ch) / 9),
      12,
      rgb.split(",").map(Number),
    );
    assert.equal(result.proposed, piece);
    assert.ok(Object.values(result.anatomy).every(Number.isFinite));
    assert.ok(scores[piece] - result.scores[piece] <= 0.018001);
  }
});
const tile = (
  piece,
  mask,
  scores,
  uncertain = false,
  color = [190, 205, 215],
) => ({ piece, mask, color, scores, uncertain });
test("within-frame evidence uses frozen strong seeds and rejects conflicting labels", () => {
  const mask = rectangle();
  const clear = tile("P", mask, { P: 0.01, N: 0.2 }),
    weak = tile("N", mask, { P: 0.025, N: 0.02 }, true);
  const result = frameConsensus([clear, weak]);
  assert.equal(result.scores[1].P < result.scores[1].N, true);
  assert.deepEqual(result.changes[0].seeds, [0]);
  const conflict = frameConsensus([
    clear,
    tile("N", mask, { N: 0.01, P: 0.2 }),
    weak,
  ]);
  assert.deepEqual(conflict.scores[2], weak.scores);
  const noSeed = frameConsensus([
    tile("P", mask, { P: 0.02, N: 0.025 }, true),
    weak,
  ]);
  assert.equal(noSeed.changes.length, 0);
  assert.equal(
    frameConsensus([tile("p", mask, { p: 0.01, P: 0.2 }), weak]).changes.length,
    0,
  );
  const blank = new Float32Array(144);
  assert.equal(
    frameConsensus([
      tile("P", blank, { P: 0.01, N: 0.2 }),
      tile("N", blank, { P: 0.025, N: 0.02 }, true),
    ]).changes.length,
    0,
  );
});
test("reconstruction cannot use a square as its own reference or invent a missing class", () => {
  const sample = {
    mask: "0".repeat(2304),
    color: [190, 205, 215],
    coarse: "0".repeat(144),
    style: "duo-teal-v1",
  };
  const unknown = reconstructPosition([sample], ["Q"], [true]);
  assert.equal(unknown.checked, 0);
  assert.deepEqual(unknown.references, [null]);
  const peer = reconstructPosition([sample, sample], ["Q", "Q"], [true, false]);
  assert.deepEqual(peer.residuals, [null, 0]);
  const unexplained = reconstructPosition(
    [{ ...sample, mask: "f".repeat(2304) }],
    ["."],
    [false],
  );
  assert.deepEqual(unexplained.outliers, [0]);
  const jpegSpeck = { ...sample, mask: "f" + "0".repeat(2303) };
  assert.deepEqual(
    reconstructPosition([jpegSpeck], ["."], [false]).outliers,
    [],
  );
  assert.equal(reconstructPosition([sample], ["."], [true]).mean, 0);
});
test("coordinates require a sequence, abstain on absent or conflicting labels and preserve direction", () => {
  assert.equal(
    coordinateVote([{ axis: "files", labels: [..."abcde", null, null, null] }])
      .orientation,
    "white",
  );
  assert.equal(
    coordinateVote([{ axis: "ranks", labels: [..."12345678"] }]).orientation,
    "black",
  );
  assert.equal(
    coordinateVote([
      { axis: "files", labels: [..."abcd", null, null, null, null] },
    ]).orientation,
    null,
  );
  assert.equal(
    coordinateVote([{ axis: "files", labels: [..."aaaaaaaa"] }]).orientation,
    null,
  );
  assert.equal(
    coordinateVote([
      { axis: "files", labels: [..."abcdefgh"] },
      { axis: "ranks", labels: [..."12345678"] },
    ]).orientation,
    null,
  );
  assert.equal(coordinateVote([]).orientation, null);
});

test("size-normalized anatomy resolves a close scaled queen/rook contest", () => {
  const row = duolingoSignatures
    .trim()
    .split("\n")
    .find((row) => row.startsWith("q|"));
  const [, raw, rgb] = row.split("|"),
    scaled = new Float32Array(48 * 48);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++)
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++)
          scaled[(y * 2 + 6 + dy) * 48 + x * 2 + 9 + dx] =
            Number(raw[y * 12 + x]) / 9;
  const scores = Object.fromEntries(
    [...".PNBRQKpnbrqk"].map((p) => [
      p,
      p === "r" ? 0.045 : p === "q" ? 0.05 : 0.3,
    ]),
  );
  const result = refineStructure(
    scores,
    scaled,
    48,
    rgb.split(",").map(Number),
  );
  assert.equal(result.proposed, "q");
  assert.ok(result.scores.q < result.scores.r);
});

test("small isolated coordinate ink is excluded without removing the central piece", () => {
  const clean = pixels(() => [21, 30, 35]),
    labelled = clean.slice();
  for (let y = 37; y < 42; y++)
    for (let x = 37; x < 40; x++)
      labelled.set([220, 230, 240, 255], (y * 48 + x) * 4);
  assert.deepEqual(
    separateForeground(labelled, 48).mask,
    separateForeground(clean, 48).mask,
  );
});

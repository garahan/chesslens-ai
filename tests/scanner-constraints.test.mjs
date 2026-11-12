import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { materialErrors, validateAnalysisPosition } from "../src/position.ts";
import { inferDuolingoPosition } from "../src/duolingo-inference.ts";
const start = new Chess()
  .board()
  .flat()
  .map((p) => (p ? (p.color === "w" ? p.type.toUpperCase() : p.type) : "."));
const minimal = () => {
  const board = Array(64).fill(".");
  board[4] = "k";
  board[60] = "K";
  return board;
};
test("promotion budgets reject impossible bishop counts but allow legal extra material", () => {
  const invalid = minimal();
  for (let i = 8; i < 16; i++) invalid[i] = "P";
  invalid[20] = "B";
  invalid[22] = "B";
  invalid[29] = "B";
  assert.ok(materialErrors(invalid).some((e) => e.includes("promoted")));
  const promoted = minimal();
  promoted[20] = "N";
  promoted[22] = "N";
  promoted[30] = "N";
  assert.deepEqual(materialErrors(promoted), []);
  const many = minimal();
  for (let i = 8; i < 16; i++) many[i] = "N";
  assert.deepEqual(materialErrors(many), []);
});
test("bishop color and all-32-piece constraints catch promotion-dependent interpretations", () => {
  const sameColor = minimal();
  for (let i = 8; i < 16; i++) sameColor[i] = "P";
  sameColor[18] = "B";
  sameColor[20] = "B";
  assert.ok(materialErrors(sameColor).some((e) => e.includes("promoted")));
  const misread = start.slice();
  misread[48] = "B";
  assert.ok(
    materialErrors(misread).some((e) =>
      e.includes("no pieces have been captured"),
    ),
  );
});
test("global visual inference resolves pawn versus bishop without simply capping minor pieces at two", () => {
  const tiles = start.map((piece) => ({ piece, scores: { [piece]: 0.01 } }));
  tiles[48] = { piece: "B", scores: { B: 0.05, P: 0.065 } };
  const result = inferDuolingoPosition(tiles);
  assert.ok(result);
  assert.deepEqual(result.squares, start);
  assert.deepEqual(result.adjusted, [48]);
});
test("inference refuses to manufacture kings from confident empty squares", () => {
  const tiles = Array.from({ length: 64 }, () => ({
    piece: ".",
    scores: { ".": 0.001, K: 0.15, k: 0.16 },
  }));
  assert.equal(inferDuolingoPosition(tiles), null);
});
test("illegal last-mover check is rejected while a legal checked side can analyze", () => {
  assert.throws(
    () => validateAnalysisPosition("4k3/8/8/8/8/8/4R3/4K3 w - - 0 1"),
    /still in check/,
  );
  assert.doesNotThrow(() =>
    validateAnalysisPosition("4k3/8/8/8/8/8/4R3/4K3 b - - 0 1"),
  );
});

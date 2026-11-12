import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { replayLine, statusOfLine, claimDraw } from "../src/rules.ts";
import { readFileSync } from "node:fs";
import {
  PIECES,
  validSample,
  shapeDistance,
} from "../src/recognition/features.ts";
import {
  readLearning,
  learnCorrection,
  undoLearning,
  resetLearning,
  setLearningEnabled,
  LEARNING_KEY,
} from "../src/recognition/learning.ts";
import {
  refineWithLibrary,
  libraryCoverage,
} from "../src/recognition/library.ts";
import {
  secondRead,
  secondReaderInfo,
} from "../src/recognition/second-reader.ts";
import {
  placementOf,
  matchContinuation,
  trackPosition,
  getTrackedGame,
  advanceTracking,
  stopTracking,
  TRACK_KEY,
} from "../src/recognition/tracking.ts";
const memory = () => {
  const rows = new Map();
  return {
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => rows.set(key, value),
    removeItem: (key) => rows.delete(key),
  };
};
const sample = (n = 0) => ({
  mask: n.toString(16).padStart(4, "0") + "f".repeat(2300),
  coarse: "0".repeat(144),
  color: [200, 210, 220],
  style: "duo-teal-v1",
});
test("learning is opt-in, bounded, reversible, and resilient to unavailable storage", () => {
  const store = memory();
  assert.equal(readLearning(store).enabled, false);
  assert.equal(learnCorrection(sample(), "P", store), null);
  assert.equal(setLearningEnabled(true, store), true);
  const edit = learnCorrection(sample(), "P", store);
  assert.equal(readLearning(store).samples.length, 1);
  assert.equal(undoLearning(edit, store), true);
  assert.equal(readLearning(store).samples.length, 0);
  learnCorrection(sample(), "P", store);
  learnCorrection(sample(), "N", store);
  assert.deepEqual(
    readLearning(store).samples.map((s) => s.piece),
    ["N"],
  );
  for (let i = 1; i < 20; i++) learnCorrection(sample(i), "P", store);
  assert.equal(
    readLearning(store).samples.filter((s) => s.piece === "P").length,
    10,
  );
  const stale = learnCorrection(sample(30), "B", store);
  learnCorrection(sample(31), "R", store);
  assert.equal(undoLearning(stale, store), false);
  assert.equal(resetLearning(store), true);
  assert.equal(readLearning(store).samples.length, 0);
  const broken = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("quota");
    },
    removeItem: () => {
      throw Error("blocked");
    },
  };
  assert.equal(setLearningEnabled(true, broken), false);
  assert.equal(resetLearning(null), false);
  store.setItem(
    LEARNING_KEY,
    JSON.stringify({
      version: 1,
      enabled: true,
      samples: [
        null,
        { ...sample(), piece: null },
        { ...sample(), piece: "PP", id: "bad", time: 0 },
      ],
    }),
  );
  assert.deepEqual(readLearning(store).samples, []);
  assert.equal(validSample({ ...sample(), color: [NaN, 0, 0] }), false);
});
test("native references preserve missing-class fallbacks and personal influence stays bounded", () => {
  const atlas = JSON.parse(
    readFileSync(
      new URL("../src/recognition/piece-library.json", import.meta.url),
    ),
  );
  const ref = atlas.samples.find((s) => s.piece === "P");
  const input = { ...ref, coarse: "0".repeat(144), style: "duo-teal-v1" };
  const scores = Object.fromEntries(
    [...PIECES].map((p) => [p, p === "R" ? 0.04 : p === "P" ? 0.045 : 0.3]),
  );
  const original = { ...scores };
  const result = refineWithLibrary(scores, input);
  assert.equal(shapeDistance(ref.mask, ref.mask), 0);
  assert.equal(shapeDistance("bad", ref.mask), Infinity);
  assert.ok(result.scores.P < original.P);
  assert.equal(result.scores.B, original.B);
  assert.deepEqual(scores, original);
  assert.deepEqual(libraryCoverage.missingNativeLabels, ["B", "Q", "b", "q"]);
  const personal = { ...input, piece: "B", id: "test", time: 0 };
  const learned = refineWithLibrary(scores, input, [personal]);
  assert.ok(original.B - learned.scores.B <= 0.028001);
  assert.equal(
    refineWithLibrary(scores, input, [{ ...personal, style: "different" }])
      .scores.B,
    original.B,
  );
  const closeMissing = { ...scores, B: 0.04 };
  assert.equal(refineWithLibrary(closeMissing, input).scores.P, closeMissing.P);
  const queenContest = { ...scores, q: 0.04, r: 0.045, R: 0.3, P: 0.3 };
  const rook = atlas.samples.find((s) => s.piece === "r");
  const guarded = refineWithLibrary(queenContest, {
    ...rook,
    coarse: "0".repeat(144),
    style: "duo-teal-v1",
  });
  assert.equal(guarded.piece, "q");
  assert.equal(guarded.scores.r, queenContest.r);
});
test("trained reader returns finite normalized activations without claiming validation", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/duolingo-regression.json", import.meta.url),
    ),
  );
  for (const row of fixture.samples) {
    const result = secondRead(
      Float32Array.from(row.mask, (c) => Number(c) / 9),
      row.color,
    );
    assert.ok(PIECES.includes(result.piece));
    assert.ok(
      Number.isFinite(result.activation) &&
        result.activation >= 0 &&
        result.activation <= 1,
    );
    assert.equal(result.validated, false);
    assert.equal(result.alternatives.length, 3);
  }
  assert.equal(secondReaderInfo.validated, false);
});
function evidence(board) {
  return placementOf(board).map((piece) =>
    Object.fromEntries([...PIECES].map((p) => [p, p === piece ? 0.001 : 0.3])),
  );
}
test("tracking identifies unchanged positions and legal one/two-ply continuations", () => {
  const board = new Chess(),
    anchor = board.fen();
  assert.deepEqual(matchContinuation(anchor, evidence(board)).moves, []);
  board.move("e4");
  const one = matchContinuation(anchor, evidence(board));
  assert.deepEqual(one.moves, ["e4"]);
  assert.equal(one.fen, board.fen());
  board.move("c5");
  assert.deepEqual(matchContinuation(anchor, evidence(board)).moves, [
    "e4",
    "c5",
  ]);
  board.move("Nf3");
  assert.equal(matchContinuation(anchor, evidence(board)), null);
});
test("legal tracking preserves castling, en passant and promotion", () => {
  const cases = [
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "O-O"],
    ["4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", "exd6"],
    ["4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=N"],
  ];
  for (const [anchor, move] of cases) {
    const board = new Chess(anchor);
    board.move(move);
    const match = matchContinuation(anchor, evidence(board), 1);
    assert.equal(match?.fen, board.fen(), move);
  }
});
test("tracking rejects weak, malformed, ambiguous, and incomplete searches", () => {
  const board = new Chess(),
    anchor = board.fen();
  const flat = Array.from({ length: 64 }, () =>
    Object.fromEntries([...PIECES].map((p) => [p, 0.01])),
  );
  assert.equal(matchContinuation(anchor, flat, 0), null);
  assert.equal(
    matchContinuation(
      anchor,
      Array.from({ length: 64 }, () => ({})),
    ),
    null,
  );
  const a = new Chess(anchor),
    b = new Chess(anchor);
  a.move("e4");
  b.move("d4");
  const ambiguous = evidence(a),
    other = evidence(b);
  ambiguous.forEach((row, i) =>
    Object.keys(row).forEach((p) => (row[p] = Math.min(row[p], other[i][p]))),
  );
  assert.equal(matchContinuation(anchor, ambiguous), null);
  const crowded =
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
  // Kiwipete has 2,039 legal two-ply leaves, beyond the bounded search.
  assert.equal(matchContinuation(crowded, evidence(new Chess(crowded))), null);
  assert.equal(matchContinuation("bad fen", evidence(board)), null);
});
test("tracking storage expires, advances only from the expected anchor, and resets", () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = memory();
  try {
    const board = new Chess(),
      anchor = board.fen();
    assert.equal(trackPosition(anchor), true);
    board.move("e4");
    assert.equal(advanceTracking("stale anchor", board.fen()), false);
    assert.equal(getTrackedGame().fen, anchor);
    assert.equal(advanceTracking(anchor, board.fen()), true);
    localStorage.setItem(
      TRACK_KEY,
      JSON.stringify({
        version: 1,
        fen: anchor,
        updated: Date.now() - 5 * 3600000,
      }),
    );
    assert.equal(getTrackedGame(), null);
    assert.equal(stopTracking(), true);
    assert.equal(getTrackedGame(), null);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test("tracked continuation carries the complete legal line and draw history", () => {
  const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
  const line = {
    rootFen: new Chess().fen(),
    moves: [...cycle, ...cycle.slice(0, 3)],
  };
  const anchor = replayLine(line),
    next = replayLine(line);
  next.move("Ng8");
  const match = matchContinuation(anchor.fen(), evidence(next), 1, line);
  assert.deepEqual(match.line.moves, [...cycle, ...cycle]);
  assert.equal(statusOfLine(match.line).repetitions, 3);
  const claimed = claimDraw(match.line, 8, "threefold repetition");
  const unchanged = matchContinuation(next.fen(), evidence(next), 1, claimed);
  assert.deepEqual(unchanged.line, claimed);
  const after = replayLine(claimed);
  after.move("e4");
  assert.equal(
    matchContinuation(next.fen(), evidence(after), 1, claimed),
    null,
  );
  const previous = globalThis.localStorage;
  globalThis.localStorage = memory();
  try {
    assert.equal(trackPosition(anchor.fen(), line), true);
    assert.equal(advanceTracking(anchor.fen(), match.fen, match.line), true);
    assert.deepEqual(getTrackedGame().line, match.line);
    assert.equal(statusOfLine(getTrackedGame().line).repetitions, 3);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

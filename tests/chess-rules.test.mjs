import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import {
  validateAnalysisPosition,
  pawnReachabilityErrors,
} from "../src/position.ts";
import {
  replayLine,
  ruleStatus,
  statusOfLine,
  repetitionCount,
  claimDraw,
  upcomingClaims,
  GAME_KEY,
  savedGame,
  saveGame,
} from "../src/rules.ts";
import { ChessEngine, parseInfo } from "../src/engine.ts";
const START = new Chess().fen();
const line = (rootFen = START, moves = []) => ({ rootFen, moves });
const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
test("strict metadata rejects invented castling and malformed FEN counters", () => {
  for (const fen of [
    "4k3/8/8/8/8/8/8/4K3 w K - 0 1",
    "4k3/8/8/8/8/8/4K3/7R w K - 0 1",
    START.replace("KQkq", "KK"),
    START.replace("KQkq", "K-"),
    START.replace("0 1", "0.5 1"),
    START.replace("0 1", "1x 1"),
    START.replace("0 1", "0 1x"),
  ])
    assert.throws(() => validateAnalysisPosition(fen), undefined, fen);
  assert.doesNotThrow(() =>
    validateAnalysisPosition("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"),
  );
});
test("castling cannot leave check, cross check or jump occupied squares, and rights never return", () => {
  const legal = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.ok(legal.moves().includes("O-O"));
  assert.ok(legal.moves().includes("O-O-O"));
  for (const fen of [
    "r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1",
    "r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1",
    "r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1",
  ])
    assert.ok(!new Chess(fen).moves().includes("O-O"), fen);
  const moved = replayLine(
    line("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", [
      "h1h2",
      "h8h7",
      "h2h1",
      "h7h8",
    ]),
  );
  assert.equal(moved.fen().split(" ")[2], "Qq");
  assert.ok(!moved.moves().includes("O-O"));
  const captured = new Chess("4k2r/8/8/8/8/8/8/4K2R b Kk - 0 1");
  captured.move("Rxh1+");
  assert.equal(captured.fen().split(" ")[2], "-");
});
test("en passant must follow an actual legal double push, expires, and cannot expose the king", () => {
  const valid = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2";
  assert.doesNotThrow(() => validateAnalysisPosition(valid));
  const board = new Chess(valid);
  assert.ok(board.moves().includes("exd6"));
  board.move("exd6");
  assert.equal(board.get("d5"), undefined);
  assert.equal(board.get("d6").type, "p");
  for (const fen of [
    valid.replace("d6", "c6"),
    valid.replace("0 2", "1 2"),
    "4k3/3p4/8/3pP3/8/8/8/4K3 w - d6 0 2",
    "4k3/8/3N4/3pP3/8/8/8/4K3 w - d6 0 2",
  ])
    assert.throws(() => validateAnalysisPosition(fen));
  const pinned = "k7/8/8/4KPpr/8/8/8/8 w - g6 0 2";
  assert.doesNotThrow(() => validateAnalysisPosition(pinned));
  assert.ok(!new Chess(pinned).moves().includes("fxg6"));
  const escape = new Chess("4k3/8/8/3pP3/4K3/8/8/8 w - d6 0 2");
  assert.ok(escape.isCheck());
  escape.move("exd6");
  assert.equal(escape.isCheck(), false);
  const expires = new Chess(valid);
  expires.move("Kd2");
  expires.move("Kd7");
  assert.ok(!expires.moves().includes("exd6"));
});
test("promotion offers all four pieces and never a king or pawn", () => {
  const board = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  assert.deepEqual(
    board
      .moves({ verbose: true, square: "a7" })
      .map((m) => m.promotion)
      .sort(),
    ["b", "n", "q", "r"],
  );
  assert.throws(() => board.move({ from: "a7", to: "a8", promotion: "k" }));
  const under = replayLine(line(board.fen(), ["a7a8n"]));
  assert.equal(under.get("a8").type, "n");
});
test("necessary pawn-origin matching and impossible check combinations are rejected", () => {
  const board = new Chess();
  board.remove("a2");
  board.put({ type: "p", color: "w" }, "b3");
  assert.ok(
    pawnReachabilityErrors(
      board
        .board()
        .flat()
        .map((p) =>
          p ? (p.color === "w" ? p.type.toUpperCase() : p.type) : ".",
        ),
    ).length,
  );
  assert.throws(() => validateAnalysisPosition(board.fen()), /captures/);
  board.remove("a7");
  assert.doesNotThrow(() => validateAnalysisPosition(board.fen()));
  assert.throws(
    () => validateAnalysisPosition("k7/8/8/8/8/8/2n3n1/4K3 w - - 0 1"),
    /checking/,
  );
  assert.throws(
    () => validateAnalysisPosition("k3r3/8/8/8/1b6/8/8/4K3 b - - 0 1"),
    /still in check/,
  );
  assert.doesNotThrow(() =>
    validateAnalysisPosition("k3r3/8/8/8/8/8/2n5/4K3 w - - 0 1"),
  );
  assert.throws(
    () => validateAnalysisPosition("k3r3/8/8/8/1b5b/8/8/4K3 w - - 0 1"),
    /checking/,
  );
});
test("check, mate, stalemate and known dead material have correct status; mate precedes 75 moves", () => {
  assert.equal(
    ruleStatus(new Chess("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1")).reason,
    "check",
  );
  assert.equal(
    ruleStatus(new Chess("7k/6Q1/5K2/8/8/8/8/8 b - - 150 80")).reason,
    "checkmate",
  );
  assert.equal(
    ruleStatus(new Chess("7k/5Q2/5K2/8/8/8/8/8 b - - 0 1")).reason,
    "stalemate",
  );
  for (const fen of [
    "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1",
    "4k3/8/8/8/8/8/8/2N1K3 w - - 0 1",
  ])
    assert.equal(ruleStatus(new Chess(fen)).reason, "insufficient-material");
  assert.equal(
    ruleStatus(new Chess("4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1")).terminal,
    false,
  );
});
test("threefold and 50 moves are claimable, fivefold and 75 moves are automatic", () => {
  const three = line(START, [...cycle, ...cycle]),
    b = replayLine(three);
  assert.equal(repetitionCount(b), 3);
  assert.equal(ruleStatus(b).terminal, false);
  assert.ok(ruleStatus(b).claims.includes("threefold repetition"));
  assert.equal(
    statusOfLine(claimDraw(three, 8, "threefold repetition")).reason,
    "claimed-draw",
  );
  assert.equal(
    statusOfLine(line(START, [...cycle, ...cycle, ...cycle, ...cycle])).reason,
    "fivefold",
  );
  assert.throws(
    () =>
      replayLine(line(START, [...cycle, ...cycle, ...cycle, ...cycle, "g1f3"])),
    /automatic/,
  );
  const fifty = new Chess("4k3/8/8/8/8/8/8/R3K3 w - - 100 60");
  assert.equal(ruleStatus(fifty).terminal, false);
  assert.ok(ruleStatus(fifty).claims.includes("50-move rule"));
  const seventy = line("4k3/8/8/8/8/8/8/R3K3 w - - 149 80", ["a1a2"]);
  assert.equal(statusOfLine(seventy).reason, "75-move");
  assert.throws(
    () => replayLine({ ...seventy, moves: [...seventy.moves, "e8e7"] }),
    /automatic/,
  );
});
test("claims may be declared with an intended legal move, without playing it", () => {
  const before = line(START, [...cycle, ...cycle.slice(0, 3)]);
  const options = upcomingClaims(before, 7);
  assert.ok(
    options.some(
      (o) => o.uci === "f6g8" && o.reason === "threefold repetition",
    ),
  );
  const claim = claimDraw(before, 7, "threefold repetition", "f6g8");
  assert.equal(claim.moves.length, 7);
  assert.equal(statusOfLine(claim).terminal, true);
  assert.equal(replayLine(claim).get("f6").type, "n");
  assert.throws(() => claimDraw(line(), 0, "threefold repetition"));
  assert.throws(() => claimDraw(before, 7, "threefold repetition", "a7a5"));
});
test("draw history, branch navigation, claims and offline persistence survive without losing rights", () => {
  const value = line(START, [...cycle, ...cycle]);
  assert.equal(statusOfLine(value, 4).repetitions, 2);
  assert.equal(statusOfLine(value, 8).repetitions, 3);
  const branch = line(START, [...value.moves.slice(0, 4), "e2e4"]);
  assert.equal(statusOfLine(branch).repetitions, 1);
  const saved = globalThis.localStorage,
    store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, v),
  };
  try {
    saveGame(value, 8);
    assert.deepEqual(savedGame(), value);
    saveGame(claimDraw(value, 8, "threefold repetition"), 8);
    assert.equal(statusOfLine(savedGame()).reason, "claimed-draw");
    store.set(
      GAME_KEY,
      JSON.stringify({ version: 1, line: { ...value, moves: ["e2e5"] } }),
    );
    assert.equal(savedGame(), null);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});
test("Stockfish receives actual history, skips terminal positions, and discards illegal PV moves", () => {
  const original = globalThis.Worker,
    workers = [];
  globalThis.Worker = class {
    messages = [];
    constructor() {
      workers.push(this);
    }
    postMessage(m) {
      this.messages.push(m);
    }
    terminate() {}
    emit(data) {
      this.onmessage?.({ data });
    }
  };
  try {
    const updates = [],
      engine = new ChessEngine((pv, state) => updates.push({ pv, state }));
    const history = line(START, ["e2e4", "e7e5"]);
    engine.analyze(replayLine(history).fen(), 8, history);
    workers[0].emit("uciok");
    workers[0].emit("readyok");
    assert.ok(
      workers[0].messages.includes(`position fen ${START} moves e2e4 e7e5`),
    );
    const count = workers.length;
    engine.analyze("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", 8);
    assert.equal(workers.length, count);
    assert.match(updates.at(-1).state, /Checkmate/);
    const bad = parseInfo("info depth 8 score cp 40 pv e2e5", START);
    assert.equal(bad, null);
    const trimmed = parseInfo(
      "info depth 8 score cp 40 pv e2e4 e7e4 a2a3",
      START,
    );
    assert.deepEqual(trimmed.uci, ["e2e4"]);
  } finally {
    globalThis.Worker = original;
  }
});
test("move generation agrees with established perft reference counts", () => {
  const start = new Chess();
  assert.equal(start.perft(3), 8902);
  const kiwi =
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
  validateAnalysisPosition(kiwi);
  assert.equal(new Chess(kiwi).perft(2), 2039);
  const end = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
  validateAnalysisPosition(end);
  assert.equal(new Chess(end).perft(3), 2812);
});

test("repetition compares legal en-passant availability and castling rights", () => {
  const root = "k7/8/8/4KPpr/8/8/8/8 w - g6 0 2";
  const loop = ["e5d5", "a8b8", "d5e5", "b8a8"];
  const b = replayLine(line(root, [...loop, ...loop]));
  assert.equal(repetitionCount(b), 3); // pinned EP was never a legal choice
  const castle = line("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", [
    "h1h2",
    "h8h7",
    "h2h1",
    "h7h8",
  ]);
  assert.equal(repetitionCount(replayLine(castle)), 1); // original rights have been lost
});

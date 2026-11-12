import test from "node:test";
import assert from "node:assert/strict";
import { ChessEngine, searchCommand } from "../src/engine.ts";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
test("infinite is an actual UCI mode, and depth limits are validated", () => {
  assert.equal(searchCommand("infinite"), "go infinite");
  assert.equal(searchCommand(15), "go depth 15");
  for (const n of [0, -1, NaN, Infinity, 1.5, 65])
    assert.throws(() => searchCommand(n), RangeError);
});
test("engine restarts with the chosen limit and ignores results after pause", () => {
  const original = globalThis.Worker;
  const workers = [];
  class Worker {
    messages = [];
    terminated = false;
    constructor() {
      workers.push(this);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
    emit(data) {
      this.onmessage?.({ data });
    }
  }
  globalThis.Worker = Worker;
  try {
    const updates = [];
    const engine = new ChessEngine((lines, state) =>
      updates.push({ lines, state }),
    );
    engine.analyze(START, 10);
    const first = workers[0];
    first.emit("uciok");
    first.emit("readyok");
    assert.ok(first.messages.includes("go depth 10"));
    assert.ok(first.messages.includes("setoption name MultiPV value 3"));
    engine.analyze(START, "infinite");
    assert.equal(first.terminated, true);
    const second = workers[1];
    second.emit("uciok");
    second.emit("readyok");
    assert.ok(second.messages.includes("go infinite"));
    second.emit(
      "info depth 8 multipv 1 score cp 24 nodes 1000 nps 1000 pv e2e4 e7e5",
    );
    assert.deepEqual(updates.at(-1).lines[0].san, ["e4", "e5"]);
    engine.stop();
    const count = updates.length;
    second.emit("info depth 9 multipv 1 score cp 90 pv e2e4");
    assert.equal(updates.length, count);
    assert.equal(second.terminated, true);
    engine.dispose();
  } finally {
    globalThis.Worker = original;
  }
});

test("the engine refuses an invalid recognized board before starting a worker", () => {
  const original = globalThis.Worker;
  let created = 0;
  globalThis.Worker = class {
    constructor() {
      created++;
    }
  };
  try {
    let status = "";
    const engine = new ChessEngine((_lines, message) => (status = message));
    engine.analyze("8/8/8/8/8/8/8/8 w - - 0 1", 15);
    assert.equal(created, 0);
    assert.match(status, /Position needs correction/);
    engine.dispose();
  } finally {
    globalThis.Worker = original;
  }
});

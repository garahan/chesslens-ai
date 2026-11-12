import { validateAnalysisPosition } from "./position.ts";
import { Chess } from "chess.js";
export type AnalysisLimit = number | "infinite";
export function searchCommand(limit: AnalysisLimit) {
  if (limit === "infinite") return "go infinite";
  if (!Number.isInteger(limit) || limit < 1 || limit > 64)
    throw new RangeError("Depth must be 1–64 or infinite");
  return `go depth ${limit}`;
}
export type Variation = {
  rank: number;
  depth: number;
  cp: number | null;
  mate: number | null;
  uci: string[];
  san: string[];
  nps: number;
};
type EngineUpdate = (variations: Variation[], state: string) => void;
function toSan(fen: string, pv: string[]): string[] {
  const board = new Chess(fen);
  const result: string[] = [];
  for (const u of pv) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)) break;
    try {
      const move = board.move({
        from: u.slice(0, 2),
        to: u.slice(2, 4),
        promotion: u[4],
      });
      if (!move) break;
      result.push(move.san);
    } catch {
      break;
    }
  }
  return result;
}
export function parseInfo(line: string, fen: string): Variation | null {
  if (
    !line.startsWith("info ") ||
    !line.includes(" pv ") ||
    !line.includes(" score ")
  )
    return null;
  const depth = Number(line.match(/\bdepth (\d+)/)?.[1] || 0),
    rank = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1);
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  if (!score) return null;
  const pv = line.split(" pv ")[1]?.trim().split(/\s+/) || [];
  if (!pv.length || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(pv[0])) return null;
  const normalized =
    (new Chess(fen).turn() === "b" ? -1 : 1) * Number(score[2]);
  return {
    rank,
    depth,
    cp: score[1] === "cp" ? normalized : null,
    mate: score[1] === "mate" ? normalized : null,
    uci: pv,
    san: toSan(fen, pv),
    nps: Number(line.match(/\bnps (\d+)/)?.[1] || 0),
  };
}
export class ChessEngine {
  private worker: Worker | null = null;
  private request = 0;
  private handler: EngineUpdate;
  private variations = new Map<number, Variation>();
  private maxDepth = 0;
  constructor(handler: EngineUpdate) {
    this.handler = handler;
  }
  analyze(fen: string, depth: AnalysisLimit) {
    this.stopWorker();
    const request = ++this.request;
    try {
      validateAnalysisPosition(fen);
    } catch (error) {
      this.handler(
        [],
        `Position needs correction: ${error instanceof Error ? error.message : "invalid position"}`,
      );
      return;
    }
    this.handler([], "Loading Stockfish…");
    let worker: Worker;
    try {
      worker = new Worker("/engine/stockfish-19-lite-single.js");
    } catch {
      this.handler([], "Stockfish could not start");
      return;
    }
    this.worker = worker;
    worker.onerror = () => {
      if (this.request === request)
        this.handler(
          [],
          "Engine failed to load — check browser logs and engine assets",
        );
    };
    worker.onmessage = (event: MessageEvent) => {
      if (this.request !== request || this.worker !== worker) return;
      for (const line of String(event.data).split(/\r?\n/)) {
        if (line.trim() === "uciok") {
          worker.postMessage("setoption name Hash value 16");
          worker.postMessage("setoption name MultiPV value 3");
          worker.postMessage("isready");
        }
        if (line.trim() === "readyok") {
          this.handler([], "Analyzing");
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage(searchCommand(depth));
        }
        const v = parseInfo(line, fen);
        if (v) {
          if (v.depth > this.maxDepth) {
            this.maxDepth = v.depth;
            this.variations.clear();
          }
          if (v.depth === this.maxDepth) {
            this.variations.set(v.rank, v);
            this.handler(
              [...this.variations.values()].sort((a, b) => a.rank - b.rank),
              "Analyzing",
            );
          }
        }
        if (line.startsWith("bestmove "))
          this.handler(
            [...this.variations.values()].sort((a, b) => a.rank - b.rank),
            "Analysis complete",
          );
      }
    };
    worker.postMessage("uci");
  }
  private stopWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.variations.clear();
    this.maxDepth = 0;
  }
  stop() {
    this.request++;
    this.stopWorker();
    this.handler([], "Engine paused");
  }
  dispose() {
    this.request++;
    this.stopWorker();
  }
}

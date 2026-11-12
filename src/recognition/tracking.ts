import { replayLine, statusOfLine, uciOf, type GameLine } from "../rules.ts";
import { Chess } from "chess.js";
import { validateAnalysisPosition } from "../position.ts";
export const TRACK_KEY = "chesslens-game-v1";
export type TrackedGame = {
  version: 1;
  fen: string;
  updated: number;
  line?: GameLine;
};
export function getTrackedGame(): TrackedGame | null {
  try {
    const value = JSON.parse(localStorage.getItem(TRACK_KEY) || "null");
    if (
      value?.version !== 1 ||
      !Number.isFinite(value.updated) ||
      value.updated > Date.now() + 60000 ||
      Date.now() - value.updated > 4 * 3600000
    )
      return null;
    validateAnalysisPosition(value.fen);
    if (
      value.line &&
      replayLine(value.line).fen() !== new Chess(value.fen).fen()
    )
      return null;
    if (value.line) statusOfLine(value.line);
    return value;
  } catch {
    return null;
  }
}
export function trackPosition(fen: string, line?: GameLine) {
  validateAnalysisPosition(fen);
  if (line && replayLine(line).fen() !== new Chess(fen).fen())
    throw Error("Tracking history does not match its position");
  if (line) statusOfLine(line);
  try {
    localStorage.setItem(
      TRACK_KEY,
      JSON.stringify({
        version: 1,
        fen: new Chess(fen).fen(),
        updated: Date.now(),
        ...(line ? { line } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function stopTracking() {
  try {
    localStorage.removeItem(TRACK_KEY);
    return true;
  } catch {
    return false;
  }
}
export function advanceTracking(
  expected: string,
  next: string,
  line?: GameLine,
) {
  if (getTrackedGame()?.fen !== expected) return false;
  return trackPosition(next, line);
}
export function placementOf(board: Chess) {
  return board
    .board()
    .flat()
    .map((piece) =>
      piece
        ? piece.color === "w"
          ? piece.type.toUpperCase()
          : piece.type
        : ".",
    );
}
export type TemporalMatch = {
  fen: string;
  moves: string[];
  compared: number;
  gap: number;
  anchor: string;
  line: GameLine;
};
/** Match only zero, one, or two legal plies from an explicitly chosen anchor. */
export function matchContinuation(
  anchor: string,
  scores: Record<string, number>[],
  maxPlies = 2,
  history?: GameLine,
): TemporalMatch | null {
  if (
    scores.length !== 64 ||
    !Number.isInteger(maxPlies) ||
    maxPlies < 0 ||
    maxPlies > 2
  )
    return null;
  let board: Chess;
  try {
    validateAnalysisPosition(anchor);
    board = history ? replayLine(history) : new Chess(anchor);
    if (board.fen() !== new Chess(anchor).fen()) return null;
    if (history) statusOfLine(history);
  } catch {
    return null;
  }
  const local = scores.map((row) => Object.values(row).sort((a, b) => a - b));
  if (
    local.some(
      (row) => row.length < 2 || row.some((n) => !Number.isFinite(n) || n < 0),
    )
  )
    return null;
  // Legal history cannot manufacture evidence from a flat or empty classifier.
  if (local.filter((row) => row[1] - row[0] >= 0.015).length < 48) return null;
  const bestLocal = local.map((row) => row[0]);
  const ranked = new Map<
    string,
    { cost: number; fen: string; moves: string[]; uci: string[] }
  >();
  let compared = 0,
    truncated = false;
  const keyOf = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
  const oldMoves = board.history({ verbose: true });
  const oldPositions = oldMoves.length
    ? [oldMoves[0].before, ...oldMoves.map((move) => move.after)]
    : [board.fen()];
  const counts = new Map<string, number>();
  for (const fen of oldPositions)
    counts.set(keyOf(fen), (counts.get(keyOf(fen)) || 0) + 1);
  const walk = (moves: string[], uci: string[]) => {
    if (compared >= 1600) {
      truncated = true;
      return;
    }
    compared++;
    const pieces = placementOf(board);
    const costs = pieces.map((piece, i) => scores[i][piece] ?? Infinity);
    // History cannot force a visibly incompatible board.
    if (
      costs.every(
        (cost, i) => Number.isFinite(cost) && cost - bestLocal[i] <= 0.08,
      ) &&
      costs.reduce((a, b) => a + b, 0) / 64 < 0.12
    ) {
      const key = pieces.join(""),
        cost = costs.reduce((a, b) => a + b, 0);
      const prior = ranked.get(key);
      if (!prior || prior.cost > cost)
        ranked.set(key, { cost, fen: board.fen(), moves, uci });
    }
    if (
      moves.length >= maxPlies ||
      history?.claim ||
      board.isInsufficientMaterial() ||
      Number(board.fen().split(" ")[4]) >= 150 ||
      (counts.get(keyOf(board.fen())) || 0) >= 5
    )
      return;
    for (const move of board.moves({ verbose: true })) {
      if (compared >= 1600) {
        truncated = true;
        break;
      }
      board.move(move);
      const key = keyOf(board.fen());
      counts.set(key, (counts.get(key) || 0) + 1);
      walk([...moves, move.san], [...uci, uciOf(move)]);
      counts.set(key, counts.get(key)! - 1);
      board.undo();
    }
  };
  walk([], []);
  if (truncated) return null;
  const options = [...ranked.values()].sort((a, b) => a.cost - b.cost);
  if (!options.length) return null;
  const gap = options[1] ? options[1].cost - options[0].cost : 1;
  if (gap < 0.08) return null;
  return {
    fen: options[0].fen,
    moves: options[0].moves,
    compared,
    gap,
    anchor,
    line: {
      rootFen: history?.rootFen || anchor,
      moves: [...(history?.moves || []), ...options[0].uci],
      ...(history?.claim ? { claim: history.claim } : {}),
    },
  };
}

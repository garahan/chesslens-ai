import { Chess, type Move } from "chess.js";
import { validateAnalysisPosition } from "./position.ts";
export type ClaimReason = "threefold repetition" | "50-move rule";
export type GameLine = {
  rootFen: string;
  moves: string[];
  claim?: { ply: number; reason: ClaimReason; intended?: string };
};
export type RuleStatus = {
  terminal: boolean;
  message: string;
  reason: string;
  claims: ClaimReason[];
  repetitions: number;
};
export const GAME_KEY = "chesslens-line-v1";
export const uciOf = (move: Pick<Move, "from" | "to" | "promotion">) =>
  `${move.from}${move.to}${move.promotion || ""}`;
export function playUci(board: Chess, uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))
    throw Error("Invalid move notation");
  return board.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  });
}
/** Replay moves rather than reloading only the last FEN, preserving all repetition and special-move state. */
export function replayLine(line: GameLine, ply = line.moves.length) {
  if (typeof line?.rootFen !== "string" || !Array.isArray(line.moves))
    throw Error("Invalid game history");
  if (
    line.claim &&
    (line.claim.ply !== line.moves.length ||
      !["threefold repetition", "50-move rule"].includes(line.claim.reason))
  )
    throw Error("Invalid saved draw claim");
  if (
    !Number.isInteger(ply) ||
    ply < 0 ||
    ply > line.moves.length ||
    line.moves.length > 20000
  )
    throw Error("Invalid game history length");
  validateAnalysisPosition(line.rootFen);
  const board = new Chess(line.rootFen);
  const seen = new Map<string, number>();
  const key = () => board.fen().split(" ").slice(0, 4).join(" ");
  seen.set(key(), 1);
  for (const move of line.moves.slice(0, ply)) {
    if (
      board.isCheckmate() ||
      board.isStalemate() ||
      board.isInsufficientMaterial() ||
      Number(board.fen().split(" ")[4]) >= 150 ||
      (seen.get(key()) ?? 0) >= 5
    )
      throw Error("Game history continues after an automatic game ending");
    playUci(board, move);
    seen.set(key(), (seen.get(key()) ?? 0) + 1);
  }
  return board;
}
const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
export function repetitionCount(board: Chess) {
  // chess.js hashes raw EP availability; FIDE equality depends on legal EP availability.
  const history = board.history({ verbose: true }),
    key = positionKey(board.fen());
  const positions = history.length
    ? [history[0].before, ...history.map((move) => move.after)]
    : [board.fen()];
  return positions.filter((fen) => positionKey(fen) === key).length;
}
export function claimReasons(board: Chess): ClaimReason[] {
  const result: ClaimReason[] = [];
  if (Number(board.fen().split(" ")[4]) >= 100) result.push("50-move rule");
  if (repetitionCount(board) >= 3) result.push("threefold repetition");
  return result;
}
export function ruleStatus(board: Chess): RuleStatus {
  const repetitions = repetitionCount(board),
    halfmoves = Number(board.fen().split(" ")[4]);
  const claims: ClaimReason[] = [];
  const result = (
    terminal: boolean,
    reason: string,
    message: string,
  ): RuleStatus => ({
    terminal,
    reason,
    message,
    claims: terminal ? [] : claims,
    repetitions,
  });
  if (board.isCheckmate())
    return result(
      true,
      "checkmate",
      `Checkmate · ${board.turn() === "w" ? "Black" : "White"} wins`,
    );
  if (board.isStalemate()) return result(true, "stalemate", "Draw · stalemate");
  if (board.isInsufficientMaterial())
    return result(
      true,
      "insufficient-material",
      "Draw · insufficient mating material",
    );
  if (halfmoves >= 150)
    return result(true, "75-move", "Draw · automatic 75-move rule");
  if (repetitions >= 5)
    return result(true, "fivefold", "Draw · automatic fivefold repetition");
  if (halfmoves >= 100) claims.push("50-move rule");
  if (repetitions >= 3) claims.push("threefold repetition");
  return result(
    false,
    board.isCheck() ? "check" : "playing",
    `${board.isCheck() ? "Check · " : ""}${board.turn() === "w" ? "White" : "Black"} to move${claims.length ? " · draw claim available" : ""}`,
  );
}
export function statusOfLine(line: GameLine, ply = line.moves.length) {
  const board = replayLine(line, ply),
    status = ruleStatus(board);
  if (line.claim?.ply === ply) {
    if (status.terminal)
      throw Error("Draw claim was recorded after the game had already ended");
    const target = line.claim.intended ? replayLine(line, ply) : board;
    if (line.claim.intended) playUci(target, line.claim.intended);
    if (!claimReasons(target).includes(line.claim.reason))
      throw Error("Invalid saved draw claim");
    return {
      ...status,
      terminal: true,
      reason: "claimed-draw",
      claims: [],
      message: `Draw claimed · ${line.claim.reason}`,
    } as RuleStatus;
  }
  return status;
}
export function upcomingClaims(line: GameLine, ply: number) {
  const board = replayLine(line, ply);
  if (statusOfLine(line, ply).terminal) return [];
  const result: { uci: string; san: string; reason: ClaimReason }[] = [];
  for (const move of board.moves({ verbose: true })) {
    board.move(move);
    for (const reason of claimReasons(board))
      result.push({ uci: uciOf(move), san: move.san, reason });
    board.undo();
  }
  return result;
}
export function claimDraw(
  line: GameLine,
  ply: number,
  reason: ClaimReason,
  intended?: string,
): GameLine {
  if (statusOfLine(line, ply).terminal)
    throw Error("The game has already ended");
  const board = replayLine(line, ply);
  if (intended) playUci(board, intended);
  if (!claimReasons(board).includes(reason))
    throw Error("No valid draw claim for this position");
  return {
    rootFen: line.rootFen,
    moves: line.moves.slice(0, ply),
    claim: { ply, reason, ...(intended ? { intended } : {}) },
  };
}
export function saveGame(line: GameLine, ply: number) {
  try {
    localStorage.setItem(
      GAME_KEY,
      JSON.stringify({
        version: 1,
        line: {
          ...line,
          moves: line.moves.slice(0, ply),
          ...(line.claim?.ply === ply
            ? { claim: line.claim }
            : { claim: undefined }),
        },
      }),
    );
  } catch {}
}
export function savedGame(): GameLine | null {
  try {
    const value = JSON.parse(localStorage.getItem(GAME_KEY) || "null");
    if (
      value?.version !== 1 ||
      typeof value.line?.rootFen !== "string" ||
      !Array.isArray(value.line.moves)
    )
      return null;
    replayLine(value.line);
    statusOfLine(value.line);
    return value.line;
  } catch {
    return null;
  }
}

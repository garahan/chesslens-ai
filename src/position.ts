import { Chess } from "chess.js";
/** Necessary scanner constraints; these do not prove full historical reachability. */
export function validatePlacement(
  squares: string[],
  turn: "w" | "b",
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (squares.length !== 64) {
    errors.push("Board must have 64 squares");
    return { errors, warnings };
  }
  const count = (piece: string) => squares.filter((p) => p === piece).length;
  for (const [name, king] of [
    ["White", "K"],
    ["Black", "k"],
  ] as const) {
    if (count(king) !== 1) errors.push(`${name} must have exactly one king`);
  }
  for (const [name, pawn] of [
    ["White", "P"],
    ["Black", "p"],
  ] as const) {
    if (count(pawn) > 8) errors.push(`${name} has more than eight pawns`);
  }
  if (
    squares.slice(0, 8).some((p) => p === "p" || p === "P") ||
    squares.slice(56, 64).some((p) => p === "p" || p === "P")
  )
    errors.push("Pawns cannot occupy the first or eighth rank");
  if (squares.filter((p) => p !== "." && p === p.toUpperCase()).length > 16)
    errors.push("White has more than sixteen pieces");
  if (squares.filter((p) => p !== "." && p === p.toLowerCase()).length > 16)
    errors.push("Black has more than sixteen pieces");
  const wk = squares.indexOf("K"),
    bk = squares.indexOf("k");
  if (
    wk >= 0 &&
    bk >= 0 &&
    Math.max(
      Math.abs(Math.floor(wk / 8) - Math.floor(bk / 8)),
      Math.abs((wk % 8) - (bk % 8)),
    ) <= 1
  )
    errors.push("Kings cannot stand on adjacent squares");
  if (turn !== "w" && turn !== "b") errors.push("Choose a side to move");
  if (squares.every((p) => p === "." || p === "K" || p === "k"))
    warnings.push("Only kings detected; verify the screenshot is correct");
  for (const error of materialErrors(squares)) {
    if (!errors.includes(error)) errors.push(error);
  }
  return { errors, warnings };
}

/** Necessary material constraints, including promotion budgets and bishop colors. */
export function materialErrors(
  squares: string[],
  requireKings = true,
  noCaptures = false,
): string[] {
  const errors: string[] = [];
  if (
    squares.length !== 64 ||
    squares.some((piece) => !/^[.prnbqkPRNBQK]$/.test(piece))
  )
    return ["Invalid board symbols"];
  for (const color of ["w", "b"]) {
    const piece = (type: string) => (color === "w" ? type.toUpperCase() : type);
    const count = (type: string) =>
      squares.filter((p) => p === piece(type)).length;
    const name = color === "w" ? "White" : "Black",
      pawns = count("p"),
      kings = count("k");
    if (kings > 1 || (requireKings && kings !== 1))
      errors.push(`${name} must have exactly one king`);
    if (pawns > 8) errors.push(`${name} has more than eight pawns`);
    const total = squares.filter(
      (p) =>
        p !== "." &&
        (color === "w" ? p === p.toUpperCase() : p === p.toLowerCase()),
    ).length;
    if (total > 16) errors.push(`${name} has more than sixteen pieces`);
    const bishops = [0, 0];
    squares.forEach((p, index) => {
      if (p === piece("b"))
        bishops[(Math.floor(index / 8) + (index % 8)) % 2]++;
    });
    const minimumPromotions =
      Math.max(0, count("q") - 1) +
      Math.max(0, count("r") - 2) +
      Math.max(0, count("n") - 2) +
      bishops.reduce((sum, n) => sum + Math.max(0, n - 1), 0);
    if (
      (noCaptures || squares.filter((p) => p !== ".").length === 32) &&
      minimumPromotions > 0
    )
      errors.push(
        `${name} requires promotions although no pieces have been captured`,
      );
    if (minimumPromotions > 8 - pawns)
      errors.push(
        `${name} has too many promoted pieces for the remaining pawns`,
      );
  }
  if (
    [...squares.slice(0, 8), ...squares.slice(56)].some(
      (p) => p.toLowerCase() === "p",
    )
  )
    errors.push("Pawns cannot occupy the first or eighth rank");
  const white = squares.indexOf("K"),
    black = squares.indexOf("k");
  if (
    white >= 0 &&
    black >= 0 &&
    Math.max(
      Math.abs(Math.floor(white / 8) - Math.floor(black / 8)),
      Math.abs((white % 8) - (black % 8)),
    ) <= 1
  )
    errors.push("Kings cannot stand on adjacent squares");
  return errors;
}
export function validateAnalysisPosition(fen: string): void {
  const board = new Chess(fen);
  const squares = board
    .board()
    .flat()
    .map((p) => (p ? (p.color === "w" ? p.type.toUpperCase() : p.type) : "."));
  const errors = materialErrors(squares);
  if (errors.length) throw new Error(errors.join("; "));
  const parts = board.fen().split(" ");
  parts[1] = board.turn() === "w" ? "b" : "w";
  parts[3] = "-";
  if (new Chess(parts.join(" ")).isCheck())
    throw new Error(
      "The side that just moved is still in check. Check the pieces or change whose turn it is.",
    );
}

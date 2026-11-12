import { Chess, validateFen, type Square } from "chess.js";
/** Minimum promoted material, including bishops that share a square color. */
export function promotionRequirements(squares: string[]) {
  return (["w", "b"] as const).map((color) => {
    let minimum = 0;
    const indices: number[] = [];
    const matching = (type: string) =>
      squares.flatMap((piece, i) =>
        piece === (color === "w" ? type.toUpperCase() : type) ? [i] : [],
      );
    for (const [type, original] of [
      ["q", 1],
      ["r", 2],
      ["n", 2],
    ] as const) {
      const found = matching(type);
      if (found.length > original) {
        minimum += found.length - original;
        indices.push(...found);
      }
    }
    const bishops = matching("b");
    for (const parity of [0, 1]) {
      const group = bishops.filter(
        (i) => (Math.floor(i / 8) + (i % 8)) % 2 === parity,
      );
      if (group.length > 1) {
        minimum += group.length - 1;
        indices.push(...group);
      }
    }
    return { color, minimum, indices };
  });
}
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
  const promotions = promotionRequirements(squares);
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
    const minimumPromotions = promotions.find(
      (row) => row.color === color,
    )!.minimum;
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
/** Necessary pawn-file reachability, using distinct original pawn files and a capture budget. */
export function pawnReachabilityErrors(squares: string[]): string[] {
  const errors: string[] = [];
  for (const color of ["w", "b"] as const) {
    const pawns = squares.flatMap((p, i) =>
      p === (color === "w" ? "P" : "p") ? [i] : [],
    );
    if (pawns.length > 8) continue;
    let costs = new Map<number, number>([[0, 0]]);
    for (const index of pawns) {
      const rank = 8 - Math.floor(index / 8),
        file = index % 8,
        advances = color === "w" ? rank - 2 : 7 - rank;
      const next = new Map<number, number>();
      for (const [used, cost] of costs)
        for (let origin = 0; origin < 8; origin++) {
          const captures = Math.abs(file - origin);
          if (used & (1 << origin) || captures > advances) continue;
          const key = used | (1 << origin);
          next.set(key, Math.min(next.get(key) ?? Infinity, cost + captures));
        }
      costs = next;
    }
    const required = Math.min(...costs.values());
    const opponentPieces = squares.filter(
      (p) =>
        p !== "." &&
        (color === "w" ? p === p.toLowerCase() : p === p.toUpperCase()),
    ).length;
    if (!Number.isFinite(required) || required > 16 - opponentPieces)
      errors.push(
        `${color === "w" ? "White" : "Black"} pawns require more captures than the missing opposing material allows`,
      );
  }
  return errors;
}
/** Validate raw state before chess.js can normalize away malformed special-move fields. */
export function validateAnalysisPosition(fen: string): void {
  const fields = fen.trim().split(/\s+/);
  const basic = validateFen(fields.join(" "));
  if (!basic.ok) throw Error(basic.error || "Invalid FEN");
  if (
    !/^[0-9]+$/.test(fields[4]) ||
    !/^[0-9]+$/.test(fields[5]) ||
    !Number.isSafeInteger(Number(fields[4])) ||
    !Number.isSafeInteger(Number(fields[5]))
  )
    throw Error("Invalid FEN: move counters must be whole safe integers");
  if (
    !/^(?:-|[KQkq]+)$/.test(fields[2]) ||
    (fields[2] !== "-" && new Set(fields[2]).size !== fields[2].length)
  )
    throw Error("Invalid FEN: duplicate or mixed castling rights");
  const board = new Chess(fields.join(" "));
  const squares = board
    .board()
    .flat()
    .map((p) => (p ? (p.color === "w" ? p.type.toUpperCase() : p.type) : "."));
  const errors = [
    ...materialErrors(squares),
    ...pawnReachabilityErrors(squares),
  ];
  if (errors.length) throw Error(errors.join("; "));
  for (const [right, king, rook, color] of [
    ["K", "e1", "h1", "w"],
    ["Q", "e1", "a1", "w"],
    ["k", "e8", "h8", "b"],
    ["q", "e8", "a8", "b"],
  ] as const) {
    if (!fields[2].includes(right)) continue;
    if (
      board.get(king)?.type !== "k" ||
      board.get(king)?.color !== color ||
      board.get(rook)?.type !== "r" ||
      board.get(rook)?.color !== color
    )
      throw Error(
        `Castling right ${right} requires the ${color === "w" ? "white" : "black"} king and rook on their original squares`,
      );
  }
  const previous = board.turn() === "w" ? "b" : "w";
  const previousKing = board.findPiece({ type: "k", color: previous })[0];
  if (board.isAttacked(previousKing, board.turn()))
    throw Error(
      "The side that just moved is still in check. Check the pieces or change whose turn it is.",
    );
  const king = board.findPiece({ type: "k", color: board.turn() })[0],
    checkers = board.attackers(king, previous);
  if (
    checkers.length > 2 ||
    checkers.filter((square) => ["p", "n"].includes(board.get(square)!.type))
      .length > 1
  )
    throw Error("The king has an impossible combination of checking pieces");
  if (fields[3] !== "-") {
    const file = fields[3][0],
      whiteTurn = board.turn() === "w";
    const pawnSquare = `${file}${whiteTurn ? "5" : "4"}` as Square;
    const origin = `${file}${whiteTurn ? "7" : "2"}` as Square;
    const target = fields[3] as Square;
    if (
      board.get(target) ||
      board.get(origin) ||
      board.get(pawnSquare)?.type !== "p" ||
      board.get(pawnSquare)?.color !== previous ||
      Number(fields[4]) !== 0
    )
      throw Error(
        "En passant requires an empty target, the opposing pawn after a double advance, its empty starting square, and a zero halfmove clock",
      );
    // Reconstruct the immediate predecessor: the stated double pawn advance must be legal.
    const predecessor = new Chess(board.fen());
    predecessor.remove(pawnSquare);
    predecessor.put({ type: "p", color: previous }, origin);
    const before = predecessor.fen().split(" ");
    before[1] = previous;
    before[3] = "-";
    before[4] = "0";
    const last = new Chess(before.join(" "));
    if (last.isAttacked(king, previous))
      throw Error("En passant metadata leaves the earlier mover in check");
    try {
      last.move({ from: origin, to: pawnSquare });
    } catch {
      throw Error(
        "En passant metadata does not follow a legal double pawn advance",
      );
    }
  }
}

import { materialErrors, promotionRequirements } from "./position.ts";
export type TileScores = { scores: Record<string, number>; piece: string };
// A weak material prior, in the same units as a single tile's visual distance.
// Clear promoted pieces stay possible; close ordinary alternatives win over
// explanations requiring an unseen promotion. This is not a hard piece cap.
const promotionCost = (squares: string[]) =>
  promotionRequirements(squares).reduce(
    (sum, row) => sum + row.minimum * 0.055,
    0,
  );
/** Bounded search over visually close labels; constraints never create a missing piece. */
export function inferDuolingoPosition(
  tiles: TileScores[],
  beamWidth = 128,
): {
  squares: string[];
  adjusted: number[];
  cost: number;
  visualCost: number;
  promotionReview: number[];
} | null {
  if (tiles.length !== 64) throw new Error("Expected 64 tile scores");
  const choices = tiles.map((tile, index) => {
    const ranked = Object.entries(tile.scores)
      .filter(
        ([piece, score]) =>
          /^[.prnbqkPRNBQK]$/.test(piece) && Number.isFinite(score),
      )
      .sort((a, b) => a[1] - b[1]);
    if (!ranked.length) return [];
    const [best, score] = ranked[0],
      margin = (ranked[1]?.[1] ?? 1) - score;
    // Confident empty squares must stay empty; no king can be manufactured there.
    if (best === "." && score < 0.04) return [{ piece: best, cost: score }];
    const top = ranked.filter(
      ([piece, cost]) =>
        cost <= score + 0.04 &&
        cost < 0.22 &&
        (piece === "." ||
          (index >= 8 && index < 56) ||
          piece.toLowerCase() !== "p") &&
        (piece === "." ||
          best === "." ||
          (piece === piece.toUpperCase()) === (best === best.toUpperCase())),
    );
    if (score < 0.025 && margin > 0.025) return [{ piece: best, cost: score }];
    return top.slice(0, 6).map(([piece, cost]) => ({ piece, cost }));
  });
  if (choices.some((options) => options.length === 0)) return null;
  const noCaptures =
    choices.filter((options) => options.every((option) => option.piece !== "."))
      .length === 32;
  let squares = Array<string>(64).fill("."),
    cost = 0;
  const variable: number[] = [];
  choices.forEach((options, index) => {
    if (options.length === 1) {
      squares[index] = options[0].piece;
      cost += options[0].cost;
    } else variable.push(index);
  });
  if (materialErrors(squares, false, noCaptures).length) return null;
  variable.sort(
    (a, b) =>
      choices[a].length - choices[b].length ||
      choices[b][1].cost -
        choices[b][0].cost -
        (choices[a][1].cost - choices[a][0].cost),
  );
  let beam = [
    { squares, visualCost: cost, cost: cost + promotionCost(squares) },
  ];
  for (let offset = 0; offset < variable.length; offset++) {
    const index = variable[offset],
      remaining = variable.slice(offset + 1);
    const canStillWhite = remaining.some((i) =>
        choices[i].some((c) => c.piece === "K"),
      ),
      canStillBlack = remaining.some((i) =>
        choices[i].some((c) => c.piece === "k"),
      );
    const next: typeof beam = [];
    for (const state of beam)
      for (const choice of choices[index]) {
        const proposed = state.squares.slice();
        proposed[index] = choice.piece;
        if (materialErrors(proposed, false, noCaptures).length) continue;
        if (
          (!canStillWhite && !proposed.includes("K")) ||
          (!canStillBlack && !proposed.includes("k"))
        )
          continue;
        const visualCost = state.visualCost + choice.cost;
        next.push({
          squares: proposed,
          visualCost,
          cost: visualCost + promotionCost(proposed),
        });
      }
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, beamWidth);
    if (!beam.length) return null;
  }
  const best = beam.find(
    (state) => materialErrors(state.squares, true).length === 0,
  );
  if (!best) return null;
  return {
    ...best,
    promotionReview: [
      ...new Set(
        promotionRequirements(best.squares).flatMap((row) => row.indices),
      ),
    ].filter((index) => {
      const piece = best.squares[index],
        value = tiles[index].scores[piece];
      const alternative = Math.min(
        ...Object.entries(tiles[index].scores)
          .filter(
            ([other]) =>
              other !== piece &&
              other !== "." &&
              (other === other.toUpperCase()) ===
                (piece === piece.toUpperCase()),
          )
          .map(([, score]) => score),
      );
      return value > 0.05 || alternative - value < 0.025;
    }),
    adjusted: best.squares.flatMap((piece, index) =>
      piece !== tiles[index].piece ? [index] : [],
    ),
  };
}

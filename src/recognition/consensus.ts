import { normalizedDistance } from "./structure.ts";
export type FrameTile = {
  piece: string;
  scores: Record<string, number>;
  mask: Float32Array;
  color: number[];
  uncertain: boolean;
};
const rank = (scores: Record<string, number>) =>
  Object.entries(scores).sort((a, b) => a[1] - b[1]);
/** Frozen clear seeds only: no cascading votes, counts, row assumptions, or cross-frame learning. */
export function frameConsensus(tiles: FrameTile[]) {
  const seeds = tiles.flatMap((tile, index) => {
    const ranked = rank(tile.scores),
      gap = ranked[1][1] - ranked[0][1];
    return tile.mask.reduce((a, b) => a + b, 0) / tile.mask.length > 0.025 &&
      tile.piece !== "." &&
      !tile.uncertain &&
      ranked[0][1] < 0.07 &&
      gap > 0.035
      ? [{ index, tile, gap }]
      : [];
  });
  const changes: {
    index: number;
    piece: string;
    seeds: number[];
    distance: number;
  }[] = [];
  const output = tiles.map((tile, index) => {
    const ranked = rank(tile.scores);
    if (
      tile.piece === "." ||
      (!tile.uncertain &&
        ranked[1][1] - ranked[0][1] > 0.025 &&
        ranked[0][1] < 0.07)
    )
      return { ...tile.scores };
    const groups = new Map<
      string,
      { index: number; distance: number; gap: number }[]
    >();
    for (const seed of seeds) {
      if (
        (seed.tile.piece === seed.tile.piece.toUpperCase()) !==
          (tile.piece === tile.piece.toUpperCase()) ||
        seed.index === index ||
        Math.hypot(...tile.color.map((v, i) => v - seed.tile.color[i])) > 30
      )
        continue;
      const distance = normalizedDistance(tile.mask, 12, seed.tile.mask, 12);
      if (distance > 0.14) continue;
      const group = groups.get(seed.tile.piece) ?? [];
      group.push({ index: seed.index, distance, gap: seed.gap });
      groups.set(seed.tile.piece, group);
    }
    const supported = [...groups.entries()]
      .filter(
        ([, group]) =>
          group.length >= 2 ||
          (group[0].gap > 0.07 && group[0].distance < 0.04),
      )
      .map(([piece, group]) => ({
        piece,
        seeds: group.map((g) => g.index),
        distance: Math.max(...group.map((g) => g.distance)),
      }))
      .sort((a, b) => a.distance - b.distance);
    const winner = supported[0],
      adjusted = { ...tile.scores };
    if (
      winner &&
      (!supported[1] || supported[1].distance - winner.distance > 0.06) &&
      adjusted[winner.piece] <= ranked[0][1] + 0.03
    ) {
      adjusted[winner.piece] = Math.max(
        0,
        adjusted[winner.piece] - 0.014 * (1 - winner.distance / 0.2),
      );
      changes.push({ index, ...winner });
    }
    return adjusted;
  });
  return { scores: output, changes, seeds: seeds.length };
}

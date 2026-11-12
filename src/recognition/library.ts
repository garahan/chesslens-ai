import atlas from "./piece-library.json" with { type: "json" };
import { shapeDistance, type PieceSample } from "./features.ts";
import type { LearnedSample } from "./learning.ts";
export function refineWithLibrary(
  scores: Record<string, number>,
  sample: PieceSample,
  learned: LearnedSample[] = [],
) {
  const adjusted = { ...scores };
  const evidence: Record<string, { distance: number; personal: boolean }> = {};
  for (const reference of [...atlas.samples, ...learned]) {
    const personal = "style" in reference;
    if (personal && reference.style !== sample.style) continue;
    const chroma =
      Math.hypot(...reference.color.map((n, i) => n - sample.color[i])) / 441;
    const distance = shapeDistance(reference.mask, sample.mask) + chroma * 0.1;
    if (
      !evidence[reference.piece] ||
      distance < evidence[reference.piece].distance
    )
      evidence[reference.piece] = { distance, personal };
  }
  const ordered = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const nativeLabels = new Set(
    atlas.samples.map((reference) => reference.piece),
  );
  const incompleteCompetition = ordered.some(
    ([piece, cost]) => cost <= ordered[0][1] + 0.03 && !nativeLabels.has(piece),
  );
  // The atlas is incomplete: bounded adjustments, never a replacement for missing classes.
  for (const [piece, e] of Object.entries(evidence)) {
    if (adjusted[piece] === undefined) continue;
    // Missing queen/bishop references cannot vote against themselves. Do not let
    // an incomplete atlas tilt a close rook/queen contest toward the covered class.
    if (!e.personal && incompleteCompetition) continue;
    const strength = e.personal ? 0.028 : 0.012;
    if (e.distance < 0.3)
      adjusted[piece] = Math.max(
        0,
        adjusted[piece] - strength * (1 - e.distance / 0.3),
      );
  }
  const ranked = Object.entries(adjusted).sort((a, b) => a[1] - b[1]);
  return {
    scores: adjusted,
    piece: ranked[0][0],
    margin: ranked[1][1] - ranked[0][1],
    personalUsed:
      ranked[0][0] !== ordered[0][0] &&
      evidence[ranked[0][0]]?.personal === true,
    evidence,
  };
}
export const libraryCoverage = {
  nativeLabels: [...new Set(atlas.samples.map((s) => s.piece))],
  missingNativeLabels: atlas.missingNativeLabels,
};

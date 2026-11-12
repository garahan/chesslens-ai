import atlas from "./piece-library.json" with { type: "json" };
import { shapeDistance, type PieceSample } from "./features.ts";
export type Reconstruction = {
  references: (string | null)[];
  residuals: (number | null)[];
  checked: number;
  mean: number | null;
  outliers: number[];
};
/** Never certify a square by rendering that same square as its own reference. */
export function reconstructPosition(
  samples: PieceSample[],
  pieces: string[],
  clear: boolean[],
): Reconstruction {
  const references: (string | null)[] = [],
    residuals: (number | null)[] = [];
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index];
    const candidates: string[] =
      piece === "."
        ? ["0".repeat(2304)]
        : atlas.samples.filter((s) => s.piece === piece).map((s) => s.mask);
    samples.forEach((sample, other) => {
      if (
        piece !== "." &&
        other !== index &&
        pieces[other] === piece &&
        clear[other]
      )
        candidates.push(sample.mask);
    });
    const matches = candidates
      .map((mask) => ({
        mask,
        // IoU against an empty reference is 1 even for a single JPEG speck.
        // Empty squares use unexplained ink area; 5% of a square is significant.
        error:
          piece === "."
            ? Math.min(
                1,
                Array.from(
                  samples[index].mask,
                  (ch) => parseInt(ch, 16) / 15,
                ).reduce((a, b) => a + b, 0) /
                  2304 /
                  0.1,
              )
            : shapeDistance(samples[index].mask, mask),
      }))
      .sort((a, b) => a.error - b.error);
    references.push(matches[0]?.mask ?? null);
    residuals.push(matches[0]?.error ?? null);
  }
  const measured = residuals.filter((n): n is number => n !== null);
  return {
    references,
    residuals,
    checked: measured.length,
    mean: measured.length
      ? measured.reduce((a, b) => a + b, 0) / measured.length
      : null,
    outliers: residuals.flatMap((n, index) =>
      n !== null && n > 0.5 ? [index] : [],
    ),
  };
}
/** Actual reconstructed raster. Unknown piece classes are visibly hatched rather than invented. */
export function renderReconstruction(
  reconstruction: Reconstruction,
  pieces: string[],
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 384;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const pixels = ctx.createImageData(384, 384);
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const index = row * 8 + col,
        mask = reconstruction.references[index],
        piece = pieces[index];
      const bg = (row + col) % 2 ? [21, 30, 35] : [38, 52, 58];
      const fg =
        piece !== "." && piece === piece.toUpperCase()
          ? [200, 215, 225]
          : [80, 107, 119];
      for (let y = 0; y < 48; y++)
        for (let x = 0; x < 48; x++) {
          const alpha = mask
            ? parseInt(mask[y * 48 + x], 16) / 15
            : (x + y) % 12 < 2
              ? 0.25
              : 0;
          const offset = ((row * 48 + y) * 384 + col * 48 + x) * 4;
          for (let c = 0; c < 3; c++)
            pixels.data[offset + c] = Math.round(
              bg[c] * (1 - alpha) + (mask ? fg[c] : 240) * alpha,
            );
          pixels.data[offset + 3] = 255;
        }
    }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

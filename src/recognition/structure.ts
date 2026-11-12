import { duolingoSignatures } from "../duolingo-signatures.ts";
export type Anatomy = {
  roundHead: number;
  diagonalSlit: number;
  asymmetry: number;
  crownPeaks: number;
  crossbar: number;
  aspect: number;
  fill: number;
};
/** Normalize position AND scale, preserving aspect ratio and leaving a one-pixel margin. */
export function normalizeFigure(
  mask: ArrayLike<number>,
  size: number,
  output = 16,
) {
  let left = size,
    right = -1,
    top = size,
    bottom = -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (mask[y * size + x] > 0.25) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const image = new Float32Array(output * output);
  if (right < left) return { image, aspect: 0, mass: 0 };
  const width = right - left + 1,
    height = bottom - top + 1;
  const scale = (output - 2) / Math.max(width, height),
    ox = (output - width * scale) / 2,
    oy = (output - height * scale) / 2;
  let mass = 0;
  for (let y = 0; y < output; y++)
    for (let x = 0; x < output; x++) {
      const xx = (x + 0.5 - ox) / scale + left - 0.5,
        yy = (y + 0.5 - oy) / scale + top - 0.5;
      if (
        xx < left - 0.5 ||
        xx > right + 0.5 ||
        yy < top - 0.5 ||
        yy > bottom + 0.5
      )
        continue;
      const x0 = Math.floor(xx),
        y0 = Math.floor(yy),
        dx = xx - x0,
        dy = yy - y0;
      const at = (a: number, b: number) =>
        a >= 0 && b >= 0 && a < size && b < size ? mask[b * size + a] : 0;
      const value =
        at(x0, y0) * (1 - dx) * (1 - dy) +
        at(x0 + 1, y0) * dx * (1 - dy) +
        at(x0, y0 + 1) * (1 - dx) * dy +
        at(x0 + 1, y0 + 1) * dx * dy;
      image[y * output + x] = value;
      mass += value;
    }
  return { image, aspect: width / height, mass: mass / image.length };
}
export function anatomyOf(mask: ArrayLike<number>, size: number): Anatomy {
  const { image: m, aspect, mass } = normalizeFigure(mask, size);
  const widths = Array.from(
    { length: 16 },
    (_, y) =>
      Array.from({ length: 16 }, (_, x) => m[y * 16 + x]).reduce(
        (a, b) => a + b,
        0,
      ) / 16,
  );
  let asymmetry = 0,
    diagonal = 0,
    horizontal = 0,
    upperMass = 0,
    radial = 0;
  for (let y = 1; y < 9; y++)
    for (let x = 1; x < 15; x++) {
      const v = m[y * 16 + x];
      asymmetry += Math.abs(v - m[y * 16 + 15 - x]);
      diagonal += Math.abs(m[(y + 1) * 16 + x + 1] - m[(y - 1) * 16 + x - 1]);
      horizontal += Math.abs(m[y * 16 + x + 1] - m[y * 16 + x - 1]);
      upperMass += v;
      radial += v * ((x - 7.5) ** 2 + (y - 4) ** 2);
    }
  const tops = Array.from({ length: 16 }, (_, x) => {
    for (let y = 1; y < 10; y++) if (m[y * 16 + x] > 0.5) return y;
    return 10;
  });
  const peaks = tops
    .slice(2, 14)
    .filter((y, i) => y < 9 && y <= tops[i + 1] && y < tops[i + 3]).length;
  return {
    roundHead: upperMass ? Math.max(0, 1 - radial / upperMass / 45) : 0,
    diagonalSlit: diagonal / Math.max(1, diagonal + horizontal),
    asymmetry: asymmetry / 112,
    crownPeaks: Math.min(1, peaks / 5),
    crossbar: Math.max(0, Math.max(...widths.slice(2, 6)) - widths[1]),
    aspect: Math.min(1, aspect / 1.5),
    fill: mass,
  };
}
export function normalizedDistance(
  a: ArrayLike<number>,
  aSize: number,
  b: ArrayLike<number>,
  bSize: number,
) {
  const x = normalizeFigure(a, aSize),
    y = normalizeFigure(b, bSize);
  let difference = 0,
    mass = 0;
  for (let i = 0; i < x.image.length; i++) {
    difference += Math.abs(x.image[i] - y.image[i]);
    mass += Math.max(x.image[i], y.image[i]);
  }
  return mass
    ? difference / mass + Math.min(0.2, Math.abs(x.aspect - y.aspect) * 0.12)
    : 0;
}
const references = duolingoSignatures
  .trim()
  .split("\n")
  .map((row) => {
    const [label, raw, rgb] = row.split("|"),
      mask = Float32Array.from(raw, (ch) => Number(ch) / 9);
    return {
      piece: label === "-" ? "." : label,
      mask,
      anatomy: anatomyOf(mask, 12),
      color: rgb.split(",").map(Number),
    };
  });
/** Specialist evidence uses this piece set's own anatomy, not assumptions about a different artwork set. */
export function refineStructure(
  scores: Record<string, number>,
  mask: Float32Array,
  size: number,
  color: number[],
) {
  const descriptor = anatomyOf(mask, size),
    evidence: Record<string, number> = {};
  for (const reference of references) {
    if (reference.piece === ".") continue;
    const anatomy =
      Object.keys(descriptor).reduce(
        (sum, key) =>
          sum +
          Math.abs(
            descriptor[key as keyof Anatomy] -
              reference.anatomy[key as keyof Anatomy],
          ),
        0,
      ) / 7;
    const chroma =
      Math.hypot(...color.map((v, i) => v - reference.color[i])) / 441;
    const cost =
      normalizedDistance(mask, size, reference.mask, 12) * 0.7 +
      anatomy * 0.3 +
      chroma * 0.3;
    evidence[reference.piece] = Math.min(
      evidence[reference.piece] ?? Infinity,
      cost,
    );
  }
  const ranked = Object.entries(scores).sort((a, b) => a[1] - b[1]),
    adjusted = { ...scores };
  const [winner, best] = ranked[0];
  const choices = Object.entries(evidence)
    .filter(
      ([piece]) =>
        winner !== "." &&
        (piece === piece.toUpperCase()) === (winner === winner.toUpperCase()) &&
        scores[piece] <= best + 0.04,
    )
    .sort((a, b) => a[1] - b[1]);
  if (
    choices.length &&
    choices[0][1] < 0.35 &&
    (!choices[1] || choices[1][1] - choices[0][1] > 0.025)
  )
    adjusted[choices[0][0]] = Math.max(
      0,
      adjusted[choices[0][0]] - 0.018 * (1 - choices[0][1] / 0.35),
    );
  return {
    scores: adjusted,
    anatomy: descriptor,
    evidence,
    proposed: choices[0]?.[0] ?? winner,
  };
}

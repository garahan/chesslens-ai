export type PieceSample = {
  mask: string;
  color: number[];
  coarse: string;
  style: string;
};
export const PIECES = ".PNBRQKpnbrqk";
/** Store foreground shape and average color, not a screenshot or player artwork. */
export function extractFine(
  data: Uint8ClampedArray,
  size = 48,
): { mask: string; color: number[] } {
  const at = (x: number, y: number) => {
    const i = (y * size + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const border: number[][] = [];
  for (let i = 6; i < size - 6; i++) border.push(at(2, i), at(size - 3, i));
  const bg = [0, 1, 2].map(
    (c) =>
      border.map((p) => p[c]).sort((a, b) => a - b)[
        Math.floor(border.length / 2)
      ],
  );
  let mask = "",
    count = 0;
  const color = [0, 0, 0];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const p = at(x, y);
      const strength =
        x < 4 || x >= size - 4 || y < 4 || y >= size - 4
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                (Math.hypot(...p.map((v, i) => v - bg[i])) - 13) / 30,
              ),
            );
      mask += Math.round(strength * 15).toString(16);
      if (strength > 0.7) {
        p.forEach((v, i) => (color[i] += v));
        count++;
      }
    }
  return { mask, color: count ? color.map((v) => v / count) : bg };
}
const decoded = new Map<string, Uint8Array>();
function decode(mask: string) {
  let values = decoded.get(mask);
  if (values) return values;
  values = Uint8Array.from(mask, (ch) => {
    const code = ch.charCodeAt(0);
    return code < 58 ? code - 48 : code - 87;
  });
  if (decoded.size >= 512) decoded.delete(decoded.keys().next().value!);
  decoded.set(mask, values);
  return values;
}
export function shapeDistance(a: string, b: string): number {
  if (a.length !== 2304 || b.length !== 2304) return Infinity;
  const x = decode(a),
    y = decode(b);
  let sum = 0,
    mass = 0;
  for (let i = 0; i < x.length; i++) {
    sum += Math.abs(x[i] - y[i]);
    mass += Math.max(x[i], y[i]);
  }
  return mass ? sum / mass : 0;
}
export function validSample(value: unknown): value is PieceSample {
  const v = value as PieceSample;
  return (
    !!v &&
    typeof v.mask === "string" &&
    /^[0-9a-f]{2304}$/.test(v.mask) &&
    typeof v.coarse === "string" &&
    /^[0-9a-f]{144}$/.test(v.coarse) &&
    Array.isArray(v.color) &&
    v.color.length === 3 &&
    v.color.every((n) => Number.isFinite(n) && n >= 0 && n <= 255) &&
    typeof v.style === "string" &&
    v.style.length < 80
  );
}

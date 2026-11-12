export type GridBounds = { x: number; y: number; size: number; error: number };
const LIGHT = [38, 52, 58],
  DARK = [21, 30, 35];
/** Detect the complete grid even when screenshots contain margins or phone frames. */
export function locateDuolingoGrid(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): GridBounds | null {
  const sample = (x: number, y: number) => {
    const i =
      4 *
      (Math.max(0, Math.min(height - 1, Math.floor(y))) * width +
        Math.max(0, Math.min(width - 1, Math.floor(x))));
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  const distance = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const geometries = new Map<
    string,
    { x: number; size: number; votes: number }
  >();
  const add = (x: number, size: number) => {
    if (
      x < -0.7 ||
      x + size > width + 0.7 ||
      size < width * 0.4 ||
      size > height
    )
      return;
    x = Math.max(0, x);
    size = Math.min(size, width - x);
    const key = `${Math.round(x / 2)},${Math.round(size / 2)}`;
    const old = geometries.get(key);
    if (old) {
      old.x = (old.x * old.votes + x) / (old.votes + 1);
      old.size = (old.size * old.votes + size) / (old.votes + 1);
      old.votes++;
    } else geometries.set(key, { x, size, votes: 1 });
  };
  add(0, width);
  const step = Math.max(2, Math.floor(height / 160));
  for (let y = 0; y < height; y += step) {
    const runs: { start: number; length: number }[] = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const light = x < width && distance(sample(x, y), LIGHT) < 16;
      if (light && start < 0) start = x;
      if (!light && start >= 0) {
        const length = x - start;
        if (length >= width * 0.035 && length <= width * 0.16)
          runs.push({ start, length });
        start = -1;
      }
    }
    for (let i = 0; i < runs.length; i++)
      for (let j = i + 1; j < runs.length; j++)
        for (let gap = 1; gap <= 3; gap++) {
          const cell = (runs[j].start - runs[i].start) / (2 * gap);
          if (
            cell < width * 0.05 ||
            cell > width / 8 + 0.5 ||
            runs[i].length < cell * 0.78 ||
            runs[i].length > cell * 1.17 ||
            runs[j].length < cell * 0.78 ||
            runs[j].length > cell * 1.17
          )
            continue;
          for (let col = 0; col < 8; col++)
            add(runs[i].start - col * cell, cell * 8);
        }
  }
  const candidates = [...geometries.values()].sort((a, b) => b.votes - a.votes);
  const unique: typeof candidates = [];
  for (const candidate of candidates) {
    if (
      !unique.some(
        (p) =>
          Math.abs(p.x - candidate.x) < 3 &&
          Math.abs(p.size - candidate.size) < 5,
      )
    )
      unique.push(candidate);
    if (unique.length === 14) break;
  }
  let best: GridBounds | null = null;
  const evaluate = (x: number, y: number, size: number) => {
    if (x < 0 || x + size > width + 0.2 || y < 0 || y + size > height)
      return Infinity;
    const cell = size / 8;
    let total = 0;
    for (let row = 0; row < 8; row++) {
      let rowError = 0;
      for (let col = 0; col < 8; col++) {
        const bg = (row + col) % 2 === 0 ? LIGHT : DARK;
        const errors: number[] = [];
        for (const fraction of [0.2, 0.5, 0.8])
          for (const edge of [0.025, 0.975])
            errors.push(
              Math.min(
                100,
                distance(
                  sample(x + (col + edge) * cell, y + (row + fraction) * cell),
                  bg,
                ),
              ),
            );
        errors.sort((a, b) => a - b);
        rowError += errors.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
      }
      rowError /= 8;
      if (rowError > 17) return Infinity;
      total += rowError;
    }
    // Missing outside files cannot be hidden by choosing only the better border.
    let edgeError = 0;
    for (let row = 0; row < 8; row++)
      for (const fraction of [0.35, 0.65]) {
        edgeError += Math.min(
          100,
          distance(
            sample(x + 0.035 * cell, y + (row + fraction) * cell),
            row % 2 === 0 ? LIGHT : DARK,
          ),
        );
        edgeError += Math.min(
          100,
          distance(
            sample(x + size - 0.035 * cell, y + (row + fraction) * cell),
            row % 2 === 0 ? DARK : LIGHT,
          ),
        );
      }
    edgeError /= 32;
    if (edgeError > 22) return Infinity;
    const topEdge = distance(
      sample(x + 0.035 * cell, y),
      sample(x + 0.035 * cell, y - 1),
    );
    return total / 8 + edgeError * 0.18 - Math.min(60, topEdge) * 0.025;
  };
  for (const { x, size } of unique) {
    const cell = size / 8;
    for (let y = 0; y <= height - size; y++) {
      if (distance(sample(x + 0.035 * cell, y + 2), LIGHT) > 24) continue;
      if (y > 0 && distance(sample(x + 0.035 * cell, y - 2), LIGHT) < 14)
        continue;
      const error = evaluate(x, y, size);
      if (error < 14 && (!best || error < best.error))
        best = { x, y, size, error };
    }
  }
  if (!best) return null;
  // Refine bounds below the detector's pixel quantization, not by chess guesses.
  const seed = best as GridBounds;
  for (const dx of [-1, -0.5, 0, 0.5, 1])
    for (const ds of [-2, -1, 0, 1, 2])
      for (const dy of [-1, 0, 1]) {
        const x = seed.x + dx,
          y = seed.y + dy,
          size = seed.size + ds;
        const error = evaluate(x, y, size);
        if (error < (best as GridBounds).error) best = { x, y, size, error };
      }
  return best;
}
export function hasDuolingoPalette(pixels: Uint8ClampedArray): boolean {
  let light = 0,
    dark = 0,
    total = 0;
  for (let i = 0; i < pixels.length; i += 4 * 13) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    if (Math.hypot(r - LIGHT[0], g - LIGHT[1], b - LIGHT[2]) < 16) light++;
    if (Math.hypot(r - DARK[0], g - DARK[1], b - DARK[2]) < 15) dark++;
    total++;
  }
  return light / total > 0.025 && dark / total > 0.15;
}

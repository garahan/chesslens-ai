const clamp = (n: number) => Math.max(0, Math.min(1, n));
export type Foreground = {
  mask: Float32Array;
  color: number[];
  backgrounds: number[][];
  edgeInk: number;
};
/** Background colors must occur on multiple edges; piece/label ink cannot form a palette alone. */
export function separateForeground(
  data: Uint8ClampedArray,
  size: number,
  threshold = 13,
): Foreground {
  if (data.length !== size * size * 4 || size < 12)
    throw Error("Invalid square pixels");
  const at = (x: number, y: number) =>
    Array.from(data.subarray((y * size + x) * 4, (y * size + x) * 4 + 3));
  const distance = (a: number[], b: number[]) =>
    Math.hypot(...a.map((v, i) => v - b[i]));
  const inset = Math.max(1, Math.round(size / 24));
  const border: { rgb: number[]; edge: number }[] = [];
  for (let i = inset * 3; i < size - inset * 3; i++) {
    border.push(
      { rgb: at(inset, i), edge: 0 },
      { rgb: at(size - 1 - inset, i), edge: 1 },
      { rgb: at(i, inset), edge: 2 },
      { rgb: at(i, size - 1 - inset), edge: 3 },
    );
  }
  const clusters: {
    pixels: number[][];
    edges: Set<number>;
    center: number[];
  }[] = [];
  for (const { rgb, edge } of border) {
    let group = clusters.find((c) => distance(c.center, rgb) < 18);
    if (!group) {
      group = { pixels: [], edges: new Set(), center: rgb };
      clusters.push(group);
    }
    group.pixels.push(rgb);
    group.edges.add(edge);
    group.center = group.center.map(
      (v, c) => v + (rgb[c] - v) / group!.pixels.length,
    );
  }
  clusters.sort((a, b) => b.pixels.length - a.pixels.length);
  const median = (rows: number[][]) =>
    [0, 1, 2].map(
      (c) =>
        rows.map((p) => p[c]).sort((a, b) => a - b)[
          Math.floor(rows.length / 2)
        ],
    );
  const backgrounds = clusters
    .filter(
      (c, i) =>
        i === 0 ||
        (c.edges.size >= 2 && c.pixels.length >= border.length * 0.18),
    )
    .slice(0, 3)
    .map((c) => median(c.pixels));
  const mask = new Float32Array(size * size),
    color = [0, 0, 0];
  const excluded = Math.max(2, Math.round(size / 12));
  let count = 0,
    edgeInk = 0,
    edgePixels = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgb = at(x, y),
        d = Math.min(...backgrounds.map((bg) => distance(rgb, bg)));
      const strength = clamp((d - threshold) / 30);
      if (
        x < excluded ||
        x >= size - excluded ||
        y < excluded ||
        y >= size - excluded
      ) {
        edgeInk += strength;
        edgePixels++;
        continue;
      }
      mask[y * size + x] = strength;
    }
  // Coordinate labels are small, isolated corner components. Keep central heads,
  // crosses and detached details; never erase a component connected to a piece.
  const seen = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index++)
    if (mask[index] > 0.2 && !seen[index]) {
      const queue = [index];
      seen[index] = 1;
      let left = size,
        right = 0,
        top = size,
        bottom = 0;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const i = queue[cursor],
          x = i % size,
          y = Math.floor(i / size);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy,
              next = yy * size + xx;
            if (
              xx < 0 ||
              yy < 0 ||
              xx >= size ||
              yy >= size ||
              seen[next] ||
              mask[next] <= 0.2
            )
              continue;
            seen[next] = 1;
            queue.push(next);
          }
      }
      if (
        (right < size * 0.3 || left > size * 0.7) &&
        (bottom < size * 0.3 || top > size * 0.7) &&
        queue.length < size * size * 0.035
      )
        for (const i of queue) mask[i] = 0;
    }
  for (let i = 0; i < mask.length; i++)
    if (mask[i] > 0.7) {
      for (let c = 0; c < 3; c++) color[c] += data[i * 4 + c];
      count++;
    }
  return {
    mask,
    color: count ? color.map((v) => v / count) : backgrounds[0],
    backgrounds,
    edgeInk: edgeInk / edgePixels,
  };
}
export function reduceMask(mask: Float32Array, size: number, output = 12) {
  const result = new Float32Array(output * output),
    scale = size / output;
  for (let y = 0; y < output; y++)
    for (let x = 0; x < output; x++) {
      let total = 0,
        count = 0;
      for (
        let yy = Math.floor(y * scale);
        yy < Math.floor((y + 1) * scale);
        yy++
      )
        for (
          let xx = Math.floor(x * scale);
          xx < Math.floor((x + 1) * scale);
          xx++
        ) {
          total += mask[yy * size + xx];
          count++;
        }
      result[y * output + x] = count ? total / count : 0;
    }
  return result;
}

export type CoordinateEvidence = {
  orientation: "white" | "black" | null;
  matched: number;
  reason: string;
  readings?: LabelSequence[];
};
export type LabelSequence = {
  axis: "files" | "ranks";
  labels: (string | null)[];
};
/** Five distinct positions must agree; contradictory readable sequences force abstention. */
export function coordinateVote(sequences: LabelSequence[]): CoordinateEvidence {
  const votes: { orientation: "white" | "black"; matched: number }[] = [];
  for (const sequence of sequences) {
    for (const orientation of ["white", "black"] as const) {
      const expected =
        sequence.axis === "files"
          ? orientation === "white"
            ? "abcdefgh"
            : "hgfedcba"
          : orientation === "white"
            ? "87654321"
            : "12345678";
      const read = sequence.labels.flatMap((label, i) =>
        label ? [{ label, expected: expected[i] }] : [],
      );
      if (
        read.length >= 5 &&
        read.every((item) => item.label === item.expected)
      )
        votes.push({ orientation, matched: read.length });
    }
  }
  if (new Set(votes.map((v) => v.orientation)).size > 1)
    return {
      orientation: null,
      matched: 0,
      reason: "Conflicting coordinate labels",
    };
  if (!votes.length)
    return {
      orientation: null,
      matched: 0,
      reason: "No sufficiently readable coordinate sequence",
    };
  return {
    orientation: votes[0].orientation,
    matched: Math.max(...votes.map((v) => v.matched)),
    reason: "Consistent coordinate labels",
  };
}
type Glyph = { values: Float32Array; aspect: number };
function glyphOf(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Glyph | null {
  const border: number[][] = [];
  const rgb = (x: number, y: number) =>
    Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 3));
  for (let x = 0; x < width; x++) border.push(rgb(x, 0), rgb(x, height - 1));
  for (let y = 0; y < height; y++) border.push(rgb(0, y), rgb(width - 1, y));
  const bg = [0, 1, 2].map(
    (c) =>
      border.map((p) => p[c]).sort((a, b) => a - b)[
        Math.floor(border.length / 2)
      ],
  );
  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      ink[y * width + x] =
        Math.hypot(...rgb(x, y).map((v, c) => v - bg[c])) > 35 ? 1 : 0;
  const components: number[][] = [],
    seen = new Uint8Array(ink.length);
  for (let i = 0; i < ink.length; i++)
    if (ink[i] && !seen[i]) {
      const group: number[] = [],
        queue = [i];
      seen[i] = 1;
      for (let p = 0; p < queue.length; p++) {
        const index = queue[p],
          x = index % width,
          y = Math.floor(index / width);
        group.push(index);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy,
              next = yy * width + xx;
            if (
              xx < 0 ||
              yy < 0 ||
              xx >= width ||
              yy >= height ||
              seen[next] ||
              !ink[next]
            )
              continue;
            seen[next] = 1;
            queue.push(next);
          }
      }
      components.push(group);
    }
  components.sort((a, b) => b.length - a.length);
  const group = components[0];
  if (!group || group.length < 4 || group.length > ink.length * 0.6)
    return null;
  const left = Math.min(...group.map((i) => i % width)),
    right = Math.max(...group.map((i) => i % width));
  const top = Math.min(...group.map((i) => Math.floor(i / width))),
    bottom = Math.max(...group.map((i) => Math.floor(i / width)));
  // Cut-off piece fragments are not glyphs. Tiny labels cannot support a confident read.
  if (
    left === 0 ||
    right === width - 1 ||
    top === 0 ||
    bottom === height - 1 ||
    bottom - top < 4
  )
    return null;
  const w = right - left + 1,
    h = bottom - top + 1,
    values = new Float32Array(12 * 16),
    members = new Set(group);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 12; x++) {
      const xx = Math.min(right, left + Math.floor(((x + 0.5) * w) / 12)),
        yy = Math.min(bottom, top + Math.floor(((y + 0.5) * h) / 16));
      values[y * 12 + x] = members.has(yy * width + xx) ? 1 : 0;
    }
  return { values, aspect: w / h };
}
let templates: { char: string; glyph: Glyph }[] | undefined;
function glyphTemplates() {
  if (templates) return templates;
  templates = [];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 40;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return templates;
  for (const family of ["Arial", "system-ui", "serif"])
    for (const weight of [400, 700])
      for (const char of "abcdefgh12345678") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 40, 40);
        ctx.fillStyle = "#000";
        ctx.font = `${weight} 24px ${family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(char, 20, 20);
        const glyph = glyphOf(ctx.getImageData(0, 0, 40, 40).data, 40, 40);
        if (glyph) templates.push({ char, glyph });
      }
  return templates;
}
function readGlyph(data: ImageData, alphabet: string) {
  const glyph = glyphOf(data.data, data.width, data.height);
  if (!glyph) return null;
  const costs = new Map<string, number>();
  for (const template of glyphTemplates())
    if (alphabet.includes(template.char)) {
      const mismatch =
        glyph.values.reduce(
          (sum, v, i) => sum + Math.abs(v - template.glyph.values[i]),
          0,
        ) / glyph.values.length;
      const cost =
        mismatch + Math.abs(glyph.aspect - template.glyph.aspect) * 0.16;
      costs.set(
        template.char,
        Math.min(costs.get(template.char) ?? Infinity, cost),
      );
    }
  const ranked = [...costs].sort((a, b) => a[1] - b[1]);
  return ranked.length > 1 &&
    ranked[0][1] < 0.24 &&
    ranked[1][1] - ranked[0][1] > 0.035
    ? ranked[0][0]
    : null;
}
/** Small local OCR for supported coordinate layouts; no network, turn inference, or single-letter guesses. */
export function readCoordinates(
  image: HTMLImageElement,
  crop: { x: number; y: number; size: number },
): CoordinateEvidence {
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx)
    return {
      orientation: null,
      matched: 0,
      reason: "Coordinate reader unavailable",
    };
  const cell = crop.size / 8,
    sequences: LabelSequence[] = [];
  const layouts = [
    {
      axis: "files" as const,
      x: 0.65,
      y: 7.72,
      w: 0.33,
      h: 0.27,
      stepX: 1,
      stepY: 0,
    },
    {
      axis: "files" as const,
      x: 0.01,
      y: 7.72,
      w: 0.33,
      h: 0.27,
      stepX: 1,
      stepY: 0,
    },
    {
      axis: "files" as const,
      x: 0.25,
      y: 8.02,
      w: 0.5,
      h: 0.36,
      stepX: 1,
      stepY: 0,
    },
    {
      axis: "ranks" as const,
      x: 0.01,
      y: 0.01,
      w: 0.28,
      h: 0.28,
      stepX: 0,
      stepY: 1,
    },
    {
      axis: "ranks" as const,
      x: -0.37,
      y: 0.24,
      w: 0.34,
      h: 0.52,
      stepX: 0,
      stepY: 1,
    },
  ];
  for (const layout of layouts) {
    const labels: (string | null)[] = [];
    for (let index = 0; index < 8; index++) {
      const x = crop.x + (layout.x + index * layout.stepX) * cell,
        y = crop.y + (layout.y + index * layout.stepY) * cell;
      const width = Math.max(4, Math.round(layout.w * cell)),
        height = Math.max(4, Math.round(layout.h * cell));
      if (
        x < 0 ||
        y < 0 ||
        x + width > image.naturalWidth ||
        y + height > image.naturalHeight
      ) {
        labels.push(null);
        continue;
      }
      const scale = Math.min(1, 48 / width, 64 / height),
        targetW = Math.max(4, Math.round(width * scale)),
        targetH = Math.max(4, Math.round(height * scale));
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(image, x, y, width, height, 0, 0, targetW, targetH);
      labels.push(
        readGlyph(
          ctx.getImageData(0, 0, targetW, targetH),
          layout.axis === "files" ? "abcdefgh" : "12345678",
        ),
      );
    }
    sequences.push({ axis: layout.axis, labels });
  }
  return { ...coordinateVote(sequences), readings: sequences };
}

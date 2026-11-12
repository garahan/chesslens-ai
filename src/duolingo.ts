import { inferDuolingoPosition } from "./duolingo-inference.ts";
import { locateDuolingoGrid, hasDuolingoPalette } from "./duolingo-grid.ts";
import { validatePlacement } from "./position.ts";
import { duolingoSignatures } from "./duolingo-signatures.ts";

export type BoardCrop = {
  x: number;
  y: number;
  size: number;
  imageWidth: number;
  imageHeight: number;
};
export type DuolingoResult = {
  boardCrop: BoardCrop;
  squares: string[];
  orientation: "white" | "black";
  reliable: boolean;
  meanConfidence: number;
  minConfidence: number;
  uncertainSquares: string[];
};

type Prototype = { piece: string; values: Float32Array; color: number[] };
const prototypes: Prototype[] = duolingoSignatures
  .trim()
  .split("\n")
  .map((line) => {
    const [piece, signature, rgb] = line.split("|");
    return {
      piece: piece === "-" ? "." : piece,
      values: Float32Array.from(signature, (ch) => Number(ch) / 9),
      color: rgb.split(",").map(Number),
    };
  });
const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));

async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Unable to decode the chess screenshot"));
      img.src = url;
    });
  } finally {
    // Wait until image decode completes before releasing the source.
    URL.revokeObjectURL(url);
  }
}

/**
 * Duolingo places a square chessboard between cartoon players; margins may be present.
 * Score the complete checkerboard and its precise top transition.
 * Repeated light-row edges alone cannot identify the true board boundary.
 * Return null for non-Duolingo screenshots to leave the ONNX path intact.
 */
export function locateBoard(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): number | null {
  return locateDuolingoGrid(pixels, width, height)?.y ?? null;
}
export function feature(image: ImageData, row: number, col: number) {
  const pixels = image.data;
  const size = 24;
  const ox = col * size,
    oy = row * size;
  const at = (x: number, y: number) => {
    const i = ((oy + y) * image.width + (ox + x)) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  const border: number[][] = [];
  for (let i = 3; i < 21; i++) {
    border.push(at(1, i), at(22, i));
  }
  const bg = [0, 1, 2].map(
    (channel) =>
      border.map((p) => p[channel]).sort((a, b) => a - b)[
        Math.floor(border.length / 2)
      ],
  );
  const mask = new Float32Array(144);
  let red = 0,
    green = 0,
    blue = 0,
    count = 0;
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) {
      let total = 0;
      // Downsample 24x24 to the 12x12 reference signature.
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const xx = x * 2 + dx,
            yy = y * 2 + dy,
            p = at(xx, yy);
          const dist = Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
          const strength =
            xx < 2 || xx >= 22 || yy < 2 || yy >= 22
              ? 0
              : clamp((dist - 13) / 30, 0, 1);
          total += strength;
          if (strength > 0.7) {
            red += p[0];
            green += p[1];
            blue += p[2];
            count++;
          }
        }
      mask[y * 12 + x] = total / 4;
    }
  return {
    mask,
    color: count ? [red / count, green / count, blue / count] : bg,
  };
}
export function classify(mask: Float32Array, color: number[]) {
  const candidates = new Map<string, number>();
  for (const prototype of prototypes) {
    let difference = 0;
    for (let i = 0; i < 144; i++)
      difference += Math.abs(mask[i] - prototype.values[i]);
    const chroma =
      Math.hypot(
        color[0] - prototype.color[0],
        color[1] - prototype.color[1],
        color[2] - prototype.color[2],
      ) / 255;
    const distance = difference / 144 + 0.22 * chroma;
    candidates.set(
      prototype.piece,
      Math.min(candidates.get(prototype.piece) ?? Infinity, distance),
    );
  }
  const ranked = [...candidates.entries()].sort((a, b) => a[1] - b[1]);
  const [piece, best] = ranked[0];
  // Compare distinct piece labels, not individual reference variants.
  // This is a match-quality heuristic, not a probability of correctness.
  return {
    piece,
    score: best,
    margin: ranked[1][1] - best,
    confidence: clamp(1 - best * 2.2, 0, 1),
    scores: Object.fromEntries(ranked),
  };
}
/** Use independent subpixel samples; disagreement remains visible for review. */
export function combineMatches(hits: ReturnType<typeof classify>[]) {
  if (!hits.length) throw new Error("No tile samples");
  const scores = Object.keys(hits[0].scores)
    .map((piece) => {
      const values = hits.map((hit) => hit.scores[piece]).sort((a, b) => a - b);
      const core = values.length >= 5 ? values.slice(1, -1) : values;
      return { piece, score: core.reduce((a, b) => a + b, 0) / core.length };
    })
    .sort((a, b) => a.score - b.score);
  const best = scores[0],
    margin = scores[1].score - best.score;
  const agreement =
    hits.filter((hit) => hit.piece === best.piece).length / hits.length;
  const stable =
    hits.length >= 5 && agreement === 1 && best.score < 0.085 && margin > 0.006;
  return {
    piece: best.piece,
    score: best.score,
    margin,
    agreement,
    confidence: clamp(1 - best.score * 2.2, 0, 1),
    scores: Object.fromEntries(
      scores.map((option) => [option.piece, option.score]),
    ),
    uncertain:
      best.score > 0.14 || agreement < 0.8 || (margin < 0.012 && !stable),
  };
}
export async function recognizeDuolingoScreenshot(
  file: File,
  manualCrop?: BoardCrop,
): Promise<DuolingoResult | null> {
  const img = await decode(file);
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw Error("Canvas 2D not supported by this browser");
  const width = 512,
    height = Math.round((img.naturalHeight * width) / img.naturalWidth);
  if (height > 5000 && !manualCrop) return null;
  if (
    manualCrop &&
    (![manualCrop.x, manualCrop.y, manualCrop.size].every(Number.isFinite) ||
      manualCrop.size < 24 ||
      manualCrop.x < 0 ||
      manualCrop.y < 0 ||
      manualCrop.x + manualCrop.size > img.naturalWidth + 0.1 ||
      manualCrop.y + manualCrop.size > img.naturalHeight + 0.1)
  )
    throw new Error("Crop must contain a square board within the image.");
  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const scale = img.naturalWidth / width;
  const bounds = manualCrop
    ? {
        x: manualCrop.x / scale,
        y: manualCrop.y / scale,
        size: manualCrop.size / scale,
        error: 0,
      }
    : locateDuolingoGrid(pixels, width, height);
  if (!bounds) {
    if (hasDuolingoPalette(pixels))
      throw new Error(
        "Duolingo board edges need adjustment. Use Adjust board crop to align all eight rows and files.",
      );
    return null;
  }
  const tile = document.createElement("canvas");
  tile.width = tile.height = 24;
  const tileContext = tile.getContext("2d", { willReadFrequently: true });
  if (!tileContext) throw Error("Canvas tile processing unavailable");
  tileContext.imageSmoothingEnabled = true;
  tileContext.imageSmoothingQuality = "high";
  const sourceTop = bounds.y * scale,
    sourceLeft = bounds.x * scale,
    sourceSize = bounds.size * scale,
    sourceCell = sourceSize / 8;
  const squares: string[] = [],
    confidences: number[] = [],
    uncertainSquares: string[] = [];
  const tileScores: ReturnType<typeof combineMatches>[] = [];
  // Sample each source square directly rather than rescaling the entire board.
  // Tiny offsets test whether JPEG edges/resampling change the predicted label.
  const offsets = [
    [0, 0],
    [-0.3, 0],
    [0.3, 0],
    [0, -0.3],
    [0, 0.3],
  ];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const hits = offsets.map(([dx, dy]) => {
        tileContext.clearRect(0, 0, 24, 24);
        tileContext.drawImage(
          img,
          sourceLeft + col * sourceCell + (dx * sourceCell) / 24,
          sourceTop + row * sourceCell + (dy * sourceCell) / 24,
          sourceCell,
          sourceCell,
          0,
          0,
          24,
          24,
        );
        const sample = feature(tileContext.getImageData(0, 0, 24, 24), 0, 0);
        return classify(sample.mask, sample.color);
      });
      const hit = combineMatches(hits);
      tileScores.push(hit);
      squares.push(hit.piece);
      confidences.push(hit.confidence);
      if (hit.uncertain) uncertainSquares.push("abcdefgh"[col] + (8 - row));
    }
  const occupied = tileScores.filter((hit) => hit.piece !== ".");
  if (
    occupied.length &&
    occupied.filter((hit) => hit.score > 0.16).length > occupied.length * 0.3
  )
    throw new Error(
      "Too many piece shapes are unclear. Crop tightly to the board or use the original full-resolution Duolingo screenshot.",
    );
  const inferred = inferDuolingoPosition(tileScores);
  if (!inferred)
    throw new Error(
      "Duolingo piece matches conflict with chess rules. Adjust the board crop to include only the 8×8 board.",
    );
  if (inferred) {
    squares.splice(0, 64, ...inferred.squares);
    for (const index of inferred.adjusted) {
      const square = "abcdefgh"[index % 8] + (8 - Math.floor(index / 8));
      if (!uncertainSquares.includes(square)) uncertainSquares.push(square);
    }
  }
  const topWhites = squares
    .slice(0, 16)
    .filter((p) => p !== "." && p === p.toUpperCase()).length;
  const bottomWhites = squares
    .slice(48, 64)
    .filter((p) => p !== "." && p === p.toUpperCase()).length;
  const orientation = topWhites > bottomWhites ? "black" : "white";
  // Empty squares must not inflate the reported match quality of actual pieces.
  const pieceConfidences = tileScores.flatMap((hit, index) =>
    hit.piece !== "." ? [confidences[index]] : [],
  );
  const meanConfidence = pieceConfidences.length
    ? pieceConfidences.reduce((a, b) => a + b, 0) / pieceConfidences.length
    : 0;
  // FEN always has rank 8 first; black-bottom screenshots show rank 1 first.
  const normalized = orientation === "black" ? [...squares].reverse() : squares;
  const fixedUncertain =
    orientation === "black"
      ? uncertainSquares.map(
          (s) => "abcdefgh"[7 - "abcdefgh".indexOf(s[0])] + (9 - Number(s[1])),
        )
      : uncertainSquares;
  return {
    boardCrop: {
      x: sourceLeft,
      y: sourceTop,
      size: sourceSize,
      imageWidth: img.naturalWidth,
      imageHeight: img.naturalHeight,
    },
    squares: normalized,
    orientation,
    reliable:
      !!inferred &&
      uncertainSquares.length === 0 &&
      validatePlacement(normalized, "w").errors.length === 0,
    meanConfidence,
    minConfidence: Math.min(...confidences),
    uncertainSquares: fixedUncertain,
  };
}

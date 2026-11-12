import { Chess } from "chess.js";
import { extractFine, type PieceSample } from "./recognition/features.ts";
import { refineWithLibrary, libraryCoverage } from "./recognition/library.ts";
import { readLearning } from "./recognition/learning.ts";
import { secondRead, secondReaderInfo } from "./recognition/second-reader.ts";
import {
  getTrackedGame,
  matchContinuation,
  type TemporalMatch,
} from "./recognition/tracking.ts";
import {
  RecognitionFailure,
  type RecognitionDiagnostics,
  type RecognitionExtras,
} from "./recognition/types.ts";
import { inferDuolingoPosition } from "./duolingo-inference.ts";
import {
  locateDuolingoGrid,
  locateDuolingoGrids,
  hasDuolingoPalette,
} from "./duolingo-grid.ts";
import { validatePlacement } from "./position.ts";
import { duolingoSignatures } from "./duolingo-signatures.ts";

export type BoardCrop = {
  x: number;
  y: number;
  size: number;
  imageWidth: number;
  imageHeight: number;
};
export type DuolingoResult = RecognitionExtras & {
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
  options: { useLearning?: boolean; useTracking?: boolean } = {},
): Promise<DuolingoResult | null> {
  const started = performance.now(),
    img = await decode(file);
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw Error("Canvas 2D not supported");
  const width = 512,
    height = Math.round((img.naturalHeight * width) / img.naturalWidth),
    scale = img.naturalWidth / width;
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
    throw Error("Crop must contain a square board within the image.");
  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const bounds = manualCrop
    ? [
        {
          x: manualCrop.x / scale,
          y: manualCrop.y / scale,
          size: manualCrop.size / scale,
          error: 0,
        },
      ]
    : locateDuolingoGrids(pixels, width, height, 3);
  const profile = readLearning();
  const learned =
    options.useLearning === false || !profile.enabled ? [] : profile.samples;
  const game = options.useTracking === false ? null : getTrackedGame();
  const diagnostics: RecognitionDiagnostics = {
    version: 1,
    elapsedMs: 0,
    readerPolicy: secondReaderInfo.policy,
    nativeLabels: libraryCoverage.nativeLabels,
    missingNativeLabels: libraryCoverage.missingNativeLabels,
    learnedSamples: learned.length,
    crops: [],
    tiles: [],
    notes: [
      "Match scores are visual similarity, not calibrated accuracy.",
      "The second reader is advisory until independent validation is available.",
    ],
  };
  if (!bounds.length) {
    if (hasDuolingoPalette(pixels))
      throw new RecognitionFailure(
        "Duolingo board edges need adjustment. Use Adjust board crop to align all eight rows and files.",
        diagnostics,
      );
    return null;
  }
  const tile = document.createElement("canvas");
  tile.width = tile.height = 24;
  const tx = tile.getContext("2d", { willReadFrequently: true });
  const fineCanvas = document.createElement("canvas");
  fineCanvas.width = fineCanvas.height = 48;
  const fx = fineCanvas.getContext("2d", { willReadFrequently: true });
  if (!tx || !fx) throw Error("Canvas tile processing unavailable");
  tx.imageSmoothingQuality = fx.imageSmoothingQuality = "high";
  type Candidate = {
    crop: BoardCrop;
    squares: string[];
    hits: ReturnType<typeof combineMatches>[];
    samples: PieceSample[];
    secondary: ReturnType<typeof secondRead>[];
    personal: boolean[];
    adjusted: number[];
    objective: number;
    valid: boolean;
    temporal?: TemporalMatch;
    orientation: "white" | "black";
  };
  const evaluated: Candidate[] = [];
  for (const bound of bounds) {
    const crop: BoardCrop = {
        x: bound.x * scale,
        y: bound.y * scale,
        size: bound.size * scale,
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
      },
      cell = crop.size / 8;
    const hits: ReturnType<typeof combineMatches>[] = [],
      samples: PieceSample[] = [],
      secondary: ReturnType<typeof secondRead>[] = [],
      personal: boolean[] = [];
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) {
        const x = crop.x + col * cell,
          y = crop.y + row * cell;
        const features = [
          [0, 0],
          [-0.3, 0],
          [0.3, 0],
          [0, -0.3],
          [0, 0.3],
        ].map(([dx, dy]) => {
          tx.clearRect(0, 0, 24, 24);
          tx.drawImage(
            img,
            x + (dx * cell) / 24,
            y + (dy * cell) / 24,
            cell,
            cell,
            0,
            0,
            24,
            24,
          );
          return feature(tx.getImageData(0, 0, 24, 24), 0, 0);
        });
        const coarse = combineMatches(
          features.map((f) => classify(f.mask, f.color)),
        );
        fx.clearRect(0, 0, 48, 48);
        fx.drawImage(img, x, y, cell, cell, 0, 0, 48, 48);
        const fine = extractFine(fx.getImageData(0, 0, 48, 48).data);
        const sample: PieceSample = {
          ...fine,
          coarse: Array.from(features[0].mask, (value) =>
            Math.round(value * 15).toString(16),
          ).join(""),
          style: "duo-teal-v1",
        };
        const library = refineWithLibrary(coarse.scores, sample, learned);
        const score = library.scores[library.piece];
        hits.push({
          ...coarse,
          scores: library.scores,
          piece: library.piece,
          score,
          margin: library.margin,
          confidence: clamp(1 - score * 2.2, 0, 1),
          uncertain:
            coarse.uncertain ||
            library.margin < 0.006 ||
            (library.piece !== coarse.piece && !library.personalUsed),
        });
        samples.push(sample);
        secondary.push(secondRead(features[0].mask, features[0].color));
        personal.push(library.personalUsed);
      }
    const inferred = inferDuolingoPosition(hits),
      occupied = hits.filter((hit) => hit.piece !== ".");
    const unfamiliar =
      occupied.length > 0 &&
      occupied.filter((hit) => hit.score > 0.16).length > occupied.length * 0.3;
    let squares = inferred?.squares || hits.map((hit) => hit.piece),
      temporal: TemporalMatch | undefined;
    const topWhite = squares
        .slice(0, 16)
        .filter((p) => p !== "." && p === p.toUpperCase()).length,
      bottomWhite = squares
        .slice(48)
        .filter((p) => p !== "." && p === p.toUpperCase()).length;
    let orientation: "white" | "black" =
      topWhite > bottomWhite ? "black" : "white";
    if (game && !unfamiliar) {
      const attempts = (["white", "black"] as const).flatMap((direction) => {
        const rows = direction === "black" ? [...hits].reverse() : hits;
        const match = matchContinuation(
          game.fen,
          rows.map((hit) => hit.scores),
        );
        return match ? [{ direction, match }] : [];
      });
      if (attempts.length === 1) {
        temporal = attempts[0].match;
        orientation = attempts[0].direction;
        const expanded = new Chess(temporal.fen)
          .board()
          .flat()
          .map((p) =>
            p ? (p.color === "w" ? p.type.toUpperCase() : p.type) : ".",
          );
        squares = orientation === "black" ? expanded.reverse() : expanded;
      }
    }
    const visualCost = occupied.length
      ? occupied.reduce((sum, hit) => sum + hit.score, 0) / occupied.length
      : 1;
    const valid = !!(inferred || temporal) && !unfamiliar;
    const objective =
      visualCost +
      Math.max(0, bound.error) * 0.002 +
      (valid ? 0 : 0.25) +
      (temporal ? -0.008 : 0);
    diagnostics.crops.push({
      crop,
      gridError: bound.error,
      visualCost,
      valid,
      objective,
    });
    evaluated.push({
      crop,
      squares,
      hits,
      samples,
      secondary,
      personal,
      adjusted: inferred?.adjusted || [],
      objective,
      valid,
      temporal,
      orientation,
    });
  }
  evaluated.sort((a, b) => a.objective - b.objective);
  const best = evaluated.find((candidate) => candidate.valid) || evaluated[0];
  diagnostics.selectedCrop = best.crop;
  const key = (visual: number) => {
    const index = best.orientation === "black" ? 63 - visual : visual;
    return "abcdefgh"[index % 8] + (8 - Math.floor(index / 8));
  };
  diagnostics.tiles = best.hits.map((hit, index) => ({
    square: key(index),
    piece: best.squares[index],
    alternatives: Object.entries(hit.scores)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([piece, distance]) => ({ piece, distance })),
    secondary: {
      piece: best.secondary[index].piece,
      activation: best.secondary[index].activation,
    },
    agreed: best.squares[index] === best.secondary[index].piece,
    personal: best.personal[index],
  }));
  diagnostics.elapsedMs = Math.round(performance.now() - started);
  if (game)
    diagnostics.tracking = {
      matched: !!best.temporal,
      moves: best.temporal?.moves,
    };
  if (!best.valid)
    throw new RecognitionFailure(
      "Piece matches remain inconsistent. Adjust the crop or use the original full-resolution screenshot; no board has been guessed.",
      diagnostics,
    );
  const uncertainSquares = best.hits.flatMap((hit, index) => {
    const modelDisagrees =
      best.secondary[index].piece !== hit.piece && hit.uncertain;
    return !best.temporal &&
      (hit.uncertain || best.adjusted.includes(index) || modelDisagrees)
      ? [key(index)]
      : [];
  });
  const occupied = best.hits.filter((hit) => hit.piece !== ".");
  const normalized =
    best.orientation === "black" ? [...best.squares].reverse() : best.squares;
  return {
    boardCrop: best.crop,
    squares: normalized,
    orientation: best.orientation,
    reliable:
      !uncertainSquares.length &&
      !validatePlacement(normalized, "w").errors.length,
    meanConfidence: occupied.length
      ? occupied.reduce((sum, hit) => sum + hit.confidence, 0) / occupied.length
      : 0,
    minConfidence: Math.min(...best.hits.map((hit) => hit.confidence)),
    uncertainSquares,
    diagnostics,
    learningTiles: Object.fromEntries(
      best.samples.map((sample, index) => [key(index), sample]),
    ),
    temporal: best.temporal,
  };
}

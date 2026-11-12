import { refineStructure, type Anatomy } from "./recognition/structure.ts";
import { frameConsensus } from "./recognition/consensus.ts";
import {
  reconstructPosition,
  renderReconstruction,
  type Reconstruction,
} from "./recognition/reconstruction.ts";
import { readCoordinates } from "./recognition/coordinates.ts";
import { separateForeground, reduceMask } from "./recognition/foreground.ts";
import { Chess } from "chess.js";
import type { PieceSample } from "./recognition/features.ts";
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

type Prototype = {
  piece: string;
  variants: { values: Float32Array; penalty: number }[];
  color: number[];
};
const prototypes: Prototype[] = duolingoSignatures
  .trim()
  .split("\n")
  .map((line) => {
    const [piece, signature, rgb] = line.split("|");
    return {
      piece: piece === "-" ? "." : piece,
      // A one-pixel offset at this resolution previously turned queens into rooks.
      // Align each reference before comparing silhouettes; retain a small motion cost.
      variants: [-1, 0, 1].flatMap((dy) =>
        [-1, 0, 1].map((dx) => ({
          values: Float32Array.from(signature, (_, index) => {
            const x = (index % 12) - dx,
              y = Math.floor(index / 12) - dy;
            return x >= 0 && x < 12 && y >= 0 && y < 12
              ? Number(signature[y * 12 + x]) / 9
              : 0;
          }),
          penalty: (Math.abs(dx) + Math.abs(dy)) * 0.007,
        })),
      ),
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
  const data = new Uint8ClampedArray(24 * 24 * 4);
  for (let y = 0; y < 24; y++) {
    const start = ((row * 24 + y) * image.width + col * 24) * 4;
    data.set(image.data.subarray(start, start + 24 * 4), y * 24 * 4);
  }
  const foreground = separateForeground(data, 24);
  return { mask: reduceMask(foreground.mask, 24), color: foreground.color };
}

export function classify(mask: Float32Array, color: number[]) {
  const candidates = new Map<string, number>();
  for (const prototype of prototypes) {
    let shape = Infinity;
    for (const variant of prototype.variants) {
      let difference = 0;
      for (let i = 0; i < 144; i++)
        difference += Math.abs(mask[i] - variant.values[i]);
      shape = Math.min(shape, difference / 144 + variant.penalty);
    }
    const chroma =
      Math.hypot(
        color[0] - prototype.color[0],
        color[1] - prototype.color[1],
        color[2] - prototype.color[2],
      ) / 255;
    const distance = shape + 0.22 * chroma;
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
    anatomy: (Anatomy | null)[];
    refined: number[];
    clearCount: number;
    deferred: number;
    consensus: ReturnType<typeof frameConsensus>;
    reconstruction: Reconstruction;
    adjusted: number[];
    promotionReview: number[];
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
    type Tile = {
      sample: PieceSample;
      first: ReturnType<typeof feature>;
      fine: ReturnType<typeof separateForeground>;
      pixels: Uint8ClampedArray;
      hit: ReturnType<typeof combineMatches>;
      personal: boolean;
      anatomy: Anatomy | null;
    };
    const records: Tile[] = [],
      refined: number[] = [];
    const update = (
      base: ReturnType<typeof combineMatches>,
      scores: Record<string, number>,
      changed = false,
    ) => {
      const ranked = Object.entries(scores).sort((a, b) => a[1] - b[1]);
      return {
        ...base,
        scores,
        piece: ranked[0][0],
        score: ranked[0][1],
        margin: ranked[1][1] - ranked[0][1],
        confidence: clamp(1 - ranked[0][1] * 2.2, 0, 1),
        uncertain:
          base.uncertain || changed || ranked[1][1] - ranked[0][1] < 0.006,
      };
    };
    const isClear = (hit: ReturnType<typeof combineMatches>) =>
      hit.piece === "."
        ? hit.score < 0.025 && hit.margin > 0.04
        : hit.score < 0.07 && hit.margin > 0.025 && !hit.uncertain;
    const read24 = (index: number, dx = 0, dy = 0) => {
      const x = crop.x + (index % 8) * cell,
        y = crop.y + Math.floor(index / 8) * cell;
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
    };
    for (let index = 0; index < 64; index++) {
      const x = crop.x + (index % 8) * cell,
        y = crop.y + Math.floor(index / 8) * cell;
      const first = read24(index),
        coarse = combineMatches([classify(first.mask, first.color)]);
      fx.clearRect(0, 0, 48, 48);
      fx.drawImage(img, x, y, cell, cell, 0, 0, 48, 48);
      const pixels = fx.getImageData(0, 0, 48, 48).data,
        fine = separateForeground(pixels, 48);
      const sample: PieceSample = {
        mask: Array.from(fine.mask, (value) =>
          Math.round(value * 15).toString(16),
        ).join(""),
        color: fine.color,
        coarse: Array.from(first.mask, (value) =>
          Math.round(value * 15).toString(16),
        ).join(""),
        style: "duo-teal-v1",
      };
      const library = refineWithLibrary(coarse.scores, sample, learned);
      records.push({
        first,
        pixels,
        fine,
        sample,
        personal: library.personalUsed,
        anatomy: null,
        hit: update(
          coarse,
          library.scores,
          library.piece !== coarse.piece && !library.personalUsed,
        ),
      });
    }
    const clearCount = records.filter((record) => isClear(record.hit)).length;
    const difficult = records
      .flatMap((record, index) =>
        !isClear(record.hit) || record.fine.edgeInk > 0.3 ? [index] : [],
      )
      .sort(
        (a, b) =>
          records[b].hit.score - records[a].hit.score ||
          records[a].hit.margin - records[b].hit.margin,
      );
    const refine = (index: number) => {
      const record = records[index];
      const variants = [
        record.first,
        ...[
          [-0.3, 0],
          [0.3, 0],
          [0, -0.3],
          [0, 0.3],
        ].map(([dx, dy]) => read24(index, dx, dy)),
      ];
      for (const threshold of [8, 18]) {
        const foreground = separateForeground(record.pixels, 48, threshold);
        variants.push({
          mask: reduceMask(foreground.mask, 48),
          color: foreground.color,
        });
      }
      const coarse = combineMatches(
        variants.map((f) => classify(f.mask, f.color)),
      );
      const structure = refineStructure(
        coarse.scores,
        record.fine.mask,
        48,
        record.fine.color,
      );
      const library = refineWithLibrary(
        structure.scores,
        record.sample,
        learned,
      );
      record.hit = update(
        coarse,
        library.scores,
        library.piece !== coarse.piece && !library.personalUsed,
      );
      record.anatomy = structure.anatomy;
      record.personal = library.personalUsed;
      refined.push(index);
    };
    for (const index of difficult.slice(0, 16)) refine(index);
    for (const index of difficult)
      if (!refined.includes(index)) records[index].hit.uncertain = true;
    const assemble = () => {
      const consensus = frameConsensus(
        records.map((record) => ({
          ...record.hit,
          mask: record.first.mask,
          color: record.first.color,
        })),
      );
      const hits = records.map((record, index) =>
        update(
          record.hit,
          consensus.scores[index],
          Object.entries(consensus.scores[index]).sort(
            (a, b) => a[1] - b[1],
          )[0][0] !== record.hit.piece,
        ),
      );
      const inferred = inferDuolingoPosition(hits),
        squares = inferred?.squares || hits.map((hit) => hit.piece);
      const reconstruction = reconstructPosition(
        records.map((record) => record.sample),
        squares,
        hits.map((hit, index) => isClear(hit) && hit.piece === squares[index]),
      );
      return { hits, inferred, squares, consensus, reconstruction };
    };
    let assembled = assemble();
    const outliers = assembled.reconstruction.outliers;
    const retry = outliers
      .filter((index) => !refined.includes(index))
      .slice(0, Math.max(0, 16 - refined.length));
    if (outliers.length) {
      for (const index of outliers) records[index].hit.uncertain = true;
      retry.forEach(refine);
      assembled = assemble();
    }
    const { hits, inferred, consensus } = assembled;
    const samples = records.map((record) => record.sample),
      personal = records.map((record) => record.personal);
    const secondary = records.map((record) =>
      secondRead(record.first.mask, record.first.color),
    );
    const occupied = hits.filter((hit) => hit.piece !== ".");
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
          2,
          game.line,
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
    const chosenCosts = squares.flatMap((piece, index) =>
      piece !== "." ? [hits[index].scores[piece]] : [],
    );
    const visualCost = chosenCosts.length
      ? (chosenCosts.reduce((sum, cost) => sum + cost, 0) +
          (temporal ? 0 : inferred ? inferred.cost - inferred.visualCost : 0)) /
        chosenCosts.length
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
      anatomy: records.map((record) => record.anatomy),
      refined,
      clearCount,
      deferred: [
        ...new Set([...difficult, ...assembled.reconstruction.outliers]),
      ].filter((index) => !refined.includes(index)).length,
      consensus,
      reconstruction: reconstructPosition(
        samples,
        squares,
        hits.map((hit, index) => isClear(hit) && hit.piece === squares[index]),
      ),
      adjusted: inferred?.adjusted || [],
      promotionReview: temporal ? [] : inferred?.promotionReview || [],
      objective,
      valid,
      temporal,
      orientation,
    });
  }
  evaluated.sort((a, b) => a.objective - b.objective);
  const best = evaluated.find((candidate) => candidate.valid) || evaluated[0];
  diagnostics.selectedCrop = best.crop;
  const coordinates = readCoordinates(img, best.crop);
  diagnostics.coordinates = coordinates;
  if (
    coordinates.orientation &&
    best.temporal &&
    coordinates.orientation !== best.orientation
  ) {
    diagnostics.notes.push(
      "Coordinate labels conflict with tracked orientation; review the screenshot crop.",
    );
    throw new RecognitionFailure(
      "Coordinate labels and tracked game disagree. Stop tracking or adjust the board crop before rescanning.",
      diagnostics,
    );
  }
  if (coordinates.orientation) best.orientation = coordinates.orientation;
  diagnostics.orientationSource = best.temporal
    ? "tracked-game"
    : coordinates.orientation
      ? "coordinates"
      : "piece-layout";
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
    refined: best.refined.includes(index),
    anatomy: best.anatomy[index] || undefined,
    consensusSeeds: best.consensus.changes
      .find((change) => change.index === index)
      ?.seeds.map((seed) => key(seed)),
    reconstructionError: best.reconstruction.residuals[index],
  }));
  diagnostics.processing = {
    clearFirstPass: best.clearCount,
    refined: best.refined.map(key),
    deferred: best.deferred,
    consensusSeeds: best.consensus.seeds,
  };
  diagnostics.reconstruction = {
    checked: best.reconstruction.checked,
    meanResidual: best.reconstruction.mean,
    outliers: best.reconstruction.outliers.map(key),
  };
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
      (hit.uncertain ||
        best.adjusted.includes(index) ||
        best.promotionReview.includes(index) ||
        best.reconstruction.outliers.includes(index) ||
        modelDisagrees)
      ? [key(index)]
      : [];
  });
  const occupied = best.hits.filter((hit) => hit.piece !== ".");
  const normalized =
    best.orientation === "black" ? [...best.squares].reverse() : best.squares;
  return {
    reconstructionImage: renderReconstruction(
      best.reconstruction,
      best.squares,
    ),
    reviewRequiredSquares: best.promotionReview.map(key),
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

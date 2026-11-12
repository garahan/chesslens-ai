import { PIECES, validSample, type PieceSample } from "./features.ts";
export const LEARNING_KEY = "chesslens-corrections-v1";
export type LearnedSample = PieceSample & {
  piece: string;
  id: string;
  time: number;
};
type Store = {
  version: 1;
  enabled: boolean;
  revision: number;
  samples: LearnedSample[];
};
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function storage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
export function readLearning(target: StorageLike | null = storage()): Store {
  try {
    const value = JSON.parse(target?.getItem(LEARNING_KEY) || "null");
    if (value?.version !== 1)
      return { version: 1, enabled: false, revision: 0, samples: [] };
    return {
      version: 1,
      enabled: value.enabled === true,
      revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
      samples: Array.isArray(value.samples)
        ? value.samples
            .filter(
              (s: LearnedSample) =>
                validSample(s) &&
                PIECES.includes(s.piece) &&
                s.piece.length === 1 &&
                typeof s.id === "string" &&
                Number.isFinite(s.time),
            )
            .slice(-130)
        : [],
    };
  } catch {
    return { version: 1, enabled: false, revision: 0, samples: [] };
  }
}
function write(value: Store, target: StorageLike | null) {
  if (!target) return false;
  try {
    target.setItem(LEARNING_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function setLearningEnabled(
  enabled: boolean,
  target: StorageLike | null = storage(),
) {
  const value = readLearning(target);
  return write({ ...value, enabled, revision: value.revision + 1 }, target);
}
export function learnCorrection(
  sample: PieceSample,
  piece: string,
  target: StorageLike | null = storage(),
): { before: Store; revision: number } | null {
  const before = readLearning(target);
  if (
    !before.enabled ||
    !validSample(sample) ||
    piece.length !== 1 ||
    !PIECES.includes(piece)
  )
    return null;
  const others = before.samples.filter(
    (s) => s.mask !== sample.mask || s.style !== sample.style,
  );
  const same = others.filter((s) => s.piece === piece).slice(-9),
    different = others.filter((s) => s.piece !== piece);
  const revision = before.revision + 1;
  const value: Store = {
    ...before,
    revision,
    samples: [
      ...different,
      ...same,
      { ...sample, piece, time: Date.now(), id: `${Date.now()}-${revision}` },
    ].slice(-130),
  };
  return write(value, target) ? { before, revision } : null;
}
export function undoLearning(
  change: { before: Store; revision: number },
  target: StorageLike | null = storage(),
) {
  if (readLearning(target).revision !== change.revision) return false;
  return write({ ...change.before, revision: change.revision + 1 }, target);
}
export function resetLearning(target: StorageLike | null = storage()) {
  const value = readLearning(target);
  return write({ ...value, samples: [], revision: value.revision + 1 }, target);
}

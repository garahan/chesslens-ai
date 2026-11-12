import type { BoardCrop } from "../duolingo";
import type { PieceSample } from "./features";
import type { TemporalMatch } from "./tracking";
export type SquareDiagnostic = {
  square: string;
  piece: string;
  alternatives: { piece: string; distance: number }[];
  secondary: { piece: string; activation: number };
  agreed: boolean;
  personal: boolean;
};
export type RecognitionDiagnostics = {
  version: 1;
  elapsedMs: number;
  readerPolicy: string;
  nativeLabels: string[];
  missingNativeLabels: string[];
  learnedSamples: number;
  crops: {
    crop: BoardCrop;
    gridError: number;
    visualCost: number;
    valid: boolean;
    objective: number;
  }[];
  selectedCrop?: BoardCrop;
  tiles: SquareDiagnostic[];
  tracking?: { matched: boolean; moves?: string[] };
  notes: string[];
};
export class RecognitionFailure extends Error {
  diagnostics: RecognitionDiagnostics;
  constructor(message: string, diagnostics: RecognitionDiagnostics) {
    super(message);
    this.diagnostics = diagnostics;
    this.name = "RecognitionFailure";
  }
}
export type RecognitionExtras = {
  diagnostics?: RecognitionDiagnostics;
  learningTiles?: Record<string, PieceSample>;
  temporal?: TemporalMatch;
};

import { validatePlacement } from "./position";
import { createRecognizer, resolveOrientation } from "@scoriiu/fenshot";
import { recognizeDuolingoScreenshot, type BoardCrop } from "./duolingo";
export type ScanOutcome = {
  boardCrop?: BoardCrop;
  squares: string[];
  orientation: "white" | "black";
  reliable: boolean;
  meanConfidence: number;
  minConfidence: number;
  uncertainSquares?: string[];
  source?: string;
};
let recognizer: ReturnType<typeof createRecognizer> | null = null;
function genericRecognizer() {
  return (recognizer ??= createRecognizer({
    modelUrl: "/models/chess-tiles-v2.onnx",
    wasmPaths: "/ort/",
  }));
}
export function parsePlacement(placement: string): string[] {
  const rows = placement.split("/");
  if (rows.length !== 8) throw Error("Scanner did not return eight rows");
  const squares: string[] = [];
  for (const row of rows) {
    let width = 0;
    for (const symbol of row) {
      if (/^[1-8]$/.test(symbol)) {
        const n = Number(symbol);
        width += n;
        for (let i = 0; i < n; i++) squares.push(".");
      } else if (/^[prnbqkPRNBQK]$/.test(symbol)) {
        squares.push(symbol);
        width++;
      } else throw Error("Invalid piece detected in scanner output");
    }
    if (width !== 8)
      throw Error("A scanned board row did not contain eight squares");
  }
  return squares;
}
export async function scanImage(
  file: File,
  options: { mode?: "auto" | "duolingo" | "general"; crop?: BoardCrop } = {},
): Promise<ScanOutcome | null> {
  const duolingo =
    options.mode === "general"
      ? null
      : await recognizeDuolingoScreenshot(file, options.crop);
  if (duolingo) return { ...duolingo, source: "Duolingo-specific recognizer" };
  if (options.mode === "duolingo")
    throw new Error(
      "Duolingo board not found. Adjust the board crop and try again.",
    );
  const result = await genericRecognizer().recognize(file);
  if (!result) return null;
  const resolved = resolveOrientation(result.placement);
  const squares = parsePlacement(resolved.placement);
  const issues = validatePlacement(squares, "w");
  if (issues.errors.length)
    throw new Error(
      "The general scanner did not find a valid position. For Duolingo, use Adjust board crop instead.",
    );
  return {
    squares,
    orientation: resolved.orientation === "black" ? "black" : "white",
    reliable: result.reliable,
    meanConfidence: result.meanConfidence,
    minConfidence: result.minConfidence,
    source: "General ONNX scanner",
  };
}

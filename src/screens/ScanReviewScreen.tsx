import type { GameLine } from "../rules";
import { ScanEditor } from "../scanner";
export function ScanReviewScreen({
  image,
  file,
  onAnalyze,
}: {
  image: string;
  file: File | null;
  onAnalyze: (fen: string, line?: GameLine) => void;
}) {
  return (
    <section className="review-screen">
      <ScanEditor image={image} file={file} onAnalyze={onAnalyze} />
    </section>
  );
}

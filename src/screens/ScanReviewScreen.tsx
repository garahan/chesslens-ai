import { ScanEditor } from "../scanner";
export function ScanReviewScreen({
  image,
  file,
  onAnalyze,
}: {
  image: string;
  file: File | null;
  onAnalyze: (fen: string) => void;
}) {
  return (
    <section className="review-screen">
      <div className="screen-heading">
        <span className="eyebrow">STEP 2 OF 3</span>
        <h2>Review your board</h2>
        <p>Make sure every piece is in the right place.</p>
      </div>
      <ScanEditor image={image} file={file} onAnalyze={onAnalyze} />
    </section>
  );
}

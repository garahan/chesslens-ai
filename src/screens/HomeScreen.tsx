import { ChessPiece } from "../components/board/ChessPiece";
import {
  Camera,
  ImagePlus,
  ScanLine,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
export function HomeScreen({
  onGallery,
  onCamera,
  onManual,
  recent,
  onRecent,
}: {
  onGallery: () => void;
  onCamera: () => void;
  onManual: () => void;
  recent: boolean;
  onRecent: () => void;
}) {
  return (
    <section className="home-screen">
      <div className="upload-card">
        <div className="scan-illustration">
          <ScanLine size={68} strokeWidth={1.2} />
          <span>
            <ChessPiece piece="n" />
          </span>
        </div>
        <h3>Start with a screenshot</h3>
        <p>Pick a screenshot, check the pieces, and find your next move.</p>
        <button className="primary" onClick={onGallery}>
          <ImagePlus size={20} />
          Choose image
        </button>
        <button className="secondary" onClick={onCamera}>
          <Camera size={19} />
          Open camera
        </button>
      </div>
      <p className="source-hint">
        Made for Duolingo screenshots.
        <br />
        Using another chess app? Choose General in scanner details.
      </p>
      {recent && (
        <button className="recent-card" onClick={onRecent}>
          <span>
            <ChessPiece piece="n" />
          </span>
          <div>
            <strong>Your last position</strong>
            <small>Pick up where you left off</small>
          </div>
          <ArrowRight size={20} />
        </button>
      )}
      <button className="text-button manual-link" onClick={onManual}>
        Or set up a position manually <ArrowRight size={15} />
      </button>
      <p className="privacy">
        <ShieldCheck size={14} /> Images stay on your device
      </p>
    </section>
  );
}

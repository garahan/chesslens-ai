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
      <div className="home-heading">
        <span className="eyebrow">A CLEARER NEXT MOVE</span>
        <h2>
          Your board.
          <br />A fresh perspective.
        </h2>
        <p>Turn a screenshot into your next best move.</p>
      </div>
      <div className="upload-card">
        <div className="scan-illustration">
          <ScanLine size={68} strokeWidth={1.2} />
          <span>
            <ChessPiece piece="n" />
          </span>
        </div>
        <h3>Import a chess screenshot</h3>
        <p>
          Scan the board. Review the pieces.
          <br />
          Explore the possibilities.
        </p>
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
        Best for screenshots from apps, websites,
        <br />
        and Duolingo Chess
      </p>
      <div className="workflow">
        <span>
          <b>1</b> Import
        </span>
        <i />
        <span>
          <b>2</b> Review
        </span>
        <i />
        <span>
          <b>3</b> Analyze
        </span>
      </div>
      {recent && (
        <button className="recent-card" onClick={onRecent}>
          <span>
            <ChessPiece piece="n" />
          </span>
          <div>
            <strong>Your last position</strong>
            <small>Continue exploring</small>
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

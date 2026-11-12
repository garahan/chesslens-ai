import { ChessPiece } from "../components/board/ChessPiece";
import {
  Camera,
  ImagePlus,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
const preview = [
  ".",
  ".",
  "r",
  ".",
  ".",
  "k",
  ".",
  ".",
  "p",
  "p",
  ".",
  ".",
  ".",
  "p",
  "p",
  "p",
  ".",
  ".",
  "n",
  ".",
  ".",
  ".",
  ".",
  ".",
  ".",
  ".",
  ".",
  "p",
  ".",
  ".",
  ".",
  ".",
  ".",
  ".",
  ".",
  "P",
  ".",
  ".",
  ".",
  ".",
  ".",
  ".",
  "P",
  ".",
  ".",
  "N",
  ".",
  ".",
  "P",
  "P",
  ".",
  ".",
  ".",
  "P",
  "P",
  "P",
  "R",
  ".",
  ".",
  ".",
  "K",
  ".",
  ".",
  "R",
];
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
        <div className="home-art" aria-hidden="true">
          <div className="hero-board">
            {preview.map((piece, i) => (
              <div
                key={i}
                className={(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : "light"}
              >
                {piece !== "." && <ChessPiece piece={piece} />}
              </div>
            ))}
          </div>
          <span className="hero-scan-corner corner-top" />
          <span className="hero-scan-corner corner-bottom" />
          <span className="hero-ready">
            <Check size={14} /> Ready for your next move
          </span>
        </div>
        <h3>Start with a screenshot</h3>
        <p>Pick a screenshot, check the pieces, and find your next move.</p>
        <div className="home-steps" aria-label="How it works">
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

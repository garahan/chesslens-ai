import { ArrowLeft, SlidersHorizontal, ScanLine } from "lucide-react";
import { SoundButton } from "../inputs/SoundControls";
export function AppHeader({
  onBack,
  onMore,
  home,
}: {
  onBack: () => void;
  onMore: () => void;
  home?: boolean;
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        {!home && (
          <button
            className="icon-button"
            aria-label="Go to home"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
          </button>
        )}
        <div className="brand">
          <span className="logo">
            <ScanLine size={20} />
          </span>
          <h1>
            ChessLens <span>AI</span>
          </h1>
        </div>
        <SoundButton />
        <button
          className="icon-button"
          aria-label="Open settings"
          onClick={onMore}
        >
          <SlidersHorizontal size={19} />
        </button>
      </div>
    </header>
  );
}

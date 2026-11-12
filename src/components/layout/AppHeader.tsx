import { ArrowLeft, MoreHorizontal, ScanLine } from "lucide-react";
export function AppHeader({
  onBack,
  onMore,
}: {
  onBack: () => void;
  onMore: () => void;
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <button
          className="icon-button"
          aria-label="Go to home"
          onClick={onBack}
        >
          <ArrowLeft size={19} />
        </button>
        <div className="brand">
          <ScanLine size={21} />
          <h1>
            ChessLens <span>AI</span>
          </h1>
        </div>
        <span className="build-badge" aria-label="App version 0.6.1">
          0.6.1
        </span>
        <button
          className="icon-button"
          aria-label="Open settings"
          onClick={onMore}
        >
          <MoreHorizontal size={22} />
        </button>
      </div>
    </header>
  );
}

import {
  ArrowLeft,
  ScanLine,
  Star,
  Share2,
  MoreHorizontal,
} from "lucide-react";
export function AppHeader({
  onBack,
  onShare,
  onMore,
  favorite,
  onFavorite,
}: {
  onBack: () => void;
  onShare: () => void;
  onMore: () => void;
  favorite: boolean;
  onFavorite: () => void;
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <button
          className="icon-button back"
          aria-label="Go to home"
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="brand">
          <span className="logo">
            <ScanLine size={25} />
          </span>
          <div>
            <h1>
              ChessLens <span>AI</span>
            </h1>
            <p>Chess Position Scanner</p>
          </div>
        </div>
        <div className="header-tools">
          <button
            className="icon-button"
            aria-label="Favorite this position"
            aria-pressed={favorite}
            onClick={onFavorite}
          >
            <Star size={19} fill={favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            aria-label="Share position"
            onClick={onShare}
          >
            <Share2 size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="Open settings"
            onClick={onMore}
          >
            <MoreHorizontal size={23} />
          </button>
        </div>
      </div>
    </header>
  );
}

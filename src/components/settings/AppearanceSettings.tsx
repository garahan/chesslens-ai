import { Check, RotateCcw, SunMoon } from "lucide-react";
import { useAppearance } from "../../appearance";
import {
  APP_THEMES,
  BOARD_THEMES,
  PIECE_FINISHES,
  PIECE_STYLES,
  THEME_LOOKS,
  DEFAULT_APPEARANCE,
  matchingLook,
  type Appearance,
} from "../../appearance-data";
import { ChessPiece } from "../board/ChessPiece";
function LookPreview({ look }: { look: Appearance }) {
  return (
    <div
      className="look-preview"
      data-theme={look.app}
      data-board={look.board}
      data-finish={look.finish}
      aria-hidden="true"
    >
      <div className="look-mini-header">
        <img src="/icons/icon.svg" width={12} height={12} alt="" />
        <span />
        <i />
      </div>
      <div className="look-mini-body">
        <div className="look-mini-board">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              className={(Math.floor(i / 4) + (i % 4)) % 2 ? "dark" : "light"}
              key={i}
            >
              {i === 2 ? (
                <ChessPiece piece="n" appearance={look.pieces} />
              ) : i === 13 ? (
                <ChessPiece piece="N" appearance={look.pieces} />
              ) : i === 8 ? (
                <ChessPiece piece="P" appearance={look.pieces} />
              ) : null}
            </span>
          ))}
        </div>
        <div className="look-mini-tools">
          <span className="mini-turn" />
          <span className="mini-action" />
          <span className="mini-line" />
          <span className="mini-line short" />
        </div>
      </div>
    </div>
  );
}
export function AppearanceSettings() {
  const { appearance, change, apply } = useAppearance(),
    active = matchingLook(appearance);
  return (
    <section className="appearance-settings" aria-label="Appearance">
      <div className="appearance-heading">
        <div>
          <h3>Make it yours</h3>
          <p>Pick a look, or mix your own.</p>
        </div>
        <button
          className="icon-button"
          aria-label="Reset appearance"
          title="Reset appearance"
          onClick={() => apply(DEFAULT_APPEARANCE)}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="look-grid" role="group" aria-label="Coordinated looks">
        {THEME_LOOKS.map((look) => (
          <button
            key={look.id}
            className="look-card"
            aria-label={`Apply ${look.name} look`}
            aria-pressed={active?.id === look.id}
            onClick={() => apply(look.appearance)}
          >
            <LookPreview look={look.appearance} />
            <span className="look-caption">
              <span>
                <strong>{look.name}</strong>
                <small>{look.caption}</small>
              </span>
              <span className="look-selected" aria-hidden="true">
                {active?.id === look.id && <Check size={12} />}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="appearance-current" role="status">
        {active
          ? `${active.name} selected`
          : appearance.app === "system"
            ? "Following your phone’s light and dark mode"
            : "Your own mix"}
      </p>
      <details className="appearance-customize">
        <summary>Make it your own</summary>
        <fieldset>
          <legend>App colors</legend>
          <div className="theme-options app-colors">
            {APP_THEMES.map((theme) => (
              <button
                key={theme.id}
                aria-label={theme.name}
                aria-pressed={appearance.app === theme.id}
                onClick={() => change("app", theme.id)}
              >
                <span
                  className="app-theme-swatch"
                  style={{
                    background: `linear-gradient(90deg, ${theme.surface} 60%, ${theme.accent} 60%)`,
                  }}
                />
                {theme.name}
              </button>
            ))}
          </div>
          <button
            className="system-theme"
            aria-label="System"
            aria-pressed={appearance.app === "system"}
            onClick={() => change("app", "system")}
          >
            <SunMoon size={17} />
            <span>Match my phone</span>
            {appearance.app === "system" && <Check size={15} />}
          </button>
        </fieldset>
        <fieldset>
          <legend>Board colors</legend>
          <div className="theme-options boards">
            {BOARD_THEMES.map((board) => (
              <button
                key={board.id}
                aria-label={`${board.name} board`}
                aria-pressed={appearance.board === board.id}
                onClick={() => change("board", board.id)}
              >
                <span
                  className="board-swatch"
                  style={{
                    background: `conic-gradient(${board.light} 25%, ${board.dark} 0 50%, ${board.light} 0 75%, ${board.dark} 0)`,
                  }}
                />
                {board.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Piece shape</legend>
          <div className="theme-options pieces">
            {PIECE_STYLES.map((id) => (
              <button
                key={id}
                aria-label={`${id} pieces`}
                aria-pressed={appearance.pieces === id}
                onClick={() => change("pieces", id)}
              >
                <ChessPiece piece="N" appearance={id} />
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Piece finish</legend>
          <div className="theme-options finishes">
            {PIECE_FINISHES.map((finish) => (
              <button
                key={finish.id}
                data-finish={finish.id}
                aria-label={`${finish.name} finish`}
                aria-pressed={appearance.finish === finish.id}
                onClick={() => change("finish", finish.id)}
              >
                <span className="finish-pair">
                  <ChessPiece piece="N" />
                  <ChessPiece piece="n" />
                </span>
                {finish.name}
              </button>
            ))}
          </div>
        </fieldset>
      </details>
    </section>
  );
}

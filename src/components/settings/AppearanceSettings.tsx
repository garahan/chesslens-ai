import {
  useAppearance,
  type AppTheme,
  type BoardTheme,
  type PieceStyle,
} from "../../appearance";
import { ChessPiece } from "../board/ChessPiece";
const boards: { id: BoardTheme; name: string; light: string; dark: string }[] =
  [
    { id: "classic", name: "Classic", light: "#f0d9b5", dark: "#b58863" },
    { id: "green", name: "Green", light: "#eeeed2", dark: "#769656" },
    { id: "walnut", name: "Walnut", light: "#e5cfaa", dark: "#825c3a" },
    { id: "lavender", name: "Lavender", light: "#eeebf5", dark: "#9b8bb3" },
    { id: "slate", name: "Slate", light: "#dce1e7", dark: "#718096" },
  ];
export function AppearanceSettings() {
  const { appearance, change } = useAppearance();
  return (
    <section className="appearance-settings" aria-label="Appearance">
      <h3>Appearance</h3>
      <fieldset>
        <legend>App theme</legend>
        <div className="theme-options">
          {(["light", "dark", "studio", "system"] as AppTheme[]).map((id) => (
            <button
              key={id}
              aria-pressed={appearance.app === id}
              onClick={() => change("app", id)}
            >
              <span className={"app-theme-swatch " + id} />
              {id === "studio" ? "Studio" : id[0].toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Board colors</legend>
        <div className="theme-options boards">
          {boards.map((board) => (
            <button
              key={board.id}
              aria-label={`${board.name} board`}
              aria-pressed={appearance.board === board.id}
              onClick={() => change("board", board.id)}
            >
              <span
                className="board-swatch"
                style={{
                  background: `conic-gradient(${board.light} 25%,${board.dark} 0 50%,${board.light} 0 75%,${board.dark} 0)`,
                }}
              />
              {board.name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Piece set</legend>
        <div className="theme-options pieces">
          {(["classic", "modern", "outline"] as PieceStyle[]).map((id) => (
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
    </section>
  );
}

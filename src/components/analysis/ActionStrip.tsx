import { ChessPiece } from "../board/ChessPiece";
import { Play } from "lucide-react";
export function ActionStrip({
  turn,
  onTurn,
  onAnalyze,
  disabled,
}: {
  turn: "w" | "b" | null;
  onTurn: (turn: "w" | "b") => void;
  onAnalyze: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <div className="action-strip">
      <div
        className="turn-choice"
        role="group"
        aria-label="Side to move"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const side = event.key === "ArrowLeft" ? "w" : "b";
            onTurn(side);
            event.currentTarget
              .querySelectorAll("button")
              [side === "w" ? 0 : 1].focus();
          }
        }}
      >
        {(["w", "b"] as const).map((side) => (
          <button
            key={side}
            aria-label={side === "w" ? "White to move" : "Black to move"}
            aria-pressed={turn === side}
            onClick={() => onTurn(side)}
          >
            <ChessPiece piece={side === "w" ? "P" : "p"} />
            {side === "w" ? "White" : "Black"}
          </button>
        ))}
      </div>
      <button className="primary" onClick={onAnalyze} disabled={disabled}>
        <Play size={16} fill="currentColor" />
        Analyze
      </button>
    </div>
  );
}

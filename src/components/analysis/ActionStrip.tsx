import { Play } from "lucide-react";
export function ActionStrip({
  turn,
  onTurn,
  onAnalyze,
  disabled,
  active,
}: {
  turn: "w" | "b" | null;
  onTurn: (turn: "w" | "b") => void;
  onAnalyze: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <div className="action-strip">
      <label className="turn-badge">
        <span className={"turn-dot " + (turn === "b" ? "black" : "")} />
        <select
          aria-label="Side to move"
          value={turn || ""}
          onChange={(e) => onTurn(e.target.value as "w" | "b")}
        >
          <option value="" disabled>
            Choose turn
          </option>
          <option value="w">White to move</option>
          <option value="b">Black to move</option>
        </select>
      </label>
      <button className="primary" onClick={onAnalyze} disabled={disabled}>
        <Play size={17} fill="currentColor" />
        {active ? "Analyze again" : "Analyze"}
      </button>
    </div>
  );
}

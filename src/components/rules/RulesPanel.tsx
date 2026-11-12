import { useMemo, useState } from "react";
import {
  upcomingClaims,
  type ClaimReason,
  type GameLine,
  type RuleStatus,
} from "../../rules";
export function RulesPanel({
  line,
  ply,
  status,
  onClaim,
}: {
  line: GameLine;
  ply: number;
  status: RuleStatus;
  onClaim: (reason: ClaimReason, intended?: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [chosen, setChosen] = useState("");
  const upcoming = useMemo(
    () => (open && !status.terminal ? upcomingClaims(line, ply) : []),
    [open, status.terminal, line, ply],
  );
  const selected =
    upcoming.find((option) => `${option.uci}|${option.reason}` === chosen) ||
    upcoming[0];
  return (
    <details
      className="rules-panel"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Chess rules &amp; draw claims</summary>
      <p role="status">{status.message}</p>
      <p>
        A screenshot can’t show earlier moves. Set castling and en passant in
        the scan options if you know them. Repetitions count from the moves
        saved here.
      </p>
      <p>
        This position has appeared {status.repetitions}{" "}
        {status.repetitions === 1 ? "time" : "times"} in your saved moves.
      </p>
      {status.claims.map((reason) => (
        <button
          className="secondary"
          key={reason}
          onClick={() => onClaim(reason)}
        >
          Claim draw · {reason}
        </button>
      ))}
      {selected && (
        <div className="claim-intent">
          <label>
            Claim a draw with your next move
            <select
              aria-label="Intended move for draw claim"
              value={`${selected.uci}|${selected.reason}`}
              onChange={(event) => setChosen(event.target.value)}
            >
              {upcoming.map((option) => (
                <option
                  key={`${option.uci}|${option.reason}`}
                  value={`${option.uci}|${option.reason}`}
                >
                  {option.san} · {option.reason}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => onClaim(selected.reason, selected.uci)}
          >
            Claim with selected move
          </button>
          <p>
            This declares your next move for the draw claim. It won’t move the
            piece on the board.
          </p>
        </div>
      )}
      {!status.terminal && !status.claims.length && !selected && (
        <p>No draw to claim from the moves saved so far.</p>
      )}
    </details>
  );
}

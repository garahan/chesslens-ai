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
        Castling and en passant follow the recorded position and moves. A
        screenshot cannot establish these rights. Repetition is counted from the
        available history.
      </p>
      <p>
        {status.repetitions} occurrence{status.repetitions === 1 ? "" : "s"} of
        this position in the recorded line.
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
            Claim before an intended move
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
            The intended move is declared for the claim and is not played on the
            board.
          </p>
        </div>
      )}
      {!status.terminal && !status.claims.length && !selected && (
        <p>No draw claim is available from the recorded line.</p>
      )}
    </details>
  );
}

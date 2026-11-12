import { Cpu } from "lucide-react";
import type { Variation, AnalysisLimit } from "../../engine";
export function evaluation(v?: Variation) {
  return v?.mate != null
    ? `#${v.mate}`
    : v?.cp != null
      ? `${v.cp >= 0 ? "+" : ""}${(v.cp / 100).toFixed(2)}`
      : "—";
}
export function EnginePanel({
  variations,
  status,
  enabled,
  onToggle,
  limit,
  onLimit,
}: {
  variations: Variation[];
  status: string;
  enabled: boolean;
  onToggle: () => void;
  limit: AnalysisLimit;
  onLimit: (limit: AnalysisLimit) => void;
}) {
  return (
    <section className="engine-panel" aria-label="Engine analysis">
      <div className="engine-header">
        <span className="eval-badge">{evaluation(variations[0])}</span>
        <div className="engine-title">
          <strong>
            <Cpu size={14} /> Stockfish 19
          </strong>
          <span>
            Depth {variations[0]?.depth || "—"} · {enabled ? status : "Paused"}
          </span>
        </div>
        <label className="depth-limit" title="Analysis depth limit">
          <select
            aria-label="Analysis depth limit"
            value={limit}
            onChange={(event) =>
              onLimit(
                event.target.value === "infinite"
                  ? "infinite"
                  : Number(event.target.value),
              )
            }
          >
            {[8, 10, 15, 20, 24, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="infinite">∞</option>
          </select>
        </label>
        <button
          className="switch"
          role="switch"
          aria-label="Enable engine"
          aria-checked={enabled}
          onClick={onToggle}
        >
          <span />
        </button>
      </div>
      <div className="variations">
        {variations.slice(0, 3).map((v) => (
          <div className="variation" key={v.rank}>
            <span className="variation-eval">{evaluation(v)}</span>
            <p title={v.san.join(" ")}>
              {(v.san.length ? v.san : v.uci).slice(0, 8).join(" ")}
            </p>
          </div>
        ))}
        {!variations.length && (
          <p className="engine-empty" role="status">
            {enabled ? status : "Engine paused. Resume when you’re ready."}
          </p>
        )}
      </div>
    </section>
  );
}

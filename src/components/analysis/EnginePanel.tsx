import { Cpu, Infinity as InfinityIcon } from "lucide-react";
import type { Variation } from "../../engine";
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
}: {
  variations: Variation[];
  status: string;
  enabled: boolean;
  onToggle: () => void;
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
        <InfinityIcon size={19} className="engine-live" />
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

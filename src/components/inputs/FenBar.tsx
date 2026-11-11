import { Copy, Check } from "lucide-react";
export function FenBar({
  value,
  onChange,
  onCopy,
  onLoad,
}: {
  value: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  onLoad: () => void;
}) {
  return (
    <section className="fen-section">
      <label htmlFor="fen-input">
        FEN <span>Position notation</span>
      </label>
      <div className="fen-bar">
        <input
          id="fen-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
        <button className="icon-button" onClick={onCopy} aria-label="Copy FEN">
          <Copy size={18} />
        </button>
        <button className="icon-button" onClick={onLoad} aria-label="Load FEN">
          <Check size={19} />
        </button>
      </div>
    </section>
  );
}

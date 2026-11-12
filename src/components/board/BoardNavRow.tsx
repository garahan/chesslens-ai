import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  RotateCcw,
  ArrowDownUp,
} from "lucide-react";
export function BoardNavRow({
  index,
  length,
  onNavigate,
  onReset,
  onFlip,
}: {
  index: number;
  length: number;
  onNavigate: (index: number) => void;
  onReset: () => void;
  onFlip?: () => void;
}) {
  return (
    <nav className="board-nav" aria-label="Move navigation">
      {onFlip && (
        <button
          className="icon-button"
          aria-label="Flip board"
          title="Flip board"
          onClick={onFlip}
        >
          <ArrowDownUp size={18} />
        </button>
      )}
      {[
        {
          Icon: ChevronsLeft,
          label: "First move",
          target: 0,
          disabled: index === 0,
        },
        {
          Icon: ChevronLeft,
          label: "Previous move",
          target: index - 1,
          disabled: index === 0,
        },
        {
          Icon: ChevronRight,
          label: "Next move",
          target: index + 1,
          disabled: index === length - 1,
        },
        {
          Icon: ChevronsRight,
          label: "Last move",
          target: length - 1,
          disabled: index === length - 1,
        },
      ].map(({ Icon, label, target, disabled }) => (
        <button
          key={label}
          className="icon-button"
          aria-label={label}
          title={label}
          disabled={disabled}
          onClick={() => onNavigate(target)}
        >
          <Icon size={20} />
        </button>
      ))}
      <button
        className="icon-button"
        aria-label="Reset position"
        title="Reset position"
        onClick={onReset}
      >
        <RotateCcw size={19} />
      </button>
    </nav>
  );
}

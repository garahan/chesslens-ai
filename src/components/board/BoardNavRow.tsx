import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  RotateCcw,
} from "lucide-react";
export function BoardNavRow({
  index,
  length,
  onNavigate,
  onReset,
}: {
  index: number;
  length: number;
  onNavigate: (index: number) => void;
  onReset: () => void;
}) {
  return (
    <nav className="board-nav" aria-label="Move navigation">
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
          disabled={disabled}
          onClick={() => onNavigate(target)}
        >
          <Icon size={22} />
        </button>
      ))}
      <button
        className="icon-button"
        aria-label="Reset position"
        onClick={onReset}
      >
        <RotateCcw size={19} />
      </button>
    </nav>
  );
}

import type { ComponentProps } from "react";
import { FlipVertical } from "lucide-react";
import { ActionStrip } from "../components/analysis/ActionStrip";
import { EnginePanel } from "../components/analysis/EnginePanel";
import { ChessBoardCard } from "../components/board/ChessBoardCard";
import { BoardNavRow } from "../components/board/BoardNavRow";
import { FenBar } from "../components/inputs/FenBar";

type AnalysisScreenProps = {
  board: ComponentProps<typeof ChessBoardCard>;
  navigation: ComponentProps<typeof BoardNavRow>;
  engine: ComponentProps<typeof EnginePanel>;
  fenInput: ComponentProps<typeof FenBar>;
  onTurn: (turn: "w" | "b") => void;
  onAnalyze: () => void;
  onFlip: () => void;
  past: string[];
};
export function AnalysisScreen({
  board,
  navigation,
  engine,
  fenInput,
  onTurn,
  onAnalyze,
  onFlip,
  past,
}: AnalysisScreenProps) {
  const position = board.board;
  return (
    <div className="analysis-screen">
      <ActionStrip
        turn={position.turn()}
        onTurn={onTurn}
        onAnalyze={onAnalyze}
        active={engine.enabled}
      />
      <div className="board-section">
        <ChessBoardCard {...board} />
        <BoardNavRow {...navigation} />
      </div>
      <div className="position-caption">
        <span>
          {position.isCheckmate()
            ? "Checkmate"
            : position.isDraw()
              ? "Draw"
              : position.isCheck()
                ? "King in check"
                : "Tap a piece to explore a move"}
        </span>
        <button className="text-button" onClick={onFlip}>
          <FlipVertical size={15} />
          Flip board
        </button>
      </div>
      <EnginePanel {...engine} />
      <FenBar {...fenInput} />
      <details className="history-card">
        <summary>
          Move history <span>{navigation.index} ply</span>
        </summary>
        <p>
          {past.length
            ? past.join(" · ")
            : "Make a move to start exploring variations."}
        </p>
      </details>
    </div>
  );
}

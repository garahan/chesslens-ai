import type { ComponentProps } from "react";

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
  return (
    <div className="analysis-screen">
      <div className="board-section">
        <ChessBoardCard {...board} />
        <BoardNavRow {...navigation} onFlip={onFlip} />
      </div>
      <ActionStrip
        turn={board.board.turn()}
        onTurn={onTurn}
        onAnalyze={onAnalyze}
        active={engine.enabled}
      />
      <EnginePanel {...engine} />
      <details className="position-tools">
        <summary>Position tools & history</summary>
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
      </details>
    </div>
  );
}

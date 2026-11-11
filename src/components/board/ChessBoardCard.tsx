import { Chess, type Move } from "chess.js";
const FIG: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};
export function ChessBoardCard({
  board,
  flipped,
  selected,
  moves,
  bestMove,
  onSquare,
}: {
  board: Chess;
  flipped: boolean;
  selected: string | null;
  moves: Move[];
  bestMove?: string;
  onSquare: (square: string) => void;
}) {
  const files = "abcdefgh",
    squares = Array.from(
      { length: 64 },
      (_, i) =>
        `${files[flipped ? 7 - (i % 8) : i % 8]}${flipped ? Math.floor(i / 8) + 1 : 8 - Math.floor(i / 8)}`,
    );
  const point = (sq: string) => {
    const i = squares.indexOf(sq);
    return { x: (i % 8) * 12.5 + 6.25, y: Math.floor(i / 8) * 12.5 + 6.25 };
  };
  const from = bestMove ? point(bestMove.slice(0, 2)) : null,
    to = bestMove ? point(bestMove.slice(2, 4)) : null;
  return (
    <section className="board-card" aria-label="Chess position">
      <div className="board-container">
        <div className="board" role="grid" aria-label="Interactive chessboard">
          {squares.map((sq) => {
            const piece = board.get(sq as never),
              legal = moves.some((m) => m.to === sq),
              check =
                piece?.type === "k" &&
                piece.color === board.turn() &&
                board.isCheck();
            return (
              <button
                key={sq}
                role="gridcell"
                aria-label={`${sq} ${piece ? `${piece.color === "w" ? "white" : "black"} ${piece.type}` : "empty"}`}
                onClick={() => onSquare(sq)}
                className={`square ${(files.indexOf(sq[0]) + Number(sq[1])) % 2 === 0 ? "dark" : "light"} ${selected === sq ? "selected" : ""} ${check ? "in-check" : ""}`}
              >
                <span
                  className={`piece ${piece?.color === "w" ? "white-piece" : "black-piece"}`}
                >
                  {piece ? FIG[piece.color + piece.type] : ""}
                </span>
                {legal && <span className={piece ? "capture" : "move-dot"} />}
                {sq[0] === (flipped ? "h" : "a") && (
                  <span className="rank">{sq[1]}</span>
                )}
                {sq[1] === (flipped ? "8" : "1") && (
                  <span className="file">{sq[0]}</span>
                )}
              </button>
            );
          })}
        </div>
        {from && to && (
          <svg className="move-arrow" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="3"
                markerHeight="3"
                refX="1.8"
                refY="1.5"
                orient="auto"
              >
                <path d="M0,0 L0,3 L2.5,1.5 z" fill="rgba(112,112,85,.65)" />
              </marker>
            </defs>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(112,112,85,.65)"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          </svg>
        )}
      </div>
    </section>
  );
}

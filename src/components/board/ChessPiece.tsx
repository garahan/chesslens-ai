/** A single vector piece set shared by the board, scanner, and piece pickers. */
export function ChessPiece({ piece }: { piece: string }) {
  if (!/^[kqrbnp]$/i.test(piece)) return null;
  const white = piece === piece.toUpperCase();
  const type = piece.toLowerCase();
  return (
    <svg
      className={`chess-piece ${white ? "chess-piece-white" : "chess-piece-black"}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        {type === "p" && (
          <>
            <circle cx="32" cy="18" r="8" />
            <path d="M25 27h14l-3 8c0 5 3 9 7 12H21c4-3 7-7 7-12z" />
            <path className="piece-detail" d="M26 29h12" />
          </>
        )}
        {type === "r" && (
          <>
            <path d="M17 12h8v7h5v-7h5v7h5v-7h7v15l-6 5 2 15H21l2-15-6-5z" />
            <path className="piece-detail" d="M21 27h22M24 33h16" />
          </>
        )}
        {type === "n" && (
          <>
            <path d="M20 47c0-9 4-15 12-21l-10 5-6-5 9-14 4-2 2-6 8 9c10 4 13 14 9 34z" />
            <path
              className="piece-detail"
              d="M30 15l-4 7M37 27c-4 4-6 9-6 15"
            />
            <circle
              className="piece-eye"
              cx="34"
              cy="20"
              r="1.8"
              stroke="none"
            />
          </>
        )}
        {type === "b" && (
          <>
            <path d="M32 8c-4 6-12 11-12 19 0 5 4 8 8 9l-6 11h20l-6-11c4-1 8-4 8-9 0-8-8-13-12-19z" />
            <path className="piece-detail" d="M35 18l-7 10M26 35h12" />
            <circle cx="32" cy="7" r="3" />
          </>
        )}
        {type === "q" && (
          <>
            <path d="M17 19l8 8 7-12 7 12 8-8-6 23H23z" />
            <circle cx="17" cy="17" r="3" />
            <circle cx="32" cy="12" r="3" />
            <circle cx="47" cy="17" r="3" />
            <path d="M23 39h18l3 8H20z" />
            <path className="piece-detail" d="M25 34h14" />
          </>
        )}
        {type === "k" && (
          <>
            <path d="M29 5h6v6h6v6h-6v6h-6v-6h-6v-6h6z" />
            <path d="M24 24c-7-9-15 0-10 8l10 10-3 5h22l-3-5 10-10c5-8-3-17-10-8l-8 7z" />
            <path className="piece-detail" d="M24 41h16M32 31v9" />
          </>
        )}
        <path d="M21 47h22l4 6H17z" />
        <path d="M17 53h30l3 5H14z" />
        <path className="piece-detail" d="M21 53h22" />
      </g>
    </svg>
  );
}

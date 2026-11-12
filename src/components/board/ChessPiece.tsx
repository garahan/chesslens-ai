import { memo } from "react";
import { useAppearance, type PieceStyle } from "../../appearance";
/** A single vector piece set shared by the board, scanner, and piece pickers. */
export const ChessPiece = memo(function ChessPiece({
  piece,
  appearance,
}: {
  piece: string;
  appearance?: PieceStyle;
}) {
  const { appearance: preferences } = useAppearance();
  const style = appearance || preferences.pieces;
  if (!/^[kqrbnp]$/i.test(piece)) return null;
  const white = piece === piece.toUpperCase();
  const type = piece.toLowerCase();
  return (
    <svg
      className={`chess-piece piece-set-${style} ${white ? "chess-piece-white" : "chess-piece-black"}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        {style !== "modern" ? (
          <>
            {type === "p" && (
              <>
                <circle cx="32" cy="16" r="7" />
                <path d="M27 24h10l-2 8c0 5 3 10 7 15H22c4-5 7-10 7-15z" />
                <path className="piece-detail" d="M27 26h10" />
              </>
            )}
            {type === "r" && (
              <>
                <path d="M16 10h8v7h5v-7h6v7h5v-7h8v15l-7 5 1 17H22l1-17-7-5z" />
                <path className="piece-detail" d="M20 25h24M24 31h16" />
              </>
            )}
            {type === "n" && (
              <>
                <path d="M19 47c-1-9 4-16 14-22l-11 5-7-5 9-13 5-1 2-7 8 9c11 7 12 18 7 34z" />
                <path
                  className="piece-detail"
                  d="M38 25c-5 4-8 10-8 17M25 19l3-4"
                />
                <circle
                  className="piece-eye"
                  cx="34"
                  cy="19"
                  r="1.7"
                  stroke="none"
                />
              </>
            )}
            {type === "b" && (
              <>
                <circle cx="32" cy="7" r="3" />
                <path d="M32 10c-5 5-11 10-11 17 0 5 4 7 8 8l-6 12h18l-6-12c4-1 8-3 8-8 0-7-6-12-11-17z" />
                <path className="piece-detail" d="M36 18l-8 10M25 35h14" />
              </>
            )}
            {type === "q" && (
              <>
                <path d="M17 19l8 7 7-10 7 10 8-7-6 21H23z" />
                <circle cx="17" cy="16" r="3" />
                <circle cx="32" cy="12" r="3" />
                <circle cx="47" cy="16" r="3" />
                <path d="M23 40h18l3 7H20z" />
                <path className="piece-detail" d="M25 35h14" />
              </>
            )}
            {type === "k" && (
              <>
                <path d="M29 5h6v6h5v5h-5v8h-6v-8h-5v-5h5z" />
                <path d="M24 24c-3-5-10-3-10 3 0 6 6 10 11 13l-4 7h22l-4-7c5-3 11-7 11-13 0-6-7-8-10-3l-8 7z" />
                <path className="piece-detail" d="M24 40h16M32 31v9" />
              </>
            )}
            <path d="M21 47h22l3 5H18zM18 52h28l4 6H14z" />
            <path className="piece-detail" d="M21 52h22" />
          </>
        ) : (
          <>
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
          </>
        )}
      </g>
    </svg>
  );
});

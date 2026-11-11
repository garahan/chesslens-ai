import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { scanImage, parsePlacement, type ScanOutcome } from "./vision";
import { validatePlacement } from "./position";
import { ActionStrip } from "./components/analysis/ActionStrip";
const glyphs: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
const palette = [
  "K",
  "Q",
  "R",
  "B",
  "N",
  "P",
  "k",
  "q",
  "r",
  "b",
  "n",
  "p",
  ".",
];
const starting = parsePlacement("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
function fenPlacement(squares: string[]) {
  return Array.from({ length: 8 }, (_, rank) => {
    let row = "",
      empty = 0;
    for (let col = 0; col < 8; col++) {
      const piece = squares[rank * 8 + col];
      if (piece === ".") empty++;
      else {
        if (empty) {
          row += empty;
          empty = 0;
        }
        row += piece;
      }
    }
    if (empty) row += empty;
    return row;
  }).join("/");
}
export function ScanEditor({
  image,
  file,
  onAnalyze,
}: {
  image: string;
  file: File | null;
  onAnalyze: (fen: string) => void;
}) {
  const requestRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [editing, setEditing] = useState(false),
    [focusedSquare, setFocusedSquare] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false),
    [turnConfirmed, setTurnConfirmed] = useState(false),
    [uncertain, setUncertain] = useState<string[]>([]),
    [pieces, setPieces] = useState<string[]>(starting),
    [selected, setSelected] = useState("P"),
    [turn, setTurn] = useState<"w" | "b">("w"),
    [orientation, setOrientation] = useState<"white" | "black">("white"),
    [castling, setCastling] = useState<string[]>([]),
    [error, setError] = useState(""),
    [scanning, setScanning] = useState(false),
    [result, setResult] = useState<ScanOutcome | null>(null);
  const issues = useMemo(() => validatePlacement(pieces, turn), [pieces, turn]);
  const fen = useMemo(
    () =>
      `${fenPlacement(pieces)} ${turn} ${castling.length ? ["K", "Q", "k", "q"].filter((c) => castling.includes(c)).join("") : "-"} - 0 1`,
    [pieces, turn, castling],
  );
  const detect = useCallback(async () => {
    const request = ++requestRef.current;
    if (!file) {
      setError("Choose a chess screenshot first.");
      return;
    }
    setScanning(true);
    setConfirmed(false);
    setTurnConfirmed(false);
    setFocusedSquare(null);
    setError("");
    setResult(null);
    try {
      const detected = await scanImage(file);
      if (request !== requestRef.current) return;
      if (!detected) {
        setError("No chessboard detected. Try a clearer screenshot.");
        return;
      }
      setPieces(detected.squares);
      setOrientation(detected.orientation);
      setResult(detected);
      setManuallyEdited(false);
      setCastling([]);
      setUncertain(detected.uncertainSquares || []);
      setConfirmed(false);
      setTurnConfirmed(false);
    } catch (e) {
      if (request !== requestRef.current) return;
      setError(
        `Scanner could not run: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    } finally {
      if (request === requestRef.current) setScanning(false);
    }
  }, [file]);
  useEffect(() => {
    setResult(null);
    setError("");
    setConfirmed(false);
    setTurnConfirmed(false);
    setUncertain([]);
    const timer = window.setTimeout(() => void detect(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current++;
    };
  }, [detect]);
  const reviewSquare = (n: number) => {
    const idx = orientation === "white" ? n : 63 - n;
    const name = "abcdefgh"[idx % 8] + (8 - Math.floor(idx / 8));
    setUncertain((old) => old.filter((s) => s !== name));
  };
  const analyze = () => {
    try {
      if (!confirmed) throw Error("Review and confirm the board");
      if (!turnConfirmed) throw Error("Select whose turn it is");
      if (uncertain.length) throw Error("Review highlighted uncertain squares");
      if (issues.errors.length) throw Error(issues.errors.join("; "));
      const board = new Chess(fen);
      if (!board.isGameOver() && !board.moves().length)
        throw Error("No legal moves");
      onAnalyze(board.fen());
      setError("");
    } catch (e) {
      setError(
        `Fix the position: ${e instanceof Error ? e.message : "invalid position"}`,
      );
    }
  };
  const canAnalyze =
    !scanning &&
    (!!result || manuallyEdited) &&
    turnConfirmed &&
    confirmed &&
    !uncertain.length &&
    !issues.errors.length;
  return (
    <div className="scaneditor">
      <ActionStrip
        turn={turnConfirmed ? turn : null}
        onTurn={(value) => {
          setTurn(value);
          setTurnConfirmed(true);
          setConfirmed(false);
        }}
        onAnalyze={analyze}
        disabled={!canAnalyze}
      />
      {scanning ? (
        <div className="scan-progress" role="status">
          <span className="scanner-spinner" />
          <strong>Finding your board…</strong>
          <p>Recognizing the pieces on your device.</p>
        </div>
      ) : (
        <>
          <div ref={boardRef} className="editorboard">
            {Array.from({ length: 64 }, (_, n) => {
              const row = Math.floor(n / 8),
                col = n % 8,
                idx = orientation === "white" ? n : 63 - n;
              return (
                <button
                  key={n}
                  className={`editSquare ${(row + col) % 2 ? "dark" : "light"} ${uncertain.includes("abcdefgh"[idx % 8] + (8 - Math.floor(idx / 8))) ? "uncertain" : ""} ${focusedSquare === "abcdefgh"[idx % 8] + (8 - Math.floor(idx / 8)) ? "focused" : ""}`}
                  aria-label={`${editing ? "Edit" : "Review"} ${"abcdefgh"[idx % 8]}${8 - Math.floor(idx / 8)}`}
                  onClick={() => {
                    if (!editing) {
                      setFocusedSquare(
                        "abcdefgh"[idx % 8] + (8 - Math.floor(idx / 8)),
                      );
                      return;
                    }
                    setManuallyEdited(true);
                    setPieces((old) =>
                      old.map((value, i) => (i === idx ? selected : value)),
                    );
                    setConfirmed(false);
                    const name =
                      "abcdefgh"[idx % 8] + (8 - Math.floor(idx / 8));
                    setUncertain((old) => old.filter((s) => s !== name));
                  }}
                >
                  <span
                    className={
                      pieces[idx] === pieces[idx].toUpperCase()
                        ? "white-piece"
                        : "black-piece"
                    }
                  >
                    {glyphs[pieces[idx]] || ""}
                  </span>
                  {col === 0 && (
                    <small className="rank">{8 - Math.floor(idx / 8)}</small>
                  )}
                  {row === 7 && (
                    <small className="file">{"abcdefgh"[idx % 8]}</small>
                  )}
                </button>
              );
            })}
          </div>
          <div className="review-card">
            <div className="review-card-title">
              <strong>
                {result
                  ? result.source?.includes("Duolingo")
                    ? "Duolingo recognizer"
                    : "General scanner"
                  : "Scanner needs your help"}
              </strong>
              <button className="text-button" onClick={detect} disabled={!file}>
                Rescan
              </button>
            </div>
            {result && (
              <>
                <div className="confidence-row">
                  <span>Recognition confidence</span>
                  <strong>{(result.meanConfidence * 100).toFixed(0)}%</strong>
                </div>
                <div
                  className={`confidence-track ${result.reliable ? "" : "low-confidence"}`}
                >
                  <span style={{ width: `${result.meanConfidence * 100}%` }} />
                </div>
                <p>
                  {uncertain.length
                    ? `${uncertain.length} squares need a closer look.`
                    : result.reliable
                      ? "Board recognized. Check the pieces and confirm below."
                      : "Low confidence. Check every piece before continuing."}
                </p>
              </>
            )}
            {uncertain.length > 0 && (
              <div className="reviewChips">
                {uncertain.map((square) => (
                  <button
                    key={square}
                    className={focusedSquare === square ? "chosen" : ""}
                    onClick={() => {
                      setFocusedSquare(square);
                      boardRef.current?.scrollIntoView({
                        block: "start",
                        behavior: "smooth",
                      });
                    }}
                    aria-label={`Review uncertain square ${square}`}
                  >
                    {square} ?
                  </button>
                ))}
              </div>
            )}
            {focusedSquare && (
              <div className="square-review">
                <strong>Review {focusedSquare}</strong>
                <button
                  className="secondary"
                  onClick={() => {
                    const idx =
                      (8 - Number(focusedSquare[1])) * 8 +
                      "abcdefgh".indexOf(focusedSquare[0]);
                    reviewSquare(orientation === "white" ? idx : 63 - idx);
                    setFocusedSquare(null);
                  }}
                >
                  ✓ Piece is correct
                </button>
                <button
                  className="text-button"
                  onClick={() => setEditing(true)}
                >
                  Edit piece
                </button>
              </div>
            )}
            <button
              className="text-button editor-toggle"
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Done editing" : "Edit board & orientation"}
            </button>
          </div>
          {editing && (
            <div className="manual-editor">
              <p>Choose a piece, then tap a square to place it.</p>
              <label className="setting-row">
                Board orientation
                <select
                  value={orientation}
                  onChange={(e) => {
                    setOrientation(e.target.value as "white" | "black");
                    setConfirmed(false);
                  }}
                >
                  <option value="white">White at bottom</option>
                  <option value="black">Black at bottom</option>
                </select>
              </label>
              <div className="piecepalette">
                {palette.map((p) => (
                  <button
                    key={p}
                    aria-label={p === "." ? "Erase piece" : `Select ${p}`}
                    aria-pressed={selected === p}
                    className={selected === p ? "chosen" : ""}
                    onClick={() => setSelected(p)}
                  >
                    {p === "." ? "×" : glyphs[p]}
                  </button>
                ))}
              </div>
              <div className="editoractions">
                <button
                  onClick={() => {
                    setPieces(Array(64).fill("."));
                    setManuallyEdited(true);
                    setUncertain([]);
                    setConfirmed(false);
                  }}
                >
                  Clear board
                </button>
                <button
                  onClick={() => {
                    setPieces([...starting]);
                    setManuallyEdited(true);
                    setUncertain([]);
                    setConfirmed(false);
                  }}
                >
                  Starting position
                </button>
                <button
                  onClick={() => {
                    setManuallyEdited(true);
                    setPieces((old) =>
                      old.map((p) =>
                        p === "."
                          ? p
                          : p === p.toUpperCase()
                            ? p.toLowerCase()
                            : p.toUpperCase(),
                      ),
                    );
                    setConfirmed(false);
                  }}
                >
                  Swap colors
                </button>
              </div>
            </div>
          )}
          <details className="source-image">
            <summary>View imported screenshot</summary>
            <img src={image} alt="Imported chess screenshot" />
          </details>
          <details className="castling-details">
            <summary>Advanced position options</summary>
            <p>Only enable castling if it is still legal.</p>
            <div className="castlingRights">
              {(
                [
                  ["K", "White O-O"],
                  ["Q", "White O-O-O"],
                  ["k", "Black O-O"],
                  ["q", "Black O-O-O"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={castling.includes(key)}
                    onChange={(e) => {
                      setConfirmed(false);
                      setCastling((old) =>
                        e.target.checked
                          ? [...old, key]
                          : old.filter((x) => x !== key),
                      );
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </details>
          {issues.errors.length > 0 && (
            <div className="notice" role="alert">
              Position needs correction: {issues.errors.join("; ")}
            </div>
          )}
          {issues.warnings.length > 0 && (
            <div className="recognitionCard">
              Review: {issues.warnings.join("; ")}
            </div>
          )}
          {(result || manuallyEdited) && (
            <div className="reviewConfirmation">
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                I verified the piece positions and orientation.
              </label>
              <span>
                {turnConfirmed
                  ? "Side to move confirmed."
                  : "Choose White or Black in Side to move above."}{" "}
                A screenshot alone cannot always identify the turn.
              </span>
            </div>
          )}
          <details className="fen-section">
            <summary>Position FEN</summary>
            <code className="editorfen">{fen}</code>
          </details>
          {error && (
            <div className="notice" role="alert">
              {error}
            </div>
          )}
          {!result && (
            <button
              className="primary"
              disabled={scanning || !file}
              onClick={detect}
            >
              Try scanning again
            </button>
          )}
        </>
      )}
    </div>
  );
}

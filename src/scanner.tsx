import { RecognitionReport } from "./components/scanner/RecognitionReport";
import {
  RecognitionFailure,
  type RecognitionDiagnostics,
} from "./recognition/types";
import { learnCorrection, undoLearning } from "./recognition/learning";
import { advanceTracking } from "./recognition/tracking";
import { BoardCropper } from "./components/scanner/BoardCropper";
import type { BoardCrop } from "./duolingo";
import { Modal } from "./components/layout/Modal";
import { ChessPiece } from "./components/board/ChessPiece";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { scanImage, parsePlacement, type ScanOutcome } from "./vision";
import {
  validatePlacement,
  validateAnalysisPosition,
  promotionRequirements,
} from "./position";
import { SourceBoard } from "./components/scanner/SourceBoard";
import { ActionStrip } from "./components/analysis/ActionStrip";
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
  const [report, setReport] = useState<RecognitionDiagnostics | null>(null);
  const [lastEdit, setLastEdit] = useState<{
    index: number;
    before: string;
    uncertain: boolean;
    required: boolean;
    learning: ReturnType<typeof learnCorrection>;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState<BoardCrop | undefined>();
  const [scannerMode, setScannerMode] = useState<
    "auto" | "duolingo" | "general"
  >("duolingo");
  const requestRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [editing, setEditing] = useState(false),
    [focusedSquare, setFocusedSquare] = useState<string | null>(null);
  const [turnConfirmed, setTurnConfirmed] = useState(false),
    [uncertain, setUncertain] = useState<string[]>([]),
    [pieces, setPieces] = useState<string[]>(starting),
    [selected, setSelected] = useState("P"),
    [turn, setTurn] = useState<"w" | "b">("w"),
    [orientation, setOrientation] = useState<"white" | "black">("white"),
    [castling, setCastling] = useState<string[]>([]),
    [error, setError] = useState(""),
    [scanning, setScanning] = useState(false),
    [result, setResult] = useState<ScanOutcome | null>(null);
  const [requiredReview, setRequiredReview] = useState<string[]>([]);
  const activeReview = useMemo(() => {
    const indices = new Set(
      promotionRequirements(pieces).flatMap((row) => row.indices),
    );
    return requiredReview.filter((square) =>
      indices.has((8 - Number(square[1])) * 8 + "abcdefgh".indexOf(square[0])),
    );
  }, [requiredReview, pieces]);
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
    setReport(null);
    setLastEdit(null);
    setNotice("");
    setManuallyEdited(false);
    setTurnConfirmed(false);
    setFocusedSquare(null);
    setRequiredReview([]);
    setShowOriginal(false);

    setError("");
    setResult(null);
    try {
      const detected = await scanImage(file, { mode: scannerMode, crop });
      if (request !== requestRef.current) return;
      if (!detected) {
        setError("No chessboard detected. Try a clearer screenshot.");
        return;
      }
      setPieces(detected.squares);
      setOrientation(detected.orientation);
      setResult(detected);
      setManuallyEdited(false);
      setReport(detected.diagnostics || null);
      setCastling(
        detected.temporal
          ? detected.temporal.fen.split(" ")[2].replace("-", "").split("")
          : [],
      );
      setUncertain(detected.uncertainSquares || []);
      setRequiredReview(detected.reviewRequiredSquares || []);
      if (detected.temporal) {
        setTurn(detected.temporal.fen.split(" ")[1] as "w" | "b");
        setTurnConfirmed(true);
      } else setTurnConfirmed(false);
    } catch (e) {
      if (request !== requestRef.current) return;
      if (e instanceof RecognitionFailure) setReport(e.diagnostics);
      setError(
        `Scanner could not run: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    } finally {
      if (request === requestRef.current) setScanning(false);
    }
  }, [file, scannerMode, crop]);
  useEffect(() => {
    setResult(null);
    setError("");
    setTurnConfirmed(false);
    setUncertain([]);
    const timer = window.setTimeout(() => void detect(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current++;
    };
  }, [detect]);
  const applyCorrection = (square: string, piece: string) => {
    const index = (8 - Number(square[1])) * 8 + "abcdefgh".indexOf(square[0]);
    const sample = result?.learningTiles?.[square];
    const learning = sample ? learnCorrection(sample, piece) : null;
    setLastEdit({
      index,
      before: pieces[index],
      uncertain: uncertain.includes(square),
      required: requiredReview.includes(square),
      learning,
    });
    setPieces((old) => old.map((value, i) => (i === index ? piece : value)));
    setUncertain((old) => old.filter((value) => value !== square));
    setRequiredReview((old) => old.filter((value) => value !== square));
    setManuallyEdited(true);
    setFocusedSquare(null);
    setNotice(
      learning ? "Correction learned on this device." : "Piece updated.",
    );
  };
  const undoEdit = () => {
    if (!lastEdit) return;
    setPieces((old) =>
      old.map((value, index) =>
        index === lastEdit.index ? lastEdit.before : value,
      ),
    );
    if (lastEdit.uncertain) {
      const square =
        "abcdefgh"[lastEdit.index % 8] + (8 - Math.floor(lastEdit.index / 8));
      setUncertain((old) => (old.includes(square) ? old : [...old, square]));
    }
    if (lastEdit.required) {
      const square =
        "abcdefgh"[lastEdit.index % 8] + (8 - Math.floor(lastEdit.index / 8));
      setRequiredReview((old) =>
        old.includes(square) ? old : [...old, square],
      );
    }
    const restored = !lastEdit.learning || undoLearning(lastEdit.learning);
    setNotice(
      restored
        ? "Correction undone."
        : "Board restored; saved learning changed in another tab.",
    );
    setLastEdit(null);
  };
  const analyze = () => {
    try {
      if (!turnConfirmed) throw Error("Select whose turn it is");
      if (activeReview.length)
        throw Error("Review the unclear extra pieces before analysis");
      if (issues.errors.length) throw Error(issues.errors.join("; "));
      validateAnalysisPosition(fen);
      const board = new Chess(fen);
      if (!board.isGameOver() && !board.moves().length)
        throw Error("No legal moves");
      const tracked = result?.temporal;
      const fields = fen.split(" "),
        historyFields = tracked?.fen.split(" ");
      const usesHistory =
        tracked &&
        historyFields &&
        fields.slice(0, 3).join(" ") === historyFields.slice(0, 3).join(" ");
      const accepted = usesHistory ? tracked.fen : board.fen();
      if (usesHistory) advanceTracking(tracked.anchor, accepted);
      onAnalyze(accepted);
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
    !activeReview.length &&
    !issues.errors.length;
  const exportLabels = async () => {
    if (!file || !result?.boardCrop) return;
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      const sourceGroup = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      const labels = {
        version: 1,
        verified: false,
        sourceGroup,
        imageWidth: result.boardCrop.imageWidth,
        imageHeight: result.boardCrop.imageHeight,
        placement: fenPlacement(pieces),
        orientation: result.orientation,
        crop: result.boardCrop,
        note: "Proposed labels. Check every square against the original before using as verified training or test data.",
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(labels, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "chesslens-board-labels.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice(
        "Could not export labels. Try again from a secure browser connection.",
      );
    }
  };
  return (
    <div className="scaneditor">
      {cropOpen && (
        <BoardCropper
          image={image}
          initial={crop || result?.boardCrop || report?.selectedCrop}
          onCancel={() => setCropOpen(false)}
          onApply={(bounds) => {
            setCrop(bounds);
            setScannerMode("duolingo");
            setCropOpen(false);
          }}
        />
      )}
      {scanning ? (
        <div className="scan-progress" role="status">
          <span className="scanner-spinner" />
          <strong>Finding your board…</strong>
          <p>Recognizing the pieces on your device.</p>
        </div>
      ) : (
        <>
          {!result && !manuallyEdited ? (
            <div className="scan-recovery">
              <img
                src={image}
                alt="Original screenshot; no valid board detected yet"
              />
              <button className="primary" onClick={() => setCropOpen(true)}>
                Adjust board crop
              </button>
              <p>The original image is shown until a valid board is found.</p>
            </div>
          ) : showOriginal && result?.boardCrop ? (
            <div className="source-board-card">
              <SourceBoard
                image={image}
                crop={result.boardCrop}
                orientation={orientation}
                sourceOrientation={result.orientation}
              />
              <p>Compare the pieces, then switch back to correct any square.</p>
            </div>
          ) : (
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
                      applyCorrection(
                        "abcdefgh"[idx % 8] + (8 - Math.floor(idx / 8)),
                        selected,
                      );
                    }}
                  >
                    <ChessPiece piece={pieces[idx]} />
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
          )}
          <ActionStrip
            turn={turnConfirmed ? turn : null}
            onTurn={(value) => {
              setTurn(value);
              setTurnConfirmed(true);
            }}
            onAnalyze={analyze}
            disabled={!canAnalyze}
          />
          {result?.boardCrop && (
            <div
              className="board-compare"
              role="group"
              aria-label="Board comparison"
            >
              <button
                aria-pressed={!showOriginal}
                onClick={() => setShowOriginal(false)}
              >
                Recognized board
              </button>
              <button
                aria-pressed={showOriginal}
                onClick={() => setShowOriginal(true)}
              >
                Original screenshot
              </button>
            </div>
          )}
          {notice && (
            <div className="correction-notice" role="status">
              <span>{notice}</span>
              {lastEdit && (
                <button className="text-button" onClick={undoEdit}>
                  Undo correction
                </button>
              )}
            </div>
          )}
          {result?.temporal && (
            <p className="tracking-match">
              Game matched: {result.temporal.moves.join(" ") || "same position"}{" "}
              · turn selected automatically
            </p>
          )}
          <details
            className="review-card"
            open={uncertain.length > 0 || issues.errors.length > 0 || !result}
          >
            <summary>
              {uncertain.length
                ? `${uncertain.length} uncertain squares · tap to edit`
                : result
                  ? `Match ${Math.round(result.meanConfidence * 100)}% · details`
                  : "Scanner details"}
            </summary>
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
              <button className="text-button" onClick={() => setCropOpen(true)}>
                Adjust board crop
              </button>
            </div>
            <label className="setting-row">
              Scanner
              <select
                aria-label="Scanner type"
                value={scannerMode}
                onChange={(event) => {
                  setCrop(undefined);
                  setScannerMode(event.target.value as typeof scannerMode);
                }}
              >
                <option value="auto">Auto</option>
                <option value="duolingo">Duolingo</option>
                <option value="general">General</option>
              </select>
            </label>
            {result && (
              <>
                <div className="confidence-row">
                  <span>Visual match</span>
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
                      ? "Tap any square to change a piece."
                      : "Low match quality. Compare with the original if needed."}
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
                      setShowOriginal(false);

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
            {activeReview.length > 0 && (
              <p className="notice" role="status">
                Extra pieces have weak visual matches. Compare{" "}
                {activeReview.join(", ")} with the original, then choose the
                correct pieces to enable analysis.
              </p>
            )}
            <button
              className="text-button editor-toggle"
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Done editing" : "Edit board & orientation"}
            </button>
          </details>
          {focusedSquare && (
            <Modal
              label={`Edit ${focusedSquare}`}
              onDismiss={() => setFocusedSquare(null)}
            >
              <section className="modal correction-sheet">
                <div className="modal-heading">
                  <h2>{focusedSquare}</h2>
                  <button
                    className="text-button"
                    onClick={() => setFocusedSquare(null)}
                  >
                    Done
                  </button>
                </div>
                {result?.boardCrop && (
                  <div className="square-comparison">
                    <div>
                      <SourceBoard
                        image={image}
                        crop={result.boardCrop}
                        square={focusedSquare}
                        sourceOrientation={result.orientation}
                      />
                      <small>Original</small>
                    </div>
                    <div>
                      <span className="recognized-square">
                        <ChessPiece
                          piece={
                            pieces[
                              (8 - Number(focusedSquare[1])) * 8 +
                                "abcdefgh".indexOf(focusedSquare[0])
                            ]
                          }
                        />
                      </span>
                      <small>Current</small>
                    </div>
                  </div>
                )}
                {report?.tiles.find(
                  (tile) => tile.square === focusedSquare,
                ) && (
                  <div
                    className="piece-suggestions"
                    role="group"
                    aria-label="Suggested pieces"
                  >
                    {report.tiles
                      .find((tile) => tile.square === focusedSquare)!
                      .alternatives.map((option) => (
                        <button
                          key={option.piece}
                          aria-label={`Suggested ${option.piece}`}
                          onClick={() =>
                            applyCorrection(focusedSquare, option.piece)
                          }
                        >
                          {option.piece === "." ? (
                            "Empty"
                          ) : (
                            <ChessPiece piece={option.piece} />
                          )}
                        </button>
                      ))}
                  </div>
                )}
                {report?.tiles.find(
                  (tile) => tile.square === focusedSquare && !tile.agreed,
                ) && (
                  <p className="reader-policy">
                    The experimental second reader disagrees. Compare the
                    original before choosing.
                  </p>
                )}
                <p>Tap a piece to replace this square.</p>
                <div className="piecepalette">
                  {palette.map((piece) => (
                    <button
                      key={piece}
                      aria-label={
                        piece === "."
                          ? "Set square empty"
                          : `Set square to ${piece}`
                      }
                      onClick={() => applyCorrection(focusedSquare, piece)}
                    >
                      {piece === "." ? "×" : <ChessPiece piece={piece} />}
                    </button>
                  ))}
                </div>
              </section>
            </Modal>
          )}
          {editing && (
            <div className="manual-editor">
              <p>Choose a piece, then tap a square to place it.</p>
              <label className="setting-row">
                Board orientation
                <select
                  value={orientation}
                  onChange={(e) => {
                    setOrientation(e.target.value as "white" | "black");
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
                    {p === "." ? "×" : <ChessPiece piece={p} />}
                  </button>
                ))}
              </div>
              <div className="editoractions">
                <button
                  onClick={() => {
                    setLastEdit(null);
                    setNotice("");
                    setPieces(Array(64).fill("."));
                    setManuallyEdited(true);
                    setUncertain([]);
                  }}
                >
                  Clear board
                </button>
                <button
                  onClick={() => {
                    setLastEdit(null);
                    setNotice("");
                    setPieces([...starting]);
                    setManuallyEdited(true);
                    setUncertain([]);
                  }}
                >
                  Starting position
                </button>
                <button
                  onClick={() => {
                    setLastEdit(null);
                    setNotice("");
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
                  }}
                >
                  Swap colors
                </button>
              </div>
            </div>
          )}
          <RecognitionReport
            report={report}
            reconstructionImage={result?.reconstructionImage}
            onExportLabels={
              result?.boardCrop ? () => void exportLabels() : undefined
            }
          />
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
          {(result || manuallyEdited) && issues.errors.length > 0 && (
            <div className="notice" role="alert">
              Position needs correction: {issues.errors.join("; ")}
            </div>
          )}
          {issues.warnings.length > 0 && (
            <div className="recognitionCard">
              Review: {issues.warnings.join("; ")}
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

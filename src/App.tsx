import {
  replayLine,
  statusOfLine,
  ruleStatus,
  savedGame,
  saveGame,
  uciOf,
  claimDraw,
  type GameLine,
  type ClaimReason,
} from "./rules";
import { RecognitionSettings } from "./components/settings/RecognitionSettings";
import { playSound } from "./sound";
import { SoundSettings } from "./components/inputs/SoundControls";
import { validateAnalysisPosition } from "./position";
import { UpdateButton } from "./components/settings/UpdateButton";
import { AppearanceSettings } from "./components/settings/AppearanceSettings";
import { OfflineStatus } from "./components/layout/OfflineStatus";
import { ChessPiece } from "./components/board/ChessPiece";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move } from "chess.js";
import { X } from "lucide-react";
import { ChessEngine, type Variation, type AnalysisLimit } from "./engine";
import { Modal } from "./components/layout/Modal";
import { AppShell } from "./components/layout/AppShell";
import { AppHeader } from "./components/layout/AppHeader";
import { FloatingActions } from "./components/inputs/FloatingActions";
import { HomeScreen } from "./screens/HomeScreen";
import { ScanReviewScreen } from "./screens/ScanReviewScreen";
import { AnalysisScreen } from "./screens/AnalysisScreen";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/themes.css";
function savedPosition() {
  try {
    const value = localStorage.getItem("chesslens-last-position");
    if (value) validateAnalysisPosition(value);
    return value ? new Chess(value).fen() : null;
  } catch {
    return null;
  }
}
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
type AppMode = "home" | "review" | "analysis";
export default function App() {
  const [restoredLine] = useState(savedGame);
  const [restored] = useState(savedPosition);
  const [line, setLine] = useState<GameLine>(
    restoredLine || { rootFen: restored || START, moves: [] },
  );
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanSession, setScanSession] = useState(0);
  const scanRequest = useRef(0);
  const [fenInput, setFenInput] = useState(restored || START),
    [index, setIndex] = useState(restoredLine?.moves.length || 0),
    [selected, setSelected] = useState<string | null>(null),
    [flipped, setFlipped] = useState(false),
    [promote, setPromote] = useState<{ from: string; to: string } | null>(null),
    [error, setError] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [mode, setMode] = useState<AppMode>("home");
  const [variations, setVariations] = useState<Variation[]>([]),
    [engineState, setEngineState] = useState("Loading engine"),
    [depth, setDepth] = useState<AnalysisLimit>(() => {
      try {
        const stored = localStorage.getItem("chesslens-depth");
        return stored === "infinite"
          ? "infinite"
          : [8, 10, 15, 20, 24, 30].includes(Number(stored))
            ? Number(stored)
            : 15;
      } catch {
        return 15;
      }
    }),
    [engineOn, setEngineOn] = useState(false);
  const [settings, setSettings] = useState(false),
    [favoriteFen, setFavoriteFen] = useState<string | null>(() => {
      try {
        return localStorage.getItem("chesslens-favorite");
      } catch {
        return null;
      }
    }),
    [hasPosition, setHasPosition] = useState(!!restoredLine || !!restored),
    [analysisRun, setAnalysisRun] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("chesslens-depth", String(depth));
    } catch {}
  }, [depth]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null),
    engineRef = useRef<ChessEngine | null>(null);
  const board = useMemo(() => replayLine(line, index), [line, index]);
  const fen = board.fen();
  const positionStatus = useMemo(
    () => statusOfLine(line, index),
    [line, index],
  );
  useEffect(() => {
    if (hasPosition) {
      saveGame(line, index);
      try {
        localStorage.setItem("chesslens-last-position", fen);
      } catch {}
    }
  }, [fen, hasPosition, line, index]);
  const moves = useMemo(
    () =>
      selected && !positionStatus.terminal
        ? board.moves({ square: selected as never, verbose: true })
        : [],
    [board, selected, positionStatus.terminal],
  );
  const past = useMemo(
    () =>
      board.history({ verbose: true }).map((move) => {
        const fields = move.before.split(" ");
        return `${fields[5]}${fields[1] === "w" ? "." : "..."} ${move.san}`;
      }),
    [board],
  );
  useEffect(() => {
    const eng = new ChessEngine((lines, status) => {
      setVariations(lines);
      setEngineState(status);
    });
    engineRef.current = eng;
    return () => {
      eng.dispose();
      engineRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (engineOn && mode === "analysis" && visible)
      engineRef.current?.analyze(fen, depth, {
        rootFen: line.rootFen,
        moves: line.moves.slice(0, index),
        ...(line.claim?.ply === index ? { claim: line.claim } : {}),
      });
    else engineRef.current?.stop();
  }, [fen, depth, engineOn, mode, analysisRun, visible, line, index]);
  const move = (m: Move) => {
    if (positionStatus.terminal) return;
    const next = replayLine(line, index);
    next.move(m);
    playSound(
      ruleStatus(next).terminal
        ? "finish"
        : next.isCheck()
          ? "check"
          : m.promotion
            ? "promote"
            : m.captured
              ? "capture"
              : /[kq]/.test(m.flags)
                ? "castle"
                : "move",
    );
    setLine({
      rootFen: line.rootFen,
      moves: [...line.moves.slice(0, index), uciOf(m)],
    });
    setIndex((i) => i + 1);
    setSelected(null);
    setPromote(null);
    setError("");
  };
  const click = (sq: string) => {
    if (promote || positionStatus.terminal) return;
    const piece = board.get(sq as never);
    if (selected) {
      const matching = moves.filter((m) => m.to === sq);
      if (matching.length) {
        if (matching.some((m) => m.promotion)) {
          setPromote({ from: selected, to: sq });
          return;
        }
        move(matching[0]);
        return;
      }
    }
    if (piece?.color === board.turn()) setSelected(sq === selected ? null : sq);
    else setSelected(null);
  };
  const loadFen = (value: string, historyLine?: GameLine) => {
    try {
      validateAnalysisPosition(value.trim());
      const b = new Chess(value.trim());
      if (historyLine) {
        if (replayLine(historyLine).fen() !== b.fen())
          throw Error("Game history does not match this position");
        statusOfLine(historyLine);
      }
      const nextLine = historyLine || { rootFen: value.trim(), moves: [] };
      setLine(nextLine);
      setIndex(nextLine.moves.length);
      setSelected(null);
      setFenInput(b.fen());
      setError("");
      setMode("analysis");
      setHasPosition(true);
      setEngineOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid FEN");
    }
  };
  const file = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Choose an image file.");
      playSound("error");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setError("That image is too big. Choose one under 12 MB.");
      playSound("error");
      return;
    }
    const request = ++scanRequest.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (request !== scanRequest.current) return;
      setScanFile(f);
      setImage(String(reader.result));
      setScanSession(request);
      setMode("review");
      setEngineOn(false);
      setError("");
    };
    reader.onerror = () => {
      if (request === scanRequest.current)
        setError("Couldn’t open that image. Try another screenshot.");
    };
    reader.readAsDataURL(f);
  };
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;
      const pasted = Array.from(event.clipboardData?.files || []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (pasted) {
        event.preventDefault();
        file(pasted);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });
  const copy = async (value: string) => {
    try {
      if (!navigator.clipboard) throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setError("Copied to clipboard");
    } catch {
      setError("Couldn’t copy it. You can select and copy the text instead.");
    }
  };
  const best = variations[0];
  const favorite = favoriteFen === fen;
  const toggleFavorite = () => {
    const value = favorite ? null : fen;
    setFavoriteFen(value);
    try {
      if (value) localStorage.setItem("chesslens-favorite", value);
      else localStorage.removeItem("chesslens-favorite");
    } catch {
      setError(
        "Changed for now, but your browser couldn’t keep it for next time.",
      );
    }
  };
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [mode]);
  useEffect(() => {
    setFenInput(fen);
  }, [fen]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettings(false);
        setPromote(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <AppShell>
      <AppHeader
        home={mode === "home"}
        onBack={() => setMode("home")}
        onMore={() => setSettings(true)}
      />
      <main className="main-content">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            file(e.target.files?.[0]);
            e.target.value = "";
          }}
          hidden
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            file(e.target.files?.[0]);
            e.target.value = "";
          }}
          hidden
        />
        {mode === "home" ? (
          <HomeScreen
            onGallery={() => inputRef.current?.click()}
            onCamera={() => cameraRef.current?.click()}
            onManual={() => {
              setMode("analysis");
              setHasPosition(true);
              setEngineOn(false);
            }}
            recent={hasPosition}
            onRecent={() => setMode("analysis")}
          />
        ) : mode === "review" && image ? (
          <ScanReviewScreen
            key={scanSession}
            image={image}
            file={scanFile}
            onAnalyze={loadFen}
          />
        ) : (
          <AnalysisScreen
            board={{
              board,
              flipped,
              selected,
              moves,
              bestMove:
                engineOn && !positionStatus.terminal ? best?.uci[0] : undefined,
              lastMove: index ? line.moves[index - 1] : undefined,
              onSquare: click,
            }}
            navigation={{
              index,
              length: line.moves.length + 1,
              onNavigate: (i) => {
                setIndex(i);
                setSelected(null);
              },
              onReset: () => loadFen(line.rootFen),
            }}
            engine={{
              variations,
              status: engineState,
              enabled: engineOn && !positionStatus.terminal,
              limit: depth,
              onLimit: setDepth,
              onToggle: () => setEngineOn((v) => !v),
              positionStatus: positionStatus.message,
              terminal: positionStatus.terminal,
            }}
            fenInput={{
              value: fenInput,
              onChange: setFenInput,
              onCopy: () => copy(fen),
              onLoad: () => loadFen(fenInput),
            }}
            onTurn={(turn) => {
              if (turn === board.turn()) return;
              const parts = fen.split(" ");
              parts[1] = turn;
              parts[3] = "-";
              loadFen(parts.join(" "));
            }}
            onAnalyze={() => {
              setEngineOn(true);
              setAnalysisRun((n) => n + 1);
            }}
            onFlip={() => {
              setFlipped((f) => !f);
              setSelected(null);
            }}
            past={past}
            line={line}
            ply={index}
            ruleStatus={positionStatus}
            onClaim={(reason: ClaimReason, intended?: string) => {
              try {
                setLine(claimDraw(line, index, reason, intended));
                setSelected(null);
                setPromote(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Draw claim unavailable",
                );
              }
            }}
          />
        )}
        <OfflineStatus />
        {error && (
          <div className="toast" role="status">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </main>
      {mode !== "home" && (
        <FloatingActions
          onGallery={() => inputRef.current?.click()}
          onCamera={() => cameraRef.current?.click()}
          onMore={() => setSettings(true)}
        />
      )}
      {settings && (
        <Modal label="Settings" onDismiss={() => setSettings(false)}>
          <section
            className="settings modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <h2>Settings & tools</h2>
              <button
                className="icon-button"
                aria-label="Close settings"
                autoFocus
                onClick={() => setSettings(false)}
              >
                <X size={20} />
              </button>
            </div>
            <label className="setting-row">
              Analysis depth
              <select
                value={depth}
                onChange={(e) =>
                  setDepth(
                    e.target.value === "infinite"
                      ? "infinite"
                      : Number(e.target.value),
                  )
                }
              >
                {[8, 10, 15, 20, 24, 30].map((n) => (
                  <option key={n}>{n}</option>
                ))}
                <option value="infinite">∞ Infinite</option>
              </select>
            </label>
            <SoundSettings />
            <AppearanceSettings />
            <RecognitionSettings
              fen={fen}
              line={{
                rootFen: line.rootFen,
                moves: line.moves.slice(0, index),
                ...(line.claim?.ply === index ? { claim: line.claim } : {}),
              }}
            />
            <UpdateButton />
            <button className="secondary" onClick={toggleFavorite}>
              {favorite ? "Remove favorite position" : "Favorite this position"}
            </button>
            {favoriteFen && !favorite && (
              <button
                className="secondary"
                onClick={() => {
                  loadFen(favoriteFen);
                  setSettings(false);
                }}
              >
                Open favorite position
              </button>
            )}
            <button
              className="secondary"
              onClick={() => {
                loadFen(START);
                setSettings(false);
              }}
            >
              Open starting position
            </button>
            <div className="install-help">
              <strong>Keep ChessLens on your Home Screen</strong>
              <p>
                In Safari, tap Share → Add to Home Screen. Open the new icon
                while you’re online and wait for “Ready offline”. You can then
                scan and analyze without internet. If your phone clears the
                download to free up space, tap Retry to get it back.
              </p>
            </div>
            <p className="build-info">
              ChessLens AI 0.10.0 · Stockfish 19
              <br />
              Your screenshots stay on your device.
            </p>
          </section>
        </Modal>
      )}
      {promote && (
        <Modal label="Choose promotion" onDismiss={() => setPromote(null)}>
          <div className="modal">
            <h2>Choose promotion</h2>
            <div className="promotion">
              {["q", "r", "b", "n"].map((p) => (
                <button
                  key={p}
                  aria-label={`Promote to ${p}`}
                  onClick={() => {
                    const next = new Chess(fen);
                    const m = next.move({ ...promote, promotion: p });
                    if (m) move(m);
                  }}
                >
                  <ChessPiece
                    piece={board.turn() === "w" ? p.toUpperCase() : p}
                  />
                </button>
              ))}
            </div>
            <button className="secondary" onClick={() => setPromote(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

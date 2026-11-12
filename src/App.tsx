import { OfflineStatus } from "./components/layout/OfflineStatus";
import { ChessPiece } from "./components/board/ChessPiece";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move } from "chess.js";
import { X } from "lucide-react";
import { ChessEngine, type Variation } from "./engine";
import { Modal } from "./components/layout/Modal";
import { AppShell } from "./components/layout/AppShell";
import { AppHeader } from "./components/layout/AppHeader";
import { FloatingActions } from "./components/inputs/FloatingActions";
import { HomeScreen } from "./screens/HomeScreen";
import { ScanReviewScreen } from "./screens/ScanReviewScreen";
import { AnalysisScreen } from "./screens/AnalysisScreen";
import "./styles/tokens.css";
import "./styles/app.css";
function savedPosition() {
  try {
    const value = localStorage.getItem("chesslens-last-position");
    return value ? new Chess(value).fen() : null;
  } catch {
    return null;
  }
}
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
type AppMode = "home" | "review" | "analysis";
export default function App() {
  const [restored] = useState(savedPosition);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [fenInput, setFenInput] = useState(restored || START),
    [history, setHistory] = useState<string[]>([restored || START]),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [flipped, setFlipped] = useState(false),
    [promote, setPromote] = useState<{ from: string; to: string } | null>(null),
    [error, setError] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [mode, setMode] = useState<AppMode>("home");
  const [variations, setVariations] = useState<Variation[]>([]),
    [engineState, setEngineState] = useState("Loading engine"),
    [depth, setDepth] = useState(15),
    [engineOn, setEngineOn] = useState(false);
  const [settings, setSettings] = useState(false),
    [favoriteFen, setFavoriteFen] = useState<string | null>(() => {
      try {
        return localStorage.getItem("chesslens-favorite");
      } catch {
        return null;
      }
    }),
    [hasPosition, setHasPosition] = useState(!!restored),
    [analysisRun, setAnalysisRun] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null),
    engineRef = useRef<ChessEngine | null>(null);
  const fen = history[index],
    board = useMemo(() => new Chess(fen), [fen]);
  useEffect(() => {
    if (hasPosition) {
      try {
        localStorage.setItem("chesslens-last-position", fen);
      } catch {}
    }
  }, [fen, hasPosition]);
  const moves = useMemo(
    () =>
      selected ? board.moves({ square: selected as never, verbose: true }) : [],
    [board, selected],
  );
  const past = useMemo(() => {
    const b = new Chess(history[0]);
    const labels: string[] = [];
    for (let i = 1; i <= index; i++) {
      const target = history[i];
      const m = b.moves({ verbose: true }).find((m) => {
        const next = new Chess(b.fen());
        next.move(m);
        return next.fen() === target;
      });
      if (!m) break;
      labels.push(`${Math.ceil(i / 2)}${i % 2 ? " ." : " ..."} ${m.san}`);
      b.move(m);
    }
    return labels;
  }, [history, index]);
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
    if (engineOn && mode === "analysis") engineRef.current?.analyze(fen, depth);
    else engineRef.current?.stop();
  }, [fen, depth, engineOn, mode, analysisRun]);
  const move = (m: Move) => {
    const next = new Chess(fen);
    next.move(m);
    setHistory((h) => [...h.slice(0, index + 1), next.fen()]);
    setIndex((i) => i + 1);
    setSelected(null);
    setPromote(null);
    setError("");
  };
  const click = (sq: string) => {
    if (promote) return;
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
  const loadFen = (value: string) => {
    try {
      const b = new Chess(value.trim());
      setHistory([b.fen()]);
      setIndex(0);
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
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setError("Maximum 12 MB image.");
      return;
    }
    setScanFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setMode("review");
      setEngineOn(false);
      setError("");
    };
    reader.onerror = () =>
      setError("This image could not be opened. Choose another image.");
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
      setError("Copy unavailable — select the text manually");
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
      setError("Favorite saved for this session");
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
            key={image}
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
              bestMove: engineOn ? best?.uci[0] : undefined,
              onSquare: click,
            }}
            navigation={{
              index,
              length: history.length,
              onNavigate: (i) => {
                setIndex(i);
                setSelected(null);
              },
              onReset: () => loadFen(history[0]),
            }}
            engine={{
              variations,
              status: engineState,
              enabled: engineOn,
              onToggle: () => setEngineOn((v) => !v),
            }}
            fenInput={{
              value: fenInput,
              onChange: setFenInput,
              onCopy: () => copy(fen),
              onLoad: () => loadFen(fenInput),
            }}
            onTurn={(turn) => {
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
              <select value={depth} onChange={(e) => setDepth(+e.target.value)}>
                {[10, 15, 20, 24].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
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
              <strong>Use from your Home Screen</strong>
              <p>
                In Safari: Share → Add to Home Screen. Open the new icon online
                once and wait for “Ready offline” before disconnecting. iOS may
                clear saved data if storage is low.
              </p>
            </div>
            <p>
              ChessLens AI · Stockfish 19
              <br />
              Screenshot recognition runs on your device.
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

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
export type AppTheme = "system" | "light" | "dark" | "studio";
export type BoardTheme = "classic" | "green" | "walnut" | "lavender" | "slate";
export type PieceStyle = "classic" | "modern" | "outline";
export type Appearance = {
  app: AppTheme;
  board: BoardTheme;
  pieces: PieceStyle;
};
const DEFAULT: Appearance = {
  app: "light",
  board: "classic",
  pieces: "classic",
};
function read(): Appearance {
  try {
    const stored = JSON.parse(
      localStorage.getItem("chesslens-appearance-v1") || "{}",
    );
    return {
      app: ["system", "light", "dark", "studio"].includes(stored.app)
        ? stored.app
        : DEFAULT.app,
      board: ["classic", "green", "walnut", "lavender", "slate"].includes(
        stored.board,
      )
        ? stored.board
        : DEFAULT.board,
      pieces: ["classic", "modern", "outline"].includes(stored.pieces)
        ? stored.pieces
        : DEFAULT.pieces,
    };
  } catch {
    return DEFAULT;
  }
}
const Context = createContext<{
  appearance: Appearance;
  change: <K extends keyof Appearance>(key: K, value: Appearance[K]) => void;
}>({ appearance: DEFAULT, change: () => {} });
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(read);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setSystemDark(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const theme =
      appearance.app === "system"
        ? systemDark
          ? "dark"
          : "light"
        : appearance.app;
    root.dataset.theme = theme;
    root.dataset.board = appearance.board;
    root.dataset.pieces = appearance.pieces;
    root.style.colorScheme = theme === "light" ? "light" : "dark";
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute(
      "content",
      theme === "light"
        ? "#292d27"
        : theme === "studio"
          ? "#252526"
          : "#101611",
    );
    try {
      localStorage.setItem(
        "chesslens-appearance-v1",
        JSON.stringify(appearance),
      );
    } catch {}
  }, [appearance, systemDark]);
  return (
    <Context.Provider
      value={{
        appearance,
        change: (key, value) =>
          setAppearance((old) => ({ ...old, [key]: value })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAppearance = () => useContext(Context);

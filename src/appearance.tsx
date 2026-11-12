import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_APPEARANCE,
  sanitizeAppearance,
  resolveTheme,
  type Appearance,
} from "./appearance-data";
export type {
  AppTheme,
  BoardTheme,
  PieceStyle,
  PieceFinish,
  Appearance,
} from "./appearance-data";
function read(): Appearance {
  try {
    return sanitizeAppearance(
      JSON.parse(localStorage.getItem("chesslens-appearance-v1") || "{}"),
    );
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}
const Context = createContext<{
  appearance: Appearance;
  change: <K extends keyof Appearance>(key: K, value: Appearance[K]) => void;
  apply: (value: Appearance) => void;
}>({ appearance: DEFAULT_APPEARANCE, change: () => {}, apply: () => {} });
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
    const root = document.documentElement,
      theme = resolveTheme(appearance.app, systemDark);
    root.dataset.theme = theme.id;
    root.dataset.board = appearance.board;
    root.dataset.pieces = appearance.pieces;
    root.dataset.finish = appearance.finish;
    root.style.colorScheme = theme.mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.background);
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
        apply: (value) => setAppearance(sanitizeAppearance(value)),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAppearance = () => useContext(Context);

export type AppTheme =
  "system" | "light" | "dark" | "studio" | "royal" | "ocean" | "sunset";
export type BoardTheme =
  | "classic"
  | "green"
  | "walnut"
  | "lavender"
  | "slate"
  | "ocean"
  | "clay"
  | "mono";
export type PieceStyle =
  "classic" | "modern" | "outline" | "staunton" | "geometric" | "rounded";
export type PieceFinish = "ivory" | "porcelain" | "frost" | "brass";
export type Appearance = {
  app: AppTheme;
  board: BoardTheme;
  pieces: PieceStyle;
  finish: PieceFinish;
};
export const APP_THEMES = [
  {
    id: "light",
    name: "Light",
    mode: "light",
    background: "#f5f4ef",
    surface: "#fffefa",
    accent: "#3d614b",
  },
  {
    id: "dark",
    name: "Dark",
    mode: "dark",
    background: "#141c18",
    surface: "#1e2922",
    accent: "#4b7055",
  },
  {
    id: "studio",
    name: "Studio",
    mode: "dark",
    background: "#1b1e24",
    surface: "#242932",
    accent: "#146caa",
  },
  {
    id: "royal",
    name: "Royal",
    mode: "dark",
    background: "#21182d",
    surface: "#2d223c",
    accent: "#8050ab",
  },
  {
    id: "ocean",
    name: "Ocean",
    mode: "dark",
    background: "#10242b",
    surface: "#18353b",
    accent: "#246c79",
  },
  {
    id: "sunset",
    name: "Sunset",
    mode: "light",
    background: "#faf1e8",
    surface: "#fffbf6",
    accent: "#93543c",
  },
] as const;
export const BOARD_THEMES = [
  { id: "classic", name: "Classic", light: "#f0d9b5", dark: "#b58863" },
  { id: "green", name: "Green", light: "#eeeed2", dark: "#769656" },
  { id: "walnut", name: "Walnut", light: "#e5cfaa", dark: "#825c3a" },
  { id: "lavender", name: "Lavender", light: "#eeebf5", dark: "#9b8bb3" },
  { id: "slate", name: "Slate", light: "#dce1e7", dark: "#718096" },
  { id: "ocean", name: "Ocean", light: "#dfefec", dark: "#52828a" },
  { id: "clay", name: "Clay", light: "#f4e0d4", dark: "#c38d78" },
  { id: "mono", name: "Mono", light: "#f0f0f2", dark: "#8e9198" },
] as const;
export const PIECE_STYLES = [
  "classic",
  "modern",
  "outline",
  "staunton",
  "geometric",
  "rounded",
] as const;
export const PIECE_FINISHES = [
  { id: "ivory", name: "Ivory" },
  { id: "porcelain", name: "Porcelain" },
  { id: "frost", name: "Glacier" },
  { id: "brass", name: "Champagne" },
] as const;
export const DEFAULT_APPEARANCE: Appearance = {
  app: "light",
  board: "classic",
  pieces: "classic",
  finish: "ivory",
};
export const THEME_LOOKS: {
  id: string;
  name: string;
  caption: string;
  appearance: Appearance;
}[] = [
  {
    id: "club",
    name: "Classic Club",
    caption: "Warm & familiar",
    appearance: { ...DEFAULT_APPEARANCE },
  },
  {
    id: "midnight",
    name: "Midnight",
    caption: "Slate & glacier",
    appearance: {
      app: "dark",
      board: "slate",
      pieces: "classic",
      finish: "frost",
    },
  },
  {
    id: "matcha",
    name: "Matcha",
    caption: "Fresh greens",
    appearance: {
      app: "light",
      board: "green",
      pieces: "modern",
      finish: "ivory",
    },
  },
  {
    id: "royal",
    name: "Royal",
    caption: "Plum & porcelain",
    appearance: {
      app: "royal",
      board: "lavender",
      pieces: "classic",
      finish: "porcelain",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    caption: "Deep sea blues",
    appearance: {
      app: "ocean",
      board: "ocean",
      pieces: "modern",
      finish: "frost",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    caption: "Clay & champagne",
    appearance: {
      app: "sunset",
      board: "clay",
      pieces: "modern",
      finish: "brass",
    },
  },
];
/** Accept the previous three-field preference and repair invalid or missing fields individually. */
export function sanitizeAppearance(value: unknown): Appearance {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    app: ["system", ...APP_THEMES.map((t) => t.id)].includes(
      input.app as AppTheme,
    )
      ? (input.app as AppTheme)
      : DEFAULT_APPEARANCE.app,
    board: BOARD_THEMES.some((t) => t.id === input.board)
      ? (input.board as BoardTheme)
      : DEFAULT_APPEARANCE.board,
    pieces: PIECE_STYLES.includes(input.pieces as PieceStyle)
      ? (input.pieces as PieceStyle)
      : DEFAULT_APPEARANCE.pieces,
    finish: PIECE_FINISHES.some((t) => t.id === input.finish)
      ? (input.finish as PieceFinish)
      : DEFAULT_APPEARANCE.finish,
  };
}
export function resolveTheme(app: AppTheme, systemDark: boolean) {
  const id = app === "system" ? (systemDark ? "dark" : "light") : app;
  return APP_THEMES.find((t) => t.id === id)!;
}
export function matchingLook(appearance: Appearance) {
  return THEME_LOOKS.find((look) =>
    (Object.keys(DEFAULT_APPEARANCE) as (keyof Appearance)[]).every(
      (key) => look.appearance[key] === appearance[key],
    ),
  );
}

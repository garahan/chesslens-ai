# ChessLens AI v0.9.0 — Duolingo Chess scanner

React / Vite mobile chess position analyzer. The Duolingo-specific screenshot recognition path identifies chessboards with Duolingo's teal grid, matches the distinctive piece silhouettes to lightweight numeric references, handles both board orientations and flags uncertain squares for manual review. A general browser-side ONNX recognizer is available through an explicit General/Auto selection for other chess screenshots. Validated FEN positions are analyzed by Stockfish.

**Recognition 0.8.0:** Duolingo remains the default. Adds background/highlight separation, piece anatomy and size checks, frozen votes from clear matching pieces in the current image, a foreground reconstruction preview, coordinate-based orientation when labels are readable, and selective high-resolution passes for difficult squares. Existing correction learning, game tracking, promotion-aware inference and offline analysis remain available. See [implementation, benchmark and data limits](docs/recognition.md).

**Chess rules 0.9.0:** Legal play preserves the actual move line, including castling rights, en passant, underpromotions and repetition. Strict metadata and pawn-origin checks reject inconsistent setups before Stockfish starts. Checkmate, stalemate, known insufficient material and automatic draws stop play; threefold repetition and the 50-move rule offer explicit claims. History survives offline reopening and tracked scans, and Stockfish receives the recorded moves. See [rules, verification and history limits](docs/chess-rules.md).

**Limits:** the available original and its five transformed variants pass 64/64 squares. They are one training source group, so unseen-image accuracy remains unmeasured. High-resolution bishop/queen examples are still missing. The second reader stays advisory until independent validation; visual match percentages are not accuracy guarantees. Choose the side to move unless a unique tracked game continuation provides it.

### Build

```bash
npm install
npm test
npm run build
```

Vercel: Vite, build `npm run build`, output `dist`.

The source contains numerical Duolingo piece silhouettes, not full screenshots or copyrighted character illustrations. The chess engine uses Stockfish GPLv3. The third-party fenshot package is MIT licensed.

### Mobile UI

The app guides you through **Import → Review → Analyze**, with a purple app bar,
classic cream/brown board, compact engine variations, and camera/gallery shortcuts.
Manual corrections and castling controls live behind secondary controls.
See [UI structure and verification notes](docs/ui-refactor.md) for details and
optional browser checks.

### Offline / iPhone Home Screen

Open once online and wait for **Ready offline** (about 33 MB initially). In Safari use **Share → Add to Home Screen**, then open the new icon online once and wait for **Ready offline** there too. The app, both scanners, and Stockfish work locally without a network connection after download. The current position and its recorded move history are saved on the device. iOS may evict website storage; use Retry if the offline download is incomplete.

### Customize and analyze

**Tools → Appearance** changes app theme (Light/Dark/System/Studio), board colors, and the piece set independently. Classic cream/brown is the default. Next to the engine switch, choose a depth or **∞** for continuous analysis. Infinite analysis pauses while the app is in the background. Settings includes an update check; use **Reload app** when an update is ready.

### Framed Duolingo screenshots

Version 0.6.1 finds the full grid inside borders rather than assuming it spans the image width. Duolingo-looking images no longer silently fall back to the general model when edges are unclear. Use **Adjust board crop** if necessary. Visually close alternatives are checked against king counts, promotion budgets, bishop colors, and no-capture material constraints. Impossible results are rejected before engine analysis; constraints do not invent pieces that lack visual support.

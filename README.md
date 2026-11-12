# ChessLens AI v0.6 — Duolingo Chess scanner

React / Vite mobile chess position analyzer. The Duolingo-specific screenshot recognition path identifies chessboards with Duolingo's teal grid, matches the distinctive piece silhouettes to lightweight numeric references, handles both board orientations and flags uncertain squares for manual review. It falls back to a general browser-side ONNX recognizer for other chess screenshots, then sends a validated FEN to Stockfish.

**Limits:** Duolingo detection is calibrated with six user-provided examples, not independently validated on unseen screenshots or iPhone Safari. A later regression fix verifies all 64 squares in the supplied failing screenshot, adds board-boundary checks and original-square comparison. This does not establish universal accuracy. No computer vision algorithm guarantees 100% accuracy; choose the side to move before analysis; original-image comparison and corrections are available without a verification checkbox.

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
lavender board, compact engine variations, and camera/gallery shortcuts.
Manual corrections and castling controls live behind secondary controls.
See [UI structure and verification notes](docs/ui-refactor.md) for details and
optional browser checks.

### Offline / iPhone Home Screen

Open once online and wait for **Ready offline** (about 33 MB initially). In Safari use **Share → Add to Home Screen**, then open the new icon online once and wait for **Ready offline** there too. The app, both scanners, and Stockfish work locally without a network connection after download. The last position is saved on the device. iOS may evict website storage; use Retry if the offline download is incomplete.

### Customize and analyze

**Tools → Appearance** changes app theme (Light/Dark/System/Studio), board colors, and the piece set independently. Classic cream/brown is the default. Next to the engine switch, choose a depth or **∞** for continuous analysis. Infinite analysis pauses while the app is in the background. Settings includes an update check; use **Reload app** when an update is ready.

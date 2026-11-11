# ChessLens AI v0.5 — Duolingo Chess scanner

React / Vite mobile chess position analyzer. The Duolingo-specific screenshot recognition path identifies chessboards with Duolingo's teal grid, matches the distinctive piece silhouettes to lightweight numeric references, handles both board orientations and flags uncertain squares for manual review. It falls back to a general browser-side ONNX recognizer for other chess screenshots, then sends a validated FEN to Stockfish.

**Limits:** Duolingo detection is calibrated with six user-provided examples, not independently validated on unseen screenshots or iPhone Safari. A later regression fix verifies all 64 squares in the supplied failing screenshot, adds board-boundary checks and original-square comparison. This does not establish universal accuracy. No computer vision algorithm guarantees 100% accuracy; the app requires review of the board and confirmation of the side to move.

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
cream board, compact engine variations, and camera/gallery shortcuts.
Manual corrections and castling controls live behind secondary controls.
See [UI structure and verification notes](docs/ui-refactor.md) for details and
optional browser checks.

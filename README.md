# ChessLens AI v0.4
An iPhone-first chessboard screenshot reader with browser-side AI piece recognition, position correction, and Stockfish 19 analysis.

## Commands
```bash
npm install
npm test
npm run build
npm run dev
```

## Deploy
Import this repository into Vercel, select Vite, build `npm run build`, output `dist`. The build copies Stockfish and ONNX assets from installed npm packages to public directories. Validate the actual build logs and scanner/engine behavior before treating the release as production-ready.

## Limitations
AI recognition is optimized for flat screenshots. Castling rights, en passant, and side to move may need manual selection. Stockfish is GPLv3; @scoriiu/fenshot is MIT-licensed. No screenshots leave the browser.

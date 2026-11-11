# ChessLens AI UI refactor

The app now opens at import, then guides the user through board review and analysis. `src/main.tsx` bootstraps React; `src/App.tsx` owns position history, engine lifecycle, image inputs, and screen selection. Screen layouts live in `src/screens`, reusable UI in `src/components`, and all visual tokens in `src/styles/tokens.css`.

## Behavior

- Gallery, camera capture, and clipboard image imports enter review and start recognition automatically. Images remain in the browser.
- Review requires an explicitly selected turn, no unresolved uncertain squares, a valid position, and board confirmation. Changing pieces, orientation, turn, or castling clears confirmation.
- Uncertain-square chips highlight and scroll to the board. Approving preserves the piece; editing uses the secondary piece palette. Low-confidence scans remain in review.
- Analysis retains legal moves, promotion selection, first/previous/next/last navigation, board flip, editable FEN, and three real Stockfish variations. Engine work stops outside analysis.
- Settings hold depth, favorites, and starting position. Native dialogs contain keyboard focus, support Escape, and restore focus on close.
- Header, theme metadata, cards, and board colors use the supplied purple / cream palette. Buttons have 44px minimum targets (board cells scale with the board), safe-area padding, and reduced-motion handling. Favorite moves into settings on small screens.
- The engine label is Stockfish 19 to match the installed engine, rather than the example Stockfish 16 label.

## Validation

Run `npm ci`, `npm test`, and `npm run build`. For the optional browser checks, install Python Playwright and Chromium, start `npm run dev`, then run `python tests/ui_flow.py`. The script writes ignored screenshots to `artifacts/`. It uses a controlled scanner response for repeatable uncertain-square review checks; chess moves and Stockfish are real.

Additional manual browser validation exercised the real ONNX scanner in development and production preview. It returned a low-confidence, invalid result for a generated board screenshot; review displayed the correction issues and prevented analysis. Recognition accuracy is unchanged by this refactor and requires separate calibration with real screenshots. A small Vite middleware fix allows ONNX's dynamically imported public runtime module to load during development.

Checked portrait widths: 375, 390, and 430px, plus 768px. These are Chromium emulations; physical iPhone Safari and native camera capture have not been tested. Camera input has `capture="environment"`, and the browser test verifies that the camera button opens that input.

No original reference screenshot was attached to this request, so visual implementation follows the written specification.

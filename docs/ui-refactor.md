# ChessLens AI UI refactor

The app now opens at import, then guides the user through board review and analysis. `src/main.tsx` bootstraps React; `src/App.tsx` owns position history, engine lifecycle, image inputs, and screen selection. Screen layouts live in `src/screens`, reusable UI in `src/components`, and all visual tokens in `src/styles/tokens.css`.

## Behavior

- Gallery, camera capture, and clipboard image imports enter review and start recognition automatically. Images remain in the browser.
- Review requires an explicitly selected turn, no unresolved uncertain squares, a valid position, and board confirmation. Changing pieces, orientation, turn, or castling clears confirmation.
- Uncertain-square chips highlight and scroll to the board. Approving preserves the piece; editing uses the secondary piece palette. Low-confidence scans remain in review.
- Analysis retains legal moves, promotion selection, first/previous/next/last navigation, board flip, editable FEN, and three real Stockfish variations. Engine work stops outside analysis.
- Settings hold depth, favorites, and starting position. Native dialogs contain keyboard focus, support Escape, and restore focus on close.
- Header, theme metadata, cards, and board colors use a coordinated purple / lavender palette. Buttons have 44px minimum targets (board cells scale with the board), safe-area padding, and reduced-motion handling. Favorite moves into settings on small screens.
- The engine label is Stockfish 19 to match the installed engine, rather than the example Stockfish 16 label.

## Validation

Run `npm ci`, `npm test`, and `npm run build`. For the optional browser checks, install Python Playwright and Chromium, start `npm run dev`, then run `python tests/ui_flow.py`. The script writes ignored screenshots to `artifacts/`. It uses a controlled scanner response for repeatable uncertain-square review checks; chess moves and Stockfish are real.

Additional manual browser validation exercised the real ONNX scanner in development and production preview. It returned a low-confidence, invalid result for a generated board screenshot; review displayed the correction issues and prevented analysis. This general-scanner result still requires manual review; the later Duolingo-specific correction is described below. A small Vite middleware fix allows ONNX's dynamically imported public runtime module to load during development.

Checked portrait widths: 375, 390, and 430px, plus 768px. These are Chromium emulations; physical iPhone Safari and native camera capture have not been tested. Camera input has `capture="environment"`, and the browser test verifies that the camera button opens that input.

No original reference screenshot was attached to this request, so visual implementation follows the written specification.

## Duolingo screenshot recognition correction

The supplied regression screenshot exposed a crop offset of two ranks. The old detector could discard mismatched bottom ranks and select a later checkerboard row. It also sampled each tile's background from one corner, so a small crop/resampling offset could make entire empty squares appear occupied.

The detector now scores all eight ranks and all files, checks both side borders at three heights per tile, and aligns to the strongest actual top transition. Tile backgrounds use a median of border samples. Distinct piece labels determine confidence margins, and invalid placements cannot be marked reliable. Board-only square crops are now supported as well as full-screen images.

Review now has an Original screenshot / Recognized board comparison. Tapping a square shows the original cropped pixels alongside the recognized piece, with a direct piece picker for corrections. This provides a way to verify exact input without treating recognition confidence as a guarantee.

The original supplied screenshot reads 64/64 squares correctly, including both kings and the highlighted white knight. Its placement is `4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R`. Turn and castling rights still require the user to confirm them. Resized, JPEG-recompressed, dimmer, and brighter variants also match. These are regression tests of one source image, not an independent accuracy benchmark.

`tests/fixtures/duolingo-regression.json` stores only numerical tile signatures. The original screenshot and player artwork are not committed. For the complete local regression, run `DUOLINGO_TEST_IMAGE=/path/to/original.jpg python tests/duolingo_browser.py` while the dev server runs. The test checks actual recognition, original-board comparison, direct corrections, Analyze gating, and real Stockfish output.

## Unified piece and board styling

All rendered pieces now use one original SVG set with matching silhouettes, bases, outlines, and ivory/plum fills. The same component is used in analysis, review, correction pickers, promotion, and home artwork. Lavender squares, coordinated coordinates, selection states, and purple move arrows complete the palette. Vector rendering avoids platform-dependent chess font shapes. Recognition and source-image pixels are unchanged. Build, browser flow, and exact-screenshot regression checks pass.

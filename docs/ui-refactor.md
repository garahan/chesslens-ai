# ChessLens mobile workspace

The app uses Import → Review → Analyze. `src/App.tsx` owns screen selection, saved position, image inputs, history, and the engine lifecycle. Screen layouts and reusable components are separate; `src/styles/tokens.css` holds visual tokens.

## Compact phone layout

The header is 48 CSS pixels plus the system safe area. It has Home, branding, and tools; there is no app Share button. The board is first, with move navigation and one-tap White/Black turn controls directly below. Analyze is beside the turn buttons. Image, Camera, and Tools stay in a bottom dock, with space reserved so they do not cover the board or analysis. Common controls have at least 44px tap targets; board squares scale with the board. The board adapts to viewport height as Safari's browser controls reduce available space.

FEN, history, castling, and scanner diagnostics are secondary expandable tools. Tapping a square opens a bottom correction sheet with the original tile and a piece picker. One piece tap applies the correction and closes the sheet. There is no verification checkbox or required uncertainty-approval step. A valid placement and explicit turn are required; uncertainty remains visible as useful information.

A shared original SVG set renders pieces in analysis, review, correction controls, promotion, and home artwork. Ivory/plum pieces and lavender squares match the purple header. Source-image pixels and recognition features are independent of display styling.

## Offline and home-screen installation

Open the app online and wait for **Ready offline**. The production service worker downloads the shell, all built JavaScript/CSS, the model, ONNX runtime, and Stockfish JavaScript/WASM. No remote API is needed for recognition or analysis. In Safari, use the browser's Share → Add to Home Screen, then open the installed icon online once and wait for Ready offline there (iOS may use separate app storage). The manifest includes PNG icons and an Apple touch icon; safe-area padding supports standalone mode.

The initial offline download is about 33 MB. Readiness is checked against actual cache entries. If it is interrupted or assets are missing, the app shows **Offline download incomplete** and Retry can repair the cache. Versioned caches update with each build; the previous cache is retained so an already-open version can finish using its assets. Development mode does not register a worker. The last valid position is saved locally; imported photos are not persisted or uploaded.

Offline operation requires a completed first online visit. Safari/iOS can evict website storage, so offline availability is not permanent. Preview deployment authentication must be completed before the initial download. The app does not disable deployment protection.

## Recognition regression

The supplied Duolingo screenshot exposed a two-rank crop offset and contaminated single-corner background samples. The detector now scores the full eight-rank checkerboard, aligns to the actual top edge, and estimates backgrounds from median border samples. Distinct piece labels determine match margins; invalid placements cannot be marked reliable. Both full-screen images and board-only crops work.

The supplied screenshot reads 64/64 squares correctly: `4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R`. Resized, recompressed, dimmer/brighter, cropped, and alternate board-orientation variants also matched. This is regression evidence for one image, not a universal accuracy guarantee. Only numerical foreground signatures are committed, not the screenshot or player artwork.

## Verification

Run `npm ci`, `npm test`, and `npm run build`.

Optional browser checks use Python Playwright and system Chromium:

- Start `npm run dev`, then run `python tests/ui_flow.py` for moves, navigation, FEN, engine controls, and direct corrections without a verification gate.
- Set `DUOLINGO_TEST_IMAGE=/path/to/original.jpg` and run `python tests/duolingo_browser.py` for the supplied image regression.
- Build, run `npm run preview -- --port 4173`, then `DUOLINGO_TEST_IMAGE=/path/to/original.jpg python tests/mobile_offline.py` for production offline caching, a cold offline reopen, saved-position recovery, real Stockfish, general ONNX and Duolingo recognition, and missing-cache repair.

Portrait viewports checked: 375×667, 393×852, 402×874, 430×932, and 402×724. Core analysis stays above the dock without scrolling or overlap. These are browser emulations; physical iPhone Safari and native camera capture have not been tested. Icons, safe areas, and standalone metadata are implemented without assuming an unverified hardware-specific screen size.

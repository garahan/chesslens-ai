# ChessLens mobile workspace

The app uses Import → Review → Analyze. `src/App.tsx` owns screen selection, saved position, image inputs, history, and the engine lifecycle. Screen layouts and reusable components are separate; `src/styles/tokens.css` holds visual tokens.

## Compact phone layout

The header is 52 CSS pixels plus the system safe area. It has branding, a sound toggle, settings, and a Home button outside the home screen; there is no app Share button. The board and move navigation share one card, with one-tap White/Black turn controls directly below. Analyze is beside the turn buttons. Image, Camera, and Tools stay in a floating bottom dock, with space reserved so they do not cover the board or analysis. Common controls have at least 44px tap targets; board squares scale with the board. The board adapts to viewport height as Safari's browser controls reduce available space.

FEN, history, castling, and scanner diagnostics are secondary expandable tools. Tapping a square opens a bottom correction sheet with the original tile and a piece picker. One piece tap applies the correction and closes the sheet. There is no verification checkbox or required uncertainty-approval step. A valid placement and explicit turn are required; uncertainty remains visible as useful information.

A shared original SVG set renders pieces in analysis, review, correction controls, promotion, and home artwork. Classic cream/brown squares and ivory/charcoal pieces sit in a warm neutral and forest-green interface; Dark and Studio use the same layout with their own surface tokens. Source-image pixels and recognition features are independent of display styling.

## Version 0.10: visual polish and sounds

Component styles are consolidated into one layout sheet with theme-only color tokens. The home artwork uses the same pieces and board colors as the app. Disclosure rows, forms, navigation, cards, and bottom sheets share consistent borders, spacing, and corner sizes. The board highlights the last played move; uncertain tiles and checked kings remain distinct. Correction palettes keep six White pieces on one row, six Black pieces on the next, and a full-width Empty square action. The build number lives in settings.

Web Audio synthesizes quiet tap, move, capture, castling, check, promotion, game-end, scan, correction and error cues locally. There are no sound downloads and no microphone access. The first trusted pointer or keyboard gesture unlocks audio; loading the page does not. Header and settings mute controls share a persisted preference. Muting stops scheduled tones immediately, and hidden pages suppress playback. Unsupported or blocked audio does not interrupt chess. Device mute settings and browser audio policies still apply; physical iPhone audio testing remains outstanding.

`tests/sound.test.mjs` covers lazy initialization, saved mute state, immediate stopping, subscriptions, background suppression and unavailable APIs/storage. `tests/design_sound_browser.py` uses real Chromium AudioContext nodes to check move tones, synchronized controls, preview, resume after suspension, and silence while muted/backgrounded. It checks all three app themes at five portrait sizes, including control sizes and engine/dock overlap. The production offline test checks sound generation after a cold offline reopen.

## Version 0.11: coordinated looks and custom finishes

Tools now starts with a gallery of six coordinated looks: Classic Club, Midnight, Matcha, Royal, Ocean and Sunset. Each miniature uses the actual scoped palette, board colors and piece shapes/finish; choosing a preset updates all four preferences together. Exact selection matching changes to “Your own mix” when a single detail differs. The settings close button stays visible while the sheet scrolls.

“Make it your own” exposes six app palettes plus System, eight boards, three piece shapes and four finishes (Ivory, Porcelain, Glacier and Champagne). Studio remains available. App, board, shape and finish are independent; System only follows the phone’s light/dark palette. Walnut includes a subtle grain, Royal uses a serif wordmark, and warnings, evaluations, highlights and notices follow their palettes. No remote fonts, images or other theme downloads are required.

Existing three-field appearance preferences retain their values and gain the default Ivory finish. Invalid fields recover individually. All new choices are restored before React starts, including browser theme color and color scheme. The same versioned local preference works after an offline cold reopen. Scanner pixels and models are unchanged.

`tests/appearance.test.mjs` covers migration, invalid preferences, exact preset identity and System behavior. `tests/creative_themes_browser.py` checks all six looks at five portrait sizes, independent customization, nested preview accuracy, persistence, reset, System changes, migration and pre-React restoration. It checks computed UI text/controls at 4.5:1 and board labels at 4.5:1; each white/black piece must have at least a 3:1 fill or outline contrast against both square colors for all eight boards and four finishes. This is targeted contrast coverage, not a complete accessibility certification. The production offline test uses a Royal/Green/Modern/Glacier custom mix.

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

## Version 0.6: appearance, search limits, and updates

Classic cream/brown squares are now the default. Tools → Appearance independently selects the app theme (Light, Dark, Studio, or the system setting), board palette (Classic, Green, Walnut, Lavender, Slate), and vector piece set (Classic, Modern, Outline). Choices persist locally, work offline, and apply before the first React paint. Studio uses an editor-inspired charcoal/blue palette. The home-screen icon now uses charcoal, ivory, and gold.

Turn selection uses larger pawn-backed White/Black controls with a clear selected border and arrow-key support. Selecting the already-active turn does not reset history. The depth selector is directly beside the engine switch: 8, 10, 15, 20, 24, 30, or ∞. Infinite sends the actual UCI `go infinite` command, not a large finite depth. Limits persist across reloads; moving the app into the background stops the worker and returning resumes analysis if enabled.

The Duolingo path now samples each source tile directly at five subpixel offsets and aggregates distinct-label scores. Stable, high-quality agreement can resolve a marginal warning; conflicting or genuinely close matches stay uncertain. The percentage is labeled Visual match rather than implying statistical accuracy. The existing supplied regression and resized/JPEG/brightness/cropped/opposite-orientation variants still match all 64 squares. This does not establish universal 100% accuracy or independently validate every new screenshot.

Installed apps check for updates on focus/resume and show Reload app when a new worker takes control. Settings also offers an explicit update check and displays version 0.6. Service-worker cache versions include the worker template; per-asset hashes allow unchanged model/engine files to be reused during future updates. An integration test verifies the reload prompt and zero repeat downloads of unchanged large assets.

Additional checks: `python tests/themes_depth.py` against the dev server (default port 5175; BASE_URL can override) exercises every appearance option, preference persistence, system color changes, real infinite/bounded search, background pause/resume, and four portrait widths. `python tests/offline_updates.py` serves the production build to verify worker upgrades and cache reuse. The production offline test now also verifies saved themes and infinite analysis after a cold offline reopen. Physical iPhone Safari remains untested.

## Version 0.6.1: Duolingo routing and material constraints

A framed screenshot can cause the previous full-width detector to miss the board and route Duolingo pieces to the general model. The new detector collects horizontal grid periods, estimates candidate x/size geometries, scores all eight ranks/files and the outside edges, then refines the crop. Thin, wide, and asymmetric framing are covered by tests. A Duolingo-palette image whose grid cannot be found requests crop adjustment instead of silently invoking the incompatible model.

The tile recognizer retains per-label scores. A bounded beam search considers only close visual alternatives; it enforces king counts, pawn/rank limits, total piece counts, and necessary promotion budgets. Extra bishops are accounted for by square color. If all 32 pieces remain, promotion-dependent interpretations are impossible because promotion requires a pawn to pass an opposing pawn, which requires a capture somewhere. Extra promoted pieces remain permitted when material allows them. Confident empty tiles cannot become invented kings. Constraint-adjusted cells remain uncertain, and infeasible/unfamiliar matches return a recovery state rather than a fabricated board. This is a bounded candidate search, not proof of a unique historical chess position.

The general model's structurally impossible outputs are also rejected before display. A failed scan shows the original image. Adjust board crop offers a draggable square and keyboard-accessible position/size sliders; explicit Duolingo mode bypasses general recognition. No verification checkbox was added. Match quality is calculated over occupied cells, so easy empty cells do not inflate it.

Analysis entry points and the Stockfish wrapper validate material and reject a position where the side that just moved remains in check. Stockfish itself is unchanged; it calculates from the supplied FEN, not from screenshot pixels.

Tests added: `tests/duolingo-grid.test.mjs`, `tests/scanner-constraints.test.mjs`, `tests/framed_recognition.py`, and `tests/scanner_recovery.py`. Five framed versions of the earlier available original matched all 64 squares and used the Duolingo recognizer. An excessively framed input explicitly requested recovery and matched 64/64 after crop selection. A mocked impossible general-model result was rejected before board display/analysis. The newest chat-only screenshot was visually inspected but was not exposed to the test workspace; it is not part of these automated accuracy claims. No universal accuracy percentage is asserted. The header displays 0.6.1 so users can distinguish the deployed fix from stale copies.

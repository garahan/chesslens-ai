# Recognition upgrades — 0.8.0

The flow stays **Import → Review → Analyze**. Images, corrections, game history, inference and Stockfish stay on the device. No vision API key or server is required.

## Five implemented paths and their limits

1. **Native-resolution piece references.** A 48×48 foreground library supplements the existing 12×12 signatures with bounded shape/color evidence. The available verified original supplies 17 references covering empty, pawns, knights, rooks and kings in both colors. Native bishop/queen examples are still missing; those classes retain their legacy references. Upscaling old signatures is not counted as new evidence.
2. **Joint crop and piece selection.** Up to three distinct checkerboard alignments are evaluated using full-board visual evidence and chess material constraints. Invalid candidates cannot win by having a slightly better grid score. Difficult crops offer manual adjustment and diagnostics instead of an invented board.
3. **Private correction learning.** Tools → Recognition → Learn corrections enables a bounded, versioned local profile. Correcting a square saves its numerical foreground, not the original screenshot. Corrections can be undone; Reset clears references; switching learning off stops both learning and using references. Personal influence is deliberately bounded so an accidental correction cannot dominate arbitrary future scans.
4. **Opt-in game tracking.** Analyze a known-correct position, then choose Track this position in Tools. A later screenshot is compared with zero, one or two legal half-moves from that anchor, in both orientations. A unique visual match preserves turn, castling, en passant and move counters. Weak, ambiguous, stale, unrelated or truncated searches fall back to ordinary recognition. The anchor advances only after Analyze accepts a matched board. New game clears it.
5. **Experimental offline second reader.** A small trained tanh/softmax network supplies a different decision function and exposes disagreements. It was trained on 26 legacy signatures whose original grouping is incomplete. Its activations are not calibrated probabilities; agreement does not increase reliability, and the network cannot override the primary reader. Independent source-group validation is required before promoting it beyond advisory use.

Original-square comparison, suggested alternatives, correction Undo, a downloadable diagnostic report and proposed-label export live in secondary controls. No verification checkbox or share button was added.

## Reproducible checks

```bash
npm test
npm run build
python tests/benchmark_manifest.py
# Run npm run dev in another terminal, then:
BASE_URL=http://127.0.0.1:5173 python tests/recognition_upgrades.py
python scripts/recognition-benchmark.py --base-url http://127.0.0.1:5173
```

Browser checks require Python Playwright and system Chromium. The benchmark needs the private original at `artifacts/duolingo-original.jpg`, or `DUOLINGO_TEST_IMAGE`. Private images are intentionally absent from Git.

The available original plus five JPEG/size/frame variants produce **6/6 exact boards, 384/384 squares** on both 0.6.1 and 0.7.0 in desktop Chromium. They are one training source group, not six independent tests. Independent accuracy is therefore **unmeasured**. Local desktop median timing was approximately 42 ms before and 280–334 ms after adding readers/candidates across local runs; these are development measurements, not iPhone performance claims. See the [recorded regression report](../benchmarks/results/v0.7.0-regression.json) for per-case rejection, confusion, crop overlap and timing measurements.

## Adding real data without leaking it into evaluation

1. Keep the untouched original. Import it in the app; correct every square against the image. Recognition report → Export current board labels saves proposed labels with a SHA-256 source ID, dimensions, crop and orientation. Export never marks predictions as verified.
2. Independently inspect every label and crop. All crops, recompressions and variants of the same original must retain the same `sourceGroup`. Add originals with bishops, queens, highlights, both orientations, device sizes and light/dark Duolingo versions.
3. Import locally after checking the labels:

```bash
python scripts/add-benchmark-case.py original.png labels.json --split train --verified
# Use validation/test for genuinely held-out originals instead of train.
python scripts/build-piece-library.py
python scripts/recognition-benchmark.py --base-url http://127.0.0.1:5173
```

Raw originals go to ignored `benchmarks/raw/`; only metadata and numerical references belong in Git. The builder reads verified training groups only. The manifest rejects source groups crossing splits and training groups reused as validation/test. Automatic transformations inherit the original group. Legacy training provenance remains incomplete, so reports leave independently validated accuracy unset even if new held-out examples are added, until that provenance is resolved.

`python scripts/train-second-reader.py` deterministically rebuilds the experimental legacy model. Its reported training accuracy is diagnostic only. A production-quality replacement needs new verified original groups, a separately held-out test set, per-class confusion analysis and confidence/rejection calibration before changing the advisory policy.

## Verification scope

Automated coverage includes original recognition, bordered crops, impossible-board rejection, local profile opt-out/Undo/reset/storage failures, legal tracking and special moves, ambiguous and bounded-search rejection, mobile corrections and exports, real Stockfish output, and production offline cold reopen. Browser tests use Chromium with phone-sized viewports. Physical iPhone Safari and the newest screenshots visible only in chat have not been independently tested.

## 0.7.1: queen/rook confusion and the default scanner

Each import now starts in **Duolingo** mode, including an identical image reimported after General mode. Non-Duolingo images require an explicit General or Auto selection. A scan session changes only when the latest image finishes decoding, so a stale file-reader callback cannot pair one file with another preview.

The primary matcher aligns every numerical reference over ±1 pixel on the 12×12 grid, with a 0.007 penalty per translation step. Previously, a one-pixel vertical shift could turn a queen into a rook. The synthetic alignment regression now passes **216/216**, versus **161/216** with the previous classifier; queen/rook cases improve from **41/72 to 72/72**. These are transformed training references, not unseen screenshots. The original image and five size/frame variants still pass 64/64 each. [Recorded screenshot regression](../benchmarks/results/v0.7.1-regression.json) and [alignment regression](../benchmarks/results/v0.7.1-alignment.json).

An incomplete native library cannot cast a vote against a close competing class that has no native references. This prevents native rook examples from unfairly displacing legacy queen matches. Verified personal references retain their bounded influence.

Board inference minimizes `sum(tile visual distances) + 0.055 × minimum required promotions`, subject to existing hard chess constraints. Candidate labels remain within 0.04 of the local visual winner; very clear matches remain fixed. The small material prior prefers a close ordinary queen interpretation over three rooks requiring an unobserved promotion. It never simply limits rooks to two: clear promoted material remains valid, and a queen without visual support is never invented. Crop ranking now includes the selected labels' costs rather than the rejected local winners' costs.

If the best interpretation still contains extra material with weak visual evidence, the affected squares remain highlighted and Analyze stays disabled until those pieces are explicitly chosen or corrected. Choosing the already displayed rook is sufficient when it really is a promoted rook. Undo restores the review requirement; correcting a queen so the surplus disappears also clears that material requirement. There is no verification checkbox.

Additional checks: `tests/duolingo_defaults.py` covers explicit General selection, repeated imports, focused extra-rook review and Undo. Structural tests reproduce the reported three-rook material pattern, prefer its close queen candidate, preserve a clear true third rook, and request review when no defensible queen candidate exists. The newest chat image shows the app's recognized board, not the original Duolingo pixels, and is not mounted as a new source fixture; no claim is made that its exact pixel input has been validated. Physical iPhone Safari remains untested.

## 0.8.0: staged visual evidence

- **Background separation:** coarse and fine readers share one extractor. Multiple background colors must be supported on multiple square edges, allowing a board/highlight split and gentle shadows to be suppressed without treating a piece or coordinate glyph as background. Small isolated corner ink is excluded from the piece mask while central or connected piece details are retained. This cannot restore pixels hidden under an opaque overlay.
- **Piece anatomy and size:** difficult squares use aspect-preserving bounding-box normalization plus head roundness, directional slit/edge energy, asymmetry, crown peaks, upper crossbar width and fill. Descriptors are compared with the existing Duolingo references rather than rules about another piece set. Influence is bounded; clear matches are not overridden by these cues.
- **Within-image agreement:** frozen strong, occupied seeds vote only for sufficiently similar same-color shapes and visually close labels. Conflicting labels abstain, weak predictions cannot become new seeds, and nothing persists between images unless correction learning was separately enabled. No row or material-count assumption labels pieces as pawns.
- **Reconstruction:** the chosen board is rendered as a 384×384 foreground silhouette image using native numerical templates or other clear squares. A square never supplies its own live reference. Unsupported classes are hatched and excluded from residual coverage. Significant mismatches receive extra processing or remain uncertain. Empty-square error uses unexplained ink area so a single JPEG speck does not count as a whole-piece disagreement. This is a shape comparison, not a pixel-perfect recreation of Duolingo artwork or an independently calibrated validator.
- **Coordinates:** a small offline glyph reader supports file/rank labels inside square corners and just outside the bottom/left edge. At least five distinct positions in a consistent sequence are required. Missing, clipped, tiny or contradictory labels abstain. Reliable coordinates take precedence over the layout heuristic; a conflict with a matched tracked game rejects the scan for review. Raw label readings and the orientation source appear in diagnostics. Turn remains user-selected unless a unique legal tracked continuation supplies it; clock or character appearance is not treated as proof of turn.
- **Selective work:** clear squares take a single primary pass. At most sixteen squares per board alignment receive extra subpixel samples, 48-pixel threshold variants and anatomy/size checks. Reconstruction can request one bounded retry and exclude suspect seeds. Over-budget difficult squares stay uncertain. With at most three candidate alignments, work stays bounded; this is not a physical-iPhone speed guarantee.

All added processing runs offline and adds no model download or external OCR service. The diagnostic preview stays behind Recognition report; JSON report export excludes image and foreground arrays. The main board and controls retain their compact layout.

New checks: `tests/visual-evidence.test.mjs` covers background/highlight invariance, one-edge ink, size/aspect preservation, anatomy-assisted queen/rook decisions, frozen/conflicting/color-safe voting, self-reference exclusion, missing-template coverage, JPEG speck tolerance and coordinate abstention. `tests/visual_evidence_browser.py` checks four supported coordinate direction/layout combinations, three abstention/conflict cases, coordinate precedence/tracking conflicts, staged processing, reconstruction rendering, complete scans with labels inside the board, and compressed real-image regressions. The original takes no extra passes; half-size JPEG quality 0.30 and 0.12 copies remain exact, use bounded extra work, and keep unresolved squares visible. A quality 0.05 copy requests recovery instead of returning a board. These are variants of one known source, not independent accuracy evidence. Production offline tests also exercise the reconstruction preview.

The final six-case screenshot regression is recorded in [v0.8.0-regression.json](../benchmarks/results/v0.8.0-regression.json). It remains one source group; independent screenshot accuracy is unmeasured.

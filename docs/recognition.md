# Recognition upgrades — 0.7.0

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

The available original plus five JPEG/size/frame variants produce **6/6 exact boards, 384/384 squares** on both 0.6.1 and 0.7.0 in desktop Chromium. They are one training source group, not six independent tests. Independent accuracy is therefore **unmeasured**. Local desktop median timing was approximately 42 ms before and 280–334 ms after across local runs the additional readers/candidates; these are development measurements, not iPhone performance claims. See the [recorded regression report](../benchmarks/results/v0.7.0-regression.json) for per-case rejection, confusion, crop overlap and timing measurements.

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

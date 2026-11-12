# Performance — 0.12.0

The production entry bundle went from 475.18 kB (148.13 kB gzip) in 0.11 to 329.90 kB (104.19 kB gzip), about 31% less JavaScript initially parsed. This is a build-size comparison, not a claim of 31% faster page loads on every phone.

The review screen and Duolingo recognizer load on image import. The general ONNX integration loads only when General/Auto needs it. The runtime remains reusable across scans. The offline builder still precaches every generated chunk, so deferred code remains available after a completed offline download. That download still includes the models and engine; total offline data is not reduced.

Board and piece components skip renders when their inputs have not changed, reducing SVG reconciliation during Stockfish updates. Legal move targets use a set rather than repeatedly searching the move list for each square. Position status reuses the already replayed board instead of replaying the same history a second time; draw-claim verification retains its independent validation path.

No recognition thresholds, image passes, model precision, engine depth or chess rules were reduced. CPU-heavy image recognition remains local and can still take time on slower devices. A failed deferred scanner download shows a recoverable message without removing the surrounding navigation.

Verification uses the existing chess-rule, scanner, UI and production offline browser flows. Physical iPhone timing and independent image-recognition benchmarks remain outstanding.

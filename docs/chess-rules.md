# Chess rules and position history — 0.9.0

ChessLens is a position scanner and analyzer. It now retains a root FEN plus legal UCI moves rather than repeatedly rebuilding the game from the latest FEN. This preserves rights and repetition history in board navigation, branching, local storage, Stockfish requests and accepted tracked screenshot continuations.

## Legal moves

The pinned chess.js 1.4.0 rules implementation handles ordinary movement, captures, checks, pins, discovered checks, king safety, both castles, en passant and all four promotion choices. A king cannot move into check or be captured. Castling cannot pass through check, start in check or jump occupied squares; moving a king or rook and capturing the original rook removes the appropriate rights permanently. En passant is available only immediately after the relevant double pawn advance, and cannot expose the capturing king. The move picker includes queen, rook, bishop and knight promotions.

## Position validation

Before analysis, raw six-field FEN is checked before normalization can discard malformed metadata. Validation rejects duplicate kings, adjacent kings, back-rank pawns, excess material and impossible promotion budgets. Bishop square colors count toward the required promotions; extra rooks, bishops or knights are legal when supported by missing pawns and possible captures, so they are not banned categorically.

A bitmask assignment matches remaining pawns to distinct original files. Their minimum required captures cannot exceed missing opposing pieces. The side that just moved must not still be in check. More than two checkers, or two pawn/knight checkers, are rejected as impossible last-move results.

Each stated castling right requires the correct king and rook on their original squares. En passant metadata requires an empty target, the proper opposing pawn after a double push, its empty starting square and a zero halfmove clock. The immediate predecessor is reconstructed and the stated double advance must be legal. A pinned en passant opportunity can be recorded in imported FEN without making the capture legal.

These are necessary consistency checks, not proof that every composed position is reachable from the standard initial position. Root counters may describe a composed analysis setup; the app does not reconstruct an entire missing game from them.

## Outcomes and claims

- Checkmate stops play and takes precedence over the 75-move counter.
- Stalemate and known insufficient mating material stop play automatically. This uses chess.js's material rules; it does not attempt to solve every possible blocked-position deadness case. Two knights against a lone king are not automatically declared dead.
- Five occurrences of the same position and 150 consecutive halfmoves without a pawn move or capture trigger the automatic fivefold and 75-move draws.
- Three occurrences and 100 such halfmoves are claimable draws, not automatic game endings. Claims are available under **Position tools & history → Chess rules & draw claims**.
- A claim can also declare a legal intended move that would establish the repetition or 50-move condition. The claim ends the line without actually playing that move.

Repetition compares pieces, side to move, castling rights and _legal_ en passant availability. A pinned or unavailable en passant capture does not make otherwise equal positions different. Draw claims and automatic endings survive reopening. Navigating to an earlier ply permits a new branch; branching discards later moves and claims. Reopening restores the selected prefix.

Stockfish receives the root plus recorded moves, so its search has the same available history. Terminal positions do not start an engine worker. Engine principal variations are truncated at the first illegal move before display.

## Screenshot and history limits

A still image does not establish whether a king or rook previously moved, whether the last pawn move was a double advance, the halfmove clock or earlier repetitions. New independent scans therefore start with no castling rights, no en passant target and a fresh clock/history. Advanced position options allow explicit rights, target and counters when known. A unique tracked legal continuation preserves known metadata and history; editing pieces clears historical rights and counters, and Undo restores them.

FEN loading creates a new analysis root and resets earlier repetition history. This release does not add PGN import, game clocks, resignation, draw agreement or tournament arbiter procedures. Chess constraints improve rejection of recognition mistakes but do not prove the screenshot was read correctly.

## Verification

`tests/chess-rules.test.mjs` covers special-move metadata, king safety, castling restrictions and lost rights, en passant expiry and pins, underpromotion, pawn-origin capture budgets, check/mate/stalemate/material outcomes, claimable versus automatic draws, intended-move claims, persistence, engine history and legal PV filtering. Move generation is checked against reference perft totals: initial position depth 3 = 8,902; Kiwipete depth 2 = 2,039; en passant endgame depth 3 = 2,812.

`tests/recognition.test.mjs` checks tracked continuations preserve the full line and draw history. `tests/chess_rules_browser.py` exercises claims, reload/navigation/branching, real Stockfish analysis, castling, en passant, underpromotion, terminal UI and scanner metadata controls on a mobile viewport. `tests/mobile_offline.py` checks saved move history after an offline cold reopen, along with local recognition and Stockfish. These tests use Chromium; they do not substitute for testing on a physical iPhone.

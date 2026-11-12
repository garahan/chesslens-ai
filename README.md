# ChessLens AI

I’m building ChessLens to make checking a chess position on my phone easier. Pick a screenshot, fix any pieces the scanner missed, and let Stockfish help you work out what to play next.

Duolingo is the default scanner. If your screenshot comes from another chess app or website, you can switch to **General** in the scan details.

## Give it a try

1. Tap **Choose image**, or open the camera.
2. Check the board. Tap any square if a piece needs changing.
3. Choose whose turn it is and tap **Analyze**.

If the board looks cropped or shifted, try **Adjust board crop**. You can also set up a position yourself or paste a FEN.

## A few things I wanted in here

- A board that’s easy to see and buttons that are easy to reach on a phone.
- Stockfish 19 analysis, with a depth limit or **∞** if you want to keep it thinking.
- Six ready-made looks: Classic Club, Midnight, Matcha, Royal, Ocean, and Sunset. Or mix eight boards, six piece styles, and four finishes yourself.
- Soft sounds for moves, captures, checks, and scans. The speaker button at the top mutes them, and there’s a preview in settings.
- Offline scanning and analysis, with your position and moves saved on your device.
- Optional learning from your corrections and tracking between screenshots of the same game.

Castling, en passant, promotions, checks, and draw rules are handled too. A screenshot can’t tell us whether a king already moved or what happened on the previous turn, so those details need to come from you or the recorded game. They’re under **Advanced position options** when you need them.

## Pick your look

Open **Tools → Make it yours** for a preview of each look. One tap changes the app, board, and pieces together. **Make it your own** lets you change them separately, including Studio colors and a setting that follows your phone’s light or dark mode. Your choices stay saved, even offline. **Reset appearance** takes you back to the classic look.

## Put it on your Home Screen

In Safari, tap **Share → Add to Home Screen**. Open the new icon while you’re online and wait for **Ready offline**. The first download is about 33 MB; after that, scanning and Stockfish can run without a connection.

Your images stay on your device. iOS can clear website storage when space is low, so check the offline status before relying on it without internet. **Retry** downloads anything missing.

## What still needs work

Recognition is the part I’m working on most. It can still mix up pieces, so give the board a quick look before analyzing. The match percentage is a visual score, not a promise that every square is right.

The original test screenshot and its five edited versions all pass, but they come from the same image. That’s a useful check, not enough to claim near-perfect results on everyone’s screenshots. There’s more detail in the [recognition notes](docs/recognition.md) and [chess rules notes](docs/chess-rules.md).

## Run it locally

You’ll need Node.js 22.18 or newer.

```bash
npm install
npm run dev
```

To run the checks and make a production build:

```bash
npm test
npm run build
npm run preview
```

It’s built with React, TypeScript, and Vite. On Vercel, use `npm run build` and the `dist` output folder. More UI and browser testing notes are in [docs/ui-refactor.md](docs/ui-refactor.md).

## Credits

Analysis runs on [Stockfish](https://stockfishchess.org/) (GPLv3). The general scanner uses `@scoriiu/fenshot` (MIT), and move handling uses `chess.js`. The repo includes numerical piece references, not full Duolingo screenshots or character artwork. This is an independent project, not an official Duolingo app.

import type { GameLine } from "../../rules";
import { useState } from "react";
import {
  readLearning,
  resetLearning,
  setLearningEnabled,
} from "../../recognition/learning";
import {
  getTrackedGame,
  trackPosition,
  stopTracking,
} from "../../recognition/tracking";
export function RecognitionSettings({
  fen,
  line,
}: {
  fen: string;
  line?: GameLine;
}) {
  const [profile, setProfile] = useState(readLearning),
    [game, setGame] = useState(getTrackedGame),
    [message, setMessage] = useState("");
  return (
    <section className="recognition-settings">
      <h3>Scanning</h3>
      <div className="setting-row">
        <span>Remember my corrections</span>
        <button
          className="switch"
          role="switch"
          aria-label="Learn from corrections"
          aria-checked={profile.enabled}
          onClick={() => {
            if (setLearningEnabled(!profile.enabled)) {
              setProfile(readLearning());
              setMessage("");
            } else setMessage("Your browser couldn’t save this. Try again.");
          }}
        >
          <span />
        </button>
      </div>
      <p>
        {profile.samples.length} saved example
        {profile.samples.length === 1 ? "" : "s"}. Corrections stay on this
        device. Changed your mind? Tap Undo after an edit.
      </p>
      <button
        className="secondary"
        onClick={() => {
          const cleared = resetLearning();
          setProfile(readLearning());
          setMessage(
            cleared
              ? "Saved corrections cleared"
              : "Your browser couldn’t save this. Try again.",
          );
        }}
      >
        Reset learned corrections
      </button>
      <div className="tracking-tools">
        <strong>
          {game ? "Following this game" : "Keep track of the same game"}
        </strong>
        <p>
          Start from a board you’ve checked. The next screenshot can follow one
          move from each player, so you won’t need to choose the turn again when
          there’s a clear match. Stop tracking when you switch games.
        </p>
        <button
          className="secondary"
          onClick={() => {
            try {
              if (trackPosition(fen, line)) {
                setGame(getTrackedGame());
                setMessage("Tracking from this position");
              } else setMessage("Your browser couldn’t save this. Try again.");
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Invalid position",
              );
            }
          }}
        >
          {game ? "Track from current position" : "Track this position"}
        </button>
        {game && (
          <button
            className="text-button"
            onClick={() => {
              if (stopTracking()) {
                setGame(null);
                setMessage("Game tracking cleared");
              } else setMessage("Your browser couldn’t save this. Try again.");
            }}
          >
            New game · stop tracking
          </button>
        )}
      </div>
      <p className="reader-policy">
        The extra piece check is still a work in progress. Give the board a
        quick look before analyzing.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

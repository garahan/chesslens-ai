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
      <h3>Recognition</h3>
      <div className="setting-row">
        <span>Learn corrections on this device</span>
        <button
          className="switch"
          role="switch"
          aria-label="Learn from corrections"
          aria-checked={profile.enabled}
          onClick={() => {
            if (setLearningEnabled(!profile.enabled)) {
              setProfile(readLearning());
              setMessage("");
            } else setMessage("Device storage is unavailable");
          }}
        >
          <span />
        </button>
      </div>
      <p>
        {profile.samples.length} saved tile references. Images stay on your
        device. Undo is available after teaching a correction.
      </p>
      <button
        className="secondary"
        onClick={() => {
          const cleared = resetLearning();
          setProfile(readLearning());
          setMessage(
            cleared
              ? "Saved corrections cleared"
              : "Device storage is unavailable",
          );
        }}
      >
        Reset learned corrections
      </button>
      <div className="tracking-tools">
        <strong>
          {game ? "Game tracking is on" : "Track consecutive screenshots"}
        </strong>
        <p>
          Choose a known-correct position once. The next scan can match up to
          two half-moves, including special moves. Start a new game to clear the
          anchor.
        </p>
        <button
          className="secondary"
          onClick={() => {
            try {
              if (trackPosition(fen, line)) {
                setGame(getTrackedGame());
                setMessage("Tracking from this position");
              } else setMessage("Device storage is unavailable");
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
              } else setMessage("Device storage is unavailable");
            }}
          >
            New game · stop tracking
          </button>
        )}
      </div>
      <p className="reader-policy">
        Second reader: experimental offline model. Agreement does not certify
        accuracy; independent validation data is still limited.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

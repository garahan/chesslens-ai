import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getSoundEnabled,
  subscribeSound,
  setSoundEnabled,
  primeAudio,
  playSound,
} from "../../sound";
const useSound = () =>
  useSyncExternalStore(subscribeSound, getSoundEnabled, () => true);
function toggleSound(enabled: boolean) {
  setSoundEnabled(!enabled);
  if (!enabled) {
    primeAudio();
    playSound("tap");
  }
}
export function SoundButton() {
  const enabled = useSound();
  return (
    <button
      className="icon-button sound-button"
      data-sound="off"
      aria-label={enabled ? "Mute sounds" : "Unmute sounds"}
      aria-pressed={enabled}
      title={enabled ? "Mute sounds" : "Unmute sounds"}
      onClick={() => toggleSound(enabled)}
    >
      {enabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
    </button>
  );
}
export function SoundSettings() {
  const enabled = useSound();
  return (
    <section className="sound-settings">
      <div className="setting-row">
        <span className="setting-with-icon">
          <Volume2 size={18} /> <strong>Sound effects</strong>
        </span>
        <button
          className="switch"
          data-sound="off"
          role="switch"
          aria-label="Sound effects"
          aria-checked={enabled}
          onClick={() => toggleSound(enabled)}
        >
          <span />
        </button>
      </div>
      <p>
        Soft sounds for moves, captures, and scans. You can mute them anytime.
      </p>
      <button
        className="text-button sound-preview"
        data-sound="off"
        disabled={!enabled}
        onClick={() => {
          primeAudio();
          playSound("scan");
        }}
      >
        Try the sound <Volume2 size={15} />
      </button>
    </section>
  );
}

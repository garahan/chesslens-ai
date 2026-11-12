export type SoundCue =
  | "tap"
  | "move"
  | "capture"
  | "castle"
  | "check"
  | "promote"
  | "finish"
  | "scan"
  | "place"
  | "error";
type Tone = [number, number, number, number, OscillatorType?, number?];
const cues: Record<SoundCue, Tone[]> = {
  tap: [[430, 0, 0.035, 0.18, "sine", 290]],
  move: [
    [190, 0, 0.085, 0.65, "triangle", 85],
    [1150, 0, 0.025, 0.08],
  ],
  capture: [
    [145, 0, 0.12, 0.7, "triangle", 65],
    [310, 0.012, 0.065, 0.22, "sine", 160],
  ],
  castle: [
    [190, 0, 0.075, 0.55, "triangle", 90],
    [240, 0.08, 0.08, 0.45, "triangle", 105],
  ],
  check: [
    [660, 0, 0.095, 0.3],
    [880, 0.105, 0.12, 0.24],
  ],
  promote: [
    [523.25, 0, 0.12, 0.3],
    [659.25, 0.08, 0.13, 0.27],
    [783.99, 0.16, 0.16, 0.24],
  ],
  finish: [
    [523.25, 0, 0.16, 0.28],
    [659.25, 0.13, 0.17, 0.25],
    [783.99, 0.26, 0.22, 0.23],
  ],
  scan: [
    [659.25, 0, 0.12, 0.24],
    [880, 0.105, 0.17, 0.22],
  ],
  place: [[250, 0, 0.065, 0.4, "triangle", 120]],
  error: [[185, 0, 0.12, 0.22, "sine", 145]],
};
const KEY = "chesslens-sound-v1";
const listeners = new Set<() => void>();
let enabled: boolean | undefined;
let context: AudioContext | null = null;
let master: GainNode | null = null;
let lastTap = -Infinity;
const voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
export function getSoundEnabled() {
  if (enabled === undefined) {
    try {
      enabled = localStorage.getItem(KEY) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** Only called inside a user gesture to unlock audio on Safari. No sound on load. */
export function primeAudio() {
  if (!getSoundEnabled() || typeof window === "undefined") return;
  try {
    const Audio =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Audio) return;
    if (!context || context.state === "closed") {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    }
    if (context.state !== "running") void context.resume().catch(() => {});
  } catch {
    /* Audio restrictions must never interrupt chess. */
  }
}
export function stopSounds() {
  if (context && master) {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
  }
  for (const voice of voices) {
    try {
      voice.oscillator.stop();
    } catch {}
    voice.oscillator.disconnect();
    voice.gain.disconnect();
  }
  voices.clear();
}
export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem(KEY, value ? "on" : "off");
  } catch {}
  if (!value) stopSounds();
  listeners.forEach((listener) => listener());
}
/** Synthesized locally: no downloads, microphone, or network. */
export function playSound(cue: SoundCue) {
  if (
    !getSoundEnabled() ||
    !context ||
    !master ||
    context.state !== "running" ||
    (typeof document !== "undefined" && document.hidden)
  )
    return;
  const now = context.currentTime;
  if (cue === "tap" && now - lastTap < 0.045) return;
  if (cue === "tap") lastTap = now;
  try {
    if (voices.size > 12) stopSounds();
    master.gain.setValueAtTime(0.16, now);
    for (const [
      frequency,
      delay,
      duration,
      volume,
      type = "sine",
      endFrequency,
    ] of cues[cue]) {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      const start = now + delay,
        end = start + duration;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency)
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(master);
      const voice = { oscillator, gain };
      voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        voices.delete(voice);
      };
      oscillator.start(start);
      oscillator.stop(end + 0.015);
    }
  } catch {
    /* Keep the app usable when the device refuses audio. */
  }
}

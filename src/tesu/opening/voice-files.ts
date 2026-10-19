// Which of her voice files the build has (lane D encodes the approved takes into public/audio/opening as
// voice-<n>.opus + .m4a): found at build time, as the game finds its drawings, so a missing one is never fetched.
// Kept apart from voice.ts so node's checks (which have no import.meta.glob) never load it.

export const VOICE_FILES: readonly number[] = Object.keys(import.meta.glob("/public/audio/opening/voice-*.opus"))
  .map((k) => Number(/voice-(\d+)\.opus$/.exec(k)?.[1] ?? NaN))
  .filter((n) => Number.isFinite(n))
  .sort((a, b) => a - b);

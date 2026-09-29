// The Hollow's one shared pulse: a colossus crossing far above. The market's
// footfall prop (footfalls.ts, next to this file) keeps the clock and
// calls `footfall()` on every thud; the backdrops' ceiling grit reads the
// same counter, so the specks falling in the far haze, the grit sifting in
// the player's plane, the swaying lamps and the thud all land together.
//
// Module state on purpose: the prop and the backdrop live in the same page
// and the same frame loop, and nothing here is saved.

export interface Pulse {
  /** Footfalls so far (a new value = a new thud). */
  n: number;
  /** Strength of the last one, 0..1 (the crossing swells and fades). */
  strength: number;
  /** performance.now() of the last one. */
  at: number;
}

export const PULSE: Pulse = { n: 0, strength: 0, at: -1e9 };

export function footfall(strength: number): void {
  PULSE.n++;
  PULSE.strength = strength;
  PULSE.at = performance.now();
}

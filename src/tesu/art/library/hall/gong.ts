// The gong's frame count and its frame for a strike (env-hall's, moved out of court.ts unchanged by the engine's perf
// pass so the court's game code can read it without loading the hall's painters; court.ts re-exports both).

export const GONG_FRAMES = 12;

/** The gong's frame for ticks (60/s) since the strike (negative or none: at rest). */
export function gongFrame(ticks: number | null): number {
  if (ticks === null || ticks < 0) return 0;
  const f = 1 + Math.floor(ticks / 5);
  return f < GONG_FRAMES ? f : 0;
}

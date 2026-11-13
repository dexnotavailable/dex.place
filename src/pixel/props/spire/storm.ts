// The spire's storm: one gust program shared by everything up there, and the
// live values the pieces read. No recipe lives in this file (the registry
// skips it); it is imported by the spire's recipes (pennants, the lamp that
// swings, the alcove glass), the spire rooms' storm driver (the gust decks
// that push the player) and the spire backdrops (the rain that leans).
//
// The gust cycle (WORLD-PLAN section 4, D2): 6 s calm, then a 3 s gust that
// pushes 0.5 H/s outward along the ledges (east: the storm's wind blows the
// way the runtime's wind, the rain and the kit's cloth already lean), toward
// each catwalk's lip or the machinery at its end, never off it. The tell
// starts 1.4 s before the gust: pennants snap and lift, the rain starts to
// lean, the warning lights quicken. So a gust is always telegraphed at least
// 1 s ahead (the tell is past half strength 1.1 s before the push starts).
//
// One clock. The backdrop's scene clock (its time uniform) is the master: the
// storm backdrop publishes it every frame (StormClock below, a points layer
// that draws nothing), and the rain GLSL computes the same program from the
// same number, so the rain angle and the push can never drift apart (hitstop
// slows the simulation, not the backdrop). Pieces that run without a storm
// backdrop (the /props/ sandbox) fall back to their own world time.

export const GUST = {
  /** Seconds per cycle, of which `calm` are calm. */
  period: 9,
  calm: 6,
  /** Tell lead before the push (s). */
  lead: 1.7,
  /** Push ramp up / hold / ramp down inside the gust (s). */
  rise: 0.45,
  fall: 0.75,
  /** Push at full gust, H per second (outward = -x). */
  push: 0.5,
  /** Direction of the push and of the lean (+1 = east, with the runtime's wind). */
  dir: 1 as -1 | 1,
} as const;

export interface GustState {
  /** 0..1 how hard the gust pushes now. */
  level: number;
  /** 0..1 the warning: rises through the lead, stays up through the gust. */
  tell: number;
  /** Seconds into the cycle. */
  phase: number;
}

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The gust program at time t (seconds). */
export function gustAt(t: number): GustState {
  const g = GUST;
  const ph = ((t % g.period) + g.period) % g.period;
  const on = ph - g.calm;
  const len = g.period - g.calm;
  const level = on < 0 ? 0 : smooth(0, g.rise, on) * (1 - smooth(len - g.fall, len, on));
  const tell = Math.max(level, on < 0 ? smooth(g.calm - g.lead, g.calm - 0.1, ph) : 1 - smooth(len - 0.35, len, on));
  return { level, tell, phase: ph };
}

/** The same program in GLSL (for backdrop layers: pass uTime). */
export const GUST_GLSL = /* glsl */ `
float gsmooth(float a, float b, float v) { float t = clamp((v - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
// x: push level 0..1, y: tell 0..1, z: seconds into the cycle
vec3 gustAt(float t) {
  float ph = mod(t, ${GUST.period.toFixed(1)});
  float on = ph - ${GUST.calm.toFixed(1)};
  float len = ${(GUST.period - GUST.calm).toFixed(2)};
  float level = on < 0.0 ? 0.0 : gsmooth(0.0, ${GUST.rise.toFixed(2)}, on) * (1.0 - gsmooth(len - ${GUST.fall.toFixed(2)}, len, on));
  float tell = max(level, on < 0.0 ? gsmooth(${(GUST.calm - GUST.lead).toFixed(2)}, ${(GUST.calm - 0.1).toFixed(2)}, ph) : 1.0 - gsmooth(len - 0.35, len, on));
  return vec3(level, tell, ph);
}
`;

/**
 * Live values, one per page (only the current room simulates, so one storm is
 * live at a time). Written by the storm clock (scene time) and the rooms'
 * storm driver (lightning, the save's lit shrines); read by the recipes.
 */
export const STORM = {
  /** Master clock: the storm backdrop's scene seconds, and the frame it was last written. */
  sceneT: 0,
  clockFrame: -1,
  /** Frames counted by the driver (to tell a live clock from a stale one). */
  frame: 0,
  /** Lightning flash level this tick (0..1), from the world's weather. */
  flash: 0,
  /** Current gust (from the master clock, or a fallback clock). */
  gust: { level: 0, tell: 0, phase: 0 } as GustState,
  /** 0..1 the storm's strength where the player is (1 in the storm, 0 once the Blade has cleared). */
  strength: 0,
  /** The six shrines, lit or not, from the save (the Blade's lamp points). */
  lit: [false, false, false, false, false, false] as boolean[],
  /** The arena is summoning (warning lights go red). */
  arena: false,
  /**
   * The player (feet, px/s) and the rain, from the storm driver: the director
   * feeds them to the room's pixel world (its actors, view and rain), so
   * puddles ring under her steps and the moss on the Blade parts round her.
   */
  player: { x: 0, y: 0, vx: 0, fresh: false },
  rain: 0,
  reduced: false,
};

/**
 * The spire lift, published by its car (rooms/spire/lift.ts) every tick: room
 * y of its platform, and whether it is running. The counterweight reads it.
 */
export const LIFT = { y: 0, live: false, moving: false };

/** Called by the storm clock (a backdrop points layer) every frame with the scene's seconds. */
export function publishClock(t: number): void {
  STORM.sceneT = t;
  STORM.clockFrame = STORM.frame;
}

/** Is the backdrop's clock live (written within the last few driver frames)? */
export function clockLive(): boolean {
  return STORM.clockFrame >= 0 && STORM.frame - STORM.clockFrame <= 3;
}

/** The gust now: from the live master clock, else from `fallback` seconds (a sandbox, a room without the storm backdrop). */
export function gustNow(fallback: number): GustState {
  return clockLive() ? gustAt(STORM.sceneT) : gustAt(fallback);
}

// Shared pieces for region B's backdrops (lane R-B): reed-shallows (B1),
// causeway (B2 with B3 and B4) and hollow-mouth (B5).
//
// - The colossus, from colossus-plain/colossus.ts, reused unchanged: a
//   crossing helper, and the body shader with a wider body-space clip so the
//   rear knees (which poke past x 300 when a rear foot trails) are never sliced
//   by a hard vertical line (bodyGlsl), plus Tracker extents to match.
// - The walk feed: a points system that publishes the backdrop's clock and its
//   colossi (the same ColossusDef the shaders use) to a module-level feed, so
//   the room's controller (src/world/rooms/plain/keeper.ts) can find each
//   footfall with the walk's TypeScript twin in step with what is drawn.
// - Moving ring ripples on water: every planted foot throws a small ring at
//   its foot, and once per pass one plant of the weight leg throws a big ring
//   that races across the whole water to the player plane (the "wash").
//   Computed in GLSL from the same walk numbers, so no engine change.
// - Spray and drips where a wading colossus's feet leave and enter water.
// - Far landmarks shared by the plain: the ring behind (west) and the spire
//   with its storm ahead (east).
// - Vertical rooms: GLSL camY() (the world's uCamY inside the runtime, a
//   fixed reference framing in /scenes/), ground planes that re-map their rows
//   when the camera rises, and a splitter for wide depth-1 art.

import { EXTENT, LEGS, animTime, colossusGlsl, foot, legList, loopTime, type BodyOpts, type ColossusDef } from "../colossus-plain/colossus.ts";
import { f, Pix, rowRef, type LayerDef, type PointSystem } from "../../engine/index.ts";
import type { LightOut, PointSink, SimEnv } from "../../engine/types.ts";

// ------------------------------------------------------------------------------------
// the colossus

/** Body-space extent used for the clip and the tracker (EXTENT.x1 was 300 and sliced the rear knees mid-stride; R-A raised it to 380; the plain keeps a margin past that). */
export const EXT: [number, number] = [EXTENT.x0 - 10, 430];

/** The colossus body shader with the wider clip (see EXT). Throws if colossus.ts changes shape. */
export function bodyGlsl(c: ColossusDef, o: BodyOpts): string {
  const src = colossusGlsl(c, o);
  const from = `q.x > ${f(EXTENT.x1)}`;
  if (!src.includes(from)) throw new Error("causeway/shared: colossusGlsl's body clip changed; update bodyGlsl");
  return src.replace(from, `q.x > ${f(EXT[1])}`);
}

export interface CrossingOpts {
  S: number;
  vd: number;
  gap: number;
  startAt: number;
  T: number;
  seed: number;
  dendrites: boolean;
  /** Where its feet stand (layer y). */
  ground: number;
}

/** A crossing that starts with the head just off the right edge and ends with the tail off the left. */
export function crossing(W: number, reach: [number, number], o: CrossingOpts): ColossusDef {
  const [lx, rx] = reach;
  const x0 = rx - EXTENT.x0 * o.S;
  const xEnd = lx - (EXT[1] + 40) * o.S;
  const cross = (x0 - xEnd) / (o.vd * o.S);
  return {
    S: o.S,
    ground: o.ground,
    x0,
    period: cross + o.gap,
    t0: (x0 - o.startAt * W) / (o.vd * o.S),
    vd: o.vd,
    T: o.T,
    duty: 0.64,
    lift: 22,
    bob: 3,
    legs: LEGS,
    far: { dx: 18, dy: 6, phase: 0.5, scale: 0.84 },
    dendrites: o.dendrites,
    seed: o.seed,
  };
}

// ------------------------------------------------------------------------------------
// the walk feed (backdrop clock -> the room's controller)

export interface FeedColossus {
  /** Which one: "main" (the near walker) or "ghost". */
  name: string;
  c: ColossusDef;
  depth: number;
  /** Layer x window where the weight leg's plant throws the big ring (one per pass). */
  pass: [number, number];
}

export interface Feed {
  /** Scene seconds (the backdrop's clock, what the shaders see as uTime). */
  t: number;
  reduced: boolean;
  /** performance.now() of the last update: a stale feed means the backdrop isn't live. */
  at: number;
  W: number;
  span: number;
  walkers: FeedColossus[];
}

/** One feed per scene title; only the current room's backdrop updates, so only it is fresh. */
export const FEEDS: Record<string, Feed> = {};

/** Not drawn: publishes the backdrop clock and its colossi every update. */
export class WalkClock implements PointSystem {
  constructor(
    private scene: string,
    private walkers: FeedColossus[],
  ) {}
  update(_dt: number, env: SimEnv): void {
    FEEDS[this.scene] = { t: env.t, reduced: env.reduced, at: performance.now(), W: env.ctx.W, span: env.ctx.span, walkers: this.walkers };
  }
  draw(_sink: PointSink): void {}
}

/** The big ring's travel: ground px per depth unit (lateral px at depth 1) and speed in ground px/s. */
export const RING = { F: 1300, V: 3600 };

/** Seconds (anim time) from a plant at depth d0 until its big ring reaches the player plane. */
export function washDelay(d0: number): number {
  return ((d0 - 1) * RING.F) / RING.V;
}

export interface Plant {
  /** Leg index in legList order (0 = the near weight leg). */
  leg: number;
  far: boolean;
  /** Layer x of the planted foot at its depth. */
  x: number;
  /** The one plant per pass whose big ring crosses the water. */
  big: boolean;
}

/**
 * Tracks a colossus's legs through the walk's TypeScript twin: call with the
 * scene clock each tick; returns the feet that planted since the last call.
 */
export class PlantWatch {
  private last: number[];
  private legs: ReturnType<typeof legList>;
  constructor(private w: FeedColossus) {
    this.legs = legList(w.c);
    this.last = this.legs.map(() => Number.NaN);
  }
  step(t: number, reduced: boolean): Plant[] {
    const c = this.w.c;
    const tl = loopTime(c, animTime(t, reduced));
    const out: Plant[] = [];
    this.legs.forEach(({ hx, phase, far }, i) => {
      const st = foot(c, tl, phase, hx);
      const prev = this.last[i]!;
      this.last[i] = st.n;
      // a new cycle is a new plant (the loop wrap happens off screen, skip it)
      if (Number.isNaN(prev) || st.n !== prev + 1) return;
      const x = st.x * c.S;
      const big = i === 0 && x >= this.w.pass[0] && x < this.w.pass[1];
      out.push({ leg: i, far, x, big });
    });
    return out;
  }
  /** Layer x of the body origin now (for "is it passing"). */
  bodyX(t: number, reduced: boolean): number {
    const c = this.w.c;
    const tl = loopTime(c, animTime(t, reduced));
    return (c.x0 / c.S - c.vd * tl) * c.S;
  }
}

/** The pass window for a walker: one stride of the weight leg centred on layer x `at`. */
export function passWindow(c: ColossusDef, at: number): [number, number] {
  const stride = c.vd * c.T * c.S;
  return [at - stride / 2, at + stride / 2];
}

// ------------------------------------------------------------------------------------
// GLSL: camera height, walk rings

/**
 * camY(): the camera's row in room px. In the world runtime this is uCamY
 * (the backdrop's vertical factor is 1 in these rooms); in /scenes/ it is the
 * fixed reference framing the scene is authored at.
 */
export function camYGlsl(inWorld: boolean, ref: number): string {
  return inWorld ? `float camY() { return uCamY; }` : `float camY() { return ${f(ref)}; }`;
}

/**
 * footRings(wx, depth, rowK): ring ripples from the colossi's feet at a water
 * point. wx is the ground's lateral coordinate there ((layer x - W/2) * depth,
 * the same everywhere the camera pans); rowK is the water's rows from the
 * horizon to the player plane (G - horizon), so a ring stays a row or two
 * thick however flat the far rows are. Returns (small rings, big ring front, big ring trough).
 */
export function ringsGlsl(walkers: FeedColossus[], W: number): string {
  const legs = walkers.map((w) => ({ w, legs: legList(w.c) }));
  const body = legs
    .map(({ w, legs }, wi) => {
      const c = w.c;
      return `
  {
    float tl = mod(ta + ${f(c.t0)}, ${f(c.period)});
    ${legs
      .map(({ hx, phase }, i) => {
        const big = wi === 0 && i === 0;
        return `
    {
      float cyc = tl / ${f(c.T)} + ${f(phase)};
      float n = floor(cyc);
      float age = (cyc - n) * ${f(c.T)};
      float plant = (${f(c.x0 / c.S)} - ${f(c.vd)} * (n - ${f(phase)}) * ${f(c.T)} + ${f(hx)} - ${f(c.vd * c.duty * c.T * 0.5)}) * ${f(c.S)};
      float X0 = (plant - ${f(W / 2)}) * ${f(w.depth)};
      float dz = (depth - ${f(w.depth)}) * ${f(RING.F)};
      float dist = length(vec2(wx - X0, dz));
      // a small ring at the foot
      float rs = (6.0 + age * 55.0) * ${f(c.S)} * ${f(w.depth)};
      // at least ~1.5 screen rows thick, however flat the rows are at this depth
      float ws = max((1.2 + 0.5 * depth) + 1.5 * ${f(w.depth)}, 1.5 * depth * depth * ${f(RING.F)} / rowK);
      float es = abs(dist - rs);
      if (age < 2.6 && es < ws) small = max(small, (1.0 - age / 2.6) * (1.0 - es / ws));
      ${
        big
          ? `if (plant >= ${f(w.pass[0])} && plant < ${f(w.pass[1])}) {
        float rb = age * ${f(RING.V)};
        float wb = max(2.0 * depth + 7.0, 2.2 * depth * depth * ${f(RING.F)} / rowK);
        float e = dist - rb;
        float fade = 1.0 - smoothstep(0.0, ${f(c.T)}, age);
        if (e > -wb && e < wb * 0.6) front = max(front, fade * (1.0 - abs(e + wb * 0.2) / wb));
        if (e < -wb && e > -wb * 5.0) trough = max(trough, fade * (1.0 - (-e - wb) / (wb * 4.0)));
      }`
          : ""
      }
    }`;
      })
      .join("")}
  }`;
    })
    .join("");
  return /* glsl */ `
vec3 footRings(float wx, float depth, float rowK) {
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float ta = floor(tm * 12.0) / 12.0;
  float small = 0.0, front = 0.0, trough = 0.0;
  ${body}
  return vec3(small, front, trough);
}`;
}

// ------------------------------------------------------------------------------------
// spray and drips where a wading colossus's feet cross the water

const SQUARE = 0;

/** Water streaming off a lifted foot, a crown of spray where it plants, falling back to the surface. */
export class Spray implements PointSystem {
  private ps: { x: number; y: number; vx: number; vy: number; row: number; shade: number; size: number }[] = [];
  private last: { n: number; lifted: boolean }[];
  private drip: number[];
  private legs: ReturnType<typeof legList>;
  constructor(
    private c: ColossusDef,
    /** Layer row of the water surface at the colossus's depth. */
    private surface: number,
    private rows: { foam: number; water: number },
    private density = 1,
  ) {
    this.legs = legList(c);
    this.last = this.legs.map(() => ({ n: Number.NaN, lifted: false }));
    this.drip = this.legs.map(() => 0);
  }
  update(dt: number, env: SimEnv): void {
    const c = this.c;
    const k = env.reduced ? 0.5 : 1;
    const rng = env.ctx.rng;
    const tl = loopTime(c, animTime(env.t, env.reduced));
    const g = 16 * c.S;
    this.legs.forEach(({ hx, phase, far }, i) => {
      const st = foot(c, tl, phase, hx);
      const L = this.last[i]!;
      const lifted = st.sw >= 0;
      const X = st.x * c.S;
      const fresh = !Number.isNaN(L.n);
      const n = (far ? 0.5 : 1) * this.density;
      if (fresh && lifted && !L.lifted) {
        // the foot tears out of the water: a sheet of spray up and back
        const cnt = Math.round((8 + rng() * 6) * n);
        for (let j = 0; j < cnt; j++)
          this.ps.push({ x: X + (rng() - 0.5) * 14 * c.S, y: this.surface - 1, vx: (rng() * 10 - 2) * c.S, vy: -(8 + rng() * 18) * c.S, row: rng() < 0.6 ? this.rows.foam : this.rows.water, shade: 0.45 + rng() * 0.5, size: rng() < 0.25 && c.S > 1 ? 2 : 1 });
      }
      if (fresh && !lifted && L.lifted) {
        // the plant: a crown of spray outward
        const cnt = Math.round((10 + rng() * 8) * n);
        for (let j = 0; j < cnt; j++) {
          const side = rng() < 0.5 ? -1 : 1;
          this.ps.push({ x: X + side * (3 + rng() * 10) * c.S, y: this.surface - 1, vx: side * (5 + rng() * 16) * c.S, vy: -(6 + rng() * 16) * c.S, row: this.rows.foam, shade: 0.5 + rng() * 0.45, size: 1 });
        }
      }
      // water streaming off the lifted foot and shin
      if (lifted && st.sw < 0.9) {
        this.drip[i]! -= dt;
        if (this.drip[i]! <= 0) {
          this.drip[i] = (0.05 + rng() * 0.12) / n;
          const up = st.y * c.S;
          this.ps.push({ x: X + (rng() - 0.5) * 8 * c.S, y: this.surface - up * (0.2 + rng() * 0.8), vx: (rng() - 0.5) * 2 * c.S, vy: 0, row: rng() < 0.4 ? this.rows.foam : this.rows.water, shade: 0.35 + rng() * 0.4, size: 1 });
        }
      }
      L.n = st.n;
      L.lifted = lifted;
    });
    for (const p of this.ps) {
      p.vy += g * dt * k;
      p.x += p.vx * dt * k;
      p.y += p.vy * dt * k;
    }
    this.ps = this.ps.filter((p) => p.y < this.surface + 1).slice(-400);
  }
  draw(sink: PointSink): void {
    for (const p of this.ps) sink.push(Math.round(p.x), Math.round(p.y), p.size, SQUARE, p.row, p.shade, 0, 1);
  }
}

/** Not drawn: keeps colossus layers scissored to the columns the creature can touch (with EXT, not EXTENT). */
export class Track implements PointSystem {
  constructor(private items: { c: ColossusDef; bounds: { x0?: number; x1?: number }; ext: [number, number]; margin: number }[]) {}
  update(_dt: number, env: SimEnv): void {
    for (const it of this.items) {
      const c = it.c;
      const tl = loopTime(c, animTime(env.t, env.reduced));
      const bx = Math.floor((c.x0 / c.S - c.vd * tl) * c.S + 0.5);
      it.bounds.x0 = Math.floor(bx + it.ext[0] * c.S - it.margin);
      it.bounds.x1 = Math.ceil(bx + it.ext[1] * c.S + it.margin);
    }
  }
  draw(_sink: PointSink): void {}
}

// ------------------------------------------------------------------------------------
// far landmarks

/**
 * The broken ring, far behind in the west sky: a tilted band seen nearly edge
 * on, dark and backlit, with a lit inner lip and the torn gap, deep in haze.
 * (cx, cy) its centre in layer px, R its radius, tilt the minor/major ratio.
 */
export function farRingGlsl(o: { cx: number; cy: number; R: number; thick: number; tilt: number; rot: number; row: string; lit: string; fog: number; gap: [number, number] }): string {
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 d = p - vec2(${f(o.cx)}, ${f(o.cy)});
  float cr = cos(${f(o.rot)}), sr = sin(${f(o.rot)});
  d = vec2(cr * d.x + sr * d.y, -sr * d.x + cr * d.y);
  // ellipse coordinates: the band between two concentric ellipses
  vec2 e = vec2(d.x, d.y / ${f(o.tilt)});
  float r = length(e);
  float a = atan(e.y, e.x);
  float inner = ${f(o.R)};
  // the band's visible face widens on the near (lower) arc
  float face = ${f(o.thick)} * (0.55 + 0.45 * max(0.0, sin(a)));
  if (r < inner || r > inner + face) return vec4(0.0);
  float ang = a < 0.0 ? a + 6.28318 : a;
  if (ang > ${f(o.gap[0])} && ang < ${f(o.gap[1])}) return vec4(0.0);
  float t = (r - inner) / face;
  // panels along the band (whole fractions of a turn, so nothing seams)
  float pan = fract(ang / 6.28318 * 48.0);
  float shade = 0.18 + 0.1 * step(0.5, fract(ang / 6.28318 * 12.0)) - 0.06 * step(0.92, pan);
  if (t < 0.12) shade = 0.62;               // the lit inner lip
  else if (t > 0.88) shade = 0.1;
  vec3 c = ramp(${rowRef(o.row)}, shade, p, 0.0);
  if (t < 0.12) c = ramp(${rowRef(o.lit)}, 0.5, p, 0.0);
  c = applyFog(c, uFog, ${f(o.fog)}, p, s);
  return vec4(c, 1.0);
}`;
}

/**
 * The spire on the east horizon (w02): a black blade leaning out of the plain,
 * a faceted monolith with an elbow near its crown, a few lit windows, the red
 * light at its tip (downloads live up there), and a storm stuck to it: a dark
 * anvil that churns slowly, lit from inside by the flashes (flashLight), with
 * a curtain of rain hanging under it. x, base in layer px; h its height, w its
 * half width at the foot.
 */
export function spireGlsl(o: { x: number; base: number; h: number; w: number; lean: number; row: string; cloud: string; red: string; fog: number; rain?: boolean; windows?: number }): string {
  const R = rowRef(o.row), C = rowRef(o.cloud), RED = rowRef(o.red);
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float y = ${f(o.base)} - p.y;
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float t = y / ${f(o.h)};
  float cx = ${f(o.x)} + ${f(o.lean)} * y;
  vec3 c = vec3(0.0);
  float a = 0.0;
  float fl = flashLight(s);
  // the storm: a heavy dark mass wrapped round the upper blade, the tip standing out of it
  float topX = ${f(o.x + o.lean * o.h)};
  float midX = ${f(o.x + o.lean * o.h * 0.74)};
  vec2 q = vec2((p.x - midX) / ${f(o.h * 0.75)}, (y - ${f(o.h * 0.7)}) / ${f(o.h * 0.13)});
  float n = fbm(vec2(p.x / ${f(o.h * 0.07)} + tm * 0.05, p.y / ${f(o.h * 0.05)} - tm * 0.03), 4);
  float n2 = fbm(vec2(p.x / ${f(o.h * 0.03)} - tm * 0.08, p.y / ${f(o.h * 0.025)}), 2);
  float cl = 1.0 - length(q * vec2(1.0, q.y > 0.0 ? 1.1 : 0.8)) - (n - 0.5) * 1.3 - (n2 - 0.5) * 0.3;
  // the blade stands out through the top of it
  if (y > ${f(o.h * 0.74)} && abs(p.x - (${f(o.x)} + ${f(o.lean)} * y)) < ${f(o.w)} * (1.0 - 0.6 * t) + 3.0) cl = min(cl, 0.0);
  // rain: grey sheets hanging from its base to the plain, drifting with the wind
  float rainTop = ${f(o.h * 0.6)};
  if (${o.rain === false ? "false" : "true"} && cl <= 0.0 && y < rainTop && abs(p.x - midX + y * 0.12) < ${f(o.h * 0.55)} * (0.7 + 0.3 * (1.0 - y / ${f(o.h * 0.6)}))) {
    float sheet = fbm(vec2((p.x + y * 0.12) / ${f(o.h * 0.035)} + tm * 0.1, 0.5), 3);
    float lv = floor(smoothstep(0.4, 0.7, sheet) * 2.0 + (bayer4(p) - 0.5) * 0.9);
    if (lv > 0.0) { c = ramp(${C}, 0.22 + 0.06 * lv + fl * 0.6, p, 0.0); c = applyFog(c, uFog, ${f(o.fog)}, p, s); a = 0.35 + 0.15 * lv; }
  }
  // the blade
  if (y > -2.0 && t < 1.0) {
    float hw = ${f(o.w)} * (1.0 - 0.6 * t) + 1.0;
    float hwL = hw + ${f(o.w)} * 0.9 * smoothstep(0.72, 0.84, t) * (1.0 - smoothstep(0.9, 0.98, t));
    float dx = p.x - cx;
    // the crown is cut on a slant
    bool crown = t > 0.9 && dx > (1.0 - t) * ${f(o.w * 8.0)} - ${f(o.w * 0.5)};
    if (dx > -hwL && dx < hw && !crown) {
      float shade = dx < -hw * 0.25 ? 0.2 : 0.07;
      if (dx < -hw + 1.0 && dx > -hw - 1.0 + (hwL - hw) * 0.0) shade = 0.3;
      if (fract(y / ${f(o.h * 0.045)}) < 0.1 && t > 0.08) shade += 0.05;
      c = ramp(${R}, shade + fl * 0.5, p, 0.0);
      // a few lit windows: the only warmth on it
      if (hash2(vec2(floor(p.x / 2.0), floor(p.y / 4.0))) < ${f(o.windows ?? 0.012)} && t > 0.15 && t < 0.85) c = pal(${RED}, 0.0);
      c = applyFog(c, uFog, ${f(o.fog)} * (1.0 - 0.4 * t), p, s);
      a = 1.0;
    }
  }
  if (cl > 0.0) {
    float lv = floor(clamp(cl * 3.0, 0.0, 2.999) + (bayer4(p) - 0.5) * 0.4);
    float under = q.y < -0.3 ? -0.08 : 0.0;
    vec3 cc = ramp(${C}, 0.08 + 0.09 * lv + under + fl * 1.2, p, 0.0);
    cc = applyFog(cc, uFog, ${f(o.fog)} * 0.7, p, s);
    c = cc;
    a = 1.0;
  }
  // the red light at the tip: a slow beacon, never a flash (it breathes over 3 s)
  vec2 tip = vec2(topX - ${f(o.w * 0.3)}, ${f(o.base - o.h * 0.95)});
  float bl = floor((0.6 + 0.4 * sin(tm * 2.1)) * 3.0) / 3.0;
  if (abs(p.x - tip.x) < 1.5 && abs(p.y - tip.y) < 1.5) { c = mix(c, pal(${RED}, paln(${RED}) - 1.0), 0.55 + 0.45 * bl); a = 1.0; }
  return vec4(c, a);
}`;
}

// ------------------------------------------------------------------------------------
// wading water in front of the player

/**
 * The near surface of shallow water the player wades through (drawn in front
 * of the world, at depth 1): a lit surface line with small moving ripples and
 * a translucent body, so her shins disappear into it. `spans` are layer-x
 * ranges; `surface` the layer row of the water, `depth` px of body below it.
 */
export function wadeFrontGlsl(o: { spans: [number, number][]; surface: number; depth: number; row: string; lit: string; alpha: number }): string {
  const inside = o.spans.map(([a, b]) => `(p.x >= ${f(a)} && p.x < ${f(b)})`).join(" || ");
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  if (!(${inside || "false"})) return vec4(0.0);
  float dy = p.y - ${f(o.surface)};
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float wav = floor(sin(p.x * 0.19 + tm * 2.6) * 0.8 + sin(p.x * 0.07 - tm * 1.3) * 0.7 + 0.5);
  if (dy < wav || dy > ${f(o.depth)}) return vec4(0.0);
  float light = sceneLight(s, 1.0);
  if (dy < wav + 1.0) {
    float g = step(0.55, fract(p.x * 0.083 + tm * 0.4));
    return vec4(ramp(${rowRef(o.lit)}, 0.55 + 0.3 * g + light, p, 0.0), 0.9);
  }
  float k = dy / ${f(o.depth)};
  vec3 c = ramp(${rowRef(o.row)}, 0.2 - 0.12 * k + light, p, 0.6);
  // translucent: the stepped body lets her shins show dimly near the surface
  float a = floor((0.55 + 0.45 * k) * 3.0 + (bayer4(p) - 0.5) * 0.8) / 3.0;
  return vec4(c, ${f(o.alpha)} * clamp(a, 0.34, 1.0));
}`;
}

// ------------------------------------------------------------------------------------
// wide depth-1 art

/**
 * Split a wide Pix into layers no wider than `seg` px (phone GPUs cap
 * textures at 4096), all at the same depth, x and y.
 */
export function splitPix(pix: Pix, o: { name: string; depth: number; x: number; y: number; seg?: number } & Partial<LayerDef>): LayerDef[] {
  const seg = o.seg ?? 2048;
  const out: LayerDef[] = [];
  const { name, depth, x, y, seg: _s, ...rest } = o;
  void _s;
  for (let x0 = 0, k = 0; x0 < pix.w; x0 += seg, k++) {
    const w = Math.min(seg, pix.w - x0);
    const part = new Pix(w, pix.h);
    let any = false;
    for (let yy = 0; yy < pix.h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const si = (yy * pix.w + x0 + xx) * 4;
        if (pix.data[si + 3] === 0) continue;
        const di = (yy * w + xx) * 4;
        part.data[di] = pix.data[si]!;
        part.data[di + 1] = pix.data[si + 1]!;
        part.data[di + 2] = pix.data[si + 2]!;
        part.data[di + 3] = pix.data[si + 3]!;
        any = true;
      }
    if (!any) continue;
    out.push({ ...(rest as object), kind: "pix", name: k === 0 ? name : `${name}-${k}`, depth, pix: part, x: x + x0, y } as LayerDef);
  }
  return out;
}

/** Lights from a list of glowing points (lamps): none, but lets a points layer throw light. */
export function noLights(_out: LightOut[]): void {}

// The dusk after the storm (lane R-E; WORLD-PLAN section 8, "After the storm"):
// the far world behind the pilgrim path, the chapel porch and the balcony.
// A rose-gold sun low in the west sits in the broken ring's hole again (the
// ring's rhyme: huge over the dock, small and far now, at eye level), long
// clouds lit gold underneath, the spire black on the western horizon with the
// last of its storm pulling apart, the valley far below in violet haze with the
// lake holding the sun, the colossi walking a line along the horizon toward the
// ring, and the shrine lamps you lit as small warm points across the valley
// (keyed to the save: the ones you have lit, nothing else).
//
// Parallax: every layer is authored at a reference framing (the room's camera
// at x 0 and row `camRef`) and slides with its own depth from there, sideways
// and (in rooms that move vertically) up and down. Colours only come from
// ramps; light is stepped; nothing is an image.

import { f, fbm1, Flock, mist, Motes, Pix, rangeProfile, cragProfile, minProfile, sky, disc, terrain, type BuildCtx, type LayerDef, type PointSystem, type SceneDef } from "../../engine/index.ts";
import type { PointSink, SimEnv } from "../../engine/types.ts";

export const DUSK_PALETTE: Record<string, string[]> = {
  sun: ["#e89a66", "#f6c48a", "#fde6c0"],
  ring: ["#0d0b14", "#14111c", "#1c1726", "#281f32", "#503443", "#a45e4c", "#e89a66"],
  cloud: ["#382840", "#5a3a52", "#84505e", "#b86c64", "#e09c72", "#f4c690"],
  storm: ["#141220", "#1c1828", "#262032", "#342a3e", "#5a3e4a"],
  far: ["#2c2238", "#372a44", "#443250", "#553c5a", "#6e4c62"],
  plain: ["#1c1726", "#231d2f", "#2c2438", "#382d44", "#4a3a52"],
  water: ["#2a2340", "#3a3052", "#564466", "#86606e", "#dca074", "#f6d098"],
  rock: ["#0f0c15", "#16121d", "#1e1926", "#282031", "#372b3f", "#51404f", "#7c5a58"],
  spire: ["#07060b", "#0c0a11", "#131019", "#1c1722", "#6a3c3a"],
  colossus: ["#191522", "#221c2c", "#2e2536", "#3c3042", "#a66a52"],
  lamp: ["#7a4a22", "#d49a52", "#ffe2a8"],
  bird: ["#15121c", "#221c28"],
  mote: ["#7a5a62", "#c0907c", "#f0cc9c"],
  glint: ["#8a6070", "#e0a878", "#fbe0b0"],
  standin: ["#07060a", "#110e14", "#2a2230", "#e0a07a"],
};

export const DUSK_FOG: SceneDef["fog"] = {
  stops: [
    [0.0, "#141224"],
    [0.16, "#221c36"],
    [0.32, "#3c2a48"],
    [0.44, "#6a3e56"],
    [0.52, "#a0585e"],
    [0.57, "#d0845e"],
    [0.6, "#eab074"],
    [0.625, "#c47e6c"],
    [0.66, "#7a4c5e"],
    [0.74, "#4a3450"],
    [1.0, "#241c30"],
  ],
  bands: 18,
  dither: 0.55,
  density: 0.06,
  max: 0.85,
  glow: { x: 0.2, y: 0.57, r: 0.5, colour: "#f0b27a", strength: 0.36, steps: 6, dither: 0.2 },
};

export interface DuskOpts {
  /** The camera row the layers are authored at (room px); 0 in a room one view tall. */
  camRef: number;
  /** True in the world (layers slide vertically with the camera); false in /scenes/. */
  world: boolean;
  /** Screen y of the horizon at the reference framing. */
  horizon: number;
  /** Sun (and the ring's hole) on screen: it never moves. */
  sun: [number, number];
  /** The ring's outer half-width in px. */
  ringR: number;
  /** Screen x of the spire at the room's west end (it slides with depth 30), or null: out of sight. */
  spireX: number | null;
  /** Screen x of the lake's sun path at the west end (depth 70). */
  lakeX: number;
  /** Screen x (at the west end, depth 55) of each shrine's lamp on the valley floor, with its number. */
  lamps: [number, number][];
  /** The colossi walking the horizon. */
  colossi: boolean;
  /** Nearer crags below (the valley's depth under a high path) and the cliff under the chapel. */
  crags: "deep" | "cliff" | "none";
  /** Vertical travel of the camera in room px (min, max) so layers cover it. */
  camRange: [number, number];
  /** Shrines lit in this save (1..6). */
  lit: number[];
}

/** Which shrines this save has lit (the world save's flags; nothing is invented). */
export function litShrines(): number[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("dex.world.v1") : null;
    const d = raw ? (JSON.parse(raw) as { flags?: Record<string, boolean> }) : null;
    return [1, 2, 3, 4, 5, 6].filter((n) => d?.flags?.[`shrine:${n}`]);
  } catch {
    return [];
  }
}

/** Offsets that turn a layer pixel into "screen at the reference framing" for a depth. */
function offs(ctx: BuildCtx, o: DuskOpts, d: number): { x: number; y: number } {
  if (!Number.isFinite(d)) return { x: 0, y: 0 };
  return { x: Math.round(ctx.span / 2 / d), y: o.world ? -Math.round(o.camRef / d) : 0 };
}

/** The layer's vertical coverage (p space) for a depth, from the camera's travel. */
function cover(ctx: BuildCtx, o: DuskOpts, d: number): { y0: number; y1: number } {
  if (!o.world) return { y0: 0, y1: ctx.H };
  return { y0: Math.round(o.camRange[0] / d) - 2, y1: ctx.H + Math.round(o.camRange[1] / d) + 2 };
}

export function duskPrelude(o: DuskOpts): string {
  return /* glsl */ `
// the low sun warms clouds and mist near it (stepped)
float sceneLight(vec2 s, float depth) {
  vec2 d = (s - vec2(${f(o.sun[0])}, ${f(o.sun[1])})) / vec2(${f(640)}, ${f(300)});
  float g = max(0.0, 1.0 - length(d));
  return floor(g * g * 4.0) / 4.0 * 0.55;
}`;
}

/** The broken ring around the sun: a tilted band, backlit, its inner rim burning, a torn gap with drifting blocks. */
function ringBody(o: DuskOpts): string {
  const [sx, sy] = o.sun;
  const R = o.ringR;
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 d = s - vec2(${f(sx)}, ${f(sy)});
  float ca = cos(-0.42), sa = sin(-0.42);
  vec2 q = vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca);
  vec2 e2 = q / vec2(${f(R)}, ${f(R * 0.56)});
  float e = length(e2);
  float inner = 0.87;
  if (e > 1.02 || e < inner - 0.02) return vec4(0.0);
  float ang = atan(e2.y, e2.x);
  // the break: a torn gap on the upper right with stepped edges
  float tear = 0.62 + 0.08 * floor(hash1(floor((e - inner) * 20.0)) * 3.0) / 3.0;
  if (ang > tear && ang < tear + 0.34) return vec4(0.0);
  float band = (e - inner) / (1.0 - inner);
  // panels along the band, ribs every 1/48 turn
  float seg = fract(ang / 6.2832 * 48.0);
  float shade = 0.18 + (hash1(floor(ang / 6.2832 * 48.0)) - 0.5) * 0.08;
  if (seg < 0.08) shade -= 0.06;
  // the near (lower) half of the band shows its thickness darker; the inner rim facing the sun burns
  if (e2.y > 0.0) shade -= 0.05;
  if (band < 0.12) shade = 0.62 + (e2.y < 0.0 ? 0.2 : 0.08);
  else if (band > 0.9) shade += 0.14;
  if (e < inner || e > 1.0) shade = 0.3;
  vec3 c = ramp(R_RING, shade, p, 0.3);
  c = applyFog(c, 0.12, 0.0, p, s);
  return vec4(c, 1.0);
}`;
}

/** Blocks broken off the ring, drifting slowly apart near its gap. */
function ringChunks(o: DuskOpts): string {
  const [sx, sy] = o.sun;
  const R = o.ringR;
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.7 * uReduced);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float a = 0.7 + fi * 0.07 + sin(tm * 0.03 + fi) * 0.02;
    float rr = ${f(R)} * (0.92 + 0.12 * sin(fi * 2.1) + 0.03 * sin(tm * 0.05 + fi * 1.7));
    vec2 c0 = vec2(${f(sx)}, ${f(sy)}) + vec2(cos(a - 0.42) * rr, sin(a - 0.42) * rr * 0.56 + sin(tm * 0.04 + fi) * 2.0);
    vec2 h = vec2(3.0 + mod(fi * 3.0, 4.0), 2.0 + mod(fi * 5.0, 3.0));
    vec2 d = abs(s - floor(c0));
    if (d.x <= h.x && d.y <= h.y) {
      float sh = d.y < 1.0 && s.y < c0.y ? 0.6 : 0.2;
      return vec4(applyFog(ramp(R_RING, sh, p, 0.0), 0.15, 0.0, p, s), 1.0);
    }
  }
  return vec4(0.0);
}`;
}

/** The spire: a black needle on the western horizon; what is left of its storm tears into gold-edged rags. */
function spireBody(ctx: BuildCtx, o: DuskOpts, d: number): string {
  const of = offs(ctx, o, d);
  const base = o.horizon + 6;
  const x = o.spireX ?? -9999;
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 q = vec2(p.x + ${f(of.x)}, p.y + ${f(of.y)});
  float dx = q.x - ${f(x)};
  float hgt = ${f(base)} - q.y;
  if (hgt < 0.0 || abs(dx) > 40.0) return vec4(0.0);
  // a tapering tower with setbacks and a broken crown
  float w = 17.0 - hgt * 0.036 - floor(hgt / 60.0) * 1.5;
  float top = ${f(base - 330)};
  if (q.y < top + abs(dx) * 3.0 || abs(dx) > max(2.0, w)) return vec4(0.0);
  float shade = 0.12 + (dx < -w + 2.0 ? 0.5 : 0.0) + (mod(hgt, 60.0) < 2.0 ? 0.08 : 0.0);
  vec3 c = ramp(R_SPIRE, shade, p, 0.0);
  // one red light at the crown (the spire's mark), steady now the storm has gone
  if (length(vec2(dx, q.y - top - 8.0)) < 1.6) c = pal(R_SPIRE, 4.0);
  c = applyFog(c, uFog * 0.8, 0.0, p, s);
  return vec4(c, 1.0);
}`;
}

/** Colossi walking the horizon in a line toward the ring: small, slow, legs like stilts. */
function colossiBody(ctx: BuildCtx, o: DuskOpts, d: number): string {
  const of = offs(ctx, o, d);
  const base = o.horizon + 3;
  const wide = ctx.W + ctx.span / d + 400;
  return /* glsl */ `
float leg(vec2 q, vec2 hip, vec2 foot, float w) {
  vec2 ab = foot - hip;
  float t = clamp(dot(q - hip, ab) / dot(ab, ab), 0.0, 1.0);
  return length(q - hip - ab * t) - w;
}
vec4 layer(vec2 p, vec2 s) {
  vec2 q = vec2(p.x + ${f(of.x)}, p.y + ${f(of.y)});
  if (q.y > ${f(base + 1)} || q.y < ${f(base - 70)}) return vec4(0.0);
  float tm = uTime * (1.0 - 0.6 * uReduced);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float S = 0.42 + fi * 0.1;
    // walking west, one behind another, looping across the whole horizon
    float x0 = mod(${f(wide)} - tm * (2.2 + fi * 0.3) + fi * 230.0 + 140.0, ${f(wide)}) - 200.0;
    vec2 l = (q - vec2(x0, ${f(base)})) / S;
    if (abs(l.x) > 60.0 || l.y < -100.0) continue;
    float ph = tm * 0.9 + fi * 1.3;
    float bob = sin(ph * 2.0) * 1.0;
    // a long hunched back, the head low and forward (west), a hanging tail
    vec2 body = (l - vec2(2.0, -66.0 + bob)) / vec2(30.0, 10.0);
    float inside = length(body) < 1.0 ? 1.0 : 0.0;
    vec2 hump = (l - vec2(8.0, -74.0 + bob)) / vec2(14.0, 8.0);
    if (length(hump) < 1.0) inside = 1.0;
    if (leg(l, vec2(-22.0, -68.0 + bob), vec2(-38.0, -58.0 + bob), 3.2) < 0.0) inside = 1.0;
    vec2 head = (l - vec2(-40.0, -57.0 + bob)) / vec2(6.0, 4.0);
    if (length(head) < 1.0) inside = 1.0;
    if (leg(l, vec2(30.0, -66.0 + bob), vec2(38.0, -46.0 + bob), 1.2) < 0.0) inside = 1.0;
    // four long legs, a wide stance, stepping in turn
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      float hipX = fk < 2.0 ? -20.0 + fk * 6.0 : 16.0 + (fk - 2.0) * 6.0;
      float st = sin(ph + fk * 1.9);
      vec2 foot = vec2(hipX + st * 10.0 - 2.0, -max(0.0, cos(ph + fk * 1.9)) * 5.0);
      vec2 knee = mix(vec2(hipX, -64.0 + bob), foot, 0.5) + vec2(fk < 2.0 ? -4.0 : 5.0, 0.0);
      float w = fk == 0.0 || fk == 2.0 ? 1.6 : 1.2;
      if (leg(l, vec2(hipX, -64.0 + bob), knee, w + 0.6) < 0.0 || leg(l, knee, foot, w) < 0.0) inside = 1.0;
    }
    if (inside > 0.5) {
      // backlit: a warm rim on the side toward the sun (west)
      float rim = (length((l - vec2(2.0, -66.0 + bob)) / vec2(30.0, 10.0)) > 0.84 && l.y < -66.0 + bob) ? 1.0 : 0.0;
      vec3 c = ramp(R_COLOSSUS, 0.2 + rim * 0.8, p, 0.0);
      return vec4(applyFog(c, uFog, 0.0, p, s), 1.0);
    }
  }
  return vec4(0.0);
}`;
}

/** The lake far to the west: a flat strip under the horizon holding the sun's path. */
function lakeBody(ctx: BuildCtx, o: DuskOpts, d: number): string {
  const of = offs(ctx, o, d);
  const top = o.horizon + 2;
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 q = vec2(p.x + ${f(of.x)}, p.y + ${f(of.y)});
  float dx = q.x - ${f(o.lakeX)};
  float dy = q.y - ${f(top)};
  if (dy < 0.0 || dy > 26.0 || abs(dx) > 260.0 - dy * 3.0) return vec4(0.0);
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float shade = 0.3 + dy * 0.004;
  // the sun path: broken dashes of gold down the middle, flickering slowly
  float path = 1.0 - smoothstep(10.0, 40.0 + dy * 2.0, abs(q.x - ${f(o.sun[0])} + ${f(of.x)} * 0.0));
  float dash = step(0.5, vnoise(vec2(floor(q.x / 3.0) + floor(tm * 1.5), q.y)));
  if (path * dash > 0.4) shade = 0.85 + (dy < 6.0 ? 0.1 : 0.0);
  vec3 c = ramp(R_WATER, shade, p, 0.3);
  return vec4(applyFog(c, uFog * 0.6, 0.0, p, s), 1.0);
}`;
}

/** Shrine lamps you lit, as warm points on the valley floor (never a flash: a slow gentle breath). */
class Lamps implements PointSystem {
  private t = 0;
  constructor(private at: [number, number][], private row: number) {}
  update(_dt: number, env: SimEnv): void {
    this.t = env.t * (env.reduced ? 0.3 : 1);
  }
  draw(sink: PointSink): void {
    this.at.forEach(([x, y], i) => {
      const k = Math.sin(this.t * 0.7 + i * 2.1) > 0.6 ? 0.8 : 1;
      sink.push(x - 1, y - 1, 2, 0, this.row, k, 0, 1);
      sink.push(x, y - 3, 1, 0, this.row, 0.55, 0, 0.6);
    });
  }
}

/** The far world behind a dusk room. */
export function duskLayers(ctx: BuildCtx, o: DuskOpts): LayerDef[] {
  const { W, H } = ctx;
  const L: LayerDef[] = [];
  const R = (n: string): number => ctx.row(n);
  L.push(sky({ name: "sky", stars: { density: 0.0016, row: "sun", below: H * 0.3 } }));
  L.push(disc({ name: "sun", x: o.sun[0], y: o.sun[1], r: Math.round(o.ringR * 0.26), row: "sun", halo: { r: 3.2, strength: 0.4, steps: 5, seam: 0.2 }, dither: 0.3 }));
  // high clouds, lit from below near the sun
  L.push(mist({ name: "high-cloud", depth: 400, y0: -10, y1: H * 0.36, sx: 300, sy: 14, drift: -3, evolve: 0.05, cover: 0.46, warp: 1.5, levels: 4, alpha: 0.7, edgeDither: 0.3, row: "cloud", tone: 0.3, tonePerLevel: 0.12, tint: 0.7, lightGain: 0.9 }));
  L.push({ kind: "glsl", name: "ring", depth: Infinity, fog: 0, body: ringBody(o), bounds: { x0: o.sun[0] - o.ringR * 1.2, x1: o.sun[0] + o.ringR * 1.2, y0: o.sun[1] - o.ringR, y1: o.sun[1] + o.ringR } });
  L.push({ kind: "glsl", name: "ring-chunks", depth: Infinity, fog: 0, body: ringChunks(o), bounds: { x0: o.sun[0] - o.ringR * 1.3, x1: o.sun[0] + o.ringR * 1.3, y0: o.sun[1] - o.ringR, y1: o.sun[1] + o.ringR } });
  // long low clouds across the sun, gold underneath
  L.push(mist({ name: "sun-cloud", depth: 200, y0: o.horizon - 150, y1: o.horizon - 30, sx: 360, sy: 9, drift: -2, evolve: 0.04, cover: 0.42, warp: 0.9, levels: 3, alpha: 0.85, edgeDither: 0.25, row: "cloud", tone: 0.45, tonePerLevel: 0.14, tint: 0.8, lightGain: 1.1 }));
  // the far range along the horizon (depth 90)
  {
    const d = 90;
    const of = offs(ctx, o, d);
    const w = Math.ceil(ctx.panWidth(d)) + 8;
    const pix = new Pix(w, 90);
    const base = 70;
    terrain(pix, { row: R("far"), top: rangeProfile({ base, amp: 46, scale: 70, seed: 21, detail: 4, sharp: 0.45 }), seed: 22, scale: 18, light: [-0.8, -0.5], base: 0.36, contrast: 0.45, rim: 0.25, rimDepth: 2, fog: () => 0.1 });
    L.push({ kind: "pix", name: "far-range", depth: d, pix, x: -of.x - 4, y: o.horizon - base - of.y, fog: 0.45 });
  }
  if (o.spireX !== null) {
    const d = 30;
    L.push({ kind: "glsl", name: "spire", depth: d, fog: 0.35, body: spireBody(ctx, o, d), bounds: { y0: -1e5, y1: 1e5 } });
    L.push(mist({ name: "storm-rags", depth: d, y0: o.horizon - 330 - offs(ctx, o, d).y, y1: o.horizon - 170 - offs(ctx, o, d).y, sx: 120, sy: 26, drift: -6, evolve: 0.07, cover: 0.34, warp: 1.8, levels: 3, alpha: 0.75, edgeDither: 0.3, row: "storm", tone: 0.35, tonePerLevel: 0.2, tint: 0.7, lightGain: 0.8, bounds: { y0: o.horizon - 340 - offs(ctx, o, d).y, y1: o.horizon - 160 - offs(ctx, o, d).y, x0: o.spireX - 200 - offs(ctx, o, d).x, x1: o.spireX + 220 - offs(ctx, o, d).x } }));
  }
  if (o.colossi) {
    const d = 60;
    L.push({ kind: "glsl", name: "colossi", depth: d, fog: 0.4, body: colossiBody(ctx, o, d) });
  }
  // the valley floor: a violet plain to the horizon, the lake holding the sun
  {
    const d = 55;
    const of = offs(ctx, o, d);
    const cv = cover(ctx, o, d);
    const w = Math.ceil(ctx.panWidth(d)) + 8;
    const top = o.horizon + 1;
    const hgt = Math.max(40, cv.y1 - (top + of.y));
    const pix = new Pix(w, hgt);
    terrain(pix, { row: R("plain"), top: (x) => 2 + Math.round((fbm1(x / 40, 7, 3) - 0.5) * 3), seed: 31, scale: 30, light: [-0.6, -0.8], base: 0.4, contrast: 0.3, strata: 0.4, fog: (_x, y) => Math.max(0, 0.3 - y / 400) });
    L.push({ kind: "pix", name: "plain", depth: d, pix, x: -of.x - 4, y: top - of.y, fog: 0.3 });
  }
  L.push({ kind: "glsl", name: "lake", depth: 70, fog: 0.2, body: lakeBody(ctx, o, 70) });
  // lamps you lit, on the valley floor
  {
    const d = 55;
    const of = offs(ctx, o, d);
    const pts = o.lamps.filter(([, n]) => o.lit.includes(n)).map(([x, n]) => [x - of.x, o.horizon + 6 + n * 3 - of.y] as [number, number]);
    if (pts.length) L.push({ kind: "points", name: "lamps", depth: d, system: new Lamps(pts, R("lamp")) });
  }
  // valley mist, glowing warm toward the sun
  L.push(mist({ name: "valley-mist", depth: 40, y0: o.horizon - 8 - offs(ctx, o, 40).y, y1: o.horizon + 40 - offs(ctx, o, 40).y, sx: 220, sy: 10, drift: -1.5, evolve: 0.03, cover: 0.6, warp: 0.7, levels: 3, alpha: 0.6, edgeDither: 0.3, row: "cloud", tone: 0.2, tonePerLevel: 0.1, tint: 0.5, lightGain: 0.9, loop: 0 }));
  if (o.crags !== "none") {
    // the valley's depth: crags far below the path (deep), or the cliff the chapel stands on
    const d = o.crags === "deep" ? 7 : 3.2;
    const of = offs(ctx, o, d);
    const cv = cover(ctx, o, d);
    const w = Math.ceil(ctx.panWidth(d)) + 8;
    const y0 = o.crags === "deep" ? o.horizon + 30 : o.horizon + 60;
    const hgt = Math.max(60, cv.y1 - (y0 + of.y) + 40);
    const pix = new Pix(w, hgt);
    const prof = o.crags === "deep"
      ? minProfile(
          rangeProfile({ base: 170, amp: 90, scale: 90, seed: 41, detail: 6, sharp: 0.5 }),
          ...[0.12, 0.33, 0.52, 0.77, 0.93].map((k, i) => cragProfile({ cx: w * k, top: 10 + (i % 3) * 30, base: 260, left: 40 + i * 6, right: 34 + i * 5, seed: 50 + i, ledges: 3, rough: 0.08 })),
        )
      : rangeProfile({ base: 40, amp: 26, scale: 60, seed: 61, detail: 3, sharp: 0.4 });
    terrain(pix, { row: R("rock"), top: prof, seed: 43, scale: 26, chunk: 2, light: [-0.85, -0.45], base: 0.3, contrast: 0.55, vertical: 0.4, rim: 0.35, rimDepth: 4, ao: 0.25, fog: (_x, y) => Math.max(0, 0.35 - y / 900) });
    L.push({ kind: "pix", name: "crags", depth: d, pix, x: -of.x - 4, y: y0 - of.y, fog: o.crags === "deep" ? 0.42 : 0.22 });
    L.push(mist({ name: "crag-mist", depth: d, y0: y0 + 60 - of.y, y1: y0 + 60 + hgt * 0.6 - of.y, sx: 200, sy: 18, drift: -2.5, evolve: 0.04, cover: 0.5, warp: 1.1, levels: 3, alpha: 0.45, edgeDither: 0.3, row: "cloud", tone: 0.15, tonePerLevel: 0.1, tint: 0.45, lightGain: 0.6 }));
  }
  // birds heading home
  L.push({ kind: "points", name: "birds", depth: 20, system: new Flock({ y: [H * 0.2, H * 0.42], x: [-60, W + 60], every: 38, speed: 16, count: [3, 6], row: R("bird"), shade: 0.2 }) });
  return L;
}

/** Motes in the low sun near the player plane (points; room px in the world). */
export function duskMotes(ctx: BuildCtx, region: [number, number, number, number]): LayerDef {
  return { kind: "points", name: "motes", depth: 1, system: new Motes({ region, count: Math.round((region[2] - region[0]) / 30), row: ctx.row("mote"), vel: [-2, -0.8], wander: 3, twinkle: 0.4, shade: [0.35, 0.85] }, ctx.rng) };
}

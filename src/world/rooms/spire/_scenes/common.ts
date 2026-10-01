// Shared pieces of the spire's backdrops (lane R-D): the palette, the storm
// clock, rain that leans with the gust, lightning that stays inside the
// clouds, and the spire's own face (the black structure you climb, after the
// monolith of monolith-planet, ref w02).
//
// Coordinates. A backdrop layer at depth D is authored in layer pixels; the
// world backdrop maps them to the screen with whole-pixel parallax in x (the
// room's span) and y (the room's height, for vertical rooms). `Frame` turns
// a room position into the layer pixel that sits on it when the camera is
// centred there, so things behind the player plane can be placed where the
// room's geometry is (the rows of the climb, the lift channel).

import { f, rowRef, FlashAccents, type GlslLayer } from "../../../../scenes/engine/index.ts";
import type { BuildCtx, PointSink, PointSystem, SimEnv } from "../../../../scenes/engine/types.ts";
import type { WorldLayer } from "../../../backdrop/engine.ts";
import { GUST, GUST_GLSL, gustAt, publishClock } from "../../../../pixel/props/spire/storm.ts";

export { GUST_GLSL };

/** The spire's ramps (darkest first). Cold blue-black; warm only in lamps and warning lights. */
export const SPIRE_PALETTE: Record<string, string[]> = {
  planet: ["#2e3945", "#3f4b58", "#56636f", "#727f8a", "#939fa8", "#b4bfc6", "#d2dadf"],
  rim: ["#1b4777", "#3576ae", "#79b4dc", "#c8e6f6"],
  // the face's plate: indigo in the shadows, cold steel in the light (hue-shifted, one step per band)
  plate: ["#06070e", "#0d101d", "#161c2c", "#212b3e", "#303e54", "#46576f", "#687c94"],
  // rust on the plate, and verdigris and moss where water stands
  rustf: ["#160b0c", "#2b1512", "#46221a", "#663424", "#874c30", "#a96a42"],
  verd: ["#0a1413", "#11211d", "#1b3229", "#284633", "#3a5e3f", "#56794d"],
  // the near foreground: darker and greyer than anything at her depth
  // the route's red, painted on the plating (muted, like the lips' paint)
  route: ["#200a10", "#3a1219", "#5a1c22", "#7a2a2c", "#96403a"],
  fore: ["#020306", "#05070b", "#090c12", "#10141c", "#1a2029"],
  mono: ["#030508", "#080b11", "#0e141c", "#182029", "#26313e", "#44546a", "#8093a6"],
  under: ["#04070b", "#08101a", "#0c1a2b", "#112a44", "#1a4265", "#2c6a99", "#6db4e4"],
  win: ["#3c7fc0", "#9dd3ff", "#e9f8ff"],
  windim: ["#1d3b5c", "#2f5f8a", "#4f86b4"],
  amber: ["#5a2a0c", "#a85a18", "#f29a3c", "#ffd490"],
  red: ["#4a0c14", "#8e1a26", "#d6394a", "#ffb0a8"],
  storm: ["#07090e", "#0c1018", "#141b27", "#1e2838", "#2c3a4f", "#44566f", "#6f86a3"],
  stormlit: ["#1a2438", "#2c3d5c", "#4a6390", "#7c9bcc", "#c4d6f4"],
  rainr: ["#2a3648", "#3c4b60", "#56687e", "#7b8ea6", "#a8bbd0"],
  glowb: ["#123a66", "#2a6eaa", "#5fa9e0", "#b4e2ff", "#effbff"],
  far: ["#141b25", "#1b2430", "#232e3c", "#2d3948"],
  cloud: ["#0f1620", "#16202c", "#1f2c3b", "#2c3d50", "#405670", "#5f7a96", "#8fa9c2"],
  bird: ["#0b1016", "#161e28"],
  standin: ["#05070a", "#0c1117", "#223040", "#a3c6de"],
};

/** Maps room pixels to layer pixels at a depth (the camera centred on that room point). */
export class Frame {
  /** Room x at the screen centre when the camera sits mid-pan. */
  readonly cx: number;
  constructor(
    readonly ctx: BuildCtx,
    /** The room's height in px (vertical rooms): layer y is room y when the camera's top is at 0. */
    readonly vertical: boolean,
  ) {
    this.cx = ctx.span / 2 + ctx.W / 2;
  }
  /** Layer x of a room x at depth d. */
  x(roomX: number, d: number): number {
    return (roomX - this.cx) / d + this.ctx.W / 2;
  }
  /** Layer y of a room y at depth d (vertical parallax: view top 0 means p = s). */
  y(roomY: number, d: number): number {
    return this.vertical ? (roomY - this.ctx.H / 2) / d + this.ctx.H / 2 : roomY;
  }
  /** Layer extent a depth needs to cover the room's pan (x0, x1) and height (y0, y1) at vertical parallax. */
  cover(d: number, roomH: number): { x0: number; x1: number; y0: number; y1: number } {
    const padX = (this.ctx.span / 2) / d;
    const yMax = this.vertical ? this.ctx.H + Math.max(0, roomH - this.ctx.H) / d : this.ctx.H;
    return { x0: -padX - 4, x1: this.ctx.W + padX + 4, y0: -4, y1: yMax + 4 };
  }
}

/** The master storm clock: publishes the scene's seconds every frame (it draws nothing). */
export class StormClock implements PointSystem {
  update(_dt: number, env: SimEnv): void {
    publishClock(env.t);
  }
  draw(_sink: PointSink): void {}
}

export function clockLayer(): WorldLayer {
  return { kind: "points", name: "storm-clock", depth: Infinity, system: new StormClock() } as WorldLayer;
}

// --- rain that leans with the gust ------------------------------------------------------

/**
 * The integral of the gust's lean over one cycle (so falling rain drifts
 * sideways by exactly as much as it leans, and the streaks never jump when a
 * gust starts): a table the GLSL interpolates.
 */
function leanTable(n: number, tellK: number, levelK: number): number[] {
  const out: number[] = [0];
  let acc = 0;
  const dt = GUST.period / n;
  const sub = 16;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < sub; k++) {
      const g = gustAt(i * dt + (k + 0.5) * (dt / sub));
      acc += (g.tell * tellK + g.level * levelK) * (dt / sub);
    }
    out.push(acc);
  }
  return out;
}

export interface RainOpts {
  name: string;
  depth: number;
  /** Column width, streak length and fall speed (layer px, px/s). */
  cw: number;
  len: number;
  speed: number;
  alpha: number;
  /** Share of columns that carry drops at full rain. */
  dens: number;
  seed: number;
  /** Tone on the rain ramp. */
  shade: number;
  /** Base lean (x per y) and the extra lean from the tell and the gust, all toward GUST.dir. */
  lean: number;
  tellLean: number;
  gustLean: number;
  /** Minimum rain level (the storm rooms keep raining even under the "rain" weather state). */
  floor?: number;
  bounds?: { y0: number; y1: number; x0?: number; x1?: number };
  pass?: "back" | "front";
  /** Dry places (room px rects x0, y0, x1, y1): no rain drawn over them (the alcove under its lintel). */
  dry?: [number, number, number, number][];
}

/** A rain layer whose angle follows the gust program (the tell leans it ~1 s ahead of the push). */
export function gustRain(o: RainOpts): WorldLayer {
  const N = 36;
  const dir = GUST.dir;
  const tab = leanTable(N, o.tellLean * dir, o.gustLean * dir);
  const cyc = tab[N]!;
  const layer: GlslLayer = {
    kind: "glsl",
    name: o.name,
    depth: o.depth,
    fog: o.depth > 2 ? 0.25 : 0,
    bounds: o.bounds,
    body: /* glsl */ `
${GUST_GLSL}
const float LT[${N + 1}] = float[${N + 1}](${tab.map((v) => f(v)).join(", ")});
// integral of the extra lean up to t (seconds)
float leanInt(float t) {
  float cyc = floor(t / ${f(GUST.period)});
  float u = (t - cyc * ${f(GUST.period)}) / ${f(GUST.period)} * ${f(N)};
  int i = int(floor(u));
  float a = LT[i], b = LT[min(i + 1, ${N})];
  return cyc * ${f(cyc)} + mix(a, b, u - float(i));
}
vec4 layer(vec2 p, vec2 s) {
  float rain = max(uWx.x, ${f(o.floor ?? 0)} * (1.0 - uWx2.w));
  if (rain <= 0.01) return vec4(0.0);
  ${(o.dry ?? []).length ? `vec2 room = s + vec2(uCam, uCamY);
  ${(o.dry ?? []).map(([x0, y0, x1, y1]) => `if (room.x >= ${f(x0)} && room.x <= ${f(x1)} && room.y >= ${f(y0)} && room.y <= ${f(y1)}) return vec4(0.0);`).join(" ")}` : ""}
  float tm = uTime * (1.0 - 0.45 * uReduced);
  vec3 g = gustAt(uTime);
  float lean = ${f(o.lean * dir)} + ${f(o.tellLean * dir)} * g.y + ${f(o.gustLean * dir)} * g.x;
  float fall = ${f(o.speed)};
  // the drops' frame: falling at \`fall\`, drifting sideways by the integral of the lean
  float drift = (tm * ${f(o.lean * dir)} + leanInt(tm)) * fall;
  float qy = p.y + floor(tm * fall);
  float qx = p.x - floor(drift + 0.5);
  float per = ${f(o.len * 5)};
  float cell = floor(qy / per);
  float within = qy - cell * per;
  // each drop leans about its own head, so a change of angle never slides the whole field
  float col = floor((qx - floor(within * lean + 0.5)) / ${f(o.cw)});
  float h = hash2(vec2(col, cell + ${f(o.seed)}));
  if (h > rain * ${f(o.dens)}) return vec4(0.0);
  float xo = floor(hash2(vec2(col, cell + ${f(o.seed + 7)})) * ${f(o.cw - 1)});
  float x = qx - floor(within * lean + 0.5) - col * ${f(o.cw)};
  if (floor(x) != xo) return vec4(0.0);
  float y0 = floor(hash2(vec2(col + 3.0, cell)) * ${f(o.len * 3.5)});
  float d = within - y0;
  float L = ${f(o.len)} * (0.7 + 0.5 * h / max(0.01, rain * ${f(o.dens)}));
  if (d < 0.0 || d > L) return vec4(0.0);
  float lit = ${f(o.shade)} + flashLight(s) * 0.7 + sceneLight(s, uDepth) * 0.4;
  vec3 c = ramp(R_RAINR, lit, p, 0.0);
  float a = ${f(o.alpha)} * (d > L * 0.55 ? 1.0 : 0.6);
  return vec4(c, a);
}`,
  };
  const w = layer as WorldLayer;
  if (o.pass) w.pass = o.pass;
  return w;
}

// --- lightning inside the clouds --------------------------------------------------------

/**
 * Cloud glow: soft flashes deep in the storm clouds that light the cloud
 * layers (through flashLight) and nothing else. Every start asks the global
 * flash gate (shared with the world's weather), so no second holds more than
 * three, and in reduced motion one per two seconds.
 */
export function cloudLightning(ctx: BuildCtx, o: { name: string; depth: number; rate: number; region: [number, number, number, number]; radius: number; strength: number }): WorldLayer {
  const [x0, y0, x1, y1] = o.region;
  return {
    kind: "points",
    name: o.name,
    depth: o.depth,
    fog: 0.2,
    blend: "add",
    system: new FlashAccents([
      {
        kind: "glow",
        rate: o.rate,
        at: (rng) => [Math.round(x0 + rng() * (x1 - x0)), Math.round(y0 + rng() * (y1 - y0))],
        size: [7, 13],
        row: ctx.row("stormlit"),
        shade: 0.7,
        duration: [0.35, 0.8],
        intensity: 0.4,
        light: { radius: o.radius, colour: "#a8c4ff", strength: o.strength },
      },
    ]),
  } as WorldLayer;
}

/** A warm spill (layer px): centre x, y, radii rx, ry, strength 0..1, and optionally the row below which it stops (a deck under it). */
export type Pool = [number, number, number, number, number, number?];

// --- the spire's face ---------------------------------------------------------------------

export interface FaceOpts {
  name: string;
  depth: number;
  /** The silhouette edge (layer px): x at the bottom and at the top of `ys`, and the side the structure is on. */
  edge: { x0: number; x1: number; y0: number; y1: number; side: 1 | -1 };
  /** Tier height and panel width (layer px). */
  tier: number;
  panel: number;
  /** Vertical ribs every `rib` px (0 = none). */
  rib: number;
  /** Share of panels with a lit window slot. */
  windows: number;
  /** A vertical channel cut into the face (the lift's): layer x range. */
  channel?: [number, number];
  /** Base shade on the mono ramp, and extra fog toward the bottom (a haze below). */
  shade: number;
  seed: number;
  bounds?: { y0: number; y1: number; x0?: number; x1?: number };
  /** Wet: rain runs down it in thin streaks. */
  wet?: boolean;
  /**
   * Contact shadows the room's iron throws on the face (layer px): a segment x0,y0 to x1,y1 (a
   * catwalk's tread, a flight's stringer) and how far below it the shadow reaches. Light comes from
   * the planet side, so the shadow sits a few px downwind. Stepped in three bands, dithered edges.
   */
  shadows?: [number, number, number, number, number][];
  /**
   * Openings built into the face (layer px x0, y0, x1, y1): a doorway's surround, an alcove. The
   * face's courses butt against them with a dark joint, nothing busy (windows, hatches, running
   * lights) shows within a margin of them, and they throw a shadow onto the face downwind.
   */
  openings?: [number, number, number, number][];
  /** Warm light spilling onto the face (layer px centre x, y, radii rx, ry, strength 0..1): the alcove's candles, a lamp. Stepped, dithered. */
  pools?: Pool[];
  /** Lifts the plating's base value (the climb's face, the wall you are against, reads a step lighter than the iron in front of it). */
  lift?: number;
  /** The route's marks painted on the plating (layer px centre x, y, size): a stack of red chevrons pointing up the next flight, weathered. */
  marks?: [number, number, number][];
  /** Lightning scars (layer px centre x, y, radius): plates torn off to the ribs behind, the edges curled and scorched, soot blown out around it, a few embers still glowing. */
  scars?: [number, number, number][];
}

/** GLSL: the face's contact shadow (0..1, stepped) from the room's iron at layer pixel p. */
function shadowGlsl(segs: [number, number, number, number, number][], side: number): string {
  if (!segs.length) return "float ironShadow(vec2 p) { return 0.0; }";
  const off = 5 * side;
  const body = segs
    .map(([x0, y0, x1, y1, d]) => {
      const a = Math.min(x0, x1), b = Math.max(x0, x1);
      return `  if (q.x >= ${f(a)} && q.x <= ${f(b)}) { float yl = mix(${f(y0)}, ${f(y1)}, (q.x - ${f(x0)}) / ${f(x1 - x0 || 1)}); float d = (p.y - yl) / ${f(d)}; float e = min(q.x - ${f(a)}, ${f(b)} - q.x) / 10.0; if (d >= 0.0 && d < 1.0) s = max(s, (d < 0.45 ? 1.0 : d < 0.78 ? 0.62 : 0.3) * min(1.0, 0.4 + e)); }`;
    })
    .join("\n");
  return `float ironShadow(vec2 p) {
  vec2 q = p - vec2(${f(off)}, 0.0);
  float s = 0.0;
${body}
  return floor(s * 4.0 + (bayer4(p) - 0.5) * 0.9 + 0.5) / 4.0;
}`;
}

/** GLSL: distance outside the nearest opening (negative inside), and the downwind cast shadow of one (0/1). */
function openingGlsl(ops: [number, number, number, number][], side: number): string {
  const lines = ops.map(([x0, y0, x1, y1]) => `  { vec2 c = vec2(${f((x0 + x1) / 2)}, ${f((y0 + y1) / 2)}); vec2 h = vec2(${f((x1 - x0) / 2)}, ${f((y1 - y0) / 2)}); vec2 d = abs(p - c) - h; od = min(od, max(d.x, d.y));
    vec2 sd = abs(p - c - vec2(${f(7 * side)}, 7.0)) - h; if (max(sd.x, sd.y) < 0.0 && max(d.x, d.y) > 0.0) castS = 1.0; }`);
  return `float openDist(vec2 p, out float castS) {
  float od = 1e5;
  castS = 0.0;
${lines.join("\n")}
  return od;
}`;
}

/** GLSL: the warm spill at p (0..1, stepped in quarters). */
function poolGlsl(pools: Pool[]): string {
  const lines = pools.map(([x, y, rx, ry, k, yMax]) => `  w = max(w, ${f(k)} * (1.0 - smoothstep(0.15, 1.0, length((p - vec2(${f(x)}, ${f(y)})) / vec2(${f(rx)}, ${f(ry)}))))${yMax !== undefined ? ` * step(p.y, ${f(yMax)})` : ""});`);
  return `float warmPool(vec2 p) {
  float w = 0.0;
${lines.join("\n")}
  return floor(w * 4.0 + (bayer4(p) - 0.5) * 0.8 + 0.5) / 4.0;
}`;
}

/**
 * The spire's face, per pixel: stepped setbacks along a leaning silhouette,
 * a lit bevel toward the planet, panels in tiers with seams and a lit lip
 * under each tier line, heavy girdles every few tiers, buttress ribs standing
 * proud with the light on one side, conduits with blue running lights, a few
 * lit window slots, hatches, rain running down it, and lightning showing its
 * relief for a moment. Pixels are data (shade on the mono ramp), lit live.
 */
export function spireFace(o: FaceOpts): GlslLayer {
  const e = o.edge;
  const S = e.side;
  const ops = o.openings ?? [];
  const LIFT = o.lift ?? 0;
  return {
    kind: "glsl",
    name: o.name,
    depth: o.depth,
    bounds: o.bounds,
    dither: 0,
    body: /* glsl */ `
bool isGirdle(float tier) { return mod(tier + ${f(o.seed)}, 4.0) < 1.0; }
float faceEdge(float y) {
  float t = clamp((y - ${f(e.y1)}) / ${f(e.y0 - e.y1)}, 0.0, 1.0);
  float x = mix(${f(e.x1)}, ${f(e.x0)}, t);
  float tier = floor(y / ${f(o.tier)});
  float h = hash2(vec2(tier, ${f(o.seed)}));
  // stepped setbacks: each tier sits in or out
  x += (h < 0.28 ? -14.0 : h < 0.5 ? -5.0 : h > 0.88 ? 10.0 : 0.0) * ${f(S)};
  // a cornice projects at every tier line (deeper on the girdles): a ledge with a lit top and a shadowed soffit
  float ty = y - tier * ${f(o.tier)};
  bool g = isGirdle(tier);
  if (ty >= 1.0 && ty < (g ? 13.0 : 5.0)) x -= (g ? 9.0 : 4.0) * ${f(S)};
  return floor(x + 0.5);
}
${shadowGlsl(o.shadows ?? [], S)}
${ops.length ? openingGlsl(ops, S) : "float openDist(vec2 p, out float castS) { castS = 0.0; return 1e5; }"}
${(o.pools ?? []).length ? poolGlsl(o.pools!) : "float warmPool(vec2 p) { return 0.0; }"}
// a crack across a plate: a jagged dark line with a lit lip under it (1: on the crack, 2: its lit lip)
float crackAt(vec2 q, float pw, float ph, float seed) {
  float c0 = ph * (0.35 + 0.4 * hash2(vec2(seed, 2.0)));
  float sl = (hash2(vec2(seed, 3.0)) - 0.5) * 0.9;
  float x0 = pw * hash2(vec2(seed, 4.0)) * 0.5;
  float len = pw * (0.25 + 0.4 * hash2(vec2(seed, 5.0)));
  if (q.x < x0 || q.x > x0 + len) return 0.0;
  float j = floor((hash2(vec2(floor(q.x / 3.0), seed)) - 0.5) * 3.0);
  float y = floor(c0 + (q.x - x0) * sl + j);
  if (abs(q.y - y) < 0.5) return 1.0;
  if (abs(q.y - y - 1.0) < 0.5) return 2.0;
  return 0.0;
}
vec4 layer(vec2 p, vec2 s) {
  float ex = faceEdge(p.y);
  float into = (p.x - ex) * ${f(S)};
  if (into < 0.0) return vec4(0.0);
  float castS;
  float od = openDist(p, castS);
  // nothing busy right around a doorway or the alcove: the plating runs plain up to its surround
  bool quiet = od < 26.0;
  float T = ${f(o.tier)};
  float tier = floor(p.y / T);
  float ty = p.y - tier * T;
  bool girdle = isGirdle(tier);
  float lipH = girdle ? 12.0 : 4.0;
  float pw = ${f(o.panel)} * (0.75 + 0.5 * hash2(vec2(tier, ${f(o.seed + 3)})));
  float pxo = hash2(vec2(tier, ${f(o.seed + 5)})) * pw;
  // every tier is two courses of plate, the second offset half a plate (running bond)
  float mid = floor(lipH + (T - lipH) * 0.52);
  bool lower = ty >= mid;
  float po = lower ? pw * 0.5 : 0.0;
  float pc = floor((p.x + pxo + po) / pw);
  float px = p.x + pxo + po - pc * pw;
  float cTop = lower ? mid : lipH + 1.0;
  float cBot = lower ? T : mid;
  float cy = ty - cTop;
  float ch = cBot - cTop;
  float pid = pc * 2.0 + (lower ? 1.0 : 0.0) + tier * 7.0;
  float ph = hash2(vec2(pid, ${f(o.seed)}));
  // kind: 0 plate, 1 rust, 2 verdigris and moss
  float kind = 0.0;
  float sh;
  bool body = ty >= lipH + 1.0;
  if (ty < 1.0) sh = 0.04;
  else if (!body) {
    // the cornice: a lit top where the sky catches it, its face, a dark soffit
    float k = ty - 1.0;
    sh = k < 1.0 ? 0.9 : k < 2.0 ? 0.74 : k > lipH - 2.0 ? 0.2 : 0.56 - 0.02 * k;
    // verdigris and moss on the ledge, in clumps (where water stands)
    float mc = vnoise(vec2(p.x / 9.0, tier * 3.1));
    if (k < 2.0 && mc > 0.62) { kind = 2.0; sh = k < 1.0 ? 0.8 : 0.55; }
  } else {
    // the plate: its own tone, lighter at the top (the sky) and darker toward its foot
    sh = 0.43 + ${f(LIFT * 0.5)} + (ph - 0.5) * 0.11;
    sh += cy < ch * 0.3 ? 0.05 : cy > ch * 0.72 ? -0.05 : 0.0;
    // the cornice's shadow on the course under it: three steps
    float under = ty - lipH - 1.0;
    if (under < 9.0) sh -= under < 3.0 ? 0.24 : under < 6.0 ? 0.15 : 0.07;
    // bevels: lit top and planet-side edges, dark foot and far edge, a dark joint
    bool joint = px < 1.0 || cy < 0.0 || cy >= ch - 1.0;
    if (joint) sh = 0.07;
    else if (cy < 1.0) sh = 0.66;
    else if (px < 2.0) sh += ${f(S > 0 ? 0.14 : -0.12)};
    else if (px > pw - 3.0) sh += ${f(S > 0 ? -0.12 : 0.14)};
    else if (cy > ch - 3.0) sh -= 0.12;
    // material: worn bright patches and pitting, in small clusters
    float n1 = vnoise(p / 3.5 + pid * 3.7);
    float wearK = hash2(vec2(pid, ${f(o.seed + 37)}));
    if (!joint && n1 > 0.86 - wearK * 0.08) sh += 0.05;
    else if (!joint && n1 < 0.08 + wearK * 0.06) sh -= 0.05;
    // rivet heads under each plate's top and down its planet-side edge (lit dot, its shadow under it)
    if (abs(cy - 3.0) < 0.5 && mod(px - 4.0, 8.0) < 1.0 && px > 3.0 && px < pw - 3.0) sh = 0.78;
    else if (abs(cy - 4.0) < 0.5 && mod(px - 4.0, 8.0) < 1.0 && px > 3.0 && px < pw - 3.0) sh -= 0.12;
    else if (px >= 3.0 && px < 4.0 && mod(cy, 9.0) < 1.0 && cy > 5.0) sh = 0.72;
    // chipped corners: a bite of dark with a lit edge, on some plates
    float chip = hash2(vec2(pid, ${f(o.seed + 31)}));
    if (chip > 0.7 && !joint) {
      vec2 cc = chip > 0.85 ? vec2(px, cy) : vec2(pw - px, ch - cy);
      float r = cc.x + cc.y;
      if (r < 4.0) sh = 0.1;
      else if (r < 5.0) sh = chip > 0.85 ? 0.7 : 0.3;
    }
    // cracks on a few plates
    if (!quiet && ph > 0.86 && !joint) {
      float cr = crackAt(vec2(px, cy), pw, ch, pid);
      if (cr == 1.0) sh = 0.06;
      else if (cr == 2.0) sh += 0.12;
    }
    // rust: blooms along the foot of a plate, and drips from its rivets and seams
    float rb = vnoise(vec2(p.x / 6.0, pid));
    float rustK = hash2(vec2(pid, ${f(o.seed + 43)}));
    if (!joint && rustK > 0.62 && cy > ch - 7.0 && rb > 0.6 + (cy - ch + 7.0) * 0.03) { kind = 1.0; sh = 0.36 + (rb - 0.58) * 0.8; }
    float dc = floor(p.x / 2.0);
    float dh = hash2(vec2(dc, tier * 1.7 + (lower ? 9.0 : 0.0) + ${f(o.seed + 23)}));
    if (!joint && dh < 0.07 && mod(p.x, 2.0) < 1.0) {
      float len = 10.0 + dh * 420.0;
      float st = (cy - 4.0) / len;
      if (st > 0.0 && st < 1.0 && bayer4(p) < 1.0 - st * 0.8) { kind = 1.0; sh = st < 0.3 ? 0.55 : st < 0.65 ? 0.4 : 0.28; }
    }
    // old water: long dark streaks from the cornice, fading as they fall
    float sc = floor(p.x / 3.0);
    float sk = hash2(vec2(sc, tier * 1.3 + ${f(o.seed + 41)}));
    if (sk < 0.08 && mod(p.x, 3.0) < 2.0 && kind == 0.0) {
      float st = (ty - lipH) / (20.0 + sk * 900.0);
      if (st < 1.0) sh -= (st < 0.35 ? 0.07 : st < 0.7 ? 0.05 : 0.03) * step(bayer4(p) * 0.6, 1.0 - st);
    }
    // moss in the lee of the cornice, hanging from its soffit in tufts
    float mt = vnoise(vec2(p.x / 9.0, tier * 3.1));
    float mlen = floor(hash2(vec2(floor(p.x), tier)) * 5.0);
    if (mt > 0.62 && under < mlen && !quiet) { kind = 2.0; sh = 0.42 - under * 0.05; }
    // a hatch now and then: a recessed door in the plate, lit frame, dark recess, a handle
    if (!quiet && ph < 0.05 && px > pw * 0.3 && px < pw * 0.3 + 16.0 && cy > 6.0 && cy < ch - 4.0 && kind == 0.0) {
      float hx = px - pw * 0.3, hy = cy - 6.0;
      float hh2 = ch - 10.0;
      sh = (hx < 1.0 || hy < 1.0) ? 0.24 : (hx > 14.0 || hy > hh2 - 1.0) ? 0.66 : hx < 3.0 || hy < 2.0 ? 0.18 : 0.34;
      if (abs(hx - 12.0) < 1.0 && abs(hy - hh2 * 0.5) < 2.0) sh = 0.8;
    }
  }
  ${o.rib > 0 ? `
  // buttress ribs standing proud: light on the planet side, a cast shadow on the other
  float rw = 14.0;
  float rx = mod(p.x + ${f(o.seed * 7)}, ${f(o.rib)});
  if (into > 12.0 && !quiet) {
    float rs = ${f(S)} > 0.0 ? rx : rw - rx;
    if (rx < rw) {
      kind = 0.0;
      sh = rs < 2.0 ? 0.78 : rs < 4.0 ? 0.6 : rs < rw - 3.0 ? 0.44 - 0.02 * floor(rs / 4.0) : 0.16;
      // bolted bands across the rib
      if (mod(p.y, 38.0) < 2.0) sh = mod(p.y, 38.0) < 1.0 ? 0.74 : 0.12;
      // rust running down the rib's shadow side
      if (rs >= rw - 5.0 && rs < rw - 3.0 && hash2(vec2(floor(p.y / 60.0), rx)) > 0.6) { kind = 1.0; sh = 0.34; }
    }
    else if (rx < rw + 8.0 && ${f(S)} > 0.0) sh -= rx < rw + 4.0 ? 0.16 : 0.08;
    // conduits beside every other rib, with blue running lights
    float cx = rx - rw - 20.0;
    if (mod(floor((p.x + ${f(o.seed * 7)}) / ${f(o.rib)}), 2.0) < 1.0 && cx >= 0.0 && cx < 5.0) {
      kind = 0.0;
      sh = cx < 1.0 ? 0.62 : cx > 3.0 ? 0.12 : 0.36;
      if (mod(p.y, 46.0) < 3.0) sh = mod(p.y, 46.0) < 1.0 ? 0.7 : 0.2;
      float run = mod(p.y * 0.25 + uTime * 6.0 * (1.0 - 0.7 * uReduced) + floor((p.x + ${f(o.seed * 7)}) / ${f(o.rib)}) * 13.0, 40.0);
      if (cx >= 1.0 && cx <= 3.0 && run < 1.0) {
        vec3 bc = pal(R_WIN, 1.0);
        return vec4(applyFog(bc, uFog * 0.5, 0.0, p, s), 1.0);
      }
    }
  }` : ""}
  // the silhouette: a lit bevel toward the planet, then a dark crease
  if (into < 3.0) { kind = 0.0; sh = 0.86 - into * 0.08; }
  else if (into < 6.0) { kind = 0.0; sh = into < 4.0 ? 0.3 : 0.1; }
  ${o.channel ? `
  // the lift's channel: a deep slot with two rails
  if (p.x >= ${f(o.channel[0])} && p.x < ${f(o.channel[1])}) {
    float cx2 = p.x - ${f(o.channel[0])};
    float cw = ${f(o.channel[1] - o.channel[0])};
    kind = 0.0;
    sh = 0.03;
    if (cx2 < 3.0 || cx2 > cw - 4.0) sh = cx2 < 1.0 || cx2 > cw - 2.0 ? 0.6 : 0.24;
    if (abs(cx2 - cw * 0.3) < 1.0 || abs(cx2 - cw * 0.7) < 1.0) sh = 0.32;
  }` : ""}
  ${(o.scars ?? []).length ? `
  // lightning scars: soot blown out in rays, the plates torn off to the dark ribs behind, a scorched rim
  // with a few embers still glowing in it
  ${o.scars!.map(([x, y, r]) => `{
    vec2 d = p - vec2(${f(x)}, ${f(y)});
    float a = atan(d.y, d.x);
    float rr = length(d) / ${f(r)} + (vnoise(vec2(a * 3.0, ${f(x)})) - 0.5) * 0.35;
    float ray = vnoise(vec2(a * 9.0, 1.0));
    if (rr < 0.55) {
      kind = 0.0;
      // behind the plate: the dark frame, ribs every 9 px, one lit edge on each
      float rib = mod(p.x + 2.0, 9.0);
      sh = rib < 2.0 ? (rib < 1.0 ? 0.3 : 0.18) : 0.04 + 0.03 * step(mod(p.y, 13.0), 1.0);
      if (rr > 0.47) { kind = 1.0; sh = 0.62 - (rr - 0.47) * 3.0; if (hash2(floor(p / 2.0)) > 0.86) return vec4(applyFog(pal(R_AMBER, 2.0 + step(0.95, hash2(floor(p / 2.0) + 3.0))), uFog * 0.5, 0.0, p, s), 1.0); }
    } else if (rr < 0.68) { sh = 0.06 + (rr - 0.55) * 0.6; kind = 0.0; }
    else if (rr < 1.0 + ray * 0.8) { sh -= (1.0 - (rr - 0.68) / (0.32 + ray * 0.8)) * 0.24 * step(bayer4(p) * 0.7, 1.0 - (rr - 0.68)); }
  }`).join("\n  ")}` : ""}
  ${(o.marks ?? []).length ? `
  // the route's marks: red chevrons painted up the plating where a flight begins, worn by the weather
  ${o.marks!.map(([x, y, z]) => `{
    vec2 d = (p - vec2(${f(x)}, ${f(y)})) / ${f(z)};
    if (abs(d.x) < 1.0 && d.y > -1.6 && d.y < 1.6 && sh > 0.12) {
      float row = floor((d.y + 1.6) / 0.8);
      float cy = -1.6 + row * 0.8 + 0.35 - abs(d.x) * 0.45;
      if (abs(d.y - cy) < 0.14 && vnoise(p / 2.0) > 0.28) { kind = 3.0; sh = 0.5 + 0.1 * step(d.y, cy); }
    }
  }`).join("\n  ")}` : ""}
  // a doorway's surround meets the plating with a dark joint, and throws its shadow downwind
  if (od > 0.0 && od < 3.0) sh = od < 2.0 ? 0.03 : sh - 0.12;
  if (castS > 0.5) sh -= 0.16;
  // the iron bolted to the face (catwalks, flights) throws its shadow on it
  float shd = ironShadow(p);
  vec3 c;
  float light = flashLight(s) * 0.7 + sceneLight(s, uDepth);
  // lit window slots, grouped in a few plates per tier, each in a recessed frame
  float win = hash2(vec2(pc * 3.0 + 1.0, tier * 7.0 + ${f(o.seed + 9)}));
  float wy0 = floor(T * 0.3);
  bool winRow = !quiet && body && win < ${f(o.windows)} && into > 16.0 && px > pw * 0.25 && px < pw * 0.25 + (win < ${f(o.windows * 0.4)} ? 24.0 : 10.0);
  if (winRow && ty > wy0 - 2.0 && ty < wy0 + 11.0) {
    bool slot = ty > wy0 && ty < wy0 + 9.0 && mod(px - pw * 0.25, 7.0) < 3.0;
    if (slot && shd < 0.5) {
      float tw = uReduced > 0.5 ? 1.0 : step(0.1, vnoise(vec2(uTime * 0.15 + win * 50.0, win * 13.0)));
      c = pal(win < ${f(o.windows * 0.5)} ? R_WIN : R_WINDIM, tw > 0.5 ? (ty < wy0 + 2.0 ? 2.0 : 1.0) : 0.0);
      return vec4(applyFog(c, uFog * 0.6, 0.0, p, s), 1.0);
    }
    // the slots' frame: a sill catching the light under them, a dark recess around them
    kind = 0.0;
    sh = ty >= wy0 + 9.0 ? (ty < wy0 + 10.0 ? 0.74 : 0.2) : 0.12;
  }
  ${o.wet ? `
  // rain running down the face: thin bright threads that slide down
  float rc = floor(p.x / 3.0);
  float rh = hash2(vec2(rc, ${f(o.seed + 17)}));
  if (rh < 0.25 * max(uWx.x, 0.5) && into > 6.0 && shd < 0.75) {
    float ry = mod(p.y - uTime * (34.0 + 40.0 * rh) * (1.0 - 0.6 * uReduced) + rh * 500.0, 80.0 + rh * 70.0);
    if (ry < 12.0 && mod(p.x, 3.0) < 1.0) sh += 0.12 + light * 0.3;
  }` : ""}
  // in the iron's shadow the face loses its sheen and most of its light
  sh -= shd * ${f(0.2 + LIFT * 0.6)};
  light *= 1.0 - shd * 0.6;
  float lit = sh + light * (0.3 + 0.5 * step(0.4, sh));
  if (kind == 3.0) c = ramp(R_ROUTE, lit * 0.9, p, 0.0);
  else if (kind == 1.0) c = ramp(R_RUSTF, lit, p, 0.0);
  else if (kind == 2.0) c = ramp(R_VERD, lit, p, 0.0);
  else c = ramp(R_PLATE, lit, p, 0.0);
  // the alcove's candles and the lamps spill warm light onto the plating around them
  float wp = warmPool(p) * (1.0 - shd * 0.5);
  if (wp > 0.0) c = mix(c, ramp(R_AMBER, clamp(sh * 0.9 + 0.05, 0.0, 0.62) + wp * 0.18, p, 0.0), wp * 0.55);
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`,
  };
}


/** Sprite count helper for a straight mist layer tinted to the storm (kept here so every spire room grades alike). */
export function stormCloud(o: { name: string; depth: number; y0: number; y1: number; sx: number; sy: number; drift: number; cover: number; tone: number; alpha: number; levels?: number; bounds?: { y0: number; y1: number } }): GlslLayer {
  return {
    kind: "glsl",
    name: o.name,
    depth: o.depth,
    bounds: o.bounds ?? { y0: o.y0, y1: o.y1 + 1 },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float y0 = ${f(o.y0)}, y1 = ${f(o.y1)};
  if (p.y < y0 || p.y > y1) return vec4(0.0);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float px = p.x - floor(tm * ${f(o.drift)} + 0.5);
  vec2 q = vec2(px / ${f(o.sx)}, p.y / ${f(o.sy)});
  float t = tm * 0.05;
  vec2 w = vec2(fbm(q * 0.5 + vec2(0.0, t), 2), fbm(q * 0.5 + vec2(5.2, 1.3 - t * 0.8), 2)) - 0.5;
  float n = fbm(q + 1.5 * w + vec2(t * 0.4, -t * 0.2), 4);
  float prof = smoothstep(y0, y0 + ${f((o.y1 - o.y0) * 0.3)}, p.y) * (1.0 - smoothstep(y1 - ${f((o.y1 - o.y0) * 0.3)}, y1, p.y));
  float d = clamp((n * prof - (1.0 - ${f(o.cover)}) * 0.62) / (${f(o.cover)} * 0.62 + 0.05), 0.0, 1.0);
  float L = ${f(o.levels ?? 3)};
  float lv = floor(d * L + (bayer4(p) - 0.5) * 0.35);
  if (lv <= 0.0) return vec4(0.0);
  lv = min(lv, L);
  // lightning lights the cloud in its own shape; the top of each mass catches it most
  float fl = flashLight(s);
  float top = 1.0 - smoothstep(0.0, 0.5, d);
  // light from behind (the planet) catches the thin edges: a silver lining
  float back = sceneLight(s, uDepth);
  float tone = ${f(o.tone)} + 0.1 * (lv - 1.0) + fl * (0.35 + 0.4 * top) + back * (0.15 + 0.85 * top);
  vec3 c = ramp(${rowRef("cloud")}, tone, p, 0.0);
  if (fl > 0.25) c = mix(c, ramp(${rowRef("stormlit")}, fl * 0.8 * (0.5 + 0.5 * top), p, 0.0), step(0.3, fl * (0.5 + top)));
  c = mix(fogColor(s), c, 0.8);
  c = applyFog(c, uFog, 0.0, p, s);
  // the dense core is opaque, the thin rims let the sky through
  return vec4(c, ${f(o.alpha)} * (lv >= L ? 1.0 : 0.35 + 0.55 * (lv - 1.0) / max(1.0, L - 1.0)));
}`,
  };
}

// --- the near foreground ------------------------------------------------------------------

/** Pieces of the near foreground (layer px at the layer's depth). */
export type ForeEl =
  /** A lattice column running between y0 and y1: two flanges, X lacing, batten plates, bolts. */
  | { kind: "girder"; x: number; w: number; y0: number; y1: number }
  /** A hanging chain (links alternately face-on and edge-on), swaying a little with the storm. */
  | { kind: "chain"; x: number; y0: number; y1: number; sway?: number }
  /** A sagging cable between two points. */
  | { kind: "cable"; x0: number; y0: number; x1: number; y1: number; sag: number }
  /** A parapet along the bottom: posts every `post` px, a top rail, a mid rail, chains swagged between the posts; solid below `y + 30`. */
  | { kind: "rail"; y: number; x0: number; x1: number; post: number }
  /** A broken beam jutting up from below the frame, leaning, its top torn off. */
  | { kind: "spar"; x: number; y: number; w: number; h: number; lean: number };

function foreElGlsl(e: ForeEl, i: number): string {
  switch (e.kind) {
    case "girder":
      return `  { float gx = p.x - ${f(e.x)}; float gy = p.y - ${f(e.y0)};
    if (gx >= 0.0 && gx < ${f(e.w)} && p.y >= ${f(e.y0)} && p.y < ${f(e.y1)}) {
      float W = ${f(e.w)};
      if (gx < 4.0 || gx >= W - 4.0) { sh = max(sh, 0.3); if (gx < 1.0) rim = 1.0; if (gx >= W - 1.0) rim = -1.0; }
      float bay = W * 1.3;
      float by = mod(gy, bay) / bay;
      float t = (gx - 4.0) / (W - 8.0);
      if (abs(by - t) * bay < 1.5 || abs(by - (1.0 - t)) * bay < 1.5) sh = max(sh, 0.26);
      if (mod(gy, bay * 3.0) < 6.0) { sh = max(sh, 0.34); if (mod(gy, bay * 3.0) < 1.0) rim = 0.5; }
      if ((gx < 4.0 || gx >= W - 4.0) && mod(gy, 12.0) < 1.0 && abs(gx - (gx < 4.0 ? 2.0 : W - 2.0)) < 1.0) bolt = 1.0;
    } }`;
    case "chain":
      return `  { float sw = uReduced > 0.5 ? 0.0 : floor(sin(uTime * 0.7 + ${f(i * 1.7)}) * ${f(e.sway ?? 2)} * clamp((p.y - ${f(e.y0)}) / ${f(Math.max(1, e.y1 - e.y0))}, 0.0, 1.0) + 0.5);
    float cx = p.x - ${f(e.x)} - sw; float cy = mod(p.y - ${f(e.y0)}, 14.0);
    if (p.y >= ${f(e.y0)} && p.y < ${f(e.y1)} && abs(cx) < 3.0) {
      bool face = cy < 7.0;
      if (face) { float r = length(vec2(cx, (cy - 3.5) * 0.75)); if (r < 3.0 && r > 1.4) { sh = max(sh, 0.32); if (cx < -1.5) rim = 1.0; } }
      else if (abs(cx) < 1.0) { sh = max(sh, 0.28); }
    } }`;
    case "cable": {
      return `  { float t = (p.x - ${f(e.x0)}) / ${f(e.x1 - e.x0 || 1)};
    if (t >= 0.0 && t <= 1.0) { float yl = mix(${f(e.y0)}, ${f(e.y1)}, t) + ${f(e.sag)} * 4.0 * t * (1.0 - t);
      if (p.y >= floor(yl) && p.y < floor(yl) + 2.0) { sh = max(sh, 0.26); if (p.y < floor(yl) + 1.0) rim = 0.5; } } }`;
    }
    case "rail":
      return `  { if (p.x >= ${f(e.x0)} && p.x < ${f(e.x1)} && p.y >= ${f(e.y)}) {
      float ry = p.y - ${f(e.y)};
      float pp = mod(p.x - ${f(e.x0)}, ${f(e.post)});
      float sw = ${f(e.post)};
      // the parapet wall below, its coping catching a line of light
      if (ry >= 30.0) { sh = max(sh, ry < 33.0 ? 0.42 : 0.2); if (ry < 31.0) rim = 1.0; if (mod(p.x + floor(ry / 14.0) * 19.0, 38.0) < 1.0 && ry > 34.0) sh = 0.1; }
      else if (pp < 6.0) { sh = max(sh, 0.3); if (pp < 1.0) rim = 1.0; if (ry < 3.0) sh = 0.4; }
      else if (ry < 4.0) { sh = max(sh, 0.32); if (ry < 1.0) rim = 1.0; }
      else if (ry >= 16.0 && ry < 18.0) sh = max(sh, 0.24);
      else {
        // a chain swagged between the posts
        float t = (pp - 6.0) / (sw - 6.0);
        float cy = 7.0 + 12.0 * 4.0 * t * (1.0 - t);
        if (abs(ry - cy) < 1.0 && mod(pp, 4.0) < 3.0) sh = max(sh, 0.28);
      }
    } }`;
    case "spar":
      return `  { float sy = p.y - ${f(e.y)};
    float sx = p.x - (${f(e.x)} + (${f(e.h)} - sy) * ${f(e.lean)});
    float top = floor(hash2(vec2(floor(sx / 4.0), ${f(i + 3)})) * 10.0);
    if (sy >= top && sy < ${f(e.h)} + 400.0 && sx >= 0.0 && sx < ${f(e.w)}) {
      sh = max(sh, 0.3);
      if (sx < 2.0) rim = 1.0;
      if (sy < top + 2.0) rim = 0.6;
      if (sx > ${f(e.w)} - 4.0) sh = 0.16;
      if (mod(sy, 22.0) < 2.0 && sx > 3.0 && sx < ${f(e.w)} - 4.0) sh = 0.2;
      if (mod(sy + 11.0, 22.0) < 1.0 && abs(sx - ${f(e.w)} * 0.5) < 1.0) bolt = 1.0;
    } }`;
  }
}

/**
 * The near foreground (in front of her, `pass: "front"`): dark, greyer silhouettes (girders, chains,
 * cables, a parapet, a broken spar) that frame the room's edges and corners, with a single cool rim on
 * the side the light comes from. Darker and less saturated than anything at her depth (the value
 * ladder: foreground darkest, playfield mid, sky lightest); placed where they frame, never where she
 * stands to read the room.
 */
export function foreFrame(o: { name: string; depth: number; els: ForeEl[]; bounds?: { y0: number; y1: number; x0?: number; x1?: number } }): WorldLayer {
  const layer: GlslLayer = {
    kind: "glsl",
    name: o.name,
    depth: o.depth,
    fog: 0,
    dither: 0,
    bounds: o.bounds,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float sh = -1.0;
  float rim = 0.0;
  float bolt = 0.0;
${o.els.map((e, i) => foreElGlsl(e, i)).join("\n")}
  if (sh < 0.0) return vec4(0.0);
  float lit = sh + flashLight(s) * 0.25;
  if (rim > 0.75) lit = 0.85;
  else if (rim > 0.25) lit = 0.62;
  else if (rim < -0.5) lit = 0.08;
  if (bolt > 0.5) lit = 0.7;
  return vec4(ramp(R_FORE, lit, p, 0.0), 1.0);
}`,
  };
  const w = layer as WorldLayer;
  w.pass = "front";
  return w;
}

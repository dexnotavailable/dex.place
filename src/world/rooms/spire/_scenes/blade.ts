// D4 the Blade's backdrop (w02 turning into w03): the storm breaks. You come
// out of the Crown in heavy rain onto the monolith's top edge; at x 292 the
// cloud tears open in stepped bands over about 4 s (each band keyed to the
// weather's clearing, uWx2.w) and you are above the weather for the first
// time. A low dusk sun sits in the ring's hole in the west, the planet sets
// behind the spire's blade in the east, and far below: the lake with the sun
// on it, the lodge's cliff, the plain with the causeway, two colossi walking
// with birds wheeling over their backs, the hollow's mouth, and the lamps you
// have lit as points of light (the save's shrine flags, from the storm
// driver). The storm stays sitting on the spire behind you. Wet iron turns
// gold.

import { f, placeByDepth, Flock, disc, sky, type LayerDef, type PointSystem, type SceneDef } from "../../../../scenes/engine/index.ts";
import type { PointSink, SimEnv } from "../../../../scenes/engine/types.ts";
import { EXTENT, LEGS, colossusGlsl, type ColossusDef } from "../../../../scenes/scenes/colossus-plain/colossus.ts";
import { Wheelers } from "../../../../scenes/scenes/colossus-plain/systems.ts";
import { planetBody } from "../../../../scenes/scenes/monolith-planet/planet.ts";
import { billows } from "../../../../scenes/scenes/monolith-planet/clouds.ts";
import type { WorldLayer } from "../../../backdrop/engine.ts";
import { STORM } from "../../../../pixel/props/spire/storm.ts";
import { SPIRE_PALETTE, clockLayer, cloudLightning, gustRain } from "./common.ts";

export interface BladeGeo {
  /** Room size (px) and the camera's top row while standing near the break (rail camera). */
  w: number;
  h: number;
  camY: number;
  /** The walking edge in room px: from (x0, y0) up to the tip (x1, y1). */
  edge: [number, number, number, number];
}

/** The lamps you have lit, far below: one warm point per lit shrine (the save, via the storm driver). */
class LitLamps implements PointSystem {
  private t = 0;
  constructor(
    private at: [number, number][],
    private row: number,
  ) {}
  update(_dt: number, env: SimEnv): void {
    this.t = env.t * (env.reduced ? 0.3 : 1);
  }
  draw(sink: PointSink): void {
    this.at.forEach(([x, y], i) => {
      if (!STORM.lit[i]) return;
      // a lamp you lit reads from the top of the spire: a wide warm halo, a bright core, and a thin
      // column of its light rising into the dusk haze (stepped, no smooth fade)
      const fl = Math.sin(this.t * 1.3 + i * 2.1) > 0.8 ? 0.8 : 1;
      sink.push(x - 9, y - 9, 19, 3, this.row, 0.35 * fl, 0, 0.4);
      sink.push(x - 5, y - 5, 11, 3, this.row, 0.5 * fl, 0, 0.65);
      sink.push(x - 2, y - 2, 5, 3, this.row, 0.65 * fl, 0, 0.9);
      sink.push(x - 1, y - 1, 3, 0, this.row, 0.8 * fl, 0, 1);
      for (let k = 3; k < 19; k++) sink.push(x, y - k, 1, 0, this.row, 0.7 * fl, 0, k < 8 ? 0.6 : k < 13 ? 0.4 : 0.2);
    });
  }
}

/** A colossus far below, walking west across the plain (small: seen from the top of the spire). */
function below(o: { S: number; ground: number; W: number; startAt: number; vd: number; seed: number; T: number }): ColossusDef {
  const x0 = o.W + (EXTENT.x1 + 60) * o.S;
  const xEnd = -(EXTENT.x1 + 60) * o.S;
  const cross = (x0 - xEnd) / (o.vd * o.S);
  return {
    S: o.S,
    ground: o.ground,
    x0,
    period: cross + 20,
    t0: (x0 - o.startAt * o.W) / (o.vd * o.S),
    vd: o.vd,
    T: o.T,
    duty: 0.64,
    lift: 22,
    bob: 3,
    legs: LEGS,
    far: { dx: 18, dy: 6, phase: 0.5, scale: 0.84 },
    dendrites: true,
    seed: o.seed,
  };
}

/**
 * The stepped storm-break: a band of solid storm deck. Until the weather's
 * clearing (uWx2.w, 0..1 as you cross x 292) passes `at`, it covers its band
 * completely; then it tears open in quarter steps, the thin places first,
 * holes widening until it is gone. Lightning lights it in its own shape.
 */
function band(o: { name: string; depth: number; y0: number; y1: number; at: number; tone: number; u: number; drift: number; soft?: number }): LayerDef {
  const soft = o.soft ?? 24 * o.u;
  return {
    kind: "glsl",
    name: o.name,
    depth: o.depth,
    fog: 0.08,
    bounds: { y0: o.y0 - soft, y1: o.y1 + soft },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float open = clamp((uWx2.w - ${f(o.at)}) / 0.14, 0.0, 1.0);
  open = floor(open * 4.0 + 0.5) / 4.0;
  if (open >= 1.0) return vec4(0.0);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float px = p.x - floor(tm * ${f(o.drift)} + 0.5);
  vec2 q = vec2(px / ${f(150 * o.u)}, p.y / ${f(46 * o.u)});
  vec2 w = vec2(fbm(q * 0.5 + vec2(0.0, tm * 0.04), 2), fbm(q * 0.5 + vec2(5.2, 1.3), 2)) - 0.5;
  float n = fbm(q + 1.4 * w, 4);
  // the band's edges are ragged, not ruled
  float e = min(p.y - ${f(o.y0)}, ${f(o.y1)} - p.y) / ${f(soft)} + (n - 0.5) * 1.6;
  if (e < 0.0) return vec4(0.0);
  // tearing: the thin places open first
  if (n < open * 1.15 - 0.05 + (bayer4(p) - 0.5) * 0.04) return vec4(0.0);
  float fl = flashLight(s);
  float rim = 1.0 - smoothstep(0.0, 0.08, n - (open * 1.15 - 0.05));
  float tone = ${f(o.tone)} + 0.14 * (n - 0.4) + fl * 0.5 + rim * 0.12 * step(0.01, open);
  vec3 c = ramp(R_CLOUD, tone, p, 0.0);
  if (fl > 0.3) c = mix(c, ramp(R_STORMLIT, fl * 0.7, p, 0.0), 0.5);
  return vec4(applyFog(c, uFog, 0.0, p, s), 1.0);
}`,
  };
}

export function bladeScene(geo: BladeGeo): SceneDef {
  return {
    title: "spire-blade",
    palette: {
      ...SPIRE_PALETTE,
      sun: ["#e8b070", "#f6d49a", "#fff2d0"],
      planet: ["#3a2a3a", "#523a4a", "#6e5058", "#8e6a6a", "#b08a80", "#cfae9a", "#e8ceb4"],
      rim: ["#7a4a5a", "#b06a6a", "#e0a08a", "#f8d8c0"],
      sunhalo: ["#c86a4a", "#e89a60", "#f6c486"],
      ringd: ["#1c1420", "#2a1d28", "#3c2a33", "#5a3c3e", "#8a5a4a", "#d8955e"],
      dusk: ["#1c1830", "#3a2a48", "#6a3e58", "#a4586a", "#d8826a", "#f4b27a", "#fcdca0"],
      land: ["#140f18", "#1e1620", "#2a1e2a", "#3a2934", "#4e3840"],
      lake: ["#2a2440", "#4a3858", "#8a5a6a", "#d4926a", "#f8d49a"],
      mote: ["#6a4a4a", "#c08a6a", "#f6d0a0"],
      lamp: ["#6a3010", "#e08a3a", "#ffe0a0"],
      flesh: ["#3a2a36", "#54404a", "#76585e", "#a07a72", "#d0a48a"],
      tar: ["#0e0a10", "#181018", "#241820", "#34242c", "#4a363a"],
      vein: ["#46302c", "#6a3b33", "#8e4f40", "#ad6a50"],
      dust: ["#3e3040", "#56424e", "#745a60", "#947670", "#b8988a"],
      goldedge: ["#3a2418", "#6a4020", "#b07434", "#f0b060"],
      cloudd: ["#2a2036", "#3e2c46", "#6a4458", "#a4606a", "#d68a72", "#f4b886", "#fcdcae"],
    },
    fog: {
      stops: [
        [0.0, "#141428"],
        [0.16, "#26203c"],
        [0.3, "#4a2e4e"],
        [0.4, "#8a4a5a"],
        [0.47, "#d88a68"],
        [0.5, "#f2b27a"],
        [0.53, "#9a6068"],
        [0.7, "#4a3448"],
        [1.0, "#1e1826"],
      ],
      bands: 22,
      density: 0.035,
      max: 0.75,
      dither: 0.45,
      glow: { x: 0.3, y: 0.46, r: 0.5, colour: "#f6c080", strength: 0.5, steps: 6, dither: 0.4 },
    },
    span: (W) => W,
    prelude: (ctx) => /* glsl */ `
// the low sun lights the undersides and rims of what faces west; the storm's lightning still flickers on the spire behind
float sceneLight(vec2 s, float depth) {
  float d = length((s - vec2(${f(ctx.W * 0.3)}, ${f(ctx.H * 0.46)})) / vec2(${f(ctx.W * 0.5)}, ${f(ctx.H * 0.35)}));
  return 0.25 * uWx2.w * (1.0 - smoothstep(0.2, 1.2, d));
}`,
    build: (ctx) => {
      const { W, H, u } = ctx;
      const L: LayerDef[] = [];
      const hor = Math.round(H * 0.5);
      L.push(sky({ name: "sky" }));
      L.push(clockLayer());
      // the planet setting behind the spire's blade (east)
      L.push({ kind: "glsl", name: "planet", depth: Infinity, fog: 0.22, dither: 0.5, body: planetBody({ x: W * 0.86, y: hor + H * 0.08, r: H * 0.28, halo: 0.025 }), bounds: { y0: hor - H * 0.28 * 1.1, y1: hor + 2 } });
      // the sun low in the west, in the ring's hole
      L.push(disc({ name: "sun", x: W * 0.3, y: H * 0.46, r: 13 * u, row: "sun", halo: { r: 3.2, strength: 0.5, steps: 5, seam: 0.3 }, dither: 0.3 }));
      L.push(ringBody(W * 0.32, H * 0.445, 66 * u, 0.33, u));
      // far below: hills, the lake with the sun on it, the lodge's cliff, the plain, the causeway
      L.push(worldBelow(W, H, u, hor));
      // colossi walking west across the plain, birds over their backs
      {
        const far = below({ S: 0.12 * u, ground: hor + 30 * u, W, startAt: 0.8, vd: 9, seed: 5, T: 5.2 });
        const near = below({ S: 0.2 * u, ground: hor + 58 * u, W, startAt: 0.97, vd: 11, seed: 9, T: 4.8 });
        for (const [name, c, d] of [["colossus-far", far, 48], ["colossus-near", near, 34]] as const) {
          // (light haze only, and in shadow but for the low sun on their west sides: solid giants in clear
          // evening air, not pale ghosts)
          L.push({ kind: "glsl", name, depth: d, fog: 0.06, body: colossusGlsl(c, { farFog: 0.12, rearFog: 0.12, groundFog: 0.14, groundH: 30, key: [-0.9, 0.3, 0.3], rim: [-1, 0.2], fill: -0.12 }), bounds: { y0: c.ground - (EXTENT.y1 + 20) * c.S, y1: c.ground + 2 }, dither: 0.15 });
          L.push({ kind: "points", name: `${name}-birds`, depth: d, fog: 0.4, system: new Wheelers(c, ctx.row("bird"), 6, ctx.rng) });
        }
      }
      // what is left of the lower cloud, lit rose from beneath by the sun
      L.push(billows({ name: "cloud-sea", depth: 26, base: hor + 90 * u, wander: 8 * u, cell: 30 * u, radius: 16 * u, bottom: H + 400, drift: 2, row: "cloudd", tone: 0.28, range: 0.55, tint: 0.35, lightGain: 1.8, seed: 12, crown: 0.7 }));
      // the lamps you have lit (shrines 1-6), far below along the way you came. From the tip (the rail
      // camera sits at the room's east clamp there) the edge you climbed covers the middle of the view
      // from about (0, 567) up to the deck at (1013, 267) (view px at 1280 x 720), and the storm covers
      // the far left, so every lamp stands where the tip can see it: the yard on the lake's near shore
      // (west, under the sun), the shelter out on the plain, the hollow's mouth on its knoll, the alcove
      // on the spire's flank straight below the tip, the pilgrim shrine and the porch down the ring
      // segment in the east
      const lamps: [number, number][] = [
        [Math.round(W * 0.21), hor + 4 * u],
        [Math.round(W * 0.37), hor + 30 * u],
        [Math.round(W * 0.46 + 10 * u), hor + 2 * u],
        [Math.round(W * 0.83), hor + 50 * u],
        [Math.round(W * 0.9), hor + 64 * u],
        [Math.round(W * 0.97), hor + 86 * u],
      ];
      L.push({ kind: "points", name: "lit-lamps", depth: 40, fog: 0.1, blend: "add", system: new LitLamps(lamps, ctx.row("lamp")) });
      // the storm, still sitting on the spire behind you (west): it never clears
      {
        L.push(spireStorm(W, H, u));
        L.push(cloudLightning(ctx, { name: "spire-lightning", depth: 60, rate: 1.5, region: [0, H * 0.05, W * 0.08, H * 0.45], radius: 90 * u, strength: 0.4 }));
      }
      // the stepped storm-break: bands of storm that part one after another as the clearing passes
      L.push(band({ name: "break-3", depth: 80, y0: hor - 70 * u, y1: hor + 60 * u, at: 0.05, tone: 0.12, u, drift: 5 }));
      L.push(band({ name: "break-2", depth: 80, y0: H * 0.22, y1: hor - 30 * u, at: 0.25, tone: 0.1, u, drift: 6 }));
      L.push(band({ name: "break-4", depth: 70, y0: hor + 30 * u, y1: H + 60, at: 0.45, tone: 0.14, u, drift: 7 }));
      L.push(band({ name: "break-1", depth: 80, y0: -H * 0.35, y1: H * 0.3, at: 0.62, tone: 0.08, u, drift: 5 }));
      const cl = cloudLightning(ctx, { name: "break-lightning", depth: 60, rate: 3, region: [0, 10, W, H * 0.7], radius: 170 * u, strength: 0.6 });
      cl.wx = (w) => 1 - Math.min(1, w.after * 1.6);
      L.push(cl);
      // the blade under your feet, falling away below the edge; its lit top turns gold as the sky clears
      L.push(bladeFace(ctx.W, ctx.H, geo, ctx.span));
      // birds again, in the clear air
      const fl = { kind: "points", name: "dusk-birds", depth: 12, system: new Flock({ y: [H * 0.2, H * 0.4], x: [-60, W + 60], every: 30, speed: 16 * u, count: [3, 6], row: ctx.row("bird"), shade: 0.3 }) } as WorldLayer;
      fl.wx = (w) => w.after;
      L.push(fl);
      L.push(gustRain({ name: "rain-far", depth: 5, cw: 5, len: 7 * u, speed: 210 * u, alpha: 0.4, dens: 0.7, seed: 17, shade: 0.28, lean: 0.2, tellLean: 0.12, gustLean: 0.38, floor: 0 }));
      L.push({ kind: "character", name: "figure", depth: 1, x: W / 2, ground: Math.round(H * 0.62) });
      L.push(gustRain({ name: "rain-near", depth: 0.8, cw: 12, len: 16 * u, speed: 440 * u, alpha: 0.5, dens: 0.48, seed: 37, shade: 0.45, lean: 0.22, tellLean: 0.14, gustLean: 0.42, floor: 0, pass: "front" }));
      // the far rain (depth 5-6) falls behind anything nearer and solid (the blade's face, the crown, the lift's haze)
      placeByDepth(L, "rain-far");
      return L;
    },
  };
}

/** The storm that never leaves the spire: a dark mass on the west edge of the sky, thinning eastward (no hard edge), lit from inside now and then. */
function spireStorm(W: number, H: number, u: number): LayerDef {
  return {
    kind: "glsl",
    name: "storm-on-spire",
    depth: 70,
    fog: 0.12,
    bounds: { y0: -H, y1: H * 0.75, x0: -2000, x1: W * 0.3 },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.5 * uReduced);
  vec2 q = vec2((p.x - floor(tm * 3.0 + 0.5)) / ${f(110 * u)}, p.y / ${f(60 * u)});
  float n = fbm(q + 1.3 * (vec2(fbm(q * 0.5, 2), fbm(q * 0.5 + 5.0, 2)) - 0.5), 4);
  // thick at the west edge, thinning eastward in billows, ragged; darker at its heart
  float lump = fbm(vec2(p.y / ${f(40 * u)}, 3.1), 3);
  float reach = ${f(W * 0.07)} + (lump - 0.5) * ${f(160 * u)} + (n - 0.5) * ${f(60 * u)};
  if (s.x > reach || p.y > ${f(H * 0.6)} + (n - 0.5) * ${f(80 * u)}) return vec4(0.0);
  float fl = flashLight(s);
  float edge = clamp((reach - s.x) / ${f(30 * u)}, 0.0, 1.0);
  vec3 c = ramp(R_CLOUD, 0.03 + 0.1 * n * edge + 0.12 * (1.0 - edge) + fl * 0.5, p, 0.0);
  return vec4(applyFog(c, uFog, 0.0, p, s), 1.0);
}`,
  };
}

/** The ring in the west, tilted, the low sun in its hole: a dark band with a lit inner rim. */
function ringBody(x: number, y: number, r: number, tilt: number, u: number): LayerDef {
  return {
    kind: "glsl",
    name: "ring",
    depth: Infinity,
    fog: 0.35,
    bounds: { x0: x - r * 1.2, x1: x + r * 1.2, y0: y - r * tilt * 1.6 - 4, y1: y + r * tilt * 1.6 + 4 },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 d = (p + 0.5 - vec2(${f(x)}, ${f(y)})) / vec2(${f(r)}, ${f(r * tilt)});
  float rr = length(d);
  float a = atan(d.y, d.x);
  float th = ${f((9 * u) / r)} * (1.0 + 0.6 * step(0.0, d.y));
  if (abs(rr - 1.0) > th) return vec4(0.0);
  // the break, torn out of the upper right, in big steps
  float br = step(-1.35, a) * step(a, -0.55 + 0.12 * floor(abs(rr - 1.0) / th * 3.0));
  if (br > 0.5) return vec4(0.0);
  // the near (lower) arc shows its inner face lit by the sun behind; panels every 1/40 turn
  float inner = step(rr, 1.0);
  float panel = step(0.9, fract((a / 6.2831) * 40.0 + 0.5 * inner));
  float sh = 0.14 + 0.18 * inner + 0.5 * inner * step(0.0, d.y) * (1.0 - abs(rr - 1.0) / th) - 0.08 * panel;
  // a hard warm line on the rim against the hole
  if (inner > 0.5 && abs(rr - 1.0) < ${f((1.6 * u) / r)}) sh = 0.99;
  vec3 c = ramp(R_RINGD, sh, p, 0.0);
  return vec4(applyFog(c, uFog, 0.0, p, s), 1.0);
}`,
  };
}

/** The world far below the horizon, one layer: hills, the lake, the lodge's cliff, the plain and the causeway, the hollow's mouth. */
function worldBelow(W: number, H: number, u: number, hor: number): LayerDef {
  return {
    kind: "glsl",
    name: "world-below",
    depth: 60,
    fog: 0.18,
    bounds: { y0: hor - 30 * u, y1: H + 200 },
    body: /* glsl */ `
float hills(float x) { return ${f(hor)} - 3.0 * ${f(u)} - (fbm(vec2(x / ${f(90 * u)}, 3.0), 3) * 10.0 + 2.0) * ${f(u)}; }
vec4 layer(vec2 p, vec2 s) {
  float x = p.x, y = p.y;
  float lakeR = ${f(W * 0.52)};
  // the lodge's cliff: a dark crag on the lake's east shore, a warm window near its top
  float cx = ${f(W * 0.46)};
  float cliffTop = ${f(hor - 2 * u)} + pow(abs(x - cx) / ${f(18 * u)}, 1.6) * ${f(10 * u)};
  bool cliff = abs(x - cx) < ${f(24 * u)} && y > cliffTop && y < ${f(hor + 14 * u)};
  if (cliff) {
    float sh = 0.2 + 0.25 * step(x, cx - 3.0) * step(y, cliffTop + 3.0);
    if (abs(x - (cx + ${f(3 * u)})) < 1.0 && abs(y - (cliffTop + ${f(4 * u)})) < 1.0) return vec4(pal(R_LAMP, 1.0), 1.0);
    return vec4(applyFog(ramp(R_LAND, sh, p, 0.0), uFog * 0.8, 0.0, p, s), 1.0);
  }
  float hy = hills(x);
  if (y < hy) return vec4(0.0);
  vec3 c;
  if (y < ${f(hor + 1)}) {
    c = ramp(R_LAND, 0.35, p, 0.0);
  } else if (x < lakeR - (y - ${f(hor)}) * 0.8 + (fbm(vec2(y / ${f(4 * u)}, x / ${f(60 * u)}), 3) - 0.5) * ${f(40 * u)}) {
    // the lake: the sky's colours mirrored in rows, the sun's path glittering on it
    float k = (y - ${f(hor)}) / ${f(H - hor)};
    float path = exp(-pow((x - ${f(W * 0.3)}) / (${f(10 * u)} + k * ${f(40 * u)}), 2.0));
    float tm = uTime * (1.0 - 0.6 * uReduced);
    float glit = step(0.72, fract(hash2(vec2(floor(x / 3.0), y)) * 7.0 + tm * 0.5)) * path;
    float sh = 0.55 - k * 0.9 + path * 0.35 + glit * 0.3;
    c = ramp(R_LAKE, sh, p, 0.4);
  } else {
    // the plain: dark, streaked; the causeway a thin pale line running east; the hollow's mouth glows
    float k = (y - ${f(hor)}) / ${f(H - hor)};
    float st = fbm(vec2(x / ${f(40 * u)}, y / ${f(3 * u)}), 3);
    float sh = 0.22 + 0.12 * st - k * 0.3;
    float cy = ${f(hor + 10 * u)} + (x - ${f(W * 0.53)}) * 0.05;
    if (abs(y - cy) < 1.0 && x > ${f(W * 0.5)} && x < ${f(W * 0.8)}) sh = 0.55;
    float mouth = exp(-pow(length((vec2(x, y) - vec2(${f(W * 0.575)}, ${f(hor + 19 * u)})) / vec2(${f(7 * u)}, ${f(2.5 * u)})), 2.0));
    if (mouth > 0.3) return vec4(ramp(R_LAMP, 0.3 + mouth * 0.6, p, 0.5), 1.0);
    c = ramp(R_LAND, sh, p, 0.3);
  }
  c = applyFog(c, uFog, 0.35 * smoothstep(${f(hor + 40 * u)}, ${f(hor)}, y), p, s);
  return vec4(c, 1.0);
}`,
  };
}

/**
 * The blade below the walking edge: a dark band falling away diagonally
 * (the monolith's top, seen along its length), its top bevel catching the low
 * sun (gold, as the storm clears: the weather's clearing uWx2.w), a fringe of
 * broken spikes under it.
 */
function bladeFace(W: number, H: number, geo: BladeGeo, span: number): LayerDef {
  // depth 1: the room plane, so the face stays under the walking edge at every camera height (the
  // bench's sit hold and the vista lift the camera off the rail row; at 1.25 it slid away as a second ramp)
  const d = 1;
  const cx = span / 2 + W / 2;
  const lx = (rx: number): number => (rx - cx) / d + W / 2;
  const ly = (ry: number): number => (ry - H / 2) / d + H / 2;
  // the edge line, in layer px at this depth (the camera's rail row near the break)
  const [ex0, ey0, ex1, ey1] = geo.edge;
  const a = [lx(ex0), ly(ey0) + 18], b = [lx(ex1), ly(ey1) + 18];
  return {
    kind: "glsl",
    name: "blade-face",
    depth: d,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float t = (p.x - ${f(a[0]!)}) / ${f(b[0]! - a[0]!)};
  float top = mix(${f(a[1]!)}, ${f(b[1]!)}, t);
  if (p.x > ${f(b[0]! + 30)}) return vec4(0.0);
  // thickness grows toward the root (west), the underside a fringe of spikes
  float th = mix(170.0, 60.0, clamp(t, 0.0, 1.0));
  float sp = hash2(vec2(floor(p.x / 7.0), 3.0));
  float bot = top + th + (sp > 0.6 ? floor(sp * 30.0) : 0.0) - abs(mod(p.x, 7.0) - 3.5) * 2.0 * step(0.6, sp);
  if (p.y < top || p.y > bot) return vec4(0.0);
  float dd = p.y - top;
  float gold = uWx2.w;
  vec3 c;
  if (dd < 3.0) c = mix(ramp(R_MONO, 0.55, p, 0.0), pal(R_GOLDEDGE, dd < 1.0 ? 3.0 : 2.0), gold);
  else {
    float sh = 0.14 + 0.05 * step(0.5, fract(p.x / 42.0)) - 0.06 * step(bot - 8.0, p.y);
    if (mod(p.y - top, 16.0) < 1.0) sh = 0.06;
    c = ramp(R_MONO, sh + flashLight(s) * 0.3 + sceneLight(s, uDepth) * 0.6, p, 0.0);
  }
  return vec4(applyFog(c, uFog, 0.0, p, s), 1.0);
}`,
  };
}

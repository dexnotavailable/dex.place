// arrival (refs w03 + w01): the first view of the world. The ring-over-lake
// composition (a colossal tilted ring, a shaft of sun through its hole, still
// water, mist, dark cliffs, a dock with a lantern and one small figure at the
// locked player height) with a colossus walking the far strand behind the lake.
// The colossus, its dust and the haze around its feet are mirrored into the
// lake: each about its own waterline, dimming with distance below it, broken by
// the water's row shear, jitter and wind ruffles. Authored for the 1280x720
// world view; the old 640x360 / 960x540 modes rebuild the same composition.
//
// Everything is generated here at runtime. The ring comes from arrival/ring.ts
// (adapted from ring-lake), the creature from colossus-plain/colossus.ts.

import {
  f,
  FlashAccents,
  Falling,
  Flock,
  Motes,
  Pix,
  fogBand,
  glow,
  minProfile,
  mist,
  cragProfile,
  rangeProfile,
  shaftFn,
  sky,
  disc,
  smooth,
  terrain,
  fbm1,
  hashInt,
  mulberry,
  type LayerDef,
  type PointSystem,
  type SceneDef,
} from "../engine/index.ts";
import type { PointSink, SimEnv } from "../engine/types.ts";
import { EXTENT, LEGS, colossusGlsl, dustGlsl, type ColossusDef } from "./colossus-plain/colossus.ts";
import { Debris, EyeGlint, Tracker, Wheelers } from "./colossus-plain/systems.ts";
import { COL_DEPTH, GHOST_DEPTH, RING_DEPTH, SHAFT_DEPTH, geo, type Geo } from "./arrival/geo.ts";
import { cliffPlanes, cliffReflection, flankPlanes } from "./arrival/land.ts";
import { buildDock, dockPosts } from "./arrival/props.ts";
import {
  beaconPos,
  beamBody,
  beamCpu,
  chunksBody,
  chunksBounds,
  debrisRegion,
  footBody,
  glintPos,
  lowestTheta,
  ringBody,
  ringChunks,
  ringScreen,
} from "./arrival/ring.ts";
import { lake } from "./arrival/water.ts";

/** Steady lamps with a slow, gentle flicker (never a flash: no gate needed). */
class Lamps implements PointSystem {
  private t = 0;
  constructor(
    private at: [number, number][],
    private row: number,
    private size: number,
  ) {}
  update(_dt: number, env: SimEnv): void {
    this.t = env.t * (env.reduced ? 0.3 : 1);
  }
  draw(sink: PointSink): void {
    this.at.forEach(([x, y], i) => {
      const fl = Math.sin(this.t * 0.9 + i * 2.3) * Math.sin(this.t * 0.37 + i) > 0.55 ? 0.7 : 0.95;
      sink.push(x, y - this.size + 1, this.size, 0, this.row, fl, 0, 1);
    });
  }
}

/** A crossing that starts with the head just off the right edge and ends with the tail off the left. */
function crossing(g: Geo, depth: number, o: { S: number; vd: number; gap: number; startAt: number; T: number; seed: number; dendrites: boolean }): ColossusDef {
  const [lx, rx] = g.reach(depth, 6);
  const x0 = rx - EXTENT.x0 * o.S;
  const xEnd = lx - (EXTENT.x1 + 40) * o.S;
  const cross = (x0 - xEnd) / (o.vd * o.S);
  return {
    S: o.S,
    ground: g.waterY(depth),
    x0,
    period: cross + o.gap,
    t0: (x0 - o.startAt * g.W) / (o.vd * o.S),
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

/** The main colossus's crossing for a build context (exported for captures: period and timing). */
export function mainCrossing(g: Geo): ColossusDef {
  return crossing(g, COL_DEPTH, { S: 0.5 * g.u, vd: 18, gap: 10, startAt: 0.78, T: 4.4, seed: 7, dendrites: true });
}

const scene: SceneDef = {
  title: "arrival",
  palette: {
    ring: ["#0a1014", "#111a1f", "#19252a", "#253338", "#46504a", "#9a8458", "#e0bf7c"],
    ringlight: ["#7c5a32", "#c99a5a", "#f5dca2"],
    warm: ["#5f5540", "#a88f60", "#efd8a2"],
    sun: ["#d8cca2", "#efe5c3", "#fbf5e2"],
    haze: ["#46605f", "#5f7a77", "#809893", "#aebaa6", "#e2d8b2"],
    far: ["#3a5253", "#465f5f", "#557070", "#68827e"],
    strand: ["#1a2629", "#243337", "#324447", "#4b5d5a", "#76806d"],
    mid: ["#18232a", "#22313a", "#2f4146", "#445856", "#6f7563"],
    near: ["#090e11", "#0f161a", "#172126", "#24323a", "#4b5550"],
    cliff: ["#080d10", "#10181c", "#1b272c", "#2f3f3e", "#56604f"],
    water: ["#12272a", "#19383a", "#224c4b", "#2d625e", "#468479"],
    glint: ["#6c9c92", "#b2d2c2", "#f2ecd0"],
    wood: ["#0a0d0f", "#12171a", "#1e2427", "#343b39", "#5d5a4a"],
    iron: ["#07090b", "#101417", "#1d2326", "#39403f"],
    beam: ["#5f624a", "#9a9168", "#d7c795", "#fbeec2"],
    lamp: ["#6d3f1c", "#c7803a", "#ffd494"],
    shrine: ["#7a4a22", "#d49a52", "#ffe2a8"],
    bird: ["#1c2628", "#2a3739"],
    // the colossus in this light: pale bone gone teal-grey in the haze, backlit
    flesh: ["#34464a", "#4c6062", "#6b7d7b", "#93a09a", "#c4c8b8"],
    tar: ["#0a0f11", "#11191c", "#1a2528", "#28373a", "#415150"],
    vein: ["#46302c", "#6a3b33", "#8e4f40", "#ad6a50"],
    dust: ["#4a5a58", "#5f706c", "#798882", "#95a299", "#b6bcad"],
    standin: ["#06080a", "#0d1216", "#26303a", "#bba77a"],
  },
  fog: {
    stops: [
      [0.0, "#152126"],
      [0.18, "#233439"],
      [0.42, "#46605f"],
      [0.6, "#7b928b"],
      [0.65, "#8ea197"],
      [0.71, "#6a817b"],
      [1.0, "#3f5754"],
    ],
    bands: 16,
    dither: 0.5,
    density: 0.11,
    max: 0.8,
    glow: { x: 0.63, y: 0.19, r: 0.62, colour: "#e5d9ae", strength: 0.5, steps: 5, dither: 0.14 },
  },
  span: (W) => Math.round(W * 0.45),
  driftPeriod: 110,

  prelude: (ctx) => {
    const g = geo(ctx);
    return /* glsl */ `
${shaftFn({
  fn: "beam",
  from: g.beamFrom,
  to: g.beamTo,
  w0: ctx.H * 0.07,
  w1: ctx.H * 0.16,
  streaks: 11,
  speed: 0.04,
  fadeStart: 0.72,
  intensity: 1.0,
  fromShiftX: `layerOff(${f(SHAFT_DEPTH)})`,
})}
float sceneLight(vec2 s, float depth) {
  float b = beam(s + vec2(layerOff(${f(SHAFT_DEPTH)}), 0.0));
  float l = b * smoothstep(2.2, 6.0, depth) * 0.42;
  // the lantern on the dock lights things near the player plane
  vec2 lp = vec2(${f(g.lantern[0])} - layerOff(1.0), ${f(g.lantern[1] + g.P * 0.08)});
  float ld = length((s - lp) * vec2(1.0, 1.25)) / ${f(g.P * 0.62)};
  l += (1.0 - smoothstep(0.8, 3.0, depth)) * floor(max(0.0, 1.0 - ld) * 3.0) / 3.0 * 0.2;
  return l;
}`;
  },

  build: (ctx) => {
    const g = geo(ctx);
    const { W, H, u, hor, P } = g;
    const L: LayerDef[] = [];
    const R = (n: string): number => ctx.row(n);
    const wide = (d: number): { x: number; w: number } => {
      const w = ctx.panWidth(d) + 8;
      return { x: -Math.ceil((w - W) / 2), w };
    };
    // pixel-cluster size for near rock: grows with the view so near things stay chunky
    const chunk = (k: number): number => Math.max(1, Math.round(k * u));

    // --- sky, sun, high cloud ---------------------------------------------------
    L.push(sky({ reflect: hor }));
    L.push(disc({ name: "sun", x: g.sun[0], y: g.sun[1], r: g.sunR, row: "sun", halo: { r: 2.4, strength: 0.45, steps: 5, seam: 0.18 }, reflect: hor, dither: 0.3 }));
    L.push(
      mist({
        name: "high-cloud",
        depth: 90,
        y0: -10,
        y1: H * 0.42,
        sx: 260 * u,
        sy: 16 * u,
        drift: -4 * (u / 2),
        evolve: 0.08,
        cover: 0.5,
        warp: 1.6,
        levels: 4,
        alpha: 0.6,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.35,
        tonePerLevel: 0.11,
        tint: 0.55,
        lightGain: 0.3,
        reflect: hor,
      }),
    );

    // --- the ring ------------------------------------------------------------------
    L.push({ kind: "glsl", name: "ring", depth: RING_DEPTH, fog: 0.05, body: ringBody(g), reflect: hor, bounds: { y0: -1e6, y1: hor + 1 } });
    const chunks = ringChunks(g);
    L.push({ kind: "glsl", name: "ring-chunks", depth: RING_DEPTH, fog: 0.14, body: chunksBody(g, chunks), bounds: chunksBounds(chunks), reflect: hor });
    L.push(
      mist({
        name: "veil",
        depth: 30,
        y0: -12,
        y1: H * 0.46,
        softTop: 4,
        sx: 150 * u,
        sy: 34 * u,
        drift: -5 * (u / 2),
        evolve: 0.1,
        cover: 0.52,
        warp: 1.7,
        levels: 4,
        alpha: 0.55,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.2,
        tonePerLevel: 0.14,
        tint: 0.55,
        lightGain: 0.4,
        reflect: hor,
      }),
    );
    L.push(
      mist({
        name: "ring-cloud",
        depth: 26,
        y0: H * 0.4,
        y1: hor + 2,
        sx: 190 * u,
        sy: 13 * u,
        drift: -6 * (u / 2),
        evolve: 0.035,
        cover: 0.3,
        warp: 2.2,
        levels: 3,
        alpha: 0.55,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.3,
        tonePerLevel: 0.16,
        tint: 0.5,
        lightGain: 0.8,
        reflect: hor,
      }),
    );
    L.push({
      kind: "points",
      name: "ring-debris",
      depth: RING_DEPTH,
      fog: 0.3,
      reflect: hor,
      system: new Motes({ region: debrisRegion(g), count: Math.round(12 * u), row: R("ring"), shade: [0.12, 0.3], vel: [0.25, -0.12], wander: 0.25, size: chunk(1), twinkle: 0 }, ctx.rng),
    });
    const [fx, fy] = ringScreen(g, lowestTheta(g), 0);
    L.push({
      kind: "points",
      name: "ring-falling",
      depth: RING_DEPTH,
      fog: 0.35,
      system: new Falling({ source: [fx - 120 * u, fy - 30 * u, fx + 60 * u, fy], floor: hor, every: 7, speed: 3.2 * u, drift: 0.3, row: R("ring"), shade: 0.15, max: 5 }),
    });
    L.push({
      kind: "points",
      name: "ring-glints",
      depth: RING_DEPTH,
      fog: 0.1,
      blend: "add",
      system: new FlashAccents([
        { kind: "glint", rate: 6, at: (rng) => glintPos(g, rng), size: [7, 13], row: R("ringlight"), shade: 0.99, duration: [0.3, 0.7] },
        { kind: "glow", rate: 4, at: () => beaconPos(g), size: 7, row: R("lamp"), shade: 0.7, duration: [0.9, 1.4], intensity: 0.8 },
      ]),
    });

    // --- the lake ------------------------------------------------------------------
    const posts = dockPosts(g);
    L.push(
      lake({
        horizon: hor,
        dNear: g.k1,
        dFar: 60,
        row: "water",
        glintRow: "glint",
        warmRow: "warm",
        reflFar: 0.9,
        reflNear: 0.42,
        shear: 3 * u,
        jitter: 1.5 * u,
        glints: 0.004,
        u,
        pool: { x: g.beamTo[0], w: W * 0.055, strength: 0.45, depth: SHAFT_DEPTH, path: 0.35 },
        rings: posts.slice(-3).map((px) => [px + 1, g.wl]),
        ringUnit: P / 70,
        dither: 0.5,
      }),
    );

    // far hills, both sides of the open water, behind the strand the colossus walks
    {
      const d = 29;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 1;
      const left = rangeProfile({ base: hor, amp: H * 0.13, scale: 70 * u, seed: 11, sharp: 0.45 });
      const right = rangeProfile({ base: hor, amp: H * 0.2, scale: 90 * u, seed: 12, sharp: 0.5 });
      // heights above the waterline, tapering to nothing toward the open middle, so the
      // hills slope into the lake instead of ending in a cut
      const top = (px: number): number => {
        const X = px + x;
        const lm = smooth(W * 0.36, W * 0.14, X);
        const rm = smooth(W * 0.58, W * 0.84, X);
        const h = Math.max((base - left(X)) * lm, (base - right(X)) * rm);
        return h < 1 ? 1e9 : base - h;
      };
      terrain(pix, {
        row: R("far"),
        top,
        bottom: () => base,
        seed: 21,
        scale: 26 * u,
        light: [0.6, -1],
        base: 0.45,
        contrast: 0.35,
        strata: 0.2,
        fog: (_px, py) => 0.1 + 0.35 * smooth(hor - H * 0.1, base, py),
      });
      L.push({ kind: "pix", name: "far-hills", depth: d, fog: 0.4, pix, x, y: 0, reflect: base, reflectFade: 30 * u, dither: 0.3 });
    }

    // --- the procession: a far colossus, deep in the haze, then the far strand and the main one
    const track: ConstructorParameters<typeof Tracker>[0] = [];
    const ghost = crossing(g, GHOST_DEPTH, { S: 0.2 * u, vd: 13, gap: 40, startAt: 1.25, T: 5.6, seed: 23, dendrites: false });
    const ghostBounds = { y0: ghost.ground - 350 * ghost.S, y1: ghost.ground + 2, x0: 0, x1: 0 };
    track.push({ c: ghost, bounds: ghostBounds, ext: [EXTENT.x0, EXTENT.x1], margin: 4 });
    L.push({
      kind: "glsl",
      name: "ghost",
      depth: GHOST_DEPTH,
      fog: 0.5,
      body: colossusGlsl(ghost, { farFog: 0.18, rearFog: 0.3, groundFog: 0.4, key: [0.5, 0.6, -0.2], fill: 0.06 }),
      bounds: ghostBounds,
      dither: 0.2,
      reflect: ghost.ground,
      reflectFade: 60 * u,
      reflectDim: 0.1,
    });

    // haze bank along the horizon: the far colossus's feet stand in it
    L.push(
      fogBand({
        name: "horizon-haze",
        depth: 24,
        y0: hor - H * 0.07,
        y1: hor + 3,
        softBottom: 1,
        sx: 170 * u,
        sy: 9 * u,
        drift: -3 * (u / 2),
        cover: 0.66,
        alpha: 0.7,
        levels: 4,
        row: "haze",
        tone: 0.45,
        tint: 0.3,
        lightGain: 1,
        reflect: hor,
      }),
    );

    // the far strand the colossus walks: a low dark bar of shingle, a few standing
    // stones, and the lamps people keep along the route (tiny warm points)
    const main = mainCrossing(g);
    const lamps: [number, number][] = [];
    let strandBase = main.ground;
    {
      const d = COL_DEPTH;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const gnd = main.ground;
      const base = gnd + Math.max(2, Math.round(1.5 * u));
      for (let px = 0; px < w; px++) {
        const X = px + x;
        const bump = Math.round((fbm1(X / (30 * u), 101, 3) - 0.35) * 4 * u) + (hashInt(Math.floor(X / 3), 1, 103) < 0.08 ? 1 : 0);
        const top = gnd - Math.max(0, bump);
        for (let y = top; y < base; y++) {
          const s = y === top ? 0.34 : 0.2 + 0.08 * (fbm1(X / 7 + y, 104, 2) - 0.5) - (y - top) * 0.03;
          pix.set(px, y, s, R("strand"));
        }
      }
      // standing stones and lamp posts along the route
      const rng = mulberry(105);
      for (let X = -W * 0.2; X < W * 1.2; X += W * (0.06 + rng() * 0.08)) {
        const px = Math.round(X - x);
        if (rng() < 0.55) {
          const hgt = Math.round((3 + rng() * 5) * u);
          for (let y = 0; y < hgt; y++) {
            pix.set(px, gnd - y, 0.32, R("strand"));
            if (y < hgt - 2 && rng() < 0.7) pix.set(px + 1, gnd - y, 0.18, R("strand"));
          }
        } else {
          const hgt = Math.round((2.5 + rng() * 2) * u);
          for (let y = 0; y < hgt; y++) pix.set(px, gnd - y, 0.26, R("strand"));
          lamps.push([px + x, gnd - hgt - 1]);
        }
      }
      strandBase = base;
      L.push({ kind: "pix", name: "strand", depth: d, fog: 0.3, pix, x, y: 0, reflect: base, reflectFade: 10 * u, dither: 0.2 });
    }

    // the colossus
    const mainBounds = { y0: -1e6, y1: main.ground + 3, x0: 0, x1: 0 };
    const dustBounds = { y0: main.ground - 70 * main.S, y1: main.ground + 3, x0: 0, x1: 0 };
    track.push({ c: main, bounds: mainBounds, ext: [EXTENT.x0, EXTENT.x1], margin: 4 });
    track.push({ c: main, bounds: dustBounds, ext: [EXTENT.x0 - 60, EXTENT.x1 + 120], margin: 4 });
    L.push({ kind: "points", name: "tracker", depth: COL_DEPTH, system: new Tracker(track) });
    const colRefl = { reflect: main.ground, reflectFade: 170 * u, reflectDim: 0.04 };
    L.push({
      kind: "glsl",
      name: "colossus",
      depth: COL_DEPTH,
      fog: 0.2,
      body: colossusGlsl(main, { farFog: 0.2, rearFog: 0.45, groundFog: 0.08, groundH: 16, key: [0.25, 0.75, 0.3], fill: 0.02 }),
      bounds: mainBounds,
      dither: 0.15,
      ...colRefl,
    });
    L.push({
      kind: "glsl",
      name: "colossus-dust",
      depth: COL_DEPTH,
      fog: 0.3,
      body: dustGlsl(main, { farFog: 0.2, strength: 1.8 }),
      bounds: dustBounds,
      ...colRefl,
    });
    L.push({ kind: "points", name: "colossus-debris", depth: COL_DEPTH, fog: 0.3, system: new Debris(main, { tar: R("tar"), dust: R("dust") }, 1.4), reflect: main.ground });
    L.push({ kind: "points", name: "wheelers", depth: COL_DEPTH, fog: 0.35, system: new Wheelers(main, R("bird"), 7, ctx.rng), ...colRefl });
    L.push({ kind: "points", name: "eye-glint", depth: COL_DEPTH, blend: "add", system: new EyeGlint(main, R("glint"), 1.5) });
    // ground haze its feet stand in (and the reflection of it)
    L.push(
      fogBand({
        name: "ground-haze",
        depth: 18,
        y0: main.ground - 9 * u,
        y1: g.waterY(18) + 1,
        softTop: 7 * u,
        softBottom: 2,
        sx: 150 * u,
        sy: 8 * u,
        drift: -4 * (u / 2),
        evolve: 0.04,
        cover: 0.5,
        alpha: 0.36,
        levels: 4,
        row: "haze",
        tone: 0.42,
        tint: 0.35,
        lightGain: 0.9,
        reflect: g.waterY(18),
        reflectFade: 12 * u,
      }),
    );

    // the lamps kept along the route: steady warm points on the strand (drawn over the
    // ground haze so they stay legible), each with a slow flicker, mirrored in the lake
    L.push({ kind: "points", name: "route-lamps", depth: COL_DEPTH, fog: 0.18, reflect: strandBase, system: new Lamps(lamps, R("shrine"), u >= 2 ? 2 : 1) });

    // the light shaft (and its reflection), where it lands, motes inside it
    L.push({
      kind: "glsl",
      name: "shaft",
      depth: SHAFT_DEPTH,
      fog: 0,
      blend: "add",
      reflect: hor,
      body: beamBody(g, 0.2),
      bounds: { x0: g.beamTo[0] - H * 0.2, x1: g.beamFrom[0] + H * 0.12 + ctx.span / SHAFT_DEPTH, y0: g.beamFrom[1] - H * 0.08, y1: g.beamTo[1] + 2 },
    });
    L.push({
      kind: "glsl",
      name: "shaft-foot",
      depth: SHAFT_DEPTH,
      fog: 0,
      blend: "add",
      body: footBody(g),
      bounds: { x0: g.beamTo[0] - H * 0.21, x1: g.beamTo[0] + H * 0.21, y0: g.beamTo[1] - H * 0.03, y1: g.beamTo[1] + H * 0.03 },
    });
    L.push({
      kind: "points",
      name: "beam-motes",
      depth: SHAFT_DEPTH,
      fog: 0,
      blend: "add",
      system: new Motes(
        { region: [W * 0.36, H * 0.25, W * 0.72, hor], count: Math.round(160 * u), row: R("beam"), shade: [0.45, 0.99], vel: [-1.2 * (u / 2), 1.4 * (u / 2)], wander: 2.5 * (u / 2), size: 1, twinkle: 0.35, visible: beamCpu(g) },
        ctx.rng,
      ),
    });

    // mid rocks: a leaning spire on the left, stepped cliffs on the right
    {
      const d = 4.6;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 2;
      const spire = cragProfile({ cx: W * 0.19, top: H * 0.25, base, left: W * 0.08, right: W * 0.075, seed: 31, ledges: 2, rough: 0.05, power: 1.7 });
      const shoulder = cragProfile({ cx: W * 0.08, top: H * 0.43, base, left: W * 0.2, right: W * 0.12, seed: 32, ledges: 2, rough: 0.07, power: 1.5 });
      const slope = rangeProfile({ base: base - 2, amp: H * 0.12, scale: 50 * u, seed: 33 });
      const talus = (X: number): number => {
        if (X < W * 0.16 || X > W * 0.38) return 1e9;
        const k = Math.pow(1 - smooth(W * 0.21, W * 0.38, X), 1.3);
        return base - H * 0.22 * k - (fbm1(X / (7 * u), 35) - 0.5) * 6 * u * k;
      };
      const leftTop = minProfile(spire, shoulder, talus, (X) => (X < W * 0.05 ? slope(X) : 1e9));
      terrain(pix, {
        row: R("mid"),
        top: (px) => leftTop(px + x),
        bottom: () => base,
        seed: 34,
        scale: 22 * u,
        light: [1, -0.6],
        base: 0.17,
        contrast: 0.36,
        vertical: 0.12,
        strata: 0.3,
        rim: 0.12,
        rimDepth: 2,
        ao: 0.1,
      });
      flankPlanes(pix, x, g, { dir: 1, c: 1, ledges: [0.36, 0.45, 0.53], seed: 36 });
      L.push({ kind: "pix", name: "mid-left", depth: d, pix, x, y: 0, fog: 0.06, reflect: base, reflectFade: 70 * u, dither: 0.2 });
    }
    {
      const d = 3.4;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 2;
      const cliff = (X: number): number => {
        const m = smooth(W * 0.72, W * 0.82, X);
        const crest = H * 0.4 + (fbm1(X / (40 * u), 41) - 0.5) * H * 0.08 + Math.floor(fbm1(X / (14 * u), 42) * 4) * 4 * u;
        const foot = X > W * 0.62 && X < W * 0.82 ? base - H * 0.07 * Math.pow(smooth(W * 0.62, W * 0.78, X), 1.4) - (fbm1(X / (6 * u), 44) - 0.5) * 4 * u : 1e9;
        return Math.min(foot, m <= 0.01 ? 1e9 : base - (base - crest) * m);
      };
      terrain(pix, {
        row: R("mid"),
        top: (px) => cliff(px + x),
        bottom: () => base,
        seed: 43,
        scale: 20 * u,
        light: [-1, -0.5],
        base: 0.15,
        contrast: 0.36,
        vertical: 0.15,
        strata: 0.35,
        rim: 0.12,
        rimDepth: 2,
        ao: 0.1,
      });
      flankPlanes(pix, x, g, { dir: -1, c: 1, ledges: [0.46, 0.53, 0.59], seed: 46 });
      L.push({ kind: "pix", name: "mid-right", depth: d, pix, x, y: 0, fog: 0.05, reflect: base, reflectFade: 70 * u, dither: 0.2 });
    }

    // low mist lying on the water
    L.push(
      mist({
        name: "water-mist",
        depth: 3,
        y0: hor + 2 * u,
        y1: hor + 36 * u,
        sx: 110 * u,
        sy: 6 * u,
        drift: 6 * (u / 2),
        evolve: 0.06,
        cover: 0.27,
        warp: 1.8,
        levels: 4,
        alpha: 0.45,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.42,
        tonePerLevel: 0.13,
        tint: 0.5,
        lightGain: 1.2,
      }),
    );

    // the big dark cliff on the right, cropped by the frame
    {
      const d = 1.8;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 3;
      const face = (X: number): number => {
        const e = W * 0.88 + (fbm1(X / 30, 51) - 0.5) * 20 * u;
        if (X < e - W * 0.05) return 1e9;
        const t = smooth(e - W * 0.05, e + W * 0.07, X);
        return base - (base + H * 0.15) * t + (fbm1(X / (9 * u), 52) - 0.5) * 12 * u;
      };
      const c = chunk(1.5);
      terrain(pix, {
        row: R("cliff"),
        top: (px) => face(px + x),
        bottom: () => base,
        seed: 53,
        scale: 16 * u,
        chunk: c,
        light: [-1, -0.3],
        base: 0.2,
        contrast: 0.35,
        vertical: 0.35,
        strata: 0.1,
        rim: 0.3,
        rimDepth: c * 1.5,
        ao: 0.2,
      });
      cliffPlanes(pix, x, g, c);
      cliffReflection(pix, base, R("cliff"), 83, g.u);
      L.push({ kind: "pix", name: "near-right", depth: d, pix, x, y: 0, reflect: base, dither: 0.15 });
    }
    // low rocks on the left shore where the dock starts
    {
      const d = 1.3;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 3;
      const shore = rangeProfile({ base, amp: H * 0.15, scale: 34 * u, seed: 61, sharp: 0.6, detail: 5 * u });
      const top = (X: number): number => {
        const m = smooth(W * 0.26, W * 0.07, X);
        return m <= 0.01 ? 1e9 : base - (base - shore(X)) * m;
      };
      const c = chunk(1.5);
      terrain(pix, {
        row: R("near"),
        top: (px) => top(px + x),
        bottom: () => base,
        seed: 62,
        scale: 14 * u,
        chunk: c,
        light: [1, -0.8],
        base: 0.34,
        contrast: 0.55,
        rim: 0.3,
        rimDepth: c * 1.5,
        ao: 0.2,
      });
      L.push({ kind: "pix", name: "near-left", depth: d, pix, x, y: 0, reflect: base, reflectFade: 30 * u, dither: 0.2 });
    }

    // the dock, its lantern, the figure at the locked player height
    {
      const { x, w } = wide(1);
      const pix = new Pix(w, H);
      buildDock(pix, g, x, R("wood"), R("lamp"), R("iron"), posts);
      L.push({ kind: "pix", name: "dock", depth: 1, pix, x, y: 0, reflect: g.wl, reflectFade: 36 * u, dither: 0 });
    }
    L.push(glow({ name: "lantern-glow", depth: 1, x: g.lantern[0], y: g.lantern[1] + Math.round(P * 0.1), r: Math.round(P * 0.34), row: "lamp", flicker: 0.2, alpha: 0.5, reflect: g.wl }));
    L.push({ kind: "character", name: "figure", depth: 1, x: g.figX, ground: g.deck, rimDir: [1, -1], height: P, reflect: g.wl, reflectFade: 40 * u });

    // birds, far out over the water
    L.push({
      kind: "points",
      name: "birds",
      depth: 12,
      system: new Flock({ y: [H * 0.3, H * 0.45], x: [-40, W + 40], every: 38, speed: 16 * u, count: [3, 6], row: R("bird"), shade: 0.2 }),
    });

    // foreground: dark rocks in the bottom corners, moving faster than the camera
    {
      const d = 0.72;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const lr = rangeProfile({ base: H + 4, amp: H * 0.15, scale: 60 * u, seed: 71, sharp: 0.35 });
      const top = (X: number): number => {
        const m = Math.max(smooth(W * 0.15, -W * 0.02, X), smooth(W * 0.87, W * 1.05, X));
        return m <= 0.02 ? 1e9 : H + 4 - (H + 4 - lr(X)) * m;
      };
      const c = chunk(2);
      terrain(pix, {
        row: R("near"),
        top: (px) => top(px + x),
        seed: 72,
        scale: 12 * u,
        chunk: c,
        light: [0.4, -1],
        base: 0.14,
        contrast: 0.3,
        rim: 0.2,
        rimDepth: c,
      });
      L.push({ kind: "pix", name: "foreground", depth: d, pix, x, y: 0, dither: 0 });
    }
    return L;
  },
};

export default scene;

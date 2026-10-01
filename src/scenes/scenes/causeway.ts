// causeway (ref w01), the backdrop of B2 The Causeway with B3 the Bus Shelter
// and B4 Stonetop (lane R-B): the long walk into weather. An old stone road
// on its embankment runs east across a flooded plain; the sheet water
// mirrors a grey-violet sky, and a colossus walks the flats at depth 9,
// close enough to fill the sky (and, from Stonetop, to pass at eye level).
// Once per pass its weight leg plants mid-frame: a ring races across the
// sheet water to the road (the room's controller shakes the camera 2 px, off
// in reduced motion, and flattens the grass). A ghost walks deep in the
// haze. Ahead, on the east horizon, the black spire stands with its storm
// stuck to it (rare sheet lightning, through the flash gate) and its red
// light; behind, the ring hangs pale in the west. The wind rises as you go
// east. At the player plane: the road, its two breaks, the colossus's
// footprint crater, and the Stonetop tor behind the shelter.
//
// Default export: the /scenes/ preview at the road framing; causeway(true)
// is the world backdrop (rows follow the camera up Stonetop).

import { Flock, moveAfter, Motes, Pix, fogBand, mist, sky, smooth, terrain, fbm1, hashInt, f, type LayerDef, type SceneDef, type BuildCtx } from "../engine/index.ts";
import { Bolts, EyeGlint, SheetLight, Wheelers } from "./colossus-plain/systems.ts";
import { dustGlsl, type ColossusDef } from "./colossus-plain/colossus.ts";
import { cloudMassGlsl } from "./colossus-plain/sky.ts";
import { EXT, Spray, Track, WalkClock, bodyGlsl, camYGlsl, crossing, farRingGlsl, passWindow, ringsGlsl, spireGlsl, splitPix, wadeFrontGlsl, type FeedColossus } from "./causeway/shared.ts";
import { B2, SPAN, geo, type Geo } from "./causeway/geo.ts";
import { flats } from "./causeway/flats.ts";
import { buildRoad, buildTor } from "./causeway/road.ts";

export const TITLE = "causeway";
const GHOST_DEPTH = 40;

interface Walkers {
  main: ColossusDef;
  ghost: ColossusDef;
  surface: number;
  feed: FeedColossus[];
}

const cache = new WeakMap<BuildCtx, Walkers>();

function walkers(ctx: BuildCtx, g: Geo): Walkers {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const d = B2.colDepth;
  const S = 0.8 * g.u;
  const surface = g.LY(g.groundY(d), d);
  // it walks the flats ankle-deep in the sheet water
  const main = crossing(g.W, g.reach(d, 6), { S, vd: 21, gap: 9, startAt: 0.95, T: 4.6, seed: 7, dendrites: true, ground: surface + Math.round(10 * S) });
  const gs = 0.26 * g.u;
  const ghost = crossing(g.W, g.reach(GHOST_DEPTH, 6), { S: gs, vd: 13, gap: 40, startAt: 0.35, T: 5.6, seed: 23, dendrites: false, ground: g.LY(g.groundY(GHOST_DEPTH), GHOST_DEPTH) + 2 });
  const feed: FeedColossus[] = [
    { name: "main", c: main, depth: d, pass: passWindow(main, g.W * 0.5) },
    { name: "ghost", c: ghost, depth: GHOST_DEPTH, pass: [1e9, 1e9] },
  ];
  const w = { main, ghost, surface, feed };
  cache.set(ctx, w);
  return w;
}

export function causeway(inWorld: boolean): SceneDef {
  return {
    title: TITLE,
    palette: {
      flesh: ["#4a5064", "#6a7086", "#8f94a7", "#b4b6c2", "#d8d7db"],
      tar: ["#0c0c11", "#17171e", "#24242d", "#393944", "#5b5b68"],
      vein: ["#4b2427", "#7a3432", "#a24a42", "#c46e5f"],
      dust: ["#4e4a4c", "#66605f", "#817a78", "#9e9793", "#bab4ae"],
      soil: ["#17141a", "#221d22", "#2e272b", "#3d3336", "#514446", "#6a5a58"],
      grassd: ["#1a1d1c", "#252a25", "#33392f", "#454b3b", "#5b604a"],
      water: ["#232735", "#2f3444", "#3f4556", "#555b6d", "#737a8c"],
      glint: ["#8e92a8", "#c2c4d4", "#eeedf4"],
      foam: ["#7d8194", "#a7aabb", "#d4d5de"],
      far: ["#6a6977", "#767684", "#828290", "#8f8e9a"],
      cloud: ["#5b6179", "#676d87", "#747a94", "#8389a1"],
      haze: ["#8a8c9f", "#9a9cad", "#abacb9", "#bcbcc5", "#cfcdd1"],
      rock: ["#130e0e", "#1e1615", "#2c201d", "#3e2c26", "#563a2f", "#74503d"],
      stone: ["#141417", "#1f1f23", "#2c2b31", "#3c3b42", "#524f56", "#6f6a70"],
      dark: ["#0c0b0d", "#171417", "#221e21", "#302a2c"],
      moss: ["#1b1f1a", "#262c23", "#353d2e", "#48523b"],
      earth: ["#131215", "#1d1b1f", "#29262a", "#383438", "#4a4548", "#5f5a5c", "#787271"],
      lichen: ["#2a2c27", "#3c3f34", "#545845", "#6e7258"],
      tor: ["#16161a", "#25252b", "#3a3a41", "#54545c", "#6c6b72", "#86848a", "#a19ea2"],
      ringdark: ["#565b72", "#60667d", "#6b7188", "#777c92"],
      ringlit: ["#9a9cae", "#b4b5c4", "#cdcdd8"],
      spire: ["#0c0d12", "#14151c", "#1d1f28"],
      storm: ["#262937", "#303443", "#3c4151", "#4a4f60"],
      red: ["#5a1c18", "#a8352a", "#e0604a"],
      cloth: ["#2b1416", "#4a1f1f", "#6e2e29", "#90463a"],
      wood: ["#141213", "#211d1d", "#302a28", "#433a35"],
      bird: ["#3a3a44", "#4c4c57"],
      bolt: ["#b9b7d6", "#dcdaf0", "#f6f4ff"],
      boltglow: ["#9a98bd", "#bdbbd8", "#dddbee"],
      glintc: ["#a7a3b8", "#dcd8e6", "#fbf8ff"],
      standin: ["#07070a", "#101015", "#24232c", "#a29792"],
    },
    fog: {
      stops: [
        [0.0, "#5c6380"],
        [0.24, "#707792"],
        [0.46, "#878ba1"],
        [0.58, "#a09fb0"],
        [0.62, "#b2afb8"],
        [0.64, "#9d99a6"],
        [0.75, "#7a7686"],
        [1.0, "#4e4a57"],
      ],
      bands: 10,
      dither: 0.35,
      density: 0.03,
      max: 0.88,
      glow: { x: 0.16, y: 0.5, r: 0.9, colour: "#c6c2c8", strength: 0.32, steps: 6 },
    },
    span: () => SPAN,
    driftPeriod: 160,

    prelude: (ctx) => {
      const g = geo(ctx, inWorld);
      const wk = walkers(ctx, g);
      return /* glsl */ `
${camYGlsl(inWorld, 0)}
${ringsGlsl(wk.feed, g.W)}
float cloudSun(float wx, float depth) {
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float n = fbm(vec2((wx + tm * 60.0) / 900.0, depth / 11.0 + 3.0), 3);
  return smoothstep(0.5, 0.6, n);
}
float sceneLight(vec2 s, float depth) {
  if (depth > 70.0) return 0.0;
  float wx = (s.x + layerOff(depth) - ${f(g.W / 2)}) * max(depth, 1.0);
  float k = floor(cloudSun(wx, depth) * 2.0 + 0.5) * 0.5;
  return (k - 0.35) * 0.1 * (1.0 - smoothstep(30.0, 70.0, depth));
}`;
    },

    build: (ctx) => {
      const g = geo(ctx, inWorld);
      const { W, H, u, hor } = g;
      const L: LayerDef[] = [];
      const R = (n: string): number => ctx.row(n);
      const wide = (d: number): { x: number; w: number } => {
        const w = ctx.panWidth(d) + 8;
        return { x: -Math.ceil((w - W) / 2), w };
      };
      const wk = walkers(ctx, g);
      const { main, ghost } = wk;

      // --- sky: the ring behind in the west, cloud, the spire and its storm ahead in the east ---
      L.push(sky({ reflect: hor }));
      L.push({
        kind: "glsl",
        name: "ring",
        depth: 220,
        fog: 0.55,
        reflect: hor,
        body: farRingGlsl({ cx: -W * 0.04, cy: H * 0.46, R: H * 0.3, thick: H * 0.05, tilt: 0.36, rot: -0.2, row: "ringdark", lit: "ringlit", fog: 0.25, gap: [5.1, 5.6] }),
        bounds: { y0: 0, y1: hor + 1, x0: -W * 0.12, x1: W * 0.3 },
      });
      L.push(
        mist({ name: "high-streaks", depth: 140, fog: 0.12, y0: -6, y1: H * 0.3, sx: 300 * u, sy: 10 * u, drift: -3, evolve: 0.03, cover: 0.4, warp: 1.6, levels: 3, alpha: 0.45, row: "haze", tone: 0.25, tonePerLevel: 0.15, tint: 0.45 }),
      );
      L.push({
        kind: "glsl",
        name: "cloud-masses",
        depth: 110,
        fog: 0.1,
        body: cloudMassGlsl({ y0: -10, y1: H * 0.36, sx: 150 * u, sy: 34 * u, drift: -2.5, evolve: 0.03, cover: 0.42, alpha: 0.8, row: "cloud", lit: "haze", belly: 5 * u }),
        bounds: { y0: -10, y1: H * 0.36 + 1 },
      });
      // the spire on the east horizon, its storm, and lightning that stays with it
      const spX = W * 0.84, spH = H * 0.5;
      L.push({
        kind: "glsl",
        name: "spire",
        depth: 200,
        fog: 0.22,
        reflect: hor,
        body: spireGlsl({ x: spX, base: hor + 1, h: spH, w: 18 * u, lean: -0.06, row: "spire", cloud: "storm", red: "red", fog: 0.12 }),
        bounds: { x0: spX - spH * 1.0, x1: spX + spH * 1.0, y0: hor - spH * 1.1, y1: hor + 2 },
      });
      L.push({
        kind: "points",
        name: "spire-lightning",
        depth: 200,
        fog: 0.3,
        blend: "add",
        system: new Bolts({ region: [spX - spH * 0.35, hor - spH * 0.88, spX + spH * 0.2, hor - spH * 0.66], rate: 2.5, length: [10 * u, 26 * u], row: R("bolt"), glowRow: R("boltglow"), light: { radius: 90 * u, colour: "#dcdaf0", strength: 0.5 }, glowAlpha: 0 }),
      });
      L.push({
        kind: "points",
        name: "sheet-flash",
        depth: 200,
        system: new SheetLight({ region: [spX - spH * 0.4, hor - spH * 0.9, spX + spH * 0.25, hor - spH * 0.6], rate: 2, radius: 120 * u, colour: "#c9c7e2", strength: 0.45 }),
      });
      L.push(
        mist({ name: "cloud-deck", depth: 60, fog: 0.2, y0: H * 0.02, y1: H * 0.48, sx: 210 * u, sy: 30 * u, drift: 2, evolve: 0.045, cover: 0.5, warp: 1.9, levels: 4, alpha: 0.8, row: "cloud", tone: 0.1, tonePerLevel: 0.22, tint: 0.8, lightGain: 0 }),
      );

      // --- far mesas on the left horizon, low hills on the right --------------------------------
      {
        const d = 56;
        const { x, w } = wide(d);
        const pix = new Pix(w, H + 30);
        const base = g.LY(g.groundY(d), d) + 1;
        const top = (X: number): number => {
          const m = fbm1(X / (70 * u), 5, 3);
          const plateau = smooth(0.42, 0.5, m);
          const left = smooth(W * 0.55, W * 0.2, X);
          const hills = 3 * u + 5 * u * fbm1(X / (40 * u), 6, 3);
          return base - hills - plateau * (H * 0.06 + 6 * u * fbm1(X / (160 * u), 7, 2)) * left - (fbm1(X / (5 * u), 8, 2) - 0.5) * 2 * u;
        };
        terrain(pix, { row: R("far"), top: (px) => top(px + x), bottom: () => base, seed: 9, scale: 18 * u, light: [-1, -0.4], base: 0.5, contrast: 0.35, strata: 0.35, fog: (_px, py) => 0.25 * smooth(base - H * 0.08, base, py) });
        L.push({ kind: "pix", name: "mesas", depth: d, fog: 0.42, pix, x, y: 0, dither: 0.3, reflect: base, reflectFade: 20 * u });
      }

      // --- the ghost, deep in the haze, and the horizon bank --------------------------------------
      const track: ConstructorParameters<typeof Track>[0] = [];
      const ghostBounds = { y0: ghost.ground - 350 * ghost.S, y1: ghost.ground + 1, x0: 0, x1: 0 };
      track.push({ c: ghost, bounds: ghostBounds, ext: EXT, margin: 4 });
      L.push({ kind: "glsl", name: "ghost", depth: GHOST_DEPTH, body: bodyGlsl(ghost, { farFog: 0.18, rearFog: 0.3, groundFog: 0.45 }), bounds: ghostBounds, dither: 0.2, reflect: ghost.ground, reflectFade: 40 * u, reflectDim: 0.1 });
      L.push(
        fogBand({ name: "horizon-bank", depth: 32, y0: hor - H * 0.1, y1: g.LY(g.groundY(32), 32) + 1, softBottom: 2, sx: 190 * u, sy: 10 * u, drift: -2, cover: 0.7, alpha: 0.72, row: "haze", tone: 0.45, tint: 0.3, reflect: hor }),
      );

      // --- the flooded flats ------------------------------------------------------------------------
      L.push(flats({ horizon: hor, G0: g.wl, ref: g.ref, dFar: 140, W, span: g.span, u, water: "water", glint: "glint", foam: "foam", soil: "soil", grass: "grassd", rings: true }));
      L.push({ kind: "points", name: "flock", depth: 28, system: new Flock({ y: [H * 0.16, H * 0.32], x: [-40, W + 40], every: 45, speed: 9 * u, count: [4, 7], row: R("bird"), shade: 0.2 }) });

      // --- the colossus, walking the flats ----------------------------------------------------------
      const d = B2.colDepth;
      const mainBounds = { y0: -1e6, y1: wk.surface + 1, x0: 0, x1: 0 };
      const dustBounds = { y0: wk.surface - 60 * main.S, y1: wk.surface + 1, x0: 0, x1: 0 };
      track.push({ c: main, bounds: mainBounds, ext: EXT, margin: 4 });
      track.push({ c: main, bounds: dustBounds, ext: [EXT[0] - 60, EXT[1] + 120], margin: 4 });
      L.push({ kind: "points", name: "tracker", depth: d, system: new Track(track) });
      L.push({ kind: "points", name: "walk-clock", depth: d, system: new WalkClock(TITLE, wk.feed) });
      L.push({ kind: "glsl", name: "colossus", depth: d, fog: 0.18, body: bodyGlsl(main, { farFog: 0.22, rearFog: 0.5, groundFog: 0.14, groundH: 30 }), bounds: mainBounds, dither: 0.15, reflect: wk.surface, reflectFade: 110 * u, reflectDim: 0.08 });
      L.push({ kind: "glsl", name: "colossus-dust", depth: d, fog: 0.24, body: dustGlsl(main, { farFog: 0.2, strength: 1.0 }), bounds: dustBounds });
      L.push({ kind: "points", name: "spray", depth: d, fog: 0.15, system: new Spray(main, wk.surface, { foam: R("foam"), water: R("glint") }, 0.8), reflect: wk.surface });
      L.push({ kind: "points", name: "wheelers", depth: d, fog: 0.25, system: new Wheelers(main, R("bird"), 7, ctx.rng) });
      L.push({ kind: "points", name: "eye-glint", depth: d, blend: "add", system: new EyeGlint(main, R("glintc"), 2.5) });
      L.push(
        fogBand({ name: "ground-haze", depth: 8, y0: wk.surface - 30 * u, y1: g.LY(g.groundY(8), 8) + 1, softTop: 18 * u, softBottom: 2, sx: 150 * u, sy: 8 * u, drift: -4, evolve: 0.04, cover: 0.55, alpha: 0.5, row: "haze", tone: 0.4, tint: 0.35 }),
      );
      L.push(
        mist({ name: "veil", depth: 7, y0: g.LY(H * 0.28, 7), y1: g.LY(g.groundY(7) - 4 * u, 7), sx: 120 * u, sy: 26 * u, drift: -6, evolve: 0.06, cover: 0.3, warp: 2.2, levels: 3, alpha: 0.45, row: "haze", tone: 0.35, tonePerLevel: 0.15, tint: 0.45, lightGain: 0.8 }),
      );

      // --- the middle distance: outcrops, standing stones and the old marker line in the flats ------
      {
        const dd = 4.5;
        const { x, w } = wide(dd);
        const base = g.LY(g.groundY(dd), dd) + 1;
        const pix = new Pix(w, base + 4);
        const rng = (i: number, k: number): number => hashInt(i, k, 131);
        // standing stones and low outcrops scattered along the flats
        for (let i = 0; i * 60 * u < w; i++) {
          const X = Math.round(i * 60 * u + rng(i, 1) * 40 * u);
          if (rng(i, 2) < 0.45) continue;
          const tall = rng(i, 3) < 0.35;
          const hh = Math.round((tall ? 16 + 10 * rng(i, 4) : 4 + 5 * rng(i, 4)) * u);
          const ww = Math.round((tall ? 3 + 2 * rng(i, 5) : 10 + 16 * rng(i, 5)) * u);
          const lean = (rng(i, 6) - 0.5) * 0.3;
          for (let y = 0; y < hh; y++)
            for (let xx = 0; xx < ww; xx++) {
              const t = y / hh;
              const inset = tall ? Math.round(t * t * ww * 0.3) : Math.round(Math.pow(t, 0.5) * ww * 0.45);
              if (xx < inset || xx >= ww - inset * (tall ? 1 : 0.8)) continue;
              const px = X + xx + Math.round(y * lean) - x;
              const lit = xx - inset < Math.max(1, u);
              pix.set(px, base - 1 - y, (lit ? 0.44 : 0.22) + (y === hh - 1 ? 0.12 : 0), R("stone"));
            }
        }
        // marker posts with a strip of red cloth, leaning, receding along the old way
        for (let i = 0; i * 110 * u < w; i++) {
          const X = Math.round(i * 110 * u + rng(i, 9) * 30 * u);
          const hh = Math.round((12 + 4 * rng(i, 10)) * u);
          const lean = 0.1 + rng(i, 11) * 0.12;
          for (let y = 0; y < hh; y++) {
            const px = X + Math.round(y * lean) - x;
            pix.set(px, base - 1 - y, 0.36, R("wood"));
            if (u >= 2) pix.set(px + 1, base - 1 - y, 0.16, R("wood"));
          }
          const tx = X + Math.round(hh * lean) - x;
          for (let k = 0; k < Math.round(6 * u); k++) pix.set(tx - 1 - k, base - hh + 1 + Math.round(k * 0.3), k % 3 === 0 ? 0.35 : 0.65, R("cloth"));
        }
        L.push({ kind: "pix", name: "mid-stones", depth: dd, pix, x, y: 0, dither: 0.3, fog: 0.08, reflect: base, reflectFade: 20 * u });
      }

      // --- the player plane: the road, the breaks, the crater, Stonetop ------------------------------
      {
        const x0 = g.X(B2.x0) - 12;
        const x1 = g.X(B2.x1) + 12;
        const y0 = g.Y(B2.summit[2] + 0.6);
        const y1 = g.Y(B2.crater.floor - 2.7);
        const pix = new Pix(x1 - x0, y1 - y0);
        const rows = { stone: R("stone"), dark: R("dark"), moss: R("moss"), earth: R("earth"), lichen: R("lichen"), tor: R("tor") };
        buildTor(pix, g, x0, y0, rows);
        buildRoad(pix, g, x0, y0, rows);
        L.push(...splitPix(pix, { name: "road", depth: 1, x: x0, y: y0, reflect: g.Y(B2.flats), reflectFade: 110 * u, dither: 0 }));
      }
      L.push({ kind: "character", name: "figure", depth: 1, x: g.X(126), ground: g.Y(1.2), rimDir: [-1, -1], height: g.P });

      // --- in front: the water you wade through (the crater's pool, break 2), grit on the wind ---------
      {
        const c = B2.crater, k = B2.break2;
        const spans: [number, number][] = [
          [g.X(c.pool[0] - 0.3), g.X(c.pool[1] + 0.3)],
          [g.X(k.x0 + 0.3), g.X(k.x1 - 0.3)],
        ];
        L.push({ kind: "glsl", name: "wade-crater", depth: 1, body: wadeFrontGlsl({ spans: [spans[0]!], surface: g.Y(c.water), depth: Math.round(g.P * 0.36), row: "water", lit: "glint", alpha: 0.7 }), bounds: { x0: spans[0]![0], x1: spans[0]![1], y0: g.Y(c.water) - 3, y1: g.Y(c.water) + g.P } });
        L.push({ kind: "glsl", name: "wade-break", depth: 1, body: wadeFrontGlsl({ spans: [spans[1]!], surface: g.Y(k.water), depth: Math.round(g.P * 0.34), row: "water", lit: "glint", alpha: 0.7 }), bounds: { x0: spans[1]![0], x1: spans[1]![1], y0: g.Y(k.water) - 3, y1: g.Y(k.water) + g.P } });
      }
      L.push({
        kind: "points",
        name: "grit",
        depth: 1.3,
        system: new Motes({ region: [-40, hor - 30 * u, W + 40, H], count: Math.round(40 * u), row: R("dust"), shade: [0.3, 0.8], vel: [26, -1.5], wander: 4, size: 1, twinkle: 0.2 }, ctx.rng),
      });
      void R("rock");
      // the spire (200) and its lightning are farther than the high streaks (140) and cloud masses (110): they sit behind them
      moveAfter(L, ["spire", "spire-lightning", "sheet-flash"], "ring");
      return L;
    },
  };
}

export default causeway(false);

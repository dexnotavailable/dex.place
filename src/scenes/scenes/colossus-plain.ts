// colossus-plain (ref w01): a pale colossus the size of weather walks across the
// far distance of a dark plain, on a loop; a second one, deeper in the haze,
// follows its own slower loop. Feet lift and plant with weight and throw dust
// and clods; the haze swallows its far side and its feet; lightning flickers
// rarely inside the cloud behind it. One small figure on an old causeway in
// front. Everything is generated here at runtime; see colossus-plain/ for the
// creature (a per-pixel SDF body with a walk model), its particle systems and
// the ground.

import {
  Flock,
  Motes,
  Pix,
  fogBand,
  mist,
  rangeProfile,
  sky,
  smooth,
  terrain,
  fbm1,
  fbm,
  hashInt,
  mulberry,
  type LayerDef,
  type SceneDef,
} from "../engine/index.ts";
import { EXTENT, LEGS, colossusGlsl, dustGlsl, type ColossusDef } from "./colossus-plain/colossus.ts";
import { Bolts, Debris, EyeGlint, SheetLight, Tracker, Wheelers } from "./colossus-plain/systems.ts";
import { buildCauseway, buildPost, geo, plainGlsl, ribbonGlsl, sunGlsl, type Geo } from "./colossus-plain/ground.ts";
import { cloudMassGlsl } from "./colossus-plain/sky.ts";

const MAIN_DEPTH = 18;
const GHOST_DEPTH = 44;

/** A crossing that starts with the head just off the right edge and ends with the tail off the left. */
function crossing(g: Geo, depth: number, o: { S: number; vd: number; gap: number; startAt: number; T: number; seed: number; dendrites: boolean }): ColossusDef {
  const [lx, rx] = g.reach(depth, 6);
  const x0 = rx - EXTENT.x0 * o.S;
  const xEnd = lx - (EXTENT.x1 + 40) * o.S;
  const cross = (x0 - xEnd) / (o.vd * o.S);
  const period = cross + o.gap;
  return {
    S: o.S,
    ground: g.groundY(depth),
    x0,
    period,
    // where the body origin sits at t = 0, as a fraction of the screen
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

const scene: SceneDef = {
  title: "colossus-plain",
  palette: {
    // the creature: pale bone with cold blue-lilac shadows
    flesh: ["#4a5064", "#6a7086", "#8f94a7", "#b4b6c2", "#d8d7db"],
    tar: ["#0c0c11", "#17171e", "#24242d", "#393944", "#5b5b68"],
    vein: ["#4b2427", "#7a3432", "#a24a42", "#c46e5f"],
    dust: ["#4e4643", "#665c56", "#817870", "#9e968d", "#bab3aa"],
    // ground: dark umber plain, rust-streaked rock, a darker stone for the causeway
    plain: ["#1a1414", "#261d1b", "#342722", "#45342c", "#5a4538", "#735a4a", "#8d7563"],
    rock: ["#130e0e", "#1e1615", "#2c201d", "#3e2c26", "#563a2f", "#74503d", "#94705a"],
    stone: ["#0c0b0d", "#171417", "#221e21", "#302a2c", "#43393a", "#5f5150"],
    moss: ["#2a2a22", "#3c3b2c", "#50503a"],
    far: ["#6a6977", "#767684", "#828290", "#8f8e9a"],
    cloud: ["#5b6179", "#676d87", "#747a94", "#8389a1"],
    haze: ["#8a8c9f", "#9a9cad", "#abacb9", "#bcbcc5", "#cfcdd1"],
    cloth: ["#2b1416", "#4a1f1f", "#6e2e29", "#90463a"],
    bird: ["#3a3a44", "#4c4c57"],
    bolt: ["#b9b7d6", "#dcdaf0", "#f6f4ff"],
    boltglow: ["#9a98bd", "#bdbbd8", "#dddbee"],
    glint: ["#a7a3b8", "#dcd8e6", "#fbf8ff"],
    standin: ["#07070a", "#101015", "#24232c", "#a29792"],
  },
  fog: {
    stops: [
      [0.0, "#5f6784"],
      [0.22, "#737a96"],
      [0.46, "#8a8ea4"],
      [0.62, "#a1a2b2"],
      [0.7, "#b3b1b9"],
      [0.72, "#b1adb1"],
      [0.78, "#958c8c"],
      [0.9, "#6c615d"],
      [1.0, "#4c423d"],
    ],
    // few flat bands; only the rows at each band edge are dithered
    bands: 9,
    dither: 0.35,
    density: 0.026,
    max: 0.9,
    glow: { x: 0.18, y: 0.52, r: 0.95, colour: "#c9c4c6", strength: 0.4, steps: 7 },
  },
  span: (W) => Math.round(W * 0.45),
  driftPeriod: 110,

  prelude: (ctx) => sunGlsl(geo(ctx)),

  build: (ctx) => {
    const g = geo(ctx);
    const { W, H, u, hor } = g;
    const L: LayerDef[] = [];
    const R = (n: string): number => ctx.row(n);
    const wide = (d: number): { x: number; w: number } => {
      const w = ctx.panWidth(d) + 8;
      return { x: -Math.ceil((w - W) / 2), w };
    };

    // --- sky and the cloud deck ----------------------------------------------
    L.push(sky());
    L.push(
      mist({
        name: "high-streaks",
        depth: 140,
        fog: 0.12,
        y0: -6,
        y1: H * 0.3,
        sx: 300 * u,
        sy: 10 * u,
        drift: -3,
        evolve: 0.03,
        cover: 0.4,
        warp: 1.6,
        levels: 3,
        alpha: 0.45,
        row: "haze",
        tone: 0.25,
        tonePerLevel: 0.15,
        tint: 0.45,
      }),
    );

    // big soft cloud bodies drifting slowly, lit underneath by the haze
    L.push({
      kind: "glsl",
      name: "cloud-masses",
      depth: 110,
      fog: 0.1,
      body: cloudMassGlsl({ y0: -10, y1: H * 0.36, sx: 150 * u, sy: 34 * u, drift: -2.5, evolve: 0.03, cover: 0.42, alpha: 0.8, row: "cloud", lit: "haze", belly: 5 * u }),
      bounds: { y0: -10, y1: H * 0.36 + 1 },
    });

    // lightning deep in the cloud behind the colossus, mostly hidden by the cloud in front of it
    const bolts = new Bolts({
      region: [W * 0.05, H * 0.08, W * 0.95, H * 0.3],
      rate: 4,
      length: [18 * u, 46 * u],
      row: R("bolt"),
      glowRow: R("boltglow"),
      light: { radius: 150 * u, colour: "#dcdaf0", strength: 0.55 },
      glowAlpha: 0,
    });
    L.push({ kind: "points", name: "lightning", depth: 70, fog: 0.35, blend: "add", system: bolts });
    L.push({
      kind: "points",
      name: "sheet-flash",
      depth: 70,
      system: new SheetLight({ region: [W * 0.05, H * 0.1, W * 0.95, H * 0.36], rate: 2, radius: 180 * u, colour: "#c9c7e2", strength: 0.5 }),
    });
    L.push(
      mist({
        name: "cloud-deck",
        depth: 60,
        fog: 0.2,
        y0: H * 0.02,
        y1: H * 0.5,
        sx: 210 * u,
        sy: 30 * u,
        drift: 2,
        evolve: 0.045,
        cover: 0.55,
        warp: 1.9,
        levels: 4,
        alpha: 0.85,
        row: "cloud",
        tone: 0.1,
        tonePerLevel: 0.22,
        tint: 0.8,
        lightGain: 0,
      }),
    );

    // --- the plain (ground plane) ------------------------------------------------
    L.push({ kind: "glsl", name: "plain", depth: 1, fog: 0, body: plainGlsl(g, { dFar: 140 }), bounds: { y0: hor, y1: 1e6 } });

    // far mesas on the left horizon, low hills on the right
    {
      const d = 56;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.groundY(d) + 1;
      const top = (X: number): number => {
        const m = fbm1(X / (70 * u), 5, 3);
        const plateau = smooth(0.42, 0.5, m);
        const left = smooth(W * 0.55, W * 0.2, X);
        const hills = 4 * u + 6 * u * fbm1(X / (40 * u), 6, 3);
        return base - hills - plateau * (H * 0.075 + 6 * u * fbm1(X / (160 * u), 7, 2)) * left - (fbm1(X / (5 * u), 8, 2) - 0.5) * 2 * u;
      };
      terrain(pix, {
        row: R("far"),
        top: (px) => top(px + x),
        bottom: () => base,
        seed: 9,
        scale: 18 * u,
        light: [-1, -0.4],
        base: 0.5,
        contrast: 0.35,
        strata: 0.35,
        fog: (_px, py) => 0.25 * smooth(base - H * 0.08, base, py),
      });
      L.push({ kind: "pix", name: "mesas", depth: d, fog: 0.42, pix, x, y: 0, dither: 0.3 });
    }

    // --- the ghost: a second colossus much deeper in the haze, on its own slow loop
    const track: ConstructorParameters<typeof Tracker>[0] = [];
    const ghost = crossing(g, GHOST_DEPTH, { S: 0.4 * u, vd: 13, gap: 30, startAt: 1.35, T: 5.6, seed: 23, dendrites: false });
    const ghostBounds = { y0: ghost.ground - 350 * ghost.S, y1: ghost.ground + 2, x0: 0, x1: 0 };
    track.push({ c: ghost, bounds: ghostBounds, ext: [EXTENT.x0, EXTENT.x1], margin: 4 });
    L.push({
      kind: "glsl",
      name: "ghost",
      depth: GHOST_DEPTH,
      body: colossusGlsl(ghost, { farFog: 0.18, rearFog: 0.3, groundFog: 0.45 }),
      bounds: ghostBounds,
      dither: 0.2,
    });
    L.push(
      fogBand({
        name: "horizon-bank",
        depth: 32,
        y0: hor - H * 0.13,
        y1: g.groundY(32) + 1,
        softBottom: 2,
        sx: 190 * u,
        sy: 10 * u,
        drift: -2,
        cover: 0.72,
        alpha: 0.75,
        row: "haze",
        tone: 0.45,
        tint: 0.3,
      }),
    );

    // a far flock (drawn before the colossus: it is behind it, and never in front of the player), crossing now and then, for scale against the cloud
    L.push({
      kind: "points",
      name: "flock",
      depth: 28,
      system: new Flock({ y: [H * 0.18, H * 0.34], x: [-40, W + 40], every: 45, speed: 9 * u, count: [4, 7], row: R("bird"), shade: 0.2 }),
    });

    // --- the colossus ------------------------------------------------------------------
    const main = crossing(g, MAIN_DEPTH, { S: 0.9 * u, vd: 16.5, gap: 9, startAt: 0.7, T: 4.8, seed: 7, dendrites: true });
    const mainBounds = { y0: -1e6, y1: main.ground + 3, x0: 0, x1: 0 };
    const dustBounds = { y0: main.ground - 70 * main.S, y1: main.ground + 3, x0: 0, x1: 0 };
    track.push({ c: main, bounds: mainBounds, ext: [EXTENT.x0, EXTENT.x1], margin: 4 });
    track.push({ c: main, bounds: dustBounds, ext: [EXTENT.x0 - 60, EXTENT.x1 + 120], margin: 4 });
    L.push({ kind: "points", name: "tracker", depth: MAIN_DEPTH, system: new Tracker(track) });
    L.push({
      kind: "glsl",
      name: "colossus",
      depth: MAIN_DEPTH,
      fog: 0.2,
      body: colossusGlsl(main, { farFog: 0.22, rearFog: 0.55, groundFog: 0.22, groundH: 22 }),
      bounds: mainBounds,
      dither: 0.15,
    });
    L.push({
      kind: "glsl",
      name: "colossus-dust",
      depth: MAIN_DEPTH,
      fog: 0.24,
      body: dustGlsl(main, { farFog: 0.2, strength: 1.8 }),
      bounds: dustBounds,
    });
    L.push({ kind: "points", name: "colossus-debris", depth: MAIN_DEPTH, system: new Debris(main, { tar: R("tar"), dust: R("dust") }, 1.8) });
    L.push({ kind: "points", name: "wheelers", depth: MAIN_DEPTH, fog: 0.25, system: new Wheelers(main, R("bird"), 7, ctx.rng) });
    L.push({ kind: "points", name: "eye-glint", depth: MAIN_DEPTH, blend: "add", system: new EyeGlint(main, R("glint"), 2.5) });

    // ground haze the feet stand in, and a drifting veil in front of the colossus's lower body
    L.push(
      fogBand({
        name: "ground-haze",
        depth: 13,
        y0: main.ground - 34 * u,
        y1: g.groundY(13) + 1,
        softTop: 20 * u,
        softBottom: 2,
        sx: 150 * u,
        sy: 8 * u,
        drift: -4,
        evolve: 0.04,
        cover: 0.6,
        alpha: 0.55,
        row: "haze",
        tone: 0.4,
        tint: 0.35,
      }),
    );
    L.push(
      mist({
        name: "veil",
        depth: 11,
        y0: H * 0.3,
        y1: g.groundY(11) - 4 * u,
        sx: 120 * u,
        sy: 26 * u,
        drift: -6,
        evolve: 0.06,
        cover: 0.32,
        warp: 2.2,
        levels: 3,
        alpha: 0.5,
        row: "haze",
        tone: 0.35,
        tonePerLevel: 0.15,
        tint: 0.45,
        lightGain: 0.8,
      }),
    );

    // --- the middle distance: two low outcrops and a lone standing stone, for scale ---
    {
      const d = 6.5;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.groundY(d) + 1;
      const outcrop = (cx: number, hw: number, hh: number, seed: number) => (X: number): number => {
        const t = Math.abs(X - cx) / hw;
        if (t > 1) return 1e9;
        const sh = Math.pow(1 - t, 0.6) * hh * (0.75 + 0.5 * fbm1(X / (5 * u), seed, 3));
        return base - Math.max(0, sh);
      };
      const shapes = [
        outcrop(W * 0.08, 34 * u, 9 * u, 1),
        outcrop(W * 0.52, 20 * u, 5 * u, 2),
        outcrop(W * 1.02, 46 * u, 12 * u, 3),
        // the standing stone: narrow, tall, slightly leaning
        (X: number): number => {
          const cx = W * 0.62;
          const t = Math.abs(X - cx - 1 * u) / (3.2 * u);
          return t > 1 ? 1e9 : base - 26 * u + Math.pow(t, 3) * 5 * u + (X - cx) * 0.4;
        },
      ];
      const top = (X: number): number => Math.min(...shapes.map((f) => f(X)));
      terrain(pix, {
        row: R("rock"),
        top: (px) => top(px + x),
        bottom: () => base,
        seed: 55,
        scale: 7 * u,
        light: [-1, -0.8],
        base: 0.38,
        contrast: 0.5,
        strata: 0.3,
        rim: 0.2,
        rimDepth: 1,
      });
      L.push({ kind: "pix", name: "mid-stones", depth: d, pix, x, y: 0, dither: 0.3 });
    }

    // --- near: a low rock lip on the right, w01's ridge. Its crest climbs from
    // the plain to just above the colossus's ground line at the right edge, so
    // a foot planted out there sinks behind it and its dust rises over it, while
    // the lip stays low enough to leave the entry path open. Painted as tilted
    // strata shelves that rise with the ridge: each shelf has a lit ledge on
    // top, an overhang shadow under the shelf above, and is broken along its
    // length into blocks by short slanted cracks. Warped so nothing tiles; a
    // ragged scree foot below.
    {
      const d = 1.6;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.groundY(d) + 1;
      const x0 = W * 0.54;
      const peak = main.ground - 5 * u;
      const tilt = 0.26;
      const sp = 7 * u;
      const top = (X: number): number => {
        const t = Math.pow(smooth(0, 1, (X - x0) / (W * 0.36)), 0.8);
        if (t <= 0) return 1e9;
        const body = base - (base - peak) * t * (0.72 + 0.5 * fbm1(X / (48 * u), 71, 3));
        // a rough crest: broken steps and a few teeth
        const step = Math.floor(fbm1(X / (14 * u), 74, 2) * 5) * 2 * u;
        const teeth = Math.max(0, fbm1(X / (6 * u), 72, 3) - 0.56) * 22 * u;
        return Math.round(Math.min(base - 1, body + step - teeth + (fbm1(X / (2.5 * u), 73, 2) - 0.5) * 1.5 * u));
      };
      const bottom = (X: number): number => base + Math.round(Math.max(0, fbm1(X / (7 * u), 75, 3) - 0.35) * 9 * u);
      for (let px = 0; px < w; px++) {
        const X = x + px;
        const tp = top(X);
        if (tp > 1e8) continue;
        const bt = bottom(X);
        const tl = top(X - 1);
        for (let Y = tp; Y < bt; Y++) {
          const below = Y - tp;
          // strata coordinate: rises to the right with the ridge, gently warped
          const v = Y + tilt * (X - x0) + (fbm(X / (30 * u), Y / (12 * u), 81, 2) - 0.5) * 5 * u;
          const band = Math.floor(v / sp);
          const fv = v - band * sp;
          // each shelf is broken into blocks of its own length; cracks lean
          const segW = (16 + 26 * hashInt(band, 0, 85)) * u;
          const sx = X + 0.6 * (Y - tp) + hashInt(band, 1, 85) * 200;
          const seg = Math.floor(sx / segW);
          const fx = sx - seg * segW;
          const tone = hashInt(band, seg, 86);
          let sh = 0.36 + 0.12 * (tone - 0.5) - 0.14 * smooth(0, base - peak, below);
          if (fv < 1.2 * u) sh += 0.26; // the ledge: the top of the shelf catches the sky
          else if (fv > sp - 1.1 * u && hashInt(band, seg, 87) > 0.25) sh = Math.min(sh, 0.08); // overhang shadow
          // a slanted crack at a block end, lit on its right lip (light from the left)
          if (fx < 1 && fv > 1.2 * u && hashInt(band, seg, 88) > 0.3) sh = 0.05;
          else if (fx < 2.2 * u && fv > 1.2 * u) sh += 0.08;
          // grit clusters and pitting, irregular
          const cl = fbm(X / (3.5 * u), Y / (2.5 * u), 79, 2);
          if (cl > 0.66) sh += 0.06;
          else if (cl < 0.28) sh -= 0.05;
          // the crest: a lit rim, brighter where the ridge line faces up-left
          if (below === 0) sh = Math.max(sh, tl >= tp ? 0.82 : 0.62);
          else if (below < 2 * u) sh = Math.max(sh, 0.56);
          // the foot sits in its own dust and shadow
          if (Y > base - 2) sh = Math.min(sh, 0.16 + 0.06 * hashInt(X, Y, 89));
          pix.set(px, Y, sh, R("rock"), 0);
        }
      }
      // loose boulders in front of the foot
      const rb = mulberry(83);
      for (let k = 0; k < 11; k++) {
        const bxw = W * (0.6 + rb() * 0.5) - x;
        const rr = (1.5 + rb() * 4) * u;
        const cy = base + (1 + rb() * 6) * u;
        for (let yy = -rr; yy <= 1; yy++)
          for (let xx = -rr * 1.4; xx <= rr * 1.4; xx++) {
            if ((xx / 1.4) ** 2 + yy ** 2 > rr * rr) continue;
            const lit = yy < -rr * 0.4 && xx < 0 ? 0.4 : yy < 0 ? 0.26 : 0.12;
            pix.set(Math.round(bxw + xx), Math.round(cy + yy), lit, R("rock"), 0);
          }
      }
      L.push({ kind: "pix", name: "rock-ridge", depth: d, pix, x, y: 0, dither: 0 });
    }

    // --- the causeway, the post and its cloth, the figure --------------------------------
    let tip: [number, number] = [0, 0];
    {
      const { x, w } = wide(1);
      const pix = new Pix(w, H);
      buildCauseway(pix, g, x, R("stone"), R("moss"));
      const t = buildPost(pix, x, g.figX - Math.round(92 * u), g.deck, R("stone"));
      tip = [t.tipX, t.tipY];
      L.push({ kind: "pix", name: "causeway", depth: 1, pix, x, y: 0, dither: 0.2 });
    }
    L.push({
      kind: "glsl",
      name: "cloth",
      depth: 1,
      body: ribbonGlsl(tip, { len: 26, row: "cloth" }),
      bounds: { x0: tip[0] - 28, x1: tip[0] + 1, y0: tip[1] - 8, y1: tip[1] + 22 },
    });
    L.push({ kind: "character", name: "figure", depth: 1, x: g.figX, ground: g.deck, rimDir: [-1, -1], facing: 1 });

    // grit and seed-fluff blowing past, near and mid
    L.push({
      kind: "points",
      name: "grit",
      depth: 1.6,
      system: new Motes(
        {
          region: [-40, hor - 30 * u, W + 40, H],
          count: Math.round(40 * u),
          row: R("dust"),
          shade: [0.3, 0.8],
          vel: [-18, -1.5],
          wander: 4,
          size: 1,
          twinkle: 0.2,
        },
        ctx.rng,
      ),
    });

    // --- foreground: dark rocks in the bottom corners -----------------------------------
    {
      const d = 0.72;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const lr = rangeProfile({ base: H + 4, amp: H * 0.14, scale: 50 * u, seed: 91, sharp: 0.4 });
      const top = (X: number): number => {
        const m = Math.max(smooth(W * 0.13, -W * 0.03, X), smooth(W * 0.9, W * 1.06, X));
        return m <= 0.02 ? 1e9 : H + 4 - (H + 4 - lr(X)) * m;
      };
      terrain(pix, {
        row: R("rock"),
        top: (px) => top(px + x),
        seed: 92,
        scale: 12 * u,
        chunk: 3,
        light: [-0.6, -1],
        base: 0.12,
        contrast: 0.3,
        strata: 0.3,
        rim: 0.18,
        rimDepth: 3,
      });
      L.push({ kind: "pix", name: "foreground", depth: d, pix, x, y: 0, dither: 0 });
    }
    return L;
  },
};

export default scene;

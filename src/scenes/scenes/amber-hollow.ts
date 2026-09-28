// amber-hollow (ref w04): the inside of a vast hollow with an industrial city.
// A far wall with a huge chamfered opening onto a bright rock face, stacked
// tower silhouettes at several depths dissolving into amber haze, thousands of
// 1 px window lights, slowly swinging cranes, a hammerhead tower, furnace pits
// glowing from below, steam plumes, flickering signs, searchlights, a freighter
// with headlights crossing, embers rising, one small figure on a gantry.
// Everything is generated here at runtime; helpers live in ./amber-hollow/.

import { Embers, Falling, Motes, Pix, mist, fogBand, glow, shaft, shaftFn, sky, type BuildCtx, type LayerDef, type SceneDef } from "../engine/index.ts";
import { D, geo, type Geo } from "./amber-hollow/geo.ts";
import { beam, cable, ceiling, city, hammerhead, rimToward, type FogFn, type WinSet } from "./amber-hollow/city.ts";
import { bridge, deck, foreground, lowRoofs, overhang, ziggurat } from "./amber-hollow/near.ts";
import { FlashSpacing, SpacedFlashes } from "./amber-hollow/flashes.ts";
import { buildShip } from "./amber-hollow/ship.ts";
import {
  cliffBody,
  craneBody,
  furnaceBody,
  plumeBody,
  prelude as amberPrelude,
  searchBody,
  shipBody,
  shipLane,
  shipLightBody,
  signBody,
  smokeBody,
  wallBody,
  type Crane,
  type Sign,
} from "./amber-hollow/glsl.ts";

const smooth01 = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The sign on the foundry block (depth D.near); the prelude washes its wall with it. */
function nearSign(g: Geo): Sign {
  const { W, H, u } = g;
  return {
    x: Math.round(W * 0.155),
    y: Math.round(H * 0.5),
    w: Math.round(9 * u),
    h: Math.round(42 * u),
    row: "signa",
    period: 9.5,
    offset: 2,
    vertical: true,
  };
}

/** Light shaft from the opening, falling down-left through the haze (depth 20). */
const SHAFT_D = 20;
function shaftGeo(g: Geo): { from: [number, number]; to: [number, number] } {
  return { from: [g.W * 0.66, g.H * 0.12], to: [g.W * 0.4, g.H * 0.86] };
}

const scene: SceneDef = {
  title: "amber-hollow",
  palette: {
    wall: ["#0c0a0d", "#161110", "#221812", "#332317", "#4d341e", "#7d5429", "#c08a48"],
    cliff: ["#4e301c", "#6e4726", "#94663a", "#bd8c4e", "#dfb46e", "#f6da9c", "#fff4da"],
    far: ["#2e1f16", "#3f2a1b", "#523822", "#68482a"],
    mid: ["#0f0c0e", "#191311", "#261b15", "#39281b", "#5a3e25", "#93673a"],
    near: ["#070709", "#0d0b0d", "#161110", "#221914", "#35271b", "#6e4c2b"],
    crane: ["#0e0b0d", "#1a1411", "#2b2017", "#46321f", "#7a5630"],
    ship: ["#0b0a0d", "#15110f", "#221a14", "#36291d", "#5c4229", "#9c7246"],
    win: ["#7a4418", "#d48a34", "#ffd27a"],
    win2: ["#6e2e12", "#c45c1e", "#ff9a3c"],
    win3: ["#8a7050", "#d6c09a", "#fff1cf"],
    fire: ["#4a1606", "#8e300c", "#d45a16", "#ff8e2e", "#ffc868", "#fff0c0"],
    steam: ["#3a291e", "#5c4430", "#86664a", "#b28f66", "#dcbb88"],
    haze: ["#4a3020", "#76502f", "#a37446", "#cf9f63", "#eec888"],
    search: ["#86765c", "#e4d8bc", "#fffaf0"],
    beam: ["#6e4e2a", "#b88a4c", "#eccf94", "#fff4d6"],
    head: ["#7e98aa", "#cfe2ee", "#f4fbff"],
    nav: ["#4a0e08", "#ff4a26"],
    signa: ["#2a1206", "#7a3410", "#dc7422", "#ffc464"],
    signr: ["#2e0a06", "#6e1a10", "#d23e26", "#ff8a5c"],
    signc: ["#061e20", "#0e4642", "#249a8c", "#96ecd4"],
    lamp: ["#6d3f1c", "#c7803a", "#ffd494"],
    ember: ["#4a1606", "#b8401a", "#ff8a2a", "#ffd070"],
    spark: ["#c86a24", "#ffc870", "#fff6dc"],
    standin: ["#060508", "#0c0a0c", "#221812", "#f2b262"],
  },
  fog: {
    // bright in the middle band where the opening's light hangs, near-black at the
    // ceiling and in the lower third, where only the furnace pockets burn
    stops: [
      [0.0, "#0b0809"],
      [0.12, "#1b120d"],
      [0.28, "#472e19"],
      [0.45, "#8a5a2c"],
      [0.58, "#945c2c"],
      [0.68, "#5c361a"],
      [0.78, "#2e1b10"],
      [0.9, "#1a100b"],
      [1.0, "#0f0a08"],
    ],
    bands: 22,
    density: 0.05,
    max: 0.86,
    glow: { x: 0.66, y: 0.26, r: 0.64, colour: "#ffe6b4", strength: 0.86, steps: 8 },
  },
  span: (W) => Math.round(W * 0.45),
  driftPeriod: 100,

  prelude: (ctx: BuildCtx) => {
    const g = geo(ctx);
    const sp = buildShip(g.u);
    const lane = shipLane(g, ctx, sp);
    const sh = shaftGeo(g);
    return (
      shaftFn({ fn: "openShaft", from: sh.from, to: sh.to, w0: g.H * 0.05, w1: g.H * 0.2, streaks: 7, speed: 0.035, fadeStart: 0.6, intensity: 0.9 }) +
      shaftFn({
        fn: "openShaft2",
        from: [g.W * 0.74, g.H * 0.14],
        to: [g.W * 0.9, g.H * 0.82],
        w0: g.H * 0.03,
        w1: g.H * 0.1,
        streaks: 5,
        speed: -0.03,
        fadeStart: 0.55,
        intensity: 0.6,
      }) +
      amberPrelude(g, sp, lane, nearSign(g))
    );
  },

  build: (ctx) => {
    const g = geo(ctx);
    const { W, H, u } = g;
    const L: LayerDef[] = [];
    const R = (n: string): number => ctx.row(n);
    const wide = (d: number): { x: number; w: number } => {
      const w = ctx.panWidth(d) + 8;
      return { x: -Math.ceil((w - W) / 2), w };
    };
    const wins: WinSet = { rows: [R("win"), R("win2"), R("win3")], weights: [0.62, 0.26, 0.12] };
    const winsNear: WinSet = { rows: [R("win"), R("win2")], weights: [0.7, 0.3] };
    const sp = buildShip(u);
    const sign0 = nearSign(g);

    // --- far: sky, the rock face beyond the opening, the wall -----------------
    L.push(sky());
    L.push({ kind: "glsl", name: "cliff", depth: D.cliff, fog: 0.1, body: cliffBody(g), bounds: { y0: 0, y1: Math.round(H * 0.86) } });
    // haze drifting in the opening, in front of the rock
    L.push(
      mist({
        name: "open-haze",
        depth: 60,
        y0: H * 0.02,
        y1: H * 0.8,
        sx: 220 * u,
        sy: 26 * u,
        drift: -3,
        evolve: 0.04,
        cover: 0.5,
        warp: 1.6,
        octaves: 3,
        levels: 3,
        alpha: 0.5,
        row: "haze",
        tone: 0.55,
        tonePerLevel: 0.12,
        tint: 0.45,
        lightGain: 0.4,
      }),
    );
    L.push({ kind: "glsl", name: "wall", depth: D.wall, fog: 0.16, body: wallBody(g) });

    // high smoke streaks under the ceiling and across the opening
    L.push(
      mist({
        name: "smoke-high",
        depth: D.smokeHigh,
        y0: 0,
        y1: H * 0.42,
        softTop: 4,
        sx: 260 * u,
        sy: 14 * u,
        drift: -5,
        evolve: 0.05,
        cover: 0.42,
        warp: 1.8,
        octaves: 3,
        levels: 3,
        alpha: 0.5,
        row: "haze",
        tone: 0.3,
        tonePerLevel: 0.14,
        tint: 0.5,
        lightGain: 0.5,
      }),
    );

    // struts: huge girders bracing the opening
    {
      const d = D.struts;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const o = { row: R("mid"), shade: 0.2, rib: 14 * u, edge: 0.16, seed: 5 };
      const lowFog: FogFn = (_x, y) => 0.25 * smooth01(H * 0.5, H * 0.85, y);
      beam(pix, x, [W * 0.3, H * 0.34], [W * 0.56, H * 0.84], 11 * u, { ...o, fog: lowFog });
      beam(pix, x, [W * 0.86, H * 0.3], [W * 0.6, H * 0.84], 9 * u, { ...o, seed: 6, fog: lowFog });
      beam(pix, x, [W * 0.3, H * 0.6], [W * 0.92, H * 0.6], 7 * u, { ...o, seed: 7, truss: true, fog: lowFog });
      beam(pix, x, [W * 0.36, H * 0.2], [W * 0.84, H * 0.2], 5 * u, { ...o, seed: 8, truss: true, fog: lowFog });
      for (let k = 0; k < 5; k++) cable(pix, x, [W * (0.36 + k * 0.1), H * 0.2], [W * (0.41 + k * 0.1), H * 0.2], H * 0.03, R("mid"), 0.18);
      L.push({ kind: "pix", name: "struts", depth: d, fog: 0.5, pix, x, y: 0, dither: 0.3 });
    }
    // the visible light shafts from the opening
    const sh = shaftGeo(g);
    L.push(shaft({ fn: "openShaft", name: "shaft", depth: SHAFT_D, row: "beam", steps: 4, alpha: 0.18, bounds: { y0: sh.from[1] - 10, y1: sh.to[1] + 2 } }));
    L.push(shaft({ fn: "openShaft2", name: "shaft2", depth: SHAFT_D, row: "beam", steps: 3, alpha: 0.14, bounds: { y0: H * 0.1, y1: H * 0.84 } }));

    // --- the far city: two rows of towers dissolving into the haze -----------
    const openX = g.open.cx;
    {
      const d = D.far;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const fog: FogFn = (_x, y) => 0.55 * smooth01(g.farG - H * 0.28, g.farG, y);
      const env = (X: number): number =>
        0.35 + 0.65 * Math.max(smooth01(W * 0.25, W * 0.5, X) * smooth01(W * 1.0, W * 0.78, X), 0.55 * smooth01(W * 0.25, W * 0.02, X));
      city(pix, x, {
        x0: x,
        x1: x + w,
        ground: g.farG,
        minH: 16 * u,
        maxH: H * 0.44,
        minW: 7 * u,
        maxW: 22 * u,
        row: R("far"),
        wins,
        seed: 21,
        shade: 0.3,
        gap: 3 * u,
        lit: 0.1,
        gx: 2,
        gy: 3,
        fog,
        env,
        tip: R("nav"),
        u: u * 0.8,
        blocky: 0.3,
      });
      rimToward(pix, openX - x, 0.12, 0.14);
      L.push({ kind: "pix", name: "city-far", depth: d, pix, x, y: 0, twinkle: 0.4, dither: 0.3 });
    }
    L.push(
      fogBand({
        name: "haze-far",
        depth: D.hazeFar,
        y0: H * 0.5,
        y1: H * 0.84,
        sx: 190 * u,
        sy: 12 * u,
        drift: -2,
        cover: 0.62,
        alpha: 0.5,
        row: "haze",
        tone: 0.5,
        tint: 0.4,
        lightGain: 0.8,
      }),
    );
    {
      const d = D.far2;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const fog: FogFn = (_x, y) => 0.5 * smooth01(g.far2G - H * 0.3, g.far2G, y);
      const env = (X: number): number => 0.3 + 0.7 * (1 - 0.6 * smooth01(W * 0.3, W * 0.45, X) * smooth01(W * 0.62, W * 0.5, X));
      city(pix, x, {
        x0: x,
        x1: x + w,
        ground: g.far2G,
        minH: 24 * u,
        maxH: H * 0.5,
        minW: 9 * u,
        maxW: 30 * u,
        row: R("mid"),
        wins,
        seed: 33,
        shade: 0.28,
        gap: 5 * u,
        lit: 0.12,
        gx: 2,
        gy: 3,
        fog,
        env,
        tip: R("nav"),
        u,
        blocky: 0.5,
      });
      rimToward(pix, openX - x, 0.14, 0.16, 0.05);
      L.push({ kind: "pix", name: "city-far2", depth: d, pix, x, y: 0, twinkle: 0.35, dither: 0.3 });
    }
    // flying traffic: tiny lights crossing between the far towers
    L.push({
      kind: "points",
      name: "traffic",
      depth: D.drones,
      fog: 0.3,
      system: new Motes(
        {
          region: [-W * 0.3, H * 0.18, W * 1.3, H * 0.5],
          count: Math.round(26 * u),
          row: R("win3"),
          shade: [0.7, 0.99],
          vel: [-7 * u, 0],
          wander: 1.2,
          size: 1,
          twinkle: 0.15,
        },
        ctx.rng,
      ),
    });
    // the ceiling: hanging masses, pipes, lamps, cables
    {
      const d = D.ceiling;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      ceiling(pix, x, { x0: x, x1: x + w, u, H, row: R("mid"), lamp: R("win"), seed: 41, fog: (_x, y) => 0.15 * smooth01(0, H * 0.3, y) });
      L.push({ kind: "pix", name: "ceiling", depth: d, pix, x, y: 0, twinkle: 0.3 });
    }
    // falling specks off the ceiling
    L.push({
      kind: "points",
      name: "ceiling-dust",
      depth: D.ceiling,
      fog: 0.25,
      system: new Falling({ source: [0, H * 0.06, W, H * 0.12], floor: H * 0.8, every: 5, speed: 5 * u, drift: 0.4, row: R("mid"), shade: 0.35, max: 6 }),
    });

    // --- mid: the hammerhead and its district -------------------------------
    let craneBase: [number, number] = [0, 0];
    let searchBase: [number, number][] = [];
    {
      const d = D.mid;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const fog: FogFn = (_x, y) => 0.45 * smooth01(g.midG - H * 0.3, g.midG + 4, y);
      const env = (X: number): number => (X > W * 0.3 && X < W * 0.56 ? 0.25 : X > W * 0.52 && X < W * 0.86 ? 0 : 1);
      city(pix, x, {
        x0: x,
        x1: x + w,
        ground: g.midG,
        minH: 30 * u,
        maxH: H * 0.55,
        minW: 14 * u,
        maxW: 40 * u,
        row: R("mid"),
        wins,
        seed: 51,
        shade: 0.2,
        gap: 6 * u,
        lit: 0.13,
        gx: 2,
        gy: 3,
        fog,
        env,
        tip: R("nav"),
        u,
        blocky: 0.55,
      });
      const hh = hammerhead(pix, x, { cx: g.hammerX, ground: g.midG, top: g.hammerTop, u, row: R("mid"), wins, tip: R("nav"), seed: 57, fog });
      craneBase = hh.craneBase;
      searchBase = hh.searchBase;
      rimToward(pix, openX - x, 0.16, 0.18, 0.06);
      L.push({ kind: "pix", name: "mid-city", depth: d, pix, x, y: 0, twinkle: 0.35, dither: 0.3 });
    }
    // a crane on the hammerhead's roof
    const roofCrane: Crane = {
      x: craneBase[0],
      y: craneBase[1],
      mastH: 34 * u,
      mastW: 4,
      boom: 70 * u,
      elev: 0.42,
      dir: 1,
      phase: 1.3,
      jib: 20 * u,
      cable: 18 * u,
      slew: 0.5,
      period: 48,
      bw: 2.5,
      apex: 12 * u,
      lw: 3,
      lh: 4,
    };
    L.push({
      kind: "glsl",
      name: "roof-crane",
      depth: D.mid,
      body: craneBody([roofCrane], "crane", "nav", "win"),
      bounds: { y0: roofCrane.y - roofCrane.mastH - roofCrane.boom - 20 * u, y1: roofCrane.y + 2, x0: roofCrane.x - 110 * u, x1: roofCrane.x + 110 * u },
    });
    // searchlights sweeping up from the hammerhead's base
    L.push({
      kind: "glsl",
      name: "search",
      depth: D.mid,
      blend: "add",
      body: searchBody(g, [
        [searchBase[1]![0], searchBase[1]![1], -1.72, 0],
        [W * 0.86, g.midG - 22 * u, -1.9, 2.1],
        // a third from the low district between the figure and the hammerhead, leaning right
        [W * 0.555, g.midG - 12 * u, -1.46, 4.3],
      ]),
      bounds: { y0: 0, y1: g.midG },
    });
    // small signs on the mid district
    {
      const signs: Sign[] = [
        {
          x: Math.round(g.hammerX - 44 * u),
          y: Math.round(g.hammerTop + 30 * u),
          w: Math.round(5 * u),
          h: Math.round(22 * u),
          row: "signr",
          period: 13,
          offset: 5,
          vertical: true,
        },
        { x: Math.round(W * 0.2), y: Math.round(H * 0.6), w: Math.round(18 * u), h: Math.round(5 * u), row: "signa", period: 7.3, offset: 1, vertical: false },
        { x: Math.round(W * 0.9), y: Math.round(H * 0.55), w: Math.round(5 * u), h: Math.round(17 * u), row: "signc", period: 17, offset: 9, vertical: true },
      ];
      L.push({ kind: "glsl", name: "mid-signs", depth: D.mid, body: signBody(g, signs), bounds: { y0: H * 0.3, y1: H * 0.8 } });
    }
    L.push(
      mist({
        name: "haze-mid",
        depth: 7.5,
        y0: H * 0.6,
        y1: H * 0.9,
        sx: 120 * u,
        sy: 14 * u,
        drift: 3,
        evolve: 0.05,
        cover: 0.42,
        warp: 1.8,
        octaves: 3,
        levels: 3,
        alpha: 0.42,
        row: "haze",
        tone: 0.12,
        tonePerLevel: 0.1,
        tint: 0.5,
        lightGain: 1.5,
      }),
    );

    // --- furnace pits, embers, low roofs, plumes ------------------------------
    L.push({ kind: "glsl", name: "furnaces", depth: D.pits, fog: 0.05, body: furnaceBody(g), bounds: { y0: H * 0.55, y1: H + 1 } });
    L.push({
      kind: "points",
      name: "embers-far",
      depth: D.pits,
      fog: 0.1,
      blend: "add",
      system: new Embers({ region: [-W * 0.1, H * 0.78, W * 1.1, H * 0.9], rate: 9, rise: 11 * u, life: [3, 7], row: R("ember"), wind: 2, max: 70 }),
    });
    let chimneys: [number, number][] = [];
    {
      const d = D.low;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const a = lowRoofs(pix, x, { x0: x, x1: W * 0.24, ground: g.lowG, minTop: H * 0.74, maxTop: H * 0.86, u, row: R("near"), wins: winsNear, seed: 61 });
      const b = lowRoofs(pix, x, { x0: W * 0.58, x1: x + w, ground: g.lowG, minTop: H * 0.72, maxTop: H * 0.84, u, row: R("near"), wins: winsNear, seed: 62 });
      chimneys = [...a, ...b];
      rimToward(pix, openX - x, 0.1, 0.16);
      L.push({ kind: "pix", name: "low-roofs", depth: d, pix, x, y: 0, twinkle: 0.3, dither: 0.3 });
    }
    {
      // steam from a few of the chimneys, plus two big vents in the gap behind the figure
      const picks = chimneys.filter((_c, i) => i % 2 === 0).slice(0, 3);
      const plumes: [number, number, number, number][] = picks.map(([cx, cy], i) => [cx, cy, H * (0.28 + (i % 3) * 0.08), (18 + (i % 2) * 10) * u]);
      plumes.push([W * 0.34, H * 0.84, H * 0.5, 40 * u]);
      plumes.push([W * 0.52, H * 0.86, H * 0.42, 30 * u]);
      const top = Math.min(...plumes.map(([, y, h]) => y - h)) - 2;
      const bot = Math.max(...plumes.map(([, y]) => y)) + 4;
      const xl = Math.min(...plumes.map(([x, , , w]) => x - w * 1.4)) - 10;
      const xr = Math.max(...plumes.map(([x, , h, w]) => x + w * 1.4 + h * 0.4)) + 10;
      L.push({ kind: "glsl", name: "plumes", depth: D.low, body: plumeBody(g, plumes), bounds: { y0: top, y1: bot, x0: xl, x1: xr } });
    }

    // --- the ship, its headlights and cone ------------------------------------
    L.push({ kind: "glsl", name: "ship", depth: D.ship, body: shipBody(sp), bounds: { y0: g.shipY - 4, y1: g.shipY + sp.h + 4 } });
    L.push({
      kind: "glsl",
      name: "ship-light",
      depth: D.ship,
      blend: "add",
      fog: 0,
      body: shipLightBody(sp),
      bounds: { y0: g.shipY - 12, y1: g.shipY + sp.h + 120 * u },
    });

    // --- cranes behind the foundry block ---------------------------------------
    {
      const cr: Crane[] = [
        {
          x: W * 0.13,
          y: H * 0.72,
          mastH: H * 0.44,
          mastW: 6,
          boom: 150 * u,
          elev: 0.5,
          dir: 1,
          phase: 0,
          jib: 40 * u,
          cable: 40 * u,
          slew: 0.45,
          period: 60,
          bw: 4,
          apex: 24 * u,
          lw: 6,
          lh: 7,
        },
        {
          x: W * 0.27,
          y: H * 0.8,
          mastH: H * 0.26,
          mastW: 5,
          boom: 110 * u,
          elev: 0.28,
          dir: 1,
          phase: 2.2,
          jib: 30 * u,
          cable: 50 * u,
          slew: 0.6,
          period: 44,
          bw: 3,
          apex: 16 * u,
          lw: 5,
          lh: 6,
        },
      ];
      L.push({
        kind: "glsl",
        name: "cranes",
        depth: D.cranes,
        body: craneBody(cr, "crane", "nav", "win"),
        bounds: { y0: H * 0.02, y1: H * 0.82, x0: -W * 0.2, x1: W * 0.75 },
      });
    }

    // --- near: the foundry block, its sign, the bridge -------------------------
    const tiers: [number, number][] = [
      [W * 0.3, H * 0.66],
      [W * 0.22, H * 0.49],
      [W * 0.12, H * 0.33],
    ];
    {
      const d = D.near;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      ziggurat(pix, x, { x0: x, tiers, ground: H + 2, u, row: R("near"), wins: winsNear, door: R("win2"), seed: 71 });
      rimToward(pix, openX - x, 0.12, 0.1);
      L.push({ kind: "pix", name: "foundry", depth: d, pix, x, y: 0, twinkle: 0.25, dither: 0.2 });
    }
    L.push({ kind: "glsl", name: "near-sign", depth: D.near, body: signBody(g, [sign0]), bounds: { y0: sign0.y - 8 * u, y1: sign0.y + sign0.h + 8 * u } });
    let pylonLamp: [number, number] = [0, 0];
    {
      const d = D.bridge;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      pylonLamp = bridge(pix, x, { x0: W * 0.66, x1: x + w, y: Math.round(H * 0.62), H, u, row: R("near"), lamp: R("lamp"), seed: 81 });
      rimToward(pix, openX - x, 0.1, 0.08);
      L.push({ kind: "pix", name: "bridge", depth: d, pix, x, y: 0, dither: 0.2 });
    }
    L.push(glow({ name: "pylon-glow", depth: D.bridge, x: pylonLamp[0], y: pylonLamp[1], r: 10 * u, row: "nav", flicker: 0.4, alpha: 0.5 }));

    // near smoke and embers drifting in front of everything but the gantry: rising
    // billows broken into columns, thinned where they pass over the foundry block
    L.push({
      kind: "glsl",
      name: "smoke-near",
      depth: D.nearMist,
      body: smokeBody(g, {
        y0: H * 0.52,
        y1: H + 2,
        drift: 7,
        cover: 0.3,
        alpha: 0.42,
        over: 0.35,
        tiers: tiers.map(([xr, top]) => [xr + 2 * u, top - 10 * u] as [number, number]),
      }),
      bounds: { y0: H * 0.52, y1: H + 2 },
    });
    L.push({
      kind: "points",
      name: "embers-near",
      depth: D.nearMist,
      fog: 0,
      blend: "add",
      system: new Embers({ region: [W * 0.2, H * 0.85, W * 0.8, H], rate: 1.6, rise: 18 * u, life: [3, 6], row: R("ember"), wind: 4, max: 14 }),
    });
    // accents, rare and never bunched (about 10 a minute, at least 0.6 s apart):
    // welding arcs in the district, a furnace flare now and then
    const spacing = new FlashSpacing(0.6);
    L.push({
      kind: "points",
      name: "welds",
      depth: D.mid,
      fog: 0.1,
      blend: "add",
      system: new SpacedFlashes(
        [
          {
            kind: "glint",
            rate: 4.5,
            at: (rng) => [Math.round(W * (0.05 + rng() * 0.9)), Math.round(H * (0.42 + rng() * 0.36))],
            size: [3, 7],
            row: R("spark"),
            shade: 0.99,
            duration: [0.2, 0.45],
            light: { radius: 16 * u, colour: "#ffe0a0", strength: 0.4 },
          },
          {
            kind: "glint",
            rate: 2.5,
            at: (rng) => [Math.round(g.hammerX + (rng() - 0.5) * 120 * u), Math.round(g.hammerTop + rng() * 90 * u)],
            size: [3, 5],
            row: R("head"),
            shade: 0.99,
            duration: [0.2, 0.4],
          },
        ],
        spacing,
      ),
    });
    L.push({
      kind: "points",
      name: "flares",
      depth: D.pits,
      fog: 0.05,
      blend: "add",
      system: new SpacedFlashes(
        [
          {
            kind: "glow",
            rate: 3,
            at: (rng) => {
              const p = g.pits[Math.floor(rng() * g.pits.length)]!;
              return [Math.round(p[0] + (rng() - 0.5) * 30 * u), Math.round(p[1] - 6 * u)];
            },
            size: [11, 17],
            row: R("fire"),
            shade: 0.85,
            duration: [0.8, 1.5],
            intensity: 0.8,
            light: { radius: 70 * u, colour: "#ff9a40", strength: 0.35 },
          },
        ],
        spacing,
      ),
    });

    // --- the gantry, the figure, the frame ---------------------------------------
    {
      const d = D.overhang;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const [hx, hy] = overhang(pix, x, { W, H, u, row: R("near") });
      // a hanging chain with a hook, off the overhang's beam
      for (let y = hy; y < hy + H * 0.2; y++) pix.set(Math.round(hx - x) + ((y & 1) === 0 ? 0 : 1), y, 0.22, R("near"));
      const hy2 = Math.round(hy + H * 0.2);
      for (let k = 0; k < 6; k++) pix.set(Math.round(hx - x) + (k < 3 ? 0 : k - 2), hy2 + Math.min(k, 3), 0.28, R("near"));
      L.push({ kind: "pix", name: "overhang", depth: d, pix, x, y: 0, dither: 0 });
    }
    {
      const { x, w } = wide(1);
      const pix = new Pix(w, H);
      deck(pix, x, { x0: x, end: g.deckEnd, deck: g.deck, H, row: R("near"), lamp: R("lamp"), lampAt: g.lamp });
      L.push({ kind: "pix", name: "gantry", depth: 1, pix, x, y: 0, dither: 0 });
    }
    L.push(glow({ name: "lamp-glow", depth: 1, x: g.lamp[0] + 1, y: g.lamp[1] + 5, r: 22 * u, row: "lamp", flicker: 0.2, alpha: 0.45 }));
    L.push({ kind: "character", name: "figure", depth: 1, x: g.figX, ground: g.deck, rimDir: [1, -1] });
    {
      const d = D.fg;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      foreground(pix, x, { W, H, u, row: R("near") });
      L.push({ kind: "pix", name: "foreground", depth: d, pix, x, y: 0, dither: 0 });
    }
    return L;
  },
};

export default scene;

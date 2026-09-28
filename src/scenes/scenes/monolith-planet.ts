// monolith-planet (ref w02): a huge pale moon fills the sky; a black angular
// megastructure leans diagonally up across it, cropped by the frame, a few of
// its windows lit. Cloud banks slide past its base, blue light rises out of the
// clouds below it, small ships drift across the moon, and now and then a soft
// pulse of light runs up its conduits. One small figure on a ledge in front.
// Everything is generated here at runtime; see monolith-planet/ for the parts.

import {
  f,
  v2,
  Embers,
  FlashAccents,
  Flock,
  Motes,
  Pix,
  fogBand,
  glow,
  megastructure,
  mist,
  rangeProfile,
  sky,
  smooth,
  terrain,
  fbm1,
  hashInt,
  type LayerDef,
  type SceneDef,
} from "../engine/index.ts";
import { geo, local, STRUCT_DEPTH, UPLIGHT_DEPTH, type Geo } from "./monolith-planet/geo.ts";
import { buildMonolith, type MonoOut } from "./monolith-planet/monolith.ts";
import { planetBody } from "./monolith-planet/planet.ts";
import { Ships } from "./monolith-planet/ships.ts";
import { billows } from "./monolith-planet/clouds.ts";

// --- the pulse that runs up the conduits ------------------------------------------
// The monolith Pix is built in build(), but the prelude (compiled first) needs to
// know where the conduits are visible; both come from the same geometry, and the
// visible ranges are cached per mode by build.
const cache: Record<string, { mono: MonoOut; x0: number; pix: Pix }> = {};

function monoFor(g: Geo, key: string, rows: Parameters<typeof buildMonolith>[3], panWidth: number): { mono: MonoOut; x0: number; pix: Pix } {
  const hit = cache[key];
  if (hit) return hit;
  const w = panWidth + 8;
  const x0 = -Math.ceil((w - g.W) / 2);
  const pix = new Pix(w, g.H);
  const mono = buildMonolith(pix, g, x0, rows);
  const out = { mono, x0, pix };
  cache[key] = out;
  return out;
}

function pulseGlsl(g: Geo, m: MonoOut): string {
  const s = g.stem;
  const b = g.blade;
  const aBot = (g.H + 2 - s.o[1]) / s.d[1]; // stem a at the screen bottom
  const stemLen = Math.max(0, m.stemConduitMax - aBot);
  const bladeLen = m.bladeConduitMax - m.bladeConduitMin;
  const lnS = Math.max(Math.abs(s.n[0]), Math.abs(s.n[1]));
  const lnB = Math.max(Math.abs(b.n[0]), Math.abs(b.n[1]));
  return /* glsl */ `
const vec2 S_O = ${v2(s.o[0], s.o[1])};
const vec2 S_D = ${v2(s.d[0], s.d[1])};
const vec2 S_N = ${v2(s.n[0], s.n[1])};
const vec2 B_O = ${v2(b.o[0], b.o[1])};
const vec2 B_D = ${v2(b.d[0], b.d[1])};
const vec2 B_N = ${v2(b.n[0], b.n[1])};
const float S_ABOT = ${f(aBot)};
const float S_LEN = ${f(stemLen)};
const float B_AMIN = ${f(m.bladeConduitMin)};
const float P_TOTAL = ${f(stemLen + bladeLen)};
const float P_TAIL = ${f(70 * g.u)};
// head of the pulse along the conduit path (px), or -1e4 while idle
float pulseU() {
  float per = mix(14.0, 24.0, uReduced);
  float trav = mix(8.5, 14.0, uReduced);
  float ph = mod(uTime + 3.0, per);
  return ph < trav ? ph / trav * (P_TOTAL + P_TAIL) : -1e4;
}
// path position (px) of a layer point on a conduit, or -1
float conduitU(vec2 c) {
  vec2 r = c - B_O;
  float a = dot(r, B_D);
  float b = dot(r, B_N);
  if (a >= B_AMIN && (${g.bladeConduits.map((cb) => `abs(b - ${f(cb + 0.5)}) < ${f(1.0 * lnB)}`).join(" || ")})) return S_LEN + a - B_AMIN;
  r = c - S_O;
  a = dot(r, S_D);
  b = dot(r, S_N);
  if (a >= S_ABOT && a <= S_ABOT + S_LEN && (${g.stemConduits.map((cb) => `abs(b - ${f(cb + 0.5)}) < ${f(1.0 * lnS)}`).join(" || ")})) return a - S_ABOT;
  return -1.0;
}
vec2 pathPoint(float U) {
  return U < S_LEN ? S_O + S_D * (S_ABOT + U) : B_O + B_D * (B_AMIN + U - S_LEN);
}`;
}

// --- the scene -------------------------------------------------------------------

const scene: SceneDef = {
  title: "monolith-planet",
  palette: {
    planet: ["#394552", "#4d5a67", "#687682", "#8b98a2", "#afbac2", "#d0d9de", "#edf2f5"],
    rim: ["#1d4f86", "#3a82c0", "#86c4ec", "#d8f2ff"],
    stars: ["#56687c", "#8fa4b8", "#dde8f2"],
    mono: ["#040609", "#090d13", "#10161e", "#19212b", "#27323e", "#465665", "#8ea3b4"],
    under: ["#04070b", "#08101a", "#0c1a2b", "#112a44", "#1a4265", "#2c6a99", "#6db4e4"],
    win: ["#3c7fc0", "#9dd3ff", "#e9f8ff"],
    windim: ["#244a73", "#3f78ae", "#6ea9d8"],
    warm: ["#6a2a14", "#c25a2a", "#ffac6a"],
    glowb: ["#123a66", "#2a6eaa", "#5fa9e0", "#b4e2ff", "#effbff"],
    cloud: ["#131e2b", "#1d2d3f", "#2c4358", "#43627d", "#6789a6", "#98bad3", "#cde5f4"],
    far: ["#1c2632", "#243140", "#2e3d4d", "#3b4b5b"],
    rock: ["#05070a", "#0a0e13", "#11171e", "#1b242d", "#2c3945", "#50657a"],
    ship: ["#0b1017", "#18212b", "#2a3643"],
    nav: ["#6a2a14", "#ff9a62"],
    bird: ["#0e141b", "#1a232d"],
    standin: ["#05070a", "#0c1117", "#223040", "#a3c6de"],
  },
  fog: {
    stops: [
      [0.0, "#0a1018"],
      [0.25, "#121c28"],
      [0.5, "#1f2f3f"],
      [0.64, "#34495c"],
      [0.73, "#56728a"],
      [0.8, "#4a667e"],
      [1.0, "#1c2a38"],
    ],
    bands: 22,
    density: 0.05,
    max: 0.85,
    glow: { x: 0.38, y: 0.92, r: 0.7, colour: "#2f86d8", strength: 0.55, steps: 7 },
  },
  span: (W) => Math.round(W * 0.45),
  driftPeriod: 100,

  prelude: (ctx) => {
    const g = geo(ctx);
    const { mono } = monoFor(g, ctx.mode, { mono: ctx.row("mono"), under: ctx.row("under"), win: ctx.row("win"), windim: ctx.row("windim"), warm: ctx.row("warm") }, ctx.panWidth(STRUCT_DEPTH));
    return /* glsl */ `
${pulseGlsl(g, mono)}
const vec2 BASE = ${v2(g.base[0], g.base[1])};
// the blue light rising out of the clouds under the monolith; breathes slowly
float uplight(vec2 s) {
  vec2 b = vec2(BASE.x - layerOff(${f(UPLIGHT_DEPTH)}), BASE.y);
  float dx = (s.x - b.x) / (uRes.x * 0.3);
  float h = (b.y + uRes.y * 0.12 - s.y) / (uRes.y * 0.8);
  float g = exp(-dx * dx * (1.0 + 2.0 * max(h, 0.0))) * (1.0 - smoothstep(0.0, 1.0, h));
  float br = 0.85 + 0.15 * floor((0.5 + 0.5 * sin(uTime * 0.29 * (1.0 - 0.6 * uReduced))) * 4.0) / 4.0;
  return g * br;
}
float sceneLight(vec2 s, float depth) {
  float l = 0.0;
  if (depth > 2.5 && depth < 40.0) l += uplight(s) * 0.42;
  if (depth > 9.0 && depth < 20.0) {
    float U = pulseU();
    if (U > -1e3 && U < P_TOTAL) {
      vec2 hp = pathPoint(U) - vec2(layerOff(${f(STRUCT_DEPTH)}), 0.0);
      float dd = length(s - hp) / ${f(46 * ctx.u)};
      float fade = smoothstep(0.0, 40.0, U) * (1.0 - smoothstep(P_TOTAL - 60.0, P_TOTAL, U));
      l += 0.24 * floor(max(0.0, 1.0 - dd) * 3.0) / 3.0 * fade * (1.0 - 0.4 * uReduced);
    }
  }
  return l;
}`;
  },

  build: (ctx) => {
    const g = geo(ctx);
    const { W, H, u, hor } = g;
    const L: LayerDef[] = [];
    const R = (n: string): number => ctx.row(n);
    const wide = (d: number): { x: number; w: number } => {
      const w = ctx.panWidth(d) + 8;
      return { x: -Math.ceil((w - W) / 2), w };
    };

    // sky, stars, the planet
    L.push(sky({ stars: { density: 0.0022, row: "stars", below: H * 0.7 } }));
    L.push({
      kind: "glsl",
      name: "planet",
      depth: Infinity,
      fog: 0.1,
      dither: 0.5,
      body: planetBody({ ...g.planet, halo: 0.11 }),
      bounds: { y0: -1e6, y1: g.planet.y + g.planet.r * 1.12 },
    });

    // thin high streaks across the planet's lower face
    L.push(
      mist({
        name: "high-streaks",
        depth: 90,
        y0: H * 0.3,
        y1: H * 0.66,
        sx: 300 * u,
        sy: 7 * u,
        drift: -3,
        evolve: 0.03,
        cover: 0.32,
        warp: 1.6,
        levels: 3,
        alpha: 0.45,
        row: "cloud",
        tone: 0.55,
        tonePerLevel: 0.1,
        tint: 0.45,
        lightGain: 0.3,
      }),
    );

    // a capital ship, very slow and far, and small groups crossing the planet
    L.push({
      kind: "points",
      name: "capital-ship",
      depth: 60,
      fog: 0.3,
      system: new Ships({ y: [H * 0.14, H * 0.2], x: [-60, W + 60], every: 140, group: [1, 1], speed: [2.2, 2.6], row: R("ship"), lightRow: R("win"), capital: true, startAt: 0.72 }),
    });
    L.push({
      kind: "points",
      name: "ships-far",
      depth: 35,
      fog: 0.25,
      system: new Ships({ y: [H * 0.22, H * 0.5], x: [-40, W + 40], every: 26, group: [2, 4], speed: [7, 11], row: R("ship"), lightRow: R("nav"), startAt: 0.3 }),
    });

    // distant ruins standing out of the cloud sea
    {
      const d = 28;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const fog = (_px: number, py: number): number => 0.5 * smooth(hor - H * 0.2, hor + 4, py);
      const towers: [number, number, number, number, number][] = [
        [0.66, 0.2, 0.028, 0.18, 3],
        [0.8, 0.28, 0.034, 0.1, 4],
        [0.93, 0.15, 0.022, -0.05, 5],
        [1.08, 0.24, 0.03, 0.22, 6],
        [0.06, 0.17, 0.026, -0.12, 7],
        [-0.08, 0.22, 0.03, 0.08, 8],
      ];
      for (const [cx, hh, ww, lean, seed] of towers)
        megastructure(pix, { row: R("far"), lightRow: R("windim"), cx: cx * W - x, ground: hor + 6, height: hh * H, width: ww * W, lean, seed, tiers: 4, windows: 0.012, fog });
      L.push({ kind: "pix", name: "far-ruins", depth: d, pix, x, y: 0, dither: 0.3, twinkle: 0.4 });
    }

    // the cloud sea: a bank on the horizon and a floor of cloud below it
    L.push(
      fogBand({
        name: "horizon-bank",
        depth: 24,
        y0: hor - H * 0.07,
        y1: hor + H * 0.06,
        sx: 160 * u,
        sy: 8 * u,
        drift: -2,
        cover: 0.72,
        alpha: 0.8,
        row: "cloud",
        tone: 0.45,
        tint: 0.4,
        lightGain: 1.3,
      }),
    );
    L.push({
      kind: "points",
      name: "cloud-lightning",
      depth: 22,
      fog: 0.2,
      blend: "add",
      system: new FlashAccents([
        {
          kind: "glow",
          rate: 2.5,
          at: (rng) => [Math.round(W * (0.55 + rng() * 0.5)), Math.round(hor + H * (0.02 + rng() * 0.08))],
          size: [9, 15],
          row: R("glowb"),
          shade: 0.75,
          duration: [0.35, 0.7],
          intensity: 0.5,
          light: { radius: 70 * u, colour: "#9fd4ff", strength: 0.45 },
        },
      ]),
    });
    L.push(
      mist({
        name: "cloud-floor",
        depth: 18,
        y0: hor - H * 0.02,
        y1: H + 4,
        softTop: H * 0.05,
        softBottom: 1,
        sx: 150 * u,
        sy: 14 * u,
        drift: -3,
        evolve: 0.03,
        cover: 0.85,
        warp: 1.3,
        levels: 4,
        alpha: 0.92,
        row: "cloud",
        tone: 0.3,
        tonePerLevel: 0.11,
        tint: 0.6,
        lightGain: 1.6,
      }),
    );

    L.push(billows({ name: "far-billows", depth: 20, base: hor + H * 0.05, wander: 4 * u, cell: 15 * u, radius: 9 * u, bottom: H * 0.86, drift: -2, row: "cloud", tone: 0.26, range: 0.55, tint: 0.55, lightGain: 1.6, seed: 5, crown: 0.7, glowRow: "glowb" }));

    // the light rising out of the clouds, behind the monolith
    L.push({
      kind: "glsl",
      name: "uplight",
      depth: UPLIGHT_DEPTH,
      fog: 0,
      blend: "add",
      bounds: { y0: H * 0.2, y1: H + 1 },
      body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float g = uplight(s);
  float tm = uTime * (1.0 - 0.6 * uReduced);
  // columns of light rising slowly
  float col = fbm(vec2(p.x / ${f(11 * u)}, (p.y + tm * ${f(7 * u)}) / ${f(46 * u)}), 3);
  g *= 0.45 + 0.9 * col;
  float lv = stepd(g * 1.15, 5.0, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  vec3 c = ramp(R_GLOWB, 0.2 + lv * 0.7, p, 0.0);
  return vec4(c, lv * 0.6);
}`,
    });

    // the monolith
    const { mono, x0, pix } = monoFor(g, ctx.mode, { mono: R("mono"), under: R("under"), win: R("win"), windim: R("windim"), warm: R("warm") }, ctx.panWidth(STRUCT_DEPTH));
    L.push({ kind: "pix", name: "monolith", depth: STRUCT_DEPTH, fog: 0.08, pix, x: x0, y: 0, dither: 0.25, twinkle: 0.7 });
    L.push({
      kind: "glsl",
      name: "conduit-pulse",
      depth: STRUCT_DEPTH,
      fog: 0,
      blend: "add",
      body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float U = pulseU();
  if (U < -1e3) return vec4(0.0);
  float cu = conduitU(p + 0.5);
  if (cu < 0.0) return vec4(0.0);
  float x = U - cu;
  if (x < 0.0 || x > P_TAIL) return vec4(0.0);
  float v = 1.0 - x / P_TAIL;
  v = floor(v * v * 4.0 + bayer4(p) * 0.6) / 4.0;
  if (v <= 0.0) return vec4(0.0);
  vec3 c = ramp(R_GLOWB, 0.3 + 0.7 * v, p, 0.0);
  float ext = 0.42 * pow(smoothstep(${f(H * 0.55)}, ${f(H * 1.02)}, p.y), 1.3);
  return vec4(c, v * 0.95 * (1.0 - ext) * (1.0 - 0.35 * uReduced));
}`,
    });
    L.push({
      kind: "points",
      name: "monolith-accents",
      depth: STRUCT_DEPTH,
      fog: 0.05,
      blend: "add",
      system: new FlashAccents([
        {
          kind: "glow",
          rate: 5,
          at: (rng) => mono.surface[Math.floor(rng() * mono.surface.length)]!,
          size: [5, 7],
          row: R("glowb"),
          shade: 0.8,
          duration: [0.8, 1.4],
          intensity: 0.75,
          light: { radius: 22 * u, colour: "#7cc2f2", strength: 0.35 },
        },
        {
          kind: "glint",
          rate: 4,
          at: (rng) => {
            const w = mono.windows[Math.floor(rng() * mono.windows.length)]!;
            return [Math.floor(w[0]), Math.floor(w[1])];
          },
          size: [5, 7],
          row: R("win"),
          shade: 0.99,
          duration: [0.3, 0.6],
        },
      ]),
    });

    // blue motes rising out of the clouds past the monolith's foot
    L.push({
      kind: "points",
      name: "rising-motes",
      depth: 12,
      fog: 0.1,
      blend: "add",
      system: new Embers({ region: [W * 0.22, H * 0.78, W * 0.62, H * 0.95], rate: 5, rise: 9 * u, life: [5, 9], row: R("glowb"), wind: -1.5, max: 50 }),
    });

    // cloud banks sliding past its base
    L.push(billows({ name: "base-clouds", depth: 11, base: H * 0.74, wander: 6 * u, cell: 24 * u, radius: 17 * u, bottom: H * 0.93, drift: -4, row: "cloud", tone: 0.22, range: 0.62, tint: 0.7, lightGain: 1.4, seed: 3, crown: 0.7, glowRow: "glowb" }));

    // birds, far below and to the right
    L.push({
      kind: "points",
      name: "birds",
      depth: 7,
      system: new Flock({ y: [H * 0.5, H * 0.64], x: [-40, W + 40], every: 34, speed: 15 * u, count: [3, 6], row: R("bird"), shade: 0.3 }),
    });

    L.push(billows({ name: "near-bank", depth: 6, base: H * 0.93, wander: 10 * u, cell: 40 * u, radius: 26 * u, bottom: H + 4, drift: -7, row: "cloud", tone: 0.1, range: 0.5, tint: 0.85, lightGain: 1.0, seed: 8, crown: 0.6 }));

    // mid-left: a dark ridge with the stumps of pylons, veiled by mist
    {
      const d = 4.2;
      const { x, w } = wide(d);
      const p = new Pix(w, H);
      const base = H + 2;
      const ridge = rangeProfile({ base: H * 0.93, amp: H * 0.15, scale: 70 * u, seed: 81, sharp: 0.55, detail: 3 * u });
      const top = (X: number): number => {
        const m = smooth(W * 0.34, W * 0.12, X);
        return m <= 0.02 ? 1e9 : base - (base - ridge(X)) * m;
      };
      terrain(p, { row: R("rock"), top: (px) => top(px + x), seed: 82, scale: 18 * u, chunk: 2, light: [-0.8, -1], base: 0.3, contrast: 0.5, vertical: 0.6, rim: 0.28, rimDepth: 3, ao: 0.15 });
      for (const [px, hh] of [
        [0.05, 0.2],
        [0.14, 0.13],
        [0.22, 0.07],
      ] as const) {
        const X = Math.round(px * W - x);
        const t0 = Math.round(top(px * W) - hh * H);
        for (let y = t0; y < top(px * W) + 2; y++)
          for (let k = 0; k < Math.round(3 * u); k++) p.set(X + k, y, k === 0 ? 0.42 : 0.2, R("rock"));
        p.rect(X - Math.round(2 * u), t0, Math.round(7 * u), Math.round(2 * u), { row: R("rock"), shade: 0.3 });
      }
      L.push({ kind: "pix", name: "mid-ridge", depth: d, pix: p, x, y: 0, dither: 0.3 });
    }

    L.push(
      mist({
        name: "low-mist",
        depth: 3,
        y0: H * 0.78,
        y1: H + 6,
        softBottom: 4,
        sx: 90 * u,
        sy: 7 * u,
        drift: 7,
        evolve: 0.05,
        cover: 0.36,
        warp: 1.8,
        levels: 3,
        alpha: 0.6,
        row: "cloud",
        tone: 0.3,
        tonePerLevel: 0.14,
        tint: 0.55,
        lightGain: 0.9,
      }),
    );

    // the ledge the figure stands on
    {
      const { x, w } = wide(1);
      const p = new Pix(w, H);
      buildLedge(p, g, x, R("rock"), R("under"));
      L.push({ kind: "pix", name: "ledge", depth: 1, pix: p, x, y: 0, dither: 0 });
    }
    const beacon: [number, number] = [Math.round(W * 0.6) + 3, g.deckY - Math.round(22 * u)];
    L.push(glow({ name: "beacon-glow", depth: 1, x: beacon[0], y: beacon[1], r: 14 * u, row: "glowb", flicker: 0.25, alpha: 0.45 }));
    L.push({ kind: "character", name: "figure", depth: 1, x: g.figX, ground: g.deckY, rimDir: [-1, -1], facing: -1 });
    L.push({
      kind: "points",
      name: "near-motes",
      depth: 1.4,
      fog: 0,
      system: new Motes({ region: [-W * 0.3, H * 0.2, W * 1.3, H], count: Math.round(26 * u), row: R("cloud"), shade: [0.5, 0.8], vel: [-2.5, -0.6], wander: 2, size: 1, twinkle: 0.4 }, ctx.rng),
    });

    // foreground: broken girders in the bottom-left corner
    {
      const d = 0.7;
      const { x, w } = wide(d);
      const p = new Pix(w, H);
      buildShards(p, g, x, R("rock"));
      L.push({ kind: "pix", name: "foreground", depth: d, pix: p, x, y: 0, dither: 0 });
    }
    return L;
  },
};

export default scene;

// --- near props ----------------------------------------------------------------------

/** A cantilevered ledge of dark metal from the right, broken at its left end. */
function buildLedge(p: Pix, g: Geo, x0: number, rock: number, under: number): void {
  const { W, H, u, deckY } = g;
  const X = (x: number): number => Math.round(x - x0);
  const left = W * 0.58;
  const th = Math.round(9 * u);
  for (let lx = Math.floor(left - 30); lx < W * 1.6; lx++) {
    // the broken end: a jagged, stepped edge
    const brk = left + (hashInt(Math.floor(lx), 1, 3) - 0.5) * 0 + fbm1(lx / 7, 11) * 0;
    for (let y = deckY; y < H; y++) {
      const edge = brk + Math.floor(fbm1((y - deckY) / (5 * u), 12, 3) * 4) * 4 * u - (y - deckY) * 0.35;
      if (lx < edge) continue;
      const dy = y - deckY;
      let s: number;
      let row = rock;
      if (dy === 0) s = 0.62;
      else if (dy === 1) s = 0.42;
      else if (dy < th) {
        s = 0.2 + (hashInt(Math.floor(lx / (13 * u)), 2, 5) - 0.5) * 0.06;
        if (Math.floor(lx) % Math.round(13 * u) === 0) s = 0.1;
        if (dy === th - 1) s = 0.3;
      } else {
        row = under;
        s = 0.1 + 0.14 * smooth(H, deckY + th, y);
        if ((Math.floor(lx / (5 * u)) & 3) === 0) s -= 0.04;
      }
      if (lx < edge + 1 && dy > 0) s += 0.18;
      p.set(X(lx), y, s, row);
    }
  }
  // bollards and the beacon post at the broken end
  for (const bx of [W * 0.66, W * 0.86, W * 1.02]) {
    const bw = Math.round(4 * u);
    p.rect(X(bx), deckY - Math.round(5 * u), bw, Math.round(5 * u), { row: rock, shade: 0.2 });
    p.rect(X(bx), deckY - Math.round(5 * u), bw, 1, { row: rock, shade: 0.5 });
  }
  const px = Math.round(W * 0.6);
  for (let y = deckY - Math.round(22 * u); y < deckY; y++) {
    p.set(X(px), y, 0.45, rock);
    p.set(X(px + 1), y, 0.18, rock);
  }
  p.rect(X(px + 1), deckY - Math.round(24 * u), 5, 3, { row: rock, shade: 0.25 });
  p.set(X(px + 3), deckY - Math.round(22 * u), 1, under, 0, true);
  p.set(X(px + 4), deckY - Math.round(22 * u), 1, under, 0, true);
  // cables hanging from the broken end
  for (const [cx, len] of [
    [left + 6, 16],
    [left + 14, 26],
    [left + 21, 11],
  ] as const) {
    for (let t = 0; t < len * u; t++) p.set(X(cx + Math.round(Math.sin(t * 0.12) * 1.5)), deckY + th + t, 0.16, rock);
  }
}

/** Dark broken girders filling the bottom-left corner: a heap of wreckage with a
 * jagged top, two long beams leaning out of it (one a truss), a lit upper-left rim. */
function buildShards(p: Pix, g: Geo, x0: number, rock: number): void {
  const { W, H, u } = g;
  const shade = (x: number, y: number): number => 0.07 + 0.05 * hashInt(Math.floor(x / (5 * u)), Math.floor(y / (3 * u)), 9);
  // the heap: a stepped, jagged profile that sinks off-screen by x = 0.2W
  for (let X = -0.6 * W; X < 0.24 * W; X++) {
    const k = smooth(0.2 * W, 0.02 * W, X);
    const n = fbm1(X / (22 * u), 31, 3);
    const step = Math.floor(fbm1(X / (9 * u), 32, 2) * 3) * 3 * u;
    const top = H * 1.02 - k * (H * 0.1 + n * H * 0.1 + step);
    for (let y = Math.max(0, Math.floor(top)); y < H; y++) p.set(Math.round(X - x0), y, shade(X, y), rock);
  }
  const holes: number[] = [];
  const beam = (ax: number, ay: number, bx: number, by: number, th: number, truss: boolean): void => {
    const A: [number, number] = [ax * W - x0, ay * H];
    const B: [number, number] = [bx * W - x0, by * H];
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const l = Math.hypot(dx, dy);
    const nx = (-dy / l) * th;
    const ny = (dx / l) * th;
    p.poly([A, B, [B[0] + nx, B[1] + ny], [A[0] + nx, A[1] + ny]], {
      row: rock,
      shade: (x, y) => {
        if (!truss) return 0.12;
        // lighter chords, dark holes between diagonal webs
        const t = ((x - A[0]) * dx + (y - A[1]) * dy) / l;
        const c = ((x - A[0]) * -dy + (y - A[1]) * dx) / l / th;
        if (c < 0.2 || c > 0.8) return 0.14;
        const w = Math.abs(((t / (th * 1.1) + c) % 2) - 1);
        if (w < 0.3) return 0.12;
        if (p.solid(x, y)) return p.shadeAt(x, y);
        holes.push(x, y);
        return 0;
      },
    });
  };
  beam(-0.5, 0.74, 0.1, 0.9, 7 * u, true);
  beam(-0.2, 0.66, 0.05, 0.97, 4 * u, false);
  // punch the truss holes out where nothing was behind them
  for (let i = 0; i < holes.length; i += 2) p.clear(holes[i]!, holes[i + 1]!);
  p.rim(-1, -1, 0.3, 0.07);
}

void local;

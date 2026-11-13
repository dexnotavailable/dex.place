// hollow-mouth (ref w04, from above), the backdrop of B5 Hollow Mouth (lane
// R-B): the door to the underworld. The plain has fallen into the structure
// below it: from the causeway's end you look down a shaft cut through soil
// and then through the floors of something built and huge, lying on its side.
// Overcast daylight falls in two stepped shafts from the rim; the amber glow
// of the foundry market rises from the bottom; cables and girders cross the
// void; dust sifts down, embers drift up. At the top, the spire stands close
// now on the east sky with its storm. The ride down on the crane's hook is
// the reveal: cold grey above, warm amber below.
//
// Vertical parallax is a pinhole (hollow-mouth/geo.ts): a feature at room row
// R and depth d sits at layer row EYE + (R - EYE) / d. Default export: the
// /scenes/ preview standing on the culvert platform; hollowMouth(true) is the
// world backdrop.

import { Embers, Falling, Pix, fbm, fbm1, hashInt, skyline, terrain, fogBand, f, rowRef, type LayerDef, type SceneDef } from "../engine/index.ts";
import { camYGlsl, spireGlsl } from "./causeway/shared.ts";
import { B5, REF, ROOM_H, geo, type Geo } from "./hollow-mouth/geo.ts";
import { arcade, eastArch, floorGlsl, stallRow, type Pool } from "./hollow-mouth/street.ts";

export const TITLE = "hollow-mouth";

/** The sky, the far interior of the shaft and its air, by room row (not screen row). */
function backGlsl(g: Geo, d: number): string {
  const rim = g.LY(g.RY(B5.plain) + 6, d);
  const bottom = g.LY(g.RY(B5.street), d);
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float rim = ${f(rim)} + floor((fbm(vec2(p.x / 60.0, 1.0), 3) - 0.5) * 18.0);
  if (p.y < rim) {
    // overcast sky over the plain, drifting cloud
    float t = clamp(p.y / max(1.0, rim), 0.0, 1.0);
    float n = fbm(vec2(p.x / 260.0 - tm * 0.004, p.y / 60.0), 4);
    vec3 c = ramp(${rowRef("sky")}, 0.35 + 0.45 * t + 0.25 * (n - 0.5), p, 0.6);
    return vec4(c, 1.0);
  }
  // the deep interior: near black up top, warming to amber toward the bottom
  float t = clamp((p.y - rim) / ${f(Math.max(1, bottom - rim))}, 0.0, 1.0);
  float n = fbm(vec2(p.x / 90.0, p.y / 50.0), 3);
  vec3 c = ramp(${rowRef("deep")}, 0.12 + 0.2 * t + 0.1 * (n - 0.5), p, 0.5);
  float warm = smoothstep(0.6, 1.0, t);
  // warm haze, not a wall: dim, dithered, brightest in a low band where the furnaces are
  float band = exp(-pow((p.y - ${f(bottom)} + 40.0) / 90.0, 2.0));
  if (warm > 0.0) c = mix(c, ramp(${rowRef("amber")}, 0.03 + 0.16 * warm + 0.12 * band + 0.1 * (n - 0.5), p, 0.9), stepd(warm * 0.8, 5.0, p, 0.9));
  return vec4(c, 1.0);
}`;
}

/** The far wall of the fallen structure: floors with broken edges, bays, columns, a few lit windows. */
function wallGlsl(g: Geo, d: number): string {
  const rim = g.LY(g.RY(B5.plain - 0.6), d);
  const bottom = g.LY(g.RY(B5.street + 1), d);
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float rim = ${f(rim)} + floor((fbm(vec2(p.x / 50.0, 3.0), 3) - 0.5) * 16.0);
  if (p.y < rim || p.y > ${f(bottom)}) return vec4(0.0);
  float t = clamp((p.y - rim) / ${f(Math.max(1, bottom - rim))}, 0.0, 1.0);
  // the collapse opens into the hollow at the bottom east: the market shows through
  float gapEdge = ${f(g.W * 0.35)} + (1.0 - smoothstep(0.62, 0.95, t)) * ${f(g.W)} + (fbm(vec2(p.y / 20.0, 7.0), 3) - 0.5) * 60.0;
  if (p.x > gapEdge) return vec4(0.0);
  // the structure lies tilted: its floors run on a slant, each floor its own height
  float fy = p.y - rim + (p.x - ${f(g.W / 2)}) * 0.09;
  float FL = 46.0;
  float fi = floor(fy / FL);
  FL = 38.0 + 22.0 * hash2(vec2(fi, 1.0));
  float inF = mod(fy, 46.0) * FL / 46.0;
  // each floor slab is broken off somewhere: a gap where it fell
  float gapC = hash2(vec2(fi, 3.0)) * uRes.x;
  float gapW = 40.0 + 120.0 * hash2(vec2(fi, 5.0));
  bool broken = abs(p.x - gapC) < gapW * (0.6 + 0.4 * fbm(vec2(p.y / 6.0, fi), 2));
  float colW = 70.0 + 30.0 * hash2(vec2(fi, 7.0));
  float inC = mod(p.x + fi * 23.0, colW);
  float shade;
  float a = 1.0;
  vec3 hole = ramp(${rowRef("deep")}, 0.06 + 0.1 * t, p, 0.3);
  if (inF < 6.0) {
    if (broken) return vec4(applyFog(hole, uFog, 0.0, p, s), 1.0);
    shade = inF < 1.0 ? 0.34 : 0.16;   // the slab, lit on its top
  } else if (inC < 7.0) {
    if (broken && hash2(vec2(fi, floor((p.x + fi * 23.0) / colW))) < 0.6) return vec4(applyFog(hole, uFog, 0.0, p, s), 1.0);
    shade = inC < 2.0 ? 0.22 : 0.11;    // a column
  } else {
    // the bay: dark, with panels, and now and then a lit window
    shade = 0.04 + 0.04 * step(0.5, fract((p.x + fi * 11.0) / 17.0)) * step(inF, FL - 12.0);
    vec2 cell = vec2(floor(p.x / 9.0), fi);
    if (hash2(cell) < 0.006 + 0.03 * t && inF > 18.0 && inF < 30.0 && mod(p.x, 9.0) < 4.0) {
      vec3 w = ramp(${rowRef("amber")}, 0.5 + 0.4 * hash2(cell + 1.0), p, 0.0);
      return vec4(applyFog(w, uFog * 0.6, 0.0, p, s), 1.0);
    }
    if (broken) return vec4(applyFog(hole, uFog, 0.0, p, s), 1.0);
  }
  if (a <= 0.0) return vec4(0.0);
  // light: cool daylight from the rim above, amber from the market below
  float cool = 1.0 - smoothstep(0.0, 0.45, t);
  float warm = smoothstep(0.5, 1.0, t);
  shade += sceneLight(s, uDepth) * 0.8;
  vec3 c = ramp(${rowRef("wall")}, shade + 0.1 * cool, p, 0.4);
  if (warm > 0.0) c = mix(c, ramp(${rowRef("amber")}, shade * 0.8 + 0.04, p, 0.4), stepd(warm * 0.5, 3.0, p, 0.6));
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`;
}

/** Two stepped shafts of overcast daylight falling from the rim, fading as they go down. */
function beamsGlsl(g: Geo, d: number): string {
  const top = g.LY(g.RY(B5.plain), d);
  const len = (g.RY(-26) - g.RY(B5.plain)) / d;
  return /* glsl */ `
float beamAt(vec2 p, float x0, float slope, float w0, float w1) {
  float t = (p.y - ${f(top)}) / ${f(len)};
  if (t < 0.0 || t > 1.0) return 0.0;
  float cx = x0 + slope * (p.y - ${f(top)});
  float w = mix(w0, w1, t);
  float e = abs(p.x - cx) / w;
  if (e > 1.0) return 0.0;
  float streak = 0.75 + 0.25 * sin(p.x * 0.21 + p.y * 0.02);
  return (1.0 - e * e) * (1.0 - t) * streak;
}
vec4 layer(vec2 p, vec2 s) {
  float b = beamAt(p, ${f(g.W * 0.4)}, 0.16, ${f(g.W * 0.05)}, ${f(g.W * 0.12)}) + 0.8 * beamAt(p, ${f(g.W * 0.66)}, 0.1, ${f(g.W * 0.035)}, ${f(g.W * 0.08)});
  float lv = stepd(clamp(b, 0.0, 1.0), 3.0, p, 0.6);
  if (lv <= 0.0) return vec4(0.0);
  vec3 c = ramp(${rowRef("beam")}, 0.4 + 0.4 * lv, p, 0.0);
  return vec4(c, 0.22 * lv);
}`;
}

/** Girders across the void and cables hanging from them (depth ~2). */
function girdersGlsl(g: Geo, d: number, rows: number[]): string {
  const beams = rows.map((wy, i) => ({ y: g.LY(g.RY(wy), d), x0: i % 2 ? g.W * 0.25 : -20, x1: i % 2 ? g.W + 20 : g.W * 0.7, tilt: (i % 3) - 1 }));
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float tm = floor(uTime * (1.0 - 0.6 * uReduced) * 12.0) / 12.0;
  float shade = -1.0;
  ${beams
    .map(
      (b, i) => `{
    float yc = ${f(b.y)} + (p.x - ${f(g.W / 2)}) * ${f(b.tilt * 0.04)};
    if (p.x > ${f(b.x0)} && p.x < ${f(b.x1)}) {
      float dy = p.y - yc;
      if (dy > -9.0 && dy < 9.0) {
        // an I-beam: flanges and a web with lightening holes
        float web = step(abs(dy), 5.0);
        float hole = step(length(vec2(mod(p.x, 28.0) - 14.0, dy) * vec2(1.0, 1.4)), 4.0);
        if (abs(dy) >= 7.0) shade = dy < 0.0 ? 0.5 : 0.25;
        else if (web > 0.5 && hole < 0.5) shade = 0.18;
      }
      // cables hanging from it, swaying a little
      float cx = floor((p.x + ${f(i * 37)}) / 90.0);
      float hx = cx * 90.0 - ${f(i * 37)} + 30.0 * hash2(vec2(cx, ${f(i)}));
      float len = 60.0 + 180.0 * hash2(vec2(cx, ${f(i + 9)}));
      float dyc = p.y - yc - 7.0;
      if (dyc > 0.0 && dyc < len && hash2(vec2(cx, ${f(i + 4)})) < 0.6) {
        float sw = floor(sin(tm * 0.8 + cx) * 2.0 * dyc / len + 0.5);
        if (abs(p.x - hx - sw) < 1.0) shade = max(shade, 0.14);
        if (dyc > len - 5.0 && abs(p.x - hx - sw) < 3.0) shade = max(shade, 0.3);
      }
    }
  }`,
    )
    .join("\n  ")}
  if (shade < 0.0) return vec4(0.0);
  float t = clamp((s.y + camY()) / ${f(ROOM_H)}, 0.0, 1.0);
  vec3 c = ramp(${rowRef("iron")}, shade + sceneLight(s, uDepth) * 0.6, p, 0.0);
  if (t > 0.6) c = mix(c, ramp(${rowRef("amber")}, shade * 0.8, p, 0.0), stepd((t - 0.6) * 1.6, 3.0, p, 0.6));
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`;
}

export function hollowMouth(inWorld: boolean): SceneDef {
  return {
    title: TITLE,
    palette: {
      sky: ["#4e5470", "#5f6682", "#727893", "#878ca4", "#a0a3b6", "#bab9c6"],
      deep: ["#060607", "#0b0a0d", "#121015", "#1a171d", "#252027"],
      wall: ["#101216", "#181b21", "#23272e", "#30353d", "#454a52", "#60646a"],
      amber: ["#2c150b", "#522810", "#834017", "#b8621f", "#e59033", "#ffc46e"],
      beam: ["#6a6b7c", "#9798aa", "#c7c7d5", "#ececf2"],
      iron: ["#0c0d10", "#15171b", "#20232a", "#2e3239", "#454a52"],
      stone: ["#141417", "#1f1f23", "#2c2b31", "#3c3b42", "#524f56", "#6f6a70"],
      concrete: ["#121315", "#1c1e21", "#282b2e", "#373a3e", "#4c5054", "#686b6e"],
      earth: ["#141114", "#1e191c", "#2a2326", "#3a3033", "#4d4043"],
      root: ["#18130f", "#251c16", "#35291f", "#4a3a2c"],
      moss: ["#1b1f1a", "#262c23", "#353d2e", "#48523b"],
      paving: ["#1a1614", "#26201c", "#342b25", "#463a31", "#5d4d40"],
      spire: ["#0c0d12", "#14151c", "#1d1f28"],
      storm: ["#262937", "#303443", "#3c4151", "#4a4f60"],
      red: ["#5a1c18", "#a8352a", "#e0604a"],
      dust: ["#5a5652", "#77716b", "#958d84"],
      ember: ["#7a3010", "#c0601c", "#ffb04a"],
      standin: ["#07070a", "#101015", "#24232c", "#c09a72"],
    },
    fog: {
      // the fog colour is only the fallback far away: the scene paints its own air by room row
      stops: [
        [0.0, "#2a2b33"],
        [0.5, "#1c1b20"],
        [1.0, "#2a1a12"],
      ],
      bands: 8,
      dither: 0.3,
      density: 0.08,
      max: 0.6,
    },
    span: () => 0,
    driftPeriod: 200,

    prelude: (ctx) => {
      void geo;
      return /* glsl */ `
${camYGlsl(inWorld, REF * ctx.world)}
// daylight from the rim above, amber from below: by the room row the pixel stands at (depth 1)
float sceneLight(vec2 s, float depth) {
  float R = s.y + camY() * (1.0 / max(depth, 1.0));
  float t = clamp(R / ${f(ROOM_H)}, 0.0, 1.0);
  return 0.08 * (1.0 - smoothstep(0.0, 0.3, t)) + 0.1 * smoothstep(0.7, 1.0, t);
}`;
    },

    build: (ctx) => {
      const g = geo(ctx, inWorld);
      const { W, H, u, P } = g;
      const L: LayerDef[] = [];
      const R = (n: string): number => ctx.row(n);
      const k = ctx.world;

      // --- the sky and the deep, the spire close on the east sky -----------------------------
      L.push({ kind: "glsl", name: "back", depth: 8, fog: 0, body: backGlsl(g, 8) });
      {
        const d = 40;
        const base = g.LY(g.RY(B5.plain) + 2, d);
        const h = H * 0.95;
        L.push({
          kind: "glsl",
          name: "spire",
          depth: d,
          fog: 0.2,
          body: spireGlsl({ x: W * 0.82, base, h, w: 40 * u, lean: -0.05, row: "spire", cloud: "storm", red: "red", fog: 0.1, rain: false, windows: 0.002 }),
          bounds: { x0: W * 0.35, x1: W * 1.2, y0: base - h * 1.1, y1: base + 2 },
        });
      }
      // the market far below and beyond: towers and stalls black against its amber haze
      L.push({ kind: "glsl", name: "far-wall", depth: 4.5, fog: 0.1, body: wallGlsl(g, 4.5) });
      // the bottom of the shaft (hollow-mouth/street.ts): the hollow's paved floor receding to the
      // market, two rows of stalls on it, the fallen structure's arcade across the street and the
      // east arch full of the market's light. The things standing on the floor are built first, so
      // the lanterns they hang can light pools on it.
      const pools: Pool[] = [];
      const xGate = Math.round(W * 0.855);
      const stallsFar = stallRow(g, R, 3.1, 241, W * 0.04, W * 0.98, pools);
      const stallsNear = stallRow(g, R, 2.05, 243, W * 0.02, W * 0.84, pools);
      const front = arcade(g, R, 1.3, xGate - Math.round(P * 0.75), pools);
      const gate = eastArch(g, R, 1.06, xGate);
      pools.push({ x: W + 40 * k, d: 1.06, r: 330 * k, k: 1.1 });
      L.push({ kind: "glsl", name: "floor", depth: 1, fog: 0, body: floorGlsl(g, 4.5, pools) });
      // the market below and beyond: towers and stalls black against its amber haze, in front of the fallen wall's foot
      {
        const d = 4;
        const ground = g.LY(g.RY(B5.street), d);
        const pix = new Pix(W, ground + 3);
        // the market's kerb on the floor (the floor layer carries on in front of it)
        for (let x = Math.round(W * 0.26); x < W; x++) {
          const edge = ground + Math.round((fbm1(x / (20 * u), 233, 2) - 0.5) * 2 * u);
          for (let y = edge; y < ground + 2; y++) pix.set(x, y, y === edge ? 0.22 : 0.1, R("wall"));
        }
        skyline(pix, { row: R("wall"), lightRow: R("amber"), x0: W * 0.28, x1: W + 10, ground, minH: 24 * u, maxH: 110 * u, minW: 12 * u, maxW: 40 * u, seed: 231, windows: 0.06, gap: 2 * u, shade: 0.1 });
        L.push(fogBand({ name: "market-haze", depth: d + 0.5, y0: ground - 110 * u, y1: ground + 2, softTop: 50 * u, softBottom: 2, sx: 160 * u, sy: 12 * u, drift: -2, cover: 0.7, alpha: 0.45, levels: 3, row: "amber", tone: 0.25, tint: 0.6 }));
        L.push({ kind: "pix", name: "market", depth: d, fog: 0.1, pix, x: 0, y: 0, dither: 0.2 });
      }
      L.push({ kind: "pix", name: "stalls-far", depth: 3.1, fog: 0.12, pix: stallsFar.pix, x: 0, y: stallsFar.y, dither: 0.2 });
      L.push({ kind: "glsl", name: "daylight", depth: 3, fog: 0, blend: "add", body: beamsGlsl(g, 3) });
      L.push({ kind: "glsl", name: "girders", depth: 2.2, fog: 0.05, body: girdersGlsl(g, 2.2, [-4, -11, -17, -24, -29]) });

      // dust sifting down the shaft, embers rising from the market below
      {
        const d = 2.6;
        const top = g.LY(g.RY(B5.plain), d);
        const bot = g.LY(g.RY(B5.street), d);
        L.push({ kind: "points", name: "sift", depth: d, system: new Falling({ source: [W * 0.15, top - 4, W * 0.85, top + 8], floor: bot, every: 0.6, speed: 18 * u, drift: 0.4, row: R("dust"), shade: 0.5, max: 60 }) });
        L.push({ kind: "points", name: "embers", depth: d, blend: "add", system: new Embers({ region: [W * 0.1, bot - 120 * u, W * 0.9, bot], rate: 3, rise: 12 * u, life: [4, 9], row: R("ember"), max: 50 }) });
      }
      L.push({ kind: "pix", name: "stalls-near", depth: 2.05, fog: 0.05, pix: stallsNear.pix, x: 0, y: stallsNear.y, dither: 0.2 });

      // --- the player plane: the plain's cut edge, the stairs, the platform, the west wall, the street
      {
        // top: from above the plain down past the platform's underside
        const y0 = g.LY(g.RY(B5.top), 1);
        const y1 = g.LY(g.RY(-3.5), 1);
        const pix = new Pix(W, y1 - y0);
        const X = (wx: number): number => g.X(wx);
        const Yr = (wy: number): number => g.LY(g.RY(wy), 1) - y0;
        // the plain's crust: soil strata, roots, the cut edge falling away under the causeway's end
        terrain(pix, {
          row: R("earth"),
          top: (px) => (px < X(179) ? Yr(B5.plain) : 1e9),
          bottom: (px) => Yr(B5.plain - 1.2 - 1.8 * Math.max(0, fbm1(px / (14 * u), 201, 2) - 0.3) - (px > X(177) ? (px - X(177)) / (P * 1.5) : 0)),
          seed: 202,
          scale: 12 * u,
          chunk: 2,
          light: [-0.6, -1],
          base: 0.3,
          contrast: 0.45,
          strata: 0.8,
          rim: 0.3,
          rimDepth: 2 * u,
          ao: 0.3,
        });
        // grass on the plain's lip
        for (let x = 0; x < X(179); x++) if (hashInt(x, 1, 203) < 0.5) for (let j = 1; j <= 1 + Math.floor(hashInt(x, 2, 203) * 6); j++) pix.set(x, Yr(B5.plain) - j, 0.35 + 0.1 * (j & 1), R("moss"));
        // roots hanging from the cut
        for (let i = 0; i < 16; i++) {
          const x = Math.round(i * (X(179) / 16) + hashInt(i, 3, 205) * 20);
          const len = Math.round((20 + 60 * hashInt(i, 4, 205)) * k);
          const y = Yr(B5.plain - 1.2) + Math.round(hashInt(i, 5, 205) * 20);
          for (let j = 0; j < len; j++) pix.set(x + Math.round(Math.sin(j * 0.15 + i) * 2), y + j, 0.3 - j * 0.002, R("root"));
        }
        // the stairs and the culvert platform: poured concrete, weathered. Board marks of the
        // formwork, aggregate showing through, rain stains running down from the edges, and the
        // mass darkening away from its lit top (so it reads as cast stone, not a flat block)
        const board = Math.max(3, Math.round(P * 0.14));
        const cast = (x: number, y: number, dy: number): number => {
          let s = 0.34 + 0.12 * (fbm(x / (10 * u), y / (7 * u), 206, 3) - 0.5);
          if (dy > 2 && y % board === 0) s -= 0.07;
          const h = hashInt(x, y, 207);
          if (h < 0.035) s += 0.08;
          else if (h > 0.975) s -= 0.08;
          const st = hashInt(Math.floor(x / Math.max(2, Math.round(3 * u))), 0, 208);
          if (st < 0.2) s -= (0.05 + 0.05 * st * 5) * Math.min(1, dy / (P * 0.7));
          return s - 0.12 * Math.min(1, dy / (P * 1.2));
        };
        const nSt = Math.ceil((B5.plain - B5.platform) / 0.2 - 1e-6);
        const rise = (B5.plain - B5.platform) / nSt;
        for (let i = 0; i < nSt; i++) {
          const a = X(B5.stairX + 0.3 * i), b = X(B5.stairX + 0.3 * (i + 1));
          const top = Yr(B5.plain - rise * (i + 1));
          const riser = Yr(B5.plain - rise * i);
          for (let x = a; x < b; x++)
            for (let y = top; y < Yr(-1.2); y++) {
              const dy = y - top;
              // the tread's lit nosing under the white sky; the riser below the step behind (east
              // face, away from the light) in its shadow
              let s = dy === 0 ? 0.9 : dy <= 2 ? 0.62 - 0.06 * dy : cast(x, y, dy);
              if (x - a < 2 && dy > 2 && y < riser + Math.round(P * 0.2)) s -= 0.08;
              pix.set(x, y, s, R("concrete"));
            }
        }
        const slab = (x0: number, x1: number): void => {
          for (let x = X(x0); x < X(x1); x++)
            for (let y = Yr(B5.platform); y < Yr(-1.2); y++) {
              const dy = y - Yr(B5.platform);
              let s = dy === 0 ? 0.9 : dy <= 2 ? 0.62 - 0.06 * dy : cast(x, y, dy);
              // a kerb line under the lip, and the slab's broken underside darker
              if (dy === Math.round(P * 0.12)) s -= 0.1;
              if (y > Yr(-1.2) - 3) s -= 0.1;
              pix.set(x, y, s, R("concrete"));
            }
          // the rebar where the slab broke off
          for (let j = 0; j < 4; j++) {
            const x = X(x1) + j * 3 - 2;
            for (let y = Yr(-0.2) + j * 7; y < Yr(-0.2) + j * 7 + 10; y++) pix.set(x + Math.round((y % 10) * 0.3), y, 0.35, R("iron"));
          }
        };
        slab(B5.platformX[0], B5.platformX[1]);
        slab(B5.lip[0], B5.lip[1]);
        // the culvert's mouth in the wall behind the platform: a dark arch (the gate prop fills it)
        {
          const cx = X(B5.culvertGate), cw = Math.round(P * 1.3), ch = Math.round(P * 1.7), base = Yr(B5.platform);
          for (let x = cx - cw; x <= cx + cw; x++)
            for (let y = base - ch - Math.round(P * 0.25); y < base; y++) {
              const dx = (x - cx) / cw;
              const top = base - ch * Math.sqrt(Math.max(0, 1 - dx * dx * 0.55)) - Math.round(P * 0.25) * (1 - Math.abs(dx));
              if (y < top) continue;
              const inner = Math.abs(dx) < 0.78 && y > top + P * 0.2;
              pix.set(x, y, inner ? 0.04 : 0.36 + (y < top + 2 ? 0.2 : 0) + 0.05 * (hashInt(Math.floor(x / 7), Math.floor(y / 6), 209) - 0.5), inner ? R("deep") : R("concrete"));
            }
        }
        L.push({ kind: "pix", name: "rim", depth: 1, pix, x: 0, y: y0, dither: 0 });
      }
      {
        // the west wall with its broken ledges, down to the street
        const y0 = g.LY(g.RY(-1.4), 1);
        const y1 = g.LY(g.RY(B5.street + 0.2), 1);
        const w = g.X(177.4);
        const pix = new Pix(w, y1 - y0);
        const Yr = (wy: number): number => g.LY(g.RY(wy), 1) - y0;
        terrain(pix, {
          row: R("concrete"),
          top: () => 0,
          bottom: () => pix.h,
          x0: 0,
          x1: g.X(172.35),
          seed: 211,
          scale: 18 * u,
          chunk: 2,
          light: [1, -0.3],
          base: 0.22,
          contrast: 0.4,
          strata: 0.7,
          vertical: 0.4,
          ao: 0.2,
        });
        for (const [a, b, y] of B5.ledges) {
          const x0 = g.X(a), x1 = g.X(b), top = Yr(y);
          // a broken floor slab jutting from the wall, rebar at its torn end
          for (let x = Math.min(x0, g.X(172.3)); x < x1; x++) {
            const ragged = x > x1 - 8 && hashInt(x, y, 213) < 0.4;
            for (let yy = top + (ragged ? 2 : 0); yy < top + Math.round(P * 0.34); yy++) {
              const dy = yy - top;
              pix.set(x, yy, dy === 0 ? 0.6 : dy === 1 ? 0.42 : 0.22 - dy * 0.003, R("concrete"));
            }
          }
          for (let j = 0; j < 3; j++) for (let yy = 0; yy < 8; yy++) pix.set(x1 + 1 + j * 3 + (yy >> 2), top + 4 + j * 3 + yy, 0.3, R("iron"));
        }
        L.push({ kind: "pix", name: "west-wall", depth: 1, pix, x: 0, y: y0, dither: 0 });
      }
      L.push({ kind: "pix", name: "arcade", depth: 1.3, fog: 0, pix: front.pix, x: 0, y: front.y, dither: 0.3 });
      L.push({ kind: "pix", name: "east-arch", depth: 1.06, fog: 0, pix: gate.pix, x: 0, y: gate.y, dither: 0.3 });
      {
        // the street at the bottom and the way into the market (east): warm light through an arch
        const y0 = g.LY(g.RY(B5.street + 5), 1);
        const y1 = g.LY(g.RY(B5.bottom), 1);
        const pix = new Pix(W, y1 - y0);
        const Yr = (wy: number): number => g.LY(g.RY(wy), 1) - y0;
        const st = Yr(B5.street);
        for (let x = 0; x < W; x++)
          for (let y = st; y < pix.h; y++) {
            const dy = y - st;
            const cw = Math.round(P * 0.45);
            const bx = Math.floor((x + (Math.floor(dy / 10) % 2) * (cw >> 1)) / cw);
            let s = dy === 0 ? 0.62 : dy === 1 ? 0.46 : 0.3 + 0.1 * (hashInt(bx, Math.floor(dy / 10), 215) - 0.5);
            if (dy > 1 && (dy % 10 === 0 || (x + (Math.floor(dy / 10) % 2) * (cw >> 1)) % cw === 0)) s = 0.12;
            s -= Math.min(0.24, dy * 0.006);
            pix.set(x, y, s, R("paving"));
          }
        L.push({ kind: "pix", name: "street", depth: 1, pix, x: 0, y: y0, dither: 0 });
      }
      // the market's light spilling out of the east arch onto the street, its piers and whoever stands there
      {
        const o = gate.open;
        const cx = (o.x0 + W) / 2 + P * 0.6;
        const cy = o.y1 - P * 0.4;
        L.push({
          kind: "glsl",
          name: "market-glow",
          depth: 1.06,
          blend: "add",
          body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 d = (p - vec2(${f(cx)}, ${f(cy)})) / vec2(${f(P * 3.6)}, ${f(P * 2.1)});
  float g = floor(max(0.0, 1.0 - length(d)) * 4.0 + (bayer4(p) - 0.5) * 0.6) / 4.0;
  if (g <= 0.0) return vec4(0.0);
  return vec4(ramp(${rowRef("amber")}, 0.3 + 0.5 * g, p, 0.0), 0.3 * g);
}`,
          bounds: { x0: cx - P * 3.7, x1: W + 1, y0: cy - P * 2.2, y1: cy + P * 2.2 },
        });
      }
      L.push({ kind: "character", name: "figure", depth: 1, x: g.X(183), ground: g.LY(g.RY(B5.platform), 1), rimDir: [-1, -1], height: P });
      void f;
      return L;
    },
  };
}

export default hollowMouth(false);

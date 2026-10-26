// D1 the Lift Ride's backdrop (lane R-D): the big transition, from the
// amber hollow to the cold storm outside, in 16 s. The car climbs the lift
// tower (rails and braces rushing past) out of the foundry's warm haze, through
// about 3 s of dark rock (the hollow's ceiling, lit amber from beneath, pipes
// and cables in it), and out onto the spire's stem: the black face on the
// right with its window slits streaming past, the storm on the left, the pale
// planet behind it seeming to rise as the cloud sea far below sinks, and
// rain beginning on the car as it nears the break. Everything keys to the
// camera's height (the room is one tall shaft; the camera rides with the car).

import { f, Pix, megastructure, sky, smooth, type LayerDef, type SceneDef } from "../../../../scenes/engine/index.ts";
import { planetBody } from "../../../../scenes/scenes/monolith-planet/planet.ts";
import { city } from "../../../../scenes/scenes/amber-hollow/city.ts";
import { billows } from "../../../../scenes/scenes/monolith-planet/clouds.ts";
import { Frame, SPIRE_PALETTE, clockLayer, cloudLightning, gustRain, spireFace, stormCloud } from "./common.ts";

export interface LiftGeo {
  w: number;
  h: number;
  /** Room y (px) of: the hollow's floor (the Lift Foot), the ground outside (the hollow's roof top), the ceiling rock's top and bottom, where rain starts and is full. */
  floor: number;
  ground: number;
  rockTop: number;
  rockBottom: number;
  rainFrom: number;
  rainFull: number;
  /** The camera's top row (room px) when the car stands at the break. */
  breakCam: number;
  /** Room x (px) of the shaft's centre line (the car). The room is narrower than the view, so the camera and the backdrop sit centred: the shaft is at the screen's centre. */
  shaftX: number;
}

export function liftScene(geo: LiftGeo): SceneDef {
  return {
    title: "spire-lift",
    palette: {
      ...SPIRE_PALETTE,
      amberhaze: ["#1a0e08", "#3a1c0c", "#6a3414", "#a0521c", "#d8802c", "#f6b050", "#ffe0a0"],
      rock: ["#07060a", "#0e0b10", "#171218", "#231a20", "#352628", "#5a3a2a"],
      pipe: ["#1a1210", "#2e1e16", "#4a3020", "#6e4a2c"],
    },
    fog: {
      stops: [
        [0.0, "#06080d"],
        [0.3, "#0c121b"],
        [0.55, "#152030"],
        [0.75, "#1f2e42"],
        [0.9, "#162232"],
        [1.0, "#0b1119"],
      ],
      bands: 16,
      density: 0.05,
      max: 0.8,
      dither: 0.5,
    },
    span: (W) => W,
    build: (ctx) => {
      const { W, H, u } = ctx;
      const F = new Frame(ctx, true);
      const L: LayerDef[] = [];
      L.push(sky({ name: "sky" }));
      L.push(clockLayer());
      // outside: the planet (nearly still), the storm, the cloud sea far below (it sinks as you rise)
      // the planet rises behind the spire as the car climbs: its centre follows the camera's height
      // (about 200 px over the climb from the hollow's roof to the break)
      {
        const cam0 = geo.breakCam;
        const body = planetBody({ x: W * 0.22, y: H * 0.3, r: H * 0.36, halo: 0.13 }).replace(/const vec2 PC = vec2\(([^,]+), ([^)]+)\);/, (_m, x, y) => `#define PC vec2(${x}, ${y} + clamp((uCamY - ${f(cam0)}) * 0.05, 0.0, 260.0))`);
        L.push({ kind: "glsl", name: "planet", depth: Infinity, fog: 0.4, dither: 0.5, body, bounds: { y0: -1e6, y1: H * 1.2 } });
      }
      L.push(stormCloud({ name: "storm-high", depth: 90, y0: -H * 0.3, y1: H * 0.3, sx: 150 * u, sy: 50 * u, drift: 5, cover: 0.62, tone: 0.12, alpha: 1, levels: 3 }));
      L.push(cloudLightning(ctx, { name: "cloud-lightning", depth: 60, rate: 3.5, region: [0, 0, W * 0.6, H * 0.4], radius: 150 * u, strength: 0.5 }));
      {
        const d = 30;
        const sea = Math.round(F.y(geo.ground, d)) - 8;
        const w = Math.ceil(ctx.panWidth(d)) + 8;
        const pix = new Pix(w, sea + 40);
        for (const [cx, hh, ww, lean, seed] of [[0.1, 0.16, 0.03, 0.1, 3], [0.33, 0.24, 0.036, -0.12, 4], [0.52, 0.12, 0.02, 0.2, 6]] as const)
          megastructure(pix, { row: ctx.row("far"), lightRow: ctx.row("windim"), cx: cx * w, ground: sea + 16, height: hh * H, width: ww * W, lean, seed, tiers: 4, windows: 0.01, fog: (_x, y) => 0.4 * smooth(sea - H * 0.2, sea + 4, y) });
        L.push({ kind: "pix", name: "far-ruins", depth: d, pix, x: -4, y: 0, dither: 0.3, twinkle: 0.3 });
        L.push(billows({ name: "cloud-sea", depth: 26, base: Math.round(F.y(geo.ground, 26)), wander: 5 * u, cell: 18 * u, radius: 10 * u, bottom: Math.round(F.y(geo.ground, 26)) + 800, drift: -3, row: "cloud", tone: 0.14, range: 0.4, tint: 0.55, lightGain: 1.2, seed: 7, crown: 0.7 }));
      }
      L.push(stormCloud({ name: "storm-mid", depth: 14, y0: -200, y1: Math.round(F.y(geo.ground, 14)), sx: 130 * u, sy: 70 * u, drift: 12, cover: 0.3, tone: 0.2, alpha: 0.75, levels: 3 }));
      // inside the hollow: warm haze, the foundry's lights and a far lattice (below the ceiling rock)
      // (its top reaches well up behind the rock, and it's gone once the camera is above the ceiling:
      // layers at different depths can't share an edge over a 72 H ride)
      {
        const camMax = geo.h - H;
        const rockBottomOnScreen = F.y(geo.rockBottom, 1.3) - camMax / 1.3;
        L.push(hollowHaze(H, u, Math.round(rockBottomOnScreen + camMax / 3) - 30, geo.rockTop));
        // the foundry city standing in the haze around the tower's foot, warm windows lit
        const d = 3;
        const ground = Math.round(F.y(geo.floor, d)) + 6;
        const ch = Math.round(14 * 80 / d);
        const pix = new Pix(W + 8, ground + FLOOR_DEEP);
        // the hollow's floor under the city: the foundry yard seen from the car, lit by its furnaces
        foundryFloor(pix, ground, W + 8, ctx.row("rock"), ctx.row("amberhaze"), ctx.row("amber"), ctx.row("pipe"));
        const fog = (_x: number, y: number): number => 0.35 * smooth(ground - ch * 0.2, ground - ch, y);
        const wins = { rows: [ctx.row("amber"), ctx.row("windim")], weights: [4, 1] };
        city(pix, -4, { x0: -4, x1: W * 0.36, ground, minH: ch * 0.35, maxH: ch, minW: 18 * u, maxW: 40 * u, row: ctx.row("rock"), wins, seed: 17, shade: 0.24, lit: 0.1, fog, u, blocky: 0.4 });
        city(pix, -4, { x0: W * 0.64, x1: W + 4, ground, minH: ch * 0.35, maxH: ch, minW: 18 * u, maxW: 40 * u, row: ctx.row("rock"), wins, seed: 23, shade: 0.24, lit: 0.1, fog, u, blocky: 0.4 });
        const cityL = { kind: "pix", name: "hollow-city", depth: d, pix, x: -4, y: 0, dither: 0.2, twinkle: 0.4 } as LayerDef;
        L.push(cityL);
      }
      // the ceiling rock you pass through: dark, lit amber from beneath, pipes and cables through it
      L.push(ceilingRock(u, Math.round(F.y(geo.rockTop, 1.3)), Math.round(F.y(geo.rockBottom, 1.3))));
      // the spire's stem: its face on the right (above ground), window slits streaming past
      {
        const d = 1.15;
        const ex = W / 2 + 2.4 * 80;
        const cut = Math.round(F.y(geo.rockTop, d)) + 300;
        L.push(spireFace({ name: "stem-face", depth: d, edge: { x0: ex, x1: ex, y0: cut, y1: 0, side: 1 }, tier: Math.round((1.9 * 80) / d), panel: Math.round((1.3 * 80) / d), rib: Math.round((3.4 * 80) / d), windows: 0.2, shade: 0.2, seed: 29, wet: true, bounds: { y0: -10, y1: cut } }));
      }
      // the lift tower: two rails either side of the car and cross braces, the whole way up
      L.push(tower(W / 2));
      L.push(gustRain({ name: "rain-far", depth: 6, cw: 5, len: 6 * u, speed: 190 * u, alpha: 0.35, dens: 0.6, seed: 19, shade: 0.25, lean: 0.16, tellLean: 0.1, gustLean: 0.3, floor: 0.7 }));
      L.push({ kind: "character", name: "figure", depth: 1, x: W / 2, ground: H * 0.62 });
      const rn = gustRain({ name: "rain-near", depth: 0.8, cw: 13, len: 15 * u, speed: 420 * u, alpha: 0.5, dens: 0.4, seed: 23, shade: 0.45, lean: 0.18, tellLean: 0.12, gustLean: 0.36, floor: 0.7, pass: "front" });
      L.push(rn);
      // rain only once the car is well out of the hollow (it begins on the car near the break)
      return withAltitudeRain(L, geo);
    },
  };
}

/** How far the foundry yard reaches below the city's foot (layer px): past the view's bottom at every camera height and viewport. */
const FLOOR_DEEP = 900;

/**
 * The foundry yard under the lift tower's foot, seen from above as the car
 * waits and starts to climb: dark paving in rows that widen toward you
 * (perspective), two crane rails with warm glints, pools of furnace light
 * (the brightest right under the tower, where the pit glows), slag carts and
 * crucibles as dark shapes in the light, a scatter of work lamps. It reads as
 * ground, not as the backdrop running out.
 */
function foundryFloor(pix: Pix, ground: number, w: number, rock: number, haze: number, amber: number, pipe: number): void {
  const h = FLOOR_DEEP;
  // furnace-light pools: centre x (fraction of the width), depth below the city (px), radii, strength;
  // soft (a falloff, stepped by the ramp's bands), flatter far off and wider close to
  const pools: [number, number, number, number, number][] = [
    [0.5, 150, 330, 95, 0.55],
    [0.12, 55, 220, 34, 0.3],
    [0.86, 80, 250, 44, 0.34],
    [0.28, 330, 300, 90, 0.26],
    [0.74, 380, 320, 100, 0.3],
    [0.5, 680, 560, 180, 0.24],
  ];
  const glowAt = (x: number, y: number): number => {
    let g = 0;
    for (const [px, py, rx, ry, k] of pools) {
      const dx = (x - px * w) / rx, dy = (y - py) / ry;
      g += k * Math.exp(-(dx * dx + dy * dy) * 1.6);
    }
    return Math.min(0.8, g);
  };
  // paving rows that widen toward you (perspective), with a seam across each row now and then
  const onRow = new Set<number>();
  for (let n = 1, y = 3; y < h; n++, y += Math.round(3 + n * 1.6)) onRow.add(y);
  for (let y = 0; y < h; y++) {
    const yy = ground + y;
    const every = Math.round(26 + y * 0.12);
    for (let x = 0; x < w; x++) {
      const g = glowAt(x, y);
      const seam = onRow.has(y) || (x + Math.floor(y / 9) * 17) % every === 0;
      // the ground is warm dark iron-brown, lit up in the pools; seams only show where there is light
      const grain = ((x * 7 + y * 3) % 11 === 0 ? 0.02 : 0) + 0.015 * Math.sin(x * 0.05 + y * 0.3);
      pix.set(x, yy, 0.05 + g * 0.95 + grain - (seam ? 0.03 + g * 0.25 : 0), haze);
    }
  }
  // the yard's top edge: a lit kerb where the city's streets meet it, a dark gutter under it
  for (let x = 0; x < w; x++) {
    pix.set(x, ground, 0.3, rock);
    pix.set(x, ground + 1, 0.02, rock);
  }
  // crane rails across the yard (pairs): dark steel with a lit top, warm glints where the light catches them
  for (const [ry, gap] of [[44, 6], [214, 12]] as const) {
    for (const r of [ry, ry + gap]) {
      for (let x = 0; x < w; x++) {
        const g = glowAt(x, r);
        const glint = (x * 31) % 89 < 2 && g > 0.12;
        pix.set(x, ground + r, glint ? 0.95 : 0.14 + g * 0.8, glint ? amber : pipe, 0, glint);
        pix.set(x, ground + r + 1, 0.05, rock);
      }
    }
  }
  // crucibles and slag carts on the rails and by the pit: dark bodies, a molten lip, a spill of light
  const shapes: [number, number, number, number][] = [[0.2, 44, 46, 22], [0.64, 44, 40, 20], [0.37, 214, 64, 30], [0.9, 226, 58, 26], [0.33, 150, 34, 26], [0.67, 150, 34, 26]];
  for (const [fx, y0, sw, sh] of shapes) {
    const x0 = Math.round(fx * w - sw / 2);
    const top = ground + y0 - sh;
    for (let y = 0; y < sh; y++) {
      // a tapered bowl: narrower at the foot
      const inset = Math.round((y / sh) * (y / sh) * sw * 0.18);
      for (let x = inset; x < sw - inset; x++) pix.set(x0 + x, top + y, x < inset + 2 ? 0.2 : y === 0 ? 0.3 : 0.08, pipe);
    }
    for (let x = 3; x < sw - 3; x++) {
      pix.set(x0 + x, top + 1, 0.98, amber, 0, true);
      if (x % 5 !== 0) pix.set(x0 + x, top + 2, 0.7, amber, 0, true);
    }
    // wheels
    for (const wx of [0.22, 0.78]) for (let k = 0; k < 4; k++) pix.set(x0 + Math.round(wx * sw) + k - 2, top + sh, 0.2, pipe);
  }
  // work lamps scattered over the yard (fewer far off)
  for (let i = 0; i < 70; i++) {
    const x = Math.round((i * 97.3) % w), y = ground + 6 + ((i * 131) % (h - 20));
    pix.set(x, y, 0.9, amber, 0, true);
    if (i % 3 === 0) pix.set(x, y - 1, 0.7, amber, 0, true);
  }
}

/** Rain only above `rainFrom` (room y), full by `rainFull`: keyed to the camera's height (uCamY). */
function withAltitudeRain(L: LayerDef[], geo: LiftGeo): LayerDef[] {
  for (const l of L) {
    if (l.kind !== "glsl" || !(l.name === "rain-far" || l.name === "rain-near")) continue;
    l.body = l.body.replace(
      "if (rain <= 0.01) return vec4(0.0);",
      `rain *= clamp((${f(geo.rainFrom)} - (uCamY + 360.0)) / ${f(geo.rainFrom - geo.rainFull)}, 0.0, 1.0);
  if (rain <= 0.01) return vec4(0.0);`,
    );
  }
  return L;
}

/** The hollow's warm haze below its ceiling: a stepped amber glow, far foundry lights, a lattice of girders. */
function hollowHaze(H: number, u: number, top: number, rockTop: number): LayerDef {
  return {
    kind: "glsl",
    name: "hollow-haze",
    depth: 3,
    bounds: { y0: top, y1: top + 6000 },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  if (uCamY + 360.0 < ${f(rockTop)}) return vec4(0.0);
  float y = p.y - ${f(top)};
  // brighter lower down (the furnaces below), a stepped haze
  float k = clamp(y / ${f(H * 0.9)}, 0.0, 1.0);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float n = fbm(vec2(p.x / ${f(120 * u)}, (p.y - tm * 4.0) / ${f(60 * u)}), 3);
  float sh = 0.28 + 0.4 * k + 0.1 * (n - 0.5);
  // a far lattice of girders crossing the haze, faint
  float gx = mod(p.x + p.y * 0.55, ${f(150 * u)});
  if (gx < 1.0) sh -= 0.07;
  // far lights: small warm windows and searchlight dots
  vec2 cell = floor(p / ${f(7 * u)});
  float h = hash2(cell);
  vec2 inC = p - cell * ${f(7 * u)};
  if (h > 0.975 && inC.x < 2.0 && inC.y < (h > 0.993 ? 3.0 : 1.0)) return vec4(pal(R_AMBER, 2.0 + step(0.993, h)), 1.0);
  vec3 c = ramp(R_AMBERHAZE, sh, p, 0.6);
  // the top of the haze darkens into the ceiling
  c = mix(c, pal(R_ROCK, 0.0), clamp(1.0 - y / ${f(40 * u)}, 0.0, 1.0) * 0.8);
  return vec4(c, 1.0);
}`,
  };
}

/** The hollow's ceiling: rock strata, a warm underside, pipes and cables through it. */
function ceilingRock(u: number, top: number, bottom: number): LayerDef {
  return {
    kind: "glsl",
    name: "ceiling-rock",
    depth: 1.3,
    bounds: { y0: top - 20, y1: bottom + 24 },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float n = fbm(vec2(p.x / ${f(26 * u)}, p.y / ${f(9 * u)}), 4);
  float edgeT = ${f(top)} + (n - 0.5) * ${f(24 * u)};
  float edgeB = ${f(bottom)} + (n - 0.5) * ${f(30 * u)};
  if (p.y < edgeT || p.y > edgeB) return vec4(0.0);
  float strata = sin(p.y * 0.21 + n * 6.0 + p.x * 0.01);
  float sh = 0.16 + 0.1 * (n - 0.5) + (strata > 0.75 ? 0.08 : strata < -0.7 ? -0.05 : 0.0);
  // the underside, lit by the hollow's furnaces
  float under = clamp(1.0 - (edgeB - p.y) / ${f(22 * u)}, 0.0, 1.0);
  sh += under * 0.5;
  // pipes and cables running up through it
  float pp = mod(p.x, ${f(160 * u)});
  bool pipe = pp > ${f(40 * u)} && pp < ${f(46 * u)};
  bool cable = abs(pp - ${f(110 * u)}) < 1.0 || abs(pp - ${f(114 * u)}) < 1.0;
  vec3 c;
  if (pipe) c = ramp(R_PIPE, 0.35 + 0.4 * step(pp, ${f(42 * u)}) + under * 0.3, p, 0.0);
  else if (cable) c = ramp(R_PIPE, 0.12 + under * 0.3, p, 0.0);
  else c = ramp(R_ROCK, sh + flashLight(s) * 0.2, p, 0.0);
  // a few warm service lamps in the rock
  vec2 lc = floor(p / ${f(9 * u)});
  vec2 li = p - lc * ${f(9 * u)};
  if (hash2(lc) > 0.985 && !pipe && li.x < 2.0 && li.y < 2.0) c = pal(R_AMBER, 2.0 + step(li.x, 0.5) * step(li.y, 0.5));
  return vec4(c, 1.0);
}`,
  };
}

/** The lift tower: two heavy rails either side of the car and a cross brace every 2 H, lit by what's around. */
function tower(cx: number): LayerDef {
  const half = Math.round(1.75 * 80);
  return {
    kind: "glsl",
    name: "lift-tower",
    depth: 1.04,
    bounds: { y0: -1e6, y1: 1e6, x0: cx - half - 20, x1: cx + half + 20 },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float dx = p.x - ${f(cx)};
  float ax = abs(dx);
  float sh = -1.0;
  // the rails (a lit face toward the car)
  if (ax > ${f(half)} && ax < ${f(half + 12)}) sh = (dx < 0.0 ? (ax > ${f(half + 9)} ? 0.4 : 0.22) : (ax < ${f(half + 3)} ? 0.36 : 0.18));
  // teeth on the rails' inner edges (the rack the car climbs)
  if (ax > ${f(half - 3)} && ax <= ${f(half)} && mod(p.y, 8.0) < 4.0) sh = 0.3;
  // cross braces: an X between the rails every 2 H
  float by = mod(p.y, 160.0);
  float t = (dx + ${f(half)}) / ${f(half * 2)};
  if (ax < ${f(half)} && (abs(by - t * 160.0) < 2.0 || abs(by - (1.0 - t) * 160.0) < 2.0)) sh = 0.16;
  if (ax < ${f(half + 12)} && by < 5.0) sh = by < 1.0 ? 0.36 : 0.18;
  if (sh < 0.0) return vec4(0.0);
  vec3 c = ramp(R_MONO, sh + flashLight(s) * 0.4 + sceneLight(s, uDepth), p, 0.0);
  return vec4(applyFog(c, uFog, 0.0, p, s), 1.0);
}`,
  };
}

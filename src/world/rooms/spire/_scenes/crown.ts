// D3 the Crown's backdrop (ref w02): the arena on the spire's flat top, where
// the storm is at its peak. Behind the arena floor the rest of the crown rises
// in a black sawtooth of fins and broken spikes with antenna masts, lit in
// hard edges by lightning; beyond it the storm is a low ceiling of cloud that
// flares from inside, the pale planet only a smudge of light through it, and,
// far off in a gap in the west, the ring, small (a visual rhyme: it was huge
// over the dock). Heavy rain leans with the gusts.

import { f, Pix, hashInt, fbm1, sky, smooth, type LayerDef, type SceneDef } from "../../../../scenes/engine/index.ts";
import { planetBody } from "../../../../scenes/scenes/monolith-planet/planet.ts";
import type { WorldLayer } from "../../../backdrop/engine.ts";
import { SPIRE_PALETTE, clockLayer, cloudLightning, gustRain, stormCloud } from "./common.ts";

export interface CrownGeo {
  /** The camera's top row in the room while you're on the arena floor (rail camera), px. */
  camY: number;
  /** Screen row of the arena floor's surface. */
  floorS: number;
}

/** The small far ring in the west: a broken band seen almost edge-on, a warm glint on its lit rim. */
export function farRing(o: { name: string; x: number; y: number; r: number; tilt: number; row: string; glowRow: string }): LayerDef {
  return {
    kind: "glsl",
    name: o.name,
    depth: Infinity,
    fog: 0.55,
    bounds: { x0: o.x - o.r - 6, x1: o.x + o.r + 6, y0: o.y - o.r * o.tilt - 6, y1: o.y + o.r * o.tilt + 6 },
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 d = (p + 0.5 - vec2(${f(o.x)}, ${f(o.y)})) / vec2(${f(o.r)}, ${f(o.r * o.tilt)});
  float r = length(d);
  float a = atan(d.y, d.x);
  // the band: thicker on the near (lower) arc, a gap torn out of the upper right
  float th = 0.1 + 0.06 * step(0.0, d.y);
  if (abs(r - 1.0) > th) return vec4(0.0);
  if (a < -0.35 && a > -1.25) return vec4(0.0);
  float lit = 0.35 + 0.35 * step(0.0, -d.x) + 0.3 * step(r, 1.0);
  vec3 c = ramp(${`R_${o.row.toUpperCase()}`}, lit, p, 0.0);
  if (a > 2.3 && a < 2.7 && r > 1.0) c = pal(${`R_${o.glowRow.toUpperCase()}`}, 2.0);
  return vec4(applyFog(c, uFog, 0.0, p, s), 1.0);
}`,
  };
}

/** The crown behind the arena: fins, broken spikes, antenna masts with red lights (Pix data, lit live). */
function crownPix(W: number, H: number, u: number, base: number, rows: { mono: number; red: number; win: number }, seed: number, gap: [number, number]): Pix {
  const pix = new Pix(W, H);
  const crest = new Float32Array(W);
  const face = new Uint8Array(W); // 1 on a fin's steep west face
  // the crown's shoulder, low and rough
  for (let x = 0; x < W; x++) crest[x] = base - 22 * u - fbm1(x / (60 * u), seed, 3) * 14 * u;
  let x = -40 * u;
  let k = 0;
  while (x < W + 40 * u) {
    const w = (26 + hashInt(k, 1, seed) * 46) * u;
    let h = (36 + hashInt(k, 2, seed) * 96) * u * (hashInt(k, 5, seed) > 0.82 ? 1.45 : 1);
    const mid = x + w / 2;
    // keep a low gap in the crest where the far ring shows through the storm
    if (mid > gap[0] && mid < gap[1]) h *= 0.35;
    const broken = hashInt(k, 3, seed) > 0.55;
    for (let i = 0; i < w; i++) {
      const X = Math.round(x + i);
      if (X < 0 || X >= W) continue;
      const t = i / w;
      // a sawtooth: a steep west face, a long back slope down to the east
      let top = base - h * (t < 0.2 ? t / 0.2 : 1 - ((t - 0.2) / 0.8) * 0.8);
      if (broken && t < 0.34) top = Math.max(top, base - h * 0.6 + (hashInt(X, 4, seed) - 0.5) * 8 * u);
      if (top < crest[X]!) {
        crest[X] = top;
        face[X] = t < 0.2 ? 1 : 0;
      }
    }
    x += w * (0.5 + hashInt(k, 6, seed) * 0.35);
    k++;
  }
  const masts: [number, number][] = [];
  for (let m = 0; m < 5; m++) {
    const mx = Math.round(W * (0.12 + 0.2 * m + (hashInt(m, 7, seed) - 0.5) * 0.08));
    const mh = (50 + hashInt(m, 8, seed) * 60) * u;
    if (mx > 0 && mx < W && !(mx > gap[0] && mx < gap[1])) masts.push([mx, Math.round(crest[mx]! - mh)]);
  }
  const band = Math.round(22 * u);
  for (let X = 0; X < W; X++) {
    const top = Math.round(crest[X]!);
    for (let y = Math.max(0, top); y < H; y++) {
      const d = y - top;
      let s = face[X] ? 0.26 : 0.16;
      if (d < 2) s = face[X] ? 0.78 : 0.5;
      else if (d < 4) s = face[X] ? 0.46 : 0.26;
      // ribs across the fins, following the crown's slope a little
      const r = (y + Math.floor(X * 0.12)) % band;
      if (d > 4 && r === 0) s = 0.08;
      else if (d > 4 && r === 1) s += 0.12;
      pix.set(X, y, s, rows.mono, smooth(base - 60 * u, base + 40 * u, y) * 0.45);
    }
  }
  for (const [mx, my] of masts) {
    for (let y = my; y < crest[mx]! + 2; y++) {
      pix.set(mx, y, 0.5, rows.mono);
      pix.set(mx + 1, y, 0.2, rows.mono);
      if ((y - my) % Math.round(18 * u) === 0) for (let i = -3; i <= 4; i++) pix.set(mx + i, y, 0.3, rows.mono);
    }
    pix.set(mx, my - 1, 1, rows.red, 0, true);
    pix.set(mx + 1, my - 1, 1, rows.red, 0, true);
  }
  for (let i = 0; i < 22; i++) {
    const X = Math.round(hashInt(i, 11, seed) * W);
    const Y = Math.round(crest[X]! + (24 + hashInt(i, 12, seed) * 60) * u);
    if (Y < H - 4 && Y > 0) for (let j = 0; j < 3; j++) pix.set(X + j, Y, 0.9, rows.win, 0, true);
  }
  return pix;
}

export function crownScene(geo: CrownGeo): SceneDef {
  return {
    title: "spire-crown",
    palette: SPIRE_PALETTE,
    fog: {
      stops: [
        [0.0, "#04060a"],
        [0.3, "#0a0f17"],
        [0.55, "#121b28"],
        [0.7, "#1a2635"],
        [0.8, "#223246"],
        [0.9, "#141e2b"],
        [1.0, "#0a0f16"],
      ],
      bands: 18,
      density: 0.05,
      max: 0.8,
      dither: 0.5,
    },
    span: (W) => W,
    prelude: (ctx) => /* glsl */ `
float sceneLight(vec2 s, float depth) {
  if (depth < 40.0) return 0.0;
  float d = length(s - vec2(${f(ctx.W * 0.72)}, ${f(-ctx.H * 0.02)})) / ${f(ctx.H * 0.42)};
  return 0.22 * (1.0 - smoothstep(0.6, 1.3, d));
}`,
    build: (ctx) => {
      const { W, H, u } = ctx;
      const L: LayerDef[] = [];
      const ly = (screenY: number, d: number): number => screenY + geo.camY / d;
      L.push(sky({ name: "sky" }));
      L.push(clockLayer());
      L.push({ kind: "glsl", name: "planet", depth: Infinity, fog: 0.74, dither: 0.5, body: planetBody({ x: W * 0.72, y: -H * 0.02, r: H * 0.42, halo: 0.16 }), bounds: { y0: -1e6, y1: H * 0.45 } });
      L.push(farRing({ name: "far-ring", x: W * 0.37, y: H * 0.43, r: 26 * u, tilt: 0.3, row: "far", glowRow: "amber" }));
      L.push(stormCloud({ name: "storm-ceiling", depth: 80, y0: -H * 0.35, y1: H * 0.46, sx: 150 * u, sy: 50 * u, drift: 7, cover: 0.8, tone: 0.1, alpha: 1, levels: 3 }));
      L.push(cloudLightning(ctx, { name: "cloud-lightning", depth: 60, rate: 5, region: [0, 10, W, H * 0.45], radius: 170 * u, strength: 0.65 }));
      L.push(stormCloud({ name: "storm-low", depth: 40, y0: H * 0.42, y1: H * 0.66, sx: 170 * u, sy: 26 * u, drift: 10, cover: 0.52, tone: 0.16, alpha: 0.9, levels: 3 }));
      L.push(cloudLightning(ctx, { name: "cloud-lightning-low", depth: 34, rate: 2, region: [0, H * 0.5, W, H * 0.66], radius: 120 * u, strength: 0.45 }));
      // the crown behind the arena
      {
        const d = 1.9;
        const w = ctx.panWidth(d) + 8;
        const x0 = -Math.ceil((w - W) / 2);
        const base = Math.round(ly(geo.floorS + 6, d));
        // the gap in the crest lines up with the far ring when you stand at the terminal
        const gx = W * 0.37 - ctx.span / (2 * d) - x0;
        const pix = crownPix(w, base + H, u, base, { mono: ctx.row("mono"), red: ctx.row("red"), win: ctx.row("windim") }, 41, [gx - 70 * u, gx + 90 * u]);
        L.push({ kind: "pix", name: "crown", depth: d, pix, x: x0, y: 0, dither: 0, twinkle: 0.5 });
      }
      L.push(gustRain({ name: "rain-far", depth: 5, cw: 5, len: 7 * u, speed: 210 * u, alpha: 0.4, dens: 0.7, seed: 13, shade: 0.28, lean: 0.2, tellLean: 0.12, gustLean: 0.38, floor: 0.85 }));
      L.push({ kind: "character", name: "figure", depth: 1, x: W / 2, ground: geo.floorS });
      L.push(gustRain({ name: "rain-near", depth: 0.8, cw: 12, len: 16 * u, speed: 440 * u, alpha: 0.52, dens: 0.48, seed: 31, shade: 0.45, lean: 0.22, tellLean: 0.14, gustLean: 0.42, floor: 0.85, pass: "front" }));
      void (null as unknown as WorldLayer);
      return L;
    },
  };
}

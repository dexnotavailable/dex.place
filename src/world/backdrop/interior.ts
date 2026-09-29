// Interior backdrop: a warm room inside something old, built with the scene
// engine (ramps, stepped light, whole pixels) for the world's indoor rooms.
// Plaster and timber, wainscot, a stone footing, tall windows with the
// outdoor weather in them (storm light, rain on the glass, lightning, the
// distant ring), light falling from the windows and pooling under lamps,
// dust in the light, dark pillars passing in front.
//
// Positions are given in room coordinates; the builder converts them to
// layer space (x - span / 2 at mid-pan, y as is), so the wall lines up with
// the room's floors and props, with a little parallax behind them.

import { f, v2 } from "../../scenes/engine/layers.ts";
import { glow } from "../../scenes/engine/layers.ts";
import { Motes } from "../../scenes/engine/particles.ts";
import { Pix } from "../../scenes/engine/pix.ts";
import { fbm, hashInt } from "../../scenes/engine/noise.ts";
import type { BuildCtx, LayerDef, SceneDef } from "../../scenes/engine/types.ts";
import type { WorldLayer } from "./engine.ts";

export interface InteriorOpts {
  roomW: number;
  roomH: number;
  /** Floor lines (room y) the timber beams sit on. */
  floors: number[];
  windows: { x: number; y: number; w: number; h: number }[];
  lamps: [number, number][];
  /** Room x of dark pillars in the foreground. */
  pillars: number[];
  /** Room x of heavy timber posts in the wall. */
  posts: number[];
}

const WALL_DEPTH = 1.08;
const OUT_DEPTH = 30;

export function interior(o: InteriorOpts): SceneDef {
  const lx = (ctx: BuildCtx, x: number): number => Math.round(x - ctx.span / 2);
  return {
    title: "interior",
    palette: {
      plaster: ["#1b1714", "#27211c", "#352c25", "#463a30", "#5a4b3e", "#72604f"],
      timber: ["#0d0907", "#171009", "#22180f", "#312216", "#44301f"],
      stone: ["#100e10", "#1a171a", "#262124", "#353033", "#4a4347"],
      frame: ["#0b0806", "#140e0a", "#1f160f", "#2e2115"],
      outside: ["#141a24", "#1d2633", "#2a3646", "#3c4a5c", "#566478", "#7c889a"],
      ring: ["#0e1218", "#161c24", "#20272f"],
      glass: ["#2a3a4a", "#4a6072", "#8aa0b0", "#c8d4dc"],
      lamp: ["#6d3f1c", "#b4702e", "#f0b060", "#ffe0a8"],
      beam: ["#3a3024", "#5c4a32", "#86704c", "#b8a070"],
      dust: ["#6a5a44", "#9c8664", "#d2bc90"],
      standin: ["#07070a", "#101015", "#24232c", "#a29792"],
    },
    fog: {
      stops: [
        [0, "#0e0c0b"],
        [0.5, "#1c1714"],
        [1, "#120f0d"],
      ],
      bands: 6,
      dither: 0.4,
      density: 0.3,
      max: 0.6,
    },
    span: (W) => Math.max(0, o.roomW - W),
    prelude: (ctx) => {
      const lamps = o.lamps.map(([x, y]) => v2(lx(ctx, x), y));
      const wins = o.windows.map((w) => `vec4(${f(lx(ctx, w.x))}, ${f(w.y)}, ${f(w.w)}, ${f(w.h)})`);
      return /* glsl */ `
const int NL = ${lamps.length};
const int NW = ${wins.length};
${lamps.length ? `const vec2 LAMPS[${lamps.length}] = vec2[${lamps.length}](${lamps.join(", ")});` : ""}
${wins.length ? `const vec4 WINS[${wins.length}] = vec4[${wins.length}](${wins.join(", ")});` : ""}
// light falling from each window, down and to the right, stepped in thirds
float windowLight(vec2 lp) {
  float l = 0.0;
  ${wins.length ? `for (int i = 0; i < NW; i++) {
    vec4 w = WINS[i];
    float dy = lp.y - w.y;
    if (dy < 0.0) continue;
    float x0 = w.x + dy * 0.45;
    float k = (lp.x - x0) / w.z;
    if (k < 0.0 || k > 1.0) continue;
    float fall = 1.0 - smoothstep(w.w * 0.5, w.w * 2.2, dy);
    l += fall;
  }` : ""}
  return floor(clamp(l, 0.0, 1.0) * 3.0) / 3.0;
}
float sceneLight(vec2 s, float depth) {
  // this layer's point in room space (x at mid-pan, y with the camera)
  vec2 lp = vec2(s.x + layerOff(${f(WALL_DEPTH)}), s.y + vOff(${f(WALL_DEPTH)}));
  float l = 0.0;
  ${lamps.length ? `for (int i = 0; i < NL; i++) {
    float d = length((lp - LAMPS[i]) * vec2(1.0, 1.25)) / ${f(ctx.player * 2.4)};
    float k = max(0.0, 1.0 - d);
    l += floor(k * k * 3.0 + 0.5) / 3.0 * 0.24;
  }` : ""}
  float wl = windowLight(lp);
  // grey storm light, brighter in a lightning flash, warm-ish after the storm
  l += wl * (0.08 + uWx2.x * 0.5 + uWx2.w * 0.12);
  return l * (1.0 - smoothstep(3.0, 20.0, depth));
}`;
    },
    build: (ctx) => {
      const { W, H } = ctx;
      const P = ctx.player;
      const L: LayerDef[] = [];
      const R = (n: string): number => ctx.row(n);
      const wide = (d: number): { x: number; w: number } => {
        const w = ctx.panWidth(d) + 8;
        return { x: -Math.ceil((w - W) / 2), w };
      };
      const rh = o.roomH + 8;

      // --- outside, seen through the windows ----------------------------------------
      L.push({
        kind: "glsl",
        name: "outside",
        depth: OUT_DEPTH,
        fog: 0,
        body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float tm = uWx2.y;
  float y = s.y / uRes.y;
  float dark = uWx.w, after = uWx2.w;
  // sky: stepped storm gradient, lifting toward the horizon
  float sh = 0.15 + y * 0.45 + after * 0.35 - dark * 0.15;
  vec2 q = vec2((p.x - floor(tm * (4.0 + uWx.y * 16.0))) / 90.0, p.y / 26.0);
  float c = fbm(q, 4);
  sh += (c - 0.5) * 0.35 + uWx2.x * 0.55;
  vec3 col = ramp(R_OUTSIDE, sh, p, 0.5);
  // the ring, far off, dark, tilted
  vec2 rp = (s - vec2(uRes.x * 0.62, uRes.y * 0.34)) / vec2(uRes.y * 0.55, uRes.y * 0.21);
  float rr = length(rp);
  if (abs(rr - 1.0) < 0.05 && rp.y < 0.55) col = ramp(R_RING, 0.4 + uWx2.x * 0.6, p, 0.0);
  // rain streaks outside
  if (uWx.x > 0.02) {
    vec2 rq = vec2(p.x - floor(p.y * uWx.y * 0.5), p.y);
    float colx = floor(rq.x / 4.0);
    float h = hash2(vec2(colx, 5.0));
    float yy = mod(rq.y + floor(tm * 420.0) * (0.8 + 0.4 * h) + h * 500.0, 40.0 + h * 30.0);
    if (h < uWx.x * 0.7 && yy < 7.0 && floor(mod(rq.x, 4.0)) == 1.0) col = ramp(R_OUTSIDE, 0.75 + uWx2.x * 0.3, p, 0.0);
  }
  return vec4(col, 1.0);
}`,
      });

      // --- the wall ------------------------------------------------------------------
      {
        const d = WALL_DEPTH;
        const { x, w } = wide(d);
        const pix = new Pix(w, rh);
        const X = (wx: number): number => lx(ctx, wx) - x;
        const plaster = R("plaster");
        const timber = R("timber");
        const stone = R("stone");
        const frame = R("frame");
        // plaster with soft blotches and hairline cracks
        for (let yy = 0; yy < rh; yy++)
          for (let xx = 0; xx < w; xx++) {
            const n = fbm((xx + x) / 60, yy / 40, 7);
            const m = fbm((xx + x) / 9, yy / 7, 9);
            let sh = 0.37 + (n - 0.5) * 0.07 + (m > 0.8 ? 0.03 : 0) - (yy / rh) * 0.04;
            if (hashInt(xx + x, yy, 3) > 0.998) sh -= 0.12;
            pix.set(xx, yy, sh, plaster, 0);
          }
        // floors: a heavy beam under each floor line, wainscot below the upper floors' beams, stone footing at the bottom
        const beamH = Math.round(P * 0.2);
        const wains = Math.round(P * 0.9);
        for (const fy of o.floors) {
          pix.rect(0, fy - wains, w, wains, { row: timber, shade: (xx, yy) => 0.3 + ((xx + x) % Math.round(P * 0.6) === 0 ? -0.2 : 0) + (yy === fy - wains ? 0.3 : 0) });
          for (let xx = 0; xx < w; xx += Math.round(P * 0.6)) pix.rect(xx + 3, fy - wains + 5, Math.round(P * 0.6) - 6, wains - 10, { row: timber, shade: 0.42 });
          pix.rect(0, fy, w, beamH, { row: timber, shade: (_xx, yy) => (yy === fy ? 0.7 : 0.25) });
        }
        pix.rect(0, rh - Math.round(P * 0.25), w, Math.round(P * 0.25), { row: stone, shade: (xx, yy) => 0.3 + (((xx + x) >> 4) + (yy >> 3)) % 2 * 0.08 });
        // ceiling beams
        pix.rect(0, 0, w, Math.round(P * 0.35), { row: timber, shade: (_xx, yy) => (yy === Math.round(P * 0.35) - 1 ? 0.6 : 0.2) });
        // posts in the wall
        for (const px of o.posts) {
          const pw = Math.round(P * 0.22);
          pix.rect(X(px) - pw / 2, 0, pw, rh, { row: timber, shade: (xx) => (xx === Math.round(X(px) - pw / 2) ? 0.55 : 0.3) });
        }
        // windows: hole in the wall with a deep frame, mullions, sill
        for (const wn of o.windows) {
          const x0 = X(wn.x);
          const fw = Math.round(P * 0.12);
          pix.rect(x0 - fw, wn.y - fw, wn.w + fw * 2, wn.h + fw * 2, { row: frame, shade: 0.35 });
          for (let yy = wn.y; yy < wn.y + wn.h; yy++) for (let xx = x0; xx < x0 + wn.w; xx++) pix.clear(xx, yy);
          // mullions and transom (dark frame, drawn back in)
          const mid = x0 + Math.round(wn.w / 2);
          pix.rect(mid - 1, wn.y, 3, wn.h, { row: frame, shade: 0.25 });
          pix.rect(x0, wn.y + Math.round(wn.h * 0.3), wn.w, 3, { row: frame, shade: 0.25 });
          // arched top: round the top corners
          for (let k = 0; k < Math.round(wn.w / 2); k++) {
            const cut = Math.round(Math.sqrt(Math.max(0, (wn.w / 2) ** 2 - (wn.w / 2 - k) ** 2)));
            const ch = Math.round(wn.w / 2) - cut;
            pix.rect(x0 + k, wn.y, 1, ch, { row: frame, shade: 0.35 });
            pix.rect(x0 + wn.w - 1 - k, wn.y, 1, ch, { row: frame, shade: 0.35 });
          }
          pix.rect(x0 - fw - 2, wn.y + wn.h + fw, wn.w + fw * 2 + 4, Math.round(P * 0.06), { row: stone, shade: 0.5 });
        }
        L.push({ kind: "pix", name: "wall", depth: d, fog: 0, pix, x, y: 0, dither: 0.15 });
      }

      // rain on the glass: drops sliding down inside the window rects
      const wins = o.windows.map((wn) => ({ x: lx(ctx, wn.x), y: wn.y, w: wn.w, h: wn.h }));
      if (wins.length) {
        L.push({
          kind: "glsl",
          name: "glass",
          depth: WALL_DEPTH,
          fog: 0,
          body: /* glsl */ `
const vec4 GW[${wins.length}] = vec4[${wins.length}](${wins.map((w) => `vec4(${f(w.x)}, ${f(w.y)}, ${f(w.w)}, ${f(w.h)})`).join(", ")});
vec4 layer(vec2 p, vec2 s) {
  bool inside = false;
  for (int i = 0; i < ${wins.length}; i++) {
    vec4 w = GW[i];
    if (p.x >= w.x && p.x < w.x + w.z && p.y >= w.y && p.y < w.y + w.w) inside = true;
  }
  if (!inside) return vec4(0.0);
  float wet = max(uWx.x, uWx2.w * 0.4);
  if (wet < 0.02) return vec4(0.0);
  float colx = floor(p.x / 3.0);
  float h = hash2(vec2(colx, 17.0));
  if (h > wet * 0.35) return vec4(0.0);
  float sp = 8.0 + h * 30.0;
  float y = mod(p.y - floor(uWx2.y * sp) + h * 311.0, 26.0 + h * 40.0);
  if (y > 3.0 || mod(p.x, 3.0) > 0.5) return vec4(0.0);
  return vec4(ramp(R_GLASS, 0.5 + uWx2.x * 0.5, p, 0.0), 0.8);
}`,
        });
      }

      // light falling from the windows, visible in the dust
      L.push({
        kind: "glsl",
        name: "window-beams",
        depth: WALL_DEPTH,
        fog: 0,
        blend: "add",
        body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float w = windowLight(vec2(p.x, p.y));
  if (w <= 0.0) return vec4(0.0);
  float k = 0.05 + uWx2.x * 0.3 + uWx2.w * 0.06;
  return vec4(ramp(R_BEAM, 0.3 + uWx2.x * 0.5, p, 0.0), w * k);
}`,
      });

      // lamp glows on the wall
      for (const [x, y] of o.lamps) L.push(glow({ name: "lamp-glow", depth: WALL_DEPTH, x: lx(ctx, x), y, r: Math.round(P * 0.7), row: "lamp", flicker: 0.15, alpha: 0.22 }));

      // dust drifting in the light
      L.push({
        kind: "points",
        name: "dust",
        depth: 1.02,
        blend: "add",
        system: new Motes({ region: [-ctx.span / 2 - 40, 0, W + ctx.span / 2 + 40, o.roomH], count: Math.round(260 * (o.roomW / 1920)), row: R("dust"), shade: [0.3, 0.9], vel: [2, -1.5], wander: 3, size: 1, twinkle: 0.5 }, ctx.rng),
      });

      // dark pillars passing in front
      for (const px of o.pillars) {
        const d = 0.72;
        const { x, w } = wide(d);
        const pix = new Pix(w, rh + 200);
        const cx = lx(ctx, px) - x;
        const pw = Math.round(P * 0.55);
        pix.rect(cx - pw / 2, 0, pw, rh + 200, { row: R("timber"), shade: (xx) => (xx === Math.round(cx - pw / 2) + pw - 1 ? 0.25 : 0.06) });
        const lp = { kind: "pix", name: "pillar", depth: d, pix, x, y: -100, fog: 0, dither: 0 } as WorldLayer;
        L.push(lp);
      }
      void H;
      return L;
    },
  };
}

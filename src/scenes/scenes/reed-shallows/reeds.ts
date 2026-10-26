// Reeds standing in the water, drawn per pixel: thin stems in clumps, a few
// with cattail heads, leaning with the wind (whole pixels, stepped at 12 fps)
// and bowing as the colossus's big ring washes through them (footRings()
// from the prelude, evaluated at the reeds' own depth). Reflected in the lake
// about their base. Used for the islands in the shallows and the near reeds.

import { f, rowRef, type GlslLayer } from "../../engine/index.ts";

export interface ReedOpts {
  name: string;
  depth: number;
  /** Base row (layer y) where they stand in the water. */
  base: number;
  /** Clumps: centre layer x, half width, height (px). */
  clumps: [number, number, number][];
  spacing: number;
  row: string;
  headRow: string;
  /** How much of the stems carry heads (0..1). */
  heads: number;
  width?: number;
  reflect?: number;
  reflectFade?: number;
  fog?: number;
  /** Respond to the big ring's wash (needs footRings in the prelude), and the water's rows from horizon to the player plane. */
  wash: boolean;
  rowK?: number;
  pass?: "front" | "back";
}

export function reeds(o: ReedOpts): GlslLayer & { pass?: "front" | "back" } {
  const maxH = Math.max(...o.clumps.map((c) => c[2]));
  const x0 = Math.min(...o.clumps.map((c) => c[0] - c[1])) - maxH;
  const x1 = Math.max(...o.clumps.map((c) => c[0] + c[1])) + maxH;
  const sp = o.spacing;
  const w = o.width ?? 1;
  const clumps = o.clumps.map(([cx, hw, hh]) => `if (abs(sx - ${f(cx)}) < ${f(hw)}) { float k = 1.0 - abs(sx - ${f(cx)}) / ${f(hw)}; hgt = max(hgt, ${f(hh)} * (0.35 + 0.65 * sqrt(k))); }`).join("\n      ");
  return {
    kind: "glsl",
    name: o.name,
    depth: o.depth,
    fog: o.fog,
    reflect: o.reflect,
    reflectFade: o.reflectFade,
    bounds: { x0, x1, y0: o.base - maxH - 4, y1: o.base + 1 },
    pass: o.pass,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float hb = ${f(o.base)} - p.y;
  if (hb < 0.0) return vec4(0.0);
  float tm = floor(uTime * (1.0 - 0.6 * uReduced) * 12.0) / 12.0;
  float windL = 0.6 * sin(tm * 0.9 + p.x * 0.01) + 0.4 * sin(tm * 2.3 + p.x * 0.05);
  ${
    o.wash
      ? `float wx = (p.x - uRes.x * 0.5) * ${f(o.depth)};
  float wash = footRings(wx, ${f(o.depth)}, ${f(o.rowK ?? 120)}).y;`
      : "float wash = 0.0;"
  }
  float best = -1.0;
  float head = 0.0;
  float bs = 0.0;
  for (int i = -4; i <= 4; i++) {
    float cell = floor(p.x / ${f(sp)}) + float(i);
    float hsh = hash2(vec2(cell, 17.0));
    float sx = cell * ${f(sp)} + floor(hsh * ${f(sp)});
    float hgt = 0.0;
      ${clumps}
    if (hgt <= 0.0) continue;
    hgt *= 0.7 + 0.5 * hash2(vec2(cell, 3.0));
    if (hb > hgt) continue;
    float t = hb / hgt;
    float lean = (windL * 0.18 + (hash2(vec2(cell, 9.0)) - 0.5) * 0.25 + wash * 0.9) * hgt * 0.35;
    float x = sx + floor(lean * t * t + 0.5);
    if (abs(p.x - x) < ${f(w * 0.5 + 0.01)}) {
      best = t;
      bs = hash2(vec2(cell, 5.0));
      head = (hash2(vec2(cell, 7.0)) < ${f(o.heads)} && t > 0.72 && t < 0.9) ? 1.0 : 0.0;
      break;
    }
    // cattail heads are two px wide
    if (hash2(vec2(cell, 7.0)) < ${f(o.heads)} && t > 0.72 && t < 0.9 && abs(p.x - x - 1.0) < 0.51) {
      best = t;
      head = 1.0;
      break;
    }
  }
  if (best < 0.0) return vec4(0.0);
  float light = sceneLight(s, uDepth) + flashLight(s) * 0.5;
  vec3 c = head > 0.5 ? ramp(${rowRef(o.headRow)}, 0.25 + 0.2 * bs + light, p, 0.0)
                      : ramp(${rowRef(o.row)}, 0.18 + 0.5 * best * (0.6 + 0.4 * bs) + light, p, 0.0);
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`,
  };
}

// Cloud banks with a real top: rows of overlapping round puffs (2D discs shaded
// as spheres), lit from behind-left by the moon (a bright rim on their upper
// edges), darker and bluer toward the base where the uplight catches their
// undersides. Puffs breathe (radius and height change slowly, per puff) and the
// whole bank drifts in whole pixels, so the silhouette changes shape as it
// slides. A scene-local layer kind (the engine's mist() has no lit tops).

import { f, rowRef, type GlslLayer } from "../../engine/index.ts";

export interface BillowOpts {
  name: string;
  depth: number;
  /** Line the big puffs' centres sit on (layer px), and how far it wanders. */
  base: number;
  wander: number;
  /** Big puff spacing and radius (px); small puffs ride on top. */
  cell: number;
  radius: number;
  /** Solid body extends from the base down to here (layer px). */
  bottom: number;
  drift: number;
  row: string;
  /** Light direction in the disc plane (x right, y down) toward the light. */
  light?: [number, number];
  /** Base tone and tone range. */
  tone?: number;
  range?: number;
  /** How much of the fog colour it takes on (0 keeps the ramp). */
  tint?: number;
  lightGain?: number;
  alpha?: number;
  seed?: number;
  fog?: number;
  /** Fraction of cells that carry a small puff on top. */
  crown?: number;
  /** Ramp the uplight tints the undersides with. */
  glowRow?: string;
  /** Puff height / width (flattened discs). */
  flat?: number;
}

export function billows(o: BillowOpts): GlslLayer {
  const [lx] = o.light ?? [-0.55, -0.8];
  const sd = f(o.seed ?? 1);
  const top = o.base - o.radius * 2.2 - o.wander;
  return {
    kind: "glsl",
    name: o.name,
    depth: o.depth,
    fog: o.fog,
    bounds: { y0: top, y1: o.bottom + 1 },
    body: /* glsl */ `
// where the bank's puff line sits: two slow incommensurate waves
float baseAt(float x, float tm) {
  float k = x / ${f(o.cell)};
  return ${f(o.base)} + ${f(o.wander)} * (0.6 * sin(k * 0.61 + ${sd} * 3.1 + tm * 0.013) + 0.4 * sin(k * 1.43 + ${sd} * 7.7 - tm * 0.021));
}
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float px = p.x - floor(tm * ${f(o.drift)} + 0.5) + 0.5;
  float py = p.y + 0.5;
  const float CW = ${f(o.cell)};
  const float RR = ${f(o.radius)};
  // three sizes of puff: big masses, smaller heads on them, little knuckles on top.
  // The winner is the lowest centre among the (flattened) discs over this pixel, so
  // nearer puffs overlap farther ones; each puff has its own lit crest.
  float bestY = -1e9;
  float crest = 1e9;
  float ang = 0.0;
  float topArc = 1e9;
  // deep in the bank no crest can reach: skip the puff search
  bool deep = py > ${f(o.base + o.wander + o.radius * 0.75)};
  if (deep) { bestY = 0.0; crest = py - ${f(o.base)}; topArc = -1e9; }
  for (int row = 0; row < 3; row++) {
    if (deep) break;
    float cw = CW * (row == 0 ? 1.0 : row == 1 ? 0.62 : 0.38);
    float ci = floor(px / cw);
    int kr = row == 0 ? 2 : 1;
    for (int k = -2; k <= 2; k++) {
      if (k < -kr || k > kr) continue;
      float c = ci + float(k);
      vec2 hc = vec2(c, float(row) * 13.0 + ${sd});
      float h0 = hash2(hc), h1 = fract(h0 * 97.31 + 0.123), h2 = fract(h0 * 53.71 + 0.71);
      if (row > 0 && h2 > (row == 1 ? ${f(o.crown ?? 0.55)} : ${f((o.crown ?? 0.55) * 0.7)})) continue;
      float breathe = sin(tm * (0.05 + 0.06 * h1) + h0 * 6.28);
      float r = RR * (row == 0 ? 0.45 + 1.15 * h1 * h1 : row == 1 ? 0.3 + 0.4 * h1 : 0.16 + 0.2 * h1) * (1.0 + 0.08 * breathe);
      float cx = (c + 0.1 + 0.8 * h0) * cw;
      float by = baseAt(cx, tm);
      float cy = row == 0 ? by + RR * 0.3 * (h2 - 0.5) : row == 1 ? by - RR * (0.3 + 0.35 * h2) : by - RR * (0.55 + 0.4 * h2);
      cy += 0.05 * RR * breathe;
      float ry = r * ${f(o.flat ?? 0.62)} * (0.7 + 0.6 * fract(h0 * 211.3));
      float dx = px - cx;
      if (abs(dx) >= r) continue;
      float arc = cy - ry * sqrt(1.0 - (dx * dx) / (r * r));
      topArc = min(topArc, arc);
      if (py < arc || cy < bestY) continue;
      bestY = cy;
      crest = py - arc;
      ang = dx / r;
    }
  }
  if (bestY < -1e8) {
    float by = baseAt(px, tm);
    if (py < by || py > ${f(o.bottom)}) return vec4(0.0);
    crest = 1e3;
  }
  if (py > ${f(o.bottom)}) return vec4(0.0);
  // outer crests (the silhouette against what is behind) catch the moon; inner ones less
  float outer = step(py - topArc, crest + 0.5);
  float side = clamp(0.5 + 0.5 * ang * ${f(Math.sign(lx) || -1)}, 0.0, 1.0);
  float lit = exp(-crest / ${f(Math.max(1.5, o.radius * 0.14))}) * (0.35 + 0.65 * side) * (0.5 + 0.5 * outer) + 0.22 * exp(-crest / ${f(o.radius * 0.8)});
  float under = smoothstep(${f(o.base - o.radius * 0.3)}, ${f(o.bottom)}, py);
  float fold = vnoise(vec2(px / ${f(o.cell * 0.3)}, py / ${f(o.radius * 0.35)}) + ${sd});
  float tone = ${f(o.tone ?? 0.2)} + ${f(o.range ?? 0.5)} * lit * (1.0 - 0.5 * under) - 0.05 * step(0.64, fold);
  float sl = sceneLight(s, uDepth) * ${f(o.lightGain ?? 1.0)} * (0.4 + 0.8 * under);
  tone += sl * 0.5 + flashLight(s) * 0.5;
  vec3 c = ramp(${rowRef(o.row)}, tone, p, 0.7);
  c = mix(fogColor(s), c, ${f(o.tint ?? 0.75)});
  ${o.glowRow ? `// the blue light from below takes over the undersides near its source
  float gl = stepd(clamp(sl * 1.4, 0.0, 1.0), 4.0, p, 0.9);
  if (gl > 0.0) c = mix(c, ramp(${rowRef(o.glowRow)}, 0.15 + 0.7 * gl + 0.3 * lit, p, 0.6), min(1.0, gl * 1.2));` : ""}
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, ${f(o.alpha ?? 1)});
}`,
  };
}

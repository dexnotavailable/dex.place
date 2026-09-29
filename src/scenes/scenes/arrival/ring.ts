// The ring over the lake, for the arrival: the tilted broken megastructure
// ray-traced per pixel, its hull blocks, the sun's light cone on its inner face,
// the shaft and where it lands. Adapted from ring-lake (same construction) and
// reworked for the 1280x720 world view: finer panel detail where the hull is
// near, greebles and window runs that only resolve at the doubled resolution.

import { f, v2, hashInt, smooth } from "../../engine/index.ts";
import { RING, type Geo } from "./geo.ts";


// Ring in camera space: camera at the origin looking down +z, y up. The ring is
// a thick band (inner radius R, radial thickness T, axial width WD) whose axis
// is tipped so its lower-left arc swings away from us: we look down onto that
// arc's inner face, and the upper right (with the break) is the near side.

function ringBasis(): { A: number[]; B1: number[]; B2: number[] } {
  const n = Math.hypot(...RING.A);
  const A = RING.A.map((v) => v / n);
  // B1 = normalize(cross(up, A)), B2 = cross(A, B1)
  let B1 = [A[2]!, 0, -A[0]!];
  const l1 = Math.hypot(...B1);
  B1 = B1.map((v) => v / l1);
  const B2 = [A[1]! * B1[2]! - A[2]! * B1[1]!, A[2]! * B1[0]! - A[0]! * B1[2]!, A[0]! * B1[1]! - A[1]! * B1[0]!];
  return { A, B1, B2 };
}

/** Screen position of a point on the ring's inner face at angle th (local), axial z (-0.5..0.5 of width). */
export function ringScreen(g: Geo, th: number, z: number): [number, number] {
  const { A, B1, B2 } = ringBasis();
  const P = [0, 1, 2].map((i) => RING.C[i]! + RING.R * (Math.cos(th) * B1[i]! + Math.sin(th) * B2[i]!) + z * RING.WD * A[i]!);
  return [g.W / 2 + (P[0]! / P[2]!) * g.F, g.hor - (P[1]! / P[2]!) * g.F];
}

/** Screen position of a ring point at angle th, axial z (-0.5..0.5 of width) and radius r. */
export function ringScreenR(g: Geo, th: number, z: number, r: number): [number, number] {
  const { A, B1, B2 } = ringBasis();
  const P = [0, 1, 2].map((i) => RING.C[i]! + r * (Math.cos(th) * B1[i]! + Math.sin(th) * B2[i]!) + z * RING.WD * A[i]!);
  return [g.W / 2 + (P[0]! / P[2]!) * g.F, g.hor - (P[1]! / P[2]!) * g.F];
}

// The ring is a heavy hull, not a lattice. The sun is behind it, so the faces
// toward us are dark, built from decks, panels, ribs and grooves as flat bands of
// the ramp. The inner face of the lower arc looks back up at the sun: where the
// sun's cone grazes it, its panels and ribs light up warm (the focal point); its
// rim against the hole is a hard warm line; the near side face is a dark
// thickness band with a lit lip. Pattern coordinates are integer fractions of a
// turn, so nothing seams where the angle wraps. Light is stepped before it meets
// the ramp, so moving light flips pixels in patches, never as scattered dither.
export function ringBody(g: Geo): string {
  const [cx, cy, cz] = RING.C;
  const [ax, ay, az] = RING.A;
  const gth = gapTheta(g);
  const sd = sunDir(g);
  const cone = lightCone(g);
  return /* glsl */ `
const vec3 RC = vec3(${f(cx)}, ${f(cy)}, ${f(cz)});
const float RR = ${f(RING.R)};
const float RT = ${f(RING.T)};
const float RW = ${f(RING.WD)};
const float FOC = ${f(g.F)};
const float GTH = ${f(gth)};
const vec2 SUN = ${v2(g.sun[0], g.sun[1])};
const vec3 SUND = vec3(${f(sd[0])}, ${f(sd[1])}, ${f(sd[2])});

// nearest hit on the band: 0 inner face, 1 outer face, 2/3 the far/near side faces.
// cut: world distance past the broken end (small = on the torn edge).
int ringHit(vec3 o, vec3 d, out vec3 hit, out float best, out float cut) {
  best = 1e9;
  cut = 1e9;
  int face = -1;
  float a = d.x * d.x + d.y * d.y;
  float b = 2.0 * (o.x * d.x + o.y * d.y);
  for (int k = 0; k < 6; k++) {
    float t = -1.0;
    if (k < 4) {
      float r = k < 2 ? RR : RR + RT;
      float c = o.x * o.x + o.y * o.y - r * r;
      float disc = b * b - 4.0 * a * c;
      if (disc < 0.0) continue;
      float sq = sqrt(disc);
      t = (-b + ((k & 1) == 0 ? -sq : sq)) / (2.0 * a);
    } else {
      if (abs(d.z) < 1e-5) continue;
      t = ((k == 4 ? -RW : RW) * 0.5 - o.z) / d.z;
    }
    if (t <= 0.0 || t >= best) continue;
    vec3 h = o + d * t;
    float r = length(h.xy);
    if (k < 4 && abs(h.z) > RW * 0.5) continue;
    if (k >= 4 && (r < RR || r > RR + RT)) continue;
    // the broken section: each end is cut in big stepped blocks (decks x slabs),
    // different on the two ends, so it reads as torn structure, not noise
    float sd = mod(atan(h.y, h.x) - GTH + PI, 2.0 * PI) - PI;
    float side = sd < 0.0 ? 0.0 : 1.0;
    float rn = clamp((r - RR) / RT, 0.0, 0.999);
    float zn = clamp(h.z / RW + 0.5, 0.0, 0.999);
    float blk = (hash2(vec2(floor(rn * 3.0) + side * 11.0, floor(zn * 3.0) + 3.0)) - 0.5) * 0.16
              + (hash2(vec2(floor(rn * 6.0) + side * 17.0 + 40.0, floor(zn * 6.0))) - 0.5) * 0.06;
    float hw = 0.16 + blk;
    if (abs(sd) < hw) continue;
    best = t;
    hit = h;
    cut = (abs(sd) - hw) * r;
    face = k < 2 ? 0 : k < 4 ? 1 : k == 4 ? 2 : 3;
  }
  return face;
}

// the sun's light cone through the hole, in layer pixels (it belongs to the ring,
// so it pans with it): 0 outside, 1 on its axis; stepped in thirds
float ringCone(vec2 p) {
  vec2 q = p - ${v2(cone.from[0], cone.from[1])};
  vec2 dir = ${v2(cone.dir[0], cone.dir[1])};
  float al = dot(q, dir);
  if (al < 0.0) return 0.0;
  float w = ${f(cone.w0)} + al * ${f(cone.spread)};
  float c = abs(q.x * dir.y - q.y * dir.x) / w;
  float v = (1.0 - smoothstep(0.25, 1.0, c)) * smoothstep(0.0, ${f(cone.fadeIn)}, al);
  return floor(v * 3.0 + 0.35) / 3.0;
}

vec4 layer(vec2 p, vec2 s) {
  vec3 A = normalize(vec3(${f(ax)}, ${f(ay)}, ${f(az)}));
  vec3 B1 = normalize(cross(vec3(0.0, 1.0, 0.0), A));
  vec3 B2 = cross(A, B1);
  vec3 rd = normalize(vec3((p.x + 0.5 - ${f(g.W / 2)}) / FOC, (${f(g.hor)} - p.y - 0.5) / FOC, 1.0));
  vec3 o = vec3(dot(-RC, B1), dot(-RC, B2), dot(-RC, A));
  vec3 d = vec3(dot(rd, B1), dot(rd, B2), dot(rd, A));
  vec3 hit;
  float best, cut;
  int face = ringHit(o, d, hit, best, cut);
  if (face < 0) return vec4(0.0);

  float r = length(hit.xy);
  float tm = uTime * (1.0 - 0.7 * uReduced);
  float th = atan(hit.y, hit.x) + tm * 0.0016;   // the band turns, very slowly
  float rn = clamp((r - RR) / RT, 0.0, 1.0);
  float zn = clamp(hit.z / RW + 0.5, 0.0, 1.0);
  float pw = best / FOC;                          // world units per pixel at this hit
  vec3 nl = face == 0 ? vec3(-hit.xy / r, 0.0) : face == 1 ? vec3(hit.xy / r, 0.0) : vec3(0.0, 0.0, face == 2 ? -1.0 : 1.0);
  vec3 n = normalize(nl.x * B1 + nl.y * B2 + nl.z * A);
  bool back = dot(n, rd) > 0.0;
  if (back) n = -n;
  float lit = max(dot(n, SUND), 0.0);            // grazing sun on the faces we see
  float sunN = exp(-length(p - SUN) / (uRes.y * 0.2));
  float cone = ringCone(p);

  // across the face (0..1) and its world width; along the band in 1/256 turns
  float acr = face >= 2 ? rn : zn;
  float acrW = face >= 2 ? RT : RW;
  float al = fract(th / 6.2831853) * 256.0;
  float unit = 6.2831853 * r / 256.0;              // world length of one along-unit

  // decks: long lines running along the band, five on the inner face, three elsewhere
  vec4 E = face == 0 ? vec4(0.12, 0.34, 0.55, 0.78) : vec4(0.1, 0.37, 0.64, 0.9);
  float dk = acr < E.x ? 0.0 : acr < E.y ? 1.0 : acr < E.z ? 2.0 : acr < E.w ? 3.0 : 4.0;
  float sh = face == 0 ? 0.2 : face == 3 ? 0.14 : face == 1 ? 0.08 : 0.1;
  sh += dk == 2.0 ? -0.03 : dk == 0.0 ? 0.02 : 0.0;
  // panels: 1 or 2 per unit by deck, a flat shade each, some recessed bays, some raised blocks
  float m = mod(dk, 2.0) + 1.0;
  float pc = floor(al * m);
  float ph = hash2(vec2(pc, dk + float(face) * 10.0));
  sh += (floor(ph * 3.0) / 3.0 - 0.33) * 0.05;
  bool bay = ph < 0.12;
  bool block = ph > 0.93;
  if (bay) sh -= 0.06;
  else if (block) sh += 0.04;
  if (fract(al * m) * unit / m < pw * 0.9) sh -= 0.04;             // panel seam
  // fine hull detail that only resolves in the doubled view: hatches and vents in
  // quarter-panel cells, a 1 px service rail along each deck. Gated on pixel size so
  // the old 640x360 mode never gets sub-pixel noise from it.
  {
    float nq = face == 0 ? 20.0 : 12.0;
    float cq = unit / (m * 4.0);
    if (cq > pw * 2.5) {
      float qa = al * m * 4.0;
      float qc = acr * nq;
      float gh = hash2(vec2(floor(qa), floor(qc) + float(face) * 31.0 + dk * 7.0));
      float fa = fract(qa), fc = fract(qc);
      if (gh < 0.1 && fa > 0.18 && fa < 0.82 && fc > 0.22 && fc < 0.78) {
        sh += gh < 0.035 ? 0.1 : -0.08;
        // a vent: dark slats across it
        if (gh > 0.07 && fract(fc * 3.0) < 0.34) sh -= 0.06;
      }
      float rail = abs(fract(acr * nq * 0.5) - 0.5) * acrW * 2.0 / nq;
      if (rail < pw * 0.5 && fract(qa * 0.25) > 0.1) sh += 0.07;
    }
  }

  // light: the cone (mostly on the inner face), the grazing sun, the glare near the sun
  float warm = face == 0 ? cone : face == 3 ? cone * 0.35 : 0.0;
  sh += warm * (bay ? 0.18 : 0.34) + (block ? warm * 0.12 : 0.0);
  sh += floor(lit * 4.0) / 4.0 * 0.12 + floor(sunN * 3.0) / 3.0 * 0.08;

  // ribs across every deck, every 8 units, with a shadow on one side; lit ribs flare
  float rw = max(1.4, pw);
  float rbw = fract(al / 8.0) * 8.0 * unit;
  if (rbw < rw) sh += 0.06 + 0.3 * warm + 0.12 * sunN;
  else if (rbw < rw + pw * 1.6) sh -= 0.05;
  // grooves between decks, each with a bevel on its far side that catches light
  for (int i = 0; i < 4; i++) {
    float de = (acr - E[i]) * acrW;
    if (abs(de) < pw * 0.75) sh = 0.02 + warm * 0.1;
    else if (de > 0.0 && de < pw * 1.9) sh += 0.05 + 0.4 * warm + 0.12 * sunN;
  }

  // edges: the inner face's rim against the hole is a hard warm line; the lip where
  // the near side face meets the inner face is lit; the outer corners stay dark
  float e0 = acr * acrW / pw;                     // px from the acr = 0 edge
  float e1 = (1.0 - acr) * acrW / pw;             // px from the acr = 1 edge
  if (face == 0 && e0 < 1.6) sh = max(sh, 0.6 + 0.3 * sunN + 0.2 * warm);
  if (face == 0 && e1 < 1.2) sh = max(sh, 0.34 + 0.3 * warm);
  if (face == 3 && e0 < 2.2) sh = max(sh, (e0 < 1.1 ? 0.5 : 0.36) + 0.3 * sunN + 0.3 * cone);
  if (face >= 2 && e1 < 1.2) sh = min(sh, 0.06);
  if (cut < pw * 2.2) sh = max(sh, 0.7 + 0.25 * sunN);
  else if (cut < pw * 5.0) sh -= 0.04;
  if (back) sh = sh * 0.4;

  // lit window strips: dashes along one deck, in runs, only in shadow
  bool window = false;
  if (!back && warm < 0.1 && sunN < 0.3 && face != 1) {
    float row = face >= 2 ? 0.5 : 0.45;
    if (abs(acr - row) * acrW < 0.8) {
      float run = floor(al / 5.0);
      window = hash2(vec2(run, float(face) + 60.0)) < 0.2 && fract(al * 1.5) < 0.55;
    }
  }

  vec3 wpos = rd * best;
  // haze: a little more on the low arc and with distance, never enough to lift the
  // ring out of its own value family
  float haze = smoothstep(30.0, -4.0, wpos.y) * 0.28 + smoothstep(150.0, 240.0, best) * 0.14;
  float light = floor((sceneLight(s, uDepth) * 0.3 + flashLight(s) * 0.35) * 6.0 + 0.5) / 6.0;
  vec3 c;
  if (window) {
    float tw = uReduced > 0.5 ? 0.0 : step(0.93, vnoise(vec2(tm * 0.2 + floor(al / 5.0) * 7.3, 1.0)));
    c = pal(R_RINGLIGHT, max(0.0, 1.0 - tw - step(0.5, hash2(vec2(floor(al * 1.5), 3.0)))));
    c = applyFog(c, uFog * 0.6, haze * 0.7, p, s);
  } else {
    c = ramp(R_RING, sh + light, p, 0.0);
    c = applyFog(c, uFog, haze * (1.0 - warm * 0.6), p, s);
  }
  return vec4(c, 1.0);
}`;
}

/** Direction from the camera toward the sun (camera space, y up). */
export function sunDir(g: Geo): [number, number, number] {
  const v = [(g.sun[0] - g.W / 2) / g.F, (g.hor - g.sun[1]) / g.F, 1];
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as [number, number, number];
}

/** The sun's light cone on the ring: from the sun, along the shaft, widening. */
export function lightCone(g: Geo): { from: [number, number]; dir: [number, number]; w0: number; spread: number; fadeIn: number } {
  const [ox, oy] = g.sun;
  const dx = g.beamTo[0] - ox;
  const dy = g.beamTo[1] - oy;
  const l = Math.hypot(dx, dy);
  return { from: [ox, oy], dir: [dx / l, dy / l], w0: g.H * 0.09, spread: 0.42, fadeIn: g.H * 0.12 };
}

export interface Chunk {
  x: number;
  y: number;
  hw: number;
  hh: number;
  a: number;
  ax: number;
  ay: number;
  per: number;
}

/** A few big hull blocks drifting beside the break, slowly swinging apart and back. */
export function ringChunks(g: Geo): Chunk[] {
  const gth = gapTheta(g);
  const out: Chunk[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const h = (k: number): number => hashInt(i, k, 907);
    const th = gth + (h(1) - 0.5) * 0.3;
    const rr = RING.R + RING.T * (0.1 + h(2) * 0.9) + (h(3) - 0.3) * 14;
    const [x, y] = ringScreenR(g, th, (h(4) - 0.5) * 0.8, rr);
    const big = i < 2 ? 1.6 : 1;
    out.push({
      x: Math.round(x + (h(5) - 0.5) * 30 * g.u),
      y: Math.round(y + (h(6) - 0.5) * 24 * g.u),
      hw: Math.max(2, Math.round((3 + h(7) * 6) * big * g.u)),
      hh: Math.max(2, Math.round((2 + h(8) * 4) * big * g.u)),
      a: (h(9) - 0.5) * 1.6,
      ax: (2 + h(10) * 5) * g.u,
      ay: (1 + h(11) * 3) * g.u,
      per: 70 + h(12) * 60,
    });
  }
  return out;
}

export function chunksBody(g: Geo, ch: Chunk[]): string {
  const n = ch.length;
  const v4 = (a: number, b: number, c: number, d: number): string => `vec4(${f(a)}, ${f(b)}, ${f(c)}, ${f(d)})`;
  return /* glsl */ `
const vec4 CH[${n}] = vec4[${n}](${ch.map((c) => v4(c.x, c.y, c.hw, c.hh)).join(", ")});
const vec4 CM[${n}] = vec4[${n}](${ch.map((c) => v4(c.a, c.ax, c.ay, c.per)).join(", ")});
const vec2 SUN = ${v2(g.sun[0], g.sun[1])};
bool inChunk(vec2 q, vec4 c) {
  if (abs(q.x) > c.z || abs(q.y) > c.w) return false;
  return q.x + q.y < c.z + c.w - min(c.z, c.w) * 0.9;   // one corner sheared off
}
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.7 * uReduced);
  float sunN = exp(-length(s - SUN) / (uRes.y * 0.22));
  for (int i = 0; i < ${n}; i++) {
    vec4 c = CH[i];
    vec4 m = CM[i];
    float ph = tm * 6.2831853 / m.w + float(i) * 1.7;
    vec2 ctr = c.xy + floor(vec2(m.y * sin(ph), m.z * sin(ph * 0.83 + 1.0)) + 0.5);
    float a = m.x + 0.05 * sin(ph * 0.7);
    mat2 R = mat2(cos(a), sin(a), -sin(a), cos(a));
    vec2 q = R * (p + 0.5 - ctr);
    if (!inChunk(q, c)) continue;
    vec2 ls = R * normalize(SUN - ctr);
    // two faces of the block: the one turned to the sun is a band lighter
    bool litFace = dot(q, ls) > (q.x - q.y) * 0.35 * sign(ls.x - ls.y + 0.001);
    float sh = litFace ? 0.24 + 0.2 * sunN : 0.09;
    sh += (hash2(vec2(floor((q.x + c.z) / 4.0), float(i))) - 0.5) * 0.04;
    if (abs(q.y + c.w * 0.2) < 0.6) sh -= 0.06;                  // a seam across the block
    if (!inChunk(q + ls * 2.2, c)) sh = 0.62 + 0.3 * sunN;         // hard lit edge toward the sun
    else if (!inChunk(q - ls * 1.5, c)) sh = 0.02;                 // and a dark one away from it
    vec3 col = ramp(R_RING, sh + flashLight(s) * 0.4, p, 0.0);
    col = applyFog(col, uFog, 0.0, p, s);
    return vec4(col, 1.0);
  }
  return vec4(0.0);
}`;
}

export function chunksBounds(ch: Chunk[]): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const c of ch) {
    const r = Math.hypot(c.hw, c.hh) + 2;
    x0 = Math.min(x0, c.x - r - c.ax);
    x1 = Math.max(x1, c.x + r + c.ax);
    y0 = Math.min(y0, c.y - r - c.ay);
    y1 = Math.max(y1, c.y + r + c.ay);
  }
  return { x0: Math.floor(x0), x1: Math.ceil(x1), y0: Math.floor(y0), y1: Math.ceil(y1) };
}

/** The visible beam, turning warm toward where it lands on the water. */
export function beamBody(g: Geo, alpha: number): string {
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float v = beam(p);
  float lv = stepd(v, 4.0, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  float t = clamp((p.y - ${f(g.beamFrom[1])}) / ${f(g.beamTo[1] - g.beamFrom[1])}, 0.0, 1.0);
  bool warm = t + (bayer4(p) - 0.5) * 0.12 > 0.62;
  vec3 c = warm ? ramp(R_WARM, lv * 0.9, p, 0.0) : ramp(R_BEAM, lv, p, 0.0);
  return vec4(c, lv * ${f(alpha)});
}`;
}

/** Where the shaft lands: a flat stepped warm pool of light on the water surface. */
export function footBody(g: Geo): string {
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 d = (p - ${v2(g.beamTo[0], g.beamTo[1])}) / vec2(${f(g.H * 0.2)}, ${f(g.H * 0.022)});
  float r = length(d);
  if (r > 1.0) return vec4(0.0);
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float br = 0.85 + 0.15 * vnoise(vec2(tm * 0.35, 4.0));
  float g = stepd(pow(1.0 - r, 1.6) * br, 3.0, p, 0.7);
  if (g <= 0.0) return vec4(0.0);
  return vec4(ramp(R_WARM, g, p, 0.0), g * 0.28);
}`;
}


/** Local angle of the ring's lowest visible point (bottom of the arc on screen). */
export function lowestTheta(g: Geo): number {
  let best = 0;
  let by = -Infinity;
  for (let i = 0; i < 360; i++) {
    const th = (i / 360) * Math.PI * 2;
    const [sx, sy] = ringScreen(g, th, 0);
    if (sx > 0 && sx < g.W && sy > by) {
      by = sy;
      best = th;
    }
  }
  return best;
}

/** Local angle of the broken section: the point of the band nearest RING.gapAt on screen. */
export function gapTheta(g: Geo): number {
  const [tx, ty] = [RING.gapAt[0] * g.W, RING.gapAt[1] * g.H];
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < 720; i++) {
    const th = (i / 720) * Math.PI * 2;
    const [sx, sy] = ringScreen(g, th, 0);
    const d = Math.hypot(sx - tx, sy - ty);
    if (d < bd) {
      bd = d;
      best = th;
    }
  }
  return best;
}

export function debrisRegion(g: Geo): [number, number, number, number] {
  const th = gapTheta(g);
  const [x0, y0] = ringScreen(g, th - 0.25, 0);
  const [x1, y1] = ringScreen(g, th + 0.25, 0);
  const xs = [x0, x1];
  const ys = [y0, y1];
  return [Math.min(...xs) - 20, Math.min(...ys) - 25, Math.max(...xs) + 20, Math.max(...ys) + 25];
}

/** Glints: on rails of the inner face where the sun's cone lights it, sometimes on the torn ends. */
export function glintPos(g: Geo, rng: () => number): [number, number] {
  const cone = coneCpu(g);
  const low = lowestTheta(g);
  if (rng() < 0.8) {
    for (let i = 0; i < 24; i++) {
      const th = low + (rng() - 0.5) * 1.6;
      const [x, y] = ringScreenR(g, th, (Math.floor(rng() * 5) + 0.5) / 5 - 0.5, RING.R);
      if (y < g.hor - 2 && cone(x, y) > 0.3) return [Math.round(x), Math.round(y)];
    }
  }
  const [x, y] = ringScreen(g, gapTheta(g) + (rng() < 0.5 ? -1 : 1) * (0.17 + rng() * 0.05), rng() - 0.5);
  return [Math.round(x), Math.round(y)];
}

/** CPU copy of ringCone (unstepped). */
export function coneCpu(g: Geo): (x: number, y: number) => number {
  const c = lightCone(g);
  return (x, y) => {
    const qx = x - c.from[0];
    const qy = y - c.from[1];
    const al = qx * c.dir[0] + qy * c.dir[1];
    if (al < 0) return 0;
    const w = c.w0 + al * c.spread;
    const k = Math.abs(qx * c.dir[1] - qy * c.dir[0]) / w;
    return (1 - smooth(0.25, 1, k)) * smooth(0, c.fadeIn, al);
  };
}

export function beaconPos(g: Geo): [number, number] {
  const th = gapTheta(g) - 0.26;
  return ringScreen(g, th, 0.5).map(Math.round) as [number, number];
}

/** CPU copy of the beam's footprint (no streaks) so motes only show inside it. */
export function beamCpu(g: Geo): (x: number, y: number) => number {
  const [ox, oy] = g.beamFrom;
  const [ex, ey] = g.beamTo;
  const L = Math.hypot(ex - ox, ey - oy);
  const dx = (ex - ox) / L;
  const dy = (ey - oy) / L;
  const w0 = g.H * 0.07;
  const w1 = g.H * 0.16;
  return (x, y) => {
    const rx = x - ox;
    const ry = y - oy;
    const a = rx * dx + ry * dy;
    if (a < 0 || a > L) return 0;
    const t = a / L;
    const hw = w0 + (w1 - w0) * t;
    const c = Math.abs(-dy * rx + dx * ry) / hw;
    if (c > 1) return 0;
    return (1 - smooth(0.3, 1, c)) * smooth(0, 0.12, t) * (1 - smooth(0.7, 1, t));
  };
}

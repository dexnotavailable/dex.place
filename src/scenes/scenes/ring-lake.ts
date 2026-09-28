// ring-lake (ref w03): the arrival. A colossal tilted ring, partly cropped, a
// shaft of sun through its hole, still water, mist, dark shores, one small
// figure at the end of a dock. Everything is generated here at runtime; the
// ring is ray-traced per pixel so light, haze and slow rotation act on it live.

import {
  f,
  v2,
  FlashAccents,
  Falling,
  Flock,
  Motes,
  Pix,
  fogBand,
  glow,
  minProfile,
  mist,
  cragProfile,
  rangeProfile,
  shaftFn,
  sky,
  disc,
  smooth,
  terrain,
  fbm1,
  hashInt,
  water,
  type BuildCtx,
  type LayerDef,
  type SceneDef,
} from "../engine/index.ts";

// --- shared geometry --------------------------------------------------------

interface Geo {
  W: number;
  H: number;
  u: number;
  hor: number;
  deck: number;
  /** Waterline under the dock (depth 1). */
  wl: number;
  k1: number;
  waterY: (d: number) => number;
  sun: [number, number];
  sunR: number;
  beamFrom: [number, number];
  beamTo: [number, number];
  figX: number;
  dockEnd: number;
  lantern: [number, number];
  F: number;
}

const SHAFT_DEPTH = 7;
const RING_DEPTH = 34;

function geo(ctx: BuildCtx): Geo {
  const { W, H, u } = ctx;
  const hor = Math.round(H * 0.655);
  const deck = H - Math.round(26 * u);
  const wl = deck + Math.round(13 * u);
  const k1 = (wl - hor + 1) / (H - hor);
  const figX = Math.round(W * 0.47);
  const dockEnd = figX + 40;
  return {
    W,
    H,
    u,
    hor,
    deck,
    wl,
    k1,
    waterY: (d) => Math.round(hor - 1 + ((H - hor) * k1) / d),
    sun: [Math.round(W * 0.63), Math.round(H * 0.19)],
    sunR: Math.round(H * 0.075),
    beamFrom: [W * 0.62, H * 0.22],
    beamTo: [W * 0.44, H * 0.71],
    figX,
    dockEnd,
    lantern: [dockEnd - 4, deck - 34],
    F: H * 0.95,
  };
}

// Ring in camera space: camera at the origin looking down +z, y up. The ring is
// a thick band (inner radius R, radial thickness T, axial width WD) whose axis
// is tipped so its lower-left arc swings away from us: we look down onto that
// arc's inner face, and the upper right (with the break) is the near side.
const RING = { C: [-18, 96, 112] as const, R: 100, T: 22, WD: 80, A: [-0.3, -0.6, -1] as const, gapAt: [0.8, 0.05] as const };

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
function ringScreen(g: Geo, th: number, z: number): [number, number] {
  const { A, B1, B2 } = ringBasis();
  const P = [0, 1, 2].map((i) => RING.C[i]! + RING.R * (Math.cos(th) * B1[i]! + Math.sin(th) * B2[i]!) + z * RING.WD * A[i]!);
  return [g.W / 2 + (P[0]! / P[2]!) * g.F, g.hor - (P[1]! / P[2]!) * g.F];
}

/** Screen position of a ring point at angle th, axial z (-0.5..0.5 of width) and radius r. */
function ringScreenR(g: Geo, th: number, z: number, r: number): [number, number] {
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
function ringBody(g: Geo): string {
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
function sunDir(g: Geo): [number, number, number] {
  const v = [(g.sun[0] - g.W / 2) / g.F, (g.hor - g.sun[1]) / g.F, 1];
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as [number, number, number];
}

/** The sun's light cone on the ring: from the sun, along the shaft, widening. */
function lightCone(g: Geo): { from: [number, number]; dir: [number, number]; w0: number; spread: number; fadeIn: number } {
  const [ox, oy] = g.sun;
  const dx = g.beamTo[0] - ox;
  const dy = g.beamTo[1] - oy;
  const l = Math.hypot(dx, dy);
  return { from: [ox, oy], dir: [dx / l, dy / l], w0: g.H * 0.09, spread: 0.42, fadeIn: g.H * 0.12 };
}

interface Chunk {
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
function ringChunks(g: Geo): Chunk[] {
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

function chunksBody(g: Geo, ch: Chunk[]): string {
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

function chunksBounds(ch: Chunk[]): { x0: number; x1: number; y0: number; y1: number } {
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
function beamBody(g: Geo, alpha: number): string {
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
function footBody(g: Geo): string {
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

// --- the scene ----------------------------------------------------------------

const scene: SceneDef = {
  title: "ring-lake",
  palette: {
    ring: ["#0a1014", "#111a1f", "#19252a", "#253338", "#46504a", "#9a8458", "#e0bf7c"],
    ringlight: ["#7c5a32", "#c99a5a", "#f5dca2"],
    warm: ["#5f5540", "#a88f60", "#efd8a2"],
    sun: ["#d8cca2", "#efe5c3", "#fbf5e2"],
    haze: ["#46605f", "#5f7a77", "#809893", "#aebaa6", "#e2d8b2"],
    far: ["#3a5253", "#465f5f", "#557070", "#68827e"],
    mid: ["#18232a", "#22313a", "#2f4146", "#445856", "#6f7563"],
    near: ["#090e11", "#0f161a", "#172126", "#24323a", "#4b5550"],
    cliff: ["#080d10", "#10181c", "#1b272c", "#2f3f3e", "#56604f"],
    water: ["#12272a", "#19383a", "#224c4b", "#2d625e", "#468479"],
    glint: ["#6c9c92", "#b2d2c2", "#f2ecd0"],
    wood: ["#0a0d0f", "#12171a", "#1e2427", "#343b39"],
    beam: ["#5f624a", "#9a9168", "#d7c795", "#fbeec2"],
    lamp: ["#6d3f1c", "#c7803a", "#ffd494"],
    bird: ["#1c2628", "#2a3739"],
    standin: ["#06080a", "#0d1216", "#26303a", "#bba77a"],
  },
  fog: {
    stops: [
      [0.0, "#152126"],
      [0.18, "#233439"],
      [0.42, "#46605f"],
      [0.6, "#7b928b"],
      [0.66, "#8ea197"],
      [0.72, "#6a817b"],
      [1.0, "#3f5754"],
    ],
    bands: 12,
    // flat bands with a dithered seam between them, not a screen door across the whole sky
    dither: 0.55,
    density: 0.11,
    max: 0.8,
    glow: { x: 0.63, y: 0.19, r: 0.62, colour: "#e5d9ae", strength: 0.5, steps: 4, dither: 0.14 },
  },
  span: (W) => Math.round(W * 0.45),
  driftPeriod: 90,

  prelude: (ctx) => {
    const g = geo(ctx);
    return /* glsl */ `
${shaftFn({
  fn: "beam",
  from: g.beamFrom,
  to: g.beamTo,
  w0: ctx.H * 0.07,
  w1: ctx.H * 0.16,
  streaks: 9,
  speed: 0.04,
  fadeStart: 0.72,
  intensity: 1.0,
  // the body pans at depth 7, but its top stays on the sun (sky depth)
  fromShiftX: `layerOff(${f(SHAFT_DEPTH)})`,
})}
float sceneLight(vec2 s, float depth) {
  float b = beam(s + vec2(layerOff(${f(SHAFT_DEPTH)}), 0.0));
  float l = b * smoothstep(2.2, 6.0, depth) * 0.42;
  // the lantern at the end of the dock lights things near the player plane
  vec2 lp = vec2(${f(g.lantern[0])} - layerOff(1.0), ${f(g.lantern[1] + 3)});
  float ld = length((s - lp) * vec2(1.0, 1.25)) / ${f(30 * ctx.u)};
  l += (1.0 - smoothstep(0.8, 3.0, depth)) * floor(max(0.0, 1.0 - ld) * 3.0) / 3.0 * 0.2;
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

    // sky, sun, high cloud
    L.push(sky({ reflect: hor }));
    L.push(disc({ name: "sun", x: g.sun[0], y: g.sun[1], r: g.sunR, row: "sun", halo: { r: 2.4, strength: 0.45, steps: 4, seam: 0.18 }, reflect: hor, dither: 0.3 }));
    L.push(
      mist({
        name: "high-cloud",
        depth: 90,
        y0: -10,
        y1: H * 0.42,
        sx: 260 * u,
        sy: 16 * u,
        drift: -4,
        evolve: 0.08,
        cover: 0.5,
        warp: 1.6,
        levels: 3,
        alpha: 0.6,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.35,
        tonePerLevel: 0.14,
        tint: 0.55,
        lightGain: 0.3,
        reflect: hor,
      }),
    );

    // the ring
    L.push({ kind: "glsl", name: "ring", depth: RING_DEPTH, fog: 0.05, body: ringBody(g), reflect: hor, bounds: { y0: -1e6, y1: hor + 1 } });
    // big torn hull blocks hanging beside the break
    const chunks = ringChunks(g);
    L.push({ kind: "glsl", name: "ring-chunks", depth: RING_DEPTH, fog: 0.14, body: chunksBody(g, chunks), bounds: chunksBounds(chunks), reflect: hor });
    // cloud masses drifting across the sun and veiling the upper ring: slow, but
    // they visibly grow, split and thin out
    L.push(
      mist({
        name: "veil",
        depth: 30,
        y0: -12,
        y1: H * 0.46,
        softTop: 4,
        sx: 150 * u,
        sy: 34 * u,
        drift: -5,
        evolve: 0.1,
        cover: 0.52,
        warp: 1.7,
        levels: 3,
        alpha: 0.55,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.2,
        tonePerLevel: 0.18,
        tint: 0.55,
        lightGain: 0.4,
        reflect: hor,
      }),
    );

    // clouds drifting in front of the ring's lower arc
    L.push(
      mist({
        name: "ring-cloud",
        depth: 26,
        y0: H * 0.4,
        y1: hor + 2,
        sx: 190 * u,
        sy: 13 * u,
        drift: -6,
        evolve: 0.035,
        cover: 0.3,
        warp: 2.2,
        levels: 3,
        alpha: 0.55,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.3,
        tonePerLevel: 0.16,
        tint: 0.5,
        lightGain: 0.8,
        reflect: hor,
      }),
    );
    // floating pieces near the break, drifting apart very slowly
    L.push({
      kind: "points",
      name: "ring-debris",
      depth: RING_DEPTH,
      fog: 0.3,
      reflect: hor,
      system: new Motes(
        {
          region: debrisRegion(g),
          count: Math.round(12 * u),
          row: R("ring"),
          shade: [0.12, 0.3],
          vel: [0.25, -0.12],
          wander: 0.25,
          size: 2,
          twinkle: 0,
        },
        ctx.rng,
      ),
    });
    // specks falling off the lower arc into the haze
    const [fx, fy] = ringScreen(g, lowestTheta(g), 0);
    L.push({
      kind: "points",
      name: "ring-falling",
      depth: RING_DEPTH,
      fog: 0.35,
      system: new Falling({ source: [fx - 120 * u, fy - 30 * u, fx + 60 * u, fy], floor: hor, every: 7, speed: 3.2 * u, drift: 0.3, row: R("ring"), shade: 0.15, max: 5 }),
    });
    // glints where the sun catches rails on the lit inner arc; a slow beacon at the break
    L.push({
      kind: "points",
      name: "ring-glints",
      depth: RING_DEPTH,
      fog: 0.1,
      blend: "add",
      system: new FlashAccents([
        {
          kind: "glint",
          rate: 9,
          at: (rng) => glintPos(g, rng),
          size: [5, 9],
          row: R("ringlight"),
          shade: 0.99,
          duration: [0.3, 0.7],
        },
        {
          kind: "glow",
          rate: 5,
          at: () => beaconPos(g),
          size: 5,
          row: R("lamp"),
          shade: 0.7,
          duration: [0.9, 1.4],
          intensity: 0.8,
        },
      ]),
    });

    // the water
    const posts = dockPosts(g);
    L.push(
      water({
        horizon: hor,
        dNear: g.k1,
        dFar: 60,
        row: "water",
        glintRow: "glint",
        reflFar: 0.9,
        reflNear: 0.38,
        rippleAmp: 3 * u,
        rippleSpeed: 0.8,
        // sparse sparkles on open water, a clear warm path where the shaft lands
        glints: 0.004,
        pool: { x: g.beamTo[0], w: W * 0.055, strength: 0.45, depth: SHAFT_DEPTH, row: "warm", path: 0.35 },
        waterDither: 0.5,
        rings: posts.slice(-2).map((px) => [px + 1, g.wl]),
      }),
    );

    // haze bank along the horizon, behind the far hills
    L.push(
      fogBand({
        name: "horizon-haze",
        depth: 16,
        y0: hor - H * 0.1,
        y1: hor + 3,
        softBottom: 1,
        sx: 170 * u,
        sy: 9 * u,
        drift: -3,
        cover: 0.7,
        alpha: 0.75,
        row: "haze",
        tone: 0.45,
        tint: 0.3,
        lightGain: 1,
        reflect: hor,
      }),
    );

    // far hills, both sides of the open water
    {
      const d = 10;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 1 - 0;
      const left = rangeProfile({ base: hor, amp: H * 0.13, scale: 70 * u, seed: 11, sharp: 0.45 });
      const right = rangeProfile({ base: hor, amp: H * 0.2, scale: 90 * u, seed: 12, sharp: 0.5 });
      const top = (px: number): number => {
        const X = px + x;
        const lm = smooth(W * 0.36, W * 0.18, X);
        const rm = smooth(W * 0.56, W * 0.8, X);
        const t = Math.min(hor + 2 - (hor - left(X)) * lm, hor + 2 - (hor - right(X)) * rm);
        return t;
      };
      terrain(pix, {
        row: R("far"),
        top,
        bottom: () => base,
        seed: 21,
        scale: 26 * u,
        light: [0.6, -1],
        base: 0.45,
        contrast: 0.35,
        strata: 0.2,
        fog: (px, py) => 0.15 + 0.5 * smooth(hor - H * 0.1, base, py) + 0 * px,
      });
      L.push({ kind: "pix", name: "far-hills", depth: d, pix, x, y: 0, reflect: base, dither: 0.3 });
    }

    // the light shaft (and its reflection), with motes inside it
    L.push({
      kind: "glsl",
      name: "shaft",
      depth: SHAFT_DEPTH,
      fog: 0,
      blend: "add",
      reflect: hor,
      body: beamBody(g, 0.2),
      bounds: { x0: g.beamTo[0] - H * 0.2, x1: g.beamFrom[0] + H * 0.12 + ctx.span / SHAFT_DEPTH, y0: g.beamFrom[1] - H * 0.08, y1: g.beamTo[1] + 2 },
    });
    L.push({
      kind: "glsl",
      name: "shaft-foot",
      depth: SHAFT_DEPTH,
      fog: 0,
      blend: "add",
      body: footBody(g),
      bounds: { x0: g.beamTo[0] - H * 0.21, x1: g.beamTo[0] + H * 0.21, y0: g.beamTo[1] - H * 0.03, y1: g.beamTo[1] + H * 0.03 },
    });
    L.push({
      kind: "points",
      name: "beam-motes",
      depth: SHAFT_DEPTH,
      fog: 0,
      blend: "add",
      system: new Motes(
        {
          region: [W * 0.36, H * 0.25, W * 0.72, hor],
          count: Math.round(140 * u),
          row: R("beam"),
          shade: [0.45, 0.99],
          vel: [-1.2, 1.4],
          wander: 2.5,
          size: 1,
          twinkle: 0.35,
          visible: beamCpu(g),
        },
        ctx.rng,
      ),
    });

    // mid rocks: a leaning spire on the left, stepped cliffs on the right
    {
      const d = 4.6;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 2;
      const spire = cragProfile({ cx: W * 0.2, top: H * 0.24, base, left: W * 0.085, right: W * 0.08, seed: 31, ledges: 2, rough: 0.05, power: 1.7 });
      const shoulder = cragProfile({ cx: W * 0.09, top: H * 0.43, base, left: W * 0.2, right: W * 0.12, seed: 32, ledges: 2, rough: 0.07, power: 1.5 });
      const slope = rangeProfile({ base: base - 2, amp: H * 0.12, scale: 50 * u, seed: 33 });
      // a talus foot runs from the spire's right flank down into the water, so the crag
      // tapers to the waterline instead of ending in a sheer cut
      const talus = (X: number): number => {
        if (X < W * 0.17 || X > W * 0.42) return 1e9;
        const k = Math.pow(1 - smooth(W * 0.22, W * 0.42, X), 1.3);
        return base - H * 0.22 * k - (fbm1(X / (7 * u), 35) - 0.5) * 6 * u * k;
      };
      const leftTop = minProfile(spire, shoulder, talus, (X) => (X < W * 0.05 ? slope(X) : 1e9));
      terrain(pix, {
        row: R("mid"),
        top: (px) => leftTop(px + x),
        bottom: () => base,
        seed: 34,
        scale: 22 * u,
        light: [1, -0.6],
        base: 0.17,
        contrast: 0.36,
        vertical: 0.12,
        strata: 0.3,
        rim: 0.12,
        rimDepth: 2,
        ao: 0.1,
      });
      // dark core, a lit flank toward the sun, ledges; the haze lives in the air at
      // its foot (base-fog), not in the rock
      flankPlanes(pix, x, g, { dir: 1, c: 1, ledges: [0.36, 0.45, 0.53], seed: 36 });
      L.push({ kind: "pix", name: "mid-left", depth: d, pix, x, y: 0, fog: 0.06, reflect: base, dither: 0.2 });
    }
    {
      const d = 3.4;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 2;
      const cliff = (X: number): number => {
        const m = smooth(W * 0.7, W * 0.8, X);
        const crest = H * 0.4 + (fbm1(X / (40 * u), 41) - 0.5) * H * 0.08 + Math.floor(fbm1(X / (14 * u), 42) * 4) * 4 * u;
        const foot = X > W * 0.6 && X < W * 0.8 ? base - H * 0.08 * Math.pow(smooth(W * 0.6, W * 0.76, X), 1.4) - (fbm1(X / (6 * u), 44) - 0.5) * 4 * u : 1e9;
        return Math.min(foot, m <= 0.01 ? 1e9 : base - (base - crest) * m);
      };
      terrain(pix, {
        row: R("mid"),
        top: (px) => cliff(px + x),
        bottom: () => base,
        seed: 43,
        scale: 20 * u,
        light: [-1, -0.5],
        base: 0.15,
        contrast: 0.36,
        vertical: 0.15,
        strata: 0.35,
        rim: 0.12,
        rimDepth: 2,
        ao: 0.1,
      });
      flankPlanes(pix, x, g, { dir: -1, c: 1, ledges: [0.46, 0.53, 0.59], seed: 46 });
      L.push({ kind: "pix", name: "mid-right", depth: d, pix, x, y: 0, fog: 0.05, reflect: base, dither: 0.2 });
    }

    // low mist lying on the water
    L.push(
      mist({
        name: "water-mist",
        depth: 3,
        y0: hor - 12 * u,
        y1: hor + 34 * u,
        sx: 110 * u,
        sy: 6 * u,
        drift: 6,
        evolve: 0.06,
        cover: 0.4,
        warp: 1.8,
        levels: 3,
        alpha: 0.78,
        edgeDither: 0.35,
        row: "haze",
        tone: 0.42,
        tonePerLevel: 0.17,
        tint: 0.5,
        lightGain: 1.2,
      }),
    );

    // the big dark cliff on the right, cropped by the frame
    {
      const d = 1.8;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 3;
      const face = (X: number): number => {
        const e = W * 0.87 + (fbm1(X / 30, 51) - 0.5) * 20 * u;
        if (X < e - W * 0.05) return 1e9;
        const t = smooth(e - W * 0.05, e + W * 0.07, X);
        return base - (base + H * 0.15) * t + (fbm1(X / (9 * u), 52) - 0.5) * 12 * u;
      };
      terrain(pix, {
        row: R("cliff"),
        top: (px) => face(px + x),
        bottom: () => base,
        seed: 53,
        scale: 16 * u,
        chunk: 2,
        light: [-1, -0.3],
        base: 0.2,
        contrast: 0.35,
        vertical: 0.35,
        strata: 0.1,
        rim: 0.3,
        rimDepth: 3,
        ao: 0.2,
      });
      cliffPlanes(pix, x, g, 2);
      cliffReflection(pix, base, R("cliff"), 83, g.u);
      L.push({ kind: "pix", name: "near-right", depth: d, pix, x, y: 0, reflect: base, dither: 0.15 });
    }
    // low rocks on the left shore where the dock starts
    {
      const d = 1.3;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const base = g.waterY(d) + 3;
      const shore = rangeProfile({ base, amp: H * 0.17, scale: 34 * u, seed: 61, sharp: 0.6, detail: 5 * u });
      const top = (X: number): number => {
        const m = smooth(W * 0.28, W * 0.08, X);
        return m <= 0.01 ? 1e9 : base - (base - shore(X)) * m;
      };
      terrain(pix, {
        row: R("near"),
        top: (px) => top(px + x),
        bottom: () => base,
        seed: 62,
        scale: 14 * u,
        chunk: 2,
        light: [1, -0.8],
        base: 0.34,
        contrast: 0.55,
        rim: 0.3,
        rimDepth: 3,
        ao: 0.2,
      });
      L.push({ kind: "pix", name: "near-left", depth: d, pix, x, y: 0, reflect: base, dither: 0.2 });
    }

    // the dock, its lantern, the figure
    {
      const { x, w } = wide(1);
      const pix = new Pix(w, H);
      buildDock(pix, g, x, R("wood"), R("lamp"), posts);
      L.push({ kind: "pix", name: "dock", depth: 1, pix, x, y: 0, reflect: g.wl, dither: 0 });
    }
    L.push(glow({ name: "lantern-glow", depth: 1, x: g.lantern[0], y: g.lantern[1] + 3, r: 22 * u, row: "lamp", flicker: 0.2, alpha: 0.5, reflect: g.wl }));
    L.push({ kind: "character", name: "figure", depth: 1, x: g.figX, ground: g.deck, rimDir: [1, -1], reflect: g.wl });

    // birds, far out over the water
    L.push({
      kind: "points",
      name: "birds",
      depth: 12,
      system: new Flock({ y: [H * 0.3, H * 0.45], x: [-40, W + 40], every: 38, speed: 16 * u, count: [3, 6], row: R("bird"), shade: 0.2 }),
    });

    // foreground: dark rocks in the bottom corners, moving faster than the camera
    {
      const d = 0.72;
      const { x, w } = wide(d);
      const pix = new Pix(w, H);
      const lr = rangeProfile({ base: H + 4, amp: H * 0.16, scale: 60 * u, seed: 71, sharp: 0.35 });
      const top = (X: number): number => {
        const m = Math.max(smooth(W * 0.16, -W * 0.02, X), smooth(W * 0.86, W * 1.05, X));
        return m <= 0.02 ? 1e9 : H + 4 - (H + 4 - lr(X)) * m;
      };
      terrain(pix, {
        row: R("near"),
        top: (px) => top(px + x),
        seed: 72,
        scale: 12 * u,
        chunk: 3,
        light: [0.4, -1],
        base: 0.14,
        contrast: 0.3,
        rim: 0.2,
        rimDepth: 3,
      });
      L.push({ kind: "pix", name: "foreground", depth: d, pix, x, y: 0, dither: 0 });
    }
    return L;
  },
};

export default scene;

// --- helpers -----------------------------------------------------------------

/** Local angle of the ring's lowest visible point (bottom of the arc on screen). */
function lowestTheta(g: Geo): number {
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
function gapTheta(g: Geo): number {
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

function debrisRegion(g: Geo): [number, number, number, number] {
  const th = gapTheta(g);
  const [x0, y0] = ringScreen(g, th - 0.25, 0);
  const [x1, y1] = ringScreen(g, th + 0.25, 0);
  const xs = [x0, x1];
  const ys = [y0, y1];
  return [Math.min(...xs) - 20, Math.min(...ys) - 25, Math.max(...xs) + 20, Math.max(...ys) + 25];
}

/** Glints: on rails of the inner face where the sun's cone lights it, sometimes on the torn ends. */
function glintPos(g: Geo, rng: () => number): [number, number] {
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
function coneCpu(g: Geo): (x: number, y: number) => number {
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

function beaconPos(g: Geo): [number, number] {
  const th = gapTheta(g) - 0.26;
  return ringScreen(g, th, 0.5).map(Math.round) as [number, number];
}

/** CPU copy of the beam's footprint (no streaks) so motes only show inside it. */
function beamCpu(g: Geo): (x: number, y: number) => number {
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

/**
 * Big planes on the near-right cliff: a lit face turned toward the shaft along its
 * left edge, a half-lit plane behind it, then shadow; three ledges with lit tops
 * and dark undersides. Works per chunk cell so the rock stays chunky.
 */
function cliffPlanes(pix: Pix, x0: number, g: Geo, c: number): void {
  const { W, H, u } = g;
  const ledges = [
    { y: H * 0.3, x1: W * 0.99, slope: 0.1 },
    { y: H * 0.47, x1: W * 1.02, slope: 0.16 },
    { y: H * 0.62, x1: W * 0.97, slope: 0.08 },
  ];
  for (let y = 0; y < pix.h; y += c) {
    let ex = -1;
    for (let x = 0; x < pix.w; x++)
      if (pix.solid(x, y)) {
        ex = x;
        break;
      }
    if (ex < 0) continue;
    for (let x = ex; x < pix.w; x += c) {
      if (!pix.solid(x, y)) continue;
      const X = x + x0;
      // facet boundaries lean with height, so the planes read as slabs, not stripes
      const dd = x - ex - (pix.h - y) * 0.06;
      let add = x - ex < 3 * u ? 0.5 : dd < 14 * u ? 0.3 : dd < 38 * u ? 0.14 : dd < 60 * u ? 0.05 : 0;
      for (const l of ledges) {
        if (X > l.x1) continue;
        const ly = l.y + (X - W * 0.85) * l.slope;
        const dy = y - ly;
        if (dy >= 0 && dy < 2 * u) add += Math.max(0.14, 0.4 - Math.max(0, dd) * 0.003);
        else if (dy >= 2 * u && dy < 7 * u) add -= 0.08;
      }
      for (let yy = y; yy < Math.min(pix.h, y + c); yy++)
        for (let xx = x; xx < Math.min(pix.w, x + c); xx++) if (pix.solid(xx, yy)) pix.setShade(xx, yy, pix.shadeAt(xx, yy) + add);
    }
  }
}

/**
 * Planes on a mid rock: a lit rim and a half-lit plane on the flank toward the
 * sun (dir 1: the right edge, -1: the left edge), a shadow core behind, and a few
 * ledges with lit tops and dark undersides that break the vertical streaks.
 */
function flankPlanes(pix: Pix, x0: number, g: Geo, o: { dir: 1 | -1; c: number; ledges: number[]; seed: number }): void {
  const { H, u } = g;
  for (let y = 0; y < pix.h; y++) {
    let ex = -1;
    if (o.dir > 0) {
      for (let x = pix.w - 1; x >= 0; x--)
        if (pix.solid(x, y)) {
          ex = x;
          break;
        }
    } else {
      for (let x = 0; x < pix.w; x++)
        if (pix.solid(x, y)) {
          ex = x;
          break;
        }
    }
    if (ex < 0) continue;
    for (let k = 0; k < pix.w; k++) {
      const x = ex - o.dir * k;
      if (x < 0 || x >= pix.w) break;
      if (!pix.solid(x, y)) continue;
      // facet edges lean and wobble, so planes read as slabs
      const dd = k - (pix.h - y) * 0.05 + (fbm1((y + x0) / (9 * u), o.seed) - 0.5) * 6 * u;
      let add = k < 2 ? 0.36 : dd < 7 * u ? 0.18 : dd < 18 * u ? 0.07 : -0.03;
      for (const [i, f] of o.ledges.entries()) {
        const ly = H * f + (fbm1((x + x0) / (20 * u), o.seed + i) - 0.5) * 8 * u + (x + x0) * 0.04 * (i % 2 ? 1 : -1);
        const dy = y - ly;
        if (dy >= 0 && dy < 1.5) add += dd < 18 * u ? 0.22 : 0.1;
        else if (dy >= 1.5 && dy < 5 * u) add -= 0.07;
      }
      pix.setShade(x, y, pix.shadeAt(x, y) + add);
    }
  }
}

/**
 * A short, dark, broken reflection under a rock that stands in the water: rows of
 * streaks that wobble sideways and break up more with distance from the rock.
 */
function cliffReflection(pix: Pix, base: number, row: number, seed: number, u: number): void {
  const len = Math.round(16 * u);
  for (let x = 0; x < pix.w; x++) {
    if (!pix.solid(x, base - 1)) continue;
    const l = Math.round(len * (0.55 + 0.45 * fbm1(x / (12 * u), seed)));
    for (let k = 0; k < l; k++) {
      const y = base + k;
      if (y >= pix.h) break;
      const t = k / l;
      const shift = Math.round(Math.sin(k * 1.7 + seed) * (1 + t * 2));
      const seg = Math.floor((x + shift) / (3 + (k % 3)));
      if (hashInt(seg, k, seed) < 0.15 + t * 0.7) continue;
      if (!pix.solid(x + shift, base - 1)) continue;
      pix.set(x, y, 0.1 - t * 0.06, row);
    }
  }
}

function dockPosts(g: Geo): number[] {
  const out: number[] = [];
  for (let px = g.dockEnd - 3; px > -g.W; px -= Math.round(38 * g.u)) out.push(px);
  return out.reverse();
}

function buildDock(pix: Pix, g: Geo, x0: number, wood: number, lamp: number, posts: number[]): void {
  const X = (x: number): number => x - x0;
  const { deck, wl, u } = g;
  const start = -g.W;
  const th = Math.max(3, Math.round(4 * u));
  // deck planks: a lit top edge, seams, slight per-plank shade
  for (let x = start; x <= g.dockEnd; x++) {
    const plank = Math.floor((x + 1000) / 7);
    const sh = 0.28 + (hashInt(plank, 1, 9) - 0.5) * 0.1;
    for (let y = deck; y < deck + th; y++) {
      let s = y === deck ? 0.9 : sh - (y - deck) * 0.05;
      if ((x + 1000) % 7 === 0 && y > deck) s -= 0.1;
      pix.set(X(x), y, s, wood);
    }
    // stringer under the planks
    pix.set(X(x), deck + th, 0.12, wood);
  }
  // posts into the water, with a darker wet band at the waterline
  for (const px of posts) {
    for (let y = deck + th; y <= wl + 1; y++)
      for (let k = 0; k < 3; k++) pix.set(X(px + k), y, k === 0 ? 0.3 : 0.14 - (y > wl - 3 ? 0.08 : 0), wood);
  }
  // the end post rises above the deck and holds a lantern on a short arm
  const ep = g.dockEnd - 3;
  for (let y = g.lantern[1] - 2; y < deck; y++) for (let k = 0; k < 2; k++) pix.set(X(ep + k), y, k === 0 ? 0.36 : 0.16, wood);
  const [lx, ly] = g.lantern;
  for (let x = ep - 4; x <= ep; x++) pix.set(X(x), ly - 2, 0.3, wood);
  // lantern: cap, glass with a lit core, base
  pix.rect(X(lx - 2), ly - 1, 5, 1, { row: wood, shade: 0.35 });
  pix.rect(X(lx - 2), ly, 5, 6, { row: wood, shade: 0.2 });
  pix.rect(X(lx - 1), ly + 1, 3, 4, { row: lamp, shade: 0.8, emissive: true });
  pix.set(X(lx), ly + 2, 1, lamp, 0, true);
  pix.rect(X(lx - 2), ly + 6, 5, 1, { row: wood, shade: 0.3 });
  // a coil of rope on the deck near the end, for scale
  pix.rect(X(g.dockEnd - 20), deck - 2, 7, 2, { row: wood, shade: 0.24 });
  pix.rect(X(g.dockEnd - 19), deck - 3, 5, 1, { row: wood, shade: 0.4 });
}

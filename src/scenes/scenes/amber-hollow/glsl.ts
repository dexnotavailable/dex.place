// GLSL for amber-hollow: the shared prelude (furnace light, the ship's headlight
// cone, the deck lamp, sign flicker) and the per-pixel layer bodies: far cliff,
// the wall with its octagonal openings, cranes, searchlights, furnace glow,
// steam plumes, signs, and the ship itself. Everything is evaluated per whole
// pixel and snapped to ramps; motion is whole-pixel (floored) or stepped.

import { f, v2, rowRef } from "../../engine/index.ts";
import { D, type Geo, type Opening } from "./geo.ts";
import type { ShipSprite } from "./ship.ts";

const arr = (type: string, items: string[]): string => `${type}[${items.length}](${items.join(", ")})`;
const v3 = (a: number, b: number, c: number): string => `vec3(${f(a)}, ${f(b)}, ${f(c)})`;
const v4 = (a: number, b: number, c: number, d: number): string => `vec4(${f(a)}, ${f(b)}, ${f(c)}, ${f(d)})`;

// --- ship timing (shared by prelude and layers) -------------------------------

export interface ShipLane {
  x0: number;
  v: number;
  period: number;
  offset: number;
}

export function shipLane(g: Geo, ctx: { panWidth(d: number): number }, _sp?: ShipSprite): ShipLane {
  const half = (ctx.panWidth(D.ship) - g.W) / 2;
  const x0 = g.W + half + 20;
  const v = 17 * g.u;
  return { x0, v, period: 74, offset: 38 };
}

export interface Sign {
  x: number;
  y: number;
  w: number;
  h: number;
  row: string;
  period: number;
  offset: number;
  vertical: boolean;
}

// --- prelude ------------------------------------------------------------------

export function prelude(g: Geo, sp: ShipSprite, lane: ShipLane, nearSign: Sign): string {
  const { u } = g;
  const pits = g.pits.map(([x, y, w]) => v3(x, y, w));
  return /* glsl */ `
const float U = ${f(u)};
const vec3 PITS[${pits.length}] = ${arr("vec3", pits)};
const vec2 PITR = ${v2(g.pitR[0], g.pitR[1])};
float pitFlick(float i) {
  float tm = uTime * (1.0 - 0.7 * uReduced);
  return 0.78 + 0.22 * floor(vnoise(vec2(tm * 0.55 + i * 13.1, i * 3.7)) * 3.0) / 3.0;
}
// furnace light at layer point p (depth ${D.pits} coordinates)
float pitLight(vec2 p) {
  float l = 0.0;
  for (int i = 0; i < ${pits.length}; i++) {
    vec2 d = (p - PITS[i].xy) / (PITR * 1.6);
    float r = length(d);
    if (r >= 1.0) continue;
    l += PITS[i].z * pitFlick(float(i)) * (1.0 - r) * (1.0 - r);
  }
  return l;
}

const float SHIP_X0 = ${f(lane.x0)};
const float SHIP_V = ${f(lane.v)};
const float SHIP_P = ${f(lane.period)};
const float SHIP_OFF = ${f(lane.offset)};
const float SHIP_Y = ${f(g.shipY)};
const vec2 SHIP_SIZE = ${v2(sp.w, sp.h)};
const vec2 NOSE = ${v2(sp.nose[0], sp.nose[1])};
const float CONE_L = ${f(210 * u)};
float shipTime() { return uTime * (1.0 - 0.4 * uReduced); }
// top-left of the ship sprite in layer px at depth ${D.ship}
vec2 shipPos() {
  float t = mod(shipTime() + SHIP_OFF, SHIP_P);
  return vec2(floor(SHIP_X0 - t * SHIP_V + 0.5), SHIP_Y + floor(sin(shipTime() * 0.31) * 1.5 + 0.5));
}
// headlight cone field 0..1 at layer point p (depth ${D.ship}), axis ahead and a little down
float shipCone(vec2 p, out float across, out float along) {
  vec2 d = p - (shipPos() + NOSE);
  along = -d.x;
  across = 2.0;
  if (along <= 0.0 || along > CONE_L) return 0.0;
  float y = d.y - along * 0.2;
  float hw = 2.0 * U + along * 0.2;
  across = y / hw;
  if (abs(across) > 1.0) return 0.0;
  return pow(1.0 - along / CONE_L, 1.5) * (1.0 - smoothstep(0.3, 1.0, abs(across)));
}

float signLevel(float per, float off) {
  if (uReduced > 0.5) return 1.0;
  float l = mod(uTime + off, per);
  if (l < 0.22) return 0.3;
  if (l < 0.44) return 1.0;
  if (l < 0.62) return 0.3;
  return 1.0;
}

float sceneLight(vec2 s, float depth) {
  float l = 0.0;
  // the furnaces light everything around their depth, most strongly from below
  float fd = smoothstep(2.4, 4.2, depth) * (1.0 - smoothstep(12.0, 26.0, depth));
  if (fd > 0.0) l += pitLight(vec2(s.x + layerOff(${f(D.pits)}), s.y)) * fd * 0.5;
  // the ship's headlights sweep across the haze and whatever they touch
  float sd = smoothstep(2.4, 3.6, depth) * (1.0 - smoothstep(8.0, 14.0, depth));
  if (sd > 0.0) {
    float ac, al;
    l += shipCone(vec2(s.x + layerOff(${f(D.ship)}), s.y), ac, al) * sd * 0.55;
  }
  // the deck lamp by the figure
  float ld = (1.0 - smoothstep(0.9, 1.8, depth));
  if (ld > 0.0) {
    vec2 lp = vec2(${f(g.lamp[0] + 1)} - layerOff(1.0), ${f(g.lamp[1] + 4)});
    float r = length((s - lp) * vec2(1.0, 0.8)) / 64.0;
    l += ld * floor(max(0.0, 1.0 - r) * 4.0) / 4.0 * 0.32;
  }
  // the big sign on the foundry block washes its wall
  float nd = smoothstep(2.4, 2.9, depth) * (1.0 - smoothstep(3.6, 4.4, depth));
  if (nd > 0.0) {
    vec2 c = vec2(${f(nearSign.x + nearSign.w / 2)} - layerOff(${f(D.near)}), ${f(nearSign.y + nearSign.h / 2)});
    float r = length((s - c) / vec2(${f(nearSign.w * 2.2 + 16 * u)}, ${f(nearSign.h * 0.9 + 10 * u)}));
    l += nd * floor(max(0.0, 1.0 - r) * 3.0) / 3.0 * 0.3 * signLevel(${f(nearSign.period)}, ${f(nearSign.offset)});
  }
  return l;
}`;
}

const octa = (name: string, o: Opening): string => /* glsl */ `
float ${name}(vec2 p) {
  vec2 q = abs(p - ${v2(o.cx, o.cy)});
  return max(max(q.x - ${f(o.ax)}, q.y - ${f(o.ay)}), (q.x + q.y - ${f(o.ax + o.ay - o.ch)}) * 0.7071);
}`;

// --- far cliff: the bright rock face seen through the openings ------------------

export function cliffBody(g: Geo): string {
  const { u } = g;
  // strata dip down to the right; N is across them (each fault block rotates it)
  const tl = Math.hypot(1, 0.72);
  const N = [-0.72 / tl, 1 / tl];
  return /* glsl */ `
${octa("cOpen1", g.open)}
${octa("cOpen2", g.open2)}
vec4 layer(vec2 p, vec2 s) {
  // only where the wall is open (the wall sits at depth ${D.wall}); a few px of slack for the bevel
  vec2 pw = vec2(s.x + layerOff(${f(D.wall)}), s.y);
  if (min(cOpen1(pw), cOpen2(pw)) > 2.0) return vec4(0.0);
  // the face is cut into blocks by steep faults (leaning a little right, wandering);
  // across each fault the strata jump and their dip changes, so the bedding reads as
  // broken rock rather than one set of parallel planks
  float fx = p.x - p.y * 0.3 + (fbm(vec2(p.y / ${f(46 * u)}, 3.7), 2) - 0.5) * ${f(26 * u)};
  float fw = ${f(78 * u)};
  float fb = floor(fx / fw + 0.35 * hash1(floor(p.y / ${f(140 * u)}) + 11.0));
  float ffr = fract(fx / fw + 0.35 * hash1(floor(p.y / ${f(140 * u)}) + 11.0));
  float thr = (hash1(fb * 3.1) - 0.5) * ${f(30 * u)};
  float dip = (hash1(fb * 5.3 + 1.0) - 0.5) * 0.34;
  vec2 Nb = vec2(${f(N[0]!)} * cos(dip) - ${f(N[1]!)} * sin(dip), ${f(N[0]!)} * sin(dip) + ${f(N[1]!)} * cos(dip));
  vec2 Tb = vec2(Nb.y, -Nb.x);
  // diagonal strata: bands across N, bent broadly by a slow warp, edges a touch ragged,
  // thickness varying through the face (a slow stretch of the band coordinate)
  float warp = (fbm(p / ${f(150 * u)}, 2) - 0.5) * ${f(34 * u)} + (vnoise(p / ${f(7 * u)}) - 0.5) * ${f(1.5 * u)};
  float vn = dot(p, Nb) + warp + thr;
  float v = vn / ${f(19 * u)} + 0.45 * sin(vn / ${f(61 * u)} + fb);
  float band = floor(v);
  float fr = v - band;
  // only some bedding planes show as ledges, so the layers vary in thickness
  float strong = step(0.35, hash1(band + fb * 17.0));
  // each band breaks into slabs along the strata, offset per band
  float along = dot(p, Tb) / (${f(44 * u)} * (0.6 + 0.9 * hash1(band))) + hash1(band + 7.0) * 9.0;
  float slab = floor(along);
  float fa = along - slab;
  float hs = hash2(vec2(band + fb * 31.0, slab));
  // ledge tops catch the light from above, undersides fall into shadow, joints are dark
  float ledge = strong * (fr < 0.07 ? 0.24 : fr < 0.14 ? 0.08 : fr > 0.7 ? -0.1 - 0.08 * step(0.86, fr) : 0.0);
  float joint = fa < 0.035 ? -0.08 : 0.0;
  // the fault itself: a dark crack with a lit lip on its right side
  float fault = ffr < ${f(1.6 / 78)} ? -0.2 : ffr < ${f(3.2 / 78)} ? 0.1 : 0.0;
  // whole blocks sit a little forward or back, so the face has planes
  float blockTone = (hash1(fb * 7.7 + 2.0) - 0.5) * 0.14;
  // a few slabs are bare, pale faces that shine
  float spec = hs > 0.86 ? 0.34 * (1.0 - fr) : 0.0;
  // big masses: buttresses and hollows in the face; the hollows are stepped shadow
  // pockets with a lit brow along their top edge
  float big = fbm(vec2(p.x / ${f(120 * u)}, p.y / ${f(160 * u)}), 3);
  // hollows are stretched along the bedding (a softer layer weathered back), so
  // they read as recessed strata with a lit brow on top, not as round blotches
  vec2 hq = vec2(dot(p, Tb) / ${f(96 * u)}, dot(p, Nb) / ${f(26 * u)}) + 9.1;
  float hol = fbm(hq, 3);
  float pocket = 0.0;
  if (hol < 0.33) pocket = fbm(hq - vec2(0.0, ${f(2 / 26)}) * Nb.y, 3) >= 0.33 ? 0.1 : -0.2;
  // the light: a broad pale core high right, behind the hammerhead's slab
  vec2 lc = ${v2(g.W * 0.72, g.H * 0.16)};
  float lg = 1.0 - clamp(length((p - lc) / vec2(${f(g.W * 0.46)}, ${f(g.H * 0.8)})), 0.0, 1.0);
  // detail shows where the light falls; the dim parts of the face stay hazy
  float k = 0.2 + 0.8 * lg;
  float shade = 0.02 + 0.2 * big + blockTone * k + (ledge + joint + fault + spec + pocket + (hs - 0.5) * 0.06) * k * 1.3 + 1.1 * lg * lg + 0.12 * lg;
  vec3 c = ramp(R_CLIFF, shade, p, 0.45);
  float low = smoothstep(${f(g.H * 0.4)}, ${f(g.H * 0.82)}, p.y);
  c = applyFog(c, uFog, low * 0.6, p, s);
  return vec4(c, 1.0);
}`;
}

// --- the wall of the hollow, with two chamfered openings -------------------------

export function wallBody(g: Geo): string {
  const { u } = g;
  return /* glsl */ `
${octa("open1", g.open)}
${octa("open2", g.open2)}
vec4 layer(vec2 p, vec2 s) {
  float o = min(open1(p), open2(p));
  if (o < 0.0) return vec4(0.0);
  float fw = ${f(16 * u)};
  float shade;
  float extra = 0.0;
  if (o < fw) {
    // the frame's bevel: lit toward the opening, ribbed
    float k = o / fw;
    shade = 0.62 - 0.4 * k;
    float rib = fract(dot(p, vec2(0.7071, 0.7071)) / ${f(9 * u)});
    if (rib < 0.12) shade -= 0.12;
    if (o < 1.5) shade += 0.12;
  } else {
    // wall: huge panels and girders
    vec2 cell = floor(p / ${v2(52 * u, 34 * u)});
    vec2 fr = fract(p / ${v2(52 * u, 34 * u)});
    shade = 0.08 + 0.08 * hash2(cell) + 0.12 * fbm(p / ${f(70 * u)}, 3);
    if (fr.x < ${f(1.2 / 52)} || fr.y < ${f(1.2 / 34)}) shade -= 0.06;
    if (fr.y > ${f(1 - 2.2 / 34)}) shade += 0.06;
    float gird = mod(p.y, ${f(96 * u)});
    if (gird < ${f(6 * u)}) shade += 0.06 + (gird < 1.0 ? 0.1 : 0.0);
    // light spilling onto the wall around the opening
    shade += 0.28 * exp(-(o - fw) / ${f(30 * u)});
    extra = 0.25 * (1.0 - smoothstep(0.0, ${f(g.H * 0.18)}, p.y));
  }
  float light = flashLight(s);
  vec3 c = ramp(R_WALL, shade + light * 0.4, p, 0.6);
  c = applyFog(c, uFog, extra, p, s);
  return vec4(c, 1.0);
}`;
}

// --- cranes -----------------------------------------------------------------------

export interface Crane {
  /** Mast foot (layer px), mast height and width (px). */
  x: number;
  y: number;
  mastH: number;
  mastW: number;
  /** Boom length, elevation (rad), direction (+1 right / -1 left), phase. */
  boom: number;
  elev: number;
  dir: number;
  phase: number;
  /** Counter-jib length, cable length, slew amplitude (rad), slew period (s). */
  jib: number;
  cable: number;
  slew: number;
  period: number;
  /** Boom half width, A-frame height, load half width and height. */
  bw: number;
  apex: number;
  lw: number;
  lh: number;
}

export function craneBody(cr: Crane[], row: string, navRow: string, cabRow: string): string {
  const A = cr.map((c) => v4(c.x, c.y, c.mastH, c.mastW));
  const B = cr.map((c) => v4(c.boom, c.elev, c.dir, c.phase));
  const C = cr.map((c) => v4(c.jib, c.cable, c.slew, c.period));
  const Dd = cr.map((c) => v4(c.bw, c.apex, c.lw, c.lh));
  return /* glsl */ `
const vec4 CRA[${cr.length}] = ${arr("vec4", A)};
const vec4 CRB[${cr.length}] = ${arr("vec4", B)};
const vec4 CRC[${cr.length}] = ${arr("vec4", C)};
const vec4 CRD[${cr.length}] = ${arr("vec4", Dd)};
float segp(vec2 q, vec2 a, vec2 b, out float al, out float L) {
  vec2 ab = b - a;
  L = length(ab);
  vec2 d = ab / max(L, 1e-3);
  vec2 r = q - a;
  al = dot(r, d);
  return d.x * r.y - d.y * r.x;
}
bool onLine(vec2 q, vec2 a, vec2 b, float w) {
  float al, L;
  float pe = segp(q, a, b, al, L);
  return al >= -0.5 && al <= L + 0.5 && abs(pe) < w;
}
vec4 layer(vec2 p, vec2 s) {
  vec2 q = p + 0.5;
  float tm = uTime * (1.0 - 0.7 * uReduced);
  float shade = -1.0;
  float emis = -1.0;
  for (int i = 0; i < ${cr.length}; i++) {
    vec4 A = CRA[i];
    vec4 B = CRB[i];
    vec4 C = CRC[i];
    vec4 E = CRD[i];
    float mw = A.w;
    vec2 piv = vec2(A.x + floor(mw * 0.5), A.y - A.z);
    float R = B.x + C.y * 1.4 + E.w + 8.0;
    if (abs(q.x - piv.x) > R + mw || q.y < piv.y - B.x - E.y - 4.0 || q.y > A.y + 1.0) continue;
    float yaw = C.z * sin(tm * 6.2832 / C.w + B.w);
    float el = B.y + 0.07 * sin(tm * 6.2832 / (C.w * 1.63) + B.w * 2.0);
    vec2 tip = floor(piv + vec2(B.z * B.x * cos(el) * cos(yaw), -B.x * sin(el)) + 0.5);
    vec2 cw = floor(piv + vec2(-B.z * C.x * cos(yaw), 0.0) + 0.5);
    vec2 apex = piv + vec2(0.0, -E.y);
    // mast: two chords, zigzag bracing, rungs
    float lx = floor(q.x - A.x);
    float ly = floor(A.y - q.y);
    if (lx >= 0.0 && lx < mw && ly >= 0.0 && ly <= A.z) {
      float m = mw - 1.0;
      float k = mod(ly, 2.0 * m);
      float z = k < m ? k : 2.0 * m - k;
      if (lx == 0.0 || lx == m || abs(lx - z) < 0.5) shade = max(shade, lx == 0.0 ? 0.34 : 0.2);
    }
    // boom lattice, tapering to the tip
    float al, L;
    float pe = segp(q, piv, tip, al, L);
    float hw = E.x * (1.0 - 0.55 * clamp(al / max(L, 1.0), 0.0, 1.0));
    if (al >= 0.0 && al <= L && abs(pe) <= hw + 0.5) {
      float tri = abs(fract(al / (2.0 * max(hw, 1.0))) * 2.0 - 1.0) * 2.0 - 1.0;
      if (abs(pe) > hw - 0.6 || abs(pe - tri * hw) < 0.75) shade = max(shade, pe < 0.0 ? 0.36 : 0.2);
    }
    // A-frame and pendant lines
    if (onLine(q, piv + vec2(-2.0, 0.0), apex, 0.6) || onLine(q, piv + vec2(2.0, 0.0), apex, 0.6)) shade = max(shade, 0.22);
    if (onLine(q, apex, tip, 0.5) || onLine(q, apex, cw, 0.5)) shade = max(shade, 0.18);
    // counter-jib and its weight
    if (onLine(q, piv, cw, 1.0)) shade = max(shade, 0.22);
    if (abs(q.x - cw.x) < 3.5 * max(1.0, mw / 4.0) && q.y >= cw.y && q.y < cw.y + E.w * 0.9) shade = max(shade, 0.16 + (q.y < cw.y + 1.0 ? 0.16 : 0.0));
    // cab with a lit window
    if (abs(q.x - piv.x) < mw * 0.8 + 1.0 && q.y >= piv.y && q.y < piv.y + E.w) {
      shade = max(shade, 0.24);
      if (floor(q.x) == piv.x + B.z * 1.0 && floor(q.y) == piv.y + 1.0) emis = 1.0;
    }
    // cable and load (the hoist rises and lowers slowly)
    float cl = floor(C.y * (1.0 + 0.4 * sin(tm * 6.2832 / (C.w * 0.83) + B.w * 3.0)) + 0.5);
    if (floor(q.x) == tip.x && q.y > tip.y && q.y < tip.y + cl) shade = max(shade, 0.18);
    vec2 ld = vec2(tip.x, tip.y + cl);
    if (abs(floor(q.x) - ld.x) <= E.z && q.y >= ld.y && q.y < ld.y + E.w) {
      float ly2 = floor(q.y - ld.y);
      shade = max(shade, 0.24 + (ly2 < 1.0 ? 0.2 : 0.0) + (mod(floor(q.x), 3.0) == 0.0 ? -0.05 : 0.0));
    }
    // a slow red light on the boom tip
    if (floor(q) == tip + vec2(0.0, -1.0) && mod(tm + B.w * 5.0, 2.8) < 0.9) emis = 2.0;
  }
  if (emis > 0.0) {
    vec3 ec = emis > 1.5 ? pal(${rowRef(navRow)}, paln(${rowRef(navRow)}) - 1.0) : pal(${rowRef(cabRow)}, paln(${rowRef(cabRow)}) - 1.0);
    return vec4(applyFog(ec, uFog * 0.7, 0.0, p, s), 1.0);
  }
  if (shade < 0.0) return vec4(0.0);
  float light = sceneLight(s, uDepth) + flashLight(s);
  vec3 c = ramp(${rowRef(row)}, shade + light, p, 0.0);
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`;
}

// --- searchlights: thin white beams standing up out of the district -------------

/** Beams: [x, y, angle (rad, screen: -PI/2 is straight up), phase]. */
export function searchBody(g: Geo, beams: [number, number, number, number][]): string {
  const { u } = g;
  const B = beams.map(([x, y, a, ph]) => v4(x, y, a, ph));
  return /* glsl */ `
const vec4 SB[${B.length}] = ${arr("vec4", B)};
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.7 * uReduced);
  float v = 0.0;
  for (int i = 0; i < ${B.length}; i++) {
    float ang = SB[i].z + 0.05 * sin(tm * 0.08 + SB[i].w);
    vec2 d = vec2(cos(ang), sin(ang));
    vec2 r = p - SB[i].xy;
    float a = dot(r, d);
    float len = ${f(230 * u)};
    if (a < 0.0 || a > len) continue;
    float x = abs(d.x * r.y - d.y * r.x) / (1.4 * U + a * 0.06);
    if (x > 1.0) continue;
    float st = 0.6 + 0.5 * fbm(vec2(x * 3.0 + tm * 0.04, a / ${f(50 * u)} - tm * 0.1), 2);
    v += (1.0 - smoothstep(0.15, 1.0, x)) * pow(1.0 - a / len, 0.9) * st * 1.35;
    // the lamp itself: a hard white point at the foot
    if (a < ${f(2.5 * u)} && x < 0.8) return vec4(pal(R_SEARCH, paln(R_SEARCH) - 1.0), 1.0);
  }
  float lv = stepd(min(v, 1.0), 4.0, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  return vec4(ramp(R_SEARCH, lv, p, 0.0), lv * 0.8);
}`;
}

// --- furnace pockets: molten mouths with stepped heat glow in the dark ground ------

export function furnaceBody(g: Geo): string {
  const { u } = g;
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.7 * uReduced);
  float gsum = 0.0;
  float pool = 0.0;
  for (int i = 0; i < ${g.pits.length}; i++) {
    vec3 P = PITS[i];
    float fl = pitFlick(float(i));
    vec2 d = (p - P.xy) / PITR;
    float r = length(d * vec2(1.0, d.y < 0.0 ? 0.8 : 2.2));
    if (r < 1.0) gsum += P.z * fl * pow(1.0 - r, 2.4);
    // the molten mouth: a squat rounded slot whose top edge boils
    vec2 e = p - P.xy;
    float hw = ${f(14 * u)} + ${f(14 * u)} * P.z;
    float hh = ${f(3 * u)} + ${f(2 * u)} * P.z;
    float boil = (vnoise(vec2(p.x / ${f(4 * u)} + float(i) * 9.0, tm * 0.9)) - 0.5) * ${f(3 * u)};
    float top = -hh + boil * step(e.y, 0.0);
    if (abs(e.x) < hw && e.y > top && e.y < hh) {
      float cx = abs(e.x) / hw;
      float cy = (e.y - top) / (hh - top);
      pool = max(pool, (1.0 - cx * cx) * (1.0 - 0.6 * cy) * (0.75 + 0.25 * fl));
    }
  }
  if (pool > 0.0) {
    float crust = vnoise(vec2(p.x / ${f(5 * u)} - tm * 0.35, p.y / ${f(2 * u)} + tm * 0.15));
    float v = 0.3 + 0.8 * pool - 0.25 * step(0.72, crust);
    return vec4(ramp(R_FIRE, v, p, 0.8), 1.0);
  }
  float lv = stepd(min(gsum * 1.2, 1.0), 5.0, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  return vec4(ramp(R_FIRE, 0.1 + 0.62 * lv, p, 0.0), 0.2 + 0.6 * lv);
}`;
}

// --- near smoke: rising billows, thinned where they cross the foundry block ------

export interface SmokeOpts {
  y0: number;
  y1: number;
  drift: number;
  cover: number;
  alpha: number;
  /** Foundry tiers at depth D.near: [right edge x, top y]; the smoke thins over them. */
  tiers: [number, number][];
  over: number;
}

export function smokeBody(g: Geo, o: SmokeOpts): string {
  const { u } = g;
  const T = o.tiers.map(([x, y]) => v2(x, y));
  return /* glsl */ `
const vec2 FT[${T.length}] = ${arr("vec2", T)};
vec4 layer(vec2 p, vec2 s) {
  float y0 = ${f(o.y0)}, y1 = ${f(o.y1)};
  if (p.y < y0 || p.y > y1) return vec4(0.0);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float px = p.x - floor(tm * ${f(o.drift)} + 0.5);
  // near-round billows that rise slowly: whole-pixel rise, shape change from the warp
  float py = p.y + floor(tm * ${f(1.6 * u)} + 0.5);
  vec2 q = vec2(px / ${f(46 * u)}, py / ${f(30 * u)});
  float t = tm * 0.06;
  vec2 w = vec2(fbm(q * 0.6 + vec2(0.0, t), 2), fbm(q * 0.6 + vec2(5.2, 1.3 - t * 0.8), 2)) - 0.5;
  float n = fbm(q + 2.2 * w + vec2(t * 0.3, -t * 0.2), 3);
  // columns: a vertical term breaks any horizontal band into separate puffs
  float col = vnoise(vec2(px / ${f(34 * u)}, t * 1.5));
  float prof = smoothstep(y0, y0 + ${f(40 * u)}, p.y) * (1.0 - smoothstep(y1 - ${f(10 * u)}, y1, p.y));
  float cover = ${f(o.cover)};
  float d = clamp((n * prof * (0.45 + 0.9 * col) - (1.0 - cover) * 0.62) / (cover * 0.62 + 0.05), 0.0, 1.0);
  float lv = floor(d * 3.0 + (bayer4(p) - 0.5) * 0.9);
  if (lv <= 0.0) return vec4(0.0);
  lv = min(lv, 3.0);
  // over the foundry block the smoke goes thin, so it reads as a volume in front of it
  float fx = s.x + layerOff(${f(D.near)});
  float over = 1.0;
  for (int i = 0; i < ${T.length}; i++) if (fx < FT[i].x && s.y > FT[i].y) over = ${f(o.over)};
  float light = sceneLight(s, uDepth) + flashLight(s) * 0.6;
  vec3 body = ramp(R_STEAM, 0.2 + 0.12 * (lv - 1.0) + light, p, 0.0);
  vec3 c = mix(fogColor(s), body, 0.5);
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, ${f(o.alpha)} * lv / 3.0 * over);
}`;
}

// --- steam plumes: columns that rise, widen, drift and change shape ----------------

export function plumeBody(g: Geo, plumes: [number, number, number, number][]): string {
  const { u } = g;
  const P = plumes.map(([x, y, h, w]) => v4(x, y, h, w));
  return /* glsl */ `
const vec4 PL[${P.length}] = ${arr("vec4", P)};
vec4 layer(vec2 p, vec2 s) {
  float tm = uTime * (1.0 - 0.6 * uReduced);
  for (int i = 0; i < ${P.length}; i++) {
    vec4 b = PL[i];
    float v = (b.y - p.y) / b.z;
    if (v < -0.03 || v > 1.0) continue;
    float fi = float(i);
    float cx = b.x + v * v * b.z * 0.35 + sin(v * 4.0 - tm * 0.3 + fi) * ${f(4 * u)} * v;
    float hw = mix(b.w * 0.25, b.w, pow(max(v, 0.0), 0.65));
    float dx = (p.x - cx) / hw;
    if (abs(dx) > 1.3) continue;
    float rise = floor(tm * ${f(7 * u)} * (1.0 + fi * 0.15) + 0.5);
    vec2 q = vec2((p.x - cx) / ${f(11 * u)}, (p.y + rise) / ${f(9 * u)});
    vec2 w = vec2(vnoise(q * 0.5 + vec2(fi * 7.0, tm * 0.04)), vnoise(q * 0.5 + vec2(3.1, fi - tm * 0.03))) - 0.5;
    float n = fbm(q + 1.3 * w + vec2(fi * 17.0, 0.0), 3);
    float body = (1.0 - smoothstep(0.2, 1.3, abs(dx) + (n - 0.5) * 1.1)) * (1.0 - smoothstep(0.45, 1.0, v)) * smoothstep(-0.03, 0.05, v);
    float d = clamp(body * (0.4 + 1.0 * n) - 0.18, 0.0, 1.0);
    float lv = floor(d * 4.0 + (bayer4(p) - 0.5) * 0.9);
    if (lv <= 0.0) continue;
    lv = min(lv, 3.0);
    float light = pitLight(vec2(s.x + layerOff(${f(D.pits)}), s.y)) * 0.55 + (1.0 - smoothstep(0.0, 0.3, v)) * 0.3;
    vec3 c = ramp(R_STEAM, 0.18 + 0.13 * lv + light, p, 0.0);
    c = mix(fogColor(s), c, 0.7);
    c = applyFog(c, uFog, 0.0, p, s);
    return vec4(c, 0.3 * lv);
  }
  return vec4(0.0);
}`;
}

// --- signs: glyph panels that glow and, now and then, stutter ----------------------

export function signBody(g: Geo, signs: Sign[]): string {
  const { u } = g;
  const cs = Math.max(4, Math.round(4 * u));
  const S = signs.map((s) => v4(s.x, s.y, s.w, s.h));
  const T = signs.map((s) => v4(0, s.period, s.offset, s.vertical ? 1 : 0));
  const rows = signs.map((s) => rowRef(s.row));
  return /* glsl */ `
const vec4 SG[${S.length}] = ${arr("vec4", S)};
const vec4 ST[${T.length}] = ${arr("vec4", T)};
const float SROW[${rows.length}] = ${arr("float", rows)};
vec4 layer(vec2 p, vec2 s) {
  for (int i = 0; i < ${S.length}; i++) {
    vec4 b = SG[i];
    vec2 l = floor(p - b.xy);
    float halo = ${f(4 * u)};
    if (l.x < -halo || l.y < -halo || l.x >= b.z + halo || l.y >= b.w + halo) continue;
    float row = SROW[i];
    float lvl = signLevel(ST[i].y, ST[i].z);
    float n = paln(row);
    bool inside = l.x >= 0.0 && l.y >= 0.0 && l.x < b.z && l.y < b.w;
    if (!inside) {
      // stepped halo around the panel
      vec2 e = max(max(-l, l - b.zw + 1.0), 0.0);
      float d = max(e.x, e.y) / halo;
      float a = floor((1.0 - d) * 3.0) / 3.0 * 0.3 * lvl;
      if (a <= 0.0) return vec4(0.0);
      return vec4(applyFog(pal(row, n - 2.0), uFog * 0.6, 0.0, p, s), a);
    }
    vec3 c;
    bool edge = l.x == 0.0 || l.y == 0.0 || l.x == b.z - 1.0 || l.y == b.w - 1.0;
    // glyph cells ${cs}px: a 3x3 (scaled) blocky glyph from a hash, one px gutter
    vec2 cl = l - 1.0;
    vec2 cell = floor(cl / ${f(cs)});
    vec2 in_ = floor(mod(cl, ${f(cs)}) / ${f((cs - 1) / 3)});
    float bit = hash2(cell * 7.0 + vec2(float(i) * 31.0, in_.x + in_.y * 3.0));
    bool gutter = mod(cl.x, ${f(cs)}) >= ${f(cs - 1)} || mod(cl.y, ${f(cs)}) >= ${f(cs - 1)};
    // one dead column in each sign: a lived-in, half-broken look
    bool dead = hash2(vec2(float(i), ST[i].w > 0.5 ? cell.y : cell.x)) < 0.12;
    if (edge) c = pal(row, n - 2.0 - (lvl < 0.5 ? 1.0 : 0.0));
    else if (!gutter && bit < 0.55 && !dead) c = pal(row, max(0.0, n - 1.0 - (lvl < 0.5 ? 2.0 : 0.0)));
    else c = pal(row, 0.0) * 0.55;
    return vec4(applyFog(c, uFog * 0.6, 0.0, p, s), 1.0);
  }
  return vec4(0.0);
}`;
}

// --- the ship: a packed sprite, lit and fogged live, with lights ------------------

export function shipBody(sp: ShipSprite): string {
  return /* glsl */ `
const uint SHIP[${sp.words.length}] = uint[${sp.words.length}](${sp.words.map((w) => `${w >>> 0}u`).join(", ")});
float shipCode(vec2 l) {
  if (l.x < 0.0 || l.y < 0.0 || l.x >= SHIP_SIZE.x || l.y >= SHIP_SIZE.y) return 0.0;
  int x = int(l.x);
  int i = int(l.y) * ${sp.stride} + (x >> 3);
  return float((SHIP[i] >> uint((x & 7) * 4)) & 15u);
}
vec4 layer(vec2 p, vec2 s) {
  vec2 l = floor(p - shipPos());
  float c = shipCode(l);
  if (c < 0.5) return vec4(0.0);
  vec3 col;
  float tm = shipTime();
  if (c > 11.5) {
    if (c < 12.5) col = pal(R_WIN, paln(R_WIN) - 1.0);
    else if (c < 13.5) col = pal(R_HEAD, paln(R_HEAD) - 1.0);
    else if (c < 14.5) col = pal(R_FIRE, paln(R_FIRE) - 2.0 - step(0.6, vnoise(vec2(tm * 1.5, l.y))));
    else col = mod(tm, 2.2) < 0.7 ? pal(R_NAV, paln(R_NAV) - 1.0) : pal(R_SHIP, 1.0);
    return vec4(applyFog(col, uFog * 0.6, 0.0, p, s), 1.0);
  }
  float shade = (c - 1.0) / 10.0;
  // the belly picks up the furnace light below
  float under = smoothstep(SHIP_SIZE.y * 0.5, SHIP_SIZE.y, l.y);
  float light = sceneLight(s, uDepth) * 0.6 + flashLight(s) + under * pitLight(vec2(s.x + layerOff(${f(D.pits)}), ${f(0)} + 0.0)) * 0.0;
  col = ramp(R_SHIP, shade + light, p, 0.4);
  return vec4(applyFog(col, uFog, 0.0, p, s), 1.0);
}`;
}

/** Additive light around the ship: headlight halos and the cone through the haze. */
export function shipLightBody(sp: ShipSprite): string {
  const heads = sp.heads.map(([x, y]) => v2(x, y));
  return /* glsl */ `
const vec2 HEADS[${heads.length}] = ${arr("vec2", heads)};
vec4 layer(vec2 p, vec2 s) {
  vec2 sp = shipPos();
  float tm = shipTime();
  float halo = 0.0;
  for (int i = 0; i < ${heads.length}; i++) {
    float r = length((p - (sp + HEADS[i])) * vec2(0.8, 1.0)) / ${f(15)};
    if (r < 1.0) halo = max(halo, pow(1.0 - r, 1.5) * 1.2);
  }
  float v = 0.0;
  float ac, al;
  float cone = shipCone(p, ac, al);
  if (cone > 0.0) {
    float st = 0.55 + 0.7 * fbm(vec2(ac * 3.5 + 11.0, al / ${f(40)} - tm * 0.15), 3);
    v = cone * st * 0.95;
  }
  float hl = stepd(min(halo, 1.0), 4.0, p, 0.8);
  if (hl > 0.0 && hl * 1.2 >= v) return vec4(ramp(R_HEAD, hl, p, 0.0), hl * 0.55);
  float lv = stepd(min(v, 1.0), 4.0, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  return vec4(ramp(R_BEAM, lv, p, 0.0), lv * 0.36);
}`;
}

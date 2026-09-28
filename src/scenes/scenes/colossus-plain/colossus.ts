// The colossus: a pale, many-legged walker with a tentacled head, drawn per
// pixel from a 2D signed-distance body (ellipses and tapered capsules blended
// with smooth unions). Each part carries an outward gradient and a local
// radius, so the shader can "puff" the flat silhouette into a round form and
// light it live (key light, sky light, lightning through flashLight()). Legs
// are placed by a walk model that exists twice: here in TypeScript (for the
// CPU particle systems that must know where feet are) and emitted as GLSL.
// Both read the same numbers, so a clod thrown on the CPU leaves the same
// foot the shader draws.
//
// Design units: y up from the ground under the body, x along the body with
// the head toward -x (it walks left). One design unit is S layer pixels.

import { f, v2 } from "../../engine/index.ts";

export interface LegDef {
  /** Hip on the body, design units. */
  hip: [number, number];
  /** Optional raised femur: a fixed-angle first segment (radians from +x, CCW, y up). */
  fem?: { len: number; ang: number };
  /** The two IK segments. */
  a: number;
  b: number;
  /** Radius at the hip (or femur tip), knee and foot. */
  r: [number, number, number];
  /** Knee side: +1 knee toward the tail (+x), -1 toward the head. */
  bend: 1 | -1;
  /** Where the foot plants relative to the hip at mid-stance. */
  reach: number;
  phase: number;
  /** Height below which the leg is stained dark. */
  tar: number;
  toes: number;
}

export interface ColossusDef {
  /** Layer pixels per design unit. */
  S: number;
  /** Layer y of the ground the feet stand on. */
  ground: number;
  /** Layer x of the body origin when a crossing starts and where it has gone off screen. */
  x0: number;
  /** Loop length in seconds (crossing plus a gap), and the time offset at t = 0. */
  period: number;
  t0: number;
  /** Walking speed, design units per second. */
  vd: number;
  /** Seconds per step cycle, fraction of it a foot is planted, lift height. */
  T: number;
  duty: number;
  lift: number;
  bob: number;
  legs: LegDef[];
  /** Far-side legs: offset of the hips and phase offset. */
  far: { dx: number; dy: number; phase: number; scale: number };
  dendrites: boolean;
  seed: number;
}

// --- the body plan ----------------------------------------------------------

export const LEGS: LegDef[] = [
  // front: thick, knee forward, tar-stained to the thigh, root-like toes (the weight leg)
  { hip: [-52, 150], a: 92, b: 104, r: [19, 13, 10], bend: -1, reach: -16, phase: 0.75, tar: 96, toes: 5 },
  // middle: plain two-bone, knee back
  { hip: [8, 140], a: 88, b: 100, r: [14, 9.5, 7], bend: 1, reach: 4, phase: 0.5, tar: 70, toes: 4 },
  // rear: long spider legs, a short thigh rising off the flank to a high knee, then a
  // long bowed shin and a thin tarsus down to the ground (thick at the joints, tapering)
  { hip: [84, 146], fem: { len: 70, ang: 1.42 }, a: 150, b: 112, r: [15, 10, 4.2], bend: 1, reach: 30, phase: 0.25, tar: 52, toes: 2 },
  { hip: [168, 128], fem: { len: 62, ang: 1.12 }, a: 146, b: 104, r: [13, 8.5, 3.6], bend: 1, reach: 66, phase: 0.0, tar: 46, toes: 2 },
];

export const EYE: [number, number] = [-150, 207];
export const HEAD_PIVOT: [number, number] = [-80, 195];

/** Horizontal extent of the whole creature in design units (tentacle tips to the rear legs). */
export const EXTENT = { x0: -230, x1: 300, y1: 340 };

/**
 * The body is authored level, then pitched front-up by TILT radians about
 * PIVOT (design units): a hunched, rearing stance with the head high and the
 * tail low. Legs are placed from the pitched hips; tentacles and filaments
 * still hang straight down.
 */
export const TILT = 0.25;
export const PIVOT: [number, number] = [40, 150];
/** Head pitched down against the body's tilt (radians, added to the sway). */
export const HEAD_PITCH = -0.16;

/** A body-local design point to world design units (before bob). */
export function toWorld([x, y]: [number, number]): [number, number] {
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  const dx = x - PIVOT[0];
  const dy = y - PIVOT[1];
  return [PIVOT[0] + c * dx + s * dy, PIVOT[1] - s * dx + c * dy];
}

function hipWorld(c: ColossusDef, leg: LegDef, far: boolean): [number, number] {
  return toWorld([leg.hip[0] + (far ? c.far.dx : 0), leg.hip[1] + (far ? c.far.dy : 0)]);
}

// --- the walk model (CPU twin) --------------------------------------------------

export function animTime(t: number, reduced: boolean): number {
  const tm = (t % 4096) * (reduced ? 0.5 : 1);
  return Math.floor(tm * 12) / 12;
}

export function loopTime(c: ColossusDef, ta: number): number {
  const v = (ta + c.t0) % c.period;
  return v < 0 ? v + c.period : v;
}

/** Body origin, design world x (layer px / S). */
export function bodyX(c: ColossusDef, tl: number): number {
  return c.x0 / c.S - c.vd * tl;
}

/** Body origin snapped to a whole layer pixel, in design units. */
export function bodyXSnap(c: ColossusDef, tl: number): number {
  return Math.floor(bodyX(c, tl) * c.S + 0.5) / c.S;
}

export function bobAt(c: ColossusDef, tl: number): number {
  return Math.floor(c.bob * c.S * (0.5 + 0.5 * Math.cos(2 * Math.PI * ((2 * tl) / c.T + 0.15))) + 0.5) / c.S;
}

export interface FootState {
  /** Design world x and height above ground. */
  x: number;
  y: number;
  /** -1 planted, else 0..1 through the swing. */
  sw: number;
  /** Cycle index (changes once per step) and the fraction through it. */
  n: number;
  fr: number;
}

export function foot(c: ColossusDef, tl: number, phase: number, hx: number): FootState {
  const cyc = tl / c.T + phase;
  const n = Math.floor(cyc);
  const fr = cyc - n;
  const ts = (n - phase) * c.T;
  const plant = c.x0 / c.S - c.vd * ts + hx - c.vd * c.duty * c.T * 0.5;
  if (fr < c.duty) return { x: plant, y: 0, sw: -1, n, fr };
  const s = (fr - c.duty) / (1 - c.duty);
  const e = s * s * (3 - 2 * s);
  return { x: plant - c.vd * c.T * e, y: c.lift * Math.sin(Math.PI * Math.pow(s, 0.75)), sw: s, n, fr };
}

/** All legs: near side then far side, with their hip x (design, body-local) and phase. */
export function legList(c: ColossusDef): { leg: LegDef; hx: number; phase: number; far: boolean }[] {
  const out: { leg: LegDef; hx: number; phase: number; far: boolean }[] = [];
  for (const leg of c.legs) out.push({ leg, hx: hipWorld(c, leg, false)[0] + leg.reach, phase: leg.phase, far: false });
  for (const leg of c.legs) out.push({ leg, hx: hipWorld(c, leg, true)[0] + leg.reach, phase: (leg.phase + c.far.phase) % 1, far: true });
  return out;
}

// --- GLSL ---------------------------------------------------------------------

/** Walk-model constants and functions, shared by the body and the dust layer. */
export function walkGlsl(c: ColossusDef): string {
  return /* glsl */ `
const float CS = ${f(c.S)};
const float CGND = ${f(c.ground)};
const float CXD0 = ${f(c.x0 / c.S)};
const float CVD = ${f(c.vd)};
const float CPER = ${f(c.period)};
const float CT0 = ${f(c.t0)};
const float CTC = ${f(c.T)};
const float CDUTY = ${f(c.duty)};
const float CLIFT = ${f(c.lift)};
const float CBOB = ${f(c.bob)};
float cAnimT() { float tm = uTime * (1.0 - 0.5 * uReduced); return floor(tm * 12.0) / 12.0; }
float cLoop(float ta) { return mod(ta + CT0, CPER); }
float cBodyX(float tl) { return CXD0 - CVD * tl; }
float cBob(float tl) { return floor(CBOB * CS * (0.5 + 0.5 * cos(6.28318 * (2.0 * tl / CTC + 0.15))) + 0.5) / CS; }
// foot in design world coords; sw = -1 planted, else 0..1 through the swing; age = s since plant or lift
vec2 cFoot(float tl, float ph, float hx, out float sw, out float age) {
  float cyc = tl / CTC + ph;
  float n = floor(cyc);
  float fr = cyc - n;
  float ts = (n - ph) * CTC;
  float plant = CXD0 - CVD * ts + hx - CVD * CDUTY * CTC * 0.5;
  sw = -1.0;
  age = fr * CTC;
  if (fr < CDUTY) return vec2(plant, 0.0);
  float s = (fr - CDUTY) / (1.0 - CDUTY);
  sw = s;
  age = (fr - CDUTY) * CTC;
  float e = s * s * (3.0 - 2.0 * s);
  return vec2(plant - CVD * CTC * e, CLIFT * sin(PI * pow(s, 0.75)));
}`;
}

const SDF_LIB = /* glsl */ `
mat2 cRot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// smooth union of (distance, outward gradient xy, local radius)
vec4 cU(vec4 a, vec4 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec4(mix(b.x, a.x, h) - k * h * (1.0 - h), normalize(mix(b.yz, a.yz, h) + 1e-5), mix(b.w, a.w, h));
}
vec4 cMin(vec4 a, vec4 b) { return b.x < a.x ? b : a; }
// tapered capsule a->b, radii ra->rb
vec4 cCap(vec2 q, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = q - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  vec2 v = pa - ba * h;
  float l = length(v);
  float r = mix(ra, rb, h);
  return vec4(l - r, v / max(l, 1e-4), r);
}
// an organic limb segment a->b: a muscle belly a third of the way down, a
// swollen joint at the top, a thin ankle, bowed off the straight line (bow =
// sideways sag as a fraction of the length, peaking above the middle). The two
// edges get their own lumps, in design units, so even a limb 5 px across never
// has two parallel straight edges (the "rod" read). Close enough to a distance
// for 1 px edges.
vec4 cBone(vec2 q, vec2 a, vec2 b, float ra, float rb, float bow, float knob) {
  vec2 ba = b - a;
  float L2 = max(dot(ba, ba), 1e-4);
  float L = sqrt(L2);
  vec2 nrm = vec2(-ba.y, ba.x) / L;
  vec2 pa = q - a;
  float h = clamp(dot(pa, ba) / L2, 0.0, 1.0);
  float bw = sin(PI * pow(h, 0.72)) + 0.18 * sin(2.0 * PI * h + knob);
  vec2 v = pa - ba * h - nrm * (bow * L * bw);
  float l = length(v);
  float r = mix(ra, rb, pow(h, 0.85));
  float j0 = (h - 0.03) / 0.09, mb = (h - 0.3) / 0.2, j1 = (h - 0.97) / 0.05;
  r *= 1.0 + 0.2 * exp(-j0 * j0) + 0.2 * exp(-mb * mb) + 0.14 * exp(-j1 * j1);
  float z = h * L;
  float side = dot(v, nrm) > 0.0 ? 1.0 : 0.0;
  float lump = (vnoise(vec2(z * 0.07 + knob, side * 9.0 + knob)) - 0.5) * (1.6 + 0.35 * r)
             + (vnoise(vec2(z * 0.23 - knob, side * 5.0 + 3.0)) - 0.5) * 1.5;
  r = max(0.7, r + lump);
  return vec4(l - r, v / max(l, 1e-4), r);
}
// rotated ellipse (approximate distance)
vec4 cEll(vec2 q, vec2 c, vec2 r, float ang) {
  vec2 d = cRot(-ang) * (q - c);
  float k0 = length(d / r);
  float k1 = length(d / (r * r));
  float dist = k0 * (k0 - 1.0) / max(k1, 1e-4);
  vec2 g = cRot(ang) * normalize(d / (r * r) + 1e-5);
  return vec4(dist, g, min(r.x, r.y));
}
vec2 cIk(vec2 h, vec2 ft, float a, float b, float bend, out vec2 end) {
  vec2 d = ft - h;
  float l = clamp(length(d), abs(a - b) + 0.5, a + b - 0.5);
  vec2 dn = normalize(d + 1e-5);
  end = h + dn * l;
  float al = (a * a - b * b + l * l) / (2.0 * l);
  float hh = sqrt(max(0.0, a * a - al * al));
  return h + dn * al + vec2(-dn.y, dn.x) * hh * bend;
}
`;

/** A per-leg noise seed so no two limbs share the same lumps. */
function seedOf(leg: LegDef, far: boolean): number {
  return ((leg.hip[0] * 0.37 + leg.hip[1] * 0.11) % 17) + (far ? 23.5 : 0);
}

/**
 * All legs (near side, then far side) as one GLSL loop over constant tables.
 * A loop, not eight unrolled copies: the D3D shader compiler behind ANGLE takes
 * seconds per unrolled limb, and this keeps the scene's load time short.
 */
function legsGlsl(c: ColossusDef): { decl: string; body: string } {
  const rows: { A: number[]; B: number[]; C: number[]; D: number[] }[] = [];
  for (const far of [false, true])
    for (const leg of c.legs) {
      const k = far ? c.far.scale : 1;
      const [hx, hy] = hipWorld(c, leg, far);
      const ph = far ? (leg.phase + c.far.phase) % 1 : leg.phase;
      rows.push({
        A: [hx, hy, leg.fem ? leg.fem.len : 0, leg.fem ? leg.fem.ang : 0],
        B: [leg.a, leg.b, leg.bend, ph],
        C: [leg.r[0] * k, leg.r[1] * k, leg.r[2] * k, hx + leg.reach],
        D: [leg.tar * (far ? 0.9 : 1), leg.toes, seedOf(leg, far), k],
      });
    }
  const n = rows.length;
  const arr = (name: "A" | "B" | "C" | "D"): string =>
    `const vec4 LEG${name}[${n}] = vec4[${n}](${rows.map((r) => `vec4(${r[name].map(f).join(", ")})`).join(", ")});`;
  const decl = [arr("A"), arr("B"), arr("C"), arr("D")].join("\n");
  const body = /* glsl */ `
  for (int i = 0; i < ${n}; i++) {
    vec4 LA = LEGA[i], LB = LEGB[i], LC = LEGC[i], LD = LEGD[i];
    float k = LD.w;
    float reachR = LA.z + LB.x + LB.y + LC.x + 30.0 * k;
    if (abs(q.x - LA.x) > reachR || q.y > LA.y + reachR) continue;
    float sw, age;
    vec2 fw = cFoot(tl, LB.w, LC.w, sw, age);
    vec2 ft = vec2(fw.x - bxw, fw.y);
    vec2 hip = vec2(LA.x, LA.y - bob);
    float lw = sw < 0.0 ? 0.0 : smoothstep(0.0, 0.2, sw) * (1.0 - smoothstep(0.8, 1.0, sw));
    bool fem = LA.z > 0.0;
    vec2 k0 = fem ? hip + LA.z * vec2(cos(LA.w + 0.12 * lw), sin(LA.w + 0.12 * lw)) : hip;
    vec2 fe;
    vec2 kn = cIk(k0, ft, LB.x, LB.y, LB.z, fe);
    vec2 lo = min(min(hip, k0), min(kn, fe)) - (LC.x + 22.0 * k);
    vec2 hi = max(max(hip, k0), max(kn, fe)) + (LC.x + 22.0 * k);
    if (q.x < lo.x || q.x > hi.x || q.y < lo.y || q.y > hi.y) continue;
    // bowed, tapering bone segments with swollen joints; the bows alternate so
    // the limb reads as jointed and organic, never as a straight rod
    vec4 dl = cBone(q, k0, kn, fem ? LC.y * 1.2 : LC.x, LC.y * 0.95, (fem ? -0.085 : -0.06) * LB.z, LD.z);
    dl = cU(dl, cBone(q, kn, fe, LC.y * 1.05, LC.z, 0.075 * LB.z, LD.z + 3.7), 4.0 * k);
    // the femur rising off the flank, or (two-bone legs) a muscle belly on the thigh
    vec2 s0 = fem ? hip : mix(k0, kn, 0.12);
    vec2 s1 = fem ? k0 : mix(k0, kn, 0.55);
    dl = cU(dl, cBone(q, s0, s1, LC.x * (fem ? 1.25 : 1.12), LC.y * (fem ? 1.1 : 1.1), fem ? 0.09 : -0.08, LD.z + 7.1), (fem ? 5.0 : 6.0) * k);
    if (fem) dl = cU(dl, vec4(length(q - k0) - LC.y * 1.35, normalize(q - k0 + 1e-5), LC.y * 1.35), 3.0 * k);
    dl = cU(dl, vec4(length(q - kn) - LC.y * 1.25, normalize(q - kn + 1e-5), LC.y * 1.25), 3.0 * k);
    // toes: planted, splayed along the ground; lifted, hanging and curled
    int nt = int(LD.y + 0.5);
    float tmul = LD.y > 4.5 ? 1.9 : LD.y > 3.5 ? 1.4 : 1.0;
    for (int j = 0; j < 5; j++) {
      if (j >= nt) break;
      float spread = nt == 1 ? 0.0 : float(j) / float(nt - 1) - 0.5;
      float plantAng = spread < 0.0 ? PI + 0.12 + spread * 0.5 : -0.12 + spread * 0.5;
      float hangAng = -PI * 0.5 + spread * 1.1;
      float len = (8.0 + 7.0 * float((j * 37) % 5) / 4.0) * tmul * k;
      float ta = mix(plantAng, hangAng + 0.3 * sin(tl * 2.1 + float(j) * 1.9), lw);
      vec2 te = fe + len * vec2(cos(ta), sin(ta));
      vec2 tm2 = mix(fe, te, 0.55) + vec2(0.0, 2.2 * k) * (1.0 - lw);
      dl = cMin(dl, cCap(q, fe, tm2, LC.z * 0.75, LC.z * 0.45));
      dl = cMin(dl, cCap(q, tm2, te, LC.z * 0.45, max(0.6, LC.z * 0.18)));
    }
    if (i >= ${n / 2}) {
      if (dl.x < fg.x) { fg = dl; fTar = LD.x; fDir = normalize(fe - kn + 1e-5); fKn = kn; }
    } else if (dl.x < ng.x) { ng = dl; nTar = LD.x; nDir = normalize(fe - kn + 1e-5); nKn = kn; }
  }`;
  return { decl, body };
}

function tentacles(c: ColossusDef): string {
  // bases on the underside of the head (head space), lengths, root radius
  const T: [number, number, number, number][] = [
    [-178, 192, 104, 6],
    [-168, 186, 150, 7.5],
    [-158, 183, 96, 7.5],
    [-147, 181, 168, 8.5],
    [-136, 181, 122, 7],
    [-125, 183, 142, 6.5],
    [-114, 186, 84, 5],
  ];
  void c;
  return T.map(([x, y, len, r], i) => {
    const seg = len / 5;
    const spread = (i - 3) * 0.07;
    return /* glsl */ `
  {
    vec2 pt = ${v2(x, y)};
    float th = ${f(-Math.PI / 2 + spread + TILT - HEAD_PITCH)};
    ${[0, 1, 2, 3, 4]
      .map((j) => {
        const ra = r * (1 - j / 5.6);
        const rb = r * (1 - (j + 1) / 5.6);
        return `th += ${f(0.05 + 0.02 * j)} + ${f(0.07 + 0.045 * j)} * sin(tl * ${f(0.55 + i * 0.04)} + ${f(i * 1.3 - j * 0.6)})${j >= 3 ? ` + ${f(j === 4 ? 0.45 : 0.2)} * sin(tl * 0.33 + ${f(i * 2.1 + j)})` : ""};
    { vec2 nx = pt + ${f(seg)} * vec2(cos(th), sin(th)); tg = cU(tg, cCap(qh, pt, nx, ${f(ra)}, ${f(Math.max(0.7, rb))}), 2.0); pt = nx; }`;
      })
      .join("\n    ")}
  }`;
  }).join("");
}

/** Back spines: short bony nubs along the top line. */
const SPINES: [number, number, number, number][] = [
  [-38, 206, 12, 1.9],
  [-8, 226, 16, 1.75],
  [24, 232, 19, 1.7],
  [58, 224, 17, 1.8],
  [92, 212, 15, 1.9],
  [126, 202, 13, 2.0],
  [160, 186, 11, 2.1],
  [192, 164, 9, 2.25],
];

/** Red dendrites growing from the back: a seeded branching tree, as segment list. */
function dendrites(seed: number): number[][] {
  let s = seed >>> 0;
  const rnd = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const segs: number[][] = [];
  const grow = (x: number, y: number, ang: number, len: number, w: number, depth: number): void => {
    // slightly kinked: two sub-segments
    const mx = x + Math.cos(ang) * len * 0.5 + (rnd() - 0.5) * len * 0.12;
    const my = y + Math.sin(ang) * len * 0.5;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    segs.push([x, y, mx, my, w]);
    segs.push([mx, my, ex, ey, w * 0.85]);
    if (depth <= 0) return;
    const n = depth > 2 ? 2 : rnd() < 0.7 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const da = (i === 0 ? -1 : 1) * (0.28 + rnd() * 0.35) + (rnd() - 0.5) * 0.15;
      grow(ex, ey, ang + da, len * (0.62 + rnd() * 0.16), w * 0.7, depth - 1);
    }
  };
  grow(10, 228, Math.PI / 2 + 0.28, 46, 2.6, 4);
  grow(46, 228, Math.PI / 2 - 0.22, 38, 2.2, 4);
  return segs;
}


/** Thin filaments hanging from the belly, swaying: 1 px lines that sell the scale. */
const FILAMENTS: [number, number, number, number][] = [
  [-34, 130, 44, 0.0],
  [-6, 125, 70, 1.7],
  [22, 119, 38, 3.1],
  [47, 115, 88, 0.9],
  [74, 113, 56, 2.4],
  [101, 112, 96, 4.0],
  [128, 113, 62, 5.2],
  [156, 116, 80, 1.3],
  [182, 121, 46, 3.7],
];

function filaments(): string {
  return FILAMENTS.map(([lx, ly, len, ph]) => {
    const [x, y] = toWorld([lx, ly]);
    const seg = len / 3;
    return /* glsl */ `
    {
      vec2 a = ${v2(x, y)};
      float th = 0.1;
      for (int j = 0; j < 3; j++) {
        th += 0.09 * sin(tl * 0.55 + ${f(ph)} + float(j) * 0.9) * float(j + 1);
        vec2 b = a + ${f(seg)} * vec2(sin(th), -cos(th));
        vec2 pa = qbw - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float dd = length(pa - ba * h);
        if (dd < fw) { fil = min(fil, 1.0 - (${f(y)} - qbw.y) / ${f(len + 1)}); }
        a = b;
      }
    }`;
  }).join("");
}

export interface BodyOpts {
  /** Extra fog on far-side parts, the rear, and near the ground. */
  farFog: number;
  rearFog: number;
  groundFog: number;
  /** Height (design units) the ground haze reaches up the legs. */
  groundH?: number;
}

/** The colossus layer body: vec4 layer(vec2 p, vec2 s). */
export function colossusGlsl(c: ColossusDef, o: BodyOpts): string {
  const den = c.dendrites ? dendrites(c.seed) : [];
  const legs = legsGlsl(c);
  let dx0 = Infinity;
  let dx1 = -Infinity;
  let dy1 = -Infinity;
  for (const [x0, y0, x1, y1] of den) {
    dx0 = Math.min(dx0, x0!, x1!);
    dx1 = Math.max(dx1, x0!, x1!);
    dy1 = Math.max(dy1, y0!, y1!);
  }
  return /* glsl */ `
${walkGlsl(c)}
${SDF_LIB}
${legs.decl}
${den.length ? `const vec4 DEN[${den.length}] = vec4[${den.length}](${den.map((d) => `vec4(${f(d[0]!)}, ${f(d[1]!)}, ${f(d[2]!)}, ${f(d[3]!)})`).join(", ")});
const float DENW[${den.length}] = float[${den.length}](${den.map((d) => f(d[4]!)).join(", ")});` : ""}

vec4 layer(vec2 p, vec2 s) {
  float tl = cLoop(cAnimT());
  float bpx = floor(cBodyX(tl) * CS + 0.5);
  float bxw = bpx / CS;
  float bob = cBob(tl);
  vec2 q = vec2(p.x / CS - bxw, (CGND - p.y) / CS);
  if (q.x < ${f(EXTENT.x0)} || q.x > ${f(EXTENT.x1)} || q.y < -8.0 || q.y > ${f(Math.max(EXTENT.y1, dy1 + 4))}) return vec4(0.0);
  vec2 pp = p - vec2(bpx, 0.0);           // body-local whole pixels: dither moves with the body
  vec2 qbw = q + vec2(0.0, bob);          // body parts sit lower by bob
  vec2 qb = ${v2(...PIVOT)} + cRot(${f(TILT)}) * (qbw - ${v2(...PIVOT)});   // body-local (un-pitched)

  // head sway about the neck, and the head-space point
  float hang = ${f(HEAD_PITCH)} + 0.045 * sin(tl * 0.42) + 0.025 * sin(tl * 0.19 + 1.0);
  vec2 qh = ${v2(...HEAD_PIVOT)} + cRot(-hang) * (qb - ${v2(...HEAD_PIVOT)});

  // --- groups, front to back: near legs, tentacles, body, far legs
  vec4 ng = vec4(1e9, 0.0, 1.0, 1.0);
  vec4 fg = vec4(1e9, 0.0, 1.0, 1.0);
  vec4 tg = vec4(1e9, 0.0, 1.0, 1.0);
  float nTar = 0.0, fTar = 0.0;
  vec2 nDir = vec2(0.0, -1.0), fDir = vec2(0.0, -1.0), nKn = vec2(0.0), fKn = vec2(0.0);
  ${legs.body}

  vec4 bd = vec4(1e9, 0.0, 1.0, 1.0);
  if (qb.x > -200.0 && qb.x < 270.0 && qb.y > 60.0 && qb.y < 262.0) {
    bd = cEll(qb, vec2(-20.0, 170.0), vec2(70.0, 44.0), -0.1);
    bd = cU(bd, cEll(qb, vec2(15.0, 202.0), vec2(58.0, 32.0), -0.22), 18.0);
    bd = cU(bd, cEll(qb, vec2(110.0, 162.0), vec2(96.0, 50.0), -0.16), 22.0);
    bd = cU(bd, cEll(qb, vec2(208.0, 128.0), vec2(60.0, 27.0), -0.52), 16.0);
    bd = cU(bd, cCap(qb, vec2(-50.0, 184.0), vec2(-96.0, 197.0), 31.0, 21.0), 14.0);
    // loose skin sagging off the belly and flank in heavy lobes
    bd = cU(bd, cEll(qb, vec2(-4.0, 132.0), vec2(38.0, 15.0), 0.05), 16.0);
    bd = cU(bd, cEll(qb, vec2(70.0, 118.0), vec2(46.0, 14.0), -0.08), 18.0);
    bd = cU(bd, cEll(qb, vec2(150.0, 112.0), vec2(36.0, 12.0), -0.2), 16.0);
    // the skin surface is not a smooth balloon: lumps break the outline
    bd.x += 5.0 * (fbm(qb * 0.03 + ${f(c.seed * 1.7)}, 3) - 0.5) + 2.0 * (vnoise(qb * 0.11) - 0.5);
    // head, in head space
    vec4 hd = cEll(qh, vec2(-128.0, 204.0), vec2(45.0, 25.0), 0.22);
    hd = cU(hd, cEll(qh, vec2(-110.0, 223.0), vec2(31.0, 9.0), 0.12), 7.0);
    hd = cU(hd, cEll(qh, vec2(-143.0, 190.0), vec2(30.0, 15.0), 0.36), 8.0);
    bd = cU(bd, hd, 10.0);
    ${SPINES.map(([x, y, len, a]) => `bd = cU(bd, cCap(qb, ${v2(x, y - 6)}, ${v2(x + Math.cos(a) * len, y - 6 + Math.sin(a) * len)}, 3.4, 0.7), 3.0);`).join("\n    ")}
  }
  if (qh.x > -240.0 && qh.x < -85.0 && qh.y > 0.0 && qh.y < 200.0) {
    ${tentacles(c)}
  }

  // --- hanging filaments (in front of the far legs, behind everything else)
  float fil = 2.0;
  if (qbw.x > -80.0 && qbw.x < 230.0 && qbw.y > 0.0 && qbw.y < 175.0) {
    float fw = 0.55 / CS;
    ${filaments()}
  }

  // --- pick the front-most hit
  int grp = -1;
  vec4 g = vec4(1e9);
  if (ng.x < 0.0) { grp = 0; g = ng; }
  else if (tg.x < 0.0) { grp = 1; g = tg; }
  else if (bd.x < 0.0) { grp = 2; g = bd; }
  else if (fg.x < 0.0) { grp = 3; g = fg; }
  if (grp == 1 || grp == 2) g.yz = cRot(${f(-TILT)}) * g.yz;   // body-local gradient back to world

  float tm = uTime * (1.0 - 0.5 * uReduced);
  float light = flashLight(s);
  if (fil < 1.5 && (grp < 0 || grp == 3)) {
    // fades toward its tip, into the haze
    vec3 c = ramp(R_FLESH, 0.55 - fil * 0.2 + light * 0.4, pp, 0.0);
    c = applyFog(c, uFog, 0.2 + ${f(o.rearFog)} * 0.5 * smoothstep(30.0, 280.0, q.x) + (1.0 - fil) * 0.35, pp, s);
    return vec4(c, 1.0);
  }
  if (grp < 0) {
    ${
      den.length
        ? `// dendrites behind everything, thin, red, deep in the haze
    if (qb.x > ${f(dx0 - 4)} && qb.x < ${f(dx1 + 4)} && qb.y > 200.0 && qb.y < ${f(dy1 + 4)}) {
      vec2 qd = qb;
      qd.x += sin(tl * 0.31 + qd.y * 0.013) * max(0.0, qd.y - 228.0) * 0.035;
      float best = 1e9, bw = 1.0;
      for (int i = 0; i < ${den.length}; i++) {
        vec4 sg = DEN[i];
        vec2 pa = qd - sg.xy, ba = sg.zw - sg.xy;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float dd = length(pa - ba * h) - DENW[i] * 0.5;
        if (dd < best) { best = dd; bw = DENW[i]; }
      }
      // at least a whole pixel wide
      if (best < 0.0 || (best + bw * 0.5) * CS < 0.5) {
        float up = clamp((qd.y - 228.0) / ${f(dy1 - 228)}, 0.0, 1.0);
        vec3 c = ramp(R_VEIN, 0.75 - up * 0.35 + light * 0.4, pp, 0.6);
        c = applyFog(c, uFog, 0.18 + up * 0.28, pp, s);
        return vec4(c, 1.0);
      }
    }`
        : ""
    }
    return vec4(0.0);
  }

  // --- shade: puff the silhouette into a round form
  float qn = clamp(-g.x / max(g.w, 0.6), 0.0, 1.0);
  float e = 1.0 - qn;
  vec3 N = normalize(vec3(g.yz * e, sqrt(max(0.0, 1.0 - e * e)) + 0.06));
  // sagging folds: the skin hangs in drooping creases that follow gravity, so the
  // fold field runs mostly along x and dips between the hips
  float sagF = 0.0, sagMask = 0.0;
  if (grp == 2) {
    vec2 qq = grp == 1 ? qh : qb;
    float droop = 9.0 * sin(qq.x * 0.021 + 0.8) + 5.0 * sin(qq.x * 0.047 + 2.1) + 14.0 * fbm(qq * vec2(0.012, 0.03) + 11.0, 2);
    sagF = (qq.y + droop) * 0.105 + 1.4 * fbm(qq * vec2(0.03, 0.06), 2);
    sagMask = smoothstep(0.38, 0.62, fbm(qq * vec2(0.018, 0.035) + 4.0, 2));
    // the normal rolls over each fold: a lit shelf, then a dark undercut
    float roll = sin(sagF * 6.2832);
    N = normalize(N + vec3(0.0, 0.55 * roll * sagMask, 0.0));
    // ribs pressing through along the flank
    float flank = smoothstep(0.75, 0.2, N.y) * smoothstep(-0.9, -0.2, N.y) * smoothstep(-70.0, -30.0, qb.x) * smoothstep(230.0, 150.0, qb.x);
    N = normalize(N + vec3(0.3 * sin(qb.x * 0.2 + 0.6 * sin(qb.y * 0.05)) * flank * (1.0 - sagMask), 0.0, 0.0));
    // bumpy flesh, not latex: a cheap two-tap gradient of a lump field
    float b0 = fbm(qq * 0.075, 2);
    N = normalize(N + vec3(fbm(qq * 0.075 + vec2(0.35, 0.0), 2) - b0, fbm(qq * 0.075 + vec2(0.0, 0.35), 2) - b0, 0.0) * 2.4);
  }
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  float dif = max(dot(N, L), 0.0);
  float skyl = 0.5 + 0.5 * N.y;
  // flatter than a studio render: the haze fills the shadows
  float shade = 0.16 + 0.42 * dif + 0.18 * skyl;
  float row = R_FLESH;
  float extra = 0.0;
  float px = -g.x * CS;                   // whole pixels inside the edge

  if (grp == 2 || grp == 1) {
    vec2 qq = grp == 1 ? qh : qb;
    // skin: slow wrinkles, creases on the underside, fine speckle
    shade += 0.12 * (fbm(qq * vec2(0.09, 0.14) + ${f(c.seed)}, 3) - 0.5);
    float crease = sin(qq.x * 0.23 + fbm(qq * 0.04, 2) * 6.0 + qq.y * 0.05);
    shade -= 0.1 * smoothstep(0.55, 0.95, crease) * smoothstep(0.35, -0.5, N.y);
    shade -= 0.22 * smoothstep(0.15, -0.8, N.y);
    // the fold lines themselves: a 1 px dark crease under each hanging shelf of
    // skin, a lit lip right above it; broken where the mask says the skin is taut
    float fr = fract(sagF);
    float lw = 0.105 / CS;
    float keep = (grp == 2 ? 1.0 : 0.0) * step(0.45, sagMask + 0.25 * vnoise(qq * 0.06 + 7.0)) * smoothstep(-0.95, -0.4, N.y);
    if (fr < lw * 1.1) shade -= 0.2 * keep;
    else if (fr > 1.0 - lw * 1.2) shade += 0.08 * keep;
    // shorter wrinkles bunched where the legs meet the body
    if (grp == 2) {
      vec2 hv = qb - ${v2(...c.legs[0]!.hip)};
      ${c.legs
        .slice(1)
        .map((l) => `{ vec2 t = qb - ${v2(...l.hip)}; if (dot(t, t) < dot(hv, hv)) hv = t; }`)
        .join("\n      ")}
      float hipW = smoothstep(52.0, 14.0, length(hv));
      if (hipW > 0.0) shade -= 0.12 * hipW * step(0.72, sin(atan(hv.y, hv.x) * 9.0 + fbm(qb * 0.1, 2) * 3.0));
    }
    // pores and small nodules
    vec2 pc = floor(qq * 0.42);
    float ph = hash2(pc + 5.0);
    if (ph < 0.05 && length(fract(qq * 0.42) - 0.5) < 0.3) shade += (ph < 0.02 ? 0.12 : -0.12);
    if (hash2(pp + 11.0) < 0.035) shade -= 0.06;
    if (grp == 1) shade -= 0.05 + 0.1 * smoothstep(150.0, 70.0, qh.y);
    // the eye: a dark socket with one wet highlight
    if (grp == 2) {
      vec2 ed = (qh - ${v2(...EYE)}) * CS;
      float er = max(1.6, 3.4 * CS);
      if (length(ed * vec2(1.0, 1.25)) < er) {
        row = R_TAR;
        shade = 0.08;
        if (ed.x < -er * 0.2 && ed.y > er * 0.15 && ed.x > -er * 0.75) shade = 0.85;
      }
    }
  } else {
    // legs: bark-like striations along the bone, knuckle rings, tar-stained below
    vec2 dir = grp == 0 ? nDir : fDir;
    vec2 kn = grp == 0 ? nKn : fKn;
    float along = dot(q - kn, dir), across = dot(q - kn, vec2(-dir.y, dir.x));
    shade += 0.16 * (fbm(vec2(along * 0.05, across * 0.5), 3) - 0.5);
    float kd = length(q - kn);
    if (abs(kd - g.w * 1.9) * CS < 0.7) shade -= 0.1;
    float tarLine = (grp == 0 ? nTar : fTar) + 14.0 * (fbm(vec2(along * 0.04, 3.0), 2) - 0.5) + 16.0 * (vnoise(vec2(across * 0.3, 1.0)) - 0.5);
    // drips and runs: narrow tongues of tar reaching up the bone
    float drip = hash2(vec2(floor(across * 0.55 + 40.0), 17.0));
    tarLine += drip > 0.7 ? (drip - 0.7) * 90.0 : 0.0;
    float th = q.y - tarLine;
    if (th < (bayer4(pp) - 0.5) * 8.0) {
      row = R_TAR;
      // wet sheen along the lit side
      float sp = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 6.0);
      shade = 0.1 + 0.42 * dif + 0.12 * skyl + 0.5 * sp + 0.12 * (fbm(vec2(along * 0.08, across * 0.7), 2) - 0.5);
    }
    // the far side is in the body's shadow and deeper in the haze
    if (grp == 3) { shade = shade * 0.7 - 0.04; extra += ${f(o.farFog)} + 0.12 * smoothstep(60.0, 220.0, q.y); }
  }

  // haze: the rear dissolves, the feet stand in ground haze, thin edges go soft
  extra += ${f(o.rearFog)} * smoothstep(30.0, 280.0, q.x);
  extra += ${f(o.groundFog)} * (1.0 - smoothstep(0.0, ${f(o.groundH ?? 80)}, q.y));
  // edges: only the edge facing the key light catches a rim; the shadow edge
  // goes a step darker, so a thin limb reads as a lit form, not an outline
  float lit = dot(g.yz, normalize(vec2(-0.55, 0.62)));
  if (px < 1.0) shade += lit > 0.25 ? 0.1 : lit < -0.2 ? -0.06 : 0.0;
  // thin parts (a few px across) sink into the haze as a whole, both sides alike
  extra += 0.22 * smoothstep(4.0, 1.2, g.w * CS);
  // lightning in the haze behind: rim on the lit and thin edges, a little on the body
  shade += light * (0.22 + 0.7 * e * e * (0.4 + 0.6 * step(0.0, lit)));
  // cloud shadows and breaks of sun passing over it
  shade += sceneLight(s, uDepth) * 1.2;

  vec3 c = ramp(row, shade, pp, uDither);
  // fog in 8 steps, dithered only right at each step edge (no screen door)
  float fq = clamp(uFog + stepd(clamp(extra, 0.0, 1.0), 8.0, pp, 0.4), 0.0, 1.0);
  c = mix(c, fogColor(s), fq);
  return vec4(c, 1.0);
}`;
}

/** Dust kicked up where feet plant (a billow and a low skirt) and a smaller puff when they lift. */
export function dustGlsl(c: ColossusDef, o: { farFog: number; strength: number }): string {
  const legs = legList(c);
  return /* glsl */ `
${walkGlsl(c)}
vec4 layer(vec2 p, vec2 s) {
  float tl = cLoop(cAnimT());
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float best = 0.0;
  float farN = 0.0;
  ${legs
    .map(
      ({ hx, phase, far }) => `
  {
    float sw, age;
    vec2 fw = cFoot(tl, ${f(phase)}, ${f(hx)}, sw, age);
    float lift = sw >= 0.0 ? 1.0 : 0.0;
    float X = (fw.x + (sw >= 0.0 ? CVD * CTC * (sw * sw * (3.0 - 2.0 * sw)) : 0.0)) * CS + age * ${f(2.2)} * CS;
    float grow = 1.0 - exp(-age / 1.6);
    float R = CS * mix(12.0, 50.0, grow) * (1.0 - 0.45 * lift);
    float Hh = R * (0.6 + 0.25 * grow);
    vec2 r = vec2((p.x - X) / R, (CGND - p.y) / Hh);
    float dens = 0.0;
    if (abs(r.x) < 1.3 && r.y > -0.3 && r.y < 1.4) {
      float n = fbm(vec2(p.x - X, p.y) / (CS * 7.0) + vec2(age * 0.35, -age * 0.25) + ${f(phase * 17 + (far ? 5 : 0))}, 3);
      float dome = 1.0 - length(vec2(r.x, max(0.0, r.y) * 1.1));
      dens = max(0.0, dome) * (0.55 + 0.9 * n) * exp(-age / ${f(3.2)}) * (1.0 - 0.6 * lift);
    }
    // the skirt: a low, fast ring of dust along the ground right after the plant
    float R2 = CS * (12.0 + 78.0 * (1.0 - exp(-age / 0.9)));
    float dy = CGND - p.y;
    if (lift < 0.5 && dy > -1.0 && dy < CS * 7.0 + 2.0 && abs(p.x - X) < R2) {
      float edge = smoothstep(0.35, 1.0, abs(p.x - X) / R2);
      float k = (1.0 - dy / (CS * 7.0 + 2.0)) * exp(-age / 1.1) * (0.4 + edge) * (0.6 + 0.8 * vnoise(vec2(p.x / (CS * 4.0) + age, 2.0)));
      dens = max(dens, k * 0.8);
    }
    if (dens > best) { best = dens; farN = ${far ? "1.0" : "0.0"}; }
  }`,
    )
    .join("")}
  float lv = floor(clamp(best * ${f(o.strength)}, 0.0, 1.0) * 3.0 + (bayer4(p) - 0.5) * 0.9);
  if (lv <= 0.0) return vec4(0.0);
  lv = min(lv, 3.0);
  float light = flashLight(s);
  vec3 c = ramp(R_DUST, 0.12 + 0.16 * lv + 0.14 * clamp((CGND - p.y) / (CS * 30.0), 0.0, 1.0) + light * 0.5 + sceneLight(s, uDepth), p, 0.0);
  c = applyFog(c, uFog, farN * ${f(o.farFog)}, p, s);
  return vec4(c, 0.45 + 0.18 * lv);
}`;
}

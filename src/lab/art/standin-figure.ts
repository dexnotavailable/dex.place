// Procedural stand-in for the player character: a priest with a long
// polearm, ~96 px tall at native resolution. It exists so every runtime
// system (clips, events, lighting, rim, VFX timing) can be judged before the
// Blender pipeline exports real frames. Direction follows the design notes in
// docs/character: white and gold vestments, cross motifs, detached sleeves,
// front/back tabards, garters, thigh-highs, boots, long dark hair, halo.
//
// Figure space: x forward (facing right), y down, origin on the ground
// between the feet (the pivot).

import { Palette, PixBuf, type Material, type RGBi } from "./pixbuf.ts";

export type Expr = "open" | "focus" | "closed" | "shout" | "hurt" | "smile";

export interface Pose {
  /** Pelvis centre. */
  hip: [number, number];
  /** Lower spine lean from vertical, degrees, + = forward. */
  lean: number;
  /** Extra upper-spine bend. */
  chest: number;
  /** Head nod, + = down/forward. */
  head: number;
  /** Ankle targets. */
  footN: [number, number];
  footF: [number, number];
  /** Foot pitch, + = toes pointing down. */
  toeN?: number;
  toeF?: number;
  /** Weapon: near-hand grip x, y and angle (0 = forward, -90 = up). */
  wpn: [number, number, number];
  /** Near hand position along the shaft, px from the butt. */
  slide?: number;
  /** Far hand: along-shaft offset from the grip (+ toward the blade) or a free position. */
  handF?: number | [number, number];
  /** Near hand free position (the weapon then hangs from the far hand at wpn). */
  handN?: [number, number];
  /** Weapon drawn behind the body instead of in front. */
  wBack?: boolean;
  /** Long hair flow, degrees from hanging (+ = trailing back). */
  hair: number;
  hairLift?: number;
  /** Tabard flow, degrees (+ = trailing back). */
  cloth: number;
  clothLift?: number;
  sleeve?: number;
  expr?: Expr;
  /** Vertical stretch about the pivot (<1 squash). */
  stretch?: number;
  /** Elbow bend side, 1 = back/down (default). */
  elbowN?: number;
  elbowF?: number;
  /** Hide the face features (fast turns / smears). */
  noFace?: boolean;
}

// ---------------------------------------------------------------------------
// Palette. White cloth has lilac, hue-shifted shadows; gold is warm; hair is
// blue-black with a cool sheen. Values: dark hair/legwear, mid skin, light
// vestments, so she reads in three value bands at a glance.
// ---------------------------------------------------------------------------
export const PAL = new Palette();
export const M = {
  skin: PAL.add({ tones: ["#b0646a", "#dc9282", "#f0bca4", "#f9cfba", "#ffe2d2"], line: "#7a3444", lite: "#b86a70" }),
  face: PAL.add({ tones: ["#e0998e", "#f3bba8", "#fbd3c0", "#fddcca", "#fde2d2"], line: "#b0606e", lite: "#d08a8c", ink: true, bias: 0.2 }),
  hair: PAL.add({ tones: ["#0b0c1a", "#151930", "#20274a", "#2c3868", "#3c4a86"], line: "#05050c", lite: "#0b0c1a" }),
  hairSheen: PAL.add({ tones: ["#2c3868", "#3c4c8c", "#5062a8", "#6a7cc4", "#8898dc"], line: "#05050c", lite: "#0b0c1a" }),
  cloth: PAL.add({ tones: ["#7f7a9e", "#b5b0cc", "#e4e0ee", "#f6f3f8", "#ffffff"], line: "#3a3656", lite: "#6e6a8e" }),
  clothIn: PAL.add({ tones: ["#5d5878", "#8a85a6", "#b6b1cb", "#d3cfe0", "#e6e3ee"], line: "#2c2944", lite: "#4d4868" }),
  gold: PAL.add({ tones: ["#6e3f10", "#a86a1c", "#d9a032", "#f5cf62", "#fff2b0"], line: "#3a2008", lite: "#7a4a14", shine: 0.25 }),
  sock: PAL.add({ tones: ["#09090f", "#13131e", "#20202f", "#353450", "#4c4b6e"], line: "#030306", lite: "#13131e", bias: 0.4 }),
  boot: PAL.add({ tones: ["#77728f", "#aca7c2", "#dedaea", "#f3f1f7", "#ffffff"], line: "#2e2a44", lite: "#5e5a78" }),
  shaft: PAL.add({ tones: ["#0e0f1e", "#1a1c33", "#282b4a", "#3c4170", "#6a73a8"], line: "#06060e", lite: "#1a1c33", shine: 0.15 }),
  blade: PAL.add({ tones: ["#5b6488", "#98a3c8", "#cfd8f0", "#eef3ff", "#ffffff"], line: "#1e2240", lite: "#4a5278", shine: 0.35 }),
  ribbon: PAL.add({ tones: ["#15406a", "#2270a8", "#3aa6e0", "#7fd6ff", "#c8f0ff"], line: "#0a1e36", lite: "#15406a" }),
  halo: PAL.add({ tones: ["#b07820", "#e0a838", "#ffd970", "#fff0a8", "#ffffff"], line: "#5a3a0c", lite: "#8a5a18", ink: false, bias: 0.8 }),
};

const C = {
  lash: [20, 12, 28],
  lashLo: [96, 60, 90],
  irisD: [22, 70, 140],
  iris: [48, 142, 222],
  irisL: [140, 222, 255],
  hi: [255, 255, 255],
  white: [248, 242, 248],
  mouth: [206, 112, 120],
  mouthD: [110, 34, 56],
  blush: [246, 172, 168],
  brow: [40, 36, 64],
} satisfies Record<string, RGBi>;

// ---------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------
type V = [number, number];
const DEG = Math.PI / 180;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const len = (a: V): number => Math.hypot(a[0], a[1]);
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** Rotate by degrees (clockwise on screen, y down). */
const rot = (v: V, deg: number): V => {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};
const perp = (a: V): V => [-a[1], a[0]];

/** Two-bone IK. sign picks the joint side. Returns joint and (possibly clamped) end. */
function ik(a: V, b: V, l1: number, l2: number, sign: number): { j: V; e: V; reach: boolean } {
  const d0 = sub(b, a);
  let d = len(d0);
  const reach = d <= l1 + l2 - 0.05;
  const dir = norm(d0);
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.05), l1 + l2 - 0.05);
  const e = add(a, mul(dir, d));
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const base = Math.atan2(dir[1], dir[0]);
  const ja = base + sign * ang;
  return { j: [a[0] + Math.cos(ja) * l1, a[1] + Math.sin(ja) * l1], e, reach };
}

/** Centripetal-ish Catmull-Rom through closed points; sharp[i] keeps a corner. */
function smooth(pts: V[], closed = true, steps = 3, sharp?: boolean[]): number[] {
  const out: number[] = [];
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    const q0 = !closed && i === 0 ? p1 : p0;
    const q3 = !closed && i === n - 2 ? p2 : p3;
    out.push(p1[0], p1[1]);
    if (sharp?.[i] || sharp?.[(i + 1) % n]) continue;
    for (let s = 1; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(f(q0[0], p1[0], p2[0], q3[0]), f(q0[1], p1[1], p2[1], q3[1]));
    }
  }
  if (!closed) out.push(pts[n - 1]![0], pts[n - 1]![1]);
  return out;
}

// ---------------------------------------------------------------------------
// Proportions (px). ~96 px tall, ~6 heads, legs about half the height.
// ---------------------------------------------------------------------------
export const FIG = {
  thigh: 23.5,
  shin: 22.5,
  /** Extra leg length over the pose data's reference legs: the pelvis rises by this much. */
  legExtra: 3,
  upperArm: 12,
  foreArm: 11,
  pelvisToWaist: 9,
  waistToNeck: 20,
  neck: 3.5,
  weapon: 110,
  blade: 21,
};

// groups (for inner lines and cast shadows)
const G = {
  hairBack: 1, sleeveF: 2, armF: 3, legF: 4, tabardB: 5, torso: 6, legN: 7, tabardF: 8, armN: 9, sleeveN: 10,
  neck: 11, face: 12, hairFront: 13, weapon: 14, halo: 15, handN: 16, handF: 17, lock: 18, bootN: 19, bootF: 20, skirt: 21,
  hairClump: 22, hairClump2: 23,
};

export interface Skeleton {
  pelvis: V;
  waist: V;
  neckBase: V;
  headC: V;
  angL: number;
  angC: number;
  hipN: V;
  hipF: V;
  kneeN: V;
  kneeF: V;
  ankleN: V;
  ankleF: V;
  shN: V;
  shF: V;
  elN: V;
  elF: V;
  haN: V;
  haF: V;
  wGrip: V;
  wDir: V;
  wButt: V;
  wTip: V;
  reachWarn: string[];
}

export function solve(p: Pose): Skeleton {
  const st = p.stretch ?? 1;
  const S = (v: V): V => [v[0] / Math.sqrt(st), v[1] * st];
  // everything above the legs rises with the longer legs; feet stay on their targets
  const U = (v: V): V => S([v[0], v[1] - FIG.legExtra]);
  const pelvis = U(p.hip);
  const angL = p.lean;
  const angC = p.lean + p.chest;
  const waist = add(pelvis, rot([0, -FIG.pelvisToWaist * st], angL));
  const neckBase = add(waist, rot([0, -FIG.waistToNeck * st], angC));
  const headC = add(neckBase, rot([1.4, -(FIG.neck + 8.2)], angC * 0.6 + p.head * 0.5));
  const hipN = add(pelvis, rot([-1.6, 1.2], angL));
  const hipF = add(pelvis, rot([1.9, 0.8], angL));
  const warn: string[] = [];
  const legN = ik(hipN, S(p.footN), FIG.thigh, FIG.shin, -1);
  const legF = ik(hipF, S(p.footF), FIG.thigh, FIG.shin, -1);
  const shN = add(neckBase, rot([-3.4, 3.2], angC));
  const shF = add(neckBase, rot([2.6, 2.8], angC));
  // weapon
  const wDir: V = [Math.cos(p.wpn[2] * DEG), Math.sin(p.wpn[2] * DEG)];
  const slide = p.slide ?? 40;
  let gripTarget = U([p.wpn[0], p.wpn[1]]);
  let armN: { j: V; e: V; reach: boolean };
  let armF: { j: V; e: V; reach: boolean };
  if (p.handN) {
    // weapon carried by the far hand only
    armF = ik(shF, gripTarget, FIG.upperArm, FIG.foreArm, p.elbowF ?? 1);
    if (!armF.reach) warn.push("far hand cannot reach grip");
    gripTarget = armF.e;
    armN = ik(shN, U(p.handN), FIG.upperArm, FIG.foreArm, p.elbowN ?? 1);
  } else {
    armN = ik(shN, gripTarget, FIG.upperArm, FIG.foreArm, p.elbowN ?? 1);
    if (!armN.reach) warn.push("near hand cannot reach grip");
    gripTarget = armN.e;
    if (typeof p.handF === "number") {
      const t = add(gripTarget, mul(wDir, p.handF));
      armF = ik(shF, t, FIG.upperArm, FIG.foreArm, p.elbowF ?? 1);
      if (!armF.reach) warn.push("far hand cannot reach shaft");
    } else {
      armF = ik(shF, U(p.handF ?? [p.wpn[0] + 4, p.wpn[1] + 6]), FIG.upperArm, FIG.foreArm, p.elbowF ?? 1);
    }
  }
  const wGrip = gripTarget;
  const wButt = add(wGrip, mul(wDir, -slide));
  const wTip = add(wButt, mul(wDir, FIG.weapon));
  return {
    pelvis, waist, neckBase, headC, angL, angC, hipN, hipF,
    kneeN: legN.j, kneeF: legF.j, ankleN: legN.e, ankleF: legF.e,
    shN, shF, elN: armN.j, elF: armF.j, haN: armN.e, haF: armF.e,
    wGrip, wDir, wButt, wTip, reachWarn: warn,
  };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Points in a local frame (origin o, rotated by deg) to figure space. */
const frame = (o: V, deg: number) => (x: number, y: number): V => add(o, rot([x, y], deg));
const proj = (p: V, o: V, d: V): number => (p[0] + 0.5 - o[0]) * d[0] + (p[1] + 0.5 - o[1]) * d[1];

function drawLeg(b: PixBuf, hip: V, knee: V, ankle: V, toe: number, near: boolean, g: number, gBoot: number): void {
  const th = sub(knee, hip), sh = sub(ankle, knee);
  const tn = norm(th), sn = norm(sh);
  const tp = perp(tn), sp = perp(sn);
  const at = (a: V, d: V, t: number): V => add(a, mul(d, t));
  const k = near ? 1 : 0.94;
  // -perp is the front of the leg. Front of the shin stays straight, the calf bulges at the back.
  const pts: V[] = [
    add(at(hip, th, -0.16), mul(tp, -4.3 * k)),
    add(at(hip, th, 0.2), mul(tp, -4.2 * k)),
    add(at(hip, th, 0.55), mul(tp, -3.4 * k)),
    add(at(hip, th, 0.86), mul(tp, -2.5 * k)),
    add(at(knee, sh, 0.06), mul(sp, -2.2 * k)),
    add(at(knee, sh, 0.4), mul(sp, -1.8 * k)),
    add(at(knee, sh, 0.8), mul(sp, -1.35 * k)),
    add(at(knee, sh, 1.02), mul(sp, -1.2)),
    add(at(knee, sh, 1.02), mul(sp, 1.25)),
    add(at(knee, sh, 0.72), mul(sp, 1.6 * k)),
    add(at(knee, sh, 0.34), mul(sp, 2.6 * k)),
    add(at(knee, sh, 0.1), mul(sp, 2.3 * k)),
    add(at(hip, th, 0.9), mul(tp, 2.3 * k)),
    add(at(hip, th, 0.55), mul(tp, 3.0 * k)),
    add(at(hip, th, 0.18), mul(tp, 3.9 * k)),
    add(at(hip, th, -0.18), mul(tp, 3.6 * k)),
  ];
  const tlen = len(th);
  const sockTop = 0.46;
  b.poly(smooth(pts, true, 3), M.skin, g, {
    round: 3.2,
    inkSkip: (x, y) => proj([x, y], hip, tn) / tlen < 0.3,
    paint: (x, y) => {
      const u = proj([x, y], hip, tn) / tlen;
      if (u < sockTop - 0.06) return M.skin;
      if (u < sockTop) return M.gold;
      return M.sock;
    },
  });
  // boot: white with a gold cuff and toe cap, low heel
  const f = norm([Math.cos(toe * DEG), Math.sin(toe * DEG)]);
  const up: V = [f[1], -f[0]];
  const A = (fx: number, ux: number): V => add(ankle, add(mul(f, fx), mul(up, ux)));
  const bootTop = at(knee, sh, 0.64);
  const bootPts: V[] = [
    add(bootTop, mul(sp, -1.9)),
    add(at(knee, sh, 0.88), mul(sp, -1.6)),
    A(1.4, 1.2),
    A(3.8, 0.4),
    A(5.6, -1.4),
    A(4.2, -2.2),
    A(-0.6, -2.5),
    A(-1.8, -3.3),
    A(-2.1, -2.2),
    A(-1.9, 0.6),
    add(at(knee, sh, 0.86), mul(sp, 1.7)),
    add(bootTop, mul(sp, 2.1)),
  ];
  const shl = len(sh);
  b.poly(smooth(bootPts, true, 2, bootPts.map((_, i) => i === 4 || i === 7)), M.boot, gBoot, {
    round: 2,
    paint: (x, y) => {
      const u = proj([x, y], knee, sn) / shl;
      if (u < 0.7) return M.gold;
      if (proj([x, y], ankle, f) > 3.6) return M.gold;
      return M.boot;
    },
  });
}

function drawArm(b: PixBuf, sh: V, el: V, ha: V, g: number, near: boolean): void {
  const ua = sub(el, sh), fa = sub(ha, el);
  const un = norm(ua), fn = norm(fa);
  const up = perp(un), fp = perp(fn);
  const s = near ? 1 : 0.94;
  const pts: V[] = [
    add(add(sh, mul(un, -1.4)), mul(up, -2.1 * s)),
    add(add(sh, mul(ua, 0.4)), mul(up, -1.8 * s)),
    add(el, mul(up, -1.3 * s)),
    add(add(el, mul(fa, 0.35)), mul(fp, -1.4 * s)),
    add(add(el, mul(fa, 1.0)), mul(fp, -0.95)),
    add(add(el, mul(fa, 1.0)), mul(fp, 0.95)),
    add(add(el, mul(fa, 0.35)), mul(fp, 1.3 * s)),
    add(el, mul(up, 1.3 * s)),
    add(add(sh, mul(ua, 0.4)), mul(up, 1.7 * s)),
    add(add(sh, mul(un, -1.4)), mul(up, 1.9 * s)),
  ];
  b.poly(smooth(pts, true, 3), M.skin, g, { round: 1.7, inkSkip: (x, y) => proj([x, y], sh, un) < 1.5 });
}

function drawHand(b: PixBuf, h: V, dir: V, g: number): void {
  const c = add(h, mul(dir, 0.3));
  b.ellipse(c[0], c[1], 1.9, 1.7, Math.atan2(dir[1], dir[0]), M.skin, g, { round: 1.4 });
}

/** Detached bell sleeve: a tube from the arm band over the forearm that flares and hangs with gravity. */
function drawSleeve(b: PixBuf, sh: V, el: V, ha: V, flow: number, g: number, inner: boolean): void {
  const ua = sub(el, sh), fa = sub(ha, el);
  const band = add(sh, mul(ua, 0.58));
  const fdir = norm(fa);
  const cuff = add(ha, mul(fdir, -0.6));
  const grav: V = norm(rot([0, 1], -flow));
  const samples: [V, V, number, number][] = [
    [band, norm(ua), 1.9, 0],
    [el, norm(add(norm(ua), fdir)), 2.2, 0.3],
    [add(el, mul(fa, 0.5)), fdir, 2.7, 1.3],
    [cuff, fdir, 3.3, 2.6],
  ];
  const sideA: V[] = [], sideB: V[] = [];
  for (const [c, d, hw, droop] of samples) {
    const p = perp(d);
    const a = add(c, mul(p, hw)), bb = add(c, mul(p, -hw));
    const aDown = p[0] * grav[0] + p[1] * grav[1] > 0;
    sideA.push(aDown ? add(a, mul(grav, droop)) : a);
    sideB.push(aDown ? bb : add(bb, mul(grav, droop)));
  }
  const poly: V[] = [...sideA, ...sideB.reverse()];
  const sharp = poly.map((_, i) => i === 3 || i === 4);
  b.poly(smooth(poly, true, 3, sharp), inner ? M.clothIn : M.cloth, g, {
    round: 2.2,
    trim: { mat: M.gold, width: 1, where: (x, y) => proj([x, y], cuff, fdir) > -1.4 || proj([x, y], band, norm(ua)) < 0.9 },
  });
}

/** Hanging panel (tabard) with gold trim and a cross. */
function drawTabard(b: PixBuf, anchor: V, baseAng: number, flow: number, lift: number, length: number, width: number, g: number, back: boolean): void {
  const n = 7;
  const pts: number[] = [];
  const widths: number[] = [];
  let p = anchor;
  const centre: V[] = [p];
  pts.push(p[0], p[1]);
  const seg = length / (n - 1);
  for (let i = 1; i < n; i++) {
    const t = i / (n - 1);
    const a = baseAng - flow * Math.pow(t, 1.25) - lift * t * 34;
    p = add(p, rot([0, seg], a));
    centre.push(p);
    pts.push(p[0], p[1]);
  }
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = width * (1 + t * 0.12);
    widths.push(t < 0.78 ? w : w * (1 - (t - 0.78) / 0.22) + 0.4);
  }
  const cx = centre[3]!;
  const dir = norm(sub(centre[4]!, centre[2]!));
  const pp = perp(dir);
  b.ribbon(pts, widths, back ? M.clothIn : M.cloth, g, {
    round: 1.8,
    tilt: [back ? -0.2 : 0.12, 0],
    trim: { mat: M.gold, width: 1 },
    paint: (x, y) => {
      if (back) return undefined;
      const along = proj([x, y], cx, dir), across = proj([x, y], cx, pp);
      if ((Math.abs(across) < 0.55 && along > -2.2 && along < 2.8) || (Math.abs(along + 0.6) < 0.55 && Math.abs(across) < 1.6)) return M.gold;
      return undefined;
    },
  });
}

function drawTorso(b: PixBuf, s: Skeleton): void {
  const P = frame(s.pelvis, s.angL);
  const W = frame(s.waist, s.angC);
  const pts: V[] = [
    W(2.0, -17.2), // neck front
    W(3.3, -13.8), // chest top
    W(5.8, -11.0), // upper bust
    W(6.9, -8.5), // bust apex
    W(5.4, -5.9), // under bust
    W(3.0, -3.6),
    W(2.2, 0), // waist front
    P(3.3, -5.4),
    P(4.4, -2.0), // lower belly
    P(4.6, 1.6),
    P(2.6, 4.2), // groin
    P(-1.0, 4.8),
    P(-4.7, 3.6), // under butt
    P(-7.4, 0.8), // butt
    P(-6.8, -3.0),
    P(-4.0, -7.2), // lower back
    W(-2.8, -1.0), // waist back
    W(-4.0, -6.0),
    W(-4.6, -11.0), // shoulder blade
    W(-4.1, -15.0),
    W(-2.2, -17.4), // neck back
  ];
  const toW = (x: number, y: number): V => rot(sub([x + 0.5, y + 0.5], s.waist), -s.angC);
  const toP = (x: number, y: number): V => rot(sub([x + 0.5, y + 0.5], s.pelvis), -s.angL);
  b.poly(smooth(pts, true, 3), M.cloth, G.torso, {
    round: 4.2,
    paint: (x, y) => {
      const w = toW(x, y);
      const pl = toP(x, y);
      if (w[1] > -1.4 && w[1] < 0.7) return M.gold; // belt
      if (pl[1] > -6.2 && w[1] > 0.7) {
        // hips: bare at the side between the tabards, garter belt across
        if (pl[0] > 1.8) return M.cloth;
        if (Math.abs(pl[1] + 3.0) < 0.55) return M.gold;
        return M.skin;
      }
      // chest window: a gold-framed diamond under the collar
      const kx = w[0] - 2.6, ky = w[1] + 13.2;
      const dd = Math.abs(kx) * 1.1 + Math.abs(ky) * 0.62;
      if (dd < 1.1) return M.skin;
      if (dd < 1.9) return M.gold;
      return undefined;
    },
  });
  // high collar
  const col: V[] = [W(-1.8, -16.2), W(2.3, -16.4), W(2.7, -19.8), W(-1.3, -20.3)];
  b.poly(smooth(col, true, 2), M.cloth, G.torso, { round: 1.6, trim: { mat: M.gold, width: 1, where: (_x, y) => y + 0.5 > W(0, -17.0)[1] } });
  const cc = W(1.8, -18.3);
  b.pix(cc[0], cc[1] - 1, [255, 226, 128]);
  b.pix(cc[0], cc[1], [217, 160, 50]);
  b.pix(cc[0] - 1, cc[1], [217, 160, 50]);
  b.pix(cc[0] + 1, cc[1], [217, 160, 50]);
  b.pix(cc[0], cc[1] + 1, [168, 106, 28]);
}

/**
 * Face features as fixed pixel stamps: never rotated or scaled, so they stay
 * crisp. Near eye: outer corner (lash flick) on the left; far eye: outer
 * corner on the right, sclera toward the nose.
 */
const EYES: Record<Expr, { n: string[]; f: string[]; mouth: string[] }> = {
  open: { n: ["..LLL", "LLIWL", ".eiIe", "..yy."], f: ["LLL.", "IWLL", "iIe.", "yy.."], mouth: ["m"] },
  smile: { n: ["..LLL", "LLIWL", ".eiIe", "....."], f: ["LLL.", "IWLL", "iIe.", "...."], mouth: ["mm"] },
  focus: { n: [".....", "LLLLL", ".eIWe", "..yy."], f: ["....", "LLLL", "IWe.", "yy.."], mouth: ["m"] },
  closed: { n: [".....", ".....", "L...L", ".LLL."], f: ["....", "....", "L..L", ".LL."], mouth: ["m"] },
  shout: { n: ["..LLL", "LLIWL", ".eiIe", "..yy."], f: ["LLL.", "IWLL", "iIe.", "yy.."], mouth: ["dd", "dd"] },
  hurt: { n: [".....", "LL...", "..LLL", "LL..."], f: ["....", "..LL", "LL..", "..LL"], mouth: ["dd"] },
};

/** Head scale: pixel art needs a bigger head than the body maths says (~5.3 heads). */
const HS = 1.24;

function drawHead(b: PixBuf, s: Skeleton, pose: Pose): void {
  const h = s.headC;
  const tilt = pose.head * 0.5 + s.angC * 0.35;
  const R = (x: number, y: number): V => add(h, rot([x * HS, y * HS], tilt));
  const face: V[] = [
    R(-4.4, -4.4), R(5.0, -4.8), R(6.0, -1.8), R(5.7, 0.3), R(6.1, 1.8), R(5.1, 4.0), R(3.2, 6.2),
    R(2.2, 6.3), R(0.0, 4.9), R(-3.2, 3.0), R(-4.4, 0.6),
  ];
  b.poly(smooth(face, true, 3, face.map((_, i) => i === 6)), M.face, G.face, { round: 3.6, bulge: 0.5 });
  const ear = R(-3.6, 1.3);
  b.ellipse(ear[0], ear[1], 1.2, 1.8, 0, M.face, G.face, { round: 1 });
  if (!pose.noFace) {
    const E = EYES[pose.expr ?? "open"];
    const hx = Math.round(h[0] + Math.sin(tilt * DEG) * -1.5), hy = Math.round(h[1] + 0.4);
    const stamp = (rows: string[], x0: number, y0: number): void => {
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx]!;
          const col =
            ch === "L" ? C.lash : ch === "l" ? C.lashLo : ch === "I" ? C.irisD : ch === "i" ? C.iris : ch === "y" ? C.irisL :
            ch === "W" ? C.hi : ch === "e" ? C.white : ch === "m" ? C.mouth : ch === "d" ? C.mouthD : ch === "b" ? C.blush : null;
          if (col) b.pix(x0 + rx, y0 + ry, col, G.face);
        }
      });
    };
    stamp(E.n, hx - 4, hy - 2);
    stamp(E.f, hx + 2, hy - 2);
    b.pix(hx - 3, hy + 3, C.blush, G.face);
    b.pix(hx + 3, hy + 3, C.blush, G.face);
    stamp(E.mouth, hx + 2, hy + 5);
  }
}

const strands: { pts: number[] }[] = [];

function drawHairBack(b: PixBuf, s: Skeleton, pose: Pose): void {
  strands.length = 0;
  const h = s.headC;
  const flow = pose.hair;
  const lift = pose.hairLift ?? 0;
  const mass = (off: number, lengthK: number, wK: number, bend: number, g: number): void => {
    const pts: number[] = [];
    const ws: number[] = [];
    let p: V = add(h, [(-2.2 + off) * HS, -3 * HS]);
    const n = 9;
    const segL = (48 * lengthK) / (n - 1);
    pts.push(p[0], p[1]);
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1);
      const a = s.angC * 0.4 + flow * Math.pow(t, 0.9) + bend * t + lift * 70 * t + Math.sin(t * 5 + off) * 3;
      p = add(p, rot([-0.9 * (1 - t), segL], a));
      pts.push(p[0], p[1]);
    }
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      ws.push(wK * HS * (t < 0.12 ? 12.8 : 13.2 - t * 8.4) * (t > 0.78 ? ((1 - t) / 0.22) * 0.85 + 0.15 : 1));
    }
    b.ribbon(pts, ws, M.hair, g, { round: 3.4 });
  };
  mass(0, 1, 1, 0, G.hairBack);
  // two thin sheen strands following the flow
  for (const [off, kLen] of [[-1.2, 0.62], [1.6, 0.5]] as const) {
    const pts: number[] = [];
    let p: V = add(h, [(-3.2 + off) * HS, 3 * HS]);
    pts.push(p[0], p[1]);
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      p = add(p, rot([-0.3, (40 * kLen) / 5], s.angC * 0.4 + flow * Math.pow(t, 0.9) + lift * 70 * t + Math.sin(t * 5 + off) * 3));
      pts.push(p[0], p[1]);
    }
    strands.push({ pts });
  }
  // separate clumps with their own outline so the mass reads as strands
  mass(-1.8, 0.82, 0.46, 12, G.hairClump);
  mass(1.4, 0.94, 0.42, -8, G.hairClump2);
  b.ellipse(h[0] - 0.8 * HS, h[1] - 1.5 * HS, 7.5 * HS, 7.9 * HS, 0, M.hair, G.hairBack, { round: 4.5 });
  for (const st of strands) {
    for (let i = 0; i + 3 < st.pts.length - 2; i += 2) {
      const [x0, y0, x1, y1] = [st.pts[i]!, st.pts[i + 1]!, st.pts[i + 2]!, st.pts[i + 3]!];
      if (i === 0) continue;
      const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k < steps; k++) b.paintMat(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, M.hairSheen, -1);
    }
  }
}

function drawHairFront(b: PixBuf, s: Skeleton, pose: Pose): void {
  const h = s.headC;
  const tilt = pose.head * 0.5 + s.angC * 0.35;
  const R = (x: number, y: number): V => add(h, rot([x * HS, y * HS], tilt));
  const bangs: V[] = [
    R(-7.8, -1.2), R(-7.5, -6.8), R(-3.7, -9.8), R(1.8, -9.7), R(5.7, -7.3), R(7.2, -3.8),
    R(7.1, -0.4), R(6.1, -2.4), R(5.5, -0.2), R(4.4, -2.8), R(3.3, -1.5), R(2.1, -3.3),
    R(0.9, -2.0), R(-0.4, -3.6), R(-1.8, -2.1), R(-3.3, -3.8), R(-4.5, -0.5), R(-5.8, -2.5),
  ];
  // "angel ring" sheen across the crown
  const sheenC = R(-0.6, -2.2);
  b.poly(smooth(bangs, true, 3, bangs.map((_, i) => i >= 6)), M.hair, G.hairFront, {
    round: 3.2,
    paint: (x, y) => {
      const dx = (x + 0.5 - sheenC[0]) / HS, dy = (y + 0.5 - sheenC[1]) / HS;
      const r = Math.hypot(dx * 0.95, dy * 1.15);
      if (r > 5.5 && r < 6.5 && dy < -2.6 && dx > -5.2 && dx < 4.2) return M.hairSheen;
      return undefined;
    },
  });
  const flow = pose.hair * 0.5;
  const lock = (x: number, y: number, L: number, w: number, g: number): void => {
    const pts: number[] = [];
    let p = R(x, y);
    pts.push(p[0], p[1]);
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      p = add(p, rot([0.25, L / 5], flow * t + (pose.hairLift ?? 0) * 40 * t));
      pts.push(p[0], p[1]);
    }
    b.ribbon(pts, [w, w, w * 0.9, w * 0.75, w * 0.5, 0.6], M.hair, g, { round: 1.6 });
  };
  lock(-4.8, -1.2, 17, 3.6, G.lock);
  lock(6.2, -2.0, 9, 2.4, G.lock);
  // ahoge: one small upturned strand for personality
  const top = R(0.5, -9.4);
  const ah: number[] = [top[0], top[1]];
  let q = top;
  for (let i = 1; i <= 3; i++) {
    q = add(q, rot([1.2, -1.6], 25 * i + pose.hair * 0.3));
    ah.push(q[0], q[1]);
  }
  b.ribbon(ah, [1.8, 1.4, 1, 0.4], M.hair, G.hairFront, { round: 1 });
  const pin = R(-5.8, -4.4);
  b.pix(pin[0], pin[1] - 1, [255, 226, 128], G.hairFront);
  b.pix(pin[0] - 1, pin[1], [217, 160, 50], G.hairFront);
  b.pix(pin[0], pin[1], [255, 226, 128], G.hairFront);
  b.pix(pin[0] + 1, pin[1], [217, 160, 50], G.hairFront);
  b.pix(pin[0], pin[1] + 1, [168, 106, 28], G.hairFront);
}

function drawHalo(b: PixBuf, s: Skeleton, pose: Pose): V {
  const h = s.headC;
  const tilt = pose.head * 0.3 + s.angC * 0.3;
  const c = add(h, rot([-2.2 * HS, -12.6 * HS], tilt));
  const rx = 7.8, ry = 2.4;
  const a = (-8 + tilt) * DEG;
  const cs = Math.cos(a), sn = Math.sin(a);
  b.ellipse(c[0], c[1], rx + 0.7, ry + 0.7, a, M.halo, G.halo, {
    round: 1,
    paint: (x, y) => {
      const px = x + 0.5 - c[0], py = y + 0.5 - c[1];
      const u = (px * cs + py * sn) / (rx - 0.9), v = (-px * sn + py * cs) / (ry - 0.9);
      return u * u + v * v < 1 ? null : M.halo;
    },
  });
  return c;
}

function drawWeapon(b: PixBuf, s: Skeleton, pose: Pose): void {
  const d = s.wDir;
  const p = perp(d);
  const at = (t: number): V => add(s.wButt, mul(d, t));
  const L = FIG.weapon, BL = FIG.blade;
  const a = at(1), e = at(L - BL - 1);
  b.capsule(a[0], a[1], 1.1, e[0], e[1], 1.1, M.shaft, G.weapon, {
    round: 1.2,
    paint: (x, y) => {
      const t = proj([x, y], s.wButt, d);
      if (t < 4.5 || (t > 30 && t < 32) || (t > 62 && t < 64) || t > L - BL - 7) return M.gold;
      return undefined;
    },
  });
  const bc = at(0.6);
  b.ellipse(bc[0], bc[1], 1.8, 1.8, 0, M.gold, G.weapon, { round: 1.4 });
  const gc = at(L - BL - 2);
  const w1 = add(gc, mul(p, 5.2)), w2 = add(gc, mul(p, -5.2));
  b.capsule(w1[0], w1[1], 1.0, w2[0], w2[1], 1.0, M.gold, G.weapon, { round: 1.1 });
  for (const w of [w1, w2]) {
    const tipw = add(w, mul(d, 1.6));
    b.capsule(w[0], w[1], 0.9, tipw[0], tipw[1], 0.6, M.gold, G.weapon, { round: 1 });
  }
  const gdn = at(L - BL - 5);
  b.capsule(gc[0], gc[1], 1.4, gdn[0], gdn[1], 1.0, M.gold, G.weapon, { round: 1.2 });
  const bp: V[] = [];
  const prof: [number, number][] = [[0, 1.4], [0.18, 3.3], [0.4, 3.6], [0.66, 2.7], [0.86, 1.4], [1, 0]];
  for (const [t, w] of prof) bp.push(add(at(L - BL + t * BL), mul(p, w)));
  for (let i = prof.length - 2; i >= 0; i--) {
    const [t, w] = prof[i]!;
    bp.push(add(at(L - BL + t * BL), mul(p, -w)));
  }
  b.poly(smooth(bp, true, 2, bp.map((_, i) => i === prof.length - 1)), M.blade, G.weapon, {
    round: 1.6,
    paint: (x, y) => (Math.abs(proj([x, y], s.wButt, p)) < 0.55 ? M.halo : undefined),
  });
  const rb = at(L - BL - 8);
  const tail: number[] = [rb[0], rb[1]];
  let q = rb;
  for (let i = 1; i <= 4; i++) {
    q = add(q, rot([0, 3.2], pose.hair * 0.9 + 15 * i - s.angC * 0.2));
    tail.push(q[0], q[1]);
  }
  b.ribbon(tail, [2.2, 2.0, 1.8, 1.4, 0.6], M.ribbon, G.weapon, { round: 1 });
}

export interface FigureAnchors {
  tip: V;
  handN: V;
  handF: V;
  head: V;
  chest: V;
  halo: V;
  butt: V;
}

/** Draws the whole figure into b (figure space) and returns anchor points. */
export function drawFigure(b: PixBuf, pose: Pose): { anchors: FigureAnchors; warnings: string[] } {
  const s = solve(pose);
  const flowC = pose.cloth;
  const liftC = pose.clothLift ?? 0;
  const sleeveFlow = pose.sleeve ?? pose.cloth * 0.8;
  const wBack = pose.wBack ?? false;

  const halo = drawHalo(b, s, pose);
  drawHairBack(b, s, pose);
  if (wBack) drawWeapon(b, s, pose);
  drawArm(b, s.shF, s.elF, s.haF, G.armF, false);
  drawSleeve(b, s.shF, s.elF, s.haF, sleeveFlow, G.sleeveF, true);
  drawTabard(b, add(s.pelvis, rot([-3.4, -6.2], s.angL)), s.angL * 0.5, flowC * 1.15 + 6, liftC, 31, 5.4, G.tabardB, true);
  drawLeg(b, s.hipF, s.kneeF, s.ankleF, pose.toeF ?? 0, false, G.legF, G.bootF);
  const nb = s.neckBase;
  const nt = add(nb, rot([0.8, -5.5], s.angC * 0.6 + pose.head * 0.4));
  b.capsule(nb[0], nb[1], 1.8, nt[0], nt[1], 1.6, M.skin, G.neck, { round: 1.6, noInk: true });
  drawTorso(b, s);
  drawLeg(b, s.hipN, s.kneeN, s.ankleN, pose.toeN ?? 0, true, G.legN, G.bootN);
  drawTabard(b, add(s.pelvis, rot([2.5, -7.4], s.angL)), s.angL * 0.6, flowC, liftC, 25, 4.6, G.tabardF, false);
  drawHead(b, s, pose);
  drawHairFront(b, s, pose);
  if (!wBack) drawWeapon(b, s, pose);
  drawHand(b, s.haF, norm(sub(s.haF, s.elF)), G.handF);
  drawArm(b, s.shN, s.elN, s.haN, G.armN, true);
  drawHand(b, s.haN, norm(sub(s.haN, s.elN)), G.handN);
  drawSleeve(b, s.shN, s.elN, s.haN, sleeveFlow, G.sleeveN, false);

  b.castShadow([G.hairFront], [G.face], 2, 0, -1);
  b.castShadow([G.face], [G.neck], 2, 0, -1, -2);
  b.castShadow([G.tabardF, G.torso], [G.legN, G.legF], 2, 0, -1);
  b.castShadow([G.sleeveN, G.armN], [G.torso], 1, -1, 0);
  b.castShadow([G.lock], [G.torso, G.neck], 1, 1, 0);

  return {
    anchors: { tip: s.wTip, handN: s.haN, handF: s.haF, head: s.headC, chest: add(s.waist, rot([1, -10], s.angC)), halo, butt: s.wButt },
    warnings: s.reachWarn,
  };
}

export const KEY_LIGHT: [number, number, number] = [0.45, -0.62, 0.64];
export type { Material };

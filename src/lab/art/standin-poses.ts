// Key poses for the stand-in. Clip data (src/lab/data/player.clips.json)
// references these by name; "a~b:0.4" in a clip means an in-between 40% of
// the way from pose a to pose b. Timing lives in the clip data, not here.
//
// Two-handed holds: the near hand (N) is the grip at `wpn`; `handF` is the far
// hand's distance along the shaft from it (+ toward the blade). In strikes the
// near hand leads (closer to the blade) and the far hand sits behind it.

import type { Pose } from "./standin-figure.ts";

const base: Pose = {
  // contrapposto: weight on the near (back) leg, hips pushed forward, chest back over them;
  // spear planted at her front side in the far hand, near hand on the hip
  hip: [-1, -44.2],
  lean: -7,
  chest: 11,
  head: 5,
  footN: [-3, -3],
  footF: [8, -3],
  toeF: -14,
  wpn: [9, -58, -84],
  slide: 52,
  handN: [-5.5, -51],
  wBack: true,
  hair: 8,
  cloth: 5,
  expr: "open",
};

/** New pose from a base; grip mode (handN / wBack) is never inherited, each pose states it. */
const P = (over: Partial<Pose>, from: Pose = base): Pose => ({ ...from, handN: undefined, wBack: undefined, ...over });

// --- locomotion -------------------------------------------------------------
const idle0: Pose = { ...base };
const idle1: Pose = { ...base, hip: [-1, -43.6], chest: 12, head: 6, wpn: [9, -57.4, -84], handN: [-5.5, -50.4], hair: 5, cloth: 3 };

// run: lean in, spear trailing low behind in the near hand, far arm pumping
const runBase = P({
  lean: 20, chest: -2, head: 2, wpn: [-3, -52, 186], slide: 28, handF: [12, -58], hair: 44, cloth: 38, expr: "focus",
});
// the planted foot travels 29 px back over the 9 ticks it is down, matching
// runSpeed 3.2 px/tick, so the feet don't skate
const run = [
  P({ hip: [0, -43.4], footF: [17, -3], footN: [-15, -9], toeN: 30, toeF: -10, handF: [4, -52] }, runBase),
  P({ hip: [0, -41.8], footF: [7, -3], footN: [-12, -14], toeN: 45, handF: [7, -55] }, runBase),
  P({ hip: [0, -44.8], footF: [-3, -3], footN: [-1, -16], toeN: 55, handF: [11, -58] }, runBase),
  P({ hip: [0, -46.2], footF: [-12, -5], footN: [12, -12], toeF: 30, toeN: 10, handF: [14, -60] }, runBase),
  P({ hip: [0, -43.4], footN: [17, -3], footF: [-15, -9], toeF: 30, toeN: -10, handF: [14, -61], wpn: [-4, -52, 184] }, runBase),
  P({ hip: [0, -41.8], footN: [7, -3], footF: [-12, -14], toeF: 45, handF: [11, -58], wpn: [-3, -52, 185] }, runBase),
  P({ hip: [0, -44.8], footN: [-3, -3], footF: [-1, -16], toeF: 55, handF: [7, -55] }, runBase),
  P({ hip: [0, -46.2], footN: [-12, -5], footF: [12, -12], toeN: 30, toeF: 10, handF: [4, -52] }, runBase),
];

const jumpRise = P({
  hip: [0, -47], lean: 4, chest: -8, head: -8, footN: [-6, -9], footF: [5, -14], toeN: 45, toeF: 35,
  wpn: [-7, -62, -112], slide: 40, handF: [10, -64], hair: -12, hairLift: -0.1, cloth: -8, clothLift: -0.1, expr: "open",
});
const jumpApex = P({
  hip: [0, -47], lean: 6, chest: -4, head: -2, footN: [-5, -13], footF: [7, -17], toeN: 40, toeF: 25,
  wpn: [-8, -60, -122], slide: 40, handF: [11, -62], hair: 10, hairLift: 0.3, cloth: 6, clothLift: 0.4, expr: "open",
});
const fall = P({
  hip: [0, -47], lean: 2, chest: -2, head: 3, footN: [-4, -5], footF: [7, -10], toeN: 25, toeF: 30,
  wpn: [-8, -62, -128], slide: 40, handF: [12, -66], hair: 14, hairLift: 0.65, cloth: 8, clothLift: 0.75, expr: "open",
});
const land = P({
  hip: [0, -37], lean: 18, chest: 4, head: 6, footN: [-8, -3], footF: [9, -3],
  wpn: [-6, -46, -118], slide: 44, handF: [12, -46], hair: 6, hairLift: 0.45, cloth: 4, clothLift: 0.45, expr: "focus", stretch: 0.94,
});
// double jump: knees tucked, the spear twirls over her head (only the weapon rotates)
const djump = (ang: number): Pose =>
  P({
    hip: [0, -48], lean: 8, chest: -8, head: -6, footN: [-6, -19], footF: [4, -22], toeN: 50, toeF: 45,
    wpn: [3, -84, ang], slide: 55, handF: [12, -62], hair: 22, hairLift: 0.55, cloth: 14, clothLift: 0.55, expr: "smile",
  });

// --- dash ----------------------------------------------------------------------
// dash: a hard forward diagonal - chest over the lead knee, chin down, back leg
// thrown out, spear carried level along the body line with the blade trailing
// high (never dragged along the ground)
const dash0 = P({
  hip: [2, -35], lean: 50, chest: 10, head: 12, footN: [-23, -8], footF: [12, -3], toeN: 78,
  wpn: [6, -46, 194], slide: 34, handF: [-4, -41], hair: 84, hairLift: 0.05, cloth: 74, expr: "focus", stretch: 0.96,
});
const dash1 = P({
  hip: [2, -37], lean: 42, chest: 8, head: 10, footN: [-19, -10], footF: [13, -3], toeN: 62,
  wpn: [5, -47, 192], slide: 34, handF: [-2, -42], hair: 72, cloth: 62, expr: "focus",
});
const dashEnd = P({
  hip: [1, -40], lean: 20, chest: 4, head: 6, footN: [-11, -3], footF: [12, -3],
  wpn: [2, -48, 186], slide: 30, handF: [6, -48], hair: 30, hairLift: 0.2, cloth: 26, expr: "focus",
});

// --- M1 string --------------------------------------------------------------------
// 1: diagonal cleave, high-back to low-front
const m1aWind = P({
  hip: [-3, -43], lean: -10, chest: -10, head: -6, footN: [-11, -3], footF: [8, -3], toeF: -10,
  wpn: [-1, -80, -140], slide: 32, handF: 13, hair: 2, cloth: -6, expr: "focus",
});
const m1aStrike = P({
  hip: [5, -41], lean: 22, chest: 8, head: 6, footN: [-11, -3], footF: [17, -3], toeN: 25,
  wpn: [16, -58, 26], slide: 32, handF: -13, hair: 38, cloth: 30, expr: "shout",
});
const m1aFollow = P({
  hip: [6, -40], lean: 26, chest: 10, head: 8, footN: [-12, -3], footF: [18, -3], toeN: 30,
  wpn: [14, -52, 32], slide: 32, handF: -13, hair: 28, hairLift: 0.2, cloth: 22, expr: "focus",
});
// 2: rising slash, low-front to high
const m1bWind = P({
  hip: [5, -39], lean: 24, chest: 10, head: 8, footN: [-11, -3], footF: [16, -3],
  wpn: [10, -46, 30], slide: 32, handF: -12, hair: 22, cloth: 18, expr: "focus", stretch: 0.97,
});
const m1bStrike = P({
  hip: [6, -46], lean: -6, chest: -14, head: -12, footN: [-7, -3], footF: [15, -6], toeN: 20, toeF: -20,
  wpn: [12, -70, -66], slide: 32, handF: -13, hair: -10, hairLift: 0.35, cloth: -10, clothLift: 0.35, expr: "shout", stretch: 1.03,
});
const m1bFollow = P({
  hip: [6, -46], lean: -10, chest: -14, head: -12, footN: [-6, -3], footF: [14, -4],
  wpn: [6, -78, -98], slide: 32, handF: -13, hair: -6, hairLift: 0.45, cloth: -8, clothLift: 0.4, expr: "focus",
});
// 3: spinning sweep at waist height
const m1cWind = P({
  hip: [1, -41], lean: 4, chest: -6, head: 0, footN: [-13, -3], footF: [10, -3],
  wpn: [-8, -56, 196], slide: 36, handF: -12, hair: 12, cloth: 8, expr: "focus",
});
// the sweep passes low in front of her (golf-swing path), not overhead
const m1cLow = P({
  hip: [4, -39], lean: 12, chest: 0, head: 2, footN: [-13, -3], footF: [14, -3], toeN: 15,
  wpn: [6, -50, 104], slide: 62, handF: -12, hair: 28, cloth: 22, expr: "shout",
});
const m1cSweep = P({
  hip: [6, -40], lean: 16, chest: 4, head: 2, footN: [-13, -3], footF: [17, -3], toeN: 25,
  wpn: [16, -56, 4], slide: 36, handF: -14, hair: 40, cloth: 34, expr: "shout",
});
const m1cFollow = P({
  hip: [6, -41], lean: 10, chest: 0, head: 0, footN: [-12, -3], footF: [15, -3],
  wpn: [12, -64, -34], slide: 36, handF: -13, hair: 32, cloth: 26, expr: "focus",
});
// 4: finisher - leap, spear overhead, slam into a wide shockwave
const m1dRise = P({
  hip: [0, -48], lean: -10, chest: -14, head: -12, footN: [-6, -11], footF: [6, -15], toeN: 45, toeF: 35,
  wpn: [0, -86, -118], slide: 34, handF: 9, hair: 0, hairLift: 0.2, cloth: -8, clothLift: 0.2, expr: "focus", stretch: 1.05,
});
const m1dHang = P({
  hip: [0, -48], lean: -16, chest: -16, head: -14, footN: [-8, -13], footF: [5, -17], toeN: 50, toeF: 40,
  wpn: [-4, -86, -164], slide: 34, handF: 12, hair: 6, hairLift: 0.55, cloth: 0, clothLift: 0.55, expr: "shout",
});
const m1dSlam = P({
  hip: [7, -33], lean: 36, chest: 12, head: 10, footN: [-13, -3], footF: [15, -3], toeN: 10,
  wpn: [20, -44, 22], slide: 34, handF: -13, hair: 54, hairLift: 0.3, cloth: 44, clothLift: 0.3, expr: "shout", stretch: 0.95,
});
const m1dHold = P({
  hip: [7, -32], lean: 38, chest: 14, head: 12, footN: [-14, -3], footF: [15, -3],
  wpn: [20, -42, 26], slide: 34, handF: -13, hair: 38, hairLift: 0.55, cloth: 32, clothLift: 0.55, expr: "focus", stretch: 0.95,
});
const m1dRecover = P({
  hip: [3, -41], lean: 12, chest: 2, head: 2, footN: [-10, -3], footF: [11, -3],
  wpn: [4, -64, -112], slide: 40, handF: 12, hair: 18, hairLift: 0.2, cloth: 12, expr: "smile",
});

// --- dash attack: spear lunge ------------------------------------------------------
const dAtkWind = P({
  hip: [-2, -40], lean: 22, chest: -2, head: -8, footN: [-15, -6], footF: [9, -3], toeN: 45,
  wpn: [-4, -54, 180], slide: 30, handF: -12, hair: 54, cloth: 46, expr: "focus",
});
const dAtkThrust = P({
  hip: [9, -37], lean: 34, chest: 4, head: -8, footN: [-19, -5], footF: [19, -3], toeN: 55,
  wpn: [30, -56, -3], slide: 26, handF: -15, hair: 68, cloth: 62, expr: "shout", stretch: 0.97,
});
const dAtkFollow = P({
  hip: [9, -39], lean: 24, chest: 2, head: -3, footN: [-17, -4], footF: [18, -3], toeN: 40,
  wpn: [25, -56, -8], slide: 26, handF: -15, hair: 46, hairLift: 0.2, cloth: 42, expr: "focus",
});

// --- Q: raise, then plant the spear into the ground --------------------------------
const qRaise = P({
  hip: [0, -46], lean: -8, chest: -12, head: -10, footN: [-6, -3], footF: [6, -3],
  wpn: [4, -80, -90], slide: 40, handF: 8, hair: 0, hairLift: 0.2, cloth: -4, clothLift: 0.15, expr: "closed",
});
const qPlant = P({
  hip: [2, -34], lean: 22, chest: 14, head: 12, footN: [-12, -3], footF: [12, -3],
  wpn: [12, -46, 86], slide: 70, handF: -11, hair: 22, hairLift: 0.65, cloth: 10, clothLift: 0.75, expr: "shout", stretch: 0.97,
});
const qHold = P({
  hip: [2, -35], lean: 20, chest: 12, head: 10, footN: [-12, -3], footF: [12, -3],
  wpn: [12, -46, 86], slide: 70, handF: -11, hair: 14, hairLift: 0.45, cloth: 8, clothLift: 0.45, expr: "focus",
});

// --- R: call to the sky, leap, one wide overhead cleave ---------------------------
const rCall = P({
  hip: [0, -46], lean: -8, chest: -14, head: -16, footN: [-5, -3], footF: [6, -3],
  wpn: [6, -86, -90], slide: 36, handN: [1, -64], wBack: true, hair: -6, hairLift: 0.55, cloth: -8, clothLift: 0.65, expr: "closed",
});
const rRise = P({
  hip: [0, -52], lean: -12, chest: -14, head: -12, footN: [-5, -13], footF: [5, -17], toeN: 55, toeF: 45,
  wpn: [-2, -88, -132], slide: 32, handF: 9, hair: 4, hairLift: 0.75, cloth: -4, clothLift: 0.85, expr: "open", stretch: 1.05,
});
const rCleave = P({
  hip: [9, -35], lean: 38, chest: 14, head: 10, footN: [-14, -3], footF: [16, -3], toeN: 10,
  wpn: [22, -44, 16], slide: 32, handF: -13, hair: 60, hairLift: 0.4, cloth: 50, clothLift: 0.4, expr: "shout", stretch: 0.95,
});
const rHold = P({
  hip: [9, -34], lean: 38, chest: 14, head: 12, footN: [-15, -3], footF: [16, -3],
  wpn: [22, -42, 20], slide: 32, handF: -13, hair: 42, hairLift: 0.65, cloth: 36, clothLift: 0.65, expr: "focus", stretch: 0.95,
});

// --- hurt ------------------------------------------------------------------------------
const hurt = P({
  hip: [-3, -43], lean: -18, chest: -10, head: -14, footN: [-8, -3], footF: [7, -7], toeF: 25,
  wpn: [-6, -60, -122], slide: 44, handF: [8, -64], hair: -16, hairLift: 0.35, cloth: -14, clothLift: 0.35, expr: "hurt",
});

export const POSES: Record<string, Pose> = {
  idle0, idle1,
  run0: run[0]!, run1: run[1]!, run2: run[2]!, run3: run[3]!, run4: run[4]!, run5: run[5]!, run6: run[6]!, run7: run[7]!,
  jumpRise, jumpApex, fall, land,
  djump0: djump(-100), djump1: djump(-10), djump2: djump(80), djump3: djump(170),
  dash0, dash1, dashEnd,
  m1aWind, m1aStrike, m1aFollow,
  m1bWind, m1bStrike, m1bFollow,
  m1cWind, m1cLow, m1cSweep, m1cFollow,
  m1dRise, m1dHang, m1dSlam, m1dHold, m1dRecover,
  dAtkWind, dAtkThrust, dAtkFollow,
  qRaise, qPlant, qHold,
  rCall, rRise, rCleave, rHold,
  hurt,
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const angLerp = (a: number, b: number, t: number): number => {
  let d = ((b - a + 540) % 360) - 180;
  if (Math.abs(d) < 1e-6) d = 0;
  return a + d * t;
};

/** In-between of two poses. Weapon angle takes the short way round. */
export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  const v2 = (x: [number, number], y: [number, number]): [number, number] => [lerp(x[0], y[0], t), lerp(x[1], y[1], t)];
  const near = t < 0.5 ? a : b;
  const handF =
    typeof a.handF === "number" && typeof b.handF === "number"
      ? lerp(a.handF, b.handF, t)
      : Array.isArray(a.handF) && Array.isArray(b.handF)
        ? v2(a.handF, b.handF)
        : near.handF;
  const handN = a.handN && b.handN ? v2(a.handN, b.handN) : near.handN;
  return {
    ...near,
    hip: v2(a.hip, b.hip),
    lean: lerp(a.lean, b.lean, t),
    chest: lerp(a.chest, b.chest, t),
    head: lerp(a.head, b.head, t),
    footN: v2(a.footN, b.footN),
    footF: v2(a.footF, b.footF),
    toeN: lerp(a.toeN ?? 0, b.toeN ?? 0, t),
    toeF: lerp(a.toeF ?? 0, b.toeF ?? 0, t),
    wpn: [lerp(a.wpn[0], b.wpn[0], t), lerp(a.wpn[1], b.wpn[1], t), angLerp(a.wpn[2], b.wpn[2], t)],
    slide: lerp(a.slide ?? 44, b.slide ?? 44, t),
    handF,
    handN,
    hair: lerp(a.hair, b.hair, t),
    hairLift: lerp(a.hairLift ?? 0, b.hairLift ?? 0, t),
    cloth: lerp(a.cloth, b.cloth, t),
    clothLift: lerp(a.clothLift ?? 0, b.clothLift ?? 0, t),
    sleeve: a.sleeve !== undefined || b.sleeve !== undefined ? lerp(a.sleeve ?? a.cloth * 0.8, b.sleeve ?? b.cloth * 0.8, t) : undefined,
    stretch: lerp(a.stretch ?? 1, b.stretch ?? 1, t),
  };
}

/** Resolves "name" or "a~b:0.4". */
export function resolvePose(key: string): Pose {
  const m = /^([\w]+)~([\w]+):([\d.]+)$/.exec(key);
  if (m) {
    const a = POSES[m[1]!], b = POSES[m[2]!];
    if (!a || !b) throw new Error(`unknown pose in "${key}"`);
    return blendPoses(a, b, Number(m[3]));
  }
  const p = POSES[key];
  if (!p) throw new Error(`unknown stand-in pose "${key}"`);
  return p;
}

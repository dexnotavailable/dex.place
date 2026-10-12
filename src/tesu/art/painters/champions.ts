// The Prize Court's people and the bout's marks (GDK 5.1, Appendix G): Herald Bao by his
// gong, the dexClient champion (a lion-dance Lion, the proposed design: two flustered
// performers inside a red and gold lion with white fur), the gold "finish" glint, the
// champion's paper HP strip and the paper-tile install bar the Lion assembles along.
// Stand-ins drawn in code in the world's palette until finished sprites replace them;
// every one is a sprite painter (frames by the `frame` param), anchored at the feet.

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, hash, tone } from "../raster.ts";

function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / Math.max(1, X1 - X0), (y - Y0 + 0.5) / Math.max(1, Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

function oval(c: PaintCtx, cx: number, cy: number, rx: number, ry: number, col: (x: number, y: number, du: number, dv: number, d: number) => number): void {
  fill(c, cx - rx, cy - ry, cx + rx, cy + ry, (x, y, u, v) => {
    const du = u * 2 - 1, dv = v * 2 - 1;
    const d = du * du + dv * dv;
    return d > 1 ? 0 : col(x, y, du, dv, d);
  });
}

/** A thick stroke between two level-1 points (limbs). */
function limb(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, w: number, col: (x: number, y: number, t: number, side: number) => number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.ceil(len * c.d));
  const nx = -(y1 - y0) / Math.max(1e-6, len), ny = (x1 - x0) / Math.max(1e-6, len);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    const m = Math.max(1, Math.ceil(w * c.d));
    for (let j = 0; j <= m; j++) {
      const s = j / m - 0.5;
      const X = Math.round(c.X(cx + nx * s * w)), Y = Math.round(c.Y(cy + ny * s * w));
      const k = col(X, Y, t, s);
      if (k) c.buf.set(X, Y, k);
    }
  }
}

/** White fur: a ragged band of strands hanging down from y over x0..x1. */
function fur(c: PaintCtx, x0: number, x1: number, y: number, len: number, seed: number): void {
  for (let lx = x0; lx < x1; lx += 1 / c.d) {
    const k = hash(Math.floor(lx / 3), 7, seed);
    const l = len * (0.6 + 0.4 * k);
    const X = Math.round(c.X(lx));
    const Y0 = Math.round(c.Y(y)), Y1 = Math.round(c.Y(y + l));
    for (let yy = Y0; yy < Y1; yy++) {
      const t = (yy - Y0) / Math.max(1, Y1 - Y0);
      c.buf.set(X, yy, t > 0.8 && bayer4(X, yy) > 0.5 ? P.paper[2]! : tone(P.paper, t < 0.5 ? 0.0 : 0.25, X, yy, 0.3));
    }
  }
}

// --- the Lion (dexClient's champion, a proposal) ---------------------------------------------

export interface LionP {
  /**
   * 0, 1: idle (a head bob), 2: blink, 3: the Update Pounce's wind-up, 4: pouncing,
   * 5: flinching from a hit, 6: staggered to one knee, 7: bowing, 8: the two performers out
   * of the costume, bowing beside it.
   */
  frame?: number;
}

interface LionPose {
  /** Head centre. */
  hx: number;
  hy: number;
  /** Body top at the rear and front, hem height at the rear and front. */
  rearTop: number;
  frontTop: number;
  rearHem: number;
  frontHem: number;
  /** Body extent. */
  x0: number;
  x1: number;
  mouth: number;
  eyes: "open" | "shut" | "swirl" | "squeeze";
  legs: "stand" | "crouch" | "leap" | "kneel" | "bow";
}

const POSES: LionPose[] = [
  { hx: 118, hy: -96, rearTop: -104, frontTop: -100, rearHem: -46, frontHem: -48, x0: -160, x1: 76, mouth: 0.3, eyes: "open", legs: "stand" },
  { hx: 120, hy: -102, rearTop: -106, frontTop: -103, rearHem: -47, frontHem: -50, x0: -160, x1: 76, mouth: 0.65, eyes: "open", legs: "stand" },
  { hx: 118, hy: -96, rearTop: -104, frontTop: -100, rearHem: -46, frontHem: -48, x0: -160, x1: 76, mouth: 0.3, eyes: "shut", legs: "stand" },
  { hx: 128, hy: -122, rearTop: -84, frontTop: -96, rearHem: -30, frontHem: -40, x0: -164, x1: 80, mouth: 1, eyes: "open", legs: "crouch" },
  { hx: 140, hy: -100, rearTop: -112, frontTop: -108, rearHem: -60, frontHem: -58, x0: -176, x1: 88, mouth: 0.85, eyes: "open", legs: "leap" },
  { hx: 102, hy: -88, rearTop: -102, frontTop: -94, rearHem: -46, frontHem: -46, x0: -160, x1: 70, mouth: 0.1, eyes: "squeeze", legs: "stand" },
  { hx: 110, hy: -52, rearTop: -104, frontTop: -70, rearHem: -46, frontHem: -22, x0: -160, x1: 70, mouth: 0.5, eyes: "swirl", legs: "kneel" },
  { hx: 116, hy: -40, rearTop: -112, frontTop: -66, rearHem: -54, frontHem: -18, x0: -160, x1: 70, mouth: 0, eyes: "shut", legs: "bow" },
];

function lionHead(c: PaintCtx, hx: number, hy: number, pose: LionPose): void {
  // the fur ruff behind the head
  oval(c, hx - 48, hy + 4, 24, 54, (x, y, du) => tone(P.paper, du < 0 ? 0.0 : 0.2, x, y, 0.3));
  // the lower jaw, dropping as the mouth opens; the mouth's dark inside and a red tongue
  const jy = hy + 34 + pose.mouth * 18;
  if (pose.mouth > 0.15) {
    fill(c, hx - 6, hy + 18, hx + 50, jy, (_x, _y, u) => (u > 0.75 ? P.red[5]! : P.lacquer[3]!));
    fill(c, hx + 6, jy - 8, hx + 40, jy - 2, (x, y) => tone(P.red, 0.3, x, y, 0.3));
    fill(c, hx + 8, hy + 18, hx + 50, hy + 22, (x) => ((x & 3) < 2 ? P.paper[0]! : P.paper[2]!));
  }
  oval(c, hx + 22, jy, 34, 11, (x, y, du, dv) => tone(P.red, dv < -0.3 ? 0.15 : du > 0.5 ? 0.45 : 0.3, x, y, 0.3));
  fur(c, hx - 4, hx + 52, jy + 6, 26, 31);
  // the head: red, lit from the upper left, a gold rim
  oval(c, hx, hy, 60, 54, (x, y, du, dv, d) => {
    if (d > 0.86) return P.gold[3]!;
    const lit = -du * 0.6 - dv * 0.8;
    return tone(P.red, clamp(0.38 - lit * 0.25, 0.05, 0.8), x, y, 0.4);
  });
  // the snout's bulb at the front
  oval(c, hx + 54, hy + 6, 14, 13, (x, y, du) => tone(P.gold, du < 0 ? 0.15 : 0.45, x, y, 0.3));
  // the brow mirror and the single horn
  oval(c, hx - 8, hy - 34, 10, 10, (_x, _y, du, dv, d) => (d > 0.7 ? P.gold[3]! : du + dv < -0.4 ? P.paper[0]! : P.blue[0]!));
  limb(c, hx - 16, hy - 46, hx - 26, hy - 70, 9, (x, y, t) => tone(P.gold, t > 0.7 ? 0.05 : 0.35, x, y, 0.3));
  // eyes: the near one big, the far one half seen; white fur brows over them
  const eye = (ex: number, ey: number, r: number): void => {
    if (pose.eyes === "shut" || pose.eyes === "squeeze") {
      fill(c, ex - r, ey - 2, ex + r, ey + 2, () => P.ink[0]!);
      if (pose.eyes === "squeeze") {
        limb(c, ex - r, ey - 5, ex + r, ey + 1, 2, () => P.ink[0]!);
      }
      return;
    }
    oval(c, ex, ey, r, r, (_x, _y, du, _dv, d) => (d > 0.75 ? P.ink[0]! : du > 0.1 && d < 0.4 ? P.ink[0]! : P.paper[0]!));
    if (pose.eyes === "swirl") {
      oval(c, ex, ey, r * 0.7, r * 0.7, (_x, _y, _du, _dv, d) => (d > 0.55 && d < 0.85 ? P.ink[0]! : d < 0.12 ? P.ink[0]! : P.paper[0]!));
    }
  };
  eye(hx + 16, hy - 10, 13);
  eye(hx + 42, hy - 12, 8);
  fur(c, hx - 8, hx + 54, hy - 30, 10, 17);
}

function lionBody(c: PaintCtx, pose: LionPose): void {
  const { x0, x1 } = pose;
  const topAt = (lx: number): number => {
    const t = clamp((lx - x0) / (x1 - x0), 0, 1);
    const hump = Math.sin(t * Math.PI) * 10;
    return pose.rearTop + (pose.frontTop - pose.rearTop) * t - hump;
  };
  const hemAt = (lx: number): number => {
    const t = clamp((lx - x0) / (x1 - x0), 0, 1);
    return pose.rearHem + (pose.frontHem - pose.rearHem) * t;
  };
  for (let lx = x0; lx < x1; lx += 1 / c.d) {
    const X = Math.round(c.X(lx));
    const top = topAt(lx), hem = hemAt(lx);
    const Y0 = Math.round(c.Y(top)), Y1 = Math.round(c.Y(hem));
    for (let y = Y0; y < Y1; y++) {
      const v = (y - Y0) / Math.max(1, Y1 - Y0);
      // a gold spine stripe, red scales in gold arcs, darker toward the hem
      if (v < 0.1) { c.buf.set(X, y, P.gold[v < 0.04 ? 1 : 2]!); continue; }
      const ly = c.ly(y + 0.5);
      const sc = 14;
      const row = Math.floor((ly - top) / (sc * 0.7));
      const ox = (row % 2) * sc * 0.5;
      const cx = (((lx + ox) % sc) + sc) % sc - sc / 2, cy = (((ly - top) % (sc * 0.7)) + sc * 0.7) % (sc * 0.7);
      const arc = Math.abs(Math.hypot(cx, cy) - sc * 0.5) < 0.9;
      if (arc && v < 0.85) { c.buf.set(X, y, P.gold[3]!); continue; }
      c.buf.set(X, y, tone(P.red, clamp(0.2 + 0.5 * v, 0, 0.9), X, y, 0.35));
    }
  }
  // the white fur tufts along the spine and the fringe along the hem
  for (let lx = x0 + 10; lx < x1 - 6; lx += 18) oval(c, lx, topAt(lx) - 2, 7, 5, (x, y, du) => tone(P.paper, du < 0 ? 0 : 0.2, x, y, 0.3));
  for (let lx = x0; lx < x1; lx += 1 / c.d) {
    const X = Math.round(c.X(lx));
    const hem = hemAt(lx);
    const l = 7 + 4 * hash(Math.floor(lx / 3), 3, 11);
    for (let y = Math.round(c.Y(hem)); y < Math.round(c.Y(hem + l)); y++) c.buf.set(X, y, tone(P.paper, 0.1, X, y, 0.3));
  }
  // the tail: a fluffy tuft up at the rear
  oval(c, x0 - 8, pose.rearTop - 4, 18, 16, (x, y, du, dv) => tone(P.paper, du + dv < -0.3 ? 0 : 0.25, x, y, 0.3));
  oval(c, x0 - 2, pose.rearTop + 6, 8, 6, (x, y) => tone(P.gold, 0.3, x, y, 0.3));
}

/** One performer's leg: gold trousers with a red fur cuff, a black shoe. */
function leg(c: PaintCtx, hipX: number, hipY: number, footX: number, footY: number, kneeOut: number): void {
  const kx = (hipX + footX) / 2 + kneeOut, ky = (hipY + footY) / 2;
  const pant = (x: number, y: number, _t: number, s: number): number => tone(P.gold, s < -0.2 ? 0.15 : s < 0.25 ? 0.35 : 0.6, x, y, 0.3);
  limb(c, hipX, hipY, kx, ky, 15, pant);
  limb(c, kx, ky, footX, footY - 10, 14, pant);
  fill(c, footX - 9, footY - 16, footX + 9, footY - 9, (x, y) => tone(P.paper, 0.1, x, y, 0.3));
  fill(c, footX - 8, footY - 9, footX + 12, footY, (x, y, u) => (u < 0.1 ? P.ink[0]! : tone(P.lacquer, 0.7, x, y, 0.3)));
}

function lionLegs(c: PaintCtx, pose: LionPose, which: "far" | "near"): void {
  const feet: [number, number][] = which === "far" ? [[-112, 0], [28, 0]] : [[-82, 0], [58, 0]];
  feet.forEach(([fx], i) => {
    const front = i === 1;
    const hem = front ? pose.frontHem : pose.rearHem;
    let hipX = fx, footX = fx, footY = 0, knee = front ? 6 : -6;
    switch (pose.legs) {
      case "crouch": knee = front ? 16 : -16; footX = fx + (front ? 10 : -14); break;
      case "leap": footX = fx + (front ? 34 : -40); footY = hem + 46; knee = front ? -4 : 4; break;
      case "kneel": if (front) { footX = fx - 18; footY = 0; knee = 22; } break;
      case "bow": if (front) { footX = fx + 4; knee = 18; } break;
    }
    if (pose.legs === "leap") hipX = fx + (front ? 8 : -8);
    leg(c, hipX, hem + 4, footX, footY, knee);
  });
}

/** A performer standing and bowing: black hair, red headband, white top, gold trousers. */
function performer(c: PaintCtx, x: number, flip: number, seed: number): void {
  leg(c, x - 4, -40, x - 6, 0, 2);
  leg(c, x + 4, -40, x + 6, 0, 2);
  // the torso bent forward in a bow (toward +flip)
  limb(c, x, -42, x + flip * 22, -80, 22, (xx, y, _t, s) => tone(P.paper, s < 0 ? 0.05 : 0.25, xx, y, 0.3));
  fill(c, x - 9, -46, x + 9, -38, () => P.red[3]!);
  const hx = x + flip * 32, hy = -90;
  oval(c, hx, hy, 11, 11, (xx, y, du) => (du * flip > 0.4 ? tone(P.skin, 0.3, xx, y, 0.3) : tone(P.lacquer, 0.85, xx, y, 0.3)));
  fill(c, hx - 11, hy - 4, hx + 11, hy, () => P.red[2]!);
  // a drop of flustered sweat
  if (hash(seed, 1, 5) > -0.5) oval(c, hx - flip * 4, hy - 18, 2.5, 4, () => P.blue[0]!);
  // arms hanging forward
  limb(c, x + flip * 16, -72, x + flip * 26, -46, 7, (xx, y) => tone(P.paper, 0.2, xx, y, 0.3));
}

export const lion = definePainter<LionP>("lion", {
  bounds() {
    return [-250, -200, 280, 4];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    if (f >= 8) {
      // out of the costume: the lion slumped flat on the floor, the two performers bowing
      const flat: LionPose = { hx: 96, hy: -36, rearTop: -34, frontTop: -30, rearHem: -2, frontHem: -2, x0: -150, x1: 60, mouth: 0, eyes: "shut", legs: "stand" };
      lionBody(c, flat);
      lionHead(c, flat.hx, flat.hy, flat);
      performer(c, -200, 1, 1);
      performer(c, 236, -1, 2);
      return;
    }
    const pose = POSES[f] ?? POSES[0]!;
    lionLegs(c, pose, "far");
    lionBody(c, pose);
    lionLegs(c, pose, "near");
    lionHead(c, pose.hx, pose.hy, pose);
  },
});

// --- Herald Bao --------------------------------------------------------------------------------

export interface BaoP {
  /** 0, 1: idle, 2: the mallet raised, 3: the strike, 4: announcing (an arm out to the court). */
  frame?: number;
}

/**
 * Herald Bao (GDK Appendix F): huge and soft, a gold-and-black festival coat, a lion-dance
 * head worn pushed up like a hat, the gong mallet in one hand and a handkerchief in the
 * other; theatrical, gentle, a little apologetic. Drawn facing right (toward his gong);
 * anchor at his feet.
 */
export const bao = definePainter<BaoP>("bao", {
  bounds() {
    return [-100, -250, 124, 4];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    const breathe = f === 1 ? -2 : 0;
    // legs and boots under the coat's hem
    for (const lx of [-22, 14]) fill(c, lx, -24, lx + 16, 0, (x, y, u, v) => (v > 0.6 ? (u < 0.1 ? P.ink[0]! : tone(P.lacquer, 0.7, x, y, 0.3)) : tone(P.lacquer, 0.5, x, y, 0.3)));
    // the coat: a big round body, gold with black lacquer panels down the front and hem, a red sash
    oval(c, 0, -80 + breathe, 58, 66, (x, y, du, dv, d) => {
      if (dv > 0.82) return 0;
      if (d > 0.9) return P.gold[5]!;
      if (Math.abs(dv - 0.1) < 0.07) return tone(P.red, 0.3, x, y, 0.3);
      if (Math.abs(du - 0.15) < 0.18 || dv > 0.62) return tone(P.lacquer, du < 0 ? 0.35 : 0.6, x, y, 0.3);
      if (Math.abs(du - 0.15) < 0.22) return P.gold[3]!;
      const lit = -du * 0.6 - dv * 0.8;
      return tone(P.gold, clamp(0.35 - lit * 0.3, 0.05, 0.8), x, y, 0.4);
    });
    fill(c, -52, -32, 52, -22, (x, y, u) => tone(P.lacquer, u < 0.5 ? 0.6 : 0.75, x, y, 0.3));
    // the far arm with the handkerchief (announcing: raised out toward the court, behind him)
    const far: [number, number] = f === 4 ? [-86, -152] : [-40, -66];
    limb(c, -30, -118 + breathe, far[0], far[1], 18, (x, y, _t, s) => tone(P.gold, s < 0 ? 0.3 : 0.55, x, y, 0.3));
    fill(c, far[0] - 10, far[1] - 2, far[0] + 6, far[1] + 18, (x, y, u) => tone(P.paper, u < 0.5 ? 0.0 : 0.2, x, y, 0.3));
    // head: round, a kind face
    const hy = -158 + breathe;
    oval(c, 8, hy, 26, 25, (x, y, du) => tone(P.skin, du < -0.3 ? 0.05 : du < 0.4 ? 0.2 : 0.45, x, y, 0.3));
    // the lion-dance head pushed up like a hat: red, a gold rim, white fur brows, big eyes
    oval(c, 6, hy - 40, 34, 22, (x, y, du, dv, d) => {
      if (d > 0.84) return P.gold[3]!;
      return tone(P.red, clamp(0.3 + du * 0.2 + dv * 0.2, 0.05, 0.8), x, y, 0.35);
    });
    fur(c, -18, 34, hy - 36, 6, 5);
    oval(c, 18, hy - 46, 6, 6, (_x, _y, du, _dv, d) => (d > 0.6 ? P.ink[0]! : du > 0.2 ? P.ink[0]! : P.paper[0]!));
    oval(c, 34, hy - 38, 7, 6, (x, y, du) => tone(P.gold, du < 0 ? 0.15 : 0.45, x, y, 0.3));
    oval(c, -2, hy - 58, 5, 5, () => P.gold[1]!);
    // eyebrows (kind, a little worried), eyes, a big smile or an O for the announcement
    fill(c, 10, hy - 6, 20, hy - 3, () => P.ink[0]!);
    fill(c, 22, hy - 4, 28, hy - 1, () => P.ink[0]!);
    fill(c, 13, hy + 1, 16, hy + 4, () => P.ink[0]!);
    fill(c, 24, hy + 1, 27, hy + 4, () => P.ink[0]!);
    if (f === 3 || f === 4) oval(c, 22, hy + 13, 5, 6, () => P.red[5]!);
    else fill(c, 14, hy + 12, 30, hy + 14, () => P.red[4]!);
    // the near arm with the mallet: resting, raised behind, or swung through
    const sh: [number, number] = [26, -118 + breathe];
    const hand: [number, number] = f === 2 ? [-6, -172] : f === 3 ? [84, -110] : [44, -64];
    limb(c, sh[0], sh[1], hand[0], hand[1], 18, (x, y, _t, s) => tone(P.gold, s < 0 ? 0.2 : 0.45, x, y, 0.3));
    const dx = f === 2 ? -0.4 : f === 3 ? 1 : 0.3, dy = f === 2 ? -1 : f === 3 ? -0.2 : 1;
    const len = 48, mx = hand[0] + dx * len, my = hand[1] + dy * len;
    limb(c, hand[0], hand[1], mx, my, 5, () => P.timber[3]!);
    oval(c, mx, my, 12, 12, (x, y, du) => tone(P.red, du < 0 ? 0.15 : 0.4, x, y, 0.3));
    oval(c, hand[0], hand[1], 8, 8, (x, y) => tone(P.skin, 0.2, x, y, 0.3));
  },
});

// --- the bout's marks ---------------------------------------------------------------------------

export interface GlintP {
  frame?: number;
}

/** The gold "finish" glint over a staggered champion: a four-point star that pulses (4 frames). */
export const glint = definePainter<GlintP>("glint", {
  bounds() {
    return [-70, -70, 70, 70];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    const r = [34, 50, 64, 50][f % 4]!;
    const w = [5, 7, 8, 7][f % 4]!;
    for (const [ax, ay] of [[1, 0], [0, 1]] as const) {
      for (let t = -r; t <= r; t += 1 / c.d) {
        const k = 1 - Math.abs(t) / r;
        const half = Math.max(0.5, w * k * k);
        for (let s = -half; s <= half; s += 1 / c.d) {
          const x = ax ? t : s, y = ay ? t : s;
          const X = Math.round(c.X(x)), Y = Math.round(c.Y(y));
          c.buf.set(X, Y, Math.abs(s) < half * 0.4 ? P.gold[0]! : P.gold[2]!);
        }
      }
    }
    oval(c, 0, 0, 7, 7, () => P.paper[0]!);
    if (f % 2 === 1) {
      // a dithered ring on the bright beats
      oval(c, 0, 0, r * 0.6, r * 0.6, (x, y, _du, _dv, d) => (d > 0.82 && bayer4(x, y) > 0.4 ? P.gold[1]! : 0));
    }
  },
});

export interface HpBarP {
  /** Fill in twentieths (0..20). */
  frame?: number;
}

/** The champion's HP: a paper strip with a red ink fill and a gold rim; the last twentieth is the sliver. */
export const hpbar = definePainter<HpBarP>("hpbar", {
  bounds() {
    return [-76, -18, 76, 2];
  },
  paint(c, p) {
    const k = clamp((p.frame ?? 20) / 20, 0, 1);
    const sliver = k <= 0.05;
    fill(c, -72, -16, 72, 0, (x, y, u, v) => {
      // an ink edge, a gold rim (it pulses brighter at the sliver), red ink over paper
      if (v < 0.1 || v > 0.9 || u < 0.012 || u > 0.988) return P.ink[0]!;
      if (v < 0.24 || v > 0.76 || u < 0.03 || u > 0.97) return sliver ? P.gold[1]! : P.gold[3]!;
      if ((u - 0.03) / 0.94 < k) return tone(P.red, v < 0.45 ? 0.15 : 0.4, x, y, 0.3);
      return tone(P.paper, 0.15, x, y, 0.3);
    });
  },
});

export interface InstallBarP {
  /** Tiles laid, 0..10. */
  frame?: number;
}

/** The Lion's install bar: ten paper tiles lying on the floor, each turning gold as it is laid. */
export const installbar = definePainter<InstallBarP>("installbar", {
  bounds() {
    return [-180, -8, 180, 10];
  },
  paint(c, p) {
    const n = p.frame ?? 0;
    for (let i = 0; i < 10; i++) {
      const x0 = -170 + i * 34;
      const on = i < n;
      fill(c, x0, -4, x0 + 30, 6, (x, y, u, v) => {
        const edge = u < 0.05 || u > 0.95 || v < 0.15 || v > 0.85;
        if (!on) return edge ? P.paper[3]! : bayer4(x, y) > 0.75 ? P.paper[1]! : 0;
        if (edge) return P.gold[3]!;
        if (Math.abs(u - 0.5) < 0.12 && Math.abs(v - 0.5) < 0.3) return P.red[3]!;
        return tone(P.gold, 0.15, x, y, 0.3);
      });
    }
  },
});

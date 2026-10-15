// Gate Road's vermilion gates, SIDE-ON (round 7, the architecture lane). Dex: "no front view 2
// pillars for the toriis, rework them". The camera looks along the land from the side and the road
// runs across the frame, so a gate standing across the road is seen in profile: its near pillar
// covers the far one (the far one shows as a darker sliver to the west of it, the gate turned a
// few degrees off true side-on), and every beam that runs across the road is seen end-on: its cut
// end facing us with its metal end plate, its lit west side trailing off behind it, the kasagi's
// ends swept up so its underside lifts at both ends of the cap.
//
// Built as a small solid model (round shafts with entasis, beams as sections swept across the road)
// drawn through a per-pixel depth test, so every part overlaps every other the way it would. The
// road runs at depth 0: everything nearer than that (the near pillar, its legs or braces, the near
// halves of the beams) is drawn again on the front plane by the piece placed with part "front", so
// she walks BEHIND the near pillar and in front of the far one.
//
// Torii (myōjin): round lacquered pillars on black sleeves, stone kamebara drums on a sunk plinth,
// the nuki's end with its wedge, a black daiwa ring under the shimaki, the black-capped kasagi with
// gold end plates. With `legs` (ryōbu, the first gate): each pillar braced fore and aft along the
// road by a shorter leg, tied to it at two heights and capped with a small roof: the side view's
// weight. Paifang: four posts in a row across the road held in stone clamps and braced fore and aft
// by raking struts, two lintels end-on, three hip-and-gable roofs seen from their gable ends (the
// middle one highest), bracket sets stepping out under the eaves, a ridge beast on each ridge.
// Weathered lacquer, not flat red: a lit stripe down the west of every shaft, the cap's shadow
// under it, rain streaks under the beams, sun-faded patches, chips to dark wood near the feet,
// moss and grass at the stones.
//
// Anchor: the ground at the gate's centre. Sizes in level-1 px of the play plane.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { clamp, hash, hash1, tone, vnoise, vnoise1 } from "../../raster.ts";

export interface GateP {
  kind?: "torii" | "paifang";
  /** Distance between the pillar centres across the road, px. */
  span: number;
  /** Height of the top of the kasagi's middle (or the middle roof's eave) above the ground, px. */
  h: number;
  /** Pillar diameter at the foot, px. */
  pw?: number;
  /** "front": only what stands nearer than the road (the near pillar and the near halves). */
  part?: "all" | "front";
  /** The plaque's glyph (the builder's data). The plaque hangs edge-on between the pillars now. */
  glyph?: string;
  /** How far off true side-on the gate is turned: the share of its depth that shows across (default 0.045-0.06 from its key). */
  turn?: number;
  /** A torii braced fore and aft by legs (ryōbu). */
  legs?: boolean;
  /**
   * A rope of paper lanterns strung along the road's middle from this gate to the next: [dx, dy]
   * to the next gate's foot (the tunnel's gates, tied together into one way through).
   */
  garland?: [number, number];
  /** Detail seed shared by the gate's two pieces (its x), so the front copy matches the play copy. */
  key?: number;
}

type Shade = (sx: number, sy: number, end: boolean, X: number, Y: number) => number;

/** A colour and a depth per pixel over a gate's box (clipped to the buffer being painted). */
class Depth {
  readonly X0: number;
  readonly Y0: number;
  readonly w: number;
  readonly h: number;
  readonly col: Uint8Array;
  readonly z: Float32Array;
  constructor(c: PaintCtx, x0: number, y0: number, x1: number, y1: number) {
    const X0 = Math.max(c.buf.ox, Math.floor(c.X(x0))), X1 = Math.min(c.buf.x1, Math.ceil(c.X(x1)));
    const Y0 = Math.max(c.buf.oy, Math.floor(c.Y(y0))), Y1 = Math.min(c.buf.y1, Math.ceil(c.Y(y1)));
    this.X0 = X0;
    this.Y0 = Y0;
    this.w = Math.max(0, X1 - X0);
    this.h = Math.max(0, Y1 - Y0);
    this.col = new Uint8Array(this.w * this.h);
    this.z = new Float32Array(this.w * this.h).fill(Infinity);
  }
  get empty(): boolean {
    return this.w === 0 || this.h === 0;
  }
  put(X: number, Y: number, z: number, col: number): void {
    const x = X - this.X0, y = Y - this.Y0;
    if (!col || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (z < this.z[i]!) {
      this.z[i] = z;
      this.col[i] = col;
    }
  }
  /** The nearest surface's depth at a buffer pixel (Infinity: nothing). */
  at(X: number, Y: number): number {
    const x = X - this.X0, y = Y - this.Y0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return Infinity;
    return this.z[y * this.w + x]!;
  }
  /** Writes the pixels whose nearest surface passes `keep` into the buffer. */
  out(c: PaintCtx, keep: (z: number) => boolean): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const col = this.col[i]!;
        if (col && keep(this.z[i]!)) c.buf.set(this.X0 + x, this.Y0 + y, col);
      }
    }
  }
}

/** The side-on view: screen x = x + s * z (z across the road, negative toward the camera). */
interface View {
  c: PaintCtx;
  D: Depth;
  s: number;
}

/**
 * A round shaft standing at (x, z) on the ground at gy, H tall, radius r0 at the foot and r1 at the
 * top, its axis leaning `leanZ` across the road over its height. shade(u, a, k, X, Y) gets u 0
 * (west, lit) .. 1 across the shaft, a the height above the ground, k = a / H.
 */
function shaft(v: View, x: number, z: number, gy: number, H: number, r0: number, r1: number, leanZ: number, shade: (u: number, a: number, k: number, X: number, Y: number) => number): void {
  const { c, D, s } = v;
  const Ya = Math.max(D.Y0, Math.floor(c.Y(gy - H))), Yb = Math.min(D.Y0 + D.h, Math.ceil(c.Y(gy)));
  for (let Y = Ya; Y < Yb; Y++) {
    const a = gy - c.ly(Y + 0.5);
    if (a > H || a < 0) continue;
    const k = clamp(a / H, 0, 1);
    // entasis: the shaft swells a little a third of the way up, then tapers
    const r = (r0 + (r1 - r0) * k) * (1 + 0.035 * Math.sin(Math.min(1, k * 1.5) * Math.PI));
    const zc = z + leanZ * k;
    const xc = x + s * zc;
    const Xa = Math.max(D.X0, Math.floor(c.X(xc - r))), Xb = Math.min(D.X0 + D.w, Math.ceil(c.X(xc + r)));
    for (let X = Xa; X < Xb; X++) {
      const dx = (c.lx(X + 0.5) - xc) / r;
      if (dx < -1 || dx > 1) continue;
      D.put(X, Y, zc - r * Math.sqrt(1 - dx * dx), shade((dx + 1) / 2, a, k, X, Y));
    }
  }
}

/**
 * A section swept across the road from z1 (far) to z0 (near), its reference line at (x, yAt(z)):
 * the section's box [sx0, sx1] x [sy0, sy1] around it, shade(sx, sy, end) its colour (0: not in
 * it). The near end's face (end) is drawn last; the slices behind it show as the side trailing off.
 */
function sweep(v: View, x: number, z0: number, z1: number, yAt: (z: number) => number, box: [number, number, number, number], shade: Shade): void {
  const { c, D, s } = v;
  const n = Math.min(400, Math.ceil(Math.abs(s) * (z1 - z0) * c.d * 2) + 2);
  for (let i = 0; i <= n; i++) {
    const z = z1 - ((z1 - z0) * i) / n;
    const end = i === n;
    const xo = x + s * z, yo = yAt(z);
    const Xa = Math.max(D.X0, Math.floor(c.X(xo + box[0]))), Xb = Math.min(D.X0 + D.w, Math.ceil(c.X(xo + box[1])));
    const Ya = Math.max(D.Y0, Math.floor(c.Y(yo + box[2]))), Yb = Math.min(D.Y0 + D.h, Math.ceil(c.Y(yo + box[3])));
    for (let Y = Ya; Y < Yb; Y++) {
      const sy = c.ly(Y + 0.5) - yo;
      for (let X = Xa; X < Xb; X++) {
        const col = shade(c.lx(X + 0.5) - xo, sy, end, X, Y);
        if (col) D.put(X, Y, end ? z - 0.01 : z, col);
      }
    }
  }
}

/** A beam running ALONG the road (x) at depth z, from xa to xb, its top at y, th thick: seen from the side, its whole length. */
function bar(v: View, xa: number, xb: number, z: number, y: number, th: number, shade: (u: number, w: number, X: number, Y: number) => number): void {
  const { c, D, s } = v;
  const X0 = Math.max(D.X0, Math.floor(c.X(xa + s * z))), X1 = Math.min(D.X0 + D.w, Math.ceil(c.X(xb + s * z)));
  const Y0 = Math.max(D.Y0, Math.floor(c.Y(y))), Y1 = Math.min(D.Y0 + D.h, Math.ceil(c.Y(y + th)));
  for (let Y = Y0; Y < Y1; Y++) {
    const w = (c.ly(Y + 0.5) - y) / th;
    for (let X = X0; X < X1; X++) D.put(X, Y, z - th * 0.3, shade((c.lx(X + 0.5) - s * z - xa) / (xb - xa), w, X, Y));
  }
}

/** Lacquer on a round shaft lit from the west and high: a rim, the lit stripe, the core shadow, the road's bounce, the shade rim. */
function roundT(u: number): number {
  return u < 0.05 ? 0.1 : u < 0.15 ? -0.1 : u < 0.33 ? -0.26 : u < 0.5 ? -0.08 : u < 0.7 ? 0.08 : u < 0.87 ? 0.24 : u < 0.95 ? 0.14 : 0.36;
}

interface PillarO {
  /** Height of the black sleeve at the foot (0: none). */
  sleeve: number;
  seed: number;
  /** The far pillar: a step darker and flatter (further off, under the near one's shade). */
  far: boolean;
  /** Bands of cast shadow down the shaft: [top a, length] (under the cap, under the nuki). */
  shadows: [number, number][];
  /** Standing in water: dark wet to a hand's height, a bright line at the waterline. */
  wet?: boolean;
  small?: boolean;
}

/**
 * A lacquered pillar's pixel: vermilion above a black sleeve with a gold band, the beams' shadow
 * under them, rain streaks, a faded patch on the lit side, chips to dark wood near the foot.
 */
function pillarPx(c: PaintCtx, u: number, a: number, k: number, X: number, Y: number, o: PillarO): number {
  const rt = roundT(u) * (o.far ? 0.55 : 1);
  if (o.wet) {
    const wh = 4 + 2 * hash1(o.seed, 3);
    if (a < 0.7 / c.d) return P.cloud[2]!;
    if (a < wh) return tone(P.red, clamp(0.8 + rt * 0.5, 0, 1), X, Y, 0.3);
  }
  const sleeve = a < o.sleeve;
  if (o.sleeve > 0 && Math.abs(a - o.sleeve) < 1.3 / c.d) return tone(P.gold, u < 0.4 ? 0.3 : u < 0.8 ? 0.55 : 0.8, X, Y, 0.3);
  if (sleeve) {
    let t = 0.5 + rt * 0.9 + (o.far ? 0.12 : 0);
    // splashes of road dust on the black, low down
    if (!o.small && a < o.sleeve * 0.35 && vnoise(u * 7, a / 3, o.seed + 9) > 0.66) return tone(P.stone, 0.62, X, Y, 0.3);
    return tone(P.lacquer, clamp(t, 0, 1), X, Y, 0.3);
  }
  let ramp: readonly number[] = P.red;
  let t = 0.42 + rt + (o.far ? 0.14 : 0);
  // the beams' shadow falls on the shaft under them, the sun high and west: deeper on the east
  for (const [top, len] of o.shadows) {
    const below = top - a;
    if (below > -0.5 && below < len * (0.45 + 0.55 * u)) t += below < len * 0.3 ? 0.24 : 0.18;
  }
  if (!o.small) {
    // rain streaks run down from the beams, darker where the water runs most
    const st = vnoise(u * 9, a / 38, o.seed + 3);
    if (st > 0.68 && k > 0.25) t += 0.1 * (k - 0.25) / 0.75 + 0.05;
    // sun-faded lacquer: a paler patch on the lit side
    if (u > 0.08 && u < 0.42 && vnoise(u * 5, a / 16, o.seed + 4) > 0.68) t -= 0.08;
    // chips near the foot: dark wood showing through
    if (c.d >= 0.5 && a < o.sleeve + 40 && hash(Math.floor(u * 12), Math.floor(a / 2), o.seed + 5) < 0.03) {
      ramp = P.timber;
      t = 0.82;
    }
  }
  return tone(ramp, clamp(t, 0, 1), X, Y, 0.3);
}

/**
 * A stone kamebara on a sunk plinth round a pillar's foot: the plinth a squared, chipped block
 * bedded in the path, the drum a rounded tortoise-back on it, lichen on its shoulder, moss up from
 * the ground, grass at its foot.
 */
function drum(v: View, x: number, z: number, gy: number, r: number, hh: number, seed: number): void {
  const { c, D, s } = v;
  const xc = x + s * z;
  const d = c.d;
  // the plinth: a low squared block, its top edge lit, chipped corners, half in the path
  const pr = r * 1.22, ph = hh * 0.42;
  {
    const Ya = Math.max(D.Y0, Math.floor(c.Y(gy - ph))), Yb = Math.min(D.Y0 + D.h, Math.ceil(c.Y(gy + 3)));
    const Xa = Math.max(D.X0, Math.floor(c.X(xc - pr))), Xb = Math.min(D.X0 + D.w, Math.ceil(c.X(xc + pr)));
    for (let Y = Ya; Y < Yb; Y++) for (let X = Xa; X < Xb; X++) {
      const lx = c.lx(X + 0.5) - xc, ly = c.ly(Y + 0.5) - gy;
      const ex = pr - Math.abs(lx);
      // chipped corners
      if (ly < -ph + 2.5 && ex < 2.5 - (ly + ph) * 0.6 + 2 * hash1(Math.sign(lx) + 3, seed)) continue;
      const u = (lx + pr) / (2 * pr);
      let t = u < 0.12 ? 0.22 : u < 0.6 ? 0.38 : u < 0.9 ? 0.55 : 0.72;
      if (ly < -ph + 1.4 / d) t = u < 0.6 ? 0.08 : 0.3;
      if (d >= 0.5 && vnoise(lx / 2.5, ly / 1.5, seed + 3) > 0.7) t += 0.13;
      let col = tone(P.stone, clamp(t, 0, 1), X, Y, 0.3);
      if (ly > -ph * (0.3 + 0.6 * vnoise1(lx / 4, seed + 4)) && vnoise1(lx / 5 + 9, seed + 5) > 0.45) col = tone(P.moss, clamp(0.5 + u * 0.25 + (ly > 0 ? 0.15 : 0), 0, 1), X, Y, 0.35);
      if (ly > 0) col = tone(P.karst, 0.82 + (u > 0.5 ? 0.1 : 0), X, Y, 0.3);
      D.put(X, Y, z - pr * 0.8, col);
    }
  }
  // the drum: rounded, its lit shoulder west
  const g2 = gy - ph + 1;
  const Ya = Math.max(D.Y0, Math.floor(c.Y(g2 - hh))), Yb = Math.min(D.Y0 + D.h, Math.ceil(c.Y(g2)));
  for (let Y = Ya; Y < Yb; Y++) {
    const ly = c.ly(Y + 0.5) - g2;
    const up = clamp(-ly / hh, 0, 1);
    const rr = r * Math.pow(Math.max(0, 1 - Math.pow(up, 2.6)), 1 / 2.6);
    const Xa = Math.max(D.X0, Math.floor(c.X(xc - rr))), Xb = Math.min(D.X0 + D.w, Math.ceil(c.X(xc + rr)));
    for (let X = Xa; X < Xb; X++) {
      const lx = c.lx(X + 0.5) - xc;
      const dx = lx / rr;
      if (dx < -1 || dx > 1) continue;
      let t = dx < -0.7 ? 0.2 : dx < -0.2 ? 0.08 : dx < 0.35 ? 0.3 : dx < 0.75 ? 0.5 : 0.66;
      if (up > 0.8) t -= 0.1;
      // a groove round the drum a third of the way up
      if (Math.abs(up - 0.3) < 0.06) t += 0.22;
      if (d >= 0.5 && vnoise(lx / 3, ly / 2, seed) > 0.72) t += 0.14;
      let col = tone(P.stone, clamp(t, 0, 1), X, Y, 0.3);
      // lichen on the shoulder, moss in the groove
      if (up > 0.55 && vnoise(lx / 2.2, ly / 2.2, seed + 6) > 0.74) col = tone(P.moss, 0.25 + (dx > 0 ? 0.2 : 0), X, Y, 0.3);
      else if (Math.abs(up - 0.3) < 0.08 && vnoise1(lx / 3, seed + 7) > 0.5) col = tone(P.moss, 0.55 + dx * 0.15, X, Y, 0.35);
      D.put(X, Y, z - r * Math.sqrt(1 - dx * dx), col);
    }
  }
  // grass blades at the plinth's foot, both sides of it
  if (d >= 0.5) {
    for (let i = 0; i < 10; i++) {
      const gx = xc + (hash1(i, seed + 7) - 0.5) * pr * 2.6;
      const gh = 2 + 7 * hash1(i, seed + 8);
      const lean = (hash1(i, seed + 9) - 0.5) * 0.8;
      for (let a = 0; a < gh; a += 1 / d) D.put(Math.round(c.X(gx + lean * a)), Math.round(c.Y(gy + 1 - a)), z - pr - 1, P.moss[a < gh * 0.4 ? 5 : a < gh * 0.75 ? 3 : 2]!);
    }
  }
}

/** Contact shadow on the road east of a foot (the sun is west and high): two hard steps. */
function contactShadow(v: View, x: number, z: number, gy: number, w: number): void {
  const { c, D, s } = v;
  const xc = x + s * z;
  const Ya = Math.max(D.Y0, Math.floor(c.Y(gy - 1))), Yb = Math.min(D.Y0 + D.h, Math.ceil(c.Y(gy + 3)));
  const Xa = Math.max(D.X0, Math.floor(c.X(xc - w * 0.3))), Xb = Math.min(D.X0 + D.w, Math.ceil(c.X(xc + w * 1.15)));
  for (let Y = Ya; Y < Yb; Y++) for (let X = Xa; X < Xb; X++) {
    const out = (c.lx(X + 0.5) - xc) / w;
    D.put(X, Y, z + 4, out < 0.75 ? P.karst[7]! : P.karst[6]!);
  }
}

// --- the torii ---------------------------------------------------------------------------------

export interface ToriiO {
  span: number;
  h: number;
  pw: number;
  /** Turn off side-on (negative: the far side shows to the west). */
  s: number;
  seed: number;
  /** "front": only what is nearer than the road's middle; "all": everything. */
  part?: "all" | "front";
  /** Standing in water: no drums, wet dark feet with a bright line at the waterline instead. */
  wet?: boolean;
  /** Drop the small details (the islet's small torii). */
  small?: boolean;
  /** Braced fore and aft by legs (ryōbu). */
  legs?: boolean;
  /** A rope of lanterns from this gate to the next one at [dx, dy] (its foot from this one's). */
  garland?: [number, number];
}

/** The torii's parts' sizes, from its pillar diameter. */
function toriiDims(o: Pick<ToriiO, "span" | "h" | "pw" | "small">) {
  const { span, h, pw } = o;
  const half = span / 2;
  const capH = Math.max(1.5, pw * 0.4), redH = Math.max(1.5, pw * 0.38), gapH = Math.max(0.5, pw * 0.05);
  const kW = pw * 1.75, shimW = pw * 1.16;
  const sweepK = Math.max(1.5, capH * 0.75);
  const daiH = Math.max(1, pw * 0.2);
  const yK = -h, yS = -h + capH + gapH;
  const pillarTop = yS + redH + daiH;
  const nukiY = -h + Math.max(o.small ? 0 : 60, h * 0.24), nukiH = Math.max(1.5, pw * 0.6), nukiW = Math.max(1.5, pw * 0.42);
  const LK = half + 2.3 * pw, LS = half + 1.5 * pw, LN = half + 1.05 * pw;
  const legD = h * 0.27, legH = h * 0.46, legR = pw * 0.33;
  return { half, capH, redH, gapH, kW, shimW, sweepK, daiH, yK, yS, pillarTop, nukiY, nukiH, nukiW, LK, LS, LN, legD, legH, legR };
}

/** The box a torii paints, level-1 px around its foot. */
export function toriiBounds(o: Pick<ToriiO, "span" | "h" | "pw" | "s" | "legs" | "small" | "garland">): [number, number, number, number] {
  const D = toriiDims(o);
  const spread = Math.abs(o.s) * D.LK + D.kW / 2 + 4;
  const legs = o.legs ? D.legD + D.legR * 3.5 + Math.abs(o.s) * D.half + 4 : 0;
  const foot = o.pw * 1.4;
  const w = Math.max(spread, legs, foot + Math.abs(o.s) * D.half + 6);
  const b: [number, number, number, number] = [-w - 4, -o.h - D.sweepK - D.capH * 0.3 - 6, w + o.pw * 1.4 + 4, 8];
  if (o.garland) {
    const [gx, gy] = o.garland;
    b[0] = Math.min(b[0], gx - 12);
    b[2] = Math.max(b[2], gx + 12);
    b[1] = Math.min(b[1], -o.h + gy - 12);
  }
  return b;
}

/** A myōjin torii in profile at (x, y) (its foot), drawn through its own depth test. */
export function torii(c: PaintCtx, x: number, y: number, o: ToriiO): void {
  const b = toriiBounds(o);
  const D = new Depth(c, x + b[0], y + b[1], x + b[2], y + b[3]);
  if (D.empty) return;
  const v: View = { c, D, s: o.s };
  const { pw, seed } = o;
  const d = c.d;
  const T = toriiDims(o);
  const { half, capH, redH, gapH, kW, shimW, sweepK, daiH, yK, yS, pillarTop, nukiY, nukiH, nukiW, LK, LS, LN } = T;
  const lean = Math.max(1, o.span * 0.014);
  const sleeve = o.wet ? 0 : Math.max(8, o.h * 0.1);
  // shadows down the shafts: the cap's (long, the sun high) and the nuki's
  const shadows: [number, number][] = [[-pillarTop, pw * 1.1], [-nukiY - nukiH, pw * 0.55]];
  // the shafts and their stones (far first; the depth test sorts the rest)
  for (const zs of [1, -1]) {
    const far = zs > 0;
    const sd = seed + (far ? 2 : 1);
    shaft(v, x, zs * half, y, -pillarTop, pw / 2, pw * 0.43, -zs * lean, (u, a, k, X, Y) => pillarPx(c, u, a, k, X, Y, { sleeve, seed: sd, far, shadows, wet: o.wet, small: o.small }));
    // the daiwa: a black ring at the pillar's head, under the shimaki
    const zt = zs * half - zs * lean;
    sweep(v, x, zt - pw * 0.5, zt + pw * 0.5, () => y + pillarTop - daiH, [-pw * 0.56, pw * 0.56, 0, daiH], (sx, sy, end, X, Y) => {
      const u = (sx + pw * 0.56) / (pw * 1.12);
      if (end) return tone(P.lacquer, clamp(0.5 + roundT(u) * 0.8 + (sy < daiH * 0.25 ? -0.2 : 0) + (far ? 0.1 : 0), 0, 1), X, Y, 0.3);
      return tone(P.lacquer, 0.3, X, Y, 0.3);
    });
    if (!o.wet && !o.small) {
      drum(v, x, zs * half, y, pw * 0.86, Math.max(6, pw * 0.5), sd + 10);
      contactShadow(v, x, zs * half, y, pw * 1.05);
    }
    // ryōbu: a leg fore and aft of the pillar along the road, tied to it at two heights, capped
    if (o.legs) {
      const { legD, legH, legR } = T;
      for (const lx of [-legD, legD]) {
        const ls = sd + 20 + (lx > 0 ? 1 : 0);
        shaft(v, x + lx, zs * half, y, legH, legR, legR * 0.9, 0, (u, a, k, X, Y) => pillarPx(c, u, a, k, X, Y, { sleeve: sleeve * 0.8, seed: ls, far, shadows: [[legH, legR * 2.2]], wet: o.wet, small: o.small }));
        // the ties: two beams along the road from the leg into the pillar, seen whole from the side
        for (const [ta, th] of [[legH * 0.92, legR * 1.3], [legH * 0.5, legR * 1.1]] as const) {
          const xa = lx < 0 ? x + lx - legR * 1.6 : x + pw * 0.3, xb = lx < 0 ? x - pw * 0.3 : x + lx + legR * 1.6;
          bar(v, xa, xb, zs * half - legR * 0.2, y - ta, th, (u, w, X, Y) => {
            // the ends past the leg cut square, a darker end grain; lit along the top
            const endCut = lx < 0 ? u < (legR * 0.6) / (xb - xa) : u > 1 - (legR * 0.6) / (xb - xa);
            let t = w < 0.18 ? 0.14 : w < 0.7 ? 0.36 : 0.56;
            if (endCut) t += 0.12;
            if (far) t += 0.12;
            return tone(P.red, clamp(t, 0, 1), X, Y, 0.3);
          });
        }
        // the leg's cap: a small black rain cover running along the road, seen along its length
        // from this side (a little kasagi face-on: its ends swept up), a red layer under it
        const capL = legR * 3.4, capT = Math.max(2, legR * 0.85), redT = Math.max(1.5, legR * 0.6);
        const zc = zs * half - legR * 1.2;
        const ya = y - legH;
        const Xa = Math.max(D.X0, Math.floor(c.X(x + lx + o.s * zc - capL - 1))), Xb = Math.min(D.X0 + D.w, Math.ceil(c.X(x + lx + o.s * zc + capL + 1)));
        const Ya = Math.max(D.Y0, Math.floor(c.Y(ya - redT - capT * 2.4))), Yb = Math.min(D.Y0 + D.h, Math.ceil(c.Y(ya + 1)));
        for (let Y = Ya; Y < Yb; Y++) for (let X = Xa; X < Xb; X++) {
          const sx = c.lx(X + 0.5) - (x + lx + o.s * zc), ly = c.ly(Y + 0.5) - ya;
          const k = Math.abs(sx) / capL;
          if (k > 1) continue;
          const up = capT * 1.1 * Math.pow(Math.max(0, k - 0.35) / 0.65, 2.2);
          const redTop = -redT, capTop = redTop - capT - up * 0.6;
          const lipBot = redTop - up * 0.6 + (k > 0.7 ? 0 : 0);
          let col = 0;
          if (ly < 0 && ly >= redTop && k < 0.78) col = tone(P.red, ly < redTop + 1 / d ? 0.1 : 0.42 + (far ? 0.12 : 0), X, Y, 0.3);
          else if (ly < lipBot && ly >= capTop - capT * 0.25 * (1 - k * k)) {
            const w = (ly - (capTop - capT * 0.25 * (1 - k * k))) / (lipBot - capTop + capT * 0.25 * (1 - k * k));
            col = w < 0.22 ? tone(P.lacquer, 0.1, X, Y, 0.3) : w > 0.82 ? P.lacquer[4]! : tone(P.lacquer, (sx < 0 ? 0.42 : 0.58) + (far ? 0.12 : 0), X, Y, 0.3);
          }
          if (col) D.put(X, Y, zc - 0.5, col);
        }
      }
    }
  }
  // the nuki: its end block toward us, lacquered red, a wedge driven in beside each pillar
  sweep(v, x, -LN, LN, () => nukiY + y, [-nukiW / 2, nukiW / 2, 0, nukiH], (sx, sy, end, X, Y) => {
    const u = (sx + nukiW / 2) / nukiW, w = sy / nukiH;
    if (end) {
      if (u > 0.84 || w > 0.84) return P.red[5]!;
      if (w < 0.14) return P.red[1]!;
      return tone(P.red, u < 0.3 ? 0.5 : 0.62, X, Y, 0.3);
    }
    return tone(P.red, w < 0.18 ? 0.08 : w > 0.8 ? 0.5 : 0.24, X, Y, 0.3);
  });
  if (!o.small) {
    for (const zs of [1, -1]) {
      const zw = zs * (half + pw * 0.66);
      sweep(v, x, zw - pw * 0.1, zw + pw * 0.1, () => nukiY + y, [-nukiW * 0.2, nukiW * 0.2, -pw * 0.14, nukiH * 0.3], (sx, sy, end, X, Y) => {
        // the wedge driven down into the nuki, its head standing proud above it, dark lacquer
        const taper = nukiW * 0.2 * (1 - 0.45 * clamp((sy + pw * 0.14) / (nukiH * 0.3 + pw * 0.14), 0, 1));
        if (Math.abs(sx) > taper) return 0;
        return tone(P.lacquer, end ? (sx < -taper * 0.4 ? 0.3 : 0.62) : 0.35, X, Y, 0.3);
      });
    }
  }
  // (the strut and the plaque between the nuki and the shimaki hang edge-on at the road's middle,
  // hidden behind the near pillar from this side)
  // the shimaki and the kasagi sweep up toward their ends
  const lift = (z: number, L: number, k: number): number => k * Math.pow(Math.max(0, Math.abs(z) / L - 0.38) / 0.62, 2.1);
  const sweepS = sweepK * 0.42;
  // the shimaki: the red beam under the cap, its end plated
  sweep(v, x, -LS, LS, (z) => yS + y - lift(z, LS, sweepS), [-shimW / 2, shimW / 2, 0, redH], (sx, sy, end, X, Y) => {
    if (end) {
      const u = (sx + shimW / 2) / shimW, w = sy / redH;
      if (u > 0.9 || w > 0.86) return P.red[5]!;
      if (w < 0.14) return P.red[1]!;
      return tone(P.red, u < 0.12 ? 0.36 : 0.54, X, Y, 0.3);
    }
    const w = sy / redH;
    return tone(P.red, w < 0.2 ? 0.02 : w > 0.78 ? 0.42 : 0.16, X, Y, 0.3);
  });
  // the kasagi: a heavy black cap, crowned, its lip overhanging the shimaki both sides; its ends
  // sweep up (the cap's underside lifts at both ends of the profile); gold end plates
  // the kasagi's section is a small roof over the shimaki (it sheds the rain): a low gable on top,
  // the lips overhanging both sides and turned up a little at their tips, so from its end the cap
  // reads as a roof, not a box
  const peak = capH * 0.42;
  const kTop = (ax: number): number => -peak * (1 - ax) - capH * 0.2 * Math.pow(Math.max(0, ax - 0.8) / 0.2, 2);
  const kBot = (ax: number): number => capH * (1 - 0.5 * ax * ax) - capH * 0.18 * Math.pow(Math.max(0, ax - 0.8) / 0.2, 2);
  sweep(v, x, -LK, LK, (z) => yK + y - lift(z, LK, sweepK), [-kW / 2, kW / 2, -peak - capH * 0.25, capH + gapH], (sx, sy, end, X, Y) => {
    const ax = Math.abs(sx) / (kW / 2);
    if (ax > 1) return 0;
    const top = kTop(ax), bot = kBot(ax);
    if (sy < top) return 0;
    if (sy > bot) {
      // the shadow gap between the cap and the shimaki
      if (Math.abs(sx) > shimW / 2 || sy > capH + gapH) return 0;
      return P.lacquer[4]!;
    }
    const w = (sy - top) / Math.max(0.5, bot - top);
    if (end) {
      // the cut end: the two slopes of the little roof (west lit, east in shade), its lip's dark edge
      if (sy < top + 1 / d) return tone(P.lacquer, sx < 0 ? 0.02 : 0.25, X, Y, 0.3);
      if (w > 0.8 || sy > bot - 1.2 / d) return P.lacquer[4]!;
      return tone(P.lacquer, sx < 0 ? 0.42 : 0.66, X, Y, 0.3);
    }
    // the sunlit west side trailing off to the far end (rising with the sweep): the slope catches
    // the sky, the lip dark under it
    if (w < 0.3) return P.lacquer[0]!;
    if (w > 0.78) return P.lacquer[3]!;
    return tone(P.lacquer, 0.22, X, Y, 0.3);
  });
  if (o.garland) garland(v, x, y + pillarTop + nukiH * 0.6, o.garland, seed);
  D.out(c, o.part === "front" ? (z) => z < 0 : () => true);
}

/**
 * A rope along the road's middle (z 0: behind the near pillars, in front of the far ones) from a
 * gate's strut to the next gate's, sagging, hung with small paper lanterns, red and white by
 * turns, each with a warm core and black caps.
 */
function garland(v: View, x: number, y: number, to: [number, number], seed: number): void {
  const { c, D } = v;
  const d = c.d;
  const [gx, gy] = to;
  const sag = Math.abs(gx) * 0.13;
  const at = (t: number): [number, number] => [x + gx * t, y + gy * t + sag * 4 * t * (1 - t)];
  const n = Math.ceil(Math.abs(gx) * d * 1.6) + 2;
  for (let i = 0; i <= n; i++) {
    const [rx, ry] = at(i / n);
    const X = Math.round(c.X(rx));
    for (let o = 0; o < 2; o += 0.5 / d) {
      const Y = Math.round(c.Y(ry + o - 1));
      D.put(X, Y, 0, o < 0.8 ? P.earth[2]! : P.earth[4]!);
    }
  }
  const k = Math.max(1, Math.round(Math.abs(gx) / 38) - 1);
  for (let i = 1; i <= k; i++) {
    const t = i / (k + 1) + (hash1(i, seed + 31) - 0.5) * 0.06;
    const [lx, ly] = at(t);
    const white = (i + Math.round(hash1(0, seed + 32) * 2)) % 2 === 0;
    const r = 5.2, hh = 14.5, top = ly + 3.5;
    // its string
    for (let s = 0; s < 3.5; s += 0.5 / d) D.put(Math.round(c.X(lx)), Math.round(c.Y(ly + s)), 0, P.ink[0]!);
    const Ya = Math.floor(c.Y(top)), Yb = Math.ceil(c.Y(top + hh + 2));
    const Xa = Math.floor(c.X(lx - r - 1)), Xb = Math.ceil(c.X(lx + r + 1));
    for (let Y = Ya; Y < Yb; Y++) for (let X = Xa; X < Xb; X++) {
      const u = (c.lx(X + 0.5) - (lx - r)) / (2 * r), vv = (c.ly(Y + 0.5) - top) / hh;
      if (vv > 1.12) {
        // the tassel
        if (Math.abs(u - 0.5) < 0.12 && vv < 1.22) D.put(X, Y, 0.2, P.red[3]!);
        continue;
      }
      const kx = Math.abs(u - 0.5) * 2;
      if (vv < 0.1 || vv > 0.9) {
        if (kx < 0.62) D.put(X, Y, 0.2, P.lacquer[3]!);
        continue;
      }
      if (kx > Math.sqrt(Math.max(0, 1 - Math.pow(vv * 2 - 1, 2))) * 1.05) continue;
      const core = Math.hypot(u - 0.42, (vv - 0.5) * 1.3);
      let col: number;
      if (core < 0.2) col = tone(P.ember, 0.15 + core * 2.5, X, Y, 0.3);
      else if (d >= 1 && Math.abs(((vv * 5) % 1) - 0.5) < 0.1) col = white ? P.paper[3]! : P.red[4]!;
      else col = white ? tone(P.paper, u < 0.3 ? 0.05 : u < 0.7 ? 0.25 : 0.55, X, Y, 0.3) : tone(P.red, u < 0.3 ? 0.05 : u < 0.7 ? 0.2 : 0.5, X, Y, 0.3);
      D.put(X, Y, 0.2, col);
    }
  }
}

// --- the paifang -------------------------------------------------------------------------------

/**
 * A hip-and-gable roof seen from its gable end, swept across the road from z1 to z0: the end
 * shows the gable's red board under the ridge, tile runs on the hip slope below it, a row of
 * round tile ends along the eave; the eaves sweep out and turn up at both sides; the ridge ends in
 * a beast curling up. eave: the eave line's y; rise: to the ridge; R: the eaves' reach either side.
 */
function roofEnd(v: View, x: number, z0: number, z1: number, eave: number, rise: number, R: number, seed: number): void {
  const d = v.c.d;
  const tip = rise * 0.48, ridgeH = Math.max(3, rise * 0.16), slab = Math.max(3, rise * 0.17);
  const topAt = (a: number): number => -rise * Math.pow(Math.max(0, 1 - a / 0.96), 1.55) - tip * Math.pow(Math.max(0, (a - 0.62) / 0.38), 2.4);
  sweep(v, x, z0, z1, () => eave, [-R - 1, R + 1, -rise - ridgeH * 2.8, slab + 2], (sx, sy, end, X, Y) => {
    const a = Math.abs(sx) / R;
    if (a > 1) return 0;
    const top = topAt(a);
    // the ridge and the beast on its end (a curl rising from the ridge, gold-tipped)
    if (a < 0.16) {
      const rt = -rise - ridgeH * (1 - Math.pow(a / 0.16, 3));
      if (sy >= rt && sy < top) return end ? tone(P.lacquer, sx < 0 ? 0.35 : 0.6, X, Y, 0.3) : P.lacquer[1]!;
      if (end && a < 0.11 && sy < rt && sy > -rise - ridgeH * 2.7) {
        const k = (-rise - ridgeH - sy) / (ridgeH * 1.7);
        const cx = -0.04 * R + k * k * 0.07 * R;
        if (Math.abs(sx - cx) < R * (0.075 - 0.035 * k)) return k > 0.8 ? P.gold[2]! : tone(P.lacquer, sx < cx ? 0.3 : 0.6, X, Y, 0.3);
      }
    }
    const bottom = top + slab * (0.7 + 0.5 * (1 - a));
    if (sy < top || sy > bottom) return 0;
    if (!end) {
      // the roof's side, at a grazing angle: dark tiles, the slope's top edge lit
      return sy < top + 1.2 / d ? P.tile[1]! : tone(P.tile, 0.62, X, Y, 0.3);
    }
    // the eave's edge: round tile ends over a dark fascia, a gold drip line
    if (sy > bottom - Math.max(1.5, slab * 0.45)) {
      const cap = sx / 5.2 - Math.floor(sx / 5.2) - 0.5;
      if (sy > bottom - 1 / d) return P.lacquer[4]!;
      return Math.abs(cap) < 0.32 ? tone(P.tile, cap < 0 ? 0.3 : 0.6, X, Y, 0.3) : P.lacquer[4]!;
    }
    // the gable: a red board with a gold rim, high under the ridge
    const gab = 0.5 * (1 - (sy + rise) / (rise * 0.62));
    if (a < gab && sy < -rise * 0.36) return a > gab - 0.06 ? tone(P.gold, 0.4, X, Y, 0.3) : tone(P.red, 0.48 + (sx > 0 ? 0.1 : 0), X, Y, 0.3);
    // the hip slope: tile runs falling toward us, each lit on its west side
    const run = (sx + R) / 3.4;
    const fr = run - Math.floor(run);
    let t = 0.42 + (fr < 0.3 ? -0.18 : fr > 0.76 ? 0.2 : 0) + a * 0.1;
    if (d >= 0.5 && hash(Math.floor(run), Math.floor(sy / 2), seed) < 0.05) t += 0.15;
    return tone(P.tile, clamp(t, 0, 1), X, Y, 0.3);
  });
}

/** A set of brackets stepping out under an eave, end-on: three tiers of gold blocks on black arms. */
function brackets(v: View, x: number, z0: number, z1: number, eave: number, reach: number, hgt: number, base: number): void {
  sweep(v, x, z0, z1, () => eave, [-reach, reach, 0, hgt], (sx, sy, end, X, Y) => {
    const tier = Math.min(2, Math.floor((sy / hgt) * 3));
    const w = reach - (reach - base) * (tier / 2.4) - (sy / hgt) * 2;
    if (Math.abs(sx) > w) return 0;
    if (!end) return P.lacquer[2]!;
    const f = (sy / hgt) * 3 - tier;
    if (f < 0.42 && Math.abs(sx) > w - 4.2) return tone(P.gold, sx < 0 ? 0.2 : 0.5, X, Y, 0.3);
    if (f < 0.42 && Math.abs(sx) < 3) return P.red[3]!;
    return f > 0.85 ? P.lacquer[4]! : P.lacquer[2]!;
  });
}

/** A raking strut from a post at (x, z) down to the ground at x + dx: a round timber, lacquered, on a small footing stone. */
function strut(v: View, x: number, z: number, top: number, dx: number, r: number, far: boolean, seed: number): void {
  const { c, D, s } = v;
  const xs = x + s * z;
  const len = Math.hypot(dx, top);
  const n = Math.ceil(len * c.d * 1.5) + 2;
  // along the strut from its foot (t 0) to its head (t 1)
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = xs + dx * (1 - t), cy = -top * t;
    // the strut's normal on screen, pointing east: q runs across it from its west side
    const nx = top / len, ny = -dx / len;
    const rr = r * (1 - 0.15 * t);
    for (let q = -rr; q <= rr; q += 0.5 / c.d) {
      const X = Math.round(c.X(cx + nx * q)), Y = Math.round(c.Y(cy + ny * q));
      const u = (q + rr) / (2 * rr);
      const a = -cy;
      let col: number;
      if (a < 9) col = tone(P.lacquer, clamp(0.45 + roundT(u) * 0.8 + (far ? 0.12 : 0), 0, 1), X, Y, 0.3);
      else col = tone(P.red, clamp(0.44 + roundT(u) * (far ? 0.5 : 1) + (far ? 0.24 : 0) + (vnoise(u * 6, a / 30, seed) > 0.72 ? 0.08 : 0), 0, 1), X, Y, 0.3);
      D.put(X, Y, z - rr * Math.sqrt(Math.max(0, 1 - (q / rr) ** 2)) - 0.5, col);
    }
  }
  // its footing: a squat stone the strut's foot is socketed into
  const fx = xs + dx, fw = r * 2.4, fh = r * 1.5;
  const Ya = Math.max(D.Y0, Math.floor(c.Y(-fh))), Yb = Math.min(D.Y0 + D.h, Math.ceil(c.Y(2)));
  const Xa = Math.max(D.X0, Math.floor(c.X(fx - fw))), Xb = Math.min(D.X0 + D.w, Math.ceil(c.X(fx + fw)));
  for (let Y = Ya; Y < Yb; Y++) for (let X = Xa; X < Xb; X++) {
    const lx = c.lx(X + 0.5) - fx, ly = c.ly(Y + 0.5);
    const ax = Math.abs(lx) / fw;
    if (ly < -fh * (1 - Math.pow(ax, 3))) continue;
    let t = lx < -fw * 0.5 ? 0.2 : lx < fw * 0.3 ? 0.38 : 0.6;
    if (ly < -fh * (1 - Math.pow(ax, 3)) + 1.2 / c.d) t -= 0.14;
    let col = tone(P.stone, clamp(t + (far ? 0.1 : 0), 0, 1), X, Y, 0.3);
    if (ly > -fh * 0.35 && vnoise1(lx / 3 + 5, seed + 2) > 0.45) col = tone(P.moss, 0.55 + ax * 0.2, X, Y, 0.35);
    D.put(X, Y, z - fw * 0.5, col);
  }
}

function paifang(c: PaintCtx, p: GateP, s: number, pw: number, seed: number): void {
  const half = p.span / 2, h = p.h;
  const b = gate.bounds(p);
  const D = new Depth(c, b[0], b[1], b[2], b[3]);
  if (D.empty) return;
  const v: View = { c, D, s };
  // four posts across the road (the middle pair taller), each held in a pair of stone clamps and
  // braced fore and aft along the road by a raking strut
  const posts = [-half, -half * 0.36, half * 0.36, half];
  const braceTop = h * 0.36, braceD = h * 0.2;
  posts.forEach((zp, i) => {
    const tall = Math.abs(zp) < half;
    const top = -h + (tall ? 50 : 74);
    const far = zp > 0;
    const shadows: [number, number][] = [[h - 84 - 18, pw * 0.7], [-top, pw * 0.8]];
    shaft(v, 0, zp, 0, -top, pw * (tall ? 0.56 : 0.5), pw * (tall ? 0.5 : 0.45), 0, (u, a, k, X, Y) => pillarPx(c, u, a, k, X, Y, { sleeve: 16, seed: seed + i * 13, far, shadows }));
    // the outer posts carry the struts (the ones that take the wind)
    if (!tall) for (const dir of [-1, 1]) strut(v, 0, zp + (far ? 2 : -2), braceTop, dir * braceD, pw * 0.2, far, seed + i * 13 + dir);
    // the clamp stones: tall blocks either side of the post along the road, their tops rounded
    const ch = Math.max(14, h * 0.1), cw = pw * 1.1;
    sweep(v, 0, zp - pw * 0.42, zp + pw * 0.42, () => 0, [-cw, cw, -ch - 4, 2], (sx, sy, end, X, Y) => {
      const ax = Math.abs(sx) / cw;
      const top = -ch * (0.62 + 0.38 * Math.sqrt(Math.max(0, 1 - Math.pow(ax, 2.5)))) - (ax < 0.3 ? 3 : 0);
      if (sy < top) return 0;
      if (!end) return tone(P.stone, sy < top + 1.5 ? 0.1 : 0.32, X, Y, 0.3);
      let t = sx < -cw * 0.5 ? 0.18 : sx < cw * 0.25 ? 0.38 : 0.6;
      if (sy < top + 1.4) t -= 0.14;
      if (far) t += 0.1;
      // the iron band round the clamp, and moss creeping up from the road
      if (Math.abs(sy + ch * 0.55) < 1.6) return P.lacquer[3]!;
      if (sy > -ch * (0.12 + 0.3 * vnoise1(sx / 4, seed + i)) && vnoise1(sx / 3 + 7, seed + i + 3) > 0.4) return tone(P.moss, 0.5 + ax * 0.2, X, Y, 0.35);
      if (c.d >= 0.5 && vnoise(sx / 3, sy / 2, seed + i * 7) > 0.74) t += 0.12;
      return tone(P.stone, clamp(t, 0, 1), X, Y, 0.3);
    });
    contactShadow(v, 0, zp, 0, cw * 1.1);
  });
  // the lintels end-on: the great lower one across all four posts, a second under the middle bay
  const lin = (z0: number, z1: number, y: number, th: number, w: number): void => {
    sweep(v, 0, z0, z1, () => y, [-w / 2, w / 2, 0, th], (sx, sy, end, X, Y) => {
      const u = (sx + w / 2) / w, k = sy / th;
      if (!end) return tone(P.red, k < 0.2 ? 0.08 : k > 0.8 ? 0.5 : 0.24, X, Y, 0.3);
      if (u > 0.88 || k > 0.84) return P.red[5]!;
      // the painted end: a gold ring on dark lacquer, the beam's mark
      const r = Math.hypot((u - 0.48) * w, (k - 0.5) * th);
      if (c.d >= 0.5 && r < th * 0.36) return Math.abs(r - th * 0.26) < 0.8 ? P.gold[1]! : r < th * 0.12 ? P.gold[2]! : P.lacquer[3]!;
      return tone(P.red, k < 0.15 ? 0.25 : 0.48, X, Y, 0.3);
    });
  };
  lin(-half - 18, half + 18, -h + 84, 18, pw * 0.9);
  lin(-half * 0.36 - 10, half * 0.36 + 10, -h + 140, 13, pw * 0.76);
  // brackets under each roof, then the roofs: the two side roofs (over the side bays, near and
  // far) at one height, the middle roof higher and wider over them
  for (const zs of [1, -1]) {
    const za = zs > 0 ? half * 0.36 - 16 : -half - 30, zb = zs > 0 ? half + 30 : -half * 0.36 + 16;
    brackets(v, 0, za + 8, zb - 8, -h + 66, pw * 1.45, 18, pw * 0.5);
    roofEnd(v, 0, za, zb, -h + 66, 38, pw * 2.4, seed + 5 + zs);
  }
  brackets(v, 0, -half * 0.36 - 26, half * 0.36 + 26, -h + 30, pw * 1.7, 20, pw * 0.5);
  roofEnd(v, 0, -half * 0.36 - 34, half * 0.36 + 34, -h + 30, 52, pw * 2.9, seed + 7);
  D.out(c, p.part === "front" ? (z) => z < 0 : () => true);
}

/** The turn off side-on for a gate (its key's; a sliver of the far side showing west). */
function turnOf(p: GateP, key: number): number {
  return -(p.turn ?? 0.055 + 0.015 * hash1(7, key));
}

function pwOf(p: GateP): number {
  return Math.max(p.pw ?? 0, p.h * (p.kind === "paifang" ? 0.06 : 0.092), 22);
}

/**
 * Where a gate's near feet stand along the road, [dx from its centre, half width]: the pillar's
 * stones, a ryōbu's legs, a paifang's strut feet. The road's fence leaves these clear.
 */
export function gateFeet(p: GateP): [number, number][] {
  const pw = pwOf(p);
  if (p.kind === "paifang") {
    const braceD = p.h * 0.2;
    return [[0, pw * 1.3], [-braceD, pw * 0.6], [braceD, pw * 0.6]];
  }
  const T = toriiDims({ span: p.span, h: p.h, pw });
  const out: [number, number][] = [[0, pw * 1.35]];
  if (p.legs) out.push([-T.legD, T.legR * 2.4], [T.legD, T.legR * 2.4]);
  return out;
}

export const gate = definePainter<GateP>("op.gate", {
  bounds(p) {
    const pw = pwOf(p);
    if (p.kind === "paifang") {
      const reach = Math.max(pw * 2.9 + 0.06 * (p.span / 2 + 34) + 6, p.h * 0.2 + pw * 0.7);
      return [-reach - 4, -p.h - 52 - 52 * 0.16 * 2.8 - 6, reach + pw * 1.3 + 4, 8];
    }
    return toriiBounds({ span: p.span, h: p.h, pw, s: Math.max(0.07, Math.abs(p.turn ?? 0)), legs: p.legs, garland: p.garland });
  },
  paint(c, p) {
    const pw = pwOf(p);
    const key = Math.round(p.key ?? c.seed);
    const s = turnOf(p, key);
    if (p.kind === "paifang") {
      paifang(c, p, s, pw, key);
      return;
    }
    torii(c, 0, 0, { span: p.span, h: p.h, pw, s, seed: key, part: p.part, legs: p.legs, garland: p.garland });
  },
});

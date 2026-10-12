// Gate Road's vermilion gates, face-on so each frames her as she walks through: torii (myōjin
// style) and a paifang. Weathered lacquer, not flat red: a sunlit stripe down the left of every
// round pillar, shade on the right, dark streaks running down from under the lintels where rain
// drips, lacquer chipped to dark wood near the feet, a black lacquer sleeve at the foot of each
// pillar, a stone footing half sunk into the path with moss round it (the gate stands in the
// ground; it is not stuck on). Each gate carries one plaque, black with a gold rim and a glyph.
//
// part "front" paints only the footings and the ground they sit in (drawn in front of her).
// Anchor: the ground at the gate's centre. Sizes in level-1 px of the play plane.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, tone, vnoise, vnoise1 } from "../../raster.ts";

export interface GateP {
  kind?: "torii" | "paifang";
  /** Distance between the pillar centres, px. */
  span: number;
  /** Height of the top of the lintel above the ground, px. */
  h: number;
  /** Pillar width at the foot, px (default 18). */
  pw?: number;
  part?: "all" | "front";
}

type Ramp = readonly number[];

/** Fills a level-1 rectangle, calling col(x, y, u, v) for each pixel (u, v in 0..1). */
function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.max(Math.round(c.X(x0)) + 1, Math.round(c.X(x1)));
  const Y0 = Math.round(c.Y(y0)), Y1 = Math.max(Math.round(c.Y(y0)) + 1, Math.round(c.Y(y1)));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / (X1 - X0), (y - Y0 + 0.5) / (Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

/** Round lacquered timber: lit stripe left, shade right, a dark rim; t0 shifts the whole. */
function roundTone(u: number, t0: number): number {
  return t0 + (u < 0.16 ? -0.24 : u < 0.4 ? -0.06 : u < 0.72 ? 0.1 : u < 0.9 ? 0.26 : 0.46);
}

/**
 * A pillar from the ground (y 0) up to `top` (negative), centre cx, foot width w, tapering a
 * little, leaning in by `lean` px over its height. Vermilion above a black sleeve; streaks and
 * chips; a stone footing at its foot.
 */
function pillar(c: PaintCtx, cx: number, top: number, w: number, lean: number, seed: number, sleeveH: number): void {
  const d = c.d;
  const H = -top;
  const Y0 = Math.round(c.Y(top)), Y1 = Math.round(c.Y(0));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    const a = -c.ly(y + 0.5);
    const k = a / H;
    const half = (w / 2) * (1 - 0.1 * k);
    const mx = cx + lean * k;
    const X0 = Math.round(c.X(mx - half)), X1 = Math.max(X0 + 2, Math.round(c.X(mx + half)));
    const sleeve = a < sleeveH;
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const u = (x - X0 + 0.5) / (X1 - X0);
      const lx = c.lx(x + 0.5);
      let ramp: Ramp = sleeve ? P.lacquer : P.red;
      let t = roundTone(u, sleeve ? 0.42 : 0.4);
      if (sleeve && Math.abs(a - sleeveH) < 1.5 / d) t = 0.08;
      if (!sleeve) {
        // rain streaks down from the lintels, darker where water runs most
        const st = vnoise(lx / 1.6, a / 40, seed + 3);
        if (st > 0.7 && k > 0.35) t += 0.12 * (k - 0.35) / 0.65 + 0.05;
        // sun-faded lacquer: a paler patch on the lit side, high up
        if (u < 0.3 && vnoise(lx / 6, a / 18, seed + 4) > 0.66) t -= 0.08;
        // chips near the foot: dark wood showing through
        if (d >= 0.5 && a < sleeveH + 30 && hash(Math.floor(lx * 1.5), Math.floor(a / 2), seed + 5) < 0.025) { ramp = P.timber; t = 0.85; }
      }
      c.buf.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.3));
    }
  }
}

/** A stone footing (kamebara: a rounded drum) half sunk into the path, moss and grass round it. */
function footing(c: PaintCtx, cx: number, w: number, seed: number): void {
  const d = c.d;
  const hw = w * 0.85, hh = Math.max(7, w * 0.42);
  fill(c, cx - hw, -hh, cx + hw, 2, (x, y) => {
    const lx = c.lx(x + 0.5) - cx, ly = c.ly(y + 0.5);
    const u = lx / hw;
    // a rounded top: the drum's shoulder
    const top = -hh * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u), 3.2)));
    if (ly < top) return 0;
    let t = u < -0.45 ? 0.12 : u < 0.2 ? 0.35 : u < 0.7 ? 0.55 : 0.75;
    if (ly < top + 1.2 / d) t -= 0.12;
    // lichen and wet stains, a crack
    if (d >= 0.5 && vnoise(lx / 3, ly / 2, seed) > 0.72) t += 0.15;
    // moss creeping up from the ground, clumped
    const moss = ly > -hh * (0.15 + 0.5 * vnoise1(lx / 5, seed + 1));
    if (moss && vnoise1(lx / 4 + 3, seed + 2) > 0.35) return tone(P.moss, clamp(0.45 + u * 0.2 + (ly > 0 ? 0.2 : 0), 0, 1), x, y, 0.35);
    return tone(P.stone, clamp(t, 0, 1), x, y, 0.3);
  });
  // a few grass blades at the foot, both sides
  if (d >= 0.5) {
    for (let i = 0; i < 9; i++) {
      const gx = cx + (hash1(i, seed + 7) - 0.5) * w * 2.4;
      const gh = 2 + 6 * hash1(i, seed + 8);
      const lean = (hash1(i, seed + 9) - 0.5) * 0.6;
      for (let s = 0; s < gh; s += 1 / d) c.buf.set(Math.round(c.X(gx + lean * s)), Math.round(c.Y(1 - s)), P.moss[s < gh * 0.5 ? 4 : 2]!);
    }
  }
}

/** A horizontal lacquered beam from x0 to x1, top at y, thickness th; ends may sweep up. */
function beam(c: PaintCtx, x0: number, x1: number, y: number, th: number, ramp: Ramp, t0: number, sweep = 0, cut = 0): void {
  const d = c.d;
  const mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1));
  for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
    const lx = c.lx(x + 0.5);
    const k = Math.abs(lx - mid) / half;
    const lift = sweep * Math.pow(Math.max(0, k - 0.45) / 0.55, 2.2);
    // the ends are cut on a slant
    const endCut = cut * Math.max(0, (k - 0.97) / 0.03);
    const yt = y - lift, yb = y - lift + th - endCut;
    for (let yy = Math.max(Math.round(c.Y(yt)), c.buf.oy); yy < Math.min(Math.round(c.Y(yb)), c.buf.y1); yy++) {
      const v = (c.ly(yy + 0.5) - yt) / th;
      let t = t0 + (v < 0.18 ? -0.22 : v < 0.6 ? 0 : v < 0.85 ? 0.16 : 0.4);
      if (d >= 1 && vnoise(lx / 20, v * 3, 7) > 0.75) t += 0.06;
      c.buf.set(x, yy, tone(ramp, clamp(t, 0, 1), x, yy, 0.3));
    }
  }
}

/** The plaque: black lacquer, a gold rim, a gold glyph (a few strokes; the text comes from data). */
function plaque(c: PaintCtx, cx: number, y: number, w: number, h: number, seed: number): void {
  const d = c.d;
  fill(c, cx - w / 2, y, cx + w / 2, y + h, (x, yy, u, v) => {
    const ex = Math.min(u, 1 - u) * w, ey = Math.min(v, 1 - v) * h;
    if (ex < 0.9 / d || ey < 0.9 / d) return P.ink[0]!;
    if (ex < 2.6 || ey < 2.6) return tone(P.gold, u < 0.4 && v < 0.5 ? 0.15 : 0.5, x, yy, 0.3);
    // the glyph: three gold strokes in the plaque's middle third
    if (d >= 0.5) {
      const gx = (u - 0.5) * w, gy = (v - 0.5) * h;
      const s1 = Math.abs(gx) < 0.9 && Math.abs(gy) < h * 0.3;
      const s2 = Math.abs(gy + h * 0.12) < 0.8 && Math.abs(gx) < w * 0.22;
      const s3 = Math.abs(gy - gx * 0.6 - h * 0.12) < 0.8 && gx > 0 && gx < w * 0.22;
      if (s1 || s2 || s3) return P.gold[1]!;
    }
    return tone(P.lacquer, 0.6 + (v > 0.7 ? 0.2 : 0) + (hash(x, yy, seed) < 0.04 ? -0.2 : 0), x, yy, 0.3);
  });
}

/** A tiled roof seen from the side, eave line at y, x0..x1 at the eave, rising rh to a gold ridge. */
function roof(c: PaintCtx, x0: number, x1: number, y: number, rh: number, seed: number): void {
  const d = c.d;
  const cx = (x0 + x1) / 2, span = (x1 - x0) / 2;
  const steps = Math.max(2, Math.ceil(rh * d));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const ly = y - u * rh;
    const halfW = span * (1 - 0.3 * Math.pow(u, 0.8));
    const lift = u < 0.3 ? (1 - u / 0.3) * rh * 0.45 : 0;
    const Y = Math.round(c.Y(ly));
    if (Y < c.buf.oy || Y >= c.buf.y1) continue;
    const xa = Math.round(c.X(cx - halfW)), xb = Math.round(c.X(cx + halfW));
    for (let x = Math.max(xa, c.buf.ox); x < Math.min(xb, c.buf.x1); x++) {
      const k = Math.abs(c.lx(x + 0.5) - cx) / halfW;
      // only the turned-up corners rise past the plain eave at the ends
      if (k > 1 - (lift / rh) * 0.6 && u < 0.3 && k > 0.85 && (1 - k) * 8 < u * 3) continue;
      let col: number;
      if (u > 0.9) col = tone(P.gold, u > 0.96 ? 0.2 : 0.55, x, Y, 0.3);
      else if (i === 0) col = P.ink[0]!;
      else {
        // tile courses: vertical runs of round tiles, lit on the left
        const run = (c.lx(x + 0.5) - cx) / 3.2;
        const fr = run - Math.floor(run);
        let t = 0.3 + (1 - u) * 0.25 + (fr < 0.3 ? -0.15 : fr > 0.75 ? 0.2 : 0);
        if (d >= 0.5 && hash(Math.floor(run), Math.floor(ly / 2), seed) < 0.05) t += 0.2;
        col = tone(P.tile, clamp(t, 0, 1), x, Y, 0.3);
      }
      c.buf.set(x, Y, col);
    }
  }
  // the eave's dark underside and a row of bracket ends under it
  const Yb = Math.round(c.Y(y + 2.5));
  const xa = Math.round(c.X(x0 + span * 0.05)), xb = Math.round(c.X(x1 - span * 0.05));
  for (let x = Math.max(xa, c.buf.ox); x < Math.min(xb, c.buf.x1); x++) {
    for (let yy = Math.round(c.Y(y + 0.5)); yy < Yb + Math.round(3 * c.d); yy++) {
      const bracket = Math.floor(c.lx(x + 0.5) / 7) % 2 === 0;
      c.buf.set(x, yy, yy < Yb ? P.lacquer[3]! : bracket ? tone(P.gold, 0.6, x, yy, 0.3) : P.lacquer[4]!);
    }
  }
  void bayer4;
}

export const gate = definePainter<GateP>("op.gate", {
  bounds(p) {
    const pw = Math.max(p.pw ?? 0, p.h * 0.056, 20);
    const over = p.kind === "paifang" ? 80 : pw * 2.4 + 12;
    return [-p.span / 2 - over, -p.h - (p.kind === "paifang" ? 70 : 26), p.span / 2 + over, 8];
  },
  paint(c, p) {
    const pw = Math.max(p.pw ?? 0, p.h * 0.056, 20);
    const half = p.span / 2;
    const seed = c.seed;
    if (p.part === "front") {
      for (const sx of [-half, half]) footing(c, sx, pw, seed + Math.round(sx));
      return;
    }
    if (p.kind === "paifang") {
      // four stout posts (the middle pair taller), a heavy lower beam with a painted frieze, an
      // upper beam, the plaque between them, three tiled roofs on bracket rows, the middle highest
      const posts = [-half, -half * 0.36, half * 0.36, half];
      posts.forEach((sx, i) => {
        const tall = Math.abs(sx) < half;
        pillar(c, sx, -p.h + (tall ? 50 : 74), pw * (tall ? 1.1 : 0.95), 0, seed + i * 13, 18);
      });
      beam(c, -half - 16, half + 16, -p.h + 84, 16, P.red, 0.42, 0, 4);
      fill(c, -half * 0.36 + 3, -p.h + 87, half * 0.36 - 3, -p.h + 96, (x, y, u, v) => (v < 0.15 || v > 0.85 ? P.lacquer[3]! : Math.floor(u * 18) % 2 ? tone(P.gold, 0.4 + v * 0.3, x, y, 0.3) : P.lacquer[2]!));
      fill(c, -half - 12, -p.h + 90, -half * 0.36 - 4, -p.h + 97, (x, y, u) => (Math.floor(u * 8) % 2 ? tone(P.gold, 0.55, x, y, 0.3) : P.lacquer[3]!));
      fill(c, half * 0.36 + 4, -p.h + 90, half + 12, -p.h + 97, (x, y, u) => (Math.floor(u * 8) % 2 ? tone(P.gold, 0.55, x, y, 0.3) : P.lacquer[3]!));
      beam(c, -half * 0.36 - 10, half * 0.36 + 10, -p.h + 136, 12, P.red, 0.45, 0, 3);
      plaque(c, 0, -p.h + 100, Math.min(64, half * 0.62), 34, seed + 3);
      roof(c, -half - 30, -half * 0.36 + 16, -p.h + 66, 34, seed + 5);
      roof(c, half * 0.36 - 16, half + 30, -p.h + 66, 34, seed + 6);
      roof(c, -half * 0.36 - 34, half * 0.36 + 34, -p.h + 30, 46, seed + 7);
      return;
    }
    // torii: stout pillars leaning in a touch, the nuki through them, the strut with the plaque,
    // the shimaki and the black-capped kasagi on it, sweeping up and flaring at the ends
    const lean = Math.max(1.5, p.h * 0.006);
    const capT = Math.max(9, p.h * 0.026), shimT = Math.max(9, p.h * 0.026);
    pillar(c, -half, -p.h + capT + shimT, pw, lean, seed + 1, Math.max(14, p.h * 0.1));
    pillar(c, half, -p.h + capT + shimT, pw, -lean, seed + 2, Math.max(14, p.h * 0.1));
    const nukiY = -p.h + Math.max(54, p.h * 0.24);
    const nukiT = Math.max(9, pw * 0.5);
    beam(c, -half - pw * 1.2, half + pw * 1.2, nukiY, nukiT, P.red, 0.42, 0, 3);
    for (const sx of [-half, half]) fill(c, sx - pw * 0.5 - 3, nukiY + 1, sx - pw * 0.5, nukiY + nukiT - 1, () => P.lacquer[3]!);
    // the strut (gakuzuka) from the nuki up to the shimaki, the plaque hung on it
    fill(c, -pw * 0.28, -p.h + capT + shimT - 1, pw * 0.28, nukiY + 1, (x, y, u) => tone(P.red, roundTone(u, 0.45), x, y, 0.3));
    const ph = Math.max(22, (nukiY - (-p.h + capT + shimT)) * 0.82);
    plaque(c, 0, -p.h + capT + shimT + (nukiY - (-p.h + capT + shimT) - ph) * 0.5, Math.max(18, pw * 1.35), ph, seed + 3);
    beam(c, -half - pw * 1.55, half + pw * 1.55, -p.h + capT - 0.5, shimT, P.red, 0.38, capT * 0.6, 3);
    beam(c, -half - pw * 2.3, half + pw * 2.3, -p.h, capT, P.lacquer, 0.4, capT * 1.7, 6);
  },
});

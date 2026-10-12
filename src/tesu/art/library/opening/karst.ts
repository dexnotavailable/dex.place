// Karst for the background planes (P1 far, P2 middle far): Wuling and Liyue country. Not a
// row of columns with domes: clusters of landforms of different kinds, packed and overlapping,
// with wide gaps of mist between clusters.
//
// Every landform is a union of lobes: tall masses with rounded tops of different widths and
// heights. The main lobe carries the summit; lesser lobes make its shoulders and steps, so the
// skyline is asymmetric and stepped, never a clean dome.
// - pillar: one or two slim lobes, sheer and bulging (Zhangjiajie, Liyue's stone forest);
// - cone: a steep karst hill, many lobes stepping down both sides, mostly forested (Guilin);
// - massif: a broad block of near-equal lobes, a ragged top, sheer pale faces, the odd thread
//   fall (the karst cut by the frame's edge in reference 4).
//
// Lit on the left, shaded on the right, streaked; every form pales toward its foot and sinks
// into a mist bank, back rows paler and set higher. Painted at full value; the plane shader
// fades each plane toward the haze.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P, type Ramp } from "../../palette.ts";
import { bayer4, clamp, fbm1, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export type Landform = "pillar" | "cone" | "massif";

export interface KarstP {
  /** Band width, level-1 px; anchor at the left end of the front row's base line. */
  w: number;
  /** Tallest landform, px. */
  h: number;
  /** Rows (1 to 3); back rows are paler, smaller and set higher. */
  rows?: number;
  /** "far" (P1: few tones, blue-grey), "mid" (P2 back rows), "near" (P2 landmarks). */
  look?: "far" | "mid" | "near";
  /** Mist bank height at each row's foot, px (default h * 0.2). */
  mist?: number;
  /** Explicit front-row landforms [x centre, width, height, kind?] (a composer's placement). */
  forms?: [number, number, number, Landform?][];
  /** Mix of kinds for generated rows: [pillar, cone, massif] weights (default by look). */
  mix?: [number, number, number];
  /** Vegetation 0..1 (default 0.8). */
  green?: number;
  /** Thread falls on big faces, 0..1 (default 0.4 near). */
  falls?: number;
}

interface Lobe {
  /** Painted the ink-painting way (generated rows): tapering, fissured, a jagged summit. */
  ink?: boolean;
  /** Taper (share of the width lost by the top), bend (sideways at the top, px), summit depth. */
  taper?: number;
  bend?: number;
  capH?: number;
  /** Offset of its axis from the form's, half width, height above the base, top roundness. */
  dx: number;
  hw: number;
  h: number;
  round: number;
  seed: number;
}

interface Form {
  kind: Landform;
  cx: number;
  hw: number;
  h: number;
  /** Base y (local, negative up) and row. */
  by: number;
  row: number;
  lean: number;
  seed: number;
  fall: number;
  lobes: Lobe[];
}

function rowsOf(p: KarstP): number {
  return Math.max(1, Math.min(3, Math.round(p.rows ?? 1)));
}

function lobesOf(kind: Landform, hw: number, h: number, seed: number): Lobe[] {
  const r = rng(seed + 3);
  const out: Lobe[] = [];
  if (kind === "pillar") {
    out.push({ dx: 0, hw: hw * (0.8 + 0.2 * r()), h, round: 0.5 + 0.6 * r(), seed: seed + 1 });
    if (r() < 0.7) out.push({ dx: (r() < 0.5 ? -1 : 1) * hw * (0.4 + 0.4 * r()), hw: hw * (0.45 + 0.35 * r()), h: h * (0.45 + 0.35 * r()), round: 0.7 + 0.5 * r(), seed: seed + 2 });
  } else if (kind === "cone") {
    out.push({ dx: (r() - 0.5) * hw * 0.2, hw: hw * 0.36, h, round: 0.7 + 0.6 * r(), seed: seed + 1 });
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const k = (Math.floor(i / 2) + 1) / (n / 2 + 1);
      out.push({ dx: side * hw * (0.25 + 0.55 * k) * (0.8 + 0.4 * r()), hw: hw * (0.3 + 0.2 * r()), h: h * (1 - k * (0.45 + 0.3 * r())), round: 0.7 + 0.7 * r(), seed: seed + 3 + i });
    }
  } else {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      out.push({ dx: u * hw * 0.62 + (r() - 0.5) * hw * 0.15, hw: hw * (0.4 + 0.25 * r()), h: h * (i === Math.floor(n / 2) ? 1 : 0.72 + 0.25 * r()), round: 0.45 + 0.5 * r(), seed: seed + 5 + i });
    }
  }
  return out.sort((a, b) => b.h - a.h);
}

function formsOf(p: KarstP, seed: number): Form[] {
  return cached(`karst|${seed}|${p.w}|${p.h}|${p.rows}|${p.look}|${p.forms?.length}`, () => {
    const rows = rowsOf(p);
    const look = p.look ?? "mid";
    const mix = p.mix ?? (look === "far" ? [0.55, 0.35, 0.1] : look === "mid" ? [0.45, 0.35, 0.2] : [0.45, 0.2, 0.35]);
    const pick = (v: number): Landform => (v < mix[0] ? "pillar" : v < mix[0] + mix[1] ? "cone" : "massif");
    const out: Form[] = [];
    const add = (f: Omit<Form, "lobes">, ink = false): void => {
      const lobes = lobesOf(f.kind, f.hw, f.h, f.seed);
      if (ink) {
        // the ink-painting towers: tapering, bending, a jagged summit, a pair or more fused
        for (const L of lobes) {
          L.ink = true;
          L.taper = f.kind === "cone" ? 0.6 + 0.2 * hash1(1, L.seed) : 0.25 + 0.35 * hash1(1, L.seed);
          L.bend = (hash1(2, L.seed) - 0.5) * L.hw * 1.4;
          L.capH = L.h * (0.08 + 0.14 * hash1(3, L.seed));
          L.hw *= 1.1;
        }
      }
      out.push({ ...f, lobes });
    };
    for (let k = rows - 1; k >= 0; k--) {
      const r = rng(seed + k * 977 + 13);
      const by = -k * p.h * 0.18;
      const scale = 1 - 0.14 * k;
      if (k === 0 && p.forms) {
        p.forms.forEach(([x, w, hh, kind], i) => {
          const s = seed + i * 131 + 7;
          add({ kind: kind ?? pick(hash1(i, s)), cx: x, hw: w / 2, h: hh, by, row: 0, lean: (hash1(i + 5, s) - 0.5) * 0.12, seed: s, fall: hash1(i + 9, s) < (p.falls ?? 0.4) ? 1 : 0 });
        });
        continue;
      }
      // clusters: a dominant form with lesser ones packed round it, then a gap of mist
      let x = -p.h * 0.3 * r();
      let ci = 0;
      while (x < p.w + p.h * 0.2) {
        const big = p.h * scale * (0.5 + 0.5 * r());
        const kind = pick(r());
        const w0 = kind === "massif" ? big * (0.7 + 0.6 * r()) : kind === "cone" ? big * (0.6 + 0.4 * r()) : big * (0.2 + 0.18 * r());
        const s0 = seed + k * 7919 + ci * 131;
        add({ kind, cx: x + w0 / 2, hw: w0 / 2, h: big, by, row: k, lean: (r() - 0.5) * 0.16, seed: s0, fall: k === 0 && kind !== "cone" && r() < (p.falls ?? (look === "near" ? 0.4 : 0.15)) ? 1 : 0 }, true);
        const n = Math.floor(r() * 3);
        for (let j = 0; j < n; j++) {
          const kk = pick(r());
          const hh = big * (0.25 + 0.5 * r());
          const ww = kk === "pillar" ? hh * (0.22 + 0.25 * r()) : hh * (0.7 + 0.6 * r());
          const side = r() < 0.5 ? -1 : 1;
          add({ kind: kk, cx: x + w0 / 2 + side * (w0 * (0.25 + 0.35 * r()) + ww * 0.3), hw: ww / 2, h: hh, by, row: k, lean: (r() - 0.5) * 0.2, seed: s0 + j * 17 + 1, fall: 0 }, true);
        }
        x += w0 * (1.0 + 0.6 * r()) + (r() < 0.55 ? p.h * (0.6 + 1.4 * r()) : p.h * 0.15 * r());
        ci++;
      }
    }
    // back rows first; within a row the tall ones first, so lower forms stand in front
    return out.sort((a, b) => b.row - a.row || b.h - a.h);
  });
}

/** Half width of a lobe at height a, one side (-1 left, 1 right). */
function lobeHalf(L: Lobe, a: number, side: -1 | 1): number {
  if (a < 0 || a > L.h) return 0;
  if (L.ink) {
    // a tower: tapering as it rises, bulging and pinching, stepping in at ledges, each side its own
    const u = a / L.h;
    const s = L.seed + (side > 0 ? 11 : 0);
    let k = 1 - (L.taper ?? 0.4) * Math.pow(u, 1.2);
    k *= 0.78 + 0.4 * vnoise1(a / Math.max(8, L.hw * 2.2), s) + 0.1 * (vnoise1(a / 3.5, s + 3) - 0.5);
    const band = Math.floor(a / Math.max(6, L.h * 0.13));
    const bh = Math.max(6, L.h * 0.13);
    if (hash1(band * 2 + (side > 0 ? 1 : 0), s + 31) < 0.4 && a - band * bh > bh * 0.65) k *= 0.82;
    if (u < 0.12) k *= 1 + (0.12 - u) * 2.5;
    return L.hw * Math.max(0.12, k);
  }
  const cap = Math.min(L.h * 0.7, L.hw * L.round);
  const c0 = L.h - cap;
  let k = 1;
  if (a > c0) {
    const v = (a - c0) / cap;
    k = Math.sqrt(Math.max(0, 1 - v * v));
  }
  const s = L.seed + (side > 0 ? 11 : 0);
  // the sides wander in big bulges, waists and small ledges; the top is knobbed, not a dome
  k *= 0.8 + 0.34 * vnoise1(a / Math.max(10, L.hw * 2), s) + 0.08 * (vnoise1(a / 4.5, s + 3) - 0.5);
  if (a > c0) k *= 0.85 + 0.3 * vnoise1(a / Math.max(3, cap * 0.3), s + 5);
  if (a < L.h * 0.08) k *= 1 + ((L.h * 0.08 - a) / L.h) * 2;
  return L.hw * k;
}

/** An ink lobe's summit line at offset x: knobs, a spire or a flat crown, notched by fissures. */
function inkTop(L: Lobe, x: number): number {
  const wt = L.hw * (1 - (L.taper ?? 0.4)) * 1.15;
  const k = Math.abs(x) / Math.max(1, wt);
  if (k > 1.15) return -1;
  const e = 0.35 + 0.75 * hash1(1, L.seed + 70);
  let p = Math.pow(Math.max(0, 1 - Math.min(1, k)), e) * (0.7 + 0.3 * vnoise1(x / Math.max(2, wt * 0.35), L.seed + 71)) + 0.12 * (vnoise1(x / Math.max(1.5, wt * 0.12), L.seed + 72) - 0.5);
  // a notch where a fissure reaches the top
  const fx = (hash1(2, L.seed + 73) - 0.5) * wt * 1.2;
  const nw = Math.max(1.5, wt * 0.12);
  if (hash1(3, L.seed + 73) < 0.6) p -= 0.35 * Math.max(0, 1 - Math.abs(x - fx) / nw);
  return L.h - (L.capH ?? L.h * 0.2) * (1 - clamp(p, 0, 1));
}

/** The lobe's outline height above its axis offset x (for the cap and the crowns). */
function lobeTopAt(L: Lobe, x: number): number {
  if (L.ink) return inkTop(L, x);
  const k = Math.abs(x / L.hw);
  if (k > 1) return -1;
  const cap = Math.min(L.h * 0.7, L.hw * L.round);
  return L.h - cap * (1 - Math.sqrt(Math.max(0, 1 - k * k)));
}

function axis(f: Form, L: Lobe, a: number): number {
  const bend = L.ink ? (L.bend ?? 0) * Math.pow(a / L.h, 2) : 0;
  return f.cx + L.dx + f.lean * a + bend + (vnoise1(a / 70, L.seed + 9) - 0.5) * L.hw * 0.16;
}

interface Look {
  rock: Ramp;
  veg: Ramp;
  dark: Ramp;
  lit: number;
  shade: number;
  vegT: number;
  detail: number;
  /** How much each form pales toward its foot (atmosphere inside the plane). */
  foot: number;
}

function lookOf(p: KarstP, row: number): Look {
  const look = p.look ?? "mid";
  if (look === "far" || (row > 0 && look === "mid")) {
    const r = look === "far" ? row : row + 1;
    return { rock: P.range, veg: P.range, dark: P.range, lit: 0.2 + r * 0.06, shade: 0.52 - r * 0.07, vegT: 0.66 - r * 0.1, detail: look === "far" ? 0 : 1, foot: 0.6 };
  }
  if (row > 0) return { rock: P.karst, veg: P.pine, dark: P.pine, lit: 0.18, shade: 0.5, vegT: 0.15, detail: 1, foot: 0.4 };
  return { rock: P.karst, veg: P.moss, dark: P.pine, lit: 0.1, shade: 0.5, vegT: 0.4, detail: 2, foot: 0.3 };
}

/** One crown of trees on a summit (a small cauliflower clump), lit on its upper left. */
function crown(c: PaintCtx, cx: number, cy: number, r: number, K: Look, seed: number, footK: number): void {
  const b = c.buf, d = c.d;
  const X0 = Math.floor(c.X(cx - r * 1.3)), X1 = Math.ceil(c.X(cx + r * 1.3)), Y0 = Math.floor(c.Y(cy - r * 1.2)), Y1 = Math.ceil(c.Y(cy + r * 0.6));
  if (!b.touches(X0, Y0, X1, Y1)) return;
  for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const dx = c.lx(x + 0.5) - cx, dy = c.ly(y + 0.5) - cy;
      if (dy > r * 0.5) continue;
      const ang = Math.atan2(dy, dx);
      const rim = r * (0.8 + 0.28 * vnoise1(ang * 2.2 + 10, seed) + (d >= 0.5 ? 0.12 * vnoise1(ang * 7 + 3, seed + 1) : 0));
      const q = Math.hypot(dx, dy) / rim;
      if (q > 1) continue;
      const lit = (-0.62 * dx - 0.78 * dy) / Math.max(1e-3, rim);
      let t = (K.vegT + 0.08 - lit * 0.3 + q * 0.12) * (1 - footK);
      let ramp = K.veg;
      if (t > 0.62 && K.dark !== K.veg) { ramp = K.dark; t = 0.25 + (t - 0.62) * 1.5; }
      b.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.4));
    }
  }
}

/** How far the forest hangs below its cap line at x: rounded tongues of foliage, never spikes. */
function drape(lx: number, scale: number, seed: number): number {
  const w = Math.max(3, scale);
  const cell = Math.floor(lx / w);
  const f = lx / w - cell;
  const len = hash1(cell, seed) * hash1(cell, seed + 1);
  return scale * 1.6 * len * Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
}

/** Paints one lobe of a form: its rock, its forest cap and its crowns. */
function paintLobe(c: PaintCtx, f: Form, L: Lobe, K: Look, green: number, first: boolean): void {
  const b = c.buf, d = c.d;
  const span = L.hw * 1.4 + Math.abs(f.lean) * L.h + 6;
  const top = f.by - L.h;
  if (!b.touches(Math.floor(c.X(f.cx + L.dx - span - 12)), Math.floor(c.Y(top - 14)), Math.ceil(c.X(f.cx + L.dx + span + 12)), Math.ceil(c.Y(f.by)))) return;
  const capD = green * (f.kind === "cone" ? L.h * 0.5 : Math.min(L.h * 0.3, L.hw * 1.1));
  const fallX = f.cx + L.dx - L.hw * (0.2 + 0.45 * hash1(2, L.seed));
  const yTop = Math.floor(c.Y(top)) - 1, yBase = Math.ceil(c.Y(f.by));
  for (let y = Math.max(yTop, b.oy); y < Math.min(yBase, b.y1); y++) {
    const a = f.by - c.ly(y + 0.5);
    if (a < 0 || a > L.h) continue;
    const m = axis(f, L, a), hl = lobeHalf(L, a, -1), hr = lobeHalf(L, a, 1);
    if (hl + hr <= 0.3 / d) continue;
    const xL = Math.ceil(c.X(m - hl) - 0.5), xR = Math.floor(c.X(m + hr) - 0.5);
    const ridge = L.ink ? 0.25 + (vnoise1(a / 60, L.seed + 21) - 0.5) * 0.3 : (vnoise1(a / 40, L.seed + 21) - 0.5) * 0.45 + 0.1;
    const footK = clamp(1 - a / (f.h * 0.5), 0, 1) * K.foot;
    for (let x = Math.max(xL, b.ox); x <= Math.min(xR, b.x1 - 1); x++) {
      const lx = c.lx(x + 0.5);
      const u = lx < m ? (lx - m) / Math.max(1e-3, hl) : (lx - m) / Math.max(1e-3, hr);
      const below = lobeTopAt(L, lx - m) - a;
      if (L.ink && below < 0) continue;
      const edgeR = x === xR, edgeL = x === xL;
      if (green > 0 && below < capD * (0.6 + 0.4 * vnoise1(lx / 22, L.seed + 43)) + drape(lx, Math.max(3, L.hw * 0.14), L.seed + 44)) {
        let t = K.vegT + 0.2 * (below / Math.max(1, capD)) + (u > ridge ? 0.18 : -0.05);
        if (K.detail > 0 && d >= 0.25) t += (vnoise(lx / 3, a / 2.6, L.seed + 45) - 0.5) * 0.3;
        if (edgeR) t += 0.15;
        t *= 1 - footK;
        let ramp = K.veg;
        if (t > 0.62 && K.dark !== K.veg) { ramp = K.dark; t = 0.25 + (t - 0.62) * 1.5; }
        b.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.4));
        continue;
      }
      let t = u < ridge ? K.lit + 0.1 * clamp((u + 1) / (ridge + 1), 0, 1) : K.shade + 0.1 * clamp((u - ridge) / (1 - ridge), 0, 1);
      if (L.ink && d >= 0.25) {
        // fissures: wandering dark lines down from the summit, and the ledges' shadows
        for (let q = 0; q < 3; q++) {
          if (hash1(q, L.seed + 80) > 0.75) continue;
          const fu = (hash1(q, L.seed + 81) - 0.5) * 1.3 + (vnoise1(a / 25 + q * 4, L.seed + 82) - 0.5) * 0.25;
          const len = L.h * (0.25 + 0.6 * hash1(q, L.seed + 83));
          if (L.h - a < len && Math.abs(u - fu) * (u < 0 ? hl : hr) < 0.6 / d) t += 0.22;
        }
        const bh = Math.max(6, L.h * 0.13);
        if (((a % bh) + bh) % bh < 1.2 / d && vnoise1(lx / 9, L.seed + 84) > 0.45) t += 0.15;
      }
      if (edgeR) t += 0.14;
      else if (edgeL && !first) t -= 0.08;
      if (K.detail >= 1 && d >= 0.25) {
        if (vnoise(lx / 1.8, a / 34, L.seed + 3) > 0.72) t += 0.09;
        if (below < capD * 1.6 + 16 && vnoise(lx / 2.2, a / 14, L.seed + 5) > 0.7) t += 0.12;
        if (green > 0 && vnoise(lx / 14, a / 3.5, L.seed + 11) > 1.06 - 0.12 * green && vnoise(lx / 40, a / 40, L.seed + 12) > 0.55) {
          b.set(x, y, tone(K.veg, clamp((K.vegT + 0.2 + (u > ridge ? 0.15 : 0)) * (1 - footK), 0, 1), x, y, 0.4));
          continue;
        }
      }
      if (K.detail >= 2 && d >= 0.5 && Math.abs(Math.sin((a + 8 * vnoise1(lx / 30, L.seed + 7)) / 13)) < 0.05) t += 0.06;
      // paler toward the foot: the form rises out of the mist
      t *= 1 - footK;
      b.set(x, y, tone(K.rock, clamp(t, 0, 1), x, y, 0.45));
    }
    if (f.fall && first && d >= 0.25 && a < L.h * 0.82) {
      const sway = Math.sin(a / 23 + f.seed) * Math.min(1.4, (L.h - a) / 60);
      const half = Math.max(0.6 / d, L.hw * 0.035 + (L.h - a) * 0.004);
      const fx = fallX + f.lean * a + sway;
      const X0 = Math.round(c.X(fx - half)), X1 = Math.round(c.X(fx + half));
      for (let x = Math.max(X0, b.ox); x <= Math.min(X1, b.x1 - 1); x++) {
        if ((x === X0 || x === X1) && bayer4(x, y) < 0.5) continue;
        b.set(x, y, x === X1 ? P.cloud[2]! : P.cloud[(Math.floor(c.ly(y) / 3) + x) % 5 === 0 ? 1 : 0]!);
      }
    }
  }
  // crowns along the lobe's top: the skyline is lumpy forest, never a clean dome
  if (green > 0 && L.h > f.h * 0.3 && (!L.ink || hash1(5, L.seed) < 0.75)) {
    const step = Math.max(2.5, Math.min(8, L.hw * (K.detail > 0 ? 0.22 : 0.3))) * (L.ink ? 0.8 : 1);
    const r = rng(L.seed + 501);
    for (let ox = -L.hw * 1.05; ox < L.hw * 1.05; ox += step * (0.55 + 0.6 * r())) {
      const at = lobeTopAt(L, ox);
      if (at < 0 || (at < L.h * 0.45 && f.kind !== "cone")) continue;
      if (L.ink && (at < L.h - (L.capH ?? 0) * 0.9 || r() < 0.2)) continue;
      const rr = step * (0.55 + 0.6 * r()) * Math.min(1, green + 0.2) * (L.ink ? 0.7 : 1);
      const footK = clamp(1 - at / (f.h * 0.5), 0, 1) * K.foot;
      crown(c, axis(f, L, at) + ox, f.by - at + rr * 0.3, rr, K, L.seed + Math.round(ox * 7), footK);
    }
  }
}

/**
 * The mist bank along a row's foot: long low swells of stratus lying on the water, lit along
 * their tops, and above them a three-step dissolve (50%, 25%, 1 in 8) over whatever stands in it.
 */
export function mistBank(c: PaintCtx, x0: number, x1: number, by: number, mh: number, seed: number, lighten = 0): void {
  if (mh <= 0) return;
  const b = c.buf, d = c.d;
  const band = Math.max(3 / d, mh * 0.6);
  const Xa = Math.max(b.ox, Math.floor(c.X(x0))), Xb = Math.min(b.x1, Math.ceil(c.X(x1)));
  const Yt = Math.floor(c.Y(by - mh * 1.4 - band)), Yb = Math.ceil(c.Y(by + 2));
  if (!b.touches(Xa, Yt, Xb, Yb)) return;
  const C = P.cloud;
  const li = (i: number): number => C[Math.max(0, Math.min(4, i + lighten))]!;
  for (let x = Xa; x < Xb; x++) {
    const lx = c.lx(x + 0.5);
    const ends = Math.pow(clamp(Math.min(lx - x0, x1 - lx) / (mh * 4), 0, 1), 0.7);
    const tp = mh * (0.25 + 0.75 * fbm1(lx / (mh * 6), seed + 1, 3) + 0.25 * vnoise1(lx / (mh * 1.7), seed + 2)) * ends;
    const slope = vnoise1(lx / (mh * 1.7) + 0.08, seed + 2) - vnoise1(lx / (mh * 1.7) - 0.08, seed + 2);
    for (let y = Math.max(Yt, b.oy); y < Math.min(Yb, b.y1); y++) {
      const a = by - c.ly(y + 0.5);
      if (a > tp + band) continue;
      if (a > tp) {
        const k = (a - tp) / band;
        const th = k < 0.34 ? 0.5 : k < 0.67 ? 0.25 : 0.12;
        if (bayer4(x, y) >= th) continue;
        b.set(x, y, li(1));
        continue;
      }
      const under = tp - a;
      // a lit top line where a swell faces the sun, a soft body
      b.set(x, y, li(under < 1.5 / d && slope > 0 ? 0 : 1));
    }
  }
}

export const karst = definePainter<KarstP>("op.karst", {
  bounds(p) {
    const rows = rowsOf(p);
    let x0 = -p.h * 0.8, x1 = p.w + p.h * 0.8, top = -p.h - (rows - 1) * p.h * 0.18;
    for (const [x, w, hh] of p.forms ?? []) {
      x0 = Math.min(x0, x - w * 1.3);
      x1 = Math.max(x1, x + w * 1.3);
      top = Math.min(top, -hh);
    }
    return [x0 - 20, top - 30, x1 + 20, 4];
  },
  paint(c, p) {
    const forms = formsOf(p, c.seed);
    const rows = rowsOf(p);
    const mh = p.mist ?? p.h * 0.2;
    let x0 = -p.h * 0.6, x1 = p.w + p.h * 0.6;
    for (const [x, w] of p.forms ?? []) { x0 = Math.min(x0, x - w * 1.2); x1 = Math.max(x1, x + w * 1.2); }
    for (let k = rows - 1; k >= 0; k--) {
      const K = lookOf(p, k);
      for (const f of forms) if (f.row === k) f.lobes.forEach((L, i) => paintLobe(c, f, L, K, p.green ?? 0.8, i === 0));
      mistBank(c, x0, x1, -k * p.h * 0.18, mh * (1 - 0.12 * k), c.seed + k * 31, k > 0 ? 1 : 0);
    }
  },
});

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
import { bayer4, clamp, fbm, fbm1, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
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
  /**
   * Where the generated rows may stand: [x0, x1] spans of the band (a composer's clusters, with
   * wide gaps of mist between them). Default: anywhere along the band.
   */
  groups?: [number, number][];
  /** How far the back row is erased into the haze, 0..1 (default 0): ghosts, then nothing. */
  haze?: number;
  /** Falls on the near look are veils this many times their old width (default 1: a thread). */
  veil?: number;
  /** Which of `forms` carry a fall (indexes; default: chosen by `falls`). */
  fallOn?: number[];
  /**
   * Where its foot lies on the lake, [x0, x1] of the band (the lake's extent at this plane's
   * waterline): there the mist's foot takes the water's tone. Default: nowhere.
   */
  wet?: [number, number];
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
    // a massif: lobes of very different widths and heights, packed unevenly, so its skyline
    // steps and leans instead of repeating one arch (the summit lobe stands left of centre, toward
    // the light; the others fall away in a long right shoulder and a short steep left one)
    const n = 3 + Math.floor(r() * 2);
    const top = Math.floor(n * 0.35);
    let u = -1 + 0.15 * r();
    for (let i = 0; i < n; i++) {
      const wk = i === top ? 0.5 + 0.15 * r() : 0.22 + 0.36 * r();
      const hk = i === top ? 1 : i < top ? 0.55 + 0.3 * r() : Math.max(0.42, 0.95 - 0.16 * (i - top) - 0.2 * r());
      out.push({ dx: u * hw * 0.7, hw: hw * wk, h: h * hk, round: 0.25 + 0.45 * r(), seed: seed + 5 + i });
      u += (2.1 / n) * (0.6 + 0.8 * r());
    }
  }
  return out.sort((a, b) => b.h - a.h);
}

function formsOf(p: KarstP, seed: number): Form[] {
  return cached(`karst|${seed}|${p.w}|${p.h}|${p.rows}|${p.look}|${p.forms?.map((f) => f.join(',')).join(';')}|${p.groups?.join(';')}|${p.fallOn?.join(',')}|${p.falls}`, () => {
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
          const kd = kind ?? pick(hash1(i, s));
          // (pillars the ink-painting way too: tapering, bending, a jagged summit; massifs and
          // cones keep their broad forested forms)
          add({ kind: kd, cx: x, hw: w / 2, h: hh, by, row: 0, lean: (hash1(i + 5, s) - 0.5) * (kd === "pillar" ? 0.2 : 0.12), seed: s, fall: (p.fallOn ? p.fallOn.includes(i) : hash1(i + 9, s) < (p.falls ?? 0.4)) ? 1 : 0 }, kd === "pillar");
        });
        continue;
      }
      // clusters: a dominant form with lesser ones packed round it, then a gap of mist
      let x = -p.h * 0.3 * r();
      let ci = 0;
      while (x < p.w + p.h * 0.2) {
        // a composer's clusters: nothing stands in the gaps between them but mist
        if (p.groups) {
          const g = p.groups.find(([, b]) => x < b - p.h * 0.1);
          if (!g) break;
          if (x < g[0]) x = g[0] + p.h * 0.25 * r();
        }
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

/**
 * How deep the forest reaches below a lobe's outline at lx. Ink towers keep the old even cap.
 * Broad lobes (massifs, cones): thick over the summit, draping far down the lit (left) shoulder
 * in tongues of very different lengths, thin and torn on the shaded side.
 */
function capAt(L: Lobe, lx: number, u: number, capD: number): number {
  const tongue = drape(lx, Math.max(3, L.hw * 0.14), L.seed + 44);
  if (L.ink) return capD * (0.6 + 0.4 * vnoise1(lx / 22, L.seed + 43)) + tongue;
  const lit = Math.pow(clamp((0.3 - u) / 1.25, 0, 1), 1.3);
  const wander = 0.45 + 0.8 * fbm1(lx / Math.max(6, L.hw * 0.45), L.seed + 43, 3);
  const shade = u > 0.35 ? 0.45 + 0.55 * vnoise1(lx / 6, L.seed + 47) : 1;
  return capD * (0.35 + 1.5 * lit) * wander * shade + tongue * (0.5 + 2.2 * lit);
}

/** Paints one lobe of a form: its rock, its forest cap and its crowns. */
function paintLobe(c: PaintCtx, f: Form, L: Lobe, K: Look, green: number, first: boolean, veil = 1): void {
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
      if (green > 0 && below < capAt(L, lx, u, capD) && (L.ink || below < capD * 0.3 || vnoise(lx / 4.5, a / 3.6, L.seed + 46) < 0.8 - 0.1 * clamp(u, 0, 1))) {
        let t = K.vegT + 0.2 * (below / Math.max(1, capD)) + (u > ridge ? 0.18 : -0.05);
        if (K.detail > 0 && d >= 0.25) t += L.ink ? (vnoise(lx / 3, a / 2.6, L.seed + 45) - 0.5) * 0.3 : (vnoise(lx / 7, a / 5.5, L.seed + 45) - 0.5) * 0.34 + (vnoise(lx / 2.5, a / 2.2, L.seed + 48) - 0.5) * 0.1;
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
    if (f.fall && first && d >= 0.25 && a < L.h * 0.82 && veil <= 1) {
      {
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
  }
  if (green > 0 && !L.ink && L.h > f.h * 0.3) {
    broadCrowns(c, f, L, K, green, capD);
    return;
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
 * The forest crowning a broad lobe: crowns of very different sizes (a few great ones, more
 * middling, many small) along its top so the skyline is lumpy, never an arch of even beads;
 * more of them stepping down the lit shoulder, smaller as they go, then breaking into single
 * trees on the face below the cap.
 */
function broadCrowns(c: PaintCtx, f: Form, L: Lobe, K: Look, green: number, capD: number): void {
  const r = rng(L.seed + 501);
  const g = Math.min(1, green + 0.2);
  const size = (): number => {
    const v = r();
    return Math.max(2, (v < 0.16 ? L.hw * (0.17 + 0.1 * r()) : v < 0.55 ? L.hw * (0.07 + 0.06 * r()) : L.hw * (0.025 + 0.035 * r())) * g);
  };
  // along the top, from the lit shoulder across the summit; sparse and small on the shaded side
  let ox = -L.hw * (0.95 + 0.15 * r());
  while (ox < L.hw * 0.98) {
    const rr = size() * (ox > L.hw * 0.4 ? 0.6 : 1);
    const at = lobeTopAt(L, ox);
    if (at >= L.h * (f.kind === "cone" ? 0.2 : 0.4) && !(ox > L.hw * 0.4 && r() < 0.35)) {
      const footK = clamp(1 - at / (f.h * 0.5), 0, 1) * K.foot;
      crown(c, axis(f, L, at) + ox, f.by - at + rr * (0.25 + 0.3 * r()), rr, K, L.seed + Math.round(ox * 7), footK);
    }
    ox += rr * (0.55 + 1.1 * r());
  }
  // down the lit shoulder: the forest spills over the edge in clumps, smaller as they go
  const c0 = L.h - Math.min(L.h * 0.7, L.hw * L.round);
  const n = 3 + Math.floor(r() * 5);
  let a = c0 + (L.h - c0) * 0.2;
  for (let i = 0; i < n && a > L.h * 0.25; i++) {
    const rr = Math.max(1.6, size() * (1 - i / (n + 2)) * 0.8);
    const m = axis(f, L, a), hl = lobeHalf(L, a, -1);
    const footK = clamp(1 - a / (f.h * 0.5), 0, 1) * K.foot;
    crown(c, m - hl + rr * (0.1 + 0.5 * r()), f.by - a, rr, K, L.seed + 900 + i, footK);
    a -= rr * (0.9 + 1.4 * r()) + capD * 0.15 * r();
  }
  // single trees on the ledges below, where the face catches the light
  if (c.d >= 0.5) {
    const m = 1 + Math.floor(r() * 4);
    for (let i = 0; i < m; i++) {
      const aa = L.h * (0.3 + 0.45 * r());
      const mm = axis(f, L, aa), hl = lobeHalf(L, aa, -1), hr = lobeHalf(L, aa, 1);
      const xx = mm - hl + (hl + hr) * (0.05 + 0.5 * r() * r());
      if (aa > lobeTopAt(L, xx - mm) - capAt(L, xx, (xx - mm) / Math.max(1, hl), capD) * 1.1) continue;
      const footK = clamp(1 - aa / (f.h * 0.5), 0, 1) * K.foot;
      crown(c, xx, f.by - aa, 1.6 + 1.6 * r(), K, L.seed + 950 + i, footK);
    }
  }
}

/**
 * A fall as a veil: broad, of its own width, a few strands of foam and cooler water following
 * the face, broken where it strikes a ledge (a bright splash, then a short step out), widening
 * as it falls, and blooming into dithered spray where it reaches the mist at the foot.
 */
function paintVeil(c: PaintCtx, f: Form, L: Lobe, y: number, a: number, fallX: number, veil: number): void {
  const b = c.buf, d = c.d;
  const a0 = L.h * 0.82;
  const drop = (a0 - a) / a0;
  // ledges: every so often the veil strikes one and steps out a little
  const bh = Math.max(10, L.h * 0.14);
  const li = Math.floor(a / bh);
  const inLedge = hash1(li, f.seed + 61) < 0.55 && ((a % bh) + bh) % bh < 2.2 / d;
  let shift = 0;
  for (let k = Math.floor(a0 / bh); k > li; k--) if (hash1(k, f.seed + 61) < 0.55) shift += (hash1(k, f.seed + 62) - 0.35) * L.hw * 0.05;
  const sway = Math.sin(a / 29 + f.seed) * Math.min(1.6, (L.h - a) / 50);
  const cx = fallX + f.lean * a + sway + shift;
  let half = Math.max(0.8 / d, (L.hw * 0.035 + (L.h - a) * 0.004) * veil) * (0.85 + 0.3 * vnoise1(a / 30, f.seed + 63)) * (1 + 0.5 * drop);
  // it leaves the lip narrow and curls over it: no flat top
  const lipK = clamp((a0 - a) / Math.max(4, L.h * 0.07), 0, 1);
  half *= 0.3 + 0.7 * Math.sqrt(lipK);

  if (inLedge) half *= 1.35;
  // the spray bloom at the foot, where the veil meets the mist
  const bloomH = Math.max(12, L.h * 0.16);
  const bloom = clamp(1 - a / bloomH, 0, 1);
  half *= 1 + 2.4 * bloom * bloom;
  const C = P.cloud;
  const X0 = Math.floor(c.X(cx - half)), X1 = Math.ceil(c.X(cx + half));
  for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
    const lx = c.lx(x + 0.5);
    const u = (lx - cx) / half;
    if (u < -1 || u > 1) continue;
    // ragged sides and spray: the edges dither out, more so lower down and in the bloom
    const edge = 1 - Math.abs(u);
    const keepA = clamp(edge * (2.4 - 1.2 * bloom) + 0.15 * (vnoise(lx / 2, a / 5, f.seed + 64) - 0.5), 0, 1);
    if (bayer4(x, y) >= (bloom > 0 ? keepA * (1 - 0.55 * bloom) : keepA > 0.55 ? 1 : keepA) * (0.3 + 0.7 * lipK)) continue;
    if (inLedge) { b.set(x, y, Math.abs(u) < 0.8 ? P.paper[0]! : C[1]!); continue; }
    // strands: a few brighter ribbons of foam over a cooler body; the shaded right edge cooler
    const strand = vnoise1(u * 2.6 + a / 90, f.seed + 65) + 0.25 * (vnoise(lx / 1.5, a / 7, f.seed + 66) - 0.5);
    let i = strand > 0.62 ? 0 : strand > 0.4 ? 1 : 2;
    if (u > 0.55) i = Math.min(4, i + 1);
    if (bloom > 0.4) i = Math.max(0, i - 1);
    b.set(x, y, C[i]!);
  }
}

/** A landform's foot standing in a mist bank: centre, half width and height (px of the band). */
export interface MistFoot { x: number; hw: number; h: number }

/** The three dissolve steps of the art bible (50%, 25%, 1 in 8) for a coverage 0..1. */
const step3 = (cov: number): number => (cov > 0.62 ? 0.5 : cov > 0.38 ? 0.25 : cov > 0.17 ? 0.125 : 0);

/**
 * The bank at lx: its solid core's top and the billowing zone above it (px above the base,
 * positive up), how near a foot it is (0..1), and how far it has lifted off the water there.
 */
function bankAt(lx: number, x0: number, x1: number, mh: number, seed: number, feet: readonly MistFoot[], taper = mh * 4): [number, number, number, number] {
  const s1 = fbm1(lx / (mh * 11), seed + 1, 3), s2 = vnoise1(lx / (mh * 2.6), seed + 2), s3 = vnoise1(lx / (mh * 0.8), seed + 3);
  let near = feet.length ? 0 : 0.6, up = 0;
  for (const f of feet) {
    const u = (lx - f.x) / (f.hw * 1.4 + mh * 1.2);
    if (u <= -1 || u >= 1) continue;
    const bell = (1 - u * u) ** 2;
    near = Math.max(near, bell);
    up = Math.max(up, bell * Math.min(f.h * 0.3, mh * 2.4) * (0.5 + 0.8 * hash1(Math.round(f.x * 3), seed + 5)));
  }
  const ends = Math.pow(clamp(Math.min(lx - x0, x1 - lx) / taper, 0, 1), 0.7);
  // the core lies low and sags in the gaps; the billows above it climb the feet
  const core = Math.max(0, mh * (0.05 + 0.5 * s1 * s1 + 0.3 * (s2 - 0.5) + 0.12 * (s3 - 0.5)) * (0.3 + 0.7 * near) + up * 0.15) * ends;
  const zone = (mh * (0.7 + 1.2 * vnoise1(lx / (mh * 3.3), seed + 6)) * (0.45 + 0.55 * near) + up) * ends;
  // in the gaps it lifts off the water a little, unevenly (the lake runs on under it)
  const lift = mh * (0.1 + 0.55 * vnoise1(lx / (mh * 2.1), seed + 8) + 0.45 * vnoise1(lx / (mh * 0.55), seed + 24)) * Math.max(0, 0.75 - near) / 0.75;
  return [core, zone, near, lift];
}

/**
 * The mist lying at a row's foot. A low solid core whose top wanders at three scales, and above
 * it billows: a density falling with height, broken by 2D noise, thresholded into solid lumps
 * low down and the three dissolve steps (50%, 25%, 1 in 8) higher up, so its top is lumpy at
 * every scale and never a line. It climbs the feet of the landforms standing in it and sags in
 * the gaps between them; torn wisps float free above. The body reaches down to `floor` (the
 * row's own base by default). Where it lies on water (`thin`), in the gaps it lifts off the
 * water a little and frays at its underside too, so the lake runs on under it.
 */
export function mistBank(c: PaintCtx, x0: number, x1: number, by: number, mh: number, seed: number, lighten = 0, feet: readonly MistFoot[] = [], o: { floor?: number; thin?: number; taper?: number; torn?: number; water?: number; minCore?: number; far?: boolean; wetX?: readonly [number, number] } = {}): void {
  if (mh <= 0) return;
  const b = c.buf, d = c.d;
  const floor = o.floor ?? by;
  const thin = o.thin ?? 0;
  const wet = o.water ?? 0;
  const hi = mh * 4.6;
  const Xa = Math.max(b.ox, Math.floor(c.X(x0))), Xb = Math.min(b.x1, Math.ceil(c.X(x1)));
  const Yt = Math.floor(c.Y(by - hi)), Yb = Math.ceil(c.Y(Math.max(by, floor) + 2));
  if (!b.touches(Xa, Yt, Xb, Yb)) return;
  const C = P.cloud;
  const li = (i: number): number => C[Math.max(0, Math.min(4, i + lighten))]!;
  const cw = mh * 4.5;
  for (let x = Xa; x < Xb; x++) {
    const lx = c.lx(x + 0.5);
    const [core0, zone, near, lift] = bankAt(lx, x0, x1, mh, seed, feet, o.taper);
    // (a floor it never sags below: on the far plane it always covers where the lake begins)
    const core = Math.max(core0, (o.minCore ?? 0) * (0.8 + 0.4 * vnoise1(lx / (mh * 1.9), seed + 23)) * Math.pow(clamp(Math.min(lx - x0, x1 - lx) / (o.taper ?? mh * 4), 0, 1), 0.7));
    // the foot where it lies on the lake: it takes the water's own tone, so the far edge of the
    // lake dissolves up into the mist instead of stopping at a line (its top wanders)
    // (only where it lies on the lake: the band thins out over a ragged stretch at the shores)
    const onLake = o.wetX ? clamp(Math.min(lx - o.wetX[0], o.wetX[1] - lx) / (mh * 2.5) + (vnoise1(lx / (mh * 0.9), seed + 26) - 0.5) * 0.8, 0, 1) : 1;
    const wetH = wet * onLake * (0.55 + 0.9 * fbm1(lx / (mh * 1.3), seed + 21, 3));
    // torn wisps above the bank (by cell along x)
    const W: [number, number, number, number, number][] = [];
    const j0 = Math.floor(lx / cw);
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      if (hash1(j, seed + 11) > (o.torn ?? 0.42)) continue;
      const wx = (j + hash1(j, seed + 12)) * cw;
      const half = mh * (0.8 + 1.8 * hash1(j, seed + 13));
      if (wx - half < x0 || wx + half > x1 || Math.abs(lx - wx) >= half) continue;
      const [wc, wz] = bankAt(wx, x0, x1, mh, seed, feet, o.taper);
      W.push([wx, half, wc + wz * 0.8 + mh * (0.25 + 0.8 * hash1(j, seed + 14)), mh * (0.1 + 0.16 * hash1(j, seed + 15)), 0.3 + 0.35 * hash1(j, seed + 16)]);
    }
    for (let y = Math.max(Yt, b.oy); y < Math.min(Yb, b.y1); y++) {
      const a = by - c.ly(y + 0.5);
      const low = a - (by - floor);
      // density: 1 at the core's top, 0 at the zone's top, broken by billows at two scales
      let cov: number;
      if (a <= core) cov = 1.2;
      else {
        const g = 1 - (a - core) / Math.max(1e-3, zone);
        const n = fbm(lx / (mh * 1.7), a / (mh * 0.6), seed + 7, 3) - 0.5 + 0.45 * (vnoise(lx / (mh * 0.55), a / (mh * 0.28), seed + 10) - 0.5);
        cov = g * 1.0 + n * 1.25;
      }
      // on the water, in the gaps: the underside lifts and frays too
      if (thin > 0 && low < lift + thin * 0.5 && near < 0.75) {
        const k = (low - lift) / Math.max(1e-3, thin * 0.5);
        const n = fbm(lx / (mh * 1.3), a / (mh * 0.5), seed + 19, 2) - 0.5;
        cov = Math.min(cov, k + n * 0.9);
      }
      for (const [wx, half, wy, th0, dens] of W) {
        const al = (lx - wx) / half;
        const yc = wy + (vnoise1(lx / (mh * 1.4), seed + 17 + Math.round(wx)) - 0.5) * th0 * 1.6 - al * al * th0;
        const th = th0 * Math.sqrt(1 - al * al);
        const v = (a - yc) / Math.max(1e-3, th);
        if (v <= -1 || v >= 1) continue;
        cov = Math.max(cov, dens * (1 - v * v) * Math.pow(1 - al * al, 0.6) * (0.5 + 0.8 * vnoise(lx / (mh * 0.5), a / (mh * 0.3), seed + 18)));
      }
      if (cov >= 0.85) {
        // solid: the body, in the haze's own cool white; a lump's sunward top catches the light
        let lit = false;
        if (a > core - 2 / d) {
          // (its upper left neighbour, a few px toward the sun, is outside the lump: a rim)
          const ax = lx - 2.5 / d, aa = a + 2.5 / d;
          const g2 = 1 - (aa - core) / Math.max(1e-3, zone);
          lit = g2 + (fbm(ax / (mh * 1.7), aa / (mh * 0.6), seed + 7, 3) - 0.5 + 0.45 * (vnoise(ax / (mh * 0.55), aa / (mh * 0.28), seed + 10) - 0.5)) * 1.25 < 0.85;
        }
        // (rims only in patches, so no lit contour runs along a layer's top)
        if (lit && (lighten > 0 || vnoise(lx / (mh * 2.2), a / mh, seed + 12) < 0.5)) lit = false;
        if (wetH > 0 && low < wetH) {
          const v = low / Math.max(1e-3, wetH) + (vnoise(lx / (mh * 0.4), a / (mh * 0.2), seed + 22) - 0.5) * 0.3;
          // (the lake's own value where it meets the mist: what the water just below shows of
          // the mist, a darker glassy jade, so the two meet without a step; paler going up)
          const T = [P.jade[2]!, P.jade[3]!, P.jade[1]!, P.jade[2]!];
          // (on the far plane the lake begins a few px above its waterline and mirrors the sky
          // there; the rows under that water are seen only in the water below the line, so they
          // take the sky's own cool value and the two stretches of water meet without a step)
          if (o.far && low < 4.5 + 1.5 * vnoise1(lx / 9, seed + 25)) { b.set(x, y, bayer4(x, y) < 0.5 ? C[3]! : P.range[1]!); continue; }
          if (v < 0.35) { b.set(x, y, bayer4(x, y) < 0.5 ? T[0]! : T[1]!); continue; }
          if (v < 0.6) { b.set(x, y, bayer4(x, y) < 0.5 ? T[2]! : T[3]!); continue; }
          if (v < 0.85) { b.set(x, y, bayer4(x, y) < (0.85 - v) / 0.25 * 0.75 ? T[2]! : li(2)); continue; }
        }
        // (lit tops a single step brighter: soft, never white puddles)
        b.set(x, y, lit ? li(1) : li(2));
        continue;
      }
      if (bayer4(x, y) < step3(cov / 0.85)) b.set(x, y, li(cov > 0.6 ? 1 : 2));
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
      // the farthest row erased into the haze: paler, and only the tallest show at all
      const ghost = k > 0 && k === rows - 1 ? (p.haze ?? 0) : 0;
      const Kg: Look = ghost > 0 ? { ...K, lit: K.lit * (1 - ghost), shade: K.shade * (1 - 0.7 * ghost), vegT: K.vegT * (1 - 0.5 * ghost), foot: Math.min(1, K.foot + ghost * 0.4) } : K;
      const row = forms.filter((f) => f.row === k);
      for (const f of row) {
        if (ghost > 0 && f.h < p.h * (0.45 + 0.5 * ghost)) continue;
        f.lobes.forEach((L, i) => paintLobe(c, f, L, Kg, p.green ?? 0.8, i === 0, p.veil ?? 1));
        // (a veil goes over the whole form: the lobes in front of the summit do not cut it)
        if (f.fall && (p.veil ?? 1) > 1 && c.d >= 0.25) {
          const L = f.lobes[0]!;
          const fallX = f.cx + L.dx - L.hw * (0.2 + 0.45 * hash1(2, L.seed));
          const top = f.by - L.h;
          for (let y = Math.max(c.buf.oy, Math.floor(c.Y(top + L.h * 0.18)) - 1); y < Math.min(c.buf.y1, Math.ceil(c.Y(f.by))); y++) {
            const a = f.by - c.ly(y + 0.5);
            if (a < 0 || a >= L.h * 0.82) continue;
            paintVeil(c, f, L, y, a, fallX, p.veil ?? 1);
          }
        }
      }
      const feet: MistFoot[] = row.map((f) => ({ x: f.cx, hw: f.hw, h: f.h }));
      // (the back rows' mist runs down to the front row's base: rows of karst rise out of one
      // body of white, never stacked bands with sky between them)
      mistBank(c, x0, x1, -k * p.h * 0.18, mh * (1 - 0.12 * k) * (1 + ghost), c.seed + k * 31, k > 0 ? 1 : 0, feet, { floor: 0, thin: k === 0 && p.look !== "far" ? mh * 0.8 : 0, water: p.wet ? (p.look === "far" ? mh * 0.75 : mh * 0.5) : 0, minCore: p.look === "far" && k === 0 ? mh * 0.4 : 0, far: p.look === "far", wetX: p.wet });
    }
  },
});

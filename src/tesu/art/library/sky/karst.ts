// Karst ranges for the far planes (P1 far, P2 middle far): Wuling and Liyue country, not
// Alps. Rows of tall limestone towers (rounded Guilin domes, flat-topped Zhangjiajie and
// Liyue pillars, the odd spire) packed in clusters of mixed heights, with cauliflower crowns
// of trees, green draping down the lit shoulders, sheer pale cliffs streaked down their
// faces, and a bank of mist along the foot of every row so each row rises out of white.
// Back rows are paler and set higher: depth inside one plane.
//
// Traced from env-sky reference sheet 1 (layered karst strips, kept outside the repo) into
// coded pixels; the mist banks are authored in code, not traced (Dex: mist is freestyle). Painted at full contrast like every plate; the plane shader fades the whole
// plane toward the band's haze (P1 about 62%, P2 about 40%).
//
// Light: the morning key, sun up and to the left. Lit flank left, shadow flank right,
// clumps lit on their upper left. No outlines on far planes: one darker step on the
// shadow edge only.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P, type Ramp } from "../../palette.ts";
import { bayer4, clamp, fbm1, hash, rng, tone, vnoise, vnoise1 } from "../../raster.ts";

export type KarstLook = "far" | "mid" | "near";

export interface KarstP {
  /** Band width, level-1 px. The anchor is the left end of the front row's base line. */
  w: number;
  /** Tallest tower, px above its base. */
  h: number;
  /** Depth rows inside the band (1 to 3). Back rows are paler and set higher. */
  rows?: number;
  /** How much higher each back row's base sits, px (default h * 0.16). */
  rise?: number;
  /** Average spacing of tower clusters, px (default h * 0.5). */
  every?: number;
  /** Detail and ramps: "far" (P1, blue-grey silhouettes), "mid" (P1 front, P2), "near" (P2 landmarks). */
  look?: KarstLook;
  /** Height of the mist bank along each row's foot, px (default h * 0.18). 0 for none. */
  mist?: number;
  /** Share of flat-topped pillars (Zhangjiajie, Liyue) against Guilin domes (default 0.3). */
  flat?: number;
  /** Chance a big front-row tower carries a thin fall (default 0.3 near, 0.15 mid, 0 far). */
  falls?: number;
  /** Vegetation, 0..1 (default 0.75). */
  green?: number;
  /**
   * Explicit front-row towers [x centre, width, height] in level-1 px from the anchor, to
   * keep a composer's placement (the same list the builder's "towers" painter takes).
   */
  towers?: [number, number, number][];
}

type Crown = "dome" | "flat" | "spire";

interface Tower {
  cx: number;
  hw: number;
  h: number;
  crown: Crown;
  lean: number;
  seed: number;
  row: number;
  /** Base y (level-1 local, negative is up): the row's base. */
  by: number;
  fall: number;
}

interface Clump {
  x: number;
  /** Height above the tower's base. */
  a: number;
  r: number;
  seed: number;
}

function rowsOf(p: KarstP): number {
  return Math.max(1, Math.min(3, Math.round(p.rows ?? 1)));
}

function towersOf(p: KarstP, seed: number): Tower[] {
  const rows = rowsOf(p);
  const look = p.look ?? "mid";
  const every = p.every ?? p.h * 0.5;
  const rise = p.rise ?? p.h * 0.16;
  const flat = p.flat ?? 0.3;
  const fallChance = p.falls ?? (look === "near" ? 0.3 : look === "mid" ? 0.15 : 0);
  const out: Tower[] = [];
  const crownOf = (v: number, slim: boolean): Crown => (v < flat && !slim ? "flat" : "dome");
  for (let k = rows - 1; k >= 0; k--) {
    const r = rng(seed + k * 977 + 13);
    const by = -k * rise;
    if (k === 0 && p.towers) {
      p.towers.forEach(([x, w, hh], i) => {
        const s = seed + i * 131 + 7;
        out.push({ cx: x, hw: w / 2, h: hh, crown: crownOf(hash(i, 3, s), w / hh < 0.3), lean: (hash(i, 5, s) - 0.5) * 0.08, seed: s, row: 0, by, fall: hash(i, 9, s) < fallChance ? 1 : 0 });
      });
      continue;
    }
    const scale = 1 - 0.08 * k;
    let x = -every * 0.5 * r();
    let i = 0;
    while (x < p.w + every * 0.4) {
      const cx = x + every * (0.2 + 0.4 * r());
      // heights: a few giants, many middling, the odd stub
      const th = p.h * scale * (0.26 + 0.74 * Math.pow(r(), 1.4));
      const hw = th * (0.09 + 0.11 * r());
      const s = seed + k * 7919 + i * 131;
      out.push({ cx, hw, h: th, crown: crownOf(r(), hw / th < 0.13), lean: (r() - 0.5) * 0.08, seed: s, row: k, by, fall: k === 0 && th > p.h * 0.62 && r() < fallChance ? 1 : 0 });
      // the cluster: lower towers packed against it, overlapping, in front
      const n = 1 + Math.floor(r() * 3.6);
      for (let j = 0; j < n; j++) {
        const sh = th * (0.28 + 0.5 * r());
        const shw = sh * (0.12 + 0.13 * r());
        const side = r() < 0.55 ? -1 : 1;
        const sx = cx + side * (hw * (0.4 + 0.7 * r()) + shw * (0.3 + 0.8 * r()));
        out.push({ cx: sx, hw: shw, h: sh, crown: crownOf(r(), shw / sh < 0.15), lean: (r() - 0.5) * 0.12, seed: s + j * 17 + 1, row: k, by, fall: 0 });
      }
      // gaps between clusters, some wide enough for the mist and sky to open up
      x = cx + every * (0.45 + (r() < 0.3 ? 1.6 : 0.7) * r());
      i++;
    }
  }
  // within a row: tall ones first, so the lower ones stand in front of them
  return out.sort((a, b) => b.row - a.row || b.h - a.h);
}

/** The crown's height for a tower. */
function crownH(t: Tower): number {
  return t.crown === "flat" ? t.hw * 0.5 : t.crown === "spire" ? t.h * 0.42 : Math.min(t.h * 0.45, t.hw * 1.2);
}

/** Half width of the tower at height a above its base, left (-1) or right (1) edge. */
function halfAt(t: Tower, a: number, side: -1 | 1): number {
  if (a < 0 || a > t.h) return 0;
  const u = a / t.h;
  const ch = crownH(t);
  let f = 1;
  const c0 = t.h - ch;
  if (a > c0) {
    const k = (a - c0) / ch;
    if (t.crown === "spire") f = 0.25 * (1 - k) + 0.75 * Math.pow(1 - k, 1.4);
    else if (t.crown === "flat") f = Math.sqrt(Math.max(0, 1 - Math.pow(k, 2.6)));
    else f = Math.sqrt(Math.max(0, 1 - k * k));
  }
  // bulges and flutes: limestone weathers in vertical runs
  const s = t.seed + (side > 0 ? 5 : 0);
  const bulge = 0.84 + 0.3 * vnoise1(a / Math.max(8, t.hw * 1.6), s);
  const flute = 0.06 * (vnoise1(a / 4.5, s + 2) - 0.5);
  const foot = u < 0.12 ? 1 + (0.12 - u) * 1.4 : 1;
  // ledges: the odd band where the face steps in, so the silhouette is notched, not smooth
  const band = Math.floor(a / 16);
  const step = hash(band, side, t.seed + 31) < 0.28 && a - band * 16 < 5 + 4 * hash(band, 2, t.seed) ? 0.86 : 1;
  return t.hw * f * (bulge + flute) * foot * step;
}

function centreAt(t: Tower, a: number): number {
  return t.cx + t.lean * a + (vnoise1(a / 70, t.seed + 9) - 0.5) * t.hw * 0.2;
}

/**
 * Vegetation clumps on a tower: a cauliflower cap of small tree crowns (two bands over the
 * crown), chains draping down the lit shoulder, and horizontal ledge strips on the face.
 * All sit on or inside the rock's silhouette, except the cap, which bulges above it.
 */
function clumpsOf(t: Tower, green: number, simple: boolean): Clump[] {
  if (green <= 0) return [];
  const r = rng(t.seed + 4242);
  const out: Clump[] = [];
  const ch = crownH(t);
  const base = Math.max(1.8, Math.min(t.hw * 0.2, 9));
  // the cap: two overlapping bands of clumps following the crown's outline
  for (const [band, drop] of (simple ? [[0, 0.35]] : [[0, 0.15], [1, 0.55]]) as [number, number][]) {
    const n = Math.max(3, Math.round((t.hw * 2) / (base * 1.25)));
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * 2 - 1 + (r() - 0.5) * 0.15;
      if (t.crown === "spire" && Math.abs(u) > 0.5 + band * 0.3) continue;
      if (r() > 0.4 + 0.6 * green) continue;
      // height of the crown outline above u
      const k = t.crown === "flat" ? Math.pow(Math.abs(u), 2.6) : u * u;
      const a = t.h - ch + ch * Math.sqrt(Math.max(0, 1 - k)) - band * base * 1.3 - drop * base;
      const side: -1 | 1 = u < 0 ? -1 : 1;
      const x = centreAt(t, a) + u * halfAt(t, Math.max(0, a), side) * 0.95;
      out.push({ x, a, r: base * (0.7 + 0.55 * r()) * (band ? 0.9 : 1) * (simple ? 0.95 : 1), seed: t.seed + band * 97 + i * 3 });
    }
  }
  if (simple) return out;
  // drapes: chains of clumps down the lit (left) shoulder, sometimes the right
  const drapes = Math.floor(r() * (1 + 2 * green));
  for (let j = 0; j < drapes; j++) {
    const side: -1 | 1 = j === 0 || r() < 0.65 ? -1 : 1;
    let a = t.h - ch * (0.5 + 0.4 * r());
    const len = t.h * (0.06 + 0.2 * green * r());
    const inset = 0.55 + 0.4 * r();
    let rr = base * 0.9;
    while (a > t.h - ch - len && a > t.h * 0.15) {
      const x = centreAt(t, a) + side * halfAt(t, a, side) * inset;
      out.push({ x, a, r: rr, seed: t.seed + 300 + j * 31 + Math.round(a) });
      a -= rr * (0.6 + 0.35 * r());
      rr = Math.max(1.4, rr * (0.86 + 0.1 * r()));
    }
  }
  // ledges: short horizontal strips of green on the face
  const ledges = Math.round(green * (t.h / 45) * (0.5 + r()));
  for (let i = 0; i < ledges; i++) {
    const a = t.h * (0.15 + 0.55 * r());
    const m = centreAt(t, a);
    const u0 = -0.85 + r() * 1.2;
    const n = 2 + Math.floor(r() * 3);
    const rr = base * (0.45 + 0.3 * r());
    for (let j = 0; j < n; j++) {
      const u = u0 + j * (rr * 1.3) / Math.max(1, t.hw);
      if (u > 0.85) break;
      const x = m + u * (u < 0 ? halfAt(t, a, -1) : halfAt(t, a, 1));
      out.push({ x, a: a + (r() - 0.5) * rr * 0.6, r: rr * (0.8 + 0.4 * r()), seed: t.seed + 600 + i * 13 + j });
    }
  }
  return out;
}

interface Look {
  rock: Ramp;
  veg: Ramp;
  vegDark: Ramp;
  lit: number;
  shade: number;
  vegLit: number;
  detail: number;
}

function lookOf(p: KarstP, row: number): Look {
  const look = p.look ?? "mid";
  if (look === "far" || (look === "mid" && row > 0)) {
    // blue-grey silhouettes, the crowns one step darker than the shaded rock
    return { rock: P.range, veg: P.range, vegDark: P.range, lit: 0.26 - row * 0.08, shade: 0.6 - row * 0.12, vegLit: 0.82 - row * 0.14, detail: look === "far" ? 0 : 1 };
  }
  if (look === "mid" || row > 0) {
    return { rock: P.karst, veg: P.pine, vegDark: P.pine, lit: 0.14, shade: 0.46, vegLit: 0.15, detail: 1 };
  }
  return { rock: P.karst, veg: P.moss, vegDark: P.pine, lit: 0.08, shade: 0.56, vegLit: 0.3, detail: 2 };
}

/**
 * For each art px column the tower covers, the height (level-1 px above its base) of the
 * tower's top in that column. Computed over the whole tower (not just this buffer), so the
 * vegetation cap is the same in every plate tile.
 */
function columnTops(c: PaintCtx, t: Tower): { x0: number; top: Float32Array } {
  const d = c.d;
  const span = t.hw * 1.8 + Math.abs(t.lean) * t.h + 4;
  const x0 = Math.floor(c.X(t.cx - span)), x1 = Math.ceil(c.X(t.cx + span));
  const top = new Float32Array(Math.max(1, x1 - x0)).fill(-1);
  const yTop = Math.floor(c.Y(t.by - t.h)) - 1, yBase = Math.ceil(c.Y(t.by));
  for (let y = yTop; y < yBase; y++) {
    const a = t.by - c.ly(y + 0.5);
    if (a < 0 || a > t.h) continue;
    const m = centreAt(t, a), hl = halfAt(t, a, -1), hr = halfAt(t, a, 1);
    if (hl + hr <= 0.3 / d) continue;
    const xa = Math.max(x0, Math.ceil(c.X(m - hl) - 0.5)), xb = Math.min(x1 - 1, Math.floor(c.X(m + hr) - 0.5));
    for (let x = xa; x <= xb; x++) if (top[x - x0]! < 0) top[x - x0] = a;
  }
  return { x0, top };
}

function paintTower(c: PaintCtx, t: Tower, L: Look, green: number): void {
  const b = c.buf, d = c.d;
  const yTop = Math.floor(c.Y(t.by - t.h)) - 1, yBase = Math.ceil(c.Y(t.by));
  const span = t.hw * 1.8 + Math.abs(t.lean) * t.h + 4;
  // the crown's clumps bulge above and beside the rock: test the box with room for them
  const pad = Math.max(1.8, Math.min(t.hw * 0.2, 9)) * 2.6 + 2;
  if (!b.touches(Math.floor(c.X(t.cx - span - pad)), Math.floor(c.Y(t.by - t.h - pad)), Math.ceil(c.X(t.cx + span + pad)), yBase)) return;
  const fallX = t.cx - t.hw * (0.1 + 0.4 * hash(1, 2, t.seed));
  const cols = green > 0 ? columnTops(c, t) : null;
  const base = Math.max(1.8, Math.min(t.hw * 0.2, 9));
  for (let y = Math.max(yTop, b.oy); y < Math.min(yBase, b.y1); y++) {
    const a = t.by - c.ly(y + 0.5);
    if (a < 0 || a > t.h) continue;
    const m = centreAt(t, a), hl = halfAt(t, a, -1), hr = halfAt(t, a, 1);
    if (hl + hr <= 0.3 / d) continue;
    const xEnd = Math.floor(c.X(m + hr) - 0.5);
    const xa = Math.max(b.ox, Math.ceil(c.X(m - hl) - 0.5)), xb = Math.min(b.x1 - 1, xEnd);
    // where the light breaks across the face: lit left of the ridge, shaded right of it
    const ridge = 0.1 + 0.4 * vnoise1(a / 45, t.seed + 21) - 0.15 * (a / t.h);
    for (let x = xa; x <= xb; x++) {
      const lx = c.lx(x + 0.5);
      const u = lx < m ? (lx - m) / Math.max(1e-3, hl) : (lx - m) / Math.max(1e-3, hr);
      // the vegetation cap: everything within capDepth of this column's top is trees
      if (cols) {
        const ct = cols.top[x - cols.x0] ?? -1;
        const below = ct - a;
        const capDepth = (crownH(t) * (L.detail === 0 ? 0.8 : 0.75) + base * (L.detail === 0 ? 1.4 : 1.6)) * Math.min(1, green * 1.25) * (0.6 + 0.7 * vnoise1(lx / (base * 1.6), t.seed + 41)) * (u < 0 ? 1.3 : 0.85);
        if (ct >= 0 && below < capDepth && ct > t.h * 0.4) {
          let tt: number;
          if (L.detail === 0) tt = L.vegLit + 0.12;
          else {
            const bump = vnoise(lx / (base * 0.8), a / (base * 0.75), t.seed + 43);
            tt = L.vegLit + 0.18 + 0.3 * (below / Math.max(1, capDepth)) - 0.28 * (bump - 0.5) + (u > ridge ? 0.16 : 0);
          }
          let ramp = L.veg;
          if (tt > 0.62 && L.vegDark !== L.veg) {
            ramp = L.vegDark;
            tt = 0.3 + (tt - 0.62) * 1.4;
          }
          b.set(x, y, tone(ramp, clamp(tt, 0, 1), x, y, 0.4));
          continue;
        }
      }
      let tt: number;
      if (u < ridge) tt = L.lit + 0.14 * clamp((u + 1) / (ridge + 1), 0, 1);
      else tt = L.shade + 0.1 * clamp((u - ridge) / (1 - ridge), 0, 1);
      if (x === xEnd && u > 0) tt += 0.12;
      if (L.detail >= 1 && d >= 0.25) {
        // long vertical streaks: water and lichen running down the face
        const st = vnoise(lx / 1.6, a / 42, t.seed + 3);
        if (st > 0.72) tt += 0.11;
        else if (st < 0.12 && u < ridge) tt -= 0.07;
        // dark stains below the crown's trees
        if (a > t.h * 0.45 && vnoise(lx / 2, a / 18, t.seed + 5) > 0.72) tt += 0.13;
      }
      if (L.detail >= 2 && d >= 0.5) {
        // bedding steps and the odd deep crack
        const bed = Math.abs(Math.sin((a + 9 * vnoise1(lx / 30, t.seed + 7)) / 14));
        if (bed < 0.07) tt += 0.07;
        if (hash(Math.floor(lx / 4), Math.floor(a / 60), t.seed + 11) < 0.06 && Math.abs(Math.sin(lx * 1.3 + a * 0.02)) < 0.18) tt += 0.2;
      }
      b.set(x, y, tone(L.rock, clamp(tt, 0, 1), x, y, 0.45));
    }
    // a thin fall from a notch in the crown down into the mist
    if (t.fall && a < t.h - crownH(t) * 0.5 && d >= 0.25) {
      const sway = Math.sin(a / 23 + t.seed) * Math.min(1.5, (t.h - a) / 60);
      const half = Math.max(0.6 / d, t.hw * 0.05 + (t.h - a) * 0.005);
      const fx = fallX + t.lean * a + sway;
      const X0 = Math.round(c.X(fx - half)), X1 = Math.round(c.X(fx + half));
      for (let x = Math.max(X0, b.ox); x <= Math.min(X1, b.x1 - 1); x++) {
        const rim = x === X0 || x === X1;
        if (rim && bayer4(x, y) < 0.5) continue;
        b.set(x, y, rim ? P.cloud[2]! : P.cloud[(Math.floor(c.ly(y) / 3) + x) % 5 === 0 ? 1 : 0]!);
      }
    }
  }
  for (const k of clumpsOf(t, green, L.detail === 0)) paintClump(c, t, k, L);
}

function paintClump(c: PaintCtx, t: Tower, k: Clump, L: Look): void {
  const b = c.buf, d = c.d;
  const cx = k.x, cy = t.by - k.a;
  const R = k.r * 1.3;
  const X0 = Math.floor(c.X(cx - R)), X1 = Math.ceil(c.X(cx + R)), Y0 = Math.floor(c.Y(cy - R)), Y1 = Math.ceil(c.Y(cy + R));
  if (!b.touches(X0, Y0, X1, Y1)) return;
  for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const dx = c.lx(x + 0.5) - cx, dy = c.ly(y + 0.5) - cy;
      const ang = Math.atan2(dy, dx);
      // a leafy rim: small bumps all round
      const rim = k.r * (0.8 + 0.28 * vnoise1(ang * 2.4 + 10, k.seed) + (d >= 0.5 ? 0.12 * vnoise1(ang * 8 + 3, k.seed + 1) : 0));
      const q = Math.hypot(dx, dy) / rim;
      if (q > 1) continue;
      const lit = (-0.62 * dx - 0.78 * dy) / Math.max(1e-3, rim);
      let tt: number;
      let ramp = L.veg;
      if (L.detail === 0) tt = L.vegLit + 0.1 - lit * 0.12;
      else {
        tt = L.vegLit + 0.3 - lit * 0.32 + q * 0.1;
        if (tt > 0.62 && L.vegDark !== L.veg) {
          ramp = L.vegDark;
          tt = 0.3 + (tt - 0.62) * 1.4;
        }
        if (L.detail >= 2 && d >= 0.5 && hash(x >> 1, y >> 1, k.seed) < 0.07) tt += 0.15;
      }
      b.set(x, y, tone(ramp, clamp(tt, 0, 1), x, y, 0.4));
    }
  }
}

/**
 * A bank of mist along a row's foot, authored in code. Its top rolls in long low billows of
 * varying size; each billow is lit on its rising (sunward) side and shaded in the trough
 * behind it; below the crests the body is one soft white; above the top, a three-step
 * dither (50%, 25%, 1 in 8) dissolves the bases of the towers into it.
 */
export function paintMistBank(c: PaintCtx, x0: number, x1: number, by: number, mh: number, seed: number, lighten = 0): void {
  if (mh <= 0) return;
  const b = c.buf, d = c.d;
  const band = Math.max(3 / d, mh * 0.5);
  const Xa = Math.max(b.ox, Math.floor(c.X(x0))), Xb = Math.min(b.x1, Math.ceil(c.X(x1)));
  const Yt = Math.floor(c.Y(by - mh * 1.3 - band)), Yb = Math.ceil(c.Y(by));
  if (!b.touches(Xa, Yt, Xb, Yb)) return;
  const C = P.cloud;
  const li = (i: number): number => C[Math.max(0, Math.min(4, i - lighten))]!;
  for (let x = Xa; x < Xb; x++) {
    const lx = c.lx(x + 0.5);
    // round billows of varying width and height riding on a slow swell
    const period = mh * (0.9 + 0.9 * fbm1(lx / (mh * 8), seed + 5, 2));
    const ph = lx / period + 1.5 * fbm1(lx / (mh * 5), seed, 2);
    const cell = Math.floor(ph);
    const dxn = ph - cell - 0.5;
    const crest = Math.sqrt(Math.max(0, 1 - 4 * dxn * dxn));
    const amp = mh * (0.14 + 0.16 * hash(cell, 7, seed));
    const swell = 0.4 + 0.35 * fbm1(lx / (mh * 4), seed + 1, 3);
    const endFade = clamp(Math.min(lx - x0, x1 - lx) / (mh * 2.5), 0, 1);
    const tp = (mh * swell + amp * crest) * endFade;
    for (let y = Math.max(Yt, b.oy); y < Math.min(Yb, b.y1); y++) {
      const a = by - c.ly(y + 0.5);
      if (a > tp + band) continue;
      if (a > tp) {
        // the dissolve over whatever stands above: 50%, 25%, then 1 in 8
        const k = (a - tp) / band;
        const th = k < 0.34 ? 0.5 : k < 0.67 ? 0.25 : 0.12;
        if (bayer4(x, y) >= th) continue;
        b.set(x, y, li(1));
        continue;
      }
      const under = tp - a;
      let i = 1;
      if (under < 1.2 / d) i = dxn < 0.15 ? 0 : 1;
      else if (dxn < -0.12 && under < amp * crest * 0.45) i = 0;
      else if (dxn > 0.36 && under < amp * 0.55) i = 2;
      b.set(x, y, li(i));
    }
  }
}

function extentOf(p: KarstP): [number, number] {
  let x0 = -p.h * 0.3, x1 = p.w + p.h * 0.3;
  for (const [x, w] of p.towers ?? []) {
    x0 = Math.min(x0, x - w * 1.2);
    x1 = Math.max(x1, x + w * 1.2);
  }
  return [x0, x1];
}

export const karst = definePainter<KarstP>("sky.karst", {
  bounds(p) {
    const rows = rowsOf(p);
    const rise = p.rise ?? p.h * 0.16;
    // generated clusters can lean past the band's ends: leave room so no tile clips them
    const [e0, e1] = extentOf(p);
    const x0 = e0 - p.h * 0.5, x1 = e1 + p.h * 0.5;
    let top = -p.h - (rows - 1) * rise;
    for (const [, , hh] of p.towers ?? []) top = Math.min(top, -hh);
    return [x0, top - 20, x1, 2];
  },
  paint(c, p) {
    const towers = towersOf(p, c.seed);
    const rows = rowsOf(p);
    const rise = p.rise ?? p.h * 0.16;
    const mh = p.mist ?? p.h * 0.18;
    const [x0, x1] = extentOf(p);
    for (let k = rows - 1; k >= 0; k--) {
      const L = lookOf(p, k);
      for (const t of towers) if (t.row === k) paintTower(c, t, L, p.green ?? 0.75);
      // the mist bank at this row's foot hides the bases and fills the gaps
      paintMistBank(c, x0, x1, -k * rise, mh * (1 - 0.12 * k), c.seed + k * 31, k > 0 ? 1 : 0);
    }
  },
});

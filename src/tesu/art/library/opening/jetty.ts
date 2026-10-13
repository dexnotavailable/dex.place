// Kagami's jetty, seen side-on along its length: an old, hand-built thing, mended for years.
// The ends of the deck planks in a row (each its own width, tone and wear; a few missing, a few
// pale new ones; some sunk a pixel), the stringer beams under them (each run its own depth and
// age: a rebuilt run is paler and crisper, with an iron strap or a lashing where it meets the old
// one; the beam sags a little between its bents), and the bents themselves grouped the way
// repairs grouped them: long bays and short, a pair of piles where two stringers meet, an extra
// pile driven in later beside an old one and lashed to it, a leaning one, the far pile of a bent
// showing darker behind the near one, braces on some bays only (one snapped), and the odd broken
// stub under the deck that no longer reaches it. Every pile is a round log of its own thickness,
// its wet band, algae and moss at their own heights, a bright wet line where it enters the lake.
// Weathered lake timber: bleached grey on the lit faces, warm brown in the shade (stone picks
// over timber, never dithered across ramps).
//
// The lake mirrors the plate, so the plate holds what the water sees: the piles, and the deck
// from below, dark and in its own shadow. The lit face of the deck (plank ends and stringer) is
// painted as sprites that the water does not see (part "face"); together they read as one
// jetty whose reflection is a darker, broken band (part "all" paints both in one go).
//
// Also here: the lift's top station (op.station), the jetty's two landings (op.landing), broken
// pile stubs standing alone in the water (op.stub), mooring posts, Pilgrims' Leap's plank and
// mooring lines. The close band (2x) paints at twice the density: grain, nails and rope fibres
// there are its own pixels, not a magnified copy. Anchor: the deck's top-left corner.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { cached, yAt } from "./kit.ts";

export interface JettyP {
  /** Deck length, level-1 px. */
  w: number;
  /** Waterline below the deck top, px. */
  water: number;
  /** Mean bay length, px (default 118). */
  every?: number;
  /** Indices of front piles that stand up past the deck as mooring posts, and their heights. */
  posts?: [number, number][];
  /** Land under the jetty's ends: local polylines [x, y, ...] (y below the deck top). Piles there stand in it. */
  west?: number[];
  east?: number[];
  /** No bents of the jetty's own in [x0, x1] (a station stands there on its own piles). */
  gap?: [number, number];
  /** "all" (default): everything; "plate": the piles and the deck as the water sees it; "face": the deck's lit face only. */
  part?: "all" | "plate" | "face";
  /** For the face: the window painted, px (a sprite covers part of the deck). */
  from?: number;
  to?: number;
  /** The plan's seed (the plate piece's), so a face sprite paints the same jetty. */
  plan?: number;
}

/** Plank-end height and the stringer's top. */
const DECK = 7;

/** Weathered timber: a tone t (0 lit .. 1 dark), bleached (stone ramp) where lit and dry. */
export function wood(x: number, y: number, t: number, bleach = true): number {
  if (bleach && t < 0.48) return tone(P.stone, clamp(0.12 + t * 1.25, 0, 1), x, y, 0.3);
  return tone(P.timber, clamp(0.3 + t * 0.7, 0, 1), x, y, 0.35);
}

// --- the plan ---------------------------------------------------------------------------------

export interface JPile {
  x: number;
  hw: number;
  /** Top (local y; under the deck it hides behind the stringer) and foot (below the water, or in the ground). */
  top: number;
  foot: number;
  /** Px the top sits right (+) of the foot. */
  lean: number;
  /** Heights above the waterline of its wet band and its moss. */
  wet: number;
  moss: number;
  /** 0 old and silvered .. 1 newly driven. */
  age: number;
  /** The far pile of a bent: behind, darker. */
  back: boolean;
  /** A jagged broken top (a stub under the deck). */
  broken: boolean;
  /** A rope lashing at this height (0: none). */
  lash: number;
  k: number;
}
export interface JRun { x0: number; x1: number; depth: number; age: number; drop: number; k: number }
export interface JPlank { x: number; w: number; t: number; kind: number; drop: number; k: number }
export interface JBrace { ax: number; ay: number; bx: number; by: number; th: number; cut: number; age: number; k: number }
export interface JHead { x: number; hw: number; h: number; k: number }
export interface JPlan {
  piles: JPile[];
  /** The bents (front pile x), in order. */
  bents: number[];
  runs: JRun[];
  planks: JPlank[];
  braces: JBrace[];
  heads: JHead[];
  /** Bays between supporting bents: [x0, x1, sag px]. */
  bays: [number, number, number][];
}

/** Planks kinds. */
const MISSING = 1, NEWP = 2, SPLIT = 3, WORN = 4;

function groundAt(p: JettyP, x: number): number {
  let g = Infinity;
  for (const pts of [p.west, p.east]) {
    if (!pts || pts.length < 4) continue;
    if (x < pts[0]! || x > pts[pts.length - 2]!) continue;
    g = Math.min(g, yAt(pts, x));
  }
  return g;
}

/** The jetty's whole layout for a seed: bents, piles, stringer runs, planks, braces. */
export function jettyPlan(p: JettyP, seed: number): JPlan {
  return cached(`jplan|${seed}|${p.w}|${p.water}|${p.every}|${(p.west ?? []).join(",")}|${(p.east ?? []).join(",")}|${(p.gap ?? []).join(",")}`, () => {
    const r = rng((seed ^ 0x5f3759d) >>> 0);
    const w = p.w, water = p.water;
    const every = p.every ?? 118;
    const gap = p.gap;
    const inGap = (x: number, m = 0): boolean => !!gap && x > gap[0] - m && x < gap[1] + m;
    // the stringer: runs of beam, each laid at its own time
    const runs: JRun[] = [];
    let x = -4;
    let prevNew = true;
    while (x < w + 4) {
      const len = 340 + r() * 640;
      const isNew: boolean = !prevNew && r() < 0.34;
      runs.push({ x0: x, x1: Math.min(w + 4, x + len), depth: isNew ? 12 + Math.round(r()) : 13 + Math.round(r() * 3), age: isNew ? 1 : 0, drop: !isNew && r() < 0.3 ? 1 : 0, k: r() });
      prevNew = isNew;
      x += len;
    }
    if (runs.length > 1 && runs[runs.length - 1]!.x1 - runs[runs.length - 1]!.x0 < 160) {
      const last = runs.pop()!;
      runs[runs.length - 1]!.x1 = last.x1;
    }
    const runAt = (xx: number): JRun => {
      for (const q of runs) if (xx < q.x1) return q;
      return runs[runs.length - 1]!;
    };
    // the bents: anchors first (the ends, a pair at every stringer joint, both sides of the gap)
    const anchors: [number, boolean][] = [];
    const first = p.west ? 22 + r() * 8 : 6;
    anchors.push([first, false]);
    for (let i = 1; i < runs.length; i++) {
      const j = runs[i]!.x0;
      if (j < first + 40 || j > w - 40 || inGap(j, 40)) continue;
      const a = j - 7 - r() * 4, b = j + 7 + r() * 5;
      anchors.push([a, true], [b, true]);
    }
    if (gap) anchors.push([gap[0] - 4 - r() * 4, false], [gap[1] + 4 + r() * 4, false]);
    anchors.push([w - 7 - r() * 5, false]);
    anchors.sort((a, b) => a[0] - b[0]);
    const bents: number[] = [];
    const pairs = new Set<number>();
    for (let i = 0; i < anchors.length; i++) {
      const [ax, pair] = anchors[i]!;
      bents.push(ax);
      if (pair) pairs.add(bents.length - 1);
      const next = anchors[i + 1];
      if (!next) break;
      const L = next[0] - ax;
      // a pair's two piles, or the station's gap: nothing between
      if ((pair && next[1] && L < 30) || inGap(ax + L / 2)) continue;
      const n = Math.max(0, Math.round(L / every) - 1);
      if (n === 0) continue;
      // irregular bays: weights from short to long, a long bay now and then
      const ws: number[] = [];
      for (let k = 0; k <= n; k++) ws.push(r() < 0.18 ? 1.9 + r() * 0.6 : 0.45 + r() * 1.1);
      const sum = ws.reduce((s, v) => s + v, 0);
      let acc = 0;
      for (let k = 0; k < n; k++) {
        acc += ws[k]!;
        const bx = ax + (L * acc) / sum;
        if (bx - bents[bents.length - 1]! < 30 || next[0] - bx < 30) continue;
        bents.push(bx);
      }
    }
    // the piles of each bent
    const piles: JPile[] = [];
    const heads: JHead[] = [];
    const footAt = (px: number, extra: number): number => {
      const g = groundAt(p, px);
      return g < water + 24 ? g + extra : water + 24;
    };
    bents.forEach((bx, i) => {
      const run = runAt(bx);
      const age = run.age ? 0.55 + 0.45 * r() : r() < 0.07 ? 0.7 : 0.15 * r();
      const hw = age > 0.5 ? 3.6 + r() * 1.6 : 4.6 + r() * 2.9;
      const leanBig = !pairs.has(i) && r() < 0.11;
      const lean = leanBig ? (r() < 0.5 ? -1 : 1) * (3 + r() * 4) : (r() - 0.5) * 1.6;
      const wet = 4 + r() * 17 + (age > 0.5 ? -2 : 0);
      piles.push({ x: bx, hw, top: DECK + 2, foot: footAt(bx, 3 + r() * 4), lean, wet: Math.max(3, wet), moss: wet + 2 + r() * 14, age, back: false, broken: false, lash: 0, k: r() });
      // its far pile, darker behind it, a little to one side
      if (r() < 0.6) {
        const dx = (r() < 0.5 ? -1 : 1) * (3 + r() * 5);
        piles.push({ x: bx + dx, hw: hw * (0.75 + r() * 0.25), top: DECK + 2, foot: footAt(bx + dx, 4), lean: (r() - 0.5) * 2, wet: 4 + r() * 14, moss: 6 + r() * 16, age, back: true, broken: false, lash: 0, k: r() });
      }
      // a newer pile driven in later beside an old one, lashed to it
      if (!pairs.has(i) && age < 0.5 && r() < 0.14) {
        const side = r() < 0.5 ? -1 : 1;
        const ex = bx + side * (hw + 2.5 + r() * 2.5);
        piles.push({ x: ex, hw: 3.2 + r() * 0.9, top: DECK + 2, foot: footAt(ex, 5), lean: (r() - 0.5) * 1.2, wet: 3 + r() * 6, moss: 2 + r() * 4, age: 0.95, back: false, broken: false, lash: 26 + r() * 10, k: r() });
      }
      // a cross-beam's end under the stringer
      if (!pairs.has(i) && r() < 0.45) heads.push({ x: bx + (r() - 0.5) * 2, hw: hw + 2 + r() * 3, h: 3.5 + r() * 2.5, k: r() });
    });
    // the bays and their sag, and braces on some of them
    const bays: [number, number, number][] = [];
    const braces: JBrace[] = [];
    for (let i = 0; i + 1 < bents.length; i++) {
      const a = bents[i]!, b = bents[i + 1]!;
      const L = b - a;
      if (inGap((a + b) / 2)) continue;
      bays.push([a, b, clamp((L - 40) / 110, 0, 1) * (0.8 + r() * 1.8)]);
      if (L > 64 && r() < 0.3 && !(p.west && a < 60) && !(p.east && b > w - 50)) {
        const down = r() < 0.5;
        const k = r();
        const yTop = DECK + 16 + r() * 3, yBot = water - 5 - r() * 9;
        braces.push({ ax: a + 3, ay: down ? yTop : yBot, bx: b - 3, by: down ? yBot : yTop, th: 2.6 + r() * 1.4, cut: k < 0.16 ? 0.45 + r() * 0.3 : 1, age: runAt(a).age, k: r() });
        if (k > 0.9) braces.push({ ax: a + 3, ay: down ? yBot : yTop, bx: b - 3, by: down ? yTop : yBot, th: 2.4, cut: 1, age: 1, k: r() });
      }
    }
    // broken stubs under the deck: old piles that no longer reach it
    let stubs = 0;
    for (const [a, b] of bays) {
      if (stubs >= Math.max(2, Math.round(w / 2200)) || b - a < 96 || r() > 0.2) continue;
      const sx = a + (b - a) * (0.35 + r() * 0.3);
      piles.push({ x: sx, hw: 5 + r() * 2.5, top: DECK + 22 + r() * 14, foot: footAt(sx, 4), lean: (r() < 0.5 ? -1 : 1) * (2 + r() * 4), wet: 10 + r() * 10, moss: 18 + r() * 8, age: 0, back: false, broken: true, lash: 0, k: r() });
      stubs++;
    }
    // the planks: their own widths, tones and wear
    const planks: JPlank[] = [];
    let px = -4;
    let last = 0;
    while (px < w + 4) {
      const run = runAt(px);
      const pw = run.age ? 7 + r() * 4 : 5 + r() * 8.5;
      const u = r();
      let kind = u < 0.035 ? MISSING : u < 0.09 ? NEWP : u < 0.17 ? SPLIT : u < 0.34 ? WORN : 0;
      if (kind === MISSING && (last === MISSING || px < 60 || px > w - 60 || inGap(px, 20))) kind = WORN;
      planks.push({ x: px, w: pw, t: run.age ? 0.08 + r() * 0.12 : 0.12 + r() * 0.42, kind, drop: run.drop || (!run.age && r() < 0.1) ? 1 : 0, k: r() });
      last = kind;
      px += pw;
    }
    return { piles, bents, runs, planks, braces, heads, bays };
  });
}

/** Front pile x of each bent (kept for older callers). */
export function pileXs(p: JettyP, seed: number): number[] {
  return jettyPlan(p, seed).bents;
}

function runOf(plan: JPlan, x: number): JRun {
  for (const q of plan.runs) if (x < q.x1) return q;
  return plan.runs[plan.runs.length - 1]!;
}

function plankOf(plan: JPlan, x: number): JPlank | null {
  const a = plan.planks;
  let lo = 0, hi = a.length - 1;
  if (!a.length || x < a[0]!.x) return null;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (a[m]!.x <= x) lo = m;
    else hi = m - 1;
  }
  const pk = a[lo]!;
  return x < pk.x + pk.w ? pk : null;
}

/** The stringer's underside at x (it sags between the bents that carry it). */
function strBot(plan: JPlan, x: number): number {
  const run = runOf(plan, x);
  let y = DECK + run.depth;
  // an old beam's underside is rotted and splintered in places
  if (!run.age) y += (vnoise1(x / 6, Math.round(run.k * 997)) - 0.5) * 1.8 - (hash1(Math.floor(x / 4), Math.round(run.k * 991)) < 0.06 ? 1.2 : 0);
  const bays = plan.bays;
  let lo = 0, hi = bays.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const [a, b, s] = bays[m]!;
    if (x < a) hi = m - 1;
    else if (x > b) lo = m + 1;
    else { y += s * Math.sin(Math.PI * (x - a) / (b - a)); break; }
  }
  return y;
}

// --- piles ------------------------------------------------------------------------------------

/**
 * A round log standing from top to foot (local px), centre cx at the top, half width hw: lit on
 * its left, shade on its right, silvered where dry, darker and slick in its wet band, algae
 * trailing from the band's top, moss climbing its shade side, a bright wet line at the water.
 */
export function pileLog(c: PaintCtx, pl: JPile, water: number, seed: number, shade = 0): void {
  const b = c.buf, d = c.d;
  const Y0 = Math.floor(c.Y(pl.top - (pl.broken ? 0 : 0))), Y1 = Math.ceil(c.Y(pl.foot));
  const reach = Math.abs(pl.lean) + pl.hw + 2;
  if (!b.touches(Math.floor(c.X(pl.x - reach)), Y0 - 2, Math.ceil(c.X(pl.x + reach)), Y1)) return;
  const span = Math.max(1, pl.foot - pl.top);
  for (let y = Math.max(Y0 - 2, b.oy); y < Math.min(Y1, b.y1); y++) {
    const ly = c.ly(y + 0.5);
    const sh = pl.lean * ((pl.foot - ly) / span);
    const X0 = Math.round(c.X(pl.x - pl.hw + sh)), X1 = Math.max(X0 + 2, Math.round(c.X(pl.x + pl.hw + sh)));
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const u = (x - X0 + 0.5) / (X1 - X0);
      const lx = c.lx(x + 0.5);
      // a broken top: jagged splinters, the lit side standing higher
      if (pl.broken) {
        const jag = pl.top + (1 - u) * -3 + (hash(Math.floor(lx * 1.3), 7, seed) - 0.5) * 7 + Math.abs(Math.sin(u * 7 + pl.k * 9)) * 4;
        if (ly < jag) continue;
        if (ly < jag + 1.2) { b.set(x, y, u < 0.5 ? P.stone[1]! : P.timber[3]!); continue; }
      } else if (ly < pl.top) continue;
      const hgt = water - ly;
      // round: a lit stripe on the left, falling into shade on the right
      let t = u < 0.2 ? 0.1 : u < 0.46 ? 0.27 : u < 0.76 ? 0.46 : 0.66;
      if (X1 - x === 1) t = 0.9;
      t += shade;
      // weathered grain: long checks down the log, the odd knot
      if (d >= 0.5 && vnoise(lx / 1.3, ly / 16, seed) > 0.7) t += 0.13;
      if (d >= 1 && hash(Math.floor(lx * 2), Math.floor(ly / 7), seed + 1) < 0.035) t += 0.24;
      if (pl.age > 0.5) t -= 0.06;
      // the deck's shadow on its upper part
      if (!pl.broken && ly < DECK + 26) t += 0.14 * clamp((DECK + 26 - ly) / 10, 0, 1);
      let bleach = pl.age < 0.5 && shade < 0.2;
      // in the lake: dark, slick
      if (hgt < 0.55) {
        // the wet line at the water: bright where the lit side meets the meniscus
        if (hgt > -0.5 && shade < 0.2) { b.set(x, y, u < 0.62 ? P.cloud[1]! : P.jade[1]!); continue; }
        b.set(x, y, wood(x, y, clamp(0.8 + u * 0.15, 0, 1), false));
        continue;
      }
      if (hgt < pl.wet) {
        const k = 1 - hgt / pl.wet;
        // algae: a ragged band at the top of the wet zone, strands trailing down
        const edge = pl.wet - hgt;
        const strand = vnoise(lx / 1.6, ly / 5, seed + 2);
        if ((edge < 2.5 + 2.5 * vnoise1(lx / 2.2, seed + 3) && strand > 0.3) || strand > 0.84 - k * 0.1) {
          b.set(x, y, tone(P.moss, clamp(0.72 + u * 0.22 + k * 0.1, 0, 1), x, y, 0.35));
          continue;
        }
        t = 0.52 + u * 0.3 + k * 0.12;
        bleach = false;
        if (d >= 1 && hash(x, y, seed + 4) < 0.025) { b.set(x, y, P.stone[3]!); continue; }
      } else if (hgt < pl.moss && u > 0.5 - (pl.moss - hgt) * 0.02) {
        // moss climbing the shade side, thinning upward
        const m = vnoise(lx / 2.4, ly / 2.6, seed + 5);
        if (m > 0.42 + (hgt - pl.wet) / Math.max(1, pl.moss - pl.wet) * 0.35) {
          b.set(x, y, tone(P.moss, clamp(0.38 + u * 0.38, 0, 1), x, y, 0.35));
          continue;
        }
      }
      b.set(x, y, wood(x, y, clamp(t, 0, 1), bleach));
    }
  }
  // a rope lashing round it (a newer pile tied to its old neighbour)
  if (pl.lash > 0 && d >= 0.5) {
    for (let k = 0; k < 3; k++) {
      const yy = pl.lash + k * 2.2;
      const sh = pl.lean * ((pl.foot - yy) / span);
      for (let x = Math.round(c.X(pl.x - pl.hw - 3 + sh)); x < Math.round(c.X(pl.x + pl.hw + 1 + sh)); x++) {
        const Y = Math.round(c.Y(yy + (x - c.X(pl.x)) / (d * 7)));
        b.set(x, Y, ((x + k) & 1) ? P.earth[1]! : P.earth[2]!);
        if (d >= 1) b.set(x, Y + 1, P.earth[4]!);
      }
    }
  }
}

/** A round log standing from y0 to y1 (local px), centre cx, half width hw. Wet near the water. */
export function log(c: PaintCtx, cx: number, y0: number, y1: number, hw: number, water: number, seed: number, cap = false, lean = 0): void {
  pileLog(c, { x: cx, hw, top: y0, foot: y1, lean, wet: 8 + hash1(1, seed) * 12, moss: 14 + hash1(2, seed) * 14, age: 0, back: false, broken: false, lash: 0, k: hash1(3, seed) }, water, seed);
  if (cap) capTop(c, cx + lean, y0, hw, seed);
}

/** A worn, rounded post top: lit dome, a split down it, the odd mossy cap. */
function capTop(c: PaintCtx, cx: number, y0: number, hw: number, seed: number): void {
  const b = c.buf;
  const ch = Math.max(2, hw * 0.75);
  const style = hash1(5, seed);
  for (let y = Math.floor(c.Y(y0 - 1)); y < Math.ceil(c.Y(y0 + ch)); y++) {
    const ly = c.ly(y + 0.5);
    const k = clamp((y0 + ch - ly) / ch, 0, 1);
    const half = hw * (style < 0.35 ? 1 : Math.sqrt(Math.max(0, 1 - k * k)));
    for (let x = Math.round(c.X(cx - hw)); x < Math.round(c.X(cx + hw)); x++) {
      const lx = c.lx(x + 0.5) - cx;
      if (Math.abs(lx) > half) { if (ly < y0 + ch) b.clear(x, y); continue; }
      if (style < 0.35 && ly < y0) continue;
      if (style < 0.35) {
        // a flat, cut top gone grey, a split across it
        b.set(x, y, ly < y0 + 1 ? P.stone[0]! : Math.abs(lx - hw * 0.2) < 0.6 ? P.timber[5]! : wood(x, y, lx < 0 ? 0.1 : 0.4));
        continue;
      }
      const lit = -lx / hw * 0.5 + k * 0.6;
      if (style > 0.8 && k > 0.35 && hash(x >> 1, y, seed) < 0.6) { b.set(x, y, P.moss[lit > 0.3 ? 2 : 4]!); continue; }
      b.set(x, y, wood(x, y, clamp(0.4 - lit * 0.4, 0, 1)));
    }
  }
}

/** A straight timber (a brace) between two points, thickness th, lit along its upper edge. */
export function beamLine(c: PaintCtx, ax: number, ay: number, bx: number, by: number, th: number, seed: number, shade = 0, cut = 1): void {
  const b = c.buf, d = c.d;
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(2, Math.ceil(len * d * 1.5));
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  for (let s = 0; s <= steps * cut; s++) {
    const u = s / steps;
    const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
    // a snapped end: splinters
    const end = cut < 1 && u > cut - 0.05;
    for (let o = -th / 2; o <= th / 2; o += 0.5 / d) {
      if (end && hash(Math.round(o * 4), Math.round(u * 40), seed) < 0.5) continue;
      const X = Math.round(c.X(px + nx * o)), Y = Math.round(c.Y(py + ny * o));
      const k = (o + th / 2) / th;
      let t = (k < 0.25 ? 0.15 : k < 0.7 ? 0.42 : 0.72) + shade;
      if (d >= 1 && hash(Math.floor(u * len / 3), Math.floor(k * 3), seed) < 0.08) t += 0.15;
      b.set(X, Y, wood(X, Y, clamp(t, 0, 1), shade < 0.2));
    }
  }
}

// --- the deck ---------------------------------------------------------------------------------

/**
 * The deck band (plank ends and the stringer) over [x0, x1). lit: the face as she sees it;
 * otherwise the deck as the lake sees it (from below, in its own shadow), inset a pixel so the
 * lit face sprite always covers it.
 */
function paintDeck(c: PaintCtx, plan: JPlan, seed: number, x0: number, x1: number, lit: boolean): void {
  const b = c.buf, d = c.d;
  const X0 = Math.max(b.ox, Math.round(c.X(x0))), X1 = Math.min(b.x1, Math.round(c.X(x1)));
  const inset = lit ? 0 : 1;
  for (let x = X0; x < X1; x++) {
    const lx = c.lx(x + 0.5);
    const pk = plankOf(plan, lx);
    const run = runOf(plan, lx);
    const bot = strBot(plan, lx);
    const top = pk ? pk.drop : 0;
    // planks of their own thickness: the odd one thinner or thicker than its neighbours
    const th = !pk || run.age ? 0 : pk.k < 0.18 ? -1 : pk.k > 0.84 ? 1 : 0;
    const Yt = Math.round(c.Y(top)) + inset, Yd = Math.round(c.Y(DECK + th)), Yb = Math.round(c.Y(bot)) - inset;
    // a water stain running down the stringer from this plank's joint
    const stain = !!pk && d >= 1 && hash1(Math.round(pk.x * 3), seed + 41) < 0.22 && Math.abs(lx - (pk.x + pk.w - 0.6)) < 0.55;
    const stainTo = DECK + (bot - DECK) * (0.35 + 0.6 * hash1(Math.round(pk ? pk.x : 0), seed + 42));
    // the plank's own columns (its right edge is the dark joint to the next one)
    const PX0 = pk ? Math.round(c.X(pk.x)) : X0, PX1 = pk ? Math.round(c.X(pk.x + pk.w)) : X1;
    const missing = !pk || pk.kind === MISSING;
    for (let y = Math.max(Yt, b.oy); y < Math.min(Yb, b.y1); y++) {
      const ly = c.ly(y + 0.5);
      if (y < Yd) {
        // a plank end
        if (missing) continue;
        const v = (y - Yt + 0.5) / Math.max(1, Yd - Yt);
        const u = (x - PX0 + 0.5) / Math.max(1, PX1 - PX0);
        // worn corners: the top corners rounded off
        if (pk.kind === WORN && y === Yt && (x === PX0 || (u > 0.8 && hash1(Math.round(pk.x), seed) < 0.5))) continue;
        if (!lit) {
          // the plank seen from below, in the deck's shadow: softer and darker than its lit end
          let t = 0.42 + pk.t * 0.35 + v * 0.12;
          if (pk.kind === NEWP || run.age) t -= 0.1;
          if (x === PX1 - 1) t += 0.25;
          b.set(x, y, wood(x, y, clamp(t, 0, 1), false));
          continue;
        }
        let t: number;
        const fresh = pk.kind === NEWP || run.age > 0;
        if (x === PX1 - 1 || (d >= 1 && x === PX1 - 2 && bayer4(x, y) < 0.5)) t = 0.95;
        else if (y === Yt) t = fresh ? 0.0 : 0.02;
        else if (x === PX0) t = pk.t - 0.1;
        else {
          t = (fresh ? 0.08 + pk.t * 0.5 : pk.t) + v * 0.2;
          if (v > 0.8) t += 0.14;
          // end grain: rings and checks at the close band, a streak of weather
          if (d >= 1.5) {
            const cxr = pk.x + pk.w * (0.3 + 0.4 * pk.k), cyr = DECK + 2.5;
            const rr = Math.hypot(lx - cxr, (ly - cyr) * 1.4);
            if (((rr * 0.9 + pk.k * 3) % 1) < 0.16) t += 0.1;
            if (hash(x, y, seed + Math.round(pk.x)) < 0.05) t += 0.18;
          }
          if (d >= 1 && vnoise1(lx * 2.5, seed + Math.round(pk.x)) > 0.78) t += 0.1;
          // a split running down from the top
          if (pk.kind === SPLIT && Math.abs(lx - (pk.x + pk.w * (0.35 + 0.3 * pk.k))) < 0.55 / d * Math.max(1, d / 2) && v < 0.72) t = 0.9;
        }
        // a nail head (close band)
        if (d >= 1.5 && pk.k > 0.45 && Math.abs(lx - (pk.x + pk.w * 0.5)) < 0.5 && Math.abs(ly - (DECK - 2)) < 0.5) { b.set(x, y, P.ink[1]!); continue; }
        b.set(x, y, wood(x, y, clamp(t, 0, 1), !fresh));
        continue;
      }
      // the stringer
      const v = (ly - DECK) / Math.max(1, bot - DECK);
      let t: number;
      if (!lit) {
        t = 0.6 + v * 0.14 + run.k * 0.06;
        if (run.age) t -= 0.12;
        if (vnoise(lx / 30, ly / 2, seed + 8) > 0.7) t += 0.06;
        b.set(x, y, wood(x, y, clamp(t, 0, 1), false));
        continue;
      }
      // the shadow under the plank ends (gone where a plank is missing)
      if (ly - DECK - th < 1 && !missing) t = 0.88;
      else if (Yb - y === 1) t = 0.92;
      else {
        t = run.age ? 0.2 + v * 0.18 + run.k * 0.05 : 0.5 + v * 0.18 + run.k * 0.1;
        if (ly - DECK - th < 2.2) t -= 0.12;
        if (d >= 1 && hash(Math.floor(lx / 9), Math.floor(ly * 2), seed + 9) < 0.04) t += 0.2;
        if (stain && ly < stainTo) t += 0.2;
        // an old beam weathers grey in long streaks; algae and moss along its wet underside
        if (!run.age) {
          if (d >= 0.5 && vnoise(lx / 26, ly / 1.7, seed + 8) > 0.64) { b.set(x, y, tone(P.stone, clamp(0.55 + v * 0.3, 0, 1), x, y, 0.3)); continue; }
          if (bot - ly < 2.6 && vnoise(lx / 4, ly, seed + 43) > 0.5) { b.set(x, y, P.moss[bot - ly < 1.2 ? 6 : 5]!); continue; }
        } else if (d >= 0.5 && vnoise(lx / 26, ly / 1.7, seed + 8) > 0.7) t += 0.08;
      }
      // a joint where two runs meet: a butt seam and an iron strap (old to old) or a lashing (to a rebuilt run)
      for (let i = 1; i < plan.runs.length; i++) {
        const jx = plan.runs[i]!.x0;
        const dj = lx - jx;
        if (Math.abs(dj) > 6) continue;
        const toNew = plan.runs[i]!.age !== plan.runs[i - 1]!.age;
        if (Math.abs(dj) < 0.55) t = 0.97;
        else if (!toNew && Math.abs(dj) < 3.2) t = dj < -2 ? 0.55 : 0.75;
        else if (toNew && Math.abs(dj) < 4 && d >= 0.5 && v > 0.2 && v < 0.8) {
          b.set(x, y, ((Math.round(c.ly(y) * 1.2) + Math.round(lx)) & 1) ? P.earth[1]! : P.earth[3]!);
          t = -1;
        }
        if (!toNew && Math.abs(dj) < 3.2 && Math.abs(dj) > 0.55) {
          const iron = Math.abs(dj) < 2.6;
          if (iron) { b.set(x, y, dj < -1.5 ? P.lacquer[2]! : P.ink[1]!); t = -1; }
        }
      }
      if (t < 0) continue;
      // bolts where it bears on a bent, a rust run below (close band)
      for (const bx of plan.bents) {
        if (Math.abs(lx - bx) > 3) continue;
        const by = DECK + (bot - DECK) * 0.48;
        if (d >= 0.5 && Math.abs(lx - bx) < 1 && Math.abs(ly - by) < 0.8) t = -2;
        else if (d >= 1.5 && Math.abs(lx - bx) < 0.5 && ly > by + 0.8 && ly < by + 4 && hash(Math.round(bx), 3, seed) < 0.6) t = -3;
      }
      if (t === -2) { b.set(x, y, P.ink[1]!); continue; }
      if (t === -3) { b.set(x, y, P.earth[3]!); continue; }
      b.set(x, y, wood(x, y, clamp(t, 0, 1), false));
    }
    if (lit && !run.age && d >= 1 && hash(Math.floor(lx * 1.5), 1, seed + 44) < 0.1) {
      const n = Math.round((1 + hash(Math.floor(lx * 1.5), 2, seed + 44) * 3) * d);
      for (let k = 0; k < n; k++) b.set(x, Yb + k, P.moss[k < n / 2 ? 6 : 7]!);
    }
  }
}

/** The see-through slot where a plank is missing: the far stringer's top, deep in shadow. */
function paintSlots(c: PaintCtx, plan: JPlan, x0: number, x1: number): void {
  const b = c.buf;
  for (const pk of plan.planks) {
    if (pk.kind !== MISSING || pk.x + pk.w < x0 || pk.x > x1) continue;
    const X0 = Math.round(c.X(pk.x)), X1 = Math.round(c.X(pk.x + pk.w));
    const Y0 = Math.round(c.Y(DECK - 1.6)), Y1 = Math.round(c.Y(DECK));
    for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
      for (let x = Math.max(X0, b.ox); x < Math.min(X1 - 1, b.x1); x++) b.set(x, y, y === Y0 ? P.timber[4]! : P.timber[6]!);
    }
  }
}

function paintPlate(c: PaintCtx, p: JettyP, plan: JPlan, seed: number): void {
  const water = p.water;
  // the far piles first, darker, behind
  plan.piles.forEach((pl, i) => { if (pl.back) pileLog(c, pl, water, seed + i * 17, 0.3); });
  // the cross-beams' ends on top of the far piles
  plan.piles.forEach((pl, i) => { if (!pl.back) pileLog(c, pl, water, seed + i * 17); });
  for (const hd of plan.heads) {
    const bot = strBot(plan, hd.x);
    const b = c.buf;
    const X0 = Math.round(c.X(hd.x - hd.hw)), X1 = Math.round(c.X(hd.x + hd.hw));
    const Y0 = Math.round(c.Y(bot - 1)), Y1 = Math.round(c.Y(bot + hd.h));
    for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
      for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
        const u = (x - X0 + 0.5) / (X1 - X0), v = (y - Y0 + 0.5) / (Y1 - Y0);
        let t = 0.5 + hd.k * 0.15;
        if (u > 0.88 || v > 0.8) t = 0.86;
        else if (u < 0.12) t = 0.3;
        // end grain rings at the close band
        if (c.d >= 1.5 && Math.abs(Math.hypot((u - 0.5) * 2, (v - 0.4) * 1.4) * 4 % 1 - 0.5) < 0.12) t += 0.12;
        b.set(x, y, wood(x, y, clamp(t, 0, 1), false));
      }
    }
  }
  plan.braces.forEach((br, i) => beamLine(c, br.ax, br.ay, br.bx, br.by, br.th, seed + 300 + i, br.age ? -0.05 : 0.08, br.cut));
}

function paintPosts(c: PaintCtx, p: JettyP, plan: JPlan, seed: number): void {
  const fronts = plan.piles.filter((q) => !q.back && !q.broken);
  for (const [i, up] of p.posts ?? []) {
    const pl = fronts[i];
    if (!pl) continue;
    const lean = pl.lean;
    pileLog(c, { ...pl, top: -up, hw: pl.hw + 1 }, p.water, seed + i * 17);
    capTop(c, pl.x + lean, -up, pl.hw + 1, seed + i);
    postGear(c, pl.x + lean, -up, pl.hw + 1, seed + i, true);
  }
}

/** An iron band near a post's top and a rope wound round it, its end hanging. */
function postGear(c: PaintCtx, x: number, top: number, hw: number, seed: number, rope: boolean): void {
  const b = c.buf, d = c.d;
  const by = top + 6 + hash1(4, seed) * 4;
  for (let x2 = Math.round(c.X(x - hw)); x2 < Math.round(c.X(x + hw)); x2++) {
    for (let y2 = Math.round(c.Y(by)); y2 < Math.round(c.Y(by + 2.2)); y2++) b.set(x2, y2, x2 < c.X(x - hw * 0.3) ? P.lacquer[2]! : P.ink[0]!);
  }
  if (!rope || d < 0.5) return;
  const ry = top + (-top) * 0.4 + 6;
  const turns = 3 + Math.floor(hash1(6, seed) * 3);
  for (let k = 0; k < turns; k++) {
    for (let x2 = Math.round(c.X(x - hw - 1)); x2 < Math.round(c.X(x + hw + 1)); x2++) {
      const Y = Math.round(c.Y(ry + k * 2.4 + (x2 - c.X(x - hw)) / (d * 6)));
      b.set(x2, Y, ((x2 + k) & 1) ? P.earth[1]! : P.earth[2]!);
      b.set(x2, Y + 1, P.earth[4]!);
    }
  }
  // the loose end, hanging in a slack curve, frayed
  const len = 12 + hash1(7, seed) * 12;
  for (let s = 0; s < len; s += 0.5 / d) {
    const X = Math.round(c.X(x + hw + 1 + Math.sin(s / len * 2.2) * 3)), Y = Math.round(c.Y(ry + turns * 2.4 + s));
    b.set(X, Y, P.earth[2]!);
    if (d >= 1) b.set(X + 1, Y, P.earth[4]!);
  }
}

export const jetty = definePainter<JettyP>("op.jetty", {
  bounds(p) {
    if (p.part === "face") return [(p.from ?? -4) - 2, -2, (p.to ?? p.w + 4) + 2, DECK + 30];
    let up = 4;
    for (const [, hgt] of p.posts ?? []) up = Math.max(up, hgt + 4);
    return [-22, -up, p.w + 22, p.water + 30];
  },
  paint(c, p) {
    const seed = p.plan ?? c.seed;
    const plan = jettyPlan(p, seed);
    const part = p.part ?? "all";
    if (part === "face") {
      paintDeck(c, plan, seed, Math.max(-4, p.from ?? -4), Math.min(p.w, p.to ?? p.w), true);
      return;
    }
    paintPlate(c, p, plan, seed);
    paintSlots(c, plan, -4, p.w + 4);
    paintDeck(c, plan, seed, -4, p.w, part === "all");
    paintPosts(c, p, plan, seed);
  },
});

// --- mooring posts, stubs ---------------------------------------------------------------------

export interface PostP {
  /** Height above the deck and depth below it to the water, px. */
  h: number;
  down: number;
  rope?: boolean;
  /** Half width (default 7). */
  hw?: number;
}

/** A free-standing mooring post (on the deck's edge or in the shallows). */
export const post = definePainter<PostP>("op.post", {
  bounds(p) {
    const hw = p.hw ?? 7;
    return [-hw - 6, -p.h - 4, hw + 16, p.down + 28];
  },
  paint(c, p) {
    const hw = p.hw ?? 7;
    const lean = (hash1(1, c.seed) - 0.5) * 7;
    const pl: JPile = { x: 0, hw, top: -p.h, foot: p.down + 24, lean, wet: 6 + hash1(2, c.seed) * 16, moss: 18 + hash1(3, c.seed) * 16, age: 0, back: false, broken: false, lash: 0, k: hash1(4, c.seed) };
    pileLog(c, pl, p.down, c.seed);
    capTop(c, lean, -p.h, hw, c.seed);
    postGear(c, lean * ((p.down + 24 + 7 - p.h) / (p.down + 24 + p.h)) , -p.h, hw, c.seed, !!p.rope);
  },
});

export interface StubP {
  /** Stubs: [x, height above the water, half width, lean px], local to the anchor at the waterline. */
  piles: [number, number, number, number][];
  /** Lily pads around them (count; default 0) and the spread they lie over, px. */
  lilies?: number;
  spread?: number;
  /** A dark clump of sedge at their feet: [width, height] px. */
  sedge?: [number, number];
  /** Darker (wet, in shade), 0..0.4. */
  shade?: number;
}

/**
 * Old piles standing alone in the water, broken off: jagged split tops, a wet band and algae at
 * the water, moss on the shade side; lily pads floating round them. Anchor: the waterline.
 */
export const stub = definePainter<StubP>("op.stub", {
  bounds(p) {
    let x0 = 0, x1 = 0, up = 4;
    for (const [x, hh, hw, ln] of p.piles) {
      x0 = Math.min(x0, x - hw - Math.abs(ln) - 3);
      x1 = Math.max(x1, x + hw + Math.abs(ln) + 3);
      up = Math.max(up, hh + 6);
    }
    const s = Math.max(p.spread ?? 0, (p.sedge?.[0] ?? 0) / 2 + 6);
    return [Math.min(x0, -s - 4), -Math.max(up, (p.sedge?.[1] ?? 0) + 8), Math.max(x1, s + 4), 6];
  },
  paint(c, p) {
    const seed = c.seed;
    if (p.sedge) sedge(c, p.sedge[0], p.sedge[1], seed + 91);
    p.piles.forEach(([x, hh, hw, ln], i) => {
      const k = hash1(i, seed);
      pileLog(c, { x: x + ln, hw, top: -hh, foot: 2, lean: -ln, wet: 4 + k * 8 + (p.shade ?? 0) * 30, moss: 10 + hash1(i, seed + 1) * 12, age: 0, back: false, broken: true, lash: 0, k }, 0, seed + i * 31, p.shade ?? 0);
    });
    lilies(c, p.lilies ?? 0, p.spread ?? 0, seed + 77);
  },
});

/** A low clump of sedge at the waterline round x 0: dark blades arching out, lit tips on the sun's side. */
function sedge(c: PaintCtx, w: number, hh: number, seed: number): void {
  const b = c.buf, d = c.d;
  const n = Math.round(w * 1.4);
  for (let i = 0; i < n; i++) {
    const x0 = (hash1(i, seed) - 0.5) * w;
    const mid = 1 - Math.abs(x0) / (w / 2);
    const len = hh * (0.35 + 0.65 * hash1(i, seed + 1)) * (0.4 + 0.6 * mid);
    const lean = (hash1(i, seed + 2) - 0.5) * 1.4 + x0 / w;
    const back = hash1(i, seed + 3) < 0.45;
    for (let s = 0; s < len; s += 0.5 / d) {
      const t = s / len;
      const X = Math.round(c.X(x0 + lean * s * 0.5 + lean * t * t * len * 0.35)), Y = Math.round(c.Y(-s + t * t * len * 0.25));
      const lit = !back && t > 0.6 && lean < 0.2;
      b.set(X, Y, back ? P.moss[7]! : lit ? P.moss[4]! : t < 0.3 ? P.moss[7]! : P.moss[6]!);
    }
  }
}

/** Lily pads lying on the water round x 0 (side-on: thin dark slivers, a lit rim, the odd bud). */
export function lilies(c: PaintCtx, n: number, spread: number, seed: number): void {
  const b = c.buf, d = c.d;
  for (let i = 0; i < n; i++) {
    const cx = (hash1(i, seed) - 0.5) * 2 * spread, w = 3 + hash1(i, seed + 1) * 6;
    const lift = hash1(i, seed + 2) < 0.3 ? 1 : 0;
    for (let x = Math.round(c.X(cx - w)); x < Math.round(c.X(cx + w)); x++) {
      const u = (c.lx(x + 0.5) - cx) / w;
      if (Math.abs(u) > 1) continue;
      // a notch in each pad
      if (Math.abs(u - 0.15) < 0.12 && hash1(i, seed + 3) < 0.7) continue;
      const th = Math.max(1 / d, (1 - u * u) * 1.4);
      for (let y = Math.round(c.Y(-lift - th * 0.4)); y < Math.round(c.Y(-lift + th * 0.6)); y++) {
        const v = (c.ly(y + 0.5) + lift + th * 0.4) / th;
        b.set(x, y, v < 0.35 ? (u < 0 ? P.moss[2]! : P.moss[3]!) : P.moss[5]!);
      }
    }
    // a bud on a few
    if (hash1(i, seed + 4) < 0.25 && d >= 0.5) {
      const X = Math.round(c.X(cx + w * 0.4));
      for (let y = Math.round(c.Y(-lift - 4)); y < Math.round(c.Y(-lift)); y++) b.set(X, y, P.moss[5]!);
      b.disc(X + 0.5, Math.round(c.Y(-lift - 5)) + 0.5, Math.max(1, d * 1.3), P.blossom[1]!);
    }
  }
}

// --- the lift's top station -----------------------------------------------------------------

export interface StationP {
  /** Height of the roof's ridge above the deck, px. */
  h: number;
  /** Waterline below the deck top, px. */
  water: number;
  /** Where the cables leave the pulley: [x offset of each, y above the deck (negative)]. */
  cable?: [number, number];
}

/**
 * The waterwheel lift's top station: a timber gantry built into the jetty on its own heavy piles,
 * a big spoked pulley hung under its beam with the two cables running off it, down through the
 * deck and into the lake; the winch drum wound with rope on a cross beam beside it, its crank,
 * a stone counterweight; a small roof of dark tiles with upturned eaves and moss in its channels;
 * a paper lantern hanging from the eave. Anchor: the cables' centre on the deck's top.
 */
export const station = definePainter<StationP>("op.station", {
  bounds(p) {
    return [-96, -p.h - 14, 94, p.water + 30];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const H = p.h, water = p.water;
    const [cdx, cy] = p.cable ?? [6, -19.2];
    const top = -H + 66, eave = -H + 50;
    // its own piles: heavier than the jetty's, braced in an X under the deck
    const piles: JPile[] = [
      { x: -55, hw: 6.8, top: 20, foot: water + 24, lean: 0.8, wet: 14, moss: 26, age: 0.2, back: false, broken: false, lash: 0, k: 0.3 },
      { x: -24, hw: 5.4, top: 20, foot: water + 24, lean: -0.6, wet: 9, moss: 15, age: 0.6, back: true, broken: false, lash: 0, k: 0.6 },
      { x: 24, hw: 5.8, top: 20, foot: water + 24, lean: 1.2, wet: 18, moss: 22, age: 0.3, back: true, broken: false, lash: 0, k: 0.8 },
      { x: 52, hw: 7, top: 20, foot: water + 24, lean: -1.4, wet: 11, moss: 30, age: 0.1, back: false, broken: false, lash: 0, k: 0.1 },
    ];
    piles.forEach((pl, i) => { if (pl.back) pileLog(c, pl, water, seed + i * 13, 0.28); });
    beamLine(c, -48, 27, 46, water - 6, 3.8, seed + 1, 0.05);
    beamLine(c, -48, water - 8, 46, 28, 3.6, seed + 2, 0.14);
    piles.forEach((pl, i) => { if (!pl.back) pileLog(c, pl, water, seed + i * 13); });
    const beam = (x0: number, x1: number, y0: number, y1: number, sh: number, s: number, slant = 0): void => {
      for (let y = Math.round(c.Y(y0)); y < Math.round(c.Y(y1)); y++) {
        const v = (c.ly(y + 0.5) - y0) / (y1 - y0);
        for (let x = Math.round(c.X(x0 - v * slant)); x < Math.round(c.X(x1 + v * slant)); x++) {
          const lx = c.lx(x + 0.5);
          let t = (v < 0.2 ? 0.1 : v < 0.62 ? 0.36 : 0.62) + sh;
          if (v > 0.84) t = 0.9;
          if (d >= 0.5 && vnoise(lx / 18, v * 4, s) > 0.68) t += 0.12;
          if (d >= 1 && hash(Math.floor(lx / 7), Math.floor(v * 5), s) < 0.05) t += 0.2;
          if (lx < x0 + 2 || lx > x1 - 2) t += 0.16;
          b.set(x, y, wood(x, y, clamp(t, 0, 1), sh < 0.2));
        }
      }
    };
    // a cap beam across the pile heads under the deck
    beam(-66, 64, 21, 27, 0.3, seed + 3);
    // the gantry: two far posts in shadow, then the frame's beams, then the two near posts
    for (const [px, hw] of [[-48, 4.4], [59, 4.6]] as const) pileLog(c, { x: px, hw, top: top - 6, foot: 1, lean: 0, wet: 0, moss: 0, age: 0.4, back: true, broken: false, lash: 0, k: 0.4 }, water, seed + 20 + px, 0.32);
    // the sill on the deck that the frame stands on
    beam(-66, 64, -6, 0.5, 0.05, seed + 4);
    // the cross beam that carries the drum
    beam(-56, 52, -84, -77, 0.12, seed + 5);
    // the winch drum wound with rope (seen along its axle), its flanges, the crank
    const dx0 = -46, dx1 = -10, dy0 = -104, dy1 = -84;
    for (let y = Math.round(c.Y(dy0)); y < Math.round(c.Y(dy1)); y++) {
      const v = (c.ly(y + 0.5) - dy0) / (dy1 - dy0);
      for (let x = Math.round(c.X(dx0)); x < Math.round(c.X(dx1)); x++) {
        const lx = c.lx(x + 0.5);
        const lit = v < 0.2 ? 0 : v < 0.5 ? 1 : v < 0.82 ? 2 : 4;
        const tw = ((lx * 0.9 + c.ly(y + 0.5) * 0.7) % 2.4 + 2.4) % 2.4;
        let i = lit + 1;
        if (d >= 0.5 && tw < 0.75) i += 1;
        b.set(x, y, P.earth[Math.min(5, i)]!);
      }
    }
    for (const fx of [dx0 - 2, dx1]) {
      for (let y = Math.round(c.Y(dy0 - 4)); y < Math.round(c.Y(dy1 + 1)); y++) {
        for (let x = Math.round(c.X(fx)); x < Math.round(c.X(fx + 2.5)); x++) {
          const v = (c.ly(y + 0.5) - dy0 + 4) / (dy1 - dy0 + 5);
          b.set(x, y, wood(x, y, v < 0.2 ? 0.15 : v > 0.8 ? 0.85 : x === Math.round(c.X(fx)) ? 0.3 : 0.65, false));
        }
      }
    }
    // the crank: an iron arm and a worn handle
    const ckx = dx0 - 3, cky = (dy0 + dy1) / 2;
    for (let s = 0; s <= 13; s += 0.5 / d) b.set(Math.round(c.X(ckx - s * 0.5)), Math.round(c.Y(cky - s * 0.86)), P.ink[1]!);
    for (let s = 0; s <= 7; s += 0.5 / d) b.set(Math.round(c.X(ckx - 6.5 - s)), Math.round(c.Y(cky - 11.2)), s < 2 ? P.timber[2]! : P.timber[4]!);
    // the near posts, from the lake up through the deck's edge to the beam
    for (const [px, hw, s] of [[-56, 5.6, 11], [52, 5.8, 12]] as const) {
      pileLog(c, { x: px, hw, top: top - 4, foot: 21, lean: 0, wet: 0, moss: 0, age: 0.25, back: false, broken: false, lash: 0, k: 0.5 }, water, seed + s);
      // an iron band where it meets the deck, and one under the beam
      for (const by of [-9, top + 8]) {
        for (let y = Math.round(c.Y(by)); y < Math.round(c.Y(by + 2.6)); y++) for (let x = Math.round(c.X(px - hw - 0.5)); x < Math.round(c.X(px + hw + 0.5)); x++) b.set(x, y, x < c.X(px - hw * 0.3) ? P.lacquer[2]! : P.ink[0]!);
      }
    }
    // a diagonal brace in the west bay, knee braces under the beam
    beamLine(c, -51, -8, -20, -76, 3.4, seed + 13, 0.08);
    beamLine(c, -52, top + 34, -30, top + 7, 3.2, seed + 14, 0.05);
    beamLine(c, 48, top + 34, 28, top + 7, 3.2, seed + 15, 0.12);
    // the head beam, its ends sticking out past the posts
    beam(-72, 70, top - 6, top + 6, 0.02, seed + 16, 2);
    // the pulley: a big spoked wheel hung from the beam on a forked iron strap
    const R = 19, pcx = 14, pcy = top + 46;
    for (const sx of [-3, 3]) for (let y = Math.round(c.Y(top + 6)); y < Math.round(c.Y(pcy)); y++) b.set(Math.round(c.X(pcx + sx)), y, sx < 0 ? P.lacquer[1]! : P.ink[0]!);
    // the rope from the drum up over the wheel
    {
      const ax = dx1 - 3, ay = dy0 + 1, bx = pcx - R * 0.72, by = pcy - R * 0.69;
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * d * 1.5);
      for (let i = 0; i <= n; i++) {
        const t = i / n, X = Math.round(c.X(ax + (bx - ax) * t)), Y = Math.round(c.Y(ay + (by - ay) * t));
        b.set(X, Y, P.earth[1]!);
        b.set(X + 1, Y, P.earth[3]!);
      }
    }
    {
      const X0 = Math.floor(c.X(pcx - R - 1)), X1 = Math.ceil(c.X(pcx + R + 1));
      const Y0 = Math.floor(c.Y(pcy - R - 1)), Y1 = Math.ceil(c.Y(pcy + R + 1));
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const ex = c.lx(x + 0.5) - pcx, ey = c.ly(y + 0.5) - pcy;
          const rr = Math.hypot(ex, ey);
          if (rr > R) continue;
          const a = Math.atan2(ey, ex);
          const lit = (-0.62 * ex - 0.78 * ey) / Math.max(1, rr);
          if (rr > R - 2) { b.set(x, y, rr > R - 0.8 ? P.ink[0]! : lit > 0.25 ? P.lacquer[0]! : P.lacquer[2]!); continue; }
          if (rr > R - 4.6) { b.set(x, y, wood(x, y, clamp(0.42 - lit * 0.3 + (hash(Math.round(a * 9), 1, seed) < 0.2 ? 0.2 : 0), 0, 1))); continue; }
          if (rr < 3.4) { b.set(x, y, rr < 1.5 ? P.ink[0]! : P.lacquer[1]!); continue; }
          // eight spokes
          const sp = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5);
          if (sp > 0.5 - 1.5 / Math.max(2, rr)) b.set(x, y, wood(x, y, clamp(0.34 - lit * 0.25, 0, 1)));
        }
      }
    }
    // the two cables running off the wheel, down through the deck to where the lake takes them
    const slope = 0.135;
    for (const off of [-cdx, cdx]) {
      const x0 = off + slope * (cy - (pcy + 6));
      const yTop = pcy + Math.sqrt(Math.max(0, R * R - (x0 - pcx) * (x0 - pcx))) - 2;
      for (let y = Math.round(c.Y(yTop)); y < Math.round(c.Y(cy + 0.5)); y++) {
        const ly = c.ly(y + 0.5);
        b.set(Math.round(c.X(off + slope * (cy - ly))), y, P.lacquer[3]!);
      }
    }
    // a stone counterweight on a rope from the beam's west end
    const wx = -68;
    for (let y = Math.round(c.Y(top + 6)); y < Math.round(c.Y(top + 70)); y++) b.set(Math.round(c.X(wx)), y, P.earth[(y & 1) ? 2 : 3]!);
    for (let y = Math.round(c.Y(top + 70)); y < Math.round(c.Y(top + 87)); y++) {
      const v = (c.ly(y + 0.5) - top - 70) / 17;
      const half = 5.5 + Math.sin(v * Math.PI) * 1.6;
      for (let x = Math.round(c.X(wx - half)); x < Math.round(c.X(wx + half)); x++) {
        const u = (c.lx(x + 0.5) - wx + half) / (2 * half);
        if ((v < 0.08 || v > 0.94) && (u < 0.1 || u > 0.9)) continue;
        let t = u < 0.25 ? 0.15 : u < 0.7 ? 0.4 : 0.7;
        if (vnoise(c.lx(x) / 2, c.ly(y) / 2, seed + 17) > 0.7) { b.set(x, y, P.moss[4]!); continue; }
        if (v > 0.85) t += 0.15;
        b.set(x, y, tone(P.stone, clamp(t, 0, 1), x, y, 0.3));
      }
    }
    // the roof: dark tiles in runs, upturned eaves, a ridge with curled ends, moss in the channels
    const rx0 = -90, rx1 = 86;
    const eaveAt = (lx: number): number => {
      const e = Math.abs((lx - rx0) / (rx1 - rx0) - 0.5) * 2;
      return eave - Math.pow(Math.max(0, e - 0.55) / 0.45, 2.2) * 16;
    };
    {
      const X0 = Math.round(c.X(rx0 - 4)), X1 = Math.round(c.X(rx1 + 4));
      for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
        const lx = c.lx(x + 0.5);
        const u = (lx - rx0) / (rx1 - rx0);
        if (u < -0.02 || u > 1.02) continue;
        const e = Math.abs(u - 0.5) * 2;
        const rtop = e < 0.72 ? -H + 8 : -H + 8 + (e - 0.72) / 0.28 * (eave - (-H + 8)) * 0.85;
        const bot = eaveAt(lx);
        for (let y = Math.round(c.Y(rtop)); y < Math.round(c.Y(bot)); y++) {
          const ly = c.ly(y + 0.5);
          const v = (ly - rtop) / Math.max(1, bot - rtop);
          const col = (lx + v * 8 * (u - 0.5)) / 5.2;
          const f = col - Math.floor(col);
          let t = (f < 0.25 ? 0.1 : f < 0.7 ? 0.38 : 0.7) + v * 0.25;
          if (bot - ly < 3.2) t = (Math.floor(col) & 1) ? 0.85 : 0.6;
          if (bot - ly < 1.2) t = 0.98;
          if (d >= 0.5 && (Math.round(ly) % 6) === 0 && f > 0.2) t += 0.12;
          const m = vnoise(lx / 6, ly / 3, seed + 18);
          if (v > 0.3 && f > 0.6 && m > 0.66 - v * 0.15) { b.set(x, y, tone(P.moss, 0.55 + v * 0.3, x, y, 0.35)); continue; }
          if (hash(Math.floor(col), Math.floor(ly / 6), seed + 19) < 0.025) t = 0.98;
          b.set(x, y, tone(P.tile, clamp(t + 0.12, 0, 1), x, y, 0.3));
        }
        // the shadow under the eaves, rafter ends in it
        for (let y = Math.round(c.Y(bot)); y < Math.round(c.Y(Math.max(bot + 4, top - 6))); y++) {
          if ((lx < -70 || lx > 66) && c.ly(y + 0.5) > bot + 3) continue;
          const rafter = ((lx / 7) % 1 + 1) % 1 < 0.35;
          b.set(x, y, c.ly(y + 0.5) < bot + 3 && rafter ? P.timber[4]! : P.timber[6]!);
        }
      }
      for (let x = Math.round(c.X(rx0 + 22)); x < Math.round(c.X(rx1 - 22)); x++) {
        const u = (c.lx(x + 0.5) - rx0 - 22) / (rx1 - rx0 - 44);
        const curl = Math.pow(Math.max(0, Math.abs(u - 0.5) * 2 - 0.86) / 0.14, 2) * 7;
        for (let y = Math.round(c.Y(-H + 1 - curl)); y < Math.round(c.Y(-H + 9)); y++) {
          const v = (c.ly(y + 0.5) - (-H + 1 - curl)) / (8 + curl);
          b.set(x, y, v < 0.2 ? P.tile[1]! : v < 0.65 ? P.tile[3]! : P.tile[5]!);
        }
      }
    }
    // the lantern: paper on a cord from the east eave (no lettering)
    {
      const lx0 = 74, ly0 = eaveAt(74) + 2;
      for (let y = Math.round(c.Y(ly0)); y < Math.round(c.Y(ly0 + 10)); y++) b.set(Math.round(c.X(lx0)), y, P.ink[0]!);
      const cyl = ly0 + 10 + 11, rx = 8, ry = 11;
      for (let y = Math.round(c.Y(cyl - ry - 2)); y < Math.round(c.Y(cyl + ry + 2)); y++) {
        for (let x = Math.round(c.X(lx0 - rx - 1)); x < Math.round(c.X(lx0 + rx + 1)); x++) {
          const ex = (c.lx(x + 0.5) - lx0) / rx, ey = (c.ly(y + 0.5) - cyl) / ry;
          if (Math.abs(ey) > 1.08) continue;
          if (Math.abs(ey) > 0.9) { if (Math.abs(ex) < 0.55) b.set(x, y, P.lacquer[2]!); continue; }
          if (ex * ex + ey * ey * 0.7 > 1) continue;
          const rib = d >= 0.5 && ((c.ly(y + 0.5) - cyl + 30) % 3.6) < 0.7;
          let t = ex < -0.45 ? 0.05 : ex < 0.25 ? 0.25 : 0.55;
          if (rib) t += 0.25;
          b.set(x, y, tone(P.paper, clamp(t, 0, 1), x, y, 0.3));
        }
      }
      for (let y = Math.round(c.Y(cyl + ry + 2)); y < Math.round(c.Y(cyl + ry + 9)); y++) b.set(Math.round(c.X(lx0)), y, P.red[3]!);
    }
  },
});

// --- the landings -----------------------------------------------------------------------------

export interface LandingP {
  /** "west": a step down to the shore's grass; "east": the deck's end on a stone crib against the rock. */
  end: "west" | "east";
  /** The ground under the jetty's end: local polyline [x, y, ...] (y below the deck top). */
  ground: number[];
  /** Waterline below the deck top, px. */
  water: number;
  /** Piles standing in the ground here: their x and half widths (mud and stones bank up round their feet). */
  feet?: [number, number][];
}

/** A rough stone: a lumpy outline, lit up-left, mossy on top. */
function stone(c: PaintCtx, cx: number, by: number, w: number, h: number, seed: number, moss = 0.5, wet = -1): void {
  const b = c.buf;
  const X0 = Math.floor(c.X(cx - w / 2 - 1)), X1 = Math.ceil(c.X(cx + w / 2 + 1));
  for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
    const lx = c.lx(x + 0.5) - cx;
    const u = lx / (w / 2);
    if (Math.abs(u) > 1) continue;
    const top = by - h * Math.pow(1 - Math.pow(Math.abs(u), 2.2), 0.55) * (0.85 + 0.3 * vnoise1(lx / 3 + seed, seed));
    for (let y = Math.max(Math.round(c.Y(top)), b.oy); y < Math.min(Math.round(c.Y(by)), b.y1); y++) {
      const ly = c.ly(y + 0.5);
      const v = (ly - top) / Math.max(1, by - top);
      let t = 0.2 + v * 0.35 + (u > 0.3 ? 0.25 : u < -0.4 ? -0.1 : 0);
      if (vnoise(lx / 2.5, ly / 2.5, seed + 1) > 0.72) t += 0.12;
      if (v < 0.35 && vnoise(lx / 3, ly / 2, seed + 2) > 0.62 - moss * 0.3) { b.set(x, y, tone(P.moss, clamp(0.25 + v + (u > 0 ? 0.25 : 0), 0, 1), x, y, 0.35)); continue; }
      if (wet >= 0 && ly > wet) t += 0.25;
      b.set(x, y, tone(P.karst, clamp(0.3 + t * 0.7, 0, 1), x, y, 0.3));
    }
  }
}

export const landing = definePainter<LandingP>("op.landing", {
  bounds(p) {
    return p.end === "west" ? [-60, -6, 130, p.water + 14] : [-150, -6, 40, p.water + 26];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const water = p.water;
    const g = (x: number): number => yAt(p.ground, x);
    // mud banked round each pile's foot, wet and dark near the water
    for (const [fx, hw] of p.feet ?? []) {
      const gy = g(fx);
      if (gy > water + 2) continue;
      for (let x = Math.round(c.X(fx - hw - 7)); x < Math.round(c.X(fx + hw + 7)); x++) {
        const u = (c.lx(x + 0.5) - fx) / (hw + 7);
        const mound = (1 - u * u) * 4.5 * (0.7 + 0.3 * vnoise1(c.lx(x) / 2, seed));
        for (let y = Math.round(c.Y(gy - mound)); y < Math.round(c.Y(gy + 2)); y++) {
          const ly = c.ly(y + 0.5);
          const wet = ly > water - 6;
          b.set(x, y, tone(P.earth, clamp(0.55 + (wet ? 0.3 : 0) + (ly - gy + mound) / 12, 0, 1), x, y, 0.4));
        }
      }
      stone(c, fx - hw - 4, gy + 1.5, 7 + hash1(Math.round(fx), seed) * 5, 4 + hash1(Math.round(fx), seed + 1) * 3, seed + Math.round(fx), 0.6, water - 2);
      stone(c, fx + hw + 3, gy + 1.5, 5 + hash1(Math.round(fx), seed + 2) * 4, 3 + hash1(Math.round(fx), seed + 3) * 2, seed + Math.round(fx) + 5, 0.4, water - 2);
    }
    if (p.end === "west") {
      // the step down to the grass: a split log laid on two stones, worn pale on top
      const gy = g(-20);
      stone(c, -29, gy + 2, 11, gy + 2 - 17, seed + 3, 0.7);
      stone(c, -10, g(-10) + 2, 9, g(-10) + 2 - 18, seed + 7, 0.5);
      stone(c, -44, g(-44) + 2, 13, 7, seed + 4, 0.9);
      for (let y = Math.round(c.Y(11)); y < Math.round(c.Y(18)); y++) {
        const v = (c.ly(y + 0.5) - 11) / 7;
        for (let x = Math.round(c.X(-36 + v * 1.5)); x < Math.round(c.X(-4 - v)); x++) {
          const lx = c.lx(x + 0.5);
          let t = v < 0.16 ? 0.02 : v < 0.5 ? 0.25 : v < 0.82 ? 0.5 : 0.85;
          if (d >= 0.5 && vnoise(lx / 7, v * 3, seed + 8) > 0.7) t += 0.12;
          if (lx < -34 || lx > -6) t = Math.max(t, 0.6);
          b.set(x, y, wood(x, y, clamp(t, 0, 1)));
        }
      }
      // the sill: a squared timber under the deck's end, sunk in the turf, its end grain showing
      const sx = 3, sy = g(3);
      for (let y = Math.round(c.Y(DECK + 13)); y < Math.round(c.Y(sy + 4)); y++) {
        for (let x = Math.round(c.X(sx - 7)); x < Math.round(c.X(sx + 7)); x++) {
          const u = (c.lx(x + 0.5) - sx + 7) / 14, v = (c.ly(y + 0.5) - DECK - 13) / Math.max(1, sy + 4 - DECK - 13);
          let t = u < 0.15 ? 0.3 : u > 0.85 ? 0.85 : 0.55;
          if (c.d >= 1.5 && Math.abs(Math.hypot(u - 0.5, (v - 0.4) * 0.8) * 7 % 1 - 0.5) < 0.12) t += 0.1;
          if (v > 0.75) t += 0.15;
          b.set(x, y, wood(x, y, clamp(t, 0, 1), false));
        }
      }
      // grass tufts where the shore meets the step and the sill
      for (let i = 0; i < 9; i++) {
        const tx = -50 + i * 11 + hash1(i, seed + 5) * 8;
        const ty = g(tx);
        if (ty > water - 4) continue;
        const n = 4 + Math.floor(hash1(i, seed + 6) * 4);
        for (let k = 0; k < n; k++) {
          const a = (hash1(k, seed + i * 7) - 0.5) * 1.6, len = 4 + hash1(k, seed + i * 9) * 7;
          for (let s = 0; s < len; s += 0.5 / d) b.set(Math.round(c.X(tx + Math.sin(a) * s)), Math.round(c.Y(ty - Math.cos(a) * s)), s > len * 0.6 ? P.moss[k & 1 ? 2 : 1]! : P.moss[4]!);
        }
      }
      // a fallen branch half in the water
      for (let s = 0; s < 34; s += 0.5 / d) {
        const X = Math.round(c.X(64 + s)), Y = Math.round(c.Y(water - 2.5 + s * 0.06 + Math.sin(s / 5) * 0.6));
        b.set(X, Y, P.stone[2]!);
        b.set(X, Y + 1, P.timber[4]!);
        if (Math.abs(s - 12) < 0.3) for (let k = 0; k < 6; k += 0.5 / d) b.set(Math.round(c.X(76 + k * 0.5)), Math.round(c.Y(water - 3 - k)), P.timber[3]!);
      }
      return;
    }
    // east: the deck's end sits on a crib of rough stones stacked on the rock shelf against the
    // road's rock; driftwood and mossy stones where the timber meets the rock
    const cx = -14;
    const sy = g(cx);
    const rows = [[cx - 2, sy + 2, 22, 9], [cx + 4, sy - 6, 18, 8], [cx - 3, sy - 13, 20, 8], [cx + 2, sy - 19, 16, 6]] as const;
    rows.forEach(([x, y, w, h], i) => { if (y - h > DECK + 13) stone(c, x, y, w, h, seed + 20 + i, i === rows.length - 1 ? 0.2 : 0.55, water - 1); });
    // the landing: a cut stone slab level with the deck, laid from the last plank onto the road's rock
    for (let y = Math.round(c.Y(0)); y < Math.round(c.Y(9)); y++) {
      const v = c.ly(y + 0.5) / 9;
      for (let x = Math.round(c.X(-2)); x < Math.round(c.X(20 - v * 2)); x++) {
        const u = (c.lx(x + 0.5) + 2) / 22;
        if (v < 0.15 && (u < 0.04 || u > 0.94)) continue;
        let t = v < 0.14 ? 0.05 : v < 0.6 ? 0.3 : 0.55;
        if (u > 0.9) t += 0.2;
        if (vnoise(c.lx(x) / 3, c.ly(y) / 2, seed + 11) > 0.7) { b.set(x, y, P.moss[v < 0.3 ? 2 : 4]!); continue; }
        b.set(x, y, tone(P.stone, clamp(t, 0, 1), x, y, 0.3));
      }
    }
    // a timber sill on the crib carrying the stringer's end
    for (let y = Math.round(c.Y(DECK + 14)); y < Math.round(c.Y(DECK + 20)); y++) {
      for (let x = Math.round(c.X(cx - 14)); x < Math.round(c.X(cx + 12)); x++) {
        const v = (c.ly(y + 0.5) - DECK - 14) / 6;
        b.set(x, y, wood(x, y, v < 0.25 ? 0.2 : v > 0.8 ? 0.85 : 0.55, false));
      }
    }
    // driftwood lying along the shelf at the water's edge, silvered, a broken branch up
    for (let s = 0; s < 52; s += 0.5 / d) {
      const X = Math.round(c.X(-118 + s)), base = g(-118 + s);
      const yy = Math.min(base, water) - 2 + Math.sin(s / 9) * 0.8;
      for (let o = 0; o < 3; o += 0.5 / d) b.set(X, Math.round(c.Y(yy + o)), o < 1 ? P.stone[1]! : o < 2 ? P.stone[3]! : P.timber[5]!);
    }
    for (let k = 0; k < 9; k += 0.5 / d) b.set(Math.round(c.X(-86 + k * 0.45)), Math.round(c.Y(Math.min(g(-86), water) - 3 - k)), P.stone[2]!);
    // mossy stones along the shelf
    for (let i = 0; i < 6; i++) {
      const x = -136 + i * 21 + hash1(i, seed + 30) * 10;
      const y = g(x);
      if (y > water + 3) continue;
      stone(c, x, Math.min(y, water) + 1.5, 6 + hash1(i, seed + 31) * 8, 3 + hash1(i, seed + 32) * 4, seed + 40 + i, 0.7, water - 1);
    }
    void bayer4;
  },
});

// --- Pilgrims' Leap ---------------------------------------------------------------------------

export interface PlankP {
  /** Length, px; anchor at the plank's top-left. */
  w: number;
  t?: number;
}

/** Pilgrims' Leap: one long weathered plank jutting over the drop, lashed down, worn on top. */
export const plank = definePainter<PlankP>("op.plank", {
  bounds(p) {
    return [-4, -2, p.w + 6, (p.t ?? 8) + 16];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const th = p.t ?? 8;
    const XE = Math.round(c.X(p.w));
    const X0 = Math.max(b.ox, Math.round(c.X(0))), X1 = Math.min(b.x1, XE);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      // it sags a little toward its free end
      const sag = Math.pow(Math.max(0, lx / p.w - 0.4) / 0.6, 2) * 2;
      const Y0 = Math.round(c.Y(sag)), Y1 = Math.round(c.Y(sag + th));
      for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
        const v = (y - Y0 + 0.5) / Math.max(1, Y1 - Y0);
        let t = v < 0.15 ? 0.05 : v < 0.6 ? 0.3 : 0.55;
        if (d >= 0.5 && vnoise(lx / 18, v * 4, seed) > 0.7) t += 0.12;
        if (x === XE - 1 || y === Y1 - 1) t = 0.92;
        b.set(x, y, wood(x, y, clamp(t, 0, 1)));
      }
    }
    // rope lashings at its root, and a knot hanging from the outer one
    for (const fx of [0.08, 0.2]) {
      const lx = p.w * fx;
      for (let y = Math.round(c.Y(-1)); y < Math.round(c.Y(th + 3)); y++) {
        for (let x = Math.round(c.X(lx - 2)); x < Math.round(c.X(lx + 2)); x++) b.set(x, y, ((x + y) & 1) ? P.earth[1]! : P.earth[3]!);
      }
    }
    for (let s = 0; s < 10; s += 0.5 / d) b.set(Math.round(c.X(p.w * 0.2 + 1 + s * 0.2)), Math.round(c.Y(th + 3 + s)), P.earth[2]!);
  },
});

export interface RopeP {
  /** The far end, px from the anchor; sag as a share of the length (default 0.12). */
  dx: number;
  dy: number;
  sag?: number;
}

/** A mooring line: a slack rope between two points, lit along its top, fibres at the close band. */
export const rope = definePainter<RopeP>("op.rope", {
  bounds(p) {
    const sag = Math.hypot(p.dx, p.dy) * (p.sag ?? 0.12);
    return [Math.min(0, p.dx) - 4, Math.min(0, p.dy) - 4, Math.max(0, p.dx) + 4, Math.max(0, p.dy) + sag + 4];
  },
  paint(c, p) {
    const len = Math.hypot(p.dx, p.dy);
    const sag = len * (p.sag ?? 0.12);
    const n = Math.max(8, Math.ceil(len * c.d * 1.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = p.dx * t, y = p.dy * t + Math.sin(t * Math.PI) * sag;
      const X = Math.round(c.X(x)), Y = Math.round(c.Y(y));
      c.buf.set(X, Y, P.earth[c.d >= 1.5 && (X + Y) % 3 === 0 ? 1 : 2]!);
      if (c.d >= 1) c.buf.set(X, Y + 1, P.earth[4]!);
    }
  },
});

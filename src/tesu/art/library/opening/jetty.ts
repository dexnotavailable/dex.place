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
import { LX, LY, bladePath, dot, grass, stroke } from "./bank.ts";
import { chunkTop, limeChunk, type LimeChunk } from "./face.ts";

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

/**
 * Silvered old timber, lit to dark (art loop round 3: wood is wood). Sun and rain bleach old
 * lake timber to a pale grey-brown, never to stone: the earth ramp's pale steps where it is lit
 * and dry, its mid steps in the body, umber in its shade. The stone ramp never touches wood.
 */
const SILVER = [P.earth[0]!, P.earth[1]!, P.earth[2]!, P.earth[3]!, P.umber[0]!, P.umber[1]!, P.umber[2]!, P.umber[3]!];
/** Wet timber at the waterline and below the deck's drip line: dark brown, never black. */
const WET = [P.timber[4]!, P.umber[1]!, P.timber[5]!, P.umber[3]!, P.timber[6]!];

/** Weathered timber: a tone t (0 lit .. 1 dark), silvered (pale earth and umber) where old and dry, else warm timber. */
export function wood(x: number, y: number, t: number, bleach = true, band = -1): number {
  if (bleach) return tone(SILVER, clamp(0.06 + t * 0.94, 0, 1), x, y, band < 0 ? 0.14 : band);
  return tone(P.timber, clamp(0.28 + t * 0.72, 0, 1), x, y, band < 0 ? 0.16 : band);
}

/** Wet timber (t 0 just wet .. 1 soaked and in shade). */
function wetWood(x: number, y: number, t: number): number {
  return tone(WET, clamp(t, 0, 1), x, y, 0.3);
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
export interface JPlank {
  x: number; w: number; t: number; kind: number; drop: number; k: number;
  /** Silvered end grain (pale earth and umber) or brown timber: one per batch of boards, never alternating. */
  bleach?: boolean;
  /** The joint at its right end: 0 tight (a hairline), 1 a dark slit, 2 open (sky shows through). */
  gap?: number;
  /** Thicker (+1) or thinner (-1) than its neighbours: its end reaches lower or shows the beam's top. */
  th?: number;
  /** A loose board end hanging down over the beam's face, px (0: none). */
  hang?: number;
}
export interface JBrace { ax: number; ay: number; bx: number; by: number; th: number; cut: number; age: number; k: number }
export interface JHead { x: number; hw: number; h: number; k: number }
/** A short sister board bolted under the stringer (a repair): [x0, x1, depth px]. */
export type JSister = [number, number, number];
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
  /** Sister boards under the stringer. */
  sisters: JSister[];
}

/** Planks kinds. */
const MISSING = 1, SPLIT = 3, WORN = 4;

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
      runs.push({ x0: x, x1: Math.min(w + 4, x + len), depth: isNew ? 9 + Math.round(r()) : 10 + Math.round(r() * 2.4), age: isNew ? 1 : 0, drop: !isNew && r() < 0.3 ? 1 : 0, k: r() });
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
      // the beam sags between the bents that carry it: 2 to 6 px at mid bay on the long ones
      bays.push([a, b, L < 34 ? 0.4 : clamp((L - 26) / 80, 0.3, 1) * (2 + r() * 4)]);
      // braces on some bays only, of their own kinds: a full diagonal (the odd one snapped), knee
      // braces up under the beam, now and then a crossed pair
      if (L > 64 && r() < 0.24 && !(p.west && a < 60) && !(p.east && b > w - 50)) {
        const down = r() < 0.5;
        const k = r();
        const kind = r();
        const yTop = DECK + 15 + r() * 3, yBot = water - 6 - r() * 9;
        if (kind < 0.5) {
          braces.push({ ax: a + 3, ay: down ? yTop : yBot, bx: b - 3, by: down ? yBot : yTop, th: 4.2 + r() * 1.8, cut: k < 0.2 ? 0.45 + r() * 0.3 : 1, age: runAt(a).age, k: r() });
          if (k > 0.88) braces.push({ ax: a + 3, ay: down ? yBot : yTop, bx: b - 3, by: down ? yTop : yBot, th: 3.8, cut: 1, age: 1, k: r() });
        } else {
          // knees: short struts from a pile up to the beam, at one end of the bay or both
          const kl = 14 + r() * 10, kd = 12 + r() * 8;
          if (kind < 0.8 || r() < 0.5) braces.push({ ax: a + 3, ay: DECK + 11 + kd, bx: a + 3 + kl, by: DECK + 11, th: 3.6 + r() * 1.2, cut: 1, age: runAt(a).age, k: r() });
          if (kind >= 0.8 || r() < 0.4) braces.push({ ax: b - 3, ay: DECK + 11 + kd, bx: b - 3 - kl, by: DECK + 11, th: 3.6 + r() * 1.2, cut: 1, age: runAt(b).age, k: r() });
        }
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
    // the planks, laid in batches the way the boards came (a load from one tree, a later repair):
    // runs of related boards, each its own width, tone and wear within its batch, then a change.
    // Silvered old boards, weathered brown ones, warm new ones; never alternating board by board.
    const planks: JPlank[] = [];
    let px = -4;
    let last = 0;
    let left = 0, bAge = -1, bt = 0.2, bBleach = true, bw0 = 7, bw1 = 12;
    while (px < w + 4) {
      const run = runAt(px);
      if (left <= 0 || run.age !== bAge) {
        bAge = run.age;
        const u = r();
        if (run.age) {
          // a rebuilt run: new boards from one load, warm and pale, the odd old board reused
          if (u < 0.8) { bt = 0.05 + r() * 0.1; bBleach = false; bw0 = 7.5; bw1 = 12; left = 8 + Math.floor(r() * 22); }
          else { bt = 0.2 + r() * 0.08; bBleach = true; bw0 = 6; bw1 = 13; left = 1 + Math.floor(r() * 3); }
        } else if (u < 0.56) { bt = 0.24 + r() * 0.14; bBleach = true; bw0 = 6; bw1 = 14; left = 5 + Math.floor(r() * 17); }
        else if (u < 0.86) { bt = 0.4 + r() * 0.08; bBleach = false; bw0 = 6; bw1 = 11; left = 3 + Math.floor(r() * 9); }
        else { bt = 0.12 + r() * 0.1; bBleach = false; bw0 = 8; bw1 = 11.5; left = 1 + Math.floor(r() * 3); }
      }
      left--;
      const pw = bw0 + r() * (bw1 - bw0);
      const u = r();
      // (round 3) one or two boards gone per view, not a gap every few metres
      let kind = u < 0.011 ? MISSING : u < 0.1 ? SPLIT : u < 0.3 ? WORN : 0;
      if (kind === MISSING && (last === MISSING || px < 60 || px > w - 60 || inGap(px, 20))) kind = WORN;
      const g = r();
      // (round 3) a board's tone drifts slowly along its batch (the same tree, the same weather),
      // with only a small step from its neighbour; the odd board stands out
      const drift = (vnoise1(px / 70, seed + 5) - 0.5) * 0.14;
      planks.push({
        x: px, w: pw, t: clamp(bt + drift + (r() - 0.5) * 0.06 + (r() < 0.08 ? 0.12 : 0), 0, 0.62), kind, drop: run.drop || r() < (run.age ? 0.05 : 0.16) ? 1 : 0, k: r(),
        bleach: bBleach,
        // joints: a few open, some a dark slit, the rest a hairline or butted tight (no ruled grid)
        gap: g < 0.03 && !inGap(px, 20) && px > 40 && px < w - 40 ? 2 : g < 0.16 ? 1 : 0,
        th: !run.age && r() < 0.17 ? (r() < 0.55 ? 1 : -1) : 0,
        hang: !run.age && kind !== MISSING && r() < 0.022 && !inGap(px, 30) ? 4 + r() * 6 : 0,
      });
      last = kind;
      px += pw;
    }
    // (round 3) the deck sags a pixel over the widest spans: the boards there sit one lower
    {
      const wide = bays.filter(([a, b]) => !inGap((a + b) / 2)).sort((q, z) => (z[1] - z[0]) - (q[1] - q[0])).slice(0, 3);
      for (const pk of planks) {
        const mid = pk.x + pk.w / 2;
        for (const [a, b] of wide) if (mid > a + (b - a) * 0.22 && mid < b - (b - a) * 0.22) pk.drop = 1;
      }
    }
    // sister boards bolted under the old stringer where it split (short, their own depth)
    const sisters: JSister[] = [];
    for (const [a, b] of bays) {
      if (b - a < 70 || r() > 0.12 || runAt(a).age) continue;
      const s0 = a + (b - a) * (0.1 + r() * 0.3);
      sisters.push([s0, Math.min(b - 6, s0 + 38 + r() * 46), 3 + Math.round(r() * 1.6)]);
    }
    return { piles, bents, runs, planks, braces, heads, bays, sisters };
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

/** How far the stringer has sagged at x, between the bents that carry it (0 at a bent). */
function baySag(plan: JPlan, x: number): number {
  const bays = plan.bays;
  let lo = 0, hi = bays.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const [a, b, s] = bays[m]!;
    if (x < a) hi = m - 1;
    else if (x > b) lo = m + 1;
    else return s * Math.sin(Math.PI * (x - a) / (b - a));
  }
  return 0;
}

/** The kink where an old run meets a rebuilt one: the old beam's end has dropped on its bolt. */
function kinkAt(plan: JPlan, x: number): number {
  let y = 0;
  for (let i = 1; i < plan.runs.length; i++) {
    const a = plan.runs[i - 1]!, q = plan.runs[i]!;
    if (a.age === q.age) continue;
    const dj = x - q.x0;
    if (Math.abs(dj) > 34) continue;
    if (dj < 0 ? !a.age : !q.age) y += 3.2 * Math.pow(1 - Math.abs(dj) / 34, 2);
  }
  return y;
}

/** The stringer's top at x: it has dropped away from the boards mid bay (a dark lens between them). */
function strTop(plan: JPlan, x: number): number {
  return DECK + 0.55 * baySag(plan, x) + 0.6 * kinkAt(plan, x);
}

/** The stringer's underside at x (it sags between the bents that carry it, rotted, kinked). */
function strBot(plan: JPlan, x: number): number {
  const run = runOf(plan, x);
  let y = DECK + run.depth;
  const rs = Math.round(run.k * 997);
  // an old beam's underside is rotted and splintered in places: a slow wander, lumps, bites
  if (!run.age) y += (vnoise1(x / 23, rs + 3) - 0.5) * 1.6 + (vnoise1(x / 6, rs) - 0.5) * 1.8 - (hash1(Math.floor(x / 4), rs - 6) < 0.06 ? 1.2 : 0);
  else y += (vnoise1(x / 31, rs + 3) - 0.5) * 0.7;
  return y + kinkAt(plan, x) + baySag(plan, x);
}

// --- piles ------------------------------------------------------------------------------------

/**
 * A round log standing from top to foot (local px), centre pl.x at the top, half width hw, seen
 * side-on: its own outline (a touch thicker toward its top, eaten in at the wet line, old bark
 * ridges along its edges), shaded as a cylinder lit from the upper left (the lit edge, the
 * highlight a little in from it, the core shadow right of centre, a rim of the lake's light on the
 * far edge), silvered where dry, dark and slick in its wet band with a sheen down the lit side,
 * algae trailing from the band's top, moss climbing its shade side, a bright wet line at the water.
 */
export function pileLog(c: PaintCtx, pl: JPile, water: number, seed: number, shade = 0): void {
  const b = c.buf, d = c.d;
  const Y0 = Math.floor(c.Y(pl.top)), Y1 = Math.ceil(c.Y(pl.foot));
  const reach = Math.abs(pl.lean) + pl.hw * 1.25 + 2;
  if (!b.touches(Math.floor(c.X(pl.x - reach)), Y0 - 2, Math.ceil(c.X(pl.x + reach)), Y1)) return;
  const span = Math.max(1, pl.foot - pl.top);
  const ks = seed + Math.round(pl.k * 9973);
  for (let y = Math.max(Y0 - 2, b.oy); y < Math.min(Y1, b.y1); y++) {
    const ly = c.ly(y + 0.5);
    const sh = pl.lean * ((pl.foot - ly) / span);
    const hgt = water - ly;
    // the log's outline: thicker toward its top (piles go in tip first), a waist where the wet
    // line has eaten it, bark ridges and knots along its edges
    let hw = pl.hw * (0.96 + 0.08 * clamp((pl.foot - ly) / span, 0, 1));
    if (pl.age < 0.5 && !pl.back && !pl.broken) hw -= Math.min(pl.hw * 0.14, 0.8) * Math.exp(-Math.pow((hgt - pl.wet) / 2.6, 2));
    const eL = (vnoise1(ly / 3.1, ks + 1) - 0.5) * 0.8 + (vnoise1(ly / 13, ks + 2) - 0.5) * 0.7;
    const eR = (vnoise1(ly / 3.4, ks + 3) - 0.5) * 0.8 + (vnoise1(ly / 11, ks + 4) - 0.5) * 0.7;
    const X0 = Math.round(c.X(pl.x - hw + sh - eL * 0.6)), X1 = Math.max(X0 + 2, Math.round(c.X(pl.x + hw + sh + eR * 0.6)));
    const wide = X1 - X0 > 3;
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const u = (x - X0 + 0.5) / (X1 - X0);
      const lx = c.lx(x + 0.5);
      // a jagged broken top: splinters, the lit side standing higher
      if (pl.broken) {
        const jag = pl.top + (1 - u) * -3 + (hash(Math.floor(lx * 1.3), 7, seed) - 0.5) * 7 + Math.abs(Math.sin(u * 7 + pl.k * 9)) * 4;
        if (ly < jag) continue;
        // the splintered top: pale dry fibres on the lit side, the rotted heart dark brown
        if (ly < jag + 1.2) { b.set(x, y, u < 0.5 ? P.earth[0]! : P.earth[2]!); continue; }
        if (ly < jag + 3 && u > 0.3 && u < 0.7 && d >= 1) { b.set(x, y, P.umber[2]!); continue; }
      } else if (ly < pl.top) continue;
      // a cylinder lit from the upper left
      // (round 3) its lit left edge, the highlight just in from it, the body, the core shadow
      // right of centre, a little reflected light on the far rim
      let t = !wide ? (u < 0.5 ? 0.12 : 0.6) : u < 0.1 ? 0.1 : u < 0.32 ? 0.02 : u < 0.52 ? 0.24 : u < 0.74 ? 0.45 : u < 0.9 ? 0.72 : 0.56;
      const rim = wide && u >= 0.9;
      t += shade;
      // weathered grain: long checks down the log, the odd knot
      if (d >= 0.5 && vnoise(lx / 1.3, ly / 16, seed) > 0.72) t += 0.12;
      if (d >= 1 && hash(Math.floor(lx * 2), Math.floor(ly / 7), seed + 1) < 0.03) t += 0.24;
      if (pl.age > 0.5) t -= 0.05;
      // the deck's shadow on its upper part (under the deck only: a post above it stands in the sun)
      if (!pl.broken && ly > 0 && ly < DECK + 26) t += 0.14 * clamp((DECK + 26 - ly) / 10, 0, 1);
      const bleach = pl.age < 0.5 && shade < 0.2;
      // in the lake: dark, slick
      if (hgt < 0.55) {
        // the wet line at the water: bright where the lit side meets the meniscus
        if (hgt > -0.5 && shade < 0.2) { b.set(x, y, u < 0.62 ? P.cloud[1]! : P.jade[1]!); continue; }
        b.set(x, y, wetWood(x, y, 0.7 + u * 0.3));
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
        // slick: the lake's light on the far rim, a sheen down the lit side
        // (round 3: the wet band is wet brown, dark toward the water, never grey)
        if (rim && shade < 0.2) { b.set(x, y, P.jade[6]!); continue; }
        if (d >= 1 && wide && u > 0.12 && u < 0.3 && shade < 0.2 && vnoise1(ly / 3, seed + 6) > 0.45) { b.set(x, y, P.timber[3]!); continue; }
        b.set(x, y, wetWood(x, y, 0.08 + u * 0.55 + k * 0.3 + shade));
        continue;
      } else if (hgt < pl.moss && u > 0.5 - (pl.moss - hgt) * 0.02) {
        // moss climbing the shade side, thinning upward
        const m = vnoise(lx / 2.4, ly / 2.6, seed + 5);
        if (m > 0.42 + (hgt - pl.wet) / Math.max(1, pl.moss - pl.wet) * 0.35) {
          b.set(x, y, tone(P.moss, clamp(0.38 + u * 0.38, 0, 1), x, y, 0.35));
          continue;
        }
      }
      b.set(x, y, wood(x, y, clamp(t, 0, 1), bleach && !rim));
    }
  }
  // a rope lashing round it (a newer pile tied to its old neighbour)
  if (pl.lash > 0 && d >= 0.5) lashing(c, pl.x + pl.lean * ((pl.foot - pl.lash) / span), pl.lash, pl.hw + 2, 3);
}

/** Turns of rope round a post at y (local), centre x, half width hw: each turn slanting, lit on top. */
function lashing(c: PaintCtx, x: number, y: number, hw: number, turns: number): void {
  const b = c.buf, d = c.d;
  for (let k = 0; k < turns; k++) {
    const yy = y + k * 2.2;
    for (let X = Math.round(c.X(x - hw)); X < Math.round(c.X(x + hw)); X++) {
      const q = (c.lx(X + 0.5) - x) / hw;
      const Y = Math.round(c.Y(yy + q * 0.9 + (1 - q * q) * 0.6));
      b.set(X, Y, q < -0.4 ? P.earth[1]! : q > 0.5 ? P.earth[3]! : ((X + k) & 1) ? P.earth[1]! : P.earth[2]!);
      if (d >= 1) b.set(X, Y + 1, q > 0.5 ? P.earth[5]! : P.earth[4]!);
    }
  }
}

/** A round log standing from y0 to y1 (local px), centre cx, half width hw. Wet near the water. */
export function log(c: PaintCtx, cx: number, y0: number, y1: number, hw: number, water: number, seed: number, cap = false, lean = 0): void {
  pileLog(c, { x: cx, hw, top: y0, foot: y1, lean, wet: 8 + hash1(1, seed) * 12, moss: 14 + hash1(2, seed) * 14, age: 0, back: false, broken: false, lash: 0, k: hash1(3, seed) }, water, seed);
  if (cap) capTop(c, cx + lean, y0, hw, seed);
}

/**
 * A post's top, never a flat cut and never a dome (round 3): the old saw cut weathered to a slant
 * and gone round at its shoulders, split by a check that opens into a V at the top and runs on
 * down the post as a dark crack; or a ragged rotted top with its heart gone dark; or a ragged top
 * under a cap of moss. Lit from the upper left.
 */
function capTop(c: PaintCtx, cx: number, y0: number, hw: number, seed: number): void {
  const b = c.buf, d = c.d;
  const ch = Math.max(2.5, hw * 0.85);
  const style = hash1(5, seed);
  const notch = (hash1(6, seed) - 0.5) * 0.9;
  const tilt = (hash1(8, seed) - 0.5) * 0.7;
  const crack = ch * (2.2 + 3 * hash1(9, seed));
  const X0 = Math.round(c.X(cx - hw - 0.6)), X1 = Math.round(c.X(cx + hw + 0.6));
  for (let y = Math.floor(c.Y(y0 - 1)); y < Math.ceil(c.Y(y0 + Math.max(ch, crack))); y++) {
    const ly = c.ly(y + 0.5);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5) - cx;
      const q = lx / hw;
      // the top's outline: a slanting cut rounded at its shoulders, splintered along it
      let top = y0 + ch * (0.12 + 0.3 * Math.pow(Math.abs(q), 3) + tilt * q * 0.5) + (vnoise1(lx * 1.4, seed + 7) - 0.5) * ch * 0.22;
      if (style < 0.38) top = y0 + ch * (0.25 + 0.3 * Math.abs(q)) + (hash(Math.floor(lx * Math.max(1, d) * 0.7), 3, seed) - 0.5) * ch * 0.8;
      const split = style >= 0.38 && style < 0.82;
      // the check: a V open at the top, closing to a crack running down the post
      const sv = (ly - y0) / ch;
      const open = split && sv < 0.75 && Math.abs(q - notch) < 0.2 * (1 - sv / 0.75) + 0.04;
      if (ly >= y0 + ch) {
        if (split && ly < y0 + crack && Math.abs(q - notch - (ly - y0) * 0.02) < 0.5 / (hw * Math.max(1, d)) + 0.02 && Math.abs(q) < 0.9) b.set(x, y, P.umber[3]!);
        continue;
      }
      if (Math.abs(q) > 1 || ly < top || open) { b.clear(x, y); continue; }
      const k = clamp((ly - top) / ch, 0, 1);
      // its rim catches the sun on the left; the far side of the split in shadow
      if (ly - top < 1 / d * 1.05) { b.set(x, y, q < -0.2 ? P.earth[0]! : q < 0.45 ? P.earth[1]! : P.earth[3]!); continue; }
      if (split && q > notch && q - notch < 0.32 && sv < 0.9) { b.set(x, y, P.umber[2]!); continue; }
      if (style < 0.38 && k < 0.45) { b.set(x, y, q < 0 ? P.umber[1]! : P.umber[3]!); continue; }
      if (style >= 0.82 && k < 0.55 && vnoise(lx * 0.8, ly * 0.9, seed + 3) > 0.3) { b.set(x, y, P.moss[q < -0.3 ? 2 : q < 0.4 ? 3 : 5]!); continue; }
      const lit = -q * 0.5 + (1 - k) * 0.4;
      b.set(x, y, wood(x, y, clamp(0.42 - lit * 0.4, 0, 1)));
    }
  }
}

/**
 * A hewn timber (a brace) between two points, thickness th: its width wanders a little and it
 * bows a touch; its upper face lit and silvered, its underside in shade; pegged or lashed where it
 * meets the piles. cut < 1 snaps it short, splintered.
 */
export function beamLine(c: PaintCtx, ax: number, ay: number, bx: number, by: number, th: number, seed: number, shade = 0, cut = 1): void {
  const b = c.buf, d = c.d;
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(2, Math.ceil(len * d * 1.5));
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  // +o runs along (nx, ny): which side of the timber faces up (and so the sun)
  const up = ny < 0 ? 1 : -1;
  const bowK = (hash1(1, seed) - 0.5) * 2 * len * 0.014;
  for (let s = 0; s <= steps * cut; s++) {
    const u = s / steps;
    const bow = Math.sin(u * Math.PI) * bowK;
    const w = th * (0.9 + 0.2 * vnoise1(u * len / 9, seed + 2));
    const px = ax + (bx - ax) * u + nx * bow, py = ay + (by - ay) * u + ny * bow;
    const end = cut < 1 && u > cut - 0.05;
    for (let o = -w / 2; o <= w / 2; o += 0.5 / d) {
      if (end && hash(Math.round(o * 4), Math.round(u * 40), seed) < 0.5) continue;
      const X = Math.round(c.X(px + nx * o)), Y = Math.round(c.Y(py + ny * o));
      const k = (w / 2 - o * up) / w;
      let t = (k < 0.2 ? 0.06 : k < 0.6 ? 0.34 : k < 0.84 ? 0.58 : 0.82) + shade;
      if (d >= 1 && k > 0.2 && vnoise(u * len / 14, k * 3, seed) > 0.72) t += 0.12;
      if (d >= 1 && hash(Math.floor(u * len / 3), Math.floor(k * 3), seed) < 0.06) t += 0.15;
      b.set(X, Y, wood(X, Y, clamp(t, 0, 1), shade < 0.2 && k < 0.6));
    }
  }
  if (d < 0.5) return;
  // where it meets a pile: a peg with its lit head, or a lashing of rope
  for (const e of cut < 1 ? [0] : [0, 1]) {
    const f = e === 0 ? Math.min(0.5, 3.2 / len) : 1 - Math.min(0.5, 3.2 / len);
    const ex = ax + (bx - ax) * f, ey = ay + (by - ay) * f;
    if (hash1(7 + e, seed) < 0.55) {
      const r = Math.max(0.7, th * 0.24);
      b.disc(c.X(ex), c.Y(ey), Math.max(0.6, r * d), P.timber[6]!);
      b.set(Math.round(c.X(ex - r * 0.4)), Math.round(c.Y(ey - r * 0.4)), P.earth[1]!);
    } else lashing(c, ex, ey - th * 0.6, th * 0.75, 2);
  }
}

// --- the deck ---------------------------------------------------------------------------------

/** The sister board under the stringer at x, if any. */
function sisterAt(plan: JPlan, x: number): JSister | null {
  for (const s of plan.sisters) if (x >= s[0] && x < s[1]) return s;
  return null;
}

/** A board end's colour: silvered end grain (pale earth, umber) or brown timber (never mixed in one board). */
function plankCol(x: number, y: number, t: number, bleach: boolean): number {
  // (round 3) hard steps: a board is one clean colour with a lit top and a darker foot, never a
  // field of dither
  return bleach ? tone(SILVER, clamp(0.06 + t * 0.94, 0, 1), x, y, 0) : tone(P.timber, clamp(0.28 + t * 0.72, 0, 1), x, y, 0);
}

/**
 * The deck as the lake sees it (round 3): one quiet step under the water, never a stone grey. The
 * mirror tint takes earth[1] to about a step darker than the lake round it; the beam's underside
 * (nearest the waterline in the reflection) a step firmer.
 */
const REFL_BOARD = P.earth[1]!, REFL_BEAM = P.earth[1]!, REFL_FIRM = P.earth[1]!, REFL_DARK = P.earth[2]!;

/**
 * Where the lake's slow ripples break the deck's reflection into slivers (plate only): seldom at
 * the beam's underside (the top of the reflection, nearest the waterline), more and more toward
 * the deck's top (the bottom of the reflection), so the band fades downward in horizontal dashes
 * (never a dither).
 */
function rippleGap(lx: number, ly: number, bot: number, seed: number): boolean {
  const far = clamp((bot - ly) / 14, 0, 1.2);
  const row = Math.floor(ly);
  const n = vnoise(lx / (6 + 7 * hash1(row, seed + 33)) + hash1(row, seed + 34) * 40, ly * 0.9, seed + 31);
  // (and the whole band thins and thickens slowly along the deck, so it reads as pieces)
  return n < 0.14 + far * 0.72 + (vnoise1(lx / 120, seed + 35) - 0.5) * 0.5;
}

/** Is (lx, ly) on a ring crest crossing the reflected deck near bent bx (ring radius R)? 1 crest, -1 a gap, 0 neither. */
function ringAt(lx: number, ly: number, bx: number, R: number, bot: number, seed: number): number {
  const dist = Math.abs(lx - bx);
  if (dist > R) return 0;
  // the crests: two or three arcs of the ring's near half, crossing the band where the
  // reflection is broken; between them the band is gone (the lake's sky shows)
  for (let k = 0; k < 3; k++) {
    const row = bot - 1.6 - k * 3.6 - (dist / R) * (dist / R) * 2.4;
    if (Math.abs(ly - row) < 0.55 && dist < R * (1 - k * 0.24) && dist > R * 0.2 && hash1(Math.floor(lx / 3) + k * 31, seed + 63) > 0.22) return 1;
  }
  // the band thins toward the ring's middle (a ragged hole, wider at the deck's far rows)
  const hole = 1 - dist / R;
  const far = (bot - ly) / 18;
  return hole * 1.2 + far * 0.45 + (vnoise(lx / 5, ly / 2, seed + 64) - 0.5) * 0.4 > 0.72 ? -1 : 0;
}

/**
 * The deck band (plank ends, the stringer, sister boards) over [x0, x1). lit: the face as she
 * sees it; otherwise the deck as the lake sees it, inset a pixel so the lit face sprite always
 * covers it. The plate's deck is only ever seen in the mirror, so it is painted for the
 * reflection: a pale, quiet mid step (the mirror tint takes it a step under the water), flatter
 * the further it lies from the waterline, broken where rings cross it at a few bents.
 */
function paintDeck(c: PaintCtx, p: JettyP, plan: JPlan, seed: number, x0: number, x1: number, lit: boolean): void {
  const b = c.buf, d = c.d;
  const X0 = Math.max(b.ox, Math.round(c.X(x0))), X1 = Math.min(b.x1, Math.round(c.X(x1)));
  const inset = lit ? 0 : 1;
  const one = 1 / d;
  for (let x = X0; x < X1; x++) {
    const lx = c.lx(x + 0.5);
    const pk = plankOf(plan, lx);
    const run = runOf(plan, lx);
    const bot = strBot(plan, lx);
    const btop = strTop(plan, lx);
    const sis = sisterAt(plan, lx);
    const sBot = sis ? bot + sis[2] + (vnoise1(lx / 5, seed + 51) - 0.5) * 0.7 : bot;
    const top = pk ? pk.drop : 0;
    const pth = pk ? pk.th ?? 0 : 0;
    const Yt = Math.round(c.Y(top)) + inset, Yd = Math.round(c.Y(DECK + pth)), Yb = Math.round(c.Y(bot)), Ys = Math.round(c.Y(sBot)) - inset;
    const PX0 = pk ? Math.round(c.X(pk.x)) : X0, PX1 = pk ? Math.round(c.X(pk.x + pk.w)) : X1;
    const missing = !pk || pk.kind === MISSING;
    // an open joint: the board's last level-1 px, sky through it
    const open = !!pk && pk.gap === 2 && PX1 - 1 - x < Math.max(1, Math.floor(d));
    const wet = groundAt(p, lx) > p.water - 2;
    const joints: number[] = [];
    for (let i = 1; i < plan.runs.length; i++) if (Math.abs(lx - plan.runs[i]!.x0) <= 6) joints.push(i);
    const near: number[] = [];
    for (const bx of plan.bents) if (Math.abs(lx - bx) <= 3) near.push(bx);
    // a water stain running down the stringer from this plank's joint
    const stain = !!pk && d >= 1 && hash1(Math.round(pk.x * 3), seed + 41) < 0.22 && Math.abs(lx - (pk.x + pk.w - 0.6)) < 0.55;
    const stainTo = DECK + (bot - DECK) * (0.35 + 0.6 * hash1(Math.round(pk ? pk.x : 0), seed + 42));
    // rings crossing the mirrored deck at a few bents (plate only): the reflection breaks there
    let ringX = NaN, ringR = 0;
    if (!lit) {
      for (let i = 0; i < plan.bents.length; i++) {
        const bx = plan.bents[i]!;
        if (hash1(i, seed + 61) > 0.45) continue;
        const R = 18 + 24 * hash1(i, seed + 62);
        if (Math.abs(lx - bx) < R) { ringX = bx; ringR = R; break; }
      }
    }
    for (let y = Math.max(Yt, b.oy); y < Math.min(Ys, b.y1); y++) {
      const ly = c.ly(y + 0.5);
      if (!lit && ringR > 0 && d >= 0.5) {
        const rg = ringAt(lx, ly, ringX, ringR, bot, seed);
        if (rg > 0) { b.set(x, y, P.jade[1]!); continue; }
        if (rg < 0) { b.clear(x, y); continue; }
      }
      if (y < Yd) {
        // --- a board's end
        if (missing || open) continue;
        const v = (y - Yt + 0.5) / Math.max(1, Yd - Yt);
        if (!lit) {
          // as the water sees it (round 3): one quiet step under the lake; the deck's far rows
          // (the bottom of the reflection) break into ripple dashes and fade out
          if (rippleGap(lx, ly, bot, seed)) { b.clear(x, y); continue; }
          b.set(x, y, x === PX1 - 1 && pk.gap === 1 ? REFL_FIRM : REFL_BOARD);
          continue;
        }
        // worn: the top corners rounded off
        if (pk.kind === WORN && y === Yt && (x === PX0 || (x === PX1 - 1 && pk.k < 0.5))) continue;
        let t = pk.t;
        if (y === Yt) t -= 0.3;
        else if (d >= 2 && y === Yt + 1) t -= 0.08;
        if (v > 0.72) t += 0.07;
        let bleach = pk.bleach !== false;
        if (x === PX1 - 1) {
          // the joint: a dark slit, a hairline that runs part way down, or butted tight
          if (pk.gap === 1) { t = 0.97; bleach = false; }
          else if (pk.k > 0.55 && y > Yt && v < 0.3 + pk.k) t += 0.13;
        }
        if (d >= 1) {
          // a split down from the top; short checks; end grain rings and a nail at the close band
          const sx = Math.round(c.X(pk.x + pk.w * (0.3 + 0.4 * pk.k)));
          if (pk.kind === SPLIT && x === sx && v < 0.75 && y > Yt) t += 0.3;
          else if (y > Yt && hash(Math.floor(lx * 1.5), Math.floor(ly / 2.5), seed + Math.round(pk.x)) < 0.035) t += 0.14;
          // (round 3) at the close band the odd board shows its heart: one dark ring arc
          if (d >= 1.5 && pk.k < 0.2 && pk.w > 9) {
            const cxr = pk.x + pk.w * (0.3 + 0.4 * pk.k), cyr = DECK + 4.5;
            const rr = Math.hypot(lx - cxr, (ly - cyr) * 1.3);
            if (Math.abs(rr - 2.6) < 0.4 && ly < cyr) t += 0.1;
          }
          // the bevel on its left edge at the close band
          if (d >= 2 && x === PX0 && y > Yt) t -= 0.06;
        }
        b.set(x, y, plankCol(x, y, clamp(t, 0, 1), bleach));
        continue;
      }
      if (ly >= bot) {
        // --- a sister board bolted under the beam
        const sv = (ly - bot) / Math.max(0.5, sBot - bot);
        if (!lit) { b.set(x, y, sv > 0.6 ? REFL_DARK : REFL_FIRM); continue; }
        let t = 0.3 + sv * 0.3;
        if (y === Yb) t = 0.9;
        if (sis && (lx - sis[0] < 1.6 || sis[1] - lx < 1.6)) t += 0.22;
        if (sis && d >= 0.5 && (Math.abs(lx - sis[0] - 4) < 0.7 || Math.abs(sis[1] - lx - 4) < 0.7) && Math.abs(sv - 0.5) < 0.3) { b.set(x, y, P.ink[1]!); continue; }
        if (y === Ys - 1) { b.set(x, y, wet ? P.jade[6]! : P.timber[5]!); continue; }
        b.set(x, y, wood(x, y, clamp(t, 0, 1), false, 0));
        continue;
      }
      // --- the dark lens where the beam has dropped away from the boards
      if (ly < btop) {
        b.set(x, y, lit ? (missing || open ? P.timber[5]! : P.timber[6]!) : REFL_FIRM);
        continue;
      }
      // --- the stringer
      const v = (ly - btop) / Math.max(1, bot - btop);
      const bd = bot - ly;
      const under = ly - Math.max(btop, DECK + pth);
      const lens = btop - (DECK + pth) > 0.6;
      if (!lit) {
        // the beam as the water sees it (round 3): the board step, firmer for its lowest rows (the
        // top of the reflection, nearest the waterline), the line between them wandering
        if (rippleGap(lx, ly, bot, seed)) { b.clear(x, y); continue; }
        const firm = bd < 1.4 + 2.2 * vnoise1(lx / 23, seed + 32) + (run.age ? 0 : 0.8);
        b.set(x, y, bd < one * 0.99 ? REFL_DARK : firm ? REFL_FIRM : REFL_BEAM);
        continue;
      }
      let t: number;
      if (under < 1 && !lens && !missing && !open) t = 0.86;
      else if (under < 1) t = run.age ? 0.2 : 0.36;
      else {
        t = run.age ? 0.4 + v * 0.2 + run.k * 0.05 : 0.48 + v * 0.2 + run.k * 0.08;
        if (under < 2.4) t -= 0.1;
        if (d >= 1 && hash(Math.floor(lx / 9), Math.floor(ly * 2), seed + 9) < 0.03) t += 0.18;
        if (stain && ly < stainTo) t += 0.2;
        // long grain: streaks along the beam, silvered in an old beam's sunny upper half
        const g = vnoise(lx / 41, ly / 1.15, seed + 8);
        if (!run.age && d >= 0.5 && g > 0.66 && v < 0.6) { b.set(x, y, wood(x, y, clamp(0.32 + v * 0.3, 0, 1), true, 0)); continue; }
        if (g < 0.2) t += 0.07;
        else if (run.age && g > 0.74) t -= 0.07;
        // checks: long thin cracks along the grain
        if (d >= 1 && vnoise(lx / 52, ly * 1.6, seed + 12) > 0.87) t += 0.22;
        // algae and moss along an old beam's wet underside
        if (!run.age && bd < 2.6 && bd >= one && vnoise(lx / 4, ly, seed + 43) > 0.55) { b.set(x, y, P.moss[bd < 1.2 ? 6 : 5]!); continue; }
      }
      // the underside: a core of shadow, then the lake's light lifting the lowest row
      if (!sis) {
        if (bd < one) { b.set(x, y, wet ? (d >= 1 && bayer4(x, y) < 0.25 ? P.timber[6]! : P.jade[6]!) : P.timber[6]!); continue; }
        if (bd < one + 1.1) t = Math.max(t, 0.88);
      }
      // a joint where two runs meet: a butt seam and an iron strap (old to old) or a lashing (to a rebuilt run)
      for (const i of joints) {
        const jx = plan.runs[i]!.x0;
        const dj = lx - jx;
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
      for (const bx of near) {
        const by = DECK + (bot - DECK) * 0.48;
        if (d >= 0.5 && Math.abs(lx - bx) < 1 && Math.abs(ly - by) < 0.8) t = -2;
        else if (d >= 1.5 && Math.abs(lx - bx) < 0.5 && ly > by + 0.8 && ly < by + 4 && hash(Math.round(bx), 3, seed) < 0.6) t = -3;
      }
      if (t === -2) { b.set(x, y, P.ink[1]!); continue; }
      if (t === -3) { b.set(x, y, P.earth[3]!); continue; }
      b.set(x, y, wood(x, y, clamp(t, 0, 1), false, 0));
    }
    // moss and weed hanging from an old beam's underside, here and there
    if (lit && !run.age && !sis && d >= 1 && hash(Math.floor(lx * 1.5), 1, seed + 44) < 0.09) {
      const n = Math.round((1 + hash(Math.floor(lx * 1.5), 2, seed + 44) * 3) * d);
      for (let k = 0; k < n; k++) b.set(x, Yb + k, P.moss[k < n / 2 ? 6 : 7]!);
    }
  }
  // loose board ends hanging down over the beam's face (lit only)
  if (!lit) return;
  for (const pk of plan.planks) {
    if (!pk.hang || pk.x + pk.w < x0 || pk.x > x1) continue;
    const ax = pk.x + pk.w * 0.5, ay = DECK - 1, ang = (pk.k - 0.5) * 0.5;
    for (let s = 0; s < pk.hang; s += 0.5 / d) {
      const cx = ax + Math.sin(ang) * s, cy = ay + Math.cos(ang) * s;
      const hw = Math.max(0.8, (pk.w * 0.3) * (1 - s / pk.hang * 0.5));
      for (let o = -hw; o <= hw; o += 0.5 / d) {
        const X = Math.round(c.X(cx + o)), Y = Math.round(c.Y(cy));
        if (X < X0 || X >= X1) continue;
        const q = (o + hw) / (2 * hw);
        const end = s > pk.hang - 1.2;
        b.set(X, Y, end ? P.timber[5]! : plankCol(X, Y, clamp(pk.t + (q < 0.3 ? -0.08 : q > 0.75 ? 0.22 : 0.06), 0, 1), pk.bleach !== false));
      }
    }
  }
}

/** The see-through slot where a plank is missing: the far stringer's top, deep in shadow. */
function paintSlots(c: PaintCtx, plan: JPlan, x0: number, x1: number): void {
  const b = c.buf;
  for (const pk of plan.planks) {
    if (pk.kind !== MISSING || pk.x + pk.w < x0 || pk.x > x1) continue;
    const X0 = Math.round(c.X(pk.x)), X1 = Math.round(c.X(pk.x + pk.w));
    const Y0 = Math.round(c.Y(DECK - 1.6)), Y1 = Math.round(c.Y(DECK + (pk.th ?? 0)));
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
  plan.braces.forEach((br, i) => {
    if (br.cut >= 1) { beamLine(c, br.ax, br.ay, br.bx, br.by, br.th, seed + 300 + i, br.age ? -0.05 : 0.08, 1); return; }
    // a snapped brace hangs from its last peg, its splintered end down at the water
    const L = Math.hypot(br.bx - br.ax, br.by - br.ay) * br.cut;
    const ey = Math.min(p.water - 1.5, br.ay + L * 0.86);
    const ex = br.ax + Math.sign(br.bx - br.ax) * Math.sqrt(Math.max(4, L * L - (ey - br.ay) * (ey - br.ay)));
    beamLine(c, br.ax, br.ay, ex, ey, br.th, seed + 300 + i, 0.12, 0.98);
  });
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
    for (let y2 = Math.round(c.Y(by)); y2 < Math.round(c.Y(by + 2.2)); y2++) b.set(x2, y2, x2 < c.X(x - hw * 0.3) ? P.lacquer[2]! : P.ink[1]!);
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
    if (p.part === "face") return [(p.from ?? -4) - 2, -2, (p.to ?? p.w + 4) + 2, DECK + 36];
    let up = 4;
    for (const [, hgt] of p.posts ?? []) up = Math.max(up, hgt + 4);
    return [-22, -up, p.w + 22, p.water + 30];
  },
  paint(c, p) {
    const seed = p.plan ?? c.seed;
    const plan = jettyPlan(p, seed);
    const part = p.part ?? "all";
    if (part === "face") {
      paintDeck(c, p, plan, seed, Math.max(-4, p.from ?? -4), Math.min(p.w, p.to ?? p.w), true);
      return;
    }
    paintPlate(c, p, plan, seed);
    paintSlots(c, plan, -4, p.w + 4);
    paintDeck(c, p, plan, seed, -4, p.w, part === "all");
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
  /**
   * "all" (default): the whole station still; "frame": everything but the pulley and the lantern;
   * "pulley": the wheel alone, turning a notch now and then (32 frames at 8 fps); "lantern": the
   * paper lantern alone, its flame flickering and the lantern swaying a pixel (16 frames at 8 fps).
   */
  part?: "all" | "frame" | "pulley" | "lantern";
  frame?: number;
}

/** The station's fixed layout (local px, anchor: the cables' centre on the deck top, 107.4 H). */
const ST = {
  /** Near posts' centres and half widths: the west at about 106.6 H, the east at 107.52 H. */
  wx: -76.8, ex: 11.5, whw: 5.2, ehw: 5.3,
  /** Head beam and sill ends (inside 106.5 H .. 107.58 H). */
  x0: -86, x1: 17,
  /** The roof's eaves (they may overhang by 0.25 H, at roof height only). */
  rx0: -108, rx1: 40,
  /** The pulley: centre x and radius; the lantern's x. */
  px: -2, pr: 13, lx: -63,
};

/** The pulley's notch angle for a frame: still, a notch (with an easing frame), still, another. */
function pulleyTurn(f: number): number {
  const k = ((f % 32) + 32) % 32;
  const step = Math.PI / 8;
  return k < 13 ? 0 : k === 13 ? step * 0.45 : k < 25 ? step : k === 25 ? step * 1.5 : step * 2;
}

/** The lantern's flicker (0 steady, 1 a brighter flare, 2 a dip) and sway (px) for a frame. */
const LANTERN_FLICKER = [0, 0, 1, 0, 0, 0, 2, 0, 1, 1, 0, 0, 0, 0, 2, 0];
const LANTERN_SWAY = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];

/**
 * The waterwheel lift's top station, narrow, so she stands clear of it on the open deck: a timber
 * gantry built into the jetty on its own heavy piles (braced in an X under the deck), two near
 * posts with their far posts darker behind, a head beam, a tie beam carrying the winch drum wound
 * with rope and its crank, a spoked pulley hung from the head beam by a forked strap with the two
 * cables running off it down through the deck, a small roof of dark tiles with upturned eaves,
 * moss in its channels and the lake's light under its eaves, and a paper lantern hung on the west
 * side. Anchor: the cables' centre on the deck's top.
 */
export const station = definePainter<StationP>("op.station", {
  bounds(p) {
    if (p.part === "pulley") return [ST.px - ST.pr - 3, -p.h + 66 + 4, ST.px + ST.pr + 3, -p.h + 66 + 48];
    if (p.part === "lantern") return [ST.lx - 11, -p.h + 66 + 4, ST.lx + 11, -p.h + 66 + 46];
    return [ST.rx0 - 6, -p.h - 14, ST.rx1 + 6, p.water + 30];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const H = p.h, water = p.water;
    const part = p.part ?? "all";
    const f = p.frame ?? 0;
    const [cdx, cy] = p.cable ?? [6, -19.2];
    const top = -H + 66, eave = -H + 50;
    const pcy = top + 24;
    if (part === "pulley") { paintPulley(c, ST.px, pcy, ST.pr, top, pulleyTurn(f), seed); return; }
    if (part === "lantern") { paintLantern(c, ST.lx + LANTERN_SWAY[f % 16]! * 0.5, top + 6, LANTERN_FLICKER[f % 16]!); return; }
    // its own piles under the deck: heavier than the jetty's, braced in an X
    const piles: JPile[] = [
      { x: ST.wx + 0.4, hw: 6.6, top: 17, foot: water + 24, lean: 0.8, wet: 14, moss: 26, age: 0.2, back: false, broken: false, lash: 0, k: 0.3 },
      { x: -52, hw: 5.2, top: 17, foot: water + 24, lean: -0.6, wet: 9, moss: 15, age: 0.6, back: true, broken: false, lash: 0, k: 0.6 },
      { x: -22, hw: 5.6, top: 17, foot: water + 24, lean: 1.2, wet: 18, moss: 22, age: 0.3, back: true, broken: false, lash: 0, k: 0.8 },
      { x: ST.ex - 0.3, hw: 6.4, top: 17, foot: water + 24, lean: -1.2, wet: 11, moss: 30, age: 0.1, back: false, broken: false, lash: 0, k: 0.1 },
    ];
    piles.forEach((pl, i) => { if (pl.back) pileLog(c, pl, water, seed + i * 13, 0.28); });
    beamLine(c, ST.wx + 4, 24, ST.ex - 4, water - 7, 4.6, seed + 1, 0.05);
    beamLine(c, ST.wx + 4, water - 9, ST.ex - 4, 25, 4.4, seed + 2, 0.14);
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
    beam(ST.x0, ST.x1, 16, 22, 0.3, seed + 3);
    // the gantry: the two far posts in shadow, a little in from the near ones
    for (const [px, hw] of [[ST.wx + 7, 4.2], [ST.ex - 7, 4.3]] as const) pileLog(c, { x: px, hw, top: top - 6, foot: 1, lean: 0, wet: 0, moss: 0, age: 0.4, back: true, broken: false, lash: 0, k: 0.4 }, water, seed + 20 + Math.round(px), 0.32);
    // the sill on the deck that the frame stands on
    beam(ST.x0, ST.x1, -6, 0.5, 0.05, seed + 4);
    // the tie beam that carries the drum
    beam(ST.x0 + 3, ST.x1 - 2, -84, -77, 0.12, seed + 5);
    // the winch drum wound with rope (seen along its axle), its flanges, the crank
    const dx0 = -60, dx1 = -28, dy0 = -104, dy1 = -84;
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
    // the near posts, from the deck up to the head beam
    for (const [px, hw, s] of [[ST.wx, ST.whw, 11], [ST.ex, ST.ehw, 12]] as const) {
      pileLog(c, { x: px, hw, top: top - 4, foot: 17, lean: 0, wet: 0, moss: 0, age: 0.25, back: false, broken: false, lash: 0, k: 0.5 + s * 0.01 }, water, seed + s);
      // an iron band where it meets the deck, and one under the beam
      for (const by of [-9, top + 8]) {
        for (let y = Math.round(c.Y(by)); y < Math.round(c.Y(by + 2.6)); y++) for (let x = Math.round(c.X(px - hw - 0.5)); x < Math.round(c.X(px + hw + 0.5)); x++) b.set(x, y, x < c.X(px - hw * 0.3) ? P.lacquer[2]! : P.ink[1]!);
      }
    }
    // the crank: an iron arm and a worn handle, in front of the west post
    const ckx = dx0 - 3, cky = (dy0 + dy1) / 2;
    for (let s = 0; s <= 12; s += 0.5 / d) b.set(Math.round(c.X(ckx - s * 0.45)), Math.round(c.Y(cky - s * 0.88)), P.ink[1]!);
    for (let s = 0; s <= 7; s += 0.5 / d) b.set(Math.round(c.X(ckx - 5.4 - s)), Math.round(c.Y(cky - 10.6)), s < 2 ? P.timber[2]! : P.timber[4]!);
    // a diagonal brace in the bay under the drum, a knee brace under the head beam's west end
    beamLine(c, ST.wx + 4, -8, -46, -77, 3.6, seed + 13, 0.08);
    beamLine(c, ST.wx + 4, top + 30, ST.wx + 22, top + 7, 3.4, seed + 14, 0.05);
    // the head beam, its ends a little past the posts
    beam(ST.x0, ST.x1, top - 6, top + 6, 0.02, seed + 16);
    // the rope from the drum up over the wheel
    {
      const ax = dx1 - 3, ay = dy0 + 1, bx = ST.px - ST.pr * 0.72, by = pcy - ST.pr * 0.69;
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * d * 1.5);
      for (let i = 0; i <= n; i++) {
        const t = i / n, X = Math.round(c.X(ax + (bx - ax) * t)), Y = Math.round(c.Y(ay + (by - ay) * t));
        b.set(X, Y, P.earth[1]!);
        b.set(X + 1, Y, P.earth[3]!);
      }
    }
    // the two cables running off the wheel, down through the deck to where the lake takes them
    for (const sx of [-1, 1]) {
      const ax = ST.px + sx * (ST.pr - 1.5), bx = sx * cdx;
      for (let y = Math.round(c.Y(pcy)); y < Math.round(c.Y(cy + 0.5)); y++) {
        const t = (c.ly(y + 0.5) - pcy) / (cy - pcy);
        b.set(Math.round(c.X(ax + (bx - ax) * t)), y, P.lacquer[3]!);
      }
    }
    // the roof: dark tiles in runs, upturned eaves, a ridge with curled ends, moss in the channels
    const rx0 = ST.rx0, rx1 = ST.rx1;
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
          const fr = col - Math.floor(col);
          let t = (fr < 0.25 ? 0.1 : fr < 0.7 ? 0.38 : 0.7) + v * 0.25;
          if (bot - ly < 3.2) t = (Math.floor(col) & 1) ? 0.85 : 0.6;
          if (bot - ly < 1.2) t = 0.98;
          if (d >= 0.5 && (Math.round(ly) % 6) === 0 && fr > 0.2) t += 0.12;
          const m = vnoise(lx / 6, ly / 3, seed + 18);
          if (v > 0.3 && fr > 0.6 && m > 0.66 - v * 0.15) { b.set(x, y, tone(P.moss, 0.55 + v * 0.3, x, y, 0.35)); continue; }
          if (hash(Math.floor(col), Math.floor(ly / 6), seed + 19) < 0.025) t = 0.98;
          // a warm rim of sun along the ridge's lit side
          if (ly - rtop < 1.2 && u < 0.45) { b.set(x, y, P.paper[3]!); continue; }
          b.set(x, y, tone(P.tile, clamp(t + 0.12, 0, 1), x, y, 0.3));
        }
        // under the eaves: rafter ends in shadow, the lake's light lifting the overhang's underside
        const inside = lx > ST.x0 && lx < ST.x1;
        const yEnd = inside ? Math.max(bot + 4, top - 6) : bot + 3;
        for (let y = Math.round(c.Y(bot)); y < Math.round(c.Y(yEnd)); y++) {
          const ly = c.ly(y + 0.5);
          const rafter = ((lx / 7) % 1 + 1) % 1 < 0.35;
          if (!inside && yEnd - ly < 1.05 / d) { b.set(x, y, rafter ? P.timber[5]! : P.jade[6]!); continue; }
          b.set(x, y, ly < bot + 3 && rafter ? P.timber[4]! : P.timber[6]!);
        }
      }
      for (let x = Math.round(c.X(rx0 + 20)); x < Math.round(c.X(rx1 - 20)); x++) {
        const u = (c.lx(x + 0.5) - rx0 - 20) / (rx1 - rx0 - 40);
        const curl = Math.pow(Math.max(0, Math.abs(u - 0.5) * 2 - 0.86) / 0.14, 2) * 7;
        for (let y = Math.round(c.Y(-H + 1 - curl)); y < Math.round(c.Y(-H + 9)); y++) {
          const v = (c.ly(y + 0.5) - (-H + 1 - curl)) / (8 + curl);
          b.set(x, y, v < 0.2 ? (u < 0.5 ? P.paper[3]! : P.tile[1]!) : v < 0.65 ? P.tile[3]! : P.tile[5]!);
        }
      }
    }
    if (part === "all") {
      paintPulley(c, ST.px, pcy, ST.pr, top, 0, seed);
      paintLantern(c, ST.lx, top + 6, 0);
    }
  },
});

/** The pulley: a spoked wheel hung from the head beam on a forked iron strap, turned by rot. */
function paintPulley(c: PaintCtx, pcx: number, pcy: number, R: number, top: number, rot: number, seed: number): void {
  const b = c.buf;
  for (const sx of [-2.5, 2.5]) for (let y = Math.round(c.Y(top + 6)); y < Math.round(c.Y(pcy)); y++) b.set(Math.round(c.X(pcx + sx)), y, sx < 0 ? P.lacquer[1]! : P.ink[1]!);
  const X0 = Math.floor(c.X(pcx - R - 1)), X1 = Math.ceil(c.X(pcx + R + 1));
  const Y0 = Math.floor(c.Y(pcy - R - 1)), Y1 = Math.ceil(c.Y(pcy + R + 1));
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const ex = c.lx(x + 0.5) - pcx, ey = c.ly(y + 0.5) - pcy;
      const rr = Math.hypot(ex, ey);
      if (rr > R) continue;
      const a = Math.atan2(ey, ex) - rot;
      const lit = (-0.62 * ex - 0.78 * ey) / Math.max(1, rr);
      if (rr > R - 2) { b.set(x, y, rr > R - 0.8 ? P.ink[1]! : lit > 0.25 ? P.lacquer[0]! : P.lacquer[2]!); continue; }
      if (rr > R - 4.2) { b.set(x, y, wood(x, y, clamp(0.42 - lit * 0.3 + (hash(((Math.round(a * 9) % 57) + 57) % 57, 1, seed) < 0.2 ? 0.2 : 0), 0, 1))); continue; }
      if (rr < 3) { b.set(x, y, rr < 1.4 ? P.ink[1]! : P.lacquer[1]!); continue; }
      // eight spokes
      const sp = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5);
      if (sp > 0.5 - 1.5 / Math.max(2, rr)) b.set(x, y, wood(x, y, clamp(0.34 - lit * 0.25, 0, 1)));
    }
  }
}

/** The paper lantern on its cord from the head beam (no lettering); flicker 1 flares, 2 dips. */
function paintLantern(c: PaintCtx, lx0: number, ly0: number, flicker: number): void {
  const b = c.buf, d = c.d;
  for (let y = Math.round(c.Y(ly0)); y < Math.round(c.Y(ly0 + 8)); y++) b.set(Math.round(c.X(lx0)), y, P.ink[1]!);
  const cyl = ly0 + 8 + 10, rx = 7, ry = 10;
  for (let y = Math.round(c.Y(cyl - ry - 2)); y < Math.round(c.Y(cyl + ry + 2)); y++) {
    for (let x = Math.round(c.X(lx0 - rx - 1)); x < Math.round(c.X(lx0 + rx + 1)); x++) {
      const ex = (c.lx(x + 0.5) - lx0) / rx, ey = (c.ly(y + 0.5) - cyl) / ry;
      if (Math.abs(ey) > 1.08) continue;
      if (Math.abs(ey) > 0.9) { if (Math.abs(ex) < 0.55) b.set(x, y, P.lacquer[2]!); continue; }
      if (ex * ex + ey * ey * 0.7 > 1) continue;
      const rib = d >= 0.5 && ((c.ly(y + 0.5) - cyl + 30) % 3.4) < 0.7;
      let t = ex < -0.45 ? 0.05 : ex < 0.25 ? 0.25 : 0.55;
      // the flame behind the paper: a warm core that flares and dips
      const core = ex * ex + (ey - 0.15) * (ey - 0.15) * 1.6;
      if (core < (flicker === 1 ? 0.32 : flicker === 2 ? 0.1 : 0.2) && !rib) { b.set(x, y, core < 0.08 && flicker !== 2 ? P.ember[0]! : P.ember[1]!); continue; }
      if (rib) t += 0.25;
      b.set(x, y, tone(P.paper, clamp(t, 0, 1), x, y, 0.3));
    }
  }
  for (let y = Math.round(c.Y(cyl + ry + 2)); y < Math.round(c.Y(cyl + ry + 8)); y++) b.set(Math.round(c.X(lx0)), y, P.red[3]!);
}

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
  /** (east) A tree standing on the landing's rock: its trunk's foot [x, y] (local), so its roots grip the rock. */
  roots?: [number, number];
}

export const landing = definePainter<LandingP>("op.landing", {
  bounds(p) {
    return p.end === "west" ? [-60, -6, 130, p.water + 14] : [-232, -6, 44, p.water + 26];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const water = p.water;
    const g = (x: number): number => yAt(p.ground, x);
    // (round 3) every pile that stands in the ground is driven into it: a collar of wet mud
    // heaped against it (higher on one side), a wet dark band on the log above the mud, a stone
    // or two at its foot, a bright line where the lake laps the mud
    const collars = (): void => {
      for (const [fx, hw] of p.feet ?? []) {
        const gy = g(fx);
        if (gy > water + 2) continue;
        const kk = hash1(Math.round(fx * 3), seed + 70);
        const wl = hw + 3 + 4 * kk, wr = hw + 3 + 5 * (1 - kk), mh = 2.2 + 3 * hash1(Math.round(fx), seed + 71);
        for (let x = Math.max(b.ox, Math.round(c.X(fx - wl))); x < Math.min(b.x1, Math.round(c.X(fx + wr))); x++) {
          const lx = LX(c, x) - fx;
          const u = lx < 0 ? lx / wl : lx / wr;
          const mound = mh * Math.pow(Math.max(0, 1 - u * u), 0.8) * (0.75 + 0.5 * vnoise1(LX(c, x) / 2.2, seed + 72));
          const top = Math.min(gy, water + 0.5) - mound;
          for (let y = Math.max(b.oy, Math.round(c.Y(top))); y < Math.min(b.y1, Math.round(c.Y(Math.min(gy, water) + 3))); y++) {
            const ly = LY(c, y);
            if (ly < top) continue;
            const s = ly - top;
            let col: number;
            if (ly > water + 0.5) col = P.umber[3]!;
            else if (ly > water - 0.6) col = Math.abs(u) > 0.25 && vnoise1(LX(c, x) / 3, seed + 73) > 0.35 ? P.jade[1]! : P.umber[2]!;
            else if (s < 0.9) col = u < -0.2 ? P.earth[2]! : P.earth[3]!;
            else col = Math.abs(u) < 0.35 ? P.umber[2]! : s > 2.5 ? P.earth[5]! : P.earth[4]!;
            b.set(x, y, col);
          }
        }
        // the log's wet band just above the mud (a darker, slick ring)
        const wt = Math.min(gy, water) - mh - 1;
        for (let y = Math.round(c.Y(wt - 2.5 - 2 * kk)); y < Math.round(c.Y(wt + 0.5)); y++) {
          for (let x = Math.round(c.X(fx - hw * 0.92)); x < Math.round(c.X(fx + hw * 0.92)); x++) {
            const q = (LX(c, x) - fx) / hw;
            b.set(x, y, q < -0.55 ? P.timber[4]! : q > 0.45 ? P.umber[3]! : P.umber[2]!);
          }
        }
        if (d >= 0.5) {
          const sx = fx + (kk < 0.5 ? -hw - 3.5 : hw + 3);
          limeChunk(c, { x0: sx - 3 - 2 * kk, x1: sx + 3 + 2 * (1 - kk), top: Math.min(gy, water) - 2.5 - 2 * kk, foot: Math.min(gy, water) + 2, z: 0.75, water: gy > water - 3 ? water : undefined, cap: kk > 0.6 ? 1 : 0, seed: seed + Math.round(fx) });
        }
      }
    };
    if (p.end === "west") {
      collars();
      // the step down to the grass: a split log laid on two stones, worn pale on top
      const gy = g(-20);
      limeChunk(c, { x0: -35, x1: -22, top: 15.5, foot: gy + 3, z: 0.7, cap: 1.5, seed: seed + 3 });
      limeChunk(c, { x0: -15, x1: -4, top: 16.5, foot: g(-10) + 3, z: 0.62, seed: seed + 7 });
      limeChunk(c, { x0: -52, x1: -36, top: g(-44) - 5, foot: g(-44) + 3, z: 0.55, cap: 2.5, seed: seed + 4 });
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
      for (let y = Math.round(c.Y(DECK + 10)); y < Math.round(c.Y(sy + 4)); y++) {
        for (let x = Math.round(c.X(sx - 7)); x < Math.round(c.X(sx + 7)); x++) {
          const u = (c.lx(x + 0.5) - sx + 7) / 14, v = (c.ly(y + 0.5) - DECK - 10) / Math.max(1, sy + 4 - DECK - 10);
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
      // a branch of driftwood half in the water: kinked, tapering, silvered where it dries
      {
        const pts: [number, number][] = [];
        let x = 62, y = water - 3.2;
        for (let k = 0; k <= 6; k++) {
          pts.push([x, y]);
          x += 5 + hash1(k, seed + 9) * 2.5;
          y += k === 2 ? -1.4 : 0.55 + (hash1(k, seed + 10) - 0.5) * 0.6;
        }
        if (d >= 0.3) {
          stroke(c, pts, (u) => 2.8 - 1.6 * u, (_u, sd) => (sd < -0.3 ? P.earth[1]! : sd < 0.4 ? P.earth[3]! : P.umber[2]!));
          const [bx, by] = pts[2]!;
          stroke(c, bladePath(bx, by - 0.5, 6, 0.35, -0.3), () => 1, () => P.earth[2]!);
        }
      }
      return;
    }
    // east (round 3): the jetty's end built into the shore. A big chunk under the pine (its roots
    // grip it), a step of limestone up toward the lip with the deck's end bedded on a timber sill on
    // it, a low block half sunk in front, mud and pebbles at their feet, the last piles driven in
    // with their collars, a broken plank and driftwood washed up, reeds at the water
    const K1: LimeChunk = { x0: -66, x1: -4, top: 44.5, foot: water + 4, tilt: 0.02, z: 0.6, cap: 2.5, water, seed: seed + 20 };
    const K2: LimeChunk = { x0: -8, x1: 30, top: 25, foot: water + 4, tilt: -0.04, z: 0.86, cap: 2, water, seed: seed + 21 };
    const K0: LimeChunk = { x0: -108, x1: -78, top: 50.5, foot: water + 4, tilt: 0.06, z: 0.92, cap: 1.5, water, seed: seed + 22 };
    // mud and pebbles along the shelf at the water's edge
    {
      const X0 = Math.max(b.ox, Math.floor(c.X(-200))), X1 = Math.min(b.x1, Math.ceil(c.X(-50)));
      for (let x = X0; x < X1; x++) {
        const lx = LX(c, x);
        const top = Math.max(water - 7, Math.min(g(lx), water)) - 1.5 - 2.5 * vnoise1(lx / 9, seed + 30) - (vnoise1(lx / 3, seed + 31) - 0.5) * 1.2;
        if (top > water - 0.6) continue;
        for (let y = Math.max(b.oy, Math.floor(c.Y(top))); y < Math.min(b.y1, Math.ceil(c.Y(water + 2))); y++) {
          const ly = LY(c, y);
          if (ly < top) continue;
          b.set(x, y, ly > water + 0.5 ? P.umber[3]! : ly > water - 0.6 ? (vnoise1(lx / 4, seed + 32) > 0.4 ? P.jade[1]! : P.umber[2]!) : ly - top < 0.9 ? P.earth[3]! : water - ly < 2.2 ? P.umber[2]! : P.earth[4]!);
        }
      }
    }
    limeChunk(c, K1, [K0]);
    // the pine's roots gripping the block under it: over its top both ways, then down its sides
    // into the joints, one into a crack in its top; soil and moss heaped at the trunk's foot
    if (p.roots && d >= 0.25) {
      const [rx, ry] = p.roots;
      const kt = (x: number): number => chunkTop(K1, x) - 0.6;
      const paths: [number, number][][] = [
        [[rx - 5, ry - 4], [rx - 14, kt(rx - 14) - 1.2], [K1.x0 + 9, kt(K1.x0 + 9) - 0.6], [K1.x0 + 2, kt(K1.x0 + 2) + 1.5], [K1.x0 - 1, kt(K1.x0) + 9], [K1.x0 - 1.5, water - 3]],
        [[rx - 3, ry - 3], [rx - 13, kt(rx - 13) - 0.4], [rx - 20, kt(rx - 20) + 3], [rx - 22, kt(rx - 22) + 8]],
        [[rx + 5, ry - 4], [rx + 12, kt(rx + 12) - 1], [K1.x1 - 3, kt(K1.x1 - 3) - 0.3], [K1.x1 + 0.5, kt(K1.x1) + 6], [K1.x1 + 1, kt(K1.x1) + 14]],
        [[rx - 1, ry - 2], [rx - 3, kt(rx - 3) + 4], [rx - 6, kt(rx - 6) + 9]],
      ];
      paths.forEach((pts, i) => {
        const w0 = [5.2, 3.4, 4.6, 2.6][i]!;
        stroke(c, pts, (u) => Math.max(1, w0 * (1 - u * 0.82)), (u, sd) => {
          const [px, py] = pts[Math.min(pts.length - 1, Math.round(u * (pts.length - 1)))]!;
          if (sd < -0.35 && u < 0.7 && vnoise(px / 2.5, py / 2, seed + 50 + i) > 0.55) return P.moss[3]!;
          return sd < -0.35 ? P.earth[3]! : sd < 0.2 ? P.timber[4]! : sd < 0.6 ? P.timber[5]! : P.umber[3]!;
        });
      });
      // the soil and moss at the trunk's foot, heaped on the rock
      for (let x = Math.round(c.X(rx - 16)); x < Math.round(c.X(rx + 14)); x++) {
        const lx = LX(c, x), q = (lx - rx) / 15;
        const hgt = 4 * Math.pow(Math.max(0, 1 - q * q), 1.4) * (0.7 + 0.5 * vnoise1(lx / 3, seed + 55));
        for (let y = Math.round(c.Y(kt(lx) - hgt)); y < Math.round(c.Y(kt(lx) + 0.8)); y++) {
          const ly = LY(c, y);
          b.set(x, y, vnoise(lx / 2.6, ly / 2, seed + 56) > 0.48 ? (ly < kt(lx) - hgt + 1 ? P.moss[3]! : P.moss[5]!) : P.earth[5]!);
        }
      }
    }
    collars();
    limeChunk(c, K2);
    limeChunk(c, K0);
    // the cut stone slab level with the deck, laid from the last plank onto the road's rock
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
    // the timber sill under the stringer's end, bedded on the step's top, soil and moss at the join
    const sx0 = -22, sx1 = 10;
    for (let y = Math.round(c.Y(DECK + 10.5)); y < Math.round(c.Y(DECK + 17)); y++) {
      for (let x = Math.round(c.X(sx0)); x < Math.round(c.X(sx1)); x++) {
        const v = (c.ly(y + 0.5) - DECK - 10.5) / 6.5, u = (c.lx(x + 0.5) - sx0) / (sx1 - sx0);
        b.set(x, y, wood(x, y, v < 0.22 ? 0.18 : v > 0.8 ? 0.85 : u > 0.9 ? 0.75 : 0.5, false));
      }
    }
    for (let x = Math.round(c.X(sx0 - 2)); x < Math.round(c.X(sx1 + 3)); x++) {
      const lx = LX(c, x);
      const h0 = 1 + 1.6 * vnoise1(lx / 3, seed + 33);
      for (let y = Math.round(c.Y(DECK + 17)); y < Math.round(c.Y(DECK + 17 + h0)); y++) b.set(x, y, vnoise1(lx / 4, seed + 34) > 0.5 ? P.moss[5]! : P.earth[4]!);
    }
    // a broken plank washed up aslant against the low block, its splintered end in the water
    {
      const ax = -128, ay = water - 9, bx = -96, by = water + 0.5;
      const L = Math.hypot(bx - ax, by - ay);
      for (let s = 0; s < L; s += 0.5 / d) {
        const px = ax + (bx - ax) * (s / L), py = ay + (by - ay) * (s / L);
        for (let o = 0; o < 3.2; o += 0.5 / d) {
          if (s < 2.5 && hash(Math.round(o * 3), Math.round(s * 2), seed + 35) < 0.5) continue;
          const yy = py + o;
          if (yy > water + 0.5) continue;
          dot(c, px, yy, yy > water - 0.6 ? P.jade[1]! : o < 0.9 ? P.earth[1]! : o < 2.2 ? P.timber[3]! : P.timber[5]!);
        }
      }
    }
    // driftwood lying along the shelf at the water's edge, silvered, a broken branch up
    {
      const pts: [number, number][] = [];
      let x = -214, y = water - 2.6;
      for (let k = 0; k <= 7; k++) {
        pts.push([x, y]);
        x += 6.5 + hash1(k, seed + 36) * 2;
        y += (k === 3 ? -0.9 : 0.25) + (hash1(k, seed + 37) - 0.5) * 0.5;
      }
      if (d >= 0.3) {
        stroke(c, pts, (u) => 3 - 1.4 * u, (_u, sd) => (sd < -0.3 ? P.earth[1]! : sd < 0.4 ? P.earth[3]! : P.umber[2]!));
        const [qx, qy] = pts[3]!;
        stroke(c, bladePath(qx, qy - 1, 8, 0.4, -0.3), () => 1, () => P.earth[2]!);
      }
    }
    // reeds where the shelf goes into the water, and grass on the block tops
    for (const [rx, rw, rh, n] of [[-150, 16, 22, 12], [-62, 8, 12, 6]] as const) {
      for (let k = 0; k < n; k++) {
        const bx = rx + (hash1(k, seed + 40 + rx) - 0.5) * rw, ln = rh * (0.4 + 0.6 * hash1(k, seed + 41 + rx));
        if (d >= 0.3) grass(c, bx, water - 0.5, ln, (hash1(k, seed + 42) - 0.5) * 0.4, (hash1(k, seed + 43) - 0.5) * 0.9, hash1(k, seed + 44) * 0.7);
      }
    }
    for (let i = 0; i < 7; i++) {
      const gx = K2.x0 + 3 + hash1(i, seed + 45) * (K2.x1 - K2.x0 - 6);
      if (d >= 0.3) grass(c, gx, chunkTop(K2, gx) + 1, 3 + hash1(i, seed + 46) * 6, (hash1(i, seed + 47) - 0.45) * 0.9, -0.3, hash1(i, seed + 48));
    }
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

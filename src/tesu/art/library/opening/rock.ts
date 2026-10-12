// Karst rock for the play plane: every mass the opening stands on (Kagami's plateau and its
// cliff, Gate Road's natural bridge and its pillars, the corner rock under the palace).
//
// Read like real limestone seen from the side, never as paving: the face is built of vertical
// columns (weathered flutes of mixed widths that lean and wander a little), cut by irregular
// bedding ledges where the columns shift; every column is lit on its left edge and falls into
// shade on its right, with a dark crevice between columns that closes in places where they
// have fused. Ledges throw a short shadow under them; the odd one holds soil and plants. Dark
// water stains run down from some ledges. The face is lit near its top and darkens with depth,
// then dissolves into the valley's mist (never a cut bottom). The top carries a living lip:
// grass in rich and thin stretches, a ragged hem, hanging strands; or a worn path.
//
// Light: the morning key, from the upper left. Depth from value only: no tops, no bevels.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm1, hash, hash1, rng, tone, vnoise1 } from "../../raster.ts";
import { boxOf, cached, clump, roughen, spansFor, toAbs, yAt } from "./kit.ts";

export interface RockP {
  /** Top polyline (the walk line where she stands), level-1 local px, x increasing. Kept exact. */
  top: number[];
  /** The rest of the outline, from the top's right end back to its left end (x decreasing). */
  bottom: number[];
  /** The lip: "grass" (living), "path" (a worn road over the rock), "bare". */
  cap?: "grass" | "path" | "bare";
  /** Lip thickness, px (default 10). */
  capH?: number;
  /** Wander of the sides and underside, px (default 10). */
  rough?: number;
  /** Hanging teeth on undersides, 0..1 (default 0.4). */
  teeth?: number;
  /** Average column width and ledge spacing, px. */
  col?: number;
  bed?: number;
  /** Plants on ledges and the lip, 0..1 (default 0.6). */
  veg?: number;
  /** Extra shade over the whole face, 0..1 (default 0). */
  shade?: number;
  /** The face dissolves into mist from this local y over `fadeH` px. */
  fadeY?: number;
  fadeH?: number;
  /** Local y of still water against the rock: a wet band above it. */
  water?: number;
  /** Giant buttresses this wide (px) with gullies between them: structure for the wide frames. */
  giant?: number;
  /** Depths below the top of big ledges carrying bands of forest (structure for the wide frames). */
  forest?: number[];
  /** Keep the outline exact this many px from each end of the top (where it joins other ground). */
  joinL?: number;
  joinR?: number;
}

interface Built {
  outline: number[];
  box: [number, number, number, number];
  plants: Plant[];
}

interface Plant {
  kind: "bush" | "tuft" | "pine" | "strand";
  x: number;
  y: number;
  r: number;
  seed: number;
}

const COL = 22;
const BED = 150;

/** A 1D partition with irregular cells: the cell index and position in it for coordinate u. */
function cell(u: number, w: number, jitter: number, seed: number, row: number): { i: number; t: number; w: number } {
  const i0 = Math.floor(u / w);
  const edge = (i: number): number => (i + (hash(i, row, seed) - 0.5) * jitter) * w;
  let i = i0;
  if (u < edge(i0)) i = i0 - 1;
  else if (u >= edge(i0 + 1)) i = i0 + 1;
  const a = edge(i), b2 = edge(i + 1);
  return { i, t: (u - a) / Math.max(1e-6, b2 - a), w: b2 - a };
}

interface Seg {
  /** Buttress index, position across it (0 left .. 1 right) and its width. */
  i: number; t: number; w: number;
  /** Ledge segment within the buttress, depth below its ledge, segment height. */
  j: number; s: number; S: number;
  /** How far this segment stands out (0..1). */
  out: number;
}

/**
 * The face is a row of buttresses (big vertical masses between clefts) that lean a little; each
 * buttress breaks at its own ledges (so neighbours step at different heights, like organ pipes),
 * and every segment between two ledges stands out by its own amount.
 */
function segAt(lx: number, ly: number, p: RockP, seed: number, di = 0): Seg {
  const col = p.col ?? COL, bed = p.bed ?? BED;
  const lean = 0.06 * (hash1(3, seed + 53) - 0.5);
  const ub = lx + ly * lean + (fbm1(ly / 420, seed + 55, 2) - 0.5) * 18 + (fbm1(ly / 160, seed + 54, 2) - 0.5) * 16;
  const Bc = cell(ub, col * 4.2, 0.95, seed + 59, 0);
  const i = Bc.i + di;
  let t = Bc.t, w = Bc.w;
  if (di !== 0) { t = di < 0 ? 1 : 0; w = col * 4.2; }
  const sp = bed * (0.55 + 0.9 * hash1(i, seed + 58));
  const y = ly + (fbm1(lx / 160, seed + 41 + i, 2) - 0.5) * sp * 0.3 + (vnoise1(lx / 37, seed + 40 + i) - 0.5) * 5 + (hash1(i, seed + 56) - 0.5) * 0.18 * lx + hash1(i, seed + 57) * sp;
  const L = cell(y, sp, 0.8, seed + 43, i);
  return { i, t, w, j: L.i, s: L.t * L.w, S: L.w, out: hash(i, L.i, seed + 60) };
}

interface Face extends Seg {
  /** The left neighbour stands out further: its shadow falls on this one's left side. */
  shadowL: number;
  /** The segment above stands out further (an overhang) by this much. */
  overhang: number;
  /** Column inside the segment. */
  ci: number; ct: number; cw: number;
}

function faceAt(lx: number, ly: number, p: RockP, seed: number): Face {
  const col = p.col ?? COL;
  const S = segAt(lx, ly, p, seed);
  const L = segAt(lx - S.t * S.w - 1, ly, p, seed);
  const U = segAt(lx, ly - S.s - 1, p, seed);
  const uc = S.t * S.w + (hash(S.i, S.j, seed + 61) - 0.5) * 9 + S.s * (hash(S.i, S.j, seed + 69) - 0.5) * 0.14;
  const Cc = cell(uc, col * (0.6 + 0.7 * hash(S.i, S.j, seed + 62)), 0.7, seed + 63, S.i * 31 + S.j);
  return { ...S, shadowL: Math.max(0, L.out - S.out), overhang: U.i === S.i ? U.out - S.out : 0, ci: Cc.i, ct: Cc.t, cw: Cc.w };
}

function build(p: RockP, seed: number): Built {
  const rough = p.rough ?? 10;
  const top = p.top;
  // the outline: the top exact; the bottom roughened (its ends kept where they join the top)
  const bot = roughen([top[top.length - 2]!, top[top.length - 1]!, ...p.bottom, top[0]!, top[1]!], {
    amp: rough, step: 4, teeth: p.teeth ?? 0.4, seed: seed + 3,
    keepStart: p.joinR ?? 6, keepEnd: p.joinL ?? 6,
  });
  const outline = [...top, ...bot.slice(2, -2)];
  const box = boxOf(outline);
  const veg = p.veg ?? 0.6;
  const plants: Plant[] = [];
  if (veg > 0) {
    const r = rng(seed + 77);
    const x0 = top[0]!, x1 = top[top.length - 2]!;
    const capH = p.capH ?? 10;
    // the lip: bushes hanging over the edge and strands of creeper, in rich and bare stretches
    for (let x = x0 + 8; x < x1 - 8; x += 4 + r() * 10) {
      const rich = vnoise1(x / 160, seed + 79) * 0.7 + vnoise1(x / 47, seed + 80) * 0.3;
      if (rich < 0.6 - veg * 0.3) continue;
      const y = yAt(top, x);
      const k = r();
      if (k < 0.34 * veg) plants.push({ kind: "bush", x, y: y + capH * 0.5, r: 5 + r() * 11 * rich, seed: Math.floor(r() * 1e6) });
      else if (k < 0.6) plants.push({ kind: "strand", x, y: y + capH * 0.6, r: 6 + r() * 34 * rich * rich, seed: Math.floor(r() * 1e6) });
    }
    // ledges: where a segment stands out past the one above it, its top holds soil; plant there
    for (let x = box[0] + 10; x < box[2] - 10; x += 6 + r() * 12) {
      const rich = vnoise1(x / 130, seed + 83);
      if (rich < 0.5 - veg * 0.2) continue;
      const ty = yAt(top, x);
      let y = ty + 20;
      for (let n = 0; n < 30 && y < box[3]; n++) {
        const S = segAt(x, y, p, seed);
        const ledge = y - S.s + S.S;
        y = ledge + 2;
        if (ledge < ty + 18) continue;
        if (p.fadeY !== undefined && ledge > p.fadeY + (p.fadeH ?? 80) * 0.2) break;
        const below = segAt(x, ledge + 1, p, seed);
        if (below.out <= S.out + 0.05) continue;
        if (r() > veg * 1.1 * rich) continue;
        const k = r();
        if (k < 0.12 && rich > 0.65) plants.push({ kind: "pine", x, y: ledge, r: 22 + r() * 26, seed: Math.floor(r() * 1e6) });
        else if (k < 0.72) plants.push({ kind: "bush", x, y: ledge + 1, r: 4 + r() * 10 * rich, seed: Math.floor(r() * 1e6) });
        else plants.push({ kind: "tuft", x, y: ledge, r: 3 + r() * 5, seed: Math.floor(r() * 1e6) });
      }
    }
  }
  for (const fd of p.forest ?? []) {
    const r = rng(seed + 131 + Math.round(fd));
    for (let x = top[0]! + 20; x < top[top.length - 2]! - 20; x += 5 + r() * 9) {
      const rich = vnoise1(x / 200, seed + 133 + Math.round(fd));
      if (rich < 0.3) continue;
      const fy = fd + (fbm1(x / 240, seed + 93, 2) - 0.5) * 40;
      plants.push({ kind: "bush", x, y: yAt(top, x) + fy, r: (7 + r() * 14) * (0.6 + rich * 0.6), seed: Math.floor(r() * 1e6) });
    }
  }
  return { outline, box, plants };
}

function builtFor(p: RockP, seed: number): Built {
  return cached(`rock|${seed}|${JSON.stringify(p).length}|${p.forest?.length}|${p.top.length}|${p.top[0]}|${p.top[1]}|${p.bottom.length}|${p.bottom[0]}|${p.rough}|${p.veg}`, () => build(p, seed));
}

/** What the face shows at a point: rock (with its tone), moss, or a warm sunlit flank. */
let faceMat: "rock" | "moss" | "warm" = "rock";

const showB0 = (F: Seg, d: number): boolean => F.w * d > 7;

/** The face's tone at a level-1 point (0 light .. 1 dark); sets faceMat. */
function faceTone(lx: number, ly: number, depth: number, p: RockP, seed: number, d: number): number {
  faceMat = "rock";
  const F = faceAt(lx, ly, p, seed);
  const px = 1 / Math.max(d, 0.125);
  const xb = F.t * F.w, xc = F.ct * F.cw;
  // light falls off below the lip; recessed segments sit in shade; big bays and prows across
  // the whole mass give the wide frames something to read
  const macro = fbm1(lx / 700 + 3.1, seed + 90, 3);
  const bay = clamp((0.42 - macro) * 3, 0, 1), prow = clamp((macro - 0.6) * 3, 0, 1);
  let t = 0.4 + 0.22 * (1 - Math.exp(-depth / 300)) + (1 - F.out) * 0.14 + (p.shade ?? 0) * 0.3 + bay * 0.16 - prow * 0.1;
  if (p.giant) {
    // giant buttresses: a lit flank, a shaded flank, a deep gully between them
    const G = cell(lx + (fbm1(ly / 500, seed + 91, 2) - 0.5) * p.giant * 0.25, p.giant, 0.6, seed + 92, 0);
    const gx = G.t * G.w;
    if (gx < G.w * 0.035 || G.w - gx < G.w * 0.02) t += 0.42;
    else if (G.t < 0.2) t -= 0.12;
    else if (G.t > 0.72) t += 0.2 * ((G.t - 0.72) / 0.28);
    else if (G.t > 0.035 && gx < G.w * 0.08) t += 0.2;
  }
  for (const fd of p.forest ?? []) {
    // the shadow a forested ledge throws on the face below it
    const fy = fd + (fbm1(lx / 240, seed + 93, 2) - 0.5) * 40;
    if (depth > fy && depth < fy + 30) t += 0.28 * (1 - (depth - fy) / 30);
  }
  // the buttress: a lit left flank, a body, a right flank turning into shade
  const litB = Math.max(px * 2, F.w * (0.1 + 0.1 * F.out));
  if (xb < litB && showB0(F, d)) {
    t -= 0.24;
    if (F.out > 0.45 && depth < 400) faceMat = "warm";
  } else if (F.t > 0.6) t += 0.26 * ((F.t - 0.6) / 0.4) ** 1.3;
  // the top of a segment that stands out is rounded by weather: its corners show the recess
  const R = Math.min(F.w * 0.22, 5 + 8 * hash(F.i, F.j, seed + 66));
  if (F.overhang < -0.3 && F.s < R) {
    const cx = Math.min(xb, F.w - xb);
    if (cx < R) {
      const q = (R - cx) / R, v = (R - F.s) / R;
      if (q * q + v * v > 1) return t + 0.36;
    }
    // moss and soil gather on the rounded top, in clumps with a ragged edge and the odd drip
    const mx = Math.floor(lx / 4);
    const patch = vnoise1(lx / 26, seed + 68 + F.j) * (0.55 + 0.6 * (p.veg ?? 0.6));
    const mh = (patch - 0.38) * 14 + (hash1(mx, seed + 67 + F.j) - 0.5) * 3 + (hash1(Math.floor(lx / 2), seed + 70) < 0.06 ? 6 : 0);
    if (F.s < mh) {
      faceMat = "moss";
      return 0.28 + (F.s / Math.max(1, mh)) * 0.4;
    }
  }
  // a cleft between buttresses, and the shadow a more prominent neighbour throws to its right
  // (at the wide levels only the bigger buttresses keep their clefts; columns drop out)
  const showB = F.w * d > 7;
  if (showB && (xb < px * 1.2 || F.w - xb < px * 1.2)) t += 0.5;
  else if (showB && F.shadowL > 0.12 && xb < F.shadowL * 30 + px) t += 0.32;
  else if (!showB) t += (F.out - 0.5) * 0.08;
  // columns: a lit edge and a crevice on their right, broken where columns have fused
  if (d >= 0.5) {
    const fused = hash(F.ci, F.i * 7 + F.j, seed + 71) < 0.3;
    if (!fused && F.cw - xc < px * 0.9) t += 0.22;
    else if (xc < px * 1.1 && xb > litB) t -= 0.08;
  }
  // the ledge on top of this segment: a cast shadow under a real overhang, a lit lip where the
  // segment stands well out past the one above, otherwise only a faint bedding line
  if (F.overhang > 0.25) {
    const sh = 2 + 12 * F.overhang;
    if (F.s < sh) t += 0.36 * (1 - F.s / (sh + 1)) + 0.12;
  } else if (F.overhang < -0.15 && F.s < px * 1.3 && d >= 0.25) t -= 0.26;
  else if (F.s < px * 0.9 && d >= 0.5 && hash(Math.floor(lx / 9), F.j, seed + 77) < 0.7) t += 0.12;
  // long water stains down from some ledges
  if (d >= 0.25) {
    const sx = Math.floor((lx - F.j * 7) / 4);
    if (hash(sx, F.j * 13 + F.i, seed + 75) < 0.09 && F.s < F.S * (0.3 + 0.7 * hash(sx, F.j, seed + 76))) t += 0.1 + 0.08 * (1 - F.s / F.S);
  }
  t += (fbm1(lx / 120 + ly / 200, seed + 81, 3) - 0.5) * 0.14;
  if (d >= 1 && hash(Math.floor(lx), Math.floor(ly), seed + 85) < 0.012) t += 0.2;
  return t;
}

export const rock = definePainter<RockP>("op.rock", {
  bounds(p) {
    const pts = [...p.top, ...p.bottom];
    const [x0, y0, x1, y1] = boxOf(pts);
    const r = (p.rough ?? 10) * 3.4 + 4;
    // plants hang over the lip and pines lean out of the face
    return [x0 - r - 30, y0 - 24, x1 + r + 30, y1 + r];
  },
  paint(c, p) {
    paintRock(c, p);
  },
});

/** Paints a rock mass (shared with the cliff wall behind the road). */
export function paintRock(c: PaintCtx, p: RockP): void {
    const b = c.buf, d = c.d;
    const seed = c.seed;
    const B = builtFor(p, seed);
    const abs = toAbs(c, B.outline);
    const sp = spansFor(c, abs);
    const capKind = p.cap ?? "grass";
    const capH = p.capH ?? 10;
    const K = P.karst;
    const y0 = Math.max(sp.y0, b.oy), y1 = Math.min(sp.y1, b.y1);
    const fadeY = p.fadeY, fadeH = p.fadeH ?? 80;
    for (let y = y0; y < y1; y++) {
      const row = sp.row(y);
      for (let k = 0; k + 1 < row.length; k += 2) {
        const xa = Math.max(row[k]!, b.ox), xb = Math.min(row[k + 1]!, b.x1 - 1);
        for (let x = xa; x <= xb; x++) {
          const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
          const inTop = lx >= p.top[0]! && lx <= p.top[p.top.length - 2]!;
          const ty = inTop ? yAt(p.top, lx) : B.box[1];
          const depth = Math.max(0, ly - ty);
          // the mist foot: lighter, then thinning out by dither
          let fog = 0;
          if (fadeY !== undefined && ly > fadeY) {
            fog = clamp((ly - fadeY) / fadeH, 0, 1);
            if (bayer4(x, y) < fog * 1.25 - 0.25) continue;
          }
          const above = sp.inside(x, y - 1);
          const leftIn = sp.inside(x - 1, y), rightIn = sp.inside(x + 1, y), belowIn = sp.inside(x, y + 1);
          // the lip
          if (inTop && capKind !== "bare") {
            const rich = vnoise1(lx / 70, seed + 6);
            const cl = capH * (0.45 + 0.9 * rich) * (0.75 + 0.5 * vnoise1(lx / 19, seed + 5));
            const hem = cl + (d >= 0.5 ? Math.abs(Math.sin(lx / 2.7 + vnoise1(lx / 9, seed) * 5)) * (1 + 2.5 * rich) : 0);
            if (depth < hem) {
              const u = depth / Math.max(1, hem);
              let t: number;
              let ramp: readonly number[] = P.moss;
              if (capKind === "path") {
                // a worn road: packed earth with a lit edge, grass only in the margins
                ramp = depth < hem * 0.5 ? P.earth : P.moss;
                t = depth < 1.2 / d ? 0.1 : ramp === P.earth ? 0.3 + 0.3 * u + (hash(x >> 1, y, seed) < 0.07 ? 0.25 : 0) : 0.5 + 0.3 * u;
              } else {
                // grass: a sunlit top, a body that darkens into its own shade, a dark hem
                t = depth < 1.2 / d ? 0.08 : u < 0.3 ? 0.24 : u < 0.62 ? 0.4 : 0.6;
                if (d >= 0.5 && u > 0.3 && hash(x, Math.floor(y / 2), seed + 7) < 0.12) t -= 0.18;
              }
              if (!belowIn || depth > hem - 1 / d) t = Math.max(t, 0.86);
              b.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.3));
              continue;
            }
            // the soil and shadow under the lip, on the rock right below it
            const under = depth - hem;
            if (under < 3 / Math.max(d, 0.5)) {
              b.set(x, y, tone(P.earth, 0.82, x, y, 0.3));
              continue;
            }
            if (under < 10 / Math.max(d, 0.5)) {
              b.set(x, y, tone(K, clamp(0.72 - under * 0.01 + (p.shade ?? 0) * 0.2, 0, 1), x, y, 0.4));
              continue;
            }
          }
          let t = faceTone(lx, ly, depth, p, seed, d);
          // edges: the shadow side and the underside go dark, the sunward side catches light
          if (!rightIn || !belowIn) t = Math.max(t + 0.28, 0.78);
          else if (!leftIn || (!above && !inTop)) t -= 0.16;
          else if (d >= 0.5 && (!sp.inside(x + 2, y + 2) || !sp.inside(x, y + 3))) t += 0.14;
          // a wet band where the rock meets still water
          if (p.water !== undefined && ly > p.water - 7 && ly < p.water + 1) t += 0.22;
          if (fog > 0) t = t * (1 - fog * 0.7);
          const mat = faceMat;
          if (mat === "moss" && rightIn && belowIn) b.set(x, y, tone(P.moss, clamp(t + 0.1, 0, 1), x, y, 0.35));
          else if (mat === "warm" && t < 0.42 && rightIn && belowIn && leftIn) b.set(x, y, tone(P.stone, clamp(t * 0.9, 0, 1), x, y, 0.35));
          else b.set(x, y, tone(K, clamp(t, 0, 1), x, y, 0.35));
        }
      }
    }
    paintPlants(c, B);
}

function paintPlants(c: PaintCtx, B: Built): void {
  const b = c.buf, d = c.d;
  for (const pl of B.plants) {
    const reach = pl.kind === "pine" ? pl.r * 2.2 : pl.kind === "strand" ? 6 : pl.r * 2.6;
    const down = pl.kind === "strand" ? pl.r + 4 : pl.kind === "pine" ? pl.r * 0.5 : pl.r * 3.2;
    const up = pl.kind === "pine" ? pl.r * 1.6 : pl.r * 1.4;
    if (!b.touches(Math.floor(c.X(pl.x - reach)), Math.floor(c.Y(pl.y - up)), Math.ceil(c.X(pl.x + reach)), Math.ceil(c.Y(pl.y + down)))) continue;
    if (pl.kind === "bush") {
      if (d < 0.25 && pl.r < 5) continue;
      bush(c, pl.x, pl.y, pl.r, pl.seed);
    } else if (pl.kind === "tuft") {
      if (d < 0.5) continue;
      // grass blades fanning out of a ledge
      const n = 3 + Math.floor(pl.r);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (hash1(i, pl.seed) - 0.5) * 1.6;
        const len = pl.r * (0.6 + 0.6 * hash1(i, pl.seed + 1));
        for (let s = 0; s < len; s += 1 / d) {
          const bend = (s / len) * (s / len) * Math.cos(a) * 3;
          b.set(Math.round(c.X(pl.x + Math.cos(a) * s * 0.6 + bend)), Math.round(c.Y(pl.y + Math.sin(a) * s)), P.moss[s < len * 0.5 ? 4 : 2]!);
        }
      }
    } else if (pl.kind === "strand") {
      if (d < 0.25) continue;
      // a hanging strand of moss or creeper over the lip, leaves along it, swaying slightly out
      const len = pl.r;
      for (let s = 0; s < len; s += 1 / d) {
        const sx = pl.x + Math.sin(s / 7 + pl.seed) * Math.min(2, s / 8);
        const X = Math.round(c.X(sx)), Y = Math.round(c.Y(pl.y + s));
        b.set(X, Y, P.moss[s < len * 0.3 ? 4 : 5]!);
        if (d >= 0.5 && hash(Math.floor(s), 3, pl.seed) < 0.3) b.set(X + (hash(Math.floor(s), 4, pl.seed) < 0.5 ? -1 : 1), Y, P.moss[3]!);
      }
    } else {
      // a cliff pine (Huangshan): the trunk leaves the face, bends out and up; flat pads of needles
      if (d < 0.125) continue;
      const dir = hash1(1, pl.seed) < 0.6 ? -1 : 1;
      const H = pl.r;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        pts.push([pl.x + dir * H * 0.55 * Math.sin(u * 1.4) + dir * H * 0.1 * u, pl.y - H * (0.15 * u + 0.75 * u * u)]);
      }
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!;
        const w = Math.max(1 / d, (1 - k / 10) * 2.6);
        const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * d));
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const X = c.X(ax + (bx - ax) * u), Y = c.Y(ay + (by - ay) * u);
          for (let o = -w * d / 2; o <= w * d / 2; o += 1) b.set(Math.round(X + o), Math.round(Y), o < 0 ? P.timber[4]! : P.timber[5]!);
        }
      }
      const pads = 3 + Math.floor(hash1(2, pl.seed) * 3);
      for (let k = 0; k < pads; k++) {
        const u = 0.45 + 0.55 * (k / Math.max(1, pads - 1));
        const [px, py] = pts[Math.round(u * 10)]!;
        const off = (hash1(k + 9, pl.seed) - 0.5) * H * 0.7;
        const pr = H * (0.22 + 0.12 * hash1(k + 3, pl.seed)) * (1 - 0.35 * u);
        clump(c, px + off, py - 2, pr, P.pine.slice(0, 4), P.pine.slice(3), 0.32, pl.seed + k * 7, 0.42);
      }
    }
  }
}

/**
 * A bush on a lip or ledge: three to six leaf clumps heaped together (the biggest at the back and
 * top, smaller ones lower and in front, darker toward the bottom), with a few strands of foliage
 * hanging from its underside over the rock below.
 */
export function bush(c: PaintCtx, x: number, y: number, r: number, seed: number): void {
  const d = c.d;
  const n = 3 + Math.floor(hash1(1, seed) * 4);
  const parts: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (hash1(i * 3 + 2, seed) - 0.5) * 2.4;
    const rr = r * (0.45 + 0.55 * hash1(i * 3 + 3, seed)) * (i === 0 ? 1.1 : 0.85);
    parts.push([x + Math.sin(a) * r * 0.9, y - r * 0.35 + Math.abs(Math.cos(a)) * -r * 0.3 + (i / n) * r * 0.5, rr, i]);
  }
  // hanging foliage first (behind the clumps)
  if (d >= 0.25) {
    const strands = Math.floor(r * 0.6 * hash1(9, seed));
    for (let k = 0; k < strands; k++) {
      const sx = x + (hash1(k + 20, seed) - 0.5) * r * 1.6;
      const len = r * (0.8 + 2.2 * hash1(k + 30, seed));
      for (let s = 0; s < len; s += 1 / d) {
        const X = Math.round(c.X(sx + Math.sin(s / 5 + k) * Math.min(1.5, s / 6))), Y = Math.round(c.Y(y + s * 0.95));
        c.buf.set(X, Y, P.moss[s > len * 0.7 ? 3 : 5]!);
        if (d >= 0.5 && hash(Math.floor(s / 2), k, seed) < 0.35) c.buf.set(X + 1, Y, P.moss[4]!);
      }
    }
  }
  parts.sort((a, b) => a[1] - b[1]);
  for (const [px, py, pr, i] of parts) {
    clump(c, px, py, pr, P.moss.slice(1, 6), P.pine.slice(2), 0.34 + (py - (y - r)) / (r * 4), seed + i * 13, 0.78);
  }
}

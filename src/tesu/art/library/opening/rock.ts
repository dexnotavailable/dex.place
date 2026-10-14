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
import { Spans, bayer4, clamp, fbm1, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { boxOf, cached, clump, spansFor, toAbs, yAt } from "./kit.ts";
import { chunkAt, chunkTop, face, inChunk, limeChunk, nextLedge, type FaceOpts, type LimeChunk } from "./face.ts";
import { needlePad } from "./flora.ts";
import { LX, LY, bladePath, dot, grass, stroke } from "./bank.ts";
import { KERB_DEPTH, kerbAt, kerbGrit, kerbPx, kerbRocks, kerbShade, kerbTop, type KerbRock } from "./kerb.ts";

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
  /** (round 4) A paved road's stones and the rock breaking over its front edge (cap "path"). */
  road?: Road;
}

/**
 * (round 4, Dex: "the stone textures should have spots and chunks that overlap in front of the
 * paved path") A road over the rock is paved: a course of flagstones whose lit top we see, each its
 * own length and tone with moss in the odd joint, laid behind a kerb of cut stones of their own
 * lengths and heights (one sunk, one missing), soil and grass below it. (Round 5, the critic: "same-
 * value rounded cushions hung off the kerb, attached to nothing below") In front of it the cliff's
 * own chunks rise from below and break its edge (kerb.ts): a tall one past the walk line, a low
 * slab cracked through, middling blocks, alone or two or three overlapping at irregular gaps, each
 * standing on the face below with a contact shadow under its foot and throwing its shadow down and
 * right on the kerb behind it; loose stones and grit on the road by them.
 */
interface Road {
  /** Flagstone joints and kerb joints (level-1 x, sorted). */
  flags: number[];
  kerbs: number[];
  /** The chunks breaking the road's front edge and the stones on it (kerb.ts), in paint order. */
  rocks: KerbRock[];
}

interface Plant {
  kind: "bush" | "tuft" | "pine" | "strand";
  x: number;
  y: number;
  r: number;
  seed: number;
}

/**
 * (art loop round 3) Breaks an outline into chunks, never into teeth: every point is pushed along
 * the edge's normal by the chunk of the face it belongs to, so a hanging underside breaks along
 * the face's own joints into blocks that hang to different depths, and a side steps in and out
 * block by block; on top of that a slow wander and a hand wobble. Each step is a short slant, never
 * a spike. The first and last `keep` px stay where they are (joins).
 */
function chunkEdge(pts: readonly number[], amp: number, hang: number, keepStart: number, keepEnd: number, fo: FaceOpts, seed: number): number[] {
  const step = 3;
  const out: number[] = [];
  const n = pts.length / 2;
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.hypot(pts[i * 2]! - pts[i * 2 - 2]!, pts[i * 2 + 1]! - pts[i * 2 - 1]!);
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    const ax = pts[i * 2]!, ay = pts[i * 2 + 1]!, bx = pts[i * 2 + 2]!, by = pts[i * 2 + 3]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-6) continue;
    const nx = (by - ay) / len, ny = -(bx - ax) / len;
    const k = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      const u = j / k;
      const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
      const ss = s + len * u;
      const keep = Math.min(1, clamp(ss / Math.max(1, keepStart), 0, 1), clamp((total - ss) / Math.max(1, keepEnd), 0, 1));
      let dd = amp * ((fbm1(ss / 110, seed, 3) - 0.5) * 1.1 + (vnoise1(ss / 5, seed + 5) - 0.5) * 0.12);
      // the chunk this stretch of edge belongs to (sampled a little inside the mass)
      const { c } = chunkAt(px - nx * amp * 1.5, py - ny * amp * 1.5, fo, seed);
      if (ny > 0.45) {
        // an underside: each column's block hangs to its own depth (deeper the more forward it stands)
        // (centred: some hang lower, some have broken away higher, the outline's mean kept)
        dd += amp * hang * (Math.pow(hash(c.L, c.k, seed + 13), 1.4) - 0.36) * 2.6 * (0.6 + 0.6 * c.z);
        // (round 4, the critic: "a smooth geometric arch") and inside each column the underside
        // breaks again into blocks of their own widths, each broken off at its own depth, the step
        // between two a short slant: a blocky underside like the sketch's, never a drawn arc
        const bw = 16 + 22 * hash1(Math.floor(ss / 40), seed + 19);
        const bp = (ss + 30 * vnoise1(ss / 90, seed + 20)) / bw;
        const bi = Math.floor(bp), bf = bp - bi;
        const hA = hash1(bi, seed + 21), hB = hash1(bi + 1, seed + 21);
        const sl = clamp((bf - 0.86) / 0.14, 0, 1);
        dd += amp * hang * ((hA + (hB - hA) * sl) - 0.55) * 1.3;
      } else if (Math.abs(nx) > 0.55) {
        // a side: each block steps out or in
        dd += amp * (hash(c.L, c.k, seed + 17) - 0.45) * 1.6;
      }
      out.push(px + nx * dd * keep, py + ny * dd * keep);
    }
    s += len;
  }
  out.push(pts[n * 2 - 2]!, pts[n * 2 - 1]!);
  return out;
}

function build(p: RockP, seed: number): Built {
  const rough = p.rough ?? 10;
  const top = p.top;
  // the outline: the top exact; the bottom broken into chunks (its ends kept where they join the top)
  const bot = chunkEdge([top[top.length - 2]!, top[top.length - 1]!, ...p.bottom, top[0]!, top[1]!], rough, p.teeth ?? 0.4, p.joinR ?? 6, p.joinL ?? 6, p, seed);
  const outline = [...top, ...bot.slice(2, -2)];
  const box = boxOf(outline);
  const veg = p.veg ?? 0.6;
  const plants: Plant[] = [];
  const inOutline = new Spans(outline, Math.floor(box[1]) - 2, Math.ceil(box[3]) + 2);
  if (veg > 0) {
    const r = rng(seed + 77);
    const x0 = top[0]!, x1 = top[top.length - 2]!;
    const capH = p.capH ?? 10;
    // the lip: bushes hanging over the edge and strands of creeper, in rich and bare stretches
    // (in clumps: a patch of bushes, a bare stretch, a lone one; never evenly spaced)
    for (let x = x0 + 8; x < x1 - 8; x += 4 + r() * 10) {
      const rich = vnoise1(x / 160, seed + 79) * 0.7 + vnoise1(x / 47, seed + 80) * 0.3;
      if (rich < 0.6 - veg * 0.3) continue;
      const patch = vnoise1(x / 29, seed + 81);
      const y = yAt(top, x);
      const k = r(), rr = r(), sd = Math.floor(r() * 1e6);
      if (k < 0.34 * veg && patch > 0.5) plants.push({ kind: "bush", x, y: y + capH * 0.5, r: (4 + rr * 12 * rich) * (0.5 + (patch - 0.5) * 2), seed: sd });
      else if (k < 0.6 && patch > 0.3) plants.push({ kind: "strand", x, y: y + capH * 0.6, r: 6 + rr * 34 * rich * rich, seed: sd });
    }
    // ledges: where the band below a bedding plane stands out, soil collects; plant there
    // (round 3: sparser; the green caps on the chunks' ledges already carry the green, plants are
    // the odd bush, tuft or pine in the richer stretches)
    for (let x = box[0] + 10; x < box[2] - 10; x += 9 + r() * 22) {
      const rich = vnoise1(x / 130, seed + 83);
      if (rich < 0.5 - veg * 0.2) continue;
      const ty = yAt(top, x);
      let y = ty + 20;
      for (let n = 0; n < 30 && y < box[3]; n++) {
        const L = nextLedge(x, y, p, seed);
        if (!L) break;
        const ledge = L.y;
        y = ledge + 2;
        if (ledge > box[3] - 6) break;
        // only on the face itself (not on a ledge line that runs out past the outline)
        if (!inOutline.inside(Math.floor(x), Math.floor(ledge + 3)) || !inOutline.inside(Math.floor(x), Math.floor(ledge + 12))) continue;
        if (ledge < ty + 18) continue;
        if (p.fadeY !== undefined && ledge > p.fadeY + (p.fadeH ?? 80) * 0.2) break;
        if (r() > veg * 0.55 * rich) continue;
        const k = r();
        if (k < 0.12 && rich > 0.65) plants.push({ kind: "pine", x, y: ledge, r: 22 + r() * 26, seed: Math.floor(r() * 1e6) });
        else if (k < 0.72) plants.push({ kind: "bush", x, y: ledge + 1, r: 4 + r() * 10 * rich, seed: Math.floor(r() * 1e6) });
        else plants.push({ kind: "tuft", x, y: ledge, r: 3 + r() * 5, seed: Math.floor(r() * 1e6) });
      }
    }
  }
  let road: Road | undefined;
  if ((p.cap ?? "grass") === "path") {
    const r = rng(seed + 401);
    const x0 = top[0]!, x1 = top[top.length - 2]!;
    const flags: number[] = [], kerbs: number[] = [];
    for (let x = x0 - 10; x < x1 + 40; x += 12 + r() * 22) flags.push(x);
    for (let x = x0 - 6; x < x1 + 50; x += 17 + r() * 30) kerbs.push(x);
    // (round 5) the cliff's chunks breaking its front edge and the stones on it, laid by world x
    // (kerb.ts; the balustrade on the front plane finds the same ones), kept clear of the road's
    // ends (where it meets other ground)
    const rocks = kerbRocks(x0, x1).filter((q) => q.x0 > x0 + 10 && q.x1 < x1 - 10);
    road = { flags, kerbs, rocks };
    // grass in the odd chunk's moss
    for (const q of rocks) if (q.cap > 1.5 && q.kind !== "pebble" && veg > 0 && r() < 0.5) plants.push({ kind: "tuft", x: q.x0 + (q.x1 - q.x0) * (0.25 + 0.5 * r()), y: yAt(top, q.x0) + kerbTop(q, q.x0 + (q.x1 - q.x0) * 0.5) + 1, r: 2 + r() * 3, seed: Math.floor(r() * 1e6) });
  }
  for (const fd of p.forest ?? []) {
    const r = rng(seed + 131 + Math.round(fd));
    for (let x = top[0]! + 20; x < top[top.length - 2]! - 20; x += 5 + r() * 9) {
      // patches of forest on a ledge that wanders up and down the face, never a straight band
      const rich = vnoise1(x / 160, seed + 133 + Math.round(fd));
      if (rich < 0.45) continue;
      const fy = fd + (fbm1(x / 260, seed + 93 + Math.round(fd), 3) - 0.5) * 150 + (vnoise1(x / 60, seed + 94) - 0.5) * 30;
      const rr = (7 + r() * 14) * (0.6 + rich * 0.6), sd = Math.floor(r() * 1e6);
      // (round 3) green only on a chunk's top ledge: the forest stands on the nearest ledge
      const L = nextLedge(x, yAt(top, x) + fy - 40, p, seed);
      if (L && Math.abs(L.y - (yAt(top, x) + fy)) < 70) plants.push({ kind: "bush", x, y: L.y + 1, r: rr, seed: sd });
    }
  }
  return { outline, box, plants, road };
}

function builtFor(p: RockP, seed: number): Built {
  return cached(`rock|${seed}|${JSON.stringify(p).length}|${p.forest?.length}|${p.top.length}|${p.top[0]}|${p.top[1]}|${p.bottom.length}|${p.bottom[0]}|${p.rough}|${p.veg}`, () => build(p, seed));
}

/** The joint at or left of x in a sorted list: [its index, it, the next one]. */
function jointSpan(js: readonly number[], x: number): [number, number, number] {
  let lo = 0, hi = js.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (js[m]! <= x) lo = m; else hi = m; }
  return [lo, js[lo]!, js[Math.min(js.length - 1, lo + 1)]!];
}
/** One step (or two) darker in the same ramp: a shadow on what is painted. */
const DARKER = ((): Map<number, number> => {
  const m = new Map<number, number>();
  for (const [ramp, k] of [[P.karst, 2], [P.stone, 2], [P.moss, 2], [P.earth, 1], [P.pine, 1]] as const) ramp.forEach((v, i) => m.set(v, ramp[Math.min(ramp.length - 1, i + k)]!));
  return m;
})();

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
          // (round 4) a paved road: its stones and the rock breaking over its front edge
          if (inTop && capKind === "path" && B.road) {
            const R = B.road;
            const Q = depth < KERB_DEPTH ? rocksNear(R, lx) : NONE;
            const q = Q.length ? kerbAt(Q, lx, depth) : null;
            if (q) { b.set(x, y, kerbPx(q, lx, depth, d, x, y)); continue; }
            // a chunk's shadow on what lies behind it: its cast shadow down and to the right, the
            // contact shadow under its foot
            const sh = Q.length ? kerbShade(Q, lx, depth) : 0;
            let col = roadPx(c, R, lx, depth, x, y, seed);
            if (col > 0) {
              // grit fallen from the chunks on the road's lit top
              if (depth < 3 && Q.length) col = kerbGrit(Q, lx, depth) || col;
              b.set(x, y, sh ? DARKER.get(col) ?? col : col);
              continue;
            }
            if (col < 0) {
              // below the road: the shadow under its soil, then the rock (a chunk's shadow on it too)
              const under = -col - 1;
              if (sh === 2) { b.set(x, y, K[8]!); continue; }
              if (under < 3 / Math.max(d, 0.5)) { b.set(x, y, tone(P.earth, sh ? 0.95 : 0.82, x, y, 0.3)); continue; }
              if (under < 8 / Math.max(d, 0.5)) {
                b.set(x, y, tone(K, clamp(0.7 - under * 0.01 + (p.shade ?? 0) * 0.2 + (sh ? 0.15 : 0), 0, 1), x, y, 0.4));
                continue;
              }
              if (sh) {
                const F = face(lx, ly, depth, p, seed, d);
                b.set(x, y, tone(K, clamp(Math.max(F.t + 0.3, 0.72), 0, 1), x, y, 0.12));
                continue;
              }
            }
          }
          // the lip
          if (inTop && capKind !== "bare" && !(capKind === "path" && B.road)) {
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
          const F = face(lx, ly, depth, p, seed, d);
          let t = F.t;
          // edges: the shadow side and the underside go dark, the sunward side catches light
          if (!rightIn || !belowIn) t = Math.max(t + 0.28, 0.78);
          else if (!leftIn || (!above && !inTop)) t -= 0.16;
          else if (d >= 0.5 && (!sp.inside(x + 2, y + 2) || !sp.inside(x, y + 3))) t += 0.14;
          // a wet band where the rock meets still water
          if (p.water !== undefined && ly > p.water - 7 && ly < p.water + 1) t += 0.22;
          if (fog > 0) t = t * (1 - fog * 0.7);
          const mat = F.mat;
          // hard ramp steps, dithered only along a thin seam where two steps meet; a little slow
          // noise in the tone so no wide area sits on a seam (no checker fields, no moire when
          // the camera scales the plate between levels)
          t += (vnoise(lx / 7, ly / 7, seed + 201) - 0.5) * 0.06;
          if (mat === "moss" && rightIn && belowIn) b.set(x, y, tone(P.moss, clamp(t + 0.1, 0, 1), x, y, 0.12));
          else if (mat === "warm" && t < 0.42 && rightIn && belowIn && leftIn) b.set(x, y, tone(P.stone, clamp(t * 0.9, 0, 1), x, y, 0.12));
          else b.set(x, y, tone(K, clamp(t, 0, 1), x, y, 0.12));
        }
      }
    }
    // (round 5) what rises above the walk line: the tall chunks' tops and the stones on the road
    if (capKind === "path" && B.road) paintAboveRoad(c, p, B.road);
    paintPlants(c, B);
}

const NONE: KerbRock[] = [];

/** The road's chunks whose span reaches lx (bucketed by 32 px). */
function rocksNear(R: Road, lx: number): KerbRock[] {
  let m = BUCKETS.get(R);
  if (!m) {
    m = new Map();
    for (const q of R.rocks) for (let i = Math.floor((q.x0 - 12) / 32); i <= Math.floor((q.x1 + 12) / 32); i++) {
      const a = m.get(i);
      if (a) a.push(q); else m.set(i, [q]);
    }
    BUCKETS.set(R, m);
  }
  return m.get(Math.floor(lx / 32)) ?? NONE;
}
const BUCKETS = new WeakMap<Road, Map<number, KerbRock[]>>();

/** The tops of the chunks rising past the walk line, and the stones lying on the road. */
function paintAboveRoad(c: PaintCtx, p: RockP, R: Road): void {
  const b = c.buf, d = c.d;
  for (const q of R.rocks) {
    if (q.top >= 0) continue;
    const X0 = Math.max(b.ox, Math.floor(c.X(q.x0 - 2))), X1 = Math.min(b.x1, Math.ceil(c.X(q.x1 + 2)));
    if (X0 >= X1) continue;
    const wy = Math.min(yAt(p.top, q.x0), yAt(p.top, q.x1));
    const Y0 = Math.max(b.oy, Math.floor(c.Y(wy + q.top - 3))), Y1 = Math.min(b.y1, Math.ceil(c.Y(wy + 1)));
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        const lx = c.lx(x + 0.5), depth = c.ly(y + 0.5) - yAt(p.top, lx);
        if (depth >= 0) continue;
        const Q = rocksNear(R, lx);
        const hit = kerbAt(Q, lx, depth);
        if (hit) b.set(x, y, kerbPx(hit, lx, depth, d, x, y));
      }
    }
  }
}

/**
 * A pixel of the paved road at depth px below the walk line: > 0 a colour; < 0 below the road
 * (-(depth below its soil) - 1).
 */
function roadPx(c: PaintCtx, R: Road, lx: number, depth: number, x: number, y: number, seed: number): number {
  const d = c.d;
  const px = 1 / Math.max(d, 0.25);
  // the flagstones' lit top (a thin strip: we see the road almost edge-on)
  const surf = 2.4 + 0.9 * vnoise1(lx / 37, seed + 410);
  const [fi, fa] = jointSpan(R.flags, lx);
  const fk = hash1(fi, seed + 411);
  const sunk = fk < 0.18 ? 0.7 : 0;
  if (depth < surf + sunk) {
    if (depth < sunk) return 0;
    if (lx - fa < 0.9 * px && d >= 0.25) return hash1(fi, seed + 412) < 0.35 ? P.moss[4]! : P.stone[5]!;
    if (depth - sunk < px * 0.9) return fk < 0.5 ? P.stone[0]! : P.stone[1]!;
    // worn smooth where feet go, a stain here and there
    const t = 0.2 + 0.18 * fk + 0.25 * ((depth - sunk) / surf) + (vnoise(lx / 6, depth, seed + 413) > 0.7 ? 0.1 : 0);
    return tone(P.stone, clamp(t, 0, 1), x, y, 0.3);
  }
  // the kerb: cut stones of their own lengths and heights, one now and then missing
  const [ki, ka, kb] = jointSpan(R.kerbs, lx);
  const kk = hash1(ki, seed + 414);
  const kH = 3.6 + 2.6 * hash1(ki, seed + 415);
  const s = depth - surf;
  const missing = kk < 0.07;
  if (s < kH && !missing) {
    const ku = (lx - ka) / Math.max(1, kb - ka);
    if (lx - ka < 0.9 * px && d >= 0.25) return P.stone[6]!;
    if (s < px * 0.9) return ku < 0.15 ? P.stone[1]! : P.stone[2]!;
    if (kH - s < px * 0.9) return P.stone[6]!;
    // a chipped corner, weathering in streaks, moss where water sits at its foot
    if (kk > 0.8 && ku > 0.85 && s < 2.5) return P.stone[5]!;
    if (d >= 0.5 && kH - s < 2.2 && vnoise(lx / 3, s, seed + 416) > 0.62) return P.moss[5]!;
    let t = 0.4 + 0.16 * kk + 0.1 * (s / kH) + (ku < 0.1 ? -0.12 : ku > 0.8 ? 0.1 : 0);
    if (vnoise(lx / 2.4, depth / 9, seed + 417) > 0.7) t += 0.1;
    return tone(P.stone, clamp(t, 0, 1), x, y, 0.2);
  }
  // under it: a band of soil and moss, thick in the rich stretches, grass hanging over the rock
  const rich = vnoise1(lx / 70, seed + 6);
  const u = s - (missing ? 0 : kH);
  const m = 1.2 + 4.5 * rich * vnoise1(lx / 13, seed + 418) + (d >= 0.5 ? Math.abs(Math.sin(lx / 2.7 + vnoise1(lx / 9, seed) * 5)) * (0.5 + 2 * rich) : 0);
  if (u < m) {
    if (missing && u < 2) return P.earth[4]!;
    const t = u < 1 && !missing ? 0.55 : 0.32 + 0.45 * (u / m);
    return u > m - px ? P.moss[6]! : tone(vnoise(lx / 3, u, seed + 419) > 0.55 ? P.moss : P.earth, clamp(t, 0, 1), x, y, 0.3);
  }
  return -(u - m) - 1;
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
export function bush(c: PaintCtx, x: number, y: number, r: number, seed: number, strands = true): void {
  const d = c.d;
  const n = 3 + Math.floor(hash1(1, seed) * 4);
  const parts: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (hash1(i * 3 + 2, seed) - 0.5) * 2.4;
    const rr = r * (0.45 + 0.55 * hash1(i * 3 + 3, seed)) * (i === 0 ? 1.1 : 0.85);
    parts.push([x + Math.sin(a) * r * 0.9, y - r * 0.35 + Math.abs(Math.cos(a)) * -r * 0.3 + (i / n) * r * 0.5, rr, i]);
  }
  // hanging foliage first (behind the clumps)
  if (d >= 0.25 && strands) {
    const nStrands = Math.floor(r * 0.6 * hash1(9, seed));
    for (let k = 0; k < nStrands; k++) {
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

// ---------------------------------------------------------------------------
// Kagami's west shore. Two painters:
// - op.headland (back plane): the far west shore past the water's west end, the P3 continuation
//   of the near shore: the massif's wooded foot shelving down to the lake in rock steps, a
//   pebble beach, reeds at the water, stones standing out in it, everything sinking into haze.
//   Its top is woods (crowns of very different sizes, a pine or two), never a flat ramp.
// - op.shore (play plane): the west shore where the jetty leaves it: limestone steps going down
//   from the walk line to the water, mud and pebbles at the waterline, sunk stones, a fallen
//   trunk with its root plate, clustered grass and shrubs along the top.
// Both drawn in whole level-1 px (one density at the close band), light from the upper left.

export interface HeadlandP {
  /** Length (the headland rises to the west, its east end runs out into the water) and height, px. */
  w: number;
  h: number;
}

/** The headland's ground top at local x (0 west .. w east), px above the waterline. */
function headTop(p: HeadlandP, lx: number, seed: number): number {
  const u = lx / p.w;
  if (u < -0.02 || u > 1) return -Infinity;
  // high and wooded to the west; to the east it steps down to the water in ledges of rock,
  // each its own height and width, their lips rounded off
  let sh = 1;
  if (u > 0.6) {
    const k = (u - 0.6) / 0.4;
    const edges = [0, 0.22 + 0.1 * hash1(1, seed), 0.5 + 0.1 * hash1(2, seed), 0.74 + 0.08 * hash1(3, seed), 1];
    const lv = [1, 0.62 + 0.12 * hash1(4, seed), 0.36 + 0.1 * hash1(5, seed), 0.14 + 0.06 * hash1(6, seed), 0];
    let i = 0;
    while (i < 3 && k > edges[i + 1]!) i++;
    const f = (k - edges[i]!) / (edges[i + 1]! - edges[i]!);
    // a ledge: level, then rounding over its lip into the next one down
    const lip = f > 0.72 ? Math.pow((f - 0.72) / 0.28, 1.6) : 0;
    sh = lv[i]! + (lv[i + 1]! - lv[i]!) * lip;
  }
  return p.h * 0.62 * sh * (0.85 + 0.3 * fbm1(lx / 140, seed + 1, 3)) + (vnoise1(lx / 9, seed + 2) - 0.5) * 4 * Math.min(1, sh * 3) - (u > 0.97 ? (u - 0.97) * 100 : 0);
}

/** The leaf cluster a point falls in: weighted cells of mixed sizes; how lit it is there (-1..1). */
function leafCell(lx: number, ly: number, seed: number, G = 12): { lit: number; q: number } {
  const gx = Math.floor(lx / G), gy = Math.floor(ly / G);
  let best = Infinity, bx = 0, by = 0, br = 1;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const px = (cx + 0.5 + (hash(cx, cy, seed) - 0.5) * 0.9) * G, py = (cy + 0.5 + (hash(cx, cy, seed + 1) - 0.5) * 0.9) * G;
    const R = G * (0.5 + 0.75 * hash(cx, cy, seed + 2));
    const q = Math.hypot(lx - px, ly - py) / R;
    if (q < best) { best = q; bx = px; by = py; br = R; }
  }
  const dx = (lx - bx) / br, dy = (ly - by) / br;
  return { lit: clamp(-(0.62 * dx + 0.78 * dy) * 1.3, -1, 1), q: best };
}

export const headland = definePainter<HeadlandP>("op.headland", {
  bounds(p) {
    return [-40, -p.h - 60, p.w + 60, 140];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const X0 = Math.max(b.ox, Math.floor(c.X(-30))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w + 2)));
    // (art loop round 3) the far wooded shore (P3: cooler, simpler, its darks lifted): the woods
    // as masses of leaf clusters of very different sizes with dark pockets between them (never a
    // field of shaded balls), limestone blocks breaking out of the slope with a cap of green, a
    // shoreline that changes as it goes (wet rock, mud, grass to the water, reeds), the lake's
    // mirror starting right at it.
    const crowns = cached(`headland-crowns|${seed}|${p.w}|${p.h}`, () => {
      const r = rng(seed + 120);
      const out: [number, number, number, number][] = [];
      // big trees first (they stand up out of the canopy), then medium, then small ones filling
      for (const [n, r0, r1] of [[34, 18, 34], [150, 9, 17], [280, 4, 9]] as const) {
        for (let i = 0; i < n; i++) {
          const x = p.w * 0.9 * r() - 10;
          const T = headTop(p, Math.max(0, x), seed);
          if (T === -Infinity || T < 8) continue;
          const depth = (24 + 80 * fbm1(x / 120, seed + 24, 2)) * clamp((0.9 - x / p.w) / 0.14, 0, 1);
          if (depth < 6) continue;
          const R = r0 + (r1 - r0) * r() * (0.55 + 0.45 * (1 - x / p.w));
          const y = r0 > 15 ? -T - R * (0.3 + 0.35 * r()) : -T + Math.pow(r(), r0 < 8 ? 0.7 : 1.3) * depth - R * 0.3;
          out.push([x, y, R, Math.floor(r() * 1e6)]);
        }
      }
      // (round 3) the slope below the canopy, filled with crowns down to the shore
      for (let i = 0; i < 260; i++) {
        const x = p.w * 0.84 * r() - 10;
        const T = headTop(p, Math.max(0, x), seed);
        if (T === -Infinity || T < 14) continue;
        const R = 5 + Math.pow(r(), 1.8) * 12;
        out.push([x, -T + R * 0.4 + r() * Math.max(0, T - R - 6), R, Math.floor(r() * 1e6)]);
      }
      return out.sort((a, q) => a[1] + a[2] * 0.5 - (q[1] + q[2] * 0.5));
    });
    // rock blocks breaking out of the wooded slope: a few, of their own sizes
    const blocks = cached(`headland-blocks|${seed}|${p.w}|${p.h}`, () => {
      const r = rng(seed + 140);
      const out: LimeChunk[] = [];
      for (const fx of [0.12, 0.31, 0.47, 0.63, 0.74]) {
        const x = p.w * (fx + (r() - 0.5) * 0.05), T = headTop(p, x, seed);
        if (T === -Infinity || T < 10) continue;
        const w = 18 + r() * 40, top = -T + 6 + r() * Math.min(40, T * 0.5);
        out.push({ x0: x, x1: x + w, top, foot: Math.min(-1, top + 10 + r() * 18), tilt: (r() - 0.5) * 0.12, z: 0.35 + 0.3 * r(), cap: 2 + r() * 3, shade: 0.08, seed: seed + 150 + Math.round(fx * 100) });
      }
      return out;
    });
    // the ground under the woods: shade, two steps of it, and the shoreline
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      const T = headTop(p, Math.max(0, lx), seed);
      if (T === -Infinity) continue;
      const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(136)));
      // the shoreline's kind here: wet rock, mud, or grass running down to the water
      const kind = vnoise1(lx / 19, seed + 9) * 0.7 + vnoise1(lx / 6, seed + 10) * 0.3;
      const sh = kind < 0.36 ? 3 + 9 * vnoise1(lx / 7, seed + 8) * vnoise1(lx / 2.5, seed + 11) + 2 * vnoise1(lx / 3, seed + 12) : kind < 0.55 ? 1 + vnoise1(lx / 3, seed + 7) : 3 + 3 * vnoise1(lx / 5, seed + 6);
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        if (ly < -T) continue;
        let col: number;
        if (ly > 0) {
          // the shore toward the camera (only seen west of the water)
          const m = vnoise(lx / 40, ly / 9, seed + 7) * 0.7 + vnoise(lx / 11, ly / 4, seed + 6) * 0.3;
          col = m > 0.6 ? P.moss[5]! : m > 0.36 ? P.pine[2]! : P.pine[3]!;
        } else if (-ly < sh) {
          const up = -ly;
          if (kind < 0.36) col = up > sh - 1 ? P.karst[4]! : up < 1.2 ? P.karst[8]! : vnoise1(lx / 2, seed + 13) > 0.6 ? P.karst[7]! : P.karst[6]!;
          else if (kind < 0.55) col = up < 0.8 && vnoise1(lx / 3, seed + 5) > 0.5 ? P.jade[2]! : P.earth[5]!;
          else col = up > sh - 1 ? P.moss[4]! : up < 1.4 ? P.pine[3]! : P.moss[5]!;
        } else {
          // the undergrowth on the slope: leaf clusters of two sizes, dark pockets between
          const s = ly + T;
          const L = leafCell(lx, ly, seed + 15, 16);
          const k = 4 - (L.lit > 0.35 ? 1 : 0) + (L.q > 0.85 && L.lit < 0.1 ? 1 : 0) + (s > 50 ? 1 : 0);
          col = s < 1.5 ? P.moss[4]! : [P.moss[4]!, P.moss[5]!, P.pine[1]!, P.pine[2]!, P.pine[3]!, P.pine[4]!][clamp(k, 1, 5)]!;
        }
        b.set(x, y, col);
      }
    }
    for (const q of blocks) limeChunk(c, q);
    // the woods: each crown a lumpy mass, light only along its upper-left rim, inside it leaf
    // clusters of two sizes catching the light or turning into shade; where a crown meets the one
    // behind it, a dark pocket. Cool greens only (P3).
    const COL = [P.moss[3]!, P.moss[4]!, P.pine[0]!, P.pine[1]!, P.pine[2]!, P.pine[3]!, P.pine[4]!];
    for (const [cx, cy, R, cs] of crowns) crown(c, cx, cy, R, cs, COL, 2.6 + clamp(cx / p.w - 0.5, 0, 1) * 0.6, -1.5);
    const r = rng(seed + 20);
    // a pine or two standing out of the woods
    for (let x = 40; x < p.w * 0.7; x += 140 + r() * 260) {
      const T = headTop(p, x, seed);
      const R = 8 + r() * 8;
      if (d >= 0.3 && T > 30) needlePad(c, x, -T - 26 - R * 0.6, R * 2.6, R * 0.7, seed + Math.round(x * 3), 0.2);
    }
    // shrubs leaning out over the water here and there, their undersides dark over the lake
    for (let x = 30; x < p.w * 0.86; x += 40 + r() * 90) {
      const R = 4 + r() * 8;
      if (d >= 0.3) clump(c, x, -R * 0.55 - 1, R, P.moss.slice(3, 7), P.pine.slice(2), 0.55, seed + Math.round(x * 5), 0.7);
    }
    // the water's edge: reeds and grass in clumps, wet stones standing out in the lake
    for (let x = -20; x < p.w; x += 24 + r() * r() * 110) {
      const n = 3 + Math.floor(r() * 10), tall = 5 + r() * 15;
      for (let k = 0; k < n; k++) {
        const bx = x + (r() - 0.5) * 16, a = (r() - 0.45) * 0.5, bd = (r() - 0.45) * 0.8, l = r() * 0.7, ln = tall * (0.4 + 0.6 * r());
        if (d >= 0.3) grass(c, bx, 0.5, ln, a, bd, l);
      }
      if (r() < 0.45) {
        const sx = x + r() * 24, R = 1.5 + r() * r() * 5;
        for (let oy = -R; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
          if ((ox / (R * 1.3)) * (ox / (R * 1.3)) + (oy / R) * (oy / R) > 1) continue;
          dot(c, sx + ox, oy, oy > -0.8 ? P.karst[8]! : ox < -R * 0.3 ? P.karst[3]! : P.karst[5]!);
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const sx = p.w * (0.86 + 0.18 * r()), R = 2 + r() * 4;
      for (let oy = -R; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
        if ((ox / (R * 1.3)) * (ox / (R * 1.3)) + (oy / R) * (oy / R) > 1) continue;
        dot(c, sx + ox, oy, oy > -1.2 ? P.karst[7]! : ox < -R * 0.3 ? P.karst[3]! : P.karst[5]!);
      }
    }
    for (let i = 0; i < 70; i++) {
      const x = p.w * (0.66 + 0.38 * r());
      const T = Math.max(0, headTop(p, Math.min(p.w, x), seed));
      const len = 6 + r() * 18;
      const a = (r() - 0.45) * 0.6, bd = (r() - 0.45) * 0.8, l = r() * 0.8;
      if (d >= 0.3 && T < 30) grass(c, x, -T + 1, len, a, bd, l);
    }
  },
});

/**
 * (round 3) One crown of leaves seen side-on: a lumpy mass, light only along its upper-left rim,
 * inside it leaf clusters of two sizes catching the light or turning into shade, a dark pocket
 * where they meet; its lower part in its own shade. Never a shaded ball. `cols` lit to dark,
 * `t0` its middle step.
 */
function crown(c: PaintCtx, cx: number, cy: number, R: number, cs: number, cols: readonly number[], t0: number, maxY = Infinity): void {
  const b = c.buf, d = c.d;
  if (lxOut(c, cx, R)) return;
  const Xa = Math.max(b.ox, Math.floor(c.X(cx - R * 1.3))), Xb = Math.min(b.x1, Math.ceil(c.X(cx + R * 1.3)));
  const Ya = Math.max(b.oy, Math.floor(c.Y(cy - R * 1.2))), Yb = Math.min(b.y1, Math.ceil(c.Y(cy + R * 1.1)));
  const bump = Math.max(2.2, R * 0.35);
  const n = cols.length - 1;
  for (let y = Ya; y < Yb; y++) {
    const ly = LY(c, y);
    if (ly > maxY) continue;
    for (let x = Xa; x < Xb; x++) {
      const lx = LX(c, x);
      const dx = lx - cx, dy = (ly - cy) * 1.1;
      const ang = Math.atan2(dy, dx);
      const rim = R * (0.78 + 0.26 * vnoise1(ang * (R / bump) * 0.5 + 3, cs) + (d >= 0.5 ? 0.08 * vnoise1(ang * (R / bump) * 1.6, cs + 1) : 0)) * (dy > 0 ? 0.86 : 1);
      const q = Math.hypot(dx, dy) / rim;
      if (q > 1) continue;
      const lit = -(0.62 * dx + 0.78 * dy) / rim;
      const L = leafCell(lx, ly, cs + 2, Math.max(5, R * 0.55)), L2 = leafCell(lx, ly, cs + 3, Math.max(3, R * 0.22));
      let t = t0 + (dy > R * 0.2 ? 1.2 : 0);
      if (L.lit > 0.3) t -= 1;
      else if (L.lit < -0.3) t += 1;
      if (L2.lit > 0.45) t -= 0.6;
      if (L.q > 0.88 && L.lit < 0.1) t += 1.4;
      if (q > 0.8 && lit > 0.3) t -= 1.2;
      if (q > 0.84 && lit < -0.1) t += 1.2;
      b.set(x, y, cols[clamp(Math.round(t), 0, n)]!);
    }
  }
}

/** Is a crown at local x with radius R wholly outside this buffer's columns? */
function lxOut(c: PaintCtx, cx: number, R: number): boolean {
  return c.X(cx + R * 1.3) < c.buf.ox || c.X(cx - R * 1.3) > c.buf.x1;
}

export interface ShoreP {
  /** Length along the shore, px; the anchor is its west end at the waterline. */
  w: number;
  /** The walk line's height above the water along the shore [x, h, ...] (local px): nothing here
   *  rises above it where she walks. */
  walk: number[];
  /** Where the shore runs out under the water (local x). */
  end: number;
}

export const shore = definePainter<ShoreP>("op.shore", {
  bounds(p) {
    let hm = 0;
    for (let i = 1; i < p.walk.length; i += 2) hm = Math.max(hm, p.walk[i]!);
    return [-180, -hm - 200, p.w + 60, 12];
  },
  paint(c, p) {
    const d = c.d, seed = c.seed;
    const walkAt = (x: number): number => yAt(p.walk, x);
    const r = rng(seed + 3);
    const e = p.end;
    // a thicket at the shore's west end: shrubs heaped on the bank, tall grass and reeds in
    // front; the dark left edge of the play-west view
    // (a heap of small leaf clusters inside a lopsided mound, so its edge is lumpy at every
    // scale; darker deeper in and lower down, the upper left catching the light)
    const th: [number, number, number, number][] = [];
    const heapH = (x: number): number => {
      const u = (x - 10) / 180;
      if (u < 0 || u > 1) return 0;
      return 150 * Math.pow(1 - u, 0.8) * Math.pow(Math.min(1, u * 8 + 0.3), 0.5) * (0.8 + 0.4 * vnoise1(x / 37, seed + 11));
    };
    for (let i = 0; i < 70; i++) {
      const x = 10 + r() * 180;
      const H = heapH(x);
      if (H < 6) continue;
      const v = Math.pow(r(), 0.7);
      // (clusters of very different sizes: a few big heads, many small)
      const R = 3 + Math.pow(r(), 2.2) * 19 * (1 - v * 0.3);
      th.push([x, -walkAt(x) - H * v + R * 0.3, R, v]);
    }
    th.sort((q, w) => q[1] - w[1]);
    // its body: leaf clusters filling the mound, darker deeper in; then the clusters on its skin
    {
      const b = c.buf;
      const X0 = Math.max(b.ox, Math.floor(c.X(10))), X1 = Math.min(b.x1, Math.ceil(c.X(190)));
      for (let x = X0; x < X1; x++) {
        const lx = LX(c, x);
        const H = heapH(lx) * 0.82 + (vnoise1(lx / 9, seed + 12) - 0.5) * 10;
        if (H < 4) continue;
        const wk = walkAt(lx);
        const Y0 = Math.max(b.oy, Math.floor(c.Y(-wk - H) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(-wk + 3)));
        for (let y = Y0; y < Y1; y++) {
          const ly = LY(c, y);
          const inD = ly + wk + H;
          if (inD < 0 || ly > -wk + 3) continue;
          // big masses of leaves and small clusters in them (two sizes of cell, never one grid)
          const L = leafCell(lx, ly, seed + 13, 26), L2 = leafCell(lx, ly, seed + 14, 8);
          const t = 0.42 - (L.lit > 0.35 ? 0.22 : L.lit > -0.2 ? 0 : -0.18) - L2.lit * 0.1 + clamp(inD / 70, 0, 1) * 0.5 + (L.q > 0.85 && L.lit < 0 ? 0.24 : 0);
          const i = clamp(Math.round(t * 4), 0, 4);
          b.set(x, y, [P.moss[3]!, P.moss[4]!, P.moss[5]!, P.pine[2]!, P.pine[3]!][i]!);
        }
      }
    }
    // (round 3) its skin: crowns of leaf clusters (warmer than the far woods: P4), never balls
    const TH = [P.moss[2]!, P.moss[3]!, P.moss[4]!, P.moss[5]!, P.pine[1]!, P.pine[2]!, P.pine[3]!];
    for (const [x, y, R, v] of th) if (v > 0.55) crown(c, x, y, R * 1.1, seed + Math.round(x * 13 + y * 7), TH, 2.4 + (1 - v) * 1.5);
    // (art loop round 3) the shore itself: limestone chunks stepping down into the water at
    // different heights and depths (Dex's chunk sketch; the top half of round-3/gen/g4): the bank's
    // back blocks carry the walk line on their tops under a cap of turf, nearer and lower blocks
    // stand in front of them in the water casting their shadows on them, mud and pebbles where the
    // ground runs out under the jetty's first piles, stones half sunk in front, reeds in clumps, a
    // kinked branch of driftwood. Every contact with the lake has its wet band and bright line; the
    // lake mirrors all of it (play plane). No edge runs straight for more than a few blocks.
    const top = (x: number): number => -walkAt(x);
    // the ground under the jetty's first piles: from the walk line's end down to the water, concave
    const mudH = (x: number): number => {
      const k = clamp((x - e * 0.66) / (e * 0.34), 0, 1);
      return Math.max(0, walkAt(Math.min(x, e * 0.73)) * Math.pow(1 - k, 1.6)) + (vnoise1(x / 11, seed + 31) - 0.5) * 3 + (vnoise1(x / 3, seed + 32) - 0.5) * 1.2;
    };
    // behind the path the ground rises in a few blocks of its own (darker, cooler, simpler): they
    // break the long walk line into an irregular skyline (the path meets their feet)
    const back: LimeChunk[] = [];
    for (const [fx0, fx1, up, z] of [[0.33, 0.45, 15, 0.2], [0.56, 0.67, 24, 0.14]] as const) {
      const x0 = e * fx0 + (r() - 0.5) * 6, x1 = e * fx1 + (r() - 0.5) * 6;
      back.push({ x0, x1, top: top(x0) - up * (0.8 + 0.4 * r()), foot: top((x0 + x1) / 2) + 3, tilt: (r() - 0.5) * 0.1, z, cap: 3 + r() * 3, shade: 0.08, seed: seed + 50 + Math.round(fx0 * 100) });
    }
    for (const q of back) limeChunk(c, q);
    for (const q of back) {
      // shrubs and grass on their tops
      const n = 4 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) {
        const gx = q.x0 + 3 + r() * (q.x1 - q.x0 - 6), ln = 3 + r() * 9;
        if (d >= 0.3) grass(c, gx, chunkTop(q, gx) + 1.5, ln, (r() - 0.45) * 0.9, (r() - 0.4) * 1.1, r());
      }
      if (r() < 0.6 && d >= 0.3) clump(c, q.x0 + (q.x1 - q.x0) * (0.2 + 0.6 * r()), chunkTop(q, (q.x0 + q.x1) / 2) - 2, 3 + r() * 4, P.moss.slice(2, 7), P.pine.slice(1), 0.5, seed + Math.round(q.x0 * 7), 0.8);
    }
    // the bank's blocks, carrying the walk line on their tops under a cap of turf: each its own
    // block (a joint, a notch where they meet), the nearer, lower ones standing in front
    const A1: LimeChunk = { x0: -170, x1: e * 0.15, top: top(0), foot: 6, topAt: (x) => top(x) + 0.6 + Math.max(0, x - e * 0.12) * 0.25, z: 0.4, cap: 3, water: 0, shade: 0.07, seed: seed + 41 };
    const A2: LimeChunk = { x0: e * 0.145, x1: e * 0.4, top: top(e * 0.3), foot: 6, topAt: (x) => top(x) + 0.6 + Math.max(0, e * 0.17 - x) * 0.3, z: 0.24, cap: 3, water: 0, shade: 0.07, seed: seed + 43 };
    const A3: LimeChunk = { x0: e * 0.395, x1: e * 0.71, top: top(e * 0.5), foot: 6, topAt: (x) => top(x) + 1.2, z: 0.34, cap: 3, water: 0, shade: 0.07, seed: seed + 44 };
    // (round 5, the critic: "loaves on one ruled base") B tips hard toward the water
    const B: LimeChunk = { x0: e * 0.11, x1: e * 0.22, top: -33 - 4 * r(), foot: 5, tilt: 0.24, z: 0.86, cap: 3, water: 0, seed: seed + 45 };
    const B2: LimeChunk = { x0: e * 0.235, x1: e * 0.33, top: -19 - 3 * r(), foot: 5, tilt: -0.07, z: 0.7, cap: 2, water: 0, seed: seed + 46 };
    const C: LimeChunk = { x0: e * 0.53, x1: e * 0.62, top: -13 - 3 * r(), foot: 5, tilt: 0.1, z: 0.96, cap: 2, water: 0, seed: seed + 47 };
    // the back blocks first, the nearer ones' shadows on them
    limeChunk(c, A1, [B]);
    limeChunk(c, A2, [B, B2]);
    limeChunk(c, A3, [C]);
    // the turf on the bank: blades standing up out of the walk line in clumps with gaps, so its
    // edge is never ruled; a few strands hanging over the stone face
    for (let x = -165; x < e * 0.7; x += 4 + r() * r() * 26) {
      const n = 2 + Math.floor(r() * 7), rich = vnoise1(x / 37, seed + 33);
      for (let k = 0; k < n; k++) {
        const gx = x + (r() - 0.5) * 8, ln = (2.5 + r() * 8) * (0.5 + rich), a = (r() - 0.45) * 0.9, bd = (r() - 0.4) * 1.1, l = r();
        if (d >= 0.3) grass(c, gx, top(gx) + 1.5, ln, a, bd, l);
      }
      if (r() < 0.22 && d >= 0.3) {
        const sx = x + r() * 6, ln = 4 + r() * 9;
        for (let s = 0; s < ln; s += 0.5) dot(c, sx + Math.sin(s / 3 + x) * 0.8, top(sx) + 5 + s, s < ln * 0.5 ? P.moss[5]! : P.moss[6]!);
      }
    }
    // the mud where the ground runs out under the jetty: wet earth, darker toward the water, a
    // bright line where the lake laps it; pebbles in clusters on it
    {
      const b = c.buf;
      const X0 = Math.max(b.ox, Math.floor(c.X(e * 0.4))), X1 = Math.min(b.x1, Math.ceil(c.X(e * 1.08)));
      for (let x = X0; x < X1; x++) {
        const lx = LX(c, x);
        const H = mudH(lx);
        if (H < 0.6) continue;
        for (let y = Math.max(b.oy, Math.floor(c.Y(-H) - 1)); y < Math.min(b.y1, Math.ceil(c.Y(5))); y++) {
          const ly = LY(c, y);
          if (ly < -H) continue;
          if (inChunk(C, lx, ly) || (lx < A3.x1 + 2 && inChunk(A3, lx, ly))) continue;
          const s = ly + H;
          let col: number;
          if (ly > 0.5) col = P.umber[3]!;
          else if (ly > -0.5) col = vnoise1(lx / 5, seed + 34) > 0.4 ? P.jade[1]! : P.umber[2]!;
          else if (s < 1) col = P.earth[3]!;
          else if (-ly < 2.5 + 1.5 * vnoise1(lx / 6, seed + 35)) col = P.umber[2]!;
          else col = vnoise(lx / 9, ly / 3, seed + 36) > 0.55 ? P.earth[5]! : P.earth[4]!;
          b.set(x, y, col);
        }
      }
      for (let x = e * 0.42; x < e * 1.02; x += 1.4 + r() * 3.5) {
        const dens = vnoise1(x / 21, seed + 37);
        if (r() > dens * 1.1) continue;
        const H = mudH(x);
        if (H < 1.5) continue;
        const R = 0.8 + r() * 2.2 * dens, py = -H + 0.5 + r() * Math.min(H - 1, 6);
        for (let oy = -R; oy <= 0.2; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
          if ((ox / (R * 1.3)) ** 2 + (oy / R) ** 2 > 1) continue;
          const lit = (-0.62 * ox - 0.78 * oy) / R;
          dot(c, x + ox, py + oy, oy > -0.5 ? P.earth[5]! : lit > 0.45 ? P.stone[2]! : lit > -0.2 ? P.stone[4]! : P.stone[5]!);
        }
      }
    }
    // the nearer blocks standing in the water in front of the bank
    limeChunk(c, B);
    limeChunk(c, B2, [B]);
    limeChunk(c, C);
    // (round 5, the critic: "loaves on one ruled base at y about 787") the blocks meet the water at
    // different heights: mud shelves heaped against their feet, each its own height and its own lit
    // lip, stepping down into the water, two of the blocks buried in them to well up their faces,
    // reeds and sedge growing out of them, a bright line only where the lake laps a shelf
    const shelf = (x0: number, x1: number, h0: number, sd: number): void => {
      const b = c.buf;
      // heaped against the block at its high end, falling away to the water in two or three treads
      const hi = hash1(9, sd) < 0.5;
      const hAt = (lx: number): number => {
        const u = (lx - x0) / (x1 - x0);
        if (u < 0 || u > 1) return -1;
        const v = hi ? u : 1 - u;
        const ends = Math.min(1, (1 - v) / 0.3);
        const nT = 2 + Math.floor(hash1(1, sd) * 2);
        const tv = v * nT + 0.35 * (vnoise1(lx / 9, sd + 1) - 0.5);
        const ti = Math.min(nT - 1, Math.floor(tv)), tf = clamp((tv - ti - 0.8) / 0.2, 0, 1);
        const tH = (k: number): number => 1 - 0.3 * k + 0.14 * (hash1(k, sd + 2) - 0.5);
        const th = h0 * (tH(ti) + (ti < nT - 1 ? (tH(ti + 1) - tH(ti)) * tf * tf * (3 - 2 * tf) : 0));
        return Math.max(0.5, th * Math.pow(ends, 0.7) + (vnoise1(lx / 4.5, sd + 3) - 0.5) * 2.4 + (vnoise1(lx / 1.7, sd + 11) - 0.5) * 1);
      };
      const X0 = Math.max(b.ox, Math.floor(c.X(x0))), X1 = Math.min(b.x1, Math.ceil(c.X(x1)));
      for (let x = X0; x < X1; x++) {
        const lx = LX(c, x);
        const H = hAt(lx);
        if (H < 0.6) continue;
        const lip = hAt(lx - 2) < H - 1.2;
        for (let y = Math.max(b.oy, Math.floor(c.Y(-H) - 1)); y < Math.min(b.y1, Math.ceil(c.Y(1))); y++) {
          const ly = LY(c, y);
          if (ly < -H) continue;
          const sdp = ly + H;
          let col: number;
          // a lit lip of earth and moss, the shelf's face of wet earth with roots and stones in it,
          // darker toward the water, a broken bright line where the lake laps it
          if (ly > -0.5) col = vnoise1(lx / 5, sd + 4) > 0.45 ? P.jade[1]! : P.pine[5]!;
          else if (sdp < 1) col = lip || vnoise1(lx / 6, sd + 5) > 0.45 ? P.earth[2]! : P.moss[3]!;
          else if (sdp < 2.6 && vnoise1(lx / 3, sd + 6) > 0.4) col = vnoise1(lx / 7, sd + 9) > 0.5 ? P.moss[4]! : P.moss[5]!;
          else if (-ly < 2 + 1.5 * vnoise1(lx / 6, sd + 7)) col = P.pine[5]!;
          else if (hash(Math.floor(lx / 2), Math.floor(ly / 2), sd + 10) < 0.06) col = P.stone[3]!;
          else col = vnoise(lx / 7, ly / 2.5, sd + 8) > 0.62 ? P.earth[5]! : sdp < 5 ? P.earth[3]! : P.earth[4]!;
          b.set(x, y, col);
        }
      }
      // sedge and reeds out of it in clumps, a gap between
      if (d >= 0.3) for (let gx = x0 + 3 + r() * 6; gx < x1 - 3; gx += 5 + r() * r() * 28) {
        const H = hAt(gx);
        if (H < 1.5) continue;
        const n = 2 + Math.floor(r() * 5);
        for (let k = 0; k < n; k++) grass(c, gx + (r() - 0.5) * 5, -H + 1, 4 + r() * 12, (r() - 0.5) * 0.6, (r() - 0.45) * 1.1, r() * 0.7);
      }
    };
    shelf(-120, e * 0.1, 12 + 4 * r(), seed + 71);
    shelf(e * 0.22, e * 0.42, 17 + 4 * r(), seed + 72);
    shelf(e * 0.5, e * 0.61, 8 + 3 * r(), seed + 73);
    // stones half sunk in front, in a loose group: each a small chunk with its wet band and line
    const stones: LimeChunk[] = [];
    for (const [fx, fw, fh] of [[0.9, 15, 5], [0.97, 24, 7], [1.06, 9, 3], [1.13, 13, 4]] as const) {
      const x0 = e * fx + (r() - 0.5) * 10;
      stones.push({ x0, x1: x0 + fw * (0.8 + 0.4 * r()), top: -fh * (0.8 + 0.4 * r()), foot: 3, tilt: (r() - 0.5) * 0.12, z: 0.62 + 0.3 * r(), cap: r() < 0.5 ? 1.5 : 0, water: 0, seed: seed + 60 + Math.round(fx * 100) });
    }
    for (const q of stones) limeChunk(c, q);
    // a branch of driftwood washed up against the near block: kinked, tapering, silvered on top,
    // its far end in the water; its shadow on the mud under it
    {
      const x0 = C.x1 - 6, y0 = C.top + 3;
      const pts: [number, number][] = [];
      let x = x0, y = y0;
      for (let k = 0; k <= 9; k++) {
        pts.push([x, y]);
        const kink = k === 3 || k === 6 ? (k === 3 ? -0.5 : 0.35) : 0;
        x += 6.5 + r() * 2.5;
        y += 1.3 + kink * 4 + (r() - 0.5) * 0.8;
      }
      if (d >= 0.3) {
        for (const [px, py] of pts) if (py < -0.5) dot(c, px + 1, py + 2.2, P.umber[3]!);
        stroke(c, pts, (u) => 3.4 - 2 * u, (u, sd) => {
          const [, py] = pts[Math.min(pts.length - 1, Math.round(u * (pts.length - 1)))]!;
          if (py > -0.6) return P.umber[2]!;
          return sd < -0.3 ? P.earth[1]! : sd < 0.4 ? P.earth[3]! : P.umber[1]!;
        });
        const [bx, by] = pts[4]!;
        stroke(c, bladePath(bx, by - 1, 5 + r() * 4, 0.6, -0.5), () => 1, () => P.earth[2]!);
      }
    }
    // reeds where the shore goes into the water, three clumps of their own heights
    for (const [rx, rw, rh, n] of [[e * 0.47, 14, 20, 12], [e * 0.69, 10, 13, 8], [e * 1.17, 18, 26, 15]] as const) {
      for (let k = 0; k < n; k++) {
        const bx = rx + (r() - 0.5) * rw, ln = rh * (0.35 + 0.65 * r());
        if (d >= 0.3) grass(c, bx, 0.5 - Math.max(0, mudH(bx)) * 0.4, ln, (r() - 0.5) * 0.35, (r() - 0.5) * 0.8, r() * 0.7);
      }
    }
    // tall grass in front of the thicket's foot (on the bank's top)
    for (let i = 0; i < 34; i++) {
      const x = 10 + r() * 190;
      const ln = 8 + r() * 26 * (1 - x / 260), a = (r() - 0.5) * 0.7, bd = (r() - 0.4) * 1.4, l = r();
      grass(c, x, -walkAt(x) + 2, ln, a, bd, l * 0.8, ln > 26);
    }
  },
});


// ---------------------------------------------------------------------------
// Kagami's east end (front plane): op.scree, where the lake runs out against the foot of the
// east lip. (Round 3) A few big limestone blocks fallen from the lip lie half sunk in the
// shallows in a chain coming toward the camera: the nearer a block, the lower in the frame and the
// bigger it is, each on its own waterline with a wet band, a bright line and its own painted
// reflection; they overlap where the water ends against the rock, so the lake never ends in a
// ruled edge, and leave the water open round their west sides. Drawn in whole level-1 px.

export interface ScreeP {
  /** Length along the waterline, px (anchor: its west end at the waterline). */
  w: number;
  /** How far toward the camera (down the frame) the chain of blocks reaches, px. */
  deep: number;
  /** Height of the tallest blocks above the waterline (against the lip at the east end), px (default 26). */
  h?: number;
}

export const scree = definePainter<ScreeP>("op.scree", {
  bounds(p) {
    return [-48, -(p.h ?? 26) * 1.5 - 50, p.w + 34, p.deep * 1.2 + 40];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    // (art loop round 3) a few big blocks fallen from the lip, lying in the shallows where the lake
    // runs out against its foot: a chain of them coming toward the camera (each nearer one lower
    // in the frame, bigger, standing on its own waterline), overlapping so the water never ends
    // on a ruled line against the rock, the lake open round their west sides. Each block stands
    // in the water on its own wet band and bright line and paints its own reflection (the lake
    // does not mirror the front plane below its waterline), broken by ripples and fading down;
    // reeds in their joints, a branch of driftwood across two of them.
    const H = p.h ?? 26, W = p.w, D = p.deep;
    const r = rng(seed + 20);
    // [x0, x1 as shares of w, base as a share of deep, height as a share of h, tilt, z, shade]:
    // one big block against the lip, a slab fallen aslant, small ones between, a big one nearest
    // (they overlap down the band where the lake's end falls in front of the lip, x 0..16 at the
    // frames that see it, so no ruled edge of water against rock shows between them)
    const plan: [number, number, number, number, number, number, number][] = [
      // (round 4, the critic's "scree pillows": blocks of one size and value, each a rounded box)
      // very different heights, one slab fallen hard aslant, one standing tall, the nearest the
      // darkest with the strongest contrast; blockier breaks
      [0.05, 0.62, 0.04, 1.5, -0.1, 0.45, 0],
      [-0.12, 0.28, 0.22, 0.55, 0.06, 0.66, 0.06],
      [0.32, 0.95, 0.27, 1.05, 0.36, 0.6, 0.08],
      [-0.06, 0.4, 0.48, 1.35, 0.05, 0.84, 0.12],
      [0.42, 1.08, 0.62, 0.6, -0.08, 0.8, 0.16],
      [-0.2, 0.12, 0.7, 0.8, -0.18, 0.9, 0.2],
      [-0.14, 0.42, 0.92, 0.45, 0.08, 0.92, 0.26],
    ];
    const ks: LimeChunk[] = plan.map(([a, q, bs, hs, tl, z, sh], i) => {
      const base = D * bs, x0 = W * a + (r() - 0.5) * 6, x1 = W * q + (r() - 0.5) * 6;
      return { x0, x1, top: base - H * hs * (0.85 + 0.3 * r()) - Math.max(0, -tl) * (q - a) * W, foot: base + 3, tilt: tl, z, shade: sh, cap: 1.5 + r() * 2.5, water: base, round: 0.45, seed: seed + 100 + i * 17 };
    });
    // stones half sunk off the west sides, in the open water
    for (const [a, bs, sw, sh] of [[-0.3, 0.08, 13, 5], [-0.27, 0.36, 9, 4], [-0.36, 0.84, 16, 6]] as const) {
      const x0 = W * a + (r() - 0.5) * 4, base = D * bs;
      ks.push({ x0, x1: x0 + sw, top: base - sh, foot: base + 2, tilt: (r() - 0.5) * 0.2, z: 0.8, cap: r() < 0.5 ? 1 : 0, water: base, seed: seed + 200 + Math.round(bs * 100) });
    }
    // the reflections first (each block's, below its own waterline, broken by ripples and
    // fading downward), then the blocks back to front over them
    for (const k of ks) {
      const base = k.water!;
      const hgt = Math.max(2, base - k.top);
      const reach = Math.min(hgt * 0.75, 30);
      const Y0 = Math.max(b.oy, Math.floor(c.Y(base + 0.5))), Y1 = Math.min(b.y1, Math.ceil(c.Y(base + reach)));
      const X0 = Math.max(b.ox, Math.floor(c.X(k.x0 - 4))), X1 = Math.min(b.x1, Math.ceil(c.X(k.x1 + 4)));
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        const dn = ly - base;
        const my = base - dn;
        const row = Math.floor(ly);
        for (let x = X0; x < X1; x++) {
          const lx = LX(c, x);
          // (round 4) one soft mirrored copy: the rows sway together in a slow wave, a ripple line
          // of water across it here and there, dissolving in long runs near its end
          const sx = lx + Math.round((vnoise1(dn / 5.5, seed + 30) - 0.5) * 2 * Math.min(2, 0.15 + dn / 14));
          if (!inChunk(k, sx, my)) continue;
          if (row > 1 && hash1(row, seed + 31) < 0.05 + 0.25 * dn / reach && hash1(Math.floor((lx + 40 * hash1(row, seed + 33)) / 22), seed + row) < 0.8) continue;
          if (dn / reach > 0.55 && hash1(Math.floor((lx + 30 * hash1(Math.floor(dn / 3), seed + 34)) / 20) * 7 + Math.floor(dn / 3), seed + 32) < (dn / reach - 0.55) * 1.8) continue;
          const T = chunkTop(k, sx), s = my - T;
          const col = dn < 1 ? P.karst[8]! : s < (k.cap ?? 0) ? P.moss[6]! : s < (k.cap ?? 0) + 2 ? P.karst[5]! : dn < 3.5 ? P.karst[7]! : P.karst[6]!;
          b.set(x, y, col);
        }
      }
    }
    // a nearer block stands in front of a farther one: draw by base (far first); each casts its
    // shadow on the next one behind it
    const order = ks.map((_, i) => i).sort((i, j) => ks[i]!.water! - ks[j]!.water!);
    order.forEach((i, n) => {
      const nearer = order.slice(n + 1).map((j) => ks[j]!).filter((q) => q.water! - ks[i]!.water! < 30);
      limeChunk(c, ks[i]!, nearer);
    });
    // reeds out of the joints and the gaps, a tangle near the west side
    for (let i = 0; i < 9; i++) {
      const k = ks[Math.floor(r() * 7)]!;
      const x = k.x0 + r() * (k.x1 - k.x0) * 0.5, n = 3 + Math.floor(r() * 6), tall = 8 + r() * 16;
      if (d < 0.3) continue;
      for (let j = 0; j < n; j++) grass(c, x + (r() - 0.5) * 7, k.water! - 0.5, tall * (0.4 + 0.6 * r()), (r() - 0.5) * 0.7, (r() - 0.45) * 1.2, r() * 0.8);
    }
    // a branch of driftwood lying across two blocks, silvered, its shadow on them
    if (d >= 0.3) {
      const a = ks[2]!, q = ks[3]!;
      const x0 = a.x0 + (a.x1 - a.x0) * 0.35, y0 = chunkTop(a, a.x0 + (a.x1 - a.x0) * 0.35) - 1;
      const x1 = q.x0 + (q.x1 - q.x0) * 0.55, y1 = chunkTop(q, q.x0 + (q.x1 - q.x0) * 0.55) - 1.5;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 3 + (k === 5 ? 1.2 : 0)]);
      }
      for (const [px, py] of pts) dot(c, px + 1.5, py + 2.5, P.karst[8]!);
      stroke(c, pts, (u) => 3.2 - 1.6 * u, (_u, sd) => (sd < -0.3 ? P.earth[1]! : sd < 0.4 ? P.earth[3]! : P.umber[1]!));
      const [ex, ey] = pts[8]!;
      stroke(c, bladePath(ex, ey, 5 + r() * 5, 0.9, -0.4), () => 1, () => P.earth[3]!);
    }
  },
});

// ---------------------------------------------------------------------------
// Kagami's east end (play plane, behind the jetty's end): op.pool, the east lip where the lake
// runs out against the foot of Shiraito's wall (round 5, the critic, fourth round: "the teal
// triangle": the lake's end seen against the wall's foot as a flat polygon with a straight
// diagonal edge, and the blank lip face over it). The lip is a stack of chunks (Dex's sketch): a
// back row of tall blocks, recessed, cooler and darker, stepping into an irregular skyline; a front
// row of lower blocks standing forward, lit on the left, each with a cap of green on its top ledge
// only, casting its shadow on the one behind; Shiraito's first veil pours down a gully between two
// back blocks into the falls' pool at their feet, churned white water and spray between the front
// blocks. Nothing in it runs straight.

export interface PoolP {
  /** Width along the lip, px (anchor: its west end on the waterline). */
  w: number;
  /** The tallest block's top above the water, px. */
  h: number;
}

export const pool = definePainter<PoolP>("op.pool", {
  bounds(p) {
    return [-40, -p.h * 1.15 - 30, p.w + 40, 4];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const W = p.w, H = p.h;
    const r = rng(seed + 3);
    const C = P.cloud;
    const K = Math.max(1, Math.round(d));
    // [from, to (shares of w), top (share of h), z, shade]: back row first, then the front row
    const plan: [number, number, number, number, number][] = [
      [0.0, 0.3, 0.7, 0.46, 0.06], [0.22, 0.48, 1.0, 0.52, 0.04], [0.53, 0.8, 0.82, 0.42, 0.08], [0.74, 1.04, 0.62, 0.48, 0.06],
      [-0.06, 0.16, 0.3, 0.86, 0], [0.12, 0.31, 0.52, 0.76, 0], [0.28, 0.44, 0.36, 0.92, 0], [0.56, 0.72, 0.56, 0.72, 0], [0.68, 0.88, 0.32, 0.88, 0], [0.84, 1.02, 0.44, 0.8, 0],
    ];
    const ks: LimeChunk[] = plan.map(([a, q, t, z, sh], i) => {
      const x0 = W * a + (r() - 0.5) * 6, x1 = W * q + (r() - 0.5) * 6;
      // (standing back toward the wall, in its haze: paler than the jetty and her, so she keeps
      // her darks against it; the back row more than the front)
      return { x0, x1, top: -H * t * (0.94 + 0.12 * r()), foot: 3, tilt: (r() - 0.5) * 0.14, z, shade: sh, cap: i < 4 ? 2.5 + 3 * r() : 1.5 + 2.5 * r(), water: 0, round: 0.6, haze: i < 4 ? 0.5 : 0.32, seed: seed + 100 + i * 17 };
    });
    const back = ks.slice(0, 4), front = ks.slice(4);
    // the gully between the crown and the block east of it, where the veil comes down
    const gx0 = Math.max(ks[1]!.x1 - 6, W * 0.47), gx1 = Math.min(ks[2]!.x0 + 6, W * 0.53);
    // the back row (the front row's shadows on it)
    back.forEach((k, i) => limeChunk(c, k, [...back.slice(i + 1), ...front]));
    // the falls' pool: a boil of spray rising where the veil lands, lumpy, lit on its upper left,
    // thinning at its edges by one cell of dither, churned white water at its foot
    {
      const sx = (gx0 + gx1) / 2, sw = W * 0.22, sh = H * 0.36;
      const X0 = Math.max(b.ox, Math.floor(c.X(sx - sw * 1.3))), X1 = Math.min(b.x1, Math.ceil(c.X(sx + sw * 1.3)));
      for (let x = X0; x < X1; x++) {
        const lx = LX(c, x);
        const u = (lx - sx) / sw;
        const T = sh * Math.pow(Math.max(0, 1 - u * u), 0.9) * (0.75 + 0.5 * vnoise1(lx / 9, seed + 8)) + 6 * (vnoise1(lx / 4, seed + 9) - 0.5);
        if (T < 1) continue;
        for (let y = Math.max(b.oy, Math.floor(c.Y(-T))); y < Math.min(b.y1, Math.ceil(c.Y(0))); y++) {
          const a = -LY(c, y), e = T - a;
          if (e < 2.2 && bayer4(Math.floor(x / K), Math.floor(y / K)) < 0.5) continue;
          const cs = 7 + 5 * (a / Math.max(1, T));
          const qx = lx / cs + vnoise1(a / 9, seed + 10) * 0.7, qy = a / cs + vnoise1(lx / 11, seed + 11) * 0.7;
          const fx = qx - Math.floor(qx) - 0.5, fy = qy - Math.floor(qy) - 0.5;
          const lit = -0.62 * fx + 0.78 * fy;
          b.set(x, y, a < 4 && vnoise1(lx / 3, seed + 12) > 0.6 ? P.jade[1]! : lit > 0.15 ? C[0]! : lit > -0.15 ? C[1]! : C[2]!);
        }
      }
    }
    // the front row, back to front by how far forward it stands, each casting on the ones behind
    const fo = [...front].sort((q, w) => q.z - w.z);
    fo.forEach((k, i) => limeChunk(c, k, fo.slice(i + 1)));
    // foam lapping at the front blocks' feet, brightest by the pool
    for (const k of front) {
      for (let x = Math.max(b.ox, Math.floor(c.X(k.x0 - 3))); x < Math.min(b.x1, Math.ceil(c.X(k.x1 + 4))); x++) {
        const lx = LX(c, x);
        const near = Math.exp(-(((lx - (gx0 + gx1) / 2) / (W * 0.3)) ** 2));
        const fh = (1 + 3.4 * vnoise1(lx / 3.5, seed + 40)) * (0.4 + near);
        for (let y = Math.max(b.oy, Math.floor(c.Y(-fh))); y < Math.min(b.y1, Math.ceil(c.Y(0))); y++) {
          if (vnoise(lx / 2.4, LY(c, y) / 1.6, seed + 41) < 0.38) continue;
          b.set(x, y, vnoise1(lx / 6, seed + 42) > 0.5 ? C[0]! : C[1]!);
        }
      }
    }
    // shrubs and grass on the ledges
    if (d >= 0.3) for (const k of ks) {
      const rr = rng(k.seed + 5);
      const n = 2 + Math.floor(rr() * 4);
      for (let j = 0; j < n; j++) {
        const gx = k.x0 + (k.x1 - k.x0) * (0.1 + 0.8 * rr());
        grass(c, gx, chunkTop(k, gx) + 1.2, 3 + rr() * 9, (rr() - 0.5) * 0.8, (rr() - 0.4) * 1.2, rr());
      }
      if (rr() < 0.5) bush(c, k.x0 + (k.x1 - k.x0) * (0.2 + 0.6 * rr()), chunkTop(k, (k.x0 + k.x1) / 2) + 1, 4 + rr() * 5, k.seed + 9);
    }
  },
});

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
import { boxOf, cached, clump, roughen, spansFor, toAbs, yAt } from "./kit.ts";
import { face, nextLedge } from "./face.ts";
import { needlePad } from "./flora.ts";
import { LX, LY, bladePath, dot, fern, grass, stroke } from "./bank.ts";

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
    for (let x = box[0] + 10; x < box[2] - 10; x += 6 + r() * 12) {
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
      // patches of forest on a ledge that wanders up and down the face, never a straight band
      const rich = vnoise1(x / 160, seed + 133 + Math.round(fd));
      if (rich < 0.45) continue;
      const fy = fd + (fbm1(x / 260, seed + 93 + Math.round(fd), 3) - 0.5) * 150 + (vnoise1(x / 60, seed + 94) - 0.5) * 30;
      plants.push({ kind: "bush", x, y: yAt(top, x) + fy, r: (7 + r() * 14) * (0.6 + rich * 0.6), seed: Math.floor(r() * 1e6) });
    }
  }
  return { outline, box, plants };
}

function builtFor(p: RockP, seed: number): Built {
  return cached(`rock|${seed}|${JSON.stringify(p).length}|${p.forest?.length}|${p.top.length}|${p.top[0]}|${p.top[1]}|${p.bottom.length}|${p.bottom[0]}|${p.rough}|${p.veg}`, () => build(p, seed));
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
function leafCell(lx: number, ly: number, seed: number): { lit: number; q: number } {
  const G = 12;
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
    // the ground: the dark floor of the woods, limestone breaking through it in a few outcrops
    // (columns, lit on their left), stepping down to the water at the east end; under the
    // waterline the shelving shore toward the camera (only seen west of the water)
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      const T = headTop(p, Math.max(0, lx), seed);
      if (T === -Infinity) continue;
      const u = lx / p.w;
      const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(136)));
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        if (ly < -T) continue;
        let col: number;
        if (ly > 0) {
          // the beach and the shore coming toward the camera: wandering bands of mud, pebbles
          // and grass, widening with nearness, dark at the water's edge
          // (marsh and scrub in patches, reed strokes standing in it; no bands)
          const m = vnoise(lx / 40, ly / 9, seed + 7) * 0.7 + vnoise(lx / 11, ly / 4, seed + 6) * 0.3;
          col = ly < 2.5 ? P.karst[7]! : m > 0.62 ? P.moss[5]! : m > 0.42 ? P.moss[6]! : m > 0.3 ? P.pine[2]! : P.earth[5]!;
          if (hash(Math.floor(lx / 1.5), Math.floor(ly / 5), seed + 8) < 0.12) col = P.moss[4]!;
        } else if (ly > -(2 + 3 * vnoise1(lx / 7, seed + 9))) col = P.karst[7]!;
        else {
          // an outcrop where the rock breaks through (more of them toward the water)
          const out = vnoise(lx / 46, ly / 34, seed + 11) * 0.7 + vnoise(lx / 15, ly / 12, seed + 12) * 0.3;
          if (out > 0.68 - 0.08 * u) {
            const cw = 16 + 16 * hash1(Math.floor(lx / 70), seed + 13);
            const f = (lx + (vnoise1(ly / 23, seed + 14) - 0.5) * 3) / cw;
            const q = f - Math.floor(f);
            col = q < 0.12 ? P.karst[7]! : q < 0.32 ? P.karst[3]! : q > 0.78 ? P.karst[6]! : P.karst[4]!;
            if (out < 0.72 - 0.08 * u) col = P.moss[5]!;
          } else {
            const blob = vnoise(lx / 13, ly / 10, seed + 15);
            col = blob > 0.78 ? P.moss[6]! : blob > 0.45 ? P.pine[2]! : P.pine[3]!;
          }
        }
        b.set(x, y, col);
      }
    }
    // the woods: one canopy over the upper slope, its top a skyline of crowns of very different
    // sizes, its body leaf clusters each lit on its upper left, darker deeper in; its lower edge
    // ragged where the outcrops and the dark floor show; the odd pine standing out of it
    const canopyTop = (x: number): number => {
      const T = headTop(p, Math.max(0, x), seed);
      let top = T + 3;
      // the skyline: the cells' crowns along the top
      for (let i = -2; i <= 2; i++) {
        const k = Math.floor(x / 16) + i;
        const cx = (k + 0.5 + (hash1(k, seed + 27) - 0.5) * 0.8) * 16, R = 7 + 13 * hash1(k, seed + 28) * hash1(k, seed + 29);
        const q = (x - cx) / R;
        if (Math.abs(q) < 1) top = Math.max(top, T + 2 + R * 0.9 * Math.sqrt(1 - q * q));
      }
      return top;
    };
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      const u = lx / p.w;
      if (u > 0.9 || lx < -30) continue;
      const fade = clamp((0.9 - u) / 0.12, 0, 1);
      const T = headTop(p, Math.max(0, lx), seed);
      const C = canopyTop(lx);
      const depth = (30 + 70 * fbm1(lx / 120, seed + 24, 2)) * fade + (vnoise1(lx / 8, seed + 25) - 0.5) * 10;
      if (depth < 3) continue;
      const Y0 = Math.max(b.oy, Math.floor(c.Y(-C) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(-T + depth)));
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        if (ly < -C || ly > -T + depth || ly > -2) continue;
        const inD = ly + C;
        // leaf clusters: crowns of mixed sizes (a weighted cell pattern, never a grid), each lit
        // on its upper left, a dark gap under its lower right; darker deeper in
        const L = leafCell(lx, ly, seed + 26);
        const deep = clamp(inD / (depth + C - T), 0, 1);
        let t = 0.32 - L.lit * 0.32 + deep * 0.5 + (L.q > 0.82 && L.lit < 0 ? 0.25 : 0);
        if (inD < 1.5) t -= 0.18;
        const i = clamp(Math.round(t * 6), 0, 6);
        b.set(x, y, [P.moss[1]!, P.moss[2]!, P.moss[3]!, P.moss[4]!, P.moss[5]!, P.pine[1]!, P.pine[2]!][i]!);
      }
    }
    const r = rng(seed + 20);
    for (let x = 20; x < p.w * 0.8; x += 60 + r() * 160) {
      const T = canopyTop(x);
      const R = 8 + r() * 8;
      if (d >= 0.3) needlePad(c, x, -T - R * 0.4, R * 2.6, R * 0.7, seed + Math.round(x * 3));
    }
    // the water's edge at the east end: reeds, a few stones standing out in the lake
    for (let i = 0; i < 4; i++) {
      const sx = p.w * (0.84 + 0.2 * r()), R = 2 + r() * 4;
      for (let oy = -R; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
        if ((ox / (R * 1.3)) ** 2 + (oy / R) ** 2 > 1) continue;
        dot(c, sx + ox, oy, oy > -1.2 ? P.karst[7]! : ox < -R * 0.3 ? P.karst[3]! : P.karst[5]!);
      }
    }
    // along the whole foot: reed clumps and wet stones in clusters, breaking the waterline
    for (let x = -20; x < p.w; x += 20 + r() * 70) {
      const n = 3 + Math.floor(r() * 9), tall = 6 + r() * 16;
      for (let k = 0; k < n; k++) {
        const bx = x + (r() - 0.5) * 18, a = (r() - 0.45) * 0.5, bd = (r() - 0.45) * 0.8, l = r() * 0.7, ln = tall * (0.4 + 0.6 * r());
        if (d >= 0.3) grass(c, bx, 0.5, ln, a, bd, l);
      }
      if (r() < 0.5) {
        const sx = x + r() * 20, R = 2 + r() * 3.5;
        for (let oy = -R; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
          if ((ox / (R * 1.3)) ** 2 + (oy / R) ** 2 > 1) continue;
          dot(c, sx + ox, oy, oy > -1 ? P.karst[7]! : ox < -R * 0.3 ? P.karst[3]! : P.karst[5]!);
        }
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

export interface ShoreP {
  /** Length along the shore, px; the anchor is its west end at the waterline. */
  w: number;
  /** The walk line's height above the water along the shore [x, h, ...] (local px): nothing here
   *  rises above it where she walks. */
  walk: number[];
  /** Where the shore runs out under the water (local x). */
  end: number;
}

/** A rounded ledge of limestone standing in or above the water: a noisy top, lit left, wet foot. */
function ledgeRock(c: PaintCtx, bx: number, bw: number, bt: number, seed: number): void {
  const b = c.buf;
  const X0 = Math.max(b.ox, Math.floor(c.X(bx - 2))), X1 = Math.min(b.x1, Math.ceil(c.X(bx + bw + 2)));
  const lean = (hash1(1, seed) - 0.5) * 0.5;
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x);
    const q = (lx - bx) / bw;
    if (q < 0 || q > 1) continue;
    // a lopsided rounded top: noise at three scales over a superellipse, steep sides
    const qq = clamp(q + lean * q * (1 - q), 0, 1);
    const e = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(qq * 2 - 1), 2.6)), 0.4);
    const T = bt * e * (0.8 + 0.35 * vnoise1(lx / (bw * 0.3) + 1, seed + 1)) + (vnoise1(lx / 5, seed + 2) - 0.5) * 3 * e + (vnoise1(lx / 1.8, seed + 3) - 0.5) * 1.1;
    if (T < 1) continue;
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(0.5)));
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      if (ly < -T || ly > 0.5) continue;
      const s = ly + T;
      const wet = -(2 + 4 * vnoise1(lx / 7, seed + 4));
      const mossD = (1.4 + 3 * vnoise1(lx / 6, seed + 5)) * (q < 0.6 ? 1.4 : 0.8);
      let col: number;
      if (ly > wet) col = ly > -0.6 ? P.karst[8]! : P.karst[7]!;
      else if (s < mossD) col = s < 1.1 && q < 0.65 ? P.moss[3]! : P.moss[5]!;
      else {
        // the top plane lit, the face below it mid, its right flank and the undercut foot dark
        let k = s < mossD + 2 + 2 * vnoise1(lx / 4, seed + 8) ? 0 : q < 0.14 + 0.1 * (vnoise1(ly / 5, seed + 6) - 0.5) ? 1 : q < 0.68 ? 2 : 3;
        // fissures down from notches, closing as they go
        for (let f = 0; f < 3; f++) {
          if (hash1(f + 5, seed) > 0.7) continue;
          const fx = bx + bw * (0.15 + 0.7 * hash1(f + 2, seed)) + (vnoise1(ly / 4 + f, seed + 7) - 0.5) * 2.4;
          if (Math.abs(lx - fx) < 0.6 && s < bt * (0.35 + 0.6 * hash1(f + 9, seed))) k = 4;
          else if (lx - fx > 0.6 && lx - fx < 1.6 && k > 1 && s < bt * 0.6) k = 1;
        }
        if (ly > wet - 3 && k < 3) k++;
        col = [P.karst[2]!, P.karst[4]!, P.karst[5]!, P.karst[6]!, P.karst[7]!][k]!;
      }
      b.set(x, y, col);
    }
  }
}

export const shore = definePainter<ShoreP>("op.shore", {
  bounds(p) {
    let hm = 0;
    for (let i = 1; i < p.walk.length; i += 2) hm = Math.max(hm, p.walk[i]!);
    return [-80, -hm - 200, p.w + 60, 8];
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
      const R = 5 + r() * 9 * (1 - v * 0.4);
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
          const L = leafCell(lx, ly, seed + 13);
          const t = 0.42 - (L.lit > 0.35 ? 0.25 : L.lit > -0.2 ? 0 : -0.2) + clamp(inD / 70, 0, 1) * 0.5 + (L.q > 0.85 && L.lit < 0 ? 0.2 : 0);
          const i = clamp(Math.round(t * 4), 0, 4);
          b.set(x, y, [P.moss[3]!, P.moss[4]!, P.moss[5]!, P.pine[2]!, P.pine[3]!][i]!);
        }
      }
    }
    for (const [x, y, R, v] of th) if (v > 0.55) clump(c, x, y, R, P.moss.slice(2, 7), P.pine.slice(1), 0.62 - v * 0.3, seed + Math.round(x * 13 + y * 7), 0.8);
    // the steps: ledges of limestone going down from under the walk line to the water, each its
    // own height and width, overlapping, the lower ones wet; the odd slab out in the shallows
    const blocks: [number, number, number][] = [
      [e * (0.0 + 0.04 * r()), e * (0.3 + 0.08 * r()), 0.82 + 0.1 * r()],
      [e * (0.24 + 0.04 * r()), e * (0.16 + 0.06 * r()), 0.95 + 0.1 * r()],
      [e * (0.36 + 0.04 * r()), e * (0.24 + 0.08 * r()), 0.5 + 0.1 * r()],
      [e * (0.58 + 0.04 * r()), e * (0.18 + 0.06 * r()), 0.32 + 0.08 * r()],
      [e * (0.77 + 0.03 * r()), e * (0.12 + 0.05 * r()), 0.18 + 0.05 * r()],
      [e * (0.95 + 0.04 * r()), e * (0.06 + 0.03 * r()), 0.1],
    ];
    for (const [bx, bw, k] of blocks) ledgeRock(c, bx, bw, Math.max(5, walkAt(bx + bw * 0.5) * k), seed + Math.round(bx * 13));
    // mud and pebbles at the waterline: banks of them where the ledges part, thin elsewhere
    for (let x = 0; x < e + 60; x += 1.5 + r() * 3) {
      const dens = vnoise1(x / 31, seed + 9) * 0.8 + vnoise1(x / 9, seed + 10) * 0.2;
      const R = 1.2 + r() * 3.2 * dens, keepIt = r(), oyB = -r() * 2 * dens;
      if (keepIt > dens * dens * 1.4) continue;
      for (let oy = -R; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
        if ((ox / (R * 1.3)) ** 2 + (oy / R) ** 2 > 1) continue;
        const lit = (-0.62 * ox) / R - (0.78 * oy) / R;
        dot(c, x + ox, oy + oyB, oy + oyB > -0.8 ? P.earth[5]! : lit > 0.5 ? P.stone[2]! : lit > -0.2 ? P.stone[4]! : P.stone[5]!);
      }
    }
    // stones sunk in the shallows past the end of the steps, in a loose group
    for (let i = 0; i < 4; i++) {
      const x = e * (0.9 + 0.35 * r() * r()), R = 2.5 + r() * 5;
      for (let oy = -R * 0.8; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.4; ox <= R * 1.4; ox += 0.5) {
        if ((ox / (R * 1.4)) ** 2 + (oy / (R * 0.8)) ** 2 > 1) continue;
        const lit = (-0.62 * ox) / R - (0.78 * oy) / R;
        dot(c, x + ox, oy, oy > -1.5 ? P.karst[8]! : lit > 0.4 ? P.moss[4]! : P.karst[5]!);
      }
    }
    // the fallen trunk: its root plate torn up on the bank, the trunk lying down over the ledges
    // into the water, thick, wet and dark where it goes in, moss along its top, a broken limb
    const tx0 = e * (0.3 + 0.05 * r()), tx1 = e * (0.66 + 0.06 * r());
    const ty0 = -walkAt(tx0) + 10, ty1 = 3;
    const trunk: [number, number][] = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      // it rests on the ledges: a sag, then a kink where it slid off one
      trunk.push([tx0 + (tx1 - tx0) * u, ty0 + (ty1 - ty0) * Math.pow(u, 0.8) + (u > 0.55 ? 0 : -Math.sin((u / 0.55) * Math.PI) * 2)]);
    }
    stroke(c, trunk, (u) => 12 - 5 * u, (u, sd) => {
      if (sd < -0.55) return u > 0.85 ? P.timber[5]! : hash1(Math.floor(u * 60), seed + 6) < 0.4 ? P.moss[4]! : P.timber[3]!;
      if (sd > 0.5 || u > 0.85) return P.timber[6]!;
      return hash1(Math.floor(u * 50) + Math.round(sd * 3) * 97, seed + 7) < 0.25 ? P.timber[5]! : P.timber[4]!;
    });
    // the root plate: a ragged disc of roots and earth standing up from the trunk's end
    for (let oy = -10; oy <= 3; oy += 0.5) for (let ox = -7; ox <= 3; ox += 0.5) if ((ox + 2) ** 2 / 20 + (oy + 3) ** 2 / 42 < 1) dot(c, tx0 - 3 + ox, ty0 + oy, P.earth[5]!);
    for (let i = 0; i < 22; i++) {
      const a = -1.6 + (3.2 * i) / 21 + (r() - 0.5) * 0.2;
      const len = 8 + r() * 14, bd = (r() - 0.5) * 1.4;
      stroke(c, bladePath(tx0 - 3, ty0 - 2, len, a, bd), (u) => (u < 0.35 ? 3 : u < 0.7 ? 2 : 1), (u) => (u < 0.4 ? P.earth[5]! : u < 0.75 ? P.timber[5]! : P.timber[4]!));
    }
    // a broken limb standing up off the trunk
    const [sx, sy] = trunk[5]!;
    const ll = 12 + r() * 6;
    stroke(c, bladePath(sx, sy - 4, ll, 0.35, -0.3), (u) => (u < 0.5 ? 3 : 2), () => P.timber[5]!);
    // grass and shrubs along the top in clusters, never evenly spaced; ferns on the ledges
    for (let x = 170; x < e * 0.85; x += 10 + r() * r() * 90) {
      const n = 3 + Math.floor(r() * 8), wx = x + r() * 10;
      const top = walkAt(wx);
      const kind = r();
      if (kind < 0.3 && d >= 0.3) {
        const R = 4 + r() * 7;
        clump(c, wx, -top - 2, R, P.moss.slice(1, 6), P.pine.slice(1), 0.42, seed + Math.round(wx * 7), 0.75);
      } else {
        for (let k = 0; k < n; k++) {
          const gx = wx + (r() - 0.5) * 14, ln = 4 + r() * 18, a = (r() - 0.45) * 1.1, bd = (r() - 0.4) * 1.2, l = r();
          grass(c, gx, -top + 2, ln, a, bd, l);
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const [bx, bw, k] = blocks[1 + Math.floor(r() * 3)]!;
      const fx = bx + bw * (0.2 + 0.6 * r()), ln = 8 + r() * 9, a = (r() < 0.5 ? -1 : 1) * (0.5 + 0.4 * r());
      if (d >= 0.4) fern(c, fx, -walkAt(fx) * k * 0.7, ln, a, seed + 40 + i);
    }
    // tall grass and reeds in front of the thicket's foot
    for (let i = 0; i < 46; i++) {
      const x = 10 + r() * 190;
      const ln = 10 + r() * 34 * (1 - x / 260), a = (r() - 0.5) * 0.7, bd = (r() - 0.4) * 1.4, l = r();
      grass(c, x, -walkAt(x) + 2, ln, a, bd, l * 0.8, ln > 30);
    }
  },
});

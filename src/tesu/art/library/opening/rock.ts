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
    // (art loop round 2) a wooded shore receding into haze: crowns of very different sizes heaped
    // down the slope with dark pockets between them, limestone breaking out in a few places, a
    // shoreline that wanders (wet rock, stones, grass to the water, reeds), the lake's mirror
    // starting right at it. No grid of blobs, no columns, no ruled waterline.
    const crowns = cached(`headland-crowns|${seed}|${p.w}|${p.h}`, () => {
      const r = rng(seed + 120);
      const out: [number, number, number, number][] = [];
      // big trees first (they stand up out of the canopy), then medium, then small ones filling
      for (const [n, r0, r1] of [[34, 18, 34], [150, 9, 17], [280, 4, 9]] as const) {
        for (let i = 0; i < n; i++) {
          const x = p.w * 0.9 * r() - 10;
          const T = headTop(p, Math.max(0, x), seed);
          if (T === -Infinity || T < 8) continue;
          // the woods' depth down the slope here: thick in places, thin over the rock in others
          const depth = (24 + 80 * fbm1(x / 120, seed + 24, 2)) * clamp((0.9 - x / p.w) / 0.14, 0, 1);
          if (depth < 6) continue;
          const R = r0 + (r1 - r0) * r() * (0.55 + 0.45 * (1 - x / p.w));
          // big ones stand up out of the top; the rest heaped down the slope, the small in front
          const y = r0 > 15 ? -T - R * (0.3 + 0.35 * r()) : -T + Math.pow(r(), r0 < 8 ? 0.7 : 1.3) * depth - R * 0.3;
          out.push([x, y, R, Math.floor(r() * 1e6)]);
        }
      }
      // far ones first, the low (near) ones last over them
      return out.sort((a, q) => a[1] + a[2] * 0.5 - (q[1] + q[2] * 0.5));
    });
    // the ground under the woods: the dark floor, limestone breaking through it in a few outcrops
    // (blocks lit on their upper left, a dark crevice under each), stepping down to the water
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      const T = headTop(p, Math.max(0, lx), seed);
      if (T === -Infinity) continue;
      const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(136)));
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        if (ly < -T) continue;
        let col: number;
        if (ly > 0) {
          // the shore toward the camera (only seen west of the water): marsh and scrub in patches;
          // its first rows (where the water's edge may show) the same greens as the shore above
          const m = vnoise(lx / 40, ly / 9, seed + 7) * 0.7 + vnoise(lx / 11, ly / 4, seed + 6) * 0.3;
          col = ly < 4 ? (vnoise1(lx / 7, seed + 5) > 0.5 ? P.moss[6]! : P.pine[2]!) : m > 0.62 ? P.moss[5]! : m > 0.42 ? P.moss[6]! : m > 0.3 ? P.pine[2]! : P.earth[5]!;
        } else {
          // the shoreline: it wanders between wet rock, mud, grass right to the water and stones
          const kind = vnoise1(lx / 23, seed + 9) * 0.7 + vnoise1(lx / 7, seed + 10) * 0.3;
          const band = kind < 0.3 ? 1 + 3 * vnoise1(lx / 5, seed + 8) : 0;
          const s = ly + T;
          const out = vnoise(lx / 38, ly / 26, seed + 11) * 0.65 + vnoise(lx / 13, ly / 9, seed + 12) * 0.35;
          if (-ly < band) col = P.karst[7]!;
          else if (out > 0.77 - 0.06 * (lx / p.w) && s > 2) {
            // an outcrop: a block lit on its upper left, its face mid, a dark crevice under it
            const th = 0.77 - 0.06 * (lx / p.w);
            const e = out - th;
            const up = vnoise(lx / 38, (ly - 3) / 26, seed + 11) * 0.65 + vnoise(lx / 13, (ly - 3) / 9, seed + 12) * 0.35;
            const left = vnoise((lx - 3) / 38, ly / 26, seed + 11) * 0.65 + vnoise((lx - 3) / 13, ly / 9, seed + 12) * 0.35;
            col = up < th ? P.moss[4]! : left < th ? P.karst[4]! : e < 0.03 ? P.karst[7]! : vnoise(lx / 6, ly / 9, seed + 13) > 0.5 ? P.karst[5]! : P.karst[6]!;
            const dn = vnoise(lx / 38, (ly + 3) / 26, seed + 11) * 0.65 + vnoise(lx / 13, (ly + 3) / 9, seed + 12) * 0.35;
            if (dn < th) col = P.karst[7]!;
          } else {
            const blob = vnoise(lx / 13, ly / 10, seed + 15);
            col = s < 1.5 ? P.moss[4]! : blob > 0.72 ? P.moss[6]! : blob > 0.42 ? P.pine[2]! : P.pine[3]!;
          }
        }
        b.set(x, y, col);
      }
    }
    // the woods: crowns of very different sizes, each a lumpy mass lit on its upper left with its
    // own shade lower right; where a crown meets the one behind it, a dark pocket
    for (const [cx, cy, R, cs] of crowns) {
      if (lxOut(c, cx, R)) continue;
      const u = cx / p.w;
      const Xa = Math.max(b.ox, Math.floor(c.X(cx - R * 1.3))), Xb = Math.min(b.x1, Math.ceil(c.X(cx + R * 1.3)));
      const Ya = Math.max(b.oy, Math.floor(c.Y(cy - R * 1.2))), Yb = Math.min(b.y1, Math.ceil(c.Y(cy + R * 1.1)));
      const bump = Math.max(2.2, R * 0.35);
      for (let y = Ya; y < Yb; y++) {
        const ly = LY(c, y);
        if (ly > -1.5) continue;
        for (let x = Xa; x < Xb; x++) {
          const lx = LX(c, x);
          const dx = lx - cx, dy = (ly - cy) * 1.1;
          const ang = Math.atan2(dy, dx);
          const rim = R * (0.78 + 0.26 * vnoise1(ang * (R / bump) * 0.5 + 3, cs) + (d >= 0.5 ? 0.08 * vnoise1(ang * (R / bump) * 1.6, cs + 1) : 0)) * (dy > 0 ? 0.86 : 1);
          const q = Math.hypot(dx, dy) / rim;
          if (q > 1) continue;
          // light: the crown's upper left, and the upper left of each bump of leaves in it
          const lit = -(0.62 * dx + 0.78 * dy) / rim;
          const inner = (vnoise(lx / bump + cs * 0.01, ly / bump, cs + 2) - 0.5) * 0.5;
          let t = 0.56 - lit * 0.42 + inner + q * 0.1 + clamp(u - 0.5, 0, 1) * 0.1;
          if (q > 0.84 && lit < -0.1) t += 0.28;
          if (q > 0.9 && lit > 0.35) t -= 0.18;
          const i = clamp(Math.round(t * 6), 0, 7);
          b.set(x, y, [P.moss[1]!, P.moss[2]!, P.moss[3]!, P.moss[4]!, P.pine[0]!, P.pine[1]!, P.pine[2]!, P.pine[3]!][i]!);
        }
      }
    }
    const r = rng(seed + 20);
    // a pine or two standing out of the woods
    for (let x = 40; x < p.w * 0.7; x += 140 + r() * 260) {
      const T = headTop(p, x, seed);
      const R = 8 + r() * 8;
      if (d >= 0.3 && T > 30) needlePad(c, x, -T - 26 - R * 0.6, R * 2.6, R * 0.7, seed + Math.round(x * 3));
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
          dot(c, sx + ox, oy, oy > -0.8 ? P.karst[8]! : ox < -R * 0.3 ? P.karst[2]! : P.karst[4]!);
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
    for (const [x, y, R, v] of th) if (v > 0.55) clump(c, x, y, R, P.moss.slice(2, 7), P.pine.slice(1), 0.62 - v * 0.3, seed + Math.round(x * 13 + y * 7), 0.8);
    // (art loop round 2) the shelving shore: one body of limestone under the walk line, stepping
    // down to the water in ledges of their own widths and heights (a lit, mossy tread, a rounded
    // lip, a riser in shade, a dark undercut under each lip), wet and dark where it meets the water;
    // mud and pebbles where the last steps go in, stones sunk in the shallows, an old stub, a fallen
    // trunk with a kink lying down the steps with its shadow on them, grass and ferns on the treads
    const steps: [number, number][] = [];
    {
      let x = e * (0.02 + 0.05 * r());
      let k = 0.93;
      while (x < e * 1.02) {
        steps.push([x, k]);
        x += e * (0.09 + 0.15 * r() * (1 - 0.4 * (x / e)));
        k = Math.max(0.3, k - (0.05 + 0.1 * r()));
      }
      steps.push([e * 1.12, -0.1]);
    }
    const stepOf = (lx: number): number => {
      let i = 0;
      while (i + 1 < steps.length && steps[i + 1]![0] <= lx) i++;
      return i;
    };
    // the height of the steps' top at lx (px above the water): a tread, then a rounded lip and riser
    const stepTop = (lx: number): number => {
      if (lx < steps[0]![0] || lx > e * 1.12) return -Infinity;
      const i = stepOf(lx);
      const [x0, k0] = steps[i]!, [x1, k1] = steps[Math.min(steps.length - 1, i + 1)]!;
      const wk = walkAt(lx);
      // the tread sags a little and tilts toward the water; the lip rounds over into the riser
      const f = (lx - x0) / Math.max(1, x1 - x0);
      const lip = f > 0.8 ? Math.pow((f - 0.8) / 0.2, 1.8) : 0;
      const kk = k0 - 0.04 * f + (k1 - k0 + 0.04) * lip;
      return Math.max(-2, wk * kk + (vnoise1(lx / 13, seed + 51) - 0.5) * 4 + (vnoise1(lx / 4, seed + 52) - 0.5) * 1.6);
    };
    {
      const b = c.buf;
      const X0 = Math.max(b.ox, Math.floor(c.X(steps[0]![0] - 2))), X1 = Math.min(b.x1, Math.ceil(c.X(e * 1.12)));
      for (let x = X0; x < X1; x++) {
        const lx = LX(c, x);
        const T0 = stepTop(lx);
        if (T0 === -Infinity) continue;
        // the grass bank over the steps: from just under the walk line down over the rock, its lower
        // edge hanging over each lip in a ragged hem (the rock breaks out of the bank below it)
        const W = walkAt(lx) - 0.5 - 1.2 * vnoise1(lx / 6, seed + 71);
        const hem = (vnoise1(lx / 5, seed + 72) - 0.3) * 4 + (vnoise1(lx / 2.2, seed + 73) > 0.7 ? 3 : 0);
        const T = Math.max(T0, W);
        if (T < 0.5) continue;
        const sl = (stepTop(lx + 1.5) - stepTop(lx - 1.5)) / 3;
        const i = stepOf(lx);
        const fx = (lx - steps[i]![0]) / Math.max(1, steps[Math.min(steps.length - 1, i + 1)]![0] - steps[i]![0]);
        const fw = 9 + 9 * vnoise1(lx / 50, seed + 59);
        const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(0.6)));
        for (let y = Y0; y < Y1; y++) {
          const ly = LY(c, y);
          if (ly < -T || ly > 0.6) continue;
          const up = -ly;
          if (W > T0 && ly < -T0 + hem && up > 3) {
            // the bank: a lit top, grass going into its own shade, darkest where it hangs over rock
            const sb = ly + W, bot = -T0 + hem - ly;
            const mot = vnoise(lx / 13, ly / 6, seed + 74);
            b.set(x, y, sb < 1.1 ? P.moss[2]! : bot < 1.5 ? P.moss[7]! : bot < 3.5 ? P.moss[6]! : sb < 4 ? P.moss[3]! : mot > 0.6 ? P.moss[4]! : mot > 0.3 ? P.moss[5]! : P.moss[6]!);
            continue;
          }
          const s = ly + T0;
          // turf on the treads (thick on the level, thin where the top drops), hanging over the lip
          const turf = sl > -0.45 ? (2 + 4 * vnoise1(lx / 9, seed + 53)) * (vnoise1(lx / 31, seed + 54) > 0.3 ? 1 : 0.35) + (vnoise1(lx / 3.1, seed + 65) > 0.72 ? 4 * vnoise1(lx / 1.6, seed + 66) : 0) : 1;
          let col: number;
          if (up < 0.9) col = vnoise1(lx / 6, seed + 67) > 0.78 ? P.jade[3]! : P.karst[8]!;
          else if (up < 3 + 3 * vnoise1(lx / 7, seed + 55)) col = vnoise1(lx / 5, seed + 56) > 0.7 ? P.moss[6]! : P.karst[8]!;
          else if (s < turf) col = s < 1.1 ? (sl > 0.1 ? P.moss[2]! : P.moss[3]!) : s < turf * 0.5 ? P.moss[4]! : P.moss[5]!;
          else {
            // the body under the treads: the shore's face toward the camera, in its own shade and
            // mottled (the sun is beyond it); a pale lip only where the rock breaks out under the
            // turf; a riser (where the top drops) darker; the undercut under each lip darkest;
            // a fissure here and there, closing as it goes down
            const mot = vnoise(lx / 17, ly / 11, seed + 68) * 0.7 + vnoise(lx / 5, ly / 4, seed + 69) * 0.3;
            let k = s < turf + 1.5 && vnoise1(lx / 13, seed + 70) > 0.45 ? 0 : mot > 0.62 ? 1 : mot > 0.38 ? 2 : 3;
            if (sl < -0.5 || fx > 0.9) k = Math.max(k, 3);
            if (s > turf + 2 && s < turf + 6 && fx > 0.78 && fx < 0.97) k = 4;
            const wx = lx + (vnoise1(ly / 6, seed + 58) - 0.5) * 3;
            const fis = Math.floor(wx / fw), ff = wx / fw - fis;
            if (hash1(fis, seed + 60) < 0.2 && s > 3 && ff < 0.08 && s < 6 + 14 * hash1(fis, seed + 61)) k = 4;
            if (up < 7 && k < 4) k++;
            col = [P.karst[3]!, P.karst[5]!, P.karst[6]!, P.karst[7]!, P.karst[8]!][Math.min(4, k)]!;
          }
          b.set(x, y, col);
        }
      }
    }
    // mud and pebbles where the last steps go in: a spit of wet mud, pebbles heaped on it in clusters
    for (let x = e * 0.7; x < e * 1.15; x += 1.5 + r() * 3) {
      const dens = vnoise1(x / 23, seed + 9) * 0.8 + vnoise1(x / 7, seed + 10) * 0.2;
      if (r() > dens * 1.2) continue;
      const R = 1.2 + r() * 3 * dens, oyB = -r() * 1.5;
      const T = Math.max(0, stepTop(x));
      for (let oy = -R; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
        if ((ox / (R * 1.3)) * (ox / (R * 1.3)) + (oy / R) * (oy / R) > 1) continue;
        const lit = (-0.62 * ox) / R - (0.78 * oy) / R;
        dot(c, x + ox, oy + oyB - T * 0.2, oy + oyB > -0.8 ? P.earth[5]! : lit > 0.5 ? P.stone[2]! : lit > -0.2 ? P.stone[4]! : P.stone[5]!);
      }
    }
    // stones sunk in the shallows past the steps, in a loose group: wet dark foot, a bright wet line
    for (let i = 0; i < 5; i++) {
      const x = e * (1.02 + 0.3 * r() * r()), R = 2 + r() * 5 * (i === 0 ? 1.4 : 1);
      for (let oy = -R * 0.8; oy <= 0.5; oy += 0.5) for (let ox = -R * 1.4; ox <= R * 1.4; ox += 0.5) {
        if ((ox / (R * 1.4)) * (ox / (R * 1.4)) + (oy / (R * 0.8)) * (oy / (R * 0.8)) > 1) continue;
        const lit = (-0.62 * ox) / R - (0.78 * oy) / R;
        dot(c, x + ox, oy, oy > -0.6 ? P.jade[2]! : oy > -1.8 ? P.karst[8]! : lit > 0.45 ? (i % 2 ? P.moss[4]! : P.karst[3]!) : lit > -0.2 ? P.karst[5]! : P.karst[7]!);
      }
    }
    // an old broken stub standing in the shallows: its split top lit, a wet band at the water
    {
      const sx = e * (0.93 + 0.05 * r()), sh = 10 + r() * 6, sw = 2.2;
      for (let ly = -sh; ly <= 0.5; ly += 0.5) {
        const v = -ly / sh;
        for (let o = -sw; o <= sw; o += 0.5) {
          const jag = -sh + 2.5 * hash1(Math.floor((o + sw) * 1.5), seed + 62);
          if (ly < jag) continue;
          const q = o / sw;
          dot(c, sx + o + v * 1.2, ly, -ly < 1 ? P.jade[2]! : -ly < 3 ? P.pine[5]! : ly - jag < 1.1 ? P.timber[2]! : q < -0.4 ? P.timber[3]! : q < 0.4 ? P.timber[4]! : P.timber[5]!);
        }
      }
    }
    // the fallen trunk: its root plate torn up on an upper step, the trunk lying down the steps into
    // the water with a kink where it slid off a lip; bark lit on top, dark below, moss along its top;
    // its shadow on the steps under it, down and right
    const tx0 = e * (0.18 + 0.06 * r());
    const lipI = Math.min(steps.length - 2, stepOf(tx0) + 1);
    const tk = steps[lipI]![0] - 4, tx1 = Math.min(e * 1.05, tk + e * (0.2 + 0.08 * r()));
    const ty0 = -stepTop(tx0) - 5, tyk = -stepTop(tk - 6) - 4, ty1 = 2;
    const trunk: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      const x = u < 0.5 ? tx0 + (tk - tx0) * (u / 0.5) : tk + (tx1 - tk) * ((u - 0.5) / 0.5);
      const y = u < 0.5 ? ty0 + (tyk - ty0) * Math.pow(u / 0.5, 1.2) : tyk + (ty1 - tyk) * Math.pow((u - 0.5) / 0.5, 0.8);
      trunk.push([x, y + Math.sin(u * Math.PI * 3) * 0.6]);
    }
    for (const [x, y] of trunk) for (let o = 0; o < 4; o += 0.5) if (-(y + 5 + o) < stepTop(x + 3 + o)) dot(c, x + 3 + o, y + 5 + o * 0.5, P.karst[7]!);
    stroke(c, trunk, (u) => 10 - 4.5 * u, (u, sd) => {
      if (sd < -0.6) return u > 0.9 ? P.timber[4]! : hash1(Math.floor(u * 70), seed + 6) < 0.45 ? P.moss[3]! : P.timber[2]!;
      if (sd < -0.2) return hash1(Math.floor(u * 50), seed + 63) < 0.3 ? P.moss[4]! : P.timber[3]!;
      if (sd > 0.55 || u > 0.92) return P.timber[6]!;
      return hash1(Math.floor(u * 50) + Math.round(sd * 3) * 97, seed + 7) < 0.25 ? P.timber[5]! : P.timber[4]!;
    });
    // its wet foot where it goes in
    for (let o = -4; o <= 4; o += 0.5) dot(c, tx1 + o, 0.5, P.jade[2]!);
    // the root plate: a ragged disc of roots and earth standing up off the trunk's end
    for (let oy = -12; oy <= 3; oy += 0.5) for (let ox = -7; ox <= 3; ox += 0.5) {
      const q = ((ox + 2) * (ox + 2)) / 22 + ((oy + 4) * (oy + 4)) / 50 + (vnoise1(Math.atan2(oy + 4, ox + 2) * 3, seed + 64) - 0.5) * 0.5;
      if (q < 1) dot(c, tx0 - 3 + ox, ty0 + oy, q > 0.75 || ox < -3 ? P.earth[4]! : P.earth[5]!);
    }
    for (let i = 0; i < 18; i++) {
      const a = -1.7 + (3.4 * i) / 17 + (r() - 0.5) * 0.25;
      const len = 6 + r() * 14, bd = (r() - 0.5) * 1.6;
      stroke(c, bladePath(tx0 - 4, ty0 - 4, len, a, bd), (u) => (u < 0.3 ? 2 : 1), (u) => (u < 0.4 ? P.earth[5]! : u < 0.75 ? P.timber[5]! : P.timber[4]!));
    }
    // a broken limb standing up off the trunk
    const [lsx, lsy] = trunk[6]!;
    stroke(c, bladePath(lsx, lsy - 4, 10 + r() * 6, 0.3, -0.35), (u) => (u < 0.5 ? 3 : 2), (_u, sd) => (sd < 0 ? P.timber[3]! : P.timber[5]!));
    // grass and shrubs on the treads in clumps of very different sizes, ferns in the risers
    for (let x = 170; x < e * 0.95; x += 10 + r() * r() * 80) {
      const n = 3 + Math.floor(r() * 8), wx = x + r() * 10;
      const T = Math.max(0, stepTop(wx));
      const kind = r();
      if (kind < 0.22 && d >= 0.3) {
        const R = 3 + r() * 6;
        clump(c, wx, -T - 1, R, P.moss.slice(1, 6), P.pine.slice(1), 0.42, seed + Math.round(wx * 7), 0.75);
      } else {
        for (let k = 0; k < n; k++) {
          const gx = wx + (r() - 0.5) * 12, ln = 3 + r() * 13, a = (r() - 0.45) * 1.1, bd = (r() - 0.4) * 1.2, l = r();
          grass(c, gx, -Math.max(0, stepTop(gx)) + 1.5, ln, a, bd, l);
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const s0 = steps[1 + Math.floor(r() * Math.max(1, steps.length - 3))]!;
      const fx = s0[0] - 2 - r() * 4, ln = 7 + r() * 9, a = -(0.5 + 0.4 * r());
      if (d >= 0.4) fern(c, fx, -Math.max(2, stepTop(fx + 2)) * 0.6, ln, a, seed + 40 + i);
    }
    // reeds where the shore goes into the water, in two clumps
    for (const [rx, rw, rh] of [[e * (0.86 + 0.05 * r()), 16, 22], [e * (1.06 + 0.04 * r()), 10, 16]] as const) {
      for (let k = 0; k < 14; k++) {
        const bx = rx + (r() - 0.5) * rw, ln = rh * (0.4 + 0.6 * r());
        if (d >= 0.3) grass(c, bx, 0.5 - Math.max(0, stepTop(bx)) * 0.3, ln, (r() - 0.5) * 0.4, (r() - 0.5) * 0.9, r() * 0.6);
      }
    }
    // tall grass and reeds in front of the thicket's foot
    for (let i = 0; i < 46; i++) {
      const x = 10 + r() * 190;
      const ln = 10 + r() * 34 * (1 - x / 260), a = (r() - 0.5) * 0.7, bd = (r() - 0.4) * 1.4, l = r();
      grass(c, x, -walkAt(x) + 2, ln, a, bd, l * 0.8, ln > 30);
    }
  },
});

// ---------------------------------------------------------------------------
// Kagami's east end (front plane): op.scree, where the lake runs out against the foot of the
// east lip (art loop round 1, integration). Limestone blocks fallen from the lip lie heaped in
// the shallows, the heap spreading toward the camera (down the frame) as the shore turns toward
// it: the nearer a block, the lower and bigger it is. Each sits in the water on its own wet dark
// band with a bright wet line at its foot, moss on its top, light from the upper left; wet scree
// and mud fill the gaps behind them, sedge and reeds grow out of it. It hides the place where the
// lake's water ends against the rock, and joins the lip to P5's east corner, so the lake never
// ends in a ruled edge. Drawn in whole level-1 px.

export interface ScreeP {
  /** Length along the waterline, px (anchor: its west end at the waterline). */
  w: number;
  /** How far toward the camera (down the frame) the heap reaches, px (its west tip only a few). */
  deep: number;
  /** Height of the tallest blocks above the waterline (against the lip at the east end), px (default 26). */
  h?: number;
}

/** The heap's reach below the waterline at local x (its west tip shallow, ragged at three scales). */
function screeDeep(p: ScreeP, lx: number, seed: number): number {
  const u = clamp(lx / p.w, 0, 1);
  const tip = clamp(lx / 34, 0, 1);
  return p.deep * Math.pow(tip, 0.7) * (0.82 + 0.25 * fbm1(lx / 40, seed + 3, 2)) * (0.9 + 0.1 * u) + (vnoise1(lx / 9, seed + 4) - 0.5) * 6 + (vnoise1(lx / 3, seed + 5) - 0.5) * 2;
}

/** A fallen block sitting in the water at local base y (its waterline): rounded, lopsided, lit upper left, wet at its foot. */
function screeBlock(c: PaintCtx, cx: number, base: number, bw: number, bh: number, seed: number, open = true): void {
  const b = c.buf;
  const X0 = Math.max(b.ox, Math.floor(c.X(cx - bw / 2 - 1))), X1 = Math.min(b.x1, Math.ceil(c.X(cx + bw / 2 + 1)));
  if (X0 >= X1) return;
  const lean = (hash1(1, seed) - 0.5) * 0.7;
  const wetH = 1.6 + 2.4 * hash1(2, seed);
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x);
    const q = (lx - (cx - bw / 2)) / bw;
    if (q < 0 || q > 1) continue;
    // a lopsided rounded top: noise at three scales over a superellipse
    const qq = clamp(q + lean * q * (1 - q), 0, 1);
    const e = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(qq * 2 - 1), 2.3)), 0.42);
    const T = bh * e * (0.78 + 0.36 * vnoise1(lx / (bw * 0.32) + 3, seed + 3)) + (vnoise1(lx / 4.5, seed + 4) - 0.5) * 2.4 * e + (vnoise1(lx / 1.7, seed + 5) - 0.5) * 0.9;
    if (T < 1) continue;
    const Y0 = Math.max(b.oy, Math.floor(c.Y(base - T) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(base + 1.2)));
    const wet = wetH + (vnoise1(lx / 5, seed + 6) - 0.5) * 2;
    const mossD = (q < 0.7 ? 1.2 + 2.6 * vnoise1(lx / 6, seed + 7) : 0.6) * (hash1(3, seed) < 0.75 ? 1 : 0);
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      if (ly < base - T || ly > base + 1.2) continue;
      const s = ly - (base - T);
      const up = base - ly;
      let col: number;
      // the bright wet line where the water laps its foot, then the wet dark band
      if (up < 0) col = open && q > 0.08 && q < 0.92 ? P.jade[1]! : P.karst[8]!;
      else if (up < 0.9) col = P.karst[8]!;
      else if (up < wet) col = q < 0.2 ? P.karst[6]! : P.karst[7]!;
      else if (s < mossD) col = s < 1 && q < 0.5 ? P.moss[3]! : q < 0.35 ? P.moss[4]! : P.moss[5]!;
      else {
        // the top plane lit, the left flank catching the light, the face mid, the right flank
        // and the undercut above the wet band in shade; a crack down from a notch
        let k = s < mossD + 1.6 + 1.6 * vnoise1(lx / 4, seed + 8) ? 0 : q < 0.18 + 0.08 * (vnoise1(ly / 5, seed + 9) - 0.5) ? 1 : q < 0.66 ? 2 : 3;
        if (up < wet + 2 && k < 3) k++;
        const fx = cx + bw * (hash1(4, seed) - 0.5) * 0.6 + (vnoise1(ly / 3, seed + 10) - 0.5) * 1.6;
        if (hash1(5, seed) < 0.6 && Math.abs(lx - fx) < 0.6 && s > 1 && up > wet) k = 4;
        col = [P.karst[3]!, P.karst[4]!, P.karst[5]!, P.karst[6]!, P.karst[7]!][k]!;
      }
      b.set(x, y, col);
    }
  }
}

export const scree = definePainter<ScreeP>("op.scree", {
  bounds(p) {
    return [-40, -(p.h ?? 26) * 1.5 - 50, p.w + 34, p.deep * 1.2 + 16];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const H = p.h ?? 26;
    // (art loop round 2) loose debris heaped against the lip, no box: fallen blocks of very
    // different sizes, smaller stones packed between them, a bleached branch or two lying across,
    // a tangle of reeds. Where no block stands, only a low shingle of wet stones at the waterline.
    const r = rng(seed + 20);
    const rows: [number, number, number, number][] = [];
    const nBig = 2 + Math.floor(r() * 2);
    for (let i = 0; i < nBig; i++) {
      const cx = p.w * (0.4 + 0.55 * r()), bw = 32 + r() * 24, hk = r();
      const yb = Math.min(p.deep * (0.45 + 0.5 * r()), screeDeep(p, cx, seed) + 3);
      rows.push([cx, yb, bw, bw * (0.42 + 0.25 * hk)]);
    }
    for (let i = 0; i < 10; i++) {
      const cx = p.w * (1.04 * r() - 0.02), ky = r(), sk = r(), hk = r();
      const yb = Math.max(0.5, screeDeep(p, cx, seed) * Math.pow(ky, 0.85));
      const k = clamp(yb / p.deep, 0, 1);
      const bw = (7 + 16 * k) * (0.6 + 0.9 * sk);
      rows.push([cx, yb, bw, yb < 5 ? H * (0.25 + 0.75 * Math.pow(clamp(cx / p.w, 0, 1), 1.2)) * (0.45 + 0.55 * hk) : bw * (0.38 + 0.3 * hk)]);
    }
    rows.sort((a, q) => a[1] - q[1]);
    // the heap itself: rubble of small stones of mixed sizes (each lit on its upper left, a dark gap
    // round it), heaped highest against the lip and running down to a few stones at the west tip;
    // its top and its west end wander at three scales, and it is the lip's own pale limestone,
    // so it never reads as a box against the cliff
    const env = (lx: number): number => {
      const u = clamp(lx / p.w, 0, 1.2);
      return 2 + H * 0.85 * Math.pow(u, 1.3) * (0.7 + 0.5 * fbm1(lx / 37, seed + 15, 2)) + (vnoise1(lx / 9, seed + 16) - 0.5) * 5 + (vnoise1(lx / 3.3, seed + 17) - 0.5) * 2;
    };
    const X0 = Math.max(b.ox, Math.floor(c.X(-10))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w + 30)));
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      const top = -env(lx);
      // (past its east end it runs on up against the lip's foot, thinning out)
      const D = lx > p.w ? Math.min(screeDeep(p, p.w, seed) - 7, (p.w + 30 - lx) * 2.2) : screeDeep(p, lx, seed) - 7;
      if (top >= D) continue;
      const Y0 = Math.max(b.oy, Math.floor(c.Y(top) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(D)));
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        if (ly < top || ly > D) continue;
        // the stone this point lies in: a jittered cell pattern of mixed sizes (never a grid)
        const G = 3.5 + 8 * Math.pow(vnoise(lx / 26, ly / 17, seed + 18), 1.6) * (0.6 + 0.6 * clamp(ly / 40, 0, 1));
        const gx = Math.floor(lx / G), gy = Math.floor(ly / (G * 0.7));
        let best = 9, bx = 0, by = 0, gap = 0.62;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const px = (gx + i + 0.5 + (hash(gx + i, gy + j, seed + 19) - 0.5) * 0.8) * G, py = (gy + j + 0.5 + (hash(gx + i, gy + j, seed + 21) - 0.5) * 0.8) * G * 0.7;
          const q = Math.hypot((lx - px) / G, (ly - py) / (G * 0.7)) * (0.8 + 0.4 * hash(gx + i, gy + j, seed + 22));
          if (q < best) { best = q; bx = px; by = py; gap = 0.55 + 0.3 * hash(gx + i, gy + j, seed + 23); }
        }
        const lit = -(0.62 * (lx - bx) + 0.78 * (ly - by)) / G;
        const deep = clamp((ly - top) / (D - top + 1), 0, 1);
        // (moss and grit settle in the upper gaps; the odd stone is mossy all over)
        if (best > gap && deep < 0.4 && vnoise(lx / 11, ly / 7, seed + 24) > 0.6) { b.set(x, y, P.moss[5]!); continue; }
        let k = best > gap ? (deep < 0.35 ? 3 : 4) : lit > 0.25 ? 0 : lit > -0.15 ? 1 : 2;
        if (deep > 0.55 && k < 4) k++;
        if (ly - top < 1.2 && k < 3) k = 0;
        b.set(x, y, [P.karst[3]!, P.karst[4]!, P.karst[5]!, P.karst[6]!, P.karst[8]!][k]!);
      }
    }
    // the stones, back (at the waterline) to front
    rows.forEach(([cx, yb, bw, bh], i) => screeBlock(c, cx, yb, bw, bh, seed + 100 + i * 17, yb > screeDeep(p, cx, seed) - 9));
    // a bleached branch or two lying across the heap, its shadow under it
    for (let i = 0; i < 2; i++) {
      const x0 = p.w * (0.05 + 0.4 * r()), x1 = x0 + 40 + r() * 50, y0 = 4 + r() * p.deep * 0.4, y1 = y0 + (r() - 0.3) * 18;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI * (1.5 + r())) * 1.5]);
      }
      if (d < 0.3) continue;
      for (const [px, py] of pts) dot(c, px + 1, py + 2.5, P.pine[5]!);
      stroke(c, pts, (u) => 3.4 - 1.6 * u, (_u, sd) => (sd < -0.3 ? P.paper[3]! : sd < 0.4 ? P.timber[2]! : P.timber[4]!));
      const [ex, ey] = pts[10]!;
      stroke(c, bladePath(ex, ey, 6 + r() * 6, 0.9, -0.4), () => 1, () => P.timber[3]!);
    }
    // sedge and reeds out of the gaps, a tangle of them toward the west tip
    for (let i = 0; i < 18; i++) {
      const x = r() * p.w * (i < 6 ? 0.5 : 1), yb = Math.min(screeDeep(p, x, seed) - 4, r() * p.deep * 0.8);
      const n = 3 + Math.floor(r() * 7), tall = 7 + r() * 20 * (1 - (yb / (p.deep + 1)) * 0.5);
      const blades: [number, number, number, number, number][] = [];
      for (let k = 0; k < n; k++) blades.push([x + (r() - 0.5) * 9, tall * (0.4 + 0.6 * r()), (r() - 0.5) * 1.1, (r() - 0.45) * 1.4, r() * 0.8]);
      if (yb < 0 || d < 0.3) continue;
      for (const [bx, ln, a, bd, l] of blades) grass(c, bx, yb + 0.5, ln, a, bd, l);
    }
    for (let i = 0; i < 4; i++) {
      const px = -6 - r() * 18, py = 2 + r() * 10, rx = 3 + r() * 5;
      if (d < 0.25) continue;
      for (let ox = -rx; ox <= rx; ox += 0.5) {
        const th = 1.4 * Math.sqrt(Math.max(0, 1 - (ox / rx) ** 2));
        dot(c, px + ox, py - th * 0.5, Math.abs(ox) < rx * 0.7 ? P.moss[4]! : P.moss[5]!);
        if (th > 0.7) dot(c, px + ox, py + 0.6, P.moss[6]!);
      }
    }
  },
});

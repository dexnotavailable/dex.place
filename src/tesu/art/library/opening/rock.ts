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
import { Spans, bayer4, clamp, fbm1, hash, hash1, rng, tone, vnoise1 } from "../../raster.ts";
import { boxOf, cached, clump, roughen, spansFor, toAbs, yAt } from "./kit.ts";
import { face, nextLedge } from "./face.ts";

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
    for (let x = x0 + 8; x < x1 - 8; x += 4 + r() * 10) {
      const rich = vnoise1(x / 160, seed + 79) * 0.7 + vnoise1(x / 47, seed + 80) * 0.3;
      if (rich < 0.6 - veg * 0.3) continue;
      const y = yAt(top, x);
      const k = r();
      if (k < 0.34 * veg) plants.push({ kind: "bush", x, y: y + capH * 0.5, r: 5 + r() * 11 * rich, seed: Math.floor(r() * 1e6) });
      else if (k < 0.6) plants.push({ kind: "strand", x, y: y + capH * 0.6, r: 6 + r() * 34 * rich * rich, seed: Math.floor(r() * 1e6) });
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

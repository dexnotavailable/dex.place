// The bay wall's finish (the hall loop, round 3, W2-3 / W2-5): the pieces that give the quiet wall round the
// Prize Court gate its structure at two or three values, and the one window lattice the whole hall uses.
//
// - The ice-ray lattice (bingliewen as joiners make it): straight timber bars meeting at odd angles, each cell
//   cut out of the last by one straight bar, so the cells are irregular polygons, never round cobbles. Used by
//   the bay's clerestories here and by every lattice window that shows the room's warm light behind it.
// - A carved sill rail at the clerestories' foot, the windows' own sill boards on it.
// - A pair of couplet boards high on the wall flanking the clerestories: black lacquer, a gold border, four
//   characters each carved and gilded (real characters drawn pixel by pixel: 天下太平 "peace under heaven" and
//   千山万水 "a thousand mountains, ten thousand rivers", the road every challenger walked to get here).
//
// Coordinates: level-1 local px of the play plane, the gate's centre on the floor (y up is negative).

import type { PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { M, LitField, clamp, face, fbm, grain, hash, mt, rect, vnoise } from "./kit.ts";

const H = 96;

// ===========================================================================
// The ice-ray lattice
// ===========================================================================
export interface Seg { x0: number; y0: number; x1: number; y1: number }

type Poly = [number, number][];

function areaOf(p: Poly): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j]![0] + p[i]![0]) * (p[j]![1] - p[i]![1]);
  return Math.abs(a) / 2;
}

function centroidOf(p: Poly): [number, number] {
  let x = 0, y = 0;
  for (const q of p) { x += q[0]; y += q[1]; }
  return [x / p.length, y / p.length];
}

/** Splits a convex polygon by the line through (px, py) at angle a: the two halves and the chord. */
function split(p: Poly, px: number, py: number, a: number): [Poly, Poly, Seg] | null {
  const nx = -Math.sin(a), ny = Math.cos(a);
  const side = (q: [number, number]): number => (q[0] - px) * nx + (q[1] - py) * ny;
  const A: Poly = [], B: Poly = [], cut: [number, number][] = [];
  for (let i = 0; i < p.length; i++) {
    const u = p[i]!, v = p[(i + 1) % p.length]!;
    const su = side(u), sv = side(v);
    (su >= 0 ? A : B).push(u);
    if ((su >= 0) !== (sv >= 0)) {
      const t = su / (su - sv);
      const q: [number, number] = [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
      A.push(q); B.push(q); cut.push(q);
    }
  }
  if (cut.length !== 2 || A.length < 3 || B.length < 3) return null;
  return [A, B, { x0: cut[0]![0], y0: cut[0]![1], x1: cut[1]![0], y1: cut[1]![1] }];
}

const ICE = new Map<string, Seg[]>();
/** Each lattice's bars bucketed on a coarse grid (the nearest-bar search only looks at the bars near a point). */
const GRID = new WeakMap<readonly Seg[], { g: number; cols: number; cells: number[][] }>();
const GS = 16;

/**
 * The bars of an ice-ray lattice filling w x h (local px from its top-left): each cell is split by one straight
 * bar across its longer way, at a slant, until the cells are about `cell` px square in area.
 */
export function iceRay(w: number, h: number, seed: number, cell = 560): Seg[] {
  const key = `${Math.round(w)}|${Math.round(h)}|${seed}|${cell}`;
  const hit = ICE.get(key);
  if (hit) return hit;
  const segs: Seg[] = [];
  const stack: [Poly, number, number][] = [[[[0, 0], [w, 0], [w, h], [0, h]], 0, 1]];
  while (stack.length) {
    const [pg, depth, id] = stack.pop()!;
    const A = areaOf(pg);
    if (A < cell * (0.75 + 0.6 * hash(id, 7, seed)) || depth > 9) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of pg) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const [cx, cy] = centroidOf(pg);
    const s = Math.sqrt(A);
    // across the longer way, at a slant of 10-35 degrees off square (never level, never plumb), through a point near
    // the cell's middle; a cut that would leave a sliver (a half under a third of the cell) is tried again
    const across = x1 - x0 > y1 - y0 ? Math.PI / 2 : 0;
    let r: [Poly, Poly, Seg] | null = null;
    for (let tr = 0; tr < 5 && !r; tr++) {
      const px = cx + (hash(id, 1 + tr * 5, seed) - 0.5) * s * 0.2, py = cy + (hash(id, 2 + tr * 5, seed) - 0.5) * s * 0.2;
      const off = (0.17 + 0.43 * hash(id, 3 + tr * 5, seed)) * (hash(id, 4 + tr * 5, seed) < 0.5 ? -1 : 1);
      const q = split(pg, px, py, across + off);
      if (q && Math.min(areaOf(q[0]), areaOf(q[1])) > A * 0.33) r = q;
    }
    if (!r) continue;
    segs.push(r[2]);
    stack.push([r[0], depth + 1, id * 2], [r[1], depth + 1, id * 2 + 1]);
  }
  ICE.set(key, segs);
  const cols = Math.ceil(w / GS) + 1, rows = Math.ceil(h / GS) + 1;
  const cells: number[][] = Array.from({ length: cols * rows }, () => []);
  segs.forEach((sg, i) => {
    const a0 = Math.max(0, Math.floor((Math.min(sg.x0, sg.x1) - 3) / GS)), a1 = Math.min(cols - 1, Math.floor((Math.max(sg.x0, sg.x1) + 3) / GS));
    const b0 = Math.max(0, Math.floor((Math.min(sg.y0, sg.y1) - 3) / GS)), b1 = Math.min(rows - 1, Math.floor((Math.max(sg.y0, sg.y1) + 3) / GS));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) cells[b * cols + a]!.push(i);
  });
  GRID.set(segs, { g: GS, cols, cells });
  return segs;
}

/** Distance from (x, y) to the nearest bar, and whether that bar runs nearer level than plumb. */
export function iceDist(segs: readonly Seg[], x: number, y: number): [number, boolean] {
  let best = Infinity, flat = false;
  // (only bars within 3 px of the point's grid cell are looked at: the answer is exact up to 3 px, all a bar or a lip
  // asks for; further away it is Infinity)
  const grid = GRID.get(segs);
  const cell = grid ? grid.cells[Math.floor(y / grid.g) * grid.cols + Math.floor(x / grid.g)] : undefined;
  const list = grid ? (cell ?? []).map((i) => segs[i]!) : segs;
  for (const s of list) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / l2, 0, 1);
    const d = Math.hypot(x - s.x0 - dx * t, y - s.y0 - dy * t);
    if (d < best) { best = d; flat = Math.abs(dx) > Math.abs(dy); }
  }
  return [best, flat];
}

// ===========================================================================
// The clerestories' sill rail and the couplet boards
// ===========================================================================
/** The sill rail's band under the clerestories (local y: top, bottom). */
export function sillRail(clY1: number): [number, number] {
  return [clY1 + 2, clY1 + 11];
}

/** The couplet boards: [x0, y0, x1, y1], flanking the clerestories outside them. */
export function coupletBoxes(cw: number, clY0: number): [number, number, number, number][] {
  const w = 23, h = 84;
  const x = cw + 0.5 * H;
  const y0 = clY0 + 6;
  return [[-x - w / 2, y0, -x + w / 2, y0 + h], [x - w / 2, y0, x + w / 2, y0 + h]];
}

/** 11 x 13 glyphs, 1 px strokes. */
const GLYPH: Record<string, string[]> = {
  天: [
    "...........",
    "..#######..",
    ".....#.....",
    ".....#.....",
    "###########",
    ".....#.....",
    ".....#.....",
    "....#.#....",
    "...#...#...",
    "..#.....#..",
    ".#.......#.",
    "#.........#",
    "...........",
  ],
  下: [
    "...........",
    "###########",
    ".....#.....",
    ".....##....",
    ".....#.#...",
    ".....#..#..",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    "...........",
  ],
  太: [
    ".....#.....",
    ".....#.....",
    ".....#.....",
    "###########",
    ".....#.....",
    ".....#.....",
    "....#.#....",
    "...#...#...",
    "..#.....#..",
    ".#..#....#.",
    "#....#....#",
    "...........",
    "...........",
  ],
  平: [
    "...........",
    ".#########.",
    "...........",
    "..#.....#..",
    "...#...#...",
    "...........",
    "###########",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    "...........",
  ],
  千: [
    "........##.",
    "....####...",
    ".....#.....",
    ".....#.....",
    "###########",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    ".....#.....",
    "...........",
  ],
  山: [
    ".....#.....",
    ".....#.....",
    ".....#.....",
    "#....#....#",
    "#....#....#",
    "#....#....#",
    "#....#....#",
    "#....#....#",
    "#....#....#",
    "###########",
    "...........",
    "...........",
    "...........",
  ],
  万: [
    "...........",
    "###########",
    "...#.......",
    "...#.......",
    "...#######.",
    "...#.....#.",
    "..#......#.",
    "..#......#.",
    ".#.......#.",
    ".#.......#.",
    "#......##..",
    "...........",
    "...........",
  ],
  水: [
    ".....#.....",
    ".....#.....",
    ".....#...#.",
    "####.#..#..",
    "...#.#.#...",
    "...#.##....",
    "..#..#.#...",
    "..#..#..#..",
    ".#...#...#.",
    "#....#....#",
    "....##.....",
    "...........",
    "...........",
  ],
};

/** The couplet boards, painted over the bay wall (after its plaster, before the shade). */
export function couplets(c: PaintCtx, cw: number, clY0: number, lf: LitField): void {
  const lines = ["天下太平", "千山万水"];
  // the right-hand board is read first; it hangs on the right
  coupletBoxes(cw, clY0).forEach(([x0, y0, x1, y1], i) => {
    const text = lines[i === 1 ? 0 : 1]!;
    // its shadow on the plaster, down and to the right (the room's light is high and to the left of the bay)
    rect(c, x0 + 2, y0 + 3, x1 + 3, y1 + 4, (X, Y, lx, ly) => (lx > x1 || ly > y1 ? mt(PLASTER_DARK, 0.3 + 0.2 * hash(X, Y, 3), X, Y, 0, 1) : 0));
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx - x0, x1 - lx, ly - y0, y1 - ly);
      // the frame: a gold bead, a black lacquer fillet, worn at the corners
      if (e < 1) return mt(M.lacq, face(l.k, -0.5) * 0.4, X, Y, 0.3, 1, 0);
      if (e < 2.5) {
        const worn = fbm(lx * 0.3, ly * 0.3, 611 + i, 2) > 0.7;
        return worn ? mt(M.wood, face(l.k, -0.5) * 0.6, X, Y, 0.3, 1, 0) : mt(M.gold, face(l.k, -0.5, lx - x0 < 2.5 ? -1 : 0, ly - y0 < 2.5 ? -1 : 0) * 0.85, X, Y, 0.1, 1, 0);
      }
      if (e < 3.5) return mt(M.lacq, face(l.k, -0.5) * 0.3, X, Y, 0.3, 1, 0);
      // the board: black lacquer with a faint sheen down its left third, crazed with age
      const sheen = Math.abs((lx - x0) / (x1 - x0) - 0.3) < 0.06 ? 0.12 : 0;
      const craze = Math.abs(vnoise(lx * 0.4, ly * 0.12, 613 + i) - 0.5) < 0.03 ? -0.05 : 0;
      return mt(M.lacq, face(l.k, -0.5) * 0.42 + sheen + craze + grain(lx, ly, 617 + i) * 0.05, X, Y, 0.2, 1, 0.2);
    });
    // the characters: gilded, cut into the lacquer (a dark lip on each stroke's upper left, the gold lit lower right
    // where the cut catches the light)
    const gx0 = Math.round((x0 + x1) / 2 - 5.5);
    for (let k = 0; k < text.length; k++) {
      const g = GLYPH[text[k]!];
      if (!g) continue;
      const gy0 = Math.round(y0 + 6 + k * 18.5);
      for (let r = 0; r < g.length; r++) for (let q = 0; q < g[r]!.length; q++) {
        if (g[r]![q] !== "#") continue;
        const X = Math.round(c.X(gx0 + q)), Y = Math.round(c.Y(gy0 + r));
        if (X < c.buf.ox || X >= c.buf.x1 || Y < c.buf.oy || Y >= c.buf.y1) continue;
        const up = r > 0 && g[r - 1]![q] === "#", left = q > 0 && g[r]![q - 1] === "#";
        const l = lf.get(gx0 + q, gy0 + r);
        const v = face(l.k, -0.5) * (up && left ? 0.95 : up || left ? 0.85 : 0.7);
        c.buf.set(X, Y, mt(M.gold, v, X, Y, 0.0, 1, 0));
      }
    }
    // a red seal low on the second board (the carver's)
    if (i === 0) {
      const sy = y1 - 9, sx = (x0 + x1) / 2 - 3;
      rect(c, sx, sy, sx + 6, sy + 6, (X, Y, lx, ly) => (Math.abs(lx - sx - 3) < 1 && Math.abs(ly - sy - 3) < 1.6 ? P.red[1]! : mt(P.red, 0.45, X, Y, 0, 1, 0)));
    }
  });
}

/** The plaster's dark end, for the boards' cast shadows. */
const PLASTER_DARK = [P.umber[2]!, P.umber[3]!, P.umber[4]!];

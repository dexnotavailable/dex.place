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
import { plumCrest } from "./signs.ts";

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

/** The polygon's diameter (its longest vertex-to-vertex span), the direction of that span, and its least width. */
function shapeOf(p: Poly): { dia: number; ang: number; minW: number } {
  let dia = 0, ang = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    const d = Math.hypot(p[j]![0] - p[i]![0], p[j]![1] - p[i]![1]);
    if (d > dia) { dia = d; ang = Math.atan2(p[j]![1] - p[i]![1], p[j]![0] - p[i]![0]); }
  }
  // (a convex polygon is narrowest across one of its own edges)
  let minW = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey);
    if (el < 1e-6) continue;
    let far = 0;
    for (const q of p) far = Math.max(far, Math.abs((q[0] - a[0]) * ey - (q[1] - a[1]) * ex) / el);
    minW = Math.min(minW, far);
  }
  return { dia, ang, minW };
}

/** The angle (0..pi/2) at which a bar along (dx, dy) meets the polygon side its end lands on. */
function meetAngle(p: Poly, q: [number, number], dx: number, dy: number): number {
  let best = Infinity, ang = Math.PI / 2;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    const ex = b[0] - a[0], ey = b[1] - a[1], el2 = ex * ex + ey * ey;
    if (el2 < 1e-9) continue;
    const t = clamp(((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / el2, 0, 1);
    const d = Math.hypot(q[0] - a[0] - ex * t, q[1] - a[1] - ey * t);
    if (d < best) {
      best = d;
      const cs = Math.abs(dx * ex + dy * ey) / (Math.hypot(dx, dy) * Math.sqrt(el2));
      ang = Math.acos(clamp(cs, 0, 1));
    }
  }
  return ang;
}

/**
 * The bars of an ice-ray lattice filling w x h (local px from its top-left), as a joiner builds one (round 4, W2-a:
 * the round-3 lattice read as SHATTERED GLASS: its slivers and near-crossings were cracks). Each cell is cut by one
 * straight bar from one of its sides to another, so every bar starts and ends on a bar already there: T joints only,
 * never a crossing. Of a few dozen trial cuts the one kept leaves both halves compact (no half longer than ~2.5 times
 * its width, neither under ~30% of the cell, none over 5 sides), meets the sides at a decent angle (no hairline
 * wedges), and lands a few px clear of every joint already there (two cuts meeting a bar at one point from either
 * side read as a crossing). Cells end about `cell` px in area.
 */
export function iceRay(w: number, h: number, seed: number, cell = 560): Seg[] {
  const key = `${Math.round(w)}|${Math.round(h)}|${seed}|${cell}`;
  const hit = ICE.get(key);
  if (hit) return hit;
  const segs: Seg[] = [];
  const joints: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
  // (breadth first: the big cells are cut before the small ones, so the joints spread evenly over the window)
  const queue: [Poly, number][] = [[[[0, 0], [w, 0], [w, h], [0, h]], 1]];
  const s0 = Math.sqrt(cell);
  while (queue.length) {
    const [pg, id] = queue.shift()!;
    const A = areaOf(pg);
    if (A < cell * (0.8 + 0.55 * hash(id, 7, seed)) || id > 1 << 14) continue;
    const [cx, cy] = centroidOf(pg);
    const s = Math.sqrt(A);
    const longAng = shapeOf(pg).ang;
    const gap = Math.max(3.5, 0.24 * Math.min(s, s0 * 1.4));
    let best: [Poly, Poly, Seg] | null = null, bestScore = -Infinity;
    // (three tries, each a little more forgiving, so no big cell is left uncut: a joint may come closer, a half a little
    // longer or smaller)
    for (let tier = 0; tier < 3 && !best; tier++) {
    const gapT = gap * [1, 0.65, 0.45][tier]!, aspT = [2.6, 3.0, 3.4][tier]!, balT = [0.3, 0.26, 0.22][tier]!, angT = [0.6, 0.52, 0.45][tier]!;
    for (let tr = 0; tr < 36; tr++) {
      const r = (k: number): number => hash(id, tr * 7 + k + tier * 401, seed);
      // across the cell's long span, give or take 40 degrees; never quite level or plumb
      let a = longAng + Math.PI / 2 + (r(1) - 0.5) * 1.4;
      const m = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
      if (m < 0.12 || m > Math.PI / 2 - 0.12) a += 0.2;
      const px = cx + (r(2) - 0.5) * s * 0.3, py = cy + (r(3) - 0.5) * s * 0.3;
      const q = split(pg, px, py, a);
      if (!q) continue;
      const [P0, P1, sg] = q;
      if (P0.length > 5 || P1.length > 5) continue;
      const bal = Math.min(areaOf(P0), areaOf(P1)) / A;
      if (bal < balT) continue;
      const sh0 = shapeOf(P0), sh1 = shapeOf(P1);
      const asp = Math.max(sh0.dia / Math.max(1e-6, sh0.minW), sh1.dia / Math.max(1e-6, sh1.minW));
      if (asp > aspT) continue;
      const dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0;
      let ok = true;
      for (const e of [[sg.x0, sg.y0], [sg.x1, sg.y1]] as [number, number][]) {
        if (meetAngle(pg, e, dx, dy) < angT) { ok = false; break; }
        for (const j of joints) if (Math.hypot(j[0] - e[0], j[1] - e[1]) < gapT) { ok = false; break; }
        if (!ok) break;
      }
      if (!ok) continue;
      const score = 1 / asp + 0.7 * bal - (0.15 * Math.hypot(dx, dy)) / s + 0.05 * r(4);
      if (score > bestScore) { bestScore = score; best = q; }
    }
    }
    if (!best) continue;
    const sg = best[2];
    segs.push(sg);
    joints.push([sg.x0, sg.y0], [sg.x1, sg.y1]);
    queue.push([best[0], id * 2], [best[1], id * 2 + 1]);
  }
  ICE.set(key, segs);
  const cols = Math.ceil(w / GS) + 1, rows = Math.ceil(h / GS) + 1;
  const cells: number[][] = Array.from({ length: cols * rows }, () => []);
  segs.forEach((sg, i) => {
    const a0 = Math.max(0, Math.floor((Math.min(sg.x0, sg.x1) - 4) / GS)), a1 = Math.min(cols - 1, Math.floor((Math.max(sg.x0, sg.x1) + 4) / GS));
    const b0 = Math.max(0, Math.floor((Math.min(sg.y0, sg.y1) - 4) / GS)), b1 = Math.min(rows - 1, Math.floor((Math.max(sg.y0, sg.y1) + 4) / GS));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) cells[b * cols + a]!.push(i);
  });
  GRID.set(segs, { g: GS, cols, cells });
  return segs;
}

/** The bars near a point (from the lattice's grid). */
function nearBars(segs: readonly Seg[], x: number, y: number): readonly Seg[] {
  const grid = GRID.get(segs);
  if (!grid) return segs;
  if (x < 0 || y < 0) return [];
  return (grid.cells[Math.floor(y / grid.g) * grid.cols + Math.floor(x / grid.g)] ?? []).map((i) => segs[i]!);
}

/** Distance from (x, y) to the nearest bar, and whether that bar runs nearer level than plumb. */
export function iceDist(segs: readonly Seg[], x: number, y: number): [number, boolean] {
  let best = Infinity, flat = false;
  // (only bars within 4 px of the point's grid cell are looked at: the answer is exact up to 4 px, all a bar or a lip
  // asks for; further away it is Infinity)
  for (const s of nearBars(segs, x, y)) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / l2, 0, 1);
    const d = Math.hypot(x - s.x0 - dx * t, y - s.y0 - dy * t);
    if (d < best) { best = d; flat = Math.abs(dx) > Math.abs(dy); }
  }
  return [best, flat];
}

/**
 * Which part of a bar of half-width hw a point is on: 0 off every bar, 1 the bar's lit top edge (the side toward the
 * room's high light, up and a little left), 2 its body, 3 its dark lower edge. Every bar is one even width; where a bar
 * butts into another its body runs on into the joint, so the other's edge breaks there as a real joint does.
 */
export function iceBar(segs: readonly Seg[], x: number, y: number, hw = 1.5): 0 | 1 | 2 | 3 {
  let best = Infinity, side = 0;
  for (const s of nearBars(segs, x, y)) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / l2, 0, 1);
    const d = Math.hypot(x - s.x0 - dx * t, y - s.y0 - dy * t);
    if (d < best) {
      best = d;
      const l = Math.sqrt(l2);
      let nx = -dy / l, ny = dx / l;
      if (nx * -0.4 + ny * -0.92 < 0) { nx = -nx; ny = -ny; }
      side = (x - s.x0) * nx + (y - s.y0) * ny;
    }
  }
  if (best >= hw) return 0;
  return side > hw - 1 ? 1 : side < -(hw - 1) ? 3 : 2;
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
  bayBanners(c, cw, clY0, lf);
}

/**
 * The bay's two quiet stretches beyond the couplets (round 4, W2-d: the plaster there read as one flat navy field,
 * L 26, sd 6; ref 06's dark mass is big shapes with value steps: roofs, posts, banners), given one big shape each:
 * - east: a long silk banner hung from the tie beam: old lacquer-red silk gone toward brown, three soft folds across
 *   it (the room's lamps light the fold faces turned up-left), a gold-thread border, the hall's plum crest in a
 *   roundel near the top, a column of cloud scrolls embroidered a step darker below it, a swallowtail hem with a
 *   tassel at each tip; a short shadow on the plaster down and right. It hangs clear of the map lantern's cord (+4.15
 *   H) and ends 3.6 H above the floor.
 * - west: the register's signboard over the counter (W1, round 4) is that stretch's big shape; nothing hangs there
 *   from the tie beam, or the signboard's cords would cross it.
 */
export function bayBanners(c: PaintCtx, cw: number, clY0: number, lf: LitField): void {
  const top = clY0 - 0.3 * H + 3, bot = -3.6 * H;
  const w = 0.4 * H;
  // (2.47 H east of the head's beam end: clear of the couplet and of the map lantern's cord)
  [cw + 2.47 * H].forEach((cx, i) => {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const tail = 0.24 * H;
    // the shadow on the plaster
    rect(c, x0 + 2, top + 6, x1 + 4, bot + 4, (X, Y, lx, ly) => {
      if (lx < x1 && ly < bot - tail + 2) return 0;
      const hemY = bot - tail * (1 - Math.abs(((lx - 2 - x0) / w) * 2 - 1));
      if (ly > hemY + 3) return 0;
      return mt(PLASTER_DARK, 0.35 + 0.2 * hash(X, Y, 5), X, Y, 0, 1);
    });
    // the rod and its knobs
    rect(c, x0 - 5, top - 3, x1 + 5, top + 1, (X, Y, lx, ly) => {
      const knob = lx < x0 - 1 || lx > x1 + 1;
      const l = lf.get(lx, ly);
      return knob ? mt(M.gold, face(l.k, -0.5, lx < cx ? -0.6 : 0.6, ly < top - 1.5 ? -0.8 : 0) * 0.8, X, Y, 0.15, 1, 0) : mt(M.wood, face(l.k, -0.5, 0, ly < top - 1.5 ? -0.8 : 0.5) * 0.6, X, Y, 0.35, 1, 0);
    });
    const phase = hash(i, 1, 811) * 6;
    rect(c, x0, top + 1, x1, bot, (X, Y, lx, ly) => {
      const u = (lx - x0) / w;
      // the swallowtail hem
      const hemY = bot - tail * (1 - Math.abs(u * 2 - 1));
      if (ly > hemY) return 0;
      const l = lf.get(lx, ly);
      // three soft folds: the face of each fold turned up-left takes the light, the turn into the next a step down
      const fold = Math.cos(u * Math.PI * 3 + phase + (ly - top) * 0.004);
      const k = face(l.k, -0.5, fold * -0.55, 0);
      const e = Math.min(lx - x0, x1 - lx);
      // the gold-thread border, worn in places
      if (e < 1.2) return mt(M.verm, 0.05 + k * 0.5, X, Y, 0.5, 1, 0);
      if (e > 2 && e < 3.2 && fbm(lx * 0.3, ly * 0.05, 821 + i, 2) < 0.7) return mt(M.gold, 0.25 + k * 0.6, X, Y, 0.3, 1, 0);
      if (hemY - ly < 3 && hemY - ly > 1.5) return mt(M.gold, 0.22 + k * 0.6, X, Y, 0.3, 1, 0);
      // a column of cloud scrolls embroidered a step darker down its middle, under the crest
      const cy0 = top + 0.75 * H;
      if (ly > cy0 && ly < hemY - 8) {
        const rv = ruyiCol(lx - cx, ly - cy0, w * 0.3, 827 + i);
        if (rv === 2) return mt(M.gold, 0.12 + k * 0.5, X, Y, 0.45, 1, 0);
        if (rv === 1) return mt(M.verm, 0.08 + k * 0.6, X, Y, 0.45, 1, 0);
      }
      // the silk: old red going brown, a sheen line down the lit face of the middle fold, a little fading low
      const sheen = fold < -0.85 && Math.abs(u - 0.5) < 0.3 ? 0.08 : 0;
      return mt(M.verm, 0.2 + k * 0.62 + sheen - (ly - top) / (bot - top) * 0.06, X, Y, 0.45, 1, 0.25);
    });
    // the crest in a roundel near the top
    const g = (kk: number) => (X: number, Y: number, lx: number, ly: number) => mt(M.gold, face(lf.get(lx, ly).k, -0.5) * kk, X, Y, 0.1, 1, 0);
    plumCrest(c, Math.round(cx), Math.round(top + 0.36 * H), Math.round(0.14 * H), g(0.85), (X, Y) => mt(M.verm, 0.25, X, Y, 0.55, 1, 0), g(1.05));
    // the tassels at the tail's tips
    for (const tx of [x0 + 1.5, x1 - 1.5]) {
      rect(c, tx - 1.5, bot - 1, tx + 1.5, bot + 0.2 * H, (X, Y, lx, ly) => {
        const t = (ly - bot) / (0.2 * H);
        if (t < 0.18) return Math.abs(lx - tx) < 1.4 ? mt(M.gold, face(lf.get(lx, ly).k, -0.5) * 0.85, X, Y, 0.15, 1, 0) : 0;
        if (Math.abs(lx - tx) > 0.6 + t * 1.0) return 0;
        return mt(M.verm, face(lf.get(lx, ly).k, -0.5, (lx - tx) * 0.5, 0) * 0.6, X, Y, 0.45, 1, 0);
      });
    }
  });
}

/** A column of small cloud scrolls (0 off, 1 on, 2 its outline): one every ~0.5 H, alternating their curl. */
function ruyiCol(x: number, y: number, r: number, seed: number): number {
  const per = 0.5 * H;
  const i = Math.floor(y / per);
  const cy = (i + 0.5) * per, flip = i % 2 === 0 ? 1 : -1;
  const dx = x * flip, dy = y - cy;
  const R = r * (0.62 + 0.12 * hash(i, 1, seed));
  const d = Math.min(Math.hypot(dx, dy) - R, Math.hypot(dx + R * 0.9, dy + R * 0.55) - R * 0.55, Math.hypot(dx - R * 0.95, dy + R * 0.45) - R * 0.5);
  if (d < -1.4) return Math.abs(Math.hypot(dx, dy) - R * 0.45) < 0.8 ? 2 : 1;
  if (d < 0) return 2;
  return 0;
}

/** The plaster's dark end, for the boards' cast shadows. */
const PLASTER_DARK = [P.umber[2]!, P.umber[3]!, P.umber[4]!];

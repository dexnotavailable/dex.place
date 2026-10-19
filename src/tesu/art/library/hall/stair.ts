// The Hall of Works' stair (hall loop round 2, W1-1; Dex 10-19: "fix the obvious triangle shape; rework
// seams like the stairs"). It comes down from the Long Gallery's east end in two short flights with a
// landing between them, like ref 07's timber stairs: the landing stands on two posts that rise on through
// it as the newels, each flight is a cut string (the steps' treads and risers show as a stepped top edge)
// on a deep lacquered stringer, and a handrail on turned balusters runs from the head newel to the foot
// newel (front plane). Under it the space is built and used: the bay's post and a stair post with knee
// braces carry the upper flight, stepped shelves of crates, boxes and scrolls sit over the docs shelf, the
// reading nook sits under the landing behind a short curtain, a cupboard and crates fill the low end. The
// wall at the back steps down in value in bands, warm low where the nook's lamp reaches, darkest high up.
// The head lands on a header at the gallery's edge; the foot ends in a stone step and a newel on a stone base.
//
// Coordinates: level-1 local px of the play plane, the anchor at the stair's head on the gallery floor;
// x right, y down (the floor is `floor` px below the head).

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, SCREEN, LitField, clamp, cyl, fbm, grain, hash, lathe, lum, mt, poly, rect, tn, vnoise, type At, type Lit, type Ramp } from "./kit.ts";

const H = 96;
/** A step's rise, about (px): a flight gets as many steps as rise to this. */
const RISE = 16;
/** The stringer's depth under the steps' inner corners (px). */
const STR = 30;
/** The handrail's height over the nosing line (px). */
const RAIL = Math.round(0.6 * H);
/** A newel's height over the floor or landing it stands on (px). */
const NEWEL = Math.round(0.8 * H);
/** Half the width of a post (px). */
const POST = 7;

/**
 * A surface's value (for mt) round a chosen base: the stair stands in the hall's dim middle distance, so each
 * part is given the value it reads at (base) and the light moves it from there (the nook's lamp lifts what is
 * low and near it; the dark high up takes it down), instead of every part sinking into one dark.
 */
function V(l: Lit, base: number, nx = 0, ny = 0, gain = 0.75): number {
  return base + (lum(l, nx, ny) - 0.2) * gain;
}

export interface StairP {
  /** The walk from the head down, local px: [0, 0, x, y, ..., foot x, foot y]; a flat run is a landing. */
  pts: number[];
  /** The hall's floor below the head (px). */
  floor: number;
  /** The west end of the built space under the stair (local x): the bay's post stands just west of it. */
  wall0: number;
  /** Posts carrying the flights (local x). */
  posts: number[];
  /** The docs shelf under the upper flight: [x0, x1, height] (the stair's shelves step up over it). */
  shelf?: [number, number, number];
  /** The cupboard and the crates under the lower flight: local x ranges. */
  cupboard?: [number, number];
  crates?: [number, number];
  /** The rail (front plane) instead of the stair. */
  rail?: boolean;
  at?: At;
}

interface Flight { x0: number; y0: number; x1: number; y1: number; n: number; run: number; rise: number }

/** The stair's shape from its walk: flights, landings and the lines every part is drawn to. */
export interface StairGeo {
  flights: Flight[];
  landings: [number, number, number][];
  /** Half a step's rise (px). */
  hr: number;
  /** The walk's line at x (the treads' middles). */
  walk(x: number): number;
  /** The tread under x (the stepped top edge). */
  top(x: number): number;
  /** The steps' inner corners (the stringer's top). */
  inner(x: number): number;
  /** The stair's underside: the stringer's or the landing beam's bottom. */
  under(x: number): number;
  foot: [number, number];
}

export function stairGeo(pts: readonly number[]): StairGeo {
  const flights: Flight[] = [], landings: [number, number, number][] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i]!, y0 = pts[i + 1]!, x1 = pts[i + 2]!, y1 = pts[i + 3]!;
    if (Math.abs(y1 - y0) < 2) landings.push([x0, x1, y0]);
    else {
      const n = Math.max(3, Math.round((y1 - y0) / RISE));
      flights.push({ x0, y0, x1, y1, n, run: (x1 - x0) / n, rise: (y1 - y0) / n });
    }
  }
  const hr = (flights[0]?.rise ?? RISE) / 2;
  const walk = (x: number): number => {
    let i = 0;
    while (i + 5 < pts.length && x > pts[i + 2]!) i += 2;
    const x0 = pts[i]!, y0 = pts[i + 1]!, x1 = pts[i + 2]!, y1 = pts[i + 3]!;
    const t = clamp((x - x0) / Math.max(1e-6, x1 - x0), 0, 1);
    return y0 + (y1 - y0) * t;
  };
  const top = (x: number): number => {
    const f = flights.find((g) => x >= g.x0 && x <= g.x1);
    if (!f) return walk(x);
    return f.y0 + f.rise * clamp(Math.round((x - f.x0) / f.run), 0, f.n);
  };
  const inner = (x: number): number => walk(x) + hr;
  const under = (x: number): number => inner(x) + STR;
  return { flights, landings, hr, walk, top, inner, under, foot: [pts[pts.length - 2]!, pts[pts.length - 1]!] };
}

/** A square timber post lacquered red: a stone base, a gold band under its bearing block, lit on one side. */
function post(c: PaintCtx, lf: LitField, x: number, y0: number, y1: number, cap: "block" | "newel" | "none", base: boolean, seed: number): void {
  const side = clamp(lf.get(x, (y0 + y1) / 2).dx * 1.6, -1, 1);
  if (base) {
    // a squat stone plinth with a chamfered top
    const bw = POST + 5, bh = 0.17 * H;
    rect(c, x - bw, y1 - bh, x + bw, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - x) / bw, v = (ly - y1 + bh) / bh;
      const ny = v < 0.22 ? -0.9 : v > 0.88 ? 0.5 : 0;
      const nx = Math.abs(u) > 0.86 ? Math.sign(u) * 0.8 : 0;
      const chip = fbm(lx * 0.4, ly * 0.4, seed, 2) > 0.72 ? 0.12 : 0;
      return mt(M.stone, V(l, ny < 0 ? 0.62 : 0.42, nx, ny) - chip, X, Y, 0.25, 1);
    });
    y1 -= 0.17 * H;
  }
  rect(c, x - POST, y0, x + POST, y1, (X, Y, lx, ly) => {
    const l = lf.get(x, ly);
    const u = (lx - x) / POST;
    // the arris either side catches the light; the face away from it is in shadow
    const nx = u < -0.7 ? -0.9 : u > 0.7 ? 0.9 : 0;
    const band = cap !== "none" && ly > y0 + 0.13 * H && ly < y0 + 0.19 * H;
    if (band) return mt(M.gold, V(l, 0.62, nx, 0), X, Y, 0.2, 1);
    const wornFoot = y1 - ly < 0.5 * H ? vnoise(lx * 0.5, ly * 0.15, seed) * 0.1 : 0;
    const arris = u * side > 0.7 ? 0.16 : u * side < -0.7 ? -0.14 : 0;
    // the stair's own carrying posts are plain timber; the newels are lacquered red like the gallery's posts
    if (cap === "block") return mt(M.wood, V(l, 0.42, nx, 0) + arris + grain(lx, ly, seed) * 0.08 - wornFoot, X, Y, 0.2, 1);
    return mt(M.verm, V(l, 0.5, nx, 0) + arris + grain(lx, ly, seed) * 0.05 - wornFoot, X, Y, 0.25, 1);
  });
  if (cap === "block") {
    // a bearing block wider than the post, under whatever it carries
    rect(c, x - POST - 4, y0, x + POST + 4, y0 + 0.11 * H, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = (ly - y0) / (0.11 * H);
      return mt(M.wood, V(l, v > 0.75 ? 0.62 : 0.48, (lx - x) / (POST + 4) * 0.6, v > 0.75 ? 0.7 : 0), X, Y, 0.2, 1);
    });
  } else if (cap === "newel") {
    // the newel's head: a moulded cap and a gold lotus finial
    rect(c, x - POST - 3, y0 - 6, x + POST + 3, y0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = (ly - y0 + 6) / 6;
      return mt(M.wood, V(l, v < 0.35 ? 0.78 : 0.45, (lx - x) / (POST + 3) * 0.5, v < 0.35 ? -0.9 : 0.4), X, Y, 0.15, 1);
    });
    lathe(c, x, y0 - 18, y0 - 6, (ly) => {
      const t = (ly - (y0 - 18)) / 12;
      return t < 0.2 ? 1.5 : 1.5 + Math.sin(Math.min(1, (t - 0.2) / 0.6) * Math.PI) * 4.2 + (t > 0.8 ? 1.5 : 0);
    }, (X, Y, u, _lx, ly) => mt(M.gold, cyl(0.45 + lf.get(x, ly).k * 0.6, u, side, 0.15), X, Y, 0.0, 1));
  }
}

/** A knee brace: a timber strut from a post up to what it carries. */
function brace(c: PaintCtx, lf: LitField, ax: number, ay: number, bx: number, by: number, w: number): void {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  const nx = -dy / L * w / 2, ny = dx / L * w / 2;
  poly(c, [ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny], (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    // which edge of the strut: the one facing up is lit, the one facing down in shadow
    const s = ((lx - ax) * -dy + (ly - ay) * dx) / L; // signed distance across
    const edge = Math.abs(s) > w / 2 - 1.3;
    const upper = s * (dx / L) < 0;
    return mt(M.wood, V(l, edge ? (upper ? 0.6 : 0.3) : 0.45, 0, edge ? (upper ? -0.8 : 0.8) : 0) + grain(lx * 0.3, ly, 5, false) * 0.05, X, Y, 0.25, 1);
  });
}

/** One thing stored on a shelf under the stair, standing on y (its foot), from x, no taller than room. Returns its width. */
function stored(c: PaintCtx, lf: LitField, x: number, y: number, room: number, i: number, seed: number): number {
  const r = hash(i, seed, 211);
  const lit = (lx: number, ly: number, nx: number, ny: number, ramp: Ramp, mul = 1, lo = 0.15): (X: number, Y: number) => number =>
    (X, Y) => mt(ramp, V(lf.get(lx, ly), 0.58 * mul, nx, ny), X, Y, lo, 1);
  if (r < 0.26 && room > 22) {
    // a crate: planks, a darker band where they meet, a lit edge
    const w = 22 + Math.floor(hash(i, 3, seed) * 10), hh = Math.min(room - 3, 18 + Math.floor(hash(i, 4, seed) * 8));
    rect(c, x, y - hh, x + w, y, (X, Y, lx, ly) => {
      const u = (lx - x) / w, v = (ly - y + hh) / hh;
      const nx = u < 0.08 ? -0.8 : u > 0.92 ? 0.8 : 0, ny = v < 0.1 ? -0.9 : v > 0.9 ? 0.6 : 0;
      const seam = Math.abs(((ly - y + hh) % 7) - 6.5) < 0.6 && v > 0.1 && v < 0.9;
      const slat = Math.abs(u - 0.5) < 0.06;
      return lit(lx, ly, nx, ny, M.wood, seam ? 0.45 : slat ? 0.95 : 0.78)(X, Y);
    });
    return w;
  }
  if (r < 0.44 && room > 16) {
    // a lacquer chest, gold corner fittings and a hasp
    const w = 26 + Math.floor(hash(i, 5, seed) * 8), hh = Math.min(room - 3, 15 + Math.floor(hash(i, 6, seed) * 5));
    rect(c, x, y - hh, x + w, y, (X, Y, lx, ly) => {
      const u = (lx - x) / w, v = (ly - y + hh) / hh;
      const corner = (u < 0.14 || u > 0.86) && (v < 0.24 || v > 0.76);
      const hasp = Math.abs(u - 0.5) < 0.07 && v > 0.18 && v < 0.5;
      const lid = Math.abs(v - 0.28) < 0.06;
      const nx = u < 0.06 ? -0.8 : u > 0.94 ? 0.8 : 0, ny = v < 0.1 ? -0.9 : 0;
      if (corner || hasp) return lit(lx, ly, nx, ny, M.gold, 0.9, 0.2)(X, Y);
      return lit(lx, ly, nx, lid ? 0.8 : ny, M.verm, lid ? 0.5 : 0.62, 0.3)(X, Y);
    });
    return w;
  }
  if (r < 0.62 && room > 12) {
    // rolled scrolls stacked end-on: paper rings round dark rods
    const rr = 4.5, n = room > 22 ? 3 : 2;
    const rows: [number, number][] = n === 3 ? [[0, 0], [2, 0], [1, 1]] : [[0, 0], [1, 0]];
    for (const [cxk, cyk] of rows) {
      const cx = x + rr + cxk * rr * 2, cy = y - rr - cyk * rr * 1.75;
      rect(c, cx - rr, cy - rr, cx + rr, cy + rr, (X, Y, lx, ly) => {
        const d = Math.hypot(lx - cx, ly - cy) / rr;
        if (d > 1) return 0;
        if (d < 0.32) return tn(M.lacq, 0.85, X, Y, 0);
        return lit(lx, ly, (lx - cx) / rr * 0.8, (ly - cy) / rr * 0.8, M.paper, d > 0.8 ? 0.85 : 1.1, 0.2)(X, Y);
      });
    }
    return rr * (n === 3 ? 6 : 4) + 1;
  }
  if (r < 0.78 && room > 14) {
    // a glazed jar with a cloth cap tied on
    const hh = Math.min(room - 2, 15 + Math.floor(hash(i, 7, seed) * 6)), rw = 6 + hash(i, 8, seed) * 2;
    const glaze = hash(i, 9, seed) < 0.5 ? P.jade : P.blue;
    lathe(c, x + rw + 1, y - hh, y, (ly) => {
      const t = (ly - y + hh) / hh;
      return t < 0.18 ? rw * 0.62 : rw * (0.65 + 0.35 * Math.sin(Math.min(1, (t - 0.18) / 0.62) * Math.PI * 0.75 + 0.5));
    }, (X, Y, u, lx, ly) => {
      const t = (ly - y + hh) / hh;
      const l = lf.get(lx, ly);
      if (t < 0.18) return mt(M.paper, cyl(0.4 + l.k * 0.6, u, 1) * 0.85, X, Y, 0.15, 1);
      return mt(glaze, cyl(0.4 + l.k * 0.6, u, clamp(l.dx * 1.6, -1, 1), 0.15) * 0.95, X, Y, 0.25, 1);
    });
    return rw * 2 + 3;
  }
  // a bundle of books tied with cord, flat
  const w = 20 + Math.floor(hash(i, 10, seed) * 6);
  let yy = y;
  const spines: Ramp[] = [M.verm, P.blue, P.moss, M.paper, P.jade];
  for (let k = 0; k < 4 && y - yy < room - 6; k++) {
    const th = 4 + Math.floor(hash(i, 11 + k, seed) * 2), off = Math.floor((hash(i, 15 + k, seed) - 0.5) * 4);
    const ramp = spines[Math.floor(hash(i, 20 + k, seed) * spines.length)]!;
    const y0 = yy - th;
    rect(c, x + off, y0, x + off + w, yy, (X, Y, lx, ly) => {
      const cordX = Math.abs(lx - x - w * 0.4) < 1;
      if (cordX) return tn(M.wood, 0.35, X, Y, 0);
      return lit(lx, ly, 0, ly < y0 + 1.2 ? -0.8 : 0, ramp, ly > yy - 1.2 ? 0.5 : 0.8, 0.2)(X, Y);
    });
    yy = y0;
  }
  return w + 3;
}

export const stair = definePainter<StairP>("hall.stair", {
  bounds(p) {
    const g = stairGeo(p.pts);
    if (p.rail) return [-0.35 * H, -NEWEL - 30, g.foot[0] + 0.45 * H, p.floor + 4];
    return [Math.min(-0.3 * H, p.wall0 - 4), -NEWEL - 30, g.foot[0] + 0.5 * H, p.floor + 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10);
    const g = stairGeo(p.pts);
    const F = p.floor;
    const [fx, fy] = g.foot;
    const headNewel = -0.03 * H;
    const footNewel = fx + 0.2 * H;
    // the landings' posts: at each landing's two ends, set in a little so the flights' stringers butt into them
    const landingPosts: number[] = [];
    for (const [a, b] of g.landings) landingPosts.push(a + POST + 1, b - POST - 1);

    if (p.rail) {
      paintRail(c, lf, g, [headNewel, ...landingPosts, footNewel]);
      return;
    }

    // --- the wall closing the space under the stair: boards and rails, its value stepping down in bands as it
    // rises away from the nook's lamp (warm low, darkest high up); a soft dark band hugs the stair's underside
    const wx0 = p.wall0, wx1 = fx;
    const BANDS = [0.92, 2.4, 3.9];
    const bandBase = [0.6, 0.46, 0.31, 0.17];
    // the lamp's reach thins out going up: the high bands take less of its light, so the steps read
    const bandGain = [0.75, 0.7, 0.5, 0.35];
    rect(c, wx0, g.under(wx0) - 2, wx1, F, (X, Y, lx, ly) => {
      const u = g.under(lx);
      if (ly < u - 2) return 0;
      const l = lf.get(lx, ly);
      const fromFloor = (F - ly) / H;
      const band = fromFloor < BANDS[0]! ? 0 : fromFloor < BANDS[1]! ? 1 : fromFloor < BANDS[2]! ? 2 : 3;
      const base = bandBase[band]!;
      const ao = ly - u < 8 ? 0.16 : ly - u < 15 ? 0.07 : 0;
      // the rails between the bands: a lit top, a dark underside
      for (const rh of BANDS) {
        const d = (F - rh * H) - ly;
        if (d > -5 && d <= 0) return mt(M.wood, V(l, d > -1.3 ? base + 0.3 : base + 0.08, 0, d > -1.3 ? -0.9 : 0.4) - ao, X, Y, 0.15, 1);
        if (d > 0 && d < 2.5) return mt(M.lacq, V(l, base * 0.5) - ao, X, Y, 0.1, 1);
      }
      if (fromFloor < 0.16) return mt(M.lacq, V(l, fromFloor < 0.14 && fromFloor > 0.12 ? 0.55 : 0.4), X, Y, 0.0, 1);
      const bw = 0.24 * H;
      const k = ((lx - wx0) % bw + bw) % bw;
      const joint = k < 1.2;
      const lit = k > bw - 1.5 ? 0.05 : 0;
      const knot = vnoise(lx * 0.25, ly * 0.08, 29) > 0.83 ? 0.06 : 0;
      return mt(M.wood, V(l, joint ? base - 0.16 : base + lit, 0, 0, bandGain[band]) + grain(lx, ly, 27) * 0.06 - knot - ao, X, Y, 0.3, 1);
    });

    // --- the posts and braces carrying the upper flight (the bay's own post stands just west of wall0)
    for (const [i, px] of p.posts.entries()) {
      const top = g.under(px);
      const kb = 0.42 * H;
      brace(c, lf, px - POST, top + kb, px - POST - kb * 0.9, g.under(px - POST - kb * 0.9) - 1, 7);
      brace(c, lf, px + POST, top + kb, px + POST + kb * 0.9, g.under(px + POST + kb * 0.9) - 1, 7);
      post(c, lf, px, top - 2, F, "block", true, 41 + i);
    }

    // --- stepped shelves over the docs shelf: boards on brackets that step up under the flight, each loaded
    if (p.shelf) {
      const [s0, s1, sh] = p.shelf;
      // a side board at the west end, from the docs shelf's top up to the stringer
      rect(c, s0 - 3, g.under(s0) - 1, s0 + 3, F - sh, (X, Y, lx, ly) => (ly < g.under(lx) - 1 ? 0 : mt(M.wood, V(lf.get(lx, ly), lx < s0 - 1 ? 0.62 : 0.4, lx < s0 ? -0.8 : 0.5, 0), X, Y, 0.2, 1)));
      let k = 0;
      for (let y = F - sh - 0.2 * H; ; y -= 0.66 * H, k++) {
        // the board runs east until the stringer comes down to within 0.42 H of it
        let x1 = s0 + 3;
        while (x1 < s1 && g.under(x1) < y - 0.42 * H) x1 += 1;
        if (x1 - s0 < 0.35 * H) break;
        const room = (x: number): number => Math.min(y - g.under(x) - 4, 0.66 * H - 7);
        // brackets under the board
        for (const bx of [s0 + 10, (s0 + x1) / 2 + 6]) {
          if (bx > x1 - 8) continue;
          poly(c, [bx - 2, y + 4, bx + 2, y + 4, bx + 2, y + 13, bx - 2, y + 7], (X, Y, lx, ly) => mt(M.wood, V(lf.get(lx, ly), 0.4, 0.3, 0.5), X, Y, 0.25, 1));
        }
        // what stands on it, packed from the west end, the tallest where there is room
        let x = s0 + 5, i = 0;
        while (x < x1 - 10) {
          const rm = Math.min(room(x), room(Math.min(x1, x + 30)));
          if (rm < 10) break;
          const w = stored(c, lf, x, y, rm, i + k * 17, 300 + k);
          x += w + 2 + Math.floor(hash(i, k, 223) * 3);
          i++;
        }
        // the board: a lit front edge (the lamp is below it: its underside catches the light too)
        rect(c, s0 + 3, y, x1, y + 4, (X, Y, lx, ly) => {
          const l = lf.get(lx, ly);
          const v = ly - y;
          return mt(M.wood, V(l, v < 1 ? 0.78 : v > 3 ? 0.5 : 0.52, 0, v < 1 ? -0.9 : v > 3 ? 0.9 : 0), X, Y, 0.15, 1);
        });
        if (k > 5) break;
      }
    }

    // --- under the lower flight: a cupboard with a sloped top (its doors, brass pulls), then crates and jars
    if (p.cupboard) {
      const [c0, c1] = p.cupboard;
      const topAt = (x: number): number => g.under(x) + 5;
      const mid = (c0 + c1) / 2;
      rect(c, c0, topAt(c0), c1, F, (X, Y, lx, ly) => {
        const t = topAt(lx);
        if (ly < t) return 0;
        const l = lf.get(lx, ly);
        const u = (lx - c0) / (c1 - c0);
        if (ly < t + 2) return mt(M.wood, V(l, 0.8, 0, -0.9), X, Y, 0.1, 1);
        const stile = u < 0.05 || u > 0.95 || Math.abs(lx - mid) < 2.5;
        const rail = ly < t + 6 || F - ly < 0.14 * H;
        if (stile || rail) {
          const nx = u < 0.025 ? -0.8 : u > 0.975 ? 0.8 : 0;
          return mt(M.lacq, V(l, F - ly < 2 ? 0.25 : 0.5, nx, 0) + grain(lx, ly, 61) * 0.05, X, Y, 0.0, 1);
        }
        // the doors: a raised panel each in a gold-lined border, a brass ring pull either side of the middle
        const d0 = u < 0.5 ? c0 + (c1 - c0) * 0.05 : mid + 2.5, d1 = u < 0.5 ? mid - 2.5 : c1 - (c1 - c0) * 0.05;
        const du = (lx - d0) / (d1 - d0);
        const top = t + 6, bot = F - 0.14 * H;
        const dv = (ly - top) / Math.max(1, bot - top);
        const pull = Math.hypot(lx - mid + (u < 0.5 ? 7 : -7), ly - (F - 0.62 * H));
        if (pull < 3.4 && pull > 1.7) return mt(M.gold, V(l, 0.78, (lx - mid) / 20, 0), X, Y, 0.05, 1);
        const inset = du > 0.13 && du < 0.87 && ly > top + 7 && dv < 0.9;
        if (inset) {
          const edge = du < 0.16 || du > 0.84 || ly < top + 9 || dv > 0.87;
          return edge ? mt(M.gold, V(l, 0.42, du < 0.5 ? -0.5 : 0.5, 0), X, Y, 0.35, 1) : mt(M.verm, V(l, 0.5) + grain(lx, ly, 63) * 0.05, X, Y, 0.5, 1);
        }
        return mt(M.verm, V(l, 0.35, 0, 0), X, Y, 0.5, 1);
      });
    }
    if (p.crates) {
      const [k0, k1] = p.crates;
      let x = k0, i = 0;
      while (x < k1 - 12) {
        const room = Math.min(F - g.under(x + 26), F - 3 - g.under(x)) - 6;
        if (room < 12) break;
        const w = stored(c, lf, x, F, Math.min(room, 0.62 * H), i, 457);
        x += w + 3;
        i++;
      }
    }

    // --- the curtain across the nook's head, hung from the landing beam between its posts: indigo with a cream
    // crest (an open book: the docs) split by the slit
    for (const [a, b, ly0] of g.landings) {
      const x0 = a + 2 * POST + 2, x1 = b - 2 * POST - 2;
      const y0 = ly0 + g.hr + STR, y1 = y0 + 0.4 * H;
      const mid = (x0 + x1) / 2;
      rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const v = (ly - y0) / (y1 - y0);
        const slit = Math.abs(lx - mid) < 1.1;
        // the hem sways a little: each panel's lower edge a soft curve
        const half = lx < mid ? (lx - x0) / (mid - x0) : (lx - mid) / (x1 - mid);
        const hem = 1 - 0.08 * Math.sin(half * Math.PI);
        if (v > hem || slit) return 0;
        if (v < 0.09) return mt(M.wood, V(l, v < 0.04 ? 0.75 : 0.45, 0, v < 0.04 ? -0.9 : 0.5), X, Y, 0.2, 1);
        // the crest: a cream ring with an open book in it, across the slit
        const cy = y0 + (y1 - y0) * 0.52;
        const d = Math.hypot(lx - mid, ly - cy);
        if (d < 10.5 && d > 8.5) return mt(M.paper, V(l, 0.75), X, Y, 0.1, 1);
        if (d < 8.5) {
          const bx = Math.abs(lx - mid), by = ly - cy;
          const page = by > -4 + bx * 0.25 && by < 3 + bx * 0.15 && bx < 6.5;
          if (page) return mt(M.paper, V(l, bx < 1.4 ? 0.45 : 0.75), X, Y, 0.1, 1);
        }
        // folds: two soft vertical folds per panel; the hem a shade darker
        const fold = Math.sin((lx - x0) * 0.42) * 0.5 + 0.5;
        return mt(P.blue, V(l, 0.3 + fold * 0.14 - (v > hem - 0.08 ? 0.06 : 0), (fold - 0.5) * 0.8, 0), X, Y, 0.35, 1);
      });
    }

    // --- the landing beam: a lit nosing, the red lip, a carved fascia with one gold medallion, the dark soffit
    for (const [a, b, ly0] of g.landings) {
      const y1 = ly0 + g.hr + STR;
      rect(c, a, ly0 - 1, b, y1, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const v = ly - ly0;
        if (v < 1.5) return mt(M.wood, V(l, 0.95, 0, -1), X, Y, 0.0, 1);
        if (v < 4) return mt(M.wood, V(l, 0.66), X, Y, 0.1, 1);
        if (v < 8) return mt(M.verm, V(l, 0.5), X, Y, 0.2, 1);
        if (y1 - ly < 3) return mt(M.lacq, V(l, 0.2, 0, 0.8), X, Y, 0.1, 1);
        const cy = (ly0 + 8 + y1 - 3) / 2, cx = (a + b) / 2;
        const d = Math.hypot((lx - cx) * 0.8, ly - cy);
        if (d < 9) {
          const petal = Math.sin(Math.atan2(ly - cy, lx - cx) * 8) > 0.15;
          return mt(M.gold, V(l, d > 7 ? 0.72 : petal ? 0.6 : 0.4, (lx - cx) / 20, (ly - cy) / 20), X, Y, 0.15, 1);
        }
        if (Math.abs(ly - ly0 - 10) < 0.7 || Math.abs(ly - y1 + 5) < 0.7) return mt(M.gold, V(l, 0.55), X, Y, 0.2, 1);
        return mt(M.lacq, V(l, 0.6) + grain(lx, ly, 71, false) * 0.06, X, Y, 0.0, 1);
      });
    }

    // --- the flights: a deep lacquered stringer under a red lip, and on it the cut steps (tread ends lit along
    // their nosings, the risers' ends a shade darker, a nosing lip overhanging each riser)
    for (const [fi, f] of g.flights.entries()) {
      rect(c, f.x0, f.y0 - 2, f.x1, f.y1 + g.hr + STR + 2, (X, Y, lx, ly) => {
        if (ly >= F) return 0;
        const inn = g.inner(lx), tp = g.top(lx);
        const l = lf.get(lx, ly);
        const t = ly - inn;
        if (t >= 0 && t < STR) {
          // the stringer: the red lip under the steps, a gold bead, the lacquered face, a darker chamfer
          if (t < 1.2) return mt(M.lacq, V(l, 0.15), X, Y, 0.1, 1);
          if (t < 4.5) return mt(M.verm, V(l, t < 2.4 ? 0.62 : 0.5, 0, t < 2.4 ? -0.6 : 0), X, Y, 0.15, 1);
          if (Math.abs(t - 7) < 0.7) {
            const worn = fbm(lx * 0.05, fi * 3.1, 77, 2) > 0.66;
            return worn ? mt(M.lacq, V(l, 0.5), X, Y, 0.0, 1) : mt(M.gold, V(l, 0.66, 0, -0.3), X, Y, 0.15, 1);
          }
          if (t > STR - 3.5) return mt(M.lacq, V(l, t > STR - 1.3 ? 0.12 : 0.3, 0, 0.8), X, Y, 0.0, 1);
          const along = lx - (ly - f.y0) * (f.run / f.rise);
          // the lacquer's sheen catches the light in a long soft streak along the face
          const sheen = Math.abs(t - STR * 0.42) < 2.2 ? 0.06 : 0;
          return mt(M.lacq, V(l, 0.58) + sheen + grain(along * 0.35, t * 3, 21 + fi, false) * 0.05, X, Y, 0.0, 1);
        }
        if (ly < tp - 0.5 || ly >= inn) {
          // the nosing lip overhanging the riser just east of each step's edge
          const k = Math.round((lx - f.x0) / f.run);
          const edge = f.x0 + f.run * (k - 0.5);
          const kk = Math.round((lx - 2.5 - f.x0) / f.run);
          const lipY = f.y0 + f.rise * kk;
          if (lx > edge && lx < edge + 2.5 && kk >= 0 && ly >= lipY && ly < lipY + 2.5 && ly < inn) return mt(M.wood, V(l, 0.85, 0.4, -0.8), X, Y, 0.0, 1);
          return 0;
        }
        // the step's end: the tread board along the top, the riser board down its east edge, the cut string's tooth
        const k = Math.round((lx - f.x0) / f.run);
        const east = f.x0 + f.run * (k + 0.5);
        const v = ly - tp;
        if (v < 1.2) return mt(M.wood, V(l, 1.0, 0, -1), X, Y, 0.0, 1);
        if (v < 3.5) return mt(M.wood, V(l, 0.72), X, Y, 0.1, 1);
        if (v < 4.6) return mt(M.wood, V(l, 0.34), X, Y, 0.15, 1);
        if (east - lx < 2.5) return mt(M.wood, V(l, 0.36, 0.8, 0), X, Y, 0.15, 1);
        return mt(M.wood, V(l, 0.52) + grain(lx, ly * 2, 33 + k, false) * 0.05, X, Y, 0.15, 1);
      });
    }

    // --- the landing posts (they run on up through the landing as its newels), a short bracket under the beam
    // either side; a lantern on the east newel lights the landing and both flights
    for (const [i, px] of landingPosts.entries()) {
      const land = g.landings.find(([a, b]) => px >= a - 1 && px <= b + 1)!;
      const ly0 = land[2], yb = ly0 + g.hr + STR;
      post(c, lf, px, ly0 - NEWEL, F, "newel", true, 61 + i);
      for (const s of [-1, 1]) {
        const x0 = px + s * POST, x1 = px + s * (POST + 0.2 * H);
        poly(c, [x0, yb, x1, yb, x0, yb + 0.24 * H], (X, Y, lx, ly) => {
          const l = lf.get(lx, ly);
          const e = Math.abs(lx - x0) / Math.abs(x1 - x0) + (ly - yb) / (0.24 * H);
          return mt(M.wood, V(l, e > 0.86 ? 0.28 : ly - yb < 1.5 ? 0.6 : 0.45, 0, e > 0.86 ? 0.7 : 0), X, Y, 0.2, 1);
        });
      }
    }
    if (landingPosts.length > 1) {
      // a small stone lantern on the east newel's cap, its paper lit
      const lx0 = landingPosts[landingPosts.length - 1]!, ly0 = g.landings[g.landings.length - 1]![2] - NEWEL - 18;
      rect(c, lx0 - 7, ly0 - 20, lx0 + 7, ly0, (X, Y, lx, ly) => {
        const v = (ly - ly0 + 20) / 20, u = (lx - lx0) / 7;
        if (v < 0.2) return Math.abs(u) < 1 - (0.2 - v) * 2 ? mt(M.stone, V(lf.get(lx, ly), 0.5, u * 0.5, -0.8), X, Y, 0.2, 1) : 0;
        if (v > 0.85) return Math.abs(u) < 0.8 ? mt(M.stone, V(lf.get(lx, ly), 0.42), X, Y, 0.2, 1) : 0;
        if (Math.abs(u) > 0.78) return mt(M.lacq, 0.3, X, Y, 0.1, 1);
        if (Math.abs(u) < 0.1 || Math.abs(v - 0.52) < 0.05) return tn(M.wood, 0.6, X, Y, 0);
        return tn(SCREEN, clamp(0.05 + Math.hypot(u * 0.6, v - 0.55) * 0.7, 0, 1), X, Y, 0.5);
      });
    }

    // --- the head: a header block at the gallery's edge the upper flight hangs from, the head newel on it
    {
      const hx0 = headNewel - POST - 4, hx1 = headNewel + POST + 7, hy1 = 0.74 * H;
      rect(c, hx0, -1, hx1, hy1, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const u = (lx - hx0) / (hx1 - hx0);
        if (ly < 1.5) return mt(M.wood, V(l, 0.95, 0, -1), X, Y, 0.0, 1);
        if (ly < 6) return mt(M.gold, V(l, 0.62, (u - 0.5) * 1.2, 0), X, Y, 0.15, 1);
        if (hy1 - ly < 3) return mt(M.lacq, V(l, 0.2, 0, 0.8), X, Y, 0.1, 1);
        // the trimmer's end grain: growth rings in a dark square, a lit arris on the side facing the light
        const nx = u < 0.12 ? -0.8 : u > 0.88 ? 0.8 : 0;
        const ring = Math.sin(Math.hypot(lx - (hx0 + hx1) / 2, (ly - hy1 * 0.55) * 0.7) * 0.9) > 0.6;
        return mt(M.wood, V(l, ring ? 0.36 : 0.46, nx, 0), X, Y, 0.2, 1);
      });
      post(c, lf, headNewel, -NEWEL, 0, "newel", false, 81);
    }

    // --- the foot: the last tread is a stone step on the floor, the foot newel on a stone base beside it
    {
      const s0 = fx - (g.flights[g.flights.length - 1]?.run ?? 16) / 2, s1 = fx + 0.32 * H;
      rect(c, s0, fy - 1, s1, F, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const v = (ly - fy) / Math.max(1, F - fy);
        const ny = v < 0.2 ? -0.9 : 0;
        const nx = lx > s1 - 3 ? 0.8 : 0;
        const chip = fbm(lx * 0.3, ly * 0.3, 91, 2) > 0.7 ? 0.12 : 0;
        const worn = Math.abs(lx - (s0 + s1) / 2) < (s1 - s0) * 0.25 && v < 0.2 ? 0.08 : 0;
        return mt(M.stone, V(l, v < 0.2 ? 0.66 : 0.45, nx, ny) - chip + worn, X, Y, 0.25, 1);
      });
      post(c, lf, footNewel, fy - NEWEL, F, "newel", true, 93);
    }
  },
});

/** The handrail on turned balusters from the head newel down both flights and along each landing to the foot newel. */
function paintRail(c: PaintCtx, lf: LitField, g: StairGeo, newels: number[]): void {
  const x0 = newels[0]! + POST, x1 = newels[newels.length - 1]! - POST;
  const railY = (x: number): number => {
    // over a landing the rail runs level; over a flight it follows the nosings; it turns at the newels
    const land = g.landings.find(([a, b]) => x >= a && x <= b);
    return (land ? land[2] : g.walk(x)) - RAIL;
  };
  const onNewel = (x: number): boolean => newels.some((n) => Math.abs(x - n) < POST + 0.5);
  // balusters: one on every tread, one every 16 px along a landing
  const posts: number[] = [];
  for (const f of g.flights) for (let k = 1; k < f.n; k++) posts.push(f.x0 + f.run * k);
  for (const [a, b] of g.landings) for (let x = a + 2 * POST + 10; x < b - 2 * POST - 6; x += 16) posts.push(x);
  for (const bx of posts) {
    if (onNewel(bx) || bx < x0 || bx > x1) continue;
    const yTop = railY(bx) + 6, yBot = g.top(bx);
    lathe(c, bx, yTop, yBot, (ly) => {
      const t = (ly - yTop) / Math.max(1, yBot - yTop);
      return 1.5 + (Math.abs(t - 0.62) < 0.08 ? 1.2 : 0) + (t > 0.9 ? 0.8 : 0);
    }, (X, Y, u, lx, ly) => mt(M.verm, cyl(0.35 + lf.get(lx, ly).k * 0.8, u, clamp(lf.get(lx, ly).dx * 1.6, -1, 1)) * 0.8, X, Y, 0.2, 1));
  }
  // the rail itself: a rounded red lacquer bar, a lit top, its underside dark
  rect(c, x0, Math.min(railY(x0), railY(x1)) - 2, x1, Math.max(railY(x0), railY(x1)) + 8, (X, Y, lx, ly) => {
    const ry = railY(lx);
    const v = ly - ry;
    if (v < 0 || v >= 6.5 || onNewel(lx)) return 0;
    const l: Lit = lf.get(lx, ly);
    if (v < 1.3) return mt(M.verm, V(l, 0.85, 0, -0.9), X, Y, 0.0, 1);
    if (v > 5) return mt(M.verm, V(l, 0.3, 0, 0.9), X, Y, 0.2, 1);
    return mt(M.verm, V(l, 0.6), X, Y, 0.1, 1);
  });
}

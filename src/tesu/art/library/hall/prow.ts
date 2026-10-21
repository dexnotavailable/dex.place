// The Prize Court's edges: the Prow Stair's last run up through the rock and the court's
// foundation to its mouth (with the grate across the mouth), and at the tip the Prow Leap with
// its prayer flags in the wind. Daylight from the upper left.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { lut, tint } from "./tint.ts";
import { P } from "../../palette.ts";
import { M, clamp, cyl, face, fbm, grain, hash, lathe, mt, rect, tn, vnoise, type Ramp } from "./kit.ts";

const H = 96;
const SIDE = -1;

// ---------------------------------------------------------------------------
// The stair's last run (play): a recess cut along the stair, lined in ashlar where it passes the
// masonry, rough rock below; treads with lit noses; lanterns from its ceiling; the grate across
// the mouth with the stair's light showing between its slats
// ---------------------------------------------------------------------------
export interface StairRunP {
  /** The stair's line (local px): from its lower end at the anchor up to the mouth (x1, y1). */
  x1: number;
  y1: number;
  /** The recess's height above the treads (px); where the foundation's masonry starts (local y,
   *  the floor line) and how deep it runs (px). */
  head: number;
  masonry: number;
  found: number;
  /** The grate across the mouth: local x range. */
  grate: [number, number];
}

export const stairRun = definePainter<StairRunP>("court.stairrun", {
  bounds(p) {
    return [-4, p.y1 - p.head - 10, Math.max(p.x1, p.grate[1]) + 6, 16];
  },
  paint(c, p) {
    const slope = p.y1 / p.x1;
    const yAt = (lx: number): number => lx * slope;
    // (round 3, W1-9: the run's lit nose line and the band under it were two ruled diagonals across the foundation)
    // the treads as steps: each a level tread with a lit nose and a riser, so its edge is a stair, never a line
    const RUN = 15;
    const stepTop = (lx: number): number => yAt((Math.floor(lx / RUN) + 0.5) * RUN);
    // the foundation's masonry runs from the floor line (local y = masonry) down `found` px
    const m0 = p.masonry, m1 = p.masonry + p.found;
    const PIER = 0.24 * H;
    // (round 1, L15: no ruled arcade) the bays: uneven, a landing block a third of the way down where the
    // arcade stops for a solid stretch with a small window, the piers thicker low down where they carry more
    const bays: [number, number, boolean][] = []; // [x0, x1, solid landing block]
    const landAt = ((m0 + m1) / 2) / slope; // the middle of the run's stretch through the masonry
    for (let x = 0, i = 0; x < p.x1; i++) {
      const landing = x <= landAt && x + 1.2 * H > landAt;
      const w = landing ? 1.5 * H : (0.85 + 0.6 * ((Math.sin(i * 2.3 + 0.7) + 1) / 2)) * H;
      bays.push([x, x + w, landing]);
      x += w;
    }
    const bayAt = (lx: number): [number, number, boolean] => bays.find((b) => lx >= b[0] && lx < b[1]) ?? bays[bays.length - 1]!;
    rect(c, 0, p.y1 - p.head - 4, p.x1, 14, (X, Y, lx, ly) => {
      if (ly < m0 + 1) return 0; // nothing above the floor line: the mouth opens there
      const ty = stepTop(lx), line = yAt(lx);
      // in the rock the cut's head is rough-hewn, never a ruled line
      const rough = ty - p.head > m1 ? (fbm(lx * 0.03, 3.1, 17, 3) - 0.5) * 0.5 * H + Math.abs(Math.sin(lx * 0.045)) * 0.12 * H : 0;
      const top = line - p.head + rough;
      // the steps' stone runs on down into the rock or the masonry in a broken edge (no second ruled line)
      const foot = ty + 10 + (fbm(lx * 0.08, 7.3, 19, 2) - 0.3) * 10;
      if (ly < top - 3 || ly > foot + (rough > 0 ? rough * 0.4 : 0)) return 0;
      const inMasonry = ly < m1;
      // in the masonry the gallery's outer face is an arcade stepping down with the stair:
      // piers between arched openings, so the cut reads as built, not hacked through
      if (inMasonry && ly <= ty) {
        const [b0, b1, solid] = bayAt(lx);
        const k = lx - b0, BAY = b1 - b0;
        const pw = PIER * (1 + (ly - m0) / Math.max(1, p.found) * 0.5);
        if (solid) {
          // the landing's solid stretch: coursed stone, a small barred window lit from inside
          const wx = (b0 + b1) / 2, wy = top + p.head * 0.45;
          if (Math.abs(lx - wx) < 0.16 * H && Math.abs(ly - wy) < 0.2 * H) return Math.abs(((lx - wx + 100) % 6) - 3) < 1 ? mt(M.stone, 0.3, X, Y, 0.4, 1) : tn(M.glow, 0.45, X, Y, 0.4);
          const course = Math.floor((ly - m0) / 16);
          const joint = ((((ly - m0) % 16) + 16) % 16) < 1.2 || ((((lx + (course % 2) * 22) % 44) + 44) % 44) < 1.2;
          return mt(M.stone, face(0.95, SIDE, k < 2 ? -0.7 : BAY - k < 2 ? 0.7 : 0, 0) * (joint ? 0.7 : 0.92), X, Y, 0.1, 1);
        }
        const pier = k < pw;
        const arch = Math.max(0, (ly - top) / (0.22 * H));
        const shoulder = !pier && arch < 1 && Math.hypot((k - pw - (BAY - pw) / 2) / ((BAY - pw) / 2), 1 - arch) > 1;
        if (pier || shoulder || ly < top + 2) {
          const edge = pier && (k < 2 || k > pw - 2);
          return mt(M.stone, face(0.95, SIDE, edge ? (k < 2 ? -0.7 : 0.7) : 0, 0) * (edge ? 0.85 : 0.95), X, Y, 0.1, 1);
        }
      }
      if (ly < top) return mt(M.stone, face(0.95, SIDE, 0, -0.8) * 0.85, X, Y, 0.1, 1);
      if (ly > ty) {
        const k = ((lx % RUN) + RUN) % RUN;
        // the tread's lit nose along its top, the riser at its east end a step darker, wear on the tread's middle
        const nose = ly - ty < 2.2;
        const riser = k > RUN - 2.2;
        const worn = nose && k > 4 && k < 10 && fbm(lx * 0.4, 1.7, 23, 1) > 0.6 ? -0.12 : 0;
        return mt(M.stone, nose ? 0.95 + worn : riser ? 0.42 : 0.55 - (ly - ty) * 0.025 + (fbm(lx * 0.2, ly * 0.2, 29, 2) - 0.5) * 0.12, X, Y, 0.1, 1);
      }
      // inside: the back wall lit warm by the lanterns, darker toward the top
      const v = (ly - top) / p.head;
      const glow = 0.18 + 0.45 * v;
      if (inMasonry) {
        const course = Math.floor((ly - m0) / 18);
        const joint = ((((ly - m0) % 18) + 18) % 18) < 1.2 || ((((lx + (course % 2) * 26) % 52) + 52) % 52) < 1.2;
        return mt(M.stone, glow * (joint ? 0.45 : 0.62), X, Y, 0.45, 1);
      }
      const n = fbm(lx * 0.06, ly * 0.06, 13, 3);
      return mt(M.stone, glow * (0.55 + (n - 0.5) * 0.4), X, Y, 0.5, 1);
    });
    for (let lx = 70 + 0.57 * H; lx < p.x1 - 40; lx += 2 * 1.15 * H) {
      const cy = yAt(lx) - p.head + 4;
      if (cy < p.masonry + 2) continue;
      rect(c, lx - 0.5, cy, lx + 0.5, cy + 14, (X, Y) => tn(M.dark, 0.6, X, Y, 0));
      rect(c, lx - 7, cy + 14, lx + 7, cy + 32, (X, Y, x, y) => {
        const q = Math.hypot((x - lx) / 7, (y - cy - 23) / 9);
        return q > 1 ? 0 : tn(M.glow, clamp(q * 0.6, 0, 1), X, Y, 0.5);
      });
    }
    const [g0, g1] = p.grate;
    rect(c, g0, p.y1 - 2, g1, p.y1 + 9, (X, Y, lx, ly) => {
      const k = (((lx - g0) % 12) + 12) % 12;
      const strap = Math.abs(lx - g0 - (g1 - g0) * 0.25) < 1.5 || Math.abs(lx - g0 - (g1 - g0) * 0.75) < 1.5;
      if (strap) return tn(M.dark, 0.5, X, Y, 0);
      if (k < 2) return ly > p.y1 + 1 ? tn(M.glow, 0.45, X, Y, 0) : 0;
      return mt(M.wood, face(0.92, SIDE, 0, ly < p.y1 ? -0.8 : 0.3) * 0.9 + grain(lx, ly, 3, false) * 0.08, X, Y, 0.1, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// (round 3, W1-9) What stands in front of the Prow Stair's run (front plane: she passes behind them), so its long
// diagonal never runs more than ~3 H unbroken: a masonry buttress where the run climbs through the foundation and a
// rock outcrop where it is cut through the cliff. The anchor is the thing's top centre; it runs down `h` px (out of the
// frame for the outcrop).
// (round 4, W1-g: "a brick pillar on a pale sloped plinth" and "a straight-sided column with a pine on top", both
// primitives) The pier is now a buttress of the foundation's own masonry: the same stone, the same course heights on
// the same lines as the wall behind it (court-found.ts), long and short blocks by turns, rising from under the frieze
// with a weathering at its head and two set-offs stepping it out as it goes down, its foot swallowed by the rock's
// chunks (no plinth). The outcrop is a stack of Dex's terrain chunks (his sketch in the Kagami loop's dex-feedback):
// blocky, hand-wobbly blocks of the cliff's karst, overlapping, each a flat top with moss on that ledge only, a lit
// west edge, a face darkening downward, a dark east edge; the ones in front shade the ones behind; an irregular
// skyline; the lowest run out of the frame into the rock below.
// ---------------------------------------------------------------------------
export interface ButtressP {
  kind: "pier" | "outcrop";
  w: number;
  h: number;
  seed: number;
  /** (pier) its anchor's depth below the court's floor (px), so its courses lie on the foundation's lines. */
  dy?: number;
}

/** A chunk: x0, x1 (px from the centre), top, bottom (px down from the anchor). */
type Chunk = [number, number, number, number];

/**
 * Paints a stack of terrain chunks, Dex's construction: flat moss-capped tops, wobbly sides. Listed back to front: the
 * upper tiers first, the lower ones after (they stand out in front and overlap the feet of the ones above). `dark`
 * lifts the whole stack toward the ramp's dark end (a near layer carries the darkest darks).
 */
function chunkStack(c: PaintCtx, chunks: Chunk[], seed: number, ramp: Ramp, dark = 0): void {
  // each chunk's wobbly edges: its sides lean and wander a pixel or two, its top tilts a little
  const L = (k: number, y: number): number => chunks[k]![0] + (vnoise(y * 0.08, k, seed) - 0.5) * 4 + (hash(k, 1, seed) - 0.5) * 3;
  const R = (k: number, y: number): number => chunks[k]![1] + (vnoise(y * 0.08, k + 40, seed) - 0.5) * 4;
  const T = (k: number, x: number): number => chunks[k]![2] + (x - chunks[k]![0]) * (hash(k, 2, seed) - 0.5) * 0.06 + (vnoise(x * 0.1, k + 80, seed) - 0.5) * 2;
  const B = (k: number, x: number): number => chunks[k]![3] + (vnoise(x * 0.12, k + 120, seed) - 0.5) * 4;
  const inside = (k: number, x: number, y: number): boolean => y >= T(k, x) && y <= B(k, x) && x >= L(k, y) && x <= R(k, y);
  const x0 = Math.min(...chunks.map((k) => k[0])) - 4, x1 = Math.max(...chunks.map((k) => k[1])) + 4;
  const y0 = Math.min(...chunks.map((k) => k[2])) - 4, y1 = Math.max(...chunks.map((k) => k[3])) + 4;
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    let k = -1;
    for (let i = chunks.length - 1; i >= 0; i--) if (inside(i, lx, ly)) { k = i; break; }
    if (k < 0) return 0;
    const l = L(k, ly), r = R(k, ly), t = T(k, lx), b = B(k, lx);
    const u = (lx - l) / Math.max(1, r - l), d = ly - t, depth = (ly - t) / Math.max(1, b - t);
    // the outline: where this chunk meets air or a chunk behind it
    if (lx - l < 1 || r - lx < 1 || b - ly < 1) return tn(ramp, 1, X, Y, 0);
    // the moss: on the top ledge only, a few px thick, a drip or two down the face
    const drip = hash(Math.floor(lx / 3), k, seed + 3) > 0.84 ? 2 + 4 * hash(Math.floor(lx / 3), k, seed + 4) : 0;
    if (d < 2.5 + drip && fbm(lx * 0.4, k, seed + 5, 2) > 0.22) return tn(P.moss, d < 1.2 ? 0.25 : 0.5 + (drip ? 0.15 : 0), X, Y, 0.3);
    // the crevice: where a chunk in front stands against this one, the face just above its top ledge is in shade
    let shade = 0;
    for (let j = k + 1; j < chunks.length; j++) {
      const tj = T(j, lx);
      if (lx > L(j, ly) - 2 && lx < R(j, ly) + 4 && tj - ly > 0 && tj - ly < 7) { shade = 0.24 * (1 - (tj - ly) / 7) + 0.08; break; }
    }
    // the face: lit west strip, a mid body darkening downward, the east strip in shadow; a crack or two, a bedding line
    const crack = Math.abs(lx - (l + (r - l) * (0.3 + 0.4 * hash(k, 5, seed))) - (fbm(ly * 0.1, k, seed + 7, 2) - 0.5) * 6) < 0.7 && d > 6;
    const bed = Math.abs(d - (b - t) * (0.45 + 0.2 * hash(k, 6, seed))) < 0.6 && fbm(lx * 0.12, k, seed + 9, 2) > 0.45;
    let v = d < 4 ? 0.18 : u < 0.12 ? 0.3 : u > 0.86 ? 0.7 : 0.45 + depth * 0.18 + (fbm(lx * 0.07, ly * 0.07, seed + 11, 2) - 0.5) * 0.12;
    if (crack || bed) v += 0.18;
    return tn(ramp, clamp(v + shade + dark, 0, 0.94), X, Y, 0.35);
  });
}

export const buttress = definePainter<ButtressP>("court.buttress", {
  bounds(p) {
    return [-p.w / 2 - 0.4 * H, -0.9 * H, p.w / 2 + 0.4 * H, p.h + 8];
  },
  paint(c, p) {
    const W = p.w / 2;
    if (p.kind === "pier") {
      const dy = p.dy ?? Math.round(0.14 * H);
      // the foundation's courses (court-found.ts paintFoundation: under the coping and the frieze, rows of these
      // heights), so each of the buttress's courses lies on a line of the wall behind it
      const F1 = 14 + 0.62 * H;
      const HEIGHTS = [0.2, 0.42, 0.24, 0.17, 0.36, 0.28, 0.46, 0.2];
      const rows: [number, number][] = [];
      for (let y = F1, k = 0; y < p.h + dy + H; k++) {
        const hh = Math.round((HEIGHTS[k % HEIGHTS.length]! + 0.06 * hash(k, 1, 23)) * H);
        rows.push([y - dy, y + hh - dy]);
        y += hh;
      }
      const t0 = F1 - dy, len = p.h - t0;
      const steps = [t0, t0 + Math.round(len * 0.36), t0 + Math.round(len * 0.64)];
      const halfAt = (ly: number): number => (ly < steps[1]! ? W : ly < steps[2]! ? W + 0.09 * H : W + 0.17 * H);
      // its shadow on the wall east of it (the sun is up and to the left): the wall's own courses a step darker, the
      // shadow's head slanting down away from the buttress's weathering
      const SH = 0.2 * H;
      rect(c, W, t0 + 4, W + 0.17 * H + SH, p.h, (X, Y, lx, ly) => {
        const half = halfAt(ly);
        const e = lx - half;
        if (e < 0 || e > SH || ly < t0 + 6 + e * 0.8) return 0;
        let ri = 0;
        while (ri + 1 < rows.length && ly >= rows[ri]![1]) ri++;
        const joint = ly - rows[ri]![0] < 1.5;
        return mt(M.stone, (joint ? 0.3 : 0.55 + (hash(ri, 9, p.seed) - 0.5) * 0.1) - (e > SH - 3 ? -0.08 : 0), X, Y, 0.2, 1);
      });
      rect(c, -W - 0.2 * H, t0 - 1, W + 0.2 * H, p.h + 6, (X, Y, lx, ly) => {
        const half = halfAt(ly);
        if (Math.abs(lx) > half || ly > p.h || ly < t0) return 0;
        // the weathering at its head and on each set-off: a sloped top seen from the front, lit, its foot a drip line
        for (const sy of steps) {
          const e = ly - sy;
          if (e >= 0 && e < 7) {
            if (e > 5.5) return mt(M.stone, 0.35, X, Y, 0.2, 1);
            if (e < 1.5 && sy > t0 && fbm(lx * 0.3, sy, p.seed + 13, 2) > 0.5) return tn(P.moss, 0.35, X, Y, 0.3);
            return mt(M.stone, face(0.95, SIDE, lx < -half + 3 ? -0.6 : lx > half - 3 ? 0.6 : 0, -0.9) * (1.0 - e * 0.03), X, Y, 0.05, 1);
          }
        }
        // the courses: the foundation's rows; in each, a long and a short block by turns (the joint off the middle)
        let ri = 0;
        while (ri + 1 < rows.length && ly >= rows[ri]![1]) ri++;
        const [r0, r1] = rows[ri]!;
        const jx = (ri % 2 ? -0.3 : 0.38) * half;
        const inY = ly - r0;
        if (inY < 1.5 || Math.abs(lx - jx) < 0.8) return ly > p.h * 0.6 && fbm(lx * 0.2, ly * 0.2, p.seed + 3, 2) > 0.6 ? tn(P.moss, 0.6, X, Y, 0.3) : mt(M.stone, 0.4, X, Y, 0.2, 1);
        // its west arris catches the sun, its east arris turns away (it stands proud of the wall)
        if (lx < -half + 2) return mt(M.stone, 1.0, X, Y, 0.0, 1);
        if (lx > half - 2) return mt(M.stone, 0.42, X, Y, 0.2, 1);
        const nx = lx < -half + 4 ? -0.8 : lx > half - 5 ? 0.9 : 0;
        const tone = (hash(ri, lx < jx ? 0 : 1, p.seed + 15) - 0.5) * 0.3;
        const rough = (fbm(lx * 0.15, ly * 0.15, 43, 2) - 0.5) * 0.1;
        const chipped = fbm(lx * 0.3, ly * 0.3, p.seed + 17, 2) > 0.8 ? -0.14 : 0;
        const edge = inY < 3 ? 0.1 : r1 - ly < 3 ? -0.07 : 0;
        return mt(M.stone, face(0.95, SIDE, nx, 0) * 0.9 + tone + edge + rough + chipped, X, Y, 0.1, 1);
      });
      // its foot in the rock: three wide, low chunks of the cliff's karst, the one in front lowest
      const RW = W + 0.4 * H, q = (n: number): number => Math.round(n * H);
      chunkStack(c, [
        [-RW, q(0.05), p.h - q(0.62), p.h + 8],
        [q(-0.2), RW, p.h - q(0.5), p.h + 8],
        [-RW + q(0.25), RW - q(0.3), p.h - q(0.3), p.h + 8],
      ], p.seed + 21, P.karst, 0.1);
      return;
    }
    // the outcrop: Dex's chunks in tiers, wider than tall; the top tier first, each lower tier standing out in front of
    // the one above; the skyline steps 0 / 0.32 / 0.5 H; the base runs out of the frame
    const q = (n: number): number => Math.round(n * H * (p.w / (1.9 * H)));
    const chunks: Chunk[] = [
      [q(-0.35), q(0.3), q(0.0), q(0.58)],
      [q(-0.82), q(-0.24), q(0.32), q(0.84)],
      [q(0.2), q(0.78), q(0.5), q(0.98)],
      [q(-0.95), q(-0.06), q(0.74), q(1.32)],
      [q(-0.18), q(0.56), q(0.86), q(1.42)],
      [q(0.44), q(0.95), q(0.92), q(1.52)],
      [q(-0.9), q(0.12), q(1.26), q(1.98)],
      [q(0.0), q(0.9), q(1.36), q(2.06)],
      [q(-0.95), q(0.95), q(1.92), p.h + 8],
    ];
    chunkStack(c, chunks, p.seed, P.karst, 0.1);
    // a tuft of grass on two of the ledges (no tree: the chunks are the shape)
    for (const [k, fx] of [[0, 0.6], [4, 0.3]] as const) {
      const [a0, a1, top] = chunks[k]!;
      const cx = a0 + (a1 - a0) * fx;
      rect(c, cx - 6, top - 7, cx + 6, top + 1, (X, Y, lx, ly) => {
        const dx = lx - cx, h2 = 6 - Math.abs(dx) * 0.8 + (fbm(lx * 0.6, 3, p.seed + k, 2) - 0.5) * 4;
        if (top - ly > h2 || Math.abs(dx) > 6) return 0;
        return tn(P.moss, clamp(0.3 + ((ly - (top - h2)) / 8) * 0.4 + (dx > 0 ? 0.15 : 0), 0, 1), X, Y, 0.3);
      });
    }
  },
});

// ---------------------------------------------------------------------------
// The Prow Leap: a weathered plank out past the rail on two brackets braced to the foundation
// ---------------------------------------------------------------------------
export const leap = definePainter<{ w: number }>("court.leap", {
  bounds(p) {
    return [-0.6 * H, -6, p.w + 6, 0.9 * H];
  },
  paint(c, p) {
    rect(c, 0, -2, p.w, 8, (X, Y, lx, ly) => {
      const end = lx > p.w - 4;
      const k = ((lx % 58) + 58) % 58;
      return mt(M.wood, face(0.92, SIDE, end ? 0.8 : 0, ly < 0 ? -0.9 : 0.3) * (k < 1.2 ? 0.6 : 0.95) + grain(lx, ly, 9, false) * 0.12 - (lx / p.w) * 0.1, X, Y, 0.0, 1);
    });
    for (const bx of [p.w * 0.18, p.w * 0.46]) {
      for (let t = 0; t < 1; t += 0.02) {
        const x = bx - t * 0.45 * H, y = 8 + t * 0.7 * H;
        rect(c, x - 2.5, y - 2, x + 2.5, y + 2, (X, Y) => mt(M.wood, face(0.9, SIDE, -0.4, 0) * 0.7, X, Y, 0.2, 1));
      }
      rect(c, bx - 4, 7, bx + 4, 12, (X, Y) => tn(M.paper, 0.45, X, Y, 0.2));
    }
  },
});

/** Prayer flags on a line from a pole at the leap's root out over the drop (a sprite: 8 frames). */
export const flags = definePainter<{ w: number; h: number; n: number; frame?: number }>("court.flags", {
  bounds(p) {
    return [-6, -p.h - 8, p.w + 12, 4];
  },
  paint(c, p) {
    const f = (p.frame ?? 0) % 8;
    const ph = (f / 8) * Math.PI * 2;
    lathe(c, 0, -p.h, 0, () => 2.2, (X, Y, u) => mt(M.wood, cyl(0.92, u, SIDE, 0.2), X, Y, 0.1, 1));
    const y0 = -p.h + 4, y1 = -0.35 * H;
    const cols = [M.verm, P.blue, M.paper, P.moss, P.gold];
    const n = Math.ceil(p.w * c.d);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = t * p.w, y = y0 + (y1 - y0) * t + 10 * Math.sin(t * Math.PI);
      c.buf.set(Math.round(c.X(x)), Math.round(c.Y(y)), P.umber[3]!);
    }
    for (let k = 0; k < p.n; k++) {
      const t = (k + 0.6) / (p.n + 0.4);
      const x = t * p.w, y = y0 + (y1 - y0) * t + 10 * Math.sin(t * Math.PI);
      const ramp = cols[k % cols.length]!;
      rect(c, x - 4, y, x + 8, y + 14, (X, Y, lx, ly) => {
        const v = (ly - y) / 14;
        const wave = Math.sin(v * 4 - ph + k) * 2 * v;
        const u = lx - x - wave;
        if (u < -3 || u > 6 || v > 1 - Math.max(0, u) * 0.03) return 0;
        return mt(ramp, 0.85 - Math.cos(v * 4 - ph + k) * 0.12, X, Y, 0.1, 0.8);
      });
    }
  },
});

// ---------------------------------------------------------------------------
// The spectators' tiers (P3), under the stands sprite's paper spectators (tiers: false): stone
// steps rising behind the arena, a vermilion rail on each, lacquer posts carrying the lantern
// strings, the whole on a masonry base that runs down behind the floor. Geometry matches the
// stands painter (rows 34 px apart, inset 26 per row, first row 20 px up).
// ---------------------------------------------------------------------------
export interface TiersP {
  w: number;
  rows: number;
}

export const tiers = definePainter<TiersP>("court.tiers", {
  bounds(p) {
    return [-p.w / 2 - 10, -p.rows * 34 - 80, p.w / 2 + 10, 120];
  },
  paint(c, p) {
    const hw = p.w / 2;
    // the base below the first row: ashlar running down out of sight behind the arena
    rect(c, -hw, -20, hw, 120, (X, Y, lx, ly) => {
      const course = Math.floor((ly + 20) / 14);
      const joint = (((ly + 20) % 14) + 14) % 14 < 1 || ((((lx + (course % 2) * 20) % 40) + 40) % 40) < 1;
      // (round 4, W2-i: the stands' pale slabs, L 173-179, were the brightest big mass in both court frames) two steps
      // down: their risers in the stands' own shade, only the tread noses lit, so the ring is the lightest band at the
      // fighters' height
      return mt(M.stone, face(0.9, SIDE) * (joint ? 0.36 : 0.5) - (ly > 0 ? 0.1 : 0), X, Y, 0.25, 1);
    });
    for (let r = p.rows - 1; r >= 0; r--) {
      const top = -r * 34 - 20, inset = r * 26;
      const x0 = -hw + inset, x1 = hw - inset;
      // the step's riser and its lit tread nose
      rect(c, x0, top, x1, top + 34, (X, Y, lx, ly) => {
        if (ly < top + 3) return mt(M.stone, 0.82, X, Y, 0.1, 1);
        const k = (((lx - x0) % 46) + 46) % 46;
        return mt(M.stone, face(0.9, SIDE) * (k < 1 ? 0.36 : 0.52) - (ly - top) / 34 * 0.12, X, Y, 0.25, 1);
      });
      // the rail: vermilion, posts every 46 px
      rect(c, x0, top - 9, x1, top - 1, (X, Y, lx, ly) => {
        const k = (((lx - x0) % 46) + 46) % 46;
        if (k < 3) return mt(M.verm, face(0.9, SIDE, -0.5, 0) * 0.85, X, Y, 0.2, 1);
        return ly < top - 7 ? mt(M.verm, face(0.9, SIDE, 0, -0.8) * 0.95, X, Y, 0.2, 1) : 0;
      });
      // the steps' end walls: a carved stone cheek at each end of the row
      for (const sx of [x0, x1 - 10]) rect(c, sx, top - 4, sx + 10, top + 34, (X, Y, lx) => mt(M.stone, face(0.9, SIDE, lx - sx < 5 ? -0.6 : 0.6, 0) * 0.6, X, Y, 0.2, 1));
    }
    // lacquer posts carrying the lantern strings, and the strings themselves sagging between
    const ptop = -p.rows * 34 - 60;
    const posts = [-hw + 4, -hw / 3, hw / 3, hw - 4];
    for (const px of posts) lathe(c, px, ptop, -p.rows * 34 - 20 + 34, () => 2.2, (X, Y, u) => mt(M.lacqDay, cyl(0.92, u, SIDE, 0.2), X, Y, 0.0, 1));
    for (let i = 0; i + 1 < posts.length; i++) {
      const a = posts[i]!, b = posts[i + 1]!;
      const n = Math.ceil((b - a) * c.d);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = a + (b - a) * t, y = ptop + 4 + 14 * Math.sin(t * Math.PI);
        c.buf.set(Math.round(c.X(x)), Math.round(c.Y(y)), P.umber[3]!);
      }
      for (let k = 1; k < 7; k++) {
        const t = k / 7;
        const x = a + (b - a) * t, y = ptop + 4 + 14 * Math.sin(t * Math.PI);
        rect(c, x - 4, y + 2, x + 4, y + 12, (X, Y, lx, ly) => {
          const q = Math.hypot((lx - x) / 4, (ly - y - 7) / 5);
          return q > 1 ? 0 : mt(k % 3 === 0 ? M.paper : M.verm, face(0.95, SIDE, (lx - x) / 4, (ly - y - 7) / 5), X, Y, 0.1, 1);
        });
      }
    }
    // (round 3, W2-10: the stands took no haze step from the near court) the whole stands sit a step back in the air
    tint(c, -hw - 10, -p.rows * 34 - 80, hw + 10, 120, () => HAZE1);
  },
});
const HAZE1 = lut("haze", 1);

// The Prize Court's edges: the Prow Stair's last run up through the rock and the court's
// foundation to its mouth (with the grate across the mouth), and at the tip the Prow Leap with
// its prayer flags in the wind. Daylight from the upper left.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { M, clamp, cyl, face, fbm, grain, lathe, mt, rect, tn } from "./kit.ts";

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
      const ty = yAt(lx);
      // in the rock the cut's head is rough-hewn, never a ruled line
      const rough = ty - p.head > m1 ? (fbm(lx * 0.03, 3.1, 17, 3) - 0.5) * 0.5 * H + Math.abs(Math.sin(lx * 0.045)) * 0.12 * H : 0;
      const top = ty - p.head + rough;
      if (ly < top - 3 || ly > ty + 12 + (rough > 0 ? rough * 0.4 : 0)) return 0;
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
        const k = ((lx % 15) + 15) % 15;
        const nose = ly - ty < 2.5;
        return mt(M.stone, nose ? 0.95 : 0.55 - (k < 2 ? 0.1 : 0) - (ly - ty) * 0.02, X, Y, 0.1, 1);
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
      return mt(M.stone, face(0.9, SIDE) * (joint ? 0.55 : 0.75) - (ly > 0 ? 0.1 : 0), X, Y, 0.1, 1);
    });
    for (let r = p.rows - 1; r >= 0; r--) {
      const top = -r * 34 - 20, inset = r * 26;
      const x0 = -hw + inset, x1 = hw - inset;
      // the step's riser and its lit tread nose
      rect(c, x0, top, x1, top + 34, (X, Y, lx, ly) => {
        if (ly < top + 3) return mt(M.stone, 1.05, X, Y, 0.0, 1);
        const k = (((lx - x0) % 46) + 46) % 46;
        return mt(M.stone, face(0.9, SIDE) * (k < 1 ? 0.55 : 0.78) - (ly - top) / 34 * 0.12, X, Y, 0.1, 1);
      });
      // the rail: vermilion, posts every 46 px
      rect(c, x0, top - 9, x1, top - 1, (X, Y, lx, ly) => {
        const k = (((lx - x0) % 46) + 46) % 46;
        if (k < 3) return mt(M.verm, face(0.9, SIDE, -0.5, 0) * 0.85, X, Y, 0.2, 1);
        return ly < top - 7 ? mt(M.verm, face(0.9, SIDE, 0, -0.8) * 0.95, X, Y, 0.2, 1) : 0;
      });
      // the steps' end walls: a carved stone cheek at each end of the row
      for (const sx of [x0, x1 - 10]) rect(c, sx, top - 4, sx + 10, top + 34, (X, Y, lx) => mt(M.stone, face(0.9, SIDE, lx - sx < 5 ? -0.6 : 0.6, 0) * 0.85, X, Y, 0.1, 1));
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
  },
});

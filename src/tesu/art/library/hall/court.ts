// The Prize Court on the prow (GDK 5.1, A.3), in the morning: the paved arena with the great
// inked seal lying on it, its masonry foundation (a gold-figured frieze, pilasters, courses
// stepping down onto the karst), the gatehouse porch built against the hall's east wall, the
// Prize Board under its release banner, Bao's gong tower with the great bronze gong (a sprite
// that swings when struck), stone lantern pillars, the Prow Stair's mouth framed by newel
// posts, and at the tip a bench and a stone rail where the land falls away.
//
// Daylight from the upper left (COURT_LIGHT): lit faces up and left, shadows down and right.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { COURT_LIGHT } from "./lights.ts";
import { tileRoof } from "./furniture.ts";
import { M, LitField, bevel, clamp, colBase, cyl, face, fbm, grain, hash, keep, lathe, mt, poly, rect, tn, vnoise, type Ramp } from "./kit.ts";

const H = 96;
const SIDE = -1; // the sun is up and to the left

const lacq = M.lacqDay;
const day = (k = 0.92): number => k;

function woodBox(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, ramp: Ramp, seed: number, lo = 0.1, hi = 1, bev = 3, k = 0.92): void {
  const w = x1 - x0, h = y1 - y0;
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    const [nx, ny] = bevel((lx - x0) / w, (ly - y0) / h, bev / w, bev / h);
    return mt(ramp, face(k, SIDE, nx, ny) + grain(lx, ly, seed, h > w) * 0.08, X, Y, lo, hi);
  });
}

function fitting(c: PaintCtx, x: number, y: number, sx: number, sy: number, s = 7): void {
  rect(c, Math.min(x, x + sx * s), Math.min(y, y + sy * s), Math.max(x, x + sx * s), Math.max(y, y + sy * s), (X, Y, lx, ly) => {
    const dx = Math.abs(lx - x), dy = Math.abs(ly - y);
    if (dx > 2.4 && dy > 2.4) return 0;
    return mt(M.gold, face(day(), SIDE, sx * 0.3, -sy * 0.3) * 1.05, X, Y, 0.0, 1);
  });
}

// ---------------------------------------------------------------------------
// The arena's floor surface (P3): paving receding from the stands to the play line, the great
// seal lying on it (an ink ring, a square seal, its script left in the stone)
// ---------------------------------------------------------------------------
export interface CourtFloorP {
  w: number;
  /** Plane px per H; how far down it runs. */
  u: number;
  below: number;
  /** The seal's centre (local px) and its radius (px across). */
  seal: [number, number];
}

export const courtFloor = definePainter<CourtFloorP>("court.floor", {
  bounds(p) {
    return [0, -p.below, p.w, 2];
  },
  paint(c, p) {
    const U = p.u;
    const [scx, sr] = p.seal;
    rect(c, 0, -p.below, p.w, 0, (X, Y, lx, ly0) => {
      const ly = ly0 + p.below;
      // the far edge, where the stands begin: a low step of stone
      if (ly < 4) return mt(M.stone, face(0.95, SIDE, 0, ly < 1.5 ? -0.8 : 0.5) * 0.85, X, Y, 0.05, 1);
      const depth = ly / U; // 0 at the far edge .. growing toward us
      // flag rows widen as they come nearer; joints offset per row
      const row = Math.floor(Math.sqrt(Math.max(0, depth) * 10));
      const rowTop = (row * row) / 10;
      const fw = (1.1 + row * 0.35) * U;
      const off = (row % 2) * fw * 0.5;
      const joint = depth - rowTop < 0.035 + row * 0.006 || (((lx + off) % fw) + fw) % fw < 1;
      // the seal: an ellipse flattened by the angle we see the floor at
      const ey = (depth - 0.52) / 0.42, ex = (lx - scx) / sr;
      const e = Math.hypot(ex, ey);
      const wornInk = fbm(lx * 0.05, ly * 0.12, 3, 3) > 0.7;
      if (e > 0.9 && e < 1.0 && !wornInk) return tn(M.verm, e > 0.96 ? 0.6 : 0.5, X, Y, 0.3);
      if (e > 0.8 && e < 0.84 && !wornInk) return tn(M.verm, 0.58, X, Y, 0.3);
      if (Math.abs(ex) < 0.44 && Math.abs(ey) < 0.5) {
        if (Math.abs(ex) > 0.41 || Math.abs(ey) > 0.46) return tn(M.verm, 0.62, X, Y, 0.3);
        const strokes =
          (Math.abs(ex + 0.22) < 0.03 && Math.abs(ey) < 0.34) || (Math.abs(ex - 0.05) < 0.03 && ey > -0.34 && ey < 0.1) ||
          (Math.abs(ey + 0.12) < 0.07 && ex > -0.3 && ex < 0.14) || (Math.abs(ey - 0.22) < 0.07 && ex > -0.05 && ex < 0.32) ||
          (Math.abs(ex - 0.26) < 0.03 && Math.abs(ey) < 0.34);
        if (!strokes && !(wornInk && hash(X, Y, 2) > 0.6)) return tn(M.verm, 0.5, X, Y, 0.3);
      }
      const n = fbm(lx * 0.03, ly * 0.06, 9, 3);
      const lit = 0.78 - depth * 0.04 + (n - 0.5) * 0.18 - (joint ? 0.2 : 0);
      return mt(M.stone, lit, X, Y, 0.0, 1, 0.5);
    });
  },
});

// ---------------------------------------------------------------------------
// The foundation (play): the floor's coping (the walk line), a frieze of gold cartouches on
// grey stone, pilasters, courses stepping down; its foot follows the rock it is built on
// ---------------------------------------------------------------------------
export interface FoundationP {
  w: number;
  /** Depth of the masonry below the floor line (px) at each end and in the middle. */
  depth: number;
  /** The stairwell's mouth (local x range) where the coping breaks and the walls return. */
  well?: [number, number];
  /** Pilasters (local x). */
  pilasters: number[];
  /** (hall loop round 1) Where the frieze breaks for its one carved panel (local x; default 0.36 of w). */
  centre?: number;
}

/** A row of jittered joints: which block of a course a point lies in, and how far into it. */
function course(lx: number, bw: number, off: number, seed: number): { j: number; inX: number; w: number } {
  const jit = (j: number): number => (hash(j, 3, seed) - 0.5) * bw * 0.55;
  let j = Math.floor((lx - off) / bw);
  if (lx < off + j * bw + jit(j)) j--;
  else if (lx >= off + (j + 1) * bw + jit(j + 1)) j++;
  const a = off + j * bw + jit(j), b = off + (j + 1) * bw + jit(j + 1);
  return { j, inX: lx - a, w: b - a };
}

export const foundation = definePainter<FoundationP>("court.foundation", {
  bounds(p) {
    return [-6, -4, p.w + 6, p.depth + 0.8 * H];
  },
  paint(c, p) {
    const COPE = 14, FRIEZE = 0.62 * H, F1 = COPE + FRIEZE;
    const centre = p.centre ?? p.w * 0.36;
    // the foot: the masonry follows the rock it was built on, stepping down and up in chunks
    const foot = (lx: number): number => p.depth - 0.42 * H * vnoise(lx / (1.3 * H), 0, 17) - (Math.floor(lx / (0.9 * H)) % 3 === 0 ? 0.22 * H : 0) + 0.08 * H * (vnoise(lx / (0.3 * H), 4, 21) - 0.5);
    // the courses below the frieze: heights vary, the base course is the big weathered one
    const baseTop = p.depth - 0.78 * H;
    const rows: [number, number][] = [];
    for (let y = F1, k = 0; y < baseTop - 0.2 * H; k++) {
      const hh = Math.round(0.26 * H + 0.16 * H * hash(k, 1, 23));
      rows.push([y, Math.min(baseTop, y + hh)]);
      y += hh;
    }
    if (rows.length && rows[rows.length - 1]![1] < baseTop) rows.push([rows[rows.length - 1]![1], baseTop]);
    rows.push([baseTop, p.depth + 0.8 * H]);
    // moss clumps: hanging off the coping's nose and growing on the base course's ledge
    const clump = (lx: number, ledge: number, every: number, seed: number): number => {
      const k = Math.floor(lx / every);
      if (hash(k, 1, seed) < 0.45) return 0;
      const cx = (k + 0.2 + 0.6 * hash(k, 2, seed)) * every, rw = 7 + 16 * hash(k, 3, seed);
      const u = (lx - cx) / rw;
      if (Math.abs(u) > 1) return 0;
      return (1 - u * u) * (4 + 7 * hash(k, 4, seed)) * (0.7 + 0.6 * vnoise(lx * 0.3, ledge, seed));
    };
    rect(c, 0, -2, p.w, p.depth + 0.8 * H, (X, Y, lx, ly) => {
      if (p.well && lx > p.well[0] && lx < p.well[1] && ly < COPE + 2) return 0;
      const f = foot(lx);
      if (ly > f) {
        // where it meets the rock: rubble, soil and moss packed under the footing, ragged
        const under = ly - f;
        const pile = 5 + 14 * vnoise(lx * 0.06, 2, 19) + 6 * vnoise(lx * 0.25, 5, 29);
        if (under > pile) return 0;
        const stone = fbm(lx * 0.22, ly * 0.3, 41, 2);
        if (stone > 0.56) return mt(M.stone, (stone > 0.66 ? 0.62 : 0.4) - (under / pile) * 0.25 + (hash(X, Y, 4) > 0.8 ? 0.08 : 0), X, Y, 0.15, 1);
        if (stone < 0.4 && under < pile * 0.7) return tn(P.moss, 0.45 + (under / pile) * 0.4, X, Y, 0.25);
        return tn(P.earth, 0.62 + (under / pile) * 0.3, X, Y, 0.3);
      }
      // moss hanging off the coping's nose
      if (ly >= COPE - 2 && ly < COPE + 12) {
        const m = clump(lx, 1, 1.9 * H, 51);
        if (m > 0 && ly < COPE - 1 + m) {
          const t = (ly - COPE + 2) / (m + 1);
          if (t > 0.75 && hash(X, Y, 8) > 0.5) return 0;
          return tn(P.moss, 0.25 + t * 0.5, X, Y, 0.3);
        }
      }
      if (ly < COPE) {
        // the coping: a lit top, a rounded nose, worn smooth along the front, chipped here and there
        if (ly < 2) return mt(M.stone, 1.1, X, Y, 0.0, 1);
        const chip = fbm(lx * 0.12, 1, 61, 2) > 0.72 && ly > 9 ? -0.16 : 0;
        return mt(M.stone, face(0.95, SIDE, 0, ly < 6 ? -0.6 : 0.5) - (vnoise(lx * 0.2, 1, 3) > 0.7 ? 0.08 : 0) + chip, X, Y, 0.0, 1);
      }
      const pil = p.pilasters.some((x) => Math.abs(lx - x) < 0.32 * H);
      const pilEdge = p.pilasters.some((x) => Math.abs(Math.abs(lx - x) - 0.32 * H) < 2);
      // the light along the frieze is never even
      const along = 0.82 + 0.28 * vnoise(lx / (2.6 * H), 9, 77);
      if (ly < F1) {
        const v = (ly - COPE) / FRIEZE;
        // the coping overhang shades the frieze's top
        const overhang = ly < COPE + 3 + 2 * vnoise(lx * 0.1, 2, 5) ? -0.22 : 0;
        if (v < 0.08 || v > 0.92) return mt(M.stone, face(0.9, SIDE, 0, v < 0.08 ? -0.6 : 0.6) * 0.85 * along + overhang, X, Y, 0.1, 1);
        // the carved panel at the court's middle: rolling clouds in gold round a sunburst seal
        const pw = 1.55 * H;
        if (Math.abs(lx - centre) < pw) {
          const u = (lx - centre) / pw, vy = (v - 0.5) * FRIEZE;
          const e = Math.min(pw - Math.abs(lx - centre), FRIEZE * 0.42 - Math.abs(vy));
          if (e < 0) return mt(M.stone, 0.62 * along + overhang, X, Y, 0.1, 1);
          if (e < 2.5) return mt(M.gold, face(0.95, SIDE, u < 0 ? -0.6 : 0.6, vy < 0 ? -0.6 : 0.6) * 0.95, X, Y, 0.0, 1);
          if (e < 4) return mt(lacq, 0.25, X, Y, 0.1, 1);
          const d = Math.hypot(lx - centre, vy);
          if (d < 0.2 * H) {
            const ring = d > 0.16 * H;
            const ray = Math.sin(Math.atan2(vy, lx - centre) * 8) > 0.35;
            if (ring || (ray && d > 0.07 * H) || d < 0.05 * H) return mt(M.gold, face(0.95, SIDE, (lx - centre) / (0.2 * H), vy / (0.2 * H)) * 0.95, X, Y, 0.0, 1);
            return mt(lacq, 0.35, X, Y, 0.1, 1);
          }
          // ruyi cloud scrolls rolling out either side, carved (lit above-left, dark below): a fat
          // stroke coiling about one and a half turns, then running out as a tail to the next
          const side = Math.sign(lx - centre);
          const sx = Math.abs(lx - centre) - 0.2 * H;
          const k = Math.floor(sx / (0.46 * H));
          const scx = 0.2 * H + (k + 0.5) * 0.46 * H, scy = (k % 2 ? -1 : 1) * 3;
          const dx = (Math.abs(lx - centre) - scx) * side, dy = vy - scy;
          const rr = Math.hypot(dx, dy), th = (Math.atan2(dy, dx * side) + Math.PI) / (Math.PI * 2);
          const turn = rr / 7 - th;
          const spiral = rr < 0.17 * H && rr > 2 && turn < 1.6 && Math.abs((((turn % 1) + 1) % 1) - 0.5) < 0.24;
          const tail = Math.abs(vy - scy * -1 - Math.sin(sx * 0.068) * 6) < 1.6 && rr > 0.15 * H;
          if (spiral || tail) return mt(M.gold, (dy < 0 ? 1.02 : 0.72) * along, X, Y, 0.05, 1);
          return mt(lacq, face(0.9, SIDE) * 0.32 * along, X, Y, 0.15, 1);
        }
        if (pilEdge) return mt(M.stone, 0.45 + overhang, X, Y, 0.2, 1);
        if (pil) {
          const pc = p.pilasters.find((x) => Math.abs(lx - x) < 0.32 * H)!;
          const d = Math.hypot(lx - pc, (v - 0.5) * FRIEZE);
          const kind = hash(Math.round(pc), 7, 3);
          const ring = d < 0.15 * H && d > 0.11 * H, petal = d < 0.09 * H && Math.sin(Math.atan2((v - 0.5) * FRIEZE, lx - pc) * (kind > 0.5 ? 6 : 8)) > 0;
          const worn = fbm(lx * 0.2, ly * 0.2, 13, 2) > 0.7;
          return (ring || petal) && !worn ? mt(M.gold, face(0.92, SIDE, (lx - pc) / (0.2 * H), (v - 0.5) * 2) * 0.75 * along, X, Y, 0.2, 1) : mt(M.stone, 0.62 * along + overhang, X, Y, 0.1, 1);
        }
        const pitch = 1.3 * H;
        const ci = Math.floor(lx / pitch);
        const m = (((lx % pitch) + pitch) % pitch) - pitch / 2;
        // a cartouche: a gold-lined panel with rounded ends; each one's own knot, some gilding worn
        const cw = 0.46 * H, ch = 0.26;
        const ex = Math.abs(m) / cw, ey = Math.abs(v - 0.5) / ch;
        const inCart = ex < 1 && ey < 1 && (ex < 0.8 || Math.hypot((ex - 0.8) / 0.2, ey) < 1);
        const rim = inCart && (ex > 0.93 || ey > 0.84 || (ex > 0.8 && Math.hypot((ex - 0.8) / 0.2, ey) > 0.82));
        const gilt = fbm(lx * 0.08, ly * 0.2, 19 + ci, 2) < 0.66 - hash(ci, 1, 9) * 0.2;
        if (rim) return gilt ? mt(M.gold, face(0.92, SIDE, 0, v < 0.5 ? -0.5 : 0.5) * 0.8 * along, X, Y, 0.15, 1) : mt(lacq, 0.7, X, Y, 0.1, 1);
        if (inCart) {
          const r = Math.hypot(m, (v - 0.5) * FRIEZE);
          const style = hash(ci, 2, 9);
          const vy = (v - 0.5) * FRIEZE;
          const knot = style < 0.4 ? r < 0.09 * H && r > 0.05 * H : style < 0.75 ? r < 0.08 * H && Math.sin(Math.atan2(vy, m) * 5) > 0.2 : Math.abs(m) + Math.abs(vy) < 0.08 * H;
          const tail = Math.abs(vy - Math.sin(m * (0.1 + style * 0.06)) * 3) < 1.2 && Math.abs(m) > 0.12 * H && Math.abs(m) < 0.36 * H;
          if ((knot || tail) && gilt) return mt(M.gold, 0.7 * along, X, Y, 0.25, 1);
          return mt(lacq, face(0.9, SIDE) * 0.4 * along, X, Y, 0.15, 1);
        }
        return mt(lacq, face(0.9, SIDE) * 0.55 * along + overhang * 0.5, X, Y, 0.1, 1);
      }
      // the wall below: courses of varied height, each block its own stone, the frieze's ledge
      // throwing a ragged shadow on the top course, rain stains under it, damp and moss at the foot
      let ri = 0;
      while (ri + 1 < rows.length && ly >= rows[ri]![1]) ri++;
      const [r0, r1] = rows[ri]!;
      const base = r0 >= baseTop;
      const bw = base ? 1.25 * H : 0.62 * H + 0.3 * H * hash(ri, 2, 23);
      const blk = course(lx, bw, (ri % 2) * bw * 0.5, 31 + ri * 7);
      const inY = ly - r0;
      if (!base) {
        const pc = p.pilasters.find((x) => Math.abs(lx - x) < 0.32 * H + 6);
        if (pc !== undefined) {
          const e = lx - pc;
          if (Math.abs(Math.abs(e) - 0.32 * H) < 1.5) return mt(M.stone, e < 0 ? 0.95 : 0.4, X, Y, 0.2, 1);
          if (e > 0.32 * H && e < 0.32 * H + 5) return mt(M.stone, 0.48 + (hash(X, Y, 9) > 0.7 ? 0.05 : 0), X, Y, 0.2, 1);
        }
      }
      if (blk.inX < 1.5 || inY < 1.5 || (base && blk.inX < 2.5)) return mt(M.stone, 0.4 - (base ? 0.06 : 0), X, Y, 0.2, 1);
      const tone = (hash(blk.j, ri, 11) - 0.5) * 0.16;
      // bevels: lit top and left edges, a dark bottom and right edge; the base course rougher
      const bev = Math.max(2, Math.min(4, (Math.min(r1, f) - r0) * 0.12));
      const edge = inY < bev ? 0.12 : blk.inX < bev ? 0.06 : blk.w - blk.inX < bev ? -0.08 : r1 - ly < bev ? -0.07 : 0;
      const rough = base ? (fbm(lx * 0.09, ly * 0.12, 47, 3) - 0.5) * 0.3 : (fbm(lx * 0.15, ly * 0.15, 43, 2) - 0.5) * 0.12;
      const chipped = base && fbm(lx * 0.3, ly * 0.3, 53, 2) > 0.74 ? -0.14 : 0;
      // the frieze's ledge shades the wall under it, stepping with the joints
      const ledgeShade = ly < F1 + 4 + 3 * hash(blk.j, 5, 3) ? -0.2 : 0;
      // rain stains run down from the frieze, long and short; damp rises from the foot
      const sv = vnoise(lx * 0.2, 3, 7);
      const streakLen = (0.4 + 1.1 * vnoise(lx * 0.035, 8, 9)) * H;
      const streak = sv > 0.62 && ly - F1 < streakLen ? -0.12 * (1 - (ly - F1) / streakLen) - 0.04 : 0;
      const damp = Math.max(0, 1 - (f - ly) / (0.6 * H)) * (0.12 + 0.12 * fbm(lx * 0.05, ly * 0.08, 59, 2));
      // moss: on the base course's ledge, and in patches where the damp is
      if (base && inY < 9) {
        const mm = clump(lx, 3, 1.4 * H, 71);
        if (mm > 0 && inY < mm * 0.7) return tn(P.moss, 0.3 + (inY / (mm * 0.7)) * 0.45, X, Y, 0.3);
      }
      if (damp > 0.14 && fbm(lx * 0.14, ly * 0.14, 67, 2) > 0.6) return tn(P.moss, 0.55 + damp, X, Y, 0.35);
      return mt(M.stone, 0.72 + tone + edge + rough + chipped + ledgeShade + streak - damp - ((ly - F1) / H) * 0.025, X, Y, 0.05, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// The gatehouse porch: vermilion posts on stone bases, a lacquer lintel, the doors ajar with
// the hall's warm light between them, its own small tiled roof against the hall's wall
// ---------------------------------------------------------------------------
export interface GateP {
  /** Width of the porch and the height of its doors (px); the anchor is its west end on the floor. */
  w: number;
  h: number;
}

export const gatehouse = definePainter<GateP>("court.gatehouse", {
  bounds(p) {
    return [-0.5 * H, -p.h - 1.4 * H, p.w + 0.6 * H, 4];
  },
  paint(c, p) {
    const W = p.w, D = p.h;
    const lf = new LitField(COURT_LIGHT, undefined, 16);
    void lf;
    // the wall the doors sit in: dark lacquer panels behind
    woodBox(c, 0, -D - 0.6 * H, W, 0, lacq, 3, 0.25, 1, 2);
    // the doors: two leaves ajar, warm light from the hall between them
    const d0 = 0.22 * W, d1 = 0.78 * W;
    rect(c, d0, -D, d1, 0, (X, Y, lx, ly) => {
      const u = (lx - d0) / (d1 - d0), v = (ly + D) / D;
      if (Math.abs(u - 0.5) < 0.07) return tn(M.glow, clamp(0.15 + v * 0.35, 0, 1), X, Y, 0.4);
      const leaf = u < 0.5 ? u / 0.43 : (1 - u) / 0.43;
      const stud = Math.hypot((((leaf * (d1 - d0) * 0.43) % 14) + 14) % 14 - 7, (((v * D) % 16) + 16) % 16 - 8) < 2.2 && v > 0.05 && v < 0.95;
      if (stud) return mt(M.gold, face(0.9, SIDE, 0, -0.5) * 0.9, X, Y, 0.1, 1);
      return mt(M.verm, face(0.9, SIDE, u < 0.5 ? -0.2 : 0.4, 0) * 0.75 + grain(lx, ly, 5, false) * 0.05, X, Y, 0.2, 1);
    });
    // posts on stone bases
    for (const px of [0.1 * W, 0.9 * W]) {
      colBase(c, px, 0.13 * H, 0.42 * H, 0.95, SIDE, 7);
      lathe(c, px, -D - 0.6 * H, -0.42 * H, () => 0.13 * H, (X, Y, u, _lx, ly) => {
        const band = -ly > D + 0.3 * H || (-ly > 1.0 * H && -ly < 1.15 * H);
        return band ? mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.05, 1) : mt(M.verm, cyl(0.95, u, SIDE, 0.15) * 0.85, X, Y, 0.1, 1);
      });
    }
    // the lintel with a plaque, then the roof
    woodBox(c, -0.1 * W, -D - 0.6 * H, 1.1 * W, -D - 0.25 * H, lacq, 9, 0.1, 1, 3);
    rect(c, 0.3 * W, -D - 0.56 * H, 0.7 * W, -D - 0.29 * H, (X, Y, lx, ly) => {
      const u = (lx - 0.3 * W) / (0.4 * W), v = (ly + D + 0.56 * H) / (0.27 * H);
      if (u < 0.05 || u > 0.95 || v < 0.1 || v > 0.9) return mt(M.gold, face(0.9, SIDE) * 0.95, X, Y, 0.05, 1);
      const st = Math.abs(((u * 3) % 1) - 0.5) < 0.09 && v > 0.25 && v < 0.75;
      return st ? mt(M.gold, 0.9, X, Y, 0.05, 1) : mt(lacq, 0.4, X, Y, 0.1, 1);
    });
    tileRoof(c, new LitField(COURT_LIGHT, undefined, 16), SIDE, -0.45 * W, 1.45 * W, -D - 0.6 * H, 0.75 * H, 3);
  },
});

// ---------------------------------------------------------------------------
// The Prize Board: a black-lacquer board on legs, a small roof, one gold-framed plaque per
// product with its champion's emblem; over it on two poles the newest release's banner
// ---------------------------------------------------------------------------
export interface BoardP {
  plaques: string[];
}

function emblem(c: PaintCtx, id: string, cx: number, cy: number, s: number): void {
  if (id === "dexclient") {
    // the lion's mask: a red face, a gold mirror on the brow, white fur brows, a wide grin
    rect(c, cx - 16 * s, cy - 14 * s, cx + 16 * s, cy + 13 * s, (X, Y, lx, ly) => {
      const u = (lx - cx) / (15 * s), v = (ly - cy) / (13 * s);
      if (u * u + v * v > 1) return 0;
      if (Math.hypot(lx - cx, ly - cy + 7 * s) < 3.6 * s) return mt(M.gold, face(0.95, SIDE, (lx - cx) / (4 * s), (ly - cy + 7 * s) / (4 * s)), X, Y, 0, 1);
      if (Math.abs(v + 0.18) < 0.13 && Math.abs(Math.abs(u) - 0.55) < 0.32) return tn(M.paper, 0.05, X, Y, 0);
      if (Math.hypot(Math.abs(lx - cx) - 6.5 * s, ly - cy - 1 * s) < 2.8 * s) return tn(M.ink, 0.1, X, Y, 0);
      if (v > 0.42 && v < 0.72 && Math.abs(u) < 0.62) return v < 0.56 ? tn(M.paper, 0.05, X, Y, 0) : tn(M.verm, 0.75, X, Y, 0);
      return mt(M.verm, face(0.95, SIDE, u * 0.7, v * 0.7) * 0.9, X, Y, 0.0, 1);
    });
  } else {
    // a pointed mage's hat with a red gem (Yuki's red stays on her gem)
    poly(c, [cx - 15 * s, cy + 9 * s, cx + 15 * s, cy + 9 * s, cx + 7 * s, cy + 4 * s, cx + 3 * s, cy - 13 * s, cx - 1 * s, cy - 15 * s, cx - 5 * s, cy + 4 * s], (X, Y, lx, ly) => mt(P.violet, face(0.95, SIDE, (lx - cx) / (15 * s), (ly - cy) / (15 * s)) * 0.85, X, Y, 0.0, 1));
    rect(c, cx - 2.6 * s, cy + 1 * s, cx + 2.6 * s, cy + 6 * s, (X, Y, lx, ly) => (Math.hypot(lx - cx, ly - cy - 3.5 * s) < 2.6 * s ? tn(M.verm, 0.15, X, Y, 0) : 0));
  }
}

/**
 * (hall loop round 1) The lion's mask embroidered on the release banner: a gold satin face in a
 * ring of red and gold mane tufts, white fur brows, round eyes, a bronze mirror on the brow, a
 * grin; every part in thread (stitch grooves along its own direction), a couched gold outline,
 * and lit by the cloth's fold under it. (u, v) is the cloth point in the face's unit circle.
 */
function lionThread(u: number, v: number, lx: number, ly: number, lit: number, X: number, Y: number): number {
  const r = Math.hypot(u, v * 1.05);
  const ang = Math.atan2(v, u);
  const groove = (dir: number): number => ((((lx * dir + ly) % 3) + 3) % 3 < 1 ? -0.09 : 0);
  // the mane: flame tufts round the face, radial stitches, red and gold by turns
  const tuft = 1.0 + 0.3 * (0.5 + 0.5 * Math.cos(ang * 9)) + 0.05 * Math.sin(ang * 23);
  if (r > 1.0 && r < tuft && v < 0.85) {
    const red = Math.cos(ang * 9) < 0.15;
    const rad = (((Math.round((ang / (Math.PI * 2)) * 140) % 2) + 2) % 2) === 0 ? -0.07 : 0;
    return red ? mt(M.verm, lit * 0.68 + rad, X, Y, 0.15, 1) : mt(M.gold, lit * 0.78 + rad, X, Y, 0.1, 1);
  }
  if (r > 1.0) return 0;
  // the couched outline round the face
  if (r > 0.92) return mt(M.gold, lit * (v < 0 ? 1.0 : 0.62), X, Y, 0.05, 1);
  // the bronze mirror on the brow
  const mr = Math.hypot(u, v + 0.52);
  if (mr < 0.24) return mt(M.bronze, lit * (mr < 0.1 ? 1.1 : (u + v + 0.52 < 0 ? 0.95 : 0.6)), X, Y, 0.0, 1);
  if (mr < 0.29) return mt(M.gold, lit * 0.5, X, Y, 0.1, 1);
  // white fur brows, stitched across
  if (Math.abs(v + 0.18 + Math.abs(u) * 0.12) < 0.12 && Math.abs(Math.abs(u) - 0.5) < 0.3) return mt(M.paper, lit * 0.95 + groove(1.6), X, Y, 0.0, 1);
  // the eyes: an ink ring, a gold iris, a highlight
  const er = Math.hypot(Math.abs(u) - 0.43, (v - 0.08) * 1.1);
  if (er < 0.19) {
    if (er < 0.05 && u * Math.sign(u) > 0) return mt(M.paper, 1.0, X, Y, 0.0, 1);
    return er < 0.11 ? tn(M.ink, 0.0, X, Y, 0) : mt(M.gold, lit * 0.95, X, Y, 0.05, 1);
  }
  if (er < 0.23) return tn(M.ink, 0.5, X, Y, 0);
  // the grin: a row of teeth over a dark red mouth
  if (v > 0.42 && v < 0.74 && Math.abs(u) < 0.6 - (v - 0.42) * 0.4) {
    if (v < 0.56) return Math.abs(((u * 9) % 1 + 1) % 1 - 0.5) < 0.08 ? mt(M.paper, 0.4, X, Y, 0.1, 1) : mt(M.paper, lit * 0.95, X, Y, 0.0, 1);
    return mt(M.verm, lit * 0.35, X, Y, 0.2, 1);
  }
  // the nose: a broad gold bridge stitched downward
  if (Math.abs(u) < 0.14 && v > -0.3 && v < 0.36) return mt(M.gold, lit * (u < 0 ? 0.98 : 0.7) + groove(-0.4), X, Y, 0.05, 1);
  // the face: gold satin, its stitches running diagonally
  return mt(M.gold, lit * 0.8 + groove(0.8) - r * 0.08, X, Y, 0.1, 1);
}

export const board = definePainter<BoardP>("court.board", {
  bounds() {
    return [-1.35 * H, -4.7 * H, 1.35 * H, 4];
  },
  paint(c, p) {
    const plaques = p.plaques.length ? p.plaques : ["dexclient", "dexcode"];
    const bw = 2.2 * H, bh = 1.45 * H, by1 = -0.72 * H, by0 = by1 - bh;
    // the banner's poles (behind) and the banner: red silk, gold border, the champion's face
    // in a ray burst, a swallowtail hem, a "new" ribbon across its corner
    for (const px of [-1.12 * H, 1.06 * H]) {
      lathe(c, px, -4.6 * H, 0, () => 4, (X, Y, u) => mt(lacq, cyl(0.95, u, SIDE, 0.2), X, Y, 0.0, 1));
      lathe(c, px, -4.75 * H, -4.55 * H, () => 6, (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
    }
    woodBox(c, -1.2 * H, -4.55 * H, 1.2 * H, -4.45 * H, lacq, 2, 0.05, 1, 2);
    const bx0 = -0.95 * H, bx1 = 0.95 * H, ty0 = -4.45 * H, ty1 = -2.55 * H;
    // (hall loop round 1) the release banner as cloth: heavy red silk hanging from the bar in soft
    // folds that open toward a weighted hem, the morning wind pushing its lower half to the right,
    // a twill weave, a gold fringe; the champion's face embroidered in gold thread on it
    const bwid = bx1 - bx0, drop = ty1 - ty0;
    const wind = (v: number): number => 5 * v ** 1.5 + 1.2 * Math.sin(v * 5);
    const foldAt = (u: number, v: number): [number, number] => {
      // the surface's height across (folds) and its slope (which way it faces)
      const A = 2.2 + 1.6 * Math.sin(v * 2.4);
      const ph = u * Math.PI * 2 * 3.2 + Math.sin(u * 7.1) * 0.9 + v * 0.8;
      return [A * Math.sin(ph), A * Math.cos(ph) * (Math.PI * 2 * 3.2) / bwid];
    };
    rect(c, bx0 - 4, ty0, bx1 + 12, ty1 + 0.34 * H, (X, Y, lx, ly) => {
      const v = (ly - ty0) / drop;
      if (v < 0 || v > 1.16) return 0;
      const ex = lx - wind(v);
      const u0 = (ex - bx0) / bwid;
      const [hgt, slope] = foldAt(u0, v);
      const u = (ex + hgt * 0.35 * (Math.abs(u0 - 0.5) > 0.42 ? 1 : 0) - bx0) / bwid;
      if (u < 0 || u > 1) return 0;
      // the fringe under the hem: gold threads of uneven length, swinging with the wind
      if (v > 1.0) {
        const th = Math.floor(ex / 2.2);
        const len = 0.07 + 0.08 * hash(th, 3, 17);
        if (v - 1.0 > len || ((ex % 2.2) + 2.2) % 2.2 > 1.3) return 0;
        return mt(M.gold, 0.72 - (v - 1) * 2.5 - slope * 0.6, X, Y, 0.1, 1);
      }
      // light: the side facing the sun (slope < 0 faces left) brighter, the far half in shade
      const lit = face(0.95, SIDE) * (0.92 - u * 0.16) - slope * 0.75 - (v > 0.03 && v < 0.07 ? 0.12 : 0);
      const weave = (X + Y) % 3 === 0 ? -0.035 : 0;
      // the gold border and the weighted hem band (a heavier double hem), following the folds
      if (u < 0.05 || u > 0.95 || v < 0.03 || (v > 0.9 && v < 0.97)) return mt(M.gold, lit * 1.02 + weave, X, Y, 0.05, 1);
      if (v >= 0.97) return mt(M.verm, lit * 0.7, X, Y, 0.2, 1);
      if (u < 0.08 || u > 0.92 || (v > 0.86 && v <= 0.9)) return mt(M.gold, lit * 0.62, X, Y, 0.2, 1);
      const cx = (ex - 0) / (2.8 * 15), cy = (ly - (-3.6 * H)) / (2.8 * 13);
      if (plaques[0] === "dexclient") {
        const st = lionThread(cx, cy, lx, ly, lit, X, Y);
        if (st) return st;
      }
      // the silk: a damask of faint rays round the emblem, woven in
      const ang = Math.atan2(v - 0.42, (u - 0.5) * 1.1);
      const ray = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 18) % 2 === 0;
      return mt(M.verm, lit * (ray ? 0.9 : 0.84) + weave, X, Y, 0.15, 1);
    });
    if (plaques[0] !== "dexclient") emblem(c, plaques[0]!, 0, -3.6 * H, 2.8);
    // the board's legs, its frame, the plaques
    for (const lx0 of [-1.0 * H, 0.9 * H]) woodBox(c, lx0, by0 + 0.2 * H, lx0 + 0.11 * H, 0, lacq, 3, 0.05, 1, 2);
    rect(c, -1.0 * H, -0.28 * H, 1.01 * H, -0.24 * H, (X, Y) => mt(lacq, 0.6, X, Y, 0.1, 1));
    woodBox(c, -bw / 2, by0, bw / 2, by1, lacq, 5, 0.0, 1, 4);
    rect(c, -bw / 2 + 5, by0 + 5, bw / 2 - 5, by1 - 5, (X, Y, lx, ly) => {
      const e = Math.min(lx + bw / 2 - 5, bw / 2 - 5 - lx, ly - by0 - 5, by1 - 5 - ly);
      return e < 2 ? mt(M.gold, face(0.95, SIDE) * 0.9, X, Y, 0.05, 1) : 0;
    });
    for (const [fx, fy, sx, sy] of [[-bw / 2, by0, 1, 1], [bw / 2, by0, -1, 1], [-bw / 2, by1, 1, -1], [bw / 2, by1, -1, -1]] as const) fitting(c, fx, fy, sx, sy, 9);
    plaques.forEach((id, i) => {
      const n = plaques.length;
      const cx = -bw / 2 + ((i + 0.5) / n) * bw;
      const pw = (bw / n) * 0.78, ph = bh * 0.78;
      const py0 = by0 + (bh - ph) / 2;
      rect(c, cx - pw / 2, py0, cx + pw / 2, py0 + ph, (X, Y, lx, ly) => {
        const u = (lx - cx + pw / 2) / pw, v = (ly - py0) / ph;
        const e = Math.min(u, 1 - u) * pw;
        const f = Math.min(v, 1 - v) * ph;
        const d = Math.min(e, f);
        if (d < 2) return mt(M.gold, face(0.95, SIDE, u < 0.5 ? -0.5 : 0.5, v < 0.5 ? -0.5 : 0.5), X, Y, 0.0, 1);
        if (d < 5) return mt(M.gold, 0.6, X, Y, 0.15, 1);
        if (v > 0.78 && v < 0.88 && Math.abs(u - 0.5) < 0.32) return mt(M.gold, 0.85, X, Y, 0.1, 1);
        return mt(lacq, face(0.9, SIDE) * 0.5 + v * 0.1, X, Y, 0.0, 1);
      });
      emblem(c, id, cx, py0 + ph * 0.42, 1.25);
    });
    tileRoof(c, new LitField(COURT_LIGHT, undefined, 16), SIDE, -bw / 2 - 0.3 * H, bw / 2 + 0.3 * H, by0, 0.42 * H, 7);
  },
});

// ---------------------------------------------------------------------------
// The gong tower: two great posts on stone bases, cross beams with gold medallions, the
// tower going up out of the frame (storey roofs on the way); the gong hangs low between the
// posts (its own sprite)
// ---------------------------------------------------------------------------
export interface TowerP {
  h: number;
  /** Half the span between the posts (px) and the gong's centre above the floor. */
  half: number;
  gongY: number;
}

export const gongTower = definePainter<TowerP>("court.gongtower", {
  bounds(p) {
    return [-p.half - 0.9 * H, -p.h, p.half + 0.9 * H, 4];
  },
  paint(c, p) {
    const lf = new LitField(COURT_LIGHT, undefined, 16);
    const r = 0.17 * H;
    // the upper storeys: dark lacquer panels between the posts, a ladder up the middle,
    // a balcony and a little roof every 3.6 H
    const tw = p.half * 0.62;
    rect(c, -tw, -p.h, tw, -p.gongY - 1.32 * H - 0.26 * H, (X, Y, lx, ly) => {
      const hgt = -ly / H;
      const u = (lx + tw) / (2 * tw);
      // (hall loop round 1) the face turns from the sun: lit on its left, in shade on its right
      const k = 0.98 - u * 0.3;
      const storey = ((hgt - 3.2) % 3.6 + 3.6) % 3.6;
      if (storey < 0.12) return mt(M.gold, face(k, SIDE, 0, storey < 0.04 ? -0.8 : 0.2) * 0.9, X, Y, 0.1, 1);
      // the storey's balcony throws a shadow down the panels under it
      const under = storey < 0.3 ? -0.18 : 0;
      // vermilion lattice panels set back in lacquer frames: the frame shades each panel's top
      // and left inside edge; the lattice's bars catch the morning only on their upper-left faces
      const pu = (u * 3) % 1, pv = ((hgt - 3.2) % 1.2 + 1.2) % 1.2 / 1.2;
      const frame = pu < 0.08 || pu > 0.92 || pv < 0.07;
      if (frame) {
        const nx = pu < 0.04 ? -0.7 : pu > 0.96 ? 0.7 : 0;
        return mt(lacq, face(k, SIDE, nx, pv < 0.035 ? -0.7 : 0) * 0.9 + under * 0.5, X, Y, 0.0, 1);
      }
      const recess = pu < 0.16 || pv < 0.17;
      const a = (((lx * 0.9 + ly) % 9) + 9) % 9, b = (((lx * 0.9 - ly) % 9) + 9) % 9;
      const bar = a < 1.6 || b < 1.6;
      if (bar) {
        const litFace = a < 0.8 || b > 0.8;
        const sun = recess ? 0.45 : litFace ? 1.0 : 0.55;
        return mt(M.verm, face(k, SIDE) * sun + under, X, Y, 0.2, 1);
      }
      return mt(lacq, face(k, SIDE) * (recess ? 0.12 : 0.26) + under * 0.3, X, Y, 0.1, 1);
    });
    for (let s = 3.2 + 3.6; s * H < p.h - 0.5 * H; s += 3.6) {
      tileRoof(c, lf, SIDE, -tw - 0.55 * H, tw + 0.55 * H, -s * H, 0.55 * H, Math.floor(s));
    }
    // the tower's own corner posts above the gong's frame
    const frameTop = -p.gongY - 1.32 * H - 0.5 * H;
    for (const px of [-tw, tw]) {
      lathe(c, px, -p.h, frameTop + 4, () => r * 0.7, (X, Y, u, _lx, ly) => {
        const hgt = -ly / H;
        const band = ((hgt - 3.2) % 3.6 + 3.6) % 3.6 < 0.16;
        return band ? mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1) : mt(lacq, cyl(0.95, u, SIDE, 0.3) * 0.95, X, Y, 0.0, 1);
      });
    }
    // the great posts of the gong's frame, a finial on each
    for (const px of [-p.half, p.half]) {
      lathe(c, px, frameTop - 0.32 * H, frameTop, (ly) => r * (0.4 + 0.6 * Math.sin(((ly - frameTop + 0.32 * H) / (0.32 * H)) * Math.PI)), (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
      colBase(c, px, r, 0.5 * H, 0.95, SIDE, 3);
      lathe(c, px, frameTop, -0.5 * H, () => r, (X, Y, u, _lx, ly) => {
        const hgt = -ly / H;
        const band = (hgt > 1.0 && hgt < 1.18) || (((hgt - 3.2) % 3.6 + 3.6) % 3.6 < 0.16 && hgt > 3);
        return band ? mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1) : mt(lacq, cyl(0.95, u, SIDE, 0.3) * 0.95, X, Y, 0.0, 1);
      });
    }
    // the gong's beam (it hangs from this) and a lower brace, gold medallions at their middles
    for (const [by, dep] of [[-p.gongY - 1.32 * H, 0.26 * H], [-0.95 * H, 0.14 * H]] as const) {
      woodBox(c, -p.half - 0.3 * H, by - dep, p.half + 0.3 * H, by, lacq, 7, 0.0, 1, 3);
      rect(c, -0.17 * H, by - dep - 4, 0.17 * H, by + 4, (X, Y, lx, ly) => (Math.hypot(lx, (ly - by + dep / 2) * 1.2) < 0.17 * H ? mt(M.gold, face(0.95, SIDE, lx / (0.17 * H), (ly - by + dep / 2) / (0.17 * H)), X, Y, 0.0, 1) : 0));
      for (const ex of [-p.half - 0.3 * H, p.half + 0.3 * H]) fitting(c, ex, by - dep, ex < 0 ? 1 : -1, 1, 8);
    }
    // the striker's rest: a padded mallet hanging from the left post on a cord
    const mx = -p.half + r + 10;
    rect(c, mx - 1, -p.gongY - 1.0 * H, mx + 1, -p.gongY + 0.2 * H, (X, Y) => tn(M.verm, 0.4, X, Y, 0));
  },
});

// ---------------------------------------------------------------------------
// The gong (a sprite): a great bronze disc with a raised boss and rings, hung by two red
// cords; struck, it swings back and settles, its face flaring (frames: 0 at rest, 1-11 the
// strike and its decay)
// ---------------------------------------------------------------------------
export interface GongP {
  r: number;
  /** The cords' length above the disc (px); the anchor is the beam's underside at the middle. */
  cord: number;
  frame?: number;
}

export const GONG_FRAMES = 12;

/** The gong's frame for ticks (60/s) since the strike (negative or none: at rest). */
export function gongFrame(ticks: number | null): number {
  if (ticks === null || ticks < 0) return 0;
  const f = 1 + Math.floor(ticks / 5);
  return f < GONG_FRAMES ? f : 0;
}

export const gong = definePainter<GongP>("court.gong", {
  bounds(p) {
    return [-p.r - 14, -2, p.r + 14, p.cord + p.r * 2 + 12];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    // the swing: struck from the left, it swings away and back, decaying; the face flares
    const t = f === 0 ? 0 : (f - 1) / (GONG_FRAMES - 1);
    const decay = f === 0 ? 0 : Math.exp(-t * 3.2);
    const swing = f === 0 ? 0 : Math.sin(t * Math.PI * 4.5) * 7 * decay;
    const flare = f === 0 ? 0 : Math.max(0, 1 - t * 2.4);
    const cx = Math.round(swing), cy = p.cord + p.r;
    for (const ax of [-p.r * 0.55, p.r * 0.55]) {
      const n = Math.ceil(Math.hypot(cx + ax * 0.9 - ax, cy - p.r * 0.85) * c.d);
      for (let i = 0; i <= n; i++) {
        const tt = i / n;
        const X = Math.round(c.X(ax + (cx + ax * 0.9 - ax) * tt)), Y = Math.round(c.Y((cy - p.r * 0.85) * tt));
        c.buf.set(X, Y, tt < 0.5 ? P.red[3]! : P.red[2]!);
        c.buf.set(X + 1, Y, P.red[4]!);
      }
    }
    rect(c, cx - p.r - 2, cy - p.r - 2, cx + p.r + 2, cy + p.r + 2, (X, Y, lx, ly) => {
      const dx = lx - cx, dy = ly - cy;
      const d = Math.hypot(dx, dy) / p.r;
      if (d > 1) return 0;
      const nx = dx / p.r, ny = dy / p.r;
      // the rim: a thick rolled edge; rings hammered into the face; the boss in the middle
      if (d > 0.92) {
        // (hall loop round 1) the rolled rim: a hot rim light where it faces the sun, its far side dark
        const sunward = -(nx * 0.62 + ny * 0.78);
        if (sunward > 0.55 && d > 0.95) return mt(M.bronze, 1.15, X, Y, 0.0, 1);
        return mt(M.bronze, face(0.95, SIDE, nx * 0.9, ny * 0.9) * (sunward < -0.3 ? 0.5 : 0.75), X, Y, 0.0, 1);
      }
      if (d > 0.86) return mt(M.bronze, face(0.95, SIDE, -nx * 0.6, -ny * 0.6) * 0.6, X, Y, 0.1, 1);
      const ring = Math.abs(d - 0.62) < 0.025 || Math.abs(d - 0.42) < 0.02;
      if (d < 0.2) return mt(M.bronze, face(0.95, SIDE, nx * 2.5, ny * 2.5) * 1.05 + flare * 0.3, X, Y, 0.0, 1);
      // the face: a broad sheen from the upper left, hammer marks, patina in the low rings
      const sheen = clamp(1 - Math.hypot(nx + 0.35, ny + 0.4) * 1.3, 0, 1);
      const hammer = hash(Math.floor(lx / 3), Math.floor(ly / 3), 5) > 0.82 ? -0.06 : 0;
      const patina = d > 0.7 && fbm(lx * 0.15, ly * 0.15, 9, 2) > 0.64;
      if (patina) return tn(P.jade, 0.55, X, Y, 0.3);
      return mt(M.bronze, 0.42 + sheen * 0.55 + hammer + flare * 0.35 - (ring ? 0.18 : 0), X, Y, 0.0, 1);
    });
    // a ring of ink characters round the face (abstract strokes)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const rx = cx + Math.cos(a) * p.r * 0.75, ry = cy + Math.sin(a) * p.r * 0.75;
      rect(c, rx - 3, ry - 3, rx + 3, ry + 3, (X, Y, lx, ly) => (Math.abs(lx - rx) < 0.8 || Math.abs(ly - ry) < 0.8 ? tn(M.bronze, 0.85, X, Y, 0) : 0));
    }
  },
});

// ---------------------------------------------------------------------------
// A stone lantern pillar: a shaft on a lotus base, a lantern house with lit paper, a roof cap
// ---------------------------------------------------------------------------
export interface LPillarP {
  h: number;
  lit?: boolean;
  /** Scale of the shaft and lantern house (near pillars are bigger). */
  s?: number;
}

export const lanternPillar = definePainter<LPillarP>("court.lanternpillar", {
  bounds(p) {
    const k = p.s ?? 1;
    return [-0.5 * H * k, -p.h - 0.9 * H * k, 0.5 * H * k, 4];
  },
  paint(c, p) {
    const lf = new LitField(COURT_LIGHT, undefined, 16);
    const k = p.s ?? 1;
    const r = 0.12 * H * k;
    colBase(c, 0, r * 1.3, 0.38 * H * k, 0.95, SIDE, 9);
    lathe(c, 0, -p.h, -0.38 * H * k, (ly) => r * (1 + 0.06 * Math.sin(ly * 0.05)), (X, Y, u, lx, ly) => {
      const band = Math.abs(ly + p.h * 0.62) < 3;
      return mt(M.stone, cyl(0.95, u, SIDE) * (band ? 0.75 : 0.95) + (fbm(lx * 0.3, ly * 0.1, 4, 2) > 0.7 ? -0.08 : 0), X, Y, 0.1, 1);
    });
    // the lantern house: a stone platform, four posts with lit paper between, a roof
    const hy1 = -p.h, hy0 = hy1 - 0.52 * H * k, hw = 0.24 * H * k;
    rect(c, -hw - 6, hy1 - 6, hw + 6, hy1, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < hy1 - 4 ? -0.8 : 0.4), X, Y, 0.1, 1));
    rect(c, -hw, hy0, hw, hy1 - 6, (X, Y, lx, ly) => {
      const u = (lx + hw) / (2 * hw), v = (ly - hy0) / (hy1 - 6 - hy0);
      if (u < 0.14 || u > 0.86 || Math.abs(u - 0.5) < 0.05) return mt(M.stone, face(0.95, SIDE, u < 0.5 ? -0.6 : 0.6, 0) * 0.8, X, Y, 0.15, 1);
      return tn(p.lit ? M.glow : M.paper, clamp(0.25 + Math.abs(u - 0.5) * 0.5 + v * 0.15, 0, 1), X, Y, 0.5);
    });
    tileRoof(c, lf, SIDE, -hw - 0.2 * H * k, hw + 0.2 * H * k, hy0, 0.3 * H * k, 13);
    lathe(c, 0, hy0 - 0.42 * H * k, hy0 - 0.26 * H * k, (ly) => 5 * k * Math.sin(((ly - hy0 + 0.42 * H * k) / (0.16 * H * k)) * Math.PI), (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
  },
});

// ---------------------------------------------------------------------------
// The newel posts at the Prow Stair's mouth: square stone posts with a small lantern each
// ---------------------------------------------------------------------------
export const newel = definePainter<{ h: number }>("court.newel", {
  bounds(p) {
    return [-0.3 * H, -p.h - 0.6 * H, 0.3 * H, 4];
  },
  paint(c, p) {
    const w = 0.16 * H;
    rect(c, -w, -p.h, w, 0, (X, Y, lx, ly) => {
      const u = (lx + w) / (2 * w), v = -ly / p.h;
      const [nx] = bevel(u, 0.5, 0.15, 0.1);
      const cap = v > 0.9;
      return mt(M.stone, face(0.95, SIDE, nx, cap && v > 0.97 ? -0.8 : 0) * (cap ? 1.05 : 0.9) + (fbm(lx * 0.3, ly * 0.2, 5, 2) > 0.72 ? -0.08 : 0), X, Y, 0.05, 1);
    });
    rect(c, -w - 4, -p.h - 4, w + 4, -p.h + 2, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -p.h - 2 ? -0.9 : 0.4), X, Y, 0.0, 1));
    // a small paper lantern on the cap
    const ly0 = -p.h - 0.42 * H;
    rect(c, -0.11 * H, ly0, 0.11 * H, -p.h - 4, (X, Y, lx, ly) => {
      const u = (lx + 0.11 * H) / (0.22 * H);
      if (u < 0.12 || u > 0.88) return mt(M.wood, 0.5, X, Y, 0.2, 1);
      return tn(M.paper, clamp(0.15 + Math.abs(u - 0.5) * 0.6 + (ly - ly0) / (0.4 * H) * 0.2, 0, 1), X, Y, 0.5);
    });
    rect(c, -0.15 * H, ly0 - 4, 0.15 * H, ly0, (X, Y) => mt(lacq, 0.5, X, Y, 0.1, 1));
  },
});

// ---------------------------------------------------------------------------
// The tip: a stone rail (front plane; she stands behind it) and a bench
// ---------------------------------------------------------------------------
export const tipRail = definePainter<{ w: number; h: number }>("court.rail", {
  bounds(p) {
    return [-0.2 * H, -p.h - 10, p.w + 0.2 * H, 6];
  },
  paint(c, p) {
    const postW = 0.13 * H;
    const n = Math.max(2, Math.round(p.w / (0.9 * H)));
    const step = p.w / n;
    rect(c, 0, -p.h * 0.62, p.w, -p.h * 0.5, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -p.h * 0.6 ? -0.6 : 0.3) * 0.9, X, Y, 0.1, 1));
    rect(c, 0, -p.h - 4, p.w, -p.h + 7, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -p.h - 1 ? -0.9 : 0.4), X, Y, 0.0, 1));
    for (let i = 0; i <= n; i++) {
      const px = i * step;
      rect(c, px - postW / 2, -p.h - 8, px + postW / 2, 0, (X, Y, lx, ly) => {
        const u = (lx - px + postW / 2) / postW;
        const top = ly < -p.h - 2;
        return mt(M.stone, face(0.95, SIDE, u < 0.25 ? -0.7 : u > 0.75 ? 0.7 : 0, top ? -0.8 : 0) + (fbm(lx * 0.3, ly * 0.2, 2, 2) > 0.74 ? -0.08 : 0), X, Y, 0.05, 1);
      });
    }
    // lichen and a crack or two
    rect(c, 0, -p.h - 8, p.w, 0, (X, Y, lx, ly) => (fbm(lx * 0.12, ly * 0.12, 8, 3) > 0.7 && keep(X, Y, 0.5) && c.buf.get(X, Y) ? tn(P.moss, 0.55, X, Y, 0.3) : 0));
  },
});

export const bench = definePainter<{ w: number }>("court.bench", {
  bounds(p) {
    return [-6, -0.6 * H, p.w + 6, 4];
  },
  paint(c, p) {
    rect(c, -4, -0.46 * H, p.w + 4, -0.38 * H, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -0.44 * H ? -0.9 : 0.4), X, Y, 0.0, 1));
    for (const lx0 of [4, p.w - 18]) {
      rect(c, lx0, -0.38 * H, lx0 + 14, 0, (X, Y, lx, _ly) => mt(M.stone, face(0.95, SIDE, lx - lx0 < 3 ? -0.7 : lx - lx0 > 11 ? 0.7 : 0) * 0.85, X, Y, 0.05, 1));
    }
    rect(c, -2, -3, p.w + 2, 2, (X, Y) => (keep(X, Y, 0.55) ? P.stone[5]! : 0));
  },
});

export { cyl };

// ---------------------------------------------------------------------------
// A festival banner on its pole (a sprite): long red silk on a crossbar, a gold-ringed
// emblem, a fringe; the wind from the west lifts it in a wave that travels down its length
// (8 frames at 5 fps), never frozen
// ---------------------------------------------------------------------------
export interface BannerP {
  /** Pole height (px; the anchor is its foot), banner width and drop (px). */
  h: number;
  w: number;
  drop: number;
  phase?: number;
  /** (hall loop round 1) How hard the wind takes this one (1 = as before) and its pattern (0 ring, 1 stripe, 2 band). */
  gust?: number;
  style?: number;
  frame?: number;
}

export const banner = definePainter<BannerP>("court.banner", {
  bounds(p) {
    const g = p.gust ?? 1;
    return [-p.w - 12, -p.h - 14, p.w + 16 + 6 * g, 4];
  },
  paint(c, p) {
    const f = ((p.frame ?? 0) + Math.round((p.phase ?? 0) * 8)) % 8;
    const ph = (f / 8) * Math.PI * 2;
    const g = p.gust ?? 1, style = p.style ?? 0;
    // the pole and its finial
    lathe(c, 0, -p.h, 0, () => 2.5, (X, Y, u) => mt(lacq, cyl(0.95, u, SIDE, 0.25), X, Y, 0.0, 1));
    lathe(c, 0, -p.h - 12, -p.h, (ly) => 4 * Math.sin(((ly + p.h + 12) / 12) * Math.PI), (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
    const bar = -p.h + 4;
    rect(c, -p.w / 2 - 6, bar - 3, p.w / 2 + 6, bar + 1, (X, Y, _lx, ly) => mt(lacq, ly < bar - 2 ? 0.9 : 0.6, X, Y, 0.1, 1));
    // the silk: each row shifted by the travelling wave, more toward the free end and more in a
    // gust; shaded by the wave's slope (the folds facing the sun lit, the others in shade), the
    // far half of the cloth a little darker, a twill in it
    rect(c, -p.w / 2 - 8, bar, p.w / 2 + 10 + 6 * g, bar + p.drop + 12, (X, Y, lx, ly) => {
      const t = (ly - bar) / p.drop;
      if (t < 0 || t > 1.1) return 0;
      const amp = (1 + t * 4) * g;
      const off = Math.sin(t * 5 - ph) * amp + t * t * 3 * (g - 0.8);
      const slope = Math.cos(t * 5 - ph) * Math.min(1.4, g);
      const u = (lx - off + p.w / 2) / p.w;
      if (u < 0 || u > 1) return 0;
      const shade = -slope * 0.12 - u * 0.1 + ((X + Y) % 3 === 0 ? -0.03 : 0);
      if (t > 1) {
        // the fringe: threads of uneven length
        const th = Math.floor(lx / 2);
        return (((lx % 2) + 2) % 2) < 1.2 && t - 1 < 0.04 + 0.06 * hash(th, 2, style + 5) ? mt(M.gold, 0.8 + shade, X, Y, 0.2, 1) : 0;
      }
      if (u < 0.08 || u > 0.92) return mt(M.gold, face(0.95, SIDE) * 0.85 + shade, X, Y, 0.1, 1);
      const ex = (u - 0.5) * p.w, ey = (t - 0.32) * p.drop;
      if (style === 0) {
        const d = Math.hypot(ex, ey);
        if (d < p.w * 0.3 && d > p.w * 0.24) return mt(M.gold, 0.85 + shade, X, Y, 0.1, 1);
        if (d < p.w * 0.16 && Math.sin(Math.atan2(ey, ex) * 5) > -0.2) return mt(M.gold, 0.8 + shade, X, Y, 0.15, 1);
      } else if (style === 1) {
        // a dark stripe down the middle with a column of gold glyph strokes
        if (Math.abs(u - 0.5) < 0.16) {
          const gy = ((t * 9) % 1 + 1) % 1;
          if (Math.abs(u - 0.5) < 0.1 && t > 0.12 && t < 0.86 && (gy < 0.22 || (gy < 0.6 && Math.abs(u - 0.5 + (gy - 0.4) * 0.2) < 0.03))) return mt(M.gold, 0.85 + shade, X, Y, 0.1, 1);
          return mt(lacq, 0.55 + shade, X, Y, 0.1, 1);
        }
      } else if (t < 0.18 && t > 0.1) {
        return mt(M.gold, 0.82 + shade, X, Y, 0.1, 1);
      }
      return mt(M.verm, 0.82 + shade, X, Y, 0.15, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// A cliff pine on the near plane (P5), growing out of the rock below the prow: a gnarled trunk
// leaning out, its crown of flat cloud pads topping just below the court's floor line (so it
// frames the bottom corners without ever covering her)
// ---------------------------------------------------------------------------
export interface NearPineP {
  /** Height of the crown's top above the anchor (px) and the lean (-1 left .. 1 right). */
  h: number;
  lean: number;
  seed?: number;
}

export const nearPine = definePainter<NearPineP>("court.nearpine", {
  bounds(p) {
    return [-p.h * 0.9, -p.h - 20, p.h * 0.9, 4];
  },
  paint(c, p) {
    const sd = p.seed ?? 1;
    // the trunk: a bent line of decreasing width from the root (0, 0) up and out
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      pts.push([p.lean * p.h * 0.45 * Math.sin(t * Math.PI * 0.7) + Math.sin(t * 7 + sd) * 6, -p.h * 0.78 * t]);
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]!;
      const w = 14 * (1 - (i / pts.length) * 0.7);
      rect(c, x - w, y - 4, x + w, y + 4, (X, Y, lx) => {
        const u = (lx - x) / w;
        const bark = Math.sin(Y * 0.7 + lx * 0.3) > 0.6 ? -0.08 : 0;
        return mt(M.wood, face(0.8, SIDE, u, 0) * 0.55 + bark, X, Y, 0.35, 1);
      });
    }
    // pads: flat clouds of needles along the upper trunk and on short branches
    const pads: [number, number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const t = 0.45 + k * 0.1;
      const [bx, by] = pts[Math.min(30, Math.round(t * 30))]!;
      const dir = k % 2 ? 1 : -1;
      pads.push([bx + dir * (20 + 30 * hash(k, 1, sd)) + p.lean * 20, by - 6 - 12 * hash(k, 2, sd), 34 + 26 * hash(k, 3, sd)]);
    }
    const top = pts[30]!;
    pads.push([top[0], top[1] - 10, 48]);
    for (const [cx, cy, rr] of pads) {
      rect(c, cx - rr, cy - rr * 0.55, cx + rr, cy + rr * 0.3, (X, Y, lx, ly) => {
        const q = Math.hypot((lx - cx) / rr, (ly - cy) / (rr * (ly < cy ? 0.5 : 0.28))) + (fbm(lx * 0.12, ly * 0.12, sd, 3) - 0.5) * 0.55;
        if (q > 1) return 0;
        const v = (ly - cy) / (rr * 0.5);
        const lit = v < -0.4 && lx < cx ? 0.75 : v < 0 ? 0.55 : 0.3;
        return mt(P.pine, lit + (hash(X, Y, 3) > 0.9 ? 0.1 : 0), X, Y, 0.1, 1);
      });
    }
  },
});

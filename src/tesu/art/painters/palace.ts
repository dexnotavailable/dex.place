// The Ink Palace in side view: black lacquer, gold ridges, vermilion columns, one red seal.
// The Hall of Works is a long, three-tier hall on a stone platform at て's corner; its
// entrance is at the west end, between twin gate towers with cable stays and festival
// banners (GDK A.3, "Frame, front"; the Liyue gate reference turned side-on).

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, hash, tone } from "../raster.ts";

/** Fills a level-1 rectangle with a per-pixel colour. */
function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / Math.max(1, X1 - X0), (y - Y0 + 0.5) / Math.max(1, Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

/**
 * A sweeping tiled roof seen from the side: eave line at y (the lowest edge), x0..x1 at the
 * eave, rising `rh` to a ridge with a gold crest; the eave corners turn up.
 */
function roof(c: PaintCtx, x0: number, x1: number, y: number, rh: number, inset = 0.32, ridgeOrn = true): void {
  const steps = Math.max(2, Math.ceil(rh * c.d));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps; // 0 at the eave, 1 at the ridge
    const ly = y - u * rh;
    const span = (x1 - x0) / 2;
    const cx = (x0 + x1) / 2;
    // a concave sweep: steep near the ridge, flat at the eave, the corners turned up
    const halfW = span * (1 - inset * Math.pow(u, 0.7));
    const lift = u < 0.22 ? (1 - u / 0.22) * rh * 0.32 : 0;
    const Y = Math.round(c.Y(ly));
    const xa = Math.round(c.X(cx - halfW)), xb = Math.round(c.X(cx + halfW));
    for (let x = xa; x < xb; x++) {
      const k = Math.abs(c.lx(x + 0.5) - cx) / Math.max(1, halfW);
      // only the turned-up corner rows reach past the eave line at the ends
      if (lift > 0 && k > 0.92 && hash(i, 0, 3) < 0) continue;
      const course = Math.floor(u * rh / 7) % 2;
      let col = tone(P.tile, clamp(0.22 + 0.5 * (1 - u) + course * 0.1, 0, 1), x, Y, 0.3);
      if (i === steps) col = P.gold[1]!;
      else if (i >= steps - Math.max(1, Math.round(5 * c.d))) col = P.gold[2 + (x % 2)]!;
      if (x === xa || x === xb - 1) col = P.ink[0]!;
      c.buf.set(x, Y, col);
    }
    // the upturned corners
    if (lift > 0) {
      for (const side of [-1, 1]) {
        const ex = cx + side * halfW;
        const X = Math.round(c.X(ex + side * 4)), Y2 = Math.round(c.Y(ly - lift));
        c.buf.set(X, Y2, P.ink[0]!);
        c.buf.set(X, Y2 + 1, P.tile[3]!);
      }
    }
  }
  // the eave's underside: a dark band of rafter ends
  fill(c, x0 + 6, y, x1 - 6, y + 9, (x, _y, _u, v) => (v < 0.4 ? P.ink[0]! : (x & 3) === 0 ? P.gold[3]! : P.lacquer[3]!));
  if (ridgeOrn) {
    // gold finials at the ridge's ends
    const cx = (x0 + x1) / 2, halfW = ((x1 - x0) / 2) * (1 - inset);
    for (const side of [-1, 1]) {
      fill(c, cx + side * halfW - 7, y - rh - 22, cx + side * halfW + 7, y - rh + 2, (_x, _yy, u) => (u < 0.4 ? P.gold[1]! : P.gold[3]!));
    }
  }
}

/** A storey: stone or timber, vermilion columns, black lacquer lattice between them, gold trims. */
function storey(c: PaintCtx, x0: number, x1: number, y0: number, y1: number, bay: number, lattice = true): void {
  fill(c, x0, y0, x1, y1, (x, y, _u, v) => {
    const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
    const inBay = ((lx - x0) % bay + bay) % bay;
    const col = inBay < 16;
    if (x === Math.round(c.X(x0)) || x === Math.round(c.X(x1)) - 1) return P.ink[0]!;
    if (col) return tone(P.red, inBay < 5 ? 0.15 : inBay < 11 ? 0.4 : 0.7, x, y, 0.3);
    // gold trim under the eave and a rail band at the base
    if (v < 0.04 || (v > 0.86 && v < 0.89)) return P.gold[2]!;
    if (v > 0.89) return tone(P.lacquer, 0.7, x, y, 0.3);
    if (!lattice || c.d < 0.5) return tone(P.lacquer, 0.45 + 0.1 * bayer4(x, y), x, y, 0.3);
    // lattice: a grid of thin gold-brown bars over dark paper
    const gx = (inBay - 16) % 18, gy = (ly - y0) % 18;
    if (gx < 2 || gy < 2) return P.lacquer[1]!;
    return tone(P.lacquer, 0.6 + 0.2 * (gy / 18), x, y, 0.3);
  });
}

export interface PalaceP {
  /** Length of the hall, level-1 px; the anchor is the floor line at its west end. */
  w: number;
  /** Ground storey height, upper storey, top pavilion (px). */
  h0: number;
  h1: number;
  h2: number;
  /** The entrance: x from the west end, width, height (px). */
  door: [number, number, number];
}

export const palace = definePainter<PalaceP>("palace", {
  bounds(p) {
    return [-180, -(p.h0 + p.h1 + p.h2 + 760), p.w + 180, 60];
  },
  paint(c, p) {
    const w = p.w;
    // heights: each storey sits on the roof below it; roofs are drawn last, top tier first,
    // so each one laps over the foot of the storey above
    const r0 = 250, r1 = 240, r2 = 300;
    const g0 = -p.h0;
    const s1 = 150;
    const g1top = g0 - r0 * 0.62;
    const g1 = g1top - p.h1;
    const s2 = w * 0.32;
    const g2top = g1 - r1 * 0.62;
    const g2 = g2top - p.h2;
    // the stone platform the hall stands on
    fill(c, -40, 0, w + 40, 48, (x, y, _u, v) => (y === Math.round(c.Y(0)) ? P.stone[0]! : tone(P.stone, v < 0.15 ? 0.15 : 0.45 + 0.2 * v + (((c.lx(x) / 60) | 0) % 2) * 0.06, x, y, 0.3)));
    // the storeys, top down
    storey(c, s2, w - s2, g2, g2top, 128);
    storey(c, s1, w - s1, g1, g1top, 154);
    storey(c, 0, w, g0, 0, 154);
    // bracket friezes under each eave: gold and teal-blue clusters
    const frieze = (x0: number, x1: number, y: number): void => {
      fill(c, x0 + 8, y, x1 - 8, y + 26, (x, _yy, _u, v) => {
        const lx = c.lx(x + 0.5);
        const k = ((lx - x0) % 38 + 38) % 38;
        if (v < 0.2) return P.lacquer[3]!;
        if (k < 20 && v < 0.75) return v < 0.45 ? P.gold[2]! : P.blue[2]!;
        if (k < 26) return P.red[3]!;
        return P.lacquer[2]!;
      });
    };
    frieze(0, w, g0);
    frieze(s1, w - s1, g1);
    frieze(s2, w - s2, g2);
    // a balcony rail along the gallery's foot
    fill(c, s1 - 24, g1top - 16, w - s1 + 24, g1top - 2, (x, _y, _u, v) => (v < 0.25 ? P.red[2]! : ((x >> 2) & 1) === 0 ? P.red[4]! : 0));
    // the entrance: a deep red portal with gold studs and warm light at the seam
    const [dx, dw, dh] = p.door;
    fill(c, dx - 14, -dh - 14, dx + dw + 14, 0, (_x, _y, u, v) => (u < 0.06 || u > 0.94 || v < 0.06 ? P.gold[2]! : 0));
    fill(c, dx, -dh, dx + dw, 0, (x, y, u, v) => {
      const seam = Math.abs(u - 0.5) < 0.02;
      if (seam) return v > 0.1 ? P.gold[0]! : P.gold[1]!;
      const stud = c.d >= 0.5 && ((x - Math.round(c.X(dx))) % Math.max(2, Math.round(16 * c.d))) === 6 && ((y - Math.round(c.Y(-dh))) % Math.max(2, Math.round(16 * c.d))) === 6;
      if (stud) return P.gold[1]!;
      return tone(P.red, 0.3 + 0.35 * v + (u < 0.5 ? 0 : 0.1), x, y, 0.4);
    });
    roof(c, dx - 40, dx + dw + 40, -dh - 18, 38, 0.2, false);
    // the red seal under the top eave
    const sealX = w / 2;
    fill(c, sealX - 30, g2 + 34, sealX + 30, g2 + 94, (x, y, u, v) => (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92 ? P.gold[1]! : tone(P.red, 0.3 + 0.2 * v, x, y, 0.3)));
    // the roofs, top tier first
    roof(c, s2 - 130, w - s2 + 130, g2, r2, 0.42);
    roof(c, s1 - 110, w - s1 + 110, g1, r1, 0.22);
    roof(c, -110, w + 110, g0, r0, 0.16);
    // lanterns under the first eave, every other bay
    if (c.d >= 0.25) {
      for (let lx = 77; lx < w - 40; lx += 308) {
        fill(c, lx - 10, g0 + 40, lx + 10, g0 + 70, (x, y, u, v) => (v < 0.12 || v > 0.88 ? P.gold[3]! : tone(P.red, u < 0.35 ? 0.05 : u < 0.7 ? 0.25 : 0.5, x, y, 0.3)));
        fill(c, lx - 1, g0 + 26, lx + 1, g0 + 40, () => P.ink[0]!);
      }
    }
  },
});

export interface TowerP {
  /** Height to the top of the cap roof, px; the anchor is its foot. */
  h: number;
  /** Width of the post, px. */
  w?: number;
}

/** A gate tower: a tall square post of lacquer and vermilion with a little roof and a lantern. */
export const gatetower = definePainter<TowerP>("gatetower", {
  bounds(p) {
    const w = p.w ?? 70;
    return [-w - 30, -p.h - 60, w + 30, 4];
  },
  paint(c, p) {
    const w = p.w ?? 70;
    const half = w / 2;
    // the body: a stone foot, a vermilion post with lacquer panels, gold bands
    fill(c, -half - 6, -40, half + 6, 0, (x, y, u, v) => tone(P.stone, v < 0.1 ? 0.1 : u < 0.3 ? 0.3 : u < 0.75 ? 0.5 : 0.8, x, y, 0.3));
    fill(c, -half, -p.h + 70, half, -40, (x, y, u, v) => {
      if (u < 0.06 || u > 0.94) return P.ink[0]!;
      const band = Math.abs((v * 9) % 1 - 0.5) < 0.04;
      if (band) return P.gold[2]!;
      const panel = u > 0.22 && u < 0.78;
      if (panel) return tone(P.lacquer, 0.4 + 0.25 * u, x, y, 0.3);
      return tone(P.red, u < 0.15 ? 0.15 : u < 0.5 ? 0.38 : 0.68, x, y, 0.3);
    });
    // a round window with warm light
    const wy = -p.h + 150;
    fill(c, -14, wy - 14, 14, wy + 14, (x, y) => {
      const dx = c.lx(x + 0.5), dy = c.ly(y + 0.5) - wy;
      const r = Math.hypot(dx, dy);
      if (r > 14) return 0;
      return r > 11 ? P.gold[2]! : r > 8 ? P.ink[0]! : P.gold[0]!;
    });
    roof(c, -half - 34, half + 34, -p.h + 70, 58, 0.3);
  },
});

export interface StayP {
  /** The far end of the cable, level-1 px from the anchor (the tower's top). */
  dx: number;
  dy: number;
}

/** A cable stay: a taut dark line with a slight sag, tied off with a red tassel. */
export const stay = definePainter<StayP>("stay", {
  bounds(p) {
    return [Math.min(0, p.dx) - 6, Math.min(0, p.dy) - 6, Math.max(0, p.dx) + 6, Math.max(0, p.dy) + 16];
  },
  paint(c, p) {
    const n = Math.max(4, Math.ceil(Math.hypot(p.dx, p.dy) * c.d));
    let px = c.X(0), py = c.Y(0);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const sag = Math.sin(t * Math.PI) * Math.abs(p.dx) * 0.03;
      const x = c.X(p.dx * t), y = c.Y(p.dy * t + sag);
      c.buf.line(px, py, x, y, P.ink[0]!);
      if (c.d >= 0.5) c.buf.line(px, py + 1, x, y + 1, P.lacquer[2]!);
      px = x; py = y;
    }
  },
});

export interface BannersP {
  /** Span between the two hanging points, px; the anchor is the left one. */
  w: number;
  /** Banner drop, px. */
  drop: number;
  /** How many banners hang on the rope. */
  n?: number;
}

/** Festival banners hanging from a rope strung between two towers: long, red, gold and blue. */
export const banners = definePainter<BannersP>("banners", {
  bounds(p) {
    return [-6, -6, p.w + 6, p.drop + p.w * 0.12 + 30];
  },
  paint(c, p) {
    const n = p.n ?? 5;
    const sagAt = (lx: number): number => Math.sin((lx / p.w) * Math.PI) * p.w * 0.1;
    // the rope
    for (let lx = 0; lx <= p.w; lx += 1 / c.d) {
      const X = Math.round(c.X(lx)), Y = Math.round(c.Y(sagAt(lx)));
      c.buf.set(X, Y, P.ink[0]!);
    }
    const ramps = [P.red, P.gold, P.blue, P.paper, P.red];
    for (let i = 0; i < n; i++) {
      const bx = ((i + 0.5) / n) * p.w;
      const top = sagAt(bx);
      const bw = Math.min(46, (p.w / n) * 0.55);
      const drop = p.drop * (0.75 + 0.25 * hash(i, 1, c.seed));
      const ramp = ramps[i % ramps.length]!;
      fill(c, bx - bw / 2, top, bx + bw / 2, top + drop, (x, y, u, v) => {
        // a swallowtail hem
        const hem = Math.abs(u - 0.5) * 2;
        if (v > 1 - 0.08 * (1 - hem)) return 0;
        if (u < 0.07 || u > 0.93) return ramp[ramp.length - 1]!;
        const stripe = Math.abs(v - 0.18) < 0.03 || Math.abs(v - 0.8) < 0.03;
        if (stripe) return P.gold[1]!;
        return tone(ramp, u < 0.35 ? 0.15 : u < 0.7 ? 0.35 : 0.6, x, y, 0.3);
      });
    }
  },
});

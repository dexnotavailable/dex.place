// Timber on the water: Kagami's jetty (a plank deck on posts the whole length of the lake),
// mooring posts and their rope. Side view; the posts run down past the waterline so the
// lake can cover them and still reflect them.

import { definePainter } from "../painter.ts";
import { P } from "../palette.ts";
import { clamp, hash, tone, vnoise } from "../raster.ts";

export interface JettyP {
  /** Deck length, level-1 px; the anchor is the deck's top-left corner. */
  w: number;
  /** Waterline below the deck top, px. */
  water: number;
  /** Post spacing, px (default 118). */
  every?: number;
  /** Deck beam thickness, px (default 9). */
  beam?: number;
}

export const jetty = definePainter<JettyP>("jetty", {
  bounds(p) {
    return [-6, -3, p.w + 6, p.water + 14];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const every = p.every ?? 118;
    const beam = p.beam ?? 9;
    const T = P.timber;
    // posts first (behind the beam), with a brace pair under every other span
    const n = Math.max(1, Math.round(p.w / every));
    for (let i = 0; i <= n; i++) {
      const lx = (i / n) * p.w;
      const pw = 7;
      const X0 = Math.round(c.X(lx - pw / 2)), X1 = Math.max(X0 + 1, Math.round(c.X(lx + pw / 2)));
      const Y0 = Math.round(c.Y(beam - 1)), Y1 = Math.round(c.Y(p.water + 12));
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const u = (x - X0) / Math.max(1, X1 - X0 - 1);
          const wet = c.ly(y + 0.5) > p.water - 10;
          let t = 0.3 + 0.45 * u + (vnoise(x / 1.5, y / 9, c.seed + i) - 0.5) * 0.2;
          if (wet) t += 0.2;
          if (x === X0 || x === X1 - 1) t = 0.95;
          b.set(x, y, tone(T, clamp(t, 0, 1), x, y, 0.4));
        }
      }
      // diagonal braces between this post and the next, every other span
      if (i < n && i % 2 === 0 && d >= 0.5) {
        const nx = ((i + 1) / n) * p.w;
        const ya = beam + 4, yb = p.water - 6;
        b.line(c.X(lx + 3), c.Y(ya), c.X(nx - 3), c.Y(yb), T[4]!);
        b.line(c.X(lx + 3), c.Y(ya + 1), c.X(nx - 3), c.Y(yb + 1), T[5]!);
      }
    }
    // the deck: a lit top edge, plank ends along the beam's face, a dark underside
    const X0 = Math.round(c.X(0)), X1 = Math.round(c.X(p.w));
    const Y0 = Math.round(c.Y(0)), Y1 = Math.max(Y0 + 2, Math.round(c.Y(beam)));
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        const lx = c.lx(x + 0.5);
        const r = y - Y0;
        let t: number;
        if (r === 0) t = 0.02;
        else if (y === Y1 - 1) t = 0.92;
        else {
          // plank ends: a seam every ~13 px, each plank its own tone
          const plank = Math.floor((lx + 3 * Math.sin(lx * 0.01)) / 13);
          const seam = d >= 0.5 && Math.abs(((lx % 13) + 13) % 13) < 1.1 / d;
          t = 0.22 + 0.25 * hash(plank, 0, c.seed) + 0.18 * (r / Math.max(1, Y1 - Y0));
          if (seam) t = 0.75;
        }
        b.set(x, y, tone(T, clamp(t, 0, 1), x, y, 0.4));
      }
    }
  },
});

export interface MoorP {
  /** Post height above the deck, px. */
  h: number;
  /** Below the deck to the water, px. */
  down: number;
  /** Rope looped on it. */
  rope?: boolean;
}

export const moorPost = definePainter<MoorP>("moorPost", {
  bounds(p) {
    return [-8, -p.h - 4, 8, p.down + 12];
  },
  paint(c, p) {
    const b = c.buf;
    const T = P.timber;
    const X0 = Math.round(c.X(-5)), X1 = Math.max(X0 + 1, Math.round(c.X(5)));
    const Y0 = Math.round(c.Y(-p.h)), Y1 = Math.round(c.Y(p.down + 10));
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        const u = (x - X0) / Math.max(1, X1 - X0 - 1);
        let t = 0.2 + 0.55 * u + (hash(x, Math.floor(y / 3), c.seed) - 0.5) * 0.12;
        if (y === Y0) t = 0.05;
        if (x === X0 || x === X1 - 1) t = 0.95;
        b.set(x, y, tone(T, clamp(t, 0, 1), x, y, 0.4));
      }
    }
    // an iron cap band and the rope
    const capY = Math.round(c.Y(-p.h + 4));
    for (let x = X0; x < X1; x++) b.set(x, capY, P.ink[1]!);
    if (p.rope && c.d >= 0.5) {
      const ry = c.Y(-p.h * 0.45);
      for (let k = 0; k < 3; k++) {
        b.line(c.X(-6), ry + k * 2 * c.d, c.X(6), ry + k * 2 * c.d + c.d, P.earth[k % 2 ? 1 : 2]!);
      }
    }
  },
});

export interface PlankP {
  /** Length, level-1 px; the anchor is the plank's top-left. */
  w: number;
  /** Thickness, px (default 7). */
  t?: number;
}

/** A plank laid across a gap, one-way ground: it can be dropped through. */
export const plank = definePainter<PlankP>("plank", {
  bounds(p) {
    return [-2, -2, p.w + 2, (p.t ?? 7) + 8];
  },
  paint(c, p) {
    const b = c.buf;
    const t = p.t ?? 7;
    const X0 = Math.round(c.X(0)), X1 = Math.round(c.X(p.w));
    const Y0 = Math.round(c.Y(0)), Y1 = Math.max(Y0 + 2, Math.round(c.Y(t)));
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        let v = 0.3 + 0.35 * ((y - Y0) / Math.max(1, Y1 - Y0)) + (hash(Math.floor(x / 3), y, c.seed) - 0.5) * 0.1;
        if (y === Y0) v = 0.05;
        if (y === Y1 - 1 || x === X0 || x === X1 - 1) v = 0.95;
        b.set(x, y, tone(P.timber, clamp(v, 0, 1), x, y, 0.4));
      }
    }
    // two pegs under it
    for (const fx of [0.12, 0.88]) {
      const px = Math.round(c.X(p.w * fx));
      for (let y = Y1; y < Y1 + Math.round(6 * c.d); y++) b.set(px, y, P.timber[5]!);
    }
  },
});

export interface BoatP {
  /** Hull length, px; the anchor is the waterline at the bow end (left). */
  w: number;
}

/** A small moored sampan: a dark timber hull riding on the waterline, a woven half-canopy. */
export const boat = definePainter<BoatP>("boat", {
  bounds(p) {
    return [-8, -54, p.w + 8, 14];
  },
  paint(c, p) {
    const b = c.buf;
    const w = p.w;
    // hull: a shallow crescent, its sheer line rising at bow and stern
    for (let lx = 0; lx <= w; lx += 1 / c.d) {
      const u = lx / w;
      const sheer = -14 - 10 * Math.pow(Math.abs(u - 0.5) * 2, 3);
      const keel = 8 - 6 * Math.pow(Math.abs(u - 0.5) * 2, 2);
      const X = Math.round(c.X(lx));
      const Y0 = Math.round(c.Y(sheer)), Y1 = Math.round(c.Y(keel));
      for (let y = Y0; y < Y1; y++) {
        const v = (y - Y0) / Math.max(1, Y1 - Y0);
        let t = v < 0.12 ? 0.08 : v < 0.3 ? 0.55 : 0.75;
        if (y === Y1 - 1 || u < 0.01 || u > 0.99) t = 0.95;
        b.set(X, y, tone(P.timber, t, X, y, 0.3));
      }
    }
    // a woven canopy over the middle third
    const cx0 = w * 0.38, cx1 = w * 0.7;
    for (let lx = cx0; lx <= cx1; lx += 1 / c.d) {
      const u = (lx - cx0) / (cx1 - cx0);
      const top = -14 - 26 * Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));
      const X = Math.round(c.X(lx));
      for (let y = Math.round(c.Y(top)); y < Math.round(c.Y(-14)); y++) {
        const weave = ((X + y) & 3) === 0;
        b.set(X, y, weave ? P.earth[3]! : tone(P.earth, u < 0.3 ? 0.15 : 0.45, X, y, 0.3));
      }
    }
  },
});

export interface CoilP {
  r?: number;
}

/** A coil of rope lying on the deck. */
export const coil = definePainter<CoilP>("coil", {
  bounds(p) {
    const r = p.r ?? 12;
    return [-r - 2, -r * 0.8 - 2, r + 2, 2];
  },
  paint(c, p) {
    const r = p.r ?? 12;
    for (let k = 0; k < 3; k++) {
      const rr = r - k * 3;
      for (let a = Math.PI; a <= Math.PI * 2; a += 0.5 / (rr * c.d)) {
        const X = Math.round(c.X(Math.cos(a) * rr)), Y = Math.round(c.Y(Math.sin(a) * rr * 0.55 - k * 2));
        c.buf.set(X, Y, k % 2 ? P.earth[2]! : P.earth[1]!);
        c.buf.set(X, Y + 1, P.earth[3]!);
      }
    }
  },
});

export interface ReedsP {
  /** Width of the bed, px; the anchor is the waterline at its left end. */
  w: number;
  /** Tallest reed above the water, px. */
  h: number;
}

/** Reeds and cattails standing in the shallows (a near-front plane silhouette). */
export const reeds = definePainter<ReedsP>("reeds", {
  bounds(p) {
    return [-6, -p.h - 10, p.w + 6, 16];
  },
  paint(c, p) {
    const n = Math.round(p.w / 5);
    for (let i = 0; i < n; i++) {
      const x0 = ((i + hash(i, 1, c.seed)) / n) * p.w;
      const hh = p.h * (0.35 + 0.65 * hash(i, 2, c.seed)) * Math.sin(Math.PI * Math.min(1, Math.max(0.15, x0 / p.w)));
      const lean = (hash(i, 3, c.seed) - 0.4) * 0.35;
      const col = hash(i, 4, c.seed) < 0.5 ? P.moss[5]! : P.moss[6]!;
      for (let ly = 12; ly > -hh; ly -= 1 / c.d) {
        const X = Math.round(c.X(x0 + lean * (12 - ly))), Y = Math.round(c.Y(ly));
        c.buf.set(X, Y, col);
      }
      // a cattail head on some
      if (hash(i, 5, c.seed) < 0.25 && hh > p.h * 0.5) {
        const tx = x0 + lean * (12 + hh);
        for (let ly = -hh + 2; ly < -hh + 12; ly += 1 / c.d) {
          const X = Math.round(c.X(tx)), Y = Math.round(c.Y(ly));
          c.buf.set(X, Y, P.timber[4]!);
          c.buf.set(X + 1, Y, P.timber[5]!);
        }
      }
    }
  },
});

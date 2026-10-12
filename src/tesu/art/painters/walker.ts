// A Walker, standing in for the Walker lane's giant until its renders land (same slot,
// same scale): white shaggy body, a bonsai pine growing on its back, red and gold ropes
// with tassels, long dark legs, white tendrils hanging from its head. Slow, heavy walk
// cycle; facing right; the anchor is its feet line (the waterline when it wades).

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, hash, tone, vnoise } from "../raster.ts";

export interface WalkerP {
  frame?: number;
  /** Frames in the cycle. */
  frames?: number;
}

const TAU = Math.PI * 2;

function thick(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, col: (t: number, u: number, x: number, y: number) => number): void {
  // a tapered limb from (x0, y0) to (x1, y1), level-1 local px
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.ceil(len * c.d));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    const w = (w0 + (w1 - w0) * t) / 2;
    const X0 = Math.floor(c.X(cx - w)), X1 = Math.ceil(c.X(cx + w));
    const Y = Math.round(c.Y(cy));
    for (let x = X0; x < X1; x++) {
      const u = (x - X0) / Math.max(1, X1 - X0 - 1);
      c.buf.set(x, Y, col(t, u, x, Y));
    }
  }
}

function ellipse(c: PaintCtx, cx: number, cy: number, rx: number, ry: number, col: (u: number, v: number, x: number, y: number) => number): void {
  const X0 = Math.floor(c.X(cx - rx)), X1 = Math.ceil(c.X(cx + rx));
  const Y0 = Math.floor(c.Y(cy - ry)), Y1 = Math.ceil(c.Y(cy + ry));
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const u = (c.lx(x + 0.5) - cx) / rx, v = (c.ly(y + 0.5) - cy) / ry;
      if (u * u + v * v > 1) continue;
      const col1 = col(u, v, x, y);
      if (col1) c.buf.set(x, y, col1);
    }
  }
}

export const walker = definePainter<WalkerP>("walker", {
  bounds() {
    return [-240, -560, 300, 12];
  },
  paint(c, p) {
    const n = p.frames ?? 16;
    const ph = ((p.frame ?? 0) / n) * TAU;
    const bob = Math.sin(ph * 2) * 4;
    const dark = P.lacquer;
    // --- legs: far pair first (darker), then the body, then the near pair
    const legs = [
      { hx: -112, off: Math.PI, far: true },
      { hx: 108, off: 0, far: true },
      { hx: -96, off: 0, far: false },
      { hx: 124, off: Math.PI, far: false },
    ];
    const drawLeg = (L: { hx: number; off: number; far: boolean }): void => {
      const a = ph + L.off;
      const stride = 46;
      const fx = L.hx + Math.sin(a) * stride;
      const lift = Math.max(0, Math.cos(a)) * 26;
      const hipY = -262 + bob;
      const footY = -lift + 6;
      const kx = (L.hx + fx) / 2 + (L.hx > 0 ? -14 : 18), ky = (hipY + footY) / 2 - 6;
      const col = (_t: number, u: number, x: number, y: number): number => {
        const base = L.far ? 0.62 : 0.3;
        return tone(dark, clamp(base + u * 0.35 + (u < 0.15 || u > 0.88 ? 0.25 : 0) + (hash(x, y, 7) - 0.5) * 0.08, 0, 1), x, y, 0.4);
      };
      thick(c, L.hx, hipY, kx, ky, 34, 24, col);
      thick(c, kx, ky, fx, footY, 24, 18, col);
      // a broad dark foot
      ellipse(c, fx + 4, footY - 4, 16, 7, (_u, _v, x, y) => tone(dark, L.far ? 0.8 : 0.55, x, y, 0.4));
    };
    for (const L of legs) if (L.far) drawLeg(L);

    // --- the body: white, shaggy, darker underneath; a fringe hangs from its belly
    const by = -322 + bob;
    ellipse(c, 0, by, 182, 98, (u, v, x, y) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const fur = vnoise(lx / 5, ly / 14, 3);
      let t = 0.1 + 0.42 * clamp((v + 0.6) / 1.6, 0, 1) + (fur - 0.5) * 0.3;
      if (u * u + v * v > 0.86) t += 0.25;
      return tone(P.paper, clamp(t, 0, 1), x, y, 0.5);
    });
    // fringe: ragged locks hanging below the belly
    for (let lx = -170; lx <= 170; lx += 3 / Math.max(0.25, c.d)) {
      const yTop = by + 98 * Math.sqrt(Math.max(0, 1 - (lx / 182) ** 2)) - 8;
      const len = 18 + 34 * vnoise(lx / 9, 1, 11) + 6 * Math.sin(ph + lx / 40);
      for (let ly = yTop; ly < yTop + len; ly += 1 / c.d) {
        const x = Math.round(c.X(lx + Math.sin((ly - yTop) / 9 + ph) * 2)), y = Math.round(c.Y(ly));
        c.buf.set(x, y, tone(P.paper, 0.45 + 0.4 * ((ly - yTop) / len), x, y, 0.5));
      }
    }
    // --- the ropes: two red sweeps along its side, gold knots, tassels
    const rope = (y0: number, sag: number): void => {
      for (let lx = -165; lx <= 160; lx += 1 / c.d) {
        const t = (lx + 165) / 325;
        const ly = y0 + Math.sin(t * Math.PI) * sag + bob;
        for (let k = 0; k < 3; k++) {
          const x = Math.round(c.X(lx)), y = Math.round(c.Y(ly + k));
          c.buf.set(x, y, k === 0 ? P.red[2]! : k === 1 ? P.red[3]! : P.red[4]!);
        }
      }
      for (const kx of [-110, -30, 50, 125]) {
        const t = (kx + 165) / 325;
        const ky = y0 + Math.sin(t * Math.PI) * sag + bob;
        ellipse(c, kx, ky + 2, 5, 5, (u, _v, _x, _y) => (u < -0.2 ? P.gold[1]! : P.gold[3]!));
        // a tassel swinging below the knot
        const sw = Math.sin(ph + kx / 30) * 4;
        thick(c, kx, ky + 6, kx + sw, ky + 40, 4, 9, (t1, u, x, y) => (t1 < 0.2 ? P.gold[2]! : tone(P.red, 0.3 + u * 0.5, x, y, 0.4)));
      }
    };
    rope(-372, 34);
    rope(-332, 28);

    // --- the head: long and low, white tendrils hanging from its face
    const hx = 222, hy = -318 + bob * 1.4;
    thick(c, 150, -340 + bob, hx - 20, hy, 80, 56, (_t, u, x, y) => tone(P.paper, clamp(0.15 + 0.5 * u + (vnoise(x / 4, y / 9, 5) - 0.5) * 0.3, 0, 1), x, y, 0.5));
    ellipse(c, hx, hy, 50, 36, (u, v, x, y) => tone(P.paper, clamp(0.1 + 0.35 * (v + 1) / 2 + (u > 0.7 ? 0.3 : 0), 0, 1), x, y, 0.5));
    // a dark eye and the red rope across its brow
    ellipse(c, hx + 22, hy - 8, 5, 4, () => P.ink[0]!);
    for (let lx = hx - 40; lx < hx + 40; lx += 1 / c.d) c.buf.set(Math.round(c.X(lx)), Math.round(c.Y(hy - 24 + (lx - hx) * 0.18)), P.red[3]!);
    for (let i = 0; i < 9; i++) {
      const tx = hx - 26 + i * 8 + (i % 2) * 2;
      const len = 90 + 60 * hash(i, 3, 9) + 20 * Math.sin(ph + i);
      const sway = Math.sin(ph * 1.5 + i * 0.7) * 10;
      thick(c, tx, hy + 22, tx + sway - 4, hy + 22 + len, 7, 3, (t, u, x, y) => tone(P.paper, clamp(0.2 + 0.4 * t + u * 0.25, 0, 1), x, y, 0.5));
    }

    // --- the pine on its back: a crooked trunk and flat tiered pads
    thick(c, -28, -410 + bob, -40, -460 + bob, 18, 14, (_t, u, x, y) => tone(P.timber, 0.45 + u * 0.4, x, y, 0.4));
    thick(c, -40, -460 + bob, -6, -510 + bob, 14, 9, (_t, u, x, y) => tone(P.timber, 0.45 + u * 0.4, x, y, 0.4));
    const pad = (cx: number, cy: number, rx: number, ry: number): void =>
      ellipse(c, cx, cy + bob, rx, ry, (u, v, x, y) => {
        const n1 = vnoise(c.lx(x + 0.5) / 6, c.ly(y + 0.5) / 4, 21);
        if (u * u + v * v > 0.7 && n1 < 0.35) return 0;
        return tone(P.pine, clamp(0.15 + 0.55 * (v + 1) / 2 + (n1 - 0.5) * 0.3, 0, 1), x, y, 0.5);
      });
    pad(-88, -468, 58, 17);
    pad(18, -496, 66, 19);
    pad(-26, -536, 44, 15);
    pad(-118, -432, 34, 11);

    for (const L of legs) if (!L.far) drawLeg(L);
    void bayer4;
  },
});

// The planes either side of the play plane: the near front (P5) with the hall's great near
// columns and the scale props at the frame's foot (a tea cart, a broom, a potted pine, scroll
// crates), and the back floor's clutter on P3 (benches, big jars, a tea table, an umbrella
// stand, potted plants, stacked crates) among which the hall's crowd stands. Readability (GDK
// A.3): nothing here is usable, P5 never sits on a service when she stands at it, the clutter
// stays low and behind.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, LitField, bevel, clamp, colBase, colLight, cyl, face, fbm, grain, hash, keep, lathe, mt, poly, rect, tn, type At } from "./kit.ts";

const H = 96;

// ---------------------------------------------------------------------------
// A near column (P5): huge, from below the frame to above it, a lit rim toward the light
// ---------------------------------------------------------------------------
export interface NearColP {
  /** Radius and how far up it is painted (px of the near plane). */
  r: number;
  h: number;
  at?: At;
}

export const nearCol = definePainter<NearColP>("hall.nearcol", {
  bounds(p) {
    return [-p.r * 1.5, -p.h, p.r * 1.5, 0.6 * H];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 16);
    const { k, side } = colLight(lf, 0, -6 * H, 0);
    colBase(c, 0, p.r, 0.8 * H, k * 0.8, side, 23);
    lathe(c, 0, -p.h, -0.8 * H, () => p.r, (X, Y, u, lx, ly) => {
      const hgt = -ly / H;
      const band = (hgt > 1.0 && hgt < 1.28) || (hgt > 7.1 && hgt < 7.3);
      // a near column in shadow: dark lacquer red, the edge toward the light catching it hard
      // (a two-pixel rim), a faint bounce on the far edge, the core darkest
      const us = u * side;
      const rim = us > 0.86 ? 0.55 : us > 0.74 ? 0.25 : 0;
      const bounce = us < -0.9 ? 0.12 : 0;
      const body = 0.18 + 0.22 * Math.max(0, us + 0.3);
      const n = (body + rim + bounce) * Math.min(1.2, 0.6 + k);
      if (band) return mt(M.gold, n * 1.1, X, Y, 0.2, 1);
      return mt(M.verm, n - grain(lx, ly, 5) * 0.04, X, Y, 0.3, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// Near props at the frame's foot (P5): drawn large, mostly cropped by the bottom edge
// ---------------------------------------------------------------------------
export interface NearPropP {
  kind: "teacart" | "broom" | "pine" | "crates" | "jar";
  s: number;
  at?: At;
}

export const nearProp = definePainter<NearPropP>("hall.nearprop", {
  bounds(p) {
    const s = p.s;
    return [-0.9 * H * s, -2.4 * H * s, 0.9 * H * s, 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const s = p.s;
    const side = clamp(lf.get(0, -H).dx * 1.6, -1, 1);
    const L = (lx: number, ly: number): number => lf.get(lx, ly).k;
    if (p.kind === "teacart") {
      // a lacquered tea cart: two shelves, spoked wheels, a teapot and cups on top
      const w = 0.75 * H * s, top = -0.82 * H * s;
      for (const wx of [-w * 0.75, w * 0.75]) {
        const wr = 0.2 * H * s;
        rect(c, wx - wr, -2 * wr, wx + wr, 0, (X, Y, lx, ly) => {
          const d = Math.hypot(lx - wx, ly + wr) / wr;
          if (d > 1) return 0;
          const spoke = d < 0.85 && Math.abs(Math.sin(Math.atan2(ly + wr, lx - wx) * 4)) < 0.15;
          return d > 0.82 || d < 0.18 || spoke ? mt(M.wood, face(L(lx, ly), side, (lx - wx) / wr, (ly + wr) / wr), X, Y, 0.25, 1) : 0;
        });
      }
      for (const sy of [top, top * 0.45]) rect(c, -w, sy, w, sy + 4 * s, (X, Y, lx, ly) => mt(M.lacq, face(L(lx, ly), side, 0, -0.6), X, Y, 0.1, 1));
      for (const px of [-w + 3, w - 7]) rect(c, px, top, px + 4 * s, -0.2 * H * s, (X, Y, lx, ly) => mt(M.lacq, face(L(lx, ly), side, -0.3, 0), X, Y, 0.1, 1));
      lathe(c, -0.15 * H * s, top - 0.32 * H * s, top, (ly) => {
        const t = (ly - top + 0.32 * H * s) / (0.32 * H * s);
        return 0.17 * H * s * Math.sin(Math.min(1, 0.25 + t) * Math.PI * 0.9);
      }, (X, Y, u, lx, ly) => (Math.sin(u * 5 + ly * 0.3) > 0.7 ? tn(P.blue, 0.5, X, Y, 0.3) : mt(M.paper, cyl(L(lx, ly), u, side), X, Y, 0.0, 0.8)));
      for (const cx of [0.15, 0.3]) lathe(c, cx * H * s, top - 0.13 * H * s, top, () => 0.055 * H * s, (X, Y, u, lx, ly) => mt(M.paper, cyl(L(lx, ly), u, side), X, Y, 0.0, 0.8));
    } else if (p.kind === "broom") {
      // a bamboo broom leaning, its head of twigs splayed on the floor
      const len = 1.9 * H * s;
      rect(c, -0.5 * H * s, -len, 0.5 * H * s, 0, (X, Y, lx, ly) => {
        const t = -ly / len;
        const axis = 0.28 * H * s * t;
        if (t > 0.2) return Math.abs(lx - axis) < 2 * s ? mt(M.wood, face(L(lx, ly), side, (lx - axis) / 2, 0), X, Y, 0.1, 1) : 0;
        const spread = (0.08 + (0.2 - t) * 1.2) * H * s;
        const twig = Math.abs(Math.sin((lx - axis) * 0.9 + t * 3)) < 0.5;
        return Math.abs(lx - axis) < spread && twig ? mt(M.wood, face(L(lx, ly), side) * 1.1, X, Y, 0.0, 0.7) : 0;
      });
      rect(c, -3 * s + 0.05 * H * s, -0.24 * H * s, 3 * s + 0.07 * H * s, -0.2 * H * s, (X, Y) => tn(M.verm, 0.4, X, Y, 0));
    } else if (p.kind === "pine") {
      // a potted pine: a glazed pot, a twisting trunk, cloud-shaped needle pads
      lathe(c, 0, -0.5 * H * s, 0, (ly) => (0.28 + 0.06 * Math.sin(((ly + 0.5 * H * s) / (0.5 * H * s)) * Math.PI)) * H * s, (X, Y, u, lx, ly) => mt(P.jade, cyl(L(lx, ly), u, side, 0.2) * 0.9, X, Y, 0.3, 1));
      rect(c, -0.32 * H * s, -0.52 * H * s, 0.32 * H * s, -0.46 * H * s, (X, Y, lx, ly) => mt(M.lacq, face(L(lx, ly), side, 0, -0.7), X, Y, 0.2, 1));
      for (let i = 0; i < 40; i++) {
        const t = i / 40;
        const tx = Math.sin(t * 5) * 0.15 * H * s, ty = -0.5 * H * s - t * 1.5 * H * s;
        rect(c, tx - 3 * s * (1 - t * 0.5), ty - 2, tx + 3 * s * (1 - t * 0.5), ty + 2, (X, Y, lx, ly) => mt(M.wood, face(L(lx, ly), side, (lx - tx) / 4, 0) * 0.8, X, Y, 0.3, 1));
      }
      for (const [px, py, pr] of [[-0.35, 1.35, 0.32], [0.3, 1.6, 0.36], [-0.05, 2.0, 0.3], [0.38, 1.05, 0.22]] as const) {
        const cx = px * H * s, cy = -py * H * s, rr = pr * H * s;
        rect(c, cx - rr, cy - rr * 0.6, cx + rr, cy + rr * 0.45, (X, Y, lx, ly) => {
          const q = Math.hypot((lx - cx) / rr, (ly - cy) / (rr * 0.55)) + (fbm(lx * 0.15, ly * 0.15, 9, 3) - 0.5) * 0.5;
          if (q > 1) return 0;
          const top = (ly - cy) / (rr * 0.55);
          return mt(P.pine, face(L(lx, ly), side, (lx - cx) / rr * 0.5, top * 0.8) * 0.9, X, Y, 0.2, 1);
        });
      }
    } else if (p.kind === "crates") {
      // scroll crates stacked: slatted boxes with rope handles and ends of rolled scrolls
      const bw = 0.62 * H * s, bh = 0.42 * H * s;
      const stack: [number, number][] = [[-bw * 0.6, 0], [bw * 0.45, 0], [-bw * 0.05, -bh]];
      for (const [bx, by] of stack) {
        rect(c, bx - bw / 2, by - bh, bx + bw / 2, by, (X, Y, lx, ly) => {
          const u = (lx - bx + bw / 2) / bw, v = (ly - by + bh) / bh;
          const [nx, ny] = bevel(u, v, 0.06, 0.08);
          const slat = ((v * 3) % 1) < 0.08;
          return mt(M.wood, face(L(lx, ly), side, nx, ny) * (slat ? 0.6 : 0.9) + grain(lx, ly, 3, false) * 0.1, X, Y, 0.25, 1);
        });
      }
    } else {
      // a big glazed storage jar with a cloth tied over its mouth
      lathe(c, 0, -1.1 * H * s, 0, (ly) => {
        const t = (ly + 1.1 * H * s) / (1.1 * H * s);
        return (t < 0.1 ? 0.2 : 0.22 + 0.24 * Math.sin(Math.min(1, (t - 0.05) * 1.1) * Math.PI)) * H * s;
      }, (X, Y, u, lx, ly) => {
        const t = (ly + 1.1 * H * s) / (1.1 * H * s);
        if (t < 0.12) return mt(M.paper, cyl(L(lx, ly), u, side) * 0.8, X, Y, 0.2, 1);
        return mt(M.lacq, cyl(L(lx, ly), u, side, 0.3), X, Y, 0.0, 1);
      });
    }
  },
});

// ---------------------------------------------------------------------------
// The back floor's clutter (P3): low furniture along the back wall, the crowd's ground
// ---------------------------------------------------------------------------
export interface ClutterP {
  kind: "bench" | "jars" | "teatable" | "umbrellas" | "plant" | "crates" | "brazier";
  /** Plane px per H. */
  u: number;
  at?: At;
}

export const clutter = definePainter<ClutterP>("hall.clutter", {
  bounds(p) {
    return [-1.4 * p.u, -2.2 * p.u, 1.4 * p.u, 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10, 0.85);
    const U = p.u;
    const side = clamp(lf.get(0, -U).dx * 1.6, -1, 1);
    const L = (lx: number, ly: number): number => lf.get(lx, ly).k;
    const shadow = (w: number): void => rect(c, -w, -2, w, 1, (X, Y) => (keep(X, Y, 0.6) ? P.umber[5]! : 0));
    if (p.kind === "bench") {
      shadow(1.2 * U);
      rect(c, -1.15 * U, -0.48 * U, 1.15 * U, -0.4 * U, (X, Y, lx, ly) => mt(M.wood, face(L(lx, ly), side, 0, ly < -0.46 * U ? -1 : 0.3), X, Y, 0.2, 1));
      for (const lx0 of [-1.0 * U, 0.88 * U]) rect(c, lx0, -0.4 * U, lx0 + 0.12 * U, 0, (X, Y, lx, ly) => mt(M.wood, face(L(lx, ly), side, -0.3, 0) * 0.8, X, Y, 0.3, 1));
      rect(c, -0.95 * U, -0.16 * U, 0.95 * U, -0.12 * U, (X, Y, lx, ly) => mt(M.wood, face(L(lx, ly), side) * 0.7, X, Y, 0.3, 1));
    } else if (p.kind === "jars") {
      shadow(1.0 * U);
      for (const [jx, jh, jr, gl] of [[-0.5, 1.0, 0.36, 0], [0.25, 0.75, 0.3, 1], [0.75, 0.55, 0.22, 0]] as const) {
        const cx = jx * U;
        lathe(c, cx, -jh * U, 0, (ly) => {
          const t = (ly + jh * U) / (jh * U);
          return (t < 0.12 ? jr * 0.55 : jr * (0.7 + 0.3 * Math.sin(Math.min(1, t * 1.05) * Math.PI))) * U;
        }, (X, Y, u, lx, ly) => mt(gl ? P.jade : M.lacq, cyl(L(lx, ly), u, side, 0.25), X, Y, gl ? 0.35 : 0.1, 1));
      }
    } else if (p.kind === "teatable") {
      shadow(1.3 * U);
      rect(c, -0.7 * U, -0.62 * U, 0.7 * U, -0.54 * U, (X, Y, lx, ly) => mt(M.lacq, face(L(lx, ly), side, 0, -0.7), X, Y, 0.1, 1));
      for (const lx0 of [-0.62 * U, 0.54 * U]) rect(c, lx0, -0.54 * U, lx0 + 0.08 * U, 0, (X, Y, lx, ly) => mt(M.lacq, face(L(lx, ly), side), X, Y, 0.1, 1));
      lathe(c, -0.2 * U, -0.9 * U, -0.62 * U, (ly) => 0.14 * U * Math.sin(Math.min(1, (ly + 0.95 * U) / (0.33 * U)) * Math.PI * 0.9), (X, Y, u, lx, ly) => mt(M.paper, cyl(L(lx, ly), u, side), X, Y, 0.1, 0.9));
      for (const cx of [0.15, 0.35]) lathe(c, cx * U, -0.72 * U, -0.62 * U, () => 0.05 * U, (X, Y, u, lx, ly) => mt(M.paper, cyl(L(lx, ly), u, side), X, Y, 0.1, 0.9));
      for (const sx of [-1.15, 1.05]) {
        rect(c, sx * U - 0.18 * U, -0.36 * U, sx * U + 0.18 * U, -0.3 * U, (X, Y, lx, ly) => mt(M.verm, face(L(lx, ly), side, 0, -0.6), X, Y, 0.2, 1));
        rect(c, sx * U - 0.12 * U, -0.3 * U, sx * U + 0.12 * U, 0, (X, Y, lx, ly) => mt(M.lacq, face(L(lx, ly), side), X, Y, 0.2, 1));
      }
    } else if (p.kind === "umbrellas") {
      shadow(0.5 * U);
      lathe(c, 0, -0.75 * U, 0, () => 0.3 * U, (X, Y, u, lx, ly) => mt(P.blue, cyl(L(lx, ly), u, side, 0.2) * 0.8, X, Y, 0.3, 1));
      for (const [ux, uh, col] of [[-0.12, 1.8, 0], [0.05, 1.6, 1], [0.18, 1.7, 2]] as const) {
        const ramp = col === 0 ? M.verm : col === 1 ? M.paper : P.moss;
        rect(c, ux * U - 0.06 * U, -uh * U, ux * U + 0.06 * U, -0.6 * U, (X, Y, lx, ly) => {
          const t = (ly + uh * U) / ((uh - 0.6) * U);
          const w = 0.06 * U * (0.4 + 0.6 * Math.min(1, t * 1.5));
          return Math.abs(lx - ux * U) < w ? mt(ramp, face(L(lx, ly), side, (lx - ux * U) / w, 0) * 0.85, X, Y, 0.25, 1) : 0;
        });
      }
    } else if (p.kind === "plant") {
      shadow(0.6 * U);
      lathe(c, 0, -0.55 * U, 0, (ly) => (0.32 - 0.06 * ((ly + 0.55 * U) / (0.55 * U))) * U, (X, Y, u, lx, ly) => mt(M.stone, cyl(L(lx, ly), u, side, 0.15), X, Y, 0.3, 1));
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.28;
        const len = (1.0 + 0.4 * hash(i, 1, 3)) * U;
        for (let t = 0; t < 1; t += 0.04) {
          const lx = Math.cos(a) * len * t + Math.sin(t * 3) * 3, ly = -0.55 * U + Math.sin(a) * len * t * (1 - 0.35 * t);
          const w = 0.07 * U * Math.sin(t * Math.PI);
          rect(c, lx - w, ly - 1, lx + w, ly + 1, (X, Y) => mt(P.moss, face(L(lx, ly), side, 0, -0.5) * 0.8, X, Y, 0.35, 1));
        }
      }
    } else if (p.kind === "crates") {
      shadow(1.0 * U);
      for (const [bx, by, bw, bh] of [[-0.45, 0, 0.8, 0.55], [0.45, 0, 0.7, 0.45], [-0.2, -0.55, 0.65, 0.4]] as const) {
        rect(c, (bx - bw / 2) * U, (by - bh) * U, (bx + bw / 2) * U, by * U, (X, Y, lx, ly) => {
          const u = (lx - (bx - bw / 2) * U) / (bw * U), v = (ly - (by - bh) * U) / (bh * U);
          const [nx, ny] = bevel(u, v, 0.05, 0.08);
          return mt(M.wood, face(L(lx, ly), side, nx, ny) * 0.85 + grain(lx, ly, 7, false) * 0.08, X, Y, 0.3, 1);
        });
      }
    } else {
      // a bronze brazier on three legs, embers glowing in it
      shadow(0.6 * U);
      for (const lx0 of [-0.42, 0, 0.38]) rect(c, lx0 * U, -0.4 * U, lx0 * U + 0.06 * U, 0, (X, Y, lx, ly) => mt(M.bronze, face(L(lx, ly), side), X, Y, 0.3, 1));
      lathe(c, 0, -0.75 * U, -0.38 * U, (ly) => 0.5 * U * Math.sin(Math.min(1, (ly + 0.8 * U) / (0.42 * U)) * Math.PI * 0.55 + 0.6), (X, Y, u, lx, ly) => mt(M.bronze, cyl(L(lx, ly), u, side, 0.25), X, Y, 0.15, 1));
      rect(c, -0.4 * U, -0.82 * U, 0.4 * U, -0.74 * U, (X, Y, lx) => (hash(Math.floor(lx), Y, 5) > 0.4 ? tn(M.glow, 0.1 + hash(X, Y, 7) * 0.4, X, Y, 0) : tn(M.dark, 0.6, X, Y, 0)));
    }
  },
});

export { poly };

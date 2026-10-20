// The Hall of Works' furniture, each piece with its own silhouette (GDK A.3's readability rule),
// traced from env-hall's furniture sheet and redrawn side-on in the hall's light: the Notice Wall
// under its little roof, the Crane Desk, the Request Board, the docs shelf and the nook's lamp, the
// frames the art hangs in, the shuttered Teahouse. Every piece stands on the walk line with a
// contact shadow, worn where hands and feet touch it. (Round 1: the register desk, the offering
// boxes, the sponsors' board, the map, the nook's bench and the gate moved to services.ts.)

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, SCREEN, LitField, bevel, clamp, cord, cyl, face, fbm, grain, hash, keep, lathe, mt, poly, rect, tn, vnoise, type At, type Ramp } from "./kit.ts";
import { lut, tint } from "./tint.ts";

const H = 96;

export interface FurnP {
  /** Width and height (px); the anchor is the left end on the floor (the walk line). */
  w: number;
  h: number;
  at?: At;
}

/** Light side for a piece (where its light comes from, -1 left .. 1 right). */
function sideOf(lf: LitField, x: number, y: number): number {
  return clamp(lf.get(x, y).dx * 1.6, -1, 1);
}

/** A soft contact shadow where a foot meets the floor (a little above and below the line). */
function contact(c: PaintCtx, x0: number, x1: number, strength = 0.7): void {
  const w = x1 - x0;
  rect(c, x0 - 4, -5, x1 + 4, 2, (X, Y, lx, ly) => {
    const u = (lx - x0) / w;
    const edge = clamp(Math.min(u + 0.06, 1.06 - u) * 8, 0, 1);
    const a = strength * edge * (ly > -2 ? 0.75 : 0.35);
    return keep(X, Y, a) ? P.umber[5]! : 0;
  });
}

/** A timber box face: wood with grain, bevelled edges lit toward the light. */
function woodBox(c: PaintCtx, lf: LitField, side: number, x0: number, y0: number, x1: number, y1: number, ramp: Ramp, seed: number, lo = 0.15, hi = 1, bev = 3): void {
  const w = x1 - x0, h = y1 - y0;
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const [nx, ny] = bevel((lx - x0) / w, (ly - y0) / h, bev / w, bev / h);
    return mt(ramp, face(l.k, side, nx, ny) + grain(lx, ly, seed, h > w) * 0.1, X, Y, lo, hi);
  });
}

/** A gold corner fitting (an L of gold with a rivet) at a box corner. */
function fitting(c: PaintCtx, lf: LitField, side: number, x: number, y: number, sx: number, sy: number, s = 7): void {
  rect(c, Math.min(x, x + sx * s), Math.min(y, y + sy * s), Math.max(x, x + sx * s), Math.max(y, y + sy * s), (X, Y, lx, ly) => {
    const dx = Math.abs(lx - x), dy = Math.abs(ly - y);
    if (dx > 2.4 && dy > 2.4) return 0;
    const l = lf.get(lx, ly);
    return mt(M.gold, face(l.k, side, sx * 0.3, sy * -0.3) * 1.05, X, Y, 0.0, 1);
  });
}

// ---------------------------------------------------------------------------
// The Notice Wall: a framed board on two posts with stone feet, a small tiled roof,
// proclamations pinned to it (the blog's posts), one curling at a corner
// ---------------------------------------------------------------------------
export const notice = definePainter<FurnP>("hall.notice", {
  bounds(p) {
    return [-0.4 * H, -p.h - 0.5 * H, p.w + 0.4 * H, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10);
    const side = sideOf(lf, p.w / 2, -p.h / 2);
    const W = p.w, Ht = p.h;
    const postW = 0.16 * H, foot = 0.28 * H;
    contact(c, -0.08 * H, W + 0.08 * H);
    // stone feet
    for (const fx of [0.08 * W, 0.92 * W]) {
      rect(c, fx - foot / 2 - 4, -foot * 0.75, fx + foot / 2 + 4, 0, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const [nx, ny] = bevel((lx - fx + foot / 2 + 4) / (foot + 8), (ly + foot * 0.75) / (foot * 0.75), 0.15, 0.15);
        return mt(M.stone, face(l.k, side, nx, ny) * 0.9 + (fbm(lx * 0.3, ly * 0.3, 5, 2) - 0.5) * 0.2, X, Y, 0.25, 1);
      });
      // the posts
      woodBox(c, lf, side, fx - postW / 2, -Ht + 0.1 * H, fx + postW / 2, -foot * 0.75, M.wood, 41, 0.35, 1, 3);
    }
    // the board's frame and the board (lacquer ground, the papers pinned on it)
    const bx0 = 0.03 * W, bx1 = 0.97 * W, by0 = -Ht + 0.32 * H, by1 = -0.95 * H;
    woodBox(c, lf, side, bx0, by0, bx1, by1, M.wood, 43, 0.3, 1, 4);
    rect(c, bx0 + 0.09 * H, by0 + 0.09 * H, bx1 - 0.09 * H, by1 - 0.09 * H, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      return mt(M.paper, face(l.k, side) * 0.55 - (vnoise(lx * 0.06, ly * 0.06, 9) > 0.7 ? 0.08 : 0), X, Y, 0.45, 1);
    });
    // the papers: sizes vary, a little crooked, pins at the top, script and seals on them
    const sheets: [number, number, number, number][] = [
      [0.06, 0.08, 0.3, 0.86], [0.39, 0.06, 0.24, 0.42], [0.66, 0.1, 0.27, 0.36], [0.41, 0.53, 0.27, 0.38], [0.71, 0.52, 0.22, 0.4],
    ];
    const iw = (bx1 - bx0) - 0.18 * H, ih = (by1 - by0) - 0.18 * H;
    sheets.forEach(([u0, v0, uw, vh], i) => {
      const sx0 = bx0 + 0.09 * H + u0 * iw, sy0 = by0 + 0.09 * H + v0 * ih;
      const sw = uw * iw, sh = vh * ih;
      const tilt = (hash(i, 1, 7) - 0.5) * 0.04;
      rect(c, sx0 - 3, sy0 - 3, sx0 + sw + 3, sy0 + sh + 3, (X, Y, lx, ly) => {
        const u = (lx - sx0) / sw, v = (ly - sy0 - (lx - sx0) * tilt) / sh;
        if (u < 0 || u > 1 || v < 0 || v > 1) {
          // a soft shadow below and to one side of the sheet
          const su = (lx - sx0 + side * 2) / sw, sv = (ly - sy0 - 2) / sh;
          return su > 0 && su < 1 && sv > 0 && sv < 1 && keep(X, Y, 0.5) ? P.umber[3]! : 0;
        }
        // a curled corner on the third sheet
        if (i === 2 && u > 0.82 && v > 0.84 && u + v > 1.74) return u + v > 1.8 ? 0 : mt(M.paper, 0.45, X, Y, 0.3, 1);
        const l = lf.get(lx, ly);
        const ink = i === 0
          ? (v > 0.42 && v < 0.92 && Math.abs(((u * 7) % 1) - 0.5) < 0.12 && hash(Math.floor(u * 7), Math.floor(v * 30), i) > 0.18)
          : (v > 0.22 && v < 0.82 && ((v * 9) % 1) < 0.28 && u > 0.12 && u < 0.88 - hash(Math.floor(v * 9), i, 3) * 0.3);
        const pic = i === 0 && v > 0.07 && v < 0.38 && u > 0.12 && u < 0.88 && (fbm(u * 6, v * 9, 3, 3) > 0.52 - (v - 0.07));
        const seal = Math.abs(u - 0.78) < 0.08 && Math.abs(v - 0.88) < 0.05;
        if (seal) return mt(M.verm, face(l.k, side) * 0.8, X, Y, 0.25, 1);
        if (ink || pic) return tn(M.ink, 0.2 + (pic ? 0.5 : 0), X, Y, 0.3);
        return mt(M.paper, face(l.k, side) * 1.05 - v * 0.08, X, Y, 0.0, 0.8);
      });
      // a brass pin at the top
      rect(c, sx0 + sw / 2 - 1.5, sy0 - 1.5, sx0 + sw / 2 + 1.5, sy0 + 1.5, (X, Y, lx, ly) => mt(M.gold, face(lf.get(lx, ly).k, side, 0, -1), X, Y, 0, 1));
    });
    // the roof: brackets, then a little roof of grey tiles with a gold ridge and upturned ends
    const ry = -Ht + 0.32 * H;
    for (const fx of [0.08 * W, 0.92 * W]) {
      poly(c, [fx - 0.35 * H, ry, fx + 0.35 * H, ry, fx + 0.1 * H, ry + 0.2 * H, fx - 0.1 * H, ry + 0.2 * H], (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, 0, 0.6) * 0.75, X, Y, 0.3, 1));
    }
    tileRoof(c, lf, side, -0.3 * H, W + 0.3 * H, ry, 0.46 * H, 77);
  },
});

/** A small tiled roof seen side-on: rows of round tiles, a gold ridge, ends turned up. */
export function tileRoof(c: PaintCtx, lf: LitField, side: number, x0: number, x1: number, eave: number, rh: number, seed: number): void {
  const cx = (x0 + x1) / 2, span = (x1 - x0) / 2;
  // the slope curves in toward the ridge; the eave tips curl up
  const half = (ly: number): number => {
    const t = (eave - ly) / rh; // 0 at the eave .. 1 at the ridge
    return span * (1 - 0.32 * Math.pow(t, 0.7));
  };
  rect(c, x0 - 8, eave - rh - 8, x1 + 8, eave + 6, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const t = (eave - ly) / rh;
    const d = Math.abs(lx - cx);
    if (t > 1.0 && t < 1.18 && d < half(eave - rh) + 2) {
      // the ridge: a gold-capped roll
      return mt(M.gold, face(l.k, side, 0, t > 1.12 ? -1 : 0.4) * 0.95, X, Y, 0.1, 1);
    }
    if (t < 0) {
      // the eave's edge: a dark fascia with round tile ends
      if (t > -0.12 && d < span + 2) {
        const k = (((lx - x0) % 9) + 9) % 9;
        return k < 6 ? mt(M.tile, face(l.k, side, 0, 0.3) * 0.75, X, Y, 0.2, 1) : mt(M.dark, 0.5, X, Y, 0.3, 1);
      }
      return 0;
    }
    if (t > 1) return 0;
    let hw = half(ly);
    // upturned ends: a curl near the eave
    if (t < 0.25) hw += (0.25 - t) * 0.35 * rh;
    if (d > hw) return 0;
    // tile courses: vertical rolls, darker gaps, catching the light on their rounded tops
    const k = ((((lx - x0) % 8) + 8) % 8) / 8;
    const roll = Math.sin(k * Math.PI);
    const course = (((t * rh) % 7) + 7) % 7 < 1.2;
    return mt(M.tile, face(l.k, side, (k - 0.5) * 1.4, -0.4) * (0.42 + 0.35 * roll) - (course ? 0.12 : 0) + (hash(Math.floor((lx - x0) / 8), Math.floor(t * rh / 7), seed) > 0.85 ? -0.1 : 0), X, Y, 0.1, 1);
  });
}

// ---------------------------------------------------------------------------
// The Crane Desk: a writing desk under the skylight, folded cranes on it, a cushioned stool
// ---------------------------------------------------------------------------
export const craneDesk = definePainter<FurnP>("hall.cranedesk", {
  bounds(p) {
    return [-0.5 * H, -p.h - 0.45 * H, p.w + 10, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const side = sideOf(lf, p.w / 2, -p.h / 2);
    const W = p.w, Ht = p.h;
    contact(c, 0, W, 0.7);
    // the stool, in front-left of the desk (on the walkway), a red cushion on it
    const sx0 = -0.42 * H, sx1 = 0.18 * H, sTop = -0.46 * H;
    contact(c, sx0, sx1, 0.5);
    for (const lx0 of [sx0 + 2, sx1 - 7]) woodBox(c, lf, side, lx0, sTop + 4, lx0 + 5, 0, M.wood, 3, 0.3, 1, 1);
    rect(c, sx0 + 3, -0.18 * H, sx1 - 3, -0.18 * H + 3, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side), X, Y, 0.3, 1));
    woodBox(c, lf, side, sx0, sTop, sx1, sTop + 5, M.wood, 5, 0.2, 1, 1);
    rect(c, sx0 + 1, sTop - 7, sx1 - 1, sTop, (X, Y, lx, ly) => {
      const v = (ly - sTop + 7) / 7;
      return mt(M.verm, face(lf.get(lx, ly).k, side, 0, v < 0.4 ? -0.8 : 0.2) * 0.95 + (Math.sin(lx * 0.9) > 0.8 ? 0.08 : 0), X, Y, 0.1, 1);
    });
    // the desk: legs, an apron with a drawer and a gold pull, the top
    const top = -Ht;
    for (const lx0 of [4, W - 12]) woodBox(c, lf, side, lx0, top + 8, lx0 + 8, 0, M.wood, 7, 0.15, 1, 2);
    woodBox(c, lf, side, 2, top + 6, W - 2, top + 22, M.wood, 9, 0.2, 1, 2);
    rect(c, W * 0.3, top + 9, W * 0.7, top + 19, (X, Y, lx, ly) => {
      const u = (lx - W * 0.3) / (W * 0.4), v = (ly - top - 9) / 10;
      const [nx, ny] = bevel(u, v, 0.05, 0.15);
      return mt(M.wood, face(lf.get(lx, ly).k, side, nx, ny) * 0.85, X, Y, 0.2, 1);
    });
    rect(c, W / 2 - 3, top + 13, W / 2 + 3, top + 15, (X, Y) => tn(M.gold, 0.3, X, Y, 0));
    woodBox(c, lf, side, -4, top, W + 4, top + 7, M.wood, 11, 0.05, 1, 2);
    for (const [fx, sx] of [[-4, 1], [W + 4, -1]] as const) fitting(c, lf, side, fx, top, sx, 1, 6);
    // on it: a sheet half written, an inkstone, the brush in its pot, and three cranes
    rect(c, W * 0.38, top - 2, W * 0.78, top, (X, Y, lx, ly) => mt(M.paper, face(lf.get(lx, ly).k, side, 0, -1), X, Y, 0, 0.7));
    woodBox(c, lf, side, W * 0.82, top - 5, W * 0.95, top, M.lacq, 2, 0.1, 1, 1);
    lathe(c, W * 0.9, top - 14, top - 5, () => 3.2, (X, Y, u, _lx, ly) => mt(M.lacq, cyl(lf.get(W * 0.9, ly).k, u, side, 0.2), X, Y, 0.0, 1));
    rect(c, W * 0.9 - 0.5, top - 30, W * 0.9 + 1, top - 14, (X, Y, lx, ly) => (ly < top - 25 ? tn(M.ink, 0.1, X, Y, 0) : mt(M.wood, face(lf.get(lx, ly).k, side), X, Y, 0.1, 1)));
    const cranes: [number, number, boolean][] = [[0.12, 0, true], [0.27, 0, false], [0.6, 0, false]];
    cranes.forEach(([u, , red], i) => crane(c, lf, side, W * u, top - 2, 1 + (i === 1 ? 0.15 : 0), red, i === 2));
  },
});

/** A folded paper crane, side-on: body, raised wings, the neck and tail points. */
export function crane(c: PaintCtx, lf: LitField, side: number, x: number, y: number, s: number, red: boolean, flip: boolean): void {
  const f = flip ? -1 : 1;
  const pts = [
    x - 9 * s * f, y - 6 * s, // tail tip
    x - 3 * s * f, y - 2 * s,
    x - 5 * s * f, y - 13 * s, // back wing tip
    x + 0 * s * f, y - 3 * s,
    x + 4 * s * f, y - 11 * s, // front wing tip
    x + 3 * s * f, y - 2 * s,
    x + 10 * s * f, y - 9 * s, // neck and head
    x + 8 * s * f, y - 1 * s,
    x - 2 * s * f, y,
  ];
  poly(c, pts, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const fold = Math.abs((lx - x) * f) < 1 || (ly < y - 4 * s && Math.abs((lx - x) * f - 2 * s) < 1);
    const v = (y - ly) / (13 * s);
    const lit = face(l.k, side, 0, -v) * (fold ? 0.75 : 1);
    return red ? mt(M.verm, lit, X, Y, 0.1, 1) : mt(M.paper, lit * 1.05, X, Y, 0, 0.8);
  });
}

// ---------------------------------------------------------------------------
// The Request Board: a slatted board on two posts, brass hooks, one slip pinned
// ---------------------------------------------------------------------------
export const reqBoard = definePainter<FurnP>("hall.reqboard", {
  bounds(p) {
    return [-10, -p.h - 14, p.w + 10, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10);
    const side = sideOf(lf, p.w / 2, -p.h / 2);
    const W = p.w, Ht = p.h;
    contact(c, 0, W, 0.6);
    for (const fx of [0.1 * W, 0.9 * W]) {
      woodBox(c, lf, side, fx - 0.16 * H, -0.22 * H, fx + 0.16 * H, 0, M.stone, 3, 0.25, 1, 3);
      woodBox(c, lf, side, fx - 0.07 * H, -Ht * 0.62, fx + 0.07 * H, -0.22 * H, M.wood, 5, 0.3, 1, 2);
    }
    const by0 = -Ht, by1 = -Ht * 0.36;
    woodBox(c, lf, side, 0, by0, W, by1, M.wood, 7, 0.25, 1, 4);
    rect(c, 6, by0 + 8, W - 6, by1 - 6, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const k = ((lx - 6) % 13 + 13) % 13;
      const gap = k < 1.4;
      return mt(M.wood, face(Math.max(l.k, 0.45), side, k < 3 ? -0.4 : k > 11 ? 0.4 : 0) * (gap ? 0.45 : 1.0) + grain(lx, ly, 9) * 0.1, X, Y, 0.15, 1);
    });
    // a cap rail with gold ends
    woodBox(c, lf, side, -6, by0 - 7, W + 6, by0, M.wood, 11, 0.2, 1, 2);
    for (const kx of [-6, W + 6]) fitting(c, lf, side, kx, by0 - 7, kx < 0 ? 1 : -1, 1, 6);
    // brass hooks, all empty but one
    const n = 5;
    for (let i = 0; i < n; i++) {
      const hx = 12 + i * ((W - 24) / (n - 1)), hy = by0 + 16;
      rect(c, hx - 1.5, hy - 2, hx + 1.5, hy + 6, (X, Y, lx, ly) => mt(M.gold, face(lf.get(lx, ly).k, side, 0, -0.5), X, Y, 0, 1));
      rect(c, hx - 1, hy + 5, hx + 3, hy + 7, (X, Y) => tn(M.gold, 0.4, X, Y, 0));
    }
    // the one slip ("requests open later"), hung on the middle hook, gently curled
    const sx = W / 2, sy0 = by0 + 22, sw = 0.34 * H, sh = 0.62 * H;
    rect(c, sx - sw / 2, sy0, sx + sw / 2 + 2, sy0 + sh + 2, (X, Y, lx, ly) => {
      const u = (lx - sx + sw / 2) / sw, v = (ly - sy0) / sh;
      if (u > 1 || v > 1) return keep(X, Y, 0.5) && u < 1.08 && v < 1.04 ? P.umber[3]! : 0;
      const l = lf.get(lx, ly);
      const line = v > 0.25 && v < 0.85 && Math.abs(((u * 3) % 1) - 0.5) < 0.1 && u > 0.3 && u < 0.75;
      if (line) return tn(M.ink, 0.3, X, Y, 0.2);
      return mt(M.paper, face(l.k, side, (u - 0.5) * 0.6, 0) * 1.0, X, Y, 0, 0.8);
    });
  },
});

// ---------------------------------------------------------------------------
// The docs shelf: tall shelves of books (one prominent row per product), scroll boxes,
// rolled scrolls, two drawers at the foot; and the nook's floor lamp
// ---------------------------------------------------------------------------
export const shelf = definePainter<FurnP>("hall.shelf", {
  bounds(p) {
    return [-10, -p.h - 20, p.w + 10, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10);
    const side = sideOf(lf, p.w / 2, -p.h / 2);
    const W = p.w, Ht = p.h;
    contact(c, -4, W + 4, 0.8);
    // the carcass: sides, a crown with a carved crest, a plinth
    woodBox(c, lf, side, 0, -Ht, W, 0, M.wood, 13, 0.35, 1, 4);
    poly(c, [-6, -Ht, W + 6, -Ht, W - 10, -Ht - 12, W / 2 + 10, -Ht - 18, W / 2 - 10, -Ht - 18, 10, -Ht - 12], (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, 0, -0.5) * 0.9, X, Y, 0.3, 1));
    rect(c, W / 2 - 6, -Ht - 15, W / 2 + 6, -Ht - 4, (X, Y, lx, ly) => (Math.hypot(lx - W / 2, ly + Ht + 9.5) < 5.5 ? mt(M.gold, face(lf.get(lx, ly).k, side), X, Y, 0.1, 1) : 0));
    const inner0 = 7, inner1 = W - 7;
    const shelves = 4;
    const drawerTop = -0.62 * H;
    const sh = (Ht - 10 + drawerTop) / shelves;
    const spines: Ramp[] = [M.verm, P.blue, P.moss, M.paper, M.lacq, P.jade];
    for (let s = 0; s < shelves; s++) {
      const y0 = -Ht + 8 + s * sh, y1 = y0 + sh;
      // the back of the shelf in shadow
      rect(c, inner0, y0, inner1, y1 - 4, (X, Y, lx, ly) => mt(M.lacq, face(lf.get(lx, ly).k, side) * 0.25, X, Y, 0.3, 1));
      // the shelf board's lit front edge
      rect(c, inner0 - 2, y1 - 4, inner1 + 2, y1, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, 0, ly < y1 - 3 ? -1 : 0.4), X, Y, 0.15, 1));
      // what stands on it
      let x = inner0 + 2;
      let k = 0;
      while (x < inner1 - 4) {
        const r = hash(s, k, 31);
        if (s === 2 && k > 2 && k < 7) {
          // rolled scrolls lying stacked
          const rr = 3.4;
          for (let j = 0; j < 3; j++) {
            const cy = y1 - 4 - rr - j * rr * 1.8, cx2 = x + rr + (j % 2) * rr;
            rect(c, cx2 - rr - 6, cy - rr, cx2 + rr, cy + rr, (X, Y, lx, ly) => {
              const d = Math.hypot(lx - cx2, ly - cy) / rr;
              if (lx < cx2 && Math.abs(ly - cy) < rr * 0.95) return mt(M.paper, face(lf.get(lx, ly).k, side, 0, (ly - cy) / rr) * 0.75, X, Y, 0.1, 1);
              if (d > 1) return 0;
              return d < 0.4 ? mt(M.wood, 0.3, X, Y, 0.3, 1) : mt(M.paper, face(lf.get(lx, ly).k, side, (lx - cx2) / rr, (ly - cy) / rr) * 0.9, X, Y, 0.1, 1);
            });
          }
          x += rr * 4;
          k = 7;
          continue;
        }
        if (r < 0.12) {
          // a lacquer document box, gold clasp
          const bw = 18, bh = sh * 0.38;
          woodBox(c, lf, side, x, y1 - 4 - bh, x + bw, y1 - 4, M.lacq, 3 + k, 0.1, 1, 2);
          rect(c, x + bw / 2 - 2, y1 - 4 - bh * 0.6, x + bw / 2 + 2, y1 - 4 - bh * 0.4, (X, Y) => tn(M.gold, 0.25, X, Y, 0));
          x += bw + 2;
        } else {
          // a book: a cloth spine, gold bands, a title slip; leaning a little sometimes
          const bw = 5 + Math.floor(hash(k, s, 33) * 5);
          const bh = sh * (0.62 + 0.3 * hash(k, s, 35));
          const ramp = spines[Math.floor(hash(s * 7, k, 37) * spines.length)]!;
          rect(c, x, y1 - 4 - bh, x + bw - 1, y1 - 4, (X, Y, lx, ly) => {
            const u = (lx - x) / (bw - 1), v = (ly - (y1 - 4 - bh)) / bh;
            const l = lf.get(lx, ly);
            if (v < 0.07 || v > 0.93 || Math.abs(v - 0.2) < 0.03) return mt(M.gold, face(l.k, side, (u - 0.5), 0) * 0.85, X, Y, 0.2, 1);
            if (Math.abs(u - 0.5) < 0.3 && v > 0.3 && v < 0.5) return mt(M.paper, face(l.k, side) * 0.7, X, Y, 0.1, 1);
            return mt(ramp, cyl(l.k, (u - 0.5) * 1.6, side) * 0.85, X, Y, 0.2, 1);
          });
          x += bw;
        }
        k++;
      }
    }
    // two drawers with brass pulls at the foot
    for (let i = 0; i < 2; i++) {
      const a = inner0 + i * (inner1 - inner0) / 2 + 1, b = a + (inner1 - inner0) / 2 - 2;
      woodBox(c, lf, side, a, drawerTop + 2, b, -6, M.wood, 51 + i, 0.25, 1, 2);
      rect(c, (a + b) / 2 - 4, (drawerTop - 4) / 2 - 1, (a + b) / 2 + 4, (drawerTop - 4) / 2 + 2, (X, Y, lx, ly) => mt(M.gold, face(lf.get(lx, ly).k, side, 0, -0.5), X, Y, 0.05, 1));
    }
    for (const [fx, fy, sx, sy] of [[0, -Ht, 1, 1], [W, -Ht, -1, 1], [0, 0, 1, -1], [W, 0, -1, -1]] as const) fitting(c, lf, side, fx, fy, sx, sy, 7);
  },
});

/** The nook's standing lamp: a lacquer post on a foot, a lit paper box at the top. */
export const lamp = definePainter<FurnP>("hall.lamp", {
  bounds(p) {
    return [-p.w * 1.8, -p.h - 8, p.w * 1.8, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const W = p.w, Ht = p.h;
    const side = sideOf(lf, 0, -Ht / 2);
    contact(c, -W * 0.5, W * 0.5, 0.6);
    // (hall loop round 1) its light is painted where it lands (hall-light.ts), not as a dither disc
    woodBox(c, lf, side, -W * 0.45, -6, W * 0.45, 0, M.lacq, 3, 0.1, 1, 2);
    lathe(c, 0, -Ht + W * 1.4, -6, () => 2.5, (X, Y, u, _lx, ly) => mt(M.lacq, cyl(lf.get(0, ly).k, u, side, 0.2), X, Y, 0.0, 1));
    // the shade: a lacquer frame with a lattice over glowing paper
    const s0 = -Ht, s1 = -Ht + W * 1.5;
    rect(c, -W / 2, s0, W / 2, s1, (X, Y, lx, ly) => {
      const u = lx / W + 0.5, v = (ly - s0) / (s1 - s0);
      if (u < 0.1 || u > 0.9 || v < 0.08 || v > 0.92) return mt(M.lacq, 0.45, X, Y, 0.1, 1);
      const lat = Math.abs(u - 0.5) < 0.05 || Math.abs(v - 0.5) < 0.04 || (Math.abs(Math.abs(u - 0.5) - 0.22) < 0.04 && Math.abs(v - 0.5) < 0.22);
      if (lat) return tn(M.wood, 0.55, X, Y, 0);
      return tn(SCREEN, clamp(0.05 + Math.hypot(u - 0.5, v - 0.55) * 0.9, 0, 1), X, Y, 0.5);
    });
    rect(c, -W / 2 - 2, s0 - 4, W / 2 + 2, s0, (X, Y) => tn(M.lacq, 0.4, X, Y, 0));
  },
});

// ---------------------------------------------------------------------------
// Frames for the art: lacquer and gold mouldings round the picture (a sprite in the middle),
// hung on a cord from a nail (on a wall) or from a display stand's rail (upstairs)
// ---------------------------------------------------------------------------
export interface FrameP {
  /** The picture's size (px): the frame's inner opening. Anchor: the picture's bottom centre. */
  w: number;
  h: number;
  /** "wall": a nail and a cord; "stand": a display stand on the floor `floor` px below. */
  mount: "wall" | "stand";
  floor?: number;
  at?: At;
}

export const frame = definePainter<FrameP>("hall.frame", {
  bounds(p) {
    const m = 12;
    // (hall loop round 1) a wall-hung frame's lamp pool reaches 0.7 H round it
    const wall = p.mount === "stand" ? 0 : 0.75 * H;
    const below = p.mount === "stand" ? (p.floor ?? 0) + 6 : m + 0.65 * H;
    return [-p.w / 2 - m - Math.max(14, wall), -p.h - m - Math.max(0.55 * H, 0.65 * H), p.w / 2 + m + Math.max(14, wall), below];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const side = sideOf(lf, 0, -p.h / 2);
    const m = 10;
    const x0 = -p.w / 2 - m, x1 = p.w / 2 + m, y0 = -p.h - m, y1 = m;
    if (p.mount === "stand") {
      // the display stand: two lacquer posts on feet, a top rail with gold knobs, a low brace
      const fl = p.floor ?? 0;
      const sx0 = x0 - 9, sx1 = x1 + 9;
      contact(c, sx0 - 10, sx1 + 10, 0.55);
      for (const fx of [sx0, sx1]) {
        lathe(c, fx, y0 - 0.32 * H, fl - 5, () => 3.4, (X, Y, u, _lx, ly) => mt(M.lacq, cyl(lf.get(fx, ly).k, u, side, 0.18), X, Y, 0.0, 1));
        woodBox(c, lf, side, fx - 0.2 * H, fl - 6, fx + 0.2 * H, fl, M.lacq, 3, 0.05, 1, 2);
        rect(c, fx - 3, fl - 8, fx + 3, fl - 5, (X, Y) => tn(M.gold, 0.3, X, Y, 0));
      }
      woodBox(c, lf, side, sx0 - 5, y0 - 0.32 * H - 5, sx1 + 5, y0 - 0.32 * H + 2, M.lacq, 5, 0.05, 1, 2);
      for (const kx of [sx0 - 7, sx1 + 7]) lathe(c, kx, y0 - 0.32 * H - 8, y0 - 0.32 * H + 4, () => 3.5, (X, Y, u, _lx, ly) => mt(M.gold, cyl(lf.get(kx, ly).k, u, side), X, Y, 0.05, 1));
      woodBox(c, lf, side, sx0, fl - 0.42 * H, sx1, fl - 0.42 * H + 4, M.lacq, 7, 0.05, 1, 1);
      // two cords from the rail to the frame's top corners (a little splay)
      cord(c, sx0 + 6, y0 - 0.32 * H + 2, x0 + 8, y0 + 2, 0, P.red[4]!);
      cord(c, sx1 - 6, y0 - 0.32 * H + 2, x1 - 8, y0 + 2, 0, P.red[4]!);
      // tassels hanging off the frame's bottom corners
      for (const tx of [x0 + 3, x1 - 3]) rect(c, tx - 1, y1, tx + 1, y1 + 14, (X, Y, _lx, ly) => (ly > y1 + 8 ? tn(M.verm, 0.45, X, Y, 0) : tn(M.verm, 0.3, X, Y, 0)));
    } else {
      // (hall loop round 1) the picture lamp's pool on the wall round the frame, in two bands, and
      // the frame's cast shadow on the wall, down and away from the lamp: both re-colour the wall
      const warm1 = lut("warm", 1), warm2 = lut("warm", 2), dark = lut("night", 2);
      // (hall loop round 2, W2-6: the pool was a round disc) the hood points down at the picture: its light is a
      // cone from the hood's mouth, brightest just under it, widening and fading down over the frame and the wall
      // under it, its sides soft; nothing over the hood (it shades the wall above)
      const hy0 = y0 - 0.2 * H + 4, hw0 = Math.min(0.32 * H, p.w * 0.22);
      const reach = y1 - hy0 + 0.45 * H;
      tint(c, x0 - 0.7 * H, hy0, x1 + 0.7 * H, y1 + 0.6 * H, (_X, _Y, lx, ly) => {
        const down = (ly - hy0) / reach;
        if (down < 0 || down > 1) return null;
        const half = hw0 + (ly - hy0) * 0.62;
        const u = Math.abs(lx) / half;
        const q = (1 - u * u) * (1 - down) ** 1.3 + (vnoise(lx * 0.06, ly * 0.06, 17) - 0.5) * 0.08;
        return q > 0.42 ? warm2 : q > 0.12 ? warm1 : null;
      });
      tint(c, x0 + 3, y0 + 5, x1 + 5, y1 + 6, (_X, _Y, lx, ly) => (lx > x1 || ly > y1 ? dark : null));
      // a nail and a cord
      cord(c, x0 + 10, y0 + 2, 0, y0 - 0.28 * H, 0, P.red[4]!);
      cord(c, x1 - 10, y0 + 2, 0, y0 - 0.28 * H, 0, P.red[4]!);
      rect(c, -2, y0 - 0.28 * H - 3, 2, y0 - 0.28 * H + 1, (X, Y) => tn(M.gold, 0.3, X, Y, 0));
    }
    // the moulding: dark lacquer, a gold bead inside and out; (hall loop round 1) with depth: the
    // picture lamp above lights its top member and the inner lip of its bottom member, the top
    // member's inner lip stays dark (its shadow falls across the picture's top rows, made with it)
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      if (lx > -p.w / 2 && lx < p.w / 2 && ly > -p.h && ly < 0) return 0;
      const l = lf.get(lx, ly);
      const e = Math.min(lx - x0, x1 - lx, ly - y0, y1 - ly);
      const nx = lx - x0 < m ? -0.7 : x1 - lx < m ? 0.7 : 0;
      const ny = ly - y0 < m ? -0.7 : y1 - ly < m ? 0.7 : 0;
      const lamp = ly - y0 < m ? 0.16 : ly > -p.h && y1 - ly < m ? 0.06 : 0;
      if (e < 1.5) return mt(M.lacq, face(l.k, side, nx, ny) * 0.5 + lamp * 0.5, X, Y, 0.1, 1);
      if (e > m - 2.5) {
        // the inner bead: dark under the top member, lit along the bottom lip
        const lip = ly > -2.5 ? 0.32 : ly < -p.h + 2.5 ? -0.3 : 0;
        return mt(M.gold, face(l.k, side, nx, ny) * 0.9 + lip, X, Y, 0.05, 1);
      }
      if (e < 3.5) return mt(M.gold, face(l.k, side, nx, ny) * 1.0 + lamp, X, Y, 0.05, 1);
      return mt(M.lacq, face(l.k, side, nx * 0.6, ny * 0.6) * 0.75 + lamp, X, Y, 0.0, 1);
    });
    // the picture lamp: a small brass hood on a curved arm over the frame's top, its mouth glowing
    const hw = Math.min(0.32 * H, p.w * 0.22), hy = y0 - 0.2 * H;
    rect(c, -1, hy, 1, y0, (X, Y) => tn(M.bronze, 0.55, X, Y, 0));
    rect(c, -1, hy - 2, 5, hy, (X, Y) => tn(M.bronze, 0.45, X, Y, 0));
    rect(c, -hw, hy - 1, hw, hy + 4, (X, Y, lx, ly) => {
      const u = lx / hw;
      if (Math.abs(u) > 1 - (hy + 4 - ly) * 0.04) return 0;
      if (ly > hy + 2.6) return tn(P.ember, 0.0, X, Y, 0);
      return mt(M.bronze, face(lf.get(lx, ly).k, side, u * 0.6, -0.8) * (ly < hy + 0.6 ? 1.1 : 0.8), X, Y, 0.0, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// The Teahouse, upstairs: a shopfront shuttered for now (it opens with the forums), its
// noren rolled up and tied, a blank signboard, two unlit lanterns, a small tiled eave
// ---------------------------------------------------------------------------
export const teahouse = definePainter<FurnP>("hall.teahouse", {
  bounds(p) {
    return [-0.5 * H, -p.h - 0.9 * H, p.w + 0.5 * H, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10);
    const side = sideOf(lf, p.w / 2, -p.h / 2);
    const W = p.w, Ht = p.h;
    contact(c, -0.2 * H, W + 0.2 * H, 0.6);
    // the posts and the lintel of the shopfront
    for (const fx of [-0.12 * H, W - 0.04 * H]) woodBox(c, lf, side, fx, -Ht, fx + 0.16 * H, 0, M.wood, 3, 0.3, 1, 2);
    woodBox(c, lf, side, -0.25 * H, -Ht - 0.22 * H, W + 0.25 * H, -Ht, M.wood, 5, 0.25, 1, 3);
    // the shutters: vertical boards, latched with an iron bar across, a paper notice on them
    rect(c, 0.04 * H, -Ht, W - 0.04 * H, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const k = (((lx - 0.04 * H) % (0.24 * H)) + 0.24 * H) % (0.24 * H);
      const seam = k < 1.4;
      const v = (ly + Ht) / Ht;
      if (Math.abs(v - 0.52) < 0.03) return mt(M.dark, face(l.k, side, 0, -0.5) * 0.6, X, Y, 0.3, 1);
      return mt(M.wood, face(l.k, side, k < 3 ? -0.4 : 0) * (seam ? 0.45 : 0.8) + grain(lx, ly, 7) * 0.12 - (v > 0.9 ? 0.1 : 0), X, Y, 0.3, 1);
    });
    // the notice pasted on the shutters (closed for now), torn at a corner
    const nx0 = W * 0.36, nx1 = W * 0.64, ny0 = -Ht * 0.86, ny1 = -Ht * 0.6;
    rect(c, nx0, ny0, nx1, ny1, (X, Y, lx, ly) => {
      const u = (lx - nx0) / (nx1 - nx0), v = (ly - ny0) / (ny1 - ny0);
      if (u > 0.85 && v > 0.8 && u + v > 1.7) return 0;
      const line = v > 0.2 && v < 0.8 && Math.abs(((u * 2.6) % 1) - 0.5) < 0.12 && u > 0.2 && u < 0.8;
      return line ? tn(M.ink, 0.3, X, Y, 0.2) : mt(M.paper, face(lf.get(lx, ly).k, side) * 1.0, X, Y, 0, 0.8);
    });
    // the noren, rolled up under the lintel and tied, its blue cloth showing
    rect(c, 0, -Ht + 2, W, -Ht + 0.2 * H, (X, Y, lx, ly) => {
      const v = (ly + Ht - 2) / (0.2 * H - 2);
      return tn(P.blue, clamp(0.45 + (v - 0.5) * 0.7 - face(lf.get(lx, ly).k, side, 0, (v - 0.5) * 1.6) * 0.3, 0, 1), X, Y, 0.4);
    });
    for (const tx of [W * 0.2, W * 0.8]) rect(c, tx - 1.5, -Ht, tx + 1.5, -Ht + 0.24 * H, (X, Y) => tn(M.verm, 0.4, X, Y, 0));
    // the signboard over it (blank lacquer with a gold rim: no name until it opens)
    woodBox(c, lf, side, W * 0.18, -Ht - 0.62 * H, W * 0.82, -Ht - 0.26 * H, M.lacq, 9, 0.05, 1, 3);
    rect(c, W * 0.18 + 3, -Ht - 0.62 * H + 3, W * 0.82 - 3, -Ht - 0.26 * H - 3, (X, Y, lx, ly) => {
      const e = Math.min(lx - W * 0.18 - 3, W * 0.82 - 3 - lx, ly + Ht + 0.62 * H - 3, -Ht - 0.26 * H - 3 - ly);
      return e < 1.5 ? mt(M.gold, face(lf.get(lx, ly).k, side) * 0.85, X, Y, 0.15, 1) : 0;
    });
    // a short tiled eave
    tileRoof(c, lf, side, -0.4 * H, W + 0.4 * H, -Ht - 0.22 * H, 0.42 * H, 91);
    // two lanterns, unlit, hanging at the ends of the eave
    for (const lxp of [-0.18 * H, W + 0.18 * H]) {
      cord(c, lxp, -Ht - 0.2 * H, lxp, -Ht + 0.05 * H, 0, P.umber[4]!);
      lathe(c, lxp, -Ht + 0.05 * H, -Ht + 0.4 * H, (ly) => 0.12 * H * Math.sin(((ly + Ht - 0.05 * H) / (0.35 * H)) * Math.PI) + 2, (X, Y, u, _lx, ly) => mt(M.verm, cyl(lf.get(lxp, ly).k, u, side) * 0.55, X, Y, 0.3, 1));
    }
  },
});

export { fbm };

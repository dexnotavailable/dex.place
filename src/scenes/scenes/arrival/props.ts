// Near props for the arrival, sized in P (the locked player height): the dock,
// its posts, the lantern post, a rope coil and a mooring cleat. Pixel data, not
// images: shade + ramp per texel, lit live by sceneLight() (the lantern, the
// shaft) like everything else.

import { Pix, hashInt } from "../../engine/index.ts";
import type { Geo } from "./geo.ts";

export function dockPosts(g: Geo): number[] {
  const out: number[] = [];
  const step = Math.round(g.P * 0.55);
  for (let px = g.dockEnd - Math.max(2, Math.round(g.P * 0.05)); px > -g.W; px -= step) out.push(px);
  return out.reverse();
}

export function buildDock(pix: Pix, g: Geo, x0: number, wood: number, lamp: number, iron: number, posts: number[], o: { lantern?: boolean } = {}): void {
  const X = (x: number): number => x - x0;
  const { deck, wl, P } = g;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const start = -g.W;
  const th = n(0.1);
  const board = n(0.1);
  // deck: a lit top edge, a second row catching some light, the fascia with board ends
  for (let x = start; x <= g.dockEnd; x++) {
    const b = Math.floor((x + 4096) / board);
    const sh = 0.27 + (hashInt(b, 1, 9) - 0.5) * 0.1;
    const worn = hashInt(b, 2, 9) < 0.18;
    for (let y = deck; y < deck + th; y++) {
      const dy = y - deck;
      let s = dy === 0 ? (worn ? 0.7 : 0.88) : dy === 1 ? 0.5 : sh - dy * 0.03;
      if ((x + 4096) % board === 0 && dy > 0) s -= 0.12;
      // nail heads on the fascia
      if (dy === Math.floor(th / 2) + 1 && (x + 4096) % board === 2) s += 0.12;
      pix.set(X(x), y, s, wood);
    }
    // stringer and its shadow under the planks
    for (let k = 0; k < n(0.04); k++) pix.set(X(x), deck + th + k, 0.12 - k * 0.03, wood);
  }
  // posts into the water: lit left edge, dark core, a wet band and weed at the waterline
  const pw = n(0.06);
  for (const px of posts) {
    for (let y = deck + th; y <= wl + 1; y++)
      for (let k = 0; k < pw; k++) {
        const wet = y > wl - n(0.06);
        pix.set(X(px + k), y, (k === 0 ? 0.3 : 0.13) - (wet ? 0.07 : 0), wood);
      }
    // cross brace to the next post
    const by = deck + th + n(0.12);
    for (let k = 0; k < n(0.18); k++) pix.set(X(px + pw + k), by + Math.round(k * 0.7), 0.16, wood);
  }
  const ep = g.dockEnd - pw;
  if (o.lantern !== false) lanternPost(pix, g, X, ep, pw, wood, lamp, iron);
  // a coil of rope on the deck, for scale
  const cx = g.dockEnd - n(0.4);
  const cw = n(0.13);
  for (let k = 0; k < cw; k++) {
    pix.set(X(cx + k), deck - 1, k === 0 || k === cw - 1 ? 0.3 : 0.44, wood);
    if (k > 0 && k < cw - 1) pix.set(X(cx + k), deck - 2, k % 3 === 1 ? 0.55 : 0.4, wood);
  }
  // a mooring cleat further back
  const cl = g.dockEnd - n(1.4);
  for (let k = -2; k <= 2; k++) pix.set(X(cl + k), deck - 2, Math.abs(k) === 2 ? 0.32 : 0.42, iron);
  pix.set(X(cl), deck - 1, 0.25, iron);
}

/** The end post rising above the deck with the lantern on its arm (the /scenes/ composition). */
function lanternPost(pix: Pix, g: Geo, X: (x: number) => number, ep: number, pw: number, wood: number, lamp: number, iron: number): void {
  const { deck, P } = g;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const [lx, ly] = g.lantern;
  for (let y = ly - n(0.06); y < deck; y++) for (let k = 0; k < pw; k++) pix.set(X(ep + k), y, k === 0 ? 0.38 : 0.15, wood);
  // post cap
  pix.rect(X(ep - 1), ly - n(0.08), pw + 2, n(0.03), { row: wood, shade: 0.42 });
  // arm (iron) and hook
  const armY = ly - n(0.03);
  for (let x = lx - 1; x <= ep; x++) pix.set(X(x), armY, 0.36, iron);
  pix.set(X(lx), armY + 1, 0.3, iron);
  // lantern: cap, cage with a lit core, base
  const lw = n(0.09) | 1;
  const lh = n(0.12);
  const lx0 = lx - (lw >> 1);
  const ly0 = armY + 2;
  pix.rect(X(lx0 - 1), ly0, lw + 2, 1, { row: iron, shade: 0.4 });
  pix.rect(X(lx0), ly0 + 1, lw, lh, { row: iron, shade: 0.18 });
  pix.rect(X(lx0 + 1), ly0 + 2, lw - 2, lh - 2, { row: lamp, shade: 0.8, emissive: true });
  pix.rect(X(lx0 + (lw >> 1)), ly0 + 2 + ((lh - 2) >> 1), 1, 2, { row: lamp, shade: 1, emissive: true });
  pix.rect(X(lx0 - 1), ly0 + lh + 1, lw + 2, 1, { row: iron, shade: 0.3 });
}

/**
 * The world's dock room (A1) past the lantern bend: the older boardwalk 0.2 P lower and
 * partly awash, running to the foot of the right-hand cliff at the room's right end; the
 * muted red line on the boards from just right of the player to that end; the cliff foot.
 * Layer x maps to room x + span / 2 (the room's right end is layer W + span / 2).
 */
export function buildWorldDock(pix: Pix, g: Geo, x0: number, span: number, rows: { wood: number; red: number; rock: number }): void {
  const X = (x: number): number => x - x0;
  const { deck, wl, P, W } = g;
  const { wood, red, rock } = rows;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const end = Math.round(W + span / 2);
  const bw = deck + n(0.2);
  const th = n(0.07);
  const plank = n(0.1);
  const from = g.dockEnd + 1;
  // a step block at the bend, half way down
  for (let x = from; x < from + n(0.3); x++) for (let y = deck + n(0.1); y < bw + th; y++) pix.set(X(x), y, y === deck + n(0.1) ? 0.62 : 0.2, wood);
  // the boardwalk: older, greyer boards, some sections awash (dark, wet, a glint on top)
  for (let x = from; x <= end + 8; x++) {
    const b = Math.floor((x + 4096) / plank);
    const grp = Math.floor((x + 4096) / (plank * 5));
    const awash = hashInt(grp, 3, 17) < 0.3;
    const missing = !awash && hashInt(b, 4, 17) < 0.05 && x > from + n(1.5);
    if (missing) continue;
    const sh = 0.22 + (hashInt(b, 1, 17) - 0.5) * 0.08;
    for (let y = bw; y < bw + th; y++) {
      const dy = y - bw;
      let s = dy === 0 ? (awash ? 0.34 : hashInt(b, 2, 17) < 0.2 ? 0.46 : 0.6) : dy === 1 ? (awash ? 0.18 : 0.36) : sh - dy * 0.03 - (awash ? 0.06 : 0);
      if ((x + 4096) % plank === 0 && dy > 0) s -= 0.1;
      pix.set(X(x), y, Math.max(0.04, s), wood);
    }
    if (awash && hashInt(x, 6, 17) < 0.12) pix.set(X(x), bw - 1, 0.5, wood);
    for (let k = 0; k < n(0.03); k++) pix.set(X(x), bw + th + k, 0.1, wood);
  }
  // old posts: short, some leaning, some broken off above the boards
  const step = n(0.9);
  for (let px = from + n(0.4); px < end; px += step + Math.round((hashInt(px, 7, 17) - 0.5) * n(0.2))) {
    const w = n(0.07);
    const tall = hashInt(px, 8, 17) < 0.35;
    const top = tall ? bw - n(0.12 + hashInt(px, 9, 17) * 0.1) : bw + th;
    const lean = hashInt(px, 10, 17) < 0.3 ? 1 : 0;
    for (let y = top; y <= wl + 1; y++)
      for (let k = 0; k < w; k++) {
        const wet = y > wl - n(0.06);
        const xx = px + k + (lean && y < bw ? Math.round((bw - y) * 0.15) : 0);
        pix.set(X(xx), y, (k === 0 ? 0.28 : 0.12) - (wet ? 0.06 : 0) + (y === top && tall ? 0.12 : 0), wood);
      }
  }
  // the muted red line: along the top of the boards from just right of the player to the
  // room's end, worn in places (the only hint to go right)
  const r0 = g.figX + n(0.35);
  for (let x = r0; x <= end + 8; x++) {
    const top = x <= g.dockEnd ? deck : x < from + n(0.3) ? deck + n(0.1) : bw;
    if (!pix.solid(X(x), top)) continue;
    const wear = hashInt(Math.floor(x / 3), 11, 17);
    if (wear < 0.08) continue;
    pix.set(X(x), top, wear < 0.2 ? 0.45 : 0.72, red);
    if (x > g.dockEnd && wear > 0.3) pix.set(X(x), top + 1, 0.3, red);
  }
  // the cliff foot the boardwalk runs into: dark rock rising out of the water at the end
  const c = Math.max(1, Math.round(g.u));
  const rise = (x: number): number => {
    const t = (x - (end - n(0.6))) / n(2.6);
    if (t < 0) return 1e9;
    const k = Math.min(1, t);
    return Math.round(wl + 2 - (wl + 2 - (bw - n(1.9))) * Math.pow(k, 0.6) - (hashInt(Math.floor(x / (3 * c)), 12, 17) - 0.5) * n(0.12));
  };
  for (let x = end - n(0.6); x <= end + n(2.2); x += c) {
    const top = rise(x);
    if (top > wl + 1) continue;
    for (let y = top; y <= wl + 2; y += c) {
      const edge = y - top < c * 2;
      const lit = x - (end - n(0.6)) < n(0.5) || edge;
      const s = (edge ? 0.5 : lit ? 0.32 : 0.14) + (hashInt(Math.floor(x / (4 * c)), Math.floor(y / (3 * c)), 13) - 0.5) * 0.08;
      for (let a = 0; a < c; a++) for (let b = 0; b < c; b++) pix.set(X(x + a), y + b, s, rock);
    }
  }
}

/** Posts under Pier's End (A0): from the pier's end on the left to the room's right end. */
export function pierPosts(g: Geo, span: number): number[] {
  const out: number[] = [];
  const step = Math.round(g.P * 0.55);
  const start = Math.round(-span / 2 + g.P * 1.0);
  for (let px = start + 2; px < g.W + span / 2 + step; px += step) out.push(px);
  return out;
}

/** Pier's End (A0): the pier's last boards on the left with its end posts, running on to the right. */
export function buildPier(pix: Pix, g: Geo, x0: number, span: number, wood: number, iron: number, posts: number[]): void {
  const X = (x: number): number => x - x0;
  const { deck, wl, P, W } = g;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const start = Math.round(-span / 2 + P * 1.0);
  const end = Math.round(W + span / 2 + 8);
  const th = n(0.1);
  const board = n(0.1);
  for (let x = start; x <= end; x++) {
    const b = Math.floor((x + 4096) / board);
    const sh = 0.27 + (hashInt(b, 1, 9) - 0.5) * 0.1;
    const worn = hashInt(b, 2, 9) < 0.18;
    for (let y = deck; y < deck + th; y++) {
      const dy = y - deck;
      let s = dy === 0 ? (worn ? 0.7 : 0.86) : dy === 1 ? 0.5 : sh - dy * 0.03;
      if ((x + 4096) % board === 0 && dy > 0) s -= 0.12;
      if (dy === Math.floor(th / 2) + 1 && (x + 4096) % board === 2) s += 0.12;
      pix.set(X(x), y, s, wood);
    }
    for (let k = 0; k < n(0.04); k++) pix.set(X(x), deck + th + k, 0.12 - k * 0.03, wood);
  }
  const pw = n(0.06);
  for (const px of posts) {
    for (let y = deck + th; y <= wl + 1; y++)
      for (let k = 0; k < pw; k++) {
        const wet = y > wl - n(0.06);
        pix.set(X(px + k), y, (k === 0 ? 0.3 : 0.13) - (wet ? 0.07 : 0), wood);
      }
    const by = deck + th + n(0.12);
    for (let k = 0; k < n(0.18); k++) pix.set(X(px + pw + k), by + Math.round(k * 0.7), 0.16, wood);
  }
  // the pier's end: two thick end posts rising above the boards, a chain between them
  for (const ex of [start, start + n(0.5)]) {
    const w = n(0.1);
    for (let y = deck - n(0.42); y <= wl + 1; y++)
      for (let k = 0; k < w; k++) pix.set(X(ex + k), y, (k === 0 ? 0.36 : k === w - 1 ? 0.1 : 0.18) - (y > wl - n(0.06) ? 0.07 : 0), wood);
    pix.rect(X(ex - 1), deck - n(0.45), w + 2, n(0.04), { row: wood, shade: 0.46 });
  }
  const cy = deck - n(0.3);
  for (let x = start + n(0.1); x < start + n(0.5); x++) {
    const t = (x - start - n(0.1)) / n(0.4);
    pix.set(X(x), cy + Math.round(Math.sin(t * Math.PI) * n(0.08)), (x & 1) === 0 ? 0.4 : 0.26, iron);
  }
}

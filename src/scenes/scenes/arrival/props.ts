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

export function buildDock(pix: Pix, g: Geo, x0: number, wood: number, lamp: number, iron: number, posts: number[], o: { lantern?: boolean; moss?: number } = {}): void {
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
    if (o.moss !== undefined) for (let k = -1; k <= pw; k++) for (let y = wl - n(0.04); y <= wl; y++) if (hashInt(px + k, y, 25) < 0.7) pix.set(X(px + k), y, 0.35 + hashInt(px + k, y, 26) * 0.2, o.moss);
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
 * partly awash, running to the foot of the cliff stair's rock at the room's right end; the
 * muted red line on the boards from just right of the player to that end; the rock foot.
 * Layer x maps to room x + span / 2 (the room's right end is layer W + span / 2).
 * Region lane a: the boardwalk is a real structure now (boards on a stringer, pilings with a
 * wet band and weed at the waterline, X braces between them), and it runs into bedded rock in
 * the cliff stair's own stone (A2's foot) instead of a pile of chunks.
 */
export function buildWorldDock(pix: Pix, g: Geo, x0: number, span: number, rows: { wood: number; red: number; rock: number; crag?: number; moss?: number; leaf?: number }): void {
  const X = (x: number): number => x - x0;
  const { deck, wl, P, W } = g;
  const { wood, red } = rows;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const end = Math.round(W + span / 2);
  const bw = deck + n(0.2);
  const th = n(0.12);
  const plank = n(0.1);
  const from = g.dockEnd + 1;
  // the rock foot at the end: rising out of the water behind the boardwalk's last boards to a
  // ledge level with the cliff stair's foot, then up the cliff beyond the room's end
  if (rows.crag !== undefined) {
    const r0 = end - n(2.6);
    const ledge = bw - n(0.2);
    const top = (lx: number): number => {
      const x = lx + x0;
      if (x < r0 || x > end + n(3)) return 1e9;
      if (x < end) {
        // a low shelf out of the water first, then the rock steps up behind the last boards
        const t = (x - r0) / (end - r0);
        const k = t < 0.45 ? (t / 0.45) * 0.35 : 0.35 + ((t - 0.45) / 0.55) ** 0.7 * 0.65;
        return Math.round(wl + 2 - (wl + 2 - (ledge - n(0.35))) * k + (hashInt(Math.floor(x / 5), 1, 23) - 0.5) * 3 * (1 - k));
      }
      return Math.round(ledge - n(0.35) - Math.max(0, x - end) * 0.95);
    };
    paintStrataInto(pix, top, wl + 3, rows.crag, rows.moss);
    // the water against the rock: a wet, dark band
    for (let lx = X(r0); lx < X(end + n(3)); lx++) for (let y = wl - n(0.08); y <= wl + 2; y++) if (pix.solid(lx, y)) pix.set(lx, y, 0.06, rows.crag);
    if (rows.leaf !== undefined) {
      for (let x = r0 + n(0.5); x < end + n(2); x += 7 + Math.round(hashInt(x, 2, 24) * 9)) {
        const t = top(X(x));
        if (t >= 1e8 || hashInt(x, 3, 24) < 0.35) continue;
        const hh = 4 + Math.round(hashInt(x, 4, 24) * 7);
        for (let k = 0; k < 5; k++) {
          const bx = X(x) + k - 2, bh = Math.max(2, hh - Math.abs(k - 2) * 2);
          for (let j = 0; j < bh; j++) pix.set(bx + (j > bh / 2 && k > 2 ? 1 : 0), t - 1 - j, j === bh - 1 ? 0.84 : 0.4 + j * 0.05, rows.leaf);
        }
      }
    }
  }
  // a step block at the bend, half way down
  for (let x = from; x < from + n(0.3); x++) for (let y = deck + n(0.1); y < bw + th; y++) pix.set(X(x), y, y === deck + n(0.1) ? 0.62 : x === from ? 0.36 : 0.2, wood);
  // pilings: under every few boards, down into the water, with a wet band and weed at the waterline
  const step = n(0.9);
  const piles: number[] = [];
  for (let px = from + n(0.4); px < end; px += step + Math.round((hashInt(px, 7, 17) - 0.5) * n(0.2))) piles.push(px);
  const pw = n(0.07);
  for (const [i, px] of piles.entries()) {
    const tall = hashInt(px, 8, 17) < 0.3;
    const top = tall ? bw - n(0.12 + hashInt(px, 9, 17) * 0.1) : bw + th;
    for (let y = top; y <= wl + 1; y++)
      for (let k = 0; k < pw; k++) {
        const wet = y > wl - n(0.1);
        let sh = k === 0 ? 0.36 : k === pw - 1 ? 0.08 : 0.16;
        if (wet) sh -= 0.07;
        if (y === top && tall) sh += 0.16;
        pix.set(X(px + k), y, sh, wood);
      }
    // weed at the waterline
    if (rows.moss !== undefined) for (let k = -1; k <= pw; k++) for (let y = wl - n(0.04); y <= wl; y++) if (hashInt(px + k, y, 25) < 0.7) pix.set(X(px + k), y, 0.35 + hashInt(px + k, y, 26) * 0.2, rows.moss);
    // an X brace to the next piling, under the boards, above the water
    const nx = piles[i + 1];
    if (nx !== undefined && hashInt(px, 11, 17) < 0.6) {
      const y0 = bw + th + 1, y1 = wl - n(0.06);
      for (let k = 0; k <= nx - px - pw; k++) {
        const f = k / Math.max(1, nx - px - pw);
        const ya = Math.round(y0 + (y1 - y0) * f), yb = Math.round(y1 - (y1 - y0) * f);
        pix.set(X(px + pw + k), ya, 0.2, wood);
        if (hashInt(px, 12, 17) < 0.5) pix.set(X(px + pw + k), yb, 0.14, wood);
      }
    }
  }
  // the boardwalk: older, greyer boards on a stringer, some sections awash (dark, wet, a glint on top)
  for (let x = from; x <= end + 8; x++) {
    const bb = Math.floor((x + 4096) / plank);
    const grp = Math.floor((x + 4096) / (plank * 5));
    const awash = hashInt(grp, 3, 17) < 0.3;
    const missing = !awash && hashInt(bb, 4, 17) < 0.05 && x > from + n(1.5);
    const tone = (hashInt(bb, 1, 17) - 0.5) * 0.1;
    if (!missing) {
      for (let y = bw; y < bw + th; y++) {
        const dy = y - bw;
        let s2 = dy === 0 ? (awash ? 0.36 : hashInt(bb, 2, 17) < 0.2 ? 0.5 : 0.66) : dy === 1 ? (awash ? 0.2 : 0.44) : 0.27 + tone - dy * 0.018 - (awash ? 0.07 : 0);
        if ((x + 4096) % plank === 0 && dy > 0) s2 -= 0.12;
        if (dy === th - 3) s2 -= 0.04;
        pix.set(X(x), y, Math.max(0.04, s2), wood);
      }
      if (awash && hashInt(x, 6, 17) < 0.12) pix.set(X(x), bw - 1, 0.5, wood);
    }
    // the stringer under the boards (it runs on where a board is missing)
    for (let k = 0; k < n(0.05); k++) pix.set(X(x), bw + th + k, k === 0 ? 0.2 : 0.1, wood);
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
  void rows.rock;
}

/** Bedded rock under a profile (a small local twin of near.ts paintStrata, for the dock's rock foot). */
function paintStrataInto(pix: Pix, top: (x: number) => number, bottom: number, row: number, moss?: number): void {
  for (let x = 0; x < pix.w; x++) {
    const t = top(x);
    if (t >= 1e8) continue;
    for (let y = Math.max(0, t); y < Math.min(pix.h, bottom); y++) {
      const yb = y + x * -0.05;
      const bed = Math.floor(yb / 13);
      const tb = yb - bed * 13;
      const blk = Math.floor((x + hashInt(bed, 1, 27) * 60) / 46);
      let sh = 0.42 + (hashInt(blk, bed, 28) - 0.5) * 0.16 + (hashInt(blk, bed, 29) - 0.4) * 0.12;
      if (tb < 1.5) sh += 0.16;
      if (tb > 11.5) sh -= 0.18;
      if (y - t < 2) sh = Math.max(sh, 0.6);
      const c = hashInt(x >> 1, y >> 1, 30);
      if (c > 0.94) sh += 0.06;
      else if (c < 0.05) sh -= 0.07;
      if (moss !== undefined && tb < 1.5 && hashInt(x, y, 31) < 0.25) {
        pix.set(x, y, 0.35, moss);
        continue;
      }
      pix.set(x, y, sh - Math.min(0.2, (y - t) * 0.004), row);
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
export function buildPier(pix: Pix, g: Geo, x0: number, span: number, wood: number, iron: number, posts: number[], moss?: number): void {
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
    if (moss !== undefined) for (let k = -1; k <= pw; k++) for (let y = wl - n(0.04); y <= wl; y++) if (hashInt(px + k, y, 25) < 0.7) pix.set(X(px + k), y, 0.35 + hashInt(px + k, y, 26) * 0.2, moss);
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

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

export function buildDock(pix: Pix, g: Geo, x0: number, wood: number, lamp: number, iron: number, posts: number[]): void {
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
  // the end post rises above the deck and carries the lantern on an arm
  const ep = g.dockEnd - pw;
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

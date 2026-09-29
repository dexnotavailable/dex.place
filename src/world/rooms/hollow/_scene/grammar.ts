// Silhouette grammars for the Hollow's near backdrop layers (the market's
// stacked houses and shopfronts, the parapet over the drop, the archive's
// stacks, the lift foot's tiles). Written like amber-hollow's near.ts: Pix
// data (shade, ramp row, emissive windows), chunky, dark, lit by rims and the
// scene's live light. Coordinates are layer px (ox: the buffer's left edge).

import { Pix, fbm1, hashInt, mulberry } from "../../../../scenes/engine/index.ts";

export type Put = (x: number, y: number, s: number, row?: number, emis?: boolean) => void;

export function putter(pix: Pix, ox: number, oy: number, row: number): Put {
  return (x, y, s, r = row, emis = false) => pix.set(Math.round(x - ox), Math.round(y - oy), emis ? 0.9 : s, r, 0, emis);
}

export interface StackOpts {
  /** Layer x range to fill, the ground line (layer y) and how far down to keep filling. */
  x0: number;
  x1: number;
  ground: number;
  bottom: number;
  /** Rooftop heights above the ground, min..max px. */
  minH: number;
  maxH: number;
  /** Block widths, px. */
  minW: number;
  maxW: number;
  /** Window size and grid, px. */
  win: number;
  seed: number;
  row: number;
  /** Emissive rows for windows (warm), doors, signs. */
  wins: number[];
  door: number;
  signs: number[];
  /** Cloth rows for awnings and laundry. */
  cloth: number[];
  /** 0..1: how many windows are lit. */
  lit: number;
  /** Base shade (darker = further forward in the dark). */
  shade: number;
  /** Where the light comes from (layer x): edges facing it get a rim. */
  lightX: number;
}

/**
 * Stacked market houses: boxes on boxes, each a little offset, with lit
 * lips, shuttered shopfronts at the bottom, window rows, balconies, pipes
 * down the walls, awnings, laundry between neighbours, a sign now and then.
 * Returns the tops (x, y) for chimneys and cables.
 */
export function stacks(pix: Pix, ox: number, oy: number, o: StackOpts): [number, number][] {
  const put = putter(pix, ox, oy, o.row);
  const r = mulberry(o.seed);
  const tops: [number, number][] = [];
  let x = o.x0;
  let prevTop = o.ground - o.minH;
  while (x < o.x1) {
    const w = Math.round(o.minW + r() * (o.maxW - o.minW));
    const total = Math.round(o.minH + Math.pow(r(), 1.4) * (o.maxH - o.minH));
    // a house is 2..4 storeys of boxes, each set back or cantilevered a little
    let y1 = o.ground;
    let bx = x;
    let bw = w;
    const storeys = 2 + Math.floor(r() * 3);
    const sh0 = o.shade + (r() - 0.5) * 0.04;
    for (let k = 0; k < storeys && y1 > o.ground - total; k++) {
      const sth = Math.round(Math.min(y1 - (o.ground - total), (total / storeys) * (0.8 + r() * 0.4)));
      if (sth < o.win * 3) break;
      const y0 = y1 - sth;
      const facing = bx + bw / 2 < o.lightX ? 1 : -1;
      for (let yy = y0; yy < (k === 0 ? o.bottom : y1); yy++)
        for (let xx = bx; xx < bx + bw; xx++) {
          let s = sh0 + (hashInt(Math.floor(xx / 6), Math.floor(yy / 5), o.seed + k) - 0.5) * 0.03;
          // planks / panels
          if ((xx - bx) % Math.max(8, Math.round(o.win * 3)) === 0) s -= 0.03;
          // rim toward the light, a lit lip on top
          if ((facing > 0 && xx === bx + bw - 1) || (facing < 0 && xx === bx)) s += 0.1;
          if (yy === y0) s += 0.22;
          else if (yy === y0 + 1) s += 0.08;
          else if (yy === y0 + 2) s -= 0.04;
          put(xx, yy, s);
        }
      // windows: a row or two per storey, grouped, some lit
      const wy0 = y0 + Math.round(sth * 0.3);
      const rows = sth > o.win * 7 ? 2 : 1;
      for (let rr = 0; rr < rows; rr++) {
        const wy = wy0 + rr * o.win * 3;
        if (wy + o.win > y1 - 2) break;
        for (let wx = bx + o.win; wx + o.win < bx + bw - o.win; wx += o.win * 3) {
          const lit = hashInt(wx, wy, o.seed + 11) < o.lit;
          const row = o.wins[Math.floor(hashInt(wx, wy, o.seed + 3) * o.wins.length)]!;
          for (let yy = wy; yy < wy + o.win; yy++)
            for (let xx = wx; xx < wx + o.win; xx++) {
              if (lit) put(xx, yy, 0.9, row, true);
              else put(xx, yy, sh0 - 0.06);
            }
          // sill
          for (let xx = wx - 1; xx < wx + o.win + 1; xx++) put(xx, wy + o.win, sh0 + 0.1);
          // a shutter half closed on some
          if (lit && hashInt(wx, wy, o.seed + 5) < 0.3) for (let yy = wy; yy < wy + Math.floor(o.win / 2); yy++) for (let xx = wx; xx < wx + o.win; xx++) put(xx, yy, sh0 - 0.02);
        }
      }
      // a balcony rail on upper storeys
      if (k > 0 && r() < 0.45) {
        const by = y1 - 1;
        const bx0 = bx - 4, bx1 = bx + Math.round(bw * (0.4 + r() * 0.4));
        for (let xx = bx0; xx < bx1; xx++) {
          put(xx, by, sh0 + 0.16);
          put(xx, by - 7, sh0 + 0.12);
          if ((xx - bx0) % 4 === 0) for (let yy = by - 7; yy < by; yy++) put(xx, yy, sh0 + 0.05);
        }
      }
      // storey 0: a shopfront (shutter, or a lit doorway), an awning
      if (k === 0) {
        const fw = Math.round(bw * (0.5 + r() * 0.3));
        const fx = bx + Math.round((bw - fw) * r());
        const fh = Math.min(sth - 6, Math.round(o.win * 6));
        const open = r() < 0.4;
        for (let yy = o.ground - fh; yy < o.ground; yy++)
          for (let xx = fx; xx < fx + fw; xx++) {
            const dx0 = fx + Math.round(fw * 0.3), dw = Math.max(o.win * 2, Math.round(fw * 0.22));
            if (open && xx >= dx0 && xx < dx0 + dw && yy > o.ground - fh + 4) put(xx, yy, 0.9, o.door, true);
            else put(xx, yy, sh0 - 0.04 + ((yy - (o.ground - fh)) % 3 === 0 ? 0.05 : 0));
          }
        if (r() < 0.6) {
          const cloth = o.cloth[Math.floor(r() * o.cloth.length)]!;
          const ay = o.ground - fh - 2;
          const ad = Math.round(o.win * 2.5);
          for (let xx = fx - 3; xx < fx + fw + 3; xx++)
            for (let yy = 0; yy < ad; yy++) {
              const stripe = Math.floor((xx - fx) / 5) % 2 === 0;
              put(xx, ay - ad + yy + Math.round((yy / ad) * 2), 0.2 + (yy === 0 ? 0.14 : 0) + (stripe ? 0.08 : 0) - (yy / ad) * 0.08, cloth);
            }
          // scalloped hem
          for (let xx = fx - 3; xx < fx + fw + 3; xx++) if ((xx - fx) % 5 < 3) put(xx, ay + 2, 0.18, cloth);
        }
      }
      // a sign board glowing on the wall now and then
      if (r() < 0.22 && o.signs.length) {
        const row = o.signs[Math.floor(r() * o.signs.length)]!;
        const sx = bx + Math.round(bw * (0.15 + r() * 0.5));
        const sy = y0 + Math.round(sth * 0.2);
        const vertical = r() < 0.5;
        const sw = vertical ? o.win + 2 : o.win * 5, shh = vertical ? o.win * 5 : o.win + 2;
        for (let yy = sy; yy < sy + shh; yy++)
          for (let xx = sx; xx < sx + sw; xx++) {
            const edge = xx === sx || yy === sy || xx === sx + sw - 1 || yy === sy + shh - 1;
            const glyph = hashInt(Math.floor((xx - sx) / 2), Math.floor((yy - sy) / 2), o.seed + sx) < 0.55;
            if (edge || glyph) put(xx, yy, 0.9, row, true);
            else put(xx, yy, 0.05);
          }
      }
      tops.push([bx + bw / 2, y0]);
      // next storey: set back or cantilevered
      const nw = Math.round(bw * (0.6 + r() * 0.5));
      bx += Math.round((bw - nw) * r());
      bw = Math.max(o.win * 6, nw);
      y1 = y0;
    }
    // a pipe down the wall
    if (r() < 0.5) {
      const px = x + Math.round(w * r());
      for (let yy = y1; yy < o.ground; yy++) {
        put(px, yy, o.shade + 0.14);
        put(px + 1, yy, o.shade + 0.04);
        if ((yy - y1) % 23 === 0) (put(px - 1, yy, o.shade + 0.12), put(px + 2, yy, o.shade + 0.02));
      }
    }
    // laundry or a cable to the previous house
    if (tops.length > 1 && r() < 0.55) {
      const [ax, ay] = [x - 2, Math.max(prevTop, y1) + 12];
      const bx2 = x + Math.round(w * 0.6);
      const sag = 6 + r() * 10;
      const cloth = o.cloth[Math.floor(r() * o.cloth.length)]!;
      for (let xx = ax - 30; xx < bx2; xx++) {
        const t = (xx - (ax - 30)) / (bx2 - ax + 30);
        const yy = Math.round(ay + sag * 4 * t * (1 - t));
        put(xx, yy, o.shade + 0.1);
        if ((xx - ax) % 9 === 0 && r() < 0.7) for (let k = 1; k < 6 + Math.floor(r() * 5); k++) for (let q = 0; q < 4; q++) put(xx + q, yy + k, 0.22 + (k === 1 ? 0.1 : 0), cloth);
      }
    }
    prevTop = y1;
    x += w + Math.round(r() * 6);
  }
  return tops;
}

/**
 * A parapet over the drop: a stone coping wall, a rail above it, posts. The
 * street ends here; the hollow opens beyond.
 */
export function parapet(pix: Pix, ox: number, oy: number, o: { x0: number; x1: number; top: number; bottom: number; row: number; seed: number }): void {
  const put = putter(pix, ox, oy, o.row);
  for (let x = Math.round(o.x0); x < o.x1; x++) {
    const block = Math.floor((x + 10000) / 26);
    const jitter = (hashInt(block, 1, o.seed) - 0.5) * 0.04;
    for (let y = o.top; y < o.bottom; y++) {
      let s = 0.18 + jitter;
      if (y === o.top) s = 0.5;
      else if (y === o.top + 1) s = 0.36;
      else if (y < o.top + 5) s = 0.26;
      else if (y === o.top + 5) s = 0.08;
      if ((x + 10000) % 26 === 0 && y > o.top + 5) s -= 0.07;
      if ((y - o.top) % 14 === 13) s -= 0.05;
      s += (fbm1(x / 9 + y / 13, o.seed, 2) - 0.5) * 0.05;
      put(x, y, s);
    }
    // the rail
    put(x, o.top - 22, 0.42);
    put(x, o.top - 21, 0.2);
    put(x, o.top - 11, 0.22);
    if ((x + 10000) % 40 === 0) for (let y = o.top - 22; y < o.top; y++) (put(x, y, 0.3), put(x + 1, y, 0.14));
  }
}

// The Hollow's near architecture at the player's own scale (round 1 of the
// world-quality pass). The market's houses used to be the far city's
// grammar (4 px windows, 60 px storeys) stood right behind the street, so a
// house the player could touch read like a skyscraper a kilometre off. Here a
// storey is about 2 H, a window is a window (frame, lintel, sill, shutters,
// a curtain in the lit ones), a shop has a fascia, a shutter or a lit
// counter, and every wall has a material you can name: brick, plaster gone
// to brick in patches, boards, cut stone. Light is painted the way the refs
// do it: a warm uplight from the street on the ground floor, a spill round
// every lit window, a rim toward the hollow's opening, occlusion under every
// ledge. Pix data only (shade, ramp row, emissive); the scene lights and fogs
// it live like every other layer.

import { Pix, fbm, hashInt, mulberry } from "../../../../scenes/engine/index.ts";
import { putter, type Put } from "./grammar.ts";

export type WallMat = "brick" | "plaster" | "boards" | "stone";

/** Shade offset of a wall material at wall-local (lx, ly): courses, joints, per-unit tone, stains. */
export function wallTex(mat: WallMat, lx: number, ly: number, seed: number, scale = 1): number {
  const L = (n: number): number => Math.max(2, Math.round(n * scale));
  if (mat === "brick") {
    const bw = L(12), bh = L(6);
    const course = Math.floor(ly / bh);
    const off = course % 2 ? bw >> 1 : 0;
    const unit = Math.floor((lx + off) / bw);
    let s = (hashInt(unit, course, seed) - 0.5) * 0.06;
    if (hashInt(unit, course, seed + 1) < 0.06) s -= 0.05; // a burnt brick
    if (ly % bh === bh - 1) s -= 0.07; // mortar bed
    else if ((lx + off) % bw === 0) s -= 0.06; // perpend
    else if (ly % bh === 0) s += 0.025; // the top arris catches light
    return s;
  }
  if (mat === "stone") {
    const bw = L(26), bh = L(14);
    const course = Math.floor(ly / bh);
    const off = course % 2 ? Math.round(bw * 0.45) : 0;
    const unit = Math.floor((lx + off) / bw);
    let s = (hashInt(unit, course, seed) - 0.5) * 0.07;
    const iy = ly % bh, ix = (lx + off) % bw;
    if (iy === bh - 1 || ix === 0) s -= 0.08;
    else if (iy === 0) s += 0.05;
    else if (ix === 1) s += 0.02;
    // pitting
    if (hashInt(lx, ly, seed + 7) < 0.04) s -= 0.04;
    return s;
  }
  if (mat === "boards") {
    const bw = L(8);
    const board = Math.floor(lx / bw);
    let s = (hashInt(board, 3, seed) - 0.5) * 0.06;
    const ix = lx % bw;
    if (ix === 0) s -= 0.08;
    else if (ix === 1) s += 0.03;
    // grain and the odd knot
    s += (hashInt(board, Math.floor(ly / L(9)), seed + 2) - 0.5) * 0.025;
    if (hashInt(board, Math.floor(ly / L(40)), seed + 4) < 0.05 && ix > 2 && ix < bw - 2 && ly % L(40) < 3) s -= 0.06;
    return s;
  }
  // plaster: soft stains, and patches where it has fallen off down to the brick
  const st = (fbm(lx / (60 * scale), ly / (44 * scale), seed, 3) - 0.5) * 0.1;
  const patch = fbm(lx / (34 * scale), ly / (26 * scale), seed + 9, 3);
  if (patch > 0.66) return wallTex("brick", lx, ly, seed + 3, scale) - 0.02 + (patch < 0.68 ? 0.06 : 0);
  return st + (hashInt(lx >> 1, ly >> 1, seed) - 0.5) * 0.02;
}

/** Add to the shade of solid, non-emissive texels (light spill, occlusion) at layer px. */
export function bumper(pix: Pix, ox: number, oy: number): (x: number, y: number, ds: number) => void {
  return (x, y, ds) => {
    const X = Math.round(x - ox), Y = Math.round(y - oy);
    if (X < 0 || Y < 0 || X >= pix.w || Y >= pix.h) return;
    const i = (Y * pix.w + X) * 4;
    if (!pix.data[i + 3] || pix.data[i + 1]! >= 128) return;
    pix.setShade(X, Y, pix.shadeAt(X, Y) + ds);
  };
}

/** A stepped pool of light (or shadow) on what is already drawn: `steps` rings out to radius r. */
export function pool(bump: (x: number, y: number, ds: number) => void, cx: number, cy: number, rx: number, ry: number, k: number, steps = 3, seed = 0): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) continue;
      // stepped, with a Bayer-ish dither on each step's edge so it is light, not a target
      const v = (1 - d) * steps;
      let n = Math.floor(v);
      const frac = v - n;
      // a narrow ordered-dither seam at each step's outer edge (pixel-art light, not a mesh over it)
      if (frac > 0.82 && ((x ^ y) & 1) === 0 && hashInt(x, y, seed) < 0.85) n++;
      if (n > 0) bump(x, y, (k * n) / steps);
    }
}

export interface HouseOpts {
  /** Layer x range, the ground line, the bottom of fill (layer y). */
  x0: number;
  x1: number;
  ground: number;
  bottom: number;
  seed: number;
  row: number;
  /** Emissive rows: lit windows, the shop interior, glowing signs. */
  wins: number[];
  shop: number;
  signs: number[];
  /** Cloth rows: awnings, curtains, laundry, painted fascias. */
  cloth: number[];
  /** Base wall shade. */
  shade: number;
  /** Layer x of the opening's light (rims face it). */
  lightX: number;
  /** Storey height px (ground floor is a little taller), widths px. */
  storey: number;
  minW: number;
  maxW: number;
  /** 0..1 lit windows. */
  lit: number;
  /** Feature scale (1 at the player's plane). */
  scale: number;
  /** Storeys per house, min..max. */
  floors: [number, number];
}

/** Market houses at the player's scale. */
export function houses(pix: Pix, ox: number, oy: number, o: HouseOpts): void {
  const put: Put = putter(pix, ox, oy, o.row);
  const bump = bumper(pix, ox, oy);
  const r = mulberry(o.seed);
  const S = (n: number): number => Math.max(1, Math.round(n * o.scale));
  const mats: WallMat[] = ["brick", "plaster", "boards", "stone", "plaster", "brick"];
  let x = o.x0;
  let prevRoof = o.ground - o.storey * 2;
  let idx = 0;
  while (x < o.x1) {
    const w = Math.round(o.minW + r() * (o.maxW - o.minW));
    const storeys = o.floors[0] + Math.floor(r() * (o.floors[1] - o.floors[0] + 1));
    const mat = mats[Math.floor(r() * mats.length)]!;
    const seed = o.seed * 31 + idx++;
    const sh0 = o.shade + (r() - 0.5) * 0.05;
    const cloth = o.cloth[Math.floor(r() * o.cloth.length)]!;
    let y1 = o.ground;
    let bx = x;
    let bw = w;
    const roofs: [number, number, number][] = [];
    for (let k = 0; k < storeys; k++) {
      const sth = Math.round(o.storey * (k === 0 ? 1.12 : 0.92 + r() * 0.16));
      const y0 = y1 - sth;
      const facing = bx + bw / 2 < o.lightX ? 1 : -1;
      // the wall
      for (let yy = y0; yy < (k === 0 ? o.bottom : y1); yy++)
        for (let xx = bx; xx < bx + bw; xx++) {
          let s = sh0 + wallTex(mat, xx - bx, yy - y0, seed, o.scale);
          // rim toward the opening, a shadowed far edge
          const fromLit = facing > 0 ? bx + bw - 1 - xx : xx - bx;
          const fromDark = facing > 0 ? xx - bx : bx + bw - 1 - xx;
          if (fromLit < S(2)) s += 0.12 - fromLit * 0.04;
          if (fromDark < S(3)) s -= 0.05;
          // the street's warm uplight on the ground floor, stepped
          if (k === 0) {
            const up = (yy - (o.ground - S(70))) / S(70);
            if (up > 0) s += Math.floor(up * 3) * 0.03;
          }
          put(xx, yy, s);
        }
      // the storey's cornice: a lit coping, a shadow line under it
      const jut = S(4);
      for (let xx = bx - jut; xx < bx + bw + jut; xx++) {
        put(xx, y0, sh0 + 0.26);
        put(xx, y0 + 1, sh0 + 0.16);
        for (let q = 2; q < S(6); q++) put(xx, y0 + q, sh0 + 0.06 + (xx % S(10) === 0 ? -0.04 : 0));
        put(xx, y0 + S(6), sh0 - 0.06);
      }
      for (let q = 0; q < S(4); q++) for (let xx = bx; xx < bx + bw; xx++) bump(xx, y0 + S(7) + q, -0.07 + q * 0.018);

      if (k === 0) {
        // the shop (round 3: a proper shuttered storefront at the middle layer's value, lit only by its
        // own sign lamp; round 2's were flat orange boxes brighter than the street in front of them):
        // a sign board on brackets with a gooseneck lamp over it, steel guide channels down both sides,
        // the roller drum's box under the sign, a slatted shutter that falls into shadow away from the
        // lamp, a bottom bar with a handle and a padlock, a stone kerb; now and then the shutter is up
        // and a dim shop shows, lit by one bulb
        const fw = Math.round(bw * (0.55 + r() * 0.2));
        const fx = bx + Math.round((bw - fw) * (r() < 0.5 ? 0.15 : 0.7));
        const ftop = y0 + S(12);
        const fh = S(20);
        const painted = r() < 0.55;
        for (let yy = ftop; yy < ftop + fh; yy++)
          for (let xx = fx - S(6); xx < fx + fw + S(6); xx++) {
            const edge = yy === ftop || yy === ftop + fh - 1;
            const end = xx < fx - S(4) || xx >= fx + fw + S(4);
            if (painted) put(xx, yy, (edge ? 0.3 : 0.17) + (end ? -0.04 : 0) + ((xx - fx) % S(14) === 0 ? -0.03 : 0) + (yy === ftop + 1 ? 0.06 : 0), cloth);
            else put(xx, yy, sh0 + (edge ? 0.14 : 0.04) + wallTex("boards", xx - fx, yy, seed + 4, o.scale) * 0.6);
          }
        // the board's shadow on the wall under it
        for (let q = 0; q < S(3); q++) for (let xx = fx - S(5); xx < fx + fw + S(7); xx++) bump(xx, ftop + fh + q, -0.07 + q * 0.02);
        // glyph letters on some boards (they mean nothing): the shop's sign, its only bright thing
        if (r() < 0.45 && o.signs.length) {
          const row = o.signs[Math.floor(r() * o.signs.length)]!;
          for (let gx = fx + S(8); gx < fx + fw - S(10); gx += S(10))
            for (let q = 0; q < 15; q++) if (hashInt(gx, q, seed) < 0.5) put(gx + (q % 3) * S(2), ftop + S(4) + Math.floor(q / 3) * S(2), 0.9, row, true);
        }
        // the gooseneck lamp over the board, and its light on the board and the shutter's head
        const lampX = fx + Math.round(fw / 2);
        {
          for (let q = 0; q < S(7); q++) put(lampX - S(4) + Math.round(q * 0.4), ftop - S(7) + q, sh0 + 0.14);
          for (let q = -S(3); q <= S(3); q++) put(lampX + q, ftop - S(8), sh0 + 0.2);
          for (let q = -S(2); q <= S(2); q++) put(lampX + q, ftop - S(7), 0.9, o.wins[0]!, true);
          pool(bump, lampX, ftop + S(6), fw * 0.45, S(16), 0.12, 3, seed + 21);
        }
        const oTop = ftop + fh + S(4);
        const open = r() < 0.3;
        const opH = Math.max(1, o.ground - S(3) - oTop);
        const ch = S(4); // the guide channels
        for (let yy = oTop; yy < o.ground; yy++)
          for (let xx = fx; xx < fx + fw; xx++) {
            const lxp = xx - fx, lyp = yy - oTop;
            const fromLamp = Math.min(1, lyp / opH);
            // the kerb: a stone sill the shutter closes on, its nose lit
            if (yy >= o.ground - S(3)) {
              put(xx, yy, sh0 + (yy === o.ground - S(3) ? 0.18 : 0.06));
              continue;
            }
            if (lxp < ch || fw - lxp <= ch) {
              const inner = lxp < ch ? lxp === ch - 1 : fw - lxp === ch;
              const outer = lxp === 0 || fw - lxp === 1;
              put(xx, yy, sh0 + 0.06 + (outer ? 0.08 : 0) + (inner ? -0.08 : 0) - fromLamp * 0.04);
              continue;
            }
            // the roller drum's box across the head
            if (lyp < S(8)) {
              const t = lyp / S(8);
              put(xx, yy, sh0 + 0.04 + Math.sin(t * Math.PI) * 0.08 + (lyp === 0 ? 0.08 : 0) + (lyp === S(8) - 1 ? -0.08 : 0));
              continue;
            }
            if (open) {
              // a dim shop: back shelves with goods in silhouette, a counter, one bulb under the ceiling
              const counter = yy > o.ground - S(34);
              const shelf = !counter && lyp % S(22) < S(2);
              const goods = !counter && !shelf && lyp % S(22) > S(12) && hashInt(Math.floor(lxp / S(5)), Math.floor(lyp / S(22)), seed) < 0.6;
              const near = Math.max(0, 1 - Math.hypot((lxp - fw / 2) / (fw * 0.6), lyp / (opH * 0.9)));
              if (counter) put(xx, yy, sh0 + 0.02 + (yy === o.ground - S(34) ? 0.16 : 0) + Math.floor(near * 2) * 0.03 + wallTex("boards", lxp, lyp, seed + 5, o.scale));
              else if (shelf) put(xx, yy, 0.12 + near * 0.14, o.shop);
              else if (goods) put(xx, yy, sh0 - 0.06 + hashInt(Math.floor(lxp / S(5)), 1, seed) * 0.06);
              else put(xx, yy, 0.04 + Math.floor(near * 4) * 0.05, o.shop);
            } else {
              // the slats: a lit top lip and a dark bottom lip each, dents and rust here and there, the
              // whole shutter going down a step or two away from the lamp
              const slat = (lyp - S(8)) % S(4);
              let sv = sh0 + 0.04 + (slat === 0 ? 0.07 : slat === S(4) - 1 ? -0.06 : 0) - Math.floor(fromLamp * 3) * 0.025;
              if (hashInt(Math.floor(lxp / S(6)), Math.floor((lyp - S(8)) / S(4)), seed + 8) < 0.05) sv -= 0.05;
              // the bottom bar, its handle and the padlock
              if (yy >= o.ground - S(9)) sv = sh0 + (yy === o.ground - S(9) ? 0.14 : 0.06);
              const hx = Math.abs(lxp - fw / 2);
              if (yy >= o.ground - S(8) && yy < o.ground - S(6) && hx < S(6)) sv = sh0 + 0.22;
              if (yy >= o.ground - S(6) && yy < o.ground - S(3) && hx < S(2)) sv = sh0 + 0.18;
              // a thread of light under it where it does not quite meet the kerb
              if (yy === o.ground - S(4) && hashInt(Math.floor(lxp / S(9)), 1, seed + 2) < 0.5) put(xx, yy, 0.6, o.shop, true);
              else put(xx, yy, sv);
            }
          }
        if (open) {
          for (let q = -S(1); q <= S(1); q++) for (let t = 0; t < S(2); t++) put(fx + Math.round(fw / 2) + q, oTop + S(10) + t, 0.9, o.wins[0]!, true);
          pool(bump, fx + fw / 2, oTop + S(12), fw * 0.5, S(40), 0.06, 2, seed);
        }
        // a door in the other bay: recessed, a step, a transom glowing
        const dw = S(30), dh = S(64);
        const dx = fx > bx + bw / 2 ? bx + S(12) : bx + bw - S(12) - dw;
        if (dx > bx + S(4) && dx + dw < bx + bw - S(4) && (dx + dw < fx - S(8) || dx > fx + fw + S(8))) {
          for (let yy = o.ground - dh - S(6); yy < o.ground; yy++)
            for (let xx = dx - S(4); xx < dx + dw + S(4); xx++) {
              const inner = xx >= dx && xx < dx + dw && yy >= o.ground - dh;
              if (!inner) put(xx, yy, sh0 + (yy < o.ground - dh - S(3) ? 0.2 : 0.1));
              else if (yy < o.ground - dh + S(8)) put(xx, yy, 0.9, o.wins[0]!, true);
              else put(xx, yy, sh0 - 0.12 + (xx === dx || xx === dx + 1 ? 0.05 : 0) + wallTex("boards", xx - dx, yy, seed + 6, o.scale) * 0.6);
            }
          for (let xx = dx - S(6); xx < dx + dw + S(6); xx++) for (let q = 0; q < S(3); q++) put(xx, o.ground - S(3) + q, sh0 + 0.14 - q * 0.04);
        }
        // an awning over the shop on some
        if (r() < 0.55) {
          const ay = ftop + fh + S(2);
          const ad = S(18);
          const crow = o.cloth[Math.floor(r() * o.cloth.length)]!;
          for (let xx = fx - S(4); xx < fx + fw + S(4); xx++) {
            const stripe = Math.floor((xx - fx) / S(7)) % 2 === 0;
            for (let yy = 0; yy < ad; yy++) put(xx, ay + yy, 0.2 + (yy === 0 ? 0.16 : 0) + (stripe ? 0.08 : 0) - (yy / ad) * 0.1, crow);
            if ((xx - fx) % S(7) < S(4)) put(xx, ay + ad, 0.16, crow);
          }
          for (let q = 0; q < S(10); q++) for (let xx = fx - S(2); xx < fx + fw + S(2); xx++) bump(xx, ay + ad + 1 + q, -0.05 + q * 0.004);
        }
      } else {
        // windows: framed, a lintel and a sill, shutters, lit ones with a curtain; a balcony on some
        const ww = S(22), wh = S(30);
        const n = Math.max(1, Math.min(3, Math.floor((bw - S(24)) / S(66))));
        const gap = (bw - n * ww) / (n + 1);
        const wy = y0 + Math.round((sth - wh) * 0.42);
        for (let i = 0; i < n; i++) {
          const wx = Math.round(bx + gap * (i + 1) + ww * i);
          const lit = hashInt(wx, wy, seed + 11) < o.lit;
          const wrow = o.wins[Math.floor(hashInt(wx, wy, seed + 3) * o.wins.length)]!;
          const curtain = lit && hashInt(wx, wy, seed + 5) < 0.6;
          const cw = Math.round(ww * (0.25 + hashInt(wx, 1, seed) * 0.2));
          const cside = hashInt(wx, 2, seed) < 0.5;
          if (lit) pool(bump, wx + ww / 2, wy + wh * 0.7, ww * 1.15, wh * 0.95, 0.11, 3, seed + i);
          for (let yy = wy - S(2); yy < wy + wh + S(2); yy++)
            for (let xx = wx - S(2); xx < wx + ww + S(2); xx++) {
              const frame = xx < wx || xx >= wx + ww || yy < wy || yy >= wy + wh;
              const mull = Math.abs(xx - (wx + ww / 2)) < S(1) || Math.abs(yy - (wy + wh * 0.4)) < S(1);
              if (frame) put(xx, yy, sh0 + 0.16);
              else if (mull) put(xx, yy, sh0 + (lit ? 0.1 : 0.04));
              else if (lit) {
                const inCurtain = curtain && (cside ? xx - wx < cw : wx + ww - 1 - xx < cw);
                if (inCurtain) put(xx, yy, 0.3 + ((xx - wx) % S(3) === 0 ? -0.06 : 0), o.cloth[(seed + i) % o.cloth.length]!);
                else put(xx, yy, 0.9, wrow, true);
              } else {
                // dark glass with the hollow's light caught on it
                const glint = (xx - wx) - (yy - wy) * 0.5;
                put(xx, yy, sh0 - 0.13 + (glint > ww * 0.55 && glint < ww * 0.55 + S(2) ? 0.16 : 0));
              }
            }
          // lintel and sill
          for (let xx = wx - S(5); xx < wx + ww + S(5); xx++) {
            for (let q = 0; q < S(5); q++) put(xx, wy - S(2) - S(5) + q, sh0 + (q === 0 ? 0.24 : 0.12));
            for (let q = 0; q < S(3); q++) put(xx, wy + wh + S(2) + q, sh0 + (q === 0 ? 0.26 : 0.08));
            for (let q = 0; q < S(3); q++) bump(xx, wy + wh + S(5) + q, -0.06 + q * 0.02);
          }
          // shutters folded back on some unlit or half the lit
          if (hashInt(wx, wy, seed + 13) < 0.45) {
            for (const side of [-1, 1]) {
              const sx0 = side < 0 ? wx - S(2) - S(10) : wx + ww + S(2);
              for (let yy = wy; yy < wy + wh; yy++)
                for (let xx = sx0; xx < sx0 + S(10); xx++) put(xx, yy, sh0 + 0.04 + ((yy - wy) % S(4) === 0 ? -0.06 : 0.02) + (xx === sx0 ? -0.04 : 0));
            }
          }
          // soot and rain down the wall from the sill
          for (let q = 0; q < S(40); q++) if (hashInt(wx, q, seed + 17) < 0.7) bump(wx + Math.round(ww * hashInt(wx, 4, seed)), wy + wh + S(5) + q, -0.03);
        }
        // a balcony across part of the storey's foot
        if (r() < 0.4) {
          const ba = bx + Math.round(bw * r() * 0.3);
          const bb = Math.min(bx + bw + S(8), ba + Math.round(bw * (0.45 + r() * 0.4)));
          const by = y1 - S(1);
          for (let xx = ba; xx < bb; xx++) {
            for (let q = 0; q < S(4); q++) put(xx, by - q, sh0 + (q === S(4) - 1 ? 0.24 : 0.1));
            put(xx, by - S(22), sh0 + 0.22);
            put(xx, by - S(21), sh0 + 0.1);
            if ((xx - ba) % S(5) === 0) for (let yy = by - S(21); yy < by - S(4); yy++) put(xx, yy, sh0 + 0.08);
          }
          // brackets under it, a pot or two, washing on a line
          for (const bxx of [ba + S(4), bb - S(6)]) for (let q = 0; q < S(8); q++) for (let t = 0; t < S(8) - q; t++) put(bxx + t, by + 1 + q, sh0 + 0.06);
          for (let p = 0; p < 2; p++) {
            const px = ba + S(10) + Math.round(r() * (bb - ba - S(24)));
            for (let yy = by - S(12); yy < by - S(4); yy++) for (let xx = px; xx < px + S(8); xx++) put(xx, yy, 0.24, o.cloth[0]!);
            for (let q = 0; q < S(10); q++) put(px + Math.round(r() * S(8)), by - S(12) - Math.round(r() * S(6)), 0.3, o.cloth[1 % o.cloth.length]!);
          }
        }
        // a blade sign on a bracket at a corner, now and then
        if (r() < 0.25 && o.signs.length) {
          const left = r() < 0.5;
          const sx = left ? bx - S(4) : bx + bw - S(16);
          const sy = y0 + S(24);
          for (let xx = sx - S(2); xx < sx + S(20); xx++) put(xx, sy, sh0 + 0.2);
          const row = o.signs[Math.floor(r() * o.signs.length)]!;
          for (let yy = sy + S(3); yy < sy + S(3) + S(34); yy++)
            for (let xx = sx + S(2); xx < sx + S(14); xx++) {
              const e = xx === sx + S(2) || xx === sx + S(14) - 1 || yy === sy + S(3) || yy === sy + S(36);
              const g = e || hashInt(xx >> 1, yy >> 1, seed) < 0.4;
              if (g) put(xx, yy, 0.9, row, true);
              else put(xx, yy, 0.08);
            }
        }
      }
      roofs.push([bx, bw, y0]);
      // next storey: a jetty out over the street side now and then, or a setback
      const jet = r() < 0.3 ? S(8) : 0;
      const nw = Math.max(S(80), Math.round(bw * (0.8 + r() * 0.25)));
      bx = Math.round(bx + (bw - nw) * r()) - jet;
      bw = nw + jet * 2;
      y1 = y0;
    }
    // the roof: a pitched tile roof or a flat one with a parapet, a tank, a chimney, an aerial
    const [rx0, rw, ry] = roofs[roofs.length - 1]!;
    const facing = rx0 + rw / 2 < o.lightX ? 1 : -1;
    if (r() < 0.5) {
      const rise = Math.round(rw * (0.28 + r() * 0.12));
      for (let yy = 0; yy < rise; yy++) {
        const half = Math.round((rw / 2 + S(6)) * (yy / rise));
        const cx = rx0 + rw / 2;
        for (let xx = Math.round(cx - half); xx < cx + half; xx++) {
          const tile = (yy % S(5) === 0 ? -0.07 : 0) + (((xx >> 2) + (Math.floor(yy / S(5)) & 1)) % 3 === 0 ? -0.02 : 0);
          const lit = facing > 0 ? xx > cx : xx < cx;
          const eave = Math.abs(xx - cx) > half - S(2);
          put(xx, ry - rise + yy, sh0 + 0.06 + tile + (lit ? 0.06 : -0.03) + (eave ? 0.14 : 0));
        }
      }
      // a dormer with a lit window on some
      if (r() < 0.4) {
        const dx = Math.round(rx0 + rw * 0.5 - S(12)), dy = ry - Math.round(rise * 0.55);
        for (let yy = dy; yy < dy + S(24); yy++) for (let xx = dx; xx < dx + S(24); xx++) put(xx, yy, sh0 + (yy === dy ? 0.24 : 0.08));
        for (let yy = dy + S(6); yy < dy + S(20); yy++) for (let xx = dx + S(6); xx < dx + S(18); xx++) put(xx, yy, 0.9, o.wins[0]!, true);
      }
    } else {
      // parapet coping
      for (let xx = rx0 - S(2); xx < rx0 + rw + S(2); xx++) for (let q = 0; q < S(10); q++) put(xx, ry - S(10) + q, sh0 + (q === 0 ? 0.26 : q < 3 ? 0.12 : 0.03) + wallTex(mat, xx, q, seed, o.scale) * 0.5);
      // a water tank on legs
      if (r() < 0.6) {
        const tx = rx0 + Math.round(rw * (0.15 + r() * 0.5)), tw = S(34), th = S(30);
        for (let yy = ry - S(10) - th - S(14); yy < ry - S(10) - S(14); yy++)
          for (let xx = tx; xx < tx + tw; xx++) {
            const u = (xx - tx) / tw;
            const round = Math.sin(u * Math.PI);
            const band = (yy - (ry - S(10) - th - S(14))) % S(8) === 0;
            put(xx, yy, sh0 + 0.02 + round * 0.12 + (band ? 0.08 : 0) + (facing > 0 ? u : 1 - u) * 0.06);
          }
        for (const lx of [tx + S(3), tx + tw - S(5)]) for (let yy = ry - S(10) - S(14); yy < ry - S(10); yy++) (put(lx, yy, sh0 + 0.12), put(lx + 1, yy, sh0 + 0.02));
        for (let xx = tx + S(3); xx < tx + tw - S(3); xx++) put(xx, ry - S(10) - S(14) + Math.round(Math.abs(xx - (tx + tw / 2)) / 3) % S(14), sh0 + 0.06);
      }
    }
    // a chimney stack with pots, rimmed
    if (r() < 0.65) {
      const cx = rx0 + Math.round(rw * (0.6 + r() * 0.3)), cw = S(14), ch = S(34);
      const cy = ry - ch - S(6);
      for (let yy = cy; yy < ry; yy++) for (let xx = cx; xx < cx + cw; xx++) put(xx, yy, sh0 + wallTex("brick", xx - cx, yy - cy, seed + 9, o.scale) + (xx === (facing > 0 ? cx + cw - 1 : cx) ? 0.12 : 0) + (yy < cy + S(3) ? 0.2 : 0));
      for (const p of [cx + S(2), cx + cw - S(6)]) for (let yy = cy - S(8); yy < cy; yy++) for (let xx = p; xx < p + S(4); xx++) put(xx, yy, sh0 + 0.1 + (yy === cy - S(8) ? 0.14 : 0));
    }
    // an aerial
    if (r() < 0.35) {
      const ax = rx0 + Math.round(rw * r());
      for (let yy = ry - S(60); yy < ry; yy++) put(ax, yy, sh0 + 0.16);
      for (const h of [S(48), S(38), S(28)]) for (let q = -S(6); q <= S(6); q++) put(ax + q, ry - h, sh0 + 0.14);
    }
    // a drainpipe from the gutter to the street, bracketed
    if (r() < 0.6) {
      const px = x + (r() < 0.5 ? S(3) : w - S(6));
      for (let yy = ry; yy < o.ground; yy++) {
        put(px, yy, sh0 + 0.18);
        put(px + 1, yy, sh0 + 0.08);
        put(px + 2, yy, sh0 - 0.02);
        if ((yy - ry) % S(36) === 0) for (let q = -1; q < S(5); q++) put(px + q, yy, sh0 + 0.22);
      }
    }
    // laundry strung to the neighbour
    if (idx > 1 && r() < 0.5) {
      const ay = Math.max(prevRoof, ry) + S(30);
      const sag = S(10) + r() * S(14);
      const a = x - S(40), bb = x + S(30);
      for (let xx = a; xx < bb; xx++) {
        const t = (xx - a) / (bb - a);
        const yy = Math.round(ay + sag * 4 * t * (1 - t));
        put(xx, yy, sh0 + 0.12);
        if ((xx - a) % S(13) === 0 && r() < 0.75) {
          const crow = o.cloth[Math.floor(r() * o.cloth.length)]!;
          const ln = S(10) + Math.floor(r() * S(12));
          for (let k2 = 1; k2 < ln; k2++) for (let q = 0; q < S(8); q++) put(xx + q, yy + k2, 0.22 + (k2 === 1 ? 0.12 : 0) + (q === 0 ? 0.06 : 0), crow);
        }
      }
    }
    prevRoof = ry;
    x += w + Math.round(r() * S(10));
  }
}

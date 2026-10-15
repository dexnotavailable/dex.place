// The Ink Palace 墨宮 from the road (A.3, "Frame, front"; reference 6 turned side-on): the Hall of
// Works' long face in black lacquer and gold, one red of the seal. Three storeys, each set back
// on the roof below; deep eaves on rows of gold brackets; black-tiled roofs with gold ridges and
// up-turned corners; black lacquer columns on stone drums; lattice screens between them, warm
// paper glowing behind; the stone platform grown into the rock under it (moss and stains at its
// foot, so the hall stands in the land).
//
// Round 7 (the architecture lane; Dex: "no palace would put a front-facing door all the way on
// the left: either that camera-facing door is in the middle, or it goes flat-ish"): the long hall
// has no door in its face. The way in is its GATE HALL, a porch building standing out in front of
// the hall's west end, symmetric about the doors: the doors in its middle bay under a cusped
// karahafu gable with a gold pendant, a round lattice window glowing in each side bay, lanterns
// either side, its own roof on a bracket frieze, its podium and steps. The doors themselves are
// a sprite (op.doors) that swings open as she comes near; this plate holds the lit hall behind
// them.
//
// Also the twin gate towers that flank the way in, their cable stays slanting to the road, and
// the festival banners strung between them. Anchors: the hall's floor line at its west end; a
// tower's foot; a stay's top; the banners' left hanging point.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { glyph, row } from "./glyphs.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, tone, vnoise } from "../../raster.ts";


function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.max(Math.round(c.X(x0)) + 1, Math.round(c.X(x1)));
  const Y0 = Math.round(c.Y(y0)), Y1 = Math.max(Math.round(c.Y(y0)) + 1, Math.round(c.Y(y1)));
  if (!c.buf.touches(X0, Y0, X1, Y1)) return;
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / (X1 - X0), (y - Y0 + 0.5) / (Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

/** A round lacquered column: lit stripe left, shade right; t0 shifts the whole. */
const roundT = (u: number, t0: number): number => t0 + (u < 0.18 ? -0.25 : u < 0.42 ? -0.08 : u < 0.72 ? 0.08 : u < 0.9 ? 0.22 : 0.4);

/**
 * A black-tiled roof in side elevation: the slope facing us from the eave line (y) up to the ridge
 * (y - rh), x0..x1 at the eave. Vertical runs of round tiles lit on their left, a row of tile-end
 * caps along the eave, corners swept up, a gold-trimmed ridge with horned ends.
 */
export function roof(c: PaintCtx, x0: number, x1: number, y: number, rh: number, inset: number, seed: number, horns = true): void {
  const d = c.d;
  const cx = (x0 + x1) / 2, span = (x1 - x0) / 2;
  const ridgeH = Math.max(8, rh * 0.12);
  const Y0 = Math.round(c.Y(y - rh - ridgeH * 1.6)), Y1 = Math.round(c.Y(y + 6));
  const X0 = Math.round(c.X(x0 - span * 0.06)), X1 = Math.round(c.X(x1 + span * 0.06));
  if (!c.buf.touches(X0, Y0, X1, Y1)) return;
  for (let yy = Math.max(Y0, c.buf.oy); yy < Math.min(Y1, c.buf.y1); yy++) {
    const ly = c.ly(yy + 0.5);
    const u = (y - ly) / rh; // 0 eave .. 1 ridge
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const lx = c.lx(x + 0.5);
      const k = (lx - cx) / span; // -1 .. 1 along the eave
      const ak = Math.abs(k);
      // the half width of the slope at this height (a concave sweep), the corners turned up
      const hw = 1 - inset * Math.pow(Math.max(0, u), 0.75);
      const lift = Math.pow(Math.max(0, ak - 0.7) / 0.3, 2.2) * rh * 0.32;
      const eave = y - lift;
      if (ly > eave + 4 || ak > hw + 0.05 * Math.max(0, 1 - u * 4)) continue;
      if (u > 1) {
        // the ridge: a thick beam, gold trimmed, its ends rising into horns
        const ridgeHalf = 1 - inset;
        if (ak > ridgeHalf + 0.02) continue;
        const v = (y - rh - ly) / ridgeH;
        const horn = horns ? Math.pow(Math.max(0, ak - (ridgeHalf - 0.08)) / 0.1, 1.5) * 1.6 : 0;
        if (v > 1 + horn) continue;
        const col = v < 0.2 || v > 0.85 + horn ? tone(P.gold, 0.3 + (k > 0 ? 0.2 : 0), x, yy, 0.3) : tone(P.lacquer, 0.55, x, yy, 0.3);
        c.buf.set(x, yy, col);
        continue;
      }
      if (ly > eave) {
        // the eave's edge: a row of round tile-end caps over a dark fascia
        const cap = Math.floor(lx / 6);
        const f = lx / 6 - cap - 0.5;
        const capDisc = (ly - eave) < 3.4 * Math.sqrt(Math.max(0, 1 - 4 * f * f));
        c.buf.set(x, yy, capDisc ? tone(P.tile, f < 0 ? 0.35 : 0.65, x, yy, 0.3) : P.lacquer[4]!);
        continue;
      }
      // tile runs: vertical, each lit on its left; darker toward the eave and the corners
      const run = lx / 5;
      const fr = run - Math.floor(run);
      let t = 0.55 + (1 - u) * 0.12 + ak * 0.08 + (fr < 0.3 ? -0.2 : fr > 0.78 ? 0.18 : 0);
      if (d >= 0.5 && hash(Math.floor(run), Math.floor(ly / 3), seed) < 0.04) t -= 0.15;
      if (ly < y - rh + 3) t -= 0.15;
      c.buf.set(x, yy, tone(P.tile, clamp(t, 0, 1), x, yy, 0.3));
    }
  }
}

/** A frieze of brackets (dougong) under an eave: gold blocks on black lacquer, a red-tipped arm. */
function brackets(c: PaintCtx, x0: number, x1: number, y: number, h: number, pitch: number): void {
  fill(c, x0, y, x1, y + h, (x, yy, _u, v) => {
    const lx = c.lx(x + 0.5);
    const k = (((lx - x0) % pitch) + pitch) % pitch / pitch;
    if (v < 0.16) return P.lacquer[4]!;
    if (k < 0.5) {
      if (v < 0.5) return tone(P.gold, k < 0.12 ? 0.15 : 0.5, x, yy, 0.3);
      if (v < 0.8 && k > 0.1 && k < 0.4) return tone(P.gold, 0.7, x, yy, 0.3);
      return P.lacquer[3]!;
    }
    if (k < 0.58 && v > 0.3 && v < 0.6) return P.red[3]!;
    return v > 0.85 ? P.lacquer[4]! : P.lacquer[2]!;
  });
}

/** One storey's face from x0 to x1, top y0 to floor y1: columns on drums, lattice screens. */
function storey(c: PaintCtx, x0: number, x1: number, y0: number, y1: number, bay: number, seed: number, warm: number): void {
  const d = c.d;
  const H = y1 - y0;
  const n = Math.max(1, Math.round((x1 - x0) / bay));
  const bw = (x1 - x0) / n;
  const colW = Math.max(12, bw * 0.13);
  fill(c, x0, y0, x1, y1, (x, y, _u, v) => {
    const lx = c.lx(x + 0.5);
    const i = Math.floor((lx - x0) / bw);
    const bx = lx - x0 - i * bw; // 0 .. bw in this bay
    // a column at the start of every bay (and at the end)
    const cu = (bx + colW / 2) % bw;
    if (cu < colW || lx > x1 - colW / 2) {
      const u = lx > x1 - colW / 2 ? (lx - (x1 - colW / 2)) / colW : cu / colW;
      if (v > 0.92) return tone(P.stone, u < 0.3 ? 0.2 : 0.5, x, y, 0.3);
      if (Math.abs(v - 0.06) < 0.025 || Math.abs(v - 0.88) < 0.012) return tone(P.gold, u < 0.4 ? 0.2 : 0.55, x, y, 0.3);
      return tone(P.lacquer, clamp(roundT(u, 0.45), 0, 1), x, y, 0.3);
    }
    // the bay: a lintel band, then the lattice screen, then a solid lacquer wainscot
    const inner = (bx - colW / 2) / (bw - colW);
    if (v < 0.09) return tone(P.lacquer, 0.6 + (v < 0.02 ? -0.3 : 0), x, y, 0.3);
    if (v > 0.74) {
      if (v < 0.765) return tone(P.gold, 0.45, x, y, 0.3);
      return tone(P.lacquer, 0.5 + (inner < 0.04 || inner > 0.96 ? 0.25 : 0) + (v > 0.97 ? 0.2 : 0), x, y, 0.3);
    }
    // lattice: a frame, then a grid of small panes; warm paper glows behind in some bays
    const fx = Math.min(inner, 1 - inner) * (bw - colW), fy = Math.min(v - 0.09, 0.74 - v) * H;
    if (fx < 4 || fy < 4) return tone(P.lacquer, fx < 1.2 || fy < 1.2 ? 0.75 : 0.45, x, y, 0.3);
    const pane = Math.max(5, 7 * Math.min(1.2, H / 400));
    const gx = (lx - x0) / pane, gy = (c.ly(y + 0.5) - y0) / pane;
    const bar = (gx - Math.floor(gx)) < 0.24 || (gy - Math.floor(gy)) < 0.24;
    // the eave's shadow falls across the top of the screens
    const shade = v < 0.3 ? (0.3 - v) / 0.3 : 0;
    if (bar && d >= 0.25) return P.lacquer[shade > 0.3 ? 4 : 3]!;
    const lit = hash1(i, seed) < warm;
    if (lit) {
      // paper lit from inside: a warm even glow, dimmer under the eave's shadow and at the sides
      const side = Math.abs(inner - 0.5) * 2;
      const k = clamp(0.35 + shade * 0.5 + side * side * 0.35 - (v - 0.3) * 0.25, 0, 1);
      if (k < 0.45) return tone(P.paper, clamp(0.25 + k * 0.8, 0, 1), x, y, 0.35);
      return tone(P.gold, clamp(0.35 + (k - 0.45) * 1.1, 0, 1), x, y, 0.35);
    }
    return tone(P.lacquer, clamp(0.55 + shade * 0.3 + (bayer4(x, y) < 0.15 ? -0.1 : 0), 0, 1), x, y, 0.3);
  });
}

/** A hanging lantern: red paper ribs, gold caps, a warm core; its cord from (x, y0). */
function lantern(c: PaintCtx, x: number, y0: number, drop: number, r: number): void {
  fill(c, x - 1, y0, x + 1, y0 + drop, () => P.ink[0]!);
  const top = y0 + drop, H = r * 2.6;
  fill(c, x - r, top, x + r, top + H, (xx, y, u, v) => {
    const k = Math.abs(u - 0.5) * 2;
    if (v > 0.1 && v < 0.9 && k > Math.sqrt(Math.max(0, 1 - Math.pow(v * 2 - 1, 2))) * 1.03) return 0;
    if (v < 0.1 || v > 0.9) return k > 0.62 ? 0 : tone(P.gold, u < 0.4 ? 0.3 : 0.6, xx, y, 0.3);
    if (Math.abs(((v * 6) % 1) - 0.5) < 0.07) return P.red[4]!;
    // the warm core glows through the paper on the side away from the sun's glare
    const core = Math.hypot(u - 0.45, (v - 0.5) * 1.2);
    if (core < 0.2) return tone(P.ember, 0.25 + core * 2, xx, y, 0.3);
    return tone(P.red, u < 0.3 ? 0.0 : u < 0.62 ? 0.16 : 0.42, xx, y, 0.3);
  });
  fill(c, x - 1, top + H, x + 1, top + H + r * 0.9, (xx, y, _u, v) => (v > 0.6 ? tone(P.red, 0.3, xx, y, 0.3) : P.gold[3]!));
}

/**
 * The lit hall seen through the open doors (the plate under the door sprite): warm lamplight, the
 * floor's polished boards catching it in a long pool, two columns and a hanging lamp inside, the
 * far wall's gold screen; the reveals (the doorway's inner sides) lit warm at their inner edges.
 */
function hallBeyond(c: PaintCtx, x0: number, w: number, y1: number, h: number): void {
  fill(c, x0, y1 - h, x0 + w, y1, (x, y, u, v) => {
    const lx = c.lx(x + 0.5) - x0, ly = c.ly(y + 0.5) - (y1 - h);
    // the reveals: the wall's thickness either side, lacquer, warm toward the light
    const rev = Math.min(u, 1 - u) * w;
    if (rev < 6) return tone(P.umber, rev < 2 ? 0.95 : 0.55 - v * 0.2, x, y, 0.3);
    // the floor: polished boards, a bright pool of light down the middle
    if (v > 0.84) {
      const pool = 1 - Math.abs(u - 0.5) * 2.2;
      const t = 0.9 - pool * 0.7 - (v - 0.84) * 0.8;
      return tone(P.ember, clamp(t, 0, 1), x, y, 0.35);
    }
    // two columns inside, dark red against the light
    for (const cu of [0.22, 0.78]) if (Math.abs(u - cu) * w < 9) return tone(P.umber, Math.abs(u - cu) * w < 3 ? 0.25 : 0.5, x, y, 0.3);
    // a lamp hanging in the middle, high
    const lr = Math.hypot(lx - w / 2, ly - h * 0.24);
    if (lr < 9) return lr < 4 ? P.ember[0]! : tone(P.ember, 0.3 + lr / 20, x, y, 0.3);
    if (Math.abs(lx - w / 2) < 0.8 && ly < h * 0.24) return P.umber[4]!;
    // the far wall's gold screen, low; the dark beams above, the light rising from the floor
    if (v > 0.5 && v <= 0.84 && u > 0.3 && u < 0.7) return tone(P.gold, 0.45 + (v - 0.5) * 0.4 + (bayer4(x, y) < 0.2 ? 0.15 : 0), x, y, 0.3);
    const t = v < 0.12 ? 0.98 : 0.3 + (1 - v) * 0.6 + Math.abs(u - 0.5) * 0.25;
    return tone(v < 0.35 ? P.umber : P.ember, clamp(v < 0.35 ? 0.4 + (0.35 - v) * 1.6 : t, 0, 1), x, y, 0.35);
  });
}

/**
 * The gate hall: a porch building standing out in front of the hall, symmetric about the doors
 * (dx..dx+dw, dh tall, their foot 12 px up on its podium). Black lacquer columns on stone drums,
 * a round lattice window glowing in each side bay over a lacquer wainscot, the plaque over the
 * doors, a bracket frieze, its roof, and over the doors a cusped karahafu gable with a gold pendant.
 */
function gateHall(c: PaintCtx, dx: number, dw: number, dh: number, seed: number): void {
  const d = c.d;
  const gc = dx + dw / 2;
  const cw = 24, sb = 112;
  const half = dw / 2 + cw + sb + cw;
  const x0 = gc - half, x1 = gc + half;
  const fl = -12, doorTop = fl - dh;
  const lintel = doorTop - 56, frieze = lintel - 30;
  // the podium: a low dressed-stone base, its top edge lit, steps up to the doors
  fill(c, x0 - 16, fl, x1 + 16, 0, (x, y, u, v) => {
    const lx = c.lx(x + 0.5);
    if (v < 0.18) return tone(P.stone, u < 0.5 ? 0.05 : 0.2, x, y, 0.3);
    const joint = (((lx - x0) / 58) % 1 + 1) % 1 < 0.03;
    return tone(P.stone, clamp(0.36 + v * 0.25 + (joint ? 0.3 : 0) + (u > 0.94 ? 0.2 : 0), 0, 1), x, y, 0.3);
  });
  for (const [sy, ext] of [[-6, 34], [0, 54]] as const) {
    fill(c, dx - ext, sy - 6, dx + dw + ext, sy, (x, y, u, v) => tone(P.stone, v < 0.3 ? 0.04 : u > 0.96 ? 0.6 : 0.34, x, y, 0.3));
  }
  // the lit hall beyond the doorway (the door sprite's leaves cover it until they open)
  hallBeyond(c, dx, dw, fl, dh);
  // the walls of the side bays: a lacquer wainscot under a gold rail, a dark panel above with a
  // round window: gold ring, lattice, warm paper glowing behind
  for (const side of [-1, 1]) {
    const b0 = side < 0 ? x0 + cw : dx + dw + cw, b1 = b0 + sb;
    const wc = (b0 + b1) / 2, wy = fl - dh * 0.55, wr = sb * 0.36;
    fill(c, b0, lintel, b1, fl, (x, y, u) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const rr = Math.hypot(lx - wc, ly - wy);
      if (rr < wr + 4) {
        if (rr > wr) return tone(P.gold, ly < wy ? 0.25 : 0.6, x, y, 0.3);
        if (rr > wr - 2.2) return P.lacquer[4]!;
        const gx = (lx - wc) / 7, gy = (ly - wy) / 7;
        if (d >= 0.5 && ((gx - Math.floor(gx)) < 0.22 || (gy - Math.floor(gy)) < 0.22)) return P.lacquer[3]!;
        const k = rr / wr;
        return k < 0.55 ? tone(P.gold, 0.15 + k * 0.4, x, y, 0.35) : tone(P.paper, clamp(0.2 + (k - 0.55) * 1.4, 0, 1), x, y, 0.35);
      }
      const ex = Math.min(u, 1 - u) * sb;
      if (ly > fl - 100) {
        if (ly < fl - 96) return tone(P.gold, 0.45, x, y, 0.3);
        // the wainscot: raised lacquer panels with a gold bead
        if (ex < 10 || ly > fl - 12) return tone(P.lacquer, 0.55, x, y, 0.3);
        if (ex < 12 || ly > fl - 15 || ly < fl - 82) return tone(P.gold, 0.6, x, y, 0.3);
        return tone(P.lacquer, 0.38 + (u > 0.85 ? 0.2 : 0), x, y, 0.3);
      }
      // the panel: lacquer, its edges darker, faint vertical boards
      let t = 0.5 + (ex < 5 ? 0.25 : 0) + (((lx / 14) % 1 + 1) % 1 < 0.08 ? 0.12 : 0);
      if (ly < lintel + 40) t += 0.12 * (1 - (ly - lintel) / 40);
      return tone(P.lacquer, clamp(t, 0, 1), x, y, 0.3);
    });
  }
  // the transom over the doors: dark lacquer, the plaque on it
  fill(c, dx, lintel, dx + dw, doorTop, (x, y, _u, v) => tone(P.lacquer, v > 0.9 ? 0.85 : 0.6, x, y, 0.3));
  fill(c, gc - 70, doorTop - 46, gc + 70, doorTop - 12, (x, y, u, v) => {
    const ex = Math.min(u, 1 - u) * 140, ey = Math.min(v, 1 - v) * 34;
    if (ex < 1 || ey < 1) return P.ink[0]!;
    if (ex < 4 || ey < 4) return tone(P.gold, u < 0.4 ? 0.15 : 0.5, x, y, 0.3);
    return tone(P.lacquer, 0.55, x, y, 0.3);
  });
  // its name in gold, hand-lettered: 墨宮, the Ink Palace (a shadow stroke under the gold)
  if (d >= 0.25) {
    const gs = 24, gx = gc - gs - 5, gy = doorTop - 41;
    row(c, "墨宮", gx + 1, gy + 1, gs, P.lacquer[4]!, 0.42, 0.11);
    row(c, "墨宮", gx, gy, gs, P.gold[1]!, 0.42, 0.11);
  }
  // the doorframe: a black lacquer surround with a gold inner bead
  fill(c, dx - 8, doorTop - 8, dx + dw + 8, fl, (x, y) => {
    const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
    const inX = lx > dx && lx < dx + dw, inY = ly > doorTop;
    if (inX && inY) return 0;
    const e = Math.min(Math.abs(lx - dx), Math.abs(lx - dx - dw), Math.abs(ly - doorTop));
    return e < 2 ? tone(P.gold, 0.5, x, y, 0.3) : tone(P.lacquer, 0.72, x, y, 0.3);
  });
  // the lintel, a gold line along it
  fill(c, x0 - 6, lintel - 14, x1 + 6, lintel, (x, y, _u, v) => (Math.abs(v - 0.45) < 0.12 ? tone(P.gold, 0.4, x, y, 0.3) : tone(P.lacquer, v < 0.2 ? 0.3 : 0.62, x, y, 0.3)));
  // the columns: black lacquer, gold bands, on stone drums
  for (const cx of [x0 + cw / 2, dx - cw / 2, dx + dw + cw / 2, x1 - cw / 2]) {
    fill(c, cx - cw / 2, lintel, cx + cw / 2, fl, (x, y, u, v) => {
      if (v > 0.95) return tone(P.stone, u < 0.3 ? 0.15 : 0.45, x, y, 0.3);
      if (Math.abs(v - 0.05) < 0.012 || Math.abs(v - 0.9) < 0.01) return tone(P.gold, u < 0.4 ? 0.2 : 0.55, x, y, 0.3);
      return tone(P.lacquer, clamp(roundT(u, 0.45), 0, 1), x, y, 0.3);
    });
  }
  // the bracket frieze and the roof
  brackets(c, x0 - 14, x1 + 14, frieze, 30, 30);
  const eave = frieze - 4;
  roof(c, x0 - 96, x1 + 96, eave, 150, 0.3, seed + 1);
  // the karahafu over the doors: a bargeboard swept up in a cusped bell, gold-trimmed, tile ends
  // along its top, the gable under it dark with a gold pendant at the crown
  const kh = dw / 2 + cw + 46, A = 96, band = 15;
  const bell = (x: number): number => {
    const u = Math.min(1, Math.abs(x - gc) / kh);
    return Math.pow(0.5 * (1 + Math.cos(Math.PI * u)), 1.15);
  };
  fill(c, gc - kh, eave - A - 12, gc + kh, eave + 8, (x, y) => {
    const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
    const top = eave + 4 - A * bell(lx);
    if (ly < top - 7) return 0;
    if (ly < top) {
      // tile ends along the curve's top, the roof's tiles behind them
      const cap = (lx - gc) / 7;
      const f = cap - Math.floor(cap) - 0.5;
      return Math.abs(f) < 0.34 ? tone(P.tile, f < 0 ? 0.3 : 0.6, x, y, 0.3) : P.lacquer[4]!;
    }
    if (ly < top + band) {
      const v = (ly - top) / band;
      if (v < 0.16 || v > 0.84) return tone(P.gold, v < 0.16 ? 0.25 : 0.6, x, y, 0.3);
      return tone(P.lacquer, lx < gc ? 0.42 : 0.6, x, y, 0.3);
    }
    if (ly > eave + 4) return 0;
    // the gable under the curve: dark, a gold pendant (gegyo) hanging from the crown
    const px = lx - gc, py = ly - (eave + 4 - A + band);
    const pw = 26 * (1 - Math.pow(Math.max(0, py) / 38, 1.6));
    if (py > 0 && py < 38 && Math.abs(px) < pw) {
      if (Math.abs(px) < 3 && py > 24) return P.red[2]!;
      return tone(P.gold, px < 0 ? 0.2 : 0.55, x, y, 0.3);
    }
    // carved gold scrolls either side of it, low in the gable
    const sx = Math.abs(px) - kh * 0.42, sy = ly - (eave - 18);
    if (d >= 0.5 && Math.abs(Math.hypot(sx, sy) - 9) < 1.4 && sy < 4) return tone(P.gold, 0.5, x, y, 0.3);
    return tone(P.lacquer, 0.78, x, y, 0.3);
  });
  // two lanterns hang from the eave either side of the doors
  if (d >= 0.25) for (const side of [-1, 1]) lantern(c, gc + side * (dw / 2 + cw + sb * 0.5), eave + 2, 30, 15);
}

export interface PalaceP {
  /** Length of the hall, px; the anchor is the floor line at its west end. */
  w: number;
  /** Ground storey, upper storey and top pavilion heights, px. */
  h0: number;
  h1: number;
  h2: number;
  /** The entrance: x from the west end, width, height, px. */
  door: [number, number, number];
}

export const palace = definePainter<PalaceP>("op.palace", {
  bounds(p) {
    return [-200, -(p.h0 + p.h1 + p.h2 + 820), p.w + 200, 64];
  },
  paint(c, p) {
    const w = p.w, seed = c.seed;
    const r0 = 230, r1 = 220, r2 = 290;
    const g0 = -p.h0;
    const s1 = 160;
    const g1top = g0 - r0 * 0.55;
    const g1 = g1top - p.h1;
    const s2 = w * 0.3;
    const g2top = g1 - r1 * 0.55;
    const g2 = g2top - p.h2;
    // the stone platform: big ashlar courses, a lit top edge, grown into the rock below
    fill(c, -44, 0, w + 44, 52, (x, y, _u, v) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      if (ly < 1.2 / c.d) return P.stone[0]!;
      const course = Math.floor(ly / 17);
      const bx = (lx + course * 37) / 64;
      const joint = (bx - Math.floor(bx)) < 0.025 || (ly % 17) < 1.1 / c.d;
      let t = 0.4 + 0.18 * hash(Math.floor(bx), course, seed) + v * 0.15;
      if (joint) t = 0.78;
      if ((ly % 17) < 2.5 && !joint) t -= 0.12;
      // moss and stains creeping up from the rock
      if (v > 0.55 && vnoise(lx / 9, ly / 4, seed + 3) > 0.62 - v * 0.2) return tone(P.moss, 0.55 + v * 0.3, x, y, 0.35);
      if (vnoise(lx / 2.5, ly / 30, seed + 4) > 0.75) t += 0.1;
      return tone(P.stone, clamp(t, 0, 1), x, y, 0.3);
    });
    const [dx, dw, dh] = p.door;
    // the storeys, top down (each one's foot is hidden by the roof below it)
    storey(c, s2, w - s2, g2, g2top + 30, 128, seed + 7, 0.6);
    storey(c, s1, w - s1, g1, g1top + 30, 150, seed + 8, 0.5);
    storey(c, 0, w, g0, -6, 154, seed + 9, 0.35);
    brackets(c, -10, w + 10, g0 - 4, 26, 32);
    brackets(c, s1 - 8, w - s1 + 8, g1 - 4, 24, 30);
    brackets(c, s2 - 8, w - s2 + 8, g2 - 4, 22, 28);
    // the gallery's balustrade along the second storey's foot
    fill(c, s1 - 20, g1top + 8, w - s1 + 20, g1top + 30, (x, y, _u, v) => {
      if (v < 0.18) return tone(P.lacquer, v < 0.06 ? 0.15 : 0.5, x, y, 0.3);
      const k = (c.lx(x + 0.5) / 9) % 1;
      if (v > 0.85) return P.lacquer[3]!;
      return k < 0.35 ? tone(P.lacquer, 0.45, x, y, 0.3) : 0;
    });
    // the seal: the one red, under the top eave
    const sealX = w / 2;
    fill(c, sealX - 32, g2 + 36, sealX + 32, g2 + 100, (x, y, u, v) => {
      const ex = Math.min(u, 1 - u) * 64, ey = Math.min(v, 1 - v) * 64;
      if (ex < 3 || ey < 3) return P.gold[1]!;
      // the seal is the emperor's: a carved inner border only (its mark is the title lane's)
      if (c.d >= 0.5 && (Math.abs(ex - 8) < 1 || Math.abs(ey - 8) < 1) && ex >= 7.5 && ey >= 7.5) return P.red[1]!;
      return tone(P.red, 0.3 + 0.2 * v, x, y, 0.3);
    });
    // the roofs, top tier first, each lapping over the foot of the storey above
    roof(c, s2 - 140, w - s2 + 140, g2 - 22, r2, 0.42, seed + 11);
    roof(c, s1 - 120, w - s1 + 120, g1 - 22, r1, 0.24, seed + 12);
    roof(c, -120, w + 120, g0 - 22, r0, 0.18, seed + 13);
    // lanterns under the first eave, every other bay: red paper, gold caps, a warm core
    if (c.d >= 0.25) {
      for (let lx = 77; lx < w - 40; lx += 308) {
        fill(c, lx - 1, g0 + 20, lx + 1, g0 + 40, () => P.ink[0]!);
        fill(c, lx - 13, g0 + 40, lx + 13, g0 + 78, (x, y, u, v) => {
          const r = Math.abs(u - 0.5) * 2;
          if (r > Math.sqrt(Math.max(0, 1 - Math.pow(v * 2 - 1, 2))) * 1.02 && v > 0.12 && v < 0.88) return 0;
          if (v < 0.12 || v > 0.88) return tone(P.gold, 0.6, x, y, 0.3);
          if (Math.abs(((v * 5) % 1) - 0.5) < 0.08) return P.red[4]!;
          return tone(P.red, u < 0.35 ? 0.0 : u < 0.65 ? 0.18 : 0.45, x, y, 0.3);
        });
      }
    }
    // the gate hall stands out in front of the hall's west end, the doors in its middle
    gateHall(c, dx, dw, dh, seed + 20);
  },
});

export interface DoorsP {
  /** The doorway's width and height, px; the anchor is its foot at the west jamb. */
  w: number;
  h: number;
  /** Frames from shut to open; `frame` is the one shown (code-driven: the driver eases it). */
  frames?: number;
  frame?: number;
}

/**
 * The gate hall's doors (round 7; Dex: "door opening anims should exist"): two leaves of red
 * lacquer studded in gold, a ring handle on a lion mask by the meeting edge, each hung from its
 * outer jamb. They swing IN, away from us: a leaf's face narrows as it turns (seen from the side
 * camera it foreshortens), darkening as it turns out of the light, its meeting edge catching the
 * lamplight from inside, and the lit hall opens between them; light spills out across the steps
 * and warms the doorframe. Shut, a thread of light shows at the seam and under the doors. The
 * frame is chosen by the game from where she stands (visual only).
 */
export const doors = definePainter<DoorsP>("op.doors", {
  bounds(p) {
    return [-64, -p.h - 10, p.w + 64, 14];
  },
  paint(c, p) {
    const d = c.d;
    const n = Math.max(2, p.frames ?? 12);
    const k = clamp((p.frame ?? 0) / (n - 1), 0, 1);
    const ang = k * 1.38;
    const lw = p.w / 2, cos = Math.cos(ang), sin = Math.sin(ang);
    const W = p.w, Hh = p.h;
    // the leaves
    for (const side of [-1, 1]) {
      const hinge = side < 0 ? 0 : W;
      const span = lw * cos;
      const xa = side < 0 ? 0 : W - span, xb = side < 0 ? span : W;
      if (span < 0.4 / d) continue;
      fill(c, xa, -Hh, xb, 0, (x, y, _u, v) => {
        const lx = c.lx(x + 0.5);
        // where this pixel is on the leaf, measured from its hinge in the leaf's own width
        const sl = (Math.abs(lx - hinge) / Math.max(1e-3, cos)) / lw; // 0 hinge .. 1 meeting edge
        if (sl > 1.001) return 0;
        const sw = sl * lw;
        const ey = Math.min(v, 1 - v) * Hh;
        // the meeting edge catches the lamplight from inside once it opens
        if (k > 0.04 && (1 - sl) * lw * cos < 1.6 / d) return tone(P.ember, 0.35 + (1 - k) * 0.3, x, y, 0.3);
        // a dark frame round each leaf
        if (sw < 2.5 || lw - sw < 1.8 || ey < 2.5) return P.lacquer[4]!;
        // the porch roof's shadow over the top of the doors
        const shade = v < 0.24 ? (0.24 - v) / 0.24 : 0;
        // studs: nine rows, five across a leaf, small gold domes lit on their upper west
        const row = v * 9.6 - 0.8, col = (side < 0 ? sl : sl) * 5.6 - 0.8;
        const ry = (row - Math.round(row)) * (Hh / 9.6), rx = (col - Math.round(col)) * (lw / 5.6) * cos;
        if (d >= 0.5 && row > -0.4 && row < 8.4 && col > -0.4 && col < 4.4 && (rx * rx) / Math.max(0.2, cos * cos) + ry * ry < 6.5) {
          return (side < 0 ? rx : -rx) + ry < -0.5 ? P.gold[k > 0.6 ? 2 : 1]! : P.gold[3]!;
        }
        // a ring handle on a lion mask by the meeting edge, at mid height
        const hx = (0.86 - sl) * lw * cos, hy = (v - 0.5) * Hh;
        const rr = Math.hypot(hx / Math.max(0.25, cos), hy - 3);
        if (Math.abs(rr - 6) < 1.1) return P.gold[2]!;
        if (Math.hypot(hx / Math.max(0.25, cos), hy + 3) < 4.5) return tone(P.gold, 0.55, x, y, 0.3);
        // the lacquer: the leaf darkens as it turns out of the light (and away from us)
        let t = 0.6 + v * 0.12 + shade * 0.3 + sin * 0.22;
        if (sl > 0.94) t += 0.12;
        if (sl < 0.06) t -= 0.06;
        return tone(P.red, clamp(t, 0, 1), x, y, 0.35);
      });
    }
    // shut: a thread of light at the seam and under the doors
    if (k < 0.04) {
      fill(c, W / 2 - 0.6, -Hh + 3, W / 2 + 0.6, 0, (x, y, _u, v) => (bayer4(x, y) < 0.35 + v * 0.5 ? P.gold[1]! : P.ember[2]!));
      fill(c, 3, -1.2, W - 3, 0, (x, y) => (bayer4(x, y) < 0.6 ? P.ember[1]! : 0));
      return;
    }
    // the doorframe's inner edges warm in the light
    for (const ex of [-8, W]) fill(c, ex, -Hh - 8, ex + 8, 0, (x, y, u, v) => {
      const inner = ex < 0 ? 1 - u : u;
      if (inner > 0.35 || bayer4(x, y) > k * (1 - inner * 2.2) * (0.4 + v * 0.6)) return 0;
      return inner < 0.15 ? P.ember[2]! : P.ember[3]!;
    });
    // light pours out across the steps and the forecourt stones in front of the doors
    fill(c, -60, 0, W + 60, 13, (x, y, _u, v) => {
      const lx = c.lx(x + 0.5);
      const core = 1 - Math.abs(lx - W / 2) / (W / 2 + 60 * k);
      if (core <= 0) return 0;
      const a = k * core * (1 - v * 0.55);
      if (bayer4(x, y) > a * 1.15) return 0;
      return a > 0.62 ? P.paper[1]! : a > 0.38 ? P.ember[1]! : P.ember[2]!;
    });
  },
});

export interface TowerP {
  /** Height to the tip of the finial, px; the anchor is its foot. */
  h: number;
  /** Width of the shaft, px. */
  w?: number;
}

/**
 * A gate tower (reference 6): a battered stone base with a lantern niche, a timber shaft of
 * lacquer and gold with lattice panels and a round window, two small roofs, a gold finial.
 */
export const tower = definePainter<TowerP>("op.tower", {
  bounds(p) {
    const w = p.w ?? 72;
    return [-w - 60, -p.h - 70, w + 60, 6];
  },
  paint(c, p) {
    const w = p.w ?? 72, half = w / 2, seed = c.seed;
    const baseH = p.h * 0.24;
    // the stone base, battered (wider at the foot), coursed, a lantern niche glowing
    fill(c, -half - 16, -baseH, half + 16, 0, (x, y, _u, v) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const bat = (half + 6) + 10 * v;
      if (Math.abs(lx) > bat) return 0;
      const u = (lx + bat) / (2 * bat);
      if (Math.abs(lx) < 11 && v > 0.32 && v < 0.62) return Math.abs(lx) < 6 && v > 0.38 && v < 0.58 ? (bayer4(x, y) < 0.5 ? P.gold[0]! : P.gold[1]!) : P.ink[0]!;
      const course = Math.floor(-ly / 14);
      const joint = (-ly % 14) < 1.1 / c.d || (((lx + course * 19) / 34) % 1 + 1) % 1 < 0.04;
      let t = u < 0.2 ? 0.15 : u < 0.7 ? 0.4 : 0.65;
      if (joint) t += 0.3;
      if (v > 0.8 && vnoise(lx / 5, ly / 3, seed) > 0.55) return tone(P.moss, 0.6, x, y, 0.3);
      return tone(P.stone, clamp(t + v * 0.1, 0, 1), x, y, 0.3);
    });
    // the shaft: lacquer frame, gold bands, lattice panels, a round window with warm light
    const top = -p.h + 120;
    fill(c, -half, top, half, -baseH, (x, y, u, v) => {
      if (u < 0.09 || u > 0.91) return tone(P.lacquer, u < 0.05 ? 0.2 : u > 0.95 ? 0.8 : 0.5, x, y, 0.3);
      const band = Math.abs(((v * 6) % 1) - 0.02) < 0.025;
      if (band) return tone(P.gold, u < 0.4 ? 0.2 : 0.5, x, y, 0.3);
      const pu = (u - 0.09) / 0.82;
      if (pu < 0.08 || pu > 0.92) return P.lacquer[3]!;
      const gx = c.lx(x + 0.5) / 6, gy = c.ly(y + 0.5) / 6;
      if ((gx - Math.floor(gx)) < 0.25 || (gy - Math.floor(gy)) < 0.25) return P.lacquer[3]!;
      return tone(P.lacquer, 0.35 + pu * 0.3, x, y, 0.3);
    });
    const wy = top + 60;
    fill(c, -18, wy - 18, 18, wy + 18, (x, y) => {
      const r = Math.hypot(c.lx(x + 0.5), c.ly(y + 0.5) - wy);
      if (r > 18) return 0;
      return r > 15 ? P.gold[2]! : r > 12 ? P.ink[0]! : bayer4(x, y) < 0.5 ? P.gold[0]! : P.paper[0]!;
    });
    brackets(c, -half - 6, half + 6, top - 4, 16, 14);
    roof(c, -half - 40, half + 40, top - 6, 56, 0.35, seed + 3, true);
    // the upper pavilion and its roof, a gold finial
    fill(c, -half * 0.6, top - 96, half * 0.6, top - 40, (x, y, u) => tone(P.lacquer, roundT(u, 0.45), x, y, 0.3));
    roof(c, -half * 0.6 - 34, half * 0.6 + 34, top - 96, 50, 0.45, seed + 4, true);
    fill(c, -3, -p.h, 3, top - 150, (x, y, u) => tone(P.gold, u < 0.4 ? 0.2 : 0.55, x, y, 0.3));
    fill(c, -7, -p.h + 8, 7, -p.h + 16, (x, y, u) => tone(P.gold, u < 0.4 ? 0.15 : 0.5, x, y, 0.3));
  },
});

export interface StayP {
  /** The far end of the cable, px from the anchor (the tower's top). */
  dx: number;
  dy: number;
}

/** A cable stay: a heavy rope with a slight sag, lit along its top, prayer pennants along it. */
export const stay = definePainter<StayP>("op.stay", {
  bounds(p) {
    return [Math.min(0, p.dx) - 10, Math.min(0, p.dy) - 10, Math.max(0, p.dx) + 10, Math.max(0, p.dy) + 30];
  },
  paint(c, p) {
    const len = Math.hypot(p.dx, p.dy);
    const n = Math.max(4, Math.ceil(len * c.d * 1.2));
    const at = (t: number): [number, number] => [p.dx * t, p.dy * t + Math.sin(t * Math.PI) * len * 0.035];
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(i / n);
      const X = Math.round(c.X(x)), Y = Math.round(c.Y(y));
      c.buf.set(X, Y, P.earth[3]!);
      c.buf.set(X, Y + 1, P.earth[4]!);
      if (c.d >= 0.5) c.buf.set(X, Y + 2, P.earth[5]!);
    }
    // small pennants hanging along it, paper white and blue with the odd red
    if (c.d >= 0.25) {
      const k = Math.floor(len / 46);
      for (let i = 1; i < k; i++) {
        const t = i / k;
        const [x, y] = at(t);
        const col = hash1(i, c.seed) < 0.15 ? P.red : hash1(i, c.seed) < 0.55 ? P.paper : P.blue;
        fill(c, x - 5, y + 2, x + 5, y + 18, (xx, yy, u, v) => (v > 0.75 && Math.abs(u - 0.5) * 2 < (v - 0.75) * 4 ? 0 : tone(col, u < 0.4 ? 0.1 : 0.4, xx, yy, 0.3)));
      }
    }
  },
});

export interface BannersP {
  /** Span between the two hanging points, px; the anchor is the left one. */
  w: number;
  /** Banner drop, px. */
  drop: number;
  n?: number;
  /** Sway frame (0..3) for the sprite; omitted for the still plate. */
  frame?: number;
}

/** The banners' names: the land's places, in its own script (public names only). */
const NAMES = ["墨宮", "山水", "月門", "天井", "白糸"];

/** Festival banners on a rope between the towers: long paper banners lettered with place names, gold hems. */
export const banners = definePainter<BannersP>("op.banners", {
  bounds(p) {
    return [-10, -8, p.w + 10, p.drop + p.w * 0.12 + 40];
  },
  paint(c, p) {
    const n = p.n ?? 5;
    const f = p.frame ?? 0;
    const sagAt = (lx: number): number => Math.sin((lx / p.w) * Math.PI) * p.w * 0.1;
    for (let lx = 0; lx <= p.w; lx += 0.5 / c.d) {
      const X = Math.round(c.X(lx)), Y = Math.round(c.Y(sagAt(lx)));
      c.buf.set(X, Y, P.earth[3]!);
      c.buf.set(X, Y + 1, P.earth[4]!);
    }
    for (let i = 0; i < n; i++) {
      const bx = ((i + 0.5) / n) * p.w;
      const top = sagAt(bx);
      const bw = Math.min(40, (p.w / n) * 0.5);
      const drop = p.drop * (0.8 + 0.2 * hash(i, 1, c.seed));
      const red = i % 2 === 1;
      const ramp = red ? P.red : P.paper;
      // the sway: the hem swings while the top stays put (sprite frames)
      const swing = Math.sin((f / 4) * Math.PI * 2 + i * 1.3) * 3;
      fill(c, bx - bw / 2 - 6, top + 2, bx + bw / 2 + 6, top + drop + 2, (x, y, _u, v) => {
        const off = swing * v * v;
        const lx = c.lx(x + 0.5) - (bx + off);
        const u = lx / bw + 0.5;
        if (u < 0 || u > 1) return 0;
        const hem = Math.abs(u - 0.5) * 2;
        if (v > 1 - 0.1 * (1 - hem)) return 0;
        if (u < 0.08 || u > 0.92) return ramp[ramp.length - 1]!;
        if (Math.abs(v - 0.06) < 0.035 || Math.abs(v - 0.86) < 0.025) return tone(P.gold, 0.4, x, y, 0.3);
        return tone(ramp, u < 0.3 ? 0.12 : u < 0.7 ? 0.3 : 0.55, x, y, 0.3);
      });
      // a place name down the banner, hand-lettered: ink on the paper ones, gold on the red
      if (c.d >= 0.25) {
        const text = NAMES[i % NAMES.length]!;
        const gs = Math.min(22, bw * 0.62);
        let gy = top + 2 + drop * 0.17;
        for (const ch of text) {
          const v = (gy + gs / 2 - top - 2) / drop;
          glyph(c, ch, bx - gs / 2 + swing * v * v, gy, gs, red ? P.gold[1]! : P.ink[1]!, 0.11);
          gy += gs * 1.3;
        }
      }
    }
  },
});

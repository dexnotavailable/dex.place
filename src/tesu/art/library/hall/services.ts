// The Hall of Works' services, laid out round the middle (round 1, Dex 10-12 / 10-14): the Prize Court
// gate (a moon gate in the back wall's middle bay with the court's daylight in it), Hanko's register desk
// right beside it on the left, the map of Tesu on its right, the main offering box with a clear coin slit,
// the sponsors' board as a ranking, the reading nook under the stair, the display screens the art hangs on
// upstairs. Each one is a silhouette that says what it is at play zoom, sized to her (charScale 0.88:
// about 94 px), standing on the walk line with a contact shadow, lit by its own lamp (lights.ts).
//
// Coordinates: level-1 local px of the play plane; the anchor is on the floor (y 0), y up is negative.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT, HALL_LIGHT_NO_GATE } from "./lights.ts";
import { M, SCREEN, LitField, bevel, clamp, cord, cyl, face, fbm, grain, hash, keep, lathe, mt, poly, rect, tn, vnoise, type At, type Ramp } from "./kit.ts";

const H = 96;

/** Light side for a piece (where its light comes from, -1 left .. 1 right). */
function sideOf(lf: LitField, x: number, y: number): number {
  return clamp(lf.get(x, y).dx * 1.6, -1, 1);
}

/** A soft contact shadow where a foot meets the floor. */
function contact(c: PaintCtx, x0: number, x1: number, strength = 0.7): void {
  const w = x1 - x0;
  rect(c, x0 - 4, -5, x1 + 4, 2, (X, Y, lx, ly) => {
    const u = (lx - x0) / w;
    const edge = clamp(Math.min(u + 0.06, 1.06 - u) * 8, 0, 1);
    const a = strength * edge * (ly > -2 ? 0.8 : 0.4);
    return keep(X, Y, a) ? P.umber[5]! : 0;
  });
}

/** A box face of some material: grain, bevelled edges lit toward the light. */
function box(c: PaintCtx, lf: LitField, side: number, x0: number, y0: number, x1: number, y1: number, ramp: Ramp, seed: number, lo = 0.15, hi = 1, bev = 3, gr = 0.1): void {
  const w = x1 - x0, h = y1 - y0;
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const [nx, ny] = bevel((lx - x0) / w, (ly - y0) / h, bev / w, bev / h);
    return mt(ramp, face(l.k, side, nx, ny) + grain(lx, ly, seed, h > w) * gr, X, Y, lo, hi);
  });
}

/** A gold corner fitting at a box corner. */
function fitting(c: PaintCtx, lf: LitField, side: number, x: number, y: number, sx: number, sy: number, s = 6): void {
  rect(c, Math.min(x, x + sx * s), Math.min(y, y + sy * s), Math.max(x, x + sx * s), Math.max(y, y + sy * s), (X, Y, lx, ly) => {
    const dx = Math.abs(lx - x), dy = Math.abs(ly - y);
    if (dx > 2.2 && dy > 2.2) return 0;
    return mt(M.gold, face(lf.get(lx, ly).k, side, sx * 0.3, sy * -0.3) * 1.05, X, Y, 0.0, 1);
  });
}

/** Distance to the nearest edge of a cracked-ice pattern (jittered cells of size `g`), px. */
function iceEdge(x: number, y: number, g: number, seed: number): number {
  const ci = Math.floor(x / g), cj = Math.floor(y / g);
  let d1 = Infinity, d2 = Infinity;
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
    const px = (i + 0.15 + hash(i, j, seed) * 0.7) * g, py = (j + 0.15 + hash(i, j, seed + 1) * 0.7) * g;
    const d = Math.hypot(x - px, y - py);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return (d2 - d1) / 2;
}

/** Brush strokes that read as script (never real text): a row of glyphs in the box, strokes of `col`. */
function glyphs(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, n: number, seed: number, col: (X: number, Y: number) => number, vertical = false): void {
  const len = vertical ? y1 - y0 : x1 - x0;
  const cell = len / n;
  for (let i = 0; i < n; i++) {
    const a0 = (vertical ? y0 : x0) + i * cell;
    const gx0 = vertical ? x0 : a0 + cell * 0.12, gx1 = vertical ? x1 : a0 + cell * 0.88;
    const gy0 = vertical ? a0 + cell * 0.12 : y0, gy1 = vertical ? a0 + cell * 0.88 : y1;
    const gw = gx1 - gx0, gh = gy1 - gy0;
    rect(c, gx0, gy0, gx1, gy1, (X, Y, lx, ly) => {
      const u = (lx - gx0) / gw, v = (ly - gy0) / gh;
      const r1 = hash(i, 1, seed), r2 = hash(i, 2, seed), r3 = hash(i, 3, seed);
      const hz = Math.abs(v - (0.2 + 0.25 * r1)) < 0.09 || (r2 > 0.4 && Math.abs(v - 0.72) < 0.09);
      const vt = Math.abs(u - (0.35 + 0.3 * r3)) < 0.1 && v > 0.1;
      const dg = r1 > 0.55 && Math.abs(u - v * 0.9 - 0.05) < 0.09 && v > 0.35;
      const dt = r3 > 0.7 && Math.hypot(u - 0.8, v - 0.35) < 0.12;
      return hz || vt || dg || dt ? col(X, Y) : 0;
    });
  }
}

// ===========================================================================
// The Prize Court gate: a moon gate in the back wall's middle bay
// ===========================================================================
export interface GateP {
  /** The bay wall's ends (local x from the gate's centre, px; the gallery's posts stand on them). */
  l: number;
  r: number;
  /** The wall's height up to the gallery's soffit (px). */
  top: number;
  /** The opening's radius and its centre's height above the floor (px). */
  rad: number;
  cy: number;
  at?: At;
}

/** Daylight colours: the sky inside the gate, white-gold at the horizon, pale blue high. */
const DAY_SKY: Ramp = [P.ember[0]!, P.paper[0]!, P.cloud[1]!, P.cloud[2]!, P.cloud[3]!, P.blue[0]!];
const HAZE: Ramp = [P.cloud[1]!, P.cloud[2]!, P.cloud[3]!, P.range[1]!, P.range[2]!, P.range[3]!, P.range[4]!];

export const gate = definePainter<GateP>("hall.gate", {
  bounds(p) {
    return [p.l - 4, -p.top - 4, p.r + 4, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT_NO_GATE, p.at, 12);
    const lfg = new LitField(HALL_LIGHT, p.at, 8);
    const R = p.rad, CY = -p.cy;
    const RING = 0.16 * H;
    const SILL = 7;
    const inOpen = (lx: number, ly: number): boolean => Math.hypot(lx, ly - CY) < R && ly < -SILL + 1;
    const ringD = (lx: number, ly: number): number => Math.hypot(lx, ly - CY);
    const FRIEZE = 0.42 * H, DADO = 0.42 * H;

    // --- the bay wall: a stone dado, dark timber-framed plaster panels, a carved frieze under the gallery
    const pitch = 1.15 * H;
    rect(c, p.l, -p.top, p.r, 0, (X, Y, lx, ly) => {
      const d = ringD(lx, ly);
      if (d < R + RING && ly < 0) return 0;
      const l = lf.get(lx, ly);
      const fromTop = ly + p.top;
      if (fromTop < FRIEZE) {
        // the frieze: a lacquer beam with a gold bead top and bottom and carved cloud scrolls
        const v = fromTop / FRIEZE;
        if (v > 0.9) return mt(M.gold, face(l.k, 0, 0, 0.8) * 0.55, X, Y, 0.3, 1);
        if (v < 0.08) return mt(M.lacq, face(l.k, 0, 0, -0.8) * 0.35, X, Y, 0.4, 1);
        const sc = Math.sin(lx * 0.11 + Math.sin(v * 6.3) * 1.6) * Math.cos(v * 9.4);
        if (Math.abs(sc) < 0.16 && v > 0.2 && v < 0.82) return mt(M.gold, face(l.k, 0) * 0.42, X, Y, 0.4, 1);
        return mt(M.lacq, face(l.k, 0) * 0.48 + grain(lx, ly, 71, false) * 0.05, X, Y, 0.15, 1);
      }
      if (ly > -DADO) {
        // the stone dado with a chamfered cap, chipped, darker at the floor
        const cap = ly < -DADO + 5;
        const chip = fbm(lx * 0.25, ly * 0.25, 77, 2) > 0.72 ? -0.1 : 0;
        const joint = ((((lx + 37) % (0.9 * H)) + 0.9 * H) % (0.9 * H)) < 1.2;
        return mt(M.stone, face(l.k, 0, 0, cap ? -0.8 : 0) * (cap ? 1.05 : 0.72) + chip - (joint ? 0.12 : 0) - (ly > -6 ? 0.12 : 0), X, Y, 0.3, 1);
      }
      // the timber frame: stiles at the pitch (not through the ring), a rail at the dado and a mid rail
      const u = ((((lx + pitch / 2) % pitch) + pitch) % pitch);
      const stile = u < 0.09 * H && d > R + RING + 0.12 * H;
      const rail = ly > -DADO - 0.1 * H || (Math.abs(ly + 3.55 * H) < 0.05 * H && d > R + RING + 0.1 * H);
      if (stile || rail) return mt(M.wood, face(l.k, 0, stile ? (u < 0.045 * H ? -0.6 : 0.6) : 0, rail && ly > -DADO - 0.05 * H ? 0.5 : -0.4) * 0.62, X, Y, 0.35, 1);
      // the plaster: a warm dark ground, softly mottled, so the gate glows inside a calm frame
      const mot = fbm(lx * 0.02, ly * 0.03, 73, 3) - 0.5;
      return mt(M.lacq, face(l.k, 0) * 0.62 + mot * 0.12, X, Y, 0.0, 1, 0.6);
    });

    // --- the view: the Prize Court in daylight (the brightest thing in the hall)
    const horizon = CY + R * 0.18;
    const groundY = -SILL;
    rect(c, -R, CY - R, R, groundY, (X, Y, lx, ly) => {
      if (!inOpen(lx, ly)) return 0;
      const v = (ly - (CY - R)) / (2 * R); // 0 top .. 1 bottom
      // the sky: pale blue high, white-gold toward the horizon, a cloud mass on the left
      let col = tn(DAY_SKY, clamp(0.75 - (ly - (CY - R)) / (horizon - (CY - R)) * 0.75, 0, 1), X, Y, 0.6);
      const cl = fbm(lx * 0.018 + 3, ly * 0.04, 81, 4) + (lx < 0 ? 0.12 : -0.05) - Math.max(0, (horizon - ly) / R - 0.9) * 0.4;
      if (cl > 0.6 && ly < horizon - 8) col = tn(P.cumulus, clamp(0.05 + (ly - (CY - R)) / (2 * R) * 0.5 + (cl > 0.7 ? 0 : 0.2), 0, 1), X, Y, 0.5);
      // far karst peaks in the haze
      const peak = horizon - 6 - (Math.abs(Math.sin(lx * 0.021 + 1.3)) * 0.55 + vnoise(lx * 0.05, 1, 83) * 0.45) * R * 0.42;
      if (ly > peak) col = tn(HAZE, clamp(0.25 + (ly - peak) / (R * 0.5) * 0.4, 0, 1), X, Y, 0.5);
      // the nearer ridge, a little darker and cooler
      const ridge = horizon + 4 - (vnoise(lx * 0.03, 7, 85) * 0.7 + Math.sin(lx * 0.012) * 0.3) * R * 0.2;
      if (ly > ridge) col = tn(HAZE, clamp(0.55 + (ly - ridge) / (R * 0.3) * 0.3, 0, 1), X, Y, 0.5);
      void v;
      return col;
    });
    // the court beyond the gate: the stands' tiers with a crowd, festival banners, the gong tower
    const tierTop = horizon + R * 0.1, standsX0 = -R * 0.95, standsX1 = R * 0.35;
    rect(c, standsX0, tierTop, standsX1, groundY, (X, Y, lx, ly) => {
      if (!inOpen(lx, ly)) return 0;
      // stepped tiers rising to the left, warm stone in the sun, a shadow under each step's nose
      const t = (lx - standsX0) / (standsX1 - standsX0);
      const rows = 4;
      const top = tierTop + t * (groundY - tierTop) * 0.55;
      if (ly < top) return 0;
      const k = (ly - top) / (groundY - top);
      const row = Math.floor(k * rows), f = k * rows - row;
      // the crowd: tiny varied figures sitting on each row
      const cw = 4 + Math.floor(hash(Math.floor(lx / 4), row, 87) * 2);
      const slot = Math.floor(lx / cw);
      const hsh = hash(slot, row, 89);
      if (f < 0.55 && hsh > 0.18) {
        const hu = (lx - slot * cw) / cw;
        const head = f < 0.22 && Math.abs(hu - 0.5) < 0.3;
        const body = f >= 0.22 && Math.abs(hu - 0.5) < 0.42;
        const ramps: Ramp[] = [P.red, P.blue, P.jade, P.gold, P.violet, P.paper, P.timber];
        if (head) return tn(hsh > 0.85 ? P.gold : P.lacquer, 0.35, X, Y, 0);
        if (body) return tn(ramps[Math.floor(hsh * 7) % 7]!, 0.35 + (row / rows) * 0.25, X, Y, 0.4);
      }
      const nose = f > 0.82;
      return tn(P.stone, nose ? 0.62 : 0.3 + row * 0.04, X, Y, 0.4);
    });
    // banners on tall poles, rippling
    for (const [bx, bh, ramp, ph] of [[-R * 0.62, R * 1.05, P.red, 0.3], [-R * 0.18, R * 1.25, P.gold, 1.7], [R * 0.2, R * 0.95, P.red, 2.6]] as const) {
      const top = groundY - bh;
      rect(c, bx - 1, top, bx + 1, groundY, (X, Y, lx, ly) => (inOpen(lx, ly) ? tn(P.timber, 0.55, X, Y, 0) : 0));
      rect(c, bx + 1, top + 3, bx + 13, top + bh * 0.48, (X, Y, lx, ly) => {
        if (!inOpen(lx, ly)) return 0;
        const v = (ly - top - 3) / (bh * 0.45);
        const wave = Math.sin(v * 7 + ph) * 1.6 * v;
        const u = lx - bx - 1 - wave;
        if (u < 0 || u > 11 - v * 2) return 0;
        const tail = v > 0.92 && Math.abs(u - 5) > 2.5;
        if (tail) return 0;
        return tn(ramp, 0.2 + (u > 8 ? 0.25 : 0) + (Math.sin(v * 7 + ph) > 0.6 ? -0.15 : 0.05), X, Y, 0.4);
      });
    }
    // the gong tower on the right: two red posts, a tiled roof with upturned eaves, the gong between
    {
      const tx = R * 0.6, tw = R * 0.24, troof = groundY - R * 1.55;
      for (const px of [tx - tw, tx + tw]) {
        rect(c, px - 3, troof + 8, px + 3, groundY, (X, Y, lx, ly) => (inOpen(lx, ly) ? tn(P.red, lx < px - 0.5 ? 0.25 : 0.55, X, Y, 0.3) : 0));
      }
      for (const by of [troof + R * 0.55, groundY - R * 0.35]) rect(c, tx - tw - 3, by, tx + tw + 3, by + 4, (X, Y, lx, ly) => (inOpen(lx, ly) ? tn(P.red, 0.45, X, Y, 0.3) : 0));
      poly(c, [tx - tw - 18, troof + 10, tx - tw - 8, troof + 4, tx, troof - 6, tx + tw + 8, troof + 4, tx + tw + 18, troof + 10, tx + tw + 6, troof + 9, tx - tw - 6, troof + 9], (X, Y, lx, ly) => (inOpen(lx, ly) ? tn(P.tile, ly < troof + 3 ? 0.25 : 0.5, X, Y, 0.3) : 0));
      const gcy = troof + R * 0.95, gr = R * 0.17;
      rect(c, tx - 1, troof + R * 0.55 + 4, tx + 1, gcy - gr, (X, Y, lx, ly) => (inOpen(lx, ly) ? tn(P.lacquer, 0.3, X, Y, 0) : 0));
      rect(c, tx - gr, gcy - gr, tx + gr, gcy + gr, (X, Y, lx, ly) => {
        if (!inOpen(lx, ly)) return 0;
        const d = Math.hypot(lx - tx, ly - gcy) / gr;
        if (d > 1) return 0;
        return tn(P.bronze, d < 0.25 ? 0.2 : d > 0.8 ? 0.55 : 0.3 + (lx - tx) / gr * 0.2, X, Y, 0.4);
      });
      // its shadow falling down-right on the court
      rect(c, tx + tw + 3, groundY - 5, tx + tw + 26, groundY, (X, Y, lx, ly) => (inOpen(lx, ly) && keep(X, Y, 0.5) ? tn(P.stone, 0.7, X, Y, 0) : 0));
    }
    // the court's paving at the sill: warm stone in the sun
    rect(c, -R, groundY - 5, R, groundY, (X, Y, lx, ly) => {
      if (!inOpen(lx, ly)) return 0;
      const joint = (((lx % 23) + 23) % 23) < 1;
      return tn(P.stone, (ly < groundY - 4 ? 0.12 : 0.28) + (joint ? 0.15 : 0), X, Y, 0.4);
    });

    // --- the gate's reveal: the wall's thickness seen inside the ring, shadowed under its head, the
    // daylight catching its lower curve
    rect(c, -R, CY - R, R, 0, (X, Y, lx, ly) => {
      const d = ringD(lx, ly);
      if (d > R || d < R - 0.11 * H || ly > -SILL) return 0;
      const a = Math.atan2(ly - CY, lx); // -pi/2 at the top
      const under = Math.sin(a); // -1 top .. 1 bottom
      const k = clamp(0.35 + under * 0.45, 0, 1);
      if (under < -0.2) return mt(M.stone, 0.35 + k * 0.3, X, Y, 0.3, 1);
      return mt(M.stone, 0.75 + k * 0.35, X, Y, 0.0, 1);
    });

    // --- the ring: carved stone, a bead inside and out, its inner edge lit by the day
    rect(c, -R - RING, CY - R - RING, R + RING, 0, (X, Y, lx, ly) => {
      const d = ringD(lx, ly);
      if (d < R || d > R + RING) return 0;
      const l = lfg.get(lx, ly);
      const t = (d - R) / RING; // 0 inner .. 1 outer
      const a = Math.atan2(ly - CY, lx);
      const bead = t < 0.16 || t > 0.86;
      const groove = Math.abs(t - 0.32) < 0.06;
      // carved cloud scrolls round the band
      const scroll = Math.sin(a * 18 + Math.sin(t * 6) * 1.2) > 0.55 && t > 0.42 && t < 0.78;
      const inner = t < 0.16 ? 0.35 : 0;
      const n = face(l.k, 0, Math.cos(a) * (t - 0.5) * 1.4, Math.sin(a) * (t - 0.5) * 1.4) + inner;
      if (bead && t > 0.86) return mt(M.gold, n * 0.75, X, Y, 0.15, 1);
      if (groove) return mt(M.stone, n * 0.55, X, Y, 0.3, 1);
      return mt(M.stone, n * (scroll ? 0.78 : 0.95), X, Y, 0.1, 1);
    });

    // --- the sill: a worn stone step across the bottom of the opening, lit by the day on its top
    const chord = Math.sqrt(Math.max(0, R * R - (CY + SILL) ** 2)) + RING * 0.6;
    rect(c, -chord - 6, -SILL - 2, chord + 6, 0, (X, Y, lx, ly) => {
      const top = ly < -SILL + 1;
      const u = Math.abs(lx) / (chord + 6);
      return mt(M.stone, (top ? 1.25 - u * 0.5 : 0.85 - u * 0.3) + (fbm(lx * 0.3, ly, 79, 2) - 0.5) * 0.12, X, Y, 0.0, 1);
    });

    // --- over the ring: the plaque ("the Prize Court", gold strokes on red lacquer in a gold frame) under
    // a small tiled canopy on two carved corbels, so the gate reads as the hall's gate from across the room
    const ringTop = CY - R - RING;
    const py1 = ringTop - 5, py0 = py1 - 0.4 * H, pw = 0.8 * H;
    rect(c, -pw, py0, pw, py1, (X, Y, lx, ly) => {
      const l = lfg.get(lx, ly);
      const e = Math.min(pw - Math.abs(lx), ly - py0, py1 - ly);
      if (e < 2) return mt(M.gold, face(l.k, 0, 0, ly - py0 < 2 ? -0.8 : 0.4) * 0.95, X, Y, 0.05, 1);
      if (e < 4) return mt(M.lacq, face(l.k, 0) * 0.3, X, Y, 0.3, 1);
      return mt(M.verm, face(l.k, 0) * 0.62 + grain(lx, ly, 91, false) * 0.05, X, Y, 0.3, 1);
    });
    glyphs(c, -pw + 10, py0 + 7, pw - 10, py1 - 7, 3, 93, (X, Y) => tn(M.gold, 0.15, X, Y, 0));
    const cw = R + RING + 0.72 * H;
    const beam0 = py0 - 0.16 * H, beam1 = py0 - 3;
    // the corbels under the beam's ends: curled brackets out of the wall
    for (const sx of [-1, 1]) {
      const bx = sx * (cw - 0.3 * H);
      poly(c, [bx - 0.16 * H, beam1, bx + 0.16 * H, beam1, bx + sx * 0.04 * H, beam1 + 0.42 * H, bx - sx * 0.02 * H, beam1 + 0.42 * H], (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const v = (ly - beam1) / (0.42 * H);
        const curl = Math.abs(Math.hypot(lx - bx, ly - beam1 - 0.12 * H) - 0.08 * H) < 1.6;
        return curl ? mt(M.gold, face(l.k, 0) * 0.7, X, Y, 0.2, 1) : mt(M.lacq, face(l.k, 0, (lx - bx) / (0.2 * H), -0.3) * (0.75 - v * 0.2), X, Y, 0.1, 1);
      });
    }
    // the beam: red lacquer with a gold bead, its ends cut in a cloud profile
    rect(c, -cw, beam0, cw, beam1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = (ly - beam0) / (beam1 - beam0), e = cw - Math.abs(lx);
      if (e < 6 && (v < 0.2 || v > 0.8) && e < 6 - Math.sin(v * Math.PI) * 4) return 0;
      if (v < 0.14) return mt(M.gold, face(l.k, 0, 0, -0.9) * 0.85, X, Y, 0.1, 1);
      if (v > 0.86) return mt(M.lacq, face(l.k, 0) * 0.35, X, Y, 0.3, 1);
      const scroll = Math.sin(lx * 0.16) * Math.cos(v * 6) > 0.6 && Math.abs(lx) < cw - 14;
      return mt(scroll ? M.gold : M.verm, face(l.k, 0) * (scroll ? 0.55 : 0.7), X, Y, 0.2, 1);
    });
    // the tiled canopy: rows of tile ridges on a curved roof turned up hard at both ends, round tile-ends
    // along the eave, a ridge with upturned ends and a gold pearl at its middle
    const ew = cw + 0.34 * H, rise = 0.5 * H;
    const liftAt = (t: number): number => Math.pow(Math.max(0, t - 0.55) / 0.45, 2.2) * 0.3 * H;
    const eaveAt = (t: number): number => beam0 + 3 - liftAt(t);
    const ridgeAt = (t: number): number => beam0 - rise + Math.pow(t, 1.8) * rise * 0.5 - liftAt(t) * 0.55;
    rect(c, -ew - 6, beam0 - rise - 14, ew + 6, beam0 + 6, (X, Y, lx, ly) => {
      const t = Math.abs(lx) / ew;
      if (t > 1.03) return 0;
      const eave = eaveAt(Math.min(1, t)), ridge = ridgeAt(Math.min(1, t));
      const l = lf.get(lx, ly);
      // the ridge beam: a dark band along the top with its ends curling up
      if (ly < ridge && ly > ridge - 6 && t < 0.98) return mt(M.lacq, face(l.k, 0, 0, ly < ridge - 4.5 ? -0.9 : 0) * (ly < ridge - 4.5 ? 0.9 : 0.5), X, Y, 0.1, 1);
      if (ly > eave + 3 || ly < ridge) return 0;
      // the round tile-ends along the eave
      if (ly > eave - 2) {
        const k = ((((lx + 300) % 9) + 9) % 9) - 4.5;
        return Math.hypot(k, ly - eave - 0.5) < 3.4 ? mt(M.gold, face(l.k, 0, k / 4, 0.3) * 0.62, X, Y, 0.2, 1) : 0;
      }
      const v = (ly - ridge) / Math.max(1, eave - ridge);
      const k = ((((lx + 300) % 9) + 9) % 9) / 9;
      const course = (((ly - ridge) % 6) + 6) % 6 < 1;
      return mt(M.tile, face(l.k, 0, (k - 0.5) * 1.2, -0.35) * (0.4 + 0.36 * Math.sin(k * Math.PI)) - v * 0.12 - (course ? 0.08 : 0), X, Y, 0.1, 1);
    });
    rect(c, -6, beam0 - rise - 16, 6, beam0 - rise, (X, Y, lx, ly) => (Math.hypot(lx, ly - beam0 + rise + 8) < 5.5 ? mt(M.gold, face(lfg.get(lx, ly).k, 0, lx / 5, (ly - beam0 + rise + 8) / 5) * 1.05, X, Y, 0.0, 1) : 0));

    // --- high in the bay, two lattice clerestories with a cool day behind their paper (the frame round the
    // hot gate stays dark and cool; no lamp up here)
    for (const sx of [-1, 1]) {
      const wx0 = sx < 0 ? -cw + 0.1 * H : cw - 1.5 * H, wx1 = wx0 + 1.4 * H;
      const wy1 = -p.top + FRIEZE + 0.35 * H, wy0 = wy1 + 1.15 * H;
      rect(c, wx0, wy1, wx1, wy0, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const u = (lx - wx0) / (wx1 - wx0), v = (ly - wy1) / (wy0 - wy1);
        if (u < 0.05 || u > 0.95 || v < 0.07 || v > 0.93) return mt(M.lacq, face(l.k, 0, 0, v > 0.93 ? -0.7 : 0) * 0.55, X, Y, 0.2, 1);
        // a cracked-ice fret: irregular cells (never a stamped grid)
        const bar = iceEdge(lx - wx0, ly - wy1, 15, 31 + (sx < 0 ? 0 : 7)) < 0.75;
        if (bar) return mt(M.lacq, face(l.k, 0) * 0.35, X, Y, 0.3, 1);
        return tn(P.tile, clamp(0.62 + v * 0.22 + Math.abs(u - 0.5) * 0.2 - (1 - v) * 0.08, 0, 1), X, Y, 0.5);
      });
    }
  },
});

// ===========================================================================
// Hanko's register desk: a counter at her waist, things on it, pigeonholes and a sign behind
// ===========================================================================
export interface DeskP {
  /** Width (px) and the counter top's height above the floor (px); the anchor is the left end. */
  w: number;
  top: number;
  /** Where the receptionist stands behind it (local x). */
  who: number;
  at?: At;
}

export const desk = definePainter<DeskP>("hall.desk", {
  bounds(p) {
    return [-12, -p.top - 1.75 * H, p.w + 12, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const side = sideOf(lf, p.w / 2, -p.top);
    const W = p.w, T = p.top;

    // --- the pigeonholes on the wall behind her spot: a lacquer cabinet of cells, scrolls and slips in them
    const cx0 = 0.22 * H, cx1 = W - 0.12 * H, cy0 = -T - 1.12 * H, cy1 = -T - 0.06 * H;
    box(c, lf, side, cx0, cy0, cx1, cy1, M.lacq, 3, 0.0, 1, 3, 0.05);
    const cols = 7, rows = 4;
    const cw = (cx1 - cx0 - 8) / cols, ch = (cy1 - cy0 - 8) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x0 = cx0 + 4 + i * cw + 1.5, x1 = x0 + cw - 3, y0 = cy0 + 4 + j * ch + 1.5, y1 = y0 + ch - 3;
      const r = hash(i, j, 41);
      rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const v = (ly - y0) / (y1 - y0), u = (lx - x0) / (x1 - x0);
        // what is in the cell: rolled scrolls (round ends), folded slips standing up, or nothing
        if (r < 0.42) {
          const rr = Math.min((x1 - x0) * 0.22, (y1 - y0) * 0.3);
          for (let k = 0; k < 3; k++) {
            const sx = x0 + rr + 1 + k * rr * 1.9, sy = y1 - rr - 1 - (k === 1 ? rr * 0.9 : 0);
            const d = Math.hypot(lx - sx, ly - sy) / rr;
            if (d < 1) return d < 0.35 ? mt(M.wood, 0.4, X, Y, 0.2, 1) : mt(M.paper, face(l.k, side, (lx - sx) / rr, (ly - sy) / rr) * 0.9, X, Y, 0.0, 0.9);
          }
        } else if (r < 0.72) {
          if (v > 0.3 && u > 0.15 && u < 0.85 && (Math.floor(u * 6) % 2 === 0 || v > 0.55)) {
            const tag = r > 0.62 && v < 0.45 && u < 0.4;
            return tag ? tn(M.verm, 0.35, X, Y, 0) : mt(M.paper, face(l.k, side) * (0.75 + v * 0.1), X, Y, 0.05, 0.9);
          }
        }
        // the cell's back, in shadow; its top lip catches the lamp
        return v < 0.12 ? mt(M.wood, face(l.k, side, 0, 0.6) * 0.5, X, Y, 0.3, 1) : mt(M.lacq, face(l.k, side) * 0.22, X, Y, 0.2, 1);
      });
    }
    // the cabinet's cornice with gold ends
    box(c, lf, side, cx0 - 5, cy0 - 6, cx1 + 5, cy0, M.wood, 5, 0.15, 1, 2);
    for (const fx of [cx0 - 5, cx1 + 5]) fitting(c, lf, side, fx, cy0 - 6, fx < W / 2 ? 1 : -1, 1, 5);

    // --- the sign over the desk: a carved board on two brackets, "register" in gold glyphs
    const sy1 = cy0 - 0.18 * H, sy0 = sy1 - 0.3 * H, sx0 = cx0 + 0.05 * H, sx1 = cx1 - 0.05 * H;
    for (const bx of [sx0 + 8, sx1 - 8]) rect(c, bx - 2, sy1, bx + 2, cy0 - 6, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, (lx - bx) / 2, 0) * 0.7, X, Y, 0.2, 1));
    rect(c, sx0, sy0, sx1, sy1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx - sx0, sx1 - lx, ly - sy0, sy1 - ly);
      if (e < 2) return mt(M.gold, face(l.k, side, 0, ly - sy0 < 2 ? -0.8 : 0.3) * 0.9, X, Y, 0.05, 1);
      return mt(M.wood, face(l.k, side) * 0.55 + grain(lx, ly, 43, false) * 0.08, X, Y, 0.35, 1);
    });
    glyphs(c, sx0 + 8, sy0 + 5, sx1 - 8, sy1 - 5, 2, 45, (X, Y) => tn(M.gold, 0.2, X, Y, 0));

    // --- the counter: plinth, a front lighter than the wall, the top board with a lit lip and a dark edge band
    contact(c, 0, W, 0.85);
    const TOPD = 9;
    box(c, lf, side, 4, -0.09 * H, W - 4, 0, M.lacq, 7, 0.0, 1, 2, 0.04);
    rect(c, 2, -T + TOPD, W - 2, -0.09 * H, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - 2) / (W - 4), v = (ly + T - TOPD) / (T - TOPD - 0.09 * H);
      // three framed panels of warm timber, gold-line insets, the shadow of the top board along their head
      const pn = 3, pu = (u * pn) % 1;
      const stile = pu < 0.05 || pu > 0.95 || u < 0.02 || u > 0.98;
      const rail = v < 0.1 || v > 0.9;
      const inset = !stile && !rail && (Math.abs(pu - 0.12) < 0.012 || Math.abs(pu - 0.88) < 0.012 || Math.abs(v - 0.22) < 0.03 || Math.abs(v - 0.8) < 0.03);
      const shade = v < 0.16 ? 0.28 : 0;
      if (inset) return mt(M.gold, face(l.k, side) * 0.75 - shade, X, Y, 0.15, 1);
      if (stile || rail) return mt(M.wood, face(l.k, side, stile ? (pu < 0.5 ? -0.5 : 0.5) : 0, 0) * 0.68 - shade, X, Y, 0.25, 1);
      return mt(M.wood, face(l.k, side) * 0.86 - shade + grain(lx, ly, 47) * 0.08 - (v > 0.82 ? 0.05 : 0), X, Y, 0.15, 1);
    });
    // the hall's crest on the middle panel, gold, raised
    const scx = W / 2, scy = (-T + TOPD - 0.09 * H) / 2, sr = Math.min(W * 0.07, (T - TOPD) * 0.3);
    rect(c, scx - sr - 1, scy - sr - 1, scx + sr + 1, scy + sr + 1, (X, Y, lx, ly) => {
      const dx = lx - scx, dy = ly - scy, d = Math.hypot(dx, dy) / sr;
      if (d > 1) return 0;
      const a = Math.atan2(dy, dx);
      const on = d > 0.8 || d < 0.6 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)));
      return on ? mt(M.gold, face(lf.get(lx, ly).k, side, dx / sr, dy / sr) * 0.95, X, Y, 0.05, 1) : 0;
    });
    // the top board: overhanging, a bright lip along its whole length, its front edge a darker band
    rect(c, -6, -T, W + 6, -T + TOPD, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = ly + T;
      const endCap = lx < -3 || lx > W + 3;
      if (v < 2) return mt(M.wood, face(Math.max(l.k, 0.55), side, 0, -1) * 1.3, X, Y, 0.0, 1);
      if (v < 3) return mt(M.wood, face(l.k, side, 0, -0.4) * 0.95, X, Y, 0.05, 1);
      return mt(M.lacq, face(l.k, side, endCap ? (lx < 0 ? -0.7 : 0.7) : 0, 0.3) * 0.62 + grain(lx, ly, 49, false) * 0.05, X, Y, 0.0, 1);
    });
    for (const fx of [-6, W + 6]) fitting(c, lf, side, fx, -T, fx < 0 ? 1 : -1, 1, 6);

    // --- on the counter, left to right: the desk lamp, the bell, the open ledger, the brush pot, (her),
    // the ink stone, Hanko's seal and its red ink pad
    const top = -T;
    // the desk lamp: a lacquer stand, a glowing paper shade
    {
      const lx0 = 4, lx1 = 20, sh0 = top - 0.38 * H, sh1 = top - 7;
      rect(c, 10, sh1, 14, top, (X, Y, lx, ly) => mt(M.lacq, face(lf.get(lx, ly).k, side, (lx - 12) / 2, 0) * 0.6, X, Y, 0.1, 1));
      box(c, lf, side, 6, top - 3, 18, top, M.lacq, 3, 0.1, 1, 1, 0);
      rect(c, lx0, sh0, lx1, sh1, (X, Y, lx, ly) => {
        const u = (lx - lx0) / (lx1 - lx0), v = (ly - sh0) / (sh1 - sh0);
        if (v < 0.1 || v > 0.9 || u < 0.1 || u > 0.9) return mt(M.lacq, 0.45, X, Y, 0.1, 1);
        if (Math.abs(u - 0.5) < 0.06) return tn(M.wood, 0.5, X, Y, 0);
        return tn(SCREEN, clamp(0.02 + Math.abs(u - 0.5) * 0.7 + v * 0.18, 0, 1), X, Y, 0.5);
      });
    }
    // the call bell: a brass dome with a knob, a dark foot
    {
      const bx = 28, r0 = 6;
      lathe(c, bx, top - 9, top - 1, (ly) => r0 * Math.sqrt(clamp((ly - top + 9) / 8, 0, 1)) + 0.5, (X, Y, u, _lx, ly) => mt(M.bronze, cyl(lf.get(bx, ly).k, u, side, 0.3) * 1.05, X, Y, 0.0, 1));
      rect(c, bx - 1, top - 12, bx + 1, top - 9, (X, Y) => tn(M.gold, 0.2, X, Y, 0));
      rect(c, bx - r0 - 1, top - 1, bx + r0 + 1, top, (X, Y) => tn(M.lacq, 0.6, X, Y, 0));
    }
    // the ledger, open: two pages bowed up at the spine, lines of script, a red ribbon
    {
      const lx0 = 46, lx1 = 82, mid = (lx0 + lx1) / 2;
      rect(c, lx0 - 2, top - 3, lx1 + 2, top, (X, Y, lx, ly) => mt(M.verm, face(lf.get(lx, ly).k, side) * 0.55, X, Y, 0.3, 1));
      rect(c, lx0, top - 9, lx1, top - 2, (X, Y, lx, ly) => {
        const u = (lx - lx0) / (lx1 - lx0);
        const bow = 7 - Math.abs(u - 0.5) * 6 - (Math.abs(u - 0.5) > 0.42 ? 1 : 0);
        if (ly < top - 2 - bow) return 0;
        const l = lf.get(lx, ly);
        if (Math.abs(lx - mid) < 0.8) return mt(M.paper, face(l.k, side) * 0.55, X, Y, 0.1, 1);
        const edge = ly < top - 1 - bow;
        return mt(M.paper, face(l.k, side, (u - 0.5) * 0.8, edge ? -0.9 : 0) * (edge ? 1.2 : 0.95), X, Y, 0.0, 0.8);
      });
      rect(c, mid + 3, top - 4, mid + 5, top + 5, (X, Y) => tn(M.verm, 0.35, X, Y, 0));
    }
    // the brush pot: blue-and-white porcelain, three brushes
    {
      const bx = 38;
      lathe(c, bx, top - 13, top, (ly) => 4.5 + 1.2 * Math.sin(((ly - top + 13) / 13) * Math.PI), (X, Y, u, _lx, ly) => {
        const pat = Math.sin(u * 6 + ly * 0.6) > 0.55;
        const k = cyl(lf.get(bx, ly).k, u, side);
        return pat ? tn(P.blue, clamp(0.55 - k * 0.4, 0, 1), X, Y, 0.3) : mt(M.paper, k, X, Y, 0, 0.8);
      });
      for (const [bxx, len] of [[35.5, 25], [38.5, 29], [41, 22]] as const) {
        rect(c, bxx, top - len, bxx + 1.5, top - 12, (X, Y, lx, ly) => (ly < top - len + 5 ? tn(M.ink, 0.1, X, Y, 0) : mt(M.wood, face(lf.get(lx, ly).k, side), X, Y, 0.1, 1)));
      }
    }
    // the ink stone with an ink stick lying on it, right of her
    {
      const ix0 = p.who + 0.27 * H, ix1 = ix0 + 18;
      rect(c, ix0, top - 4, ix1, top, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        if (ly < top - 3) return mt(M.stone, face(l.k, side, 0, -0.9) * 0.55, X, Y, 0.4, 1);
        return mt(M.lacq, face(l.k, side) * 0.35, X, Y, 0.3, 1);
      });
      rect(c, ix0 + 3, top - 7, ix1 - 6, top - 4, (X, Y, lx, ly) => mt(M.lacq, face(lf.get(lx, ly).k, side, 0, ly < top - 6 ? -0.8 : 0) * 0.7, X, Y, 0.1, 1));
      rect(c, ix1 - 8, top - 7, ix1 - 6, top - 4, (X, Y) => tn(M.gold, 0.3, X, Y, 0));
    }
    // Hanko's seal standing on its end (a lion knob), and the round red ink pad
    {
      const sx = W - 0.2 * H, px = W - 0.08 * H;
      lathe(c, px, top - 5, top, () => 6, (X, Y, u, _lx, ly) => (ly < top - 3.5 ? tn(P.red, clamp(0.35 - u * 0.2, 0, 1), X, Y, 0.3) : mt(M.lacq, cyl(lf.get(px, ly).k, u, side, 0.3), X, Y, 0.0, 1)));
      lathe(c, sx, top - 16, top, (ly) => (ly < top - 11 ? 3.6 - (top - 11 - ly) * 0.3 : 3), (X, Y, u, _lx, ly) => {
        const k = cyl(lf.get(sx, ly).k, u, side, 0.35);
        if (ly > top - 2) return tn(P.red, 0.4, X, Y, 0);
        return ly < top - 11 ? mt(M.gold, k * 1.05, X, Y, 0.0, 1) : mt(M.verm, k * 0.95, X, Y, 0.1, 1);
      });
    }
  },
});

// ===========================================================================
// The offering box: a sturdy chest with a CLEAR coin slit on its front, a coin dropping in, a lit placard,
// a candle lantern on the lid, coins and offerings at its foot (main), or on a pedestal (upstairs)
// ===========================================================================
export interface DonationP {
  /** The box's width and height (px, lid included); the anchor is its left end on the floor. */
  w: number;
  h: number;
  /** Raised on a pedestal this tall (px): upstairs, so it shows over the balustrade. */
  ped?: number;
  /** The main box: coins and offerings at its foot, the placard and the coin dropping in. */
  main?: boolean;
  at?: At;
}

export const donation = definePainter<DonationP>("hall.donation", {
  bounds(p) {
    return [-0.3 * H, -(p.ped ?? 0) - p.h - 0.55 * H, p.w + 0.3 * H, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 6);
    const W = p.w, Hb = p.h, ped = p.ped ?? 0;
    const side = sideOf(lf, W / 2, -ped - Hb / 2);
    const base = -ped;
    if (ped > 0) {
      // the pedestal: a lacquer post on a stone foot, a gold collar under the box
      contact(c, W * 0.15, W * 0.85, 0.6);
      box(c, lf, side, W * 0.12, -7, W * 0.88, 0, M.stone, 3, 0.2, 1, 2, 0.02);
      lathe(c, W / 2, base + 4, -7, () => W * 0.16, (X, Y, u, _lx, ly) => mt(M.lacq, cyl(lf.get(W / 2, ly).k, u, side, 0.2), X, Y, 0.0, 1));
      box(c, lf, side, W * 0.1, base, W * 0.9, base + 5, M.gold, 5, 0.1, 1, 1, 0);
    } else {
      contact(c, -2, W + 2, 0.9);
    }
    // the feet and the plinth
    const footH = 5;
    for (const fx of [2, W - 9]) box(c, lf, side, fx, base - footH, fx + 7, base, M.lacq, 2, 0.05, 1, 1, 0);
    // the body: lacquered timber, warm and lit (lighter than the wall behind), gold bands and corners
    const lidH = 0.1 * H;
    const b0 = base - Hb + lidH, b1 = base - footH;
    rect(c, 0, b0, W, b1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = lx / W, v = (ly - b0) / (b1 - b0);
      const [nx, ny] = bevel(u, v, 3 / W, 3 / (b1 - b0));
      const band = Math.abs(v - 0.84) < 0.05;
      if (band) return mt(M.gold, face(l.k, side, nx, -0.3) * 0.95, X, Y, 0.05, 1);
      const slats = (((lx % 9) + 9) % 9) < 1 && v > 0.45 && v < 0.79;
      return mt(M.verm, face(l.k, side, nx, ny) * 0.92 - (slats ? 0.12 : 0) + grain(lx, ly, 51) * 0.06 - v * 0.08, X, Y, 0.1, 1);
    });
    for (const [fx, fy, sx, sy] of [[0, b0, 1, 1], [W, b0, -1, 1], [0, b1, 1, -1], [W, b1, -1, -1]] as const) fitting(c, lf, side, fx, fy, sx, sy, 6);
    // the lid: an overhanging board, its top lip lit, a darker band under it
    rect(c, -3, base - Hb, W + 3, b0 + 1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = ly - (base - Hb);
      if (v < 1) return mt(M.wood, face(Math.max(0.55, l.k), side, 0, -1) * 1.3, X, Y, 0.0, 1);
      if (v > lidH - 2) return mt(M.gold, face(l.k, side, 0, 0.4) * 0.8, X, Y, 0.1, 1);
      return mt(M.verm, face(l.k, side, lx < 0 ? -0.6 : lx > W ? 0.6 : 0, -0.2) * 0.62, X, Y, 0.15, 1);
    });
    // the slit: a black slot on the front just under the lid, a brass escutcheon round it, a lit lip over it
    const slW = Math.min(22, W * 0.46), slY = b0 + 5;
    const ex0 = W / 2 - slW / 2 - 5, ex1 = W / 2 + slW / 2 + 5, ey0 = slY - 4, ey1 = slY + 7;
    rect(c, ex0, ey0, ex1, ey1, (X, Y, lx, ly) => {
      const u = (lx - ex0) / (ex1 - ex0), v = (ly - ey0) / (ey1 - ey0);
      const rr = Math.hypot(Math.max(0, Math.abs(u - 0.5) - 0.4) * (ex1 - ex0), Math.max(0, Math.abs(v - 0.5) - 0.2) * (ey1 - ey0));
      if (rr > 3.2) return 0;
      const l = lf.get(lx, ly);
      const edge = rr > 2.2 || v < 0.1 || v > 0.9;
      const rivet = Math.abs(v - 0.5) < 0.18 && (Math.abs(u - 0.07) < 0.04 || Math.abs(u - 0.93) < 0.04);
      if (rivet) return tn(M.gold, 0.05, X, Y, 0);
      return mt(M.gold, face(Math.max(0.5, l.k), side, (u - 0.5) * 0.8, (v - 0.5) * 1.2) * (edge ? 0.7 : 1.0), X, Y, 0.0, 1);
    });
    rect(c, W / 2 - slW / 2, slY - 1, W / 2 + slW / 2, slY, (X, Y) => tn(M.gold, 0.0, X, Y, 0));
    rect(c, W / 2 - slW / 2, slY, W / 2 + slW / 2, slY + 3, () => P.ink[0]!);
    if (p.main) {
      // a coin going into the slit: its upper half still out, glinting
      const cx = W / 2 + 4, cr = 3.6;
      rect(c, cx - cr, slY - cr, cx + cr, slY, (X, Y, lx, ly) => {
        const d = Math.hypot(lx - cx, ly - slY) / cr;
        if (d > 1) return 0;
        return d > 0.75 ? tn(M.gold, 0.5, X, Y, 0) : lx < cx && ly < slY - 1.5 ? tn(M.gold, 0.0, X, Y, 0) : tn(M.gold, 0.22, X, Y, 0);
      });
    }
    // a lit placard standing on the lid at the left ("offerings"), a candle lantern on the right
    {
      const qx0 = 2, qx1 = qx0 + Math.max(11, W * 0.24), qy1 = base - Hb, qy0 = qy1 - 0.24 * H;
      rect(c, qx0 + 3, qy1 - 3, qx1 - 3, qy1, (X, Y) => tn(M.lacq, 0.5, X, Y, 0));
      rect(c, qx0, qy0, qx1, qy1 - 2, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const e = Math.min(lx - qx0, qx1 - lx, ly - qy0, qy1 - 2 - ly);
        if (e < 1.5) return mt(M.wood, face(l.k, side) * 0.7, X, Y, 0.2, 1);
        return mt(M.paper, face(Math.max(0.6, l.k), side) * 1.05, X, Y, 0.0, 0.8);
      });
      glyphs(c, qx0 + 3, qy0 + 3, qx1 - 3, qy1 - 5, 2, 53, (X, Y) => tn(P.red, 0.35, X, Y, 0), true);
      const lx0 = W - 12, lx1 = W - 2, l0 = qy1 - 0.19 * H, l1 = qy1 - 2;
      rect(c, lx0, l0, lx1, l1, (X, Y, lx, ly) => {
        const u = (lx - lx0) / (lx1 - lx0), v = (ly - l0) / (l1 - l0);
        if (v < 0.12 || v > 0.86 || u < 0.15 || u > 0.85) return mt(M.lacq, 0.45, X, Y, 0.1, 1);
        return tn(SCREEN, clamp(Math.abs(u - 0.5) * 0.8 + Math.abs(v - 0.55) * 0.5, 0, 1), X, Y, 0.4);
      });
      rect(c, lx0 + 1, l1, lx1 - 1, qy1, (X, Y) => tn(M.lacq, 0.55, X, Y, 0));
    }
    if (p.main && ped === 0) {
      // at its foot: coins (scattered and a little stack), a tied bundle of slips, a mandarin on a dish
      for (const [ox, oy] of [[-6, -1], [-3, 0], [W + 3, -1], [W + 6, 0], [W / 2 - 8, 1]] as const) {
        rect(c, ox - 2, oy - 1.5, ox + 2, oy, (X, Y, lx) => (lx < ox ? tn(M.gold, 0.15, X, Y, 0) : tn(M.gold, 0.45, X, Y, 0)));
      }
      for (let i = 0; i < 3; i++) rect(c, W + 1 - i * 0.5, -2 - i * 2, W + 6 - i * 0.5, -i * 2, (X, Y, lx) => (lx < W + 4 ? tn(M.gold, 0.1, X, Y, 0) : tn(M.gold, 0.35 + i * 0.05, X, Y, 0)));
      // the dish and its mandarin, left of the box
      rect(c, -15, -2, -4, 0, (X, Y) => tn(P.paper, 0.45, X, Y, 0));
      rect(c, -13, -9, -6, -2, (X, Y, lx, ly) => {
        const d = Math.hypot((lx + 9.5) / 3.6, (ly + 5.5) / 3.4);
        if (d > 1) return 0;
        if (ly < -8 && Math.abs(lx + 9.5) < 1) return tn(P.moss, 0.4, X, Y, 0);
        return tn(P.ember, clamp(0.62 + (lx + 9.5) / 3.6 * 0.15 + (ly + 5.5) / 3.4 * 0.12, 0, 1), X, Y, 0.3);
      });
    }
  },
});

// ===========================================================================
// The sponsors' board: a ranking. A header plaque under a small tiled cap, then name tablets hung in
// rank order on a dark backing: the first larger and gold, then silver, bronze and plain wood, each a
// different length like the names on it (strokes only: no real names until the first real sponsor)
// ===========================================================================
const SILVER: Ramp = [P.snow[0]!, P.cloud[2]!, P.cloud[4]!, P.stone[3]!, P.stone[5]!, P.lacquer[1]!, P.lacquer[3]!];

export const ranking = definePainter<{ w: number; h: number; at?: At }>("hall.ranking", {
  bounds(p) {
    return [-0.35 * H, -p.h - 0.3 * H, p.w + 0.45 * H, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const W = p.w, Ht = p.h;
    const side = sideOf(lf, W / 2, -Ht * 0.6);
    contact(c, -8, W + 8, 0.7);
    const headH = 0.36 * H;
    // the posts on stone feet
    for (const fx of [5, W - 5]) {
      box(c, lf, side, fx - 0.11 * H, -8, fx + 0.11 * H, 0, M.stone, 3, 0.25, 1, 2, 0.02);
      lathe(c, fx, -Ht + headH, -8, () => 3.6, (X, Y, u, _lx, ly) => mt(M.lacq, cyl(lf.get(fx, ly).k, u, side, 0.2), X, Y, 0.0, 1));
    }
    // the backing: dark lacquer, a gold line inside its edge, a carved base rail
    const bx0 = 11, bx1 = W - 11, by0 = -Ht + headH + 2, by1 = -0.3 * H;
    rect(c, bx0, by0, bx1, by1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx - bx0, bx1 - lx, ly - by0, by1 - ly);
      if (Math.abs(e - 3) < 0.7) return mt(M.gold, face(l.k, side) * 0.6, X, Y, 0.25, 1);
      return mt(M.lacq, face(l.k, side) * (e < 2 ? 0.55 : 0.4) + grain(lx, ly, 55) * 0.04, X, Y, 0.1, 1);
    });
    box(c, lf, side, bx0 - 3, by1, bx1 + 3, by1 + 6, M.wood, 57, 0.2, 1, 2);
    // the header: red lacquer in a gold frame, a gold crest at its middle, strokes either side
    const hx0 = -6, hx1 = W + 6, hy0 = -Ht, hy1 = -Ht + headH;
    rect(c, hx0, hy0, hx1, hy1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx - hx0, hx1 - lx, ly - hy0, hy1 - ly);
      if (e < 2) return mt(M.gold, face(l.k, side, 0, ly - hy0 < 2 ? -0.9 : 0.5) * 1.0, X, Y, 0.0, 1);
      if (e < 3.5) return mt(M.lacq, face(l.k, side) * 0.35, X, Y, 0.3, 1);
      return mt(M.verm, face(l.k, side) * 0.82 + grain(lx, ly, 59, false) * 0.05, X, Y, 0.1, 1);
    });
    {
      const ccx = W / 2, ccy = (hy0 + hy1) / 2, cr = headH * 0.36;
      rect(c, ccx - cr, ccy - cr, ccx + cr, ccy + cr, (X, Y, lx, ly) => {
        const dx = lx - ccx, dy = ly - ccy, d = Math.hypot(dx, dy) / cr;
        if (d > 1) return 0;
        const a = Math.atan2(dy, dx);
        const petal = d < 0.75 * (0.5 + 0.5 * Math.abs(Math.cos(a * 2.5)));
        return d > 0.82 || petal ? mt(M.gold, face(lf.get(lx, ly).k, side, dx / cr, dy / cr) * 1.05, X, Y, 0.0, 1) : mt(M.verm, 0.4, X, Y, 0.3, 1);
      });
      glyphs(c, hx0 + 7, hy0 + 7, ccx - cr - 4, hy1 - 7, 2, 61, (X, Y) => tn(M.gold, 0.15, X, Y, 0));
      glyphs(c, ccx + cr + 4, hy0 + 7, hx1 - 7, hy1 - 7, 2, 63, (X, Y) => tn(M.gold, 0.15, X, Y, 0));
    }
    // its small tiled cap with turned-up eaves
    {
      const ry1 = hy0, ry0 = hy0 - 0.14 * H;
      poly(c, [hx0 - 10, ry1 - 1, hx0 - 5, ry1 - 5, W / 2, ry0, hx1 + 5, ry1 - 5, hx1 + 10, ry1 - 1, hx1 + 3, ry1, hx0 - 3, ry1], (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const k = ((((lx - hx0) % 7) + 7) % 7) / 7;
        return mt(M.tile, face(l.k, side, (k - 0.5) * 1.2, -0.4) * (0.45 + 0.35 * Math.sin(k * Math.PI)) + (ly > ry1 - 2 ? -0.1 : 0), X, Y, 0.1, 1);
      });
      rect(c, W / 2 - 3, ry0 - 6, W / 2 + 3, ry0 + 1, (X, Y, lx, ly) => (Math.hypot(lx - W / 2, ly - ry0 + 2.5) < 3.4 ? mt(M.gold, face(lf.get(lx, ly).k, side), X, Y, 0.0, 1) : 0));
    }
    // the tablets, in rank order
    const tabs: [number, number, Ramp][] = [[0.8, 0.24, M.gold], [0.7, 0.17, SILVER], [0.66, 0.17, P.bronze], [0.58, 0.14, M.wood], [0.48, 0.14, M.wood], [0.53, 0.14, M.wood]];
    let ty = by0 + 9;
    tabs.forEach(([fw, fh, ramp], i) => {
      const tw = (bx1 - bx0) * fw + (i === 0 ? 10 : 0), th = fh * H;
      const tx0 = (bx0 + bx1) / 2 - tw / 2 + (i % 2 === 1 ? -2 : i > 2 ? 2 : 0), tx1 = tx0 + tw;
      const y0 = ty, y1 = ty + th;
      // its peg and cords
      rect(c, (tx0 + tx1) / 2 - 1.5, y0 - 5, (tx0 + tx1) / 2 + 1.5, y0 - 2, (X, Y) => tn(M.gold, 0.25, X, Y, 0));
      for (const kx of [tx0 + 5, tx1 - 5]) cord(c, kx, y0, (tx0 + tx1) / 2, y0 - 3.5, 0, (X, Y) => tn(M.verm, 0.4, X, Y, 0));
      const metal = i < 3;
      rect(c, tx0, y0, tx1, y1, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const u = (lx - tx0) / tw, v = (ly - y0) / th;
        const [nx, ny] = bevel(u, v, 2 / tw, 2 / th);
        const lip = ly - y0 < 1;
        const k = face(Math.max(l.k, metal ? 0.5 : 0.35), side, nx, ny) * (lip ? 1.25 : 1) + (metal ? Math.sin(u * 9 + v * 3) * 0.04 : grain(lx, ly, 65 + i, false) * 0.1);
        return mt(ramp, k, X, Y, 0.0, metal ? 0.85 : 0.9);
      });
      // the rank's medallion at the left, the name as strokes of its length
      const mx = tx0 + th * 0.55, my = (y0 + y1) / 2, mr = th * 0.32;
      rect(c, mx - mr, my - mr, mx + mr, my + mr, (X, Y, lx, ly) => {
        const d = Math.hypot(lx - mx, ly - my) / mr;
        if (d > 1) return 0;
        return d > 0.65 ? tn(M.lacq, 0.55, X, Y, 0) : tn(i === 0 ? P.red : M.lacq, i === 0 ? 0.3 : 0.4, X, Y, 0);
      });
      const n = Math.max(2, Math.round((tw - th * 1.2) / (th * 0.95)));
      glyphs(c, mx + mr + 3, y0 + th * 0.2, tx1 - 4, y1 - th * 0.2, n, 67 + i * 3, (X, Y) => tn(metal ? M.lacq : M.ink, metal ? 0.55 : 0.2, X, Y, 0));
      if (i === 0) {
        // the first one's red tassels
        for (const tx of [tx0 - 1, tx1 + 1]) rect(c, tx - 1, my - 1, tx + 1, my + 12, (X, Y, _lx, ly) => tn(M.verm, ly > my + 7 ? 0.45 : 0.3, X, Y, 0));
      }
      ty = y1 + 6;
    });
    // (its lamp is the lantern hanging over it from the gallery: lights.ts, so nothing widens its silhouette)
  },
});

// ===========================================================================
// The map of Tesu, unrolled on a timber stand: the coast and the sea, the lake, the gate road climbing
// to the palace (marked and lit), the court at its end, routes, a compass and a title cartouche
// ===========================================================================
export const map = definePainter<{ w: number; at?: At }>("hall.map", {
  bounds(p) {
    return [-12, -1.35 * H, p.w + 12, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const W = p.w;
    const side = sideOf(lf, W / 2, -0.7 * H);
    contact(c, -2, W + 2, 0.7);
    const by0 = -1.17 * H, by1 = -0.32 * H;
    // the stand: two splayed legs on feet, a brace, the frame's crest rail with gold knobs
    for (const [lx0, splay] of [[12, -5], [W - 12, 5]] as const) {
      poly(c, [lx0 - 3, by0 + 4, lx0 + 3, by0 + 4, lx0 + 3 + splay, 0, lx0 - 3 + splay, 0], (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, (lx - lx0) / 4, 0) * 0.8 + grain(lx, ly, 69) * 0.06, X, Y, 0.2, 1));
      box(c, lf, side, lx0 + splay - 7, -5, lx0 + splay + 7, 0, M.lacq, 3, 0.1, 1, 1, 0);
    }
    box(c, lf, side, 14, -0.17 * H, W - 14, -0.17 * H + 4, M.wood, 71, 0.25, 1, 1);
    box(c, lf, side, -5, by0 - 7, W + 5, by0, M.wood, 73, 0.15, 1, 2);
    for (const kx of [-7, W + 7]) lathe(c, kx, by0 - 9, by0 + 2, () => 3.6, (X, Y, u, _lx, ly) => mt(M.gold, cyl(lf.get(kx, ly).k, u, side), X, Y, 0.0, 1));
    // the frame and the mount (a dark teal silk border)
    rect(c, 0, by0, W, by1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx, W - lx, ly - by0, by1 - ly);
      if (e < 3) return mt(M.wood, face(l.k, side, lx < 3 ? -0.6 : lx > W - 3 ? 0.6 : 0, ly < by0 + 3 ? -0.6 : 0.5) * 0.8, X, Y, 0.2, 1);
      return tn(P.jade, clamp(0.78 - l.k * 0.25, 0, 1), X, Y, 0.4);
    });
    // the map itself
    const mx0 = 7, mx1 = W - 7, my0 = by0 + 6, my1 = by1 - 6;
    const mw = mx1 - mx0, mh = my1 - my0;
    const U = (u: number): number => mx0 + u * mw, V = (v: number): number => my0 + v * mh;
    const coast = (v: number, lx: number): number => 0.24 + 0.05 * Math.sin(v * 7.5 + 0.6) + 0.04 * (vnoise(v * 9, lx * 0.01, 75) - 0.5) - (v > 0.82 ? (v - 0.82) * 1.2 : 0);
    rect(c, mx0, my0, mx1, my1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - mx0) / mw, v = (ly - my0) / mh;
      const lit = Math.max(0.55, l.k);
      const age = fbm(u * 4, v * 3, 77, 3) - 0.5;
      const vig = Math.max(0, Math.max(Math.abs(u - 0.5) - 0.38, Math.abs(v - 0.5) - 0.34)) * 2.2;
      const cu = coast(v, lx);
      // the sea: a jade wash, wave ticks, deeper off the coast
      if (u < cu) {
        const shore = cu - u < 0.012;
        if (shore) return tn(P.jade, 0.62, X, Y, 0);
        const tick = Math.abs(Math.sin(lx * 0.9 + Math.floor(ly / 4) * 1.7)) > 0.93 && (Math.floor(ly) % 4 === 0);
        return tn(P.jade, clamp(0.12 + (cu - u) * 0.9 + (tick ? 0.18 : 0) + vig - (lit - 0.55) * 0.3, 0, 1), X, Y, 0.4);
      }
      // the lake (Hoai Pho)
      const ld = Math.hypot((u - 0.6) / 0.12, (v - 0.78) / 0.13);
      if (ld < 1) return ld > 0.84 ? tn(P.blue, 0.55, X, Y, 0) : tn(P.blue, clamp(0.12 + ld * 0.12, 0, 1), X, Y, 0.4);
      // the land: aged paper, a hint of green low
      const green = vnoise(u * 5, v * 5, 79) > 0.62 && v > 0.55;
      return green ? tn(P.moss, clamp(0.25 + vig, 0, 1), X, Y, 0.4) : mt(M.paper, lit * (1.0 - vig) + age * 0.18, X, Y, 0.0, 0.85);
    });
    // mountains: little inked peaks in two ranges, the palace's cliff the tallest
    const peaks: [number, number, number][] = [[0.42, 0.32, 0.09], [0.5, 0.27, 0.12], [0.57, 0.33, 0.08], [0.66, 0.42, 0.07], [0.83, 0.42, 0.1], [0.92, 0.47, 0.08], [0.36, 0.22, 0.07]];
    for (const [pu, pv, ph] of peaks) {
      const px = U(pu), py = V(pv), hh = ph * mh * 2.2, hw = hh * 0.85;
      poly(c, [px - hw, py, px, py - hh, px + hw, py], (X, Y, lx, ly) => {
        const shade = lx > px ? 0.35 : 0.08;
        const ridge = Math.abs(lx - px) < 0.7 || ly > py - 1;
        return ridge ? tn(M.ink, 0.25, X, Y, 0) : tn(P.timber, 0.15 + shade + (ly - py + hh) / hh * 0.1, X, Y, 0.4);
      });
    }
    // forest dots
    for (let i = 0; i < 26; i++) {
      const fu = 0.3 + hash(i, 1, 81) * 0.6, fv = 0.48 + hash(i, 2, 81) * 0.42;
      if (Math.hypot((fu - 0.6) / 0.14, (fv - 0.78) / 0.15) < 1 || fu < coast(fv, 0) + 0.03) continue;
      const x = U(fu), y = V(fv);
      rect(c, x - 1, y - 1, x + 1, y + 1, (X, Y) => tn(P.moss, 0.55, X, Y, 0));
    }
    // routes: dashed ink between the places; the gate road in red, dashed, from the jetty to the palace
    const path = (pts: [number, number][], col: (X: number, Y: number) => number, dash: number): void => {
      let acc = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [u0, v0] = pts[i]!, [u1, v1] = pts[i + 1]!;
        const x0 = U(u0), y0 = V(v0), x1 = U(u1), y1 = V(v1);
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let k = 0; k < n; k++, acc++) {
          if (acc % (dash * 2) >= dash) continue;
          const t = k / n;
          const X = Math.round(c.X(x0 + (x1 - x0) * t)), Y = Math.round(c.Y(y0 + (y1 - y0) * t));
          const v = col(X, Y);
          if (v > 0) c.buf.set(X, Y, v);
        }
      }
    };
    path([[0.62, 0.9], [0.66, 0.72], [0.88, 0.58], [0.82, 0.26]], (X, Y) => tn(M.ink, 0.3, X, Y, 0), 2);
    path([[0.27, 0.64], [0.38, 0.82], [0.5, 0.8]], (X, Y) => tn(M.ink, 0.3, X, Y, 0), 2);
    path([[0.27, 0.64], [0.34, 0.6], [0.4, 0.5], [0.5, 0.47], [0.58, 0.4], [0.66, 0.32], [0.74, 0.25]], (X, Y) => tn(P.red, 0.25, X, Y, 0), 3);
    // the jetty into the sea, Shiraito's falls by the cliff
    rect(c, U(0.19), V(0.64) - 0.5, U(0.27), V(0.64) + 1, (X, Y) => tn(P.timber, 0.6, X, Y, 0));
    rect(c, U(0.9) - 0.5, V(0.49), U(0.9) + 1, V(0.6), (X, Y) => tn(P.blue, 0.2, X, Y, 0));
    // the palace: a small roof mark on its cliff, lit (a warm halo), the court a gold dot at its east end
    {
      const px = U(0.77), py = V(0.24);
      rect(c, px - 9, py - 9, px + 9, py + 7, (X, Y, lx, ly) => {
        const d = Math.hypot(lx - px, (ly - py) * 1.2) / 9;
        return d < 1 && d > 0.55 && keep(X, Y, (1 - d) * 0.9) ? P.gold[1]! : 0;
      });
      poly(c, [px - 6, py - 1, px - 3, py - 4, px + 3, py - 4, px + 6, py - 1], (X, Y) => tn(P.red, 0.3, X, Y, 0));
      rect(c, px - 3, py - 1, px + 3, py + 3, (X, Y, lx) => tn(P.red, Math.abs(lx - px) < 1 ? 0.55 : 0.15, X, Y, 0));
      rect(c, U(0.86) - 1.5, V(0.25) - 1.5, U(0.86) + 1.5, V(0.25) + 1.5, (X, Y) => tn(M.gold, 0.05, X, Y, 0));
    }
    // the title cartouche on the sea, a compass rose in the corner
    {
      const tx0 = U(0.03), tx1 = U(0.2), ty0 = V(0.06), ty1 = V(0.2);
      rect(c, tx0, ty0, tx1, ty1, (X, Y, lx, ly) => {
        const e = Math.min(lx - tx0, tx1 - lx, ly - ty0, ty1 - ly);
        return e < 1 ? tn(P.red, 0.35, X, Y, 0) : mt(M.paper, 0.95, X, Y, 0.0, 0.8);
      });
      glyphs(c, tx0 + 2, ty0 + 2, tx1 - 2, ty1 - 2, 2, 83, (X, Y) => tn(M.ink, 0.1, X, Y, 0));
      const cx = U(0.93), cyy = V(0.86), cr = 6;
      rect(c, cx - cr, cyy - cr, cx + cr, cyy + cr, (X, Y, lx, ly) => {
        const dx = lx - cx, dy = ly - cyy;
        const a = Math.atan2(dy, dx), d = Math.hypot(dx, dy) / cr;
        const star = d < 0.25 + 0.75 * Math.pow(Math.abs(Math.cos(a * 2)), 6);
        if (!star || d > 1) return 0;
        return dy < 0 && Math.abs(dx) < 1.2 ? tn(P.red, 0.3, X, Y, 0) : tn(M.ink, 0.3, X, Y, 0);
      });
    }
  },
});

// ===========================================================================
// The reading nook: a rug, a bench with a cushion and a bolster (Seo's seat: the middle stays free), a
// side table with an open book and a cup of tea, books stacked on the floor
// ===========================================================================
export interface NookP {
  /** The bench's and the table's ends (local x from the anchor, px). */
  bench: [number, number];
  table: [number, number];
  at?: At;
}

export const nook = definePainter<NookP>("hall.nook", {
  bounds(p) {
    return [p.bench[0] - 0.4 * H, -0.85 * H, p.table[1] + 0.2 * H, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const [b0, b1] = p.bench, [t0, t1] = p.table;
    const side = sideOf(lf, (b0 + t1) / 2, -0.4 * H);
    // the rug: its front edge on the floor, woven bands, a fringe
    const r0 = b0 - 0.3 * H, r1 = t1 + 0.12 * H;
    rect(c, r0, -3, r1, 1, (X, Y, lx, ly) => {
      if (ly > -0.5) return (((lx % 3) + 3) % 3) < 1 ? tn(P.paper, 0.6, X, Y, 0) : 0;
      const band = Math.floor((lx - r0) / 7) % 3;
      return tn(band === 0 ? P.red : band === 1 ? P.blue : P.gold, ly < -2 ? 0.35 : 0.6, X, Y, 0.3);
    });
    // books stacked on the floor at the bench's left end
    {
      const sx = b0 - 0.27 * H;
      const books: [number, number, Ramp][] = [[22, 6, P.blue], [19, 5, M.verm], [20, 5, P.moss], [16, 4, M.paper]];
      let y = -3;
      books.forEach(([w, th, ramp], i) => {
        const x0 = sx + (i % 2) * 2 - w / 2;
        box(c, lf, side, x0, y - th, x0 + w, y, ramp, 85 + i, 0.15, 0.95, 1, 0.02);
        rect(c, x0 + 2, y - th + 1, x0 + 3, y - 1, (X, Y) => tn(M.gold, 0.3, X, Y, 0));
        y -= th;
      });
    }
    // the bench: two legs, an apron, the seat board, a red cushion, a bolster at its right end
    const seat = 0.42 * H;
    contact(c, b0, b1, 0.75);
    for (const lx0 of [b0 + 3, b1 - 9]) box(c, lf, side, lx0, -seat + 6, lx0 + 6, -3, M.wood, 87, 0.3, 1, 1);
    box(c, lf, side, b0 + 2, -seat + 6, b1 - 2, -seat + 12, M.wood, 89, 0.25, 1, 1);
    rect(c, b0 - 3, -seat, b1 + 3, -seat + 6, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, 0, ly < -seat + 1.5 ? -1 : 0.3) * (ly < -seat + 1.5 ? 1.15 : 0.8), X, Y, 0.1, 1));
    rect(c, b0 + 1, -seat - 6, b1 - 1, -seat, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - b0) / (b1 - b0), v = (ly + seat + 6) / 6;
      if ((u < 0.03 || u > 0.97) && v < 0.3) return 0;
      const tuft = Math.abs(((u * 4) % 1) - 0.5) < 0.04 && v > 0.3 && v < 0.6;
      return mt(M.verm, face(l.k, side, 0, v < 0.3 ? -0.8 : 0.3) * (tuft ? 0.7 : 0.95), X, Y, 0.05, 1);
    });
    {
      const bx = b1 - 9, by = -seat - 6;
      rect(c, bx - 8, by - 14, bx + 8, by, (X, Y, lx, ly) => {
        const u = (lx - bx) / 8, v = (ly - by + 7) / 7;
        if (Math.hypot(Math.max(0, Math.abs(u) - 0.55) / 0.45, v) > 1) return 0;
        const band = Math.abs(Math.abs(u) - 0.72) < 0.07;
        return band ? tn(M.gold, 0.35, X, Y, 0) : mt(P.jade, face(lf.get(lx, ly).k, side, u * 0.5, v * 0.7) * 0.85, X, Y, 0.1, 1);
      });
    }
    // the side table: legs, a low shelf, the top; an open book and a cup of tea on it
    const tt = 0.55 * H;
    contact(c, t0, t1, 0.7);
    for (const lx0 of [t0 + 2, t1 - 6]) box(c, lf, side, lx0, -tt + 4, lx0 + 4, 0, M.lacq, 91, 0.1, 1, 1, 0.04);
    box(c, lf, side, t0 + 2, -0.16 * H, t1 - 2, -0.16 * H + 3, M.lacq, 93, 0.1, 1, 1, 0.03);
    rect(c, t0 - 3, -tt, t1 + 3, -tt + 4, (X, Y, lx, ly) => mt(M.lacq, face(lf.get(lx, ly).k, side, 0, ly < -tt + 1 ? -1 : 0.2) * (ly < -tt + 1 ? 1.3 : 0.7), X, Y, 0.0, 1));
    {
      const bx0 = t0 + 2, bx1 = t0 + 22, top = -tt;
      rect(c, bx0, top - 7, bx1, top, (X, Y, lx, ly) => {
        const u = (lx - bx0) / (bx1 - bx0);
        const bow = 6 - Math.abs(u - 0.5) * 7;
        if (ly < top - 1 - bow) return 0;
        if (ly > top - 1.5) return tn(P.blue, 0.4, X, Y, 0);
        const l = lf.get(lx, ly);
        if (Math.abs(u - 0.5) < 0.04) return mt(M.paper, face(l.k, side) * 0.6, X, Y, 0, 1);
        return mt(M.paper, face(Math.max(0.6, l.k), side, (u - 0.5), ly < top - bow ? -0.8 : 0) * 1.1, X, Y, 0, 0.8);
      });
      const cx = t1 - 7;
      rect(c, cx - 4, top - 1, cx + 4, top, (X, Y) => tn(P.paper, 0.3, X, Y, 0));
      lathe(c, cx, top - 6, top - 1, (ly) => 2.6 + (ly - top + 6) * -0.12 + 0.4, (X, Y, u, _lx, ly) => (Math.sin(u * 4 + ly) > 0.6 ? tn(P.jade, 0.45, X, Y, 0) : mt(M.paper, cyl(lf.get(cx, ly).k, u, side), X, Y, 0, 0.8)));
      for (let i = 0; i < 9; i++) {
        const sy = top - 8 - i * 1.6, sx = cx + Math.sin(i * 0.9) * 1.4;
        rect(c, sx, sy, sx + 1, sy + 1, (X, Y) => (keep(X, Y, 0.55 - i * 0.05) ? P.paper[1]! : 0));
      }
    }
  },
});

// ===========================================================================
// A display screen upstairs: the art of one group hangs on it (a calm dark silk ground in a lacquer
// frame, a carved top rail, feet), so each picture reads against it instead of against the far wall
// ===========================================================================
export const artScreen = definePainter<{ w: number; h: number; leaves: number; at?: At }>("hall.screen", {
  bounds(p) {
    return [-10, -p.h - 0.2 * H, p.w + 10, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10);
    const W = p.w, Ht = p.h;
    const side = sideOf(lf, W / 2, -Ht / 2);
    contact(c, -6, W + 6, 0.6);
    const skirt = 0.2 * H;
    const lw = W / p.leaves;
    // the silk panels: a dark warm ground, a gold line inside each leaf, the leaves' hinges
    rect(c, 4, -Ht + 7, W - 4, -skirt, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const k = ((lx % lw) + lw) % lw;
      if (k < 1.5 || k > lw - 1.5) return mt(M.lacq, face(l.k, side) * 0.45, X, Y, 0.2, 1);
      const e = Math.min(k - 1.5, lw - 1.5 - k, ly + Ht - 7, -skirt - ly);
      if (Math.abs(e - 4) < 0.6) return mt(M.gold, face(l.k, side) * 0.55, X, Y, 0.3, 1);
      const weave = vnoise(lx * 0.4, ly * 0.08, 95) * 0.06;
      return mt(M.verm, face(l.k, side) * 0.42 + weave, X, Y, 0.35, 1);
    });
    // the skirt: a fret of dark timber over the floor
    rect(c, 4, -skirt, W - 4, -5, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const a = ((lx % 9) + 9) % 9;
      if (ly < -skirt + 3 || a < 2) return mt(M.lacq, face(l.k, side, 0, ly < -skirt + 1.5 ? -0.8 : 0) * 0.6, X, Y, 0.1, 1);
      return 0;
    });
    // the frame: end posts with finials and feet, the top rail with a carved crest
    for (const fx of [3, W - 3]) {
      lathe(c, fx, -Ht - 6, 0, () => 3.4, (X, Y, u, _lx, ly) => mt(M.lacq, cyl(lf.get(fx, ly).k, u, side, 0.2), X, Y, 0.0, 1));
      lathe(c, fx, -Ht - 12, -Ht - 5, () => 3.2, (X, Y, u, _lx, ly) => mt(M.gold, cyl(lf.get(fx, ly).k, u, side), X, Y, 0.0, 1));
      box(c, lf, side, fx - 0.16 * H, -6, fx + 0.16 * H, 0, M.lacq, 97, 0.05, 1, 2, 0.02);
    }
    box(c, lf, side, 0, -Ht, W, -Ht + 7, M.lacq, 99, 0.0, 1, 2, 0.04);
    rect(c, 0, -Ht, W, -Ht + 1, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, 0, -1) * 1.1, X, Y, 0.1, 1));
    const cw = Math.min(0.9 * H, W * 0.3);
    poly(c, [W / 2 - cw, -Ht, W / 2 - cw * 0.6, -Ht - 7, W / 2, -Ht - 11, W / 2 + cw * 0.6, -Ht - 7, W / 2 + cw, -Ht], (X, Y, lx, ly) => {
      const sc = Math.sin((lx - W / 2) * 0.35) * Math.cos((ly + Ht) * 0.6) > 0.45;
      return mt(sc ? M.gold : M.lacq, face(lf.get(lx, ly).k, side, 0, -0.5) * (sc ? 0.8 : 0.65), X, Y, 0.1, 1);
    });
  },
});

// ===========================================================================
// The near foot (P5): dark things between us and the walk line, cut by the frame's bottom (a bench seen
// from behind, a planter of bamboo, a big jar, a length of low rail), so the floor below the walk line is
// a framed foreground instead of an empty band. Silhouettes in the warm dark, a rim of the room's light
// along their tops; never tall enough to reach a service (their tops stay well below the walk line)
// ===========================================================================
export interface NearFootP {
  kind: "bench" | "planter" | "jar" | "rail";
  /** Width (plane px) for the bench and the rail; the height of the top above the anchor (plane px). */
  w: number;
  top: number;
  seed: number;
}

/** The near foot's dark: warm near-black, a rim of lamplight on top edges. */
const NEAR_DARK: Ramp = [P.timber[3]!, P.umber[1]!, P.umber[2]!, P.umber[3]!, P.umber[4]!, P.umber[5]!, P.ink[0]!];

export const nearFoot = definePainter<NearFootP>("hall.nearfoot", {
  bounds(p) {
    const half = p.kind === "bench" || p.kind === "rail" ? p.w / 2 + 12 : 1.1 * H;
    return [-half, -p.top - 0.9 * H, half, 0.9 * H];
  },
  paint(c, p) {
    const T = -p.top;
    // the body sinks below the frame: everything runs on down to 0.9 H under the anchor
    const B = 0.9 * H;
    const dark = (X: number, Y: number, t: number): number => tn(NEAR_DARK, clamp(t, 0, 1), X, Y, 0.5);
    if (p.kind === "bench") {
      const W = p.w / 2;
      // a long bench seen from behind: its yoke rail sweeping up at both ends (rim-lit), a carved splat at
      // the middle and at each end, open bays between, the seat's edge, the legs running out of the frame
      rect(c, -W - 8, T - 12, W + 8, B, (X, Y, lx, ly) => {
        const u = Math.abs(lx) / W;
        const lift = Math.pow(Math.max(0, u - 0.8) / 0.2, 2) * 10;
        const top = T - lift + Math.sin(u * Math.PI) * 2;
        const v = ly - top;
        if (u > 1.06) return 0;
        if (v < 0) return 0;
        if (v < 8) return v < 1.5 ? dark(X, Y, 0.0 + vnoise(lx * 0.06, 1, p.seed) * 0.15) : v < 3 ? dark(X, Y, 0.3) : dark(X, Y, 0.62);
        if (u > 1) return 0;
        const vv = ly - T;
        if (vv > 58 && vv < 66) return dark(X, Y, vv < 60 ? 0.3 : 0.7);
        if (vv >= 66) return W - Math.abs(lx) < 10 || Math.abs(Math.abs(lx) - W * 0.45) < 4 ? dark(X, Y, 0.85) : 0;
        // the splats: a solid board with a carved roundel, at the middle and the ends
        const splat = Math.abs(lx) < 0.14 * W || W - Math.abs(lx) < 0.1 * W;
        if (splat) {
          const rc = Math.hypot(lx, vv - 30);
          if (Math.abs(lx) < 0.14 * W && rc < 11 && rc > 7) return dark(X, Y, 0.42);
          return dark(X, Y, 0.74 + (Math.abs(lx) < 0.14 * W && Math.abs(Math.abs(lx) - 0.13 * W) < 1 ? -0.3 : 0));
        }
        // the open bays: a thin rail at mid height
        return Math.abs(vv - 34) < 2 ? dark(X, Y, 0.7) : 0;
      });
    } else if (p.kind === "rail") {
      const W = p.w / 2;
      const n = Math.max(2, Math.round(p.w / (0.8 * H)));
      const span = p.w / n;
      rect(c, -W, T - 8, W, B, (X, Y, lx, ly) => {
        const v = ly - T;
        const k = (lx + W) % span;
        const dPost = Math.min(k, span - k);
        if (dPost < 4) return v < -4 ? (dPost < 3 ? dark(X, Y, 0.2) : 0) : dark(X, Y, v < 0 ? 0.3 : 0.82);
        if (v < 0) return 0;
        if (v < 6) return dark(X, Y, v < 1.5 ? 0.22 : 0.7);
        if (v > 34 && v < 39) return dark(X, Y, 0.75);
        const r = Math.hypot(k - span / 2, v - 20);
        if (v < 34 && r < 7 && r > 4) return dark(X, Y, 0.6);
        return v > 39 ? dark(X, Y, 0.88) : 0;
      });
    } else if (p.kind === "jar") {
      const R = 0.62 * H;
      lathe(c, 0, T, B, (ly) => {
        const v = ly - T;
        if (v < 7) return R * 0.45;
        if (v < 11) return R * 0.36;
        return R * Math.min(1, 0.5 + Math.sqrt((v - 11) / (R * 0.9)) * 0.5);
      }, (X, Y, u, _lx, ly) => {
        const v = ly - T;
        const rim = v < 2 || (v > 11 && v < 13 && Math.abs(u) > 0.5);
        const sheen = Math.abs(u + 0.55) < 0.06 && v > 16 && v < 60;
        return dark(X, Y, rim ? 0.2 : sheen ? 0.45 : 0.72 + Math.abs(u) * 0.15);
      });
    } else {
      // a planter: a wooden box cut by the frame's bottom, bamboo leaves fanning up out of it
      const bw = 0.55 * H, bt = T + 0.75 * H;
      rect(c, -bw, bt, bw, B, (X, Y, lx, ly) => {
        const v = ly - bt;
        if (v < 2) return dark(X, Y, 0.2);
        const slat = ((v % 13) + 13) % 13 < 1.2;
        return dark(X, Y, slat ? 0.88 : 0.7 + (Math.abs(lx) > bw - 3 ? -0.15 : 0));
      });
      for (let i = 0; i < 7; i++) {
        const a0 = -1.15 + (i / 6) * 2.3 + (hash(i, 1, p.seed) - 0.5) * 0.3;
        const len = (0.55 + hash(i, 2, p.seed) * 0.35) * 0.95 * H;
        const bx = (hash(i, 3, p.seed) - 0.5) * bw;
        // a cane, then a spray of narrow leaves at its tip
        const tx = bx + Math.sin(a0) * len, ty = bt - Math.cos(a0) * len;
        for (let k = 0; k <= 24; k++) {
          const t = k / 24;
          const x = bx + (tx - bx) * t + Math.sin(t * Math.PI) * 4 * Math.sign(a0), y = bt + (ty - bt) * t;
          const X = Math.round(c.X(x)), Y = Math.round(c.Y(y));
          c.buf.set(X, Y, NEAR_DARK[4]!);
        }
        for (let j = 0; j < 4; j++) {
          const la = a0 + (j - 1.5) * 0.5 + (hash(i, j + 5, p.seed) - 0.5) * 0.3;
          const ll = 0.24 * H + hash(i, j + 9, p.seed) * 0.1 * H;
          const pts: number[] = [];
          for (let k = 0; k <= 8; k++) {
            const t = k / 8, wdt = Math.sin(t * Math.PI) * 3.2;
            const x = tx + Math.sin(la) * ll * t, y = ty - Math.cos(la) * ll * t + t * t * 6;
            pts.push(x + Math.cos(la) * wdt, y + Math.sin(la) * wdt);
          }
          for (let k = 8; k >= 0; k--) {
            const t = k / 8, wdt = Math.sin(t * Math.PI) * 3.2;
            const x = tx + Math.sin(la) * ll * t, y = ty - Math.cos(la) * ll * t + t * t * 6;
            pts.push(x - Math.cos(la) * wdt, y - Math.sin(la) * wdt);
          }
          poly(c, pts, (X, Y, lx, ly) => {
            const up = ly < ty - Math.cos(la) * ll * 0.5;
            return tn(NEAR_DARK, up && hash(Math.floor(lx), Math.floor(ly), p.seed) > 0.55 ? 0.35 : 0.68, X, Y, 0.3);
          });
        }
      }
    }
  },
});

// ===========================================================================
// The Prize Court's ring, side-on (round 1, L14: it replaces the seal painted on the floor in perspective):
// a low stone dais set into the court's paving between the ring's ends, a kerb at each end, a carved post at
// each end with a great braided rope slung between them (paper streamers hanging off it), and a banner pole
// outside each post. The rope hangs behind the fighters; nothing here is collision.
// ===========================================================================
export interface RingP {
  /** The ring's length (px); the anchor is its west end on the court floor (the walk line). */
  w: number;
  /** How deep the court's paving band runs up behind the walk line here (px). */
  band: number;
}

export const ring = definePainter<RingP>("court.ring", {
  bounds(p) {
    return [-0.9 * H, -3.6 * H, p.w + 0.9 * H, 4];
  },
  paint(c, p) {
    const W = p.w;
    const SUN = 1.0, SIDE = -0.8;
    // --- the dais in the paving: a band of warm red-brown stone a step up from the grey flags, its far
    // edge a lit lip with the step's shadow under it, gold-capped corner stones at both ends
    const dh = Math.min(p.band * 0.55, 0.42 * H);
    rect(c, -6, -dh - 4, W + 6, 0, (X, Y, lx, ly) => {
      const v = (ly + dh) / dh; // 0 the far edge .. 1 the walk line
      const end = Math.min(lx + 6, W + 6 - lx);
      if (end < 4 && v < 0.3) return 0;
      if (ly < -dh) return v > -0.15 && end > 3 ? mt(M.stone, 0.42, X, Y, 0.3, 1) : 0;
      if (v < 0.08) return mt(M.stone, face(SUN, SIDE, 0, -0.9) * 1.05, X, Y, 0.0, 1);
      if (v < 0.16) return mt(P.earth, 0.45, X, Y, 0.3, 1);
      // the slabs: courses widening toward us, a few chipped, a gold inlay line near the walk line
      const course = Math.floor(v * 3);
      const sw = (0.8 + course * 0.35) * H, off = (course % 2) * sw * 0.5;
      const joint = (((lx + off) % sw) + sw) % sw < 1.2 || Math.abs(v * 3 - course) < 0.04;
      if (Math.abs(v - 0.86) < 0.025 && end > 10) return mt(M.gold, 0.85, X, Y, 0.1, 1);
      const n = fbm(lx * 0.04, ly * 0.1, 101, 3) - 0.5;
      return mt(P.earth, 0.72 + n * 0.16 - (joint ? 0.22 : 0) - v * 0.06, X, Y, 0.0, 1, 0.5);
    });
    // the kerbs at the ends: low carved stones she steps over, lit on top, a cast shadow down-right
    for (const kx of [-0.32 * H, W]) {
      const k0 = kx, k1 = kx + 0.32 * H, kt = -0.2 * H;
      rect(c, k1, kt + 4, k1 + 0.22 * H, 0, (X, Y) => (keep(X, Y, 0.55) ? P.stone[5]! : 0));
      rect(c, k0, kt, k1, 0, (X, Y, lx, ly) => {
        const u = (lx - k0) / (k1 - k0), v = (ly - kt) / -kt;
        const [nx, ny] = bevel(u, v, 0.12, 0.15);
        const carve = Math.abs(v - 0.55) < 0.12 && u > 0.2 && u < 0.8;
        return mt(M.stone, face(SUN, SIDE, nx, ny) * (carve ? 0.75 : 0.95) + (fbm(lx * 0.3, ly * 0.3, 103, 2) - 0.5) * 0.14, X, Y, 0.0, 1);
      });
    }
    // --- the posts and the banner poles at both ends
    const postH = 1.45 * H, poleH = 3.3 * H;
    const posts = [-0.16 * H, W + 0.16 * H];
    for (const [i, px] of posts.entries()) {
      const out = i === 0 ? -1 : 1;
      // the post's cast shadow on the paving, down and to the right (the sun is up and to the left)
      poly(c, [px - 4, 0, px + 4, 0, px + 0.75 * H, -dh * 0.5, px + 0.68 * H, -dh * 0.5], (X, Y) => (keep(X, Y, 0.5) ? P.stone[5]! : 0));
      // a stone base, the lacquered post, a gold cap with a lotus finial
      rect(c, px - 0.14 * H, -0.24 * H, px + 0.14 * H, 0, (X, Y, lx, ly) => {
        const [nx, ny] = bevel((lx - px + 0.14 * H) / (0.28 * H), (ly + 0.24 * H) / (0.24 * H), 0.15, 0.2);
        return mt(M.stone, face(SUN, SIDE, nx, ny) * 0.95, X, Y, 0.0, 1);
      });
      lathe(c, px, -postH, -0.24 * H, () => 0.075 * H, (X, Y, u, _lx, ly) => {
        const band = Math.abs(ly + postH * 0.62) < 3 || Math.abs(ly + 0.3 * H) < 2.5;
        return band ? mt(M.gold, cyl(SUN, u, SIDE, 0.2), X, Y, 0.0, 1) : mt(M.verm, cyl(SUN, u, SIDE, 0.25) * 0.9, X, Y, 0.0, 1);
      });
      lathe(c, px, -postH - 0.2 * H, -postH + 2, (ly) => {
        const t = (ly + postH + 0.2 * H) / (0.2 * H + 2);
        return t < 0.3 ? 2 + t * 8 : 4.5 + Math.sin(t * Math.PI) * 3;
      }, (X, Y, u) => mt(M.gold, cyl(SUN, u, SIDE, 0.3) * 1.05, X, Y, 0.0, 1));
      // the banner pole just outside the post: a tall pole, a crossbar, a long banner with a gold hem
      const qx = px + out * 0.36 * H;
      poly(c, [qx - 7, 0, qx + 7, 0, qx + 2, -0.05 * H, qx - 2, -0.05 * H], (X, Y) => tn(M.stone, 0.4, X, Y, 0));
      rect(c, qx - 1.5, -poleH, qx + 1.5, 0, (X, Y, lx) => mt(M.lacqDay, lx < qx ? 0.85 : 0.5, X, Y, 0.0, 1));
      rect(c, qx - 0.22 * H, -poleH + 6, qx + 0.22 * H, -poleH + 10, (X, Y, lx) => mt(M.lacqDay, lx < qx ? 0.85 : 0.55, X, Y, 0.0, 1));
      lathe(c, qx, -poleH - 9, -poleH, () => 3, (X, Y, u) => mt(M.gold, cyl(SUN, u, SIDE, 0.3), X, Y, 0.0, 1));
      const by0 = -poleH + 10, by1 = -poleH + 10 + 1.55 * H, bw = 0.2 * H;
      rect(c, qx - bw - 2, by0, qx + bw + 6, by1 + 8, (X, Y, lx, ly) => {
        const v = (ly - by0) / (by1 - by0);
        const sway = Math.sin(v * 3.2 + i) * 2.5 * v * out;
        const u = (lx - qx - sway) / bw;
        if (Math.abs(u) > 1) return 0;
        // a swallow-tail hem
        if (v > 1 && v - 1 > (1 - Math.abs(u)) * 0.12) return 0;
        if (v > 1.12) return 0;
        const hem = Math.abs(u) > 0.82 || (v > 0.9 && v < 0.95);
        if (hem) return mt(M.gold, face(SUN, SIDE, u * 0.5, 0) * 0.95, X, Y, 0.05, 1);
        const emblem = Math.hypot(u * bw, (v - 0.32) * (by1 - by0)) < 0.13 * H && Math.hypot(u * bw, (v - 0.32) * (by1 - by0)) > 0.08 * H;
        if (emblem) return mt(M.gold, 0.85, X, Y, 0.1, 1);
        const fold = Math.sin(u * 2.6 + v * 2) * 0.12;
        return mt(M.verm, face(SUN, SIDE, u * 0.6, 0) * 0.85 + fold, X, Y, 0.0, 1);
      });
    }
    // --- the great rope: two braided strands twisted together, slung between the post heads, sagging; zigzag
    // paper streamers and red tassels hanging off it
    const [ax, bx] = posts as [number, number];
    const ry = -postH + 0.06 * H, sag = 0.2 * H;
    const ropeY = (x: number): number => ry + sag * 4 * ((x - ax) / (bx - ax)) * (1 - (x - ax) / (bx - ax));
    rect(c, ax, ry - 7, bx, ry + sag + 7, (X, Y, lx, ly) => {
      const cy = ropeY(lx);
      const d = ly - cy;
      const thick = 5.2;
      if (Math.abs(d) > thick) return 0;
      const twist = (((lx * 0.7 + d * 1.4) % 9) + 9) % 9 < 4.5;
      const shade = d > thick - 1.5 ? -0.35 : d < -thick + 1.2 ? 0.15 : 0;
      return twist ? mt(M.paper, face(SUN, SIDE, 0, d / thick) * 0.95 + shade, X, Y, 0.0, 0.9) : mt(M.verm, face(SUN, SIDE, 0, d / thick) * 0.85 + shade, X, Y, 0.1, 1);
    });
    const n = Math.max(3, Math.round((bx - ax) / (1.05 * H)));
    for (let k = 1; k < n; k++) {
      const sx = ax + ((bx - ax) * k) / n, sy = ropeY(sx) + 3;
      if (k % 2 === 0) {
        // a red tassel
        rect(c, sx - 1, sy, sx + 1, sy + 0.2 * H, (X, Y, _lx, ly) => tn(M.verm, ly > sy + 0.13 * H ? 0.45 : 0.3, X, Y, 0));
        continue;
      }
      // a shide: a white paper strip folded in a zigzag
      for (let j = 0; j < 4; j++) {
        const zx = sx + (j % 2 === 0 ? -4 : 1), zy = sy + 2 + j * 7;
        rect(c, zx, zy, zx + 5, zy + 7, (X, Y, lx, ly) => mt(M.paper, face(SUN, SIDE, (lx - zx - 2.5) * 0.2, 0) - (ly > zy + 6 ? 0.2 : 0), X, Y, 0.0, 0.85));
      }
    }
  },
});

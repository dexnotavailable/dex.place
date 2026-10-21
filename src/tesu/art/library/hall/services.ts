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
import { bayWall, clerestories, clerestoryBoxes, gateGeo, gateHead, gateRim, gateView, headBox, scrolls } from "./gate.ts";
import { couplets } from "./bay.ts";
import { M, SCREEN, LitField, bevel, clamp, cord, cyl, face, fbm, grain, hash, keep, lathe, mt, poly, rect, tn, vnoise, type At, type Ramp } from "./kit.ts";
import { cashCoin, cloudScroll, coinStack, crossedBlades, openBook, plumCrest, sealStamp, text, textWidth } from "./signs.ts";

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

// (round 2, W1-2: the pseudo-script glyphs are gone; every sign is real pixel characters or a wordless mark,
// signs.ts)

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

export const gate = definePainter<GateP>("hall.gate", {
  bounds(p) {
    return [p.l - 4, -p.top - 4, p.r + 4, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT_NO_GATE, p.at, 12);
    const lfg = new LitField(HALL_LIGHT, p.at, 8);
    const R = p.rad, CY = -p.cy;
    const RING = 0.16 * H;
    const g = gateGeo(p);
    // (hall loop round 2) the bay wall, the court seen through the gate, the ring cut into the wall and
    // the scrolls either side (gate.ts)
    bayWall(c, g);
    gateView(c, g);
    gateRim(c, g, lfg);
    scrolls(c, g, lf);
    // (round 3, W2-5) a pair of couplet boards high on the wall, flanking the clerestories
    couplets(c, headBox(g).cw, clerestoryBoxes(g)[0]![1], lf);

    // --- over the ring: the plaque ("the Prize Court", gold strokes on red lacquer in a gold frame) under
    // a small tiled canopy on two carved corbels, so the gate reads as the hall's gate from across the room
    const ringTop = CY - R - RING;
    const py1 = ringTop - 5, py0 = py1 - 0.4 * H, pw = 0.8 * H;
    rect(c, -pw, py0, pw, py1, (X, Y, lx, ly) => {
      const l = lfg.get(lx, ly);
      const e = Math.min(pw - Math.abs(lx), ly - py0, py1 - ly);
      if (e < 2) return mt(M.gold, face(l.k, 0, 0, ly - py0 < 2 ? -0.8 : 0.4) * 0.95, X, Y, 0.05, 1);
      if (e < 4) return mt(M.lacq, face(l.k, 0) * 0.3, X, Y, 0.3, 1);
      return mt(M.verm, face(Math.max(0.5, l.k), 0) * 0.72 + grain(lx, ly, 91, false) * 0.05, X, Y, 0.2, 1);
    });
    // (round 2, W1-2) wordless: crossed blades in a gold ring (the arena) between two gold cloud scrolls
    {
      const pcy = (py0 + py1) / 2, pr = Math.min(15, (py1 - py0) / 2 - 3);
      const goldC = (X: number, Y: number): number => tn(M.gold, 0.12, X, Y, 0);
      crossedBlades(c, 0, pcy, pr, (X, Y, _lx, ly) => tn(M.gold, ly < pcy ? 0.05 : 0.3, X, Y, 0), (X, Y) => tn(M.lacq, 0.55, X, Y, 0), (X, Y) => tn(M.verm, 0.66, X, Y, 0));
      cloudScroll(c, -pw + 20, pcy, 6, 1, pw - 26 - pr, goldC);
      cloudScroll(c, pw - 20, pcy, 6, -1, pw - 26 - pr, goldC);
    }
    // (hall loop round 2) the head over the plaque: bracket sets, the beam, rafter ends, the tiled
    // canopy; the clerestories high in the bay (gate.ts)
    gateHead(c, g, lf, lfg);
    clerestories(c, g, lf);
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
  /** (round 4, W1-a) A signboard hangs over the desk (signboard.ts): the small sign on the cabinet is dropped. */
  board?: boolean;
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
    // (round 4, W1-a) the cabinet stands behind her, no wider than 1.75 H however long the counter grows
    const cx0 = Math.max(0.22 * H, p.who - 0.85 * H), cx1 = Math.min(W - 0.12 * H, p.who + 0.9 * H), cy0 = -T - 1.12 * H, cy1 = -T - 0.06 * H;
    box(c, lf, side, cx0, cy0, cx1, cy1, M.lacq, 3, 0.0, 1, 3, 0.05);
    const cols = Math.max(7, Math.round((cx1 - cx0) / (0.21 * H))), rows = 4;
    const cw = (cx1 - cx0 - 8) / cols, ch = (cy1 - cy0 - 8) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x0 = cx0 + 4 + i * cw + 1.5, x1 = x0 + cw - 3, y0 = cy0 + 4 + j * ch + 1.5, y1 = y0 + ch - 3;
      const r = hash(i, j, 41);
      rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const v = (ly - y0) / (y1 - y0), u = (lx - x0) / (x1 - x0);
        // (round 3, W2-12: every cell held the same pair of scroll ends, goggles at 1:1) what is in each cell, its own:
        // a pyramid of rolled scrolls tied in red or blue, one fat scroll with a hanging tag, ledgers lying flat with
        // coloured spines, slips standing up, a red seal box with a gold clasp, a little jar, or nothing
        const cw2 = x1 - x0, ch2 = y1 - y0;
        if (r < 0.2) {
          const rr = Math.min(cw2 * 0.17, ch2 * 0.24);
          const tie = hash(i, j, 43) < 0.5 ? P.red : P.blue;
          for (const [ku, kv] of [[0.25, 0], [0.62, 0], [0.43, 1]] as const) {
            const sx = x0 + cw2 * ku + rr * 0.3, sy = y1 - rr - 0.5 - kv * rr * 1.75;
            const d = Math.hypot(lx - sx, ly - sy) / rr;
            if (d < 1) return d < 0.3 ? mt(M.wood, 0.45, X, Y, 0.2, 1) : Math.abs(lx - sx) < 0.8 ? tn(tie, 0.4, X, Y, 0) : mt(M.paper, face(l.k, side, (lx - sx) / rr, (ly - sy) / rr) * (0.85 + kv * 0.08), X, Y, 0.0, 0.9);
          }
        } else if (r < 0.32) {
          const rr = Math.min(cw2 * 0.3, ch2 * 0.38), sx = x0 + cw2 * 0.45, sy = y1 - rr - 0.5;
          const d = Math.hypot(lx - sx, ly - sy) / rr;
          if (d < 1) return d < 0.28 ? mt(M.wood, 0.35, X, Y, 0.2, 1) : mt(M.paper, face(l.k, side, (lx - sx) / rr, (ly - sy) / rr) * 0.88 - (d > 0.55 && d < 0.65 ? 0.12 : 0), X, Y, 0.0, 0.9);
          if (lx > sx + rr * 0.5 && lx < sx + rr * 0.5 + 2.5 && ly > sy && ly < sy + rr * 1.1) return tn(M.verm, 0.4, X, Y, 0);
        } else if (r < 0.48) {
          // ledgers lying flat, spine out: two or three of different thicknesses and colours
          const n = r < 0.4 ? 3 : 2;
          let yb = y1 - 0.5;
          for (let k = 0; k < n; k++) {
            const th = 2.5 + 2 * hash(i * 3 + k, j, 47), inset = 1 + 2 * hash(i, j * 3 + k, 49);
            const ramp = [M.verm, P.blue, P.moss, M.wood, P.jade][Math.floor(hash(i + k, j, 51) * 5)]!;
            if (ly > yb - th && ly <= yb && lx > x0 + inset && lx < x1 - inset * 0.5) return ly < yb - th + 1 ? mt(M.paper, 0.6, X, Y, 0.1, 0.9) : mt(ramp, face(l.k, side) * 0.7 + (Math.abs(lx - (x0 + x1) / 2) < 1 ? -0.15 : 0), X, Y, 0.2, 1);
            yb -= th;
          }
        } else if (r < 0.64) {
          if (v > 0.3 && u > 0.15 && u < 0.85 && (Math.floor(u * 6) % 2 === 0 || v > 0.55)) {
            const tag = r > 0.58 && v < 0.45 && u < 0.4;
            return tag ? tn(M.verm, 0.35, X, Y, 0) : mt(M.paper, face(l.k, side) * (0.75 + v * 0.1), X, Y, 0.05, 0.9);
          }
        } else if (r < 0.73) {
          // a seal box: red lacquer, a gold clasp, its lid line
          if (u > 0.14 && u < 0.86 && v > 0.42) {
            if (Math.abs(u - 0.5) < 0.08 && Math.abs(v - 0.62) < 0.08) return mt(M.gold, 0.9, X, Y, 0.0, 1);
            if (Math.abs(v - 0.55) < 0.04) return mt(M.lacq, 0.3, X, Y, 0.2, 1);
            return mt(M.verm, face(l.k, side, u < 0.2 ? -0.6 : u > 0.8 ? 0.6 : 0, v < 0.48 ? -0.6 : 0) * 0.62, X, Y, 0.2, 1);
          }
        } else if (r < 0.8) {
          // a little jar
          const ju = (u - 0.5) * cw2, jv = (1 - v) * ch2;
          const jw = jv < 1.5 ? 2 : jv < ch2 * 0.55 ? 3.6 + Math.sin((jv / (ch2 * 0.55)) * Math.PI) * 1.2 : jv < ch2 * 0.65 ? 1.6 : 0;
          if (Math.abs(ju) < jw) return mt(hash(i, j, 53) < 0.5 ? M.bronze : P.jade, face(l.k, side, ju / jw, 0) * 0.85, X, Y, 0.1, 1);
        }
        // the cell's back, in shadow; its top lip catches the lamp
        return v < 0.12 ? mt(M.wood, face(l.k, side, 0, 0.6) * 0.5, X, Y, 0.3, 1) : mt(M.lacq, face(l.k, side) * 0.22, X, Y, 0.2, 1);
      });
    }
    // the cabinet's cornice with gold ends
    box(c, lf, side, cx0 - 5, cy0 - 6, cx1 + 5, cy0, M.wood, 5, 0.15, 1, 2);
    for (const fx of [cx0 - 5, cx1 + 5]) fitting(c, lf, side, fx, cy0 - 6, fx < W / 2 ? 1 : -1, 1, 5);
    // --- the sign over the desk: a carved board on two brackets, "register" in gold glyphs
    if (!p.board) {
    const sy1 = cy0 - 0.18 * H, sy0 = sy1 - 0.3 * H, sx0 = cx0 + 0.05 * H, sx1 = cx1 - 0.05 * H;
    for (const bx of [sx0 + 8, sx1 - 8]) rect(c, bx - 2, sy1, bx + 2, cy0 - 6, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, (lx - bx) / 2, 0) * 0.7, X, Y, 0.2, 1));
    rect(c, sx0, sy0, sx1, sy1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx - sx0, sx1 - lx, ly - sy0, sy1 - ly);
      if (e < 2) return mt(M.gold, face(l.k, side, 0, ly - sy0 < 2 ? -0.8 : 0.3) * 0.9, X, Y, 0.05, 1);
      return mt(M.wood, face(l.k, side) * 0.55 + grain(lx, ly, 43, false) * 0.08, X, Y, 0.35, 1);
    });
    // (round 2, W1-2) wordless: the open register with a brush laid across it, and Hanko's red seal
    {
      const scy = (sy0 + sy1) / 2, mid = (sx0 + sx1) / 2;
      openBook(c, mid - 36, scy - 9, 32, (X, Y) => tn(M.paper, 0.12, X, Y, 0), (X, Y) => tn(M.gold, 0.5, X, Y, 0), (X, Y) => tn(M.ink, 0.1, X, Y, 0));
      sealStamp(c, mid + 10, scy - 8, 16, (X, Y) => tn(P.red, 0.32, X, Y, 0), (X, Y) => tn(M.paper, 0.1, X, Y, 0));
    }
    }

    // (round 3, W1-3) a small paper lantern on the cabinet's east shoulder (lights.ts SERVICE_LAMPS: the desk's
    // second key light, so the counter and the cells read lit in their own frame): a lacquer foot, a lit paper box
    // under a little dark cap, a red tassel
    // (round 4) not under the signboard: its own two lanterns hang right there and light the cabinet from above
    if (!p.board) {
      const lx = cx1 + 3, lb = cy0 - 6, lt = lb - 0.3 * H;
      box(c, lf, side, lx - 7, lb - 3, lx + 7, lb, M.lacq, 3, 0.1, 1, 1, 0);
      rect(c, lx - 6, lt, lx + 6, lb - 3, (X, Y, px, py) => {
        const u = (px - lx + 6) / 12, v = (py - lt) / (lb - 3 - lt);
        if (u < 0.13 || u > 0.87) return mt(M.lacq, 0.42, X, Y, 0.1, 1);
        if (Math.abs(v - 0.5) < 0.05) return tn(M.wood, 0.5, X, Y, 0);
        return tn(SCREEN, clamp(0.02 + Math.abs(u - 0.5) * 0.8 + Math.abs(v - 0.55) * 0.35, 0, 1), X, Y, 0.45);
      });
      poly(c, [lx - 9, lt + 1, lx, lt - 5, lx + 9, lt + 1], (X, Y, px, py) => mt(M.lacq, face(lf.get(px, py).k, side, (px - lx) / 9, -0.6) * 0.6, X, Y, 0.1, 1));
      rect(c, lx - 1, lt - 8, lx + 1, lt - 4, (X, Y) => tn(M.gold, 0.3, X, Y, 0));
      rect(c, lx + 7, lt + 6, lx + 8, lt + 14, (X, Y) => tn(P.red, 0.4, X, Y, 0));
    }

    // --- the counter: plinth, a front lighter than the wall, the top board with a lit lip and a dark edge band
    contact(c, 0, W, 0.85);
    const TOPD = 9;
    // (round 3, W2-12) a dark kick at the foot, set back under the front: near black, its top edge catching the lamp
    rect(c, 6, -0.12 * H, W - 6, 0, (X, Y, lx, ly) => (ly < -0.12 * H + 1.5 ? mt(M.wood, face(lf.get(lx, ly).k, side, 0, -0.8) * 0.5, X, Y, 0.2, 1) : mt(M.lacq, 0.04 + grain(lx, ly, 71, false) * 0.04, X, Y, 0.55, 1)));
    rect(c, 2, -T + TOPD, W - 2, -0.12 * H, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - 2) / (W - 4), v = (ly + T - TOPD) / (T - TOPD - 0.12 * H);
      // three framed panels of warm timber, gold-line insets, the shadow of the top board along their head
      const pn = 3, pu = (u * pn) % 1;
      const stile = pu < 0.05 || pu > 0.95 || u < 0.02 || u > 0.98;
      const rail = v < 0.1 || v > 0.9;
      const inset = !stile && !rail && (Math.abs(pu - 0.12) < 0.012 || Math.abs(pu - 0.88) < 0.012 || Math.abs(v - 0.22) < 0.03 || Math.abs(v - 0.8) < 0.03);
      // (round 2, W1-5) the front a light honey timber, a clear step lighter than the wall and the notice board, so
      // the desk reads as the desk in its own frame; the lamp's light still moves it
      // (round 3, W2-12: it read as a UI panel) real timber: its grain running down each panel, the stiles' edges and
      // the panels' corners worn pale by hands and hips, grime darkening the lower rail where feet scuff it; the gold
      // line a thin inlay, broken where it wore
      const shade = v < 0.16 ? 0.22 : 0;
      const lk = (face(l.k, side) - 0.35) * 0.55;
      const corner = Math.min(Math.abs(pu - 0.05), Math.abs(pu - 0.95)) < 0.04 && (v < 0.2 || v > 0.8);
      const wornEdge = (stile && fbm(lx * 0.3, ly * 0.12, 61, 2) > 0.58) || (corner && fbm(lx * 0.25, ly * 0.25, 63, 2) > 0.45);
      const grime = v > 0.84 ? (v - 0.84) * 0.9 : 0;
      if (inset) return fbm(lx * 0.2, ly * 0.2, 65, 2) > 0.58 ? mt(M.wood, 0.68 + lk - shade, X, Y, 0.1, 1) : mt(M.gold, 0.5 + lk - shade, X, Y, 0.1, 1);
      if (stile || rail) return mt(M.wood, 0.6 + lk + (stile ? (pu < 0.5 ? -0.06 : 0.06) : 0) - shade - (wornEdge ? 0.14 : 0) + grime + grain(lx, ly, 67, stile) * 0.14, X, Y, 0.1, 1);
      // the field: the timber's figure in long streaks down the panel, darker toward its foot
      const figure = grain(lx, ly, 47) * 0.26 + (vnoise(lx * 0.09, ly * 0.012, 69) - 0.5) * 0.16;
      return mt(M.wood, 0.74 + lk - shade + figure + v * 0.1 + grime * 0.6 - (corner && wornEdge ? 0.1 : 0), X, Y, 0.1, 1);
    });
    // the hall's crest on the middle panel, gold, raised (round 2: the plum blossom of the door's plaque)
    const scx = W / 2, scy = (-T + TOPD - 0.09 * H) / 2, sr = Math.min(W * 0.07, (T - TOPD) * 0.3);
    plumCrest(c, Math.round(scx), Math.round(scy), Math.max(7, Math.round(sr)),
      (X, Y, lx, ly) => mt(M.gold, face(lf.get(lx, ly).k, side, (lx - scx) / sr, (ly - scy) / sr) * 0.95, X, Y, 0.05, 1),
      (X, Y) => mt(M.wood, 0.42, X, Y, 0.1, 1),
      (X, Y) => mt(M.gold, 1.05, X, Y, 0.05, 1));
    // the top board: overhanging, a bright lip along its whole length, its front edge a darker band
    rect(c, -6, -T, W + 6, -T + TOPD, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = ly + T;
      const endCap = lx < -3 || lx > W + 3;
      if (v < 2) return mt(M.wood, face(Math.max(l.k, 0.55), side, 0, -1) * 1.3, X, Y, 0.0, 1);
      // (round 2, W1-5) a brass strip along the top board's front edge, catching the lamp
      if (v < 4.5) return mt(M.gold, 0.62 + (face(l.k, side, 0, -0.4) - 0.35) * 0.6 + (v < 3 ? 0.12 : 0), X, Y, 0.0, 1);
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

/**
 * (round 2, W1-4) The main offering box as an offering chest on its own stage: a low stone plinth, the chest
 * wider than it is tall (a heavy rim, the slatted top band, the brass slit plate with its clear slit on the
 * front, a cash-coin crest, iron-dark corners), and over it a small frame of two slim posts and a tiled
 * crossbeam with a hanging sign (a gold cash coin) and its own lamp on a bracket off the west post. The
 * anchor is the chest's west end on the floor; w is the chest's width, h its top above the floor.
 */
function offeringStage(c: PaintCtx, lf: LitField, p: DonationP): void {
  const W = p.w, TOP = p.h;
  const side = sideOf(lf, W / 2, -TOP / 2);
  const v = (l: { k: number }, base: number, nx = 0, ny = 0): number => base + (face(l.k, side, nx, ny) - 0.35) * 0.6;
  const PL = Math.round(0.11 * H); // the plinth's height
  // (round 4, W1-b) the frame's posts stand behind the chest, inside its ends (they stood outside them, and the east one
  // was tangent to the bay column's base): the chest is the stage's widest line, the frame a slim gate behind it
  const px0 = 0.1 * W, px1 = 0.9 * W; // the frame's posts
  // (round 4, W1-b) taller (was 1.56 H): the bigger chest's lid needs the room under the sign and the lantern, and the
  // frame's beam and sign now stand clearly in front of the back colonnade's column base behind the chest instead of
  // touching it with the roof's ridge
  const postTop = -2.0 * H;
  // (hall loop round 2, W2-7) its own lantern's light, by what it lands on: the west post's face toward it, the
  // beam's underside, the sign's edge, the chest's rim and lid, a glint along the slit plate's top edge, the coins
  // on the plinth; falling off across the chest away from the lantern (0 .. 1)
  // (round 3, W1-3) the bracket swings inward off the west post, so the lantern hangs over the chest's west end and its
  // pool lands on the lid, the slit plate and the plinth (it hung outside the frame, lighting the post and the wall)
  const LX = px0 + 0.27 * H, LY = -0.95 * H;
  const g = (lx: number, ly: number): number => clamp(1 - Math.hypot((lx - LX) / (1.65 * H), (ly - LY) / (1.35 * H)), 0, 1);
  contact(c, -0.08 * H - 4, W + 0.08 * H + 4, 0.9);

  // --- the frame: two slim lacquer posts on stone feet, a crossbeam with a little tiled cap
  for (const fx of [px0, px1]) {
    box(c, lf, side, fx - 6, -PL - 4, fx + 6, -PL + 1, M.stone, 3, 0.2, 1, 2, 0.02);
    rect(c, fx - 3, postTop, fx + 3, -PL - 4, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - fx) / 3;
      return mt(M.verm, v(l, 0.5, u * 0.8, 0) + (u * side > 0.5 ? 0.12 : u * side < -0.5 ? -0.1 : 0) + (lx < fx ? g(lx, ly) * 0.75 : g(lx, ly) * 0.15), X, Y, 0.2, 1);
    });
  }
  const bm0 = postTop - 6, bm1 = postTop + 4;
  rect(c, px0 - 12, bm0, px1 + 12, bm1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const e = ly - bm0;
    const end = lx < px0 - 8 || lx > px1 + 8;
    if (e < 1.5) return mt(M.wood, v(l, 0.85, 0, -1), X, Y, 0.0, 1);
    if (end) return mt(M.gold, v(l, 0.6, lx < 0 ? -0.6 : 0.6, 0) + g(lx, ly) * 0.5, X, Y, 0.1, 1);
    return mt(M.lacq, v(l, 0.55) + grain(lx, ly, 97, false) * 0.05 + (bm1 - ly < 2.5 ? g(lx, ly) * 0.9 : 0), X, Y, 0.0, 1);
  });
  poly(c, [px0 - 20, bm0 + 1, px0 - 14, bm0 - 6, (px0 + px1) / 2, bm0 - 0.17 * H, px1 + 14, bm0 - 6, px1 + 20, bm0 + 1, px1 + 12, bm0 + 2, px0 - 12, bm0 + 2], (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const k = ((((lx - px0) % 6) + 6) % 6) / 6;
    return mt(M.tile, face(l.k, side, (k - 0.5) * 1.2, -0.4) * (0.5 + 0.35 * Math.sin(k * Math.PI)) + (ly > bm0 - 1 ? -0.1 : 0), X, Y, 0.1, 1);
  });

  // --- the hanging sign under the beam: dark lacquer in a gold frame, a big gold cash coin on it
  {
    // (round 4, W1-b) a bigger sign for the bigger stage (was 0.5 x 0.32 H)
    const sw = 0.62 * H, sh = 0.4 * H, sx0 = W / 2 - sw / 2, sy0 = bm1 + 0.12 * H, sy1 = sy0 + sh;
    for (const kx of [sx0 + 6, sx0 + sw - 6]) cord(c, kx, bm1, kx, sy0, 0, (X, Y) => tn(M.verm, 0.45, X, Y, 0));
    rect(c, sx0, sy0, sx0 + sw, sy1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx - sx0, sx0 + sw - lx, ly - sy0, sy1 - ly);
      if (e < 2) return mt(M.gold, v(l, 0.62, 0, ly - sy0 < 2 ? -0.8 : 0.3) + (lx - sx0 < 2 ? g(lx, ly) * 0.8 : g(lx, ly) * 0.3), X, Y, 0.05, 1);
      return mt(M.lacq, v(l, 0.42) + grain(lx, ly, 99, false) * 0.05, X, Y, 0.0, 1);
    });
    cashCoin(c, W / 2, (sy0 + sy1) / 2, sh * 0.34, (X, Y) => tn(M.gold, 0.18, X, Y, 0), (X, Y) => tn(M.gold, 0.55, X, Y, 0), (X, Y) => tn(M.gold, 0.0, X, Y, 0));
  }

  // --- its own lamp: an iron bracket off the west post reaching in over the chest (round 3, W1-3), a small paper
  // lantern hanging from it, lit; its light lands on the chest's lid and slit plate and on the plinth
  {
    const ax = px0 + 0.27 * H, ay = -1.12 * H;
    // the iron arm: its top edge catching the lantern's light, a scroll at its end, a brace up from the post
    rect(c, px0 + 3, ay - 2, ax + 3, ay + 1.5, (X, Y, _lx, ly) => (ly < ay - 0.8 ? tn(M.bronze, 0.35, X, Y, 0) : tn(M.lacq, 0.5, X, Y, 0)));
    rect(c, ax + 2, ay - 5, ax + 5, ay - 1, (X, Y, lx, ly) => (Math.hypot(lx - ax - 3.5, ly - ay + 3) < 2.2 && Math.hypot(lx - ax - 3.5, ly - ay + 3) > 0.9 ? tn(M.bronze, 0.45, X, Y, 0) : 0));
    poly(c, [px0 + 3, ay + 1, px0 + 3, ay + 12, px0 + 14, ay + 1], (X, Y, lx, ly) => (Math.abs((lx - px0 - 3) - (ly - ay - 1)) < 1.6 || lx < px0 + 4.5 ? tn(M.lacq, 0.5, X, Y, 0) : 0));
    const lx0 = ax - 10, lx1 = ax + 10, l0 = ay + 6, l1 = ay + 0.28 * H;
    cord(c, ax, ay + 1, ax, l0, 0, (X, Y) => tn(M.lacq, 0.6, X, Y, 0));
    rect(c, lx0, l0, lx1, l1, (X, Y, lx, ly) => {
      const u = (lx - lx0) / (lx1 - lx0), vv = (ly - l0) / (l1 - l0);
      const round = Math.abs(u - 0.5) < 0.5 - Math.abs(vv - 0.5) * 0.28;
      if (!round) return 0;
      if (vv < 0.1 || vv > 0.9) return mt(M.lacq, 0.45, X, Y, 0.1, 1);
      if (Math.abs(vv - 0.5) < 0.04 || Math.abs(u - 0.5) < 0.04) return tn(P.red, 0.4, X, Y, 0);
      return tn(SCREEN, clamp(0.02 + Math.abs(u - 0.5) * 0.9 + Math.abs(vv - 0.5) * 0.4, 0, 1), X, Y, 0.45);
    });
    rect(c, ax - 1, l1, ax + 1, l1 + 6, (X, Y) => tn(P.red, 0.35, X, Y, 0));
  }

  // --- the plinth: one low stone block with a chamfered top edge, chipped, a step wider than the chest
  rect(c, -0.08 * H, -PL, W + 0.08 * H, 0, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const vv = (ly + PL) / PL;
    const nx = lx < -0.08 * H + 3 ? -0.8 : lx > W + 0.08 * H - 3 ? 0.8 : 0;
    const chip = fbm(lx * 0.35, ly * 0.35, 101, 2) > 0.72 ? 0.12 : 0;
    const joint = Math.abs(lx - W * 0.38) < 0.7 && vv > 0.25;
    return mt(M.stone, v(l, vv < 0.2 ? 0.72 : 0.5, nx, vv < 0.2 ? -0.9 : 0) - chip - (joint ? 0.15 : 0) - (vv > 0.85 ? 0.08 : 0) + g(lx, ly) * (vv < 0.2 ? 1.0 : 0.5), X, Y, 0.15, 1);
  });

  // --- the chest: body, corners, crest, the slit plate, the slatted band, the heavy rim
  const b1 = -PL, rim = Math.round(0.07 * H), slats = Math.round(0.09 * H);
  const r0 = -TOP, r1 = r0 + rim, s1 = r1 + slats;
  rect(c, 0, s1, W, b1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const u = lx / W, vv = (ly - s1) / (b1 - s1);
    const [nx, ny] = bevel(u, vv, 3 / W, 3 / (b1 - s1));
    // the front's two boards with a seam, the grain running across
    const seam = Math.abs(vv - 0.55) < 0.03;
    // dark weathered timber, so the brass slit plate and the coin crest stand out on it
    return mt(M.wood, v(l, seam ? 0.22 : 0.46, nx, ny) + grain(lx, ly, 103, false) * 0.08 - vv * 0.06 + g(lx, ly) * 1.2, X, Y, 0.2, 1);
  });
  // iron-dark corner brackets and studs
  for (const [fx, fy, sx, sy] of [[0, s1, 1, 1], [W, s1, -1, 1], [0, b1, 1, -1], [W, b1, -1, -1]] as const) {
    rect(c, Math.min(fx, fx + sx * 9), Math.min(fy, fy + sy * 9), Math.max(fx, fx + sx * 9), Math.max(fy, fy + sy * 9), (X, Y, lx, ly) => {
      const dx = Math.abs(lx - fx), dy = Math.abs(ly - fy);
      if (dx > 2.6 && dy > 2.6) return 0;
      const stud = (Math.abs(dx - 6) < 1 && dy < 2) || (Math.abs(dy - 6) < 1 && dx < 2);
      return stud ? tn(M.gold, 0.2, X, Y, 0) : mt(M.lacq, v(lf.get(lx, ly), 0.3, sx * -0.3, sy * 0.3), X, Y, 0.0, 1);
    });
  }
  // the crest on the lower board: a gold cash coin
  cashCoin(c, W / 2, s1 + (b1 - s1) * 0.68, Math.min(7, (b1 - s1) * 0.22), (X, Y) => tn(M.gold, 0.22, X, Y, 0), (X, Y) => tn(M.gold, 0.6, X, Y, 0), (X, Y) => tn(M.gold, 0.02, X, Y, 0));
  // the slit plate: a brass plate across the upper board, its top edge catching the light, the slit black
  {
    const slW = Math.round(W * 0.5), slY = s1 + 7;
    const ex0 = W / 2 - slW / 2 - 6, ex1 = W / 2 + slW / 2 + 6, ey0 = s1 + 2, ey1 = s1 + 13;
    rect(c, ex0, ey0, ex1, ey1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - ex0) / (ex1 - ex0), vv = (ly - ey0) / (ey1 - ey0);
      const rivet = Math.abs(vv - 0.5) < 0.16 && (Math.abs(u - 0.05) < 0.025 || Math.abs(u - 0.95) < 0.025);
      if (rivet) return tn(M.gold, 0.6, X, Y, 0);
      // the glint: the plate's top edge catching the lantern, hottest at its lantern end, running out across it
      if (ly < ey0 + 1) return g(lx, ly) > 0.12 + hash(Math.floor(lx), 3, 107) * 0.06 ? P.paper[0]! : mt(M.gold, v(l, 0.95, 0, -0.9) + g(lx, ly), X, Y, 0.0, 1);
      if (ly < ey0 + 2.2 && g(lx, ly) > 0.2) return tn(M.gold, 0.0, X, Y, 0);
      if (ly > ey1 - 1.2) return mt(M.gold, v(l, 0.35, 0, 0.8), X, Y, 0.0, 1);
      return mt(M.gold, v(l, 0.72, (u - 0.5) * 0.6, 0) + g(lx, ly) * 0.8, X, Y, 0.0, 1);
    });
    rect(c, W / 2 - slW / 2, slY - 1, W / 2 + slW / 2, slY, (X, Y) => tn(M.gold, 0.0, X, Y, 0));
    rect(c, W / 2 - slW / 2, slY, W / 2 + slW / 2, slY + 3, () => P.ink[0]!);
    // a coin going into the slit: its upper half still out, glinting
    const cx = W / 2 + 6, cr = 3.6;
    rect(c, cx - cr, slY - cr, cx + cr, slY, (X, Y, lx, ly) => {
      const d = Math.hypot(lx - cx, ly - slY) / cr;
      if (d > 1) return 0;
      return d > 0.75 ? tn(M.gold, 0.5, X, Y, 0) : lx < cx && ly < slY - 1.5 ? tn(M.gold, 0.0, X, Y, 0) : tn(M.gold, 0.22, X, Y, 0);
    });
  }
  // the slatted band over the plate: the top's slats seen end-on, dark gaps between them
  rect(c, 1, r1, W - 1, s1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const k = ((lx - 1) % 7 + 7) % 7;
    const gap = k > 4.5;
    if (ly > s1 - 1.2) return mt(M.lacq, v(l, 0.2), X, Y, 0.0, 1);
    if (gap) return mt(M.lacq, v(l, 0.12), X, Y, 0.0, 1);
    return mt(M.wood, v(l, k < 1 ? 0.78 : 0.6, k < 1 ? -0.5 : 0.3, 0) + g(lx, ly) * (k < 1.5 ? 1.1 : 0.7), X, Y, 0.1, 1);
  });
  // the heavy rim: overhanging, a bright top lip, gold end caps, a dark underside line
  rect(c, -4, r0, W + 4, r1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const vv = ly - r0;
    const cap = lx < 1 || lx > W - 1;
    if (vv < 1.5) return g(lx, ly) > 0.12 ? P.paper[g(lx, ly) > 0.28 ? 0 : 1]! : mt(M.wood, v(l, 1.0, 0, -1), X, Y, 0.0, 1);
    if (r1 - ly < 1.5) return mt(M.lacq, v(l, 0.18, 0, 0.8), X, Y, 0.0, 1);
    if (cap) return mt(M.gold, v(l, 0.62, lx < 0 ? -0.6 : 0.6, 0), X, Y, 0.05, 1);
    return mt(M.verm, v(l, 0.5) + grain(lx, ly, 105, false) * 0.05 + g(lx, ly) * (vv < 3.5 ? 1.2 : 0.8), X, Y, 0.15, 1);
  });

  // --- offerings on the plinth: coins scattered and a short stack, a mandarin on a dish
  const py = -PL;
  for (const [ox, oy] of [[-5, 0], [-2, 0], [W + 2, 0], [W + 5, -1]] as const) {
    const gc = g(ox, py + oy);
    rect(c, ox - 2, py + oy - 1.5, ox + 2, py + oy, (X, Y, lx, ly) => (ly < py + oy - 0.6 && lx < ox + 1 ? (gc > 0.2 ? P.paper[0]! : tn(M.gold, 0.0, X, Y, 0)) : lx < ox ? tn(M.gold, 0.12 - gc * 0.12, X, Y, 0) : tn(M.gold, 0.42 - gc * 0.3, X, Y, 0)));
  }
  coinStack(c, W + 0.02 * H, py, 5, 3, (X, Y) => tn(M.gold, 0.25, X, Y, 0), (X, Y) => tn(M.gold, 0.6, X, Y, 0), (X, Y) => tn(M.gold, 0.0, X, Y, 0));
  rect(c, -0.075 * H, py - 2, -0.075 * H + 11, py, (X, Y) => tn(P.paper, 0.45, X, Y, 0));
  {
    const mx = -0.075 * H + 5.5, my = py - 5.5;
    rect(c, mx - 4, my - 4, mx + 4, my + 4, (X, Y, lx, ly) => {
      const d = Math.hypot((lx - mx) / 3.6, (ly - my) / 3.4);
      if (d > 1) return 0;
      if (ly < my - 2.5 && Math.abs(lx - mx) < 1) return tn(P.moss, 0.4, X, Y, 0);
      return tn(P.ember, clamp(0.62 + (lx - mx) / 3.6 * 0.15 + (ly - my) / 3.4 * 0.12, 0, 1), X, Y, 0.3);
    });
  }
}

export const donation = definePainter<DonationP>("hall.donation", {
  bounds(p) {
    if (p.main && !p.ped) return [-0.5 * H, -2.35 * H, p.w + 0.35 * H, 6];
    return [-0.3 * H, -(p.ped ?? 0) - p.h - 0.55 * H, p.w + 0.3 * H, 6];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 6);
    if (p.main && !p.ped) {
      offeringStage(c, lf, p);
      return;
    }
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
      // (round 2, W1-2) wordless: a cash coin in red ink
      cashCoin(c, (qx0 + qx1) / 2, (qy0 + qy1 - 2) / 2, Math.min((qx1 - qx0) / 2 - 2.5, 5), (X, Y) => tn(P.red, 0.4, X, Y, 0), (X, Y) => tn(P.red, 0.6, X, Y, 0));
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
      // (round 2, W1-2) wordless: a big gold cash coin (the sponsors' gifts) between two gold cloud scrolls
      const ccx = W / 2, ccy = (hy0 + hy1) / 2, cr = headH * 0.36;
      cashCoin(c, ccx, ccy, cr, (X, Y) => tn(M.gold, 0.15, X, Y, 0), (X, Y) => tn(M.gold, 0.5, X, Y, 0), (X, Y) => tn(M.gold, 0.0, X, Y, 0));
      const goldC = (X: number, Y: number): number => tn(M.gold, 0.15, X, Y, 0);
      cloudScroll(c, hx0 + 14, ccy, 5, 1, ccx - cr - 6 - (hx0 + 14), goldC);
      cloudScroll(c, hx1 - 14, ccy, 5, -1, hx1 - 14 - (ccx + cr + 6), goldC);
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
    // (round 3, W1-4) ranks 4-6 in red lacquer with gold figures, a step down from the metals but lit, not dark plates
    // (they were dark timber, L 33, and read as empty slots)
    const tabs: [number, number, Ramp][] = [[0.8, 0.24, M.gold], [0.7, 0.17, SILVER], [0.66, 0.17, P.bronze], [0.58, 0.14, M.verm], [0.48, 0.14, M.verm], [0.53, 0.14, M.verm]];
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
        const k = face(Math.max(l.k, metal ? 0.5 : 0.5), side, nx, ny) * (lip ? 1.25 : 1) + (metal ? Math.sin(u * 9 + v * 3) * 0.04 : grain(lx, ly, 65 + i, false) * 0.06);
        // the lacquer plates: a gold line inside the edge
        if (!metal && (Math.abs(u - 0.03) < 0.012 || Math.abs(u - 0.97) < 0.012) && v > 0.18 && v < 0.82) return tn(M.gold, 0.35, X, Y, 0);
        return mt(ramp, k, X, Y, 0.0, metal ? 0.85 : 0.9);
      });
      // (round 2, W1-2) the rank's numeral at the left (bold for the top three), then the gift as stacks of
      // coins on a dark inset, more and taller the higher the rank (no names until the first real sponsor)
      const my = (y0 + y1) / 2;
      const bold = i < 3, nh = bold ? 9 : 7, nw = bold ? 6 : 5;
      const ink = (X: number, Y: number): number => (metal ? tn(M.lacq, 0.6, X, Y, 0) : tn(M.gold, 0.12, X, Y, 0));
      const nx0 = tx0 + (bold ? 5 : 4), ny0 = Math.round(my - nh / 2);
      text(c, nx0, ny0, String(i + 1), ink, { bold, shadow: metal ? (X, Y) => tn(ramp, 0.02, X, Y, 0) : undefined });
      const ix0 = nx0 + nw + 4, ix1 = tx1 - 4, iy0 = y0 + 3, iy1 = y1 - 3;
      rect(c, ix0, iy0, ix1, iy1, (X, Y, lx, ly) => (ly < iy0 + 1 ? tn(M.lacq, 0.85, X, Y, 0) : ly > iy1 - 1 ? tn(ramp, 0.0, X, Y, 0) : mt(M.lacq, face(lf.get(lx, ly).k, side) * 0.45, X, Y, 0.2, 1)));
      const tallest = Math.max(1, Math.floor((iy1 - iy0 - 2) / 2));
      const heights = [[7, 6, 7, 5, 6, 4, 5, 3], [4, 5, 3, 4, 3, 2], [4, 3, 4, 2, 3], [3, 2, 3, 2], [2, 3, 1], [2, 1, 2]][i]!;
      let sx = ix0 + 3;
      for (const hgt of heights) {
        if (sx + 6 > ix1 - 2) break;
        coinStack(c, sx, iy1 - 1, 6, Math.min(tallest, hgt), (X, Y) => tn(M.gold, 0.22, X, Y, 0), (X, Y) => tn(M.gold, 0.62, X, Y, 0), (X, Y) => tn(M.gold, 0.0, X, Y, 0));
        sx += 8;
      }
      if (i === 0) {
        // the first one's red tassels
        for (const tx of [tx0 - 1, tx1 + 1]) rect(c, tx - 1, my - 1, tx + 1, my + 12, (X, Y, _lx, ly) => tn(M.verm, ly > my + 7 ? 0.45 : 0.3, X, Y, 0));
      }
      ty = y1 + 6;
    });
    // (round 3, W1-4) the board closes with a footer instead of an empty dark strip: a coin tray on the base rail and
    // a gold arrow plate pointing east, to the offering chest that stands beside it (give there, rise here)
    {
      const fy0 = Math.min(ty - 2, by1 - 13), fy1 = by1 - 1;
      const fx0 = bx0 + 6, fx1 = bx1 - 6;
      rect(c, fx0, fy0, fx1, fy1, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const e = Math.min(lx - fx0, fx1 - lx, ly - fy0, fy1 - ly);
        if (e < 1.5) return mt(M.gold, face(Math.max(l.k, 0.5), side, 0, ly - fy0 < 1.5 ? -0.9 : 0.4), X, Y, 0.05, 1);
        return mt(M.verm, face(Math.max(l.k, 0.45), side) * 0.85 + grain(lx, ly, 67, false) * 0.05, X, Y, 0.1, 1);
      });
      // the arrow: a gold shaft and head pointing east, its tail a cash coin
      const ay = Math.round((fy0 + fy1) / 2), ax0 = fx0 + 16, ax1 = fx1 - 6;
      cashCoin(c, fx0 + 9, ay, Math.min(5, (fy1 - fy0) * 0.36), (X, Y) => tn(M.gold, 0.15, X, Y, 0), (X, Y) => tn(M.gold, 0.5, X, Y, 0), (X, Y) => tn(M.gold, 0.0, X, Y, 0));
      rect(c, ax0, ay - 1, ax1 - 6, ay + 1, (X, Y) => tn(M.gold, 0.12, X, Y, 0));
      poly(c, [ax1 - 8, ay - 5, ax1, ay, ax1 - 8, ay + 5], (X, Y, _lx, ly) => tn(M.gold, ly < ay ? 0.05 : 0.3, X, Y, 0));
      // the coin tray on the base rail: a shallow lacquer dish, a few coins in it
      const tx0 = (bx0 + bx1) / 2 - 12, tx1 = tx0 + 24, ty1 = by1 + 1;
      rect(c, tx0, ty1 - 4, tx1, ty1, (X, Y, lx, ly) => (ly < ty1 - 3 ? mt(M.gold, face(lf.get(lx, ly).k, side, 0, -0.9) * 0.9, X, Y, 0.05, 1) : mt(M.lacq, face(lf.get(lx, ly).k, side) * 0.5, X, Y, 0.1, 1)));
      for (const cx of [tx0 + 6, tx0 + 11, tx0 + 17]) rect(c, cx - 2, ty1 - 6, cx + 2, ty1 - 4, (X, Y, lx) => tn(M.gold, lx < cx ? 0.0 : 0.35, X, Y, 0));
    }
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
    // (round 3, W2-1) the crest rail's top catches the lantern hung over the map: a warm line, hottest under it
    rect(c, -5, by0 - 7, W + 5, by0 - 5, (X, Y, lx) => tn(P.ember, clamp(0.55 + Math.abs(lx - W / 2) / (W * 0.9), 0, 1), X, Y, 0.4));
    for (const kx of [-7, W + 7]) lathe(c, kx, by0 - 9, by0 + 2, () => 3.6, (X, Y, u, _lx, ly) => mt(M.gold, cyl(lf.get(kx, ly).k, u, side), X, Y, 0.0, 1));
    // the frame and the mount (a dark teal silk border)
    rect(c, 0, by0, W, by1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const e = Math.min(lx, W - lx, ly - by0, by1 - ly);
      if (e < 3) return mt(M.wood, face(l.k, side, lx < 3 ? -0.6 : lx > W - 3 ? 0.6 : 0, ly < by0 + 3 ? -0.6 : 0.5) * 0.8, X, Y, 0.2, 1);
      return tn(P.jade, clamp(0.78 - l.k * 0.25, 0, 1), X, Y, 0.4);
    });
    // the map itself (round 2, W1-3: Tesu, not a treasure map): Kagami's water on the west with the jetty, the
    // gate road climbing east to the Ink Palace on its rock with the court on its prow (a "you are here" pin),
    // Shiraito's falls down the palace's cliff into Hoai Pho's lake, the ranges east as ink ridgelines with
    // the Peak's needle, the title and a compass
    const mx0 = 7, mx1 = W - 7, my0 = by0 + 6, my1 = by1 - 6;
    const mw = mx1 - mx0, mh = my1 - my0;
    const U = (u: number): number => mx0 + u * mw, V = (v: number): number => my0 + v * mh;
    const coast = (v: number, lx: number): number => 0.22 + 0.045 * Math.sin(v * 7.5 + 0.6) + 0.035 * (vnoise(v * 9, lx * 0.01, 75) - 0.5) + (v > 0.8 ? (v - 0.8) * 0.5 : 0);
    // the ranges east: three ridgelines, nearer ones darker; each ridge a run of peaks with a wash under it
    const ridges: [number, number, number, number][] = [[0.64, 0.97, 0.36, 0.24], [0.66, 0.98, 0.5, 0.17], [0.72, 0.99, 0.62, 0.11]];
    const ridgeY = (r: number, u: number): number => {
      const [r0, r1, base, amp] = ridges[r]!;
      // peaks of uneven heights with full shoulders (a triangle wave bowed outward, a broken crest), falling away
      // at the range's ends: crags, not tent canopies
      const t = u * 17 / Math.PI + r * 0.54;
      const tri = 1 - Math.abs(((t % 1) + 1) % 1 * 2 - 1);
      const pk = (Math.pow(tri, 0.7) + 0.12 * (vnoise(u * 60, r, 83) - 0.5)) * (0.45 + 0.55 * Math.abs(Math.sin(t * 0.91 + r * 2.1)));
      const ends = Math.min(1, (u - r0) / 0.05, (r1 - u) / 0.05);
      return base - amp * pk * Math.max(0, ends);
    };
    const cliffU0 = 0.55, cliffU1 = 0.6;
    /** Where Shiraito's falls leave the cliff's lip (u). */
    const FALL_U = 0.579;
    rect(c, mx0, my0, mx1, my1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - mx0) / mw, v = (ly - my0) / mh;
      const lit = Math.max(0.55, l.k);
      const age = fbm(u * 4, v * 3, 77, 3) - 0.5;
      const vig = Math.max(0, Math.max(Math.abs(u - 0.5) - 0.38, Math.abs(v - 0.5) - 0.34)) * 2.2;
      const cu = coast(v, lx);
      // the water: a jade wash, wave ticks, deeper off the shore
      // (round 4, W1-d: the pale board, L 167, was as bright as the gate, a second focal point) the whole map two value
      // steps down, aged silk under old ink: the lake, the falls and the pin are its only light marks
      if (u < cu) {
        if (cu - u < 0.012) return tn(P.jade, 0.8, X, Y, 0);
        const tick = Math.abs(Math.sin(lx * 0.9 + Math.floor(ly / 4) * 1.7)) > 0.93 && (Math.floor(ly) % 4 === 0);
        return tn(P.jade, clamp(0.56 + (cu - u) * 0.6 + (tick ? -0.1 : 0) + vig - (lit - 0.55) * 0.3, 0, 1), X, Y, 0.4);
      }
      // Hoai Pho's lake under the palace's prow
      const ld = Math.hypot((u - 0.66) / 0.09, (v - 0.8) / 0.12);
      if (ld < 1) return ld > 0.82 ? tn(P.blue, 0.55, X, Y, 0) : tn(P.blue, clamp(0.1 + ld * 0.14, 0, 1), X, Y, 0.4);
      // the palace's cliff (round 3, W1-8: it was a dark ruled bar with the falls as a white line in it, which read as
      // the pin's post): a ragged ink-wash crag from the rock down to the lake, wider at its shoulder, its west edge
      // broken, darkest under the rock and thinning into mist at its foot; the wash pales beside the falls (spray),
      // so the falls are never outlined in black
      if (v > 0.36 && v < 0.76) {
        const t = (v - 0.36) / 0.4;
        const w0 = cliffU0 - 0.03 + 0.012 * Math.sin(v * 41 + 0.7) + (vnoise(v * 26, 3, 91) - 0.5) * 0.026 + t * 0.03;
        const w1 = cliffU1 + 0.006 + 0.007 * Math.sin(v * 29 + 2.1) - t * 0.016;
        if (u > w0 && u < w1) {
          const stroke = Math.abs(Math.sin(lx * 1.3 + v * 9)) > 0.88;
          const spray = Math.max(0, 1 - Math.abs(lx - U(FALL_U)) / 3.2);
          if (t > 0.7 && !keep(X, Y, (1 - t) / 0.3)) {
            // the foot dissolves into the lake's mist: paper (or the lake) shows through
          } else return tn(P.range, clamp(0.78 - t * 0.38 + (stroke ? 0.08 : 0) + ((u - w0) / (w1 - w0)) * 0.1 - spray * 0.5, 0, 1), X, Y, 0.35);
        }
      }
      // the ridges, ink-painting style: the nearest range first, so its body hides the ranges behind it; each an
      // ink line along the crest, a wash darkest under the crest that fades into the paper downhill (mist at the
      // feet), the east-facing slopes a step darker; the far ranges paler
      for (let r = ridges.length - 1; r >= 0; r--) {
        const [r0, r1] = ridges[r]!;
        if (u < r0 || u > r1) continue;
        const ry = ridgeY(r, u), dy = v - ry;
        if (dy < 0) continue;
        if (dy < 0.022) {
          const tip = ridgeY(r, u - 0.012) > ry + 0.01 && ridgeY(r, u + 0.012) > ry + 0.01;
          return tip && r < 2 ? tn(P.range, 0.3, X, Y, 0) : tn(M.ink, 0.12 + r * 0.22, X, Y, 0);
        }
        const depth = 0.17 - r * 0.02, fall = dy / depth;
        if (fall < 1) {
          const shadeSide = ridgeY(r, u + 0.01) < ry;
          // texture strokes down the shade side (the brush's dry hairs), the wash thinning into dither below
          const hair = shadeSide && Math.abs(Math.sin(lx * 1.7 + ly * 0.35)) > 0.8 && fall < 0.75;
          if (fall > 0.55 && !keep(X, Y, (1 - fall) / 0.45)) break;
          return tn(P.range, clamp(0.68 + r * 0.06 + (shadeSide ? 0.16 : 0) + (hair ? 0.12 : 0) - fall * 0.1, 0, 1), X, Y, 0.35);
        }
        break; // the body below the wash: paper, and it hides the ranges behind
      }
      // the land: aged paper, a hint of green low
      const green = vnoise(u * 5, v * 5, 79) > 0.62 && v > 0.62;
      return green ? tn(P.moss, clamp(0.5 + vig, 0, 1), X, Y, 0.4) : mt(M.paper, lit * (1.0 - vig) + age * 0.22, X, Y, 0.52, 0.98);
    });
    // the Peak: a tall thin needle in the near range
    {
      const nx = U(0.86), ny = V(ridgeY(0, 0.86));
      poly(c, [nx - 2.5, ny + 2, nx - 0.8, ny - 0.14 * mh, nx + 0.8, ny - 0.14 * mh, nx + 2.5, ny + 2], (X, Y, lx) => (lx > nx ? tn(P.range, 0.75, X, Y, 0) : tn(P.range, 0.35, X, Y, 0)));
    }
    // forest dots on the low land
    for (let i = 0; i < 24; i++) {
      const fu = 0.28 + hash(i, 1, 81) * 0.36, fv = 0.5 + hash(i, 2, 81) * 0.42;
      if (Math.hypot((fu - 0.66) / 0.11, (fv - 0.8) / 0.14) < 1 || fu < coast(fv, 0) + 0.03 || (fu > cliffU0 - 0.02 && fv < 0.76)) continue;
      const x = U(fu), y = V(fv);
      rect(c, x - 1, y - 1, x + 1, y + 1, (X, Y) => tn(P.moss, 0.55, X, Y, 0));
    }
    // routes: dashed ink; the gate road in red from the jetty up to the palace
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
    path([[0.66, 0.68], [0.72, 0.62], [0.8, 0.66], [0.9, 0.56]], (X, Y) => tn(M.ink, 0.3, X, Y, 0), 2);
    path([[0.27, 0.6], [0.33, 0.56], [0.38, 0.47], [0.44, 0.42], [0.49, 0.34]], (X, Y) => tn(P.red, 0.2, X, Y, 0), 3);
    // the jetty into the water, a boat beside it
    rect(c, U(0.13), V(0.6) - 0.5, U(0.25), V(0.6) + 1, (X, Y) => tn(P.timber, 0.55, X, Y, 0));
    for (const pu of [0.15, 0.19, 0.23]) rect(c, U(pu), V(0.6) + 1, U(pu) + 1, V(0.6) + 3, (X, Y) => tn(P.timber, 0.75, X, Y, 0));
    poly(c, [U(0.13) - 1, V(0.68), U(0.18) + 1, V(0.68), U(0.17), V(0.71), U(0.14), V(0.71)], (X, Y) => tn(P.timber, 0.6, X, Y, 0));
    // Shiraito's falls (round 3, W1-8): off the cliff's lip under the palace rock, a ribbon that widens and frays as it
    // drops (pale streaks, no outline), and a mist puff where it meets the lake
    {
      const fx = U(FALL_U), f0 = V(0.4), f1 = V(0.71);
      rect(c, fx - 3, f0, fx + 4, f1, (X, Y, lx, ly) => {
        const t = (ly - f0) / (f1 - f0);
        const half = 0.7 + t * 1.5, cx = fx + Math.sin(t * 5) * 0.4;
        const d = Math.abs(lx + 0.5 - cx);
        if (d > half) return 0;
        const streak = Math.abs(Math.sin(lx * 2.3 + ly * 0.15)) > 0.7;
        if (d > half - 0.8 && !keep(X, Y, 0.55)) return 0;
        return tn(P.snow, streak ? 0.0 : 0.2 + t * 0.15, X, Y, 0);
      });
      // the lip: a pale notch where the water leaves the rock
      rect(c, fx - 2, f0 - 1, fx + 3, f0 + 1, (X, Y) => tn(P.snow, 0.25, X, Y, 0));
      // the mist puff at the foot, wider than the falls, dithered out at its edge
      const mx = fx + 0.5, my = V(0.735);
      rect(c, mx - 7, my - 4, mx + 7, my + 3, (X, Y, lx, ly) => {
        const d = Math.hypot((lx - mx) / 6.5, (ly - my) / 3.2);
        if (d > 1) return 0;
        return keep(X, Y, clamp(1.15 - d, 0, 1)) ? tn(P.snow, d < 0.5 ? 0.0 : 0.2, X, Y, 0) : 0;
      });
    }
    // the Ink Palace on its rock: a grey rock under a red-roofed hall, the court a gold disc on its prow, and
    // the "you are here" pin over the hall (this hall)
    {
      const px = U(0.51), py = V(0.33);
      poly(c, [px - 10, py + 3, px - 6, py - 1, px + 12, py - 1, U(cliffU1) + 1, py + 2, U(cliffU1), V(0.4), px - 7, py + 7], (X, Y, _lx, ly) => tn(P.stone, ly > py + 3 ? 0.65 : 0.45, X, Y, 0));
      poly(c, [px - 8, py - 1, px - 5, py - 5, px + 7, py - 5, px + 10, py - 1], (X, Y) => tn(P.red, 0.3, X, Y, 0));
      rect(c, px - 5, py - 1, px + 7, py + 2, (X, Y, lx) => tn(P.red, Math.abs(lx - px - 1) < 1 ? 0.55 : 0.15, X, Y, 0));
      const cx = U(0.605), cy = V(0.37);
      rect(c, cx - 3, cy - 2, cx + 3, cy + 2, (X, Y, lx, ly) => (Math.hypot((lx - cx) / 3, (ly - cy) / 2) < 1 ? tn(M.gold, Math.hypot(lx - cx, ly - cy) < 1.5 ? 0.0 : 0.3, X, Y, 0) : 0));
      // the pin: a red head with a white eye, its point on the hall
      const hx = px + 1, hy = py - 13;
      rect(c, hx - 4, hy - 4, hx + 4, py - 5, (X, Y, lx, ly) => {
        const d = Math.hypot(lx - hx, ly - hy);
        if (d < 1.6) return tn(P.snow, 0.0, X, Y, 0);
        if (d < 3.8) return tn(P.red, lx < hx && ly < hy ? 0.05 : 0.3, X, Y, 0);
        const t = (ly - hy) / (py - 5 - hy);
        return ly > hy && Math.abs(lx - hx) < 3.2 * (1 - t) ? tn(P.red, 0.45, X, Y, 0) : 0;
      });
    }
    // the title cartouche on the water ("TESU" in ink on paper, a red border), a compass rose in the corner
    {
      const tw = textWidth("TESU");
      const tx0 = U(0.03), ty0 = V(0.07), tx1 = tx0 + tw + 6, ty1 = ty0 + 11;
      rect(c, tx0, ty0, tx1, ty1, (X, Y, lx, ly) => {
        const e = Math.min(lx - tx0, tx1 - lx, ly - ty0, ty1 - ly);
        return e < 1 ? tn(P.red, 0.35, X, Y, 0) : mt(M.paper, 0.95, X, Y, 0.38, 0.8);
      });
      text(c, tx0 + 3, ty0 + 2, "TESU", (X, Y) => tn(M.ink, 0.05, X, Y, 0));
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
    return [p.bench[0] - 0.4 * H, -0.95 * H, p.table[1] + 0.2 * H, 6];
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
    // books stacked on the floor under the side table (round 2: the lamp stands at the bench's left end now)
    {
      const sx = (t0 + t1) / 2;
      const books: [number, number, Ramp][] = [[22, 5, P.blue], [18, 4, M.verm]];
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
    // (round 3, W2-12: no seat read as a seat) a reading bench with a low back and arms: two back posts with knobs, a
    // carved top rail, a few slats between (open, so the wall shows through), an arm at each end
    {
      const bt = -seat - 0.42 * H;
      for (const px of [b0 + 1, b1 - 5]) {
        rect(c, px, bt, px + 4, -seat, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, lx < px + 1.5 ? -0.6 : lx > px + 2.5 ? 0.6 : 0, 0) * 0.8 + grain(lx, ly, 95) * 0.06, X, Y, 0.2, 1));
        rect(c, px - 0.5, bt - 4, px + 4.5, bt, (X, Y, lx, ly) => (Math.hypot(lx - px - 2, ly - bt + 2) < 2.6 ? mt(M.gold, face(lf.get(lx, ly).k, side, (lx - px - 2) / 2.5, -0.5) * 0.9, X, Y, 0.1, 1) : 0));
      }
      rect(c, b0 + 1, bt + 1, b1 - 1, bt + 6, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const carve = Math.sin((lx - b0) * 0.35) * Math.cos((ly - bt) * 0.9) > 0.5;
        return mt(M.wood, face(l.k, side, 0, ly < bt + 2 ? -0.8 : 0.3) * (carve ? 0.62 : 0.85), X, Y, 0.2, 1);
      });
      for (let sx = b0 + 10; sx < b1 - 8; sx += 9) rect(c, sx, bt + 6, sx + 2, -seat - 6, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side) * 0.62, X, Y, 0.3, 1));
      for (const [ax, dir] of [[b0 - 2, 1], [b1 + 2, -1]] as const) {
        rect(c, Math.min(ax, ax + dir * 8), -seat - 0.2 * H, Math.max(ax, ax + dir * 8), -seat - 0.2 * H + 3, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side, 0, -0.8) * 0.9, X, Y, 0.2, 1));
        rect(c, ax - 1, -seat - 0.2 * H + 3, ax + 2, -seat, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, side) * 0.7, X, Y, 0.2, 1));
      }
    }
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
      // (round 2) the art hangs high now: each leaf's lower part is a wainscot under a gold rail
      // (round 3, W2-3b: it was a cracked-ice panel that read as rubble behind the timber rail) a raised and fielded
      // timber panel in each leaf: a frame of rails and stiles, the field's bevels lit on the top and the lamp's side
      // and dark on the others, the field itself dark lacquered timber with its grain
      const dado = -skirt - Math.min(0.85 * H, Ht * 0.32);
      if (ly > dado) {
        if (ly < dado + 2) return mt(M.gold, face(l.k, side, 0, ly < dado + 1 ? -0.8 : 0.4) * 0.75, X, Y, 0.2, 1);
        const fr = 4, bev = 2.5;
        const ex = Math.min(k - 1.5 - fr, lw - 1.5 - fr - k), ey = Math.min(ly - dado - 2 - fr, -skirt - fr - ly);
        const g = grain(lx, ly, 109 + Math.floor(lx / lw), false) * 0.1;
        if (ex < 0 || ey < 0) {
          // the frame round the panel, a dark arris where it meets the field
          if (ex > -1.2 && ey > -1.2) return mt(M.lacq, face(l.k, side) * 0.2, X, Y, 0.3, 1);
          return mt(M.wood, face(l.k, side) * 0.5 + g, X, Y, 0.4, 1);
        }
        if (ex < bev || ey < bev) {
          const top = ey < bev && ey <= ex, lft = ex < bev && ex < ey && k - 1.5 - fr < lw / 2;
          const litSide = top || (lft ? side < 0 : side > 0);
          return mt(M.wood, face(l.k, side, 0, top ? -0.8 : 0.6) * (litSide ? 0.82 : 0.36) + g, X, Y, 0.3, 1);
        }
        return mt(M.wood, face(l.k, side) * 0.42 + g * 1.4, X, Y, 0.45, 1);
      }
      const e = Math.min(k - 1.5, lw - 1.5 - k, ly + Ht - 7, dado - ly);
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
  kind: "bench" | "planter" | "jar" | "rail" | "brazier" | "stanchion" | "pine";
  /** Width (plane px) for the bench and the rail; the height of the top above the anchor (plane px). */
  w: number;
  top: number;
  seed: number;
  /** (round 3) The light on its rim: the room's lamps (warm, the default) or the gate's day (cool). */
  rim?: "warm" | "cool";
}

/** The near foot's dark: warm near-black, a rim of lamplight on top edges. */
const NEAR_DARK: Ramp = [P.timber[3]!, P.umber[1]!, P.umber[2]!, P.umber[3]!, P.umber[4]!, P.umber[5]!, P.ink[0]!];
/** The same with the gate's cool day on its rim (round 3). */
const NEAR_COOL: Ramp = [P.tile[1]!, P.tile[3]!, P.dusk[2]!, P.umber[3]!, P.umber[4]!, P.umber[5]!, P.ink[0]!];
/** The brazier's coals: a hot gold core down through orange to a deep red (round 3). */
const COALS: Ramp = [P.ember[1]!, P.ember[3]!, P.red[1]!, P.red[2]!, P.red[3]!, P.red[4]!, P.red[5]!];

export const nearFoot = definePainter<NearFootP>("hall.nearfoot", {
  bounds(p) {
    const half = p.kind === "bench" || p.kind === "rail" || p.kind === "stanchion" ? p.w / 2 + 12 : 1.1 * H;
    return [-half, -p.top - 0.9 * H, half, 0.9 * H];
  },
  paint(c, p) {
    const T = -p.top;
    // the body sinks below the frame: everything runs on down to 0.9 H under the anchor
    const B = 0.9 * H;
    // (round 3, W2-6: they read as faint outlines) the near plane holds the darkest darks: the bodies pushed down into
    // the near-black, the rim along their tops kept bright, in the gate's cool day where it faces the gate (p.rim)
    const RAMP = p.rim === "cool" ? NEAR_COOL : NEAR_DARK;
    const dark = (X: number, Y: number, t: number): number => tn(RAMP, clamp(t < 0.35 ? t : 0.35 + (t - 0.35) * 1.35, 0, 1), X, Y, 0.5);
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
    } else if (p.kind === "brazier") {
      // (round 3, W1-7) a bronze tripod brazier seen from behind: splayed legs out of the frame's foot, a deep bowl
      // with a rolled lip, embers glowing over its rim (the near plane's one warm light), a thread of smoke
      const R = 0.5 * H, lipY = T + 6, bowlB = T + 0.42 * H;
      // the legs: three splayed bars from under the bowl down out of the frame
      for (const [lx0, sp] of [[-0.6, -0.35], [0.0, 0.0], [0.6, 0.35]] as const) {
        const x0 = lx0 * R, x1 = x0 + sp * H;
        poly(c, [x0 - 4, bowlB - 6, x0 + 4, bowlB - 6, x1 + 5, B, x1 - 5, B], (X, Y, lx) => dark(X, Y, lx0 === 0 ? 0.86 : Math.abs(lx - x0) < 2 ? 0.55 : 0.75));
      }
      // the bowl: a wide hemisphere under the lip, a rim light on its upper edge (the embers light it from above)
      rect(c, -R - 4, lipY, R + 4, bowlB + 2, (X, Y, lx, ly) => {
        const v = (ly - lipY) / (bowlB - lipY);
        const half = (R + 4) * Math.sqrt(Math.max(0, 1 - v * v * 0.85));
        if (Math.abs(lx) > half) return 0;
        if (v < 0.1) return dark(X, Y, 0.0);
        const band = Math.abs(v - 0.35) < 0.05;
        return dark(X, Y, band ? 0.35 : 0.62 + v * 0.25 + Math.abs(lx) / R * 0.1);
      });
      // the embers heaped over the rim: hot cores, darker clinkers, a few sparks rising
      rect(c, -R + 4, T - 10, R - 4, lipY, (X, Y, lx, ly) => {
        const crown = lipY - (1 - (lx / (R - 4)) ** 2) * 10 + (vnoise(lx * 0.3, 1, p.seed) - 0.5) * 4;
        if (ly < crown) return 0;
        const n = fbm(lx * 0.25, ly * 0.4, p.seed + 3, 2);
        // glowing coals: deep orange-red, a few hot cores, dark clinkers; dimmer down into the bowl
        // (round 3, director: on the lantern ramp the near plane's ink turned them to beige gravel) the coals glow on
        // the red ramp, hot cores of lantern gold among them, so they still read as fire under the plane's ink
        if (n > 0.66) return tn(NEAR_DARK, 0.6, X, Y, 0);
        const hot = n < 0.36 && ly - crown < 5;
        return tn(COALS, clamp(hot ? 0.08 : 0.3 + (ly - crown) / 16 + (n - 0.5) * 0.3, 0, 1), X, Y, 0.4);
      });
      for (let i = 0; i < 6; i++) {
        const sx = (hash(i, 1, p.seed) - 0.5) * R * 1.2, sy = T - 16 - hash(i, 2, p.seed) * 0.5 * H;
        rect(c, sx, sy, sx + 1, sy + 1, (X, Y) => tn(COALS, i < 2 ? 0.0 : 0.3, X, Y, 0));
      }
    } else if (p.kind === "stanchion") {
      // (round 3, W1-7) a rope line at the frame's foot: two turned posts with brass knobs, a heavy red rope
      // slung between them, its tassel; the posts' feet run out of the frame
      const W = p.w / 2;
      for (const sx of [-W, W]) {
        lathe(c, sx, T, B, (ly) => {
          const v = ly - T;
          return v < 9 ? 5.5 - Math.abs(v - 4.5) * 0.4 : v < 14 ? 3.4 : 4 + (v > 40 ? 1.5 : 0);
        }, (X, Y, u, _lx, ly) => {
          const v = ly - T;
          if (v < 9) return u < -0.3 && v < 5 ? tn(M.gold, 0.35, X, Y, 0) : dark(X, Y, v < 2 ? 0.1 : 0.45);
          return dark(X, Y, u < -0.6 ? 0.4 : 0.8);
        });
      }
      const ry = T + 16, sag = 0.28 * H;
      rect(c, -W, ry - 6, W, ry + sag + 6, (X, Y, lx, ly) => {
        const t = (lx + W) / (2 * W);
        const cy = ry + sag * 4 * t * (1 - t);
        const d = ly - cy;
        if (Math.abs(d) > 4) return 0;
        const twist = (((lx * 0.8 + d * 1.6) % 8) + 8) % 8 < 4;
        return d < -2.5 ? tn(M.verm, 0.45, X, Y, 0) : dark(X, Y, twist ? 0.5 : 0.7);
      });
      rect(c, -2, ry + sag + 3, 2, ry + sag + 18, (X, Y, _lx, ly) => (ly < ry + sag + 6 ? tn(M.gold, 0.4, X, Y, 0) : dark(X, Y, 0.55)));
    } else if (p.kind === "pine") {
      // (round 3, W1-7) a potted pine seen from behind: a round glazed pot cut by the frame, a twisting trunk, three
      // cloud-shaped needle pads, their upper edges rimmed
      // (round 3, director: its pads floated as pale-topped bowls with no trunk reaching them, the same value as the
      // floor) a gnarled trunk climbs to the crown and carries each pad on its own branch; the pads are flat needle
      // clouds with tufted tops, darker than the floor, the room's light only on the tufts' tips
      const R = 0.5 * H, potT = T + 0.62 * H;
      lathe(c, 0, potT, B, (ly) => R * Math.min(1, 0.82 + Math.sqrt(Math.max(0, ly - potT) / (0.6 * H)) * 0.25), (X, Y, u, _lx, ly) => dark(X, Y, ly < potT + 2 ? 0.15 : 0.66 + Math.abs(u) * 0.15));
      const fl = hash(p.seed, 5, 1301) < 0.5 ? -1 : 1;
      const TOPH = 0.92 * H;
      const trunk = (t: number): [number, number] => [fl * Math.sin(t * 3.4 + 0.5) * 0.13 * H, potT - t * TOPH];
      const blob = (x: number, y: number, r: number, v: number, rimV: number): void => {
        rect(c, x - r - 1, y - r - 1, x + r + 1, y + r + 1, (X, Y, lx, ly) => {
          const d = Math.hypot(lx - x, ly - y);
          if (d > r) return 0;
          return dark(X, Y, lx - x < -r * 0.45 && d > r - 1.6 ? rimV : v);
        });
      };
      // the trunk: thick at the soil, thinning as it twists up, its lamp side (west) catching a thread of light
      for (let k = 0; k <= 60; k++) {
        const t = k / 60;
        const [x, y] = trunk(t);
        blob(x, y, 6 - t * 3.2, 0.86, 0.4);
      }
      const pads: [number, number, number][] = [[-0.36, 0.4, 0.4], [0.32, 0.64, 0.44], [-0.04, 0.92, 0.34]];
      for (const [px, py, pr] of pads) {
        const cx = fl * px * H, cy = potT - py * H, rw = pr * H;
        // its branch, sagging a little from the trunk out to the pad's heart
        const [bx, by] = trunk(Math.min(1, (py - 0.08) / (TOPH / H)));
        for (let k = 0; k <= 24; k++) {
          const t = k / 24;
          blob(bx + (cx - bx) * t, by + (cy + 3 - by) * t + Math.sin(t * Math.PI) * 4, 3.2 - t * 1.4, 0.86, 0.45);
        }
        // the pad: a low dome of needle tufts over a flatter, darker underside
        rect(c, cx - rw - 2, cy - rw * 0.5 - 8, cx + rw + 2, cy + rw * 0.2 + 2, (X, Y, lx, ly) => {
          const du = (lx - cx) / rw;
          if (Math.abs(du) > 1) return 0;
          const dome = Math.sqrt(1 - du * du);
          const tuft = Math.pow(0.5 + 0.5 * Math.cos((lx - cx) * 0.62 + vnoise(lx * 0.07, 5, p.seed) * 3.4 + p.seed), 3);
          const topY = cy - dome * rw * 0.34 - tuft * 5 * dome + (vnoise(lx * 0.4, 3, p.seed) - 0.5) * 3;
          const botY = cy + dome * rw * 0.13 + 2 - tuft * 2;
          if (ly < topY || ly > botY) return 0;
          const d = ly - topY;
          // the tufts' tips catch the room's light; needle strokes hang down from them; the underside in the dark
          if (d < 1.4 && tuft > 0.45) return dark(X, Y, 0.14);
          const stroke = d < 7 && (((lx * 2 + ly * 0.6) % 5) + 5) % 5 < 1.2 && tuft > 0.15;
          if (stroke) return dark(X, Y, 0.55);
          return dark(X, Y, 0.84 + (ly - cy) / Math.max(1, botY - cy) * 0.1);
        });
      }
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
  /** (round 3) Which banner poles stand: [west, east] (the gong tower is the west marker when it stands there). */
  poles?: [boolean, boolean];
}

export const ring = definePainter<RingP>("court.ring", {
  bounds(p) {
    return [-0.9 * H, -3.6 * H, p.w + 0.9 * H, 0.2 * H];
  },
  paint(c, p) {
    const W = p.w;
    const SUN = 1.0, SIDE = -0.8;
    // --- (hall loop round 2, W2-10: round 1's dais was a receding top) the ring's kerb, side-on: a low face
    // of warm red-brown stone in front of the podium between the ring's ends, its top lit, a gold inlay line
    // along it, slabs of different lengths, worn and chipped, a dark contact line where it meets the walk line
    void p.band;
    const dh = Math.round(0.26 * H);
    rect(c, -6, -dh, W + 6, 0, (X, Y, lx, ly) => {
      const v = (ly + dh) / dh; // 0 its top .. 1 the walk line
      if (v < 0.09) return mt(P.earth, face(SUN, SIDE, 0, -0.9) * 1.05, X, Y, 0.0, 1);
      if (v < 0.16) return mt(P.earth, 0.5, X, Y, 0.2, 1);
      if (v > 0.9) return mt(P.earth, 0.3, X, Y, 0.3, 1);
      const k = Math.floor((lx + 40) / (0.9 * H)), sw = 0.9 * H;
      const jx = ((lx + 40) % sw + sw) % sw + (hash(k, 1, 113) - 0.5) * 12;
      const joint = Math.abs(jx) < 1 || Math.abs(jx - sw) < 1;
      if (Math.abs(v - 0.45) < 0.05 && fbm(lx * 0.06, 2, 115, 2) < 0.68) return mt(M.gold, 0.8, X, Y, 0.1, 1);
      const n = fbm(lx * 0.05, ly * 0.2, 101, 3) - 0.5;
      const chip = fbm(lx * 0.3, ly * 0.3, 117, 2) > 0.78 ? -0.12 : 0;
      return mt(P.earth, 0.74 + n * 0.12 - (joint ? 0.25 : 0) + chip - v * 0.08, X, Y, 0.0, 1, 0.4);
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
      // (W2 round 1: its shadow is court.shadows' now, cast like every other thing on the court)
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
      if (p.poles && !p.poles[i]) continue;
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
    // --- (round 3, W1-2) the ring's front edge, nearer than the fighters: a red-lacquered timber curb along the
    // court's lip under their feet (its top lit, studs at intervals, a dark underside); the stone newels stand on it at
    // the ring's two front corners (dress.ts), lower than the back posts, so the ring reads as a box side-on
    const fy0 = 2, fy1 = Math.round(0.13 * H);
    rect(c, ax - 0.1 * H, fy0, bx + 0.1 * H, fy1, (X, Y, lx, ly) => {
      const v = (ly - fy0) / (fy1 - fy0);
      if (v < 0.16) return mt(M.verm, face(SUN, SIDE, 0, -0.9) * 1.05, X, Y, 0.0, 1);
      if (v > 0.84) return mt(M.lacqDay, 0.3, X, Y, 0.1, 1);
      const stud = Math.abs((((lx - ax) % (0.6 * H)) + 0.6 * H) % (0.6 * H) - 0.3 * H) < 2.2 && Math.abs(v - 0.5) < 0.22;
      if (stud) return mt(M.gold, face(SUN, SIDE, 0, (v - 0.5) * 2) * 1.0, X, Y, 0.05, 1);
      return mt(M.verm, 0.62 - v * 0.2 + (fbm(lx * 0.08, ly * 0.4, 119, 2) - 0.5) * 0.1, X, Y, 0.1, 1);
    });
  },
});

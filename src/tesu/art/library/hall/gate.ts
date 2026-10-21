// The Prize Court gate's finish (the hall loop, round 2, W2-2 / W2-3; Dex 10-19: "moon gate good, we just
// add details"). The gate keeps its place and size (services.ts hall.gate calls these in order):
//
// - the bay wall: lime-plaster panels between timber stiles and rails, a carved frieze under the
//   gallery (panels of different reliefs), a stone dado of ashlar blocks with a lit top edge, wear and
//   damp low down, the ring's moulding and the canopy each shadowing the plaster under them;
// - the view: the Prize Court in daylight in four value steps and more: the sky with cumulus from the
//   world's own cloud painter (lit tops, cool undersides, separate lobes), karst ranges from the
//   world's karst painter pushed back by the air, a mist line at their feet, the stands with a crowd
//   of varied silhouettes, banners, the court's thin paving line, and nearest the gong frame in dark
//   lacquer, sharpest of all, with the shade of the hall's own wall lying across the threshold;
// - the rim: a ring cut into the wall: stone voussoirs round a keystone, a bead-and-reel moulding, the
//   reveal (the wall's thickness, its soffit in shadow, its court-side arris catching the day), a lit
//   inner arris, a worn sill stone;
// - the head: a small tiled roof over the plaque on two bracket sets, two tiers of rafter ends, round
//   end tiles and drip tiles along the eave, barrel tiles up to a ridge with curled ends and a pearl;
// - the clerestories: deep lattice windows (frame, reveal, a step-fret lattice lit along its tops,
//   the cool day and a far roof beyond);
// - two hanging scrolls either side of the gate (plum and bamboo in ink), no fake script.
//
// Coordinates: level-1 local px of the play plane, the gate's centre on the floor (y up is negative).

import { ctxFor, painter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { IdxBuf, bayer4 } from "../../raster.ts";
import { M, LitField, clamp, face, fbm, grain, hash, mt, poly, rect, tn, vnoise, type Ramp } from "./kit.ts";
import { lut } from "./tint.ts";
import { iceDist, iceRay, sillRail } from "./bay.ts";

const H = 96;

/** The gate's geometry, shared by the painter and the bay's shade (hall-light.ts). */
export interface GateGeo {
  /** The bay wall's ends (local x) and height to the gallery's soffit. */
  l: number;
  r: number;
  top: number;
  /** The opening's radius and centre (local y, negative), the ring's width, the sill's height. */
  R: number;
  CY: number;
  RING: number;
  SILL: number;
}

export function gateGeo(p: { l: number; r: number; top: number; rad: number; cy: number }): GateGeo {
  return { l: p.l, r: p.r, top: p.top, R: p.rad, CY: -p.cy, RING: Math.round(0.16 * H), SILL: 7 };
}

const FRIEZE = Math.round(0.42 * H);
const DADO = Math.round(0.42 * H);

/** The plaque's box over the ring (services.ts paints it; the head sits on it). */
export function plaqueBox(g: GateGeo): { y0: number; y1: number; w: number } {
  const py1 = g.CY - g.R - g.RING - 5;
  return { y0: py1 - 0.4 * H, y1: py1, w: 0.8 * H };
}

/** The head's extent: the beam under the canopy, the eave's half width, the ridge's rise. */
export function headBox(g: GateGeo): { beam0: number; beam1: number; ew: number; rise: number; cw: number } {
  const pb = plaqueBox(g);
  const cw = g.R + g.RING + 0.62 * H;
  return { beam0: pb.y0 - 0.17 * H, beam1: pb.y0 - 3, ew: cw + 0.3 * H, rise: 0.46 * H, cw };
}

/** The clerestory windows high in the bay: [x0, y0 (top), x1, y1 (bottom)] local px. */
export function clerestoryBoxes(g: GateGeo): [number, number, number, number][] {
  const { cw } = headBox(g);
  const y0 = -g.top + FRIEZE + 0.3 * H, y1 = y0 + 1.15 * H;
  return [-1, 1].map((s) => {
    const x0 = s < 0 ? -cw + 0.05 * H : cw - 1.5 * H;
    return [x0, y0, x0 + 1.45 * H, y1] as [number, number, number, number];
  });
}

/** The hanging scrolls either side of the gate: [x0, y0, x1, y1] (the painting's mount, without the rods). */
export function scrollBoxes(g: GateGeo): [number, number, number, number][] {
  const x = g.R + g.RING + 0.55 * H, w = 0.38 * H;
  const y0 = g.CY - g.R + 0.2 * H, y1 = -1.15 * H;
  return [[-x - w / 2, y0, -x + w / 2, y1], [x - w / 2, y0, x + w / 2, y1]];
}

const pick = (r: Ramp, i: number): number => r[clamp(Math.round(i), 0, r.length - 1)]!;

// ===========================================================================
// The bay wall
// ===========================================================================
/** The stiles' x (local): wider panels by the ring, narrower out toward the posts, never through the ring. */
export function stiles(g: GateGeo): number[] {
  const out: number[] = [];
  const clear = g.R + g.RING + 0.06 * H;
  for (const s of [-1, 1]) {
    let x = clear + 0.05 * H, w = 1.05 * H, i = 0;
    while (x < (s < 0 ? -g.l : g.r) - 0.3 * H) {
      out.push(s * x);
      x += w;
      w = Math.max(0.78 * H, w * (0.86 + 0.1 * hash(i, s, 211)));
      i++;
    }
  }
  return out.sort((a, b) => a - b);
}

export function bayWall(c: PaintCtx, g: GateGeo): void {
  const { R, CY, RING } = g;
  const st = stiles(g);
  const SW = Math.round(0.085 * H);
  const RAIL_MID = -2.55 * H, RAIL_LOW = -DADO - 0.08 * H;
  const hb = headBox(g);
  const sc = scrollBoxes(g);
  const ringOut = R + RING;
  // frieze panels: lengths vary, each its own relief
  const panels: [number, number, number][] = [];
  for (let x = g.l, i = 0; x < g.r; i++) {
    const len = (0.9 + 0.8 * hash(i, 1, 223)) * H;
    panels.push([x, Math.min(g.r, x + len), Math.floor(hash(i, 2, 223) * 4)]);
    x += len;
  }
  // (round 3, W2-5) the clerestories' sill rail, and each window's water stain down the plaster under it
  const cls = clerestoryBoxes(g);
  const [SR0, SR1] = sillRail(cls[0]![3]);
  rect(c, g.l, -g.top, g.r, 0, (X, Y, lx, ly) => {
    const d = Math.hypot(lx, ly - CY);
    if (d < ringOut && ly < 0) return 0;
    // (one even light over the bay: the lamps' and lanterns' pools are laid by its shade, hall-light.ts,
    // shaped by the panels and stiles they land on; a LitField here drew round discs on the plaster)
    const k = 0.66 + clamp((ly + 1.2 * H) / (1.2 * H), 0, 1) * 0.06 - clamp((-ly - 3.2 * H) / (1.2 * H), 0, 1) * 0.08;
    const fromTop = ly + g.top;
    if (fromTop < FRIEZE) return frieze(X, Y, lx, fromTop / FRIEZE, k, panels);
    if (ly > -DADO) return dado(X, Y, lx, ly, k, g);
    // the canopy's shade on the plaster under it and the ring moulding's on its lower right
    let shade = 0;
    const under = ly - hb.beam1;
    if (under > 0 && Math.abs(lx) < hb.ew - 0.2 * H) shade += under < 0.12 * H ? 0.2 : under < 0.32 * H + vnoise(lx * 0.05, 3, 5) * 0.12 * H ? 0.1 : 0;
    const ang = Math.atan2(ly - CY, lx);
    if (d < ringOut + 3.5 && Math.cos(ang - 0.75) > 0.15) shade += 0.18;
    // the scrolls' shadows (down and right of each)
    for (const [x0, y0, x1, y1] of sc) {
      if (lx > x1 && lx < x1 + 3 && ly > y0 + 3 && ly < y1 + 6) shade += 0.15;
      if (ly > y1 + 6 && ly < y1 + 9 && lx > x0 + 3 && lx < x1 + 3) shade += 0.1;
    }
    // the timber frame: stiles, a top rail under the frieze, a mid rail, a low rail over the dado
    const sti = st.find((sx) => Math.abs(lx - sx) < SW / 2);
    // (round 3, W2-5) the sill rail under the clerestories: a carved timber rail, a lozenge boss every 26 px between
    // two bead lines, its top lit, its underside throwing a short shadow on the plaster
    if (ly >= SR0 && ly < SR1) {
      const v = (ly - SR0) / (SR1 - SR0);
      const q = ((((lx + 1300) % 26) + 26) % 26) - 13;
      const loz = Math.abs(q) / 6 + Math.abs(v - 0.5) / 0.32;
      let n = 0, ny = 0;
      if (v < 0.2) ny = -1;
      else if (v > 0.82) ny = 1;
      else if (loz < 1) { n = q < 0 === v < 0.5 ? 0.12 : -0.1; ny = v < 0.5 ? -0.6 : 0.6; }
      else if (Math.abs(v - 0.5) < 0.07) n = -0.12;
      return mt(M.wood, face(k, -0.6, 0, ny) * 0.72 + n - shade + grain(lx, ly, 291, false) * 0.08, X, Y, 0.45, 1, 0.3);
    }
    if (ly >= SR1 && ly < SR1 + 2.5) shade += 0.12;
    const rail = (fromTop < FRIEZE + 0.08 * H) || (Math.abs(ly - RAIL_MID) < 0.045 * H && d > ringOut + 0.1 * H) || (ly > RAIL_LOW && ly < -DADO);
    if (sti !== undefined || rail) {
      // a lit left / top edge, a dark right / bottom one: a member standing proud of the plaster
      let nx = 0, ny = 0;
      if (sti !== undefined) nx = lx - sti < -SW / 2 + 1.5 ? -1 : lx - sti > SW / 2 - 1.5 ? 1 : 0;
      if (rail) {
        const r0 = fromTop < FRIEZE + 0.08 * H ? -g.top + FRIEZE : Math.abs(ly - RAIL_MID) < 0.045 * H ? RAIL_MID - 0.045 * H : RAIL_LOW;
        const r1 = fromTop < FRIEZE + 0.08 * H ? -g.top + FRIEZE + 0.08 * H : Math.abs(ly - RAIL_MID) < 0.045 * H ? RAIL_MID + 0.045 * H : -DADO;
        ny = ly < r0 + 1.5 ? -1 : ly > r1 - 1.5 ? 1 : 0;
      }
      // (round 3, W2-5) edge wear: the lit arris chipped back to pale wood, the foot of each stile darkened by hands
      // and brooms
      const chip = sti !== undefined && nx !== 0 && fbm(lx * 0.25, ly * 0.07, 293, 2) > 0.66 ? (nx < 0 ? 0.16 : 0.08) : 0;
      const foot = sti !== undefined ? clamp((ly + 1.3 * H) / (0.9 * H), 0, 1) * 0.08 : 0;
      const v = face(k, -0.6, nx, ny) * 0.7 - shade + grain(lx, ly, 227, sti !== undefined) * 0.14 + chip - foot;
      return mt(M.wood, v, X, Y, 0.45, 1, 0.3);
    }
    // the plaster: lime over lath, mottled in broad soft patches, a hairline crack here and there,
    // darker and stained low down where the damp rises and hands and brooms have worn it
    const mot = fbm(lx * 0.011, ly * 0.014, 229, 2) - 0.5;
    const low = clamp((ly + 1.1 * H) / (0.6 * H), 0, 1);
    const stain = low * (0.06 + 0.08 * fbm(lx * 0.03, ly * 0.015, 233, 2));
    const crack = Math.abs(vnoise(lx * 0.035, ly * 0.009, 239) - 0.5) < 0.01 && fbm(lx * 0.02, ly * 0.02, 241, 2) > 0.66;
    // a recess line round each panel (the plaster set back from the frame)
    const near = st.some((sx) => Math.abs(lx - sx) < SW / 2 + 2) || Math.abs(ly - RAIL_MID) < 0.045 * H + 2 || (ly > RAIL_LOW - 2 && ly < RAIL_LOW);
    // (round 3, W2-5: the bay read as one flat navy field, sd 1.1, 4 colours) each panel between the stiles and
    // rails was skimmed on its own day, a step lighter or darker than its neighbours; the broad mottling a little
    // stronger; under each clerestory the rain has run down the plaster from the sill in streaks, dark, fading,
    // a pale tide line where each stopped
    const si = st.findIndex((sx) => sx > lx);
    const band = ly < SR1 ? 0 : ly < RAIL_MID ? 1 : 2;
    const ptone = (hash(si, band, 281) - 0.5) * 0.26;
    let damp = 0;
    for (const [x0, , x1, y1] of cls) {
      if (lx < x0 + 3 || lx > x1 - 3 || ly < SR1) continue;
      const len = (0.3 + 0.75 * vnoise(lx * 0.07, 1, 283) * vnoise(lx * 0.21, 2, 283)) * H;
      const t = (ly - SR1) / len;
      const streak = vnoise(lx * 0.16, 3, 287) > 0.42 || (lx - x0 < 10 || x1 - lx < 10);
      if (t < 1 && streak) damp = Math.max(damp, Math.pow(1 - t, 0.7) * (0.24 + 0.1 * vnoise(lx * 0.4, ly * 0.05, 289)));
      else if (t >= 1 && t < 1 + 2 / len && streak) damp = -0.06;
      void y1;
    }
    const v = face(k, -0.6) * 0.8 + 0.07 + mot * 0.16 + ptone - stain - damp - shade - (crack ? 0.1 : 0) - (near ? 0.07 : 0);
    return mt(PLASTER, v, X, Y, 0.0, 1, 0.2);
  });
}

/** Lime plaster in the hall's light: a warm grey going into the warm dark. */
const PLASTER: Ramp = [P.stone[3]!, P.stone[4]!, P.stone[5]!, P.umber[1]!, P.umber[2]!, P.umber[3]!, P.umber[4]!];

function frieze(X: number, Y: number, lx: number, v: number, k: number, panels: [number, number, number][]): number {
  // a lacquered beam: gold bead top and bottom, carved panels of different lengths between short
  // plain blocks, each carved its own way (cloud scrolls, a lotus run, waves, a plain cartouche)
  if (v > 0.9) return mt(M.gold, face(k, 0, 0, 0.8) * 0.6, X, Y, 0.3, 1, 0.2);
  if (v < 0.08) return mt(M.lacq, face(k, 0, 0, -0.8) * 0.35, X, Y, 0.4, 1, 0.2);
  const pn = panels.find(([a, b]) => lx >= a && lx < b);
  if (!pn) return mt(M.lacq, face(k, 0) * 0.5, X, Y, 0.15, 1, 0.2);
  const [a, b, kind] = pn;
  const u = lx - a, e = Math.min(u, b - lx);
  if (e < 5) return mt(M.lacq, face(k, 0, e < 1.5 ? (u < 3 ? -1 : 1) : 0, 0) * 0.62, X, Y, 0.15, 1, 0.2);
  if (e < 6.5 || v < 0.16 || v > 0.82) return mt(M.lacq, face(k, 0) * 0.3, X, Y, 0.3, 1, 0.2);
  const w = (v - 0.16) / 0.66;
  let raised = false, edge = 0;
  if (kind === 0 || kind === 2) {
    // scrolling clouds: long interlocking curls, mirrored on the second kind
    const xx = kind === 0 ? u : (b - a) - u;
    const s1 = Math.sin(xx * 0.085 + Math.sin(w * 4.2 + xx * 0.02) * 1.9) * Math.cos(w * 5.2 - 0.6);
    raised = s1 > 0.28; edge = s1 > 0.28 && s1 < 0.4 ? 1 : 0;
  } else if (kind === 1) {
    // a round boss in the middle, a tendril running out to each end
    const mid = (b - a) / 2, du = u - mid;
    const br = Math.hypot(du, (w - 0.5) * 18);
    if (br < 9) { raised = br < 7.5; edge = br > 6.2 && br < 7.5 ? 1 : 0; }
    else {
      const tv = 0.5 + 0.3 * Math.sin(du * 0.12) * Math.exp(-Math.abs(du) * 0.01);
      raised = Math.abs(w - tv) < 0.1 && Math.abs(du) < mid - 9; edge = raised && w < tv - 0.04 ? 1 : 0;
    }
  } else {
    // a plain sunk panel with a gold border, the paint flaking
    const ee = Math.min(e - 6.5, (0.5 - Math.abs(w - 0.5)) * 18);
    raised = ee > 2.5; edge = ee > 2.5 && ee < 3.6 ? 1 : 0;
    if (raised && fbm(lx * 0.08, w * 3, 251, 2) > 0.66) return mt(M.wood, face(k, 0) * 0.45, X, Y, 0.3, 1, 0.2);
  }
  if (edge) return mt(M.gold, face(k, 0, 0, -0.6) * 0.75, X, Y, 0.2, 1, 0.2);
  if (raised) return mt(M.lacq, face(k, 0, 0, -0.3) * 0.72, X, Y, 0.1, 1, 0.2);
  return mt(M.lacq, face(k, 0) * 0.32, X, Y, 0.3, 1, 0.2);
}

function dado(X: number, Y: number, lx: number, ly: number, k: number, g: GateGeo): number {
  // ashlar: a cap moulding lit along its top, then blocks of different lengths, each its own tone,
  // a chamfer lit on each block's top, dark joints, the foot worn and dusty
  const cap = ly < -DADO + 5;
  if (cap) {
    const lit = ly < -DADO + 1.5;
    return mt(M.stone, face(k, -0.5, 0, lit ? -1 : ly > -DADO + 3.5 ? 0.9 : 0) * (lit ? 1.18 : 0.82), X, Y, 0.15, 1, 0);
  }
  // blocks in a course; their lengths vary with a seeded walk along the wall
  const x = lx + 997;
  const unit = 0.45 * H;
  const cell = Math.floor(x / unit);
  // join pairs of cells to make some blocks long
  const longL = hash(cell - 1, 0, 263) < 0.4, longH = hash(cell, 0, 263) < 0.4;
  const start = longL ? (cell - 1) * unit : cell * unit;
  const end = longH ? (cell + 2) * unit : (cell + 1) * unit;
  const u = x - start, e = Math.min(u, end - x);
  const yy = ly + DADO - 5;
  const hgt = DADO - 5;
  const joint = e < 1 || yy > hgt - 1;
  if (joint) return mt(M.stone, face(k, 0) * 0.42, X, Y, 0.35, 1, 0);
  const id = Math.floor(start / unit);
  const tone = (hash(id, 1, 269) - 0.5) * 0.14;
  const ch = yy < 2 ? -1 : 0;
  const worn = fbm(lx * 0.06, ly * 0.1, 271, 2) > 0.74 ? -0.05 : 0;
  const dust = yy > hgt - 5 ? -0.07 : 0;
  // the gate's ring stands on the dado: where it does, the stone runs on
  void g;
  return mt(M.stone, face(k, -0.5, e < 2.5 ? (u < e + 0.1 ? -0.7 : 0.7) : 0, ch) * 0.86 + tone + worn + dust, X, Y, 0.15, 1, 0);
}

// ===========================================================================
// The view through the gate
// ===========================================================================
/** Paints another library's painter clipped to a region (the world's clouds and karsts inside the ring). */
function clipPaint(c: PaintCtx, kind: string, ax: number, ay: number, p: Record<string, unknown>, seed: number, box: [number, number, number, number], keep: (lx: number, ly: number) => boolean, remap?: Uint8Array | ((ly: number) => Uint8Array | null)): void {
  const tmp = new IdxBuf(c.buf.w, c.buf.h, c.buf.ox, c.buf.oy, c.buf.d);
  const cc = ctxFor(tmp, c.d, c.ax / c.d + ax, c.ay / c.d + ay, seed);
  painter(kind).paint(cc, p);
  const X0 = Math.max(tmp.ox, Math.floor(c.X(box[0]))), X1 = Math.min(tmp.x1, Math.ceil(c.X(box[2])));
  const Y0 = Math.max(tmp.oy, Math.floor(c.Y(box[1]))), Y1 = Math.min(tmp.y1, Math.ceil(c.Y(box[3])));
  for (let Y = Y0; Y < Y1; Y++) {
    const ly = c.ly(Y + 0.5);
    const rm = typeof remap === "function" ? remap(ly) : remap;
    for (let X = X0; X < X1; X++) {
      const v = tmp.px[(Y - tmp.oy) * tmp.w + (X - tmp.ox)]!;
      if (!v || !keep(c.lx(X + 0.5), ly)) continue;
      c.buf.set(X, Y, rm ? rm[v]! : v);
    }
  }
}

/** The sky's bands (light at the horizon), narrow dithered seams between them. (round 3, W2-9: it was near white,
 *  S 0.15; now a deep blue at the top, so the view holds four value steps: the deep sky, the pale horizon and
 *  mist, the court's mid stone, the dark kerb at the sill) */
const SKY: Ramp = [P.blue[1]!, P.fallsky[3]!, P.blue[0]!, P.fallsky[1]!, P.cloud[3]!, P.cloud[1]!];
/** The crowd in the stands (round 3, W2-9: a wedge of identical dark pegs): people in festival robes, each its own
 *  colour and build, [lit, body] pairs; the far tiers take the air's haze over theirs. */
const ROBES: [number, number][] = [
  [P.red[2]!, P.red[3]!], [P.red[3]!, P.red[4]!], [P.gold[2]!, P.gold[3]!], [P.blue[1]!, P.blue[2]!], [P.blue[2]!, P.blue[3]!],
  [P.jade[3]!, P.jade[4]!], [P.paper[2]!, P.paper[3]!], [P.tile[2]!, P.tile[3]!], [P.timber[2]!, P.timber[3]!], [P.mauve[0]!, P.mauve[1]!],
  [P.lacquer[0]!, P.lacquer[1]!], [P.tile[1]!, P.tile[2]!], [P.umber[0]!, P.umber[1]!], [P.paper[1]!, P.paper[2]!],
];
const HAIR: number[] = [P.ink[0]!, P.ink[1]!, P.umber[3]!, P.lacquer[3]!, P.timber[4]!, P.ink[1]!];
const ACCENT: Ramp = [P.red[3]!, P.gold[3]!, P.blue[2]!, P.red[2]!, P.jade[4]!, P.paper[2]!];

export function gateView(c: PaintCtx, g: GateGeo): void {
  const { R, CY, SILL } = g;
  const G = -SILL; // the court's floor line, level with the sill
  const top = CY - R;
  const HZ = CY + 0.3 * R; // the mist line at the karsts' feet
  const inView = (lx: number, ly: number): boolean => ly < G + 0.5 && Math.hypot(lx, ly - CY) < R - 0.5;
  const box: [number, number, number, number] = [-R, top, R, G + 1];

  // --- 1. the sky: banded, a warm low glow on the sun's side (the sun is up to the left, out of view)
  rect(c, -R, top, R, G, (X, Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const t = (ly - top) / (HZ - top);
    let b = 0;
    for (const s of [0.24, 0.46, 0.64, 0.8, 0.93]) if (t + (bayer4(X, Y) - 0.5) * 0.03 > s) b++;
    if (b >= 4 && lx < -0.15 * R + (t - 0.93) * 2 * R) return b === 5 ? P.ember[0]! : P.paper[1]!;
    return SKY[b]!;
  });

  // --- 2. the clouds: the world's own cumulus (lit tops, cool undersides, lobes), a stratus low down
  clipPaint(c, "op.cloud", -0.36 * R, CY - 0.12 * R, { kind: "cumulus", w: Math.round(1.05 * R), h: Math.round(0.5 * R), tower: 0.7, frame: 1 }, 4101, box, inView);
  clipPaint(c, "op.cloud", 0.62 * R, CY + 0.02 * R, { kind: "cumulus", w: Math.round(0.6 * R), h: Math.round(0.26 * R), tower: 0.4, haze: 0.25, frame: 2 }, 4103, box, inView);
  clipPaint(c, "op.cloud", -0.1 * R, HZ - 0.12 * R, { kind: "stratus", w: Math.round(1.5 * R), h: Math.round(0.07 * R), haze: 0.5 }, 4107, box, inView);

  // --- 3. the karsts: a far range as blue-grey silhouettes, a nearer one with its green, both
  // pushed back by the air (whole haze steps, tint.ts) and standing in a mist at their feet
  const haze2 = lut("haze", 2), haze1 = lut("haze", 1);
  clipPaint(c, "sky.karst", -R, HZ - 0.02 * R, { w: Math.round(2 * R), h: Math.round(0.7 * R), rows: 2, look: "far", mist: Math.round(0.08 * R), every: Math.round(0.34 * R), flat: 0.35 }, 4111, box, inView, haze2);
  clipPaint(c, "sky.karst", -R * 0.95, HZ + 0.16 * R, { w: Math.round(1.9 * R), h: Math.round(0.46 * R), rows: 1, look: "mid", mist: Math.round(0.06 * R), every: Math.round(0.4 * R), flat: 0.5, green: 0.6, falls: 0 }, 4113, box, inView, haze1);
  // the mist the court stands out of: a soft-topped band of white over the ranges' feet
  rect(c, -R, HZ, R, G, (X, Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const t = ly - HZ - 0.24 * R;
    const roll = (vnoise(lx * 0.05, 1, 4117) - 0.5) * 6 + (vnoise(lx * 0.013, 2, 4117) - 0.5) * 8;
    if (t < roll - 3) return 0;
    if (t < roll) return bayer4(X, Y) < 0.5 ? P.cloud[2]! : 0;
    return t < roll + 4 ? P.cloud[1]! : P.cloud[2]!;
  });

  // --- 4. the court: stands stepping up to the left, a crowd on them, banners on poles, the paving
  const TIER = 12, NT = 6;
  const tierTop = (i: number): number => G - 8 - i * TIER;
  const tierEnd = (i: number): number => 0.26 * R - i * 0.12 * R;
  // risers: stone in the sun, the shadow of each step's nose under it, hazier the further back
  rect(c, -R, tierTop(NT), 0.3 * R + 2, G - 8, (_X, _Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const i = Math.floor((G - 8 - ly) / TIER); // the riser of tier i (between tierTop(i) and tierTop(i - 1))
    if (i < 0 || i >= NT || lx > tierEnd(i)) return 0;
    const f = (G - 8 - ly) - i * TIER; // 0 at its foot .. TIER at its top
    const S: Ramp = i >= 3 ? [P.range[1]!, P.range[3]!, P.range[4]!] : [P.stone[1]!, P.stone[3]!, P.stone[5]!];
    if (f > TIER - 1.2) return S[0]!; // the nose, lit
    if (f > TIER - 3) return S[2]!; // its shadow
    return S[1]!;
  });
  // the stands' ends: a stepped stone flank in shade (the sun is on the other side)
  rect(c, -R, tierTop(NT), 0.3 * R + 3, G - 8, (_X, _Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const i = Math.floor((G - 8 - ly) / TIER);
    if (i < 0 || i >= NT) return 0;
    const e = tierEnd(i);
    return lx > e && lx < e + 2.5 ? (i >= 3 ? P.range[3]! : P.stone[4]!) : 0;
  });
  // the crowd: knots of people with gaps, sitting and standing, arms up, a flag, a parasol, a child on
  // shoulders, a vendor's tray; lit along their left side; the back tiers paler in the air
  for (let i = 0; i < NT; i++) crowdRow(c, g, -R, tierEnd(i) - 2, tierTop(i), i, inView);
  // banners on tall poles among the stands, and a string of pennants to the gong frame
  for (const [bx, bh, col, ph] of [[-0.72 * R, 0.78 * R, 0, 0.4], [-0.38 * R, 0.92 * R, 1, 1.9], [0.06 * R, 0.7 * R, 0, 2.8]] as const) {
    const foot = tierTop(Math.max(0, Math.min(NT - 1, Math.floor((tierEnd(0) - bx) / (0.13 * R))))) ;
    const ptop = foot - bh;
    rect(c, bx - 0.5, ptop, bx + 1, foot, (_X, _Y, lx, ly) => (inView(lx, ly) ? (lx < bx + 0.25 ? P.timber[3]! : P.timber[5]!) : 0));
    const bw = 8, bl = bh * 0.5;
    rect(c, bx + 1, ptop + 2, bx + 1 + bw + 3, ptop + 2 + bl, (_X, _Y, lx, ly) => {
      if (!inView(lx, ly)) return 0;
      const v = (ly - ptop - 2) / bl;
      const wave = Math.sin(v * 5.5 + ph) * 1.5 * v;
      const u = lx - bx - 1 - wave;
      if (u < 0 || u > bw - v * 1.5) return 0;
      if (v > 0.94 && Math.abs(u - bw / 2) > 2) return 0;
      const fold = Math.sin(v * 5.5 + ph + 1.2) > 0.45;
      if (u > bw - v * 1.5 - 1.2) return P.gold[3]!;
      return col === 0 ? (fold ? P.red[4]! : P.red[3]!) : fold ? P.gold[4]! : P.gold[3]!;
    });
  }
  // the paving: a thin lit strip at the stands' foot (side-on: its edge, never a receding top), and
  // right outside the gate the shade of the hall's own wall lying across the threshold
  rect(c, -R, G - 8, R, G + 1, (X, Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const f = ly - (G - 8);
    if (f < 1) return P.stone[0]!;
    if (f < 3.5) return ((((lx + 600) % 17) + 17) % 17) < 1 ? P.stone[3]! : P.stone[1]!;
    if (f < 4.5) return bayer4(X, Y) < 0.5 ? P.stone[3]! : P.tile[2]!;
    return f > 7 ? P.tile[4]! : P.tile[3]!;
  });
  // a few people on the court: nearer, darker, taller than the crowd
  for (const [px, ph, kind] of [[-0.55 * R, 13, 0], [-0.47 * R, 11, 1], [0.2 * R, 12, 2]] as const) figure(c, px, G - 8, ph, kind, P.lacquer[2]!, P.lacquer[3]!, inView);

  // --- 5. nearest: the gong frame in dark lacquer, sharp, a gold band and cap on each post, the gong
  // lit on its sunward rim; their shadows thrown to the right across the paving
  const pxs = [0.4 * R, 0.82 * R];
  const beamY = CY - 0.12 * R, beam2 = CY + 0.1 * R;
  for (const px of pxs) {
    rect(c, px + 3, G - 8, px + 11, G - 4.5, (_X, _Y, lx, ly) => (inView(lx, ly) ? P.stone[3]! : 0));
    rect(c, px - 3, top, px + 3, G - 6, (_X, _Y, lx, ly) => {
      if (!inView(lx, ly)) return 0;
      const u = lx - px;
      const band = Math.abs(ly - (G - 0.62 * R)) < 1.5 || Math.abs(ly - beam2) < 1;
      if (band) return u < -1.5 ? P.gold[2]! : P.gold[4]!;
      return u < -1.8 ? P.lacquer[1]! : u > 1.5 ? P.lacquer[4]! : P.lacquer[3]!;
    });
    // the stone base
    rect(c, px - 5.5, G - 10, px + 5.5, G - 4, (_X, _Y, lx, ly) => (inView(lx, ly) ? (ly < G - 9 ? P.stone[2]! : lx < px - 2 ? P.stone[3]! : P.stone[5]!) : 0));
  }
  // the beams: a top one with upturned ends, a lower tie the gong hangs from
  rect(c, pxs[0]! - 14, beamY - 4, pxs[1]! + 14, beamY + 3, (_X, _Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const e = Math.min(lx - (pxs[0]! - 14), pxs[1]! + 14 - lx);
    if (e < 6 && ly > beamY - 4 + (6 - e) * 0.9) return 0;
    return ly < beamY - 2.5 ? P.lacquer[1]! : ly > beamY + 1.5 ? P.lacquer[4]! : P.lacquer[3]!;
  });
  rect(c, pxs[0]! - 3, beam2 - 1.5, pxs[1]! + 3, beam2 + 1.5, (_X, _Y, lx, ly) => (inView(lx, ly) ? (ly < beam2 - 0.5 ? P.lacquer[2]! : P.lacquer[3]!) : 0));
  const gx = (pxs[0]! + pxs[1]!) / 2, gcy = CY + 0.4 * R, gr = 0.14 * R;
  for (const s of [-1, 1]) rect(c, gx + s * gr * 0.5, beam2 + 1, gx + s * gr * 0.5 + 1, gcy - gr * 0.85, (_X, _Y, lx, ly) => (inView(lx, ly) ? P.lacquer[3]! : 0));
  rect(c, gx - gr - 1, gcy - gr - 1, gx + gr + 1, gcy + gr + 1, (_X, _Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const dx = lx - gx, dy = ly - gcy, d = Math.hypot(dx, dy) / gr;
    if (d > 1) return 0;
    const lit = -(dx * 0.62 + dy * 0.78) / gr; // toward the sun, up and left
    if (d > 0.84) return lit > 0.35 ? P.bronze[0]! : lit > -0.2 ? P.bronze[2]! : P.bronze[4]!;
    if (d > 0.74) return P.bronze[4]!; // the groove inside the rim
    if (d < 0.2) return lit > 0 ? P.bronze[1]! : P.bronze[3]!; // the boss
    if (d < 0.27) return P.bronze[4]!;
    return lit > 0.3 ? P.bronze[1]! : lit > -0.25 ? P.bronze[2]! : P.bronze[3]!;
  });
  // --- 6. (round 3, W2-9) nearest of all: the court's kerb right outside the gate, in the hall's own shade: the
  // darkest, sharpest plane in the view, hiding the near feet beyond it; its top arris catching the day, its
  // blocks' joints darker still
  rect(c, -R, G - 11, R, G + 1, (X, Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const f = ly - (G - 11);
    const joint = ((((lx + 611) % 23) + 23) % 23) < 1;
    if (f < 1) return joint ? P.stone[3]! : P.stone[1]!;
    if (f < 2) return joint ? P.lacquer[3]! : P.stone[4]!;
    if (joint) return P.lacquer[4]!;
    const chip = fbm(lx * 0.3, ly * 0.5, 4319, 2) > 0.72;
    return chip ? P.lacquer[1]! : f < 3 ? P.lacquer[2]! : bayer4(X, Y) < 0.25 ? P.lacquer[2]! : P.lacquer[3]!;
  });
}

/** One row of the crowd on a tier: knots of 1-5 people, gaps between, each with its own shape. */
function crowdRow(c: PaintCtx, g: GateGeo, x0: number, x1: number, foot: number, tier: number, inView: (lx: number, ly: number) => boolean): void {
  const far = tier >= 3;
  const haze = far ? lut("haze", tier >= 5 ? 2 : 1) : null;
  let x = x0 + hash(tier, 1, 4201) * 4;
  let n = 0;
  while (x < x1 - 2) {
    const knot = 1 + Math.floor(hash(tier, n, 4203) * 5);
    for (let j = 0; j < knot && x < x1 - 2; j++, n++) {
      const r = hash(n, tier, 4207);
      const hgt = (far ? 8 : 9) + (hash(n, tier, 4209) < 0.3 ? -1 : hash(n, tier, 4209) > 0.8 ? 1 : 0);
      const robe = ROBES[Math.floor(hash(n, tier, 4211) * ROBES.length)]!;
      const kind = r < 0.1 ? 3 : r < 0.17 ? 4 : r < 0.24 ? 5 : r < 0.3 ? 6 : r < 0.42 ? 1 : r < 0.5 ? 7 : 0;
      const wide = hash(n, tier, 4223) < 0.3 ? 1 : 0;
      person(c, x + 1.5, foot, hgt, kind, robe, HAIR[Math.floor(hash(n, tier, 4227) * HAIR.length)]!, ACCENT[Math.floor(hash(n, tier, 4213) * ACCENT.length)]!, wide, haze, inView);
      x += 4 + wide + (hash(n, tier, 4215) < 0.3 ? 1 : 0) - (hash(n, tier, 4219) < 0.25 ? 1 : 0);
    }
    // a gap between knots
    x += hash(tier, n, 4217) < 0.55 ? 1 : 3 + Math.floor(hash(tier, n, 4221) * 6);
  }
  void g;
}

/**
 * A spectator a few px tall, its feet at `foot`: 0 standing, 1 sitting (shorter), 3 an arm up, 4 a flag,
 * 5 a parasol, 6 a child on the shoulders, 7 a straw hat. Hair over a face lit on the sun's side (left), a robe
 * of its own colour lit down its left edge, dark legs.
 */
function person(c: PaintCtx, x: number, foot: number, h: number, kind: number, robe: [number, number], hair: number, acc: number, wide: number, haze: Uint8Array | null, inView: (lx: number, ly: number) => boolean): void {
  const hh = kind === 1 ? h - 2 : h;
  const set = (lx: number, ly: number, v: number): void => {
    if (!inView(lx + 0.5, ly + 0.5)) return;
    const X = Math.round(c.X(lx)), Y = Math.round(c.Y(ly));
    c.buf.set(X, Y, haze ? haze[v]! : v);
  };
  const [lit, body] = robe;
  const skin = P.skin[2]!, skinLit = P.skin[1]!;
  const bx = Math.round(x) - 1, top = Math.round(foot - hh);
  // the head: hair on top, the face under it (the sun on its left)
  set(bx, top, hair); set(bx + 1, top, hair);
  set(bx, top + 1, skinLit); set(bx + 1, top + 1, kind === 1 ? skin : hair);
  if (kind === 7) for (let i = -1; i <= 2; i++) set(bx + i, top, i < 0 ? P.timber[1]! : P.timber[2]!);
  // the shoulders and the robe, a px wider for some
  const w0 = -1, w1 = 2 + wide;
  for (let y = top + 2; y < foot - 2; y++) for (let i = w0; i <= w1; i++) {
    if (y === top + 2 && (i === w0 || i === w1) && wide === 0) continue;
    set(bx + i, y, i === w0 ? lit : body);
  }
  // the legs (a robe's hem for the sitting)
  for (let y = Math.max(top + 3, foot - 2); y < foot; y++) {
    if (kind === 1) { for (let i = w0; i <= w1; i++) set(bx + i, y, body); continue; }
    set(bx, y, P.lacquer[2]!); set(bx + 1 + wide, y, P.lacquer[3]!);
  }
  if (kind === 3) { set(bx - 1, top + 1, lit); set(bx - 1, top, lit); set(bx - 2, top - 1, skinLit); }
  if (kind === 4) {
    for (let y = top - 4; y < top + 2; y++) set(bx + 3 + wide, y, P.timber[4]!);
    set(bx + 4 + wide, top - 4, acc); set(bx + 5 + wide, top - 4, acc); set(bx + 4 + wide, top - 3, acc); set(bx + 5 + wide, top - 3, acc); set(bx + 6 + wide, top - 4, acc);
  }
  if (kind === 5) {
    for (let y = top - 2; y < top + 2; y++) set(bx + 3, y, P.timber[4]!);
    for (let i = -1; i <= 5; i++) set(bx + i, top - 3, acc);
    for (let i = 0; i <= 4; i++) set(bx + i, top - 4, i === 0 ? P.paper[1]! : acc);
  }
  if (kind === 6 && !haze) { set(bx, top - 1, ROBES[0]![1]); set(bx + 1, top - 1, ROBES[0]![1]); set(bx, top - 2, skinLit); set(bx + 1, top - 2, hair); set(bx, top - 3, hair); }
}

/** A person on the court: a taller silhouette, 0 walking, 1 carrying a tray on the shoulder, 2 a stick. */
function figure(c: PaintCtx, x: number, foot: number, h: number, kind: number, col: number, dark: number, inView: (lx: number, ly: number) => boolean): void {
  rect(c, x - 3, foot - h - 4, x + 5, foot, (_X, _Y, lx, ly) => {
    if (!inView(lx, ly)) return 0;
    const v = (foot - ly) / h; // 0 feet .. 1 top
    const u = lx - x;
    if (v > 1.0) return kind === 1 && u > -2 && u < 4 && v < 1.18 ? P.timber[3]! : 0;
    if (v > 0.8) return Math.abs(u - 0.5) < 1.2 ? (u < 0 ? P.tile[2]! : col) : 0;
    if (v < 0.35) return (Math.abs(u + 0.8) < 0.7 || Math.abs(u - 1.8) < 0.7) ? dark : 0;
    const half = 1.7 + (v < 0.55 ? 0.6 : 0);
    if (Math.abs(u - 0.5) < half) return u < -0.6 ? P.tile[2]! : col;
    if (kind === 2 && u > 2.5 && u < 3.5 && v < 0.75) return P.timber[4]!;
    return 0;
  });
}

// ===========================================================================
// The rim: reveal, voussoirs, moulding, keystone, sill
// ===========================================================================
/** The reveal's stone in shadow (cool) to where the day reaches it (light). */
const REVEAL: Ramp = [P.stone[0]!, P.stone[1]!, P.stone[2]!, P.stone[3]!, P.tile[1]!, P.tile[2]!, P.tile[3]!];

export function gateRim(c: PaintCtx, g: GateGeo, lfg: LitField): void {
  const { R, CY, RING, SILL } = g;
  // --- the reveal: the court-side face of the opening is smaller and lower (we look up into the opening
  // from her eye height), so the wall's thickness shows as a crescent, deepest at the top: the soffit in
  // shadow, lighter toward the court where the day reaches in, its court-side arris a bright line
  const TH = 6, DROP = 7;
  const far = (lx: number, ly: number): number => Math.hypot(lx, ly - CY - DROP) - (R - TH);
  rect(c, -R, CY - R, R, -SILL, (X, Y, lx, ly) => {
    const d = Math.hypot(lx, ly - CY);
    if (d >= R || ly > -SILL) return 0;
    const f = far(lx, ly);
    if (f < 0) return 0;
    if (f < 1) return P.paper[1]!; // the court-side arris in the day
    const a = Math.atan2(ly - CY, lx);
    const up = -Math.sin(a); // 1 at the top .. -1 at the bottom
    const span = Math.max(1, R - d + f); // the reveal's width here
    const t = f / span; // 0 at the court side .. 1 at our side
    let v = 1.4 + up * 2.4 + t * 1.4; // the soffit darkest, deeper toward us
    if (up < -0.2) v = 1 + t; // the lower curve faces the sky: light
    return REVEAL[clamp(Math.round(v + (bayer4(X, Y) - 0.5) * 0.5), 0, REVEAL.length - 1)]!;
  });

  // --- the voussoirs, the moulding round them and the inner arris
  const N = 28;
  const step = (Math.PI * 2) / N;
  const VOUS = 0.64;
  rect(c, -R - RING - 1, CY - R - RING - 1, R + RING + 1, 0, (X, Y, lx, ly) => {
    const d = Math.hypot(lx, ly - CY);
    if (d < R || d > R + RING || ly > -SILL + 1) return 0;
    const l = lfg.get(lx, ly);
    const t = (d - R) / RING;
    const a = Math.atan2(ly - CY, lx) + Math.PI / 2; // 0 at the top
    const aa = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (t < VOUS) {
      // the stones: the keystone at the top (a little wider), each block its own tone and wear
      const s = Math.floor((aa + step / 2) / step);
      const into = aa + step / 2 - s * step; // 0..step across the stone
      const jointD = Math.min(into, step - into) * d;
      if (d - R < 1.2) {
        // the inner arris: lit by the day spilling round the opening, brighter low down
        const low = clamp(Math.cos(aa - Math.PI) * 0.5 + 0.5, 0, 1);
        return jointD < 1 ? P.stone[2]! : low > 0.35 ? P.stone[0]! : P.stone[1]!;
      }
      if (jointD < 0.9) return mt(M.stone, face(l.k, -0.5) * 0.45, X, Y, 0.3, 1, 0);
      const tone = (hash(s, 1, 4301) - 0.5) * 0.16;
      const chip = fbm(lx * 0.3, ly * 0.3, 4303 + s, 2) > 0.72 ? -0.12 : 0;
      // each stone's face dished a little: lit toward the upper left at its edges, darker at the far ones
      const nx = jointD < 2.5 ? (into < step / 2 ? -1 : 1) * Math.cos(aa) : 0;
      const ny = jointD < 2.5 ? (into < step / 2 ? 1 : -1) * Math.sin(aa) : (t > VOUS - 0.12 ? 0.6 : 0);
      return mt(M.stone, face(l.k, -0.5, nx * 0.7, ny * 0.7) * 0.92 + tone + chip, X, Y, 0.1, 1, 0.3);
    }
    // the moulding: a dark groove, then a bead-and-reel round the ring
    if (t < VOUS + 0.09) return mt(M.stone, face(l.k, 0) * 0.35, X, Y, 0.4, 1, 0);
    const arc = aa * d;
    const bead = ((arc % 7) + 7) % 7 < 5;
    const tt = (t - VOUS - 0.09) / (1 - VOUS - 0.09);
    const nr = (tt - 0.5) * 1.6; // across the bead: -0.8 inner .. 0.8 outer
    const nx = Math.sin(aa) * nr, ny = -Math.cos(aa) * nr;
    if (t > 0.94) return mt(M.stone, face(l.k, 0) * 0.4, X, Y, 0.4, 1, 0);
    return mt(M.stone, face(l.k, -0.5, nx, ny) * (bead ? 1.0 : 0.62), X, Y, 0.05, 1, 0.3);
  });
  // the keystone: proud of the ring at its top, carrying the plaque, a cloud boss carved in its face
  const kt = CY - R - RING - 4, kb = CY - R + 2;
  poly(c, [-9, kt, 9, kt, 7, kb, -7, kb], (X, Y, lx, ly) => {
    const l = lfg.get(lx, ly);
    const e = Math.min(lx + 9 - (ly - kt) * 0.1, 9 - (ly - kt) * 0.1 - lx, ly - kt);
    if (e < 1.2) return mt(M.stone, face(l.k, -0.5, lx < -6 ? -1 : lx > 6 ? 1 : 0, ly < kt + 1.2 ? -1 : 0) * (lx > 6 ? 0.55 : 1.05), X, Y, 0.05, 1, 0);
    const boss = Math.hypot(lx, ly - (kt + kb) / 2) < 4;
    if (boss) return mt(M.stone, face(l.k, -0.5, lx / 4, (ly - (kt + kb) / 2) / 4) * 1.0, X, Y, 0.05, 1, 0);
    return mt(M.stone, face(l.k, -0.5) * 0.9, X, Y, 0.1, 1, 0.2);
  });
  // --- the sill: a stone step across the opening, its top lit by the day, its face worn, its ends
  // running a little past the ring onto the dado
  const chord = Math.sqrt(Math.max(0, R * R - (CY + SILL) ** 2)) + RING * 0.6;
  rect(c, -chord - 8, -SILL - 2, chord + 8, 0, (_X, _Y, lx, ly) => {
    const e = chord + 8 - Math.abs(lx);
    if (e < 2 && ly < -SILL - 2 + (2 - e)) return 0;
    if (ly < -SILL - 0.8) return e < 2 ? P.stone[2]! : P.stone[0]!;
    if (ly < -SILL + 0.5) return P.stone[2]!;
    const worn = fbm(lx * 0.12, ly * 0.4, 4307, 2) > 0.6 ? 1 : 0;
    const mid = Math.abs(lx) < chord * 0.4 ? 0 : 1; // worn hollow in the middle where feet pass
    return pick([P.stone[2]!, P.stone[3]!, P.stone[4]!, P.stone[5]!], 1 + mid * 0.6 + worn * 0.6 + (ly > -2 ? 1 : 0));
  });
}

// ===========================================================================
// The head: brackets, the beam, rafter ends, the tiled canopy
// ===========================================================================
export function gateHead(c: PaintCtx, g: GateGeo, lf: LitField, lfg: LitField): void {
  const hb = headBox(g);
  const { beam0, beam1, ew, rise, cw } = hb;
  // --- two bracket sets under the beam's ends: an arm out of the wall with a curled end, a block, a
  // second arm, painted teal and gold, shadowed on their right and under them
  for (const sx of [-1, 1]) {
    const bx = sx * (cw - 0.32 * H);
    bracketSet(c, bx, beam1, lf);
  }
  // --- the beam: red lacquer, a painted panel in its middle, gold beads, the ends cut in a cloud profile
  rect(c, -cw, beam0, cw, beam1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const v = (ly - beam0) / (beam1 - beam0), e = cw - Math.abs(lx);
    if (e < 6 && (v < 0.2 || v > 0.8) && e < 6 - Math.sin(v * Math.PI) * 4) return 0;
    if (v < 0.12) return mt(M.gold, face(l.k, -0.5, 0, -0.9) * 0.85, X, Y, 0.1, 1, 0);
    if (v > 0.88) return mt(M.lacq, face(l.k, 0) * 0.35, X, Y, 0.3, 1, 0);
    // the painted panel: teal with a gold border, red ends
    const pe = Math.min(cw * 0.42 - Math.abs(lx), (0.5 - Math.abs(v - 0.5)) * 30);
    if (pe > 0) return pe < 1.2 ? mt(M.gold, face(l.k, 0) * 0.65, X, Y, 0.2, 1, 0) : tn(P.jade, clamp(0.72 + (1 - face(l.k, 0)) * 0.2, 0, 1), X, Y, 0.2);
    const whorl = Math.abs(Math.hypot(Math.abs(lx) - cw * 0.55, (v - 0.5) * 14) - 4) < 0.8;
    if (whorl) return mt(M.gold, face(l.k, 0) * 0.6, X, Y, 0.2, 1, 0);
    return mt(M.verm, face(l.k, -0.5, 0, v < 0.3 ? -0.4 : 0) * 0.68 + grain(lx, ly, 4401, false) * 0.05, X, Y, 0.2, 1, 0.2);
  });
  // --- two tiers of rafter ends over the beam: round rafters (a dark end, a teal ring, a gold dot) and
  // square flying rafters above them (gold-dotted), each throwing a short shadow down and right
  const rr0 = beam0 - 5, rr1 = beam0;
  const fr0 = rr0 - 4;
  const liftAt = (t: number): number => Math.pow(Math.max(0, t - 0.5) / 0.5, 2.2) * 0.28 * H;
  rect(c, -cw - 6, fr0 - 0.3 * H, cw + 6, rr1, (X, Y, lx, ly) => {
    const t = Math.abs(lx) / ew;
    const lift = liftAt(t);
    const y = ly + lift;
    if (Math.abs(lx) > cw + 4) return 0;
    const l = lf.get(lx, ly);
    if (y >= rr0 && y < rr1) {
      const q = ((((lx + 600) % 7) + 7) % 7) - 3.5;
      const d = Math.hypot(q, y - (rr0 + rr1) / 2);
      if (d > 2.6) return mt(M.lacq, face(l.k, 0) * 0.25, X, Y, 0.4, 1, 0);
      if (d < 0.9) return mt(M.gold, face(l.k, 0) * 0.8, X, Y, 0.2, 1, 0);
      if (d < 1.8) return tn(P.jade, clamp(0.55 + (1 - face(l.k, 0)) * 0.3 + (q > 0 ? 0.1 : 0), 0, 1), X, Y, 0);
      return mt(M.lacq, face(l.k, -0.5, q / 3, 0) * 0.6, X, Y, 0.2, 1, 0);
    }
    if (y >= fr0 && y < rr0) {
      const q = ((((lx + 603) % 7) + 7) % 7);
      if (q < 1) return mt(M.lacq, face(l.k, 0) * 0.25, X, Y, 0.4, 1, 0);
      if (q > 2.5 && q < 4.5 && y > fr0 + 1 && y < rr0 - 1) return mt(M.gold, face(l.k, 0) * 0.75, X, Y, 0.2, 1, 0);
      return tn(P.jade, clamp(0.62 + (1 - face(l.k, 0)) * 0.25 + (y > rr0 - 1.2 ? 0.15 : 0), 0, 1), X, Y, 0);
    }
    return 0;
  });
  // --- the canopy: round end tiles and drip tiles along the eave, barrel tiles up to the ridge (lit on
  // their upper left), the ridge with curled ends and a pearl; it all lifts toward the ends
  const eave = fr0 - 1;
  const ridgeAt = (t: number): number => eave - rise + Math.pow(t, 1.6) * rise * 0.45;
  rect(c, -ew - 8, eave - rise - 16, ew + 8, eave + 5, (X, Y, lx, ly) => {
    const t = Math.abs(lx) / ew;
    if (t > 1.02) return 0;
    const lift = liftAt(Math.min(1, t));
    const y = ly + lift; // in the unlifted frame
    const ridge = ridgeAt(Math.min(1, t));
    const l = lf.get(lx, ly);
    // the eave: round end tiles with a boss, drip tiles hanging between them
    if (y > eave - 3.5 && y < eave + 3.5) {
      const q = ((((lx + 604) % 8) + 8) % 8) - 4;
      const dc = Math.hypot(q, y - eave);
      if (dc < 3.2) {
        if (dc < 1.1) return P.tile[0]!;
        const lit = -(q * 0.6 + (y - eave) * 0.8);
        return dc > 2.4 && lit < 0 ? P.tile[4]! : lit > 0.8 ? P.tile[1]! : P.tile[2]!;
      }
      if (Math.abs(q) > 3 && y > eave && y < eave + 3.5 - Math.abs(Math.abs(q) - 4) * 1.5) return P.tile[3]!;
      if (y > eave) return 0;
      return P.tile[5]!;
    }
    if (y >= eave + 3.5) return 0;
    // the ridge: a dark beam along the top with a lit top edge, its ends curling up
    if (y < ridge && y > ridge - 6 && t < 0.97) return y < ridge - 4.8 ? mt(M.tile, face(l.k, -0.5, 0, -1) * 0.95, X, Y, 0, 1, 0) : mt(M.tile, face(l.k, 0) * 0.42, X, Y, 0.3, 1, 0);
    if (y < ridge) return 0;
    // the barrel tiles: columns lit on their upper left, the channels between them dark
    const q = ((((lx + 604) % 8) + 8) % 8);
    const v = (y - ridge) / Math.max(1, eave - ridge);
    const course = (((y - ridge + 1) % 5) + 5) % 5 < 0.9;
    const under = v < 0.22 ? 1 : 0; // the ridge's shade over the top courses
    if (q < 1 || q >= 7) return pick(P.tile, 4 + under);
    const step = q < 3 ? 1 : q < 5.5 ? 2 : 3;
    void l;
    return pick(P.tile, step + under + (course ? 1 : 0));
  });
  // the ridge's curled ends and the pearl
  for (const sx of [-1, 1]) {
    const ex = sx * ew * 0.97, ey = ridgeAt(0.97) - liftAt(0.97);
    rect(c, ex - 9, ey - 13, ex + 9, ey + 1, (X, Y, lx, ly) => {
      const u = (lx - ex) * sx, v = ey - ly; // u outward, v up
      const curl = Math.abs(Math.hypot(u - 1, v - 6) - 4.5) < 1.6 && !(u < -1 && v < 6);
      const stem = u > -6 && u < 1 && v > -1 && v < 3;
      if (!curl && !stem) return 0;
      const l = lf.get(lx, ly);
      return mt(M.tile, face(l.k, -0.5, 0, v > 7 ? -1 : 0) * (v > 7 ? 0.9 : 0.5), X, Y, 0, 1, 0);
    });
  }
  const pr = ridgeAt(0) - 6;
  rect(c, -7, pr - 12, 7, pr + 1, (X, Y, lx, ly) => {
    const d = Math.hypot(lx, ly - (pr - 5));
    const flame = Math.abs(lx) < 2.5 - (pr - 5 - ly) * 0.25 && ly < pr - 8 && ly > pr - 12;
    if (d > 4.2 && !flame) return 0;
    return mt(M.gold, face(lfg.get(lx, ly).k, -0.5, lx / 4, (ly - pr + 5) / 4) * 1.05, X, Y, 0, 1, 0);
  });
}

function bracketSet(c: PaintCtx, bx: number, y0: number, lf: LitField): void {
  // (side-on: the set projects toward us out of the wall; we see its front: a bearing block under the
  // beam, an arm across, a second block, a curled corbel tapering into the wall)
  const tiers: [number, number, number][] = [[0.26 * H, 0, 0.1 * H], [0.18 * H, 0.1 * H, 0.09 * H], [0.11 * H, 0.19 * H, 0.2 * H]];
  for (const [hw, dy, hh] of tiers) {
    const top = y0 + dy, bot = top + hh;
    const last = dy > 0.15 * H;
    rect(c, bx - hw, top, bx + hw, bot, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - bx) / hw, v = (ly - top) / hh;
      if (last) {
        // the corbel: its sides curving in to the wall, a curl cut in its face
        const w = 1 - v * 0.55;
        if (Math.abs(u) > w) return 0;
        const notch = Math.abs(v - 0.55) < 0.06 && Math.abs(u) < w * 0.7;
        if (notch) return mt(M.lacq, face(l.k, -0.5) * 0.3, X, Y, 0.2, 1, 0);
        return mt(M.lacq, face(l.k, -0.5, u < -w + 0.18 ? -1 : u > w - 0.18 ? 1 : 0, v > 0.85 ? 1 : 0) * 0.62, X, Y, 0.1, 1, 0);
      }
      const edge = Math.abs(u) > 0.86 || v < 0.16 || v > 0.84;
      if (edge) return mt(M.gold, face(l.k, -0.5, u < -0.86 ? -1 : u > 0.86 ? 1 : 0, v < 0.16 ? -1 : v > 0.84 ? 1 : 0) * 0.8, X, Y, 0.1, 1, 0);
      return tn(P.jade, clamp(0.6 + (1 - face(l.k, -0.5)) * 0.25, 0, 1), X, Y, 0);
    });
  }
}

// ===========================================================================
// The clerestories and the scrolls
// ===========================================================================
export function clerestories(c: PaintCtx, g: GateGeo, lf: LitField): void {
  // (round 3, W2-3a: pale cobble cells, the brightest shapes over the gate) windows: a lacquered frame, the wall's
  // thickness as a dark reveal (its soffit darkest, the sill's top lit by the day), an ice-ray lattice of thin
  // straight bars dark against the court's sky, each bar with a faint warm lip on top from the room's lamps; the sky
  // graded a step under the gate's, a far range low across it; a sill board under each, on the sill rail
  for (const [x0, y0, x1, y1] of clerestoryBoxes(g)) {
    const FR = 4, REV = 3;
    const ix0 = x0 + FR + REV, ix1 = x1 - FR - REV, iy0 = y0 + FR + REV + 1, iy1 = y1 - FR - REV;
    const seed = 4601 + (x0 < 0 ? 0 : 7);
    const segs = iceRay(ix1 - ix0, iy1 - iy0, seed, 240);
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const ex = Math.min(lx - x0, x1 - lx), ey = Math.min(ly - y0, y1 - ly);
      const e = Math.min(ex, ey);
      // the frame: lacquered, lit on its top and left bevels
      if (e < FR) {
        const nx = lx - x0 < FR ? -1 : x1 - lx < FR ? 1 : 0, ny = ly - y0 < FR ? -1 : y1 - ly < FR ? 1 : 0;
        const bev = e < 1.2;
        return mt(M.wood, face(l.k, -0.6, bev ? nx : 0, bev ? ny : 0) * (bev ? 0.85 : 0.55), X, Y, 0.35, 1, 0);
      }
      // the reveal: its soffit darkest, its sides a step lighter, the sill's top lit by the day coming through
      if (ly >= iy1) return ly < iy1 + 1 ? P.stone[1]! : ly < iy1 + 2 ? P.stone[3]! : P.dusk[2]!;
      if (ly < iy0) return ly < iy0 - 2 ? P.dusk[4]! : P.dusk[3]!;
      if (lx < ix0 || lx >= ix1) return lx < ix0 ? (lx < ix0 - 1.5 ? P.dusk[3]! : P.dusk[2]!) : P.dusk[3]!;
      const gx = lx - ix0, gy = ly - iy0;
      const [dd, flat] = iceDist(segs, gx, gy);
      const edge = Math.min(gx, gy, ix1 - ix0 - gx, iy1 - iy0 - gy);
      // the bars (and the lattice's own border), dark timber against the light; the top of a level bar lit warm
      if (dd < 1.0 || edge < 1.6) return P.umber[4]!;
      if (flat && dd < 1.9 && iceDist(segs, gx, gy + 1.4)[0] < 1.0) return P.umber[1]!;
      // beyond: the court's sky a step under the gate's, deeper at the top, a far range in the haze low across it
      const fu = gx / (ix1 - ix0), fv = gy / (iy1 - iy0);
      const kars = fv > 0.7 + 0.13 * Math.abs(Math.sin(fu * 4.6 + seed)) + 0.05 * Math.sin(fu * 15 + seed);
      if (kars) return fv > 0.92 ? P.range[5]! : P.range[4]!;
      const t = fv + (bayer4(X, Y) - 0.5) * 0.08;
      const cl = Math.hypot((fu - (x0 < 0 ? 0.32 : 0.68)) * 1.5, (fv - 0.5) * 2.6);
      if (cl < 0.36) return cl < 0.24 && fv < 0.52 ? P.range[1]! : P.range[2]!;
      return t < 0.22 ? P.blue[2]! : t < 0.44 ? P.range[5]! : t < 0.66 ? P.range[4]! : P.range[3]!;
    });
    // the sill board on the sill rail: its top lit by the day from the window, its front in the room's dusk, a
    // short shadow under it
    const sx0 = x0 - 6, sx1 = x1 + 6, sy0 = y1, sy1 = y1 + 5;
    rect(c, sx0, sy0, sx1, sy1 + 3, (X, Y, lx, ly) => {
      if (ly >= sy1) return lx > sx0 + 2 && lx < sx1 - 1 ? mt(M.lacq, 0.25, X, Y, 0.4, 1, 0) : 0;
      const l = lf.get(lx, ly);
      const e = Math.min(lx - sx0, sx1 - lx);
      if (ly < sy0 + 1.2) return e < 1 ? mt(M.wood, face(l.k, -0.6) * 0.7, X, Y, 0.3, 1, 0) : P.stone[2]!;
      return mt(M.wood, face(l.k, -0.6, e < 1.2 ? (lx < sx0 + 1.2 ? -1 : 1) : 0, ly > sy1 - 1.2 ? 1 : 0) * 0.62 + grain(lx, ly, 4611, false) * 0.08, X, Y, 0.35, 1, 0.3);
    });
  }
}

export function scrolls(c: PaintCtx, g: GateGeo, lf: LitField): void {
  scrollBoxes(g).forEach(([x0, y0, x1, y1], i) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    // the cord to a nail, the top rod, the bottom rod with its knobs
    rect(c, cx - 0.5, y0 - 0.32 * H, cx + 0.5, y0 - 2, (_X, _Y, lx) => (Math.abs(lx - cx) < 0.6 ? P.umber[3]! : 0));
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const X = Math.round(c.X(cx + (t - 0.5) * w * 0.5)), Y = Math.round(c.Y(y0 - 0.32 * H + Math.abs(t - 0.5) * 0.3 * H));
      c.buf.set(X, Y, P.umber[3]!);
    }
    rect(c, x0 - 1, y0 - 3, x1 + 1, y0, (X, Y, lx, ly) => mt(M.wood, face(lf.get(lx, ly).k, -0.6, 0, ly < y0 - 2 ? -1 : 0) * 0.7, X, Y, 0.3, 1, 0));
    rect(c, x0 - 4, y1, x1 + 4, y1 + 4, (X, Y, lx, ly) => {
      const knob = lx < x0 || lx > x1;
      return knob ? mt(M.gold, face(lf.get(lx, ly).k, -0.6, lx < x0 ? -1 : 1, -0.5) * 0.8, X, Y, 0.2, 1, 0) : mt(M.wood, face(lf.get(lx, ly).k, -0.6, 0, ly < y1 + 1 ? -1 : 0.6) * 0.75, X, Y, 0.3, 1, 0);
    });
    // the mount (dark teal silk) and the painting (warm paper with an ink branch)
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - x0) / w, v = (ly - y0) / (y1 - y0);
      const mx = 3 / w, my = 0.1;
      if (u < mx || u > 1 - mx || v < my || v > 1 - my * 0.7) return pick(P.dusk, (u < mx * 0.5 ? 0 : 1) + (face(l.k, -0.6) > 0.5 ? 0 : 1));
      if (v < my + 0.03 || v > 1 - my * 0.7 - 0.03) return mt(M.gold, face(l.k, -0.6) * 0.6, X, Y, 0.3, 1, 0);
      const pu = (u - mx) / (1 - 2 * mx), pv = (v - my) / (1 - my * 1.7);
      const ink = i === 0 ? plum(pu, pv, lx, ly) : bamboo(pu, pv, lx, ly);
      if (ink === 1) return P.ink[1]!;
      if (ink === 2) return P.umber[2]!;
      if (ink === 3) return P.red[3]!;
      if (ink === 4) return P.red[1]!;
      // the paper, aged warm, a little foxing
      const fox = fbm(lx * 0.2, ly * 0.2, 4501 + i, 2) > 0.72 ? 0.08 : 0;
      return mt(M.paper, face(l.k, -0.6) * 0.92 - fox - pv * 0.05, X, Y, 0.15, 1, 0.3);
    });
  });
}

/** A plum branch in ink with red blossoms: 0 paper, 1 ink, 2 wash, 3 blossom, 4 blossom lit. */
function plum(u: number, v: number, lx: number, ly: number): number {
  // a branch rising from the lower left, kinked, two twigs off it
  const bx = 0.2 + 0.5 * v * v + Math.sin(v * 9) * 0.05;
  const d = Math.abs(u - (1 - bx)) * 34;
  if (v > 0.25 && d < 1.4 - v * 0.5 + 0.9) return 1;
  const tw = Math.abs(u - (0.75 - (0.55 - v) * 0.9)) * 34;
  if (v > 0.3 && v < 0.55 && tw < 0.8) return 1;
  for (let i = 0; i < 9; i++) {
    const bu = 0.25 + 0.55 * hash(i, 1, 4511), bv = 0.18 + 0.5 * hash(i, 2, 4511);
    const dd = Math.hypot((u - bu) * 34, (v - bv) * 100);
    if (dd < 1.9) return dd < 0.8 ? 4 : 3;
  }
  if (v > 0.84 && Math.abs(u - 0.5) < 0.42 && vnoise(lx * 0.3, ly * 0.3, 4513) > 0.5) return 2;
  return 0;
}

/** Bamboo in ink: two culms with joints, leaves in fans. */
function bamboo(u: number, v: number, lx: number, ly: number): number {
  for (const [cu, lean] of [[0.38, 0.05], [0.62, -0.04]] as const) {
    const x = cu + lean * (1 - v);
    if (Math.abs(u - x) * 34 < 1.2 && v > 0.08) {
      const node = (((v * 9) % 1) + 1) % 1 < 0.06;
      return node ? 2 : 1;
    }
  }
  for (let i = 0; i < 6; i++) {
    const lu = 0.3 + 0.45 * hash(i, 3, 4521), lv = 0.1 + 0.55 * hash(i, 4, 4521);
    const ang = (hash(i, 5, 4521) - 0.5) * 1.6 + (lu < 0.5 ? -0.8 : 0.8);
    const du = (u - lu) * 34, dv = (v - lv) * 100;
    const along = du * Math.cos(ang) + dv * Math.sin(ang), across = -du * Math.sin(ang) + dv * Math.cos(ang);
    if (along > 0 && along < 8 && Math.abs(across) < 1.3 * (1 - along / 8)) return 1;
  }
  if (v > 0.86 && Math.abs(u - 0.5) < 0.4 && vnoise(lx * 0.3, ly * 0.3, 4523) > 0.55) return 2;
  return 0;
}

// The roof over the play plane (the hall loop, round 2, W2-1: the round-1 roof was a flat lid of four
// colours). Seen from the floor through the incense air, the timber frame of the roof:
//
// - the great tie beam along the front, the lanterns' beam: the nearest, darkest, sharpest thing up here,
//   its painted panels each their own (long and short cartouches, a hung tablet, one flaked bare, iron
//   straps at the joints);
// - over it, at every bay, a transverse frame (the stacked beams of a tailiang roof): a bracket set on
//   the tie beam, then beam ends and the short struts between them stepping up to the ridge;
// - the purlins running along the hall on those frames, closer together the higher they go (the roof
//   pitching away from us up to the ridge), the rafters between them, the boards behind: each purlin
//   further off than the last, so each a step further into the air's haze (lighter, cooler, flatter);
// - lanterns on long cords from the lower purlins and two silk banners, in the haze;
// - the skylight cut through it all as a framed well: purlins stopped at its trimmers, its side walls
//   lit by the day falling in from above, a lit soffit along its mouth, its lattice against the sky.
//
// The frame's top edge in the entrance shot cuts through this structure (no flat band), and the light
// on it is the well's day on the faces turned to it plus the lanterns' warmth on the undersides near them.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4 } from "../../raster.ts";
import { M, LitField, SCREEN, clamp, face, grain, hash, mt, rect, tn, vnoise, type At, type Ramp } from "./kit.ts";
import { HALL_LIGHT } from "./lights.ts";

const H = 96;

export interface RoofP {
  w: number;
  /** The tie beam's underside above the floor and its depth (px). */
  beam: number;
  depth: number;
  /** The skylight: local x range. */
  sky: [number, number];
  /** How far up it is painted (px above the floor). */
  top: number;
  at?: At;
}

/** Purlins: [height above the floor in H, thickness in H, depth into the haze 0 near .. 1 far]. */
const PURLINS: [number, number, number][] = [
  [17.15, 0.3, 0.12], [18.15, 0.27, 0.3], [19.0, 0.24, 0.46], [19.72, 0.21, 0.6], [20.35, 0.19, 0.72], [20.9, 0.17, 0.82], [21.4, 0.15, 0.9], [21.85, 0.14, 0.96],
];
/** The ridge (H above the floor). */
const RIDGE = 22.3;
/** The bay of the transverse frames (H), lined up with the tie beam's joints. */
export const BAY = 4.6;

/** Timber in the haze: near (dark, warm, full contrast) to far (the cool air's mid violet). */
const NEAR: Ramp = [P.umber[1]!, P.umber[2]!, P.umber[3]!, P.umber[4]!, P.umber[5]!];
// (round 3, W2-7: the roof was the lightest large plane in hall-wide, L 44.5 against the bay's 35: the haze lifted the
// far timber to a mid violet) the far roof sinks into the dark instead, the shell the darkest thing in the room; only
// the well's day and the roof lanterns light it
const MID: Ramp = [P.mauve[2]!, P.mauve[3]!, P.mauve[4]!, P.dusk[5]!, P.dusk[6]!];
const FAR: Ramp = [P.dusk[3]!, P.dusk[4]!, P.dusk[5]!, P.dusk[5]!, P.dusk[6]!];

/** How much darker the roof is where the current pixel lies (set per pixel by the roof's pass). */
let dk = 0;

/** A step of timber at haze h (0 near .. 1 far) and value v (0 lit .. 1 dark). */
function wood(h: number, v0: number, X: number, Y: number): number {
  const v = v0 + dk;
  const r = h < 0.3 ? NEAR : h < 0.66 ? MID : FAR;
  // the far air also flattens: the value range shrinks toward its middle
  const vv = h < 0.66 ? v : 0.25 + v * 0.55;
  const pos = clamp(vv, 0, 1) * (r.length - 1);
  let i = Math.floor(pos);
  if (pos - i > 0.5 + (bayer4(X, Y) - 0.5) * 0.25) i++;
  return r[clamp(i, 0, r.length - 1)]!;
}

export const roof = definePainter<RoofP>("hall.roof", {
  bounds(p) {
    return [0, -p.top, p.w, -p.beam + 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 16);
    const b0 = -p.beam - p.depth, b1 = -p.beam;
    const [sx0, sx1] = p.sky;
    const sw = sx1 - sx0, scx = (sx0 + sx1) / 2;
    const WALL = 0.22 * H; // the well's side walls seen inside its frame
    const wellTop = -19.5 * H, wellMouth = b0 - 0.08 * H;
    // how much of the well's day a point gets: faces near the well, falling off along the roof
    const dayAt = (lx: number, ly: number): number => {
      const dx = Math.abs(lx - scx) - sw / 2;
      const up = clamp((ly - wellTop) / (wellMouth - wellTop), 0, 1);
      return clamp(1 - Math.max(0, dx) / (2.6 * H), 0, 1) ** 2 * (0.45 + 0.55 * up);
    };
    const purlinAt = (hgt: number): [number, number, number] | undefined => PURLINS.find(([ph, th]) => hgt >= ph - th / 2 && hgt < ph + th / 2);
    // (round 2, second pass) the lanterns hung in the roof light the timber round them: the purlins' undersides
    // and the rafters near each warm a step or two, falling off across the roof (so the dark up here is lit
    // structure in places, not a field)
    const lants: [number, number, number, number][] = []; // [x, hook y, cord, k]
    for (const [o, k] of [[0.14, 2], [0.22, 1], [0.4, 3], [0.55, 2], [0.63, 1], [0.81, 3], [0.9, 2]] as const) {
      const lx = o * p.w + (hash(k, Math.round(o * 100), 5107) - 0.5) * H;
      if (lx > sx0 - 1.5 * H && lx < sx1 + 1.5 * H) continue;
      const hook = -PURLINS[k]![0] * H + PURLINS[k]![1] * H / 2;
      // never down in front of the tie beam (the nearest thing up here): the lantern stays in the roof over it
      const room = (b0 - 0.75 * H) - hook - 2 * (13 - 2 * Math.min(2, k)) - 6;
      lants.push([lx, hook, Math.max(8, Math.min((0.9 + hash(k, Math.round(o * 100) + 5, 5109) * 1.1) * H, room - hash(k, Math.round(o * 100), 5111) * 0.5 * H)), Math.min(2, k)]);
    }
    const glowAt = (lx: number, ly: number): number => {
      let g = 0;
      for (const [x, hook, cordL] of lants) {
        const cy = hook + cordL;
        const d = Math.hypot((lx - x) / (1.7 * H), (ly - cy) / (ly < cy ? 1.5 : 0.9) / H);
        if (d < 1) g = Math.max(g, (1 - d) ** 1.3);
      }
      return g;
    };
    rect(c, 0, -p.top, p.w, b1, (X, Y, lx, ly) => {
      const hgt = -ly / H;
      // --- the tie beam
      if (ly >= b0) return tieBeam(X, Y, lx, (ly - b0) / p.depth, lf.get(lx, ly).k, p.depth);
      // (round 3, W2-7) the roof grades darker away from the well and up toward the ridge: the shell ends darkest at
      // its top corners
      const fromWell = clamp((Math.abs(lx - scx) - 2.5 * H) / (9 * H), 0, 1);
      dk = fromWell * 0.22 + clamp((hgt - 18) / 4.5, 0, 1) * 0.12;
      // --- the skylight's well: its frame cut through the roof
      if (lx > sx0 - WALL - 0.12 * H && lx < sx1 + WALL + 0.12 * H && ly > wellTop - 0.15 * H && ly < wellMouth) {
        const v = well(X, Y, lx, ly, sx0, sx1, WALL, wellTop, wellMouth);
        if (v) return v;
      }
      // --- the transverse frames at every bay: a bracket set on the tie beam, then beam ends and
      // struts stepping up to the ridge, each narrower than the one under it
      const bx = ((lx % (BAY * H)) + BAY * H) % (BAY * H);
      const fx = bx < BAY * H / 2 ? bx : bx - BAY * H; // from the frame's centre
      const haze = clamp((hgt - 16.4) / (RIDGE - 16.4), 0, 1);
      const fr = frame(X, Y, fx, hgt, haze, dayAt(lx, ly), Math.floor(lx / (BAY * H)));
      if (fr) return fr;
      // --- purlins: a lit underside lip, the body, a dark top where the rafters sit on it
      const pr = purlinAt(hgt);
      if (pr) {
        const [ph, th, hz] = pr;
        const t = (ph + th / 2 - hgt) / th; // 0 at its underside .. 1 at its top
        const day = dayAt(lx, ly);
        const lip = t < 0.22;
        const gl = glowAt(lx, ly);
        const v = (lip ? 0.15 - day * 0.15 - gl * 0.2 : t > 0.8 ? 0.95 : 0.55 - day * 0.3 - gl * 0.4 + grain(lx, ly, 5101, false) * 0.15);
        // a joint and an iron strap here and there along it
        const jx = ((lx + ph * 177) % (3.3 * H) + 3.3 * H) % (3.3 * H);
        if (jx < 2 && hz < 0.6) return wood(hz, 1, X, Y);
        return wood(hz, v, X, Y);
      }
      // --- between purlins: rafters running up the pitch (foreshortened), the boards behind them
      let below = 16.4, above = RIDGE;
      for (const [ph, th] of PURLINS) {
        if (ph + th / 2 <= hgt) below = Math.max(below, ph + th / 2);
        if (ph - th / 2 > hgt && ph - th / 2 < above) above = ph - th / 2;
      }
      const hz = clamp((hgt - 16.4) / (RIDGE - 16.4), 0, 1) * 0.95 + 0.03;
      const span = Math.max(0.01, above - below);
      const u = (hgt - below) / span; // 0 just over the purlin below .. 1 under the one above
      const gi = PURLINS.findIndex(([ph]) => ph > hgt);
      // (round 4, W2-g: one slat rhythm across the whole roof) each bay between two frames laid by its own hand: its own
      // rafter pitch and phase, a board tone of its own; the rows darker the higher they go
      const rb = Math.floor(lx / (BAY * H));
      const pitch = Math.round(0.34 * H * (1 - (gi < 0 ? PURLINS.length : gi) * 0.03) * (0.88 + 0.24 * hash(rb, 1, 5151)));
      const rx = (((lx + hash(rb, gi, 5153) * pitch) % pitch) + pitch) % pitch;
      const rafter = rx < pitch * (0.36 + 0.12 * hash(rb, 2, 5151));
      dk += (hash(rb, 3, 5151) - 0.5) * 0.08 + clamp((hgt - 17.2) / 4.8, 0, 1) * 0.1;
      const day = dayAt(lx, ly);
      if (hgt > RIDGE) return wood(1, 0.55 + vnoise(lx * 0.01, 3, 5103) * 0.15, X, Y);
      if (rafter) {
        // the rafter's underside: lit along its lower end where it leaves the purlin's shadow
        const v = 0.42 - day * 0.25 - glowAt(lx, ly) * 0.45 + (u < 0.25 ? 0.25 : 0) + (rx < 1.2 ? -0.1 : rx > pitch * 0.42 - 1.2 ? 0.15 : 0);
        return wood(Math.min(1, hz + 0.05 - glowAt(lx, ly) * 0.25), v, X, Y);
      }
      // the boards: darkest, a step into the haze beyond the rafters
      return wood(Math.min(1, hz + 0.1 - glowAt(lx, ly) * 0.25), 0.92 - day * 0.25 - glowAt(lx, ly) * 0.35 - hz * 0.3 - (u > 0.8 ? 0 : 0.05), X, Y);
    });
    dk = 0;
    // --- lanterns on long cords from the lower purlins and two silk banners, each in its own haze
    for (const [lx, hook, cordL, k] of lants) roofLantern(c, lx, hook, cordL, k);
    for (const [o, k] of [[0.31, 0], [0.72, 1]] as const) roofBanner(c, o * p.w, -PURLINS[k]![0] * H + PURLINS[k]![1] * H / 2, (1.9 - k * 0.3) * H, k);
  },
});

/** The tie beam: lacquer with gold beads; each bay's panel its own; straps at the joints. */
function tieBeam(X: number, Y: number, lx: number, v: number, k: number, depth: number): number {
  if (v > 0.88) return mt(M.gold, face(k, 0, 0, 0.9) * 0.75, X, Y, 0.3, 1, 0);
  if (v < 0.07) return mt(M.gold, face(k, 0, 0, -0.9) * 0.45, X, Y, 0.35, 1, 0);
  const bay = Math.floor(lx / (BAY * H));
  const kk = (((lx % (BAY * H)) + BAY * H) % (BAY * H)) / (BAY * H);
  const ek = Math.min(kk, 1 - kk) * BAY * H;
  // the joint over each frame: an iron strap with rivets
  if (ek < 0.12 * H) {
    const rivet = Math.abs(v - 0.3) < 0.08 || Math.abs(v - 0.7) < 0.08;
    return rivet && ek > 0.05 * H && ek < 0.08 * H ? P.lacquer[0]! : ek < 0.03 * H ? P.ink[0]! : P.lacquer[3]!;
  }
  // the beam's painted ends over each frame: a red band with a gold line inside it
  if (ek < 0.4 * H) {
    if (Math.abs(ek - 0.3 * H) < 0.025 * H) return mt(M.gold, face(k, 0) * 0.45, X, Y, 0.4, 1, 0);
    return mt(M.verm, face(k, 0) * 0.32, X, Y, 0.4, 1, 0);
  }
  // (round 4, W2-g: plain and medallion panels read as empty boxes at 0.5x; only one bay carried the clouds) the cloud
  // band runs the beam's length, broken only at the joints: painted teal clouds and carved gilt-edged ones by turns,
  // a pair of medallions or the hung tablet in a few bays
  const style = [0, 3, 0, 1, 3, 0, 3, 2, 0, 3, 1, 3][((bay % 12) + 12) % 12]!;
  const w = 0.5 - Math.abs(kk - 0.5); // 0 at the ends .. 0.5 in the middle
  const bu = (kk - 0.5) * BAY * H, bv = (v - 0.5) * depth; // px from the panel's middle
  if (style === 0) {
    // (round 3, W2-7: the long teal cartouches read as empty boxes at 0.5x) a long cartouche, teal with a gold edge,
    // a run of ruyi clouds painted along it in two lighter teals with gold outlines
    const e = Math.min((w - 0.1) * BAY * H, (0.3 - Math.abs(v - 0.5)) * depth);
    if (e > 0) {
      if (e < 1.5) return mt(M.gold, face(k, 0) * 0.6, X, Y, 0.3, 1, 0);
      const cl = ruyi(bu, bv, 0.3 * depth, bay);
      if (cl === 2) return mt(M.gold, face(k, 0) * 0.5, X, Y, 0.35, 1, 0);
      if (cl === 1) return tn(P.jade, clamp(0.5 + (1 - k) * 0.12 + (bv > 0 ? 0.12 : 0), 0, 1), X, Y, 0);
      return tn(P.jade, clamp(0.86 + (1 - k) * 0.12, 0, 1), X, Y, 0);
    }
  } else if (style === 1) {
    // two short cartouches, each with a gilt medallion (a flower in a ring)
    const cc = Math.abs(kk - 0.35) < Math.abs(kk - 0.65) ? 0.35 : 0.65;
    const e = Math.min((0.09 - Math.abs(kk - cc)) * BAY * H, (0.28 - Math.abs(v - 0.5)) * depth);
    if (e > 0) {
      if (e < 1.5) return mt(M.gold, face(k, 0) * 0.55, X, Y, 0.3, 1, 0);
      const mr = Math.hypot((kk - cc) * BAY * H, bv);
      const ang = Math.atan2(bv, (kk - cc) * BAY * H);
      const petal = mr < 0.13 * depth * (0.75 + 0.25 * Math.cos(ang * 6));
      if (Math.abs(mr - 0.19 * depth) < 1.2 || (petal && mr > 0.05 * depth)) return mt(M.gold, face(k, -0.5, Math.cos(ang) * 0.4, Math.sin(ang) * 0.4) * 0.6, X, Y, 0.25, 1, 0);
      if (mr <= 0.05 * depth) return mt(M.verm, face(k, 0) * 0.7, X, Y, 0.2, 1, 0);
      return mt(M.verm, face(k, 0) * 0.4, X, Y, 0.3, 1, 0);
    }
  } else if (style === 2) {
    // a black tablet hung on the beam, gold-edged, a little proud of it (no lettering: a gilt seal)
    const e = Math.min((0.13 - Math.abs(kk - 0.5)) * BAY * H, (0.42 - Math.abs(v - 0.52)) * depth);
    if (e > 0) {
      if (e < 1.5) return mt(M.gold, face(k, -0.5, 0, v < 0.5 ? -0.8 : 0.5) * 0.8, X, Y, 0.1, 1, 0);
      const seal = Math.hypot((kk - 0.5) * BAY * H, (v - 0.52) * depth) < 0.07 * H;
      return seal ? mt(M.gold, face(k, 0) * 0.65, X, Y, 0.3, 1, 0) : mt(M.lacq, face(k, 0) * 0.2, X, Y, 0.3, 1, 0);
    }
    if (kk > 0.5 && kk < 0.5 + 0.13 + 0.02 && v > 0.15 && v < 0.95) return P.umber[5]!; // its shadow on the beam
  } else if (style === 3) {
    // (round 3, W2-7: the flaked-paint patch read as navy camouflage blotches, the look Codex's patch was rejected for)
    // a carved cloud band: the clouds raised out of the lacquer, lit on their top edges, their undercuts dark, three
    // values and no paint
    if (w > 0.1 && Math.abs(bv) < 0.32 * depth) {
      const cl = ruyi(bu, bv, 0.32 * depth, bay + 7);
      const up = ruyi(bu, bv + 1.5, 0.32 * depth, bay + 7);
      // (round 4: the relief in lacquer alone read as black blobs at 0.5x) the raised clouds in old timber, their
      // outlines gilt, the undercut under each dark
      if (cl === 2) return up ? mt(M.gold, face(k, 0, 0, -0.4) * 0.72, X, Y, 0.25, 1, 0) : mt(M.lacq, face(k, 0, 0, 0.9) * 0.15, X, Y, 0.3, 1, 0);
      if (cl) return up ? mt(M.wood, face(k, 0, 0, -0.2) * 0.62, X, Y, 0.35, 1, 0) : mt(M.lacq, face(k, 0, 0, 0.9) * 0.2, X, Y, 0.3, 1, 0);
      if (up) return mt(M.wood, face(k, 0, 0, -0.9) * 0.62, X, Y, 0.3, 1, 0);
    }
  } else {
    // (round 3, W2-7: one long sine line) plain lacquer, its sheen a soft lighter streak along the upper third, a
    // pair of gold beads framing it
    if (Math.abs(v - 0.2) < 0.012 || Math.abs(v - 0.8) < 0.012) return mt(M.gold, face(k, 0) * 0.45, X, Y, 0.35, 1, 0);
    const sheen = Math.max(0, 1 - Math.abs(v - 0.32) / 0.08) * (0.4 + 0.6 * vnoise(lx * 0.01, 9, 5127));
    return mt(M.lacq, face(k, 0) * 0.42 + sheen * 0.16 + grain(lx, v * depth, 5121, false) * 0.06, X, Y, 0.15, 1, 0);
  }
  return mt(M.lacq, face(k, 0) * 0.42 + grain(lx, v * depth, 5121, false) * 0.06, X, Y, 0.15, 1, 0);
}

/**
 * A run of ruyi clouds along a band (round 3): x along the band, y across it (px from its middle), r the band's half
 * height. Each cloud a big lobe with two smaller ones under it and a curling tail, every one a little different;
 * 0 off a cloud, 1 on it, 2 its outline.
 */
export function ruyi(x: number, y: number, r: number, seed: number): number {
  const per = r * 3.4;
  const i = Math.floor(x / per + 0.5);
  const cx = i * per + (hash(i, 1, seed) - 0.5) * r * 0.5, flip = hash(i, 2, seed) < 0.5 ? -1 : 1;
  const dx = (x - cx) * flip, dy = y - (hash(i, 3, seed) - 0.5) * r * 0.3;
  const R = r * (0.52 + 0.1 * hash(i, 4, seed));
  const lobes: [number, number, number][] = [[0, -0.15 * R, R], [-0.95 * R, 0.4 * R, 0.62 * R], [0.95 * R, 0.4 * R, 0.62 * R]];
  let d = Infinity;
  for (const [ax, ay, ar] of lobes) d = Math.min(d, Math.hypot(dx - ax, dy - ay) - ar);
  // the tail: a band curling off to one side
  const tx = dx - 1.5 * R, ty = dy - 0.15 * R;
  if (tx > 0 && tx < 1.6 * R) d = Math.min(d, Math.abs(ty + Math.sin(tx / R * 2.2) * 0.3 * R) - 0.18 * R);
  // the curl cut into the big lobe
  const cr = Math.hypot(dx, dy + 0.15 * R);
  const curl = Math.abs(cr - 0.5 * R) < 0.9 && Math.atan2(dy + 0.15 * R, dx) > -1.2;
  if (d < -1.2) return curl ? 2 : 1;
  if (d < 0.2) return 2;
  return 0;
}

/**
 * A continuous run of ruyi clouds (round 4, W2-g: a cloud stamped every ~125 px read as a stamp): clouds of different
 * sizes at uneven spacing, one in four left out, a tendril wandering along the band between them; 0 off, 1 on a cloud
 * or the tendril, 2 an outline.
 */
export function cloudRun(x: number, y: number, r: number, seed: number): number {
  const per = r * 3.4;
  const i0 = Math.floor(x / per);
  let best = 0;
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    if (hash(i, 9, seed) < 0.25) continue;
    const sc = 0.72 + 0.6 * hash(i, 11, seed);
    const cx = (i + 0.5) * per + (hash(i, 13, seed) - 0.5) * r * 1.2;
    const v = ruyi(cx + (x - cx) / sc, y / sc, r, seed + i * 3);
    if (v === 1) return 1;
    if (v === 2) best = 2;
  }
  if (best) return best;
  // the tendril: a thin line wandering along the band's middle
  const ty = Math.sin(x / (r * 1.7) + hash(Math.floor(x / (per * 2)), 15, seed) * 6) * r * 0.35;
  return Math.abs(y - ty) < 0.75 ? 2 : 0;
}

/**
 * A transverse frame seen from the front: on the tie beam a bracket set (gold and teal blocks and arms),
 * then square beam ends with short struts between them stepping up to the ridge. fx is from the frame's
 * centre; returns 0 off the frame.
 */
function frame(X: number, Y: number, fx: number, hgt: number, haze: number, day: number, bay: number): number {
  let a = Math.abs(fx) / H;
  // (round 3, W2-7: one bracket set every bay, the same) a heavy set on every other frame, a lighter one on the rest,
  // and a small set half way between frames
  const big = ((bay % 2) + 2) % 2 === 0;
  const mid = a > BAY / 2 - 0.5;
  // the bracket set on the tie beam (16.4 .. 17.0 H): three tiers, each wider
  if (hgt < (mid ? 16.82 : 17.0)) {
    const t = (hgt - 16.4) / (mid ? 0.42 : 0.6); // 0 at the beam .. 1 under the first purlin's frame
    const tier = Math.min(2, Math.floor(t * 3));
    if (mid) a = BAY / 2 - a;
    const sc = mid ? 0.5 : big ? 1.12 : 0.8;
    const hw = [0.16, 0.42, 0.7][tier]! * sc;
    if (a > hw) return 0;
    const tv = t * 3 - tier;
    const block = a < 0.13 || tv > 0.55;
    if (!block) return 0;
    if (tv > 0.86) return wood(haze, 0.95, X, Y); // its shadowed underside
    const end = a > hw - 0.07;
    // (round 4, W2-g: every set the same teal and gold, a stamp every half bay) each bay's sets painted their own way:
    // teal blocks with gold ends, red blocks with teal ends, or plain dark timber with only gold ends; a mid set
    // takes its own bay's paint a step darker
    const paint = Math.floor(hash(bay, mid ? 7 : 5, 5141) * 3);
    if (paint === 2) return tv < 0.66 && !end ? mt(M.gold, 0.3 + day * 0.3, X, Y, 0.4, 1, 0) : wood(haze, (end ? 0.38 : 0.55) - day * 0.25, X, Y);
    if (end) return paint === 1 ? tn(P.jade, clamp(0.75 - day * 0.2, 0, 1), X, Y, 0) : mt(M.gold, 0.32 + day * 0.3 + (mid ? 0.1 : 0), X, Y, 0.35, 1, 0);
    if (paint === 1) return mt(M.verm, 0.3 + day * 0.25 - (mid ? 0.08 : 0) + (tv < 0.7 ? 0.04 : -0.04), X, Y, 0.45, 1, 0);
    return tn(P.jade, clamp(0.8 - day * 0.2 + (mid ? 0.06 : 0) + (tv < 0.7 ? -0.05 : 0.05), 0, 1), X, Y, 0);
  }
  if (mid) return 0;
  // (round 4, W2-g) every third frame carries a pair of carved pendants (hanging-flower posts) let down from its first
  // beam's ends either side of the bracket set: a short square post, a gilt collar, a lotus bud turned in red lacquer
  if (((bay % 3) + 3) % 3 === 0 && hgt > 16.5 && hgt < 17.32) {
    const px = Math.abs(a - 0.95);
    const t = (17.32 - hgt) / 0.82; // 0 at the beam .. 1 at the bud's tip
    const hw2 = t < 0.62 ? 0.055 : t < 0.7 ? 0.075 : 0.085 * Math.sin(Math.min(1, (1 - t) / 0.3) * Math.PI * 0.5) + 0.01;
    if (px < hw2) {
      const lit = fx < 0 ? -(a - 0.95) : a - 0.95; // toward the well's side
      if (t >= 0.62 && t < 0.7) return mt(M.gold, 0.3 + day * 0.35 + (lit < 0 ? 0.15 : 0), X, Y, 0.3, 1, 0);
      if (t >= 0.7) return mt(M.verm, 0.25 + day * 0.3 + (px < hw2 * 0.4 ? 0.12 : 0), X, Y, 0.45, 1, 0);
      return wood(haze, (px > hw2 - 0.02 ? 0.75 : 0.45) - day * 0.25, X, Y);
    }
  }
  // (round 3, W2-7) a pair of raking braces on some frames, from over the bracket set up to the ridge's struts: they
  // cross the purlins' rows and break the roof's level rhythm
  if (hash(bay, 3, 5131) < 0.55 && hgt > 17.05 && hgt < RIDGE - 0.4) {
    const t = (hgt - 17.05) / (RIDGE - 0.4 - 17.05);
    const bxp = 1.75 - t * 1.55;
    if (Math.abs(a - bxp) < 0.07) return wood(Math.min(1, haze + 0.02), (fx < 0 ? 0.42 : 0.7) - day * 0.25 + (Math.abs(a - bxp) > 0.045 ? 0.15 : 0), X, Y);
  }
  // above: beam ends (wide, flat) and struts (narrow) alternating, narrowing toward the ridge
  if (hgt > RIDGE + 0.2) return 0;
  const up = (hgt - 17.0) / (RIDGE - 17.0);
  const levels = 5;
  const lvl = Math.floor(up * levels), lv = up * levels - lvl;
  const beamEnd = lv > 0.55;
  const hw = beamEnd ? 0.36 - lvl * 0.04 : 0.11 - lvl * 0.008;
  if (a > hw) return 0;
  const edge = a > hw - 0.035;
  if (beamEnd) {
    // a squared beam end, its painted face (a teal ring on the near ones) lit by the well's day
    return wood(Math.min(1, haze + 0.04), (edge ? 0.75 : 0.4) - day * 0.25 + (lv > 0.93 ? 0.3 : 0) + (hash(bay, lvl, 5123) - 0.5) * 0.1, X, Y);
  }
  // the strut: a camel-hump block, lit on its left where the well's day reaches it
  return wood(Math.min(1, haze + 0.04), (fx < 0 ? 0.45 : 0.7) - day * 0.2, X, Y);
}

/** The skylight's well: lattice against the sky at its top, side walls lit from above, a lit soffit at its mouth. */
function well(X: number, Y: number, lx: number, ly: number, sx0: number, sx1: number, WALL: number, top: number, mouth: number): number {
  // (round 4, W2-e: a lit framed box, L 101 against the roof's 31: it read as a hanging lantern or a lift shaft) the
  // well is a hole in the dark: its trimmers and side walls fall into the roof's own dark with no frame line, only the
  // skylight's small grid at the top is bright, and the light is the shaft of day falling down its middle
  const fr = 0.12 * H;
  // (the walls in the very values of the roof's boards round them at that height, so the well has no outline)
  const hz = clamp((-ly / H - 16.4) / (RIDGE - 16.4), 0, 1) * 0.95 + 0.13;
  if ((lx < sx0 - WALL && lx > sx0 - WALL - fr) || (lx > sx1 + WALL && lx < sx1 + WALL + fr) || ly < top) {
    if (ly < top - 0.15 * H || lx < sx0 - WALL - fr || lx > sx1 + WALL + fr) return 0;
    return wood(hz, 0.88, X, Y);
  }
  if (ly > mouth - 0.1 * H) return wood(0.1, 0.95, X, Y);
  const up = clamp((ly - top) / (mouth - top), 0, 1); // 0 at the top .. 1 at the mouth
  if (lx < sx0 || lx > sx1) {
    // the side walls: a little of the day on them just under the skylight, then the roof's dark all the way down
    const v = up < 0.12 ? 0.5 + up * 3.2 + (lx < sx0 ? 0 : 0.12) : 0.9;
    return wood(hz, v + (bayer4(X, Y) - 0.5) * 0.1, X, Y);
  }
  // the skylight: its lattice in silhouette against the paper's glow, a small grid at the top of the well
  const s2 = 0.28 * H;
  const a = (((lx - sx0) % s2) + s2) % s2, b = ((((-ly) % s2) + s2) % s2);
  if (up < 0.2) {
    if (a < 2.5 || b < 2.5) return P.umber[3]!;
    return up < 0.1 ? P.paper[2]! : P.paper[3]!;
  }
  // the well's air: dark, but for the day falling down its middle as the shaft (its core and two fainter rays), dimming
  // as it falls; the walls' side of the air darkest
  const across = (lx - (sx0 + sx1) / 2) / ((sx1 - sx0) / 2);
  const t = (up - 0.2) / 0.8;
  // (the beam spreads as it falls, from the grid's width to the well's, palest just under the skylight and dimming
  // down the well; its sides soft over a long dithered run, two fainter rays beside it)
  const half = 0.5 + 0.45 * t;
  let beam = clamp(1.3 - Math.abs(across + 0.05) / half, 0, 1);
  for (const [ru, rw] of [[-0.7, 0.1], [0.62, 0.08]] as const) beam = Math.max(beam, 0.45 * Math.max(0, 1 - Math.abs(across - ru * (0.6 + 0.4 * t)) / rw) * (1 - t));
  const v = beam * (1.0 - t * 0.6) + (bayer4(X, Y) - 0.5) * 0.34;
  return v > 0.84 ? P.paper[4]! : v > 0.64 ? P.umber[0]! : v > 0.44 ? P.umber[1]! : v > 0.24 ? P.umber[2]! : wood(hz, 0.9, X, Y);
}

/** A lantern hung up in the roof's haze on a long cord, its glow on the cord's foot; k sets its haze. */
function roofLantern(c: Parameters<typeof roof.paint>[0], x: number, hook: number, cord: number, k: number): void {
  const r = 13 - 2 * k, cy = hook + cord + r;
  rect(c, x - 0.5, hook, x + 0.5, cy - r, (_X, _Y) => (k < 2 ? P.umber[5]! : P.dusk[5]!));
  rect(c, x - r - 1, cy - r - 2, x + r + 1, cy + r + 4, (X, Y, lx, ly) => {
    const dx = (lx - x) / r, dy = (ly - cy) / r;
    if (ly < cy - r) return Math.abs(lx - x) < r * 0.55 ? P.umber[4]! : 0;
    if (ly > cy + r) return Math.abs(lx - x) < 1 && ly < cy + r + 4 ? P.red[4]! : 0;
    const d = dx * dx + dy * dy * 1.1;
    if (d > 1) return 0;
    const glow = 1 - d;
    return tn(k < 2 ? SCREEN : [P.ember[2]!, P.ember[3]!, P.ember[4]!, P.mauve[0]!, P.mauve[1]!], clamp(0.95 - glow * 0.95 + dx * 0.1, 0, 1), X, Y, 0.3);
  });
}

/** A long silk banner hung from a purlin, falling in two folds, its hem fringed; dimmer the higher. */
function roofBanner(c: Parameters<typeof roof.paint>[0], x: number, hook: number, len: number, k: number): void {
  const w = 0.42 * H;
  rect(c, x - w / 2 - 2, hook, x + w / 2 + 2, hook + 3, (_X, _Y) => P.umber[4]!);
  rect(c, x - w / 2, hook + 3, x + w / 2 + 3, hook + len, (X, Y, lx, ly) => {
    const v = (ly - hook - 3) / (len - 3);
    const sway = Math.sin(v * 2.2) * 2.5 * v;
    const u = (lx - x - sway) / (w / 2);
    if (Math.abs(u) > 1) return 0;
    if (v > 0.96 && Math.abs(u) > 0.5) return 0;
    if (v > 0.93) return (Math.floor(lx) & 1) ? P.gold[4]! : 0;
    const fold = Math.sin(u * 3.1 + 0.6) * 0.5 + 0.5;
    const border = Math.abs(u) > 0.82;
    const ramp = k ? [P.blue[3]!, P.blue[4]!, P.dusk[3]!, P.dusk[4]!] : [P.red[4]!, P.red[5]!, P.umber[3]!, P.umber[4]!];
    if (border) return k ? P.dusk[2]! : P.gold[4]!;
    const t = clamp(0.2 + (1 - fold) * 0.5 + v * 0.25, 0, 1);
    return ramp[clamp(Math.round(t * (ramp.length - 1) + (bayer4(X, Y) - 0.5) * 0.4), 0, ramp.length - 1)]!;
  });
}

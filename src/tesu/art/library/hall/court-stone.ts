// The Prize Court's stonework, side-on (the hall loop, round 2, W2-10 / W2-11).
//
// - The podium (court.floor's band): round 1 drew the arena's floor as a pale top receding to the
//   stands with diagonal shadows across it, a 3D top in a side-on game. The arena's floor is now a
//   line (the walk line, seen edge-on) and the band behind it is the podium the stands are built on,
//   seen face-on: big cool blocks in the morning haze, a coping with a lit top, pilasters rising past
//   it, an arched way in under the stands, a base course at its foot. What stands on the walk line
//   throws its shadow onto this face, right and a little down (court-light.ts).
// - The foundation under the walk line (court.foundation): chunks, never a tile (Dex's terrain note):
//   courses of very different heights, big quoins at the ends and at the stair's mouth, patched and
//   re-set blocks, drains with uneven stains under them and moss where their water runs, the cliff's
//   rock rising into the lowest courses; the frieze broken into weathered panels of different lengths.
//
// Daylight from the upper left (COURT_LIGHT): lit faces up and left, shadows down and right.

import type { PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { M, clamp, face, fbm, hash, mt, rect, tn, vnoise, type Ramp } from "./kit.ts";

const H = 96;
const SIDE = -1;

/** The podium's stone, a step into the morning's air: cooler and paler than the foundation in front. */
const HAZE_STONE: Ramp = [P.karst[0]!, P.karst[1]!, P.karst[2]!, P.karst[3]!, P.karst[4]!, P.karst[5]!, P.karst[6]!];

/** A row of jittered joints: which block a point lies in, and how far into it. */
export function blockAt(lx: number, bw: number, off: number, seed: number, jit = 0.5): { j: number; inX: number; w: number } {
  const jj = (j: number): number => (hash(j, 3, seed) - 0.5) * bw * jit;
  let j = Math.floor((lx - off) / bw);
  if (lx < off + j * bw + jj(j)) j--;
  else if (lx >= off + (j + 1) * bw + jj(j + 1)) j++;
  const a = off + j * bw + jj(j), b = off + (j + 1) * bw + jj(j + 1);
  return { j, inX: lx - a, w: b - a };
}

export interface PodiumP {
  w: number;
  /** The band's height above the walk line (px): the podium's coping sits there. */
  below: number;
}

/** Where the podium's pilasters stand (local x), irregularly spaced, and which carry a lantern. */
export function podiumPilasters(w: number): { x: number; lamp: boolean }[] {
  // the corner piers at both ends (no straight cut-off where the podium stops), and between them
  // pilasters at an uneven pitch
  const out: { x: number; lamp: boolean }[] = [{ x: 0.12 * H, lamp: false }];
  for (let x = 1.1 * H, i = 0; x < w - 1.0 * H; i++) {
    out.push({ x, lamp: hash(i, 5, 211) < 0.45 });
    x += (2.2 + 1.9 * hash(i, 1, 211)) * H;
  }
  out.push({ x: w - 0.12 * H, lamp: true });
  return out;
}

export function paintPodium(c: PaintCtx, p: PodiumP): void {
  const B = p.below;
  const COPE = 8, BASE = Math.round(0.17 * H);
  const pils = podiumPilasters(p.w);
  const PW = 0.2 * H;
  // the arched way in under the stands: one, toward the court's east, off the ring
  const archX = p.w * 0.83, archW = 0.42 * H, archH = Math.min(B - COPE - 6, 0.82 * H);
  // courses: the face between the coping and the base course in rows of different heights
  const rows: [number, number][] = [];
  {
    const top = -B + COPE, bot = -BASE;
    let y = top;
    for (let k = 0; y < bot - 6; k++) {
      const hh = Math.round((0.2 + 0.2 * hash(k, 1, 223)) * H);
      rows.push([y, Math.min(bot, y + hh)]);
      y += hh;
    }
    if (rows.length && rows[rows.length - 1]![1] < bot) rows[rows.length - 1]![1] = bot;
  }
  const inArch = (lx: number, ly: number): boolean => {
    const dx = Math.abs(lx - archX);
    if (dx > archW) return false;
    const spring = -archH + archW;
    return ly > spring || Math.hypot(dx, ly - spring) < archW;
  };
  rect(c, 0, -B, p.w, 0, (X, Y, lx, ly) => {
    // the light along the face is never even: a slow swell, stronger toward the sun's side
    const along = 0.06 * (vnoise(lx / (3.1 * H), 2, 227) - 0.5);
    // --- the coping: a lit top, a rounded nose, the overhang's ragged shadow under it
    if (ly < -B + COPE) {
      const v = ly + B;
      if (v < 1.5) return mt(HAZE_STONE, 1.08, X, Y, 0.0, 1);
      if (v < 4) return mt(HAZE_STONE, face(0.95, SIDE, 0, -0.5) * 0.9 + along, X, Y, 0.0, 1, 0.3);
      return mt(HAZE_STONE, face(0.95, SIDE, 0, 0.6) * 0.84 + along - (fbm(lx * 0.1, 1, 229, 2) > 0.7 ? 0.05 : 0), X, Y, 0.0, 1, 0.3);
    }
    const under = ly < -B + COPE + 2 + 2 * vnoise(lx * 0.08, 3, 231);
    // --- the arched way in: a dark passage under the stands, a lit voussoir rim, a red curtain half drawn
    if (inArch(lx, ly)) {
      const dx = lx - archX, spring = -archH + archW;
      const r = ly < spring ? Math.hypot(dx, ly - spring) : Math.abs(dx);
      if (r > archW - 5) {
        // the rim: a reveal, lit on its left (the far side of the opening takes the sun)
        const lit = dx > 0 ? 0.62 : 0.4;
        return mt(HAZE_STONE, lit + along, X, Y, 0.1, 1, 0.3);
      }
      const curtain = dx < -archW * 0.15 && ly < spring + archW * 0.5 + Math.sin(dx * 0.4) * 2;
      if (curtain) {
        const fold = Math.sin(dx * 0.55) > 0.3 ? 0.08 : 0;
        return mt(M.verm, 0.55 + fold - (ly - (spring - archW)) / (archH * 3), X, Y, 0.15, 1, 0.3);
      }
      // the passage: the dark falls off into the stands, its floor a little lit
      const depth = clamp((ly - (spring - archW)) / archH, 0, 1);
      return tn(P.tile, clamp(0.62 + (1 - depth) * 0.2 - (ly > -6 ? 0.12 : 0), 0, 1), X, Y, 0.3);
    }
    // --- the pilasters: a shaft standing proud of the face, lit on its left, its shadow on the right
    for (const pl of pils) {
      const dx = lx - pl.x;
      if (dx > -PW / 2 && dx < PW / 2) {
        if (ly > -BASE) break; // the base course runs on under it
        const edge = dx < -PW / 2 + 2.5 ? -0.8 : dx > PW / 2 - 2.5 ? 0.8 : 0;
        const panel = Math.abs(dx) < PW / 2 - 6 && ly > -B + COPE + 14 && ly < -BASE - 10;
        const pr = panel && (Math.abs(Math.abs(dx) - (PW / 2 - 6)) < 1.2 || Math.abs(ly + BASE + 10) < 1.2 || Math.abs(ly + B - COPE - 14) < 1.2);
        return mt(HAZE_STONE, face(0.95, SIDE, edge, 0) * (pr ? 0.72 : 0.84) + along, X, Y, 0.0, 1, 0.3);
      }
      if (dx >= PW / 2 && dx < PW / 2 + 5 && ly < -BASE && !under) return mt(HAZE_STONE, 0.52 + along, X, Y, 0.1, 1, 0.3);
    }
    if (under) return mt(HAZE_STONE, 0.5 + along, X, Y, 0.1, 1, 0.3);
    // --- the base course: a projecting plinth, its top lit, its foot damp, the floor's contact line
    if (ly > -BASE) {
      const v = ly + BASE;
      if (v < 2) return mt(HAZE_STONE, 0.92, X, Y, 0.0, 1);
      if (ly > -2.5) return mt(HAZE_STONE, 0.3, X, Y, 0.2, 1);
      const blk = blockAt(lx, 1.3 * H, 37, 233, 0.6);
      if (blk.inX < 1.4) return mt(HAZE_STONE, 0.45, X, Y, 0.1, 1);
      const damp = clamp((v - BASE * 0.55) / (BASE * 0.45), 0, 1) * (0.06 + 0.08 * fbm(lx * 0.05, 2, 235, 2));
      if (ly > -6 && fbm(lx * 0.09, ly * 0.2, 237, 2) > 0.7) return tn(P.moss, 0.55, X, Y, 0.3);
      return mt(HAZE_STONE, face(0.95, SIDE, blk.inX < 3 ? -0.7 : 0, 0) * 0.68 - damp + along, X, Y, 0.0, 1, 0.3);
    }
    // --- the face: courses of different heights, blocks of different lengths, each its own stone
    let ri = 0;
    while (ri + 1 < rows.length && ly >= rows[ri]![1]) ri++;
    const [r0, r1] = rows[ri]!;
    const tall = r1 - r0 > 0.32 * H;
    const blk = blockAt(lx, (tall ? 1.2 : 0.75) * H + 0.3 * H * hash(ri, 2, 239), (ri % 2) * 0.43 * H, 241 + ri * 13, 0.7);
    const inY = ly - r0;
    if (blk.inX < 1.3 || inY < 1.3) return mt(HAZE_STONE, 0.5 + along, X, Y, 0.1, 1, 0.3);
    const tone = (hash(blk.j, ri, 243) - 0.5) * 0.09;
    const edge = inY < 2.4 ? 0.1 : blk.inX < 2.4 ? 0.06 : blk.w - blk.inX < 2 ? -0.06 : r1 - ly < 2 ? -0.06 : 0;
    // weather: faint streaks run down from the coping where water has, never evenly
    const sv = vnoise(lx * 0.12, 5, 245);
    const streak = sv > 0.7 && ly + B < (0.35 + 0.6 * vnoise(lx * 0.03, 6, 247)) * B ? -0.05 : 0;
    const pit = fbm(lx * 0.25, ly * 0.25, 249, 2) > 0.76 ? -0.04 : 0;
    return mt(HAZE_STONE, 0.72 + tone + edge + streak + pit + along, X, Y, 0.0, 1, 0.3);
  });
  // the pilasters' caps over the coping: a square cap and, on some, a small stone lantern
  for (const pl of pils) {
    const top = -B - 0.1 * H;
    rect(c, pl.x - PW / 2 - 3, top, pl.x + PW / 2 + 3, -B + 2, (X, Y, lx, ly) => {
      const dx = lx - pl.x;
      if (ly < top + 2) return mt(HAZE_STONE, 1.05, X, Y, 0.0, 1);
      return mt(HAZE_STONE, face(0.95, SIDE, dx < -PW / 2 ? -0.8 : dx > PW / 2 ? 0.8 : 0, ly > -B ? 0.7 : 0) * 0.95, X, Y, 0.0, 1, 0.3);
    });
    if (!pl.lamp) continue;
    const lt = top - 0.34 * H;
    rect(c, pl.x - 0.11 * H, lt, pl.x + 0.11 * H, top, (X, Y, lx, ly) => {
      const u = (lx - pl.x) / (0.11 * H), v = (ly - lt) / (0.34 * H);
      if (v < 0.22) {
        // a little pyramid roof
        return Math.abs(u) < 0.45 + v * 2.6 ? mt(HAZE_STONE, face(0.95, SIDE, u, -0.6) * 0.9, X, Y, 0.0, 1, 0.3) : 0;
      }
      if (v > 0.82) return Math.abs(u) < 0.7 ? mt(HAZE_STONE, face(0.95, SIDE, u, 0) * 0.92, X, Y, 0.0, 1, 0.3) : 0;
      if (Math.abs(u) > 0.78) return 0;
      // the light box: a paper window between two stone posts
      if (Math.abs(u) < 0.45 && v > 0.32 && v < 0.74) return tn(P.paper, 0.2 + Math.abs(u) * 0.5, X, Y, 0.3);
      return mt(HAZE_STONE, face(0.95, SIDE, u, 0) * 0.86, X, Y, 0.0, 1, 0.3);
    });
  }
}

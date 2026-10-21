// The Hall of Works' play-plane structure: the raised timber walkway the whole floor runs
// along (its lacquered edge is the walk line) over the darker stone floor nearer us; the
// massive end walls with the door walls built into them; the Long Gallery's floor beam on its
// posts and brackets, with its vermilion balustrade (front plane, she walks behind it). (The
// stair down to the nook is stair.ts.) Everything takes the hall's light from
// lights.ts. (The central pillar that carried the rolled map is gone: the map of Tesu stands
// on its own stand beside the gate now, services.ts.)

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL, HALL_LIGHT, SHAFT } from "./lights.ts";
import { shaftCore } from "./hall-light.ts";
import { iceBar, iceRay } from "./bay.ts";
import { bayer4 } from "../../raster.ts";
import { M, SCREEN, LitField, clamp, colBase, colLight, cyl, face, fbm, grain, hash, keep, lathe, lum, mt, poly, rect, tn, vnoise, type At } from "./kit.ts";
import { cloudScroll, plumCrest } from "./signs.ts";
import { ruyi } from "./roof.ts";

const H = 96;

// ---------------------------------------------------------------------------
// The walkway's edge and the floor nearer us
// ---------------------------------------------------------------------------
export interface FloorP {
  /** Length (px); the anchor is its west end on the walk line. */
  w: number;
  /** How far down it runs (px). */
  below: number;
  /** Gold caps along the edge (local x). */
  caps: number[];
  /** Lights doubled in the polished floor: [local x, half width, strength]. */
  refl?: [number, number, number][];
  at?: At;
}

export const hallFloor = definePainter<FloorP>("hall.floor", {
  bounds(p) {
    return [0, -2, p.w, p.below];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const NOSE = 12, FACE = 44;
    rect(c, 0, -1, p.w, p.below, (X, Y, lx, ly) => {
      const l = lf.get(lx, Math.min(ly, 0) - 20);
      if (ly < NOSE) {
        // the lacquered edge beam: a lit lip where the light grazes it, scuffed
        const cap = p.caps.some((cx) => Math.abs(lx - cx) < 9);
        if (cap) return mt(M.gold, lum(l, 0, ly < 3 ? -0.9 : 0) * 1.1 - (ly > 9 ? 0.3 : 0), X, Y, 0.05, 1);
        if (ly < 2) return mt(M.wood, lum(l, 0, -1) * 1.25, X, Y, 0.0, 1);
        const scuff = vnoise(lx * 0.15, ly * 0.6, 5) > 0.7 ? 0.12 : 0;
        return mt(M.lacq, lum(l) * 0.75 + scuff - (ly > 9 ? 0.2 : 0), X, Y, 0.05, 1);
      }
      if (ly < FACE) {
        // the walkway's face: panels with a gold-line inset, in the shadow of the lip; (hall loop
        // round 1) the inlay worn away in places and broken where feet and furniture stand on it
        // (round 3, W2-6: one gold dash-and-bracket repeated across the whole width) panels of three lengths in an
        // uneven run, each its own: a gold-line inset, a carved cloud boss between two plain fields, a brass plate
        // with its rivets, a plain lacquer field with only a gold bead
        const pi = panelAt(lx);
        const u = lx - pi.x0, pw = pi.w;
        const inPanel = u > 8 && u < pw - 8 && ly > NOSE + 6 && ly < FACE - 6;
        // (round 4, W2-c: the inlay's wear was a 7 px hash that cut every gold line into even dashes) the inlay is lost
        // in broad runs where feet and furniture have worn it, chipped at a few points; each board a tone of its own,
        // a dark seam where two boards butt (one of them standing a hair proud: a lit arris on its end)
        const worn = fbm(lx * 0.018, 3.7, 41, 2) > 0.6;
        const chip = hash(Math.floor(lx / 3), Math.floor(ly / 3), 43) > 0.985;
        const tone = (hash(Math.floor(pi.x0), 9, 47) - 0.5) * 0.1;
        const scuff = ly > FACE - 6 && fbm(lx * 0.08, ly * 0.3, 45, 2) > 0.62 ? 0.08 : 0;
        const shadow = ly < NOSE + 5 ? 0.25 : 0;
        if (!inPanel) {
          const seam = u < 1.2 ? -0.18 : u < 2.2 && hash(Math.floor(pi.x0), 3, 47) < 0.5 ? 0.1 : pw - u < 1.6 ? -0.08 : 0;
          return mt(M.wood, lum(l) * 0.45 - shadow + seam + tone + scuff, X, Y, 0.35, 1);
        }
        const pv = (ly - NOSE - 6) / (FACE - NOSE - 12), mu = u - pw / 2;
        if (pi.style === 0) {
          const line = !worn && !chip && (Math.abs(u - 12) < 1 || Math.abs(u - (pw - 12)) < 1 || Math.abs(ly - NOSE - 10) < 0.7 || Math.abs(ly - FACE + 10) < 0.7);
          if (line) return mt(M.gold, lum(l) * 0.5 - shadow, X, Y, 0.3, 1);
        } else if (pi.style === 1) {
          // a carved plate: a run of ruyi clouds cut in relief in the lacquer, only their outlines once gilt (the gilt
          // mostly worn off)
          const rv = ruyi(u + pi.x0 * 0.37, (pv - 0.5) * (FACE - NOSE - 12), (FACE - NOSE - 12) * 0.5, 4711 + Math.floor(pi.x0));
          if (rv === 2) return !worn && !chip ? mt(M.gold, lum(l, 0, -0.4) * 0.48 - shadow, X, Y, 0.3, 1) : mt(M.lacq, lum(l) * 0.85 - shadow, X, Y, 0.1, 1);
          if (rv === 1) return mt(M.lacq, lum(l, 0, pv < 0.5 ? -0.5 : 0.3) * 0.78 - shadow + tone, X, Y, 0.1, 1);
          return mt(M.lacq, lum(l) * 0.4 - shadow + tone, X, Y, 0.15, 1);
        } else if (pi.style === 2) {
          const e = Math.min(0.34 * pw - Math.abs(mu), (0.36 - Math.abs(pv - 0.5)) * 24);
          if (e > 0) {
            const rivet = e > 1.5 && e < 3.5 && (Math.abs(Math.abs(mu) - (0.34 * pw - 2.5)) < 1 ) && Math.abs(Math.abs(pv - 0.5) - 0.2) < 0.06;
            if (rivet) return mt(M.gold, lum(l) * 0.95, X, Y, 0.0, 1);
            const verd = fbm(lx * 0.09, ly * 0.2, 49, 2) > 0.66 ? -0.12 : 0;
            return mt(M.bronze, lum(l, 0, e < 1.2 ? -0.6 : 0) * 0.5 - shadow + verd + grain(lx, ly, 7, false) * 0.06, X, Y, 0.2, 1);
          }
        } else if (Math.abs(pv - 0.5) < 0.05 && !worn && !chip) return mt(M.gold, lum(l) * 0.38 - shadow, X, Y, 0.35, 1);
        return mt(M.lacq, lum(l) * 0.55 - shadow + tone + scuff + grain(lx, ly, 3, false) * 0.08, X, Y, 0.1, 1);
      }
      // the stone floor nearer us: big flags in courses, their joints opening out toward the
      // camera, the whole floor darkening toward us (the lights are behind)
      const depth = (ly - FACE) / H;
      const row = Math.floor(Math.sqrt(depth * 9));
      const rowTop = (row * row) / 9;
      const fw = (1.6 + row * 0.5) * H;
      const off = (row % 2) * fw * 0.5 + hash(row, 1, 17) * fw * 0.3;
      const joint = depth - rowTop < 0.025 + row * 0.006 || (((lx + off) % fw) + fw) % fw < 1.2 + row * 0.4;
      const lf2 = lf.get(lx, -20);
      // (round 4, W2-c: the gate's smear read as a lit glass cup, brighter than the desk, and the lamps' as a row of
      // evenly spaced orange pegs) the lacquered stone doubles what is over it as ref 06's water does: dim vertical
      // streaks that break up and fade. The gate's day is a broken, mostly cool smear two or three steps under the
      // gate, narrowing and gone within ~0.6 H; half the lamps leave a streak (the nearer of two close together, then
      // every other one), each its own length, a few px wide, tapering and broken by the polish
      let best = 0, day = false;
      for (const r of reflOf(p.refl ?? [])) {
        if (depth > r.len) continue;
        const t = depth / r.len; // 0 at the walkway .. 1 where it is gone
        const cx = r.x + (vnoise(depth * 9, r.seed, 61) - 0.5) * (r.day ? 3 : 1.4);
        // (the day's smear narrows to nothing, its edges ragged row by row; a lamp's streak tapers to a hair)
        const w = r.day ? r.w * (1 - t) * (0.75 + 0.5 * vnoise(depth * 40, r.seed, 63)) : r.w * (1 - t * 0.6);
        const d = Math.abs(lx - cx) / Math.max(0.8, w);
        if (d >= 1) continue;
        // broken by the polish: gaps across it, more of them further down
        const brk = vnoise(depth * (r.day ? 16 : 22), r.seed, 67);
        if (brk < (r.day ? 0.2 + 0.4 * t : 0.1 + 0.3 * t)) continue;
        const v = (1 - d * d) * r.k * (1 - t) * (1 - t * 0.4);
        if (v > best) { best = v; day = r.day; }
      }
      if (best > 0.08 && !joint) {
        // the day's smear: the court's paving at its very top, then its sky, dim and cool; the lamps' warm streaks
        const ramp = day ? (depth < 0.06 ? REFL_DAY : REFL_SKY) : REFL_WARM;
        const i = best > 0.62 ? 0 : best > 0.4 ? 1 : best > 0.22 ? 2 : 3;
        return ramp[i]!;
      }
      const gleam = vnoise(lx * 0.02, depth * 3, 9) * 0.08;
      // (round 3, W2-6) the near floor takes the room's light only dimly (the lights stand behind the walkway): no
      // pale halo round the gate's or the lamps' feet; their light lies on it as the reflections above
      // (round 4: the lamps' light on it in a narrow dither band, not a wide one: the wide band laid halftone patches)
      const lit = lum({ ...lf2, k: Math.min(lf2.k, 0.36) }) * (0.3 - depth * 0.07) + gleam - (joint ? 0.14 : 0) - (ly < FACE + 4 ? 0.2 : 0) - depth * 0.05;
      return mt(M.stone, lit, X, Y, 0.62, 1, 0.15);
    });
  },
});

/** The walkway face's panels (round 3): lengths of 1.3, 2 and 2.6 H in an uneven run, each with its own style. */
function panelAt(lx: number): { x0: number; w: number; style: number } {
  const L = [1.3 * H, 2 * H, 2.6 * H, 2 * H, 1.3 * H, 2.6 * H, 2 * H];
  const run = L.reduce((a, b) => a + b, 0);
  const k = Math.floor(lx / run), r = lx - k * run;
  let x = 0;
  for (let i = 0; i < L.length; i++) {
    // (round 4: a carved plate in about one panel in four, a brass plate in one in five, the rest inlaid or plain)
    if (r < x + L[i]!) { const q = hash(k * 7 + i, 5, 47); return { x0: k * run + x, w: L[i]!, style: q < 0.26 ? 1 : q < 0.46 ? 2 : q < 0.75 ? 0 : 3 }; }
    x += L[i]!;
  }
  return { x0: k * run, w: L[0]!, style: 0 };
}

/** The polish's reflections: of the lanterns and lamps (warm), of the daylight (round 4: two or three steps under the
 *  gate, mostly cool: the court's paving only at the very top). */
const REFL_WARM = [P.ember[3]!, P.ember[4]!, P.umber[0]!, P.umber[1]!] as const;
const REFL_DAY = [P.stone[4]!, P.stone[5]!, P.umber[1]!, P.umber[2]!] as const;
const REFL_SKY = [P.range[6]!, P.tile[2]!, P.tile[3]!, P.dusk[1]!] as const;

interface Refl { x: number; w: number; k: number; len: number; day: boolean; seed: number }
const REFLS = new WeakMap<readonly [number, number, number][], Refl[]>();
/** The reflections to draw (round 4, W2-c): the gate's day (strength >= 0.5) as one broken smear; the lamps thinned to
 *  half (of two within 0.7 H the stronger, then every other one along the floor), each a narrow streak of its own
 *  length (0.3 to 0.85 H down the polish). */
function reflOf(list: readonly [number, number, number][]): Refl[] {
  const hit = REFLS.get(list);
  if (hit) return hit;
  const out: Refl[] = [];
  const lamps = list.filter((r) => r[2] < 0.5).slice().sort((a, b) => a[0] - b[0]);
  const merged: [number, number, number][] = [];
  for (const r of lamps) {
    const q = merged[merged.length - 1];
    if (q && r[0] - q[0] < 0.7 * H) { if (r[2] > q[2]) merged[merged.length - 1] = r; }
    else merged.push(r);
  }
  merged.forEach((r, i) => {
    if (i % 2 === 1) return;
    const sd = Math.round(r[0]);
    out.push({ x: r[0], w: Math.max(1.6, Math.min(3.2, r[1] * 0.05)), k: Math.min(0.75, 0.32 + r[2] * 2.2), len: 0.3 + 0.55 * hash(sd, 1, 71), day: false, seed: sd % 997 });
  });
  for (const r of list.filter((q) => q[2] >= 0.5)) {
    out.push({ x: r[0], w: r[1] * 0.11, k: 0.62, len: 0.64, day: true, seed: Math.round(r[0]) % 997 });
  }
  REFLS.set(list, out);
  return out;
}

// ---------------------------------------------------------------------------
// The end walls: a door wall right behind the walk line, built into the room's thick end
// ---------------------------------------------------------------------------
export interface EndWallP {
  /** -1: the west end (front doors), 1: the east end (great doors). */
  side: -1 | 1;
  /** The room's end (local x 0 is the end wall line); the door wall runs from the end inward `wall` px. */
  wall: number;
  /** The doors: local x of their near jamb (from the end) and width, height (px). */
  doorAt: number;
  doorW: number;
  doorH: number;
  /** How tall the door wall stands (px) and how far out the end's mass runs (px). */
  top: number;
  out: number;
  /** Daylight behind the doors (0..1). */
  day: number;
  great?: boolean;
  at?: At;
}

/** The transom's paper in the day outside, a step under the window over it (round 3: no orange). */
const TRANSOM = [P.paper[2]!, P.paper[3]!, P.paper[4]!, P.stone[4]!, P.stone[5]!, P.umber[2]!];

/** Lime plaster on the end wall in the room's light (round 3). */
const PLASTER_W = [P.stone[3]!, P.stone[4]!, P.stone[5]!, P.umber[1]!, P.umber[2]!, P.umber[3]!, P.umber[4]!];

/** The end's outer wall's windows: [panel beyond the end, first beam bay, last beam bay] (round 3). */
const WINDOWS: [number, number, number][] = [[0, 1, 1], [1, 3, 3], [2, 1, 1]];

export const endWall = definePainter<EndWallP>("hall.endwall", {
  bounds(p) {
    const a = p.side < 0 ? -p.out : -p.wall - 40;
    const b = p.side < 0 ? p.wall + 40 : p.out;
    return [a, -20 * H, b, 6 * H];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const s = p.side;
    // local x measured from the end wall line, positive into the room
    const inx = (lx: number): number => lx * -s;
    // the end's shell, running out to the frame's edge in the entrance shot (round 1, L10: no black void
    // past the end walls): a timber-framed wall in the cool dark, a tall lattice window with the day
    // behind its paper, a second one up by the gallery, a long banner hanging between them
    rect(c, s < 0 ? -p.out : 0, -20 * H, s < 0 ? 0 : p.out, 6 * H, (X, Y, lx, ly) => {
      const d = -inx(lx); // distance beyond the end, px
      const l = lf.get(s < 0 ? -10 : 10, Math.min(ly, -20));
      const up = -ly / H;
      if (ly > 0) return tn(M.dark, 0.88, X, Y, 0.4);
      const fade = clamp(1 - (d - 3.6 * H) / (3 * H), 0.25, 1);
      // (round 3, W2-8: a navy void with tall windows floating in it, the frames past both ends) the hall's own
      // outer wall at a dim value: timber posts every 2.4 H, each with a bracket block under every beam, beams every
      // 3.1 H, plaster panels between them each a little different, a stone plinth; lattice windows set in the
      // panels (an ice-ray lattice, a sill board under each, the cool day behind), the room's lamplight catching the
      // posts' faces turned to it
      const PP = 2.4 * H, PW = 0.3 * H, BH = 3.1 * H, BW = 0.24 * H;
      const pd = ((d % PP) + PP) % PP, bi = Math.floor(-ly / BH), bv = ((-ly % BH) + BH) % BH;
      const panel = Math.floor(d / PP);
      if (up < 0.55) return mt(M.stone, (lum(l) * 0.5 + (up > 0.5 ? 0.1 : 0)) * fade, X, Y, 0.35, 1);
      for (const [pn, b0, b1] of WINDOWS) {
        if (panel !== pn || bi < b0 || bi > b1) continue;
        const wx0 = pn * PP + PW + 0.3 * H, wx1 = (pn + 1) * PP - 0.3 * H;
        const wy0 = b0 * BH + BW + 0.35 * H, wy1 = (b1 + 1) * BH - 0.3 * H;
        const hy = -ly;
        if (d > wx0 - 4 && d < wx1 + 4 && hy > wy0 - 7 && hy < wy0) {
          // the sill board, its top lit by the window's day
          return hy > wy0 - 1.5 ? tn(P.tile, 0.55, X, Y, 0) : mt(M.wood, lum(l) * 0.55 * fade, X, Y, 0.3, 1);
        }
        if (d > wx0 && d < wx1 && hy > wy0 && hy < wy1) {
          const e = Math.min(d - wx0, wx1 - d, hy - wy0, wy1 - hy);
          if (e < 4) return mt(M.lacq, (lum(l) * 0.5 + (e < 1.2 ? 0.12 : 0)) * fade, X, Y, 0.2, 1);
          // (round 4, W2-a) the hall's ice-ray: even bars at T joints, a plain border, each bar's top edge lit
          if (e < 6) return mt(M.lacq, 0.42 * fade, X, Y, 0.3, 1);
          const segs = iceRay(wx1 - wx0 - 12, wy1 - wy0 - 12, 6301 + pn * 7 + b0, 0.05 * H * H);
          const bar = iceBar(segs, d - wx0 - 6, wy1 - hy - 6, 1.5);
          if (bar) return bar === 1 ? mt(M.wood, (0.5 + lum(l) * 0.3) * fade, X, Y, 0.55, 1, 0) : bar === 2 ? P.umber[4]! : P.umber[5]!;
          const v = (wy1 - hy) / (wy1 - wy0);
          return tn(P.tile, clamp(0.32 + v * 0.3 + Math.abs((d - wx0) / (wx1 - wx0) - 0.5) * 0.35, 0, 1), X, Y, 0.5);
        }
      }
      const post = pd < PW && d > 0.4 * H;
      const beam = bv < BW;
      if (post) {
        // the post's face turned to the room catches the lamplight leaking past the end; a bracket block where
        // each beam meets it
        const toRoom = (PW - pd) / PW;
        const block = bv > BW && bv < BW + 0.28 * H && pd > -0.06 * H;
        return mt(M.wood, (lum(l) * (0.48 + toRoom * 0.3) + 0.1 + (block ? 0.1 : 0) + (pd < 2 ? 0.14 : 0) + grain(lx, ly, 41) * 0.1) * fade, X, Y, 0.35, 1);
      }
      if (beam) {
        const blk = pd > PW && pd < PW + 0.22 * H || pd > PP - 0.22 * H;
        return mt(M.wood, (lum(l) * 0.5 + 0.08 + (bv < 2 ? 0.16 : 0) + (blk ? 0.08 : 0)) * fade, X, Y, 0.35, 1);
      }
      // the bracket blocks under the beam either side of each post
      if (bv < BW + 0.2 * H && (pd > PW && pd < PW + 0.18 * H || pd > PP - 0.18 * H)) return mt(M.wood, (lum(l) * 0.4) * fade, X, Y, 0.35, 1);
      // the plaster: each panel its own tone, a recess shadow under the beam over it, damp low down
      const pt = (hash(panel, bi, 43) - 0.5) * 0.1;
      const recess = bv < BW + 4 ? -0.08 : 0;
      const plaster = fbm(lx * 0.05, ly * 0.05, 31, 3);
      return mt(M.dark, (lum(l) * 0.6 + 0.16 + pt + recess) * fade + (plaster - 0.5) * 0.1, X, Y, 0.35, 1);
    });
    // the corner column at the room's end: vermilion, lit by the doors' daylight
    const colR = 0.3 * H;
    const ccx = -s * colR * 0.6;
    const { k: ck, side: cside } = colLight(lf, ccx, -8 * H, 0);
    colBase(c, ccx, colR, 0.9 * H, ck, cside, 13);
    lathe(c, ccx, -20 * H, 0, () => colR, (X, Y, u, _lx, ly) => {
      const hgt = -ly / H;
      let n = cyl(ck, u, cside, 0.1) - clamp((hgt - 6) / 14, 0, 1) * 0.15;
      if (hgt < 0.9) return 0;
      // (integration, round 2: high up the column sank into the end's dark with the shell, so in hall-wide the back
      // wall met the dark on a ruled line from the tie beam down) its edge turned to the room keeps the room's
      // lamplight all the way up, so the room ends on a column's lit edge, not a cut
      const toRoom = u * -s;
      if (toRoom > 0.1) n = Math.max(n, (0.3 + ((toRoom - 0.1) / 0.9) ** 1.5 * 0.42) * (0.85 + clamp((hgt - 7) / 6, 0, 1) * 0.3));
      const band = (hgt > 1.0 && hgt < 1.2) || (hgt > 6.6 && hgt < 6.8);
      return band ? mt(M.gold, n * 0.9, X, Y, 0.2, 1) : mt(M.verm, n * 0.75, X, Y, 0.25, 1);
    });
    // (round 3, W2-8: a ruled vertical edge where the room ends) the column's mouldings stand proud of its line: a
    // banded collar at the gallery's floor, another at the wall plate, and a bracket capital (a bearing block and
    // two tiers of arms, the inner one reaching into the room) under the tie beam
    for (const [hg, hh, wide] of [[7.15, 0.2, 0.32], [10.55, 0.16, 0.26], [3.4, 0.12, 0.2]] as const) {
      rect(c, ccx - colR - wide * H * 0.5, -(hg + hh) * H, ccx + colR + wide * H * 0.5, -hg * H, (X, Y, lx, ly) => {
        const v = (-ly - hg * H) / (hh * H); // 0 at its foot .. 1 at its top
        const u = (lx - ccx) / (colR + wide * H * 0.5);
        const l = lf.get(lx, ly);
        if (v > 0.8 || v < 0.15) return mt(M.gold, lum(l, u * 0.6, v > 0.8 ? -0.7 : 0.5) * 0.85 + 0.1, X, Y, 0.1, 1);
        return mt(M.lacq, lum(l, u * 0.6, 0) * 0.5 + 0.12 + (Math.abs(u) > 0.92 ? -0.1 : 0), X, Y, 0.2, 1);
      });
    }
    {
      const cap0 = 15.5 * H, tiers: [number, number][] = [[0.22, 0.42], [0.2, 0.78], [0.18, 1.12]];
      let y = cap0;
      for (const [th, hw] of tiers) {
        const yy = y;
        rect(c, ccx - hw * H, -yy - th * H, ccx + hw * H, -yy, (X, Y, lx, ly) => {
          const u = (lx - ccx) / (hw * H), v = (-ly - yy) / (th * H);
          const l = lf.get(lx, ly);
          // the arms' ends cut in a curve, gold-tipped; the blocks teal over the lacquer; the room side lit
          if (Math.abs(u) > 0.86) return v > 0.35 ? mt(M.gold, lum(l, u, -0.4) * 0.8 + (u * -s > 0 ? 0.12 : 0), X, Y, 0.1, 1) : 0;
          if (v < 0.18) return mt(M.lacq, 0.12, X, Y, 0.3, 1);
          const block = Math.abs(u) < 0.22 || Math.abs(Math.abs(u) - 0.62) < 0.12;
          return block ? tn(P.jade, clamp(0.72 - (u * -s > 0 ? 0.12 : 0), 0, 1), X, Y, 0) : mt(M.wood, lum(l, u * 0.5, 0) * 0.55 + (u * -s > 0 ? 0.1 : 0), X, Y, 0.3, 1);
        });
        y += th * H;
      }
    }
    // the door wall: lacquer panels framed in timber, the doors set deep in it
    const dx0 = Math.min(inx(p.doorAt), inx(p.doorAt + p.doorW)) * 1, dx1 = Math.max(inx(p.doorAt), inx(p.doorAt + p.doorW));
    const w0 = Math.min(0, -s * p.wall), w1 = Math.max(0, -s * p.wall);
    const surround = 0.38 * H;
    // (hall loop round 2, W2-9: the east end's wall was a flat brown grid, its west edge a straight seam against
    // the back wall) where no door is built in, the end is a screen wall with its own corner post
    if (p.doorW <= 0) {
      screenWall(c, w0, w1, p.top, s, lf);
      return;
    }
    // (round 3, W2-8: above the doors the wall was a dark grid of boards, L 25) the wall over the doors composed like
    // the rest of the room: lacquer panels beside the doors, then plaster between timber posts and a beam, a carved
    // board over the transom, a high lattice window with the day behind it, a pair of silk banners either side of it
    const dcx = (dx0 + dx1) / 2;
    const BOARD0 = p.doorH + surround * 1.4 + 0.62 * H + 0.08 * H, BOARD1 = BOARD0 + 0.55 * H;
    const WIN0 = BOARD1 + 0.45 * H, WIN1 = Math.min(p.top - 0.7 * H, WIN0 + 1.75 * H), WINW = 0.42 * H;
    const BEAM0 = p.top - 0.42 * H;
    rect(c, w0, -p.top, w1, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const inDoor = p.doorW > 0 && lx > dx0 - surround && lx < dx1 + surround && ly > -p.doorH - surround * 1.4;
      if (inDoor) return 0;
      const up = -ly;
      const skirt = ly > -0.45 * H;
      if (skirt) return mt(M.stone, lum(l) * (ly < -0.42 * H ? 1.2 : 0.75), X, Y, 0.25, 1);
      const edge = Math.min(lx - w0, w1 - lx);
      // the posts at the wall's two edges and the beam under its top
      if (edge < 0.2 * H) return mt(M.wood, lum(l, edge < 0.06 * H ? (lx - w0 < w1 - lx ? -0.6 : 0.6) : 0, 0) * 0.78 + grain(lx, ly, 51) * 0.1, X, Y, 0.25, 1);
      if (up > BEAM0) return mt(M.wood, lum(l, 0, up < BEAM0 + 2 ? 0.8 : up > p.top - 2 ? -0.8 : 0) * 0.72 + grain(lx, ly, 53, false) * 0.08, X, Y, 0.25, 1);
      if (up < BOARD0 - 0.04 * H) {
        // lacquer panels beside the doors, as before
        const pu = ((lx % (0.95 * H)) + 0.95 * H) % (0.95 * H), pv = ((ly % (1.25 * H)) + 1.25 * H) % (1.25 * H);
        const frame = pu < 0.1 * H || pv < 0.1 * H;
        if (frame) return mt(M.wood, lum(l, pu < 0.05 * H ? -0.6 : 0, pv < 0.05 * H ? -0.6 : 0) * 0.8, X, Y, 0.25, 1);
        return mt(M.lacq, lum(l) * 0.8 + grain(lx, ly, 13) * 0.1, X, Y, 0.1, 1);
      }
      // a rail at the boards' foot, then plaster
      if (up < BOARD0) return mt(M.wood, lum(l, 0, -0.7) * 0.8, X, Y, 0.25, 1);
      const pt = fbm(lx * 0.03, ly * 0.03, 55, 2) - 0.5;
      const recess = up > BEAM0 - 4 ? -0.1 : 0;
      return mt(PLASTER_W, lum(l) * 0.62 + 0.1 + pt * 0.1 + recess, X, Y, 0.0, 1, 0.25);
    });
    // the carved board over the transom: black lacquer, a gold bead, clouds carved and gilded along it, a plum crest
    // in its middle
    {
      const bx0 = dx0 - surround * 0.9, bx1 = dx1 + surround * 0.9;
      rect(c, bx0, -BOARD1, bx1, -BOARD0, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const e = Math.min(lx - bx0, bx1 - lx, ly + BOARD1, -BOARD0 - ly);
        if (e < 1) return mt(M.lacq, lum(l) * 0.3, X, Y, 0.3, 1);
        if (e < 3) return mt(M.gold, lum(l, 0, ly < -BOARD1 + 3 ? -0.8 : 0.4) * 0.9, X, Y, 0.1, 1);
        const u = lx - dcx, v = (ly + (BOARD0 + BOARD1) / 2);
        const cl = Math.sin(u * 0.16 + Math.sin(v * 0.2) * 1.4) * Math.cos(v * 0.16) > 0.42 && Math.abs(u) > 0.22 * H;
        if (cl) return mt(M.gold, lum(l, 0, v < 0 ? -0.5 : 0.3) * 0.72, X, Y, 0.2, 1);
        return mt(M.lacq, lum(l) * 0.38 + grain(lx, ly, 57, false) * 0.06, X, Y, 0.3, 1);
      });
      const g = (k: number) => (X: number, Y: number, lx: number, ly: number) => mt(M.gold, lum(lf.get(lx, ly)) * k, X, Y, 0.05, 1);
      plumCrest(c, Math.round(dcx), Math.round(-(BOARD0 + BOARD1) / 2), Math.round(0.2 * H), g(1.0), (X, Y) => mt(M.lacq, 0.25, X, Y, 0.1, 1), g(1.2));
    }
    // the high window: a lacquer frame, a sill board, an ice-ray lattice with the day behind, brighter low
    {
      const x0 = dcx - WINW, x1 = dcx + WINW;
      const segs = iceRay(x1 - x0 - 12, WIN1 - WIN0 - 12, 6411, 0.05 * H * H);
      rect(c, x0 - 5, -WIN1, x1 + 5, -WIN0 + 7, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const up = -ly;
        if (up < WIN0) return up > WIN0 - 2 ? tn(P.tile, 0.5, X, Y, 0) : lx > x0 - 5 && lx < x1 + 5 ? mt(M.wood, lum(l) * 0.6, X, Y, 0.3, 1) : 0;
        if (lx < x0 || lx > x1) return 0;
        const e = Math.min(lx - x0, x1 - lx, up - WIN0, WIN1 - up);
        if (e < 4) return mt(M.lacq, lum(l, 0, 0) * 0.5 + (e < 1.2 ? 0.12 : 0), X, Y, 0.2, 1);
        // (round 4, W2-a) the hall's ice-ray inside a plain border, the day behind it two steps down (the gate is the
        // one bright opening)
        if (e < 6) return mt(M.lacq, 0.42, X, Y, 0.3, 1);
        const bar = iceBar(segs, lx - x0 - 6, WIN1 - 6 - up, 1.5);
        if (bar) return bar === 1 ? mt(M.wood, 0.5 + lum(l) * 0.3, X, Y, 0.55, 1, 0) : bar === 2 ? P.umber[3]! : P.umber[5]!;
        const v = (WIN1 - up) / (WIN1 - WIN0);
        return tn(P.tile, clamp(0.5 + (1 - v) * 0.12 + Math.abs((lx - dcx) / WINW) * 0.2 + v * 0.12, 0, 1), X, Y, 0.5);
      });
      // its light on the plaster under the sill
      rect(c, x0 - 0.2 * H, -WIN0 + 7, x1 + 0.2 * H, -WIN0 + 0.4 * H, (X, Y, lx, ly) => {
        const u = Math.abs(lx - dcx) / (WINW + 0.2 * H), t = (ly + WIN0 - 7) / (0.4 * H - 7);
        const v = (1 - u * u) * (1 - t);
        return v > 0.2 + bayer4(X, Y) * 0.5 ? mt(PLASTER_W, lum(lf.get(lx, ly)) * 0.62 + 0.22, X, Y, 0.0, 1, 0.25) : 0;
      });
    }
    // the banner pair either side of the window: deep red silk, a gold hem and a gold crest, on a rod
    for (const sx of [-1, 1]) {
      const bcx = dcx + sx * (WINW + 0.3 * H), bw = 0.14 * H;
      if (bcx - bw < w0 + 0.22 * H || bcx + bw > w1 - 0.22 * H) continue;
      const top = WIN1 + 0.25 * H, bot = WIN0 - 0.2 * H;
      rect(c, bcx - bw - 3, -top - 3, bcx + bw + 3, -top, (X, Y, lx, ly) => mt(M.gold, lum(lf.get(lx, ly), 0, -0.6) * 0.8, X, Y, 0.1, 1));
      rect(c, bcx - bw, -top, bcx + bw + 2, -bot, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const v = (-ly - bot) / (top - bot); // 1 at the rod .. 0 at the hem
        const sway = Math.sin((1 - v) * 2.4) * 1.5 * (1 - v);
        const u = (lx - bcx - sway) / bw;
        if (Math.abs(u) > 1) return 0;
        if (v < 0.06 && Math.abs(u) > 1 - v * 10) return 0;
        const hem = Math.abs(u) > 0.8 || (v > 0.12 && v < 0.15);
        const crest = Math.hypot(u * bw, (v - 0.7) * (top - bot)) < 0.1 * H && Math.hypot(u * bw, (v - 0.7) * (top - bot)) > 0.055 * H;
        if (hem || crest) return mt(M.gold, lum(l) * 0.8 + 0.12, X, Y, 0.3, 1);
        return mt(M.verm, lum(l) * 0.7 + 0.14 + Math.sin(u * 3.1 + 0.6) * 0.07 - (1 - v) * 0.06, X, Y, 0.3, 1);
      });
    }
    // the doorway: a stone threshold and step, carved jambs, a lintel with a plaque, the transom (the
    // east end has none since the court's gate moved to the middle, round 1)
    if (p.doorW > 0) doorway(c, p, dx0, dx1, surround, lf);
  },
});

function doorway(c: PaintCtx, p: EndWallP, dx0: number, dx1: number, sr: number, lf: LitField): void {
  const dh = p.doorH;
  const cx = (dx0 + dx1) / 2;
  // jambs: carved timber posts with gold-leaf vine, a stone pedestal each
  for (const jx of [dx0 - sr, dx1]) {
    rect(c, jx, -dh, jx + sr, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - jx) / sr;
      if (ly > -0.75 * H) {
        const top = ly < -0.7 * H;
        const carve = Math.hypot(u - 0.5, (ly + 0.35 * H) / H * 1.4) < 0.28;
        return mt(M.stone, lum(l, (u - 0.5) * 1.2, top ? -0.8 : 0) * (carve ? 0.75 : 1) + 0.05, X, Y, 0.1, 1);
      }
      const vine = u > 0.25 && u < 0.75 && Math.sin(ly * 0.25 + Math.sin(ly * 0.07) * 3) * 0.5 + 0.5 > Math.abs(u - 0.5) * 2.6;
      if (vine) return mt(M.gold, lum(l, (u - 0.5), 0) * 0.85, X, Y, 0.15, 1);
      return mt(M.wood, lum(l, (u - 0.5) * 1.4, 0) * 0.7, X, Y, 0.25, 1);
    });
  }
  // the lintel and its plaque
  const ly0 = -dh - sr * 1.4, ly1 = -dh;
  rect(c, dx0 - sr * 1.25, ly0, dx1 + sr * 1.25, ly1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const v = (ly - ly0) / (ly1 - ly0);
    if (v < 0.14) return mt(M.gold, lum(l, 0, -0.9) * 0.95, X, Y, 0.1, 1);
    const pw = (dx1 - dx0) * 0.42;
    const inPlaque = Math.abs(lx - cx) < pw / 2 && v > 0.26 && v < 0.86;
    if (inPlaque) {
      const e = Math.min(pw / 2 - Math.abs(lx - cx), (Math.min(v - 0.26, 0.86 - v)) * (ly1 - ly0));
      if (e < 3) return mt(M.gold, lum(l) * 0.95, X, Y, 0.1, 1);
      // (round 2, W1-2: no pseudo-script) the ground of the plaque; its mark is painted over it below
      return mt(M.lacq, lum(l) * 0.4, X, Y, 0.3, 1);
    }
    return mt(M.verm, lum(l) * 0.7 + (Math.sin(lx * 0.4) > 0.7 ? 0.1 : 0), X, Y, 0.3, 1);
  });
  // the plaque's mark, wordless: the hall's plum-blossom crest in a ring between two gold cloud scrolls
  {
    const pw = (dx1 - dx0) * 0.42, ph = (ly1 - ly0) * 0.6, pcy = Math.round(ly0 + (ly1 - ly0) * 0.56);
    const gold = (k: number) => (X: number, Y: number, lx: number, ly: number) => mt(M.gold, lum(lf.get(lx, ly)) * k, X, Y, 0.05, 1);
    const r = Math.max(5, Math.round(ph / 2 - 3));
    plumCrest(c, Math.round(cx), pcy, r, gold(1.1), (X, Y) => mt(M.lacq, 0.25, X, Y, 0.1, 1), gold(1.3));
    const sr = Math.max(2.5, Math.min(4, ph * 0.18)), tail = Math.max(4, pw / 2 - r - sr * 2 - 6);
    cloudScroll(c, Math.round(cx - pw / 2 + 5 + sr), pcy - 1, sr, 1, tail, gold(0.95));
    cloudScroll(c, Math.round(cx + pw / 2 - 5 - sr), pcy - 1, sr, -1, tail, gold(0.95));
  }
  // the doors themselves: studded leaves (vermilion), gold lion-head rings, daylight in the seam
  const g = p.great ? 1 : 0.85;
  // one light for the doors (their mean), a little brighter low where the daylight leaks in:
  // lacquer this big must read as one smooth surface, not a map of the lantern pools
  const dl = colLight(lf, cx, -dh, 0);
  const doorK = Math.max(0.55, dl.k);
  // (hall loop round 1) the leaves as built doors: each a frame of stiles and rails round a studded
  // upper field and a raised lower panel, its thickness showing in shadow at the jamb; the lintel's
  // shadow across their tops; studs domed (lit above-left, a shadow below-right); the lacquer worn to
  // the timber where hands push, by the seam at hand height; a real gap between the leaves with the
  // day showing through it and under them (the floor's spill is the room's light, hall-light.ts)
  const W = dx1 - dx0, leafW = W / 2;
  const stile = Math.max(5, leafW * 0.09), rail = Math.max(5, dh * 0.055);
  const lock0 = dh * 0.6, lock1 = lock0 + rail * 0.9, low1 = dh - rail * 1.6;
  const cols = 5, rows = 7;
  rect(c, dx0, -dh, dx1, 0, (X, Y, lx, ly) => {
    const v = (ly + dh) / dh, y = ly + dh;
    const l = { k: doorK * (0.86 + 0.22 * v), dx: dl.side * 0.6, dy: -0.8 };
    const li = Math.abs(lx - cx), lu = leafW - li;
    // the seam: a dark gap, the day a thin line through its middle, brightest low
    if (li < 1.3) {
      // (round 3, W2-8: a 1 px white line down the seam) the day shows only low in the gap, dim, here and there
      if (li < 0.55 && p.day > 0 && v > 0.55 && hash(Math.floor(y / 3), 1, 61) > 0.35) return tn(P.tile, clamp(0.85 - (v - 0.55) * 1.2, 0, 1), X, Y, 0);
      return tn(M.ink, 0.0, X, Y, 0);
    }
    // under the leaves: the day in a bright line along the threshold
    if (v > 0.988 && p.day > 0) return tn(M.paper, 0.2, X, Y, 0);
    // the lintel's shadow across the leaves' tops, in two steps
    const lintel = y < dh * 0.045 ? -0.26 : y < dh * 0.1 + Math.sin(lx * 0.3) * 0.6 ? -0.13 : 0;
    // the leaf's thickness at the jamb: its edge in shadow, a lit arris
    if (lu < 3.5) return lu > 2.4 ? mt(M.verm, face(l.k, dl.side) * 0.75 + lintel, X, Y, 0.25, 1) : mt(M.verm, l.k * 0.22 + lintel, X, Y, 0.4, 1);
    const side = lx < cx ? -1 : 1;
    // the frame: stiles at both sides of the leaf, a top rail, a lock rail, a bottom rail
    const inStile = lu < 3.5 + stile || li < 1.3 + stile * 0.8;
    const inRail = y < rail || (y > lock0 && y < lock1) || y > low1;
    if (inStile || inRail) {
      // the frame stands proud of the panels: its inner edges catch the light on the top-left
      const ein = Math.min(Math.abs(lu - 3.5 - stile), Math.abs(li - 1.3 - stile * 0.8), Math.abs(y - rail), Math.abs(y - lock0), Math.abs(y - lock1), Math.abs(y - low1));
      const arris = ein < 1.2 ? 0.08 : 0;
      return mt(M.verm, face(l.k, dl.side) * 0.78 + arris + lintel + grain(lx, ly, 23, !inRail) * 0.05, X, Y, 0.25, 1);
    }
    // the worn lacquer where hands push it: near the seam at hand height, the timber showing
    const handZone = Math.max(0, 1 - Math.abs(y - dh * 0.55) / (dh * 0.14)) * Math.max(0, 1 - li / (leafW * 0.42));
    if (handZone > 0 && fbm(lx * 0.12, ly * 0.12, 37, 2) < handZone * 0.75 - 0.08) return mt(M.wood, face(l.k, dl.side) * 0.7 + lintel, X, Y, 0.3, 1);
    // the lower panel: raised, its bevels lit top-left and dark bottom-right
    if (y > lock1 && y < low1) {
      const px0 = side < 0 ? dx0 + 3.5 + stile : cx + 1.3 + stile * 0.8, px1 = side < 0 ? cx - 1.3 - stile * 0.8 : dx1 - 3.5 - stile;
      const e = Math.min(lx - px0, px1 - lx, y - lock1, low1 - y);
      const bev = 4;
      if (e < bev) {
        const topLeft = Math.min(lx - px0, y - lock1) < Math.min(px1 - lx, low1 - y);
        return mt(M.verm, face(l.k, dl.side) * (topLeft ? 0.95 : 0.5) + lintel, X, Y, 0.25, 1);
      }
      return mt(M.verm, face(l.k, dl.side) * 0.74 + lintel + grain(lx, ly, 29, false) * 0.04 + (y > low1 - 8 ? -0.06 : 0), X, Y, 0.25, 1);
    }
    // the upper field: studs in rows, domed, each with a small shadow below-right
    const f0 = side < 0 ? dx0 + 3.5 + stile : cx + 1.3 + stile * 0.8, fw = leafW - 4.8 - stile * 1.8;
    const fu = (lx - f0) / fw, fv = (y - rail) / (lock0 - rail);
    const sr2 = Math.max(1.6, 0.034 * H * g);
    const gi = Math.round(fu * cols - 0.5), gj = Math.round(fv * rows - 0.5);
    const sx = f0 + ((gi + 0.5) / cols) * fw, sy = rail + ((gj + 0.5) / rows) * (lock0 - rail);
    const ddx = lx - sx, ddy = y - sy;
    if (gi >= 0 && gi < cols && gj >= 0 && gj < rows) {
      const sd = Math.hypot(ddx, ddy);
      if (sd < sr2) {
        const lit = -(ddx + ddy) / (sr2 * 1.4);
        return mt(M.gold, face(l.k, dl.side) * (0.62 + lit * 0.5) + (lit > 0.45 ? 0.15 : 0), X, Y, 0.05, 1);
      }
      if (Math.hypot(ddx - 1.3, ddy - 1.5) < sr2 && ddx > -0.5 && ddy > -0.5) return mt(M.verm, face(l.k, dl.side) * 0.45 + lintel, X, Y, 0.3, 1);
    }
    // the lion-head rings near the seam
    const rx = cx + side * leafW * 0.16, ry = dh * 0.5;
    const rd = Math.hypot(lx - rx, y - ry);
    if (rd < 0.15 * H * g && rd > 0.11 * H * g && y > ry) return mt(M.gold, face(l.k, dl.side, (lx - rx) / (0.15 * H), 0.3) * 1.0, X, Y, 0.05, 1);
    if (Math.hypot(lx - rx, y - ry + 0.04 * dh) < 0.12 * H * g) return mt(M.bronze, face(l.k, dl.side, (lx - rx) / (0.12 * H), (y - ry) / (0.12 * H)) * 1.0, X, Y, 0.1, 1);
    return mt(M.verm, face(l.k, dl.side) * 0.7 + lintel + grain(lx, ly, 17, false) * 0.04, X, Y, 0.25, 1);
  });
  // the stone threshold and a step out onto the walkway
  rect(c, dx0 - sr * 1.1, -0.14 * H, dx1 + sr * 1.1, 0, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    return mt(M.stone, lum(l, 0, ly < -0.11 * H ? -0.9 : 0) * (ly < -0.11 * H ? 1.25 : 0.85), X, Y, 0.15, 1);
  });
  // the transom over the lintel: a lattice glowing with the day outside
  const ty0 = ly0 - 0.62 * H, ty1 = ly0;
  const tseg = iceRay((dx1 - dx0 + 2 * sr) * 0.94 - 2, (ty1 - ty0) * 0.84 - 2, 6421, 0.045 * H * H);
  rect(c, dx0 - sr, ty0, dx1 + sr, ty1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const u = (lx - dx0 + sr) / (dx1 - dx0 + 2 * sr), v = (ly - ty0) / (ty1 - ty0);
    if (u < 0.03 || u > 0.97 || v < 0.08 || v > 0.92) return mt(M.wood, lum(l) * 0.8, X, Y, 0.2, 1);
    // (round 3, W2-8: a cream square fret, the brightest thing on the left half) the room's ice-ray lattice over
    // paper lit by the day outside, a step under the window above it
    // (round 4, W2-a: even bars at T joints, each with a lit top edge, inside the frame as a plain border)
    const bar = iceBar(tseg, lx - (dx0 - sr) - (dx1 - dx0 + 2 * sr) * 0.03 - 1, ly - ty0 - (ty1 - ty0) * 0.08 - 1, 1.5);
    if (bar) return bar === 1 ? mt(M.wood, 0.5 + lum(l) * 0.3, X, Y, 0.55, 1, 0) : bar === 2 ? P.umber[3]! : P.umber[5]!;
    const glow = 0.18 * p.day + 0.28 * Math.sin(u * Math.PI);
    return tn(TRANSOM, clamp(1.12 - glow, 0, 1), X, Y, 0.55);
  });
}

/**
 * The east end's screen wall (round 2, W2-9): a corner post at its edge into the room (a stone base, its face
 * toward the room lit), a lacquer dado, three paper screens lit from a lamp in the passage behind them (one slid
 * a hand's width open, light leaking at the seams between the leaves, someone's shadow on the paper), a bracket
 * shelf over them with a box, a vase and a scroll case, boarding above it darkening up into the shell with a
 * long ink scroll, a beam, and a lattice window high up with the cool day behind it.
 */
function screenWall(c: PaintCtx, w0: number, w1: number, top: number, s: number, lf: LitField): void {
  const POSTW = Math.round(0.22 * H);
  // the post stands at the edge toward the room
  const pin = s > 0 ? w0 : w1 - POSTW;
  const f0 = s > 0 ? w0 + POSTW : w0, f1 = s > 0 ? w1 : w1 - POSTW;
  const FW = f1 - f0;
  const SCR0 = 1.12, SCR1 = 3.35, SHELF = 3.42, BEAM0 = 6.95, BEAM1 = 7.25, WIN0 = 7.6, WIN1 = 9.15;
  const leaves = 3, lw = FW / leaves;
  const open = Math.round(0.09 * H); // the middle leaf slid this far
  const lampU = 0.62, lampUp = 1.9; // the lamp in the passage behind
  rect(c, Math.min(w0, pin), -top, Math.max(w1, pin + POSTW), 0, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const up = -ly / H;
    // --- the corner post
    if (lx >= pin && lx < pin + POSTW) {
      const pu = (lx - pin) / POSTW;
      const toRoom = s > 0 ? pu : 1 - pu; // 0 on its face toward the room
      if (up < 0.55) return mt(M.stone, lum(l, s > 0 ? -0.6 : 0.6, up > 0.5 ? -0.8 : 0) * (up > 0.5 ? 1.15 : 0.85) - (toRoom > 0.85 ? 0.12 : 0), X, Y, 0.2, 1);
      if (Math.abs(up - 3.38) < 0.06 || Math.abs(up - 7.1) < 0.06) return mt(M.gold, lum(l) * 0.75, X, Y, 0.3, 1);
      const v = 0.22 + lum(l, toRoom < 0.25 ? -0.8 * s : toRoom > 0.8 ? 0.7 * s : 0) * 0.8 + (toRoom < 0.22 ? 0.14 : toRoom > 0.8 ? -0.12 : 0) + grain(lx, ly, 17) * 0.06 - clamp((up - 4) / 6, 0, 1) * 0.2;
      return mt(M.verm, v, X, Y, 0.3, 1);
    }
    if (lx < f0 || lx >= f1) return 0;
    const fu = (lx - f0) / FW;
    const dim = clamp((up - 3.5) / 6, 0, 1) * 0.25; // the wall darkens as it rises away from the floor's lamps
    // --- the skirting and the dado
    if (up < 0.45) return mt(M.stone, lum(l, 0, up > 0.42 ? -0.8 : 0) * (up > 0.42 ? 1.2 : 0.75), X, Y, 0.25, 1);
    if (up < SCR0) {
      const pu = (fu * 2) % 1, pv = (up - 0.45) / (SCR0 - 0.45);
      const e = Math.min(pu, 1 - pu) * FW / 2, ev = Math.min(pv, 1 - pv) * (SCR0 - 0.45) * H;
      if (e < 3 || ev < 3) return mt(M.wood, lum(l, 0, ev < 3 && pv < 0.5 ? -0.7 : 0) * 0.75, X, Y, 0.25, 1);
      if (Math.abs(Math.min(e, ev) - 7) < 1) return mt(M.gold, lum(l) * 0.7, X, Y, 0.3, 1);
      return mt(M.lacq, lum(l) * 0.75 + grain(lx, ly, 19, false) * 0.06, X, Y, 0.1, 1);
    }
    // --- the screens
    if (up < SCR1) {
      const li = Math.min(leaves - 1, Math.floor(fu * leaves));
      let lu = (lx - f0 - li * lw) / lw; // 0..1 across the leaf
      // the middle leaf slid toward the west: a gap at its east side shows the passage's warm light
      if (li === 1) {
        if (lu * lw > lw - open) {
          const gv = (up - SCR0) / (SCR1 - SCR0);
          return tn(M.glow, clamp(0.3 + Math.abs(gv - 0.35) * 0.9, 0, 1), X, Y, 0.4);
        }
        lu = (lu * lw) / (lw - open);
      }
      const ex = Math.min(lu, 1 - lu) * lw, vv = (up - SCR0) / (SCR1 - SCR0);
      const ey = Math.min(vv, 1 - vv) * (SCR1 - SCR0) * H;
      // the seam between two leaves: the light leaking through a 1 px gap
      if ((li === 2 && lu * lw < 1) || (li === 0 && (1 - lu) * lw < 1)) return P.ember[1]!;
      if (ex < 4 || ey < 4) return mt(M.wood, lum(l, 0, ey < 4 && vv > 0.5 ? -0.6 : 0) * 0.8 - dim, X, Y, 0.25, 1);
      // the kick panel low on each leaf
      if (vv < 0.16) return mt(M.lacq, lum(l) * 0.7, X, Y, 0.15, 1);
      if (Math.abs(vv - 0.16) * (SCR1 - SCR0) * H < 2) return mt(M.wood, lum(l) * 0.8, X, Y, 0.25, 1);
      // thin lattice bars over the paper
      const bx = (ex - 4) % (0.19 * H), by = (ey - 4) % (0.24 * H);
      if (bx < 1.6 || by < 1.6) return mt(M.wood, 0.32, X, Y, 0.3, 1);
      // the paper, lit from behind: a bloom round the lamp's place, dimmer up and at the ends
      const gu = fu - lampU, gv = up - lampUp;
      const bloom = Math.exp(-(gu * gu) / 0.09 - (gv * gv) / 1.1);
      // someone in the passage between the lamp and the east leaf: a soft shadow on the paper
      if (li === 2) {
        const hx = (lu - 0.45) * lw, hy = (up - 2.55) * H;
        const head = Math.hypot(hx, hy) < 0.12 * H;
        const body = hy < -0.08 * H && hy > -1.3 * H && Math.abs(hx + hy * 0.05) < 0.13 * H + (-hy - 0.1 * H) * 0.18;
        if (head || body) return tn(SCREEN, clamp(0.97 - bloom * 0.25, 0, 1), X, Y, 0.3);
      }
      return tn(SCREEN, clamp(0.9 - bloom * 0.42 - (vnoise(lx * 0.04, ly * 0.04, 23) - 0.5) * 0.08, 0, 1), X, Y, 0.45);
    }
    // --- the shelf's rail
    if (up < SHELF) return mt(M.wood, lum(l, 0, up > SHELF - 0.025 ? -0.8 : 0.3) * 0.85, X, Y, 0.2, 1);
    // --- the beam and the window high up
    if (up >= BEAM0 && up < BEAM1) {
      const bv = (up - BEAM0) / (BEAM1 - BEAM0);
      if (bv > 0.86) return mt(M.gold, lum(l) * 0.6, X, Y, 0.3, 1);
      return mt(M.wood, lum(l, 0, bv < 0.15 ? 0.8 : 0) * 0.7 - dim, X, Y, 0.25, 1);
    }
    if (up >= WIN0 && up < WIN1 && fu > 0.12 && fu < 0.88) {
      const wu = (fu - 0.12) / 0.76, wv = (up - WIN0) / (WIN1 - WIN0);
      const e = Math.min(wu * 0.76 * FW, (1 - wu) * 0.76 * FW, wv * (WIN1 - WIN0) * H, (1 - wv) * (WIN1 - WIN0) * H);
      if (e < 4) return mt(M.wood, lum(l, 0, wv > 0.9 ? -0.6 : 0) * 0.55 - dim, X, Y, 0.3, 1);
      // a deep reveal under its head
      if (wv > 0.88) return mt(M.lacq, 0.12, X, Y, 0.2, 1);
      const g = 0.16 * H;
      const gx = (((lx - f0) % g) + g) % g, gy = (((-ly) % g) + g) % g;
      if (gx < 1.8 || gy < 1.8 || (Math.abs(gx - gy) < 1.1 && hash(Math.floor((lx - f0) / g), Math.floor(-ly / g), 29) < 0.5)) return mt(M.lacq, 0.25, X, Y, 0.3, 1);
      return tn(P.tile, clamp(0.12 + (1 - wv) * 0.3 + Math.abs(wu - 0.5) * 0.35, 0, 1), X, Y, 0.5);
    }
    // --- the boarding, a long ink scroll on it
    const sw = 0.62 * H;
    const scx = f0 + FW * 0.5;
    if (up > 3.75 && up < 6.6 && Math.abs(lx - scx) < sw / 2 + 4) {
      const su = (lx - scx + sw / 2) / sw, sv = (up - 3.75) / (6.6 - 3.75);
      if (sv > 0.97) return mt(M.wood, lum(l, 0, -0.6) * 0.8, X, Y, 0.2, 1); // the rod
      if (su < 0 || su > 1) return sv > 0.05 && su > 1 ? mt(M.lacq, 0.1, X, Y, 0.2, 1) : mt(M.lacq, lum(l) * 0.7 + 0.08 - dim, X, Y, 0.15, 1); // its shadow
      if (su < 0.1 || su > 0.9 || sv < 0.06 || sv > 0.92) return mt(M.verm, lum(l) * 0.55 - dim, X, Y, 0.3, 1);
      // ink mountains under mist, the paper aged
      const ridge = 0.3 + 0.18 * Math.abs(Math.sin(su * 6.3 + 1.1)) + 0.08 * Math.sin(su * 19);
      const far = 0.55 + 0.1 * Math.sin(su * 9 + 2);
      if (sv < ridge) return mt(M.paper, 0.15 + lum(l) * 0.35 - (ridge - sv) * 0.5 - dim, X, Y, 0.3, 1);
      if (sv > far && sv < far + 0.08 && keep(X, Y, 0.5)) return mt(M.paper, 0.2 + lum(l) * 0.6 - dim, X, Y, 0.2, 1);
      return mt(M.paper, 0.3 + lum(l) * 0.7 - dim - sv * 0.08, X, Y, 0.15, 1);
    }
    const board = (((lx - f0) % (0.3 * H)) + 0.3 * H) % (0.3 * H) < 1.2;
    return mt(M.lacq, lum(l) * 0.7 + 0.08 - dim - (board ? 0.12 : 0) + grain(lx, ly, 21) * 0.08, X, Y, 0.15, 1);
  });
  // --- the shelf: two brackets under it, a lidded box, a vase and a scroll case on it
  const sy = -SHELF * H;
  for (const bu of [0.12, 0.88]) {
    const bx = f0 + FW * bu;
    poly(c, [bx - 2, sy, bx + 2, sy, bx + 2, sy + 0.24 * H, bx - 2, sy + 0.24 * H], (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly), -0.4, 0) * 0.6, X, Y, 0.25, 1));
    const reach = 0.16 * H * (bu < 0.5 ? 1 : -1);
    poly(c, [bx, sy, bx + reach, sy, bx, sy + 0.18 * H], (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly)) * 0.55, X, Y, 0.25, 1));
  }
  const items: [number, number, number, "box" | "vase" | "case"][] = [[0.14, 0.26, 0.24, "box"], [0.46, 0.14, 0.34, "vase"], [0.66, 0.3, 0.12, "case"]];
  for (const [iu, iw, ih, kind] of items) {
    const ix0 = f0 + FW * iu, ix1 = ix0 + FW * iw, ihp = ih * H;
    rect(c, ix0, sy - ihp, ix1 + 3, sy, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - ix0) / (ix1 - ix0), v = (ly - sy + ihp) / ihp;
      if (u > 1) return v > 0.25 ? mt(M.lacq, 0.08, X, Y, 0.2, 1) : 0; // its shadow on the boards
      if (kind === "vase") {
        const prof = 0.5 * (v < 0.22 ? 0.42 : Math.sin(Math.min(1, (v - 0.12) * 1.15) * Math.PI) * 0.95 + 0.05);
        if (Math.abs(u - 0.5) > prof) return 0;
        return mt(P.blue, cyl(lum(l) + 0.25, (u - 0.5) / Math.max(0.05, prof), -0.6, 0.2) * 0.9, X, Y, 0.2, 1);
      }
      if (kind === "case") {
        if (v < 0.12) return mt(M.gold, lum(l, 0, -0.8), X, Y, 0.2, 1);
        return mt(M.wood, lum(l, (u - 0.5) * 1.2, 0) * 0.85, X, Y, 0.2, 1);
      }
      // a red lacquer box, its lid's lip lit, a gold clasp
      if (v < 0.08) return mt(M.verm, lum(l, 0, -0.9) * 1.1, X, Y, 0.2, 1);
      if (Math.abs(v - 0.3) < 0.04) return mt(M.lacq, 0.2, X, Y, 0.2, 1);
      if (Math.abs(u - 0.5) < 0.06 && v > 0.32 && v < 0.5) return mt(M.gold, lum(l) * 0.9, X, Y, 0.2, 1);
      return mt(M.verm, lum(l, (u - 0.5) * 0.8, 0) * 0.7, X, Y, 0.25, 1);
    });
  }
}

// ---------------------------------------------------------------------------
// The Long Gallery: its floor beam on posts and brackets; the balustrade (front plane)
// ---------------------------------------------------------------------------
export interface GalleryP {
  w: number;
  /** Depth of the floor beam (px). */
  depth: number;
  /** Posts down to the floor (local x) and the floor's drop to the walkway below (px). */
  posts: number[];
  drop: number;
  /** Where the map pillar passes through (local x, its half width). */
  pillar: [number, number];
  at?: At;
}

export const gallery = definePainter<GalleryP>("hall.gallery", {
  bounds(p) {
    return [-30, -6, p.w + 30, p.drop + 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const D = p.depth;
    // posts first (they stand behind the beam's brackets)
    for (const px of p.posts) post(c, px, p.drop, D, lf, p.w);
    // the beam's lengths of work (round 2): [x0, x1, kind, seed]; never the same kind twice running
    const segs: [number, number, number, number][] = [];
    for (let x = -0.4 * H, i = 0, last = -1; x < p.w + H; i++) {
      const len = Math.round((1.4 + 1.8 * hash(i, 2, 77)) * H);
      let kind = Math.floor(hash(i, 3, 77) * 5);
      if (kind === last) kind = (kind + 1 + Math.floor(hash(i, 4, 77) * 3)) % 5;
      segs.push([x, x + len, kind, 900 + i * 13]);
      last = kind;
      x += len;
    }
    // the beam: a lit nosing, the carved fascia, a dark soffit edge under it
    rect(c, 0, 0, p.w, D, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      if (Math.abs(lx - p.pillar[0]) < p.pillar[1] - 2) return 0;
      if (ly < 3) return mt(M.wood, lum(l, 0, -1) * 1.15, X, Y, 0.05, 1);
      if (ly < 9) return mt(M.verm, lum(l) * 0.75, X, Y, 0.3, 1);
      if (ly > D - 6) return mt(M.lacq, lum(l) * 0.35, X, Y, 0.3, 1);
      // (hall loop round 2, W2-8: one medallion and swag every 1.65 H read as one repeat at play zoom) the beam is
      // made of lengths of different work, each 1.4 .. 3.2 H long and its own: a run of medallions on a vine, a
      // long gold-framed cartouche with a cloud relief on red, a Suzhou-painted length (teal and red bands round a
      // half-round panel with a little landscape), a plain length with a name tablet hung on it and its tassels, a
      // worn length with the gilding flaked and a newer board pieced in; iron straps at the joints
      const si = segs.findIndex(([a, b]) => lx >= a && lx < b);
      const [s0, s1, kind, sseed] = segs[si < 0 ? 0 : si]!;
      const cy = (D + 6) / 2;
      const fy = (ly - 9) / (D - 15); // 0 under the red band .. 1 over the soffit edge
      const sl = s1 - s0, su = (lx - s0) / sl, sm = lx - (s0 + s1) / 2;
      // the joint: two beams butted, a dark split and an iron strap with rivets across it
      if (lx - s0 < 7 || s1 - lx < 1) {
        if (lx - s0 < 1) return mt(M.lacq, lum(l) * 0.2, X, Y, 0.3, 1);
        const rv = Math.abs(lx - s0 - 4) < 1.2 && (Math.abs(fy - 0.25) < 0.08 || Math.abs(fy - 0.75) < 0.08);
        return rv ? mt(M.bronze, lum(l, 0, -0.5) * 1.1, X, Y, 0.1, 1) : mt(M.lacq, lum(l, 0, ly < cy ? -0.4 : 0.4) * 0.45 + 0.05, X, Y, 0.2, 1);
      }
      const base = (): number => mt(M.lacq, lum(l) * 0.7 + grain(lx, ly, 19, false) * 0.08, X, Y, 0.05, 1);
      if (kind === 0) {
        // medallions on a vine: two or three across the length, one fallen out of its socket now and then
        const n = sl > 2.4 * H ? 3 : 2;
        const mi = Math.min(n - 1, Math.floor(su * n));
        const m = (su * n - mi - 0.5) * sl / n;
        const d = Math.hypot(m * 0.85, ly - cy);
        const mk = hash(mi, sseed, 71);
        if (d < 0.13 * H) {
          if (mk < 0.12) return d > 0.1 * H ? mt(M.lacq, lum(l) * 0.35, X, Y, 0.2, 1) : mt(M.lacq, lum(l) * 0.5, X, Y, 0.2, 1);
          const ring = d > 0.1 * H;
          const ang = Math.atan2(ly - cy, m);
          const inner = mk < 0.45 ? Math.sin(ang * 8) > 0.1 : mk < 0.75 ? Math.abs(m) > 0.035 * H || Math.abs(ly - cy) > 0.035 * H : Math.cos(ang * 5) > 0.3;
          return mt(M.gold, lum(l, m / (0.3 * H), (ly - cy) / (0.3 * H)) * (ring ? 0.85 : inner ? 0.7 : 0.45), X, Y, 0.2, 1);
        }
        const vine = fbm(lx * 0.03, 2.2, 73, 2) < 0.62 && Math.abs(ly - cy - Math.sin(lx * 0.07 + mi) * 5) < 0.8 / c.d && Math.abs(m) > 0.2 * H;
        return vine ? mt(M.gold, lum(l) * 0.6, X, Y, 0.3, 1) : base();
      }
      if (kind === 1) {
        // a long cartouche: a gold frame, a red ground, a running cloud scroll in raised gold
        const e = Math.min(lx - s0 - 0.18 * H, s1 - lx - 0.18 * H, (fy - 0.12) * (D - 15), (0.88 - fy) * (D - 15));
        if (e < 0) return base();
        if (e < 2) return mt(M.gold, lum(l, 0, fy < 0.5 ? -0.6 : 0.6) * 0.85, X, Y, 0.15, 1);
        if (e < 3.5) return mt(M.lacq, lum(l) * 0.3, X, Y, 0.2, 1);
        // its ground; the cloud scrolls in raised gold are laid over it after (below)
        return mt(M.verm, lum(l) * 0.45 + (fbm(lx * 0.05, ly * 0.1, sseed, 2) - 0.5) * 0.08, X, Y, 0.3, 1);
      }
      if (kind === 2) {
        // a Suzhou-painted length: teal and red bands toward each end, a half-round panel in its middle with a
        // little ink landscape on cream, a gold rim round it
        // (round 4, W2-g: the half-round teal panel hung from the beam's top read as a primitive semicircle stuck on)
        // a cartouche carved flush in the beam: a long panel with cusped corners, a gold bead round it, its field a
        // step lighter than the beam, a far ridge and a cloud carved in low relief (lit on their tops, undercut dark)
        const hw = Math.min(0.66 * H, sl * 0.3), hh = (D - 15) * 0.4, cr = hh * 0.42;
        const ax = Math.abs(sm), ay = Math.abs(ly - cy);
        if (ax < hw && ay < hh) {
          const cut = Math.hypot(hw - ax, hh - ay) < cr;
          if (!cut) {
            const e = Math.min(hw - ax, hh - ay, Math.hypot(hw - ax, hh - ay) - cr);
            if (e < 1.5) return mt(M.gold, lum(l, 0, ly < cy ? -0.6 : 0.5) * 0.8, X, Y, 0.15, 1);
            if (e < 2.5) return mt(M.lacq, lum(l) * 0.35, X, Y, 0.2, 1);
            const pu = sm / hw, pv = (ly - cy + hh) / (2 * hh);
            const ridge = 0.5 + 0.2 * Math.abs(Math.sin(pu * 3.4 + sseed)) + 0.07 * Math.sin(pu * 11 + sseed);
            const rTop = pv > ridge && pv < ridge + 0.09;
            if (pv > ridge) return mt(M.wood, lum(l, 0, rTop ? -0.8 : 0) * (rTop ? 0.85 : 0.6) + grain(lx, ly, sseed, false) * 0.06, X, Y, 0.3, 1);
            const cl = ruyi(sm + hw * 2.2, (pv - 0.28) * 2 * hh, hh * 0.32, sseed);
            if (cl === 2) return mt(M.gold, lum(l, 0, -0.4) * 0.6, X, Y, 0.3, 1);
            if (cl === 1) return mt(M.wood, lum(l, 0, -0.3) * 0.7, X, Y, 0.3, 1);
            return mt(M.lacq, lum(l) * 0.85 + grain(lx, ly, 19, false) * 0.06, X, Y, 0.05, 1);
          }
        }
        // the end bands (a gold line, a teal band, a red one) only near each end; between them and the panel the
        // beam's own dark lacquer with a thin gold line along it
        const fromEnd = Math.min(lx - s0, s1 - lx) / H;
        if (fromEnd < 0.42) {
          const r = Math.floor(fromEnd / 0.14);
          if (Math.abs(fromEnd - r * 0.14) < 0.02) return mt(M.gold, lum(l) * 0.55, X, Y, 0.3, 1);
          return r === 1 ? tn(P.jade, clamp(0.84 + (1 - lum(l)) * 0.15, 0, 1), X, Y, 0.3) : mt(M.verm, lum(l) * 0.42, X, Y, 0.3, 1);
        }
        if (Math.abs(fy - 0.5) < 0.04) return mt(M.gold, lum(l) * 0.5, X, Y, 0.3, 1);
        return base();
      }
      if (kind === 3) {
        // a plain length with a name tablet hung on it: black lacquer, a gold edge, a gilt seal (its tassels hang below)
        const tw = 0.42 * H;
        const e = Math.min(tw - Math.abs(sm), (fy - 0.06) * (D - 15), (0.94 - fy) * (D - 15));
        if (e > 0) {
          if (e < 1.8) return mt(M.gold, lum(l, sm < 0 ? -0.5 : 0.5, fy < 0.5 ? -0.7 : 0.4) * 0.9, X, Y, 0.1, 1);
          if (Math.hypot(sm, ly - cy) < 0.08 * H) return mt(M.gold, lum(l) * 0.7, X, Y, 0.3, 1);
          return mt(M.lacq, lum(l) * 0.3, X, Y, 0.2, 1);
        }
        // its shadow on the beam, down and right
        if (sm > tw && sm < tw + 3 && fy > 0.15) return mt(M.lacq, lum(l) * 0.2, X, Y, 0.3, 1);
        return base();
      }
      // a worn length: the gilding flaked, bare timber showing, a newer board pieced in with its nails
      const pz0 = s0 + sl * (0.3 + 0.3 * hash(sseed, 3, 75)), pz1 = pz0 + 0.55 * H;
      if (lx > pz0 && lx < pz1 && fy > 0.1 && fy < 0.9) {
        const nail = Math.abs(lx - pz0 - 3) < 1 || Math.abs(pz1 - lx - 3) < 1;
        if (nail && (Math.abs(fy - 0.25) < 0.06 || Math.abs(fy - 0.75) < 0.06)) return mt(M.bronze, lum(l) * 0.8, X, Y, 0.2, 1);
        return mt(M.wood, lum(l, 0, fy < 0.15 ? -0.5 : 0) * 0.75 + grain(lx, ly, sseed, false) * 0.15, X, Y, 0.2, 1);
      }
      const f = fbm(lx * 0.035, ly * 0.09, sseed, 3);
      if (f > 0.6) return mt(M.wood, lum(l) * 0.45 + grain(lx, ly, sseed + 1, false) * 0.1, X, Y, 0.3, 1);
      if (f > 0.57) return mt(M.gold, lum(l) * 0.4, X, Y, 0.3, 1);
      return base();
    });
    // the cartouches' cloud scrolls: curls facing each other in pairs along the red ground, raised gold
    for (const [s0, s1, kind, sseed] of segs) {
      if (kind !== 1) continue;
      const cy = Math.round((D + 6) / 2), r = Math.max(4, Math.round((D - 15) * 0.22));
      const n = Math.max(2, Math.floor((s1 - s0 - 0.4 * H) / (0.55 * H)));
      for (let k = 0; k < n; k++) {
        const x = s0 + 0.2 * H + (k + 0.5) * (s1 - s0 - 0.4 * H) / n;
        if (x < 0 || x > p.w || Math.abs(x - p.pillar[0]) < p.pillar[1] + r) continue;
        const dir: 1 | -1 = k % 2 === 0 ? 1 : -1;
        cloudScroll(c, Math.round(x - dir * r * 0.6), cy + (hash(k, sseed, 79) < 0.5 ? -1 : 1), r, dir, Math.round(0.16 * H), (X, Y, lx, ly) => mt(M.gold, lum(lf.get(lx, ly), 0, ly < cy ? -0.5 : 0.4) * 0.85, X, Y, 0.2, 1));
      }
    }
    // the tablets' tassels, hung below the beam
    for (const [s0, s1, kind] of segs) {
      if (kind !== 3) continue;
      const mid = (s0 + s1) / 2;
      for (const tx of [mid - 0.36 * H, mid + 0.36 * H]) {
        rect(c, tx - 1.5, D - 2, tx + 1.5, D + 0.32 * H, (X, Y, lx, ly) => {
          const v = (ly - D) / (0.32 * H);
          if (v < 0.12) return Math.abs(lx - tx) < 1 ? mt(M.gold, lum(lf.get(lx, ly)) * 0.8, X, Y, 0.2, 1) : 0;
          if (v < 0.25) return mt(M.gold, lum(lf.get(lx, ly)) * 0.7, X, Y, 0.2, 1);
          return mt(M.verm, lum(lf.get(lx, ly), (lx - tx) / 2, 0) * 0.65, X, Y, 0.3, 1);
        });
      }
    }
  },
});

function post(c: PaintCtx, px: number, drop: number, D: number, lf: LitField, beamEnd?: number): void {
  const r = 0.2 * H;
  const { k: pk, side } = colLight(lf, px, D, drop);
  colBaseAt(c, px, drop, r, 0.55 * H, pk, side, 7);
  lathe(c, px, D - 4, drop, () => r, (X, Y, u, lx, ly) => {
    const fromFloor = (drop - ly) / H;
    const n = cyl(pk, u, side, 0.1);
    if (fromFloor < 0.55) return 0;
    const band = (fromFloor > 0.6 && fromFloor < 0.74) || ly < D + 0.2 * H;
    if (band) return mt(M.gold, n * 0.9, X, Y, 0.2, 1);
    return mt(M.verm, n * 0.78 - (fromFloor < 1.3 ? vnoise(lx * 0.5, ly * 0.2, 2) * 0.08 : 0), X, Y, 0.25, 1);
  });
  // the post's head: a gold-carved bearing block wider than the post, and a short curled
  // corbel either side carrying the beam (dark timber, gold-edged)
  const capW = r * 1.9, capH = 0.2 * H;
  rect(c, px - capW, D, px + capW, D + capH, (X, Y, lx, ly) => {
    const l = lf.get(px, ly);
    const u = (lx - px) / capW, v = (ly - D) / capH;
    const flute = Math.sin(u * 14) > 0.4 && v > 0.25 && v < 0.8;
    return mt(M.gold, cyl(l.k, u, side) * (flute ? 0.65 : 0.9) + (v < 0.15 ? 0.1 : 0), X, Y, 0.2, 1);
  });
  for (const s2 of [-1, 1]) {
    // (hall loop round 2, W1-1) no corbel reaching out from a post past the beam's end (the dark flap at the
    // stair's head): it carries nothing there
    if (beamEnd !== undefined && s2 > 0 && px + capW + 0.46 * H > beamEnd) continue;
    const len = 0.46 * H, dep = 0.3 * H;
    const pts: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(px + s2 * (capW + len * t), D + capH * 0.1);
    }
    for (let i = 14; i >= 0; i--) {
      const t = i / 14;
      // the underside: a quarter curve up to the tip, ending in a small curl
      const yy = D + capH * 0.1 + dep * Math.pow(1 - t, 0.7) + (t > 0.85 ? Math.sin(((t - 0.85) / 0.15) * Math.PI) * 0.06 * H : 0);
      pts.push(px + s2 * (capW * 0.6 + (len + capW * 0.4) * t), yy);
    }
    poly(c, pts, (X, Y, lx, ly) => {
      const l = lf.get(px, ly);
      const k = (Math.abs(lx - px) - capW * 0.6) / (len + capW * 0.4);
      const under = D + capH * 0.1 + dep * Math.pow(Math.max(0, 1 - k), 0.7);
      const e = Math.min(ly - D - capH * 0.1, under - ly);
      if (e < 1.5) return mt(M.gold, l.k * 0.75, X, Y, 0.3, 1);
      const curl = Math.hypot(k - 0.82, (ly - D) / H * 3 - 0.35) < 0.12;
      return curl ? mt(M.gold, l.k * 0.6, X, Y, 0.3, 1) : mt(M.lacq, cyl(l.k, s2 * 0.4, side) * 0.7, X, Y, 0.1, 1);
    });
  }
}

export interface RailP {
  w: number;
  h: number;
  at?: At;
}

/** The gallery's balustrade (front plane: she walks behind it): posts with gold caps, a lattice band she shows through. */
/** The room's light without the skylight's shaft (the rail lights its top in the shaft itself). */
const NO_SHAFT = { ...HALL_LIGHT, lights: HALL_LIGHT.lights.filter((l) => !(l.kind === "shaft" && l.x0 === SHAFT.x0 && l.y0 === SHAFT.y0)) };

export const balustrade = definePainter<RailP>("hall.balustrade", {
  bounds(p) {
    return [-8, -p.h - 14, p.w + 8, 2];
  },
  paint(c, p) {
    // (round 3, W2-4: the skylight's shaft lit one length of the rail hot red, a lit box) the rail takes the room's
    // light without the shaft; the shaft lands only on the rail's top and the posts' caps, falling off across it
    const lf = new LitField(NO_SHAFT, p.at, 12);
    const sh = (lx: number, ly: number): number => (p.at ? shaftCore(p.at.wx + lx, p.at.wy + ly, HALL.floor) : 0);
    const pitch = 1.08 * H;
    const n = Math.max(1, Math.round(p.w / pitch));
    const step = p.w / n;
    rect(c, 0, -p.h, p.w, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = (ly + p.h) / p.h;
      const k = ((lx % step) + step) % step;
      const postW = 9;
      if (k < postW || lx > p.w - postW) return mt(M.verm, lum(l, k < postW / 2 ? -0.6 : 0.5, 0) * 0.9, X, Y, 0.15, 1);
      if (v < 0.05) {
        const s2 = sh(lx, ly) * 1.6 + (bayer4(X, Y) - 0.5) * 0.3;
        if (s2 > 0.15) return mt(M.verm, lum(l, 0, -0.9) * 1.0 + Math.min(0.22, s2 * 0.3), X, Y, 0.1, 1);
      }
      if (v < 0.12) return mt(M.verm, lum(l, 0, v < 0.05 ? -0.9 : 0.2) * 1.0, X, Y, 0.15, 1);
      if (v > 0.38 && v < 0.46) return mt(M.verm, lum(l) * 0.8, X, Y, 0.25, 1);
      if (v > 0.9) return mt(M.verm, lum(l) * 0.7, X, Y, 0.3, 1);
      if (v > 0.46 && v < 0.9) {
        // an open fret: thin bars, mostly air, so she stays readable behind it
        const s = 0.22 * H;
        const a = (((lx - k + 2 * postW) % s) + s) % s;
        const mid = Math.abs(v - 0.68) < 0.025;
        if (a < 2 || mid) return mt(M.verm, lum(l) * 0.7, X, Y, 0.3, 1);
        // little carved cloud knots in the middle of each span
        const ku = k - step / 2;
        if (Math.hypot(ku, (v - 0.68) * p.h) < 6) return mt(M.gold, lum(l) * 0.9, X, Y, 0.1, 1);
      }
      return 0;
    });
    // gold caps on the posts
    for (let i = 0; i <= n; i++) {
      const cx = Math.min(i * step + 4.5, p.w - 4.5);
      lathe(c, cx, -p.h - 13, -p.h + 1, (ly) => {
        const t = (ly + p.h + 13) / 14;
        return t < 0.15 ? 1.5 : t < 0.7 ? 3 + 2 * Math.sin(t * Math.PI) : 4.6;
      }, (X, Y, u, lx, ly) => mt(M.gold, lum(lf.get(lx, ly), u * 0.9, -0.3) * 1.05 + (u < 0.2 ? Math.min(0.35, sh(lx, ly) * 0.6) : 0), X, Y, 0.05, 1));
    }
  },
});

// (hall loop round 2: the stair is its own module now, stair.ts: two flights and a landing on posts)

/** A column base standing on a floor `fy` px below the local origin. */
function colBaseAt(c: PaintCtx, cx: number, fy: number, r: number, top: number, k: number, side: number, seed: number): void {
  const shifted = { ...c, Y: (v: number) => c.Y(v + fy), ly: (v: number) => c.ly(v) - fy };
  colBase(shifted as PaintCtx, cx, r, top, k, side, seed);
}

export { P, hash, keep, tn };

// The Prize Court's foundation under the walk line (court.foundation; the hall loop, round 2, W2-11).
//
// Round 1's was a uniform ashlar tile with even drips under a frieze of stamped cartouches. Now it is
// chunks, never a tile (Dex's terrain note): courses of very different heights, big quoins at both
// ends and at the stair's mouth, a ragged patch of re-set blocks in a newer stone, a few cracked
// blocks, stone spouts under the frieze with uneven stains running down from them and moss in the
// joints where their water goes, and the cliff's rock rising into the lowest courses as blocky chunks
// with moss on their flat tops. The frieze is broken into panels of different lengths (pilasters
// dropped here and there): gold cloud bands, cartouches, carved stone waves with the lacquer long
// gone, a panel whose lacquer has faded and flaked, a plain later repair; the sunburst at the middle.
//
// Daylight from the upper left (COURT_LIGHT): lit faces up and left, shadows down and right.

import type { PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { M, clamp, face, fbm, hash, mt, rect, tn, vnoise } from "./kit.ts";
import { bayer4 } from "../../raster.ts";
import { crossedBlades } from "./signs.ts";
import { blockAt } from "./court-stone.ts";

const H = 96;
const SIDE = -1;
/** Stone darkened and greened by the damp out of the rock (round 3). */
const GREEN_STONE = [P.karst[2]!, P.karst[3]!, P.karst[4]!, P.karst[5]!, P.karst[6]!, P.karst[7]!, P.pine[4]!];

export interface FoundationArgs {
  w: number;
  depth: number;
  well?: [number, number];
  pilasters: number[];
  centre?: number;
}

type PanelKind = "scroll" | "cartouche" | "lost" | "repair" | "relief" | "sun";
interface Panel { x0: number; x1: number; kind: PanelKind; seed: number }

/** The frieze's panels between the pilasters that are kept (some dropped, so the lengths differ). */
function friezePanels(p: FoundationArgs, centre: number): { panels: Panel[]; pils: number[] } {
  const pils = p.pilasters.filter((x, i) => {
    if (p.well && (Math.abs(x - p.well[0]) < 1.6 * H || Math.abs(x - p.well[1]) < 1.6 * H)) return true;
    if (Math.abs(x - centre) < 2.2 * H) return false;
    // (round 3, W2-10: fewer, longer panels) most pilasters dropped
    return hash(i, 1, 301) > 0.66;
  });
  const cuts = [0, ...pils, ...(p.well ? [p.well[0], p.well[1]] : []), p.w].sort((a, b) => a - b);
  const panels: Panel[] = [];
  const KINDS: PanelKind[] = ["scroll", "cartouche", "lost", "relief", "cartouche", "repair", "scroll", "relief"];
  const SUN = 1.55 * H;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const x0 = cuts[i]!, x1 = cuts[i + 1]!;
    if (p.well && x0 >= p.well[0] - 1 && x1 <= p.well[1] + 1) continue;
    const kind = (k: number): PanelKind => KINDS[Math.floor(hash(i, k, 303) * KINDS.length)]!;
    if (centre > x0 && centre < x1) {
      // the sunburst's panel stands alone; what is left either side of it is its own panel
      if (centre - SUN - x0 > 0.8 * H) panels.push({ x0, x1: centre - SUN, kind: kind(5), seed: i + 50 });
      panels.push({ x0: Math.max(x0, centre - SUN), x1: Math.min(x1, centre + SUN), kind: "sun", seed: i });
      if (x1 - centre - SUN > 0.8 * H) panels.push({ x0: centre + SUN, x1, kind: kind(7), seed: i + 70 });
      continue;
    }
    panels.push({ x0, x1, kind: kind(2), seed: i });
  }
  return { panels, pils };
}

/** Where the drains come out under the frieze (local x): a few, unevenly spaced. */
function drains(p: FoundationArgs): number[] {
  const out: number[] = [];
  for (let x = 1.7 * H, i = 0; x < p.w - H; i++) {
    if (!(p.well && x > p.well[0] - 0.6 * H && x < p.well[1] + 0.6 * H)) out.push(x);
    x += (3.4 + 3.2 * hash(i, 1, 307)) * H;
  }
  return out;
}

/**
 * (round 3, W2-10: gold spirals on black read as a generic motif) a run of ruyi clouds carved in the stone: 0 the
 * sunk field, 1 the cloud's face, 2 its lit upper edge, 3 its undercut (the sun is up and to the left).
 */
function carvedCloud(x: number, y: number, r: number, seed: number): number {
  const at = (xx: number, yy: number): boolean => {
    const per = r * 3.3;
    const i = Math.floor(xx / per + 0.5);
    const cx = i * per + (hash(i, 1, seed) - 0.5) * r * 0.5, flip = hash(i, 2, seed) < 0.5 ? -1 : 1;
    const dx = (xx - cx) * flip, dy = yy - (hash(i, 3, seed) - 0.5) * r * 0.35;
    const R = r * (0.5 + 0.1 * hash(i, 4, seed));
    if (Math.hypot(dx, dy + 0.15 * R) < R || Math.hypot(dx + 0.95 * R, dy - 0.4 * R) < 0.62 * R || Math.hypot(dx - 0.95 * R, dy - 0.4 * R) < 0.62 * R) {
      const cr = Math.hypot(dx, dy + 0.15 * R);
      return !(Math.abs(cr - 0.5 * R) < 0.9 && Math.atan2(dy + 0.15 * R, dx) > -1.2);
    }
    const tx = dx - 1.45 * R, ty = dy - 0.2 * R;
    return tx > 0 && tx < 1.7 * R && Math.abs(ty + Math.sin(tx / R * 2.2) * 0.3 * R) < 0.17 * R;
  };
  if (!at(x, y)) return at(x - 1.2, y - 1.6) ? 3 : 0;
  return at(x + 1.2, y + 1.6) ? 1 : 2;
}

export function paintFoundation(c: PaintCtx, p: FoundationArgs): void {
  const COPE = 14, FRIEZE = 0.62 * H, F1 = COPE + FRIEZE;
  const centre = p.centre ?? p.w * 0.36;
  const lacq = M.lacqDay;
  const { panels, pils } = friezePanels(p, centre);
  const spouts = drains(p);
  const PILW = 0.32 * H;
  // the foot: the masonry follows the rock it was built on, stepping down and up in chunks
  const foot = (lx: number): number => p.depth - 0.42 * H * vnoise(lx / (1.3 * H), 0, 17) - (Math.floor(lx / (0.9 * H)) % 3 === 0 ? 0.22 * H : 0) + 0.08 * H * (vnoise(lx / (0.3 * H), 4, 21) - 0.5);
  // the rock rising into the lowest courses: blocky chunks with flat tops (Dex's terrain note)
  const chunkOf = (lx: number): number => lx / (0.7 * H) + vnoise(lx * 0.004, 1, 311) * 2;
  const rockTop = (lx: number): number => {
    const k = Math.floor(chunkOf(lx));
    const hgt = Math.max(0, (vnoise(k * 0.37, 2, 313) - 0.45) * 2.4) * (0.35 + 0.3 * hash(k, 4, 313)) * H;
    return foot(lx) - hgt;
  };
  // the courses below the frieze: very different heights (thin bands, tall rows, a deep base course)
  const baseTop = p.depth - 0.78 * H;
  const rows: [number, number][] = [];
  const HEIGHTS = [0.2, 0.42, 0.24, 0.17, 0.36, 0.28, 0.46, 0.2];
  for (let y = F1, k = 0; y < baseTop - 0.15 * H; k++) {
    const hh = Math.round((HEIGHTS[k % HEIGHTS.length]! + 0.06 * hash(k, 1, 23)) * H);
    rows.push([y, Math.min(baseTop, y + hh)]);
    y += hh;
  }
  if (rows.length && rows[rows.length - 1]![1] < baseTop) rows[rows.length - 1]![1] = baseTop;
  rows.push([baseTop, p.depth + 0.8 * H]);
  // the corners where the quoins are laid: both ends and the stair's mouth
  const corners: [number, number][] = [[0, 1], [p.w, -1]];
  if (p.well) corners.push([p.well[0], -1], [p.well[1], 1]);
  // a patch of re-set blocks in a newer stone, ragged
  const patchAt = (lx: number, ly: number): boolean => fbm(lx * 0.006, ly * 0.012, 317, 2) > 0.66;
  // moss clumps hanging off a ledge
  const clump = (lx: number, ledge: number, every: number, seed: number): number => {
    const k = Math.floor(lx / every);
    if (hash(k, 1, seed) < 0.45) return 0;
    const cx = (k + 0.2 + 0.6 * hash(k, 2, seed)) * every, rw = 7 + 16 * hash(k, 3, seed);
    const u = (lx - cx) / rw;
    if (Math.abs(u) > 1) return 0;
    return (1 - u * u) * (4 + 7 * hash(k, 4, seed)) * (0.7 + 0.6 * vnoise(lx * 0.3, ledge, seed));
  };
  // how wet a wall point is under the spouts (0 dry .. 1 soaked): narrow, wandering, each its own length
  const wet = (lx: number, ly: number): number => {
    let best = 0;
    for (const [i, sx] of spouts.entries()) {
      const len = (1.2 + 1.3 * hash(i, 3, 319)) * H;
      const t = (ly - F1 - 0.14 * H) / len;
      if (t < 0 || t > 1) continue;
      const wob = (vnoise(ly * 0.05, i, 321) - 0.5) * 10 + t * (hash(i, 4, 319) - 0.5) * 16;
      const half = 3 + 5 * t + 3 * vnoise(ly * 0.1, i + 7, 323);
      const d = Math.abs(lx - sx - wob) / half;
      if (d < 1) best = Math.max(best, (1 - d) * (1 - t * 0.6));
    }
    return best;
  };
  rect(c, 0, -2, p.w, p.depth + 0.8 * H, (X, Y, lx, ly) => {
    if (p.well && lx > p.well[0] && lx < p.well[1] && ly < COPE + 2) return 0;
    const f = foot(lx);
    if (ly > f) {
      // where it meets the rock: rubble, soil and moss packed under the footing, ragged
      const under = ly - f;
      const pile = 5 + 14 * vnoise(lx * 0.06, 2, 19) + 6 * vnoise(lx * 0.25, 5, 29);
      if (under > pile) return 0;
      const stone = fbm(lx * 0.22, ly * 0.3, 41, 2);
      if (stone > 0.56) return mt(M.stone, (stone > 0.66 ? 0.62 : 0.4) - (under / pile) * 0.25, X, Y, 0.15, 1);
      if (stone < 0.4 && under < pile * 0.7) return tn(P.moss, 0.45 + (under / pile) * 0.4, X, Y, 0.25);
      return tn(P.earth, 0.62 + (under / pile) * 0.3, X, Y, 0.3);
    }
    // moss hanging off the coping's nose
    if (ly >= COPE - 2 && ly < COPE + 12) {
      const m = clump(lx, 1, 1.9 * H, 51);
      if (m > 0 && ly < COPE - 1 + m) {
        const t = (ly - COPE + 2) / (m + 1);
        if (t > 0.75 && hash(X, Y, 8) > 0.5) return 0;
        return tn(P.moss, 0.25 + t * 0.5, X, Y, 0.3);
      }
    }
    if (ly < COPE) {
      // the coping: a lit top, a rounded nose, worn smooth along the front, chipped here and there
      if (ly < 2) return mt(M.stone, 1.1, X, Y, 0.0, 1);
      const chip = fbm(lx * 0.12, 1, 61, 2) > 0.72 && ly > 9 ? -0.16 : 0;
      return mt(M.stone, face(0.95, SIDE, 0, ly < 6 ? -0.6 : 0.5) - (vnoise(lx * 0.2, 1, 3) > 0.7 ? 0.08 : 0) + chip, X, Y, 0.0, 1);
    }
    const along = 0.82 + 0.28 * vnoise(lx / (2.6 * H), 9, 77);
    // --- the frieze
    if (ly < F1) {
      const v = (ly - COPE) / FRIEZE;
      // (round 3, W2-10) the coping's overhang throws a hard shadow along the frieze's top
      const overhang = ly < COPE + 5 ? -0.36 : ly < COPE + 7 && bayer4(X, Y) < 0.5 ? -0.36 : 0;
      // the coping's drips run down over the frieze too, here and there
      const drip = vnoise(lx * 0.15, 11, 325) > 0.72 && v < 0.2 + 0.7 * vnoise(lx * 0.04, 12, 327) ? -0.08 : 0;
      if (v < 0.08 || v > 0.92) return mt(M.stone, face(0.9, SIDE, 0, v < 0.08 ? -0.6 : 0.6) * 0.85 * along + overhang, X, Y, 0.1, 1);
      // the pilasters' heads: a plain block with a carved lotus boss, worn
      const pc = pils.find((x) => Math.abs(lx - x) < PILW);
      if (pc !== undefined) {
        const e = Math.abs(lx - pc);
        if (e > PILW - 2) return mt(M.stone, lx < pc ? 0.95 : 0.42, X, Y, 0.1, 1);
        const d = Math.hypot(lx - pc, (v - 0.5) * FRIEZE);
        const petal = d < 0.11 * H && Math.sin(Math.atan2((v - 0.5) * FRIEZE, lx - pc) * 6 + hash(Math.round(pc), 1, 3) * 3) > 0.1;
        const worn = fbm(lx * 0.2, ly * 0.2, 13, 2) > 0.62;
        if (petal && !worn) return mt(M.stone, face(0.92, SIDE, (lx - pc) / (0.12 * H), (v - 0.5) * 2) * 0.95 * along, X, Y, 0.0, 1);
        return mt(M.stone, 0.66 * along + overhang + drip, X, Y, 0.1, 1);
      }
      const pn = panels.find((q) => lx >= q.x0 && lx < q.x1);
      if (!pn) return mt(M.stone, 0.62 * along + overhang, X, Y, 0.1, 1);
      const pw = pn.x1 - pn.x0, u = lx - pn.x0;
      const vy = (v - 0.5) * FRIEZE;
      // the panel's sunk field inside its border
      const inner = Math.min(u - (pils.includes(pn.x0) ? PILW : 6), pw - u - (pils.includes(pn.x1) ? PILW : 6), FRIEZE * 0.4 - Math.abs(vy));
      if (inner < 0) return mt(M.stone, 0.62 * along + overhang + drip, X, Y, 0.1, 1);
      if (pn.kind === "repair") {
        // a later repair: plain newer stone, sharper and paler, a mortar line round it
        if (inner < 1.5) return mt(M.stone, 0.5, X, Y, 0.1, 1);
        return mt(M.stone, 0.9 + (fbm(lx * 0.1, ly * 0.1, 329, 2) - 0.5) * 0.06 + overhang, X, Y, 0.0, 1);
      }
      if (pn.kind === "relief") {
        // (round 3, W2-10: the carved waves read as wood grain) clouds carved in the bare stone, lit on their upper
        // edges, undercut below, worn
        if (inner < 2) return mt(M.stone, 0.48 * along, X, Y, 0.1, 1);
        const k = carvedCloud(lx - pn.x0 + hash(pn.seed, 6, 335) * 0.6 * H, vy, FRIEZE * 0.34, 361 + pn.seed);
        const worn = fbm(lx * 0.3, ly * 0.3, 331, 2) > 0.75 ? -0.08 : 0;
        if (k === 2) return mt(M.stone, 0.98 * along + overhang + drip + worn, X, Y, 0.05, 1);
        if (k === 1) return mt(M.stone, 0.74 * along + overhang + drip + worn, X, Y, 0.05, 1);
        if (k === 3) return mt(M.stone, 0.34 * along + overhang, X, Y, 0.05, 1);
        return mt(M.stone, 0.56 * along + overhang + drip + worn, X, Y, 0.05, 1);
      }
      // the lacquered panels: a gold rim, then their motif; the lacquer faded and flaking where weather got in
      const fade = fbm(lx * 0.03, ly * 0.05, 333 + pn.seed, 3) + (pn.kind === "lost" ? 0.22 : 0);
      const flake = fade > 0.72;
      const gilt = fbm(lx * 0.08, ly * 0.2, 19 + pn.seed, 2) < (pn.kind === "lost" ? 0.35 : 0.62);
      if (inner < 2.5) return gilt && !flake ? mt(M.gold, face(0.95, SIDE, 0, vy < 0 ? -0.6 : 0.6) * 0.9 * along, X, Y, 0.05, 1) : mt(M.stone, 0.55, X, Y, 0.1, 1);
      if (inner < 4) return mt(lacq, 0.25, X, Y, 0.1, 1);
      if (flake) return mt(M.stone, 0.58 * along + drip, X, Y, 0.1, 1);
      const ground = mt(lacq, (face(0.9, SIDE) * 0.38 + (fade > 0.6 ? 0.12 : 0)) * along + drip, X, Y, 0.15, 1);
      if (pn.kind === "sun") {
        // (round 3, W2-10) the court's middle: its crest (crossed blades in a ring, painted after this pass), carved
        // clouds rolling out either side of it in the old lacquer, the gilt worn off their faces
        if (Math.hypot(lx - centre, vy) < 0.27 * H) return ground;
        const k = carvedCloud(Math.abs(lx - centre) - 0.3 * H, vy, FRIEZE * 0.36, 351);
        if (k === 2) return gilt ? mt(M.gold, 0.82 * along, X, Y, 0.1, 1) : mt(M.stone, 0.95 * along, X, Y, 0.05, 1);
        if (k === 1) return mt(lacq, face(0.9, SIDE) * 0.62 * along, X, Y, 0.1, 1);
        if (k === 3) return mt(lacq, 0.08, X, Y, 0.3, 1);
        return ground;
      }
      if (pn.kind === "scroll" || pn.kind === "lost") {
        // (round 3, W2-10: a gold spiral band) a long run of clouds carved in the panel, the lacquer gone from their
        // faces so the stone shows, the gilt left only in the hollows here and there
        const k = carvedCloud(lx - pn.x0 + hash(pn.seed, 5, 335) * 0.6 * H, vy, FRIEZE * 0.34, 353 + pn.seed);
        if (k === 2) return mt(M.stone, (0.98 + (gilt ? 0 : -0.1)) * along + drip, X, Y, 0.05, 1);
        if (k === 1) return mt(M.stone, 0.72 * along + drip - (fbm(lx * 0.25, ly * 0.25, 355, 2) > 0.7 ? 0.08 : 0), X, Y, 0.05, 1);
        if (k === 3) return mt(lacq, 0.12, X, Y, 0.3, 1);
        return ground;
      }
      // cartouches: one or two along the panel, each its own knot
      const n = pw > 3.2 * H ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const cx = pn.x0 + (pw * (k + 0.5)) / n + (hash(pn.seed, k, 337) - 0.5) * 0.4 * H;
        const cw = (0.4 + 0.18 * hash(pn.seed, k + 3, 337)) * H;
        const ex = Math.abs(lx - cx) / cw, ey = Math.abs(vy) / (FRIEZE * 0.26);
        if (ex < 1 && ey < 1) {
          if (ex > 0.93 || ey > 0.84) return gilt ? mt(M.gold, 0.8 * along, X, Y, 0.1, 1) : mt(M.stone, 0.6, X, Y, 0.1, 1);
          const r = Math.hypot(lx - cx, vy);
          const style = hash(pn.seed, k + 9, 9);
          const knot = style < 0.4 ? r < 0.09 * H && r > 0.05 * H : style < 0.75 ? r < 0.08 * H && Math.sin(Math.atan2(vy, lx - cx) * 5) > 0.2 : Math.abs(lx - cx) + Math.abs(vy) < 0.08 * H;
          const tail = Math.abs(vy - Math.sin((lx - cx) * (0.1 + style * 0.06)) * 3) < 1.2 && Math.abs(lx - cx) > 0.12 * H && Math.abs(lx - cx) < cw * 0.8;
          if ((knot || tail) && gilt) return mt(M.gold, 0.72 * along, X, Y, 0.2, 1);
          return mt(lacq, face(0.9, SIDE) * 0.32 * along, X, Y, 0.15, 1);
        }
      }
      return ground;
    }
    // --- the spouts: a stone dragon's head under the frieze, its mouth dark, lit on top
    for (const sx of spouts) {
      const dx = lx - sx, dy = ly - F1;
      if (dy >= 0 && dy < 0.2 * H && Math.abs(dx) < 0.13 * H - dy * 0.25) {
        if (dy > 0.13 * H && Math.abs(dx) < 3) return tn(P.ink, 0.5, X, Y, 0);
        return mt(M.stone, face(0.95, SIDE, dx / (0.13 * H), dy < 3 ? -0.7 : 0.3) * 0.9, X, Y, 0.0, 1);
      }
    }
    const w = wet(lx, ly);
    // --- the wall: courses of different heights, blocks of different lengths, quoins at the corners
    let ri = 0;
    while (ri + 1 < rows.length && ly >= rows[ri]![1]) ri++;
    const [r0, r1] = rows[ri]!;
    const base = r0 >= baseTop;
    const inY = ly - r0;
    // the rock rising into the courses: chunks with flat tops, lit faces up and left, moss on their tops
    const rt = rockTop(lx);
    if (ly > rt) {
      const ch = chunkOf(lx), k = Math.floor(ch);
      const top = ly - rt < 3;
      if (top && hash(k, 3, 339) > 0.3) return tn(P.moss, 0.25 + (ly - rt) * 0.12, X, Y, 0.3);
      if (ch - k < 0.025) return tn(P.karst, 0.85, X, Y, 0);
      const crack = fbm(lx * 0.12, ly * 0.2, 341 + k, 2) > 0.7 ? -0.15 : 0;
      return mt(P.karst, face(0.95, SIDE, ch - k < 0.08 ? -0.7 : 0, ly - rt < 6 ? -0.7 : 0) * 0.72 + crack - ((ly - rt) / (2 * H)) * 0.25, X, Y, 0.1, 1);
    }
    // quoins: big dressed blocks at the corners, long and short by turns
    let quoin: { inX: number; w: number } | null = null;
    if (!base) for (const [cx, dir] of corners) {
      const qw = (ri % 2 ? 0.42 : 0.82) * H;
      const e = (lx - cx) * dir;
      if (e >= 0 && e < qw) { quoin = { inX: dir > 0 ? e : qw - e, w: qw }; break; }
    }
    const pc = !base ? pils.find((x) => Math.abs(lx - x) < PILW + 6) : undefined;
    if (pc !== undefined && !quoin) {
      const e = lx - pc;
      if (Math.abs(Math.abs(e) - PILW) < 1.5) return mt(M.stone, e < 0 ? 0.95 : 0.4, X, Y, 0.2, 1);
      if (e > PILW && e < PILW + 5) return mt(M.stone, 0.48, X, Y, 0.2, 1);
    }
    const patch = !base && !quoin && patchAt(lx, ly);
    const bw = base ? 1.3 * H : patch ? 0.34 * H : (r1 - r0 > 0.33 * H ? 0.9 : 0.58) * H + 0.3 * H * hash(ri, 2, 23);
    const blk = quoin ? { j: 9000 + ri, inX: quoin.inX, w: quoin.w } : blockAt(lx, bw, (ri % 2) * bw * 0.5 + (patch ? 11 : 0), 31 + ri * 7 + (patch ? 3 : 0), 0.6);
    // the patch is laid in thinner courses
    const subY = patch ? inY % (0.17 * H) : inY;
    if (blk.inX < (quoin ? 2 : 1.5) || subY < 1.5 || (base && blk.inX < 2.5)) {
      // the joints: moss and dark where the water runs
      if (w > 0.3) return tn(P.moss, 0.6, X, Y, 0.3);
      return mt(M.stone, 0.4 - (base ? 0.06 : 0) - w * 0.1, X, Y, 0.2, 1);
    }
    // (round 3, W2-10: L 141, sd 41: too even) each block its own value over a wider range
    const tone = (hash(blk.j, ri, 11) - 0.5) * 0.34 + (patch ? 0.08 : 0) + (quoin ? 0.1 : 0);
    const bev = quoin ? 4 : Math.max(2, Math.min(4, (Math.min(r1, f) - r0) * 0.12));
    const edge = subY < bev ? 0.12 : blk.inX < bev ? 0.07 : blk.w - blk.inX < bev ? -0.08 : r1 - ly < bev ? -0.07 : 0;
    const rough = base ? (fbm(lx * 0.09, ly * 0.12, 47, 3) - 0.5) * 0.3 : (fbm(lx * 0.15, ly * 0.15, 43, 2) - 0.5) * 0.1;
    const chipped = (base ? fbm(lx * 0.3, ly * 0.3, 53, 2) > 0.74 : fbm(lx * 0.3, ly * 0.3, 343, 2) > 0.8) ? -0.14 : 0;
    // a crack through a few blocks
    if (hash(blk.j, ri, 345) > 0.86 && Math.abs(blk.inX - blk.w * 0.5 - Math.sin(inY * 0.3) * 3 - inY * 0.3) < 0.8) return mt(M.stone, 0.3, X, Y, 0.2, 1);
    const ledgeShade = ly < F1 + 4 + 3 * hash(blk.j, 5, 3) ? -0.2 : 0;
    const damp = Math.max(0, 1 - (f - ly) / (0.6 * H)) * (0.12 + 0.12 * fbm(lx * 0.05, ly * 0.08, 59, 2));
    if (base && inY < 9) {
      const mm = clump(lx, 3, 1.4 * H, 71);
      if (mm > 0 && inY < mm * 0.7) return tn(P.moss, 0.3 + (inY / (mm * 0.7)) * 0.45, X, Y, 0.3);
    }
    if (w > 0.55 && fbm(lx * 0.2, ly * 0.2, 347, 2) > 0.45) return tn(P.moss, 0.5 + (1 - w) * 0.4, X, Y, 0.3);
    if (damp > 0.14 && fbm(lx * 0.14, ly * 0.14, 67, 2) > 0.6) return tn(P.moss, 0.55 + damp, X, Y, 0.35);
    // (round 3, W2-10) a wet band right under the frieze where the coping's water runs, streaked; the lowest courses
    // darker and greener with the damp coming up out of the rock
    const wetBand = ly - F1 < 0.2 * H + 0.08 * H * vnoise(lx * 0.05, 3, 357) && vnoise(lx * 0.12, ly * 0.02, 359) > 0.32 ? 0.16 : 0;
    const low = clamp((ly - (baseTop - 0.9 * H)) / (0.9 * H), 0, 1);
    const v0 = 0.72 + tone + edge + rough + chipped + ledgeShade - w * 0.3 - damp - wetBand - ((ly - F1) / H) * 0.025;
    if (low > 0.15 && bayer4(X, Y) < low * 0.85) return mt(GREEN_STONE, v0 - low * 0.12, X, Y, 0.05, 1);
    return mt(M.stone, v0, X, Y, 0.05, 1);
  });
  // (round 3, W2-10) the court's crest at the frieze's middle: crossed blades in a gold ring on the old lacquer
  {
    const cy = COPE + FRIEZE / 2, r = Math.round(0.23 * H);
    rect(c, centre - r - 2, cy - r - 2, centre + r + 2, cy + r + 2, (X, Y, lx, ly) => {
      const d = Math.hypot(lx - centre, ly - cy);
      if (d > r + 1) return 0;
      if (d > r - 2.5) return mt(M.gold, face(0.95, SIDE, (lx - centre) / r, (ly - cy) / r) * 0.95, X, Y, 0.0, 1);
      if (d > r - 4) return mt(lacq, 0.2, X, Y, 0.2, 1);
      return mt(lacq, face(0.9, SIDE) * 0.4, X, Y, 0.15, 1);
    });
    crossedBlades(c, centre, cy, r - 6, (X, Y, _lx, ly) => tn(M.gold, ly < cy ? 0.05 : 0.35, X, Y, 0), (X, Y) => tn(lacq, 0.6, X, Y, 0), (X, Y) => tn(lacq, 0.55, X, Y, 0));
  }
}

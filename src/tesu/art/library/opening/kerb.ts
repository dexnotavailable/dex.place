// The rock at a paved road's front edge (art loop round 5; Dex: "the stone textures should have
// spots and chunks that overlap in front of the paved path"). Shared by the road's rock (rock.ts,
// cap "path"), which paints the chunks, their shadows on the kerb and on the face, and the loose
// stones on the road; and by the balustrade (props.ts, op.rail, on the front plane), which paints
// again the tops of the chunks that rise past the road's edge, so they stand in front of its post
// feet instead of behind them.
//
// The chunks are pieces of the cliff rising from below and breaking the road's edge, never
// cushions hung on the kerb (round 4's critic): each is a block of the face with its own top (a
// tall one rising past the walk line, a low slab cracked through, a middling block), a lit top
// ledge and left flank, its face turning into shade on the right, a bedding joint or two across it,
// a crevice down its right side. Its foot is a joint with the face below it, and a contact shadow
// under it; its right side throws a shadow on the kerb and the soil behind it. Values differ: in
// each group one chunk stands nearest, darker and crisper. Groups stand at irregular gaps, alone or
// two or three overlapping. Loose stones and grit lie on the road near them.
//
// They are laid by level-1 world x (a road's rock piece and its balustrade both sit at the world's
// origin), in cells, so every painter of the road finds the same chunks at the same place.
//
// (round 7, Dex: "I want these blocks that come out to come from the texture below also; right now
// it's just tiny little parts. If they can be the big ones coming from the stone part below, that
// would be awesome.") Every chunk is now a block OF THE FACE: rendered by the face's own block model
// (face.ts shadeBlock: the same strata, joints, value, light, weathering streaks, wet grooves and moss
// ledges as the cliff below the road), its body running down into the face to a foot 40-130 px below
// the walk line, where it stands forward of the face's next blocks and throws its shadow on them. The
// crags are few and big: most cells hold one block rising 24-38 px past the walk line, 100-160 px wide,
// sometimes with a lower block stepping down beside it; others a small one, or none; they never stand
// at a gate's pillar or in front of the terrace. They still overlap the road's grass and soil band.
// Their pixels depend only on their own geometry and the level (never on the rock piece's seed), so
// the balustrade on the front plane paints exactly the same block tops in front of its post feet.

import { P } from "../../palette.ts";
import { clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { shadeBlock, type Chunk, type FaceOpts } from "./face.ts";

export interface KerbRock {
  kind: "crag" | "tall" | "block" | "slab" | "pebble";
  x0: number;
  x1: number;
  /** Its top's and its foot's depth below the walk line, px (a top above the walk line is negative). */
  top: number;
  foot: number;
  /** Its top's tilt, px down per px to the right. */
  tilt: number;
  /** 0 set back (paler, softer) .. 1 standing forward (its left flank lit). */
  z: number;
  /** The nearest of its group: darker, crisper, the darkest darks. */
  near: boolean;
  /** Moss on its top ledge, px (0: bare). */
  cap: number;
  seed: number;
}

const CELL = 600;

/**
 * World x of the path pines standing on Gate Road's front edge (gate-road.ts places them at 111.6 H
 * and 129.9 H). No chunk is laid where one grips the edge (its own painter paints the block it
 * grips), and the balustrade breaks round its trunk (two posts flank it), so the rail never
 * passes in front of a tree whose roots pour over the edge in front of it.
 */
export const ROAD_PINES = [111.6 * 96, 129.9 * 96];
/** The balustrade's break round a path pine's trunk, px either side of it. */
export const PINE_GAP = 15;
const SALT = 0x6b3d1;

/**
 * (round 7) World x of Gate Road's gates (world/sections/common.ts ROAD_GATE_XS; torii-1021, thinned:
 * the two framed gates at 115 and 119 H, the tunnel's three at 130.4, 135.2 and 140 H): no crag
 * stands at a gate's foot. The gates are seen side-on (the architecture lane, round 7), their pillars
 * standing at the gate's x, the near one in front of the road.
 */
export const ROAD_GATES: readonly number[] = [115, 119, 130.4, 135.2, 140].map((x) => x * 96);
/** The viewing terrace's cut-stone platform (gate-road.ts, 124 to 128.6 H): no crag rises in front of it. */
const TERRACE: readonly [number, number] = [124 * 96 - 30, 128.6 * 96 + 30];

/** Gate Road's rock band (gate-road.ts: from the jetty's end at 108.8 H to the hall door at 146.4 H). */
const GATE_ROAD: readonly [number, number] = [108.8 * 96, 146.4 * 96];

/**
 * (round 7) Gate Road's crags, placed by hand for the frames that show it (the critic: "one big crag
 * per frame, 100-160 px wide, rising 25-40 px over the road ... one small one"): each stands in a gap
 * of the road's own furniture (clear of the path pine at 111.6 H, the gates' feet and the terrace),
 * the big ones with a lower block stepping down beside them. [x0 (H), width, rise, foot, z, the lower
 * block's side (-1 left, 1 right, 0 none), its width, its rise]. Their seeds are fixed, so the rock
 * under the road and the balustrade find the same blocks.
 */
const PLACED: readonly (readonly number[])[] = [
  // between the road's start and the pine: a small block at the rail's first post
  [109.95, 70, 9, 46, 0.48, 0, 0, 0],
  // between the pine and gate 1 (play-east, jetty-6s, guard-gate1): the big one, a low step down on its
  // right (clear of where she starts from a Gate Road link, 113.5 H)
  [112.2, 104, 31, 116, 0.74, 1, 36, 8],
  // between gates 1 and 2 (guard-gate1, guard-gates): big. (round 7, the integration) Fitted between
  // gate 1's east leg (116.3 H) and the paifang's west strut (117.9 H), which now stand on the road
  // where it is: at 116.75 H, 128 px wide with a step on its right, it stood under the strut's footing.
  [116.67, 92, 28, 104, 0.72, 0, 0, 0],
  // past the paifang (before torii-1021: between gates 2 and 3): small
  [120.3, 62, 12, 52, 0.5, 0, 0, 0],
  // in the tunnel, between its first and second gates (torii-1021; before, its second and third): big, no step
  [133.33, 120, 26, 96, 0.74, 0, 0, 0],
  // between the tunnel's second and third gates (torii-1021; before, its fourth and fifth): small
  [138.55, 58, 10, 44, 0.5, 0, 0, 0],
  // the last stretch before the hall door: small, a step down on its left
  [143.0, 70, 14, 58, 0.54, -1, 30, 5],
];
const GATE_ROAD_CRAGS: readonly KerbRock[] = PLACED.flatMap(([xh, w, rise, foot, z, side, bw, brise], k) => {
  const x0 = xh! * 96, seed = 70001 + k * 7919;
  const main: KerbRock = { kind: "crag", x0, x1: x0 + w!, top: -rise!, foot: foot!, tilt: (hash1(k, SALT + 11) - 0.5) * 0.04, z: z!, near: w! > 90, cap: 2.2 + 2 * hash1(k, SALT + 12), seed };
  if (!side) return [main];
  const bx = side! < 0 ? x0 - bw! * 0.8 : x0 + w! - bw! * 0.2;
  return [{ kind: "crag", x0: bx, x1: bx + bw!, top: -brise!, foot: foot! * 0.62, tilt: (hash1(k, SALT + 13) - 0.5) * 0.08, z: z! - 0.16, near: false, cap: 1.6 + 1.6 * hash1(k, SALT + 14), seed: seed + 1 }, main];
});
const clearOfGates = (a: number, b: number): boolean => ROAD_GATES.every((gx) => b < gx - 40 || a > gx + 40) && (b < TERRACE[0] || a > TERRACE[1]);

const cells = new Map<number, KerbRock[]>();

/**
 * The chunks laid in cell i (by world x), in paint order (later ones in front).
 *
 * (round 6, the critic: "a bead row of same-size cubes hung under the kerb like corbels") (round 7,
 * the critic: "every crag is the same narrow buttress ... at near-even gaps of about 170 px, a picket";
 * Dex: "the big ones coming from the stone part below") A cell (600 px) holds at most one CRAG, a block
 * of the face rising past the walk line: a big one (four cells in ten: 100-160 px wide, its top 24-38 px
 * over the road, its body running 80-130 px down the face) or a small one (a third: 44-78 px wide, 7-16
 * px over the road), placed anywhere in the cell, so the gaps run from nothing to two frames. A big one
 * has a lower block stepping down beside it two times in three (the sketch's stepped skyline), set back
 * a little and darker. Elsewhere the edge stays low: a slab or a block of the face now and then.
 */
function cell(i: number): KerbRock[] {
  const hit = cells.get(i);
  if (hit) return hit;
  const r = rng(((i * 2654435761) ^ SALT) >>> 0);
  const out: KerbRock[] = [];
  const pebbles: KerbRock[] = [];
  const cx = i * CELL;
  const taken: [number, number][] = [];
  const free = (a: number, b: number): boolean => taken.every(([u, v]) => b < u - 18 || a > v + 18);
  // the crag (and the lower block stepping down beside it)
  const roll = r();
  if (roll < 0.74) {
    const big = roll < 0.4;
    const w = big ? 100 + r() * 60 : 44 + r() * 34;
    let x0 = cx + 40 + r() * (CELL - w - 80);
    // (clear of a path pine's grip: shifted off it)
    for (const px of ROAD_PINES) if (x0 + w > px - 40 && x0 < px + 44) x0 = x0 + w / 2 < px ? px - 42 - w : px + 46;
    const rise = big ? 24 + r() * 14 : 7 + r() * 9;
    const crag: KerbRock = { kind: "crag", x0, x1: x0 + w, top: -rise, foot: big ? 80 + r() * 50 : 40 + r() * 30, tilt: (r() - 0.5) * 0.05, z: big ? 0.68 + 0.1 * r() : 0.44 + 0.16 * r(), near: big, cap: 2 + r() * 2.4, seed: Math.floor(r() * 1e6) };
    // the lower block beside it: drawn from the stream whether or not it stands, so the cells stay put
    const side = r() < 0.5 ? -1 : 1, step = r() < (big ? 0.66 : 0.25);
    const bw = w * (0.32 + 0.24 * r()), bo = r(), brise = rise * (0.25 + 0.35 * r()), bfoot = crag.foot * (0.5 + 0.3 * r());
    const bz = crag.z - 0.14 - 0.12 * r(), bcap = r() < 0.7 ? 1.5 + r() * 2 : 0, bseed = Math.floor(r() * 1e6), btilt = (r() - 0.5) * 0.08;
    const bx = side < 0 ? x0 - bw * (0.72 + 0.18 * bo) : x0 + w - bw * (0.1 + 0.18 * bo);
    const a = step ? Math.min(bx, x0) : x0, b = step ? Math.max(bx + bw, x0 + w) : x0 + w;
    if (clearOfGates(a, b)) {
      if (step) out.push({ kind: "crag", x0: bx, x1: bx + bw, top: -brise, foot: bfoot, tilt: btilt, z: bz, near: false, cap: bcap, seed: bseed });
      out.push(crag);
      taken.push([a, b]);
      // grit and a stone or two kicked onto the road beside it
      for (let n2 = 0, nP = r() < 0.4 ? 1 : 2; n2 < nP; n2++) {
        const pw = 2.5 + r() * 4, px0 = r() < 0.5 ? a - 6 - pw - r() * 22 : b + 3 + r() * 22;
        pebbles.push({ kind: "pebble", x0: px0, x1: px0 + pw, top: -(1.4 + pw * (0.25 + 0.2 * r())), foot: 1.6, tilt: 0, z: 0.5 + 0.5 * r(), near: false, cap: 0, seed: Math.floor(r() * 1e6) });
      }
    }
  }
  // the low edge: now and then a slab or a block of the face at the kerb, each its own size and height
  if (r() < 0.55) {
    for (let tries = 0; tries < 4; tries++) {
      const n = r() < 0.6 ? 1 : 2;
      const run: KerbRock[] = [];
      let x = cx + r() * (CELL - 60);
      for (let k = 0; k < n; k++) {
        const slab = r() < 0.6;
        const w = slab ? 30 + r() * 44 : 16 + r() * 18;
        const q: KerbRock = slab
          ? { kind: "slab", x0: x, x1: x + w, top: 0.4 + r() * 2.2, foot: 10 + r() * 10, tilt: (r() - 0.5) * 0.05, z: 0.3 + 0.35 * r(), near: false, cap: r() < 0.45 ? 1 + r() * 1.6 : 0, seed: Math.floor(r() * 1e6) }
          : { kind: "block", x0: x, x1: x + w, top: -1.5 + r() * 4.5, foot: 16 + r() * 18, tilt: (r() - 0.5) * 0.14, z: 0.25 + 0.45 * r(), near: false, cap: r() < 0.55 ? 1.3 + r() * 2 : 0, seed: Math.floor(r() * 1e6) };
        const prev = run[run.length - 1];
        if (prev && Math.abs(q.top - prev.top) < 2.2) q.top = prev.top + (q.top < prev.top ? -2.6 : 2.6);
        run.push(q);
        x += w - (r() < 0.5 ? 0 : 1 + r() * 3);
      }
      const a = run[0]!.x0, b = run[run.length - 1]!.x1;
      if (!free(a, b) || !clearOfGates(a, b)) continue;
      taken.push([a, b]);
      run.sort((a2, b2) => a2.z - b2.z);
      out.unshift(...run);
      if (r() < 0.4) {
        const pw = 2 + r() * 3.5, px0 = r() < 0.5 ? a - 4 - pw - r() * 16 : b + 2 + r() * 16;
        pebbles.push({ kind: "pebble", x0: px0, x1: px0 + pw, top: -(1.2 + pw * 0.3), foot: 1.6, tilt: 0, z: 0.5 + 0.5 * r(), near: false, cap: 0, seed: Math.floor(r() * 1e6) });
      }
      break;
    }
  }
  // (round 7) on Gate Road the crags are placed by hand (GATE_ROAD_CRAGS): the cells keep only their
  // low stones there, clear of the placed ones
  let laid = [...pebbles, ...out];
  if (cx + CELL > GATE_ROAD[0] && cx < GATE_ROAD[1]) {
    const placed = GATE_ROAD_CRAGS.filter((q) => q.x0 >= cx && q.x0 < cx + CELL);
    const near = GATE_ROAD_CRAGS.filter((q) => q.x1 > cx - 60 && q.x0 < cx + CELL + 60);
    laid = laid.filter((q) => (q.x0 < GATE_ROAD[0] || q.x0 > GATE_ROAD[1] || q.kind !== "crag") && !near.some((g) => q.x1 > g.x0 - 18 && q.x0 < g.x1 + 18));
    laid.push(...placed);
  }
  // stones lie on the road behind the kerb: painted first, so a chunk in front covers them
  // (none where a path pine grips the edge)
  const all = laid.filter((q) => !ROAD_PINES.some((px) => q.x1 > px - 36 && q.x0 < px + 40));
  cells.set(i, all);
  return all;
}

/** The chunks (and loose stones) whose span may reach [x0, x1], in paint order. */
export function kerbRocks(x0: number, x1: number): KerbRock[] {
  const out: KerbRock[] = [];
  for (let i = Math.floor(x0 / CELL) - 1; i <= Math.floor(x1 / CELL) + 1; i++) out.push(...cell(i));
  return out;
}

/** The deepest a chunk's foot reaches, px, with the shadow it throws on the face's block under it. */
export const KERB_DEPTH = 170;
/** How far past its right side a chunk's cast shadow can reach, px (painters' search margins). */
export const KERB_REACH = 30;

const wb = (v: number, s: number): number => (vnoise1(v / 6.5, s) - 0.5) * 1.5 + (vnoise1(v / 2.2, s + 1) - 0.5) * 0.7;

/**
 * Its sides at depth. (round 7) A block of the face: its sides are the face's joints, near upright,
 * each leaning its own way a little and wandering slowly down the face like the face's own joints
 * (face.ts jointX), with a hand wobble; never a flared buttress.
 */
function sides(q: KerbRock, depth: number): [number, number] {
  if (q.kind === "pebble") return [q.x0, q.x1];
  const H = Math.max(1, q.foot - q.top);
  const v = clamp((depth - q.top) / H, 0, 1);
  const w = q.x1 - q.x0;
  const ll = (hash1(15, q.seed) - 0.5) * Math.min(6, w * 0.06), rl = (hash1(16, q.seed) - 0.5) * Math.min(6, w * 0.06);
  const wl = (vnoise1(depth / 52 + 3.1, q.seed + 159) - 0.5) * Math.min(7, w * 0.07) + (vnoise1(depth / 9, q.seed + 160) - 0.5) * 1.4;
  const wr = (vnoise1(depth / 52 + 7.7, q.seed + 161) - 0.5) * Math.min(7, w * 0.07) + (vnoise1(depth / 9, q.seed + 162) - 0.5) * 1.4;
  return [q.x0 + ll * (1 - v) + wl, q.x1 + rl * (1 - v) + wr];
}

/** Its top at x: flat-ish and tilted, chipped at the top corners only; a slab steps down at its crack. */
export function kerbTop(q: KerbRock, lx: number): number {
  const w = Math.max(1, q.x1 - q.x0), e = Math.min(lx - q.x0, q.x1 - lx);
  if (q.kind === "pebble") {
    const u = (lx - q.x0) / w * 2 - 1;
    return q.top + (q.foot - q.top) * Math.pow(Math.abs(u), 2.2) * 0.9;
  }
  let t = q.top + q.tilt * (lx - q.x0) + wb(lx, q.seed) * 0.6;
  if (q.kind === "crag") {
    // a flat ledge (the sketch's chunk tops) broken along a joint: one part a step lower, a short
    // slant between, its corners chipped
    // (round 7: a big block's step is bigger, a stepped skyline of its own)
    const u = (lx - q.x0) / w, su = 0.28 + 0.44 * hash1(17, q.seed);
    const f = clamp((u - su) * w / 2.4 + 0.5, 0, 1);
    t += (hash1(19, q.seed) < 0.5 ? f : 1 - f) * (2 + 4 * hash1(18, q.seed)) * (0.8 + Math.min(1, w / 200));
    const rc = Math.min(5, w * 0.08);
    if (e < rc) t += (rc - e) * 1.1;
    return t;
  }
  if (q.kind !== "slab") {
    // its crown: a high point off-centre, the top falling away to each side in facets
    const u = (lx - q.x0) / w, up = 0.22 + 0.5 * hash1(17, q.seed);
    const dl = (0.4 + 2.2 * hash1(18, q.seed)) * Math.min(1, w / 24), dr = (0.6 + 2.8 * hash1(19, q.seed)) * Math.min(1, w / 24);
    t += u < up ? dl * Math.pow(1 - u / up, 1.6) : dr * Math.pow((u - up) / (1 - up), 2);
  }
  const rc = Math.min(3, w * 0.12);
  if (e < rc) t += (rc - e) * 0.9;
  if (q.kind === "slab" && (lx - q.x0) / w > crackU(q)) t += 1 + 1.6 * hash1(5, q.seed);
  return t;
}

/** Its foot at x: a joint with the face below, broken along it into steps (never a rounded bottom). */
export function kerbFoot(q: KerbRock, lx: number): number {
  if (q.kind === "pebble") return q.foot;
  const w = Math.max(1, q.x1 - q.x0), u = (lx - q.x0) / w;
  let f = q.foot + wb(lx * 1.4, q.seed + 7) * 1.3;
  if (q.kind === "crag") {
    // broken off along its joints in three steps of their own depths, never a ruled bottom
    const k = Math.min(2, Math.floor(u * 3 + (hash1(28, q.seed) - 0.5) * 0.8));
    return f + (hash1(29 + k, q.seed) - 0.5) * 16 + wb(lx * 3, q.seed + 9) * 1.2;
  }
  const st = 0.3 + 0.4 * hash1(8, q.seed);
  if (u > st) f += (hash1(9, q.seed) < 0.5 ? 1 : -1) * (2 + 5 * hash1(10, q.seed)) * Math.min(1, (q.foot - q.top) / 30);
  return f;
}

const crackU = (q: KerbRock): number => 0.32 + 0.36 * hash1(4, q.seed);

/** Is (lx, depth) inside the chunk? */
export function inKerb(q: KerbRock, lx: number, depth: number): boolean {
  if (lx < q.x0 - 4 || lx > q.x1 + 4) return false;
  const [a, b] = sides(q, depth);
  if (lx < a || lx > b) return false;
  return depth >= kerbTop(q, lx) && depth <= kerbFoot(q, lx);
}

/** The front-most chunk holding (lx, depth), or null. */
export function kerbAt(R: readonly KerbRock[], lx: number, depth: number): KerbRock | null {
  let hit: KerbRock | null = null;
  for (const q of R) if (inKerb(q, lx, depth)) hit = q;
  return hit;
}

/**
 * The shade a chunk throws on what lies behind it at (lx, depth): 1 its shadow, 0 none.
 *
 * (round 7) As the face's own blocks do (face.ts): a block standing forward of its right-hand
 * neighbour casts a shadow on it, down and to the right (the sun is up and left), wider lower down,
 * its edge wobbling; and the face's block under its foot lies in the shadow of its overhang. On the
 * road it falls across the flagstones, the kerb and the soil band to its right.
 */
export function kerbShade(R: readonly KerbRock[], lx: number, depth: number): number {
  for (const q of R) {
    if (lx < q.x0 - 8 || lx > q.x1 + KERB_REACH) continue;
    if (q.kind === "pebble") {
      if (inKerb(q, lx - 1.6, depth - 1) || inKerb(q, lx - 0.8, depth - 0.5)) return 1;
      continue;
    }
    const dz = clamp(q.z - 0.42, 0.08, 0.5);
    // cast to the right, its top edge sloping down as it reaches out
    const [, Rr] = sides(q, depth);
    const out = lx - Rr;
    if (out > 0) {
      const tr = kerbTop(q, q.x1 - 1), fr = kerbFoot(q, q.x1 - 1);
      const reach = 1.5 + dz * 26 + Math.max(0, depth - tr) * 0.05 + (vnoise1(depth / 6, q.seed + 181) - 0.5) * 2.2;
      if (out < reach && depth > tr + out * 0.55 && depth < fr + out * 0.55) return 1;
      continue;
    }
    // under its foot: the overhang's shadow on the block below
    const [Ll] = sides(q, depth);
    if (lx < Ll) continue;
    const f = kerbFoot(q, lx), under = depth - f;
    if (under > 0 && under < 2 + dz * 24 + (vnoise1(lx / 7, q.seed + 184) - 0.5) * 2) return 1;
  }
  return 0;
}

/** The face model a chunk is rendered with: the road band's own (veg 0.7, no extra shade). */
const KFACE: FaceOpts = { veg: 0.7 };
const KSEED = 0x51c3a;
/** Block-local rows: a chunk's rows are its depths below the walk line, shifted off zero. */
const KROW = 900;

/**
 * A pixel of the chunk q at (lx, depth), at density d (frame px x, y for the dither).
 *
 * (round 7) A block of the face, rendered by the face's own block model (face.ts shadeBlock): it
 * stands forward of its neighbours (its left flank catching the sun, its right turning into shade),
 * its top a ledge carrying a cap of moss with the shadow under the moss and a lit rim, its body
 * broken (when big) along a joint and a bedding plane of its own into parts, weathering streaks, wet
 * grooves from the ledge, the odd crack and fine bedding line; its underside in shade where it stands
 * on the face's next block, a dark joint at its foot and a dark crevice down its right side. Values
 * and ramps are the face's (rock.ts), so it is the cliff below the road rising past it.
 */
export function kerbPx(q: KerbRock, lx: number, depth: number, d: number, x: number, y: number): number {
  const px = 1 / Math.max(d, 0.25);
  const T = kerbTop(q, lx), F = kerbFoot(q, lx);
  const [L, R] = sides(q, depth);
  if (q.kind === "pebble") {
    // a loose stone on the road: lit on top and to the left, dark under it and to the right
    const s = depth - T, w = Math.max(1, R - L), u = (lx - L) / w;
    if (s < px * 0.9) return u < 0.6 ? P.karst[1]! : P.karst[3]!;
    if (F - depth < px * 0.9 || R - lx < px * 0.8) return P.karst[7]!;
    return u < 0.35 ? P.karst[3]! : u < 0.75 ? P.karst[4]! : P.karst[6]!;
  }
  const C: Chunk = { L: 4001 + (q.seed % 4093), k: q.seed % 7, xl: L, xr: R, yt: T + KROW, yb: F + KROW, z: q.z, w: q.x1 - q.x0, xc: (q.x0 + q.x1) / 2 };
  const sd = KSEED + (q.seed % 1009);
  const ly = depth + KROW;
  // its neighbours: the face's blocks either side sit back of it, the air over its top (a ledge), the
  // block it stands on sits back (its underside in shade)
  const out = shadeBlock(C, q.z - 0.32, q.z - 0.28, q.z - 0.5, q.z - 0.3, lx, ly, Math.max(0, depth - T), KFACE, sd, d);
  // (the nearest stone in the frame, in front of the road: a step darker than the face behind it,
  // however far forward it stands among the face's blocks)
  let t = out.t + (q.near ? 0.13 : 0.04);
  // its silhouette: a dark crevice down its right side where it turns away, the joint at its foot
  const edge = R - lx < px * (q.near ? 1.4 : 1.05) || F - depth < px * 1.05;
  if (edge) t = Math.max(t + 0.28, 0.78);
  // the face's slow tone noise (rock.ts), so no wide area sits on a ramp seam
  t += (vnoise(lx / 7, ly / 7, sd + 201) - 0.5) * 0.06;
  if (out.mat === "moss" && !edge) return tone(P.moss, clamp(t + 0.1, 0, 1), x, y, 0.12);
  if (out.mat === "warm" && t < 0.42 && !edge && lx - L > px) return tone(P.stone, clamp(t * 0.9, 0, 1), x, y, 0.12);
  return tone(P.karst, clamp(t, 0, 1), x, y, 0.12);
}

/** Grit on the road's lit top near the chunks: a darker or lighter fleck, or 0. */
export function kerbGrit(R: readonly KerbRock[], lx: number, depth: number): number {
  const h0 = hash(Math.floor(lx), Math.floor(depth * 2), SALT + 5);
  if (h0 > 0.16) return 0;
  for (const q of R) {
    if (q.kind === "pebble") continue;
    const dx = lx < q.x0 ? q.x0 - lx : lx > q.x1 ? lx - q.x1 : 0;
    if (dx < 14 * hash1(Math.floor(lx / 5), q.seed + 40) + 2) return h0 < 0.07 ? P.karst[5]! : P.karst[2]!;
  }
  return 0;
}

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

import { P } from "../../palette.ts";
import { clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";

export interface KerbRock {
  kind: "tall" | "block" | "slab" | "pebble";
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

const CELL = 280;

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

const cells = new Map<number, KerbRock[]>();

/** The chunks laid in cell i (by world x), in paint order (later ones in front). */
function cell(i: number): KerbRock[] {
  const hit = cells.get(i);
  if (hit) return hit;
  const r = rng(((i * 2654435761) ^ SALT) >>> 0);
  const out: KerbRock[] = [];
  const pebbles: KerbRock[] = [];
  const cx = i * CELL;
  // one to three rocky stretches a cell at irregular gaps (a long gap now and then): each a run
  // of chunks of the cliff side by side (a single big one now and then), their tops stepping up
  // and down like the skyline of Dex's sketch; at most one in a run rises past the walk line
  const nS = r() < 0.15 ? 1 : r() < 0.72 ? 2 : 3;
  let sx = cx + 4 + r() * 40;
  for (let g = 0; g < nS; g++) {
    const n = r() < 0.22 ? 1 : 2 + Math.floor(r() * 3.3);
    const run: KerbRock[] = [];
    let x = sx;
    let tall = false;
    for (let k = 0; k < n; k++) {
      const kr = r();
      const kind: KerbRock["kind"] = !tall && kr < (n === 1 ? 0.7 : 0.4) ? "tall" : kr < 0.66 ? "block" : "slab";
      if (kind === "tall") tall = true;
      const w = kind === "tall" ? 22 + r() * 22 : kind === "slab" ? 24 + r() * 26 : 11 + r() * 19;
      const q = make(kind, x, r, w);
      // neighbours never stand at one height: a step of 2 px or more between them
      const prev = run[run.length - 1];
      if (prev && Math.abs(q.top - prev.top) < 2.2) q.top = prev.top + (q.top < prev.top ? -2.6 : 2.6);
      run.push(q);
      x += w - (r() < 0.5 ? 0 : 1 + r() * 3);
    }
    // painted back to front (the more forward ones over their neighbours' joints); one of them
    // stands nearest, darker and crisper, last
    run.sort((a2, b2) => a2.z - b2.z);
    if (run.length > 1 || r() < 0.35) run[run.length - 1]!.near = true;
    out.push(...run);
    // loose stones and grit fallen on the road by it
    const nP = r() < 0.25 ? 0 : r() < 0.65 ? 1 : 2;
    for (let n2 = 0; n2 < nP; n2++) {
      const w = 2.5 + r() * 4;
      const px0 = (r() < 0.5 ? sx - 4 - w - r() * 24 : x + 2 + r() * 24);
      pebbles.push({ kind: "pebble", x0: px0, x1: px0 + w, top: -(1.4 + w * (0.25 + 0.2 * r())), foot: 1.6, tilt: 0, z: 0.5 + 0.5 * r(), near: false, cap: 0, seed: Math.floor(r() * 1e6) });
    }
    sx = x + 34 + r() * (r() < 0.3 ? 170 : 80);
    if (sx > cx + CELL - 20) break;
  }
  // a stone alone now and then, away from the chunks
  if (r() < 0.45) {
    const w = 2 + r() * 3.5, px0 = cx + r() * CELL;
    pebbles.push({ kind: "pebble", x0: px0, x1: px0 + w, top: -(1.2 + w * 0.3), foot: 1.6, tilt: 0, z: 0.5 + 0.5 * r(), near: false, cap: 0, seed: Math.floor(r() * 1e6) });
  }
  // stones lie on the road behind the kerb: painted first, so a chunk in front covers them
  // (none where a path pine grips the edge)
  const all = [...pebbles, ...out].filter((q) => !ROAD_PINES.some((px) => q.x1 > px - 36 && q.x0 < px + 40));
  cells.set(i, all);
  return all;
}

function make(kind: KerbRock["kind"], x0: number, r: () => number, wIn?: number): KerbRock {
  const seed = Math.floor(r() * 1e6);
  if (kind === "tall") {
    // a block of the cliff rising past the road's edge: broader than it rises, its top a flat
    // ledge that slants and steps (Dex's sketch), mostly capped with green
    const w = wIn ?? 26 + r() * 24;
    return { kind, x0, x1: x0 + w, top: -(4 + r() * 7), foot: 30 + r() * 26, tilt: (r() - 0.5) * 0.18, z: 0.65 + 0.35 * r(), near: false, cap: r() < 0.7 ? 2 + r() * 2.2 : 0, seed };
  }
  if (kind === "slab") {
    // a low slab at the kerb, cracked through, its right part sunk a little
    const w = wIn ?? 38 + r() * 30;
    return { kind, x0, x1: x0 + w, top: 0.2 + r() * 1.8, foot: 10 + r() * 7, tilt: (r() - 0.5) * 0.05, z: 0.3 + 0.5 * r(), near: false, cap: r() < 0.4 ? 1 + r() * 1.6 : 0, seed };
  }
  const w = wIn ?? 16 + r() * 22;
  return { kind, x0, x1: x0 + w, top: -2 + r() * 6, foot: 20 + r() * 20, tilt: (r() - 0.5) * 0.14, z: 0.1 + 0.8 * r(), near: false, cap: r() < 0.6 ? 1.4 + r() * 2.4 : 0, seed };
}

/** The chunks (and loose stones) whose span may reach [x0, x1], in paint order. */
export function kerbRocks(x0: number, x1: number): KerbRock[] {
  const out: KerbRock[] = [];
  for (let i = Math.floor(x0 / CELL) - 1; i <= Math.floor(x1 / CELL) + 1; i++) out.push(...cell(i));
  return out;
}

/** The deepest a chunk's foot reaches, px (and its contact shadow). */
export const KERB_DEPTH = 76;

const wb = (v: number, s: number): number => (vnoise1(v / 6.5, s) - 0.5) * 1.5 + (vnoise1(v / 2.2, s + 1) - 0.5) * 0.7;

/** Its sides at depth (each leaning its own way a little, battered, wobbling). */
function sides(q: KerbRock, depth: number): [number, number] {
  if (q.kind === "pebble") return [q.x0, q.x1];
  const H = Math.max(1, q.foot - q.top);
  const v = clamp((depth - q.top) / H, 0, 1);
  const w = q.x1 - q.x0;
  const ll = (hash1(15, q.seed) - 0.4) * Math.min(5, w * 0.16), rl = (hash1(16, q.seed) - 0.6) * Math.min(4, w * 0.12);
  return [q.x0 + ll * (1 - v) + wb(depth, q.seed + 2) * 0.8, q.x1 + rl * (1 - v) + wb(depth, q.seed + 3) * 0.8];
}

/** Its top at x: flat-ish and tilted, chipped at the top corners only; a slab steps down at its crack. */
export function kerbTop(q: KerbRock, lx: number): number {
  const w = Math.max(1, q.x1 - q.x0), e = Math.min(lx - q.x0, q.x1 - lx);
  if (q.kind === "pebble") {
    const u = (lx - q.x0) / w * 2 - 1;
    return q.top + (q.foot - q.top) * Math.pow(Math.abs(u), 2.2) * 0.9;
  }
  let t = q.top + q.tilt * (lx - q.x0) + wb(lx, q.seed) * 0.6;
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
 * The shade a chunk throws on what lies behind it at (lx, depth): 2 its contact shadow on the
 * face right under its foot, 1 its cast shadow (down and to the right: the sun is up and left), 0
 * none.
 */
export function kerbShade(R: readonly KerbRock[], lx: number, depth: number): number {
  let s = 0;
  for (const q of R) {
    if (lx < q.x0 - 1 || lx > q.x1 + 9) continue;
    if (q.kind !== "pebble") {
      const f = kerbFoot(q, lx);
      if (depth > f && depth < f + 2.2 + 2.2 * q.z && lx > q.x0 + 1 && lx < q.x1 + 1.5) return 2;
    }
    const reach = q.kind === "pebble" ? 1.6 : 2.5 + 4 * q.z + (q.near ? 2 : 0);
    if (inKerb(q, lx - reach, depth - reach * 0.6) || inKerb(q, lx - reach * 0.5, depth - reach * 0.3)) s = 1;
  }
  return s;
}

/** A pixel of the chunk q at (lx, depth), at density d (frame px x, y for the dither). */
export function kerbPx(q: KerbRock, lx: number, depth: number, d: number, x: number, y: number): number {
  const px = 1 / Math.max(d, 0.25);
  const T = kerbTop(q, lx), F = kerbFoot(q, lx);
  const s = depth - T, H = Math.max(1, F - T);
  const [L, R] = sides(q, depth);
  const w = Math.max(1, R - L), u = (lx - L) / w;
  if (q.kind === "pebble") {
    // a loose stone on the road: lit on top and to the left, dark under it and to the right
    if (s < px * 0.9) return u < 0.6 ? P.karst[1]! : P.karst[3]!;
    if (F - depth < px * 0.9 || R - lx < px * 0.8) return P.karst[7]!;
    return u < 0.35 ? P.karst[3]! : u < 0.75 ? P.karst[4]! : P.karst[6]!;
  }
  const near = q.near;
  // its moss cap: a lit top row, the body, a ragged dark hem (only on its top ledge)
  const hem = q.cap > 0 ? q.cap * (0.55 + 0.75 * vnoise1(lx / 4, q.seed + 3)) + (vnoise1(lx / 1.7, q.seed + 31) > 0.74 ? 1.4 : 0) : 0;
  if (s < hem) return s < px ? (u < 0.5 ? P.moss[2]! : P.moss[3]!) : s > hem - px ? P.moss[near ? 7 : 6]! : u > 0.68 ? P.moss[5]! : P.moss[4]!;
  // a crevice down its right side, the joint at its foot
  if (R - lx < px * (near ? 1.4 : 0.95)) return P.karst[8]!;
  if (F - depth < px * 0.95) return P.karst[near ? 8 : 7]!;
  // the base value: standing forward lighter; the nearest darker and crisper
  let t = near ? 0.6 + 0.08 * (1 - q.z) : 0.16 + 0.38 * (1 - q.z);
  // its top: a lit rim (bare), or the shadow under the moss and then the rim
  if (q.cap > 0 && s < hem + px) t += 0.18;
  else if (s < hem + px * (q.cap > 0 ? 2.4 : 1.4)) t -= near ? 0.4 : 0.32;
  // its lit left flank, the face turning into shade on the right, darker toward its foot
  const litW = Math.max(px * 1.2, Math.min(4, w * 0.12));
  if (lx - L < litW) t -= near ? 0.28 : 0.2;
  else if (u > 0.55) t += 0.26 * (u - 0.55) / 0.45;
  t += 0.14 * clamp((s - H * 0.35) / (H * 0.65), 0, 1);
  // bedding joints across part of it (a tall one has two): dark, with a lit lip just under each
  const nb = q.kind === "tall" ? 2 : q.kind === "block" && H > 18 ? 1 : 0;
  for (let k = 0; k < nb; k++) {
    const by = T + H * (0.28 + 0.22 * k + 0.16 * hash1(20 + k, q.seed)) + wb(lx * 0.9, q.seed + 21 + k) * 0.7;
    const ua = 0.05 + 0.35 * hash1(22 + k, q.seed), ub = 0.6 + 0.4 * hash1(24 + k, q.seed);
    if (u < ua || u > ub) continue;
    if (Math.abs(depth - by) < px * 0.55) return near ? P.karst[8]! : P.karst[7]!;
    if (depth - by > px * 0.4 && depth - by < px * 1.5) t -= 0.14;
  }
  // a crack: the slab's runs right through it; a wider block's part of the way down
  if (q.kind === "slab" || (w > 21 && d >= 0.5 && hash1(11, q.seed) < 0.6)) {
    const cu = q.kind === "slab" ? crackU(q) : 0.3 + 0.4 * hash1(12, q.seed);
    const cl = q.kind === "slab" ? H : H * (0.35 + 0.5 * hash1(13, q.seed));
    const cx = L + w * cu + (vnoise1(depth / 3.5, q.seed + 14) - 0.5) * 1.4;
    if (s < cl && s > hem) {
      if (Math.abs(lx - cx) < px * 0.55) return near ? P.karst[8]! : P.karst[7]!;
      if (lx - cx > -px * 1.6 && lx - cx < -px * 0.5) t -= 0.1;
      else if (lx > cx && q.kind === "slab") t += 0.06;
    }
  }
  // weathering in long streaks down from its top, a cluster of pits
  if (vnoise(lx / 2.6 + q.seed * 0.01, depth / 11, q.seed + 6) > 0.64) t += 0.1;
  else if (vnoise(lx / 4 + q.seed * 0.01, depth / 16, q.seed + 8) < 0.24) t -= 0.06;
  if (d >= 0.5 && hash(Math.floor(lx), Math.floor(depth), q.seed + 9) < 0.05 && s > hem + 2) t += 0.16;
  return tone(P.karst, clamp(0.06 + t * 0.9, 0, 1), x, y, 0.1);
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

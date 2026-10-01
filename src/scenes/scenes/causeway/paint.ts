// Region B's painting kit (lane reg-b, round 1): the near ground of the shore,
// the causeway and the hollow's mouth, painted as authored pixel clusters in
// whole ramp steps rather than as noise snapped to bands.
//
// Every painter writes tone INDICES of a ramp (0 = its darkest colour), so a
// block is one flat colour with a lit top row and a shaded bottom row, a crack
// is one step down, a fleck one step up: the clusters a pixel artist would
// place, in the room's own hue-shifted ramps. The shader still adds the live
// light (sun breaks, lamp light, lightning) on top, a band at a time.
//
//   ashlar     dressed block masonry in courses: per-block tone, bevel (lit top
//              and light-side edge, shaded bottom and far edge), mortar joints,
//              pits and flecks, chipped corners, cracks, moss in the joints and on
//              the block tops, rain streaks under a coping, a wet band and an
//              algae line at the water
//   coping     the top course: long slabs, a lit arris, a drip shadow under it
//   boulders   rounded masses (a tor's bedded slabs, bank stones): each lit from
//              its own outline's normal, so it reads as a volume, with bedding
//              lines, cracks, lichen and dark seams where two meet
//   grassCap   a grass band on a top edge, blades above it in clumps, strands
//              hanging over a drop (foliage breaking the hard edge)
//   soil       packed earth with strata, bedded pebbles and roots
//
// Pure CPU, run once per room build. Sized by the caller (px at P = 80 per H).

import { fbm, fbm1, hashInt, type Pix } from "../../engine/index.ts";

/** A palette row and how many colours it has. */
export interface Ramp {
  row: number;
  n: number;
}

/** Ramp lengths by row, per buffer (every put records its ramp), so shift() steps a pixel in its own ramp. */
const SIZES = new WeakMap<Pix, Uint8Array>();
function sizes(pix: Pix): Uint8Array {
  let s = SIZES.get(pix);
  if (!s) SIZES.set(pix, (s = new Uint8Array(128)));
  return s;
}

/** Write tone index `i` of ramp `r` at (x, y). Indices clamp to the ramp. */
export function put(pix: Pix, x: number, y: number, r: Ramp, i: number, fog = 0): void {
  const k = Math.max(0, Math.min(r.n - 1, Math.round(i)));
  sizes(pix)[r.row & 127] = r.n;
  pix.set(x, y, (k + 0.5) / r.n, r.row, fog);
}

/** Records ramps that other painters (the engine's) write into this buffer, for shift(). */
export function known(pix: Pix, ...rs: Ramp[]): void {
  for (const r of rs) sizes(pix)[r.row & 127] = r.n;
}

/** The tone index at (x, y) in its own ramp (-1: empty). */
export function toneAt(pix: Pix, x: number, y: number): number {
  if (!pix.solid(x, y)) return -1;
  const n = sizes(pix)[pix.data[(y * pix.w + x) * 4 + 1]! & 127] || 6;
  return Math.floor(pix.shadeAt(x, y) * n);
}

/** Darken (or lighten) an existing pixel by whole steps of its own ramp, keeping its row. */
export function shift(pix: Pix, x: number, y: number, d: number, _n?: number): void {
  if (!pix.solid(x, y)) return;
  const n = sizes(pix)[pix.data[(y * pix.w + x) * 4 + 1]! & 127] || 6;
  const k = Math.max(0, Math.min(n - 1, Math.floor(pix.shadeAt(x, y) * n) + d));
  pix.setShade(x, y, (k + 0.5) / n);
}

// ------------------------------------------------------------------------------------
// courses and blocks

interface Course {
  y0: number;
  y1: number;
  /** Block edges (x) across the painted span, ascending. */
  edges: number[];
  k: number;
}

function courses(y0: number, y1: number, x0: number, x1: number, o: { originY: number; course: number; courseVar: number; block: [number, number]; seed: number }): Course[] {
  const out: Course[] = [];
  // walk courses from the origin both ways so the grid is the same wherever a painter starts
  let y = o.originY;
  let k = 0;
  const hOf = (kk: number): number => Math.max(4, Math.round(o.course * (1 + o.courseVar * (hashInt(kk, 3, o.seed) - 0.5))));
  while (y > y0) {
    k--;
    y -= hOf(k);
  }
  for (; y < y1; k++) {
    const h = hOf(k);
    const edges: number[] = [];
    let x = x0 - o.block[1] - Math.floor(hashInt(k, 5, o.seed) * o.block[1]);
    let j = 0;
    while (x < x1 + o.block[1]) {
      edges.push(x);
      x += Math.round(o.block[0] + (o.block[1] - o.block[0]) * hashInt(k, j++, o.seed + 7));
    }
    edges.push(x);
    out.push({ y0: y, y1: y + h, edges, k });
    y += h;
  }
  return out;
}

function blockIndex(edges: number[], x: number): number {
  let lo = 0,
    hi = edges.length - 2;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (edges[m]! <= x) lo = m;
    else hi = m - 1;
  }
  return lo;
}

export interface AshlarOpts {
  x0: number;
  x1: number;
  /** First solid row of column x (>= 1e8: none) and the row past the last. */
  top: (x: number) => number;
  bottom: (x: number) => number;
  stone: Ramp;
  /** Mean course height and how much it varies (0..1), block width range, all px. */
  course: number;
  courseVar?: number;
  block: [number, number];
  /** Row the course grid is aligned to (a coping's underside, a road's top). */
  originY: number;
  seed: number;
  /** Base tone index of a block, and how far blocks swing from it (whole steps). */
  base: number;
  swing?: number;
  /** Mortar joint tone and width px. */
  mortar?: number;
  joint?: number;
  /** -1: the light comes from the left (west), 1 from the right. */
  light?: number;
  /** Lit top rows of each block (+2 then +1), shaded bottom row: on by default. */
  bevel?: boolean;
  /** The bevel's steps: [first row, second row, light-side column, far-side column, bottom row]. */
  lit?: [number, number, number, number, number];
  /** Weathering that crosses the blocks: big soft stains (whole steps darker), 0..1. */
  stain?: number;
  /** Moss clumps grown over the face (blobs with lit tops), 0..1, more where `moss.where` is high. */
  clumps?: number;
  /** Pits / flecks / cracks per block (0..1 density). */
  pits?: number;
  cracks?: number;
  /** Moss in the joints and on block tops, more where `where` is high (0..1). */
  moss?: { ramp: Ramp; amount: number; where?: (x: number, y: number) => number };
  /** Rain streaks running down from a row, per column. */
  streaks?: { from: (x: number) => number; amount: number; length: number };
  /** The water: a darker wet band above `y` (h px), an algae line at it. */
  wet?: { y: number; h: number; algae?: Ramp };
  /** Extra whole steps per pixel (AO, a shadow cast on the wall). */
  shade?: (x: number, y: number) => number;
  /** Where the face is broken away (no block drawn, the mortar core shows): returns true. */
  hole?: (x: number, y: number) => boolean;
}

/** Dressed block masonry (see the header). */
export function ashlar(pix: Pix, o: AshlarOpts): void {
  const S = o.stone;
  const mortar = o.mortar ?? 0;
  const J = o.joint ?? 1;
  const light = o.light ?? -1;
  const swing = o.swing ?? 1;
  const bevel = o.bevel ?? true;
  let ymin = 1e9,
    ymax = -1e9;
  for (let x = o.x0; x < o.x1; x++) {
    const t = o.top(x);
    if (t >= 1e8) continue;
    ymin = Math.min(ymin, t);
    ymax = Math.max(ymax, o.bottom(x));
  }
  if (ymin >= ymax) return;
  const cs = courses(Math.floor(ymin) - 2, Math.ceil(ymax) + 2, o.x0, o.x1, { originY: o.originY, course: o.course, courseVar: o.courseVar ?? 0.3, block: o.block, seed: o.seed });
  // per course, per block: tone and its features
  for (let x = o.x0; x < o.x1; x++) {
    const t = Math.round(o.top(x));
    if (t >= 1e8) continue;
    const b = Math.round(o.bottom(x));
    let ci = 0;
    for (let y = Math.max(0, t); y < b && y < pix.h; y++) {
      while (ci < cs.length - 1 && cs[ci]!.y1 <= y) ci++;
      const c = cs[ci]!;
      const bi = blockIndex(c.edges, x);
      const bx0 = c.edges[bi]!,
        bx1 = c.edges[bi + 1]!;
      const dx = x - bx0,
        dxr = bx1 - 1 - x,
        dy = y - c.y0,
        dyb = c.y1 - 1 - y;
      const id = c.k * 977 + bi;
      if (o.hole && o.hole(x, y)) {
        put(pix, x, y, S, mortar + (hashInt(x >> 1, y >> 1, o.seed + 41) < 0.3 ? 1 : 0));
        continue;
      }
      // joints: the bed joint under the course, the head joint at the block's west edge
      const chip = hashInt(id, 1, o.seed + 11);
      const corner = (dx < 2 || dxr < 2) && (dy < 2 || dyb < 2) && chip < 0.45;
      if (dyb < J || dx < J || corner) {
        let m = mortar;
        if (o.moss && hashInt(x, y, o.seed + 13) < o.moss.amount * (o.moss.where ? o.moss.where(x, y) : 1) * 1.6) {
          put(pix, x, y, o.moss.ramp, 1 + (hashInt(x, y, o.seed + 14) < 0.4 ? 1 : 0));
          continue;
        }
        if (o.wet && y > o.wet.y - o.wet.h) m = Math.max(0, m - 1);
        put(pix, x, y, S, m);
        continue;
      }
      // the block: its own tone in whole steps, darker in dirty patches
      let i = o.base + Math.round((hashInt(id, 2, o.seed) - 0.5) * 2 * swing);
      const dirt = fbm((bx0 + bx1) / 2 / 90, c.y0 / 50, o.seed + 3, 2);
      if (dirt > 0.6) i -= 1;
      if (bevel) {
        const L = o.lit ?? [2, 1, 1, -1, -1];
        if (dy === 0) i += L[0];
        else if (dy === 1) i += L[1];
        if (dyb === J) i += L[4];
        if (light < 0 ? dx === J : dxr === 0) i += L[2];
        if (light < 0 ? dxr === 0 : dx === J) i += L[3];
      }
      if (o.stain) {
        // big soft stains, their edges broken in 2x2 clusters
        const st = fbm(x / 34, y / 26, o.seed + 21, 3) + (hashInt(x >> 1, y >> 1, o.seed + 22) - 0.5) * 0.06;
        if (st > 1 - o.stain * 0.5) i -= 1;
        if (st > 1 - o.stain * 0.25) i -= 1;
      }
      if (o.moss && o.clumps) {
        const w = o.moss.where ? o.moss.where(x, y) : 1;
        const m = fbm(x / 11, y / 8, o.seed + 23, 3) * (0.55 + 0.6 * w) + (hashInt(x >> 1, y >> 1, o.seed + 24) - 0.5) * 0.05;
        if (m > 1 - o.clumps * 0.45) {
          const edge = fbm(x / 11, (y - 2) / 8, o.seed + 23, 3) * (0.55 + 0.6 * w) <= 1 - o.clumps * 0.45;
          put(pix, x, y, o.moss.ramp, edge ? o.moss.ramp.n - 2 : m > 1 - o.clumps * 0.3 ? 2 : 3);
          continue;
        }
      }
      // tool marks and pits: short horizontal dashes a step darker, a rare lit fleck; a crack across some blocks
      const cl = hashInt((x >> 2) + id * 31, y, o.seed + 5);
      if (dy > 1 && dyb > J && cl < (o.pits ?? 0.1) * 0.6) i -= 1;
      else if (hashInt(x, y, o.seed + 6) < (o.pits ?? 0.1) * 0.06) i += 1;
      if (o.cracks && hashInt(id, 4, o.seed) < o.cracks) {
        const cx = bx0 + Math.floor((bx1 - bx0) * (0.3 + 0.4 * hashInt(id, 6, o.seed)));
        const slope = (hashInt(id, 7, o.seed) - 0.5) * 1.6;
        const along = cx + Math.round(dy * slope + Math.sin(dy * 1.3 + id) * 0.8);
        if (x === along && dy > 0 && dyb > J) i = Math.min(i, mortar + 1);
      }
      // moss on the block's top edge
      if (o.moss && dy < 2) {
        const w = o.moss.where ? o.moss.where(x, y) : 1;
        if (fbm(x / 7, c.k * 3.1, o.seed + 9, 2) * w > 1 - o.moss.amount) {
          put(pix, x, y, o.moss.ramp, dy === 0 ? 3 : 2);
          continue;
        }
      }
      if (o.streaks) {
        const from = o.streaks.from(x);
        const sl = hashInt(x >> 1, 9, o.seed + 15);
        if (sl < o.streaks.amount && y > from && y < from + o.streaks.length * (0.4 + sl / o.streaks.amount * 0.6)) i -= 1;
      }
      if (o.wet && y > o.wet.y - o.wet.h) i -= y > o.wet.y - (o.wet.h >> 1) ? 2 : 1;
      if (o.shade) i += o.shade(x, y);
      put(pix, x, y, S, Math.max(mortar + 1, i));
    }
    // the algae line where the face meets the water
    if (o.wet?.algae) {
      const a = o.wet.algae;
      const len = 1 + Math.floor(hashInt(x, 2, o.seed + 17) * 3);
      for (let k = 0; k < len; k++) {
        const y = o.wet.y - k;
        if (y >= t && y < b) put(pix, x, y, a, k === len - 1 ? 2 : 1);
      }
      // a drip of weed now and then
      if (hashInt(x, 3, o.seed + 17) < 0.08) for (let k = 0; k < 2 + Math.floor(hashInt(x, 4, o.seed) * 4); k++) if (o.wet.y - len - k >= t) put(pix, x, o.wet.y - len - k, a, 1);
    }
  }
}

// ------------------------------------------------------------------------------------
// coping and treads

export interface CopingOpts {
  x0: number;
  x1: number;
  /** Top row of the coping per column, and its thickness. */
  top: (x: number) => number;
  h: number;
  stone: Ramp;
  base: number;
  seed: number;
  block: [number, number];
  light?: number;
  /** Drip shadow rows painted under it onto whatever is there (whole steps). */
  drip?: number;
  /** Moss tufts on its top edge. */
  moss?: { ramp: Ramp; amount: number };
}

/** The top course of a wall or a stair tread: long slabs, a lit arris, a drip shadow under. */
export function coping(pix: Pix, o: CopingOpts): void {
  const S = o.stone;
  const light = o.light ?? -1;
  let x = o.x0 - Math.floor(hashInt(1, 1, o.seed) * o.block[1]);
  let j = 0;
  while (x < o.x1) {
    const w = Math.round(o.block[0] + (o.block[1] - o.block[0]) * hashInt(j, 2, o.seed));
    const bi = o.base + (hashInt(j, 3, o.seed) < 0.3 ? -1 : 0);
    for (let xx = Math.max(o.x0, x); xx < Math.min(o.x1, x + w); xx++) {
      const t = Math.round(o.top(xx));
      if (t >= 1e8) continue;
      const dx = xx - x,
        dxr = x + w - 1 - xx;
      for (let k = 0; k < o.h; k++) {
        const y = t + k;
        let i = bi;
        if (dx === 0) {
          put(pix, xx, y, S, 0);
          continue;
        }
        if (k === 0) i += 3;
        else if (k === 1) i += 1;
        else if (k === o.h - 1) i -= 1;
        if (light < 0 ? dx === 1 : dxr === 0) i += 1;
        if (light < 0 ? dxr === 0 : dx === 1) i -= 1;
        // worn arris: chips along the top edge
        if (k === 0 && hashInt(xx >> 1, j, o.seed + 4) < 0.1) i -= 2;
        if (k > 1 && hashInt((xx >> 1) + j * 17, y >> 1, o.seed + 5) < 0.08) i -= 1;
        put(pix, xx, y, S, i);
      }
      if (o.drip) for (let k = 0; k < o.drip; k++) shift(pix, xx, t + o.h + k, k === 0 ? -2 : -1, S.n);
      if (o.moss && fbm(xx / 9, j, o.seed + 6, 2) > 1 - o.moss.amount) {
        const hh = 1 + Math.floor(hashInt(xx, 7, o.seed) * 3);
        for (let k = 1; k <= hh; k++) put(pix, xx, t - k, o.moss.ramp, k === hh ? 4 : 3 - (k > 1 ? 1 : 0));
      }
    }
    x += w;
    j++;
  }
}

// ------------------------------------------------------------------------------------
// boulders: rounded masses lit from their own outline

export interface Boulder {
  /** Box in px: left, top, right, bottom (exclusive). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Corner radius px (pillowy at large values). */
  r: number;
  /** Tone offset of this one (whole steps). */
  tone?: number;
  seed: number;
}

export interface BoulderOpts {
  stone: Ramp;
  base: number;
  /** Light direction (screen, toward the light), e.g. [-0.6, -0.8]. */
  light: [number, number];
  /** Width of the lit / shaded rim px. */
  rim: number;
  /** Bedding lines (horizontal) every this many px (0 none), and vertical joints. */
  bedding?: number;
  joints?: number;
  lichen?: { ramp: Ramp; amount: number; top?: boolean };
  /** Edge erosion px (noise on the outline). */
  rough?: number;
  /** Extra whole steps per pixel (AO etc.). */
  shade?: (x: number, y: number) => number;
  /** A flat walkable top: rows from the box top that stay lit and level (a shelf), per boulder. */
  flatTop?: (b: Boulder) => number;
  /** Extra fog (the air between the eye and a face set back), 0..1, per pixel. */
  fog?: (x: number, y: number) => number;
}

function sdBox(px: number, py: number, b: Boulder, r: number): number {
  const cx = (b.x0 + b.x1 - 1) / 2,
    cy = (b.y0 + b.y1 - 1) / 2;
  const hx = (b.x1 - b.x0) / 2,
    hy = (b.y1 - b.y0) / 2;
  const qx = Math.abs(px - cx) - hx + r,
    qy = Math.abs(py - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** A boulder's facet lines: each splits the face; a pixel's side of every line picks its plane. */
function facetLines(b: Boulder, count: number): { a: number; b: number; c: number; lit: number; px: number; py: number; len: number }[] {
  const out: { a: number; b: number; c: number; lit: number; px: number; py: number; len: number }[] = [];
  const w = b.x1 - b.x0,
    h = b.y1 - b.y0;
  for (let k = 0; k < count; k++) {
    // mostly steep joints and a few bedding planes, through a random point of the face
    const px = b.x0 + w * (0.15 + 0.7 * hashInt(b.seed, k, 601)),
      py = b.y0 + h * (0.2 + 0.7 * hashInt(b.seed, k + 7, 601));
    const steep = hashInt(b.seed, k + 13, 601) < 0.62;
    const ang = steep ? Math.PI / 2 + (hashInt(b.seed, k + 19, 601) - 0.5) * 0.9 : (hashInt(b.seed, k + 23, 601) - 0.5) * 0.5;
    const nx = -Math.sin(ang),
      ny = Math.cos(ang);
    // a joint is a segment, not a line across the whole stone
    const len = (steep ? h : w) * (0.35 + 0.45 * hashInt(b.seed, k + 31, 601));
    out.push({ a: nx, b: ny, c: -(nx * px + ny * py), lit: hashInt(b.seed, k + 29, 601) < 0.5 ? 1 : -1, px, py, len });
  }
  return out;
}

/** Paints boulders in list order (later ones in front). */
export function boulders(pix: Pix, list: Boulder[], o: BoulderOpts): void {
  const S = o.stone;
  const [lx0, ly0] = o.light;
  const ll = Math.hypot(lx0, ly0) || 1;
  const lx = lx0 / ll,
    ly = ly0 / ll;
  const rough = o.rough ?? 1.5;
  for (const b of list) {
    const r = Math.min(b.r, (b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2);
    const flat = o.flatTop ? o.flatTop(b) : 0;
    // the face is split into planes by a few joints: each plane its own tone, a crack along each joint
    const lines = facetLines(b, Math.floor((b.x1 - b.x0) / 170));
    const X0 = Math.max(0, Math.floor(b.x0) - 3),
      X1 = Math.min(pix.w, Math.ceil(b.x1) + 3);
    const Y0 = Math.max(0, Math.floor(b.y0) - 3),
      Y1 = Math.min(pix.h, Math.ceil(b.y1) + 3);
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        // the flat shelf on top stays exactly level (it is the walkable line)
        const onShelf = flat > 0 && y >= b.y0 && y < b.y0 + flat && x > b.x0 + r * 0.6 && x < b.x1 - 1 - r * 0.6;
        // a chunky outline: the noise is sampled on a 3 px grid so the edge breaks in steps, not fuzz
        const nq = (fbm(Math.floor(x / 3) / 4, Math.floor(y / 3) / 4, b.seed, 2) - 0.5) * 2 * rough;
        const d = onShelf ? -1 : sdBox(x, y, b, r) + nq;
        if (d > 0) continue;
        const gx = sdBox(x + 1, y, b, r) - sdBox(x - 1, y, b, r);
        const gy = sdBox(x, y + 1, b, r) - sdBox(x, y - 1, b, r);
        const gl = Math.hypot(gx, gy) || 1;
        const ndl = (gx * lx + gy * ly) / gl;
        let i = o.base + (b.tone ?? 0);
        const depth = -d;
        // the plane this pixel is on, and whether it sits on a joint
        let plane = 0;
        let crack = false,
          lip = false;
        for (let k = 0; k < lines.length; k++) {
          const L = lines[k]!;
          // along the segment (its direction is the normal turned a quarter)
          const along = Math.abs((x - L.px) * -L.b + (y - L.py) * L.a);
          if (along > L.len / 2) continue;
          // a joint wanders: its line is jogged by a pixel or two in 2 px steps, never ruler-straight
          const s = L.a * x + L.b * y + L.c + Math.round((hashInt(x >> 1, y >> 1, b.seed + 61) - 0.5) * 1.6);
          // the stone either side of a joint sits on a slightly different plane, only near the joint
          if (s > 0 && s < 18) plane += 1 << k;
          if (depth > 3 && Math.abs(s) < 0.75) crack = true;
          else if (depth > 3 && s * L.lit > 0.75 && s * L.lit < 1.75) lip = true;
        }
        void plane;
        // broad weathering: a soft swell a step either way, its edge broken in 2x2 clusters
        const sw = fbm(Math.floor(x / 2) / 34, Math.floor(y / 2) / 24, b.seed + 2, 2);
        if (sw < 0.22) i -= 1;
        // rain runs: a few thin dark streaks down from the top of the face
        if (depth > o.rim && hashInt(x >> 1, 5, b.seed + 9) < 0.016 && y - b.y0 < (b.y1 - b.y0) * (0.2 + 0.5 * hashInt(x, 6, b.seed + 9))) i -= 1;
        if (onShelf) i += y === b.y0 ? 3 : y === b.y0 + 1 ? 2 : 1;
        else if (depth < o.rim) {
          if (ndl > 0.35) i += depth < 1.5 ? 3 : 2;
          else if (ndl > 0) i += 1;
          else if (ndl < -0.45) i -= depth < 1.5 ? 2 : 1;
        } else if (depth < o.rim * 2.2 && ndl < -0.5) i -= 1;
        // the top of a rounded stone catches the sky
        if (!onShelf && depth >= o.rim && y < b.y0 + Math.max(4, (b.y1 - b.y0) * 0.16)) i += 1;
        if (crack) i = Math.min(i, 1);
        else if (lip) i += 1;
        // bedding: faint level lines on the broad face
        if (o.bedding && depth > o.rim) {
          const by = (y - b.y0 + Math.round((fbm1(x / 30, b.seed + 3, 2) - 0.5) * 6)) % o.bedding;
          if (by === 0 && hashInt(x >> 3, y, b.seed + 4) < 0.45) i -= 1;
        }
        // rare pits, a lit fleck
        if (hashInt(x >> 1, y, b.seed + 7) < 0.025) i -= 1;
        else if (hashInt(x, y, b.seed + 8) < 0.006) i += 1;
        if (o.shade) i += o.shade(x, y);
        const fogv = o.fog ? o.fog(x, y) : 0;
        // lichen crusts: in patches on the lit, upper faces, never across a crack
        if (o.lichen && depth > 1.5 && !crack) {
          const top = o.lichen.top !== false ? Math.max(0, 1 - (y - b.y0) / Math.max(8, (b.y1 - b.y0) * 0.55)) : 1;
          const ln = fbm(Math.floor(x / 2) / 5, Math.floor(y / 2) / 4, b.seed + 8, 3);
          if (ln * (0.55 + 0.65 * top) > 1 - o.lichen.amount) {
            const edge = fbm(Math.floor(x / 2) / 5, Math.floor((y - 2) / 2) / 4, b.seed + 8, 3) * (0.55 + 0.65 * top) <= 1 - o.lichen.amount;
            put(pix, x, y, o.lichen.ramp, Math.min(o.lichen.ramp.n - 1, (edge ? 2 : 1) + (ndl > 0.3 ? 1 : 0)), o.fog ? o.fog(x, y) : 0);
            continue;
          }
        }
        put(pix, x, y, S, i, fogv);
      }
    }
  }
  // seams: where a boulder sits on or against another, the contact is dark
  for (const b of list) {
    for (let x = Math.max(0, Math.floor(b.x0)); x < Math.min(pix.w, Math.ceil(b.x1)); x++) {
      const y = Math.ceil(b.y1);
      if (y < pix.h && pix.solid(x, y) && pix.solid(x, y - 1)) {
        shift(pix, x, y, -2);
        shift(pix, x, y + 1, -1);
      }
    }
  }
}

// ------------------------------------------------------------------------------------
// grass

export interface GrassOpts {
  x0: number;
  x1: number;
  /** The ground's top row per column (>= 1e8 none). */
  top: (x: number) => number;
  grass: Ramp;
  seed: number;
  /** Band depth into the ground and blade height above it, px. */
  depth: number;
  blades: number;
  /** 0..1: how much of the edge carries blades (clumped). */
  cover?: number;
  /** Strands hanging over a drop of at least this many px (0: none), and their length. */
  hang?: { drop: number; length: number };
  /** -1..1 lean of the blades (wind). */
  lean?: number;
  /** A few flower heads. */
  flowers?: { ramp: Ramp; amount: number };
}

/** A grass band and blades along a top edge, hanging strands over drops. */
export function grassCap(pix: Pix, o: GrassOpts): void {
  const G = o.grass;
  const cover = o.cover ?? 0.8;
  const lean = o.lean ?? 0.25;
  for (let x = o.x0; x < o.x1; x++) {
    const t = Math.round(o.top(x));
    if (t >= 1e8) continue;
    const clump = fbm1(x / 11, o.seed, 3);
    const dep = Math.max(1, Math.round(o.depth * (0.5 + clump)));
    for (let k = 0; k < dep; k++) {
      const i = k === 0 ? G.n - 2 : k === 1 ? G.n - 3 : k < dep - 1 ? Math.max(1, G.n - 4 + (hashInt(x >> 1, k, o.seed) < 0.3 ? -1 : 0)) : 1;
      put(pix, x, t + k, G, i);
    }
    // the root shadow on the soil just under the band
    shift(pix, x, t + dep, -1, G.n);
    // blades: clumped, lit tips, leaning
    if (clump > 1 - cover && hashInt(x, 1, o.seed) < 0.75) {
      const hh = Math.max(1, Math.round(o.blades * (0.3 + 0.9 * hashInt(x, 2, o.seed)) * (0.5 + clump)));
      const l = lean + (hashInt(x, 3, o.seed) - 0.5) * 0.5;
      for (let k = 1; k <= hh; k++) {
        const bx = x + Math.round(l * k * k / Math.max(1, hh));
        const tip = k >= hh - 1;
        put(pix, bx, t - k, G, tip ? G.n - 1 : k < 2 ? G.n - 3 : G.n - 2 - (hashInt(x, k, o.seed + 1) < 0.4 ? 1 : 0));
      }
      if (o.flowers && hashInt(x, 4, o.seed) < o.flowers.amount) {
        const bx = x + Math.round(l * hh);
        put(pix, bx, t - hh - 1, o.flowers.ramp, o.flowers.ramp.n - 1);
        put(pix, bx + 1, t - hh, o.flowers.ramp, o.flowers.ramp.n - 2);
      }
    }
    // strands over a drop on either side
    if (o.hang) {
      const tl = Math.round(o.top(x - 1)),
        tr = Math.round(o.top(x + 1));
      const drop = Math.max(tl >= 1e8 ? 999 : tl - t, tr >= 1e8 ? 999 : tr - t);
      if (drop >= o.hang.drop) {
        for (let s = 0; s < 3; s++) {
          if (hashInt(x, 10 + s, o.seed) > 0.7) continue;
          const len = Math.round(o.hang.length * (0.3 + 0.7 * hashInt(x, 20 + s, o.seed)));
          const side = tl >= 1e8 || tl - t > tr - t ? -1 : 1;
          for (let k = 0; k < len; k++) put(pix, x + side * (s + Math.round(k * 0.15)), t + dep + k, G, k > len - 2 ? 1 : 2 + (k < 2 ? 1 : 0));
        }
      }
    }
  }
}

// ------------------------------------------------------------------------------------
// soil

export interface SoilOpts {
  x0: number;
  x1: number;
  top: (x: number) => number;
  bottom: (x: number) => number;
  earth: Ramp;
  seed: number;
  base: number;
  /** Strata every this many px (0 none). */
  strata?: number;
  /** Bedded pebbles (0..1) in this stone ramp. */
  pebbles?: { ramp: Ramp; amount: number; size: number };
  roots?: { ramp: Ramp; amount: number; length: number };
  /** Steps darker per px below the top. */
  darkPer?: number;
}

export function soil(pix: Pix, o: SoilOpts): void {
  const E = o.earth;
  for (let x = o.x0; x < o.x1; x++) {
    const t = Math.round(o.top(x));
    if (t >= 1e8) continue;
    const b = Math.round(o.bottom(x));
    for (let y = Math.max(0, t); y < b; y++) {
      const d = y - t;
      let i = o.base;
      if (o.strata) {
        const sy = (y + Math.round((fbm1(x / 40, o.seed, 3) - 0.5) * o.strata * 1.6)) / o.strata;
        const band = Math.floor(sy);
        i += hashInt(band, 1, o.seed) < 0.35 ? -1 : hashInt(band, 2, o.seed) < 0.2 ? 1 : 0;
        if (sy - band < 0.12) i -= 1;
      }
      const cl = hashInt(x >> 1, y >> 1, o.seed + 3);
      if (cl < 0.12) i -= 1;
      else if (cl > 0.95) i += 1;
      if (o.darkPer) i -= Math.floor(d * o.darkPer);
      put(pix, x, y, E, i);
    }
  }
  if (o.pebbles) {
    const P = o.pebbles;
    for (let x = o.x0; x < o.x1; x += 2) {
      const t = Math.round(o.top(x));
      if (t >= 1e8) continue;
      const b = Math.round(o.bottom(x));
      for (let y = t + 2; y < b - 2; y += 2) {
        if (hashInt(x, y, o.seed + 5) > P.amount * 0.02) continue;
        const rw = Math.max(1, Math.round(P.size * (0.5 + hashInt(x, y, o.seed + 6)))),
          rh = Math.max(1, Math.round(rw * 0.7));
        for (let yy = -rh; yy <= rh; yy++)
          for (let xx = -rw; xx <= rw; xx++) {
            if ((xx * xx) / (rw * rw + 0.5) + (yy * yy) / (rh * rh + 0.5) > 1) continue;
            const i = yy < -rh * 0.3 ? P.ramp.n - 2 : yy > rh * 0.3 ? 1 : P.ramp.n - 3;
            if (pix.solid(x + xx, y + yy)) put(pix, x + xx, y + yy, P.ramp, xx < 0 && yy < 0 ? i + 1 : i);
          }
        // its shadow under it
        for (let xx = -rw + 1; xx < rw; xx++) shift(pix, x + xx, y + rh + 1, -1, E.n);
      }
    }
  }
  if (o.roots) {
    const R = o.roots;
    for (let x = o.x0; x < o.x1; x += 3) {
      if (hashInt(x, 1, o.seed + 9) > R.amount * 0.1) continue;
      const t = Math.round(o.top(x));
      if (t >= 1e8) continue;
      let rx = x,
        ry = t + 1 + Math.floor(hashInt(x, 2, o.seed + 9) * 4);
      const len = Math.round(R.length * (0.4 + 0.6 * hashInt(x, 3, o.seed + 9)));
      for (let k = 0; k < len; k++) {
        if (pix.solid(rx, ry)) put(pix, rx, ry, R.ramp, k < 2 ? 2 : 1);
        ry++;
        if (hashInt(x, k, o.seed + 10) < 0.35) rx += hashInt(x, k, o.seed + 11) < 0.5 ? -1 : 1;
      }
    }
  }
}

/** Darken (whole steps) a band of rows under a line: a cast contact shadow on painted ground. */
export function contact(pix: Pix, x0: number, x1: number, y: number, rows: number, n: number): void {
  for (let x = x0; x < x1; x++) for (let k = 0; k < rows; k++) shift(pix, x, y + k, k < rows - 1 ? -2 : -1, n);
}

// The homepage loader and the paper ofuda (Dex 10-18: "scrap the chibi icons: just have a smooth pixelized loading pixel
// graphic, then it forms into the ofuda. For the ofuda we just yoink it from the official processed Zhusha, then
// simulate it and animate it like real paper.")
//
// - The loader: three ribbons of pixels in Zhusha's colours (her scarlet, her ofuda's gold, her sword's azure) chase
//   round a curve that keeps morphing (a ring, a trefoil, a figure eight, a flower), with a few gold motes drifting in
//   to the middle. Crisp pixels only: the glow trails are a decaying heat map turned into her colour ramps with an
//   ordered dither, never alpha.
// - landOnOfuda(): the pixels leave their ribbons and gather, swirling, into the small ofuda, from its tie down; a
//   glint runs down the paper; from then on the ofuda is a real piece of paper (PaperOfuda below).
// - PaperOfuda: the ofuda as a strip of 3D verlet points (two edges x six rows: stretch, shear, bend and twist
//   constraints) under gravity and air drag that pushes on each facet along its normal, in a gusting wind; pinned at
//   its tie (or released to drift). Every frame it is drawn back onto the pixel grid: each facet rasterised with the
//   sprite as its texture (nearest texel, never smoothed), its back mirrored and darker, lit by how the facet faces
//   the light (a step or two along her paper ramp), and a 1 px spine so it never vanishes edge-on.
// - The ofuda is the paper on her hat, exact to the pixel (Dex 10-19: "whatever is on her hat right now, that's the
//   ofuda for the opening and the website and everything, exact down to the pixel"): cut from her idle's first drawing
//   (public/assets/zhusha/idle/f000.png at OFUDA_IN_IDLE; public/site/loader/ofuda.png = lanes/ship/ofuda/ofuda.png),
//   nothing added. Facing you flat it draws exactly those pixels; turned, its texels step darker or lighter.
// - Reduced motion: a static ofuda, nothing moves.
//
// The page:
//   const loader = createPixelLoader({ reduced: matchMedia("(prefers-reduced-motion: reduce)") });
//   loader.start(canvas);          // own animation loop; the canvas gets BOX_W x BOX_H px (x `scale`)
//   await loader.landOnOfuda();    // the world is ready: gathers into the ofuda (resolves after its glint)
//   loader.paper.wind.x = -40;     // the paper is live from then on: wind, moveTie(), release() ...
//   loader.stop();
// Or from the page's own frame loop: loader.tick(dt); loader.drawTo(ctx, x, y, k)  (k device px per art px).
// The paper alone (e.g. in the corner slot or handed to the opening): new PaperOfuda({ tie }) -> step(dt),
// drawTo(ctx, ox, oy, k), moveTie(x, y), release().

// ------------------------------------------------------------------------------------------------ palette

/** Her paper ramp, dark -> light (the processed sprite's gold paper; the first two: her deepest paper browns). */
const PAPER_HEX = ["6e3e1e", "9d6c36", "a6743e", "af7a43", "b18351", "bf854c", "c88d53", "c79561", "d09b62", "d6a36d",
  "deac78", "e7b782", "f3c691"];
/** Her scarlet (hat, ribbons) and her sword's azure, dark -> light; the paper's edge brown; a warm white. */
const RED_HEX = ["4c0007", "7e0014", "a51628", "bf162e", "e02f3c", "fe585b"];
const CYAN_HEX = ["143a44", "1c5464", "2b8288", "3db2bb", "80c7d2", "b7f7ff", "e2fcfa"];
const EDGE_HEX = "402c1f";
const WHITE_HEX = "fff8f9";

/** The ofuda's own colours, exact (from her idle's hat; dark -> light). */
const OFUDA_HEX = ["be6139", "b16e60", "af7a43", "b18351", "bf854c", "ba8e5b", "c88d53", "c79561", "ca9376", "d09b62",
  "d6a36d", "dca287", "deac78", "e7b782", "f5b898", "f4e0a8", "ffdac7", "ffe6da", "fff0ed"];
/** Each ofuda colour in light steps (the paper turned toward or away from the light, its back): -6..+4, 0 = exact. */
const LMIN = -6, LMAX = 4, NL = LMAX - LMIN + 1;
const lightStep = (c: [number, number, number], s: number): [number, number, number] => {
  if (s <= 0) return c.map((v) => Math.round(v * 0.9 ** -s)) as [number, number, number];
  const m = 1 - 0.82 ** s, warm = [255, 250, 240];
  return c.map((v, i) => Math.round(v + (warm[i]! - v) * m)) as [number, number, number];
};

const hex = (h: string): [number, number, number] => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

/** Palette index -> [r, g, b]; 0 is empty. */
export const COLORS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], hex(EDGE_HEX), ...PAPER_HEX.map(hex), ...RED_HEX.map(hex), ...CYAN_HEX.map(hex), hex(WHITE_HEX),
  ...OFUDA_HEX.flatMap((h) => Array.from({ length: NL }, (_, l) => lightStep(hex(h), l + LMIN))),
];
const EDGE = 1;
const P0 = 2, PN = PAPER_HEX.length;
const R0 = P0 + PN, RN = RED_HEX.length;
const C0 = R0 + RN, CN = CYAN_HEX.length;
const WHITE = C0 + CN;
const O0 = WHITE + 1, ON = OFUDA_HEX.length;
const isPaper = (c: number): boolean => c >= P0 && c < P0 + PN;
const isOfuda = (c: number): boolean => c >= O0 && c < O0 + ON * NL;
/** The ofuda colour `i` (into OFUDA_HEX) at light step `s` (0 = exact). */
const ofudaAt = (i: number, s: number): number => O0 + i * NL + Math.max(LMIN, Math.min(LMAX, s)) - LMIN;
/** A paper pixel `s` light steps lighter (+) or darker (-): the ofuda's own colours step on their own ladders, the
 *  loader's paper ramp along itself; anything else stays. */
export const paperShift = (c: number, s: number): number => {
  if (isOfuda(c)) {
    const j = c - O0, i = Math.floor(j / NL);
    return ofudaAt(i, (j % NL) + LMIN + s);
  }
  return isPaper(c) ? P0 + Math.max(0, Math.min(PN - 1, c - P0 + s)) : c;
};
/** Paper (the ofuda's texels or the loader's paper ramp), not its edge, the ribbons or the white. */
export const isPaperColor = (c: number): boolean => isPaper(c) || isOfuda(c);
/** The paper's edge brown (the 1 px spine seen edge-on) and a mid paper. */
export const EDGE_INDEX = EDGE;
export const MID_PAPER = P0 + 6;

// ------------------------------------------------------------------------------------------------ the ofuda

/** The ofuda (7 x 13), exact: '.' empty, 'a'.. its colours (OFUDA_HEX). Cut from her idle's first drawing (the
 *  paper on her hat; see the header): lanes/opening/f19/cut_ofuda.py, ofuda_ts.py. */
export const OFUDA_ROWS: readonly string[] = [
  "..decgg",
  "..deahf",
  "..cgajh",
  "..dgcjk",
  "..fjekf",
  "..jein.",
  "..keqn.",
  ".fmlne.",
  ".mnnr..",
  ".noqp..",
  "mnlr...",
  ".nsr...",
  ".qrb...",
];
export const OFUDA_W = 7;
export const OFUDA_H = 13;
/** Where it was cut: its top-left on her idle's first drawing (public/assets/zhusha/idle/f000.png, art px). */
export const OFUDA_IN_IDLE = { file: "f000.png", x: 39, y: 12 } as const;
const KEYS = "abcdefghijklmnopqrstuvwxyz";

function texture(rows: readonly string[]): Uint8Array {
  const t = new Uint8Array(OFUDA_W * OFUDA_H);
  rows.forEach((r, y) => {
    for (let x = 0; x < OFUDA_W; x++) {
      const ch = r[x]!;
      t[y * OFUDA_W + x] = ch === "." ? 0 : ofudaAt(KEYS.indexOf(ch), 0);
    }
  });
  return t;
}
/** Front texels (palette indices). */
export const OFUDA_FRONT = texture(OFUDA_ROWS);
/** The back as seen: mirrored, two light steps darker (the paper's other side, in shadow). */
export const OFUDA_BACK = (() => {
  const t = new Uint8Array(OFUDA_W * OFUDA_H);
  for (let y = 0; y < OFUDA_H; y++) for (let x = 0; x < OFUDA_W; x++) t[y * OFUDA_W + x] = paperShift(OFUDA_FRONT[y * OFUDA_W + (OFUDA_W - 1 - x)]!, -2);
  return t;
})();

// ------------------------------------------------------------------------------------------------ helpers

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (u: number): number => u * u * (3 - 2 * u);
const easeInOut = (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** A small seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 4 x 4 Bayer thresholds in 0..1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Paints palette-index pixels as whole squares, batching by colour. */
function paint(ctx: CanvasRenderingContext2D, idx: Uint8Array, w: number, h: number, ox: number, oy: number, k: number): void {
  let last = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = idx[y * w + x]!;
      if (!c) continue;
      if (c !== last) {
        const [r, g, b] = COLORS[c]!;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        last = c;
      }
      ctx.fillRect(ox + x * k, oy + y * k, k, k);
    }
  }
}

// ------------------------------------------------------------------------------------------------ the paper

export interface PaperOptions {
  /** Where its tie (the top edge's middle) is, in art px. */
  tie?: { x: number; y: number };
  seed?: number;
}

const SEG = 5; // facets down the paper
const NODES = (SEG + 1) * 2;
const SEG_LEN = OFUDA_H / SEG;
/** Where the light comes from (upper left, in front). */
const LIGHT = (() => {
  const v = [-0.35, -0.5, 1];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / n) as [number, number, number];
})();

/** One constraint: nodes a, b, rest length, stiffness 0..1. */
type Link = [number, number, number, number];

export class PaperOfuda {
  /** Node positions (art px; z toward the viewer) and their previous positions (verlet). */
  readonly p: Float64Array = new Float64Array(NODES * 3);
  private q: Float64Array = new Float64Array(NODES * 3);
  private links: Link[] = [];
  /** Pinned at the tie, or free (drifting). */
  pinned = true;
  /** How it is held: by one point at its tie (a tag: it swings and turns about it) or along its whole top edge (stuck
   * on the hat brim: it only bends and flutters below). */
  hold: "point" | "edge" = "point";
  /** How strongly a point-held paper turns back to face the viewer (0 = it spins freely). */
  face = 0.012;
  tie: { x: number; y: number };
  /** The tie's depth (0 = the page's plane; a caught paper keeps the depth it was caught at). */
  private tieZ = 0;
  /** The air's own velocity (art px / s); + x to the right, + z toward the viewer. */
  wind = { x: 0, y: 0, z: 0 };
  /** How restless the air is, 0..1 (gusts on top of `wind`). */
  gust = 0.5;
  /** Art px / s^2. */
  gravity = 150;
  /** Air drag on a facet: along its normal (paper catches the air) and along its surface. */
  dragN = 3;
  dragT = 0.6;
  /** How far the air's push moves toward the facet's leading edge (what makes falling paper rock and tumble). */
  lead = 0.9;
  /** The air pushes this much less toward / away from the viewer than across the screen: the paper twists and curls
   * in depth but mostly moves where it can be seen (a 2.5D stage, not a paper pointing at the camera). */
  depth = 0.4;
  private t = 0;
  private phase: number;

  constructor(o: PaperOptions = {}) {
    this.tie = { ...(o.tie ?? { x: 0, y: 0 }) };
    this.phase = rng(o.seed ?? 7)() * 100;
    const W = OFUDA_W, L = SEG_LEN;
    const id = (r: number, c: number): number => r * 2 + c;
    for (let r = 0; r <= SEG; r++) {
      this.links.push([id(r, 0), id(r, 1), W, 1]);
      if (r < SEG) {
        this.links.push([id(r, 0), id(r + 1, 0), L, 1], [id(r, 1), id(r + 1, 1), L, 1]);
        const d = Math.hypot(W, L);
        this.links.push([id(r, 0), id(r + 1, 1), d, 1], [id(r, 1), id(r + 1, 0), d, 1]);
      }
      if (r < SEG - 1) {
        // bending along its length (paper springs back a little) and against twisting
        this.links.push([id(r, 0), id(r + 2, 0), 2 * L, 0.035], [id(r, 1), id(r + 2, 1), 2 * L, 0.035]);
        const d2 = Math.hypot(W, 2 * L);
        this.links.push([id(r, 0), id(r + 2, 1), d2, 0.02], [id(r, 1), id(r + 2, 0), d2, 0.02]);
      }
    }
    this.reset();
  }

  /** Hangs straight down from its tie, still. */
  reset(): void {
    this.tieZ = 0;
    for (let r = 0; r <= SEG; r++) {
      for (let c = 0; c < 2; c++) {
        const i = (r * 2 + c) * 3;
        this.p[i] = this.q[i] = this.tie.x - OFUDA_W / 2 + c * OFUDA_W;
        this.p[i + 1] = this.q[i + 1] = this.tie.y + r * SEG_LEN;
        this.p[i + 2] = this.q[i + 2] = 0;
      }
    }
  }

  /** Moves its tie (art px): pinned, the paper follows with its own lag and flutter. */
  moveTie(x: number, y: number): void {
    this.tie.x = x;
    this.tie.y = y;
  }

  /** Lets go of the tie: it drifts on the wind and falls like paper. */
  release(): void {
    this.pinned = false;
  }

  /** Holds it by the tie again, where its top edge is now (no jump): caught, so it stops where it is. */
  pin(): void {
    const p = this.p;
    this.tie.x = (p[0]! + p[3]!) / 2;
    this.tie.y = (p[1]! + p[4]!) / 2;
    this.tieZ = (p[2]! + p[5]!) / 2;
    this.q.set(p);
    this.pinned = true;
  }

  /** The middle of its top edge now (art px). */
  get top(): { x: number; y: number } {
    return { x: (this.p[0]! + this.p[3]!) / 2, y: (this.p[1]! + this.p[4]!) / 2 };
  }

  /** The air at a row at time t: the wind plus gusts that travel down the paper. */
  private air(row: number, t: number): [number, number, number] {
    const g = this.gust * (16 + 0.6 * Math.abs(this.wind.x) + 0.4 * Math.abs(this.wind.z));
    const ph = this.phase + row * 0.45;
    return [
      this.wind.x + g * (0.6 * Math.sin(2.3 * t + ph) + 0.4 * Math.sin(5.7 * t + 1.7 * ph)),
      this.wind.y + g * 0.25 * Math.sin(3.3 * t + 2.1 * ph),
      this.wind.z + g * (0.45 * Math.sin(1.9 * t + 0.6 * ph) + 0.3 * Math.sin(4.3 * t + ph)),
    ];
  }

  step(dt: number): void {
    dt = Math.max(0, Math.min(dt, 0.05));
    if (dt === 0) return;
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    const p = this.p, q = this.q;
    const acc = new Float64Array(NODES * 3);
    for (let s = 0; s < n; s++) {
      this.t += h;
      acc.fill(0);
      for (let i = 0; i < NODES; i++) acc[i * 3 + 1] = this.gravity;
      // air on each facet: velocity of the facet against the air, split along its normal and its surface
      for (let r = 0; r < SEG; r++) {
        const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
        const e1 = [p[d * 3]! - p[a * 3]!, p[d * 3 + 1]! - p[a * 3 + 1]!, p[d * 3 + 2]! - p[a * 3 + 2]!];
        const e2 = [p[b * 3]! - p[c * 3]!, p[b * 3 + 1]! - p[c * 3 + 1]!, p[b * 3 + 2]! - p[c * 3 + 2]!];
        const nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!, ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!, nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
        const len = Math.hypot(nx, ny, nz) || 1;
        const area = len / 2;
        const ux = nx / len, uy = ny / len, uz = nz / len;
        const [ax, ay, az] = this.air(r + 0.5, this.t);
        let vx = 0, vy = 0, vz = 0;
        for (const k of [a, b, c, d]) {
          vx += (p[k * 3]! - q[k * 3]!) / h;
          vy += (p[k * 3 + 1]! - q[k * 3 + 1]!) / h;
          vz += (p[k * 3 + 2]! - q[k * 3 + 2]!) / h;
        }
        vx = vx / 4 - ax; vy = vy / 4 - ay; vz = vz / 4 - az;
        const vn = vx * ux + vy * uy + vz * uz;
        // the push along the normal lands nearer the leading edge (the centre of pressure of a tilted plate)
        const sp = Math.hypot(vx, vy, vz) || 1;
        const cx = (p[a * 3]! + p[b * 3]! + p[c * 3]! + p[d * 3]!) / 4;
        const cy = (p[a * 3 + 1]! + p[b * 3 + 1]! + p[c * 3 + 1]! + p[d * 3 + 1]!) / 4;
        const cz = (p[a * 3 + 2]! + p[b * 3 + 2]! + p[c * 3 + 2]! + p[d * 3 + 2]!) / 4;
        const half = Math.hypot(OFUDA_W, SEG_LEN) / 2;
        const nfx = -this.dragN * vn * ux * area, nfy = -this.dragN * vn * uy * area, nfz = -this.dragN * vn * uz * area;
        const tfx = -this.dragT * (vx - vn * ux) * area / 4, tfy = -this.dragT * (vy - vn * uy) * area / 4;
        const tfz = -this.dragT * (vz - vn * uz) * area / 4;
        const ws = [a, b, c, d].map((k) => Math.max(0.15, 1 + this.lead * ((p[k * 3]! - cx) * vx + (p[k * 3 + 1]! - cy) * vy
          + (p[k * 3 + 2]! - cz) * vz) / (sp * half)));
        const wsum = ws[0]! + ws[1]! + ws[2]! + ws[3]!;
        [a, b, c, d].forEach((k, i) => {
          const wk = ws[i]! / wsum;
          add(acc, k * 3, nfx * wk + tfx);
          add(acc, k * 3 + 1, nfy * wk + tfy);
          add(acc, k * 3 + 2, (nfz * wk + tfz) * this.depth);
        });
      }
      for (let i = 0; i < NODES * 3; i++) {
        const x = p[i]!;
        p[i] = x + (x - q[i]!) * 0.998 + acc[i]! * h * h;
        q[i] = x;
      }
      for (let it = 0; it < 6; it++) {
        if (this.pinned) this.holdTie();
        for (const [a, b, rest, k] of this.links) {
          const dx = p[b * 3]! - p[a * 3]!, dy = p[b * 3 + 1]! - p[a * 3 + 1]!, dz = p[b * 3 + 2]! - p[a * 3 + 2]!;
          const dd = Math.hypot(dx, dy, dz) || 1e-9;
          const f = ((dd - rest) / dd) * 0.5 * k;
          const fixedTop = this.pinned && this.hold === "edge";
          const wa = fixedTop && a < 2 ? 0 : 1, wb = fixedTop && b < 2 ? 0 : 1;
          const sum = wa + wb;
          if (!sum) continue;
          const ka = (2 * wa) / sum, kb = (2 * wb) / sum;
          add(p, a * 3, dx * f * ka); add(p, a * 3 + 1, dy * f * ka); add(p, a * 3 + 2, dz * f * ka);
          add(p, b * 3, -dx * f * kb); add(p, b * 3 + 1, -dy * f * kb); add(p, b * 3 + 2, -dz * f * kb);
        }
      }
      if (this.pinned) this.holdTie();
    }
  }

  private holdTie(): void {
    const p = this.p;
    if (this.hold === "edge") {
      p[0] = this.tie.x - OFUDA_W / 2; p[1] = this.tie.y; p[2] = this.tieZ;
      p[3] = this.tie.x + OFUDA_W / 2; p[4] = this.tie.y; p[5] = this.tieZ;
      return;
    }
    // held at one point (the tie): the top edge's middle stays there, free to turn about it
    const dx = this.tie.x - (p[0]! + p[3]!) / 2, dy = this.tie.y - (p[1]! + p[4]!) / 2, dz = this.tieZ - (p[2]! + p[5]!) / 2;
    p[0] = p[0]! + dx; p[1] = p[1]! + dy; p[2] = p[2]! + dz;
    p[3] = p[3]! + dx; p[4] = p[4]! + dy; p[5] = p[5]! + dz;
    // its string resists turning a little: it shows its back now and then, then turns to face you again
    const tw = (p[5]! - p[2]!) * this.face;
    p[2] = p[2]! + tw; p[5] = p[5]! - tw;
  }

  /** Its pixels now, in its own box: palette indices, w x h, at (x0, y0) art px. */
  render(): { x0: number; y0: number; w: number; h: number; idx: Uint8Array } {
    // drawn on a grid that keeps the sprite's texels whole: its top-left corner snapped to a whole art px (a shift of
    // under half a pixel; the sim is untouched), so hanging flat it is exactly the sprite
    const p = this.p.slice();
    const snapX = Math.round(p[0]!) - p[0]!, snapY = Math.round(p[1]!) - p[1]!;
    for (let i = 0; i < NODES; i++) { p[i * 3] = p[i * 3]! + snapX; p[i * 3 + 1] = p[i * 3 + 1]! + snapY; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < NODES; i++) {
      x0 = Math.min(x0, p[i * 3]!); x1 = Math.max(x1, p[i * 3]!);
      y0 = Math.min(y0, p[i * 3 + 1]!); y1 = Math.max(y1, p[i * 3 + 1]!);
    }
    const bx = Math.floor(x0) - 1, by = Math.floor(y0) - 1;
    const w = Math.ceil(x1) - bx + 2, h = Math.ceil(y1) - by + 2;
    const idx = new Uint8Array(w * h);
    const put = (x: number, y: number, c: number): void => {
      const xx = x - bx, yy = y - by;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) idx[yy * w + xx] = c;
    };
    // the spine: a 1 px line down the paper's middle, so seen edge-on it is still a line of paper
    let px = NaN, py = NaN;
    for (let k = 0; k < OFUDA_H; k++) {
      const v = ((k + 0.5) / OFUDA_H) * SEG;
      const r = Math.min(SEG - 1, Math.floor(v)), f = v - r;
      const mx = (p[r * 6]! + p[r * 6 + 3]!) / 2, my = (p[r * 6 + 1]! + p[r * 6 + 4]!) / 2;
      const nx = (p[r * 6 + 6]! + p[r * 6 + 9]!) / 2, ny = (p[r * 6 + 7]! + p[r * 6 + 10]!) / 2;
      const x = Math.floor(mx + (nx - mx) * f), y = Math.floor(my + (ny - my) * f);
      if (!Number.isNaN(px)) line(px, py, x, y, (xx, yy) => put(xx, yy, EDGE));
      else put(x, y, EDGE);
      px = x; py = y;
    }
    // the facets, back to front
    const order = Array.from({ length: SEG }, (_, r) => r).sort((ra, rb) => this.zOf(ra) - this.zOf(rb));
    for (const r of order) {
      const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
      const va = r / SEG, vc = (r + 1) / SEG;
      this.tri(p, a, b, d, [0, va], [1, va], [1, vc], put);
      this.tri(p, a, d, c, [0, va], [1, vc], [0, vc], put);
    }
    return { x0: bx, y0: by, w, h, idx };
  }

  private zOf(r: number): number {
    const p = this.p;
    let z = 0;
    for (let k = r * 2; k < r * 2 + 4; k++) z += p[k * 3 + 2]!;
    return z;
  }

  private tri(p: Float64Array, i: number, j: number, k: number, ti: number[], tj: number[], tk: number[],
    put: (x: number, y: number, c: number) => void): void {
    const ax = p[i * 3]!, ay = p[i * 3 + 1]!, bx = p[j * 3]!, by = p[j * 3 + 1]!, cx = p[k * 3]!, cy = p[k * 3 + 1]!;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-6) return;
    const front = area > 0;
    // the lit side's normal and how it faces the light, against facing it flat (the drawing's own light)
    const e1 = [bx - ax, by - ay, p[j * 3 + 2]! - p[i * 3 + 2]!], e2 = [cx - ax, cy - ay, p[k * 3 + 2]! - p[i * 3 + 2]!];
    let nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!, ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!, nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] - LIGHT[2];
    const shift = Math.max(-4, Math.min(1, Math.round(lit * 7)));
    const tex = front ? OFUDA_FRONT : OFUDA_BACK;
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const eps = 1e-7;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const sx = x + 0.5, sy = y + 0.5;
        const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) / area;
        const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -eps || w1 < -eps || w2 < -eps) continue;
        const u = w0 * ti[0]! + w1 * tj[0]! + w2 * tk[0]!;
        const v = w0 * ti[1]! + w1 * tj[1]! + w2 * tk[1]!;
        let tx = Math.min(OFUDA_W - 1, Math.max(0, Math.floor(u * OFUDA_W)));
        const ty = Math.min(OFUDA_H - 1, Math.max(0, Math.floor(v * OFUDA_H)));
        if (!front) tx = OFUDA_W - 1 - tx;
        const c = tex[ty * OFUDA_W + tx]!;
        if (c) put(x, y, paperShift(c, shift));
      }
    }
  }

  /** Paints it onto a canvas: art px (x, y) lands at device px (ox + x k, oy + y k). */
  drawTo(ctx: CanvasRenderingContext2D, ox: number, oy: number, k: number): void {
    const r = this.render();
    paint(ctx, r.idx, r.w, r.h, ox + r.x0 * k, oy + r.y0 * k, k);
  }
}

function add(a: Float64Array, i: number, v: number): void {
  a[i] = a[i]! + v;
}

function line(x0: number, y0: number, x1: number, y1: number, put: (x: number, y: number) => void): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (let guard = 0; guard < 256; guard++) {
    put(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// ------------------------------------------------------------------------------------------------ the loader

/** The loader's canvas, in art px (the ofuda's pixel size). */
export const BOX_W = 36;
export const BOX_H = 36;
/** The ofuda's tie in the box (its top edge's middle); it lands at (TIE.x - OFUDA_W / 2, TIE.y), whole art px. */
export const TIE = { x: 18.5, y: 10 } as const;
const OX = TIE.x - OFUDA_W / 2, OY = TIE.y;
/** The ribbons' centre. */
const CX = 18, CY = 17.5;

/** Seconds. */
export const TIMING = {
  /** Each shape holds, then morphs into the next. */
  hold: 2.2,
  morph: 1.1,
  /** The gather: the last pixel leaves this late (by row, from the tie down) and each flies this long. */
  gatherSpread: 0.42,
  gatherFly: 0.55,
  glint: 0.5,
};

type Family = 0 | 1 | 2; // scarlet, gold, azure
const FAMILY: { base: number; n: number }[] = [
  { base: R0, n: RN },
  { base: P0 + 4, n: PN - 4 },
  { base: C0, n: CN },
];

/** The ribbons' shapes (a ring, three lobes, a figure eight, five petals), about 11 art px out; s in 0..2pi. */
function shape(i: number, s: number): [number, number] {
  switch (i % 4) {
    case 0: return [11 * Math.cos(s), 11 * Math.sin(s)];
    case 1: {
      const r = 9.4 + 2.8 * Math.cos(3 * s);
      return [r * Math.cos(s), r * Math.sin(s)];
    }
    case 2: return [12 * Math.cos(s), 6.5 * Math.sin(2 * s)];
    default: {
      const r = 8.2 + 3.6 * Math.cos(5 * s);
      return [r * Math.cos(s), r * Math.sin(s)];
    }
  }
}

/** The three ribbons, evenly round the same curve: her scarlet, her paper's gold, her sword's azure. */
const RIBBONS: { fam: Family; phase: number }[] = [
  { fam: 0, phase: 0 },
  { fam: 1, phase: (2 * Math.PI) / 3 },
  { fam: 2, phase: (4 * Math.PI) / 3 },
];
/** Each ribbon's length along the curve (rad), how densely it is drawn, its speed (rad / s). */
const TAIL_SPAN = 1.55;
const TAIL_N = 44;
const SPEED = 2.3;
const MOTES = 5;
const MOTE_LIFE = 3.2;

export type LoaderPhase = "loading" | "gathering" | "glint" | "paper";

export interface LoaderOptions {
  seed?: number;
  /** Prefers reduced motion: a static ofuda. A MediaQueryList is read live. */
  reduced?: boolean | { matches: boolean };
  onLanded?: () => void;
}

interface Flight { sx: number; sy: number; tx: number; ty: number; c: number; fam: Family; d: number; bow: number }

/** The loader as pure state: step(dt), render(buf). No DOM. */
export class LoaderCore {
  readonly seed: number;
  phase: LoaderPhase = "loading";
  /** Seconds since start, and since the phase began. */
  t = 0;
  tp = 0;
  readonly paper: PaperOfuda;
  private heat = new Float32Array(BOX_W * BOX_H);
  private fam = new Uint8Array(BOX_W * BOX_H);
  private flights: Flight[] = [];
  private waiters: (() => void)[] = [];
  private onLanded?: () => void;
  private reducedOpt: boolean | { matches: boolean };
  private r: () => number;
  private wantLand = false;

  constructor(o: LoaderOptions = {}) {
    this.seed = (o.seed ?? 1) >>> 0;
    this.r = rng(this.seed);
    this.onLanded = o.onLanded;
    this.reducedOpt = o.reduced ?? false;
    this.paper = new PaperOfuda({ tie: { x: TIE.x, y: TIE.y }, seed: this.seed });
    // the box's own breeze once it has landed (the page can change it)
    this.paper.wind.x = 6;
    this.paper.gust = 0.4;
  }

  get reduced(): boolean {
    const r = this.reducedOpt;
    return typeof r === "boolean" ? r : !!r.matches;
  }

  get landed(): boolean {
    return this.phase === "paper";
  }

  /** The world is ready: gather into the ofuda. Resolves once it has landed (its glint done). */
  land(): Promise<void> {
    if (this.phase === "paper" || this.reduced) {
      this.toPaper();
      return Promise.resolve();
    }
    this.wantLand = true;
    return new Promise((res) => this.waiters.push(res));
  }

  /** Straight to the ofuda at rest (the world was already in). */
  settle(): void {
    this.toPaper();
  }

  private toPaper(): void {
    if (this.phase === "paper") return;
    this.phase = "paper";
    this.tp = 0;
    this.flights = [];
    this.paper.reset();
    this.onLanded?.();
    this.waiters.splice(0).forEach((f) => f());
  }

  /** Where every ribbon pixel is at time t (head first): [x, y, intensity, family]. The front of each ribbon is drawn
   * two pixels thick (a second pixel to its outer side), tapering to one. */
  ribbonPixels(t: number): [number, number, number, Family][] {
    const out: [number, number, number, Family][] = [];
    const per = TIMING.hold + TIMING.morph;
    const k = Math.floor(t / per), u = t - k * per;
    const w = u < TIMING.hold ? 0 : smooth((u - TIMING.hold) / TIMING.morph);
    const rot = 0.3 * t;
    const breathe = 1 + 0.06 * Math.sin(1.3 * t);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const at = (s: number): [number, number] => {
      const [ax, ay] = shape(k, s), [bx, by] = shape(k + 1, s);
      const x = (ax + (bx - ax) * w) * breathe, y = (ay + (by - ay) * w) * breathe;
      return [CX + x * cr - y * sr, CY + x * sr + y * cr];
    };
    for (const rb of RIBBONS) {
      const head = rb.phase + SPEED * t;
      for (let j = 0; j < TAIL_N; j++) {
        const f = j / TAIL_N;
        const s = head - f * TAIL_SPAN;
        const [x, y] = at(s);
        const v = 1 - f;
        out.push([x, y, v, rb.fam]);
        if (f < 0.3) {
          const [x2, y2] = at(s + 0.02);
          const dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1;
          // outward: away from the centre
          const nx = -dy / l, ny = dx / l;
          const sgn = (x - CX) * nx + (y - CY) * ny >= 0 ? 1 : -1;
          out.push([x + sgn * nx * 0.95, y + sgn * ny * 0.95, v * 0.8, rb.fam]);
        }
      }
    }
    return out;
  }

  /** The motes drifting in to the middle: [x, y, intensity]. */
  motes(t: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (let m = 0; m < MOTES; m++) {
      const off = (m / MOTES) * MOTE_LIFE;
      const cyc = Math.floor((t + off) / MOTE_LIFE), u = (t + off) / MOTE_LIFE - cyc;
      const h = rng(this.seed * 977 + m * 131 + cyc * 7919);
      const a0 = h() * Math.PI * 2, r0 = 15 + h() * 2.5;
      const rr = r0 * (1 - u) ** 1.25;
      const a = a0 + 2.6 * u;
      const fade = u < 0.15 ? u / 0.15 : u > 0.85 ? (1 - u) / 0.15 : 1;
      out.push([CX + rr * Math.cos(a), CY + rr * Math.sin(a), 0.42 * fade]);
    }
    return out;
  }

  step(dt: number): void {
    dt = Math.max(0, Math.min(dt, 0.1));
    this.t += dt;
    this.tp += dt;
    if (this.reduced) {
      // a static ofuda: nothing moves (it lands at once if asked)
      if (this.wantLand) this.toPaper();
      return;
    }
    // the glow decays (time-based, so it looks the same at any frame rate)
    const keep = Math.exp(-dt / 0.11);
    for (let i = 0; i < this.heat.length; i++) this.heat[i]! *= keep;
    switch (this.phase) {
      case "loading": {
        for (const [x, y, v, f] of this.ribbonPixels(this.t)) this.stamp(x, y, v, f);
        for (const [x, y, v] of this.motes(this.t)) this.stamp(x, y, v, 1);
        if (this.wantLand) this.startGather();
        break;
      }
      case "gathering": {
        for (const fl of this.flights) {
          const v = clamp01((this.tp - fl.d) / TIMING.gatherFly);
          if (v < 0.8) {
            const [x, y] = flightAt(fl, v);
            this.stamp(x, y, 0.95, fl.fam);
          }
        }
        if (this.tp >= TIMING.gatherSpread + 0.1 + TIMING.gatherFly) {
          this.phase = "glint";
          this.tp = 0;
        }
        break;
      }
      case "glint": {
        if (this.tp >= TIMING.glint) this.toPaper();
        break;
      }
      case "paper":
        this.paper.step(dt);
        break;
    }
  }

  private stamp(x: number, y: number, v: number, f: Family): void {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= BOX_W || yi >= BOX_H) return;
    const i = yi * BOX_W + xi;
    if (v >= this.heat[i]!) {
      this.heat[i] = v;
      this.fam[i] = f;
    }
  }

  private startGather(): void {
    this.wantLand = false;
    this.phase = "gathering";
    this.tp = 0;
    // every ofuda pixel gets one of the ribbons' pixels (matched round the middle, so the paths barely cross)
    const src = this.ribbonPixels(this.t).filter((p) => p[2] > 0.3);
    const cx = TIE.x, cy = OY + OFUDA_H / 2;
    const ang = (x: number, y: number): number => Math.atan2(y - cy, x - cx);
    src.sort((a, b) => ang(a[0], a[1]) - ang(b[0], b[1]));
    const tg: { x: number; y: number; c: number }[] = [];
    for (let y = 0; y < OFUDA_H; y++) for (let x = 0; x < OFUDA_W; x++) {
      const c = OFUDA_FRONT[y * OFUDA_W + x]!;
      if (c) tg.push({ x: OX + x, y: OY + y, c });
    }
    tg.sort((a, b) => ang(a.x + 0.5, a.y + 0.5) - ang(b.x + 0.5, b.y + 0.5));
    this.flights = tg.map((t, i) => {
      const s = src[Math.floor((i * src.length) / tg.length)]!;
      return {
        sx: s[0], sy: s[1], tx: t.x, ty: t.y, c: t.c, fam: s[3],
        d: TIMING.gatherSpread * ((t.y - OY) / OFUDA_H) + this.r() * 0.1,
        bow: (this.r() < 0.5 ? -1 : 1) * (0.25 + this.r() * 0.3),
      };
    });
  }

  /** Paints the frame into `buf` (palette indices, BOX_W x BOX_H, 0 = empty); clears it first. */
  render(buf: Uint8Array): void {
    buf.fill(0);
    if (this.reduced) {
      blitOfuda(buf, 0);
      return;
    }
    // the glow: heat -> her colour ramps, dithered at the fading end
    for (let y = 0; y < BOX_H; y++) {
      for (let x = 0; x < BOX_W; x++) {
        const i = y * BOX_W + x;
        const h = this.heat[i]!;
        if (h < 0.06) continue;
        const F = FAMILY[this.fam[i]!]!;
        const v = h * F.n + (BAYER[(y & 3) * 4 + (x & 3)]! - 0.5) * 1.1 - 0.35;
        if (v < 0) continue;
        buf[i] = h > 0.985 ? WHITE : F.base + Math.min(F.n - 1, Math.floor(v));
      }
    }
    switch (this.phase) {
      case "gathering":
        for (const fl of this.flights) {
          const v = clamp01((this.tp - fl.d) / TIMING.gatherFly);
          if (v < 0.8) continue;
          const [x, y] = flightAt(fl, v);
          const xi = v >= 1 ? fl.tx : Math.floor(x), yi = v >= 1 ? fl.ty : Math.floor(y);
          if (xi >= 0 && yi >= 0 && xi < BOX_W && yi < BOX_H) buf[yi * BOX_W + xi] = v >= 1 ? fl.c : paperShift(fl.c, 2);
        }
        break;
      case "glint": {
        // a glint runs down the paper, then it is paper
        const band = Math.floor(-2 + (this.tp / TIMING.glint) * (OFUDA_H + 4));
        blitOfuda(buf, 0, band);
        break;
      }
      case "paper": {
        const r = this.paper.render();
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
          const c = r.idx[y * r.w + x]!;
          const bx = r.x0 + x, by = r.y0 + y;
          if (c && bx >= 0 && by >= 0 && bx < BOX_W && by < BOX_H) buf[by * BOX_W + bx] = c;
        }
        break;
      }
      default:
        break;
    }
  }
}

function flightAt(f: Flight, v: number): [number, number] {
  const e = easeInOut(v);
  const dx = f.tx + 0.5 - f.sx, dy = f.ty + 0.5 - f.sy;
  const b = Math.sin(Math.PI * e) * f.bow;
  return [f.sx + dx * e - dy * b, f.sy + dy * e + dx * b];
}

function blitOfuda(buf: Uint8Array, dy: number, band = -99): void {
  for (let y = 0; y < OFUDA_H; y++) for (let x = 0; x < OFUDA_W; x++) {
    let c = OFUDA_FRONT[y * OFUDA_W + x]!;
    if (!c) continue;
    if (y === band || y === band + 1) c = paperShift(c, 4);
    else if (y === band + 2 || y === band - 1) c = paperShift(c, 2);
    const bx = OX + x, by = OY + y + dy;
    if (by >= 0 && by < BOX_H) buf[by * BOX_W + bx] = c;
  }
}

// ------------------------------------------------------------------------------------------------ the page's side

export interface PixelLoaderOptions extends LoaderOptions {
  /** Device px per art px for start(canvas) (default 1: show the canvas with CSS at a whole multiple, pixelated). */
  scale?: number;
}

export interface PixelLoader {
  /** Runs on `canvas` (sized BOX_W x BOX_H x scale) with its own animation-frame loop. */
  start(canvas: HTMLCanvasElement): void;
  /** Gathers into the ofuda; resolves once it has landed (after its glint). */
  landOnOfuda(): Promise<void>;
  /** Straight to the ofuda at rest (the world was already in). */
  settle(): void;
  /** Stops the loop; the last frame stays. */
  stop(): void;
  /** For a page that runs its own loop: advance, then draw the box at (x, y) device px, k device px per art px. */
  tick(dt: number): void;
  drawTo(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void;
  readonly phase: LoaderPhase;
  /** The live paper (from the landing on): wind, gust, moveTie(), release(), pin(). Box art px. */
  readonly paper: PaperOfuda;
  readonly core: LoaderCore;
}

export function createPixelLoader(o: PixelLoaderOptions = {}): PixelLoader {
  const core = new LoaderCore({ seed: o.seed ?? ((Date.now() / 1000) | 0), ...o });
  const buf = new Uint8Array(BOX_W * BOX_H);
  const scale = Math.max(1, Math.round(o.scale ?? 1));
  let raf = 0, last = 0, cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;

  const frame = (now: number): void => {
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    core.step(dt);
    if (ctx && cv) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      core.render(buf);
      paint(ctx, buf, BOX_W, BOX_H, 0, 0, scale);
    }
    raf = requestAnimationFrame(frame);
  };

  return {
    start(canvas) {
      cv = canvas;
      cv.width = BOX_W * scale;
      cv.height = BOX_H * scale;
      cv.style.imageRendering = "pixelated";
      ctx = cv.getContext("2d");
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    landOnOfuda: () => core.land(),
    settle: () => core.settle(),
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    tick: (dt) => core.step(dt),
    drawTo(c, x, y, k) {
      core.render(buf);
      paint(c, buf, BOX_W, BOX_H, Math.round(x), Math.round(y), k);
    },
    get phase() { return core.phase; },
    get paper() { return core.paper; },
    core,
  };
}

/** RGBA bytes of a palette-index buffer (checks and recordings). */
export function toRGBA(idx: Uint8Array): Uint8Array {
  const out = new Uint8Array(idx.length * 4);
  for (let i = 0; i < idx.length; i++) {
    const c = idx[i]!;
    if (!c) continue;
    const [r, g, b] = COLORS[c]!;
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
  return out;
}

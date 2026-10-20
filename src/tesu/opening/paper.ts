// The ofuda in the world (Dex 10-18: "for the ofuda we just yoink it from the official processed Zhusha, then simulate
// it and animate it like real paper"; 10-19 18:34Z: its two jobs, (a) look like the ofuda on her hat in the catch clip:
// its colours, no line art, no lettering; (b) hand off into that clip so "you can't tell it went from a procedurally
// generated one to the one made and processed by us"). ONE object from the website's loader to her hat: the loader
// lane's PaperOfuda (src/site/motion/pixel-loader.ts: a 3D verlet strip, bend, twist, air drag with a leading-edge
// push, gusts) at her drawing's own pixel size (ART_PX world px per art px).
//
// - Its looks: at the press it IS the loader's ofuda (the exact hat crop, 7 x 13: the page hands it over in the black
//   without a change); from `stripAt`, as it drops out of the black and comes at the lens, it turns (`stripFor` s: its
//   shape and its texels both, one into the other) into the whole paper (5 x 20 art px in the hat paper's own colours:
//   its gold top that hides under the brim, its pale tip), the size and colours of the clip's own drifting paper.
// - The lens (Dex 10-20: "following the ofuda closely"): through the fall it is drawn as if near the camera, a set
//   share of the frame's height whatever the world's zoom (the camera rides with it, the world rushes past), as
//   pixels of its own (each art px a square block of frame px, like the website's loader draws it); it leaves the
//   lens for her plane before the hand-off, so the drawing takes over a paper at her drawing's own size.
// - The fall: it falls free in its own simulation, in the east wind and its gusts, carried along the opening's flight
//   (timeline.ts paperScreenAt). Its own drift is kept only as the quick part (the rocking side-slip of falling paper).
//   From the blend it is drawn on to her hand-off point, and in the last of it steered onto the clip's paper in the
//   hand-off drawing (beats.ts her.clip.band: that drawing's paper measured as 6 x 2 nodes, read-only), so the drawing
//   takes over a paper already in its place, angle, size and shape; from that drawing on the drawing has it.
// - On her hat (while she is the white box: a traced drawing has its own): held by its tie in her airflow.
//
// Drawn as pixels on the play plane's grid at the camera's scale (never a smoothly scaled picture): each facet
// rasterised with its texels (nearest), its back mirrored and darker, lit by how it faces the light. No line art: seen
// edge-on it is a line of its own gold.

import {
  COLORS, MID_PAPER, OFUDA_TEXTURE, PaperOfuda, paperShift as shiftPaper, paperTexture, type PaperTexture,
} from "../../site/motion/pixel-loader.ts";

/**
 * The whole paper (5 x 20 art px, its tie at the top): the hat paper's own colours, its deep gold top (under the brim
 * on her hat) to its pale tip, the clip's two end tones (X deep gold, Y cream); no line art, no lettering.
 */
export const STRIP = paperTexture([
  "dXddd",
  "ddede",
  "deeed",
  "eehee",
  "ehghe",
  "hgghg",
  "ghjgh",
  "gjkjg",
  "jkkkj",
  "kkmkk",
  "kmmmk",
  "mmnmm",
  "mnnnm",
  "nnYnn",
  "nYYYn",
  "YYYYY",
  "YYYYY",
  "nYYYn",
  "YYYYY",
  "nYYYY",
]);

/**
 * The whole paper as the clip draws it up close: the same, with the mid-gold flecks the clip's paper has through its
 * lighter part (f001). The fall's last 0.3 s dissolve into it, texel by texel, so the drawing's busier paper takes
 * over from one that already has its grain (the coordinator 10-20: subtle; the drawings untouched).
 */
export const STRIP_CLIP = paperTexture([
  "dXddd",
  "ddede",
  "deeed",
  "eehee",
  "ehghe",
  "hgghg",
  "ghjgh",
  "gjkjg",
  "jkkkj",
  "khmkk",
  "kmhmk",
  "mjnmm",
  "mnhnm",
  "nkYhn",
  "nYhYn",
  "YYkYY",
  "YhYYY",
  "nYYkn",
  "YkYYY",
  "nYYYY",
]);

type RGB = [number, number, number];

const RGB01: RGB[] = COLORS.map((c) => [c[0] / 255, c[1] / 255, c[2] / 255]);
const GLINT_CORE: RGB = [1, 0.965, 0.784], GLINT_ARM: RGB = [1, 0.91, 0.57];
/** The light, from the upper left and in front (the loader's). */
const LIGHT = (() => {
  const v = [-0.35, -0.5, 1];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / n) as [number, number, number];
})();
const SEG = 5;
/** The least size it is drawn at, frame px per art px (see draw). */
const KMIN = 0.42;
/** Near the lens, an art px of at least this many frame px is drawn as a block of its own (see draw). */
const BLOCK_MIN = 4;
/** The whole paper's stiffness against bending and twisting (the loader's paper: 1). */
const WHOLE_STIFF = 2.5;
/** Falling, the whole paper turns back to face the viewer by this share a tick (it shows its face, turning now and then). */
const WHOLE_FACE = 0.06;

export type PaperMode = "off" | "fall" | "hat";

/** One pose of the paper in world px: its nodes (x, y world px, z art px toward the viewer). */
export interface PaperPose {
  /** 12 nodes: rows of two (left, right edge) from the tie down. */
  pts: [number, number, number][];
  /** Its texels (the loader's crop, or the whole paper). */
  tex: PaperTexture;
  /** Dissolving into another look: `to`, a share of its texels (0..1), chosen by a fixed per-texel order. */
  into?: { to: PaperTexture; share: number };
}

export class WorldPaper {
  /** The loader's ofuda (7 x 13) and the whole paper (5 x 20): one is falling at a time. */
  private readonly crop: PaperOfuda;
  private readonly whole: PaperOfuda;
  sim: PaperOfuda;
  mode: PaperMode = "off";
  /** The slow part of its own drift, removed (art px; a level and its trend): the flight carries it, not its sim. */
  private slow = [0, 0];
  private trend = [0, 0];
  private seeded = false;
  /** (the turn) The loader's paper it is turning from, still falling beside it, and how far it has turned (0..1). */
  private from: PaperOfuda | null = null;
  private turned = 1;
  private fromSlow = [0, 0];
  /** (the turn into the band) Last tick's angle to turn by, so it is followed without a jump of a whole turn. */
  private turnPrev: number | null = null;
  /** World px per art px (her drawing's). */
  readonly artPx: number;

  constructor(artPx: number, seed = 11) {
    this.artPx = artPx;
    this.crop = new PaperOfuda({ tie: { x: 0, y: 0 }, seed });
    // (the lens) seen up close the whole paper is card-stiff: it rocks, curls and turns, it does not crumple
    this.whole = new PaperOfuda({ tie: { x: 0, y: 0 }, seed: seed + 1, size: { w: STRIP.w, h: STRIP.h }, stiff: WHOLE_STIFF });
    this.sim = this.crop;
  }

  /** Its texels now. */
  get tex(): PaperTexture {
    return this.sim === this.whole ? STRIP : OFUDA_TEXTURE;
  }

  /**
   * Falling, it becomes the whole paper, turning as it was: the whole paper starts in the loader's paper's place and
   * direction, and `turn(u)` draws the one into the other (shape and texels) as u goes 0 to 1 (at once: `turn(1)`).
   */
  toWhole(): void {
    if (this.sim === this.whole || this.mode !== "fall") return;
    this.from = this.crop;
    this.turned = 0;
    this.fromSlow = this.centroid();
    const a = this.crop.p, b = this.whole;
    // the old paper's direction (tie to foot) and its middle carry over
    const tx = (a[0]! + a[3]!) / 2, ty = (a[1]! + a[4]!) / 2, fx = (a[30]! + a[33]!) / 2, fy = (a[31]! + a[34]!) / 2;
    const c = this.centroid();
    const ang = Math.atan2(fy - ty, fx - tx) - Math.PI / 2;
    b.reset();
    b.hold = "point";
    b.gravity = this.crop.gravity;
    const p = b.p, cs = Math.cos(ang), sn = Math.sin(ang), mid = STRIP.h / 2;
    for (let i = 0; i < 12; i++) {
      const x = p[i * 3]!, y = p[i * 3 + 1]! - mid;
      p[i * 3] = c[0] + x * cs - y * sn;
      p[i * 3 + 1] = c[1] + x * sn + y * cs;
    }
    b.pin();
    b.release();
    this.sim = b;
    this.slow = this.centroid();
  }

  /** How far it has turned from the loader's paper into the whole paper (0..1; 1 ends the turn). */
  turn(u: number): void {
    if (!this.from) return;
    this.turned = Math.max(0, Math.min(1, u));
    if (this.turned >= 1) this.from = null;
  }

  /**
   * The fall begins: a fresh paper let go where it hung (rev 5: from the page's loader, in the black slab), upright
   * and still, so it starts as the page drew it; its own air sets it rocking as it drops.
   */
  startFall(nodes?: readonly number[]): void {
    this.sim = this.crop;
    this.from = null;
    this.turned = 1;
    this.turnPrev = null;
    const s = this.sim;
    s.reset();
    s.hold = "point";
    s.gravity = 150;
    // (rev 5) the website's paper as it hung at the press (art px from its tie): the same pose, still
    if (nodes && nodes.length === s.p.length) s.p.set(nodes);
    s.pin();
    s.release();
    this.mode = "fall";
    this.slow = this.centroid();
    this.trend = [0, 0];
    this.seeded = true;
  }

  /** On her hat: held by its tie (the drawing's paper becomes this one when she is the white box). */
  toHat(): void {
    if (this.mode === "hat") return;
    this.sim = this.crop;
    this.from = null;
    const s = this.sim;
    s.moveTie(0, 0);
    s.reset();
    s.hold = "point";
    s.pinned = true;
    s.face = 0.03;
    this.mode = "hat";
  }

  off(): void {
    this.mode = "off";
  }

  /** The middle of a pose given as nodes (x, y, z art px from its tie). */
  middleOf(nodes: readonly number[]): [number, number] {
    let x = 0, y = 0;
    const n = nodes.length / 3;
    for (let i = 0; i < n; i++) { x += nodes[i * 3]!; y += nodes[i * 3 + 1]!; }
    return [x / n, y / n];
  }

  private centroid(sim: PaperOfuda = this.sim): [number, number] {
    const p = sim.p;
    let x = 0, y = 0;
    for (let i = 0; i < 12; i++) { x += p[i * 3]!; y += p[i * 3 + 1]!; }
    return [x / 12, y / 12];
  }

  /**
   * One tick of the fall: its own air (art px / s; the east wind is negative) and gustiness, then its pose with its
   * middle at (wx, wy) world px plus the quick part of its own drift.
   */
  fall(wx: number, wy: number, air: { x: number; gust: number }, dt = 1 / 60, steer?: { nodes: readonly (readonly [number, number])[]; u: number; grain?: number; turn?: number }): PaperPose {
    if (!this.seeded || this.mode !== "fall") this.startFall();
    const s = this.sim;
    s.wind.x = air.x;
    s.wind.y = 0;
    s.wind.z = 0;
    s.gust = air.gust;
    s.step(dt);
    if (s === this.whole) s.faceViewer(WHOLE_FACE);
    const c = this.centroid();
    // the slow part of its drift (a level and its trend, about half a second: no lag on its steady fall) belongs to
    // the flight; the quick part (the rocking side-slip) stays
    const a = 1 - Math.exp(-dt / 0.5), b = 1 - Math.exp(-dt / 1.0);
    for (let i = 0; i < 2; i++) {
      const prev = this.slow[i]!;
      const lvl = a * c[i]! + (1 - a) * (prev + this.trend[i]!);
      this.trend[i] = b * (lvl - prev) + (1 - b) * this.trend[i]!;
      this.slow[i] = lvl;
    }
    const qx = Math.max(-6, Math.min(6, c[0] - this.slow[0]!)), qy = Math.max(-4, Math.min(4, c[1] - this.slow[1]!));
    const pose = this.pose(wx, wy, c[0] - qx, c[1] - qy, 1);
    // turning: the loader's paper falls on beside it (in its own place on the flight), the one drawn into the other
    const old = this.from;
    if (old) {
      old.wind.x = air.x;
      old.wind.y = 0;
      old.wind.z = 0;
      old.gust = air.gust;
      old.step(dt);
      const oc = this.centroid(old);
      for (let i = 0; i < 2; i++) this.fromSlow[i] = a * oc[i]! + (1 - a) * this.fromSlow[i]!;
      const ox = Math.max(-6, Math.min(6, oc[0] - this.fromSlow[0]!)), oy = Math.max(-4, Math.min(4, oc[1] - this.fromSlow[1]!));
      const o = this.pose(wx, wy, oc[0] - ox, oc[1] - oy, 1, old);
      const m = this.turned * this.turned * (3 - 2 * this.turned);
      pose.pts.forEach((q, i) => {
        const p = o.pts[i]!;
        q[0] = p[0] + (q[0] - p[0]) * m;
        q[1] = p[1] + (q[1] - p[1]) * m;
        q[2] = p[2] + (q[2] - p[2]) * m;
      });
      pose.into = { to: OFUDA_TEXTURE, share: 1 - m };
    }
    // before that it turns (in the screen's plane, about its middle) to lie the way the clip's paper lies, so the
    // steer moves a paper already pointing its way (never folding one end through the other)
    if (steer && (steer.turn ?? 0) > 0) {
      const P = pose.pts, N = steer.nodes;
      const ap = Math.atan2(P[10]![1] + P[11]![1] - P[0]![1] - P[1]![1], P[10]![0] + P[11]![0] - P[0]![0] - P[1]![0]);
      const ab = Math.atan2(N[10]![1] + N[11]![1] - N[0]![1] - N[1]![1], N[10]![0] + N[11]![0] - N[0]![0] - N[1]![0]);
      let d = ab - ap;
      d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
      if (this.turnPrev !== null) d += 2 * Math.PI * Math.round((this.turnPrev - d) / (2 * Math.PI));
      this.turnPrev = d;
      const th = d * Math.min(1, steer.turn!), cs = Math.cos(th), sn = Math.sin(th);
      const mx = P.reduce((s, q) => s + q[0] / P.length, 0), my = P.reduce((s, q) => s + q[1] / P.length, 0);
      for (const q of P) {
        const x = q[0] - mx, y = q[1] - my;
        q[0] = mx + x * cs - y * sn;
        q[1] = my + x * sn + y * cs;
      }
    }
    // the last of the fall: steered onto the clip's paper in the hand-off drawing (world px nodes), flat to the eye
    if (steer && steer.u > 0) {
      const u = Math.min(1, steer.u);
      pose.pts.forEach((q, i) => {
        const t = steer.nodes[i]!;
        q[0] += (t[0] - q[0]) * u;
        q[1] += (t[1] - q[1]) * u;
        q[2] *= 1 - u;
      });
      if (steer.grain && pose.tex === STRIP) pose.into = { to: STRIP_CLIP, share: Math.min(1, steer.grain) };
    }
    return pose;
  }

  /**
   * One tick on her hat: the tie at (tx, ty) world px, facing; `back` the air speed past her from front to back
   * (H/s: her own speed plus a headwind; H = 96 world px), gust 0..1.
   */
  hat(tx: number, ty: number, facing: number, back: number, gust: number, reduced: boolean, dt = 1 / 60): PaperPose {
    if (this.mode !== "hat") this.toHat();
    const s = this.sim;
    // the air in the paper's own frame (art px / s): she moves through it, the wind blows (it streams behind her)
    const artPerH = 96 / this.artPx;
    s.wind.x = -back * artPerH * 0.6 * facing;
    s.wind.y = 0;
    s.wind.z = 0;
    s.gust = (reduced ? 0.25 : 1) * (0.25 + 0.5 * gust);
    s.step(dt);
    return this.pose(tx, ty, 0, 0, facing);
  }

  /** Its nodes in world px: art px (ox, oy) of the sim lands on (wx, wy); mirrored when facing left. */
  private pose(wx: number, wy: number, ox: number, oy: number, facing: number, sim: PaperOfuda = this.sim): PaperPose {
    const p = sim.p, a = this.artPx;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) pts.push([wx + (p[i * 3]! - ox) * a * facing, wy + (p[i * 3 + 1]! - oy) * a, p[i * 3 + 2]! * facing]);
    return { pts, tex: this.tex };
  }

  /**
   * Draws a pose as pixels: toFrame maps world px to frame px; put(x, y, colour, size) fills a size x size block of
   * frame pixels from (x, y). glint: 0..1 through a glint (null: none). lens: near the camera, drawn `h` frame px long
   * (its length tie to tip) at w = 1, from its own size at w = 0 (between, the geometric mean's way: an even zoom).
   */
  static draw(pose: PaperPose, toFrame: (x: number, y: number) => [number, number], glint: number | null, reduced: boolean, put: (x: number, y: number, c: RGB, size: number) => void, lens?: { h: number; w: number }): void {
    const F = pose.pts.map((q) => { const f = toFrame(q[0], q[1]); return [f[0], f[1], q[2]] as [number, number, number]; });
    // how many frame px an art px is here (small: a few frame px, its shaded side darkened so it reads as paper)
    const len0 = Math.hypot(F[10]![0] + F[11]![0] - F[0]![0] - F[1]![0], F[10]![1] + F[11]![1] - F[0]![1] - F[1]![1]) / 2;
    const T = pose.tex;
    // the lens: scaled about its middle; never under a speck of KMIN frame px per art px (the camera's widest frames
    // would shrink it under a pixel: about 3 x 5 px, so the eye can follow it)
    let g = 1;
    if (len0 > 0 && lens && lens.w > 0 && lens.h > 0) g = Math.exp(Math.log(lens.h / len0) * Math.min(1, lens.w));
    if (len0 > 0 && (len0 * g) / T.h < KMIN) g = (KMIN * T.h) / len0;
    // its own pixel: near the lens each art px is a square block of B frame px (drawn on a grid B times coarser,
    // fixed to its middle's frame pixel, so it moves a frame px at a time and its pixels stay square and upright);
    // off the lens, or once an art px is under BLOCK_MIN frame px, frame px by frame px like her drawing beside it
    const K = (len0 * g) / T.h, B = lens && lens.w > 0 && K >= BLOCK_MIN ? Math.floor(K + 1e-6) : 1;
    const m = F.reduce<[number, number]>((a, q) => [a[0] + q[0] / F.length, a[1] + q[1] / F.length], [0, 0]);
    const o: [number, number] = B > 1 ? [Math.floor(m[0]), Math.floor(m[1])] : [0, 0];
    for (const q of F) {
      q[0] = (m[0] + (q[0] - m[0]) * g - o[0]) / B;
      q[1] = (m[1] + (q[1] - m[1]) * g - o[1]) / B;
    }
    const k = Math.max(KMIN, K) / B;
    const out = new Map<number, number>();
    const set = (x: number, y: number, c: number): void => { out.set((y + 32768) * 65536 + x + 32768, c); };
    const at = (x: number, y: number, c: RGB): void => put(o[0] + x * B, o[1] + y * B, c, B);
    // the spine: a 1 px line of its own gold down its middle, so edge-on it is still a line of paper (no dark line art)
    let px = NaN, py = NaN;
    for (let r = 0; r <= SEG; r++) {
      const mx = Math.floor((F[r * 2]![0] + F[r * 2 + 1]![0]) / 2), my = Math.floor((F[r * 2]![1] + F[r * 2 + 1]![1]) / 2);
      if (!Number.isNaN(px)) line(px, py, mx, my, (x, y) => set(x, y, MID_PAPER));
      px = mx; py = my;
    }
    const order = Array.from({ length: SEG }, (_, r) => r).sort((ra, rb) => zOf(F, ra) - zOf(F, rb));
    for (const r of order) {
      const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
      const va = r / SEG, vc = (r + 1) / SEG;
      tri(F, a, b, d, [0, va], [1, va], [1, vc], k, T, set, pose.into);
      tri(F, a, d, c, [0, va], [1, vc], [0, vc], k, T, set, pose.into);
    }
    if (glint !== null) {
      // a 4-point star on the paper: 1 px core, arms growing and shrinking over five drawings
      const arms = reduced ? [3] : [1, 3, 5, 3, 1];
      const n = arms[Math.min(arms.length - 1, Math.floor(glint * arms.length))]!;
      const m = F[4]!, gx = Math.floor((m[0] + F[5]![0]) / 2), gy = Math.floor((m[1] + F[5]![1]) / 2);
      for (const [key, c] of out) at((key % 65536) - 32768, Math.floor(key / 65536) - 32768, RGB01[c]!);
      for (let dd = 1; dd <= Math.ceil(n / 2); dd++) {
        at(gx + dd, gy, GLINT_ARM); at(gx - dd, gy, GLINT_ARM); at(gx, gy + dd, GLINT_ARM); at(gx, gy - dd, GLINT_ARM);
      }
      at(gx, gy, GLINT_CORE);
      return;
    }
    for (const [key, c] of out) at((key % 65536) - 32768, Math.floor(key / 65536) - 32768, RGB01[c]!);
  }
}

function zOf(F: [number, number, number][], r: number): number {
  let z = 0;
  for (let k = r * 2; k < r * 2 + 4; k++) z += F[k]![2];
  return z;
}

/** One facet triangle in frame px, textured from the sprite (nearest texel). */
function tri(F: [number, number, number][], i: number, j: number, k: number, ti: number[], tj: number[], tk: number[], scale: number, T: PaperTexture, put: (x: number, y: number, c: number) => void, into?: { to: PaperTexture; share: number }): void {
  const [ax, ay, az] = F[i]!, [bx, by, bz] = F[j]!, [cx, cy, cz] = F[k]!;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-6) return;
  const front = area > 0;
  // the lit side's normal (frame px across, art px in depth: near enough for a few-px paper) and how it faces the light
  const e1 = [bx - ax, by - ay, (bz - az) * scale], e2 = [cx - ax, cy - ay, (cz - az) * scale];
  let nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!, ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!, nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] - LIGHT[2];
  const shift = Math.max(-4, Math.min(1, Math.round(lit * 7)));
  const tex = front ? T.front : T.back;
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
      let tx = Math.min(T.w - 1, Math.max(0, Math.floor(u * T.w)));
      const ty = Math.min(T.h - 1, Math.max(0, Math.floor(v * T.h)));
      if (!front) tx = T.w - 1 - tx;
      let c = tex[ty * T.w + tx]!;
      // dissolving into the other look (sampled at its own size): its texel has turned once the share passes the
      // texel's own fixed threshold
      if (into) {
        const D = into.to;
        let dx = Math.min(D.w - 1, Math.max(0, Math.floor(u * D.w)));
        const dy = Math.min(D.h - 1, Math.max(0, Math.floor(v * D.h)));
        if (!front) dx = D.w - 1 - dx;
        if (texelOrder(dx, dy) < into.share) c = (front ? D.front : D.back)[dy * D.w + dx]!;
      }
      if (c) put(x, y, shiftPaper(c, shift));
    }
  }
}

/** A fixed order for a texel to turn in a dissolve (0..1), the same on every frame. */
function texelOrder(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + 1442695041, 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
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

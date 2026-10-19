// The ofuda in the world (Dex 10-18: "for the ofuda we just yoink it from the official processed Zhusha, then simulate
// it and animate it like real paper"; 10-19 18:34Z: its two jobs, (a) look like the ofuda on her hat in the catch clip:
// its colours, no line art, no lettering; (b) hand off into that clip so "you can't tell it went from a procedurally
// generated one to the one made and processed by us"). ONE object from the website's loader to her hat: the loader
// lane's PaperOfuda (src/site/motion/pixel-loader.ts: a 3D verlet strip, bend, twist, air drag with a leading-edge
// push, gusts) at her drawing's own pixel size (ART_PX world px per art px).
//
// - Its looks: at the press it IS the loader's ofuda (the exact hat crop, 7 x 13: the page hands it over in the black
//   without a change); from `stripAt` (a gold speck in the vast frame, where no look can be told) it is the whole
//   paper (5 x 20 art px in the hat paper's own colours: its gold top that hides under the brim, its pale tip), the
//   size and colours of the clip's own drifting paper.
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

export type PaperMode = "off" | "fall" | "hat";

/** One pose of the paper in world px: its nodes (x, y world px, z art px toward the viewer). */
export interface PaperPose {
  /** 12 nodes: rows of two (left, right edge) from the tie down. */
  pts: [number, number, number][];
  /** Its texels (the loader's crop, or the whole paper). */
  tex: PaperTexture;
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
  /** World px per art px (her drawing's). */
  readonly artPx: number;

  constructor(artPx: number, seed = 11) {
    this.artPx = artPx;
    this.crop = new PaperOfuda({ tie: { x: 0, y: 0 }, seed });
    this.whole = new PaperOfuda({ tie: { x: 0, y: 0 }, seed: seed + 1, size: { w: STRIP.w, h: STRIP.h } });
    this.sim = this.crop;
  }

  /** Its texels now. */
  get tex(): PaperTexture {
    return this.sim === this.whole ? STRIP : OFUDA_TEXTURE;
  }

  /** Falling, it becomes the whole paper (a speck then: the look changes where it cannot be told), turning as it was. */
  toWhole(): void {
    if (this.sim === this.whole || this.mode !== "fall") return;
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

  /**
   * The fall begins: a fresh paper let go where it hung (rev 5: from the page's loader, in the black slab), upright
   * and still, so it starts as the page drew it; its own air sets it rocking as it drops.
   */
  startFall(nodes?: readonly number[]): void {
    this.sim = this.crop;
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

  private centroid(): [number, number] {
    const p = this.sim.p;
    let x = 0, y = 0;
    for (let i = 0; i < 12; i++) { x += p[i * 3]!; y += p[i * 3 + 1]!; }
    return [x / 12, y / 12];
  }

  /**
   * One tick of the fall: its own air (art px / s; the east wind is negative) and gustiness, then its pose with its
   * middle at (wx, wy) world px plus the quick part of its own drift.
   */
  fall(wx: number, wy: number, air: { x: number; gust: number }, dt = 1 / 60, steer?: { nodes: readonly (readonly [number, number])[]; u: number }): PaperPose {
    if (!this.seeded || this.mode !== "fall") this.startFall();
    const s = this.sim;
    s.wind.x = air.x;
    s.wind.y = 0;
    s.wind.z = 0;
    s.gust = air.gust;
    s.step(dt);
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
    // the last of the fall: steered onto the clip's paper in the hand-off drawing (world px nodes), flat to the eye
    if (steer && steer.u > 0) {
      const u = Math.min(1, steer.u);
      pose.pts.forEach((q, i) => {
        const t = steer.nodes[i]!;
        q[0] += (t[0] - q[0]) * u;
        q[1] += (t[1] - q[1]) * u;
        q[2] *= 1 - u;
      });
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
  private pose(wx: number, wy: number, ox: number, oy: number, facing: number): PaperPose {
    const p = this.sim.p, a = this.artPx;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) pts.push([wx + (p[i * 3]! - ox) * a * facing, wy + (p[i * 3 + 1]! - oy) * a, p[i * 3 + 2]! * facing]);
    return { pts, tex: this.tex };
  }

  /**
   * Draws a pose as pixels: toFrame maps world px to frame px; put(x, y, colour) fills one frame pixel. glint: 0..1
   * through a glint (null: none).
   */
  static draw(pose: PaperPose, toFrame: (x: number, y: number) => [number, number], glint: number | null, reduced: boolean, put: (x: number, y: number, c: RGB) => void): void {
    const F = pose.pts.map((q) => { const f = toFrame(q[0], q[1]); return [f[0], f[1], q[2]] as [number, number, number]; });
    // how many frame px an art px is here (small: a few frame px, its shaded side darkened so it reads as paper)
    const len0 = Math.hypot(F[10]![0] + F[11]![0] - F[0]![0] - F[1]![0], F[10]![1] + F[11]![1] - F[0]![1] - F[1]![1]) / 2;
    // the camera's widest frames (the vast reveal) would shrink it under a pixel: it never draws smaller than a
    // speck of KMIN frame px per art px (about 3 x 5 px), scaled about its middle, so the eye can follow it
    const T = pose.tex;
    if (len0 > 0 && len0 / T.h < KMIN) {
      const m = F.reduce<[number, number]>((a, q) => [a[0] + q[0] / F.length, a[1] + q[1] / F.length], [0, 0]);
      const g = (KMIN * T.h) / len0;
      for (const q of F) { q[0] = m[0] + (q[0] - m[0]) * g; q[1] = m[1] + (q[1] - m[1]) * g; }
    }
    const k = Math.max(KMIN, len0 / T.h);
    const out = new Map<number, number>();
    const set = (x: number, y: number, c: number): void => { out.set((y + 32768) * 65536 + x + 32768, c); };
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
      tri(F, a, b, d, [0, va], [1, va], [1, vc], k, T, set);
      tri(F, a, d, c, [0, va], [1, vc], [0, vc], k, T, set);
    }
    if (glint !== null) {
      // a 4-point star on the paper: 1 px core, arms growing and shrinking over five drawings
      const arms = reduced ? [3] : [1, 3, 5, 3, 1];
      const n = arms[Math.min(arms.length - 1, Math.floor(glint * arms.length))]!;
      const m = F[4]!, gx = Math.floor((m[0] + F[5]![0]) / 2), gy = Math.floor((m[1] + F[5]![1]) / 2);
      for (const [key, c] of out) put((key % 65536) - 32768, Math.floor(key / 65536) - 32768, RGB01[c]!);
      for (let dd = 1; dd <= Math.ceil(n / 2); dd++) {
        put(gx + dd, gy, GLINT_ARM); put(gx - dd, gy, GLINT_ARM); put(gx, gy + dd, GLINT_ARM); put(gx, gy - dd, GLINT_ARM);
      }
      put(gx, gy, GLINT_CORE);
      return;
    }
    for (const [key, c] of out) put((key % 65536) - 32768, Math.floor(key / 65536) - 32768, RGB01[c]!);
  }
}

function zOf(F: [number, number, number][], r: number): number {
  let z = 0;
  for (let k = r * 2; k < r * 2 + 4; k++) z += F[k]![2];
  return z;
}

/** One facet triangle in frame px, textured from the sprite (nearest texel). */
function tri(F: [number, number, number][], i: number, j: number, k: number, ti: number[], tj: number[], tk: number[], scale: number, T: PaperTexture, put: (x: number, y: number, c: number) => void): void {
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
      const c = tex[ty * T.w + tx]!;
      if (c) put(x, y, shiftPaper(c, shift));
    }
  }
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

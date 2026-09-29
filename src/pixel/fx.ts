// Pixel effects on parts: dither dissolve / reveal, assemble (pixels fly
// home one by one), disintegrate (cells detach into drifting particles,
// swept across the part), glint sweep, and 1D water ripples.

import { P_DRAG, P_FADE, P_HOME, P_RISE } from "./bodies.ts";
import type { CellGrid } from "./cells.ts";
import { matById } from "./materials.ts";
import type { Part } from "./part.ts";
import type { PixelWorld } from "./world.ts";

/** Dither the part out (to 1) or in (to 0). mode: 0 ordered, 1 noise, 2 sweep. */
export function dissolve(world: PixelWorld, part: Part, to: 0 | 1, dur: number, mode: 0 | 1 | 2 = 1): void {
  part.dissolveMode = mode;
  part.visible = true;
  world.tweens.add({ target: part, key: "dissolve", to, dur, ease: "inOutSine" });
}

function colour(g: CellGrid, i: number): [number, number, number] {
  const m = matById(g.mat[i]!);
  if (!m) return [255, 0, 255];
  return m.rgb[Math.max(0, Math.min(3, 2 + g.tone[i]!))]!;
}

/**
 * Assemble: every cell leaves and flies home from a scattered start, one by
 * one (bottom rows first), restoring itself on arrival. `spread` in px.
 */
export function assemble(world: PixelWorld, part: Part, o: { dur?: number; stagger?: number; spread?: number } = {}): number {
  const g = part.grid;
  if (!g.orig) g.snapshot();
  const spread = o.spread ?? world.H * 1.2;
  const r = world.rand;
  let n = 0;
  const cells: number[] = [];
  for (let i = 0; i < g.mat.length; i++) if (g.orig!.mat[i]) cells.push(i);
  cells.sort((a, b) => g.ly(b) - g.ly(a));
  for (const i of cells) {
    const [x, y] = part.cellWorld(i);
    const col = g.orig!.mat[i] ? (matById(g.orig!.mat[i]!)?.rgb[Math.max(0, Math.min(3, 2 + g.orig!.tone[i]!))] ?? [255, 255, 255]) : [255, 255, 255];
    if (g.mat[i]) g.clearRaw(i);
    const a = r() * Math.PI * 2, d = spread * (0.3 + r() * 0.7);
    const k = world.particles.spawn({
      x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6, life: 1e9, rgb: col as [number, number, number], flags: P_HOME,
      home: { part, idx: i, delay: ((n / cells.length) * (o.stagger ?? 1.2)) + r() * 0.15, dur: o.dur ?? 0.7 },
    });
    if (k >= 0) {
      world.particles.hSx[k] = world.particles.x[k]!;
      world.particles.hSy[k] = world.particles.y[k]!;
    } else g.restoreRaw(i);
    n++;
  }
  return n;
}

/**
 * Disintegrate: cells detach along a sweep (default top to bottom) into
 * drifting particles of their own colours. Returns a stepper to call each
 * frame until it reports done (or use world.tweens on the returned state).
 */
export function disintegrate(world: PixelWorld, part: Part, o: { dur?: number; dir?: [number, number]; drift?: [number, number]; keep?: boolean } = {}): { t: number; done: boolean; step: (dt: number) => void } {
  // stepped by the world (world.addEffect) until done
  const g = part.grid;
  if (!g.orig) g.snapshot();
  const dur = o.dur ?? 1.4;
  const [dx, dy] = o.dir ?? [0, 1];
  const drift = o.drift ?? [world.H * 0.2, -world.H * 0.5];
  const r = world.rand;
  const cells: { i: number; k: number }[] = [];
  let kmin = Infinity, kmax = -Infinity;
  for (let i = 0; i < g.mat.length; i++) {
    if (!g.mat[i]) continue;
    const k = g.lx(i) * dx + g.ly(i) * dy + r() * 4;
    cells.push({ i, k });
    kmin = Math.min(kmin, k);
    kmax = Math.max(kmax, k);
  }
  cells.sort((a, b) => a.k - b.k);
  let next = 0;
  const st = {
    t: 0,
    done: false,
    step(dt: number): void {
      if (st.done) return;
      st.t += dt;
      const front = kmin + ((kmax - kmin) * st.t) / dur;
      while (next < cells.length && cells[next]!.k <= front) {
        const { i } = cells[next++]!;
        if (!g.mat[i]) continue;
        const [x, y] = part.cellWorld(i);
        if (r() < 0.8) world.particles.spawn({ x, y, vx: drift[0] * (0.5 + r()) + (r() - 0.5) * 20, vy: drift[1] * (0.5 + r()), life: 0.8 + r() * 1.2, rgb: colour(g, i), flags: P_DRAG | P_RISE | P_FADE });
        g.clearRaw(i);
      }
      if (next >= cells.length) st.done = true;
    },
  };
  world.addEffect(st);
  return st;
}

/** Start the glint sweep across a part (metal, glass). */
export function glint(part: Part): void {
  part.glintT = 0;
}

/**
 * 1D ripples for a water surface: a damped wave equation across columns.
 * disturb() drops a pulse; the host re-rasterises the surface from heights.
 */
export class Ripples {
  readonly n: number;
  h: Float32Array;
  v: Float32Array;
  constructor(n: number, public tension = 90, public damping = 1.6, public spread = 0.25) {
    this.n = n;
    this.h = new Float32Array(n);
    this.v = new Float32Array(n);
  }
  disturb(x: number, amount: number, width = 3): void {
    for (let k = -width; k <= width; k++) {
      const i = Math.round(x) + k;
      if (i < 0 || i >= this.n) continue;
      this.v[i] = this.v[i]! + amount * (1 - Math.abs(k) / (width + 1));
    }
  }
  step(dt: number): number {
    const { n, h, v } = this;
    let e = 0;
    for (let i = 0; i < n; i++) {
      const a = -this.tension * h[i]! - this.damping * v[i]!;
      v[i] = v[i]! + a * dt;
    }
    // neighbour coupling (wave travel)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const l = i > 0 ? h[i - 1]! : h[i]!, r = i < n - 1 ? h[i + 1]! : h[i]!;
        v[i] = v[i]! + (l + r - 2 * h[i]!) * this.spread * this.tension * dt;
      }
    }
    for (let i = 0; i < n; i++) {
      h[i] = h[i]! + v[i]! * dt;
      e += Math.abs(v[i]!) + Math.abs(h[i]!);
    }
    return e;
  }
}

// Motion: procedural sway/flicker, springs and pendulums, keyed eased
// motion (tweens), and verlet ropes, chains and cloth.

import { CellGrid, F_NOINK } from "./cells.ts";
import { resolveMat, type MatRef } from "./materials.ts";
import { EASE, vnoise, type Ease } from "./util.ts";

// ---------------------------------------------------------------------------
// Procedural
// ---------------------------------------------------------------------------

/** Wind sway: a slow sine plus noise gusts, scaled by the local wind. */
export function sway(t: number, amp: number, freq = 0.4, phase = 0, wind = 0): number {
  return amp * (Math.sin((t * freq + phase) * Math.PI * 2) * 0.7 + (vnoise(t * freq * 1.7, phase * 13) - 0.5) * 0.6) + wind;
}

/** Flame / lamp flicker in 0..1 (mostly high, with dips). */
export function flicker(t: number, seed = 0, speed = 1): number {
  const a = vnoise(t * 7 * speed, seed * 3.1);
  const b = vnoise(t * 17 * speed, seed * 7.7 + 5);
  return Math.min(1, 0.72 + a * 0.26 + (b - 0.5) * 0.14);
}

/** Bob: whole-pixel vertical offset. */
export function bob(t: number, px = 1, period = 2, phase = 0): number {
  return Math.round(Math.sin(((t + phase) / period) * Math.PI * 2) * px);
}

// ---------------------------------------------------------------------------
// Springs and pendulums
// ---------------------------------------------------------------------------

/** Critically-ish damped spring toward `target` (positions, angles, scales). */
export class Spring {
  x = 0;
  v = 0;
  target = 0;
  constructor(public k = 160, public damp = 10) {}
  impulse(dv: number): void {
    this.v += dv;
  }
  step(dt: number): void {
    const a = -this.k * (this.x - this.target) - this.damp * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  }
  get resting(): boolean {
    return Math.abs(this.v) < 1e-3 && Math.abs(this.x - this.target) < 1e-3;
  }
}

/** Swinging pendulum (bells, lanterns, censers): angle in radians, 0 = hanging straight down. */
export class Pendulum {
  angle = 0;
  vel = 0;
  constructor(public length: number, public gravity: number, public damp = 0.6) {}
  impulse(dw: number): void {
    this.vel += dw;
  }
  step(dt: number, torque = 0): void {
    const a = -(this.gravity / Math.max(1, this.length)) * Math.sin(this.angle) - this.damp * this.vel + torque;
    this.vel += a * dt;
    this.angle += this.vel * dt;
  }
  get resting(): boolean {
    return Math.abs(this.vel) < 0.002 && Math.abs(this.angle) < 0.002;
  }
}

// ---------------------------------------------------------------------------
// Keyed motion with easing
// ---------------------------------------------------------------------------

export interface TweenSpec<T extends object> {
  target: T;
  key: keyof T & string;
  to: number;
  from?: number;
  dur: number;
  ease?: Ease | keyof typeof EASE;
  delay?: number;
  onDone?: () => void;
}

interface Tween {
  target: Record<string, number>;
  key: string;
  from: number;
  to: number;
  dur: number;
  t: number;
  ease: Ease;
  started: boolean;
  onDone?: () => void;
}

export class Tweens {
  private list: Tween[] = [];
  add<T extends object>(s: TweenSpec<T>): void {
    const target = s.target as unknown as Record<string, number>;
    // a new tween on the same key replaces the old one
    this.list = this.list.filter((t) => !(t.target === target && t.key === s.key));
    this.list.push({
      target,
      key: s.key,
      from: s.from ?? NaN,
      to: s.to,
      dur: Math.max(1e-3, s.dur),
      t: -(s.delay ?? 0),
      ease: typeof s.ease === "function" ? s.ease : EASE[s.ease ?? "inOutCubic"]!,
      started: false,
      onDone: s.onDone,
    });
  }
  step(dt: number): void {
    const done: Tween[] = [];
    for (const tw of this.list) {
      tw.t += dt;
      if (tw.t < 0) continue;
      if (!tw.started) {
        if (Number.isNaN(tw.from)) tw.from = tw.target[tw.key]!;
        tw.started = true;
      }
      const k = Math.min(1, tw.t / tw.dur);
      tw.target[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(k);
      if (k >= 1) done.push(tw);
    }
    if (done.length) {
      this.list = this.list.filter((t) => !done.includes(t));
      for (const d of done) d.onDone?.();
    }
  }
  get active(): number {
    return this.list.length;
  }
  clear(target?: object): void {
    this.list = target ? this.list.filter((t) => t.target !== target) : [];
  }
}

// ---------------------------------------------------------------------------
// Verlet rope / chain
// ---------------------------------------------------------------------------

export type WindFn = (x: number, y: number) => [number, number];

export interface RopeSpec {
  /** World points from the first anchor to the end. */
  from: [number, number];
  to: [number, number];
  segments: number;
  /** Rest length multiplier over the straight distance (1.05 = a little slack). */
  slack?: number;
  mat: MatRef;
  width?: number;
  /** Alternate two tones (chain links). */
  chain?: boolean;
  pinStart?: boolean;
  pinEnd?: boolean;
  /** Mass of the last point relative to the others (a weight on the end). */
  endMass?: number;
  damping?: number;
  windGain?: number;
}

export class Rope {
  n: number;
  x: Float32Array;
  y: Float32Array;
  px: Float32Array;
  py: Float32Array;
  inv: Float32Array;
  pins: ([number, number] | null)[];
  rest: number;
  cut: Uint8Array;
  readonly spec: RopeSpec;
  sleeping = false;
  private still = 0;

  constructor(s: RopeSpec) {
    this.spec = s;
    this.n = s.segments + 1;
    const n = this.n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.inv = new Float32Array(n).fill(1);
    this.cut = new Uint8Array(s.segments);
    this.pins = new Array(n).fill(null);
    const [ax, ay] = s.from, [bx, by] = s.to;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this.x[i] = this.px[i] = ax + (bx - ax) * t;
      this.y[i] = this.py[i] = ay + (by - ay) * t;
    }
    this.rest = (Math.hypot(bx - ax, by - ay) / s.segments) * (s.slack ?? 1.04);
    if (s.pinStart !== false) this.pins[0] = [ax, ay];
    if (s.pinEnd) this.pins[n - 1] = [bx, by];
    if (s.endMass) this.inv[n - 1] = 1 / s.endMass;
  }

  /** Cut the segment nearest (x, y) within `r` px. Returns the segment index or -1. */
  cutNear(x: number, y: number, r: number): number {
    let best = -1, bd = r;
    for (let i = 0; i < this.n - 1; i++) {
      if (this.cut[i]) continue;
      const d = segDist(x, y, this.x[i]!, this.y[i]!, this.x[i + 1]!, this.y[i + 1]!);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) this.cutSeg(best);
    return best;
  }

  /** Cut where the segment a-b crosses the rope (a slash line). */
  cutLine(ax: number, ay: number, bx: number, by: number): number {
    for (let i = 0; i < this.n - 1; i++) {
      if (this.cut[i]) continue;
      if (segCross(ax, ay, bx, by, this.x[i]!, this.y[i]!, this.x[i + 1]!, this.y[i + 1]!)) {
        this.cutSeg(i);
        return i;
      }
    }
    return -1;
  }

  /** Nudge points near (x, y) (hits, gusts): a velocity kick through the previous positions. */
  push(x: number, y: number, r: number, vx: number, vy: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.pins[i]) continue;
      const d = Math.hypot(this.x[i]! - x, this.y[i]! - y);
      if (d > r) continue;
      const f = 1 - d / r;
      this.px[i] = this.px[i]! - vx * f;
      this.py[i] = this.py[i]! - vy * f;
    }
    this.wake();
  }

  cutSeg(i: number): void {
    this.cut[i] = 1;
    this.wake();
  }

  wake(): void {
    this.sleeping = false;
    this.still = 0;
  }

  step(dt: number, gravity: number, wind?: WindFn, ground?: (x: number, y: number) => boolean): void {
    if (this.sleeping) return;
    const { n, x, y, px, py, inv, pins } = this;
    const damp = this.spec.damping ?? 0.985;
    const wg = this.spec.windGain ?? 1;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const pin = pins[i];
      if (pin) {
        // pinned points carry their motion, so a released point keeps its speed
        px[i] = x[i]!;
        py[i] = y[i]!;
        x[i] = pin[0];
        y[i] = pin[1];
        continue;
      }
      const vx = (x[i]! - px[i]!) * damp, vy = (y[i]! - py[i]!) * damp;
      px[i] = x[i]!;
      py[i] = y[i]!;
      let ax = 0, ay = gravity;
      if (wind) {
        const [wx, wy] = wind(x[i]!, y[i]!);
        ax += wx * wg;
        ay += wy * wg;
      }
      x[i] = x[i]! + vx + ax * dt * dt;
      y[i] = y[i]! + vy + ay * dt * dt;
      energy += vx * vx + vy * vy;
    }
    for (let it = 0; it < 12; it++) {
      for (let i = 0; i < n; i++) {
        const p = pins[i];
        if (p) { x[i] = p[0]; y[i] = p[1]; }
      }
      for (let i = 0; i < n - 1; i++) {
        if (this.cut[i]) continue;
        const dx = x[i + 1]! - x[i]!, dy = y[i + 1]! - y[i]!;
        const d = Math.hypot(dx, dy) || 1e-6;
        const wa = pins[i] ? 0 : inv[i]!, wb = pins[i + 1] ? 0 : inv[i + 1]!;
        const ws = wa + wb;
        if (!ws) continue;
        const diff = (d - this.rest) / d / ws;
        x[i] = x[i]! + dx * diff * wa;
        y[i] = y[i]! + dy * diff * wa;
        x[i + 1] = x[i + 1]! - dx * diff * wb;
        y[i + 1] = y[i + 1]! - dy * diff * wb;
      }
    }
    // rest on the ground: slide back out, lose speed
    if (ground) {
      for (let i = 0; i < n; i++) {
        if (pins[i] || !ground(x[i]!, y[i]!)) continue;
        let up = 0;
        while (up < 10 && ground(x[i]!, y[i]! - up - 1)) up++;
        y[i] = y[i]! - up - 1;
        px[i] = x[i]! - (x[i]! - px[i]!) * 0.3;
        py[i] = y[i]!;
      }
    }
    // sleep when still and no wind
    if (energy < 0.0004 * n) {
      this.still += dt;
      if (this.still > 1.2 && !wind) this.sleeping = true;
    } else this.still = 0;
  }

  /** Draw into `g` whose logical (0, 0) sits at world (ox, oy). */
  rasterize(g: CellGrid, ox: number, oy: number, piece = 1): void {
    const m = resolveMat(this.spec.mat);
    const w = this.spec.width ?? 2;
    let k = 0;
    for (let i = 0; i < this.n - 1; i++) {
      if (this.cut[i]) continue;
      const ax = this.x[i]! - ox, ay = this.y[i]! - oy, bx = this.x[i + 1]! - ox, by = this.y[i + 1]! - oy;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
        k++;
        for (let a = 0; a < w; a++) {
          for (let b = 0; b < w; b++) {
            const idx = g.inner(cx - w / 2 + a + 0.5, cy - w / 2 + b + 0.5);
            if (idx < 0) continue;
            const tone = this.spec.chain ? ((k >> 2) % 2 ? -1 : 0) : a === 0 && w > 1 ? 1 : 0;
            if (!g.mat[idx]) g.setRaw(idx, m.id, tone, piece, 1 + (w > 1 ? (a === 0 ? 0.5 : 1.2) : 1), 0, m.hardness);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Verlet cloth (2.5D: points carry a z, so compressed cloth buckles into real
// folds that light like folds)
// ---------------------------------------------------------------------------

export interface ClothSpec {
  /** The cloth's own cells (its design), drawn by a PartBuilder. */
  src: CellGrid;
  /** Pixels per mesh cell. */
  spacing: number;
  /** World position of the source's top-left corner at rest. */
  x: number;
  y: number;
  /** Pin the top row (rod) at rest positions. */
  pinTop?: boolean;
  damping?: number;
  /** Extra mass on the bottom row (a weighted hem / rod). */
  bottomMass?: number;
  stiffness?: number;
  windGain?: number;
  /** z (fold depth) to height gain. */
  foldGain?: number;
}

export class Cloth {
  readonly cols: number;
  readonly rows: number;
  readonly N: number;
  readonly p: Float32Array;
  readonly q: Float32Array;
  readonly inv: Float32Array;
  readonly pins: (Float32Array | null)[];
  readonly cons: Int32Array;
  readonly rest: Float32Array;
  readonly alive: Uint8Array;
  readonly spec: ClothSpec;
  sleeping = false;
  private still = 0;

  constructor(s: ClothSpec) {
    this.spec = s;
    const cols = Math.floor((s.src.w - 1) / s.spacing) + 2;
    const rows = Math.floor((s.src.h - 1) / s.spacing) + 2;
    this.cols = cols;
    this.rows = rows;
    this.N = cols * rows;
    this.p = new Float32Array(this.N * 3);
    this.q = new Float32Array(this.N * 3);
    this.inv = new Float32Array(this.N).fill(1);
    this.pins = new Array(this.N).fill(null);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const X = s.x + Math.min(i * s.spacing, s.src.w), Y = s.y + Math.min(j * s.spacing, s.src.h);
        this.p[k * 3] = this.q[k * 3] = X;
        this.p[k * 3 + 1] = this.q[k * 3 + 1] = Y;
        const z = Math.sin(i * 2.1 + j * 0.7) * 0.3;
        this.p[k * 3 + 2] = this.q[k * 3 + 2] = z;
        if (j === rows - 1 && s.bottomMass) this.inv[k] = 1 / s.bottomMass;
      }
    }
    const cons: number[] = [];
    const add = (a: number, b: number): void => {
      cons.push(a, b);
    };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (i < cols - 1) add(k, k + 1);
        if (j < rows - 1) add(k, k + cols);
        if (i < cols - 1 && j < rows - 1) {
          add(k, k + cols + 1);
          add(k + 1, k + cols);
        }
        // bend (skip one) for stiffness
        if (i < cols - 2) add(k, k + 2);
        if (j < rows - 2) add(k, k + cols * 2);
      }
    }
    this.cons = new Int32Array(cons);
    const nc = cons.length / 2;
    this.rest = new Float32Array(nc);
    this.alive = new Uint8Array(nc).fill(1);
    for (let c = 0; c < nc; c++) {
      const a = cons[c * 2]!, b = cons[c * 2 + 1]!;
      this.rest[c] = Math.hypot(this.p[a * 3]! - this.p[b * 3]!, this.p[a * 3 + 1]! - this.p[b * 3 + 1]!);
    }
    if (s.pinTop !== false) for (let i = 0; i < cols; i++) this.pin(i, this.p[i * 3]!, this.p[i * 3 + 1]!, 0);
  }

  pin(k: number, x: number, y: number, z = 0): void {
    const v = this.pins[k] ?? new Float32Array(3);
    v[0] = x;
    v[1] = y;
    v[2] = z;
    this.pins[k] = v;
  }
  unpin(k: number): void {
    this.pins[k] = null;
    this.wake();
  }

  wake(): void {
    this.sleeping = false;
    this.still = 0;
  }

  /** Push points near (x, y) (hits, dash wind). */
  push(x: number, y: number, r: number, fx: number, fy: number, fz = 0): void {
    for (let k = 0; k < this.N; k++) {
      const dx = this.p[k * 3]! - x, dy = this.p[k * 3 + 1]! - y;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const f = 1 - d / r;
      this.q[k * 3] = this.q[k * 3]! - fx * f;
      this.q[k * 3 + 1] = this.q[k * 3 + 1]! - fy * f;
      this.q[k * 3 + 2] = this.q[k * 3 + 2]! - fz * f;
    }
    this.wake();
  }

  /** Tear: break every constraint crossing the segment a-b. Returns how many broke. */
  tear(ax: number, ay: number, bx: number, by: number): number {
    let n = 0;
    const { cons, p, alive } = this;
    for (let c = 0; c < alive.length; c++) {
      if (!alive[c]) continue;
      const a = cons[c * 2]!, b = cons[c * 2 + 1]!;
      if (segCross(ax, ay, bx, by, p[a * 3]!, p[a * 3 + 1]!, p[b * 3]!, p[b * 3 + 1]!)) {
        alive[c] = 0;
        n++;
      }
    }
    if (n) this.wake();
    return n;
  }

  step(dt: number, gravity: number, wind?: WindFn): void {
    if (this.sleeping) return;
    const { p, q, inv, pins, cons, rest, alive, N } = this;
    const damp = this.spec.damping ?? 0.975;
    const wg = this.spec.windGain ?? 1;
    const dt2 = dt * dt;
    let energy = 0;
    for (let k = 0; k < N; k++) {
      const pin = pins[k];
      if (pin) {
        q[k * 3] = p[k * 3]!;
        q[k * 3 + 1] = p[k * 3 + 1]!;
        q[k * 3 + 2] = p[k * 3 + 2]!;
        p[k * 3] = pin[0]!;
        p[k * 3 + 1] = pin[1]!;
        p[k * 3 + 2] = pin[2]!;
        continue;
      }
      const x = p[k * 3]!, y = p[k * 3 + 1]!, z = p[k * 3 + 2]!;
      const vx = (x - q[k * 3]!) * damp, vy = (y - q[k * 3 + 1]!) * damp, vz = (z - q[k * 3 + 2]!) * damp;
      q[k * 3] = x;
      q[k * 3 + 1] = y;
      q[k * 3 + 2] = z;
      let ax = 0, ay = gravity, az = 0;
      if (wind) {
        const [wx, wy] = wind(x, y);
        ax += wx * wg;
        ay += wy * wg;
        az += Math.abs(wx) * wg * 0.35 * Math.sin(k * 0.37);
      }
      p[k * 3] = x + vx + ax * dt2;
      p[k * 3 + 1] = y + vy + ay * dt2;
      p[k * 3 + 2] = (z + vz + az * dt2) * 0.995;
      energy += vx * vx + vy * vy + vz * vz;
    }
    const stiff = this.spec.stiffness ?? 1;
    const nc = alive.length;
    for (let it = 0; it < 10; it++) {
      for (let k = 0; k < N; k++) {
        const pin = pins[k];
        if (pin) {
          p[k * 3] = pin[0]!;
          p[k * 3 + 1] = pin[1]!;
          p[k * 3 + 2] = pin[2]!;
        }
      }
      for (let c = 0; c < nc; c++) {
        if (!alive[c]) continue;
        const a = cons[c * 2]!, b = cons[c * 2 + 1]!;
        const dx = p[b * 3]! - p[a * 3]!, dy = p[b * 3 + 1]! - p[a * 3 + 1]!, dz = p[b * 3 + 2]! - p[a * 3 + 2]!;
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const wa = pins[a] ? 0 : inv[a]!, wb = pins[b] ? 0 : inv[b]!;
        const ws = wa + wb;
        if (!ws) continue;
        const r = rest[c]!;
        // cloth barely stretches, but compresses freely (buckles in z instead)
        const diff = ((d - r) / d / ws) * (d > r ? stiff : 0.35 * stiff);
        p[a * 3] = p[a * 3]! + dx * diff * wa;
        p[a * 3 + 1] = p[a * 3 + 1]! + dy * diff * wa;
        p[a * 3 + 2] = p[a * 3 + 2]! + dz * diff * wa;
        p[b * 3] = p[b * 3]! - dx * diff * wb;
        p[b * 3 + 1] = p[b * 3 + 1]! - dy * diff * wb;
        p[b * 3 + 2] = p[b * 3 + 2]! - dz * diff * wb;
      }
    }
    if (energy < 0.0006 * N) {
      this.still += dt;
      if (this.still > 1.5 && !wind) this.sleeping = true;
    } else this.still = 0;
  }

  /** World bounds of the mesh. */
  bounds(): [number, number, number, number] {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < this.N; k++) {
      const x = this.p[k * 3]!, y = this.p[k * 3 + 1]!;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }

  private quadAlive(i: number, j: number): boolean {
    // a quad is gone when any of its four structural edges is torn
    const { cols } = this;
    const k = j * cols + i;
    return this.edgeAlive(k, k + 1) && this.edgeAlive(k, k + cols) && this.edgeAlive(k + 1, k + cols + 1) && this.edgeAlive(k + cols, k + cols + 1);
  }

  private edgeIndex: Map<number, number> | null = null;
  private edgeAlive(a: number, b: number): boolean {
    if (!this.edgeIndex) {
      this.edgeIndex = new Map();
      for (let c = 0; c < this.alive.length; c++) this.edgeIndex.set(this.cons[c * 2]! * 65536 + this.cons[c * 2 + 1]!, c);
    }
    const c = this.edgeIndex.get(a * 65536 + b);
    return c === undefined ? true : this.alive[c] === 1;
  }

  /**
   * Rasterise the deformed cloth into `g` (logical (0,0) at world (ox, oy)):
   * every destination pixel inside a live quad maps back through inverse
   * bilinear to its source cell, so the cloth keeps its real pixels.
   */
  rasterize(g: CellGrid, ox: number, oy: number): void {
    const { cols, rows, p, spec } = this;
    const src = spec.src;
    const sp = spec.spacing;
    const fold = spec.foldGain ?? 1.6;
    const zbuf = new Float32Array(g.W * g.Hh).fill(-1e9);
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        if (!this.quadAlive(i, j)) continue;
        const k00 = j * cols + i, k10 = k00 + 1, k01 = k00 + cols, k11 = k01 + 1;
        const ax = p[k00 * 3]! - ox, ay = p[k00 * 3 + 1]! - oy;
        const bx = p[k10 * 3]! - ox, by = p[k10 * 3 + 1]! - oy;
        const cx = p[k11 * 3]! - ox, cy = p[k11 * 3 + 1]! - oy;
        const dx = p[k01 * 3]! - ox, dy = p[k01 * 3 + 1]! - oy;
        const z00 = p[k00 * 3 + 2]!, z10 = p[k10 * 3 + 2]!, z01 = p[k01 * 3 + 2]!, z11 = p[k11 * 3 + 2]!;
        const x0 = Math.floor(Math.min(ax, bx, cx, dx)), x1 = Math.ceil(Math.max(ax, bx, cx, dx));
        const y0 = Math.floor(Math.min(ay, by, cy, dy)), y1 = Math.ceil(Math.max(ay, by, cy, dy));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const uv = invBilinear(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy, dx, dy);
            if (!uv) continue;
            const [u, v] = uv;
            const sx = Math.floor((i + u) * sp), sy = Math.floor((j + v) * sp);
            const si = src.inner(sx, sy);
            if (si < 0 || !src.mat[si]) continue;
            const di = g.inner(x, y);
            if (di < 0) continue;
            const z = z00 * (1 - u) * (1 - v) + z10 * u * (1 - v) + z01 * (1 - u) * v + z11 * u * v;
            if (z <= zbuf[di]!) continue;
            zbuf[di] = z;
            g.mat[di] = src.mat[si]!;
            g.tone[di] = src.tone[si]!;
            g.piece[di] = src.piece[si]!;
            g.flags[di] = src.flags[si]! | (g.flags[di]! & F_NOINK);
            g.height[di] = src.height[si]! + 6 + z * fold;
            g.hp[di] = src.hp[si]!;
          }
        }
      }
    }
    g.recount();
    g.markAll();
  }
}

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------

export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

export function segCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number): number => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = o(ax, ay, bx, by, cx, cy), d2 = o(ax, ay, bx, by, dx, dy);
  const d3 = o(cx, cy, dx, dy, ax, ay), d4 = o(cx, cy, dx, dy, bx, by);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Inverse bilinear (Inigo Quilez): p inside quad a(00) b(10) c(11) d(01) -> (u, v), or null. */
export function invBilinear(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): [number, number] | null {
  const ex = bx - ax, ey = by - ay, fx = dx - ax, fy = dy - ay;
  const gx = ax - bx + cx - dx, gy = ay - by + cy - dy;
  const hx = px - ax, hy = py - ay;
  const cr = (x1: number, y1: number, x2: number, y2: number): number => x1 * y2 - y1 * x2;
  const k2 = cr(gx, gy, fx, fy);
  const k1 = cr(ex, ey, fx, fy) + cr(hx, hy, gx, gy);
  const k0 = cr(hx, hy, ex, ey);
  const solveU = (v: number): number => {
    const den1 = ex + gx * v, den2 = ey + gy * v;
    return Math.abs(den1) > Math.abs(den2) ? (hx - fx * v) / den1 : (hy - fy * v) / den2;
  };
  let u: number, v: number;
  if (Math.abs(k2) < 1e-4) {
    if (Math.abs(k1) < 1e-9) return null;
    v = -k0 / k1;
    u = solveU(v);
  } else {
    let w = k1 * k1 - 4 * k0 * k2;
    if (w < 0) return null;
    w = Math.sqrt(w);
    const ik2 = 0.5 / k2;
    v = (-k1 - w) * ik2;
    u = solveU(v);
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      v = (-k1 + w) * ik2;
      u = solveU(v);
    }
  }
  if (u < -1e-3 || u > 1.001 || v < -1e-3 || v > 1.001) return null;
  return [Math.min(0.9999, Math.max(0, u)), Math.min(0.9999, Math.max(0, v))];
}

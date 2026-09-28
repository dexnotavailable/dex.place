// Particle systems drawn as whole-pixel point sprites: drifting dust and motes,
// rising embers, falling specks, and bird flocks. Positions are layer pixels;
// the engine applies the layer's parallax offset and rounds.

import { FLASH_SHAPE } from "./flashes.ts";
import type { PointSink, PointSystem, SimEnv } from "./types.ts";

type Rect = [number, number, number, number];

export interface MoteOpts {
  /** Spawn/live region x0, y0, x1, y1 (layer px). Motes wrap inside it. */
  region: Rect;
  count: number;
  row: number;
  shade?: [number, number];
  /** Base velocity px/s and random wander strength. */
  vel?: [number, number];
  wander?: number;
  size?: number;
  /** Optional visibility 0..1 at a layer point (e.g. only inside a light shaft). */
  visible?: (x: number, y: number, t: number) => number;
  /** Twinkle: fraction of time a mote is dimmed. */
  twinkle?: number;
}

/** Slow drifting dust / motes / snow. */
export class Motes implements PointSystem {
  private xs: Float32Array;
  private ys: Float32Array;
  private ph: Float32Array;
  private t = 0;
  constructor(
    private o: MoteOpts,
    rng: () => number,
  ) {
    const n = o.count;
    this.xs = new Float32Array(n);
    this.ys = new Float32Array(n);
    this.ph = new Float32Array(n);
    const [x0, y0, x1, y1] = o.region;
    for (let i = 0; i < n; i++) {
      this.xs[i] = x0 + rng() * (x1 - x0);
      this.ys[i] = y0 + rng() * (y1 - y0);
      this.ph[i] = rng() * 1000;
    }
  }
  update(dt: number, env: SimEnv): void {
    const k = env.reduced ? 0.4 : 1;
    this.t = env.t;
    const [vx, vy] = this.o.vel ?? [2, -1];
    const w = this.o.wander ?? 3;
    const [x0, y0, x1, y1] = this.o.region;
    for (let i = 0; i < this.xs.length; i++) {
      const p = this.ph[i]!;
      this.xs[i]! += (vx + Math.sin(env.t * 0.37 + p) * w) * dt * k;
      this.ys[i]! += (vy + Math.cos(env.t * 0.29 + p * 1.3) * w * 0.6) * dt * k;
      if (this.xs[i]! < x0) this.xs[i]! += x1 - x0;
      if (this.xs[i]! > x1) this.xs[i]! -= x1 - x0;
      if (this.ys[i]! < y0) this.ys[i]! += y1 - y0;
      if (this.ys[i]! > y1) this.ys[i]! -= y1 - y0;
    }
  }
  draw(sink: PointSink): void {
    const [s0, s1] = this.o.shade ?? [0.6, 0.95];
    const tw = this.o.twinkle ?? 0.3;
    for (let i = 0; i < this.xs.length; i++) {
      const x = this.xs[i]!;
      const y = this.ys[i]!;
      const vis = this.o.visible ? this.o.visible(x, y, this.t) : 1;
      if (vis <= 0.05) continue;
      const p = this.ph[i]!;
      const dim = (Math.sin(this.t * 0.8 + p * 7.1) * 0.5 + 0.5) < tw ? 0.5 : 1;
      const shade = s0 + (s1 - s0) * Math.min(1, vis) * dim;
      sink.push(Math.round(x), Math.round(y), this.o.size ?? 1, FLASH_SHAPE.square, this.o.row, shade, 0, vis > 0.5 ? 1 : 0.6);
    }
  }
}

export interface FallOpts {
  /** Where specks break off: x0, y0, x1, y1. */
  source: Rect;
  /** Falling ends (fades out) at this y. */
  floor: number;
  /** Mean seconds between specks. */
  every: number;
  speed: number;
  drift?: number;
  row: number;
  shade?: number;
  max?: number;
}

/** Specks falling from something enormous, slowly (they are far away). */
export class Falling implements PointSystem {
  private ps: { x: number; y: number; v: number; s: number }[] = [];
  private acc = 0;
  constructor(private o: FallOpts) {}
  update(dt: number, env: SimEnv): void {
    const k = env.reduced ? 0.5 : 1;
    this.acc += dt;
    if (this.acc > this.o.every * (0.4 + env.ctx.rng() * 1.2) && this.ps.length < (this.o.max ?? 8)) {
      this.acc = 0;
      const [x0, y0, x1, y1] = this.o.source;
      this.ps.push({ x: x0 + env.ctx.rng() * (x1 - x0), y: y0 + env.ctx.rng() * (y1 - y0), v: this.o.speed * (0.6 + env.ctx.rng() * 0.8), s: env.ctx.rng() });
    }
    for (const p of this.ps) {
      p.y += p.v * dt * k;
      p.x += (this.o.drift ?? 0) * dt * k;
    }
    this.ps = this.ps.filter((p) => p.y < this.o.floor);
  }
  draw(sink: PointSink): void {
    for (const p of this.ps) {
      const left = 1 - p.y / this.o.floor;
      sink.push(Math.round(p.x), Math.round(p.y), p.s > 0.8 ? 2 : 1, FLASH_SHAPE.square, this.o.row, (this.o.shade ?? 0.2), 0, left > 0.15 ? 1 : 0.5);
    }
  }
}

export interface EmberOpts {
  region: Rect;
  rate: number;
  rise: number;
  life: [number, number];
  row: number;
  wind?: number;
  max?: number;
}

/** Rising embers/sparks that cool through the ramp as they age. */
export class Embers implements PointSystem {
  private ps: { x: number; y: number; age: number; life: number; ph: number }[] = [];
  private acc = 0;
  constructor(private o: EmberOpts) {}
  update(dt: number, env: SimEnv): void {
    const k = env.reduced ? 0.5 : 1;
    this.acc += dt * this.o.rate * k;
    const [x0, y0, x1, y1] = this.o.region;
    while (this.acc > 1 && this.ps.length < (this.o.max ?? 60)) {
      this.acc -= 1;
      const [l0, l1] = this.o.life;
      this.ps.push({ x: x0 + env.ctx.rng() * (x1 - x0), y: y0 + env.ctx.rng() * (y1 - y0), age: 0, life: l0 + env.ctx.rng() * (l1 - l0), ph: env.ctx.rng() * 100 });
    }
    for (const p of this.ps) {
      p.age += dt * k;
      p.y -= this.o.rise * dt * k;
      p.x += ((this.o.wind ?? 3) + Math.sin(p.age * 2 + p.ph) * 6) * dt * k;
    }
    this.ps = this.ps.filter((p) => p.age < p.life);
  }
  draw(sink: PointSink): void {
    for (const p of this.ps) {
      const t = p.age / p.life;
      sink.push(Math.round(p.x), Math.round(p.y), 1, FLASH_SHAPE.square, this.o.row, 1 - t * 0.8, 0, t < 0.8 ? 1 : 0.5);
    }
  }
}

export interface FlockOpts {
  /** Band the flock crosses in (layer px), and the horizontal span to cross. */
  y: [number, number];
  x: [number, number];
  /** Mean seconds between crossings. */
  every: number;
  speed: number;
  count: [number, number];
  row: number;
  shade?: number;
}

/** An occasional small flock crossing, 7x3 flapping birds in a loose V. */
export class Flock implements PointSystem {
  private birds: { x: number; y: number; ph: number; rate: number }[] = [];
  private wait: number;
  private dir = 1;
  private t = 0;
  constructor(private o: FlockOpts) {
    this.wait = o.every * 0.25;
  }
  update(dt: number, env: SimEnv): void {
    this.t = env.t;
    const k = env.reduced ? 0.6 : 1;
    if (this.birds.length === 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const r = env.ctx.rng;
        this.wait = this.o.every * (0.6 + r() * 0.8);
        this.dir = r() < 0.5 ? 1 : -1;
        const n = Math.round(this.o.count[0] + r() * (this.o.count[1] - this.o.count[0]));
        const y = this.o.y[0] + r() * (this.o.y[1] - this.o.y[0]);
        const x = this.dir > 0 ? this.o.x[0] : this.o.x[1];
        for (let i = 0; i < n; i++) {
          const rank = Math.ceil(i / 2);
          const side = i % 2 ? 1 : -1;
          this.birds.push({ x: x - this.dir * rank * (9 + r() * 5), y: y + side * rank * (3 + r() * 2), ph: r() * 6, rate: 5 + r() * 2 });
        }
      }
      return;
    }
    for (const b of this.birds) {
      b.x += this.dir * this.o.speed * dt * k;
      b.y += Math.sin(this.t * 0.7 + b.ph) * 1.5 * dt;
    }
    this.birds = this.birds.filter((b) => (this.dir > 0 ? b.x < this.o.x[1] + 60 : b.x > this.o.x[0] - 60));
  }
  draw(sink: PointSink): void {
    for (const b of this.birds) {
      // flap cycle: up, level, down, level; with glides
      const c = Math.floor(this.t * b.rate + b.ph) % 8;
      const frame = c < 4 ? [0, 1, 2, 1][c]! : 1;
      sink.push(Math.round(b.x) - 3, Math.round(b.y) - 1, 7, FLASH_SHAPE.bird, this.o.row, this.o.shade ?? 0.1, frame, 1);
    }
  }
}

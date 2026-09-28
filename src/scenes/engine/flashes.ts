// Light-flash accents: rare, small, never strobing. Every emitter in every
// layer asks one global gate before starting a flash, and the gate allows at
// most 3 starts in any rolling second (1 per 2 s in reduced motion, where
// flashes also fade in slowly and stay dimmer). Intensity steps in quarters
// over time, like hand-keyed frames, and no flash is shorter than 0.18 s.

import { hex, type Hex } from "./palette.ts";
import type { LightOut, PointSink, PointSystem, SimEnv } from "./types.ts";

export const FLASH_SHAPE = { square: 0, bird: 1, glint: 2, glow: 3, plus: 4 } as const;

export class FlashGate {
  private starts: number[] = [];
  allow(now: number, reduced: boolean): boolean {
    const win = reduced ? 2 : 1;
    const max = reduced ? 1 : 3;
    this.starts = this.starts.filter((t) => now - t < win && now >= t);
    if (this.starts.length >= max) return false;
    this.starts.push(now);
    return true;
  }
  reset(): void {
    this.starts = [];
  }
}

export interface FlashSpec {
  kind: "glint" | "glow" | "sheet";
  /** Average starts per minute for this emitter (before the global gate). */
  rate: number;
  /** Layer-space centre for a new flash. */
  at: (rng: () => number) => [number, number];
  /** Sprite size in px (glint span / glow diameter); a range picks per flash. */
  size: number | [number, number];
  row: number;
  shade?: number;
  /** Seconds, min..max. */
  duration?: [number, number];
  intensity?: number;
  /** Light thrown onto layers through flashLight() / flashTint(). */
  light?: { radius: number; colour: Hex; strength: number };
}

interface Live {
  spec: FlashSpec;
  x: number;
  y: number;
  size: number;
  age: number;
  dur: number;
  attack: number;
  level: number;
}

export class FlashAccents implements PointSystem {
  private live: Live[] = [];
  private rng: () => number = Math.random;
  constructor(private specs: FlashSpec[]) {}

  update(dt: number, env: SimEnv): void {
    this.rng = env.ctx.rng;
    for (const l of this.live) {
      l.age += dt;
      const e = l.age < l.attack ? l.age / l.attack : 1 - (l.age - l.attack) / Math.max(0.01, l.dur - l.attack);
      l.level = Math.max(0, Math.ceil(Math.min(1, e) * 4) / 4) * (l.spec.intensity ?? 1) * (env.reduced ? 0.6 : 1);
    }
    this.live = this.live.filter((l) => l.age < l.dur);
    for (const s of this.specs) {
      const p = (s.rate / 60) * dt * (env.reduced ? 0.4 : 1);
      if (this.rng() >= p) continue;
      if (!env.flashGate()) continue;
      const [x, y] = s.at(this.rng);
      const [d0, d1] = s.duration ?? [0.25, 0.6];
      let dur = Math.max(0.18, d0 + (d1 - d0) * this.rng());
      if (env.reduced) dur *= 1.8;
      const size = typeof s.size === "number" ? s.size : Math.round(s.size[0] + (s.size[1] - s.size[0]) * this.rng());
      this.live.push({ spec: s, x, y, size: size | 1, age: 0, dur, attack: dur * (env.reduced ? 0.45 : s.kind === "glint" ? 0.3 : 0.2), level: 0 });
    }
  }

  draw(sink: PointSink): void {
    for (const l of this.live) {
      if (l.level <= 0) continue;
      const shape = l.spec.kind === "glint" ? FLASH_SHAPE.glint : FLASH_SHAPE.glow;
      const half = (l.size - 1) / 2;
      sink.push(Math.round(l.x - half), Math.round(l.y - half), l.size, shape, l.spec.row, l.spec.shade ?? 0.95, 0, l.level);
    }
  }

  lights(out: LightOut[]): void {
    for (const l of this.live) {
      const li = l.spec.light;
      if (!li || l.level <= 0) continue;
      const [r, g, b] = hex(li.colour);
      out.push({ x: l.x, y: l.y, radius: li.radius, intensity: li.strength * l.level, colour: [r / 255, g / 255, b / 255] });
    }
  }
}

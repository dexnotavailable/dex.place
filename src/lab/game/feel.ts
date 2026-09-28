// Game feel state shared by everything: hitstop (global freeze), slow motion,
// impact frames, the ultimate cut-in and sound cues. Timers here run in real
// ticks so a slowed or frozen simulation still ends them on time.

import type { Camera } from "../engine/camera.ts";

export interface CutinState {
  id: string;
  t: number;
  duration: number;
}

export class Feel {
  hitstop = 0;
  slowFactor = 1;
  private slowLeft = 0;
  impact: 0 | 1 | 2 = 0;
  private impactLeft = 0;
  private impactCooldown = 0;
  cutin: CutinState | null = null;
  readonly reducedMotion: boolean;
  onSound: (id: string, volume: number) => void = () => {};
  onCutin: (id: string, duration: number) => void = () => {};

  constructor(readonly camera: Camera, readonly tuning: { maxHitstop: number; impactCooldown: number }) {
    this.reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    camera.reducedMotion = this.reducedMotion;
  }

  freeze(ticks: number): void {
    this.hitstop = Math.min(this.tuning.maxHitstop, Math.max(this.hitstop, ticks));
  }

  slowmo(factor: number, duration: number): void {
    if (factor <= this.slowFactor || this.slowLeft <= 0) {
      this.slowFactor = factor;
      this.slowLeft = duration;
    }
  }

  impactFrame(mode: "invert" | "mono", duration: number): void {
    if (this.reducedMotion || this.impactCooldown > 0) return;
    this.impact = mode === "invert" ? 1 : 2;
    this.impactLeft = duration;
    this.impactCooldown = this.tuning.impactCooldown;
  }

  startCutin(id: string, duration: number): void {
    this.cutin = { id, t: 0, duration };
    this.onCutin(id, duration);
  }

  sound(id: string, volume = 1): void {
    this.onSound(id, volume);
  }

  /** One real-time tick. */
  realTick(): void {
    if (this.slowLeft > 0 && --this.slowLeft === 0) this.slowFactor = 1;
    if (this.impactLeft > 0 && --this.impactLeft === 0) this.impact = 0;
    if (this.impactCooldown > 0) this.impactCooldown--;
    if (this.cutin && ++this.cutin.t >= this.cutin.duration) this.cutin = null;
  }
}

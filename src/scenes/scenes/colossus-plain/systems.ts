// Scene-local point systems for colossus-plain. They follow the colossus
// through the CPU twin of its walk model (colossus.ts), so what they throw or
// circle stays attached to the feet and back the shader draws.

import { hex, type Hex } from "../../engine/palette.ts";
import type { LightOut, PointSink, PointSystem, SimEnv } from "../../engine/types.ts";
import { EYE, HEAD_PITCH, HEAD_PIVOT, toWorld, animTime, bobAt, bodyXSnap, foot, legList, loopTime, type ColossusDef } from "./colossus.ts";

const SQUARE = 0;
const GLINT = 2;
const GLOW = 3;

/** Clods thrown when a foot peels off the ground, bits dropping off it in the swing, a low spray at the plant. */
export class Debris implements PointSystem {
  private ps: { x: number; y: number; vx: number; vy: number; row: number; shade: number; size: number }[] = [];
  private last: { n: number; lifted: boolean }[];
  private drip: number[];
  constructor(
    private c: ColossusDef,
    private rows: { tar: number; dust: number },
    private density = 1,
  ) {
    this.last = legList(c).map(() => ({ n: Number.NaN, lifted: false }));
    this.drip = legList(c).map(() => 0);
  }
  update(dt: number, env: SimEnv): void {
    const c = this.c;
    const k = env.reduced ? 0.5 : 1;
    const rng = env.ctx.rng;
    const tl = loopTime(c, animTime(env.t, env.reduced));
    const legs = legList(c);
    const g = 16 * c.S;
    legs.forEach(({ hx, phase, far }, i) => {
      const st = foot(c, tl, phase, hx);
      const L = this.last[i]!;
      const lifted = st.sw >= 0;
      const X = st.x * c.S;
      const Y = c.ground - st.y * c.S;
      const fresh = !Number.isNaN(L.n);
      const n = far ? 0.5 : 1;
      if (fresh && lifted && !L.lifted) {
        // the foot peels off: dark clods up and back
        const cnt = Math.round((3 + rng() * 4) * this.density * n);
        for (let j = 0; j < cnt; j++)
          this.ps.push({ x: X + (rng() - 0.5) * 8 * c.S, y: Y - 1, vx: (2 + rng() * 9) * c.S, vy: -(6 + rng() * 14) * c.S, row: this.rows.tar, shade: 0.1 + rng() * 0.25, size: rng() < 0.2 && c.S > 0.9 ? 2 : 1 });
      }
      if (fresh && !lifted && L.lifted) {
        // the plant: a low spray outward
        const cnt = Math.round((4 + rng() * 5) * this.density * n);
        for (let j = 0; j < cnt; j++) {
          const side = rng() < 0.5 ? -1 : 1;
          this.ps.push({ x: X + side * (4 + rng() * 6) * c.S, y: Y - 1, vx: side * (6 + rng() * 14) * c.S, vy: -(3 + rng() * 8) * c.S, row: rng() < 0.5 ? this.rows.tar : this.rows.dust, shade: 0.2 + rng() * 0.35, size: 1 });
        }
      }
      if (lifted && st.sw > 0.08 && st.sw < 0.8) {
        this.drip[i]! -= dt;
        if (this.drip[i]! <= 0) {
          this.drip[i] = (0.35 + rng() * 0.5) / (this.density * n);
          this.ps.push({ x: X + (rng() - 0.5) * 6 * c.S, y: Y, vx: (rng() - 0.3) * 2 * c.S, vy: 0, row: this.rows.tar, shade: 0.15, size: 1 });
        }
      }
      L.n = st.n;
      L.lifted = lifted;
    });
    for (const p of this.ps) {
      p.vy += g * dt * k;
      p.x += p.vx * dt * k;
      p.y += p.vy * dt * k;
    }
    this.ps = this.ps.filter((p) => p.y < c.ground + 1).slice(-200);
  }
  draw(sink: PointSink): void {
    for (const p of this.ps) sink.push(Math.round(p.x), Math.round(p.y), p.size, SQUARE, p.row, p.shade, 0, 1);
  }
}

/** Small birds wheeling over the colossus's back, like gulls over a whale: the scale cue. */
export class Wheelers implements PointSystem {
  private birds: { ph: number; r: number; ry: number; w: number; cy: number; flap: number }[] = [];
  private t = 0;
  private cx = 0;
  private cy = 0;
  private visible = false;
  constructor(
    private c: ColossusDef,
    private row: number,
    count: number,
    rng: () => number,
  ) {
    for (let i = 0; i < count; i++)
      this.birds.push({ ph: rng() * Math.PI * 2, r: (40 + rng() * 60) * c.S, ry: (8 + rng() * 14) * c.S, w: (0.18 + rng() * 0.12) * (rng() < 0.3 ? -1 : 1), cy: (rng() - 0.5) * 30 * c.S, flap: 4 + rng() * 2 });
  }
  update(_dt: number, env: SimEnv): void {
    const c = this.c;
    this.t = env.t * (env.reduced ? 0.5 : 1);
    const tl = loopTime(c, animTime(env.t, env.reduced));
    const bx = bodyXSnap(c, tl);
    this.cx = (bx + 40) * c.S;
    this.cy = c.ground - (262 - bobAt(c, tl)) * c.S;
    this.visible = this.cx > -300 * c.S && this.cx < env.ctx.W + 300 * c.S;
  }
  draw(sink: PointSink): void {
    if (!this.visible) return;
    for (const b of this.birds) {
      const a = this.t * b.w + b.ph;
      const x = Math.round(this.cx + Math.cos(a) * b.r);
      const y = Math.round(this.cy + b.cy + Math.sin(a) * b.ry);
      // three-pixel flap: up, level, down, level; gliding half the time
      const cyc = Math.floor(this.t * b.flap + b.ph * 3) % 8;
      const f = cyc < 4 ? [-1, 0, 1, 0][cyc]! : 0;
      sink.push(x, y, 1, SQUARE, this.row, 0.2, 0, 1);
      if (this.c.S >= 0.9) {
        sink.push(x - 1, y + f, 1, SQUARE, this.row, 0.3, 0, 1);
        sink.push(x + 1, y + f, 1, SQUARE, this.row, 0.3, 0, 1);
      }
    }
  }
}

export interface BoltOpts {
  /** Where bolts may start (layer px): x0, y0, x1, y1. */
  region: [number, number, number, number];
  /** Starts per minute before the global gate. */
  rate: number;
  length: [number, number];
  row: number;
  glowRow: number;
  light: { radius: number; colour: Hex; strength: number };
  /** Alpha of the stepped glow sprite around the bolt (0 = light only). */
  glowAlpha?: number;
}

/**
 * Distant lightning inside the haze: a thin stepped bolt (most of it hidden by
 * cloud drawn in front), a faint stepped glow, and light thrown onto nearby
 * layers. One gate request per bolt, quarter-step intensity, >= 0.2 s.
 */
export class Bolts implements PointSystem {
  private live: { px: [number, number][]; x: number; y: number; age: number; dur: number; level: number; size: number }[] = [];
  private col: [number, number, number];
  constructor(private o: BoltOpts) {
    const [r, g, b] = hex(o.light.colour);
    this.col = [r / 255, g / 255, b / 255];
  }
  update(dt: number, env: SimEnv): void {
    const rng = env.ctx.rng;
    for (const l of this.live) {
      l.age += dt;
      const a = l.dur * (env.reduced ? 0.45 : 0.15);
      const e = l.age < a ? l.age / a : 1 - (l.age - a) / (l.dur - a);
      l.level = Math.max(0, Math.ceil(Math.min(1, e) * 4) / 4) * (env.reduced ? 0.55 : 1);
    }
    this.live = this.live.filter((l) => l.age < l.dur);
    const p = (this.o.rate / 60) * dt * (env.reduced ? 0.4 : 1);
    if (rng() < p && env.flashGate()) {
      const [x0, y0, x1, y1] = this.o.region;
      const x = Math.round(x0 + rng() * (x1 - x0));
      const y = Math.round(y0 + rng() * (y1 - y0));
      const px: [number, number][] = [];
      const walk = (sx: number, sy: number, len: number, depth: number): void => {
        let cx = sx;
        let cy = sy;
        let drift = (rng() - 0.5) * 1.2;
        for (let i = 0; i < len; i++) {
          cy += 1;
          if (rng() < 0.55) cx += Math.sign(drift + (rng() - 0.5) * 1.6);
          if (rng() < 0.08) drift = (rng() - 0.5) * 1.6;
          px.push([cx, cy]);
          if (depth > 0 && rng() < 0.05) walk(cx, cy, Math.round(len * 0.35 * (0.5 + rng())), depth - 1);
        }
      };
      walk(x, y, Math.round(this.o.length[0] + rng() * (this.o.length[1] - this.o.length[0])), 2);
      const dur = Math.max(0.2, 0.22 + rng() * 0.25) * (env.reduced ? 1.8 : 1);
      this.live.push({ px, x, y: y + 8, age: 0, dur, level: 0, size: 41 + 2 * Math.round(rng() * 10) });
    }
  }
  draw(sink: PointSink): void {
    for (const l of this.live) {
      if (l.level <= 0) continue;
      const h = (l.size - 1) / 2;
      if ((this.o.glowAlpha ?? 0.35) > 0) sink.push(l.x - h, l.y - h, l.size, GLOW, this.o.glowRow, 0.6, 0, (this.o.glowAlpha ?? 0.35) * l.level);
      for (const [x, y] of l.px) sink.push(x, y, 1, SQUARE, this.o.row, 0.99, 0, l.level);
    }
  }
  lights(out: LightOut[]): void {
    for (const l of this.live) {
      if (l.level <= 0) continue;
      out.push({ x: l.x, y: l.y, radius: this.o.light.radius, intensity: this.o.light.strength * l.level, colour: this.col });
    }
  }
}

/** The colossus's eye catches the light, rarely: a small glint that rides the head. */
export class EyeGlint implements PointSystem {
  private age = -1;
  private dur = 0.5;
  private level = 0;
  private x = 0;
  private y = 0;
  constructor(
    private c: ColossusDef,
    private row: number,
    private rate: number,
  ) {}
  update(dt: number, env: SimEnv): void {
    const c = this.c;
    const tl = loopTime(c, animTime(env.t, env.reduced));
    const bx = bodyXSnap(c, tl);
    const bob = bobAt(c, tl);
    // same head sway as the shader
    const hang = HEAD_PITCH + 0.045 * Math.sin(tl * 0.42) + 0.025 * Math.sin(tl * 0.19 + 1);
    const [px, py] = HEAD_PIVOT;
    const dx = EYE[0] - px;
    const dy = EYE[1] - py;
    const [ex, eyw] = toWorld([px + Math.cos(hang) * dx - Math.sin(hang) * dy, py + Math.sin(hang) * dx + Math.cos(hang) * dy]);
    const ey = eyw - bob;
    this.x = Math.round((bx + ex - 1.2) * c.S);
    this.y = Math.round(c.ground - (ey + 1) * c.S);
    const onScreen = this.x > 8 && this.x < env.ctx.W - 8;
    if (this.age >= 0) {
      this.age += dt;
      const a = this.dur * 0.3;
      const e = this.age < a ? this.age / a : 1 - (this.age - a) / (this.dur - a);
      this.level = Math.max(0, Math.ceil(Math.min(1, e) * 4) / 4) * (env.reduced ? 0.6 : 1);
      if (this.age >= this.dur) {
        this.age = -1;
        this.level = 0;
      }
      return;
    }
    if (onScreen && env.ctx.rng() < (this.rate / 60) * dt * (env.reduced ? 0.4 : 1) && env.flashGate()) {
      this.age = 0;
      this.dur = (0.45 + env.ctx.rng() * 0.35) * (env.reduced ? 1.8 : 1);
    }
  }
  draw(sink: PointSink): void {
    if (this.level <= 0) return;
    sink.push(this.x - 3, this.y - 3, 7, GLINT, this.row, 0.99, 0, this.level);
  }
}

/**
 * Sheet lightning: no visible sprite, only light thrown through flashLight(),
 * so the cloud and haze around it brighten in their own shapes. One gate
 * request per flash; sometimes a second, dimmer pulse follows.
 */
export class SheetLight implements PointSystem {
  private live: { x: number; y: number; age: number; dur: number; level: number; peak: number }[] = [];
  private col: [number, number, number];
  constructor(private o: { region: [number, number, number, number]; rate: number; radius: number; colour: Hex; strength: number }) {
    const [r, g, b] = hex(o.colour);
    this.col = [r / 255, g / 255, b / 255];
  }
  update(dt: number, env: SimEnv): void {
    const rng = env.ctx.rng;
    for (const l of this.live) {
      l.age += dt;
      const a = l.dur * (env.reduced ? 0.45 : 0.2);
      const e = l.age < a ? l.age / a : 1 - (l.age - a) / (l.dur - a);
      l.level = Math.max(0, Math.ceil(Math.min(1, e) * 4) / 4) * l.peak * (env.reduced ? 0.55 : 1);
    }
    this.live = this.live.filter((l) => l.age < l.dur);
    if (rng() < (this.o.rate / 60) * dt * (env.reduced ? 0.4 : 1) && env.flashGate()) {
      const [x0, y0, x1, y1] = this.o.region;
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      const dur = (0.3 + rng() * 0.35) * (env.reduced ? 1.8 : 1);
      this.live.push({ x, y, age: 0, dur, level: 0, peak: 1 });
      // a second, dimmer pulse a moment later (asks the gate again)
      if (!env.reduced && rng() < 0.4 && env.flashGate()) this.live.push({ x: x + (rng() - 0.5) * 40, y, age: -0.35 - rng() * 0.2, dur: dur * 0.8, level: 0, peak: 0.6 });
    }
  }
  draw(_sink: PointSink): void {}
  lights(out: LightOut[]): void {
    for (const l of this.live) {
      if (l.level <= 0 || l.age < 0) continue;
      out.push({ x: l.x, y: l.y, radius: this.o.radius, intensity: this.o.strength * l.level, colour: this.col });
    }
  }
}

/**
 * Not drawn: keeps a layer's scissor box on the creature as it walks, so the
 * per-pixel body shader only runs over the columns it can touch (and not at
 * all while that creature is between crossings). Mutates the layer's bounds,
 * which the engine reads every frame.
 */
export class Tracker implements PointSystem {
  constructor(private items: { c: ColossusDef; bounds: { x0?: number; x1?: number }; ext: [number, number]; margin: number }[]) {}
  update(_dt: number, env: SimEnv): void {
    for (const it of this.items) {
      const tl = loopTime(it.c, animTime(env.t, env.reduced));
      const bx = bodyXSnap(it.c, tl) * it.c.S;
      it.bounds.x0 = Math.floor(bx + it.ext[0] * it.c.S - it.margin);
      it.bounds.x1 = Math.ceil(bx + it.ext[1] * it.c.S + it.margin);
    }
  }
  draw(_sink: PointSink): void {}
}

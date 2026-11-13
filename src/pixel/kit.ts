// Shared helpers for kit and region recipes: live flames (candles, lamps,
// lanterns), little particle puffs (dust, splinters, straw, sparks, smoke,
// water, petals), a hit's side and strength, and "how much of this part is
// left". Everything here is sized in H and goes through the world's budgets
// and flash gate.

import { P_ADD, P_DRAG, P_FADE, P_GRAV, P_RISE, P_SETTLE } from "./bodies.ts";
import { F_NOINK } from "./cells.ts";
import { coverage, hitCentre, type Hit } from "./hits.ts";
import { resolveMat, type MatRef } from "./materials.ts";
import { flicker } from "./motion.ts";
import type { Part } from "./part.ts";
import type { Prop, PropBuilder, PropGlow, PropLight } from "./prop.ts";
import type { PixelWorld } from "./world.ts";

// ---------------------------------------------------------------------------
// Flames
// ---------------------------------------------------------------------------

export interface Flame {
  part: Part;
  light: PropLight | null;
  glow: PropGlow | null;
  /** Current and target size, 0 (out) .. 1 (lit). */
  level: number;
  target: number;
  lean: number;
  leanV: number;
  /** Seconds of smoke left (after it gutters). */
  smoke: number;
  seed: number;
  /** Light intensity and glow intensity at level 1. */
  i0: number;
  g0: number;
}

export interface FlameSpec {
  /** Name of the new flame part; it sits on `parent` at `at` (parent-local px, the flame's base). */
  name: string;
  parent?: string;
  at: [number, number];
  /** Flame box in H (width, height). Defaults 0.07 x 0.16. */
  size?: [number, number];
  /** Light radius in H (0: no light) and intensity. */
  light?: number;
  intensity?: number;
  colour?: [number, number, number];
  /** Glow disc radius in H (0: none). */
  glow?: number;
  layer?: "bg" | "mid" | "fg";
  z?: number;
  lit?: boolean;
}

/**
 * A live flame part: redrawn at 15 Hz (hand-keyed pixel-art timing, and a
 * quarter of the uploads), leaning with the wind and its holder's swing.
 * Step it with stepFlame() from the prop's update.
 */
export function addFlame(b: PropBuilder, s: FlameSpec): Flame {
  const [fwH, fhH] = s.size ?? [0.07, 0.16];
  const fw = Math.max(4, b.u(fwH)), fh = Math.max(6, b.u(fhH));
  b.part(s.name, { w: fw, h: fh, pivot: [Math.floor(fw / 2), fh], at: s.at, parent: s.parent, layer: s.layer ?? "mid", outline: 0, hittable: false, smoothRotate: true, z: s.z ?? 12 });
  const colour = s.colour ?? [1, 0.68, 0.36];
  const light = s.light === 0 ? null : b.light({ part: s.name, at: [fw / 2, fh * 0.55], colour, radius: b.u(s.light ?? 1.6), intensity: s.intensity ?? 0.5, flicker: 0.4, height: b.u(0.35) });
  const glow = s.glow === 0 ? null : b.glow({ part: s.name, at: [fw / 2, fh * 0.6], colour: [colour[0], colour[1] * 0.86, colour[2] * 0.7], radius: b.u(s.glow ?? 0.24), intensity: 0.5, flicker: 0.5 });
  const on = s.lit !== false ? 1 : 0;
  const f: Flame = { part: b.get(s.name), light, glow, level: on, target: on, lean: 0, leanV: 0, smoke: 0, seed: b.rand() * 100, i0: light?.intensity ?? 0, g0: glow?.intensity ?? 0 };
  f.part.dynamicEvery = 4;
  f.part.dynamicPhase = Math.floor(b.rand() * 4);
  f.part.dynamic = (part) => drawFlame(f, part.prop?.world.time ?? 0);
  if (light) light.level = on;
  if (glow) glow.level = on;
  return f;
}

/** Rasterise a flame into its part: a teardrop that leans, with a hot core. */
export function drawFlame(f: Flame, t: number): void {
  const g = f.part.grid;
  g.clearAll();
  if (f.level <= 0.02) return;
  const fl = flicker(t, f.seed, 1.3);
  const s = f.level * (0.8 + 0.2 * fl);
  const fh = Math.max(3, Math.round(g.h * s));
  const maxHalf = Math.max(1.2, (g.w / 2) * (0.75 + 0.25 * s));
  const flame = resolveMat("flame").id;
  for (let y = 0; y < fh; y++) {
    const tt = (y + 0.5) / fh; // 0 tip .. 1 base
    const half = maxHalf * Math.pow(Math.sin(Math.PI * Math.min(1, tt * 0.92 + 0.06)), 0.85) * (0.55 + 0.45 * tt);
    const lean = f.lean * Math.pow(1 - tt, 1.6) * fh * 0.9 + Math.sin(t * 9 + f.seed + y * 0.4) * (1 - tt) * 0.6;
    const cx = g.w / 2 + lean;
    for (let x = 0; x < g.w; x++) {
      const d = Math.abs(x + 0.5 - cx) / Math.max(half, 0.6);
      if (d > 1) continue;
      const i = g.inner(x, g.h - fh + y);
      if (i < 0) continue;
      let tone = d < 0.4 && tt > 0.35 ? 1 : d < 0.75 ? 0 : -1;
      if (tt < 0.18) tone = -1;
      if (tt > 0.88 && d < 0.5) tone = -2;
      g.setRaw(i, flame, tone, 1, 2, F_NOINK, 1);
    }
  }
  f.part.heat = (fl - 0.85) * 3;
}

/** Ease a flame toward its target, lean it in the wind (plus `sway` from its holder), trail smoke after it gutters. */
export function stepFlame(c: Prop, f: Flame, dt: number, sway = 0): void {
  const w = c.world;
  const rate = f.target > f.level ? 2.2 : 3.2;
  f.level += Math.sign(f.target - f.level) * Math.min(Math.abs(f.target - f.level), rate * dt);
  const [wx] = w.windAt(f.part.wx, f.part.wy);
  const targetLean = Math.max(-1.2, Math.min(1.2, wx * 0.0022 - sway * 0.25));
  f.leanV += ((targetLean - f.lean) * 60 - f.leanV * 8) * dt;
  f.lean += f.leanV * dt;
  if (f.light) f.light.level = f.level;
  if (f.glow) f.glow.level = f.level;
  if (f.smoke > 0) {
    f.smoke -= dt;
    if (c.rand() < dt * 16 && w.inView(f.part.wx, f.part.wy, c.params.H)) {
      const [x, y] = f.part.toWorld(f.part.pivotX, f.part.pivotY - 2);
      const g = 96 + Math.floor(c.rand() * 30);
      w.particles.spawn({ x: x + (c.rand() - 0.5) * 2, y, vx: (c.rand() - 0.5) * 8 + wx * 0.02, vy: -16 - c.rand() * 12, life: 0.9 + c.rand() * 0.9, rgb: [g, g - 4, g + 12], flags: P_RISE | P_DRAG | P_FADE });
    }
  }
}

/** Put a flame out (smoke, a gutter cue once). */
export function snuffFlame(c: Prop, f: Flame): void {
  if (f.target === 0) return;
  f.target = 0;
  f.smoke = 1.4;
  c.sound("flame.gutter", 0.5);
}

/** Light a flame (a small burst of sparks at the wick). */
export function lightFlame(c: Prop, f: Flame): void {
  if (f.target === 1) return;
  f.target = 1;
  const [x, y] = f.part.toWorld(f.part.pivotX, f.part.pivotY - 3);
  for (let k = 0; k < 5; k++) c.world.particles.spawn({ x, y, vx: (c.rand() - 0.5) * 24, vy: -18 - c.rand() * 24, life: 0.25 + c.rand() * 0.25, rgb: [255, 214, 140], flags: P_ADD | P_DRAG });
}

/** Does the hit reach this flame (its shape, or a heavy hit's shock nearby)? */
export function hitReaches(hit: Hit, f: Flame, H: number, contact: [number, number] | null): boolean {
  const [x, y] = f.part.toWorld(f.part.pivotX, f.part.pivotY - 4);
  if (coverage(hit.shape, x, y) > 0 || coverage(hit.shape, x, y + 6) > 0) return true;
  if (contact && Math.hypot(contact[0] - x, contact[1] - y) < H * 0.7) return true;
  if (hit.type === "wind" && hit.shape.kind === "cone") {
    const s = hit.shape;
    return Math.hypot(x - s.x, y - s.y) < s.len * 1.1;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Puffs
// ---------------------------------------------------------------------------

export type PuffKind = "dust" | "splinter" | "straw" | "spark" | "smoke" | "water" | "petal" | "leaf" | "paper" | "ash";

const PUFF: Record<PuffKind, { rgb: [number, number, number][]; flags: number; vx: number; vy: number; life: [number, number]; size?: 1 | 2 }> = {
  dust: { rgb: [[110, 100, 112], [132, 122, 128], [92, 86, 100]], flags: P_DRAG | P_RISE | P_FADE, vx: 0.5, vy: -0.25, life: [0.5, 1.1] },
  splinter: { rgb: [[100, 63, 50], [133, 88, 65], [69, 42, 38]], flags: P_GRAV | P_SETTLE | P_FADE, vx: 1.6, vy: -1.6, life: [0.8, 1.6] },
  straw: { rgb: [[176, 146, 84], [204, 176, 110], [140, 112, 64]], flags: P_GRAV | P_DRAG | P_SETTLE | P_FADE, vx: 1.2, vy: -1.4, life: [0.9, 1.8] },
  spark: { rgb: [[255, 236, 180], [255, 190, 110]], flags: P_ADD | P_GRAV, vx: 2.6, vy: -2.2, life: [0.15, 0.4] },
  smoke: { rgb: [[96, 92, 108], [118, 112, 126]], flags: P_RISE | P_DRAG | P_FADE, vx: 0.15, vy: -0.25, life: [0.9, 1.8] },
  water: { rgb: [[44, 80, 100], [92, 138, 154], [184, 221, 228]], flags: P_GRAV | P_FADE, vx: 0.9, vy: -1.6, life: [0.35, 0.7] },
  petal: { rgb: [[176, 102, 110], [206, 150, 132], [228, 196, 150]], flags: P_GRAV | P_DRAG | P_SETTLE | P_FADE, vx: 0.9, vy: -1.2, life: [1.2, 2.2] },
  leaf: { rgb: [[47, 74, 51], [71, 102, 68], [31, 51, 38]], flags: P_GRAV | P_DRAG | P_SETTLE | P_FADE, vx: 1, vy: -1.3, life: [1, 2] },
  paper: { rgb: [[179, 156, 128], [210, 192, 159]], flags: P_GRAV | P_DRAG | P_FADE, vx: 1.1, vy: -1.1, life: [0.8, 1.4] },
  ash: { rgb: [[70, 66, 76], [96, 90, 100]], flags: P_RISE | P_DRAG | P_FADE, vx: 0.3, vy: -0.4, life: [1.2, 2.4] },
};

/**
 * A little burst of particles at (x, y): `n` of `kind`, thrown along `dir`
 * (unit, default up) with speeds in H/s. Off-screen bursts are skipped.
 */
export function puff(world: PixelWorld, kind: PuffKind, x: number, y: number, n: number, dir: [number, number] = [0, -1], o: { speed?: number; spread?: number; rgb?: [number, number, number][] } = {}): void {
  if (!world.inView(x, y, world.H * 2)) return;
  const P = PUFF[kind];
  const H = world.H, r = world.rand;
  const sp = o.speed ?? 1, spread = o.spread ?? 1.2;
  const base = Math.atan2(dir[1], dir[0]);
  const cols = o.rgb ?? P.rgb;
  if (world.reduced) n = Math.ceil(n * 0.6);
  for (let k = 0; k < n; k++) {
    const a = base + (r() - 0.5) * spread * 2;
    const v = H * sp * (0.4 + r() * 0.8);
    world.particles.spawn({
      x: x + (r() - 0.5) * 3, y: y + (r() - 0.5) * 3,
      vx: Math.cos(a) * v * P.vx + (r() - 0.5) * 6, vy: Math.sin(a) * v * Math.abs(P.vy) + (P.vy < 0 && dir[1] >= 0 ? 0 : 0),
      life: P.life[0] + r() * (P.life[1] - P.life[0]), rgb: cols[Math.floor(r() * cols.length)]!, flags: P.flags, size: P.size,
    });
  }
}

// ---------------------------------------------------------------------------
// Hits and parts
// ---------------------------------------------------------------------------

/** Which way a hit pushes (+1 right, -1 left), and how hard in H/s, by type. */
export function hitPush(hit: Hit, H: number): { side: 1 | -1; strength: number } {
  const side: 1 | -1 = hit.dir[0] < 0 ? -1 : 1;
  const k = hit.type === "wind" ? 0.35 : hit.type === "slash" || hit.type === "point" ? 0.6 : hit.type === "heavy" ? 1 : 1.4;
  return { side, strength: Math.min(4, (hit.force / H) * k) };
}

/** Where the hit lands (its contact, or the shape's centre). */
export function hitAt(hit: Hit, contact: [number, number] | null): [number, number] {
  return contact ?? hitCentre(hit.shape);
}

/** Solid cells the part was built with. */
export function origCount(p: Part): number {
  const o = p.grid.orig;
  if (!o) return p.grid.count;
  let n = p.tag["origCount"] as number | undefined;
  if (n !== undefined) return n;
  n = 0;
  for (let i = 0; i < o.mat.length; i++) if (o.mat[i]) n++;
  p.tag["origCount"] = n;
  return n;
}

/** Share of the part's original cells still in place (0..1). */
export function remaining(p: Part): number {
  const n = origCount(p);
  return n ? p.grid.count / n : 1;
}

/**
 * Unlit / lit glass: backlit materials (lampGlass, paperLamp, screens) read
 * as dark panes when their light is out. Shifts every cell of the given
 * materials `dark` tones below the original (0 = as built). Only repaints
 * when the level changes, so it costs one small upload per switch.
 */
export function glassTone(part: Part, dark: number, mats: MatRef[] = ["lampGlass", "paperLamp"]): void {
  if (part.tag["glassTone"] === dark) return;
  part.tag["glassTone"] = dark;
  const g = part.grid, o = g.orig;
  if (!o) return;
  const ids = mats.map(matId);
  for (let i = 0; i < g.mat.length; i++) {
    if (!g.mat[i] || !ids.includes(g.mat[i]!) || o.mat[i] !== g.mat[i]) continue;
    const t = Math.max(-3, o.tone[i]! - dark);
    if (g.tone[i] !== t) {
      g.tone[i] = t;
      g.markRaw(i);
    }
  }
}

/** A material reference's id (for per-cell writes in dynamic parts). */
export function matId(m: MatRef): number {
  return resolveMat(m).id;
}

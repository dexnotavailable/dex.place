// Procedural pixel VFX. Presets live in src/lab/data/vfx.json; clip events
// spawn them by id with offset/rotation/scale/colour overrides. Every shape is
// evaluated per low-res pixel (see shaders.ts), particles are whole-pixel
// rects, afterimages are sprite silhouettes faded by ordered dither, and any
// effect can carry a point light that feeds the normal-map / rim lighting.

import { parseColour, type LightEmission } from "../contracts.ts";
import { VFX_TYPE, type PointLight, type Renderer, type RGB, type SpriteDraw } from "./renderer.ts";

export type Layer = "back" | "front";

export interface PresetBase {
  kind: string;
  duration?: number;
  layer?: Layer;
  core?: string;
  colour?: string;
  edge?: string;
  /** 1 paints over what is behind, 0 adds light. */
  over?: number;
  light?: LightEmission;
  [key: string]: unknown;
}

export interface GroupPart {
  id: string;
  offset?: [number, number];
  rotation?: number;
  scale?: number | [number, number];
  delay?: number;
  params?: Record<string, number>;
  colour?: string;
  core?: string;
  edge?: string;
}

export interface VfxLibrary {
  presets: Record<string, PresetBase>;
}

export interface Placement {
  x: number;
  y: number;
  /** +1 facing right, -1 facing left. */
  facing: number;
}

export interface SpawnOptions extends Placement {
  rotation?: number;
  scale?: number | [number, number];
  colour?: string;
  core?: string;
  edge?: string;
  layer?: Layer;
  params?: Record<string, number>;
  light?: LightEmission;
  /** Follow a moving owner; offset is re-applied each tick. */
  follow?: () => Placement;
  offset?: [number, number];
  /** Sprite snapshot for afterimages. */
  sprite?: SpriteDraw;
  /** Live sprite of the owner, for trails that snapshot it every few ticks. */
  spriteFn?: () => SpriteDraw | undefined;
}

interface Effect {
  preset: PresetBase;
  kind: string;
  age: number;
  duration: number;
  x: number;
  y: number;
  facing: number;
  rot: number;
  sx: number;
  sy: number;
  core: RGB;
  main: RGB;
  edge: RGB;
  layer: Layer;
  over: number;
  seed: number;
  p: Record<string, number>;
  follow?: () => Placement;
  offset: [number, number];
  sprite?: SpriteDraw;
  segments?: number[];
  /** trail: live sprite source and the preset it stamps every `every` ticks */
  spriteFn?: () => SpriteDraw | undefined;
  of?: string;
  /** Ages in real ticks: slow motion and hitstop don't stretch it (flashes). */
  realtime: boolean;
}

interface Particle {
  kind: "spark" | "ember" | "shard" | "feather" | "debris" | "dust" | "mote";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  gravity: number;
  drag: number;
  colours: RGB[];
  over: number;
  rot: number;
  vr: number;
  seed: number;
  layer: Layer;
  bounce: number;
}

interface Light extends PointLight {
  age: number;
  duration: number;
  base: number;
  flicker: number;
  follow?: () => Placement;
  offset: [number, number];
  realtime: boolean;
}

interface Delayed {
  at: number;
  id: string;
  opts: SpawnOptions;
}

const hex = (h: string | undefined, fallback: RGB): RGB => (h ? parseColour(h) : fallback);

/**
 * Hard pool limits. Package params are range-checked at load (contracts.ts
 * VFX_PARAMS); these are the backstop so no data can take the page down.
 * When a pool is full the oldest entries go first.
 */
export const VFX_LIMITS = { effects: 256, particles: 2048, lights: 64, delayed: 256, emit: 256, duration: 600, life: 600 } as const;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const DEG = Math.PI / 180;

export class Vfx {
  readonly lib: VfxLibrary;
  private effects: Effect[] = [];
  private particles: Particle[] = [];
  private lights: Light[] = [];
  private delayed: Delayed[] = [];
  private tick = 0;
  /** Ground height lookup for debris bounce and crack placement. */
  groundAt: (x: number, y: number) => number = () => 0;
  warnings: string[] = [];

  constructor(lib: VfxLibrary) {
    this.lib = lib;
  }

  has(id: string): boolean {
    return id in this.lib.presets;
  }

  get counts(): { effects: number; particles: number; lights: number } {
    return { effects: this.effects.length, particles: this.particles.length, lights: this.lights.length };
  }

  clear(): void {
    this.effects.length = 0;
    this.particles.length = 0;
    this.lights.length = 0;
    this.delayed.length = 0;
  }

  spawn(id: string, o: SpawnOptions): void {
    const preset = this.lib.presets[id];
    if (!preset) {
      if (!this.warnings.includes(id)) {
        this.warnings.push(id);
        console.warn(`vfx preset "${id}" is not in vfx.json`);
      }
      return;
    }
    const scale = o.scale ?? 1;
    const sx = typeof scale === "number" ? scale : scale[0];
    const sy = typeof scale === "number" ? scale : scale[1];
    const rotDeg = (o.rotation ?? 0) + num(preset.rotation, 0);
    const p: Record<string, number> = {};
    for (const [k, v] of Object.entries(preset)) if (typeof v === "number") p[k] = v;
    if (o.params) Object.assign(p, o.params);
    const light = o.light ?? preset.light;
    const facing = o.facing < 0 ? -1 : 1;
    const realtime = (p.realtime ?? 0) > 0;

    if (preset.kind === "group") {
      const parts = (preset.parts as GroupPart[] | undefined) ?? [];
      for (const part of parts) {
        const off = part.offset ?? [0, 0];
        const ps = part.scale ?? 1;
        const psx = (typeof ps === "number" ? ps : ps[0]) * sx;
        const psy = (typeof ps === "number" ? ps : ps[1]) * sy;
        const r = rotDeg * DEG;
        const lx = off[0] * sx, ly = off[1] * sy;
        const ox = (lx * Math.cos(r) - ly * Math.sin(r)) * facing;
        const oy = lx * Math.sin(r) + ly * Math.cos(r);
        const child: SpawnOptions = {
          ...o,
          x: o.x + ox,
          y: o.y + oy,
          rotation: rotDeg + (part.rotation ?? 0),
          scale: [psx, psy],
          params: { ...(part.params ?? {}), ...(o.params ?? {}) },
          colour: o.colour ?? part.colour,
          core: o.core ?? part.core,
          edge: o.edge ?? part.edge,
          light: undefined,
          offset: o.follow ? [(o.offset?.[0] ?? 0) + off[0] * sx, (o.offset?.[1] ?? 0) + off[1] * sy] : undefined,
        };
        if (part.delay && part.delay > 0) {
          this.delayed.push({ at: this.tick + part.delay, id: part.id, opts: child });
          trimOldest(this.delayed, VFX_LIMITS.delayed);
        } else this.spawn(part.id, child);
      }
      if (light) this.light(light, o);
      return;
    }

    const core = hex(o.core ?? preset.core, [1, 1, 1]);
    const main = hex(o.colour ?? preset.colour, [1, 0.9, 0.6]);
    const edge = hex(o.edge ?? preset.edge, main);
    const layer: Layer = o.layer ?? preset.layer ?? "front";
    const duration = clamp(Math.round(p.duration ?? preset.duration ?? 12), 1, VFX_LIMITS.duration);

    if (preset.kind === "particles") {
      this.emit(preset, p, o, [core, main, edge], layer, facing, rotDeg);
      if (light) this.light(light, o);
      return;
    }

    const e: Effect = {
      preset, kind: preset.kind, age: 0, duration,
      x: o.x, y: o.y, facing,
      rot: facing * rotDeg * DEG,
      sx: sx * facing, sy,
      core, main, edge, layer,
      over: num(p.over, preset.kind === "afterimage" ? 1 : 1),
      seed: Math.random() * 100,
      p, follow: o.follow, offset: o.offset ?? [0, 0], sprite: o.sprite, realtime,
      spriteFn: o.spriteFn, of: typeof preset.of === "string" ? preset.of : undefined,
    };
    if (preset.kind === "cracks") e.segments = this.crackSegments(e);
    this.effects.push(e);
    trimOldest(this.effects, VFX_LIMITS.effects);
    if (light) this.light(light, o, realtime);
  }

  light(l: LightEmission, o: Placement & { follow?: () => Placement; offset?: [number, number] }, realtime = false): void {
    this.lights.push({
      x: o.x, y: o.y, height: l.height ?? 24, radius: l.radius, colour: parseColour(l.colour),
      intensity: l.intensity, base: l.intensity, age: 0, duration: Math.max(1, l.duration), flicker: l.flicker ?? 0,
      follow: o.follow, offset: o.offset ?? [0, 0], realtime,
    });
    trimOldest(this.lights, VFX_LIMITS.lights);
  }

  /** Lights for this frame, in world space. */
  pointLights(): PointLight[] {
    return this.lights;
  }

  private emit(preset: PresetBase, p: Record<string, number>, o: SpawnOptions, ramp: RGB[], layer: Layer, facing: number, rotDeg: number): void {
    const count = clamp(Math.round(p.count ?? 8), 0, VFX_LIMITS.emit);
    const kind = (preset.particle as Particle["kind"]) ?? "spark";
    const colours = Array.isArray(preset.colours) ? (preset.colours as string[]).map((c) => parseColour(c)) : ramp;
    const s0 = p.speedMin ?? 1, s1 = p.speedMax ?? 3;
    const spread = (p.spread ?? 60) * DEG;
    const base = ((p.angle ?? 0) + rotDeg) * DEG;
    const l0 = clamp(p.lifeMin ?? 12, 1, VFX_LIMITS.life), l1 = clamp(p.lifeMax ?? 24, 1, VFX_LIMITS.life);
    const w = p.areaW ?? 0, h = p.areaH ?? 0;
    const inward = p.inward ?? 0;
    for (let i = 0; i < count; i++) {
      const a = base + rand(-spread / 2, spread / 2);
      const s = rand(s0, s1);
      let vx = Math.cos(a) * s * facing;
      let vy = Math.sin(a) * s;
      let sx = o.x + rand(-w / 2, w / 2) * facing;
      let sy = o.y + rand(-h / 2, h / 2);
      const life = Math.round(rand(l0, l1));
      if (inward > 0) {
        // converge: start on a circle, travel to the centre over the particle's life
        const ca = rand(0, Math.PI * 2);
        sx = o.x + Math.cos(ca) * inward;
        sy = o.y + Math.sin(ca) * inward;
        vx = -Math.cos(ca) * (inward / life);
        vy = -Math.sin(ca) * (inward / life);
      }
      this.particles.push({
        kind,
        x: sx, y: sy,
        vx, vy, age: 0, life,
        size: Math.round(rand(p.sizeMin ?? 1, (p.sizeMax ?? 1) + 0.99)),
        gravity: p.gravity ?? 0.1, drag: p.drag ?? 0.92, colours,
        over: num(p.over, 1), rot: rand(0, Math.PI), vr: rand(-0.3, 0.3), seed: Math.random() * 100,
        layer, bounce: p.bounce ?? 0,
      });
    }
    trimOldest(this.particles, VFX_LIMITS.particles);
  }

  private crackSegments(e: Effect): number[] {
    const segs: number[] = [];
    const len = e.p.length ?? 80;
    const branches = Math.max(1, Math.round(e.p.branches ?? 4));
    const gy = this.groundAt(e.x, e.y - 2);
    for (let b = 0; b < branches; b++) {
      const dir = b % 2 === 0 ? 1 : -1;
      let x = e.x + rand(-3, 3);
      let y = gy;
      const L = len * rand(0.5, 1);
      let travelled = 0;
      while (travelled < L) {
        const step = rand(5, 11);
        const nx = x + dir * step;
        const ny = gy + Math.round(rand(-1.4, 1.4)) + (b >= 2 ? Math.round(rand(0, 3)) : 0);
        segs.push(x, y, nx, ny);
        if (Math.random() < 0.25) segs.push(nx, ny, nx + dir * rand(3, 6), ny + rand(1, 4));
        x = nx;
        y = ny;
        travelled += step;
      }
    }
    return segs;
  }

  update(): void {
    this.tick++;
    // spawning can trim the pools, so never spawn while walking one by index
    const due = this.delayed.filter((d) => d.at <= this.tick);
    if (due.length) {
      this.delayed = this.delayed.filter((d) => d.at > this.tick);
      for (const d of due) this.spawn(d.id, d.opts);
    }
    const stamps: Effect[] = [];
    this.effects = this.effects.filter((e) => {
      this.place(e);
      if (e.kind === "trail" && this.trailDue(e)) stamps.push(e);
      return e.realtime || ++e.age < e.duration;
    });
    for (const e of stamps) this.stampTrail(e);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i]!;
      q.age++;
      if (q.age >= q.life) {
        this.particles.splice(i, 1);
        continue;
      }
      q.vx *= q.drag;
      q.vy = q.vy * q.drag + q.gravity;
      if (q.kind === "feather") q.vx += Math.sin((q.age + q.seed) * 0.18) * 0.06;
      if (q.kind === "ember") q.vx += Math.sin((q.age + q.seed) * 0.3) * 0.03;
      q.x += q.vx;
      q.y += q.vy;
      q.rot += q.vr;
      if (q.bounce > 0 && q.vy > 0) {
        const g = this.groundAt(q.x, q.y - 4);
        if (q.y >= g) {
          q.y = g - 0.01;
          q.vy = -q.vy * q.bounce;
          q.vx *= 0.6;
          if (Math.abs(q.vy) < 0.4) q.vy = 0;
        }
      }
    }
    this.ageLights(false);
  }

  /**
   * One real-time tick: ages effects and lights flagged `realtime` (flashes),
   * so slow motion and hitstop never hold a flash on screen.
   */
  realTick(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]!;
      if (!e.realtime) continue;
      this.place(e);
      if (++e.age >= e.duration) this.effects.splice(i, 1);
    }
    this.ageLights(true);
  }

  /** Afterimage trail: stamps the owner's current frame every `every` ticks. */
  private trailDue(e: Effect): boolean {
    const every = Math.max(1, Math.round(e.p.every ?? 2));
    return !!e.of && !!e.spriteFn && e.age % every === 0;
  }

  private stampTrail(e: Effect): void {
    const sprite = e.spriteFn?.();
    if (sprite && e.of) this.spawn(e.of, { x: e.x, y: e.y, facing: e.facing, sprite });
  }

  private place(e: { follow?: () => Placement; offset: [number, number]; x: number; y: number }): void {
    if (!e.follow) return;
    const f = e.follow();
    e.x = f.x + e.offset[0] * f.facing;
    e.y = f.y + e.offset[1];
  }

  private ageLights(realtime: boolean): void {
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i]!;
      if (l.realtime !== realtime) continue;
      this.place(l);
      l.age++;
      const k = 1 - l.age / l.duration;
      l.intensity = l.base * Math.max(0, k) * (1 - l.flicker * Math.random());
      if (l.age >= l.duration) this.lights.splice(i, 1);
    }
  }

  draw(r: Renderer, layer: Layer): void {
    for (const e of this.effects) if (e.layer === layer) this.drawEffect(r, e);
    for (const q of this.particles) if (q.layer === layer) this.drawParticle(r, q);
  }

  /** Afterimages sit behind the character, drawn in the sprite pass. */
  drawAfterimages(r: Renderer): void {
    for (const e of this.effects) {
      if (e.kind !== "afterimage" || !e.sprite) continue;
      const t = e.age / e.duration;
      const step = t < 0.34 ? 0 : t < 0.67 ? 1 : 2;
      const col = step === 0 ? e.core : step === 1 ? e.main : e.edge;
      r.sprite({ ...e.sprite, tint: [col[0], col[1], col[2], 1], lit: 0, opacity: (e.p.opacity ?? 0.7) * (1 - t * 0.85) });
    }
  }

  private drawEffect(r: Renderer, e: Effect): void {
    const t = Math.min(0.999, e.age / e.duration);
    const P = e.p;
    const base = { t, seed: e.seed, over: e.over, core: e.core, main: e.main, edge: e.edge, x: e.x, y: e.y, rot: e.rot, sx: e.sx, sy: e.sy };
    switch (e.kind) {
      case "arc": {
        const R = P.radius ?? 40;
        const g = P.glow ?? 2;
        const flat = P.flat ?? 1;
        const ext = R + g + 1;
        r.vfx({ ...base, type: VFX_TYPE.arc, p0: [R, P.thickness ?? 10, (P.from ?? -60) * DEG, (P.to ?? 60) * DEG], p1: [P.slivers ?? 3, g, flat, 0], ext: [-ext, -ext * flat, ext, ext * flat] });
        break;
      }
      case "ring": {
        const R1 = Math.max(P.r1 ?? 120, P.r0 ?? 6);
        const g = P.glow ?? 3;
        const flat = P.flat ?? 0.25;
        const ext = R1 + g + 2;
        r.vfx({ ...base, type: VFX_TYPE.ring, p0: [P.r0 ?? 6, P.r1 ?? 120, P.thickness ?? 6, flat], p1: [0, g, 0, 0], ext: [-ext, -ext * flat - 2, ext, ext * flat + 2] });
        break;
      }
      case "pillar": {
        const W = P.width ?? 8;
        const H = P.height ?? 120;
        const g = P.glow ?? 3;
        r.vfx({ ...base, type: VFX_TYPE.pillar, p0: [W, H, 0, 0], p1: [0, g, 0, 0], ext: [-W - g - 1, -H - 1, W + g + 1, 3] });
        break;
      }
      case "burst": {
        const R1 = P.r1 ?? 60;
        r.vfx({ ...base, type: VFX_TYPE.burst, p0: [P.r0 ?? 4, R1, P.count ?? 12, P.thickness ?? 4], p1: [0, 0, 0, 0], ext: [-R1 - 1, -R1 - 1, R1 + 1, R1 + 1] });
        break;
      }
      case "streak": {
        const L = P.length ?? 100;
        const T = P.thickness ?? 6;
        const lines = P.lines ?? 2;
        const h = T / 2 + 3 + lines * 3 + 1;
        r.vfx({ ...base, type: VFX_TYPE.streak, p0: [L, T, lines, 0], p1: [0, 0, 0, 0], ext: [-1, -h, L + 1, h] });
        break;
      }
      case "disc": {
        const R1 = Math.max(P.r1 ?? 14, P.r0 ?? 2);
        const g = P.glow ?? 2;
        const flat = P.flat ?? 1;
        const ext = R1 + g + 1;
        r.vfx({ ...base, type: VFX_TYPE.disc, p0: [P.r0 ?? 2, P.r1 ?? 14, flat, 0], p1: [0, g, 0, 0], ext: [-ext, -ext * flat, ext, ext * flat] });
        break;
      }
      case "cracks": {
        const segs = e.segments ?? [];
        const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        const hot = t < 0.35;
        for (let i = 0; i < segs.length; i += 4) {
          this.segment(r, segs[i]!, segs[i + 1]!, segs[i + 2]!, segs[i + 3]!, hot ? e.main : e.edge, fade, 1);
          if (t < 0.18) this.segment(r, segs[i]!, segs[i + 1]! - 1, segs[i + 2]!, segs[i + 3]! - 1, e.core, 1, 0);
        }
        break;
      }
      case "afterimage":
        break;
      default:
        break;
    }
  }

  private segment(r: Renderer, x0: number, y0: number, x1: number, y1: number, c: RGB, opacity: number, over: number): void {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const a = Math.atan2(dy, dx);
    const th = Math.max(1, Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)));
    r.vfx({
      type: VFX_TYPE.rect, t: 0, seed: 0, over, p0: [opacity, 0, 0, 0], p1: [0, 0, 0, 0],
      core: c, main: c, edge: c, x: x0, y: y0, rot: a, sx: 1, sy: 1, ext: [0, -th / 2, len + 0.5, th / 2],
    });
  }

  private drawParticle(r: Renderer, q: Particle): void {
    const t = q.age / q.life;
    const idx = Math.min(q.colours.length - 1, Math.floor(t * q.colours.length));
    const c = q.colours[idx]!;
    switch (q.kind) {
      case "spark": {
        const sp = Math.hypot(q.vx, q.vy);
        const len = Math.min(8, 1 + sp * 1.4);
        if (sp < 0.2) {
          r.rect(q.x, q.y, 1, 1, c, q.over);
        } else {
          this.segment(r, q.x, q.y, q.x - (q.vx / sp) * len, q.y - (q.vy / sp) * len, c, 1, q.over);
        }
        break;
      }
      case "ember":
      case "mote": {
        if (q.kind === "ember" && (q.age + Math.floor(q.seed)) % 7 === 0) break;
        r.rect(q.x, q.y, q.size, q.size, c, q.over);
        break;
      }
      case "dust": {
        const s = q.size + Math.floor(t * 2);
        r.rect(q.x - s / 2, q.y - s / 2, s, s, c, q.over, 1 - t * 0.8);
        break;
      }
      case "debris":
        r.rect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size, c, 1);
        break;
      case "shard":
      case "feather": {
        const w = q.kind === "feather" ? q.size + 1 : q.size;
        const h = q.kind === "feather" ? Math.max(1, q.size - 1) : q.size + 1;
        r.vfx({
          type: VFX_TYPE.diamond, t, seed: q.seed, over: q.over, p0: [w, h, 0, 0], p1: [1 - Math.max(0, t - 0.6) * 2, 0, 0, 0],
          core: c, main: c, edge: c, x: q.x, y: q.y, rot: q.rot, sx: 1, sy: 1, ext: [-w - 1, -h - 1, w + 1, h + 1],
        });
        break;
      }
    }
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}

/** Drop the oldest entries (front of the array) past `max`. */
function trimOldest<T>(a: T[], max: number): void {
  if (a.length > max) a.splice(0, a.length - max);
}

/** Light validation of vfx.json so a typo fails loudly at load. */
export function validateVfxLibrary(json: unknown): VfxLibrary {
  const kinds = ["arc", "ring", "pillar", "burst", "streak", "disc", "particles", "cracks", "afterimage", "trail", "group"];
  const lib = json as VfxLibrary;
  const issues: string[] = [];
  if (!lib || typeof lib !== "object" || typeof lib.presets !== "object") throw new Error("vfx.json: expected { presets: {...} }");
  for (const [id, p] of Object.entries(lib.presets)) {
    if (!kinds.includes(p.kind)) issues.push(`${id}: unknown kind "${p.kind}"`);
    for (const k of ["core", "colour", "edge"] as const) {
      const v = p[k];
      if (v !== undefined && !/^#[0-9a-fA-F]{6}$/.test(v)) issues.push(`${id}.${k}: bad colour`);
    }
    if (p.kind === "group") {
      for (const part of (p.parts as GroupPart[] | undefined) ?? []) {
        if (!(part.id in lib.presets)) issues.push(`${id}: part "${part.id}" is not a preset`);
      }
    }
    if (p.kind === "trail" && (typeof p.of !== "string" || lib.presets[p.of]?.kind !== "afterimage")) {
      issues.push(`${id}: "of" must name an afterimage preset`);
    }
  }
  if (issues.length) throw new Error(`vfx.json:\n  ${issues.join("\n  ")}`);
  return lib;
}

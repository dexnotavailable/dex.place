// Props: recipe -> parts + state machine + motion + game hooks.
//
// A recipe is data plus a little code: `build` draws the parts with the DSL
// and returns refs (parts, ropes, springs) the states use; `states` is the
// state machine. States change cells; nothing swaps an image.

import { PartBuilder } from "./builder.ts";
import { CellGrid } from "./cells.ts";
import { damage, overlap, cutAlong, type PartReport } from "./break.ts";
import type { Hit } from "./hits.ts";
import { Cloth, Rope, type ClothSpec, type RopeSpec } from "./motion.ts";
import { resolveMat } from "./materials.ts";
import { Part, type PartOptions } from "./part.ts";
import { rng, type Rng } from "./util.ts";
import type { PixelWorld } from "./world.ts";

export interface BaseParams {
  /** Player height in px: everything is sized from it. */
  H: number;
  seed: number;
  /** 0 pristine .. 1 worn. */
  wear: number;
  variant: number;
}

export interface HitContext {
  hit: Hit;
  /** Per-part overlap (before damage). */
  parts: { part: Part; covered: number; contact: [number, number] | null }[];
  contact: [number, number] | null;
}

export interface StateDef<R> {
  label?: string;
  enter?(c: Prop<R>, from: string): void;
  update?(c: Prop<R>, dt: number): void;
  exit?(c: Prop<R>, to: string): void;
  /** React to a hit. Call c.damage(hit) for the default material response. Return a state to go to. */
  hit?(c: Prop<R>, h: HitContext): string | void;
  /** E / use. Return a state to go to. */
  use?(c: Prop<R>): string | void;
  /** Automatic transition after this many seconds in the state. */
  after?: [number, string];
  /** Sound cue on entering. */
  sound?: string;
}

export interface Recipe<P extends object = Record<string, unknown>, R = unknown> {
  id: string;
  /** Why this prop is here (CANON: every prop has a reason). Required. */
  reason: string;
  defaults: P;
  build(b: PropBuilder, p: P & BaseParams): R;
  states: Record<string, StateDef<R>>;
  initial: string | ((c: Prop<R>) => string);
  /**
   * E / use: `reach` in H measured from the prop's bounds (the edge of its
   * drawn parts, not its origin), and a short prompt verb. `zone` replaces
   * the bounds with a prop-local rect in H ([x0, y0, x1, y1], y down like
   * the screen, mirrored with the prop): a lantern whose origin is its
   * ceiling hook 2.6 H above the floor is usable from the floor with
   * zone [-0.4, 0, 0.4, 2.6].
   */
  use?: { reach: number; prompt?: string; zone?: [number, number, number, number] };
  /** Keys saved per visit (the cut stays cut). */
  persist?: string[];
}

export function defineRecipe<P extends object, R>(r: Recipe<P, R>): Recipe<P, R> {
  if (!r.reason || r.reason.trim().length < 8) throw new Error(`recipe ${r.id}: a reason is required`);
  if (!r.states[typeof r.initial === "string" ? r.initial : Object.keys(r.states)[0]!]) throw new Error(`recipe ${r.id}: unknown initial state`);
  return r;
}

export interface PropLight {
  part: Part | null;
  /** Local position on the part (or prop-local if no part). */
  lx: number;
  ly: number;
  colour: [number, number, number];
  radius: number;
  intensity: number;
  height: number;
  on: boolean;
  /** 0..1: how much the flicker value modulates it. */
  flicker: number;
  seed: number;
  /** Current output multiplier (states animate it). */
  level: number;
}

export type GlowKind = "disc" | "beam" | "ring";

export interface PropGlow {
  kind: GlowKind;
  part: Part | null;
  lx: number;
  ly: number;
  colour: [number, number, number];
  /** disc/ring radius; beam width at the start. */
  radius: number;
  intensity: number;
  /** Vertical squash for disc/ring. */
  flat: number;
  /** Beam: end offset (world px, relative to the start) and end width. */
  to: [number, number];
  width1: number;
  on: boolean;
  flicker: number;
  seed: number;
  level: number;
  /** Ring thickness (px). */
  thick: number;
}

export interface PartSpec extends PartOptions {
  w: number;
  h: number;
  /** Pivot inside the part (local px). Default: bottom centre. */
  pivot?: [number, number];
  /** Where the pivot sits: prop-local px (or parent-local if `parent`). */
  at?: [number, number];
  parent?: string;
}

/** The `b` a recipe's build() receives. */
export class PropBuilder {
  readonly H: number;
  readonly rand: Rng;
  /** World position of the prop origin (for ropes and cloth). */
  readonly ox: number;
  readonly oy: number;
  readonly flip: 1 | -1;
  parts: { spec: PartSpec; b: PartBuilder; part: Part }[] = [];
  lights: PropLight[] = [];
  glows: PropGlow[] = [];
  ropes: Rope[] = [];
  cloths: Cloth[] = [];
  hangs: Hang[] = [];
  private seed: number;

  constructor(H: number, seed: number, ox: number, oy: number, flip: 1 | -1) {
    this.H = H;
    this.seed = seed;
    this.rand = rng(seed * 7919 + 13);
    this.ox = ox;
    this.oy = oy;
    this.flip = flip;
  }

  /** Whole pixels for a length in H. */
  u(f: number): number {
    return Math.round(f * this.H);
  }

  part(name: string, spec: PartSpec): PartBuilder {
    const b = new PartBuilder(spec.w, spec.h, this.seed * 31 + this.parts.length);
    const pv = spec.pivot ?? [Math.floor(spec.w / 2), spec.h];
    const part = new Part(name, b.grid, pv[0], pv[1], { layer: "mid", ...spec });
    part.x = spec.at?.[0] ?? 0;
    part.y = spec.at?.[1] ?? 0;
    this.parts.push({ spec, b, part });
    return b;
  }

  /** The Part object behind a builder name (for options set after drawing). */
  get(name: string): Part {
    const p = this.parts.find((q) => q.part.name === name);
    if (!p) throw new Error(`part ${name} not found`);
    return p.part;
  }

  /** A free-standing cell grid (cloth designs, swap-in states). */
  canvas(w: number, h: number): PartBuilder {
    return new PartBuilder(w, h, this.seed * 17 + this.parts.length);
  }

  light(o: { part?: string; at: [number, number]; colour: [number, number, number]; radius: number; intensity?: number; height?: number; flicker?: number; on?: boolean }): PropLight {
    const L: PropLight = {
      part: o.part ? this.get(o.part) : null, lx: o.at[0], ly: o.at[1], colour: o.colour, radius: o.radius, intensity: o.intensity ?? 1,
      height: o.height ?? this.H * 0.6, on: o.on ?? true, flicker: o.flicker ?? 0, seed: this.lights.length * 3.7 + this.seed, level: 1,
    };
    this.lights.push(L);
    return L;
  }

  glow(o: { kind?: GlowKind; part?: string; at: [number, number]; colour: [number, number, number]; radius: number; intensity?: number; flat?: number; to?: [number, number]; width1?: number; flicker?: number; on?: boolean; thick?: number }): PropGlow {
    const G: PropGlow = {
      kind: o.kind ?? "disc", part: o.part ? this.get(o.part) : null, lx: o.at[0], ly: o.at[1], colour: o.colour, radius: o.radius,
      intensity: o.intensity ?? 1, flat: o.flat ?? 1, to: o.to ?? [0, 0], width1: o.width1 ?? o.radius, on: o.on ?? true,
      flicker: o.flicker ?? 0, seed: this.glows.length * 5.3 + this.seed, level: 1, thick: o.thick ?? 3,
    };
    this.glows.push(G);
    return G;
  }

  /** Verlet rope; points in prop-local px. Rendered as its own part. */
  rope(name: string, s: Omit<RopeSpec, "from" | "to"> & { from: [number, number]; to: [number, number]; layer?: PartOptions["layer"]; reach?: number }): { rope: Rope; part: Part } {
    const f = this.flip;
    const from: [number, number] = [this.ox + s.from[0] * f, this.oy + s.from[1]];
    const to: [number, number] = [this.ox + s.to[0] * f, this.oy + s.to[1]];
    const rope = new Rope({ ...s, from, to });
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) * (s.slack ?? 1.04);
    const reach = s.reach ?? len + 6;
    const x0 = Math.floor(Math.min(from[0], to[0]) - reach), y0 = Math.floor(Math.min(from[1], to[1]) - 6);
    const w = Math.ceil(Math.abs(to[0] - from[0]) + reach * 2), h = Math.ceil(Math.abs(to[1] - from[1]) + Math.max(reach, len) + 12);
    const grid = new CellGrid(w, h);
    const part = new Part(name, grid, 0, 0, { layer: s.layer ?? "mid", outline: 1 });
    part.worldSpace = true;
    part.x = x0;
    part.y = y0;
    part.hittable = false;
    part.rim = 0;
    part.dynamic = (p) => {
      if (rope.sleeping && p.tag["drawn"]) return;
      p.grid.clearAll();
      rope.rasterize(p.grid, p.x, p.y);
      p.grid.computeNormals({ x0: 0, y0: 0, x1: p.grid.W - 1, y1: p.grid.Hh - 1 });
      p.tag["drawn"] = true;
    };
    this.ropes.push(rope);
    this.parts.push({ spec: { w, h }, b: new PartBuilder(1, 1), part });
    return { rope, part };
  }

  /**
   * Hang a part from the free end of a rope (a lantern on its chain, a bell
   * on a cord). The part's pivot is its hook: set `pivot` on the part spec to
   * the point that should sit on the rope end. Each step the part follows the
   * rope's last point and, with `align` (default), turns with the last
   * segment. Give the rope an `endMass` so the swing feels weighted. Cut the
   * rope above and the part falls with the loose end.
   */
  hang(partName: string, rope: Rope, o: { align?: boolean } = {}): Hang {
    const part = this.get(partName);
    part.worldSpace = true;
    part.smoothRotate = true;
    const h: Hang = { part, rope, align: o.align ?? true };
    follow(h);
    this.hangs.push(h);
    return h;
  }

  /**
   * Verlet cloth from a design drawn on `src` (see canvas()); top-left at
   * prop-local (x, y). `room` is how far the cloth may move (px) around its rest rect.
   */
  cloth(name: string, s: Omit<ClothSpec, "x" | "y"> & { x: number; y: number; layer?: PartOptions["layer"]; room?: [number, number, number, number] }): { cloth: Cloth; part: Part } {
    const X = this.ox + s.x * this.flip - (this.flip < 0 ? s.src.w : 0), Y = this.oy + s.y;
    const cloth = new Cloth({ ...s, x: X, y: Y });
    const [l, t, r, bt] = s.room ?? [s.src.w * 0.6, 8, s.src.w * 0.6, s.src.h * 0.4];
    const w = Math.ceil(s.src.w + l + r), h = Math.ceil(s.src.h + t + bt);
    const grid = new CellGrid(w, h);
    const part = new Part(name, grid, 0, 0, { layer: s.layer ?? "mid", outline: 1 });
    part.worldSpace = true;
    part.x = Math.floor(X - l);
    part.y = Math.floor(Y - t);
    part.dynamic = (p) => {
      if (cloth.sleeping && p.tag["drawn"]) return;
      p.grid.clearAll();
      cloth.rasterize(p.grid, p.x, p.y);
      p.grid.computeNormals({ x0: 0, y0: 0, x1: p.grid.W - 1, y1: p.grid.Hh - 1 });
      p.tag["drawn"] = true;
    };
    this.cloths.push(cloth);
    this.parts.push({ spec: { w, h }, b: new PartBuilder(1, 1), part });
    return { cloth, part };
  }
}

/** A part riding the free end of a rope (see PropBuilder.hang). */
export interface Hang {
  part: Part;
  rope: Rope;
  align: boolean;
  /** Cut loose and lying on the ground: it settles flat instead of following the rope's angle. */
  landed?: boolean;
}

/** Put a hung part on its rope end (called by the world after ropes step). */
export function follow(h: Hang): void {
  const r = h.rope, k = r.n - 1;
  h.part.x = r.x[k]!;
  h.part.y = r.y[k]!;
  if (h.landed) {
    const snap = Math.round(h.part.rot / (Math.PI / 2)) * (Math.PI / 2);
    h.part.rot += (snap - h.part.rot) * 0.2;
    if (Math.abs(snap - h.part.rot) < 0.01) h.part.rot = snap;
  } else if (h.align && k > 0) h.part.rot = Math.atan2(r.y[k]! - r.y[k - 1]!, r.x[k]! - r.x[k - 1]!) - Math.PI / 2;
}

let propCounter = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Prop<R = any> {
  readonly id: string;
  readonly recipe: Recipe<object, R>;
  readonly params: BaseParams & Record<string, unknown>;
  world!: PixelWorld;
  x: number;
  y: number;
  flip: 1 | -1;
  parts: Part[] = [];
  refs!: R;
  lights: PropLight[] = [];
  glows: PropGlow[] = [];
  ropes: Rope[] = [];
  cloths: Cloth[] = [];
  hangs: Hang[] = [];
  state = "";
  /** Seconds in the current state. */
  t = 0;
  /** Seconds since placed. */
  age = 0;
  /** Persistent per-visit data (keys listed in recipe.persist are saved). */
  data: Record<string, unknown> = {};
  /** Last state transition log (sandbox / debugging). */
  log: string[] = [];
  readonly rand: Rng;

  constructor(recipe: Recipe<object, R>, params: BaseParams & Record<string, unknown>, x: number, y: number, flip: 1 | -1 = 1, id?: string) {
    this.recipe = recipe;
    this.params = params;
    this.x = x;
    this.y = y;
    this.flip = flip;
    this.id = id ?? `${recipe.id}-${++propCounter}`;
    this.rand = rng(params.seed * 1013 + 7);
  }

  /** Build parts from the recipe (called by the world). */
  build(): void {
    const b = new PropBuilder(this.params.H, this.params.seed, this.x, this.y, this.flip);
    this.refs = this.recipe.build(b, this.params as never);
    for (const { spec, part } of b.parts) {
      part.prop = this;
      if (spec.parent) {
        const par = b.parts.find((q) => q.part.name === spec.parent);
        if (!par) throw new Error(`${this.recipe.id}: parent ${spec.parent} not found`);
        part.parent = par.part;
      }
      part.grid.computeNormals({ x0: 0, y0: 0, x1: part.grid.W - 1, y1: part.grid.Hh - 1 });
      part.grid.snapshot();
      part.grid.markAll();
      this.parts.push(part);
    }
    this.lights = b.lights;
    this.glows = b.glows;
    this.ropes = b.ropes;
    this.cloths = b.cloths;
    this.hangs = b.hangs;
  }

  part(name: string): Part {
    const p = this.parts.find((q) => q.name === name);
    if (!p) throw new Error(`${this.recipe.id}: no part ${name}`);
    return p;
  }

  get stateDef(): StateDef<R> {
    return this.recipe.states[this.state]!;
  }

  /** Go to a state (runs exit/enter, plays its cue). */
  go(next: string): void {
    const def = this.recipe.states[next];
    if (!def) throw new Error(`${this.recipe.id}: unknown state ${next}`);
    const prev = this.state;
    if (prev) this.recipe.states[prev]?.exit?.(this, next);
    this.state = next;
    this.t = 0;
    this.log.push(`${prev || "-"} -> ${next}`);
    if (this.log.length > 12) this.log.shift();
    this.world.event({ type: "state", prop: this, from: prev, to: next });
    if (def.sound) this.sound(def.sound);
    def.enter?.(this, prev);
  }

  update(dt: number): void {
    this.t += dt;
    this.age += dt;
    const def = this.stateDef;
    const before = this.state;
    def.update?.(this, dt);
    if (this.state === before && def.after && this.t >= def.after[0]) this.go(def.after[1]);
  }

  sound(id: string, volume = 1): void {
    const [x, y] = this.centre();
    this.world.soundAt(id, x, y, volume);
  }

  emit(e: Record<string, unknown> & { type: string }): void {
    this.world.event({ ...e, prop: this });
  }

  /** World centre of the prop's parts. */
  centre(): [number, number] {
    const b = this.bounds();
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  }

  bounds(): { x0: number; y0: number; x1: number; y1: number } {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of this.parts) {
      if (p.worldSpace && (p.dynamic || p.name.startsWith("chunk"))) continue;
      const b = p.worldBounds();
      x0 = Math.min(x0, b.x0);
      y0 = Math.min(y0, b.y0);
      x1 = Math.max(x1, b.x1);
      y1 = Math.max(y1, b.y1);
    }
    if (x1 < x0) return { x0: this.x, y0: this.y, x1: this.x, y1: this.y };
    return { x0, y0, x1, y1 };
  }

  /** Receive a hit: overlap -> state handler (or default material damage). */
  hit(hit: Hit): PartReport[] {
    const ovs = this.parts.filter((p) => p.hittable && p.visible && p.grid.count > 0).map((p) => overlap(p, hit));
    const touched = ovs.filter((o) => o.cells.length);
    const cutTargets = this.ropes.length + this.cloths.length;
    if (!touched.length && !cutTargets) return [];
    const ctx: HitContext = {
      hit,
      parts: touched.map((o) => ({ part: o.part, covered: o.cells.length, contact: o.contact })),
      contact: touched[0]?.contact ?? null,
    };
    this.lastReports = [];
    this.pendingOverlaps = touched;
    const handler = this.stateDef.hit;
    let next: string | void = undefined;
    if (handler) next = handler(this, ctx);
    else if (touched.length) this.damage(hit);
    this.pendingOverlaps = [];
    if (next && next !== this.state) this.go(next);
    return this.lastReports;
  }

  /** Reports from damage() during the current hit. */
  lastHitReports(): PartReport[] {
    return this.lastReports;
  }

  private pendingOverlaps: ReturnType<typeof overlap>[] = [];
  private lastReports: PartReport[] = [];

  /** Default material response for the current hit (only parts the hit touched). */
  damage(hit: Hit, only?: string[]): PartReport[] {
    const out: PartReport[] = [];
    for (const ov of this.pendingOverlaps) {
      if (only && !only.includes(ov.part.name)) continue;
      const r = damage(this.world, ov, hit);
      out.push(r);
      if (r.covered) {
        ov.part.flash = Math.max(ov.part.flash, hit.type === "slash" ? 0.5 : 0.8);
        ov.part.shake = Math.max(ov.part.shake, hit.type === "slash" ? 0.12 : 0.22);
      }
      if (r.mat && r.covered && !r.removed && !r.shattered) this.world.soundAt(`${r.mat.sound}.hit`, r.contact?.[0] ?? this.x, r.contact?.[1] ?? this.y, 0.7);
    }
    this.lastReports.push(...out);
    return out;
  }

  /** Cut this prop's ropes and tear its cloth along the hit. */
  cut(hit: Hit, o: { ropes?: boolean; cloth?: boolean } = {}): { cut: number; torn: number } {
    return cutAlong(this.world, hit, o.ropes === false ? [] : this.ropes, o.cloth === false ? [] : this.cloths);
  }

  /** A prop-local rect in H as a world rect (mirrored with the prop). */
  zoneRect(z: [number, number, number, number]): { x0: number; y0: number; x1: number; y1: number } {
    const H = this.params.H;
    const ax = this.x + z[0] * H * this.flip, bx = this.x + z[2] * H * this.flip;
    const ay = this.y + z[1] * H, by = this.y + z[3] * H;
    return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
  }

  /** Is (x, y) within the E reach? */
  inReach(x: number, y: number): boolean {
    const u = this.recipe.use;
    if (!u) return false;
    const b = u.zone ? this.zoneRect(u.zone) : this.bounds();
    const dx = Math.max(b.x0 - x, 0, x - b.x1);
    const dy = Math.max(b.y0 - y, 0, y - b.y1);
    return Math.hypot(dx, dy) <= u.reach * this.params.H;
  }

  use(): boolean {
    const h = this.stateDef.use;
    if (!h) return false;
    const next = h(this);
    if (next && next !== this.state) this.go(next);
    return true;
  }

  /** Save the persisted keys. */
  save(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of this.recipe.persist ?? []) if (k in this.data) out[k] = this.data[k];
    return out;
  }

  /** Paint a cell region of a part with another material (states that re-colour). */
  paint(partName: string, fn: (x: number, y: number, mat: number) => string | null | undefined): void {
    const p = this.part(partName);
    const g = p.grid;
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const i = g.inner(x, y);
        if (!g.mat[i]) continue;
        const m = fn(x, y, g.mat[i]!);
        if (m === undefined) continue;
        if (m === null) g.clearRaw(i);
        else {
          g.mat[i] = resolveMat(m).id;
          g.markRaw(i);
        }
      }
    }
  }
}

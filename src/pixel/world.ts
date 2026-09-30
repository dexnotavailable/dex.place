// A room of pixel matter: props, debris, lights, wind, healing, events.
// Simulation runs at a fixed 60 Hz (scaled by timeScale for slow motion);
// only disturbed things simulate: sleeping ropes/cloth/chunks and untouched
// cells cost nothing (a sleeping chunk only re-checks its support 5x a second).
//
// GPU lifetime: parts that leave the world for good (chunks landing home,
// evicted or cleared, removed props) are retired; the renderer frees their
// textures on its next frame. Tear a whole room down with
// renderer.releaseWorld(world).

import { Chunk, Particles, P_AMB, P_DRAG, P_FADE, P_RISE } from "./bodies.ts";
import { F_FRESH, type Rect } from "./cells.ts";
import { rawRect } from "./break.ts";
import { coverage, hitBounds, type Hit } from "./hits.ts";
import { matById } from "./materials.ts";
import { Tweens, flicker } from "./motion.ts";
import type { Part } from "./part.ts";
import { follow, Prop, type BaseParams, type Hang, type Recipe } from "./prop.ts";
import { physics, SCALE } from "./scale.ts";
import { rng, type Rng } from "./util.ts";
import { FlashGate } from "../scenes/engine/flashes.ts";

/** Something that walks through the room (the player, later mobs): feet at (x, y). Grass bends, puddles splash. */
export interface Actor {
  x: number;
  y: number;
  /** Horizontal speed, px/s (sign = direction). */
  vx: number;
  /** Height in px (the player: H). */
  h: number;
  id?: string;
}

/** The global flash gate shape (src/scenes/engine/flashes.ts): at most 3 starts a second, 1 per 2 s reduced. */
export interface FlashGateLike {
  allow(now: number, reduced: boolean): boolean;
}

/** Same fields as the lab's PointLight (src/lab/engine/renderer.ts). */
export interface PointLight {
  x: number;
  y: number;
  height: number;
  radius: number;
  colour: [number, number, number];
  intensity: number;
}

export interface Glow {
  kind: "disc" | "beam" | "ring";
  x: number;
  y: number;
  colour: [number, number, number];
  radius: number;
  intensity: number;
  flat: number;
  x1: number;
  y1: number;
  width1: number;
  thick: number;
}

export interface WorldEvent {
  type: string;
  prop?: Prop;
  [k: string]: unknown;
}

export interface Collider {
  part: Part;
  type: "solid" | "platform" | "trigger";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Wound {
  part: Part;
  rect: Rect;
  t: number;
  homed: boolean;
  /** Cells still off at the last pass (sets the pace: any wound mends in ~heal.time s). */
  left: number;
}

export interface WorldOptions {
  H?: number;
  width?: number;
  height?: number;
  seed?: number;
  /** Seconds before a wound starts healing, and cells restored per second. */
  heal?: { delay: number; rate: number };
  /** Steady wind (px/s^2) and gust strength. */
  wind?: { x: number; gust: number };
}

export class PixelWorld {
  readonly H: number;
  width: number;
  height: number;
  time = 0;
  timeScale = 1;
  paused = false;
  readonly rand: Rng;
  props: Prop[] = [];
  chunks: Chunk[] = [];
  particles: Particles;
  tweens = new Tweens();
  /** Host lights (player effects, sandbox lamp) merged into the light list. */
  hostLights: PointLight[] = [];
  /** Host glows (light layer) merged into the glow list. */
  hostGlows: Glow[] = [];
  heal: { delay: number; rate: number; time?: number };
  wind: { x: number; gust: number };
  budget = { chunks: 72, particles: 6000, lights: 16, cells: 600_000, ambient: 320 };
  /**
   * Room breakage rule: "normal", or "sway" where nothing fractures, tears or
   * shatters (the chapel nave). Per-prop classes are the recipes' `breakage`.
   */
  breakage: "normal" | "sway" = "normal";
  /** Reduced motion: ambient emitters thin out, flashes go through the reduced gate, nothing strobes. */
  reduced = false;
  /** Rain 0..1 (the host copies its weather here): puddles dot, flames hiss. */
  rain = 0;
  /** Who is walking through the room this frame (the host sets it). */
  actors: Actor[] = [];
  /**
   * The camera view in world px (the host sets it each frame). Dynamic parts
   * (flames, cloth, ropes) outside it by more than 2 H skip re-rasterising,
   * and ambient emitters only spawn inside it. null: everything counts as in view.
   */
  view: { x: number; y: number; w: number; h: number } | null = null;
  /** Every light flash asks this gate; the host passes the runtime's global one. */
  flashGate: FlashGateLike = new FlashGate();
  saveData: Record<string, Record<string, unknown>> = {};
  readonly gravity: number;
  private transientLights: { l: PointLight; t: number; dur: number; i0: number }[] = [];
  private transientGlows: { g: Glow; t: number; dur: number; i0: number }[] = [];
  private winds: { x: number; y: number; r: number; fx: number; fy: number; t: number; dur: number }[] = [];
  private wounds: Wound[] = [];
  private fresh: { part: Part; idx: number; t: number }[] = [];
  private events: WorldEvent[] = [];
  private acc = 0;
  private effects: { done: boolean; step(dt: number): void }[] = [];
  /** Run a stepping effect (disintegrate, custom sweeps) until it reports done. */
  addEffect(e: { done: boolean; step(dt: number): void }): void {
    this.effects.push(e);
  }
  /** Ropes rest on the ground only (a cable leaving a solid body must not be shoved out of it every step). */
  private ropeGroundFn = (x: number, y: number): boolean => {
    for (const p of this.props) for (const part of p.parts) if (part.ground && part.visible && part.cellAt(x, y) >= 0) return true;
    return y >= this.height + 40;
  };
  /** Parts removed for good whose GPU textures the renderer frees on its next frame. */
  private retired: Part[] = [];

  /** Hand a part that is gone for good to the renderer for release (see drainRetired). */
  retire(part: Part): void {
    if (part.gpu) this.retired.push(part);
  }

  /** Parts retired since the last call (the renderer frees their textures). */
  drainRetired(): Part[] {
    const r = this.retired;
    this.retired = [];
    return r;
  }

  /** Remove chunks matching `drop` from the list, retiring them. */
  private dropChunks(drop: (c: Chunk) => boolean): void {
    const keep: Chunk[] = [];
    for (const c of this.chunks) {
      if (drop(c)) this.retire(c);
      else keep.push(c);
    }
    this.chunks = keep;
  }
  /** Counters for the sandbox readout. */
  stats = { steps: 0, simMs: 0, awakeRopes: 0, awakeCloth: 0, awakeChunks: 0, wounds: 0, dynamicRuns: 0, ambient: 0, flashDenied: 0 };

  constructor(o: WorldOptions = {}) {
    this.H = o.H ?? SCALE.H;
    this.width = o.width ?? SCALE.view.w;
    this.height = o.height ?? SCALE.view.h;
    this.rand = rng(o.seed ?? 1);
    this.heal = o.heal ?? { delay: 4, rate: 70 };
    this.wind = o.wind ?? { x: 0, gust: 0 };
    this.particles = new Particles(this.budget.particles);
    this.gravity = physics(this.H).gravity;
  }

  // --- props -----------------------------------------------------------------

  add<P extends object, R>(recipe: Recipe<P, R>, params: Partial<P & BaseParams>, x: number, y: number, o: { flip?: 1 | -1; id?: string } = {}): Prop<R> {
    const p = { ...recipe.defaults, seed: 1, wear: 0, variant: 0, ...params, H: this.H } as P & BaseParams;
    const prop = new Prop<R>(recipe as unknown as Recipe<object, R>, p as BaseParams & Record<string, unknown>, x, y, o.flip ?? 1, o.id);
    prop.world = this;
    const saved = this.saveData[prop.id];
    if (saved) Object.assign(prop.data, saved);
    prop.build();
    for (const part of prop.parts) part.updateTransform();
    this.props.push(prop as Prop);
    const init = typeof recipe.initial === "function" ? recipe.initial(prop as never) : recipe.initial;
    prop.go(init);
    return prop;
  }

  remove(prop: Prop): void {
    this.props = this.props.filter((p) => p !== prop);
    for (const part of prop.parts) this.retire(part);
    this.dropChunks((c) => c.home?.part.prop === prop);
  }

  find(id: string): Prop | undefined {
    return this.props.find((p) => p.id === id);
  }

  /** Every drawable part (props, their ropes/cloth, chunks). */
  allParts(): Part[] {
    const out: Part[] = [];
    for (const p of this.props) for (const q of p.parts) out.push(q);
    for (const c of this.chunks) out.push(c);
    return out;
  }

  // --- simulation ------------------------------------------------------------

  /** Advance by real seconds (fixed 60 Hz steps, scaled by timeScale). */
  update(realDt: number): void {
    if (this.paused) return;
    this.acc += Math.min(0.1, realDt) * this.timeScale;
    const step = 1 / 60;
    let n = 0;
    while (this.acc >= step && n < 6) {
      this.step(step);
      this.acc -= step;
      n++;
    }
    if (n === 6) this.acc = 0;
  }

  step(dt: number): void {
    const t0 = performance.now();
    this.time += dt;
    const g = this.gravity;
    const windFn = (x: number, y: number): [number, number] => this.windAt(x, y);
    for (const p of this.props) p.update(dt);
    let ar = 0, ac = 0;
    for (const p of this.props) {
      for (const r of p.ropes) {
        r.step(dt, g, this.hasWind() ? windFn : undefined, this.ropeGroundFn);
        if (!r.sleeping) ar++;
      }
      for (const c of p.cloths) {
        c.step(dt, g, this.hasWind() ? windFn : undefined);
        if (!c.sleeping) ac++;
      }
      for (const h of p.hangs) {
        if (h.rope.sleeping) continue;
        follow(h);
        if (h.rope.cut.some((v) => v)) this.landHang(h);
      }
    }
    let ak = 0, dyn = 0;
    for (const c of this.chunks) {
      c.step(dt, g, this, this.width);
      if (!c.asleep) ak++;
      if (c.homing && c.home && c.homing.t >= c.homing.dur) this.landChunk(c);
    }
    this.dropChunks((c) => !!c.tag["gone"]);
    this.particles.step(dt, g, this, windFn);
    this.tweens.step(dt);
    for (const e of this.effects) e.step(dt);
    this.effects = this.effects.filter((e) => !e.done);
    this.stepHealing(dt);
    this.stepTransients(dt);
    // parts: transforms, hit flash / shake decay, glint sweeps, dynamic re-rasterising
    for (const part of this.allParts()) {
      if (part.flash > 0) part.flash = Math.max(0, part.flash - dt * 5);
      if (part.shake > 0) part.shake = Math.max(0, part.shake - dt);
      if (part.glintT >= 0) {
        part.glintT += dt * 1.4;
        if (part.glintT > 1.3) part.glintT = -1;
      }
      part.updateTransform();
      if (part.dynamic) {
        // throttled parts (pixel-art flames at 15 Hz) and parts out of view wait
        if (part.dynamicEvery > 1 && (this.stats.steps + part.dynamicPhase) % part.dynamicEvery !== 0 && part.tag["drawn"]) continue;
        if (this.view && part.tag["drawn"] && !this.partInView(part)) continue;
        part.dynamic(part, dt);
        part.tag["drawn"] = true;
        dyn++;
      }
    }
    for (const p of this.props) {
      const s = p.save();
      if (Object.keys(s).length) this.saveData[p.id] = s;
    }
    this.stats.steps++;
    this.stats.awakeRopes = ar;
    this.stats.awakeCloth = ac;
    this.stats.awakeChunks = ak;
    this.stats.wounds = this.wounds.length;
    this.stats.dynamicRuns = dyn;
    this.stats.ambient = this.countAmbient();
    this.stats.simMs = performance.now() - t0;
  }

  /** A hung part on a cut rope rests on the ground (the rope end rides on top of it). */
  private landHang(h: Hang): void {
    const part = h.part;
    part.updateTransform();
    const b = part.worldBounds();
    const gy = this.groundY((b.x0 + b.x1) / 2, b.y0, b.y1 - b.y0 + 2);
    if (Number.isNaN(gy) || b.y1 - 1 <= gy) return;
    const lift = b.y1 - 1 - gy;
    const r = h.rope, k = r.n - 1;
    r.y[k] = r.y[k]! - lift;
    r.py[k] = r.y[k]!;
    r.px[k] = r.x[k]!;
    part.y -= lift;
    h.landed = true;
  }

  private landChunk(c: Chunk): void {
    const h = c.home!;
    for (const i of h.cells) h.part.grid.restoreRaw(i);
    for (const i of h.cells) this.fresh.push({ part: h.part, idx: i, t: 0 });
    c.tag["gone"] = true;
  }

  // --- hits ------------------------------------------------------------------

  /** Apply a hit to every prop and loose chunk it touches. */
  hit(hit: Hit): { prop: Prop; reports: ReturnType<Prop["hit"]> }[] {
    const out: { prop: Prop; reports: ReturnType<Prop["hit"]> }[] = [];
    const hb = hitBounds(hit.shape);
    for (const p of [...this.props]) {
      const b = p.bounds();
      const loose = p.ropes.length + p.cloths.length > 0;
      const m = (p.recipe.feel ?? 0) * this.H;
      if (!loose && (b.x1 + m < hb.x0 || b.x0 - m > hb.x1 || b.y1 + m < hb.y0 || b.y0 - m > hb.y1)) continue;
      const reports = p.hit(hit);
      out.push({ prop: p, reports });
    }
    // loose rubble gets knocked around
    for (const c of this.chunks) {
      if (c.homing) continue;
      if (coverage(hit.shape, c.wx, c.wy) <= 0) continue;
      c.wake();
      const sp = hit.force * 0.8;
      c.vx += hit.dir[0] * sp + (this.rand() - 0.5) * sp * 0.4;
      c.vy += hit.dir[1] * sp * 0.5 - sp * 0.5;
      c.vr += (this.rand() - 0.5) * 8;
    }
    if (hit.type === "wind" && hit.shape.kind === "cone") {
      const s = hit.shape;
      this.blow(s.x, s.y, s.len, Math.cos(s.dir) * hit.force * 6, Math.sin(s.dir) * hit.force * 6, 0.35);
    }
    return out;
  }

  /** Nearest prop whose E reach includes (x, y), or null. */
  nearestUsable(x: number, y: number): Prop | null {
    let best: Prop | null = null, bd = Infinity;
    for (const p of this.props) {
      if (!p.inReach(x, y) || !p.stateDef.use) continue;
      const [cx, cy] = p.centre();
      const d = Math.hypot(cx - x, cy - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  use(x: number, y: number): Prop | null {
    const p = this.nearestUsable(x, y);
    if (p) p.use();
    return p;
  }

  // --- collision -------------------------------------------------------------

  /** Is there ground (a ground part, or a solid part) at world (x, y)? */
  solidAt(x: number, y: number): boolean {
    for (const p of this.props) {
      for (const part of p.parts) {
        if (!(part.ground || part.collide === "solid") || !part.visible) continue;
        if (part.cellAt(x, y) >= 0) return true;
      }
    }
    return y >= this.height + 40;
  }

  /**
   * What living ground cover stands on: the host's terrain (and water surfaces it lets plants
   * root in), not other props. null: the world has no terrain of its own (the sandbox), so cover
   * falls back to `solidAt` and then to where it was placed.
   */
  plantGround: ((x: number, y: number) => boolean) | null = null;

  /**
   * Where cover rooted near (x, y) meets the ground: the first row at or below `y - up` (down to
   * `y + down`) that is ground. Returns the row's y (the base pixel sits on it, the same row a
   * prop placed on the ground uses), NaN when the ground is out of reach (over a drop, inside a
   * wall), or `y` when the world has no ground to ask (sandbox previews keep their old look).
   */
  surfaceY(x: number, y: number, up: number, down: number): number {
    const at = this.plantGround ?? ((px: number, py: number): boolean => this.solidAt(px, py));
    const y0 = Math.round(y - up), y1 = Math.round(y + down);
    const miss = this.plantGround ? NaN : y;
    if (at(x, y0)) return miss;
    for (let yy = y0 + 1; yy <= y1; yy++) if (at(x, yy)) return yy;
    return miss;
  }

  /** First solid/platform surface at x at or below fromY. */
  groundY(x: number, fromY: number, limit = 2000): number {
    for (let y = Math.floor(fromY); y < fromY + limit; y++) {
      for (const p of this.props) for (const part of p.parts) {
        if (part.collide !== "solid" && part.collide !== "platform" && !part.ground) continue;
        if (part.cellAt(x + 0.5, y + 0.5) >= 0) return y;
      }
    }
    return NaN;
  }

  colliders(): Collider[] {
    const out: Collider[] = [];
    for (const p of this.props) for (const part of p.parts) {
      if (part.collide === "none" || !part.visible) continue;
      const b = part.grid.bounds();
      if (!b) continue;
      const a = part.toWorld(b.x0, b.y0), c = part.toWorld(b.x1 + 1, b.y1 + 1);
      out.push({ part, type: part.collide, x0: Math.min(a[0], c[0]), y0: Math.min(a[1], c[1]), x1: Math.max(a[0], c[0]), y1: Math.max(a[1], c[1]) });
    }
    return out;
  }

  // --- wind ------------------------------------------------------------------

  private hasWind(): boolean {
    return this.winds.length > 0 || this.wind.x !== 0 || this.wind.gust !== 0;
  }

  windAt(x: number, y: number): [number, number] {
    let wx = this.wind.x + this.wind.gust * (Math.sin(this.time * 0.7 + x * 0.004) * 0.6 + Math.sin(this.time * 1.9 + x * 0.01) * 0.4);
    let wy = 0;
    for (const w of this.winds) {
      const d = Math.hypot(x - w.x, y - w.y);
      if (d > w.r) continue;
      const k = (1 - d / w.r) * (1 - w.t / w.dur);
      wx += w.fx * k;
      wy += w.fy * k;
    }
    return [wx, wy];
  }

  /** A gust (dash, spin, explosion): wakes cloth and ropes in range. */
  blow(x: number, y: number, r: number, fx: number, fy: number, dur: number): void {
    this.winds.push({ x, y, r, fx, fy, t: 0, dur });
    for (const p of this.props) {
      for (const c of p.cloths) c.wake();
      for (const rp of p.ropes) rp.wake();
    }
  }

  // --- lights, glows, sound, events ------------------------------------------

  /**
   * A short light flash (sparks, a flare, an impact). It asks the flash gate
   * first; a denied flash is dropped (`force` skips the gate for lights that
   * rise slowly and never strobe). Returns whether it started.
   */
  flashLight(x: number, y: number, colour: [number, number, number], radius: number, intensity: number, dur: number, o: { force?: boolean } = {}): boolean {
    if (!o.force && !this.flashGate.allow(this.time, this.reduced)) {
      this.stats.flashDenied++;
      return false;
    }
    if (this.reduced) {
      intensity *= 0.6;
      dur = Math.max(dur, 0.25);
    }
    this.transientLights.push({ l: { x, y, height: this.H * 0.5, radius, colour, intensity }, t: 0, dur, i0: intensity });
    return true;
  }

  flashGlow(g: Glow, dur: number, o: { force?: boolean } = {}): boolean {
    if (!o.force && !this.flashGate.allow(this.time, this.reduced)) {
      this.stats.flashDenied++;
      return false;
    }
    this.transientGlows.push({ g, t: 0, dur, i0: g.intensity * (this.reduced ? 0.6 : 1) });
    return true;
  }

  // --- view, actors, ambient ---------------------------------------------------

  /** Is world (x, y) inside the view (plus a margin in px)? No view set: always. */
  inView(x: number, y: number, margin = 0): boolean {
    const v = this.view;
    if (!v) return true;
    return x >= v.x - margin && x <= v.x + v.w + margin && y >= v.y - margin && y <= v.y + v.h + margin;
  }

  private partInView(part: Part): boolean {
    const v = this.view!;
    const b = part.worldBounds();
    const m = this.H * 2;
    return !(b.x1 < v.x - m || b.x0 > v.x + v.w + m || b.y1 < v.y - m || b.y0 > v.y + v.h + m);
  }

  /** Actors whose feet are within `r` px of (x, y) horizontally and `ry` vertically. */
  actorsNear(x: number, y: number, r: number, ry = this.H): Actor[] {
    return this.actors.filter((a) => Math.abs(a.x - x) <= r && Math.abs(a.y - y) <= ry);
  }

  private countAmbient(): number {
    const P = this.particles;
    let n = 0;
    for (let i = 0; i < P.n; i++) if (P.flags[i]! & P_AMB) n++;
    return n;
  }

  /**
   * Spawn an ambient particle (dust, motes, moths, drifting ash): capped per
   * room (`budget.ambient`, halved in reduced motion), only in view, and
   * never allowed to crowd out debris. Returns the index or -1.
   */
  spawnAmbient(s: Parameters<Particles["spawn"]>[0]): number {
    const cap = this.reduced ? this.budget.ambient >> 1 : this.budget.ambient;
    if (this.stats.ambient >= cap || !this.inView(s.x, s.y, this.H)) return -1;
    if (this.particles.n >= this.particles.cap - 200) return -1;
    this.stats.ambient++;
    return this.particles.spawn({ ...s, flags: s.flags | P_AMB });
  }

  private stepTransients(dt: number): void {
    for (const t of this.transientLights) {
      t.t += dt;
      t.l.intensity = t.i0 * Math.max(0, 1 - t.t / t.dur);
    }
    this.transientLights = this.transientLights.filter((t) => t.t < t.dur);
    for (const t of this.transientGlows) {
      t.t += dt;
      t.g.intensity = t.i0 * Math.max(0, 1 - t.t / t.dur);
    }
    this.transientGlows = this.transientGlows.filter((t) => t.t < t.dur);
    for (const w of this.winds) w.t += dt;
    this.winds = this.winds.filter((w) => w.t < w.dur);
  }

  /** All lights: prop lights (flickering), transients, host lights; strongest first, capped. */
  lights(view?: { x: number; y: number; w: number; h: number }): PointLight[] {
    const out: PointLight[] = [];
    for (const p of this.props) {
      for (const L of p.lights) {
        if (!L.on || L.level <= 0.001) continue;
        const [x, y] = L.part ? L.part.toWorld(L.lx, L.ly) : [p.x + L.lx * p.flip, p.y + L.ly];
        const f = L.flicker ? 1 - L.flicker + L.flicker * flicker(this.time, L.seed) : 1;
        out.push({ x, y, height: L.height, radius: L.radius * (0.92 + 0.08 * f), colour: L.colour, intensity: L.intensity * L.level * f });
      }
    }
    for (const t of this.transientLights) out.push(t.l);
    out.push(...this.hostLights);
    const cx = view ? view.x + view.w / 2 : this.width / 2, cy = view ? view.y + view.h / 2 : this.height / 2;
    const score = (l: PointLight): number => {
      if (view && (l.x + l.radius < view.x || l.x - l.radius > view.x + view.w || l.y + l.radius < view.y || l.y - l.radius > view.y + view.h)) return -1;
      return l.intensity * l.radius / (1 + Math.hypot(l.x - cx, l.y - cy) * 0.002);
    };
    return out.filter((l) => score(l) >= 0).sort((a, b) => score(b) - score(a)).slice(0, this.budget.lights);
  }

  glows(): Glow[] {
    const out: Glow[] = [];
    for (const p of this.props) {
      for (const G of p.glows) {
        if (!G.on || G.level <= 0.001) continue;
        const [x, y] = G.part ? G.part.toWorld(G.lx, G.ly) : [p.x + G.lx * p.flip, p.y + G.ly];
        const f = G.flicker ? 1 - G.flicker + G.flicker * flicker(this.time, G.seed) : 1;
        out.push({ kind: G.kind, x, y, colour: G.colour, radius: G.radius, intensity: G.intensity * G.level * f, flat: G.flat, x1: x + G.to[0] * p.flip, y1: y + G.to[1], width1: G.width1, thick: G.thick });
      }
    }
    for (const t of this.transientGlows) out.push(t.g);
    out.push(...this.hostGlows);
    return out;
  }

  soundAt(id: string, x: number, y: number, volume = 1): void {
    this.event({ type: "sound", id, x, y, volume });
  }

  event(e: WorldEvent): void {
    this.events.push(e);
    if (this.events.length > 400) this.events.shift();
  }

  drainEvents(): WorldEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // --- debris, wounds and healing ---------------------------------------------

  addChunk(c: Chunk): void {
    this.chunks.push(c);
    c.updateTransform();
    if (this.chunks.length > this.budget.chunks) {
      // evict the oldest settled rubble: it crumbles to dust (its cells come back when the wound heals)
      const idx = this.chunks.findIndex((k) => k.asleep && !k.homing);
      const victim = idx >= 0 ? this.chunks[idx]! : this.chunks[0]!;
      this.dust(victim);
      this.dropChunks((k) => k === victim);
    }
  }

  /** A chunk crumbles into dust particles of its own colours. */
  dust(c: Chunk): void {
    const g = c.grid;
    const r = this.rand;
    for (let i = 0; i < g.mat.length; i++) {
      if (!g.mat[i] || r() > 0.35) continue;
      const m = matById(g.mat[i]!);
      const [x, y] = c.cellWorld(i);
      this.particles.spawn({ x, y, vx: (r() - 0.5) * 20, vy: -r() * 20, life: 0.5 + r() * 0.8, rgb: m ? m.rgb[1]! : [80, 80, 90], flags: P_DRAG | P_RISE | P_FADE });
    }
  }

  /** Record damaged cells so the part can heal (ground parts and restorable parts). */
  wound(part: Part, cells: number[]): void {
    if (!(part.ground || part.tag["heal"])) return;
    const r = rawRect(part.grid, cells);
    if (!r) return;
    const pad = 2;
    const rect = { x0: Math.max(0, r.x0 - pad), y0: Math.max(0, r.y0 - pad), x1: Math.min(part.grid.W - 1, r.x1 + pad), y1: Math.min(part.grid.Hh - 1, r.y1 + pad) };
    // merge with an overlapping wound on the same part
    for (const w of this.wounds) {
      if (w.part !== part) continue;
      if (rect.x0 > w.rect.x1 + 4 || rect.x1 < w.rect.x0 - 4 || rect.y0 > w.rect.y1 + 4 || rect.y1 < w.rect.y0 - 4) continue;
      w.rect = { x0: Math.min(w.rect.x0, rect.x0), y0: Math.min(w.rect.y0, rect.y0), x1: Math.max(w.rect.x1, rect.x1), y1: Math.max(w.rect.y1, rect.y1) };
      w.t = 0;
      w.homed = false;
      return;
    }
    this.wounds.push({ part, rect, t: 0, homed: false, left: cells.length });
  }

  /** Send a part's chunks and pixels home (assemble). Returns how many pieces fly. */
  restoreDebris(part: Part, o: { stagger?: number; dur?: number } = {}): number {
    const stagger = o.stagger ?? 1.2, dur = o.dur ?? 0.9;
    let n = 0;
    const mine = this.chunks.filter((c) => c.home?.part === part && !c.homing);
    mine.sort((a, b) => a.y - b.y);
    mine.forEach((c, k) => {
      c.wake();
      c.homing = { t: -(k / Math.max(1, mine.length)) * stagger, dur: dur * (0.8 + this.rand() * 0.4), sx: c.x, sy: c.y, sr: c.rot };
      n++;
    });
    n += this.particles.homeAll(part, stagger, dur * 0.8, this.rand);
    return n;
  }

  /** Put a part back exactly as built (cells that never came home fade back in). */
  restorePart(part: Part): void {
    const g = part.grid;
    for (let i = 0; i < g.mat.length; i++) {
      if (!g.differs(i)) continue;
      g.restoreRaw(i);
      if (g.mat[i]) this.fresh.push({ part, idx: i, t: 0 });
    }
    this.dropChunks((c) => c.home?.part === part);
  }

  private stepHealing(dt: number): void {
    for (const f of this.fresh) f.t += dt;
    const done = this.fresh.filter((f) => f.t > 0.35);
    for (const f of done) {
      const g = f.part.grid;
      if (g.flags[f.idx]! & F_FRESH) {
        g.flags[f.idx] = g.flags[f.idx]! & ~F_FRESH;
        g.markRaw(f.idx);
      }
    }
    if (done.length) this.fresh = this.fresh.filter((f) => f.t <= 0.35);
    for (const w of this.wounds) {
      w.t += dt;
      if (w.t < this.heal.delay) continue;
      if (!w.homed) {
        this.restoreDebris(w.part, { stagger: 1.6, dur: 1.1 });
        w.homed = true;
      }
      // pixels reassemble from the bottom up, a few per step
      const g = w.part.grid;
      let budget = Math.max(1, Math.round(Math.max(this.heal.rate * dt, (w.left * dt) / (this.heal.time ?? 3.5)) * 2));
      let remaining = 0;
      for (let Y = w.rect.y1; Y >= w.rect.y0; Y--) {
        for (let X = w.rect.x0; X <= w.rect.x1; X++) {
          const i = Y * g.W + X;
          if (!g.differs(i)) continue;
          remaining++;
          if (budget <= 0) continue;
          const below = i + g.W;
          const supported = Y >= g.Hh - 1 || !g.differs(below);
          if (!supported || this.rand() > 0.5) continue;
          g.restoreRaw(i);
          if (g.mat[i]) this.fresh.push({ part: w.part, idx: i, t: 0 });
          budget--;
        }
      }
      w.left = remaining;
      if (!remaining) w.t = -1;
    }
    this.wounds = this.wounds.filter((w) => w.t >= 0);
  }

  /** Clear every wound and debris; restore every part (room reset). */
  resetAll(): void {
    for (const p of this.props) for (const part of p.parts) if (part.grid.orig && !part.dynamic) part.grid.restoreAll();
    this.dropChunks(() => true);
    this.particles.n = 0;
    this.wounds = [];
    this.fresh = [];
  }
}

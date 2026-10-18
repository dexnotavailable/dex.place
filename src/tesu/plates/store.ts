// Streaming plate tiles: the camera asks for what it can see (and a margin around it);
// workers paint them; finished tiles go into texture-array slots, least recently used
// first out. Empty tiles cost nothing. This replaces the room graph's streaming: the
// world is one continuous plate, painted where you look.

import { TILE } from "../config.ts";
import type { PlaneRenderer } from "../render/planes.ts";
import type { PlaneId, WorldDef } from "../world/types.ts";
import { worldFromJson, type BakeInfo } from "./bake.ts";
import { PlateIndex, paintTile } from "./paint.ts";
import { buildWorld } from "../world/index.ts";

interface Entry {
  /** Texture layer, or -1 while painting, or -2 when the tile is empty. */
  layer: number;
  used: number;
  pri: number;
  /** Asked for by a frame drawing it (get), not only ahead of need (want). */
  shown?: boolean;
}

interface Job {
  key: string;
  plane: PlaneId;
  level: number;
  tx: number;
  ty: number;
  pri: number;
}

export const key = (plane: PlaneId, level: number, tx: number, ty: number): string => `${plane}|${level}|${tx}|${ty}`;

/** (round 7) A sprite frame to paint in a worker (render/sprite-paint.ts). */
export interface SpriteJob {
  key: string;
  kind: string;
  p: Record<string, unknown>;
  seed: number;
  frame: number;
  level: number;
}

/** A sprite frame painted by a worker (RGBA), or null when it could not be. */
export interface SpriteDone {
  rgba: Uint8Array;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

/**
 * (engine 10-18, loading) The plate workers, started first thing at boot: worker 0 builds the world (it must anyway,
 * to paint) and hands it to the page, which then never builds it on its own thread (~0.35 s in one task on a desktop
 * CPU, over a second on a phone, on the same thread as the website's "dex" when the world is framed in the page).
 * `world` resolves null when there are no workers or worker 0 fails (the page builds it then).
 */
export interface PlatePool {
  workers: Worker[];
  world: Promise<WorldDef | null>;
  /** (engine, perf) A worker has said it is up (it may say so before the store listens). */
  up: { alive: boolean };
}

export function startPlateWorkers(n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)), bake: BakeInfo | null = null): PlatePool {
  const workers: Worker[] = [];
  try {
    if (typeof Worker === "undefined") throw new Error("no workers");
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      // (engine, perf) where the build's baked tiles and world are (plates/bake.ts)
      if (bake?.index || bake?.world) w.postMessage({ bake });
      workers.push(w);
    }
  } catch {
    return { workers: [], world: Promise.resolve(null), up: { alive: false } };
  }
  const up = { alive: false };
  for (const w of workers) w.addEventListener("message", (e: MessageEvent<{ alive?: boolean }>) => { if (e.data?.alive) up.alive = true; });
  // (engine, perf) the baked world: fetched and parsed here (a few ms), no worker build to wait for
  if (bake?.world) {
    const url = bake.world;
    const world = fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`)))).then((t) => {
      performance.mark("tesu:world-built");
      return worldFromJson(t);
    }).catch(() => null);
    return { workers, world, up };
  }
  const w0 = workers[0]!;
  const world = new Promise<WorldDef | null>((resolve) => {
    const done = (def: WorldDef | null): void => {
      w0.removeEventListener("message", onMsg);
      w0.removeEventListener("error", onErr);
      resolve(def);
    };
    const onMsg = (e: MessageEvent<{ world?: WorldDef; ms?: number }>): void => {
      if (!e.data || !("world" in e.data)) return;
      performance.mark("tesu:world-built");
      done(e.data.world ?? null);
    };
    const onErr = (): void => done(null);
    w0.addEventListener("message", onMsg);
    w0.addEventListener("error", onErr);
    w0.postMessage({ world: true });
  });
  return { workers, world, up };
}

export class TileStore {
  private entries = new Map<string, Entry>();
  private free: number[] = [];
  private byLayer: (string | null)[];
  private queue = new Map<string, Job>();
  private workers: { w: Worker; busy: number }[] = [];
  /** (round 7) Sprite frames waiting for a worker, and those being painted (their callbacks). */
  private sprQueue: { job: SpriteJob; done: (r: SpriteDone | null) => void }[] = [];
  private sprWait = new Map<string, (r: SpriteDone | null) => void>();
  sprInFlight = 0;
  /** (engine, perf) A worker has said it is up. */
  private up: { alive: boolean } = { alive: false };
  /** (engine, perf) The bake check (?bakecheck): baked tiles equal to the painted ones, and different. */
  bakeSame = 0;
  bakeDiff = 0;
  sprPainted = 0;
  sprMs = 0;
  private index: PlateIndex | null = null;
  frame = 0;
  painted = 0;
  paintMs = 0;
  evicted = 0;
  inFlight = 0;
  /** Paint on the main thread (no workers, or deterministic captures). */
  sync: boolean;
  /**
   * (the opening) Tiles its camera will draw again, with the T spans it has them on screen: kept while the
   * opening's T (keepT) is at or before the end of one of them, so a frame asked for ahead (the widest frame
   * under TESU) is still there when the camera gets to it. -Infinity: before the press (all kept).
   */
  private keepSpan = new Map<string, [number, number][]>();
  /** Kept tiles that cannot be painted in time once the camera needs them (go last of all). */
  private firm = new Set<string>();
  keepT = -Infinity;
  /** Kept tiles a full store had to let go (the opening's streaming stops asking for them). */
  lost = new Set<string>();

  private planes: PlaneRenderer;

  constructor(planes: PlaneRenderer, opts: { workers?: number; sync?: boolean; pool?: PlatePool | null } = {}) {
    this.planes = planes;
    this.byLayer = new Array(planes.layers).fill(null);
    for (let i = planes.layers - 1; i >= 0; i--) this.free.push(i);
    const n = opts.workers ?? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    this.sync = !!opts.sync || typeof Worker === "undefined";
    if (!this.sync) {
      try {
        const spawned = opts.pool?.workers.length ? opts.pool.workers : null;
        if (opts.pool) this.up = opts.pool.up;
        for (let i = 0; i < (spawned ? spawned.length : n); i++) {
          const w = spawned ? spawned[i]! : new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
          const slot = { w, busy: 0 };
          w.onmessage = (e: MessageEvent<{ key: string; px?: ArrayBuffer | null; ms: number; chk?: number; sprite?: true; rgba?: ArrayBuffer | null; w?: number; h?: number; ax?: number; ay?: number }>) => {
            const d = e.data;
            // (the world handed over at boot: startPlateWorkers' own message; a worker saying it is up)
            if (d && "world" in d) return;
            if (d && "alive" in d) return;
            slot.busy--;
            if (d.sprite) {
              this.sprInFlight--;
              this.sprPainted++;
              this.sprMs += d.ms;
              const done = this.sprWait.get(d.key);
              this.sprWait.delete(d.key);
              done?.(d.rgba ? { rgba: new Uint8Array(d.rgba), w: d.w!, h: d.h!, ax: d.ax!, ay: d.ay! } : null);
              return;
            }
            this.inFlight--;
            if (d.chk) { if (d.chk > 0) this.bakeSame++; else this.bakeDiff++; }
            this.finish(d.key, d.px ? new Uint8Array(d.px) : null, d.ms);
            // (engine, perf) the worker that answered gets the next job now, not at the next frame: a slow or
            // throttled frame (a weak GPU, a frame out of view) no longer leaves the workers idle between frames
            this.feed(slot);
          };
          w.onerror = (e) => console.error("plate worker", e.message);
          this.workers.push(slot);
        }
      } catch {
        this.workers = [];
      }
    }
    if (!this.workers.length) this.sync = true;
  }

  private idx(): PlateIndex {
    if (!this.index) this.index = new PlateIndex(buildWorld());
    return this.index;
  }

  /**
   * The layer of a tile if it is painted, -2 if it is empty, or -1 if it is not ready yet
   * (it is then requested at this priority; lower is sooner).
   */
  get(plane: PlaneId, level: number, tx: number, ty: number, pri: number): number {
    const k = key(plane, level, tx, ty);
    const e = this.entries.get(k);
    if (e) {
      e.used = this.frame;
      e.shown = true;
      if (e.layer === -1) {
        const j = this.queue.get(k);
        if (j && pri < j.pri) j.pri = pri;
      }
      return e.layer;
    }
    this.entries.set(k, { layer: -1, used: this.frame, pri, shown: true });
    this.queue.set(k, { key: k, plane, level, tx, ty, pri });
    return -1;
  }

  /** A tile's layer if painted (-2 empty), else -1; never requests. */
  peek(plane: PlaneId, level: number, tx: number, ty: number): number {
    const e = this.entries.get(key(plane, level, tx, ty));
    if (!e) return -1;
    if (e.layer >= 0) e.used = this.frame;
    return e.layer;
  }

  /** Asks for a tile ahead of need (prefetch) without marking it used this frame. */
  want(plane: PlaneId, level: number, tx: number, ty: number, pri: number): void {
    const k = key(plane, level, tx, ty);
    if (this.entries.has(k)) return;
    this.entries.set(k, { layer: -1, used: this.frame - 1, pri });
    this.queue.set(k, { key: k, plane, level, tx, ty, pri });
  }

  /** A tile's state without touching it: its layer, -1 asked for, -2 empty, undefined unknown. */
  layerOf(k: string): number | undefined {
    return this.entries.get(k)?.layer;
  }

  /** (the opening) Keeps a tile from T `from` to `until` (see keepSpan; a tile may have several spans). */
  keep(k: string, from: number, until: number, firm = false): void {
    if (firm) this.firm.add(k);
    const s = this.keepSpan.get(k);
    if (!s) {
      this.keepSpan.set(k, [[from, until]]);
      return;
    }
    if (s.some((v) => v[0] === from && v[1] === until)) return;
    s.push([from, until]);
    s.sort((a, b) => a[0] - b[0]);
  }

  /** (the opening) Lets every kept tile go (the hand-back, or a new plan). */
  clearKeep(): void {
    this.keepSpan.clear();
    this.firm.clear();
    this.lost.clear();
    this.keepT = -Infinity;
  }

  /** Whether a tile is kept now. */
  isKept(k: string): boolean {
    return !!this.kept(k);
  }

  /** The span a tile is kept for now (the first not yet over), or null. */
  private kept(k: string): [number, number] | null {
    const s = this.keepSpan.get(k);
    if (!s) return null;
    for (const v of s) if (v[1] >= this.keepT) return v;
    return null;
  }

  /** Kept tiles that hold a layer now (painted, not empty). */
  keptLayers(): number {
    let n = 0;
    for (const k of this.keepSpan.keys()) {
      const e = this.entries.get(k);
      if (e && e.layer >= 0 && this.kept(k)) n++;
    }
    return n;
  }

  /** Painted tiles holding a layer. */
  get layersUsed(): number {
    return this.byLayer.length - this.free.length;
  }

  /**
   * (round 7, performance) Paints a sprite frame in a worker; done() gets the pixels (or null) on a
   * later task. False when there are no workers (the caller paints it on the main thread).
   */
  paintSprite(job: SpriteJob, done: (r: SpriteDone | null) => void): boolean {
    if (this.sync || !this.workers.length) return false;
    this.sprQueue.push({ job, done });
    return true;
  }

  /** Jobs waiting or painting. */
  get pending(): number {
    return this.queue.size + this.inFlight;
  }

  private finish(k: string, px: Uint8Array | null, ms: number): void {
    this.painted++;
    this.paintMs += ms;
    const e = this.entries.get(k);
    if (!e) return;
    if (!px) {
      e.layer = -2;
      return;
    }
    // a kept tile may take the layer of one kept for later; a tile on screen now, of any kept for later
    const span = this.kept(k);
    const layer = this.alloc(span ? span[0] : e.shown && e.used >= this.frame - 2 ? -Infinity : null);
    if (layer < 0) {
      // no room: forget it; it is asked for again when needed
      this.entries.delete(k);
      if (this.keepSpan.has(k)) this.lost.add(k);
      return;
    }
    this.byLayer[layer] = k;
    e.layer = layer;
    this.planes.upload(layer, px);
  }

  /**
   * A layer for a new tile: a free one, else the least recently used painted tile not drawn this frame. Tiles
   * the opening keeps go last, and only for a tile needed before them (`needFrom`: the T a kept tile is needed
   * from, -Infinity for one on screen now; null: never); then the one needed latest (a firm one only when no
   * other will do), never one needed within the next half second.
   */
  private alloc(needFrom: number | null = null): number {
    const f = this.free.pop();
    if (f !== undefined) return f;
    let worst = -1, age = -1, kWorst = -1, kFrom = -Infinity, fWorst = -1, fFrom = -Infinity;
    const need = needFrom ?? Infinity;
    for (let i = 0; i < this.byLayer.length; i++) {
      const k = this.byLayer[i];
      if (!k) continue;
      const e = this.entries.get(k);
      if (!e) continue;
      const a = this.frame - e.used;
      if (a <= 0) continue;
      const s = this.keepSpan.size ? this.kept(k) : null;
      if (s) {
        if (s[0] > this.keepT + 0.5 && s[0] > need) {
          if (!this.firm.has(k)) {
            if (s[0] > kFrom) { kFrom = s[0]; kWorst = i; }
          } else if (s[0] > fFrom) { fFrom = s[0]; fWorst = i; }
        }
        continue;
      }
      if (a > age) { age = a; worst = i; }
    }
    if (worst < 0) worst = kWorst;
    if (worst < 0) worst = fWorst;
    if (worst < 0) return -1;
    const old = this.byLayer[worst]!;
    this.entries.delete(old);
    this.byLayer[worst] = null;
    this.evicted++;
    return worst;
  }

  private firstSend = 0;

  /** Workers that never answer (a blocked module worker) hand over to the main thread. */
  private watchdog(): void {
    // (engine, perf) a worker that is up but still fetching or painting is not a dead one: with the bake the first
    // tile can wait on its pack over a slow line, so only workers that never started count
    if (this.sync || !this.firstSend || this.painted > 0 || this.up.alive || performance.now() - this.firstSend < 4000) return;
    console.warn("plate workers did not answer; painting on the main thread");
    for (const s of this.workers) s.w.terminate();
    this.workers = [];
    this.sync = true;
    this.inFlight = 0;
    // sprite frames asked of them are painted on the main thread instead
    const waiting = [...this.sprWait.values(), ...this.sprQueue.map((q) => q.done)];
    this.sprWait.clear();
    this.sprQueue = [];
    this.sprInFlight = 0;
    for (const done of waiting) done(null);
    for (const [k, e] of this.entries) if (e.layer === -1 && !this.queue.has(k)) this.entries.delete(k);
  }

  /** (engine, perf) One worker's next job: the queued tile with the best priority (a scan, no sort). */
  private feed(slot: { w: Worker; busy: number }): void {
    if (this.sync || slot.busy >= 2 || !this.queue.size || this.sprQueue.length) return;
    let best: Job | null = null;
    for (const j of this.queue.values()) if (!best || j.pri < best.pri) best = j;
    if (!best) return;
    const e = this.entries.get(best.key);
    if (!e) { this.queue.delete(best.key); return; }
    this.queue.delete(best.key);
    slot.busy++;
    this.inFlight++;
    slot.w.postMessage({ key: best.key, plane: best.plane, level: best.level, tx: best.tx, ty: best.ty });
  }

  /** Sends queued jobs to idle workers (or paints within a budget on the main thread). */
  pump(budgetMs = 6): void {
    this.watchdog();
    // (round 7) sprite frames first: one is on screen now, a tile may only be the margin's. (The opening's fix
    // pass, film v0: while tiles wait, sprites take one of a worker's two places, not both: a steady stream of
    // sprite frames, a giant's frames at each new zoom of a camera move, kept every place full and no tile was
    // sent for 24 s of the opening on a slow machine.)
    if (this.sprQueue.length && !this.sync) {
      const most = this.queue.size ? 1 : 2;
      for (const slot of this.workers) {
        while (slot.busy < most && this.sprQueue.length) {
          const { job, done } = this.sprQueue.shift()!;
          slot.busy++;
          this.sprInFlight++;
          this.sprWait.set(job.key, done);
          try {
            slot.w.postMessage({ sprite: true, ...job });
          } catch {
            // (params a worker cannot be sent: painted on the main thread)
            slot.busy--;
            this.sprInFlight--;
            this.sprWait.delete(job.key);
            done(null);
          }
        }
      }
    }
    // drop requests nobody has looked at for a while (the camera moved on)
    for (const [k, j] of this.queue) {
      const e = this.entries.get(k);
      if (!e || (this.frame - e.used > 90 && !(this.keepSpan.size && this.kept(k)))) {
        this.queue.delete(k);
        this.entries.delete(k);
      } else j.pri = Math.min(j.pri, e.pri);
    }
    if (!this.queue.size) return;
    const jobs = [...this.queue.values()].sort((a, b) => a.pri - b.pri);
    if (this.sync) {
      const t0 = performance.now();
      for (const j of jobs) {
        if (performance.now() - t0 > budgetMs) break;
        this.queue.delete(j.key);
        const s = performance.now();
        const px = paintTile(this.idx(), j.plane, j.level, j.tx, j.ty);
        this.finish(j.key, px, performance.now() - s);
      }
      return;
    }
    let i = 0;
    for (const slot of this.workers) {
      while (slot.busy < 2 && i < jobs.length) {
        const j = jobs[i++]!;
        this.queue.delete(j.key);
        slot.busy++;
        this.inFlight++;
        if (!this.firstSend) this.firstSend = performance.now();
        slot.w.postMessage({ key: j.key, plane: j.plane, level: j.level, tx: j.tx, ty: j.ty });
      }
    }
  }

  /** Paints everything queued now, on the main thread (tools, tests, a stalled worker). */
  drain(): void {
    for (const j of [...this.queue.values()]) {
      this.queue.delete(j.key);
      const px = paintTile(this.idx(), j.plane, j.level, j.tx, j.ty);
      this.finish(j.key, px, 0);
    }
  }

  stats(): string {
    let used = 0, empty = 0;
    for (const e of this.entries.values()) {
      if (e.layer >= 0) used++;
      else if (e.layer === -2) empty++;
    }
    return `tiles ${used}/${this.byLayer.length} empty ${empty} queue ${this.queue.size} busy ${this.inFlight} painted ${this.painted} (${(this.paintMs / Math.max(1, this.painted)).toFixed(1)} ms) evicted ${this.evicted}${this.keepSpan.size ? ` kept ${this.keptLayers()}/${this.keepSpan.size}` : ""} sprites ${this.sprPainted} (${(this.sprMs / Math.max(1, this.sprPainted)).toFixed(1)} ms)${this.bakeSame + this.bakeDiff ? ` baked-check ${this.bakeSame} same ${this.bakeDiff} different` : ""}`;
  }
}

/** Tile index range covering art px [a, b). */
export function tileRange(a: number, b: number): [number, number] {
  return [Math.floor(a / TILE), Math.floor((b - 1) / TILE)];
}

// Streaming plate tiles: the camera asks for what it can see (and a margin around it);
// workers paint them; finished tiles go into texture-array slots, least recently used
// first out. Empty tiles cost nothing. This replaces the room graph's streaming: the
// world is one continuous plate, painted where you look.

import { TILE } from "../config.ts";
import type { PlaneRenderer } from "../render/planes.ts";
import type { PlaneId } from "../world/types.ts";
import { PlateIndex, paintTile } from "./paint.ts";
import { buildWorld } from "../world/index.ts";

interface Entry {
  /** Texture layer, or -1 while painting, or -2 when the tile is empty. */
  layer: number;
  used: number;
  pri: number;
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

  constructor(private planes: PlaneRenderer, opts: { workers?: number; sync?: boolean } = {}) {
    this.byLayer = new Array(planes.layers).fill(null);
    for (let i = planes.layers - 1; i >= 0; i--) this.free.push(i);
    const n = opts.workers ?? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    this.sync = !!opts.sync || typeof Worker === "undefined";
    if (!this.sync) {
      try {
        for (let i = 0; i < n; i++) {
          const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
          const slot = { w, busy: 0 };
          w.onmessage = (e: MessageEvent<{ key: string; px?: ArrayBuffer | null; ms: number; sprite?: true; rgba?: ArrayBuffer | null; w?: number; h?: number; ax?: number; ay?: number }>) => {
            slot.busy--;
            const d = e.data;
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
            this.finish(d.key, d.px ? new Uint8Array(d.px) : null, d.ms);
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
      if (e.layer === -1) {
        const j = this.queue.get(k);
        if (j && pri < j.pri) j.pri = pri;
      }
      return e.layer;
    }
    this.entries.set(k, { layer: -1, used: this.frame, pri });
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
    const layer = this.alloc();
    if (layer < 0) {
      // no room: forget it; it is asked for again when needed
      this.entries.delete(k);
      return;
    }
    this.byLayer[layer] = k;
    e.layer = layer;
    this.planes.upload(layer, px);
  }

  private alloc(): number {
    const f = this.free.pop();
    if (f !== undefined) return f;
    // evict the least recently used painted tile not drawn this frame
    let worst = -1, age = -1;
    for (let i = 0; i < this.byLayer.length; i++) {
      const k = this.byLayer[i];
      if (!k) continue;
      const e = this.entries.get(k);
      if (!e) continue;
      const a = this.frame - e.used;
      if (a > age && a > 0) { age = a; worst = i; }
    }
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
    if (this.sync || !this.firstSend || this.painted > 0 || performance.now() - this.firstSend < 4000) return;
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

  /** Sends queued jobs to idle workers (or paints within a budget on the main thread). */
  pump(budgetMs = 6): void {
    this.watchdog();
    // (round 7) sprite frames first: one is on screen now, a tile may only be the margin's
    if (this.sprQueue.length && !this.sync) {
      for (const slot of this.workers) {
        while (slot.busy < 2 && this.sprQueue.length) {
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
      if (!e || this.frame - e.used > 90) {
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
    return `tiles ${used}/${this.byLayer.length} empty ${empty} queue ${this.queue.size} busy ${this.inFlight} painted ${this.painted} (${(this.paintMs / Math.max(1, this.painted)).toFixed(1)} ms) evicted ${this.evicted} sprites ${this.sprPainted} (${(this.sprMs / Math.max(1, this.sprPainted)).toFixed(1)} ms)`;
  }
}

/** Tile index range covering art px [a, b). */
export function tileRange(a: number, b: number): [number, number] {
  return [Math.floor(a / TILE), Math.floor((b - 1) / TILE)];
}

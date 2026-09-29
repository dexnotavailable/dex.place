// Debris: rigid chunks (small cell grids that fall, bounce, spin and settle
// into rubble) and single-pixel particles (debris, dust, sparks, glints,
// smoke, embers, motes). Debris keeps its real colours: a chunk is the actual
// cells that were there; a particle carries the colour its cell had.

import { CellGrid } from "./cells.ts";
import { matById } from "./materials.ts";
import { Part } from "./part.ts";
import { EASE } from "./util.ts";

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

export const P_ADD = 1; // additive (light layer)
export const P_GRAV = 2; // falls
export const P_SETTLE = 4; // lands on the ground and stays until its life ends
export const P_FADE = 8; // dithers out over the last third of its life
export const P_DRAG = 16; // air drag
export const P_RISE = 32; // buoyant (smoke, motes)
export const P_HOME = 64; // flies back to a cell and restores it (assemble)

export interface ParticleSpec {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life: number;
  rgb: [number, number, number];
  flags: number;
  size?: 1 | 2;
  home?: { part: Part; idx: number; delay?: number; dur?: number };
}

export interface GroundQuery {
  solidAt(x: number, y: number): boolean;
}

export class Particles {
  readonly cap: number;
  n = 0;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  life: Float32Array;
  max: Float32Array;
  rgb: Uint32Array;
  flags: Uint8Array;
  size: Uint8Array;
  hPart: (Part | null)[];
  hIdx: Int32Array;
  hT: Float32Array;
  hDur: Float32Array;
  hSx: Float32Array;
  hSy: Float32Array;
  /** Spawn attempts dropped because the pool was full. */
  dropped = 0;

  constructor(cap = 6000) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.rgb = new Uint32Array(cap);
    this.flags = new Uint8Array(cap);
    this.size = new Uint8Array(cap);
    this.hPart = new Array(cap).fill(null);
    this.hIdx = new Int32Array(cap);
    this.hT = new Float32Array(cap);
    this.hDur = new Float32Array(cap);
    this.hSx = new Float32Array(cap);
    this.hSy = new Float32Array(cap);
  }

  spawn(s: ParticleSpec): number {
    let i = this.n;
    if (i >= this.cap) {
      // full: replace the oldest non-homing particle
      let best = -1, bl = Infinity;
      for (let k = 0; k < this.n; k += 7) {
        if (this.flags[k]! & P_HOME) continue;
        if (this.life[k]! < bl) { bl = this.life[k]!; best = k; }
      }
      if (best < 0) { this.dropped++; return -1; }
      i = best;
    } else this.n++;
    this.x[i] = s.x;
    this.y[i] = s.y;
    this.vx[i] = s.vx ?? 0;
    this.vy[i] = s.vy ?? 0;
    this.life[i] = s.life;
    this.max[i] = s.life;
    this.rgb[i] = (s.rgb[0] << 16) | (s.rgb[1] << 8) | s.rgb[2];
    this.flags[i] = s.flags;
    this.size[i] = s.size ?? 1;
    this.hPart[i] = s.home?.part ?? null;
    this.hIdx[i] = s.home?.idx ?? -1;
    this.hT[i] = -(s.home?.delay ?? 0);
    this.hDur[i] = s.home?.dur ?? 0.8;
    return i;
  }

  /** Send every particle that came from `part` home (assemble). */
  homeAll(part: Part, delayMax: number, dur: number, rand: () => number): number {
    let n = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.hPart[i] !== part || this.flags[i]! & P_HOME) continue;
      this.flags[i] = (this.flags[i]! | P_HOME) & ~(P_GRAV | P_SETTLE | P_FADE);
      this.hT[i] = -rand() * delayMax;
      this.hDur[i] = dur * (0.7 + rand() * 0.6);
      this.life[i] = 1e9;
      n++;
    }
    return n;
  }

  private kill(i: number): void {
    const j = --this.n;
    if (i !== j) {
      this.x[i] = this.x[j]!;
      this.y[i] = this.y[j]!;
      this.vx[i] = this.vx[j]!;
      this.vy[i] = this.vy[j]!;
      this.life[i] = this.life[j]!;
      this.max[i] = this.max[j]!;
      this.rgb[i] = this.rgb[j]!;
      this.flags[i] = this.flags[j]!;
      this.size[i] = this.size[j]!;
      this.hPart[i] = this.hPart[j]!;
      this.hIdx[i] = this.hIdx[j]!;
      this.hT[i] = this.hT[j]!;
      this.hDur[i] = this.hDur[j]!;
      this.hSx[i] = this.hSx[j]!;
      this.hSy[i] = this.hSy[j]!;
    }
    this.hPart[j] = null;
  }

  step(dt: number, gravity: number, ground: GroundQuery, wind?: (x: number, y: number) => [number, number]): void {
    for (let i = this.n - 1; i >= 0; i--) {
      const f = this.flags[i]!;
      if (f & P_HOME) {
        const part = this.hPart[i];
        if (!part) { this.kill(i); continue; }
        if (this.hT[i]! < 0) {
          this.hT[i] = this.hT[i]! + dt;
          if (this.hT[i]! >= 0) { this.hSx[i] = this.x[i]!; this.hSy[i] = this.y[i]!; }
          // hover while waiting
          this.vx[i] = this.vx[i]! * 0.85;
          this.vy[i] = this.vy[i]! * 0.85 - 4 * dt;
          this.x[i] = this.x[i]! + this.vx[i]! * dt;
          this.y[i] = this.y[i]! + this.vy[i]! * dt;
          continue;
        }
        this.hT[i] = this.hT[i]! + dt;
        const k = Math.min(1, this.hT[i]! / this.hDur[i]!);
        const [tx, ty] = part.cellWorld(this.hIdx[i]!);
        const e = EASE.inOutCubic!(k);
        const arc = Math.sin(k * Math.PI) * 10;
        this.x[i] = this.hSx[i]! + (tx - 0.5 - this.hSx[i]!) * e;
        this.y[i] = this.hSy[i]! + (ty - 0.5 - this.hSy[i]!) * e - arc;
        if (k >= 1) {
          part.grid.restoreRaw(this.hIdx[i]!);
          this.kill(i);
        }
        continue;
      }
      this.life[i] = this.life[i]! - dt;
      if (this.life[i]! <= 0) { this.kill(i); continue; }
      let vx = this.vx[i]!, vy = this.vy[i]!;
      if (f & P_GRAV) vy += gravity * dt;
      if (f & P_RISE) vy -= gravity * 0.02 * dt;
      if (f & P_DRAG) { vx *= Math.pow(0.08, dt); vy *= Math.pow(0.08, dt); }
      if (wind && f & (P_RISE | P_DRAG)) {
        const [wx, wy] = wind(this.x[i]!, this.y[i]!);
        vx += wx * dt * 0.02;
        vy += wy * dt * 0.02;
      }
      let nx = this.x[i]! + vx * dt, ny = this.y[i]! + vy * dt;
      if (f & P_SETTLE && vy > 0 && ground.solidAt(nx, ny)) {
        // land: slide back up out of the ground and stop
        let up = 0;
        while (up < 6 && ground.solidAt(nx, ny - up - 1)) up++;
        ny = Math.floor(ny - up) - 0.01;
        if (Math.abs(vy) > 90) { vy = -vy * 0.25; vx *= 0.5; }
        else { vx = 0; vy = 0; this.flags[i] = f & ~P_GRAV; }
      }
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.x[i] = nx;
      this.y[i] = ny;
    }
  }
}

// ---------------------------------------------------------------------------
// Rigid chunks
// ---------------------------------------------------------------------------

export interface ChunkHome {
  part: Part;
  /** Raw indices in the parent grid, same order as `cells` in the chunk. */
  cells: Int32Array;
  /** Logical offset of the chunk grid's (0,0) inside the parent. */
  ox: number;
  oy: number;
}

/** A chunk this close above the ground (px) is touching it. */
const TOUCH = 1;
/** Where a pushed-out chunk rests: just above the surface. */
const REST_GAP = 0.01;

/** The surface y above a point that is inside the ground (fractional, 1/32 px). */
function surfaceAbove(ground: GroundQuery, x: number, y: number): number {
  let up = 0;
  while (up < 12 && ground.solidAt(x, y - up - 1)) up++;
  // the boundary lies between y - up - 1 (open) and y - up (solid)
  let lo = y - up - 1, hi = y - up;
  for (let k = 0; k < 5; k++) {
    const m = (lo + hi) / 2;
    if (ground.solidAt(x, m)) hi = m;
    else lo = m;
  }
  return hi;
}

export class Chunk extends Part {
  vx = 0;
  vy = 0;
  vr = 0;
  asleep = false;
  still = 0;
  /** Seconds since the last support check while asleep. */
  check = 0;
  age = 0;
  bounce = 0.3;
  friction = 0.45;
  home: ChunkHome | null = null;
  homing: { t: number; dur: number; sx: number; sy: number; sr: number } | null = null;
  /** Hull sample points (local, logical) for ground contact. */
  hull: [number, number][] = [];

  constructor(grid: CellGrid, pivotX: number, pivotY: number) {
    super("chunk", grid, pivotX, pivotY, { layer: "mid", smoothRotate: true });
    this.worldSpace = true;
    this.hittable = false;
    this.computeHull();
    let bounce = 0, fr = 0, n = 0;
    for (let i = 0; i < grid.mat.length; i++) {
      const m = grid.mat[i] ? matById(grid.mat[i]!) : undefined;
      if (!m) continue;
      bounce += m.bounce ?? 0.3;
      fr += m.friction ?? 0.45;
      n++;
    }
    if (n) { this.bounce = bounce / n; this.friction = fr / n; }
  }

  computeHull(): void {
    const g = this.grid;
    const b = g.bounds();
    this.hull = [];
    if (!b) return;
    // extreme cells in 8 directions
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [dx, dy] of dirs) {
      let best: [number, number] = [0, 0], bv = -Infinity;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        if (!g.solid(x, y)) continue;
        const v = (x + 0.5) * dx + (y + 0.5) * dy;
        if (v > bv) { bv = v; best = [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5]; }
      }
      this.hull.push(best);
    }
  }

  /** Stop simulating (velocities zero; nothing moves until a hit or lost support wakes it). */
  sleep(): void {
    this.asleep = true;
    this.vx = this.vy = this.vr = 0;
    this.still = 0;
    this.check = 0;
  }

  wake(): void {
    this.asleep = false;
    this.still = 0;
  }

  /**
   * Is the chunk still lying on something, and not buried? Uses the same
   * touch rule as the step; "buried" looks only at the lowest hull points, so
   * a chunk leaning on a wall does not keep waking itself.
   */
  resting(ground: GroundQuery): boolean {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const pts: [number, number][] = [];
    let low = -Infinity, touch = false;
    for (const [hx, hy] of this.hull) {
      const dx = (hx - this.pivotX) * this.flip, dy = hy - this.pivotY;
      const wx = this.x + c * dx - s * dy, wy = this.y + s * dx + c * dy;
      pts.push([wx, wy]);
      if (wy > low) low = wy;
      if (ground.solidAt(wx, wy) || ground.solidAt(wx, wy + TOUCH)) touch = true;
    }
    if (!touch) return false;
    for (const [wx, wy] of pts) if (wy > low - 1.5 && ground.solidAt(wx, wy - 1)) return false;
    return true;
  }

  step(dt: number, gravity: number, ground: GroundQuery, roomW: number): void {
    this.age += dt;
    if (this.homing) {
      const h = this.homing;
      if (!this.home) { this.homing = null; return; }
      h.t += dt;
      if (h.t < 0) return;
      const k = Math.min(1, h.t / h.dur);
      const e = EASE.inOutCubic!(k);
      const part = this.home.part;
      const [tx, ty] = part.toWorld(this.home.ox + this.pivotX, this.home.oy + this.pivotY);
      this.x = h.sx + (tx - h.sx) * e;
      this.y = h.sy + (ty - h.sy) * e - Math.sin(k * Math.PI) * 18;
      let dr = part.wrot - h.sr;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      this.rot = h.sr + dr * e;
      return;
    }
    if (this.asleep) {
      // asleep costs nothing but a support check a few times a second: if the
      // ground under it goes (a crater, a broken ledge) or grows into it
      // (healing), it wakes and settles again
      this.check += dt;
      if (this.check >= 0.2) {
        this.check = 0;
        if (!this.resting(ground)) this.wake();
      }
      return;
    }
    this.vy += gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
    // ground contact through the hull points. A point inside the ground is
    // pushed out by its real (fractional) depth; a point resting within 1 px
    // above the ground counts as touching, so a chunk at rest stays in
    // contact every frame instead of hopping out and falling back in.
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    let pen = 0, contactX = 0, n = 0;
    for (const [hx, hy] of this.hull) {
      const dx = (hx - this.pivotX) * this.flip, dy = hy - this.pivotY;
      const wx = this.x + c * dx - s * dy, wy = this.y + s * dx + c * dy;
      if (ground.solidAt(wx, wy)) {
        const d = wy - surfaceAbove(ground, wx, wy) + REST_GAP;
        if (d > pen) pen = d;
      } else if (!ground.solidAt(wx, wy + TOUCH)) continue;
      contactX += wx;
      n++;
    }
    if (n) {
      this.y -= pen;
      contactX /= n;
      if (this.vy > 0) this.vy = -this.vy * this.bounce;
      if (Math.abs(this.vy) < 30) this.vy = 0;
      this.vx *= 1 - this.friction * Math.min(1, dt * 20);
      // settle flat: spring to the nearest quarter turn, then lock there
      const snap = Math.round(this.rot / (Math.PI / 2)) * (Math.PI / 2);
      const off = snap - this.rot;
      if (Math.abs(off) < 0.02 && Math.abs(this.vr) < 1.5) {
        this.rot = snap;
        this.vr = 0;
      } else {
        // a fast chunk keeps some tumble from the contact; a slow one turns to lie flat
        const tip = Math.abs(this.vx) > 40 ? (this.x - contactX) * 0.02 : 0;
        this.vr += (off * 9 + tip - this.vr) * Math.min(1, dt * 14);
      }
    }
    if (this.x < 0 || this.x > roomW) {
      this.x = Math.max(0, Math.min(roomW, this.x));
      this.vx = -this.vx * 0.4;
    }
    const moving = Math.abs(this.vx) + Math.abs(this.vy) > 8 || Math.abs(this.vr) > 0.25;
    if (n && !moving) {
      this.still += dt;
      if (this.still > 0.35) this.sleep();
    } else if (moving || Math.abs(this.vy) > 40) this.still = 0;
    if (this.y > 1e5) this.asleep = true;
  }
}

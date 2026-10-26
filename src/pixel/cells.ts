// Cell data: every pixel of a prop is a cell the game owns. A grid stores,
// per cell: material, tone offset (details, cracks, wear), piece (which part
// or chunk it belongs to; higher pieces sit in front for inner lines), flags,
// surface height (-> normal for lighting), health and age.
//
// Coordinates are "logical": (0,0) is the top-left of the drawable area. The
// arrays carry a transparent pad around it so outlines have room to draw.

export const F_NOINK = 1; // no inner line / outline from this cell
export const F_CRACK = 2; // crack line (darker, spreads)
export const F_SCORCH = 4; // burnt / scorched
export const F_FRESH = 8; // just restored (brief highlight while healing)
export const F_HOT = 16; // glowing edge (burn front)
export const F_ADDED = 32; // not part of the original (crater rim, dropped rubble)
export const F_NOHIT = 64; // ignores hits

export const PAD = 2;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CellSnapshot {
  mat: Uint8Array;
  tone: Int8Array;
  piece: Uint8Array;
  flags: Uint8Array;
  height: Float32Array;
}

export class CellGrid {
  /** Logical size. */
  readonly w: number;
  readonly h: number;
  /** Raw (padded) size. */
  readonly W: number;
  readonly Hh: number;
  readonly pad: number;
  readonly mat: Uint8Array;
  readonly tone: Int8Array;
  readonly piece: Uint8Array;
  readonly flags: Uint8Array;
  readonly height: Float32Array;
  readonly hp: Float32Array;
  readonly age: Float32Array;
  readonly nrm: Float32Array;
  /** Dirty region in raw coordinates (needs normals + upload). */
  dirty: Rect | null = null;
  /** Bumped when cells appear or disappear (rotation index maps rebuild). */
  shapeVersion = 0;
  /** Bumped on every change (renderer upload check). */
  version = 0;
  orig: CellSnapshot | null = null;
  /** Solid cell count (kept current by set/clear). */
  count = 0;

  constructor(w: number, h: number, pad = PAD) {
    this.w = Math.max(1, Math.ceil(w));
    this.h = Math.max(1, Math.ceil(h));
    this.pad = pad;
    this.W = this.w + pad * 2;
    this.Hh = this.h + pad * 2;
    const n = this.W * this.Hh;
    this.mat = new Uint8Array(n);
    this.tone = new Int8Array(n);
    this.piece = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    this.height = new Float32Array(n);
    this.hp = new Float32Array(n);
    this.age = new Float32Array(n);
    this.nrm = new Float32Array(n * 3);
  }

  /** Raw index of logical (x, y), or -1 outside the grid (pad included). */
  idx(x: number, y: number): number {
    const X = Math.floor(x) + this.pad;
    const Y = Math.floor(y) + this.pad;
    if (X < 0 || Y < 0 || X >= this.W || Y >= this.Hh) return -1;
    return Y * this.W + X;
  }

  /** Raw index inside the drawable area only. */
  inner(x: number, y: number): number {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return -1;
    return (Y + this.pad) * this.W + X + this.pad;
  }

  solid(x: number, y: number): boolean {
    const i = this.idx(x, y);
    return i >= 0 && this.mat[i]! !== 0;
  }

  /** Raw index -> logical x, y. */
  lx(i: number): number {
    return (i % this.W) - this.pad;
  }
  ly(i: number): number {
    return Math.floor(i / this.W) - this.pad;
  }

  markRaw(i: number): void {
    const X = i % this.W;
    const Y = (i / this.W) | 0;
    const d = this.dirty;
    if (!d) this.dirty = { x0: X, y0: Y, x1: X, y1: Y };
    else {
      if (X < d.x0) d.x0 = X;
      if (X > d.x1) d.x1 = X;
      if (Y < d.y0) d.y0 = Y;
      if (Y > d.y1) d.y1 = Y;
    }
    this.version++;
  }

  markAll(): void {
    this.dirty = { x0: 0, y0: 0, x1: this.W - 1, y1: this.Hh - 1 };
    this.version++;
    this.shapeVersion++;
  }

  /** Write a cell by raw index. */
  setRaw(i: number, m: number, tone = 0, piece = 1, height = 1, flags = 0, hp = 1): void {
    const was = this.mat[i]!;
    if (!was && m) this.count++;
    else if (was && !m) this.count--;
    if (!was !== !m) this.shapeVersion++;
    this.mat[i] = m;
    this.tone[i] = tone;
    this.piece[i] = piece;
    this.height[i] = height;
    this.flags[i] = flags;
    this.hp[i] = hp;
    this.age[i] = 0;
    this.markRaw(i);
  }

  clearRaw(i: number): void {
    if (!this.mat[i]) return;
    this.mat[i] = 0;
    this.flags[i] = 0;
    this.tone[i] = 0;
    this.height[i] = 0;
    this.count--;
    this.shapeVersion++;
    this.markRaw(i);
  }

  /** Remember the current cells as the original (restore / heal target). */
  snapshot(): void {
    this.orig = {
      mat: this.mat.slice(),
      tone: this.tone.slice(),
      piece: this.piece.slice(),
      flags: this.flags.slice(),
      height: this.height.slice(),
    };
  }

  /** Does this cell differ from the original? */
  differs(i: number): boolean {
    const o = this.orig;
    if (!o) return false;
    return o.mat[i] !== this.mat[i] || o.tone[i] !== this.tone[i] || Math.abs(o.height[i]! - this.height[i]!) > 0.01 || (o.flags[i]! & ~F_FRESH) !== (this.flags[i]! & ~F_FRESH);
  }

  /** Put the original cell back. */
  restoreRaw(i: number, fresh = true): void {
    const o = this.orig;
    if (!o) return;
    const m = o.mat[i]!;
    const was = this.mat[i]!;
    if (!was && m) this.count++;
    else if (was && !m) this.count--;
    if (!was !== !m) this.shapeVersion++;
    this.mat[i] = m;
    this.tone[i] = o.tone[i]!;
    this.piece[i] = o.piece[i]!;
    this.flags[i] = o.flags[i]! | (fresh && m ? F_FRESH : 0);
    this.height[i] = o.height[i]!;
    this.hp[i] = 1;
    this.age[i] = 0;
    this.markRaw(i);
  }

  restoreAll(): void {
    const o = this.orig;
    if (!o) return;
    this.mat.set(o.mat);
    this.tone.set(o.tone);
    this.piece.set(o.piece);
    this.flags.set(o.flags);
    this.height.set(o.height);
    this.hp.fill(1);
    this.age.fill(0);
    this.recount();
    this.markAll();
  }

  /**
   * Empty every cell (dynamic parts re-rasterise from scratch). Only the
   * rect that held cells is marked dirty, so a flame or a swinging rope
   * uploads its own few rows, not its whole grid.
   */
  clearAll(): void {
    const { W, mat } = this;
    let x0 = W, y0 = this.Hh, x1 = -1, y1 = -1;
    for (let i = 0; i < mat.length; i++) {
      if (!mat[i]) continue;
      const X = i % W, Y = (i / W) | 0;
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
    if (x1 < 0) return;
    this.mat.fill(0);
    this.flags.fill(0);
    this.tone.fill(0);
    this.height.fill(0);
    this.count = 0;
    this.markRect(x0, y0, x1, y1);
    this.shapeVersion++;
  }

  /** Mark a raw-coordinate rect dirty (union with what is already dirty). */
  markRect(x0: number, y0: number, x1: number, y1: number): void {
    const d = this.dirty;
    if (!d) this.dirty = { x0, y0, x1, y1 };
    else {
      if (x0 < d.x0) d.x0 = x0;
      if (y0 < d.y0) d.y0 = y0;
      if (x1 > d.x1) d.x1 = x1;
      if (y1 > d.y1) d.y1 = y1;
    }
    this.version++;
  }

  recount(): void {
    let c = 0;
    for (let i = 0; i < this.mat.length; i++) if (this.mat[i]) c++;
    this.count = c;
  }

  /** Bounds of solid cells in logical coords, or null. */
  bounds(): Rect | null {
    let x0 = this.W, y0 = this.Hh, x1 = -1, y1 = -1;
    const { W, mat } = this;
    for (let i = 0; i < mat.length; i++) {
      if (!mat[i]) continue;
      const X = i % W, Y = (i / W) | 0;
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
    if (x1 < 0) return null;
    return { x0: x0 - this.pad, y0: y0 - this.pad, x1: x1 - this.pad, y1: y1 - this.pad };
  }

  /**
   * Normals from heights over the dirty region (plus a 1-cell margin).
   * Neighbours: empty -> the edge drops by at most 3 (flat panels get a soft
   * rounded edge, domes already fall to ~0); a piece in front of this one
   * counts as level (no false edge).
   */
  computeNormals(r: Rect | null = this.dirty): void {
    if (!r) return;
    const { W, Hh, mat, height, piece, nrm } = this;
    const x0 = Math.max(0, r.x0 - 1), y0 = Math.max(0, r.y0 - 1);
    const x1 = Math.min(W - 1, r.x1 + 1), y1 = Math.min(Hh - 1, r.y1 + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (!mat[i]) {
          nrm[i * 3] = 0;
          nrm[i * 3 + 1] = 0;
          nrm[i * 3 + 2] = 1;
          continue;
        }
        const h = height[i]!;
        const p = piece[i]!;
        const nb = (j: number, ok: boolean): number => {
          if (!ok || !mat[j]) return h - Math.min(h, 3);
          if (piece[j]! > p) return h;
          return height[j]!;
        };
        const hl = nb(i - 1, x > 0), hr = nb(i + 1, x < W - 1);
        const hu = nb(i - W, y > 0), hd = nb(i + W, y < Hh - 1);
        let nx = -(hr - hl) * 0.5, ny = -(hd - hu) * 0.5;
        const nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nrm[i * 3] = nx;
        nrm[i * 3 + 1] = ny;
        nrm[i * 3 + 2] = nz / l;
      }
    }
  }

  /** Copy of the given raw cells into a fresh tight grid (chunks). */
  extract(cells: number[]): { grid: CellGrid; ox: number; oy: number } {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of cells) {
      const X = i % this.W, Y = (i / this.W) | 0;
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
    const g = new CellGrid(x1 - x0 + 1, y1 - y0 + 1);
    for (const i of cells) {
      const X = i % this.W, Y = (i / this.W) | 0;
      const j = g.inner(X - x0, Y - y0);
      g.setRaw(j, this.mat[i]!, this.tone[i]!, this.piece[i]!, this.height[i]!, this.flags[i]! & ~F_FRESH, this.hp[i]!);
    }
    g.computeNormals();
    // logical origin of the chunk inside this grid
    return { grid: g, ox: x0 - this.pad, oy: y0 - this.pad };
  }
}

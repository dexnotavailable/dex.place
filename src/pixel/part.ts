// A part: one cell grid with its own pivot, transform and layer. Props are
// made of parts (a banner and its rod, a lamp housing and its glow); broken
// chunks and rope/cloth renders are parts too.

import type { CellGrid, Rect } from "./cells.ts";
import type { Prop } from "./prop.ts";

export type LayerName = "far" | "bg" | "mid" | "decal" | "fg" | "light";
/** Draw order. Actors (the player, mobs) go between "decal" and "fg". */
export const LAYERS: LayerName[] = ["far", "bg", "mid", "decal", "fg", "light"];
export const LAYER_PARALLAX: Record<LayerName, number> = { far: 0.25, bg: 1, mid: 1, decal: 1, fg: 1.12, light: 1 };

/** solid: blocks; platform: stand on from above; trigger: E / overlap only; none. */
export type Collide = "solid" | "platform" | "none" | "trigger";

export interface PartOptions {
  layer?: LayerName;
  z?: number;
  parallax?: number;
  /** 0 none, 1 full (line + lit-side selout), 2 soft (selout only, for distant parts). */
  outline?: 0 | 1 | 2;
  /** 0 = unlit (flat ramp), 1 = full lighting. */
  lit?: number;
  collide?: Collide;
  hittable?: boolean;
  /** The ground: craters, scars and healing apply; debris lands on it. */
  ground?: boolean;
  /** Pixel-art-safe rotation (Scale2x x2 index map) for parts that turn. */
  smoothRotate?: boolean;
  /** Decal: only draw where this part (or the ground under it) has cells. */
  mask?: Part | "ground" | null;
  fog?: [number, number, number, number];
  visible?: boolean;
}

export class Part {
  readonly name: string;
  grid: CellGrid;
  prop: Prop | null = null;
  parent: Part | null = null;
  /** Pivot position: prop-local (prop parts), parent-local (children) or world (worldSpace). */
  x = 0;
  y = 0;
  /** Animation offsets (added to x, y). */
  offX = 0;
  offY = 0;
  rot = 0;
  flip: 1 | -1 = 1;
  /** Pivot inside the grid (logical coords). */
  pivotX: number;
  pivotY: number;
  worldSpace = false;
  // computed world transform
  wx = 0;
  wy = 0;
  wrot = 0;
  wflip: 1 | -1 = 1;

  layer: LayerName = "mid";
  z = 0;
  parallax = 1;
  outline: 0 | 1 | 2 = 1;
  lit = 1;
  /** Backlight strength for glow materials (stained glass, screens). */
  glow = 1;
  /** Rim-light strength (0 for thin parts like ropes, where every pixel is an edge). */
  rim = 1;
  /** Emissive tone shift (-3..3): flames brighter/dimmer. */
  heat = 0;
  collide: Collide = "none";
  hittable = true;
  ground = false;
  visible = true;
  smoothRotate = false;
  mask: Part | "ground" | null = null;
  fog: [number, number, number, number] = [0, 0, 0, 0];
  /** Fraction of cells hidden by the dither dissolve (0 visible .. 1 gone). */
  dissolve = 0;
  /** 0: ordered (Bayer) dissolve, 1: noise (organic), 2: sweep bottom-up. */
  dissolveMode: 0 | 1 | 2 = 0;
  /** Hit flash amount (0..1) and colour. */
  flash = 0;
  flashRgb: [number, number, number] = [1, 0.96, 0.9];
  /** Glint sweep position 0..1 across the part (<0 off). */
  glintT = -1;
  /** 1 px shake while disturbed (whole pixels). */
  shake = 0;
  /** Re-rasterise the grid each frame (ropes, cloth, flames). */
  dynamic: ((part: Part, dt: number) => void) | null = null;
  /** Run `dynamic` only every Nth step (a flame at 15 Hz: 4); parts out of view wait regardless. */
  dynamicEvery = 1;
  /** Offset so throttled parts don't all redraw on the same step. */
  dynamicPhase = 0;
  /** Renderer-owned GPU state. */
  gpu: unknown = null;
  /** Per-part metadata for recipes. */
  tag: Record<string, unknown> = {};

  constructor(name: string, grid: CellGrid, pivotX = 0, pivotY = 0, o: PartOptions = {}) {
    this.name = name;
    this.grid = grid;
    this.pivotX = pivotX;
    this.pivotY = pivotY;
    this.apply(o);
  }

  apply(o: PartOptions): this {
    if (o.layer) {
      this.layer = o.layer;
      this.parallax = o.parallax ?? LAYER_PARALLAX[o.layer];
    }
    if (o.parallax !== undefined) this.parallax = o.parallax;
    if (o.z !== undefined) this.z = o.z;
    if (o.outline !== undefined) this.outline = o.outline;
    if (o.lit !== undefined) this.lit = o.lit;
    if (o.collide) this.collide = o.collide;
    if (o.hittable !== undefined) this.hittable = o.hittable;
    if (o.ground !== undefined) this.ground = o.ground;
    if (o.smoothRotate !== undefined) this.smoothRotate = o.smoothRotate;
    if (o.mask !== undefined) this.mask = o.mask;
    if (o.fog) this.fog = o.fog;
    if (o.visible !== undefined) this.visible = o.visible;
    return this;
  }

  /** Recompute the world transform from the prop / parent. */
  updateTransform(): void {
    if (this.parent) {
      const p = this.parent;
      const [x, y] = p.toWorld(this.x + this.offX, this.y + this.offY);
      this.wx = x;
      this.wy = y;
      this.wrot = p.wrot + this.rot * p.wflip;
      this.wflip = (p.wflip * this.flip) as 1 | -1;
    } else if (this.prop && !this.worldSpace) {
      const pr = this.prop;
      this.wx = pr.x + (this.x + this.offX) * pr.flip;
      this.wy = pr.y + this.y + this.offY;
      this.wrot = this.rot * pr.flip;
      this.wflip = (pr.flip * this.flip) as 1 | -1;
    } else {
      this.wx = this.x + this.offX;
      this.wy = this.y + this.offY;
      this.wrot = this.rot;
      this.wflip = this.flip;
    }
    // whole pixels: nothing ever sits on a sub-pixel position
    this.wx = Math.round(this.wx);
    this.wy = Math.round(this.wy);
  }

  /** Local (logical grid) -> world. */
  toWorld(lx: number, ly: number): [number, number] {
    const dx = (lx - this.pivotX) * this.wflip, dy = ly - this.pivotY;
    const c = Math.cos(this.wrot), s = Math.sin(this.wrot);
    return [this.wx + c * dx - s * dy, this.wy + s * dx + c * dy];
  }

  /** World -> local (logical grid). */
  toLocal(x: number, y: number): [number, number] {
    const dx = x - this.wx, dy = y - this.wy;
    const c = Math.cos(this.wrot), s = Math.sin(this.wrot);
    const lx = c * dx + s * dy, ly = -s * dx + c * dy;
    return [lx * this.wflip + this.pivotX, ly + this.pivotY];
  }

  /** World AABB of the whole grid area (not only solid cells). */
  worldBounds(): Rect {
    const g = this.grid;
    const pts = [this.toWorld(-1, -1), this.toWorld(g.w + 1, -1), this.toWorld(-1, g.h + 1), this.toWorld(g.w + 1, g.h + 1)];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }

  /** Raw cell index at a world point, or -1 (empty or outside). */
  cellAt(x: number, y: number): number {
    const [lx, ly] = this.toLocal(x, y);
    const i = this.grid.idx(lx, ly);
    return i >= 0 && this.grid.mat[i] ? i : -1;
  }

  /** World centre of a raw cell. */
  cellWorld(i: number): [number, number] {
    return this.toWorld(this.grid.lx(i) + 0.5, this.grid.ly(i) + 0.5);
  }
}

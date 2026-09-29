// Stub pixel-matter engine: implements src/world/props-api.ts with a small
// cell rasteriser so rooms can place real, stateful, lit props before the
// engine in src/pixel lands. It follows the same model in miniature:
//
// - a recipe fills a Cells grid (material, height profile, piece, tone) from
//   shapes: rect, ellipse, polygon, stroke, and ASCII grids for small ornaments;
// - each piece bakes to an albedo + normal texture (3-4 colour material ramps
//   with hue-shifted shadows, a 1 px ink outline marked in the normal's alpha
//   per the sprite contract) and is drawn through the world renderer's sprite
//   shader, so props are lit exactly like the player: key light, effect
//   lights, rim;
// - motion is pixel-safe: whole-pixel offsets, and row shear for sway and
//   small swings (crisp, never resampled); cloth is per-row shear driven by
//   wind and pushes;
// - states swap which pieces show and how they move; nothing is an image file.
//
// What the stub does NOT do yet (the real engine's job): per-cell damage,
// carving, fracture into rigid chunks, healing floors, dissolve/assemble.
// Hits here shake, swing, flicker, cut and spark.

import type {
  Box,
  CellTexture,
  Interaction,
  PixelMatterEngine,
  Prop,
  PropCanvas,
  PropCollision,
  PropHit,
  PropLayer,
  PropLight,
  PropMaterial,
  PropParams,
  PropRecipe,
  PropWorld,
} from "../props-api.ts";

type RGB8 = [number, number, number];
const hx = (h: string): RGB8 => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Material ramps, darkest first (muted world palette; the player stays the brightest thing). */
export const RAMPS: Record<PropMaterial, string[]> = {
  stone: ["#211f26", "#34313b", "#4b4752", "#686370", "#8a8591"],
  wood: ["#1f1511", "#33241b", "#4b3526", "#664a34", "#846447"],
  iron: ["#15171d", "#23272f", "#363c47", "#525a68", "#7b8494"],
  gold: ["#4a2e0e", "#76501a", "#a87a26", "#d6a640", "#f4d57e"],
  brass: ["#3a2a12", "#5e4520", "#88672f", "#b38e48", "#d8b770"],
  cloth: ["#2e1012", "#4d1b1c", "#712a27", "#943c33", "#b35a45"],
  wax: ["#7a705e", "#a0957c", "#c3b799", "#ddd2b4", "#f1e9d0"],
  flame: ["#b0481a", "#e8872e", "#ffc35c", "#ffe7a0", "#fffbe8"],
  foliage: ["#172019", "#243325", "#354733", "#4c5e44", "#6a7a58"],
  paper: ["#6e685c", "#948c7a", "#b6ad96", "#d4ccb4", "#ece6d2"],
  rope: ["#2c2117", "#463526", "#624b35", "#7f6547", "#9c825e"],
  bone: ["#57544c", "#77736a", "#99948a", "#bab5a8", "#d6d1c3"],
  water: ["#132629", "#1c3a3c", "#2a5250", "#3e6d68", "#5e8f86"],
  glass: ["#16242c", "#233a46", "#36566a", "#57808e", "#8fb3b8"],
  plaster: ["#3b3631", "#524c45", "#6b645b", "#877f74", "#a39b8e"],
};
const INK = hx("#07070b");

/** Height profiles give a shape its normals (PIXEL-MATTER "Shapes"). */
export type Profile = "flat" | "round" | "bevel" | "cylinder" | "dome";

export interface ShapeOpts {
  profile?: Profile;
  piece?: number;
  /** -2..2 ramp steps (darker / lighter). */
  tone?: number;
  /** Colour override ramp (hex, darkest first). */
  ramp?: string[];
  emissive?: boolean;
}

interface Paint {
  mat: number;
  tone: number;
  emissive: boolean;
}

/** A prop's cell grid. Coordinates are local px, (0,0) top-left. */
export class Cells {
  readonly mat: Int16Array;
  readonly height: Float32Array;
  readonly piece: Uint8Array;
  readonly tone: Int8Array;
  readonly emis: Uint8Array;
  /** Custom ramps registered by shapes (index = 100 + i in mat). */
  readonly ramps: string[][] = [];
  constructor(readonly w: number, readonly h: number) {
    const n = w * h;
    this.mat = new Int16Array(n).fill(-1);
    this.height = new Float32Array(n);
    this.piece = new Uint8Array(n);
    this.tone = new Int8Array(n);
    this.emis = new Uint8Array(n);
  }

  private matId(m: PropMaterial, o: ShapeOpts): number {
    if (o.ramp) {
      this.ramps.push(o.ramp);
      return 100 + this.ramps.length - 1;
    }
    return MATS.indexOf(m);
  }

  private put(x: number, y: number, p: Paint, hgt: number, piece: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.mat[i] = p.mat;
    this.tone[i] = p.tone;
    this.emis[i] = p.emissive ? 1 : 0;
    this.height[i] = hgt;
    this.piece[i] = piece;
  }

  /** Fill with a height profile from a distance-to-edge function (d in px, r = half-size along the profile axis). */
  private fill(x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, m: PropMaterial, o: ShapeOpts, prof: (x: number, y: number) => number): void {
    const p: Paint = { mat: this.matId(m, o), tone: o.tone ?? 0, emissive: !!o.emissive };
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++)
        if (inside(x + 0.5, y + 0.5)) this.put(x, y, p, prof(x + 0.5, y + 0.5), o.piece ?? 0);
  }

  rect(x: number, y: number, w: number, h: number, m: PropMaterial, o: ShapeOpts = {}): this {
    const pr = o.profile ?? "bevel";
    this.fill(x, y, x + w, y + h, () => true, m, o, (px, py) => {
      const dx = Math.min(px - x, x + w - px);
      const dy = Math.min(py - y, y + h - py);
      if (pr === "flat") return 0.5;
      if (pr === "cylinder") return Math.sqrt(Math.max(0, 1 - Math.pow((px - x - w / 2) / (w / 2), 2)));
      if (pr === "round" || pr === "dome") return Math.min(1, Math.min(dx, dy) / Math.max(1.5, Math.min(w, h) / 2));
      return Math.min(1, Math.min(dx, dy) / 1.5);
    });
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, m: PropMaterial, o: ShapeOpts = {}): this {
    this.fill(cx - rx, cy - ry, cx + rx, cy + ry, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, m, o, (px, py) => {
      const d = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
      return (o.profile ?? "dome") === "flat" ? 0.5 : Math.sqrt(Math.max(0, 1 - d));
    });
    return this;
  }

  poly(pts: number[], m: PropMaterial, o: ShapeOpts = {}): this {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]!); maxX = Math.max(maxX, pts[i]!);
      minY = Math.min(minY, pts[i + 1]!); maxY = Math.max(maxY, pts[i + 1]!);
    }
    const inside = (px: number, py: number): boolean => {
      let c = false;
      for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
        const xi = pts[i]!, yi = pts[i + 1]!, xj = pts[j]!, yj = pts[j + 1]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    this.fill(minX, minY, maxX + 1, maxY + 1, inside, m, o, () => ((o.profile ?? "bevel") === "flat" ? 0.5 : 0.8));
    return this;
  }

  /** A 1..n px stroke along points (ropes, rails, cracks). */
  stroke(pts: number[], width: number, m: PropMaterial, o: ShapeOpts = {}): this {
    const p: Paint = { mat: this.matId(m, o), tone: o.tone ?? 0, emissive: !!o.emissive };
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i]!, y0 = pts[i + 1]!, x1 = pts[i + 2]!, y1 = pts[i + 3]!;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
        for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) this.put(x + a - (width >> 1), y + b - (width >> 1), p, 0.6, o.piece ?? 0);
      }
    }
    return this;
  }

  /** ASCII ornament: each char in legend maps to [material, tone]; '.' and ' ' are empty. */
  ascii(x: number, y: number, rows: string[], legend: Record<string, [PropMaterial, number] | [PropMaterial, number, boolean]>, o: ShapeOpts = {}): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const e = legend[row[i]!];
        if (!e) continue;
        this.put(x + i, y + j, { mat: MATS.indexOf(e[0]), tone: e[1], emissive: !!e[2] }, 0.7, o.piece ?? 0);
      }
    });
    return this;
  }

  /** Tone noise over a piece's cells: grain, wear. */
  grain(seed: number, amount: number, scale = 3, piece?: number): this {
    const r = rng(seed);
    const cell = new Map<number, number>();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.mat[i]! < 0 || this.emis[i] || (piece !== undefined && this.piece[i] !== piece)) continue;
        const key = Math.floor(x / scale) * 1000 + Math.floor(y / Math.max(1, scale - 1));
        let v = cell.get(key);
        if (v === undefined) cell.set(key, (v = r()));
        if (v < amount * 0.5) this.tone[i] = Math.max(-2, this.tone[i]! - 1);
        else if (v > 1 - amount * 0.35) this.tone[i] = Math.min(2, this.tone[i]! + 1);
      }
    return this;
  }

  /** Is there a cell of this piece at (x, y). */
  has(x: number, y: number, piece?: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const i = y * this.w + x;
    return this.mat[i]! >= 0 && (piece === undefined || this.piece[i] === piece);
  }
}

const MATS: PropMaterial[] = Object.keys(RAMPS) as PropMaterial[];

export function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Albedo + normal for one piece, with a 1 px ink outline (normal alpha 0 = ink, per the sprite contract). */
export function bakePiece(c: Cells, piece: number, outline = true): { w: number; h: number; albedo: Uint8ClampedArray; normal: Uint8ClampedArray; ox: number; oy: number } | null {
  let x0 = c.w, y0 = c.h, x1 = -1, y1 = -1;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++)
      if (c.has(x, y, piece)) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  if (x1 < 0) return null;
  const pad = outline ? 1 : 0;
  const w = x1 - x0 + 1 + pad * 2;
  const h = y1 - y0 + 1 + pad * 2;
  const albedo = new Uint8ClampedArray(w * h * 4);
  const normal = new Uint8ClampedArray(w * h * 4);
  const hgt = (x: number, y: number): number => (c.has(x, y, piece) ? c.height[y * c.w + x]! : 0);
  for (let ty = 0; ty < h; ty++)
    for (let tx = 0; tx < w; tx++) {
      const x = tx + x0 - pad;
      const y = ty + y0 - pad;
      const o = (ty * w + tx) * 4;
      if (c.has(x, y, piece)) {
        const i = y * c.w + x;
        const m = c.mat[i]!;
        const ramp = m >= 100 ? c.ramps[m - 100]! : RAMPS[MATS[m]!];
        const n = ramp.length;
        // light lip on top edges, a darker band under overhangs, the rest mid
        let band = Math.round((n - 1) * 0.55) + c.tone[i]!;
        if (!c.has(x, y - 1, piece)) band += 1;
        if (!c.has(x, y + 1, piece)) band -= 1;
        band = Math.max(0, Math.min(n - 1, band));
        const col = hx(ramp[band]!);
        albedo.set([col[0], col[1], col[2], 255], o);
        const nx = (hgt(x - 1, y) - hgt(x + 1, y)) * 0.9;
        const ny = (hgt(x, y - 1) - hgt(x, y + 1)) * 0.9;
        const l = Math.hypot(nx, ny, 1);
        normal.set([Math.round((nx / l * 0.5 + 0.5) * 255), Math.round((ny / l * 0.5 + 0.5) * 255), Math.round((1 / l * 0.5 + 0.5) * 255), 255], o);
      } else if (outline && (c.has(x - 1, y, piece) || c.has(x + 1, y, piece) || c.has(x, y - 1, piece) || c.has(x, y + 1, piece))) {
        albedo.set([INK[0], INK[1], INK[2], 255], o);
        normal.set([128, 128, 255, 0], o);
      }
    }
  return { w, h, albedo, normal, ox: x0 - pad, oy: y0 - pad };
}

/** Pieces that are emissive (drawn unlit). */
export function pieceIsEmissive(c: Cells, piece: number): boolean {
  for (let i = 0; i < c.mat.length; i++) if (c.mat[i]! >= 0 && c.piece[i] === piece) return c.emis[i] === 1;
  return false;
}

// --- textures -----------------------------------------------------------------

export interface StubTexture extends CellTexture {
  /** Renderer-specific handle (a SpriteSheet). */
  readonly handle: unknown;
}

export type TextureFactory = (t: { w: number; h: number; albedo: Uint8ClampedArray; normal: Uint8ClampedArray }) => StubTexture;

/** A baked piece placed relative to the prop's base. */
export interface Part {
  tex: StubTexture;
  /** Offset of the texture's top-left from the prop base (x centre, y ground). */
  dx: number;
  dy: number;
  layer: PropLayer;
  lit: number;
  visible: boolean;
  /** Row shear: x offset (px) per row from the part's pivot row, times swing; for sway and crisp small swings. */
  pivotRow?: number;
  /** Extra whole-pixel offset. */
  ox: number;
  oy: number;
  /** Swing angle-ish (px per row of lever); applied as shear about pivotRow. */
  swing: number;
  /** Cloth: per-row sway amount grows toward the free end. */
  cloth?: { free: "bottom" | "top"; amount: number };
  opacity: number;
}

/** Common behaviour for stub props: parts, states, a spring for shakes and swings. */
export abstract class StubProp implements Prop {
  readonly id: string;
  x: number;
  y: number;
  state: string;
  abstract readonly recipe: string;
  abstract readonly reason: string;
  abstract readonly states: readonly string[];
  collision: PropCollision = "none";
  layers: PropLayer[] = ["middle"];
  protected parts: Part[] = [];
  protected H: number;
  /** Spring: displacement and velocity (px), for hit shakes and swings. */
  protected sp = { x: 0, v: 0, k: 0.08, d: 0.86 };
  protected t = 0;

  constructor(p: PropParams, protected tex: TextureFactory, initial: string) {
    this.id = p.id;
    this.x = p.x;
    this.y = p.y;
    this.H = p.H;
    this.state = initial;
  }

  /** Bakes every piece of the cells into parts. anchor: the base point inside the cell grid. */
  protected addCells(c: Cells, ax: number, ay: number, layer: PropLayer = "middle", opts: Partial<Pick<Part, "pivotRow" | "cloth">> & { pieces?: number[] } = {}): Part[] {
    const out: Part[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < c.piece.length; i++) if (c.mat[i]! >= 0) seen.add(c.piece[i]!);
    for (const pc of [...seen].sort((a, b) => a - b)) {
      if (opts.pieces && !opts.pieces.includes(pc)) continue;
      const b = bakePiece(c, pc, !pieceIsEmissive(c, pc));
      if (!b) continue;
      const part: Part = {
        tex: this.tex(b),
        dx: b.ox - ax,
        dy: b.oy - ay,
        layer,
        lit: pieceIsEmissive(c, pc) ? 0 : 1,
        visible: true,
        ox: 0,
        oy: 0,
        swing: 0,
        opacity: 1,
        pivotRow: opts.pivotRow !== undefined ? opts.pivotRow - b.oy : undefined,
        cloth: opts.cloth,
      };
      this.parts.push(part);
      out.push(part);
    }
    if (!this.layers.includes(layer)) this.layers.push(layer);
    return out;
  }

  abstract bounds(): Box;
  solids(): Box[] {
    return [];
  }
  interaction(): Interaction | null {
    return null;
  }

  /** Default hit: a shake, dust, a knock. */
  hit(h: PropHit, w: PropWorld): boolean {
    this.sp.v += h.dir[0] * (h.heavy ? 3 : 1.6);
    w.sound("knock", 0.5, [this.x, this.y]);
    return true;
  }

  update(_w: PropWorld): void {
    this.t++;
    const s = this.sp;
    s.v += -s.x * s.k;
    s.v *= s.d;
    s.x += s.v;
    if (Math.abs(s.x) < 0.02 && Math.abs(s.v) < 0.02) s.x = s.v = 0;
  }

  draw(c: PropCanvas, layer: PropLayer): void {
    for (const p of this.parts) {
      if (!p.visible || p.layer !== layer) continue;
      this.drawPart(c, p);
    }
  }

  protected drawPart(c: PropCanvas, p: Part): void {
    const bx = Math.round(this.x + p.dx + p.ox);
    const by = Math.round(this.y + p.dy + p.oy);
    const sheared = p.pivotRow !== undefined && Math.abs(p.swing) > 0.001;
    if (!sheared && !p.cloth) {
      c.cells(p.tex, bx, by, { lit: p.lit, opacity: p.opacity });
      return;
    }
    // row slices: pixel-safe sway / swing
    for (let r = 0; r < p.tex.h; r++) {
      let off = 0;
      if (sheared) off += p.swing * (r - (p.pivotRow ?? 0));
      if (p.cloth) {
        const k = p.cloth.free === "bottom" ? r / p.tex.h : 1 - r / p.tex.h;
        off += p.cloth.amount * k * k;
      }
      c.cells(p.tex, bx + Math.round(off), by + r, { lit: p.lit, opacity: p.opacity, sx: 0, sy: r, sw: p.tex.w, sh: 1 });
    }
  }

  lights(_out: PropLight[]): void {}

  setState(s: string): void {
    if (this.states.includes(s)) this.state = s;
  }

  dispose(): void {
    this.parts = [];
  }
}

/** The stub engine: a recipe registry. */
export class StubEngine implements PixelMatterEngine {
  readonly name = "stub";
  private recipes = new Map<string, PropRecipe>();
  constructor(readonly texture: TextureFactory) {}
  register(r: PropRecipe): void {
    this.recipes.set(r.name, r);
  }
  has(recipe: string): boolean {
    return this.recipes.has(recipe);
  }
  create(recipe: string, p: PropParams): Prop {
    const r = this.recipes.get(recipe);
    if (!r) throw new Error(`no prop recipe "${recipe}"`);
    return r.build(p, this);
  }
}

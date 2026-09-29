// The recipe drawing DSL for one part: shapes with height profiles, details
// (grain, speckle, cracks, rivets, wear, bricks), text-grid ornaments and
// engraved text. Everything writes cells into the part's CellGrid.
//
// Coordinates are part-local pixels, y down, (0, 0) top-left. Recipes size
// things from H (see PropBuilder.u in recipe.ts).

import { CellGrid, F_CRACK, F_NOINK, type Rect } from "./cells.ts";
import { resolveMat, textPixels, type MatRef, type Material } from "./materials.ts";
import { rng, vnoise, type Rng } from "./util.ts";

/**
 * Height profiles:
 * - flat: constant height (edges get a soft 1-2 px roll from the normal pass)
 * - dome: rounded by distance to the shape's edge (radius `r`)
 * - bevel: linear ramp `r` px wide, then flat
 * - cylV: a vertical cylinder (columns, candles, posts): rounded across x per row
 * - cylH: a horizontal cylinder (rods, rolled cloth): rounded across y per column
 * - sunk: inset (engraving, recesses): drops `depth` over `r` px from the edge
 */
export type Profile = "flat" | "dome" | "bevel" | "cylV" | "cylH" | "sunk";

export interface ShapeOpts {
  mat: MatRef;
  profile?: Profile;
  /** Profile radius in px (dome, bevel, sunk). */
  r?: number;
  /** Profile height in px (defaults to r, cylinders to half their width). */
  depth?: number;
  /** Base height the profile sits on. */
  z?: number;
  piece?: string | number;
  tone?: number;
  /** Per-cell tone offset (x, y local; d = distance to the shape edge). */
  toneFn?: (x: number, y: number, d: number) => number;
  /** Per-cell material override; return null to skip the cell. */
  paint?: (x: number, y: number, d: number) => MatRef | null | undefined;
  /** No outline / inner line from these cells. */
  noInk?: boolean;
  /** over (default) | under: only empty cells | paint: only existing cells (keeps height) | erase | raise: add height to existing cells */
  mode?: "over" | "under" | "paint" | "erase" | "raise";
  /** Hit points multiplier over the material hardness. */
  hp?: number;
  flags?: number;
}

type Inside = (x: number, y: number) => boolean;

export class PartBuilder {
  readonly grid: CellGrid;
  readonly rand: Rng;
  private pieces = new Map<string, number>();
  private current = 1;
  private mask: Uint8Array;
  private dist: Float32Array;

  constructor(w: number, h: number, seed = 1) {
    this.grid = new CellGrid(w, h);
    this.rand = rng(seed);
    this.mask = new Uint8Array(this.grid.W * this.grid.Hh);
    this.dist = new Float32Array(this.grid.W * this.grid.Hh);
    this.pieces.set("main", 1);
  }

  get w(): number {
    return this.grid.w;
  }
  get h(): number {
    return this.grid.h;
  }

  /** Select (and create) a piece. Later pieces sit in front (inner lines). */
  piece(name: string): number {
    let id = this.pieces.get(name);
    if (id === undefined) {
      id = this.pieces.size + 1;
      if (id > 255) throw new Error("pixel: at most 255 pieces per part");
      this.pieces.set(name, id);
    }
    this.current = id;
    return id;
  }

  pieceId(p: string | number | undefined): number {
    if (p === undefined) return this.current;
    if (typeof p === "number") return p;
    const cur = this.current;
    const id = this.piece(p);
    this.current = cur;
    return id;
  }

  pieceNames(): Map<string, number> {
    return this.pieces;
  }

  heightAt(x: number, y: number): number {
    const i = this.grid.inner(x, y);
    return i < 0 ? 0 : this.grid.height[i]!;
  }

  solid(x: number, y: number): boolean {
    return this.grid.solid(x, y);
  }

  // --- shapes ----------------------------------------------------------------

  rect(x: number, y: number, w: number, h: number, o: ShapeOpts): this {
    const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w) - 1, y1 = Math.round(y + h) - 1;
    return this.fill({ x0, y0, x1, y1 }, () => true, o);
  }

  /** Rectangle with rounded (radius rad) or chamfered corners. */
  roundRect(x: number, y: number, w: number, h: number, rad: number, o: ShapeOpts & { chamfer?: boolean }): this {
    const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w) - 1, y1 = Math.round(y + h) - 1;
    return this.fill({ x0, y0, x1, y1 }, (px, py) => {
      const cx = Math.min(Math.max(px + 0.5, x0 + rad), x1 + 1 - rad);
      const cy = Math.min(Math.max(py + 0.5, y0 + rad), y1 + 1 - rad);
      const dx = Math.abs(px + 0.5 - cx), dy = Math.abs(py + 0.5 - cy);
      return o.chamfer ? dx + dy <= rad + 0.01 : dx * dx + dy * dy <= rad * rad + 0.01;
    }, o);
  }

  circle(cx: number, cy: number, r: number, o: ShapeOpts): this {
    return this.ellipse(cx, cy, r, r, o);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, o: ShapeOpts): this {
    const b = { x0: Math.floor(cx - rx), y0: Math.floor(cy - ry), x1: Math.ceil(cx + rx), y1: Math.ceil(cy + ry) };
    return this.fill(b, (x, y) => {
      const dx = (x + 0.5 - cx) / Math.max(rx, 0.5), dy = (y + 0.5 - cy) / Math.max(ry, 0.5);
      return dx * dx + dy * dy <= 1;
    }, o);
  }

  /** Ring between radii r0 and r1 (optionally squashed by `flat`). */
  ring(cx: number, cy: number, r0: number, r1: number, o: ShapeOpts & { flat?: number }): this {
    const f = o.flat ?? 1;
    const b = { x0: Math.floor(cx - r1), y0: Math.floor(cy - r1 * f), x1: Math.ceil(cx + r1), y1: Math.ceil(cy + r1 * f) };
    return this.fill(b, (x, y) => {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / f;
      const d = Math.hypot(dx, dy);
      return d >= r0 && d <= r1;
    }, o);
  }

  /** Filled polygon (non-zero), points [x0, y0, x1, y1, ...]. */
  poly(P: number[], o: ShapeOpts): this {
    const n = P.length >> 1;
    if (n < 3) return this;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, P[i * 2]!);
      maxX = Math.max(maxX, P[i * 2]!);
      minY = Math.min(minY, P[i * 2 + 1]!);
      maxY = Math.max(maxY, P[i * 2 + 1]!);
    }
    return this.fill({ x0: Math.floor(minX), y0: Math.floor(minY), x1: Math.ceil(maxX), y1: Math.ceil(maxY) }, (x, y) => {
      const px = x + 0.5, py = y + 0.5;
      let wind = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = P[i * 2]!, yi = P[i * 2 + 1]!, xj = P[j * 2]!, yj = P[j * 2 + 1]!;
        if (yj <= py) {
          if (yi > py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) > 0) wind++;
        } else if (yi <= py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) < 0) wind--;
      }
      return wind !== 0;
    }, o);
  }

  /** Thick polyline (capsule segments), widths per point or one width. */
  stroke(pts: number[], width: number | number[], o: ShapeOpts): this {
    const n = pts.length >> 1;
    if (n < 1) return this;
    const wd = (i: number): number => (Array.isArray(width) ? width[Math.min(i, width.length - 1)]! : width);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, mw = 0;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, pts[i * 2]!);
      maxX = Math.max(maxX, pts[i * 2]!);
      minY = Math.min(minY, pts[i * 2 + 1]!);
      maxY = Math.max(maxY, pts[i * 2 + 1]!);
      mw = Math.max(mw, wd(i));
    }
    const r = mw / 2 + 1;
    return this.fill({ x0: Math.floor(minX - r), y0: Math.floor(minY - r), x1: Math.ceil(maxX + r), y1: Math.ceil(maxY + r) }, (x, y) => {
      const px = x + 0.5, py = y + 0.5;
      for (let i = 0; i < Math.max(1, n - 1); i++) {
        const ax = pts[i * 2]!, ay = pts[i * 2 + 1]!;
        const bx = n > 1 ? pts[i * 2 + 2]! : ax, by = n > 1 ? pts[i * 2 + 3]! : ay;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
        let t = ((px - ax) * dx + (py - ay) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const rr = (wd(i) + (wd(Math.min(i + 1, n - 1)) - wd(i)) * t) / 2;
        const qx = px - ax - dx * t, qy = py - ay - dy * t;
        if (qx * qx + qy * qy <= rr * rr) return true;
      }
      return false;
    }, { profile: "cylV", ...o });
  }

  /** One-pixel line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, o: ShapeOpts): this {
    const pts: [number, number][] = [];
    let X0 = Math.floor(x0), Y0 = Math.floor(y0);
    const X1 = Math.floor(x1), Y1 = Math.floor(y1);
    const dx = Math.abs(X1 - X0), dy = -Math.abs(Y1 - Y0), sx = X0 < X1 ? 1 : -1, sy = Y0 < Y1 ? 1 : -1;
    let err = dx + dy;
    for (let g = 0; g < 4096; g++) {
      pts.push([X0, Y0]);
      if (X0 === X1 && Y0 === Y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; X0 += sx; }
      if (e2 <= dx) { err += dx; Y0 += sy; }
    }
    return this.pixels(pts, o);
  }

  /** Pointed (gothic) arch: straight sides from the bottom up to `spring`, two arcs meeting at the top. */
  arch(x: number, y: number, w: number, h: number, o: ShapeOpts & { spring?: number; pointed?: number }): this {
    const k = o.pointed ?? 1; // arc radius as a multiple of the width (1 = equilateral)
    const R = w * k;
    const apex = Math.sqrt(Math.max(0, R * R - (R - w / 2) * (R - w / 2)));
    const spring = o.spring ?? h - apex;
    const topY = y;
    const sy = y + h - Math.max(0, spring);
    const cxL = x + w - R, cxR = x + R;
    return this.fill({ x0: Math.floor(x), y0: Math.floor(y), x1: Math.ceil(x + w) - 1, y1: Math.ceil(y + h) - 1 }, (px, py) => {
      const X = px + 0.5, Y = py + 0.5;
      if (X < x || X > x + w || Y < topY || Y > y + h) return false;
      if (Y >= sy) return true;
      // above the springing line: inside both circles centred on the springing line
      const dl = Math.hypot(X - cxL, Y - sy), dr = Math.hypot(X - cxR, Y - sy);
      return dl <= R && dr <= R;
    }, o);
  }

  /** Individual pixels. */
  pixels(pts: [number, number][], o: ShapeOpts): this {
    if (!pts.length) return this;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const set = new Set<number>();
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      set.add((y + 4096) * 16384 + x + 4096);
    }
    return this.fill({ x0, y0, x1, y1 }, (x, y) => set.has((y + 4096) * 16384 + x + 4096), { profile: "flat", ...o });
  }

  /**
   * Ornament typed as a text pixel grid. Each character maps through the
   * legend to a material (or options); '.' and ' ' are empty.
   */
  ornament(x: number, y: number, art: string, legend: Record<string, MatRef | (Partial<ShapeOpts> & { mat: MatRef })>, o: Partial<ShapeOpts> & { scale?: number } = {}): this {
    const rows = art.split("\n").map((r) => r.replace(/\s+$/, "")).filter((r, i, a) => r.trim().length || (i > 0 && i < a.length - 1));
    const indent = Math.min(...rows.filter((r) => r.trim()).map((r) => r.length - r.trimStart().length));
    const s = o.scale ?? 1;
    const groups = new Map<string, [number, number][]>();
    rows.forEach((row, ry) => {
      [...row.slice(indent)].forEach((ch, rx) => {
        if (ch === "." || ch === " " || !legend[ch]) return;
        const list = groups.get(ch) ?? [];
        for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) list.push([x + rx * s + a, y + ry * s + b]);
        groups.set(ch, list);
      });
    });
    for (const [ch, pts] of groups) {
      const L = legend[ch]!;
      const spec = typeof L === "string" || "rgb" in (L as object) ? { mat: L as MatRef } : (L as Partial<ShapeOpts> & { mat: MatRef });
      this.pixels(pts, { ...o, ...spec } as ShapeOpts);
    }
    return this;
  }

  /** Engraved (sunk, darker) or raised text in the 3x5 font. Returns the text width. */
  text(str: string, x: number, y: number, o: Partial<ShapeOpts> & { raised?: boolean; mat?: MatRef } = {}): number {
    const { pts, w } = textPixels(str);
    const p = pts.map(([a, b]) => [x + a, y + b] as [number, number]);
    if (o.raised) this.pixels(p, { profile: "flat", z: 2, ...o, mat: o.mat ?? "brass" } as ShapeOpts);
    else {
      for (const [a, b] of p) {
        const i = this.grid.inner(a, b);
        if (i < 0 || !this.grid.mat[i]) continue;
        this.grid.tone[i] = (o.tone ?? -2) as number;
        this.grid.height[i] = Math.max(0, this.grid.height[i]! - 1.5);
        if (o.mat) this.grid.mat[i] = resolveMat(o.mat).id;
      }
    }
    return w;
  }

  // --- details ---------------------------------------------------------------

  private region(r?: Rect): Rect {
    return r ?? { x0: 0, y0: 0, x1: this.grid.w - 1, y1: this.grid.h - 1 };
  }

  private eachCell(r: Rect | undefined, fn: (i: number, x: number, y: number) => void, mats?: MatRef[]): void {
    const R = this.region(r);
    const ids = mats?.map((m) => resolveMat(m).id);
    for (let y = R.y0; y <= R.y1; y++) {
      for (let x = R.x0; x <= R.x1; x++) {
        const i = this.grid.inner(x, y);
        if (i < 0 || !this.grid.mat[i]) continue;
        if (ids && !ids.includes(this.grid.mat[i]!)) continue;
        fn(i, x, y);
      }
    }
  }

  /** Random tone flecks. */
  speckle(o: { amount: number; seed?: number; tone?: number; region?: Rect; mats?: MatRef[]; scale?: number }): this {
    const s = o.seed ?? 7, sc = o.scale ?? 1;
    this.eachCell(o.region, (i, x, y) => {
      const n = vnoise(x / sc + 0.5, y / sc + 0.5, s);
      if (n > 1 - o.amount) this.grid.tone[i] = this.grid.tone[i]! + (o.tone ?? -1);
    }, o.mats);
    return this;
  }

  /** Grain streaks along x ('h') or y ('v'). */
  grain(o: { dir?: "h" | "v"; seed?: number; tone?: number; density?: number; region?: Rect; mats?: MatRef[]; stretch?: number }): this {
    const s = o.seed ?? 3, st = o.stretch ?? 9, d = o.density ?? 0.28;
    this.eachCell(o.region, (i, x, y) => {
      const n = o.dir === "h" ? vnoise(x / st, y * 0.9, s) : vnoise(x * 0.9, y / st, s);
      if (n < d) this.grid.tone[i] = this.grid.tone[i]! + (o.tone ?? -1);
    }, o.mats);
    return this;
  }

  /** Crack lines by random walk from (x, y). */
  cracks(x: number, y: number, o: { n?: number; len?: number; seed?: number; tone?: number; dir?: number; spread?: number }): this {
    const r = rng(o.seed ?? 11);
    const n = o.n ?? 2, len = o.len ?? 10;
    for (let k = 0; k < n; k++) {
      let a = (o.dir ?? r() * Math.PI * 2) + (r() - 0.5) * (o.spread ?? 1.2);
      let px = x, py = y;
      for (let s = 0; s < len; s++) {
        a += (r() - 0.5) * 0.9;
        px += Math.cos(a);
        py += Math.sin(a);
        const i = this.grid.inner(px, py);
        if (i < 0 || !this.grid.mat[i]) break;
        this.grid.flags[i] = this.grid.flags[i]! | F_CRACK;
        this.grid.tone[i] = Math.min(this.grid.tone[i]!, o.tone ?? -2);
        this.grid.height[i] = Math.max(0, this.grid.height[i]! - 1);
      }
    }
    return this;
  }

  rivets(pts: [number, number][], o: { mat: MatRef; r?: number; z?: number }): this {
    for (const [x, y] of pts) {
      const z = o.z ?? this.heightAt(x, y);
      this.circle(x, y, o.r ?? 1.2, { mat: o.mat, profile: "dome", r: 1.5, depth: 1.5, z, noInk: true });
    }
    return this;
  }

  /** Chip edges: outer cells go missing or darken. */
  wear(o: { amount: number; seed?: number; region?: Rect }): this {
    const r = rng(o.seed ?? 5);
    const g = this.grid;
    const hits: number[] = [];
    this.eachCell(o.region, (i) => {
      const edge = !g.mat[i - 1] || !g.mat[i + 1] || !g.mat[i - g.W] || !g.mat[i + g.W];
      if (edge && r() < o.amount) hits.push(i);
    });
    for (const i of hits) {
      if (r() < 0.45) g.clearRaw(i);
      else g.tone[i] = g.tone[i]! - 1;
    }
    return this;
  }

  /** Masonry: bevelled blocks with per-block tone variation over a mortar bed. */
  bricks(x: number, y: number, w: number, h: number, o: { bw: number; bh: number; mat: MatRef; mortar: MatRef; stagger?: number; seed?: number; z?: number; bevel?: number; piece?: string; tones?: number[]; jitter?: number }): this {
    const r = rng(o.seed ?? 9);
    const z = o.z ?? 0;
    this.rect(x, y, w, h, { mat: o.mortar, profile: "flat", z, piece: o.piece });
    const rows = Math.ceil(h / o.bh);
    for (let row = 0; row < rows; row++) {
      const by = y + row * o.bh;
      const off = row % 2 ? (o.stagger ?? 0.5) * o.bw : 0;
      for (let bx = x - off; bx < x + w; ) {
        const bwj = Math.max(3, Math.round(o.bw * (1 + ((o.jitter ?? 0) * (r() - 0.5)))));
        const x0 = Math.max(x, Math.round(bx)), x1 = Math.min(x + w, Math.round(bx + bwj));
        const y0 = by, y1 = Math.min(y + h, by + o.bh);
        if (x1 - x0 >= 2 && y1 - y0 >= 2) {
          const tone = o.tones ? o.tones[Math.floor(r() * o.tones.length)]! : r() < 0.25 ? -1 : r() < 0.1 ? 1 : 0;
          this.rect(x0 + (x0 > x ? 1 : 0), y0 + (row > 0 ? 1 : 0), x1 - x0 - (x0 > x ? 1 : 0), y1 - y0 - (row > 0 ? 1 : 0), {
            mat: o.mat, profile: "bevel", r: o.bevel ?? 2, depth: 2, z: z + 1, tone, piece: o.piece,
          });
        }
        bx += bwj;
      }
    }
    return this;
  }

  // --- core ------------------------------------------------------------------

  /** Rasterise `inside` over bounds `b`, then write cells with the profile. */
  fill(b: Rect, inside: Inside, o: ShapeOpts): this {
    const g = this.grid;
    const x0 = Math.max(-g.pad, b.x0), y0 = Math.max(-g.pad, b.y0);
    const x1 = Math.min(g.w + g.pad - 1, b.x1), y1 = Math.min(g.h + g.pad - 1, b.y1);
    if (x1 < x0 || y1 < y0) return this;
    const { mask, dist } = this;
    const W = g.W;
    // mask in raw coords (with a 1 px zero border for the distance pass)
    const X0 = x0 + g.pad, Y0 = y0 + g.pad, X1 = x1 + g.pad, Y1 = y1 + g.pad;
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) mask[Y * W + X] = inside(X - g.pad, Y - g.pad) ? 1 : 0;
    // restrict drawing to the logical area
    const lx0 = Math.max(X0, g.pad), ly0 = Math.max(Y0, g.pad), lx1 = Math.min(X1, g.pad + g.w - 1), ly1 = Math.min(Y1, g.pad + g.h - 1);
    const m: Material = resolveMat(o.mat);
    const mode = o.mode ?? "over";
    if (mode === "erase") {
      for (let Y = ly0; Y <= ly1; Y++) for (let X = lx0; X <= lx1; X++) if (mask[Y * W + X]) g.clearRaw(Y * W + X);
      return this;
    }
    // chamfer distance to the outside of the mask
    const D2 = 1.4142;
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) dist[Y * W + X] = mask[Y * W + X] ? 1e6 : 0;
    const at = (X: number, Y: number): number => (X < X0 || X > X1 || Y < Y0 || Y > Y1 ? 0 : dist[Y * W + X]!);
    for (let Y = Y0; Y <= Y1; Y++) {
      for (let X = X0; X <= X1; X++) {
        const k = Y * W + X;
        if (!dist[k]) continue;
        dist[k] = Math.min(dist[k]!, at(X - 1, Y) + 1, at(X, Y - 1) + 1, at(X - 1, Y - 1) + D2, at(X + 1, Y - 1) + D2);
      }
    }
    for (let Y = Y1; Y >= Y0; Y--) {
      for (let X = X1; X >= X0; X--) {
        const k = Y * W + X;
        if (!dist[k]) continue;
        dist[k] = Math.min(dist[k]!, at(X + 1, Y) + 1, at(X, Y + 1) + 1, at(X + 1, Y + 1) + D2, at(X - 1, Y + 1) + D2);
      }
    }
    const profile = o.profile ?? "dome";
    const R = Math.max(0.6, o.r ?? 3);
    const z = o.z ?? 0;
    // spans for cylinders
    let spans: Float32Array | null = null;
    if (profile === "cylV" || profile === "cylH") {
      const vert = profile === "cylV";
      const n = vert ? Y1 - Y0 + 1 : X1 - X0 + 1;
      spans = new Float32Array(n * 2).fill(NaN);
      for (let Y = Y0; Y <= Y1; Y++) {
        for (let X = X0; X <= X1; X++) {
          if (!mask[Y * W + X]) continue;
          const s = vert ? Y - Y0 : X - X0;
          const v = vert ? X : Y;
          if (Number.isNaN(spans[s * 2]!) || v < spans[s * 2]!) spans[s * 2] = v;
          if (Number.isNaN(spans[s * 2 + 1]!) || v > spans[s * 2 + 1]!) spans[s * 2 + 1] = v;
        }
      }
    }
    const pid = this.pieceId(o.piece);
    const hpMul = o.hp ?? 1;
    for (let Y = ly0; Y <= ly1; Y++) {
      for (let X = lx0; X <= lx1; X++) {
        const k = Y * W + X;
        if (!mask[k]) continue;
        const exists = g.mat[k]! !== 0;
        if (mode === "under" && exists) continue;
        if ((mode === "paint" || mode === "raise") && !exists) continue;
        const d = dist[k]!;
        const lx = X - g.pad, ly = Y - g.pad;
        let mm = m;
        if (o.paint) {
          const pm = o.paint(lx, ly, d);
          if (pm === null) continue;
          if (pm) mm = resolveMat(pm);
        }
        let h: number;
        switch (profile) {
          case "flat":
            h = z + (o.depth ?? 1);
            break;
          case "dome": {
            const dep = o.depth ?? R;
            const t = Math.min(Math.max(d - 0.5, 0) / R, 1);
            h = z + dep * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
            break;
          }
          case "bevel": {
            const dep = o.depth ?? 2;
            h = z + dep * Math.min(Math.max(d - 0.5, 0) / R + 0.35, 1);
            break;
          }
          case "sunk": {
            const dep = o.depth ?? 2;
            h = Math.max(0, z - dep * Math.min(Math.max(d - 0.5, 0) / R, 1));
            break;
          }
          case "cylV":
          case "cylH": {
            const vert = profile === "cylV";
            const s = vert ? Y - Y0 : X - X0;
            const a = spans![s * 2]!, bb = spans![s * 2 + 1]!;
            const half = (bb - a + 1) / 2;
            const u = ((vert ? X : Y) + 0.5 - (a + half)) / Math.max(half, 0.5);
            const dep = o.depth ?? half;
            h = z + dep * Math.sqrt(Math.max(0.02, 1 - u * u));
            break;
          }
        }
        if (mode === "paint") {
          g.mat[k] = mm.id;
          g.tone[k] = (o.tone ?? 0) + (o.toneFn ? o.toneFn(lx, ly, d) : 0);
          if (o.noInk) g.flags[k] = g.flags[k]! | F_NOINK;
          g.markRaw(k);
          continue;
        }
        if (mode === "raise") {
          g.height[k] = g.height[k]! + (h - z);
          g.markRaw(k);
          continue;
        }
        const tone = (o.tone ?? 0) + (o.toneFn ? o.toneFn(lx, ly, d) : 0);
        g.setRaw(k, mm.id, tone, pid, h, (o.flags ?? 0) | (o.noInk ? F_NOINK : 0), mm.hardness * hpMul);
      }
    }
    return this;
  }
}

// The painter contract. A painter draws one kind of piece into an indexed buffer at any
// density, so the same code paints the play plate, the wider reveal levels and the 2x
// close-up jetty. Coordinates handed to a painter are level-1 art px of the piece's plane
// relative to its anchor; `c.X()` and `c.Y()` turn them into the buffer's art px.

import type { IdxBuf } from "./raster.ts";

export interface PaintCtx {
  buf: IdxBuf;
  /** Density: art px per level-1 plane px (1 at play zoom). */
  d: number;
  /** The anchor in this level's art px. */
  ax: number;
  ay: number;
  seed: number;
  /** Level-1 local px to this level's art px (absolute). */
  X(v: number): number;
  Y(v: number): number;
  /** Absolute art px back to level-1 local px (for procedural textures that must not swim with density). */
  lx(ax: number): number;
  ly(ay: number): number;
}

export interface Painter<P = Record<string, unknown>> {
  /** Bounds in level-1 plane px relative to the anchor: [x0, y0, x1, y1]. */
  bounds(p: P): [number, number, number, number];
  paint(c: PaintCtx, p: P): void;
}

export function ctxFor(buf: IdxBuf, d: number, anchorX: number, anchorY: number, seed: number): PaintCtx {
  const ax = anchorX * d, ay = anchorY * d;
  return {
    buf, d, ax, ay, seed,
    X: (v) => ax + v * d,
    Y: (v) => ay + v * d,
    lx: (v) => (v - ax) / d,
    ly: (v) => (v - ay) / d,
  };
}

const REGISTRY = new Map<string, Painter<any>>();

export function definePainter<P>(kind: string, p: Painter<P>): Painter<P> {
  if (REGISTRY.has(kind)) throw new Error(`painter ${kind} defined twice`);
  REGISTRY.set(kind, p as Painter<any>);
  return p;
}

export function painter(kind: string): Painter<any> {
  const p = REGISTRY.get(kind);
  if (!p) throw new Error(`no painter called ${kind}`);
  return p;
}

export function painterKinds(): string[] {
  return [...REGISTRY.keys()];
}

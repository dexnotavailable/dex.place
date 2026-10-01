// A camera bias for a scene: the same place seen from somewhere else along the
// shore. The world runtime pans a room's backdrop about the room's own middle;
// a bias moves that middle, so a room beside the dock (Pier's End, the ferry)
// sees the same lake, ring and colossus with true parallax: every layer's
// content moves right by bias / depth (the sky and sun never move, the ring
// barely, the near rocks a lot). Positive bias = this view stands further left.
//
// It works on built layers, so the scene code stays as it is:
// - pix and character layers move by their whole-pixel share;
// - glsl bodies are wrapped (vec4 layer(p, s) samples its content bias / depth
//   to the left) and every layerOff() they (and the prelude) use becomes
//   layerOffB(), which folds the bias in, so per-row parallax (the lake) and
//   depth-pinned things (the shaft's origin, ripples at the posts) agree;
// - points systems push and light at shifted positions;
// - bounds move with the content (a live proxy, since Trackers rewrite them).
// Build the layers with a wider pan (withPan) so they still cover the view.

import { f, type BuildCtx, type LayerDef, type PointSystem } from "../../engine/index.ts";
import type { PointSink } from "../../engine/types.ts";

/** Whole-pixel content shift of a depth for a bias (same rounding as layerOffB). */
export function biasAt(bias: number, depth: number): number {
  return Number.isFinite(depth) && depth < 1e6 ? Math.floor(bias / depth + 0.5) : 0;
}

/** GLSL defining layerOffB(depth): layerOff with the bias folded in. Put it first in the prelude. */
export function biasGlsl(bias: number): string {
  return /* glsl */ `
float layerOffB(float depth) {
  return layerOff(depth) - (depth > 1e6 ? 0.0 : floor(${f(bias)} / depth + 0.5));
}`;
}

/** Rewrites layerOff( calls to layerOffB( in a GLSL string. */
export function useBiasOff(src: string): string {
  return src.replace(/\blayerOff\(/g, "layerOffB(");
}

/** A context whose pan is wide enough for the bias: layers built with it cover the biased view. */
export function withPan(ctx: BuildCtx, bias: number): BuildCtx {
  const span = ctx.span + 2 * Math.abs(bias);
  return {
    ...ctx,
    span,
    panWidth: (d) => ctx.W + Math.ceil(span * (Number.isFinite(d) ? 1 / d : 0)) + 2,
  };
}

function shiftBounds(b: LayerDef["bounds"], s: number): LayerDef["bounds"] {
  if (!b || s === 0) return b;
  // a live view: Trackers rewrite x0 / x1 of the object they were given every frame
  return {
    get y0() {
      return b.y0;
    },
    get y1() {
      return b.y1;
    },
    get x0() {
      return b.x0 === undefined ? undefined : b.x0 + s;
    },
    get x1() {
      return b.x1 === undefined ? undefined : b.x1 + s;
    },
  } as LayerDef["bounds"];
}

class ShiftedPoints implements PointSystem {
  constructor(
    private inner: PointSystem,
    private s: number,
  ) {}
  update(dt: number, env: Parameters<PointSystem["update"]>[1]): void {
    this.inner.update(dt, env);
  }
  draw(sink: PointSink): void {
    const s = this.s;
    this.inner.draw({ push: (x, y, size, shape, row, shade, frame, alpha) => sink.push(x + s, y, size, shape, row, shade, frame, alpha) });
  }
  lights(out: Parameters<NonNullable<PointSystem["lights"]>>[0]): void {
    if (!this.inner.lights) return;
    const n = out.length;
    this.inner.lights(out);
    for (let i = n; i < out.length; i++) out[i]!.x += this.s;
  }
}

/** Moves built layers' content by bias / depth (see the header). */
export function biasLayers(layers: LayerDef[], bias: number): LayerDef[] {
  if (!bias) return layers;
  return layers.map((l) => {
    const s = biasAt(bias, l.depth);
    const bounds = shiftBounds(l.bounds, s);
    switch (l.kind) {
      case "pix":
        return { ...l, x: l.x + s, bounds };
      case "character":
        return { ...l, x: l.x + s, bounds };
      case "points": {
        const system = s ? new ShiftedPoints(l.system, s) : l.system;
        // keep the system's own fields reachable, and writable (flash checks read system.specs / live; placeFlocks sets a flock's depth)
        if (s) for (const k of Object.keys(l.system)) if (!(k in system)) Object.defineProperty(system, k, { get: () => (l.system as unknown as Record<string, unknown>)[k], set: (v: unknown) => { (l.system as unknown as Record<string, unknown>)[k] = v; } });
        return { ...l, system, bounds };
      }
      case "glsl": {
        const sig = "vec4 layer(vec2 p, vec2 s)";
        if (!l.body.includes(sig)) throw new Error(`arrival bias: layer ${l.name} has no "${sig}"`);
        const body = `${useBiasOff(l.body).replace(sig, "vec4 layerBiased(vec2 p, vec2 s)")}
${sig} {
  return layerBiased(p - vec2(${f(s)}, 0.0), s);
}`;
        return { ...l, body, bounds };
      }
    }
  });
}

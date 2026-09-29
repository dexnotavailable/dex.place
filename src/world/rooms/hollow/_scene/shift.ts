// Reusing a /scenes/ scene as a room backdrop at another framing. A scene is
// composed for the camera at the top of its layer space (uCamY 0); a room
// whose player stands lower (the market street, 6 H under the walkway) sees
// every layer lifted by camY / depth. `lift()` moves each layer down by
// ref / depth, so at the reference framing (the street) the composition is
// exactly the scene's, and the camera's vertical travel still gives true
// parallax around it:
//
//   glsl   the body's layer() is wrapped so it samples p - (0, oy); its
//          bounds move with it (bodies light and fog in screen space `s`,
//          which stays put, so the furnace light matches at the reference)
//   pix    the buffer's y origin moves
//   points the system is wrapped so it draws (and lights) oy lower
//
// Nothing in the scene files changes (they are the scenes lane's).

import type { LayerDef, LightOut, PointSink, PointSystem, SceneDef, BuildCtx } from "../../../../scenes/engine/types.ts";
import { f } from "../../../../scenes/engine/layers.ts";

const SIG = "vec4 layer(vec2 p, vec2 s)";

/** One layer moved down by oy layer px (a new object; the scene's layer is untouched). */
export function liftLayer(l: LayerDef, oy: number): LayerDef {
  if (!oy) return l;
  if (l.kind === "pix") return { ...l, y: l.y + oy };
  if (l.kind === "glsl") {
    if (!l.body.includes(SIG)) throw new Error(`hollow backdrop: layer ${l.name} has no ${SIG}`);
    const body = `${l.body.replace(SIG, "vec4 layerLifted(vec2 p, vec2 s)")}\n${SIG} { return layerLifted(p - vec2(0.0, ${f(oy)}), s); }`;
    const bounds = l.bounds ? { ...l.bounds, y0: l.bounds.y0 + oy, y1: l.bounds.y1 + oy } : undefined;
    return { ...l, body, bounds };
  }
  if (l.kind === "points") {
    const inner = l.system;
    const sys: PointSystem = {
      update: (dt, env) => inner.update(dt, env),
      draw: (sink: PointSink) => inner.draw({ push: (x, y, size, shape, row, shade, frame, alpha) => sink.push(x, y + oy, size, shape, row, shade, frame, alpha) }),
    };
    if (inner.lights) {
      sys.lights = (out: LightOut[]) => {
        const n = out.length;
        inner.lights!(out);
        for (let i = n; i < out.length; i++) out[i]!.y += oy;
      };
    }
    return { ...l, system: sys };
  }
  return l;
}

export interface LiftOpts {
  /** Camera top row (room px) at the framing the scene was composed for. */
  ref: number;
  /** The room's backdrop.vertical (the engine multiplies the camera's y by it). */
  vertical: number;
  /** Layer names to leave out. */
  drop?: string[];
  /** Keep only these (after drop). */
  keep?: (l: LayerDef) => boolean;
  /** Extra layers, inserted by a callback that sees the scene's layers (return the full list). */
  compose?: (ctx: BuildCtx, layers: LayerDef[]) => LayerDef[];
  /** Replace the scene's prelude (default: the scene's own). */
  prelude?: (ctx: BuildCtx) => string;
  title?: string;
  palette?: SceneDef["palette"];
  fog?: SceneDef["fog"];
}

/** The scene, re-framed: every layer lifted to the reference framing, some dropped, some added. */
export function lifted(base: SceneDef, o: LiftOpts): SceneDef {
  const drop = new Set(o.drop ?? []);
  return {
    ...base,
    title: o.title ?? `${base.title} (lifted)`,
    palette: o.palette ?? base.palette,
    fog: o.fog ?? base.fog,
    prelude: o.prelude ?? base.prelude,
    build: (ctx) => {
      let ls = base.build(ctx).filter((l) => !drop.has(l.name) && (o.keep ? o.keep(l) : true));
      if (o.compose) ls = o.compose(ctx, ls);
      return ls.map((l) => (Number.isFinite(l.depth) ? liftLayer(l, Math.round((o.ref * o.vertical) / l.depth)) : l));
    },
  };
}

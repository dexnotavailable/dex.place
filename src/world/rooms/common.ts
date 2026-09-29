// Shared bits for room data: sprite lighting presets built on the lab's
// lighting model, and a stand-in BuildCtx so a room can ask a scene's
// geometry (where its deck and waterline are) before the backdrop is built.

import lightingRaw from "../../lab/data/lighting.json?raw";
import { SCALE, playerPx } from "../../scenes/engine/scale.ts";
import type { BuildCtx } from "../../scenes/engine/types.ts";
import type { Lighting } from "../render/renderer.ts";

const LAB = JSON.parse(lightingRaw) as Lighting;

export function lighting(o: Partial<Lighting>): Lighting {
  return { ...LAB, ...o };
}

/** A BuildCtx with the world's numbers, for reading scene geometry. */
export function geoCtx(span: number): BuildCtx {
  const W = SCALE.view.w;
  const H = SCALE.view.h;
  return {
    mode: "world",
    W,
    H,
    u: H / 360,
    world: 1,
    player: playerPx(H),
    span,
    row: () => 0,
    par: (d) => (Number.isFinite(d) ? 1 / d : 0),
    panWidth: (d) => W + Math.ceil(span * (Number.isFinite(d) ? 1 / d : 0)) + 2,
    fogAt: () => 0,
    rng: Math.random,
  };
}

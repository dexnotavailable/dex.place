// The lamps you lit, seen from Ringwater (lane I1; WORLD-PLAN sections 2, 11).
//
// "Lit lamps stay lit. They show on the lamp board, on the map, and as tiny
// flames in the distant layers." The Blade (R-D), the pilgrim path, the porch
// and the balcony (R-E) already draw the save's shrines in their far layers.
// Ringwater didn't, so the round's last image ("the colossus passes; all the
// lamps you lit stand in a line across the valley") had no lamps in it. This
// adds them to Ringwater's lake backdrops without touching R-A's scene: the
// story hook `room` wraps the backdrop's SceneDef and slips one points layer in
// right after the far strand, at the strand's depth, so the colossus walks in
// front of them and the lake mirrors them.
//
// Keyed to the save, live: the layer reads the save's shrine flags a few times a
// second, so a lamp shows the moment its shrine is lit (no rebuild), and a
// fresh save shows none. Nothing is invented: no flag, no lamp.

import type { BuildCtx, LayerDef, PointSystem, SceneDef } from "../../scenes/engine/index.ts";
import type { PointSink, SimEnv } from "../../scenes/engine/types.ts";
import { biasAt } from "../../scenes/scenes/arrival/bias.ts";
import { COL_DEPTH } from "../../scenes/scenes/arrival/geo.ts";
import type { BackdropSpec, RoomDef } from "../room/types.ts";

const SAVE_KEY = "dex.world.v1";

/**
 * Where each shrine's lamp stands on the far strand, in the dock's layer space at mid-pan
 * (x at 1280 x 720, before any camera bias): east of the light shaft, in route order, a
 * little uneven so they read as lamps on a shore and not as a row of dots. From Pier's End
 * the same strand is seen 27 H further left, so the line lands between the leaning rock
 * and the ferry bell's post, where the ending frames it; from the dock it runs under the
 * colossus's path between the light shaft and the right-hand cliff.
 */
const SLOTS: [number, number][] = [
  [837, 0],
  [870, -1],
  [904, 1],
  [938, 0],
  [972, -1],
  [1006, 0],
];

/** Ringwater rooms that look across the lake, and their scene camera bias in view px (as R-A builds them: A0 27 H left of the dock, A2 4 H and A4 10 H right of it). */
const ROOMS: Record<string, number> = { A0: 27 * 80, A1: 0, A2: -4 * 80, A4: -10 * 80 };

let cache: { at: number; lit: number[] } | null = null;
/** The save's lit shrines (read at most 4 times a second). */
export function litNow(): number[] {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (cache && now - cache.at < 250) return cache.lit;
  let lit: number[] = [];
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SAVE_KEY) : null;
    const d = raw ? (JSON.parse(raw) as { flags?: Record<string, boolean> }) : null;
    lit = [1, 2, 3, 4, 5, 6].filter((n) => d?.flags?.[`shrine:${n}`]);
  } catch {
    lit = [];
  }
  cache = { at: now, lit };
  return lit;
}

/** Warm points on the far strand, one per lit shrine: a stepped halo, a core and a thread of light over it. */
class ShoreLamps implements PointSystem {
  private t = 0;
  private lit: number[] = [];
  constructor(
    private at: [number, number][],
    private row: number,
    private u: number,
    private evening: boolean,
  ) {}
  update(_dt: number, env: SimEnv): void {
    // a slow breath, never a flash (no gate needed); slower still in reduced motion
    this.t = env.t * (env.reduced ? 0.3 : 1);
    this.lit = litNow();
  }
  draw(sink: PointSink): void {
    const u = this.u;
    const halo = 5 * u + 1;
    for (const n of this.lit) {
      const p = this.at[n - 1];
      if (!p) continue;
      const [x, y] = p;
      const breath = Math.sin(this.t * 0.6 + n * 1.9) > 0.7 ? 0.85 : 1;
      sink.push(x - (halo - 1) / 2, y - (halo - 1) / 2, halo, 3, this.row, 0.6, 0, this.evening ? 0.45 : 0.3);
      // the flame: a core with its tip, and a thin thread of light over it (as on the Blade)
      sink.push(x - u / 2, y - u / 2, u, 0, this.row, breath, 0, 1);
      sink.push(x - u / 2 + (n % 2), y - u / 2 - 1, 1, 0, this.row, 0.95, 0, 0.9);
      sink.push(x, y - u - 3, 1, 0, this.row, 0.8, 0, this.evening ? 0.6 : 0.4);
      sink.push(x, y - u - 5, 1, 0, this.row, 0.7, 0, this.evening ? 0.4 : 0.25);
    }
  }
}

function withLamps(scene: SceneDef, bias: number, evening: boolean): SceneDef {
  return {
    ...scene,
    build: (ctx: BuildCtx): LayerDef[] => {
      const L = scene.build(ctx);
      const si = L.findIndex((l) => l.name === "strand");
      if (si < 0) return L;
      const strand = L[si]!;
      // drawn with the scene's own route lamps (over the ground haze, so they stay legible)
      const ri = L.findIndex((l) => l.name === "route-lamps");
      const i = ri >= 0 ? ri : si;
      // the strand's reflection row is its base; the ground it stands on is just above
      const base = strand.reflect ?? 0;
      const ground = base - Math.max(2, Math.round(1.5 * ctx.u));
      const shift = biasAt(bias, COL_DEPTH);
      const k = ctx.W / 1280;
      const at = SLOTS.map(([x, dy]) => [Math.round(x * k) + shift, ground - Math.round((2.5 + dy * 0.5) * ctx.u)] as [number, number]);
      const lamps: LayerDef = {
        kind: "points",
        name: "lit-shrines",
        depth: COL_DEPTH,
        fog: 0,
        blend: "add",
        reflect: base,
        reflectFade: 14 * ctx.u,
        system: new ShoreLamps(at, ctx.row("shrine"), Math.max(1, Math.round(ctx.u)), evening),
      };
      return [...L.slice(0, i + 1), lamps, ...L.slice(i + 1)];
    },
  };
}

const wrapped = new WeakMap<BackdropSpec, BackdropSpec>();

/** The story hook's room adjustment: Ringwater's lake backdrops get the lit shrines on the far strand. */
export function ringwaterLamps(def: RoomDef): RoomDef | void {
  const bias = ROOMS[def.id];
  if (bias === undefined || def.region !== "A") return;
  // keep R-A's getters (the evening look is chosen when the room is built): copy the
  // property descriptors, and wrap only the backdrop
  const desc = Object.getOwnPropertyDescriptors(def);
  const read = (): BackdropSpec => (desc.backdrop?.get ? (desc.backdrop.get.call(def) as BackdropSpec) : def.backdrop);
  const out = Object.defineProperties({}, desc) as RoomDef;
  Object.defineProperty(out, "backdrop", {
    enumerable: true,
    configurable: true,
    get: () => {
      const bd = read();
      if (!bd?.scene || typeof bd.scene.build !== "function") return bd;
      let w = wrapped.get(bd);
      if (!w) {
        const evening = /evening/i.test(bd.scene.title);
        w = { ...bd, scene: withLamps(bd.scene, bias, evening) };
        wrapped.set(bd, w);
      }
      return w;
    },
  });
  return out;
}

/**
 * The balcony (E4, lane R-E's belfry scene): "the lamps you lit are visible in a line
 * across the valley" (section 4, E4). The scene places shrines 1 to 3 as 2 px points on the
 * valley floor, fixed when the room is built, under the valley mist: from the balcony none
 * of them could be seen (review/world/phase2/I1/lamps/). The story hook swaps that one layer
 * for the same live lamps Ringwater shows, all six places, drawn after the mist: the yard by
 * the lake under the sun, the shelter on the plain, the hollow's mouth at the spire's foot,
 * the storm alcove halfway up the spire, the pilgrim shrine on the ring, the porch below.
 * Positions are screen px at the balcony's framing, fixed to the scene's valley floor.
 */
const BALCONY: [number, number][] = [
  [648, 452],
  [492, 457],
  [214, 460],
  [107, 338],
  [352, 454],
  [700, 466],
];
/** The valley floor's top row at the balcony framing (the scene's horizon 446, plus 1). */
const FLOOR_ROW = 447;
const lifted = new WeakMap<BackdropSpec, BackdropSpec>();
export function balconyLamps(def: RoomDef): RoomDef | void {
  if (def.id !== "E4" || def.region !== "E") return;
  const bd = def.backdrop;
  if (!bd?.scene || typeof bd.scene.build !== "function") return;
  let w = lifted.get(bd);
  if (!w) {
    const scene = bd.scene;
    w = {
      ...bd,
      scene: {
        ...scene,
        build: (ctx: BuildCtx): LayerDef[] => {
          const L = scene.build(ctx);
          const plain = L.find((l) => l.name === "plain");
          if (!plain || plain.kind !== "pix") return L;
          const k = ctx.W / 1280;
          const at = BALCONY.map(([x, y]) => [plain.x + 4 + Math.round(x * k), plain.y + Math.round((y - FLOOR_ROW) * k)] as [number, number]);
          const out = L.filter((l) => l.name !== "lamps");
          const mi = out.findIndex((l) => l.name === "valley-mist");
          const lamps: LayerDef = { kind: "points", name: "lit-shrines", depth: plain.depth, fog: 0, blend: "add", system: new ShoreLamps(at, ctx.row("lamp"), Math.max(1, Math.round(ctx.u)), true) };
          out.splice(mi >= 0 ? mi + 1 : out.length, 0, lamps);
          return out;
        },
      },
    };
    lifted.set(bd, w);
  }
  return { ...def, backdrop: w };
}

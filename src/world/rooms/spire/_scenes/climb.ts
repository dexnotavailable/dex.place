// D2 the Outer Climb's backdrop (ref w02): you climb the outside of the black
// spire in the storm. Behind the catwalks, the spire's face (panels in tiers,
// ribs, a few lit windows, rain running down it, the lift's channel at the
// east edge) rises to the right of a leaning silhouette; to the left, past
// the ends of the ledges, the void: storm clouds lit from inside by
// lightning, the pale planet showing through, a sea of cloud far below with
// ruins standing out of it, and rain that leans ahead of every gust.
//
// Built for the room's size (a tall room: the far layers sink as you climb).

import { f, moveBefore, placeByDepth, Flock, Pix, megastructure, mist, sky, smooth, type LayerDef, type SceneDef } from "../../../../scenes/engine/index.ts";
import { planetBody } from "../../../../scenes/scenes/monolith-planet/planet.ts";
import { billows } from "../../../../scenes/scenes/monolith-planet/clouds.ts";
import type { WorldLayer } from "../../../backdrop/engine.ts";
import { Frame, SPIRE_PALETTE, clockLayer, cloudLightning, gustRain, spireFace, stormCloud } from "./common.ts";

export interface ClimbGeo {
  /** Room size (px). */
  w: number;
  h: number;
  /** The spire face's silhouette: room x at the room's bottom and top (px). */
  edgeBottom: number;
  edgeTop: number;
  /** The lift's channel (room px x range). */
  channel: [number, number];
  /** Dry places (room px rects): the alcove under its lintel. */
  dry: [number, number, number, number][];
}

const FACE_DEPTH = 1.15;

export function climbScene(geo: ClimbGeo): SceneDef {
  return {
    title: "spire-climb",
    palette: SPIRE_PALETTE,
    fog: {
      stops: [
        [0.0, "#05070b"],
        [0.22, "#0a0f17"],
        [0.45, "#101826"],
        [0.62, "#172333"],
        [0.76, "#213246"],
        [0.86, "#1a2738"],
        [1.0, "#0b1119"],
      ],
      bands: 18,
      density: 0.06,
      max: 0.82,
      dither: 0.5,
    },
    span: (W) => W,
    // the planet behind the storm lights the thin edges of the clouds in front of it
    prelude: (ctx) => /* glsl */ `
float sceneLight(vec2 s, float depth) {
  if (depth < 40.0) return 0.0;
  float d = length(s - vec2(${f(ctx.W * 0.2)}, ${f(ctx.H * 0.05)})) / ${f(ctx.H * 0.5)};
  return 0.32 * (1.0 - smoothstep(0.75, 1.3, d));
}`,
    build: (ctx) => {
      const { W, H, u } = ctx;
      const F = new Frame(ctx, true);
      const L: LayerDef[] = [];
      const cov = (d: number) => F.cover(d, geo.h);
      L.push(sky({ name: "sky" }));
      L.push(clockLayer());
      // the planet, high on the left, half lost in the storm
      L.push({
        kind: "glsl",
        name: "planet",
        depth: Infinity,
        fog: 0.48,
        dither: 0.5,
        body: planetBody({ x: W * 0.2, y: H * 0.05, r: H * 0.5, halo: 0.14 }),
        bounds: { y0: -1e6, y1: H * 0.05 + H * 0.5 * 1.16 },
      });
      // the storm's upper deck: dark masses sliding west, lit from inside
      L.push(stormCloud({ name: "storm-veil", depth: 90, y0: -10, y1: H * 0.66, sx: 170 * u, sy: 58 * u, drift: 3, cover: 0.5, tone: 0.2, alpha: 0.95, levels: 3 }));
      L.push(stormCloud({ name: "storm-high", depth: 70, y0: -10, y1: H * 0.46, sx: 150 * u, sy: 52 * u, drift: 6, cover: 0.6, tone: 0.1, alpha: 1, levels: 3 }));
      L.push(cloudLightning(ctx, { name: "cloud-lightning-high", depth: 60, rate: 4.5, region: [0, 10, W, H * 0.42], radius: 150 * u, strength: 0.55 }));
      // far below: the cloud sea, ruins standing out of it (it sinks as you climb)
      {
        const d = 30;
        const c = cov(d);
        const sea = Math.round(H * 0.92 + (geo.h - H) / d);
        const w = Math.ceil(c.x1 - c.x0);
        const pix = new Pix(w, sea + 30);
        const towers: [number, number, number, number, number][] = [
          [0.06, 0.2, 0.03, 0.12, 3],
          [0.22, 0.13, 0.024, -0.1, 4],
          [0.41, 0.26, 0.034, 0.2, 5],
          [0.77, 0.17, 0.026, -0.06, 6],
          [0.93, 0.22, 0.03, 0.15, 7],
        ];
        for (const [cx, hh, ww, lean, seed] of towers)
          megastructure(pix, { row: ctx.row("far"), lightRow: ctx.row("windim"), cx: cx * w, ground: sea + 10, height: hh * H, width: ww * W, lean, seed, tiers: 4, windows: 0.01, fog: (_x, y) => 0.45 * smooth(sea - H * 0.25, sea + 4, y) });
        L.push({ kind: "pix", name: "far-ruins", depth: d, pix, x: Math.round(c.x0), y: 0, dither: 0.3, twinkle: 0.3 });
        L.push(billows({ name: "cloud-sea", depth: 26, base: Math.round(H * 0.9 + (geo.h - H) / 26), wander: 4 * u, cell: 16 * u, radius: 9 * u, bottom: sea + 400, drift: -3, row: "cloud", tone: 0.14, range: 0.4, tint: 0.55, lightGain: 1.2, seed: 5, crown: 0.7 }));
      }
      L.push(cloudLightning(ctx, { name: "cloud-lightning-low", depth: 24, rate: 2.5, region: [0, H * 0.7, W, H * 0.7 + (geo.h - H) / 24 + H * 0.2], radius: 110 * u, strength: 0.4 }));
      // rain curtains and the storm's middle deck, driven west past the spire
      {
        const d = 12;
        const c = cov(d);
        L.push(stormCloud({ name: "storm-mid", depth: d, y0: c.y0, y1: c.y1, sx: 150 * u, sy: 60 * u, drift: 14, cover: 0.34, tone: 0.22, alpha: 0.7, levels: 3 }));
      }
      L.push(gustRain({ name: "rain-far", depth: 6, cw: 5, len: 6 * u, speed: 190 * u, alpha: 0.35, dens: 0.6, seed: 11, shade: 0.25, lean: 0.18, tellLean: 0.12, gustLean: 0.38, floor: 0.8 }));
      // the spire's face
      {
        const e0 = [F.x(geo.edgeBottom, FACE_DEPTH), F.y(geo.h, FACE_DEPTH)];
        const e1 = [F.x(geo.edgeTop, FACE_DEPTH), F.y(0, FACE_DEPTH)];
        L.push(
          spireFace({
            name: "spire-face",
            depth: FACE_DEPTH,
            edge: { x0: e0[0]!, y0: e0[1]!, x1: e1[0]!, y1: e1[1]!, side: 1 },
            tier: Math.round(1.9 * 80 / FACE_DEPTH),
            panel: Math.round(1.3 * 80 / FACE_DEPTH),
            rib: Math.round(3.4 * 80 / FACE_DEPTH),
            windows: 0.07,
            channel: [F.x(geo.channel[0], FACE_DEPTH), F.x(geo.channel[1], FACE_DEPTH)],
            shade: 0.2,
            seed: 21,
            wet: true,
          }),
        );
      }
      // birds sheltering low against the spire, now and then
      L.push({ kind: "points", name: "birds", depth: 9, system: new Flock({ y: [H * 0.55, H * 0.75], x: [-60, W + 60], every: 50, speed: 22 * u, count: [3, 5], row: ctx.row("bird"), shade: 0.3 }) });
      L.push({ kind: "character", name: "figure", depth: 1, x: W / 2, ground: H * 0.7 });
      // front: near rain, and a veil of spray
      L.push(gustRain({ name: "rain-near", depth: 0.8, cw: 13, len: 15 * u, speed: 420 * u, alpha: 0.5, dens: 0.42, seed: 29, shade: 0.45, lean: 0.2, tellLean: 0.14, gustLean: 0.42, floor: 0.8, pass: "front", dry: geo.dry }));
      const spray = mist({ name: "spray", depth: 0.9, y0: -10, y1: H + 10, sx: 70 * u, sy: 40 * u, drift: 34, evolve: 0.12, cover: 0.18, warp: 1.8, levels: 2, alpha: 0.22, edgeDither: 0.4, row: "rainr", tone: 0.3, tonePerLevel: 0.1, tint: 0.5, lightGain: 0.4 }) as WorldLayer;
      spray.pass = "front";
      spray.wx = (w) => Math.max(w.rain, 0.8 * (1 - w.after)) * 0.8;
      L.push(spray);
      void f;
      // the far rain (depth 5-6) falls behind anything nearer and solid (the blade's face, the crown, the lift's haze)
      placeByDepth(L, "rain-far");
      // the spray (0.9) is farther than the near rain (0.8)
      moveBefore(L, "spray", "rain-near");
      return L;
    },
  };
}

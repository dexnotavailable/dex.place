// monolith-planet: shared geometry. Everything is authored in layer pixels at
// mid-pan (== screen pixels when the camera sits in the middle of its range),
// as fractions of W/H so near (640x360) and far (960x540) compose the same.

import type { BuildCtx } from "../../engine/index.ts";

export const STRUCT_DEPTH = 14;
export const UPLIGHT_DEPTH = 16;

/** One straight section of the monolith: a slab along a spine, v < 0 is its upper-left (lit) side. */
export interface Part {
  /** Spine start (layer px) and unit direction (pointing up the structure). */
  o: [number, number];
  d: [number, number];
  /** Normal: d rotated to the right-down side. */
  n: [number, number];
  /** Spine range [a0, a1] in px along d. */
  a0: number;
  a1: number;
  /** Half width at a (px). */
  hw: (a: number) => number;
}

export interface Geo {
  W: number;
  H: number;
  u: number;
  hor: number;
  planet: { x: number; y: number; r: number };
  stem: Part;
  blade: Part;
  /** The faceted elbow joining stem and blade. */
  joint: Part;
  knee: [number, number];
  /** Along-spine offsets (px from the spine) of the conduits the light pulse runs through. */
  stemConduits: number[];
  bladeConduits: number[];
  /** Path length of the pulse: the stem from the screen bottom to the knee, then the blade. */
  stemRun: number;
  deckY: number;
  figX: number;
  /** Base of the monolith (where the blue light rises from), layer px at its own depth. */
  base: [number, number];
}

const norm = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y);
  return [x / l, y / l];
};
const right = (d: [number, number]): [number, number] => [-d[1], d[0]];

export function geo(ctx: BuildCtx): Geo {
  const { W, H, u } = ctx;
  const hor = Math.round(H * 0.74);
  const knee: [number, number] = [W * 0.405, H * 0.55];

  // stem: from well below the frame, almost vertical, up to the knee; its foot flares
  const sBase: [number, number] = [W * 0.37, H * 1.1];
  const sd = norm(knee[0] - sBase[0], knee[1] - sBase[1]);
  const sLen = Math.hypot(knee[0] - sBase[0], knee[1] - sBase[1]);
  const stemHw = W * 0.082;
  const stem: Part = {
    o: sBase,
    d: sd,
    n: right(sd),
    a0: 0,
    a1: sLen + H * 0.02,
    hw: (a) => {
      const flare = 1 - Math.min(1, Math.max(0, a / (sLen * 0.42)));
      return stemHw + W * 0.1 * flare * flare * flare;
    },
  };

  // blade: leans up and right at ~55 degrees, from just below the knee to past the top edge
  const bd = norm(0.6, -0.8);
  const bLen = (knee[1] + H * 0.45) / 0.8;
  const blade: Part = {
    o: knee,
    d: bd,
    n: right(bd),
    a0: -H * 0.06,
    a1: bLen,
    hw: (a) => W * 0.1 + W * 0.09 * Math.max(0, a / bLen),
  };
  // the elbow: a short slab along the mean direction, as wide as the blade's foot
  const jd = norm(sd[0] + bd[0], sd[1] + bd[1]);
  const jl = H * 0.07;
  const joint: Part = {
    o: [knee[0] - jd[0] * H * 0.01, knee[1] - jd[1] * H * 0.01],
    d: jd,
    n: right(jd),
    a0: -jl,
    a1: jl * 0.6,
    hw: (a) => W * 0.092 + W * 0.008 * (a + jl) / (jl * 1.6),
  };

  const stemRun = sLen - (sBase[1] - H) / Math.abs(sd[1]);
  return {
    W,
    H,
    u,
    hor,
    planet: { x: W * 0.63, y: -H * 0.36, r: H * 1.02 },
    stem,
    blade,
    joint,
    knee,
    stemConduits: [-Math.round(14 * u) - 0.5],
    bladeConduits: [-Math.round(34 * u) - 0.5, Math.round(6 * u) + 0.5],
    stemRun,
    deckY: H - Math.round(25 * u),
    figX: Math.round(W * 0.735),
    base: [W * 0.37, H * 0.86],
  };
}

/** Local (a, b) of a layer point in a part: a along the spine, b across (px, + is right-down). */
export function local(p: Part, x: number, y: number): [number, number] {
  const rx = x - p.o[0];
  const ry = y - p.o[1];
  return [rx * p.d[0] + ry * p.d[1], rx * p.n[0] + ry * p.n[1]];
}

export function toLayer(p: Part, a: number, b: number): [number, number] {
  return [p.o[0] + p.d[0] * a + p.n[0] * b, p.o[1] + p.d[1] * a + p.n[1] * b];
}

// The opening's sky, the part that is the camera's own (Dex 10-16: "I need clouds, front fog layers on the camera, wind
// and stuff affecting the ofuda's path"): the fog layers between the lens and the paper. They sweep up across the frame
// as the camera comes down through the sky, faster than anything in the world (they are nearer than the near plane),
// drifting west on the east wind. Drawn with the world's own mist (render/atmos.ts drawMist: flat steps of ordered
// dither, never smooth alpha), so they are made of the same pixels as the mist on the lake. The clouds the camera
// passes are the world's (world/sections/opening-sky.ts, the one cloud family on their planes).

import type { MistBand } from "../render/atmos.ts";
import type { Way } from "./timeline.ts";

interface Veil {
  /** T at which its middle crosses the frame's middle. */
  T: number;
  /** How fast it rises across the frame (frame heights a second). */
  speed: number;
  /** Half its thickness (share of the frame's height), how dense at its heart (0..1), its westward drift (px/s). */
  half: number;
  density: number;
  drift: number;
  /** Its colour: the sky's whites (lit) or the cloud base's cool grey. */
  tone: "lit" | "base";
}

/** The fog layers of the fall (ways 1-3): a thin one high up, the thick bank the paper goes through, two at the base. */
export const VEILS: readonly Veil[] = [
  { T: 2.1, speed: 0.34, half: 0.09, density: 0.42, drift: 16, tone: "lit" },
  { T: 5.5, speed: 0.4, half: 0.2, density: 0.82, drift: 22, tone: "lit" },
  { T: 6.3, speed: 0.4, half: 0.08, density: 0.5, drift: 30, tone: "lit" },
  { T: 8.7, speed: 0.48, half: 0.15, density: 0.62, drift: 26, tone: "base" },
  { T: 10.15, speed: 0.62, half: 0.24, density: 0.5, drift: 20, tone: "base" },
];

const LIT = [0.95, 0.96, 0.985], BASE = [0.8, 0.84, 0.9];

/** The veils on the frame at T: groups of up to four mist bands (one draw each), with their colour and drift rate. */
export function fallVeils(T: number, W: number, Hf: number, way: Way, reduced: boolean): { bands: MistBand[]; colour: number[]; rate: number }[] {
  void W;
  if (way === "bottom" || reduced) return [];
  const out: { bands: MistBand[]; colour: number[]; rate: number }[] = [];
  for (const tone of ["lit", "base"] as const) {
    const bands: MistBand[] = [];
    for (const v of VEILS) {
      if (v.tone !== tone) continue;
      const row = Hf * (0.5 - (T - v.T) * v.speed);
      const half = v.half * Hf;
      if (row < -2.5 * half || row > Hf + 2.5 * half) continue;
      bands.push({ row, half, density: v.density, drift: v.drift });
    }
    if (bands.length) out.push({ bands: bands.slice(0, 4), colour: tone === "lit" ? LIT : BASE, rate: 0.6 });
  }
  return out;
}

// Grey-box backdrops: a stepped sky (or a dark interior wash) in the region's
// light, a far horizon band and a 1 H survey grid in the distance, so every
// grey-box room reads as the right time and place without pretending to be
// art. One scene per mood; rooms with the same mood share identical shader
// source, so the browser compiles each program once. Region lanes replace
// these with their own scenes.

import { f, sky } from "../../scenes/engine/layers.ts";
import type { Hex } from "../../scenes/engine/palette.ts";
import type { GlslLayer, SceneDef } from "../../scenes/engine/types.ts";

export type Mood = "morning" | "overcast" | "amber" | "storm" | "dusk" | "lodge" | "archive" | "tile" | "chapel" | "evening";

const SKIES: Record<Mood, { stops: [number, Hex][]; band: Hex; grid: Hex; horizon: number; inside: boolean }> = {
  morning: { stops: [[0, "#5d7f8c"], [0.55, "#a9bdb8"], [0.75, "#d9d2bb"], [1, "#6f8a88"]], band: "#4e6668", grid: "#8fa5a3", horizon: 0.72, inside: false },
  overcast: { stops: [[0, "#4a4854"], [0.6, "#77727c"], [0.78, "#8d8588"], [1, "#3b3a42"]], band: "#3a3942", grid: "#6a6670", horizon: 0.7, inside: false },
  amber: { stops: [[0, "#1a100a"], [0.5, "#4a2c16"], [0.8, "#6e4020"], [1, "#24160d"]], band: "#2c1a0f", grid: "#5e3a1e", horizon: 0.75, inside: true },
  storm: { stops: [[0, "#12161f"], [0.5, "#252c3a"], [0.8, "#323a4a"], [1, "#0e1118"]], band: "#1a1f2a", grid: "#3a4456", horizon: 0.7, inside: false },
  dusk: { stops: [[0, "#2a2140"], [0.45, "#7a4a5a"], [0.72, "#d49a70"], [1, "#3a2838"]], band: "#3a2a3c", grid: "#8a6070", horizon: 0.74, inside: false },
  evening: { stops: [[0, "#141a2c"], [0.5, "#3a3450"], [0.75, "#8a6060"], [1, "#1c1e2a"]], band: "#262436", grid: "#5a5068", horizon: 0.72, inside: false },
  lodge: { stops: [[0, "#1a1410"], [0.6, "#34281e"], [1, "#1c1611"]], band: "#2a2018", grid: "#4a3a2c", horizon: 0.8, inside: true },
  archive: { stops: [[0, "#120f0c"], [0.6, "#2a2016"], [1, "#140f0b"]], band: "#1e1812", grid: "#3a2e20", horizon: 0.8, inside: true },
  tile: { stops: [[0, "#1a1e20"], [0.6, "#2e3436"], [1, "#161a1c"]], band: "#23282a", grid: "#48524f", horizon: 0.8, inside: true },
  chapel: { stops: [[0, "#1a1418"], [0.5, "#3a2a30"], [1, "#1a1216"]], band: "#2a1e24", grid: "#5a4250", horizon: 0.8, inside: true },
};

const cache = new Map<Mood, SceneDef>();

export function blockoutScene(mood: Mood): SceneDef {
  const hit = cache.get(mood);
  if (hit) return hit;
  const m = SKIES[mood];
  const rgb = (h: Hex): string => {
    const v = parseInt(h.slice(1), 16);
    return `vec3(${f(((v >> 16) & 255) / 255)}, ${f(((v >> 8) & 255) / 255)}, ${f((v & 255) / 255)})`;
  };
  // far survey grid: faint lines every 4 H at depth 6 (it pans slower than the player plane), and a horizon band
  const far: GlslLayer = {
    kind: "glsl",
    name: "survey",
    depth: 6,
    fog: 0,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float hz = uRes.y * ${f(m.horizon)};
  float g = 320.0 / 6.0;
  float gx = step(mod(p.x, g), 0.99);
  float gy = step(mod(s.y, g), 0.99);
  vec3 c = fogColor(s);
  ${m.inside ? `c = mix(c, ${rgb(m.grid)}, (gx + gy) * 0.18);` : `if (s.y > hz) c = mix(c, ${rgb(m.band)}, 0.85); c = mix(c, ${rgb(m.grid)}, gx * step(hz, s.y) * 0.25);`}
  return vec4(c, 1.0);
}`,
  };
  const def: SceneDef = {
    title: `grey-box ${mood}`,
    palette: { standin: ["#07070a", "#101015", "#24232c", "#a29792"] },
    fog: { stops: m.stops, bands: 10, dither: 0.6, density: 0.2, max: 0.5 },
    span: (W) => W,
    build: () => [sky({ name: "sky" }), far],
  };
  cache.set(mood, def);
  return def;
}

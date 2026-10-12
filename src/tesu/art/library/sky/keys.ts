// Time-of-day keys for Tesu's sky, haze, mist and still water (the art bible's light
// table, as data). The sky gradient, sun, haze, mist and water colours are shader inputs,
// not palette entries, so they can be exact. Morning is authored and composited (a fresh
// arrival is always morning, GDK 6.7); day, dusk and night are first proposals.
//
// The builder's Atmos entry takes sky, haze, mist, mistColour and sun; the water colours
// are asked for as data in lanes/ART-REQUESTS.md (today they are fixed in game.ts).

export interface SkyKey {
  id: "morning" | "day" | "dusk" | "night";
  /** Sky top, horizon band and low (below the horizon, for the reflection's far edge). */
  sky: [string, string, string];
  /** Haze colour every background plane fades toward. */
  haze: string;
  /** Strength (0..1) and colour of the shader's drifting mist bands at the waterlines. */
  mist: number;
  mistColour: string;
  /** Sun (or moon) as a share of the frame, upper left in the morning; null for none. */
  sun: [number, number] | null;
  /** Still water: deep (near the viewer), body, shallow (toward the far shore), glint. */
  water: { deep: string; body: string; shallow: string; glint: string };
  /** Colour grade for plates (multiply rgb by amount), as the plane shader takes it. */
  grade: [number, number, number, number];
  /** The direction light comes from, for painters (unit vector, y down). */
  light: [number, number];
}

export const MORNING: SkyKey = {
  id: "morning",
  // a soft blue overhead going to a pale jade-white haze at the horizon (Wuling mornings)
  sky: ["#8fb6cf", "#d3e6e3", "#edf5ef"],
  haze: "#dce9e4",
  mist: 0.8,
  mistColour: "#f2f7f2",
  sun: [0.2, 0.11],
  water: { deep: "#235f60", body: "#4a9a90", shallow: "#c3e2d9", glint: "#fffbe8" },
  grade: [1, 1, 1, 0],
  light: [-0.62, -0.78],
};

export const DAY: SkyKey = {
  id: "day",
  sky: ["#7aa9cf", "#cde2ea", "#eaf3f2"],
  haze: "#d9e7ea",
  mist: 0.45,
  mistColour: "#f1f6f7",
  sun: [0.52, 0.06],
  water: { deep: "#1f5a62", body: "#3f8f8f", shallow: "#bfe0de", glint: "#ffffff" },
  grade: [1, 1, 1, 0],
  light: [-0.2, -0.98],
};

export const DUSK: SkyKey = {
  id: "dusk",
  sky: ["#5d6f9e", "#f2b48f", "#f7d9bd"],
  haze: "#e9c7b3",
  mist: 0.6,
  mistColour: "#f6dccb",
  sun: [0.82, 0.3],
  water: { deep: "#2b3d58", body: "#6a6f88", shallow: "#f0c2a2", glint: "#ffe2b0" },
  grade: [1.02, 0.9, 0.86, 0.55],
  light: [0.85, -0.53],
};

export const NIGHT: SkyKey = {
  id: "night",
  sky: ["#121a33", "#2a3a62", "#3a4b72"],
  haze: "#2c3a5c",
  mist: 0.5,
  mistColour: "#53668f",
  sun: [0.74, 0.14],
  water: { deep: "#0b1326", body: "#1b2a48", shallow: "#3a4d78", glint: "#ffe6a8" },
  grade: [0.42, 0.5, 0.78, 0.85],
  light: [0.4, -0.92],
};

export const KEYS = { morning: MORNING, day: DAY, dusk: DUSK, night: NIGHT } as const;

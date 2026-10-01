// E1 The Pilgrim Path on the ring segment (lane R-E; WORLD-PLAN section 4, E1):
// the long exhale after the storm. 80 H long, dropping 44 H down a fallen ring
// segment at dusk in flights of standard steps with small landings; free
// camera leaning downhill (feet at half the view). Shrine 5 on its terrace
// halfway down; after you rest there the lamp posts below come on one after
// another toward the chapel. One missing panel is a single jump (1.1 H), or
// walk down into the ring bay under it and up its steps. The rib bell hangs
// off the path: climb the rib's brackets (0.9 and 1.2 H) or jump and strike.
// Stained glass stands in the hull's fins and throws coloured light on the
// path; it shatters freely here and mends (the one place breaking glass is a
// pleasure). Candles on the landings, processional banners on poles, grass and
// flowers where soil has gathered, puddles holding the sunset.

import { h } from "../../config.ts";
import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";
import type { RoomDef } from "../../room/types.ts";
import { PATH, pilgrimScene } from "../../../scenes/scenes/pilgrim-path.ts";
import { RoomBuilder } from "./_room.ts";

const LIGHT = lighting({
  ambient: [0.3, 0.25, 0.32],
  keyDir: [-0.7, -0.35, 0.6],
  keyColour: [0.86, 0.58, 0.46],
  rimColour: [1, 0.66, 0.5],
  rimDir: [-0.9, -0.4],
  rimIntensity: 1,
});

const r = new RoomBuilder({
  id: "E1",
  title: "E1 Pilgrim Path",
  x0: PATH.x0,
  x1: PATH.x1,
  top: PATH.top,
  bottom: PATH.bottom,
  camera: { mode: "free", anchor: PATH.anchor, lookY: 1.5 },
  audio: { music: "theme", bed: "dusk", weatherThrough: 1, surface: "stone" },
  weather: { state: "after", time: "dusk" },
  neighbours: ["D4", "E2"],
  lighting: LIGHT,
  surface: "stone",
});

// --- the ground: every tread and landing of PATH (the picture is drawn from the same list) ---
for (const s of PATH.segs) {
  if (s.kind === "flat") r.floor(s.x, s.to, s.y);
  else if (s.kind === "stairs") r.flight(s.x, s.y, s.n, -1);
  else for (const [a, b, y] of s.bay) r.floor(a, b, y);
}
// the rib's climbing brackets (one-way ledges, 0.9 and 1.2 H apart)
for (const [a, b, y] of PATH.rib.ledges) r.ledge(a, b, y);

/** Ground elevation at world x (the top of the tread there). */
export function groundAt(x: number): number {
  for (const s of PATH.segs) {
    if (s.kind === "flat" && x < s.to) return s.y;
    if (s.kind === "stairs" && x < s.x + 0.3 * s.n) return +(s.y - 0.2 * (Math.floor((x - s.x) / 0.3 + 1e-6) + 1)).toFixed(4);
    if (s.kind === "gap" && x < s.to) {
      for (const [, b, y] of s.bay) if (x < b) return y;
    }
  }
  return 40;
}

// --- shrine 5, the Pilgrim Shrine, on its terrace (351.6..358) ---
const T = 62;
r.px("bench", "bench-5", 352.6, T, { kind: "stone", length: 1.7 });
r.px("donationBox", "box-5", 354.0, T, { dest: "donate" });
r.px("donorPlaque", "plaque-5", 354.8, T + 0.95);
r.px("offeringBowl", "bowl-5", 355.8, T);
r.px("shrineLantern", "shrine-5", 356.8, T, { flag: "shrine:5", n: 5 });
r.px("candles", "candles-5", 357.5, T, { count: 5, stand: "ledge", layout: "row" });
r.px("puddle", "puddle-5", 353.3, T, { width: 1.1, sky: "dusk" });
r.px("grass", "flowers-5", 351.9, T, { kind: "flowers", width: 0.9, height: 0.22 });
r.spawn("shrine", 356.0, T, 1);

// --- the lamp posts to the chapel: dark until shrine 5 is lit, then one after another ---
// on mid-flight treads (each at a tread's middle), clear of the glass fins on the landings
[368.75, 378.95, 389.25, 395.2].forEach((x, i) => r.px("pathLamp", `lamp-5-${i}`, x, groundAt(x), { shrine: "shrine-5", order: i, arm: 1 }));

// --- stained glass in the fins; candles and banners on the landings ---
PATH.fins.forEach(([x, y], i) => r.px("stainedGlass", `glass-${i}`, x, y + 0.9, { width: 1.5, height: 2.9, drop: h(0.9), slant: 0.5 }));
// the DOOR RULE: the glass surrounds are cut from the hull the fins are made of, not the kit's grey stone
r.px("wallSet", "glass-set", 316.3, 84, { props: PATH.fins.map((_, i) => `glass-${i}`), part: "frame", to: "hullStone" });
r.px("candles", "candles-l1", 323.95, 79.2, { count: 4, stand: "ledge", layout: "row" });
r.px("candles", "candles-deck", 332.0, 74.4, { count: 3, stand: "none", layout: "cluster" });
r.px("candles", "candles-l5", 364.0 + 0.15, 58.0, { count: 3, stand: "none", layout: "cluster" });
r.px("candles", "candles-l7", 385.0, 46.0, { count: 4, stand: "ledge", layout: "row" });
r.px("clothHanging", "banner-1", 316.35, 84, { kind: "pennant", colour: "red", width: 0.5, length: 1.1 });
r.px("clothHanging", "banner-2", 351.8, T, { kind: "pennant", colour: "gold", width: 0.5, length: 1.1 });
r.px("clothHanging", "banner-3", 384.35, 46.0, { kind: "pennant", colour: "indigo", width: 0.5, length: 1.1 });
r.px("puddle", "puddle-deck", 332.6, 74.4, { width: 0.9, sky: "dusk" });
r.px("puddle", "puddle-l6", 374.0 + 0.2, 52.0, { width: 0.7, sky: "dusk" });
r.px("grass", "grass-l1", 324.0, 79.2, { kind: "grass", width: 0.55, height: 0.2 });
r.px("grass", "flowers-l6", 374.55, 52.0, { kind: "flowers", width: 0.5, height: 0.2 });
r.px("grass", "grass-bottom", 394.4, 40, { kind: "flowers", width: 1.0, height: 0.24 });
// off the rib's arm, west of the bell (never over it)
r.px("vines", "vines-rib", PATH.rib.x + 0.72, PATH.rib.tipY + 0.2, { width: 0.5, length: 0.8, strands: 4, flowers: true });
// down the fin's west shoulder, rooted just under its crest (pilgrim-path.ts: the crest there is 3.45..3.7 H
// over the landing), clear of the glass's reveal: never hanging from open sky above the wall
r.px("vines", "vines-fin-2", 364.5 - 1.2, 58.0 + 3.36, { width: 0.42, length: 1.5, strands: 4 });
r.px("rubble", "rubble-gap", 335.7, groundAt(335.7), { kind: "stone", width: 0.5, height: 0.2 });
r.px("moths", "moths-shrine", 356.8, T, { count: 4, reach: 3 });
r.px("moths", "moths-lamps", 384.7, 46.0, { count: 3, reach: 3 });

// --- the rib bell: struck, it swings and rings, and the sound carries across the valley ---
r.px("hangingBell", "rib-bell", PATH.rib.tipX, PATH.rib.tipY, { size: "medium" });

r.spawn("west", 316.5, 84, 1).spawn("east", 395.8, 40, -1);
r.exit("left", "D4", "east", 82, 87).exit("right", "E2", "west", 38.5, 42);

export const e1: RoomDef = r.build({ scene: pilgrimScene, vertical: 1, weather: true }, { ambient: { dust: 6, moths: true }, blend: fromLight(LIGHT, { amount: 0.15, haze: 0.3, band: 0.7, halo: 1.1 }) });

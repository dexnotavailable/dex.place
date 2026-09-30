// D3 the Crown (lane R-D; WORLD-PLAN section 4, D3): the arena on the spire's
// flat top, 32 x 12.6 H, where the storm peaks. Downloads live here: the boss
// terminal (P0's bossTerminal) stands at the west end under an overhang; its
// screen shows the real product list while it is awake (terminalRoster); E
// again summons (the five floor seals light one after another, the arena
// shutters roll down, the lights turn red, the arena music comes in, the camera
// clamps to the arena); the seal holds, then, since no warden exists yet, it
// cools down, the screen says the download is on the website below, and the
// runtime's panel links it. No fake fight, no fake download. Past wins unlock
// nothing.
//
// West to east: the way in from the climb, the west shutter, the terminal
// under its overhang with two banners behind it, a pillar line, the fight floor
// with the ring of five seals, a pillar line, the east shutter, the lift's gate,
// the express lever (S3: E throws it for good and the lift runs from the Lift
// Foot straight here), and the way on to the Blade.

import { Spire, LIGHT, RAMP } from "./_build.ts";
import { crownScene } from "./_scenes/crown.ts";

const d3 = new Spire({
  id: "D3",
  title: "D3 The Crown",
  x0: 252,
  x1: 284,
  top: 86,
  bottom: 73.4,
  camera: { mode: "rail", anchor: 0.72 },
  audio: { music: "none", bed: "storm", weatherThrough: 1, surface: "wet-metal" },
  weather: { state: "rain", time: "day" },
  neighbours: ["D2", "D1", "D4"],
  lighting: LIGHT.storm,
  surface: "wet-metal",
  ramp: RAMP.iron,
  art: "none",
});
const H80 = 80;

// the arena clamp while the terminal summons and holds its seal: the view stays on the arena, and
// centres on the seal ring (268) so the five seals are seen lighting one after another
d3.s.camera.arena = { x0: d3.X(252.3), x1: d3.X(279.9), focus: d3.X(268) };

// the floor, and the overhang the terminal stands under
d3.floor(252, 284, 76, 2.4);
d3.px("spireDeck", "arena-floor", 252, 76, { width: 32 * H80, depth: 1.3, kind: "arena", lip: "none" });
d3.block(254.2, 257.4, 80, 79.5);
d3.px("spireDeck", "overhang", 254.2, 80, { width: 3.2 * H80, depth: 0.5, kind: "landing", lip: "none" });

// the storm, and its hand on the props
d3.prop("spire-storm", "storm", 252.5, 84, { strength: 1 }, { engine: "stub" });
d3.px("stormDirector", "storm-hand", 252.5, 84, { mode: "storm" });

// the arena: shutters, terminal and roster, banners, pillars, seals
// the shutters stand open while the arena is idle; E on one steps you through it
d3.door("shutter-w", "door", 253.05, 76, { room: "D2", spawn: "top" }, { kind: "shutter", open: true, beyond: "none", frame: "iron" }, { engine: "pixel" });
d3.px("spirePortal", "portal-w", 253.05, 76, { kind: "shutter" });
d3.px("stormBanner", "banner-w", 254.3, 79.4, { colour: "red", length: 2.3 });
d3.px("stormBanner", "banner-e", 256.6, 79.4, { colour: "indigo", length: 2.3 });
d3.px("bossTerminal", "terminal", 254.6, 76, { dest: "downloads" });
d3.px("terminalRoster", "roster", 254.6, 76, { terminal: "terminal" });
d3.px("pillar", "pillar-w1", 258.4, 76, { kind: "round", height: 2.3, width: 0.42, stone: "stoneDark" });
d3.px("pillar", "pillar-w2", 259.6, 76, { kind: "broken", height: 0.9, width: 0.46, stone: "stoneDark" });
d3.px("arenaSeals", "seals", 268, 76, { spacing: 2.5, terminal: "terminal", shutters: ["shutter-w", "shutter-e"] });
d3.px("pillar", "pillar-e2", 274.8, 76, { kind: "broken", height: 0.9, width: 0.46, stone: "stoneDark" });
d3.px("pillar", "pillar-e1", 276.0, 76, { kind: "round", height: 2.3, width: 0.42, stone: "stoneDark" });
d3.door("shutter-e", "door", 278.2, 76, { room: "D3", spawn: "lift" }, { kind: "shutter", open: true, beyond: "none", frame: "iron" }, { engine: "pixel" });
d3.px("spirePortal", "portal-e", 278.2, 76, { kind: "shutter" });

// the fight floor's leavings, the rain on it, the storm's marks
d3.px("brokenArmour", "armour-1", 262.2, 76, { pieces: ["helm", "pauldron", "greave"], slide: [-2, 3] });
d3.px("brokenArmour", "armour-2", 271.8, 76, { pieces: ["greave", "helm"], slide: [-3, 1.5] });
d3.px("puddle", "puddle-1", 265.8, 76, { width: 1.6, sky: "storm" });
d3.px("puddle", "puddle-2", 270.6, 76, { width: 1.2, sky: "storm" });
d3.px("rubble", "rubble-w", 260.5, 76, { kind: "stone", width: 0.9, height: 0.3 });
d3.px("rubble", "rubble-e", 273.6, 76, { kind: "stone", width: 1.0, height: 0.32 });
for (const [x, k] of [[261.0, 0], [283.7, 2]] as const) d3.px("clothHanging", `pennant-${k}`, x, 76, { kind: "pennant", colour: "red" });
d3.px("warningLight", "beacon-w", 260.8, 79.2, { mode: "blink", mount: "wall", arena: true, phase: 0 });
d3.px("warningLight", "beacon-e", 273.6, 79.2, { mode: "blink", mount: "wall", arena: true, phase: 0.6 });
d3.px("warningLight", "beacon-lift", 283.3, 79.7, { mode: "blink", mount: "wall", arena: true, phase: 0.3 });

// the lift's gate (the express stop), the express lever (S3)
d3.door("lift-top", "door", 281.1, 76, { room: "D1", spawn: "top" }, { kind: "gate", open: true, beyond: "dark", frame: "iron" }, { engine: "pixel" });
d3.px("spirePortal", "portal-lift", 281.1, 76, { kind: "gate" });
d3.px("lever", "express-lever", 282.9, 76, { flag: "lever:express", mount: "floor" });

d3.spawn("west", 252.6, 76, 1).spawn("lift", 281.1, 76, -1).spawn("east", 283.4, 76, -1);
d3.exit("left", "D2", "top").exit("right", "D4", "west");

export const crown = d3.build(crownScene({ camY: d3.Y(76) - 0.72 * 720, floorS: Math.round(0.72 * 720) }), { hide: ["wx-rain-far", "wx-rain-near"] });

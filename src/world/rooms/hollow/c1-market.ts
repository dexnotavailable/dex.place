// C1 Foundry Market (WORLD-PLAN section 4, region C): the hub, shrine 3, the
// one dense place CANON allows. A street at y -32 along a ledge in the
// hollow, an upper walkway at -26 (grating, stairs at both ends, a 1.9 H gap
// that is a double-jump line to a rooftop bench over the archive), stalls
// under the walkway, the Hearth Shrine in a furnace-warm alcove, the
// archive's ordinary door in the back alley, and the hollow itself behind:
// the amber-hollow scene, re-framed for the street (_scene/market.ts).
//
// Geometry and ids match the grey-box (rooms/_blockout/c-hollow.ts), so the
// round's spawns, exits and doors, and W0's round bot, carry over.

import { h, SCALE } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";
import { marketScene } from "./_scene/market.ts";
import { dressTerrain, HOLLOW_RAMP } from "./_room.ts";

const X0 = 188;
const X1 = 252;
const STREET = -32;
const WALK = -26;
const TOP = -20;
const px = { engine: "pixel" as const };
/** The archive's door, the bracket lamp beside its surround, the paper lanterns under the walkway. */
const DOOR = 232;
const DOOR_LAMPS: [number, number][] = [
  [230.85, STREET + 2.2],
  [233.15, STREET + 2.2],
];
const LANTERNS = [203.6, 207.4, 224.6, 228.6, 235.6];

const b = new Box({
  id: "C1",
  title: "C1 Foundry Market",
  region: "C",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: -35.3,
  mood: "amber",
  camera: { mode: "rail", anchor: 0.64, slack: 2 },
  audio: { music: "theme", bed: "market", muffle: 1, weatherThrough: 0, surface: "stone" },
  weather: { state: "serene", time: "day" },
  neighbours: ["B5", "C2", "C3"],
  underground: true,
});

// --- ground, the walkway and its stairs (collision; pixel props draw them) ----------------------
b.floor(X0, X1, STREET);
const wx = b.treads(192, STREET, WALK, 1, "grating");
b.ledge(wx, 220, WALK, "grating");
// a 1.9 H gap in the walkway: a double-jump line to the rooftop bench over the archive
b.ledge(221.9, 239, WALK, "grating");
b.treads(248, STREET, WALK, -1, "grating");
b.prop("gratingStair", "stair-w", 192, STREET, { rise: 6, dir: 1 }, px);
b.prop("gratingWalk", "walk-w", wx, WALK, { length: 220 - wx }, px);
b.prop("gratingWalk", "walk-e", 221.9, WALK, { length: 239 - 221.9 }, px);
b.prop("gratingStair", "stair-e", 248, STREET, { rise: 6, dir: -1 }, px);
// the destructible street: flagstones that crater and heal
// (its dressing, below: contact shadows under what stands on it, pools under its lights, the straps
// where its supports run, drains; added once the props are placed)
const FLOORS: [string, number][] = [
  ["street-w", X0],
  ["street-e", X0 + 32],
];

// --- stalls (4; one empty), their people, their roofs (optional rooftops 1.8 H up) ---------------
const stalls: [string, number, string, [string, string], string | null][] = [
  ["stall-tools", 196.8, "tools", ["clothRed", "clothPale"], "hammer"],
  ["stall-lamps", 205.2, "lamps", ["clothTeal", "clothPale"], "sort"],
  ["stall-empty", 236.8, "empty", ["clothGold", "burlap"], null],
  ["stall-cloth", 249.8, "cloth", ["clothIndigo", "clothGold"], "sit"],
];
for (const [id, x, kind, awning, who] of stalls) {
  if (who) b.prop("marketFigure", `${id}-keeper`, x + (who === "sit" ? 0.5 : 0.3), STREET, { kind: who, height: who === "sit" ? 0.95 : 1.0 }, px);
  b.prop("marketStall", id, x, STREET, { kind, awning, lit: kind !== "empty", width: 2.8 }, px);
  if (kind !== "empty") b.ledge(x - 1.4, x + 1.4, STREET + 1.8, "wood");
}
b.prop("hollowRadio", "radio-market", 206.1, STREET + 0.55, {}, px);
b.prop("moths", "moths-lamps", 204.2, STREET + 1.6, { count: 4, reach: 2 }, px);
// crates to climb onto the tools stall's roof (0.9 H), barrels
b.prop("crate", "crates-w", 194.5, STREET, { size: 0.45, stack: 2 }, px);
b.prop("barrel", "barrel-w", 199.3, STREET, {}, px);
b.prop("crate", "crates-e", 239.4, STREET, { size: 0.5, stack: 1 }, px);
b.prop("barrel", "barrel-e", 240.3, STREET, {}, px);

// --- the Hearth Shrine (shrine 3) in the furnace alcove: lantern, bowl, box, plaque, bench, fire --
b.prop("shrineLantern", "shrine-3", 212.2, STREET, { n: 3, flag: "shrine:3" }, px);
// its light on the alcove once it is lit (a slow rise: hollowShrineHalo)
b.prop("hollowShrineHalo", "shrine-3-halo", 212.2, STREET, { watch: "shrine-3", head: 1.06 }, px);
b.prop("offeringBowl", "bowl-3", 211.2, STREET, { petals: 2 }, px);
b.prop("donationBox", "box-3", 213.6, STREET, { dest: "donate" }, px);
b.prop("donorPlaque", "plaque-3", 214.4, STREET + 0.95, {}, px);
b.prop("bench", "bench-3", 215.9, STREET, { kind: "stone", length: 1.8 }, px);
b.prop("hearthFire", "hearth-3", 217.7, STREET, { width: 1.2 }, px);
b.spawn("shrine", 211.4, STREET, 1);

// --- the archive door in the back alley: an ordinary door, a small lamp above, the book mark ----
// a steel door in the brick and iron of the foundry, not a cottage plank door (it opens the same)
// warm: the steel takes the street's amber; sill: it stands on the doorway's threshold step; recess:
// its head sits in the lintel's shadow (the opening is cut 6 px deeper than the leaf all round)
b.prop("hollowDoor", "archive-door", DOOR, STREET, { kind: "ordinary", frame: "iron", leaf: "iron", warm: true, sill: 8, recess: 6 }, px);
b.doors["archive-door"] = { room: "C2", spawn: "door" };
// the book mark sits in the doorway's tympanum, under the keystone; the lamp hangs from a wall bracket
// beside the surround (the backdrop builds the doorway into the archive block: _scene/market.ts)
b.prop("neonGlyph", "archive-mark", DOOR, STREET + 1.78, { kind: "book", colour: "amber" }, px);
for (const [i, [x, y]] of DOOR_LAMPS.entries()) b.prop("marketLantern", i ? `archive-lamp-${i}` : "archive-lamp", x, y, { kind: "iron", drop: 0.22 }, px);
b.prop("paper", "paper-archive", 233.4, STREET, { count: 3 }, px);

// --- the market's working parts: neon, vents, junction boxes, the red pipe, the crane, cables -----
// every sign is held by something: posts on the open street, standoffs on the archive's wall, chains
// under the east stair
b.prop("neonGlyph", "neon-1", 199.9, STREET + 3.1, { colour: "rose", count: 3, vertical: true, mount: "pole", pole: 3.1 }, px);
b.prop("neonGlyph", "neon-2", 207.6, STREET + 3.4, { colour: "teal", count: 4, vertical: false, mount: "pole", pole: 3.4 }, px);
b.prop("neonGlyph", "neon-3", 227.6, STREET + 3.6, { colour: "amber", count: 3, vertical: true }, px);
b.prop("neonGlyph", "neon-4", 243.4, STREET + 2.4, { colour: "rose", count: 4, vertical: false, mount: "chains", pole: 0.5 }, px);
b.prop("steamVent", "vent-1", 208.4, STREET, { period: 9 }, px);
b.prop("steamVent", "vent-2", 241.6, STREET, { period: 11, strength: 0.8 }, px);
// puddles hold the lamps over them as broken streaks (there is no sky down here to hold)
b.prop("hollowPuddle", "puddle-1", 206.9, STREET, { width: 1.1, lamps: [LANTERNS[1]! - 206.9] }, px);
// (what hangs over it is the rose neon on its chains, not a lamp: the streak is rose)
b.prop("hollowPuddle", "puddle-2", 242.9, STREET, { width: 1.0, lamps: [243.4 - 242.9], tints: ["rose"] }, px);
b.prop("hollowPuddle", "puddle-door", 230.3, STREET, { width: 1.1, lamps: [DOOR_LAMPS[0]![0] - 230.3] }, px);
b.prop("junctionBox", "jbox-1", 202.4, STREET + 1.5, { conduit: 4 }, px);
b.prop("junctionBox", "jbox-2", 222.3, STREET + 1.6, { conduit: 4 }, px);
b.prop("redPipe", "pipe-w", 201.2, WALK + 0.62, { length: 18.6, valve: 0.4 }, px);
b.prop("redPipe", "pipe-e", 222.1, WALK + 0.62, { length: 16.7, valve: 0.7 }, px);
// along the street toward the lift: it rises out of the street past the barrel and goes back down
// before the east stair (it used to run on through the stair's bottom treads)
b.prop("redPipe", "pipe-lift", 240.75, STREET + 0.35, { length: 6.1, valve: 0.5, drop: 0.35 }, px);
b.prop("jibCrane", "crane", 227.2, STREET, { mast: 8.1, jib: 5.8, dir: -1, drop: 1.2 }, px);
// cables strung under the walkway in short spans, a chain with a hook hanging over the west end
for (const [i, [x, dx]] of ([[203.2, 2.6], [223.4, 2.6]] as [number, number][]).entries())
  b.prop("hollowCable", `cable-${i}`, x, WALK - 0.35, { kind: "cable", to: [dx, i % 2 ? 0.08 : -0.06], slack: 1.07, swing: 0.45 }, px);
b.prop("hollowCable", "chain-w", 190.2, TOP - 0.2, { kind: "chain", free: true, length: 3.2, swing: 0.9 }, px);
for (const [i, x] of LANTERNS.entries()) b.prop("marketLantern", `lantern-${i}`, x, WALK - 0.3, { kind: "paper", drop: 0.7 + (i % 2) * 0.25 }, px);

// --- air: grit from the walkway's underside and the ceiling (in time with the footfalls), motes ----
b.prop("hollowFootfalls", "footfalls", X0 + 0.2, STREET, { every: 70, length: 30, step: 2.5, offset: 18 }, px);
for (const [i, [x, w, hh]] of ([[188.5, 3, 11.6], [201.5, 7, 5.8], [213, 6, 5.8], [222.5, 8, 5.8], [241, 10, 11.6]] as [number, number, number][]).entries())
  b.prop("dust", `grit-${i}`, x, STREET, { kind: "grit", width: w, height: hh }, px);
b.prop("dust", "motes-shrine", 210.5, STREET, { kind: "dust", width: 7, height: 3, count: 26, lit: true }, px);
b.prop("dust", "motes-west", 194, STREET, { kind: "dust", width: 8, height: 4, count: 18, lit: true }, px);
b.prop("dust", "embers-hearth", 216.8, STREET, { kind: "embers", width: 1.6, height: 1.2, count: 6 }, px);

// --- street lamp posts: toward shrine 3 once shrine 2 is lit, beyond it once shrine 3 is ----------
// (lamp-3-1 stood inside the east stair's span, its treads cutting across the post: it now stands
// clear of the stair, under the walkway's end, its arm out over the crates)
const lamps: [string, number, number, number, 1 | -1][] = [
  ["lamp-2-0", 190.4, 2, 0, 1],
  ["lamp-2-1", 200.6, 2, 1, -1],
  ["lamp-3-0", 226.0, 3, 0, 1],
  ["lamp-3-1", 238.7, 3, 1, 1],
];
for (const [id, x, , , arm] of lamps) b.prop("lampPost", id, x, STREET, { lit: false, arm }, px);
b.prop("hollow-wick", "wick", X0 + 0.1, STREET, { lamps: lamps.map(([id, , n, order]) => ({ id, flag: `shrine:${n}`, order })) }, { engine: "stub" });

// --- the street's dressing: where its supports run (posts under the girder, straps on the ledge's
// face, under the walkway's columns too), contact shadows under everything that stands on it
// [x, width] (world H), pools of light under the hearth, the lit stalls, the door's lamps and the
// paper lanterns [x, radius, strength], drains weeping down the face --------------------------------
const RIBS = [190.6, 194.8, 198.4, 202.4, 206.6, 210.4, 214.6, 219.9, 222.3, 226.6, 230.4, 234.6, 238.4, 242.4, 246.4, 250.4];
const SHADOWS: [number, number][] = [
  ...stalls.map(([, x]) => [x, 2.9] as [number, number]),
  [194.5, 0.55], [199.3, 0.55], [239.4, 0.6], [240.3, 0.55],
  [212.2, 0.55], [211.2, 0.45], [213.6, 0.55], [215.9, 1.9], [217.7, 1.5],
  ...lamps.map(([, x]) => [x + 0.16, 0.4] as [number, number]),
  [227.2, 0.9], [DOOR, 2.6], [199.9, 0.25], [207.6, 0.25], [192.4, 0.8], [247.6, 0.8],
  [240.8, 0.2], [246.8, 0.2],
];
const POOLS: [number, number, number][] = [
  [217.7, 2.2, 1], [196.8, 1.3, 0.5], [205.2, 1.3, 0.5], [249.8, 1.3, 0.45],
  [DOOR, 1.6, 0.6], ...LANTERNS.map((x) => [x, 0.9, 0.3] as [number, number, number]),
];
const DRAINS = [196.2, 209.1, 223.7, 236.1, 244.6];
for (const [id, x0] of FLOORS) {
  const rel = (x: number): number => x - x0;
  const inside = (x: number, pad = 0): boolean => x >= x0 - pad && x < x0 + 32 + pad;
  b.prop("hollowFloor", id, x0, STREET, {
    width: h(32),
    depth: 1.2,
    kind: "flagstone",
    shadows: SHADOWS.filter(([x, w]) => inside(x, w)).map(([x, w]) => [rel(x), w]),
    pools: POOLS.filter(([x, r]) => inside(x, r)).map(([x, r, k]) => [rel(x), r, k]),
    ribs: RIBS.filter((x) => inside(x)).map(rel),
    drains: DRAINS.filter((x) => inside(x)).map(rel),
  }, px);
}

// --- the rooftop bench over the archive, and its view ---------------------------------------------
b.prop("bench", "bench-roof", 225.2, WALK, { kind: "wood", length: 1.6 }, px);
// only up on the walkway: without the height band, standing still on the street under the bench
// framed the walkway and left her below the bottom of the view
b.vista(223.4, 227.2, 229.5, WALK + 2.2, 0.06, WALK + 3, WALK - 1);

b.spawn("west", 188.6, STREET, 1).spawn("east", 251.4, STREET, -1).spawn("archive", 232.9, STREET, 1);
b.exit("left", "B5", "bottom").exit("right", "C3", "west");

const LIGHT = lighting({
    ambient: [0.3, 0.23, 0.18],
    keyDir: [0.35, -0.75, 0.55],
    keyColour: [0.74, 0.54, 0.34],
    rimColour: [1, 0.68, 0.38],
    rimDir: [0.6, -0.8],
    rimIntensity: 0.9,
  });

const built = b.build();
const streetY = h(TOP - STREET);
const ref = streetY - Math.round(0.64 * SCALE.viewH);

export const c1: RoomDef = {
  ...built,
  backdrop: {
    scene: marketScene({
      roomW: built.w,
      roomH: built.h,
      ref,
      street: streetY,
      x0: X0,
      H: SCALE.H,
      dense: [
        [196, 209.6],
        [240.5, X1],
      ],
      // the row behind also stands across the drop at the west end, in front of the foundry's mass
      denseBack: [
        [186, 209.6],
        [238.5, X1 + 2],
      ],
      archive: [224, 240.4],
      alcove: [209.4, 219.6],
      columns: [202.4, 219.9, 222.3],
      walkway: WALK,
      door: DOOR,
      doorLamps: DOOR_LAMPS,
      lanterns: LANTERNS.map((x, i) => [x, WALK - 0.3 - (0.7 + (i % 2) * 0.25) - 0.17] as [number, number]),
      plaque: [214.4, STREET + 0.95],
      hearth: 217.7,
      ribs: RIBS,
    }),
    vertical: 1,
    weather: false,
  },
  lighting: LIGHT,
  // one light over everything: a cast toward the lamps, haze on far props, contact shadows. No
  // horizon band (the ground meets a wall here, not sky) and no lamp halos: the backdrop paints each
  // lamp's light into its walls in steps, and the halos cost about 1 ms a frame (d3d11) with five
  // lamps in view, which the room's budget does not have (review/reg-c/round-1, cost.mjs)
  blend: { ...fromLight(LIGHT, { amount: 0.14, haze: 0.28 }), band: undefined, halo: undefined },
  terrain: dressTerrain(built.terrain, { stone: "none", grating: "none", wood: "none" }, HOLLOW_RAMP.street),
  ambient: { dust: 10, moths: true },
};

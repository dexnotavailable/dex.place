// C2 The Archive (WORLD-PLAN section 4): documentation, behind an ordinary
// door off the market alley. No puzzle, no prerequisite. The coziest room in
// the world and the quietest: the music fades out over 4 s at the door (its
// playhead keeps running), footsteps go soft on the rug. Candles and one
// green-shaded reading lamp; dust hangs in the light. One bay per product
// (dexClient, dexCode, dex.place, the /docs/ groups) opens that product's
// docs; the lectern opens the documentation index; the archivist reads and
// answers E with a hum. Nothing breaks here (the lectern makes the room
// sway-only). Ids match the grey-box C2.

import { h, SCALE } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";
import { archiveScene } from "./_scene/archive.ts";
import { dressTerrain, HOLLOW_RAMP } from "./_room.ts";

const X0 = 224;
const X1 = 248;
const TOP = -32.5;
const BOTTOM = -38.5;
const FLOOR = -38;
const CEIL = -33;
const px = { engine: "pixel" as const };

const b = new Box({
  id: "C2",
  title: "C2 The Archive",
  region: "C",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: BOTTOM,
  mood: "archive",
  // a reading room under the market: zoomed in like an interior (config.ts ZOOM)
  camera: { mode: "rail", anchor: 0.64, zoom: "fit" },
  audio: { music: "theme", bed: "archive", silent: true, weatherThrough: 0, surface: "rug" },
  weather: { state: "serene", time: "day" },
  neighbours: ["C1"],
  underground: true,
  surface: "rug",
});
b.floor(X0, X1, FLOOR, undefined, "rug");
b.block(X0, X1, TOP, CEIL, "wood");

// the door back up to the alley (an ordinary door), the boards, the rug
// the door is built into the wall: the backdrop's moulded oak case is its frame (_scene/archive.ts)
const DOOR = 225.2;
b.prop("hollowDoor", "archive-exit", DOOR, FLOOR, { kind: "ordinary", frame: "timber", sill: 6, recess: 6, shade: 1, jamb: 5 }, px);
b.doors["archive-exit"] = { room: "C1", spawn: "archive" };
// light wells: grates in the ceiling under the street's drains; the market's amber falls through them
// in shafts (the room's dominant light, from above) and pools on the boards where each lands (the
// shaft leans 0.7 H east on its way down)
const WELLS = [229.6, 236.9, 243.1];
/** Books piled on the boards against the wall (the backdrop draws them; their shadows are here). */
const PILES = [227.15, 233.45];
// contact shadows under everything that stands on the boards or the rugs ([x, width], world H): the
// boards and the rugs darken under each foot, so nothing floats on the floor
const SHADOWS: [number, number][] = [
  [225.2, 1.2], [228.4, 1.2], [231.2, 1.1], [232.5, 0.5], [234.6, 0.8], [236.4, 0.7], [238.8, 0.6],
  [241.0, 1.8], [243.0, 1.8], [245.0, 1.8], [246.9, 0.8],
  ...PILES.map((x) => [x, 0.6] as [number, number]),
];
const RUGS: [string, number, number, string][] = [
  ["rug-reading", 231, 5.6, "clothRed"],
  ["rug-lectern", 238.4, 4, "clothIndigo"],
];
const onRug = (x: number): boolean => RUGS.some(([, c, w]) => Math.abs(x - c) < w / 2);
b.prop("hollowFloor", "boards", X0, FLOOR, { width: h(X1 - X0), depth: 2.2, kind: "boards", shadows: SHADOWS.filter(([x]) => !onRug(x)).map(([x, w]) => [x - X0, w]), pools: [[232.6 - X0, 1.6, 0.5], [238.8 - X0, 1.4, 0.45], [234.6 - X0, 0.9, 0.35], [246.9 - X0, 0.9, 0.35], ...WELLS.map((x) => [x + 0.7 - X0, 1.0, 0.6] as [number, number, number])] }, px);
for (const [id, c, w, colour] of RUGS) b.prop("hollowRug", id, c, FLOOR, { width: w, colour, shadows: SHADOWS.filter(([x]) => Math.abs(x - c) < w / 2).map(([x, sw]) => [x - c, sw]) }, px);

// the reading corner: the archivist in her armchair, the green lamp, a chair for you
b.prop("archivist", "archivist", 231.2, FLOOR, {}, px);
b.prop("archiveLamp", "reading-lamp", 232.5, FLOOR, { table: true }, px);
b.prop("bench", "reading-chair", 228.4, FLOOR, { kind: "wood", length: 1.1 }, px);
b.prop("paper", "paper-reading", 229.6, FLOOR, { count: 2 }, px);

// the index on its lectern, candles, a candelabra
b.prop("archiveLectern", "docs-index", 236.4, FLOOR, { dest: "documentation" }, px);
b.prop("candles", "archive-candles", 234.6, FLOOR, { count: 5, layout: "cluster", stand: "ledge", lit: true }, px);
b.prop("candelabra", "archive-candelabra", 238.8, FLOOR, { candles: 5, height: 1.35 }, px);

// one bay per product, with a plain sign (real names; each opens its group on /docs/)
const bays: [string, string, string, number][] = [
  ["bay-1", "DEXCLIENT", "dexclient", 241.0],
  ["bay-2", "DEXCODE", "dexcode", 243.0],
  ["bay-3", "DEX.PLACE", "dex-place", 245.0],
];
for (const [id, label, group, x] of bays) b.prop("archiveShelf", id, x, FLOOR, { label, group, width: 1.7, height: 2.3, scrolls: true }, px);
b.prop("candles", "bay-candles", 246.9, FLOOR, { count: 3, layout: "row", stand: "rack", lit: true }, px);

// dust hangs in the light
b.prop("dust", "motes-lamp", 230, FLOOR, { kind: "dust", width: 4.5, height: 2.4, count: 22, lit: true }, px);
b.prop("dust", "motes-bays", 239.5, FLOOR, { kind: "dust", width: 7, height: 3, count: 16, lit: true }, px);
// dust turning in each well's shaft (it leans east on the way down)
for (const [i, x] of WELLS.entries()) b.prop("dust", `motes-well-${i}`, x + 0.4, FLOOR, { kind: "dust", width: 0.9, height: 4.6, count: 7, lit: true }, px);

b.spawn("door", 226.1, FLOOR, 1);

const LIGHT = lighting({
    ambient: [0.24, 0.2, 0.16],
    keyDir: [0.2, -0.6, 0.75],
    keyColour: [0.6, 0.48, 0.32],
    rimColour: [1, 0.8, 0.5],
    rimDir: [0.7, -0.7],
    rimIntensity: 0.8,
  });

const built = b.build();
const roomH = built.h;
// the room is shorter than the view: the camera centres it (camera.ts clamp)
const ref = Math.round((roomH - SCALE.viewH) / 2);

export const c2: RoomDef = {
  ...built,
  backdrop: {
    scene: archiveScene({
      roomW: built.w,
      roomH,
      ref,
      floor: h(TOP - FLOOR),
      ceiling: h(TOP - CEIL),
      x0: X0,
      H: SCALE.H,
      arches: [227.2, 234.2, 247.2],
      lights: [
        [232.6, 1.0, 1],
        [234.6, 0.3, 0.35],
        [238.8, 1.4, 0.8],
        [246.9, 0.4, 0.35],
      ],
      door: DOOR,
      products: [239.85, 246.15],
      clock: 228.6,
      ladders: [229.7, 235.45],
      piles: PILES,
      wells: WELLS,
    }),
    vertical: 1,
    weather: false,
  },
  lighting: LIGHT,
  // one light over everything: a cast toward the lamps, haze on far props, contact shadows. No
  // horizon band (the ground meets a wall here, not sky) and no lamp halos: the backdrop paints each
  // lamp's light into its walls in steps, and the halos cost about 1 ms a frame (d3d11) with five
  // lamps in view, which the room's budget does not have (review/reg-c/round-1, cost.mjs)
  blend: { ...fromLight(LIGHT, { amount: 0.12, haze: 0.2 }), band: undefined, halo: undefined },
  // the ceiling block draws no art (round 4): the backdrop builds the slab's face, so the light wells can
  // be cut into it (the terrain's wood hid them and the shafts came out of nothing)
  terrain: dressTerrain(built.terrain, { rug: "none", wood: "none" }, HOLLOW_RAMP.archive),
  ambient: { dust: 6, moths: false },
};

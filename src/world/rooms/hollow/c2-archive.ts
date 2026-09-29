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
  camera: { mode: "rail", anchor: 0.64 },
  audio: { music: "theme", bed: "archive", silent: true, weatherThrough: 0, surface: "rug" },
  weather: { state: "serene", time: "day" },
  neighbours: ["C1"],
  underground: true,
  surface: "rug",
});
b.floor(X0, X1, FLOOR, undefined, "rug");
b.block(X0, X1, TOP, CEIL, "wood");

// the door back up to the alley (an ordinary door), the boards, the rug
b.prop("door", "archive-exit", 225.2, FLOOR, { kind: "ordinary", frame: "timber" }, px);
b.doors["archive-exit"] = { room: "C1", spawn: "archive" };
b.prop("hollowFloor", "boards", X0, FLOOR, { width: h(X1 - X0), depth: 2.2, kind: "boards" }, px);
b.prop("hollowRug", "rug-reading", 231, FLOOR, { width: 5.6, colour: "clothRed" }, px);
b.prop("hollowRug", "rug-lectern", 238.4, FLOOR, { width: 4, colour: "clothIndigo" }, px);

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

b.spawn("door", 226.1, FLOOR, 1);

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
        [232.6, 1.0],
        [234.6, 0.3],
        [238.8, 1.4],
        [246.9, 0.4],
        [225.2, 1.6],
      ],
    }),
    vertical: 1,
    weather: false,
  },
  lighting: lighting({
    ambient: [0.24, 0.2, 0.16],
    keyDir: [0.2, -0.6, 0.75],
    keyColour: [0.6, 0.48, 0.32],
    rimColour: [1, 0.8, 0.5],
    rimDir: [0.7, -0.7],
    rimIntensity: 0.8,
  }),
  terrain: dressTerrain(built.terrain, { rug: "none", wood: "wood" }, HOLLOW_RAMP.archive),
  ambient: { dust: 6, moths: false },
};

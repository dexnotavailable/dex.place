// B5 Hollow Mouth (WORLD-PLAN section 4, region B; lane R-B). Replaces the
// grey-box B5 by id and keeps its walk: the causeway's end, the stairs down to
// the culvert platform, the culvert gate (opened from inside by the lever
// beside it: shortcut S2, the horn, the ferryman wakes), the crane's hook down
// the shaft (32 H in 10 s, called from either end), an optional way down by
// broken ledges along the west wall, and the market street at the bottom,
// the way into the hollow (C1). The backdrop (scenes/hollow-mouth.ts) draws
// the shaft, the plain's cut edge, the platform and the ledges where this
// collision is (hollow-mouth/geo.ts).

import { hollowMouth } from "../../../scenes/scenes/hollow-mouth.ts";
import { B5 } from "../../../scenes/scenes/hollow-mouth/geo.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { lighting } from "../common.ts";

const b = new Box({
  id: "B5",
  title: "B5 Hollow Mouth",
  region: "B",
  x0: B5.x0,
  x1: B5.x1,
  top: B5.top,
  bottom: B5.bottom,
  mood: "overcast",
  camera: { mode: "free", anchor: B5.anchor, lookY: 1.5 },
  audio: { music: "theme", bed: "shaft", weatherThrough: 1, level: 0.43, surface: "stone" },
  weather: { state: "overcast", time: "day" },
  neighbours: ["B2", "C1", "S2"],
});

// --- collision (the grey-box's walk, unchanged) -------------------------------------------
b.floor(172, B5.stairX, B5.plain, 1.2, "earth");
let x = b.stairs(B5.stairX, B5.plain, B5.platform, 1, "stone", -1.2);
b.floor(x, B5.platformX[1], B5.platform, 1.2);
b.floor(B5.lip[0], B5.lip[1], B5.platform, 1.2);
for (const [a, c, y] of B5.ledges) b.ledge(a, c, y);
b.floor(172, 188, B5.street);

// --- props --------------------------------------------------------------------------------
const px = { engine: "pixel" as const };
const Y = (wy: number): number => b.Y(wy);
b.prop("plain-keeper", "keeper", 180, B5.platform, { lamps: [{ shrine: 2, ids: ["lamp-2-0", "lamp-2-1", "lamp-2-2"] }], opens: [{ flag: "lever:culvert", target: "culvert-gate", state: "open" }] }, { engine: "stub" });
b.prop("plainRumble", "rumble", 180, B5.platform, {}, px);
// S2: the culvert gate, the lever beside it (inside), the horn on its arch
b.prop("lever", "culvert-lever", B5.culvertLever, B5.platform, { flag: "lever:culvert", target: "culvert-gate", msg: "lifting" }, px);
b.prop("culvertGate", "culvert-gate", B5.culvertGate, B5.platform, {}, px);
b.doors["culvert-gate"] = { room: "S2", spawn: "east" };
// the crane: its frame on the east lip, its hook the lift, a call lever at each end
b.prop("craneFrame", "crane-frame", 187.62, B5.platform, { height: B5.craneTop + 0.15, reach: 187.62 - B5.hook }, px);
b.prop("crane-hook", "crane", B5.hook, B5.platform, {
  stops: [
    { x: b.X(B5.hook), y: Y(B5.platform) },
    { x: b.X(B5.hook), y: Y(B5.street) },
  ],
  speed: 3.2,
  w: 1.6,
  top: Y(B5.craneTop),
  crane: "crane-frame",
}, { engine: "stub" });
b.prop("callLever", "hook-call-top", B5.callTop, B5.platform, { target: "crane", msg: "call:0" }, px);
b.prop("callLever", "hook-call-bottom", B5.callBottom, B5.street, { target: "crane", msg: "call:1" }, px);
// chains and cables hanging into the shaft, vines over the cut edge
b.prop("cable", "chain-1", 176.2, -1.3, { kind: "chain", free: true, length: 3.0, hook: true }, px);
b.prop("cable", "chain-3", 184.2, -1.3, { kind: "chain", free: true, length: 2.2, hook: true }, px);
b.prop("vines", "vines-1", 177.6, B5.plain, { width: 1.3, length: 1.8, strands: 7 }, px);
b.prop("grass", "grass-1", 172.2, B5.plain, { kind: "dry", width: 3.8, height: 0.3 }, px);
// lamp posts toward shrine 3 (the market), dark until shrine 2 is lit
for (const [id, lx, ly] of [
  ["lamp-2-0", 174.2, B5.plain],
  ["lamp-2-1", 177.6, B5.street],
  ["lamp-2-2", 182.4, B5.street],
] as [string, number, number][])
  b.prop("lampPost", id, lx, ly, { lit: false, arm: 1 }, px);

b.spawn("top", 172.6, B5.plain, 1).spawn("culvert", 183.0, B5.platform, -1).spawn("bottom", 187.3, B5.street, -1);
b.exit("left", "B2", "east", 1, 4).exit("right", "C1", "west", -34, -30);

const built = b.build();

export const b5: RoomDef = {
  ...built,
  terrain: built.terrain.map((t) => ({ ...t, art: "none" as const })),
  backdrop: { scene: hollowMouth(true), vertical: 1, weather: true },
  lighting: lighting({
    ambient: [0.3, 0.3, 0.34],
    keyDir: [-0.4, -0.72, 0.56],
    keyColour: [0.58, 0.6, 0.66],
    rimColour: [1, 0.72, 0.44],
    rimDir: [0.55, 0.83],
    rimIntensity: 0.8,
  }),
  ambient: { dust: 18 },
};

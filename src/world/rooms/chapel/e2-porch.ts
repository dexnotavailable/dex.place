// E2 The Chapel Porch (lane R-E; WORLD-PLAN section 4, E2): the threshold,
// and the sixth and last lamp. 14 x 9 H, locked camera; cozy-outdoor and
// serene: dusk and the porch lanterns. The font by the entrance is the
// calmest water in the world; the chapel doors (big, a red ribbon on the
// ring) are never locked. By the door: a broom leaning, an old shawl on a
// hook, a dusty second cup on the sill. Someone used to come up here for her
// break. Nobody says so; the props do.

import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";
import type { RoomDef } from "../../room/types.ts";
import { PORCH, porchScene } from "../../../scenes/scenes/chapel/outside.ts";
import { RoomBuilder } from "./_room.ts";

const F = PORCH.floor;
const LIGHT = lighting({
  ambient: [0.3, 0.25, 0.3],
  keyDir: [-0.7, -0.4, 0.6],
  keyColour: [0.82, 0.56, 0.46],
  rimColour: [1, 0.68, 0.5],
  rimDir: [-0.9, -0.4],
  rimIntensity: 0.95,
});

const r = new RoomBuilder({
  id: "E2",
  title: "E2 Chapel Porch",
  x0: PORCH.x0,
  x1: PORCH.x1,
  top: PORCH.top,
  bottom: 38,
  camera: { mode: "locked", anchor: 0.78 },
  audio: { music: "theme", bed: "dusk", weatherThrough: 1, surface: "stone" },
  weather: { state: "after", time: "dusk" },
  neighbours: ["E1", "E3"],
  lighting: LIGHT,
  surface: "stone",
});

// the cliff top where the path comes in, then the porch's flags
// (both run past the room's edges, which the locked view shows: 2.6 H each side in the world's frame).
// Drawn by the backdrop (outside.ts porchBody: the cliff's beds and turf, the platform's dressed
// front over its rubble foundation), so the ground is in the same light and stone as the wall.
r.floor(PORCH.x0 - 3.2, PORCH.front, F, { art: "none", surface: "stone" });
r.floor(PORCH.front, PORCH.x1 + 3.2, F, { art: "none", surface: "stone" });

// --- by the entrance: the font; shrine 6, the last lamp ---
// the font: E touches the water (a ring spreads), a hit splashes it (holyFont: the kit font with its E)
r.px("holyFont", "porch-font", 397.6, F);
r.px("shrineLantern", "shrine-6", 399.3, F, { flag: "shrine:6", n: 6 });
r.px("offeringBowl", "bowl-6", 400.0, F);
r.px("donationBox", "box-6", 400.9, F, { dest: "donate" });
r.px("donorPlaque", "plaque-6", 401.75, F + 0.95);
r.px("bench", "bench-6", 403.1, F, { kind: "stone", length: 1.6 });
r.px("paper", "paper-6", 403.9, F, { count: 3 });
r.spawn("shrine", 398.6, F, 1);

// --- the porch's lanterns, from the eave beam ---
r.px("hangingLantern", "lantern-porch-1", 401.2, PORCH.eave, { kind: "iron", drop: 0.75 });
r.px("hangingLantern", "lantern-porch-2", 406.2, PORCH.eave, { kind: "iron", drop: 0.75 });

// --- the keeper's story: the dusty cup on the sill, the shawl on its hook, the broom by the door ---
r.px("dustyCup", "dusty-cup", PORCH.window - 0.12, F + PORCH.sill);
r.px("shawl", "shawl", 406.65, F + 1.45);
r.px("broom", "broom", 406.25, F, { lean: 0.17 });

// --- the chapel doors: never locked; one E opens them and takes you in ---
r.px("chapelDoor", "chapel-doors", PORCH.door, F, { kind: "big", latch: "none", frame: "stone", auto: 0.45 });
r.px("clothHanging", "door-ribbon", PORCH.door + 0.62, F + 2.35, { kind: "banner", colour: "red", width: 0.1, length: 0.55 });
r.door("chapel-doors", { room: "E3", spawn: "west" });

// grass and flowers where the cliff meets the flags
r.px("grass", "grass-porch", 396.7, F, { kind: "flowers", width: 0.9, height: 0.22 });
r.px("moths", "moths-porch", 401.2, F, { count: 4, reach: 2.5 });

r.spawn("west", 396.6, F, 1).spawn("chapel", 406.4, F, -1);
r.exit("left", "E1", "east");

export const e2: RoomDef = r.build({ scene: porchScene, vertical: 0, weather: true }, { ambient: { dust: 6, moths: true }, blend: fromLight(LIGHT, { amount: 0.15, haze: 0.25, band: 0, halo: 0.9 }) });

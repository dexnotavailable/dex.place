// Grey-box, region C: the Hollow (underground; amber, lived-in; no weather,
// thunder only as a far rumble). C1 the Foundry Market (shrine 3, the hub),
// C2 the Archive behind an ordinary door (documentation), C3 the Lift Foot.

import type { RoomDef } from "../../room/types.ts";
import { Box, lampPosts, shrineSet } from "./_build.ts";

const under = { state: "serene", time: "day" } as const;

// ---------------------------------------------------------------------------------
// C1 Foundry Market: the street at -32, the walkway at -26 (stairs at both ends: treads
// you walk under, taken with a small jump), shrine 3 in a furnace-warm alcove, the archive door.
const c1 = new Box({
  id: "C1",
  title: "C1 Foundry Market",
  region: "C",
  x0: 188,
  x1: 252,
  top: -20,
  bottom: -35.3,
  mood: "amber",
  camera: { mode: "rail", anchor: 0.64, slack: 2 },
  audio: { music: "theme", bed: "market", muffle: 1, weatherThrough: 0, surface: "stone" },
  weather: under,
  neighbours: ["B5", "C2", "C3"],
  underground: true,
});
c1.floor(188, 252, -32);
const wx = c1.treads(192, -32, -26, 1, "grating");
c1.ledge(wx, 220, -26, "grating");
// a 1.9 H gap in the walkway: a double-jump line
c1.ledge(221.9, 239, -26, "grating");
c1.treads(248, -32, -26, -1, "grating");
shrineSet(c1, 3, 212.2, -32);
c1.door("archive-door", 232, -32, { room: "C2", spawn: "door" });
lampPosts(c1, 2, [[190.4, -32], [205, -32], [226, -32], [245, -32]], 0);
c1.spawn("west", 188.6, -32, 1).spawn("east", 251.4, -32, -1).spawn("archive", 232.9, -32, 1);
c1.exit("left", "B5", "bottom").exit("right", "C3", "west");

// ---------------------------------------------------------------------------------
// C2 The Archive: the coziest and quietest room. The music fades out over 4 s (its playhead
// keeps running); the lectern opens the documentation index.
const c2 = new Box({
  id: "C2",
  title: "C2 The Archive",
  region: "C",
  x0: 224,
  x1: 248,
  top: -32.5,
  bottom: -38.5,
  mood: "archive",
  camera: { mode: "rail", anchor: 0.64 },
  audio: { music: "theme", bed: "archive", silent: true, weatherThrough: 0, surface: "rug" },
  weather: under,
  neighbours: ["C1"],
  underground: true,
  surface: "rug",
});
c2.floor(224, 248, -38, undefined, "rug");
c2.block(224, 248, -32.5, -33.0, "wood");
c2.door("archive-exit", 225.2, -38, { room: "C1", spawn: "archive" });
c2.prop("bench", "reading-chair", 230, -38);
c2.prop("candles", "archive-candles", 235, -38, { seed: 4 });
c2.prop("lectern", "docs-index", 236.4, -38, { dest: "documentation" });
c2.prop("bookshelf", "bay-1", 240, -38, { w: 1.3, h: 1.9, seed: 1 });
c2.prop("bookshelf", "bay-2", 242.2, -38, { w: 1.3, h: 1.9, seed: 2 });
c2.prop("bookshelf", "bay-3", 244.4, -38, { w: 1.3, h: 1.9, seed: 3 });
c2.spawn("door", 226.1, -38, 1);

// ---------------------------------------------------------------------------------
// C3 Lift Foot: a waiting room at the spire's stem. The lift gate (a big door) boards the lift.
const c3 = new Box({
  id: "C3",
  title: "C3 Lift Foot",
  region: "C",
  x0: 252,
  x1: 270,
  top: -24.3,
  bottom: -33.3,
  mood: "tile",
  camera: { mode: "locked" },
  audio: { music: "theme", bed: "waiting", muffle: 1, weatherThrough: 0, surface: "tile" },
  weather: under,
  neighbours: ["C1", "D1"],
  underground: true,
  surface: "tile",
});
c3.floor(252, 270, -32, undefined, "tile");
c3.prop("bench", "waiting-1", 256.2, -32);
c3.prop("bench", "waiting-2", 257.4, -32);
c3.prop("crate", "waiting-luggage", 259.2, -32, { seed: 7, size: 0.4 });
c3.door("lift-gate", 265.6, -32, { room: "D1", spawn: "bottom" }, { w: 2.5, h: 4 });
c3.spawn("west", 252.6, -32, 1).spawn("lift", 264, -32, -1);
c3.exit("left", "C1", "east");

export const hollow: RoomDef[] = [c1.build(), c2.build(), c3.build()];

// E4 The Bell Stair and Balcony (lane R-E; WORLD-PLAN section 4, E4): the
// view from above, and the shortcut home. An outside stair in two flights of
// standard steps up the bell tower's flank (12 H), and the balcony at the top
// with the whole route below in the last of the dusk: the ring at eye level
// with the sun in its hole again, the colossi walking the horizon, the lamps
// you lit as a line of small lights across the valley. Free camera; a vista
// hold on the balcony and a bench to sit and look.
//
// The chapel bell hangs in the bell-cote at the balcony's end, over a small
// door with the same red mark as the one in the keeper's loft. Its
// maintenance rail is bolted on this side: release it and the bell rings once
// by itself, the rail swings away and the door opens onto the A3 loft
// (latch:sky-door, S4); walking through the first time sets round:done. After
// that the door is a two-way link home.
//
// 28 H wide rather than the plan's 14 (W0's deviation, kept: 12 H of standard
// steps need 18 H of run, and the round's positions stay where W0 measured
// them).

import { lighting } from "../common.ts";
import type { RoomDef } from "../../room/types.ts";
import { BELFRY, belfryScene } from "../../../scenes/scenes/chapel/outside.ts";
import { RoomBuilder } from "./_room.ts";

const B = BELFRY;
const r = new RoomBuilder({
  id: "E4",
  title: "E4 Bell Stair and Balcony",
  x0: B.x0,
  x1: B.x1,
  top: B.top,
  bottom: B.bottom,
  camera: { mode: "free", anchor: B.anchor },
  audio: { music: "theme", bed: "dusk", weatherThrough: 1, surface: "stone" },
  weather: { state: "after", time: "dusk" },
  neighbours: ["E3", "A3"],
  lighting: lighting({
    ambient: [0.3, 0.25, 0.32],
    keyDir: [0.7, -0.35, 0.6],
    keyColour: [0.86, 0.58, 0.46],
    rimColour: [1, 0.66, 0.5],
    rimDir: [0.9, -0.4],
    rimIntensity: 1,
  }),
  surface: "stone",
});

// the ground: the chapel's east doorstep, two flights and a landing, the balcony (drawn by the backdrop)
r.floor(B.x0, B.flight1.x, B.floor);
r.flight(B.flight1.x, B.flight1.y, B.flight1.n, 1);
r.floor(B.landing[0], B.landing[1], 46);
r.flight(B.flight2.x, B.flight2.y, B.flight2.n, 1);
r.floor(B.balcony[0], B.balcony[1], B.deck);

// --- the balcony ---
r.px("naveBench", "balcony-bench", B.bench, B.deck, { kind: "stone", length: 1.6 });
r.prop("sit-spot", "balcony-look", B.bench, B.deck, {}, { engine: "stub" });
r.vista(B.vista.x0, B.vista.x1, B.vista.cx, B.vista.cy, 0.07);
r.px("prayerFlags", "balcony-flags", 480.9, B.deck, { kind: "prayer", span: 2.6, height: 1.9, posts: true });
r.px("hangingBell", "chapel-bell", B.bell, B.deck + 3.35, { size: "large" });
r.px("chapelDoor", "sky-door-balcony", B.door, B.deck, { kind: "sky", latch: "near", mark: true, beyond: "none", frame: "stone", flag: "latch:sky-door", bell: "chapel-bell", auto: 0.9 });
r.door("sky-door-balcony", { room: "A3", spawn: "sky", flag: "round:done" });
r.px("vines", "vines-cote", B.cote[0] + 0.25, B.deck + 4.3, { width: 0.5, length: 1.3, strands: 5, flowers: true });
r.px("vines", "vines-tower", B.tower[1] - 0.5, 54.5, { width: 0.8, length: 1.6, strands: 6 });
r.px("grass", "grass-balcony", 479.7, B.deck, { kind: "flowers", width: 0.6, height: 0.2 });
r.px("hangingLantern", "lantern-cote", B.cote[0] - 0.02, B.deck + 2.6, { kind: "iron", drop: 0.5 });
// candles on the landing, where the stair turns
r.px("candles", "candles-landing", 468.6, 46, { count: 4, stand: "ledge", layout: "row" });
r.px("moths", "moths-landing", 468.6, 46, { count: 3, reach: 2.5 });

r.spawn("west", 458.5, B.floor, 1).spawn("balcony", 484.2, B.deck, -1);
r.exit("left", "E3", "east", 39, 42);

export const e4: RoomDef = r.build({ scene: belfryScene, vertical: 1, weather: true }, { ambient: { dust: 5, moths: true } });

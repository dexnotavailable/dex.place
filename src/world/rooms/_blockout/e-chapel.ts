// Grey-box, region E: the Pilgrim Path and the Chapel (dusk; after the
// storm; serene). E1 the Pilgrim Path down the fallen ring segment (shrine 5),
// E2 the Chapel Porch (shrine 6), E3 the Chapel of Light (Dex's 9 works, the
// catalogue, the rose shutter crank), E4 the Bell Stair and Balcony (the
// latch: S4, the sky door home to the A3 loft).

import type { RoomDef } from "../../room/types.ts";
import { Box, lampPosts, shrineSet } from "./_build.ts";

const dusk = { state: "after", time: "dusk" } as const;

// ---------------------------------------------------------------------------------
// E1 Pilgrim Path: 80 H long, dropping 44 H in 0.2 H steps (under 30 degrees), a flat
// terrace for shrine 5, and one missing panel: a 1.1 H gap you can jump, or walk down
// into the ring bay under it and out by its steps.
const e1 = new Box({
  id: "E1",
  title: "E1 Pilgrim Path",
  region: "E",
  x0: 316,
  x1: 396,
  top: 90,
  bottom: 35.5,
  mood: "dusk",
  camera: { mode: "free", anchor: 0.5, lookY: 1.5 },
  audio: { music: "theme", bed: "dusk", weatherThrough: 1, surface: "stone" },
  weather: dusk,
  neighbours: ["D4", "E2"],
});
e1.floor(316, 317, 84);
const w1 = 40 / 110;
const skip = new Set([52, 53, 54]);
for (let i = 0; i < 110; i++) if (!skip.has(i)) e1.floor(317 + i * w1, 317 + (i + 1) * w1, 84 - 0.2 * (i + 1));
// the ring bay under the missing panel
const g0 = 317 + 52 * w1;
const g1 = 317 + 55 * w1;
const third = (g1 - g0) / 3;
e1.floor(g0, g0 + third, 72.2).floor(g0 + third, g0 + 2 * third, 72.4).floor(g0 + 2 * third, g1, 72.6);
e1.floor(357, 363, 62);
for (let j = 0; j < 110; j++) e1.floor(363 + j * 0.3, 363 + (j + 1) * 0.3, 62 - 0.2 * (j + 1));
shrineSet(e1, 5, 357.6, 62);
const yAt = (x: number): number => (x < 357 ? 84 - 0.2 * (Math.floor((x - 317) / w1) + 1) : x <= 363 ? 62 : 62 - 0.2 * (Math.floor((x - 363) / 0.3) + 1));
lampPosts(e1, 5, [370, 378.2, 386.3, 393.5].map((x) => [x, yAt(x)] as [number, number]), 0);
e1.spawn("west", 316.5, 84, 1).spawn("east", 395.8, 40, -1);
e1.exit("left", "D4", "east", 82, 87).exit("right", "E2", "west", 38.5, 42);

// ---------------------------------------------------------------------------------
// E2 Chapel Porch: the sixth and last lamp; the chapel doors (big, never locked).
const e2 = new Box({
  id: "E2",
  title: "E2 Chapel Porch",
  region: "E",
  x0: 396,
  x1: 410,
  top: 47,
  bottom: 38,
  mood: "dusk",
  camera: { mode: "locked", anchor: 0.78 },
  audio: { music: "theme", bed: "dusk", weatherThrough: 1, surface: "stone" },
  weather: dusk,
  neighbours: ["E1", "E3"],
});
e2.floor(396, 410, 40);
e2.prop("font", "porch-font", 397.4, 40, {}, { engine: "pixel" });
shrineSet(e2, 6, 399.2, 40);
e2.door("chapel-doors", 408.2, 40, { room: "E3", spawn: "west" }, { w: 2.5, h: 4 });
e2.spawn("west", 396.6, 40, 1).spawn("chapel", 406.4, 40, -1);
e2.exit("left", "E1", "east");

// ---------------------------------------------------------------------------------
// E3 Chapel of Light: Dex's nine works (display only; E opens each on its own, from the
// gallery manifest), 01 to 05 on easels down the nave, 06 to 09 in niches at the east end;
// the catalogue lectern by the door; the rose shutter crank (rose:open). The theme starts
// from the top here, the only place it does.
const e3 = new Box({
  id: "E3",
  title: "E3 Chapel of Light",
  region: "E",
  x0: 410,
  x1: 458,
  top: 53.8,
  bottom: 37.3,
  mood: "chapel",
  camera: { mode: "rail", anchor: 0.7 },
  audio: { music: "theme", fromTop: true, level: 0.6, bed: "chapel", weatherThrough: 0.2, surface: "stone" },
  weather: { interior: true, time: "dusk" },
  neighbours: ["E2", "E4"],
});
e3.floor(410, 458, 40);
e3.block(410, 458, 53.8, 53.4);
e3.door("chapel-in", 411.1, 40, { room: "E2", spawn: "chapel" }, { w: 2.5, h: 4 });
e3.prop("lectern", "catalogue", 413.6, 40, { panel: "gallery", arg: "all", dest: "illustrations" });
e3.prop("lever", "rose-crank", 415.4, 40, { flag: "rose:open", permanent: true });
["01", "02", "03", "04", "05"].forEach((id, i) => e3.prop("artwork-frame", `art-${id}`, 419 + i * 5.2, 40 + 0.95, { art: id, w: 2.4, h: 1.35, dest: "illustrations" }));
e3.prop("bench", "nave-bench", 437.2, 40);
e3.vista(433, 440, 437.2);
[
  ["06", 1.6],
  ["07", 1.35],
  ["08", 1.35],
  ["09", 1.35],
].forEach(([id, w], i) => e3.prop("artwork-frame", `art-${id}`, 444.6 + i * 3.3, 40 + 1.0, { art: id, w, h: 2.4, dest: "illustrations" }));
e3.spawn("west", 412.4, 40, 1).spawn("east", 457.4, 40, -1);
e3.exit("right", "E4", "west");

// ---------------------------------------------------------------------------------
// E4 Bell Stair and Balcony: a stair rising 12 H (two flights of 0.2 H steps) to the
// balcony outside the east gable. The red-marked door's rail is bolted on this side:
// release it and the door opens into the A3 loft (S4); the first time, round:done.
// 28 H wide rather than the plan's 14: 12 H of 0.2 x 0.3 steps need 18 H of run without
// a switchback (a region lane can fold it).
const e4 = new Box({
  id: "E4",
  title: "E4 Bell Stair and Balcony",
  region: "E",
  x0: 458,
  x1: 486,
  top: 58,
  bottom: 36.7,
  mood: "dusk",
  camera: { mode: "free", anchor: 0.64 },
  audio: { music: "theme", bed: "dusk", weatherThrough: 1, surface: "stone" },
  weather: dusk,
  neighbours: ["E3", "A3"],
});
e4.floor(458, 459, 40);
let x = e4.stairs(459, 40, 46, 1);
e4.floor(x, x + 2, 46);
x = e4.stairs(x + 2, 46, 52, 1);
e4.floor(x, 486, 52);
e4.prop("bench", "balcony-bench", 481.4, 52);
e4.vista(479, 486, 480, 49);
e4.door("sky-door-balcony", 485.2, 52, { room: "A3", spawn: "sky", flag: "round:done" }, { latch: "latch:sky-door", latchSide: true });
e4.spawn("west", 458.5, 40, 1).spawn("balcony", 484.2, 52, -1);
e4.exit("left", "E3", "east", 39, 42);

export const chapel: RoomDef[] = [e1.build(), e2.build(), e3.build(), e4.build()];

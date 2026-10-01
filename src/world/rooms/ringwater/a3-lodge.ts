// A3 The Keeper's Lodge (WORLD-PLAN section 4, A3): the first "vast, then
// indoors" cut, twenty seconds from the dock. Locked camera, ceiling in view.
//
// Ground floor: the front door (to the cliff stair), the registry counter with
// its ledger and bell (E: the dex account), the keeper behind it, the lamp
// board on the wall (one lamp per shrine), the product board (the real
// products; E: the website's downloads), the first donation box and its donor
// plaque beside the stove and kettle, candles and her cup on the counter, loose
// paper, a lantern hanging under the loft, and the yard door.
// Loft (up the stair with its handrail): a bench under the loft window, the
// keeper's shelves with the lost-property luggage, and the sky door with its
// red mark: in the morning it opens onto a dusk sky, barred from the far side.
//
// After the round, this session: the keeper is away, the front door stands
// open, the evening is in the windows. From then on, in every save that has
// round:done, a patch of dusk light lies in the loft and her chair and a cup
// sit in it.

import { h, SCALE } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";
import { Box } from "../_blockout/_build.ts";
import { lodgeScene, type LodgeOpts } from "./_lodge.ts";
import { flag, px, sessionRoom, styled } from "./_lib.ts";
import { productLines } from "../../../pixel/props/ringwater/boards.ts";

const X0 = 46;
const X1 = 60;
const TOP = 14.1;
const FLOOR = 6;
const LOFT = 10.5;
const CEIL = 13.85;
const WOOD = ["#140e0b", "#23180f", "#352416", "#4a321e", "#634329"];

const b = new Box({
  id: "A3",
  title: "A3 The Keeper's Lodge",
  region: "A",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: TOP - 9,
  mood: "lodge",
  camera: { mode: "locked" },
  audio: { music: "theme", bed: "lodge", weatherThrough: 0.35, muffle: 1, surface: "wood" },
  weather: { interior: true, time: "day" },
  neighbours: ["A2", "A4", "E4"],
  surface: "wood",
});

styled(b, "wood", () => b.floor(X0, X1, FLOOR, 0.2, "wood"), { ramp: WOOD });
styled(b, "none", () => b.block(X0, X1, TOP, CEIL, "wood"));
// the loft stair: treads you can walk under (take them with a small jump); the loft floor
let loftFrom = 0;
styled(b, "wood", () => (loftFrom = b.treads(47.3, FLOOR, LOFT, 1, "wood")), { ramp: WOOD });
styled(b, "wood", () => b.ledge(loftFrom, X1, LOFT, "wood"), { ramp: WOOD });

// --- ground floor --------------------------------------------------------------------
px(b, "lodgeDoor", "lodge-front", 46.6, FLOOR, { kind: "ordinary", frame: "timber" });
b.doors["lodge-front"] = { room: "A2", spawn: "lodge" };
// the registry counter (E: dex account), the keeper at her ledger, candles and her cup
px(b, "registryCounter", "registry", 50.6, FLOOR, { length: 2.4, keeper: "keeper", dest: "account" });
px(b, "keeper", "keeper", 50.95, FLOOR, { pose: "lodge" });
px(b, "candles", "counter-candles", 49.45, FLOOR + 0.55, { count: 3, layout: "cluster", stand: "none", lit: true });
px(b, "cups", "counter-cup", 51.7, FLOOR + 0.55, { count: 1 });
px(b, "paper", "counter-paper", 51.25, FLOOR + 0.56, { count: 2 });
// on the wall behind her: the lamp board (one lamp per shrine) and the product board
px(b, "lampBoard", "lamp-board", 50.6, FLOOR + 1.78);
px(b, "productBoard", "product-board", 53.15, FLOOR + 1.5, { lines: productLines(), dest: "downloads" });
// the first donation box and its donor plaque, beside the stove and kettle
px(b, "donationBox", "box-lodge", 55.4, FLOOR, { dest: "donate" });
px(b, "donorPlaque", "plaque-lodge", 56.3, FLOOR + 0.95);
px(b, "stove", "stove", 57.75, FLOOR, { pipe: (LOFT - FLOOR) - 0.72 - 0.15 });
px(b, "hangingLantern", "lodge-lantern", 55.0, LOFT - 0.15, { kind: "iron", drop: 0.8, lit: true });
px(b, "lodgeDoor", "lodge-yard", 59.3, FLOOR, { kind: "ordinary", frame: "timber" });
b.doors["lodge-yard"] = { room: "A4", spawn: "west" };

// --- the loft -----------------------------------------------------------------------
px(b, "ringBench", "loft-bench-art", 55.25, LOFT, { kind: "wood", length: 1.2 });
b.prop("ring-seat", "loft-bench", 55.25, LOFT, {}, { engine: "stub" });
px(b, "lodgeShelf", "loft-shelf", 56.35, LOFT + 2.55, { width: 1.3, boards: 2 });
px(b, "luggage", "lost-trunk", 56.6, LOFT, { kind: "trunk" });
px(b, "luggage", "lost-bag", 57.45, LOFT, { kind: "bag" });
// the sky door: opens onto the dusk, barred by the rail bolted on the far side, until the latch (S4)
px(b, "skyDoor", "sky-door", 58.9, LOFT, {});
b.doors["sky-door"] = { room: "E4", spawn: "balcony" };
px(b, "dust", "lodge-dust", 46.6, FLOOR + 3.2, { kind: "dust", width: 6, height: 2.6, count: 24, lit: true });

b.prop("ringwater-state", "state-A3", 52, FLOOR, { board: "lamp-board", skyDoor: "sky-door", keeper: { id: "keeper", pose: "lodge" }, openAtEvening: ["lodge-front"] }, { engine: "stub" });
b.spawn("front", 47.4, FLOOR, 1).spawn("yard", 58.3, FLOOR, -1).spawn("sky", 57.8, LOFT, -1);

// the backdrop: room px of the windows, the sky door's opening, warm spots, the stair's handrail
const RX = (wx: number): number => h(wx - X0);
const RY = (wy: number): number => h(TOP - wy);
const lodge = (evening: boolean): LodgeOpts => ({
  roomW: h(X1 - X0),
  roomH: h(9),
  floor: RY(FLOOR),
  loft: RY(LOFT),
  ceiling: RY(CEIL),
  windows: [
    { x: RX(47.55), y: RY(FLOOR + 2.55), w: h(0.9), h: h(1.05) },
    { x: RX(54.55), y: RY(LOFT + 2.35), w: h(0.75), h: h(0.9) },
  ],
  skyDoor: { x: RX(58.9) - h(0.35), y: RY(LOFT + 1.4), w: h(0.7), h: h(1.4) },
  warm: [
    [RX(57.75), RY(FLOOR + 0.5), h(2.6)],
    [RX(49.45), RY(FLOOR + 0.7), h(1.4)],
    [RX(55.0), RY(LOFT - 1.1), h(1.6)],
  ],
  rail: [RX(47.3), RY(FLOOR), RX(loftFrom), RY(LOFT)],
  // one post under the loft's edge (the old ones at 46.25 and 59.75 stood behind the doors' casings)
  posts: [RX(53.9)],
  // every door's opening is built into the logs: reveal, lintel beam, sill (the kit casing sits inside)
  doors: [
    { x: RX(46.6), y: RY(FLOOR) },
    { x: RX(59.3), y: RY(FLOOR) },
    { x: RX(58.9), y: RY(LOFT) },
  ],
  // the stove's chimney breast, the stovepipe entering it under the loft's beam
  chimney: { x: RX(57.75), w: h(0.8), thimble: RY(FLOOR + 0.72 + (LOFT - FLOOR - 0.72 - 0.15)) },
  pegs: [RX(58.2), RY(FLOOR + 1.2)],
  herbs: [RX(55.5), RX(56.9)],
  // the keeper's chart of the lake over the counter (the ferry's route, the lodge marked), and the
  // ferry's spare oars crossed on the wall between the lantern and the chimney
  chart: [RX(49.75), RY(FLOOR + 2.95), h(1.25), h(0.8)],
  oars: [RX(56.45), RY(FLOOR + 2.55)],
  evening,
});

const LODGE_LIGHT = lighting({ ambient: [0.3, 0.26, 0.24], keyColour: [0.62, 0.5, 0.38], rimColour: [1, 0.74, 0.46], rimIntensity: 0.95 });
const LODGE_EVENING = lighting({ ambient: [0.28, 0.24, 0.26], keyColour: [0.56, 0.42, 0.36], rimColour: [1, 0.7, 0.44], rimIntensity: 1 });
const morning: RoomDef = {
  ...b.build(),
  backdrop: { scene: lodgeScene(lodge(false)), vertical: 1, weather: false },
  lighting: LODGE_LIGHT,
  // one warm cast over the room, contact shadows under the furniture, halos round the lamp, the
  // candles and the stove; no distance haze or ground band indoors
  blend: { ...fromLight(LODGE_LIGHT, { amount: 0.12 }), haze: undefined, band: undefined },
  ambient: { dust: 16, moths: false },
};

/** After the round (any visit whose save has round:done): the dusk patch in the loft, her chair and a cup in it. */
const afterRound = (): RoomDef["props"] =>
  flag("round:done")
    ? [
        { recipe: "ringBench", id: "keeper-chair", x: RX(58.05), y: RY(LOFT), params: { kind: "wood", length: 0.55 }, engine: "pixel" },
        { recipe: "cups", id: "chair-cup", x: RX(58.2), y: RY(LOFT + 0.34), params: { count: 1 }, engine: "pixel" },
      ]
    : [];

const base = sessionRoom(morning, () => ({
  backdrop: { scene: lodgeScene(lodge(true)), vertical: 1, weather: false },
  lighting: LODGE_EVENING,
  blend: { ...fromLight(LODGE_EVENING, { amount: 0.16 }), haze: undefined, band: undefined },
  // the keeper is at Pier's End (the room state sends her away if the room was built before);
  // the room state swings the front door open
  drop: ["keeper"],
}));

export const keepersLodge: RoomDef = Object.defineProperty({ ...base }, "props", {
  enumerable: true,
  get: () => [...base.props, ...afterRound()],
}) as RoomDef;
// keep the evening getters (spreading copies values, so re-point them at the session room)
for (const k of ["backdrop", "lighting", "weather", "blend"] as const) Object.defineProperty(keepersLodge, k, { enumerable: true, get: () => base[k] });
void SCALE;

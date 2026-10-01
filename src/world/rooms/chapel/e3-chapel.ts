// E3 The Chapel of Light (lane R-E; WORLD-PLAN section 4, E3): Dex's nine
// works, each shown on its own, and the catalogue. 48 x 16.5 H, the nave 14 H
// tall: grand, yet held in. Rail camera; a vista hold at the bench to sit and
// look (the camera holds on the east niches, the UI hides, the music dips).
//
// On arrival the nave is candle-dim and the rose window over the doors is
// shuttered; the works can already be inspected (the light is atmosphere, not
// a lock). The crank opens the shutter: sunset floods through the rose window
// and coloured light sweeps east down the nave, lighting 01 to 05 on their
// easels in turn, and comes to rest on 06 to 09 in the four niches at the east
// end (rose:open, saved). The art is only ever the real thumbnail pinned in
// its frame (gallery.ts) and the full work in the panel on E. The nave rule:
// hits only sway, flicker or ring things; nothing fractures here.

import { h } from "../../config.ts";
import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";
import type { RoomDef } from "../../room/types.ts";
import { artRect } from "../../../pixel/props/chapel/artFrame.ts";
import { RoomBuilder } from "./_room.ts";
import { chapelScene, NAVE } from "../../../scenes/scenes/chapel.ts";

export const FLOOR = 40;
const x0 = 410;
const top = 53.8;

/** The works in the nave, in manifest order: 01 to 05 on easels, 06 to 09 in the niches. */
export const WORKS: { art: string; kind: "easel" | "niche"; x: number; w: number; h: number; sill: number }[] = [
  ...NAVE.easels.map((x, i) => ({ art: `0${i + 1}`, kind: "easel" as const, x, w: 2.4, h: 1.35, sill: 1.02 })),
  ...NAVE.niches.map((x, i) => ({ art: `0${i + 6}`, kind: "niche" as const, x, w: i === 0 ? 1.6 : 1.35, h: 2.4, sill: 1.0 })),
];

const LIGHT = lighting({
  ambient: [0.26, 0.22, 0.27],
  keyDir: [0.55, -0.5, 0.65],
  keyColour: [0.5, 0.4, 0.42],
  rimColour: [1, 0.7, 0.62],
  rimDir: [-0.7, -0.7],
  rimIntensity: 0.7,
});

const r = new RoomBuilder({
  id: "E3",
  title: "E3 Chapel of Light",
  x0,
  x1: 458,
  top,
  bottom: 37.3,
  camera: { mode: "rail", anchor: NAVE.anchor },
  audio: { music: "theme", fromTop: true, level: 0.6, bed: "chapel", weatherThrough: 0.2, surface: "stone" },
  weather: { interior: true, time: "dusk" },
  neighbours: ["E2", "E4"],
  lighting: LIGHT,
  surface: "stone",
});

// the nave floor: drawn by the backdrop (chapel.ts naveBody: polished flags holding the candle light,
// the footing with its crypt vents), so it is the same stone and light as the walls
r.floor(x0, 458, FLOOR, { art: "none", surface: "stone" });


// --- the west end: the doors, the rose window over them, its crank, the catalogue ---
// the leaves only: the backdrop cuts the doorway, its orders, hood and threshold into the west wall (chapel.ts)
r.px("chapelDoor", "chapel-in", NAVE.door, FLOOR, { kind: "big", latch: "none", frame: "stone", auto: 0.45, wall: true });
r.door("chapel-in", { room: "E2", spawn: "chapel" });
const roseX = NAVE.door, roseY = FLOOR + NAVE.roseHeight;
const art = WORKS.map((w) => {
  const a = artRect(w, 80);
  const mould = Math.round(0.15 * 80); // the gilt moulding around the work (artFrame's MOULD)
  return [h(w.x - roseX), Math.round(h(roseY - FLOOR) + (a.y0 + a.y1) / 2), Math.round((a.x1 - a.x0) / 2 + mould), Math.round((a.y1 - a.y0) / 2 + mould)];
});
r.px("roseWindow", "rose-window", roseX, roseY, { size: NAVE.roseSize, targets: art, floor: h(roseY - FLOOR), sweep: 13, rest: WORKS.filter((w) => w.kind === "niche").length });
r.px("roseCrank", "rose-crank", NAVE.crank, FLOOR, { window: "rose-window", flag: "rose:open" });
// the crank's chain up the wall to the shutter
r.px("cable", "rose-chain", NAVE.crank, FLOOR + 0.99, { kind: "chain", to: [roseX + 0.55 - NAVE.crank, -(roseY - NAVE.roseSize / 2 - 0.12 - (FLOOR + 0.99))], slack: 1.01, hook: false });
r.px("catalogueLectern", "catalogue", NAVE.lectern, FLOOR, { panel: "gallery", arg: "all", dest: "illustrations" });
r.px("naveCandelabra", "candelabra-west", NAVE.lectern + 1.5, FLOOR, { candles: 5 });

// --- the works ---
for (const w of WORKS) {
  const id = `art-${w.art}`;
  r.px("artFrame", id, w.x, FLOOR, { art: w.art, kind: w.kind, w: w.w, h: w.h, sill: w.sill, dest: "illustrations" });
  r.prop("art-thumb", `thumb-${w.art}`, w.x, FLOOR, { art: w.art, kind: w.kind, w: w.w, h: w.h, sill: w.sill }, { engine: "stub" });
  // prayer candles on a low ledge at the foot of each niche
  if (w.kind === "niche") r.px("votives", `candles-${w.art}`, w.x, FLOOR, { count: 5, stand: "ledge", layout: "row" });
}
// votive racks between the easels
for (const x of NAVE.racks) r.px("votives", `rack-${x}`, x, FLOOR, { count: 6, stand: "rack", layout: "row" });

// --- pews; the one to sit and look ---
for (const x of NAVE.pews) r.px("naveBench", `pew-${x}`, x, FLOOR, { kind: "pew", length: 2.0 });
// the pew before the niches: sit and look (the camera holds on 06 to 09)
r.px("naveBench", "look-pew", NAVE.look, FLOOR, { kind: "pew", length: 1.6 });
r.prop("sit-spot", "look-bench", NAVE.look, FLOOR, {}, { engine: "stub" });
r.vista(NAVE.look - 1.6, NAVE.look + 1.6, NAVE.lookAt, FLOOR + 3.4, 0.07);

// --- the nave's air and things that move ---
r.px("censer", "censer", NAVE.censer, FLOOR + 3.9, { drop: 2.25, arm: 0.55 });
for (const [i, x] of NAVE.tapestries.entries()) r.px("clothHanging", `tapestry-${i}`, x, FLOOR + 4.55, { kind: "tapestry", colour: i ? "indigo" : "red" });
for (const x of NAVE.lanterns) r.px("hangingLantern", `lantern-${x}`, x, FLOOR + 6.9, { kind: "iron", drop: 1.7 });
r.px("naveCandelabra", "candelabra-east", 457.0, FLOOR, { candles: 5 });
r.px("dust", "motes-rose", 418, FLOOR + 3.4, { kind: "dust", width: 9, height: 5, count: 34, lit: true });
r.px("dust", "motes-niches", 450.5, FLOOR + 2.4, { kind: "dust", width: 9, height: 4, count: 26, lit: true });
r.px("naveRule", "nave-rule", x0 + 0.2, FLOOR);

r.spawn("west", NAVE.door + 1.35, FLOOR, 1).spawn("east", 457.4, FLOOR, -1);
r.exit("right", "E4", "west");

export const e3: RoomDef = r.build({ scene: chapelScene, vertical: 1, weather: false }, { ambient: { dust: 6, moths: false }, blend: fromLight(LIGHT, { amount: 0.12, haze: 0.2, band: 0, halo: 1.25 }) });

// Kagami's land (art: the Kagami art loop, painter p3): the plateau rock the lake lies on (the
// Western Pass, the west shore, the east lip), the spring that drains it, the lake's near shore
// on P5 with its reed beds, and the islets in the middle distance (P3).

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES } from "../types.ts";
import { bankTopAt, reedBeds, type BankP } from "../../art/library/opening/bank.ts";
import { LAKE_Y } from "./common.ts";
import { bg } from "./kagami-place.ts";

/** The plateau rock and its spring (seed block 1). */
export function kagamiLand(b: WorldBuilder): void {
  // --- the ground: the pass, the west shore, the plateau the lake lies on, the east lip
  // (art: env-opening). The lake rests on the plateau: under its surface the rock's top sits
  // just below the waterline, so the wide frames show the plateau's cliff below the near shore
  // (never a cross-section of water). The east face drops into Shiraito's valley mist.
  // (The top's points from h(0) to h(43.6) are the walk line of kagami.ts: keep them exact.)
  const top = [
    h(0), h(59.2), h(5), h(59.0), h(9), h(58.6), h(14), h(58.5), h(19), h(59.0), h(25), h(59.9),
    h(31), h(60.9), h(36), h(61.6), h(40), h(62.1), h(43.6), h(62.25),
    // the shore shelves under the water, the plateau's rim just below the lake, the east lip
    h(45), h(62.75), h(48), h(62.85), h(104), h(62.85), h(107.4), h(62.7), h(109.2), h(62.4),
  ];
  // the massif's east face goes down and back to the West Shore (map 540,348 ... 352,945)
  const bottom = [
    h(109.6), h(63.6), h(108.9), h(66.5), h(107.6), h(70), h(104), h(78), h(97), h(92), h(90.4), h(106), h(83), h(120),
    h(76), h(134), h(72.4), h(160), h(70.4), h(190), h(8), h(190), h(12), h(150), h(8), h(110), h(4), h(80), h(0), h(66),
  ];
  b.piece("play", "op.rock", 0, 0, { top, bottom, cap: "grass", capH: 12, rough: 14, teeth: 0.5, veg: 0.75, shade: 0.2, fadeY: h(72), fadeH: h(9), water: h(62.6) - h(0), joinL: h(1), giant: h(13), forest: [h(3.2), h(7.5)] }, { z: 0 });
  // Kagami's spring: the lake drains through the karst and bursts from the cliff below it
  b.piece("play", "op.spring", h(97), h(65.4), { mw: 80, mh: 50, w: 44, drop: h(11) }, { z: 1, reflect: false });
  // its flow (12 fps over four frames)
  b.sprite({ id: "kagami-spring-flow", plane: "play", kind: "op.spring", x: h(97), y: h(65.4), p: { mw: 80, mh: 50, w: 44, drop: h(11), fallOnly: true }, frames: 4, fps: 12, reflect: false });
}

/** The lake's near shore on P5 and its reed beds (seed block 3). */
export function kagamiNear(b: WorldBuilder): void {
  // the lake's near shore (P5; art: env-opening): the bank the surface ends against, low
  // hummocks, reed beds and sunk stones, rising into a rocky corner where the lake meets the lip
  const bankP: BankP = { w: Math.round(h(72) * PLANES.near.rate), h: 150, endR: 520, startR: 420, reeds: 0.45 };
  const bank = b.piece("near", "op.bank", h(38), LAKE_Y, bankP as unknown as Record<string, unknown>, { z: 1, reflect: false });
  // its reed beds sway in the wind (6 fps, a gust running through each bed)
  reedBeds(bankP, bank.seed).forEach(([x, w, hh], i) => {
    const ground: number[] = [];
    for (let gx = 0; gx <= w; gx += 8) ground.push(Math.max(0, Math.round(bankTopAt(bankP, bank.seed, x + gx) - 3)));
    b.sprite({ id: `bank-reeds-${i}`, plane: "near", kind: "op.reeds", x: h(38) + x / PLANES.near.rate, y: LAKE_Y + 1 / PLANES.near.rate, p: { w, h: Math.round(hh), ox: Math.round(x), ground, loop: 8 }, frames: 8, fps: 6, reflect: false });
  });
}

/** The islets in the middle distance of the lake (P3, seed block 6). */
export function kagamiIslets(b: WorldBuilder): void {
  // P3: islets in the middle distance of the lake, so the mirror stays open: old pilings, a
  // pine and a lantern, reeds, a tree with a leaning pine, a small torii in the shallows (kept
  // clear of where she stands at the catch)
  bg(b, "back", 3500, "op.islet", { w: 0, h: 0, on: ["posts", "reeds"] }, LAKE_Y, 0);
  bg(b, "back", 4200, "op.islet", { w: 70, h: 18, on: ["pine", "lantern", "reeds"], at: 0.2 }, LAKE_Y, 1);
  bg(b, "back", 4760, "op.islet", { w: 0, h: 0, on: ["reeds"] }, LAKE_Y, 2);
  bg(b, "back", 5350, "op.islet", { w: 110, h: 26, on: ["tree", "pine", "posts"], at: -0.5 }, LAKE_Y, 3);
  bg(b, "back", 6300, "op.islet", { w: 46, h: 12, on: ["torii", "reeds"], at: -0.3 }, LAKE_Y, 4);
}

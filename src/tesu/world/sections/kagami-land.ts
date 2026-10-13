// Kagami's land (art: the Kagami art loop, painter p3): the plateau rock the lake lies on (the
// Western Pass, the west shore, the east lip), the spring that drains it, and the lake's near
// shore on P5 with its reed beds. (The islets in the middle distance are in kagami-islets.ts.)

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES } from "../types.ts";
import { bankTopAt, reedBeds, shallowsTopAt, type BankP, type MassSpec, type ShallowsP } from "../../art/library/opening/bank.ts";
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
  // the west shore where the jetty leaves it (play-west): limestone steps going down from the
  // walk line to the water, mud and pebbles, sunk stones, a fallen trunk (in front of the rock;
  // the walk line itself is the rock's and stays exact)
  const wl = (x: number, y: number): number[] => [x - h(39), LAKE_Y - y];
  b.piece("play", "op.shore", h(39), LAKE_Y, { w: h(7), end: h(5.6), walk: [...wl(h(31), h(60.9)), ...wl(h(36), h(61.6)), ...wl(h(40), h(62.1)), ...wl(h(44.1), h(62.25)), ...wl(h(46), h(62.6))] }, { z: 1, seed: 7919 * 3010 });
  // past the water's west end, the far shore (P3): the massif's wooded foot shelving into the lake
  bg(b, "back", 1300, "op.headland", { w: 1100, h: 300 }, LAKE_Y, 1, 7919 * 3011);
  // where the lake runs out against the east lip (front plane, in front of the near water): fallen
  // blocks heaped in the shallows, spreading toward the camera, so the water's end never shows
  // as a ruled edge in front of the rock (pullback, jetty-6s, play-catch, play-east); P5's east
  // corner takes over below it
  b.piece("front", "op.scree", h(109.25), LAKE_Y, { w: 140, deep: 82, h: 28 }, { z: 0, seed: 7919 * 3020 });
  // Kagami's spring: the lake drains through the karst and bursts from the cliff below it
  b.piece("play", "op.spring", h(97), h(65.4), { mw: 80, mh: 50, w: 44, drop: h(11) }, { z: 1, reflect: false });
  // its flow (12 fps over four frames)
  b.sprite({ id: "kagami-spring-flow", plane: "play", kind: "op.spring", x: h(97), y: h(65.4), p: { mw: 80, mh: 50, w: 44, drop: h(11), fallOnly: true }, frames: 4, fps: 12, reflect: false });
}

/**
 * P5, the lake's near shore: the ground at the camera's feet along the whole lake (the lake's
 * surface stops at its waterline, so it runs the full length), and on it the few landforms that
 * frame the bottom of every lake frame: per frame one dominant mass in one corner and a secondary
 * in the other, low wet ground with puddles of sky between. Placed by the shore's own px (0 at
 * 38 H; near-plane px are 1.35 x world px), composed for the key frames: play-west sees
 * 517..2437, play-walker 5183..7103, play-catch 7256..9176, the catch (2x, when the near plane
 * shows there) 7560..8520 with her at 8035, pullback 7789..9214, jetty-6s 8208..10201, play-east
 * 8034..9954, the postcard 5779..10291, Gate Road's first gate (guard-gate1) 8941..10861. Each
 * mass tops out below the deck line on screen. Past 9330 the ground stays low (under 40 px) so
 * Gate Road's arch reads over it, and it runs on to 10950 before falling away into the valley.
 * (seed block 3; explicit seeds 7919 x 3000 on, new ones 7919 x 3200 on)
 */
export const NEAR_MASSES: MassSpec[] = [
  // the west end: the shore turns, limestone dropping away (seen from the pass)
  { kind: "crag", x: -80, w: 380, h: 120, drop: -1 },
  // play-west: a grassy rise in the bottom-left corner, limestone in the bottom-right, a reed
  // clump under her reflection between them
  { kind: "hummock", x: 470, w: 480, h: 124, peak: 0.3 },
  { kind: "reeds", x: 1290, w: 130, h: 24, reed: 96, dense: 3.2 },
  { kind: "boulder", x: 1990, w: 460, h: 104, peak: 0.62 },
  // along the lake (seen while walking)
  { kind: "hummock", x: 2900, w: 420, h: 100, peak: 0.6 },
  { kind: "reeds", x: 3640, w: 170, h: 30, reed: 112, dense: 3.4 },
  { kind: "boulder", x: 4180, w: 320, h: 112, peak: 0.4 },
  { kind: "tuft", x: 4700, w: 120, h: 24 },
  // play-walker: a limestone outcrop in the bottom-left corner, a grass tuft under her
  // reflection, a tall reed bed on a low mound in the bottom-right (the postcard's dark bushes
  // left of the rise)
  { kind: "boulder", x: 5090, w: 480, h: 140, peak: 0.34 },
  { kind: "tuft", x: 5950, w: 150, h: 30 },
  { kind: "reeds", x: 6640, w: 440, h: 52, reed: 132, dense: 3.6 },
  // play-catch's bottom-left corner: the big grassy rise
  { kind: "hummock", x: 7190, w: 530, h: 132, peak: 0.3 },
  // a long reed bed: the pull-back's bottom-left corner, under her reflection in play-catch, the
  // left corner of play-east
  { kind: "reeds", x: 7790, w: 330, h: 26, reed: 104, dense: 3.2 },
  // the east corner: fused, leaning limestone rising to 9250, its face dropping away by 9330
  { kind: "crag", x: 8790, w: 520, h: 150, drop: 1 },
  // past it the low ground under Gate Road's cliff (guard-gate1 sees its natural arch over
  // 9370..9950): a low stone in it well clear of the arch, under 40 px
  { kind: "boulder", x: 10120, w: 150, h: 30, foot: 30, peak: 0.55 },
];

/** The lake's near shore on P5 and its reed beds (seed block 3). */
export function kagamiNear(b: WorldBuilder): void {
  const bankP: BankP = { w: 11400, h: 290, masses: NEAR_MASSES, fall: 10950, low: 9330 };
  const bank = b.piece("near", "op.bank", h(38), LAKE_Y, bankP as unknown as Record<string, unknown>, { z: 1, reflect: false, seed: 7919 * 3000 });
  // its reed beds sway in the wind (6 fps over 8 frames, a gust running along the shore)
  reedBeds(bankP, bank.seed).forEach(([x, w, hh, dense], i) => {
    const ground: number[] = [];
    for (let gx = 0; gx <= w; gx += 8) ground.push(Math.max(0, Math.round(bankTopAt(bankP, bank.seed, x + gx) - 3)));
    b.sprite({ id: `bank-reeds-${i}`, plane: "near", kind: "op.reeds", x: h(38) + x / PLANES.near.rate, y: LAKE_Y + 1 / PLANES.near.rate, p: { w: Math.round(w), h: Math.round(hh), density: dense, ox: Math.round(x), ground, loop: 8 }, frames: 8, fps: 6, reflect: false, seed: 7919 * (3200 + i) });
  });
  kagamiShallows(b);
}

/**
 * The catch's near corners (front plane): the near shore's shallows curving toward the camera, a
 * mud bank running off each bottom corner, a half-sunk boulder, a sunk log or old stubs, lily pads,
 * reeds that sway. The close band does not draw P5, so in the catch these are the near ground; at
 * play zoom they are a layer of shallows between the jetty's reflection and P5. Their tops reach
 * catch row ~860 (LAKE_Y + 36) and nothing of them rises above catch row 1000 between 98.2 and
 * 101.9 H (her calm water). They paint their own reflections (the lake mirrors no front-plane part
 * below its waterline), so neither they nor their reeds are mirrored. (seeds 7919 x 3230 on)
 */
function kagamiShallows(b: WorldBuilder): void {
  const corners: [number, ShallowsP, [number, number, number, number][]][] = [
    // left: the bank off the bottom-left corner, reeds on it, the boulder and a sunk log by it
    [h(95.0), { w: h(97.2) - h(95.0), wl: 64, deep: 170, side: -1, h: 30, wood: "log" }, [[4, 70, 64, 3.6], [96, 34, 44, 3]]],
    // right: the bank off the bottom-right corner, old broken stubs and the boulder in the water
    [h(102.6), { w: h(105.05) - h(102.6), wl: 62, deep: 170, side: 1, h: 24, wood: "stubs" }, [[96, 46, 58, 3.2], [146, 86, 88, 3.8]]],
  ];
  corners.forEach(([x, p, beds], i) => {
    const seed = 7919 * (3230 + i * 4);
    b.piece("front", "op.shallows", x, LAKE_Y, p as unknown as Record<string, unknown>, { z: 1, reflect: false, seed });
    beds.forEach(([bx, bw, bh, dense], k) => {
      const ground: number[] = [];
      for (let gx = 0; gx <= bw; gx += 8) ground.push(Math.round(shallowsTopAt(p, seed, bx + gx)));
      b.sprite({ id: `shallows-corner-reeds-${i}-${k}`, plane: "front", kind: "op.reeds", x: x + bx, y: LAKE_Y + p.wl, p: { w: bw, h: bh, density: dense, ox: Math.round(x + bx), ground, loop: 8 }, frames: 8, fps: 6, reflect: false, seed: seed + 7919 * (k + 1) });
    });
  });
}

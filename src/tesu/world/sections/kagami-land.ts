// Kagami's near shore (art: the Kagami art loop, painter p3): the lake's near shore on P5 with its
// reed beds, and the catch's near corners in the shallows (front plane). (The plateau rock, the
// west shore, the headland, the scree and the spring are in kagami-rock.ts; the islets in the
// middle distance are in kagami-islets.ts.)

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES } from "../types.ts";
import { bankTopAt, reedBeds, shallowsTopAt, type BankP, type MassSpec, type ShallowsP } from "../../art/library/opening/bank.ts";
import { LAKE_Y } from "./common.ts";

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

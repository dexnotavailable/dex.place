// Kagami's near shore (art: the Kagami art loop, painter p3): what stands in the water nearest the
// camera. The near masses on P5 with their reed beds, and the catch's near corners and the lily bed
// under her in the shallows (front plane). (The plateau rock, the west shore, the headland, the
// scree and the spring are in kagami-rock.ts; the islets in the middle distance are in
// kagami-islets.ts.)

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES } from "../types.ts";
import { bankTopAt, reedBeds, shallowsTopAt, type BankP, type MassSpec, type ShallowsP } from "../../art/library/opening/bank.ts";
import { LAKE_Y } from "./common.ts";

/**
 * P5, the lake's near shore, as separate masses standing in the mirror water (the lake runs on to
 * the bottom edge of every frame; nothing is painted between them). Placed by the shore's own px
 * (0 at 38 H; at play zoom one px is one screen px; P5's waterline is screen y 963 there) to the
 * round-3 zone table: per play frame one dominant dark mass in one bottom corner, a smaller one of
 * another kind in the other, at most two small accents, open water across most of the bottom edge.
 * The windows: play-west 517..2437, play-walker 5183..7103, play-catch 7256..9176, pullback
 * 7789..9214 (1.35x), jetty-6s 8208..10201 (0.97x), play-east 8034..9954, the postcard
 * 5779..10291 (0.43x), guard-gate1 8941..10861. No two frames share a rock.
 * (seed block 3: the bank keeps its seed 7919 x 3000; its reed beds 7919 x (3200 + i))
 */
export const NEAR_MASSES: MassSpec[] = [
  // play-west's bottom-left (0..433): a shelf of limestone chunks stepping down into the water from
  // its tall end off the frame's left edge, its nearest blocks running off the bottom; its top at
  // y 829 or lower, so p2's west shore and its reflection read above it
  { kind: "shelf", x: 470, w: 480, h: 134, drop: 1, bank: 0.3 },
  // play-west's open water: a lily-pad bed with sedge (her reflection at 1332..1362 stays open)
  { kind: "pads", x: 1610, w: 120, h: 14 },
  // play-west's bottom-right (1583..1920): a driftwood snag leaning out of a mud bar
  { kind: "snag", x: 2150, w: 250, h: 88, lean: 0.55 },
  { kind: "reeds", x: 2300, w: 120, h: 10, reed: 82, dense: 2.6 },
  // seen while walking: a reed and cattail bed on a mud bank, then a grassy knoll with a twig
  { kind: "reeds", x: 3000, w: 250, h: 30, reed: 112, dense: 3 },
  { kind: "knoll", x: 4120, w: 360, h: 92, peak: 0.55 },
  // play-walker's bottom-left (0..417): a chunked limestone outcrop standing in the water
  { kind: "outcrop", x: 5120, w: 455, h: 160 },
  // play-walker's open water (the Walker's reflection runs here): a lily-pad bed, a half-sunk stone
  { kind: "pads", x: 5850, w: 80, h: 10 },
  { kind: "stone", x: 6420, w: 30, h: 15 },
  // play-walker's bottom-right (1457..1920): a reed and cattail bed on a low mud bank
  { kind: "reeds", x: 6650, w: 450, h: 46, reed: 138, dense: 3.4, stone: true },
  // play-catch's bottom-left (0..444): reference 4's big grassy rise, lit blades and a twig breaking
  // its crown, a warm rim, its earth flank stepping into the water on mud shelves
  { kind: "rise", x: 7130, w: 570, h: 168, peak: 0.42, bank: 0.42 },
  // at the rise's inner foot, the pull-back's left (0..149), play-catch 434..654: a reed bed in the
  // water on a mud lump
  { kind: "reeds", x: 7690, w: 220, h: 14, reed: 118, dense: 3.4 },
  // jetty-6s's and play-east's left anchor (0..185, 174..366): a low dark mud bank, short reeds
  // (round-3 integration: lower, its reeds the taller part, so in pullback and play-catch, where it
  // stands mid-frame, it reads as a reed bed at the water and not a raft of mud)
  // (round 4: the critic's "mud raft" stamp: the catch's right spit is a mud bank too, so this one
  // is another kind, a pair of half-sunk limestone blocks, its short reeds a bed of their own below)
  { kind: "stone", x: 8232, w: 58, h: 26 },
  // the jetty's east landing (jetty-6s 763..1013, play-east 966..1226): low reeds and a stone,
  // under 60 so the landing and its reflection show
  { kind: "reeds", x: 9040, w: 170, h: 18, reed: 54, dense: 2.2, stone: true },
  // the east limestone, overlapping Gate Road's cliff foot (jetty-6s 1013..1225, play-east
  // 1226..1446, guard-gate1 319..539): chunks up to 110 high stepping down to the right, running
  // off the bottom (past the lake's end there is no water at its foot)
  { kind: "shelf", x: 9258, w: 236, h: 100, drop: 1, bank: 1 },
  // 9480..9950: nothing (guard-gate1's natural arch and its falls read to the bottom)
  // (round-3 integration, last so no mass is reseeded: a low block in front of the east
  // limestone's water side, running off the bottom, so the lake's end at the cliff foot meets
  // rock in jetty-6s and play-east instead of a pale wedge of the cliff's face under the water;
  // under 60, the landing and its reflection show above it)
  { kind: "shelf", x: 9186, w: 92, h: 40, drop: 1, bank: 1 },
  // (round 4, last so no mass is reseeded) the short reeds by the half-sunk blocks at 8232, barely
  // any mud under them: reeds standing in the shallows
  { kind: "reeds", x: 8268, w: 96, h: 5, reed: 66, dense: 2.6 },
];

/** The lake's near shore on P5 and its reed beds (seed block 3). */
export function kagamiNear(b: WorldBuilder): void {
  const bankP: BankP = { w: 11400, h: 290, masses: NEAR_MASSES };
  const bank = b.piece("near", "op.bank", h(38), LAKE_Y, bankP as unknown as Record<string, unknown>, { z: 1, reflect: false, seed: 7919 * 3000 });
  // its reed beds sway in the wind (6 fps over 8 frames, a gust running along the shore); they
  // paint their own reflections (nothing mirrors P5)
  reedBeds(bankP, bank.seed).forEach(([x, w, hh, dense], i) => {
    const ground: number[] = [];
    for (let gx = 0; gx <= w; gx += 8) ground.push(Math.max(0, Math.round(bankTopAt(bankP, bank.seed, x + gx) - 3)));
    b.sprite({ id: `bank-reeds-${i}`, plane: "near", kind: "op.reeds", x: h(38) + x / PLANES.near.rate, y: LAKE_Y + 1 / PLANES.near.rate, p: { w: Math.round(w), h: Math.round(hh), density: dense, ox: Math.round(x), ground, loop: 8, refl: 0.3 }, frames: 8, fps: 6, reflect: false, seed: 7919 * (3200 + i) });
  });
  kagamiShallows(b);
}

/**
 * The catch's near corners and the lily bed under her (front plane). The close band does not draw
 * P5, so in the catch these are the near ground: the left corner the dominant (a grassy rise from
 * the left edge to about catch x 520, its crown at catch rows 800 to 860, in front of p2's stub
 * clump at 95.55 H), the right one smaller and of another kind (a mud spit from about catch x 1600,
 * no higher than row 880, reeds and one stone), and between them, under her, a quiet lily bed (99.7
 * to 100.4 H, rows 895 to 1080 in the catch, play-catch x 800 to 870) where her reflection is
 * missing at 2x (E5). At play zoom they are low shallows under P5. They paint their own reflections,
 * so neither they nor their reeds are mirrored. (seeds 7919 x 3230 on; new ones 7919 x (3300 + n))
 */
function kagamiShallows(b: WorldBuilder): void {
  const corners: [number, ShallowsP, number, [number, number, number, number][]][] = [
    // left: the rise, its tall end off the corner, a snag lying out from it; reeds by its inner end
    // (deep 300: its bank leaves the frame by the bottom edge at every zoom, never a cut)
    [h(94.7), { w: h(98.1) - h(94.7), wl: 60, deep: 300, side: -1, h: 52, wood: "log" }, 7919 * 3230, [[238, 40, 40, 2.4]]],
    // right: the mud spit, one stone, mixed reeds and cattails on it
    [h(103.3), { w: h(105.6) - h(103.3), wl: 96, deep: 170, side: 1, h: 40 }, 7919 * 3234, [[44, 34, 40, 3], [96, 64, 56, 3.4], [178, 30, 30, 2.2]]],
    // under her: the lily bed
    [h(99.75), { w: h(100.3) - h(99.75), wl: 52, deep: 144, side: 1, h: 6, kind: "pads" }, 7919 * 3300, []],
  ];
  corners.forEach(([x, p, seed, beds], i) => {
    b.piece("front", "op.shallows", x, LAKE_Y, p as unknown as Record<string, unknown>, { z: 1, reflect: false, seed });
    beds.forEach(([bx, bw, bh, dense], k) => {
      const ground: number[] = [];
      for (let gx = 0; gx <= bw; gx += 8) ground.push(Math.round(shallowsTopAt(p, seed, bx + gx)));
      b.sprite({ id: `shallows-corner-reeds-${i}-${k}`, plane: "front", kind: "op.reeds", x: x + bx, y: LAKE_Y + p.wl, p: { w: bw, h: bh, density: dense, ox: Math.round(x + bx), ground, loop: 8, refl: 0 }, frames: 8, fps: 6, reflect: false, seed: seed + 7919 * (k + 1) });
    });
  });
}

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
  // (kagami9 round 1, the critic's W2-11: its mud bar read as one more raft, the stamp of the catch's
  // spit) lying half sunk in the shallows instead, no bar under it
  { kind: "snag", x: 2150, w: 250, h: 88, lean: 0.55, sunk: true },
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
  // (round 6, E8: not at the vista's density, so the postcard's darks leave its bottom centre;
  // its corners are framed by masses of its own, below)
  // (kagami9 round 1, the critic's W2-10: "a mid-green carpet with a red mud strip": the darkest mass in
  // play-catch, lit only along its rim, grown over to the water, broad-leaved plants breaking its crown)
  { kind: "rise", x: 7130, w: 570, h: 168, peak: 0.42, bank: 0.42, levels: [0.9, 9], shade: 0.75, closed: true, leaves: 6 },
  // at the rise's inner foot, the pull-back's left (0..149), play-catch 434..654: a reed bed in the
  // water on a mud lump
  // (round 6, the critic's "reed bar": barely any mud under it, reeds standing in the shallows at
  // the rise's foot, part of the corner, not a raft beside it)
  // (kagami9 round 1, the critic's W2-11, "one accent per frame": play-catch had this reed bar and the
  // catch's mud spit; the spit stays the one accent, this bed is no longer painted (levels no plate has,
  // kept so no mass after it is reseeded; no reed sprites stand where no bank is painted))
  { kind: "reeds", x: 7690, w: 220, h: 6, reed: 118, dense: 3.4, levels: [99, 99] },
  // jetty-6s's and play-east's left anchor (0..185, 174..366): a low dark mud bank, short reeds
  // (round-3 integration: lower, its reeds the taller part, so in pullback and play-catch, where it
  // stands mid-frame, it reads as a reed bed at the water and not a raft of mud)
  // (round 4: the critic's "mud raft" stamp: the catch's right spit is a mud bank too, so this one
  // is another kind, a pair of half-sunk limestone blocks, its short reeds a bed of their own below)
  // (round 6, the critic's P5, "at most one accent a frame": the catch's mud spit on the front plane is
  // the one accent in pullback, jetty-6s, play-catch and play-east, so this pair of blocks and the
  // reeds by them (8268) are no longer painted: levels no plate has; kept in the list so no mass after
  // them is reseeded)
  { kind: "stone", x: 8232, w: 58, h: 26, levels: [99, 99] },
  // the jetty's east landing (jetty-6s 763..1013, play-east 966..1226): under 60 so the landing
  // and its reflection show (round 5, the critic: "the rafts are the same stamp: at most one a
  // frame, the other accent another kind": the catch's spit is the frame's one mud bank) a lily
  // bed lying on the shallows with a few sedges, clear of her reflection in jetty-6s
  { kind: "pads", x: 8968, w: 104, h: 12, dense: 1.6 },
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
  { kind: "reeds", x: 8268, w: 96, h: 5, reed: 66, dense: 2.6, levels: [99, 99] },
  // (round 6, the critic's P1, near framing, open since round 0; last so no mass is reseeded) masses
  // painted only at one band's density (bank.ts MassSpec.levels), so each frames one view without
  // standing in another's middle:
  // - the pull-back (level 2, zoom 1 to 1.6; P5 is not drawn above 1.6): the rise's east shoulder
  //   coming at the camera in its bottom-left corner (x 0..400 at 1.35x), dark, over the jetty's
  //   reflection; at play zoom it would stand under her in play-catch, so it is not painted there.
  //   Its east end stops at 3D x ~9640: the reveal track crosses zoom 1 (where the plate level
  //   switches) between ticks 340 and 350 of the opening (her x 107.3 H, the camera at 10403), when
  //   it has left the frame by the left edge (at about x -70), so it never pops out
  // (kagami9 round 1, the critic's W2-2: the pull-back's motion swapped the catch's small mound for this
  // larger one as P5 came in under zoom 1.6: one mass now frames both, the catch's near corner on the
  // front plane (kagamiShallows), which every zoom draws; this one is no longer painted: levels no plate
  // has, kept so no mass after it is reseeded)
  { kind: "rise", x: 7540, w: 540, h: 190, peak: 0.36, bank: 0.6, closed: true, shade: 0.4, levels: [99, 99] },
  // - the postcard (level 0.43, the vista at 0.5x): its bottom-left corner, a dark rise coming in
  //   from the left edge (its right corner is Gate Road's cliff); the bottom centre stays open
  //   water, her reflection and the jetty's (a shelf in front of the cliff's foot on the right would
  //   cover Gate Road's natural arch in guard-terrace, which sees the near plane at the same density)
  // (kagami9 round 1, W2-1: its bank ran down only to the plate's 290 px and stopped on a flat bottom
  // across the postcard, y ~1040; now it runs off the bottom. Not at the TESU frame's 1/8, where it was a
  // dark blob on the waterline: the near shore below takes that frame's bottom.)
  { kind: "rise", x: 5600, w: 1180, h: 380, peak: 0.1, bank: 0.75, crown: [0.5, 0.5], closed: true, shade: 0.3, levels: [0.3, 0.6], deep: 470 },
  // (kagami9 round 1, the critic's W2-1, the postcard tray: in the far frames the lake's surface ended
  // on one ruled line over the plateau's grey blocks, postcard y 994, x 160..1430; the descent at 0.54x
  // the same, y ~1005) the lake's nearest shore across that edge, a dark bank of bedded chunks with grass
  // on its ledges (bank.ts shoreBody), last so no mass is reseeded. Its line keeps it under every play
  // and opening frame's bottom edge (play zoom sees 117 px under P5's waterline, the pull-back's last
  // samples 124, jetty-6s 143 from 8132): two of them, one per band.
  // - the play band's plates (levels 1 and 2): seen only from the descent's widest moments, where it
  //   covers the lake's edge (ly 200 at 0.54x) and rises out of the bottom as the camera comes down
  { kind: "shore", x: 5950, w: 3450, h: 0, foot: 186, deep: 470, levels: [0.9, 9], key: 7919 * 3040, line: [[5950, 128], [6600, 124], [6880, 120, 60], [7050, 118, 14], [7720, 118, 14], [7800, 125, 50], [8080, 150], [8700, 152], [9400, 150]] },
  // - the far plates (the postcard 0.43, the TESU frame 0.1): its line rising at the woods on the left
  //   and toward the east cliff on the right, low across the middle where her reflection and the jetty's
  //   hang (postcard x 900..1000 down to y 985, ly 146)
  // - the postcard's far-left woods standing in the water on a chunked limestone foot where their inner
  //   end meets the lake (the critic: "a flat-bottomed dark mass"), at the far plates only
  { kind: "outcrop", x: 6470, w: 330, h: 120, foot: 4, levels: [0.2, 0.6] },
  { kind: "shore", x: 4800, w: 4680, h: 0, foot: 158, deep: 470, levels: [0.3, 0.6], key: 7919 * 3040, line: [[4800, -50], [5779, -40], [6000, -30], [6200, 0], [6420, 35], [6700, 70], [7100, 96], [7500, 108], [7800, 134], [8000, 140], [8250, 140], [8450, 112], [8750, 82], [9000, 60], [9300, 45], [9480, 36]] },
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
    // (round 6, E8: not at the vista's density: there it was the postcard's bottom-centre mound)
    // (kagami9 round 1, the critic's W2-2: "one near mass for the catch and the pull-back", the darkest
    // thing in both frames, lit only along its rim from the sun up to the left, broad-leaved plants
    // breaking its crown, ref 04's near mound) wider and taller, in its own shade, grown over to the
    // water; only in the close band (zoom above 1: the catch, the pull-back and its motion), where P5's
    // pull-back rise no longer stands in front of it; at play zoom P5's rise frames play-catch instead
    [h(95.9), { w: 400, wl: 60, deep: 300, side: -1, h: 118, wood: "log", levels: [1.5, 9], shade: 0.8, closed: true, leaves: 7 }, 7919 * 3230, [[300, 40, 40, 2.4]]],
    // right: the mud spit, one stone, mixed reeds and cattails on it
    [h(103.3), { w: h(105.6) - h(103.3), wl: 96, deep: 170, side: 1, h: 40 }, 7919 * 3234, [[44, 34, 40, 3], [96, 64, 56, 3.4], [178, 30, 30, 2.2]]],
    // under her: the lily bed
    [h(99.75), { w: h(100.3) - h(99.75), wl: 52, deep: 144, side: 1, h: 6, kind: "pads" }, 7919 * 3300, []],
    // (round 7, the water lane; last, a seed of its own) play-west's shore stepping down toward the
    // camera: blocks fallen from its limestone lying in the shallows in front of it, west of the
    // jetty's first piles (under P5's shelf top there: play-west rows 792 to 829)
    [h(39.2), { w: h(43.3) - h(39.2), wl: 4, deep: 60, side: -1, h: 22, kind: "ledge" }, 7919 * 3301, []],
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

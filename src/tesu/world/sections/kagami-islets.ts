// Kagami's islets (art: the Kagami art loop; painter p2 from round 2, with the pines and the made
// things): the islets standing in the middle distance of the lake on P3. Moved out of
// kagami-land.ts unchanged so one painter owns the islets with the pines that grow on them.

import type { WorldBuilder } from "../build.ts";
import { LAKE_Y } from "./common.ts";
import { bg } from "./kagami-place.ts";

/**
 * The islets in the middle distance of the lake (P3, seed block 6; explicit seeds 7919 x 3100
 * on): four different places, so the mirror stays open between them. Back-plane px: play-west
 * sees 1980..3900, play-walker 4123..6043, play-catch 5075..6995, the catch 5292..6616 (1.45x),
 * jetty-6s 5512..7465, play-east 5432..7352, the postcard 4397..7507 (0.62x).
 */
export function kagamiIslets(b: WorldBuilder): void {
  // a reed bed round a small stone lantern (play-west, under the Walker)
  bg(b, "back", 3560, "op.islet", { kind: "reedbed", w: 170, h: 9 }, LAKE_Y, 0, 7919 * 3100);
  // a ruined pile field: old posts of different heights, one broken, a fallen beam (play-walker,
  // in front of the Walker's reflection; the postcard's left edge)
  bg(b, "back", 4420, "op.islet", { kind: "piles", w: 150, h: 12 }, LAKE_Y, 1, 7919 * 3101);
  // a jagged rock with a twisted pine leaning out over the water (play-walker's right, play-catch's
  // left, cut by the catch's left edge)
  bg(b, "back", 5330, "op.islet", { kind: "crag", w: 110, h: 62, dir: 1 }, LAKE_Y, 2, 7919 * 3102);
  // the small torii in the shallows (round 2: from back x 6230 to 5700): every frame keeps it at
  // least 60 px clear of her and of the lift's top station (catch x ~557-643, pullback ~378-443,
  // jetty-6s ~162-222, play-catch ~600-660, play-east ~244-304); anywhere from 5760 to 6450 puts
  // it behind her or the station in one frame or another
  bg(b, "back", 5700, "op.islet", { kind: "torii", w: 96, h: 13 }, LAKE_Y, 3, 7919 * 3103);
}

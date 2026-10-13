// Kagami 鏡, Mirrorlake, and the Western Pass (GDK A.3). The head of て's top line: an
// alpine plateau lake so still it holds a second sky, a plank jetty along its whole
// length, the catch near the jetty's east end. West, past the lake, the pass and the road
// that bends away into the far mountains (the world's west end).
//
// Terrain grammar: massif. Solid rock to the world floor; the lake sits on it.
//
// This file holds the world builder's part (collision, water, void, spawns, the place, the
// Walker) and calls Kagami's dressing files, owned by the painters of the Kagami art loop:
// kagami-rock.ts (the plateau rock, the west shore, the headland, the scree, the spring),
// kagami-land.ts (the near shore), kagami-islets.ts (the islets), kagami-jetty.ts (the jetty and
// its made things) and kagami-backdrop.ts (light, water colours, sky, P1 and P2). Each dressing block
// starts from the seed it had before the split, so a block can add or drop pieces without
// reseeding another block or any section built after Kagami. New pieces and sprites in a
// block take explicit seeds.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { CATCH_X, DECK_Y, JETTY_X0, JETTY_X1, LAKE_X0, LAKE_X1, LAKE_Y } from "./common.ts";
import { PLANES } from "../types.ts";
import { WALKER, seedAt, seedNow } from "./kagami-place.ts";
import { kagamiNear } from "./kagami-land.ts";
import { kagamiRock } from "./kagami-rock.ts";
import { kagamiIslets } from "./kagami-islets.ts";
import { kagamiJetty } from "./kagami-jetty.ts";
import { kagamiBackdrop, kagamiWade } from "./kagami-backdrop.ts";

export { bg } from "./kagami-place.ts";

/** Seeds each block used before the split (the near shore's 21 reed beds included). */
const BLOCK = { land: 0, jetty: 3, near: 22, backdrop: 44, walker: 73, islets: 74, end: 79 };

export function kagami(b: WorldBuilder): void {
  const s0 = seedNow(b);

  // block 1 (kagami-rock.ts): the plateau rock and the spring
  seedAt(b, s0 + BLOCK.land);
  kagamiRock(b);
  // collision: the pass and the west shore, then the jetty
  b.walk([h(0), h(59.2), h(5), h(59.0), h(9), h(58.6), h(14), h(58.5), h(19), h(59.0), h(25), h(59.9), h(31), h(60.9), h(36), h(61.6), h(40), h(62.1), h(44.1), h(62.25)],
    { surface: "grass", name: "kagami-west" });
  b.walk([JETTY_X0, DECK_Y, JETTY_X1, DECK_Y], { surface: "wood", depth: h(0.1), name: "jetty" });
  // the west end: the road bends away into the far mountains; she stops and turns back
  b.wall({ x: h(2.2), y0: h(50), y1: h(60), reason: "world-end", from: "right" });

  // block 2 (kagami-jetty.ts): the jetty, its posts, the boat, the deck props
  seedAt(b, s0 + BLOCK.jetty);
  kagamiJetty(b);

  // block 3 (kagami-land.ts): the lake's near shore on P5 and its reed beds
  seedAt(b, s0 + BLOCK.near);
  kagamiNear(b);

  // The surface runs on toward the camera past the near plane's waterline to the frame's bottom
  // edge (as Hoài Phố's harbour does), so the near shore stands in the water as framing masses
  // instead of a strip across the whole frame (GDK A.1: no single P5 object wider than about a
  // quarter of the frame). Its near extent is given at depth LAKE_NEAR on the same line as
  // before (40 to 109 H at the near plane, -60 to 150 H at depth 0.06), so the lake's ends are
  // where they were at every depth it already showed; nearer still it narrows a little.
  const LAKE_NEAR = 3;
  const toNear = (1 / LAKE_NEAR - 1 / PLANES.near.rate) / (1 / 0.06 - 1 / PLANES.near.rate);
  b.water({
    y: LAKE_Y, x0: LAKE_X0 + (h(-60) - LAKE_X0) * toNear, x1: LAKE_X1 + (h(150) - LAKE_X1) * toNear,
    fx0: h(-60), fx1: h(150), near: LAKE_NEAR, far: 0.06, kind: "lake",
  });
  // nothing under the lake's surface to walk on: a fall there tugs her back
  b.void({ x0: LAKE_X0, x1: LAKE_X1, y: LAKE_Y + h(0.5), y1: h(66) });

  b.spawn({ id: "catch", x: CATCH_X, y: DECK_Y, facing: 1 });
  b.spawn({ id: "western-pass", x: h(12), y: h(58.5), facing: 1 });
  b.place({ id: "kagami", name: "Kagami", x0: 0, x1: JETTY_X1, title: "place", spawn: "catch" });

  // block 4 (kagami-backdrop.ts): the light and water colours, the sky, P1 and P2
  seedAt(b, s0 + BLOCK.backdrop);
  kagamiBackdrop(b);

  // block 5: the Walker lane's giant, rendered from its rig (art/walker/tools/blender/render_walker.py)
  // in its retimed wade (Dex: several hundred metres tall, slow and heavy): one cycle in 20 s,
  // 48 frames (2.4 a second), 560 px tall at play zoom on P2 with a half-size set for the wide
  // frames. It moves only when its frame changes, 3.82 plane px a frame (the render's ground
  // speed), so its planted feet stay planted: 9.18 plane px/s, 32.8 3D px/s on P2.
  seedAt(b, s0 + BLOCK.walker);
  b.sprite({
    id: "walker-kagami", plane: "mid", kind: "frames", x: WALKER.x, y: WALKER.y,
    p: { sets: WALKER.sets.map((s) => ({ ...s })) },
    frames: WALKER.frames, fps: WALKER.fps, path: [...WALKER.path], speed: WALKER.speed, stepMove: WALKER.stepMove,
  });
  // what follows it on the water (kagami-backdrop.ts; explicit seeds only)
  kagamiWade(b);

  // block 6 (kagami-islets.ts): the islets
  seedAt(b, s0 + BLOCK.islets);
  kagamiIslets(b);

  // the land after Kagami starts where it always did
  seedAt(b, s0 + BLOCK.end);
}

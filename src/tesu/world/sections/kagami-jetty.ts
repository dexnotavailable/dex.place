// Kagami's jetty and the made things on it (art: the Kagami art loop, painter p2): the jetty,
// its mooring posts and the ripple rings at their feet, the moored boat and its line, the coil
// and the deck props. The props' ids, places, classes and materials are the world builder's
// (interactables): only their kind and look may change.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { CATCH_X, DECK_Y, JETTY_X0, JETTY_X1, LAKE_Y } from "./common.ts";

export function kagamiJetty(b: WorldBuilder): void {
  // the jetty
  b.piece("play", "op.jetty", JETTY_X0, DECK_Y, { w: JETTY_X1 - JETTY_X0, water: LAKE_Y - DECK_Y }, { z: 2 });
  for (const [x, hh, rope] of [[h(52), 30, false], [h(71), 38, true], [h(88), 30, false], [CATCH_X - h(4.3), 44, true], [CATCH_X + h(3.3), 58, true], [JETTY_X1 - h(0.4), 34, false]] as const) {
    b.piece("play", "op.post", x, DECK_Y, { h: hh, down: LAKE_Y - DECK_Y, rope }, { z: 3 });
  }
  // ripple rings opening round the posts that stand in the lake (env-sky lane)
  for (const x of [h(52), h(71), h(88), CATCH_X - h(4.3), CATCH_X + h(3.3), JETTY_X1 - h(0.4)]) {
    b.sprite({ id: `ripple-${Math.round(x)}`, plane: "front", kind: "sky.ripple", x, y: LAKE_Y, p: { rx: 26, rings: 3 }, frames: 8, fps: 8, reflect: false });
  }
  // a moored boat beside the jetty, a coil of rope and a bucket on the deck
  // (Kagami is mirror-still: the boat rests without bobbing, its reflection unbroken)
  b.piece("play", "op.boat", h(91.5), LAKE_Y + 2, { w: h(2.6) }, { z: 1 });
  // its mooring line, slack, from the bow up to the post at h(88)
  b.piece("play", "op.rope", h(91.5) + 6, LAKE_Y - 22, { dx: h(88) - h(91.5) - 6 + 6, dy: (DECK_Y - 18) - (LAKE_Y - 22), sag: 0.1 }, { z: 2 });
  b.piece("play", "op.coil", CATCH_X + h(2.6), DECK_Y, { r: 12 }, { z: 4 });
  b.prop({ id: "jetty-barrel", kind: "op.bucket", p: { h: 20 }, x: h(97.4), y: DECK_Y, cls: "cosmetic", material: "wood" });
  b.prop({ id: "jetty-crate", kind: "crate", p: { w: 30, h: 26 }, x: h(96.6), y: DECK_Y, cls: "cosmetic", material: "wood" });
  b.prop({ id: "jetty-jar", kind: "jar", p: { h: 20, glaze: "clay" }, x: h(96.6), y: DECK_Y - 26, cls: "cosmetic", material: "clay", on: "jetty-crate", pieces: 3 });
}

// Kagami's jetty and the made things on it (art: the Kagami art loop, painter p2): the old jetty
// and its two landings, the lift's top station, mooring posts and the ripple rings at a few pile
// feet, broken stubs standing alone in the lake, the moored boat and its line, the deck props (a
// fisher's corner) and the great pine on the east lip whose long arm reaches back over the jetty.
// The props' ids, places, classes and materials are the world builder's (interactables): only
// their kind and look may change.
//
// The lake mirrors the plate, so the jetty's plate holds the deck as the water sees it (from
// below, dark) and its lit face is a row of sprites the water does not see: the reflection is a
// darker, broken band. Things in front of the deck's face (posts, the station, the coil, the net)
// are sprites drawn after it. Every new piece and sprite here has an explicit seed.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { CATCH_X, DECK_Y, JETTY_X0, JETTY_X1, LAKE_Y, yOn } from "./common.ts";
import { PLANES } from "../types.ts";
import { jettyPlan, type JettyP } from "../../art/library/opening/jetty.ts";

/** The lift's top station (hoaipho.ts: its usable and its cables, fixed). */
const LIFT_X = JETTY_X1 - h(1.6);
/** Kagami's rock top under the jetty's ends (kagami-land.ts, frozen within 4 px), and Gate Road's rock face at the east end (gate-road.ts). */
const WEST_ROCK = [h(36), h(61.6), h(40), h(62.1), h(43.6), h(62.25), h(45), h(62.75), h(48), h(62.85), h(52), h(62.85)];
const EAST_ROCK = [h(104), h(62.85), h(107.4), h(62.7), h(109.2), h(62.4)];
const GATE_FACE = [h(108.8), h(62.8), JETTY_X1, h(62.0)];

export function kagamiJetty(b: WorldBuilder): void {
  let n = 2000;
  const seed = (): number => 7919 * n++;
  // seeds for what round 2 adds, after the earlier ones so nothing placed before is reseeded
  const fresh = (k: number): number => 7919 * (2060 + k);
  const water = LAKE_Y - DECK_Y;
  const W = JETTY_X1 - JETTY_X0;
  // the land under the ends, local to the deck's top-left corner
  const west: number[] = [];
  for (let i = 0; i < WEST_ROCK.length; i += 2) west.push(WEST_ROCK[i]! - JETTY_X0, WEST_ROCK[i + 1]! - DECK_Y);
  const east: number[] = [];
  for (let x = h(104); x <= JETTY_X1 + 0.01; x += 6) {
    let y = yOn(EAST_ROCK, x);
    if (x >= GATE_FACE[0]!) y = Math.min(y, yOn(GATE_FACE, x));
    east.push(x - JETTY_X0, y - DECK_Y);
  }
  // (round 5, the critic: "the deck is one full-width ruler") a few old spans have sagged, each
  // clear of where she stands in the key frames, the props, the posts and the station
  // (round 6: and one in the catch's and play-catch's span, the bay between the bucket and her stand,
  // catch x ~690, play-catch ~690)
  const jp: JettyP = { w: W, water, west, east, gap: [LIFT_X - 88 - JETTY_X0, LIFT_X + 19 - JETTY_X0], sag: [[880, 3.2], [2240, 2.6], [3420, 3.4], [4660, 2.8], [5244, 3]] };

  // the great pine on the east lip (behind the jetty): rooted on the shelf against the road's
  // rock, its long arm reaching west over the station and the jetty's end
  b.piece("play", "op.pine", h(108.72), DECK_Y + 46, { h: 530, dir: -1, arm: [570, 0.86], bend: -0.25, armsFrom: 0.8, roots: 0, grip: 22, cast: [16, 11] }, { z: 1, seed: seed() });

  // the jetty: its plate (the piles; the deck as the lake sees it)
  const jet = b.piece("play", "op.jetty", JETTY_X0, DECK_Y, { ...jp, part: "plate" }, { z: 2 });
  const plan = jettyPlan(jp, jet.seed);
  // its landings: a stone step down to the west shore; a stone crib on the east shelf
  const feet = (x0: number, x1: number, dx: number): [number, number][] => plan.piles.filter((q) => !q.back && q.x > x0 && q.x < x1 && q.foot < water + 20).map((q) => [q.x - dx, q.hw]);
  b.piece("play", "op.landing", JETTY_X0, DECK_Y, { end: "west", ground: west, water, feet: feet(-10, 220, 0) }, { z: 3, seed: seed() });
  b.piece("play", "op.landing", JETTY_X1, DECK_Y, { end: "east", ground: east.map((v, i) => (i % 2 ? v : v - W)), water, feet: feet(W - 200, W, W), roots: [h(108.72) - JETTY_X1, 46] }, { z: 3, seed: seed() });
  // its lit face, in sprites the lake does not mirror
  for (let i = 0, x = -4; x < W; i++, x += 800) {
    b.sprite({ id: `jetty-face-${i}`, plane: "play", kind: "op.jetty", x: JETTY_X0, y: DECK_Y, p: { ...jp, part: "face", from: x, to: Math.min(W, x + 800), plan: jet.seed }, frames: 1, reflect: false, seed: seed() });
  }

  // the lift's top station, built into the jetty under its prompt: narrow (106.5 to 107.58 H
  // below its roof), so she stands on the open deck east of it; its pulley turns a notch now and
  // then and its lantern (west side) flickers, each a sprite of its own
  const st = { h: 221, water, cable: [6, -h(0.2)] as [number, number] };
  // (round 6, the critic's P6: its mirror image was a crisp ladder down to a crisp roof) the lake does
  // not mirror these: the station paints its own reflection, held to the deck band's contrast and
  // dissolving before the roof
  b.sprite({ id: "lift-top-station", plane: "play", kind: "op.station", x: LIFT_X, y: DECK_Y, p: { ...st, part: "frame" }, frames: 1, reflect: false, seed: seed() });
  b.sprite({ id: "lift-top-pulley", plane: "play", kind: "op.station", x: LIFT_X, y: DECK_Y, p: { ...st, part: "pulley" }, frames: 32, fps: 8, reflect: false, seed: fresh(0) });
  b.sprite({ id: "lift-top-lantern", plane: "play", kind: "op.station", x: LIFT_X, y: DECK_Y, p: { ...st, part: "lantern" }, frames: 16, fps: 8, reflect: false, seed: fresh(1) });
  // (on the front plane: drawn after the near water, as the shallows' own reflections are)
  b.sprite({ id: "lift-top-station-refl", plane: "front", kind: "op.station", x: LIFT_X, y: DECK_Y, p: { ...st, part: "refl" }, frames: 1, reflect: false, seed: fresh(4) });

  // mooring posts standing up past the deck's edge (heights, thickness and ropes their own)
  const posts: [number, number, boolean, number][] = [[h(51.4), 26, false, 6], [h(70.6), 40, true, 7.5], [h(88.1), 30, false, 6], [CATCH_X - h(4.3), 46, true, 7], [h(104.3), 54, true, 6.5]];
  posts.forEach(([x, hh, rope, hw], i) => b.sprite({ id: `jetty-post-${i}`, plane: "play", kind: "op.post", x, y: DECK_Y, p: { h: hh, down: water, rope, hw }, frames: 1, seed: seed() }));

  // ripple rings opening round a few of the feet in the lake (never all of them)
  const rings: [number, number, number][] = posts.filter((_, i) => i !== 0).map(([x]) => [x, 24, 3]);
  plan.piles.forEach((q, i) => {
    if (q.back || q.foot < water + 20 || q.x < 300 || Math.abs(JETTY_X0 + q.x - LIFT_X) < 90) return;
    if (((i * 2654435761) >>> 0) % 100 < 9) rings.push([JETTY_X0 + q.x + q.lean * ((q.foot - water) / Math.max(1, q.foot - q.top)), 12 + q.hw * 2, 2]);
  });
  rings.forEach(([x, rx, k], i) => b.sprite({ id: `jetty-ripple-${i}`, plane: "front", kind: "sky.ripple", x, y: LAKE_Y, p: { rx, rings: k }, frames: 8, fps: 8, reflect: false, seed: seed() }));

  // reeds where the jetty's ends meet the shore
  b.sprite({ id: "jetty-reeds-west", plane: "play", kind: "op.reeds", x: JETTY_X0 + 44, y: LAKE_Y + 1, p: { w: 46, h: 30, density: 3.6, ox: 44 }, frames: 4, fps: 6, seed: seed() });
  b.sprite({ id: "jetty-reeds-east", plane: "play", kind: "op.reeds", x: JETTY_X1 - 150, y: LAKE_Y + 1, p: { w: 40, h: 36, density: 3.2, ox: 6090 }, frames: 4, fps: 6, seed: seed() });

  // broken stubs of an older jetty standing alone further out in the lake (P3)
  const back = PLANES.back.rate;
  b.piece("back", "op.stub", 4480 / back, LAKE_Y, { piles: [[0, 22, 3.2, 1.5], [9, 12, 2.6, -1]], lilies: 3, spread: 16 }, { z: 0, seed: seed() });
  // (round 2: from back x 5650 to 5560, out of the torii's way and out of her calm water in the
  // catch: catch x ~390, play-catch ~485, play-walker ~1437)
  b.piece("back", "op.stub", 5560 / back, LAKE_Y, { piles: [[0, 30, 3.6, -2], [-14, 16, 3, 1], [12, 8, 2.4, 0]], lilies: 4, spread: 22 }, { z: 0, seed: seed() });
  // and one in the shallows just off the jetty by the fisher's corner, in reeds and lily pads
  b.piece("front", "op.stub", h(95.55), LAKE_Y, { piles: [[0, 48, 8, 3], [-27, 21, 5.5, -2], [22, 11, 4.5, 1]], lilies: 9, spread: 58, sedge: [84, 30], shade: 0.18 }, { z: 0, seed: seed() });
  b.sprite({ id: "shallows-reeds-0", plane: "front", kind: "op.reeds", x: h(95.16), y: LAKE_Y + 1, p: { w: 34, h: 42, density: 3.4, ox: 9140 }, frames: 4, fps: 6, seed: seed() });
  b.sprite({ id: "shallows-reeds-1", plane: "front", kind: "op.reeds", x: h(95.62), y: LAKE_Y + 1, p: { w: 26, h: 26, density: 3, ox: 9180 }, frames: 4, fps: 6, seed: seed() });

  // a moored boat beside the jetty (Kagami is mirror-still: the boat rests without bobbing, its
  // reflection unbroken) and its slack line up to the post at h(88)
  // (round 2: on the front plane, floating at the waterline in front of the piles rather than
  // inside them, the lake mirroring it; it lies along the widest bay near the post at 88.1 H)
  const BOAT_W = h(2.3);
  const bents = plan.bents.map((q) => JETTY_X0 + q).filter((x) => x > h(88.8) && x < h(93.4));
  let bay: [number, number] = [h(89.6), h(90.8)];
  for (let i = 1; i < bents.length; i++) if (bents[i]! - bents[i - 1]! > bay[1] - bay[0]) bay = [bents[i - 1]!, bents[i]!];
  const boatX = (bay[0] + bay[1]) / 2 - BOAT_W * 0.42;
  b.piece("front", "op.boat", boatX, LAKE_Y, { w: BOAT_W }, { z: 1, seed: fresh(2) });
  // its line, slack, from the bow post up to the mooring post at 88.1 H
  const bowX = boatX + BOAT_W * 0.07, bowY = LAKE_Y - 21;
  b.piece("front", "op.rope", bowX, bowY, { dx: h(88.1) + 4 - bowX, dy: DECK_Y - 17 - bowY, sag: 0.12 }, { z: 2, seed: fresh(3) });

  // the fisher's corner by the catch: a coil of rope, a heap of net, a fish basket, and the
  // builder's crate (a jar on it) and bucket
  // (round 6, the critic's P6: its reflection floated under the deck band) not mirrored: the deck's
  // own reflection stands where its image would be
  b.sprite({ id: "jetty-coil", plane: "play", kind: "op.coil", x: CATCH_X + h(2.6), y: DECK_Y, p: { r: 13, hang: 10 }, frames: 1, reflect: false, seed: seed() });
  // (round 2: grouped into one corner round the crate, so it reads at play zoom: the net heaped
  // against the crate's west side and draped over the deck's edge, the creel between the crate
  // and the bucket)
  b.sprite({ id: "jetty-net", plane: "play", kind: "op.net", x: h(96.2), y: DECK_Y, p: { w: 38, h: 13, drape: 22 }, frames: 1, seed: seed() });
  b.sprite({ id: "jetty-basket", plane: "play", kind: "op.basket", x: h(97.12), y: DECK_Y, p: { h: 15 }, frames: 1, seed: seed() });
  b.prop({ id: "jetty-barrel", kind: "op.bucket", p: { h: 20 }, x: h(97.4), y: DECK_Y, cls: "cosmetic", material: "wood" });
  b.prop({ id: "jetty-crate", kind: "op.crate", p: { w: 30, h: 26 }, x: h(96.6), y: DECK_Y, cls: "cosmetic", material: "wood" });
  b.prop({ id: "jetty-jar", kind: "op.jar", p: { h: 20, glaze: "clay" }, x: h(96.6), y: DECK_Y - 26, cls: "cosmetic", material: "clay", on: "jetty-crate", pieces: 3 });
}

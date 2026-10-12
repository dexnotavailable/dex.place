// Kagami 鏡, Mirrorlake, and the Western Pass (GDK A.3). The head of て's top line: an
// alpine plateau lake so still it holds a second sky, a plank jetty along its whole
// length, the catch near the jetty's east end. West, past the lake, the pass and the road
// that bends away into the far mountains (the world's west end).
//
// Terrain grammar: massif. Solid rock to the world floor; the lake sits on it.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES, type PlaneId } from "../types.ts";
import { reedBeds, type BankP } from "../../art/library/opening/bank.ts";
import { CATCH_X, DECK_Y, JETTY_X0, JETTY_X1, LAKE_X0, LAKE_X1, LAKE_Y } from "./common.ts";

/** A drifting sprite on a background plane, placed by plane px (x, and dy above the lake line), wrapping over plane px. */
function drifting(b: WorldBuilder, id: string, plane: PlaneId, kind: string, planeX: number, planeDy: number, p: Record<string, unknown>, wrap: [number, number], drift: number, fps: number, frames = 4): void {
  const r = PLANES[plane].rate;
  b.sprite({ id, plane, kind, x: planeX / r, y: LAKE_Y + planeDy / r, p, frames, fps, path: [wrap[0] / r, wrap[1] / r], drift, reflect: true });
}

/** A background piece placed by its plane px (x) and standing on 3D y (the lake by default). */
export function bg(b: WorldBuilder, plane: PlaneId, planeX: number, kind: string, p: Record<string, unknown>, y3 = LAKE_Y, z = 0): void {
  b.piece(plane, kind, planeX / PLANES[plane].rate, y3, p, { z });
}

export function kagami(b: WorldBuilder): void {
  // --- the ground: the pass, the west shore, the plateau the lake lies on, the east lip
  // (art: env-opening). The lake rests on the plateau: under its surface the rock's top sits
  // just below the waterline, so the wide frames show the plateau's cliff below the near shore
  // (never a cross-section of water). The east face drops into Shiraito's valley mist.
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
  // collision: the pass and the west shore, then the jetty
  b.walk([h(0), h(59.2), h(5), h(59.0), h(9), h(58.6), h(14), h(58.5), h(19), h(59.0), h(25), h(59.9), h(31), h(60.9), h(36), h(61.6), h(40), h(62.1), h(44.1), h(62.25)],
    { surface: "grass", name: "kagami-west" });
  b.walk([JETTY_X0, DECK_Y, JETTY_X1, DECK_Y], { surface: "wood", depth: h(0.1), name: "jetty" });
  // the west end: the road bends away into the far mountains; she stops and turns back
  b.wall({ x: h(2.2), y0: h(50), y1: h(60), reason: "world-end", from: "right" });

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
  b.piece("play", "op.coil", CATCH_X + h(2.6), DECK_Y, { r: 12 }, { z: 4 });
  b.prop({ id: "jetty-barrel", kind: "op.bucket", p: { h: 20 }, x: h(97.4), y: DECK_Y, cls: "cosmetic", material: "wood" });
  b.prop({ id: "jetty-crate", kind: "crate", p: { w: 30, h: 26 }, x: h(96.6), y: DECK_Y, cls: "cosmetic", material: "wood" });
  b.prop({ id: "jetty-jar", kind: "jar", p: { h: 20, glaze: "clay" }, x: h(96.6), y: DECK_Y - 26, cls: "cosmetic", material: "clay", on: "jetty-crate", pieces: 3 });
  // the lake's near shore (P5; art: env-opening): the bank the surface ends against, low
  // hummocks, reed beds and sunk stones, rising into a rocky corner where the lake meets the lip
  const bankP: BankP = { w: Math.round(h(72) * PLANES.near.rate), h: 150, endR: 520, startR: 420, reeds: 0.55 };
  const bank = b.piece("near", "op.bank", h(38), LAKE_Y, bankP as unknown as Record<string, unknown>, { z: 1, reflect: false });
  // its reed beds sway in the wind (6 fps, a gust running through each bed)
  reedBeds(bankP, bank.seed).forEach(([x, w, hh], i) => {
    b.sprite({ id: `bank-reeds-${i}`, plane: "near", kind: "op.reeds", x: h(38) + x / PLANES.near.rate, y: LAKE_Y + 1 / PLANES.near.rate, p: { w, h: Math.round(hh) }, frames: 4, fps: 6, reflect: false });
  });

  // (near: the surface ends at the near plane's waterline, against the bank above)
  b.water({ y: LAKE_Y, x0: LAKE_X0, x1: LAKE_X1, fx0: h(-60), fx1: h(150), near: PLANES.near.rate, far: 0.06, kind: "lake" });
  // nothing under the lake's surface to walk on: a fall there tugs her back
  b.void({ x0: LAKE_X0, x1: LAKE_X1, y: LAKE_Y + h(0.5), y1: h(66) });

  b.spawn({ id: "catch", x: CATCH_X, y: DECK_Y, facing: 1 });
  b.spawn({ id: "western-pass", x: h(12), y: h(58.5), facing: 1 });
  b.place({ id: "kagami", name: "Kagami", x0: 0, x1: JETTY_X1, title: "place", spawn: "catch" });

  // --- the sky and the land beyond the lake (P0 to P3)
  b.atmos({
    x: 0,
    // the morning key (env-sky lane, ART-BIBLE section 3; composited in the opening)
    sky: ["#8fb6cf", "#d3e6e3", "#edf5ef"],
    haze: "#dce9e4",
    mist: 0.8,
    mistColour: "#f2f7f2",
    sun: [0.2, 0.11],
    water: { deep: "#235f60", body: "#4a9a90", shallow: "#c3e2d9", glint: "#fffbe8" },
  });
  // the sky (art: env-opening): one big morning cumulus on the right, the frame's big shape (the
  // top edge crops it at play zoom), a lower heap under the sun, strata lying over the far karst,
  // a high streak; all drifting east on the wind. The isles ride in front of the big cloud with a
  // slow bob. Sky plane y is px above the lake line (the sky barely moves, 0.02 of the camera).
  const skyWrap: [number, number] = [-1700, 2500];
  drifting(b, "sky-cumulus", "sky", "op.cloud", 760, -130, { kind: "cumulus", w: 760, h: 380 }, skyWrap, 1.2, 1);
  drifting(b, "sky-heap", "sky", "op.cloud", -280, -110, { kind: "cumulus", w: 360, h: 140 }, skyWrap, 1.6, 1);
  drifting(b, "sky-strata-0", "sky", "op.cloud", -120, -62, { kind: "stratus", w: 1100, h: 8, layers: 2 }, skyWrap, 3, 2);
  drifting(b, "sky-strata-1", "sky", "op.cloud", 560, -92, { kind: "stratus", w: 900, h: 7, layers: 2 }, skyWrap, 3.5, 2);
  drifting(b, "sky-high", "sky", "op.cloud", 300, -430, { kind: "stratus", w: 700, h: 5, layers: 1 }, skyWrap, 4, 2);
  // the two sky isles, Bell and Drum, above and right of the palace: seen from almost everywhere
  b.sprite({ id: "isle-bell", plane: "sky", kind: "op.isle", x: 560 / PLANES.sky.rate, y: LAKE_Y - 300 / PLANES.sky.rate, p: { w: 92, h: 120, tower: "bell" }, frames: 8, fps: 1, reflect: true });
  b.sprite({ id: "isle-drum", plane: "sky", kind: "op.isle", x: 700 / PLANES.sky.rate, y: LAKE_Y - 236 / PLANES.sky.rate, p: { w: 110, h: 96, tower: "drum" }, frames: 8, fps: 0.8, reflect: true });

  // every background plane has ground below its line, so the land never shows a gap; past the
  // lake's east shore that ground is a sea of mist (the valley and the land beyond the palace)
  // (the far plain's foot stops short of the harbour far below, so from Hoài Phố it never shows)
  bg(b, "far", -2600, "plain", { w: 9000, foot: 560, ramp: "range", amp: 4 }, LAKE_Y, -5);
  // (their tops sit just under the waterline: no line of land along the lake's far shores)
  bg(b, "mid", -4000, "plain", { w: 21000, foot: 560, ramp: "pine", amp: 0 }, LAKE_Y + 6, -5);
  bg(b, "back", -6000, "plain", { w: 40000, foot: 520, ramp: "pine", amp: 0 }, LAKE_Y + 6, -5);
  bg(b, "mid", 2900, "op.sea", { w: 9000, depth: 600, swell: 10, ends: 60 }, LAKE_Y, -4);
  bg(b, "back", 6300, "op.sea", { w: 4200, depth: 1400, swell: 16, ends: 80 }, LAKE_Y, -4);

  // P1: far karst rows rising out of layered mist, ghostly at this distance (art: env-opening)
  bg(b, "far", -900, "op.karst", { w: 1700, h: 230, rows: 3, look: "far", mist: 44, green: 0.7 }, LAKE_Y, 1);
  bg(b, "far", 900, "op.karst", { w: 1800, h: 250, rows: 3, look: "far", mist: 48, green: 0.7 }, LAKE_Y, 2);
  const farWrap: [number, number] = [-900, 2400];
  ([[-200, -34, 520, 22], [520, -52, 420, 18], [1150, -30, 600, 24]] as const).forEach(([x, dy, w, th], i) =>
    drifting(b, `far-wisp-${i}`, "far", "sky.wisp", x, dy, { w, h: th, density: 0.65 }, farWrap, 5, 3));

  // P2: karst standing in the lake, composed for the frames that see it: a far west group, a
  // falls massif left of the catch, a low island behind her, a great massif with falls cut by
  // the right edge of the close shot, and past the lake the pillar forest beyond the palace
  // rising from the sea of mist
  const P2: [number, [number, number, number, "pillar" | "cone" | "massif"][]][] = [
    [700, [[0, 150, 170, "cone"], [110, 50, 210, "pillar"], [170, 90, 120, "cone"], [-90, 40, 140, "pillar"]]],
    [1450, [[0, 46, 230, "pillar"], [50, 40, 160, "pillar"], [-40, 70, 90, "cone"]]],
    [2000, [[0, 300, 240, "massif"], [-170, 60, 150, "pillar"], [190, 110, 110, "cone"]]],
    [2560, [[0, 150, 80, "cone"], [70, 40, 120, "pillar"]]],
    [3230, [[0, 420, 330, "massif"], [-250, 70, 200, "pillar"], [260, 150, 170, "cone"]]],
    [3900, [[0, 60, 300, "pillar"], [90, 50, 240, "pillar"], [170, 70, 340, "pillar"], [260, 40, 200, "pillar"]]],
    [4500, [[0, 80, 380, "pillar"], [110, 50, 260, "pillar"], [-90, 60, 220, "pillar"], [200, 90, 300, "massif"]]],
    [5150, [[0, 60, 320, "pillar"], [100, 70, 260, "pillar"], [200, 50, 200, "pillar"]]],
  ];
  P2.forEach(([x, forms], i) => bg(b, "mid", x, "op.karst", { w: 0, h: 380, rows: 1, look: "near", forms, mist: 34, green: 0.85, falls: 0.6 }, LAKE_Y, i));
  bg(b, "mid", 3500, "op.karst", { w: 2200, h: 300, rows: 2, look: "mid", mist: 40, green: 0.8 }, LAKE_Y, -1);
  const midWrap: [number, number] = [-400, 5400];
  ([[600, -24, 520, 26], [1900, -40, 460, 22], [3300, -22, 640, 30]] as const).forEach(([x, dy, w, th], i) =>
    drifting(b, `mid-wisp-${i}`, "mid", "sky.wisp", x, dy, { w, h: th, density: 0.6 }, midWrap, 7, 3));

  // The Walker lane's giant, rendered from its rig (art/walker/tools/blender/render_walker.py)
  // in its retimed wade (Dex: several hundred metres tall, slow and heavy): one cycle in 20 s,
  // 48 frames (2.4 a second), 560 px tall at play zoom on P2 with a half-size set for the wide
  // frames. It moves only when its frame changes, 3.82 plane px a frame (the render's ground
  // speed), so its planted feet stay planted: 9.18 plane px/s, 32.8 3D px/s on P2.
  b.sprite({
    id: "walker-kagami", plane: "mid", kind: "frames", x: h(84), y: LAKE_Y + h(0.6),
    p: { sets: [{ level: 1, base: "/tesu/walker/wade-560/" }, { level: 0.5, base: "/tesu/walker/wade-280/" }] },
    frames: 48, fps: 2.4, path: [h(70), h(140)], speed: 32.8, stepMove: true,
  });

  // P3: islets in the middle distance of the lake, so the mirror stays open: old pilings, a
  // pine and a lantern, reeds, a tree with a leaning pine, a small torii in the shallows (kept
  // clear of where she stands at the catch)
  bg(b, "back", 3500, "op.islet", { w: 0, h: 0, on: ["posts", "reeds"] }, LAKE_Y, 0);
  bg(b, "back", 4200, "op.islet", { w: 70, h: 18, on: ["pine", "lantern", "reeds"], at: 0.2 }, LAKE_Y, 1);
  bg(b, "back", 4760, "op.islet", { w: 0, h: 0, on: ["reeds"] }, LAKE_Y, 2);
  bg(b, "back", 5350, "op.islet", { w: 110, h: 26, on: ["tree", "pine", "posts"], at: -0.5 }, LAKE_Y, 3);
  bg(b, "back", 6300, "op.islet", { w: 46, h: 12, on: ["torii", "reeds"], at: -0.3 }, LAKE_Y, 4);
}

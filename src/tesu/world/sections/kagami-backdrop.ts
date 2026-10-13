// Kagami's sky, light and distance (art: the Kagami art loop, painter p1): the morning key and
// the lake's water colours, the clouds and the sky isles (P0), the ground and the seas of mist
// under the background planes, the far karst (P1) and the karst standing in the lake (P2), and
// the drifting wisps between them.

import type { WorldBuilder } from "../build.ts";
import { LAKE_Y } from "./common.ts";
import { PLANES } from "../types.ts";
import { bg, drifting } from "./kagami-place.ts";

/** The light, the sky and P1 to P2 (seed block 4). */
export function kagamiBackdrop(b: WorldBuilder): void {
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
  // (from about 370 H, behind the palace at the widest frame's edge, it thins away into the
  // mist: Shanshui's East Pavilion stands over a sea of mist, not the lake's far shore)
  bg(b, "mid", -4000, "plain", { w: 15300, foot: 560, ramp: "pine", amp: 0, fadeEnd: 1350 }, LAKE_Y + 6, -5);
  // (past the court's tip it thins away into the mist, gone by about 210 H, behind the palace in
  // the opening's widest frame: beyond, Shanshui's pillar forest stands in a sea of mist, with no
  // ground at the lake's height)
  bg(b, "back", -6000, "plain", { w: 18500, foot: 520, ramp: "pine", amp: 0, fadeEnd: 1500 }, LAKE_Y + 6, -5);
  // (the mid sea runs on to the land's east end: Shanshui's forest and pavilion stand in it)
  bg(b, "mid", 2900, "op.sea", { w: 11000, depth: 600, swell: 10, ends: 60 }, LAKE_Y, -4);
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
}

/** Kagami's sprites that follow the Walker (its wake, rings, wet shins, torn mist): none yet (seed block 7). */
export function kagamiWade(_b: WorldBuilder): void {}

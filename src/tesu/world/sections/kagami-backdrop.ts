// Kagami's sky, light and distance (art: the Kagami art loop, painter p1): the morning key and
// the lake's water colours, the clouds and the sky isles (P0), the ground and the seas of mist
// under the background planes, the far karst (P1) and the karst standing in the lake (P2), and
// the drifting wisps between them; and what follows the wading Walker on the water.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { LAKE_Y } from "./common.ts";
import { PLANES } from "../types.ts";
import { WALKER, bg, drifting, seedAt, seedNow } from "./kagami-place.ts";
import { wadeSprites } from "../../art/library/opening/wade.ts";

/** An explicit seed for a piece or sprite this file adds (painter p1's range: n from 1000). */
const seed1 = (n: number): number => 7919 * (1000 + n);

/**
 * The lake's extent at a plane's waterline, plane px [x0, x1]: the lake (kagami.ts, the builder's)
 * runs from 40 to 109 H at the near plane and from -60 to 150 H at depth 0.06, widening with
 * depth as the lake shader draws it. Where a background piece's foot lies on it, its mist takes
 * the water's tone.
 */
function lakeAt(rate: number): [number, number] {
  const near = PLANES.near.rate, far = 0.06;
  const u = (1 / rate - 1 / near) / (1 / far - 1 / near);
  return [(h(40) + (h(-60) - h(40)) * u) * rate, (h(109) + (h(150) - h(109)) * u) * rate];
}
const local = (r: [number, number], x: number): [number, number] => [r[0] - x, r[1] - x];

/** The morning key the rest of the world keeps (Kagami's own, below, is a glassier lake). */
const MORNING = {
  sky: ["#8fb6cf", "#d3e6e3", "#edf5ef"] as [string, string, string],
  haze: "#dce9e4",
  mistColour: "#f2f7f2",
  sun: [0.2, 0.11] as [number, number],
};

/** The light, the sky and P1 to P2 (seed block 4). */
export function kagamiBackdrop(b: WorldBuilder): void {
  // --- the sky and the land beyond the lake (P0 to P3)
  // the world's morning key (env-sky lane, ART-BIBLE section 3; composited in the opening), as it
  // was: every place without a key of its own keeps it (Hoài Phố's harbour far below included)
  b.atmos({ x: 0, ...MORNING, mist: 0.8, water: { deep: "#235f60", body: "#4a9a90", shallow: "#c3e2d9", glint: "#fffbe8" } });
  // Kagami's own (the lake and the pass, above Shiraito and Hoài Phố):
  // - the shader's mist bands at the far and middle waterlines only veil: the mist's shape is
  //   painted (the karst's banks, the seas, the wisps), never a ruled band across the frame;
  // - a mirror: pale and haze-tinted toward the far shore, deep jade in front, what it mirrors a
  //   step darker and greener than the thing itself (reference 4's glass);
  // - glint is a stand-in until engine ask E2: the shader still scatters sun glints and ripple
  //   gaps over the whole lake, so they are toned to the middle of the lake's own value, where
  //   they barely read; E2 keeps glints only in a sun path near the far shore.
  b.atmos({ x: 0, y1: h(90), blend: h(4), ...MORNING, mist: 0.38, water: { deep: "#1d5558", body: "#4a958c", shallow: "#c6e4dc", glint: "#7fb0ae", mirror: [0.58, 0.76, 0.75] } });
  // (past the lake's east end the world's morning again: Gate Road and on)
  b.atmos({ x: h(111), blend: h(4), ...MORNING, mist: 0.8, water: { deep: "#235f60", body: "#4a9a90", shallow: "#c3e2d9", glint: "#fffbe8" } });

  // the sky (art: env-opening, re-dressed): one big morning cumulus holding the sky's middle
  // (where the postcard writes TESU; the top edge crops its base at play zoom), a low heap
  // keeping the sun company, two torn strata lying over the far karst; all drifting east on the
  // wind. The isles ride in front of the big cloud's right flank with a slow bob. Sky plane y is
  // px above the lake line (the sky barely moves, 0.02 of the camera).
  const skyWrap: [number, number] = [-1700, 2500];
  // (the big one does not reflect: the sky mirrors about the horizon, so its flat base would lie
  // across the middle of the lake, behind her at the catch, as a ruled line)
  const rs = PLANES.sky.rate;
  b.sprite({ id: "sky-cumulus", plane: "sky", kind: "op.cloud", x: 250 / rs, y: LAKE_Y - 205 / rs, p: { kind: "cumulus", w: 840, h: 330 }, frames: 4, fps: 1, path: [skyWrap[0] / rs, skyWrap[1] / rs], drift: 1.2, reflect: false });
  drifting(b, "sky-heap", "sky", "op.cloud", -380, -96, { kind: "cumulus", w: 330, h: 112, low: true }, skyWrap, 1.6, 1);
  drifting(b, "sky-strata-0", "sky", "op.cloud", -170, -46, { kind: "stratus", w: 760, h: 22, layers: 2 }, skyWrap, 3, 2);
  drifting(b, "sky-strata-1", "sky", "op.cloud", 620, -70, { kind: "stratus", w: 640, h: 18, layers: 2 }, skyWrap, 3.5, 2);
  // (the high streak read as a contrail or a ruled line across the sky: gone; its seed is kept)
  seedAt(b, seedNow(b) + 1);
  // a high, thin field of cloud above it all, combed out by the wind: patches of fibres a step
  // or two off the sky, so the upper sky has quiet texture (the postcard), drifting with the strata
  ([[-450, -500, 900, 170, 0.45], [650, -560, 1000, 150, 0.5], [1550, -470, 760, 140, 0.4]] as const).forEach(([x, dy, w, hh, dn], i) =>
    drifting(b, `sky-field-${i}`, "sky", "op.cloud", x, dy, { kind: "field", w, h: hh, density: dn, strands: 2 + i }, skyWrap, 3.2 + i * 0.3, 1, 4, seed1(4 + i)));
  // the two sky isles, Bell and Drum, above and right of the palace: seen from almost everywhere
  // (no reflection: the lake mirrors the sky about the horizon, not the waterline the frames
  // show, so their doubles hung under the mist as a second pair of isles)
  b.sprite({ id: "isle-bell", plane: "sky", kind: "op.isle", x: 560 / PLANES.sky.rate, y: LAKE_Y - 300 / PLANES.sky.rate, p: { w: 92, h: 120, tower: "bell" }, frames: 8, fps: 1, reflect: false });
  b.sprite({ id: "isle-drum", plane: "sky", kind: "op.isle", x: 700 / PLANES.sky.rate, y: LAKE_Y - 236 / PLANES.sky.rate, p: { w: 110, h: 96, tower: "drum" }, frames: 8, fps: 0.8, reflect: false });

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

  // P2: karst standing in the lake, composed for the frames that see it: a far west group, a
  // falls massif left of the catch, a low island left of her (its reflection clear of her head
  // at the catch), a great massif with falls cut by the right edge of the close shot, and past
  // the lake the pillar forest beyond the palace rising from the sea of mist
  const P2: [number, [number, number, number, "pillar" | "cone" | "massif"][]][] = [
    [700, [[0, 150, 170, "cone"], [110, 50, 210, "pillar"], [170, 90, 120, "cone"], [-90, 40, 140, "pillar"]]],
    [1450, [[0, 46, 230, "pillar"], [50, 40, 160, "pillar"], [-40, 70, 90, "cone"]]],
    [2000, [[0, 300, 240, "massif"], [-170, 60, 150, "pillar"], [190, 110, 110, "cone"]]],
    [2450, [[0, 150, 80, "cone"], [70, 40, 120, "pillar"]]],
    [3230, [[0, 420, 330, "massif"], [-250, 70, 200, "pillar"], [260, 150, 170, "cone"]]],
    [3900, [[0, 60, 300, "pillar"], [90, 50, 240, "pillar"], [170, 70, 340, "pillar"], [260, 40, 200, "pillar"]]],
    [4500, [[0, 80, 380, "pillar"], [110, 50, 260, "pillar"], [-90, 60, 220, "pillar"], [200, 90, 300, "massif"]]],
    [5150, [[0, 60, 320, "pillar"], [100, 70, 260, "pillar"], [200, 50, 200, "pillar"]]],
  ];

  // the seas of mist (the mid one runs on to the land's east end: Shanshui's forest and pavilion
  // stand in it; it climbs the feet of the karst standing in it, and its west end sinks into the
  // lake in torn wisps). The back one's bank starts behind Shiraito's wall, east of the lake's
  // shore at its depth, so it never stands on the lake as a plate behind the islet torii; its
  // floor still runs from 6300 (Gate Road's arch looks down on it).
  const MID_SEA = 2900;
  const rise: [number, number, number][] = [];
  for (const [x, forms] of P2) for (const [dx, w, hh] of forms) if (x + dx > MID_SEA - 200) rise.push([x + dx - MID_SEA, w / 2, hh]);
  // (past the lake's east shore at its depth it is low mist on water first: no white plate)
  const MID_LAKE = lakeAt(PLANES.mid.rate), FAR_LAKE = lakeAt(PLANES.far.rate);
  // (past its ends at this depth the lake runs on under the low mist for a while: the karst
  // standing there stand in water too, with wet feet)
  const MID_WET: [number, number] = [MID_LAKE[0] - 200, MID_LAKE[1] + 200];
  bg(b, "mid", MID_SEA, "op.sea", { w: 11000, depth: 600, swell: 10, ends: 60, west: 260, rise, torn: 0.55, wetFloor: 70, wetTo: Math.round(MID_LAKE[1] - MID_SEA) }, LAKE_Y, -4);
  // past the lake's west end at this depth the mid plain's flat top would show between the lake
  // and the west shore: the lake runs on west under its low mist instead, ever more torn by it
  bg(b, "mid", 0, "op.sea", { w: 900, depth: 160, swell: 10, ends: 60, floorWest: 0, wetFloor: 70, wetFrom: Math.round(MID_LAKE[0]), veilTo: 380, bank: false }, LAKE_Y, -4, seed1(3));
  bg(b, "back", 6300, "op.sea", { w: 4200, depth: 1400, swell: 16, ends: 80, west: 160, torn: 0.3, bankFrom: 330, floorWest: 0 }, LAKE_Y, -4);
  // spray blooming where Shiraito's first veil reaches the lake at the wall's foot (P3; the wall
  // itself is Gate Road's piece, from back x 6577; that veil falls at about 6595 to 6645)
  bg(b, "back", 6560, "op.spray", { w: 120, h: 44, at: [[62, 24]] }, LAKE_Y, 3, seed1(2));

  // P1: far karst rising out of layered mist, ghostly at this distance (art: env-opening), in
  // three clusters with wide gaps of mist between them; the farthest row all but erased by haze
  bg(b, "far", -900, "op.karst", { w: 1700, h: 230, rows: 3, look: "far", mist: 44, green: 0.7, groups: [[340, 760], [1230, 1660]], haze: 0.7, wet: local(FAR_LAKE, -900) }, LAKE_Y, 1);
  bg(b, "far", 900, "op.karst", { w: 1800, h: 250, rows: 3, look: "far", mist: 48, green: 0.7, groups: [[340, 820], [1150, 1600]], haze: 0.7, wet: local(FAR_LAKE, 900) }, LAKE_Y, 2);
  const farWrap: [number, number] = [-900, 2400];
  ([[-200, -34, 520, 22], [520, -52, 420, 18], [1150, -30, 600, 24]] as const).forEach(([x, dy, w, th], i) =>
    drifting(b, `far-wisp-${i}`, "far", "sky.wisp", x, dy, { w, h: th, density: 0.65 }, farWrap, 5, 3));

  // P2 (falls on the great faces are veils with a spray bloom where they reach the mist)
  const FALLS: Record<number, number[]> = { 2000: [0], 3230: [0, 1] };
  P2.forEach(([x, forms], i) => bg(b, "mid", x, "op.karst", { w: 0, h: 380, rows: 1, look: "near", forms, mist: 34, green: 0.85, falls: 0.6, veil: 4, wet: local(MID_WET, x), ...(FALLS[x] ? { fallOn: FALLS[x] } : {}) }, LAKE_Y, i));
  bg(b, "mid", 3500, "op.karst", { w: 2200, h: 300, rows: 2, look: "mid", mist: 40, green: 0.8, wet: local(MID_WET, 3500) }, LAKE_Y, -1);
  const midWrap: [number, number] = [-400, 5400];
  ([[600, -24, 520, 26], [1900, -40, 460, 22], [3300, -22, 640, 30]] as const).forEach(([x, dy, w, th], i) =>
    drifting(b, `mid-wisp-${i}`, "mid", "sky.wisp", x, dy, { w, h: th, density: 0.6 }, midWrap, 7, 3));
}

/**
 * What follows the Walker on the water (seed block 7, explicit seeds only): the water parting
 * round its legs, the wake, the rings born at each footfall, its wet shins and the mist torn
 * round them. Each sprite shares the Walker's x, y, path, speed, frames, fps and stepMove, so it
 * moves in lockstep with it and shows the same frame (its stride).
 */
export function kagamiWade(b: WorldBuilder): void {
  wadeSprites(b, WALKER, seed1);
}

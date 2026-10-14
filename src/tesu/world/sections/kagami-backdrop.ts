// Kagami's sky, light and distance (art: the Kagami art loop, painter p1): the morning key and
// the lake's water colours, the clouds and the sky isles (P0), the ground and the seas of mist
// under the background planes, the far karst (P1) and the karst standing in the lake (P2), and
// the drifting wisps between them; and what follows the wading Walker on the water.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { LAKE_Y } from "./common.ts";
import { PLANES, type FogLayer } from "../types.ts";
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

/**
 * Kagami's own sky (round 4): a clear zenith blue deepening overhead, a pale warm haze at the
 * horizon, the low band under it; the sun's bloom warm cream round the one sun at (0.2, 0.11).
 */
const KAGAMI_SKY: [string, string, string] = ["#79a8cf", "#d7e7e1", "#eef4ed"];
const KAGAMI_GLOW = { radius: 0.26, strength: 0.5, colour: "#fff1d8" };

/**
 * Fog banks lying on the water (round 4): thickest and highest far off, where they wrap the far
 * karst's feet, thinner and lower on each nearer plane, none in front of the play plane. Each is
 * drawn after its plane and in the lake's mirror.
 *
 * Round 5 (the critic's S4: "full-width stacked bands"): each lies in POOLS, thick at the feet of
 * the karst on its plane, torn at the ends, with only scattered patches over the open water
 * between (`cover`), so the lake mirrors crisply in the gaps (reference 4's mist pools at the bases
 * and leaves the open lake clear below it). The nearest bank (P3) is no longer a ribbon across the
 * lake at the islets' waterline: a few low pools at the feet of the islets only. The far bank no
 * longer lies solid round the Walker's legs (its own haze thickens down them, kagami-place.ts).
 */
const FAR_POOLS: [number, number, number][] = [
  // the far karst's clusters (P1 pieces at -900 and 900, their groups), the thickest at the feet
  // of the biggest, and a thin veil where the Walker wades among them
  [-470, 150, 1.15], [-220, 90, 0.8], [470, 120, 0.9], [700, 110, 1.1], [1390, 170, 1.2], [1640, 90, 0.85], [2180, 160, 1.1], [2420, 90, 0.8],
];
const MID_POOLS: [number, number, number][] = [
  // the karst standing in the lake (P2 below): pools at their feet, their size by the karst's
  [700, 120, 0.95], [1450, 60, 0.75], [1820, 190, 1.1], [2930, 100, 0.85], [3230, 260, 1.2], [4020, 150, 1], [4520, 160, 1], [5250, 130, 0.9],
];
const BACK_POOLS: [number, number, number][] = [
  // low, at a few islets' feet only (the crag, the reed bed, the stubs by the torii)
  [3560, 70, 0.7], [5330, 70, 0.9], [5560, 40, 0.6],
];
const KAGAMI_FOG: FogLayer[] = [
  { plane: "sky", density: 0.42, height: 60, apron: 0, roll: 0.5, size: 520, drift: 0.4, colour: "#e2ece7", cover: 0.8 },
  { plane: "far", density: 0.82, height: 80, apron: 22, roll: 0.75, size: 260, drift: 1, colour: "#e6eeea", pools: FAR_POOLS, cover: 0.4 },
  { plane: "mid", density: 0.72, height: 60, apron: 26, roll: 0.8, size: 190, drift: 1.8, colour: "#ecf2ee", pools: MID_POOLS, cover: 0.22 },
  { plane: "back", density: 0.42, height: 18, apron: 16, roll: 0.85, size: 120, drift: 2.4, colour: "#f0f5f1", pools: BACK_POOLS, cover: 0 },
];

/**
 * (round 5, S5) Kagami's own haze on the mid plane: the karst standing in the lake keep their dark
 * greens and crevices (the standard 0.4 left the upper half of the play frames one pale mint
 * field), so far (pale, in the fog), mid (mid values with darks) and near (darkest) read apart.
 */
const KAGAMI_FADES = { mid: 0.16 };

/** The light, the sky and P1 to P2 (seed block 4). */
export function kagamiBackdrop(b: WorldBuilder): void {
  // --- the sky and the land beyond the lake (P0 to P3)
  // the world's morning key (env-sky lane, ART-BIBLE section 3; composited in the opening), as it
  // was: every place without a key of its own keeps it (Hoài Phố's harbour far below included)
  b.atmos({ x: 0, ...MORNING, mist: 0.8, water: { deep: "#235f60", body: "#4a9a90", shallow: "#c3e2d9", glint: "#fffbe8" } });
  // Kagami's own (the lake and the pass, above Shiraito and Hoài Phố):
  // - no shader mist bands (mist 0): their stepped alpha dithered a 1 px screen door over the
  //   karst's feet and the Walker's legs; the mist's shape and its value lift are painted (the
  //   karst's banks, the seas, the wisps, the lobes round the legs);
  // - a mirror: what it mirrors a step darker and greener than the thing itself (reference 4's
  //   glass), the mirror tint fixed (p2's and p3's painted reflections match it);
  // - deep and body within a step of the sky the near water mirrors, so the shader's ripple gaps
  //   (which show the water's own colour) stop reading as dark dashes now that the lake runs to
  //   the frame's bottom edge (E6); glint a step above that reflection, so its cells no longer
  //   stand as pale columns. E2 (no gap term, glints only in a sun path) is still the cure.
  // - (round 4, the sky lane) the sky deepens to a clear zenith over a pale, warm horizon in
  //   flat bands, the sun blooms in stepped warm rings, and fog lies on the water at every
  //   background plane's waterline, thicker with distance (depth by rendering)
  b.atmos({ x: 0, y1: h(90), blend: h(4), ...MORNING, sky: KAGAMI_SKY, mist: 0, water: { deep: "#528995", body: "#76a6a6", shallow: "#c6e4dc", glint: "#6a9fa4", mirror: [0.58, 0.76, 0.75] }, glow: KAGAMI_GLOW, fog: KAGAMI_FOG, fades: KAGAMI_FADES });
  // (past the lake's east end the world's morning again: Gate Road and on; round 5: the same sun
  // as the lake's, its small bright core and bloom, over the morning's own sky gradient)
  b.atmos({ x: h(111), blend: h(4), ...MORNING, mist: 0.8, water: { deep: "#235f60", body: "#4a9a90", shallow: "#c3e2d9", glint: "#fffbe8" }, glow: { ...KAGAMI_GLOW, plain: true } });

  // the sky (round 4, the sky lane): ONE cloud family (Dex: never four kinds), every cloud a heap of
  // billows lit by the one sun, varied in size and how much it towers: the great cumulus holding
  // the postcard's sky (above every play frame's top edge), middling and small heaps across the
  // play frames' sky (the one beside the sun lit full on its flank), and decks of small flattened
  // heaps lying low over the far karst (the stratocumulus under the big clouds in Dex's
  // reference), hazier with distance. All drift east on the wind. Sky plane y is px above the lake
  // line (the sky barely moves, 0.02 of the camera; the play frames see dy 0 to -312, the
  // postcard to about -715).
  const skyWrap: [number, number] = [-1700, 2500];
  const rs = PLANES.sky.rate;
  // (the big one does not reflect: the sky mirrors about the horizon, so its flat base would lie
  // across the bottom of the postcard's lake as a ruled line)
  // (round 5: 130 px west and 15 higher, so the Bell isle's pagoda hangs clear of its base in the
  // postcard)
  b.sprite({ id: "sky-cumulus", plane: "sky", kind: "op.cloud", x: 120 / rs, y: LAKE_Y - 345 / rs, p: { kind: "cumulus", w: 760, h: 345, tower: 0.9 }, frames: 4, fps: 1, path: [skyWrap[0] / rs, skyWrap[1] / rs], drift: 1.2, reflect: false, seed: seed1(301) });
  // (round 5, the critic's S9: the small clouds were one member of the family repeated, a domed
  // lens at one size sprinkled at even gaps. Now three groups of different members with clear
  // sky between them: by the sun a heap with a torn wisp trailing downwind; low over the far
  // karst a broken stratocumulus deck; top right a tall tower with a small heap breaking off it)
  ([
    // [id, x, dy, params, drift, seed]
    // (the heap keeping the sun company, low under it and left, its tower in the sun's full light)
    // (high enough that no karst crown in the play frames meets its base, the sun clear of it)
    ["sky-heap", -690, -138, { kind: "cumulus", w: 300, h: 118, tower: 0.75, haze: 0.15 }, 1.6, 31],
    // (torn off it downwind, a little higher: thin strands with clear air between them)
    ["sky-wisp-a", -540, -262, { kind: "wisp", w: 280, h: 22, haze: 0.2 }, 1.9, 37],
    // (top right: a tall tower, cut by the frame's top edge in the play frames, and a small heap
    // breaking off it downwind)
    ["sky-heap-e", 1000, -168, { kind: "tower", w: 150, h: 170, tower: 1 }, 1.4, 32],
    ["sky-heap-e2", 1125, -214, { kind: "cumulus", w: 110, h: 40, tower: 0.4 }, 1.4, 36],
    // (low over the far karst: a broken deck of small flattened heaps in the haze, the
    // stratocumulus under the big clouds in Dex's reference)
    // (its heaps' tops clear of the far karst and their haze, so it reads as one broken band)
    ["sky-low-1", 470, -102, { kind: "deck", w: 620, h: 58, heaps: 5, haze: 0.38 }, 2.2, 35],
  ] as const).forEach(([id, x, dy, p, dr, n]) => drifting(b, id, "sky", "op.cloud", x, dy, { ...p }, skyWrap, dr, 1, 4, seed1(n)));
  // a lone heap high in the postcard's left sky, above every play frame's top edge (no
  // reflection: the play frames' lake would show the double of a cloud they cannot see)
  b.sprite({ id: "sky-heap-w", plane: "sky", kind: "op.cloud", x: -560 / rs, y: LAKE_Y - 340 / rs, p: { kind: "cumulus", w: 190, h: 72, tower: 0.45 }, frames: 4, fps: 1, path: [skyWrap[0] / rs, skyWrap[1] / rs], drift: 1.8, reflect: false, seed: seed1(33) });
  // (seed1(34) was a low heap, dropped)
  // (the old pieces' seeds are kept: the cumulus, the heap and the two strata used the block's
  // counter, then the high streak's)
  seedAt(b, seedNow(b) + 5);
  // the two sky isles, Bell and Drum, above and right of the palace: seen from almost everywhere
  // (no reflection: the lake mirrors the sky about the horizon, not the waterline the frames
  // show, so their doubles hung under the mist as a second pair of isles)
  // (round 4 integration: Drum 130 px east and 20 higher, so in play-catch and the pull-back it
  // floats clear of the great massif's crown instead of standing on it as a pagoda on the summit)
  b.sprite({ id: "isle-bell", plane: "sky", kind: "op.isle", x: 560 / PLANES.sky.rate, y: LAKE_Y - 300 / PLANES.sky.rate, p: { w: 92, h: 120, tower: "bell" }, frames: 8, fps: 1, reflect: false });
  b.sprite({ id: "isle-drum", plane: "sky", kind: "op.isle", x: 830 / PLANES.sky.rate, y: LAKE_Y - 256 / PLANES.sky.rate, p: { w: 110, h: 96, tower: "drum" }, frames: 8, fps: 0.8, reflect: false });

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
    // (round 5: the small cone lower, its crown met the far Walker's feet in play-west)
    [1450, [[0, 46, 230, "pillar"], [50, 40, 160, "pillar"], [-40, 70, 50, "cone"]]],
    // (round 4: 120 px further west than before, so the far Walker wades clear of its flank in
    // the key view; still the catch's left frame. Round 5: its small right cone dropped, its crown
    // landed at the far Walker's feet in play-walker)
    [1880, [[0, 300, 240, "massif"], [-170, 60, 150, "pillar"]]],
    // (round 5: the low cone and pillar from 2450 to the great massif's left foot, out from under
    // the far Walker's legs in the catch, the pull-back and the play frames)
    [2900, [[0, 150, 80, "cone"], [70, 40, 120, "pillar"]]],
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
  const MID_WET: [number, number] = [MID_LAKE[0] - 200, MID_LAKE[1] + 480];
  bg(b, "mid", MID_SEA, "op.sea", { w: 11000, depth: 600, swell: 10, ends: 60, west: 260, rise, torn: 0.55, wetFloor: 70, wetTo: Math.round(MID_LAKE[1] - MID_SEA), veilTo: 480 }, LAKE_Y, -4);
  // past the lake's west end at this depth the mid plain's flat top would show between the lake
  // and the west shore: the lake runs on west under its low mist instead, ever more torn by it
  bg(b, "mid", 0, "op.sea", { w: 900, depth: 160, swell: 10, ends: 60, floorWest: 0, wetFloor: 70, wetFrom: Math.round(MID_LAKE[0]), veilTo: 380, bank: false }, LAKE_Y, -4, seed1(3));
  bg(b, "back", 6300, "op.sea", { w: 4200, depth: 1400, swell: 16, ends: 80, west: 160, torn: 0.3, bankFrom: 330, floorWest: 0 }, LAKE_Y, -4);
  // spray blooming where Shiraito's first veil reaches the lake at the wall's foot (P3; the wall
  // itself is Gate Road's piece, from back x 6577; that veil falls at about 6595 to 6645)
  // (with the wet foot of the wall's west end, which stands in the lake at this depth: fallen
  // chunks heaped there, foam lapping between them, and below the waterline a talus of them
  // where the lake ends against the foot, so the lake ends on rock and white water)
  bg(b, "back", 6560, "op.spray", { w: 120, h: 84, at: [[30, 15], [62, 26], [98, 17]], foot: [-3, 66], chunks: [6, 78] }, LAKE_Y, 3, seed1(2));

  // P1: far karst rising out of layered mist, ghostly at this distance (art: env-opening), in
  // three clusters with wide gaps of mist between them; the farthest row all but erased by haze
  // (round 5 integration: no thread falls this far out: a cluster lead now stands right behind the
  // re-layered Walker, and its fall ruled a bright 1 px line beside the giant's haunch)
  bg(b, "far", -900, "op.karst", { w: 1700, h: 230, rows: 3, look: "far", mist: 30, green: 0.7, falls: 0, groups: [[340, 760], [1230, 1660]], haze: 0.7, wet: local(FAR_LAKE, -900) }, LAKE_Y, 1);
  bg(b, "far", 900, "op.karst", { w: 1800, h: 250, rows: 3, look: "far", mist: 32, green: 0.7, falls: 0, groups: [[340, 820], [1150, 1600]], haze: 0.7, wet: local(FAR_LAKE, 900) }, LAKE_Y, 2);
  const farWrap: [number, number] = [-900, 2400];
  // (the far wisps, thin streaks of mist, gave way to the fog banks lying on the water; their
  // seeds are kept)
  seedAt(b, seedNow(b) + 3);
  // the low cloud deck far out over the lake, at the far karst's waists and the Walker's chest
  // (it wades through real weather, the sky's own cloud family, not a clump wrapped round it):
  // broken heaps of flattened cumulus at one height, drifting east; this layer stands behind
  // the Walker (kagamiWade lays the one in front of it)
  FAR_BEHIND.forEach(([id, x, dy, p, n]) => farCloud(b, id, x, dy, p, n));

  // P2 (falls on the great faces are veils with a spray bloom where they reach the mist)
  const FALLS: Record<number, number[]> = { 1880: [0], 3230: [0, 1] };
  P2.forEach(([x, forms], i) => bg(b, "mid", x, "op.karst", { w: 0, h: 380, rows: 1, look: "near", forms, mist: 20, green: 0.85, falls: 0.6, veil: 4, wet: local(MID_WET, x), ...(FALLS[x] ? { fallOn: FALLS[x] } : {}) }, LAKE_Y, i));
  bg(b, "mid", 3500, "op.karst", { w: 2200, h: 300, rows: 2, look: "mid", mist: 40, green: 0.8, wet: local(MID_WET, 3500) }, LAKE_Y, -1);
  const midWrap: [number, number] = [-400, 5400];
  // egrets crossing in front of the great massif's crown, and far specks of birds over the far
  // karst (reference 4's birds over its right massif): drifting east, their wings beating
  drifting(b, "egrets", "mid", "op.birds", 3090, -255, { n: 5, w: 170, h: 70, kind: "egret", size: 6 }, midWrap, 9, 10, 10, seed1(10));
  drifting(b, "egrets-pair", "mid", "op.birds", 2860, -150, { n: 2, w: 40, h: 16, kind: "egret", size: 5 }, midWrap, 8, 10, 10, seed1(11));
  drifting(b, "far-birds", "far", "op.birds", 1100, -140, { n: 5, w: 150, h: 50, kind: "speck", size: 2 }, farWrap, 3, 8, 10, seed1(12));
  // (the mid wisps too: the fog banks lie there now)
  seedAt(b, seedNow(b) + 3);
}

/**
 * What follows the Walker on the water (seed block 7, explicit seeds only): the water parting
 * round its legs, the wake, the rings born at each footfall, its wet shins and the mist torn
 * round them. Each sprite shares the Walker's x, y, path, speed, frames, fps and stepMove, so it
 * moves in lockstep with it and shows the same frame (its stride).
 */
export function kagamiWade(b: WorldBuilder): void {
  wadeSprites(b, WALKER, seed1);
  // (round 5, S1) torn wisps of the one cloud family passing in front of the giant at different
  // heights, hazed into its own air, its body showing between them; they drift at their own pace,
  // so over its walk they slide past it
  FAR_FRONT.forEach(([id, x, dy, p, n]) => farCloud(b, id, x, dy, p, n));
}

/**
 * The weather far out over the lake, on P1 with the far karst and the Walker (explicit seeds):
 * [id, far plane x, base above the lake line, params, seed]. The Walker wades from far x 540 in
 * the key frames (its legs from about 400 to 616, its back at about -200 to -280), east at 4.6
 * px a second; these drift east at 0.7.
 *
 * Round 5 (the critic's S1): the crisp lens across the Walker's chest (far-cloud-3) and the heap
 * behind its back (far-cloud-0) are gone. Round it now: one wisp low behind its hind legs (drawn
 * before it: seen between the legs), one low across its front legs and chest, one short one
 * high in front of its far haunch; further east a broken deck at the far karst's waists.
 */
const FAR_BEHIND: [string, number, number, Record<string, unknown>, number][] = [
  ["far-cloud-2", 1540, -164, { kind: "deck", w: 300, h: 40, heaps: 4, haze: 0.2 }, 42],
  ["walker-wisp-0", 470, -62, { kind: "wisp", w: 220, h: 22 }, 44],
];
const FAR_FRONT: [string, number, number, Record<string, unknown>, number][] = [
  ["walker-wisp-1", 600, -100, { kind: "wisp", w: 200, h: 26 }, 45],
  ["walker-wisp-2", 418, -178, { kind: "wisp", w: 110, h: 18 }, 46],
];

/** A cloud far out on P1, in the same air as the Walker (its lit tops hazed a step further than the giant, so they never outshine it; explicit seeds). */
function farCloud(b: WorldBuilder, id: string, x: number, dy: number, p: Record<string, unknown>, n: number): void {
  const r = PLANES.far.rate;
  b.sprite({ id, plane: "far", kind: "op.cloud", x: x / r, y: LAKE_Y + dy / r, p, frames: 4, fps: 1, path: [-900 / r, 2400 / r], drift: 0.7, reflect: true, fade: WALKER.fade + 0.14, seed: seed1(n) });
}

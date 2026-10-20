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
  // the far karst's clusters (round 6: op.farkarst, kagamiBackdrop's P1), the thickest at the feet
  // of the biggest; a thin pool where the Walker wades, between them
  [-420, 170, 1.15], [-190, 90, 0.85], [140, 120, 0.95], [560, 170, 1.0], [1400, 190, 1.2], [1660, 100, 0.85], [2180, 160, 1.1], [2420, 90, 0.8],
];
/**
 * (round 6, the critic's S7: "one level pale horizon band with a ruled lake edge") The haze lying
 * along the horizon BEHIND the far karst: it swells behind each cluster (their pools) and thins in
 * the gaps between them, so the horizon's height wanders along the frame, never one ruled band.
 */
const HORIZON_POOLS: [number, number, number][] = [
  [-380, 260, 1.2], [140, 170, 0.9], [1480, 300, 1.25], [2280, 240, 1.1],
];
/**
 * (round 6, the critic's S1; Dex: "the walker further back with the clouds", the clump of clouds
 * near him "executed poorly") The weather the far Walker wades through is the fog itself, not
 * cloud sprites stuck on him: veils of the far bank's own haze floating at different heights, each
 * its own shape, drifting east slower than he walks, so they slide across him over the walk
 * cycle. In the key frames he stands at far x 540 (his legs from about 400 to 620, his belly about
 * 140 above the line, his back 250): [x, half width, height, thickness, strength, tear, lit top].
 */
type Veil = [number, number, number, number, number, number, number, number];
const WALKER_VEILS: Veil[] = [
  // a long streamer across his legs, rising downwind, torn into rags at its ends, lit along its top
  [560, 230, 84, 9, 0.8, 0.6, 0.35, -0.07],
  // a ragged scrap at his front shoulder
  [668, 70, 178, 10, 0.72, 0.85, 0.45, 0.05],
  // a broad faint veil over his flank: the sky's own value, it shows only where it crosses him
  [450, 150, 140, 16, 0.4, 0.35, 0, 0.03],
];
/**
 * Behind him (drawn before the far plane, with the horizon's haze): a long bank of cloud at his
 * back's height, its two torn ends showing either side of him, so he stands IN the weather.
 */
const WALKER_BEHIND: Veil[] = [
  [520, 330, 214, 15, 0.82, 0.55, 0.62, -0.04],
];
const MID_POOLS: [number, number, number][] = [
  // the karst standing in the lake (P2 below): pools at their feet, their size by the karst's
  // (kagami9 r1, the critic's W1-9: "every far karst sits on a foam pillow on the same waterline")
  // no longer one pillow each: some feet deep in a bank, some nearly clear, wet and mirrored
  [700, 120, 1.2], [1230, 70, 0.35], [1820, 190, 1.05], [2930, 100, 0.3], [3230, 260, 1.25], [4020, 150, 0.5], [4520, 160, 1.1], [5250, 130, 0.45],
];
/**
 * (kagami9 r1, W1-9; reference 4's three depths of fog) Mist drifting over the open water between
 * the karst standing in the lake and the jetty: long, low, torn streamers at different heights on
 * the mid plane (between the karst) and the back plane (between the islets, nearer), each its own
 * length and slope, so the lake reads in depths of air, never one ruled band. [x, half width,
 * height, thickness, strength, tear, lit top, slope] (plane art px).
 */
const MID_VEILS: Veil[] = [
  [980, 230, 24, 22, 0.5, 0.55, 0.14, 0.02],
  [1560, 170, 44, 16, 0.38, 0.6, 0.1, -0.03],
  [2420, 300, 16, 26, 0.52, 0.5, 0.14, 0.01],
  [3050, 160, 36, 15, 0.36, 0.65, 0.1, 0.03],
  [3700, 260, 20, 24, 0.5, 0.55, 0.14, -0.01],
  [4720, 220, 28, 20, 0.44, 0.6, 0.12, 0.02],
];
const BACK_VEILS: Veil[] = [
  [2350, 260, 10, 16, 0.42, 0.55, 0.1, 0.01],
  [3350, 330, 7, 17, 0.38, 0.5, 0.1, 0],
  [4300, 240, 14, 14, 0.42, 0.6, 0.1, -0.02],
  [5150, 300, 8, 17, 0.38, 0.5, 0.1, 0.01],
];
const BACK_POOLS: [number, number, number][] = [
  // low, at a few islets' feet only (the crag, the reed bed, the stubs by the torii)
  [3560, 70, 0.7], [5330, 70, 0.9], [5560, 40, 0.6],
];
/**
 * (kagami9 r1, the critic's W1-3; reference 3's falls) Where Shiraito's first veil reaches the lake
 * at the wall's foot (back px about 6595 to 6645) the falls dissolves into churned white water and
 * spray rising at the fog's value: a tall pool of fog there, solid at its foot on the water and
 * rolling up the falls, and a ragged plume drifting off it.
 */
const FALLS_FOOT: FogLayer = {
  plane: "back", density: 0.8, height: 58, apron: 26, roll: 0.95, size: 64, drift: 1.4, colour: "#eef4f1",
  pools: [[6622, 44, 1.2], [6585, 22, 0.6]], cover: 0, foot: 0.42,
  veils: [[6652, 58, 46, 9, 0.5, 0.75, 0.6, 0.18], [6600, 40, 70, 7, 0.32, 0.85, 0.5, 0.1]],
};
const KAGAMI_FOG: FogLayer[] = [
  // (round 6: the sky's own low haze thinned to torn patches: the horizon's body lies behind the
  // far karst now, in pools)
  { plane: "sky", density: 0.32, height: 46, apron: 0, roll: 0.7, size: 520, drift: 0.4, colour: "#e2ece7", cover: 0.3 },
  { plane: "far", behind: true, density: 0.62, height: 92, apron: 0, roll: 0.85, size: 300, drift: 0.6, colour: "#e4ede9", pools: HORIZON_POOLS, cover: 0.1, veils: WALKER_BEHIND },
  { plane: "far", density: 0.82, height: 80, apron: 22, roll: 0.75, size: 260, drift: 1, colour: "#e6eeea", pools: FAR_POOLS, cover: 0.4, foot: 0.3, veils: WALKER_VEILS },
  // (round 6, S7: its foot lies solid on the water at the karst's feet and out over the line in
  // front, so the fog swallows where rock meets water)
  // (kagami9 r1, W1-9: its foot thinner and reaching further out over the water, each pool its own
  // strength, and veils drifting between the karst)
  { plane: "mid", density: 0.72, height: 60, apron: 52, roll: 0.8, size: 190, drift: 1.8, colour: "#ecf2ee", pools: MID_POOLS, cover: 0.22, foot: 0.2, veils: MID_VEILS },
  { plane: "back", density: 0.42, height: 18, apron: 16, roll: 0.85, size: 120, drift: 2.4, colour: "#f0f5f1", pools: BACK_POOLS, cover: 0, foot: 0.4, veils: BACK_VEILS },
  FALLS_FOOT,
];

/**
 * (round 5, S5) Kagami's own haze on the mid plane: the karst standing in the lake keep their dark
 * greens and crevices (the standard 0.4 left the upper half of the play frames one pale mint
 * field), so far (pale, in the fog), mid (mid values with darks) and near (darkest) read apart.
 */
const KAGAMI_FADES = { mid: 0.16 };

/**
 * (round 6, the critic's S8: "the lake's lower third is near-flat teal with a uniform sprinkle of
 * 1-2 px dashes"; reference 4's lower water is its richest area) The near water's look: darker
 * and cooler toward the camera, the mirror drawn down in soft streaks under what stands over the
 * water, a few long slow ripple bands (the ripples' gaps and glints only in them), and (S7) the
 * far edge melting into the haze. At the catch's 2x it all sits on 2 px cells.
 */
const KAGAMI_NEAR_WATER: [number, number, number, number] = [0.9, 0.7, 1, 1];

/**
 * (kagami9 round 1, worker 1) The lake's own look (atmos.ts WATER_FS):
 * - lip: the water runs on toward the camera past the near plane to a near shore wandering in depth
 *   (24 to 80, coves about 700 px long), so at the postcard's 0.5x and the descent it reaches the
 *   frame's bottom edge under the near bank instead of stopping on a ruled row over the cliff (the
 *   critic's W1-1 "tray"); at play zoom nothing changes (the shore lies far below the frame); from
 *   0.3x out the lake ends where it did (the plateau's own lip, lane V's op.rim, ends it there);
 *   its fourth number: the broken reflections of overhanging near foliage beyond the frame's top,
 *   dark crowns rising from the frame's bottom edge in the nearest water (W1-8, reference 4);
 * - sun: the one sun on the water, a glitter path under it and the far haze lifting toward it (W1-12);
 * - look: fine flat steps with dithered seams (no screen door over the far lake, W1-4), the mirror
 *   wavering up and down by up to 2 cells nearer the viewer (level edges in the mirror bend and
 *   break, W1-5), the gaps a land's painted underside leaves in its mirror filled from the land's
 *   own reflection (the seams in the station's and the talus's reflections, W1-5), and sparse broken
 *   ripple dashes of varied length, none in the far mirror (W1-4);
 * - edge: where the water meets land and haze: the hand-over from the scree's hold to the near
 *   limestone's wandering up to 64 px along the shore where the limestone stands past the frame's
 *   right edge, the water running in under the rock dark (W1-2: no ruled row at the lake's east
 *   end), and the back plane's land going on down under the surface block by block (W1-3); the haze lying on the water at the far plane's
 *   waterline and thinning toward the viewer over a wandering reach (W1-9: no ruled horizon); the
 *   foreground water darker toward the viewer and over the frame's bottom sixth (W1-8); the shade at the feet of the land holding
 *   the water (W1-7: no bright pool stamped under every block).
 */
const KAGAMI_LAKE = {
  lip: [24, 80, 700, 1] as [number, number, number, number],
  sun: [0.7, 0.55] as [number, number],
  look: [1, 1, 1, 1] as [number, number, number, number],
  edge: [64, PLANES.far.rate, 0.75, 0.8] as [number, number, number, number],
};

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
  b.atmos({ x: 0, y1: h(90), blend: h(4), ...MORNING, sky: KAGAMI_SKY, mist: 0, water: { deep: "#528995", body: "#76a6a6", shallow: "#c6e4dc", glint: "#6a9fa4", mirror: [0.58, 0.76, 0.75], near: KAGAMI_NEAR_WATER, ...KAGAMI_LAKE }, glow: KAGAMI_GLOW, fog: KAGAMI_FOG, fades: KAGAMI_FADES });
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
  // (round 6, the critic's S5, "stop sprinkling", and S2/S6, no cloud base on a crown: the sun's
  // companion heap, the torn wisp off it (a flying saucer), the low deck (a row of lenses at one
  // height), the lone heap high on the postcard's left and the small heap off the tower are gone,
  // and the tower rises above every play frame's top edge, where in the play frames its base sat
  // on the great massif's crown and a far tower rose into it. The play frames' sky is the sun, the
  // isles and the far Walker in the weather, a clear hazy sky like reference 4's; the postcard's is
  // the great cumulus with its two companions of the same family: a small heap off its right
  // shoulder and the tower over the gates. No reflections: the play frames' lake would show the
  // doubles of clouds they cannot see.)
  ([
    // [id, x, dy, params, drift, seed]
    ["sky-heap-e", 1000, -332, { kind: "tower", w: 150, h: 170, tower: 1 }, 1.4, 32],
    ["sky-cu-b", 655, -462, { kind: "cumulus", w: 190, h: 66, tower: 0.55 }, 1.3, 39],
  ] as const).forEach(([id, x, dy, p, dr, n]) => b.sprite({ id, plane: "sky", kind: "op.cloud", x: x / rs, y: LAKE_Y + dy / rs, p: { ...p }, frames: 4, fps: 1, path: [skyWrap[0] / rs, skyWrap[1] / rs], drift: dr, reflect: false, seed: seed1(n) }));
  // (seed1(31), (33) to (38) were the dropped heaps, wisp and deck)
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
    // (round 5: the small cone lower, its crown met the far Walker's feet in play-west. Round 6,
    // the critic's S2: from 1450 to 1230: its two pillars stood exactly where the far Walker's front
    // legs stand in play-west, its crown at his belly, a table on pillar legs; now his own legs and
    // open fog stand there, the group left of him)
    [1230, [[0, 46, 230, "pillar"], [50, 40, 160, "pillar"], [-40, 70, 50, "cone"]]],
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
  const MID_LAKE = lakeAt(PLANES.mid.rate);
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
  // (vista round 1, W1-8: its plumes hung at the road's level in the whip-out, a flat-bottomed puff in
  // mid-air with the veil running on below it; the wet foot and the chunks stay, the plumes are gone: the
  // veils' spray is the valley mist's, where they reach it)
  bg(b, "back", 6560, "op.spray", { w: 120, h: 84, at: [], foot: [-3, 66], chunks: [6, 78] }, LAKE_Y, 3, seed1(2));

  // P1: far karst rising out of the haze (round 6, the sky and atmosphere lane, the critic's S3:
  // the old far look read as skyscrapers in fog, and its cluster at far x 330 to 760 stood right
  // behind the Walker's silhouette). Now soft tapering towers and sugarloaves with tree-capped,
  // irregular summits, their feet lost in the fog (op.farkarst), lower than before (the Walker is
  // the giant out here, and their crowns stay under the sky's cloud bases), in clusters with wide
  // gaps of mist between them; the patch of sky behind the Walker is his alone (a low cluster at
  // 20 to 260 stands well left of him)
  bg(b, "far", -900, "op.farkarst", { w: 1700, h: 178, rows: 2, groups: [[340, 760], [920, 1160, 0.62]], haze: 0.6 }, LAKE_Y, 1);
  bg(b, "far", 900, "op.farkarst", { w: 1800, h: 170, rows: 2, groups: [[340, 820, 0.95], [1150, 1600]], haze: 0.6 }, LAKE_Y, 2);
  const farWrap: [number, number] = [-900, 2400];
  // (the far wisps, thin streaks of mist, gave way to the fog banks lying on the water; their
  // seeds are kept)
  seedAt(b, seedNow(b) + 3);
  // (round 6: the low cloud deck far out over the lake and the wisps round the Walker are gone:
  // the weather he wades through is the far fog's own veils, KAGAMI_FOG's WALKER_VEILS)

  // P2 (falls on the great faces are veils with a spray bloom where they reach the mist)
  const FALLS: Record<number, number[]> = { 1880: [0], 3230: [0, 1] };
  P2.forEach(([x, forms], i) => bg(b, "mid", x, "op.karst", { w: 0, h: 380, rows: 1, look: "near", forms, mist: 12, green: 0.85, falls: 0.6, veil: 4, wet: local(MID_WET, x), ...(FALLS[x] ? { fallOn: FALLS[x] } : {}) }, LAKE_Y, i));
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
  // (round 6: the torn wisps in front of the giant are veils of the far fog now, WALKER_VEILS)
}

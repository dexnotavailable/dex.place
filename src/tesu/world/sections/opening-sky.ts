// The sky the opening falls through (the opening director, 10-18; the fall loop, round 1. Dex 10-16: "author every
// part of the scenery the camera passes: clouds, front fog layers on the camera, wind affecting the ofuda's path").
// The camera starts high over Kagami (opening/beats.ts camera keys: the frame's middle 34 H above her) and comes down
// with the paper past cloud at every depth, so the fall reads by parallax: far tops barely rising, a great tower and
// middling heaps drifting up past, a bank at the paper's own depth, the cloud deck it falls through, and the deck's
// base seen from under it as the camera breaks out over the lake. (The fog layers on the lens itself are
// opening/sky.ts; the sky's deep gradient, opening/fall-sky.ts.)
//
// One cloud family (Dex: never four kinds): the fall's variant of the sky lane's painter (op.fallcloud: the same lobes
// and light as Kagami's great cumulus, with the refs' whole value range), distance by rendering (`far`: value toward
// the sky, cooler, softer, fewer lobes, the foot lost in the haze). Each cloud is placed by WHEN and WHERE the
// camera sees it, composed on Dex's 1920 x 1080 frame (REF; at 1280 x 720 the framing tightens round the middle): its
// 3D place is solved from the camera's keys, so a change of the camera moves the clouds with it. They sit high
// above every play frame (12 H and more over the lake), so the game itself never sees them. Static (the camera's own
// motion is the movement; one drawing each). Placed last with explicit seeds: nothing else in the world is reseeded.

import { H } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES, type PlaneId } from "../types.ts";
import { BEATS, keysAt } from "../../opening/timeline.ts";
import { planeScale } from "../../render/view.ts";
import { DECK_Y } from "./common.ts";
import type { FallCloudP } from "../../art/library/opening/fall-cloud.ts";

/** The frame the placements are composed on (Dex plays at 1920 x 1080, one art px per screen px). */
export const REF = { W: 1920, H: 1080 } as const;

/**
 * The 3D point on a plane that the opening's camera shows at frame point (fx, fy) (shares of REF) at T: the cloud's
 * base middle lands there.
 */
// (rev 5, 10-20: the first 6.6 s are now the drop out of the black and the vast frame; the clouds placed then are
// re-placed by the push-in's camera, T 7.0-7.6, until the fall loop composes the vast frame: lanesrtall\ASKS.txt)
export function fallPoint(T: number, plane: PlaneId, fx: number, fy: number): [number, number] {
  const herX = BEATS.her.catchXH * H;
  const s0 = keysAt(T, herX, REF.W, REF.H);
  const z = s0.zoom, s = planeScale(PLANES[plane].rate, z);
  const eye = DECK_Y - ((s0.anchor - s0.horizon) * REF.H) / z;
  const hz = s0.horizon * REF.H;
  return [(fx * REF.W - REF.W / 2) / s + s0.cx, (fy * REF.H - hz) / s + eye];
}

export interface FallCloud {
  id: string;
  plane: PlaneId;
  /** When the camera sees its base middle at (fx, fy) (shares of the 1920 x 1080 frame). */
  T: number;
  fx: number;
  fy: number;
  p: FallCloudP;
}

/**
 * The fall's clouds, by the key frame they are composed for (lanes\art\fall\KEYFRAMES.md). The paper's flight
 * (beats.ts ofuda.path) keeps to the middle of the frame (x 670-1240, y 200-460 on screen), so the big masses pass
 * beside and below it, never across it, and the sky behind it stays a clean deep blue (its value gap).
 */
export const FALL_CLOUDS: readonly FallCloud[] = [
  // --- open (1.9 s, 32 H up): the sky ref's picture. One great tower rising from below on the left, cut by the left
  // edge and the bottom bar, its crown under the sun; a lower, hazier mass bottom-right; far tops along the haze
  // between them; two high wisps on one tilt; the paper's path from the top right in clear deep blue.
  { id: "fall-tower", plane: "back", T: 1.9, fx: 0.17, fy: 1.5, p: { kind: "tower", w: 920, h: 1180, lean: -0.1, sky: 0.8 } },
  { id: "fall-mass-se", plane: "mid", T: 1.9, fx: 0.86, fy: 0.93, p: { kind: "cumulus", w: 860, h: 360, tower: 0.55, far: 0.3, sky: 0.35 } },
  { id: "fall-far-a", plane: "far", T: 1.9, fx: 0.44, fy: 0.87, p: { kind: "cumulus", w: 280, h: 86, tower: 0.45, far: 0.85, sky: 0.15 } },
  { id: "fall-far-b", plane: "far", T: 1.9, fx: 0.585, fy: 0.9, p: { kind: "cumulus", w: 190, h: 58, tower: 0.4, far: 0.9, sky: 0.12 } },
  { id: "fall-far-c", plane: "far", T: 1.9, fx: 0.67, fy: 0.85, p: { kind: "cumulus", w: 150, h: 48, tower: 0.5, far: 0.9, sky: 0.15 } },
  { id: "fall-wisp-a", plane: "far", T: 1.9, fx: 0.4, fy: 0.27, p: { kind: "wisp", w: 620, h: 70, sky: 1, count: 3 } },
  { id: "fall-wisp-b", plane: "far", T: 1.9, fx: 0.83, fy: 0.36, p: { kind: "wisp", w: 460, h: 60, sky: 0.9, count: 2 } },
  { id: "fall-streak-low", plane: "mid", T: 1.9, fx: 0.6, fy: 0.97, p: { kind: "streak", w: 640, h: 64, far: 0.2, sky: 0.25, count: 2 } },
  // --- bank (4.6 s, 24.5 H): the wall at the paper's own depth, its crown rising under the paper, the paper falling
  // past its shaded body (a cool shade behind the bright paper), cut by the bottom bar; a middling heap left
  { id: "fall-bank", plane: "play", T: 4.63, fx: 0.66, fy: 1.16, p: { kind: "cumulus", w: 1400, h: 560, tower: 0.55, sky: 0.5 } },
  // --- gust (8.2 s, 15 H, in the weather): the deck the paper falls toward crosses the lower frame, its lumpy tops
  // lit; a great heap on the right rising out of it; the paper over the great tower's shaded foot
  { id: "fall-heap-e", plane: "back", T: 8.2, fx: 0.86, fy: 0.5, p: { kind: "cumulus", w: 900, h: 400, tower: 0.62, sky: 0.55 } },
  // --- the deck (gust 8.2 s -> break-out 10.6 s -> postcard 12.6 s): ONE thick layer the camera falls onto and
  // through. At the gust its sunlit heads cross the lower frame under the paper (its foot below them, the farther
  // layers under it toward the haze); the paper passes it at ~9.4 s (the lens fog's deck veil); at the break-out
  // its underside is overhead across the top of the frame (cool, lit from below, two bright gaps), its heads
  // hidden above the top bar; then the layers recede toward the horizon, each farther one lower, thinner, flatter
  // and hazier (ref 01's ceiling), filling the postcard's middle sky. No cloud of a second family.
  // (farthest first: within a plane the later-placed draws in front)
  { id: "fall-recede-b", plane: "far", T: 12.617, fx: 0.2, fy: 0.375, p: { kind: "deck", w: 1300, h: 56, far: 0.84, sky: 0.06, under: true } },
  { id: "fall-recede-a", plane: "far", T: 12.617, fx: 0.62, fy: 0.365, p: { kind: "deck", w: 1500, h: 70, far: 0.78, sky: 0.08, under: true, gaps: [[0.11, 0.06]] } },
  { id: "fall-deck-mid", plane: "mid", T: 10.617, fx: 0.52, fy: 0.42, p: { kind: "deck", w: 2900, h: 150, far: 0.5, sky: 0.15, under: true, gaps: [[-0.3, 0.05], [0.135, 0.035]] } },
  { id: "fall-deck", plane: "back", T: 10.617, fx: 0.5, fy: 0.405, p: { kind: "deck", w: 3600, h: 510, sky: 0.3, gaps: [[0.139, 0.014]] } },
];

export function openingSky(b: WorldBuilder): void {
  FALL_CLOUDS.forEach((c, i) => {
    const [x, y] = fallPoint(c.T, c.plane, c.fx, c.fy);
    b.sprite({ id: c.id, plane: c.plane, kind: "op.fallcloud", x, y, p: { ...c.p }, frames: 1, fps: 1, reflect: false, fade: 0, seed: 7919 * (9100 + i) });
  });
}

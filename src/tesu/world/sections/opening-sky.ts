// The sky the opening falls through (the opening director, 10-18; the fall loop, rounds 1-2. Dex 10-16: "author every
// part of the scenery the camera passes: clouds, front fog layers on the camera, wind affecting the ofuda's path").
// Rev 6's camera (opening/beats.ts, lane F's close follow, Dex 10-20): the paper drops out of the black, the world
// below shows for one glimpse (1.35 s, zoom 0.16), then the camera rides down WITH the paper at zoom 4 (2.5-14.6 s)
// past the clouds, through the deck, out under it over the lake, and onto the catch. (The
// fog layers on the lens itself are opening/sky.ts; the sky's deep gradient, opening/fall-sky.ts.)
//
// The clouds are the fall's CLOUD LIBRARY (Dex 10-19 20:00Z: "simulate clouds in a way where it has volume and good
// contrast"): cumulus built in 3D and rendered with one sun, snapped to the pixel grid and one palette
// (tools/clouds/cloudlib.py; the index art/library/opening/cloud-library.ts). One family: towers, heaps, puffs, far
// heaps, the deck's chunks and bands, low stratus and high cirrus. Each is placed by WHEN and WHERE the camera sees it,
// composed on Dex's 1920 x 1080 frame (REF): its 3D place is solved from the camera's keys, so a change of the camera
// moves the clouds with it. Distance is in the renders (the far ones compressed toward the sky) and the planes'
// parallax; no haze is laid over them (fade 0). They sit above every play frame, and are hidden outside the fall
// (game.ts syncFall). Placed last with explicit seeds: nothing else in the world is reseeded.

import { H } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES, type PlaneId } from "../types.ts";
import { BEATS, keysAt } from "../../opening/timeline.ts";
import { planeScale } from "../../render/view.ts";
import { DECK_Y } from "./common.ts";
import { CLOUDS } from "../../art/library/opening/cloud-library.ts";

/** The frame the placements are composed on (Dex plays at 1920 x 1080, one art px per screen px). */
export const REF = { W: 1920, H: 1080 } as const;

/**
 * The 3D point on a plane that the opening's camera shows at frame point (fx, fy) (shares of REF) at T: the cloud's
 * base middle lands there.
 */
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
  /** Which cloud of the library (cloud-library.ts). */
  cloud: keyof typeof CLOUDS & string;
  /**
   * Composed low, in the play sky by design (the deck overhead at the break-out; the far heaps and stratus toward the
   * horizon): hidden outside the fall (game.ts syncFall), so only the close band the fall hands off to (the catch, the
   * walk) must never see it.
   */
  low?: boolean;
  /**
   * (round 5) Aerial haze over the fall: [from T, to T, strength]: the piece recedes into its plane's haze between the
   * two (game.ts syncFall; its shading kept). For a far piece composed for the drop that stays in the frame after it.
   */
  haze?: readonly [number, number, number];
}

/** A library cloud's bounds round its anchor (level-1 px of its plane): [x0, y0, x1, y1]. */
export function cloudBounds(id: string): [number, number, number, number] {
  const c = CLOUDS[id];
  if (!c) throw new Error(`no cloud ${id} in the library`);
  return [-c.ax, -c.ay, c.w - c.ax, c.h - c.ay];
}

/**
 * The fall's clouds, by the moment they are composed for (lanesrtall\KEYFRAMES.md; rev 6, lane F's close follow:
 * the camera rides down WITH the paper at zoom 4 from 2.5 s, so the clouds pass the paper, rising past it, nearer
 * planes faster: the far heaps barely move (~30 px/s), the mid plane's ~125 px/s, the back plane's ~410 px/s). Every
 * cloud is behind the paper (it is drawn near the lens, over every plane), and the paper's column (x 0.40-0.62 of the
 * frame) is kept to open sky or a shaded body, never a lit crown parked behind it. Within a plane the later-placed
 * draws in front.
 */
export const FALL_CLOUDS: readonly FallCloud[] = [
  // (round 3: W1-4 one tower per stretch, never the same heap filling the right third all the way down; W1-5 six to
  // ten pieces per frame on three planes, the low stratus layer under the cumulus, a field of far heaps under the
  // drop; W1-8 the drop's wisp curved and fibrous; W1-9 faint far cirrus in the blue between the clouds)
  // --- the drop out of the black (0.64-1.3 s): the great tower east, a curved wisp west of the paper, faint cirrus in
  // the blue, and the sky's lower third a field of far heaps and stratus under the paper (the far plane barely moves:
  // the depth the rest is measured against; these stay far all the way down)
  { id: "fall-cirrus-drop-a", plane: "far", T: 0.8, fx: 0.66, fy: 0.2, cloud: "ci-d" },
  { id: "fall-cirrus-drop-b", plane: "far", T: 0.8, fx: 0.12, fy: 0.3, cloud: "ci-e" },
  { id: "fall-wisp-hi-a", plane: "far", T: 1.0, fx: 0.14, fy: 0.38, cloud: "ci-f" },
  { id: "fall-wisp-hi-b", plane: "far", T: 1.0, fx: 0.78, fy: 0.72, cloud: "ci-c" },
  { id: "fall-cirrus-b", plane: "far", T: 2.94, fx: 0.92, fy: 0.2, cloud: "ci-b" },
  { id: "fall-st-drop-a", plane: "far", T: 0.8, fx: 0.3, fy: 0.85, cloud: "st-c" },
  { id: "fall-st-drop-b", plane: "far", T: 0.8, fx: 0.74, fy: 0.9, cloud: "st-d" },
  { id: "fall-far-field-a", plane: "far", T: 0.8, fx: 0.36, fy: 0.9, cloud: "cu-far-c" },
  { id: "fall-far-field-b", plane: "far", T: 0.8, fx: 0.63, fy: 1.06, cloud: "cu-far-b" },
  // (round 5, from round 4: the drop was ~70% empty gradient) a towering cumulus on the far plane low in the west, its
  // column whole in the frame (never cut by its edge), its stepped shoulder running east under the paper and its foot
  // behind the near heap and the bottom bar: the first sudden view has a mass to measure the world below by. Narrow
  // (a column with one low shoulder): the far plane barely moves, so it stays west of the paper all the way down and
  // recedes into the haze as the fog comes in (haze), a pale far shape behind the ride's and the gust's near clouds
  { id: "fall-tower-far", plane: "far", T: 0.8, fx: 0.215, fy: 1.06, cloud: "cu-tower-c", haze: [2.5, 6.6, 0.35] },
  { id: "fall-heap-drop-w", plane: "mid", T: 0.8, fx: 0.07, fy: 1.0, cloud: "cu-heap-c" },
  { id: "fall-tower", plane: "mid", T: 0.8, fx: 1.05, fy: 1.32, cloud: "cu-tower-a" },
  // --- the ride (2.5-7 s, zoom 4): far heaps and low stratus in the lower frame, the great tower's body on the right,
  // a second tower (cu-tower-b) rising on the LEFT whose crown passes the paper at the fog and stands west of it at
  // the gust (W1-4: the towers change sides and sizes down the fall), puffs on the back plane rushing past the edges
  { id: "fall-far-heap-a", plane: "far", T: 3.0, fx: 0.06, fy: 1.02, cloud: "cu-far-a" },
  { id: "fall-far-heap-b", plane: "far", T: 3.0, fx: 0.72, fy: 1.08, cloud: "cu-far-b" },
  { id: "fall-far-heap-c", plane: "far", T: 6.6, fx: 0.98, fy: 1.04, cloud: "cu-far-c" },
  { id: "fall-st-ride-a", plane: "far", T: 4.633, fx: 0.26, fy: 0.8, cloud: "st-d" },
  { id: "fall-st-ride-b", plane: "far", T: 4.633, fx: 0.86, fy: 0.76, cloud: "st-e" },
  { id: "fall-cirrus-ride", plane: "far", T: 4.633, fx: 0.2, fy: 0.2, cloud: "ci-d" },
  { id: "fall-tower-b", plane: "mid", T: 8.2, fx: -0.06, fy: 0.9, cloud: "cu-tower-b" },
  { id: "fall-puff-e", plane: "back", T: 3.6, fx: 0.97, fy: 0.62, cloud: "cu-puff-a" },
  { id: "fall-puff-w", plane: "back", T: 5.6, fx: 0.08, fy: 0.6, cloud: "cu-puff-b" },
  { id: "fall-puff-ride-n", plane: "back", T: 4.633, fx: 0.17, fy: 0.3, cloud: "cu-puff-c" },
  // --- the fog and the gust (6-9 s): puffs on the back plane passing low in the frame, stratus under the west tower
  { id: "fall-puff-fog-w", plane: "back", T: 6.95, fx: -0.06, fy: 0.8, cloud: "cu-puff-a" },
  { id: "fall-puff-fog-e", plane: "back", T: 6.95, fx: 0.86, fy: 0.9, cloud: "cu-puff-c" },
  { id: "fall-st-gust", plane: "far", T: 8.2, fx: 0.18, fy: 0.78, cloud: "st-c" },
  // --- the deck (round 2b, re-solved on rev 6): a CEILING on the BACK plane the camera falls through over 7.5-11.6 s:
  // its crowns rise under the paper at the gust (7.3-9.1), then its rolls and undersides pass up past it. The chunks
  // part round the paper's column: the paper falls down a canyon of sky between deck-m (west) and deck-e1 (east)
  // (W1-9: sky behind it, never a lit crown). Later = in front: the lowest last.
  { id: "fall-cirrus-deck", plane: "far", T: 10.617, fx: 0.86, fy: 0.15, cloud: "ci-e" },
  { id: "fall-st-deck", plane: "far", T: 10.617, fx: 0.7, fy: 0.62, cloud: "st-d" },
  { id: "fall-deck-e2", plane: "back", T: 10.617, fx: 1.47, fy: 318 / 1080, cloud: "deck-e2", low: true },
  { id: "fall-deck-e", plane: "back", T: 10.617, fx: 1.37, fy: 343 / 1080, cloud: "deck-e1", low: true },
  { id: "fall-deck-w", plane: "back", T: 10.617, fx: -0.32, fy: 361 / 1080, cloud: "deck-w", low: true },
  { id: "fall-deck-m", plane: "back", T: 10.617, fx: -0.056, fy: 400 / 1080, cloud: "deck-m", low: true },
  // --- under the deck (10-12 s): one bank of heaps at different heights rushing up past the frame's foot on the
  // back plane (W1-6: never a row of same-size domes; the column under the paper the lowest), in front of the
  // underside's top
  { id: "fall-bank-deck-e", plane: "back", T: 10.617, fx: 0.87, fy: 1.49, cloud: "cu-heap-e", low: true },
  { id: "fall-bank-deck-m", plane: "back", T: 10.617, fx: 0.5, fy: 1.09, cloud: "cu-puff-a", low: true },
  // --- coming out under the clouds (12.6-14.6 s): NO ceiling this round (art director, round 3 integration). The
  // deck-under piece (back plane, T 14.6 fx 0.48 fy 0.06) drew as a row of five round blobs with a golf-ball cell
  // texture: separate balls overhead at the come-out, and a bubbly cluster over the Walker in the glimpse (zoom 0.16
  // sees every placement). The come-out reads as open, serene haze until the underside is re-made as long flat rolls
  // (round 4); the library keeps the piece.
];

export function openingSky(b: WorldBuilder): void {
  FALL_CLOUDS.forEach((c, i) => {
    const [x, y] = fallPoint(c.T, c.plane, c.fx, c.fy);
    const e = CLOUDS[c.cloud]!;
    const reach = Math.ceil(Math.max(e.ax, e.w - e.ax) + 40);
    b.sprite({
      id: c.id, plane: c.plane, kind: "frames", x, y,
      p: { sets: e.sets.map((s) => ({ ...s })), reach, ...(c.haze ? { haze: [...c.haze] } : {}) },
      frames: 1, fps: 1, reflect: false, fade: 0, seed: 7919 * (9100 + i),
    });
  });
}

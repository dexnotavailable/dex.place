// The sky the opening falls through (the opening director, 10-18; the fall loop, rounds 1-2. Dex 10-16: "author every
// part of the scenery the camera passes: clouds, front fog layers on the camera, wind affecting the ofuda's path").
// Rev 5's camera (opening/beats.ts): the paper drops out of the black, the camera pulls straight out to the VAST FRAME
// (the whole world far below, the sky above it, 1.6-4.6 s), pushes in on the paper into the cloud deck (7.6 s), falls
// with it past the deck's crowns (the gust), breaks out under the deck over Kagami and settles on the postcard. (The
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
}

/** A library cloud's bounds round its anchor (level-1 px of its plane): [x0, y0, x1, y1]. */
export function cloudBounds(id: string): [number, number, number, number] {
  const c = CLOUDS[id];
  if (!c) throw new Error(`no cloud ${id} in the library`);
  return [-c.ax, -c.ay, c.w - c.ax, c.h - c.ay];
}

/**
 * The fall's clouds, by the moment they are composed for (lanes\art\fall\KEYFRAMES.md; rev 5). Within a plane the
 * later-placed draws in front.
 */
export const FALL_CLOUDS: readonly FallCloud[] = [
  // --- the VAST FRAME (2.94 s, zoom 0.17): the sky over the whole world. The sun upper left over open sky and high
  // cirrus combed west; a great tower rising on the right past the palace, its sun side lit; the deck (on the back
  // plane, below) lying low over the world toward the horizon, so the paper's column is open sky (F's ASK 1) and the
  // tower's foot is lost behind the deck.
  // --- the drop out of the black and the pull-out (0.64-1.6 s): high wisps rushing by the frame as the sky hits
  { id: "fall-wisp-hi-a", plane: "far", T: 1.0, fx: 0.3, fy: 0.5, cloud: "ci-a" },
  { id: "fall-wisp-hi-b", plane: "far", T: 1.0, fx: 0.78, fy: 0.72, cloud: "ci-c" },
  { id: "fall-cirrus-b", plane: "far", T: 2.94, fx: 0.92, fy: 0.2, cloud: "ci-b" },
  { id: "fall-tower", plane: "mid", T: 2.94, fx: 0.8, fy: 0.6, cloud: "cu-tower-a" },
  // --- the deck (round 2b): a CEILING on the BACK plane (it rises past the paper faster than the mid plane, so at
  // the gust its crowns lie under the paper while at the break-out and the postcard its crowns are above the top bar
  // and only its underside shows). Composed for the break-out (10.617 s, art 0.72): four chunks overlapping, their
  // bases undulating (the rolls' feet y ~400-480), torn gaps between them: G1 round the sun (x ~170-340: the sun in it
  // or at its west edge from the break-out to the postcard) and G2 the paper falls through (x ~950-1040: at the gust
  // 7.0-9.6 s the paper drops into the valley between two crowns, sky behind it, never a lit crown: W1-9). Later = in
  // front: the lowest last.
  { id: "fall-deck-e2", plane: "back", T: 10.617, fx: 2420 / 1920, fy: 318 / 1080, cloud: "deck-e2", low: true },
  { id: "fall-deck-e", plane: "back", T: 10.617, fx: 1468 / 1920, fy: 343 / 1080, cloud: "deck-e1", low: true },
  { id: "fall-deck-w", plane: "back", T: 10.617, fx: -420 / 1920, fy: 361 / 1080, cloud: "deck-w", low: true },
  { id: "fall-deck-m", plane: "back", T: 10.617, fx: 592 / 1920, fy: 400 / 1080, cloud: "deck-m", low: true },
];

export function openingSky(b: WorldBuilder): void {
  FALL_CLOUDS.forEach((c, i) => {
    const [x, y] = fallPoint(c.T, c.plane, c.fx, c.fy);
    const e = CLOUDS[c.cloud]!;
    const reach = Math.ceil(Math.max(e.ax, e.w - e.ax) + 40);
    b.sprite({
      id: c.id, plane: c.plane, kind: "frames", x, y,
      p: { sets: e.sets.map((s) => ({ ...s })), reach },
      frames: 1, fps: 1, reflect: false, fade: 0, seed: 7919 * (9100 + i),
    });
  });
}

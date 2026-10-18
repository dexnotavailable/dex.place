// The sky the opening falls through (the opening director, 10-18; Dex 10-16: "author every part of the scenery the
// camera passes: clouds, front fog layers on the camera, wind affecting the ofuda's path"). The camera starts high
// over Kagami (opening/beats.ts camera keys: the frame's middle 34 H above her) and comes down with the paper through
// layers of cloud at every depth, so the fall reads by parallax: far heaps barely rising, middling ones drifting up
// past, a bank at the paper's own depth it goes behind, near masses rushing past the lens, the cloud deck's base seen
// from under it as the camera breaks out over the lake. (The fog layers on the lens itself are opening/sky.ts.)
//
// One cloud family (Dex: never four kinds): the sky lane's op.cloud painter, the same lobes and light as Kagami's
// great cumulus. Each cloud is placed by WHEN and WHERE the opening's camera sees it (on the reference frame, 1280 x
// 720): its 3D place is solved from the camera's keys, so a change of the camera moves the clouds with it. They sit
// high above every play frame (12 H and more over the lake), so the game itself never sees them; the widest frame
// under TESU shows a few, small, high in its sky. Static (the camera's own motion is the movement), their lobes
// swelling and settling (4 drawings). Placed last with explicit seeds: nothing else in the world is reseeded.

import { H } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES, type PlaneId } from "../types.ts";
import { BEATS, keysAt } from "../../opening/timeline.ts";
import { planeScale } from "../../render/view.ts";
import { DECK_Y } from "./common.ts";

/** The reference frame the placements are composed on. */
const REF = { W: 1280, H: 720 } as const;

/**
 * The 3D point on a plane that the opening's camera shows at frame point (fx, fy) (shares) at T: the cloud's base
 * middle lands there.
 */
export function fallPoint(T: number, plane: PlaneId, fx: number, fy: number): [number, number] {
  const herX = BEATS.her.catchXH * H;
  const s0 = keysAt(T, herX, REF.W, REF.H);
  const z = s0.zoom, s = planeScale(PLANES[plane].rate, z);
  const eye = DECK_Y - ((s0.anchor - s0.horizon) * REF.H) / z;
  const hz = s0.horizon * REF.H;
  return [(fx * REF.W - REF.W / 2) / s + s0.cx, (fy * REF.H - hz) / s + eye];
}

interface FallCloud {
  id: string;
  plane: PlaneId;
  /** When the camera sees its base middle at (fx, fy). */
  T: number;
  fx: number;
  fy: number;
  p: { kind: "cumulus" | "tower" | "stratus" | "wisp"; w: number; h: number; tower?: number; haze?: number };
}

/**
 * The far planes' haze is the land's (Kagami's is a lake green): a cloud keeps its own whites, only a breath of it
 * (its distance is the painter's own `haze`, toward the half light).
 */
const FADE: Partial<Record<PlaneId, number>> = { sky: 0, far: 0.06, mid: 0.03, back: 0.04 };

/**
 * The fall's clouds, top to bottom. The paper's flight (beats.ts ofuda.path) keeps to the middle of the frame, so the
 * big masses pass beside it; the front bank crosses it about bar 2 (the thick fog layer on the lens goes with it).
 */
export const FALL_CLOUDS: readonly FallCloud[] = [
  // high and far: barely rising (the depth the rest is measured against)
  { id: "fall-strand-high", plane: "far", T: 0.9, fx: 0.3, fy: 0.24, p: { kind: "stratus", w: 560, h: 40, haze: 0.3 } },
  { id: "fall-far-heap", plane: "far", T: 3.4, fx: 0.86, fy: 0.66, p: { kind: "cumulus", w: 330, h: 120, tower: 0.55, haze: 0.4 } },
  // middling: drifting up past
  { id: "fall-mid-tower", plane: "mid", T: 2.4, fx: 0.12, fy: 0.84, p: { kind: "tower", w: 210, h: 250, tower: 1, haze: 0.15 } },
  { id: "fall-mid-heap", plane: "mid", T: 6.4, fx: 0.88, fy: 0.74, p: { kind: "cumulus", w: 400, h: 160, tower: 0.7, haze: 0.1 } },
  { id: "fall-back-heap", plane: "back", T: 4.2, fx: 0.26, fy: 0.9, p: { kind: "cumulus", w: 360, h: 150, tower: 0.6 } },
  { id: "fall-back-low", plane: "back", T: 8.4, fx: 0.7, fy: 0.62, p: { kind: "cumulus", w: 300, h: 110, tower: 0.4 } },
  // the cloud deck's base, seen from under it as the camera breaks out over the lake
  { id: "fall-deck-a", plane: "mid", T: 10.2, fx: 0.3, fy: 0.24, p: { kind: "stratus", w: 760, h: 64, haze: 0.2 } },
  { id: "fall-deck-b", plane: "back", T: 9.8, fx: 0.78, fy: 0.2, p: { kind: "stratus", w: 640, h: 56 } },
  // at the paper's own depth: one behind it, one it passes behind (the front plane draws after her and the paper)
  { id: "fall-play-heap", plane: "play", T: 3.6, fx: 0.8, fy: 0.68, p: { kind: "cumulus", w: 280, h: 130, tower: 0.55 } },
  { id: "fall-play-heap-b", plane: "play", T: 7.4, fx: 0.18, fy: 0.66, p: { kind: "cumulus", w: 320, h: 140, tower: 0.5 } },
  { id: "fall-front-bank", plane: "front", T: 5.5, fx: 0.52, fy: 0.64, p: { kind: "cumulus", w: 500, h: 180, tower: 0.45 } },
  // in front of the paper, early and late (the near plane inks its art darker: the clouds stay in the one light, so
  // the lens's own rush is the fog layers', opening/sky.ts)
  { id: "fall-front-strand", plane: "front", T: 2.2, fx: 0.1, fy: 0.46, p: { kind: "stratus", w: 480, h: 50 } },
  { id: "fall-front-mass", plane: "front", T: 7.6, fx: 0.86, fy: 0.9, p: { kind: "cumulus", w: 520, h: 200, tower: 0.4 } },
];

export function openingSky(b: WorldBuilder): void {
  FALL_CLOUDS.forEach((c, i) => {
    const [x, y] = fallPoint(c.T, c.plane, c.fx, c.fy);
    b.sprite({ id: c.id, plane: c.plane, kind: "op.cloud", x, y, p: { ...c.p }, frames: 4, fps: 1, reflect: false, fade: FADE[c.plane], seed: 7919 * (9100 + i) });
  });
}

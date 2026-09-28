// Turns contract frame events into runtime effects. Anything that plays
// clips (player, turret, later bosses) fires its frames through here.

import type { Box, Frame, Vec2 } from "../contracts.ts";
import type { Camera } from "../engine/camera.ts";
import type { SpriteDraw } from "../engine/renderer.ts";
import type { Placement, Vfx } from "../engine/vfx.ts";
import type { Feel } from "./feel.ts";

export interface Services {
  vfx: Vfx;
  feel: Feel;
  camera: Camera;
}

export interface EventOwner {
  x: number;
  y: number;
  facing: number;
  follow: () => Placement;
  sprite?: () => SpriteDraw | undefined;
}

export function localPoint(f: Frame, anchor: string | undefined, offset: Vec2 | undefined): Vec2 {
  const a = anchor ? f.anchors?.[anchor] ?? [0, 0] : [0, 0];
  const o = offset ?? [0, 0];
  return [a[0]! + o[0], a[1]! + o[1]];
}

export function fireFrame(f: Frame, owner: EventOwner, s: Services): void {
  if (!f.events) return;
  for (const e of f.events) {
    switch (e.type) {
      case "vfx": {
        const lp = localPoint(f, e.anchor, e.offset);
        s.vfx.spawn(e.id, {
          x: owner.x + lp[0] * owner.facing,
          y: owner.y + lp[1],
          facing: owner.facing,
          rotation: e.rotation,
          scale: e.scale,
          colour: e.colour,
          core: e.core,
          edge: e.edge,
          layer: e.layer,
          params: e.params,
          light: e.light,
          follow: e.attach ? owner.follow : undefined,
          offset: e.attach ? lp : undefined,
          sprite: owner.sprite?.(),
          spriteFn: owner.sprite,
        });
        break;
      }
      case "light": {
        const lp = localPoint(f, e.anchor, e.offset);
        s.vfx.light(e, {
          x: owner.x + lp[0] * owner.facing,
          y: owner.y + lp[1],
          facing: owner.facing,
          follow: e.attach ? owner.follow : undefined,
          offset: e.attach ? lp : undefined,
        });
        break;
      }
      case "shake":
        s.camera.shake(e.amplitude, e.duration);
        break;
      case "zoom":
        s.camera.zoom(e.steps, e.duration);
        break;
      case "slowmo":
        s.feel.slowmo(e.factor, e.duration);
        break;
      case "cutin":
        s.feel.startCutin(e.id, e.duration);
        break;
      case "sound":
        s.feel.sound(e.id, e.volume ?? 1);
        break;
      case "impact":
        s.feel.impactFrame(e.mode, e.duration);
        break;
    }
  }
}

export interface WorldBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Frame-relative box to world space, mirrored when facing left. */
export function toWorld(b: Box, x: number, y: number, facing: number): WorldBox {
  return { x: facing > 0 ? x + b.x : x - b.x - b.w, y: y + b.y, w: b.w, h: b.h };
}

export function overlap(a: WorldBox, b: WorldBox): WorldBox | null {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

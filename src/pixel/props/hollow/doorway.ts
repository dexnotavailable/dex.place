// hollowDoor: the shared door (../door.ts: every state, the leaf's swing, the
// gate's slide, the latch, the host's `door` events) without its own frame.
//
// The DOOR RULE (Dex, 2026-10-01): no door pasted onto a wall. In the Hollow
// the wall itself is the frame: each room's backdrop builds the opening into
// its wall (C1: an arched stone surround with a deep reveal in the archive
// block; C2: a moulded oak case set into the panelling; C3: a riveted portal
// cut into the spire's stem), in the wall's own material and light, with a
// step and a contact shadow. A sprite frame on top of that would be a second,
// differently lit frame floating in front of the first, so this recipe draws
// only what moves or is seen through the opening: the leaf (or the gate, or
// the shutter), the dark beyond, the maintenance rail.
//
// Same params, states, cues, actions and `use` reach as the door; the host
// handles it exactly like one (the door events carry no recipe name).

import "./materials.ts";
import { door, type DoorParams } from "../door.ts";
import { matId } from "../../kit.ts";
import { defineRecipe, type Recipe } from "../../prop.ts";

type DoorRefs = ReturnType<typeof door.build>;

export interface HollowDoorParams extends DoorParams {
  /** Warm the steel leaf through the room's amber light (rust-brown shadows) instead of cold iron. */
  warm: boolean;
  /** Px left clear at the leaf's foot: the wall's stone threshold shows under it (the leaf stands on it). */
  sill: number;
  /** Px of the lintel's shadow across the leaf's head (it is set back in the reveal, under the lintel). */
  recess: number;
}

export const hollowDoor = defineRecipe<HollowDoorParams, DoorRefs>({
  ...(door as unknown as Recipe<HollowDoorParams, DoorRefs>),
  id: "hollowDoor",
  reason: "The Hollow's doors are built into their walls (DOOR RULE): the room's backdrop is the frame, so the prop is only the leaf, the gate or the shutter that moves in it.",
  defaults: { ...door.defaults, warm: false, sill: 0, recess: 0 } as HollowDoorParams,
  build(b, p) {
    const refs = door.build(b, p);
    // the leaf's design(s): warm the steel, stand it on the threshold, shade its head under the lintel
    const iron = matId("iron"), warm = matId("hollowDoorSteel");
    for (const src of refs.src) {
      const g = src.grid;
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          const i = g.inner(x, y);
          if (i < 0 || !g.mat[i]) continue;
          if (p.sill > 0 && y >= g.h - p.sill) {
            g.mat[i] = 0;
            continue;
          }
          if (p.warm && g.mat[i] === iron) g.mat[i] = warm;
          if (p.recess > 0 && y < p.recess) g.tone[i] = Math.max(-3, g.tone[i]! - (y < p.recess / 2 ? 2 : 1));
        }
    }
    for (const name of ["frame", "reveal"]) {
      try {
        const part = b.get(name);
        part.visible = false;
        part.hittable = false;
      } catch {
        // no reveal on stone and timber frames
      }
    }
    return refs;
  },
});

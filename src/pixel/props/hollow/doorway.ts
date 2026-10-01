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
  /** Tone steps the whole leaf sits darker than the wall round it (it stands back in the reveal). */
  shade: number;
  /** Px of the jambs' shadow down both edges of the leaf (the reveal's inner shadow). */
  jamb: number;
}

export const hollowDoor = defineRecipe<HollowDoorParams, DoorRefs>({
  ...(door as unknown as Recipe<HollowDoorParams, DoorRefs>),
  id: "hollowDoor",
  reason: "The Hollow's doors are built into their walls (DOOR RULE): the room's backdrop is the frame, so the prop is only the leaf, the gate or the shutter that moves in it.",
  defaults: { ...door.defaults, warm: false, sill: 0, recess: 0, shade: 0, jamb: 0 } as HollowDoorParams,
  build(b, p) {
    const refs = door.build(b, p);
    // the leaf's design(s): warm the steel, stand it on the threshold, shade its head under the lintel
    const iron = matId("iron"), warm = matId("hollowDoorSteel");
    for (const src of refs.src) {
      const g = src.grid;
      for (let y = 0; y < g.h; y++) {
        // the leaf's extent on this row (the jambs' shadow falls in from both edges)
        let l0 = -1, l1 = -1;
        for (let x = 0; x < g.w; x++) {
          const i = g.inner(x, y);
          if (i >= 0 && g.mat[i]) (l0 < 0 && (l0 = x), (l1 = x));
        }
        for (let x = 0; x < g.w; x++) {
          const i = g.inner(x, y);
          if (i < 0 || !g.mat[i]) continue;
          if (p.sill > 0 && y >= g.h - p.sill) {
            g.mat[i] = 0;
            continue;
          }
          if (p.warm && g.mat[i] === iron) g.mat[i] = warm;
          let k = p.shade;
          if (p.recess > 0 && y < p.recess) k += y < p.recess / 2 ? 2 : 1;
          if (p.jamb > 0 && l0 >= 0) {
            const e = Math.min(x - l0, l1 - x);
            if (e < p.jamb) k += e < p.jamb / 2 ? 2 : 1;
          }
          // the threshold's occlusion: the leaf's foot darkens where it meets the step
          if (p.sill > 0 && y >= g.h - p.sill - 4) k += 1;
          if (k) g.tone[i] = Math.max(-3, g.tone[i]! - k);
        }
      }
    }
    // set back in the reveal, the leaf takes no lit outline or rim of its own: the jambs' shadow is its edge
    if (p.jamb > 0) {
      try {
        const leaf = b.get("leaf");
        leaf.outline = 0;
        // and no rim light: the street's / the room's rim cannot reach a leaf set back behind its jambs
        leaf.rim = 0;
      } catch {
        // gates and shutters have no leaf
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

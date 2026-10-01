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
import { defineRecipe } from "../../prop.ts";

type DoorRefs = ReturnType<typeof door.build>;

export const hollowDoor = defineRecipe<DoorParams, DoorRefs>({
  ...door,
  id: "hollowDoor",
  reason: "The Hollow's doors are built into their walls (DOOR RULE): the room's backdrop is the frame, so the prop is only the leaf, the gate or the shutter that moves in it.",
  build(b, p) {
    const refs = door.build(b, p);
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

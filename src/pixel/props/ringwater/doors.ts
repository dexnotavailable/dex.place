// Ringwater's doors, built on the kit door (src/pixel/props/door.ts: same
// leaf, frame, rail, states and sounds).
//
// lodgeDoor: an ordinary door you go through with one E: it swings open and
// the host takes you through (the `door` event "enter"; the room's doors
// table says where). It closes behind you a moment later, so coming back out
// you see it shut. `open: true` starts it open (the lodge after the round).
//
// skyDoor: the loft door with the red mark (WORLD-PLAN A3, S4). Before the
// latch on the chapel's balcony is released, E opens it onto the dusk sky
// (the lodge's backdrop paints the view behind it: the lake far below, a tiny
// ring, the black spire with its storm) with the maintenance rail bolted
// across the doorway from the far side: E rattles the rail, and the door
// swings shut again when you step away. Once released (state `free`, which
// the room state sends when latch:sky-door is in the save), E opens it and
// you step through onto the balcony.

import "./materials.ts";
import { door, type DoorParams } from "../door.ts";
import { defineRecipe, type Prop } from "../../prop.ts";

type DoorRecipe = typeof door;
type DoorRefs = ReturnType<DoorRecipe["build"]>;
const S = door.states;

export const lodgeDoor = defineRecipe<DoorParams, DoorRefs>({
  ...door,
  id: "lodgeDoor",
  reason: "The lodge's doors, to the cliff stair and to the yard: one press takes you through, the way an ordinary door should.",
  states: {
    ...S,
    open: {
      ...S["open"]!,
      enter(c, from) {
        S["open"]!.enter?.(c, from);
        // opened by you: go through; then it swings shut behind you (not when it was left ajar)
        if (from === "opening" && !c.data["ajar"]) c.emit({ type: "door", action: "enter" });
      },
      update(c) {
        if (c.t > 1.2 && !c.params["open"] && !c.data["ajar"] && !near(c)) c.go("closing");
      },
    },
    /** Swing open and stay open (the lodge's front door, the evening after the round). */
    ajar: {
      enter(c) {
        c.data["ajar"] = true;
        c.go(c.refs.f >= 1 ? "open" : "opening");
      },
    },
  },
  demo: {
    indoor: true,
    w: 4,
    params: { kind: "ordinary", frame: "timber" },
    script: [
      { label: "closed", wait: 0.8 },
      { label: "E: opens and you go through", use: true, wait: 2.4 },
      { label: "shuts behind you", wait: 1.6 },
    ],
  },
});

export const skyDoor = defineRecipe<DoorParams, DoorRefs>({
  ...door,
  id: "skyDoor",
  reason: "The loft door with the red mark: it opens onto a dusk sky in the morning, barred from the far side, until you release its latch from the chapel's balcony; then it is the short way home.",
  defaults: { ...door.defaults, kind: "sky", latch: "far", mark: true, beyond: "none", frame: "timber" },
  states: {
    ...S,
    closed: {
      ...S["closed"]!,
      // barred or not, it opens: barred, you only see the view
      use: () => "opening",
    },
    open: {
      ...S["open"]!,
      enter(c, from) {
        S["open"]!.enter?.(c, from);
        if (from === "opening" && c.data["unlatched"]) c.emit({ type: "door", action: "enter" });
      },
      use(c) {
        if (c.data["unlatched"]) {
          c.emit({ type: "door", action: "enter" });
          return;
        }
        // the rail is bolted on the far side: it rattles in its clamps
        const rail = c.refs.rail;
        if (rail) rail.shake = Math.max(rail.shake, 0.35);
        c.sound("door.rattle", 0.8);
        c.emit({ type: "door", action: "rattle" });
      },
      update(c) {
        if (c.t > 2.5 && !near(c)) c.go("closing");
      },
    },
    /** The latch was released on the balcony (latch:sky-door): the rail is gone for good. */
    free: {
      enter(c) {
        c.data["unlatched"] = true;
        if (c.refs.rail) c.refs.rail.visible = false;
      },
      update(c) {
        c.go(c.refs.f > 0.5 ? "open" : "closed");
      },
    },
  },
  demo: {
    indoor: true,
    w: 4,
    script: [
      { label: "the sky door, closed", wait: 0.8 },
      { label: "E: it opens onto the dusk, barred", use: true, wait: 2 },
      { label: "E: the rail rattles", use: true, wait: 1.2 },
      { label: "step away: it swings shut", walk: [0, 3], wait: 4 },
      { label: "released from the balcony", go: "free", wait: 0.6 },
      { label: "E: opens and you step through", walk: [3, 0.4], use: true, wait: 2 },
    ],
  },
});

/** Is anyone standing within reach of the doorway? */
function near(c: Prop<DoorRefs>): boolean {
  return c.world.actorsNear(c.x, c.y, c.params.H * 0.9, c.params.H * 0.8).length > 0;
}

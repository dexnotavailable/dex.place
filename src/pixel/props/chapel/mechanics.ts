// Chapel mechanics on top of the shared kit (lane R-E):
//
// chapelDoor  the kit's door (big chapel doors, the red-marked sky door with
//             its maintenance rail) with two things the chapel needs: one E
//             opens it and, once it stands open, carries you through (as the
//             runtime's own doors do); and releasing the latch rings the
//             chapel bell once by itself (WORLD-PLAN beat 12). The latch and
//             the rest are the kit door's, unchanged.
// naveRule    the nave rule for a room (WORLD-PLAN E3): the whole room's pixel
//             matter becomes sway-only (world.breakage = "sway"): combat still
//             works, but hits only disturb things; nothing fractures in the
//             room that holds the art. An invisible prop, so the rule lives
//             in the room's own data.
// pathLamp    the kit's lamp post, dark until the shrine it belongs to (a
//             shrine lantern in the same room) is lit; then the lamps come on
//             one after another down the path, as if they share one wick.
//             Already lit for the save: on from the start.
// naveCandelabra  the kit's candelabra for the nave: a flame a hit or the
//             dash's wind put out gutters and relights by itself a few
//             seconds later (WORLD-PLAN E3, "gutter out and relight if hit");
//             E still relights at once.
// naveBench   the kit's pew without its own E, for a spot where the room's
//             "sit and look" seat (the runtime's sit, holding the camera on
//             the works) is the thing you use.

import "./materials.ts";
import { door, type DoorParams } from "../door.ts";
import { lampPost } from "../lampPost.ts";
import { bench } from "../bench.ts";
import { candles } from "../candles.ts";
import { candelabra, type CandelabraParams } from "../candelabra.ts";
import { defineRecipe, type Prop, type Recipe } from "../../prop.ts";

// the kit recipes are extended by spreading them; their refs types are private to their files
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecipe = Recipe<any, any>;

// ---------------------------------------------------------------------------------

export interface ChapelDoorParams extends DoorParams {
  /** Seconds after it swings open before it carries you through (<0: wait for a second E). */
  auto: number;
  /** A bell (prop id in the same room) that rings once when the latch is released. */
  bell: string;
}

const D = door.states;

export const chapelDoor = defineRecipe<ChapelDoorParams, unknown>({
  ...(door as AnyRecipe),
  id: "chapelDoor",
  reason: "The chapel's doors (big, a red ribbon, never locked) and the balcony's red-marked sky door, whose rail released from this side rings the bell and opens the way home to the keeper's loft (S4).",
  defaults: { ...door.defaults, auto: 0.45, bell: "" },
  states: {
    ...(D as Record<string, unknown>),
    unlatching: {
      ...D["unlatching"],
      enter(c: Prop, from: string) {
        D["unlatching"]!.enter!(c as never, from);
        const bell = String(c.params["bell"] ?? "");
        if (bell) c.world.find(bell)?.act("ring", 1);
      },
    },
    open: {
      ...D["open"],
      enter(c: Prop, from: string) {
        D["open"]!.enter!(c as never, from);
        // opened by you just now: carry you through once it stands open
        c.data["carry"] = from === "opening" && Number(c.params["auto"] ?? -1) >= 0;
      },
      update(c: Prop) {
        if (c.data["carry"] && c.t >= Number(c.params["auto"] ?? 0)) {
          c.data["carry"] = false;
          c.emit({ type: "door", action: "enter" });
        }
      },
    },
  } as never,
  demo: {
    indoor: true,
    w: 10,
    params: { kind: "sky", latch: "near", mark: true, auto: -1 },
    variants: [{ label: "the chapel's big doors", params: { kind: "big", latch: "none", mark: false, auto: -1 }, dx: -3.5 }],
    script: [
      { label: "the sky door, its rail bolted on this side", wait: 0.8 },
      { label: "E: the rail drops, it opens", use: true, wait: 2.6 },
      { label: "E on the big doors", variant: "the chapel's big doors", use: true, wait: 1.6 },
    ],
  },
});

// ---------------------------------------------------------------------------------

export const naveRule = defineRecipe<Record<string, never>, null>({
  id: "naveRule",
  breakage: "never",
  reason: "The nave rule (WORLD-PLAN E3): in the room that holds the art, hits only sway, flicker or ring things; nothing fractures. Invisible; it switches its room's pixel matter to sway-only.",
  defaults: {},
  build: () => null,
  initial: "on",
  states: {
    on: {
      enter(c) {
        c.world.breakage = "sway";
      },
    },
  },
});

// ---------------------------------------------------------------------------------

interface PathLampExtra {
  /** The shrine lantern (prop id in this room) whose lighting lights this lamp. */
  shrine: string;
  /** Place in the line: lamps come on this many steps after the shrine. */
  order: number;
}

const L = lampPost.states;

export const pathLamp = defineRecipe<typeof lampPost.defaults & PathLampExtra, unknown>({
  ...(lampPost as AnyRecipe),
  id: "pathLamp",
  reason: "Lamp posts down the pilgrim path to the chapel: dark until shrine 5 is lit, then on one after another toward the porch (WORLD-PLAN E1).",
  defaults: { ...lampPost.defaults, lit: false, shrine: "shrine-5", order: 0 },
  initial: "off",
  states: {
    ...(L as Record<string, unknown>),
    off: {
      ...L["off"],
      update(c: Prop, dt: number) {
        L["off"]!.update!(c as never, dt);
        const s = c.world.find(String(c.params["shrine"] ?? ""));
        if (!s || (s.state !== "lit" && s.state !== "lighting")) return;
        // lit for the save already: on at once; lit just now: in a line down the path
        const now = s.state === "lighting";
        c.act("light", now ? 1.2 + Number(c.params["order"] ?? 0) * 0.55 : 0);
      },
    },
  } as never,
});

// ---------------------------------------------------------------------------------

export const naveBench = defineRecipe<typeof bench.defaults, unknown>({
  ...(bench as AnyRecipe),
  id: "naveBench",
  reason: "Pews in the Chapel of Light; one of them is the seat to sit and look at the works (the room's sit spot holds the camera on them).",
  use: undefined,
});

// ---------------------------------------------------------------------------------

const C = candles.states;

/**
 * votives: the kit's prayer candles for places where E belongs to something
 * else (the candles at the foot of the niches: E there opens the work). No E of
 * their own; a flame the wind or a hit put out relights by itself a few
 * seconds later (the plan's "gutter out and relight").
 */
export const votives = defineRecipe<typeof candles.defaults, unknown>({
  ...(candles as AnyRecipe),
  id: "votives",
  reason: "Prayer candles at the foot of the works in the Chapel of Light: they flicker, gutter when struck or dashed past, and relight themselves (E stays with the work above them).",
  use: undefined,
  states: {
    ...(C as Record<string, unknown>),
    lit: {
      ...C["lit"],
      update(c: Prop, dt: number) {
        C["lit"]!.update!(c as never, dt);
        const out = (c.refs as { flames: { target: number }[] }).flames.some((f) => f.target === 0);
        c.data["dark"] = out ? Number(c.data["dark"] ?? 0) + dt : 0;
        if (Number(c.data["dark"]) > 5) {
          c.data["dark"] = 0;
          c.go("relighting");
        }
      },
      use: undefined,
    },
    out: { ...C["out"], use: undefined, after: [5, "relighting"] },
  } as never,
});

const K = candelabra.states;

/** Seconds a candelabra flame stays out before it relights by itself. */
const RELIGHT_AFTER = 5;

export const naveCandelabra = defineRecipe<CandelabraParams, unknown>({
  ...(candelabra as AnyRecipe),
  id: "naveCandelabra",
  reason: "Standing candelabras in the Chapel of Light: they gutter when struck or dashed past and relight themselves a few seconds later, so the nave never stays dark after a fight (E relights at once).",
  states: {
    ...(K as Record<string, unknown>),
    lit: {
      ...K["lit"],
      update(c: Prop, dt: number) {
        K["lit"]!.update!(c as never, dt);
        if (c.state !== "lit") return;
        const out = (c.refs as { flames: { target: number }[] }).flames.some((f) => f.target === 0);
        c.data["dark"] = out ? Number(c.data["dark"] ?? 0) + dt : 0;
        if (Number(c.data["dark"]) > RELIGHT_AFTER) {
          c.data["dark"] = 0;
          c.go("relighting");
        }
      },
    },
    out: { ...K["out"], after: [RELIGHT_AFTER, "relighting"] },
  } as never,
});

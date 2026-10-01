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
// wallSet     the DOOR RULE for kit fittings that draw their own grey stone
//             surround (the pilgrim path's stained glass): an invisible prop
//             that re-cuts the named props' frames in the material of the
//             wall they are set in, once, and keeps it through their mending.
// naveBench   the kit's pew without its own E, for a spot where the room's
//             "sit and look" seat (the runtime's sit, holding the camera on
//             the works) is the thing you use; its seat is not a platform,
//             so you walk past it on the floor instead of standing on it.

import "./materials.ts";
import { door, type DoorParams } from "../door.ts";
import { lampPost } from "../lampPost.ts";
import { bench } from "../bench.ts";
import { candles } from "../candles.ts";
import { candelabra, type CandelabraParams } from "../candelabra.ts";
import { defineRecipe, type Prop, type PropBuilder, type Recipe } from "../../prop.ts";
import { resolveMat } from "../../materials.ts";

// the kit recipes are extended by spreading them; their refs types are private to their files
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecipe = Recipe<any, any>;

// ---------------------------------------------------------------------------------

export interface ChapelDoorParams extends DoorParams {
  /** Seconds after it swings open before it carries you through (<0: wait for a second E). */
  auto: number;
  /** A bell (prop id in the same room) that rings once when the latch is released. */
  bell: string;
  /**
   * The wall around it is drawn by the room's backdrop (the recess, its orders or lintel, the
   * reveal, the threshold): the kit's frame is not drawn at all, only the leaf, set back in the
   * backdrop's opening (the nave's west doors, the balcony's sky door).
   */
  wall: boolean;
}

const D = door.states;

/**
 * The DOOR RULE (Dex, 2026-10-01): a door is built into its wall, never a sprite pasted on it. The kit
 * draws its frame in its generic grey stone; here the same frame (same geometry, same arch) is re-cut
 * in the chapel's own ashlar, and a dark reveal a few pixels wider sits behind it, so the jambs and
 * arch read as the inner order of the wall's recessed portal (the backdrop draws the outer orders,
 * the hood and the step around it) and the leaf sits back in the wall's thickness.
 */
function buildIntoWall(b: PropBuilder, p: ChapelDoorParams): void {
  if (p.wall) {
    // the backdrop cut the opening: no frame, no threshold of the kit's, nothing to hit there
    const fr = b.get("frame");
    fr.visible = false;
    fr.hittable = false;
    // no rim hairline round the leaf: its edge meets the backdrop's dark reveal directly
    b.get("leaf").outline = 0;
    return;
  }
  if (p.frame !== "stone") return;
  const g = b.get("frame").grid;
  const map = new Map<number, number>([
    [resolveMat("stone").id, resolveMat("chapelStone").id],
    [resolveMat("stoneLight").id, resolveMat("chapelStoneLight").id],
    [resolveMat("stoneDark").id, resolveMat("chapelStoneDark").id],
  ]);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = g.inner(x, y);
      const m = map.get(g.mat[i]!);
      if (m !== undefined) g.mat[i] = m;
    }
  }
  const u = (f: number): number => b.u(f);
  const big = p.kind === "big" || p.kind === "gate" || p.kind === "shutter";
  const w = u(big ? 2.5 : 0.7), h = u(big ? 4 : 1.4);
  const FW = w + u(big ? 0.22 : 0.12) * 2, FH = h + u(big ? 0.3 : 0.14);
  const fx = Math.floor(FW / 2), R = 4;
  // R px of shadowed reveal beyond the jambs and over the arch, down to the floor
  const rv = b.part("reveal", { w: FW + R * 2, h: FH + R, pivot: [fx + R, FH + R], at: [0, 0], layer: "bg", z: 2, hittable: false, outline: 0 });
  if (p.kind === "big") rv.arch(0, 0, FW + R * 2, FH + R, { mat: "soot", profile: "flat", pointed: 0.62 });
  else rv.rect(0, 0, FW + R * 2, FH + R, { mat: "soot", profile: "flat" });
}

export const chapelDoor = defineRecipe<ChapelDoorParams, unknown>({
  ...(door as AnyRecipe),
  id: "chapelDoor",
  reason: "The chapel's doors (big, a red ribbon, never locked) and the balcony's red-marked sky door, whose rail released from this side rings the bell and opens the way home to the keeper's loft (S4).",
  defaults: { ...door.defaults, auto: 0.45, bell: "", wall: false },
  build(b, p) {
    const refs = (door as AnyRecipe).build(b, p);
    buildIntoWall(b, p as ChapelDoorParams);
    return refs;
  },
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
  reason: "Pews in the Chapel of Light and the balcony's bench; one of them is the seat to sit and look (the room's sit spot holds the camera on the view). Not stood on: you walk past them on the floor.",
  use: undefined,
  build(b, p) {
    const refs = (bench as AnyRecipe).build(b, p);
    // the seat is not a platform here: standing on a pew seen from its back read as floating in front
    // of it (and on the balcony it put her behind the balustrade); the sit spot does the sitting
    b.get("seat").collide = "none";
    return refs;
  },
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

// ---------------------------------------------------------------------------------

export interface WallSetParams {
  /** Prop ids (in this room) whose surround is re-cut. */
  props: string[];
  /** The part to re-cut. */
  part: string;
  /** The wall's material; its "Dark" twin takes the kit's dark stone. */
  to: string;
}

export const wallSet = defineRecipe<WallSetParams, null>({
  id: "wallSet",
  breakage: "never",
  reason: "The DOOR RULE (Dex): a window set in a wall is cut from that wall, never a grey frame stuck on it. Invisible: re-cuts the kit glass's stone surround in the wall's own material (and keeps it when the stone mends).",
  defaults: { props: [], part: "frame", to: "hullStone" },
  build: () => null,
  initial: "on",
  states: {
    on: {
      update(c) {
        if (c.data["done"]) return;
        const p = c.params as unknown as WallSetParams;
        const to = resolveMat(p.to).id;
        const dark = resolveMat(`${p.to}Dark`).id;
        const kit = new Map<number, number>([
          [resolveMat("stone").id, to],
          [resolveMat("stoneLight").id, to],
          [resolveMat("stoneDark").id, dark],
        ]);
        let all = true;
        for (const id of p.props) {
          const q = c.world.find(id);
          if (!q) {
            all = false;
            continue;
          }
          q.paint(p.part, (_x, _y, m) => {
            const n = kit.get(m);
            return n === undefined ? undefined : n === to ? p.to : `${p.to}Dark`;
          });
          // the re-cut stone is what it mends back to
          q.part(p.part).grid.snapshot();
        }
        c.data["done"] = all;
      },
    },
  },
});

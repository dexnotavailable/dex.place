// The rope bridge over the reed channel (lane R-B, B1; shortcut S1). A plank
// deck, hinged on the east bank, stands hauled up at an angle over the
// channel: a haul line runs from its free end over a pulley on the tall east
// mast, along the arm, and down the mast's east face to a cleat at hand
// height. From the west you can only wade. From the east bank, slash the
// line at the cleat: it parts, the haul line runs free, and the deck swings
// down across the channel, slams onto the west post, bounces once and lies
// there, walkable, for good (persisted `cut`; the room mirrors it to the
// world flag cut:rope-bridge).
//
// States: raised, falling, lowered. The deck is a platform only when it is
// down (pixel matter never blocks the way). Breakage "cut": the line stays
// cut; hits splinter the wood and it mends. Origin: the hinge on the east
// bank, at the deck's top (the walking height).

import { hitCentre, type Hit } from "../../hits.ts";
import { puff } from "../../kit.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { Rope } from "../../motion.ts";
import "./materials.ts";

export interface BridgeParams {
  /** Channel span in H (the deck's length). */
  span: number;
  /** Mast height above the deck in H. */
  mast: number;
  /** Raised angle, radians. */
  angle: number;
}

interface Refs {
  deck: Part;
  tail: Rope;
  haul: Rope;
  a: number;
  w: number;
  a0: number;
  mastX: number;
  bounced: number;
}

const G_H = 17.5; // gravity in H/s^2 (the engine's)

export const ropeBridge = defineRecipe<BridgeParams, Refs>({
  id: "ropeBridge",
  breakage: "cut",
  reason: "The old lowering bridge over the reed channel, hauled up from the far bank: cut its line once from the east side and the slow wade is behind you for good (shortcut S1).",
  defaults: { span: 6, mast: 5.4, angle: 0.9 },
  persist: ["cut"],
  cues: ["rope.cut", "bridge.fall", "bridge.slam", "wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.span);
    const mh = u(p.mast);
    // --- the mast: a tall post just east of the hinge, an arm west with a pulley, a brace, the cleat
    const west = u(0.55), east = u(0.4), below = u(0.24);
    const mw = west + east, mhh = mh + below + u(0.1);
    const mast = b.part("mast", { w: mw, h: mhh, pivot: [west, mh + u(0.1)], at: [0, 0], layer: "bg", z: 3 });
    const px = (x: number): number => west + x; // prop-local x -> mast grid x
    const py = (y: number): number => mh + u(0.1) + y; // prop-local y -> mast grid y
    mast.rect(px(u(0.02)), py(-mh), u(0.15), mh + below, { mat: "plainWood", profile: "cylV" });
    mast.grain({ dir: "v", seed: p.seed, tone: -1, density: 0.3, region: { x0: px(u(0.02)), y0: py(-mh), x1: px(u(0.17)), y1: py(below) } });
    // the arm and its brace
    mast.rect(px(-u(0.46)), py(-mh + u(0.06)), u(0.63), u(0.08), { mat: "plainWood", profile: "cylH", z: 1 });
    mast.stroke([px(-u(0.28)), py(-mh + u(0.13)), px(u(0.04)), py(-mh + u(0.62))], u(0.05), { mat: "plainWoodDark", z: 1 });
    // pulley at the arm's west end, sheave at the mast top (iron)
    mast.circle(px(-u(0.4)), py(-mh + u(0.19)), u(0.075), { mat: "plainIron", profile: "dome", r: 3, z: 2 });
    mast.circle(px(-u(0.4)), py(-mh + u(0.19)), 2, { mat: "plainWoodDark", profile: "flat", z: 3 });
    mast.circle(px(u(0.17)), py(-mh + u(0.12)), u(0.05), { mat: "plainIron", profile: "dome", r: 2, z: 2 });
    // the line along the arm, pulley to sheave
    mast.rect(px(-u(0.4)), py(-mh + u(0.1)), u(0.58), 2, { mat: "plainRope", profile: "cylH", z: 2, noInk: true });
    // the cleat on the east face, with a red rag tied round it (the route's red)
    mast.rect(px(u(0.17)), py(-u(0.98)), u(0.05), u(0.05), { mat: "plainIron", profile: "bevel", z: 2 });
    mast.rect(px(u(0.14)), py(-u(1.03)), u(0.13), u(0.03), { mat: "plainIron", profile: "cylH", z: 3 });
    mast.rect(px(u(0.16)), py(-u(0.9)), u(0.06), u(0.12), { mat: "clothRed", profile: "flat", z: 3 });
    // hinge straps
    mast.rect(px(-u(0.08)), py(-u(0.02)), u(0.2), u(0.06), { mat: "plainIron", profile: "bevel", z: 2 });
    mast.rivets([[px(-u(0.05)), py(u(0.01))], [px(u(0.08)), py(u(0.01))]], { mat: "plainIron", r: 1 });
    // --- the deck (a platform when down) with its rail posts as a child
    const th = u(0.14);
    const deck = b.part("deck", { w: L + u(0.06), h: th, pivot: [L, 0], at: [0, 0], layer: "mid", z: 4, collide: "none", smoothRotate: true });
    deck.rect(0, 0, L, u(0.05), { mat: "plainWood", profile: "bevel", r: 1 });
    for (let x = 0; x < L; x += u(0.1)) deck.rect(x, 0, 1, u(0.05), { mat: "plainWoodDark", mode: "paint" });
    deck.rect(0, u(0.05), L, th - u(0.05), { mat: "plainWoodDark", profile: "cylH" });
    deck.grain({ dir: "h", seed: p.seed + 1, tone: -1, density: 0.25 });
    deck.rivets(Array.from({ length: Math.floor(L / u(0.6)) }, (_, i) => [u(0.3) + i * u(0.6), u(0.09)] as [number, number]), { mat: "plainIron", r: 1 });
    deck.wear({ amount: 0.25, seed: p.seed + 2 });
    const rh = u(0.32);
    const rails = b.part("rails", { w: L + u(0.06), h: rh + 2, pivot: [L, rh + 2], at: [L, 0], parent: "deck", layer: "mid", z: 3, collide: "none", smoothRotate: true, hittable: false });
    for (let x = u(0.04); x < L - u(0.1); x += u(0.75)) rails.rect(x, 2, u(0.05), rh, { mat: "plainWood", profile: "cylV" });
    for (let x = u(0.04); x < L - u(0.8); x += u(0.75)) {
      const x2 = Math.min(L - u(0.1), x + u(0.75));
      for (let k = 0; k <= x2 - x; k++) {
        const t = k / (x2 - x);
        rails.pixels([[x + k, 4 + Math.round(Math.sin(Math.PI * t) * u(0.06))]], { mat: "plainRope", profile: "flat" });
      }
    }
    // --- the ropes: the tail (mast top down to the cleat: the one you cut) and the haul line (pulley to the deck's end)
    const a0 = p.angle;
    const tipX = -L * Math.cos(a0), tipY = -L * Math.sin(a0);
    const { rope: tail } = b.rope("tail", { from: [u(0.2), -mh + u(0.16)], to: [u(0.2), -u(1.0)], segments: 20, slack: 1.01, mat: "plainRope", width: 2, pinStart: true, pinEnd: true, layer: "bg", reach: u(0.6) });
    const { rope: haul } = b.rope("haul", { from: [-u(0.4), -mh + u(0.27)], to: [tipX, tipY], segments: 18, slack: 1.0, mat: "plainRope", width: 2, pinStart: true, pinEnd: true, layer: "mid", reach: L });
    return { deck: b.get("deck"), tail, haul, a: a0, w: 0, a0, mastX: 0, bounced: 0 };
  },
  initial: (c) => (c.data["cut"] ? "lowered" : "raised"),
  states: {
    raised: {
      enter(c) {
        c.refs.a = c.refs.a0;
        pose(c);
      },
      update(c) {
        pose(c);
      },
      hit(c, h) {
        if (cutFromEast(c, h.hit)) return "falling";
        c.damage(h.hit);
      },
    },
    falling: {
      sound: "bridge.fall",
      enter(c) {
        c.data["cut"] = true;
        c.refs.w = 0;
        c.refs.bounced = 0;
        // the haul line runs free through the pulley and trails from the deck's end
        c.refs.haul.pins[0] = null;
        c.refs.haul.wake();
        c.refs.tail.wake();
      },
      update(c, dt) {
        const r = c.refs;
        const L = c.params.H * (c.params["span"] as number);
        const k = (3 * G_H * c.params.H) / (2 * L);
        r.w -= k * Math.cos(r.a) * dt * (c.world.reduced ? 0.7 : 1);
        r.a += r.w * dt;
        if (r.a <= 0) {
          r.a = 0;
          if (r.w < -0.35 && r.bounced < 2) {
            r.w = -r.w * 0.28;
            r.bounced++;
            c.sound("bridge.slam", r.bounced === 1 ? 1 : 0.5);
            const [x, y] = r.deck.toWorld(u0(c), 0);
            puff(c.world, "water", x, y + c.params.H * 0.2, 10, [0, -1], { speed: 1 });
            puff(c.world, "dust", x, y, 5, [0, -1], { speed: 0.6 });
            if (r.bounced === 1) c.emit({ type: "shake", amplitude: 1, duration: 0.25 });
          } else {
            pose(c);
            c.go("lowered");
            return;
          }
        }
        pose(c);
      },
    },
    lowered: {
      enter(c, from) {
        const r = c.refs;
        r.a = 0;
        r.deck.collide = "platform";
        if (from !== "falling") {
          // built already cut: the tail hangs in two pieces, the haul line lies slack from the deck's end
          const mid = Math.floor(r.tail.n * 0.7);
          r.tail.cut[mid] = 1;
          r.haul.pins[0] = null;
          c.data["cut"] = true;
        }
        pose(c);
      },
      update(c) {
        pose(c);
      },
      hit(c, h) {
        c.damage(h.hit);
      },
    },
  },
  demo: {
    w: 10,
    params: { span: 6 },
    script: [
      { label: "raised: hauled up against the mast", wait: 1 },
      { label: "slash from the west side: nothing parts", hit: "slash", from: -0.6, face: 1, wait: 1 },
      { label: "slash the line at the cleat from the east", hit: "slash", from: 0.9, face: -1, wait: 3.5 },
      { label: "lowered, walkable, stays cut", wait: 1 },
    ],
  },
});

/** The deck's west end in its own grid (x 0). */
function u0(_c: Prop<Refs>): number {
  return 0;
}

/** Deck angle -> part rotation, and the haul line's end follows the deck's free end. */
function pose(c: Prop<Refs>): void {
  const r = c.refs;
  r.deck.rot = r.a;
  r.deck.updateTransform();
  const [x, y] = r.deck.toWorld(0, 0);
  const n = r.haul.n - 1;
  const p = r.haul.pins[n];
  if (!p || Math.abs(p[0] - x) > 0.5 || Math.abs(p[1] - y) > 0.5) {
    r.haul.pins[n] = [x, y];
    r.haul.wake();
  }
}

/**
 * A cut counts only from the east bank: the hit must land on the mast's east
 * side (the cleat is there, and the post shields it from the channel), and
 * it must actually part the tail line.
 */
function cutFromEast(c: Prop<Refs>, hit: Hit): boolean {
  const s = hit.shape;
  const hx = s.kind === "arc" || s.kind === "circle" ? s.x : hitCentre(s)[0];
  if (hx < c.x + c.params.H * 0.05) return false;
  const before = c.refs.tail.isCut;
  c.cut(hit, { ropes: true, cloth: false });
  const parted = !before && c.refs.tail.isCut;
  if (parted) c.sound("rope.cut", 1);
  return parted;
}

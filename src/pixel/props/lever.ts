// Lever: the three shortcut levers (the crane at the Hollow Mouth, the
// culvert gate, the Crown's express lift). An iron handle with a red grip
// (the route's red) in a slotted base; E pulls it over with a clank. It
// stays pulled for the save and emits { type: "lever", on } for the host,
// which moves the gate or the lift. mount: "floor" or "wall" (a box on the
// wall at hand height). Never breaks. Origin: floor, centre (wall: the box's
// centre).

import { EASE } from "../util.ts";
import { puff } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

export interface LeverParams {
  mount: "floor" | "wall";
  on: boolean;
}

interface Refs {
  handle: Part;
  f: number;
}

const OFF = -0.62, ON = 0.62;

export const lever = defineRecipe<LeverParams, Refs>({
  id: "lever",
  breakage: "never",
  reason: "The shortcut levers: pulling one opens a way that stays open (the culvert, the crane, the express lift), so a returning visitor is never far from anywhere.",
  defaults: { mount: "floor", on: false },
  use: { reach: 0.6, prompt: "pull" },
  persist: ["on"],
  cues: ["lever.pull", "lever.clank", "lever.stuck"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const wall = p.mount === "wall";
    const bw = u(wall ? 0.3 : 0.42), bh = u(wall ? 0.34 : 0.14);
    const base = b.part("base", { w: bw, h: bh, pivot: [bw >> 1, wall ? bh >> 1 : bh], at: [0, 0], layer: wall ? "bg" : "mid", z: 6 });
    if (wall) {
      base.rect(0, 0, bw, bh, { mat: "iron", profile: "bevel", r: 2, depth: 3 });
      base.rect(3, 3, bw - 6, bh - 6, { mat: "rust", mode: "paint", tone: -1 });
      base.rect((bw >> 1) - 2, 4, 4, bh - 8, { mat: "soot", profile: "sunk", r: 1, depth: 2, piece: "slot" });
      base.rivets([[3, 3], [bw - 4, 3], [3, bh - 4], [bw - 4, bh - 4]], { mat: "brass", r: 1 });
    } else {
      base.poly([0, bh, bw, bh, bw - u(0.06), u(0.04), u(0.06), u(0.04)], { mat: "iron", profile: "bevel", r: 3, depth: 4 });
      base.rect(u(0.1), u(0.02), bw - u(0.2), u(0.04), { mat: "soot", profile: "sunk", r: 1, depth: 2, piece: "slot" });
      base.rivets([[u(0.05), bh - 3], [bw - u(0.05), bh - 3]], { mat: "brass", r: 1 });
      base.speckle({ amount: 0.12, seed: p.seed, tone: -1 });
    }
    // the handle turns about its root in the slot
    const hl = u(wall ? 0.34 : 0.5), hw = u(0.1);
    const hd = b.part("handle", { w: hw, h: hl, pivot: [hw >> 1, hl], at: [0, wall ? 0 : -u(0.05)], layer: wall ? "bg" : "mid", z: 7, smoothRotate: true });
    hd.rect((hw >> 1) - 2, u(0.1), 4, hl - u(0.1), { mat: "iron", profile: "cylV" });
    hd.roundRect((hw >> 1) - u(0.035), 0, u(0.07), u(0.13), 3, { mat: "clothRed", profile: "dome", r: 3, z: 2, piece: "grip" });
    hd.circle(hw >> 1, hl - 2, 3, { mat: "iron", profile: "dome", r: 2, z: 2, piece: "hub" });
    const on = p.on;
    b.get("handle").rot = on ? ON : OFF;
    return { handle: b.get("handle"), f: on ? 1 : 0 };
  },
  initial: (c) => (c.data["on"] || c.params["on"] ? "on" : "off"),
  states: {
    off: {
      enter(c) {
        c.refs.f = 0;
        c.refs.handle.rot = OFF;
      },
      use: () => "pulling",
      hit: (c, h) => wobble(c, h.hit.type),
    },
    pulling: {
      sound: "lever.pull",
      update(c, dt) {
        const r = c.refs;
        r.f = Math.min(1, r.f + dt / 0.5);
        r.handle.rot = (OFF + (ON - OFF) * EASE["inOutCubic"]!(r.f));
        if (r.f >= 1) c.go("on");
      },
    },
    on: {
      enter(c, from) {
        c.refs.f = 1;
        c.refs.handle.rot = ON;
        c.data["on"] = true;
        if (from === "pulling") {
          c.sound("lever.clank", 1);
          c.emit({ type: "lever", on: true });
          const [x, y] = c.refs.handle.toWorld(c.refs.handle.pivotX, c.refs.handle.pivotY);
          puff(c.world, "dust", x, y, 5, [0, -1], { speed: 0.4 });
          c.refs.handle.shake = 0.15;
        }
      },
      // pulled for good: E only clanks it
      use(c) {
        c.sound("lever.stuck", 0.6);
        c.refs.handle.shake = 0.1;
      },
      hit: (c, h) => wobble(c, h.hit.type),
    },
  },
  actions: {
    /** Set by the story or the save without the animation. */
    set: (c, arg) => {
      c.data["on"] = !!arg;
      return arg ? "on" : "off";
    },
  },
  demo: {
    w: 4,
    variants: [{ label: "wall box", params: { mount: "wall" }, dx: 1.5, at: 1.0 }],
    script: [
      { label: "off", wait: 0.6 },
      { label: "E: pull", use: true, wait: 1.2 },
      { label: "E again: it stays (saved)", use: true, wait: 0.8 },
      { label: "hit: shakes, never breaks", hit: "slash", from: -0.8, wait: 1 },
    ],
  },
});

function wobble(c: Prop<Refs>, type: string): void {
  if (type === "wind") return;
  c.refs.handle.shake = 0.2;
  c.sound("metal.hit", 0.6);
}

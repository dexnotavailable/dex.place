// The registry counter in the keeper's lodge (WORLD-PLAN A3): a worn plank
// counter with the keeper's ledger open on it and a small brass bell. E on the
// counter or the ledger opens the dex account panel (the same account state
// as the website; never a fake session). The bell rings when used or struck,
// and the keeper looks up from her ledger. Never breaks (a service object):
// hits dent and ring, the pages lift in a dash. Origin: floor, the counter's
// middle; its top is a platform at 0.55 H (WORLD-PLAN section 1).

import "./materials.ts";
import { puff } from "../../kit.ts";
import { Pendulum, Spring } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";

export interface CounterParams {
  /** Length in H. */
  length: number;
  /** The keeper prop's id (she looks up when the bell rings). */
  keeper: string;
}

interface Refs {
  top: Part;
  bell: Part;
  ledger: Part;
  page: Part;
  ring: Pendulum;
  lift: Spring;
}

export const registryCounter = defineRecipe<CounterParams, Refs>({
  id: "registryCounter",
  breakage: "never",
  reason: "The keeper's counter: her ledger is where the dex account lives in the world, twenty seconds from the dock, and the bell is how you ask for her.",
  defaults: { length: 2.4, keeper: "keeper" },
  use: { reach: 0.5, prompt: "account" },
  cues: ["bell.ring", "paper.turn", "metal.hit", "wood.hit"],
  standard: { h: 0.55, parts: ["top"], note: "counter top" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.length), T = u(0.55);
    const cx = L >> 1;
    // the counter: a front of vertical boards with a kick plate, a thick top with a lit edge
    const front = b.part("front", { w: L, h: T, pivot: [cx, T], at: [0, 0], layer: "mid", z: 6 });
    front.rect(u(0.04), u(0.06), L - u(0.08), T - u(0.06), { mat: "wood", profile: "flat", depth: 2, piece: "boards" });
    for (let x = u(0.04) + u(0.18); x < L - u(0.08); x += u(0.18)) front.rect(x, u(0.08), 1, T - u(0.14), { mat: "wood", mode: "paint", tone: -2 });
    front.rect(u(0.04), T - u(0.08), L - u(0.08), u(0.08), { mat: "woodDark", profile: "bevel", r: 2, depth: 3, z: 1, piece: "kick" });
    front.rect(u(0.1), u(0.16), L - u(0.2), u(0.2), { mat: "woodDark", profile: "sunk", depth: 1, z: 1, piece: "panel" });
    front.grain({ dir: "v", seed: p.seed, mats: ["wood"], stretch: 12 });
    front.wear({ amount: 0.02, seed: p.seed + 1 });
    const top = b.part("top", { w: L + u(0.12), h: u(0.07), pivot: [(L + u(0.12)) >> 1, u(0.07)], at: [0, -T + u(0.06)], layer: "mid", z: 7, collide: "platform" });
    top.rect(0, 0, L + u(0.12), u(0.07), { mat: "wood", profile: "bevel", r: 2, depth: 3 });
    top.rect(0, 0, L + u(0.12), 1, { mat: "wood", mode: "paint", tone: 1 });
    top.grain({ dir: "h", seed: p.seed + 2, stretch: 20, mats: ["wood"] });
    // the ledger: an open book, a ribbon; one page is its own part (it lifts in a dash)
    const lw = u(0.44), lh = u(0.07);
    const ledger = b.part("ledger", { w: lw, h: lh, pivot: [lw >> 1, lh], at: [-u(0.35), -T], layer: "mid", z: 8 });
    ledger.poly([0, lh, lw, lh, lw - 2, 2, (lw >> 1) + 1, 3, (lw >> 1) - 1, 3, 2, 2], { mat: "parchment", profile: "bevel", r: 2, depth: 2, piece: "pages" });
    ledger.rect(0, lh - 2, lw, 2, { mat: "leatherDark", profile: "cylH", z: 1, piece: "cover" });
    for (let k = 0; k < 4; k++) ledger.rect(4 + k * 3, 3 + (k & 1), u(0.12), 1, { mat: "mapInk", mode: "paint" });
    ledger.rect(lw >> 1, 2, 1, lh - 2, { mat: "clothRed", z: 2, piece: "ribbon" });
    const pw = Math.round(lw / 2) - 3;
    const page = b.part("page", { w: pw, h: 4, pivot: [0, 3], at: [-u(0.35), -T - lh + 3], layer: "mid", z: 9, smoothRotate: true });
    page.rect(0, 1, pw, 2, { mat: "parchment", profile: "flat" });
    // the bell: a small brass dome on a stand; the dome swings when rung
    const bw = u(0.12), bh = u(0.09);
    const stand = b.part("stand", { w: bw, h: 3, pivot: [bw >> 1, 3], at: [u(0.55), -T], layer: "mid", z: 8 });
    stand.roundRect(0, 0, bw, 3, 1, { mat: "woodDark", profile: "bevel", r: 1 });
    const bell = b.part("bell", { w: bw, h: bh, pivot: [bw >> 1, 1], at: [u(0.55), -T - bh - 1], layer: "mid", z: 9, smoothRotate: true });
    bell.ellipse(bw / 2, bh - 1, bw / 2 - 1, bh - 2, { mat: "brass", profile: "dome", r: 3, piece: "dome" });
    bell.rect(0, bh - 2, bw, 2, { mat: "brass", profile: "cylH", z: 1, piece: "lip" });
    bell.rect((bw >> 1) - 1, 0, 2, 2, { mat: "brass", profile: "dome", r: 1, z: 2, piece: "knob" });
    return { top: b.get("top"), bell: b.get("bell"), ledger: b.get("ledger"), page: b.get("page"), ring: new Pendulum(u(0.05), u(17.5), 3), lift: new Spring(60, 6) };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => step(c, dt),
      use(c) {
        ringBell(c, 1);
        c.sound("paper.turn", 0.5);
        c.emit({ type: "panel", panel: "account" });
      },
      hit(c, h) {
        if (h.hit.type === "wind") {
          c.refs.lift.impulse(-6);
          return;
        }
        // the bell rings from any blow that reaches it; the wood only darkens and mends
        ringBell(c, h.hit.type === "slash" || h.hit.type === "point" ? 0.8 : 1.4);
        c.damage(h.hit);
      },
    },
  },
  demo: {
    w: 5,
    indoor: true,
    with: [{ id: "keeper", dx: 0.1, at: 0 }],
    script: [
      { label: "the counter, the ledger, the bell", wait: 1 },
      { label: "E: the bell rings, the account panel opens", use: true, wait: 1.6 },
      { label: "slash: the bell rings, the keeper looks up", hit: "slash", from: 1.2, face: -1, wait: 1.6 },
      { label: "dash: the page lifts", hit: "wind", from: 1.4, face: -1, wait: 1.6 },
    ],
  },
});

function ringBell(c: Prop<Refs>, k: number): void {
  c.refs.ring.impulse(k * 3);
  c.sound("bell.ring", 0.35 * k);
  const [x, y] = c.refs.bell.toWorld(c.refs.bell.pivotX, c.refs.bell.pivotY + 4);
  puff(c.world, "spark", x, y, 2, [0, -1], { speed: 0.3, spread: 1 });
  const keeper = c.world.find(String(c.params["keeper"] ?? "keeper"));
  if (keeper && keeper.state === "working") keeper.go("acknowledging");
}

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  if (!r.ring.resting) {
    r.ring.step(dt);
    r.bell.rot = Math.max(-0.6, Math.min(0.6, r.ring.angle));
  }
  if (!r.lift.resting) {
    r.lift.step(dt);
    r.page.rot = Math.max(-1.2, Math.min(0, r.lift.x * 0.2));
  }
}

// Censer on a chain (lane R-E, the nave): a brass thurible hung from an iron
// bracket on a pier. It swings like a pendulum when hit or dashed past and
// trails a thin smoke that drifts up through the coloured light, then
// settles. Never breaks (the nave keeps every cell). Origin: the bracket's
// mount on the wall.

import "./materials.ts";
import { puff } from "../../kit.ts";
import type { Rope } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { Hit } from "../../hits.ts";

export interface CenserParams {
  /** Chain length in H. */
  drop: number;
  /** Bracket arm reach in H (the censer hangs this far out from the pier). */
  arm: number;
}

interface Refs {
  body: Part;
  rope: Rope;
  puffT: number;
}

export const censer = defineRecipe<CenserParams, Refs>({
  id: "censer",
  breakage: "never",
  reason: "Incense in the Chapel of Light: its smoke drifts up through the rose window's shafts and shows the light, and it swings when struck (WORLD-PLAN E3).",
  defaults: { drop: 1.5, arm: 0.55 },
  cues: ["censer.chain"],
  feel: 0.8,
  build(b, p) {
    const u = (f: number): number => b.u(f);
    // the bracket: a wall plate, a scrolled arm, a hook at its tip
    const aw = u(p.arm) + 6, ah = u(0.34);
    const br = b.part("bracket", { w: aw, h: ah, pivot: [0, ah >> 1], at: [0, 0], layer: "bg", z: 8, hittable: false });
    br.rect(0, 0, 5, ah, { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "plate" });
    br.rivets([[2, 3], [2, ah - 4]], { mat: "iron", r: 1.1 });
    br.stroke([4, ah >> 1, aw - 3, (ah >> 1) - 1], 3, { mat: "iron", profile: "cylH", piece: "arm" });
    // the scroll under the arm
    br.stroke([5, ah - 3, Math.round(aw * 0.35), ah - 4, Math.round(aw * 0.55), (ah >> 1) + 1], 2, { mat: "iron", profile: "cylH", piece: "scroll" });
    br.rect(aw - 4, (ah >> 1) - 1, 2, 5, { mat: "iron", profile: "cylV", piece: "hook" });
    // the thurible: a pierced domed lid over a round bowl, a little foot
    const bw = u(0.2), bh = u(0.26), cx = bw >> 1;
    const body = b.part("body", { w: bw, h: bh, pivot: [cx, 0], at: [u(p.arm), u(p.drop)], layer: "mid", z: 9, hittable: true });
    body.rect(cx - 1, 0, 3, u(0.03), { mat: "brass", profile: "cylV", piece: "ring" });
    body.ellipse(cx, Math.round(bh * 0.36), bw * 0.38, bh * 0.22, { mat: "brass", profile: "dome", r: 4, piece: "lid" });
    for (const [x, y] of [[cx - 3, Math.round(bh * 0.34)], [cx + 2, Math.round(bh * 0.3)], [cx - 1, Math.round(bh * 0.42)]] as [number, number][]) body.pixels([[x, y]], { mat: "soot", mode: "paint" });
    body.rect(1, Math.round(bh * 0.5), bw - 2, 2, { mat: "brass", profile: "cylH", z: 2, piece: "band" });
    body.ellipse(cx, Math.round(bh * 0.68), bw * 0.46, bh * 0.2, { mat: "brass", profile: "dome", r: 4, piece: "bowl" });
    body.rect(cx - Math.round(bw * 0.18), bh - 3, Math.round(bw * 0.36), 3, { mat: "brass", profile: "bevel", r: 1, depth: 2, piece: "foot" });
    body.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["brass"] });
    const { rope } = b.rope("chain", { from: [u(p.arm), 1], to: [u(p.arm), u(p.drop)], segments: Math.max(6, Math.round(p.drop * 8)), mat: "brass", width: 2, chain: true, pinStart: true, endMass: 6, slack: 1.0, damping: 0.993, windGain: 0.35 });
    b.hang("body", rope);
    // a faint warm glow in the coals behind the lid
    b.glow({ part: "body", at: [cx, Math.round(bh * 0.4)], colour: [1, 0.55, 0.3], radius: u(0.2), intensity: 0.35, flicker: 0.5 });
    return { body: b.get("body"), rope, puffT: 0 };
  },
  initial: "hanging",
  states: {
    hanging: {
      update: (c, dt) => smoke(c, dt),
      hit: (c, h) => swing(c, h.hit),
    },
  },
  demo: {
    indoor: true,
    at: 3.4,
    w: 4,
    params: { drop: 1.5, arm: 0.55 },
    script: [
      { label: "hanging, smoking", wait: 1.5 },
      { label: "slash: it swings", hit: "slash", from: -0.3, wait: 3 },
      { label: "dash past", hit: "wind", from: -1.4, wait: 3 },
      { label: "settling", wait: 3 },
    ],
  },
});

function swing(c: Prop<Refs>, hit: Hit): void {
  const r = c.refs.rope, k = r.n - 1;
  const H = c.params.H;
  const s = hit.type === "wind" ? 0.03 : hit.type === "slash" || hit.type === "point" ? 0.06 : 0.09;
  const side = hit.dir[0] < 0 ? -1 : 1;
  r.push(r.x[k]!, r.y[k]!, H * 1.5, side * H * s, -H * s * 0.2);
  if (hit.type !== "wind") {
    c.damage(hit, ["body"]);
    c.sound("censer.chain", 0.5);
  }
}

/** Thin smoke from the lid: more while it swings (a trail through the light). */
function smoke(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const k = r.rope.n - 1;
  const v = Math.abs(r.rope.x[k]! - r.rope.px[k]!);
  r.puffT -= dt * (1 + Math.min(4, v * 2));
  if (r.puffT > 0) return;
  r.puffT = c.world.reduced ? 0.9 : 0.45;
  const [x, y] = r.body.toWorld(r.body.pivotX, Math.round(r.body.grid.h * 0.2));
  puff(c.world, "smoke", x, y, 1, [0, -1], { speed: 0.12, spread: 0.3, rgb: [[132, 118, 140], [150, 136, 150], [116, 106, 128]] });
}

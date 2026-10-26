// Hanging lantern: a lantern on a chain from a ceiling hook (the lodge, the
// chapel porch, the nave). The chain is a verlet rope with the lantern's
// weight on its end, so a hit or the dash's wind swings it, and it settles.
// Chains don't cut. kind: "iron" (glass panes) or "paper" (a paper lantern
// for the market). E turns it on or off. Glass shatters and paper tears, and
// both mend. Origin: the ceiling hook.

import { addFlame, glassTone, stepFlame, type Flame } from "../kit.ts";
import type { Rope } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import type { Hit } from "../hits.ts";

export interface HangingLanternParams {
  kind: "iron" | "paper";
  /** Chain length in H. */
  drop: number;
  lit: boolean;
}

interface Refs {
  body: Part;
  rope: Rope;
  flame: Flame;
}

export const hangingLantern = defineRecipe<HangingLanternParams, Refs>({
  id: "hangingLantern",
  breakage: "heal",
  reason: "Warm light hung low in cozy rooms (the lodge, the chapel porch, the market): it sways when you pass close or swing near it, which makes a room feel lived in.",
  defaults: { kind: "iron", drop: 0.9, lit: true },
  use: { reach: 0.5, prompt: "lamp", zone: [-0.3, 0, 0.3, 2.6] },
  cues: ["lamp.on", "lamp.off", "metal.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const paper = p.kind === "paper";
    const lw = u(paper ? 0.26 : 0.2), lh = u(paper ? 0.34 : 0.3);
    const cx = lw >> 1;
    // ceiling plate and hook
    const plate = b.part("plate", { w: u(0.16), h: u(0.06), pivot: [u(0.08), 0], at: [0, 0], layer: "bg", z: 8, hittable: false });
    plate.rect(0, 0, u(0.16), 3, { mat: "iron", profile: "bevel", r: 1, depth: 2 });
    plate.rect(u(0.08) - 1, 3, 2, u(0.06) - 3, { mat: "iron", profile: "cylV", piece: "hook" });
    // the lantern body, hung by its top ring
    const body = b.part("body", { w: lw, h: lh, pivot: [cx, 0], at: [0, u(p.drop)], layer: "mid", z: 9 });
    if (paper) {
      body.rect(cx - 2, 0, 4, u(0.04), { mat: "woodDark", profile: "cylV", piece: "cap" });
      body.ellipse(cx, lh / 2 + 1, lw / 2, lh / 2 - u(0.05), { mat: "paperLamp", profile: "dome", r: 5, piece: "paper" });
      for (let y = u(0.08); y < lh - u(0.06); y += u(0.05)) body.rect(0, y, lw, 1, { mat: "paperLamp", mode: "paint", tone: -1 });
      body.rect(cx - u(0.07), u(0.03), u(0.14), 3, { mat: "woodDark", profile: "cylH", z: 2, piece: "rim" });
      body.rect(cx - u(0.07), lh - 3, u(0.14), 3, { mat: "woodDark", profile: "cylH", z: 2, piece: "rim" });
      // a red tassel under it
      body.rect(cx - 1, lh - 1, 2, 1, { mat: "clothRed", profile: "flat" });
    } else {
      body.rect(cx - 1, 0, 3, u(0.04), { mat: "iron", profile: "cylV", piece: "ring" });
      body.poly([cx - u(0.1), u(0.1), cx + u(0.1), u(0.1), cx + u(0.03), u(0.04), cx - u(0.03), u(0.04)], { mat: "iron", profile: "dome", r: 2, piece: "cap" });
      body.rect(cx - u(0.08), u(0.1), u(0.16), u(0.15), { mat: "lampGlass", profile: "flat", depth: 1, piece: "glass" });
      body.rect(cx - u(0.08) + 2, u(0.1) + 2, u(0.16) - 4, u(0.15) - 4, { mat: "lampGlass", mode: "paint", tone: 1 });
      for (const x of [cx - u(0.08), cx - 1, cx + u(0.08) - 2]) body.rect(x, u(0.1), 2, u(0.15), { mat: "brass", profile: "cylV", z: 2, piece: "frame" });
      body.rect(cx - u(0.09), u(0.25), u(0.18), 3, { mat: "brass", profile: "cylH", z: 2, piece: "base" });
      body.poly([cx - u(0.04), u(0.25) + 3, cx + u(0.04), u(0.25) + 3, cx, lh], { mat: "brass", profile: "dome", r: 2, piece: "drip" });
    }
    const flame = addFlame(b, { name: "flame", parent: "body", at: [cx, paper ? Math.round(lh * 0.7) : u(0.23)], size: paper ? [0.05, 0.09] : [0.06, 0.1], light: 2.4, intensity: 0.7, glow: paper ? 0.4 : 0.3, colour: paper ? [1, 0.6, 0.34] : [1, 0.7, 0.4], z: paper ? 8 : 10, lit: p.lit });
    if (paper) flame.part.visible = false; // behind paper: only its light shows
    const { rope } = b.rope("chain", { from: [0, u(0.05)], to: [0, u(p.drop)], segments: Math.max(4, Math.round(p.drop * 9)), mat: paper ? "rope" : "iron", width: 2, chain: !paper, pinStart: true, endMass: 5, slack: 1.0, damping: 0.99, windGain: 0.5 });
    b.hang("body", rope);
    return { body: b.get("body"), rope, flame };
  },
  initial: (c) => (c.params["lit"] ? "on" : "off"),
  states: {
    on: {
      enter(c) {
        c.refs.flame.target = 1;
      },
      update: (c, dt) => step(c, dt),
      use: () => "off",
      hit: (c, h) => onHit(c, h.hit),
    },
    off: {
      sound: "lamp.off",
      enter(c) {
        c.refs.flame.target = 0;
      },
      update: (c, dt) => step(c, dt),
      use: () => "on",
      hit: (c, h) => onHit(c, h.hit),
    },
  },
  actions: {
    on: () => "on",
    off: () => "off",
    /** Nudge it (someone brushed past, a door slammed). */
    nudge: (c, arg) => {
      const r = c.refs.rope, k = r.n - 1;
      r.push(r.x[k]!, r.y[k]!, c.params.H, Number(arg ?? 1) * c.params.H * 0.03, 0);
    },
  },
  demo: {
    indoor: true,
    w: 4,
    at: 2.6,
    variants: [{ label: "paper (market)", params: { kind: "paper", drop: 1.1 }, dx: 1.4 }],
    script: [
      { label: "hanging still", wait: 0.8 },
      { label: "slash near it: it swings", hit: "slash", from: -0.6, wait: 2.5 },
      { label: "dash wind", hit: "wind", from: -1.5, wait: 2.5 },
      { label: "E: off", use: true, from: -0.3, wait: 1 },
      { label: "E: on", use: true, from: -0.3, wait: 1.5 },
    ],
  },
});

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const k = r.rope.n - 1;
  const sway = r.rope.x[k]! - r.rope.px[k]!;
  stepFlame(c, r.flame, dt, sway * 3);
  r.body.glow = r.flame.level < 0.1 ? 0 : 0.2 + 0.8 * r.flame.level;
  glassTone(r.body, r.flame.level < 0.1 ? 2 : r.flame.level < 0.5 ? 1 : 0);
}

function onHit(c: Prop<Refs>, hit: Hit): void {
  const r = c.refs.rope, k = r.n - 1;
  const H = c.params.H;
  const s = hit.type === "wind" ? 0.025 : hit.type === "slash" || hit.type === "point" ? 0.04 : 0.06;
  const side = hit.dir[0] < 0 ? -1 : 1;
  r.push(r.x[k]!, r.y[k]!, H * 1.5, side * H * s, -H * s * 0.2);
  if (hit.type !== "wind") c.damage(hit, ["body"]);
}

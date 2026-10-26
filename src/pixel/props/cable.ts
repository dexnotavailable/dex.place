// Hanging cables and chains: slack lines between two points (the Hollow
// Mouth's shaft, the market's cables, the spire's broken rail), or a chain
// hanging free with a hook on its end (the crane yards). Verlet: they sag
// and sway, swing when hit or when the dash passes, and settle. Cables and
// chains don't cut (never breaks). Origin: the first anchor point.

import { hitCentre, type Hit } from "../hits.ts";
import type { Rope } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";

export interface CableParams {
  kind: "cable" | "chain" | "rope";
  /** The other end, relative to the origin, in H. Ignored when `free`. */
  to: [number, number];
  /** Hang free from the origin with a weight on the end (`length` H long). */
  free: boolean;
  length: number;
  /** Extra length over the straight distance (sag). */
  slack: number;
  /** Put a hook on a free end. */
  hook: boolean;
}

interface Refs {
  rope: Rope;
}

export const cable = defineRecipe<CableParams, Refs>({
  id: "cable",
  breakage: "never",
  reason: "Lines that make big spaces feel built and alive: cables across the shaft and the market, chains and hooks in the crane yards; they sway in the updraft and swing when you pass.",
  defaults: { kind: "cable", to: [3, 0.2], free: false, length: 1.4, slack: 1.12, hook: true },
  cues: ["chain.rattle"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const mat = p.kind === "chain" ? "iron" : p.kind === "rope" ? "rope" : "cable";
    const width = p.kind === "cable" ? 3 : 2;
    const to: [number, number] = p.free ? [0, u(p.length)] : [u(p.to[0]), u(p.to[1])];
    const len = Math.hypot(to[0], to[1]);
    const segs = Math.max(6, Math.round(len / u(0.12)));
    const { rope, part } = b.rope("line", { from: [0, 0], to, segments: segs, slack: p.free ? 1 : p.slack, mat, width, chain: p.kind === "chain", pinStart: true, pinEnd: !p.free, endMass: p.free ? 6 : undefined, damping: 0.99, windGain: 0.4 });
    part.z = 6;
    if (!p.free) {
      // let it settle into its sag before anyone sees it
      for (let i = 0; i < 300; i++) rope.step(1 / 60, u(17.5));
      rope.x0.set(rope.x);
      rope.y0.set(rope.y);
      rope.px.set(rope.x);
      rope.py.set(rope.y);
    }
    // brackets at the anchors, a hook on a free end
    const bk = u(0.1);
    const a = b.part("anchorA", { w: bk, h: bk, pivot: [bk >> 1, bk >> 1], at: [0, 0], layer: "mid", z: 7 });
    a.roundRect(0, 0, bk, bk, 2, { mat: "iron", profile: "bevel", r: 2, depth: 3 });
    a.rivets([[bk >> 1, bk >> 1]], { mat: "brass", r: 1.2 });
    if (!p.free) {
      const e = b.part("anchorB", { w: bk, h: bk, pivot: [bk >> 1, bk >> 1], at: to, layer: "mid", z: 7 });
      e.roundRect(0, 0, bk, bk, 2, { mat: "iron", profile: "bevel", r: 2, depth: 3 });
      e.rivets([[bk >> 1, bk >> 1]], { mat: "brass", r: 1.2 });
    } else if (p.hook) {
      const hw = u(0.16), hh = u(0.22);
      const hk = b.part("hook", { w: hw, h: hh, pivot: [hw >> 1, 0], at: to, layer: "mid", z: 7 });
      hk.rect((hw >> 1) - 2, 0, 4, u(0.08), { mat: "iron", profile: "cylV", piece: "shank" });
      hk.ring(hw >> 1, hh - u(0.07), u(0.03), u(0.07), { mat: "iron", profile: "dome", r: 2, piece: "hook" });
      hk.rect(0, hh - u(0.12), (hw >> 1) - 1, u(0.06), { mat: "iron", mode: "erase" });
      b.hang("hook", rope);
    }
    return { rope };
  },
  initial: "hanging",
  states: {
    hanging: {
      hit: (c, h) => onHit(c, h.hit),
    },
  },
  actions: {
    /** A gust through the shaft or a colossus footfall shaking the line. */
    shake: (c, arg) => {
      const r = c.refs.rope, k = r.n >> 1;
      r.push(r.x[k]!, r.y[k]!, c.params.H * 3, Number(arg ?? 1) * 2, -1);
    },
  },
  demo: {
    w: 7,
    at: 2.6,
    params: { to: [3.2, 0.3] },
    variants: [
      { label: "chain", params: { kind: "chain", to: [2.2, -0.2], slack: 1.08 }, dx: -3.2 },
      { label: "free chain and hook (crane)", params: { kind: "chain", free: true, length: 1.5 }, dx: 3.2 },
    ],
    script: [
      { label: "hanging", wait: 0.8 },
      { label: "slash across it: swings", hit: "slash", from: 1.2, face: 1, wait: 2 },
      { label: "dash wind", hit: "wind", from: 0.2, face: 1, wait: 2 },
      { label: "shake (footfall)", act: "shake", wait: 2.5 },
    ],
  },
});

function onHit(c: Prop<Refs>, hit: Hit): void {
  const [x, y] = hitCentre(hit.shape);
  const f = hit.type === "wind" ? 2.5 : hit.type === "slash" || hit.type === "point" ? 3.5 : 5;
  c.refs.rope.push(x, y, c.params.H * 1.8, hit.dir[0] * f, hit.dir[1] * f - 1);
  if (hit.type !== "wind") c.sound("chain.rattle", 0.5);
}

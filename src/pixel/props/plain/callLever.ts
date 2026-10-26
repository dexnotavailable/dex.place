// The hook's call lever (lane R-B, B5): a short iron lever in a post-mounted
// box at each end of the crane's run. E pulls it down with a clank and it
// springs back up; each pull calls the hook to this end (the host signals
// the placement's `target` with its `msg`, e.g. the carrier's call:0). Unlike
// the shortcut levers it doesn't stay pulled. Never breaks. Origin: the
// post's foot.

import { EASE } from "../../util.ts";
import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";
import "./materials.ts";

interface Refs {
  handle: Part;
  f: number;
}

const UP = -0.9, DOWN = 0.5;

export const callLever = defineRecipe<Record<string, never>, Refs>({
  id: "callLever",
  breakage: "never",
  reason: "Calls the crane's hook to this end of its run, so the lift into the hollow works from the top and from the street below.",
  defaults: {},
  use: { reach: 0.6, prompt: "call" },
  cues: ["lever.pull", "lever.clank", "bell.small"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const ph = u(0.95);
    const post = b.part("post", { w: u(0.3), h: ph, pivot: [u(0.15), ph], at: [0, 0], layer: "mid", z: 5 });
    post.rect(u(0.15) - 2, u(0.3), 4, ph - u(0.3), { mat: "plainIron", profile: "cylV" });
    post.rect(0, 0, u(0.3), u(0.34), { mat: "plainPaint", profile: "bevel", r: 2 });
    post.rect(u(0.05), u(0.05), u(0.2), u(0.08), { mat: "plainSignFace", profile: "flat", z: 1 });
    post.rect(u(0.13), u(0.15), u(0.04), u(0.16), { mat: "soot", profile: "sunk", r: 1, depth: 2, z: 1 });
    post.rect(u(0.06), ph - u(0.05), u(0.18), u(0.05), { mat: "plainIron", profile: "bevel", r: 1 });
    post.wear({ amount: 0.2, seed: p.seed });
    const hl = u(0.32), hw = u(0.08);
    const h2 = b.part("grip", { w: hw, h: hl, pivot: [hw >> 1, hl], at: [0, -ph + u(0.25)], layer: "mid", z: 7, smoothRotate: true });
    h2.rect((hw >> 1) - 1, u(0.08), 3, hl - u(0.08), { mat: "plainIron", profile: "cylV" });
    h2.roundRect((hw >> 1) - u(0.03), 0, u(0.06), u(0.1), 3, { mat: "clothRed", profile: "dome", r: 3, z: 2 });
    const grip = b.get("grip");
    grip.rot = UP;
    return { handle: grip, f: 0 };
  },
  initial: "up",
  states: {
    up: {
      enter(c) {
        c.refs.handle.rot = UP;
      },
      use: () => "pulling",
      hit(c, h) {
        if (h.hit.type !== "wind") c.refs.handle.shake = 0.15;
      },
    },
    pulling: {
      sound: "lever.pull",
      update(c, dt) {
        const r = c.refs;
        r.f = Math.min(1, r.f + dt / 0.3);
        r.handle.rot = UP + (DOWN - UP) * EASE["inOutCubic"]!(r.f);
        if (r.f >= 1) {
          c.sound("lever.clank", 1);
          // the host signals the placement's target (the hook: call to this end)
          c.emit({ type: "lever", on: false });
          c.go("return");
        }
      },
    },
    return: {
      update(c, dt) {
        const r = c.refs;
        r.f = Math.max(0, r.f - dt / 0.6);
        r.handle.rot = UP + (DOWN - UP) * EASE["inOutCubic"]!(r.f);
        if (r.f <= 0) c.go("up");
      },
    },
  },
  demo: {
    w: 3,
    script: [
      { label: "up", wait: 0.5 },
      { label: "E: pulled, it calls, it springs back", use: true, wait: 1.4 },
      { label: "again", use: true, wait: 1.4 },
    ],
  },
});


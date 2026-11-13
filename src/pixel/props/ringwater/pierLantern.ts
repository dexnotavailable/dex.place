// The pier lantern: the keeper's lamp at the dock's bend, the one lamp still
// burning when you arrive (WORLD-PLAN A1). A weathered post with an iron arm
// and a small glass lantern on a hook: on, a slow flicker, swings when hit or
// brushed by the dash and settles. It is a light source that rims the player
// warm, and moths find it. Never goes out on its own; hits only dip it.
// Origin: the post's foot on the deck.

import "./materials.ts";
import { addFlame, glassTone, stepFlame, type Flame } from "../../kit.ts";
import { Pendulum } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { Hit } from "../../hits.ts";

export interface PierLanternParams {
  /** Post height above the deck, in H. */
  height: number;
  /** Arm side: +1 right, -1 left. */
  arm: 1 | -1;
}

interface Refs {
  lantern: Part;
  flame: Flame;
  swing: Pendulum;
}

export const pierLantern = defineRecipe<PierLanternParams, Refs>({
  id: "pierLantern",
  breakage: "heal",
  reason: "The keeper's lamp on the dock: the one lamp the storm didn't put out, lit before you arrived. It is how the first frame says someone lives here.",
  defaults: { height: 0.78, arm: -1 },
  cues: ["lamp.on", "metal.hit", "glass.hit", "wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const s = p.arm < 0 ? -1 : 1;
    const Ht = u(p.height), pw = Math.max(4, u(0.07)), armL = u(0.2);
    const W = pw + armL + 4;
    const cx = s > 0 ? 2 : W - pw - 2;
    const post = b.part("post", { w: W, h: Ht, pivot: [cx + (pw >> 1), Ht], at: [0, 0], layer: "mid", z: 8, collide: "none" });
    // the post: the dock's old wood, a lit edge, a cap, iron bands
    post.piece("post");
    post.rect(cx, u(0.04), pw, Ht - u(0.04), { mat: "woodDark", profile: "cylV" });
    post.grain({ dir: "v", seed: p.seed, mats: ["woodDark"] });
    post.rect(cx - 1, 0, pw + 2, u(0.04), { mat: "woodDark", profile: "bevel", r: 1, depth: 2, z: 1, piece: "cap" });
    for (const y of [u(0.16), Ht - u(0.22)]) post.rect(cx - 1, y, pw + 2, 2, { mat: "iron", profile: "cylH", z: 2, piece: "band" });
    // the arm and the hook
    const ay = u(0.07);
    const ax0 = s > 0 ? cx + pw : cx - armL;
    post.rect(ax0, ay, armL, 2, { mat: "iron", profile: "cylH", z: 2, piece: "arm" });
    post.stroke(s > 0 ? [cx + pw, ay + u(0.08), cx + pw + u(0.08), ay + 1] : [cx, ay + u(0.08), cx - u(0.08), ay + 1], 2, { mat: "iron", z: 2, piece: "strut" });
    const hookX = s > 0 ? cx + pw + armL - 2 : cx - armL + 1;
    post.rect(hookX, ay, 2, u(0.04), { mat: "iron", profile: "cylV", z: 3, piece: "hook" });
    post.speckle({ amount: 0.08 + p.wear * 0.2, seed: p.seed + 1, tone: -1, mats: ["wood"] });
    // the lantern on the hook: a pendulum
    const lw = u(0.16), lh = u(0.26);
    const lx = lw >> 1;
    const hx = hookX + 1 - (cx + (pw >> 1));
    const L = b.part("lantern", { w: lw, h: lh, pivot: [lx, 0], at: [hx, -(Ht - ay - u(0.035))], layer: "mid", z: 9, smoothRotate: true });
    L.rect(lx - 1, 0, 3, u(0.03), { mat: "iron", profile: "cylV", piece: "ring" });
    L.poly([lx - u(0.075), u(0.08), lx + u(0.075), u(0.08), lx + u(0.025), u(0.03), lx - u(0.025), u(0.03)], { mat: "iron", profile: "dome", r: 2, piece: "cap" });
    L.rect(lx - u(0.055), u(0.08), u(0.11), u(0.13), { mat: "lampGlass", profile: "flat", depth: 1, piece: "glass" });
    L.rect(lx - u(0.055) + 2, u(0.08) + 2, u(0.11) - 4, u(0.13) - 4, { mat: "lampGlass", mode: "paint", tone: 1 });
    for (const x of [lx - u(0.055), lx + u(0.055) - 2]) L.rect(x, u(0.08), 2, u(0.13), { mat: "iron", profile: "cylV", z: 2, piece: "frame" });
    L.rect(lx - u(0.065), u(0.21), u(0.13), 3, { mat: "iron", profile: "cylH", z: 2, piece: "base" });
    const flame = addFlame(b, { name: "flame", parent: "lantern", at: [lx, u(0.195)], size: [0.05, 0.08], light: 2.8, intensity: 0.8, glow: 0.32, z: 10, lit: true });
    return { lantern: b.get("lantern"), flame, swing: new Pendulum(u(0.26), u(17.5), 1.2) };
  },
  initial: "on",
  states: {
    on: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit),
    },
  },
  actions: {
    /** A gust or a far footfall sets the lantern swinging. */
    gust: (c, arg) => {
      c.refs.swing.impulse(Number(arg ?? 1) * 1.4);
    },
  },
  demo: {
    w: 4,
    with: [{ id: "moths", params: { count: 4, reach: 2 }, dx: 0.4 }],
    script: [
      { label: "on: the keeper's lamp", wait: 1.2 },
      { label: "slash: it swings, the flame dips", hit: "slash", from: -0.7, wait: 1.6 },
      { label: "dash wind", hit: "wind", from: -1.2, wait: 1.4 },
      { label: "settles", wait: 2.4 },
    ],
  },
});

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const [wx] = c.world.windAt(r.lantern.wx, r.lantern.wy);
  const torque = wx * 0.0005 + Math.sin(c.world.time * 0.7) * 0.00002;
  if (!r.swing.resting || Math.abs(torque) > 1e-4) {
    r.swing.step(dt, torque);
    r.lantern.rot = Math.max(-0.8, Math.min(0.8, r.swing.angle)) * c.flip;
  }
  stepFlame(c, r.flame, dt, r.swing.vel * 2);
  r.lantern.glow = 0.2 + 0.8 * r.flame.level;
  glassTone(r.lantern, 0);
}

function onHit(c: Prop<Refs>, hit: Hit): void {
  const r = c.refs;
  const side = hit.dir[0] < 0 ? -1 : 1;
  r.swing.impulse(side * (hit.type === "wind" ? 0.9 : hit.type === "slash" || hit.type === "point" ? 1.5 : 2.4));
  if (hit.type === "wind") {
    r.flame.leanV += side * 12;
    return;
  }
  c.damage(hit);
  // the keeper's lamp dips but never goes out
  r.flame.level = Math.min(r.flame.level, 0.55);
}

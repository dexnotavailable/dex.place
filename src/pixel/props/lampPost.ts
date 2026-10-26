// Lamp post (WORLD-PLAN: 2.5 H): an iron crook post with a small glass
// lantern hanging from its arm on a short chain, so it swings when hit or in
// a gust and settles. States: off, lighting (after a delay: lamp posts come
// on one after another when a shrine is lit, as if they share one wick),
// on, flicker (a brief dip, then on again). The panes shatter and mend; the
// post dents and mends. Origin: floor, centre of the post.

import { addFlame, glassTone, stepFlame, type Flame } from "../kit.ts";
import { Pendulum } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

export interface LampPostParams {
  lit: boolean;
  /** Arm side: +1 right, -1 left. */
  arm: 1 | -1;
}

interface Refs {
  lantern: Part;
  flame: Flame;
  swing: Pendulum;
  delay: number;
  dip: number;
}

export const lampPost = defineRecipe<LampPostParams, Refs>({
  id: "lampPost",
  breakage: "heal",
  reason: "Lights along the route between shrines; they come on in a line when a shrine is lit, so the way you came stays readable from far off.",
  defaults: { lit: true, arm: 1 },
  cues: ["lamp.on", "metal.hit", "glass.hit"],
  standard: { h: 2.5, parts: ["post"], note: "lamp post" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const s = p.arm < 0 ? -1 : 1;
    const W = u(0.62), Ht = u(2.5);
    const cx = u(0.16);
    const post = b.part("post", { w: W, h: Ht, pivot: [cx, Ht], at: [0, 0], layer: "mid", z: 8, collide: "none" });
    // stone footing and the flared iron foot
    post.piece("footing");
    post.rect(cx - u(0.14), Ht - u(0.08), u(0.28), u(0.08), { mat: "stone", profile: "bevel", r: 2, depth: 3 });
    post.speckle({ amount: 0.15, seed: p.seed, tone: -1, region: { x0: 0, y0: Ht - u(0.08), x1: W - 1, y1: Ht - 1 } });
    post.piece("foot");
    post.poly([cx - u(0.09), Ht - u(0.08), cx + u(0.09), Ht - u(0.08), cx + u(0.04), Ht - u(0.3), cx - u(0.04), Ht - u(0.3)], { mat: "iron", profile: "cylV" });
    post.rect(cx - u(0.06), Ht - u(0.33), u(0.12), u(0.04), { mat: "iron", profile: "cylH", z: 2, piece: "collar" });
    // the shaft with two collars, then the crook
    post.piece("shaft");
    post.rect(cx - u(0.03), u(0.18), u(0.06), Ht - u(0.5), { mat: "iron", profile: "cylV" });
    for (const y of [0.9, 1.9]) post.rect(cx - u(0.045), Ht - u(y), u(0.09), u(0.035), { mat: "iron", profile: "cylH", z: 2, piece: "collar" });
    post.piece("crook");
    const ax = cx + u(0.36);
    post.stroke([cx, u(0.22), cx, u(0.12), cx + u(0.05), u(0.05), cx + u(0.14), u(0.03), ax, u(0.03)], u(0.05), { mat: "iron", profile: "cylV" });
    post.stroke([cx, u(0.34), cx + u(0.08), u(0.2), cx + u(0.16), u(0.14)], 2, { mat: "iron", profile: "cylV", z: 1, piece: "scroll" });
    post.circle(cx + u(0.16), u(0.12), 2.2, { mat: "iron", profile: "dome", r: 2, z: 1, piece: "scroll" });
    post.circle(cx, u(0.02) + 1, u(0.035), { mat: "iron", profile: "dome", r: 2, z: 2, piece: "finial" });
    post.rect(ax - 1, u(0.03), 3, u(0.06), { mat: "iron", profile: "cylV", z: 2, piece: "hook" });
    post.speckle({ amount: 0.06 + p.wear * 0.2, seed: p.seed + 1, tone: -1, mats: ["iron"] });
    if (s < 0) b.get("post").flip = -1;
    // the lantern on its hook: hangs from its top, swings as a pendulum
    const lw = u(0.2), lh = u(0.32);
    const lx = lw >> 1;
    const hookX = (ax - cx) * s;
    const L = b.part("lantern", { w: lw, h: lh, pivot: [lx, 0], at: [hookX, -(Ht - u(0.09))], layer: "mid", z: 9, smoothRotate: true });
    L.rect(lx - 1, 0, 3, u(0.04), { mat: "iron", profile: "cylV", piece: "ring" });
    L.poly([lx - u(0.1), u(0.1), lx + u(0.1), u(0.1), lx + u(0.03), u(0.04), lx - u(0.03), u(0.04)], { mat: "iron", profile: "dome", r: 2, piece: "cap" });
    L.rect(lx - u(0.075), u(0.1), u(0.15), u(0.16), { mat: "lampGlass", profile: "flat", depth: 1, piece: "glass" });
    L.rect(lx - u(0.075) + 2, u(0.1) + 2, u(0.15) - 4, u(0.16) - 4, { mat: "lampGlass", mode: "paint", tone: 1 });
    for (const x of [lx - u(0.075), lx - 1, lx + u(0.075) - 2]) L.rect(x, u(0.1), 2, u(0.16), { mat: "iron", profile: "cylV", z: 2, piece: "frame" });
    L.rect(lx - u(0.085), u(0.26), u(0.17), 3, { mat: "iron", profile: "cylH", z: 2, piece: "base" });
    L.poly([lx - u(0.04), u(0.26) + 3, lx + u(0.04), u(0.26) + 3, lx, lh], { mat: "iron", profile: "dome", r: 2, piece: "drip" });
    const flame = addFlame(b, { name: "flame", parent: "lantern", at: [lx, u(0.24)], size: [0.06, 0.1], light: 3, intensity: 0.75, glow: 0.35, z: 10, lit: p.lit });
    return { lantern: b.get("lantern"), flame, swing: new Pendulum(u(0.3), u(17.5), 1.1), delay: -1, dip: 0 };
  },
  initial: (c) => (c.params["lit"] ? "on" : "off"),
  states: {
    off: {
      enter(c) {
        c.refs.flame.target = 0;
      },
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit, h.contact),
    },
    lighting: {
      update(c, dt) {
        step(c, dt);
        c.refs.delay -= dt;
        if (c.refs.delay <= 0) c.go("on");
      },
      hit: (c, h) => onHit(c, h.hit, h.contact),
    },
    on: {
      sound: "lamp.on",
      enter(c) {
        c.refs.flame.target = 1;
      },
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit, h.contact),
    },
    flicker: {
      enter(c) {
        c.refs.dip = 0;
      },
      update(c, dt) {
        step(c, dt);
        // two quick dips, never a strobe (the flame level eases)
        const t = c.t;
        c.refs.flame.target = t < 0.25 || (t > 0.5 && t < 0.7) ? 0.25 : 1;
      },
      after: [1.1, "on"],
      hit: (c, h) => onHit(c, h.hit, h.contact),
    },
  },
  actions: {
    /** Come on after `arg` seconds (the chain of lamps after a shrine is lit). */
    light: (c, arg) => {
      if (c.state === "on") return;
      c.refs.delay = Number(arg ?? 0);
      return "lighting";
    },
    off: () => "off",
    flicker: (c) => (c.state === "on" ? "flicker" : undefined),
    /** A gust (or a colossus footfall) sets the lantern swinging. */
    gust: (c, arg) => {
      c.refs.swing.impulse(Number(arg ?? 1) * 1.8);
    },
  },
  demo: {
    w: 5,
    params: { lit: false },
    variants: [{ label: "left arm, lit", params: { lit: true, arm: -1 }, dx: -1.8 }],
    script: [
      { label: "off", wait: 0.8 },
      { label: "light (0.6 s delay, as the chain comes on)", act: "light", arg: 0.6, wait: 2 },
      { label: "flicker", act: "flicker", wait: 1.4 },
      { label: "a gust: the lantern swings on its hook", act: "gust", wait: 2.4 },
      { label: "storm wind: it leans and rocks", wind: 600, wait: 2.5 },
      { label: "calm", wind: 0, wait: 0.5 },
      { label: "slash the post: dents, the lantern jolts", hit: "slash", from: -0.6, wait: 2 },
      { label: "settles", wait: 2 },
    ],
  },
});

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const [wx] = c.world.windAt(r.lantern.wx, r.lantern.wy);
  const torque = wx * 0.0006;
  if (!r.swing.resting || Math.abs(torque) > 1e-4) {
    r.swing.step(dt, torque);
    // the swing is in world terms; the part's rotation is mirrored by the prop's flip
    r.lantern.rot = Math.max(-0.9, Math.min(0.9, r.swing.angle)) * c.flip;
  }
  stepFlame(c, r.flame, dt, r.swing.vel * 2);
  r.lantern.glow = r.flame.level < 0.1 ? 0 : 0.2 + 0.8 * r.flame.level;
  glassTone(r.lantern, r.flame.level < 0.1 ? 2 : r.flame.level < 0.5 ? 1 : 0);
}

function onHit(c: Prop<Refs>, hit: import("../hits.ts").Hit, contact: [number, number] | null): void {
  const r = c.refs;
  const H = c.params.H;
  const side = hit.dir[0] < 0 ? -1 : 1;
  const k = hit.type === "wind" ? 0.8 : hit.type === "slash" || hit.type === "point" ? 1.6 : 2.6;
  r.swing.impulse(side * k);
  if (hit.type !== "wind") {
    c.damage(hit);
    if (r.flame.level > 0.5) r.flame.level = 0.6;
  } else r.flame.leanV += side * 12;
  void H;
  void contact;
}

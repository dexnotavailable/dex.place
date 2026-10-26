// The shrine set: the shrine lantern on its stone post and the offering bowl
// (the donation box and donor plaque are in donation.ts).
//
// Shrine lantern (WORLD-PLAN: 1.5 H on its post). Last night's storm blew the
// lamps out; resting at a shrine lights its lantern: the flame catches, the
// panes warm up, and the light rises until it rims the traveller. E is
// "rest"; it emits { type: "rest" } for the host (save point, lamp posts on
// the way, the lamp board). A red cloth is tied to the post (the route's red).
// Never breaks: a hit shakes it and dips the flame. Origin: floor, centre.
//
// Offering bowl: a shallow stone bowl on a low foot, holding water with two
// floating petals; ripples on hits, on rest, and when someone passes.

import { Ripples } from "../fx.ts";
import { resolveMat } from "../materials.ts";
import { F_NOINK } from "../cells.ts";
import { addFlame, glassTone, puff, stepFlame, type Flame } from "../kit.ts";
import { Spring } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import type { Hit } from "../hits.ts";

export interface LanternParams {
  /** Starts lit (the dock's lantern) or out (every shrine after the storm). */
  lit: boolean;
  /** Tie the red cloth on the post. */
  ribbon: boolean;
}

interface LanternRefs {
  stand: Part;
  box: Part;
  flame: Flame;
  shake: Spring;
  warm: number;
}

const WARM: [number, number, number] = [1, 0.7, 0.4];

export const shrineLantern = defineRecipe<LanternParams, LanternRefs>({
  id: "shrineLantern",
  breakage: "never",
  reason: "A lamp on the colossi's route; the storm blew it out. Resting here lights it, and lit lamps show the way back (the whole story's one mechanic).",
  defaults: { lit: false, ribbon: true },
  use: { reach: 0.7, prompt: "rest" },
  persist: ["lit"],
  cues: ["shrine.rest", "flame.gutter"],
  standard: { h: 1.5, note: "shrine lantern on its post" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(0.44), Ht = u(1.5);
    const cx = Math.floor(W / 2);
    const s = b.part("stand", { w: W, h: Ht, pivot: [cx, Ht], at: [0, 0], layer: "mid", z: 8, collide: "none" });
    const y = (h: number): number => Ht - u(h); // top of a thing h H above the floor
    // stepped plinth
    s.piece("plinth");
    s.rect(cx - u(0.2), y(0.07), u(0.4), u(0.07), { mat: "stone", profile: "bevel", r: 2, depth: 3 });
    s.rect(cx - u(0.15), y(0.13), u(0.3), u(0.065), { mat: "stone", profile: "bevel", r: 2, depth: 3, z: 1, piece: "plinth2" });
    s.speckle({ amount: 0.14, seed: p.seed, tone: -1, scale: 2, region: { x0: 0, y0: y(0.13), x1: W - 1, y1: Ht - 1 } });
    // the post: a square shaft with a sunk lamp mark
    s.piece("post");
    s.rect(cx - u(0.06), y(0.99), u(0.12), u(0.87), { mat: "stone", profile: "bevel", r: 3, depth: 3, z: 1 });
    s.rect(cx - u(0.06), y(0.99), 2, u(0.87), { mat: "stone", mode: "paint", tone: -1 });
    s.ornament(cx - 2, y(0.5), `
      ..#..
      .#.#.
      .###.
      ..#..
    `, { "#": { mat: "stone", tone: -2 } }, { mode: "paint" });
    s.cracks(cx + 2, y(0.3), { n: 1, len: 8, seed: p.seed + 4, dir: Math.PI / 2 });
    // sill under the firebox
    s.piece("sill");
    s.rect(cx - u(0.18), y(1.03), u(0.36), u(0.045), { mat: "stone", profile: "bevel", r: 2, depth: 4, z: 3 });
    // roof cap and finial
    s.piece("roof");
    const ry0 = y(1.42), ry1 = y(1.28);
    s.poly([cx - u(0.22), ry1, cx + u(0.22), ry1, cx + u(0.14), ry1 - u(0.06), cx + u(0.03), ry0, cx - u(0.03), ry0, cx - u(0.14), ry1 - u(0.06)], { mat: "stoneDark", profile: "dome", r: 4, z: 3 });
    s.rect(cx - u(0.22), ry1 - 1, u(0.44), 2, { mat: "stoneDark", mode: "paint", tone: 1 });
    s.circle(cx, y(1.46), u(0.035), { mat: "iron", profile: "dome", r: 2, z: 4, piece: "finial" });
    s.rect(cx - 1, y(1.44), 2, u(0.03), { mat: "iron", profile: "flat", z: 3, piece: "finial" });
    // the firebox: an iron cage; the back pane glows when lit, the flame sits between it and the bars
    const bw = u(0.26), bh = u(0.24);
    const box = b.part("box", { w: bw, h: bh, pivot: [Math.floor(bw / 2), bh], at: [0, -u(1.03)], layer: "mid", z: 9 });
    box.rect(0, 0, bw, bh, { mat: "lampGlass", profile: "flat", depth: 1, piece: "glass" });
    box.rect(2, 2, bw - 4, bh - 4, { mat: "lampGlass", mode: "paint", tone: 1 });
    const bars = b.part("bars", { w: bw, h: bh, pivot: [Math.floor(bw / 2), bh], at: [0, -u(1.03)], layer: "mid", z: 11 });
    bars.rect(0, 0, bw, 2, { mat: "iron", profile: "cylH" });
    bars.rect(0, bh - 2, bw, 2, { mat: "iron", profile: "cylH" });
    for (const x of [0, Math.floor(bw / 2) - 1, bw - 2]) bars.rect(x, 0, 2, bh, { mat: "iron", profile: "cylV" });
    bars.rivets([[1, 1], [bw - 2, 1], [1, bh - 2], [bw - 2, bh - 2]], { mat: "brass", r: 0.9 });
    const flame = addFlame(b, { name: "flame", at: [0, -u(1.06)], size: [0.07, 0.15], light: 2.8, intensity: 0.8, glow: 0.3, colour: WARM, z: 10, lit: p.lit });
    // the red cloth tied round the post, tails lifting a little in the wind
    if (p.ribbon) {
      const rw = u(0.2), rh = u(0.2);
      const rb = b.part("ribbon", { w: rw, h: rh, pivot: [u(0.04), 2], at: [cx - u(0.06) - cx, -u(0.86)], layer: "mid", z: 12, smoothRotate: true });
      rb.rect(u(0.04) - 1, 0, u(0.12) + 2, 4, { mat: "clothRed", profile: "cylH" });
      rb.stroke([u(0.06), 3, u(0.03), u(0.1), 1, u(0.18)], [3, 2, 2], { mat: "clothRed", profile: "flat", depth: 1 });
      rb.stroke([u(0.09), 3, u(0.1), u(0.08), u(0.08), u(0.15)], [3, 2, 1], { mat: "clothRed", profile: "flat", depth: 1, tone: -1 });
    }
    const refs: LanternRefs = { stand: b.get("stand"), box: b.get("box"), flame, shake: new Spring(220, 9), warm: p.lit ? 1 : 0 };
    refs.box.glow = refs.warm;
    return refs;
  },
  initial: (c) => (c.data["lit"] || c.params["lit"] ? "lit" : "out"),
  states: {
    out: {
      enter(c) {
        c.refs.flame.target = 0;
      },
      update: (c, dt) => lanternStep(c, dt),
      use: () => "lighting",
      hit: (c, h) => lanternHit(c, h.hit),
    },
    lighting: {
      sound: "shrine.rest",
      enter(c) {
        c.data["lit"] = true;
        c.emit({ type: "rest" });
        c.refs.flame.target = 1;
        const [x, y] = c.refs.flame.part.toWorld(c.refs.flame.part.pivotX, c.refs.flame.part.pivotY - 2);
        puff(c.world, "spark", x, y, 6, [0, -1], { speed: 0.5, spread: 0.8 });
      },
      update: (c, dt) => lanternStep(c, dt),
      after: [1.6, "lit"],
      hit: (c, h) => lanternHit(c, h.hit),
    },
    lit: {
      enter(c) {
        c.data["lit"] = true;
        c.refs.flame.target = 1;
      },
      update: (c, dt) => lanternStep(c, dt),
      use(c) {
        // resting again: the save point, nothing else changes
        c.emit({ type: "rest" });
        c.sound("shrine.rest", 0.6);
      },
      hit: (c, h) => lanternHit(c, h.hit),
    },
  },
  actions: {
    /** Light it without a rest (story: the dock's lantern, the ending's line of lamps). */
    light: (c) => (c.state === "out" ? "lighting" : undefined),
    douse: (c) => {
      c.data["lit"] = false;
      return "out";
    },
  },
  demo: {
    w: 4,
    variants: [{ label: "lit", params: { lit: true }, dx: 1.6 }],
    script: [
      { label: "out after the storm", wait: 1 },
      { label: "E: rest (lights it)", use: true, wait: 2.2 },
      { label: "hit: it shakes, the flame dips", hit: "slash", wait: 1.2 },
      { label: "dash wind", hit: "wind", from: -1.4, wait: 1.2 },
      { label: "douse (story action)", act: "douse", wait: 1 },
    ],
  },
});

function lanternStep(c: Prop<LanternRefs>, dt: number): void {
  const r = c.refs;
  r.shake.step(dt);
  const off = Math.round(r.shake.x);
  for (const name of ["box", "bars", "flame"]) c.part(name).offX = off;
  stepFlame(c, r.flame, dt, r.shake.v * 0.02);
  // the panes warm with the flame (a little behind it)
  r.warm += (r.flame.level - r.warm) * Math.min(1, dt * 2.5);
  r.box.glow = r.warm < 0.12 ? 0 : 0.15 + r.warm * 0.85;
  glassTone(r.box, r.warm < 0.12 ? 2 : r.warm < 0.45 ? 1 : 0);
  if (r.flame.light) r.flame.light.level = r.flame.level * (0.9 + 0.1 * r.warm);
}

function lanternHit(c: Prop<LanternRefs>, hit: Hit): void {
  const r = c.refs;
  const dir = hit.dir[0], type = hit.type;
  if (type === "wind") {
    r.flame.leanV += (dir || 1) * 10;
    return;
  }
  r.shake.impulse((dir || 1) * (type === "slash" || type === "point" ? 20 : 45));
  r.flame.level *= 0.55;
  // never breaks: the policy keeps every cell; it flashes and chips a shade, then mends
  c.damage(hit);
}

// ---------------------------------------------------------------------------

export interface BowlParams {
  petals: number;
}

interface BowlRefs {
  water: Part;
  ripples: Ripples;
  petals: { x: number; v: number }[];
}

function drawBowlWater(c: Prop<BowlRefs>): void {
  const R = c.refs;
  const g = R.water.grid;
  g.clearAll();
  const water = resolveMat("water").id;
  const petal = resolveMat("flowerRose").id;
  for (let x = 0; x < g.w; x++) {
    const hgt = R.ripples.h[x]!;
    const top = Math.max(0, Math.min(3, Math.round(1 - hgt)));
    const slope = (R.ripples.h[Math.min(g.w - 1, x + 1)]! - R.ripples.h[Math.max(0, x - 1)]!) * 0.5;
    for (let y = top; y < g.h; y++) {
      const i = g.inner(x, y);
      const surf = y === top;
      g.setRaw(i, water, surf ? (slope < -0.25 ? 1 : slope > 0.25 ? -1 : 1) : -1, 1, surf ? 2 + slope * 3 : 1, F_NOINK, 999);
    }
  }
  for (const pt of R.petals) {
    const x = Math.round(pt.x);
    const top = Math.max(0, Math.min(3, Math.round(1 - (R.ripples.h[Math.max(0, Math.min(g.w - 1, x))] ?? 0)))) - 1;
    for (const [dx, dy, t] of [[0, 0, 0], [1, 0, 1], [-1, 0, -1], [0, -1, 1]] as const) {
      const i = g.inner(x + dx, top + dy);
      if (i >= 0) g.setRaw(i, petal, t, 2, 3, F_NOINK, 999);
    }
  }
}

export const offeringBowl = defineRecipe<BowlParams, BowlRefs>({
  id: "offeringBowl",
  breakage: "heal",
  reason: "Beside each shrine lantern: still water with two petals, a small sign someone keeps the shrine; it ripples when you rest or pass.",
  defaults: { petals: 2 },
  cues: ["water.splash"],
  standard: { w: 0.42, parts: ["bowl"], note: "small, knee height" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(0.42), Ht = u(0.3);
    const cx = Math.floor(W / 2);
    const f = b.part("bowl", { w: W, h: Ht, pivot: [cx, Ht], at: [0, 0], layer: "mid", z: 7, collide: "none" });
    f.piece("foot");
    f.rect(cx - u(0.1), Ht - u(0.05), u(0.2), u(0.05), { mat: "stone", profile: "bevel", r: 2, depth: 3 });
    f.poly([cx - u(0.05), Ht - u(0.05), cx + u(0.05), Ht - u(0.05), cx + u(0.035), u(0.14), cx - u(0.035), u(0.14)], { mat: "stone", profile: "cylV", piece: "stem" });
    f.piece("bowl");
    f.poly([0, u(0.04), W, u(0.04), W - u(0.06), u(0.12), cx + u(0.08), u(0.16), cx - u(0.08), u(0.16), u(0.06), u(0.12)], { mat: "stone", profile: "dome", r: 4 });
    f.rect(0, u(0.03), W, 3, { mat: "stoneLight", profile: "cylH", z: 3, piece: "lip" });
    f.speckle({ amount: 0.12, seed: p.seed, tone: -1, scale: 2 });
    const ww = W - 6, wh = 4;
    b.part("water", { w: ww, h: wh, pivot: [Math.floor(ww / 2), wh], at: [0, -(Ht - u(0.03) - 2)], layer: "mid", z: 8, outline: 0, hittable: false });
    const petals = Array.from({ length: Math.max(0, Math.min(4, p.petals)) }, (_, k) => ({ x: ww * (0.3 + k * 0.35), v: 0 }));
    return { water: b.get("water"), ripples: new Ripples(ww, 90, 1.8), petals };
  },
  initial: "still",
  states: {
    still: {
      update(c, dt) {
        const R = c.refs;
        // someone walking past sets it rocking, faintly
        for (const a of c.world.actorsNear(c.x, c.y, c.params.H * 0.5, c.params.H * 0.3)) if (Math.abs(a.vx) > 10 && c.rand() < dt * 3) R.ripples.disturb(c.rand() * R.ripples.n, 2.5, 2);
        const e = R.ripples.step(dt);
        for (const pt of R.petals) {
          const i = Math.max(1, Math.min(R.ripples.n - 2, Math.round(pt.x)));
          pt.v += (R.ripples.h[i - 1]! - R.ripples.h[i + 1]!) * 6 * dt - pt.v * 1.5 * dt;
          pt.x = Math.max(1, Math.min(R.ripples.n - 2, pt.x + pt.v * dt));
        }
        if (e > 0.02 || !R.water.tag["drawn"]) {
          drawBowlWater(c);
          R.water.tag["drawn"] = true;
        }
      },
      hit(c, h) {
        const R = c.refs;
        const [lx] = R.water.toLocal(h.contact?.[0] ?? c.x, 0);
        R.ripples.disturb(Math.max(0, Math.min(R.ripples.n - 1, lx)), h.hit.type === "wind" ? 4 : 12, 3);
        const [sx, sy] = R.water.toWorld(R.ripples.n / 2, 1);
        if (h.hit.type !== "wind") {
          puff(c.world, "water", sx, sy, 8, [h.hit.dir[0] * 0.4, -1], { speed: 1.2, spread: 0.6 });
          c.sound("water.splash", 0.5);
          c.damage(h.hit, ["bowl"]);
        }
      },
    },
  },
  actions: {
    ripple: (c) => {
      c.refs.ripples.disturb(c.refs.ripples.n / 2, 6, 3);
    },
  },
  demo: {
    w: 3,
    script: [
      { label: "still", wait: 1 },
      { label: "someone passes", walk: [-1.2, 1.2], wait: 1.6 },
      { label: "ripple (on rest)", act: "ripple", wait: 1.5 },
      { label: "slash: splash, stone chips", hit: "slash", wait: 1.4 },
      { label: "mends", wait: 6 },
    ],
  },
});

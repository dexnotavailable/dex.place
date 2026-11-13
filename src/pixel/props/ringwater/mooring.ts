// Mooring posts, rope and buoys (WORLD-PLAN A0, A1, B1): a heavy post standing
// in the lake with a line to a float. The post sways a little when hit and
// chips (it mends); the float bobs, rides the passing ripples, and a hit rings
// the water around it. A faint ring of light at the post's foot keeps the
// water's own ripple rings company. Origin: where the post meets the water.

import "./materials.ts";
import { puff } from "../../kit.ts";
import { Spring, bob } from "../../motion.ts";
import { defineRecipe, type Prop, type PropGlow } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { Rope } from "../../motion.ts";
import type { Hit } from "../../hits.ts";

export interface MooringParams {
  /** Post height above the water, in H. */
  height: number;
  /** Float: where it rides, H from the post (+ right), or 0 for no line and float. */
  buoy: number;
}

interface Refs {
  post: Part;
  buoy: Part | null;
  rope: Rope | null;
  sway: Spring;
  bobV: Spring;
  ring: PropGlow;
  ringT: number;
  bx: number;
}

export const mooring = defineRecipe<MooringParams, Refs>({
  id: "mooring",
  breakage: "heal",
  reason: "Posts for tying up boats, from when more of them came: the ferry still uses one. They give the water something to ripple around and the dock its scale.",
  defaults: { height: 0.62, buoy: 0.9 },
  cues: ["wood.hit", "water.splash"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const pw = Math.max(5, u(0.1)), Ht = u(p.height);
    const post = b.part("post", { w: pw + 4, h: Ht + 2, pivot: [(pw + 4) >> 1, Ht + 2], at: [0, 2], layer: "mid", z: 6, smoothRotate: true });
    post.piece("post");
    post.rect(2, 2, pw, Ht, { mat: "woodDark", profile: "cylV" });
    post.grain({ dir: "v", seed: p.seed, mats: ["woodDark"] });
    // a rounded, split top; a rope wrap; the wet band and weed at the water
    post.roundRect(2, 0, pw, u(0.06), 2, { mat: "wood", profile: "dome", r: 2, z: 1, piece: "top" });
    post.line(2 + (pw >> 1), 1, 2 + (pw >> 1), u(0.05), { mat: "woodDark", mode: "paint", tone: -1 });
    for (let k = 0; k < 3; k++) post.rect(1, u(0.14) + k * 3, pw + 2, 2, { mat: "rope", profile: "cylH", z: 2, piece: "wrap" });
    post.rect(2, Ht + 2 - u(0.1), pw, u(0.1), { mat: "woodDark", mode: "paint", tone: -1 });
    post.pixels([[2, Ht - 1], [3, Ht - 3], [pw, Ht - 2], [pw + 1, Ht]], { mat: "moss", z: 1 });
    post.speckle({ amount: 0.12, seed: p.seed + 1, tone: -1, mats: ["woodDark"] });
    let buoy: Part | null = null;
    let rope: Rope | null = null;
    const bx = Math.round(u(p.buoy));
    if (p.buoy) {
      const bw = Math.max(6, u(0.12)), bh = Math.max(5, u(0.1));
      const bb = b.part("buoy", { w: bw, h: bh + 3, pivot: [bw >> 1, bh], at: [bx, 1], layer: "mid", z: 7 });
      bb.ellipse(bw / 2, bh / 2 + 2, bw / 2, bh / 2, { mat: "clothRed", profile: "dome", r: 3, piece: "float" });
      bb.rect(0, (bh >> 1) + 1, bw, 2, { mat: "clothPale", mode: "paint", tone: 0 });
      bb.rect((bw >> 1) - 1, 0, 2, 3, { mat: "iron", profile: "cylV", z: 1, piece: "eye" });
      buoy = b.get("buoy");
      const { rope: r } = b.rope("line", { from: [0, -u(0.16)], to: [bx, -Math.round(bh * 0.5)], segments: 8, slack: 1.12, mat: "rope", width: 1, pinStart: true, pinEnd: true, damping: 0.985 });
      rope = r;
    }
    const ring = b.glow({ kind: "ring", at: [0, 0], colour: [0.55, 0.7, 0.66], radius: u(0.28), intensity: 0.22, flat: 0.25, thick: 1 });
    return { post: b.get("post"), buoy, rope, sway: new Spring(70, 5), bobV: new Spring(40, 3), ring, ringT: 0, bx };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit),
    },
  },
  actions: {
    /** A passing ripple (a footfall ring from the colossus) lifts the float and rocks the post. */
    ripple: (c, arg) => {
      c.refs.bobV.impulse(-Number(arg ?? 1) * 3);
      c.refs.sway.impulse(Number(arg ?? 1) * 0.04);
    },
  },
  demo: {
    w: 4,
    script: [
      { label: "idle: the float rides the water", wait: 2 },
      { label: "slash the post: it sways and chips", hit: "slash", from: -0.7, wait: 1.6 },
      { label: "a ripple passes", act: "ripple", arg: 1.5, wait: 2 },
      { label: "mends", wait: 6 },
    ],
  },
});

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  r.sway.step(dt);
  r.post.rot = Math.max(-0.12, Math.min(0.12, r.sway.x));
  r.bobV.step(dt);
  // the ring at its foot slowly widens and fades, over and over
  r.ringT = (r.ringT + dt / 4.2) % 1;
  r.ring.level = (1 - r.ringT) * (c.world.reduced ? 0.5 : 1);
  r.ring.radius = c.params.H * (0.12 + r.ringT * 0.3);
  if (r.buoy) {
    const t = c.world.time;
    const dy = bob(t + c.params.seed * 0.1, 1, 2.6) + Math.round(r.bobV.x);
    const dx = Math.round(Math.sin(t * 0.31 + c.params.seed) * 2);
    if (dy !== r.buoy.offY || dx !== r.buoy.offX) {
      r.buoy.offY = dy;
      r.buoy.offX = dx;
      // the line follows the float only when something pushed it (a hit, a ripple): its idle
      // pixel of bob is not worth waking the rope for (undisturbed props cost nothing)
      if (r.rope && Math.abs(r.bobV.x) > 0.5) {
        const last = r.rope.n - 1;
        const pin = r.rope.pins[last];
        if (pin) {
          const [wx, wy] = r.buoy.toWorld(r.buoy.pivotX, 0);
          pin[0] = wx;
          pin[1] = wy - 2;
          r.rope.sleeping = false;
        }
      }
    }
  }
}

function onHit(c: Prop<Refs>, hit: Hit): void {
  const r = c.refs;
  const side = hit.dir[0] < 0 ? -1 : 1;
  if (hit.type === "wind") {
    r.bobV.impulse(-2);
    return;
  }
  r.sway.impulse(side * (hit.type === "slash" || hit.type === "point" ? 0.35 : 0.7));
  r.bobV.impulse(-4);
  r.ringT = 0;
  c.damage(hit);
  const [x, y] = r.post.toWorld(r.post.pivotX, r.post.pivotY);
  puff(c.world, "water", x + side * 4, y - 1, 6, [side * 0.4, -1], { speed: 0.6, spread: 0.7 });
}

// ---------------------------------------------------------------------------

/**
 * The ferry bell's post at Pier's End: a tall timber post on the pier with a
 * short crossbeam the bell's yoke hangs from (place the kit's hangingBell,
 * size "small", at the beam's end: `hook` gives it, in H from the post's foot).
 * Sways a little when hit and chips (it mends). Origin: the post's foot.
 */
export const bellPost = defineRecipe<{ height: number; reach: number; back: boolean }, { post: Part; sway: Spring }>({
  id: "bellPost",
  breakage: "heal",
  reason: "Timber posts to hang things from: the ferry bell at the end of the pier where the ferryman can hear it, the yard shrine's donor plaque.",
  defaults: { height: 1.55, reach: 0.42, back: false },
  cues: ["wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const pw = Math.max(5, u(0.08)), Ht = u(p.height), R = u(p.reach);
    const W = pw + R + 4;
    const post = b.part("post", { w: W, h: Ht, pivot: [pw >> 1, Ht], at: [0, 0], layer: p.back ? "bg" : "mid", z: p.back ? 1 : 6, smoothRotate: true });
    post.rect(0, 2, pw, Ht - 2, { mat: "woodDark", profile: "cylV", piece: "post" });
    post.grain({ dir: "v", seed: p.seed, mats: ["woodDark"] });
    if (R > 0) {
      post.rect(0, u(0.06), W, u(0.07), { mat: "woodDark", profile: "bevel", r: 2, depth: 3, z: 1, piece: "beam" });
      post.stroke([pw, u(0.3), pw + u(0.2), u(0.12)], 3, { mat: "woodDark", z: 1, piece: "brace" });
    }
    post.rect(0, 0, pw, 3, { mat: "wood", profile: "dome", r: 1, z: 2, piece: "cap" });
    post.rect(-1, Ht - u(0.12), pw + 2, 2, { mat: "iron", profile: "cylH", z: 2, piece: "band" });
    post.speckle({ amount: 0.1, seed: p.seed + 1, tone: -1, mats: ["woodDark"] });
    return { post: b.get("post"), sway: new Spring(80, 6) };
  },
  initial: "idle",
  states: {
    idle: {
      update(c, dt) {
        const r = c.refs;
        if (r.sway.resting) return;
        r.sway.step(dt);
        r.post.rot = Math.max(-0.05, Math.min(0.05, r.sway.x));
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.refs.sway.impulse((h.hit.dir[0] < 0 ? -1 : 1) * 0.2);
        c.damage(h.hit);
      },
    },
  },
  demo: {
    w: 3,
    with: [{ id: "hangingBell", params: { size: "small", usable: true }, dx: 0.42, at: 1.47 }],
    script: [
      { label: "the ferry bell's post", wait: 1 },
      { label: "slash: sways, chips", hit: "slash", from: -0.7, wait: 1.4 },
    ],
  },
});

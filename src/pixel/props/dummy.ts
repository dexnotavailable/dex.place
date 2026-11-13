// Training dummy: a straw-stuffed burlap figure on a post, arms on a
// crossbar, a painted target on its chest. It reacts to every hit type and
// never dies: a slash rocks it and knocks straw loose, a heavy hit bends it
// far back on its post, Q bounces it off the ground, R shudders it, a point
// hit twitches it, the dash's wind sways it. It always springs back.
// Origin: floor, centre.

import { Spring } from "../motion.ts";
import { puff } from "../kit.ts";
import { hitCentre, type Hit } from "../hits.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

interface Refs {
  body: Part;
  lean: Spring;
  hop: Spring;
  shudder: number;
  hits: number;
}

export const trainingDummy = defineRecipe<Record<string, never>, Refs>({
  id: "trainingDummy",
  breakage: "never",
  reason: "Somewhere to try your moves where nothing is hurt: in the keeper's yard and the waiting room; it answers every hit and always stands back up.",
  defaults: {},
  cues: ["dummy.hit", "dummy.thump"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    // the base: crossed feet and a stake
    const bw = u(0.5), bh = u(0.12);
    const base = b.part("base", { w: bw, h: bh, pivot: [bw >> 1, bh], at: [0, 0], layer: "mid", z: 5 });
    base.rect(0, bh - u(0.05), bw, u(0.05), { mat: "wood", profile: "bevel", r: 1, depth: 2 });
    base.poly([(bw >> 1) - u(0.05), bh - u(0.05), (bw >> 1) + u(0.05), bh - u(0.05), (bw >> 1) + u(0.03), 0, (bw >> 1) - u(0.03), 0], { mat: "woodDark", profile: "cylV", piece: "stake" });
    base.rivets([[3, bh - 3], [bw - 3, bh - 3]], { mat: "iron", r: 0.9 });
    // the body pivots at the stake's top
    const W = u(0.6), Ht = u(1.05);
    const cx = W >> 1;
    const bd = b.part("body", { w: W, h: Ht, pivot: [cx, Ht], at: [0, -bh + 2], layer: "mid", z: 6, smoothRotate: true });
    bd.piece("post");
    bd.rect(cx - u(0.035), u(0.2), u(0.07), Ht - u(0.2), { mat: "wood", profile: "cylV" });
    bd.grain({ dir: "v", seed: p.seed, mats: ["wood"] });
    // crossbar arms wrapped in burlap
    bd.piece("arms");
    bd.rect(u(0.02), u(0.36), W - u(0.04), u(0.06), { mat: "wood", profile: "cylH" });
    for (const x of [u(0.02), W - u(0.12)]) bd.roundRect(x, u(0.33), u(0.1), u(0.12), 3, { mat: "burlap", profile: "dome", r: 3, z: 2, piece: "fist" });
    // the torso sack, bound with rope, straw poking out
    bd.piece("torso");
    bd.poly([cx - u(0.16), u(0.34), cx + u(0.16), u(0.34), cx + u(0.19), u(0.62), cx + u(0.14), u(0.8), cx - u(0.14), u(0.8), cx - u(0.19), u(0.62)], { mat: "burlap", profile: "dome", r: 6, z: 3 });
    bd.speckle({ amount: 0.15, seed: p.seed + 1, tone: -1, mats: ["burlap"] });
    for (const y of [u(0.44), u(0.76)]) bd.rect(cx - u(0.18), y, u(0.36), 2, { mat: "rope", profile: "cylH", z: 6, piece: "binding" });
    // the painted target (the red of the route, faded)
    bd.ring(cx, u(0.6), u(0.03), u(0.075), { mat: "clothRed", mode: "paint", tone: -1 });
    bd.circle(cx, u(0.6), u(0.018), { mat: "clothRed", mode: "paint", tone: 0 });
    for (const [x, y, dx] of [[cx - u(0.18), u(0.8), -1], [cx + u(0.17), u(0.8), 1], [cx - u(0.2), u(0.5), -1]] as const) bd.line(x, y, x + dx * 4, y + 3, { mat: "straw", z: 4, piece: "straw" });
    // the head sack, tied at the neck
    bd.piece("head");
    bd.circle(cx, u(0.22), u(0.1), { mat: "burlap", profile: "dome", r: 5, z: 3 });
    bd.rect(cx - u(0.06), u(0.31), u(0.12), 3, { mat: "rope", profile: "cylH", z: 5, piece: "neck" });
    bd.line(cx - 2, u(0.12), cx + 3, u(0.11), { mat: "straw", z: 4, piece: "straw" });
    bd.line(cx + 1, u(0.12), cx + 5, u(0.1), { mat: "straw", z: 4, piece: "straw" });
    return { body: b.get("body"), lean: new Spring(46, 3.6), hop: new Spring(160, 9), shudder: 0, hits: 0 };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit, h.contact),
    },
  },
  demo: {
    w: 4,
    script: [
      { label: "idle", wait: 0.5 },
      { label: "slash", hit: "slash", from: -0.8, wait: 1.3 },
      { label: "point", hit: "point", from: -0.05, wait: 0.8 },
      { label: "heavy: bends far back", hit: "heavy", from: -1.0, wait: 1.8 },
      { label: "Q: bounces", hit: "q", from: -1.0, wait: 1.8 },
      { label: "R: shudders", hit: "r", from: -1.0, wait: 1.5 },
      { label: "dash wind: sways", hit: "wind", from: -1.3, wait: 1.5 },
    ],
  },
});

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const [wx] = c.world.windAt(c.x, c.y - c.params.H * 0.6);
  r.lean.target = Math.max(-0.12, Math.min(0.12, wx * 0.0002));
  if (r.lean.resting && r.hop.resting && r.shudder <= 0 && Math.abs(r.lean.target) < 1e-3) return;
  r.lean.step(dt);
  r.hop.step(dt);
  r.shudder = Math.max(0, r.shudder - dt);
  r.body.rot = Math.max(-0.95, Math.min(0.95, r.lean.x));
  r.body.offY = Math.min(0, Math.round(r.hop.x));
  r.body.offX = r.shudder > 0 ? ((c.world.stats.steps >> 1) % 2 ? 1 : -1) : 0;
}

function onHit(c: Prop<Refs>, hit: Hit, contact: [number, number] | null): void {
  const r = c.refs;
  const s = (hit.dir[0] < 0 ? -1 : 1) * c.flip; // local lean (the part turns with the prop's flip)
  const [x, y] = contact ?? hitCentre(hit.shape);
  switch (hit.type) {
    case "slash":
      r.lean.impulse(s * 2.4);
      puff(c.world, "straw", x, y, 6, [s, -0.8], { speed: 0.8 });
      break;
    case "point":
      r.lean.impulse(s * 0.9);
      puff(c.world, "straw", x, y, 2, [s, -0.5], { speed: 0.5 });
      break;
    case "heavy":
      r.lean.impulse(s * 5.2);
      puff(c.world, "straw", x, y, 10, [s, -0.4], { speed: 1 });
      break;
    case "q":
      r.hop.impulse(-c.params.H * 2.6);
      r.lean.impulse(s * 2);
      puff(c.world, "straw", c.x, c.y - c.params.H * 0.6, 12, [0, -1], { speed: 1.1, spread: 1.6 });
      break;
    case "r":
      r.shudder = 0.6;
      r.lean.impulse((c.rand() - 0.5) * 3);
      puff(c.world, "straw", c.x, c.y - c.params.H * 0.6, 8, [0, -1], { speed: 0.9, spread: 1.8 });
      break;
    case "wind":
      r.lean.impulse(s * 1.2);
      return;
  }
  r.hits++;
  c.damage(hit);
  c.sound(hit.type === "q" || hit.type === "heavy" ? "dummy.thump" : "dummy.hit", 0.8);
}

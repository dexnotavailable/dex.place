// The chapel porch's small story (lane R-E, WORLD-PLAN E2): a broom leaning
// by the door, an old shawl on a hook and a dusty second cup on the sill.
// Someone used to come up here for her break. Nobody says so; the props do.
// None of them break (story props): the broom tips over and is found leaning
// again later, the shawl sways in the wind and when brushed, the cup rocks
// on its saucer and a little dust lifts.

import "./materials.ts";
import { puff } from "../../kit.ts";
import { Spring } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Cloth } from "../../motion.ts";
import type { Part } from "../../part.ts";
import type { Hit } from "../../hits.ts";

// ---------------------------------------------------------------------------------
// Broom

interface BroomRefs {
  broom: Part;
  lean: number;
  rot: number;
  vel: number;
}

export const broom = defineRecipe<{ lean: number }, BroomRefs>({
  id: "broom",
  breakage: "never",
  reason: "The keeper's story told by props: a broom leaning by the chapel door, where someone kept the porch swept (WORLD-PLAN E2).",
  defaults: { lean: 0.16 },
  cues: ["wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(1.25), W = u(0.3);
    const br = b.part("broom", { w: W, h: L, pivot: [W >> 1, L - 1], at: [0, 0], layer: "mid", z: 5, smoothRotate: true });
    const cx = W >> 1;
    // the handle, a worn grip, the binding and the straw head
    br.rect(cx - 1, 0, 3, L - u(0.34), { mat: "oak", profile: "cylV", piece: "handle" });
    br.rect(cx - 1, u(0.1), 3, u(0.14), { mat: "oak", mode: "paint", tone: 1 });
    br.rect(cx - 3, L - u(0.36), 7, u(0.05), { mat: "rope", profile: "cylH", z: 2, piece: "binding" });
    br.poly([cx - 3, L - u(0.32), cx + 3, L - u(0.32), W - 1, L - 1, 0, L - 1], { mat: "broomStraw", profile: "dome", r: 3, piece: "straw" });
    for (let x = 2; x < W - 2; x += 2) br.line(cx + (x - cx) * 0.3, L - u(0.3), x, L - 2, { mat: "broomStraw", mode: "paint", tone: (x >> 1) % 2 ? -1 : 0 });
    br.rect(0, L - 2, W, 1, { mat: "broomStraw", mode: "paint", tone: -1 });
    const part = b.get("broom");
    part.rot = p.lean;
    return { broom: part, lean: p.lean, rot: p.lean, vel: 0 };
  },
  initial: "leaning",
  states: {
    leaning: {
      update: (c, dt) => settle(c, dt, c.refs.lean),
      hit(c, h) {
        const push = pushOf(h.hit);
        c.refs.vel += push * 3;
        c.sound("wood.hit", 0.4);
        if (Math.abs(push) > 0.9 || h.hit.type === "q" || h.hit.type === "r") return "fallen";
      },
    },
    fallen: {
      enter(c) {
        c.refs.vel = 0;
      },
      update(c, dt) {
        // it slides down the doorframe and lies on the flags
        const r = c.refs;
        const to = (Math.PI / 2 - 0.06) * Math.sign(r.rot || 1);
        r.rot += (to - r.rot) * Math.min(1, dt * 9);
        r.broom.rot = r.rot;
        if (c.t > 0.25 && c.t - dt <= 0.25) {
          const [x, y] = r.broom.toWorld(0, r.broom.grid.h);
          puff(c.world, "dust", x, c.y - 2, 4, [0, -1], { speed: 0.3 });
          c.sound("wood.hit", 0.6);
          void y;
        }
      },
      after: [9, "leaning"],
    },
  },
  demo: {
    w: 3,
    script: [
      { label: "leaning", wait: 0.8 },
      { label: "slash: it rocks", hit: "slash", from: -0.7, wait: 1.5 },
      { label: "heavy: it falls", hit: "heavy", from: -0.7, wait: 2 },
      { label: "found leaning again", wait: 8 },
    ],
  },
});

function pushOf(hit: Hit): number {
  const side = hit.dir[0] < 0 ? -1 : 1;
  const k = hit.type === "wind" ? 0.3 : hit.type === "slash" || hit.type === "point" ? 0.6 : 1.2;
  return side * k;
}

function settle(c: Prop<BroomRefs>, dt: number, rest: number): void {
  const r = c.refs;
  r.vel += (-(r.rot - rest) * 60 - r.vel * 7) * dt;
  r.rot += r.vel * dt;
  // a doorframe on one side: it can only rock so far
  r.rot = Math.max(rest - 0.25, Math.min(rest + 0.3, r.rot));
  r.broom.rot = r.rot;
}

// ---------------------------------------------------------------------------------
// Shawl on a hook

interface ShawlRefs {
  cloth: Cloth;
  part: Part;
}

export const shawl = defineRecipe<{ width: number; length: number }, ShawlRefs>({
  id: "shawl",
  breakage: "never",
  reason: "An old shawl left on a hook by the chapel door (WORLD-PLAN E2): cloth that sways in the dusk wind and tells, with the second cup, that someone used to take her break here.",
  defaults: { width: 0.5, length: 0.72 },
  cues: ["cloth.hit"],
  feel: 0.6,
  build(b, p) {
    const u = (f: number): number => b.u(f);
    // the hook: an iron peg in a little wooden plate
    const hk = b.part("hook", { w: u(0.12), h: u(0.12), pivot: [u(0.06), u(0.06)], at: [0, 0], layer: "bg", z: 8, hittable: false });
    hk.rect(0, 0, u(0.12), u(0.12), { mat: "oak", profile: "bevel", r: 2, depth: 2, piece: "plate" });
    hk.rect(u(0.06) - 1, u(0.03), 3, u(0.08), { mat: "iron", profile: "cylV", z: 3, piece: "peg" });
    // the design: faded rose wool with a darker border and a fringe at the hem
    const w = u(p.width), h = u(p.length);
    const src = b.canvas(w, h);
    src.rect(0, 0, w, h - 4, { mat: "shawlRose", profile: "flat", depth: 2 });
    src.rect(0, 0, w, 2, { mat: "shawlRose", mode: "paint", tone: -1 });
    src.rect(0, h - 7, w, 2, { mat: "shawlRose", mode: "paint", tone: -1 });
    for (let x = 3; x < w - 2; x += 6) src.rect(x, 4, 1, h - 12, { mat: "shawlRose", mode: "paint", tone: -1 });
    for (let x = 1; x < w - 1; x += 2) src.rect(x, h - 4, 1, 4, { mat: "shawlRose", profile: "flat", tone: x % 4 === 1 ? 0 : -1 });
    src.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["shawlRose"] });
    src.grid.computeNormals({ x0: 0, y0: 0, x1: src.grid.W - 1, y1: src.grid.Hh - 1 });
    const sp = Math.max(4, Math.round(w / 8));
    const { cloth, part } = b.cloth("cloth", { src: src.grid, spacing: sp, x: -w / 2, y: u(0.06), pinTop: false, bottomMass: 1.4, damping: 0.97, windGain: 0.8, foldGain: 1.3, sleep: 10, layer: "mid", room: [w * 0.5, 6, w * 0.5, h * 0.4] });
    // hung from its middle on the peg: pin the top row's middle two points, the rest drapes
    const mid = Math.floor((cloth.cols - 1) / 2);
    for (const k of [mid, mid + 1]) cloth.pin(k, cloth.p[k * 3]!, cloth.p[k * 3 + 1]!, 0);
    part.z = 9;
    return { cloth, part };
  },
  initial: "hanging",
  states: {
    hanging: {
      hit(c, h) {
        const H = c.params.H;
        const [x0, y0, x1, y1] = c.refs.cloth.bounds();
        const f = h.hit.type === "wind" ? 1.2 : 2;
        c.refs.cloth.push((x0 + x1) / 2, (y0 + y1) / 2, H * 1.4, h.hit.dir[0] * f, -0.3, f);
        if (h.hit.type !== "wind") c.sound("cloth.hit", 0.4);
      },
    },
  },
  demo: {
    indoor: true,
    at: 1.35,
    w: 3,
    script: [
      { label: "hanging on its hook", wait: 1.5 },
      { label: "dash past: it sways", hit: "wind", from: -1.2, wait: 2.5 },
      { label: "slash: it swings, never tears", hit: "slash", from: -0.5, wait: 2.5 },
    ],
  },
});

// ---------------------------------------------------------------------------------
// The dusty second cup

interface CupRefs {
  cup: Part;
  wob: Spring;
}

export const dustyCup = defineRecipe<Record<string, never>, CupRefs>({
  id: "dustyCup",
  breakage: "never",
  reason: "A second cup on the porch sill, grey with dust: someone used to bring two (WORLD-PLAN E2; the keeper sets down two cups at the end of the round).",
  defaults: {},
  cues: ["cup.rattle"],
  build(b) {
    const u = (f: number): number => b.u(f);
    const W = u(0.22), Hh = u(0.14);
    const cx = W >> 1;
    const cp = b.part("cup", { w: W, h: Hh, pivot: [cx, Hh], at: [0, 0], layer: "mid", z: 6, smoothRotate: true });
    // saucer, the cup's body, its handle, and a bloom of dust on the rim
    cp.ellipse(cx, Hh - 2, W * 0.46, 2, { mat: "stoneware", profile: "dome", r: 2, piece: "saucer" });
    cp.poly([cx - u(0.06), Hh - u(0.1), cx + u(0.06), Hh - u(0.1), cx + u(0.05), Hh - 3, cx - u(0.05), Hh - 3], { mat: "stoneware", profile: "cylV", z: 2, piece: "body" });
    cp.ring(cx + u(0.075), Hh - u(0.065), 1.2, 2.8, { mat: "stoneware", profile: "dome", r: 1, z: 1, piece: "handle" });
    cp.rect(cx - u(0.06), Hh - u(0.1), u(0.12), 1, { mat: "dustBloom", mode: "paint" });
    cp.speckle({ amount: 0.3, seed: 3, tone: 0, mats: ["stoneware"], region: { x0: 0, y0: 0, x1: W - 1, y1: Hh - u(0.07) } });
    cp.pixels([[cx - 2, Hh - u(0.08)], [cx + 1, Hh - u(0.09)], [cx + 3, Hh - u(0.07)]], { mat: "dustBloom", mode: "paint" });
    return { cup: b.get("cup"), wob: new Spring(260, 9) };
  },
  initial: "still",
  states: {
    still: {
      update(c, dt) {
        const w = c.refs.wob;
        if (Math.abs(w.x) < 1e-3 && Math.abs(w.v) < 1e-3) return;
        w.step(dt);
        c.refs.cup.rot = Math.max(-0.25, Math.min(0.25, w.x));
      },
      hit(c, h) {
        c.refs.wob.impulse((h.hit.dir[0] < 0 ? -1 : 1) * (h.hit.type === "wind" ? 1.2 : 3));
        const [x, y] = c.refs.cup.toWorld(c.refs.cup.pivotX, 2);
        puff(c.world, "dust", x, y, 3, [0, -1], { speed: 0.2 });
        if (h.hit.type !== "wind") c.sound("cup.rattle", 0.5);
      },
    },
  },
  demo: {
    w: 2,
    at: 0.9,
    script: [
      { label: "on the sill, dusty", wait: 0.6 },
      { label: "slash: it rocks on its saucer, dust lifts", hit: "slash", from: -0.6, wait: 1.5 },
    ],
  },
});



// The ferry at Pier's End (WORLD-PLAN A0, S2): a small wooden boat moored in
// front of the pier with the ferryman asleep in its stern, hat over his eyes.
// States: asleep -> (the culvert opens) awake -> boarding -> (the ride) ->
// asleep again when you come back. E while he sleeps gets a sleepy wave and
// nothing else; once the culvert is open E boards and the host takes you on
// the ride (a `door` event, the room's doors table says where). It bobs on
// the water, rocks harder when a footfall ripple passes under it (`ripple`),
// and hits rock it and splinter the hull (it mends). The ferryman has no lines.
// Origin: the waterline under the boat's middle.

import "./materials.ts";
import { puff } from "../../kit.ts";
import { Spring } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { Hit } from "../../hits.ts";

export interface FerryParams {
  /** Hull length in H. */
  length: number;
}

interface Refs {
  hull: Part;
  man: Part;
  head: Part;
  arm: Part;
  rock: Spring;
  heave: Spring;
  wave: number;
}

export const ferryBoat = defineRecipe<FerryParams, Refs>({
  id: "ferryBoat",
  breakage: "heal",
  reason: "The ferry and its ferryman, asleep at Pier's End until the culvert under the causeway is open again; then the short way across the lake to the hollow.",
  defaults: { length: 2.1 },
  use: { reach: 0.6, prompt: "" },
  persist: [],
  cues: ["wood.hit", "water.splash", "ferry.wave", "ferry.board"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.length), above = u(0.22), below = u(0.05);
    const Hh = above + below + 2;
    const hull = b.part("hull", { w: L, h: Hh, pivot: [L >> 1, above], at: [0, 0], layer: "fg", parallax: 1, z: 8, smoothRotate: true });
    // the hull: sheer line rising to bow (left) and stern (right), clinker strakes, a painted band
    const sheer = (x: number): number => {
      const t = x / (L - 1);
      return Math.round(u(0.05) * (Math.pow(1 - t, 3) * 1.2 + Math.pow(t, 3) * 0.8));
    };
    hull.piece("hull");
    const pts: number[] = [];
    for (let x = 0; x < L; x += 2) pts.push(x, sheer(x));
    pts.push(L - 1, sheer(L - 1));
    pts.push(L - u(0.12), Hh - 1, u(0.16), Hh - 1);
    hull.poly(pts, { mat: "ringBoat", profile: "bevel", r: 3, depth: 4 });
    for (let k = 1; k <= 3; k++) {
      const y = Math.round((above * k) / 3.6) + 2;
      hull.line(u(0.08), y, L - u(0.08), y, { mat: "ringBoat", mode: "paint", tone: -1 });
    }
    for (let x = 0; x < L; x++) hull.rect(x, sheer(x), 1, 2, { mat: "wood", mode: "paint", tone: 1 });
    hull.rect(0, above - 2, L, below + 4, { mat: "ringBoat", mode: "paint", tone: -2 });
    hull.rect(u(0.3), Math.round(above * 0.45), u(0.28), 2, { mat: "clothPale", mode: "paint", tone: -1 });
    // oarlock, a cleat, the pole lying along the thwarts
    hull.rect(Math.round(L * 0.45), sheer(Math.round(L * 0.45)) - 3, 3, 3, { mat: "iron", profile: "dome", r: 1, z: 2, piece: "oarlock" });
    hull.stroke([u(0.12), sheer(u(0.12)) - 2, L - u(0.4), sheer(L - u(0.4)) - 3], 2, { mat: "wood", z: 3, piece: "pole" });
    hull.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["ringBoat"] });
    hull.wear({ amount: 0.02, seed: p.seed + 3 });
    // the ferryman in the stern: seated, knees up, a long coat, hat over his eyes
    const mw = u(0.42), mh = u(0.48);
    const sx = L - u(0.55) - (L >> 1);
    const man = b.part("man", { w: mw, h: mh, pivot: [mw >> 1, mh], at: [sx, -above + u(0.08)], layer: "fg", parallax: 1, z: 7 });
    man.piece("coat");
    man.roundRect(u(0.08), u(0.1), u(0.2), mh - u(0.1), 4, { mat: "ringCoat", profile: "dome", r: 4 });
    man.poly([u(0.02), mh, u(0.3), mh, u(0.26), mh - u(0.14), u(0.06), mh - u(0.14)], { mat: "ringCoat", profile: "bevel", r: 3, piece: "knees" });
    man.rect(u(0.1), mh - u(0.24), u(0.16), 2, { mat: "clothTeal", profile: "cylH", z: 2, piece: "scarf" });
    man.speckle({ amount: 0.08, seed: p.seed + 5, tone: -1 });
    const hw = u(0.3), hh = u(0.2);
    const head = b.part("head", { w: hw, h: hh, pivot: [hw >> 1, hh], parent: "man", at: [u(0.18), u(0.12)], layer: "fg", parallax: 1, z: 8, smoothRotate: true });
    head.ellipse(hw / 2, hh - u(0.07), u(0.06), u(0.065), { mat: "ringSkin", profile: "dome", r: 3, piece: "face" });
    head.rect(Math.round(hw / 2) - u(0.05), hh - u(0.035), u(0.1), u(0.035), { mat: "ringHairGrey", profile: "dome", r: 2, z: 1, piece: "beard" });
    // the hat: a wide brim and a low crown, tipped down over the eyes
    head.roundRect(0, hh - u(0.12), hw, u(0.035), 2, { mat: "ringHat", profile: "bevel", r: 2, z: 2, piece: "brim" });
    head.roundRect(Math.round(hw * 0.25), hh - u(0.2), Math.round(hw * 0.5), u(0.09), 3, { mat: "ringHat", profile: "dome", r: 3, z: 2, piece: "crown" });
    head.rect(Math.round(hw * 0.25), hh - u(0.13), Math.round(hw * 0.5), 2, { mat: "leatherDark", profile: "cylH", z: 3, piece: "band" });
    const aw = u(0.1), ah = u(0.22);
    const arm = b.part("arm", { w: aw, h: ah, pivot: [aw >> 1, 2], parent: "man", at: [u(0.1), u(0.16)], layer: "fg", parallax: 1, z: 9, smoothRotate: true });
    arm.roundRect(1, 0, aw - 2, ah - u(0.05), 3, { mat: "ringCoat", profile: "dome", r: 3, piece: "sleeve" });
    arm.ellipse(aw / 2, ah - u(0.035), u(0.035), u(0.035), { mat: "ringSkin", profile: "dome", r: 2, z: 1, piece: "hand" });
    return { hull: b.get("hull"), man: b.get("man"), head: b.get("head"), arm: b.get("arm"), rock: new Spring(26, 2.4), heave: new Spring(30, 3), wave: 0 };
  },
  initial: "asleep",
  states: {
    asleep: {
      enter(c) {
        pose(c, "asleep");
      },
      update: (c, dt) => step(c, dt, true),
      use: () => "waving",
      hit: (c, h) => onHit(c, h.hit),
    },
    waving: {
      sound: "ferry.wave",
      update(c, dt) {
        step(c, dt, false);
        // half wakes, lifts a hand, and sinks back under the hat
        const t = c.t;
        const up = t < 0.4 ? t / 0.4 : t < 1.4 ? 1 : Math.max(0, 1 - (t - 1.4) / 0.6);
        c.refs.arm.rot = -up * 1.9 + Math.sin(t * 7) * 0.25 * up;
        c.refs.head.rot = -up * 0.18;
      },
      after: [2.1, "asleep"],
      hit: (c, h) => onHit(c, h.hit),
    },
    awake: {
      enter(c) {
        pose(c, "awake");
      },
      update: (c, dt) => step(c, dt, false),
      use: () => "boarding",
      hit: (c, h) => onHit(c, h.hit),
    },
    boarding: {
      sound: "ferry.board",
      enter(c) {
        c.refs.heave.impulse(10);
        c.emit({ type: "door", action: "enter" });
      },
      update: (c, dt) => step(c, dt, false),
      after: [1.5, "awake"],
    },
  },
  actions: {
    /** A footfall ripple passes under the boat: it heaves and rocks. */
    ripple: (c, arg) => {
      const k = Number(arg ?? 1);
      c.refs.heave.impulse(6 * k);
      c.refs.rock.impulse(0.05 * k);
    },
  },
  demo: {
    w: 5,
    script: [
      { label: "asleep at the mooring", wait: 1.5 },
      { label: "E: a sleepy wave", use: true, wait: 2.4 },
      { label: "a footfall ripple", act: "ripple", arg: 1.5, wait: 2 },
      { label: "slash: it rocks, the hull splinters", hit: "slash", from: -1.2, wait: 1.8 },
      { label: "the culvert is open: awake", go: "awake", wait: 1.4 },
      { label: "E: board", use: true, wait: 1.6 },
    ],
  },
});

function pose(c: Prop<Refs>, how: "asleep" | "awake"): void {
  const r = c.refs;
  // asleep: slumped a little, the hat tipped down; awake: upright, the hat pushed back
  r.head.rot = 0;
  r.head.offY = how === "asleep" ? 1 : 0;
  r.man.offY = how === "asleep" ? 1 : 0;
  r.arm.rot = how === "asleep" ? 0.2 : -0.5;
}

function step(c: Prop<Refs>, dt: number, sleeping: boolean): void {
  const r = c.refs;
  const t = c.world.time;
  r.rock.step(dt);
  r.heave.step(dt);
  const bob = Math.round(Math.sin(t * 1.3 + c.params.seed) * 1.2 + r.heave.x);
  const rot = Math.sin(t * 0.8 + c.params.seed * 0.3) * 0.012 + r.rock.x;
  if (bob !== r.hull.offY) {
    r.hull.offY = bob;
    r.man.offY = bob + (sleeping ? 1 : 0);
  }
  r.hull.rot = Math.max(-0.12, Math.min(0.12, rot));
  // a sleeper's slow breathing: the hat rises a pixel and falls
  if (sleeping) r.head.offY = 1 + (Math.sin(t * 1.1) > 0.6 ? -1 : 0);
}

function onHit(c: Prop<Refs>, hit: Hit): void {
  const r = c.refs;
  const side = hit.dir[0] < 0 ? -1 : 1;
  if (hit.type === "wind") {
    r.rock.impulse(side * 0.04);
    return;
  }
  r.rock.impulse(side * (hit.type === "slash" || hit.type === "point" ? 0.12 : 0.22));
  r.heave.impulse(5);
  c.damage(hit, ["hull"]);
  const [x, y] = r.hull.toWorld(r.hull.pivotX, r.hull.pivotY);
  puff(c.world, "water", x + side * c.params.H * 0.4, y + 2, 8, [side * 0.3, -1], { speed: 0.7, spread: 0.8 });
}

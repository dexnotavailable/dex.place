// Benches and pews (WORLD-PLAN: seat 0.28 H). E sits: the host holds the
// camera and hides the UI while you sit (event { type: "sit" }, and "stand"
// when you get up). The seat is a one-way platform you can stand on.
//
// kind:
//   stone  a thick plank on two stone blocks (the lookouts: Pier's End,
//          Stonetop, the Blade, the balcony)
//   wood   a slatted bench with a back (lodge, market, waiting room)
//   pew    a chapel pew: tall back, carved end panels, dark wood
//
// Outdoors a bench splinters and mends; in a sway-only room (the nave) it
// only rocks. Origin: floor, centre.

import { Spring } from "../motion.ts";
import { hitPush, puff } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

export interface BenchParams {
  kind: "stone" | "wood" | "pew";
  /** Length in H. */
  length: number;
}

interface Refs {
  body: Part;
  seat: Part;
  rock: Spring;
  seatY: number;
}

export const bench = defineRecipe<BenchParams, Refs>({
  id: "bench",
  breakage: "heal",
  reason: "Places to sit and look: every vista and every cozy room has one, so stopping is always an option (and the camera holds while you sit).",
  defaults: { kind: "wood", length: 1.6 },
  use: { reach: 0.5, prompt: "sit" },
  cues: ["bench.sit", "wood.hit"],
  standard: { h: 0.28, parts: ["seat"], note: "seat top above the floor" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.length);
    const seatTop = u(0.28);
    const pew = p.kind === "pew", stone = p.kind === "stone";
    const backH = pew ? u(0.95) : stone ? 0 : u(0.62);
    const Ht = Math.max(seatTop, backH) + 2;
    const cx = Math.floor(L / 2);
    const wood = pew ? "woodDark" : "wood";
    // legs and back (not collidable), and the seat (a one-way platform)
    const lg = b.part("legs", { w: L, h: Ht, pivot: [cx, Ht], at: [0, 0], layer: "mid", z: 6, smoothRotate: true });
    const bottom = Ht;
    if (stone) {
      for (const x of [u(0.14), L - u(0.14) - u(0.3)]) {
        lg.rect(x, bottom - u(0.22), u(0.3), u(0.22), { mat: "stone", profile: "bevel", r: 3, depth: 4, piece: "block" });
        lg.cracks(x + u(0.15), bottom - u(0.1), { n: 1, len: 5, seed: p.seed + x });
      }
      lg.speckle({ amount: 0.15, seed: p.seed, tone: -1, scale: 2, mats: ["stone"] });
      lg.rect(u(0.1), bottom - 3, L - u(0.2), 3, { mat: "moss", profile: "flat", z: 1, piece: "moss", mode: "under" });
    } else {
      const legX = pew ? [0, L - u(0.08)] : [u(0.12), L - u(0.12) - u(0.06)];
      for (const x of legX) {
        if (pew) {
          // carved end panels, a pointed top above the back
          lg.rect(x, bottom - backH - u(0.1), u(0.08), backH + u(0.1), { mat: wood, profile: "bevel", r: 2, depth: 4, piece: "end" });
          lg.circle(x + u(0.04), bottom - backH - u(0.1), u(0.05), { mat: wood, profile: "dome", r: 3, piece: "end" });
          lg.rect(x + 2, bottom - backH + u(0.1), u(0.08) - 4, u(0.3), { mat: wood, mode: "paint", tone: -1 });
        } else lg.rect(x, bottom - seatTop, u(0.06), seatTop, { mat: wood, profile: "cylV", piece: "leg" });
      }
      if (!pew) lg.rect(u(0.12), bottom - u(0.1), L - u(0.24), 2, { mat: wood, profile: "cylH", piece: "rail" });
      if (backH) {
        // back: two rails (bench) or a solid panel (pew)
        if (pew) {
          // the back: a frame of rails and stiles holding raised panels, a rounded cap rail
          const bt = bottom - backH, bb = bottom - seatTop - 1, bh = bb - bt;
          lg.rect(u(0.06), bt, L - u(0.12), bh, { mat: wood, profile: "flat", depth: 2, piece: "frame", tone: -1 });
          const n = Math.max(3, Math.round((L - u(0.2)) / u(0.36)));
          const pw = (L - u(0.2)) / n;
          for (let k = 0; k < n; k++) {
            const x0 = Math.round(u(0.1) + k * pw) + 2, x1 = Math.round(u(0.1) + (k + 1) * pw) - 2;
            lg.rect(x0, bt + u(0.08), x1 - x0, bh - u(0.16), { mat: wood, profile: "bevel", r: 3, depth: 3, z: 1, piece: "panel" });
            lg.rect(x0 + 3, bt + u(0.08) + 3, x1 - x0 - 6, 1, { mat: wood, mode: "paint", tone: 1 });
          }
          lg.rect(u(0.06), bb - u(0.05), L - u(0.12), u(0.05), { mat: wood, profile: "cylH", z: 2, piece: "rail" });
          lg.rect(u(0.04), bt - 2, L - u(0.08), 5, { mat: wood, profile: "cylH", z: 2, piece: "cap" });
          lg.rect(u(0.04), bt - 2, L - u(0.08), 1, { mat: wood, mode: "paint", tone: 1 });
        } else {
          for (const y of [backH - 3, backH - u(0.18)]) lg.rect(u(0.1), bottom - y, L - u(0.2), u(0.07), { mat: wood, profile: "bevel", r: 1, depth: 2, piece: "backrail" });
          for (const x of [u(0.14), L - u(0.2)]) lg.rect(x, bottom - backH, u(0.05), backH - seatTop, { mat: wood, profile: "cylV", piece: "backpost" });
        }
      }
      lg.grain({ dir: "h", seed: p.seed, mats: [wood], stretch: 16 });
    }
    // the seat plank
    const sh = stone ? u(0.08) : u(0.06);
    const st = b.part("seat", { w: L, h: sh, pivot: [cx, sh], at: [0, -(seatTop - sh)], layer: "mid", z: 7, collide: "platform", smoothRotate: true });
    st.rect(0, 0, L, sh, { mat: wood, profile: "bevel", r: 2, depth: 3 });
    if (!stone) st.rect(0, Math.floor(sh / 2), L, 1, { mat: wood, mode: "paint", tone: -2 });
    st.rect(0, 0, L, 1, { mat: wood, mode: "paint", tone: 1 });
    st.grain({ dir: "h", seed: p.seed + 3, stretch: 18, mats: [wood] });
    st.wear({ amount: 0.03 + p.wear * 0.1, seed: p.seed + 4 });
    return { body: b.get("legs"), seat: b.get("seat"), rock: new Spring(90, 5), seatY: seatTop };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => rock(c, dt),
      use: () => "sat",
      hit: (c, h) => onHit(c, h.hit),
    },
    sat: {
      sound: "bench.sit",
      enter(c) {
        c.emit({ type: "sit", x: c.x, y: c.y - c.refs.seatY });
      },
      update: (c, dt) => rock(c, dt),
      use: () => "idle",
      exit(c) {
        c.emit({ type: "stand" });
      },
      hit: (c, h) => onHit(c, h.hit),
    },
  },
  actions: {
    stand: (c) => (c.state === "sat" ? "idle" : undefined),
  },
  demo: {
    indoor: true,
    w: 7.5,
    params: { kind: "wood" },
    variants: [
      { label: "stone (lookouts)", params: { kind: "stone", length: 1.8 }, dx: -2.5 },
      { label: "pew", params: { kind: "pew", length: 2.2 }, dx: 2.5 },
    ],
    script: [
      { label: "idle", wait: 0.6 },
      { label: "E: sit", use: true, wait: 1 },
      { label: "stand", act: "stand", wait: 0.5 },
      { label: "slash: splinters", hit: "slash", from: -0.8, wait: 1 },
      { label: "heavy: breaks a piece off", hit: "heavy", from: -1.1, wait: 2 },
      { label: "mends", wait: 7 },
    ],
  },
});

function rock(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  if (r.rock.resting) return;
  r.rock.step(dt);
  const a = Math.max(-0.08, Math.min(0.08, r.rock.x));
  r.body.rot = a;
  r.seat.rot = a;
}

function onHit(c: Prop<Refs>, hit: import("../hits.ts").Hit): void {
  if (hit.type === "wind") return;
  const { side, strength } = hitPush(hit, c.params.H);
  c.refs.rock.impulse(side * strength * 0.08);
  const reps = c.damage(hit);
  for (const r of reps) if (r.removed && r.contact) puff(c.world, "splinter", r.contact[0], r.contact[1], 4, [side, -0.5]);
}

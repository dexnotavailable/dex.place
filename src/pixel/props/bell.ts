// Hanging bell on a yoke: the ferry bell (small), the rib bell on the
// pilgrim path (medium) and the chapel bell (large). The bell swings as a
// pendulum under its headstock; its clapper swings on its own and lags, and
// each time it meets the sound bow the bell rings (a sound cue whose volume
// is the strike, a faint ring of light at the mouth, a glint across the
// bronze). States: rest, swinging (rings while it swings), settling back to
// rest. The latch on the balcony rings the chapel bell once by itself: the
// `ring` action. Never breaks. Origin: the yoke's centre (hang it from a beam
// or a rib).

import { Pendulum } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import type { Hit } from "../hits.ts";

export interface BellParams {
  size: "small" | "medium" | "large";
  /** E rings it (the ferry bell, the rib bell). */
  usable: boolean;
}

interface Refs {
  bell: Part;
  clapper: Part;
  swing: Pendulum;
  clap: Pendulum;
  /** Largest relative angle before the clapper meets the bow. */
  gap: number;
  lastStrike: number;
  mouth: number;
}

const HEIGHT = { small: 0.34, medium: 0.6, large: 1.0 };

export const hangingBell = defineRecipe<BellParams, Refs>({
  id: "hangingBell",
  breakage: "never",
  reason: "Bells on the route: the ferry bell calls the boat, the rib bell rings for the brave, and the chapel bell rings once by itself when the latch opens the way home.",
  defaults: { size: "medium", usable: false },
  use: { reach: 0.8, prompt: "ring", zone: [-0.5, 0, 0.5, 1.2] },
  cues: ["bell.ring"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const bh = u(HEIGHT[p.size]);
    const bw = Math.round(bh * 0.92);
    const cx = bw >> 1;
    // the yoke: a timber headstock bound in iron, with its bearing blocks
    const yw = Math.round(bw * 1.5), yh = Math.max(6, Math.round(bh * 0.16));
    const y = b.part("yoke", { w: yw, h: yh + 4, pivot: [yw >> 1, 0], at: [0, 0], layer: "mid", z: 9 });
    y.rect(0, 2, yw, yh, { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "beam" });
    y.grain({ dir: "h", seed: p.seed, stretch: 12, mats: ["woodDark"] });
    for (const x of [Math.round(yw * 0.18), Math.round(yw * 0.72)]) y.rect(x, 1, Math.max(3, Math.round(yw * 0.1)), yh + 2, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 2, piece: "strap" });
    for (const x of [0, yw - 4]) y.rect(x, 0, 4, yh + 4, { mat: "iron", profile: "bevel", r: 1, depth: 3, z: 3, piece: "bearing" });
    // the bell, hung by its crown from the yoke's centre
    const bel = b.part("bell", { w: bw, h: bh, pivot: [cx, 0], at: [0, yh + 2], layer: "mid", z: 10, smoothRotate: true });
    const crown = Math.max(3, Math.round(bh * 0.1));
    bel.ring(cx, crown, Math.max(1, crown * 0.35), crown * 0.9, { mat: "bronze", profile: "dome", r: 2, piece: "crown" });
    // profile: shoulder, waist, flare to the lip
    const pts: number[] = [];
    const prof = (t: number): number => {
      // half-width as a share of bw/2 along the height (0 top .. 1 lip)
      if (t < 0.12) return 0.55 + t * 1.6;
      if (t < 0.7) return 0.74 + (t - 0.12) * 0.12;
      return 0.8 + Math.pow((t - 0.7) / 0.3, 1.6) * 0.2;
    };
    const top = crown + 1, lip = bh - 1;
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push(cx + prof(t) * bw * 0.5, top + t * (lip - top));
    }
    for (let k = 12; k >= 0; k--) {
      const t = k / 12;
      pts.push(cx - prof(t) * bw * 0.5, top + t * (lip - top));
    }
    bel.poly(pts, { mat: "bronze", profile: "cylV", piece: "body" });
    // shoulder rounding, the inscription band and the sound bow's rings
    bel.ellipse(cx, top + 1, bw * 0.3, Math.max(2, bh * 0.07), { mat: "bronze", profile: "dome", r: 3, z: 2, piece: "shoulder" });
    const band = Math.round(top + (lip - top) * 0.28);
    bel.rect(0, band, bw, 1, { mat: "bronze", mode: "paint", tone: 1 });
    bel.rect(0, band + 2, bw, 1, { mat: "bronze", mode: "paint", tone: -1 });
    if (bh >= 40) for (let x = Math.round(bw * 0.3); x < bw * 0.7; x += 3) bel.pixels([[x, band + 4], [x + 1, band + 5]], { mat: "bronze", mode: "paint", tone: -2 });
    const bow = Math.round(top + (lip - top) * 0.82);
    bel.rect(0, bow, bw, 2, { mat: "bronze", mode: "raise", depth: 1 });
    bel.rect(0, bow, bw, 1, { mat: "bronze", mode: "paint", tone: 1 });
    bel.rect(0, lip - 1, bw, 2, { mat: "bronze", mode: "paint", tone: -1 });
    bel.speckle({ amount: 0.1, seed: p.seed + 2, tone: -1, mats: ["bronze"] });
    bel.speckle({ amount: 0.05, seed: p.seed + 3, tone: 1, mats: ["bronze"] });
    // the clapper: an iron rod with a ball, swinging from the same point
    const cw = Math.max(3, Math.round(bh * 0.14)), ch = Math.round(bh * 0.86);
    const cl = b.part("clapper", { w: cw, h: ch, pivot: [cw >> 1, 0], at: [0, yh + 2 + crown], layer: "mid", z: 9, smoothRotate: true, hittable: false });
    cl.rect((cw >> 1) - 1, 0, 2, ch - cw, { mat: "iron", profile: "cylV" });
    cl.circle(cw / 2, ch - cw / 2, cw / 2, { mat: "iron", profile: "dome", r: 2, piece: "ball" });
    const G = u(17.5);
    const refs: Refs = {
      bell: b.get("bell"), clapper: b.get("clapper"),
      swing: new Pendulum(bh * 0.55, G, 0.35), clap: new Pendulum(ch * 0.8, G, 0.25),
      gap: Math.atan((bw * 0.36) / ch), lastStrike: -1, mouth: bh,
    };
    return refs;
  },
  initial: "rest",
  states: {
    rest: {
      update: (c, dt) => step(c, dt),
      use: (c) => (c.params["usable"] ? ring(c, 1) : undefined),
      hit: (c, h) => onHit(c, h.hit),
    },
    swinging: {
      update(c, dt) {
        step(c, dt);
        const r = c.refs;
        if (Math.abs(r.swing.angle) < 0.01 && Math.abs(r.swing.vel) < 0.02 && Math.abs(r.clap.vel) < 0.05) {
          r.swing.angle = r.swing.vel = r.clap.angle = r.clap.vel = 0;
          r.bell.rot = r.clapper.rot = 0;
          c.go("rest");
        }
      },
      use: (c) => (c.params["usable"] ? ring(c, 1) : undefined),
      hit: (c, h) => onHit(c, h.hit),
    },
  },
  actions: {
    /** Ring it once (the latch's bell, a ferry call): a firm push so the clapper strikes. */
    ring: (c, arg) => ring(c, Number(arg ?? 1)),
  },
  demo: {
    w: 5,
    at: 2.4,
    params: { size: "large" },
    variants: [
      { label: "ferry bell", params: { size: "small", usable: true }, dx: -1.9, at: 1.6 },
      { label: "rib bell", params: { size: "medium" }, dx: 1.8, at: 2.0 },
    ],
    script: [
      { label: "at rest", wait: 0.8 },
      { label: "ring (the latch rings it by itself)", act: "ring", wait: 3.5 },
      { label: "slash it: struck, it swings and rings", hit: "slash", from: -0.8, wait: 3 },
      { label: "heavy", hit: "heavy", from: -1.1, wait: 3 },
      { label: "settles", wait: 4 },
    ],
  },
});

function ring(c: Prop<Refs>, k: number): string {
  const r = c.refs;
  r.swing.impulse((r.swing.angle >= 0 ? 1 : -1) * 2.2 * Math.max(0.3, k));
  return "swinging";
}

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const [wx] = c.world.windAt(r.bell.wx, r.bell.wy);
  const wt = wx * 0.00025;
  if (c.state === "rest" && Math.abs(wt) < 0.02) return;
  r.swing.step(dt, wt);
  r.clap.step(dt, wt * 1.4);
  // the clapper meets the sound bow: a strike
  const rel = r.clap.angle - r.swing.angle;
  if (Math.abs(rel) > r.gap) {
    const relV = r.clap.vel - r.swing.vel;
    r.clap.angle = r.swing.angle + Math.sign(rel) * r.gap;
    if (Math.sign(relV) === Math.sign(rel)) {
      const strike = Math.abs(relV);
      r.clap.vel = r.swing.vel - relV * 0.35;
      if (strike > 0.35 && c.age - r.lastStrike > 0.18) strikeBell(c, Math.min(1, strike / 3));
    }
  }
  r.bell.rot = Math.max(-1.2, Math.min(1.2, r.swing.angle));
  r.clapper.rot = r.clap.angle;
}

function strikeBell(c: Prop<Refs>, v: number): void {
  const r = c.refs;
  r.lastStrike = c.age;
  c.sound("bell.ring", 0.35 + v * 0.65);
  c.emit({ type: "bell", strength: v });
  r.bell.glintT = 0;
  // a faint ring of light at the mouth (gentle and slow, so it passes the gate unforced)
  const [x, y] = r.bell.toWorld(r.bell.pivotX, r.mouth);
  c.world.flashGlow({ kind: "ring", x, y, colour: [1, 0.86, 0.6], radius: r.mouth * (0.7 + v * 0.5), intensity: 0.12 + v * 0.18, flat: 0.35, x1: 0, y1: 0, width1: 0, thick: 2 }, 0.6);
}

function onHit(c: Prop<Refs>, hit: Hit): string | void {
  const r = c.refs;
  const side = hit.dir[0] < 0 ? -1 : 1;
  const k = hit.type === "wind" ? 0.5 : hit.type === "slash" || hit.type === "point" ? 1.6 : hit.type === "heavy" ? 2.6 : 3.2;
  r.swing.impulse(side * k);
  if (hit.type !== "wind") {
    c.damage(hit);
    // struck metal rings at once
    strikeBell(c, Math.min(1, k / 3));
  }
  return "swinging";
}

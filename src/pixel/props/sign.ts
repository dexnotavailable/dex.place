// Signs. Real words only, and never selling copy (CANON): the ferry board,
// the bus stop's route sign, the archive's lettering, the lift foot's
// arrow. No text is invented here: `lines` comes from the room.
//
// kind:
//   board    a painted plank board, on two posts or on a wall
//   hanging  a board under an iron bracket on two short chains: it swings
//   post     an arrow board on a post (route signs, the lift arrow)
//   neon     tube letters on a dark backing (the market): lit, flicker
//            (tubes drop out for a moment, through the flash gate), spark
//            (when hit), dark
//
// Letters use the engine's 3x5 font at `scale` px per font pixel. Boards are
// worn wood that dents and mends; neon tubes never break (they spark).
// Origin: floor, centre (wall and hanging: the mount point).

import type { PartBuilder } from "../builder.ts";
import { textPixels, type MatRef } from "../materials.ts";
import { Pendulum } from "../motion.ts";
import { matId, puff } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import type { Hit } from "../hits.ts";

export interface SignParams {
  kind: "board" | "hanging" | "post" | "neon";
  /** The words, one entry per line (real text only; empty = a blank board). */
  lines: string[];
  /** Font pixel size (1 or 2). */
  scale: number;
  /** Board: on posts (floor) or on a wall. */
  mount: "floor" | "wall";
  /** Arrow direction for post signs: +1 right, -1 left. */
  arrow: 1 | -1;
  neon: "rose" | "teal";
  lit: boolean;
}

interface Refs {
  board: Part;
  letters: number[];
  swing: Pendulum | null;
  lit: boolean;
  flick: number;
  nextFlicker: number;
}

function textSize(lines: string[], s: number): { w: number; h: number } {
  let w = 0;
  for (const l of lines) w = Math.max(w, textPixels(l).w);
  return { w: w * s, h: Math.max(1, lines.length) * 6 * s - s };
}

/** Letters as cells: painted (tone) into what is there, or raised tubes. */
function letters(b: PartBuilder, lines: string[], x0: number, y0: number, s: number, o: { mat: MatRef; tone?: number; raised?: boolean; boxW: number }): number[] {
  const out: number[] = [];
  lines.forEach((line, k) => {
    const { pts, w } = textPixels(line);
    const lx = x0 + Math.round((o.boxW - w * s) / 2);
    const ly = y0 + k * 6 * s;
    for (const [px, py] of pts) {
      if (o.raised) b.rect(lx + px * s, ly + py * s, s, s, { mat: o.mat, profile: "flat", depth: 1.5, z: 2, piece: "letters", noInk: true });
      else b.rect(lx + px * s, ly + py * s, s, s, { mat: o.mat, mode: "paint", tone: o.tone ?? -2 });
      for (let a = 0; a < s; a++) for (let c = 0; c < s; c++) out.push(b.grid.inner(lx + px * s + a, ly + py * s + c));
    }
  });
  return out;
}

export const sign = defineRecipe<SignParams, Refs>({
  id: "sign",
  breakage: "heal",
  reason: "Words people put up for each other: where the ferry goes, which bus once stopped here, which way the lift is, what the archive is; the market's one neon sign keeps the city awake.",
  defaults: { kind: "board", lines: [], scale: 2, mount: "floor", arrow: 1, neon: "rose", lit: true },
  cues: ["neon.buzz", "neon.spark", "wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const s = Math.max(1, Math.min(3, Math.round(p.scale)));
    const lines = p.lines.map((l) => l.slice(0, 18));
    const ts = textSize(lines.length ? lines : ["          "], s);
    const pad = u(0.08);
    let letterCells: number[] = [];
    let swing: Pendulum | null = null;
    if (p.kind === "neon") {
      const bw = ts.w + pad * 2, bh = ts.h + pad * 2;
      const bd = b.part("board", { w: bw, h: bh, pivot: [bw >> 1, bh >> 1], at: [0, 0], layer: "bg", z: 10 });
      bd.rect(0, 0, bw, bh, { mat: "stoneDark", profile: "bevel", r: 2, depth: 3, piece: "backing" });
      bd.rect(2, 2, bw - 4, bh - 4, { mat: "soot", mode: "paint" });
      bd.rivets([[3, 3], [bw - 4, 3], [3, bh - 4], [bw - 4, bh - 4]], { mat: "iron", r: 1 });
      letterCells = letters(bd, lines, pad, pad, s, { mat: "neonTube", raised: true, boxW: ts.w });
      b.light({ part: "board", at: [bw / 2, bh / 2], colour: p.neon === "teal" ? [0.4, 1, 0.9] : [1, 0.45, 0.55], radius: u(2.2), intensity: 0.55, flicker: 0.05 });
      b.glow({ part: "board", at: [bw / 2, bh / 2], colour: p.neon === "teal" ? [0.3, 0.8, 0.75] : [0.9, 0.3, 0.4], radius: Math.max(bw, bh) * 0.6, intensity: 0.22, flat: bh / bw });
    } else if (p.kind === "post") {
      const bw = ts.w + pad * 2 + u(0.1), bh = ts.h + pad * 2;
      const ph = u(1.3);
      const post = b.part("post", { w: u(0.08), h: ph, pivot: [u(0.04), ph], at: [0, 0], layer: "mid", z: 6 });
      post.rect(0, 0, u(0.08), ph, { mat: "wood", profile: "cylV" });
      post.grain({ dir: "v", seed: p.seed, mats: ["wood"] });
      const a = p.arrow;
      const bd = b.part("board", { w: bw, h: bh, pivot: [a > 0 ? u(0.06) : bw - u(0.06), 0], at: [0, -ph + u(0.08)], layer: "mid", z: 7 });
      const tip = u(0.1);
      bd.poly(a > 0 ? [0, 0, bw - tip, 0, bw, bh / 2, bw - tip, bh, 0, bh] : [tip, 0, bw, 0, bw, bh, tip, bh, 0, bh / 2], { mat: "wood", profile: "bevel", r: 2, depth: 3 });
      bd.rect(0, 1, bw, 1, { mat: "wood", mode: "paint", tone: 1 });
      bd.grain({ dir: "h", seed: p.seed + 1, mats: ["wood"], stretch: 14 });
      letterCells = letters(bd, lines, a > 0 ? pad : pad + u(0.1), pad, s, { mat: "parchment", tone: 0, boxW: ts.w });
      bd.rivets([[a > 0 ? u(0.04) : bw - u(0.04), bh >> 1]], { mat: "iron", r: 1.2 });
    } else {
      const bw = ts.w + pad * 2, bh = ts.h + pad * 2;
      const hanging = p.kind === "hanging";
      if (hanging) {
        // an iron bracket arm from the wall, two chains down to the board
        const aw = bw + u(0.2);
        const arm = b.part("arm", { w: aw, h: u(0.1), pivot: [0, 0], at: [-u(0.1), 0], layer: "mid", z: 6 });
        arm.rect(0, 0, 4, u(0.1), { mat: "iron", profile: "bevel", r: 1, depth: 3, piece: "plate" });
        arm.rect(0, 1, aw, 3, { mat: "iron", profile: "cylH" });
        arm.stroke([2, u(0.09), u(0.12), 3], 2, { mat: "iron", piece: "strut" });
        arm.circle(aw - 2, 2, 2.2, { mat: "iron", profile: "dome", r: 2, piece: "finial" });
        swing = new Pendulum(u(0.35), u(17.5), 1.4);
      }
      const chain = hanging ? u(0.12) : 0;
      const bd = b.part("board", { w: bw, h: bh + chain, pivot: [bw >> 1, 0], at: hanging ? [Math.round((bw + u(0.2)) / 2) - u(0.1), 3] : [0, p.mount === "floor" ? -u(1.2) : 0], layer: p.mount === "wall" && !hanging ? "bg" : "mid", z: 7, smoothRotate: hanging });
      if (hanging) for (const x of [3, bw - 4]) for (let y = 0; y < chain; y += 2) bd.rect(x, y, 2, 1, { mat: "iron", profile: "flat", tone: (y >> 1) % 2 ? -1 : 0, piece: "chain" });
      bd.roundRect(0, chain, bw, bh, 2, { mat: "wood", profile: "bevel", r: 2, depth: 3, piece: "plank" });
      bd.rect(0, chain + Math.round(bh / 2), bw, 1, { mat: "wood", mode: "paint", tone: -2 });
      bd.rect(2, chain + 2, bw - 4, bh - 4, { mat: "wood", mode: "paint", tone: 0 });
      bd.grain({ dir: "h", seed: p.seed, mats: ["wood"], stretch: 16 });
      // painted words, a little faded
      letterCells = letters(bd, lines, pad, chain + pad, s, { mat: "parchment", tone: -1, boxW: ts.w });
      bd.wear({ amount: 0.03 + p.wear * 0.2, seed: p.seed + 2 });
      if (p.mount === "floor" && !hanging) {
        for (const x of [u(0.08), bw - u(0.08) - u(0.06)]) {
          const name = `leg${x}`;
          const lg = b.part(name, { w: u(0.06), h: u(1.2) + 2, pivot: [0, u(1.2) + 2], at: [x - (bw >> 1), 0], layer: "mid", z: 6 });
          lg.rect(0, 0, u(0.06), u(1.2) + 2, { mat: "wood", profile: "cylV" });
        }
      }
    }
    return { board: b.get("board"), letters: letterCells.filter((i) => i >= 0), swing, lit: p.lit, flick: 0, nextFlicker: 3 + b.rand() * 6 };
  },
  initial: (c) => (c.params["kind"] === "neon" ? (c.params["lit"] ? "lit" : "dark") : "idle"),
  states: {
    idle: {
      update: (c, dt) => swingStep(c, dt),
      hit: (c, h) => boardHit(c, h.hit),
    },
    lit: {
      enter: (c) => setNeon(c, 1),
      update(c, dt) {
        const r = c.refs;
        r.nextFlicker -= dt;
        if (r.nextFlicker <= 0 && !c.world.reduced) {
          r.nextFlicker = 5 + c.rand() * 9;
          // a flicker is a flash: it asks the gate like lightning does
          if (c.world.flashGate.allow(c.world.time, c.world.reduced)) c.go("flicker");
        }
      },
      hit: (_c, h) => (h.hit.type === "wind" ? undefined : "spark"),
    },
    flicker: {
      sound: "neon.buzz",
      update(c) {
        // a few tubes drop out, twice, in held steps (never a strobe)
        const t = c.t;
        setNeon(c, t < 0.18 ? 0.55 : t < 0.36 ? 1 : t < 0.5 ? 0.3 : 1);
      },
      after: [0.6, "lit"],
      hit: (_c, h) => (h.hit.type === "wind" ? undefined : "spark"),
    },
    spark: {
      sound: "neon.spark",
      enter(c) {
        const [x, y] = c.refs.board.toWorld(c.refs.board.grid.w / 2, c.refs.board.grid.h / 2);
        puff(c.world, "spark", x, y, 10, [0, -1], { speed: 1, spread: 1.6 });
        c.world.flashLight(x, y, [1, 0.8, 0.6], c.params.H * 1.2, 0.8, 0.12);
        c.refs.board.shake = 0.2;
        setNeon(c, 0);
      },
      after: [0.9, "lit"],
    },
    dark: {
      enter: (c) => setNeon(c, 0),
      hit: (c, h) => {
        if (h.hit.type !== "wind") c.refs.board.shake = 0.15;
      },
    },
  },
  actions: {
    on: (c) => (c.params["kind"] === "neon" ? "lit" : undefined),
    off: (c) => (c.params["kind"] === "neon" ? "dark" : undefined),
    flicker: (c) => (c.state === "lit" ? "flicker" : undefined),
  },
  demo: {
    w: 8,
    at: 1.9,
    params: { kind: "hanging", lines: ["FERRY"] },
    variants: [
      { label: "board on posts", params: { kind: "board", lines: ["PIERS END"], scale: 2 }, dx: -2.6, at: 0 },
      { label: "route arrow", params: { kind: "post", lines: ["LIFT"], arrow: 1 }, dx: 1.6, at: 0 },
      { label: "neon", params: { kind: "neon", lines: ["ARCHIVE"], neon: "rose" }, dx: 3.3, at: 1.6 },
    ],
    script: [
      { label: "idle", wait: 0.8 },
      { label: "slash the hanging board: it swings", hit: "slash", from: -0.4, wait: 2 },
      { label: "settles", wait: 1.5 },
      { label: "neon lit: the tubes glow", variant: "neon", wait: 1.0 },
      { label: "neon flicker: tubes drop out in held steps", variant: "neon", act: "flicker", wait: 0.42 },
      { label: "flicker over: lit", variant: "neon", wait: 0.8 },
      { label: "neon hit: it sparks and goes out a moment", variant: "neon", hit: "heavy", from: -0.5, wait: 0.5 },
      { label: "relights", variant: "neon", wait: 0.8 },
      { label: "neon switched off: dark", variant: "neon", act: "off", wait: 1.0 },
      { label: "neon switched on: lit again", variant: "neon", act: "on", wait: 1.0 },
    ],
  },
});

function setNeon(c: Prop<Refs>, level: number): void {
  const r = c.refs;
  const on = matId(c.params["neon"] === "teal" ? "neonTeal" : "neonRose"), off = matId("neonTube");
  const g = r.board.grid;
  // level < 1: some tubes drop out (the same ones each time: a bad transformer)
  r.letters.forEach((i, k) => {
    const lit = level >= 1 || (level > 0 && ((k * 7919) % 97) / 97 < level);
    const m = lit ? on : off;
    if (g.mat[i] !== m && g.mat[i]) {
      g.mat[i] = m;
      g.markRaw(i);
    }
  });
  for (const L of c.lights) L.level = level;
  for (const G of c.glows) G.level = level;
}

function swingStep(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  if (!r.swing) return;
  const [wx] = c.world.windAt(r.board.wx, r.board.wy);
  if (r.swing.resting && Math.abs(wx) < 2) return;
  r.swing.step(dt, wx * 0.0004);
  r.board.rot = Math.max(-0.7, Math.min(0.7, r.swing.angle)) * c.flip;
}

function boardHit(c: Prop<Refs>, hit: Hit): void {
  const r = c.refs;
  if (r.swing) r.swing.impulse((hit.dir[0] < 0 ? -1 : 1) * (hit.type === "wind" ? 0.8 : hit.type === "slash" || hit.type === "point" ? 2 : 3));
  if (hit.type !== "wind") c.damage(hit);
}

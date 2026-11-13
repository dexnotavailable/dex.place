// Market stalls with cloth awnings, and the unnamed people who work them
// (C1, WORLD-PLAN section 4: "Market stalls with cloth awnings (4). The
// awnings sway, tear along a cut and restore. Stall keepers are unnamed
// silhouettes, and one stall is empty.").
//
// marketStall  two posts, a plank roof (a one-way rooftop in the room's
//              terrain, 1.8 H up), a striped awning of verlet cloth hanging
//              from the roof's front edge, a counter (0.55 H) with wares by
//              kind, a shelf behind, a stall lamp under the roof.
//              kinds: tools, lamps, cloth, pots, empty. Wood splinters and
//              mends; the awning tears along a cut and knits back.
// marketFigure a person behind a counter as a silhouette with a warm rim:
//              hammer (at a small anvil: strike, a few sparks), sort (hands
//              over the goods), sit (on a stool, dozing), sweep. They can't be
//              talked to and can't be hurt: a hit makes them flinch.
// Origins: the floor at the stall's centre / the figure's feet.

import "./materials.ts";
import { addFlame, puff, stepFlame, type Flame } from "../../kit.ts";
import { hitCentre, type Hit } from "../../hits.ts";
import type { Cloth } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { PartBuilder } from "../../builder.ts";

export type StallKind = "tools" | "lamps" | "cloth" | "pots" | "empty";

export interface StallParams {
  kind: StallKind;
  /** Width in H. */
  width: number;
  /** Awning stripes: two cloth materials. */
  awning: [string, string];
  /** Stall lamp lit. */
  lit: boolean;
}

interface StallRefs {
  cloth: Cloth;
  awning: Part;
  tornAt: number;
  flame: Flame | null;
}

function wares(c: PartBuilder, kind: StallKind, x0: number, y: number, w: number, u: (f: number) => number, seed: number): void {
  const r = c.rand;
  if (kind === "tools") {
    // hammers, tongs, a coil of wire, gears
    let x = x0 + 3;
    while (x < x0 + w - u(0.2)) {
      const k = Math.floor(r() * 4);
      if (k === 0) {
        c.rect(x, y - 3, u(0.18), 3, { mat: "wood", profile: "cylH", piece: "ware" });
        c.rect(x + u(0.14), y - u(0.08), u(0.06), u(0.08), { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "ware" });
        x += u(0.24);
      } else if (k === 1) {
        c.circle(x + u(0.07), y - u(0.07), u(0.07), { mat: "brass", profile: "dome", r: 2, piece: "ware" });
        c.circle(x + u(0.07), y - u(0.07), 2, { mat: "brass", mode: "erase" });
        x += u(0.17);
      } else if (k === 2) {
        c.stroke([x, y - 1, x + u(0.1), y - u(0.12), x + u(0.2), y - 1], 2, { mat: "iron", profile: "cylV", piece: "ware" });
        x += u(0.24);
      } else {
        c.ring(x + u(0.08), y - u(0.06), u(0.03), u(0.07), { mat: "copper", profile: "dome", r: 2, flat: 0.6, piece: "ware" });
        x += u(0.18);
      }
    }
  } else if (kind === "lamps") {
    // little lanterns on the counter, two of them lit
    for (let k = 0, x = x0 + 4; x < x0 + w - u(0.18); k++, x += u(0.22)) {
      const hh = u(0.14 + (k % 3) * 0.03);
      c.rect(x, y - hh, u(0.12), hh, { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "ware" });
      c.rect(x + 2, y - hh + 3, u(0.12) - 4, hh - 6, { mat: k % 3 === 1 ? "lampGlass" : "glassPale", profile: "flat", piece: "ware" });
      c.rect(x + u(0.03), y - hh - 3, u(0.06), 3, { mat: "iron", profile: "cylH", piece: "ware" });
    }
  } else if (kind === "cloth") {
    // folded bolts stacked in colours
    const mats = ["clothRed", "clothTeal", "clothGold", "clothIndigo", "clothPale", "burlap"];
    for (let k = 0, x = x0 + 3; x < x0 + w - u(0.24); k++, x += u(0.28)) {
      const layers = 2 + (k % 3);
      for (let j = 0; j < layers; j++) {
        const m = mats[(k * 3 + j + seed) % mats.length]!;
        c.rect(x, y - (j + 1) * u(0.06), u(0.24), u(0.06), { mat: m, profile: "bevel", r: 1, depth: 2, piece: `bolt${j % 2}` });
      }
    }
  } else if (kind === "pots") {
    for (let k = 0, x = x0 + 4; x < x0 + w - u(0.22); k++, x += u(0.26)) {
      const rr = u(0.08 + (k % 2) * 0.03);
      c.ellipse(x + rr, y - rr, rr, rr, { mat: k % 3 === 2 ? "brass" : "copper", profile: "dome", r: 3, piece: "ware" });
      c.rect(x + rr - u(0.05), y - rr * 2 - 1, u(0.1), 3, { mat: "copper", profile: "cylH", piece: "ware" });
    }
  } else {
    // empty: a dust sheet thrown over the counter, a closed shutter behind
    c.poly([x0, y, x0 + w, y, x0 + w - 2, y - u(0.06), x0 + w * 0.6, y - u(0.1), x0 + 3, y - u(0.05)], { mat: "canvas", profile: "dome", r: 3, piece: "sheet" });
  }
}

export const marketStall = defineRecipe<StallParams, StallRefs>({
  id: "marketStall",
  breakage: "heal",
  reason: "The market's stalls, where the hollow's people trade what the colossi's road brings: tools, lamps, cloth, pots; the awnings show the air moving and one stall stands empty.",
  defaults: { kind: "tools", width: 2.8, awning: ["clothRed", "clothPale"], lit: true },
  cues: ["wood.hit", "cloth.tear"],
  standard: { h: 1.8, parts: ["frame"], note: "stall roof: a one-way rooftop 1.8 H up" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width);
    const roof = u(1.8);
    const cx = W >> 1;
    // the frame: posts and the roof plank, a back shelf with wares, all behind the player
    const fr = b.part("frame", { w: W + 4, h: roof, pivot: [(W + 4) >> 1, roof], at: [0, 0], layer: "bg", z: 4 });
    const base = roof;
    const pt = u(0.12);
    fr.rect(2, 0, W, pt, { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "roof" });
    fr.rect(2, 0, W, 1, { mat: "woodDark", mode: "paint", tone: 1 });
    fr.grain({ dir: "h", seed: p.seed, mats: ["woodDark"], stretch: 18 });
    for (const x of [2, W - u(0.08) + 2]) fr.rect(x, pt, u(0.08), roof - pt, { mat: "wood", profile: "cylV", piece: "post" });
    // back wall of boards, darker, and a shelf with a second row of wares
    fr.rect(u(0.1) + 2, pt + 2, W - u(0.2), roof - u(0.55) - pt, { mat: "woodDark", profile: "flat", depth: 1, tone: -1, piece: "back" });
    for (let x = u(0.1) + 2; x < W - u(0.1); x += u(0.16)) fr.rect(x, pt + 2, 1, roof - u(0.55) - pt, { mat: "woodDark", mode: "paint", tone: -2 });
    const shelfY = base - u(1.2);
    fr.rect(u(0.12), shelfY, W - u(0.2), 3, { mat: "wood", profile: "cylH", z: 2, piece: "shelf" });
    if (p.kind !== "empty") wares(fr, p.kind === "lamps" ? "pots" : p.kind === "pots" ? "tools" : p.kind, u(0.16), shelfY, W - u(0.3), u, p.seed + 1);
    else {
      // a rolled shutter half down
      fr.rect(u(0.12), pt + 2, W - u(0.2), u(0.8), { mat: "iron", profile: "flat", depth: 1, piece: "shutter" });
      for (let y = pt + 4; y < pt + u(0.8); y += 3) fr.rect(u(0.12), y, W - u(0.2), 1, { mat: "iron", mode: "paint", tone: -1 });
    }
    // the counter in front (still behind the player: it's the stall's front)
    const ch = u(0.55);
    const ct = b.part("counter", { w: W - u(0.1), h: ch, pivot: [(W - u(0.1)) >> 1, ch], at: [0, 0], layer: "bg", z: 8 });
    const cw = W - u(0.1);
    ct.rect(0, u(0.06), cw, ch - u(0.06), { mat: "wood", profile: "flat", depth: 2, piece: "front" });
    for (let x = 0; x < cw; x += u(0.14)) ct.rect(x, u(0.06), 1, ch - u(0.06), { mat: "wood", mode: "paint", tone: -2 });
    ct.rect(0, ch - u(0.08), cw, u(0.08), { mat: "woodDark", profile: "bevel", r: 1, depth: 2, piece: "kick" });
    ct.rect(0, 0, cw, u(0.06), { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "top" });
    ct.rect(0, 0, cw, 1, { mat: "woodDark", mode: "paint", tone: 1 });
    ct.grain({ dir: "v", seed: p.seed + 2, mats: ["wood"], stretch: 10 });
    ct.wear({ amount: 0.03 + p.wear * 0.15, seed: p.seed + 3 });
    // wares on the counter
    const wr = b.part("wares", { w: cw, h: u(0.3), pivot: [cw >> 1, u(0.3)], at: [0, -ch], layer: "bg", z: 9 });
    wares(wr, p.kind, 0, u(0.3), cw, u, p.seed);
    // the awning: stripes of two cloths, a scalloped hem, hung from the roof's front edge
    const aw = W + u(0.12), ah = u(0.46);
    const src = b.canvas(aw, ah);
    const stripe = Math.max(6, u(0.18));
    for (let x = 0; x < aw; x += stripe) src.rect(x, 0, Math.min(stripe, aw - x), ah, { mat: Math.floor(x / stripe) % 2 ? p.awning[1] : p.awning[0], profile: "flat", depth: 1, piece: "cloth" });
    for (let x = 0; x < aw; x += stripe) {
      // scallops: cut a half circle from the hem between stripes
      for (let k = 0; k < stripe; k++) {
        const d = Math.abs(k - stripe / 2) / (stripe / 2);
        const cut = Math.round((1 - Math.sqrt(Math.max(0, 1 - d * d))) * u(0.08));
        for (let y = ah - cut; y < ah; y++) {
          const i = src.grid.inner(x + k, y);
          if (i >= 0) src.grid.clearRaw(i);
        }
      }
    }
    src.rect(0, 0, aw, 2, { mat: p.awning[0], mode: "paint", tone: -1 });
    src.grain({ dir: "v", seed: p.seed + 5, density: 0.15, stretch: 14 });
    src.speckle({ amount: 0.05, seed: p.seed + 6, tone: -1 });
    src.grid.computeNormals({ x0: 0, y0: 0, x1: src.grid.W - 1, y1: src.grid.Hh - 1 });
    const sp = Math.max(5, Math.round(aw / 12));
    const { cloth, part } = b.cloth("awning", { src: src.grid, spacing: sp, x: -aw / 2, y: -roof + u(0.1), pinTop: true, damping: 0.97, windGain: 0.8, foldGain: 1.2, bottomMass: 1.5, layer: "bg", room: [aw * 0.2, 4, aw * 0.2, ah * 0.5] });
    part.z = 12;
    // the stall lamp: a bulb in a tin shade under the roof
    let flame: Flame | null = null;
    if (p.kind !== "empty") {
      const lamp = b.part("lamp", { w: u(0.2), h: u(0.18), pivot: [u(0.1), 0], at: [Math.round(W * 0.18) - cx, -roof + u(0.12)], layer: "bg", z: 11 });
      lamp.rect(u(0.1) - 1, 0, 2, u(0.07), { mat: "iron", profile: "cylV", piece: "cord" });
      lamp.poly([u(0.02), u(0.14), u(0.18), u(0.14), u(0.13), u(0.07), u(0.07), u(0.07)], { mat: "iron", profile: "dome", r: 2, piece: "shade" });
      flame = addFlame(b, { name: "bulb", parent: "lamp", at: [u(0.1), u(0.18)], size: [0.06, 0.05], light: 2.6, intensity: 0.75, glow: 0.4, colour: [1, 0.7, 0.42], z: 12, lit: p.lit });
    }
    return { cloth, awning: part, tornAt: -1, flame };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit),
    },
    torn: {
      sound: "cloth.tear",
      update(c, dt) {
        step(c, dt);
        if (c.age - c.refs.tornAt > 4.5) c.go("restoring");
      },
      hit: (c, h) => onHit(c, h.hit),
    },
    restoring: {
      enter(c) {
        c.world.tweens.add({ target: c.refs.awning, key: "dissolve", to: 1, dur: 0.5, ease: "inOutSine" });
      },
      update(c, dt) {
        step(c, dt);
        const r = c.refs;
        if (c.t >= 0.55 && r.cloth.torn > 0) {
          r.cloth.reset();
          r.awning.dissolveMode = 1;
          c.world.tweens.add({ target: r.awning, key: "dissolve", to: 0, dur: 0.7, ease: "inOutSine" });
        }
      },
      after: [1.4, "idle"],
    },
  },
  actions: {
    /** A steam burst or a footfall: the awning lifts and settles. */
    gust: (c, arg) => {
      const [x0, y0, x1, y1] = c.refs.cloth.bounds();
      c.refs.cloth.push((x0 + x1) / 2, (y0 + y1) / 2, c.params.H * 2, Number(arg ?? 1) * 1.5, -1.2, 1.5);
    },
  },
  demo: {
    w: 7,
    params: { kind: "tools" },
    variants: [
      { label: "lamps", params: { kind: "lamps", awning: ["clothTeal", "clothPale"] }, dx: -3.1 },
      { label: "empty", params: { kind: "empty", awning: ["clothGold", "burlap"], lit: false }, dx: 3.1 },
    ],
    script: [
      { label: "the stall", wait: 1 },
      { label: "dash wind: the awning lifts", hit: "wind", from: -1, wait: 1.5 },
      { label: "slash the awning: it tears", hit: "slash", from: -0.6, wait: 2 },
      { label: "heavy on the counter: splinters", hit: "heavy", from: -1.2, wait: 2 },
      { label: "restores", wait: 7 },
    ],
  },
});

function step(c: Prop<StallRefs>, dt: number): void {
  if (c.refs.flame) stepFlame(c, c.refs.flame, dt);
}

function onHit(c: Prop<StallRefs>, hit: Hit): string | void {
  const r = c.refs;
  const H = c.params.H;
  const [x, y] = hitCentre(hit.shape);
  const f = hit.type === "wind" ? 1.4 : hit.type === "slash" || hit.type === "point" ? 2.4 : 3.6;
  r.cloth.push(x, y, H * 1.8, hit.dir[0] * f, hit.dir[1] * f * 0.4 - 0.5, f);
  if (hit.type === "wind") return;
  c.damage(hit, ["frame", "counter", "wares", "lamp"]);
  const res = c.cut(hit, { ropes: false });
  if (res.torn > 0) {
    r.tornAt = c.age;
    return "torn";
  }
}

// ---------------------------------------------------------------------------
// The people of the market: silhouettes at work
// ---------------------------------------------------------------------------

export type FigureKind = "hammer" | "sort" | "sit" | "sweep";

export interface FigureParams {
  kind: FigureKind;
  /** Height in H (people vary). */
  height: number;
  /** Face left. */
  left: boolean;
}

interface FigureRefs {
  body: Part;
  arm: Part;
  head: Part;
  tool: Part | null;
  phase: number;
  flinch: number;
  struck: boolean;
}

export const marketFigure = defineRecipe<FigureParams, FigureRefs>({
  id: "marketFigure",
  breakage: "never",
  reason: "The hollow is inhabited: a few unnamed people work the market, seen as silhouettes against their lamps; none of them can be talked to (CANON: lonely enough that meeting someone is a surprise).",
  defaults: { kind: "sort", height: 0.95, left: false },
  cues: ["anvil.strike"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const Hh = u(p.height);
    const sit = p.kind === "sit";
    const bw = u(0.34), bh = sit ? Math.round(Hh * 0.62) : Math.round(Hh * 0.8);
    const cx = bw >> 1;
    // body: a coat to the knees, legs (or a stool), shoulders
    const body = b.part("body", { w: bw + u(0.2), h: bh, pivot: [(bw + u(0.2)) >> 1, bh], at: [0, 0], layer: "bg", z: 6, hittable: true });
    const ox = u(0.1);
    if (sit) {
      body.rect(ox + u(0.02), bh - u(0.3), bw - u(0.04), u(0.04), { mat: "woodDark", profile: "cylH", piece: "stool" });
      for (const x of [ox + u(0.04), ox + bw - u(0.08)]) body.rect(x, bh - u(0.26), u(0.04), u(0.26), { mat: "woodDark", profile: "cylV", piece: "stool" });
      body.poly([ox + u(0.04), bh - u(0.3), ox + bw - u(0.02), bh - u(0.3), ox + bw - u(0.06), u(0.06), ox + u(0.08), u(0.06)], { mat: "hollowShadeCloth", profile: "dome", r: 4, piece: "coat" });
      body.rect(ox + bw - u(0.1), bh - u(0.3), u(0.18), u(0.06), { mat: "hollowShade", profile: "cylH", piece: "leg" });
      body.rect(ox + bw + u(0.04), bh - u(0.26), u(0.05), u(0.26), { mat: "hollowShade", profile: "cylV", piece: "leg" });
    } else {
      for (const x of [ox + u(0.08), ox + bw - u(0.14)]) body.rect(x, bh - u(0.32), u(0.07), u(0.32), { mat: "hollowShade", profile: "cylV", piece: "leg" });
      body.poly([ox + u(0.02), bh - u(0.26), ox + bw - u(0.02), bh - u(0.26), ox + bw - u(0.04), u(0.05), ox + u(0.05), u(0.05)], { mat: "hollowShadeCloth", profile: "dome", r: 4, piece: "coat" });
      body.rect(ox + u(0.03), Math.round(bh * 0.52), bw - u(0.06), 2, { mat: "hollowShadeCloth", mode: "paint", tone: 1 });
    }
    body.ellipse(ox + cx, u(0.07), cx, u(0.07), { mat: "hollowShadeCloth", profile: "dome", r: 3, piece: "shoulders" });
    // head: a cap or a hood, a nape; parented to the body so it bobs with it
    const hs = u(0.2);
    const head = b.part("head", { w: hs + 2, h: hs, pivot: [(hs + 2) >> 1, hs], at: [ox + cx, 3], parent: "body", layer: "bg", z: 7 });
    head.ellipse((hs + 2) >> 1, hs * 0.55, hs * 0.42, hs * 0.45, { mat: "hollowShade", profile: "dome", r: 3, piece: "head" });
    if (p.seed % 2) head.rect(1, u(0.06), hs, u(0.04), { mat: "hollowShadeCloth", profile: "cylH", piece: "cap" });
    else head.poly([2, hs * 0.7, hs * 0.5, 0, hs, hs * 0.7], { mat: "hollowShadeCloth", profile: "dome", r: 3, piece: "hood" });
    // the working arm (pivot at the shoulder) and its tool
    const aw = u(0.32), ah = u(0.08);
    const arm = b.part("arm", { w: aw, h: ah, pivot: [2, ah >> 1], at: [ox + cx + u(0.04), u(0.1)], parent: "body", layer: "bg", z: 8, smoothRotate: true });
    arm.rect(0, (ah >> 1) - 2, aw - u(0.06), 4, { mat: "hollowShadeCloth", profile: "cylH", piece: "sleeve" });
    arm.circle(aw - u(0.05), ah >> 1, 2.5, { mat: "hollowShade", profile: "dome", r: 2, piece: "hand" });
    let tool: Part | null = null;
    if (p.kind === "hammer") {
      const t = b.part("tool", { w: u(0.1), h: u(0.18), pivot: [u(0.05), u(0.16)], at: [aw - u(0.05) - 2, ah >> 1], parent: "arm", layer: "bg", z: 9, smoothRotate: true });
      t.rect(u(0.05) - 1, u(0.04), 2, u(0.14), { mat: "woodDark", profile: "cylV", piece: "haft" });
      t.rect(0, 0, u(0.1), u(0.05), { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "head" });
      tool = b.get("tool");
      // the anvil in front of them
      const an = b.part("anvil", { w: u(0.3), h: u(0.36), pivot: [0, u(0.36)], at: [u(0.2), 0], layer: "bg", z: 7 });
      an.poly([0, 0, u(0.3), 0, u(0.24), u(0.08), u(0.2), u(0.08), u(0.2), u(0.28), u(0.26), u(0.36), u(0.04), u(0.36), u(0.1), u(0.28), u(0.1), u(0.08), u(0.04), u(0.08)], { mat: "iron", profile: "bevel", r: 2, depth: 3 });
    } else if (p.kind === "sweep") {
      const t = b.part("tool", { w: u(0.16), h: u(0.8), pivot: [u(0.08), u(0.1)], at: [aw - u(0.05) - 2, ah >> 1], parent: "arm", layer: "bg", z: 9, smoothRotate: true });
      t.rect(u(0.08) - 1, 0, 2, u(0.66), { mat: "wood", profile: "cylV", piece: "handle" });
      t.poly([0, u(0.8), u(0.16), u(0.8), u(0.1), u(0.64), u(0.06), u(0.64)], { mat: "straw", profile: "flat", piece: "broom" });
      tool = b.get("tool");
    }
    if (p.left) for (const n of ["body"]) b.get(n).flip = -1;
    return { body: b.get("body"), arm: b.get("arm"), head: b.get("head"), tool, phase: (p.seed % 97) / 13, flinch: 0, struck: false };
  },
  initial: "working",
  states: {
    working: {
      update(c, dt) {
        const r = c.refs;
        const k = c.params["kind"] as FigureKind;
        const t = c.age + r.phase;
        const rd = c.world.reduced ? 0.5 : 1;
        // held poses stepped at 8 fps, like hand-keyed pixel animation
        const q = Math.floor(t * 8) / 8;
        r.flinch = Math.max(0, r.flinch - dt * 3);
        r.body.offX = Math.round(-r.flinch * 3) * c.flip;
        if (k === "hammer") {
          // a strike every 1.6 s: lift, hold, down, ring
          const ph = (q * rd) % 1.6;
          r.arm.rot = ph < 0.9 ? -0.3 - Math.min(1, ph / 0.5) * 0.9 : ph < 1.05 ? 0.35 : 0.1;
          if (ph >= 0.9 && ph < 1.05 && !r.struck) {
            r.struck = true;
            const [x, y] = r.arm.toWorld(r.arm.grid.w, r.arm.grid.h / 2);
            puff(c.world, "spark", x + 6 * c.flip, y + 8, 4, [c.flip, -1], { speed: 0.6, spread: 1.2 });
            c.sound("anvil.strike", 0.25);
          }
          if (ph < 0.9) r.struck = false;
          r.body.offY = ph >= 0.9 && ph < 1.05 ? 1 : 0;
        } else if (k === "sort") {
          const ph = (q * 0.6 * rd) % 3;
          r.arm.rot = 0.5 + (ph < 1 ? 0.2 : ph < 2 ? 0.45 : 0.05);
          r.head.offY = ph < 1.5 ? 1 : 0;
        } else if (k === "sit") {
          // dozing: the head drops slowly, jerks up
          const ph = (q * rd) % 9;
          r.head.offY = ph < 6 ? Math.min(3, Math.floor(ph / 2)) : 0;
          r.arm.rot = 1.2;
        } else {
          const ph = (q * rd) % 2;
          r.arm.rot = 0.9 + (ph < 1 ? 0.25 : -0.1);
          r.body.offX += ph < 1 ? 1 : 0;
        }
      },
      hit(c, h) {
        if (h.hit.type !== "wind") c.refs.flinch = 1;
      },
    },
  },
  demo: {
    w: 6,
    params: { kind: "hammer" },
    variants: [
      { label: "sort", params: { kind: "sort" }, dx: -2 },
      { label: "sit", params: { kind: "sit" }, dx: 2 },
    ],
    script: [
      { label: "working", wait: 4 },
      { label: "slash near them: a flinch, no harm", hit: "slash", from: -0.8, wait: 1.5 },
    ],
  },
});

// Donation box and donor plaque (every shrine has both).
//
// Box: a small wooden box bound in iron on a stone plinth, a brass coin slot
// and a votive lamp on the lid. E opens the donate panel (a real DOM panel,
// owned by the host); the lamp flares and a chime plays when it is used. It
// never fakes a payment: "used" means the panel opened, nothing more. Hits
// chip it and it mends. Origin: floor, centre.
//
// Plaque: a brass plate on the wall beside it. Names are engraved from real
// data only; with no data it stays blank (engraved rules, no invented names).
// E opens the donors panel. Origin: the plate's bottom centre (prop-local y
// is the plate bottom; place it on the wall).

import { F_NOINK } from "../cells.ts";
import { flicker } from "../motion.ts";
import { P_ADD, P_DRAG } from "../bodies.ts";
import { resolveMat, textPixels } from "../materials.ts";
import { defineRecipe, type Prop, type PropGlow, type PropLight } from "../prop.ts";
import type { Part } from "../part.ts";

interface BoxRefs {
  lamp: Part;
  light: PropLight;
  glow: PropGlow;
  flare: number;
}

function drawLampFlame(p: Part, level: number, t: number, seed: number): void {
  const g = p.grid;
  g.clearAll();
  const fl = flicker(t, seed, 1.1);
  const fh = Math.max(3, Math.round(g.h * (0.55 + 0.45 * level) * (0.85 + 0.15 * fl)));
  const flame = resolveMat("flame").id;
  for (let y = 0; y < fh; y++) {
    const tt = (y + 0.5) / fh;
    const half = (g.w / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, tt * 0.9 + 0.1)), 0.8) * (0.6 + 0.4 * tt);
    for (let x = 0; x < g.w; x++) {
      const d = Math.abs(x + 0.5 - g.w / 2) / Math.max(half, 0.6);
      if (d > 1) continue;
      const i = g.inner(x, g.h - fh + y);
      if (i >= 0) g.setRaw(i, flame, d < 0.45 && tt > 0.3 ? 1 : tt < 0.25 ? -1 : 0, 1, 2, F_NOINK, 1);
    }
  }
  p.heat = level > 0.6 ? 1 : (fl - 0.9) * 2;
}

export const donationBox = defineRecipe<{ lamp: boolean }, BoxRefs>({
  id: "donationBox",
  breakage: "never",
  reason: "Donations in the world: at every shrine, a safe spot where E opens the real donate panel (Ko-fi / MB Bank). Never gates anything.",
  demo: {
    w: 4, indoor: true,
    with: [{ id: "donorPlaque", dx: 0.9, at: 0.9 }],
    script: [
      { label: "idle", wait: 0.8 },
      { label: "E: the donate panel opens, lamp flares, chime", use: true, from: -0.6, wait: 2.4 },
      { label: "slash: flashes, never breaks", hit: "slash", from: -0.8, wait: 1 },
      { label: "heavy", hit: "heavy", from: -1.0, wait: 1.5 },
      { label: "mends", wait: 5 },
    ],
  },
  defaults: { lamp: true },
  use: { reach: 0.8, prompt: "donate" },
  standard: { h: 0.5, parts: ["box"], note: "donation box" },
  build(b, p) {
    // WORLD-PLAN section 1: the box stands 0.5 H (plinth, box and lid); drawn at 0.595 of the proof size
    const u = (f: number): number => b.u(f * 0.595);
    const w = u(0.82), plH = u(0.3), boxH = u(0.46), lidH = u(0.08);
    const h = plH + boxH + lidH;
    const cx = Math.floor(w / 2);
    const box = b.part("box", { w, h, pivot: [cx, h], at: [0, 0], layer: "mid", z: 8, collide: "solid" });
    // stone plinth
    box.piece("plinth");
    box.rect(u(0.03), h - plH, w - u(0.06), plH, { mat: "stone", profile: "bevel", r: 3, depth: 4 });
    box.rect(0, h - plH, w, u(0.05), { mat: "stone", profile: "bevel", r: 2, depth: 5, z: 1, piece: "plinthCap" });
    box.speckle({ amount: 0.12, seed: p.seed, tone: -1, region: { x0: 0, y0: h - plH, x1: w, y1: h } });
    // the box
    const bx0 = u(0.08), bw = w - u(0.16), by0 = h - plH - boxH;
    box.piece("box");
    box.rect(bx0, by0, bw, boxH, { mat: "wood", profile: "bevel", r: 3, depth: 4 });
    box.grain({ dir: "h", seed: p.seed + 2, region: { x0: bx0, y0: by0, x1: bx0 + bw, y1: by0 + boxH }, mats: ["wood"], stretch: 12 });
    // iron straps and corner bands
    box.piece("iron");
    for (const x of [bx0, bx0 + bw - u(0.05)]) box.rect(x, by0, u(0.05), boxH, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 4 });
    box.rect(bx0, by0 + Math.round(boxH * 0.62), bw, u(0.04), { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 4 });
    box.rivets([[bx0 + 2, by0 + 3], [bx0 + bw - 3, by0 + 3], [bx0 + 2, by0 + boxH - 3], [bx0 + bw - 3, by0 + boxH - 3]], { mat: "brass", r: 1.1, z: 6 });
    // brass lock plate with the shrine's lamp mark
    box.piece("plate");
    const pw = u(0.16), ph = u(0.16);
    box.roundRect(cx - pw / 2, by0 + u(0.06), pw, ph, 2, { mat: "brass", profile: "bevel", r: 2, depth: 2, z: 5 });
    box.ornament(cx - 3, by0 + u(0.06) + 3, `
      ..#..
      .#.#.
      .###.
      ..#..
      .###.
    `, { "#": { mat: "brass", tone: -2 } }, { mode: "paint" });
    // lid and coin slot
    box.piece("lid");
    box.rect(bx0 - 2, by0 - lidH, bw + 4, lidH, { mat: "woodDark", profile: "bevel", r: 2, depth: 3, z: 2 });
    box.rect(cx - u(0.09), by0 - lidH, u(0.18), 2, { mat: "brass", profile: "flat", z: 4, piece: "slot" });
    box.rect(cx - u(0.07), by0 - lidH, u(0.14), 1, { mat: "soot", profile: "flat", z: 1, noInk: true, piece: "slot" });
    box.wear({ amount: 0.04 + p.wear * 0.2, seed: p.seed + 5 });
    b.get("box").tag["heal"] = true;
    // a shrine fixture: it chips, it doesn't fall apart
    const bg = box.grid;
    for (let i = 0; i < bg.hp.length; i++) bg.hp[i] = bg.hp[i]! * 3;
    // votive lamp on the lid (brass cup) and its flame
    const lw = u(0.1), lh = u(0.09);
    const cup = b.part("cup", { w: lw, h: lh, pivot: [Math.floor(lw / 2), lh], at: [bx0 + bw - u(0.1) - cx, -(h - (by0 - lidH))], layer: "mid", z: 9 });
    cup.poly([0, 1, lw, 1, lw - 2, lh, 2, lh], { mat: "brass", profile: "cylV" });
    cup.rect(0, 0, lw, 2, { mat: "brass", profile: "cylH", z: 1 });
    const fw = Math.max(4, u(0.06)), fh = Math.max(6, u(0.11));
    b.part("lamp", { w: fw, h: fh, pivot: [Math.floor(fw / 2), fh], at: [Math.floor(lw / 2), 0], parent: "cup", layer: "mid", outline: 0, hittable: false, z: 10 });
    const light = b.light({ part: "lamp", at: [fw / 2, fh / 2], colour: [1, 0.72, 0.4], radius: u(1.3), intensity: 0.4, flicker: 0.4, height: u(0.3) });
    const glow = b.glow({ part: "lamp", at: [fw / 2, fh * 0.6], colour: [1, 0.62, 0.3], radius: u(0.22), intensity: 0.45, flicker: 0.5 });
    const refs: BoxRefs = { lamp: b.get("lamp"), light, glow, flare: 0 };
    refs.lamp.dynamicEvery = 4;
    refs.lamp.dynamic = (part) => drawLampFlame(part, p.lamp ? 0.35 + refs.flare * 0.65 : 0, part.prop?.world.time ?? 0, p.seed);
    return refs;
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => lampStep(c, dt),
      use: () => "used",
    },
    used: {
      sound: "donate.chime",
      enter(c) {
        c.refs.flare = 1;
        c.emit({ type: "panel", panel: "donate" });
        for (const part of c.parts) if (part.name === "box") part.glintT = 0;
        const [x, y] = c.refs.lamp.toWorld(c.refs.lamp.pivotX, c.refs.lamp.pivotY - 4);
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (c.rand() - 0.5) * 1.8;
          c.world.particles.spawn({ x, y, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, life: 0.5 + c.rand() * 0.5, rgb: [255, 220, 150], flags: P_ADD | P_DRAG });
        }
      },
      update: (c, dt) => lampStep(c, dt),
      after: [2.2, "idle"],
      use(c) {
        c.emit({ type: "panel", panel: "donate" });
      },
    },
  },
});

function lampStep(c: Prop<BoxRefs>, dt: number): void {
  const r = c.refs;
  r.flare = Math.max(0, r.flare - dt * 0.45);
  r.light.level = 0.55 + r.flare * 1.4;
  r.light.radius = c.params.H * (1.2 + r.flare * 1.2);
  r.glow.level = 0.6 + r.flare * 1.2;
}

// ---------------------------------------------------------------------------

export interface PlaqueParams {
  /** Real top-donor names only (empty stays empty). */
  names: string[];
  rows: number;
}

export const donorPlaque = defineRecipe<PlaqueParams, null>({
  id: "donorPlaque",
  breakage: "never",
  reason: "Top donors beside each donation box, engraved from real data only; E opens the full donor record.",
  demo: {
    w: 3, at: 0.9, indoor: true,
    script: [
      { label: "blank engraved rules (no donor data in the sandbox)", wait: 1 },
      { label: "E: the donors panel", use: true, from: -0.5, wait: 1.2 },
    ],
  },
  defaults: { names: [], rows: 3 },
  standard: { w: 0.6, h: 0.4, parts: ["plaque"], note: "donor plaque" },
  use: { reach: 0.8, prompt: "read" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    // WORLD-PLAN section 1: 0.6 x 0.4 H
    const w = u(0.6), h = u(0.4), rowH = Math.max(6, Math.floor((h - u(0.125) - 4) / Math.max(1, p.rows)));
    const pl = b.part("plaque", { w, h, pivot: [Math.floor(w / 2), h], at: [0, 0], layer: "bg", z: 20 });
    // wooden backboard, brass plate
    pl.roundRect(0, 0, w, h, 3, { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "board" });
    pl.roundRect(3, 3, w - 6, h - 6, 2, { mat: "brass", profile: "bevel", r: 2, depth: 2, z: 3, piece: "plate" });
    pl.rivets([[5, 5], [w - 6, 5], [5, h - 6], [w - 6, h - 6]], { mat: "iron", r: 1, z: 6 });
    // engraved heading mark (a small lamp) and rows
    pl.ornament(Math.floor(w / 2) - 1, 4, `
      .#.
      ###
      .#.
    `, { "#": { mat: "brass", tone: -2 } }, { mode: "paint" });
    const top = u(0.125);
    const maxChars = Math.floor((w - 7) / 4);
    for (let r = 0; r < p.rows; r++) {
      const y = top + r * rowH;
      const name = p.names[r];
      if (name) {
        const { w: tw } = textPixels(name.slice(0, maxChars));
        pl.text(name.slice(0, maxChars), Math.floor(w / 2 - tw / 2), y, { tone: -2 });
      } else {
        // blank engraved rule: room for a real name, nothing invented
        pl.rect(8, y + 3, w - 16, 1, { mat: "brass", mode: "paint", tone: -1 });
      }
    }
    b.get("plaque").tag["heal"] = true;
    return null;
  },
  initial: "idle",
  states: {
    idle: {
      use(c) {
        c.emit({ type: "panel", panel: "donors" });
        for (const part of c.parts) part.glintT = 0;
        c.sound("plaque.read", 0.5);
      },
    },
  },
});

// Doors, every kind the world uses, with every state:
//   closed -> opening -> open -> closing -> closed
//   latched from the far side: E rattles it (it stays shut)
//   latched on this side (a maintenance rail bolted across it): E releases
//   the rail (unlatching), then it opens; the release is saved
//
// Kinds (WORLD-PLAN section 1 sizes; the opening, not the frame):
//   ordinary  1.4 x 0.7 H  plank door (lodge, archive, yard)
//   sky       1.4 x 0.7 H  the sky door: an ordinary door with the red mark
//   big       4 x 2.5 H    arched double door (the chapel)
//   gate      4 x 2.5 H    iron lift gate that slides into its post
//   shutter   4 x 2.5 H    arena shutter that rolls up into its housing
//
// A door sits on the back wall: the player passes by pressing E; the host
// moves them through on the `door` event (action "open" / "enter"). The
// leaf swings away from the viewer in perspective (re-rasterised only while
// it moves), a big door's two leaves swing from both jambs, the gate slides
// and the shutter rolls. `beyond`: "dark" draws a dark interior in the open
// doorway, "none" leaves it empty so the room behind (or the dusk sky past
// the sky door) shows through. Never breaks: hits shake it, a latched door
// rattles. Origin: the threshold's centre, on the floor.

import { PartBuilder as PartBuilderCtor, type PartBuilder } from "../builder.ts";
import { F_NOINK } from "../cells.ts";
import { EASE } from "../util.ts";
import { puff } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

export type DoorKind = "ordinary" | "sky" | "big" | "gate" | "shutter";

export interface DoorParams {
  kind: DoorKind;
  /** "far": bolted from the other side (rattles). "near": the rail is on this side (E releases it). */
  latch: "none" | "far" | "near";
  /** Start open. */
  open: boolean;
  /** What the open doorway shows. */
  beyond: "dark" | "none";
  /** Paint the red mark on the leaf (the sky door has it on both sides). */
  mark: boolean;
  /** Frame material. */
  frame: "stone" | "timber";
  /** Blocks passage while closed (a door in a walkway); back-wall doors don't. */
  solid: boolean;
}

interface Refs {
  kind: DoorKind;
  leaf: Part;
  /** The closed leaf design(s), drawn once. */
  src: PartBuilder[];
  /** 0 closed .. 1 open. */
  f: number;
  from: number;
  to: number;
  dur: number;
  w: number;
  h: number;
  rail: Part | null;
  railF: number;
  drawnF: number;
}

const SIZE: Record<DoorKind, [number, number]> = { ordinary: [0.7, 1.4], sky: [0.7, 1.4], big: [2.5, 4], gate: [2.5, 4], shutter: [2.5, 4] };
const DUR: Record<DoorKind, number> = { ordinary: 0.7, sky: 0.7, big: 1.5, gate: 1.3, shutter: 1.8 };

/** The closed leaf of a plank door (ordinary / sky / one half of big). */
function plankLeaf(b: PartBuilder, w: number, h: number, u: (f: number) => number, o: { mark: boolean; arch: boolean; hinge: "l" | "r"; seed: number; studs: boolean }): void {
  const planks = Math.max(3, Math.round(w / u(0.14)));
  const pw = w / planks;
  for (let k = 0; k < planks; k++) {
    const x0 = Math.round(k * pw), x1 = Math.round((k + 1) * pw);
    b.rect(x0, 0, x1 - x0, h, { mat: o.mark ? "wood" : "wood", profile: "bevel", r: 1, depth: 2, tone: k % 3 === 1 ? -1 : 0, piece: `plank${k % 2}` });
  }
  b.grain({ dir: "v", seed: o.seed, density: 0.3, stretch: 14, mats: ["wood"] });
  // iron straps with hinge knuckles on the hinge side
  const straps = h > u(2) ? [0.3, 0.55, 0.82] : [0.16, 0.8];
  for (const f of straps) {
    const y = Math.round(h * f);
    b.rect(0, y, w, u(0.05), { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 3, piece: "strap" });
    const hx = o.hinge === "l" ? 0 : w - 3;
    b.rect(hx, y - 1, 3, u(0.05) + 2, { mat: "iron", profile: "cylV", z: 4, piece: "hinge" });
  }
  if (o.studs) {
    for (let y = u(0.3); y < h - u(0.2); y += u(0.3)) for (let x = u(0.12); x < w - 4; x += u(0.24)) b.rivets([[x, y]], { mat: "iron", r: 1.3, z: 3 });
  }
  // ring pull on the latch side
  const rx = o.hinge === "l" ? w - u(0.12) : u(0.12);
  b.ring(rx, Math.round(h * 0.55), 2, 4, { mat: "iron", profile: "dome", r: 2, z: 4, piece: "ring" });
  b.circle(rx, Math.round(h * 0.55) - 3, 1.6, { mat: "iron", profile: "dome", r: 1.5, z: 5, piece: "ring" });
  if (o.mark) {
    // the red mark: a painted diamond with a stroke through it, weathered
    const mx = Math.round(w / 2), my = Math.round(h * 0.34);
    b.ornament(mx - 6, my - 8, `
      ......#......
      .....###.....
      ....#####....
      ...#######...
      ..####.####..
      .#####.#####.
      ######.######
      .#####.#####.
      ..####.####..
      ...#######...
      ....#####....
      .....###.....
      ......#......
      ......#......
      ......#......
      .....###.....
    `, { "#": { mat: "clothRed", tone: 1 } }, { mode: "paint" });
  }
  if (o.arch) {
    // cut the top into this leaf's half of the pointed arch (the frame's shape)
    const inside = archMask(w * 2, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (inside(o.hinge === "l" ? x : x + w, y)) continue;
      const i = b.grid.inner(x, y);
      if (i >= 0) b.grid.clearRaw(i);
    }
  }
  b.wear({ amount: 0.012, seed: o.seed + 3 });
}

/** Inside test for the pointed doorway arch (the same shape PartBuilder.arch draws). */
function archMask(w: number, h: number): (x: number, y: number) => boolean {
  const t = new PartBuilderCtor(w, h);
  t.arch(0, 0, w, h, { mat: "soot", profile: "flat", pointed: 0.62 });
  return (x, y) => t.grid.solid(x, y);
}

function gateLeaf(b: PartBuilder, w: number, h: number, u: (f: number) => number): void {
  const bars = Math.round(w / u(0.2));
  for (let k = 0; k <= bars; k++) {
    const x = Math.round((k * (w - 4)) / bars);
    b.rect(x, 0, 4, h, { mat: "iron", profile: "cylV", piece: "bar" });
  }
  for (const f of [0.02, 0.35, 0.68, 0.97]) b.rect(0, Math.round(h * f) - 2, w, 5, { mat: "iron", profile: "bevel", r: 1, depth: 3, z: 3, piece: "rail" });
  // diagonal braces in the lower bay and warning plates
  b.stroke([2, Math.round(h * 0.68), w - 3, Math.round(h * 0.97)], 3, { mat: "iron", z: 2, piece: "brace" });
  b.rect(Math.round(w / 2) - u(0.25), Math.round(h * 0.4), u(0.5), u(0.22), { mat: "rust", profile: "bevel", r: 1, depth: 2, z: 4, piece: "plate" });
  b.rect(Math.round(w / 2) - u(0.25), Math.round(h * 0.4) + 3, u(0.5), 2, { mat: "clothRed", mode: "paint" });
  b.speckle({ amount: 0.15, seed: 3, tone: -1, mats: ["iron"] });
}

function shutterLeaf(b: PartBuilder, w: number, h: number, u: (f: number) => number): void {
  const slat = Math.max(5, u(0.1));
  for (let y = 0; y < h; y += slat) {
    b.rect(0, y, w, slat - 1, { mat: "iron", profile: "cylH", piece: `s${(y / slat) % 2}` });
    b.rect(0, y + slat - 1, w, 1, { mat: "stoneDark", profile: "flat", noInk: true, piece: "gap" });
  }
  b.speckle({ amount: 0.2, seed: 5, tone: -1, scale: 2 });
  b.speckle({ amount: 0.08, seed: 6, tone: 1 });
  // rust bleeding down and a red hazard band at the foot
  for (let k = 0; k < 7; k++) {
    const x = Math.floor(b.rand() * w);
    b.rect(x, Math.floor(b.rand() * h * 0.6), 1 + Math.floor(b.rand() * 2), u(0.3 + b.rand() * 0.6), { mat: "rust", mode: "paint", tone: -1 });
  }
  for (let x = 0; x < w; x += u(0.24)) b.poly([x, h - u(0.16), x + u(0.12), h - u(0.16), x + u(0.04), h - 1, x - u(0.08), h - 1], { mat: "clothRed", mode: "paint", tone: -1 });
  b.rect(0, h - u(0.06), w, u(0.06), { mat: "iron", profile: "bevel", r: 1, depth: 3, z: 2, piece: "foot" });
}

/** Re-rasterise the leaf part for opening fraction f. */
function drawLeaf(r: Refs, f: number): void {
  const g = r.leaf.grid;
  g.clearAll();
  const e = EASE["inOutSine"]!(Math.max(0, Math.min(1, f)));
  const copy = (src: PartBuilder, sx: number, sy: number, dx: number, dy: number, dark: number): void => {
    const si = src.grid.inner(sx, sy);
    if (si < 0 || !src.grid.mat[si]) return;
    const di = g.inner(dx, dy);
    if (di < 0) return;
    const sg = src.grid;
    g.setRaw(di, sg.mat[si]!, sg.tone[si]! - dark, sg.piece[si]!, sg.height[si]!, sg.flags[si]!, sg.hp[si]!);
  };
  if (r.kind === "ordinary" || r.kind === "sky" || r.kind === "big") {
    // swing away from the viewer: the leaf narrows toward its hinge, the far edge shortens
    const leaves = r.kind === "big" ? 2 : 1;
    const lw = Math.round(r.w / leaves);
    const a = e * Math.PI * 0.39;
    const vis = Math.max(1, Math.round(lw * Math.cos(a)));
    const dark = e > 0.55 ? 2 : e > 0.2 ? 1 : 0;
    for (let L = 0; L < leaves; L++) {
      const src = r.src[L]!;
      const hingeLeft = L === 0;
      for (let x = 0; x < vis; x++) {
        const t = (x + 0.5) / vis; // 0 at the hinge .. 1 at the free edge
        const sx = Math.min(lw - 1, Math.floor(t * lw));
        const shrink = Math.sin(a) * 0.1 * t; // perspective: the far edge is a little shorter
        const top = Math.round(r.h * shrink * 0.5), bot = r.h - Math.round(r.h * shrink * 0.5);
        const dx = hingeLeft ? L * lw + x : r.w - 1 - x;
        const sxx = hingeLeft ? sx : lw - 1 - sx;
        for (let y = top; y < bot; y++) {
          const sy = Math.min(r.h - 1, Math.floor(((y - top) / Math.max(1, bot - top)) * r.h));
          copy(src, sxx, sy, dx, y, dark + (t > 0.85 && e > 0.1 ? 1 : 0));
        }
      }
    }
  } else if (r.kind === "gate") {
    // slides right into its post
    const off = Math.round(e * (r.w - 6));
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w - off; x++) copy(r.src[0]!, x, y, x + off, y, 0);
  } else {
    // shutter: rolls up; the lower edge rises into the housing
    const off = Math.round(e * (r.h - 4));
    for (let y = 0; y < r.h - off; y++) for (let x = 0; x < r.w; x++) copy(r.src[0]!, x, y + off, x, y, 0);
  }
  r.drawnF = f;
}

export const door = defineRecipe<DoorParams, Refs>({
  id: "door",
  breakage: "never",
  reason: "Ways in and on: the lodge, the archive's ordinary door, the chapel, the lift gate, the arena shutters, and the sky door whose latch is the story's shortcut home.",
  defaults: { kind: "ordinary", latch: "none", open: false, beyond: "dark", mark: false, frame: "stone", solid: false },
  use: { reach: 0.6, prompt: "open" },
  persist: ["unlatched"],
  cues: ["door.rattle", "door.unlatch", "door.open", "door.close"],
  standard: { w: 0.7, h: 1.4, parts: ["leaf"], note: "ordinary door (big, gate, shutter: 2.5 x 4)" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const kind = p.kind;
    const [wH, hH] = SIZE[kind];
    const w = u(wH), h = u(hH);
    const big = kind === "big" || kind === "gate" || kind === "shutter";
    const jamb = u(big ? 0.22 : 0.12), lint = u(big ? 0.3 : 0.14);
    const FW = w + jamb * 2, FH = h + lint + (kind === "shutter" ? u(0.2) : 0);
    const fx = Math.floor(FW / 2);
    // the frame (jambs, lintel or arch, a worn threshold)
    const fr = b.part("frame", { w: FW, h: FH + 3, pivot: [fx, FH], at: [0, 0], layer: "bg", z: 4, hittable: true });
    const fm = p.frame === "timber" ? "woodDark" : "stone";
    if (kind === "big") {
      fr.arch(0, 0, FW, FH, { mat: fm, profile: "bevel", r: 4, depth: 5, pointed: 0.62, piece: "frame" });
      fr.arch(jamb, lint, w, h, { mat: fm, mode: "erase", pointed: 0.62 });
      fr.speckle({ amount: 0.1, seed: p.seed, tone: -1, scale: 2 });
      // voussoir joints
      for (let k = 1; k < 9; k++) {
        const a = Math.PI * (0.12 + 0.76 * (k / 9));
        fr.line(fx + Math.cos(a) * (w / 2), lint + u(1.25) * 0.8 - Math.sin(a) * u(1.2), fx + Math.cos(a) * (FW / 2), u(1.3) * 0.8 - Math.sin(a) * u(1.3), { mat: fm, mode: "paint", tone: -2 });
      }
    } else {
      fr.rect(0, 0, jamb, FH, { mat: fm, profile: "bevel", r: 3, depth: 4, piece: "jambL" });
      fr.rect(FW - jamb, 0, jamb, FH, { mat: fm, profile: "bevel", r: 3, depth: 4, piece: "jambR" });
      fr.rect(0, 0, FW, lint, { mat: fm, profile: "bevel", r: 3, depth: 5, z: 1, piece: "lintel" });
      if (p.frame === "stone") {
        for (let y = lint + u(0.3); y < FH; y += u(0.32)) {
          fr.rect(0, y, jamb, 1, { mat: fm, mode: "paint", tone: -2 });
          fr.rect(FW - jamb, y - u(0.16), jamb, 1, { mat: fm, mode: "paint", tone: -2 });
        }
        fr.rect(fx - u(0.08), 0, u(0.16), lint, { mat: "stoneLight", profile: "bevel", r: 2, depth: 6, z: 2, piece: "keystone" });
      } else fr.grain({ dir: "v", seed: p.seed, mats: ["woodDark"] });
      fr.speckle({ amount: 0.08, seed: p.seed + 1, tone: -1, scale: 2 });
    }
    if (kind === "shutter") fr.rect(jamb - 2, lint - 2, w + 4, u(0.22), { mat: "iron", profile: "cylH", z: 3, piece: "housing" });
    if (kind === "gate") fr.rect(FW - jamb - 2, lint, 4, h, { mat: "iron", profile: "cylV", z: 3, piece: "track" });
    fr.rect(jamb - 2, FH, w + 4, 3, { mat: "stoneDark", profile: "bevel", r: 1, depth: 2, piece: "threshold" });
    // the doorway beyond (dark interior), behind the leaf
    const lx = jamb - fx, ly = -(FH - lint);
    if (p.beyond === "dark") {
      const bd = b.part("beyond", { w, h, pivot: [0, 0], at: [lx, ly], layer: "bg", z: 3, hittable: false, outline: 0 });
      if (kind === "big") bd.arch(0, 0, w, h, { mat: "soot", profile: "flat", pointed: 0.62 });
      else bd.rect(0, 0, w, h, { mat: "soot", profile: "flat" });
      bd.rect(0, h - u(0.3), w, u(0.3), { mat: "soot", mode: "paint", tone: 1 });
    }
    // the leaf design(s) and the live leaf
    const src: PartBuilder[] = [];
    if (kind === "big") {
      for (const hinge of ["l", "r"] as const) {
        const c = b.canvas(Math.round(w / 2), h);
        plankLeaf(c, Math.round(w / 2), h, u, { mark: p.mark, arch: true, hinge, seed: p.seed + (hinge === "l" ? 0 : 7), studs: true });
        src.push(c);
      }
    } else if (kind === "gate") {
      const c = b.canvas(w, h);
      gateLeaf(c, w, h, u);
      src.push(c);
    } else if (kind === "shutter") {
      const c = b.canvas(w, h);
      shutterLeaf(c, w, h, u);
      src.push(c);
    } else {
      const c = b.canvas(w, h);
      plankLeaf(c, w, h, u, { mark: p.mark || kind === "sky", arch: false, hinge: "l", seed: p.seed, studs: false });
      src.push(c);
    }
    for (const s of src) s.grid.computeNormals({ x0: 0, y0: 0, x1: s.grid.W - 1, y1: s.grid.Hh - 1 });
    b.part("leaf", { w, h, pivot: [0, 0], at: [lx, ly], layer: "bg", z: 6, collide: p.solid ? "solid" : "none" });
    // the leaf is redrawn from its design as it moves; it never takes wounds
    b.get("leaf").tag["heal"] = false;
    // the maintenance rail: bolted across the doorway, on this side (near) or the far side (far)
    let rail: Part | null = null;
    if (p.latch !== "none") {
      const rw = w + jamb, rh = u(0.09);
      const near = p.latch === "near";
      const rb = b.part("rail", { w: rw, h: rh + 6, pivot: [Math.floor(rw / 2), Math.floor((rh + 6) / 2)], at: [0, -Math.round(h * 0.52)], layer: near ? "mid" : "bg", z: near ? 12 : 5, smoothRotate: true, hittable: near });
      rb.rect(0, 3, rw, rh, { mat: "iron", profile: "cylH", piece: "bar" });
      rb.rect(0, 3, rw, 2, { mat: "iron", mode: "paint", tone: 1 });
      for (const x of [3, rw - 8]) {
        rb.rect(x, 0, 5, rh + 6, { mat: "iron", profile: "bevel", r: 1, depth: 3, z: 3, piece: "clamp" });
        rb.rivets([[x + 2, 2], [x + 2, rh + 3]], { mat: "brass", r: 1.1, z: 5 });
      }
      // the same red mark, as a painted band on the rail
      rb.rect(Math.floor(rw / 2) - u(0.08), 3, u(0.16), rh, { mat: "clothRed", mode: "paint", tone: near ? 0 : -1 });
      rail = b.get("rail");
      if (!near) rail.lit = 0.6;
    }
    const refs: Refs = { kind, leaf: b.get("leaf"), src, f: 0, from: 0, to: 0, dur: DUR[kind], w, h, rail, railF: 0, drawnF: -1 };
    return refs;
  },
  initial: (c) => {
    if (c.refs.rail && c.data["unlatched"]) {
      c.refs.rail.visible = false;
      c.refs.railF = 1;
    }
    const open = !!c.params["open"];
    c.refs.f = open ? 1 : 0;
    drawLeaf(c.refs, c.refs.f);
    return open ? "open" : "closed";
  },
  states: {
    closed: {
      enter(c) {
        c.refs.leaf.collide = c.params["solid"] ? "solid" : "none";
      },
      use(c) {
        const latch = c.params["latch"] as DoorParams["latch"];
        if (latch === "far" && !c.data["unlatched"]) return "rattle";
        if (latch === "near" && !c.data["unlatched"]) return "unlatching";
        return "opening";
      },
      hit: (c, h) => doorHit(c, h.hit.dir[0], h.hit.type),
    },
    rattle: {
      sound: "door.rattle",
      enter(c) {
        c.emit({ type: "door", action: "rattle" });
      },
      update(c) {
        c.refs.leaf.offX = Math.round(Math.sin(c.t * 60) * (c.t < 0.35 ? 1 : 0));
      },
      exit(c) {
        c.refs.leaf.offX = 0;
      },
      after: [0.5, "closed"],
    },
    unlatching: {
      sound: "door.unlatch",
      enter(c) {
        c.data["unlatched"] = true;
        c.emit({ type: "door", action: "unlatch" });
      },
      update(c, dt) {
        const r = c.refs;
        if (!r.rail) return;
        // the rail lifts off its clamps, tips and drops out of the way
        r.railF = Math.min(1, r.railF + dt / 0.9);
        const e = EASE["inCubic"]!(r.railF);
        r.rail.rot = -e * 1.3;
        r.rail.offY = Math.round(e * c.params.H * 0.5);
        r.rail.offX = Math.round(e * c.params.H * 0.3);
        if (r.railF >= 1 && r.rail.visible) {
          r.rail.visible = false;
          const [x, y] = r.rail.toWorld(r.rail.pivotX, r.rail.pivotY);
          puff(c.world, "dust", x, c.y - 2, 6, [0, -1], { speed: 0.4 });
          c.sound("metal.hit", 0.6);
          void y;
        }
      },
      after: [1.0, "opening"],
    },
    opening: {
      sound: "door.open",
      enter(c) {
        startMove(c, 1);
        c.emit({ type: "door", action: "open" });
      },
      update: (c, dt) => moveStep(c, dt),
    },
    open: {
      enter(c) {
        c.refs.leaf.collide = "none";
      },
      use(c) {
        c.emit({ type: "door", action: "enter" });
      },
      hit: (c, h) => doorHit(c, h.hit.dir[0], h.hit.type),
    },
    closing: {
      sound: "door.close",
      enter: (c) => startMove(c, 0),
      update: (c, dt) => moveStep(c, dt),
    },
  },
  actions: {
    open: (c) => (c.state === "closed" ? (c.params["latch"] === "far" && !c.data["unlatched"] ? "rattle" : "opening") : undefined),
    close: (c) => (c.state === "open" ? "closing" : undefined),
    /** Release the rail from the far side's story beat (the latch on the balcony opens the loft door). */
    release: (c) => {
      c.data["unlatched"] = true;
      if (c.refs.rail) c.refs.rail.visible = false;
      return c.state === "closed" ? "opening" : undefined;
    },
  },
  demo: {
    indoor: true,
    // all five kinds on one 16 H stage (the camera stays still, so every step shares one frame)
    w: 16,
    params: { kind: "sky", latch: "near", mark: true },
    variants: [
      { label: "big (arched double)", params: { kind: "big", latch: "none", mark: false }, dx: -5.85 },
      { label: "ordinary (latched far side)", params: { kind: "ordinary", latch: "far", mark: false }, dx: -3.23 },
      { label: "timber, open", params: { kind: "ordinary", frame: "timber", open: true, latch: "none", mark: false }, dx: -1.61 },
      { label: "lift gate", params: { kind: "gate", latch: "none", mark: false }, dx: 2.49 },
      { label: "arena shutter", params: { kind: "shutter", latch: "none", mark: false }, dx: 5.98 },
    ],
    script: [
      { label: "sky door closed; rail bolted on this side", wait: 0.8 },
      { label: "E: release the rail", use: true, wait: 1.3 },
      { label: "it opens onto a dark doorway", wait: 1.0 },
      { label: "hit: shakes, never breaks", hit: "slash", from: -0.9, wait: 0.8 },
      { label: "close", act: "close", wait: 1.0 },
      { label: "E again: opens (the release is saved)", use: true, wait: 1.2 },
      { label: "latched far side: E rattles, stays shut", variant: "ordinary (latched far side)", use: true, wait: 0.9 },
      { label: "timber door closes", variant: "timber, open", act: "close", wait: 1.0 },
      { label: "timber door: E opens", variant: "timber, open", use: true, wait: 1.0 },
      { label: "big: E, both leaves swing", variant: "big (arched double)", use: true, from: -0.4, wait: 1.9 },
      { label: "big: heavy hit shakes it, never breaks", variant: "big (arched double)", hit: "heavy", from: -0.6, wait: 0.9 },
      { label: "big closes", variant: "big (arched double)", act: "close", wait: 1.8 },
      { label: "lift gate: E, slides into its post", variant: "lift gate", use: true, from: -0.4, wait: 1.7 },
      { label: "lift gate closes", variant: "lift gate", act: "close", wait: 1.6 },
      { label: "shutter: E, rolls up into its housing", variant: "arena shutter", use: true, from: -0.4, wait: 2.2 },
      { label: "shutter: Q hit shakes it, never breaks", variant: "arena shutter", hit: "q", from: -0.8, wait: 1.0 },
      { label: "shutter rolls down", variant: "arena shutter", act: "close", wait: 2.2 },
    ],
  },
});

function startMove(c: Prop<Refs>, to: number): void {
  const r = c.refs;
  r.from = r.f;
  r.to = to;
  c.refs.leaf.collide = "none";
}

function moveStep(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const dir = Math.sign(r.to - r.from) || 1;
  r.f = Math.max(0, Math.min(1, r.f + (dir * dt) / r.dur));
  if (Math.abs(r.f - r.drawnF) > 0.001) drawLeaf(r, r.f);
  if ((dir > 0 && r.f >= 1) || (dir < 0 && r.f <= 0)) {
    c.go(dir > 0 ? "open" : "closed");
    if (dir < 0) c.sound("door.shut", 0.7);
  }
}

function doorHit(c: Prop<Refs>, dir: number, type: string): void {
  if (type === "wind") return;
  const r = c.refs;
  r.leaf.shake = Math.max(r.leaf.shake, type === "slash" || type === "point" ? 0.15 : 0.3);
  r.leaf.flash = Math.max(r.leaf.flash, 0.4);
  c.sound(r.kind === "gate" || r.kind === "shutter" ? "metal.hit" : "wood.hit", 0.7);
  if (c.params["latch"] === "far" && !c.data["unlatched"] && c.state === "closed") c.go("rattle");
  void dir;
  void F_NOINK;
}

// Crates, barrels and rubble: the market's and the waiting room's clutter,
// the rubble at crater rims and fallen walls.
//
// crate: planks in a frame with a cross brace and iron corners; stacks of
// one to three. Solid (you can stand on it). Splinters along the grain and
// mends. Origin: floor, centre.
//
// barrel: staves and iron hoops. A slash splinters staves and dents hoops; a
// heavy hit, Q or R knocks it onto its side and it rolls a little way, then
// it fades and stands back where it was. Origin: floor, centre.
//
// rubble: a heap of loose stones (or bricks, or broken timber), each its own
// piece so the heap reads as stones; hits knock pieces off and it mends.
// Origin: floor, the heap's centre.

import { fracture } from "../break.ts";
import { puff } from "../kit.ts";
import { EASE } from "../util.ts";
import { defineRecipe } from "../prop.ts";
import type { Part } from "../part.ts";

// ---------------------------------------------------------------------------
// crate
// ---------------------------------------------------------------------------

export interface CrateParams {
  /** Side in H. */
  size: number;
  stack: number;
}

export const crate = defineRecipe<CrateParams, null>({
  id: "crate",
  breakage: "heal",
  reason: "Goods in the market and bags left in the waiting room: something to jump on and something that splinters satisfyingly, then mends.",
  defaults: { size: 0.5, stack: 1 },
  cues: ["wood.hit", "wood.break"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const n = Math.max(1, Math.min(3, Math.round(p.stack)));
    for (let k = 0; k < n; k++) {
      const s = u(p.size * (k === 0 ? 1 : 0.86 - k * 0.04));
      const name = `crate${k}`;
      const below = k === 0 ? 0 : u(p.size) + (k > 1 ? u(p.size * 0.82) : 0);
      const dx = k === 0 ? 0 : Math.round((b.rand() - 0.5) * u(0.12));
      const c = b.part(name, { w: s, h: s, pivot: [s >> 1, s], at: [dx, -below], layer: "mid", z: 6 + k, collide: "solid" });
      const bd = Math.max(3, u(0.07));
      // planks
      const planks = Math.max(3, Math.round(s / u(0.12)));
      for (let q = 0; q < planks; q++) {
        const y0 = Math.round((q * s) / planks), y1 = Math.round(((q + 1) * s) / planks);
        c.rect(0, y0, s, y1 - y0, { mat: "wood", profile: "bevel", r: 1, depth: 2, tone: q % 2 ? -1 : 0, piece: `plank${q % 2}` });
      }
      c.grain({ dir: "h", seed: p.seed + k, stretch: 14, mats: ["wood"] });
      // frame and cross brace
      c.piece("frame");
      c.rect(0, 0, s, bd, { mat: "wood", profile: "bevel", r: 1, depth: 3, z: 2, tone: 1 });
      c.rect(0, s - bd, s, bd, { mat: "wood", profile: "bevel", r: 1, depth: 3, z: 2, tone: 1 });
      c.rect(0, 0, bd, s, { mat: "wood", profile: "bevel", r: 1, depth: 3, z: 2, tone: 1 });
      c.rect(s - bd, 0, bd, s, { mat: "wood", profile: "bevel", r: 1, depth: 3, z: 2, tone: 1 });
      c.stroke([bd, s - bd, s - bd, bd], Math.max(2, bd - 1), { mat: "wood", profile: "bevel", z: 2, piece: "brace", tone: 0 });
      // iron corners
      for (const [x, y] of [[0, 0], [s - bd - 1, 0], [0, s - bd - 1], [s - bd - 1, s - bd - 1]] as const) {
        c.rect(x, y, bd + 1, bd + 1, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 4, piece: "corner" });
        c.rivets([[x + ((bd + 1) >> 1), y + ((bd + 1) >> 1)]], { mat: "iron", r: 0.8, z: 6 });
      }
      c.wear({ amount: 0.03, seed: p.seed + k * 3 });
    }
    return null;
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        if (h.hit.type === "wind") return;
        const reps = c.damage(h.hit);
        for (const r of reps) if (r.removed && r.contact) puff(c.world, "splinter", r.contact[0], r.contact[1], 4, [h.hit.dir[0], -0.6]);
      },
    },
  },
  demo: {
    w: 5,
    variants: [{ label: "stack of three", params: { stack: 3 }, dx: 1.6 }],
    script: [
      { label: "idle", wait: 0.6 },
      { label: "slash: splinters", hit: "slash", from: -0.8, wait: 1.2 },
      { label: "heavy: breaks", hit: "heavy", from: -1.0, wait: 1.5 },
      { label: "Q", hit: "q", from: -1.0, wait: 2 },
      { label: "mends", wait: 8 },
    ],
  },
});

// ---------------------------------------------------------------------------
// barrel
// ---------------------------------------------------------------------------

interface BarrelRefs {
  body: Part;
  side: number;
  vx: number;
  e: number;
}

export const barrel = defineRecipe<Record<string, never>, BarrelRefs>({
  id: "barrel",
  breakage: "heal",
  reason: "Market clutter with weight: a big hit knocks it over and it rolls, then it stands back where it was so the market resets.",
  defaults: {},
  cues: ["wood.hit", "metal.hit", "barrel.roll"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const w = u(0.4), h = u(0.55);
    const bd = b.part("body", { w, h, pivot: [w >> 1, h], at: [0, 0], layer: "mid", z: 6, collide: "solid", smoothRotate: true });
    // bulging staves
    const bulge = (y: number): number => (w / 2) * (0.84 + 0.16 * Math.sin(Math.PI * (y / h)));
    const pts: number[] = [];
    for (let k = 0; k <= 10; k++) pts.push(w / 2 + bulge((k / 10) * h), (k / 10) * h);
    for (let k = 10; k >= 0; k--) pts.push(w / 2 - bulge((k / 10) * h), (k / 10) * h);
    bd.poly(pts, { mat: "wood", profile: "cylV", piece: "staves" });
    for (let x = 3; x < w - 2; x += Math.max(3, u(0.06))) bd.rect(x, 1, 1, h - 2, { mat: "wood", mode: "paint", tone: -1 });
    bd.grain({ dir: "v", seed: p.seed, mats: ["wood"], stretch: 18, density: 0.2 });
    // hoops and the lid's rim
    for (const f of [0.08, 0.3, 0.7, 0.92]) {
      const y = Math.round(h * f);
      const half = bulge(y);
      bd.rect(w / 2 - half, y - 1, half * 2, 3, { mat: "iron", profile: "cylH", z: 3, piece: "hoop" });
    }
    bd.rect(Math.round(w * 0.1), 0, Math.round(w * 0.8), 2, { mat: "woodDark", profile: "flat", z: 2, piece: "lid" });
    bd.rivets([[Math.round(w * 0.3), Math.round(h * 0.3)], [Math.round(w * 0.7), Math.round(h * 0.7)]], { mat: "iron", r: 0.8 });
    return { body: b.get("body"), side: 1, vx: 0, e: 0 };
  },
  initial: "standing",
  states: {
    standing: {
      hit(c, h) {
        if (h.hit.type === "wind") return;
        const reps = c.damage(h.hit);
        for (const r of reps) if (r.removed && r.contact) puff(c.world, "splinter", r.contact[0], r.contact[1], 3, [h.hit.dir[0], -0.6]);
        if (h.hit.type !== "slash" && h.hit.type !== "point") {
          c.refs.side = h.hit.dir[0] < 0 ? -1 : 1;
          return "tipping";
        }
      },
    },
    tipping: {
      sound: "barrel.roll",
      enter(c) {
        c.refs.vx = c.refs.side * c.params.H * 1.4;
        c.refs.body.collide = "none";
      },
      update(c, dt) {
        const r = c.refs, H = c.params.H;
        // over onto its side (about its foot), then rolling on the hoops, slowing
        r.e = Math.min(1, r.e + dt / 0.35);
        const a = EASE["outBounce"]!(r.e) * (Math.PI / 2) * r.side;
        r.body.rot = a;
        r.body.offY = -Math.round(Math.abs(Math.sin(a)) * H * 0.2);
        r.body.offX += r.vx * dt;
        r.vx *= Math.pow(0.35, dt);
        if (c.t > 2.2) c.go("restoring");
      },
    },
    restoring: {
      enter(c) {
        c.world.tweens.add({ target: c.refs.body, key: "dissolve", to: 1, dur: 0.5 });
      },
      update(c) {
        const r = c.refs;
        if (c.t > 1.4 && r.body.rot !== 0) {
          r.body.rot = 0;
          r.body.offX = 0;
          r.body.offY = 0;
          r.e = 0;
          c.world.restorePart(r.body);
          r.body.dissolveMode = 1;
          c.world.tweens.add({ target: r.body, key: "dissolve", to: 0, dur: 0.6 });
        }
      },
      after: [2.2, "standing"],
      exit(c) {
        c.refs.body.collide = "solid";
      },
    },
  },
  demo: {
    w: 4,
    script: [
      { label: "standing", wait: 0.5 },
      { label: "slash: splinters, hoop dents", hit: "slash", from: -0.8, wait: 1 },
      { label: "heavy: knocked over, rolls", hit: "heavy", from: -1.1, wait: 2.6 },
      { label: "stands back where it was", wait: 2.5 },
    ],
  },
});

// ---------------------------------------------------------------------------
// rubble
// ---------------------------------------------------------------------------

export interface RubbleParams {
  kind: "stone" | "brick" | "timber";
  /** Heap width and height in H. */
  width: number;
  height: number;
}

export const rubble = defineRecipe<RubbleParams, null>({
  id: "rubble",
  breakage: "heal",
  reason: "Broken stone where old things fell (the causeway's colonnade, the spire's broken rail, crater rims): it tells what happened without words, and it knocks around when hit.",
  defaults: { kind: "stone", width: 1.2, height: 0.35 },
  cues: ["stone.hit", "stone.break"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Ht = u(p.height);
    const r = b.rand;
    const hp = b.part("heap", { w: W, h: Ht, pivot: [W >> 1, Ht], at: [0, 0], layer: "mid", z: 5 });
    const mats = p.kind === "brick" ? ["rust", "stone"] : p.kind === "timber" ? ["wood", "woodDark"] : ["stone", "stoneLight", "stoneDark"];
    // stones fill a mound from the bottom up; later stones sit in front (inner lines between them)
    const count = Math.round((W * Ht) / (u(0.13) * u(0.1)));
    for (let k = 0; k < count; k++) {
      const x = r() * W;
      const t = Math.abs(x - W / 2) / (W / 2);
      const top = Ht * (1 - Math.cos((1 - t) * Math.PI * 0.5) * 0.95);
      const y = top + r() * (Ht - top);
      const m = mats[Math.floor(r() * mats.length)]!;
      const sw = u(p.kind === "timber" ? 0.2 + r() * 0.2 : 0.08 + r() * 0.1), sh = u(p.kind === "timber" ? 0.05 : 0.06 + r() * 0.06);
      const piece = `s${k % 60}`;
      if (p.kind === "timber") hp.stroke([x - sw / 2, y + (r() - 0.5) * sh * 2, x + sw / 2, y + (r() - 0.5) * sh * 2], sh, { mat: m, piece, profile: "cylV" });
      else if (p.kind === "brick") hp.rect(x - sw / 2, y - sh / 2, sw, sh, { mat: m, profile: "bevel", r: 2, depth: 3, piece, tone: r() < 0.3 ? -1 : 0 });
      else {
        const pts: number[] = [];
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2 + r() * 0.5;
          pts.push(x + Math.cos(ang) * sw * (0.4 + r() * 0.2), y + Math.sin(ang) * sh * (0.4 + r() * 0.2));
        }
        hp.poly(pts, { mat: m, profile: "dome", r: 3, piece, tone: r() < 0.25 ? -1 : 0 });
      }
    }
    hp.speckle({ amount: 0.12, seed: p.seed, tone: -1, scale: 2 });
    if (p.kind === "timber") hp.grain({ dir: "h", seed: p.seed + 1, mats: ["wood", "woodDark"] });
    return null;
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        if (h.hit.type === "wind") return;
        const reps = c.damage(h.hit);
        for (const r of reps) if (r.removed && r.contact) puff(c.world, "dust", r.contact[0], r.contact[1], 5, [0, -1]);
      },
    },
  },
  actions: {
    /** Knock the top of the heap loose (a colossus footfall nearby): pieces tumble and come back. */
    shake: (c) => {
      const part = c.part("heap");
      // a sway-only room (the nave) keeps every stone: the heap only shudders
      if (c.keepsCells) {
        part.shake = Math.max(part.shake, 0.3);
        c.sound("stone.hit", 0.4);
        return;
      }
      const g = part.grid;
      const cells: number[] = [];
      for (let i = 0; i < g.mat.length; i++) if (g.mat[i] && g.ly(i) < g.h * 0.35 && c.rand() < 0.5) cells.push(i);
      if (!cells.length) return;
      const [x, y] = part.toWorld(g.w / 2, 0);
      fracture(c.world, part, cells, { contact: [x, y + 4], pieceSize: 26, minChunk: 8, impulse: c.params.H * 1.2, dir: [0, -1], home: true });
      c.world.wound(part, cells);
    },
  },
  demo: {
    w: 5,
    variants: [
      { label: "brick", params: { kind: "brick", width: 1 }, dx: -1.7 },
      { label: "timber", params: { kind: "timber", width: 1.1, height: 0.25 }, dx: 1.7 },
    ],
    script: [
      { label: "idle", wait: 0.6 },
      { label: "shake (a footfall nearby)", act: "shake", wait: 1.6 },
      { label: "heavy", hit: "heavy", from: -1.0, wait: 1.6 },
      { label: "mends", wait: 8 },
    ],
  },
});

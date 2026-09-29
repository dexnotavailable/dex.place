// Breakable pillar: a stone column (round and fluted, or square courses, or
// already broken off). Hits chip it and cracks spread; as soon as a hit cuts
// through the shaft (a row goes empty, the shaft splits, or a thin neck is
// left carrying the rest) or a fifth of it is gone, everything above the
// break falls as rubble; then it all flies home and the column stands again
// (the room heals). Nothing is ever left hanging in the air. Solid.
// Origin: floor, centre.

import { fracture } from "../break.ts";
import { puff, remaining } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import type { CellGrid } from "../cells.ts";

export interface PillarParams {
  kind: "round" | "square" | "broken";
  /** Height and shaft width in H. */
  height: number;
  width: number;
  stone: "stone" | "stoneLight" | "marble";
}

interface Refs {
  shaft: Part;
  toppled: boolean;
}

export const pillar = defineRecipe<PillarParams, Refs>({
  id: "pillar",
  breakage: "heal",
  reason: "Columns of the causeway's colonnade and the spire's galleries: cover, rhythm, and something that crumbles under Q and R and stands again.",
  defaults: { kind: "round", height: 2.6, width: 0.42, stone: "stone" },
  cues: ["stone.hit", "stone.break", "pillar.topple"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const sw = u(p.width), Ht = u(p.height);
    const W = sw + u(0.2);
    const cx = W >> 1;
    const s = b.part("shaft", { w: W, h: Ht, pivot: [cx, Ht], at: [0, 0], layer: "mid", z: 6, collide: "solid" });
    const m = p.stone;
    const baseH = u(0.16), capH = p.kind === "broken" ? 0 : u(0.18);
    // plinth and base mouldings
    s.piece("base");
    s.rect(0, Ht - u(0.08), W, u(0.08), { mat: m, profile: "bevel", r: 3, depth: 4 });
    // the torus sits on the plinth (no gap row: the column is one connected body)
    s.rect(u(0.04), Ht - baseH, W - u(0.08), baseH - u(0.08), { mat: m, profile: "cylH", z: 1, piece: "torus" });
    // the shaft
    s.piece("shaft");
    const top = capH + (p.kind === "broken" ? u(0.3) : 0);
    if (p.kind === "square") {
      s.bricks(cx - sw / 2, capH, sw, Ht - capH - baseH, { bw: sw, bh: u(0.34), mat: m, mortar: "mortar", seed: p.seed, bevel: 3, tones: [0, -1, 0] });
    } else {
      s.rect(cx - sw / 2, top, sw, Ht - top - baseH, { mat: m, profile: "cylV" });
      if (p.kind === "round" || p.kind === "broken") for (let k = -2; k <= 2; k++) s.rect(cx + Math.round((k * sw) / 6) - 1, top + 2, 1, Ht - top - baseH - 4, { mat: m, mode: "paint", tone: -1 });
      // drum joints
      for (let y = top + u(0.55); y < Ht - baseH - 4; y += u(0.55)) s.rect(cx - sw / 2, y, sw, 1, { mat: m, mode: "paint", tone: -2 });
    }
    if (p.kind === "broken") {
      // a jagged break at the top
      for (let x = Math.round(cx - sw / 2); x < cx + sw / 2; x++) {
        const d = Math.round((Math.sin(x * 1.7 + p.seed) * 0.5 + 0.5) * u(0.22) + (x - cx) * 0.25);
        for (let y = top; y < top + Math.max(0, d); y++) {
          const i = s.grid.inner(x, y);
          if (i >= 0) s.grid.clearRaw(i);
        }
      }
    } else {
      s.piece("capital");
      s.rect(0, 0, W, u(0.07), { mat: m, profile: "bevel", r: 3, depth: 5, z: 2 });
      s.poly([u(0.03), u(0.07), W - u(0.03), u(0.07), cx + sw / 2, capH, cx - sw / 2, capH], { mat: m, profile: "dome", r: 4, z: 1 });
    }
    s.speckle({ amount: 0.1, seed: p.seed + 1, tone: -1, scale: 2 });
    s.cracks(cx + 3, Ht * 0.6, { n: 1, len: 12, seed: p.seed + 2, dir: Math.PI / 2 });
    s.wear({ amount: 0.05 + p.wear * 0.2, seed: p.seed + 3 });
    // a column: twice as hard as loose stone
    const g = s.grid;
    for (let i = 0; i < g.hp.length; i++) g.hp[i] = g.hp[i]! * 2;
    // no specks left hanging by the jagged break or the wear: the column is one body on its plinth
    for (const i of looseCells(g, false)) g.clearRaw(i);
    return { shaft: b.get("shaft"), toppled: false };
  },
  initial: "standing",
  states: {
    standing: {
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.damage(h.hit);
        if (c.keepsCells) return;
        const side = h.hit.dir[0] < 0 ? -1 : 1;
        // a cut through the shaft (an empty row, a split, or a thin neck): everything above it falls
        const loose = unsupported(c.refs.shaft);
        if (loose) return topple(c, side, h.contact, loose);
        if (remaining(c.refs.shaft) < 0.8) return topple(c, side, h.contact);
      },
    },
    fallen: {
      sound: "pillar.topple",
      update(c) {
        // everything flies home with the room's healing; stand again when whole
        if (c.t > 2 && remaining(c.refs.shaft) > 0.995) c.go("standing");
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.damage(h.hit);
        // the stump can be cut again: whatever it leaves hanging falls too
        const loose = c.keepsCells ? null : unsupported(c.refs.shaft);
        if (loose) topple(c, h.hit.dir[0] < 0 ? -1 : 1, h.contact, loose);
      },
    },
  },
  demo: {
    w: 5.5,
    variants: [
      { label: "square", params: { kind: "square" }, dx: 1.7 },
      { label: "broken", params: { kind: "broken", height: 1.5 }, dx: -1.7 },
    ],
    script: [
      { label: "standing", wait: 0.5 },
      { label: "slash: chips", hit: "slash", from: -0.9, wait: 0.8 },
      { label: "heavy: cracks, chunks", hit: "heavy", from: -1.1, wait: 1 },
      { label: "Q: the upper drums fall", hit: "q", from: -1.2, wait: 3 },
      { label: "flies home and stands again", wait: 8 },
    ],
  },
});

/** Loose cells below this many stay put (a chip hanging on by its corner is not a column). */
const LOOSE_MIN = 24;

/**
 * The cells that no longer stand on the plinth: every cell not joined (edge
 * to edge) to the bottom rows, plus everything above a neck, a row cut down
 * to a few cells (under 30% of what it was built with) that still carries
 * real weight. Null while the column still stands on its own.
 */
function unsupported(part: Part): number[] | null {
  const out = looseCells(part.grid, true);
  return out.length >= LOOSE_MIN ? out : null;
}

/** Cells not joined to the bottom rows (and, with `neck`, everything above a cut-down neck). */
function looseCells(g: CellGrid, neck: boolean): number[] {
  const { w, h } = g;
  const orig = g.orig?.mat;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let y = Math.max(0, h - 2); y < h; y++) for (let x = 0; x < w; x++) {
    if (g.mat[g.inner(x, y)]) { seen[y * w + x] = 1; stack.push(y * w + x); }
  }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w, y = (k / w) | 0;
    const nb = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
    for (const n of nb) {
      if (n < 0 || seen[n]) continue;
      if (!g.mat[g.inner(n % w, (n / w) | 0)]) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  // a neck: the lowest cut-down row with weight above it
  const rowN = new Int32Array(h), rowO = new Int32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (seen[y * w + x]) rowN[y] = rowN[y]! + 1;
    if (orig && orig[g.inner(x, y)]) rowO[y] = rowO[y]! + 1;
  }
  let cut = -1, above = 0;
  const neckMax = Math.max(2, Math.round(w * 0.15));
  for (let y = 0; neck && y < h - 2; y++) {
    if (above >= LOOSE_MIN * 2 && rowN[y]! <= neckMax && rowN[y]! < rowO[y]! * 0.3) cut = y;
    above += rowN[y]!;
  }
  const out: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = g.inner(x, y);
    if (g.mat[i] && (!seen[y * w + x] || y <= cut)) out.push(i);
  }
  return out;
}

/**
 * Everything above the break falls as rubble (it will fly home when the
 * wound heals): the given loose cells, or everything above the weakest row.
 */
function topple(c: Prop<Refs>, side: number, contact: [number, number] | null, loose?: number[]): string {
  const part = c.refs.shaft;
  const g = part.grid;
  let cells: number[] = [];
  let bestY = -1;
  if (loose) {
    cells = loose;
    for (const i of cells) bestY = Math.max(bestY, g.ly(i));
  } else {
    // the row with the fewest cells left (the break line)
    let bestN = Infinity;
    for (let y = Math.round(g.h * 0.2); y < g.h - Math.round(c.params.H * 0.3); y++) {
      let n = 0;
      for (let x = 0; x < g.w; x++) if (g.mat[g.inner(x, y)]) n++;
      if (n < bestN) { bestN = n; bestY = y; }
    }
    for (let y = 0; y < bestY; y++) for (let x = 0; x < g.w; x++) {
      const i = g.inner(x, y);
      if (g.mat[i]) cells.push(i);
    }
  }
  if (!cells.length) return "standing";
  const [x, y] = part.toWorld(g.w / 2, bestY);
  fracture(c.world, part, cells, { contact: contact ?? [x - side * 10, y], pieceSize: 70, minChunk: 12, impulse: c.params.H * 1.6, dir: [side, -0.2], home: true, spin: 5 });
  c.world.wound(part, cells);
  puff(c.world, "dust", x, y, 12, [side, -0.5], { speed: 0.7 });
  return "fallen";
}

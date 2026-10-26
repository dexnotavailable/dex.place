// Breaking things: hit overlap, per-material damage (stone crumbles, glass
// shatters, wood splinters, metal dents and sparks, cloth tears, flame
// gutters), carving, cracks that spread, fracture into rigid chunks and pixel
// particles, craters with raised rims, slash scars, and restore.

import { F_ADDED, F_CRACK, F_NOHIT, type CellGrid, type Rect } from "./cells.ts";
import { Chunk, P_ADD, P_DRAG, P_FADE, P_GRAV, P_RISE, P_SETTLE } from "./bodies.ts";
import { coverage, cutPath, hitBounds, hitCentre, type Hit } from "./hits.ts";
import { matById, type Material, type RGB } from "./materials.ts";
import type { Part } from "./part.ts";
import type { PixelWorld } from "./world.ts";

export interface Overlap {
  part: Part;
  cells: number[];
  cov: number[];
  contact: [number, number] | null;
}

export interface PartReport {
  part: Part;
  covered: number;
  removed: number;
  damaged: number;
  dented: number;
  shattered: number;
  flame: number;
  contact: [number, number] | null;
  /** Dominant material among the covered cells. */
  mat: Material | null;
}

const TYPE_MUL: Record<string, number> = { slash: 1, heavy: 1.5, q: 2, r: 2.6, point: 1, wind: 0 };

/** Which cells of `part` the hit covers (no damage yet). */
export function overlap(part: Part, hit: Hit): Overlap {
  const out: Overlap = { part, cells: [], cov: [], contact: null };
  const hb = hitBounds(hit.shape);
  const pb = part.worldBounds();
  const x0 = Math.floor(Math.max(hb.x0, pb.x0)), x1 = Math.ceil(Math.min(hb.x1, pb.x1));
  const y0 = Math.floor(Math.max(hb.y0, pb.y0)), y1 = Math.ceil(Math.min(hb.y1, pb.y1));
  if (x1 < x0 || y1 < y0) return out;
  let sx = 0, sy = 0, sw = 0;
  const seen = new Set<number>();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = coverage(hit.shape, x + 0.5, y + 0.5);
      if (c <= 0) continue;
      const i = part.cellAt(x + 0.5, y + 0.5);
      if (i < 0 || seen.has(i)) continue;
      seen.add(i);
      out.cells.push(i);
      out.cov.push(c);
      sx += (x + 0.5) * c;
      sy += (y + 0.5) * c;
      sw += c;
    }
  }
  if (sw > 0) out.contact = [sx / sw, sy / sw];
  return out;
}

function colourOf(g: CellGrid, i: number): RGB {
  const m = matById(g.mat[i]!);
  if (!m) return [255, 0, 255];
  const k = Math.max(0, Math.min(3, 2 + g.tone[i]!));
  return m.rgb[k]!;
}

/**
 * Apply material damage for an overlap. Removed cells become chunks and
 * particles; glass pieces shatter; metal dents and sparks; cracks spread.
 */
export function damage(world: PixelWorld, ov: Overlap, hit: Hit): PartReport {
  const { part } = ov;
  const g = part.grid;
  const rep: PartReport = { part, covered: ov.cells.length, removed: 0, damaged: 0, dented: 0, shattered: 0, flame: 0, contact: ov.contact, mat: null };
  if (!ov.cells.length) return rep;
  const mul = TYPE_MUL[hit.type] ?? 1;
  const removed: number[] = [];
  const shatter = new Set<number>();
  const counts = new Map<number, number>();
  let crackFrom = -1, crackBest = 0;
  for (let k = 0; k < ov.cells.length; k++) {
    const i = ov.cells[k]!;
    const cov = ov.cov[k]!;
    const m = matById(g.mat[i]!);
    if (!m) continue;
    counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
    if (g.flags[i]! & F_NOHIT || m.behaviour === "none") continue;
    const dmg = hit.damage * cov * mul;
    if (dmg <= 0) continue;
    switch (m.behaviour) {
      case "dent": {
        g.hp[i] = g.hp[i]! - dmg * 0.25;
        g.height[i] = Math.max(0, g.height[i]! - Math.min(2.5, dmg / 55));
        g.markRaw(i);
        rep.dented++;
        if (g.hp[i]! <= 0) removed.push(i);
        break;
      }
      case "shatter":
        shatter.add(g.piece[i]!);
        break;
      case "gutter":
        rep.flame++;
        break;
      case "splash":
        break;
      case "tear": {
        const cut = hit.type === "slash" || hit.type === "point" ? cov > 0.8 : true;
        if (cut) {
          g.hp[i] = g.hp[i]! - dmg * 2;
          if (g.hp[i]! <= 0) removed.push(i);
        }
        break;
      }
      default: {
        g.hp[i] = g.hp[i]! - dmg;
        if (g.hp[i]! <= 0) removed.push(i);
        else {
          rep.damaged++;
          if (g.hp[i]! < m.hardness * 0.55 && g.tone[i]! > -2) {
            g.tone[i] = g.tone[i]! - 1;
            g.markRaw(i);
          }
          if (dmg > crackBest) { crackBest = dmg; crackFrom = i; }
        }
      }
    }
  }
  let bestN = 0;
  for (const [id, n] of counts) if (n > bestN) { bestN = n; rep.mat = matById(id) ?? null; }
  const contact = ov.contact ?? hitCentre(hit.shape);
  if (removed.length) {
    rep.removed = removed.length;
    detach(world, part, removed, contact, hit);
  }
  for (const pid of shatter) rep.shattered += shatterPiece(world, part, pid, contact, hit);
  const cracked: number[] = [];
  if (crackFrom >= 0) {
    const m = matById(g.mat[crackFrom]!);
    if (m && m.behaviour === "crumble") cracked.push(...spreadCracks(g, crackFrom, Math.min(18, 3 + (crackBest / m.hardness) * 10), world.rand, hit.dir));
  }
  if (rep.dented) sparks(world, contact, Math.min(14, 3 + (rep.dented >> 2)), hit);
  if (removed.length || rep.shattered || rep.dented || rep.damaged) world.wound(part, removed.concat(cracked, ov.cells));
  return rep;
}

/** Random-walk cracks from a cell, darkening and flagging what they cross. */
export function spreadCracks(g: CellGrid, from: number, len: number, rand: () => number, dir: [number, number] = [0, 1]): number[] {
  const touched: number[] = [];
  const branches = 1 + (rand() < 0.5 ? 1 : 0);
  for (let b = 0; b < branches; b++) {
    let x = g.lx(from), y = g.ly(from);
    let a = Math.atan2(dir[1], dir[0]) + (rand() - 0.5) * 2.2;
    for (let s = 0; s < len; s++) {
      a += (rand() - 0.5) * 1.1;
      x += Math.cos(a);
      y += Math.sin(a);
      const i = g.inner(x, y);
      if (i < 0 || !g.mat[i]) break;
      g.flags[i] = g.flags[i]! | F_CRACK;
      if (g.tone[i]! > -2) g.tone[i] = -2;
      g.height[i] = Math.max(0, g.height[i]! - 0.8);
      g.markRaw(i);
      touched.push(i);
    }
  }
  return touched;
}

function sparks(world: PixelWorld, at: [number, number], n: number, hit: Hit): void {
  const r = world.rand;
  for (let k = 0; k < n; k++) {
    const a = Math.atan2(-hit.dir[1], -hit.dir[0]) + (r() - 0.5) * 2.4;
    const sp = world.H * (1.5 + r() * 3);
    world.particles.spawn({
      x: at[0], y: at[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - world.H,
      life: 0.18 + r() * 0.3, rgb: r() < 0.5 ? [255, 236, 180] : [255, 190, 110], flags: P_ADD | P_GRAV,
    });
  }
  world.flashLight(at[0], at[1], [1, 0.85, 0.6], world.H * 0.9, 1.1, 0.08);
}

/** Connected regions (4-neighbour) of a set of raw indices. */
function regions(g: CellGrid, cells: number[]): number[][] {
  const set = new Set(cells);
  const out: number[][] = [];
  for (const c of cells) {
    if (!set.has(c)) continue;
    set.delete(c);
    const reg = [c];
    for (let k = 0; k < reg.length; k++) {
      const i = reg[k]!;
      for (const j of [i - 1, i + 1, i - g.W, i + g.W]) if (set.has(j)) { set.delete(j); reg.push(j); }
    }
    out.push(reg);
  }
  return out;
}

/** Voronoi split of `cells` into about `k` pieces (anisotropic metric for grain). */
function voronoi(g: CellGrid, cells: number[], k: number, rand: () => number, bias?: [number, number], aniso: [number, number] = [1, 1]): number[][] {
  if (k <= 1 || cells.length < 8) return [cells];
  const seeds: [number, number][] = [];
  for (let s = 0; s < k; s++) {
    const c = cells[Math.floor(rand() * cells.length)]!;
    let x = g.lx(c), y = g.ly(c);
    if (bias && s < k / 2) {
      // pull half the seeds toward the impact: smaller pieces there
      const t = 0.3 + rand() * 0.5;
      x += (bias[0] - x) * t;
      y += (bias[1] - y) * t;
    }
    seeds.push([x, y]);
  }
  const groups: number[][] = seeds.map(() => []);
  for (const c of cells) {
    const x = g.lx(c), y = g.ly(c);
    let best = 0, bd = Infinity;
    for (let s = 0; s < seeds.length; s++) {
      const dx = (x - seeds[s]![0]) * aniso[0], dy = (y - seeds[s]![1]) * aniso[1];
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = s; }
    }
    groups[best]!.push(c);
  }
  return groups.filter((a) => a.length);
}

export interface FractureOpts {
  contact: [number, number];
  /** Cells per piece on average. */
  pieceSize: number;
  minChunk: number;
  impulse: number;
  dir: [number, number];
  spin?: number;
  aniso?: [number, number];
  /** Pieces keep a way home (restorable). */
  home?: boolean;
  /** Share of sub-minChunk cells that fly as pixels (rest: dust). */
  debris?: number;
  glint?: boolean;
}

/** Split cells off a part into chunks and particles, clearing them from the part. */
export function fracture(world: PixelWorld, part: Part, cells: number[], o: FractureOpts): number {
  const g = part.grid;
  const r = world.rand;
  const [clx, cly] = part.toLocal(o.contact[0], o.contact[1]);
  let made = 0;
  for (const reg of regions(g, cells)) {
    const k = Math.max(1, Math.round(reg.length / o.pieceSize));
    for (const piece of voronoi(g, reg, k, r, [clx, cly], o.aniso)) {
      if (piece.length >= o.minChunk && world.chunks.length < world.budget.chunks) {
        const { grid, ox, oy } = g.extract(piece);
        const px = grid.w / 2, py = grid.h / 2;
        const ch = new Chunk(grid, px, py);
        const [wx, wy] = part.toWorld(ox + px, oy + py);
        ch.x = wx;
        ch.y = wy;
        ch.rot = part.wrot;
        ch.flip = part.wflip;
        ch.layer = part.layer === "bg" || part.layer === "far" ? "mid" : part.layer;
        ch.outline = part.outline;
        ch.lit = part.lit;
        ch.glow = part.glow * 0.8;
        const dx = wx - o.contact[0], dy = wy - o.contact[1];
        const d = Math.hypot(dx, dy) || 1;
        const sp = o.impulse * (0.35 + r() * 0.65);
        ch.vx = (dx / d) * sp * 0.7 + o.dir[0] * sp * 0.6 + (r() - 0.5) * sp * 0.3;
        ch.vy = (dy / d) * sp * 0.5 + o.dir[1] * sp * 0.4 - sp * 0.35;
        ch.vr = (r() - 0.5) * (o.spin ?? 9) / Math.sqrt(piece.length);
        if (o.home) {
          const cellsInParent = new Int32Array(piece);
          ch.home = { part, cells: cellsInParent, ox, oy };
        }
        if (o.glint) ch.glintT = 0;
        world.addChunk(ch);
        made++;
      } else {
        for (const i of piece) {
          const m = matById(g.mat[i]!);
          const [x, y] = part.cellWorld(i);
          if (r() < (o.debris ?? m?.debris ?? 0.4)) {
            const dx = x - o.contact[0], dy = y - o.contact[1];
            const d = Math.hypot(dx, dy) || 1;
            const sp = o.impulse * (0.3 + r() * 0.9);
            world.particles.spawn({
              x, y, vx: (dx / d) * sp * 0.6 + o.dir[0] * sp * 0.5 + (r() - 0.5) * sp * 0.4, vy: (dy / d) * sp * 0.4 + o.dir[1] * sp * 0.3 - sp * 0.45,
              life: 2.5 + r() * 4, rgb: colourOf(g, i), flags: P_GRAV | P_SETTLE | P_FADE,
              home: o.home ? { part, idx: i } : undefined,
            });
            if (o.glint && r() < 0.25) {
              world.particles.spawn({ x, y, vx: (r() - 0.5) * 40, vy: -20 - r() * 40, life: 0.25 + r() * 0.3, rgb: [230, 240, 255], flags: P_ADD | P_DRAG });
            }
          } else if (m && r() < 0.3) {
            world.particles.spawn({ x, y, vx: (r() - 0.5) * 30, vy: -10 - r() * 25, life: 0.6 + r() * 0.8, rgb: m.dustRgb, flags: P_DRAG | P_RISE | P_FADE });
          }
        }
      }
    }
  }
  for (const i of cells) g.clearRaw(i);
  return made;
}

/** Removed cells: chunks for solid materials, pixels and dust for the rest. */
function detach(world: PixelWorld, part: Part, removed: number[], contact: [number, number], hit: Hit): void {
  const g = part.grid;
  const m = matById(g.mat[removed[0]!]!);
  const beh = m?.behaviour ?? "crumble";
  const chunky = beh === "crumble" || beh === "splinter";
  fracture(world, part, removed, {
    contact,
    pieceSize: beh === "splinter" ? 22 : 30,
    minChunk: chunky ? (hit.type === "slash" ? 14 : 9) : 1e9,
    impulse: hit.force,
    dir: hit.dir,
    aniso: beh === "splinter" ? [2.6, 0.45] : [1, 1],
    home: part.ground || !!part.tag["restorable"] || !!part.tag["heal"],
  });
  world.soundAt(`${m?.sound ?? "stone"}.break`, contact[0], contact[1], Math.min(1, removed.length / 40));
}

/** Shatter a whole glass piece into shards (and glinting pixels). */
export function shatterPiece(world: PixelWorld, part: Part, pid: number, contact: [number, number], hit: Hit): number {
  const g = part.grid;
  const cells: number[] = [];
  for (let i = 0; i < g.mat.length; i++) {
    if (!g.mat[i] || g.piece[i] !== pid) continue;
    const m = matById(g.mat[i]!);
    if (m?.behaviour === "shatter") cells.push(i);
  }
  if (!cells.length) return 0;
  fracture(world, part, cells, {
    contact, pieceSize: 26, minChunk: 6, impulse: hit.force * 0.9, dir: hit.dir, spin: 16, home: true, debris: 0.8, glint: true,
  });
  world.soundAt("glass.break", contact[0], contact[1], 1);
  world.flashLight(contact[0], contact[1], [0.8, 0.9, 1], world.H * 1.2, 1.0, 0.1);
  return cells.length;
}

/** Top solid cell of a ground part's column at world x, searching down from y. */
export function surfaceAt(part: Part, x: number, fromY: number, limit = 400): number {
  for (let y = Math.floor(fromY); y < fromY + limit; y++) if (part.cellAt(x + 0.5, y + 0.5) >= 0) return y;
  return NaN;
}

/**
 * Crater where a hit meets the ground: a bowl carved into the surface, a
 * raised rim of the same material on both sides, cracks running down the
 * face, debris and dust thrown up.
 */
export function crater(world: PixelWorld, part: Part, x: number, fromY: number, rx: number, ry: number, rim: number, hit: Hit): number {
  const sy = surfaceAt(part, x, fromY - world.H * 2, world.H * 4);
  if (Number.isNaN(sy)) return 0;
  const g = part.grid;
  const r = world.rand;
  const carved: number[] = [];
  const cx = x, cy = sy - ry * 0.25;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
      const dx = (xx + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const wob = 1 + (r() - 0.5) * 0.12;
      if (dx * dx + dy * dy > wob) continue;
      const i = part.cellAt(xx + 0.5, y + 0.5);
      if (i >= 0 && !(g.flags[i]! & F_NOHIT)) carved.push(i);
    }
  }
  // the rim: cells copied from the surface, piled up on both sides
  const rimW = Math.max(3, rx * 0.5);
  const added: number[] = [];
  for (const side of [-1, 1]) {
    for (let d = 0; d < rimW; d++) {
      const wx = cx + side * (rx - 1 + d);
      const t = d / rimW;
      const hgt = Math.round(rim * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (0.8 + r() * 0.4));
      const top = surfaceAt(part, wx, sy - ry - rim - 4, ry * 2 + rim + 8);
      if (Number.isNaN(top)) continue;
      const below = part.cellAt(wx + 0.5, top + 0.5);
      if (below < 0) continue;
      for (let k = 1; k <= hgt; k++) {
        const [lx, ly] = part.toLocal(wx + 0.5, top - k + 0.5);
        const i = g.inner(lx, ly);
        if (i < 0 || g.mat[i]) continue;
        g.setRaw(i, g.mat[below]!, Math.max(-2, g.tone[below]! - (k === hgt ? 0 : 1)), g.piece[below]!, g.height[below]! + 1, F_ADDED, g.hp[below]! * 0.6);
        added.push(i);
      }
    }
  }
  // cracks running down and out from the bowl
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const a = Math.PI / 2 + (r() - 0.5) * 2.2;
    const bx = cx + Math.cos(a) * rx * 0.9, by = cy + Math.sin(a) * ry * 0.9 + 1;
    const i = part.cellAt(bx, by);
    if (i >= 0) added.push(...spreadCracks(g, i, ry * 2 + r() * ry * 3, r, [Math.cos(a), Math.sin(a)]));
  }
  // dust
  for (let k = 0; k < rx * 1.2; k++) {
    const m = carved.length ? matById(g.mat[carved[Math.floor(r() * carved.length)]!]!) : undefined;
    world.particles.spawn({
      x: cx + (r() - 0.5) * rx * 2.2, y: sy - 1 - r() * 3, vx: (r() - 0.5) * rx * 3, vy: -r() * world.H * 0.9,
      life: 0.7 + r() * 1.1, rgb: m?.dustRgb ?? [80, 76, 90], flags: P_DRAG | P_RISE | P_FADE, size: r() < 0.3 ? 2 : 1,
    });
  }
  if (carved.length) {
    fracture(world, part, carved, {
      contact: [cx, sy + ry], pieceSize: 34, minChunk: hit.type === "r" || hit.type === "q" ? 10 : 16, impulse: hit.force, dir: [0, -1], home: true, debris: 0.5,
    });
  }
  world.wound(part, carved.concat(added));
  world.soundAt("stone.crater", cx, sy, 1);
  return carved.length;
}

/** A slash scar: the arc's core carves a thin groove where it crosses the ground, the rest scratches. */
export function scar(world: PixelWorld, part: Part, hit: Hit): number {
  const ov = overlap(part, hit);
  if (!ov.cells.length) return 0;
  const g = part.grid;
  const carve: number[] = [];
  const touched: number[] = [];
  for (let k = 0; k < ov.cells.length; k++) {
    const i = ov.cells[k]!;
    // only near the surface: the cell 3 px above is empty
    const x = g.lx(i), y = g.ly(i);
    let nearTop = false;
    for (let d = 1; d <= 3; d++) if (!g.solid(x, y - d)) nearTop = true;
    if (!nearTop) continue;
    if (ov.cov[k]! > 0.82) carve.push(i);
    else {
      g.flags[i] = g.flags[i]! | F_CRACK;
      g.tone[i] = Math.min(g.tone[i]!, -1);
      g.markRaw(i);
      touched.push(i);
    }
  }
  if (carve.length) fracture(world, part, carve, { contact: ov.contact!, pieceSize: 1e9, minChunk: 1e9, impulse: hit.force * 0.5, dir: hit.dir, home: true, debris: 0.6 });
  world.wound(part, carve.concat(touched));
  return carve.length + touched.length;
}

/** Cut ropes and tear cloth along the hit's cutting edge. */
export function cutAlong(world: PixelWorld, hit: Hit, ropes: { cutLine(ax: number, ay: number, bx: number, by: number): number }[], cloths: { tear(ax: number, ay: number, bx: number, by: number): number }[]): { cut: number; torn: number } {
  const path = cutPath(hit.shape);
  let cut = 0, torn = 0;
  for (let i = 0; i + 3 < path.length; i += 2) {
    const ax = path[i]!, ay = path[i + 1]!, bx = path[i + 2]!, by = path[i + 3]!;
    for (const r of ropes) if (r.cutLine(ax, ay, bx, by) >= 0) cut++;
    for (const c of cloths) torn += c.tear(ax, ay, bx, by);
  }
  void world;
  return { cut, torn };
}

/** World-space rect of raw indices on a part (wound bookkeeping). */
export function rawRect(g: CellGrid, cells: number[]): Rect | null {
  if (!cells.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of cells) {
    const X = i % g.W, Y = (i / g.W) | 0;
    if (X < x0) x0 = X;
    if (X > x1) x1 = X;
    if (Y < y0) y0 = Y;
    if (Y > y1) y1 = Y;
  }
  return { x0, y0, x1, y1 };
}

export { P_ADD, P_DRAG, P_FADE, P_GRAV, P_RISE, P_SETTLE };

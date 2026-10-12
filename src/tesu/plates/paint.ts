// Painting plate tiles. A tile is TILE x TILE art px of one plane at one density; it is
// painted from every piece whose bounds touch it, in z order. Pure and deterministic, so
// it runs the same in a worker, on the main thread and in Node (tools/tesu previews).

import { TILE } from "../config.ts";
import { ctxFor, painter } from "../art/painter.ts";
import { IdxBuf } from "../art/raster.ts";
import { PLANES, PLANE_IDS, type Piece, type PlaneId, type WorldDef } from "../world/types.ts";

const BUCKET = 1024;

export class PlateIndex {
  private byPlane = new Map<PlaneId, Map<number, Piece[]>>();
  readonly world: WorldDef;

  constructor(world: WorldDef) {
    this.world = world;
    for (const id of PLANE_IDS) this.byPlane.set(id, new Map());
    for (const pc of world.pieces) {
      const box = pc.box;
      if (!box) throw new Error(`piece ${pc.kind} has no bounds (build the world with WorldBuilder)`);
      const m = this.byPlane.get(pc.plane)!;
      for (let b = Math.floor(box[0] / BUCKET); b <= Math.floor(box[2] / BUCKET); b++) {
        let a = m.get(b);
        if (!a) m.set(b, (a = []));
        a.push(pc);
      }
    }
    for (const m of this.byPlane.values()) for (const a of m.values()) a.sort((p, q) => p.z - q.z || p.seed - q.seed);
  }

  /** Pieces of a plane whose bounds touch the level-1 rectangle, in paint order. */
  piecesIn(plane: PlaneId, x0: number, y0: number, x1: number, y1: number): Piece[] {
    const m = this.byPlane.get(plane)!;
    const seen = new Set<Piece>();
    const out: Piece[] = [];
    for (let b = Math.floor(x0 / BUCKET); b <= Math.floor(x1 / BUCKET); b++) {
      for (const pc of m.get(b) ?? []) {
        if (seen.has(pc)) continue;
        seen.add(pc);
        const [a, c, d, e] = pc.box!;
        if (d > x0 && a < x1 && e > y0 && c < y1) out.push(pc);
      }
    }
    return out.sort((p, q) => p.z - q.z || p.seed - q.seed);
  }

  /** Level-1 bounds of everything on a plane (for previews). */
  extent(plane: PlaneId): [number, number, number, number] | null {
    let r: [number, number, number, number] | null = null;
    for (const pc of this.world.pieces) {
      if (pc.plane !== plane) continue;
      const b = pc.box!;
      r = r ? [Math.min(r[0], b[0]), Math.min(r[1], b[1]), Math.max(r[2], b[2]), Math.max(r[3], b[3])] : [...b];
    }
    return r;
  }
}

/** Paints any rectangle of a plane at a density (art px of that level). */
export function paintRegion(idx: PlateIndex, plane: PlaneId, level: number, ox: number, oy: number, w: number, h: number): IdxBuf {
  const buf = new IdxBuf(w, h, ox, oy, level);
  const rate = PLANES[plane].rate;
  // a pixel of margin in level-1 px so outlines that look one pixel outside still join
  const m = 2 / level;
  for (const pc of idx.piecesIn(plane, ox / level - m, oy / level - m, (ox + w) / level + m, (oy + h) / level + m)) {
    const c = ctxFor(buf, level, pc.x * rate, pc.y * rate, pc.seed);
    painter(pc.kind).paint(c, pc.p);
  }
  return buf;
}

/** One plate tile, or null when nothing is painted there. */
export function paintTile(idx: PlateIndex, plane: PlaneId, level: number, tx: number, ty: number): Uint8Array | null {
  const buf = paintRegion(idx, plane, level, tx * TILE, ty * TILE, TILE, TILE);
  return buf.empty() ? null : buf.px;
}

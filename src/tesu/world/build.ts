// The composer's tool: sections of the land add pieces, ground, edges, water and camera
// through one builder, which checks them and fills in each piece's bounds.

import { painter } from "../art/painter.ts";
import { PLANES, type MistBank, type SpriteDef, type Atmos, type CamTrack, type Piece, type Place, type PlaneId, type Spawn, type Surface, type Walk, type Wall, type Water, type Void, type WorldDef } from "./types.ts";

export interface PieceOpts {
  z?: number;
  seed?: number;
  reflect?: boolean;
}

export class WorldBuilder {
  readonly def: WorldDef;
  private nextWalk = 1;
  private nextSeed = 1;

  constructor(w: number, h: number) {
    this.def = { w, h, pieces: [], sprites: [], walks: [], walls: [], waters: [], mists: [], voids: [], tracks: [], atmos: [], spawns: [], places: [] };
  }

  /** A painted piece. x, y: its anchor in 3D world px; p: painter params in its plane's level-1 px. */
  piece(plane: PlaneId, kind: string, x: number, y: number, p: Record<string, unknown> = {}, o: PieceOpts = {}): Piece {
    const pc: Piece = { plane, kind, x, y, p, z: o.z ?? 0, seed: o.seed ?? this.nextSeed++ * 7919, reflect: o.reflect };
    const b = painter(kind).bounds(p);
    const r = PLANES[plane].rate;
    pc.box = [x * r + b[0], y * r + b[1], x * r + b[2], y * r + b[3]];
    this.def.pieces.push(pc);
    return pc;
  }

  /** Something that moves on a plane. */
  sprite(d: Omit<SpriteDef, "seed"> & { seed?: number }): SpriteDef {
    if (this.def.sprites.some((s) => s.id === d.id)) throw new Error(`sprite ${d.id} defined twice`);
    const s: SpriteDef = { ...d, seed: d.seed ?? this.nextSeed++ * 7919 };
    this.def.sprites.push(s);
    return s;
  }

  /** Walkable ground through world px points [x, y, x, y, ...]. */
  walk(pts: number[], o: { surface?: Surface; oneWay?: boolean; depth?: number; name?: string } = {}): Walk {
    const w: Walk = {
      id: this.nextWalk++,
      pts: pts.map((v) => Math.round(v * 100) / 100),
      surface: o.surface ?? "stone",
      oneWay: o.oneWay ?? false,
      depth: o.depth ?? Infinity,
      name: o.name,
    };
    this.def.walks.push(w);
    return w;
  }

  wall(w: Wall): void {
    if (!(w.y1 > w.y0)) throw new Error(`wall at ${w.x}: y1 must be below y0`);
    this.def.walls.push(w);
  }

  water(w: Water): void {
    this.def.waters.push(w);
  }

  mist(m: MistBank): void {
    this.def.mists.push(m);
  }

  void(v: Void): void {
    this.def.voids.push(v);
  }

  track(t: CamTrack): void {
    t.keys.sort((a, b) => a.x - b.x);
    this.def.tracks.push(t);
  }

  atmos(a: Atmos): void {
    this.def.atmos.push(a);
    this.def.atmos.sort((p, q) => p.x - q.x);
  }

  spawn(s: Spawn): void {
    if (this.def.spawns.some((o) => o.id === s.id)) throw new Error(`spawn ${s.id} defined twice`);
    this.def.spawns.push(s);
  }

  place(p: Place): void {
    this.def.places.push(p);
  }

  finish(): WorldDef {
    return this.def;
  }
}

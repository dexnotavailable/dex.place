// The composer's tool: sections of the land add pieces, ground, edges, water and camera
// through one builder, which checks them and fills in each piece's bounds.

import { painter } from "../art/painter.ts";
import { PLANES, type CharmDef, type RideDef, type PropDef, type Usable, type MistBank, type SpriteDef, type Atmos, type CamTrack, type Piece, type Place, type PlaneId, type Spawn, type Surface, type Walk, type Wall, type Water, type Void, type WorldDef } from "./types.ts";

export interface PieceOpts {
  z?: number;
  seed?: number;
  reflect?: boolean;
  minLevel?: number;
}

export class WorldBuilder {
  readonly def: WorldDef;
  private nextWalk = 1;
  private nextSeed = 1;

  constructor(w: number, h: number) {
    this.def = { w, h, pieces: [], sprites: [], walks: [], walls: [], waters: [], mists: [], voids: [], tracks: [], atmos: [], spawns: [], places: [], usables: [], props: [], rides: [], charms: [] };
  }

  /** A painted piece. x, y: its anchor in 3D world px; p: painter params in its plane's level-1 px. */
  piece(plane: PlaneId, kind: string, x: number, y: number, p: Record<string, unknown> = {}, o: PieceOpts = {}): Piece {
    const pc: Piece = { plane, kind, x, y, p, z: o.z ?? 0, seed: o.seed ?? this.nextSeed++ * 7919, reflect: o.reflect, minLevel: o.minLevel };
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
  walk(pts: number[], o: { surface?: Surface; oneWay?: boolean; depth?: number; name?: string; stair?: boolean; when?: string } = {}): Walk {
    const w: Walk = {
      id: this.nextWalk++,
      pts: pts.map((v) => Math.round(v * 100) / 100),
      surface: o.surface ?? "stone",
      oneWay: o.oneWay ?? !!o.stair,
      depth: o.depth ?? Infinity,
      name: o.name,
      stair: o.stair,
      when: o.when,
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

  usable(u: Usable): void {
    if (this.def.usables.some((o) => o.id === u.id)) throw new Error(`usable ${u.id} defined twice`);
    this.def.usables.push(u);
  }

  /** Something that breaks (drawn as a sprite on the play plane, driven by the props runtime). */
  prop(d: PropDef): PropDef {
    if (this.def.props.some((o) => o.id === d.id)) throw new Error(`prop ${d.id} defined twice`);
    if (d.on && !this.def.props.some((o) => o.id === d.on)) throw new Error(`prop ${d.id} stands on unknown ${d.on}`);
    this.def.props.push(d);
    this.sprite({ id: `prop:${d.id}`, plane: "play", kind: d.kind, x: d.x, y: d.y, p: d.p, frames: 1, frame: 0 });
    return d;
  }

  place(p: Place): void {
    this.def.places.push(p);
  }

  /** A paper charm over a gap (its sprite is defined with the same id). */
  charm(c: CharmDef): CharmDef {
    if (this.def.charms.some((o) => o.id === c.id)) throw new Error(`charm ${c.id} defined twice`);
    this.def.charms.push(c);
    return c;
  }

  /** A ropeway: its cable, its two cars (sprites defined here, front parts too). */
  ride(r: RideDef): RideDef {
    if (this.def.rides.some((o) => o.id === r.id)) throw new Error(`ride ${r.id} defined twice`);
    if (r.pts.length < 4) throw new Error(`ride ${r.id} needs a cable`);
    this.def.rides.push(r);
    return r;
  }

  finish(): WorldDef {
    return this.def;
  }
}

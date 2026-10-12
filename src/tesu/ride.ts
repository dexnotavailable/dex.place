// Ropeways (GDK A.3: Shanshui's Silk Line). Two cars hang from one cable, one at each station;
// boarding one sends it to the far end while its partner comes the other way, passing midway.
// She rides with controls held: each tick the car moves along the cable and she stands on its
// floor (a small stand-in world for the player's physics, so she idles in the car as on ground).

import type { Body } from "../lab/game/world.ts";
import type { RideDef, SpriteDef } from "./world/types.ts";

export interface RideHost {
  sprite(id: string): SpriteDef | undefined;
}

/** The point at a share (0..1) of the way along a polyline, by length. */
export function along(pts: readonly number[], u: number): [number, number] {
  let len = 0;
  for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
  let d = Math.max(0, Math.min(1, u)) * len;
  for (let i = 2; i < pts.length; i += 2) {
    const sl = Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
    if (d <= sl || i === pts.length - 2) {
      const k = sl > 0 ? Math.min(1, d / sl) : 0;
      return [pts[i - 2]! + (pts[i]! - pts[i - 2]!) * k, pts[i - 1]! + (pts[i + 1]! - pts[i - 1]!) * k];
    }
    d -= sl;
  }
  return [pts[0]!, pts[1]!];
}

/**
 * Share of the way along a ride `t` seconds after leaving, of `secs` in all: it eases out of
 * the station over the first few seconds, runs even, and eases into the other one.
 */
export function rideShare(t: number, secs: number): number {
  const ta = Math.min(3, secs / 4);
  const v = 1 / (secs - ta);
  if (t <= 0) return 0;
  if (t >= secs) return 1;
  if (t < ta) return (0.5 * v * t * t) / ta;
  if (t < secs - ta) return v * (t - ta / 2);
  const r = secs - t;
  return 1 - (0.5 * v * r * r) / ta;
}

interface Riding {
  def: RideDef;
  dir: 1 | -1;
  /** Which of the two cars she is in. */
  car: 0 | 1;
  t: number;
}

export class Rides {
  /** Each ride's first car, as a share of the way up (0 at the low station); the second is at 1 minus it. */
  private at = new Map<string, number>();
  active: Riding | null = null;
  /** The car's floor under her (world px), while riding. */
  private floor: [number, number] = [0, 0];

  private readonly defs: readonly RideDef[];
  private readonly host: RideHost;

  constructor(defs: readonly RideDef[], host: RideHost) {
    this.defs = defs;
    this.host = host;
    for (const d of defs) {
      this.at.set(d.id, 0);
      this.placeCars(d);
    }
  }

  /** Where a car hangs (its cable point), by ride and car. */
  carAt(id: string, car: 0 | 1): [number, number] {
    const d = this.defs.find((r) => r.id === id)!;
    const u = this.at.get(id) ?? 0;
    return along(d.pts, car === 0 ? u : 1 - u);
  }

  /** Boards the car waiting at this end (dir 1: the low station, going up). */
  board(id: string, dir: 1 | -1, b: Body): boolean {
    if (this.active) return false;
    const def = this.defs.find((r) => r.id === id);
    if (!def) return false;
    const u = this.at.get(id) ?? 0;
    // the car at her station: share 0 at the low end, 1 at the high end
    const here = dir === 1 ? 0 : 1;
    const car: 0 | 1 = Math.abs(u - here) < 1e-6 ? 0 : 1;
    this.active = { def, dir, car, t: 0 };
    this.carry(b);
    return true;
  }

  /** Her car's share of the way up. */
  private share(r: Riding): number {
    const s = rideShare(r.t, r.def.secs);
    return r.dir === 1 ? s : 1 - s;
  }

  /** One sim tick of the ride: the cars move, she is carried. Returns the ride when it has arrived. */
  tick(b: Body): Riding | null {
    const r = this.active;
    if (!r) return null;
    r.t += 1 / 60;
    const s = this.share(r);
    this.at.set(r.def.id, r.car === 0 ? s : 1 - s);
    this.placeCars(r.def);
    this.carry(b);
    if (r.t >= r.def.secs) {
      this.active = null;
      return r;
    }
    return null;
  }

  /** She stands in her car: carried along (x) and set on its floor (y) while grounded. */
  private carry(b: Body): void {
    const r = this.active;
    if (!r) return;
    const [x, y] = along(r.def.pts, this.share(r));
    this.floor = [x, y + r.def.hang];
    b.x = x;
    b.vx = 0;
    if (b.grounded || b.y > this.floor[1]) {
      b.y = this.floor[1];
      b.vy = 0;
      b.grounded = true;
    }
  }

  private placeCars(d: RideDef): void {
    const u = this.at.get(d.id) ?? 0;
    d.cars.forEach((id, i) => {
      const [x, y] = along(d.pts, i === 0 ? u : 1 - u);
      for (const s of [this.host.sprite(id), this.host.sprite(`${id}:front`)]) {
        if (!s) continue;
        s.x = x;
        s.y = y;
      }
    });
  }

  /** The player's physics while riding: the car's floor is the only ground, and it carries her. */
  readonly world = {
    move: (b: Body, _dx: number, dy: number): { landed: boolean } => {
      const fy = this.floor[1];
      const was = b.grounded;
      if (b.y + dy >= fy) {
        b.y = fy;
        b.vy = 0;
        b.grounded = true;
        return { landed: !was };
      }
      b.y += dy;
      b.grounded = false;
      return { landed: false };
    },
  };
}

// Room collision for the lab's player controller. Implements the calls the
// lab Player makes on its World (move, supported, groundAt, bounds, width)
// for room geometry: solid blocks (floors, walls, steps), one-way platforms
// (drop through with down + jump), and moving platforms (lifts). Readable
// stairs: a grounded body steps up onto anything up to PHYSICS.stepUp high and
// sticks to steps going down (PHYSICS.stepDown), so a staircase is a run of
// small blocks. Room edges are walls unless an exit is open on that side.
//
// Coordinates are room pixels, y down, the room's top-left at (0, 0). A body's
// position is its feet (x centre, y bottom), as in the lab.

import type { Body } from "../../lab/game/world.ts";
import { PHYSICS, SCALE } from "../config.ts";

export type Surface = "stone" | "wood" | "metal" | "earth" | "water";

export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  surface: Surface;
  /** Lift or other mover: its motion this tick, to carry what stands on it. */
  mover?: { dx: number; dy: number };
  /** Disabled solids (an open door) are ignored. */
  off?: boolean;
  id?: string;
}

export interface OneWay {
  x: number;
  y: number;
  w: number;
  surface: Surface;
  mover?: { dx: number; dy: number };
  off?: boolean;
  id?: string;
}

export class Collision {
  readonly width: number;
  readonly height: number;
  solids: Solid[] = [];
  oneWays: OneWay[] = [];
  /** Sides with an exit: the body may walk past the edge (the room then transitions). */
  open = { left: false, right: false };
  /** Surface under the last body that landed (footsteps). */
  lastSurface: Surface = "stone";
  /** What the last grounded body stands on (a lift carries it). */
  standingOn: Solid | OneWay | null = null;
  private stepUp = Math.round(PHYSICS.stepUp * SCALE.H);
  private stepDown = Math.round(PHYSICS.stepDown * SCALE.H);

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  bounds(): [number, number, number, number] {
    return [0, 0, this.width, this.height];
  }

  private overlapsX(b: Body, x0: number, x1: number, bx = b.x): boolean {
    const half = b.w / 2;
    return bx + half > x0 && bx - half < x1;
  }

  /** Top of the first surface at or below (x, y); the room floor line if none. */
  groundAt(x: number, y: number): number {
    let best = this.height + 1000;
    for (const s of this.solids) if (!s.off && x >= s.x && x <= s.x + s.w && s.y >= y - 0.5 && s.y < best) best = s.y;
    for (const p of this.oneWays) if (!p.off && x >= p.x && x <= p.x + p.w && p.y >= y - 0.5 && p.y < best) best = p.y;
    return best;
  }

  /** Is the body standing on something right now. */
  supported(b: Body): boolean {
    return this.surfaceUnder(b, b.x, b.y, 0.6) !== null;
  }

  /** On a one-way platform (so down + jump drops through). */
  onOneWay(b: Body): boolean {
    const s = this.surfaceUnder(b, b.x, b.y, 0.6);
    return !!s && !("h" in s);
  }

  private surfaceUnder(b: Body, x: number, y: number, tol: number): Solid | OneWay | null {
    for (const s of this.solids) if (!s.off && Math.abs(y - s.y) <= tol && this.overlapsX(b, s.x, s.x + s.w, x)) return s;
    for (const p of this.oneWays) if (!p.off && Math.abs(y - p.y) <= tol && this.overlapsX(b, p.x, p.x + p.w, x)) return p;
    return null;
  }

  /** Solid blocking a body box [x-half, y-h, x+half, y) (strict overlap). */
  private blocking(b: Body, x: number, y: number): Solid | null {
    const half = b.w / 2;
    for (const s of this.solids) {
      if (s.off) continue;
      if (x + half > s.x && x - half < s.x + s.w && y > s.y + 0.01 && y - b.h < s.y + s.h - 0.01) return s;
    }
    return null;
  }

  move(b: Body, dx: number, dy: number): { landed: boolean } {
    const half = b.w / 2;
    const wasGrounded = b.grounded;
    // --- horizontal, with step-up
    if (dx !== 0) {
      let nx = b.x + dx;
      const hit = this.blocking(b, nx, b.y);
      if (hit) {
        const rise = b.y - hit.y;
        if (wasGrounded && rise > 0 && rise <= this.stepUp && !this.blocking(b, nx, hit.y)) {
          b.y = hit.y;
        } else {
          nx = dx > 0 ? hit.x - half - 0.001 : hit.x + hit.w + half + 0.001;
          // never pushed backwards through something
          if ((dx > 0 && nx < b.x) || (dx < 0 && nx > b.x)) nx = b.x;
          b.vx = 0;
        }
      }
      const minX = this.open.left ? -SCALE.H : half + 2;
      const maxX = this.open.right ? this.width + SCALE.H : this.width - half - 2;
      b.x = Math.min(Math.max(nx, minX), maxX);
    }
    // --- vertical
    const prevY = b.y;
    let ny = b.y + dy;
    let landed = false;
    let on: Solid | OneWay | null = null;
    b.grounded = false;
    if (dy >= 0) {
      let best = Infinity;
      for (const s of this.solids) {
        if (s.off || !this.overlapsX(b, s.x, s.x + s.w)) continue;
        // a mover that rose into the body this tick still catches it
        const top0 = s.y - (s.mover?.dy ?? 0);
        if (prevY <= Math.max(s.y, top0) + 0.01 && ny >= s.y && s.y < best) {
          best = s.y;
          on = s;
        }
      }
      if (b.dropThrough <= 0) {
        for (const p of this.oneWays) {
          if (p.off || !this.overlapsX(b, p.x, p.x + p.w)) continue;
          const top0 = p.y - (p.mover?.dy ?? 0);
          if (prevY <= Math.max(p.y, top0) + 0.01 && ny >= p.y && p.y < best) {
            best = p.y;
            on = p;
          }
        }
      }
      if (best < Infinity) {
        ny = best;
        landed = true;
      } else if (wasGrounded && dy < this.stepDown) {
        // stick to stairs going down
        let snap = Infinity;
        for (const s of this.solids) {
          if (s.off || !this.overlapsX(b, s.x, s.x + s.w)) continue;
          if (s.y > ny && s.y - ny <= this.stepDown && s.y < snap) {
            snap = s.y;
            on = s;
          }
        }
        if (snap < Infinity && !this.blocking(b, b.x, snap)) {
          ny = snap;
          landed = true;
        } else on = null;
      }
    } else {
      // head against a ceiling
      for (const s of this.solids) {
        if (s.off || !this.overlapsX(b, s.x, s.x + s.w)) continue;
        const bottom = s.y + s.h;
        if (prevY - b.h >= bottom - 0.01 && ny - b.h < bottom) {
          ny = bottom + b.h;
          b.vy = 0;
        }
      }
    }
    b.y = ny;
    if (landed) {
      b.grounded = true;
      if (b.vy > 0) b.vy = 0;
      this.standingOn = on;
      if (on) this.lastSurface = on.surface;
    } else this.standingOn = null;
    if (b.dropThrough > 0) b.dropThrough--;
    return { landed: landed && !wasGrounded };
  }
}

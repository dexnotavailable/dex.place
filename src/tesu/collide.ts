// Ground for one continuous world: walk polylines (slopes, steps, planks), the mass under
// solid ground (so you cannot walk into a cliff or jump through a road's underside), and
// explicit hard edges (rails, walls). Implements the one call the lab Player makes on its
// world, move(body, dx, dy), plus what the host asks (support, one-way ground, ground
// below a point). Queries are bucketed by x, so the size of the world does not matter.
//
// Terrain grammar (GDK 3.4, A.4): there is no fall damage anywhere; stepping off any edge
// drops you to the ground below; an edge you cannot step off has a drawn reason (a Wall);
// a fall into the void is the host's business (game.ts tugs her back).

import { H, PHYSICS } from "./config.ts";
import type { Surface, Walk, Wall } from "./world/types.ts";

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  grounded: boolean;
  dropThrough: number;
}

const BUCKET = 512;
const EPS = 0.01;

/** y of a walk at x, or null when x is outside it. */
export function walkY(w: Walk, x: number): number | null {
  const p = w.pts;
  const n = p.length;
  if (x < p[0]! || x > p[n - 2]!) return null;
  // binary search the segment
  let lo = 0, hi = n / 2 - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p[mid * 2]! <= x) lo = mid;
    else hi = mid;
  }
  const x0 = p[lo * 2]!, y0 = p[lo * 2 + 1]!, x1 = p[hi * 2]!, y1 = p[hi * 2 + 1]!;
  if (x1 === x0) return Math.min(y0, y1);
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

export class Collision {
  readonly walks: Walk[] = [];
  readonly walls: Wall[] = [];
  private wb = new Map<number, Walk[]>();
  private lb = new Map<number, Wall[]>();
  /** The walk she stands on (after move), and its surface for footsteps. */
  standingOn: Walk | null = null;
  lastSurface: Surface = "stone";
  readonly stepUp = PHYSICS.stepUp * H;
  readonly stepDown = PHYSICS.stepDown * H;
  /** World x bounds (the world ends are drawn: a road bending away, a railing). */
  minX = 0;
  maxX = Infinity;
  /** Walks switched off (a rope bridge not dropped yet, a lift elsewhere). */
  off = new Set<number>();
  /** Walls switched off (a rail a dropped bridge now carries on from). */
  offWalls = new Set<Wall>();

  constructor(walks: readonly Walk[], walls: readonly Wall[]) {
    for (const w of walks) this.addWalk(w);
    for (const w of walls) this.addWall(w);
    // gated ground starts switched off (the game switches it on with its flag)
    for (const w of walks) if (w.when) this.off.add(w.id);
  }

  /** Switches gated walks and walls by the world's flags. */
  gate(has: (flag: string) => boolean): void {
    for (const w of this.walks) if (w.when) { if (has(w.when)) this.off.delete(w.id); else this.off.add(w.id); }
    for (const w of this.walls) if (w.unless) { if (has(w.unless)) this.offWalls.add(w); else this.offWalls.delete(w); }
  }

  addWalk(w: Walk): void {
    const p = w.pts;
    for (let i = 2; i < p.length; i += 2) {
      if (!(p[i]! > p[i - 2]!)) throw new Error(`walk ${w.name ?? w.id}: x must increase (${p[i - 2]} then ${p[i]})`);
    }
    this.walks.push(w);
    const b0 = Math.floor(p[0]! / BUCKET), b1 = Math.floor(p[p.length - 2]! / BUCKET);
    for (let b = b0; b <= b1; b++) {
      let a = this.wb.get(b);
      if (!a) this.wb.set(b, (a = []));
      a.push(w);
    }
  }

  addWall(w: Wall): void {
    this.walls.push(w);
    const b = Math.floor(w.x / BUCKET);
    let a = this.lb.get(b);
    if (!a) this.lb.set(b, (a = []));
    a.push(w);
  }

  /** Walks covering x. */
  walksAt(x: number): readonly Walk[] {
    return this.wb.get(Math.floor(x / BUCKET)) ?? [];
  }

  /** The nearest ground at or below y at x (any walk, one-ways included unless `solidOnly`). */
  groundBelow(x: number, y: number, solidOnly = false): { y: number; walk: Walk } | null {
    let best: { y: number; walk: Walk } | null = null;
    for (const w of this.walksAt(x)) {
      if (this.off.has(w.id) || (solidOnly && w.oneWay)) continue;
      const wy = walkY(w, x);
      if (wy === null || wy < y - EPS) continue;
      if (!best || wy < best.y) best = { y: wy, walk: w };
    }
    return best;
  }

  /** Same contract as the room collision: the ground's y at x below y (far below when none). */
  groundAt(x: number, y: number): number {
    return this.groundBelow(x, y)?.y ?? y + 100000;
  }

  /** Standing on something right now? */
  supported(b: Body): boolean {
    const g = this.groundBelow(b.x, b.y - 1);
    return !!g && g.y - b.y <= 1.5;
  }

  /** Standing on a one-way walk (S/Down + jump drops through it). */
  onOneWay(b: Body): boolean {
    return !!b.grounded && !!this.standingOn && this.standingOn.oneWay;
  }

  /** Holding down: walk past the foot of a stair instead of up it (set by the game each tick). */
  holdDown = false;
  /**
   * The stair she last walked down off its foot, and where: on a switchback landing, turning
   * back the way the stair came does not climb it again (she walks on, down the next flight),
   * until she has gone a little way off.
   */
  private cameDown: { w: Walk; x: number } | null = null;

  /** At the foot of a stair, moving toward its rise? */
  private atStairFoot(w: Walk, x: number, dir: number): boolean {
    if (this.holdDown) return false;
    const p = w.pts;
    const n = p.length;
    // the foot is the lower end; rising toward the other end
    const leftLow = p[1]! > p[n - 1]!;
    const footX = leftLow ? p[0]! : p[n - 2]!;
    const towardRise = leftLow ? dir > 0 : dir < 0;
    return towardRise && Math.abs(x - footX) < 0.35 * H;
  }

  /** Would a body with feet at y, at x, overlap solid mass or a wall? */
  private massBlocks(x: number, top: number, bottom: number): boolean {
    for (const w of this.walksAt(x)) {
      if (w.oneWay || this.off.has(w.id)) continue;
      const wy = walkY(w, x);
      if (wy === null) continue;
      if (wy < bottom - EPS && wy + w.depth > top + EPS) return true;
    }
    return false;
  }

  /** The first wall between x0 and x1 (moving in direction dir) overlapping [top, bottom). */
  private wallBetween(x0: number, x1: number, top: number, bottom: number, dir: number): Wall | null {
    const a = Math.min(x0, x1), c = Math.max(x0, x1);
    let best: Wall | null = null;
    for (let bk = Math.floor(a / BUCKET); bk <= Math.floor(c / BUCKET); bk++) {
      for (const w of this.lb.get(bk) ?? []) {
        if (w.x < a - EPS || w.x > c + EPS) continue;
        if (w.y1 <= top + EPS || w.y0 >= bottom - EPS) continue;
        if (this.offWalls.has(w)) continue;
        if (w.from === "left" && dir < 0) continue;
        if (w.from === "right" && dir > 0) continue;
        if (!best || (dir > 0 ? w.x < best.x : w.x > best.x)) best = w;
      }
    }
    return best;
  }

  move(b: Body, dx: number, dy: number): { landed: boolean } {
    const half = b.w / 2;
    const wasGrounded = b.grounded;
    let walk: Walk | null = wasGrounded ? this.standingOn : null;

    // --- horizontal, following the ground's slope while grounded
    if (dx !== 0) {
      const dir = Math.sign(dx);
      let nx = b.x + dx;
      const lead = dir * half;
      const wall = this.wallBetween(b.x + lead, nx + lead, b.y - b.h, b.y, dir);
      if (wall) {
        nx = wall.x - lead - dir * 0.01;
        if ((dir > 0 && nx < b.x) || (dir < 0 && nx > b.x)) nx = b.x;
        b.vx = 0;
      }
      if (wasGrounded) {
        const rise = Math.max(this.stepUp, PHYSICS.maxSlope * Math.abs(nx - b.x));
        let best: Walk | null = null, by = 0;
        let stay: Walk | null = null, sy = 0, foot: Walk | null = null, fy = 0;
        for (const w of this.walksAt(nx)) {
          if (this.off.has(w.id)) continue;
          if (w.oneWay && b.dropThrough > 0) continue;
          const wy = walkY(w, nx);
          if (wy === null) continue;
          if (wy < b.y - rise - EPS || wy > b.y + this.stepDown + EPS) continue;
          // one-way ground is only stepped onto from at or above it
          if (w.oneWay && wy < b.y - this.stepUp - EPS) continue;
          if (w.stair && w !== walk && wy < b.y - EPS) {
            // a stair is walked onto from its foot, heading up it (unless she holds down to
            // pass under it); from anywhere else under it she walks on underneath. The one she
            // has just come down is plain ground for a moment (other ground there wins).
            const justDown = this.cameDown?.w === w && Math.abs(nx - this.cameDown.x) < 1.5 * H;
            if (!justDown) {
              if (this.atStairFoot(w, nx, dir)) { foot = w; fy = wy; }
              continue;
            }
          }
          if (walk && w === walk) { stay = w; sy = wy; }
          if (!best || wy < by) { best = w; by = wy; }
        }
        // the foot of a stair wins, then staying on the same ground, then the highest
        if (foot) { best = foot; by = fy; }
        else if (stay) { best = stay; by = sy; }
        if (best) {
          // stepping onto best: the body must fit (no solid mass above the new feet)
          if (this.massBlocks(nx, by - b.h, by)) {
            nx = b.x;
            b.vx = 0;
          } else {
            // walking off the low end of a stair onto other ground: remember it
            if (walk && walk.stair && best !== walk && by >= (walkY(walk, b.x) ?? by) - EPS) this.cameDown = { w: walk, x: nx };
            b.y = by;
            walk = best;
          }
        } else if (this.massBlocks(nx, b.y - b.h, b.y)) {
          nx = b.x;
          b.vx = 0;
        } else {
          // walked off an edge
          walk = null;
        }
      } else if (this.massBlocks(nx, b.y - b.h, b.y)) {
        // airborne into a cliff face or a road's side
        nx = b.x;
        b.vx = 0;
      }
      b.x = Math.min(Math.max(nx, this.minX + half), this.maxX - half);
    }

    // --- vertical
    const prevY = b.y;
    let ny = b.y + dy;
    let landed = false;
    let on: Walk | null = null;
    b.grounded = false;
    if (dy >= 0) {
      let best = Infinity;
      for (const w of this.walksAt(b.x)) {
        if (this.off.has(w.id)) continue;
        if (w.oneWay && b.dropThrough > 0) continue;
        const wy = walkY(w, b.x);
        if (wy === null) continue;
        // crossed this tick (or already standing on it)
        if (prevY <= wy + 0.5 && ny >= wy - EPS && wy < best) {
          best = wy;
          on = w;
        }
      }
      if (best < Infinity) {
        ny = best;
        landed = true;
      } else if (wasGrounded && walk) {
        // stay glued to the walk going down a slope
        const wy = walkY(walk, b.x);
        if (wy !== null && wy - prevY <= this.stepDown) {
          ny = wy;
          landed = true;
          on = walk;
        }
      }
    } else {
      // rising: the head stops at the underside of solid mass
      const top0 = prevY - b.h, top1 = ny - b.h;
      for (const w of this.walksAt(b.x)) {
        if (w.oneWay || this.off.has(w.id) || !Number.isFinite(w.depth)) continue;
        const wy = walkY(w, b.x);
        if (wy === null) continue;
        const bottom = wy + w.depth;
        if (top0 >= bottom - EPS && top1 < bottom) {
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

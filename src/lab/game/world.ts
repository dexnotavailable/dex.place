// The blank map: a floor, a few one-way ledges at different heights, a quiet
// gradient sky and one faint distant layer. Collision is simple AABB.

import { pack } from "../art/atlas-builder.ts";
import { farLayer, floor, ledge } from "../art/environment.ts";
import type { Renderer, SpriteSheet } from "../engine/renderer.ts";

export interface MapData {
  width: number;
  spawn: [number, number];
  floorDepth: number;
  platforms: { x: number; y: number; w: number; h: number; turret?: boolean }[];
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  oneWay: boolean;
  turret: boolean;
  rect: [number, number, number, number];
}

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

export class World {
  readonly width: number;
  readonly spawn: [number, number];
  readonly platforms: Platform[] = [];
  private sheet: SpriteSheet;
  private floorDepth: number;
  private far: { sheet: SpriteSheet; w: number; h: number };

  constructor(r: Renderer, data: MapData) {
    this.width = data.width;
    this.spawn = data.spawn;
    this.floorDepth = data.floorDepth;
    const images = data.platforms.map((p, i) => {
      const t = ledge(p.w, p.h, 17 + i * 31);
      return { key: `p${i}`, w: t.w, h: t.h, albedo: t.albedo, normal: t.normal };
    });
    // the floor texture is one long slab in segments (atlas width limit), seeded per segment
    const seg = 1024;
    for (let x = 0; x < data.width; x += seg) {
      const t = floor(Math.min(seg, data.width - x), data.floorDepth, 1000 + x);
      images.push({ key: `f${x}`, w: t.w, h: t.h, albedo: t.albedo, normal: t.normal });
    }
    const atlas = pack(images, 2048);
    this.sheet = { albedo: r.texture(atlas.albedo), normal: r.texture(atlas.normal), keyInfluence: 0.3 };
    data.platforms.forEach((p, i) => {
      this.platforms.push({ ...p, oneWay: true, turret: !!p.turret, rect: atlas.rects.get(`p${i}`)! });
    });
    this.floorSegs = [];
    for (let x = 0; x < data.width; x += seg) this.floorSegs.push({ x, rect: atlas.rects.get(`f${x}`)! });
    const fl = farLayer(1500, 420);
    this.far = {
      sheet: { albedo: r.texture({ w: fl.w, h: fl.h, data: fl.albedo }), normal: r.flatNormal, keyInfluence: 0 },
      w: fl.w,
      h: fl.h,
    };
  }

  private floorSegs: { x: number; rect: [number, number, number, number] }[];

  bounds(): [number, number, number, number] {
    return [0, -520, this.width, this.floorDepth - 40];
  }

  /** Top of the first surface at or below (x, y). */
  groundAt(x: number, y: number): number {
    let best = 0;
    for (const p of this.platforms) {
      if (x >= p.x && x <= p.x + p.w && p.y >= y && p.y < best) best = p.y;
    }
    return best;
  }

  /** Moves a body with collision: solid floor and walls, one-way ledges. */
  move(b: Body, dx: number, dy: number): { landed: boolean } {
    const half = b.w / 2;
    b.x = Math.min(Math.max(b.x + dx, 12 + half), this.width - 12 - half);
    const prevY = b.y;
    let ny = b.y + dy;
    let landed = false;
    const wasGrounded = b.grounded;
    b.grounded = false;
    if (dy >= 0) {
      if (ny >= 0) {
        ny = 0;
        landed = true;
      }
      if (b.dropThrough <= 0) {
        for (const p of this.platforms) {
          if (b.x + half <= p.x || b.x - half >= p.x + p.w) continue;
          if (prevY <= p.y + 0.01 && ny >= p.y) {
            ny = p.y;
            landed = true;
          }
        }
      }
    }
    b.y = ny;
    if (landed) {
      b.grounded = true;
      if (b.vy > 0) b.vy = 0;
    }
    if (b.dropThrough > 0) b.dropThrough--;
    return { landed: landed && !wasGrounded };
  }

  /** Is there ground right under the body (for coyote checks after moving). */
  supported(b: Body): boolean {
    if (b.y >= -0.01) return true;
    const half = b.w / 2;
    return this.platforms.some((p) => Math.abs(b.y - p.y) < 0.5 && b.x + half > p.x && b.x - half < p.x + p.w);
  }

  drawBackground(r: Renderer, camX: number, camY: number): void {
    // far layer drifts slowly (parallax 0.12)
    const px = Math.round(-camX * 0.12);
    const py = Math.round(-camY * 0.1);
    const baseY = r.ih - this.far.h + 40 + py;
    for (let x = px % this.far.w - this.far.w; x < r.iw; x += this.far.w) {
      r.sprite({ sheet: this.far.sheet, sx: 0, sy: 0, sw: this.far.w, sh: this.far.h, x: x - 200, y: baseY, lit: 0, screen: true });
    }
  }

  drawPlatforms(r: Renderer): void {
    for (const s of this.floorSegs) {
      const [sx, sy, sw, sh] = s.rect;
      r.sprite({ sheet: this.sheet, sx, sy, sw, sh, x: s.x, y: 0 });
    }
    for (const p of this.platforms) {
      const [sx, sy, sw, sh] = p.rect;
      r.sprite({ sheet: this.sheet, sx, sy, sw, sh, x: p.x, y: p.y });
    }
  }
}

// Ambient life in the player plane (the backdrops carry their own birds,
// motes and distant lights): dust drifting past, moths around lit props, rain
// splashing on the ground in front of you, drips after the storm. Hooks, not
// systems: each is a handful of whole-pixel rects, cheap, and each can be
// swapped for pixel-matter particles when that engine lands.

import type { PropLight } from "./props-api.ts";
import type { WorldRenderer } from "./render/renderer.ts";
import type { Collision } from "./room/collision.ts";
import type { AmbientSpec } from "./room/types.ts";
import { SCALE } from "./config.ts";

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
}
interface Moth {
  cx: number;
  cy: number;
  a: number;
  r: number;
  sp: number;
  x: number;
  y: number;
}
interface Splash {
  x: number;
  y: number;
  age: number;
}

export class Ambient {
  private motes: Mote[] = [];
  private moths: Moth[] = [];
  private splashes: Splash[] = [];
  private t = 0;
  spec: AmbientSpec = {};

  reset(spec: AmbientSpec | undefined, w: number, h: number): void {
    this.spec = spec ?? {};
    this.motes = [];
    this.moths = [];
    this.splashes = [];
    const n = Math.round((this.spec.dust ?? 0) * (w / SCALE.viewW));
    for (let i = 0; i < n; i++) this.motes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.2, vy: -0.05 - Math.random() * 0.1, ph: Math.random() * 99 });
  }

  update(lights: PropLight[], wind: number, rain: number, outdoors: boolean, camX: number, camY: number, col: Collision, reduced: boolean): void {
    this.t++;
    const w = col.width;
    const h = col.height;
    for (const m of this.motes) {
      m.x += m.vx + wind * 0.35 + Math.sin(this.t * 0.01 + m.ph) * 0.08;
      m.y += m.vy + Math.cos(this.t * 0.013 + m.ph) * 0.05;
      if (m.x < 0) m.x += w;
      if (m.x > w) m.x -= w;
      if (m.y < 0) m.y += h;
      if (m.y > h) m.y -= h;
    }
    // moths gather around warm lights that are on
    if (this.spec.moths !== false) {
      const warm = lights.filter((l) => l.colour[0] > 0.8 && l.colour[2] < 0.6 && l.intensity > 0.3).slice(0, 8);
      for (const l of warm) {
        const have = this.moths.filter((m) => Math.abs(m.cx - l.x) < 4 && Math.abs(m.cy - l.y) < 4);
        if (have.length < 2 && Math.random() < 0.01) this.moths.push({ cx: l.x, cy: l.y, a: Math.random() * 6, r: 6 + Math.random() * 10, sp: 0.05 + Math.random() * 0.06, x: l.x, y: l.y });
      }
      this.moths = this.moths.filter((m) => warm.some((l) => Math.abs(m.cx - l.x) < 4 && Math.abs(m.cy - l.y) < 4));
      for (const m of this.moths) {
        m.a += m.sp * (reduced ? 0.4 : 1) * (Math.random() < 0.1 ? -2 : 1);
        m.x = m.cx + Math.cos(m.a) * m.r + Math.sin(this.t * 0.3 + m.r) * 2;
        m.y = m.cy + Math.sin(m.a * 1.3) * m.r * 0.6;
      }
    }
    // rain splashes on the ground in view
    if (outdoors && rain > 0.08) {
      const n = Math.round(rain * 4 * (reduced ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        const x = camX + Math.random() * SCALE.viewW;
        const y = col.groundAt(x, camY + 10);
        if (y < camY + SCALE.viewH && y > camY) this.splashes.push({ x: Math.round(x), y, age: 0 });
      }
    }
    for (const s of this.splashes) s.age++;
    this.splashes = this.splashes.filter((s) => s.age < 6);
    void w;
  }

  draw(r: WorldRenderer, flash: number): void {
    for (const m of this.motes) {
      const on = Math.sin(this.t * 0.02 + m.ph) > -0.3;
      if (on) r.rect(Math.round(m.x), Math.round(m.y), 1, 1, [0.7 + flash * 0.3, 0.66 + flash * 0.3, 0.58 + flash * 0.3], 0, 0.5);
    }
    for (const m of this.moths) r.rect(Math.round(m.x), Math.round(m.y), (this.t >> 2) % 2 ? 2 : 1, 1, [0.82, 0.76, 0.62], 1, 0.9);
    for (const s of this.splashes) {
      const c: [number, number, number] = [0.62 + flash * 0.3, 0.68 + flash * 0.3, 0.76 + flash * 0.2];
      if (s.age < 3) r.rect(s.x, s.y - 1 - (s.age >> 1), 1, 1, c, 1, 0.8);
      else {
        r.rect(s.x - 2, s.y - 1, 1, 1, c, 1, 0.6);
        r.rect(s.x + 2, s.y - 1, 1, 1, c, 1, 0.6);
      }
    }
  }
}

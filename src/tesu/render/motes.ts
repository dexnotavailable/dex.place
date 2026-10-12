// Drifting particles at three depths (A.1): motes of mist and pollen in the light, petals
// where blossom grows. Each depth wraps in a box around the camera in its own plane
// coordinates, so they parallax with their plane and never run out.

import type { WorldRenderer } from "../../world/render/renderer.ts";
import { planeXf, type CamState } from "./view.ts";

export interface MoteKind {
  /** Colours to pick from (0..1 rgb). */
  colours: [number, number, number][];
  /** Particles per depth. */
  count: number;
  /** Drift in plane px per second (x, y) and a sway. */
  drift: [number, number];
  sway: number;
  /** Size in px at play zoom: 1 for motes, 2 for petals. */
  size: number;
}

interface Mote {
  x: number;
  y: number;
  ph: number;
  c: number;
}

const BOX_W = 2400, BOX_H = 1300;

export class Motes {
  private layers: { rate: number; motes: Mote[] }[];
  kind: MoteKind;
  constructor(kind: MoteKind, rates: number[] = [0.6, 1, 1.3]) {
    this.kind = kind;
    let seed = 1234567;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed / 4294967296;
    };
    this.layers = rates.map((rate) => ({
      rate,
      motes: Array.from({ length: kind.count }, () => ({ x: rnd() * BOX_W, y: rnd() * BOX_H, ph: rnd() * 6.28, c: Math.floor(rnd() * 8) })),
    }));
  }

  update(dt: number): void {
    const k = this.kind;
    for (const l of this.layers) {
      for (const m of l.motes) {
        m.ph += dt * (0.6 + (m.c % 3) * 0.2);
        m.x += (k.drift[0] + Math.sin(m.ph) * k.sway) * dt;
        m.y += (k.drift[1] + Math.cos(m.ph * 0.7) * k.sway * 0.5) * dt;
      }
    }
  }

  /** Draws the depth with this rate (screen-space quads through the sprite renderer's rect path). */
  draw(r: WorldRenderer, cam: CamState, rate: number): void {
    const l = this.layers.find((q) => q.rate === rate);
    if (!l) return;
    const xf = planeXf(cam, rate);
    // the box is centred on the camera in plane px
    const cx = cam.cx * rate, cy = cam.cy * rate;
    const g = xf.g;
    const size = Math.max(1, Math.round(this.kind.size * Math.min(1.5, g)));
    for (const m of l.motes) {
      const px = cx + ((((m.x - cx) % BOX_W) + BOX_W * 1.5) % BOX_W) - BOX_W / 2;
      const py = cy + ((((m.y - cy) % BOX_H) + BOX_H * 1.5) % BOX_H) - BOX_H / 2;
      const fx = Math.round(px * g + xf.offX), fy = Math.round(py * g + xf.offY);
      if (fx < -4 || fy < -4 || fx > cam.W + 4 || fy > cam.H + 4) continue;
      const col = this.kind.colours[m.c % this.kind.colours.length]!;
      const tw = 0.55 + 0.45 * Math.sin(m.ph * 1.7);
      r.rect(fx, fy, size, size, col, 1, tw, true);
    }
  }
}

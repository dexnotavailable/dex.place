// Pier's End's own near layers (A0, region lane a): a bed of reeds standing in the
// open water past the pier's end posts (just behind the player plane, rooted on
// the water's own row for that depth, mirrored in the lake), and dark reed tips
// in the bottom corners in front of everything, so the overlook has a frame. The
// old reed props rooted in the pier's planks or inside the wall at its end.

import { Pix } from "../../../scenes/engine/pix.ts";
import { hashInt } from "../../../scenes/engine/noise.ts";
import type { BuildCtx, LayerDef } from "../../../scenes/engine/types.ts";
import type { Geo } from "../../../scenes/scenes/arrival.ts";
import { grassTuft } from "../../../scenes/scenes/arrival/near.ts";

const H = (a: number, b: number, s: number): number => hashInt(Math.floor(a), Math.floor(b), s);

/** One reed: a stem that leans, a seed head on most. */
function reed(pix: Pix, x: number, base: number, h: number, lean: number, row: number, head: number, seed: number, dark: number): void {
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const xx = x + Math.round(lean * t * t * h * 0.25);
    pix.set(xx, base - 1 - j, (j === h - 1 ? 0.8 : 0.36 + t * 0.3) * dark, row);
  }
  if (H(x, 1, seed) < 0.7) {
    const hx = x + Math.round(lean * h * 0.25);
    for (let k = 0; k < 5; k++) pix.set(hx + (k > 2 ? 1 : 0), base - h - 1 - k, (k === 0 ? 0.3 : 0.55) * dark, head);
  }
}

export function pierShore(o: { span: number }): (ctx: BuildCtx, g: Geo, row: (n: string) => number) => LayerDef[] {
  return (ctx, g, row) => {
    const { W, H: VH } = ctx;
    const out: LayerDef[] = [];
    const reedRow = row("leaf"), head = row("earth"), near = row("near");
    // the bed past the pier's end, on the player plane (layer x = room x - span / 2), rooted on the waterline
    {
      const d = 1;
      const base = g.wl + 1;
      const pix = new Pix(260, VH + 4);
      const x0 = -Math.round(o.span / 2) - 70;
      for (let k = 0; k < 34; k++) {
        const x = 8 + Math.round(H(k, 1, 91) * 150);
        const h = 26 + Math.round(H(k, 2, 91) * 40) - Math.round(Math.abs(x - 80) * 0.18);
        reed(pix, x, base, Math.max(10, h), (H(k, 3, 91) - 0.6) * 2, reedRow, head, k, 1);
      }
      // a ring of still water against the stems
      for (let x = 4; x < 170; x++) if (H(x, 4, 91) < 0.4) pix.set(x, base, 0.2, reedRow);
      out.push({ kind: "pix", name: "pier-reeds", depth: d, pix, x: x0, y: 0, reflect: base, reflectFade: 26, dither: 0 });
    }
    // dark tips in the bottom corners, in front of everything (they move faster than the camera)
    {
      const d = 0.85;
      const w = ctx.panWidth(d) + 8;
      const lx = -Math.ceil((w - W) / 2);
      const pix = new Pix(w, VH + 4);
      const par = 1 / d;
      // where each end of the room sits in this layer when the camera stands at that end
      const left = Math.round(-(o.span / 2) * par) - lx;
      const right = Math.round(o.span * par - (o.span / 2) * par) + W - lx;
      for (let k = 0; k < 22; k++) {
        const x = left + Math.round(k * 7 + H(k, 1, 92) * 5);
        grassTuft(pix, x, VH + 3, { row: near, h: 70 + H(k, 2, 92) * 60 * (1 - k / 26), n: 3, seed: 600 + k, lean: 0.35, spread: 2 });
      }
      for (let k = 0; k < 16; k++) {
        const x = right - Math.round(k * 7 + H(k, 3, 92) * 5);
        grassTuft(pix, x, VH + 3, { row: near, h: 50 + H(k, 4, 92) * 50 * (1 - k / 20), n: 3, seed: 700 + k, lean: -0.35, spread: 2 });
      }
      // only the tips catch the light
      for (let y = 1; y < pix.h; y++) for (let x = 0; x < pix.w; x++) if (pix.solid(x, y) && pix.solid(x, y - 1)) pix.setShade(x, y, 0.08);
      out.push({ kind: "pix", name: "pier-fore", depth: d, pix, x: lx, y: 0, dither: 0 });
    }
    return out;
  };
}

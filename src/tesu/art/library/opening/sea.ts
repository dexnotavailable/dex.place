// A sea of mist seen from the side: the valley beyond the lake's east shore and the land past
// the palace are filled with it (the cloud sea of reference 1's valley). It stands in for land
// at a plane's depth wherever the opening shows no ground (the depth stack never shows a gap).
//
// Above its surface line it is the same mist bank the karst stand in (karst.ts): a low core
// and billows above it, lumpy at every scale, climbing the feet of the landforms that stand in
// it and sagging between them, torn wisps floating free; its west end sinks and frays over a
// long run, so it never ends in a plate. Below the line, where the frames look down on it beyond
// the shore, it is a floor of cloud seen from above: soft billows lit on their tops and shaded
// where the next one rises in front, growing toward the viewer, never stripes.
//
// Anchor: the left (west) end of the sea's surface line. Sizes in level-1 px of its plane.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm, vnoise, vnoise1 } from "../../raster.ts";
import { mistBank, type MistFoot } from "./karst.ts";

export interface SeaP {
  w: number;
  /** Depth of the body below the surface line, px. */
  depth: number;
  /** Height of the swells, px (default 14). */
  swell?: number;
  /** Fade at the east end over this many px (default 120). */
  ends?: number;
  /** The west end sinks and frays over this many px (default ends). */
  west?: number;
  /** Landforms standing in it, [x, half width, height] in its px: the mist climbs their feet. */
  rise?: [number, number, number][];
  /** Torn wisps above it, 0..1 (default 0.4). */
  torn?: number;
  /** Contrast of the billows of its floor seen from above, 0..1 (default 1). */
  rolls?: number;
  /**
   * Where its standing bank begins, px from its west end (default 0). West of it only the floor
   * below the line is painted: ground under the lake's surface (covered there by the water) that
   * other frames see from below, never a bank standing on the lake.
   */
  bankFrom?: number;
  /** The floor's own torn west end, px (default west; 0: the floor runs to the end, solid). */
  floorWest?: number;
  /**
   * The floor's top this many px is low mist lying on water beyond the lake's shore: the lake's
   * own pale tone, dithered down into the billows (default 0: billows from the line).
   */
  wetFloor?: number;
  /** Where the lake ends at this plane's waterline, px from its west end: east of it no water tone. */
  wetTo?: number;
}

/** The bank's height scale (its mist band), px. */
const bankH = (p: SeaP): number => (p.swell ?? 14) * 1.7;

function paintFloor(c: PaintCtx, p: SeaP): void {
  const b = c.buf, seed = c.seed;
  const sw = p.swell ?? 14;
  const west = p.floorWest ?? p.west ?? p.ends ?? 120;
  const C = P.cloud;
  const rolls = p.rolls ?? 1;
  const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(0))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.depth)));
  const from = p.bankFrom ?? 0;
  const wf = p.wetFloor ?? 0;
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    // (where no bank stands on it, its top keeps a few px under the line, so no edge of it shows
    // over the lake between the water slices)
    const open = ly < 3;
    // a perspective floor: billows grow toward the viewer (down the frame)
    const t = Math.log1p(ly / (sw * 2)) * 2.6;
    const size = sw * 2 * (1 + ly / (sw * 2));
    const cool = clamp(ly / Math.max(1, p.depth), 0, 1);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      if (open && lx < from) continue;
      // the torn west end: the floor thins out by dither toward it
      if (west > 0 && lx < west) {
        const k = clamp((lx + (vnoise(lx / (sw * 2.4), ly / (sw * 1.3), seed + 8) - 0.5) * west * 0.6) / west, 0, 1);
        if (k < 0.92 && bayer4(x, y) >= (k > 0.6 ? 0.75 : k > 0.4 ? 0.5 : k > 0.22 ? 0.25 : k > 0.1 ? 0.125 : 0)) continue;
      }
      const u = lx / (size * 2.6);
      const n0 = fbm(u, t, seed + 20, 3);
      // the billow a little further off: where this one stands higher, its top faces the sky
      const n1 = fbm(u, t - 0.16, seed + 20, 3);
      const lift = (n0 - n1) * 6;
      let v = 0.28 - lift * 0.5 + (0.5 - n0) * 0.5;
      v = 0.2 + (v - 0.2) * rolls + cool * 0.3;
      // (in the haze's own cool whites: only the brightest tops reach the sun's white)
      const i = 0.6 + clamp(v, 0, 1) * 2.8;
      const k = Math.floor(i);
      const col = C[Math.min(4, k + (bayer4(x, y) < i - k ? 1 : 0))]!;
      if (wf > 0 && ly < wf * 1.6) {
        // near the line: the lake's tone on the lake, its lower edge torn into the billows; past
        // the lake's end low mist on the shallows, a pale jade thinning out east into the billows
        const past = (lx - (p.wetTo ?? Infinity)) / (sw * 40) + (vnoise1(ly / (sw * 3), seed + 31) - 0.5) * 0.5;
        const w = ly / wf + (vnoise(lx / (sw * 3), ly / (sw * 1.2), seed + 30) - 0.5) * 0.7 + (0.5 - n0) * 0.6 + Math.max(0, past) * 0.8;
        if (past < 0) {
          if (w < 0.4) { b.set(x, y, bayer4(x, y) < 0.5 ? P.jade[2]! : P.jade[3]!); continue; }
          if (w < 0.7 || (w < 1 && bayer4(x, y) < (1 - w) / 0.3 * 0.5)) { b.set(x, y, bayer4(x + 1, y) < 0.5 ? P.jade[1]! : P.jade[2]!); continue; }
        } else if (w < 0.6 || (w < 1 && bayer4(x, y) < (1 - w) / 0.4 * 0.5)) { b.set(x, y, bayer4(x + 1, y) < 0.5 ? P.jade[0]! : C[2]!); continue; }
      }
      b.set(x, y, col);
    }
  }
}

export const sea = definePainter<SeaP>("op.sea", {
  bounds(p) {
    const west = p.west ?? p.ends ?? 120;
    return [Math.min(0, (p.bankFrom ?? 0) - west * 0.3) - 2, -bankH(p) * 4.6 - 4, p.w + 2, p.depth + 2];
  },
  paint(c, p) {
    paintFloor(c, p);
    const west = p.west ?? p.ends ?? 120;
    const feet: MistFoot[] = (p.rise ?? []).map(([x, hw, h]) => ({ x, hw, h }));
    // the standing bank: its west end sinks over `west` px, its east end over `ends`
    const from = p.bankFrom ?? 0;
    mistBank(c, from - west * 0.3, p.w, 0, bankH(p), c.seed + 3, 0, feet, { taper: Math.max(west, p.ends ?? 120), torn: p.torn ?? 0.4, water: p.wetFloor ? bankH(p) * 0.5 : 0, wetX: [-1e6, (p.wetTo ?? 1e6) + (p.wetFloor ?? 0) * 3] });
  },
});

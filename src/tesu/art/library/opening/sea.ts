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
import { bayer4, clamp, fbm, hash1, vnoise, vnoise1 } from "../../raster.ts";
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
  /** Where the lake begins at this plane's waterline (a sea west of the lake's west end), px. */
  wetFrom?: number;
  /**
   * How far past the lake's end the lake runs on under the mist, px (default 340): over that run
   * the floor's top shows the water torn by ever more mist, so the lake's shore never shows.
   */
  veilTo?: number;
  /** A standing bank above the line (default true; false: only the floor below it). */
  bank?: boolean;
}

/** The bank's height scale (its mist band), px. */
const bankH = (p: SeaP): number => (p.swell ?? 14) * 1.7;

function paintFloor(c: PaintCtx, p: SeaP): void {
  const b = c.buf, seed = c.seed;
  const sw = p.swell ?? 14;
  const west = p.floorWest ?? p.west ?? p.ends ?? 120;
  const C = P.cloud, kc = Math.max(1, Math.round(c.d));
  // (one cell of dither, two screen px at the catch's 2x, only where two steps meet)
  const bd = (x: number, y: number): number => bayer4(Math.floor(x / kc), Math.floor(y / kc));
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
        // (a torn edge, never a dissolve screen)
        const k = clamp((lx + (vnoise(lx / (sw * 2.4), ly / (sw * 1.3), seed + 8) - 0.5) * west * 0.9 + (vnoise(lx / (sw * 0.6), ly / (sw * 0.4), seed + 9) - 0.5) * west * 0.25) / west, 0, 1);
        if (k < 0.42 || (k < 0.48 && bd(x, y) >= 0.5)) continue;
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
      const fr = i - k;
      const col = C[Math.min(4, k + (fr > 0.86 || (fr > 0.72 && bd(x, y) < 0.5) ? 1 : 0))]!;
      if (wf > 0 && ly < wf * (1.3 + 0.5 * vnoise1(lx / (sw * 6), seed + 32))) {
        // the floor's top near the lake: the lake running on under low mist. Its water in the
        // lake's own tone, deepening toward the viewer like the lake beside it, so the shore
        // the water's edge draws never shows; over it torn lobes of mist lying on the water, ever
        // more of them the further past the lake's end, until they close into the sea of mist
        const past = Math.max(0, lx - (p.wetTo ?? Infinity), (p.wetFrom ?? -Infinity) - lx);
        const dens = clamp(past / (p.veilTo ?? 340), 0, 1);
        // (no lobe is cut by the line: right under it they thin away, so none of them rules it)
        const at = (yy: number): number => dens * 1.35 - 0.3 + (fbm(lx / (sw * 5), yy / (sw * 0.9), seed + 40, 3) - 0.5) * 1.6 + (vnoise(lx / (sw * 2.2), yy / (sw * 0.5), seed + 41) - 0.5) * 0.35 - yy / (wf * 6) - 1.2 * (1 - dens * dens) * Math.max(0, 1 - yy / (sw * (0.6 + 0.8 * vnoise1(lx / (sw * 3), seed + 43))));
        const m = at(ly);
        if (m > 0.95) {
          // a lobe: lit along its top, its underside in its own shadow
          b.set(x, y, at(ly - 1.6 / c.d) <= 0.95 ? C[0]! : at(ly + 1.6 / c.d) <= 0.95 ? C[3]! : C[1]!);
          continue;
        }
        if (m > 0.84 && bd(x, y) < 0.5) { b.set(x, y, C[2]!); continue; }
        // the water: the lake's tones (each a dithered pair, so on screen it meets the lake beside it)
        const tw = ly / (wf * 1.1) + (vnoise(lx / (sw * 5), ly / (sw * 1.5), seed + 42) - 0.5) * 0.3 + (vnoise(lx / (sw * 1.6), ly / (sw * 0.6), seed + 44) - 0.5) * 0.3;
        // (the lake's own tones in ripple runs along each row, as the lake beside it breaks
        // into horizontal ripples: never a checker)
        const pair = tw < 0.25 ? [P.jade[2]!, P.range[1]!] : tw < 0.55 ? [P.jade[2]!, P.range[2]!] : [P.jade[3]!, P.range[3]!];
        const row = Math.floor(ly * 1.2);
        const rl = 5 + 12 * hash1(row, seed + 45);
        const run = Math.floor((lx + 37 * hash1(row, seed + 46)) / rl);
        b.set(x, y, pair[hash1(run, seed + 47 + row) < 0.5 ? 0 : 1]!);
        continue;
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
    if (p.bank === false) return;
    const west = p.west ?? p.ends ?? 120;
    const feet: MistFoot[] = (p.rise ?? []).map(([x, hw, h]) => ({ x, hw, h }));
    // the standing bank: its west end sinks over `west` px, its east end over `ends`
    const from = p.bankFrom ?? 0;
    // (over the lake, and over the stretch where the lake runs on under the mist, it floats as a
    // veil of haze; beyond, it stands on the sea's floor)
    const veilTo = p.veilTo ?? 340;
    mistBank(c, from - west * 0.3, p.w, 0, bankH(p), c.seed + 3, 0, feet, { taper: Math.max(west, p.ends ?? 120), torn: p.torn ?? 0.4, thin: p.wetFloor ? bankH(p) * 0.8 : 0, wetX: p.wetFloor ? [(p.wetFrom ?? -1e6) - veilTo * 1.2, (p.wetTo ?? 1e6) + veilTo * 1.2] : undefined });
  },
});

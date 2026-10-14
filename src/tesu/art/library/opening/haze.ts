// The far karst in the haze (P1), the sky and atmosphere lane's own (Kagami round 6; the critic's
// S3: the far plane's karst read as "skyscrapers in fog": straight sides, bevelled flat tops, grid
// lines). After reference 4's far karst: soft, tapering limestone towers and sugarloaf hills in
// clusters with wide gaps of mist between them, irregular summits with a tuft or two of trees
// standing proud, a ledge here and there breaking a flank, the sun's side a step lighter, the shade
// side a step darker, a few soft fissures; their lower thirds paling into the fog they stand in, so
// no base ever shows (the far fog banks, render/atmos.ts, lie over the feet). The back rows paler,
// smaller and plainer: ghosts, then nothing. Never a grid, never a flat top, never a ruled side.
//
// Painted at full value in the far range's blue-grey; the plane shader fades it toward the haze.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash1, rng, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

/** The ordered-dither threshold on cells of k art px (two screen px at the catch's 2x). */
const bay = (x: number, y: number, k: number): number => bayer4(Math.floor(x / k), Math.floor(y / k));

export interface FarKarstP {
  /** Band width, level-1 px; anchor at the left end of its base line (the lake line). */
  w: number;
  /** The tallest tower, px. */
  h: number;
  /** Where its clusters stand: [x0, x1] spans of the band, with an optional height scale each. */
  groups: ([number, number] | [number, number, number])[];
  /** Rows (1 to 3); the back rows paler, smaller and set a little higher. */
  rows?: number;
  /** How far the back rows are erased into the haze, 0..1 (default 0.6). */
  haze?: number;
  /** The share of a tower's height paling into the fog at its foot (default 0.38). */
  fog?: number;
}

/**
 * A tower or hill: its axis, base half width, height, lean, row, base, seed, and its lobes, the
 * masses it is the union of: [offset from the axis, base half width, height, the flank's power
 * (higher: sheerer sides, rounder top), how much it tapers]; the first carries the summit, the
 * others are its shoulders, so the skyline steps (never one smooth dome or a finger).
 */
interface Peak {
  cx: number;
  bw: number;
  ph: number;
  lean: number;
  row: number;
  by: number;
  lobes: [number, number, number, number, number][];
  s: number;
}

function rowsOf(p: FarKarstP): number {
  return Math.max(1, Math.min(3, Math.round(p.rows ?? 2)));
}

function peaksOf(p: FarKarstP, seed: number): Peak[] {
  return cached(`fk1|${seed}|${p.w}|${p.h}|${p.rows}|${p.groups.map((g) => g.join(",")).join(";")}`, () => {
    const r = rng(seed + 3);
    const out: Peak[] = [];
    const rows = rowsOf(p);
    for (let k = rows - 1; k >= 0; k--) {
      for (const g of p.groups) {
        const [a, b] = g;
        const gs = g[2] ?? 1;
        const span = b - a;
        // a cluster: one dominant tower, lesser ones of very different sizes packed round it,
        // never an even row (the back rows wider and lower, behind the front ones)
        const n = k === 0 ? 3 + Math.floor(span / 140 + r() * 2) : 2 + Math.floor(span / 200 + r() * 2);
        const lead = a + span * (0.3 + 0.4 * r());
        for (let i = 0; i < n; i++) {
          const first = i === 0 && k === 0;
          const cx = first ? lead : a + span * (0.05 + 0.9 * r());
          const near = 1 - Math.min(1, Math.abs(cx - lead) / (span * 0.6));
          const ph = p.h * gs * (first ? 0.92 + 0.08 * r() : (0.3 + 0.45 * r()) * (0.6 + 0.4 * near)) * (k === 0 ? 1 : 0.75 - 0.12 * k + 0.2 * r());
          // (towers: narrow and sheer; sugarloaf hills: broader and rounder; a few low humps)
          const kind = r();
          // (towers: tall and steep, tapering, a dome of trees on top; sugarloaves: broader)
          const bw = ph * (kind < 0.55 ? 0.17 + 0.08 * r() : kind < 0.88 ? 0.26 + 0.1 * r() : 0.36 + 0.12 * r());
          const lobes: [number, number, number, number, number][] = [[0, bw, ph, 2.2 + 1.6 * r(), 0.32 + 0.18 * r()]];
          // one or two shoulders, lower, on either side or both
          for (let j = 0, ns = 1 + Math.floor(r() * 1.8); j < ns; j++) {
            const side = j === 0 ? (r() < 0.55 ? 1 : -1) : -lobes[1]![0] / Math.abs(lobes[1]![0] || 1);
            lobes.push([side * bw * (0.45 + 0.45 * r()), bw * (0.5 + 0.35 * r()), ph * (0.4 + 0.35 * r()), 1.8 + 1.4 * r(), 0.5 + 0.3 * r()]);
          }
          out.push({ cx, bw, ph, lean: (r() - 0.5) * 0.12, row: k, by: -k * p.h * 0.1, lobes, s: Math.floor(r() * 9973) });
        }
      }
    }
    // (back rows first, then each row's smaller ones behind its bigger ones)
    return out.sort((u, v) => v.row - u.row || u.ph - v.ph);
  });
}

/** A peak's flanks at a height a above its base: [left, right] x, or null above its top. */
function flanks(f: Peak, a: number, seed: number): [number, number] | null {
  if (a < 0 || a >= f.ph) return null;
  let L = Infinity, Rr = -Infinity;
  f.lobes.forEach(([dx, bw, ph, pw, tq], i) => {
    const v = a / ph;
    if (v >= 1) return;
    // each lobe: steep tapering sides (a swell, a waist) rounding over into a cap of trees, its
    // outline knuckled by their crowns
    let hw = bw * Math.pow(1 - Math.pow(v, pw), tq) * (1 + 0.08 * Math.sin(v * 5.2 + f.s + i));
    if (v > 0.7) hw += bw * 0.1 * (vnoise1(a / 2.2 + f.s + i * 31, seed + 5) - 0.35);
    // (each flank wanders on its own at two scales: never ruled)
    const l = hw * (1 + 0.14 * (vnoise1(a / 13 + f.s + i * 7, seed + 1) - 0.5) + 0.07 * (vnoise1(a / 4 + f.s + i * 7, seed + 2) - 0.5));
    const rr = hw * (1 + 0.14 * (vnoise1(a / 13 + f.s + 40 + i * 7, seed + 1) - 0.5) + 0.07 * (vnoise1(a / 4 + f.s + 40 + i * 7, seed + 2) - 0.5));
    if (l < 0.6 || rr < 0.6) return;
    const c = f.cx + dx + f.lean * a;
    L = Math.min(L, c - l);
    Rr = Math.max(Rr, c + rr);
  });
  return L < Rr ? [L, Rr] : null;
}

/** A peak's skyline: the height of its top over each level-1 column from x0 (built once). */
function skylineOf(f: Peak, seed: number): { x0: number; top: Float32Array } {
  return cached(`fk1s|${seed}|${f.s}|${f.cx}|${f.ph}`, () => {
    const span = Math.ceil(f.bw * 2.2 + Math.abs(f.lean) * f.ph + 4);
    const x0 = Math.floor(f.cx - span);
    const top = new Float32Array(span * 2 + 1).fill(-1);
    for (let a = f.ph; a >= 0; a -= 0.5) {
      const fl = flanks(f, a, seed);
      if (!fl) continue;
      for (let i = Math.max(0, Math.ceil(fl[0] - x0)); i <= Math.min(top.length - 1, Math.floor(fl[1] - x0)); i++) if (top[i]! < 0) top[i] = a;
    }
    return { x0, top };
  });
}

function paintFar(c: PaintCtx, p: FarKarstP): void {
  const b = c.buf, d = c.d, kc = Math.max(1, Math.round(d));
  const R = P.range;
  const peaks = peaksOf(p, c.seed);
  const rows = rowsOf(p);
  const fogK = p.fog ?? 0.38;
  const haze = p.haze ?? 0.6;
  for (const f of peaks) {
    // the back rows erased into the haze: a step or two paler, plainer
    const ghost = f.row > 0 ? haze * (f.row / Math.max(1, rows - 1)) : 0;
    const X0 = Math.max(b.ox, Math.floor(c.X(f.cx - f.bw * 1.6 - Math.abs(f.lean) * f.ph))), X1 = Math.min(b.x1, Math.ceil(c.X(f.cx + f.bw * 1.6 + Math.abs(f.lean) * f.ph)));
    const Y0 = Math.max(b.oy, Math.floor(c.Y(f.by - f.ph - 2))), Y1 = Math.min(b.y1, Math.ceil(c.Y(f.by + 1)));
    // its fissures: a few soft dark seams following the flank, broken, mostly on the lit face
    const nF = f.row === 0 ? 1 + Math.floor(hash1(f.s, c.seed + 9) * 3) : 0;
    const sky = skylineOf(f, c.seed);
    for (let y = Y0; y < Y1; y++) {
      const a = f.by - c.ly(y + 0.5);
      const fl = flanks(f, a, c.seed);
      if (!fl) continue;
      const [xl, xr] = fl;
      const v = a / f.ph;
      for (let x = Math.max(X0, Math.floor(c.X(xl))); x < Math.min(X1, Math.ceil(c.X(xr))); x++) {
        const lx = c.lx(x + 0.5);
        if (lx < xl || lx >= xr) continue;
        const u = (lx - xl) / Math.max(1, xr - xl);
        // the light: the sun's (left) face, the front turning, the shade side; the summit's
        // shoulders catch the light from above
        // (a round form: the sun's side lit, turning through the front into the shade; the cliff
        // streaked by the rain in long vertical runs, never a grid)
        let t = 0.46 + 0.36 * Math.pow(u, 1.3) + 0.08 * (vnoise1(u * 9 + f.s, c.seed + 11) - 0.5) + 0.05 * (vnoise1(lx / 1.7 + f.s, c.seed + 12) - 0.5);
        // the trees: a cap over the summit and patches on the flanks and ledges, a step darker
        const tc = sky.top[Math.min(sky.top.length - 1, Math.max(0, Math.round(lx - sky.x0)))]!;
        const below = tc - a;
        // (round 6, the integration: with the sky lane's clouds gone from over them, a broad
        // sugarloaf's summit read as one smooth pale dome, a ball behind the mid towers) the cap's
        // skyline knuckled by the crowns of its trees: rounded heads of their own sizes, the dips
        // between them cut down into the cap
        const cw = Math.max(2.5, f.bw * (0.26 + 0.14 * hash1(f.s, c.seed + 18)));
        const cph = (lx - f.cx) / cw + 0.6 * vnoise1(lx / (cw * 3) + f.s, c.seed + 19);
        const cfr = cph - Math.floor(cph) - 0.5;
        const kd = cw * (0.3 + 0.4 * hash1(Math.floor(cph) + 500, f.s + c.seed));
        if (tc > 0 && below < kd * (1 - Math.sqrt(Math.max(0, 1 - 4 * cfr * cfr)))) continue;
        const capD = f.ph * (0.09 + 0.07 * vnoise1(lx / 4 + f.s, c.seed + 14));
        const inCap = tc > 0 && below < capD;
        const veg = inCap || (v > 0.3 && vnoise((lx - f.cx) / 6 + f.s, a / 4.5, c.seed + 16) * (0.6 + 0.5 * vnoise((lx - f.cx) / 15, a / 19 + f.s, c.seed + 17)) > 0.62);
        // (the crowns' sunlit tops a step lighter, along the cap's upper edge on the sun's side)
        if (veg) t += 0.13 - (inCap && below < capD * 0.35 && u < 0.6 ? 0.1 : 0);
        else if (below < f.ph * 0.25 && u < 0.6) t -= 0.05;
        // a fissure
        for (let j = 0; j < nF; j++) {
          const fu = 0.18 + 0.6 * hash1(j + 1, f.s + c.seed);
          const w = (1.1 / Math.max(1, xr - xl)) * (1 + 0.6 * hash1(j + 7, f.s));
          if (Math.abs(u - fu - 0.04 * Math.sin(a / 11 + j)) < w && v > 0.18 && v < 0.88 && vnoise1(a / 6 + j * 13 + f.s, c.seed + 13) > 0.38) t += 0.16;
        }
        // the edge of the shade side: one step darker along it (the form turns away)
        if (xr - lx < 1.6 / d + 1) t += 0.06;
        // into the fog at its foot: paler and paler down to the mist's own value, in flat steps
        const fogV = fogK * (0.85 + 0.3 * vnoise1(lx / 17 + f.s, c.seed + 15));
        if (v < fogV) t -= (1 - v / fogV) * 0.45;
        t = t * (1 - 0.55 * ghost) - 0.06 * ghost;
        t = clamp(t, 0, 0.999);
        // flat steps of the range's blue-grey, one cell of dither only where two meet
        const pos = t * 5;
        let i = Math.floor(pos);
        const q = (pos - i - 0.84) / 0.16;
        if (q > 0 && bay(x, y, kc) < q) i++;
        b.set(x, y, R[Math.min(5, Math.max(0, i))]!);
      }
    }
  }
}

export const farKarst = definePainter<FarKarstP>("op.farkarst", {
  bounds(p) {
    return [-p.h * 0.6, -p.h * 1.3 - 10, p.w + p.h * 0.6, 2];
  },
  paint(c, p) {
    paintFar(c, p);
  },
});

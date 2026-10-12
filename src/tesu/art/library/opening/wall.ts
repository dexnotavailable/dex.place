// Shiraito 白糸, the great wall behind Gate Road (P3): a sheer karst face below the road's lip,
// strung with a hundred thin falls. Same geology as the road's own rock (rock.ts), so the
// two read as one landform: buttresses, ledges, moss, plants. Wetter and greener: the water
// keeps the ledges planted and leaves long dark stains behind every thread.
//
// The falls: threads in groups where the lip dips (a hundred of them along the wall), each a
// bright core with a cool shaded right edge, clinging to the face and wandering with it, broken
// into dashes of foam where it strikes a ledge, fraying into dithered spray lower down and
// vanishing into the valley's mist. Static here; their flow is a sprite overlay (flow.ts).

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, rng, vnoise1 } from "../../raster.ts";
import { cached, yAt } from "./kit.ts";
import { paintRock, type RockP } from "./rock.ts";

export interface WallP {
  /** Width and height, level-1 px of its plane; the anchor is the left end of the lip. */
  w: number;
  h: number;
  /** Lip offsets [x, y, ...] along the top (y negative is higher), x from 0 to w. */
  lip?: number[];
  /** Thread falls per 100 px of lip (default 1.6). */
  falls?: number;
  /** The face dissolves into mist from this local y over fadeH px. */
  fadeY?: number;
  fadeH?: number;
  /** Plants, 0..1 (default 0.8). */
  veg?: number;
  /** Column width and ledge spacing at this plane's density (default 16 and 70). */
  col?: number;
  bed?: number;
}

export interface Thread {
  x: number;
  /** Core width, px. */
  w: number;
  /** Where it frays out (share of the height down to the fade), 0..1. */
  life: number;
  seed: number;
}

function lipOf(p: WallP): number[] {
  const l = p.lip && p.lip.length >= 4 ? p.lip : [0, 0, p.w, 0];
  const out: number[] = [];
  for (let x = 0; x <= p.w; x += 6) out.push(x, yAt(l, x) + (vnoise1(x / 13, 7) - 0.5) * 4);
  if (out[out.length - 2] !== p.w) out.push(p.w, yAt(l, p.w));
  return out;
}

export function threadsOf(p: WallP, seed: number): Thread[] {
  return cached(`threads|${seed}|${p.w}|${p.falls}`, () => {
    const r = rng(seed + 501);
    const per = p.falls ?? 1.6;
    const out: Thread[] = [];
    for (let x = 8; x < p.w - 8;) {
      // a group: one to seven threads close together, the odd broad veil
      const n = 1 + Math.floor(r() * r() * 7);
      const veil = r() < 0.12;
      let gx = x;
      for (let i = 0; i < n; i++) {
        out.push({ x: gx, w: veil && i === 0 ? 4 + r() * 5 : 0.8 + r() * (r() < 0.25 ? 2.2 : 0.9), life: r() < 0.3 ? 0.1 + 0.3 * r() : 0.45 + 0.55 * r(), seed: Math.floor(r() * 1e6) });
        gx += 2.5 + r() * 6;
      }
      x = gx + (100 / per) * (0.3 + 1.4 * r()) * n * 0.5;
    }
    return out;
  });
}

/** The thread's centre x at depth `below` under the lip: it clings to the face and wanders. */
export function threadX(t: Thread, below: number): number {
  return t.x + Math.sin(below / 47 + t.seed) * Math.min(1.6, below / 60) + (vnoise1(below / 90, t.seed) - 0.5) * Math.min(5, below / 30);
}

export function paintThreads(c: PaintCtx, p: WallP, threads: Thread[], frame = -1, flowH = Infinity): void {
  const b = c.buf, d = c.d;
  const lip = lipOf(p);
  const fadeY = p.fadeY ?? p.h * 0.6;
  const fadeH = p.fadeH ?? p.h * 0.2;
  const C = P.cloud;
  for (const t of threads) {
    const top = yAt(lip, t.x) + 3;
    const end = top + (fadeY + fadeH - top) * (0.15 + 0.85 * t.life) + 20;
    const reach = t.w + 8;
    if (!b.touches(Math.floor(c.X(t.x - reach)), Math.floor(c.Y(top)), Math.ceil(c.X(t.x + reach)), Math.ceil(c.Y(end)))) continue;
    const Y0 = Math.max(b.oy, Math.floor(c.Y(top))), Y1 = Math.min(b.y1, Math.ceil(c.Y(Math.min(end, top + flowH))));
    for (let y = Y0; y < Y1; y++) {
      const ly = c.ly(y + 0.5);
      const below = ly - top;
      const k = below / Math.max(1, end - top);
      const cx = threadX(t, below);
      const half = Math.max(0.5 / d, t.w / 2 + below * 0.006);
      const xa = Math.floor(c.X(cx - half - 1.2)), xb = Math.ceil(c.X(cx + half + 1.2));
      // the flow: a periodic pattern of brighter dashes, one cell down per frame, so four frames
      // loop seamlessly (12 fps); each thread has its own cell size and offset
      const L = 3 + Math.floor(hash1(t.seed, 3) * 4);
      const phase = (frame >= 0 ? frame : 0) * L;
      for (let x = Math.max(xa, b.ox); x < Math.min(xb, b.x1); x++) {
        const lx = c.lx(x + 0.5);
        const u = (lx - cx) / half;
        if (Math.abs(u) > 1.6) continue;
        // fraying: lower down the thread breaks up into a dithered screen of spray
        const keep = 1 - clamp((k - 0.5) * 2, 0, 1) * (0.8 + 0.2 * vnoise1(ly / 9, t.seed));
        if (Math.abs(u) > 1) {
          // wet rock right beside the water, a halo of mist where it frays
          if (k > 0.55 && bayer4(x, y) < 0.18 * (k - 0.55) * 4) b.set(x, y, C[2]!);
          continue;
        }
        if (bayer4(x, y) >= keep) continue;
        const cellI = ((Math.floor((ly - phase) / L + hash1(t.seed, 4) * 4) % 4) + 4) % 4;
        const dash = hash(cellI, Math.floor(lx * 1.3), t.seed) < 0.5;
        // flow: bright foam dashes over a cooler body, so the movement reads even when faded
        let col: number;
        if (u > 0.45 && half * d > 0.9) col = dash ? C[2]! : C[4]!;
        else if (u < -0.5 && half * d > 1.4) col = dash ? P.paper[0]! : C[2]!;
        else col = dash ? C[0]! : C[3]!;
        b.set(x, y, col);
      }
    }
  }
}

export const wall = definePainter<WallP>("op.wall", {
  bounds(p) {
    let mn = 0;
    for (let i = 1; i < (p.lip?.length ?? 0); i += 2) mn = Math.min(mn, p.lip![i]!);
    return [-40, mn - 20, p.w + 40, p.h + 4];
  },
  paint(c, p) {
    const lip = lipOf(p);
    const rp: RockP = {
      top: lip,
      bottom: [p.w + 20, lip[lip.length - 1]! + 30, p.w + 10, p.h, -10, p.h, -20, lip[1]! + 30],
      cap: "grass", capH: 7, rough: 8, teeth: 0, veg: p.veg ?? 0.8, shade: 0.1,
      col: p.col ?? 16, bed: p.bed ?? 110, fadeY: p.fadeY ?? p.h * 0.6, fadeH: p.fadeH ?? p.h * 0.2,
    };
    paintRock(c, rp);
    paintThreads(c, p, threadsOf(p, c.seed));
  },
});

export interface FallsP extends WallP {
  /** The wall piece's seed (the threads are its threads) and the slice of them this sprite shows. */
  wallSeed: number;
  /** How far below the lip the flow is animated, px (below, the plate's still threads go on). */
  flowH?: number;
  from: number;
  to: number;
  frame?: number;
}

/** The flow of some of the wall's threads, as an animated sprite over the static plate. */
export const falls = definePainter<FallsP>("op.falls", {
  bounds(p) {
    const T = threadsOf(p, p.wallSeed).slice(p.from, p.to);
    let x0 = Infinity, x1 = -Infinity;
    for (const t of T) { x0 = Math.min(x0, t.x - t.w - 12); x1 = Math.max(x1, t.x + t.w + 12); }
    let mn = 0;
    for (let i = 1; i < (p.lip?.length ?? 0); i += 2) mn = Math.min(mn, p.lip![i]!);
    let mx = 0;
    for (let i = 1; i < (p.lip?.length ?? 0); i += 2) mx = Math.max(mx, p.lip![i]!);
    return [x0, mn - 6, x1, Math.min((p.fadeY ?? p.h * 0.6) + (p.fadeH ?? p.h * 0.2) + 24, mx + 12 + (p.flowH ?? Infinity))];
  },
  paint(c, p) {
    paintThreads(c, p, threadsOf(p, p.wallSeed).slice(p.from, p.to), p.frame ?? 0, p.flowH ?? Infinity);
  },
});

/** Groups of threads for the flow sprites: [from, to) index ranges, each spanning <= maxW px. */
export function threadGroups(p: WallP, seed: number, maxW = 60): [number, number][] {
  const T = threadsOf(p, seed);
  const out: [number, number][] = [];
  let a = 0;
  for (let i = 1; i <= T.length; i++) {
    if (i === T.length || T[i]!.x - T[a]!.x > maxW) {
      out.push([a, i]);
      a = i;
    }
  }
  return out;
}

// Shiraito 白糸, the great wall behind Gate Road (P3): a sheer karst face below the road's lip,
// strung with a hundred thin falls. Same geology as the road's own rock (rock.ts), so the
// two read as one landform: buttresses, ledges, moss, plants. Wetter and greener: the water
// keeps the ledges planted and leaves long dark stains behind every thread.
//
// The falls: white threads gathered into veils (Shiraito's curtains), a few broad and more
// narrow, with bare wet rock and the odd lone thread between them. A veil's threads cling to the
// face and wander over it together, each a bright core with a cool shaded right edge over a thin
// screen of falling water; where the veil strikes a ledge it splashes and steps out a little;
// lower down it frays and blooms into dithered spray that melts into the valley's mist. Static
// here; their flow is a sprite overlay (op.falls).

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm, hash, hash1, rng, vnoise, vnoise1 } from "../../raster.ts";
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
  /** The veil it belongs to (its threads wander together over the face), and that veil's half width. */
  veil?: number;
  vw?: number;
  /** The first thread of its veil paints the veil's ledge splashes and spray bloom. */
  lead?: boolean;
  /** The veil's centre at the lip. */
  vx?: number;
}

function lipOf(p: WallP): number[] {
  const l = p.lip && p.lip.length >= 4 ? p.lip : [0, 0, p.w, 0];
  const out: number[] = [];
  for (let x = 0; x <= p.w; x += 6) out.push(x, yAt(l, x) + (vnoise1(x / 13, 7) - 0.5) * 4);
  if (out[out.length - 2] !== p.w) out.push(p.w, yAt(l, p.w));
  return out;
}

export function threadsOf(p: WallP, seed: number): Thread[] {
  return cached(`threads2|${seed}|${p.w}|${p.falls}`, () => {
    const r = rng(seed + 501);
    const per = p.falls ?? 1.6;
    const out: Thread[] = [];
    let vi = 0;
    for (let x = 10 + 30 * r(); x < p.w - 12;) {
      // a veil: a curtain of many threads, of its own width (a few broad, more narrow), and in
      // the gap after it bare wet rock with the odd lone thread
      const v = r();
      const W = v < 0.2 ? 30 + 26 * r() : v < 0.6 ? 14 + 14 * r() : 6 + 8 * r();
      const vs = Math.floor(r() * 1e6);
      const life = 0.55 + 0.45 * r();
      let tx = x;
      let first = true;
      while (tx < x + W) {
        const tw = 0.7 + r() * (r() < 0.3 ? 1.6 : 0.8);
        out.push({ x: tx + tw / 2, w: tw, life: Math.min(1, life * (0.85 + 0.25 * r())), seed: vs + Math.floor(r() * 97), veil: vi, vw: W / 2, lead: first, vx: x + W / 2 });
        first = false;
        tx += tw + 0.6 + r() * 2.2;
      }
      vi++;
      // the gap: wide, set by the wall's falls per 100 px; bare wet rock (no lone ruled threads)
      const gap = (100 / per) * (1.2 + 2.4 * r()) * Math.max(1, W / 18);
      r(); r(); r();
      x = tx + gap;
    }
    out.sort((a, b) => a.x - b.x);
    return out;
  });
}

/** The thread's centre x at depth `below` under the lip: it clings to the face and wanders (a veil's threads together). */
export function threadX(t: Thread, below: number): number {
  const s = t.veil !== undefined ? t.seed - (t.seed % 97) : t.seed;
  return t.x + Math.sin(below / 47 + s) * Math.min(1.6, below / 60) + (vnoise1(below / 90, s) - 0.5) * Math.min(5, below / 30) + (t.veil !== undefined ? (vnoise1(below / 23, t.seed) - 0.5) * Math.min(1.2, below / 40) : 0);
}

/** Ledges a veil strikes on its way down: [depth below the lip, how far it steps out]. */
function ledgesOf(t: Thread, H: number): [number, number][] {
  const s = t.seed - (t.seed % 97);
  return cached(`ledges|${s}|${Math.round(H)}`, () => {
    const out: [number, number][] = [];
    let y = 40 + 60 * hash1(1, s);
    for (let i = 0; y < H && i < 40; i++) {
      if (hash1(i + 3, s) < 0.6) out.push([y, (hash1(i + 5, s) - 0.4) * 3]);
      y += 50 + 110 * hash1(i + 7, s);
    }
    return out;
  });
}

export function paintThreads(c: PaintCtx, p: WallP, threads: Thread[], frame = -1, flowH = Infinity): void {
  const b = c.buf, d = c.d;
  const lip = lipOf(p);
  const fadeY = p.fadeY ?? p.h * 0.6;
  const fadeH = p.fadeH ?? p.h * 0.2;
  const C = P.cloud;
  // the veils' bodies first (the static plate only), their threads over them
  if (frame < 0) for (const t of threads) {
    if (!t.lead || !t.vw) continue;
    const top = yAt(lip, t.x) + 3;
    const end = top + (fadeY + fadeH - top) * (0.15 + 0.85 * t.life) + 20;
    paintVeilBody(c, t, top, end, ledgesOf(t, end - top), p.w);
  }
  for (const t of threads) {
    const top = yAt(lip, t.x) + 3;
    const end = top + (fadeY + fadeH - top) * (0.15 + 0.85 * t.life) + 20;
    const vw = t.vw ?? 0;
    const reach = t.w + 8 + (t.lead ? vw * 2.6 : 0);
    const cxv = t.vx ?? t.x;
    if (!b.touches(Math.floor(c.X(Math.min(t.x, cxv) - reach)), Math.floor(c.Y(top)), Math.ceil(c.X(Math.max(t.x, cxv) + reach)), Math.ceil(c.Y(end)))) continue;
    const ledges = t.veil !== undefined ? ledgesOf(t, end - top) : [];
    const Y0 = Math.max(b.oy, Math.floor(c.Y(top))), Y1 = Math.min(b.y1, Math.ceil(c.Y(Math.min(end, top + flowH))));
    for (let y = Y0; y < Y1; y++) {
      const ly = c.ly(y + 0.5);
      const below = ly - top;
      const k = below / Math.max(1, end - top);
      // where the veil has struck a ledge: a splash band, then it steps out a little
      let shift = 0, splash = false;
      for (const [ly0, dx] of ledges) {
        if (below >= ly0) shift += dx;
        // (each thread splashes at its own height on the ledge, some not at all)
        const j = (hash1(Math.round(ly0), t.seed) - 0.5) * 4;
        if (below >= ly0 - 1 + j && below < ly0 + j + (1.2 + 2 * hash1(Math.round(ly0), t.seed + 1)) / d && hash1(Math.round(ly0), t.seed + 2) < 0.7) splash = true;
      }
      const cx = threadX(t, below) + shift;
      const half = Math.max(0.5 / d, t.w / 2 + below * 0.004) * (splash ? 1.6 : 1);
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
        if (splash) { b.set(x, y, Math.abs(u) < 0.7 ? P.paper[0]! : C[1]!); continue; }
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

/** Between a veil's threads a thin screen of falling water; below, the spray blooming into the mist. */
function paintVeilBody(c: PaintCtx, t: Thread, top: number, end: number, ledges: [number, number][], w: number): void {
  const b = c.buf, d = c.d;
  const C = P.cloud;
  const vw = t.vw ?? 0, vx = t.vx ?? t.x;
  const lead = { ...t, x: vx };
  if (!b.touches(Math.floor(c.X(vx - vw * 3.5)), Math.floor(c.Y(top)), Math.ceil(c.X(vx + vw * 3.5)), Math.ceil(c.Y(end)))) return;
  const Y0 = Math.max(b.oy, Math.floor(c.Y(top))), Y1 = Math.min(b.y1, Math.ceil(c.Y(end)));
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    const below = ly - top;
    const k = below / Math.max(1, end - top);
    let shift = 0;
    for (const [ly0, dx] of ledges) if (below >= ly0) shift += dx;
    const cx = threadX(lead, below) + shift;
    // the bloom: lower down the veil spreads into spray, wider and thinner the further it falls
    const bloom = clamp((k - 0.5) * 2, 0, 1.4);
    const half = vw * (1 + 0.25 * k) * (1 + 0.9 * bloom * bloom);
    const X0 = Math.max(b.ox, Math.floor(c.X(Math.max(-38, cx - half)))), X1 = Math.min(b.x1, Math.ceil(c.X(Math.min(w + 38, cx + half))));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const u = Math.abs(lx - cx) / Math.max(1e-3, half);
      if (u >= 1) continue;
      // a sheet of falling water: long streaks of foam and cooler water, solid in its core,
      // ragged and thinning at its sides, cloudier where it blooms into spray lower down
      const streak = vnoise(lx / 1.7, ly / 26 - (t.seed % 13), t.seed + 7);
      const cloud = vnoise(lx / 6, ly / 9, t.seed + 8);
      const side = 1 - u * u * (0.6 + 0.8 * vnoise(lx / 3, ly / 14, t.seed + 9));
      const cov = (bloom > 0 ? 0.45 + 0.4 * bloom * cloud : 0.42 + 0.45 * streak) * side;
      if (cov > 0.62) {
        // the shaded right edge cooler, foam streaks bright
        const i = u > 0.6 && lx > cx ? 3 : streak > 0.62 ? 0 : streak > 0.4 ? 1 : 2;
        b.set(x, y, C[i]!);
        continue;
      }
      const th = cov > 0.45 ? 0.5 : cov > 0.3 ? 0.25 : cov > 0.16 ? 0.125 : 0;
      if (bayer4(x, y) < th) b.set(x, y, bloom > 0.3 && cloud > 0.55 ? C[0]! : C[1]!);
    }
  }
  void d;
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

export interface SprayP {
  /** Width of the bloom along the wall's foot and its tallest plume, px; anchor at its left foot. */
  w: number;
  h: number;
  /** Where the veils land, [x, half width] along it (the plumes rise there; default spread). */
  at?: [number, number][];
  /** Churn frame (0..3). */
  frame?: number;
}

/**
 * Spray rising where falls land in water or mist: plumes over each landing, lumpy at three
 * scales, dense and bright low down, thinning by the three dissolve steps to single drops at
 * the top, a soft skirt joining the plumes along the water; its frames churn it slowly.
 */
export const spray = definePainter<SprayP>("op.spray", {
  bounds(p) {
    return [-p.h * 0.8 - 2, -p.h * 1.3 - 2, p.w + p.h * 0.8 + 2, 2];
  },
  paint(c, p) {
    const b = c.buf, seed = c.seed;
    const f = (p.frame ?? 0) & 3;
    const C = P.cloud;
    const at = p.at ?? [[p.w * 0.2, p.h * 0.4], [p.w * 0.55, p.h * 0.6], [p.w * 0.85, p.h * 0.35]];
    const X0 = Math.max(b.ox, Math.floor(c.X(-p.h * 0.8))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w + p.h * 0.8)));
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-p.h * 1.3))), Y1 = Math.min(b.y1, Math.ceil(c.Y(0)));
    const ph = f * 0.9;
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      // a plume over each landing (nothing between them: never a band along the wall)
      let top = 0;
      for (const [ax, hw] of at) {
        const u = (lx - ax) / (hw * 1.6 + p.h * 0.3);
        if (u <= -1 || u >= 1) continue;
        top = Math.max(top, p.h * (1 - u * u) ** 1.5 * (0.55 + 0.45 * hash1(Math.round(ax), seed + 2)));
      }
      if (top <= 0.5) continue;
      // its foot wanders and frays: it rises off the water, never sits on a line
      const foot = p.h * 0.12 * vnoise1(lx / (p.h * 0.3), seed + 4);
      for (let y = Y0; y < Y1; y++) {
        const a = -c.ly(y + 0.5);
        if (a > top * 1.25) continue;
        // density: falling with height, broken by billows that churn with the frames
        const n = fbm(lx / (p.h * 0.35) + ph, a / (p.h * 0.25) - ph * 0.5, seed + 3, 3) - 0.5;
        const cov = Math.min((1 - a / top) * 1.15, (a - foot) / (p.h * 0.2)) + n * 1.2;
        if (cov >= 0.85) { b.set(x, y, n > 0.12 ? C[0]! : C[1]!); continue; }
        const th = cov > 0.6 ? 0.5 : cov > 0.38 ? 0.25 : cov > 0.18 ? 0.125 : 0;
        if (bayer4(x + f, y) < th) b.set(x, y, a < top * 0.4 ? C[0]! : C[1]!);
      }
    }
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

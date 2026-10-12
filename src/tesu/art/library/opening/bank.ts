// Kagami's near shore (P5, the near-front plane): the bank the lake's surface ends against.
// It frames the bottom of every lake view (reference 4's grassy rise), so it must sit back and
// never pull the eye: dark, quiet, a few shapes, no texture.
//
// Composed as groups along the shore, big, medium and small, with gaps between them where the
// bank dips to a wet earth lip at the waterline:
// - a reed stand (its reeds are op.reeds sprites: they sway, a gust running along the shore);
// - a grass clump: arching blades of different lengths on a low mound;
// - broad leaves: a few arrowhead leaves on stems standing out of the grass;
// - a mossy stone half sunk at the water's edge.
// The body below the top is a dark mass of foliage and earth that only gets darker and quieter
// going down: big soft shapes, no repeating cell. A few lit edges from the sky are placed on
// the tops of mounds, stones and leaves, nowhere else.
//
// The plane shader darkens the near plane toward ink; the palette steps here are the darker ones.
// Anchor: the waterline at the bank's left end. Sizes in level-1 px of the near plane.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export interface BankP {
  /** Length along the shore and depth of the body below the waterline, px. */
  w: number;
  h: number;
  /** The ends round off and fall away over this many px (default 0: straight). */
  endR?: number;
  startR?: number;
  /** Share of groups that are reed stands, 0..1 (default 0.45). */
  reeds?: number;
}

type GroupKind = "reeds" | "grass" | "leaves" | "stone";

interface Group {
  kind: GroupKind;
  x: number;
  w: number;
  /** Size class 0 small, 1 medium, 2 big. */
  size: number;
  /** Mound height under the group, px. */
  mound: number;
  seed: number;
}

/** The groups along the shore, in order. Deterministic for a seed. */
export function bankGroups(p: BankP, seed: number): Group[] {
  return cached(`bankg|${seed}|${p.w}|${p.reeds}`, () => {
    const r = rng(seed + 11);
    const out: Group[] = [];
    const reeds = p.reeds ?? 0.45;
    let x = 20 + r() * 60;
    while (x < p.w - 40) {
      // size classes in an uneven rhythm: mostly small and medium, the odd big one
      const k = r();
      const size = k < 0.18 ? 2 : k < 0.58 ? 1 : 0;
      const w = Math.min(p.w - 30 - x, size === 2 ? 220 + r() * 160 : size === 1 ? 100 + r() * 110 : 34 + r() * 50);
      const t = r();
      const kind: GroupKind = t < reeds ? "reeds" : t < reeds + 0.28 ? "grass" : t < reeds + 0.42 ? "leaves" : "stone";
      out.push({ kind, x, w, size, mound: (size === 2 ? 30 : size === 1 ? 17 : 8) * (0.6 + 0.8 * r()), seed: Math.floor(r() * 1e6) });
      // a gap: sometimes groups touch, sometimes the lip runs open for a while
      x += w + (r() < 0.35 ? -w * 0.2 : 20 + r() * (size === 2 ? 130 : 80));
    }
    // the ends: a heap of mossy boulders and tall grass where the bank runs out, so it resolves
    // into something instead of stopping
    for (const ex of [p.startR ? 20 : -1, p.endR ? p.w - 300 : -1]) {
      if (ex < 0) continue;
      out.push({ kind: "stone", x: ex, w: 260, size: 2, mound: 40, seed: Math.floor(r() * 1e6) });
      out.push({ kind: "grass", x: Math.max(10, ex - 40), w: Math.min(300, p.w - 30 - Math.max(10, ex - 40)), size: 2, mound: 30, seed: Math.floor(r() * 1e6) });
    }
    return out;
  });
}

/** Height of the bank's top above the waterline at x (px, positive up). */
function topOf(p: BankP, G: Group[], x: number, seed: number): number {
  // the low lip: just above the water, a few px of wet earth and grass
  let t = 2.5 + 2 * vnoise1(x / 37, seed + 3);
  for (const g of G) {
    const u = (x - g.x) / g.w;
    if (u < -0.3 || u > 1.3) continue;
    // a mound under the group, its shape a little lopsided, rising out of the lip
    const k = Math.max(0, 1 - Math.pow(Math.abs(u - 0.5 + (hash1(1, g.seed) - 0.5) * 0.2) / 0.62, 2.2));
    t = Math.max(t, 2.5 + g.mound * k * (0.85 + 0.3 * vnoise1(x / 11, g.seed)));
  }
  const ke = Math.max(p.endR ? clamp((x - (p.w - p.endR * 0.4)) / (p.endR * 0.4), 0, 1) : 0, p.startR ? clamp((p.startR * 0.4 - x) / (p.startR * 0.4), 0, 1) : 0);
  return t * Math.sqrt(Math.max(0, 1 - ke * ke)) - ke * 4;
}

/** A blade of grass from (x, y) arching to one side: lit near its tip, dark at its foot. */
function blade(c: PaintCtx, x: number, y: number, len: number, lean: number, seed: number, lit: boolean): void {
  const d = c.d;
  for (let s = 0; s < len; s += 0.5 / d) {
    const u = s / len;
    const X = Math.round(c.X(x + lean * s * 0.5 + lean * u * u * len * 0.45)), Y = Math.round(c.Y(y - s + u * u * len * 0.25 * Math.abs(lean)));
    c.buf.set(X, Y, u > 0.7 && lit ? P.moss[3]! : u > 0.35 ? P.moss[5]! : P.pine[3]!);
  }
  void seed;
}

/** An arrowhead leaf on its stem: the blade a pointed lens, a midrib, its top edge lit. */
function leaf(c: PaintCtx, x: number, y: number, hh: number, size: number, dir: number, lit: boolean): void {
  const b = c.buf, d = c.d;
  // the stem
  for (let s = 0; s < hh; s += 0.5 / d) b.set(Math.round(c.X(x + dir * s * 0.08)), Math.round(c.Y(y - s)), P.pine[3]!);
  // the blade held up and out from the stem's top, tilted to its side
  const ang = -Math.PI / 2 + dir * 0.75;
  const cx = x + dir * hh * 0.08 + Math.cos(ang) * size * 0.8, cy = y - hh + Math.sin(ang) * size * 0.8;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const X0 = Math.floor(c.X(cx - size)), X1 = Math.ceil(c.X(cx + size)), Y0 = Math.floor(c.Y(cy - size)), Y1 = Math.ceil(c.Y(cy + size));
  for (let yy = Math.max(Y0, b.oy); yy < Math.min(Y1, b.y1); yy++) {
    for (let xx = Math.max(X0, b.ox); xx < Math.min(X1, b.x1); xx++) {
      const dx = c.lx(xx + 0.5) - cx, dy = c.ly(yy + 0.5) - cy;
      // into the leaf's own frame: u along it, v across it
      const u = (dx * ca + dy * sa) / size, v = (-dx * sa + dy * ca) / (size * 0.42);
      if (u < -1 || u > 1) continue;
      const half = Math.pow(1 - Math.abs(u), 0.7) * (u < 0 ? 1 : 0.85);
      if (Math.abs(v) > half) continue;
      // the top edge catches the sky; the underside is dark; a midrib down the middle
      let col: number;
      if (lit && v < -half + 0.35 && u > -0.6) col = P.moss[3]!;
      else if (Math.abs(v) < 0.08 && d >= 1) col = P.moss[6]!;
      else col = v < 0 ? P.moss[5]! : P.pine[3]!;
      b.set(xx, yy, col);
    }
  }
}

/** A rounded stone half sunk at the water's edge: moss on its crown, its top lit. */
function stone(c: PaintCtx, x: number, R: number, seed: number, lit: boolean): void {
  const b = c.buf;
  const cy = R * 0.35;
  const X0 = Math.floor(c.X(x - R * 1.3)), X1 = Math.ceil(c.X(x + R * 1.3)), Y0 = Math.floor(c.Y(cy - R)), Y1 = Math.ceil(c.Y(2));
  if (!b.touches(X0, Y0, X1, Y1)) return;
  for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
    for (let xx = Math.max(X0, b.ox); xx < Math.min(X1, b.x1); xx++) {
      const dx = (c.lx(xx + 0.5) - x) / (R * 1.25), dy = (c.ly(y + 0.5) - cy) / R;
      const q = dx * dx + dy * dy * (1 + 0.3 * vnoise1(dx * 4, seed));
      if (q > 1 || c.ly(y + 0.5) > 1) continue;
      const up = -0.62 * dx - 0.78 * dy;
      const moss = dy < -0.25 && vnoise1(dx * 5 + 3, seed + 1) > 0.4;
      let col: number;
      if (moss) col = lit && up > 0.55 && q > 0.6 ? P.moss[3]! : P.moss[5]!;
      else col = lit && up > 0.5 && q > 0.55 ? P.stone[3]! : up > 0 ? P.stone[5]! : P.stone[6]!;
      b.set(xx, y, col);
    }
  }
}

export const bank = definePainter<BankP>("op.bank", {
  bounds(p) {
    return [-60, -120, p.w + 60, p.h + 34];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const G = bankGroups(p, seed);
    const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    // the body: from the top line down, darker and quieter with depth
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const top = -topOf(p, G, lx, seed);
      // the foot: ragged, foliage hanging over whatever lies below the bank
      let foot = p.h * (0.78 + 0.22 * vnoise1(lx / 31, seed + 18)) + 20 * vnoise1(lx / 13, seed + 19);
      if (p.endR || p.startR) {
        const k = Math.max(p.endR ? clamp((lx - (p.w - p.endR)) / p.endR, 0, 1) : 0, p.startR ? clamp((p.startR - lx) / p.startR, 0, 1) : 0);
        foot = foot * Math.sqrt(Math.max(0, 1 - k * k)) * (0.9 + 0.2 * vnoise1(lx / 11, seed + 15));
        if (foot <= top + 1) continue;
      }
      const Yt = Math.ceil(c.Y(top)), Yb = Math.min(b.y1, Math.ceil(c.Y(foot)));
      // a lit edge from the sky only where the top line faces up and left, in a few places
      const slope = topOf(p, G, lx - 2, seed) - topOf(p, G, lx + 2, seed);
      const litTop = slope > -0.2 && vnoise1(lx / 23, seed + 21) > 0.55;
      for (let y = Math.max(Yt, b.oy); y < Yb; y++) {
        const ly = c.ly(y + 0.5);
        const below = ly - top;
        let col: number;
        if (below < 1.2 / Math.min(1, d)) col = litTop ? P.moss[3]! : P.moss[5]!;
        else if (below < 5 + 3 * vnoise1(lx / 9, seed + 7)) {
          // grass at the top: a few vertical strokes, mostly one dark tone
          col = d >= 0.5 && hash1(Math.floor(lx * 1.3), seed + 8) < 0.2 ? P.moss[5]! : P.moss[6]!;
        } else if (ly > -2.5 && ly < 1.5 && top > -9) {
          // the wet earth lip where the water laps the bank
          col = P.earth[5]!;
        } else {
          // big soft masses (shrubs, earth) in two dark tones, then one, going down
          const deep = clamp((below - 6 + (vnoise1(lx / 47, seed + 22) - 0.5) * 30) / 70, 0, 1);
          const blob = vnoise(lx / 38, ly / 26, seed + 9) * 0.65 + vnoise(lx / 15, ly / 11, seed + 10) * 0.35;
          const t = 0.45 + deep * 0.55 + (blob - 0.5) * (0.5 - deep * 0.4);
          col = tone(P.pine, clamp(0.55 + t * 0.45, 0, 1), x, y, 0.15);
        }
        // the foot darkens to the darkest step
        if (ly > foot - 8 && bayer4(x, y) < (ly - foot + 8) / 8) col = P.pine[5]!;
        b.set(x, y, col);
      }
    }
    // the groups' static parts: grass clumps, leaves, stones (reeds are sprites)
    for (const g of G) {
      if (!b.touches(Math.floor(c.X(g.x - 40)), b.oy - 1, Math.ceil(c.X(g.x + g.w + 40)), b.y1 + 1)) continue;
      const r = rng(g.seed);
      const baseAt = (x: number): number => -topOf(p, G, x, seed) + 1.5;
      if (g.kind === "grass" || g.kind === "leaves" || g.kind === "reeds") {
        // grasses: many blades in tufts, tallest in the middle of the group
        const n = Math.round(g.w / (g.kind === "grass" ? 2.2 : 4.5));
        for (let i = 0; i < n; i++) {
          const x = g.x + r() * g.w;
          const u = (x - g.x) / g.w;
          const len = (8 + r() * (g.size === 2 ? 40 : g.size === 1 ? 26 : 14)) * Math.pow(Math.sin(Math.PI * clamp(u, 0.06, 0.94)), 0.7);
          blade(c, x, baseAt(x), len, (r() - 0.5) * 1.4, g.seed + i, r() < 0.25);
        }
      }
      if (g.kind === "leaves") {
        const n = 2 + Math.floor(r() * (g.size + 2));
        for (let i = 0; i < n; i++) {
          const x = g.x + g.w * (0.15 + 0.7 * r());
          leaf(c, x, baseAt(x), 14 + r() * (g.size === 2 ? 30 : 20), 10 + r() * 8, r() < 0.5 ? -1 : 1, r() < 0.6);
        }
      }
      if (g.kind === "stone") {
        const n = 1 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) stone(c, g.x + g.w * (0.2 + 0.6 * r()), 9 + r() * (g.size === 2 ? 20 : 12), g.seed + i, r() < 0.7);
        // a little grass round the stones
        for (let i = 0; i < 10; i++) {
          const x = g.x + r() * g.w;
          blade(c, x, baseAt(x), 3 + r() * 8, (r() - 0.5) * 1.6, g.seed + 50 + i, false);
        }
      }
    }
  },
});

/** The reed stands' places, for the reed sprites: [x, width, height] in the bank's own px. */
export function reedBeds(p: BankP, seed: number): [number, number, number][] {
  return bankGroups(p, seed).filter((g) => g.kind === "reeds").map((g) => [g.x, g.w, g.size === 2 ? 70 + 20 * hash1(1, g.seed) : g.size === 1 ? 48 + 16 * hash1(1, g.seed) : 30 + 10 * hash1(1, g.seed)] as [number, number, number]);
}

/** The mound height at a reed stand's foot (so its reeds stand on the bank, not in the air). */
export function bankTopAt(p: BankP, seed: number, x: number): number {
  return topOf(p, bankGroups(p, seed), x, seed);
}


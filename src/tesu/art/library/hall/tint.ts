// Light and shadow that land on what is already painted (the hall loop, round 1).
//
// Every plane's pieces paint into one indexed buffer per tile, in z order (plates/paint.ts), so a
// piece painted later can read what lies under it and re-colour it: a cast shadow darkens the
// floor it falls on by whole ramp steps (cooler, as shade under a blue sky or in a night hall),
// and a lamp's pool lifts the wall it lands on (warmer), keeping the texture under it. No dither
// screen: each pixel moves by whole steps to the nearest palette colour of its new value, so a
// pool reads as two or three clustered bands with the wall's own grain still in them.
//
// The remaps are tables over the palette (index -> index), built once per kind and step in
// every worker. A pixel's decision may depend only on its own position (never its neighbours:
// tiles are painted apart), so the same pixel gets the same colour in every tile and level.

import type { PaintCtx } from "../../painter.ts";
import { PALETTE_SIZE, P, hexOf } from "../../palette.ts";

type Lab = [number, number, number];

function toLab(hex: string): Lab {
  const v = parseInt(hex.slice(1), 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((v >> 16) & 255), g = lin((v >> 8) & 255), b = lin(v & 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Ramps a remap may land in (no accent ramps: a shadow never turns a wall pink or violet-blue flowers). */
const LANDING: readonly (readonly number[])[] = [
  P.ink, P.paper, P.karst, P.moss, P.pine, P.jade, P.timber, P.red, P.lacquer, P.gold, P.tile, P.stone,
  P.earth, P.blue, P.range, P.ember, P.umber, P.bronze, P.dusk, P.mauve, P.cloud,
];

let LABS: Lab[] | null = null;
let CANDS: number[] | null = null;
function labs(): Lab[] {
  if (!LABS) {
    LABS = [];
    for (let i = 0; i < PALETTE_SIZE; i++) LABS.push(toLab(hexOf(i)));
    CANDS = [...new Set(LANDING.flat())];
  }
  return LABS;
}

function nearest(t: Lab, keepHue: number): number {
  const L = labs();
  let best = 0, bd = Infinity;
  for (const i of CANDS!) {
    const c = L[i]!;
    const d = (c[0] - t[0]) ** 2 + keepHue * ((c[1] - t[1]) ** 2 + (c[2] - t[2]) ** 2);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** How a step moves a colour: the change in L, a, b per step and the chroma kept per step. */
interface Move { dL: number; da: number; db: number; chroma: number; hue: number }

const MOVES = {
  /** Daylight shade (the court): darker and bluer, a little greyer, the sky's cool in it. */
  day: { dL: -13, da: 1.2, db: -5.5, chroma: 0.8, hue: 1.6 },
  /** Night shade (the hall): darker toward blue-violet. */
  night: { dL: -9, da: 1.6, db: -5.5, chroma: 0.82, hue: 1.3 },
  /** Lamplight landing: lighter and warmer, toward amber. */
  warm: { dL: 8.5, da: 2.6, db: 7.5, chroma: 1.08, hue: 1.2 },
  /** Daylight landing (the skylight, the court door): lighter, a touch warm, less chroma. */
  sun: { dL: 10, da: 0.8, db: 4, chroma: 0.95, hue: 1.2 },
  /** Lit air (the skylight's shaft passing through): lighter, the surface's own hue kept, flatter. */
  air: { dL: 8, da: 0, db: 1, chroma: 0.82, hue: 1.4 },
  /** Air between us and a far row (the court's back tiers): lighter, cooler, flatter. */
  haze: { dL: 7, da: -0.5, db: -2.5, chroma: 0.78, hue: 1.1 },
} as const satisfies Record<string, Move>;

export type Tint = keyof typeof MOVES;

const LUTS = new Map<string, Uint8Array>();

/** The palette remap for `steps` steps of a kind of light or shade (index -> index; 0 stays 0). */
export function lut(kind: Tint, steps: number): Uint8Array {
  const key = `${kind}|${steps}`;
  let t = LUTS.get(key);
  if (t) return t;
  const m: Move = MOVES[kind];
  const L = labs();
  t = new Uint8Array(256);
  for (let i = 1; i < PALETTE_SIZE; i++) {
    const [l, a, b] = L[i]!;
    const k = m.chroma ** steps;
    const tl = Math.max(2, Math.min(99, l + m.dL * steps));
    // the chroma shrinks or grows about the colour itself; the shift pulls the hue
    const target: Lab = [tl, a * k + m.da * steps, b * k + m.db * steps];
    let j = nearest(target, m.hue);
    // a step that lands back on the same colour moves one more notch along the value
    if (j === i && steps > 0) j = nearest([tl + Math.sign(m.dL) * 5, target[1], target[2]], m.hue);
    t[i] = j;
  }
  LUTS.set(key, t);
  return t;
}

/**
 * Re-colours what is painted in a local rectangle: fn says, per pixel, which remap to apply (or
 * null to leave it). Nothing new is painted where the buffer is empty.
 */
export function tint(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, fn: (X: number, Y: number, lx: number, ly: number) => Uint8Array | null): void {
  const X0 = Math.max(Math.round(c.X(x0)), c.buf.ox), X1 = Math.min(Math.round(c.X(x1)), c.buf.x1);
  const Y0 = Math.max(Math.round(c.Y(y0)), c.buf.oy), Y1 = Math.min(Math.round(c.Y(y1)), c.buf.y1);
  for (let Y = Y0; Y < Y1; Y++) {
    const ly = c.ly(Y + 0.5);
    for (let X = X0; X < X1; X++) {
      const v = c.buf.get(X, Y);
      if (!v) continue;
      const t = fn(X, Y, c.lx(X + 0.5), ly);
      if (t) c.buf.set(X, Y, t[v]!);
    }
  }
}

/** A step count from a strength, with a noisy edge so band borders wander instead of ruling a line. */
export function bands(v: number, edges: readonly number[], jitter: number): number {
  let n = 0;
  for (const e of edges) if (v + jitter > e) n++;
  return n;
}

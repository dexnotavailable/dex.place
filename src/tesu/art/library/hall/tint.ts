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

const LUMA: number[] = [];
function luma(i: number): number {
  if (!LUMA.length) for (let k = 0; k < 256; k++) {
    const v = parseInt(hexOf(k).slice(1), 16);
    LUMA.push(0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255));
  }
  return LUMA[i]!;
}

/**
 * A light's pool landing where the shell is sunk into the dusk (shade steps of night, lift steps of
 * lamplight): the pool brings back the surface's own warm colour and lifts it (the net of the two on
 * the surface's colour), but never comes out darker than the dusk round it (round 1's dark disc behind
 * a lantern: the warm lacquer under the dusk is darker than the dusk); then the lamplight is laid over
 * the dusk instead.
 */
export function poolLut(shade: number, lift: number): Uint8Array | null {
  if (shade <= 0 && lift <= 0) return null;
  if (lift <= 0) return lut("night", shade);
  if (shade <= 0) return lut("warm", lift);
  const key = `pool${shade}|${lift}`;
  let t = LUTS.get(key);
  if (t) return t;
  t = new Uint8Array(256);
  const night = lut("night", shade), warm = lut("warm", lift);
  const net = lift - shade;
  const onOwn = net > 0 ? lut("warm", net) : net < 0 ? lut("night", -net) : null;
  for (let i = 1; i < 256; i++) {
    const sh = night[i]!;
    const a = onOwn ? onOwn[i]! : i;
    const b = warm[sh]!;
    const want = luma(sh) + 5 * lift;
    t[i] = luma(a) >= want ? a : luma(b) > luma(sh) ? b : sh;
  }
  LUTS.set(key, t);
  return t;
}

/**
 * Remaps applied one after another (a night shade, then a lamp's warmth on the shaded colour): a pool
 * landing on a wall already sunk into the dusk lifts the dusk, never brings back the wall's own brown.
 */
export function lutChain(...steps: [Tint, number][]): Uint8Array | null {
  const live = steps.filter(([, n]) => n > 0);
  if (!live.length) return null;
  const key = live.map(([k, n]) => `${k}${n}`).join(">");
  let t = LUTS.get(key);
  if (t) return t;
  t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (const [k, n] of live) v = v ? lut(k, n)[v]! : 0;
    t[i] = v;
  }
  LUTS.set(key, t);
  return t;
}

/**
 * (hall loop round 3, W2-1: the "warm" steps on the navy plaster landed on grey-browns, umber and mauve,
 * S 0.36: the pools read as brown stains) Lamplight glowing on a dark wall, as in ref 05: each step lifts
 * the colour and pulls its hue hard toward a lantern's amber, so a pool climbs from the navy through a
 * violet-brown and a deep orange-brown into amber, and its core into the hot ember of the lantern's paper.
 * The landing set is the warm ramps only (plus the colour's own), so no step lands back on a cool grey.
 */
const AMBER_LAND: readonly (readonly number[])[] = [P.umber, P.mauve, P.bronze, P.gold, P.ember, P.timber, P.earth];

export function amberLut(steps: number): Uint8Array {
  const key = `amber|${steps}`;
  let t = LUTS.get(key);
  if (t) return t;
  const L = labs();
  const land = [...new Set(AMBER_LAND.flat())];
  t = new Uint8Array(256);
  for (let i = 1; i < PALETTE_SIZE; i++) {
    const [l, a, b] = L[i]!;
    const tl = Math.max(2, Math.min(97, l + 10 * steps));
    // the amber at that value: a deep orange-brown low down, a hot yellow-orange high up
    const C = Math.min(62, 16 + tl * 0.8);
    const hue = (40 + Math.max(0, tl - 18) * 0.62) * (Math.PI / 180);
    const w = 1 - Math.pow(0.35, steps);
    const ta = a * (1 - w) + C * Math.cos(hue) * w, tb = b * (1 - w) + C * Math.sin(hue) * w;
    let best = i, bd = Infinity;
    for (const j of [i, ...land]) {
      const c = L[j]!;
      const d = (c[0] - tl) ** 2 + 0.55 * ((c[1] - ta) ** 2 + (c[2] - tb) ** 2);
      if (d < bd) { bd = d; best = j; }
    }
    t[i] = best;
  }
  LUTS.set(key, t);
  return t;
}

/** A cool daylight landing (round 3, W2-2): the court's day spilling off the gate onto the room's navy: lighter,
 *  toward the sky's blue-grey, chroma kept low (never a teal or a violet). */
export function dayLut(steps: number): Uint8Array {
  const key = `dayspill|${steps}`;
  let t = LUTS.get(key);
  if (t) return t;
  const L = labs();
  const land = [...new Set([P.dusk, P.tile, P.range, P.lacquer, P.stone, P.karst, P.cloud, P.blue].flat())];
  t = new Uint8Array(256);
  for (let i = 1; i < PALETTE_SIZE; i++) {
    const [l, a, b] = L[i]!;
    const tl = Math.max(2, Math.min(97, l + 9 * steps));
    const w = 1 - Math.pow(0.55, steps);
    const ta = a * (1 - w) + -2 * w, tb = b * (1 - w) + -9 * w;
    let best = i, bd = Infinity;
    for (const j of [i, ...land]) {
      const c = L[j]!;
      const d = (c[0] - tl) ** 2 + 0.7 * ((c[1] - ta) ** 2 + (c[2] - tb) ** 2);
      if (d < bd) { bd = d; best = j; }
    }
    if (best === i && steps > 0) {
      for (const j of land) {
        const c = L[j]!;
        if (c[0] <= l + 3) continue;
        const d = (c[0] - tl) ** 2 + 0.7 * ((c[1] - ta) ** 2 + (c[2] - tb) ** 2);
        if (d < bd || best === i) { bd = d; best = j; }
      }
    }
    t[i] = best;
  }
  LUTS.set(key, t);
  return t;
}

/** Two remaps one after the other, cached (any of them null = skipped). */
export function chain2(a: Uint8Array | null, b: Uint8Array | null): Uint8Array | null {
  if (!a) return b;
  if (!b) return a;
  const key = `c2|${LUTKEY.get(a) ?? keyOf(a)}|${LUTKEY.get(b) ?? keyOf(b)}`;
  let t = LUTS.get(key);
  if (t) return t;
  t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = i ? b[a[i]!]! : 0;
  LUTS.set(key, t);
  return t;
}
const LUTKEY = new WeakMap<Uint8Array, string>();
let LUTN = 0;
function keyOf(t: Uint8Array): string {
  const k = `t${LUTN++}`;
  LUTKEY.set(t, k);
  return k;
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

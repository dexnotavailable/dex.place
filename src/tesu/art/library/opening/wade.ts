// Kagami's wading Walker: what its legs do to the still lake and the mist lying on it (art: the
// Kagami art loop, painter p1). The Walker itself is the Walker lane's render and is never
// redrawn here. This sprite stands on the same plane, shares its path, speed, stepMove and
// stride, and is drawn right after it, so it moves in lockstep and knows where each leg is.
// (Round 4, the sky lane: the Walker wades far out on P1 from its half-size set; `scale` draws all
// of this at that size, and the fog banks lying on the water there take the place of its mist.)
//
// The Walker walks east. Everything below is flat steps of the cloud, jade and range ramps;
// dither only on the one-cell boundary where two of them meet, never a screen of checker.
// - Parted water: a lens 1 to 2 px high piled against the leading (east) side of each planted
//   leg, paler than the lake, and a dark trough under its trailing side.
// - The wake: a V of two or three broken crest lines trailing west from the legs (their far
//   arms; the lake mirrors the near ones), the crests staying put on the water as it wades on.
// - Rings: every footfall throws two or three flattened rings that open and break up over four
//   to six of its frames, eased out; a boil of white water round the hoof as it lands, and a
//   crown of beads thrown up. Only the far halves are painted (above the waterline; the nearer
//   water slice covers anything below it) and the lake mirrors them, so each ring reads whole.
//   A planted leg laps a faint ring now and then.
// - Wet shins: the splash wets a shin high, and it dries back down to the wading line over a few
//   frames, its top wandering; a broken sheen down the lit edge. A lifted hoof's wet band dries
//   from the top down while it swings.
// - Drips: water clinging along a lifted sole as beads, and beads 2 to 4 px long falling from it
//   (eased in by gravity, stretching as they fall), each breaking into a small ring where it lands.
// - Mist: torn soft lobes drifting back past the legs, in front of them and between them, a
//   value lift (paler blue-grey) where they cross a leg and a cool white over the pale ground.
//
// Frames: the Walker's stride is 24 frames at 2.4 fps; this sprite runs `sub` frames to each of
// its (9.6 fps by default), so rings and drops move smoothly while the legs stay put. In its
// sub-frame s the sprite has already moved s/sub of a step ahead of the Walker (stepMove), so it
// paints that much further back.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash1, vnoise, vnoise1 } from "../../raster.ts";
import type { WorldBuilder } from "../../../world/build.ts";
import type { PlaneId } from "../../../world/types.ts";
import { cached } from "./kit.ts";

/**
 * The legs where they cross the waterline, per frame of the Walker's 24-frame stride (the 48
 * rendered frames are two strides; baked from public/tesu/walker/wade-560/, its lowest opaque runs):
 * [frames since the leg landed, then its left and right edge at 0, 8, 16, 24, 32, 44 and 60 px
 * above the waterline], plane px from the Walker's anchor, facing east.
 */
const LEGS: number[][][] = [
  [[24,-249,-179,-248,-186,-246,-187,-247,-189,-245,-190,-238,-185,-227,-179], [0,-157,-87,-155,-91,-154,-94,-155,-96,-153,-99,-149,-101,-146,-102], [12,22,103,24,95,24,91,24,92,28,90,35,91,43,94]],
  [[25,-253,-183,-252,-190,-250,-191,-250,-193,-249,-193,-242,-186,-229,-180], [1,-161,-91,-159,-95,-158,-98,-159,-100,-157,-103,-153,-104,-148,-103], [13,18,99,20,91,20,87,20,88,24,86,31,88,40,91]],
  [[26,-256,-187,-255,-195,-254,-195,-254,-197,-253,-197,-245,-189,-232,-182], [2,-164,-95,-163,-99,-162,-102,-162,-104,-161,-107,-156,-108,-150,-106], [14,14,95,16,87,16,83,16,84,20,82,27,85,37,89]],
  [[27,-260,-191,-259,-199,-258,-199,-258,-201,-257,-201,-249,-193,-236,-185], [3,-168,-99,-167,-103,-166,-106,-166,-108,-164,-110,-160,-111,-153,-109], [15,10,92,12,83,12,80,12,80,16,79,23,81,-16,86]],
  [[28,-264,-195,-263,-202,-262,-203,-262,-205,-261,-204,-253,-196,-239,-189], [4,-172,-103,-171,-107,-169,-110,-170,-112,-168,-114,-164,-115,-157,-112], [16,7,88,9,79,9,76,9,76,12,75,19,78,13,83]],
  [[29,-268,-199,-267,-206,-266,-207,-266,-209,-264,-208,-257,-200,-243,-193], [5,-176,-107,-175,-111,-173,-113,-174,-116,-172,-118,-167,-118,-160,-115], [17,3,84,5,75,5,72,5,72,8,71,16,75,27,81]],
  [[30,-272,-203,-271,-210,-270,-211,-269,-212,-268,-212,-261,-205,-247,-198], [6,-180,-110,-178,-115,-177,-117,-177,-120,-176,-122,-171,-122,-164,-119], [18,-1,80,1,71,1,68,1,68,4,67,12,71,23,108]],
  [[31,-276,-206,-275,-214,-273,-215,-273,-216,-272,-216,-264,-209,-252,-202], [7,-184,-114,-182,-119,-181,-121,-181,-124,-180,-126,-175,-126,-168,-123], [19,-5,76,-3,67,-3,65,-3,64,0,64,8,67,19,130]],
  [[32,-279,-210,-278,-217,-277,-218,-277,-220,-276,-220,-268,-213,-256,-207], [8,-187,-118,-186,-123,-185,-125,-185,-127,-184,-130,-179,-129,-171,-126], [20,-9,72,-7,64,-7,61,-7,61,-3,60,4,64,16,141]],
  [[33,-286,-207,-284,-211,-282,-218,-281,-221,-279,-222,-279,-221,-267,-209], [9,-191,-122,-190,-127,-189,-129,-189,-131,-187,-133,-182,-133,-175,-130], [21,-13,68,-11,60,-11,57,-11,57,-7,56,0,60,12,65]],
  [[10,-195,-126,-194,-131,-193,-132,-193,-135,-191,-137,-186,-136,-178,-133], [22,-16,65,-14,56,-14,53,-15,53,-11,52,-3,56,8,62]],
  [[11,-199,-130,-198,-135,-197,-136,-196,-139,-195,-141,-190,-140,-182,-136], [23,-20,61,-18,52,-18,49,-18,49,-15,48,-7,53,4,58]],
  [[12,-203,-133,-202,-139,-200,-140,-200,-143,-199,-145,-194,-143,-185,-140], [24,-24,57,-22,48,-22,45,-22,45,-19,44,-11,49,1,54], [0,68,150,71,144,70,140,72,139,75,136,78,132,80,128]],
  [[13,-207,-137,-206,-143,-204,-145,-204,-147,-203,-148,-197,-145,-187,-140], [25,-28,53,-26,43,-26,42,-26,41,-23,42,-15,49,-1,57], [1,64,146,67,139,66,135,67,135,71,132,76,130,81,129]],
  [[14,-210,-141,-209,-147,-208,-149,-207,-151,-207,-152,-201,-147,-190,-142], [26,-32,49,-30,39,-30,38,-30,37,-28,39,-19,48,-3,56], [2,60,142,63,135,62,130,63,131,67,128,72,127,79,128]],
  [[15,-214,-145,-213,-152,-212,-153,-211,-155,-211,-156,-204,-150,-193,-145], [27,-36,45,-34,35,-33,34,-34,33,-32,36,-23,45,-7,54], [3,56,138,59,131,58,126,59,127,63,125,69,124,76,126]],
  [[16,-218,-149,-217,-155,-216,-157,-215,-159,-215,-159,-208,-154,-221,-148], [28,-39,41,-38,31,-37,30,-38,29,-35,32,-27,41,-10,51], [4,52,134,55,127,55,122,55,123,59,121,65,121,73,123]],
  [[17,-222,-153,-221,-159,-220,-161,-219,-163,-218,-163,-212,-157,-200,-151], [29,-43,37,-42,27,-41,26,-41,26,-39,28,-30,37,-14,47], [5,48,130,51,123,51,118,51,119,55,117,61,117,69,119]],
  [[18,-226,-157,-225,-163,-224,-165,-223,-167,-222,-167,-216,-161,-204,-129], [30,-47,34,-45,23,-45,22,-45,22,-43,24,-34,33,-18,43], [6,45,127,47,119,47,114,47,115,51,113,58,113,66,116]],
  [[19,-230,-160,-229,-167,-228,-168,-226,-170,-226,-171,-220,-165,-208,-107], [31,-51,30,-49,19,-49,18,-49,18,-47,20,-38,29,-22,38], [7,41,123,43,115,43,110,43,111,47,109,54,110,62,112]],
  [[20,-233,-164,-232,-171,-231,-172,-230,-174,-230,-175,-224,-169,-212,-96], [32,-55,26,-53,16,-53,15,-53,14,-51,16,-42,25,-26,34], [8,37,119,39,111,39,106,40,107,43,105,50,106,58,109]],
  [[21,-237,-168,-236,-175,-235,-176,-234,-178,-234,-179,-227,-173,-216,-167], [33,-61,30,-59,26,-57,16,-55,10,-55,12,-54,17,-41,29], [9,33,115,36,107,35,102,36,103,40,102,46,102,55,105]],
  [[22,-241,-172,-240,-178,-239,-180,-238,-182,-238,-182,-231,-177,-220,-171], [10,29,111,32,103,32,98,32,100,36,98,42,99,51,101]],
  [[23,-245,-176,-244,-182,-243,-184,-242,-186,-241,-186,-235,-181,-223,-175], [11,25,107,28,100,28,95,28,96,32,94,38,95,47,98]],
];
const UPS = [0, 8, 16, 24, 32, 44, 60];
/**
 * The hooves lifted clear of the water, per stride frame (baked from the same frames: the lowest
 * opaque row over open water in each column): each sole from [x, px above the water] to [x, px
 * above the water], and how many frames since it left the water. Frames where a swinging hoof
 * passes in front of a planted leg have no clean sole and are left out.
 */
const LIFT: Record<number, [number, number, number, number, number][]> = {
  0: [[-66, 49, 21, 35, 2]],
  1: [[-66, 59, 17, 43, 3]],
  2: [[-63, 65, 13, 50, 4]],
  3: [[-53, 69, 9, 57, 5]],
  6: [[81, 56, 108, 55, 8]],
  7: [[77, 55, 132, 53, 9]],
  8: [[73, 49, 147, 46, 10]],
  9: [[69, 39, 153, 38, 11]],
  10: [[-289, 20, -209, 14, 0], [66, 27, 154, 26, 12]],
  11: [[-290, 35, -211, 25, 1], [65, 11, 155, 15, 13]],
  12: [[-291, 48, -213, 35, 2]],
  13: [[-292, 57, -214, 42, 3]],
  14: [[-289, 64, -212, 48, 4]],
  15: [[-279, 67, -215, 55, 5]],
  19: [[-160, 55, -104, 50, 9]],
  20: [[-163, 49, -89, 44, 10]],
  21: [[-162, 39, -83, 36, 11]],
  22: [[-161, 27, -82, 25, 12], [-63, 21, 27, 15, 0]],
  23: [[-161, 11, -81, 11, 13], [-65, 37, 24, 25, 1]],
};
/** The Walker's stride in frames, its ground px per frame on P2, and the waterline above its anchor. */
export const STRIDE = 24;
const STEP = 3.824;
const WATER = -16.13;

export interface WadeP {
  /** Sprite frames to each Walker frame (default 4). */
  sub?: number;
  /** The Walker's size against its full-size render (0.5: its half-size set, set far off). */
  scale?: number;
  /** The mist lobes round its legs (default true; off where the fog banks lie on the water). */
  mist?: boolean;
  frame?: number;
}

interface Leg { age: number; id: number; prof: [number, number][] }

function legsOf(f: number, shift: number): Leg[] {
  return LEGS[((f % STRIDE) + STRIDE) % STRIDE]!.map((r) => {
    const prof: [number, number][] = [];
    for (let i = 1; i + 1 < r.length; i += 2) prof.push([r[i]! + shift, r[i + 1]! + shift]);
    // (a leg's identity: the frame of the stride it landed on, hind or front)
    const land = (((f - r[0]!) % STRIDE) + STRIDE) % STRIDE;
    return { age: r[0]!, id: land * 2 + (r[1]! < -60 ? 0 : 1), prof };
  });
}

/** A leg's left and right edge at `up` px above the waterline (interpolated up its shin). */
function edgesAt(L: Leg, up: number): [number, number] | null {
  if (up < 0) return L.prof[0]!;
  for (let i = 1; i < L.prof.length; i++) {
    if (UPS[i]! >= up) {
      const k = (up - UPS[i - 1]!) / (UPS[i]! - UPS[i - 1]!);
      const a = L.prof[i - 1]!, b = L.prof[i]!;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
  }
  return null;
}

/** Inside any leg's silhouette at (lx, up above the water)? */
function inLeg(legs: Leg[], lx: number, up: number, pad = 0): boolean {
  for (const L of legs) {
    const e = edgesAt(L, up);
    if (e && lx >= e[0] - pad && lx < e[1] + pad) return true;
  }
  return false;
}

/** The dither cell in art px: one screen px at play zoom, two at the catch's 2x (one density). */
const cellOf = (d: number): number => Math.max(1, Math.round(d));
/** The ordered-dither threshold on cells of k art px. */
const bay = (x: number, y: number, k: number): number => bayer4(Math.floor(x / k), Math.floor(y / k));

/** A level-1 px square at a level-1 local point (a bead is the same size at every zoom). */
function dot(c: PaintCtx, x: number, y: number, col: number): void {
  const X = Math.floor(c.X(x)), Y = Math.floor(c.Y(y)), n = cellOf(c.d);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) c.buf.set(X + i, Y + j, col);
}

/**
 * A bead of water `len` px long hanging at (x, up above the water): a glint on its top, a
 * blue-grey body and a darker tip, so it reads against the pale mist and the dark legs alike.
 */
function bead(c: PaintCtx, x: number, up: number, len: number): void {
  const R = P.range;
  const n = Math.max(1, Math.round(len));
  for (let q = 0; q < n; q++) dot(c, x, WATER - up + q, q === 0 && n > 1 ? P.cloud[0]! : q === n - 1 ? R[6]! : R[5]!);
}

/**
 * The far half of a flattened ring on the water (above the waterline), broken into arcs: `keep`
 * is the share of its arcs still standing (it breaks up as it opens and fades), never dithered.
 * A crest over a darker row (the ripple's face mirroring the land): it reads on the pale mist
 * above the line and, mirrored by the lake, on the water below it. Hidden behind the legs.
 */
function paintRing(c: PaintCtx, legs: Leg[], cx: number, rx: number, ry: number, keep: number, seed: number, crest: number, under: number): void {
  const b = c.buf, d = c.d;
  if (keep <= 0 || rx <= 0.5) return;
  const steps = Math.max(24, Math.ceil(rx * d * 4));
  const nArc = 5 + Math.round(rx / 9);
  let lastX = NaN, lastY = NaN;
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI + (k / steps) * Math.PI;
    const lx = cx + Math.cos(a) * rx, up = -Math.sin(a) * ry;
    const X = Math.floor(c.X(lx)), Y = Math.floor(c.Y(WATER - up));
    if (X === lastX && Y === lastY) continue;
    lastX = X; lastY = Y;
    // (arcs of their own lengths: a ring is never a perfect line on real water)
    const arc = Math.floor((k / steps) * nArc + 0.6 * hash1(Math.floor((k / steps) * nArc), seed + 3));
    if (hash1(arc, seed) >= keep) continue;
    if (inLeg(legs, lx, up, 0.5)) continue;
    b.set(X, Y, crest);
    if (up > 0.6 && !inLeg(legs, lx, up - 1 / d, 0.5)) b.set(X, Y + cellOf(d), under);
    // (a fresh ring stands a px taller: its crest two cells thick)
    if (keep > 0.8 && up > 1.6 && !inLeg(legs, lx, up + 1 / d, 0.5)) b.set(X, Y - cellOf(d), crest);
  }
}

/** Mist lobes: [drift phase, x, base height above the water, half length, height] (level-1 px, local). */
function lobesOf(seed: number): [number, number, number, number, number][] {
  return cached(`wadelobes2|${seed}`, () => {
    const out: [number, number, number, number, number][] = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const v = hash1(i, seed + 63);
      // (most lie on the water; a few float a little higher; sizes very different)
      const hi = hash1(i, seed + 62);
      out.push([
        (i + 0.6 * hash1(i, seed + 60)) / n,
        -330 + 520 * ((i * 0.618 + hash1(i, seed + 61) * 0.3) % 1),
        hi < 0.6 ? 3 + 9 * hi : 12 + 16 * (hi - 0.6) / 0.4,
        v < 0.3 ? 46 + 34 * hash1(i, seed + 64) : 18 + 22 * hash1(i, seed + 64),
        (v < 0.3 ? 5 + 4 * hash1(i, seed + 65) : 3 + 3 * hash1(i, seed + 65)) * (hi < 0.6 ? 1 : 0.55),
      ]);
    }
    return out;
  });
}

/** A lobe's top at a (-1..1 along it): two or three humps of different widths and heights. */
function humpAt(a: number, i: number, seed: number): number {
  let h = 0;
  const n = 2 + Math.floor(hash1(i, seed + 70) * 2);
  for (let j = 0; j < n; j++) {
    const at = -0.6 + 1.2 * ((j + 0.2 + 0.6 * hash1(i * 7 + j, seed + 71)) / n);
    const w = 0.22 + 0.35 * hash1(i * 7 + j, seed + 72);
    const hh = 0.45 + 0.55 * hash1(i * 7 + j, seed + 73);
    const q = (a - at) / w;
    if (q > -1 && q < 1) h = Math.max(h, hh * Math.sqrt(1 - q * q));
  }
  return h;
}

function paintWade(c: PaintCtx, p: WadeP): void {
  const b = c.buf, d = c.d, seed = c.seed, K = cellOf(d);
  const sub = Math.max(1, Math.round(p.sub ?? 4));
  const fr = Math.max(0, Math.floor(p.frame ?? 0));
  const f = Math.floor(fr / sub) % STRIDE, s = fr % sub;
  // continuous time in Walker frames (for rings and drops), and how far back to paint
  const tt = f + s / sub;
  const shift = -(s / sub) * STEP;
  const legs = legsOf(f, shift);
  const C = P.cloud, J = P.jade, R = P.range;
  const loop = (fr / (STRIDE * sub)) * Math.PI * 2;
  // (the water's own px, world-fixed: the crests stay put on the lake while it wades on)
  const world = tt * STEP;

  // --- the wet shins: wetted high by the footfall's splash, drying back down to the wading line
  // over a few frames; the top wanders, one cell of dither where wet meets dry; a broken sheen
  // down the lit (west) edge; darkest right at the water
  for (const L of legs) {
    const age = L.age + s / sub;
    const base = 7 + 5 * hash1(L.id, seed + 21);
    const splashH = 26 * Math.exp(-age / 2.2);
    const top = base + splashH * 1.2 + 3;
    const Y0 = Math.max(b.oy, Math.floor(c.Y(WATER - top))), Y1 = Math.min(b.y1, Math.ceil(c.Y(WATER)));
    for (let Y = Y0; Y < Y1; Y++) {
      const up = WATER - c.ly(Y + 0.5);
      if (up < 0) continue;
      const e = edgesAt(L, up);
      if (!e) continue;
      for (let X = Math.max(b.ox, Math.ceil(c.X(e[0] + 0.6))); X < Math.min(b.x1, Math.floor(c.X(e[1] - 0.6))); X++) {
        const lx = c.lx(X + 0.5);
        const mk = base + splashH * (0.5 + 0.7 * vnoise1(lx / 16, seed + L.id + 13)) + 2.5 * (vnoise1(lx / 7, seed + L.id + 17) - 0.5);
        if (up > mk) continue;
        if (up > mk - 1.2 && bay(X, Y, K) >= 0.5) continue;
        if (lx - e[0] < 2.4 && up > 2 && vnoise1((WATER - up) / 3 + lx * 0.3, seed + L.id + 19) > 0.45) { b.set(X, Y, P.karst[6]!); continue; }
        const foot = 2 + 2.2 * vnoise1(lx / 5, seed + L.id + 18);
        b.set(X, Y, up < foot ? P.lacquer[4]! : vnoise(lx / 2.2, up / 6, seed + L.id + 23) > 0.7 ? P.karst[8]! : P.lacquer[3]!);
      }
    }
  }

  // --- the wake: from each planted leg's trailing (west) edge a V trails back, its far arm
  // painted (the lake mirrors it into the near one): two or three broken crest lines, the
  // longest from the rearmost leg, their dashes of their own lengths, sparser as they fade
  let rear = Infinity;
  for (const L of legs) rear = Math.min(rear, L.prof[0]![0]);
  for (const L of legs) {
    const back = L.prof[0]![0];
    const main = back === rear;
    const arms: [number, number, number][] = main ? [[230, 0.075, 0], [150, 0.042, 7], [90, 0.11, 13]] : [[100, 0.07, 3]];
    for (const [len, slope, s0] of arms) {
      let lastX = NaN;
      for (let u = 0; u < len; u += 0.5 / d) {
        const x = back - 3 - u;
        const k = u / len;
        const y = WATER - 0.8 - u * slope - Math.sin(u / 23 + s0 + L.id) * 0.7 * k;
        // dashes of 3 to 9 px with gaps, laid on the water (world-fixed), fewer as it fades
        const w = u + world;
        const cell = Math.floor(w / 11);
        const into = w - cell * 11;
        if (into > 3 + 6 * hash1(cell, seed + s0 + 70)) continue;
        if (hash1(cell, seed + s0 + 71) > (1 - k) * (main ? 1.05 : 0.8)) continue;
        const X = Math.floor(c.X(x)), Y = Math.floor(c.Y(y));
        if (X === lastX) continue;
        lastX = X;
        if (inLeg(legs, x, WATER - y, 1)) continue;
        b.set(X, Y, k < 0.35 ? C[0]! : C[1]!);
        if (k < 0.75) b.set(X, Y + K, k < 0.4 ? J[3]! : J[2]!);
      }
    }
  }

  // --- rings: two or three from each footfall, opening and breaking up over four to six
  // frames, eased out; a planted leg laps a faint one every few frames
  for (const L of legs) {
    const [x0, x1] = L.prof[0]!;
    const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const age = L.age + s / sub;
    for (let k = 0; k < 3; k++) {
      const born = k * 0.7, life = 4.4 + k * 0.7;
      const u = (age - born) / life;
      if (u < 0 || u >= 1) continue;
      const rx = hw * 1.05 + (40 + hw * 1.3) * (1 - Math.pow(1 - u, 2.2));
      paintRing(c, legs, cx, rx, Math.max(1.5, rx * 0.11), Math.pow(1 - u, 1.1) * (1 - 0.15 * k), seed + L.id * 7 + k * 10, u < 0.35 ? C[0]! : C[1]!, u < 0.45 ? J[4]! : J[3]!);
    }
    if (age > 4.5) {
      const u = (((age - 4.5) % 3.2) + 3.2) % 3.2 / 3.2;
      const rx = hw * 1.08 + (14 + hw * 0.45) * (1 - Math.pow(1 - u, 2));
      paintRing(c, legs, cx, rx, Math.max(1.2, rx * 0.1), 0.75 * (1 - u), seed + L.id * 7 + 99 + Math.floor((age - 4.5) / 3.2), C[1]!, J[2]!);
    }
  }

  // --- each planted leg: the landing (a boil and a crown of beads), the parted water
  for (const L of legs) {
    const [x0, x1] = L.prof[0]!;
    const hw = (x1 - x0) / 2;
    const age = L.age + s / sub;
    if (age < 1.6) {
      // a crown of beads thrown up as it lands, falling back (some in front of the shin)
      const n = Math.round(9 + hw * 0.35);
      const tA = age / 1.6;
      for (let i = 0; i < n; i++) {
        const side = hash1(i, seed + L.id + 3) < 0.5 ? -1 : 1;
        const vx = side * (0.3 + 1.1 * hash1(i, seed + L.id + 5)) * (hw * 0.35 + 6);
        const vy = 12 + 22 * hash1(i, seed + L.id + 7);
        const x = (side < 0 ? x0 : x1) + vx * tA;
        const up = vy * 4 * tA * (1 - tA);
        if (up < 1) continue;
        if (hash1(i, seed + L.id + 9) < 0.5 && inLeg(legs, x, up)) continue;
        bead(c, x, up, tA < 0.5 ? 2 : 3);
      }
    }
    if (age < 2.6) {
      // the boil: white water heaped round the hoof as it lands, settling (torn, no dither)
      const k = age / 2.6;
      for (let lx = x0 - 8; lx < x1 + 10; lx += 0.5 / d) {
        const hh = (1.2 + 3.8 * vnoise1(lx / 4 + age, seed + L.id) + (lx > x1 ? 1.5 : 0)) * (1 - k) * Math.min(1, (lx - x0 + 9) / 5, (x1 + 11 - lx) / 6);
        if (hh < 0.6) continue;
        for (let up = 0; up < hh; up += 0.5 / d) {
          if (inLeg(legs, lx, up, 0) && up > 1.5) continue;
          const X = Math.floor(c.X(lx)), Y = Math.floor(c.Y(WATER - up));
          b.set(X, Y, up > hh - 1.1 ? C[0]! : up < 1 ? J[1]! : C[1]!);
        }
      }
    }
    // the lens of parted water piled against its leading (east) side: 1 to 2 px, paler than the
    // lake, tapering away from the shin, a little swell and fall as it wades
    const lens = 9 + hw * 0.3;
    const hgt = 2.2 + 0.4 * Math.sin(loop * 3 + L.id);
    for (let lx = x1 - 0.5; lx < x1 + lens; lx += 0.5 / d) {
      const t = (lx - x1) / lens;
      const hh = hgt * Math.pow(1 - Math.max(0, t), 1.15);
      if (hh < 0.5) continue;
      const X = Math.floor(c.X(lx));
      for (let up = 0; up < hh; up += 0.5 / d) {
        const Y = Math.floor(c.Y(WATER - up));
        b.set(X, Y, up > hh - 1 ? (t < 0.55 ? C[0]! : C[1]!) : J[1]!);
      }
    }
    // (the water climbing the shin's leading edge a px or two)
    for (let up = 0; up < 2.5; up += 0.5 / d) {
      const e = edgesAt(L, up);
      if (e) dot(c, e[1] - 0.5, WATER - up, up > 1.4 ? C[1]! : C[0]!);
    }
    // the trough under its trailing side: a dark sliver, broken where it ends
    for (let lx = x0 - 11; lx < x0 + 2; lx += 0.5 / d) {
      const t = (x0 + 2 - lx) / 13;
      if (t > 0.6 && hash1(Math.floor(lx / 2), seed + L.id + 16) < t) continue;
      b.set(Math.floor(c.X(lx)), Math.floor(c.Y(WATER - 0.4)), J[5]!);
    }
  }

  // --- a hoof lifted clear of the water: its wet band drying from the top down, water clinging
  // along its sole as beads, and beads falling from it (eased in by gravity, stretching as they
  // fall), each breaking into a small ring where it lands
  for (const [xa, ua, xb, ub, age0] of LIFT[f] ?? []) {
    const age = age0 + s / sub;
    const wet = clamp(1 - age / 12, 0, 1);
    if (wet <= 0) continue;
    const sole = (k: number): [number, number] => [xa + (xb - xa) * k, ua + (ub - ua) * k];
    // the wet band above the sole (inside the hoof: inset as it rises)
    const wh = 14 * Math.exp(-age / 3.2);
    if (wh > 1) {
      for (let X = Math.max(b.ox, Math.floor(c.X(xa))); X < Math.min(b.x1, Math.ceil(c.X(xb))); X++) {
        const lx = c.lx(X + 0.5);
        const su = ua + (ub - ua) * ((lx - xa) / (xb - xa));
        const mk = wh * (0.55 + 0.7 * vnoise1(lx / 6, seed + 41));
        for (let Y = Math.floor(c.Y(WATER - su - mk)); Y < Math.floor(c.Y(WATER - su)); Y++) {
          const a = WATER - c.ly(Y + 0.5) - su;
          if (a < 0.6) continue;
          const inset = 1.6 + 0.4 * a;
          if (lx < xa + inset || lx > xb - inset) continue;
          if (a > mk - 1.2 && bay(X, Y, K) >= 0.5) continue;
          b.set(X, Y, lx < xa + inset + 1.6 && a > 1.5 ? P.karst[6]! : a < 2.2 ? P.lacquer[4]! : P.lacquer[3]!);
        }
      }
    }
    // beads clinging along the sole, fewer as it drains (they hide its cut edge)
    for (let k = 0.04; k < 0.97; k += 0.035 + 0.07 * hash1(Math.round(k * 1000), seed + 49)) {
      const kk = Math.round(k * 1000);
      if (hash1(kk, seed + 51) > 0.2 + 0.55 * wet) continue;
      const [sx, su] = sole(k + (hash1(kk, seed + 50) - 0.5) * 0.03);
      bead(c, sx, su - 0.5, 1 + Math.round(2 * hash1(kk, seed + 52) * wet));
    }
    // falling beads: streams along the sole, each dropping a bead now and then (often as it
    // leaves the water, then ever less); several of a stream's beads in flight at once
    const nS = age < 1.5 ? 7 : age < 4 ? 5 : age < 8 ? 3 : 2;
    for (let i = 0; i < nS; i++) {
      const k = age < 1.5 ? (i + 0.5) / nS + (hash1(i, seed + 53 + age0) - 0.5) * 0.12 : 0.1 + 0.8 * hash1(i, seed + 53 + age0);
      const [sx, su] = sole(k);
      const fall = 0.35 + su / 110;
      const per = (age < 1.5 ? 0.4 : 0.7) + 0.4 * hash1(i, seed + 56);
      const off = hash1(i, seed + 55) * per;
      const ringT = 0.9;
      for (let j = 0; j < 4; j++) {
        const e = ((((tt + off) % per) + per) % per) + j * per;
        // (no bead from before it left the water)
        if (e > age + 0.3) break;
        if (e < fall) {
          const g = e / fall;
          const up = su * (1 - g * g);
          if (up > 0.8) bead(c, sx + (hash1(i * 5 + j, seed + 57) - 0.5) * 1.5, up, 2 + 2 * g);
          continue;
        }
        const le = (e - fall) / ringT;
        if (le >= 1) continue;
        // where it lands: a fleck of white, then a small ring opening and breaking up
        if (le < 0.18) dot(c, sx, WATER - 1, C[0]!);
        const rx = 1.5 + (7 + su / 14) * Math.pow(le, 0.6);
        paintRing(c, legs, sx, rx, Math.max(1, rx * 0.18), 1.05 - le * 0.9, seed + i * 13 + j + Math.floor(tt / per) * 7, le < 0.4 ? C[0]! : C[1]!, J[3]!);
      }
    }
  }

  if (p.mist === false) return;
  // --- mist: soft lobes lying on the water and drifting back past the legs as it wades on (each
  // grows and dissolves as it goes, never by checker), in front of the legs and between them:
  // humped on top, flat below; over a dark leg a paler blue-grey (a value lift), over the pale
  // ground a cool white; a lit cap along the sunward humps; one cell of dither only where a lobe
  // meets what is behind it
  const T = (fr % (STRIDE * sub)) / (STRIDE * sub);
  const X0 = Math.max(b.ox, Math.floor(c.X(-400))), X1 = Math.min(b.x1, Math.ceil(c.X(230)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(WATER - 44))), Y1 = Math.min(b.y1, Math.ceil(c.Y(WATER)));
  const lobes = lobesOf(seed).map(([p0, x, base, hl, ht], i) => {
    const u = (T + p0) % 1;
    const g = Math.pow(Math.sin(Math.PI * u), 0.6);
    return { cx: x + 40 - 95 * u, base: base + 3 * u, hl: hl * (0.6 + 0.4 * g), ht: ht * g, i, u };
  });
  for (let Y = Y0; Y < Y1; Y++) {
    const up = WATER - c.ly(Y + 0.5);
    for (let X = X0; X < X1; X++) {
      const lx = c.lx(X + 0.5);
      let edge = -1, lit = false;
      for (const o of lobes) {
        if (o.ht < 1) continue;
        const a = (lx - o.cx) / o.hl;
        if (a <= -1 || a >= 1) continue;
        const env = 1 - a * a;
        const topH = o.ht * Math.max(env * 0.3, humpAt(a, o.i, seed)) * (0.85 + 0.3 * vnoise1(lx / 4 + o.i * 3, seed + 66));
        const botH = Math.min(o.base, 0.6 + o.ht * 0.18 * env * (0.6 + 0.8 * vnoise1(lx / 11 + o.i, seed + 68)));
        const v = up - o.base;
        if (v > topH || v < -botH || topH < 0.8) continue;
        // (torn at its ends)
        if (Math.abs(a) > 0.6 && vnoise(lx / 5 + o.i * 5, up / 2.5, seed + 69) < (Math.abs(a) - 0.6) * 1.6) continue;
        edge = Math.min(topH - v, v + botH, (1 - Math.abs(a)) * o.hl * 0.25);
        lit = v > topH - Math.max(1.2, topH * 0.4) && lx < o.cx + o.hl * 0.25;
        break;
      }
      if (edge < 0) continue;
      if (edge * d < K * 1.1 && bay(X, Y, K) >= 0.5) continue;
      const over = inLeg(legs, lx, up, 0);
      // (over a leg only its thickest part lifts the value: thin lobes there tear open)
      if (over && edge * d < K * 2.2 && bay(X + 1, Y, K) >= 0.5) continue;
      b.set(X, Y, over ? R[6]! : lit ? C[2]! : C[3]!);
    }
  }
}

/** A paint context scaled about the anchor by k (the whole painter drawn at k times its size). */
function scaled(c: PaintCtx, k: number): PaintCtx {
  if (k === 1) return c;
  return { ...c, d: c.d * k, X: (v) => c.X(v * k), Y: (v) => c.Y(v * k), lx: (v) => c.lx(v) / k, ly: (v) => c.ly(v) / k };
}

export const wade = definePainter<WadeP>("op.wade", {
  bounds(p) {
    const k = p.scale ?? 1;
    return [-560 * k, (WATER - 96) * k, 260 * k, (WATER + 4) * k];
  },
  paint(c, p) {
    paintWade(scaled(c, p.scale ?? 1), p);
  },
});

/** What the Walker's placement needs to follow it: its plane, motion, size and haze (kagami-place.ts WALKER). */
export interface WalkerMotion { plane: PlaneId; x: number; y: number; frames: number; fps: number; path: readonly [number, number]; speed: number; stepMove: boolean; scale: number; fade: number }

/**
 * Kagami's wading contact as sprites following the Walker (kagami-backdrop.ts kagamiWade): the
 * same plane, x, y, path, speed and stepMove, four sprite frames to each of its frames.
 */
export function wadeSprites(b: WorldBuilder, w: WalkerMotion, seed: (n: number) => number): void {
  const sub = 4;
  // (far off, the fog banks lie round its legs: no mist lobes of its own)
  b.sprite({ id: "walker-wade", plane: w.plane, kind: "op.wade", x: w.x, y: w.y, p: { sub, scale: w.scale, mist: w.scale >= 1 }, frames: STRIDE * sub, fps: w.fps * sub, path: [w.path[0], w.path[1]], speed: w.speed, stepMove: w.stepMove, fade: w.fade, seed: seed(1) });
  // (round 4: the clump of cloud pillows wrapped round its body is gone; the low cloud deck it
  // wades through is the sky's own cloud family, kagami-backdrop.ts)
}

// Kagami's wading Walker: what its legs do to the still lake and the mist lying on it (art: the
// Kagami art loop, painter p1). The Walker itself is the Walker lane's render and is never
// redrawn here. This sprite stands on the same plane (P2), shares its path, speed, stepMove and
// stride, and is drawn right after it, so it moves in lockstep and knows where each leg is.
//
// - Rings: every footfall (a leg entering the water) throws rings that open over about 1.5 s,
//   eased out, thinning by dither as they widen. Only their far halves are painted (above the
//   waterline; the nearer water slice covers anything below it) and the lake mirrors them, so
//   each ring reads whole. A planted leg keeps lapping a faint ring now and then.
// - The splash: a crown of drops thrown up as the hoof lands, falling back.
// - The meniscus: water climbs each planted shin and piles up on its leading side.
// - Wet shins: a darker wet zone up each shin with a bright 1 px water mark at its top, a sheen
//   down the lit edge, and drips sliding down from the mark.
// - The wake: a V trailing behind the rearmost leg (its far arm; the lake mirrors the other).
// - Mist torn round the legs: low wisps lying on the water in front of the shins, parted where
//   each leg stands and curling off its trailing side, churning slowly.
//
// Frames: the Walker's stride is 24 frames at 2.4 fps; this sprite runs `sub` frames to each of
// its (9.6 fps by default), so rings and drops move smoothly while the legs stay put. In its
// sub-frame s the sprite has already moved s/sub of a step ahead of the Walker (stepMove), so it
// paints that much further back.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm, hash, hash1, vnoise, vnoise1 } from "../../raster.ts";
import type { WorldBuilder } from "../../../world/build.ts";

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

/** 0, 0.125, 0.25 or 0.5: the three dissolve steps for a coverage. */
const step3 = (cov: number): number => (cov > 0.62 ? 0.5 : cov > 0.38 ? 0.25 : cov > 0.17 ? 0.125 : 0);

/** Sets a level-1 local point (if it is in this buffer). */
function dot(c: PaintCtx, x: number, y: number, col: number): void {
  c.buf.set(Math.floor(c.X(x)), Math.floor(c.Y(y)), col);
}

function paintWade(c: PaintCtx, p: WadeP): void {
  const b = c.buf, d = c.d, seed = c.seed;
  const sub = Math.max(1, Math.round(p.sub ?? 4));
  const fr = Math.max(0, Math.floor(p.frame ?? 0));
  const f = Math.floor(fr / sub) % STRIDE, s = fr % sub;
  // continuous time in Walker frames (for rings and drops), and how far back to paint
  const tt = f + s / sub;
  const shift = -(s / sub) * STEP;
  const legs = legsOf(f, shift);
  const C = P.cloud, J = P.jade;
  const loop = (fr / (STRIDE * sub)) * Math.PI * 2;

  // --- the wake: from each planted leg's trailing (west) edge a V trails back, its far arm
  // painted (the lake mirrors it into the near one), broken into crests that slide back and
  // fade; the rearmost leg's the longest
  let rear = Infinity;
  for (const L of legs) rear = Math.min(rear, L.prof[0]![0]);
  for (const L of legs) {
    const back = L.prof[0]![0];
    const main = back === rear;
    for (const [len, slope, s0] of (main ? [[240, 0.06, 0], [140, 0.03, 7]] : [[110, 0.07, 3]]) as [number, number, number][]) {
      for (let u = 0; u < len; u += 0.5 / d) {
        const x = back - 4 - u;
        const k = u / len;
        const y = WATER - 1.2 - u * slope - Math.sin(u / 23 + s0 + L.id) * 0.6 * k;
        // crests every few px, sliding back as the Walker moves on; gaps between groups of them
        const crest = ((u + tt * STEP * 1.4 + s0) % 11 + 11) % 11;
        if (crest > 6.5 || vnoise1((u + tt * STEP * 1.4) / 28, seed + L.id + s0) < 0.32) continue;
        const X = Math.floor(c.X(x)), Y = Math.floor(c.Y(y));
        if (bayer4(X, Y) >= (1 - k) * (main ? 0.95 : 0.7)) continue;
        if (inLeg(legs, x, WATER - y, 1)) continue;
        b.set(X, Y, crest < 2.5 ? C[0]! : C[1]!);
        if (bayer4(X, Y + 1) < (1 - k) * 0.8) b.set(X, Y + 1, J[3]!);
      }
    }
  }

  // --- rings: two or three from each footfall, opening over about 1.5 s; a planted leg laps
  for (const L of legs) {
    const [x0, x1] = L.prof[0]!;
    const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const age = L.age + s / sub;
    const rings: [number, number][] = [];
    for (let k = 0; k < 3; k++) rings.push([k * 0.6, 3.6 + k * 0.4]);
    // (while it stands, two slow rings always lapping out from it)
    const lap = (age - 4) % 6;
    for (const [born, life] of rings) {
      const u = (age - born) / life;
      if (u < 0 || u >= 1) continue;
      paintRing(c, legs, cx, hw * 1.05 + (34 + hw * 0.7) * (1 - Math.pow(1 - u, 2.2)), u, seed + L.id * 7 + born * 10, 1);
    }
    if (age > 4) for (const o of [0, 3]) {
      const u = (((lap + o) % 6) + 6) % 6 / 6;
      paintRing(c, legs, cx, hw * 1.08 + (14 + hw * 0.45) * (1 - Math.pow(1 - u, 2)), u, seed + L.id * 7 + 99 + o, 0.8);
    }
  }

  // --- each planted leg: the splash, the meniscus, the wet shin
  for (const L of legs) {
    const [x0, x1] = L.prof[0]!;
    const hw = (x1 - x0) / 2;
    const age = L.age + s / sub;
    // the splash: a crown of drops thrown up as it lands, falling back (in front and behind)
    if (age < 1.6) {
      const n = Math.round(10 + hw * 0.5);
      for (let i = 0; i < n; i++) {
        const side = hash1(i, seed + L.id + 3) < 0.5 ? -1 : 1;
        const vx = side * (0.3 + 1.1 * hash1(i, seed + L.id + 5)) * (hw * 0.35 + 6);
        const vy = 14 + 22 * hash1(i, seed + L.id + 7);
        const tA = age / 1.6;
        const x = (side < 0 ? x0 : x1) + vx * tA;
        const up = vy * 4 * tA * (1 - tA);
        if (up < 0.5) continue;
        const front = hash1(i, seed + L.id + 9) < 0.5;
        if (!front && inLeg(legs, x, up)) continue;
        dot(c, x, WATER - up, tA < 0.5 ? C[0]! : C[1]!);
      }
      // the sheet of water skirting the hoof just as it lands
      if (age < 0.6) {
        for (let lx = x0 - 6; lx < x1 + 6; lx += 0.5 / d) {
          const hh = (3 + 5 * vnoise1(lx / 4, seed + L.id)) * (1 - age / 0.6);
          for (let up = 0; up < hh; up += 0.5 / d) {
            const X = Math.floor(c.X(lx)), Y = Math.floor(c.Y(WATER - up));
            if (bayer4(X, Y) < 0.5) b.set(X, Y, up > hh - 1.2 ? C[0]! : C[1]!);
          }
        }
      }
    }
    // the water parting round the shin: on its leading (east) side a low smooth mound of water
    // piled against it with a pale crest; on its trailing side a trough dipping under its back
    // edge; across the shin itself only a broken bright line where the water laps it (no film)
    const wob = Math.sin(loop * 3 + L.id) * 0.7;
    const bh = (3.2 + hw * 0.06) * (1 + 0.15 * Math.sin(loop * 2 + L.id * 1.7)), blen = 16 + hw * 0.4;
    for (let lx = x1 - 1; lx < x1 + blen; lx += 0.5 / d) {
      const t = (lx - x1) / blen;
      const hh = bh * Math.pow(1 - Math.max(0, t), 1.6) + wob * (1 - t) + 0.6 * (vnoise1(lx / 3, seed + L.id + 11) - 0.5);
      for (let up = 0; up < hh; up += 0.5 / d) {
        const X = Math.floor(c.X(lx)), Y = Math.floor(c.Y(WATER - up));
        const top = up > hh - 1 / d;
        // (the crest broken where it curls, brightest against the shin)
        if (top) { if (t < 0.55 || hash1(Math.floor(lx), seed + L.id + 12) < 0.55) b.set(X, Y, t < 0.3 ? C[0]! : C[1]!); continue; }
        b.set(X, Y, up < hh * 0.45 ? J[3]! : J[2]!);
      }
    }
    // the trough behind it: the water drawn down under the back edge, a dark sliver
    for (let lx = x0 - 12; lx < x0 + 3; lx += 0.5 / d) {
      const t = (x0 + 3 - lx) / 15;
      if (bayer4(Math.floor(c.X(lx)), 0) >= 1 - t * 0.5) continue;
      b.set(Math.floor(c.X(lx)), Math.floor(c.Y(WATER - 0.4)), J[5]!);
    }
    // the lapping line across the shin: broken, never a hem of even dashes
    for (let lx = x0 + 1; lx < x1 - 1; lx += 0.5 / d) {
      const X = Math.floor(c.X(lx));
      if (vnoise1(lx / 5 + tt * 0.8, seed + L.id + 14) < 0.45) continue;
      b.set(X, Math.floor(c.Y(WATER - 0.5 - 1.2 * vnoise1(lx / 9, seed + L.id + 15))), C[2]!);
    }
    // the wet shin: darker up to a water mark that wanders and tilts; a sheen down the lit edge
    const wetH = 12 + 18 * hash1(L.id, seed + 21);
    const tilt = (hash1(L.id, seed + 25) - 0.5) * 0.12;
    for (let up = 1.5; up < wetH + 1; up += 0.5 / d) {
      const e = edgesAt(L, up);
      if (!e) break;
      const [a0, a1] = e;
      const Y = Math.floor(c.Y(WATER - up));
      for (let lx = a0 + 1; lx < a1 - 1; lx += 0.5 / d) {
        const X = Math.floor(c.X(lx));
        const mk = wetH + (lx - a0) * tilt + 6 * (vnoise1(lx / 11, seed + L.id + 13) - 0.5);
        if (up > mk) continue;
        // (the mark itself: a dark wet edge, not a pale line)
        if (up > mk - 1 / d) { b.set(X, Y, P.range[6]!); continue; }
        if (lx < a0 + 2) { if (bayer4(X, Y) < 0.5) b.set(X, Y, P.range[4]!); continue; }
        if (up < mk - 3 && vnoise(lx / 1.4, up / 6, seed + L.id + 23) > 0.86) b.set(X, Y, P.range[5]!);
      }
    }
    // drips sliding down from the mark
    for (let i = 0; i < 3; i++) {
      const dx = x0 + 3 + (x1 - x0 - 6) * hash1(i, seed + L.id + 31);
      const ph = ((tt * 1.6 + hash1(i, seed + L.id + 33) * 5) % 5) / 5;
      dot(c, dx, WATER - (wetH - 1) * (1 - ph), C[2]!);
    }
  }

  // --- a hoof lifted clear of the water: water pouring off its sole as it leaves (a sheet,
  // then streams), then dripping ever less as it swings: beads hanging along the sole, drops
  // falling (eased in by gravity) and ringing the water where they land
  for (const [xa, ua, xb, ub, age0] of LIFT[f] ?? []) {
    const age = age0 + s / sub;
    const wet = clamp(1 - age / 12, 0, 1);
    if (wet <= 0) continue;
    const sole = (k: number): [number, number] => [xa + (xb - xa) * k, ua + (ub - ua) * k];
    // beads along the sole (they hide its cut edge)
    for (let k = 0.03; k < 0.98; k += 0.045) {
      const [sx, su] = sole(k);
      if (hash1(Math.round(k * 1000), seed + 51) > 0.35 + 0.5 * wet) continue;
      const blen = 1 + 2 * hash1(Math.round(k * 1000), seed + 52) * wet;
      for (let q = 0; q < blen; q += 0.5 / d) dot(c, sx, WATER - su + 0.5 + q, q > blen - 1 ? C[0]! : C[1]!);
    }
    // streams: as it leaves the water a curtain pouring off most of the sole (it is a hoof
    // tens of metres wide), then two or three ropes of water thinning as it swings, each
    // streaked with foam and breaking up as it falls, with a burst of spray where it lands
    const n = age < 2 ? 4 : age < 6 ? 3 : 2;
    const span = Math.abs(xb - xa);
    for (let i = 0; i < n; i++) {
      const k = age < 2 ? (i + 0.5) / n + (hash1(i, seed + 53 + age0) - 0.5) * 0.12 : 0.12 + 0.76 * hash1(i, seed + 53 + age0);
      const [sx, su] = sole(k);
      const half = age < 2 ? span * (0.5 / n) * (1.15 - age * 0.3) : age < 6 ? 1.6 - age * 0.15 : 0;
      if (half > 0.4) {
        for (let up = su - 0.5; up > 0; up -= 0.5 / d) {
          const fall = (su - up) / su;
          const Y = Math.floor(c.Y(WATER - up));
          const hw = half * (1 - fall * 0.35) + (up < 5 ? (5 - up) * 0.9 : 0);
          for (let lx = sx - hw; lx <= sx + hw; lx += 0.5 / d) {
            const u = (lx - sx) / Math.max(0.5, hw);
            const X = Math.floor(c.X(lx));
            // (streaks of foam falling, gaps opening as it breaks up, ragged at the sides)
            const streak = vnoise(lx / 1.6, up / 5 + tt * 5, seed + 57 + i);
            if (streak < 0.2 + fall * 0.3 + Math.abs(u) * 0.35) continue;
            if (Math.abs(u) > 0.7 && bayer4(X, Y) > 0.5) continue;
            b.set(X, Y, up < 4 ? (bayer4(X, Y) < 0.5 ? C[0]! : C[1]!) : streak > 0.62 ? C[0]! : u > 0.4 ? C[2]! : C[1]!);
          }
        }
      }
      // drops falling and the rings they leave
      const nd = age < 4 ? 3 : 1 + Math.round(wet);
      for (let j = 0; j < nd; j++) {
        const ph = (((tt * 1.8 + j / nd + hash1(i * 7 + j, seed + 55)) % 1) + 1) % 1;
        const up = su * (1 - ph * ph);
        dot(c, sx, WATER - up, C[0]!);
        if (ph > 0.3) dot(c, sx, WATER - up - 1 / d, C[1]!);
        if (ph > 0.82) paintRing(c, legs, sx, 2 + (ph - 0.82) * 50, (ph - 0.82) / 0.18, seed + i * 13 + j, 0.8);
      }
    }
  }

  // --- mist torn round the legs: low wisps on the water, parted at each shin, curling off its
  // trailing side, churning slowly (seamless over the sprite's loop)
  const X0 = Math.max(b.ox, Math.floor(c.X(-380))), X1 = Math.min(b.x1, Math.ceil(c.X(220)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(WATER - 40))), Y1 = Math.min(b.y1, Math.ceil(c.Y(WATER - 1)));
  for (let y = Y0; y < Y1; y++) {
    const up = WATER - c.ly(y + 0.5);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      // lobes along the water, thinning with height, torn by noise that rolls with time
      const ph = Math.cos(loop) * 0.6, ph2 = Math.sin(loop) * 0.6;
      const n = fbm(lx / 34 + ph, up / 7 + ph2, seed + 41, 3);
      let cov = (1 - up / (16 + 22 * vnoise1(lx / 60, seed + 43))) * 1.05 + (n - 0.5) * 1.4;
      // parted where a leg stands; a curl climbing its trailing (west) edge
      for (const L of legs) {
        const e = edgesAt(L, up);
        if (!e) continue;
        // (thinner over a shin, never gone: it drifts in front of the legs too)
        if (lx >= e[0] - 2 && lx < e[1] + 2) cov *= 0.55;
        const cu = (lx - (e[0] - 6)) / 7, cv = (up - 9 - 3 * Math.sin(loop + L.id)) / 6;
        if (cu > -1 && cu < 1 && cv > -1 && cv < 1) cov = Math.max(cov, (1 - cu * cu) * (1 - cv * cv) * (0.55 + 0.35 * vnoise(lx / 3, up / 3, seed + 45)));
      }
      if (lx < -330 || lx > 180) cov *= clamp(lx < -330 ? (lx + 380) / 50 : (220 - lx) / 40, 0, 1);
      if (cov > 0.95 && up > 3) { b.set(x, y, cov > 1.1 ? C[1]! : C[2]!); continue; }
      if (bayer4(x, y) < step3(cov)) b.set(x, y, cov > 0.5 ? C[1]! : C[2]!);
    }
  }
}

/** The far half of a ring on the water round a leg (above the waterline), behind the leg. */
function paintRing(c: PaintCtx, legs: Leg[], cx: number, rx: number, u: number, seed: number, strength: number): void {
  const b = c.buf, d = c.d;
  const ry = Math.max(1.5, rx * 0.17);
  const keep = (1 - u * u) * strength;
  const steps = Math.max(32, Math.ceil(rx * d * 5));
  let lastX = NaN, lastY = NaN;
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI + (k / steps) * Math.PI;
    const lx = cx + Math.cos(a) * rx, up = -Math.sin(a) * ry;
    const X = Math.floor(c.X(lx)), Y = Math.floor(c.Y(WATER - up));
    if (X === lastX && Y === lastY) continue;
    lastX = X; lastY = Y;
    // gaps: a ring is never a perfect line on real water
    if (hash(Math.floor((k / steps) * 13), 1, Math.round(seed)) < 0.2) continue;
    if (bayer4(X, Y) >= keep) continue;
    // (it hugs the shin: the arc crossing a leg is the ring's near side catching the light, and
    // the lake mirrors it in front of the leg's reflection)
    const over = inLeg(legs, lx, up, 0);
    // a light crest over a darker face: the face mirrors the darker land behind, so the ring
    // reads against the pale mist and, mirrored, on the water
    b.set(X, Y, over ? (u < 0.5 ? P.cloud[2]! : P.range[3]!) : u < 0.4 ? P.cloud[0]! : P.jade[2]!);
    if (!over && bayer4(X, Y + 1) < keep) b.set(X, Y + 1, u < 0.5 ? P.jade[4]! : P.jade[3]!);
  }
}

export const wade = definePainter<WadeP>("op.wade", {
  bounds() {
    return [-560, WATER - 64, 260, WATER + 4];
  },
  paint(c, p) {
    paintWade(c, p);
  },
});

export interface ShroudP {
  /** Churn frame (0 .. frames - 1) and how many there are (it loops seamlessly over them). */
  frame?: number;
  frames?: number;
}

/**
 * The low cloud the Walker wades through, wrapped round its upper body (it is several hundred
 * metres tall: its back and shoulders stand in the cloud layer). Torn lenses at the height of
 * its back, its barrel and its belly, densest over the shoulders and the bonsai's foot, thinning
 * by the dissolve steps (25 to 50 %) to wisps at their ends, with gaps so its silhouette still
 * reads; they churn slowly and loop. It pushes the giant back in value: it reads as far off.
 * Anchor: the Walker's (the middle of its frames' foot), facing east. Plane px of P2.
 */
function paintShroud(c: PaintCtx, p: ShroudP): void {
  const b = c.buf, seed = c.seed;
  const n = Math.max(1, p.frames ?? 24);
  const loop = (((p.frame ?? 0) % n) / n) * Math.PI * 2;
  const C = P.cloud;
  // the lenses: [centre x, centre y, half length, half thickness, density]
  const L: [number, number, number, number, number][] = [
    [-90, -438, 250, 50, 1.15],
    [120, -470, 150, 30, 0.85],
    [-40, -318, 300, 34, 0.9],
    [-200, -236, 140, 20, 0.65],
    [190, -262, 110, 18, 0.6],
    // (over the head and the bells hanging from it: the busiest, most saturated part)
    [205, -360, 120, 46, 1.05],
    [215, -205, 80, 26, 0.8],
  ];
  const X0 = Math.max(b.ox, Math.floor(c.X(-400))), X1 = Math.min(b.x1, Math.ceil(c.X(330)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(-540))), Y1 = Math.min(b.y1, Math.ceil(c.Y(-160)));
  const ph = Math.cos(loop) * 0.7, ph2 = Math.sin(loop) * 0.7;
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      let cov = 0;
      for (let i = 0; i < L.length; i++) {
        const [cx, cy, hl, ht, dn] = L[i]!;
        const u = (lx - cx) / hl;
        if (u <= -1 || u >= 1) continue;
        // (each lens wanders and swells along its length, lumpier on top: never a ruled band)
        const mid = cy + (vnoise1(lx / 70, seed + i * 7) - 0.5) * ht * 1.2;
        const th = ht * (0.55 + 0.7 * vnoise1(lx / 45 + i, seed + i * 7 + 1));
        const v = ly < mid ? (mid - ly) / (th * 1.15) : (ly - mid) / (th * 0.8);
        if (v >= 1.4) continue;
        const n2 = fbm(lx / 38 + ph, ly / 14 + ph2, seed + i * 7 + 2, 3) - 0.5;
        cov = Math.max(cov, ((1 - u * u) * (1 - v * v * 0.7) + n2 * 1.3) * dn);
      }
      // (solid only in its thickest cores, over the shoulders; elsewhere the dissolve steps)
      if (cov > 1.02) { b.set(x, y, cov > 1.15 ? C[1]! : C[2]!); continue; }
      const th = cov > 0.7 ? 0.5 : cov > 0.45 ? 0.25 : cov > 0.26 ? 0.125 : 0;
      if (bayer4(x, y) < th) b.set(x, y, cov > 0.6 ? C[1]! : C[2]!);
    }
  }
}

export const shroud = definePainter<ShroudP>("op.shroud", {
  bounds() {
    return [-402, -542, 332, -158];
  },
  paint(c, p) {
    paintShroud(c, p);
  },
});

/** What the Walker's builder placement needs to follow it: its motion (kagami-place.ts WALKER). */
export interface WalkerMotion { x: number; y: number; frames: number; fps: number; path: readonly [number, number]; speed: number; stepMove: boolean }

/**
 * Kagami's wading contact as sprites following the Walker (kagami-backdrop.ts kagamiWade): the
 * same plane, x, y, path, speed and stepMove, four sprite frames to each of its frames.
 */
export function wadeSprites(b: WorldBuilder, w: WalkerMotion, seed: (n: number) => number): void {
  const sub = 4;
  b.sprite({ id: "walker-wade", plane: "mid", kind: "op.wade", x: w.x, y: w.y, p: { sub }, frames: STRIDE * sub, fps: w.fps * sub, path: [w.path[0], w.path[1]], speed: w.speed, stepMove: w.stepMove, seed: seed(1) });
  // the low cloud round its upper body, in lockstep (it churns once over a stride)
  b.sprite({ id: "walker-shroud", plane: "mid", kind: "op.shroud", x: w.x, y: w.y, p: { frames: STRIDE }, frames: STRIDE, fps: w.fps, path: [w.path[0], w.path[1]], speed: w.speed, stepMove: w.stepMove, seed: seed(5) });
}

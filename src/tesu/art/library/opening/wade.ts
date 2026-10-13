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

  // --- the wake: a V trailing behind the rearmost leg (its far arms), crests sliding back
  let rear = Infinity;
  for (const L of legs) rear = Math.min(rear, L.prof[0]![0]);
  if (rear < Infinity) {
    for (const [len, slope, s0] of [[250, 0.06, 0], [150, 0.032, 7]] as const) {
      for (let u = 0; u < len; u += 0.5 / d) {
        const x = rear - 3 - u;
        const k = u / len;
        const y = WATER - 1 - u * slope - Math.sin(u / 23 + s0) * 0.6 * k;
        // crests every few px, sliding back as the Walker moves on
        const crest = ((u + tt * STEP * 1.4 + s0) % 11 + 11) % 11;
        if (crest > 7) continue;
        const X = Math.floor(c.X(x)), Y = Math.floor(c.Y(y));
        if (bayer4(X, Y) >= (1 - k) * 0.9) continue;
        if (inLeg(legs, x, WATER - y, 1)) continue;
        b.set(X, Y, crest < 3 ? C[0]! : C[1]!);
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
    // the meniscus: water climbing the shin, piled up on its leading (east) side
    const wob = Math.sin(loop * 3 + L.id) * 0.8;
    for (let lx = x0 - 16; lx < x1 + 26; lx += 0.5 / d) {
      const on = lx >= x0 && lx < x1;
      let hh: number;
      if (on) hh = 3.5 + 2 * vnoise1(lx / 3, seed + L.id + 11);
      else if (lx >= x1) hh = 8 * Math.pow(1 - (lx - x1) / 26, 1.5) + wob;
      else hh = 5.5 * Math.pow(1 - (x0 - lx) / 16, 1.4);
      for (let up = 0; up < hh; up += 0.5 / d) {
        const X = Math.floor(c.X(lx)), Y = Math.floor(c.Y(WATER - up));
        const top = up > hh - 1.1 / d;
        if (on) {
          // on the shin: a pale film, brightest at its top edge
          if (top) b.set(X, Y, C[1]!);
          else if (bayer4(X, Y) < 0.5) b.set(X, Y, J[2]!);
        } else b.set(X, Y, top ? C[0]! : up < 1.5 ? J[4]! : up < hh * 0.5 ? J[3]! : J[2]!);
      }
    }
    // the wet shin: darker up to the water mark, a sheen down its lit edge, drips
    const wetH = 12 + 18 * hash1(L.id, seed + 21);
    const tilt = (hash1(L.id, seed + 25) - 0.5) * 0.12;
    for (let up = 1.5; up < wetH + 1; up += 0.5 / d) {
      const e = edgesAt(L, up);
      if (!e) break;
      const [a0, a1] = e;
      const Y = Math.floor(c.Y(WATER - up));
      for (let lx = a0 + 1; lx < a1 - 1; lx += 0.5 / d) {
        const X = Math.floor(c.X(lx));
        // the water mark: uneven and tilted, broken in places
        const mk = wetH + (lx - a0) * tilt + 4 * (vnoise1(lx / 7, seed + L.id + 13) - 0.5);
        if (up > mk) continue;
        if (up > mk - 1 / d) { if (hash(Math.floor(lx / 2), L.id, seed + 15) < 0.6) b.set(X, Y, C[3]!); continue; }
        // a sheen down the lit (west) edge; the odd wet glint lower down
        if (lx < a0 + 2) { if (bayer4(X, Y) < 0.5) b.set(X, Y, P.range[4]!); continue; }
        if (up < mk - 3 && vnoise(lx / 1.4, up / 6, seed + L.id + 23) > 0.86) b.set(X, Y, P.range[5]!);
      }
    }
    // drips sliding down from the mark
    for (let i = 0; i < 3; i++) {
      const dx = x0 + 3 + (x1 - x0 - 6) * hash1(i, seed + L.id + 31);
      const ph = ((tt * 1.6 + hash1(i, seed + L.id + 33) * 5) % 5) / 5;
      dot(c, dx, WATER - (wetH - 1) * (1 - ph), C[1]!);
    }
  }

  // --- mist torn round the legs: low wisps on the water, parted at each shin, curling off its
  // trailing side, churning slowly (seamless over the sprite's loop)
  const X0 = Math.max(b.ox, Math.floor(c.X(-380))), X1 = Math.min(b.x1, Math.ceil(c.X(220)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(WATER - 26))), Y1 = Math.min(b.y1, Math.ceil(c.Y(WATER - 1)));
  for (let y = Y0; y < Y1; y++) {
    const up = WATER - c.ly(y + 0.5);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      // lobes along the water, thinning with height, torn by noise that rolls with time
      const ph = Math.cos(loop) * 0.6, ph2 = Math.sin(loop) * 0.6;
      const n = fbm(lx / 34 + ph, up / 7 + ph2, seed + 41, 3);
      let cov = (1 - up / (10 + 12 * vnoise1(lx / 60, seed + 43))) * 0.9 + (n - 0.5) * 1.3;
      // parted where a leg stands; a curl climbing its trailing (west) edge
      for (const L of legs) {
        const e = edgesAt(L, up);
        if (!e) continue;
        if (lx >= e[0] - 2 && lx < e[1] + 2) cov *= 0.15;
        const cu = (lx - (e[0] - 6)) / 7, cv = (up - 9 - 3 * Math.sin(loop + L.id)) / 6;
        if (cu > -1 && cu < 1 && cv > -1 && cv < 1) cov = Math.max(cov, (1 - cu * cu) * (1 - cv * cv) * (0.55 + 0.35 * vnoise(lx / 3, up / 3, seed + 45)));
      }
      if (lx < -330 || lx > 180) cov *= clamp(lx < -330 ? (lx + 380) / 50 : (220 - lx) / 40, 0, 1);
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

/** What the Walker's builder placement needs to follow it: its motion (kagami-place.ts WALKER). */
export interface WalkerMotion { x: number; y: number; frames: number; fps: number; path: readonly [number, number]; speed: number; stepMove: boolean }

/**
 * Kagami's wading contact as sprites following the Walker (kagami-backdrop.ts kagamiWade): the
 * same plane, x, y, path, speed and stepMove, four sprite frames to each of its frames.
 */
export function wadeSprites(b: WorldBuilder, w: WalkerMotion, seed: (n: number) => number): void {
  const sub = 4;
  b.sprite({ id: "walker-wade", plane: "mid", kind: "op.wade", x: w.x, y: w.y, p: { sub }, frames: STRIDE * sub, fps: w.fps * sub, path: [w.path[0], w.path[1]], speed: w.speed, stepMove: w.stepMove, seed: seed(1) });
}

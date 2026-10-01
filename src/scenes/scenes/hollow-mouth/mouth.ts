// B5 Hollow Mouth at the player plane (depth 1), lane reg-b round 1: the
// culvert built into the causeway's headwall, the plain's crust standing on
// something, the platform held up. Authored with the region's painting kit
// (causeway/paint.ts) in the scene's hue-shifted ramps.
//
// - The headwall: the causeway embankment's face behind the stairs and the
//   platform, dressed courses under a coping, a pier at each end. The culvert
//   is cut INTO it: quoined jambs, a segmental arch of voussoirs with a
//   keystone, a reveal lit on its west-facing side and dark on the other, a
//   soffit in shadow, the tunnel going dark with a second ring far in, a
//   threshold stone with the culvert's trickle on it. The gate prop sits in
//   that opening.
// - The plain's crust (the overhang over the shaft): turf and soil in strata
//   lying on the buried structure's roof slab; the slab bears on the west wall
//   and on the stairs' mass, a riveted girder under it and a knee brace at
//   each end, roots coming through its cracks. No sky under it.
// - The platform: a down-stand beam and a riveted lattice column under it,
//   running down the shaft to the street.

import { Pix, fbm, fbm1, hashInt } from "../../engine/index.ts";
import { ashlar, coping, grassCap, known, put, shift, soil, type Ramp } from "../causeway/paint.ts";
import { B5, type Geo } from "./geo.ts";

export interface MouthRows {
  masonry: Ramp;
  concrete: Ramp;
  soil: Ramp;
  grass: Ramp;
  moss: Ramp;
  iron: Ramp;
  rust: Ramp;
  deep: Ramp;
  root: Ramp;
}

/** The culvert's arch: opening half-width, springing and crown (elevation, H). */
export const ARCH = { half: 0.92, spring: 1.8, crown: 2.35, ring: 0.3 };
/** The headwall: x span and top (elevation), the piers. */
export const WALL = { x0: 178.95, x1: 185.8, top: 3.0, pier: 0.55, pierTop: 3.35 };

/** A straight steel member (an I-section seen side-on) from (ax, ay) to (bx, by), px. */
function member(pix: Pix, ax: number, ay: number, bx: number, by: number, w: number, r: MouthRows, seed: number): void {
  const dx = bx - ax,
    dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  const x0 = Math.floor(Math.min(ax, bx) - w),
    x1 = Math.ceil(Math.max(ax, bx) + w),
    y0 = Math.floor(Math.min(ay, by) - w),
    y1 = Math.ceil(Math.max(ay, by) + w);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x - ax,
        py = y - ay;
      const along = (px * dx + py * dy) / len;
      if (along < 0 || along > len) continue;
      const across = px * nx + py * ny;
      if (Math.abs(across) > w / 2) continue;
      const e = across + w / 2;
      // flanges lit on the upper one, the web between, rust running down from the rivets
      let i = e < 1.5 ? 3 : e > w - 1.5 ? 1 : 2;
      if (Math.round(along) % Math.max(6, Math.round(w * 1.6)) === 0 && e > 1.5 && e < w - 1.5) i = 4;
      if (hashInt(Math.round(along) >> 1, 3, seed) < 0.12 && e > w / 2) {
        put(pix, x, y, r.rust, 1);
        continue;
      }
      put(pix, x, y, r.iron, i);
    }
}

/** A riveted girder running level from x0 to x1, its top at row y, depth d px. */
function girder(pix: Pix, x0: number, x1: number, y: number, d: number, r: MouthRows, seed: number): void {
  const fl = Math.max(2, Math.round(d * 0.2));
  const st = Math.max(10, Math.round(d * 2.4));
  for (let x = x0; x < x1; x++)
    for (let k = 0; k < d; k++) {
      let i: number;
      if (k < fl) i = k === 0 ? 4 : 3;
      else if (k >= d - fl) i = k === d - 1 ? 0 : 2;
      else {
        // the web in shadow under the top flange, stiffener plates on a rhythm, rivet heads
        i = k < fl + 2 ? 1 : 2;
        const sx = (x - x0) % st;
        if (sx < 3) i = sx === 0 ? 3 : 2;
        if ((k === fl + 1 || k === d - fl - 2) && (x - x0) % 5 === 2) i = 4;
      }
      // rust bleeding from the bottom flange
      if (k >= fl && hashInt(x >> 1, 7, seed) < 0.1 && k > d * (0.4 + 0.5 * hashInt(x, 8, seed))) {
        put(pix, x, y + k, r.rust, 1);
        continue;
      }
      put(pix, x, y + k, r.iron, i);
    }
}

/**
 * The headwall with the culvert arch built into it, the crust and its supports.
 * Called before the stairs and the platform are drawn (they stand in front of the wall).
 */
export function buildHeadwall(pix: Pix, g: Geo, y0: number, r: MouthRows): void {
  const P = g.P;
  const X = (wx: number): number => g.X(wx);
  const Yr = (wy: number): number => g.LY(g.RY(wy), 1) - y0;
  known(pix, r.masonry, r.concrete, r.soil, r.grass, r.moss, r.iron, r.rust, r.deep, r.root);

  const cx = X(B5.culvertGate);
  const ow = Math.round(P * ARCH.half);
  const spring = Yr(ARCH.spring);
  const crown = Yr(ARCH.crown);
  const rise = spring - crown;
  const R = (ow * ow + rise * rise) / (2 * rise);
  const acy = crown + R;
  const ring = Math.round(P * ARCH.ring);
  const base = Yr(B5.platform);
  const inOpening = (x: number, y: number): boolean => {
    const dx = x - cx;
    if (Math.abs(dx) > ow || y >= base) return false;
    if (y >= spring) return true;
    return Math.hypot(dx, y - acy) <= R;
  };
  const inRing = (x: number, y: number): boolean => {
    if (y >= spring) return false;
    const dd = Math.hypot(x - cx, y - acy);
    return dd > R && dd <= R + ring && Math.abs(x - cx) <= ow + ring;
  };

  // --- the wall: dressed courses under a coping, darker and wetter toward its foot -----------------
  const wx0 = X(WALL.x0),
    wx1 = X(WALL.x1);
  const wtop = Yr(WALL.top);
  const pw = Math.round(P * WALL.pier);
  const ptop = Yr(WALL.pierTop);
  const isPier = (x: number): boolean => x < wx0 + pw || x >= wx1 - pw;
  const course = Math.round(P * 0.24);
  ashlar(pix, {
    x0: wx0,
    x1: wx1,
    top: (x) => (isPier(x) ? ptop + Math.round(P * 0.14) : wtop + Math.round(P * 0.14)),
    bottom: () => base,
    stone: r.masonry,
    course,
    courseVar: 0.2,
    block: [Math.round(P * 0.45), Math.round(P * 0.95)],
    originY: wtop + Math.round(P * 0.14),
    seed: 4101,
    base: 2,
    swing: 1,
    mortar: 0,
    joint: 1,
    light: -1,
    stain: 0.5,
    pits: 0.14,
    cracks: 0.1,
    moss: { ramp: r.moss, amount: 0.2, where: (_x, y) => Math.min(1, Math.max(0, (y - spring) / (base - spring)) * 1.3) },
    clumps: 0.18,
    streaks: { from: () => wtop + Math.round(P * 0.14), amount: 0.1, length: Math.round(P * 0.7) },
    // the piers stand proud: their faces a step lighter, a shadow cast on the wall east of the west pier
    shade: (x, y) => {
      if (isPier(x)) return x === wx0 || x === wx1 - pw ? 1 : 0;
      if (x < wx0 + pw + Math.round(P * 0.1) && y > ptop) return -1;
      return y > base - Math.round(P * 0.3) ? -1 : 0;
    },
  });
  // copings: the wall's and the piers' (a step higher, their own cap stones)
  coping(pix, { x0: wx0 + pw, x1: wx1 - pw, top: () => wtop, h: Math.round(P * 0.14), stone: r.masonry, base: 3, seed: 4103, block: [Math.round(P * 0.8), Math.round(P * 1.4)], drip: 2, moss: { ramp: r.moss, amount: 0.3 } });
  for (const px0 of [wx0, wx1 - pw]) {
    const ov = Math.round(P * 0.05);
    coping(pix, { x0: px0 - ov, x1: px0 + pw + ov, top: () => ptop, h: Math.round(P * 0.14), stone: r.masonry, base: 3, seed: 4105 + px0, block: [pw + ov * 2, pw + ov * 2], drip: 2 });
  }

  // --- quoins up the jambs: long and short blocks in turn, a step lighter, a clean arris --------
  {
    const qh = course;
    for (const side of [-1, 1]) {
      let k = 0;
      for (let y = base - qh; y > spring - qh; y -= qh, k++) {
        const qw = Math.round(P * (k % 2 ? 0.26 : 0.4));
        const a = side < 0 ? cx - ow - qw : cx + ow;
        const b = side < 0 ? cx - ow : cx + ow + qw;
        for (let x = a; x < b; x++)
          for (let yy = Math.max(y, spring); yy < y + qh; yy++) {
            const dy = yy - y;
            let i = 4;
            if (dy === qh - 1 || (side < 0 ? x === a : x === b - 1)) i = 0;
            else if (dy === 0) i = 6;
            else if (dy === 1) i = 5;
            else if (hashInt(x >> 1, yy >> 1, 4107 + k) < 0.06) i = 3;
            put(pix, x, yy, r.masonry, i);
          }
      }
    }
  }

  // --- the arch ring: voussoirs on radial joints, the keystone proud and lit --------------------
  {
    const a0 = Math.atan2(spring - acy, -ow); // the west springing (angle from the centre)
    const a1 = Math.atan2(spring - acy, ow);
    const nV = 9;
    for (let y = crown - ring - Math.round(P * 0.12); y < spring; y++)
      for (let x = cx - ow - ring - 2; x <= cx + ow + ring + 2; x++) {
        const dd = Math.hypot(x - cx, y - acy);
        const key = Math.abs(x - cx) < P * 0.13 && y < crown && y >= crown - ring - Math.round(P * 0.1);
        if (!inRing(x, y) && !key) continue;
        const ang = Math.atan2(y - acy, x - cx);
        const f = (ang - a0) / (a1 - a0);
        const vi = Math.floor(f * nV);
        const fj = f * nV - vi;
        let i = 4 + (hashInt(vi, 1, 4109) < 0.4 ? -1 : 0);
        if (key) {
          i = 5;
          if (y === crown - ring - Math.round(P * 0.1)) i = 6;
          if (Math.abs(x - cx) >= P * 0.13 - 1) i = x < cx ? 6 : 1;
        } else {
          // radial joints, the extrados lit, the intrados edge shaded (the soffit is under it)
          if (fj < 0.06 || fj > 0.97) i = 0;
          else if (dd > R + ring - 1.5) i += 2;
          else if (dd < R + 1.5) i -= 1;
          if (hashInt(x >> 1, y >> 1, 4111) < 0.05) i -= 1;
          // moss low on the haunches
          if (y > spring - P * 0.35 && fbm(x / 6, y / 5, 4113, 2) > 0.62) {
            put(pix, x, y, r.moss, 2 + (hashInt(x, y, 4115) < 0.3 ? 1 : 0));
            continue;
          }
        }
        put(pix, x, y, r.masonry, i);
      }
  }

  // --- the opening: reveal, soffit, the tunnel going dark, a second ring far in, the threshold ---
  {
    const rv = Math.round(P * 0.13);
    const inner = (x: number, y: number, s: number): boolean => {
      const dx = (x - cx) / s;
      if (Math.abs(dx) > ow || y >= base) return false;
      const sy = base - (base - y) / s;
      if (sy >= spring) return true;
      return Math.hypot(dx, sy - acy) <= R;
    };
    for (let y = crown - 2; y < base; y++)
      for (let x = cx - ow; x <= cx + ow; x++) {
        if (!inOpening(x, y)) continue;
        const dx = x - cx;
        const dTop = y < spring ? R - Math.hypot(dx, y - acy) : 1e9;
        if (dTop < rv * 0.7 && y < spring + 2) {
          // the soffit: the arch's underside, in shadow, its voussoir joints faintly
          put(pix, x, y, r.masonry, dTop < 1 ? 0 : 1);
          continue;
        }
        if (dx > ow - rv) {
          // the east reveal faces west, toward the light: lit, its blocks' joints
          const j = (base - y) % course === 0;
          put(pix, x, y, r.masonry, j ? 1 : dx > ow - 1.5 ? 2 : 3);
          continue;
        }
        if (dx < -ow + rv * 0.6) {
          put(pix, x, y, r.masonry, (base - y) % course === 0 ? 0 : 1);
          continue;
        }
        // the tunnel: dark, darker toward its middle; a second ring far in where the bore narrows
        const sNear = inner(x, y, 0.78);
        const sFar = inner(x, y, 0.62);
        let i = sFar ? 0 : sNear ? 1 : 2;
        if (!sNear && hashInt(x >> 1, y >> 1, 4117) < 0.12) i = 1;
        put(pix, x, y, r.deep, i);
      }
    // the threshold stone across the opening, the trickle running over it
    const th = Math.round(P * 0.1);
    for (let x = cx - ow - Math.round(P * 0.08); x <= cx + ow + Math.round(P * 0.08); x++)
      for (let k = 0; k < th; k++) {
        const y = base - th + k;
        const water = Math.abs(x - cx - Math.round(P * 0.1)) < P * 0.24 && k === 0;
        if (water) {
          put(pix, x, y, r.masonry, hashInt(x, 2, 4119) < 0.3 ? 6 : 5);
          continue;
        }
        put(pix, x, y, r.masonry, k === 0 ? 5 : k === th - 1 ? 1 : 3);
      }
    // a wet stain spreading down the wall below each springer
    for (const sx of [cx - ow - Math.round(P * 0.15), cx + ow + Math.round(P * 0.15)])
      for (let y = spring; y < base - th; y++) {
        const wd = Math.round(P * 0.06 + (y - spring) * 0.08);
        for (let x = sx - wd; x <= sx + wd; x++) if (!inOpening(x, y) && hashInt(x >> 1, y >> 1, 4121) < 0.7 && pix.solid(x, y)) shift(pix, x, y, -1);
      }
  }

  // --- the plain's crust on the buried roof slab, over the shaft ------------------------------
  const cEnd = X(179.0);
  const slabTop = Yr(1.05),
    slabBot = Yr(0.55);
  const soilBot = (x: number): number => slabTop + Math.round((fbm1(x / 30, 4123, 2) - 0.5) * 6);
  // the west wall's head (the west-wall layer carries it on down the shaft)
  const westX1 = X(172.9);
  for (let x = 0; x < westX1; x++)
    for (let y = slabBot - 2; y < pix.h; y++) {
      const edge = x >= westX1 - 2;
      const cw = Math.round(P * 0.42);
      const panel = (y - slabBot) % cw === 0;
      let i = edge ? (x === westX1 - 1 ? 1 : 3) : panel ? 1 : 2 + (hashInt(x >> 2, Math.floor((y - slabBot) / cw), 4125) < 0.3 ? 1 : 0);
      if (!edge && hashInt(x, y, 4127) < 0.03) i -= 1;
      put(pix, x, y, r.concrete, i);
    }
  // the slab: cast concrete, a lit arris under the turf, board marks, a dark underside, bites broken out of it
  for (let x = 0; x < cEnd; x++) {
    const bite = hashInt(x >> 3, 1, 4129) < 0.25 ? 1 + Math.floor(hashInt(x >> 3, 2, 4129) * 4) : 0;
    for (let y = slabTop; y < slabBot - bite; y++) {
      const d = y - slabTop;
      let i = d === 0 ? 4 : d === 1 ? 3 : 2;
      if (d > 1 && (y - slabTop) % Math.max(3, Math.round(P * 0.12)) === 0) i = 1;
      if (y >= slabBot - bite - 2) i = 1;
      if (hashInt(x, y, 4131) < 0.04) i += 1;
      put(pix, x, y, r.concrete, i);
    }
  }
  // its cracks, roots coming through them and hanging into the shaft
  for (let j = 0; j < 7; j++) {
    const x = Math.round(westX1 + (cEnd - westX1) * (0.08 + 0.13 * j + 0.05 * hashInt(j, 1, 4133)));
    for (let y = slabTop; y < slabBot; y++) put(pix, x + Math.round(Math.sin(y * 0.4 + j) * 0.8), y, r.concrete, 0);
    if (hashInt(j, 2, 4133) < 0.6) {
      const len = Math.round(P * (0.25 + 0.6 * hashInt(j, 3, 4133)));
      for (let k = 0; k < len; k++) put(pix, x + Math.round(Math.sin(k * 0.18 + j) * 1.6), slabBot + k, r.root, k > len - 3 ? 1 : 2);
    }
  }
  // the girder under it, bearing on the west wall and the stairs' mass
  const gd = Math.round(P * 0.24);
  girder(pix, westX1 - Math.round(P * 0.1), cEnd + Math.round(P * 0.2), slabBot, gd, r, 4135);
  // contact: the slab's shadow on the girder's web, the girder's on the wall head
  for (let x = westX1; x < cEnd; x++) shift(pix, x, slabBot, -1);
  // knee braces from the west wall and from the stairs' mass up to the girder, gusset plates at the joints
  const gb = slabBot + gd;
  const bw = Math.max(5, Math.round(P * 0.11));
  member(pix, westX1 - 1, Yr(-1.25), X(174.5), gb - 1, bw, r, 4137);
  member(pix, X(179.45), Yr(-1.2), X(177.3), gb - 1, bw, r, 4139);
  for (const [gx, gy] of [
    [X(174.5), gb],
    [X(177.3), gb],
    [westX1, Yr(-1.25)],
    [X(179.3), Yr(-1.2)],
  ] as [number, number][]) {
    const s = Math.round(P * 0.09);
    for (let y = gy - s; y < gy + s; y++) for (let x = gx - s; x < gx + s; x++) put(pix, x, y, r.iron, x === gx - s || y === gy - s ? 4 : 2);
    put(pix, gx - 2, gy - 1, r.iron, 4);
    put(pix, gx + 2, gy + 1, r.iron, 4);
  }
  // the soil and turf of the plain on the slab
  soil(pix, {
    x0: 0,
    x1: cEnd,
    top: () => Yr(B5.plain),
    bottom: soilBot,
    earth: r.soil,
    seed: 4141,
    base: 3,
    strata: Math.round(P * 0.16),
    pebbles: { ramp: r.concrete, amount: 0.05, size: 2 },
    roots: { ramp: r.root, amount: 0.04, length: Math.round(P * 0.3) },
    darkPer: 0.03,
  });
  // the soil's contact on the slab: a dark seam
  for (let x = 0; x < cEnd; x++) {
    const sb = soilBot(x);
    if (sb >= slabTop) shift(pix, x, sb, -1);
  }
  grassCap(pix, { x0: 0, x1: cEnd, top: () => Yr(B5.plain), grass: r.grass, seed: 4143, depth: Math.round(P * 0.06), blades: Math.round(P * 0.1), cover: 0.85, lean: 0.35, hang: { drop: Math.round(P * 0.3), length: Math.round(P * 0.35) } });
  void hashInt;
}

/**
 * The stairs down from the plain and the culvert platform, in the headwall's stone: a stepped
 * mass of courses, each tread a slab with a lit nosing and a drip shadow under it, the platform
 * under a coping, its east end broken off over the hook's gap with the rebar showing.
 */
export function buildStairs(pix: Pix, g: Geo, y0: number, r: MouthRows): void {
  const P = g.P;
  const X = (wx: number): number => g.X(wx);
  const Yr = (wy: number): number => g.LY(g.RY(wy), 1) - y0;
  const nSt = Math.ceil((B5.plain - B5.platform) / 0.2 - 1e-6);
  const rise = (B5.plain - B5.platform) / nSt;
  const sx0 = X(B5.stairX);
  const sx1 = X(B5.stairX + 0.3 * nSt);
  const tread = (x: number): number => {
    if (x < sx0) return 1e9;
    if (x >= sx1) return Yr(B5.platform);
    const i = Math.min(nSt - 1, Math.floor((x - sx0) / (X(B5.stairX + 0.3) - sx0)));
    return Yr(B5.plain - rise * (i + 1));
  };
  const bottom = Yr(-1.2);
  const segs: [number, number][] = [
    [sx0, X(B5.platformX[1])],
    [X(B5.lip[0]), X(B5.lip[1])],
  ];
  const th = Math.max(4, Math.round(P * 0.1));
  for (const [a, b] of segs) {
    ashlar(pix, {
      x0: a,
      x1: b,
      top: (x) => tread(x) + th,
      bottom: () => bottom,
      stone: r.masonry,
      course: Math.round(P * 0.24),
      courseVar: 0.2,
      block: [Math.round(P * 0.5), Math.round(P * 1.0)],
      originY: Yr(B5.platform) + th,
      seed: 4171 + a,
      base: 3,
      swing: 1,
      mortar: 0,
      light: -1,
      stain: 0.6,
      pits: 0.14,
      cracks: 0.12,
      moss: { ramp: r.moss, amount: 0.12 },
      clumps: 0.1,
      // darker toward the broken underside, where the shaft's cold air is
      shade: (_x, y) => (y > bottom - Math.round(P * 0.35) ? -1 : 0) + (y > bottom - 3 ? -1 : 0),
    });
    // the underside broken unevenly: bites out of the bottom course
    for (let x = a; x < b; x++) {
      const bite = hashInt(x >> 3, 5, 4173) < 0.3 ? 1 + Math.floor(hashInt(x >> 3, 6, 4173) * 5) : 0;
      for (let k = 1; k <= bite; k++) pix.clear(x, bottom - k);
    }
  }
  // the stairs stand in front of the headwall: the wall in their lee a step darker, a deeper shadow
  // just above each tread
  for (let x = sx0; x < X(B5.platformX[1]); x++) {
    const t = tread(x);
    const lee = Math.round(P * (x < sx1 ? 0.7 : 0.35));
    for (let k = 1; k <= lee; k++) if (pix.solid(x, t - k)) shift(pix, x, t - k, k <= 3 ? -2 : -1);
  }
  // the treads and the platform's coping: slabs with a lit nosing and a drip shadow on the riser below
  coping(pix, { x0: sx0, x1: sx1, top: tread, h: th, stone: r.masonry, base: 3, seed: 4175, block: [X(B5.stairX + 0.3) - sx0, X(B5.stairX + 0.3) - sx0], drip: 2, moss: { ramp: r.moss, amount: 0.12 } });
  for (const [a, b] of [
    [sx1, X(B5.platformX[1])],
    [X(B5.lip[0]), X(B5.lip[1])],
  ] as [number, number][])
    coping(pix, { x0: a, x1: b, top: () => Yr(B5.platform), h: th, stone: r.masonry, base: 3, seed: 4177 + a, block: [Math.round(P * 0.8), Math.round(P * 1.3)], drip: 2 });
  // each step's riser faces east, away from the light: a dark face under the nosing; the nosing lit
  const sw = X(B5.stairX + 0.3) - sx0;
  for (let i = 1; i <= nSt; i++) {
    const xb = sx0 + Math.round(i * sw);
    const tHi = Yr(B5.plain - rise * i),
      tLo = i < nSt ? Yr(B5.plain - rise * (i + 1)) : Yr(B5.platform);
    for (let y = tHi; y < tLo + th; y++) for (let k = 0; k < 2; k++) put(pix, xb - 1 + k, y, r.masonry, y < tHi + th ? 2 - k : k === 0 ? 1 : 0);
  }
  for (let x = sx0; x < sx1; x++) {
    const t = tread(x);
    put(pix, x, t, r.masonry, 6);
    put(pix, x, t + 1, r.masonry, 5);
  }
  // the rebar where the platform broke off over the hook's gap
  const ex = X(B5.platformX[1]);
  for (let j = 0; j < 4; j++) for (let y = Yr(-0.2) + j * 7; y < Yr(-0.2) + j * 7 + 10; y++) put(pix, ex + j * 3 - 2 + Math.round((y % 10) * 0.3), y, r.rust, 1 + (j & 1));
}

/** Under the stairs and the platform: a riveted girder along the mass's underside, where the column bears. */
export function underPlatform(pix: Pix, g: Geo, y0: number, r: MouthRows): void {
  const P = g.P;
  const Yr = (wy: number): number => g.LY(g.RY(wy), 1) - y0;
  const top = Yr(-1.2);
  girder(pix, g.X(179.0), g.X(B5.platformX[1]) - 2, top, Math.round(P * 0.24), r, 4151);
  // the column's cap plate and its two brackets
  const cx = g.X(COLUMN.x);
  const cw = Math.round(P * COLUMN.w);
  const gb = top + Math.round(P * 0.24);
  for (let x = cx - (cw >> 1) - 4; x < cx + (cw >> 1) + 4; x++) for (let k = 0; k < 4; k++) put(pix, x, gb + k, r.iron, k === 0 ? 4 : 2);
}

/** The lattice column down the shaft under the stairs' mass (world x, width in H). */
export const COLUMN = { x: 180.5, w: 0.62 };

/**
 * The lattice column: two riveted chords, zigzag lacing between, batten plates every few metres,
 * a base plate bolted onto a concrete plinth on the street. Its own narrow layer; returns it.
 */
export function buildColumn(g: Geo, r: MouthRows): { pix: Pix; x: number; y: number } {
  const P = g.P;
  const w = Math.round(P * COLUMN.w) + 8;
  const y0 = g.LY(g.RY(-1.2), 1) + Math.round(P * 0.24) + 4;
  const y1 = g.LY(g.RY(B5.street), 1);
  const pix = new Pix(w, y1 - y0);
  known(pix, r.iron, r.rust, r.concrete);
  const ch = Math.max(5, Math.round(P * 0.1));
  const L = 4,
    R = w - 4 - ch;
  const bay = Math.round(P * 0.62);
  const plinth = Math.round(P * 0.3);
  const H = pix.h - plinth;
  for (let y = 0; y < H; y++) {
    // the chords
    for (const c0 of [L, R])
      for (let k = 0; k < ch; k++) {
        let i = k === 0 ? 3 : k === ch - 1 ? 1 : 2;
        if (y % 9 === 4 && (k === 1 || k === ch - 2)) i = 4;
        if (hashInt(c0 + k, y >> 3, 4161) < 0.05) {
          put(pix, c0 + k, y, r.rust, 1);
          continue;
        }
        put(pix, c0 + k, y, r.iron, i);
      }
    // the lacing: a zigzag of flat bars between the chords
    const t = (y % bay) / bay;
    const up = Math.floor(y / bay) % 2 === 0;
    const lx = Math.round(L + ch + (R - L - ch) * (up ? t : 1 - t));
    for (let k = -1; k <= 1; k++) if (lx + k > L + ch - 1 && lx + k < R) put(pix, lx + k, y, r.iron, k < 0 ? 3 : k > 0 ? 1 : 2);
    // batten plates every few metres
    if (y % (bay * 5) < 5) for (let x = L; x < R + ch; x++) put(pix, x, y, r.iron, y % (bay * 5) === 0 ? 4 : 2);
  }
  // the base plate and the plinth
  for (let x = 0; x < w; x++) {
    for (let k = 0; k < 4; k++) put(pix, x, H - 4 + k, r.iron, k === 0 ? 4 : 1);
    for (let y = H; y < pix.h; y++) put(pix, x, y, r.concrete, y === H ? 4 : x === 0 ? 3 : x === w - 1 ? 1 : 2);
  }
  put(pix, 2, H - 2, r.iron, 4);
  put(pix, w - 3, H - 2, r.iron, 4);
  void fbm;
  return { pix, x: g.X(COLUMN.x) - (w >> 1), y: y0 };
}

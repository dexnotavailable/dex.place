// B1's near art at the player plane (depth 1), drawn exactly where the room's
// collision is (reed-shallows/geo.ts), with the region's painting kit
// (causeway/paint.ts):
//
// - the quay stair down from the yard: dressed tread slabs on an ashlar wall
//   that steps down with the flight, moss on the upper courses, rain streaks
//   under every tread, a wet band and an algae line at the water; under the
//   flight, built into the wall, the old boat arch (voussoirs, a keystone, the
//   dark wet vault behind it with the water running in) and two iron mooring
//   rings set in the stone with their rust runs; an iron railing on the far
//   side of the flight, a leading line down to the boardwalk;
// - the boardwalk: plank ends with seams and nail heads, a stringer, posts on
//   a regular bay with braces, wet and weeded where they enter the water, the
//   0.9 H gap with its snapped planks, a stone pier founding the bridge mast on
//   the channel's east bank;
// - the east landing: four tread slabs up a short quay wall to the bank, the
//   bank's soil under a grass cap that spills over the wall's top.
//
// Pixel data only: tone indices of the scene's ramps, lit live by sceneLight().

import { fbm1, hashInt, type Pix } from "../../engine/index.ts";
import { ashlar, coping, grassCap, put, shift, soil, known, type Ramp } from "../causeway/paint.ts";
import { B1, type Geo } from "./geo.ts";

export interface ShoreRows {
  wood: Ramp;
  stone: Ramp;
  moss: Ramp;
  earth: Ramp;
  iron: Ramp;
  algae: Ramp;
  recess: Ramp;
  grass: Ramp;
  rust: Ramp;
}

const STEPS = Math.ceil((B1.yard - B1.deck) / 0.2 - 1e-6);
const RISE = (B1.yard - B1.deck) / STEPS;

/** The embankment's stair: the top of the step at world x (elevation), or NaN off the stair. */
function stairTop(wx: number): number {
  const i = Math.floor((wx - B1.stairX) / 0.3);
  if (wx < B1.stairX || i >= STEPS) return Number.NaN;
  return B1.yard - RISE * (i + 1);
}

export function stairEnd(): number {
  return B1.stairX + 0.3 * STEPS;
}

/** The boat arch under the flight: span and crown in world H. */
export const ARCH = { x0: 78.5, x1: 80.9, crown: 1.45 };

export function buildShore(pix: Pix, g: Geo, x0: number, y0: number, r: ShoreRows): void {
  const P = g.P;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const X = (wx: number): number => g.X(wx) - x0;
  const Y = (wy: number): number => g.Y(wy) - y0;
  const W = (lx: number): number => B1.x0 + (lx + x0 - g.X(B1.x0)) / P;
  known(pix, r.wood, r.stone, r.moss, r.earth, r.iron, r.algae, r.recess, r.grass, r.rust);
  const wl = Y(B1.water);
  const bottom = wl + 3;
  const sEnd = stairEnd();
  const tread = n(0.085);

  // --- the quay stair -------------------------------------------------------------------
  const xa = X(B1.x0) - 10;
  const xs = X(sEnd) + n(0.12);
  /** The flight's surface row per column (the yard's level west of it); the toe slopes into the water. */
  const surf = (lx: number): number => {
    const wx = W(lx);
    if (wx < B1.stairX) return Y(B1.yard);
    const t = stairTop(wx);
    if (!Number.isNaN(t)) return Y(t);
    // past the last step the wall's end: a short battered return into the water under the first planks
    return Y(B1.deck) + Math.round((wx - sEnd) * P * 1.4);
  };
  // the arch: the opening's inner line (crown at ARCH.crown, springing at the water)
  const ax0 = X(ARCH.x0),
    ax1 = X(ARCH.x1),
    acx = (ax0 + ax1) / 2,
    arx = (ax1 - ax0) / 2;
  const crownY = Y(ARCH.crown);
  const ary = wl - crownY;
  const ring = n(0.17);
  const inArch = (lx: number, ly: number, grow = 0): boolean => {
    const dx = (lx - acx) / (arx + grow);
    if (Math.abs(dx) >= 1 || ly > wl + 2) return false;
    return ly >= wl - (ary + grow) * Math.sqrt(1 - dx * dx);
  };
  ashlar(pix, {
    x0: xa,
    x1: xs,
    top: (lx) => surf(lx) + tread,
    bottom: () => bottom,
    stone: r.stone,
    course: n(0.2),
    courseVar: 0.55,
    block: [n(0.3), n(0.7)],
    originY: wl,
    seed: 61,
    base: 2,
    swing: 1,
    light: -1,
    lit: [1, 0, 1, 0, -1],
    pits: 0.12,
    cracks: 0.22,
    stain: 0.55,
    clumps: 0.5,
    moss: { ramp: r.moss, amount: 0.4, where: (lx, ly) => Math.max(0, Math.min(1, 1 - (ly - surf(lx) - tread) / (P * 0.9))) * 0.8 + (ly > wl - P * 0.5 ? 0.3 : 0) },
    streaks: { from: (lx) => surf(lx) + tread + 1, amount: 0.22, length: n(0.7) },
    wet: { y: wl, h: n(0.16), algae: r.algae },
    // the wall darkens a step toward its foot (the yard above shades it from the sky)
    shade: (_lx, ly) => (ly > wl - n(0.6) ? -1 : 0),
    hole: (lx, ly) => inArch(lx, ly, ring),
  });
  // the tread slabs, each its own stone, a lit nosing over the drop to the east
  for (let i = 0; i < STEPS; i++) {
    const a = X(B1.stairX + 0.3 * i),
      b = X(B1.stairX + 0.3 * (i + 1)) + (i < STEPS - 1 ? 2 : 0);
    const t = Y(B1.yard - RISE * (i + 1));
    coping(pix, { x0: a, x1: b, top: () => t, h: tread, stone: r.stone, base: 4, seed: 400 + i, block: [b - a, b - a + 1], light: -1, drip: 3 });
    // the riser face under the nosing of the step above: a step darker (its own shadow)
    if (i > 0) for (let y = Y(B1.yard - RISE * i) + tread; y < t; y++) shift(pix, a, y, -1);
  }
  // the yard's lip: its coping and the grass of the yard spilling over it
  coping(pix, { x0: xa, x1: X(B1.stairX) + 2, top: () => Y(B1.yard), h: tread, stone: r.stone, base: 3, seed: 399, block: [n(0.5), n(0.8)], drip: 2 });
  grassCap(pix, { x0: xa, x1: X(B1.stairX) - 1, top: () => Y(B1.yard), grass: r.grass, seed: 71, depth: 3, blades: n(0.09), cover: 0.9, hang: { drop: 6, length: n(0.2) }, lean: 0.3 });
  // moss and small ferns gathered at the inner corner of each tread (where the damp stays)
  for (let i = 0; i < STEPS; i++) {
    if (hashInt(i, 1, 73) > 0.42) continue;
    const a = X(B1.stairX + 0.3 * i);
    const t = Y(B1.yard - RISE * (i + 1));
    const len = 2 + Math.floor(hashInt(i, 2, 73) * 6);
    for (let k = 0; k < len; k++) {
      const hgt = 1 + Math.floor(hashInt(i, k + 3, 73) * 3) - (k > len - 3 ? 1 : 0);
      for (let j = 1; j <= hgt; j++) put(pix, a + 1 + k, t - j, r.moss, j === hgt ? 4 : 3);
    }
  }
  // the boat arch: voussoirs round the opening, a keystone, the vault dark and wet behind
  {
    const vous = 13;
    for (let ly = crownY - ring - 2; ly <= wl + 2; ly++)
      for (let lx = Math.floor(ax0 - ring - 2); lx <= Math.ceil(ax1 + ring + 2); lx++) {
        const inner = inArch(lx, ly);
        const outer = inArch(lx, ly, ring);
        if (!outer) continue;
        if (inner) {
          // the vault: darkest at the back, a faint lit lip at the crown, the water running in
          const dy = ly - (wl - ary * Math.sqrt(Math.max(0, 1 - ((lx - acx) / arx) ** 2)));
          let i = dy < 2 ? 2 : dy < n(0.12) ? 1 : 0;
          if (ly >= wl - 1) {
            // the water inside: dark, a glint line that drifts nowhere (it is still in there)
            i = hashInt(lx >> 2, 1, 75) < 0.25 && ly === wl - 1 ? 3 : 1;
          }
          put(pix, lx, ly, r.recess, i);
          continue;
        }
        // voussoirs: wedges radiating from the arch's centre, each its own tone, mortar between
        const ang = Math.atan2((wl - ly) / ary, (lx - acx) / arx);
        const k = Math.floor((ang / Math.PI) * vous);
        const frac = (ang / Math.PI) * vous - k;
        const keystone = k === Math.floor(vous / 2) || k === Math.floor((vous - 1) / 2);
        let i = 4 + (hashInt(k, 1, 77) < 0.35 ? -1 : 0) + (keystone ? 1 : 0);
        // the ring's lit outer edge and its shaded soffit
        const dIn = Math.hypot((lx - acx) / arx, (wl - ly) / ary) - 1;
        if (dIn < 0.05) i -= 1;
        if (frac < 0.1 && !keystone) i = 1;
        if (ly > wl - n(0.16)) i -= 1;
        put(pix, lx, ly, r.stone, i);
      }
    // weed hanging from the crown's soffit
    for (let lx = Math.round(acx - arx * 0.6); lx < acx + arx * 0.6; lx++) {
      if (hashInt(lx, 1, 79) > 0.3) continue;
      const dx = (lx - acx) / arx;
      const top = Math.ceil(wl - ary * Math.sqrt(1 - dx * dx));
      const len = 1 + Math.floor(hashInt(lx, 2, 79) * 5);
      for (let k = 0; k < len; k++) put(pix, lx, top + k, r.algae, k === 0 ? 2 : 1);
    }
  }
  // iron mooring rings set into the wall near the water, rust running from their staples
  for (const rxw of [81.9, 83.6]) {
    const cx = X(rxw);
    const cy = wl - n(0.42);
    const R = n(0.06);
    // the staple: a dark socket in the block and its lit head
    put(pix, cx - 1, cy, r.iron, 0);
    put(pix, cx, cy, r.iron, 0);
    put(pix, cx + 1, cy, r.iron, 0);
    put(pix, cx, cy - 1, r.iron, 3);
    // the ring hanging from it, lit on its upper left
    for (let a = 0; a < 48; a++) {
      const t = (a / 48) * Math.PI * 2;
      const px = Math.round(cx + Math.sin(t) * R * 0.8);
      const py = Math.round(cy + 1 + R - Math.cos(t) * R);
      put(pix, px, py, r.iron, Math.sin(t) < 0 && Math.cos(t) > -0.3 ? 3 : 1);
    }
    // rust run down the stone below it
    for (let k = 0; k < n(0.3); k++) if (hashInt(k >> 1, Math.round(rxw * 10), 81) < 0.85) put(pix, cx + (k > n(0.14) ? 1 : 0), cy + R * 2 + 3 + k, r.rust, k < 5 ? 2 : 1);
  }
  // the railing on the far side of the flight: iron posts on every fourth tread, a rail between
  {
    const posts: [number, number][] = [];
    for (let i = 1; i < STEPS; i += 4) {
      const lx = X(B1.stairX + 0.3 * i + 0.15);
      posts.push([lx, Y(B1.yard - RISE * (i + 1))]);
    }
    const ph = n(0.82);
    for (const [px, py] of posts) {
      for (let k = 1; k <= ph; k++) {
        put(pix, px, py - k, r.iron, k === ph ? 3 : 2);
        put(pix, px + 1, py - k, r.iron, 1);
      }
      put(pix, px - 1, py - ph, r.iron, 3);
      put(pix, px + 2, py - ph, r.iron, 1);
      // its foot leaded into the tread
      put(pix, px - 1, py - 1, r.iron, 1);
      put(pix, px + 2, py - 1, r.iron, 0);
    }
    for (let j = 0; j + 1 < posts.length; j++) {
      const [ax, ay] = posts[j]!,
        [bx, by] = posts[j + 1]!;
      for (let lx = ax; lx <= bx + 1; lx++) {
        const t = (lx - ax) / (bx - ax);
        const y = Math.round(ay - ph + 1 + (by - ay) * t);
        // a round handrail: a lit upper row, a dark lower row, rust blooms here and there
        put(pix, lx, y, r.iron, 3);
        put(pix, lx, y + 1, hashInt(lx >> 1, j, 83) < 0.18 ? r.rust : r.iron, 1);
      }
    }
  }

  // --- boardwalk ------------------------------------------------------------------------
  const deck = Y(B1.deck);
  const plank = n(0.07);
  const stringer = n(0.045);
  const bay = n(0.6);
  const pw = n(0.07);
  const post = (px: number, top: number, w = pw, wade = true): void => {
    for (let y = top; y <= wl + 2; y++)
      for (let k = 0; k < w; k++) {
        let i = k === 0 ? 4 : k === w - 1 ? 1 : 2;
        // the grain: a darker check now and then
        if (k > 0 && k < w - 1 && hashInt(px + k, y >> 2, 91) < 0.12) i -= 1;
        if (y > wl - n(0.08)) i -= 1;
        put(pix, px + k, y, r.wood, i);
      }
    if (wade) {
      // the algae ring at the water and a little weed trailing off it
      for (let k = -1; k <= w; k++) put(pix, px + k, wl - 1, r.algae, k === -1 || k === w ? 1 : 2);
      for (let k = 0; k < w; k++) put(pix, px + k, wl - 2, r.algae, 1);
    }
  };
  const run = (a: number, b: number, o: { brokenW?: boolean; brokenE?: boolean }): void => {
    const la = X(a),
      lb = X(b);
    const pl = n(0.13);
    for (let lx = la; lx < lb; lx++) {
      const fromE = lb - 1 - lx,
        fromW = lx - la;
      const bi = Math.floor((lx + 4096) / pl);
      const inP = (lx + 4096) % pl;
      // a broken end: the last planks snapped short, ragged
      const rag = (o.brokenE && fromE < n(0.14)) || (o.brokenW && fromW < n(0.14));
      const drop = rag ? Math.floor(hashInt(bi, lx, 93) * 3) : 0;
      if (rag && hashInt(bi, 7, 93) < 0.4 && hashInt(lx, 1, 93) < 0.6) continue;
      const tone = 3 + (hashInt(bi, 1, 95) < 0.3 ? -1 : hashInt(bi, 2, 95) < 0.15 ? 1 : 0);
      for (let k = 0; k < plank; k++) {
        const y = deck + k + drop;
        let i = tone;
        if (k === 0) i += 2;
        else if (k === plank - 1) i -= 1;
        // seams between the plank ends (gaps of daylight between boards)
        if (inP === 0) i = k === 0 ? tone : 0;
        else if (inP === 1) i += 1;
        // nail heads two to a plank end
        if (k === 2 && (inP === 3 || inP === pl - 3)) i = 1;
        put(pix, lx, y, r.wood, i);
      }
      // the stringer under the planks, with bolt heads at each bay
      for (let k = 0; k < stringer; k++) {
        const y = deck + plank + k;
        let i = k === 0 ? 1 : 2;
        if ((lx - la) % bay === Math.round(pw / 2) && k === 1) i = 4;
        put(pix, lx, y, r.wood, i);
      }
      // its shadow on the water's first rows under it
      for (let k = 0; k < 2; k++) if (!pix.solid(lx, deck + plank + stringer + k)) put(pix, lx, deck + plank + stringer + k, r.recess, 1);
    }
    // posts on the bay and braces between them (an X under each bay)
    const bt = deck + plank + stringer;
    for (let px = la + n(0.06); px < lb - pw; px += bay) {
      post(px, deck + 1);
      const nx = px + bay;
      if (nx >= lb - pw) continue;
      const h = wl - bt;
      for (let k = 0; k <= bay - pw; k++) {
        const t = k / (bay - pw);
        const y1 = Math.round(bt + h * t * 0.85);
        const y2 = Math.round(bt + h * (1 - t) * 0.85);
        if (hashInt(px, 3, 97) < 0.75) put(pix, px + pw + k, y1, r.wood, 1);
        if (hashInt(px, 4, 97) < 0.5) put(pix, px + pw + k, y2, r.wood, 0);
      }
    }
  };
  run(B1.walks[0]![0], B1.walks[0]![1], { brokenE: true });
  run(B1.walks[1]![0], B1.walks[1]![1], { brokenW: true });
  run(B1.walks[2]![0], B1.walks[2]![1], {});
  // the gap: two posts still standing proud, one snapped plank hanging into the water
  for (const gx of [B1.gap[0] + 0.25, B1.gap[1] - 0.3]) post(X(gx), deck - n(0.08));
  {
    const lx0 = X(B1.gap[0]) - 1;
    const len = n(0.42);
    for (let i = 0; i < len; i++) {
      const lx = lx0 + Math.round(i * 0.55);
      const y = deck + Math.round(i * 0.85);
      for (let k = 0; k < n(0.05); k++) put(pix, lx, y + k, r.wood, k === 0 ? 4 : 2);
    }
  }
  // the channel's west post (the bridge's deck lands on it once cut), capped
  {
    const px = X(B1.channel[0]) - pw;
    post(px, deck - n(0.3), pw + 1);
    for (let k = -1; k <= pw + 1; k++) put(pix, px + k, deck - n(0.3), r.wood, 5);
  }
  // the bridge mast's pier on the channel's east bank: squared stones from the bed to the deck
  {
    const p0 = X(B1.channel[1] - 0.32),
      p1 = X(B1.channel[1] + 0.34);
    ashlar(pix, { x0: p0, x1: p1, top: () => deck, bottom: () => bottom, stone: r.stone, course: n(0.1), courseVar: 0.2, block: [n(0.2), n(0.34)], originY: wl, seed: 101, base: 3, light: -1, wet: { y: wl, h: n(0.1), algae: r.algae } });
    coping(pix, { x0: p0 - 1, x1: p1 + 1, top: () => deck - 2, h: 4, stone: r.stone, base: 3, seed: 102, block: [p1 - p0 + 2, p1 - p0 + 3], drip: 1 });
  }

  // --- the east landing: a short quay wall, four treads, the bank above ---------------------
  {
    const ex = B1.eastStairX;
    const nS = Math.ceil((B1.east - B1.deck) / 0.2 - 1e-6);
    const rise = (B1.east - B1.deck) / nS;
    const e0 = X(ex) - 2,
      e1 = X(B1.x1) + 10;
    const eTop = (lx: number): number => {
      const wx = W(lx);
      const i = Math.floor((wx - ex) / 0.3);
      return i < nS ? Y(B1.deck + rise * (i + 1)) : Y(B1.east);
    };
    // the quay wall under the treads and under the bank's edge (the bank's soil sits behind its top course)
    ashlar(pix, {
      x0: e0,
      x1: e1,
      top: (lx) => eTop(lx) + tread,
      bottom: () => bottom,
      stone: r.stone,
      course: n(0.15),
      courseVar: 0.3,
      block: [n(0.24), n(0.44)],
      originY: wl,
      seed: 111,
      base: 3,
      light: -1,
      cracks: 0.15,
      moss: { ramp: r.moss, amount: 0.3 },
      streaks: { from: (lx) => eTop(lx) + tread + 1, amount: 0.2, length: n(0.4) },
      wet: { y: wl, h: n(0.16), algae: r.algae },
    });
    for (let i = 0; i < nS; i++) {
      const a = X(ex + 0.3 * i) - (i === 0 ? 2 : 0),
        b = X(ex + 0.3 * (i + 1)) + 2;
      coping(pix, { x0: a, x1: b, top: () => Y(B1.deck + rise * (i + 1)), h: tread, stone: r.stone, base: 3, seed: 120 + i, block: [b - a, b - a + 1], drip: 2 });
    }
    // the bank: a coping course on the wall, then soil and grass rising behind it to the edge of the causeway
    const bx0 = X(ex + 0.3 * nS);
    coping(pix, { x0: bx0, x1: e1, top: () => Y(B1.east), h: tread, stone: r.stone, base: 3, seed: 130, block: [n(0.5), n(0.9)], drip: 2 });
    grassCap(pix, { x0: bx0 + 2, x1: e1, top: () => Y(B1.east) - 1, grass: r.grass, seed: 131, depth: 2, blades: n(0.12), cover: 0.85, lean: 0.35, hang: { drop: 4, length: n(0.12) } });
    // a squat stone bollard at the head of the landing
    {
      const bx = X(105.75),
        bt = Y(B1.east);
      const bw = n(0.18),
        bh = n(0.3);
      for (let y = bt - bh; y < bt; y++)
        for (let k = 0; k < bw; k++) {
          const top = y - (bt - bh);
          const round = top < 3 && (k < 3 - top || k > bw - 4 + top);
          if (round) continue;
          let i = 4;
          if (top === 0 || top === 1) i = 6;
          else if (k < 2) i = 5;
          else if (k > bw - 3) i = 2;
          if (hashInt(k >> 1, y >> 1, 133) < 0.1) i -= 1;
          put(pix, bx + k, y, r.stone, i);
        }
      for (let k = -1; k <= bw; k++) shift(pix, bx + k, bt, -2);
    }
    void soil;
    void fbm1;
  }
}

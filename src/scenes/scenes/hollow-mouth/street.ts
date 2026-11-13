// B5 Hollow Mouth, the bottom of the shaft (lane R-B): the payoff of the ride
// down. From the hook you look down on the floor of the hollow, paved and
// receding to the market's towers, stalls and their lanterns standing on it;
// at the bottom you stand in the street before the fallen structure's ground
// storey (an arcade, broken off to the west in a rubble heap, its bays open
// on the lit floor behind), and the east arch at the street's end is full of
// the market's light: the way into C1.
//
// Everything here uses the pinhole of geo.ts. The floor is the plane at the
// street's elevation, drawn per pixel: a screen row below the eye sees it at
// depth d = (street row - eye - camY) / (row - eye), so it recedes correctly
// at every height of the ride and meets every layer standing on it (the
// market at depth 4, the stalls, the arcade, the gate) at that layer's own
// ground row. Its sideways coordinate is (x - W/2) * d + W/2 (the floor's px
// at depth 1), so lamps can light pools on it under the things that hang them.

import { Pix, f, fbm, hashInt, rowRef } from "../../engine/index.ts";
import { B5, type Geo } from "./geo.ts";

/** A pool of lamplight on the floor: floor x (px at depth 1), depth, radius (floor px), strength. */
export interface Pool {
  x: number;
  d: number;
  r: number;
  k: number;
}

/** The pinhole's focal length in view px: turns a pool's radius into depth units (about 85 degrees across the view). */
const FOCAL = 700;

/** Floor x of a layer x at depth d. */
const floorX = (g: Geo, x: number, d: number): number => (x - g.W / 2) * d + g.W / 2;

/** The floor of the hollow at the street's elevation, from depth 1 (the street) to dMax (just short of the far wall). */
export function floorGlsl(g: Geo, dMax: number, pools: Pool[]): string {
  const k = g.P / 80;
  const rs = g.RY(B5.street);
  const list = pools.length ? pools : [{ x: -1e5, d: 1, r: 1, k: 0 }];
  return /* glsl */ `
const int NP = ${list.length};
const vec4 POOLS[NP] = vec4[NP](${list.map((q) => `vec4(${f(q.x)}, ${f(q.d)}, ${f(q.r)}, ${f(q.k)})`).join(", ")});
vec4 layer(vec2 p, vec2 s) {
  float A = ${f(rs)} - ${f(g.eye)} - camY();
  float dy = s.y - ${f(g.eye)} + 0.5;
  if (dy <= 0.0 || A <= 0.0) return vec4(0.0);
  float d = A / dy;
  if (d < 0.98 || d > ${f(dMax)}) return vec4(0.0);
  float dn = A / (dy + 1.0);            // the row below, nearer
  float gx = (p.x + 0.5 - ${f(g.W / 2)}) * d + ${f(g.W / 2)};
  // setts: courses across the depth, staggered joints along them; a joint is only
  // drawn where it lands at least 3 px from the next one on screen, so the far floor
  // turns to tone instead of shimmering
  float CZ = ${f(15 * k)} / ${f(FOCAL * k)};
  float SW = ${f(34 * k)};
  float ci = floor(d / CZ);
  float off = mod(ci, 2.0) * SW * 0.5;
  float bi = floor((gx + off) / SW);
  float far = smoothstep(1.0, ${f(dMax)}, d);
  float sh = 0.34 - 0.16 * far + 0.08 * (hash2(vec2(bi, ci)) - 0.5);
  sh += 0.08 * (fbm(vec2(gx / ${f(260 * k)}, d * 2.6), 3) - 0.5);
  float span = A * CZ / (d * d);
  if (span >= 3.0 && floor(dn / CZ) != ci) sh -= 0.12;
  else if (span >= 3.0 && floor(A / (dy - 1.0) / CZ) != ci) sh += 0.05;   // each course's far lip catches the light
  if (SW / d >= 6.0 && floor((gx + d + off) / SW) != bi) sh -= 0.1;
  // a gutter along the street's back edge, and the arcade's shadow on the pavement under it
  if (d > 1.07 && d < 1.1) sh -= 0.14;
  sh += sceneLight(s, 1.0) * 0.6;
  vec3 c = ramp(${rowRef("paving")}, sh, p, 0.4);
  // lamplight in pools under the lanterns, and the market's light spilling from the east arch
  float L = 0.0;
  for (int i = 0; i < NP; i++) {
    vec4 q = POOLS[i];
    vec2 e = vec2((gx - q.x) / q.z, (d - q.y) * ${f(FOCAL * k)} / q.z);
    L += q.w * max(0.0, 1.0 - dot(e, e));
  }
  // puddles here and there, holding the amber of the market
  vec2 cell = floor(vec2(gx / ${f(150 * k)}, d / 0.3));
  float pd = hash2(cell + 17.0);
  if (pd < 0.22) {
    vec2 pc = (cell + vec2(0.25 + 0.5 * hash2(cell + 3.0), 0.5)) * vec2(${f(150 * k)}, 0.3);
    vec2 e = vec2((gx - pc.x) / ${f(40 * k)}, (d - pc.y) * ${f(FOCAL * k)} / ${f(26 * k)});
    float r = dot(e, e) + 0.3 * (fbm(vec2(gx / 9.0, d * 40.0), 2) - 0.5);
    if (r < 1.0) {
      float ref = 0.18 + 0.2 * far + 0.5 * min(1.0, L);
      c = ramp(${rowRef("amber")}, ref * (0.8 + 0.2 * step(0.5, fract(s.y * 0.5))), p, 0.5);
      if (r > 0.8) c = ramp(${rowRef("paving")}, sh + 0.12, p, 0.0);
    }
  }
  // the market's haze on the far floor, and the pools
  float haze = smoothstep(1.6, ${f(dMax)}, d);
  c = mix(c, ramp(${rowRef("amber")}, 0.1 + 0.18 * haze + 0.05 * (hash2(vec2(bi, ci)) - 0.5), p, 0.6), stepd(haze * 0.75, 4.0, p, 0.8));
  float l = stepd(clamp(L, 0.0, 1.0), 4.0, p, 0.8);
  if (l > 0.0) c = mix(c, ramp(${rowRef("amber")}, 0.2 + 0.28 * l + 0.4 * max(0.0, sh - 0.2), p, 0.5), min(1.0, l * 1.2));
  return vec4(c, 1.0);
}`;
}

/**
 * A row of market stalls standing on the floor at depth d, between layer x0 and x1:
 * striped awnings over planked counters with goods, peaked tents, a tall shack with a
 * lit window, crates, lamp posts; a lantern under each awning (and its pool of light
 * on the floor), and strings of lights sagging from one stall to the next.
 */
export function stallRow(g: Geo, R: (n: string) => number, d: number, seed: number, x0: number, x1: number, pools: Pool[]): { pix: Pix; y: number } {
  const h = g.P / d;
  const ground = g.LY(g.RY(B5.street), d);
  const top = ground - Math.ceil(h * 3.0);
  const pix = new Pix(g.W, ground - top + 1);
  const G = ground - top;
  const px = Math.max(1, Math.round(h * 0.035));
  const rect = (x: number, y: number, w: number, hh: number, s: number | ((x: number, y: number) => number), row: string, em = false): void => {
    for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + w; xx++) pix.set(xx, yy, typeof s === "number" ? s : s(xx, yy), R(row), 0, em);
  };
  const lantern = (lx: number, y: number, drop: number): void => {
    rect(lx, y, px, drop, 0.2, "iron");
    rect(lx - px, y + drop, 2 * px + 1, Math.max(2, Math.round(h * 0.12)), 0.95, "amber", true);
    pools.push({ x: floorX(g, lx, d), d: d - 0.04, r: 95 * (g.P / 80), k: 0.85 });
  };
  // the booth's inside, warm near its lantern and dark at the back
  const booth = (x: number, y: number, w: number, hh: number, lx: number): void =>
    rect(x, y, w, hh, (xx, yy) => Math.max(0.02, 0.2 - 0.2 * Math.hypot((xx - lx) / (w * 0.7), (yy - y) / (hh * 1.1))), "amber");
  const counter = (x: number, w: number, cH: number, i: number): void => {
    rect(x - px, G - cH, w + 2 * px, cH, (xx, yy) => (yy === G - cH ? 0.42 : 0.16 + 0.05 * hashInt(Math.floor((xx - x) / (3 * px)), 0, seed + 7) - ((xx - x) % (4 * px) === 0 ? 0.05 : 0)), "root");
    for (let gx = x + px; gx < x + w - 3 * px; gx += 3 * px) {
      const gh = Math.round(px * (1 + 3 * hashInt(gx, i, seed + 9)));
      if (hashInt(gx, i, seed + 8) < 0.7) rect(gx, G - cH - gh, 2 * px, gh, 0.3 + 0.2 * hashInt(gx, 1, seed), ["amber", "red", "moss", "concrete"][Math.floor(hashInt(gx, 2, seed) * 4)]!);
    }
  };
  const anchors: [number, number][] = [];
  let x = Math.round(x0 + hashInt(seed, 0, 901) * h);
  for (let i = 0; x < x1; i++) {
    const r = (n: number): number => hashInt(i, n, seed);
    const kind = r(2);
    if (kind < 0.46) {
      // a stall under a striped awning
      const w = Math.round(h * (1.1 + 1.0 * r(1)));
      const aH = Math.round(h * (1.25 + 0.3 * r(4)));
      const aT = Math.round(h * (0.26 + 0.1 * r(5)));
      const cH = Math.round(h * 0.5);
      const lx = x + Math.round(w * (0.35 + 0.3 * r(8)));
      booth(x + px, G - aH, w - 2 * px, aH - cH, lx);
      for (let j = 1; j <= 2; j++) rect(x + 2 * px, G - cH - Math.round(j * h * 0.28), w - 4 * px, px, 0.16, "wall");
      rect(x, G - aH, 2 * px, aH, 0.22, "iron");
      rect(x + w - 2 * px, G - aH, 2 * px, aH, 0.2, "iron");
      counter(x, w, cH, i);
      const sw = Math.max(3, Math.round(h * (0.12 + 0.08 * r(9))));
      const cloth = ["red", "amber", "moss"][Math.floor(r(6) * 2.6)]!;
      for (let yy = 0; yy < aT; yy++) {
        const spread = Math.round((yy / aT) * 2 * px);
        for (let xx = x - 2 * px - spread; xx < x + w + 2 * px + spread; xx++) {
          const band = Math.floor((xx - x + 1000 * sw) / sw) % 2;
          const lit = yy >= aT - px ? 0.12 : 0;
          pix.set(xx, G - aH - aT + yy, (band ? 0.3 : 0.44) + lit - 0.1 * (1 - yy / aT), band && cloth !== "amber" ? R("wall") : R(cloth));
        }
      }
      for (let xx = x - 4 * px; xx < x + w + 4 * px; xx++) if (Math.floor((xx - x + 1000 * sw) / sw) % 2 === 0) rect(xx, G - aH, 1, px + (xx % sw === Math.floor(sw / 2) ? px : 0), 0.4, cloth);
      lantern(lx, G - aH, Math.round(h * 0.1));
      anchors.push([x - 2 * px, G - aH - aT], [x + w + 2 * px, G - aH - aT]);
      x += w;
    } else if (kind < 0.62) {
      // a peaked tent, its flap tied open on a lit inside
      const w = Math.round(h * (1.0 + 0.6 * r(1)));
      const wall = Math.round(h * (0.9 + 0.2 * r(4)));
      const peak = Math.round(h * (0.55 + 0.25 * r(5)));
      const cloth = r(6) < 0.5 ? "red" : "amber";
      const lx = x + (w >> 1);
      for (let xx = x; xx < x + w; xx++) {
        const t = Math.abs((xx - lx) / (w / 2));
        const roof = Math.round(peak * (1 - t));
        const door = Math.abs(xx - lx) < w * 0.22;
        for (let yy = G - wall - roof; yy < G; yy++) {
          const z = G - yy;
          if (door && z < wall * 0.85) {
            pix.set(xx, yy, Math.max(0.04, 0.26 - (0.3 * Math.abs(xx - lx)) / w - 0.1 * (z / wall)), R("amber"));
            continue;
          }
          const seam = (xx - x) % Math.max(4, Math.round(h * 0.3)) === 0;
          pix.set(xx, yy, (seam ? 0.2 : 0.3) + (yy === G - wall - roof ? 0.14 : 0) - 0.08 * (xx > lx ? 1 : 0), R(cloth));
        }
      }
      rect(lx, G - wall - peak - Math.round(h * 0.25), px, Math.round(h * 0.25), 0.25, "iron");
      pools.push({ x: floorX(g, lx, d), d: d - 0.04, r: 80 * (g.P / 80), k: 0.6 });
      anchors.push([lx, G - wall - peak - Math.round(h * 0.25)]);
      x += w;
    } else if (kind < 0.7) {
      // a tall shack of boards and tin, a lit window up top and a lit door
      const w = Math.round(h * (1.1 + 0.4 * r(1)));
      const tall = Math.round(h * (2.2 + 0.5 * r(4)));
      const pw = Math.max(3, Math.round(h * 0.18));
      for (let xx = x; xx < x + w; xx++)
        for (let yy = G - tall; yy < G; yy++) {
          const z = G - yy;
          const pl = Math.floor((xx - x) / pw);
          let sh = 0.14 + 0.07 * hashInt(pl, Math.floor(z / (h * 0.7)), seed + 11);
          if ((xx - x) % pw === 0) sh -= 0.05;
          if (z === tall - 1) sh = 0.36;
          pix.set(xx, yy, sh, pl % 3 === 1 ? R("iron") : R("root"));
        }
      const wx = x + Math.round(w * 0.2), wy = G - Math.round(tall * 0.8), ww = Math.round(w * 0.35), wh = Math.round(h * 0.3);
      rect(wx, wy, ww, wh, (xx, yy) => (xx - wx === ww >> 1 ? 0.12 : 0.6 + 0.3 * (1 - (yy - wy) / wh)), "amber");
      const dh = Math.round(h * 0.85);
      rect(x + Math.round(w * 0.55), G - dh, Math.round(w * 0.28), dh, (_xx, yy) => 0.3 + 0.25 * ((yy - (G - dh)) / dh), "amber");
      pools.push({ x: floorX(g, x + w * 0.7, d), d: d - 0.05, r: 70 * (g.P / 80), k: 0.7 });
      anchors.push([x + w, G - tall]);
      x += w;
    } else if (kind < 0.86) {
      // crates
      let cx = x;
      for (let j = 0; j < 2 + Math.floor(r(7) * 3); j++) {
        const cw = Math.round(h * (0.35 + 0.2 * hashInt(i, j, seed + 3)));
        const ch = Math.round(cw * (0.8 + 0.3 * hashInt(i, j, seed + 4)));
        const stack = j > 0 && hashInt(i, j, seed + 5) < 0.35 ? Math.round(h * 0.4) : 0;
        rect(cx, G - ch - stack, cw, ch, (xx, yy) => (yy === G - ch - stack ? 0.4 : xx === cx || xx === cx + cw - 1 ? 0.14 : 0.24 - ((yy - (G - ch - stack)) % Math.max(3, Math.round(ch / 3)) === 0 ? 0.06 : 0)), "root");
        cx += stack ? 0 : cw + px;
      }
      x = cx;
    } else {
      // a lamp post
      const lh = Math.round(h * 2.0);
      rect(x, G - lh, 2 * px, lh, 0.22, "iron");
      rect(x - 2 * px, G - lh, 6 * px, px, 0.26, "iron");
      rect(x - 2 * px, G - lh + px, 3 * px, 2 * px + 1, 0.95, "amber", true);
      pools.push({ x: floorX(g, x, d), d: d - 0.03, r: 120 * (g.P / 80), k: 0.8 });
      anchors.push([x, G - lh]);
      x += 3 * px;
    }
    x += Math.round(h * (0.25 + 1.1 * r(3)));
  }
  // strings of lights, sagging between neighbours that stand close enough
  for (let i = 0; i + 1 < anchors.length; i++) {
    const [ax, ay] = anchors[i]!;
    const [bx, by] = anchors[i + 1]!;
    if (bx - ax < h * 0.6 || bx - ax > h * 3.2 || hashInt(i, 1, seed + 13) < 0.3) continue;
    const sag = h * (0.2 + 0.2 * hashInt(i, 2, seed + 13));
    const step = Math.max(3, Math.round(h * 0.16));
    for (let xx = ax; xx <= bx; xx++) {
      const t = (xx - ax) / (bx - ax);
      const yy = Math.round(ay + (by - ay) * t + sag * 4 * t * (1 - t));
      if ((xx - ax) % step === step >> 1) pix.set(xx, yy + 1, 1, hashInt(xx, i, seed + 14) < 0.3 ? R("red") : R("amber"), 0, true);
      else pix.set(xx, yy, 0.12, R("iron"));
    }
  }
  return { pix, y: top };
}

/**
 * The fallen structure's ground storey, facing the street across it at depth d: an
 * arcade of heavy cast piers and segmental arches (open bays on the lit floor behind;
 * one bricked up with a lit window, one shuttered, a lantern in another), a cornice,
 * and the broken floor above it. To the west it has fallen: a torn end with its rebar
 * out over a heap of rubble. It ends east at xE, short of the gate.
 */
export function arcade(g: Geo, R: (n: string) => number, d: number, xE: number, pools: Pool[]): { pix: Pix; y: number } {
  const h = g.P / d;
  const u = g.P / 80;
  const ground = g.LY(g.RY(B5.street), d);
  const top = ground - Math.ceil(h * 2.5);
  const pix = new Pix(g.W, ground - top + 1);
  const G = ground - top;
  const bay = Math.round(h * 2.05);
  const pier = Math.round(h * 0.42);
  const spring = Math.round(h * 1.12);
  const rise = Math.round(h * 0.42);
  const corn = Math.round(h * 1.9);
  const plinth = Math.round(h * 0.16);
  const board = Math.max(3, Math.round(h * 0.13));
  // bays from the east end westward; the torn end falls in the fourth bay
  const nBays = 4;
  const xW = xE - nBays * (bay + pier) - pier;
  const tear = xW + Math.round(bay * 0.55);
  const brick = 1, shutter = 3, lantern = 2;
  const bayOf = (x: number): { i: number; u: number } | null => {
    const r = x - (xW + pier);
    if (r < 0) return null;
    const i = Math.floor(r / (bay + pier));
    const q = r - i * (bay + pier);
    return q < bay && i < nBays ? { i: nBays - 1 - i, u: (q + 0.5) / bay } : null;
  };
  // the broken top: the cornice, then the floor above torn off raggedly
  const topAt = (x: number): number => {
    const n = fbm(x / (26 * u), 3.1, 611, 3);
    let t = corn + Math.round(h * (0.12 + 0.45 * Math.max(0, n - 0.35)));
    if (x < tear + h * 1.2) t = Math.round(t * Math.max(0.35, (x - tear) / (h * 1.2)));
    return t;
  };
  const cast = (x: number, y: number, dy: number): number => {
    let s = 0.3 + 0.1 * (fbm(x / (10 * u), y / (7 * u), 612, 3) - 0.5);
    if (y % board === 0) s -= 0.05;
    const hh = hashInt(x, y, 613);
    if (hh < 0.03) s += 0.06;
    else if (hh > 0.975) s -= 0.07;
    // rain streaks down from the cornice
    const st = hashInt(Math.floor(x / Math.max(2, Math.round(3 * u))), 1, 614);
    if (st < 0.18) s -= 0.06 * Math.min(1, dy / (h * 0.8));
    return s;
  };
  for (let x = tear; x < xE; x++) {
    const tH = topAt(x);
    const b = bayOf(x);
    const yI = b ? spring + Math.round(rise * Math.sqrt(Math.max(0, 1 - (2 * b.u - 1) ** 2))) : 0;
    for (let yy = G - tH; yy < G; yy++) {
      const z = G - yy; // height above the street
      const dy = yy - (G - tH);
      if (b && z < yI) {
        // inside a bay
        if (b.i === brick) {
          const course = Math.floor(z / Math.max(2, Math.round(h * 0.1)));
          const bw = Math.max(4, Math.round(h * 0.22));
          const joint = z % Math.max(2, Math.round(h * 0.1)) === 0 || (x + (course % 2) * (bw >> 1)) % bw === 0;
          const win = Math.abs(b.u - 0.5) < 0.12 && z > h * 0.55 && z < h * 0.95;
          if (win) {
            const bar = Math.abs(b.u - 0.5) < 0.012 || Math.abs(z - h * 0.75) < 1;
            pix.set(x, yy, bar ? 0.12 : 0.62 + 0.3 * (1 - (z - h * 0.55) / (h * 0.4)), bar ? R("iron") : R("amber"));
          } else pix.set(x, yy, joint ? 0.1 : 0.2 + 0.06 * hashInt(Math.floor(x / bw), course, 615), R("stone"));
          continue;
        }
        if (b.i === shutter && z < yI - Math.round(h * 0.12)) {
          const rib = z % Math.max(2, Math.round(h * 0.07)) === 0;
          pix.set(x, yy, (rib ? 0.14 : 0.22) + 0.04 * (fbm(x / (8 * u), z / (4 * u), 616, 2) - 0.5) - (z < h * 0.1 ? 0.05 : 0), R("iron"));
          continue;
        }
        if (z >= yI - 2 * u) {
          pix.set(x, yy, 0.12, R("concrete")); // the soffit's edge
          continue;
        }
        continue; // open
      }
      let s = cast(x, yy, dy);
      if (dy < Math.round(2 * u)) s = 0.56 - 0.1 * dy; // the broken top catches the daylight from above
      else if (z === corn) s = 0.5; // the cornice's lit drip
      else if (z === corn - 1) s = 0.18;
      else if (z < corn && z > corn - Math.round(h * 0.14)) s -= 0.05;
      if (z < plinth) s = z === plinth - 1 ? 0.46 : 0.2 + 0.03 * (hashInt(x >> 2, 0, 617) - 0.5);
      if (b) {
        // the arch ring over the bay: voussoirs, the keystone a touch proud
        const ring = z - yI;
        if (ring >= 0 && ring < Math.round(h * 0.2)) {
          const ang = Math.atan2(z - spring + rise * 0.6, (b.u - 0.5) * bay);
          const vs = Math.floor(ang / 0.16);
          s = 0.34 + 0.05 * (hashInt(vs, b.i, 618) - 0.5) + (Math.abs(b.u - 0.5) < 0.05 ? 0.06 : 0);
          if (Math.abs(ang / 0.16 - vs) < 0.12) s = 0.16;
          if (ring === 0) s = 0.2;
        }
      } else {
        // a pier: lit west edge, the east edge in shadow; the capital at the springing
        const pierX = (x - xW) % (bay + pier);
        if (pierX === 0) s += 0.1;
        else if (pierX === pier - 1) s -= 0.08;
        if (Math.abs(z - spring) < Math.max(1, Math.round(h * 0.04))) s = z === spring ? 0.46 : 0.16;
      }
      pix.set(x, yy, s, R("concrete"));
    }
    // cracks
    if (hashInt(x >> 4, 9, 619) < 0.08) {
      const cy = G - Math.round(corn * (0.3 + 0.5 * hashInt(x >> 4, 10, 619)));
      pix.set(x, cy + Math.round(Math.sin(x * 0.4) * 2), 0.08, R("concrete"));
    }
  }
  // the lantern hung in its bay, and its pool; vines from the cornice
  {
    const bx = xW + pier + (nBays - 1 - lantern) * (bay + pier) + (bay >> 1);
    const cy = G - spring - rise;
    for (let yy = cy; yy < cy + Math.round(h * 0.4); yy++) pix.set(bx, yy, 0.22, R("iron"));
    for (let yy = cy + Math.round(h * 0.4); yy < cy + Math.round(h * 0.4) + Math.round(h * 0.16); yy++)
      for (let xx = bx - Math.round(h * 0.05); xx <= bx + Math.round(h * 0.05); xx++) pix.set(xx, yy, 0.95, R("amber"), 0, true);
    pools.push({ x: floorX(g, bx, d), d, r: 130 * u, k: 1.0 });
  }
  for (let i = 0; i < 26; i++) {
    const vx = Math.round(tear + h + hashInt(i, 1, 620) * (xE - tear - h));
    const len = Math.round(h * (0.2 + 0.9 * hashInt(i, 2, 620) ** 2));
    const y0 = G - topAt(vx) + 2;
    for (let j = 0; j < len; j++) pix.set(vx + Math.round(Math.sin(j * 0.3 + i) * 1.2), y0 + j, 0.3 + 0.15 * ((j >> 1) & 1), R("moss"));
  }
  // the torn end: rebar bent out of the break
  for (let j = 0; j < 7; j++) {
    const y0 = G - Math.round(h * (0.5 + 0.2 * j));
    const len = Math.round(h * (0.15 + 0.25 * hashInt(j, 1, 621)));
    for (let t = 0; t < len; t++) pix.set(tear - t, y0 + Math.round(t * t * 0.02 * (1 + hashInt(j, 2, 621))), 0.3, R("iron"));
  }
  // the heap it fell into, spilling west across the pavement
  {
    const x1 = tear + Math.round(h * 0.6);
    const x0 = Math.max(0, tear - Math.round(h * 4.2));
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const hh = Math.round(h * (1.05 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) ** 1.5 * (0.8 + 0.4 * fbm(x / (9 * u), 0.5, 622, 3))));
      for (let z = 0; z < hh; z++) {
        const yy = G - 1 - z;
        const cell = hashInt(Math.floor(x / (5 * u)), Math.floor(z / (4 * u)), 623);
        let s = 0.16 + 0.18 * cell - 0.1 * (1 - z / Math.max(1, hh));
        if (z === hh - 1) s = 0.46;
        else if (hashInt(x, z, 624) < 0.04) s = 0.07;
        pix.set(x, yy, s, cell > 0.85 ? R("stone") : R("concrete"));
      }
      if (hashInt(x, 3, 625) < 0.03) for (let j = 0; j < Math.round(h * 0.3); j++) pix.set(x + (j >> 2), G - hh - j, 0.28, R("iron"));
    }
  }
  return { pix, y: top };
}

/**
 * The east arch at the street's end (depth d, from layer x xG to the room's edge): a
 * dressed stone pier and the arch springing from it, full of the market's light.
 * Inside: the lit passage floor, an inner arch further in, two lanterns.
 */
export function eastArch(g: Geo, R: (n: string) => number, d: number, xG: number): { pix: Pix; y: number; open: { x0: number; y0: number; y1: number } } {
  const h = g.P / d;
  const u = g.P / 80;
  const ground = g.LY(g.RY(B5.street), d);
  const pierW = Math.round(h * 0.6);
  const spring = Math.round(h * 2.05);
  const cx = g.W + Math.round(h * 0.7);
  const rx = cx - (xG + pierW);
  const ry = Math.round(h * 1.25);
  const ringT = Math.round(h * 0.42);
  const total = spring + ry + ringT + Math.round(h * 0.55);
  const top = ground - total;
  const pix = new Pix(g.W, total + 1);
  const G = total;
  const course = Math.max(4, Math.round(h * 0.26));
  const blockW = Math.round(h * 0.52);
  const intrados = (x: number): number => spring + Math.round(ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)));
  for (let x = xG; x < g.W; x++) {
    const inOpen = x >= xG + pierW;
    const yI = inOpen ? intrados(x) : 0;
    const topH = total - Math.round(Math.max(0, fbm(x / (18 * u), 1.5, 631, 3) - 0.55) * h * 0.8);
    for (let z = 0; z < topH; z++) {
      const yy = G - 1 - z;
      if (inOpen && z < yI) {
        // the market's light down the passage: brighter low and deep, stepped
        const dx = (x - (xG + pierW)) / (g.W - xG - pierW);
        const v = 0.42 + 0.3 * (1 - z / yI) + 0.18 * dx;
        let s = Math.floor(v * 6 + ([0, 0.5, 0.75, 0.25][(x & 1) + 2 * (yy & 1)]! - 0.5) * 0.9 + 0.5) / 6;
        let row = "amber";
        // the inner arch further in, dark against the light
        const ix = xG + pierW + Math.round((g.W - xG - pierW) * 0.35);
        const iTop = Math.round(h * 1.55) + Math.round(h * 0.45 * Math.sqrt(Math.max(0, 1 - ((x - g.W) / (g.W - ix)) ** 2)));
        if (x >= ix && x < ix + Math.round(h * 0.24) && z < iTop) {
          s = 0.1;
          row = "wall";
        } else if (x >= ix && z >= iTop && z < iTop + Math.round(h * 0.2)) {
          s = 0.12;
          row = "wall";
        } else if (z < Math.round(h * 0.06)) s = Math.min(1, s + 0.12);
        pix.set(x, yy, s, R(row));
        continue;
      }
      let s: number;
      const ring = inOpen || x >= xG + pierW - 1 ? z - yI : -1;
      if (inOpen && ring >= 0 && ring < ringT) {
        // voussoirs
        const ang = Math.atan2(z - spring, (x - cx) * (ry / rx));
        const vs = Math.floor(ang / 0.13);
        s = 0.38 + 0.08 * (hashInt(vs, 1, 633) - 0.5);
        if (Math.abs(ang / 0.13 - vs) < 0.1 * (ringT / Math.max(1, ring + 4))) s = 0.14;
        if (ring === 0) s = 0.62; // the intrados lit by the passage
        else if (ring === 1) s = 0.46;
      } else {
        // ashlar courses
        const c = Math.floor(z / course);
        const bx = Math.floor((x - xG + (c % 2) * (blockW >> 1)) / blockW);
        s = 0.28 + 0.08 * (hashInt(bx, c, 634) - 0.5) + 0.05 * (fbm(x / (7 * u), z / (5 * u), 635, 2) - 0.5);
        if (z % course === 0 || (x - xG + (c % 2) * (blockW >> 1)) % blockW === 0) s = 0.13;
        if (z === topH - 1) s = 0.5;
        // the pier's jamb, lit amber from the passage
        if (!inOpen && x >= xG + pierW - Math.round(2 * u) && z < spring) s = 0.66;
        else if (!inOpen && x === xG) s += 0.1;
        // the impost at the springing
        if (!inOpen && Math.abs(z - spring) < Math.round(h * 0.05)) s = z >= spring ? 0.5 : 0.18;
        if (z < Math.round(h * 0.18)) s -= 0.06;
      }
      const warm = !inOpen && x >= xG + pierW - Math.round(2 * u) && z < spring;
      pix.set(x, yy, s, warm ? R("amber") : R("stone"));
    }
  }
  // two lanterns hanging in the passage
  for (const [fx, drop] of [
    [0.3, 0.55],
    [0.72, 0.8],
  ] as [number, number][]) {
    const lx = Math.round(xG + pierW + fx * (g.W - xG - pierW));
    const yTop = G - intrados(lx);
    const y1 = yTop + Math.round(h * drop);
    for (let yy = yTop; yy < y1; yy++) pix.set(lx, yy, 0.1, R("iron"));
    for (let yy = y1; yy < y1 + Math.round(h * 0.18); yy++) for (let xx = lx - Math.round(h * 0.06); xx <= lx + Math.round(h * 0.06); xx++) pix.set(xx, yy, 1, R("amber"), 0, true);
  }
  return { pix, y: top, open: { x0: xG + pierW, y0: ground - spring - ry, y1: ground } };
}

// The monolith: a black angular megastructure, a near-vertical stem that bends
// into a long blade leaning up and right across the planet. A shape grammar on
// two spine sections (stem, blade): stepped setbacks, faceted cross-section
// (lit bevel, dark front face with panels, rails and conduits, a ridge, a
// blue-lit underside), sawtooth fins along the blade's back, a fringe of broken
// spikes on its right side, buttresses, antennas and sparse lit windows.
//
// It writes Pix data (shade, ramp row, extra fog), not colours, so the uplight,
// the conduit pulse and flash accents light it live through sceneLight().

import { Pix, hashInt, mulberry, smooth, clamp } from "../../engine/index.ts";
import { local, toLayer, type Geo, type Part } from "./geo.ts";

export interface MonoRows {
  mono: number;
  under: number;
  win: number;
  windim: number;
  warm: number;
}

export interface MonoOut {
  /** Largest stem a at which the stem conduit is still visible (the blade covers it above). */
  stemConduitMax: number;
  /** Smallest blade a at which each blade conduit is inside the blade. */
  bladeConduitMin: number;
  /** Largest blade a at which both blade conduits are still on screen. */
  bladeConduitMax: number;
  /** Layer-space points on the structure for flash accents. */
  surface: [number, number][];
  windows: [number, number][];
}

/** Thin 8-connected digital line test for a line at offset c along a unit normal (nx, ny). */
export function onLine(b: number, c: number, nx: number, ny: number): boolean {
  return Math.abs(b - c) < 0.5 * Math.max(Math.abs(nx), Math.abs(ny));
}

export function buildMonolith(pix: Pix, g: Geo, x0: number, R: MonoRows, seed = 7): MonoOut {
  const { H, u } = g;
  const w = pix.w;
  const own = new Uint8Array(w * H); // 0 empty, 1 stem, 2 blade, 3 attached pieces
  const rnd = mulberry(seed);
  const U = (n: number): number => Math.max(1, Math.round(n * u));

  // stepped setbacks: each tier nudges the silhouette in or out on each side
  const tierLen = 30 * u;
  const setback = (p: Part, id: number, a: number, side: number): number => {
    const t = Math.floor((a - p.a0) / tierLen);
    const h = hashInt(t, side * 7 + id, seed);
    return h < 0.25 ? -U(3) : h < 0.45 ? -U(1.5) : h > 0.9 ? U(2) : 0;
  };
  const hwAt = (p: Part, id: number, a: number, b: number): number => p.hw(a) + setback(p, id, a, b < 0 ? -1 : 1);

  const blade = g.blade;
  const stem = g.stem;
  const joint = g.joint;
  const inside = (p: Part, id: number, lx: number, ly: number): [number, number] | null => {
    const [a, b] = local(p, lx, ly);
    if (a < p.a0 || a > p.a1) return null;
    // the blade's lower end is cut on a slant (it overhangs the stem on the left)
    if (id === 2 && a < p.a0 + Math.max(0, b + p.hw(p.a0) * 0.2) * 0.7) return null;
    if (Math.abs(b) > hwAt(p, id, a, b)) return null;
    return [a, b];
  };

  // --- body -------------------------------------------------------------------
  const extraFog = (ly: number): number => 0.42 * Math.pow(smooth(H * 0.55, H * 1.02, ly), 1.3);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  for (let y = 0; y < H; y++)
    for (let x = 0; x < w; x++) {
      const lx = x + x0 + 0.5;
      const ly = y + 0.5;
      let id = 2;
      let p = blade;
      let ab = inside(blade, 2, lx, ly);
      if (!ab) {
        id = 1;
        p = stem;
        ab = inside(stem, 1, lx, ly);
      }
      if (!ab) {
        id = 4;
        p = joint;
        ab = inside(joint, 4, lx, ly);
      }
      if (!ab) continue;
      own[y * w + x] = id;
      const [a, b] = ab;
      const hw = hwAt(p, id, a, b);
      const v = b / hw;
      const d = p.d;
      const n = p.n;
      const lw = Math.max(Math.abs(d[0]), Math.abs(d[1]));
      const ln = Math.max(Math.abs(n[0]), Math.abs(n[1]));
      // panels along the spine: lengths vary per tier
      const tier = Math.floor((a - p.a0) / tierLen);
      const pl = (id === 2 ? 11 : 9) * u * (0.8 + hashInt(tier, 3, seed + id) * 0.6);
      const pk = Math.floor(a / pl);
      const seam = Math.abs(a - Math.round(a / pl) * pl) < 0.5 * lw;
      const bevelV = id === 2 ? -0.8 : -0.74;
      const ridge0 = id === 2 ? 0.3 : 0.5;
      const ridge1 = id === 2 ? 0.42 : 0.6;
      let row = R.mono;
      let s: number;
      const bandHash = (k: number): number => hashInt(pk, k, seed + id * 13);
      if (v < bevelV) {
        // bevel toward the planet: the lit side
        s = 0.43 + (bandHash(1) - 0.5) * 0.06;
        if (seam) s -= 0.12;
        if (v < bevelV - (1 + bevelV) * 0.5 && hashInt(pk, 9, seed) < 0.3) s -= 0.06;
      } else if (v < ridge0) {
        // front face: panels, rails, conduits, ribbing
        const col = Math.floor((b + 200) / (6 * u));
        const ph = hashInt(pk, col, seed + id * 7);
        s = 0.2 + (ph - 0.5) * 0.07;
        if (ph < 0.16) s = 0.13; // recessed panel
        else if (ph > 0.82 && (Math.floor(b) & 1) === 0) s += 0.05; // ribbed plate
        if (seam) s = 0.09;
        // tier ledges: a lit lip with a shadow under it, across the whole face
        const ta = a - p.a0 - Math.round((a - p.a0) / tierLen) * tierLen;
        if (Math.abs(ta) < 0.5 * lw) s = 0.36;
        else if (ta < 0 && ta > -2.5 * lw) s = 0.05;
        // vertical ribs: groups of fine lit lines on some panels
        if (ph > 0.6 && ph < 0.72 && (Math.floor(b / Math.max(1, Math.round(2 * u))) & 1) === 0) s = Math.max(s, 0.27);
        // lit rails along the spine
        const hw0 = p.hw(a);
        for (const rb of id === 2 ? [-0.62, -0.44, -0.1, 0.2] : id === 1 ? [-0.5, 0.05, 0.3] : [-0.55, 0.1]) if (onLine(b, Math.round(rb * hw0) + 0.5, n[0], n[1])) s = seam ? 0.2 : 0.3;
        // deep trenches: long dark recesses between some rails
        if (id === 2 && v > -0.4 && v < -0.14 && hashInt(pk, 21, seed) < 0.45) s = Math.min(s, 0.1 + ((Math.floor(a) & 3) === 0 ? 0.05 : 0));
        // conduits: dark grooves the pulse runs through
        for (const c of id === 2 ? g.bladeConduits : id === 1 ? g.stemConduits : []) if (onLine(b, c, n[0], n[1]) || onLine(b, c + 1, n[0], n[1])) s = 0.07;
      } else if (v < ridge1) {
        s = 0.3 + (bandHash(4) - 0.5) * 0.05;
        if (onLine(b, ridge0 * hw + 0.5, n[0], n[1])) s = 0.4;
        if (seam) s -= 0.1;
      } else {
        // underside / right face: lit blue from the glow rising out of the clouds below
        row = R.under;
        const up = smooth(H * 0.25, H * 0.98, ly);
        s = 0.12 + 0.26 * up + (bandHash(5) - 0.5) * 0.05;
        if (seam) s -= 0.07;
        const k = (v - ridge1) / (1 - ridge1);
        s += 0.08 * k * up;
        s += ((bayer[(x & 3) + (y & 3) * 4]! + 0.5) / 16 - 0.5) * 0.04 * up;
      }
      pix.set(x, y, s, row, extraFog(ly));
      void ln;
    }

  const put = (lx: number, ly: number, s: number, row: number, emissive = false): void => {
    const x = Math.floor(lx - x0);
    const y = Math.floor(ly);
    if (x < 0 || y < 0 || x >= w || y >= H) return;
    pix.set(x, y, s, row, extraFog(ly), emissive);
    if (!emissive && own[y * w + x] === 0) own[y * w + x] = 3;
  };
  const poly = (pts: [number, number][], shade: number | ((x: number, y: number) => number), row: number): void => {
    pix.poly(
      pts.map(([px, py]) => [px - x0, py]),
      {
        row,
        shade: (x, y) => (typeof shade === "number" ? shade : shade(x + x0, y)),
        fog: (_x, y) => extraFog(y),
      },
    );
    // mark ownership for the pieces (cheap: bounding box scan)
    let xa = Infinity;
    let xb = -Infinity;
    let ya = Infinity;
    let yb = -Infinity;
    for (const [px, py] of pts) {
      xa = Math.min(xa, px - x0);
      xb = Math.max(xb, px - x0);
      ya = Math.min(ya, py);
      yb = Math.max(yb, py);
    }
    for (let y = Math.max(0, Math.floor(ya)); y <= Math.min(H - 1, Math.ceil(yb)); y++)
      for (let x = Math.max(0, Math.floor(xa)); x <= Math.min(w - 1, Math.ceil(xb)); x++)
        if (pix.solid(x, y) && own[y * w + x] === 0) own[y * w + x] = 3;
  };

  // --- fins along the blade's back (upper-left edge) ----------------------------
  {
    let a = blade.a1 * 0.04;
    while (a < blade.a1) {
      const wb = (9 + rnd() * 12) * u;
      const tall = rnd();
      const h = (tall > 0.7 ? 24 + rnd() * 22 : 8 + rnd() * 14) * u * (0.7 + 0.6 * (a / blade.a1));
      const rake = h * (0.45 + rnd() * 0.35);
      const e0 = -blade.hw(a) + 1.5;
      const e1 = -blade.hw(a + wb) + 1.5;
      const broken = rnd() < 0.2;
      const tip = toLayer(blade, a + wb * 0.55 + rake, e0 - h * (broken ? 0.55 : 1));
      const pts: [number, number][] = [toLayer(blade, a, e0), toLayer(blade, a + wb, e1)];
      if (broken) pts.push(toLayer(blade, a + wb * 0.9 + rake * 0.5, e0 - h * 0.5), tip, toLayer(blade, a + wb * 0.3 + rake * 0.4, e0 - h * 0.62));
      else pts.push(tip);
      poly(pts, 0.3 + rnd() * 0.08, R.mono);
      // a dark seam where the fin meets the bevel
      a += wb + (2 + rnd() * 9) * u;
    }
  }

  // --- the broken fringe on the blade's right side ---------------------------------
  {
    const n = 17;
    for (let i = 0; i < n; i++) {
      const a = blade.a0 + blade.a1 * (0.08 + 0.5 * (i / n) + rnd() * 0.03);
      const hw = blade.hw(a);
      const [sx, sy] = toLayer(blade, a, hw - 2);
      const ang = -0.05 + rnd() * 0.35 + (i % 3 === 0 ? 0.2 : 0);
      const len = (12 + Math.pow(rnd(), 1.4) * 44) * u * (1 - 0.3 * (i / n));
      const th = (2 + rnd() * 3) * u;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const [ex, ey] = [sx + dx * len, sy + dy * len];
      const bd = blade.d;
      const pts: [number, number][] = [
        [sx - bd[0] * th, sy - bd[1] * th],
        [sx + bd[0] * th, sy + bd[1] * th],
        [ex + bd[0] * 0.6, ey + bd[1] * 0.6],
        [ex, ey],
      ];
      poly(pts, (px, py) => 0.16 + 0.3 * smooth(-1, 3, (py - (sy + (px - sx) * (dy / Math.max(dx, 0.1))))) * smooth(H * 0.2, H * 0.9, py), R.under);
      // a cross strut on some of them
      if (rnd() < 0.4) {
        const m = 0.4 + rnd() * 0.3;
        const [mx, my] = [sx + dx * len * m, sy + dy * len * m];
        poly(
          [
            [mx - 1, my - 3 * u],
            [mx + 1, my - 3 * u],
            [mx + 1, my + 3 * u],
            [mx - 1, my + 3 * u],
          ],
          0.2,
          R.under,
        );
      }
    }
  }

  // --- buttresses on the stem's left side, and a collar near its foot ------------
  {
    for (let i = 0; i < 4; i++) {
      const a = stem.a1 * (0.3 + i * 0.15 + rnd() * 0.05);
      const hw = stem.hw(a);
      const len = (8 + rnd() * 10) * u;
      const dep = (3 + rnd() * 5) * u;
      poly([toLayer(stem, a, -hw + 1), toLayer(stem, a + len, -hw + 1), toLayer(stem, a + len - 2 * u, -hw - dep), toLayer(stem, a + 1.5 * u, -hw - dep)], 0.34, R.mono);
    }
    // collar: a wide plate across the stem where it meets the clouds, glowing slits on its edge
    const ca = (stem.o[1] - H * 0.8) / Math.abs(stem.d[1]);
    const chw = stem.hw(ca) + 22 * u;
    const th = 5 * u;
    poly([toLayer(stem, ca, -chw), toLayer(stem, ca, chw), toLayer(stem, ca + th, chw - 3 * u), toLayer(stem, ca + th, -chw + 3 * u)], (_x, y) => 0.24 + 0.2 * smooth(H * 0.8 - th, H * 0.8, y), R.under);
    for (let k = -chw + 4 * u; k < chw - 4 * u; k += 4 * u) {
      if (hashInt(Math.round(k), 5, seed) < 0.35) continue;
      const [px, py] = toLayer(stem, ca + 1, k);
      put(px, py, 1, R.win, true);
      put(px + 1, py, 1, R.windim, true);
    }
  }

  // --- antennas off the blade's back -----------------------------------------------
  const antennaTips: [number, number][] = [];
  for (const [fa, len] of [
    [0.34, 26],
    [0.6, 44],
    [0.78, 18],
  ] as const) {
    const a = blade.a1 * fa;
    const [sx, sy] = toLayer(blade, a, -blade.hw(a) + 1);
    const ang = Math.atan2(blade.n[1], blade.n[0]) + Math.PI + 0.35;
    const L = len * u;
    for (let t = 0; t <= L; t++) put(sx + Math.cos(ang) * t, sy + Math.sin(ang) * t, 0.26, R.mono);
    antennaTips.push([sx + Math.cos(ang) * L, sy + Math.sin(ang) * L]);
  }

  // --- rim light: toward the planet (left), a weaker top edge, blue under-edges ----
  pix.rim(-1, 0, 0.32, 0.08);
  pix.rim(0, -1, 0.12, 0);
  {
    const edge: number[] = [];
    for (let y = 0; y < H - 1; y++)
      for (let x = 0; x < w - 1; x++) {
        if (!pix.solid(x, y)) continue;
        const i = (y * w + x) * 4;
        if ((pix.data[i + 1]! & 127) !== R.under) continue;
        if (!pix.solid(x + 1, y + 1) || !pix.solid(x, y + 1)) edge.push(x, y);
      }
    for (let i = 0; i < edge.length; i += 2) {
      const x = edge[i]!;
      const y = edge[i + 1]!;
      pix.setShade(x, y, pix.shadeAt(x, y) + 0.22 * smooth(H * 0.3, H * 0.85, y));
    }
  }

  // --- windows: sparse, in clusters, a pair of bright slots mid-blade, one warm light
  const windows: [number, number][] = [];
  const onFace = (p: Part, id: number, lx: number, ly: number): boolean => {
    const x = Math.floor(lx - x0);
    const y = Math.floor(ly);
    if (x < 0 || y < 0 || x >= w || y >= H || own[y * w + x] !== id) return false;
    const [a, b] = local(p, x + x0 + 0.5, y + 0.5);
    const v = b / p.hw(a);
    return v > -0.72 && v < 0.26;
  };
  for (const [p, id, dens] of [
    [blade, 2, 0.014],
    [stem, 1, 0.012],
  ] as const) {
    for (let a = p.a0 + 6; a < p.a1; a += 3 * u) {
      const cluster = hashInt(Math.floor(a / (22 * u)), id, seed + 50);
      if (cluster < 0.62) continue;
      for (let b = -p.hw(a); b < p.hw(a); b += 2 * u) {
        if (hashInt(Math.round(a), Math.round(b), seed + id) > dens * (cluster - 0.3) * 3) continue;
        const [lx, ly] = toLayer(p, a, b);
        if (!onFace(p, id, lx, ly)) continue;
        const bright = hashInt(Math.round(a), Math.round(b), seed + 9) < 0.35;
        put(lx, ly, 1, bright ? R.win : R.windim, true);
        if (hashInt(Math.round(a), 1, seed) < 0.4) put(lx + blade.d[0] * 1.2, ly + blade.d[1] * 1.2, 1, R.windim, true);
        windows.push([Math.floor(lx) + 0.5, Math.floor(ly) + 0.5]);
      }
    }
  }
  // the bright pair (the ref's two lit slots)
  {
    const a = blade.a1 * 0.4;
    for (const bo of [-4, 1]) {
      for (let t = 0; t < 7 * u; t++)
        for (let k = 0; k < Math.max(2, Math.round(2 * u)); k++) {
          const [lx, ly] = toLayer(blade, a + t, bo * u + k);
          put(lx, ly, 1, t < 2 ? R.windim : R.win, true);
        }
    }
    windows.push(toLayer(blade, a + 3 * u, -1 * u));
  }
  {
    const [lx, ly] = toLayer(stem, stem.a1 * 0.46, 6 * u);
    put(lx, ly, 1, R.warm, true);
    put(lx, ly + 1, 1, R.warm, true);
    put(lx + 1, ly, 1, R.warm, true);
  }
  for (const [tx, ty] of antennaTips.slice(1, 2)) put(tx, ty, 1, R.warm, true);

  // --- where the conduits are visible ----------------------------------------------
  let stemConduitMax = stem.a0;
  for (let a = stem.a0; a < stem.a1; a += 0.5) {
    const [lx, ly] = toLayer(stem, a, g.stemConduits[0]!);
    const x = Math.floor(lx - x0);
    const y = Math.floor(ly);
    if (x >= 0 && y >= 0 && x < w && y < H && own[y * w + x] === 1) stemConduitMax = a;
  }
  let bladeConduitMin = blade.a1;
  let bladeConduitMax = blade.a1;
  for (let a = blade.a1; a > blade.a0; a -= 0.5) {
    const ok = g.bladeConduits.every((c) => {
      const [lx, ly] = toLayer(blade, a, c);
      const x = Math.floor(lx - x0);
      const y = Math.floor(ly);
      return x >= 0 && y >= 0 && x < w && y < H && own[y * w + x] === 2;
    });
    if (ok) {
      if (bladeConduitMin === blade.a1) bladeConduitMax = a;
      bladeConduitMin = a;
    } else if (bladeConduitMin < blade.a1) break;
  }

  // surface points for accents: front-face points on both sections, above the clouds
  const surface: [number, number][] = [];
  for (let i = 0; i < 400 && surface.length < 60; i++) {
    const p = rnd() < 0.75 ? blade : stem;
    const id = p === blade ? 2 : 1;
    const a = p.a0 + rnd() * (p.a1 - p.a0);
    const b = (rnd() * 1.1 - 0.75) * p.hw(a);
    const [lx, ly] = toLayer(p, a, b);
    if (ly < 4 || ly > H * 0.72) continue;
    if (onFace(p, id, lx, ly)) surface.push([Math.round(lx), Math.round(ly)]);
  }
  void clamp;
  return { stemConduitMax, bladeConduitMin, bladeConduitMax, surface, windows };
}

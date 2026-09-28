// Near structures for amber-hollow: the stepped foundry block on the left, the
// raised bridge on the right, the low industrial roofs over the furnaces, the
// deck the figure stands on, and the dark foreground frame. Chunky, dark,
// lit only by rims, the furnaces (live, through sceneLight) and a few windows.

import { Pix, fbm1, hashInt, mulberry } from "../../engine/index.ts";
import { type FogFn, type WinSet } from "./city.ts";

type Put = (x: number, y: number, s: number, row?: number, emis?: boolean) => void;

function putter(pix: Pix, ox: number, row: number, fog?: FogFn): Put {
  return (x, y, s, r = row, emis = false) => pix.set(Math.round(x - ox), Math.round(y), emis ? 0.9 : s, r, fog ? fog(x, y) : 0, emis);
}

/** Stepped foundry block (the left ziggurat): tiers with lit lips, panels, pipes, a few windows. */
export function ziggurat(
  pix: Pix,
  ox: number,
  o: { x0: number; tiers: [number, number][]; ground: number; u: number; row: number; wins: WinSet; door: number; seed: number },
): [number, number][] {
  const put = putter(pix, ox, o.row);
  const r = mulberry(o.seed);
  const { u } = o;
  const c = 2;
  const tops: [number, number][] = [];
  o.tiers.forEach(([xr, top], k) => {
    const lip = Math.round(3 * u);
    // tier face (chunky 2 px blocks)
    for (let y = Math.round(top); y < o.ground; y += c)
      for (let x = Math.round(o.x0); x < xr; x += c) {
        let s = 0.2 - k * 0.01;
        const lx = x - o.x0;
        const ly = y - top;
        if (Math.floor(lx / (14 * u)) !== Math.floor((lx + c) / (14 * u))) s -= 0.05;
        if (Math.floor(ly / (18 * u)) !== Math.floor((ly + c) / (18 * u))) s += 0.04;
        s += (hashInt(Math.floor(x / 6), Math.floor(y / 6), o.seed + k) - 0.5) * 0.04;
        // the outer corner catches the furnace glow a little
        if (x >= xr - c * 2) s += 0.05;
        for (let yy = 0; yy < c; yy++) for (let xx = 0; xx < c; xx++) if (x + xx < xr) put(x + xx, y + yy, s);
      }
    // lip: overhangs 2 px, lit top, dark underside
    for (let x = Math.round(o.x0); x < xr + 2 * u; x++) {
      for (let y = Math.round(top) - lip; y < top; y++) put(x, y, y === Math.round(top) - lip ? 0.5 : 0.26);
      put(x, Math.round(top), 0.08);
    }
    // railing posts on the lip
    for (let x = Math.round(xr - 2); x > o.x0; x -= Math.round(9 * u)) for (let y = Math.round(top - lip - 6 * u); y < top - lip; y++) put(x, y, 0.2);
    for (let x = Math.round(o.x0); x < xr; x++) put(x, Math.round(top - lip - 6 * u), 0.26);
    // windows: short lit rows, and a glowing doorway on one tier
    for (let y = Math.round(top + 8 * u); y < o.ground - 4; y += Math.round(9 * u)) {
      if (r() < 0.45) continue;
      const a = Math.round(xr - (20 + r() * 60) * u);
      const n = Math.round((2 + r() * 5) * 2);
      for (let i = 0; i < n; i += 3)
        for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) put(a + i + xx, y + yy, 0.9, o.wins.rows[hashInt(a + i, y, 1) < 0.8 ? 0 : 1]!, true);
    }
    tops.push([xr, top - lip]);
  });
  // a big pipe climbing the tiers, with flanges
  const px = Math.round(o.tiers[1]![0] - 30 * u);
  for (let y = Math.round(o.tiers[1]![1]); y < o.ground; y++)
    for (let k = 0; k < Math.round(5 * u); k++) {
      const flange = (y - o.tiers[1]![1]) % Math.round(22 * u) < 2;
      put(px + k - (flange ? 1 : 0), y, k === 1 ? 0.34 : k === 0 ? 0.24 : 0.14);
      if (flange) put(px + Math.round(5 * u), y, 0.2);
    }
  // doorway on the lowest tier: warm light spilling out
  const [dx0, dt] = o.tiers[0]!;
  const dx = Math.round(dx0 - 46 * u);
  const dy = Math.round(dt + 14 * u);
  for (let y = dy; y < dy + 18 * u; y++) for (let x = dx; x < dx + 10 * u; x++) put(x, y, 0.9, o.door, true);
  return tops;
}

/** The raised bridge on the right: deck, railing, truss underneath, pillars, a tall pylon. */
export function bridge(
  pix: Pix,
  ox: number,
  o: { x0: number; x1: number; y: number; H: number; u: number; row: number; lamp: number; seed: number },
): [number, number] {
  const put = putter(pix, ox, o.row);
  const { u, y, H } = o;
  const th = Math.round(9 * u);
  for (let x = Math.round(o.x0); x < o.x1; x++) {
    for (let yy = y; yy < y + th; yy++) {
      let s = 0.2;
      if (yy === y) s = 0.46;
      if (yy === y + 1) s = 0.3;
      if (yy === y + th - 1) s = 0.12;
      if ((x - o.x0) % Math.round(24 * u) === 0) s -= 0.04;
      put(x, yy, s);
    }
    // railing
    if ((x - o.x0) % Math.round(8 * u) === 0) for (let yy = y - Math.round(8 * u); yy < y; yy++) put(x, yy, 0.22);
    put(x, y - Math.round(8 * u), 0.3);
    put(x, y - Math.round(4 * u), 0.18);
  }
  // truss under the deck
  const tw = Math.round(14 * u);
  for (let x = Math.round(o.x0); x < o.x1; x++) {
    const ph = ((x - o.x0) % (tw * 2)) / tw;
    const zy = Math.round(y + th + (ph < 1 ? ph : 2 - ph) * tw);
    put(x, zy, 0.16);
    put(x, y + th + tw, 0.18);
  }
  // pillars to the ground
  const pillars = [o.x0 + 40 * u, o.x0 + 150 * u, o.x0 + 260 * u];
  for (const p of pillars)
    for (let yy = y + th; yy < H + 2; yy++)
      for (let k = 0; k < Math.round(12 * u); k++) put(p + k, yy, k < 2 ? 0.28 : 0.16 - ((yy - y) % Math.round(30 * u) < 2 ? 0.04 : 0));
  // a tall pylon rising above the bridge with a lamp
  const px = Math.round(o.x0 + 118 * u);
  const top = Math.round(H * 0.38);
  for (let yy = top; yy < y; yy++)
    for (let k = 0; k < Math.round(8 * u); k++) {
      let s = k < 2 ? 0.3 : 0.17;
      if ((yy - top) % Math.round(16 * u) === 0) s += 0.08;
      put(px + k, yy, s);
    }
  for (let yy = top - Math.round(18 * u); yy < top; yy++) put(px + Math.round(4 * u), yy, 0.2);
  for (let x = px - Math.round(10 * u); x < px + Math.round(18 * u); x++) for (let yy = top; yy < top + 3 * u; yy++) put(x, yy, yy === top ? 0.42 : 0.2);
  return [px + Math.round(4 * u), top - Math.round(18 * u) - 1];
}

/** Low industrial roofs between the city and the viewer: tanks, sheds, chimneys, pipes. */
export function lowRoofs(
  pix: Pix,
  ox: number,
  o: { x0: number; x1: number; ground: number; minTop: number; maxTop: number; u: number; row: number; wins: WinSet; seed: number },
): [number, number][] {
  const put = putter(pix, ox, o.row);
  const r = mulberry(o.seed);
  const { u } = o;
  const chimneys: [number, number][] = [];
  let x = o.x0;
  while (x < o.x1) {
    const kind = r();
    const w = Math.round((16 + r() * 50) * u);
    const top = Math.round(o.minTop + r() * (o.maxTop - o.minTop));
    if (kind < 0.25) {
      // a tank: rounded top
      const cx = x + w / 2;
      const rad = w / 2;
      for (let xx = x; xx < x + w; xx++) {
        const d = (xx + 0.5 - cx) / rad;
        const tt = Math.round(top + rad * 0.5 * (1 - Math.sqrt(Math.max(0, 1 - d * d))));
        for (let yy = tt; yy < o.ground; yy++)
          put(xx, yy, 0.18 + (d < -0.5 ? 0.06 : 0) + (yy === tt ? 0.16 : 0) + ((yy - top) % Math.round(10 * u) === 0 ? 0.03 : 0));
      }
    } else if (kind < 0.7) {
      // a shed with a sawtooth roof
      const tooth = Math.round(8 * u);
      for (let xx = x; xx < x + w; xx++) {
        const ph = (xx - x) % tooth;
        const tt = top + Math.round((ph / tooth) * 5 * u);
        for (let yy = tt; yy < o.ground; yy++) put(xx, yy, 0.17 + (yy === tt ? 0.14 : 0) + (ph === 0 ? -0.03 : 0));
      }
      for (let yy = top + Math.round(10 * u); yy < o.ground - 2; yy += Math.round(6 * u))
        for (let xx = x + 2; xx < x + w - 2; xx += 3) if (hashInt(xx, yy, o.seed) < 0.18) put(xx, yy, 0.9, o.wins.rows[0], true);
    } else {
      // a flat block with a gantry
      for (let xx = x; xx < x + w; xx++) for (let yy = top; yy < o.ground; yy++) put(xx, yy, 0.19 + (yy === top ? 0.15 : 0));
      for (let xx = x - Math.round(6 * u); xx < x + w + Math.round(6 * u); xx++) put(xx, top - Math.round(10 * u), 0.2);
      for (const gx of [x, x + w - 1]) for (let yy = top - Math.round(10 * u); yy < top; yy++) put(gx, yy, 0.2);
    }
    if (r() < 0.55) {
      // chimney
      const cx = x + Math.round(w * (0.2 + r() * 0.6));
      const ch = Math.round((24 + r() * 50) * u);
      const cw = Math.max(3, Math.round((3 + r() * 4) * u));
      for (let yy = top - ch; yy < top; yy++)
        for (let k = 0; k < cw; k++) put(cx + k, yy, 0.2 + (k === 0 ? 0.08 : 0) + ((yy - top + ch) % Math.round(12 * u) === 0 ? 0.05 : 0));
      chimneys.push([cx + cw / 2, top - ch]);
    }
    x += w + Math.round(r() * 8 * u);
  }
  return chimneys;
}

/** The metal gantry the figure stands on: deck plate, rails behind, truss and posts, a lamp post. */
export function deck(pix: Pix, ox: number, o: { x0: number; end: number; deck: number; H: number; row: number; lamp: number; lampAt: [number, number] }): void {
  const put = putter(pix, ox, o.row);
  const { deck: dy, end } = o;
  const th = 5;
  for (let x = Math.round(o.x0); x <= end; x++) {
    const plate = Math.floor((x + 4000) / 16);
    for (let y = dy; y < dy + th; y++) {
      let s = y === dy ? 0.62 : y === dy + 1 ? 0.34 : 0.2 - (y - dy) * 0.02;
      if ((x + 4000) % 16 === 0 && y > dy) s -= 0.08;
      s += (hashInt(plate, 1, 3) - 0.5) * 0.04;
      put(x, y, s);
    }
    // I-beam under the plate, then open truss down to the bottom of the frame
    put(x, dy + th, 0.1);
    for (let y = dy + th + 1; y < dy + th + 5; y++) put(x, y, (x + 4000) % 32 < 3 ? 0.18 : -1);
    put(x, dy + th + 5, 0.16);
    // rails behind the figure
    put(x, dy - 34, 0.4);
    put(x, dy - 33, 0.18);
    put(x, dy - 17, 0.22);
    if ((x + 4000) % 30 === 0) for (let y = dy - 34; y < dy; y++) (put(x, y, 0.26), put(x + 1, y, 0.14));
  }
  // clear the "-1" gaps in the I-beam web
  for (let y = dy + th + 1; y < dy + th + 5; y++) for (let x = Math.round(o.x0); x <= end; x++) if ((x + 4000) % 32 >= 3) pix.clear(Math.round(x - ox), y);
  // truss legs down out of frame
  for (let x = Math.round(o.x0) + 12; x <= end; x += 64)
    for (let y = dy + th + 6; y < o.H + 2; y++) {
      put(x, y, 0.2);
      put(x + 1, y, 0.12);
      const zig = (y - dy) % 20;
      put(x + 2 + zig, y, 0.12);
    }
  // end cap and a post with a hanging lamp
  for (let y = dy - 36; y < dy + th + 6; y++) for (let k = 0; k < 3; k++) put(end - k, y, k === 2 ? 0.34 : 0.16);
  const [lx, ly] = o.lampAt;
  const post = lx + 12;
  for (let y = ly - 6; y < dy; y++) for (let k = 0; k < 2; k++) put(post + k, y, k === 0 ? 0.36 : 0.16);
  for (let x = lx - 1; x <= post; x++) put(x, ly - 6, 0.3);
  for (let y = ly - 5; y < ly - 1; y++) put(lx + 1, y, 0.22);
  // shade (cone) and the bulb
  for (let y = ly - 1; y < ly + 3; y++) for (let x = lx - 2 - (y - ly + 1); x <= lx + 4 + (y - ly + 1); x++) put(x, y, y === ly - 1 ? 0.4 : 0.22);
  for (let x = lx - 1; x <= lx + 3; x++) put(x, ly + 3, 0.9, o.lamp, true);
  // a crate and a coil of chain for scale
  for (let y = dy - 12; y < dy; y++) for (let x = end - 44; x < end - 30; x++) put(x, y, y === dy - 12 ? 0.44 : (x - end + 44) % 7 === 0 ? 0.12 : 0.22);
  for (let x = end - 28; x < end - 20; x++) (put(x, dy - 2, 0.3), put(x, dy - 1, 0.18));
}

/** Dark foreground frame: a pipe run bottom left, a diagonal girder bottom right. */
export function foreground(pix: Pix, ox: number, o: { W: number; H: number; u: number; row: number }): void {
  const put = putter(pix, ox, o.row);
  const { W, H, u } = o;
  const c = 3;
  // pipe bundle bottom left
  const pipes = [
    [H - 30 * u, 12 * u],
    [H - 14 * u, 16 * u],
  ] as const;
  for (const [py, pr] of pipes)
    for (let x = Math.round(-W * 0.3); x < W * 0.2; x += c) {
      const end = W * 0.2 - (fbm1(py, 3, 1) * 20 + 30) * u;
      if (x > end) continue;
      const flange = Math.floor(x / (60 * u)) !== Math.floor((x + c) / (60 * u));
      for (let y = Math.round(py - pr / 2 - (flange ? 2 : 0)); y < py + pr / 2 + (flange ? 2 : 0); y += c) {
        // a round pipe: a lit crown, a dark core, a faint bounce from below
        const t = (y - (py - pr / 2)) / pr;
        const s = 0.06 + (t < 0.18 ? 0.18 : t < 0.32 ? 0.1 : t > 0.85 ? 0.07 : 0) + (flange ? 0.06 : 0);
        for (let yy = 0; yy < c; yy++) for (let xx = 0; xx < c; xx++) put(x + xx, y + yy, s);
      }
    }
  // diagonal girder bottom right
  const a: [number, number] = [W * 0.9, H + 14];
  const b: [number, number] = [W * 1.35, H * 0.58];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / L;
  const dy = (b[1] - a[1]) / L;
  const w = 20 * u;
  for (let y = Math.round(H * 0.45); y < H; y += c)
    for (let x = Math.round(W * 0.7); x < W * 1.4; x += c) {
      const rx = x - a[0];
      const ry = y - a[1];
      const al = rx * dx + ry * dy;
      const pe = -dy * rx + dx * ry;
      if (al < 0 || al > L || Math.abs(pe) > w / 2) continue;
      const n = pe / (w / 2);
      // I-section: flanges on the edges, a darker web with lightening holes
      let s = Math.abs(n) > 0.7 ? 0.1 : 0.05;
      if (n < -0.82) s += 0.14;
      // stiffener plates across the web, rivets along the flange
      if (Math.abs(n) < 0.7 && (al / (34 * u)) % 1 < 0.08) s += 0.05;
      if (n > 0.72 && n < 0.86 && Math.floor(al / c) % 4 === 0) s += 0.06;
      for (let yy = 0; yy < c; yy++) for (let xx = 0; xx < c; xx++) put(x + xx, y + yy, s);
    }
}

/** The near-left overhang: a dark ceiling edge cropped by the frame, with a hanging chain. */
export function overhang(pix: Pix, ox: number, o: { W: number; H: number; u: number; row: number }): [number, number] {
  const put = putter(pix, ox, o.row);
  const { W, H, u } = o;
  const x1 = W * 0.26;
  for (let x = Math.round(-W * 0.3); x < x1; x++) {
    const bot = H * 0.07 + (x > x1 - 30 * u ? -((x - (x1 - 30 * u)) / (30 * u)) * H * 0.04 : 0) + Math.floor(fbm1(x / (30 * u), 9, 2) * 3) * 2 * u;
    for (let y = 0; y < bot; y++) put(x, y, 0.07 + (y > bot - 2 ? 0.1 : 0));
    // an I-beam under it
    if (x < x1 - 36 * u) {
      const by = Math.round(H * 0.07 + 6 * u);
      put(x, by, 0.2);
      put(x, by + 7 * u, 0.12);
      if (Math.round(x) % Math.round(40 * u) === 0) for (let y = Math.round(bot); y < by + 8 * u; y++) put(x, y, 0.1);
    }
  }
  return [Math.round(W * 0.16), Math.round(H * 0.07 + 13 * u)];
}

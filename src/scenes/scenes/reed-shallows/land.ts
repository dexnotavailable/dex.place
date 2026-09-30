// B1's near art at the player plane (depth 1), drawn exactly where the room's
// collision is: the stone stair down the yard's embankment, the old boardwalk
// on its posts with the broken gap, the reed channel's banks, the stone steps
// and the earth bank up to the causeway. Sized in H (P, the locked player
// height), pixel data only: shade + ramp per texel, lit live by sceneLight().

import { Pix, fbm, fbm1, hashInt, rockInfo } from "../../engine/index.ts";
import { B1, type Geo } from "./geo.ts";

export interface ShoreRows {
  wood: number;
  stone: number;
  moss: number;
  earth: number;
  iron: number;
}

/** The embankment's stair: the top of the step at world x (elevation), or NaN off the stair. */
function stairTop(wx: number): number {
  const n = Math.ceil((B1.yard - B1.deck) / 0.2 - 1e-6);
  const rise = (B1.yard - B1.deck) / n;
  const i = Math.floor((wx - B1.stairX) / 0.3);
  if (wx < B1.stairX || i >= n) return Number.NaN;
  return B1.yard - rise * (i + 1);
}

export function stairEnd(): number {
  const n = Math.ceil((B1.yard - B1.deck) / 0.2 - 1e-6);
  return B1.stairX + 0.3 * n;
}

export function buildShore(pix: Pix, g: Geo, x0: number, y0: number, r: ShoreRows): void {
  const P = g.P;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const L = (x: number): number => x - x0;
  const T = (y: number): number => y - y0;
  const set = (x: number, y: number, s: number, row: number): void => pix.set(L(x), T(y), s, row);
  const wl = g.Y(B1.water);
  const bottom = wl + 2;
  const H1 = P; // px per H at this mode
  const u = g.u;
  const course = n(0.1);
  /** The stair's dressed side wall: small blocks in courses under each tread. */
  const wall = (x: number, y: number, ty: number): [number, number] => {
    const c = Math.floor((y - ty) / course);
    const inC = (y - ty) % course;
    const bw = n(0.22 + 0.14 * hashInt(c, Math.floor(x / n(0.3)), 17));
    const bx = Math.floor((x + 8192) / bw);
    const inB = (x + 8192) % bw;
    let s = 0.4 + 0.1 * (hashInt(bx, c + ty, 19) - 0.5);
    if (inC === 0 || inB === 0) s = 0.1;
    else if (inC === 1) s += 0.06;
    return [s, r.stone];
  };
  /**
   * The embankment under the stair: bedded rocks (lit facets, cracks) packed in dark earth, moss
   * in the seams higher up, all darker and wetter toward the water. Facets, not noise blobs.
   */
  const bank = (x: number, y: number): [number, number] => {
    const wet = Math.min(1, Math.max(0, 1 - (wl - y) / (P * 1.2)));
    const f = rockInfo(x, y, { seed: 61, cell: Math.round(8 * u), flatten: 1.6, light: [0.6, -1], base: 0.36, contrast: 0.5, cracks: 0.5 });
    if (f.crack) return [0.06, r.earth];
    const moss = fbm(x / (16 * u), y / (10 * u), 62, 2) > 0.6 && wet < 0.4;
    if (f.cell < 0.58) return [f.shade - 0.12 * wet, r.stone];
    if (moss) return [0.18 + f.shade * 0.3, r.moss];
    return [0.1 + f.shade * 0.22 - 0.05 * wet, r.earth];
  };


  // --- the yard's embankment and its stair --------------------------------------------
  const sEnd = stairEnd();
  const xa = g.X(B1.x0) - 8;
  const xb = g.X(sEnd);
  for (let x = xa; x < xb + n(0.35); x++) {
    const wx = B1.x0 + (x - g.X(B1.x0)) / H1;
    let top = wx < B1.stairX ? B1.yard : stairTop(wx);
    // past the last step the embankment's toe slopes into the water under the first planks
    let toe = false;
    if (Number.isNaN(top)) {
      toe = true;
      top = B1.deck - (wx - sEnd) * 0.9;
    }
    const ty = g.Y(top);
    const edge = !toe && hashInt(Math.floor((wx - B1.stairX) / 0.3), 3, 5) >= 0.5 ? 1 : 0;
    for (let y = ty; y < bottom; y++) {
      const dy = y - ty;
      const [sh, row] = toe ? bank(x, y) : dy === 0 ? [0.74 - edge * 0.12, r.stone] : dy === 1 ? [0.52, r.stone] : dy < n(0.05) ? [0.34, r.stone] : dy < n(0.22) ? wall(x, y, ty) : bank(x, y);
      let s = sh;
      let rw = row;
      // moss and weed near the waterline, wet dark band
      if (y > wl - n(0.14) && y <= wl + 1) {
        s = Math.min(s, 0.18);
        if (hashInt(x, y, 23) < 0.35) rw = r.moss;
      }
      set(x, y, s, rw);
    }
    // grass on the yard's lip
    if (wx < B1.stairX && hashInt(x, 1, 29) < 0.5) for (let k = 1; k <= 1 + Math.floor(hashInt(x, 2, 29) * n(0.08)); k++) set(x, ty - k, 0.4 + 0.1 * k, r.moss);
  }

  // --- boardwalk runs: planks, stringer, posts into the water -------------------------
  const th = n(0.1);
  const board = n(0.1);
  const pw = n(0.07);
  const deck = g.Y(B1.deck);
  const run = (a: number, b: number, o: { brokenW?: boolean; brokenE?: boolean }): void => {
    const xa2 = g.X(a), xb2 = g.X(b);
    for (let x = xa2; x < xb2; x++) {
      // a broken end: plank ends ragged over the last few px
      const fromE = xb2 - 1 - x, fromW = x - xa2;
      const rag = (o.brokenE && fromE < n(0.12)) || (o.brokenW && fromW < n(0.12));
      const bi = Math.floor((x + 8192) / board);
      if (rag && hashInt(bi, x, 31) < 0.45) continue;
      const sh = 0.28 + (hashInt(bi, 1, 9) - 0.5) * 0.1;
      const worn = hashInt(bi, 2, 9) < 0.2;
      for (let y = deck; y < deck + th; y++) {
        const dy = y - deck;
        let s = dy === 0 ? (worn ? 0.66 : 0.84) : dy === 1 ? 0.5 : sh - dy * 0.03;
        if ((x + 8192) % board === 0 && dy > 0) s -= 0.12;
        if (dy === (th >> 1) + 1 && (x + 8192) % board === 2) s += 0.12;
        set(x, y, s, r.wood);
      }
      for (let k = 0; k < n(0.04); k++) set(x, deck + th + k, 0.12 - k * 0.03, r.wood);
    }
    const step = n(0.55);
    for (let px = xa2 + n(0.1); px < xb2 - pw; px += step) {
      for (let y = deck + th; y <= wl + 1; y++)
        for (let k = 0; k < pw; k++) {
          const wet = y > wl - n(0.05);
          set(px + k, y, (k === 0 ? 0.3 : 0.13) - (wet ? 0.07 : 0) - (y > wl ? 0.05 : 0), r.wood);
        }
      const by = deck + th + n(0.04);
      for (let k = 0; k < n(0.12); k++) set(px + pw + k, by + Math.round(k * 0.5), 0.16, r.wood);
    }
  };
  run(B1.walks[0]![0], B1.walks[0]![1], { brokenE: true });
  run(B1.walks[1]![0], B1.walks[1]![1], { brokenW: true });
  run(B1.walks[2]![0], B1.walks[2]![1], {});
  // the gap: two posts still standing, one plank hanging from the west end into the water
  for (const gx of [B1.gap[0] + 0.25, B1.gap[1] - 0.3]) {
    const px = g.X(gx);
    for (let y = deck - n(0.06); y <= wl + 1; y++) for (let k = 0; k < pw; k++) set(px + k, y, (k === 0 ? 0.32 : 0.12) - (y > wl ? 0.06 : 0), r.wood);
  }
  {
    const x1 = g.X(B1.gap[0]) - n(0.02);
    const len = n(0.55);
    for (let i = 0; i < len; i++) {
      const x = x1 + Math.round(i * 0.55);
      const y = deck + Math.round(i * 0.8);
      for (let k = 0; k < n(0.06); k++) set(x, y + k, k === 0 ? 0.6 : 0.24, r.wood);
    }
  }
  // the channel's west end post (the bridge lands here once cut)
  {
    const px = g.X(B1.channel[0]) - pw;
    for (let y = deck - n(0.3); y <= wl + 1; y++) for (let k = 0; k < pw + 1; k++) set(px + k, y, (k === 0 ? 0.36 : 0.14) - (y > wl ? 0.06 : 0), r.wood);
    for (let k = -1; k <= pw + 1; k++) set(px + k, deck - n(0.3), 0.46, r.wood);
  }

  // --- the east steps up to the bank, and the earth bank toward the causeway ----------
  const ex = B1.eastStairX;
  const nSteps = Math.ceil((B1.east - B1.deck) / 0.2 - 1e-6);
  const rise = (B1.east - B1.deck) / nSteps;
  for (let x = g.X(ex); x < g.X(B1.x1) + 8; x++) {
    const wx = ex + (x - g.X(ex)) / H1;
    const i = Math.floor((wx - ex) / 0.3);
    const onStair = i < nSteps;
    const top = onStair ? B1.deck + rise * (i + 1) : B1.east;
    const ty = g.Y(top);
    for (let y = ty; y < bottom; y++) {
      const dy = y - ty;
      let [s, row] = dy === 0 ? [onStair ? 0.72 : 0.56, onStair ? r.stone : r.moss] : dy === 1 ? [0.48, onStair ? r.stone : r.earth] : onStair && dy < n(0.05) ? [0.34, r.stone] : onStair && dy < n(0.22) ? wall(x, y, ty) : !onStair && dy < n(0.08) ? [0.34 + 0.1 * (fbm1(x / 4, 51, 2) - 0.5), r.earth] : bank(x, y);
      if (y > wl - n(0.14) && y <= wl + 1) {
        s = Math.min(s, 0.18);
        if (hashInt(x, y, 43) < 0.3) row = r.moss;
      }
      set(x, y, s, row);
    }
    // tufts on the bank
    if (!onStair && hashInt(x, 3, 47) < 0.55) for (let k = 1; k <= 1 + Math.floor(hashInt(x, 4, 47) * n(0.1)); k++) set(x, ty - k, 0.38 + 0.12 * (k & 1), r.moss);
  }
}

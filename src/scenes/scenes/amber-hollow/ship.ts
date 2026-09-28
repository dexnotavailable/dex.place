// The freighter that crosses the hollow: authored as a small pixel sprite with
// the Pix rasterisers at build time, then packed into a GLSL constant (4 bits
// per pixel) so the ship layer can move it, light it live and fog it like
// everything else. Codes: 0 empty, 1..11 hull shade (code-1)/10, 12 window,
// 13 headlight, 14 engine, 15 nav light.

import { Pix } from "../../engine/index.ts";

export interface ShipSprite {
  w: number;
  h: number;
  stride: number;
  words: number[];
  /** Headlight centres (sprite px). */
  heads: [number, number][];
  /** Nose point where the light cone starts (sprite px). */
  nose: [number, number];
}

export function buildShip(u: number): ShipSprite {
  const S = (v: number): number => v * u;
  const w = Math.ceil(S(118));
  const h = Math.ceil(S(30));
  const pix = new Pix(w, h);
  const P = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [S(x), S(y)]);
  const code = (c: number) => ({ row: 0, shade: c / 15 });
  // nose on the left: the ship travels left
  pix.poly(
    P([
      [0, 15],
      [8, 11],
      [30, 9],
      [66, 7],
      [100, 8],
      [114, 10],
      [114, 18],
      [98, 21],
      [62, 22],
      [22, 21],
      [6, 19],
    ]),
    code(3),
  );
  // superstructure / bridge
  pix.poly(
    P([
      [34, 9],
      [42, 4],
      [72, 3],
      [82, 7],
    ]),
    code(4),
  );
  // dorsal fin at the stern
  pix.poly(
    P([
      [92, 8],
      [99, 1],
      [106, 1],
      [108, 9],
    ]),
    code(4),
  );
  // keel and a ventral fin
  pix.poly(
    P([
      [28, 21],
      [80, 22],
      [70, 26],
      [38, 25],
    ]),
    code(2),
  );
  pix.poly(
    P([
      [86, 20],
      [96, 20],
      [92, 28],
    ]),
    code(2),
  );
  // engine block at the stern
  pix.rect(S(106), S(9), S(10), S(11), code(3));
  // top rim: every solid pixel with empty above gets lit, the one under it half lit
  const get = (x: number, y: number): number => (pix.solid(x, y) ? Math.round(pix.shadeAt(x, y) * 15) : 0);
  const out: number[] = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = get(x, y);
      if (!c) continue;
      if (!pix.solid(x, y - 1)) c = 8;
      else if (!pix.solid(x, y - 2)) c = Math.max(c, 5);
      else if (!pix.solid(x, y + 1)) c = 2;
      // panel seams
      else if (x % Math.round(S(11)) === 0 && y > S(10) && y < S(19)) c = 1;
      out[y * w + x] = c;
    }
  const set = (x: number, y: number, c: number): void => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < w && y < h && out[y * w + x]) out[y * w + x] = c;
  };
  // bridge windows
  for (let x = S(46); x < S(72); x += Math.max(2, Math.round(S(3)))) set(x, S(6), 12);
  // hull window rows
  for (let x = S(20); x < S(96); x += Math.max(2, Math.round(S(4)))) if ((x * 7) % 5 < 3) set(x, S(14), 12);
  // headlights: two 2x2 lamps at the nose
  const heads: [number, number][] = [
    [S(3), S(15)],
    [S(9), S(12)],
  ];
  for (const [hx, hy] of heads) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) set(hx + dx, hy + dy, 13);
  // engine glow at the stern
  for (let y = S(11); y < S(18); y++) (set(S(115), y, 14), set(S(114), y, 14));
  // nav light on the fin
  set(S(100), S(2), 15);
  set(S(101), S(2), 15);
  const stride = Math.ceil(w / 8);
  const words: number[] = new Array(stride * h).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = out[y * w + x]!;
      if (c) words[y * stride + (x >> 3)]! |= c << ((x & 7) * 4);
    }
  for (let i = 0; i < words.length; i++) words[i] = words[i]! >>> 0;
  return { w, h, stride, words, heads: heads.map(([x, y]) => [Math.round(x) + 1, Math.round(y) + 1]), nose: [Math.round(S(1)), Math.round(S(15))] };
}

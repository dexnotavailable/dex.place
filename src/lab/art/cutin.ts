// Ultimate cut-in art: a close-up strip of her eyes, drawn in code at native
// pixel size (the cut-in never scales a sprite). Shown inside a dark band.

type RGB8 = [number, number, number];
const hex = (h: string): RGB8 => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const COL = {
  skin: hex("#fbd9c8"),
  skinSh: hex("#eeb4a4"),
  skinDeep: hex("#d98f88"),
  blush: hex("#f39c9c"),
  hair: hex("#1c2140"),
  hairLit: hex("#34406e"),
  hairSheen: hex("#5f71b4"),
  hairDk: hex("#0b0c1a"),
  lash: hex("#140c16"),
  lid: hex("#b86a74"),
  white: hex("#f8f1f4"),
  whiteSh: hex("#c9bdd4"),
  irisDk: hex("#123a70"),
  iris: hex("#1f64b0"),
  irisMid: hex("#3a9ae0"),
  irisLt: hex("#7fd0ff"),
  irisGlow: hex("#d4f4ff"),
  pupil: hex("#081428"),
  hi: hex("#ffffff"),
  gold: hex("#f5cf62"),
};

export function cutinEyes(w = 208, h = 52): { w: number; h: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(w * h * 4);
  const put = (x: number, y: number, c: RGB8): void => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };
  // skin with a soft top shadow (bangs) in two hard bands
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, y < 7 ? COL.skinSh : COL.skin);
  // blush hatching under the eyes
  const blush = (cx: number): void => {
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) put(cx + k * 3 - j, 40 + j, COL.blush);
  };
  blush(44);
  blush(150);

  const eye = (cx: number, cy: number, mirror: number): void => {
    const W = 22, H = 13;
    // almond: upper lid arc and lower lid arc
    const upper = (u: number): number => cy - H * Math.pow(Math.sin(Math.PI * u), 0.75) * (0.85 + 0.15 * (mirror > 0 ? u : 1 - u));
    const lower = (u: number): number => cy + H * 0.55 * Math.pow(Math.sin(Math.PI * u), 1.1);
    for (let x = -W; x <= W; x++) {
      const u = (x + W) / (2 * W);
      const y0 = Math.round(upper(u)), y1 = Math.round(lower(u));
      for (let y = y0; y <= y1; y++) put(cx + x, y, y < y0 + 2 ? COL.whiteSh : COL.white);
    }
    // iris: tall ellipse clipped by the lids, colour bands dark top -> glow bottom
    const ix = cx + mirror * 2, iy = cy - 1, rx = 9, ry = 12;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
        const px = ix + x, py = iy + y;
        const u = (px - cx + W) / (2 * W);
        if (py < upper(u) || py > lower(u)) continue;
        const t = (y + ry) / (2 * ry);
        const edge = (x * x) / (rx * rx) + (y * y) / (ry * ry) > 0.72;
        const c = edge ? COL.irisDk : t < 0.34 ? COL.irisDk : t < 0.52 ? COL.iris : t < 0.7 ? COL.irisMid : t < 0.86 ? COL.irisLt : COL.irisGlow;
        put(px, py, c);
      }
    }
    // pupil
    for (let y = -5; y <= 4; y++) for (let x = -2; x <= 2; x++) if ((x * x) / 5 + (y * y) / 24 <= 1) put(ix + x, iy + y - 1, COL.pupil);
    // highlights
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) put(ix + 3 + x, iy - 7 + y, COL.hi);
    put(ix - 4, iy + 5, COL.hi);
    put(ix - 3, iy + 5, COL.hi);
    put(ix - 4, iy + 6, COL.irisGlow);
    // upper lash: thick, with a flick at the outer corner
    for (let x = -W - 1; x <= W + 1; x++) {
      const u = Math.min(1, Math.max(0, (x + W) / (2 * W)));
      const y = Math.round(upper(u));
      const th = u > 0.15 && u < 0.85 ? 3 : 2;
      for (let k = 0; k < th; k++) put(cx + x, y - k, COL.lash);
    }
    const outer = mirror > 0 ? -W : W;
    for (let k = 0; k < 5; k++) {
      put(cx + outer - mirror * k, cy - 1 - k * 0.6, COL.lash);
      put(cx + outer - mirror * k, cy - 2 - k * 0.6, COL.lash);
    }
    // lower lash hint and lid crease
    for (let x = -W + 4; x <= W - 6; x++) {
      const u = (x + W) / (2 * W);
      if ((x & 1) === 0 || Math.abs(x) > W - 9) put(cx + x, Math.round(lower(u)) + 1, COL.lid);
    }
    for (let x = -W + 5; x <= W - 5; x++) {
      const u = (x + W) / (2 * W);
      put(cx + x, Math.round(upper(u)) - 5, COL.skinDeep);
    }
  };
  eye(62, 30, 1);
  eye(146, 30, -1);

  // bangs across the top: tapered locks with a sheen line
  const lock = (x0: number, len: number, wid: number, lean: number): void => {
    for (let y = -2; y < len; y++) {
      const t = y / len;
      const hw = wid * (1 - t) * 0.5 + 0.4;
      const cx = x0 + lean * t * len * 0.35;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const c = x === Math.round(cx - hw * 0.3) && t < 0.6 ? COL.hairSheen : x < cx - hw * 0.4 ? COL.hairLit : COL.hair;
        put(x, y, c);
      }
    }
  };
  for (let y = 0; y < 5; y++) for (let x = 0; x < w; x++) put(x, y, y < 3 ? COL.hairDk : COL.hair);
  lock(8, 36, 16, 0.2);
  lock(26, 14, 12, 0.5);
  lock(44, 11, 10, -0.3);
  lock(96, 20, 11, 0.2);
  lock(104, 24, 9, -0.4);
  lock(126, 12, 12, 0.3);
  lock(172, 15, 12, -0.3);
  lock(196, 40, 18, -0.2);
  // gold hair pin glint at the left
  put(14, 8, COL.gold);
  put(13, 9, COL.gold);
  put(15, 9, COL.gold);
  put(14, 10, COL.gold);
  put(14, 9, COL.hi);
  // slanted ends so the strip sits in the band like a cut, not a pasted rectangle
  const slant = 14;
  for (let y = 0; y < h; y++) {
    const cut = Math.round(slant * (1 - y / (h - 1)));
    const rightEdge = w - 1 - (slant - cut);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x < cut || x > rightEdge) data[i + 3] = 0;
      else if (x === cut || x === rightEdge) {
        data[i] = COL.gold[0];
        data[i + 1] = COL.gold[1];
        data[i + 2] = COL.gold[2];
      }
    }
  }
  return { w, h, data };
}

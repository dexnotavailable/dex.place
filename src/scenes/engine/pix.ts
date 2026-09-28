// Pix: a CPU pixel buffer that a scene builds with code, uploaded as a layer.
// It never stores colours. Each texel is data the shader turns into colour:
//
//   R  shade 0..255 (quantised to the ramp's bands at draw time, so runtime
//      light can push a pixel up a band)
//   G  ramp row (0..127); +128 marks an emissive pixel (window, lamp)
//   B  extra fog 0..255 on top of the layer's own fog
//   A  255 solid, 0 empty
//
// Also here: rasterisers (no anti-aliasing anywhere) and silhouette shape
// grammars: terrain (rock, cliffs, mountain ranges), skyline, megastructure.

import { clamp, fbm, fbm1, hashInt, mulberry, ridged, smooth } from "./noise.ts";

export interface Paint {
  row: number;
  shade: number | ((x: number, y: number) => number);
  fog?: number | ((x: number, y: number) => number);
  emissive?: boolean;
}

export class Pix {
  readonly data: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h * 4);
  }

  set(x: number, y: number, shade: number, row: number, fog = 0, emissive = false): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = clamp(shade) * 255;
    this.data[i + 1] = (row & 127) | (emissive ? 128 : 0);
    this.data[i + 2] = clamp(fog) * 255;
    this.data[i + 3] = 255;
  }

  paint(x: number, y: number, p: Paint): void {
    const sh = typeof p.shade === "number" ? p.shade : p.shade(x, y);
    const fg = p.fog === undefined ? 0 : typeof p.fog === "number" ? p.fog : p.fog(x, y);
    this.set(x, y, sh, p.row, fg, p.emissive);
  }

  solid(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.data[(y * this.w + x) * 4 + 3]! > 0;
  }

  shadeAt(x: number, y: number): number {
    return this.data[(y * this.w + x) * 4]! / 255;
  }

  setShade(x: number, y: number, v: number): void {
    this.data[(y * this.w + x) * 4] = clamp(v) * 255;
  }

  clear(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[(y * this.w + x) * 4 + 3] = 0;
  }

  rect(x: number, y: number, w: number, h: number, p: Paint): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.paint(xx, yy, p);
  }

  /** Scanline polygon fill, pixel centres, even-odd. */
  poly(pts: [number, number][], p: Paint): void {
    if (pts.length < 3) return;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const [, y] of pts) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
    const y0 = Math.max(0, Math.floor(ymin));
    const y1 = Math.min(this.h - 1, Math.ceil(ymax));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k]! - 0.5));
        const xb = Math.min(this.w - 1, Math.floor(xs[k + 1]! - 0.5));
        for (let x = xa; x <= xb; x++) this.paint(x, y, p);
      }
    }
  }

  disc(cx: number, cy: number, r: number, p: Paint): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.paint(x, y, p);
      }
  }

  /** Bresenham line, optional square brush. */
  line(x0: number, y0: number, x1: number, y1: number, p: Paint, brush = 1): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const b0 = -Math.floor((brush - 1) / 2);
    for (;;) {
      for (let by = 0; by < brush; by++) for (let bx = 0; bx < brush; bx++) this.paint(x0 + b0 + bx, y0 + b0 + by, p);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * Rim light: solid pixels whose neighbour toward the light (dx, dy) is empty
   * get `add` shade, and a softer second pixel inward.
   */
  rim(dx: number, dy: number, add: number, inner = 0): void {
    const edge: number[] = [];
    const second: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!this.solid(x, y)) continue;
        if (!this.solid(x + dx, y + dy) || (dx !== 0 && dy !== 0 && (!this.solid(x + dx, y) || !this.solid(x, y + dy)))) edge.push(x, y);
        else if (inner > 0 && !this.solid(x + 2 * dx, y + 2 * dy)) second.push(x, y);
      }
    for (let i = 0; i < edge.length; i += 2) this.setShade(edge[i]!, edge[i + 1]!, this.shadeAt(edge[i]!, edge[i + 1]!) + add);
    for (let i = 0; i < second.length; i += 2)
      this.setShade(second[i]!, second[i + 1]!, this.shadeAt(second[i]!, second[i + 1]!) + inner);
  }
}

// ---------------------------------------------------------------------------
// Profiles: functions x -> top y, for terrain.

/** A mountain-range crest: fbm body plus ridged detail. */
export function rangeProfile(o: {
  base: number;
  amp: number;
  scale: number;
  seed: number;
  detail?: number;
  sharp?: number;
}): (x: number) => number {
  return (x) => {
    const body = fbm1(x / o.scale, o.seed, 4);
    const r = ridged(x / (o.scale * 0.35), 0.5, o.seed + 7, 3);
    const k = o.sharp ?? 0.35;
    return o.base - o.amp * (body * (1 - k) + r * k) - (o.detail ?? 0) * (fbm1(x / 6, o.seed + 3, 2) - 0.5);
  };
}

/** A single peak or spire: steep power-curve sides with rough edges. */
export function peakProfile(o: {
  cx: number;
  top: number;
  base: number;
  halfWidth: number;
  power?: number;
  seed: number;
  rough?: number;
  lean?: number;
}): (x: number) => number {
  return (x) => {
    const lean = o.lean ?? 0;
    const d = Math.abs(x - o.cx - lean) / o.halfWidth;
    const k = Math.pow(Math.min(d, 1.5), o.power ?? 1.6);
    const rough = (o.rough ?? 0.06) * (o.base - o.top) * (fbm1(x / 9, o.seed, 3) - 0.5);
    return o.top + k * (o.base - o.top) + rough;
  };
}

/**
 * A crag or spire: asymmetric sides (left/right half widths), optional stepped
 * ledges (flat shelves with sheer drops between them) and ridged rough edges.
 */
export function cragProfile(o: {
  cx: number;
  top: number;
  base: number;
  left: number;
  right: number;
  seed: number;
  ledges?: number;
  rough?: number;
  power?: number;
}): (x: number) => number {
  const h = o.base - o.top;
  return (x) => {
    const dx = x - o.cx;
    let t = Math.abs(dx) / (dx < 0 ? o.left : o.right);
    if (t > 1.8) return 1e9;
    const L = o.ledges ?? 0;
    if (L > 0) {
      // shelves: each step is a gentle shelf then a steep (not sheer) drop
      const u = t * L + (fbm1(x / 40, o.seed + 1, 2) - 0.5) * 0.6;
      const q = Math.floor(u);
      const stepped = (q + smooth(0.55, 1, u - q)) / L;
      t = t + (stepped - t) * 0.55;
    }
    const k = Math.pow(Math.max(0, Math.min(t, 1.8)), o.power ?? 1.3);
    const rough = (o.rough ?? 0.06) * h * (ridged(x / 6, 0.5, o.seed, 3) - 0.5);
    return o.top + k * h + rough;
  };
}

export const minProfile =
  (...fs: ((x: number) => number)[]) =>
  (x: number): number =>
    Math.min(...fs.map((f) => f(x)));

// ---------------------------------------------------------------------------
// Terrain: fills everything below a profile with lit rock.

export interface TerrainOpts {
  row: number;
  top: (x: number) => number;
  bottom?: (x: number) => number;
  x0?: number;
  x1?: number;
  seed: number;
  /** Feature size in pixels. */
  scale: number;
  /** Block size: 1 for far layers, 2-3 for chunky near layers. */
  chunk?: number;
  /** Direction toward the light in screen space (x right, y down). */
  light?: [number, number];
  base?: number;
  contrast?: number;
  /** 0..1: horizontal ledges (sedimentary). */
  strata?: number;
  /** 0..1: vertical fissures (cliff faces). */
  vertical?: number;
  /** Extra shade on the lit crest (0..1) and its depth in px. */
  rim?: number;
  rimDepth?: number;
  /** Darkening toward the bottom (0..1). */
  ao?: number;
  fog?: (x: number, y: number) => number;
}

export function terrain(pix: Pix, o: TerrainOpts): void {
  const c = Math.max(1, o.chunk ?? 1);
  const [lx0, ly0] = o.light ?? [0.5, -1];
  const ll = Math.hypot(lx0, ly0, 0.8);
  const L = [lx0 / ll, ly0 / ll, 0.8 / ll] as const;
  const base = o.base ?? 0.4;
  const contrast = o.contrast ?? 0.5;
  const strata = o.strata ?? 0;
  const vert = o.vertical ?? 0;
  const sc = o.scale;
  const x0 = Math.max(0, Math.floor((o.x0 ?? 0) / c));
  const x1 = Math.min(Math.ceil(pix.w / c), Math.ceil((o.x1 ?? pix.w) / c));
  const height = (x: number, y: number): number => {
    let h = ridged(x / sc, y / (sc * (1 + vert * 2.5)), o.seed, 4) * 0.8;
    h += fbm(x / (sc * 0.4), y / (sc * 0.4), o.seed + 5, 2) * 0.25;
    if (strata > 0) h += strata * 0.5 * Math.sin((y + fbm(x / (sc * 2), 0, o.seed + 9, 2) * sc * 1.5) / (sc * 0.22));
    if (vert > 0) h += vert * 0.35 * ridged(x / (sc * 0.25), y / (sc * 3), o.seed + 13, 2);
    return h;
  };
  const k = 1.6;
  for (let bx = x0; bx < x1; bx++) {
    const x = bx * c + c / 2;
    const top = o.top(x);
    const bot = o.bottom ? o.bottom(x) : pix.h;
    const by0 = Math.max(0, Math.floor(top / c));
    const by1 = Math.min(Math.ceil(pix.h / c), Math.ceil(bot / c));
    for (let by = by0; by < by1; by++) {
      const y = by * c + c / 2;
      if (y < top) continue;
      const h = height(x, y);
      const gx = (height(x + c, y) - h) * k * (sc / c) * 0.12;
      const gy = (height(x, y + c) - h) * k * (sc / c) * 0.12;
      const nl = Math.hypot(gx, gy, 1);
      const dot = (-gx * L[0] - gy * L[1] + L[2]) / nl;
      let s = base + contrast * (dot - 0.55);
      const depthBelow = y - top;
      if (o.rim && depthBelow < (o.rimDepth ?? 3 * c)) s += o.rim * (1 - depthBelow / (o.rimDepth ?? 3 * c));
      if (o.ao) s -= o.ao * smooth(0, bot - top, depthBelow);
      const fog = o.fog ? o.fog(x, y) : 0;
      for (let yy = 0; yy < c; yy++) {
        const py = by * c + yy;
        if (py < top) continue;
        for (let xx = 0; xx < c; xx++) pix.set(bx * c + xx, py, s, o.row, fog);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Skyline: a row of blocks with setbacks, spires and lit windows.

export interface SkylineOpts {
  row: number;
  lightRow: number;
  x0: number;
  x1: number;
  ground: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  seed: number;
  windows?: number;
  gap?: number;
  shade?: number;
  fog?: (x: number, y: number) => number;
}

export function skyline(pix: Pix, o: SkylineOpts): void {
  const rnd = mulberry(o.seed);
  let x = o.x0;
  while (x < o.x1) {
    const w = Math.round(o.minW + rnd() * (o.maxW - o.minW));
    const h = Math.round(o.minH + Math.pow(rnd(), 1.6) * (o.maxH - o.minH));
    const top = o.ground - h;
    const sh = (o.shade ?? 0.25) + (rnd() - 0.5) * 0.12;
    const fog = o.fog;
    const paint: Paint = { row: o.row, shade: sh, fog };
    pix.rect(x, top, w, h, paint);
    // setbacks
    let tw = w;
    let tt = top;
    let tx = x;
    while (tw > 6 && rnd() < 0.55) {
      const nw = Math.round(tw * (0.45 + rnd() * 0.35));
      const nh = Math.round(4 + rnd() * h * 0.25);
      tx += Math.round((tw - nw) * rnd());
      tw = nw;
      pix.rect(tx, tt - nh, tw, nh, { ...paint, shade: sh + 0.03 });
      tt -= nh;
    }
    if (rnd() < 0.35) pix.rect(tx + Math.floor(tw / 2), tt - Math.round(4 + rnd() * 14), 1, Math.round(4 + rnd() * 14), paint);
    // windows
    const wd = o.windows ?? 0.06;
    for (let yy = top + 2; yy < o.ground - 1; yy += 3)
      for (let xx = x + 1; xx < x + w - 1; xx += 2)
        if (hashInt(xx, yy, o.seed) < wd) pix.set(xx, yy, 0.8 + rnd() * 0.2, o.lightRow, fog ? fog(xx, yy) : 0, true);
    x += w + Math.round((o.gap ?? 1) * rnd());
  }
}

// ---------------------------------------------------------------------------
// Megastructure: a leaning monolith grammar. Tiers with setbacks, vertical
// ribs, horizontal bands, sparse lit windows, a broken crown.

export interface MegaOpts {
  row: number;
  lightRow: number;
  cx: number;
  ground: number;
  height: number;
  width: number;
  /** Horizontal shear per pixel of height (positive leans right). */
  lean: number;
  seed: number;
  tiers?: number;
  light?: [number, number];
  windows?: number;
  fog?: (x: number, y: number) => number;
}

export function megastructure(pix: Pix, o: MegaOpts): void {
  const rnd = mulberry(o.seed);
  const tiers = o.tiers ?? 5;
  const shear = (x: number, y: number): [number, number] => [x + (o.ground - y) * o.lean, y];
  let w = o.width;
  let y = o.ground;
  const lightSide = (o.light?.[0] ?? 1) > 0 ? 1 : -1;
  for (let t = 0; t < tiers; t++) {
    const th = (o.height / tiers) * (0.7 + rnd() * 0.6);
    const top = y - th;
    const nw = w * (0.72 + rnd() * 0.2);
    const pts: [number, number][] = [
      shear(o.cx - w / 2, y),
      shear(o.cx + w / 2, y),
      shear(o.cx + nw / 2, top),
      shear(o.cx - nw / 2, top),
    ];
    const tierY0 = top;
    const tierY1 = y;
    const tierW = w;
    pix.poly(pts, {
      row: o.row,
      shade: (px, py) => {
        const ly = (py - tierY0) / (tierY1 - tierY0);
        const cxAt = o.cx + (o.ground - py) * o.lean;
        const lx = (px - cxAt) / (tierW / 2);
        let s = 0.22 + 0.12 * lightSide * lx;
        // ribs
        if (Math.abs(((px - cxAt) % 7) + 7) % 7 < 1) s += 0.1;
        // bands
        if (Math.floor(ly * 9) % 3 === 0 && (ly * 9) % 1 < 0.2) s -= 0.08;
        return s + (hashInt(Math.floor(px / 5), Math.floor(py / 9), o.seed) - 0.5) * 0.06;
      },
      fog: o.fog,
    });
    // windows
    const wd = o.windows ?? 0.02;
    for (let py = Math.ceil(top) + 2; py < y - 1; py += 4) {
      const cxAt = o.cx + (o.ground - py) * o.lean;
      for (let px = Math.ceil(cxAt - w / 2 + 2); px < cxAt + w / 2 - 2; px += 3)
        if (hashInt(px, py, o.seed + 1) < wd && pix.solid(px, py)) pix.set(px, py, 0.9, o.lightRow, o.fog ? o.fog(px, py) : 0, true);
    }
    // cantilevers
    if (rnd() < 0.5) {
      const cy = top + th * rnd();
      const side = rnd() < 0.5 ? -1 : 1;
      const len = w * (0.2 + rnd() * 0.3);
      const [ax, ay] = shear(o.cx + (side * w) / 2, cy);
      pix.rect(side > 0 ? ax : ax - len, ay, len, 2 + Math.round(rnd() * 2), { row: o.row, shade: 0.3, fog: o.fog });
    }
    w = nw;
    y = top;
  }
  // broken crown: a tapering spike with a notch
  const spike: [number, number][] = [
    shear(o.cx - w / 2, y),
    shear(o.cx + w / 2, y),
    shear(o.cx + w * 0.1, y - o.height * 0.18),
    shear(o.cx - w * 0.05, y - o.height * 0.12),
  ];
  pix.poly(spike, { row: o.row, shade: 0.2, fog: o.fog });
}

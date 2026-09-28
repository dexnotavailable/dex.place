// Code-drawn pixel art with normal maps. Shapes write a material id, a part
// group, a painter layer and a surface normal per pixel. finish() then bakes
// cel shading into material ramps (hue-shifted, 5 tones), draws per-material
// outlines with a lighter line on the lit side, and exports two images: the
// albedo (baked shading) and the matching normal map the runtime lights.

export type RGBi = [number, number, number];

export interface Material {
  id: number;
  /** darkest -> lightest: d, s, b, l, h */
  tones: [RGBi, RGBi, RGBi, RGBi, RGBi];
  line: RGBi;
  /** Softer outline on the lit side (sel-out). */
  lite: RGBi;
  /** Gets outlines and inner lines. */
  ink: boolean;
  /** Tone thresholds shift: >0 lighter overall. */
  bias: number;
  /** Specular kick to the top tone (metal, hair sheen). */
  shine: number;
}

const hexi = (h: string): RGBi => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export class Palette {
  readonly mats: Material[] = [];
  add(spec: { tones: string[]; line: string; lite?: string; ink?: boolean; bias?: number; shine?: number }): Material {
    const t = spec.tones.map(hexi);
    while (t.length < 5) t.push(t[t.length - 1]!);
    const m: Material = {
      id: this.mats.length + 1,
      tones: t as Material["tones"],
      line: hexi(spec.line),
      lite: hexi(spec.lite ?? spec.line),
      ink: spec.ink ?? true,
      bias: spec.bias ?? 0,
      shine: spec.shine ?? 0,
    };
    this.mats.push(m);
    return m;
  }
  get(id: number): Material | undefined {
    return this.mats[id - 1];
  }
}

export interface ShapeOpts {
  /** Dome radius (px) for normals from the part's own outline. */
  round?: number;
  /** Normal strength multiplier. */
  bulge?: number;
  /** Trim: pixels within `width` of the outline use this material. */
  trim?: { mat: Material; width: number; where?: (x: number, y: number) => boolean };
  /** Constant tilt added to the normal (cloth panels facing sideways etc.). */
  tilt?: [number, number];
  /** Tone offset for every pixel (-1 darker). */
  tone?: number;
  /** Per-pixel material override. */
  paint?: (x: number, y: number, d: number) => Material | null | undefined;
  /** Skip outlining against parts behind (soft internal seams). */
  noInk?: boolean;
  /** Per-pixel version of noInk. */
  inkSkip?: (x: number, y: number) => boolean;
}

export class PixBuf {
  readonly w: number;
  readonly h: number;
  /** Buffer origin in figure space: figure (0,0) lands at pixel (ox, oy). */
  readonly ox: number;
  readonly oy: number;
  readonly mat: Uint8Array;
  readonly grp: Uint8Array;
  readonly lay: Uint16Array;
  readonly nrm: Float32Array;
  readonly fixed: Uint32Array;
  readonly toneOff: Int8Array;
  readonly noInk: Uint8Array;
  layer = 1;
  private dist: Float32Array;
  private mask: Uint8Array;

  readonly pal: Palette;

  constructor(w: number, h: number, ox: number, oy: number, pal: Palette) {
    this.pal = pal;
    this.w = w;
    this.h = h;
    this.ox = ox;
    this.oy = oy;
    const n = w * h;
    this.mat = new Uint8Array(n);
    this.grp = new Uint8Array(n);
    this.lay = new Uint16Array(n);
    this.nrm = new Float32Array(n * 3);
    this.fixed = new Uint32Array(n);
    this.toneOff = new Int8Array(n);
    this.noInk = new Uint8Array(n);
    this.dist = new Float32Array(n);
    this.mask = new Uint8Array(n);
  }

  // --- rasterising ---------------------------------------------------------

  /** Non-zero polygon fill; P in figure space [x0,y0,x1,y1,...]. */
  poly(P: number[], m: Material, g: number, o: ShapeOpts = {}): void {
    const n = P.length >> 1;
    if (n < 3) return;
    const { w, h, ox, oy } = this;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = P[i * 2]! + ox, y = P[i * 2 + 1]! + oy;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
    }
    const y0 = Math.max(0, Math.ceil(minY - 0.5)), y1 = Math.min(h - 1, Math.floor(maxY - 0.5));
    const bx0 = Math.max(0, Math.floor(minX) - 1), bx1 = Math.min(w - 1, Math.ceil(maxX) + 1);
    const by0 = Math.max(0, y0 - 1), by1 = Math.min(h - 1, y1 + 1);
    const xs: number[] = [];
    const ws: number[] = [];
    const mask = this.mask;
    for (let y = by0; y <= by1; y++) mask.fill(0, y * w + bx0, y * w + bx1 + 1);
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      ws.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = P[i * 2 + 1]! + oy, yj = P[j * 2 + 1]! + oy;
        if ((yi <= sy) !== (yj <= sy)) {
          const xi = P[i * 2]! + ox, xj = P[j * 2]! + ox;
          xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
          ws.push(yj > yi ? 1 : -1);
        }
      }
      const order = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
      let wind = 0;
      for (let k = 0; k < order.length - 1; k++) {
        wind += ws[order[k]!]!;
        if (wind === 0) continue;
        const xa = Math.max(0, Math.ceil(xs[order[k]!]! - 0.5));
        const xb = Math.min(w - 1, Math.ceil(xs[order[k + 1]!]! - 0.5) - 1);
        for (let x = xa; x <= xb; x++) mask[y * w + x] = 1;
      }
    }
    this.commitMask(bx0, by0, bx1, by1, m, g, o);
  }

  /** Tapered capsule with analytic (cylinder) normals. */
  capsule(ax: number, ay: number, ra: number, bx: number, by: number, rb: number, m: Material, g: number, o: ShapeOpts = {}): void {
    const { w, h, ox, oy } = this;
    ax += ox; ay += oy; bx += ox; by += oy;
    const x0 = Math.max(0, Math.floor(Math.min(ax - ra, bx - rb)) - 1), x1 = Math.min(w - 1, Math.ceil(Math.max(ax + ra, bx + rb)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay - ra, by - rb)) - 1), y1 = Math.min(h - 1, Math.ceil(Math.max(ay + ra, by + rb)) + 1);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const mask = this.mask;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        let t = (px * dx + py * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const r = ra + (rb - ra) * t;
        const qx = px - dx * t, qy = py - dy * t;
        mask[y * w + x] = qx * qx + qy * qy <= r * r ? 1 : 0;
      }
    }
    this.commitMask(x0, y0, x1, y1, m, g, { round: Math.max(ra, rb) * 0.95, ...o });
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, m: Material, g: number, o: ShapeOpts = {}): void {
    const pts: number[] = [];
    const N = Math.max(12, Math.round((rx + ry) * 2));
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pts.push(cx + x * c - y * s, cy + x * s + y * c);
    }
    this.poly(pts, m, g, { round: Math.min(rx, ry), ...o });
  }

  /** Polygon from a centre line with per-point widths. */
  ribbon(pts: number[], widths: number[], m: Material, g: number, o: ShapeOpts = {}): void {
    const n = pts.length >> 1;
    if (n < 2) return;
    const L: number[] = [], R: number[] = [];
    for (let i = 0; i < n; i++) {
      const ia = Math.max(0, i - 1), ib = Math.min(n - 1, i + 1);
      let dx = pts[ib * 2]! - pts[ia * 2]!, dy = pts[ib * 2 + 1]! - pts[ia * 2 + 1]!;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const hw = (widths[i] ?? widths[widths.length - 1]!) * 0.5;
      L.push(pts[i * 2]! - dy * hw, pts[i * 2 + 1]! + dx * hw);
      R.push(pts[i * 2]! + dy * hw, pts[i * 2 + 1]! - dx * hw);
    }
    const P = L.slice();
    for (let i = n - 1; i >= 0; i--) P.push(R[i * 2]!, R[i * 2 + 1]!);
    this.poly(P, m, g, o);
  }

  /** Single pixel line in figure space (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, m: Material, g: number, tone = 0): void {
    let X0 = Math.floor(x0 + this.ox), Y0 = Math.floor(y0 + this.oy);
    const X1 = Math.floor(x1 + this.ox), Y1 = Math.floor(y1 + this.oy);
    const dx = Math.abs(X1 - X0), dy = -Math.abs(Y1 - Y0), sx = X0 < X1 ? 1 : -1, sy = Y0 < Y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 600; guard++) {
      this.put(X0, Y0, m, g, 0, 0, 1, tone);
      if (X0 === X1 && Y0 === Y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; X0 += sx; }
      if (e2 <= dx) { err += dx; Y0 += sy; }
    }
    this.layer++;
  }

  /** Fixed-colour pixel (eyes, mouth, emblem details) in figure space. */
  pix(x: number, y: number, rgb: RGBi | null, g = 0): void {
    const X = Math.floor(x + this.ox), Y = Math.floor(y + this.oy);
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return;
    const i = Y * this.w + X;
    if (!rgb) return;
    this.fixed[i] = (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
    if (!this.mat[i]) {
      this.mat[i] = 255;
      this.nrm[i * 3 + 2] = 1;
    }
    if (g) this.grp[i] = g;
  }

  /** Material pixel keeping the normal already there. */
  paintMat(x: number, y: number, m: Material, tone = 0): void {
    const X = Math.floor(x + this.ox), Y = Math.floor(y + this.oy);
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return;
    const i = Y * this.w + X;
    if (!this.mat[i]) return;
    this.mat[i] = m.id;
    this.fixed[i] = 0;
    this.toneOff[i] = tone;
  }

  private put(x: number, y: number, m: Material, g: number, nx: number, ny: number, nz: number, tone: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.mat[i] = m.id;
    this.grp[i] = g;
    this.lay[i] = this.layer;
    this.nrm[i * 3] = nx;
    this.nrm[i * 3 + 1] = ny;
    this.nrm[i * 3 + 2] = nz;
    this.fixed[i] = 0;
    this.toneOff[i] = tone;
    this.noInk[i] = 0;
  }

  /** Distance field of the current mask, dome height, normals, write. */
  private commitMask(x0: number, y0: number, x1: number, y1: number, m: Material, g: number, o: ShapeOpts): void {
    const { w, mask, dist } = this;
    const R = Math.max(0.8, o.round ?? 3);
    // chamfer distance to the outside
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) dist[y * w + x] = mask[y * w + x] ? 1e6 : 0;
    const D2 = 1.4142;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = y * w + x;
        let v = dist[k]!;
        if (!v) continue;
        const l = x > x0 ? dist[k - 1]! : 0, u = y > y0 ? dist[k - w]! : 0;
        const ul = x > x0 && y > y0 ? dist[k - w - 1]! : 0, ur = x < x1 && y > y0 ? dist[k - w + 1]! : 0;
        v = Math.min(v, l + 1, u + 1, ul + D2, ur + D2);
        dist[k] = v;
      }
    }
    for (let y = y1; y >= y0; y--) {
      for (let x = x1; x >= x0; x--) {
        const k = y * w + x;
        let v = dist[k]!;
        if (!v) continue;
        const r = x < x1 ? dist[k + 1]! : 0, d = y < y1 ? dist[k + w]! : 0;
        const dr = x < x1 && y < y1 ? dist[k + w + 1]! : 0, dl = x > x0 && y < y1 ? dist[k + w - 1]! : 0;
        v = Math.min(v, r + 1, d + 1, dr + D2, dl + D2);
        dist[k] = v;
      }
    }
    const height = (k: number): number => {
      const d = dist[k]!;
      if (!d) return 0;
      const t = Math.min((d - 0.5) / R, 1);
      return R * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    };
    const bulge = o.bulge ?? 1;
    const tx = o.tilt?.[0] ?? 0, ty = o.tilt?.[1] ?? 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = y * w + x;
        if (!mask[k]) continue;
        const hl = x > x0 ? height(k - 1) : 0, hr = x < x1 ? height(k + 1) : 0;
        const hu = y > y0 ? height(k - w) : 0, hd = y < y1 ? height(k + w) : 0;
        let nx = -(hr - hl) * 0.5 * bulge + tx, ny = -(hd - hu) * 0.5 * bulge + ty, nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        const d = dist[k]!;
        let mm: Material = m;
        if (o.trim && d <= o.trim.width + 0.01 && (!o.trim.where || o.trim.where(x - this.ox, y - this.oy))) mm = o.trim.mat;
        if (o.paint) {
          const pm = o.paint(x - this.ox, y - this.oy, d);
          if (pm === null) continue;
          if (pm) mm = pm;
        }
        this.put(x, y, mm, g, nx, ny, nz, o.tone ?? 0);
        if (o.noInk || o.inkSkip?.(x - this.ox, y - this.oy)) this.noInk[k] = 1;
      }
    }
    this.layer++;
  }

  // --- post passes -----------------------------------------------------------

  /** Pixels of `to` groups get darker when a pixel of `from` groups (drawn later) sits within n px along (dx,dy). */
  castShadow(from: number[], to: number[], n: number, dx = 0, dy = -1, amount = -1): void {
    const { w, h, grp, lay, mat } = this;
    const hits: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mat[i] || !to.includes(grp[i]!)) continue;
        for (let k = 1; k <= n; k++) {
          const xx = x + dx * k, yy = y + dy * k;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx;
          if (mat[j] && from.includes(grp[j]!) && lay[j]! > lay[i]!) {
            hits.push(i);
            break;
          }
        }
      }
    }
    for (const i of hits) this.toneOff[i] = Math.min(this.toneOff[i]!, amount);
  }

  bounds(): [number, number, number, number] | null {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!this.mat[y * this.w + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }

  /**
   * Shade, outline and export. keyDir is the baked key light in buffer space
   * (x right, y down, z toward the viewer).
   */
  finish(keyDir: [number, number, number], opts: { outline?: boolean; selout?: boolean } = {}): { albedo: Uint8ClampedArray; normal: Uint8ClampedArray } {
    const { w, h, mat, grp, lay, nrm, fixed, toneOff, pal } = this;
    const n = w * h;
    const albedo = new Uint8ClampedArray(n * 4);
    const normal = new Uint8ClampedArray(n * 4);
    const kl = Math.hypot(keyDir[0], keyDir[1], keyDir[2]);
    const kx = keyDir[0] / kl, ky = keyDir[1] / kl, kz = keyDir[2] / kl;
    const hx0 = kx, hy0 = ky, hz0 = kz + 1;
    const hl = Math.hypot(hx0, hy0, hz0);
    const hx = hx0 / hl, hy = hy0 / hl, hz = hz0 / hl;
    const setN = (i: number, x: number, y: number, z: number): void => {
      normal[i * 4] = Math.round((x * 0.5 + 0.5) * 255);
      normal[i * 4 + 1] = Math.round((y * 0.5 + 0.5) * 255);
      normal[i * 4 + 2] = Math.round((z * 0.5 + 0.5) * 255);
      normal[i * 4 + 3] = 255;
    };
    const setC = (i: number, c: RGBi): void => {
      albedo[i * 4] = c[0];
      albedo[i * 4 + 1] = c[1];
      albedo[i * 4 + 2] = c[2];
      albedo[i * 4 + 3] = 255;
    };
    // fill
    for (let i = 0; i < n; i++) {
      const id = mat[i]!;
      if (!id) continue;
      const nx = nrm[i * 3]!, ny = nrm[i * 3 + 1]!, nz = nrm[i * 3 + 2]!;
      setN(i, nx, ny, nz);
      if (fixed[i]) {
        const v = fixed[i]!;
        setC(i, [v & 255, (v >> 8) & 255, (v >> 16) & 255]);
        continue;
      }
      const m = pal.get(id);
      if (!m) continue;
      const dl = nx * kx + ny * ky + nz * kz;
      let lv = dl > 0.93 - m.bias * 0.1 ? 3 : dl > 0.62 - m.bias * 0.1 ? 2 : dl > 0.22 - m.bias * 0.1 ? 1 : 0;
      if (m.shine > 0) {
        const sp = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 18);
        if (sp > 1 - m.shine) lv = 4;
      }
      lv = Math.max(0, Math.min(4, lv + toneOff[i]! + 1));
      setC(i, m.tones[lv]!);
    }
    if (opts.outline !== false) {
      const selout = opts.selout !== false;
      const out = new Uint8ClampedArray(albedo);
      // inner lines where a part sits in front of a different group
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const id = mat[i]!;
          if (!id || id === 255 || this.noInk[i]) continue;
          const m = pal.get(id);
          if (!m || !m.ink) continue;
          const g = grp[i]!, l = lay[i]!;
          const nb = [i - 1, i + 1, i - w, i + w];
          let edge = false;
          for (const j of nb) {
            const mj = mat[j]!;
            if (mj && grp[j] !== g && lay[j]! < l && mj !== 255 && pal.get(mj)?.ink) { edge = true; break; }
          }
          if (edge) {
            out[i * 4] = m.line[0]; out[i * 4 + 1] = m.line[1]; out[i * 4 + 2] = m.line[2];
            normal[i * 4 + 3] = 0; // ink mask: the runtime keeps lines as lines (no rim, no light bleach)
          }
        }
      }
      // outer outline, coloured by the front-most neighbour
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (mat[i]) continue;
          let best = 0, bl = -1, bk = -1;
          const nb: [number, number, number][] = [[x - 1, y, 0], [x + 1, y, 1], [x, y - 1, 2], [x, y + 1, 3]];
          for (const [xx, yy, k] of nb) {
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            const id = mat[j]!;
            if (!id) continue;
            const m = id === 255 ? null : pal.get(id);
            if (m && !m.ink) continue;
            if (lay[j]! > bl) { bl = lay[j]!; best = j; bk = k; }
          }
          if (bk < 0) continue;
          const id = mat[best]!;
          const m = id === 255 ? null : pal.get(id);
          const line: RGBi = m ? m.line : [40, 24, 40];
          // shape to the right (k=1 -> pixel sits on the shape's left/back side), below (k=3 -> top side)
          const lit = selout && m && ((kx < 0 ? bk === 1 : bk === 0) || bk === 3);
          const c = lit ? m!.lite : line;
          out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
          // outline normal points outward (kept for tools); the runtime treats it as ink
          const ox = bk === 0 ? 1 : bk === 1 ? -1 : 0, oy = bk === 2 ? 1 : bk === 3 ? -1 : 0;
          const nn = Math.hypot(ox, oy, 0.35);
          setN(i, ox / nn, oy / nn, 0.35 / nn);
          normal[i * 4 + 3] = 0; // ink mask (see RUNTIME-CONTRACT.md, normal alpha)
        }
      }
      albedo.set(out);
    }
    return { albedo, normal };
  }
}

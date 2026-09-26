// ---------------------------------------------------------------------------
// Palette + materials. Every drawn pixel is a palette index, so the sprite
// stays on a fixed palette the way hand-made pixel art does.
// ---------------------------------------------------------------------------
const PAL = {
  n: 1,
  rgba: new Uint32Array(256), // packed ABGR for ImageData
  rgb: [],
  line: new Uint8Array(256), // outline/ink index for each colour
  lite: new Uint8Array(256), // softer outline used on the lit (front/top) side
  dark: new Uint8Array(256), // next darker tone of the same material (cast shadows)
  mat: new Uint8Array(256), // material id of each colour (0 = none)
  lvl: new Uint8Array(256), // tone level 0..4 (d,s,b,l,h) within its material
  ink: new Uint8Array(256), // 1 = draw inner lines against parts behind
  noOut: new Uint8Array(256), // 1 = no outer outline (glows, fx)
};
function hexRGB(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function palAdd(hex) {
  const i = PAL.n++;
  const [r, g, b] = hexRGB(hex);
  PAL.rgb[i] = [r, g, b];
  PAL.rgba[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  PAL.line[i] = i; PAL.lite[i] = i; PAL.dark[i] = i; PAL.ink[i] = 1;
  return i;
}
// material: tones from dark to light plus an ink colour
const MATS = [null]; // material id -> [d,s,b,l,h] palette indices
function material(spec) {
  const m = {};
  const ln = palAdd(spec.line);
  m.line = ln;
  for (const k of ['d', 's', 'b', 'l', 'h']) if (spec[k]) { m[k] = palAdd(spec[k]); PAL.line[m[k]] = ln; }
  PAL.line[ln] = ln;
  m.d = m.d || m.s; m.l = m.l || m.b; m.h = m.h || m.l;
  PAL.dark[m.h] = m.l; PAL.dark[m.l] = m.b; PAL.dark[m.b] = m.s; PAL.dark[m.s] = m.d; PAL.dark[m.d] = m.d;
  m.id = MATS.length;
  MATS.push([m.d, m.s, m.b, m.l, m.h]);
  [m.d, m.s, m.b, m.l, m.h].forEach((ix, lv) => { if (!PAL.mat[ix]) { PAL.mat[ix] = m.id; PAL.lvl[ix] = lv; } });
  const lite = spec.lite ? palAdd(spec.lite) : ln;
  for (const k of ['d', 's', 'b', 'l', 'h']) if (m[k]) PAL.lite[m[k]] = lite;
  PAL.lite[ln] = lite;
  return m;
}
// v in [-1,1]: light facing. Two-tone cel shading with optional highlight.
function tone(m, v) {
  if (v > 0.72) return m.h;
  if (v > 0.32) return m.l;
  if (v > -0.28) return m.b;
  if (v > -0.78) return m.s;
  return m.d;
}

const M = {
  skin: material({ line: '#5a2130', lite: '#ad5a63', d: '#c9735f', s: '#eda28a', b: '#fbd9c6', l: '#ffecdf', h: '#fff9f4' }),
  hair: material({ line: '#06060f', d: '#0b0d1b', s: '#141830', b: '#1f2543', l: '#353f6c', h: '#6d7cb8' }),
  cloak: material({ line: '#0b0508', d: '#120a0e', s: '#1b1016', b: '#291a21', l: '#3e2831', h: '#5a3b47' }),
  lining: material({ line: '#16030b', s: '#330a15', b: '#521222', l: '#7a1d31' }),
  shirt: material({ line: '#2c2d45', lite: '#6e7090', d: '#7d809b', s: '#b7bad0', b: '#e9eaf3', l: '#f7f8fc', h: '#ffffff' }),
  skirt: material({ line: '#0c0c16', d: '#1d1f2e', s: '#2b2e42', b: '#3c4059', l: '#555a79', h: '#747a9c' }),
  sock: material({ line: '#06060b', d: '#101019', s: '#191a28', b: '#25263a', l: '#3b3d57', h: '#5d6085' }),
  shoe: material({ line: '#040406', s: '#0b0b11', b: '#16161f', l: '#34354a', h: '#6a6c88' }),
  red: material({ line: '#2a0210', lite: '#6e0a22', d: '#4c0619', s: '#8a0b25', b: '#d0132e', l: '#ff4150', h: '#ffa08f' }),
  blouseDk: material({ line: '#07070d', d: '#121320', s: '#1c1d2c', b: '#2b2d41', l: '#3f4259', h: '#5a5e7a' }),
  sockW: material({ line: '#373952', lite: '#7c7f9c', d: '#8c8fa8', s: '#bcbfd3', b: '#e5e6f0', l: '#f5f6fb', h: '#ffffff' }),
  sleeve: material({ line: '#08080f', d: '#13131e', s: '#1e1f2d', b: '#2b2d40', l: '#44475f', h: '#646888' }),
  metal: material({ line: '#060509', s: '#15141a', b: '#2a2933', l: '#4a4858', h: '#8d8aa0' }),
};
const C = {
  white: palAdd('#ffffff'),
  eyeWhite: palAdd('#fbf7f7'),
  iris: palAdd('#e3122e'),
  irisLt: palAdd('#ff6475'),
  irisDk: palAdd('#7c0617'),
  pupil: palAdd('#2c020b'),
  lash: palAdd('#0a090e'),
  mouth: palAdd('#9c3c4e'),
  mouthIn: palAdd('#5a1426'),
  blush: palAdd('#f7b3ad'),
  glowRed: palAdd('#ff4a5c'),
  glowCore: palAdd('#fff0f2'),
};
PAL.line[C.eyeWhite] = M.skin.line; PAL.line[C.iris] = M.skin.line; PAL.line[C.lash] = C.lash;
for (const k of ['glowRed', 'glowCore']) { PAL.noOut[C[k]] = 1; PAL.ink[C[k]] = 0; }
for (const k of ['eyeWhite', 'iris', 'irisLt', 'irisDk', 'pupil', 'lash', 'mouth', 'mouthIn', 'blush', 'white']) PAL.ink[C[k]] = 0;

// ---------------------------------------------------------------------------
// PixBuf: scanline rasterizer that writes palette indices with no
// anti-aliasing, then derives outlines, inner lines and rim light.
// ---------------------------------------------------------------------------
class PixBuf {
  constructor(w, h) {
    this.w = w; this.h = h;
    const n = w * h;
    this.col = new Uint8Array(n);
    this.grp = new Uint8Array(n);
    this.lay = new Uint16Array(n);
    this.out = new Uint8Array(n);
    this.edge = new Uint8Array(n);
    this.hgt = new Float32Array(n);
    this.litR = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
    this.u32 = new Uint32Array(this.img.data.buffer);
    this.xs = new Float64Array(512);
    this.ws = new Int8Array(512);
    this.layer = 1;
    this.selout = true;
    this.bx0 = 0; this.by0 = 0; this.bx1 = w - 1; this.by1 = h - 1; // dirty box from last frame
    this.reset();
  }
  reset() {
    // clear last frame's dirty box
    const { w } = this;
    for (let y = this.by0; y <= this.by1; y++) {
      const o = y * w;
      this.col.fill(0, o + this.bx0, o + this.bx1 + 1);
      this.grp.fill(0, o + this.bx0, o + this.bx1 + 1);
      this.lay.fill(0, o + this.bx0, o + this.bx1 + 1);
      this.u32.fill(0, o + this.bx0, o + this.bx1 + 1);
      this.hgt.fill(0, o + this.bx0, o + this.bx1 + 1);
    }
    this.minX = this.w; this.minY = this.h; this.maxX = -1; this.maxY = -1;
    this.layer = 1;
  }
  put(x, y, c, g) {
    const i = y * this.w + x;
    this.col[i] = c; this.grp[i] = g; this.lay[i] = this.layer;
    if (x < this.minX) this.minX = x; if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
  }
  pset(x, y, c, g) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.put(x, y, c, g);
  }
  // non-zero winding polygon fill; P = [x0,y0,x1,y1,...]; c = index | fn(x,y)
  // With litR > 0 the polygon also writes a height field from the distance to
  // its own outline, which the lighting pass turns into rounded form shading.
  poly(P, c, g) {
    const n = P.length >> 1;
    if (n < 3) return;
    let minY = 1e9, maxY = -1e9;
    for (let i = 1; i < P.length; i += 2) { const y = P[i]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const y0 = Math.max(0, Math.ceil(minY - 0.5)), y1 = Math.min(this.h - 1, Math.floor(maxY - 0.5));
    const xs = this.xs, ws = this.ws, fn = typeof c === 'function';
    const spans = this.spans || (this.spans = []);
    spans.length = 0;
    let sx0 = 1e9, sx1 = -1e9;
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      let k = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = P[i * 2 + 1], yj = P[j * 2 + 1];
        if ((yi <= sy) !== (yj <= sy)) {
          const xi = P[i * 2], xj = P[j * 2];
          xs[k] = xi + ((sy - yi) / (yj - yi)) * (xj - xi);
          ws[k] = yj > yi ? 1 : -1;
          if (++k >= 510) break;
        }
      }
      for (let a = 1; a < k; a++) {
        const vx = xs[a], vw = ws[a];
        let b = a - 1;
        while (b >= 0 && xs[b] > vx) { xs[b + 1] = xs[b]; ws[b + 1] = ws[b]; b--; }
        xs[b + 1] = vx; ws[b + 1] = vw;
      }
      let wind = 0;
      for (let a = 0; a < k - 1; a++) {
        wind += ws[a];
        if (wind === 0) continue;
        const xa = Math.max(0, Math.ceil(xs[a] - 0.5));
        const xb = Math.min(this.w - 1, Math.ceil(xs[a + 1] - 0.5) - 1);
        if (xb < xa) continue;
        spans.push(y, xa, xb);
        if (xa < sx0) sx0 = xa; if (xb > sx1) sx1 = xb;
      }
    }
    const R = this.litR;
    let dist = null, bw = 0, bx = 0, by = y0;
    if (R > 0 && spans.length) {
      bx = sx0 - 1; by = y0 - 1; bw = sx1 - sx0 + 3; const bh = y1 - y0 + 3;
      dist = this.distField(spans, bx, by, bw, bh);
    }
    for (let s = 0; s < spans.length; s += 3) {
      const y = spans[s];
      for (let x = spans[s + 1]; x <= spans[s + 2]; x++) {
        // shaders can read curD: this pixel's distance to the part's own outline
        const dd = dist ? dist[(y - by) * bw + (x - bx)] : 99;
        this.curD = dd;
        const ci = fn ? c(x, y) : c;
        if (!ci) continue;
        this.put(x, y, ci, g);
        if (dist) {
          const t = Math.min(dd / R, 1);
          this.hgt[y * this.w + x] = R * Math.sqrt(1 - (1 - t) * (1 - t));
        }
      }
    }
    this.layer++;
  }
  // chamfer distance (to the outside of the span mask), local box
  distField(spans, bx, by, bw, bh) {
    const N = bw * bh;
    if (!this.dScratch || this.dScratch.length < N) this.dScratch = new Float32Array(N * 2);
    const d = this.dScratch;
    d.fill(0, 0, N);
    for (let s = 0; s < spans.length; s += 3) {
      const o = (spans[s] - by) * bw - bx;
      for (let x = spans[s + 1]; x <= spans[s + 2]; x++) d[o + x] = 1e6;
    }
    const D2 = 1.4142;
    for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
      const k = y * bw + x; let v = d[k]; if (!v) continue;
      v = Math.min(v, d[k - 1] + 1, d[k - bw] + 1, d[k - bw - 1] + D2, d[k - bw + 1] + D2);
      d[k] = v;
    }
    for (let y = bh - 2; y >= 1; y--) for (let x = bw - 2; x >= 1; x--) {
      const k = y * bw + x; let v = d[k]; if (!v) continue;
      v = Math.min(v, d[k + 1] + 1, d[k + bw] + 1, d[k + bw + 1] + D2, d[k + bw - 1] + D2);
      d[k] = v;
    }
    return d;
  }
  // tapered capsule; c = index | fn(t, s, x, y) with t along axis, s in [-1,1] across
  capsule(ax, ay, ra, bx, by, rb, c, g) {
    const x0 = Math.max(0, Math.floor(Math.min(ax - ra, bx - rb))), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax + ra, bx + rb)));
    const y0 = Math.max(0, Math.floor(Math.min(ay - ra, by - rb))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay + ra, by + rb)));
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, L = Math.sqrt(L2);
    const fn = typeof c === 'function';
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        let t = (px * dx + py * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const r = ra + (rb - ra) * t;
        const qx = px - dx * t, qy = py - dy * t;
        if (qx * qx + qy * qy <= r * r) {
          const ci = fn ? c(t, (qx * dy - qy * dx) / (L * r), x, y) : c;
          if (ci) this.put(x, y, ci, g);
        }
      }
    }
    this.layer++;
  }
  ellipse(cx, cy, rx, ry, rot, c, g) {
    const R = Math.max(rx, ry) + 1;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(this.w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(this.h - 1, Math.ceil(cy + R));
    const cs = Math.cos(rot), sn = Math.sin(rot), fn = typeof c === 'function';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const u = (px * cs + py * sn) / rx, v = (-px * sn + py * cs) / ry;
      if (u * u + v * v <= 1) { const ci = fn ? c(u, v, x, y) : c; if (ci) this.put(x, y, ci, g); }
    }
    this.layer++;
  }
  // polygon from a polyline with per-point widths
  ribbon(pts, widths, c, g) {
    const n = pts.length >> 1;
    if (n < 2) return;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const ia = Math.max(0, i - 1), ib = Math.min(n - 1, i + 1);
      let dx = pts[ib * 2] - pts[ia * 2], dy = pts[ib * 2 + 1] - pts[ia * 2 + 1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const w = widths[i] * 0.5;
      L.push(pts[i * 2] - dy * w, pts[i * 2 + 1] + dx * w);
      R.push(pts[i * 2] + dy * w, pts[i * 2 + 1] - dx * w);
    }
    const P = L.slice();
    for (let i = n - 1; i >= 0; i--) P.push(R[i * 2], R[i * 2 + 1]);
    this.poly(P, c, g);
  }
  line(x0, y0, x1, y1, c, g) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2000; guard++) {
      if (x0 >= 0 && y0 >= 0 && x0 < this.w && y0 < this.h) this.put(x0, y0, c, g);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    this.layer++;
  }
  bump() { this.layer++; }
  // ---- form lighting --------------------------------------------------------
  // Each lit group gets a height field from its own silhouette (distance to
  // its edge, treating parts drawn in front of it as continuing surface),
  // plus explicit bumps. Normals from that height are lit by one key light
  // and the result shifts each pixel along its material's 5-tone ramp.
  addBump(cx, cy, rx, ry, rot, amp, g) {
    if (!this.bumpMap) this.bumpMap = new Float32Array(this.w * this.h);
    const R = Math.max(rx, ry) + 1, cs = Math.cos(rot), sn = Math.sin(rot);
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(this.h - 1, Math.ceil(cy + R)); y++)
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(this.w - 1, Math.ceil(cx + R)); x++) {
        const i = y * this.w + x;
        if (this.grp[i] !== g) continue;
        const px = x + 0.5 - cx, py = y + 0.5 - cy;
        const u = (px * cs + py * sn) / rx, v = (-px * sn + py * cs) / ry;
        const d = u * u + v * v;
        if (d < 1) { this.bumpMap[i] += amp * Math.sqrt(1 - d); this.bumpTouched = true; }
      }
  }
  light(cfg, L) {
    const { w, col, grp, hgt } = this;
    const x0 = Math.max(1, this.minX), x1 = Math.min(w - 2, this.maxX), y0 = Math.max(1, this.minY), y1 = Math.min(this.h - 2, this.maxY);
    const bm = this.bumpTouched ? this.bumpMap : null;
    const H = (i) => hgt[i] + (bm ? bm[i] : 0);
    const lx = L[0], ly = L[1], lz = L[2];
    let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    const out = this.lightOut || (this.lightOut = []);
    out.length = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x, g = grp[i], c = cfg[g];
      if (!c) continue;
      const ci = col[i], m = PAL.mat[ci];
      if (!m || !PAL.ink[ci]) continue;
      const h0 = H(i);
      const hr = grp[i + 1] === g ? H(i + 1) : h0, hlft = grp[i - 1] === g ? H(i - 1) : h0;
      const hd = grp[i + w] === g ? H(i + w) : h0, hu = grp[i - w] === g ? H(i - w) : h0;
      const str = c.str ?? 1;
      let nx = -(hr - hlft) * 0.5 * str, ny = -(hd - hu) * 0.5 * str, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const dl = nx * lx + ny * ly + nz * lz - lz;
      let shift = 0;
      if (dl > c.up) shift = 1; else if (dl < -c.dn2) shift = -2; else if (dl < -c.dn) shift = -1;
      if (c.shine) {
        const sp = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), c.pow || 24);
        if (sp > c.shine) shift = Math.max(shift, c.shineTo || 2);
      }
      // bounce light: a shadowed edge that faces away from the key gets lifted
      if (shift < 0 && c.bounce !== false && hgt[i] < 1.4 && nx * lx + ny * ly < -0.25) shift += 1;
      if (shift) out.push(i, clamp(PAL.lvl[ci] + shift, 0, 4), m);
    }
    for (let k = 0; k < out.length; k += 3) col[out[k]] = MATS[out[k + 2]][out[k + 1]];
    if (bm) { bm.fill(0); this.bumpTouched = false; }
  }
  // Cluster cleanup: an interior pixel whose 4 neighbours (same group) all
  // agree on another colour of the same material takes that colour. Pixel
  // artists call these orphans; removing them gives clean clusters.
  despeckle(groups) {
    const { w, col, grp } = this;
    const gm = new Uint8Array(64); for (const g of groups) gm[g] = 1;
    const x0 = Math.max(1, this.minX), x1 = Math.min(w - 2, this.maxX), y0 = Math.max(1, this.minY), y1 = Math.min(this.h - 2, this.maxY);
    const fix = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x, g = grp[i], c = col[i];
      if (!c || !gm[g] || !PAL.ink[c]) continue;
      const a = col[i - 1], b = col[i + 1], u = col[i - w], d = col[i + w];
      if (grp[i - 1] !== g || grp[i + 1] !== g || grp[i - w] !== g || grp[i + w] !== g) continue;
      // horizontal or vertical pair agreeing on a different colour of the same material
      if (a === b && a !== c && PAL.mat[a] === PAL.mat[c] && (u === a || d === a || u === d)) fix.push(i, a);
      else if (u === d && u !== c && PAL.mat[u] === PAL.mat[c] && (a === u || b === u)) fix.push(i, u);
    }
    for (let k = 0; k < fix.length; k += 2) col[fix[k]] = fix[k + 1];
  }
  // Cast shadow: pixels of `to` groups get one tone darker when a pixel of a
  // `from` group sits within n pixels in direction (dx,dy). Used for the
  // skirt on the thighs, bangs on the face, capelet on the blouse, etc.
  castShadow(from, to, n, dx = 0, dy = -1) {
    const { w, col, grp } = this;
    const fm = new Uint8Array(64), tm = new Uint8Array(64);
    for (const g of from) fm[g] = 1;
    for (const g of to) tm[g] = 1;
    const x0 = Math.max(0, this.minX), x1 = Math.min(this.w - 1, this.maxX), y0 = Math.max(0, this.minY), y1 = Math.min(this.h - 1, this.maxY);
    const hit = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (!col[i] || !tm[grp[i]]) continue;
      for (let k = 1; k <= n; k++) {
        const xx = x + dx * k, yy = y + dy * k;
        if (xx < 0 || yy < 0 || xx >= w || yy >= this.h) break;
        const j = yy * w + xx;
        if (col[j] && fm[grp[j]] && this.lay[j] > this.lay[i]) { hit.push(i); break; }
      }
    }
    for (const i of hit) col[i] = PAL.dark[col[i]];
  }

  // Resolve ink + outline + palette into RGBA. lights: [{x,y,r,i,c:[r,g,b]}] in buffer coords.
  finish(lights, opts = {}) {
    const { w, h, col, grp, lay } = this;
    if (this.maxX < 0) { this.bx0 = 0; this.by0 = 0; this.bx1 = 0; this.by1 = 0; this.ctx.clearRect(0, 0, w, h); return; }
    const x0 = Math.max(1, this.minX - 2), x1 = Math.min(w - 2, this.maxX + 2);
    const y0 = Math.max(1, this.minY - 2), y1 = Math.min(h - 2, this.maxY + 2);
    const out = this.out;
    // pass 1: inner ink where a part sits in front of another group
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x, c = col[i];
        if (!c) { out[i] = 0; continue; }
        out[i] = c;
        if (!PAL.ink[c]) continue;
        const g = grp[i], l = lay[i];
        const n1 = i - 1, n2 = i + 1, n3 = i - w, n4 = i + w;
        if ((col[n1] && grp[n1] !== g && lay[n1] < l && PAL.ink[col[n1]] !== 2) ||
            (col[n2] && grp[n2] !== g && lay[n2] < l && PAL.ink[col[n2]] !== 2) ||
            (col[n3] && grp[n3] !== g && lay[n3] < l && PAL.ink[col[n3]] !== 2) ||
            (col[n4] && grp[n4] !== g && lay[n4] < l && PAL.ink[col[n4]] !== 2)) out[i] = PAL.line[c];
      }
    }
    // pass 2: outer outline (4-neighbour), coloured by the front-most neighbour
    const edge = this.edge;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        edge[i] = 0;
        if (col[i]) continue;
        let best = 0, bl = -1, bk = 0;
        const nb = [i - 1, i + 1, i - w, i + w];
        for (let k = 0; k < 4; k++) { const j = nb[k], c = col[j]; if (c && !PAL.noOut[c] && lay[j] > bl) { bl = lay[j]; best = c; bk = k; } }
        // k=0: shape is to the left (pixel on the front side); k=3: shape below (pixel on top)
        if (best) { out[i] = (bk === 0 || bk === 3) && this.selout ? PAL.lite[best] : PAL.line[best]; edge[i] = 2; }
      }
    }
    // pass 3: palette -> rgba
    const u32 = this.u32;
    const flash = opts.flash || 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x, c = out[i];
        u32[i] = c ? PAL.rgba[c] : 0;
      }
    }
    // pass 4: rim light from effect lights along the silhouette
    if (lights && lights.length) this.rim(lights, x0, y0, x1, y1);
    if (flash) this.tintAll(x0, y0, x1, y1, opts.flashColor || [255, 255, 255], flash);
    if (opts.mode === 'silhouette') this.tintAll(x0, y0, x1, y1, [22, 20, 30], 1);
    if (opts.mode === 'values') {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x, v = u32[i];
        if (!v) continue;
        const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
        const L = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
        u32[i] = (255 << 24) | (L << 16) | (L << 8) | L;
      }
    }
    // clear stale pixels from previous frame outside the new box
    const px0 = Math.min(this.bx0, x0), py0 = Math.min(this.by0, y0), px1 = Math.max(this.bx1, x1), py1 = Math.max(this.by1, y1);
    this.ctx.putImageData(this.img, 0, 0, px0, py0, px1 - px0 + 1, py1 - py0 + 1);
    this.bx0 = x0; this.by0 = y0; this.bx1 = x1; this.by1 = y1;
  }
  rim(lights, x0, y0, x1, y1) {
    const { w, u32 } = this;
    const filled = (i) => u32[i] !== 0;
    for (let y = y0 + 1; y < y1; y++) {
      for (let x = x0 + 1; x < x1; x++) {
        const i = y * w + x;
        if (!filled(i)) continue;
        if (filled(i - 1) && filled(i + 1) && filled(i - w) && filled(i + w)) continue;
        // outward normal from empty neighbours in a 5x5 window
        let nx = 0, ny = 0;
        for (let oy = -2; oy <= 2; oy++) {
          const yy = y + oy; if (yy < 0 || yy >= this.h) continue;
          for (let ox = -2; ox <= 2; ox++) {
            const xx = x + ox; if (xx < 0 || xx >= w) continue;
            if (!u32[yy * w + xx]) { nx += ox; ny += oy; }
          }
        }
        const nl = Math.hypot(nx, ny);
        if (nl < 0.01) continue;
        nx /= nl; ny /= nl;
        let rr = 0, gg = 0, bb = 0, I = 0;
        for (const L of lights) {
          const lx = L.x - (x + 0.5), ly = L.y - (y + 0.5);
          const d = Math.hypot(lx, ly);
          if (d > L.r) continue;
          const dot = (nx * lx + ny * ly) / (d || 1);
          if (dot < 0.1) continue;
          const k = L.i * Math.pow(1 - d / L.r, 1.2) * (0.35 + 0.65 * dot);
          rr += L.c[0] * k; gg += L.c[1] * k; bb += L.c[2] * k; I += k;
        }
        if (I < 0.16) continue;
        rr /= I; gg /= I; bb /= I;
        const a = I > 0.5 ? 0.9 : 0.6;
        this.mixPx(i, rr, gg, bb, a);
        if (I > 0.5) {
          const ix = x - Math.round(nx), iy = y - Math.round(ny), j = iy * w + ix;
          if (u32[j]) this.mixPx(j, rr, gg, bb, 0.45);
        }
      }
    }
  }
  mixPx(i, r, g, b, a) {
    const v = this.u32[i];
    const r0 = v & 255, g0 = (v >> 8) & 255, b0 = (v >> 16) & 255;
    const R = r0 + (Math.min(255, r) - r0) * a, G = g0 + (Math.min(255, g) - g0) * a, B = b0 + (Math.min(255, b) - b0) * a;
    this.u32[i] = (255 << 24) | ((B & 255) << 16) | ((G & 255) << 8) | (R & 255);
  }
  tintAll(x0, y0, x1, y1, rgb, a) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * this.w + x;
      if (this.u32[i]) this.mixPx(i, rgb[0], rgb[1], rgb[2], a);
    }
  }
  // flat-colour copy of the current sprite (afterimages)
  silhouette(rgb, alpha = 255) {
    const x0 = this.bx0, y0 = this.by0, x1 = this.bx1, y1 = this.by1;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d'); const im = cx.createImageData(cw, ch); const o = new Uint32Array(im.data.buffer);
    const px = (alpha << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.u32[y * this.w + x]) o[(y - y0) * cw + (x - x0)] = px;
    cx.putImageData(im, 0, 0);
    return { cv, ox: x0, oy: y0 };
  }
}

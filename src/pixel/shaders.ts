// GLSL for pixel matter. Everything except the present passes runs inside
// the 1280x720 world-pixel framebuffer: one fragment is one world pixel.
//
// The cell shader is the characters' pipeline, live: the key light picks a
// tone from the material's 4-tone ramp (Rosace's banding), then the lab's
// runtime lighting (src/lab/engine/shaders.ts SPRITE_FS: ambient + key with a
// "baked" key influence, capped/eased point lights, a light-colour band, rim
// on the first surface pixel inside the silhouette), then the outline pass
// (line, lit-side selout, inner lines where a piece sits in front of another).

export const MAX_LIGHTS = 16;

const BAYER = /* glsl */ `
const float BAYER4[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float bayer(vec2 fc) {
  ivec2 q = ivec2(mod(floor(fc), 4.0));
  return (BAYER4[q.x + q.y * 4] + 0.5) / 16.0;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

/** Quad from uQuad (screen px x0, y0, x1, y1); no vertex buffers. */
export const QUAD_VS = /* glsl */ `#version 300 es
uniform vec2 uRes;
uniform vec4 uQuad;
const vec2 C[4] = vec2[4](vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0));
void main() {
  vec2 p = mix(uQuad.xy, uQuad.zw, C[gl_VertexID]);
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const CELL_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform sampler2D uA;      // mat, tone+128, piece, flags
uniform sampler2D uB;      // normal xyz, height
uniform sampler2D uIdx;    // 4x index map (pixel-safe rotation)
uniform sampler2D uMats;   // 8 x 256: ramp0..3, line, selout, inner, spec
uniform sampler2D uMatP;   // 2 x 256: (t1, t2, t3, specThr), (emissive, glow, ink, glint)
uniform int uUseIdx;
uniform vec2 uCam;
uniform vec2 uPos;
uniform vec2 uOrigin;
uniform vec2 uGrid;
uniform vec2 uRot;
uniform float uFlip;
uniform float uMirror;     // >= 0: draw mirrored about this view row (a reflection pass); the quad already covers only the rows below it
uniform int uOutline;
uniform float uLit;
uniform float uGlow;
uniform float uHeat;
uniform float uRimMul;
uniform float uDissolve;
uniform int uDissolveMode;
uniform float uFlash;
uniform vec3 uFlashCol;
uniform float uGlint;
uniform vec4 uFog;
uniform int uView;
uniform vec3 uLayerTint;
// decal mask
uniform int uUseMask;
uniform sampler2D uMA;
uniform vec2 uMPos;
uniform vec2 uMOrigin;
uniform vec2 uMGrid;
uniform vec2 uMRot;
uniform float uMFlip;
// lighting (src/lab/data/lighting.json)
uniform vec3 uAmbient;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimCol;
uniform vec2 uRimDir;
uniform vec4 uRim;
uniform vec3 uTone;
uniform float uBands;
uniform float uKeyInf;
uniform int uCount;
uniform vec4 uL0[${MAX_LIGHTS}];
uniform vec4 uL1[${MAX_LIGHTS}];
out vec4 o;
${BAYER}
float max3(vec3 v) { return max(max(v.r, v.g), v.b); }
int ib(float v) { return int(v * 255.0 + 0.5); }

ivec2 cellAt(vec2 wc) {
  vec2 d = wc - uPos;
  vec2 l = vec2(uRot.x * d.x + uRot.y * d.y, -uRot.y * d.x + uRot.x * d.y);
  l.x *= uFlip;
  l += uOrigin;
  if (uUseIdx == 1) {
    ivec2 q = ivec2(floor(l * 4.0));
    if (q.x < 0 || q.y < 0 || float(q.x) >= uGrid.x * 4.0 || float(q.y) >= uGrid.y * 4.0) return ivec2(-1);
    vec4 m = texelFetch(uIdx, q, 0);
    int a = ib(m.a);
    if (a == 0) return ivec2(-1);
    return ivec2(ib(m.r) + ib(m.g) * 256, ib(m.b) + (a - 1) * 256);
  }
  ivec2 c = ivec2(floor(l));
  if (c.x < 0 || c.y < 0 || float(c.x) >= uGrid.x || float(c.y) >= uGrid.y) return ivec2(-1);
  return c;
}
vec4 cellA(ivec2 c) { return c.x < 0 ? vec4(0.0) : texelFetch(uA, c, 0); }
bool maskSolid(vec2 wc) {
  vec2 d = wc - uMPos;
  vec2 l = vec2(uMRot.x * d.x + uMRot.y * d.y, -uMRot.y * d.x + uMRot.x * d.y);
  l.x *= uMFlip;
  l += uMOrigin;
  ivec2 c = ivec2(floor(l));
  if (c.x < 0 || c.y < 0 || float(c.x) >= uMGrid.x || float(c.y) >= uMGrid.y) return false;
  return ib(texelFetch(uMA, c, 0).r) != 0;
}
float gate(float d) { return clamp((d - 0.3) / 0.4, 0.0, 1.0); }
vec3 band(vec3 t) {
  float lum = max3(t);
  return lum > 0.0 ? t * (floor(lum * uBands + 0.5) / uBands) / lum : vec3(0.0);
}
bool dissolved(ivec2 c) {
  if (uDissolve <= 0.0) return false;
  float th;
  if (uDissolveMode == 0) th = bayer(vec2(c));
  else if (uDissolveMode == 1) th = hash12(vec2(c) * 1.37);
  else th = 1.0 - (float(c.y) / uGrid.y) * 0.85 - hash12(vec2(c)) * 0.15;
  return th < uDissolve;
}
vec3 matCol(int k, int m) { return texelFetch(uMats, ivec2(k, m), 0).rgb; }

// The lab's runtime lighting (SPRITE_FS), with world-pixel positions.
vec3 shade(vec3 col, vec3 n, bool ink, float sil, vec2 n2, vec2 wc) {
  float ndl = clamp(dot(n, uKeyDir), 0.0, 1.0);
  float key = mix(1.0, ndl, uKeyInf);
  vec3 base = uAmbient + uKeyCol * key;
  vec3 pl = vec3(0.0), hl = vec3(0.0), rim = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uCount) break;
    vec2 d = uL0[i].xy - wc;
    float dist = length(d);
    float att = clamp(1.0 - dist / uL0[i].w, 0.0, 1.0);
    if (att <= 0.0) continue;
    att *= att;
    float I = uL1[i].w * att;
    vec3 L = normalize(vec3(d, uL0[i].z));
    float nl = max(dot(n, L), 0.0);
    pl += uL1[i].rgb * I * nl;
    hl += uL1[i].rgb * I * smoothstep(0.65, 0.85, nl);
    if (sil > 0.0 && dist > 0.5) rim += uL1[i].rgb * I * sil * gate(dot(n2, d / dist)) * uRim.z;
  }
  rim += uRimCol * uRim.x * sil * gate(dot(n2, uRimDir));
  vec3 litBase = col * band(base);
  vec3 added = max(col * min(band(base + (ink ? pl * 0.5 : pl)), vec3(uTone.z)) - litBase, 0.0);
  float hv = max3(hl);
  if (!ink && hv > 0.6) added += (hl / hv) * (hv > 1.4 ? 0.14 : 0.08) * uTone.y;
  vec3 room = max(vec3(1.0) - litBase, 0.0) * uTone.x;
  vec3 lit = litBase + room * (1.0 - exp(-added / max(room, vec3(1e-3))));
  float rl = max3(rim);
  if (rl > uRim.w) {
    vec3 rc = rim / rl;
    lit = max(lit * uRim.y, rc * 0.8) + rc * 0.12;
  }
  return mix(col, lit, uLit);
}

void main() {
  vec2 p = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  if (uMirror >= 0.0) p.y = 2.0 * uMirror - 1.0 - p.y;
  vec2 wc = p + 0.5 + uCam;
  if (uUseMask == 1 && !maskSolid(wc)) discard;
  ivec2 c = cellAt(wc);
  vec4 A = cellA(c);
  int mat = ib(A.r);
  vec3 col;
  vec3 n = vec3(0.0, 0.0, 1.0);
  bool ink = false;
  float sil = 0.0;
  vec2 n2 = vec2(0.0);
  vec3 alb;
  if (mat == 0) {
    // ---- outline pass: an empty pixel next to an inked cell ----
    if (uOutline == 0) discard;
    int bk = -1;
    int bp = -1;
    int bm = 0;
    ivec2 bc = ivec2(-1);
    for (int k = 0; k < 4; k++) {
      vec2 off = k == 0 ? vec2(-1.0, 0.0) : (k == 1 ? vec2(1.0, 0.0) : (k == 2 ? vec2(0.0, -1.0) : vec2(0.0, 1.0)));
      ivec2 cc = cellAt(wc + off);
      vec4 a = cellA(cc);
      int m = ib(a.r);
      if (m == 0) continue;
      if ((ib(a.a) & 1) != 0) continue;
      if (texelFetch(uMatP, ivec2(1, m), 0).b < 0.5) continue;
      if (dissolved(cc)) continue;
      int pc = ib(a.b);
      if (pc > bp) { bp = pc; bk = k; bm = m; bc = cc; }
    }
    if (bk < 0) discard;
    bool litSide = (bk == 0 && uKeyDir.x > 0.0) || (bk == 1 && uKeyDir.x < 0.0) || bk == 3;
    col = (uOutline == 2 || litSide) ? matCol(5, bm) : matCol(4, bm);
    if (uOutline == 2 && !litSide) col = mix(matCol(0, bm), matCol(4, bm), 0.5);
    ink = true;
    alb = col;
  } else {
    if (dissolved(c)) discard;
    int tone = ib(A.g) - 128;
    int piece = ib(A.b);
    int fl = ib(A.a);
    vec3 nL = texelFetch(uB, c, 0).xyz * 2.0 - 1.0;
    nL.x *= uFlip;
    n = normalize(vec3(uRot.x * nL.x - uRot.y * nL.y, uRot.y * nL.x + uRot.x * nL.y, nL.z) + vec3(0.0, 0.0, 1e-4));
    vec4 P0 = texelFetch(uMatP, ivec2(0, mat), 0);
    vec4 P1 = texelFetch(uMatP, ivec2(1, mat), 0);
    bool inked = P1.b > 0.5 && (fl & 1) == 0;
    // inner line: a neighbour of a piece behind this one
    bool inner = false;
    if (inked) {
      for (int k = 0; k < 4; k++) {
        vec2 off = k == 0 ? vec2(-1.0, 0.0) : (k == 1 ? vec2(1.0, 0.0) : (k == 2 ? vec2(0.0, -1.0) : vec2(0.0, 1.0)));
        vec4 a = cellA(cellAt(wc + off));
        int m = ib(a.r);
        if (m == 0) continue;
        if (ib(a.b) < piece && texelFetch(uMatP, ivec2(1, m), 0).b > 0.5) { inner = true; break; }
      }
    }
    if (P1.r > 0.5) {
      // emissive: its own ramp, no lighting, no outline
      int e = clamp(2 + tone + int(floor(uHeat + 0.5)), 0, 3);
      col = matCol(e, mat);
      alb = col;
      if (uView == 2) col = n * 0.5 + 0.5;
      else if (uView == 3) col = mix(col, uLayerTint, 0.5);
      if (uFlash > 0.0 && bayer(p) < uFlash) col = uFlashCol;
      o = vec4(mix(col, uFog.rgb, uFog.a), 1.0);
      return;
    }
    float lv = clamp(dot(n, uKeyDir), 0.0, 1.0);
    int idx = lv > P0.z ? 3 : (lv > P0.y ? 2 : (lv > P0.x ? 1 : 0));
    idx = clamp(idx + tone + ((fl & 8) != 0 ? 1 : 0), 0, 3);
    alb = matCol(idx, mat);
    if (P0.w > 0.0) {
      vec3 hv = normalize(uKeyDir + vec3(0.0, 0.0, 1.0));
      if (dot(n, hv) > P0.w && tone >= 0) alb = matCol(7, mat);
    }
    if ((fl & 4) != 0) alb *= 0.55;
    if (inner) { alb = matCol(6, mat); ink = true; }
    col = alb;
    // rim: first surface pixel inside the silhouette, where the surface turns away
    float side = length(n.xy);
    if (!ink && side > 0.2) {
      n2 = n.xy / side;
      vec2 sx = vec2(n2.x > 0.38 ? 1.0 : (n2.x < -0.38 ? -1.0 : 0.0), 0.0);
      vec2 sy = vec2(0.0, n2.y > 0.38 ? 1.0 : (n2.y < -0.38 ? -1.0 : 0.0));
      float ox = (sx.x != 0.0 && ib(cellA(cellAt(wc + sx)).r) == 0) ? 1.0 : 0.0;
      float oy = (sy.y != 0.0 && ib(cellA(cellAt(wc + sy)).r) == 0) ? 1.0 : 0.0;
      sil = max(ox, oy) * smoothstep(0.2, 0.45, side) * uRimMul;
    }
    // backlit glass / screens
    if (P1.g > 0.0 && uGlow > 0.0) {
      int gi = clamp(tone + 1 + int(floor(clamp(uGlow, 0.0, 1.0) * 1.99)), 0, 3);
      col = mix(col, matCol(gi, mat), P1.g * clamp(uGlow, 0.0, 1.0));
      alb = col;
    }
    // glint sweep on metal and glass
    if (P1.a > 0.5 && uGlint >= 0.0) {
      float s = (float(c.x) + float(c.y) * 0.6) / (uGrid.x + uGrid.y * 0.6);
      float d = abs(s - uGlint);
      if (d < 0.025) col = max(matCol(7, mat), matCol(3, mat));
      else if (d < 0.05 && bayer(p) > 0.5) col = matCol(3, mat);
      alb = col;
    }
  }
  if (uView == 0) col = shade(col, n, ink, sil, n2, wc);
  else if (uView == 1) col = alb;
  else if (uView == 2) col = ink ? vec3(0.06) : n * 0.5 + 0.5;
  else col = mix(alb, uLayerTint, 0.55);
  if (uFlash > 0.0 && bayer(p) < uFlash) col = mix(col, uFlashCol, 0.85);
  col = mix(col, uFog.rgb, uFog.a);
  o = vec4(col, 1.0);
}`;

/** Light layer: additive glows, beams and rings, stepped + dithered so they stay pixel art. */
export const GLOW_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uCam;
uniform int uKind;
uniform vec2 uP0;
uniform vec2 uP1;
uniform vec3 uCol;
uniform float uR;
uniform float uI;
uniform float uFlat;
uniform float uW1;
uniform float uThick;
out vec4 o;
${BAYER}
void main() {
  vec2 px = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  vec2 p = px + 0.5 + uCam;
  float I = 0.0;
  if (uKind == 0) {
    float d = length((p - uP0) * vec2(1.0, 1.0 / max(uFlat, 0.05))) / uR;
    if (d > 1.0) discard;
    I = uI * (1.0 - d) * (1.0 - d);
  } else if (uKind == 1) {
    vec2 ax = uP1 - uP0;
    float L2 = dot(ax, ax);
    float t = dot(p - uP0, ax) / max(L2, 1.0);
    if (t < 0.0 || t > 1.0) discard;
    vec2 nrm = normalize(vec2(-ax.y, ax.x));
    float w = mix(uR, uW1, t) * 0.5;
    float s = abs(dot(p - uP0, nrm));
    if (s > w) discard;
    I = uI * pow(1.0 - s / w, 1.1) * pow(1.0 - t, 0.9) * smoothstep(0.0, 0.1, t);
  } else {
    float d = length((p - uP0) * vec2(1.0, 1.0 / max(uFlat, 0.05)));
    float e = abs(d - uR) / max(uThick, 0.5);
    if (e > 1.0) discard;
    I = uI * (1.0 - e * e);
  }
  float q = floor(clamp(I, 0.0, 1.5) * 4.0 + bayer(px)) / 4.0;
  if (q <= 0.0) discard;
  o = vec4(uCol * q * 0.5, 0.0);
}`;

/** Particles: one point per pixel (size 1 or 2), fade by dither. */
export const POINT_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aCol;
layout(location=2) in float aSize;
uniform vec2 uRes;
out vec4 vCol;
void main() {
  vCol = aCol;
  gl_PointSize = aSize;
  vec2 p = floor(aPos) + aSize * 0.5;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const POINT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform int uAdd;
in vec4 vCol;
out vec4 o;
${BAYER}
void main() {
  if (vCol.a < 0.999 && bayer(gl_FragCoord.xy) > vCol.a) discard;
  o = uAdd == 1 ? vec4(vCol.rgb * 0.8, 0.0) : vec4(vCol.rgb, 1.0);
}`;

export const FULL_VS = /* glsl */ `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

/** Far backdrop: stepped vertical gradient with ordered dither. */
export const BACKDROP_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uLow;
uniform float uBands;
uniform float uHorizon;
out vec4 o;
${BAYER}
void main() {
  float y = uRes.y - gl_FragCoord.y;
  float t = clamp(y / uHorizon, 0.0, 1.0);
  float d = bayer(gl_FragCoord.xy) - 0.5;
  float tq = floor(t * uBands + d * 0.9 + 0.5) / uBands;
  vec3 c = tq < 0.5 ? mix(uTop, uMid, tq * 2.0) : mix(uMid, uLow, tq * 2.0 - 1.0);
  o = vec4(c, 1.0);
}`;

/** Present, integer mode: nearest, letterboxed. Also pass 1 of sharp-bilinear (upscale to k). */
export const NEAREST_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uIRes;
uniform vec2 uOut;      // target height (for the y flip)
uniform vec4 uRect;     // x, y, scale (device px), unused
out vec4 o;
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y);
  vec2 rel = fc - uRect.xy;
  if (rel.x < 0.0 || rel.y < 0.0 || rel.x >= uIRes.x * uRect.z || rel.y >= uIRes.y * uRect.z) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 lp = clamp(floor(rel / uRect.z), vec2(0.0), uIRes - 1.0);
  o = vec4(texelFetch(uScene, ivec2(lp.x, uIRes.y - 1.0 - lp.y), 0).rgb, 1.0);
}`;

/** Sharp-bilinear pass 2: linear downsample of the k-times nearest upscale. */
export const LINEAR_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uUp;
uniform vec2 uOut;
uniform vec4 uRect;     // x, y, w, h (device px)
out vec4 o;
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y);
  vec2 rel = fc - uRect.xy;
  if (rel.x < 0.0 || rel.y < 0.0 || rel.x >= uRect.z || rel.y >= uRect.w) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 uv = rel / uRect.zw;
  o = vec4(texture(uUp, vec2(uv.x, 1.0 - uv.y)).rgb, 1.0);
}`;

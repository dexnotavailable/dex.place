// GLSL for the lab renderer. Everything except BLIT runs inside the low-res
// framebuffer, so one fragment is one art pixel: shapes, light bands, rim and
// dithering all land on the same pixel grid as the sprites.

const BAYER = /* glsl */ `
const float BAYER4[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float bayer(vec2 fc) {
  ivec2 q = ivec2(mod(floor(fc), 4.0));
  return (BAYER4[q.x + q.y * 4] + 0.5) / 16.0;
}`;

export const MAX_LIGHTS = 16;

// ---------------------------------------------------------------------------
// Sprites: albedo + normal map, ambient + key + point lights + rim.
// ---------------------------------------------------------------------------
export const SPRITE_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aTint;
layout(location=3) in vec4 aParams;
uniform vec2 uRes;
out vec2 vUV;
out vec2 vScreen;
flat out vec4 vTint;
flat out vec4 vParams;
void main() {
  vUV = aUV;
  vScreen = aPos;
  vTint = aTint;
  vParams = aParams;
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const SPRITE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform vec3 uAmbient;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimCol;
uniform vec2 uRimDir;
uniform vec4 uRim;      // x: backlight intensity, y: rim brightness boost, z: point-light rim gain, w: threshold
uniform vec3 uTone;     // x: share of the remaining room effect light may fill, y: light-colour band strength, z: cap on the summed light
uniform float uBands;
uniform int uCount;
uniform vec4 uL0[${MAX_LIGHTS}]; // x, y (screen px), height, radius
uniform vec4 uL1[${MAX_LIGHTS}]; // r, g, b, intensity
in vec2 vUV;
in vec2 vScreen;
flat in vec4 vTint;   // rgb, amount (1 = flat silhouette colour)
flat in vec4 vParams; // x: flip (+1/-1), y: lit 0..1, z: key influence, w: dither opacity
out vec4 o;
${BAYER}
float max3(vec3 v) { return max(max(v.r, v.g), v.b); }
// Ink = outline and interior lines: normal-map alpha below 0.5 (the contract's
// ink mask), or albedo this close to black for exports without the mask.
bool isInk(vec4 albedo, vec4 nrm) { return nrm.a < 0.5 || max3(albedo.rgb) < 0.07; }
// 1 when the texel one step away (atlas space) is empty, or is ink with empty
// beyond it: this texel is the first surface pixel inside the silhouette.
// (off the atlas counts as empty)
bool offAtlas(ivec2 p) { ivec2 sz = textureSize(uAlbedo, 0); return any(lessThan(p, ivec2(0))) || any(greaterThanEqual(p, sz)); }
float outside(ivec2 tc, ivec2 s) {
  if (s == ivec2(0)) return 0.0;
  ivec2 p1 = tc + s, p2 = tc + 2 * s;
  if (offAtlas(p1)) return 1.0;
  vec4 a1 = texelFetch(uAlbedo, p1, 0);
  if (a1.a < 0.5) return 1.0;
  if (!isInk(a1, texelFetch(uNormal, p1, 0))) return 0.0;
  return offAtlas(p2) || texelFetch(uAlbedo, p2, 0).a < 0.5 ? 1.0 : 0.0;
}
// no rim on the side facing away from the light
float gate(float d) { return clamp((d - 0.3) / 0.4, 0.0, 1.0); }
// summed light quantized into uBands steps (by its brightest channel)
vec3 band(vec3 t) {
  float lum = max3(t);
  return lum > 0.0 ? t * (floor(lum * uBands + 0.5) / uBands) / lum : vec3(0.0);
}
void main() {
  ivec2 tc = ivec2(floor(vUV));
  vec4 a = texelFetch(uAlbedo, tc, 0);
  if (a.a < 0.5) discard;
  if (vParams.w < 0.999 && bayer(gl_FragCoord.xy) > vParams.w) discard;
  vec3 col = a.rgb;
  if (vParams.y > 0.0) {
    vec4 nt = texelFetch(uNormal, tc, 0);
    bool ink = isInk(a, nt);
    // atlas-space normal (as drawn, facing right) and the on-screen one
    vec3 nA = ink ? vec3(0.0, 0.0, 1.0) : nt.xyz * 2.0 - 1.0;
    vec3 n = normalize(vec3(nA.x * vParams.x, nA.y, nA.z) + vec3(0.0, 0.0, 1e-4));
    float ndl = clamp(dot(n, uKeyDir), 0.0, 1.0);
    float key = mix(1.0, ndl, vParams.z);
    vec3 base = uAmbient + uKeyCol * key;
    // rim lives on the first pixel inside the outline, where the surface turns away
    float sil = 0.0;
    vec2 n2 = vec2(0.0);
    float side = length(n.xy);
    if (!ink && side > 0.2) {
      n2 = n.xy / side;
      vec2 dA = nA.xy / max(length(nA.xy), 1e-4);
      ivec2 sx = ivec2(dA.x > 0.38 ? 1 : (dA.x < -0.38 ? -1 : 0), 0);
      ivec2 sy = ivec2(0, dA.y > 0.38 ? 1 : (dA.y < -0.38 ? -1 : 0));
      sil = max(outside(tc, sx), outside(tc, sy)) * smoothstep(0.2, 0.45, side);
    }
    vec3 pl = vec3(0.0);
    vec3 hl = vec3(0.0);
    vec3 rim = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= uCount) break;
      vec2 d = uL0[i].xy - vScreen;
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
    // Light in hard bands so shading stays pixel-art clusters, never a smooth
    // gradient. Effect light multiplies albedo like any light (the summed light
    // capped at uTone.z), then is eased into at most uTone.x of the room each
    // channel has left below 1.0: a white dress stays white, skin keeps its
    // ramp, black legwear stays dark. Nothing flattens to one value however
    // strong the effect is.
    vec3 litBase = col * band(base);
    vec3 added = max(col * min(band(base + (ink ? pl * 0.5 : pl)), vec3(uTone.z)) - litBase, 0.0);
    // the light's own colour as a small band on the side squarely facing it
    float hv = max3(hl);
    if (!ink && hv > 0.6) added += (hl / hv) * (hv > 1.4 ? 0.14 : 0.08) * uTone.y;
    vec3 room = max(vec3(1.0) - litBase, 0.0) * uTone.x;
    vec3 lit = litBase + room * (1.0 - exp(-added / max(room, vec3(1e-3))));
    // rim: one full-strength band, clearly brighter than what is behind her
    float rl = max3(rim);
    if (rl > uRim.w) {
      vec3 rc = rim / rl;
      lit = max(lit * uRim.y, rc * 0.8) + rc * 0.12;
    }
    col = mix(col, lit, vParams.y);
  }
  col = mix(col, vTint.rgb, vTint.a);
  o = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------
// VFX primitives, evaluated per low-res pixel. Output is premultiplied: alpha
// 1 = paints over, alpha 0 = adds light (glow), with one blend state.
// ---------------------------------------------------------------------------
export const VFX_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aLocal;
layout(location=2) in vec4 aKind;   // type, life t, seed, over (1 paint / 0 add)
layout(location=3) in vec4 aP0;
layout(location=4) in vec4 aP1;
layout(location=5) in vec4 aC0;     // core
layout(location=6) in vec4 aC1;     // main
layout(location=7) in vec4 aC2;     // edge
uniform vec2 uRes;
out vec2 vLocal;
flat out vec4 vKind;
flat out vec4 vP0;
flat out vec4 vP1;
flat out vec4 vC0;
flat out vec4 vC1;
flat out vec4 vC2;
void main() {
  vLocal = aLocal;
  vKind = aKind; vP0 = aP0; vP1 = aP1; vC0 = aC0; vC1 = aC1; vC2 = aC2;
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const VFX_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
flat in vec4 vKind;
flat in vec4 vP0;
flat in vec4 vP1;
flat in vec4 vC0;
flat in vec4 vC1;
flat in vec4 vC2;
out vec4 o;
${BAYER}
const float PI = 3.14159265;
const float TAU = 6.2831853;
float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float easeOut(float t) { float u = 1.0 - clamp(t, 0.0, 1.0); return 1.0 - u * u * u; }

// k: 1 = hottest. Hard steps: core -> main -> edge -> nothing.
bool ramp(float k, out vec3 c) {
  if (k > 0.74) { c = vC0.rgb; return true; }
  if (k > 0.40) { c = vC1.rgb; return true; }
  if (k > 0.10) { c = vC2.rgb; return true; }
  return false;
}
void paint(vec3 c) { o = vec4(c, vKind.w); }
void glow(vec3 c, float amount) {
  if (bayer(gl_FragCoord.xy) > amount) discard;
  o = vec4(c * 0.55, 0.0);
}

void arc(vec2 p, float t) {
  float R = vP0.x, T = vP0.y, a0 = vP0.z, a1 = vP0.w;
  float slivers = vP1.x, glowPx = vP1.y, flat_ = max(vP1.z, 0.05);
  vec2 q = vec2(p.x, p.y / flat_);
  float r = length(q);
  float span = a1 - a0;
  float rel = atan(q.y, q.x) - a0;
  if (span >= 0.0) rel = mod(rel, TAU); else rel = -mod(-rel, TAU);
  float s = rel / span;
  if (s < 0.0 || s > 1.0) discard;
  float head = easeOut(t / 0.22);
  float tail = pow(clamp((t - 0.08) / 0.92, 0.0, 1.0), 1.25);
  if (s > head || s <= tail) discard;
  float u = (s - tail) / max(head - tail, 1e-3);
  // thickest just behind the leading edge, tapering to a point at the tail
  float thick = T * pow(sin(PI * pow(u, 0.55)), 0.9) * (1.0 - 0.5 * t);
  float d = R - r;
  if (d < 0.0) {
    if (-d < glowPx * (1.0 - t) * sin(PI * u)) { glow(vC1.rgb, 0.5 * (1.0 - t)); return; }
    discard;
  }
  if (thick < 0.6 || d > thick) discard;
  float k = 1.0 - d / thick;
  // the tail end splits into slivers first, then the split spreads toward the head
  float split = clamp((t - 0.18) * 1.9 + (1.0 - u) * 0.55 - 0.25, 0.0, 0.85);
  if (slivers > 0.0 && split > 0.0) {
    float band = fract(d / max(thick / slivers, 1.0));
    if (band > 1.0 - split) discard;
  }
  vec3 c;
  // white core hugs the leading (outer) edge and burns away first
  float kk = k - t * 0.5 - (1.0 - u) * 0.18;
  if (!ramp(kk, c)) discard;
  paint(c);
}

void ring(vec2 p, float t) {
  float R0 = vP0.x, R1 = vP0.y, T = vP0.z, flat_ = max(vP0.w, 0.05);
  float glowPx = vP1.y;
  vec2 q = vec2(p.x, p.y / flat_);
  float r = length(q);
  float R = mix(R0, R1, easeOut(t));
  float th = max(1.0, T * pow(1.0 - t, 0.8));
  float d = R - r;
  if (d < 0.0) {
    if (-d < glowPx * (1.0 - t)) { glow(vC1.rgb, 0.45 * (1.0 - t)); return; }
    discard;
  }
  if (d > th) {
    if (d < th + glowPx * 0.6 * (1.0 - t)) { glow(vC2.rgb, 0.35 * (1.0 - t)); return; }
    discard;
  }
  float k = 1.0 - d / th;
  if (p.y < 0.0) k -= 0.18;
  vec3 c;
  if (!ramp(k - t * 0.3, c)) discard;
  paint(c);
}

void pillar(vec2 p, float t) {
  float W = vP0.x, H = vP0.y;
  float rise = easeOut(t / 0.14);
  float h = H * rise;
  float w = t < 0.14 ? W * mix(0.35, 1.0, t / 0.14) : W * pow(1.0 - (t - 0.14) / 0.86, 0.75);
  float y = -p.y;
  if (y < -2.0 || y > h) discard;
  float ax = abs(p.x);
  if (ax > w) {
    if (ax < w + vP1.y * (1.0 - t) && y < h * 0.85) { glow(vC1.rgb, 0.4 * (1.0 - t)); return; }
    discard;
  }
  float k = 1.0 - ax / max(w, 0.5);
  k -= smoothstep(h * 0.55, h, y) * 0.8;
  float scan = step(0.72, fract((y + t * H * 1.6) / 11.0));
  k -= scan * 0.22;
  vec3 c;
  if (!ramp(k - t * 0.25, c)) discard;
  paint(c);
}

void burst(vec2 p, float t) {
  float R0 = vP0.x, R1 = vP0.y, N = max(vP0.z, 1.0), T = vP0.w;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float cell = (ang / TAU + 0.5) * N + vKind.z * 7.0;
  float id = floor(cell);
  float h = hash(id + vKind.z * 13.0);
  float len = mix(R0, R1, 0.45 + 0.55 * h) * easeOut(t / 0.25);
  float inner = mix(R0 * 0.5, len, pow(clamp((t - 0.15) / 0.85, 0.0, 1.0), 0.8));
  if (r < inner || r > len) discard;
  float along = (r - inner) / max(len - inner, 1.0);
  float width = T * (1.0 - along) * (0.6 + 0.4 * hash(id * 3.7));
  float off = abs(fract(cell) - 0.5) * TAU / N * r;
  if (off > width * 0.5 + 0.35) discard;
  float k = 1.0 - off / max(width * 0.5, 0.5) * 0.6 - along * 0.5;
  vec3 c;
  if (!ramp(k - t * 0.3, c)) discard;
  paint(c);
}

void streak(vec2 p, float t) {
  float L = vP0.x, T = vP0.y, lines = vP0.z;
  float head = L * easeOut(t / 0.25);
  float tail = L * pow(clamp((t - 0.05) / 0.95, 0.0, 1.0), 1.2);
  if (p.x > head || p.x < tail) discard;
  float u = (p.x - tail) / max(head - tail, 1.0);
  float th = T * pow(u, 0.55) * (1.0 - 0.5 * t);
  float ay = abs(p.y);
  if (ay <= th * 0.5 + 0.25) {
    float k = 1.0 - ay / max(th * 0.5, 0.5) * 0.7;
    vec3 c;
    if (!ramp(k - t * 0.35, c)) discard;
    paint(c);
    return;
  }
  // parallel speed lines, shorter and thinner, offset back
  for (int i = 1; i <= 3; i++) {
    if (float(i) > lines) break;
    float off = T * 0.5 + 2.0 + float(i) * 3.0;
    float seg0 = tail + (head - tail) * (0.15 + 0.2 * hash(float(i) + vKind.z));
    float seg1 = head - (head - tail) * (0.25 + 0.2 * hash(float(i) * 2.3 + vKind.z));
    if (abs(ay - off) < 0.5 && p.x > seg0 && p.x < seg1 && t < 0.8) { paint(float(i) == 1.0 ? vC1.rgb : vC2.rgb); return; }
  }
  discard;
}

void disc(vec2 p, float t) {
  float R0 = vP0.x, R1 = vP0.y, flat_ = max(vP0.z, 0.05);
  vec2 q = vec2(p.x, p.y / flat_);
  float R = mix(R0, R1, easeOut(t));
  float r = length(q);
  if (r > R) {
    if (r < R + vP1.y * (1.0 - t)) { glow(vC1.rgb, 0.5 * (1.0 - t)); return; }
    discard;
  }
  float k = 1.0 - r / max(R, 0.5) * 0.85;
  if (vKind.w < 0.5) {
    // additive flash: core -> main -> a dithered edge that falls off to
    // nothing (never a flat painted coin)
    float kk = k - t * 0.6;
    if (kk < 0.3) discard;
    if (kk < 0.5 && bayer(gl_FragCoord.xy) > 0.5) discard;
    vec3 c = kk > 0.72 ? vC0.rgb : (kk > 0.5 ? vC1.rgb : vC2.rgb);
    o = vec4(c * (kk > 0.5 ? 0.9 : 0.6), 0.0);
    return;
  }
  vec3 c;
  if (!ramp(k - t * 0.55, c)) discard;
  paint(c);
}

void main() {
  int type = int(vKind.x + 0.5);
  float t = vKind.y;
  vec2 p = vLocal;
  o = vec4(0.0);
  if (type == 0) {           // rect / particle / line
    if (vP0.x < 0.999 && bayer(gl_FragCoord.xy) > vP0.x) discard;
    o = vec4(vC1.rgb, vKind.w);
  } else if (type == 1) arc(p, t);
  else if (type == 2) ring(p, t);
  else if (type == 3) pillar(p, t);
  else if (type == 4) burst(p, t);
  else if (type == 5) streak(p, t);
  else if (type == 6) disc(p, t);
  else if (type == 7) {      // diamond (shards, feathers)
    if (abs(p.x) / max(vP0.x, 0.5) + abs(p.y) / max(vP0.y, 0.5) > 1.0) discard;
    if (vP1.x < 0.999 && bayer(gl_FragCoord.xy) > vP1.x) discard;
    o = vec4(vC1.rgb, vKind.w);
  }
  if (vKind.w < 0.5) o.a = 0.0;
}`;

// ---------------------------------------------------------------------------
// Backdrop: soft vertical gradient in dithered bands (never a smooth ramp).
// ---------------------------------------------------------------------------
export const FULL_VS = /* glsl */ `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

export const BACKDROP_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uHorizon;  // screen y of the horizon (world y 0 through parallax)
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uLow;
uniform float uBands;
out vec4 o;
${BAYER}
void main() {
  float y = uRes.y - gl_FragCoord.y;
  float t = clamp((y - (uHorizon - 420.0)) / 420.0, 0.0, 1.0);
  float d = bayer(gl_FragCoord.xy) - 0.5;
  float tq = floor(t * uBands + d * 0.9 + 0.5) / uBands;
  vec3 c = tq < 0.5 ? mix(uTop, uMid, tq * 2.0) : mix(uMid, uLow, tq * 2.0 - 1.0);
  if (y > uHorizon) c = uLow;
  o = vec4(c, 1.0);
}`;

// Multiply pass (cut-in dim): blended as dst * uMul.
export const DIM_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec3 uMul;
out vec4 o;
void main() { o = vec4(uMul, 1.0); }`;

// ---------------------------------------------------------------------------
// Blit: nearest integer upscale into the letterboxed canvas, zoom punch as an
// integer step, impact frames and fades evaluated per art pixel.
// ---------------------------------------------------------------------------
export const BLIT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uIRes;
uniform vec2 uCanvas;
uniform vec4 uRect;     // x, y (top-left, device px), scale, zoomed scale
uniform vec2 uFocus;    // low-res px the zoom keeps in place
uniform int uImpact;    // 0 none, 1 invert, 2 mono
uniform vec4 uFade;     // rgb, amount (dithered per art pixel)
out vec4 o;
${BAYER}
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 rel = fc - uRect.xy;
  float S = uRect.z, Z = uRect.w;
  if (rel.x < 0.0 || rel.y < 0.0 || rel.x >= uIRes.x * S || rel.y >= uIRes.y * S) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 lp = floor(uFocus + (rel - (uFocus + 0.5) * S) / Z + 0.5);
  lp = clamp(lp, vec2(0.0), uIRes - 1.0);
  vec3 c = texelFetch(uScene, ivec2(lp.x, uIRes.y - 1.0 - lp.y), 0).rgb;
  if (uImpact == 1) c = vec3(1.0) - c;
  else if (uImpact == 2) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = l > 0.52 ? vec3(0.97, 0.95, 0.93) : vec3(0.05, 0.04, 0.07);
  }
  if (uFade.a > 0.0 && bayer(lp) < uFade.a) c = uFade.rgb;
  o = vec4(c, 1.0);
}`;

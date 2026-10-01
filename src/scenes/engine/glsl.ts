// Shared GLSL for every scene layer. A layer program is assembled as:
//
//   HEADER, palette defines (R_<NAME>), LIB, the scene's fogColor(), LIB_FOG,
//   the scene prelude (sceneLight() and helpers), the layer body, MAIN.
//
// Coordinates: `s` is the low-res screen pixel (y down, whole numbers). `p` is
// the layer pixel: s plus the layer's whole-pixel parallax offset. At the middle
// of the camera's pan range p == s, so scenes are authored in "screen pixels at
// mid-pan". Everything is evaluated per whole pixel; nothing is filtered.

export const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 uRes;
uniform vec2 uOff;
uniform float uMirror;
uniform float uTime;
uniform float uFog;
uniform float uDepth;
uniform float uPar;
uniform float uReduced;
uniform float uCam;
uniform float uHalf;
uniform float uDither;
uniform float uOpacity;
uniform float uReflFade;
uniform float uReflDim;
uniform sampler2D uPal;
uniform sampler2D uTex;
uniform vec2 uTexOrigin;
uniform vec2 uTexSize;
uniform float uRepeat;
uniform sampler2D uRefl;
uniform vec4 uFlash[4];
uniform vec3 uFlashC[4];
`;

export const LIB = /* glsl */ `
const float PI = 3.14159265;
uint hashu(uint x) {
  x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16;
  return x;
}
// hash of a whole-number lattice point, 0..1
float hash2(vec2 p) {
  uvec2 i = uvec2(ivec2(floor(p)) + 1048576);
  return float(hashu(i.x * 1597334677U ^ hashu(i.y + 0x9e3779b9U))) / 4294967295.0;
}
float hash1(float x) { return hash2(vec2(x, 7.0)); }
float hash3(vec3 p) {
  uvec3 i = uvec3(ivec3(floor(p)) + 1048576);
  return float(hashu(i.x * 1597334677U ^ hashu(i.y * 3812015801U ^ hashu(i.z + 0x9e3779b9U)))) / 4294967295.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2(i), b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0)), d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// fractal value noise, normalised to 0..1
float fbm(vec2 p, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    n += a;
    p = p * 2.03 + vec2(17.13, 9.71);
    a *= 0.5;
  }
  return s / n;
}
float ridged(vec2 p, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
    n += a;
    p = p * 2.07 + vec2(3.7, 11.3);
    a *= 0.5;
  }
  return s / n;
}
// ordered 4x4 dither threshold, 0..1, keyed to whole pixels
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}
// quantise v (0..1) to n steps; w (0..1) is how much of each step boundary is dithered
float stepd(float v, float n, vec2 p, float w) {
  return clamp(floor(v * n + (bayer4(p) - 0.5) * w + 0.5) / n, 0.0, 1.0);
}
// whole-pixel parallax offset of a depth, same rounding as the engine
float layerOff(float depth) {
  float par = depth > 1e6 ? 0.0 : 1.0 / depth;
  return floor(uCam * par + 0.5) - floor(uHalf * par + 0.5);
}
float paln(float row) { return texelFetch(uPal, ivec2(7, int(row)), 0).r * 255.0; }
vec3 pal(float row, float i) { return texelFetch(uPal, ivec2(int(i), int(row)), 0).rgb; }
// shade 0..1 -> one of the ramp's bands. dith dithers band edges (0 = hard).
vec3 ramp(float row, float shade, vec2 p, float dith) {
  float n = paln(row);
  float v = clamp(shade, 0.0, 0.999) * n + (bayer4(p) - 0.5) * dith;
  return pal(row, clamp(floor(v), 0.0, n - 1.0));
}
float flashLight(vec2 s) {
  float l = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 f = uFlash[i];
    if (f.w <= 0.0) continue;
    float d = length(s - f.xy) / f.z;
    l += f.w * max(0.0, 1.0 - d * d);
  }
  return l;
}
vec3 flashTint(vec2 s) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 f = uFlash[i];
    if (f.w <= 0.0) continue;
    float d = length(s - f.xy) / f.z;
    c += uFlashC[i] * f.w * max(0.0, 1.0 - d * d);
  }
  return c;
}
`;

// The reflection buffer's pixel for a screen pixel (the world draws scenes into a larger frame).
export const LIB_REFL = /* glsl */ `
#ifdef WORLD_FRAME
ivec2 reflPx(float x, float y) { return ivec2(clamp(x + uFrame.x, 0.0, uFrame.z - 1.0), clamp(uFrame.w - 1.0 - y - uFrame.y, 0.0, uFrame.w - 1.0)); }
// the lowest row (in s) the reflection buffer holds: the frame's bottom edge in the world, the view's elsewhere
float reflMaxY() { return uFrame.w - 1.0 - uFrame.y; }
// Reflections of what stands on the player plane are sharpest at the waterline and break up with distance
// below it, so a ripple's shear and jitter ease in over ~1.5 H under the world's mirror line (uWl).
float nearWl(float y) { return uWl < 0.0 ? 1.0 : mix(0.2, 1.0, smoothstep(0.0, 120.0, y - uWl)); }
// A big dark mass that meets the water (an embankment wall, a cliff foot) must read as a dark mirror image,
// not a thin teal wash: where the reflected pixel is clearly darker than the water body (and is something, not
// the buffer's empty black), the reflection takes over (0..1 weight, quantised by the caller).
float darkMass(vec3 body, vec3 refl) {
  float lb = dot(body, vec3(0.3, 0.5, 0.2)), lr = dot(refl, vec3(0.3, 0.5, 0.2));
  return step(0.012, lr) * smoothstep(0.03, 0.14, lb - lr);
}
#else
ivec2 reflPx(float x, float y) { return ivec2(clamp(x, 0.0, uRes.x - 1.0), uRes.y - 1.0 - y); }
float reflMaxY() { return uRes.y - 1.0; }
float nearWl(float y) { return 1.0; }
float darkMass(vec3 body, vec3 refl) { return 0.0; }
#endif
`;

export const LIB_FOG = /* glsl */ `
// base: exact layer fog (no dither, so a flat layer stays flat);
// extra: fog that varies across the layer, stepped in 8ths with dithered edges
vec3 applyFog(vec3 c, float base, float extra, vec2 p, vec2 s) {
  float q = clamp(base + stepd(clamp(extra, 0.0, 1.0), 8.0, p, 1.0), 0.0, 1.0);
  return mix(c, fogColor(s), q);
}
`;

export const DEFAULT_PRELUDE = /* glsl */ `
float sceneLight(vec2 s, float depth) { return 0.0; }
`;

export const MAIN = /* glsl */ `
out vec4 fragColor;
void main() {
  vec2 s = vec2(floor(gl_FragCoord.x), uRes.y - 1.0 - floor(gl_FragCoord.y));
  float fade = 1.0;
  if (uMirror >= 0.0) {
    if (s.y <= uMirror) discard;
    // a reflection can dim with distance below its waterline: stepped in quarters,
    // dithered only at the step edges (keyed to the reflection's own rows)
    if (uReflFade > 0.0) {
      float k = clamp(1.0 - (s.y - uMirror) / uReflFade, 0.0, 1.0);
      fade = clamp(floor(k * 4.0 + (bayer4(s) - 0.5) * 0.8 + 0.5) / 4.0, 0.0, 1.0);
      if (fade <= 0.0) discard;
    }
    s.y = 2.0 * uMirror - s.y;
  }
  vec2 p = s + uOff;
  vec4 c = layer(p, s);
  if (c.a <= 0.0) discard;
  fragColor = vec4(c.rgb * (1.0 - uReflDim), c.a * uOpacity * fade);
}
`;

export const FULL_VS = /* glsl */ `#version 300 es
void main() {
  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Final presentation (see scale.ts). Whole-number scale: plain nearest.
// Otherwise sharp-bilinear: exactly what you get from a nearest upscale to the
// next whole multiple (prescale) followed by a linear resize to the fitted size,
// done in one pass with four texel fetches. Only the seams between world pixels
// get a blended device pixel; the pixels themselves stay flat. Never plain bilinear.
export const BLIT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec4 uRect; // x, y, w, h (device px, bottom-left origin)
uniform vec3 uMode; // sharp (0/1), prescale, device px per world px
out vec4 fragColor;
void main() {
  vec2 o = gl_FragCoord.xy - uRect.xy;
  if (uMode.x < 0.5) {
    fragColor = vec4(texelFetch(uSrc, ivec2(floor(o / uMode.z)), 0).rgb, 1.0);
    return;
  }
  vec2 src = vec2(textureSize(uSrc, 0));
  float pre = uMode.y;
  // this device pixel's centre in prescaled pixels, then the two prescaled texels around it
  vec2 P = o * (src * pre) / uRect.zw - 0.5;
  vec2 i0 = floor(P);
  vec2 t = P - i0;
  vec2 hi = src - 1.0;
  ivec2 a = ivec2(clamp(floor(i0 / pre), vec2(0.0), hi));
  ivec2 b = ivec2(clamp(floor((i0 + 1.0) / pre), vec2(0.0), hi));
  vec3 c00 = texelFetch(uSrc, a, 0).rgb;
  vec3 c10 = texelFetch(uSrc, ivec2(b.x, a.y), 0).rgb;
  vec3 c01 = texelFetch(uSrc, ivec2(a.x, b.y), 0).rgb;
  vec3 c11 = texelFetch(uSrc, b, 0).rgb;
  fragColor = vec4(mix(mix(c00, c10, t.x), mix(c01, c11, t.x), t.y), 1.0);
}
`;

// Point sprites: particles and flash accents. Positions arrive as whole-pixel
// top-left corners; the sprite is size x size low-res pixels.
export const POINT_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec4 aPos;   // x, y (top-left, screen px), size, shape
layout(location = 1) in vec4 aLook;  // ramp row, shade, frame, alpha
uniform vec2 uRes;
uniform float uMirror;
out vec4 vLook;
out float vShape;
out float vSize;
out vec2 vOrigin;
void main() {
  float size = aPos.z;
  vec2 tl = aPos.xy;
  if (uMirror >= 0.0) tl.y = 2.0 * uMirror - tl.y - size + 1.0;
  vec2 c = tl + size * 0.5;
  gl_Position = vec4(c.x / uRes.x * 2.0 - 1.0, 1.0 - c.y / uRes.y * 2.0, 0.0, 1.0);
  gl_PointSize = size;
  vLook = aLook;
  vShape = aPos.w;
  vSize = size;
  vOrigin = tl;
}
`;

export const POINT_BODY = /* glsl */ `
in vec4 vLook;
in float vShape;
in float vSize;
in vec2 vOrigin;
out vec4 fragColor;
// 7x3 bird frames, bit rows top to bottom (bit 0 = leftmost pixel)
const int BIRD[9] = int[9](
  0x41, 0x22, 0x1C,   // wings up
  0x00, 0x7F, 0x08,   // wings level
  0x00, 0x1C, 0x63);  // wings down
// far birds, 5x2 (a flock at depth 22 and beyond): up, level, down
const int BIRD_S[6] = int[6](0x11, 0x0E, 0x00, 0x1F, 0x0E, 0x11);
// near birds, 9x4 (depth under 11): up, level, down
const int BIRD_L[12] = int[12](
  0x101, 0x082, 0x07C, 0x010,
  0x000, 0x0C6, 0x139, 0x000,
  0x000, 0x07C, 0x092, 0x101);
void main() {
  vec2 lp = floor(gl_PointCoord * vSize);
  if (uMirror >= 0.0) lp.y = vSize - 1.0 - lp.y;
  vec2 s = vOrigin + lp;
  vec2 c = lp - (vSize - 1.0) * 0.5;
  float r = length(c) / max(1.0, (vSize - 1.0) * 0.5);
  float a = vLook.w;
  float shade = vLook.y;
  int shape = int(vShape + 0.5);
  if (shape == 1) {
    // bird: 7x3 frames in the top-left of the sprite
    int f = int(vLook.z) % 3;
    if (lp.x > 6.0 || lp.y > 2.0) discard;
    int bits = BIRD[f * 3 + int(lp.y)];
    if (((bits >> int(lp.x)) & 1) == 0) discard;
  } else if (shape == 5) {
    // far bird: 5x2 frames in the top-left of the sprite
    int f = int(vLook.z) % 3;
    if (lp.x > 4.0 || lp.y > 1.0) discard;
    if (((BIRD_S[f * 2 + int(lp.y)] >> int(lp.x)) & 1) == 0) discard;
  } else if (shape == 6) {
    // near bird: 9x4 frames in the top-left of the sprite
    int f = int(vLook.z) % 3;
    if (lp.x > 8.0 || lp.y > 3.0) discard;
    if (((BIRD_L[f * 4 + int(lp.y)] >> int(lp.x)) & 1) == 0) discard;
  } else if (shape == 2) {
    // glint: four stepped arms plus a core; arm length scales with alpha
    float arm = (vSize - 1.0) * 0.5 * a;
    bool onAxis = abs(c.x) < 0.5 || abs(c.y) < 0.5;
    float d = abs(c.x) + abs(c.y);
    if (!(onAxis && d <= arm) && !(d <= 1.0 && a > 0.5)) discard;
    shade = shade * (1.0 - 0.45 * floor(d / max(arm, 1.0) * 3.0) / 3.0);
  } else if (shape == 3) {
    // glow: stepped radial disc, 4 rings
    if (r > 1.0) discard;
    float ring = floor((1.0 - r) * 4.0 + bayer4(s) * 0.6) / 4.0;
    if (ring <= 0.0) discard;
    a *= ring;
  } else if (shape == 4) {
    // small plus
    if (abs(c.x) > 0.5 && abs(c.y) > 0.5) discard;
  }
  vec3 col = ramp(vLook.x, shade, s, 0.0);
  col = applyFog(col, uFog, 0.0, s, s);
  fragColor = vec4(col, a * uOpacity);
}
`;

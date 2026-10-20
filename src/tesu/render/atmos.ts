// The sky, the still water and the mist: the three things in Tesu that are not plates.
//
// Still water is the old site's best idea, kept and generalised for a moving, zooming
// camera: every plane is drawn into a reflection target mirrored about its OWN waterline
// (so far shores meet the water higher up the frame), the sky mirrored about the horizon,
// her and the play plane about the play waterline; the water then reads that target at
// its own pixel plus a whole-pixel ripple shear. Each frame row of the lake is a depth
// (a perspective ground plane), so ripples, glints and haze are sized by distance and
// stay put on the water while the camera pans or pulls back.
//
// Everything is stepped and ordered-dithered: no smooth gradients on screen.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";
import type { Water } from "../world/types.ts";
import { planeXf, rowOf, type CamState } from "./view.ts";

const LIB = /* glsl */ `
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}
float hash2(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// quantise v (0..1) into n steps, dithering the edge of each step
float stepd(float v, float n, vec2 p) {
  float x = v * n;
  float fl = floor(x);
  return (fl + step(bayer4(p), fract(x))) / n;
}
`;

const SKY_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform float uHz;        // horizon row
uniform vec3 uTop, uMid, uLow;
uniform vec3 uSun;        // x, y (frame px), radius; radius 0 = none
uniform float uMirror;    // 1 = drawn mirrored about the horizon (for the reflection)
uniform vec4 uGlow;       // bloom radius (frame px), strength, style (1 = banded with a bloom), dither cell
uniform vec3 uGlowCol;
out vec4 o;
// v (0..1) in n flat bands; only the last stretch of each band dithers into the next (a seam,
// never a screen door across the whole band)
float bandd(float v, float n, vec2 c) {
  float x = clamp(v, 0.0, 1.0) * n;
  float fl = floor(x), fr = fract(x);
  return (fl + step(bayer4(c), (fr - 0.72) / 0.28)) / n;
}
// (round 5) The sun: a small bright core and one smooth bloom falling off from it, a broad warm
// wash under it; fine flat steps ordered-dithered on the art's own cell (no ring edges anywhere)
vec3 sunOver(vec3 col, vec2 q, vec2 c) {
  float r = uSun.z;
  float d = length(q - uSun.xy);
  // the broad wash: the sky warming toward the sun
  float wash = uGlow.y * exp(-d / uGlow.x);
  col = mix(col, uGlowCol, stepd(clamp(wash, 0.0, 1.0), 40.0, c) * 0.8);
  // the bloom: bright close round the core, falling off smoothly
  float e = max(0.0, d - r);
  float bloom = 0.8 * exp(-e / (r * 1.8)) + 0.3 * exp(-e / (r * 6.0));
  col = mix(col, vec3(1.0, 0.975, 0.9), stepd(clamp(bloom, 0.0, 1.0), 40.0, c));
  // the core: crisp, its edge one cell of dither
  float k = clamp((r - d) / max(1.0, uGlow.w) + 0.5, 0.0, 1.0);
  if (k > bayer4(c)) col = vec3(1.0, 0.995, 0.965);
  return col;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (uMirror > 0.5) {
    if (p.y < uHz) discard;
    p.y = 2.0 * uHz - p.y;
  }
  if (uGlow.z > 0.5) {
    // the morning sky (Kagami's): the gradient in flat bands with dithered seams, deepening up to
    // the zenith (style 2, Gate Road's: the plain gradient), and the sun over it
    vec2 c = floor(floor(p) / uGlow.w);
    vec2 q = (c + 0.5) * uGlow.w;
    float h = clamp((uHz - q.y) / uRes.y, -0.2, 1.4);
    vec3 col;
    if (uGlow.z > 1.5) {
      float t = clamp(h / 0.9, 0.0, 1.0);
      float lo = clamp(-h / 0.2, 0.0, 1.0);
      col = mix(uMid, uTop, stepd(pow(t, 0.75), 9.0, c));
      col = mix(col, uLow, stepd(lo, 4.0, c));
    } else {
      float t = clamp(h / 0.95, 0.0, 1.0);
      float lo = clamp(-h / 0.2, 0.0, 1.0);
      col = mix(uMid, uTop, bandd(pow(t, 0.62), 12.0, c));
      col = mix(col, uLow, bandd(lo, 4.0, c));
    }
    if (uSun.z > 0.0) col = sunOver(col, q, c);
    // (kagami9 r1) mirrored, the sky is drawn with alpha 0, so the water can tell land from sky in its mirror
    o = vec4(col, uMirror > 0.5 ? 0.0 : 1.0);
    return;
  }
  p = floor(p);
  // height above the horizon, 0 at the horizon, 1 a frame height up
  float h = clamp((uHz - p.y) / uRes.y, -0.2, 1.4);
  float t = clamp(h / 0.9, 0.0, 1.0);
  float lo = clamp(-h / 0.2, 0.0, 1.0);
  float a = stepd(pow(t, 0.75), 9.0, p);
  vec3 c = mix(uMid, uTop, a);
  c = mix(c, uLow, stepd(lo, 4.0, p));
  if (uSun.z > 0.0) {
    float d = length(p - uSun.xy);
    float glow = clamp(1.0 - d / (uSun.z * 7.0), 0.0, 1.0);
    c = mix(c, vec3(1.0, 0.98, 0.9), stepd(glow * glow * 0.55, 5.0, p));
    if (d < uSun.z) c = vec3(1.0, 0.99, 0.94);
  }
  o = vec4(c, uMirror > 0.5 ? 0.0 : 1.0);
}`;

const MIST_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform vec4 uBands[4];   // row centre, half height, density, drift speed (px/s)
uniform int uCount;
uniform vec3 uColour;
uniform float uTime;
uniform float uCamX;      // for drift that stays put on the land
uniform vec2 uSpan;       // frame x range the mist covers (soft ends)
out vec4 o;
void main() {
  vec2 p = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  float ends = clamp(min(p.x - uSpan.x, uSpan.y - p.x) / 120.0, 0.0, 1.0);
  if (ends <= 0.0) discard;
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uCount) break;
    vec4 b = uBands[i];
    float d = (p.y - b.x) / b.y;
    float prof = exp(-d * d * 1.6);
    // (engine 10-18) the field moves by whole px (a sub-px scroll re-dithers every step: it boiled on a pan)
    float x = p.x + floor(uCamX * (0.08 + 0.1 * float(i)) + uTime * b.w + 0.5);
    float n = vnoise(vec2(x / 140.0, p.y / 18.0 + float(i) * 7.0)) * 0.65 + vnoise(vec2(x / 41.0, p.y / 7.0)) * 0.35;
    a = max(a, prof * b.z * (0.45 + 0.9 * n));
  }
  a *= ends;
  // two to four ordered-dither steps, never smooth alpha (the dither rides on the first band's field)
  vec2 dp = p + vec2(floor(uCamX * 0.08 + uTime * uBands[0].w + 0.5), -floor(uBands[0].x));
  float s = stepd(clamp(a, 0.0, 1.0), 4.0, dp) * 0.75;
  if (s <= 0.0) discard;
  o = vec4(uColour * s, s);
}`;

// Fog lying on the still water at one plane's waterline (a FogLayer): thick on the water,
// thinning up to a heaped top that rolls at three scales and drifts, a short apron out over the
// water in front; flat steps of translucency on the art's own cell, each step's edge a narrow
// dithered seam that wanders with the billows (never a ruled stratum, never a screen door).
// Locked to its plane (it parallaxes with the land it wraps). (Round 5) It lies in pools: thick
// at the karst's feet, torn patches between them over the open water, clear gaps where the lake
// mirrors crisply.
const FOG_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform float uWl;        // the plane's waterline row (frame px)
uniform vec3 uXf;         // the plane's art scale g, its x offset (frame px), the drift (art px)
uniform vec4 uFog;        // density, height, apron (art px), roll
uniform vec3 uFog2;       // bank size (art px), cell (frame px), foot (share of the height lying solid)
uniform vec4 uPools[16];  // plane art px x, half width, strength, 0
uniform int uNPools;
uniform float uCover;     // the share of the open water between pools its patches cover (1: all)
uniform vec4 uVeilA[8];   // (round 6) veils: drifting x, half width, height above the line, thickness (art px)
uniform vec4 uVeilB[8];   //   strength, tear (0 whole .. 1 rags), how far its lit top shows (0..1), slope (rise a px)
uniform int uNVeils;
uniform vec3 uColour;
uniform float uMirror;    // 1: drawn mirrored about the waterline (the lake's reflection target)
out vec4 o;
// v (0..1) in n flat steps; only a narrow seam where two steps meet dithers
float seamd(float v, float n, vec2 c) {
  float x = clamp(v, 0.0, 1.0) * n;
  float fl = floor(x), fr = fract(x);
  return (fl + step(bayer4(c), (fr - 0.62) / 0.38)) / n;
}
void main() {
  vec2 f = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (uMirror > 0.5) {
    if (f.y < uWl) discard;
    f.y = 2.0 * uWl - f.y;
  }
  vec2 cc = floor(f / uFog2.y);
  vec2 c = (cc + 0.5) * uFog2.y;
  float g = uXf.x;
  float ps = (c.x - uXf.y) / g;
  float px = ps + uXf.z;
  float up = (uWl - c.y) / g;
  float S = uFog2.x;
  // --- the banks lying on the water
  float aBank = 0.0, aFoot = 0.0;
  bool litTop = false;
  // where the banks lie (fixed on the land): pools, and torn patches over the open water
  float cov = 1.0;
  if (uNPools > 0 || uCover < 0.999) {
    float pool = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uNPools) break;
      vec4 P = uPools[i];
      float dx = (ps - P.x) / max(1.0, P.y);
      // (a pool's ends tear: its reach wanders with the drifting fog)
      dx *= 1.0 + 0.35 * (vnoise(vec2(px / (S * 0.3), float(i) * 3.1)) - 0.5);
      pool = max(pool, P.z * exp(-dx * dx * 1.8));
    }
    float open = uCover * smoothstep(0.42, 0.78, vnoise(vec2(ps / (S * 1.6), 9.3)) * 0.75 + vnoise(vec2(px / (S * 0.45), 4.4)) * 0.25);
    cov = max(pool, open);
  }
  if (cov >= 0.04 && uFog.y > 0.0) {
    // the banks' top: heaped at three scales, never level for long; lower where the cover thins
    float n1 = vnoise(vec2(px / S, 1.3));
    float n2 = vnoise(vec2(px / (S * 0.36), 4.1));
    float n3 = vnoise(vec2(px / (S * 0.12), 7.7));
    float top = uFog.y * mix(1.0, 0.18 + 1.25 * n1 * n1 + 0.4 * n2 + 0.18 * n3, uFog.w) * min(1.25, 0.25 + 0.75 * cov);
    if (up <= top && top >= 1.0) {
      float a = -1.0;
      if (up >= 0.0) a = pow(1.0 - up / top, 0.45);
      // (round 6: its reach out over the water wanders, so the bank's lower edge is never ruled)
      else if (uFog.z > 0.0) a = clamp(1.0 + up / (uFog.z * min(1.0, cov) * (0.45 + 1.1 * vnoise(vec2(px / (S * 0.55), 6.6)))), 0.0, 1.0);
      if (a >= 0.0) {
        // billows inside the bank: rolling lumps of thicker fog, so its steps follow the banks' forms
        float bl = vnoise(vec2(px / (S * 0.22), up / (uFog.y * 0.55) + 2.0)) * 0.6 + vnoise(vec2(px / (S * 0.07), up / (uFog.y * 0.2))) * 0.4;
        a = clamp(a * (0.62 + 0.62 * bl) * min(1.0, 0.35 + 0.75 * cov), 0.0, 1.0);
        // the bank's foot (opt-in): solid on the water up to a share of its rolling height, and
        // out over the water in front of the line as far (it swallows the line where land meets
        // water: no ruled foot)
        // (round 6: nearly opaque, whatever the bank's own density)
        if (uFog2.z > 0.0) {
          float fh = max(top * uFog2.z, 1.0);
          if (up >= 0.0) aFoot = clamp(2.0 - up / fh, 0.0, 1.0) * min(1.0, cov * 1.4);
          else aFoot = clamp(1.0 + up / max(1.0, uFog.z * 0.8 * min(1.0, cov) * (0.45 + 1.1 * vnoise(vec2(px / (S * 0.4), 8.8)))), 0.0, 1.0) * min(1.0, cov * 1.4);
        }
        aBank = a;
        // the bank's upper reach catches the morning sun
        litTop = up > top * 0.58;
      }
    }
  }
  // --- veils: torn streamers of the same fog floating at a height (round 6: the weather the far
  // Walker wades through), soft-edged, drifting with the fog, each its own shape
  float aVeil = 0.0;
  bool litVeil = false;
  for (int i = 0; i < 8; i++) {
    if (i >= uNVeils) break;
    vec4 A = uVeilA[i], B = uVeilB[i];
    float sd = float(i) * 5.7 + A.x * 0.013;
    float dx = (px - A.x) / max(1.0, A.y);
    // its reach tears: the ends wander
    float reach = 1.0 + 0.4 * (vnoise(vec2(up / max(2.0, A.w * 1.5), sd)) - 0.5);
    float ex = 1.0 - (dx * dx) / (reach * reach);
    if (ex <= 0.0) continue;
    // its centre line wanders up and down along it, its thickness swells and thins
    float cy = A.z + B.w * (px - A.x) + A.w * 2.2 * (vnoise(vec2(px / max(8.0, A.y * 0.45), sd + 1.0)) - 0.5) + A.w * 0.8 * (vnoise(vec2(px / max(4.0, A.y * 0.12), sd + 3.0)) - 0.5);
    float th = A.w * (0.55 + 0.9 * vnoise(vec2(px / max(6.0, A.y * 0.3), sd + 2.0)));
    float dy = (up - cy) / max(1.0, th);
    if (abs(dy) > 1.6) continue;
    float prof = exp(-dy * dy * 1.6);
    // torn: rags and holes at the fog's own scale, drifting
    float rag = vnoise(vec2(px / max(5.0, A.w * 1.4), up / max(2.0, A.w * 0.7) + sd)) * 0.65 + vnoise(vec2(px / max(3.0, A.w * 0.5), up / max(1.5, A.w * 0.35) + sd * 2.0)) * 0.35;
    float tear = mix(1.0, smoothstep(0.32, 0.62, rag), B.y);
    float a = B.x * pow(ex, 0.6) * prof * tear;
    if (a > aVeil) { aVeil = a; litVeil = dy > (1.0 - B.z) * 0.9; }
  }
  // flat steps of translucency, their seams dithered on the cell
  // (engine 10-18) the seams' dither rides on the fog (its plane's whole-px offset and its drift), not the screen
  vec2 dc = cc - floor(vec2(uXf.y - uXf.z * g, uWl) / uFog2.y + 0.5);
  float sB = max(seamd(aBank, 5.0, dc) * uFog.x, seamd(aFoot, 5.0, dc) * 0.95), sV = seamd(aVeil, 5.0, dc);
  float s = max(sB, sV);
  if (s <= 0.0) discard;
  bool lit = sV > sB ? litVeil : litTop;
  // the upper reach catches the morning sun: a warmer, paler step over the cool body below it,
  // so each bank and veil reads as a lit volume lying in the air, not a tint
  vec3 col = lit ? mix(uColour, vec3(0.99, 0.985, 0.955), 0.65) : uColour;
  o = vec4(col * s, s);
}`;

const WATER_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform sampler2D uRefl;
uniform float uHz, uEye, uWy, uZ, uCx, uLens;
uniform vec2 uFocus;
uniform vec4 uExt;        // near x0, x1, far x0, x1 (3D world px)
uniform vec2 uDepth;      // near rate, far rate
uniform vec2 uRows;       // draw rows [a, b)
uniform float uTime;
uniform vec3 uDeep, uBody, uShallow, uHaze, uGlint;
uniform vec3 uMirrorTint;             // what it mirrors, multiplied (1: as bright as the sky above)
uniform float uStill;     // 1 = mirror-still (Kagami), less for a harbour
uniform float uCell;      // (round 6) the art's cell, frame px (2 at the catch's 2x)
// (round 6) the near water's look, each 0..1 (0: as before): darker and cooler toward the camera,
// the mirror drawn down in soft streaks under what it mirrors, a few long slow ripple bands (the
// ripples' gaps and glints only in them), the far edge melting into the haze
uniform vec4 uNear;
// (round 7, the water lane) land in front of the play plane holding the lake's east end (up to
// three, nearest last): per hold its frame column (where the water ends, behind the land), its
// frame rows [from, to), the shallow shelf's width before it (3D px at the water's own depth; 0:
// no hold); and the shore's look [shelf strength, lapping lines, the shelf's stone warmth, -]
uniform vec4 uHold[3];
uniform vec4 uShore;
// (round 7) the back and mid planes' waterline rows (0: none), for the contact under their land
uniform vec2 uFeet;
// (kagami9 round 1, worker 1) the lake's look, each 0 = as before:
// uLip   its near edge: [depth where it comes closest, where it reaches furthest, how far along the
//        shore one cove or point runs (3D px), the overhanging near foliage's broken reflections
//        (0..1)]: the water runs on toward the camera past the near plane to a shore that wanders
//        in depth (never a ruled row across the frame), from about 0.3x in
// uSunW  the one sun on the water: [its frame x, its frame y, glitter path strength, haze lift]
// uLook  [fine steps (1: the mirror, the haze and the near dark in fine flat steps with a seam of
//        dither, never a screen door), vertical waver of the mirror (cells), fill (1: the gaps a
//        land's painted underside leaves in its mirror image are filled from the land's own
//        reflection), sparse ripple dashes (1)]
uniform vec4 uLip;
uniform vec4 uSunW;
uniform vec4 uLook;
// uEdge  where the water meets land and haze, each 0 = as before: [how far (frame px at the play
//        plane's scale) the hand-over between two holds wanders up and down along the shore, with
//        the land's dark submerged foot under it; the rate of the plane whose waterline the far
//        haze melts down from (the far shore: the haze lies on the water and thins toward the
//        viewer over a reach that wanders, never a ruled horizon); the near water's extra darkening
//        toward the viewer (0..1); the shade at the feet of the land holding the water (0..1)]
uniform vec4 uEdge;
out vec4 o;
// v (0..1) in n flat steps; only the last stretch of each step dithers into the next (a seam, never
// a screen door across a flat area)
float seamq(float v, float n, vec2 c) {
  float x = clamp(v, 0.0, 1.0) * n;
  float fl = floor(x), fr = fract(x);
  return (fl + step(bayer4(c), (fr - 0.74) / 0.26)) / n;
}
float quant(float v, float n, vec2 c) {
  return uLook.x > 0.5 ? seamq(v, n * 3.0, c) : stepd(v, n, c);
}
// is a texel of the mirror land (or fog), not the sky? (the mirrored sky is drawn with alpha 0)
float landAt(vec2 rp) {
  return texelFetch(uRefl, ivec2(rp.x, uRes.y - 1.0 - clamp(rp.y, 0.0, uRes.y - 1.0)), 0).a;
}
void main() {
  vec2 f = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (f.y < uRows.x || f.y >= uRows.y) discard;
  // (the art's own cells: at the catch's 2x every step, ripple and dither sits on a 2 px cell)
  vec2 p = floor(f / uCell) * uCell;
  vec2 pc = floor(f / uCell);
  // undo the lens zoom, then this row is a depth on a flat lake
  vec2 q = uFocus + (p + 0.5 * uCell - uFocus) / uLens;
  float denom = uWy - uEye;
  if (denom <= 0.0) discard;
  float s = (q.y - uHz) / denom;
  if (s <= 0.0) discard;
  float r = 1.0 / (1.0 / s - 1.0 / uZ + 1.0);
  if (r <= 0.0 || r < uDepth.y) discard;
  float u = clamp((1.0 / r - 1.0 / uDepth.x) / (1.0 / uDepth.y - 1.0 / uDepth.x), 0.0, 1.0);
  // (engine 10-18) each row is a depth with its own scale s: its offset is whole px, as a plane's, so a pan moves
  // it by whole px instead of re-sampling its ripples at a new sub-px phase
  float x3 = (q.x - floor(uRes.x * 0.5 - uCx * s + 0.5)) / s;
  // (kagami9 r1) the near shore wanders in depth along the lake: coves running in toward the camera,
  // points reaching out (in 1/depth, so it bends as a shore seen in perspective does)
  float nearR = uDepth.x;
  if (uLip.y > 0.0) {
    float wv = vnoise(vec2(x3 / max(1.0, uLip.z), 2.9)) * 0.7 + vnoise(vec2(x3 / max(1.0, uLip.z * 0.31), 5.3)) * 0.3;
    // (only from about 0.3x in: further out the plateau's own lip, drawn in front of the water,
    // ends the lake, and the water must not run on over the cliff below it)
    nearR = 1.0 / mix(1.0 / uDepth.x, mix(1.0 / uLip.x, 1.0 / uLip.y, smoothstep(0.2, 0.8, wv)), smoothstep(0.26, 0.38, uZ));
  }
  if (r > nearR) discard;
  float x0 = mix(uExt.x, uExt.z, u), x1 = mix(uExt.y, uExt.w, u);
  // an irregular shore: coves and points, more of them the further away
  float span = x1 - x0;
  x0 += ((vnoise(vec2(u * 24.0, 3.1)) - 0.5) * 0.3 + (vnoise(vec2(u * 85.0, 7.7)) - 0.5) * 0.1) * span * u;
  x1 += ((vnoise(vec2(u * 21.0, 9.4)) - 0.5) * 0.3 + (vnoise(vec2(u * 77.0, 1.3)) - 0.5) * 0.1) * span * u;
  // (round 7) in the rows a land in front holds, the water runs on under that land and ends at the
  // land's own column, behind it: its end never shows as a line of water against the cliff face
  // behind (the near water's depths slide past each other, so a 3D end there drew a ruled diagonal)
  float shelfW = 0.0, dEnd = 1e6;
  bool held = false;
  // (kagami9 r1, the critic's W1-2) where one hold hands over to the next (the scree's foot to the
  // near limestone's top) the row wanders along the shore, so the water past the nearer land's
  // column never starts on a ruled row: some way up under the rock here, lower there
  float wob = 0.0, hand = -1.0;
  if (uEdge.x > 0.0) {
    // (only where the next hold's own column lies past the frame's right edge: where it stands in
    // the frame, the water raised past the hand-over ran up between the two lands as a column with
    // a vertical side (the pull-back); there the hand-over stays put and only its dark foot shows)
    if (uHold[1].x > uRes.x) wob = uCell * floor(uEdge.x * s * (0.15 + 0.85 * vnoise(vec2(x3 / 31.0, 6.2)) * (0.55 + 0.45 * vnoise(vec2(x3 / 7.0, 2.4)))) / uCell + 0.5);
    if (uHold[0].y < uHold[0].z && uHold[0].z < uRes.y) hand = uHold[0].z - wob;
  }
  for (int i = 0; i < 3; i++) {
    vec4 hd = uHold[i];
    // (a hold that hands over to the next ends higher by the wander, the next starts there)
    if (hd.y < hd.z) {
      if (i > 0) hd.y -= wob;
      if (hd.z < uRes.y) hd.z -= wob;
    }
    if (hd.y < hd.z && p.y >= hd.y && p.y < hd.z) {
      held = true;
      // (how far short of the end, 3D px at this row's own depth)
      dEnd = (hd.x - q.x) / s;
      shelfW = hd.w;
      break;
    }
  }
  if (held ? (dEnd < 0.0 || x3 < x0) : (x3 < x0 || x3 > x1)) discard;
  // closeness 0 (horizon) .. 1 (at the play plane and nearer)
  float k = clamp(r, 0.0, 1.0);
  // world-anchored wave coordinates (px on the water's own surface)
  float wx = x3 / 9.0;
  float t = uTime;
  float zz = 600.0 / r;
  // (round 6) a few long slow ripple bands on the near water, wind lines fixed on the water: thin
  // and long, thicker nearer, broken along their length, only some of the rows where they could lie
  float band = 0.0;
  if (uNear.z > 0.0 && r > 0.45) {
    float phase = s * 4.6 + 0.6 * vnoise(vec2(x3 / 1100.0 + t * 0.005, 2.3)) + 0.3 * vnoise(vec2(x3 / 260.0 - t * 0.008, 7.1)) + 0.08 * vnoise(vec2(x3 / 70.0, 3.3));
    float row = floor(phase);
    float along = vnoise(vec2(x3 / 520.0 + row * 3.7 - t * 0.006, row));
    // (each band swells in its middle and tapers to nothing at its ends)
    float w = (0.04 + 0.05 * hash2(vec2(row, 4.4))) * smoothstep(0.5, 0.75, along);
    band = step(fract(phase), w) * step(0.4, hash2(vec2(row, 9.1))) * smoothstep(0.45, 0.9, r) * uNear.z;
  }
  float ruff = vnoise(vec2(wx / 60.0 + t * 0.03, r * 9.0));
  ruff = stepd(ruff, 3.0, pc) * (1.0 - uStill * 0.6);
  // ripple shear: whole cells, bigger toward the viewer (in the bands, more)
  float amp = mix(0.4, 3.2, pow(k, 1.3)) * (0.35 + ruff) * (1.2 - uStill * 0.5) * (1.0 + 0.8 * band);
  float ph = wx * 0.9 + pc.y * uCell * 0.55 + t * 1.6;
  float dx = floor(sin(ph) * amp * (0.6 + 0.4 * vnoise(vec2(wx * 0.2, pc.y * uCell * 0.3))) / uCell + 0.5) * uCell;
  float dy = floor(sin(ph * 0.5 + 1.7) * amp * 0.25 / uCell + 0.5) * uCell;
  // (kagami9 r1) the mirror wavers up and down too, in long soft swells fixed on the water, so a
  // level edge in the mirror (a deck, a ledge) bends and breaks into the ripples instead of ruling a
  // line across the lake; none in the far mirror zone, more toward the viewer
  if (uLook.y > 0.0) {
    float sw = vnoise(vec2(x3 / 46.0 + t * 0.02, zz / 9.0)) * 0.65 + vnoise(vec2(x3 / 13.0 - t * 0.03, zz / 4.0)) * 0.35;
    dy += floor((sw - 0.5) * 2.0 * uLook.y * smoothstep(0.35, 1.2, r) * (1.0 + band) + 0.5) * uCell;
  }
  // (round 7) the contact: just under a background plane's waterline what stands on it holds its
  // reflection crisp (the ripples are smallest at the shore), to its own depth along the shore, so
  // where rock meets the water no ruled line of pale water runs under every block
  // (only under land: where the mirror there shows the sky or the fog, nothing changes)
  float foot = 0.0;
  for (int i = 0; i < 2; i++) {
    float wlr = i == 0 ? uFeet.x : uFeet.y;
    float dd = q.y - wlr;
    float kk = uCell * floor(1.0 + 3.4 * vnoise(vec2(x3 / 7.0, 1.9 + float(i) * 4.0)) + 1.2 * hash2(vec2(floor(x3 / 3.0), 2.7 + float(i))));
    if (wlr > 0.0 && dd >= 0.0 && dd < kk) foot = 1.0;
  }
  if (foot > 0.0) {
    vec3 m0 = texelFetch(uRefl, ivec2(p.x, uRes.y - 1.0 - p.y), 0).rgb;
    if (dot(m0, vec3(0.3, 0.55, 0.15)) > 0.42) foot = 0.0;
  }
  if (foot > 0.0) { dx = 0.0; dy = 0.0; }
  vec2 rp = vec2(p.x + dx, p.y + dy);
  rp = clamp(rp, vec2(0.0), uRes - 1.0);
  vec3 refl = texelFetch(uRefl, ivec2(rp.x, uRes.y - 1.0 - rp.y), 0).rgb;
  // (kagami9 r1) a land's mirror image is one continuous thing: where a painted land stops short of
  // the water behind something nearer (a rock's foot hidden behind the deck), its mirror image
  // showed a band of sky between the two, a seam across the reflection. Sky with land mirrored both
  // nearer the waterline (above) and further (below) within a short reach takes the land's own
  // mirror from below (its foot carried on up under the nearer thing).
  if (uLook.z > 0.0 && r > 0.4 && landAt(rp) < 0.5) {
    float G = uCell * floor(26.0 * clamp(s / max(0.2, uZ), 0.5, 2.5) / uCell + 0.5);
    float upL = 0.0;
    for (int j = 1; j <= 6; j++) upL = max(upL, landAt(rp - vec2(0.0, G * float(j) / 6.0)));
    if (upL > 0.5) {
      for (int j = 1; j <= 8; j++) {
        vec2 bp = rp + vec2(0.0, G * float(j) / 8.0);
        if (landAt(bp) > 0.5) { refl = texelFetch(uRefl, ivec2(bp.x, uRes.y - 1.0 - clamp(bp.y, 0.0, uRes.y - 1.0)), 0).rgb; break; }
      }
    }
  }
  // (round 6) the mirror drawn down in soft streaks: what stands over the water stretches its
  // reflection toward the viewer, darker under the masses, as on the lake in reference 4
  if (uNear.y > 0.0) {
    float L = uNear.y * mix(3.0, 30.0, smoothstep(0.35, 1.6, r));
    vec3 acc = refl;
    for (int j = 1; j <= 4; j++) {
      float yy = clamp(rp.y - L * float(j) / 4.0, 0.0, uRes.y - 1.0);
      acc += texelFetch(uRefl, ivec2(rp.x, uRes.y - 1.0 - yy), 0).rgb;
    }
    acc *= 0.2;
    // (darker wins: the masses' reflections reach down, the sky between does not wash them out)
    vec3 lo = min(refl, acc);
    refl = mix(refl, mix(acc, lo, 0.5), 0.75 * uNear.y);
  }
  refl *= uMirrorTint;
  // the water's own colour: pale at the horizon, deep jade near
  vec3 body = mix(uShallow, uBody, smoothstep(0.0, 0.5, k));
  body = mix(body, uDeep, smoothstep(0.45, 1.1, k));
  // how much it mirrors: nearly all far away, still most of it near (a still lake)
  float rs = mix(0.96, mix(0.55, 0.82, uStill), pow(k, 0.8)) * (1.0 - 0.25 * ruff);
  float gap;
  if (uLook.w > 0.0) {
    // (kagami9 r1) ripple marks: sparse broken dashes of varied length lying along the water, none
    // in the far mirror, a few more toward the viewer (in the bands, most)
    float lane = floor(zz / max(0.6, 1.2 * r));
    float len = 10.0 + 34.0 * hash2(vec2(lane, 3.3));
    float seg = floor((x3 + 97.0 * hash2(vec2(lane, 7.9)) + t * (1.0 + 2.0 * hash2(vec2(lane, 1.1)))) / len);
    float dens = mix(0.0, 0.06, smoothstep(0.5, 1.5, r)) * (1.0 + 4.0 * band);
    gap = step(1.0 - dens, hash2(vec2(seg, lane))) * smoothstep(0.42, 0.7, r);
  } else {
    // short gaps where a ripple faces the sky (round 6: on the near water only in the ripple bands,
    // never a sprinkle of dashes over the whole lake)
    gap = step(0.86 - 0.08 * k, vnoise(vec2(wx * 1.3 + t * 0.4, pc.y * uCell * 0.9)));
    if (uNear.z > 0.0) gap *= mix(1.0, band, smoothstep(0.4, 0.8, k));
  }
  rs *= 1.0 - gap * 0.35;
  // (round 7) the shallows before the land holding the water: the lake bed rising to it, stone seen
  // through the water, in two steps whose edges wander along the shore (world-anchored: a stretch of
  // depth, so they hold still on the water while the camera moves), the mirror weaker over them
  float ledge = 0.0, w2 = 0.0;
  if (shelfW > 0.0) {
    float w1 = shelfW * (0.22 + 0.3 * vnoise(vec2(zz / 9.0, 3.3)) + 0.08 * vnoise(vec2(zz / 2.5, 5.7)));
    w2 = shelfW * (0.6 + 0.45 * vnoise(vec2(zz / 14.0, 4.4)) + 0.1 * vnoise(vec2(zz / 3.0, 6.1)));
    ledge = dEnd < w1 ? 2.0 : dEnd < w2 ? 1.0 : 0.0;
    rs *= 1.0 - 0.12 * ledge * uShore.x;
  }
  float rl = foot > 0.0 ? 1.0 : quant(rs, 5.0, pc);
  vec3 c = mix(body, refl, rl);
  // (kagami9 r1, the critic's W1-8; reference 4's foreground water) the broken reflections of the
  // near foliage overhanging the water beyond the frame's top: dark jade masses rising from the
  // frame's bottom edge in the nearest water, their tops the canopies' undersides upside down
  // (crowns of their own widths and reach, open water between the trees), lighter specks where the
  // sky shows through the leaves, each ripple lane shearing it a little and the ripple marks
  // cutting it into broken rows. Fixed on the water along the shore; its reach is a share of the
  // water between the play plane's line and the frame's bottom (in depth), so it reads at every zoom
  if (uLip.w > 0.0 && r > 1.0) {
    float qBy = uFocus.y + (uRes.y - uFocus.y) / uLens;
    float irB = max(0.0, denom / max(1.0, qBy - uHz) - 1.0 / uZ + 1.0);
    float fR = (1.0 / r - irB) / max(0.05, 1.0 - irB);
    if (fR < 0.5) {
      float laneC = floor(zz / max(0.6, 1.4 * r));
      float X = x3 + (hash2(vec2(laneC, 4.2)) - 0.5) * 10.0 * smoothstep(1.05, 1.8, r);
      // (director, round 1: the stand of trees was a smooth envelope multiplying every crown's reach,
      // so at the catch's 2x the edge of a stand drew one smooth stepped dome; now the stand only
      // decides which crowns are there and how tall, each crown keeping its own lobed edge)
      float cw = 72.0, j0 = floor(X / cw), top = 0.0;
      for (int kk = -2; kk <= 2; kk++) {
        float j = j0 + float(kk);
        if (hash2(vec2(j, 0.7)) < 0.18) continue;
        float cx = (j + hash2(vec2(j, 1.7))) * cw;
        float tj = smoothstep(0.3, 0.62, vnoise(vec2(cx / 520.0, 3.9)) * 0.7 + vnoise(vec2(cx / 170.0, 6.1)) * 0.3);
        if (tj < 0.05 + 0.5 * hash2(vec2(j, 8.1))) continue;
        float hw = cw * (0.45 + 0.9 * hash2(vec2(j, 2.9)));
        float hh = (0.25 + 0.75 * hash2(vec2(j, 5.3)) * hash2(vec2(j, 6.6))) * mix(0.55, 1.0, tj);
        float uu = (X - cx) / hw;
        if (abs(uu) < 1.0) top = max(top, hh * pow(1.0 - uu * uu, 0.8));
      }
      // (the leaf clusters along a crown's edge: smaller crowns of their own on it, scalloped, never
      // a smooth arc; a few sprigs hanging further)
      float cw2 = 17.0, i0 = floor(X / cw2), bump = 0.0;
      for (int kk = -1; kk <= 1; kk++) {
        float j = i0 + float(kk);
        float cx = (j + hash2(vec2(j, 11.7))) * cw2;
        float hw = cw2 * (0.5 + 0.7 * hash2(vec2(j, 12.9)));
        float uu = (X - cx) / hw;
        if (abs(uu) < 1.0) bump = max(bump, (0.3 + 0.7 * hash2(vec2(j, 13.3))) * sqrt(1.0 - uu * uu));
      }
      // (director, round 1: at the catch's 2x one crown filled the bottom centre as a smooth stepped
      // dome; deeper clusters plus a finer scale of leaf tufts break every crown's edge into lobes)
      float cw3 = 6.0, i3 = floor(X / cw3), tuft = 0.0;
      for (int kk = -1; kk <= 1; kk++) {
        float j = i3 + float(kk);
        float cx = (j + hash2(vec2(j, 21.7))) * cw3;
        float hw = cw3 * (0.5 + 0.8 * hash2(vec2(j, 22.9)));
        float uu = (X - cx) / hw;
        if (abs(uu) < 1.0) tuft = max(tuft, hash2(vec2(j, 23.3)) * sqrt(1.0 - uu * uu));
      }
      top = top > 0.02 ? top + 0.3 * bump + 0.1 * tuft - 0.2 + 0.04 * (hash2(vec2(floor(X / 3.0), 9.9)) - 0.5) : top;
      float sprig = step(0.93, hash2(vec2(floor(X / 4.0), 14.1))) * 0.12 * step(0.1, top);
      float reachC = max(top, top + sprig) * 0.36;
      if (fR < reachC) {
        float into = 1.0 - fR / max(0.01, reachC);
        // its body: darkest deep inside, the leaf clusters in two values drawn down in streaks
        vec3 leaf = mix(uDeep * vec3(0.42, 0.56, 0.5), vec3(0.13, 0.24, 0.21), 0.35);
        float cl = vnoise(vec2(X / 6.0, fR * 40.0)) * 0.6 + vnoise(vec2(X / 2.5, fR * 14.0)) * 0.4;
        leaf *= mix(1.12, 0.84, smoothstep(0.25, 0.75, into)) * (0.9 + 0.2 * step(0.55, cl));
        // sky through the leaves: a few specks, most near the canopy's edge
        float hole = step(mix(0.86, 0.975, smoothstep(0.0, 0.5, into)), hash2(vec2(floor(X / 3.0), floor(fR * 120.0))));
        float a = uLip.w * mix(0.5, 0.9, smoothstep(0.0, 0.3, into)) * (1.0 - 0.8 * hole);
        // the ripple marks and bands cut it into rows
        a *= 1.0 - 0.75 * max(gap, band);
        c = mix(c, leaf, quant(a, 4.0, pc));
      }
    }
  }
  // (kagami9 r1, W1-2) the land's foot under the water past the hand-over: the water runs in under
  // the rock and lies dark there (its submerged foot in its own shade, the mirror lost in it),
  // deepest right under the rock, thinning out over a reach that wanders along the shore
  if (hand > 0.0 && q.y >= hand) {
    float under = (q.x - uHold[0].x) / max(0.3, s);
    float reachF = 16.0 + 48.0 * vnoise(vec2(x3 / 19.0, 3.7)) + 8.0 * hash2(vec2(floor(x3 / 4.0), 5.5));
    float sub = (1.0 - smoothstep(0.0, reachF, (q.y - hand) / max(0.3, s))) * smoothstep(-36.0, 6.0, under);
    c = mix(c, uDeep * vec3(0.5, 0.58, 0.62), quant(sub * 0.85, 4.0, pc));
  }
  // (W1-3) under the back plane's waterline the land standing in the lake goes on down under the
  // surface: its foot seen through the water (its own colour just above the line, darker, cooler,
  // melting into the deep water), each block reaching its own depth (stepped, block by block, a
  // few hardly at all), so a heap of chunks never shares one waterline (not under mist or foam)
  if (uEdge.x > 0.0 && uFeet.x > 0.0) {
    float dd = q.y - uFeet.x;
    float bw = 7.0 + 9.0 * vnoise(vec2(x3 / 37.0, 2.2));
    float blk = floor(x3 / bw + 0.6 * vnoise(vec2(x3 / 11.0, 3.1)));
    float kS = uCell * floor((1.0 + 13.0 * hash2(vec2(blk, 4.9)) * hash2(vec2(blk, 5.7)) + 3.0 * vnoise(vec2(x3 / 3.0, 1.7))) * clamp(uZ, 0.5, 2.0) / uCell + 0.5);
    if (dd >= 0.0 && dd < kS) {
      vec4 mb = texelFetch(uRefl, ivec2(p.x, uRes.y - 1.0 - clamp(uFeet.x + 1.0, 0.0, uRes.y - 1.0)), 0);
      if (mb.a > 0.5 && dot(mb.rgb, vec3(0.3, 0.55, 0.15)) < 0.8) {
        float sub = 1.0 - dd / kS;
        vec3 under = mix(mb.rgb * vec3(0.5, 0.62, 0.68), uDeep * 0.7, 0.25 + 0.45 * (1.0 - sub));
        c = mix(c, under, quant(0.9 * pow(sub, 0.7), 3.0, pc));
      }
    }
  }
  // (W1-7) the land holding the water shades the water at its feet: a dark margin whose width
  // wanders from row to row (each block's own), so no block stands in a bright pool of its own
  if (uEdge.w > 0.0 && held && dEnd >= 0.0) {
    float wS = 6.0 + 46.0 * vnoise(vec2(zz / 3.0, 1.1)) * vnoise(vec2(zz / 11.0, 7.4));
    float sh = (1.0 - smoothstep(0.0, wS, dEnd)) * uEdge.w;
    c = mix(c, c * vec3(0.56, 0.64, 0.7), quant(sh, 3.0, pc));
  }
  if (ledge > 0.0) {
    // pale, warm stone seen through the shallows, the inner step paler
    vec3 stone = mix(uShallow, vec3(0.74, 0.71, 0.58), uShore.z);
    c = mix(c, stone, uShore.x * (ledge > 1.5 ? 0.3 : 0.14));
  }
  // lapping lines: short, thin, broken, drifting in toward the land, on the shelf and a little out
  if (shelfW > 0.0 && uShore.y > 0.0 && dEnd < w2 * 1.3) {
    float lr = floor(zz / 1.5);
    float on = step(0.72, hash2(vec2(lr, 6.7))) * step(fract(zz / 1.5), 0.45);
    // (kagami9 r1, W1-7: with the feet's shade on, only short glints, a few, never one line per block)
    float rare = uEdge.w > 0.0 ? 0.86 : 0.62, sl = uEdge.w > 0.0 ? 0.45 : 1.0;
    float seg = hash2(vec2(lr * 1.9, floor((dEnd + t * 2.5 + 40.0 * hash2(vec2(lr, 8.1))) / ((9.0 + 9.0 * hash2(vec2(lr, 3.9))) * sl))));
    float lap = on * step(rare, seg) * (1.0 - smoothstep(w2 * 0.5, w2 * 1.3, dEnd));
    c = mix(c, mix(uShallow, uGlint, 0.4), 0.5 * lap * uShore.y);
  }
  // sun glints on the ripples nearer the viewer
  float cell = floor(pc.x * uCell / max(2.0, floor(mix(2.0, 7.0, k))));
  float gl = hash2(vec2(cell, floor(pc.y * uCell / max(1.0, floor(k * 2.0 + 1.0))) + floor(t * 0.7 + hash2(vec2(cell, pc.y)) * 9.0)));
  float lum = dot(refl, vec3(0.3, 0.55, 0.15));
  // (kagami9 r1, W1-12) the one sun's path on the water: under the sun a soft, ragged column of
  // brighter water widening toward the viewer, and in it a little of the sun's glitter: ripple
  // crests one row thick lying in lanes of depth fixed on the water (each lane starts where the
  // depth crosses its line), broken into dashes of their own lengths along it, twinkling; sparse,
  // none in the far mirror, most down the middle of the path and in the ripple bands
  float sunPath = 0.0;
  if (uSunW.z > 0.0) {
    float hw = mix(40.0, 240.0, smoothstep(0.05, 1.6, r)) * (0.8 + 0.4 * vnoise(vec2(zz / 6.0, 8.8)));
    float dxs = (q.x - uSunW.x + 0.3 * hw * (vnoise(vec2(zz / 3.0, 4.1)) - 0.5)) / hw;
    sunPath = exp(-dxs * dxs * 2.0) * uSunW.z;
  }
  float glOn = 0.993 - 0.01 * k * lum;
  if (gl > glOn && k > 0.15 && (uNear.z <= 0.0 || band > 0.0 || k < 0.6)) c = mix(c, uGlint, 0.8);
  if (sunPath > 0.01) {
    c = mix(c, vec3(0.96, 0.95, 0.89), quant(0.13 * sunPath * (1.0 - 0.4 * k), 3.0, pc));
    float sA = (q.y - uCell / uLens - uHz) / denom;
    if (r > 0.42 && sA > 0.0) {
      float zA = 600.0 * (1.0 / sA - 1.0 / uZ + 1.0);
      // (a lane is never thinner than about three rows: far off they merge)
      float LW = max(7.0, (zA - zz) * 3.0);
      float lane = floor(zz / LW);
      if (floor(zA / LW) != lane) {
        float lenD = 3.0 + 13.0 * hash2(vec2(lane, 5.1)) * hash2(vec2(lane, 6.3)) + 6.0 * smoothstep(1.0, 2.0, r);
        float segD = floor((x3 + 53.0 * hash2(vec2(lane, 2.3)) + t * 2.0 * (hash2(vec2(lane, 7.7)) - 0.5)) / lenD);
        float tw = floor(t * (0.5 + 0.9 * hash2(vec2(segD, lane))) + 7.0 * hash2(vec2(lane, segD + 0.5)));
        float hG = hash2(vec2(segD * 1.31 + tw * 0.173, lane * 0.71 + tw * 3.1));
        // (in patches where the ripples happen to face the sun, drifting slowly)
        float patchG = smoothstep(0.38, 0.72, vnoise(vec2(x3 / 46.0 + t * 0.04, zz / 14.0)));
        float dens = 0.3 * sunPath * smoothstep(0.42, 0.8, r) * (1.0 - 0.45 * smoothstep(1.2, 2.2, r)) * (1.0 + 1.5 * band) * (0.15 + 1.25 * patchG) * step(0.38, hash2(vec2(lane, 9.9)));
        if (hG > 1.0 - dens) c = mix(c, vec3(1.0, 0.975, 0.9), mix(0.55, 0.85, hash2(vec2(segD, lane + 0.3))));
      }
    }
  }
  // (round 6) the ripple bands: a lighter, cooler line where the wind roughens the mirror
  c = mix(c, mix(uShallow, uHaze, 0.5), 0.13 * band * step(0.45, vnoise(vec2(x3 / 30.0 + t * 0.3, pc.y * 0.7))));
  // (round 6) the near water darker and cooler toward the camera, in a few flat steps
  if (uNear.x > 0.0) {
    float nk = (uLook.x > 0.5 ? smoothstep(0.85, 2.6, r) : smoothstep(1.0, 1.8, r)) * uNear.x;
    c = mix(c, c * vec3(0.66, 0.77, 0.87), quant(nk, 4.0, pc));
  }
  // (kagami9 r1, W1-8) the foreground water darkens further toward the viewer, as reference 4's
  // (and over the frame's bottom sixth at any zoom: at the catch's 2x the frame's bottom is hardly
  // nearer than the jetty, and its foreground water stayed as pale as the far lake)
  if (uEdge.z > 0.0) {
    float nk2 = smoothstep(1.02, 1.85, r);
    if (r > 1.0) {
      float qBy2 = uFocus.y + (uRes.y - uFocus.y) / uLens;
      float irB2 = max(0.0, denom / max(1.0, qBy2 - uHz) - 1.0 / uZ + 1.0);
      float fR2 = (1.0 / r - irB2) / max(0.05, 1.0 - irB2);
      nk2 = max(nk2, 0.8 * (1.0 - smoothstep(0.0, 0.55, fR2)));
    }
    c = mix(c, c * vec3(0.6, 0.7, 0.78), quant(nk2 * uEdge.z, 4.0, pc));
  }
  // haze with distance, stepped (round 6: the farthest rows melt into the haze, the edge wandering,
  // so the lake's far edge never rules a line across the frame)
  float fog = (1.0 - smoothstep(0.03, 0.9, r)) * 0.7;
  // (into the haze's own value, the sky's at the horizon, over a band of frame rows below the
  // lake's far edge whose depth wanders along it: never a ruled line or a paler strip)
  if (uNear.w > 0.0) {
    float rowFar = uHz + denom / (1.0 / uDepth.y + 1.0 / uZ - 1.0);
    float reach = 26.0 + 30.0 * vnoise(vec2(x3 / 2400.0, 1.7)) + 12.0 * vnoise(vec2(x3 / 600.0, 4.2));
    fog = max(fog, uNear.w * (1.0 - smoothstep(0.0, reach, q.y - rowFar)));
  }
  // (kagami9 r1, W1-9) the haze lying on the water at the far shore (the far plane's waterline)
  // and thinning toward the viewer over a reach that wanders along the shore, so the far karst's
  // feet and the water meet in mist, never on a ruled horizon line
  if (uEdge.y > 0.0) {
    float rowF = uHz + denom / (1.0 / uEdge.y + 1.0 / uZ - 1.0);
    float reachH = (16.0 + 64.0 * vnoise(vec2(x3 / 1500.0, 5.1)) + 18.0 * vnoise(vec2(x3 / 330.0, 8.3))) * clamp(uZ, 0.4, 2.0);
    fog = max(fog, 0.92 * (1.0 - smoothstep(-2.0, reachH, q.y - rowF)));
  }
  vec3 haze = uHaze;
  if (uSunW.w > 0.0) {
    // (kagami9 r1) the haze brightens and warms toward the light: under the sun the far water lifts
    float dsx = (q.x - uSunW.x) / (uRes.x * 0.2);
    float under = exp(-dsx * dsx) * uSunW.w;
    haze = mix(haze, vec3(1.0, 0.975, 0.92), under * 0.7);
    fog = min(1.0, fog + 0.22 * under * (1.0 - smoothstep(0.05, 0.6, r)));
  }
  c = mix(c, haze, quant(fog * (1.0 - 0.6 * foot), 6.0, pc));
  o = vec4(c, 1.0);
}`;

export interface MistBand {
  row: number;
  half: number;
  density: number;
  drift: number;
}

export interface WaterDraw {
  hz: number;
  eye: number;
  wy: number;
  z: number;
  cx: number;
  lens: number;
  focus: [number, number];
  ext: [number, number, number, number];
  depth: [number, number];
  rows: [number, number];
  time: number;
  deep: [number, number, number];
  body: [number, number, number];
  shallow: [number, number, number];
  haze: [number, number, number];
  glint: [number, number, number];
  /** Multiplies the mirrored colour (default [1, 1, 1]). */
  mirror?: [number, number, number];
  still: number;
  /** (round 6) The art's cell, frame px (2 at the catch's 2x; default 1). */
  cell?: number;
  /** (round 6) The near water's look [dark, streaks, bands, far edge melt], each 0..1 (default none). */
  near?: [number, number, number, number];
  /**
   * (round 7) Land holding the water's east end, from waterHolds(): per hold [frame column of the
   * end, first frame row, end row, shelf width (3D px)]; up to three.
   */
  hold?: [number, number, number, number][];
  /** (round 7) The shore's look [shelf strength, lapping lines, the shelf's stone warmth, -], each 0..1. */
  shore?: [number, number, number, number];
  /** (round 7) The back and mid planes' waterline rows, for the contact under their land (default none). */
  feet?: [number, number];
  /** (kagami9 r1) The near shore wandering in depth: [closest, furthest depth, cove length (3D px), near foliage reflections 0..1] (default none: `depth[0]`). */
  lip?: [number, number, number, number];
  /** (kagami9 r1) The one sun on the water: [frame x, frame y, glitter path, haze lift] (default none). */
  sun?: [number, number, number, number];
  /** (kagami9 r1) [fine steps, vertical waver (cells), fill the mirror's gaps, sparse ripple dashes] (default none). */
  look?: [number, number, number, number];
  /** (kagami9 r1) [hold hand-over wander (px), far shore's plane rate for the haze, near water's extra dark, the land's feet shade] (default none). */
  edge?: [number, number, number, number];
}

/**
 * (round 7, the water lane) Where land in front of the play plane holds a water's east end
 * (Water.hold) for this camera: each hold's frame column, and the frame rows it holds, from its
 * land's top row (never above the play waterline) down to the next hold's. A hold on a plane in
 * front of the play plane counts only while that plane is drawn (not in the close band, nor while
 * it dissolves in over zoom 1.6 to 1.45).
 */
export function waterHolds(cam: CamState, w: Water): [number, number, number, number][] | undefined {
  if (!w.hold?.length) return undefined;
  const wlPlay = rowOf(cam, 1, w.y);
  const out = w.hold
    .filter((d) => d.rate <= 1 || cam.zoom <= 1.45)
    .slice(0, 3)
    .map((d): [number, number, number, number] => {
      const t = planeXf(cam, d.rate);
      return [d.x * d.rate * t.g + t.offX, Math.max(Math.floor(wlPlay), Math.round(rowOf(cam, d.rate, w.y - d.top))), cam.H + 1, d.shelf];
    });
  for (let i = 0; i + 1 < out.length; i++) out[i]![2] = Math.max(out[i]![1], out[i + 1]![1]);
  return out.length ? out : undefined;
}

/** The sky's banded look and the sun's bloom (an atmos entry's `glow`, in frame px). */
export interface SkyGlow {
  radius: number;
  strength: number;
  colour: [number, number, number];
  /** Dither cell, frame px (2 at the catch's 2x). */
  cell: number;
  /** (round 5) The plain sky gradient, only the sun drawn over it (no flat bands). */
  plain?: boolean;
}

/** One fog bank to draw: its plane's waterline row and transform, and the layer's look (art px). */
export interface FogDraw {
  wl: number;
  g: number;
  offX: number;
  drift: number;
  density: number;
  height: number;
  apron: number;
  roll: number;
  size: number;
  cell: number;
  /** The share of its height lying solid on the water (0, the default: none). */
  foot?: number;
  /** Pools [plane art px x, half width, strength] and the open water's cover (round 5). */
  pools?: readonly (readonly [number, number, number])[];
  cover?: number;
  /** (round 6) Veils floating at a height: [x, half width, height, thickness, strength, tear, lit, slope] (art px). */
  veils?: readonly (readonly number[])[];
  colour: [number, number, number];
  mirrored: boolean;
}

export class Atmos {
  private sky: WebGLProgram;
  private skyU: Record<string, WebGLUniformLocation>;
  private mist: WebGLProgram;
  private mistU: Record<string, WebGLUniformLocation>;
  private water: WebGLProgram;
  private waterU: Record<string, WebGLUniformLocation>;
  private fog: WebGLProgram;
  private fogU: Record<string, WebGLUniformLocation>;

  constructor(private gl: WebGL2RenderingContext, private vao: WebGLVertexArrayObject) {
    this.sky = compile(gl, FULL_VS, SKY_FS, "tesu-sky");
    this.skyU = uniforms(gl, this.sky);
    this.mist = compile(gl, FULL_VS, MIST_FS, "tesu-mist");
    this.mistU = uniforms(gl, this.mist);
    this.water = compile(gl, FULL_VS, WATER_FS, "tesu-water");
    this.waterU = uniforms(gl, this.water);
    this.fog = compile(gl, FULL_VS, FOG_FS, "tesu-fog");
    this.fogU = uniforms(gl, this.fog);
  }

  drawSky(w: number, h: number, hz: number, top: number[], mid: number[], low: number[], sun: [number, number, number], mirrored: boolean, glow?: SkyGlow): void {
    const gl = this.gl, u = this.skyU;
    gl.useProgram(this.sky);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes!, w, h);
    gl.uniform1f(u.uHz!, hz);
    gl.uniform3fv(u.uTop!, top);
    gl.uniform3fv(u.uMid!, mid);
    gl.uniform3fv(u.uLow!, low);
    gl.uniform3fv(u.uSun!, sun);
    gl.uniform1f(u.uMirror!, mirrored ? 1 : 0);
    gl.uniform4f(u.uGlow!, glow ? glow.radius : 0, glow ? glow.strength : 0, glow ? (glow.plain ? 2 : 1) : 0, glow ? glow.cell : 1);
    gl.uniform3fv(u.uGlowCol!, glow ? glow.colour : [1, 1, 1]);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  }

  drawMist(w: number, h: number, bands: MistBand[], colour: number[], time: number, camX: number, span: [number, number] = [-1e6, 1e6]): void {
    if (!bands.length) return;
    const gl = this.gl, u = this.mistU;
    gl.useProgram(this.mist);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uRes!, w, h);
    const arr = new Float32Array(16);
    bands.slice(0, 4).forEach((b, i) => arr.set([b.row, Math.max(1, b.half), b.density, b.drift], i * 4));
    gl.uniform4fv(u.uBands!, arr);
    gl.uniform1i(u.uCount!, Math.min(4, bands.length));
    gl.uniform3fv(u.uColour!, colour);
    gl.uniform1f(u.uTime!, time % 4096);
    gl.uniform1f(u.uCamX!, camX % 100000);
    gl.uniform2fv(u.uSpan!, span);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** A bank of fog at a plane's waterline (premultiplied over what is drawn). */
  drawFog(w: number, h: number, d: FogDraw): void {
    if (d.density <= 0) return;
    const gl = this.gl, u = this.fogU;
    gl.useProgram(this.fog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uRes!, w, h);
    gl.uniform1f(u.uWl!, d.wl);
    // (engine 10-18) the drift in whole frame px of the plane, so the fog moves by whole px
    const drift = d.g > 0 ? Math.round((d.drift % 100000) * d.g) / d.g : d.drift % 100000;
    gl.uniform3f(u.uXf!, d.g, d.offX, drift);
    gl.uniform4f(u.uFog!, d.density, d.height, d.apron, d.roll);
    gl.uniform3f(u.uFog2!, d.size, d.cell, d.foot ?? 0);
    const pools = (d.pools ?? []).slice(0, 16);
    const arr = new Float32Array(64);
    pools.forEach((q, i) => arr.set([q[0], q[1], q[2], 0], i * 4));
    gl.uniform4fv(u.uPools!, arr);
    gl.uniform1i(u.uNPools!, pools.length);
    gl.uniform1f(u.uCover!, d.cover ?? 1);
    const veils = (d.veils ?? []).slice(0, 8);
    const va = new Float32Array(32), vb = new Float32Array(32);
    veils.forEach((v, i) => { va.set([v[0] ?? 0, v[1] ?? 1, v[2] ?? 0, v[3] ?? 1], i * 4); vb.set([v[4] ?? 0.5, v[5] ?? 0.5, v[6] ?? 0.3, v[7] ?? 0], i * 4); });
    if (u.uVeilA) gl.uniform4fv(u.uVeilA, va);
    if (u.uVeilB) gl.uniform4fv(u.uVeilB, vb);
    if (u.uNVeils) gl.uniform1i(u.uNVeils, veils.length);
    gl.uniform3fv(u.uColour!, d.colour);
    gl.uniform1f(u.uMirror!, d.mirrored ? 1 : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  drawWater(w: number, h: number, refl: WebGLTexture, d: WaterDraw): void {
    const gl = this.gl, u = this.waterU;
    gl.useProgram(this.water);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes!, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, refl);
    gl.uniform1i(u.uRefl!, 0);
    gl.uniform1f(u.uHz!, d.hz);
    gl.uniform1f(u.uEye!, d.eye);
    gl.uniform1f(u.uWy!, d.wy);
    gl.uniform1f(u.uZ!, d.z);
    gl.uniform1f(u.uCx!, d.cx);
    gl.uniform1f(u.uLens!, d.lens);
    gl.uniform2fv(u.uFocus!, d.focus);
    gl.uniform4fv(u.uExt!, d.ext);
    gl.uniform2fv(u.uDepth!, d.depth);
    gl.uniform2fv(u.uRows!, d.rows);
    gl.uniform1f(u.uTime!, d.time % 4096);
    gl.uniform3fv(u.uDeep!, d.deep);
    gl.uniform3fv(u.uBody!, d.body);
    gl.uniform3fv(u.uShallow!, d.shallow);
    gl.uniform3fv(u.uHaze!, d.haze);
    gl.uniform3fv(u.uGlint!, d.glint);
    gl.uniform3fv(u.uMirrorTint!, d.mirror ?? [1, 1, 1]);
    gl.uniform1f(u.uStill!, d.still);
    if (u.uCell) gl.uniform1f(u.uCell, d.cell ?? 1);
    if (u.uNear) gl.uniform4fv(u.uNear, d.near ?? [0, 0, 0, 0]);
    if (u.uHold) {
      const hold = new Float32Array(12);
      (d.hold ?? []).slice(0, 3).forEach((v, i) => hold.set(v, i * 4));
      gl.uniform4fv(u.uHold, hold);
    }
    if (u.uShore) gl.uniform4fv(u.uShore, d.shore ?? [0, 0, 0, 0]);
    if (u.uFeet) gl.uniform2fv(u.uFeet, d.feet ?? [0, 0]);
    if (u.uLip) gl.uniform4fv(u.uLip, d.lip ?? [0, 0, 0, 0]);
    if (u.uSunW) gl.uniform4fv(u.uSunW, d.sun ?? [0, 0, 0, 0]);
    if (u.uLook) gl.uniform4fv(u.uLook, d.look ?? [0, 0, 0, 0]);
    if (u.uEdge) gl.uniform4fv(u.uEdge, d.edge ?? [0, 0, 0, 0]);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  }
}

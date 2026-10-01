// chapel (lane R-E; WORLD-PLAN E3): the Chapel of Light's nave, the room's
// backdrop, built from the room's own layout (NAVE below) so every pier, niche
// and portal sits exactly where the world puts the frames, the doors and the
// rose window. Grand yet held in: piers and a pointed arcade taller than the
// frame, a side aisle beyond them whose stained-glass lancets glow with the
// last of the dusk and throw stepped shafts across its floor, the west portal
// around the doors and the rose, and at the east end the chancel wall with the
// four niches where the rose light comes to rest. Candle-dim: pools of warm
// light at the candles and lanterns, everything else in violet shadow.
//
// Authored in the room's coordinates: the depth-1 wall is drawn in room pixels
// (x from the room's west end, y down from its top), so the world's props line
// up with it; deeper layers are authored at the rail row's framing and slide
// behind with their own parallax. The default export is the /scenes/ preview
// of the same nave at that framing. Everything is generated here: no images.

import { f, sky, Motes, type BuildCtx, type LayerDef, type SceneDef } from "../engine/index.ts";

import { AISLE_DEPTH, LANCET, NAVE, P, RX, lancetXs } from "./chapel/nave-plan.ts";

export { NAVE };

/** Where the rail camera rests (room px of the view's top row). */
export const RAIL = Math.round((NAVE.top - NAVE.floor) * P - NAVE.anchor * 720);

const PALETTE: Record<string, string[]> = {
  // the nave's limestone in candle-dim dusk: violet shadows up to a warm grey
  stone: ["#120d14", "#1a141d", "#231b27", "#2e2431", "#3b2f3c", "#4d3e48", "#665352"],
  // the same stone where candle light reaches it: warmer, a little brighter
  stoneWarm: ["#1a1216", "#261a1e", "#332326", "#43302e", "#563f38", "#6e5242", "#8c6a4e"],
  // the aisle beyond the arcade: cooler and darker
  aisle: ["#0e0b13", "#151119", "#1c1722", "#251e2c", "#302738"],
  // stained glass in the aisle lancets: the last of the dusk behind it
  glassRose: ["#3a1628", "#65243c", "#9c3e52", "#d6786e"],
  glassViolet: ["#1f1638", "#35285e", "#56448e", "#8e78c4"],
  glassGold: ["#4a2e14", "#7c5222", "#b8843c", "#e6be7c"],
  glassBlue: ["#121a36", "#213062", "#36509a", "#6e94d4"],
  lead: ["#08070b", "#0e0c12"],
  shaft: ["#3a2a3c", "#6a4a5c", "#a4787c", "#d8b096"],
  warm: ["#4a2c1c", "#8a5a30", "#d09a58", "#f2cc8c"],
  mote: ["#6a5460", "#a08078", "#dcc0a0"],
  standin: ["#07060a", "#110e14", "#2a2230", "#c9a489"],
};

const FOG: SceneDef["fog"] = {
  stops: [
    [0.0, "#0d0a10"],
    [0.35, "#171219"],
    [0.7, "#1f1820"],
    [1.0, "#120e14"],
  ],
  bands: 10,
  dither: 0.4,
  density: 0.22,
  max: 0.55,
};

interface Opts {
  /** Room-space offset of the view's top row: the rail row in /scenes/, 0 in the world (the camera supplies it). */
  yRoom: number;
}

/** Height (H above the floor) of the candle sconce built into each pier. */
const SCONCE = 3.05;

const FLOOR_Y = Math.round((NAVE.top - NAVE.floor) * P);

function glslArray(name: string, xs: number[]): string {
  return `const float ${name}[${xs.length}] = float[${xs.length}](${xs.map(f).join(", ")});`;
}

/** Warm light pools (room px) from the candles, the lanterns and the niches: [x, y, radius, strength]. */
function candlePools(): [number, number, number, number][] {
  const L: [number, number, number, number][] = [];
  const at = (wx: number, hy: number, r: number, k: number): void => void L.push([RX(wx), FLOOR_Y - hy * P, r * P, k]);
  at(NAVE.lectern + 1.5, 1.35, 1.7, 0.7); // the west candelabra
  at(457.0, 1.35, 1.6, 0.65); // the east candelabra
  for (const x of NAVE.racks) at(x, 0.75, 1.3, 0.6);
  for (const x of NAVE.niches) at(x, 0.5, 1.2, 0.6);
  for (const x of NAVE.lanterns) at(x, 5.1, 1.4, 0.5);
  // the candle sconces set in the piers, a rhythm of warm light down the nave
  for (const x of NAVE.piers) at(x, SCONCE + 0.2, 1.15, 0.5);
  return L;
}

function prelude(ctx: BuildCtx, o: Opts): string {
  const pools = candlePools();
  void ctx;
  return /* glsl */ `
const float P = ${f(P)};
const float FLOOR_Y = ${f(FLOOR_Y)};
const float YROOM = ${f(o.yRoom)};
const int NPOOL = ${pools.length};
const vec4 POOL[${pools.length}] = vec4[${pools.length}](${pools.map(([x, y, r, k]) => `vec4(${f(x)}, ${f(y)}, ${f(r)}, ${f(k)})`).join(", ")});
// warm candle light at a room point, stepped into thirds so it pools, never gradients
float candles(vec2 r) {
  float l = 0.0;
  for (int i = 0; i < NPOOL; i++) {
    vec4 q = POOL[i];
    float d = length((r - q.xy) * vec2(1.0, 1.35)) / q.z;
    l += q.w * max(0.0, 1.0 - d * d);
  }
  return l;
}
float sceneLight(vec2 s, float depth) { return 0.0; }
`;
}

/**
 * The side aisle beyond the arcade (AISLE_DEPTH): its outer wall in coursed stone, the floor, and in
 * each open bay one two-light lancet anchored to that bay (nave-plan.ts lancetXs): glass set in a
 * dark splayed reveal with a moulded surround, a mullion, an oculus in the head, a projecting sill
 * with its cast shadow, the dusk behind the glass, and a faint coloured pool of its light on the
 * aisle floor below. The sills sit above the easel crowns, so no work stands in front of the glass.
 */
function aisleBody(ctx: BuildCtx, o: Opts, d: number): string {
  // the aisle's own x: x at mid-pan + half its pan; y: room y at the rail row
  const hx = Math.round(ctx.span / 2 / d);
  const hy = o.yRoom > 0 ? o.yRoom : RAIL - Math.round(RAIL / d);
  const floorY = FLOOR_Y - LANCET.floorLift * P;
  const L = LANCET;
  const c0 = L.half * (L.k - 1), R0 = L.half * L.k;
  const outer = L.half + L.splay + L.hood;
  return /* glsl */ `
${glslArray("LAN", lancetXs())}
// a pointed head as concentric arcs: centres c either side of the axis, radius R, springing sp (H)
float ring(float u, float c, float R, float sp) {
  float x = abs(u) + c;
  return sp + sqrt(max(0.0, R * R - x * x));
}
float arch(float u, float a, float sp, float k) { return ring(u, a * k - a, a * k, sp); }
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + ${f(hy)});
  float hy = (${f(floorY)} - r.y) / P;
  if (hy < -0.6) return vec4(0.0);
  // the nearest lancet
  float lx = LAN[0];
  for (int i = 1; i < ${lancetXs().length}; i++) if (abs(r.x - LAN[i]) < abs(r.x - lx)) lx = LAN[i];
  float u = (r.x - lx) / P;
  float au = abs(u);
  float shade = 0.34;
  // coursed wall
  float course = floor(hy / 0.42);
  float jx = mod(r.x + mod(course, 2.0) * 30.0, 62.0);
  float jy = mod(hy * P, 0.42 * P);
  shade += (hash2(vec2(floor((r.x + mod(course, 2.0) * 30.0) / 62.0), course)) - 0.5) * 0.12;
  if (jy < 1.0 || jx < 1.0) shade -= 0.14;
  else if (jy > 0.42 * P - 2.0) shade += 0.05;
  // the floor of the aisle: dark flags with a lit edge
  bool floorRow = hy < 0.0;
  if (floorRow) {
    shade = 0.22 + (mod(floor(r.x / 46.0), 2.0) * 0.04);
    if (hy > -0.05) shade = 0.36;
  }
  // vault shadow above the lancets
  shade -= smoothstep(5.6, 7.5, hy) * 0.18;
  // --- the lancet ---
  float SILL = ${f(L.sill)};
  float head = ring(u, ${f(c0)}, ${f(R0)}, ${f(L.spring)});
  float splayT = ring(u, ${f(c0)}, ${f(R0 + L.splay)}, ${f(L.spring)});
  float hoodT = ring(u, ${f(c0)}, ${f(R0 + L.splay + L.hood)}, ${f(L.spring)});
  if (!floorRow && au < ${f(L.half)} && hy > SILL && hy < head) {
    // tracery: two lights with pointed heads, a mullion between, an oculus over them; the rest is stone
    float side = u < 0.0 ? -1.0 : 1.0;
    float lu = u - side * 0.25;
    float lightTop = arch(lu, 0.19, 4.5, 1.3);
    vec2 oc = vec2(u, hy - 4.93);
    float od = length(oc);
    bool inLight = abs(lu) < 0.19 && hy < lightTop;
    bool inOc = od < 0.12;
    if (inLight || inOc) {
      // leaded glass: a ruby border, two roundels (gold in a ruby ring), violet and blue quarries between
      vec2 g = vec2(u * P, hy * P);
      float row = 0.0;   // 0 rose, 1 violet, 2 gold, 3 blue
      float t = 0.5;
      bool lead = false;
      if (inOc) {
        row = 2.0; t = 0.75 - od * 2.0;
        lead = od > 0.105 || abs(oc.x) * P < 0.8 || abs(oc.y) * P < 0.8;
      } else {
        float rc = min(length(vec2(lu, hy - 3.38)), length(vec2(lu, hy - 4.02)));
        if (rc < 0.105) { row = 2.0; t = 0.78 - rc * 2.2 + (hash2(floor(g / 3.0)) - 0.5) * 0.1; lead = abs(rc - 0.06) * P < 0.6; }
        else if (rc < 0.145) { row = 0.0; t = 0.62; lead = rc < 0.115 || rc > 0.137; }
        else if (abs(lu) > 0.155 || hy - SILL < 0.07 || lightTop - hy < 0.06) { row = 0.0; t = 0.48 + (hash2(vec2(floor(hy * 5.0), side)) - 0.5) * 0.12; lead = abs(abs(lu) - 0.155) * P < 0.7; }
        else {
          vec2 q = floor(vec2((g.x + g.y) / 8.0, (g.x - g.y) / 8.0));
          float k = hash2(q + lx * 0.013);
          row = k < 0.6 ? 1.0 : 3.0;
          t = 0.42 + (k - 0.5) * 0.24;
          lead = fract((g.x + g.y) / 8.0) < 0.14 || fract((g.x - g.y) / 8.0) < 0.14;
        }
        // brighter toward the head (the open dusk sky behind it)
        t += smoothstep(SILL, 4.6, hy) * 0.16;
      }
      if (lead) return vec4(applyFog(pal(R_LEAD, 0.0), uFog, 0.0, p, s), 1.0);
      vec3 gl = row < 0.5 ? ramp(R_GLASSROSE, t, p, 0.0) : row < 1.5 ? ramp(R_GLASSVIOLET, t, p, 0.0) : row < 2.5 ? ramp(R_GLASSGOLD, t, p, 0.0) : ramp(R_GLASSBLUE, t, p, 0.0);
      return vec4(applyFog(gl, uFog, 0.0, p, s), 1.0);
    }
    // the stone of the tracery: lit where it faces the glass's light, a dark arris on its shadow side
    shade = 0.44;
    float e = min(min(abs(abs(lu) - 0.19) * P, abs(hy - lightTop) * P), abs(od - 0.12) * P);
    if (e < 1.2) shade = 0.56;
    else if (e < 2.4) shade = 0.3;
  } else if (!floorRow && au < ${f(L.half + L.splay)} && hy > SILL && hy < splayT) {
    // the splay: the wall's thickness cut back to the glass, in shadow, its outer arris lit
    float e = min(${f(L.half + L.splay)} - au, splayT - hy) * P;
    shade = e < 1.2 ? 0.52 : 0.14 + (u > 0.0 ? 0.04 : 0.0);
  } else if (!floorRow && au < ${f(outer)} && hy > SILL && hy < hoodT) {
    // the moulded surround (a roll with a hollow), the hood over the head
    float e = min(${f(outer)} - au, hoodT - hy) * P;
    shade = e < 1.2 ? 0.2 : e < 3.0 ? 0.52 : 0.4;
  }
  // the sill: a projecting slab, its lit top, a dark front edge, and the shadow it casts below
  if (!floorRow && au < ${f(outer + 0.08)} && hy <= SILL && hy > SILL - 0.1) {
    float e = (SILL - hy) * P;
    shade = e < 2.0 ? 0.6 : e > 6.5 ? 0.16 : 0.42;
  } else if (!floorRow && au < ${f(outer + 0.04)} && hy <= SILL - 0.1 && hy > SILL - 0.24) {
    shade -= 0.12 * step(bayer4(p), 1.0 - (SILL - 0.1 - hy) / 0.14 * 0.6);
  }
  vec3 base = ramp(R_AISLE, shade, p, 0.35);
  vec3 c = base;
  // the window's coloured light: a faint halo on the wall round it, a pool on the aisle floor below
  float halo = 0.0;
  if (!floorRow && hy > SILL - 0.6 && hy < 5.6 && au > ${f(outer)}) halo = max(0.0, 1.0 - (au - ${f(outer)}) / 0.4) * (hy > SILL ? 0.5 : 0.35 * (1.0 - (SILL - hy) / 0.6));
  if (floorRow) {
    float pu = (u - 0.35) / 0.9;
    halo = max(0.0, 1.0 - pu * pu) * 0.85;
  }
  if (halo > 0.0 && halo > bayer4(p + vec2(2.0, 1.0)) * 0.9 + 0.15) {
    float band = floor(mod((u - 0.35) * 3.2 + 9.0, 3.0));
    float lv = floor(halo * 2.0 + 0.5) / 2.0;
    vec3 tint = band < 1.0 ? ramp(R_GLASSROSE, 0.08 + lv * 0.2, p, 0.0) : band < 2.0 ? ramp(R_GLASSVIOLET, 0.1 + lv * 0.22, p, 0.0) : ramp(R_GLASSGOLD, 0.06 + lv * 0.18, p, 0.0);
    c = mix(base, tint, 0.55);
  }
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`;
}

/** Stepped shafts from the aisle lancets, slanting east and down onto the aisle floor (additive). */
function aisleShaftBody(ctx: BuildCtx, o: Opts, d: number): string {
  const hx = Math.round(ctx.span / 2 / d);
  const hy = o.yRoom > 0 ? o.yRoom : RAIL - Math.round(RAIL / d);
  const floorY = FLOOR_Y - LANCET.floorLift * P;
  return /* glsl */ `
${glslArray("LAN", lancetXs())}
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + ${f(hy)});
  float hy = (${f(floorY)} - r.y) / P;
  if (hy < -0.4 || hy > 4.9) return vec4(0.0);
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float a = 0.0;
  for (int i = 0; i < ${lancetXs().length}; i++) {
    // the beam's axis leaves the glass's middle and lands about 2 H east on the floor
    float fall = 3.9 - hy;
    float bx = r.x - LAN[i] - fall * P * 0.56;
    float w = 0.42 * P + max(fall, 0.0) * 5.0;
    float k = (1.0 - smoothstep(0.0, w, abs(bx))) * smoothstep(-0.4, 0.3, hy) * (1.0 - smoothstep(3.6, 4.9, hy));
    k *= 0.55 + 0.45 * vnoise(vec2(bx / 13.0 + tm * 0.05, hy * 0.6 + float(i) * 3.0));
    a = max(a, k);
  }
  float lv = stepd(a, 3.0, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  return vec4(ramp(R_SHAFT, lv, p, 0.0), lv * 0.2);
}`;
}

/** The nave wall at the player plane (depth 1), in room pixels. */
function naveBody(ctx: BuildCtx): string {
  const hx = Math.round(ctx.span / 2);
  const piers = NAVE.piers.map(RX);
  const open = NAVE.piers.slice(0, -1).map((_, i) => (NAVE.closed.includes(i) ? 0 : 1));
  const niches = NAVE.niches.map(RX);
  const portal = RX(NAVE.door);
  const chancel = RX(NAVE.piers[NAVE.piers.length - 1]!);
  const exitX = RX(457.2);
  return /* glsl */ `
${glslArray("PIER", piers)}
${glslArray("OPEN", open)}
${glslArray("NICHE", niches)}
// a two-centred pointed arch: the top of the opening at offset u (H) from its axis,
// half-width a, springing sp (H above the floor), radius factor k (1 = equilateral)
float arch(float u, float a, float sp, float k) {
  float R = a * k;
  float c = R - a;
  float x = abs(u) + c;
  return sp + sqrt(max(0.0, R * R - x * x));
}
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + YROOM);
  float hy = (FLOOR_Y - r.y) / P;
  float xH = r.x / P;
  if (hy < 0.0) {
    // --- the floor: polished flags seen at a grazing angle, holding the candle light; then its front ---
    float dn = -hy * P;
    float sh = 0.3;
    float warmth = 0.0;
    if (dn < 2.0) { sh = 0.62; warmth = 0.5; }                       // the floor's front arris, lit
    else if (dn < 30.0) {
      // four rows of flags, nearer rows taller; joints staggered per row
      float q = sqrt((dn - 2.0) / 28.0) * 4.0;
      float row = floor(q);
      float fq = fract(q);
      float jw = 44.0 + row * 16.0;
      float jx = mod(r.x + row * 23.0, jw);
      sh = 0.26 + (hash2(vec2(floor((r.x + row * 23.0) / jw), row)) - 0.5) * 0.06 + row * 0.015;
      if (fq < 0.12 || jx < 1.0) sh = 0.12;
      // the candles mirrored in the polish: their pools sampled above the floor, squashed, stepped
      float m = candles(vec2(r.x + floor(sin(dn * 0.9 + uTime * (1.0 - 0.8 * uReduced)) * 0.6), FLOOR_Y - (dn - 2.0) * 2.6));
      float lv = floor(clamp(m, 0.0, 1.0) * 3.0 + bayer4(p) * 0.8) / 3.0;
      sh += lv * 0.22;
      warmth = lv;
      if (hash1(floor(r.x / 3.0) + row * 9.0) > 0.985 && fq > 0.4) sh += 0.08;  // a glint on the polish
    } else if (dn < 34.0) {
      sh = dn < 32.0 ? 0.48 : 0.12;                                  // a moulded step down to the footing
    } else {
      // the footing: big coursed blocks, a blind arcade of small crypt vents with a faint glow in them
      float dd = dn - 34.0;
      float course = floor(dd / 30.0);
      float off = mod(course, 2.0) * 40.0;
      float fx = mod(r.x + off, 80.0), fy = mod(dd, 30.0);
      sh = 0.22 + (hash2(vec2(floor((r.x + off) / 80.0), course)) - 0.5) * 0.06 - dd / P * 0.05;
      if (fy < 1.0 || fx < 1.0) sh = 0.08;
      else if (fy < 2.5) sh += 0.06;
      float vx = mod(r.x - ${f(RX(NAVE.piers[0]!) + 2.7 * P)}, ${f(5.4 * P)}) - ${f(2.7 * P)};
      // a vent: a round-headed opening 32 px wide, iron bars, the crypt's candle glow behind
      float head = 16.0 - sqrt(max(0.0, 256.0 - min(vx * vx, 256.0)));
      if (abs(vx) < 19.0 && dd > 4.0 + head && dd < 44.0) {
        sh = 0.42;                                                   // the moulded surround
        if (abs(vx) < 16.0 && dd > 7.0 + head && dd < 41.0) {
          sh = 0.05;
          warmth = floor(max(0.0, 1.0 - (dd - 12.0) / 26.0) * 2.0 + bayer4(p) * 0.8) / 2.0 * 0.6;
          if (mod(vx + 16.0, 6.0) < 1.5) { sh = 0.18; warmth = 0.0; }   // bars
        }
      }
    }
    // the doorway's shadow on the flags in front of the west doors
    float ddu = abs(r.x - ${f(portal)}) / P;
    if (dn > 2.0 && dn < 12.0 && ddu < 1.55) sh -= (1.0 - (dn - 2.0) / 10.0) * (1.0 - smoothstep(1.1, 1.55, ddu)) * 0.12;
    vec3 fc = warmth > 0.2 ? ramp(R_STONEWARM, sh + warmth * 0.08, p, 0.35) : ramp(R_STONE, sh, p, 0.35);
    return vec4(fc, 1.0);
  }
  float shade = 0.42;
  bool hole = false;
  float lit = candles(r);
  // --- ashlar courses everywhere first ---
  float course = floor(hy / 0.4);
  float off = mod(course, 2.0) * 0.4;
  float blk = floor((xH + off) / 0.8);
  float fy = fract(hy / 0.4), fx = fract((xH + off) / 0.8);
  float bk = hash2(vec2(blk, course));
  shade += (bk - 0.5) * 0.15 + (bk > 0.92 ? -0.05 : 0.0) + (floor(vnoise(vec2(r.x / 15.0, r.y / 9.0)) * 4.0) / 4.0 - 0.5) * 0.06;
  if (fy * 0.4 * P < 1.0) shade -= 0.15;                            // bed joints
  else if (fx * 0.8 * P < 1.0) shade -= 0.13;                       // head joints
  else if (fy * 0.4 * P > 0.4 * P - 2.5) shade += 0.09;             // the block's lit top bed
  else if (fx * 0.8 * P < 2.5) shade += 0.04;                       // its lit west arris
  else if (fy * 0.4 * P < 3.0) shade -= 0.04;                       // its shaded underside
  if (hash2(floor(r.xy / 3.0) + 5.0) > 0.95 - step(0.7, bk) * 0.05) shade -= 0.07;   // chips, gathered on the older blocks
  // dado: a plinth band with a moulding along the foot of every wall
  if (hy < 0.75) { shade -= 0.05; if (hy > 0.68) shade += 0.1; if (hy > 0.62 && hy <= 0.68) shade -= 0.1; }
  // string course above the arcade
  if (abs(hy - 7.55) < 0.09) shade += hy > 7.55 ? 0.12 : -0.06;
  // --- the west portal: a deep recess in orders around the doors and the rose ---
  float pu = (r.x - ${f(portal)}) / P;
  if (abs(pu) < 2.2) {
    for (int k = 0; k < 3; k++) {
      float a = 2.2 - float(k) * 0.22;
      float top = arch(pu, a, 5.8 - float(k) * 0.1, 1.4);
      if (abs(pu) < a && hy < top) {
        shade = 0.36 - float(k) * 0.05 + (hash2(vec2(floor(hy / 0.4), float(k))) - 0.5) * 0.04;
        if (abs(abs(pu) - a) * P < 1.5 || abs(hy - top) * P < 1.5) shade += 0.14;
        if (fy * 0.4 * P < 1.0) shade -= 0.05;
      }
    }
  }
  // --- the west doors' own recess (the DOOR RULE): the doorway cut through the wall in the shape of
  // the leaves (2.5 x 4 H, the kit's pointed head: arcs of 1.55 H from centres 0.3 H either side),
  // a dark soffit the leaves sit back in, two moulded orders round it (lit inner arrises, voussoirs
  // over the head, coursed jambs below), capitals at the springing, bases, a hood with label stops,
  // and a stone threshold step; the floor in front takes the doorway's shadow ---
  float du = (r.x - ${f(portal)}) / P;
  float adu = abs(du);
  if (adu < 1.25 + 0.5 && hy < 4.5) {
    bool head = hy > 2.48;
    float dd = (head ? length(vec2(adu + 0.3, hy - 2.48)) - 1.55 : adu - 1.25) * P;   // px beyond the opening
    float th = atan(hy - 2.48, adu + 0.3);
    float wall0 = shade;
    if (dd < 0.0) {
      shade = 0.06 + (1.0 - smoothstep(0.0, 1.2, hy)) * 0.05;                        // the dark doorway (the leaves cover it)
    } else if (dd < 33.0) {
      float ord = dd < 15.0 ? 0.0 : 1.0;
      float od = dd - ord * 15.0;                                                     // px into this order
      if (dd < 4.0) shade = 0.07 + (du > 0.0 ? 0.03 : 0.0);                           // the soffit
      else if (dd >= 26.0) {
        // the hood: over the head and down to the label stops only
        shade = -9.0;
        if (hy > 2.3 && dd < 32.0) shade = dd > 30.5 ? 0.66 : dd > 28.0 ? 0.5 : 0.12;
      } else if (od < 1.5 || (ord < 0.5 && dd < 5.5)) shade = 0.68 - ord * 0.04;   // the lit inner arris
      else if (od > 13.5 || (ord > 0.5 && dd > 24.5)) shade = 0.1;                        // the step to the next order
      else {
        shade = 0.52 - ord * 0.07 + (hash2(vec2(floor(hy / 0.4 + ord * 0.5), ord)) - 0.5) * 0.05;
        if (head) {
          if (fract(th / 0.105 + ord * 0.5) < 0.1) shade -= 0.14;                          // voussoir joints
          if (ord < 0.5 && adu < 0.06) shade += 0.06;                                      // the keystone
        } else {
          if (fract(hy / 0.4 + ord * 0.5) * 0.4 * P < 1.0) shade -= 0.12;                // coursed jambs
          if (ord < 0.5) shade += cos(clamp((od - 7.0) / 7.0, -1.0, 1.0) * 1.4) * 0.08 - 0.03;   // a roll on the inner order
        }
      }
      if (shade > -1.0) {
        // capitals at the springing, bases at the foot
        if (dd >= 4.0 && dd < 27.0 && hy > 2.3 && hy < 2.5) shade = hy > 2.47 ? 0.68 : hy < 2.33 ? 0.1 : 0.54;
        if (dd >= 4.0 && dd < 27.0 && hy < 0.32) shade = hy > 0.29 ? 0.62 : hy < 0.03 ? 0.12 : 0.44;
      } else shade = wall0;                                                             // plain wall beside the head
      if (dd >= 26.0 && dd < 36.0 && hy > 2.12 && hy <= 2.3) shade = hy < 2.15 ? 0.14 : 0.48;
    }
    // the threshold: a worn step across the doorway and its jambs
    if (hy >= 0.0 && hy < 0.07 && dd < 30.0) shade = hy > 0.05 ? 0.62 : 0.4;
  }
  // --- the chancel wall and its niches ---
  if (r.x > ${f(chancel + 0.45 * P)}) {
    for (int i = 0; i < ${niches.length}; i++) {
      float u = (r.x - NICHE[i]) / P;
      if (abs(u) < 1.22) {
        float top = arch(u, 1.1, 3.35, 1.3);
        if (abs(u) < 1.1 && hy > 0.42 && hy < top) {
          // the recess: in shadow, warmer toward the candles at its foot
          shade = 0.2 + (1.0 - smoothstep(0.4, 2.2, hy)) * 0.1 + (abs(u) > 0.95 ? 0.06 : 0.0);
          if (hy < 0.5) shade = 0.44;
        } else if (abs(u) < 1.22 && hy > 0.3 && hy < top + 0.14) {
          // the moulded surround and the sill
          shade = 0.5 + (hy < 0.42 ? 0.06 : 0.0);
          if (abs(hy - top - 0.07) * P < 1.2) shade = 0.58;
        }
      }
    }
    // a blind arcade frieze above the niches
    if (hy > 4.95 && hy < 5.9) {
      float fu = mod(xH, 0.65) / 0.65;
      float t = 5.1 + sqrt(max(0.0, 0.09 - (fu - 0.5) * (fu - 0.5) * 0.36)) * 2.2;
      if (hy < t && abs(fu - 0.5) < 0.36) shade = 0.28;
    }
    if (abs(hy - 4.9) < 0.07 || abs(hy - 6.0) < 0.06) shade = 0.52;
    // the east arch to the bell stair
    if (r.x > ${f(exitX)}) {
      float top = arch(r.x / P - ${f(exitX / P + 1.2)}, 1.2, 3.6, 1.3);
      if (hy < top) { shade = 0.1 + (1.0 - smoothstep(0.0, 4.0, hy)) * 0.08; }
    }
  }
  // --- the arcade: open bays show the aisle; closed bays hold a tapestry on a blind arch ---
  for (int i = 0; i < ${piers.length - 1}; i++) {
    float a0 = PIER[i] + 0.45 * P, a1 = PIER[i + 1] - 0.45 * P;
    if (r.x > a0 - 0.2 * P && r.x < a1 + 0.2 * P) {
      float mid = (a0 + a1) * 0.5;
      float a = (a1 - a0) * 0.5 / P;
      float u = (r.x - mid) / P;
      float top = arch(u, a, 4.25, 1.32);
      float mould = arch(u, a + 0.2, 4.25, 1.32);
      if (abs(u) < a && hy < top) {
        if (OPEN[i] > 0.5) hole = true;
        else shade = 0.3 + (hash2(vec2(floor(hy / 0.4), floor(u / 0.8))) - 0.5) * 0.05 + (fy * 0.4 * P < 1.0 ? -0.08 : 0.0);
      } else if (abs(u) < a + 0.2 && hy < mould) {
        // the archivolt: two rolls with a hollow between
        float dd = min(a + 0.2 - abs(u), mould - hy) * P;
        dd = min(dd, (hy < top ? 99.0 : (hy - top) * P));
        shade = dd < 3.0 ? 0.56 : dd < 7.0 ? 0.3 : 0.5;
      }
    }
  }
  // --- the piers: a clustered column with a base and a capital, up into the vault ---
  for (int i = 0; i < ${piers.length}; i++) {
    float u = (r.x - PIER[i]) / P;
    float w = 0.45 + (hy < 0.55 ? 0.1 : 0.0) + (hy > 4.02 && hy < 4.3 ? 0.08 : 0.0);
    if (abs(u) < w) {
      hole = false;
      float cyl = cos(clamp(u / w, -1.0, 1.0) * 1.45);
      shade = 0.22 + cyl * 0.34 + (u < 0.0 ? 0.04 : -0.03);
      // attached shafts: three rolls
      float ru = abs(u) / 0.45;
      if (hy > 0.55 && hy < 4.02 && (abs(ru - 0.72) < 0.05 || ru < 0.05)) shade -= 0.12;
      if (hy < 0.55) { shade = 0.38 + cyl * 0.14; if (abs(hy - 0.3) < 0.04) shade -= 0.1; }
      if (hy > 4.02 && hy < 4.3) { shade = 0.52 + cyl * 0.1; if (hy > 4.24) shade -= 0.14; }
      // the vaulting shaft keeps rising above the capital
      if (hy > 4.3 && abs(u) > 0.2) shade -= 0.08;
    }
  }
  // --- a candle sconce built into each pier: an iron bracket, a dish, a candle, a slow stepped flame ---
  for (int i = 0; i < ${piers.length}; i++) {
    vec2 q = vec2(r.x - PIER[i], (FLOOR_Y - ${f(SCONCE)} * P) - r.y);   // y up from the dish
    if (abs(q.x) < 9.0 && q.y > -16.0 && q.y < 18.0) {
      float tm = floor(uTime * (1.0 - 0.7 * uReduced) * 3.0);
      float fl = hash1(tm + float(i) * 7.0);
      if (q.y < 0.0 && q.y > -14.0 && abs(q.x + q.y * 0.35) < 1.6) return vec4(pal(R_LEAD, 1.0), 1.0);             // the bracket's strut
      if (q.y >= 0.0 && q.y < 2.0 && abs(q.x) < 7.0) return vec4(ramp(R_WARM, q.y > 1.0 ? 0.45 : 0.15, p, 0.0), 1.0); // the dish
      if (q.y >= 2.0 && q.y < 8.0 && abs(q.x) < 1.5) return vec4(ramp(R_MOTE, q.x < 0.0 ? 1.0 : 0.7, p, 0.0), 1.0);   // the candle
      float fh = 5.0 + (fl > 0.6 ? 1.0 : 0.0);
      if (q.y >= 8.0 && q.y < 8.0 + fh && abs(q.x - (fl > 0.8 ? 0.5 : 0.0)) < 1.6 - (q.y - 8.0) / fh) return vec4(ramp(R_WARM, q.y < 10.0 ? 1.0 : 0.7, p, 0.0), 1.0);
    }
  }
  if (hole) return vec4(0.0);
  // the vault: deeper shadow high up
  shade -= smoothstep(8.0, 12.5, hy) * 0.2;
  // candle light lifts the stone a band or two (stepped, dithered at the edges) and warms it
  float lv = stepd(clamp(lit, 0.0, 1.0), 4.0, p, 0.9);
  bool warm = clamp(lit, 0.0, 1.0) * 1.6 > bayer4(p + vec2(1.0, 2.0)) + 0.15;
  vec3 c = warm ? ramp(R_STONEWARM, shade + lv * 0.12, p, 0.35) : ramp(R_STONE, shade + lv * 0.12, p, 0.35);
  return vec4(c, 1.0);
}`;
}

/** The clerestory's high light falling steeply into the nave (additive, just in front of the wall). */
function naveShaftBody(ctx: BuildCtx): string {
  const hx = Math.round(ctx.span / 2);
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + YROOM);
  float hy = (FLOOR_Y - r.y) / P;
  if (hy < 1.0 || hy > 13.0) return vec4(0.0);
  float bay = ${f(5.4 * P)};
  float fall = 13.0 - hy;
  float bx = mod(r.x - fall * P * 0.42 - ${f(RX(NAVE.piers[0]!) + 2.7 * P)}, bay) - bay * 0.5;
  float w = 0.55 * P + fall * 3.0;
  float a = (1.0 - smoothstep(0.0, w, abs(bx))) * smoothstep(1.0, 3.2, hy) * (1.0 - smoothstep(9.0, 13.0, hy));
  float tm = uTime * (1.0 - 0.6 * uReduced);
  a *= 0.5 + 0.5 * vnoise(vec2(bx / 11.0 - tm * 0.04, hy * 0.5));
  float lv = stepd(a, 3.0, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  return vec4(ramp(R_SHAFT, lv * 0.8, p, 0.0), lv * 0.14);
}`;
}

function build(ctx: BuildCtx, o: Opts): LayerDef[] {
  const L: LayerDef[] = [sky({ name: "air" })];
  const AD = AISLE_DEPTH;
  L.push({ kind: "glsl", name: "aisle", depth: AD, fog: 0.18, body: aisleBody(ctx, o, AD) });
  L.push({ kind: "glsl", name: "aisle-shafts", depth: AD, fog: 0, blend: "add", body: aisleShaftBody(ctx, o, AD) });
  L.push({ kind: "glsl", name: "nave", depth: 1, fog: 0, body: naveBody(ctx) });
  L.push({ kind: "glsl", name: "nave-shafts", depth: 1, fog: 0, blend: "add", body: naveShaftBody(ctx) });
  // dust in the high light, drifting slowly (points at the player plane)
  const W = ctx.W;
  // points live in layer px; in the world the camera's row is added back, so they sit in room rows
  const y0 = o.yRoom > 0 ? 0 : RAIL;
  L.push({
    kind: "points",
    name: "motes",
    depth: 1,
    system: new Motes({ region: [-W * 0.2, y0 + 40, ctx.panWidth(1) + W * 0.2, y0 + 590], count: Math.round(ctx.panWidth(1) / 26), row: ctx.row("mote"), vel: [1.5, -0.6], wander: 2.5, twinkle: 0.45, shade: [0.35, 0.8] }, ctx.rng),
  });
  return L;
}

/** The world's chapel: the depth-1 wall in room coordinates (the camera supplies the vertical offset). */
export const chapelScene: SceneDef = {
  title: "chapel",
  palette: PALETTE,
  fog: FOG,
  span: () => (NAVE.x1 - NAVE.x0) * P - 1280,
  prelude: (ctx) => prelude(ctx, { yRoom: 0 }),
  build: (ctx) => build(ctx, { yRoom: 0 }),
};

/** /scenes/ preview: the same nave at the rail row's framing. */
const preview: SceneDef = {
  ...chapelScene,
  prelude: (ctx) => prelude(ctx, { yRoom: RAIL }),
  build: (ctx) => build(ctx, { yRoom: RAIL }),
};

export default preview;

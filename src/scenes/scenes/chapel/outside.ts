// The chapel from outside (lane R-E): the porch (E2) and the bell stair and
// balcony (E4), both in the dusk of pilgrim-path/dusk.ts. Each is drawn in its
// room's own pixels from the room's layout (PORCH, BELFRY), so the doors, the
// sill with the dusty cup, the hook for the shawl, the stair treads and the
// balcony floor are exactly where the room's props and collision are.
//
// E2: the chapel's west front with a timber porch, the cliff top where the
// pilgrim path comes in, open sky and the valley to the west.
// E4: the bell tower at the chapel's east end: an outside stair in two flights
// up its flank, the balcony at the top with its balustrade (drawn behind the
// player, so she stands whole on the deck), and the bell-cote at the balcony's end where the chapel bell
// hangs over the red-marked door. The sky is the whole view.

import { f, type BuildCtx, type LayerDef, type SceneDef } from "../../engine/index.ts";
import type { WorldLayer } from "../../../world/backdrop/engine.ts";
import { DUSK_FOG, DUSK_PALETTE, duskLayers, duskMotes, duskPrelude, litShrines, type DuskOpts } from "../pilgrim-path/dusk.ts";

const P = 80;

export const OUTSIDE_PALETTE: Record<string, string[]> = {
  ...DUSK_PALETTE,
  // the chapel's limestone in the last of the dusk
  wall: ["#140f15", "#1e161d", "#2a1f27", "#382a31", "#4a383c", "#624a48", "#86645a"],
  // the same stone where the low sun reaches it
  wallLit: ["#3a2830", "#5e3c3c", "#8e5a4c", "#bc7c5e", "#e0a474"],
  tile: ["#160f13", "#22161a", "#301e21", "#422829", "#5a3632"],
  timber: ["#120c0e", "#1d1316", "#2a1c1c", "#3a2724", "#51362e"],
  glow: ["#4a2a20", "#8a5230", "#d09050", "#f4c888"],
  // moss, ivy and grass in the dusk: olive warming toward the sun, violet in the shade
  moss: ["#15131c", "#1c2120", "#262f24", "#36402a", "#4e5531", "#73703c", "#a08a4a"],
};

// ======================================================================================
// E2 the porch

/** The porch in world H (E2 spans x 396..410, floor 40; the view shows 395..411). */
export const PORCH = {
  x0: 396,
  x1: 410,
  top: 47,
  floor: 40,
  /** The chapel's west front starts here; left of it, open sky over the cliff. */
  front: 399.4,
  column: 398.65,
  eave: 45.3,
  door: 408.2,
  window: 405.2,
  sill: 1.05,
  /** A buttress on the west front between the bench and the lancet: its west and east faces (H). */
  buttress: [403.98, 404.62] as [number, number],
};

/**
 * The porch at the player plane (E2), in room px from the screen (the locked camera stands 1 H west of
 * the room). The chapel's west front in coursed limestone (each block bevelled: a lit top edge, dark
 * joints below and to the east; weathering in quantised clusters; quoins lit on the corner facing the
 * low sun; damp streaks under the eave; moss creeping up the plinth), the portal round the doors in
 * three orders (voussoir joints, lit inner edges) under a hood mould with label stops, the lancet with
 * the nave's candle light in it spilling warm on the stone round it and on its sill, the porch's
 * timber eave beam with rafter ends and a pitched roof of clay tiles (scalloped rows, nearer rows
 * taller, a few slipped or mossy), a stone column with a base and a capital at the open corner, the
 * platform's dressed front over a rubble foundation, and the cliff top the path comes in on.
 */
function porchBody(front: boolean): string {
  // a locked room narrower than the view: the camera sits 1 H left of the room (room x = screen x - 80)
  const X = (wx: number): number => Math.round((wx - PORCH.x0) * P);
  const floorY = Math.round((PORCH.top - PORCH.floor) * P);
  const eave = PORCH.eave - PORCH.floor;
  return /* glsl */ `
const float P = ${f(P)};
float arch(float u, float a, float sp, float k) {
  float R = a * k;
  float c = R - a;
  float x = abs(u) + c;
  return sp + sqrt(max(0.0, R * R - x * x));
}
float cluster(vec2 q, float k) { return step(k, vnoise(q)); }
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(s.x - 80.0, s.y);
  float hy = (${f(floorY)} - r.y) / P;
  float xH = r.x / P;
  float shade = -1.0;
  float lit = 0.0;
  float moss = -1.0;
  float warm = 0.0;
  float lamp = 0.0;
  ${
    front
      ? `
  // ---------- in front of the player: ivy off the eave's open end, grass on the cliff's lip ----------
  float tm = uTime * (1.0 - 0.8 * uReduced);
  float ev = ${f(eave)};
  if (r.x < ${f(X(PORCH.column) + 0.55 * P)} && r.x > ${f(X(PORCH.column) - 0.6 * P)} && hy < ev && hy > ev - 1.35) {
    float below = (ev - hy) * P;
    float sway = floor(sin(tm * 0.8 + r.x * 0.07) * 1.4 * below / 60.0 + 0.5);
    float vx = r.x - sway;
    float col = floor(vx / 4.0);
    float len = (14.0 + hash1(col * 2.7) * 90.0) * step(0.4, hash1(col * 5.3));
    float cx = mod(vx, 4.0) - 1.5 - floor(sin(below * 0.17 + col) + 0.5);
    if (below < len) {
      if (abs(cx) < 0.6) moss = 0.3 + hash1(floor(below / 4.0) + col) * 0.12;
      else if (abs(cx) < 1.6 && hash2(vec2(col, floor(below / 3.0))) > 0.5) moss = 0.48 + hash1(floor(below / 3.0) + col * 3.0) * 0.16;
    }
  }
  if (r.x < ${f(X(PORCH.front) - 4)} && hy >= 0.0 && hy < 0.12) {
    float cl = vnoise(vec2(r.x / 19.0, 2.0));
    float bh = (2.0 + hash1(floor(r.x)) * 7.0) * smoothstep(0.45, 0.7, cl);
    if (hash1(floor(r.x) * 1.7) > 0.3 && hy * P < bh) moss = hy * P > bh - 1.5 ? 0.82 : 0.36 + hy * P / 9.0 * 0.3;
  }
  if (moss >= 0.0) return vec4(ramp(R_MOSS, moss, p, 0.3), 1.0);
  return vec4(0.0);`
      : `
  // ---------- below the floor line ----------
  if (hy < 0.0) {
    float dn = -hy * P;                                    // px below the floor's top
    // the platform's west end is a built corner (lit end stones down its dressed courses); below the
    // plinth the cliff's rock bulges out under the foundation, so the two are one footing, not a seam
    float seam = ${f(X(PORCH.front))} + (dn > 0.98 * P ? (dn - 0.98 * P) * 0.55 + floor(vnoise(vec2(dn / 9.0, 4.4)) * 14.0) : 0.0);
    if (r.x < seam) {
      // the cliff top the path comes in on: rock in leaning beds, a turf lip
      float bed = (r.y + r.x * 0.3) / 18.0;
      float fb = fract(bed + vnoise(vec2(r.x / 37.0, floor(bed))) * 0.4);
      shade = 0.24 + (floor(vnoise(vec2(r.x / 15.0, r.y / 8.0)) * 4.0) / 4.0 - 0.5) * 0.14 - dn / P * 0.03;
      if (fb > 0.92) shade = 0.1;
      else if (fb < 0.07) shade += 0.08;
      if (dn < 3.0) moss = dn < 1.0 ? 0.8 : 0.5;
      if (dn > 0.98 * P && seam - r.x < 2.0) { shade = 0.5; lit = 0.4; }
      else if (dn < 9.0 && cluster(vec2(r.x / 14.0, 1.0), 0.45) > 0.5 && dn < 3.0 + hash1(floor(r.x / 2.0)) * 8.0) moss = 0.36;
      lit = 0.0;
    } else {
      // the porch platform: a lit flag edge, two dressed courses, a plinth, the rubble foundation
      if (dn < 2.0) { shade = 0.64; lit = 0.45; }
      else if (dn < 4.0) shade = 0.14;
      else if (dn < 0.9 * P) {
        float course = floor((dn - 4.0) / (0.43 * P));
        float off = mod(course, 2.0) * 31.0;
        float fx = mod(r.x + off, 62.0), fy = mod(dn - 4.0, 0.43 * P);
        shade = 0.32 + (hash2(vec2(floor((r.x + off) / 62.0), course)) - 0.5) * 0.08 + (floor(vnoise(vec2(r.x / 12.0, r.y / 7.0)) * 3.0) / 3.0 - 0.5) * 0.06;
        if (fy < 1.5) shade += 0.1;
        if (fy > 0.43 * P - 1.0 || fx > 61.0) shade = 0.12;
        if (hash2(floor(r.xy / 3.0)) > 0.95) shade -= 0.07;
      } else if (dn < 0.98 * P) {
        shade = dn < 0.93 * P ? 0.46 : 0.16;              // the plinth's moulding
      } else {
        // the foundation: random coursed rubble, darker going down
        float dd = dn - 0.98 * P;
        float course = floor(dd / 15.0);
        float fy = mod(dd, 15.0);
        float cell = floor(r.x / 9.0);
        float edge = hash1(cell + course * 13.0) > 0.62 ? 1.0 : 0.0;     // a block ends in this cell
        float bxs = mod(r.x, 9.0);
        float blk = floor(r.x / 9.0 + hash1(course * 7.0) * 3.0);
        shade = 0.24 + (hash1(blk * 1.3 + course * 5.0) - 0.5) * 0.12 - dd / P * 0.07;
        if (fy > 13.0) shade += 0.07;
        if (fy < 1.2 || (edge > 0.5 && bxs > 7.8)) shade = 0.08;
        else if (edge > 0.5 && bxs > 6.0) shade -= 0.05;
      }
      // the corner: end stones down the dressed courses, their west faces in the low sun
      float ce = r.x - ${f(X(PORCH.front))};
      if (dn >= 4.0 && dn < 0.98 * P && ce < 7.0) {
        shade = ce < 2.0 ? 0.62 : 0.42 + (hash1(floor((dn - 4.0) / (0.43 * P))) - 0.5) * 0.06;
        lit = ce < 2.0 ? 0.6 : 0.2;
        if (mod(dn - 4.0, 0.43 * P) < 1.2) shade = 0.14;
      }
      // where the rock meets the foundation: a dark crevice, a lit lip of rock over it
      if (dn > 0.98 * P && r.x - seam < 2.0) { shade = 0.08; lit = 0.0; }
      // moss and grass in the joints along the flag edge
      if (dn >= 4.0 && dn < 10.0 && cluster(vec2(r.x / 22.0, 4.0), 0.55) > 0.5 && dn - 4.0 < hash1(floor(r.x / 2.0)) * 7.0) moss = 0.34 + hash1(floor(r.x)) * 0.1;
      // the lanterns' light falls on the flags' edge and the course under it
      for (int i = 0; i < 2; i++) {
        float lx = i == 0 ? ${f(X(401.2))} : ${f(X(406.2))};
        float ld = abs(r.x - lx) / ${f(1.1 * P)} + dn / ${f(0.7 * P)};
        lamp = max(lamp, max(0.0, 1.0 - ld));
      }
    }
  }
  // ---------- the west front ----------
  if (shade < 0.0 && moss < 0.0 && r.x >= ${f(X(PORCH.front))}) {
    float course = floor(hy / 0.4);
    float off = mod(course, 2.0) * 0.45;
    float bxi = floor((xH + off) / 0.9);
    float fy = fract(hy / 0.4) * 0.4 * P, fx = fract((xH + off) / 0.9) * 0.9 * P;
    shade = 0.36 + (hash2(vec2(bxi, course)) - 0.5) * 0.1 + (floor(vnoise(vec2(r.x / 16.0, r.y / 10.0)) * 4.0) / 4.0 - 0.5) * 0.07;
    if (fy > 0.4 * P - 1.5) shade += 0.09;                      // the block's lit top bevel
    if (fy < 1.0 || fx > 0.9 * P - 1.0) shade = 0.13;           // joints below and to the east
    else if (fx < 1.5) shade += 0.04;
    if (hash2(floor(r.xy / 3.0) + 11.0) > 0.955) shade -= 0.08;  // chips
    // a few blocks replaced over the years: paler, sharper-edged
    if (hash2(vec2(bxi, course) + 41.0) > 0.93 && fy > 1.0 && fx < 0.9 * P - 1.0) shade += 0.07;
    // damp streaks under the eave
    float sx = floor(r.x / 3.0);
    if (hy > ${f(eave)} - 1.2 - hash1(sx) * 1.4 && hy < ${f(eave)} && hash1(sx * 3.7) > 0.8) shade -= 0.04;
    // the plinth course at the foot, and moss creeping up it
    if (hy < 0.6) { shade = 0.3 + (hash2(vec2(floor(xH / 0.6), 3.0)) - 0.5) * 0.06; if (hy > 0.53) shade = 0.5; if (hy < 0.03) shade = 0.1; }
    if (hy < 0.3 && cluster(vec2(r.x / 18.0, 6.0), 0.55) > 0.5 && hy * P < 3.0 + hash1(floor(r.x / 2.0)) * 16.0) moss = 0.32 + hash1(floor(r.y / 2.0) + floor(r.x)) * 0.14;
    // quoins: the corner's long and short stones, the west face in the low sun
    float qx = r.x - ${f(X(PORCH.front))};
    float qw = mod(course, 2.0) < 1.0 ? 0.55 * P : 0.32 * P;
    if (qx < qw && hy >= 0.6) {
      shade = 0.44 + (hash1(course * 1.3) - 0.5) * 0.08;
      if (fy > 0.4 * P - 1.5) shade += 0.08;
      if (fy < 1.0 || qx > qw - 1.0) shade = 0.16;
      lit = qx < 4.0 ? 0.8 : 0.3;
      if (qx < 4.0) shade = 0.64;
    }
    // ---- the buttress: a pier of the same stone standing out of the front, stepping back at two
    // set-offs (sloped caps lit by the sky, a drip under each), its sunward side face lit warm, its
    // own coursing with staggered joints, its shadow cast on the wall to the east ----
    {
      float b0 = ${f(X(PORCH.buttress[0]))}, b1 = ${f(X(PORCH.buttress[1]))};
      float bw = b1 - b0;
      float frac = hy < 2.6 ? 1.0 : hy < 4.3 ? 0.68 : 0.42;
      float bE = b0 + bw * frac;
      bool inB = r.x >= b0 && r.x < bE && hy >= 0.0 && hy < ${f(eave)} - 0.05;
      // the sloped caps on each set-off
      float capH = 1.0;                                // < 0: px under a cap's sloped top
      if (hy >= 2.6 && r.x >= b0 + bw * 0.68 && r.x < b1) capH = (hy - 2.6) * P - (b1 - r.x) * 1.0;
      if (hy >= 4.3 && r.x >= b0 + bw * 0.42 && r.x < b0 + bw * 0.68) capH = (hy - 4.3) * P - (b0 + bw * 0.68 - r.x) * 1.0;
      if (!inB && capH < 0.0) {
        float k = -capH;
        shade = k < 2.0 ? 0.66 : 0.46;
        lit = k < 2.0 ? 0.6 : 0.2;
        moss = -1.0;
      } else if (inB) {
        float xs = r.x - b0;
        float bc = floor(hy / 0.3);
        float bfy = fract(hy / 0.3) * 0.3 * P;
        if (xs < 8.0) {
          // the side face toward the low sun
          shade = 0.56 + (xs < 1.5 ? 0.08 : 0.0);
          lit = 0.65;
          if (bfy < 1.0) shade = 0.34;
        } else {
          float jx = mod(xs - 8.0 + mod(bc, 2.0) * 13.0, 26.0);
          shade = 0.47 + (hash2(vec2(floor((xs - 8.0 + mod(bc, 2.0) * 13.0) / 26.0), bc + 70.0)) - 0.5) * 0.1 + (floor(vnoise(vec2(r.x / 8.0, r.y / 7.0)) * 3.0) / 3.0 - 0.5) * 0.06;
          if (bfy > 0.3 * P - 1.5) shade += 0.07;
          if (bfy < 1.0 || jx < 1.0) shade = 0.17;
          if (hash2(floor(r.xy / 2.0) + 19.0) > 0.95) shade -= 0.08;
          if (r.x >= bE - 2.0) shade = 0.13;
        }
        // the drip under each set-off's cap and the plinth running round its foot
        if ((abs(hy - 2.6) * P < 1.0 || abs(hy - 4.3) * P < 1.0) && xs >= 8.0) shade = 0.1;
        if (hy < 0.6) { shade = hy > 0.53 ? 0.54 : 0.36; if (hy < 0.03) shade = 0.1; if (xs < 8.0) { shade = 0.6; lit = 0.55; } }
        moss = -1.0;
        if (hy < 0.5 && cluster(vec2(r.x / 7.0, 9.0), 0.4) > 0.5 && hy * P < 4.0 + hash1(floor(r.x / 2.0)) * 22.0) moss = 0.34 + hash1(floor(r.y / 2.0)) * 0.14;
      } else if (r.x >= bE && r.x < bE + 16.0 && hy > 0.0 && hy < ${f(eave)} - 0.05) {
        // its shadow on the wall to the east, the last px dithered
        float k = (r.x - bE) / 16.0;
        if (k < 0.7 || bayer4(p) > (k - 0.7) / 0.3) shade *= 0.55;
      }
    }
    // ---- ivy climbing the front's corner from the plinth: clumps of leaves on wandering stems,
    // thinning upward, breaking the quoins' hard edge; lit where the low sun reaches round the corner ----
    {
      float ix = r.x - ${f(X(PORCH.front))};
      float reach = 2.9 * (0.6 + 0.4 * vnoise(vec2(ix / 23.0, 2.0)));
      if (ix > -3.0 && ix < 0.9 * P && hy > 0.0 && hy < reach) {
        float stem = 10.0 + 14.0 * sin(hy * 1.7) + 8.0 * sin(hy * 4.1 + 1.0);
        float lv = vnoise(vec2(r.x / 6.0, r.y / 5.0));
        float dens = sqrt(1.0 - hy / reach) * (1.0 - smoothstep(26.0, 70.0, ix)) * 1.15;
        bool leaf = lv > 1.0 - dens * 0.9 && hash2(floor(vec2(r.x / 3.0, r.y / 3.0))) > 0.12;
        if (abs(ix - stem) < 1.0 && hash1(floor(hy * 6.0)) > 0.2) moss = 0.18;
        if (leaf) {
          float edge = vnoise(vec2((r.x - 1.0) / 6.0, (r.y + 1.0) / 5.0)) < 1.0 - dens * 0.9 ? 1.0 : 0.0;
          moss = 0.36 + hash2(floor(vec2(r.x / 3.0, r.y / 3.0)) + 3.0) * 0.16 + edge * 0.28;
          if (ix < 6.0 && edge > 0.5) { shade = 0.7; lit = 0.8; moss = -1.0; }
        }
      }
    }
    // ---- the portal round the chapel doors: three orders stepping back to the door's own frame,
    // voussoirs in each ring, a hood mould with label stops; all under the eave beam ----
    float pu = (r.x - ${f(X(PORCH.door))}) / P;
    for (int k = 0; k < 3; k++) {
      float a = 1.95 - float(k) * 0.16;
      float apex = 5.0 - float(k) * 0.17;
      float sp = apex - a * 1.14;                               // k = 1.15: a slightly pointed head
      float top = arch(pu, a, sp, 1.15);
      if (abs(pu) < a && hy < top) {
        float itop = arch(pu, a - 0.16, sp + 0.03, 1.15);
        bool ring = hy > sp && hy > itop;
        shade = 0.44 - float(k) * 0.07 + (hash2(vec2(floor(hy / 0.4), float(k))) - 0.5) * 0.05;
        if (!ring && fract(hy / 0.4) * 0.4 * P < 1.0) shade -= 0.12;
        if (ring && fract(atan(hy - sp, pu) * 4.5 + float(k) * 0.5) < 0.07) shade -= 0.14;   // voussoir joints
        // each order steps back: its inner arris lit (brighter on the sun's side), a shadow where it meets the next
        float ed = min(a - abs(pu), top - hy) * P;
        if (ed < 1.5) shade = 0.12;
        else if (ed < 3.5) { shade = pu < 0.0 ? 0.6 : 0.5; lit = pu < 0.0 ? 0.3 : 0.0; }
      }
    }
    float hood = arch(pu, 2.1, 5.12 - 2.1 * 1.14, 1.15);
    if (abs(pu) < 2.12 && hy > hood - 0.02 && hy < hood + 0.06) { shade = hy > hood + 0.03 ? 0.62 : 0.34; lit = hy > hood + 0.03 ? 0.35 : 0.0; }
    if (abs(abs(pu) - 2.04) < 0.1 && hy > 2.55 && hy < 2.86) { shade = hy > 2.8 ? 0.6 : 0.4; lit = 0.2; }                   // label stops
    // ---- a lancet by the door, the nave's candle light in it, spilling on the stone; the stone sill ----
    float wu = (r.x - ${f(X(PORCH.window))}) / P;
    float wtop = arch(wu, 0.3, 2.6, 1.3);
    vec2 wc = vec2(${f(X(PORCH.window))}, ${f(floorY)} - ${f(PORCH.sill + 0.7)} * P);
    float spill = length((r - wc) * vec2(1.0, 0.7)) / P;
    warm = floor(max(0.0, 1.0 - spill / 0.62) * 3.0 + bayer4(p) * 0.9) / 3.0;
    // the porch lanterns' light on the stone round them: a warm core fading out through a dithered edge
    for (int i = 0; i < 2; i++) {
      vec2 lc = vec2(i == 0 ? ${f(X(401.2))} : ${f(X(406.2))}, ${f(floorY)} - ${f(PORCH.eave - PORCH.floor - 0.9)} * P);
      float ld = length((r - lc) * vec2(1.0, 1.15)) / ${f(1.05 * P)};
      lamp = max(lamp, max(0.0, 1.0 - ld));
    }
    if (abs(wu) < 0.3 && hy > ${f(PORCH.sill + 0.08)} && hy < wtop) {
      shade = -2.0;
    } else if (abs(wu) < 0.42 && hy > ${f(PORCH.sill + 0.02)} && hy < wtop + 0.12) {
      float ed = min(0.42 - abs(wu), wtop + 0.12 - hy) * P;
      shade = ed < 1.5 ? 0.14 : wu < 0.0 ? 0.56 : 0.44;
      if (abs(wu) < 0.33 && hy < wtop + 0.03) shade = 0.1;                      // the reveal
    }
    if (abs(wu) < 0.48 && hy > ${f(PORCH.sill - 0.1)} && hy <= ${f(PORCH.sill + 0.02)}) { shade = hy > ${f(PORCH.sill - 0.02)} ? 0.66 : hy > ${f(PORCH.sill - 0.07)} ? 0.4 : 0.14; lit = 0.3; warm = max(warm, 0.67); }
    // a plain band where the plaque hangs, and a string course over the porch
    if (abs(hy - 5.6) < 0.07) shade = 0.52;
  }
  // ---------- the porch: eave beam with rafter ends, a pitched tile roof, the column ----------
  float cu = (r.x - ${f(X(PORCH.column))}) / P;
  float ev = ${f(eave)};
  float roofL = ${f(X(PORCH.column) - 0.6 * P)};
  if (r.x > roofL && hy > ev - 0.14 && hy <= ev + 0.3) {
    float bh = (hy - ev) * P;
    if (bh >= 0.0) {
      // the beam: timber grain, a lit top arris, a dark lower one
      shade = 0.3 + (hash1(floor(r.x / 5.0) + floor(bh / 3.0) * 7.0) - 0.5) * 0.06 + (mod(r.x + floor(bh) * 13.0, 37.0) < 1.0 ? -0.08 : 0.0);
      if (bh > 0.3 * P - 2.0) { shade = 0.6; lit = 0.4; }
      if (bh < 1.5) shade = 0.12;
      moss = -1.0;
    } else {
      // rafter ends under the beam, and the beam's shadow on the wall behind
      float rx = mod(r.x - roofL, 0.6 * P);
      float rd = (ev - hy) * P;
      if (rx < 9.0 && rd < 9.0) { shade = rx < 2.0 ? 0.52 : rd > 7.0 ? 0.14 : 0.28; lit = rx < 2.0 ? 0.4 : 0.0; moss = -1.0; }
      else if (shade > 0.0 && r.x > ${f(X(PORCH.front))}) shade *= 0.55;
    }
  }
  if (r.x > roofL - 4.0 && hy > ev + 0.3 && hy < ev + 1.15) {
    // clay tiles in courses, each tile's rounded lower edge lit by the sky and casting a shadow on the
    // course below; the upper part of each tile catching a little more light
    float rt = hy - ev - 0.3;
    float rowH = 0.2;
    float row = floor(rt / rowH);
    float ty = fract(rt / rowH);
    float tw = 18.0;
    float tid = floor((r.x + mod(row, 2.0) * 9.0) / tw);
    float tx = mod(r.x + mod(row, 2.0) * 9.0, tw) / tw;
    float scal = 0.3 * (1.0 - sqrt(max(0.0, 1.0 - (tx * 2.0 - 1.0) * (tx * 2.0 - 1.0))));
    shade = 0.24 + ty * 0.1 + (hash2(vec2(tid, row)) - 0.5) * 0.1 + (abs(tx - 0.35) < 0.08 ? 0.05 : 0.0);
    if (ty < scal + 0.1) { shade = 0.5; lit = 0.45; }
    if (ty < scal) shade = 0.1;
    if (tx < 0.06) shade -= 0.07;
    // the barge board on the roof's open (west) end
    if (r.x < roofL + 3.0) { shade = 0.5; lit = 0.6; }
    // a slipped tile or two, and moss in the valleys
    if (hash2(vec2(tid, row) + 3.0) > 0.95 && ty > scal) shade = 0.1;
    if (cluster(vec2(r.x / 30.0, row), 0.64) > 0.5 && ty > scal + 0.1 && ty < scal + 0.35) moss = 0.4 + hash1(tid) * 0.1;
    // the lead flashing where the roof meets the wall
    if (rt > 0.8) { shade = rt > 0.83 ? 0.44 : 0.2; lit = 0.0; moss = -1.0; }
  }
  if (abs(cu) < 0.22 && hy >= 0.0 && hy <= ev - 0.14) {
    float cyl = cos(clamp(cu / 0.2, -1.0, 1.0) * 1.4);
    shade = 0.22 + cyl * 0.24 + (cu < -0.12 ? 0.3 : 0.0) + (mod(r.x, 6.0) < 1.0 ? -0.05 : 0.0);
    lit = cu < -0.12 ? 0.8 : 0.0;
    moss = -1.0;
    if (hy < 0.3 || hy > ev - 0.44) {
      shade = 0.4 + cyl * 0.14 + (cu < -0.14 ? 0.2 : 0.0);
      if (abs(hy - 0.15) < 0.03 || abs(hy - (ev - 0.3)) < 0.03) shade = 0.16;
    } else if (abs(cu) > 0.17) shade = -1.0;
    if (hy < 0.3 && hy * P < 3.0 + hash1(floor(r.x / 2.0)) * 10.0 && cluster(vec2(r.x / 9.0, 2.0), 0.4) > 0.5) moss = 0.36;
  }
  if (shade == -2.0) {
    // the window: amber quarries lit dimly from inside by the nave's candles, brighter low down
    vec2 g = vec2(r.x + r.y, r.x - r.y) / 7.0;
    float lead = step(fract(g.x), 0.14) + step(fract(g.y), 0.14);
    if (lead > 0.5) return vec4(pal(R_WALL, 0.0), 1.0);
    float low = clamp((r.y - ${f((PORCH.top - PORCH.floor - PORCH.sill) * P - 130)}) / 110.0, 0.0, 1.0);
    float t = 0.22 + hash2(floor(g)) * 0.22 + low * 0.35;
    return vec4(ramp(R_GLOW, t, p, 0.0), 1.0);
  }
  if (moss >= 0.0) return vec4(ramp(R_MOSS, moss, p, 0.3), 1.0);
  if (shade < 0.0) return vec4(0.0);
  vec3 c = lit > 0.25 ? ramp(R_WALLLIT, shade * 0.6 + lit * 0.35, p, 0.4) : ramp(R_WALL, shade, p, 0.4);
  if (warm > 0.0 && lit <= 0.25) c = ramp(R_WALLLIT, shade * 0.55 + warm * 0.22, p, 0.4);
  else if (lit <= 0.25 && lamp * lamp > bayer4(p + vec2(2.0, 1.0)) * 0.55 + 0.04) c = ramp(R_WALLLIT, shade * 0.55 + lamp * 0.16, p, 0.4);
  return vec4(c, 1.0);`
  }
}`;
}

function porchDusk(world: boolean): DuskOpts {
  return {
    camRef: 0,
    world,
    horizon: 470,
    sun: [170, 438],
    ringR: 128,
    spireX: 430,
    lakeX: 180,
    lamps: [[110, 1], [300, 2], [470, 3]],
    colossi: true,
    crags: "cliff",
    camRange: [0, 0],
    lit: litShrines(),
  };
}

export const porchScene: SceneDef = {
  title: "chapel-porch",
  palette: OUTSIDE_PALETTE,
  fog: DUSK_FOG,
  span: () => 0,
  prelude: () => duskPrelude(porchDusk(true)),
  build: (ctx: BuildCtx): LayerDef[] => {
    const L = duskLayers(ctx, porchDusk(true));
    L.push({ kind: "glsl", name: "porch", depth: 1, fog: 0, body: porchBody(false) });
    L.push(duskMotes(ctx, [0, 200, ctx.W, 620]));
    const ivy: WorldLayer = { kind: "glsl", name: "porch-ivy", depth: 1, fog: 0, body: porchBody(true), pass: "front" };
    L.push(ivy);
    return L;
  },
};

// ======================================================================================
// E4 the bell stair and balcony

/** The bell tower in world H (E4 spans x 458..486; floor 40; the balcony at 52). */
export const BELFRY = {
  x0: 458,
  x1: 486,
  top: 58,
  bottom: 36.7,
  floor: 40,
  /** Two flights of standard steps up the tower's flank, a landing between. */
  flight1: { x: 459, y: 40, n: 30 },
  landing: [468, 470] as [number, number],
  flight2: { x: 470, y: 46, n: 30 },
  balcony: [479, 486] as [number, number],
  deck: 52,
  /** The tower's mass behind the stair, and the bell-cote at the balcony's end. */
  tower: [458, 469.6] as [number, number],
  /** The belfry's slender shaft under the bell-cote. */
  shaft: [483.5, 486.4] as [number, number],
  cote: [484.1, 486.4] as [number, number],
  bell: 485.15,
  door: 485.2,
  /** The doorway in the chapel's east wall, out of the nave onto the stair's foot. */
  eastDoor: 458.5,
  bench: 481.4,
  anchor: 0.64,
  vista: { x0: 479, x1: 486, cx: 480.2, cy: 53.5 },
};

function belfryBody(ctx: BuildCtx, yRoom: number, front: boolean): string {
  const hx = Math.round(ctx.span / 2);
  const X = (wx: number): number => Math.round((wx - BELFRY.x0) * P);
  const Y = (wy: number): number => Math.round((BELFRY.top - wy) * P);
  const B = BELFRY;
  const f1x = X(B.flight1.x), f1y = Y(B.flight1.y), f2x = X(B.flight2.x), f2y = Y(B.flight2.y);
  const towerE = X(B.tower[1]);
  const shaftW = X(B.shaft[0]), shaftE = X(B.shaft[1]);
  return /* glsl */ `
const float P = ${f(P)};
float arch(float u, float a, float sp, float k) {
  float R = a * k;
  float c = R - a;
  float x = abs(u) + c;
  return sp + sqrt(max(0.0, R * R - x * x));
}
// ivy climbing a wall from its foot: leaf clumps on wandering stems, thinning upward and away from
// the stem's line; -3 a stem, -4 a leaf, -5 a leaf's sunlit edge, 0 nothing (r room px, foot row fy)
float ivy(vec2 r, float x0, float fy, float reach, float width, float seed) {
  float ix = r.x - x0;
  float hy = (fy - r.y) / P;
  if (abs(ix) > width || hy < 0.0 || hy > reach) return 0.0;
  float stem = sin(hy * 1.9 + seed) * width * 0.35 + sin(hy * 4.3 + seed * 2.0) * 3.0;
  float dens = sqrt(1.0 - hy / reach) * (1.0 - smoothstep(width * 0.35, width, abs(ix - stem))) * 1.15;
  float lv = vnoise(vec2(r.x / 8.0 + seed, r.y / 7.0)) * 0.75 + vnoise(vec2(r.x / 3.0, r.y / 3.0) + seed) * 0.25;
  if (lv > 1.0 - dens * 0.8) {
    bool edge = vnoise(vec2((r.x - 1.0) / 8.0 + seed, (r.y - 1.0) / 7.0)) * 0.75 + vnoise(vec2((r.x - 1.0) / 3.0, (r.y - 1.0) / 3.0) + seed) * 0.25 < 1.0 - dens * 0.8;
    if (!edge && hash2(floor(r / 2.0) + seed) < 0.22) return -3.0;      // the dark between leaves
    return edge ? -5.0 : -4.0;
  }
  if (abs(ix - stem) < 1.0 && hash1(floor(hy * 6.0) + seed) > 0.25) return -3.0;
  return 0.0;
}
// coursed ashlar: every block its own value (a few darker, weathered ones), a lit top bed and west
// arris, a shaded underside and east arris, crisp joints, chips in clusters and the odd hairline crack
float ashlar(vec2 r, float bw) {
  float course = floor(r.y / 32.0);
  float off = mod(course, 2.0) * bw * 0.5 + floor(hash1(course * 3.7) * 3.0) * 6.0;
  float bid = floor((r.x + off) / bw);
  float k = hash2(vec2(bid, course));
  float sh = (k - 0.5) * 0.16 + (k > 0.9 ? -0.06 : 0.0) + (floor(vnoise(vec2(r.x / 15.0, r.y / 9.0)) * 4.0) / 4.0 - 0.5) * 0.06;
  float fy = mod(r.y, 32.0), fx = mod(r.x + off, bw);
  if (fy < 1.0 || fx < 1.0) sh -= 0.17;          // joints
  else if (fy < 3.0) sh += 0.1;                   // each block's lit top bed
  else if (fx < 2.5) sh += 0.05;                  // its lit west arris
  else if (fy > 29.5) sh -= 0.06;                 // its shaded underside
  else if (fx > bw - 2.0) sh -= 0.05;             // and its shaded east arris
  // chips gathered on some blocks, and a hairline crack across a few
  if (hash2(floor(r / 3.0) + 9.0) > 0.94 - step(0.75, k) * 0.06) sh -= 0.08;
  float cr = hash2(vec2(bid, course) + 17.0);
  if (cr > 0.86 && fy > 3.0 && fy < 29.0 && abs(fx - bw * (0.3 + 0.4 * cr) - (fy - 16.0) * (cr - 0.93) * 6.0) < 0.6) sh -= 0.12;
  return sh;
}
float cluster(vec2 q, float k) { return step(k, vnoise(q)); }
// the stair's tread top at room x (px)
float treadAt(float x) {
  if (x < ${f(f1x)}) return ${f(Y(B.floor))};
  if (x < ${f(f1x + 24 * B.flight1.n)}) return ${f(f1y)} - (floor((x - ${f(f1x)}) / 24.0) + 1.0) * 16.0;
  if (x < ${f(X(B.landing[1]))}) return ${f(Y(46))};
  if (x < ${f(f2x + 24 * B.flight2.n)}) return ${f(f2y)} - (floor((x - ${f(f2x)}) / 24.0) + 1.0) * 16.0;
  return ${f(Y(B.deck))};
}
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + ${f(yRoom)});
  float shade = -1.0;
  float lit = 0.0;
  float tread = treadAt(r.x);
  float d = r.y - tread;
  ${
    front
      ? `
  // --- in front of the player: grass along the treads and the deck (the balustrade is behind her) ---
  float tm = uTime * (1.0 - 0.8 * uReduced);
  float hh = tread - r.y;
  if (shade < 0.0 && hh >= 0.0 && hh < 9.0 && r.x > ${f(f1x)} && r.x < ${f(X(B.balcony[1]) - 0.4 * P)}) {
    float cl = vnoise(vec2(r.x / 21.0, 6.2));
    float bx = r.x - floor(sin(tm * 0.9 + r.x * 0.05) * 0.6 + 0.5) * step(4.0, hh);
    float hb = hash1(floor(bx));
    float bhh = (2.0 + hb * 6.0) * smoothstep(0.62, 0.8, cl);
    if (hash1(floor(bx) * 1.91) > 0.35 && hh < bhh) return vec4(ramp(R_MOSS, hh > bhh - 1.5 ? 0.8 : 0.34 + hh / 9.0 * 0.3, p, 0.3), 1.0);
  }
  if (shade < 0.0) return vec4(0.0);`
      : `
  // --- the stair tower at the chapel's east end: an open arcade at the stair's level (the dusk through it),
  // coursed stone above with lancets and a blind arcade under a lit crown ---
  // flight one rides a stringer carried on rampant arches; the tower shows through them
  float nose = ${f(f1y)} - (r.x - ${f(f1x)}) * (16.0 / 24.0);           // the line through the nosings
  bool underF1 = r.x >= ${f(f1x)} && r.x < ${f(X(B.landing[0]))} && d >= 0.0 && r.y < ${f(Y(B.floor))};
  bool archOpen = false;
  float ringK = -1.0;
  float ringJ = 0.0;
  if (underF1 && r.y - nose > 0.55 * P) {
    float bayW = 180.0;
    float bx = r.x - ${f(f1x)};
    float u = fract(bx / bayW);
    float kb = floor(bx / bayW);
    float ph = 14.0 / bayW;
    float clear = ${f(Y(B.floor))} - (${f(f1y)} - (kb + 0.5) * bayW * (16.0 / 24.0)) - 0.55 * P;
    if (clear > 1.2 * P && u > ph && u < 1.0 - ph) {
      float uu = (u - ph) / (1.0 - 2.0 * ph);
      float intr = nose + 0.55 * P + 6.0 + 0.5 * P * (1.0 - sqrt(max(0.0, 1.0 - (2.0 * uu - 1.0) * (2.0 * uu - 1.0))));
      if (r.y > intr + 7.0) archOpen = true;
      else if (r.y > intr) { ringK = r.y - intr; ringJ = fract(uu * 9.0); }
    }
  }
  bool landing = r.x >= ${f(X(B.landing[0]))} && r.x < ${f(towerE)} && d >= 0.0 && r.y < ${f(Y(B.floor))};
  bool stairMass = (underF1 && !archOpen) || landing;
  if (!stairMass && r.x < ${f(towerE)} && r.y > ${f(Y(54.6))}) {
    shade = 0.26 + ashlar(r, 72.0);
    float hh0 = (${f(Y(B.floor))} - r.y) / P;
    // the arcade: piers and pointed arches, open to the sky between them
    float bayW = ${f(3.4 * P)};
    float bx = mod(r.x - ${f(X(458.95))}, bayW);
    float pierW = 0.5 * P;
    float au = (bx - pierW - (bayW - pierW) * 0.5) / P;
    float aa = (bayW - pierW) * 0.5 / P;
    float atop = arch(au, aa, 4.3, 1.3);
    bool inBay = bx > pierW && r.x > ${f(X(458.95))} && r.x < ${f(towerE - 0.45 * P)};
    if (inBay && hh0 > 0.0 && hh0 < atop) return vec4(0.0);
    if (inBay && hh0 >= atop && hh0 < atop + 0.16) { shade = 0.5; lit = au < 0.0 ? 0.45 : 0.1; }
    if (!inBay && hh0 < 7.0 && r.x > ${f(X(458.95))}) {
      // the piers: lit on their west face
      float pu = bx / pierW;
      shade = 0.3 + (pu < 0.18 ? 0.3 : 0.0) + ashlar(r, 40.0) * 0.6;
      lit = pu < 0.18 ? 0.6 : 0.0;
      if (abs(hh0 - 4.2) < 0.12) { shade = 0.5; lit = 0.35; }
    }
    // string courses over the arcade and under the crown
    if (abs(hh0 - 7.6) < 0.08 || abs(hh0 - 11.0) < 0.07) { shade = 0.5; lit = 0.3; }
    if (abs(hh0 - 7.52) < 0.05 || abs(hh0 - 10.93) < 0.04) shade = 0.14;
    // a blind arcade band under the crown
    if (hh0 > 12.0 && hh0 < 13.6) {
      float bu = mod(r.x, 0.72 * P) / (0.72 * P);
      float bt = 12.2 + sqrt(max(0.0, 0.1 - (bu - 0.5) * (bu - 0.5) * 0.4)) * 3.0;
      if (hh0 < bt && abs(bu - 0.5) < 0.38) shade = 0.14;
    }
    // two lancets in the upper wall, the sky through them
    for (int k = 0; k < 2; k++) {
      vec2 wv = k == 0 ? vec2(${f(X(461.4))}, ${f(Y(48.3))}) : vec2(${f(X(466.2))}, ${f(Y(48.3))});
      float u = (r.x - wv.x) / P;
      float hh = (wv.y - r.y) / P;
      float top = arch(u, 0.45, 1.9, 1.3);
      if (abs(u) < 0.45 && hh > 0.0 && hh < top) return vec4(0.0);
      if (abs(u) < 0.58 && hh > -0.12 && hh < top + 0.14) { shade = 0.52; lit = u < 0.0 ? 0.5 : 0.1; }
      if (abs(u) < 0.64 && hh > -0.28 && hh <= -0.12) { shade = 0.58; lit = 0.5; }
    }
    if (r.x > ${f(towerE - 4)}) { shade = 0.62; lit = 0.8; }
    if (r.y < ${f(Y(54.6) + 5)}) { shade = 0.62; lit = 0.8; }
    else if (r.y < ${f(Y(54.6) + 9)}) shade = 0.34;
  }
  // --- the chapel's east wall and the doorway you came out of, at the stair's foot (the DOOR RULE):
  // a pointed arch like the nave's arcades cut through the wall, a two-tone reveal (the jamb facing
  // the low sun lit, the other in shade), voussoirs and a hood over the head, a threshold step, and
  // the nave's candle light warm at the foot of the dark passage beyond ---
  if (r.x < ${f(X(459.05))} && r.y > ${f(Y(47.5))}) {
    shade = 0.24 + ashlar(r, 64.0);
    float u = (r.x - ${f(X(B.eastDoor))}) / P;
    float au = abs(u);
    float hh = (${f(Y(B.floor))} - r.y) / P;
    bool head = hh > 1.85;
    float dd = (head ? length(vec2(au + 0.115, hh - 1.85)) - 0.475 : au - 0.36) * P;
    if (hh >= 0.0 && dd < 0.0) {
      // the passage: dark, the candle light of the nave pooling warm on its floor and low walls
      float w = (1.0 - smoothstep(0.0, 1.6, hh)) * (0.7 + 0.3 * (1.0 - smoothstep(-0.36, 0.36, u)));
      float lv = floor(w * 3.0 + bayer4(p) * 0.85) / 3.0;
      if (hh < 0.06) lv = max(lv, 0.67);
      return vec4(lv > 0.0 ? ramp(R_GLOW, 0.02 + lv * 0.3, p, 0.0) : ramp(R_WALL, 0.03, p, 0.0), 1.0);
    }
    if (hh >= 0.0 && dd < 15.0) {
      if (dd < 4.0) { shade = head ? 0.1 : u > 0.0 ? 0.5 : 0.13; lit = !head && u > 0.0 ? 0.45 : 0.0; }   // the reveal
      else if (dd < 5.5) { shade = 0.6; lit = u < 0.0 || head ? 0.55 : 0.2; }                             // the arris
      else if (dd < 13.0) {
        shade = 0.4 + (hash2(vec2(floor(hh / 0.4), u < 0.0 ? 1.0 : 2.0)) - 0.5) * 0.06;
        if (head && fract(atan(hh - 1.85, au + 0.115) / 0.16) < 0.12) shade = 0.16;                       // voussoir joints
        if (!head && fract(hh / 0.4) * 0.4 * P < 1.0) shade = 0.16;                                          // the jamb's courses
        if (head && au < 0.05) shade = 0.48;                                                                  // the keystone
        lit = u < 0.0 ? 0.3 : 0.0;
      } else shade = 0.13;
      if (abs(hh - 1.85) < 0.06 && dd >= 4.0) { shade = hh > 1.88 ? 0.58 : 0.36; lit = 0.3; }                 // the impost
    } else if (head && dd < 20.0) {
      shade = dd > 18.0 ? 0.6 : dd > 15.5 ? 0.44 : 0.14;                                                     // the hood
      lit = dd > 18.0 ? 0.6 : 0.0;
    }
    if (hh >= 0.0 && hh < 0.08 && au < 0.6) { shade = hh > 0.055 ? 0.64 : 0.4; lit = hh > 0.055 ? 0.5 : 0.0; } // the threshold step
    if (r.x > ${f(X(459.05) - 3)}) { shade = 0.56; lit = 0.6; }
  }
  // --- flight one: treads over the tower's solid flank ---
  if (stairMass) {
    // the stair's own masonry (smaller stones), in front of the tower: treads with lit nosings,
    // a moulded string along the slope, piers and spandrels over the rampant arches
    shade = 0.34 + ashlar(r, 40.0) * 0.8;
    float below = r.y - nose;
    if (d < 3.0) { shade = 0.64; lit = 0.85; }
    else if (d < 6.0) shade = 0.44;
    else if (d < 16.0) { shade = 0.34; if (mod(r.x - ${f(f1x)}, 24.0) > 22.0) shade -= 0.1; }
    else if (underF1 && below > 0.47 * P && below < 0.55 * P) { shade = below < 0.5 * P ? 0.56 : 0.2; lit = below < 0.5 * P ? 0.4 : 0.0; }
    if (ringK >= 0.0) {
      // the arch ring's voussoirs
      shade = 0.42 + (ringK < 1.5 ? 0.14 : 0.0) + (ringJ < 0.06 ? -0.16 : 0.0);
      lit = ringK < 1.5 ? 0.35 : 0.0;
    }
    if (landing) {
      // the buttress under the landing: its west face in the low sun, offsets stepping in
      float bu = r.x - ${f(X(B.landing[0]))};
      if (bu < 3.0 && d > 16.0) { shade = 0.6; lit = 0.7; }
      float hb = (${f(Y(B.floor))} - r.y) / P;
      if (abs(hb - 2.0) < 0.06 || abs(hb - 4.0) < 0.06) { shade = 0.52; lit = 0.3; }
    }
    // moss gathered in the angle under the treads
    if (underF1 && below > 0.55 * P && below < 0.55 * P + 6.0 && !archOpen && cluster(vec2(r.x / 24.0, 3.0), 0.55) > 0.5) shade = -3.0;
  }
  // ---- the ground: the doorstep's slab and the tower's foundation under it (no sky below the floor) ----
  if (r.x < ${f(towerE)} && r.y >= ${f(Y(B.floor))}) {
    float dn = r.y - ${f(Y(B.floor))};
    if (dn < 2.0) { shade = 0.62; lit = 0.5; }
    else if (dn < 4.0) shade = 0.14;
    else if (dn < 0.32 * P) shade = 0.36 + ashlar(r, 64.0) * 0.6;
    else if (dn < 0.38 * P) shade = dn < 0.35 * P ? 0.46 : 0.12;
    else { shade = 0.22 + ashlar(r + vec2(0.0, 5.0), 30.0) * 0.8 - (dn / P) * 0.05; lit = 0.0; }
  }
  // --- flight two: a flying stair on an arch, from the tower to the belfry, sky under it ---
  if (r.x >= ${f(towerE)} && r.x < ${f(X(B.balcony[0]))}) {
    float t = (r.x - ${f(towerE)}) / ${f(X(B.balcony[0]) - towerE)};
    float soffit = mix(${f(Y(45.35))}, ${f(Y(51.35))}, t);
    float intr = mix(${f(Y(43.4))}, ${f(Y(49.6))}, t) - sin(t * 3.14159) * ${f(1.05 * P)};
    if (d >= 0.0 && r.y < soffit) {
      // the treads and the stair's own coursed stringer, a moulded string along its foot
      shade = d < 3.0 ? 0.64 : d < 6.0 ? 0.44 : d < 16.0 ? 0.34 : 0.33 + ashlar(r, 40.0) * 0.9;
      lit = d < 3.0 ? 0.85 : 0.0;
      if (d >= 6.0 && d < 16.0 && mod(r.x - ${f(f2x)}, 24.0) > 22.0) shade -= 0.1;
      float sb = soffit - r.y;
      if (sb < 8.0 && sb >= 3.0) { shade = sb > 6.0 ? 0.56 : 0.4; lit = sb > 6.0 ? 0.4 : 0.0; }
      if (sb < 3.0) shade = 0.16;
    } else if (d >= 0.0 && r.y >= soffit && r.y < intr) {
      // the spandrel over the arch, coursed, pierced by a small oculus
      shade = 0.3 + ashlar(r, 56.0) * 1.1 - smoothstep(0.0, 60.0, intr - r.y) * 0.04;
      vec2 oc = vec2(mix(${f(towerE)}, ${f(X(B.balcony[0]))}, 0.34), mix(${f(Y(43.6))}, ${f(Y(49.0))}, 0.34));
      float od = length(r - oc);
      if (od < 18.0) return vec4(0.0);
      if (od < 23.0) { shade = 0.5; lit = r.x < oc.x ? 0.5 : 0.0; }
    } else if (d >= 0.0 && r.y >= intr && r.y < intr + 14.0) {
      // the arch ring's voussoirs, lit where they face the low sun
      shade = 0.4 + (mod(r.x, 26.0) < 1.5 ? -0.14 : 0.0) + (r.y < intr + 3.0 ? 0.18 : 0.0);
      lit = r.y > intr + 10.0 ? 0.6 : 0.0;
    } else if (d >= 0.0 && r.y >= intr + 14.0 && r.y < intr + 14.0 + 1.1 * P) {
      // ivy hanging from the arch's underside in clumps, swaying a whole pixel at a time
      float dy = r.y - intr - 14.0;
      float tm = uTime * (1.0 - 0.8 * uReduced);
      float vx = r.x - floor(sin(tm * 0.7 + r.x * 0.02) * 1.5 * dy / 50.0 + 0.5);
      float col = floor(vx / 4.0);
      float len = (8.0 + hash1(col * 1.7) * hash1(col * 3.1) * 80.0) * step(0.62, vnoise(vec2(vx / 41.0, 5.3)));
      float cx = mod(vx, 4.0) - 1.5 - floor(sin(dy * 0.15 + col * 2.0) + 0.5);
      if (hash1(col) > 0.45 && dy < len) {
        if (abs(cx) < 0.6) shade = -3.0;
        else if (abs(cx) < 1.6 && hash2(vec2(col, floor(dy / 3.0))) > 0.5) shade = -4.0;
      }
    }
  }
  // --- the balcony: its slab and small corbels ---
  float bd = (r.y - ${f(Y(B.deck))}) / P;
  if (r.x >= ${f(X(B.balcony[0]))} && r.x < ${f(shaftE + 8)} && bd >= 0.0 && bd < 0.42) {
    shade = bd < 0.04 ? 0.64 : bd < 0.1 ? 0.42 : 0.3;
    lit = bd < 0.04 ? 0.85 : 0.0;
  }
  if (r.x >= ${f(X(B.balcony[0]))} && r.x < ${f(shaftW)} && bd >= 0.42 && bd < 0.85) {
    // quarter-round brackets
    float cu = mod(r.x - ${f(X(B.balcony[0]))} + 20.0, 64.0) - 20.0;
    float q = length(vec2(max(0.0, cu), (bd - 0.42) * P)) ;
    if (cu > -6.0 && cu < 16.0 && (cu < 0.0 ? (bd - 0.42) * P < 26.0 : q < 16.0 && (bd - 0.42) * P < 16.0 - cu * 0.2)) {
      shade = 0.26 + (cu < -3.0 ? 0.32 : 0.0);
      lit = cu < -3.0 ? 0.6 : 0.0;
    }
  }
  // --- the belfry's shaft: a slender tower under the bell-cote, down into the dusk ---
  if (r.x >= ${f(shaftW)} && r.x < ${f(shaftE)} && bd >= 0.42) {
    shade = 0.28 + ashlar(r, 48.0);
    if (r.x < ${f(shaftW + 4)}) { shade = 0.62; lit = 0.8; }
    float su = (r.x - ${f((shaftW + shaftE) / 2)}) / P;
    float sh = mod((r.y - ${f(Y(B.deck))}) / P, 3.2);
    if (abs(su) < 0.1 && sh > 1.0 && sh < 2.0) shade = 0.08;
    if (bd > 0.42 && bd < 0.55) shade = 0.5;
  }
  // --- the bell-cote at the balcony's end: a gabled stone frame, the bell's arch, the door's wall ---
  float cu = (r.x - ${f(X((B.cote[0] + B.cote[1]) / 2))}) / P;
  float ch = (${f(Y(B.deck))} - r.y) / P;
  float cw = ${f((B.cote[1] - B.cote[0]) / 2)};
  float gable = 5.1 - abs(cu) * 0.9;
  if (abs(cu) < cw && ch >= 0.0 && ch < gable) {
    shade = 0.32 + ashlar(r, 36.0) * 0.8;
    if (cu < -cw + 0.06) { shade = 0.62; lit = 0.8; }
    if (gable - ch < 0.12) { shade = 0.6; lit = 0.7; }
    float at = arch(cu, 0.7, 3.25, 1.3);
    if (abs(cu) < 0.7 && ch > 2.0 && ch < at) return vec4(0.0);
    if (abs(cu) < 0.82 && ch > 1.92 && ch < at + 0.12) { shade = 0.5; lit = cu < 0.0 ? 0.5 : 0.0; }
    // a projecting string course under the bell's arch: a lit top, a shadow on the wall below it
    if (ch > 1.7 && ch < 1.82) { shade = ch > 1.8 ? 0.62 : ch > 1.73 ? 0.46 : 0.16; lit = ch > 1.8 ? 0.6 : 0.0; }
    // --- the sky door's opening, cut into the cote's masonry (the DOOR RULE): the leaf stands 3 px back
    // in a dark reveal (the head and the sun's side in shadow), quoined jambs, a stone lintel with a
    // lit bed and a shadowed soffit, a threshold slab, and the wall's shadow at its foot ---
    float du = (r.x - ${f(X(B.door))}) / P;
    float dpx = abs(du) * P;
    float hpx = ch * P;
    if (dpx < 28.0 && hpx < 112.0) return vec4(0.0);                         // the leaf's opening: the dusk beyond when it opens
    if (dpx < 31.0 && hpx < 115.0) {
      bool litSide = du > 0.0;                                                 // the east reveal faces the low sun
      shade = hpx >= 112.0 ? 0.08 : litSide ? 0.4 : 0.09;
      lit = litSide && hpx < 112.0 ? 0.35 : 0.0;
    } else if (dpx < 31.0 + 16.0 && hpx >= 115.0 && hpx < 132.0) {
      // the lintel: one stone, its bed lit on top, a dark soffit edge, a joint at each end
      shade = hpx > 130.0 ? 0.6 : hpx < 117.0 ? 0.14 : 0.44 + (hash2(floor(r / 3.0)) > 0.9 ? -0.06 : 0.0);
      lit = hpx > 130.0 ? 0.55 : 0.0;
      if (dpx > 31.0 + 15.0) shade = 0.14;
    } else if (hpx < 115.0 && dpx < 31.0 + (mod(floor(hpx / 28.0), 2.0) < 1.0 ? 15.0 : 9.0)) {
      // quoined jambs: long and short stones in turn, each with its own bed joint and a lit arris
      float jx = dpx - 31.0;
      float jy = mod(hpx, 28.0);
      float jw = mod(floor(hpx / 28.0), 2.0) < 1.0 ? 15.0 : 9.0;
      shade = 0.42 + (hash1(floor(hpx / 28.0) + (du > 0.0 ? 5.0 : 0.0)) - 0.5) * 0.08;
      if (jx < 1.5) { shade = 0.58; lit = du < 0.0 ? 0.0 : 0.5; }
      if (jy < 1.0 || jx > jw - 1.0) shade = 0.15;
    }
    if (hpx < 5.0 && dpx < 40.0) { shade = hpx > 3.5 ? 0.64 : 0.38; lit = hpx > 3.5 ? 0.5 : 0.0; }   // the threshold slab
    else if (hpx < 9.0 && dpx >= 40.0 && dpx < 60.0) shade -= 0.08;                                  // its shadow on the wall
  }
  // --- the balcony's balustrade (rail, turned balusters, plinth): behind the player, so she stands on the
  // deck in front of it, whole, her feet on the slab (it used to cut her at the thighs) ---
  float bh = (${f(Y(B.deck))} - r.y) / P;
  if (r.x > ${f(X(B.balcony[0]) + 4)} && r.x < ${f(X(B.cote[0]))} && bh > -0.05 && bh < 0.62) {
    if (bh > 0.52) { shade = bh > 0.58 ? 0.6 : 0.34; lit = bh > 0.58 ? 0.7 : 0.2; }
    else if (bh < 0.1) { shade = bh > 0.06 ? 0.5 : 0.3; lit = bh > 0.06 ? 0.4 : 0.0; }
    else {
      float bu = mod(r.x - ${f(X(B.balcony[0]))}, 18.0);
      float prof = 3.5 + 2.0 * sin((bh - 0.1) / 0.42 * 3.14159);
      if (abs(bu - 9.0) < prof * 0.6) { shade = 0.28 + (bu < 9.0 - prof * 0.3 ? 0.3 : 0.0); lit = bu < 9.0 - prof * 0.3 ? 0.55 : 0.0; }
    }
  }
  // ivy trailing over the balustrade and down the slab's face
  float tm = uTime * (1.0 - 0.8 * uReduced);
  if (r.x > ${f(X(B.balcony[0]) + 4)} && r.x < ${f(X(B.cote[0]))} && bh > -0.9 && bh < 0.6 && cluster(vec2(r.x / 33.0, 1.7), 0.55) > 0.5) {
    float dy = (0.6 - bh) * P;
    float vx = r.x - floor(sin(tm * 0.8 + r.x * 0.05) * 1.2 * dy / 60.0 + 0.5);
    float col = floor(vx / 4.0);
    float len = (10.0 + hash1(col * 2.3) * 70.0);
    float cx = mod(vx, 4.0) - 1.5 - floor(sin(dy * 0.17 + col) + 0.5);
    if (hash1(col) > 0.4 && dy < len) {
      if (abs(cx) < 0.6) return vec4(ramp(R_MOSS, 0.34 + hash1(floor(dy / 4.0) + col) * 0.1, p, 0.3), 1.0);
      if (abs(cx) < 1.6 && hash2(vec2(col, floor(dy / 3.0))) > 0.5) return vec4(ramp(R_MOSS, 0.5 + hash1(floor(dy / 3.0) + col * 3.0) * 0.16, p, 0.3), 1.0);
    }
  }
  // ivy up the arcade's piers and the chapel's east wall by the doorway, from the doorstep
  if (shade >= 0.0 && r.y < ${f(Y(B.floor))} && r.x < ${f(towerE)}) {
    float iv = ivy(r, ${f(X(459.25))}, ${f(Y(B.floor))}, 2.8, 30.0, 1.0);
    for (int k = 0; k < 3; k++) {
      if (iv < 0.0) break;
      iv = ivy(r, ${f(X(458.95))} + float(k) * ${f(3.4 * P)} + ${f(0.25 * P)}, ${f(Y(B.floor))}, 1.6 + float(k) * 0.5, 22.0, 3.0 + float(k) * 2.0);
    }
    // the stair's masonry stands in front of the tower: no ivy over it
    if (iv < 0.0 && !stairMass) shade = iv;
  }
  if (shade == -5.0) return vec4(ramp(R_MOSS, 0.62, p, 0.3), 1.0);
  if (shade == -3.0) return vec4(ramp(R_MOSS, 0.2 + hash1(floor(r.y / 3.0) + floor(r.x)) * 0.1, p, 0.3), 1.0);
  if (shade == -4.0) return vec4(ramp(R_MOSS, 0.4 + hash1(floor(r.y / 3.0) + floor(r.x / 2.0)) * 0.14, p, 0.3), 1.0);
  if (shade < 0.0) return vec4(0.0);`
  }
  // the tower in the last light: the foot of every wall in its own shadow (stepped, dithered), and warm
  // pools on the stone round the landing's candles and the cote's lantern
  float gh = (${f(Y(B.floor))} - r.y) / P;
  if (gh > -0.4 && gh < 2.4 && r.x < ${f(towerE)}) shade -= floor((1.0 - gh / 2.4) * 3.0 + bayer4(p) * 0.9) / 3.0 * 0.07;
  float warm = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 lc = i == 0 ? vec2(${f(X(468.6))}, ${f(Y(46.25))}) : i == 1 ? vec2(${f(X(B.cote[0] - 0.02))}, ${f(Y(B.deck + 2.0))}) : vec2(${f(X(B.eastDoor + 0.2))}, ${f(Y(B.floor + 0.1))});
    float ld = length((r - lc) * vec2(1.0, i == 2 ? 2.2 : 1.25)) / ${f(1.5 * P)};
    warm = max(warm, floor(max(0.0, 1.0 - ld) * 3.0 + bayer4(p + vec2(1.0, 3.0)) * 0.9) / 3.0);
  }
  vec3 c = lit > 0.25 ? ramp(R_WALLLIT, shade * 0.6 + lit * 0.35, p, 0.4) : ramp(R_WALL, shade, p, 0.4);
  if (warm > 0.0 && lit <= 0.25 && shade > 0.0) c = ramp(R_WALLLIT, shade * 0.55 + warm * 0.2, p, 0.4);
  return vec4(c, 1.0);
}`;
}

const BELFRY_H = Math.round((BELFRY.top - BELFRY.bottom) * P);
/** The camera row of the balcony's vista (the far world is composed there). */
const BELFRY_REF = Math.max(0, Math.round((BELFRY.top - BELFRY.vista.cy) * P) - 360);

function belfryDusk(world: boolean): DuskOpts {
  return {
    camRef: BELFRY_REF,
    world,
    horizon: 446,
    // the sun in the ring's hole stands in the open sky west of the balcony (it hid behind the bell-cote,
    // leaving only its halo, which read as ghost ovals over the lake through the arches below)
    sun: [400, 398],
    ringR: 150,
    spireX: 120,
    spireFade: [260, 460],
    lakeX: 400,
    lamps: [[230, 1], [470, 2], [620, 3]],
    colossi: true,
    crags: "cliff",
    camRange: [0, BELFRY_H - 720],
    lit: litShrines(),
  };
}

export const belfryScene: SceneDef = {
  title: "bell-stair",
  palette: OUTSIDE_PALETTE,
  fog: DUSK_FOG,
  span: () => (BELFRY.x1 - BELFRY.x0) * P - 1280,
  prelude: () => duskPrelude(belfryDusk(true)),
  build: (ctx: BuildCtx): LayerDef[] => {
    const L = duskLayers(ctx, belfryDusk(true));
    L.push({ kind: "glsl", name: "belfry", depth: 1, fog: 0, body: belfryBody(ctx, 0, false) });
    L.push(duskMotes(ctx, [0, 0, ctx.panWidth(1), BELFRY_H]));
    const front: WorldLayer = { kind: "glsl", name: "balustrade", depth: 1, fog: 0, body: belfryBody(ctx, 0, true), pass: "front" };
    L.push(front);
    return L;
  },
};

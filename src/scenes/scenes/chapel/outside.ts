// The chapel from outside (lane R-E): the porch (E2) and the bell stair and
// balcony (E4), both in the dusk of pilgrim-path/dusk.ts. Each is drawn in its
// room's own pixels from the room's layout (PORCH, BELFRY), so the doors, the
// sill with the dusty cup, the hook for the shawl, the stair treads and the
// balcony floor are exactly where the room's props and collision are.
//
// E2: the chapel's west front with a timber porch, the cliff top where the
// pilgrim path comes in, open sky and the valley to the west.
// E4: the bell tower at the chapel's east end: an outside stair in two flights
// up its flank, the balcony at the top with its balustrade (drawn in front of
// the player), and the bell-cote at the balcony's end where the chapel bell
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
};

function porchBody(): string {
  // a locked room narrower than the view: the camera sits 1 H left of the room (room x = screen x - 80)
  const X = (wx: number): number => Math.round((wx - PORCH.x0) * P);
  const floorY = Math.round((PORCH.top - PORCH.floor) * P);
  return /* glsl */ `
const float P = ${f(P)};
float arch(float u, float a, float sp, float k) {
  float R = a * k;
  float c = R - a;
  float x = abs(u) + c;
  return sp + sqrt(max(0.0, R * R - x * x));
}
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(s.x - 80.0, s.y);
  float hy = (${f(floorY)} - r.y) / P;
  float shade = -1.0;
  float lit = 0.0;
  // --- the cliff under the open ground (west of the porch) ---
  if (hy < 0.0) {
    if (r.x < ${f(X(PORCH.front))}) {
      shade = 0.26 + (vnoise(vec2(r.x / 13.0, r.y / 8.0)) - 0.5) * 0.16;
      if (hy > -0.06) { shade = 0.5; lit = 0.6; }
    } else return vec4(0.0);
  }
  // --- the west front ---
  if (shade < 0.0 && r.x >= ${f(X(PORCH.front))}) {
    float xH = r.x / P;
    float course = floor(hy / 0.4);
    float off = mod(course, 2.0) * 0.45;
    shade = 0.36 + (hash2(vec2(floor((xH + off) / 0.9), course)) - 0.5) * 0.1;
    if (fract(hy / 0.4) * 0.4 * P < 1.0 || fract((xH + off) / 0.9) * 0.9 * P < 1.0) shade -= 0.11;
    if (hy < 0.6) { shade -= 0.04; if (hy > 0.53) shade += 0.12; }
    // the corner of the front catches the low sun
    if (r.x < ${f(X(PORCH.front) + 4)}) { shade = 0.62; lit = 0.8; }
    else if (r.x < ${f(X(PORCH.front) + 0.35 * P)}) { lit = 0.35; }
    // the portal round the chapel doors: two orders and a hood
    float pu = (r.x - ${f(X(PORCH.door))}) / P;
    for (int k = 0; k < 2; k++) {
      float a = 1.85 - float(k) * 0.2;
      float top = arch(pu, a, 3.9, 1.35);
      if (abs(pu) < a && hy < top) {
        shade = 0.3 - float(k) * 0.06;
        if (abs(abs(pu) - a) * P < 1.5 || abs(hy - top) * P < 1.5) shade += 0.16;
      }
    }
    if (abs(pu) < 2.05 && abs(hy - arch(pu, 2.05, 3.9, 1.35) - 0.05) * P < 2.0) shade = 0.56;
    // a lancet by the door, candle light inside, the stone sill the cup stands on
    float wu = (r.x - ${f(X(PORCH.window))}) / P;
    float wtop = arch(wu, 0.3, 2.6, 1.3);
    if (abs(wu) < 0.3 && hy > ${f(PORCH.sill + 0.08)} && hy < wtop) {
      shade = -2.0;
    } else if (abs(wu) < 0.4 && hy > ${f(PORCH.sill + 0.02)} && hy < wtop + 0.1) shade = 0.5;
    if (abs(wu) < 0.46 && hy > ${f(PORCH.sill - 0.08)} && hy <= ${f(PORCH.sill + 0.02)}) { shade = hy > ${f(PORCH.sill - 0.02)} ? 0.64 : 0.4; lit = 0.3; }
    // a plain band where the plaque hangs, and a string course over the porch
    if (abs(hy - 5.6) < 0.07) shade = 0.52;
  }
  // --- the porch: an eave beam and its tiles, a stone column at its open corner ---
  float cu = (r.x - ${f(X(PORCH.column))}) / P;
  float eave = ${f(PORCH.eave - PORCH.floor)};
  if (r.x > ${f(X(PORCH.column) - 0.45 * P)} && hy > eave && hy < eave + 0.28) {
    shade = 0.24 + (hy > eave + 0.22 ? 0.3 : 0.0);
    lit = hy > eave + 0.22 ? 0.4 : 0.0;
    if (mod(r.x, 0.9 * P) < 1.5) shade -= 0.08;
  }
  if (r.x > ${f(X(PORCH.column) - 0.55 * P)} && hy >= eave + 0.28 && hy < eave + 1.05) {
    // tiles in rows, their lower edges lit
    float row = floor((hy - eave - 0.28) / 0.13);
    float tx = mod(r.x + mod(row, 2.0) * 7.0, 14.0);
    shade = 0.2 + (fract((hy - eave - 0.28) / 0.13) < 0.2 ? 0.2 : 0.0) + (tx < 1.0 ? -0.06 : 0.0);
    lit = fract((hy - eave - 0.28) / 0.13) < 0.2 ? 0.45 : 0.0;
  }
  if (abs(cu) < 0.2 && hy >= 0.0 && hy <= eave) {
    float cyl = cos(clamp(cu / 0.2, -1.0, 1.0) * 1.4);
    shade = 0.22 + cyl * 0.24 + (cu < -0.12 ? 0.3 : 0.0);
    lit = cu < -0.12 ? 0.8 : 0.0;
    if (hy < 0.3 || hy > eave - 0.3) { shade += 0.08; if (abs(cu) > 0.16) shade = -1.0; }
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
  if (shade < 0.0) return vec4(0.0);
  vec3 c = lit > 0.25 ? ramp(R_WALLLIT, shade * 0.6 + lit * 0.35, p, 0.4) : ramp(R_WALL, shade, p, 0.4);
  return vec4(c, 1.0);
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
    L.push({ kind: "glsl", name: "porch", depth: 1, fog: 0, body: porchBody() });
    L.push(duskMotes(ctx, [0, 200, ctx.W, 620]));
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
float ashlar(vec2 r, float bw) {
  float course = floor(r.y / 32.0);
  float off = mod(course, 2.0) * bw * 0.5;
  float sh = (hash2(vec2(floor((r.x + off) / bw), course)) - 0.5) * 0.1;
  if (mod(r.y, 32.0) < 1.0 || mod(r.x + off, bw) < 1.0) sh -= 0.1;
  return sh;
}
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
  // --- in front of the player: the balcony's balustrade (rail, turned balusters, plinth) ---
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
  if (shade < 0.0) return vec4(0.0);`
      : `
  // --- the stair tower at the chapel's east end: an open arcade at the stair's level (the dusk through it),
  // coursed stone above with lancets and a blind arcade under a lit crown ---
  bool stairMass = r.x < ${f(towerE)} && d >= 0.0 && r.y < ${f(Y(B.floor))} + 8.0;
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
    if (inBay && hh0 > -0.6 && hh0 < atop) return vec4(0.0);
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
  // --- the chapel's east wall and the arch you came out of, at the stair's foot ---
  if (r.x < ${f(X(458.95))} && r.y > ${f(Y(47.5))}) {
    shade = 0.24 + ashlar(r, 64.0);
    float u = (r.x - ${f(X(458.0))}) / P;
    if (r.y > ${f(Y(43.4))} && u < 0.72) shade = 0.08;
    if (r.x > ${f(X(458.95) - 3)}) { shade = 0.56; lit = 0.6; }
  }
  // --- flight one: treads over the tower's solid flank ---
  if (stairMass) {
    // the stair's own masonry (smaller stones, a lit string along its slope), in front of the tower
    shade = 0.34 + ashlar(r, 40.0) * 0.8;
    if (d < 3.0) { shade = 0.64; lit = 0.85; }
    else if (d < 6.0) shade = 0.44;
    else if (d < 16.0) { shade = 0.34; if (mod(r.x - ${f(f1x)}, 24.0) > 22.0) shade -= 0.1; }
  }
  // --- flight two: a flying stair on an arch, from the tower to the belfry, sky under it ---
  if (r.x >= ${f(towerE)} && r.x < ${f(X(B.balcony[0]))}) {
    float t = (r.x - ${f(towerE)}) / ${f(X(B.balcony[0]) - towerE)};
    float soffit = mix(${f(Y(45.35))}, ${f(Y(51.35))}, t);
    float intr = mix(${f(Y(43.4))}, ${f(Y(49.6))}, t) - sin(t * 3.14159) * ${f(1.05 * P)};
    if (d >= 0.0 && r.y < soffit) {
      shade = d < 3.0 ? 0.64 : d < 6.0 ? 0.44 : 0.3;
      lit = d < 3.0 ? 0.85 : 0.0;
      if (soffit - r.y < 3.0) { shade = 0.2; }
    } else if (d >= 0.0 && r.y >= soffit && r.y < intr) {
      // the spandrel over the arch, pierced by a small oculus
      shade = 0.26 + ashlar(r, 56.0) * 0.8;
      vec2 oc = vec2(mix(${f(towerE)}, ${f(X(B.balcony[0]))}, 0.34), mix(${f(Y(43.6))}, ${f(Y(49.0))}, 0.34));
      float od = length(r - oc);
      if (od < 18.0) return vec4(0.0);
      if (od < 23.0) { shade = 0.5; lit = r.x < oc.x ? 0.5 : 0.0; }
    } else if (d >= 0.0 && r.y >= intr && r.y < intr + 14.0) {
      // the arch ring's voussoirs, lit where they face the low sun
      shade = 0.4 + (mod(r.x, 26.0) < 1.5 ? -0.12 : 0.0) + (r.y < intr + 3.0 ? 0.18 : 0.0);
      lit = r.y > intr + 10.0 ? 0.6 : 0.0;
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
    if (abs(ch - 1.75) < 0.06) shade = 0.52;
  }
  if (shade < 0.0) return vec4(0.0);`
  }
  vec3 c = lit > 0.25 ? ramp(R_WALLLIT, shade * 0.6 + lit * 0.35, p, 0.4) : ramp(R_WALL, shade, p, 0.4);
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
    sun: [860, 398],
    ringR: 150,
    spireX: 120,
    lakeX: 860,
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

// pilgrim-path (lane R-E; WORLD-PLAN E1): the long exhale after the storm. A
// fallen segment of the ring leans from the spire down toward the far cliffs,
// and the pilgrims' stair runs down its curved back in flights with small
// landings, high above a violet valley at dusk. The sun is low in the west,
// in the far ring's hole; the colossi walk the horizon; the spire stands black
// behind you with the last of its storm tearing away.
//
// The segment itself (depth 1) is drawn from PATH, the same flight list the
// room's collision is built from (src/world/rooms/chapel/e1-pilgrim-path.ts),
// so every tread the player stands on is exactly a tread in the picture: hull
// plates with seams, a lit lip along the top, the carved stair, the missing
// panel with the ring bay under it, the rib that holds the bell, standing fins
// where the stained glass is set, a broken parapet along the far edge, hanging
// ribs under the band, and the cliff it comes to rest on by the chapel. The
// far world is dusk.ts. The default export is the /scenes/ preview.

import type { WorldLayer } from "../../world/backdrop/engine.ts";
import { f, type BuildCtx, type LayerDef, type SceneDef } from "./../engine/index.ts";
import { DUSK_FOG, DUSK_PALETTE, duskLayers, duskMotes, duskPrelude, litShrines, type DuskOpts } from "./pilgrim-path/dusk.ts";

const P = 80;

export type Seg =
  | { kind: "flat"; x: number; to: number; y: number }
  | { kind: "stairs"; x: number; y: number; n: number }
  | { kind: "gap"; x: number; to: number; y: number; bay: [number, number, number][] };

/**
 * The pilgrim path in world H (WORLD-PLAN section 3: E1 spans x 316..396 and drops from 84 to 40).
 * Stairs are the standard 0.3 H tread and 0.2 H rise, going down to the east.
 */
export const PATH = {
  x0: 316,
  x1: 396,
  top: 90,
  bottom: 35.5,
  segs: [
    { kind: "flat", x: 316.0, to: 316.6, y: 84 },
    { kind: "stairs", x: 316.6, y: 84, n: 24 },
    { kind: "flat", x: 323.8, to: 324.7, y: 79.2 },
    { kind: "stairs", x: 324.7, y: 79.2, n: 24 },
    { kind: "flat", x: 331.9, to: 333.1, y: 74.4 },
    { kind: "stairs", x: 333.1, y: 74.4, n: 10 },
    // the missing panel (1.1 H, a single jump) over the ring bay: its floor steps up to the far side
    { kind: "gap", x: 336.1, to: 337.2, y: 72.4, bay: [[336.1, 336.5, 70.6], [336.5, 336.8, 70.8], [336.8, 337.2, 71.0]] },
    { kind: "stairs", x: 337.2, y: 71.2, n: 12 },
    { kind: "flat", x: 340.8, to: 341.4, y: 68.8 },
    { kind: "stairs", x: 341.4, y: 68.8, n: 34 },
    { kind: "flat", x: 351.6, to: 358.0, y: 62.0 },
    { kind: "stairs", x: 358.0, y: 62.0, n: 20 },
    { kind: "flat", x: 364.0, to: 365.0, y: 58.0 },
    { kind: "stairs", x: 365.0, y: 58.0, n: 30 },
    { kind: "flat", x: 374.0, to: 375.2, y: 52.0 },
    { kind: "stairs", x: 375.2, y: 52.0, n: 30 },
    { kind: "flat", x: 384.2, to: 385.2, y: 46.0 },
    { kind: "stairs", x: 385.2, y: 46.0, n: 30 },
    { kind: "flat", x: 394.2, to: 396.0, y: 40.0 },
  ] as Seg[],
  /** The rib that holds the bell: its foot, and the tip of its arm the bell hangs from. */
  rib: { x: 340.95, foot: 68.8, tipX: 342.45, tipY: 72.2, ledges: [[340.55, 341.45, 69.7], [341.1, 341.95, 70.9]] as [number, number, number][] },
  /** Standing fins with stained glass set in them: [x, the landing's elevation]. */
  fins: [[324.25, 79.2], [332.5, 74.4], [364.5, 58.0], [374.6, 52.0]] as [number, number][],
  /** The camera: free, leaning downhill, feet at half the view. */
  anchor: 0.5,
};

const ROOM_H = Math.round((PATH.top - PATH.bottom) * P);
/** Room px of a world x / elevation. */
const RX = (wx: number): number => Math.round((wx - PATH.x0) * P);
const RY = (wy: number): number => Math.round((PATH.top - wy) * P);

/** The camera row where the far world is composed: standing on the shrine terrace. */
const CAM_REF = RY(62) - Math.round(PATH.anchor * 720);

/** GLSL: the ground's top at room x (px), or 1e9 where there is none; and a smooth line along the flights. */
function pathGlsl(): string {
  const lines: string[] = [];
  const pts: [number, number][] = [];
  for (const s of PATH.segs) {
    if (s.kind === "flat") {
      lines.push(`if (x < ${f(RX(s.to))}) return ${f(RY(s.y))};`);
      pts.push([RX(s.x), RY(s.y)]);
    } else if (s.kind === "stairs") {
      const x0 = RX(s.x), y0 = RY(s.y);
      lines.push(`if (x < ${f(x0 + 24 * s.n)}) return ${f(y0)} + (floor((x - ${f(x0)}) / 24.0) + 1.0) * 16.0;`);
      pts.push([x0, y0]);
    } else {
      for (const [, b, y] of s.bay) lines.push(`if (x < ${f(RX(b))}) return ${f(RY(y))};`);
      void s.to;
      pts.push([RX(s.x), RY(s.y)]);
    }
  }
  const last = PATH.segs[PATH.segs.length - 1]!;
  pts.push([RX(PATH.x1) + 400, RY(last.y)]);
  // the smooth line: through the start of each segment (the outer corners of the stair)
  const smooth = pts.map(([x, y], i) => {
    const n = pts[i + 1];
    if (!n) return "";
    return `if (x < ${f(n[0])}) return mix(${f(y)}, ${f(n[1])}, (x - ${f(x)}) / ${f(Math.max(1, n[0] - x))});`;
  });
  return /* glsl */ `
float topAt(float x) {
  if (x < 0.0) return ${f(RY(84))};
  ${lines.join("\n  ")}
  return ${f(RY(40))};
}
float lineAt(float x) {
  if (x < 0.0) return ${f(RY(84))};
  ${smooth.join("\n  ")}
  return ${f(RY(40))};
}`;
}

/** Shared GLSL for the segment and its front pass: the path, the fins, hashes for clusters. */
function commonGlsl(): string {
  const fins = PATH.fins.map(([x, y]) => `vec2(${f(RX(x))}, ${f(RY(y))})`);
  return /* glsl */ `
const float P = ${f(P)};
${pathGlsl()}
const vec2 FIN[${fins.length}] = vec2[${fins.length}](${fins.join(", ")});
// a value-noise cluster mask, quantised so clusters have hard authored edges
float cluster(vec2 q, float k) { return step(k, vnoise(q)); }
// the shrine terrace (no railing there: the shrine wall instead)
bool onTerrace(float x) { return x > ${f(RX(351.6))} && x < ${f(RX(358.0))}; }
// inside a two-centred pointed arch: half-width a, from base up to the apex, a head hd tall (all H)
bool inArch(float u, float hh, float a, float base, float apex, float hd) {
  if (abs(u) > a || hh < base || hh > apex) return false;
  float spring = apex - hd;
  if (hh <= spring) return true;
  float c = (hd * hd - a * a) / (2.0 * a);
  float R = a + c;
  vec2 q = vec2(u, hh - spring);
  return length(q - vec2(c, 0.0)) <= R && length(q + vec2(c, 0.0)) <= R;
}
`;
}

/**
 * The fallen ring segment at the player plane (depth 1), in room px. Read from the top:
 * the carved stair (one stone block per step: a lit nosing, a worn face, a dark joint at each riser),
 * a string course with moss gathered on it and dripping, two rows of hull plates leaning with the band
 * (bevelled: lit top and west edges toward the low sun, dark lower and east edges; an inset panel;
 * rivet rows; rust and wet streaks under the rivets; a few plates gone, the ribbed innards showing),
 * the keel beam with warm light bounced up from the valley on its underside, hanging ribs and vines
 * under the band. Above the path: a railing of posts and two rails (broken in places), the shrine
 * wall on the terrace (coursed limestone, a gabled centre with a lit niche behind the lantern,
 * pilasters, ivy and moss on the coping), the standing fins where the stained glass is set (their
 * glass openings are cut through, with a dark reveal round them), the curved rib that holds the bell
 * (plated, its climbing brackets carried on corbels), and the cliff by the chapel.
 */
function segmentBody(ctx: BuildCtx, yRoom: number): string {
  const hx = Math.round(ctx.span / 2);
  const rib = PATH.rib;
  const gap = PATH.segs.find((s) => s.kind === "gap")!;
  const shrine = { x0: RX(351.6), x1: RX(358.0), c: RX(356.65) };
  const brackets = rib.ledges
    .map(([a, b, y]) => {
      const bx0 = RX(a), bx1 = RX(b), by = RY(y);
      const cx = (bx0 + bx1) / 2, cw = (bx1 - bx0) * 0.45;
      return `
    if (shade < 0.0 && x > ${f(bx0)} && x < ${f(bx1)} && r.y >= ${f(by)} && r.y < ${f(by + 6)}) { shade = r.y < ${f(by + 2)} ? 0.64 : r.y > ${f(by + 4)} ? 0.16 : 0.32; lit = r.y < ${f(by + 2)} ? 0.6 : 0.0; }
    {
      float dd = r.y - ${f(by + 6)};
      float hw = ${f(cw)} * (1.0 - dd / 22.0);
      if (shade < 0.0 && dd >= 0.0 && dd < 22.0 && abs(x - ${f(cx)}) < hw) { bool w = x < ${f(cx)} - hw + 2.0; shade = w ? 0.5 : 0.22; lit = w ? 0.45 : 0.0; }
    }`;
    })
    .join("");
  return /* glsl */ `
${commonGlsl()}
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + ${f(yRoom)});
  float x = r.x;
  float top = topAt(x);
  float line = lineAt(x);
  float d = r.y - top;           // px below the walking surface
  float under = line + 1.75 * P; // the band's underside (smooth)
  float t = (r.y - line) / P;    // H below the smooth line
  float shade = -1.0;
  float lit = 0.0;               // share of warm sunset light (the hullLit ramp)
  float moss = -1.0;             // >= 0: a moss pixel at this shade
  float stone = -1.0;            // >= 0: the shrine wall's limestone at this shade
  float glow = 0.0;              // the shrine niche's lamp light
  // ================= the band under the stair =================
  if (d >= 0.0 && r.y < under) {
    float courseTop = line + 0.22 * P;
    if (r.y < courseTop) {
      // --- the carved stair: one block per step ---
      float east = step(0.5, abs(topAt(x + 1.0) - top));      // this column is a riser's joint
      float blk = hash1(top * 0.37 + floor(x / 96.0));
      shade = 0.42 + (blk - 0.5) * 0.08 - d / P * 0.12;
      if (d < 2.0) { shade = 0.7; lit = 0.9; }                // the nosing, catching the sky
      else if (d < 4.0) { shade = 0.52; lit = 0.25; }
      if (east > 0.5 && d >= 2.0) shade = 0.18;
      // wear and chips in clusters
      if (hash2(floor(vec2(x / 3.0, r.y / 3.0))) > 0.94) shade -= 0.09;
      if (d > 4.0 && hash2(floor(vec2(x / 2.0, r.y / 2.0)) + 7.0) > 0.97) shade += 0.08;
    } else if (t < 0.34) {
      // --- the string course ---
      float k = (t - 0.22) * P;
      shade = k < 1.5 ? 0.6 : k < 8.0 ? 0.34 + (hash1(floor(x / 30.0)) - 0.5) * 0.05 : 0.15;
      lit = k < 1.5 ? 0.55 : 0.0;
    } else if (t < 1.62) {
      // --- two rows of hull plates, leaning with the band ---
      bool rowB = t >= 1.0;
      float rt = rowB ? 1.0 : 0.34, rh = rowB ? 0.62 : 0.66;
      float v = (t - rt) / rh;
      float along = (x + (r.y - line) * 0.55) / (1.6 * P) + (rowB ? 0.5 : 0.0);
      float u = fract(along);
      float k = floor(along) + (rowB ? 101.0 : 0.0);
      float pw = 1.6 * P;
      float tone = (hash1(k) - 0.5) * 0.1;
      shade = 0.36 + tone + (1.0 - v) * 0.06;
      // mottled weathering in quantised clusters
      shade += (floor(vnoise(vec2(x / 13.0, r.y / 8.0) + k) * 4.0) / 4.0 - 0.5) * 0.07;
      // the inset panel (recessed: its top edge in shadow, its lower edge lit)
      if (u > 0.12 && u < 0.88 && v > 0.2 && v < 0.8) {
        shade -= 0.05;
        if ((v - 0.2) * rh * P < 1.5) shade -= 0.08;
        if ((0.8 - v) * rh * P < 1.5) { shade += 0.08; lit = 0.2; }
        if ((u - 0.12) * pw < 1.5) shade -= 0.05;
      }
      // bevels: lit top and west edges (sky, low sun), dark lower and east edges
      if (v * rh * P < 2.0) { shade = 0.56; lit = 0.45; }
      else if (u * pw < 2.0) { shade = 0.5; lit = 0.35; }
      else if ((1.0 - u) * pw < 1.5 || (1.0 - v) * rh * P < 1.5) shade = 0.14;
      // rivet rows
      bool rv = abs(v - 0.09) * rh * P < 1.0 || abs(v - 0.92) * rh * P < 1.0;
      if (rv && mod(x, 11.0) < 1.0 && u > 0.04 && u < 0.96) { shade = 0.62; lit = 0.3; }
      // rust and wet streaks running down from the upper rivets
      float sx = floor(x / 2.0);
      if (hash1(sx * 1.37 + k) > 0.965 && v > 0.12 && v < 0.2 + hash1(sx + k * 3.0) * 0.6 && u > 0.05 && u < 0.95) {
        shade -= 0.07;
        if (hash1(sx + 5.0) > 0.6) { shade = 0.24; lit = 0.27; }
      }
      // a few plates are gone: the ribbed innards show, in shadow
      if (hash1(k + 57.0) > 0.86 && v > 0.12 && v < 0.88 && u > 0.1 && u < 0.9) {
        shade = 0.1 + (mod(x, 10.0) < 2.0 ? 0.12 : 0.0) + (abs(v - 0.5) * rh * P < 1.0 ? 0.08 : 0.0);
        lit = 0.0;
        if ((v - 0.12) * rh * P < 2.0) shade = 0.06;
      }
    } else {
      // --- the keel beam: dark above, warm light bounced up from the valley under it ---
      float k = under - r.y;
      shade = k < 2.5 ? 0.42 : 0.24;
      lit = k < 2.5 ? 0.4 : 0.0;
      if (t < 1.65) shade = 0.12;
    }
    // moss gathered on the string course, hanging down over the plates in drips
    float cy = line + 0.22 * P;
    if (r.y >= cy - 1.0 && cluster(vec2(x / 38.0, 3.7), 0.56) > 0.5) {
      float drip = 2.0 + hash1(floor(x / 2.0) + 3.0) * 12.0 * vnoise(vec2(x / 9.0, 1.3));
      if (r.y - cy < drip) moss = r.y - cy < 1.5 ? 0.78 : 0.42 - (r.y - cy) / max(drip, 1.0) * 0.18 + hash1(floor(x / 3.0)) * 0.08;
    }
  }
  // ================= under the band: hanging ribs and vines =================
  if (shade < 0.0 && r.y >= under && r.y < under + 1.0 * P) {
    float dy = r.y - under;
    float u = mod(x + dy * 0.3, 4.8 * P) - 2.4 * P;
    float w = (0.14 - dy / P * 0.14) * P;
    if (abs(u) < w) { shade = 0.2 + (u < -w + 2.0 ? 0.32 : 0.0); lit = u < -w + 2.0 ? 0.5 : 0.0; }
    // vines in clusters, swaying a whole pixel at a time
    float tm = uTime * (1.0 - 0.8 * uReduced);
    float sway = floor(sin(tm * 0.7 + x * 0.013) * 1.6 * dy / 40.0 + 0.5);
    float vx = x - sway;
    float col = floor(vx / 4.0);
    float clump = vnoise(vec2(vx / 47.0, 9.1));
    float len = (6.0 + hash1(col * 1.7) * hash1(col * 3.1) * 64.0) * step(0.68, clump);
    float wob = floor(sin(dy * 0.15 + col * 2.0) * 1.2 + 0.5);
    float cx = mod(vx, 4.0) - 1.0 - wob;
    if (hash1(col) > 0.5 && dy < len) {
      if (abs(cx) < 0.5) moss = 0.28 + (1.0 - dy / max(len, 1.0)) * 0.14;
      else if (abs(cx) < 1.5 && hash2(vec2(col, floor(dy / 3.0))) > 0.55) moss = 0.44 + hash1(floor(dy / 3.0) + col) * 0.12;   // leaves
      if (dy > len - 2.0 && abs(cx) < 1.5) moss = 0.56;
    }
  }
  // ================= the cliff it rests on, by the chapel =================
  if (shade < 0.0 && moss < 0.0 && x > ${f(RX(388.5))} && r.y > top + 0.5 * P) {
    float edge = ${f(RX(388.5))} + (r.y - top) * 0.4 + (vnoise(vec2(r.y / 23.0, 1.0)) - 0.5) * 30.0;
    if (x > edge) {
      // bedded strata leaning down to the west, lit along their tops
      float bed = (r.y + (x - edge) * 0.25) / 22.0;
      float fb = fract(bed + vnoise(vec2(x / 40.0, floor(bed))) * 0.3);
      shade = 0.25 + (floor(vnoise(vec2(x / 17.0, r.y / 9.0)) * 4.0) / 4.0 - 0.5) * 0.14 - (r.y - top) / P * 0.015;
      if (fb > 0.93) shade = 0.1;                                    // a bedding joint
      else if (fb < 0.07) shade += 0.09;                             // the ledge under it catches the sky
      if (hash1(floor(x / 7.0) + floor(bed) * 3.1) > 0.88 && mod(x, 7.0) < 1.2) shade = 0.12;   // joints across the beds
      if (x - edge < 3.0) { shade = 0.52; lit = 0.5; }
    }
  }
  // ================= above the path =================
  if (shade < 0.0 && moss < 0.0 && d < 0.0) {
    float hh = (line - r.y) / P;                    // H above the smooth line
    if (onTerrace(x)) {
      // --- the shrine wall: coursed limestone, a gabled centre with the lamp's niche ---
      float wh = (top - r.y) / P;                   // H above the terrace
      float cu = (x - ${f(shrine.c)}) / P;
      float coping = 1.5;
      float gable = abs(cu) < 1.05 ? 1.5 + (1.05 - abs(cu)) * 1.15 : 0.0;
      float wallTop = max(coping, gable);
      float pl = x - ${f(shrine.x0 + 2)};
      float pr = ${f(shrine.x1 - 2)} - x;
      bool pilaster = (pl < 18.0 || pr < 18.0) && wh < 1.8;
      if (wh < wallTop + 0.1 || pilaster) {
        float course = floor(wh / 0.3);
        float off = mod(course, 2.0) * 22.0;
        float bx = floor((x + off) / 44.0);
        float fy = fract(wh / 0.3) * 0.3 * P, fx = mod(x + off, 44.0);
        stone = 0.36 + (hash2(vec2(bx, course)) - 0.5) * 0.1;
        // each block: a lit top bevel, a dark joint below and to the east
        if (fy > 0.3 * P - 2.0) stone += 0.1;
        if (fy < 1.0 || fx > 43.0) stone = 0.14;
        if (hash2(floor(vec2(x / 3.0, r.y / 3.0)) + 3.0) > 0.95) stone -= 0.08;
        // the plinth course and the dark line where the wall meets the floor
        if (wh < 0.22) { stone = 0.3 + (hash1(floor(x / 30.0)) - 0.5) * 0.06; if (wh > 0.19) stone = 0.46; }
        if (wh < 0.03) stone = 0.1;
        // copings: the straight run and the gable's two slopes, lit on top
        if (gable < coping && wh > coping - 0.1 && wh < coping + 0.1) stone = wh > coping + 0.04 ? 0.62 : wh > coping - 0.02 ? 0.42 : 0.16;
        if (gable >= coping && wh > gable - 0.12 && wh < gable + 0.1) stone = wh > gable - 0.01 ? 0.64 : wh > gable - 0.07 ? 0.44 : 0.18;
        if (wh > wallTop + 0.1) stone = -1.0;
        // pilasters at both ends, lit on their west faces, capped
        if (pilaster) {
          float pu = pl < 18.0 ? pl : 18.0 - pr;
          stone = 0.4 + (pu < 3.0 ? 0.18 : 0.0) + (pu > 15.0 ? -0.14 : 0.0);
          if (wh > 1.62) stone = wh > 1.72 ? 0.62 : 0.3;
          if (wh < 0.22) stone = 0.34;
        }
        // the niche: a pointed recess behind the lantern, its back lit warm by the flame
        float nw = 0.5;
        float at = 1.55 + sqrt(max(0.0, 0.42 - (abs(cu) + 0.15) * (abs(cu) + 0.15)));
        if (abs(cu) < nw && wh > 0.22 && wh < at) {
          vec2 fl = vec2(${f(RX(356.8))}, ${f(RY(62) - 1.15 * P)});
          float dd = length((r - fl) * vec2(1.0, 1.2)) / P;
          glow = floor(max(0.0, 1.0 - dd / 1.1) * 4.0) / 4.0;
          stone = 0.12 + glow * 0.3;
          if (abs(cu) > nw - 0.06 || at - wh < 0.05) stone = 0.08;   // the reveal's shadow
        } else if (abs(cu) < nw + 0.09 && wh > 0.2 && wh < at + 0.09) {
          stone = 0.54;                                               // the moulded surround
          if (cu > nw) stone = 0.3;
        }
        // moss and ivy on the copings, trailing down the west run
        if (stone >= 0.0) {
          float ct = gable >= coping ? gable : coping;
          float below = (ct + 0.1 - wh) * P;
          if (below > -1.0 && below < 6.0 && cluster(vec2(x / 26.0, 5.5), 0.52) > 0.5) moss = below < 1.5 ? 0.8 : 0.45;
          float strand = floor(x / 5.0);
          float il = (0.3 + hash1(strand * 2.3) * 0.9) * P * cluster(vec2(x / 31.0, 2.2), 0.42);
          float wob = floor(sin(below * 0.2 + strand) * 1.5);
          if (x < ${f(RX(354.2))} && hash1(strand) > 0.45 && below > 0.0 && below < il && abs(mod(x, 5.0) - 2.0 - wob) < 1.0) moss = 0.38 + hash1(floor(r.y / 3.0) + strand) * 0.2;
        }
      }
    } else {
      // --- a railing of posts with two rails, broken in places ---
      float broken = step(0.78, vnoise(vec2(x / 55.0, 7.0)));
      float post = mod(x + 8.0, 0.9 * P);
      if (broken < 0.5 && hh < 0.66 && post < 4.0) {
        shade = post < 1.0 ? 0.58 : post < 3.0 ? 0.28 : 0.16;
        lit = post < 1.0 ? 0.6 : 0.0;
        if (hh > 0.6) { shade = 0.5; lit = 0.4; }                // the post's cap
      }
      if (broken < 0.5 && abs(hh - 0.6) * P < 1.6) { bool up = r.y < line - 0.6 * P; shade = up ? 0.6 : 0.24; lit = up ? 0.55 : 0.0; }
      if (broken < 0.5 && abs(hh - 0.3) * P < 0.8) { shade = 0.3; lit = 0.2; }
    }
  }
  // ================= standing fins: upright hull plates holding the stained glass =================
  for (int i = 0; i < ${PATH.fins.length}; i++) {
    vec2 c = FIN[i];
    float u = (x - c.x) / P;
    float hh = (c.y - r.y) / P;                     // H above the landing
    float crest = 4.3 + 0.35 * sin(u * 3.1 + float(i)) - step(0.6, abs(u)) * 0.5;
    if (shade < 0.0 && moss < 0.0 && stone < 0.0 && d < 0.0 && abs(u) < 1.25 && hh > -0.2 && hh < crest) {
      // the glass opening is cut through (the window sits in it), with a dark reveal round it
      if (inArch(u, hh, 0.7, 0.92, 3.74, 1.0)) return vec4(0.0);
      float band = floor(hh / 0.8);
      shade = 0.3 + (hash1(band + float(i) * 7.0) - 0.5) * 0.08 + (floor(vnoise(vec2(x / 11.0, r.y / 7.0)) * 3.0) / 3.0 - 0.5) * 0.06;
      if (mod(hh, 0.8) * P < 1.0) shade = 0.14;
      if (mod(hh, 0.8) * P > 0.8 * P - 1.5) { shade += 0.1; lit = 0.2; }
      if (u < -1.12) { shade = 0.56; lit = 0.7; }    // the west edge in the sun
      else if (u > 1.18) shade = 0.12;
      if (crest - hh < 0.05) { shade = 0.6; lit = 0.6; }
      if (inArch(u, hh, 0.84, 0.8, 3.9, 1.08)) { shade = 0.06; lit = 0.0; }           // the reveal
      if (mod(x, 9.0) < 1.0 && abs(abs(u) - 1.0) < 0.03) shade = 0.5;                  // rivets
      if (hh < 0.6 && cluster(vec2(x / 17.0, float(i)), 0.45) > 0.5 && hh * P < 4.0 + hash1(floor(x / 2.0)) * 14.0) moss = 0.4 + hash1(floor(r.y / 2.0)) * 0.15;
    }
  }
  // ================= the rib that holds the bell =================
  {
    float fx = ${f(RX(rib.x))}, fy = ${f(RY(rib.foot))};
    float hh = (fy - r.y) / P;
    float bend = hh * hh * 0.06;                    // curves east as it rises
    float u = (x - fx) / P - bend;
    float w = 0.34 - hh * 0.03;
    if (shade < 0.0 && moss < 0.0 && d < 0.0 && hh > -0.2 && hh < 5.4 && abs(u) < w) {
      float seg = floor(hh / 0.55);
      shade = 0.24 + (hash1(seg + 31.0) - 0.5) * 0.08;
      if (mod(hh, 0.55) * P < 1.0) shade = 0.12;
      if (u < -w + 0.05) { shade = 0.6; lit = 0.75; }
      else if (u > w - 0.04) shade = 0.12;
      if (abs(u) < 0.03) shade -= 0.06;
      if (mod(r.y, 10.0) < 1.0 && abs(u + w * 0.55) < 0.02) shade = 0.5;
    }
    // the arm out to the bell
    vec2 a0 = vec2(fx + 0.7 * P, ${f(RY(rib.tipY + 0.25))}), a1 = vec2(${f(RX(rib.tipX))}, ${f(RY(rib.tipY))});
    vec2 ab = a1 - a0;
    float tt = clamp(dot(r - a0, ab) / dot(ab, ab), 0.0, 1.0);
    if (shade < 0.0 && length(r - a0 - ab * tt) < 4.0 + (1.0 - tt) * 3.0) { shade = 0.26 + (r.y < (a0 + ab * tt).y - 2.0 ? 0.32 : 0.0); lit = 0.4; }
    // the climbing brackets on its flank (the one-way ledges), each carried on a corbel
    ${brackets}
  }
  // the ring bay: the wall on its far side catches the sun
  if (d >= 0.0 && x > ${f(RX(gap.to) - 3)} && x < ${f(RX(gap.to))} && r.y < ${f(RY((gap as { y: number }).y) + 0.6 * P)}) { shade = 0.55; lit = 0.7; moss = -1.0; }
  if (moss >= 0.0) return vec4(ramp(R_MOSS, moss, p, 0.3), 1.0);
  if (stone >= 0.0) {
    vec3 c = glow > 0.0 ? ramp(R_WALLLIT, stone * 0.7 + glow * 0.4, p, 0.3) : ramp(R_WALL, stone, p, 0.35);
    return vec4(c, 1.0);
  }
  if (shade < 0.0) return vec4(0.0);
  vec3 c = lit > 0.25 ? ramp(R_HULLLIT, shade * 0.7 + lit * 0.3, p, 0.4) : ramp(R_HULL, shade, p, 0.4);
  return vec4(c, 1.0);
}`;
}

/**
 * In front of the player (the front pass): tufts of grass and a few flowers along the tread tops in
 * clusters, so the stair's hard top line breaks up where soil has gathered (short: never over her
 * knees). Lit on top; swaying a whole pixel at a time.
 */
function frontBody(ctx: BuildCtx, yRoom: number): string {
  const hx = Math.round(ctx.span / 2);
  return /* glsl */ `
${commonGlsl()}
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + ${f(yRoom)});
  float x = r.x;
  float top = topAt(x);
  float hh = top - r.y;                             // px above the tread
  if (hh < 0.0 || hh > 9.0) return vec4(0.0);
  if (x > ${f(RX(336.1))} && x < ${f(RX(337.2))}) return vec4(0.0);   // nothing over the gap
  float cl = vnoise(vec2(x / 21.0, 4.2));
  if (cl < 0.6) return vec4(0.0);
  float tm = uTime * (1.0 - 0.8 * uReduced);
  float lean = floor(sin(tm * 0.9 + x * 0.05) * 0.6 + 0.5) * step(4.0, hh);
  float bx = x - lean;
  float hb = hash1(floor(bx));
  float bh = (2.0 + hb * 7.0) * smoothstep(0.6, 0.8, cl);
  if (hash1(floor(bx) * 1.91) < 0.35 || hh >= bh) return vec4(0.0);
  if (hb > 0.94 && hh > bh - 1.5) return vec4(ramp(R_HULLLIT, 0.95, p, 0.0), 1.0);   // a flower
  float sh = hh > bh - 1.5 ? 0.82 : 0.32 + hh / 9.0 * 0.3;
  return vec4(ramp(R_MOSS, sh, p, 0.3), 1.0);
}`;
}

interface Opts {
  world: boolean;
  /** /scenes/ preview framing (room px of the view's top row). */
  yView: number;
}

function duskOpts(ctx: BuildCtx, o: Opts): DuskOpts {
  void ctx;
  return {
    camRef: CAM_REF,
    world: o.world,
    horizon: 478,
    sun: [178, 446],
    ringR: 132,
    spireX: 600,
    lakeX: 190,
    lamps: [[110, 1], [300, 2], [470, 3]],
    colossi: true,
    crags: "deep",
    camRange: [0, ROOM_H - 720],
    lit: litShrines(),
  };
}

const PALETTE: Record<string, string[]> = {
  ...DUSK_PALETTE,
  hull: ["#0d0b13", "#161320", "#211b2b", "#2e2638", "#3e3347", "#574656", "#7c6068"],
  hullLit: ["#3c2a34", "#6e4040", "#a8604c", "#d88a5e", "#f0b27a"],
  // moss and grass in the dusk: olive warming toward the sun, violet in the shade
  moss: ["#15131c", "#1c2120", "#262f24", "#36402a", "#4e5531", "#73703c", "#a08a4a"],
  // the shrine wall: the chapel's limestone (outside.ts), so the terrace rhymes with the chapel below
  wall: ["#140f15", "#1e161d", "#2a1f27", "#382a31", "#4a383c", "#624a48", "#86645a"],
  wallLit: ["#3a2830", "#5e3c3c", "#8e5a4c", "#bc7c5e", "#e0a474"],
};

function build(ctx: BuildCtx, o: Opts): LayerDef[] {
  const L = duskLayers(ctx, duskOpts(ctx, o));
  const yRoom = o.world ? 0 : o.yView;
  L.push({ kind: "glsl", name: "segment", depth: 1, fog: 0, body: segmentBody(ctx, yRoom) });
  const front: WorldLayer = { kind: "glsl", name: "path-grass", depth: 1, fog: 0, body: frontBody(ctx, yRoom), pass: "front" };
  L.push(front);
  const y0 = o.world ? 0 : 0;
  L.push(duskMotes(ctx, [0, y0, ctx.panWidth(1), o.world ? ROOM_H : 720]));
  return L;
}

/** The world's pilgrim path (E1): the segment in room pixels; the camera supplies the offsets. */
export const pilgrimScene: SceneDef = {
  title: "pilgrim-path",
  palette: PALETTE,
  fog: DUSK_FOG,
  span: () => (PATH.x1 - PATH.x0) * P - 1280,
  prelude: (ctx) => duskPrelude(duskOpts(ctx, { world: true, yView: 0 })),
  build: (ctx) => build(ctx, { world: true, yView: 0 }),
};

/** /scenes/ preview: the path around the shrine terrace. */
const preview: SceneDef = {
  ...pilgrimScene,
  prelude: (ctx) => duskPrelude(duskOpts(ctx, { world: false, yView: CAM_REF })),
  build: (ctx) => build(ctx, { world: false, yView: CAM_REF }),
};

export default preview;

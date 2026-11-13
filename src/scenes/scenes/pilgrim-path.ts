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

function segmentBody(ctx: BuildCtx, yRoom: number): string {
  const hx = Math.round(ctx.span / 2);
  const rib = PATH.rib;
  const fins = PATH.fins.map(([x, y]) => `vec2(${f(RX(x))}, ${f(RY(y))})`);
  const gap = PATH.segs.find((s) => s.kind === "gap")!;
  return /* glsl */ `
const float P = ${f(P)};
${pathGlsl()}
const vec2 FIN[${fins.length}] = vec2[${fins.length}](${fins.join(", ")});
vec4 layer(vec2 p, vec2 s) {
  vec2 r = vec2(p.x + ${f(hx)}, p.y + ${f(yRoom)});
  float x = r.x;
  float top = topAt(x);
  float line = lineAt(x);
  float d = r.y - top;           // px below the walking surface
  float under = line + 1.75 * P; // the band's underside (smooth)
  float shade = -1.0;
  float lit = 0.0;               // share of warm sunset light
  // --- the band: hull plates under the stair ---
  if (d >= 0.0 && r.y < under) {
    float along = (x + (r.y - line) * 0.55) / (1.6 * P);   // plate seams lean with the band
    float seam = fract(along);
    float k = floor(along);
    float depthIn = (r.y - line) / P;                     // H below the smooth line
    shade = 0.3 + (hash1(k) - 0.5) * 0.12 + mod(k, 2.0) * 0.03;
    // each plate: an inset panel with a lit west border and a dark east border
    float inset = step(0.1, seam) * step(seam, 0.92) * step(0.55, depthIn) * step(depthIn, 1.5);
    if (inset > 0.5) {
      shade -= 0.05;
      if (seam < 0.12) { shade += 0.1; lit = 0.3; }
      if (seam > 0.89) shade -= 0.06;
      if (abs(depthIn - 0.58) * P < 1.2) shade += 0.12;
    }
    if (abs(depthIn - 0.45) * P < 1.0) shade -= 0.1;      // a lip course under the treads
    if (abs(depthIn - 0.5) * P < 1.0) { shade += 0.12; lit = max(lit, 0.35); }
    if (seam * 1.6 * P < 1.0) shade -= 0.12;
    // rivets along the lip course
    if (abs(depthIn - 0.36) * P < 1.0 && mod(x, 12.0) < 1.0) shade += 0.12;
    // a few plates are gone: the ring's ribbed innards show, in shadow
    if (hash1(k + 57.0) > 0.86 && depthIn > 0.7 && depthIn < 1.45 && seam > 0.2 && seam < 0.8) {
      shade = 0.1 + (mod(x, 10.0) < 2.0 ? 0.1 : 0.0);
      lit = 0.0;
    }
    // weather streaks run down the plates, darker toward the keel
    shade -= step(0.74, vnoise(vec2(x / 5.0, floor(r.y / 40.0)))) * 0.05;
    shade -= smoothstep(1.2, 1.75, depthIn) * 0.1;
    if (under - r.y < 3.0) { shade = 0.36; lit = 0.3; }  // the keel's lit edge
    // the carved stair: a lit tread lip, worn stone below it
    if (d < 3.0) { shade = 0.64; lit = 0.9; }
    else if (d < 6.0) shade = 0.46;
    else if (d < 0.2 * P) { shade = 0.36; if (fract(x / 24.0) > 0.93) shade -= 0.1; }
  }
  // --- hanging ribs under the band, every few plates, lit on their west edge ---
  if (shade < 0.0 && r.y >= under && r.y < under + 0.9 * P) {
    float u = mod(x + (r.y - under) * 0.3, 4.8 * P) - 2.4 * P;
    float hang = (r.y - under) / P;
    float w = (0.14 - hang * 0.14) * P;
    if (abs(u) < w) { shade = 0.2 + (u < -w + 2.0 ? 0.3 : 0.0); lit = u < -w + 2.0 ? 0.5 : 0.0; }
  }
  // --- the cliff it rests on, by the chapel ---
  if (shade < 0.0 && x > ${f(RX(388.5))} && r.y > top + 0.5 * P) {
    float edge = ${f(RX(388.5))} + (r.y - top) * 0.4 + (vnoise(vec2(r.y / 23.0, 1.0)) - 0.5) * 30.0;
    if (x > edge) {
      shade = 0.24 + (vnoise(vec2(x / 17.0, r.y / 9.0)) - 0.5) * 0.14 + (x - edge < 3.0 ? 0.3 : 0.0);
      lit = x - edge < 3.0 ? 0.6 : 0.0;
    }
  }
  // --- behind the path: the terrace's shrine wall, and a light railing of posts elsewhere ---
  if (shade < 0.0 && d < 0.0) {
    float hh = (line - r.y) / P;                    // H above the smooth line
    bool terrace = x > ${f(RX(351.6))} && x < ${f(RX(358.0))};
    if (terrace) {
      if (hh < 1.25) {
        shade = 0.26 + (hash2(vec2(floor(x / 38.0 + floor(hh / 0.32) * 0.5), floor(hh / 0.32))) - 0.5) * 0.08;
        if (mod(hh, 0.32) * P < 1.0 || mod(x + floor(hh / 0.32) * 19.0, 38.0) < 1.0) shade -= 0.1;
        if (hh > 1.13) { shade = 0.5; lit = 0.6; }
      }
    } else {
      float broken = step(0.78, vnoise(vec2(x / 55.0, 7.0)));
      float post = mod(x, 0.9 * P);
      if (broken < 0.5 && hh < 0.62 && post < 3.0) { shade = 0.22 + (post < 1.0 ? 0.3 : 0.0); lit = post < 1.0 ? 0.5 : 0.0; }
      if (broken < 0.5 && abs(hh - 0.6) * P < 1.6) { shade = r.y < line - 0.6 * P ? 0.5 : 0.24; lit = 0.5; }
    }
  }
  // --- standing fins: upright plates of the hull where the stained glass is set ---
  for (int i = 0; i < ${fins.length}; i++) {
    vec2 c = FIN[i];
    float u = (x - c.x) / P;
    float hh = (c.y - r.y) / P;                     // H above the landing
    float crest = 4.3 + 0.35 * sin(u * 3.1 + float(i)) - step(0.6, abs(u)) * 0.5;
    if (shade < 0.0 && d < 0.0 && abs(u) < 1.25 && hh > -0.2 && hh < crest) {
      shade = 0.24 + (abs(u) > 1.12 ? 0.06 : 0.0) + (u < -1.1 ? 0.3 : 0.0);
      lit = u < -1.1 ? 0.7 : 0.0;
      if (abs(hh - 3.9) < 0.05 || abs(hh - 0.25) < 0.05) shade -= 0.08;
      if (mod(hh, 0.8) < 0.03) shade -= 0.05;
    }
  }
  // --- the rib that holds the bell: a curved fin rising from its landing, an arm to the east ---
  {
    float fx = ${f(RX(rib.x))}, fy = ${f(RY(rib.foot))};
    float hh = (fy - r.y) / P;
    float bend = hh * hh * 0.06;                    // curves east as it rises
    float u = (x - fx) / P - bend;
    float w = 0.34 - hh * 0.03;
    if (shade < 0.0 && d < 0.0 && hh > -0.2 && hh < 5.4 && abs(u) < w) {
      shade = 0.22 + (u < -w + 0.05 ? 0.34 : 0.0) + (abs(u) < 0.04 ? -0.05 : 0.0);
      lit = u < -w + 0.05 ? 0.75 : 0.0;
    }
    // the arm out to the bell
    vec2 a0 = vec2(fx + 0.7 * P, ${f(RY(rib.tipY + 0.25))}), a1 = vec2(${f(RX(rib.tipX))}, ${f(RY(rib.tipY))});
    vec2 ab = a1 - a0;
    float t = clamp(dot(r - a0, ab) / dot(ab, ab), 0.0, 1.0);
    if (shade < 0.0 && length(r - a0 - ab * t) < 4.0 + (1.0 - t) * 3.0) { shade = 0.26 + (r.y < (a0 + ab * t).y - 2.0 ? 0.3 : 0.0); lit = 0.4; }
    // the climbing brackets on its flank (the one-way ledges)
    ${rib.ledges.map(([a, b, y]) => `if (shade < 0.0 && x > ${f(RX(a))} && x < ${f(RX(b))} && r.y >= ${f(RY(y))} && r.y < ${f(RY(y) + 7)}) { shade = r.y < ${f(RY(y) + 2)} ? 0.6 : 0.28; lit = 0.5; }`).join("\n    ")}
  }
  // the ring bay: the wall on its far side catches the sun
  if (d >= 0.0 && x > ${f(RX(gap.to) - 3)} && x < ${f(RX(gap.to))} && r.y < ${f(RY((gap as { y: number }).y) + 0.6 * P)}) { shade = 0.55; lit = 0.7; }
  if (shade < 0.0) return vec4(0.0);
  vec3 c = lit > 0.25 ? ramp(R_HULLLIT, shade * 0.7 + lit * 0.3, p, 0.4) : ramp(R_HULL, shade, p, 0.4);
  return vec4(c, 1.0);
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
  hull: ["#0e0c14", "#15121c", "#1d1825", "#262030", "#322a3c", "#443849", "#5e4a56"],
  hullLit: ["#3c2a34", "#6e4040", "#a8604c", "#d88a5e", "#f0b27a"],
};

function build(ctx: BuildCtx, o: Opts): LayerDef[] {
  const L = duskLayers(ctx, duskOpts(ctx, o));
  const yRoom = o.world ? 0 : o.yView;
  L.push({ kind: "glsl", name: "segment", depth: 1, fog: 0, body: segmentBody(ctx, yRoom) });
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

// Gate Road (GDK A.3): a short ridge road from Kagami's shore to the hall's forecourt.
// Three framed gates 4 H apart, the viewing terrace, Pilgrims' Leap, then a tunnel of six
// close-set gates. Terrain grammar: a band, a thin natural ridge with open air beneath,
// carried on three karst pillars that stand on Shiraito's terraces far below.
//
// This section lays the road, its rock and its pillars; the gates, rails and the terrace
// furniture are their own pieces (art/painters/gates.ts) placed by the opening.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { threadGroups, type WallP } from "../../art/library/opening/wall.ts";
import { gateFeet, type GateP } from "../../art/library/opening/gates.ts";
import { DIAGONAL, GATE_XS, HALL_DOOR_X, JETTY_X1, LEAP_X, TERRACE_X0, TERRACE_X1, TUNNEL_XS, sampleCurve, yOn } from "./common.ts";

/** The road surface, world px, from the jetty's end to the hall door. */
export const ROAD = [
  JETTY_X1, h(62.0), h(110.6), h(61.9), h(112.6), h(61.4), GATE_XS[0]!, h(60.85), h(117), h(60.45), GATE_XS[1]!, h(60.1),
  h(121), h(59.8), GATE_XS[2]!, h(59.5), TERRACE_X0, h(59.3), TERRACE_X1, h(59.3),
  LEAP_X + h(0.6), h(59.3),
  TUNNEL_XS[0]!, h(59.15), TUNNEL_XS[1]!, h(58.85), TUNNEL_XS[2]!, h(58.55), TUNNEL_XS[3]!, h(58.25), TUNNEL_XS[4]!, h(57.95), TUNNEL_XS[5]!, h(57.65),
  h(143.4), h(57.3), HALL_DOOR_X + h(0.4), h(57.2),
];

/** Shiraito's diagonal (て's long stroke down and left), sampled from the map. */
export const DIAG = sampleCurve(DIAGONAL, 48);

export function gateRoad(b: WorldBuilder): void {
  const leap0 = LEAP_X - h(0.6), leap1 = LEAP_X + h(0.6);
  const roadA: number[] = [], roadC: number[] = [];
  for (let i = 0; i < ROAD.length; i += 2) {
    const x = ROAD[i]!, y = ROAD[i + 1]!;
    if (x < leap0) roadA.push(x, y);
    if (x > leap1) roadC.push(x, y);
  }
  roadA.push(leap0, h(59.3));
  roadC.unshift(leap1, h(59.3));
  const yL = h(59.3);
  // collision: two solid stretches of road, and Pilgrims' Leap as a plank you can drop through
  b.walk(roadA, { surface: "stone", depth: h(2.6), name: "gate-road" });
  b.walk([leap0, yL, leap1, yL], { surface: "wood", oneWay: true, name: "pilgrims-leap" });
  b.walk(roadC, { surface: "stone", depth: h(2.6), name: "gate-tunnel" });

  // the ridge's rock under the road (art: env-opening): a natural bridge of karst whose
  // underside arches between the three pillars that carry it, thick where it meets a pillar,
  // thin at mid-span, with a notch under the leap so the drop is clear
  const PILLARS = [h(120), h(136), h(152)];
  const under = (x: number): number => {
    let dp = Infinity;
    for (const px of [...PILLARS, JETTY_X1 - h(4)]) dp = Math.min(dp, Math.abs(x - px));
    const arch = Math.max(0, dp - h(2.0));
    return h(1.5) + h(5.5) * Math.exp(-arch / h(1.6)) + h(0.35) * Math.sin(x / h(2.3));
  };
  const band = (pts: number[], x0: number, x1: number): void => {
    const top: number[] = [];
    for (let i = 0; i < pts.length; i += 2) top.push(pts[i]!, pts[i + 1]!);
    const bottom: number[] = [];
    for (let x = x1; x >= x0; x -= h(0.6)) bottom.push(x, yOn(pts, x) + under(x));
    bottom.push(x0, yOn(pts, x0) + h(0.8));
    b.piece("play", "op.rock", 0, 0, { top, bottom, cap: "path", capH: 9, rough: 12, teeth: 0.7, veg: 0.7, fadeY: h(70), fadeH: h(8) }, { z: 0 });
  };
  band(roadA, JETTY_X1 - h(0.2), leap0);
  band(roadC, leap1, HALL_DOOR_X + h(0.4));
  // the leap's plank (its prayer-flag pole comes with the terrace furniture)
  b.piece("play", "op.plank", leap0 - h(0.3), yL, { w: leap1 - leap0 + h(0.6) }, { z: 2 });
  // Pilgrims' Leap: a bamboo pole lashed at the plank's end, prayer flags strung back to the rail
  b.sprite({ id: "leap-flags", plane: "play", kind: "op.flags", x: leap1 + h(0.15), y: yL, p: { h: 150, dx: -h(1.7), dy: 92, n: 8 }, frames: 4, fps: 6 });

  // three karst pillars carry the band, standing on Shiraito's terraces far below: towers, not
  // columns: each swells and pinches as it goes down, leans a little, has a shoulder or a
  // second mass fused to its flank, and its foot vanishes into the valley's mist
  ([[h(117.8), h(122.2), 1], [h(133.8), h(138.2), 2], [h(149.8), h(154.2), 3]] as const).forEach(([x0, x1, k]) => {
    const topY = yOn(ROAD, (x0 + x1) / 2) + h(2.0);
    const footY = yOn(DIAG, (x0 + x1) / 2) + h(1.2);
    const cx = (x0 + x1) / 2, half = (x1 - x0) / 2;
    const lean = (k % 2 ? 1 : -1) * h(0.35);
    const n = 18;
    const widthAt = (u: number, side: number): number => {
      // a waist a third of the way down, a swelling below it, a flared foot; each side its own
      const w = 1 - 0.22 * Math.exp(-(((u - 0.33) / 0.14) ** 2)) + 0.16 * Math.exp(-(((u - 0.62 - 0.05 * side) / 0.12) ** 2)) + 0.35 * Math.max(0, u - 0.8) / 0.2;
      return half * w * (1 + 0.07 * Math.sin(u * 17 + k * 2.1 + side * 1.7) + 0.05 * Math.sin(u * 41 + k));
    };
    // a fused second mass on one flank in the middle third (the second pillar right, the third left)
    const shoulder = (u: number): number => (k === 2 ? 1 : k === 3 ? -1 : 0) * h(0.9) * Math.max(0, 1 - Math.abs(u - 0.5) / 0.22);
    const at = (u: number): [number, number, number] => {
      const y = topY + h(1.2) + (footY - topY - h(1.2)) * u;
      const c = cx + lean * Math.sin(u * Math.PI * 0.9);
      return [c + widthAt(u, 1) + Math.max(0, shoulder(u)), c - widthAt(u, -1) + Math.min(0, shoulder(u)), y];
    };
    const top = [x0 - h(1.2), topY, x0 + half * 0.6, topY - h(0.4), x1 - half * 0.6, topY - h(0.3), x1 + h(1.2), topY];
    // the outline below the top: down the right side, back up the left
    const outlineBottom: number[] = [x1 + h(0.6), topY + h(0.7)];
    for (let i = 0; i <= n; i++) { const [r, , y] = at(i / n); outlineBottom.push(r, y); }
    for (let i = n; i >= 0; i--) { const [, l, y] = at(i / n); outlineBottom.push(l, y); }
    outlineBottom.push(x0 - h(0.6), topY + h(0.7));
    b.piece("play", "op.rock", 0, 0, { top, bottom: outlineBottom, cap: "bare", rough: 16, teeth: 0.3, veg: 0.6, shade: 0.25, fadeY: h(72), fadeH: h(9) }, { z: -1 });
  });

  // Shiraito's diagonal, laid rough for now (a band on a background cliff): the ground the
  // leap and the hall's back gallery drop you onto. Its art comes with Shiraito.
  const d0 = h(98), d1 = h(170);
  // (exactly from d0 to d1, so it meets Shiraito's village at its foot and the Prow Stair at its top)
  const diag: number[] = [d0, yOn(DIAG, d0)];
  for (let i = 0; i < DIAG.length; i += 2) if (DIAG[i]! > d0 + 4 && DIAG[i]! < d1 - 4) diag.push(DIAG[i]!, DIAG[i + 1]!);
  diag.push(d1, yOn(DIAG, d1));
  b.walk(diag, { surface: "earth", depth: h(4), name: "shiraito" });
  // (its rock ledges and plank walks are Shiraito's: sections/shiraito.ts)
  // its top end meets the Prow Stair, its foot Shiraito's village (sections/shiraito.ts)
  // (below the diagonal is Hoài Phố: sections/hoaipho.ts)

  // behind the band: Shiraito's great wall below the road's lip, a hundred thread falls
  // pouring down it into the valley's mist (P3; art: env-opening)
  const r3 = 0.62;
  const wallP: WallP = {
    w: h(90) * r3, h: h(90) * r3, falls: 1.7, fadeY: h(80) * r3, fadeH: h(10) * r3,
    // (east of the hall its top sinks away under the prow, out of the court's frames; it reaches
    // down to Shiraito's terraces, the valley's mist lying across it in the opening's frames)
    lip: [0, h(1.2) * r3, h(10) * r3, h(0.4) * r3, h(30) * r3, -h(0.4) * r3, h(50) * r3, 0, h(62) * r3, h(6) * r3, h(75) * r3, h(30) * r3, h(90) * r3, h(60) * r3],
  };
  const wall = b.piece("back", "op.wall", h(110.5), h(59.6), wallP as unknown as Record<string, unknown>, { z: 2 });
  // the threads flow (12 fps over four frames): one sprite per small group of them
  // (animated over the upper part, where the frames look; lower down the plate's threads go on)
  threadGroups(wallP, wall.seed, 120).forEach(([from, to], i) => {
    b.sprite({ id: `shiraito-flow-${i}`, plane: "back", kind: "op.falls", x: h(110.5), y: h(59.6), p: { ...wallP, wallSeed: wall.seed, from, to, flowH: Math.round(h(16) * r3) }, frames: 4, fps: 12 });
  });

  // mist fills Shiraito's valley below the road: one bank over the wall's foot, one over the
  // feet of the road's pillars and the plateau's cliff (the masses dissolve into it)
  b.mist({ x0: h(96), x1: h(200), y: h(73), half: h(6), rate: 0.66, after: "back", density: 0.9 });
  b.mist({ x0: h(40), x1: h(200), y: h(80), half: h(7), rate: 1, after: "play", density: 0.85 });

  // --- the gates: three framed gates, then the tunnel of six. Seen side-on (they stand across the
  // road): the near pillar on the front plane, in front of her (round 7; `key` keeps the two
  // pieces' weathering the same); the first and third ryōbu torii braced fore and aft by legs,
  // the paifang between them braced by raking struts; the tunnel's six plain and a little lower
  // (the fence leaves room for every foot the gates stand on: their pillars, legs and struts)
  const feet: [number, number][] = [];
  const gateAt = (x: number, p: GateP): void => {
    const y = yOn(ROAD, x);
    b.piece("play", "op.gate", x, y + 2, { ...p, key: x }, { z: 6 });
    b.piece("front", "op.gate", x, y + 2, { ...p, key: x, part: "front" }, { z: 1 });
    for (const [dx, hw] of gateFeet(p)) feet.push([x + dx, hw]);
  };
  gateAt(GATE_XS[0]!, { kind: "torii", span: h(3.2), h: h(4.7), legs: true });
  gateAt(GATE_XS[1]!, { kind: "paifang", span: h(3.4), h: h(5.6) });
  gateAt(GATE_XS[2]!, { kind: "torii", span: h(3.4), h: h(5.0), legs: true });
  // (the tunnel's gates tied into one way through by a rope of paper lanterns along the road's middle)
  TUNNEL_XS.forEach((x, i) => {
    const next = TUNNEL_XS[i + 1];
    gateAt(x, { kind: "torii", span: h(2.1), h: h(3.4), pw: 33, ...(next !== undefined ? { garland: [next - x, yOn(ROAD, next) - yOn(ROAD, x)] as [number, number] } : {}) });
  });

  // the road's fence in front of her (round 7: rough stone posts and a straw rope), everywhere
  // except at Pilgrims' Leap
  const railPts = (x0: number, x1: number): number[] => {
    const out: number[] = [];
    for (let x = x0; x <= x1; x += h(0.5)) out.push(x, yOn(ROAD, x) + 3);
    return out;
  };
  b.piece("front", "op.rail", 0, 0, { pts: railPts(h(110.4), leap0 - h(0.2)), h: 50, every: 56, breaks: feet }, { z: 0 });
  b.piece("front", "op.rail", 0, 0, { pts: railPts(leap1 + h(0.2), HALL_DOOR_X - h(2.2)), h: 50, every: 56, breaks: feet }, { z: 0 });
  // the viewing terrace (art: env-opening): a paved platform on a cut-stone face built out
  // over the rock; great cliff pines lean out over the valley from the road's lip (one before
  // the gates, one between the terrace and the tunnel); bamboo at the forecourt
  b.piece("play", "op.terrace", TERRACE_X0 - h(0.5), h(59.3), { w: TERRACE_X1 - TERRACE_X0 + h(1), depth: h(1.3) }, { z: 1 });
  b.piece("play", "op.pine", h(111.6), yOn(ROAD, h(111.6)) + 6, { h: 230, dir: -1 }, { z: 1 });
  b.piece("play", "op.pine", h(129.9), yOn(ROAD, h(129.9)) + 8, { h: 260, dir: 1 }, { z: 1 });
  b.sprite({ id: "forecourt-bamboo", plane: "play", kind: "op.bamboo", x: h(143.9), y: yOn(ROAD, h(143.9)) + 2, p: { w: 70, h: 420 }, frames: 4, fps: 4 });
  // the viewing terrace: a stone bench and two water barrels, Zhusha small at the rail
  b.piece("play", "op.bench", TERRACE_X0 + h(0.6), h(59.3), { w: h(1.5) }, { z: 3 });
  // (the barrels break: cosmetic, back when she has gone; a crate with a jar on it, the support rule's example)
  b.prop({ id: "terrace-barrel-1", kind: "op.barrel", p: { h: 40, ladle: true }, x: TERRACE_X1 - h(1.6), y: h(59.3), cls: "cosmetic", material: "wood", pieces: 5 });
  b.prop({ id: "terrace-barrel-2", kind: "op.barrel", p: { h: 36 }, x: TERRACE_X1 - h(1.1), y: h(59.3), cls: "cosmetic", material: "wood", pieces: 5 });
  b.prop({ id: "terrace-crate", kind: "crate", p: { w: 40, h: 34 }, x: TERRACE_X1 - h(0.5), y: h(59.3), cls: "cosmetic", material: "wood", pieces: 5 });
  b.prop({ id: "terrace-jar", kind: "jar", p: { h: 26, glaze: "celadon" }, x: TERRACE_X1 - h(0.5), y: h(59.3) - 34, cls: "cosmetic", material: "clay", on: "terrace-crate" });

  b.spawn({ id: "gate-road", x: GATE_XS[0]! - h(1.5), y: yOn(ROAD, GATE_XS[0]! - h(1.5)), facing: 1 });
  b.spawn({ id: "terrace", x: (TERRACE_X0 + TERRACE_X1) / 2, y: h(59.3), facing: 1 });
  b.spawn({ id: "hall-door", x: HALL_DOOR_X - h(1.2), y: yOn(ROAD, HALL_DOOR_X - h(1.2)), facing: 1 });
  b.spawn({ id: "shiraito-top", x: h(150), y: yOn(DIAG, h(150)), facing: -1 });
  b.place({ id: "gate-road", name: "Gate Road", x0: JETTY_X1, x1: HALL_DOOR_X, title: "place", spawn: "gate-road" });
}

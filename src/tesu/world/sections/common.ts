// Shared layout of the land: where the strokes run (from MAP-builder.svg, 1 map unit =
// 0.2 H) and the heights the opening is built on. Everything is in world px via h().

import { h } from "../../config.ts";

/** Kagami's lake surface and the jetty deck (the catch happens on it). */
export const LAKE_Y = h(62.6);
export const DECK_Y = h(62.0);
/** The catch: near the jetty's east end (map x 500). */
export const CATCH_X = h(100);
/** The jetty runs the lake's length; its east end meets the shore at map x 545. */
export const JETTY_X0 = h(44);
export const JETTY_X1 = h(109);
/** The lake on the play plane (3D x near the camera) and how it widens toward the far shore. */
export const LAKE_X0 = h(40);
export const LAKE_X1 = h(109);

/** Gate Road (A.3): the road's knots: three framed-gate spots 4 H apart, the terrace, then six to the hall (where gates stand: ROAD_GATE_XS). */
export const GATE_XS = [h(115), h(119), h(123)];
export const TERRACE_X0 = h(124);
export const TERRACE_X1 = h(128.6);
export const LEAP_X = h(129.2);
export const TUNNEL_XS = [h(130.4), h(132.8), h(135.2), h(137.6), h(140), h(142.4)];
/**
 * (torii-1021, Dex 10-21: "make the tori gates more sparse") The gates that stand on Gate Road: the
 * ryōbu torii at the road's threshold off the lake, the paifang, then the tunnel's first, third and
 * fifth tied by their lantern ropes (one way through). Gone: the second ryōbu at 123 H (a repeat of
 * the first, crowding the terrace), the tunnel's second, fourth and sixth (six close-set pillars read
 * as a picket, the sixth crowding the gate tower). Every knot above stays the road's shape.
 * art/library/opening/kerb.ts (ROAD_GATES) mirrors these.
 */
export const ROAD_GATE_XS = [GATE_XS[0]!, GATE_XS[1]!, TUNNEL_XS[0]!, TUNNEL_XS[2]!, TUNNEL_XS[4]!];
export const TUNNEL_GATE_XS = [TUNNEL_XS[0]!, TUNNEL_XS[2]!, TUNNEL_XS[4]!];
export const HALL_DOOR_X = h(146);

/** Cubic Bezier through the map's control points (map units), returning world px. */
export function bezier(p: number[], t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  const x = a * p[0]! + b * p[2]! + c * p[4]! + d * p[6]!;
  const y = a * p[1]! + b * p[3]! + c * p[5]! + d * p[7]!;
  return [h(x * 0.2), h(y * 0.2)];
}

/** て's diagonal (map): from the palace corner down and left to the harbour sweep. */
export const DIAGONAL = [930, 262, 820, 380, 580, 520, 480, 650];

/** Samples a curve into x-increasing [x, y, ...] world px points. */
export function sampleCurve(p: number[], n: number): number[] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) out.push(bezier(p, i / n));
  out.sort((a, b) => a[0] - b[0]);
  const flat: number[] = [];
  for (const [x, y] of out) {
    if (flat.length && x <= flat[flat.length - 2]!) continue;
    flat.push(x, y);
  }
  return flat;
}

/** y on a polyline at x (clamped at its ends). */
export function yOn(pts: number[], x: number): number {
  const n = pts.length;
  if (x <= pts[0]!) return pts[1]!;
  if (x >= pts[n - 2]!) return pts[n - 1]!;
  for (let i = 2; i < n; i += 2) {
    if (pts[i]! >= x) {
      const x0 = pts[i - 2]!, y0 = pts[i - 1]!, x1 = pts[i]!, y1 = pts[i + 1]!;
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[n - 1]!;
}

/** Shifts a polyline by (dx, dy). */
export function shift(pts: number[], dx: number, dy: number): number[] {
  return pts.map((v, i) => (i % 2 ? v + dy : v + dx));
}

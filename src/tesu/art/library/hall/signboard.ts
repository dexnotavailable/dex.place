// The register's signboard (hall loop round 4, W1-a: "the desk must out-read the gate in its own frame ... hang a
// big lacquer signboard for the register from the gallery fascia right over the desk, lit by the desk lantern"). A
// horizontal plaque in red lacquer, its two characters 登記 ("register") carved and gilded at 2 px strokes, a gold
// bead and a dark moulded frame, its top corners curled up into cloud ends; it hangs on two cords from the Long
// Gallery's soffit over Hanko's counter, and the counter's lamps light its underside and the gold.
//
// Coordinates: level-1 local px of the play plane; the anchor is on the floor under the board's west end (y up is
// negative).

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, SCREEN, LitField, clamp, cord, face, fbm, grain, mt, poly, rect, tn, type At } from "./kit.ts";
import { cloudScroll, hanzi, hanziSize } from "./signs.ts";

const H = 96;

export interface SignboardP {
  /** The board's width and height (px). */
  w: number;
  h: number;
  /** Its lower edge above the floor (px). */
  bottom: number;
  /** Where its cords are hooked: the soffit's height above the floor (px). */
  hang: number;
  /** The characters, left to right. */
  text: string;
  at?: At;
}

export const signboard = definePainter<SignboardP>("hall.signboard", {
  bounds(p) {
    return [-14, -p.hang - 2, p.w + 14, -p.bottom + 40];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 6);
    const W = p.w, y1 = -p.bottom, y0 = y1 - p.h;
    // the light comes from the counter's lamps below: the board's underside and lower moulding take it, the top
    // stays in the soffit's dark
    const side = clamp(lf.get(W / 2, y1).dx * 1.6, -1, 1);
    const lit = (lx: number, ly: number, ny = 0): number => face(lf.get(lx, ly).k, side, 0, ny);

    // --- the cords: red silk from the soffit to gold rings on the board's top, a little slack
    // (round 4, director: one bright red the whole 3 H drop read as two stray red lines down the bay) dark up in the
    // soffit's shade, oxblood down the drop, red only near the board where its lanterns reach
    for (const kx of [W * 0.16, W * 0.84]) {
      cord(c, kx, -p.hang, kx + (kx < W / 2 ? 2 : -2), y0 - 7, 0, (X, Y, t) => mt(M.verm, 0.12 + t * t * 0.55, X, Y, 0.25, 1, 0));
      rect(c, kx - 3, y0 - 8, kx + 4, y0 - 1, (X, Y, lx, ly) => (Math.abs(Math.hypot(lx - kx - 0.5, ly - y0 + 4.5) - 2.5) < 0.9 ? tn(M.gold, 0.3, X, Y, 0) : 0));
    }

    // --- the cap: a moulded lacquer cornice a step wider than the board, its ends turned up
    const cap = 6;
    poly(c, [-8, y0 - cap + 1, -5, y0 - cap - 2, W + 5, y0 - cap - 2, W + 8, y0 - cap + 1, W + 4, y0, -4, y0], (X, Y, lx, ly) => {
      const top = ly < y0 - cap;
      return mt(M.lacq, lit(lx, ly, top ? -0.9 : 0.2) * (top ? 0.9 : 0.5) + 0.05, X, Y, 0.1, 1);
    });
    rect(c, -4, y0 - 2, W + 4, y0, (X, Y, lx, ly) => mt(M.gold, lit(lx, ly, 0.4) * 0.8 + 0.12, X, Y, 0.05, 1));

    // --- the board: a red lacquer frame with a gold bead, the black lacquer field; the lower rail catching the lamps
    rect(c, 0, y0, W, y1, (X, Y, lx, ly) => {
      const e = Math.min(lx, W - lx, ly - y0, y1 - ly);
      const v = (ly - y0) / p.h;
      const wear = fbm(lx * 0.25, ly * 0.25, 821, 2) > 0.68;
      // the frame: vermilion, its bottom rail lit from below, its top rail in the cap's shadow
      if (e < 6) {
        const bottom = y1 - ly < 6;
        const k = bottom ? lit(lx, ly, 0.9) * 1.1 + 0.12 : lit(lx, ly, -0.3) * 0.55;
        return mt(M.verm, k + (e < 1 ? -0.15 : 0) + (wear ? 0.1 : 0) + grain(lx, ly, 827, e > 3 && (lx < 6 || lx > W - 6)) * 0.06, X, Y, 0.15, 1);
      }
      if (e < 8) return wear ? mt(M.wood, 0.5, X, Y, 0.1, 1) : mt(M.gold, lit(lx, ly, v > 0.5 ? 0.6 : -0.4) * 0.95 + 0.15, X, Y, 0.0, 1);
      // the field: black lacquer, a step warmer toward the lamps below, crazed with age, a faint diagonal sheen
      const sheen = Math.abs((lx - W * 0.22) - (ly - y0) * 0.7) < 3 ? 0.08 : 0;
      const craze = Math.abs(fbm(lx * 0.18, ly * 0.4, 823, 2) - 0.5) < 0.025 ? -0.05 : 0;
      return mt(M.lacq, lit(lx, ly) * 0.42 + v * 0.1 + sheen + craze + grain(lx, ly, 825, false) * 0.04, X, Y, 0.1, 1);
    });

    // --- the characters: carved and gilded, 3 px strokes, a dark lip where the cut falls away; gold leaf takes any
    // light there is, so they are the board's brightest marks
    const [gw, gh] = hanziSize(3);
    const gap = Math.round(0.16 * H);
    const n = [...p.text].length;
    const tw = n * gw + (n - 1) * gap;
    let tx = Math.round(W / 2 - tw / 2);
    const ty = Math.round((y0 + y1) / 2 - gh / 2);
    for (const ch of p.text) {
      hanzi(c, tx, ty, ch, 3,
        (X, Y, lx, ly) => {
          const q = (lx - tx) % 3, r = (ly - ty) % 3;
          // each 3 px stroke: a lit lower edge, a darker upper edge (the cut's walls), bright leaf between
          return mt(M.gold, lit(lx, ly, 0.3) * 0.55 + 0.52 + (r > 1.5 ? 0.12 : r < 0.8 ? -0.1 : 0) + (q < 0.8 ? -0.04 : 0), X, Y, 0.0, 1);
        },
        (X, Y) => tn(M.lacq, 1, X, Y, 0));
      tx += gw + gap;
    }
    // the hall's red seal low at the west end and a gold cloud scroll at each end of the field
    const sx = 10, sy = y1 - 17;
    rect(c, sx, sy, sx + 7, sy + 7, (X, Y, lx, ly) => (Math.abs(lx - sx - 3.5) < 1 && Math.abs(ly - sy - 3.5) < 1.6 ? P.paper[1]! : tn(P.red, 0.3, X, Y, 0)));
    cloudScroll(c, 14, y0 + 14, 3.5, 1, 5, (X, Y) => tn(M.gold, 0.3, X, Y, 0));
    cloudScroll(c, W - 14, y0 + 14, 3.5, -1, 5, (X, Y) => tn(M.gold, 0.3, X, Y, 0));

    // --- a lit paper lantern hung under each end of the board on a short cord (lights.ts SERVICE_LAMPS: they light the
    // board's lower rail and gold, the cabinet's top and the counter): a gold cap and foot, red ribs, the paper glowing
    // hottest at its middle, a red tassel
    for (const kx of [9, W - 9]) {
      const l0 = y1 + 7, l1 = l0 + 17, r = 7.5;
      cord(c, kx, y1, kx, l0 - 2, 0, (X, Y) => tn(P.red, 0.55, X, Y, 0));
      rect(c, kx - 4, l0 - 2, kx + 4, l0 + 1, (X, Y) => tn(M.gold, 0.35, X, Y, 0));
      rect(c, kx - r, l0, kx + r, l1, (X, Y, lx, ly) => {
        const u = (lx - kx) / r, v = (ly - l0) / (l1 - l0);
        const half = Math.sin(Math.max(0.05, Math.min(0.95, v)) * Math.PI);
        if (Math.abs(u) > 0.25 + 0.75 * half) return 0;
        if (Math.abs(Math.abs(u) - 0.45) < 0.09 || Math.abs(u) > 0.18 + 0.75 * half) return tn(P.red, 0.3 + Math.abs(u) * 0.2, X, Y, 0);
        return tn(SCREEN, clamp(Math.abs(u) * 0.55 + Math.abs(v - 0.55) * 0.5, 0, 1), X, Y, 0.45);
      });
      rect(c, kx - 3, l1, kx + 3, l1 + 2, (X, Y) => tn(M.gold, 0.4, X, Y, 0));
      rect(c, kx - 1, l1 + 2, kx + 1, l1 + 9, (X, Y, _lx, ly) => tn(P.red, ly < l1 + 4 ? 0.25 : 0.45, X, Y, 0));
    }
  },
});

// The hall's life overhead (the hall loop, round 1; Dex 10-12 "a little more chaotic than usual but
// still absolutely readable"): strings of folded paper cranes hung from the Long Gallery's underside,
// and cloth streamers let down from its beam at different lengths, all high over the walk line and
// the services (their lowest points stay well above her head and every service's top), so the
// room is busy where the eye rests and quiet where she walks.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, LitField, clamp, cord, face, hash, mt, poly, rect, tn, vnoise, type At, type Ramp } from "./kit.ts";

export interface LifeP {
  /** Width (px) of the stretch; the anchor is its west end at the gallery's underside. */
  w: number;
  /** What hangs: [local x, "cranes" | "streamer", length (px), seed]. */
  hang: [number, "cranes" | "streamer", number, number][];
  at?: At;
}

const CLOTH: Ramp[] = [M.verm, P.blue, M.gold, P.jade, P.paper];

export const life = definePainter<LifeP>("hall.life", {
  bounds(p) {
    let low = 0;
    for (const h of p.hang) low = Math.max(low, h[2]);
    return [-30, -4, p.w + 30, low + 24];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 14);
    for (const [x, kind, len, sd] of p.hang) {
      if (kind === "cranes") {
        // a string of cranes, each a small folded bird turned a little differently, the string
        // sagging between two hooks a hand apart
        const n = Math.max(4, Math.round(len / 13));
        cord(c, x, 0, x + 2, len, 0, P.umber[2]!);
        for (let i = 0; i < n; i++) {
          const y = 8 + (i * (len - 8)) / n;
          const tw = Math.sin(sd * 3 + i * 1.7);
          const cx = x + 1 + (i / n) * 2;
          const col: Ramp = hash(i, 1, sd) > 0.7 ? M.verm : hash(i, 2, sd) > 0.6 ? P.blue : M.paper;
          const k = clamp(lf.get(cx, y).k, 0.3, 1.1);
          // body and tail, the wings lifted (a flat V seen side-on), turned by tw
          const wing = 4 + Math.abs(tw) * 2;
          poly(c, [cx - 5, y + 1, cx + 5, y - 1, cx + 7, y - 4, cx + 3, y + 1, cx - 1, y + 3], (X, Y) => mt(col, face(k, -1) * 0.95, X, Y, 0.0, 0.85));
          poly(c, [cx - 2, y, cx + 2, y, cx + tw * 2, y - wing], (X, Y) => mt(col, face(k, -1, 0, -0.6) * 1.05, X, Y, 0.0, 0.85));
        }
        // a small tassel at the bottom
        rect(c, x + 1, len, x + 3, len + 6, (X, Y) => tn(M.verm, 0.4, X, Y, 0));
      } else {
        // a streamer: a long narrow strip of silk, let down from the beam, curling at its end
        const col = CLOTH[Math.floor(hash(sd, 1, 7) * CLOTH.length)]!;
        const w = 8 + Math.round(hash(sd, 2, 7) * 7);
        rect(c, x - w - 8, 0, x + w + 10, len + 8, (X, Y, lx, ly) => {
          const t = ly / len;
          if (t > 1.05) return 0;
          const sway = Math.sin(t * 4 + sd) * 3 * t + t * t * 4;
          const u = (lx - x - sway) / w;
          // the strip twists: its width narrows where it turns, the turned side darker
          const twist = Math.cos(t * 2.6 + sd * 2);
          const hw = 0.6 + 0.4 * Math.abs(twist);
          if (Math.abs(u) > hw) return 0;
          // a swallowtail end
          if (t > 0.94 && Math.abs(u) < (t - 0.94) * 8 * hw) return 0;
          const k = clamp(lf.get(lx, ly).k, 0.25, 1.1);
          const back = twist < 0 ? 0.28 : 0;
          const edge = Math.abs(u) > hw - 0.18 ? 0.1 : 0;
          const band = Math.abs(((t * 5) % 1) - 0.5) < 0.04 ? -0.15 : 0;
          return mt(col, face(k, -1, u * 0.5, 0) * (0.85 - back) - edge - band + vnoise(lx * 0.3, ly * 0.1, sd) * 0.05, X, Y, 0.05, 0.9);
        });
        rect(c, x - w - 1, -2, x + w + 1, 3, (X, Y) => tn(M.gold, 0.45, X, Y, 0));
      }
    }
  },
});

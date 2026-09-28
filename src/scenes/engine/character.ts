// Stand-in for the player character: a dark silhouette at 136 px (skull top to
// sole) with a glaive 1.35 H long, proportions from docs/character/DESIGN.md.
// Only there to judge readability and scale against a scene; it is not the
// character design. Built as a Pix so it is lit and fogged like everything else.

import { Pix } from "./pix.ts";

export const STANDIN_HEIGHT = 136;

export interface Standin {
  pix: Pix;
  /** Pixel in pix that sits on the ground point (feet centre, one below the soles). */
  ax: number;
  ay: number;
}

export function buildStandin(row: number, rimDir: [number, number] = [1, -1], facing: 1 | -1 = 1): Standin {
  const W = 64;
  const Hh = 192;
  const pix = new Pix(W, Hh);
  const top = Hh - STANDIN_HEIGHT; // skull top
  const Y = (y: number): number => top + (y * STANDIN_HEIGHT) / 136;
  const body = { row, shade: 0.08 };
  const hair = { row, shade: 0.16 };
  const cloth = { row, shade: 0.12 };
  const boot = { row, shade: 0.04 };
  const P = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [x, Y(y)]);

  // hair behind the back, gathered near the end at mid-thigh
  pix.poly(P([[17, 7], [24, 2], [27, 14], [23, 30], [21, 46], [20, 62], [18, 72], [17, 79], [14, 73], [13, 58], [13, 42], [14, 24]]), hair);
  // back sleeve
  pix.poly(P([[20, 28], [17, 44], [12, 62], [21, 66], [23, 48], [23, 30]]), cloth);
  // back leg
  pix.poly(P([[20, 72], [27, 73], [26, 96], [24, 116], [24, 131], [28, 135], [19, 135], [20, 116], [20, 96]]), body);
  pix.poly(P([[19, 118], [25, 118], [24, 131], [28, 135], [19, 135]]), boot);
  // torso
  pix.poly(P([[21, 24], [34, 24], [33, 42], [31, 56], [33, 64], [34, 73], [19, 73], [20, 63], [21, 55], [20, 40]]), body);
  // head, neck, veil
  pix.disc(27.5, Y(10.5), 10.5, body);
  pix.rect(24, Y(19), 6, 6, body);
  pix.poly(P([[16, 5], [22, 1], [22, 22], [15, 29]]), hair);
  // front leg (weight leg)
  pix.poly(P([[26, 71], [33, 71], [34, 96], [33, 116], [34, 131], [38, 135], [28, 135], [28, 116], [27, 96]]), body);
  pix.poly(P([[28, 118], [34, 118], [34, 131], [38, 135], [28, 135]]), boot);
  // tabard (front flap)
  pix.poly(P([[29, 64], [35, 64], [37, 104], [33, 110], [30, 104]]), cloth);
  // front bell sleeve, hand on the haft
  pix.poly(P([[31, 26], [36, 28], [41, 44], [47, 56], [45, 64], [35, 66], [33, 54], [30, 40]]), cloth);
  pix.disc(46.5, Y(57), 2.6, body);

  // glaive: haft, rose disc with cross arms, lancet blade
  const hx = 46;
  const haft = { row, shade: 0.1 };
  pix.rect(hx, Y(-25), 2, Y(136) - Y(-25), haft);
  pix.disc(hx + 1, Y(-17), 4.6, haft);
  pix.rect(hx - 5, Y(-18), 12, 2, haft);
  pix.poly(P([[hx + 1, -48], [hx + 4.5, -35], [hx + 2.5, -24], [hx - 0.5, -24], [hx - 2.5, -35]]), haft);

  // 1 px rim toward the light, softer second pixel
  pix.rim(Math.sign(rimDir[0]), Math.sign(rimDir[1]), 0.8, 0.22);

  if (facing === -1) {
    const d = pix.data;
    for (let y = 0; y < Hh; y++)
      for (let x = 0; x < W / 2; x++) {
        const a = (y * W + x) * 4;
        const b = (y * W + (W - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) {
          const t = d[a + k]!;
          d[a + k] = d[b + k]!;
          d[b + k] = t;
        }
      }
    return { pix, ax: W - 1 - 30, ay: Hh };
  }
  return { pix, ax: 30, ay: Hh };
}

// C3 Lift Foot backdrop: a waiting room at the foot of the spire's stem.
// Cold tile and plaster under fluorescent strips; one long window on the left
// looks back out at the amber hollow (the amber-hollow scene's far layers,
// seen through the glass); on the right the spire's stem comes down through
// the ceiling and into the floor, black and ribbed, with the lift shaft's
// mouth cut into it (the gate and the car are pixel props in front).
//
// The room is exactly one view tall: the camera's only framing is the
// scene's own, so the far layers need no lift; the room-aligned layers are
// authored in room px.

import amber from "../../../../scenes/scenes/amber-hollow.ts";
import { Pix, fbm1, hashInt, type BuildCtx, type LayerDef, type SceneDef } from "../../../../scenes/engine/index.ts";
import { lifted } from "./shift.ts";
import { putter } from "./grammar.ts";

export interface LiftFootOpts {
  roomW: number;
  roomH: number;
  ref: number;
  floor: number;
  x0: number;
  H: number;
  /** The window (world x range in H; top and bottom as heights above the floor in H). */
  window: [number, number, number, number];
  /** The stem's left edge and the shaft mouth (world x range, height in H). */
  stem: number;
  shaft: [number, number, number];
}

export function liftFootScene(o: LiftFootOpts): SceneDef {
  const palette = {
    ...amber.palette,
    tile: ["#0e1213", "#161c1d", "#20282a", "#2c3738", "#3c4a4a", "#52625f", "#6e7e79"],
    plaster: ["#121515", "#1b2020", "#262c2b", "#333a38", "#434b48", "#566058"],
    stem: ["#040406", "#08080c", "#0e0e14", "#16161e", "#20202a", "#2e2e3a", "#44445a"],
    stemlit: ["#1a1410", "#3a2616", "#6a4020", "#a0622c"],
  };
  return lifted(amber, {
    title: "hollow: lift foot",
    ref: o.ref,
    vertical: 1,
    palette,
    // through the window only the hollow itself: no near structures of the scene's own
    drop: ["gantry", "figure", "foreground", "overhang", "lamp-glow", "foundry", "near-sign", "bridge", "pylon-glow", "smoke-near", "embers-near"],
    compose: (ctx, ls) => [...ls, ...room(ctx, o)],
  });
}

function room(ctx: BuildCtx, o: LiftFootOpts): LayerDef[] {
  const { H } = ctx;
  const span = ctx.span;
  const R = (n: string): number => ctx.row(n);
  const rx = (wx: number): number => (wx - o.x0) * o.H;
  const up = (h: number): number => o.floor - h * o.H;
  const pix = new Pix(o.roomW + 16, H + 8);
  const ox = -Math.round(span / 2) - 8;
  const put = putter(pix, ox + Math.round(span / 2), 0, R("tile"));
  const [w0, w1, wb, wt] = o.window;
  const winX0 = rx(w0), winX1 = rx(w1), winY0 = up(wt), winY1 = up(wb);
  const stemX = rx(o.stem);
  const wain = up(1.15);
  const ceil = up(7.2);
  for (let x = -8; x < o.roomW + 8; x++) {
    for (let y = 0; y < H + 8; y++) {
      if (x >= stemX) continue; // the stem is drawn below
      // the window: open to the far layers, with a frame and mullions
      if (x >= winX0 && x < winX1 && y >= winY0 && y < winY1) {
        const fx = x - winX0, fy = y - winY0;
        const frame = fx < 6 || winX1 - x <= 6 || fy < 6 || winY1 - y <= 6 || (fx - 6) % 96 < 4 || Math.abs(y - (winY0 + (winY1 - winY0) * 0.38)) < 2;
        if (frame) put(x, y, fx < 6 || fy < 6 ? 0.36 : 0.24, R("plaster"));
        continue;
      }
      let s: number;
      let row = R("tile");
      if (y < ceil) {
        // the ceiling slab and its underside
        s = y > ceil - 6 ? 0.3 : 0.12 + ((x + y) % 40 === 0 ? 0.02 : 0);
        row = R("plaster");
      } else if (y >= wain) {
        // tiled wainscot: small square tiles, a dark grout
        const tx = x % 20, ty = (y - wain) % 20;
        s = tx < 2 || ty < 2 ? 0.14 : 0.28 + (hashInt(Math.floor(x / 20), Math.floor((y - wain) / 20), 5) - 0.5) * 0.06;
        if (y - wain < 4) s = 0.4;
      } else {
        // plaster above, stained where the ceiling leaks
        s = 0.22 + (fbm1(x / 70 + y / 110, 3, 3) - 0.5) * 0.08 - (y < ceil + 30 ? 0.04 : 0);
        row = R("plaster");
      }
      put(x, y, s, row);
    }
  }
  // the stem: a ribbed black cylinder face, rimmed amber on its window side, the shaft mouth
  const [s0, s1, sh] = o.shaft;
  const mx0 = rx(s0), mx1 = rx(s1), my = up(sh);
  const sw = o.roomW + 8 - stemX;
  for (let x = stemX; x < o.roomW + 8; x++) {
    // a cylinder seen side on: dark at the far edge, a broad dim highlight a third of the way in,
    // an amber rim on the window side; flutes down its length
    const u = (x - stemX) / sw;
    const round = Math.sin(Math.min(1, u * 1.35 + 0.05) * Math.PI);
    const flute = (x - stemX) % 26;
    for (let y = 0; y < H + 8; y++) {
      if (x >= mx0 && x < mx1 && y >= my && y < o.floor) continue; // the shaft: the car shows here
      let s = 0.08 + 0.2 * round;
      let row = R("stem");
      if (flute < 2) s -= 0.06;
      else if (flute === 2) s += 0.08;
      if (x - stemX < 3) {
        s = 0.55;
        row = R("stemlit");
      } else if (x - stemX < 10) {
        s = 0.3 - (x - stemX) * 0.02;
        row = R("stemlit");
      }
      // collars where it passes through the ceiling and into the floor
      const collar = (y > ceil - 26 && y < ceil + 18) || (y > o.floor - 22 && y < o.floor + 4);
      if (collar) {
        s = 0.22 + 0.2 * round + (y === ceil - 26 || y === o.floor - 22 ? 0.2 : 0);
        row = R("stem");
      }
      // bands every 2 H with bolts
      const band = (o.floor - y + 4000) % (o.H * 2);
      if (band < 5) s += band === 0 ? 0.16 : 0.07;
      if (band === 2 && flute === 13) s += 0.25;
      // the mouth's frame: a heavy lit lintel and jambs
      const near = x >= mx0 - 22 && x < mx1 + 22 && y >= my - 22 && y < o.floor;
      if (near) {
        s = 0.26 + (y < my ? 0.06 : 0) + ((x - mx0 + 22) % 24 === 0 ? -0.08 : 0);
        if (y === my - 22) s = 0.46;
        row = R("stem");
      }
      put(x, y, s, row);
    }
  }
  return [{ kind: "pix", name: "room", depth: 1, fog: 0, pix, x: ox, y: 0, twinkle: 0, dither: 0 }];
}

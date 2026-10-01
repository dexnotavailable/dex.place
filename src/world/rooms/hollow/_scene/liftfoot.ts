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
import { bumper, pool, wallTex } from "./houses.ts";

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
  /** The ceiling's underside (H above the floor), the tubes (world x). */
  ceiling: number;
  tubes: number[];
  /** The west doorway back to the market (world x range, height in H). */
  doorway: [number, number, number];
  /** A vent grille and a notice board (world x), the arrow sign on the stem (world x, H). */
  vent: number;
  notice: number;
  sign: [number, number];
}

export function liftFootScene(o: LiftFootOpts): SceneDef {
  const palette = {
    ...amber.palette,
    tile: ["#0e1213", "#161c1d", "#20282a", "#2c3738", "#3c4a4a", "#52625f", "#6e7e79"],
    plaster: ["#121515", "#1b2020", "#262c2b", "#333a38", "#434b48", "#566058"],
    stem: ["#040406", "#08080c", "#0e0e14", "#16161e", "#20202a", "#2e2e3a", "#44445a"],
    stemlit: ["#1a1410", "#3a2616", "#6a4020", "#a0622c", "#d08a3c"],
    tube: ["#5a6a68", "#a8bab4", "#e6f4ee"],
    wood: ["#140e0b", "#21160f", "#312116", "#452f1f", "#5e422b"],
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
  const bump = bumper(pix, ox + Math.round(span / 2), 0);
  const [w0, w1, wb, wt] = o.window;
  const winX0 = rx(w0), winX1 = rx(w1), winY0 = up(wt), winY1 = up(wb);
  const stemX = rx(o.stem);
  const wain = up(1.15);
  const ceil = up(o.ceiling);
  const [d0, d1, dh] = o.doorway;
  const doorX0 = rx(d0), doorX1 = rx(d1), doorY = up(dh);
  const reveal = 10;
  const inWindow = (x: number, y: number): boolean => x >= winX0 && x < winX1 && y >= winY0 && y < winY1;
  const inDoor = (x: number, y: number): boolean => x >= doorX0 && x < doorX1 && y >= doorY && y < o.floor;
  for (let x = -8; x < o.roomW + 8; x++) {
    if (x >= stemX) continue; // the stem is drawn below
    for (let y = 0; y < H + 8; y++) {
      // the window and the west doorway are open: the hollow (the scene's far layers) shows through
      if (inWindow(x, y) || inDoor(x, y)) continue;
      let s: number;
      let row = R("tile");
      if (y < ceil - 30) {
        // the hollow's structure over the waiting room's ceiling: dark girders
        s = 0.1 + ((x % 96) < 10 ? 0.06 : 0) + (y % 40 < 4 ? 0.04 : 0);
        row = R("stem");
      } else if (y < ceil) {
        // the ceiling slab: lit along its underside by the tubes, a conduit under it
        const ly = y - (ceil - 30);
        s = ly > 26 ? 0.44 - (29 - ly) * 0.05 : ly < 2 ? 0.2 : 0.16 + wallTex("stone", x, y, 5) * 0.4;
        row = R("plaster");
      } else if (y >= wain) {
        // tiled wainscot: square glazed tiles, a dark grout, a bullnose row on top, a skirting
        const tx = x % 20, ty = (y - wain) % 20;
        s = tx < 2 || ty < 2 ? 0.14 : 0.3 + (hashInt(Math.floor(x / 20), Math.floor((y - wain) / 20), 5) - 0.5) * 0.07 + (tx === 2 || ty === 2 ? 0.06 : 0);
        if (y - wain < 5) s = y - wain === 0 ? 0.5 : y - wain < 3 ? 0.4 : 0.18;
        if (y > o.floor - 10) s = 0.18 + (y === o.floor - 10 ? 0.12 : 0);
        // a chipped tile now and then
        if (hashInt(Math.floor(x / 20), Math.floor((y - wain) / 20), 9) < 0.05 && tx > 5 && ty > 5 && tx < 12) s = 0.16;
      } else {
        // plaster above, stained where the ceiling leaks, a darker band at chair-back height
        s = 0.27 + (fbm1(x / 70 + y / 110, 3, 3) - 0.5) * 0.08 + (hashInt(x >> 1, y >> 1, 3) - 0.5) * 0.02;
        const leak = fbm1(x / 23, 11, 3);
        if (leak > 0.62 && y < ceil + 40 + (leak - 0.62) * 400) s -= 0.05;
        row = R("plaster");
      }
      put(x, y, s, row);
    }
  }
  // the window: a deep reveal (its jambs and soffit lit amber from outside), a steel frame,
  // mullions and a transom, a sill that stands proud of the wall, glass that catches the tubes
  {
    for (let y = winY0 - reveal; y < winY1 + 12; y++)
      for (let x = winX0 - reveal; x < winX1 + reveal; x++) {
        if (inWindow(x, y)) continue;
        if (y >= winY1) {
          // the sill
          const ly = y - winY1;
          if (x < winX0 - reveal - 4 || x >= winX1 + reveal + 4) continue;
          put(x, y, ly === 0 ? 0.5 : ly < 3 ? 0.34 : ly === 11 ? 0.12 : 0.24, R("plaster"));
          continue;
        }
        const d = Math.min(winX0 - x > 0 ? winX0 - x : 99, x - winX1 + 1 > 0 ? x - winX1 + 1 : 99, winY0 - y > 0 ? winY0 - y : 99);
        put(x, y, 0.3 + (reveal - d) * 0.025, R("stemlit"));
      }
    for (let x = winX0 - reveal - 4; x < winX1 + reveal + 4; x++) for (let q = 0; q < 6; q++) bump(x, winY1 + 12 + q, -0.08 + q * 0.012);
    const transom = Math.round(winY0 + (winY1 - winY0) * 0.3);
    for (let y = winY0; y < winY1; y++)
      for (let x = winX0; x < winX1; x++) {
        const fx = x - winX0, fy = y - winY0;
        const frame = fx < 5 || winX1 - x <= 5 || fy < 5 || winY1 - y <= 5 || (fx - 5) % 104 < 4 || Math.abs(y - transom) < 2;
        if (frame) put(x, y, fx < 5 || fy < 5 ? 0.4 : 0.26 + ((fx - 5) % 104 === 0 ? 0.1 : 0), R("plaster"));
        else {
          // the glass: a sparse diagonal sheen and the tubes' cold reflection near the top
          // (two short strokes per pane, high up: a reflection, not rain)
          const pane = Math.floor((fx - 5) / 104);
          const px = (fx - 5) % 104, ph = winY1 - winY0;
          const diag = px + fy * 0.7;
          const k = 18 + (pane % 2) * 30;
          if (fy < ph * 0.55 && ((diag > k && diag < k + 1.5) || (diag > k + 7 && diag < k + 8)) && (fx + fy) % 2 === 0) put(x, y, 0.9, R("win3"), true);
          else if (fy > 7 && fy < 9 && (fx - 5) % 104 > 20 && (fx - 5) % 104 < 70 && (fx & 1) === 0) put(x, y, 0.9, R("tube"), true);
        }
      }
    // amber from the window on the wainscot and the wall under it
    pool(bump, (winX0 + winX1) / 2, o.floor - 10, (winX1 - winX0) * 0.62, o.H * 1.2, 0.12, 3, 41);
  }
  // the west doorway back to the market: a plaster reveal lit amber, a lintel, a step
  {
    for (let y = doorY - 18; y < o.floor; y++)
      for (let x = doorX0 - 4; x < doorX1 + 16; x++) {
        if (inDoor(x, y)) continue;
        if (y < doorY) put(x, y, y === doorY - 18 ? 0.44 : y > doorY - 3 ? 0.14 : 0.3, R("plaster"));
        else if (x >= doorX1 && x < doorX1 + reveal) put(x, y, 0.34 + (doorX1 + reveal - x) * 0.02, R("stemlit"));
        else if (x >= doorX1 + reveal) put(x, y, 0.36 - (x - doorX1 - reveal) * 0.02, R("plaster"));
      }
    pool(bump, doorX1 + 20, o.floor - 40, o.H * 1.4, o.H * 1.6, 0.1, 3, 43);
  }
  // cold light pools under the tubes on the plaster
  for (const tx of o.tubes) pool(bump, rx(tx), ceil + 16, o.H * 1.7, o.H * 1.25, 0.08, 3, Math.round(tx * 7));
  // a conduit along the ceiling to the tubes, a vent grille, a notice board with pinned papers
  for (let x = 0; x < stemX; x++) (put(x, ceil + 3, 0.36, R("plaster")), put(x, ceil + 4, 0.22, R("plaster")), put(x, ceil + 5, 0.12, R("plaster")));
  {
    const vx = rx(o.vent), vy = ceil + 30;
    for (let y = vy; y < vy + 26; y++) for (let x = vx; x < vx + 44; x++) put(x, y, x === vx || y === vy ? 0.42 : (y - vy) % 4 < 2 ? 0.1 : 0.3, R("plaster"));
    for (let q = 0; q < 30; q++) for (let x = vx; x < vx + 44; x++) if (hashInt(x, q, 51) < 0.4 - q / 80) bump(x, vy + 26 + q, -0.04);
    const nx = rx(o.notice), ny = up(2.25);
    for (let q = 0; q < 4; q++) for (let x = nx - 2; x < nx + 74; x++) bump(x, ny + 46 + q, -0.08 + q * 0.02);
    for (let y = ny; y < ny + 46; y++) for (let x = nx; x < nx + 72; x++) put(x, y, x < nx + 3 || y < ny + 3 || x > nx + 68 || y > ny + 42 ? 0.36 : 0.2 + (hashInt(x >> 2, y >> 2, 3) - 0.5) * 0.04, R("wood"));
    const r = (k: number): number => hashInt(k, 7, 61);
    for (let k = 0; k < 5; k++) {
      const px = nx + 6 + Math.round(r(k) * 44), py = ny + 6 + Math.round(r(k + 9) * 18), pw = 14 + Math.round(r(k + 3) * 8), ph = 16 + Math.round(r(k + 5) * 6);
      for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) put(x, y, 0.62 + (y === py ? 0.08 : 0) + ((y - py) % 4 === 2 && x > px + 2 && x < px + pw - 3 ? -0.14 : 0), R("plaster"));
      put(px + (pw >> 1), py + 1, 0.9, R("signr"), true);
    }
  }
  // occlusion where the wall meets the floor and the ceiling
  for (let q = 0; q < 8; q++) for (let x = -8; x < stemX; x++) (bump(x, o.floor - 1 - q, -0.07 + q * 0.008), bump(x, ceil + 6 + q, -0.06 + q * 0.007));

  // the stem: a ribbed cylinder of black steel, rimmed amber on its window side, a cold sheen from
  // the tubes, panel seams and bolted bands, a maintenance ladder, conduits; the portal cut into it
  const [s0, s1, sh] = o.shaft;
  const mx0 = rx(s0), mx1 = rx(s1), my = up(sh);
  const sw = o.roomW + 8 - stemX;
  const pf = 30; // the portal frame's width
  for (let x = stemX; x < o.roomW + 8; x++) {
    const u = (x - stemX) / sw;
    const round = Math.sin(Math.min(1, u * 1.25 + 0.06) * Math.PI);
    const flute = (x - stemX) % 26;
    for (let y = 0; y < H + 8; y++) {
      if (x >= mx0 && x < mx1 && y >= my && y < o.floor) continue; // the shaft: the car shows here
      let s = 0.13 + 0.26 * round;
      let row = R("stem");
      // a cold sheen high on the cylinder where the tubes' light catches it
      if (u > 0.18 && u < 0.3) s += 0.06;
      if (flute < 2) s -= 0.07;
      else if (flute === 2) s += 0.09;
      if (x - stemX < 3) {
        s = 0.62;
        row = R("stemlit");
      } else if (x - stemX < 16) {
        s = 0.42 - (x - stemX) * 0.022;
        row = R("stemlit");
      }
      // collars where it passes through the ceiling and into the floor
      const collar = (y > ceil - 30 && y < ceil + 18) || (y > o.floor - 22 && y < o.floor + 4);
      if (collar) {
        s = 0.24 + 0.24 * round + (y === ceil - 30 || y === o.floor - 22 ? 0.2 : 0) + ((x - stemX) % 40 === 20 && (y === ceil - 24 || y === o.floor - 16) ? 0.25 : 0);
        row = R("stem");
      }
      // bands every 2 H with bolts, plate seams between
      const band = (o.floor - y + 4000) % (o.H * 2);
      if (!collar && band < 6) s += band === 0 ? 0.18 : band === 5 ? -0.06 : 0.07;
      if (!collar && band === 3 && flute === 13) s += 0.28;
      if (!collar && (o.floor - y + 4000) % (o.H * 2) === o.H && flute > 3) s -= 0.05;
      put(x, y, s, row);
    }
  }
  // the maintenance ladder up the stem, and two conduits
  {
    const lx = stemX + 44;
    for (let y = ceil; y < o.floor - 22; y++) {
      for (const side of [0, 18]) (put(lx + side, y, 0.46), put(lx + side + 1, y, 0.26), put(lx + side + 2, y, 0.1));
      if ((o.floor - y) % 14 === 0) for (let q = 2; q < 18; q++) (put(lx + q, y, 0.42), put(lx + q, y + 1, 0.16));
    }
    for (const cx of [stemX + 112, stemX + 120]) for (let y = 0; y < o.floor - 22; y++) (put(cx, y, 0.4), put(cx + 1, y, 0.24), put(cx + 2, y, 0.1), (y - ceil) % 60 === 0 && put(cx - 1, y, 0.5));
  }
  // the portal: a riveted steel frame round the shaft mouth, a lintel with hazard chevrons, a
  // header plate, a steel sill with the same stripes; the gate (the prop) slides in it
  for (let y = my - pf - 4; y < o.floor; y++)
    for (let x = mx0 - pf; x < mx1 + pf; x++) {
      if (x >= mx0 && x < mx1 && y >= my) continue;
      const lint = y < my;
      const d = lint ? Math.min(y - (my - pf - 4), my - 1 - y) : Math.min(x - (mx0 - pf), x < mx0 ? mx0 - 1 - x : mx1 + pf - 1 - x, x >= mx1 ? x - mx1 : 99);
      let s = 0.3 + (d < 2 ? 0.16 : d < 4 ? 0.04 : 0);
      let row = R("stem");
      if (lint && d >= 6 && y > my - pf + 4 && y < my - 6) {
        // hazard chevrons
        const stripe = Math.floor((x - y + 4000) / 10) % 2 === 0;
        s = stripe ? 0.7 : 0.08;
        row = stripe ? R("stemlit") : R("stem");
      }
      if (!lint && d >= 4 && (y - my) % 24 === 12 && (x === mx0 - pf + 8 || x === mx1 + pf - 9)) s += 0.3;
      // the mouth's inner faces: the reveal the gate sits in, lit on the window side
      if (!lint && ((x >= mx0 - 4 && x < mx0) || (x >= mx1 && x < mx1 + 4))) s = x < mx0 ? 0.42 : 0.12;
      put(x, y, s, row);
    }
  for (let x = mx0 - pf - 6; x < mx1 + pf + 6; x++) for (let q = 0; q < 5; q++) put(x, o.floor - 5 + q, q === 0 ? 0.56 : Math.floor((x + 4000) / 8) % 2 === 0 ? 0.6 : 0.08, q === 0 ? R("stem") : Math.floor((x + 4000) / 8) % 2 === 0 ? R("stemlit") : R("stem"));
  // the arrow sign's shadow and its standoffs on the stem
  {
    const [sx, sy] = o.sign;
    const X = rx(sx), Y = up(sy);
    for (let y = Y - 26; y < Y + 34; y++) for (let x = X - 16; x < X + 26; x++) bump(x, y, -0.1);
  }
  // broken tiles where the stem came through the floor
  for (let k = 0; k < 9; k++) {
    const bx = stemX - 70 + Math.round(hashInt(k, 1, 71) * 70), bwid = 5 + Math.round(hashInt(k, 2, 71) * 9), bh = 3 + Math.round(hashInt(k, 3, 71) * 5);
    for (let y = o.floor - bh; y < o.floor; y++) for (let x = bx; x < bx + bwid - (o.floor - y); x++) put(x, y, 0.34 + (y === o.floor - bh ? 0.14 : 0), R("tile"));
  }
  for (let i = 0; i < 90; i++) {
    const x = stemX - 4 - Math.round(i * 0.9 + Math.sin(i * 0.4) * 4), y = wain - 10 - Math.round(i * 0.6);
    if (y > ceil + 10) (put(x, y, 0.08, R("plaster")), put(x + 1, y, 0.16, R("plaster")));
  }
  return [{ kind: "pix", name: "room", depth: 1, fog: 0, pix, x: ox, y: 0, twinkle: 0, dither: 0 }];
}

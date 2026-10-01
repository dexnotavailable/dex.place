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
import { shaft, shaftFn } from "../../../../scenes/engine/layers.ts";
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
  /** The lift queue's stanchions (world x), standing on the tile in front of the gate. */
  queue: number[];
}

export function liftFootScene(o: LiftFootOpts): SceneDef {
  const palette = {
    ...amber.palette,
    tile: ["#0e1213", "#161c1d", "#20282a", "#2c3738", "#3c4a4a", "#52625f", "#6e7e79"],
    plaster: ["#121515", "#1b2020", "#262c2b", "#333a38", "#434b48", "#566058"],
    // the stem: black steel, but with enough steps that its flutes, bands and the portal read (round 1
    // it was a black void beside the room)
    stem: ["#08080c", "#101016", "#1a1a22", "#26262f", "#34343f", "#4a4a5a", "#68687e"],
    // the portal's frame: the same steel, a little warmer where the room's light reaches it
    portal: ["#0e0c0e", "#1a1618", "#282224", "#3a3132", "#504442", "#6c5a54", "#8c7468"],
    stemlit: ["#1a1410", "#3a2616", "#6a4020", "#a0622c", "#d08a3c"],
    tube: ["#5a6a68", "#a8bab4", "#e6f4ee"],
    // the near silhouettes (round 3): the queue's stanchions and belts, the duct over the camera
    fore: ["#050607", "#0a0c0d", "#111415", "#191d1e", "#242a2a", "#3a4242", "#5e6866"],
    // the station clock's face and the posters' faded paper
    poster: ["#16130f", "#2a241c", "#423828", "#5e5038", "#7e6c4c", "#a08a62"],
    // the queue's brass caps and the call panel's plate; the belt's worn red
    brass: ["#141008", "#2a2010", "#46361a", "#6a5228", "#94763a", "#c0a05a"],
    belt: ["#1a0a0c", "#2e1214", "#4a1c1c", "#6a2a26", "#8c3e32"],
    wood: ["#140e0b", "#21160f", "#312116", "#452f1f", "#5e422b"],
  };
  return lifted(amber, {
    title: "hollow: lift foot",
    ref: o.ref,
    vertical: 1,
    palette,
    // through the window only the hollow itself: no near structures of the scene's own
    drop: ["gantry", "figure", "foreground", "overhang", "lamp-glow", "foundry", "near-sign", "bridge", "pylon-glow", "smoke-near", "embers-near"],
    // the tubes' cold light falling in cones (round 3: the room had no lighting shape; the cones give it
    // one, against the window's amber)
    prelude: (ctx) =>
      noDeckLamp(amber.prelude ? amber.prelude(ctx) : "") +
      o.tubes.map((tx, i) => shaftFn({ fn: `tube${i}`, from: [(tx - o.x0) * o.H - ctx.span / 2, o.floor - o.ceiling * o.H + 10], to: [(tx - o.x0) * o.H - ctx.span / 2, o.floor + 4], w0: o.H * 0.7, w1: o.H * 1.55, streaks: 3, speed: 0.01, fadeStart: 0.82, intensity: 0.75 })).join("\n"),
    compose: (ctx, ls) => [...ls, ...room(ctx, o), ...cones(ctx, o), ...liftFore(ctx, o)],
  });
}

/**
 * The scene's prelude lights its deck lamp (the figure's, on the gantry this room drops) on every layer
 * near depth 1: here that put a stepped grey disc on the stem with nothing to cast it (reg-c critic r3,
 * "the C3 translucent disc"). The room keeps the scene's other light (the pits, the ship, the sign) and
 * turns that one lamp off; the market moves it off the map for the same reason (_scene/market.ts).
 */
function noDeckLamp(src: string): string {
  const lamp = "float ld = (1.0 - smoothstep(0.9, 1.8, depth));";
  if (!src.includes(lamp)) throw new Error("hollow lift foot: the amber prelude's deck lamp moved; update noDeckLamp()");
  return src.replace(lamp, "float ld = 0.0;");
}

/** The tubes' cones of cold light (additive, stepped; behind the props and the player). */
function cones(ctx: BuildCtx, o: LiftFootOpts): LayerDef[] {
  return o.tubes.map((tx, i) => {
    const x = (tx - o.x0) * o.H - ctx.span / 2;
    return { ...shaft({ name: `tube-cone-${i}`, depth: 1, fn: `tube${i}`, row: "tube", steps: 3, alpha: 0.18 }), bounds: { x0: x - o.H * 1.8, x1: x + o.H * 1.8, y0: o.floor - o.ceiling * o.H, y1: o.floor + 6 } };
  });
}

/**
 * Near silhouettes: along the frame's top, a ventilation duct close to the camera, flanged and hung on
 * straps. Front pass: it draws over the world and slides faster than it. Near-black, cold, rimmed by
 * the tubes.
 */
function liftFore(ctx: BuildCtx, o: LiftFootOpts): LayerDef[] {
  const { W, H } = ctx;
  const R = (n: string): number => ctx.row(n);
  const d = 0.72;
  const w = Math.ceil(ctx.panWidth(d)) + 300;
  const x = -Math.ceil((w - W) / 2);
  const pix = new Pix(w, H + 80);
  const put = (xx: number, yy: number, sv: number, row = R("fore")): void => pix.set(Math.round(xx - x), Math.round(yy), sv, row, 0, false);
  const ceil = o.floor - o.ceiling * o.H;
  // the duct: across the top, flanges every so often, a lit underside, straps up into the dark
  const dB = Math.max(24, Math.round(ceil - 34));
  for (let xx = x; xx < x + w; xx++) {
    const k = (xx - x) % 220;
    const flange = k < 6;
    for (let yy = 0; yy < dB + (flange ? 4 : 0); yy++) put(xx, yy, 0.22 + (yy >= dB - 2 ? 0.34 : 0) + (flange ? 0.08 : 0) + (k === 6 ? -0.08 : 0) + ((yy - dB) % 9 === 0 ? 0.03 : 0));
    if (k > 100 && k < 104) for (let yy = 0; yy < dB; yy++) put(xx, yy, 0.12);
  }
  // (round 4: the queue's stanchions moved off this layer, onto the walk line in front of the gate: as
  // near silhouettes they were the darkest values in the frame, sank 60 px under the floor and their
  // belts slid across the chairs and the dummy as the camera panned. room() stands them on the tile)
  return [{ kind: "pix", name: "fore", depth: d, fog: 0, pix, x, y: 0, twinkle: 0, dither: 0 }];
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
        // old water stains run down from the ceiling slab between the tubes (not under them: there
        // the tubes' light washes the plaster)
        const lit = o.tubes.some((tx) => Math.abs(x - rx(tx)) < o.H * 1.6);
        if (!lit && leak > 0.62 && y < ceil + 40 + (leak - 0.62) * 400 && (x ^ y) & 1) s -= 0.03;
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
  // the station clock over the window (stopped, like the ticket board), in a cast ring on a bracket
  {
    const cx = Math.round((winX0 + winX1) / 2), cy = Math.round((ceil + winY0) / 2) + 4;
    const rr = Math.max(14, Math.min(26, Math.round((winY0 - ceil) / 2) - 8));
    for (let y = cy - rr - 3; y <= cy + rr + 3; y++)
      for (let x = cx - rr - 3; x <= cx + rr + 3; x++) {
        const dd = Math.hypot(x - cx, y - cy);
        if (dd > rr + 3) continue;
        if (dd > rr) put(x, y, 0.42 + (x + y < cx + cy ? 0.12 : -0.08), R("stem"));
        else {
          const tick = dd > rr - 4 && Math.abs(((Math.atan2(y - cy, x - cx) / (Math.PI * 2)) * 12 + 12) % 1 - 0.5) > 0.42;
          put(x, y, tick ? 0.12 : 0.62 - dd * 0.006, R("poster"));
        }
      }
    for (let k = 0; k < rr - 4; k++) put(cx + Math.round(k * 0.5), cy - Math.round(k * 0.86), 0.08, R("stem"));
    for (let k = 0; k < rr - 8; k++) put(cx - Math.round(k * 0.8), cy + Math.round(k * 0.3), 0.08, R("stem"));
    for (let y = ceil + 4; y < cy - rr - 3; y++) (put(cx, y, 0.4, R("stem")), put(cx + 1, y, 0.2, R("stem")));
    for (let q = 0; q < 5; q++) for (let x = cx - rr; x < cx + rr + 6; x++) bump(x, cy + rr + 4 + q, -0.06 + q * 0.012);
  }
  // the upper wall darker toward the ceiling, so the tubes' light has a shape against it
  for (let y = ceil; y < wain; y++) {
    const t = 1 - (y - ceil) / Math.max(1, wain - ceil);
    if (t < 0.4) continue;
    for (let x = -8; x < stemX; x++) if (!inWindow(x, y) && !inDoor(x, y) && ((x ^ y) & 1 || t > 0.6)) bump(x, y, -(t - 0.4) * 0.14);
  }
  // cold light pools under the tubes on the plaster
  for (const tx of o.tubes) {
    // a wash of cold light down the plaster from each tube: brightest right under it, falling off
    pool(bump, rx(tx), ceil + 6, o.H * 1.5, o.H * 1.9, 0.24, 5, Math.round(tx * 7));
    // and down the wall in the cone's shape, widening toward the floor
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8;
      pool(bump, rx(tx), ceil + (o.floor - ceil) * t, o.H * (0.7 + t * 0.8), o.H * 0.5, 0.05, 2, Math.round(tx * 11) + i);
    }
    pool(bump, rx(tx), ceil + 6, o.H * 0.8, o.H * 0.5, 0.06, 2, Math.round(tx * 9));
  }
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
      let s = 0.18 + 0.3 * round;
      let row = R("stem");
      // a cold sheen high on the cylinder where the tubes' light catches it
      if (u > 0.18 && u < 0.3) s += 0.06;
      if (flute < 2) s -= 0.07;
      else if (flute === 2) s += 0.09;
      if (x - stemX < 3) {
        s = 0.62;
        row = R("stemlit");
      } else if (x - stemX < 22) {
        // the window's amber wraps round the stem's near side, falling off over its curve
        s = 0.46 - (x - stemX) * 0.018 + ((x - stemX) % 3 === 0 && x - stemX > 14 ? -0.04 : 0);
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
  // the portal, cut into the stem (DOOR RULE: built in, not stuck on): a riveted steel frame in the
  // stem's own steel, proud of it with a lit outer arris and a shadow where it stands off the flutes;
  // the mouth's reveal 8 px deep (its near face lit by the room, the far face and the soffit dark);
  // the lintel is a beam of the frame with hazard chevrons painted on it (worn at the edges); a
  // steel sill plate with the same stripes and a contact shadow on the tile
  for (let y = my - pf - 4; y < o.floor; y++)
    for (let x = mx0 - pf; x < mx1 + pf; x++) {
      if (x >= mx0 && x < mx1 && y >= my) continue;
      const lint = y < my;
      const outer = Math.min(x - (mx0 - pf), mx1 + pf - 1 - x, y - (my - pf - 4));
      const inner = lint ? my - 1 - y : x < mx0 ? mx0 - 1 - x : x - mx1;
      let s = 0.4 + (hashInt(x >> 2, y >> 2, 13) - 0.5) * 0.04;
      let row = R("portal");
      if (outer === 0) s = 0.62;
      else if (outer === 1) s = 0.5;
      else if (outer < 4) s = 0.44;
      // plate seams and rivet lines down the jambs and along the beam
      if (!lint && (y - my) % 40 === 0) s -= 0.12;
      if (!lint && (y - my) % 20 === 10 && (outer === 6 || inner === 6)) s += 0.22;
      if (lint && x % 16 === 8 && (y === my - pf + 1 || y === my - 4)) s += 0.22;
      if (lint && outer >= 4 && y > my - pf + 2 && y < my - 6) {
        // hazard chevrons painted on the beam, chipped at the edges
        const stripe = Math.floor((x - y + 4000) / 10) % 2 === 0;
        const chip = hashInt(x, y, 17) < 0.08;
        s = stripe && !chip ? 0.66 : 0.12;
        row = stripe && !chip ? R("stemlit") : R("portal");
      }
      // the reveal: 8 px deep round the mouth, lit on the room side, dark on the far side and under the beam
      if (inner < 8) {
        if (lint) s = 0.1 + inner * 0.012;
        else if (x < mx0) s = 0.52 - inner * 0.03;
        else s = 0.1;
        row = R("portal");
      }
      put(x, y, s, row);
    }
  // the frame's shadow on the stem round it (it stands proud of the flutes)
  for (let q = 0; q < 8; q++)
    for (let y = my - pf - 4; y < o.floor; y++) (bump(mx1 + pf + q, y, -0.1 + q * 0.012), q < 4 && bump(mx0 - pf - 1 - q, y, -0.05 + q * 0.012));
  for (let q = 0; q < 6; q++) for (let x = mx0 - pf; x < mx1 + pf + 8; x++) bump(x, my - pf - 5 - q, -0.04 + q * 0.007);
  // the sill plate across the mouth, striped like the beam, its foot dark on the tile
  for (let x = mx0 - pf - 6; x < mx1 + pf + 6; x++)
    for (let q = 0; q < 6; q++) {
      const stripe = Math.floor((x + 4000) / 8) % 2 === 0;
      put(x, o.floor - 6 + q, q === 0 ? 0.62 : q === 5 ? 0.06 : stripe ? 0.6 : 0.12, q === 0 || !stripe || q === 5 ? R("portal") : R("stemlit"));
    }
  // the arrow sign's shadow and its standoffs on the stem
  {
    const [sx, sy] = o.sign;
    const X = rx(sx), Y = up(sy);
    for (let y = Y - 26; y < Y + 34; y++) for (let x = X - 16; x < X + 26; x++) bump(x, y, -0.1);
  }
  // round 4: the stem's right half carried no detail (broad flat slate panels next to the busy waiting
  // room). Plate seams with rivet rows, grime run down from every band, a cable tray on hangers under
  // the ceiling collar, the call panel lit on the portal's jamb (its amber the only warm light on this
  // side, so it pools on the steel), a stencilled level mark, a hazard placard and a fuse box
  {
    const R2 = (k: number, q: number): number => hashInt(k, q, 131);
    const portal = (x: number, y: number): boolean => x >= mx0 - pf - 8 && x < mx1 + pf + 8 && y >= my - pf - 12;
    const ladder = (x: number): boolean => (x >= stemX + 40 && x < stemX + 66) || (x >= stemX + 108 && x < stemX + 126);
    const band = (y: number): number => (o.floor - y + 4000) % (o.H * 2);
    // vertical plate seams every four flutes (a dark joint, its lit lip), rivets down them
    for (let x = stemX + 104; x < o.roomW + 8; x += 104) {
      if (ladder(x) || ladder(x + 2)) continue;
      for (let y = ceil + 18; y < o.floor - 22; y++) {
        if (portal(x, y)) continue;
        bump(x, y, -0.11);
        bump(x + 1, y, 0.07);
        if ((y - ceil) % 12 === 6) (bump(x - 3, y, 0.16), bump(x - 3, y + 1, -0.06), bump(x + 4, y, 0.16), bump(x + 4, y + 1, -0.06));
      }
    }
    // rivets along the mid-plate seams, between the bolted bands
    for (let y = ceil + 18; y < o.floor - 22; y++) {
      if (band(y) !== o.H) continue;
      for (let x = stemX + 24; x < o.roomW + 8; x += 13) if (!portal(x, y) && !ladder(x)) (bump(x, y - 2, 0.15), bump(x, y - 1, -0.05));
    }
    // grime run down from each band and from the collar: dithered streaks that thin as they fall
    {
      const bands = [ceil + 18, ...Array.from({ length: 4 }, (_, i) => o.floor - o.H * 2 * (i + 1) + 6)];
      for (let k = 0; k < (o.roomW - stemX) / 9; k++) {
        const x = stemX + 24 + Math.round(R2(k, 1) * (o.roomW - stemX - 24));
        if (ladder(x)) continue;
        const y0 = bands[Math.floor(R2(k, 2) * bands.length)]!;
        const len = 18 + Math.round(R2(k, 3) * 70);
        for (let y = y0; y < y0 + len && y < o.floor - 22; y++) {
          if (portal(x, y)) break;
          const t = (y - y0) / len;
          if (((x ^ y) & 1 || t < 0.4) && R2(x, y) > t * 0.8) bump(x, y, -0.06 + t * 0.03);
          if (R2(k, 4) > 0.6 && t < 0.5 && y & 1) bump(x + 1, y, -0.04);
        }
      }
    }
    // the cable tray: a channel on hangers from the collar, cables sagging out of it between the hangers
    {
      const ty = ceil + 40;
      for (let x = stemX + 128; x < o.roomW + 8; x++) {
        for (let q = 0; q < 9; q++) put(x, ty + q, q === 0 ? 0.56 : q === 1 ? 0.4 : q === 8 ? 0.14 : q > 5 ? 0.2 : 0.28 + ((x >> 2) % 5 === 0 ? 0.04 : 0), R("stem"));
        for (let q = 9; q < 13; q++) bump(x, ty + q, -0.08 + (q - 9) * 0.018);
        if ((x - stemX) % 64 === 0) for (let y = ceil + 18; y < ty; y++) (put(x, y, 0.46, R("stem")), put(x + 1, y, 0.24, R("stem")));
      }
      for (let x0 = stemX + 128; x0 + 64 < o.roomW; x0 += 64) {
        if (R2(x0, 9) < 0.4) continue;
        for (let x = x0 + 4; x < x0 + 60; x++) {
          const t = (x - x0 - 4) / 56;
          const y = Math.round(ty + 9 + Math.sin(t * Math.PI) * (6 + R2(x0, 8) * 10));
          put(x, y, 0.3, R("stem"));
          put(x, y + 1, 0.12, R("stem"));
        }
      }
    }
    // the call panel on the portal's right jamb: a brass plate, an up button lit amber, the down one dark;
    // its warm light on the steel round it (a small source, stepped)
    {
      const cx = mx1 + pf + 18, cy = up(1.25);
      pool(bump, cx, cy + 4, o.H * 0.55, o.H * 0.7, 0.12, 3, 151);
      for (let y = cy - 18; y < cy + 18; y++)
        for (let x = cx - 9; x < cx + 9; x++) {
          const e = Math.min(x - (cx - 9), cx + 8 - x, y - (cy - 18), cy + 17 - y);
          put(x, y, e === 0 ? (x === cx - 9 || y === cy - 18 ? 0.62 : 0.2) : e === 1 ? 0.44 : 0.34 + (hashInt(x, y, 7) < 0.2 ? -0.06 : 0), R("brass"));
        }
      for (const [by, lit] of [[cy - 8, true], [cy + 6, false]] as [number, boolean][])
        for (let y = by - 4; y <= by + 4; y++)
          for (let x = cx - 4; x <= cx + 4; x++) {
            const d = Math.hypot(x - cx, y - by);
            if (d > 4.3) continue;
            if (d > 3.2) put(x, y, 0.14, R("brass"));
            else if (lit) put(x, y, d < 1.5 ? 0.9 : 0.62, R("stemlit"), d < 1.5);
            else put(x, y, 0.24 + (x < cx && y < by ? 0.1 : 0), R("stem"));
          }
      for (let q = 0; q < 4; q++) for (let y = cy - 18; y < cy + 18; y++) bump(cx + 9 + q, y, -0.08 + q * 0.02);
    }
    // a stencilled level mark high on the stem past the portal: an up arrow and the two-digit level,
    // painted, faded and chipped (not a word)
    {
      const DIG: Record<string, string> = { "0": "111101101101111", "1": "010110010010111" };
      const sx = mx1 + pf + 46, sy = up(4.0), k = 5;
      const paint = (x: number, y: number): void => {
        if (hashInt(x, y, 141) < 0.18) return;
        put(x, y, 0.36 + (hashInt(x >> 1, y >> 1, 143) - 0.5) * 0.08, R("poster"));
      };
      for (let i = 0; i < 9; i++) for (let q = -i; q <= i; q++) for (let a = 0; a < 2; a++) for (let c2 = 0; c2 < 2; c2++) paint(sx + 18 + q * 2 + a, sy + i * 2 + c2);
      for (let y = sy + 18; y < sy + 44; y++) for (let x = sx + 12; x < sx + 24; x++) paint(x, y);
      [..."01"].forEach((ch, n) => {
        const g = DIG[ch]!;
        for (let i = 0; i < 15; i++) if (g[i] === "1") for (let a = 0; a < k; a++) for (let c2 = 0; c2 < k; c2++) paint(sx + 44 + n * 4 * k + (i % 3) * k + a, sy + 8 + Math.floor(i / 3) * k + c2);
      });
    }
    // a hazard placard and a fuse box with its conduit, above the operator's booth
    {
      const hx = rx(268.25), hy = up(3.05);
      for (let y = hy; y < hy + 30; y++)
        for (let x = hx; x < hx + 40; x++) {
          const e = Math.min(x - hx, hx + 39 - x, y - hy, hy + 29 - y);
          if (e < 4) {
            const stripe = Math.floor((x + y) / 5) % 2 === 0;
            put(x, y, stripe ? 0.62 : 0.12, stripe ? R("stemlit") : R("stem"));
          } else put(x, y, 0.5 + ((y - hy) % 6 === 2 && x > hx + 8 && x < hx + 32 ? -0.3 : 0) + (hashInt(x, y, 151) < 0.06 ? -0.12 : 0), R("poster"));
        }
      for (let q = 0; q < 4; q++) for (let x = hx + 2; x < hx + 42; x++) bump(x, hy + 30 + q, -0.08 + q * 0.02);
      const fx = rx(269.2), fy = up(4.6);
      for (let y = fy; y < fy + 46; y++)
        for (let x = fx; x < fx + 34; x++) {
          const e = Math.min(x - fx, fx + 33 - x, y - fy, fy + 45 - y);
          put(x, y, e === 0 ? (x === fx || y === fy ? 0.6 : 0.16) : e === 1 ? 0.46 : x === fx + 17 ? 0.18 : 0.34 + ((y - fy) % 11 === 5 && Math.abs(x - fx - 9) < 4 ? 0.14 : 0), R("portal"));
        }
      for (let q = 0; q < 5; q++) for (let x = fx + 2; x < fx + 38; x++) bump(x, fy + 46 + q, -0.09 + q * 0.018);
      for (let y = ceil + 49; y < fy; y++) (put(fx + 12, y, 0.44, R("stem")), put(fx + 13, y, 0.22, R("stem")));
    }
  }

  // the lift queue: stanchions on the walk line in front of the gate (round 3 drew them as near
  // silhouettes; the critic read them as the heaviest values in the frame and as sunk under the floor).
  // Polished steel posts in the room's cold light on weighted bases, brass caps with the tubes' cool rim,
  // a worn red belt sagging between them; the tile's contact shadows sit under the bases (c3-liftfoot.ts)
  {
    const tops: [number, number][] = [];
    for (const wx of o.queue) {
      const cx = Math.round(rx(wx));
      const top = Math.round(o.floor - o.H * 0.62);
      tops.push([cx, top + 6]);
      for (let y = top; y < o.floor - 6; y++)
        for (let q = -2; q <= 2; q++) put(cx + q, y, (q === -1 ? 0.6 : q === -2 ? 0.44 : q === 2 ? 0.2 : 0.36) + ((y - top) % 22 === 0 ? 0.04 : 0), R("tile"));
      for (let y = top - 6; y < top; y++)
        for (let q = -4; q <= 4; q++) put(cx + q, y, (y === top - 6 ? 0.62 : q < -1 ? 0.5 : q > 2 ? 0.22 : 0.38) + (q === -3 && y === top - 5 ? 0.3 : 0), R("brass"));
      // the cool rim from the tubes on the cap's top
      for (let q = -3; q <= 2; q++) put(cx + q, top - 6, 0.9, R("tube"), true);
      for (let y = o.floor - 8; y < o.floor; y++) {
        const hw = 5 + Math.round((y - (o.floor - 8)) * 0.9);
        for (let q = -hw; q <= hw; q++) put(cx + q, y, (y === o.floor - 8 ? 0.56 : 0.36) + (q < -hw + 2 ? 0.1 : q > hw - 2 ? -0.14 : 0) - (y === o.floor - 1 ? 0.14 : 0), R("tile"));
      }
    }
    for (let i = 0; i + 1 < tops.length; i++) {
      const [ax, ay] = tops[i]!, [bx, by] = tops[i + 1]!;
      for (let x = ax + 3; x < bx - 2; x++) {
        const t = (x - ax) / (bx - ax);
        const y = Math.round(ay + (by - ay) * t + Math.sin(t * Math.PI) * 12);
        for (let q = 0; q < 4; q++) put(x, y + q, q === 0 ? 0.62 : q === 3 ? 0.14 : 0.42 - q * 0.04, R("belt"));
      }
      // a small plate hung on the belt's middle (blank: the queue's notice, faded)
      const mx = Math.round((ax + bx) / 2), myb = Math.round((ay + by) / 2 + 12) + 4;
      for (let y = myb; y < myb + 12; y++) for (let x = mx - 9; x < mx + 9; x++) put(x, y, x === mx - 9 || y === myb ? 0.62 : y === myb + 11 || x === mx + 8 ? 0.2 : 0.46 - ((y - myb) % 4 === 2 && Math.abs(x - mx) < 6 ? 0.18 : 0), R("poster"));
    }
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

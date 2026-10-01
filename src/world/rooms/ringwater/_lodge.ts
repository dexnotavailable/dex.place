// The keeper's lodge, inside (WORLD-PLAN A3): the backdrop behind the room's
// floors, counter and stove. A small two-floor timber house on the cliff
// shelf: log walls with a wainscot, a heavy beam under the loft, the roof
// timbers, a west window on each floor with the morning (or the evening after
// the round) in it and its light slanting in over the floor, dust in that
// light, a warm wash around the stove and the counter, the stair's handrail.
// Behind the loft's sky door the wall is open onto the view the door shows
// when it swings: a dusk sky, the lake far below with a tiny ring, and the
// black spire with its storm. It is morning outside; nobody comments.
//
// Everything is placed in room px; the room is narrower than the view and
// its camera is locked, so layer x = room x + (view - room) / 2.

import { f } from "../../../scenes/engine/layers.ts";
import { Motes } from "../../../scenes/engine/particles.ts";
import { Pix } from "../../../scenes/engine/pix.ts";
import { fbm, hashInt } from "../../../scenes/engine/noise.ts";
import type { BuildCtx, LayerDef, SceneDef } from "../../../scenes/engine/types.ts";

export interface LodgeOpts {
  roomW: number;
  roomH: number;
  /** Room y of the ground floor and the loft floor. */
  floor: number;
  loft: number;
  /** Room y of the ceiling's underside. */
  ceiling: number;
  /** Windows (room px): the west light. */
  windows: { x: number; y: number; w: number; h: number }[];
  /** The sky door's opening (room px): the dusk view behind it. */
  skyDoor: { x: number; y: number; w: number; h: number };
  /** Warm spots on the wall (room px): the stove, the counter's candle, the loft lantern. */
  warm: [number, number, number][];
  /** The stair's handrail: from (x0, y0) to (x1, y1) in room px. */
  rail: [number, number, number, number];
  /** Posts in the wall (room x): each carries knee braces up into the loft's beam. */
  posts: number[];
  /** Doors on the back wall (room px): x of the threshold's centre, y of the floor it opens from. */
  doors?: { x: number; y: number }[];
  /** The chimney breast behind the stove (room px): centre x, width; the stovepipe's thimble row. */
  chimney?: { x: number; w: number; thimble: number };
  /** Coat pegs by a door (room px x, y of the peg rail). */
  pegs?: [number, number];
  /** Herbs drying under the loft's beam (room px x0, x1). */
  herbs?: [number, number];
  /** A shelf of jars over the counter (room px x0, x1, y). */
  jars?: [number, number, number];
  /** The keeper's chart of the lake, framed on the wall (room px centre x, centre y, w, h). */
  chart?: [number, number, number, number];
  /** A pair of ferry oars crossed on pegs (room px centre x, centre y). */
  oars?: [number, number];
  evening: boolean;
}

const WALL = 1.04;

export function lodgeScene(o: LodgeOpts): SceneDef {
  const off = (ctx: BuildCtx): number => Math.round((ctx.W - o.roomW) / 2);
  const ev = o.evening;
  return {
    title: ev ? "lodge (evening)" : "lodge",
    palette: {
      log: ev ? ["#150f0e", "#211714", "#2e201a", "#3e2b21", "#503828", "#644632"] : ["#1a120e", "#281b14", "#38261b", "#4a3322", "#5e422c", "#755538"],
      timber: ["#0d0907", "#171009", "#22180f", "#312216", "#44301f", "#5a4029"],
      plaster: ev ? ["#2a221e", "#382c26", "#46382e", "#554438"] : ["#30271f", "#403328", "#524233", "#66523f"],
      frame: ["#0b0806", "#140e0a", "#1f160f", "#2e2115"],
      outside: ev ? ["#1c1a2c", "#2c2638", "#4a3a4a", "#7a5a5c", "#b27e6c", "#e0aa84"] : ["#1a2a2e", "#2a3e40", "#46605f", "#6a8480", "#9eb2a4", "#dcd4b0"],
      dusk: ["#1c1628", "#2e2238", "#4c3248", "#7a4a56", "#b06a60", "#e89c78", "#f8d0a0"],
      far: ["#141220", "#1e1a2c", "#2a2438", "#3a3048"],
      lake: ["#141a2a", "#1e283a", "#2c3a4e", "#46586a"],
      ringd: ["#0c0a12", "#16121c", "#221a26", "#3a2c34", "#9a6a50"],
      spire: ["#050407", "#0a080d", "#120e14"],
      storm: ["#1a1824", "#24202e", "#322c3c", "#48405a"],
      red: ["#6a1a18", "#b02a22", "#f04a36"],
      beam: ev ? ["#4a3028", "#7a4c38", "#b07050", "#e0a070"] : ["#4a4a38", "#7a7658", "#b0a67a", "#e6d8a4"],
      warmwall: ["#3a2418", "#6a3e22", "#a4622e", "#e09448"],
      dust: ev ? ["#6a4a3a", "#9c7050", "#d0a070"] : ["#6a5a44", "#9c8664", "#d2bc90"],
      standin: ["#07070a", "#101015", "#24232c", "#a29792"],
      // region lane a: the chimney's stone (warm where the stove reaches it), the crawlspace under
      // the floor, iron, the keeper's coat, drying herbs, glazed jars
      stone: ev ? ["#130f10", "#201a19", "#2e2522", "#40332c", "#564437", "#6e5744"] : ["#15110e", "#231c17", "#342920", "#47382b", "#5e4b38", "#786048"],
      iron: ["#0c0b0e", "#19171b", "#2a2628", "#3e3834"],
      // the keeper's coat: dark loden, so it reads as cloth against the warm logs, not as more wood
      coat: ["#0c0f0e", "#161d1a", "#222c27", "#323e36", "#4a5848", "#6a765e"],
      chart: ["#2a1c14", "#5a4430", "#8a7050", "#b49a70", "#d4bc8c"],
      ink: ["#1a1a22", "#2c3040", "#3e4a5c", "#5a6c7a"],
      // varnished ash for the ferry's oars, paler and warmer than the logs they hang on
      oar: ["#24160e", "#45291a", "#6c4426", "#946234", "#bd8a4c", "#dcb070"],
      herb: ["#12160e", "#202a16", "#33401f", "#4c562a", "#6a6c38"],
      jar: ["#161a1a", "#26302e", "#3c4a44", "#5e6e60", "#8a9682"],
    },
    fog: { stops: [[0, "#0e0b0a"], [1, "#120e0c"]], bands: 4, dither: 0.4, density: 0.3, max: 0.5 },
    span: () => 0,
    prelude: (ctx) => {
      const ox = off(ctx);
      const wins = o.windows.map((w) => `vec4(${f(w.x + ox)}, ${f(w.y)}, ${f(w.w)}, ${f(w.h)})`);
      const warm = o.warm.map(([x, y, r]) => `vec3(${f(x + ox)}, ${f(y)}, ${f(r)})`);
      return /* glsl */ `
const vec4 WINS[${wins.length}] = vec4[${wins.length}](${wins.join(", ")});
const vec3 WARM[${warm.length}] = vec3[${warm.length}](${warm.join(", ")});
// light from each west window falls down and to the right (the low morning sun), stepped in thirds
float windowLight(vec2 lp) {
  float l = 0.0;
  for (int i = 0; i < ${wins.length}; i++) {
    vec4 w = WINS[i];
    float dy = lp.y - w.y;
    if (dy < 0.0) continue;
    float x0 = w.x + dy * 0.62;
    float k = (lp.x - x0) / (w.z * 1.1);
    if (k < 0.0 || k > 1.0) continue;
    float fall = 1.0 - smoothstep(w.w * 0.8, w.w * 3.2, dy);
    l += fall * (1.0 - abs(k - 0.5) * 0.6);
  }
  return floor(clamp(l, 0.0, 1.0) * 3.0 + 0.2) / 3.0;
}
float warmLight(vec2 lp) {
  float l = 0.0;
  for (int i = 0; i < ${warm.length}; i++) {
    float d = length((lp - WARM[i].xy) * vec2(1.0, 1.2)) / WARM[i].z;
    float k = max(0.0, 1.0 - d);
    l += floor(k * k * k * 5.0 + 0.5) / 5.0;
  }
  return min(l, 1.0);
}
float sceneLight(vec2 s, float depth) {
  vec2 lp = s;
  float l = windowLight(lp) * ${f(ev ? 0.1 : 0.2)} + warmLight(lp) * ${f(ev ? 0.3 : 0.22)};
  return l * (1.0 - smoothstep(3.0, 20.0, depth));
}`;
    },
    build: (ctx) => {
      const { W, H } = ctx;
      const P = ctx.player;
      const ox = off(ctx);
      const R = (n: string): number => ctx.row(n);
      const L: LayerDef[] = [];
      const X = (x: number): number => Math.round(x + ox);

      // --- outside: what the west windows show ----------------------------------------
      L.push({
        kind: "glsl",
        name: "outside",
        depth: 30,
        fog: 0,
        body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float y = s.y / uRes.y;
  float sh = 0.25 + y * 0.9 + (fbm(vec2(p.x / 70.0 - uWx2.y * 0.01, p.y / 18.0), 3) - 0.5) * 0.25;
  return vec4(ramp(R_OUTSIDE, sh, p, 0.5), 1.0);
}`,
      });

      // --- the dusk view behind the sky door: a separate little world far below -------
      {
        const d = o.skyDoor;
        const pix = new Pix(d.w + 8, d.h + 8);
        const x0 = X(d.x) - 4, y0 = d.y - 4;
        const dusk = R("dusk");
        const hor = Math.round(pix.h * 0.62);
        for (let y = 0; y < pix.h; y++)
          for (let x = 0; x < pix.w; x++) {
            // a stepped dusk: violet high, rose, then a warm band at the horizon
            const t = y / hor;
            let s = y < hor ? 0.08 + t * t * 0.9 : 0.18;
            if (y < hor && hashInt(x, y, 5) > 0.992) s += 0.3;
            pix.set(x, y, s + (hashInt(x >> 2, y >> 1, 7) - 0.5) * 0.04, dusk);
          }
        // far hills and the lake, far below
        for (let x = 0; x < pix.w; x++) {
          const hh = Math.round(3 + fbm(x / 9, 3, 11) * 6);
          for (let y = hor - hh; y < hor; y++) pix.set(x, y, 0.3 + (y === hor - hh ? 0.25 : 0), R("far"));
          for (let y = hor; y < pix.h; y++) pix.set(x, y, 0.2 + ((y - hor) / (pix.h - hor)) * 0.5 + (hashInt(x, y, 9) > 0.93 ? 0.3 : 0), R("lake"));
        }
        // a tiny ring over the lake, sun-less now, a warm rim on its lower arc
        const rcx = Math.round(pix.w * 0.66), rcy = hor - 10, rr = 10;
        for (let a = 0; a < 360; a += 2) {
          if (a > 20 && a < 60) continue;
          const rx = Math.round(rcx + Math.cos((a * Math.PI) / 180) * rr);
          const ry = Math.round(rcy + Math.sin((a * Math.PI) / 180) * rr * 0.55);
          pix.set(rx, ry, a > 200 && a < 340 ? 0.3 : 0.85, R("ringd"));
        }
        // the black spire on the far side of the lake, its storm sitting on it, a red light
        const sx = Math.round(pix.w * 0.44), sb = hor - 1, st = Math.round(pix.h * 0.2);
        for (let y = st; y <= sb; y++) {
          const w = Math.max(1, Math.round(((y - st) / (sb - st)) * 3));
          for (let k = -w + 1; k < w; k++) pix.set(sx + k, y, 0.3, R("spire"));
        }
        pix.set(sx, st + 3, 0.99, R("red"), 0, true);
        for (let y = st - 12; y < st + 10; y++)
          for (let x = sx - 16; x < sx + 17; x++) {
            const e = ((x - sx) / 16) ** 2 + ((y - st + 1) / 11) ** 2;
            if (e < 1 && fbm(x / 5, y / 4, 13) > 0.38 + e * 0.3) pix.set(x, y, 0.2 + fbm(x / 3, y / 3, 17) * 0.5, R("storm"));
          }
        L.push({ kind: "pix", name: "sky-view", depth: WALL + 0.01, fog: 0, pix, x: x0, y: y0, dither: 0 });
      }

      // --- the log walls -----------------------------------------------------------------
      {
        const pix = new Pix(W, H);
        const log = R("log");
        const timber = R("timber");
        const plaster = R("plaster");
        const frame = R("frame");
        const logH = Math.round(P * 0.26);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            // horizontal logs: rounded (lit top, dark underside), knots, checks along the grain
            const ly = y % logH;
            const row = Math.floor(y / logH);
            let s = 0.36 + Math.sin((ly / logH) * Math.PI) * 0.14 - (ly === logH - 1 ? 0.18 : 0) - (ly === 0 ? 0.06 : 0);
            s += (fbm((x + row * 97) / 40, row * 3.1, 3) - 0.5) * 0.1;
            if (hashInt(Math.floor((x + row * 57) / 7), row, 5) > 0.985 && ly > 2 && ly < logH - 3) s -= 0.12;
            if (hashInt(x, y, 7) > 0.994) s -= 0.08;
            pix.set(x, y, s, log);
          }
        // the heavy beam under the loft floor, the ceiling timbers, the wainscot on each floor
        const beam = Math.round(P * 0.22);
        pix.rect(0, o.loft, W, beam, { row: timber, shade: (_x, y) => (y === o.loft ? 0.62 : y === o.loft + beam - 1 ? 0.12 : 0.3) });
        pix.rect(0, 0, W, o.ceiling + Math.round(P * 0.1), { row: timber, shade: (_x, y) => (y === o.ceiling + Math.round(P * 0.1) - 1 ? 0.5 : 0.18) });
        for (const fy of [o.floor, o.loft]) {
          const wh = Math.round(P * 0.5);
          // a wainscot of upright boards (tongue lines, a few knots), scuffed darker near the floor
          const bw = Math.round(P * 0.16);
          pix.rect(0, fy - wh, W, wh, {
            row: timber,
            shade: (x, y) => {
              const b = Math.floor(x / bw), bx = x - b * bw;
              let sh = 0.42 + (hashInt(b, 1, 54) - 0.5) * 0.1 - ((fy - y) < 6 ? 0.1 : 0);
              if (bx === 0) sh = 0.16;
              else if (bx === 1) sh += 0.1;
              if (hashInt(b, Math.floor(y / 5), 55) > 0.97) sh -= 0.12;
              return sh;
            },
          });
          void plaster;
          pix.rect(0, fy - wh - 2, W, 2, { row: timber, shade: 0.55 });
        }
        // logs vary log to log (some weathered paler, some darker), the wall gathers shade toward
        // the corners and under the loft's beam; the floor's foundation under the boards
        for (let y = 0; y < H; y++) {
          const lt = (hashInt(Math.floor(y / logH), 3, 41) - 0.5) * 0.08;
          for (let x = 0; x < W; x++) {
            if (!pix.solid(x, y)) continue;
            let d = lt;
            const under = y - (o.loft + Math.round(P * 0.22));
            if (under >= 0 && under < 40) d -= 0.12 * (1 - under / 40);
            if (y < o.ceiling + 30) d -= 0.08;
            const edge = Math.min(x - ox, W - ox - x);
            if (edge >= 0 && edge < 60) d -= 0.1 * (1 - edge / 60);
            pix.setShade(x, y, pix.shadeAt(x, y) + d);
          }
        }
        {
          const stone = R("stone");
          const fy = o.floor + Math.round(P * 0.2);
          for (let y = fy; y < H; y++)
            for (let x = 0; x < W; x++) {
              const cr = Math.floor((y - fy) / 9);
              const bx = (x + (cr % 2) * 13) % 26;
              let sh = 0.3 - (y - fy) * 0.004 + (hashInt(Math.floor((x + (cr % 2) * 13) / 26), cr, 43) - 0.5) * 0.1;
              if (bx === 0 || (y - fy) % 9 === 0) sh = 0.08;
              pix.set(x, y, sh, stone);
            }
          // joists' ends under the boards
          for (let x = 18; x < W; x += Math.round(P * 0.55)) pix.rect(x, fy, Math.round(P * 0.12), Math.round(P * 0.14), { row: timber, shade: (xx, yy) => (yy === fy ? 0.5 : xx === x ? 0.42 : 0.22) });
        }
        // posts in the wall, each with knee braces up into the loft's beam
        for (const px of o.posts) {
          const pw = Math.round(P * 0.18);
          const x0 = X(px) - (pw >> 1);
          pix.rect(x0, 0, pw, o.floor + Math.round(P * 0.2), { row: timber, shade: (x) => (x === x0 ? 0.55 : x === x0 + pw - 1 ? 0.14 : 0.3 + (hashInt(x, 1, 44) - 0.5) * 0.06) });
          const kb = Math.round(P * 0.55), by = o.loft + Math.round(P * 0.22);
          for (let k = 0; k < kb; k++)
            for (let t = 0; t < 4; t++) {
              pix.set(x0 + pw + k, by + kb - k - 1 + t, t === 0 ? 0.5 : 0.26, timber);
              pix.set(x0 - 1 - k, by + kb - k - 1 + t, t === 0 ? 0.42 : 0.22, timber);
            }
        }
        // the chimney breast: coursed stone from the floor to the roof, the stovepipe's iron thimble
        if (o.chimney) {
          const { x: ccx, w: cw, thimble } = o.chimney;
          const stone = R("stone");
          const x0 = X(ccx) - (cw >> 1);
          let cy = 0;
          for (let r = 0; cy < o.floor + 2; r++) {
            const ch = 8 + Math.round(hashInt(r, 1, 45) * 9);
            let x = x0 - (r % 2) * 7;
            let k = 0;
            while (x < x0 + cw) {
              const len = 10 + Math.round(hashInt(k, r, 46) * 22);
              const tone = (hashInt(k, r, 47) - 0.5) * 0.14;
              for (let dx = 0; dx < len; dx++) {
                const xx = x + dx;
                if (xx < x0 || xx >= x0 + cw) continue;
                for (let d = 0; d < ch; d++) {
                  // rounded fieldstone: corners knocked off into the mortar, a lit upper-left rim
                  const cx2 = Math.min(dx, len - 1 - dx), cy2 = Math.min(d, ch - 1 - d);
                  if (cx2 + cy2 < 2) {
                    pix.set(xx, cy + d, 0.1, stone);
                    continue;
                  }
                  let sh = 0.48 + tone - d * 0.014 + (hashInt(xx >> 1, (cy + d) >> 1, 56) - 0.5) * 0.08;
                  if (d === 1 || dx === 1) sh += 0.12;
                  if (dx === 0 || d === ch - 1 || d === 0) sh = 0.1;
                  else if (dx === len - 2 || d === ch - 2) sh -= 0.08;
                  pix.set(xx, cy + d, sh, stone);
                }
              }
              x += len;
              k++;
            }
            cy += ch;
          }
          // the breast stands proud of the logs: a lit left edge (the window side), a shadow on the right
          for (let y = 0; y < o.floor; y++) {
            pix.set(x0, y, 0.62, stone);
            for (let k = 1; k <= 3; k++) pix.set(x0 + cw - 1 + k, y, 0.06, log);
          }
          // a soot stain rising from the thimble, and the iron collar itself
          for (let y = thimble - 60; y < thimble; y++)
            for (let x = X(ccx) - 8; x < X(ccx) + 8; x++) if (hashInt(x, y, 48) < 0.5 * (1 - (thimble - y) / 60)) pix.setShade(x, y, pix.shadeAt(x, y) - 0.14);
          pix.rect(X(ccx) - 7, thimble - 2, 14, 7, { row: R("iron"), shade: (x, y) => (y === thimble - 2 ? 0.8 : x === X(ccx) - 7 ? 0.6 : 0.36) });
        }
        // doorways built into the back wall: the opening's reveal around the door's casing (its
        // inner face toward the windows catches their light, the head is in shadow), a squared
        // lintel beam running into the logs on both sides, a sill board
        for (const dr of o.doors ?? []) {
          const fw = Math.round(P * 0.94), fh = Math.round(P * 1.54);
          // a log wall is thick: 8 px of jamb each side of the casing. The east jamb faces the
          // windows and catches their light (log end grain, brighter toward the room); the west one
          // is in shadow, darkest deep in the opening; the head is darkest of all
          const rx = X(dr.x) - (fw >> 1) - 8, rw = fw + 16, ry = dr.y - fh - 8;
          pix.rect(rx, ry, rw, dr.y - ry, { row: frame, shade: (x) => 0.03 + Math.min(1, (x - rx) / 8) * 0.04 });
          pix.rect(rx + rw - 8, ry + 8, 8, dr.y - ry - 8, { row: log, shade: (x, y) => 0.24 + ((x - (rx + rw - 8)) / 8) * 0.24 + ((y >> 2) % 3 === 0 ? -0.05 : 0) });
          pix.rect(rx, ry, rw, 8, { row: frame, shade: (_x, y) => (y === ry ? 0.0 : 0.02) });
          const lw = rw + Math.round(P * 0.4), lx = rx - Math.round(P * 0.2), lh = Math.round(P * 0.16);
          pix.rect(lx, ry - lh, lw, lh, { row: timber, shade: (x, y) => (y === ry - lh ? 0.84 : y === ry - lh + 1 ? 0.7 : y === ry - 1 ? 0.3 : x === lx || x === lx + lw - 1 ? 0.62 : 0.52 + (hashInt(x >> 2, y, 49) - 0.5) * 0.08) });
          for (const ex of [lx, lx + lw - 3]) pix.rect(ex, ry - lh + 2, 3, lh - 4, { row: timber, shade: 0.58 });
          pix.rect(lx, ry, rx - lx, 3, { row: log, shade: 0.12 });
          pix.rect(rx + rw, ry, lx + lw - rx - rw, 3, { row: log, shade: 0.12 });
          pix.rect(rx - 4, dr.y - 3, rw + 8, 3, { row: timber, shade: (_x, y) => (y === dr.y - 3 ? 0.62 : 0.3) });
        }
        // coat pegs by the front door: a rail, the keeper's coat and a hat on them
        if (o.pegs) {
          const [px0, py] = o.pegs;
          const x0 = X(px0);
          const coat = R("coat");
          pix.rect(x0, py, Math.round(P * 0.6), 4, { row: timber, shade: (_x, y) => (y === py ? 0.62 : 0.3) });
          for (let k = 0; k < 3; k++) pix.rect(x0 + 6 + k * 16, py + 4, 2, 4, { row: timber, shade: 0.5 });
          // the coat on the first peg: a loop, sloping shoulders, a dark collar, sleeves hanging
          // down its sides with a fold between them and the body, buttons, folds in the skirt, an
          // uneven hem; lit on its left (the stove), and its shadow on the logs to the right
          const ch = Math.round(P * 0.7), cx = x0 + 7, ct = py + 7;
          const hwAt = (t: number): number => (t < 0.14 ? Math.round(3 + (t / 0.14) * 5) : Math.round(7 + t * 3));
          for (let y = ct; y < ct + ch; y++) {
            const hw = hwAt((y - ct) / ch);
            for (let x = cx - hw + 3; x <= cx + hw + 3; x++) pix.setShade(x, y + 2, pix.shadeAt(x, y + 2) - 0.12);
          }
          pix.rect(cx, py + 5, 1, 2, { row: coat, shade: 0.2 });
          for (let y = ct; y < ct + ch; y++) {
            const t = (y - ct) / ch;
            const hw = hwAt(t);
            const sl = hw - 3;
            for (let x = cx - hw; x <= cx + hw; x++) {
              const dx = x - cx;
              if (t > 0.96 && hashInt(x, 3, 60) > 0.5) continue;
              let sh = 0.4;
              if (x <= cx - hw + 1) sh = 0.62;
              else if (x >= cx + hw - 1) sh = 0.16;
              if (t > 0.14 && t < 0.62) {
                if (Math.abs(dx) === sl) sh = 0.12;
                else if (Math.abs(dx) > sl) sh += 0.05;
                if (t > 0.56 && Math.abs(dx) > sl) sh = dx < 0 ? 0.58 : 0.3;
              }
              if (t < 0.24 && Math.abs(dx) < Math.round((0.24 - t) * 22)) sh = 0.1;
              if (dx === 0 && t >= 0.24) sh = 0.12;
              if (dx === 2 && t > 0.27 && t < 0.8 && Math.round(t * 24) % 5 === 0) sh = 0.85;
              if (t > 0.64 && (dx === -4 || dx === 5)) sh -= 0.1;
              pix.set(x, y, sh, coat);
            }
          }
          // the hat on the third peg: a crown with a band, a brim, lit on the left
          const hx = x0 + 31;
          pix.rect(hx + 3, py + 1, 9, 7, { row: coat, shade: (x, y) => (y === py + 1 ? 0.6 : x === hx + 3 ? 0.55 : x === hx + 11 ? 0.14 : 0.32) });
          pix.rect(hx + 3, py + 5, 9, 1, { row: coat, shade: 0.08 });
          pix.rect(hx, py + 8, 15, 2, { row: coat, shade: (x, y) => (y === py + 8 ? (x < hx + 7 ? 0.62 : 0.44) : 0.18) });
          pix.rect(hx + 2, py + 10, 13, 2, { row: timber, shade: 0.1 });
        }
        // herbs drying in bunches under the loft's beam
        if (o.herbs) {
          const herb = R("herb");
          const by = o.loft + Math.round(P * 0.22);
          for (let x = X(o.herbs[0]); x < X(o.herbs[1]); x += 13 + Math.round(hashInt(x, 1, 50) * 9)) {
            const len = 14 + Math.round(hashInt(x, 2, 50) * 12);
            for (let y = by; y < by + 5; y++) pix.set(x, y, 0.5, R("iron"));
            for (let d = 0; d < len; d++) {
              const hw = Math.round(1 + Math.sin((d / len) * Math.PI) * 4);
              for (let k = -hw; k <= hw; k++) if (hashInt(x + k, d, 51) > 0.2) pix.set(x + k, by + 5 + d, 0.3 + (k > 0 ? 0.18 : 0) + (hashInt(x + k, d, 52) - 0.5) * 0.2, herb);
            }
          }
        }
        // a shelf of jars over the counter
        if (o.jars) {
          const [a, b2, jy] = o.jars;
          const x0 = X(a), x1 = X(b2);
          pix.rect(x0, jy, x1 - x0, 4, { row: timber, shade: (_x, y) => (y === jy ? 0.66 : 0.32) });
          for (const bx of [x0 + 6, x1 - 10]) for (let k = 0; k < 10; k++) pix.rect(bx + Math.round(k * 0.4), jy + 4 + k, 3, 1, { row: timber, shade: 0.28 });
          for (let x = x0 + 4; x < x1 - 8; x += 11 + Math.round(hashInt(x, 1, 53) * 5)) {
            const jh = 9 + Math.round(hashInt(x, 2, 53) * 8), jw = 6 + Math.round(hashInt(x, 3, 53) * 3);
            for (let y = jy - jh; y < jy; y++)
              for (let k = 0; k < jw; k++) {
                if (y < jy - jh + 3 && (k < 2 || k > jw - 3)) continue;
                pix.set(x + k, y, y === jy - jh ? 0.75 : k === 1 ? 0.8 : k === jw - 1 ? 0.2 : 0.42, R("jar"));
              }
          }
        }
        // the keeper's chart of the lake, framed: the ring drawn over the water, the shore, the
        // ferry's dotted route, the lodge marked in red, a note pinned in the corner
        if (o.chart) {
          const [ccx, ccy, cw, chh] = o.chart;
          const x0 = X(ccx) - (cw >> 1), y0 = ccy - (chh >> 1);
          const paper = R("chart"), ink = R("ink");
          for (let k = 1; k <= 4; k++) for (let x = x0 + 3; x < x0 + cw + 3; x++) pix.setShade(x, y0 + chh + k - 1, pix.shadeAt(x, y0 + chh + k - 1) - 0.1);
          for (let y = y0 + 3; y < y0 + chh + 3; y++) for (let k = 0; k < 3; k++) pix.setShade(x0 + cw + k, y, pix.shadeAt(x0 + cw + k, y) - 0.1);
          pix.rect(x0, y0, cw, chh, { row: frame, shade: (x, y) => (y === y0 || x === x0 ? 0.62 : y === y0 + chh - 1 || x === x0 + cw - 1 ? 0.14 : 0.34) });
          const ix0 = x0 + 4, iy0 = y0 + 4, iw = cw - 8, ih = chh - 8;
          for (let y = iy0; y < iy0 + ih; y++)
            for (let x = ix0; x < ix0 + iw; x++) {
              const ex = (x - ix0) / iw - 0.5, ey = (y - iy0) / ih - 0.5;
              // the parchment, foxed toward its edges
              pix.set(x, y, 0.6 - (ex * ex + ey * ey) * 0.5 + (hashInt(x >> 1, y >> 1, 61) - 0.5) * 0.08, paper);
              // the lake: an inked shoreline, the water hatched in rows
              const shore = 0.36 + (fbm(x / 9, y / 9, 62) - 0.5) * 0.18;
              const r = Math.sqrt(ex * ex * 1.4 + ey * ey * 2.2);
              if (r < shore && (y - iy0) % 3 === 0) pix.set(x, y, 0.42, ink);
              else if (Math.abs(r - shore) < 0.025) pix.set(x, y, 0.2, ink);
            }
          const rcx = ix0 + Math.round(iw * 0.55), rcy = iy0 + Math.round(ih * 0.45), rr = Math.round(Math.min(iw, ih) * 0.22);
          for (let a = 0; a < 360; a += 3) pix.set(Math.round(rcx + Math.cos((a * Math.PI) / 180) * rr * 1.4), Math.round(rcy + Math.sin((a * Math.PI) / 180) * rr * 0.7), 0.1, ink);
          for (let k = 0; k < 14; k += 2) pix.set(ix0 + Math.round(iw * 0.18) + k * 2, iy0 + Math.round(ih * 0.72) - k, 0.12, ink);
          const lx = ix0 + Math.round(iw * 0.82), ly = iy0 + Math.round(ih * 0.3);
          for (let k = -2; k <= 2; k++) {
            pix.set(lx + k, ly, 0.9, R("red"));
            pix.set(lx, ly + k, 0.9, R("red"));
          }
          pix.rect(ix0 + iw - 12, iy0 + ih - 9, 11, 8, { row: paper, shade: (_x, y) => (y === iy0 + ih - 9 ? 0.85 : 0.72) });
          for (const ny of [iy0 + ih - 6, iy0 + ih - 4]) pix.rect(ix0 + iw - 10, ny, 7, 1, { row: ink, shade: 0.3 });
          for (const [px2, py2] of [[x0 + 2, y0 + 2], [x0 + cw - 3, y0 + 2]] as const) pix.set(px2, py2, 0.9, R("iron"));
        }
        // a pair of ferry oars crossed on two iron pegs: shafts, grips, blades worn pale at the tips,
        // their shadow on the logs down and to the right
        if (o.oars) {
          const [ocx, ocy] = o.oars;
          const cx0 = X(ocx), half = Math.round(P * 0.62);
          for (const pass of [0, 1])
            for (const dir of [1, -1]) {
              const ax = cx0 - dir * half, ay = ocy + half, bx = cx0 + dir * half, by = ocy - half;
              const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
              for (let k = 0; k <= n; k++) {
                const t = k / n;
                const x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t);
                const blade = t < 0.3;
                const w = blade ? 3 + Math.round(Math.sin((t / 0.3) * Math.PI * 0.5 + 0.6) * 3) : t > 0.92 ? 2 : 1;
                for (let q = -w; q <= w; q++) {
                  if (pass === 0) {
                    pix.setShade(x + q + 3, y + 3, pix.shadeAt(x + q + 3, y + 3) - 0.07);
                    continue;
                  }
                  // varnished ash: a bright lit edge, a lighter body than the logs behind
                  let sh = q === -w ? 0.86 : q === w ? 0.3 : 0.62;
                  if (blade && t < 0.05) sh += 0.1;
                  if (blade && Math.abs(t - 0.3) < 0.012) sh = 0.2;
                  if (!blade && t > 0.92) sh -= 0.14;
                  pix.set(x + q, y, sh, R("oar"));
                }
              }
            }
          // each oar rests on its own peg, just under the shaft near its grip
          for (const dx of [-Math.round(half * 0.5), Math.round(half * 0.5)]) {
            const py0 = ocy - Math.round(half * 0.5) + 3;
            pix.rect(cx0 + dx - 1, py0, 3, 3, { row: R("iron"), shade: (x, y) => (x === cx0 + dx - 1 || y === py0 ? 0.7 : 0.3) });
          }
        }
        // the room's values gathered round its lights: logs away from the stove, the candles, the
        // lantern and the windows sink darker, so the lit places read as pools, not an even brown
        {
          const reach = (x: number, y: number): number => {
            let l = 0;
            for (const [wx, wy, wr] of o.warm) l = Math.max(l, 1 - Math.hypot(x - X(wx), (y - wy) * 1.15) / (wr * 1.45));
            for (const wn of o.windows) l = Math.max(l, (1 - Math.hypot(x - (X(wn.x) + wn.w / 2), (y - (wn.y + wn.h / 2)) * 1.2) / (wn.w * 2.6)) * 0.85);
            return Math.max(0, Math.min(1, l));
          };
          for (let y = 0; y < H; y++)
            for (let x = ox; x < W - ox; x++) {
              if (!pix.solid(x, y)) continue;
              const k = reach(x, y);
              pix.setShade(x, y, pix.shadeAt(x, y) - 0.14 * (1 - k) * (1 - k) + 0.04 * k * k);
            }
        }
        // the thick outer walls beyond the room's ends (the view is wider than the room)
        pix.rect(0, 0, ox, H, { row: timber, shade: (x) => (x === ox - 1 ? 0.4 : 0.08) });
        pix.rect(W - ox, 0, ox, H, { row: timber, shade: (x) => (x === W - ox ? 0.4 : 0.08) });
        // windows: a hole with a deep frame, a cross of muntins, a sill; the sky door's opening
        for (const wn of o.windows) {
          const x0 = X(wn.x);
          const fw = Math.round(P * 0.1);
          pix.rect(x0 - fw, wn.y - fw, wn.w + fw * 2, wn.h + fw * 2, { row: frame, shade: (x, y) => (y === wn.y - fw || x === x0 - fw ? 0.5 : 0.3) });
          for (let y = wn.y; y < wn.y + wn.h; y++) for (let x = x0; x < x0 + wn.w; x++) pix.clear(x, y);
          pix.rect(x0 + (wn.w >> 1) - 1, wn.y, 3, wn.h, { row: frame, shade: 0.3 });
          pix.rect(x0, wn.y + (wn.h >> 1) - 1, wn.w, 3, { row: frame, shade: 0.3 });
          pix.rect(x0 - fw - 3, wn.y + wn.h + fw, wn.w + fw * 2 + 6, Math.round(P * 0.06), { row: timber, shade: (_x, y) => (y === wn.y + wn.h + fw ? 0.7 : 0.35) });
        }
        const sd = o.skyDoor;
        for (let y = sd.y; y < sd.y + sd.h; y++) for (let x = X(sd.x); x < X(sd.x) + sd.w; x++) pix.clear(x, y);
        // the stair's handrail: a rail on posts along the treads
        const [rx0, ry0, rx1, ry1] = o.rail;
        const railUp = Math.round(P * 0.7);
        for (let x = X(rx0); x <= X(rx1); x++) {
          const t = (x - X(rx0)) / Math.max(1, X(rx1) - X(rx0));
          const y = Math.round(ry0 + (ry1 - ry0) * t) - railUp;
          pix.rect(x, y, 1, 3, { row: timber, shade: 0.6 });
          pix.set(x, y + 3, 0.12, timber);
        }
        for (let k = 0; k <= 5; k++) {
          const t = k / 5;
          const x = Math.round(X(rx0) + (X(rx1) - X(rx0)) * t);
          const y = Math.round(ry0 + (ry1 - ry0) * t);
          pix.rect(x - 1, y - railUp, 3, railUp, { row: timber, shade: (xx) => (xx === x - 1 ? 0.5 : 0.25) });
        }
        L.push({ kind: "pix", name: "wall", depth: WALL, fog: 0, pix, x: 0, y: 0, dither: 0.1 });
      }

      // morning light through the west windows, visible in the dust; a warm wash by the stove
      L.push({
        kind: "glsl",
        name: "window-beams",
        depth: WALL,
        fog: 0,
        blend: "add",
        body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float w = windowLight(p);
  if (w <= 0.0) return vec4(0.0);
  return vec4(ramp(R_BEAM, 0.55, p, 0.0), w * ${f(ev ? 0.07 : 0.12)});
}`,
      });
      L.push({
        kind: "glsl",
        name: "warm-wash",
        depth: WALL,
        fog: 0,
        blend: "add",
        body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float w = warmLight(p);
  if (w <= 0.0) return vec4(0.0);
  return vec4(ramp(R_WARMWALL, 0.5, p, 0.0), w * ${f(ev ? 0.11 : 0.07)});
}`,
      });
      L.push({
        kind: "points",
        name: "dust",
        depth: 1.02,
        blend: "add",
        system: new Motes({ region: [ox, o.ceiling, W - ox, o.floor], count: 90, row: R("dust"), shade: [0.3, 0.9], vel: [2, -1.2], wander: 3, size: 1, twinkle: 0.5 }, ctx.rng),
      });
      void H;
      return L;
    },
  };
}

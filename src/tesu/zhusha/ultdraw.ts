// The stand-ins for R and the ult form (lane U, 10-19): CLEARLY TEMPORARY flat shapes, drawn on the game's own clock
// from ult.ts / ultform.ts state, until the FX v2 loop's effects (lanes/fx/v2/built/, played through
// lanes/engine/EFFECTS-CONTRACT.md) and lane A's r_* drawings land. They show where, how big and when: the letter carved
// piece by piece by the slash storm (each slash a white-hot streak; each piece it carves white-hot, cooling to vermilion
// ink with her blue fire along it), shattering as she dives through it; her dive's vertical blur and its line; the nuke
// (the white / orange / red first flash, her blue flames engulfing it, the column, the ground thrown up; the wreck
// burning out under the smoke, which clears slowly, outward, off her: it hides the change, never her form after); the
// ghost blades.
// Side-on and flat (Dex 10-19: no rings on the ground). The letter is never mirrored: it is drawn in world space as
// written, wherever her facing put it.

import type { RGB } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { H } from "../config.ts";
import type { Zhusha } from "./controller.ts";
import { along, letterAt, letterStrokes, ULT } from "./ult.ts";

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const VERM = hex("#d8232c"), VERM_DARK = hex("#7a0d14"), WHITE = hex("#fff8ee"), AZURE = hex("#6fc8ff"), AZURE_DEEP = hex("#2a6fb8");
const AZURE_CORE = hex("#e8fbff"), ROCK = hex("#4a4048"), ROCK_LITE = hex("#7d7280"), ORANGE = hex("#ff9a3c");
const DUST_LITE = hex("#f1ebe1"), DUST = hex("#d2c9be"), DUST_DARK = hex("#9d929a");

/** A solid quad centred at (x, y), w x h, rotated; opacity dithers (hard pixels). */
function quad(r: WorldRenderer, x: number, y: number, w: number, h: number, rot: number, c: RGB, opacity = 1): void {
  if (opacity <= 0.02 || w < 0.5 || h < 0.5) return;
  r.vfx({
    type: 0, t: 0, seed: 0, over: 1, p0: [Math.min(1, opacity), 0, 0, 0], p1: [0, 0, 0, 0], core: c, main: c, edge: c,
    x: Math.round(x), y: Math.round(y), rot, sx: 1, sy: 1, ext: [-w / 2, -h / 2, w / 2, h / 2],
  });
}

/** A segment from (x0, y0) to (x1, y1), th thick. */
function seg(r: WorldRenderer, x0: number, y0: number, x1: number, y1: number, th: number, c: RGB, opacity = 1): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 0.5) return;
  quad(r, (x0 + x1) / 2, (y0 + y1) / 2, len + th * 0.6, th, Math.atan2(y1 - y0, x1 - x0), c, opacity);
}

/** A banded puff (smoke, dust, the flash): core / main / edge in hard steps. */
function puff(r: WorldRenderer, x: number, y: number, R: number, t: number, seed: number, core: RGB, main: RGB, edge: RGB): void {
  if (R < 2) return;
  r.vfx({
    type: 6, t, seed, over: 1, p0: [R, R, 0.85, 0], p1: [0, 0, 0, 0], core, main, edge,
    x: Math.round(x), y: Math.round(y), rot: 0, sx: 1, sy: 1, ext: [-R - 2, -R - 2, R + 2, R + 2],
  });
}

/** A flash of light (added, not painted): core / main / a dithered edge that falls off to nothing. */
function puffLight(r: WorldRenderer, x: number, y: number, R: number, t: number, core: RGB, main: RGB, edge: RGB): void {
  if (R < 2) return;
  r.vfx({
    type: 6, t, seed: 0, over: 0, p0: [R, R, 0.85, 0], p1: [0, 0, 0, 0], core, main, edge,
    x: Math.round(x), y: Math.round(y), rot: 0, sx: 1, sy: 1, ext: [-R - 2, -R - 2, R + 2, R + 2],
  });
}

const clamp01 = (u: number): number => Math.max(0, Math.min(1, u));
const easeOut = (u: number): number => { const k = clamp01(u); return 1 - (1 - k) * (1 - k); };
const rnd = (i: number): number => { const a = Math.sin(i * 91.7 + 3.1) * 43758.5453; return a - Math.floor(a); };

/** Behind her: the letter and the dive's line. */
export function drawUltBack(r: WorldRenderer, z: Zhusha): void {
  letter(r, z);
  if (z.streak && !z.r.real.dive) diveLine(r, z);
}

/** In front of her: the storm's slashes, the nuke, the ghost blades. */
export function drawUltFront(r: WorldRenderer, z: Zhusha): void {
  slashes(r, z);
  if (z.smoke && !z.r.real.nuke) nuke(r, z.smoke);
  blades(r, z);
}

/** The letter as carved so far: each carved piece white-hot, cooling to vermilion ink with her blue fire along it. */
function letter(r: WorldRenderer, z: Zhusha): void {
  const d = z.r, st = d.stage;
  if (!st || d.real.letter || !d.active || d.cut === 0 || d.phase === "impact" || d.phase === "reveal") return;
  const strokes = letterStrokes(), T = d.stormT, peel = d.peel;
  const th = Math.max(6, Math.round(st.size * ULT.letter.thick));
  // each carved piece as segments (overlapping its neighbours so a stroke reads whole), how far it has shattered
  const parts: { pts: [number, number][]; op: number; hot: boolean; i: number }[] = [];
  for (let i = 0; i < d.cut; i++) {
    const sl = d.slashes[i]!;
    if (!sl.carves) continue;
    const s = strokes[sl.stroke]!;
    const u0 = Math.max(0, sl.u0 - 0.03), u1 = Math.min(1, sl.u1 + 0.03);
    const pts = [u0, (u0 + u1) / 2, u1].map((u) => letterAt(st, ...along(s, u)));
    // in the dive the letter breaks apart from her line outward: pieces jolt, fall and are gone
    const k = peel > 0 ? clamp01(peel * 2.2 - Math.abs(pts[1]![0] - st.zx) / (st.size * 0.55)) : 0;
    if (k >= 1) continue;
    const jx = k > 0 ? (rnd(i) - 0.5) * 40 * k : 0, jy = k * k * 120;
    parts.push({ pts: pts.map(([x, y]) => [x + jx, y + jy] as [number, number]), op: 1 - k, hot: T - sl.at < 3, i });
  }
  const each = (fn: (x0: number, y0: number, x1: number, y1: number, p: (typeof parts)[number]) => void): void => {
    for (const p of parts) for (let j = 0; j < 2; j++) fn(p.pts[j]![0], p.pts[j]![1], p.pts[j + 1]![0], p.pts[j + 1]![1], p);
  };
  // in passes, so the strokes read as whole strokes: her fire, the dark rim, the ink, the fire's core
  each((x0, y0, x1, y1, p) => { if (!p.hot) seg(r, x0, y0, x1, y1, th + (Math.sin(T * 0.6 + p.i * 1.3) > 0.2 ? 12 : 8), AZURE, 0.7 * p.op); });
  each((x0, y0, x1, y1, p) => seg(r, x0, y0, x1, y1, th + 4, p.hot ? AZURE_CORE : VERM_DARK, p.op));
  each((x0, y0, x1, y1, p) => seg(r, x0, y0, x1, y1, th, p.hot ? WHITE : VERM, p.op));
  each((x0, y0, x1, y1, p) => { if (!p.hot) seg(r, x0, y0, x1, y1, Math.max(2, th * 0.2), AZURE_CORE, 0.5 * p.op); });
}

/** The storm's live slashes: white-hot streaks crossing the piece they carve, from every direction, gone in a few ticks
 * (until the real letter's cuts are in: ult.json fx.cuts). */
function slashes(r: WorldRenderer, z: Zhusha): void {
  const d = z.r, st = d.stage;
  // (into the stop: the closing cut fades out over its first ticks)
  if (!st || d.real.cuts || (d.phase !== "flurry" && d.phase !== "hold") || d.stormT < 0) return;
  const strokes = letterStrokes(), T = d.stormT, life = ULT.letter.slashLife, scale = st.size / (7 * H);
  for (let i = d.cut - 1; i >= 0; i--) {
    const sl = d.slashes[i]!;
    const age = T - sl.at;
    if (age >= life + (sl.sweep ? 6 : 0)) {
      if (age > life + 8) break;
      continue;
    }
    const s = strokes[sl.stroke]!;
    const [cx, cy] = letterAt(st, ...along(s, (sl.u0 + sl.u1) / 2));
    const big = sl.sweep;
    const L = big ? st.size * 1.1 : sl.len * H * scale;
    const k = age / (life + (big ? 6 : 0));
    // the streak runs on past its piece as it fades (a cut that already happened)
    const run = (0.15 + 0.5 * k) * L, ux = Math.cos(sl.ang), uy = Math.sin(sl.ang);
    const x0 = cx - ux * (L * 0.5 - run * 0.3), y0 = cy - uy * (L * 0.5 - run * 0.3), x1 = cx + ux * (L * 0.5 + run), y1 = cy + uy * (L * 0.5 + run);
    const th = (big ? 22 : 9) * (1 - k * 0.7);
    seg(r, x0, y0, x1, y1, th + 6, AZURE, 1 - k);
    seg(r, x0, y0, x1, y1, Math.max(2, th * 0.45), WHITE, 1 - k * 0.6);
    if (age < 1) quad(r, cx, cy, th * 2.4, th * 2.4, sl.ang, WHITE, 1);
  }
}

/** The dive's line from the zenith to her, thinning as it fades. */
function diveLine(r: WorldRenderer, z: Zhusha): void {
  const s = z.streak!;
  const life = s.life / ULT.dive.lineLife;
  const th = Math.max(2, 22 * life);
  seg(r, s.x0, s.y0, s.x1, s.y1, th + 8, AZURE_DEEP, Math.min(1, life * 1.2));
  seg(r, s.x0, s.y0, s.x1, s.y1, th + 2, AZURE, Math.min(1, life * 1.4));
  seg(r, s.x0, s.y0, s.x1, s.y1, Math.max(1, th * 0.45), AZURE_CORE, Math.min(1, life * 1.6));
}

/** Her in the dive: a vertical blur (a stand-in), stretched along the fall, speed lines above. */
export function drawDiveBlur(r: WorldRenderer, z: Zhusha, bodyH: number): void {
  const b = z.body, t = z.anim.t;
  const w = 0.3 * bodyH, h = 1.7 * bodyH;
  const cy = b.y - h / 2;
  quad(r, b.x, cy, w + 6, h + 6, 0, AZURE_DEEP, 0.9);
  quad(r, b.x, cy, w + 2, h + 2, 0, AZURE, 1);
  quad(r, b.x, cy + h * 0.1, w * 0.45, h * 0.8, 0, AZURE_CORE, 1);
  for (let i = 0; i < 5; i++) {
    const ox = (rnd(i + t * 3) - 0.5) * w * 2.6;
    const len = (0.8 + rnd(i * 5 + t) * 1.4) * bodyH;
    quad(r, b.x + ox, b.y - h - len / 2 + rnd(i + 9) * 10, 2, len, 0, i % 2 ? AZURE : WHITE, 0.7);
  }
}

/**
 * The nuke and its aftermath (Dex 10-19: stay on the destruction; the smoke takes a while to clear): the first flash
 * (white / orange / red), her blue flames engulfing it, the column of light where the point went in, the ground thrown
 * up; then the wreck (rubble settled across the crater, embers rising, her flames burning out across it) under a dense
 * pall of smoke and dust, which clears slowly (outward and up, the middle first) so she is revealed as it thins.
 */
function nuke(r: WorldRenderer, sm: { x: number; y: number; t: number; life: number }): void {
  const I = ULT.impact, A = ULT.aftermath;
  const t = sm.t, Th = I.ticks + A.hold, Tc = Th + A.clear;
  // the first flash: white at the heart, orange, a red rim, swelling and gone as her flames take it
  if (t < I.flash + 6) {
    const u = t / (I.flash + 6), R = (1.5 + 4.5 * easeOut(t / I.flash)) * H * (1 - 0.5 * clamp01((t - I.flash) / 6));
    puffLight(r, sm.x, sm.y - 1.6 * H, R, 0.05 + 0.6 * u, WHITE, ORANGE, VERM);
  }
  // the wreck: rubble settled across the crater (from when the thrown slabs come down), fading as the smoke clears
  const wreck = t < 30 ? 0 : t < 40 ? (t - 30) / 10 : 1 - clamp01((t - (Tc - 40)) / 40);
  if (wreck > 0) {
    for (let i = 0; i < 26; i++) {
      const x = sm.x + (rnd(i + 80) - 0.5) * 12 * H * (0.3 + 0.7 * rnd(i + 81));
      const s = (0.12 + rnd(i + 82) * 0.3) * H;
      quad(r, x, sm.y - s * 0.3, s, s * 0.6, (rnd(i + 83) - 0.5) * 1.2, ROCK, wreck);
      quad(r, x - 1, sm.y - s * 0.45, s * 0.5, s * 0.25, (rnd(i + 83) - 0.5) * 1.2, ROCK_LITE, wreck);
    }
  }
  // her blue flames: tongues rise around the crater, engulf the flash, then spread across the wreck and burn out
  const fl = t < 4 ? 0 : t < 14 ? (t - 4) / 10 : Math.max(0, 1 - (t - 14) / (Th + A.clear * 0.35 - 14));
  if (fl > 0) {
    const spread = 1 + 1.3 * clamp01((t - 14) / Math.max(1, Th - 14));
    for (let i = 0; i < 22; i++) {
      const ox = (rnd(i) - 0.5) * 6.5 * H * spread;
      // the far ones die first: a fire burning out from its edges in
      const life = fl * (1 - 0.5 * Math.abs(ox) / (6.5 * H * spread));
      const hh = (1 + rnd(i + 5) * 5.5) * H * life * (0.75 + 0.25 * Math.sin(t * 0.7 + i));
      if (hh < 6) continue;
      const w = (0.3 + rnd(i + 9) * 0.4) * H;
      for (let k = 0; k < 4; k++) {
        const y = sm.y - (k + 0.5) * (hh / 4), ww = w * (1 - k * 0.22) + Math.sin(t * 0.9 + i * 2 + k) * 4;
        const x = sm.x + ox + Math.sin(t * 0.5 + i + k) * 6;
        quad(r, x, y, ww + 8, hh / 4 + 2, 0, AZURE_DEEP, 0.85);
        quad(r, x, y, ww, hh / 4 + 2, 0, AZURE, 0.9);
        quad(r, x, y, ww * 0.4, hh / 4 + 2, 0, AZURE_CORE, 0.9);
      }
    }
  }
  // embers rising off the wreck, thinning as it burns out
  if (t > 10 && t < Tc) {
    const n = Math.round(40 * Math.max(0.15, fl));
    for (let i = 0; i < n; i++) {
      const cyc = 90 + rnd(i + 120) * 60, ph = ((t + rnd(i + 121) * cyc) % cyc) / cyc;
      const x = sm.x + (rnd(i + 122) - 0.5) * 11 * H + Math.sin(t * 0.05 + i) * 10;
      const y = sm.y - ph * 5 * H;
      quad(r, x, y, 3, 3, 0, i % 3 ? AZURE : ORANGE, 1 - ph);
    }
  }
  // the column of light where the point went in (narrowing, gone as the dust peaks)
  if (t < 26) {
    const k = 1 - t / 26, hh = 10 * H * (0.4 + 0.6 * Math.min(1, t / 4));
    quad(r, sm.x, sm.y - hh / 2, 1.4 * H * k + 4, hh, 0, AZURE, k);
    quad(r, sm.x, sm.y - hh / 2, 0.5 * H * k + 2, hh, 0, AZURE_CORE, k);
  }
  // the ground thrown up: slabs out of the crater, up and falling back
  if (t < 40) {
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const vx = side * (1 + rnd(i) * 4), vy = -(7 + rnd(i + 3) * 9);
      const x = sm.x + vx * t + side * rnd(i + 7) * 0.6 * H;
      const y = sm.y + vy * t + 0.3 * t * t;
      if (y > sm.y + 4) continue;
      const s = (0.2 + rnd(i + 11) * 0.4) * H;
      quad(r, x, y, s, s * 0.7, t * 0.2 * side + i, ROCK, 1);
      quad(r, x - 1, y - 1, s * 0.6, s * 0.3, t * 0.2 * side + i, ROCK_LITE, 1);
    }
  }
  // the smoke and dust: a column rolls up into a cap, a skirt rolls out along the ground; it hangs over the wreck (a
  // slow billow), then clears over `clear` ticks: drifting outward and up, the middle first, gone before the reveal
  // ends (it hides the change, never her form after)
  const grow = easeOut(t / I.ticks), hang = clamp01((t - I.ticks) / Math.max(1, A.hold));
  const out = clamp01((t - Th) / A.clear);
  if (out >= 1) return;
  const ps: [number, number, number][] = [];
  for (let i = 0; i < 12; i++) ps.push([(rnd(i) - 0.5) * 1.8 * H, (0.4 + i * 0.5) * H * grow, (0.7 + rnd(i + 2) * 0.5) * H]);
  if (t > 6) for (let i = 0; i < 8; i++) ps.push([(i - 3.5) * 0.8 * H, 6 * H * grow + (rnd(i + 20) - 0.5) * 0.6 * H, (0.8 + rnd(i + 21) * 0.5) * H * Math.min(1, (t - 6) / 10)]);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    ps.push([side * (1 + Math.floor(i / 2) * 0.9) * H * (0.4 + 0.6 * grow + 0.4 * hang), 0.4 * H, (0.55 + rnd(i + 40) * 0.3) * H * (1 + 0.3 * hang)]);
  }
  // the core: dense puffs right where she stands, the last of the smoke to go (they go as she is revealed)
  for (let i = 0; i < 4; i++) ps.push([(i - 1.5) * 0.3 * H, (0.3 + 0.3 * i) * H * grow, 0.6 * H * grow]);
  ps.forEach(([hx, hy, R0], i) => {
    const side = hx < 0 ? -1 : 1;
    // the nearer the middle, the sooner it goes: the middle is gone at aftermath.coreGone, just after she steps out of it
    // (revealFrom); the edges drift off over the rest of the clear
    const near = 1 - clamp01(Math.abs(hx) / (6 * H));
    const o = clamp01(out * (1 + (1 / A.coreGone - 1) * near));
    const billow = 1 + 0.06 * Math.sin(t * 0.04 + i) + 0.15 * hang;
    // (a puff keeps its body until late in its clear, then goes: no empty middle before she is there)
    const R = R0 * billow * (1 + 0.25 * o) * (1 - o * o * o);
    // it drifts off slowly at first, then away (o squared): the middle stays covered until it goes
    const go = o * o;
    puff(r, sm.x + hx + side * go * (2 + rnd(i + 60) * 2) * H, sm.y - hy - hang * 0.4 * H - go * 1.2 * H, R, 0.08 + 0.5 * o, i, DUST_LITE, DUST, DUST_DARK);
  });
}

/** The ghost blades (stand-ins: a broad jian's silhouette in azure light), summoned, striking, fading. */
function blades(r: WorldRenderer, z: Zhusha): void {
  // FX v2's ghost blades play instead (ultform.ts)
  if (z.uf.real) return;
  const F = ULT.form, clock = z.uf.clock, L = F.bladeLen * H;
  for (const bl of z.uf.blades) {
    if (clock < bl.born) continue;
    const ang = Math.atan2(bl.y1 - bl.y0, bl.x1 - bl.x0);
    let x = bl.x0, y = bl.y0, op: number;
    if (clock < bl.at) op = 0.3 + 0.6 * ((clock - bl.born) / Math.max(1, bl.at - bl.born));
    else {
      const u = Math.min(1, (clock - bl.at) / F.strike);
      x = bl.x0 + (bl.x1 - bl.x0) * u;
      y = bl.y0 + (bl.y1 - bl.y0) * u;
      op = u < 1 ? 1 : Math.max(0, 1 - (clock - bl.at - F.strike) / F.fade);
      // the strike's streak from where it was summoned
      if (u > 0 && op > 0.2) seg(r, bl.x0, bl.y0, x, y, 6 * op, AZURE, 0.6 * op);
    }
    // the blade: its point toward the strike; the body, a white edge line, the guard and the grip behind it
    const cx = Math.cos(ang), sy = Math.sin(ang);
    const bx = x - cx * L * 0.5, by = y - sy * L * 0.5;
    quad(r, bx, by, L, 0.11 * H, ang, AZURE_DEEP, op);
    quad(r, bx, by, L - 4, 0.11 * H - 4, ang, AZURE, op);
    quad(r, bx, by, L - 8, 2, ang, AZURE_CORE, op);
    quad(r, x - cx * L - cx * 4, y - sy * L - sy * 4, 4, 0.26 * H, ang, AZURE_DEEP, op);
    quad(r, x - cx * (L + 0.14 * H), y - sy * (L + 0.14 * H), 0.2 * H, 4, ang, AZURE, op);
  }
}

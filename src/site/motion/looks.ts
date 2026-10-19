// How the website moves (Dex 10-19: "the motion feels cheap: experiment and transform what we have further"). Three
// looks, one live at a time (html[data-motion], set by main.ts from ?motion= or the default), each a whole language:
//
// - "diorama": the world has depth and the scroll is the camera. Inside every window the near things move more than
//   the far ones as the page scrolls (the sky barely, the karst a little, the palace, the pine and the towers most),
//   in whole pixels; a window's hole tears open as it rises into view (and closes again if you go back before it
//   has); the content on the paper stays still: the paper is flat, the world behind it is deep.
// - "dust": the "dex" mark's dust is the site's language. A window is white paper until it comes into view, then the
//   paper blows away left to right as pixel dust on the mark's wind; the sections' blocks arrive in four ordered-dither
//   steps as they scroll in (CSS, styles/v2.css).
// - "cuts": anime limited animation, shots and holds. A window blinks open in three frames on twos (an ink slit, half,
//   whole), then its camera pans slowly across the place and holds; the sections' blocks land in three frames with an
//   overshoot; on a desktop the scroll settles on each section like a shot (proximity snapping).
//
// Every look: reduced motion = still (windows drawn once, nothing arrives, nothing pans); content never waits on a
// script (a block is always visible; the looks only add motion as it comes).

import type { Look } from "./look-mode.ts";
import type { ScenePiece, WindowMotion, WinState } from "./windows.ts";

// how near each kind of thing is (0 the sky .. 1 the nearest), unless a piece says
const NEAR: Readonly<Record<string, number>> = {
  walker: 0.15, "op.farkarst": 0.2, "op.birds": 0.5, "op.isle": 0.7, "op.islet": 0.3, "op.boat": 0.45,
  "op.palace": 0.75, "op.tower": 0.95, "op.pine": 1, "op.doors": 0.85, "op.banners": 1,
};
const nearOf = (pc: ScenePiece): number => {
  if (pc.z !== undefined) return pc.z;
  if (pc.kind === "op.cloud") {
    const k = (pc.p as { kind?: string }).kind;
    return (k === "wisp" || k === "stratus" ? 0.3 : 0.45) * (1 - (pc.haze ?? 0) * 0.5);
  }
  return NEAR[pc.kind] ?? 0.5;
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** How far the window's band has come through the screen: -0.5 entering at the foot .. 0.5 leaving at the top. */
const through = (s: WinState): number => clamp01((s.vh - s.bandTop) / (s.vh + (s.bandBottom - s.bandTop))) - 0.5;

// a fixed scatter for the rough edges of tears and sweeps (one per page; indexed by pixel)
let grain: Uint8Array | null = null;
const grainOf = (n: number): Uint8Array => {
  if (grain && grain.length >= n) return grain;
  grain = new Uint8Array(n);
  let h = 2166136261;
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (i * 2654435761), 16777619) >>> 0;
    h ^= h >>> 13;
    grain[i] = h & 255;
  }
  return grain;
};

const PAPER = 255;
const paper = (out: Uint8ClampedArray, i: number): void => {
  const j = i * 4;
  out[j] = PAPER; out[j + 1] = PAPER; out[j + 2] = PAPER; out[j + 3] = 255;
};

/** The world with depth: the scroll is the camera; the hole tears open as the window rises into view. */
export const diorama: WindowMotion = {
  fps: 12,
  scrollLinked: true,
  offset(s, pc) {
    const a = s.H * 0.06;
    return [0, Math.round(-through(s) * 2 * nearOf(pc) * a)];
  },
  backOffset(s) {
    return [0, Math.round(-through(s) * 2 * 0.2 * s.H * 0.06)];
  },
  coverKey: (s) => tearExtra(s),
  cover(s, fieldOf, out) {
    const extra = tearExtra(s);
    if (extra <= 0) return false;
    const field = fieldOf();
    const g = grainOf(field.length);
    const q = extra * 4;
    for (let i = 0; i < field.length; i++) if (field[i]! < q + (g[i]! >> 5)) paper(out, i);
    return true;
  },
};

/** How much more paper than the finished tear a rising window still has (whole art px): the hole opens as the window
 *  comes up from the foot of the screen, done by the time its top is 45% of the way up. */
function tearExtra(s: WinState): number {
  const open = clamp01((s.vh - s.top) / (s.vh * 0.55));
  const o = 1 - (1 - open) * (1 - open);
  return Math.floor((1 - o) * Math.min(s.W, s.H) * 0.5);
}

/** The paper blows away as the "dex" mark's dust, left to right, when the window comes into view. */
export const dust: WindowMotion = {
  fps: 12,
  cover(s, _field, out, now) {
    const { W, H } = s;
    const n = W * H;
    if (s.arrived < 0) {
      for (let i = 0; i < n; i++) paper(out, i);
      return true;
    }
    const a = (now - s.arrived) / 1000;
    const SWEEP = 0.8, LIFE = 0.6;
    if (a > SWEEP + LIFE) return false;
    const g = grainOf(n);
    for (let y = 0; y < H; y++) {
      // the front wavers row by row (a slow wave and a little grain), like the mark's sweep
      const row = 0.12 * Math.sin(y * 0.05 + s.index) + 0.06 * Math.sin(y * 0.23 + s.index * 3);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const gi = g[i]!;
        const tr = clamp01((x / W) * 0.82 + 0.12 + row + (gi & 15) / 160) * SWEEP;
        if (a < tr) { paper(out, i); continue; }
        // one in eight of the released pixels flies off as dust: right on the wind, gusting harder, fluttering
        if (gi > 32) continue;
        const life = 0.18 + (gi / 32) * 0.42;
        const age = a - tr;
        if (age >= life) continue;
        const u = age / life;
        const px = Math.round(x + (70 + gi * 4) * age + 0.5 * 300 * age * age);
        const py = Math.round(y + (gi / 32 - 0.5) * 10 * age + (1.5 + (gi & 3)) * Math.sin(gi + age * 22) * Math.min(1, age * 7));
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const j = (py * W + px) * 4;
        // white, cooling to pale rose; three clean steps of strength, then gone
        out[j] = 255 - Math.round(19 * u); out[j + 1] = 255 - Math.round(65 * u); out[j + 2] = 255 - Math.round(57 * u);
        out[j + 3] = u < 0.5 ? 255 : u < 0.78 ? 158 : 77;
      }
    }
    return true;
  },
};

/** Two frames of a 24 fps film: the beat everything in "cuts" moves on (ms). */
const TWO = 1000 / 12;
const INK: readonly [number, number, number] = [43, 34, 51];

/** Shots: the window blinks open in three frames on twos, then its camera pans across the place and holds. */
export const cuts: WindowMotion = {
  fps: 12,
  offset(s, pc, _i, now) {
    if (s.arrived < 0) return [0, 0];
    // after the blink, a slow pan (on twos), eased out, then held; every other window pans the other way
    const tq = Math.floor((now - s.arrived) / TWO) * TWO;
    const u = clamp01((tq - TWO * 3) / 2800);
    const e = 1 - Math.pow(1 - u, 3);
    const dir = s.index % 2 ? 1 : -1;
    return [Math.round(dir * e * s.W * 0.04 * (pc.kind === "walker" ? 0.5 : 1)), 0];
  },
  cover(s, fieldOf, out, now) {
    const { W, H } = s;
    const n = W * H;
    const f = s.arrived < 0 ? -1 : Math.floor((now - s.arrived) / TWO);
    if (f >= 3) return false;
    const field = fieldOf();
    // frame 0: an ink slit (the impact frame), 1: the slit opens on the place, 2: half, then whole
    const half = f < 0 ? -1 : [0.05, 0.16, 0.38][f]! * H;
    const cy = H / 2;
    for (let y = 0; y < H; y++) {
      const dy = Math.abs(y + 0.5 - cy);
      const inSlit = dy < half;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!inSlit) { paper(out, i); continue; }
        // (the ink only inside the tear: the paper round it stays paper)
        if (field[i]! >= 0 && (f === 0 || dy > half - 2)) {
          const j = i * 4;
          out[j] = INK[0]; out[j + 1] = INK[1]; out[j + 2] = INK[2]; out[j + 3] = 255;
        }
      }
    }
    return n > 0;
  },
};

export const LOOK: Readonly<Record<Look, WindowMotion>> = { diorama, dust, cuts };

/**
 * "cuts": the sections' blocks land in three frames on twos as they come in (styles/v2.css .is-cut). A block is
 * visible all along; this only adds the landing when it enters from below.
 */
export function initCutEntries(reduced: MediaQueryList): void {
  if (reduced.matches || typeof IntersectionObserver !== "function") return;
  const items = document.querySelectorAll<HTMLElement>(".band > .sec > .wrap > *, .band > .page > .wrap > *");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      // only what comes up from below lands (not what was already on screen, or comes down from above)
      if (e.boundingClientRect.top > innerHeight * 0.5) e.target.classList.add("is-cut");
      io.unobserve(e.target);
    }
  }, { threshold: 0 });
  items.forEach((el) => io.observe(el));
}

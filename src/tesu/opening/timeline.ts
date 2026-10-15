// The opening's timeline as pure functions of T (Track 1's time as heard, seconds from the press): where
// Zhusha is, what the camera frames, which caption shows, how far the bars are in. Everything comes from
// BEATS (beats.ts, compiled from the opening lane's BEATS.json), so a new chart drops in by re-running
// tools/opening/compile.mjs. Shared by the page (the fall, captions, bars) and the world (the camera, her,
// the talisman); no DOM, no GL, so node's tests read it directly.

import { BEATS } from "./beats.ts";

export { BEATS };

/** World px per H (config.ts; repeated so this module needs nothing from the engine). */
const HPX = 96;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (u: number): number => {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const logLerp = (a: number, b: number, t: number): number => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

// --- the bar grid -------------------------------------------------------------------------------------

/** The bar line at or after T (bars past the measured ones continue at the last bar's length). */
export function nextBarLine(T: number): number {
  const bars = BEATS.bars;
  for (const b of bars) if (b >= T) return b;
  const last = bars[bars.length - 1]!, len = last - bars[bars.length - 2]!;
  return last + Math.ceil((T - last) / len) * len;
}

/** One beat at T (a quarter of the bar it is in). */
export function beatAt(T: number): number {
  const bars = BEATS.bars;
  for (let i = 1; i < bars.length; i++) if (T < bars[i]!) return (bars[i]! - bars[i - 1]!) / 4;
  return (bars[bars.length - 1]! - bars[bars.length - 2]!) / 4;
}

// --- her path, hands-free -----------------------------------------------------------------------------

export type HerPhase = "hold" | "walk" | "break" | "run" | "skid" | "stand";

const her = BEATS.her;
/** The walk is solved, not set: from the walk's start at the catch to the pickup's mark (the plan's 1.1 H/s). */
const walkSpeed = (her.xPickupH - her.catchXH) / (her.pickup - her.walkFrom);
const runFrom = her.drop1 + her.runAccel.s;
const xRun = (T: number): number => her.xBreakH + her.runAccel.h + her.runHPerS * (T - runFrom);

export function herPhase(T: number): HerPhase {
  if (T < her.walkFrom) return "hold";
  if (T < her.pickup) return "walk";
  if (T < her.drop1) return "break";
  if (T < her.skid) return "run";
  if (T < her.stop) return "skid";
  return "stand";
}

/** Her x in H at T when nobody touches anything (the cinematic drives her to the drop; after it, until the first input). */
export function herXH(T: number): number {
  switch (herPhase(T)) {
    case "hold": return her.catchXH;
    case "walk": return her.catchXH + walkSpeed * (T - her.walkFrom);
    case "break": {
      // a footfall on the pickup's hit, then she gathers and coils, held to the drop
      const u = (T - her.pickup) / (her.drop1 - her.pickup);
      return her.xPickupH + (her.xBreakH - her.xPickupH) * (1 - (1 - u) * (1 - u));
    }
    case "run": {
      const t = T - her.drop1;
      if (t < her.runAccel.s) return her.xBreakH + her.runAccel.h * (t / her.runAccel.s) ** 2;
      return xRun(T);
    }
    case "skid": {
      // a cubic from full speed to standing at the overlook (monotone: the plan's numbers keep it so)
      const d = her.stop - her.skid, u = (T - her.skid) / d;
      const x0 = xRun(her.skid), x1 = her.stopXH, v0 = her.runHPerS * d;
      const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u;
      return h00 * x0 + h10 * v0 + h01 * x1;
    }
    default: return her.stopXH;
  }
}

/** Her speed in H/s at T (hands-free). */
export function herSpeedH(T: number): number {
  const e = 1 / 240;
  return (herXH(T + e) - herXH(T - e)) / (2 * e);
}

// --- the camera ---------------------------------------------------------------------------------------

/** A framing from the world's tracks (camera.ts Framing, the parts the opening uses). */
export interface Framed {
  zoom: number;
  anchor: number;
  horizon: number;
  lead: number;
  fixX: number | null;
  pin: { x: number; at: number } | null;
}

/** The frame the opening asks for: zoom, feet row, horizon, and the world x at the frame's centre (px). */
export interface Shot {
  zoom: number;
  anchor: number;
  horizon: number;
  cx: number;
}

/** Where a framing puts the frame's centre for her at x (Camera.fixedX and its look-ahead, facing right, at rest). */
export function centreOf(f: Framed, x: number, W: number): number {
  if (f.pin) return f.pin.x - (f.pin.at - 0.5) * (W / f.zoom);
  if (f.fixX !== null) return f.fixX;
  return x + f.lead * (W / Math.min(1, f.zoom));
}

const shotOf = (f: Framed, x: number, W: number): Shot => ({ zoom: f.zoom, anchor: f.anchor, horizon: f.horizon, cx: centreOf(f, x, W) });

export function mixShot(a: Shot, b: Shot, t: number): Shot {
  const u = clamp01(t);
  return { zoom: logLerp(a.zoom, b.zoom, u), anchor: lerp(a.anchor, b.anchor, u), horizon: lerp(a.horizon, b.horizon, u), cx: lerp(a.cx, b.cx, u) };
}

const cam = BEATS.camera;
const shots = cam.shots;

/** The authored shots before the walk (held frames and moves eased in log zoom). */
function authored(T: number): Shot {
  let s: (typeof shots)[number] = shots[0]!;
  for (const k of shots) if (k.from <= T) s = k;
  const u = s.to === null ? 1 : smooth((T - s.from) / (s.to - s.from));
  return { zoom: logLerp(s.zoom[0], s.zoom[1], u), anchor: lerp(s.anchor[0], s.anchor[1], u), horizon: lerp(s.horizon[0], s.horizon[1], u), cx: lerp(s.cx[0], s.cx[1], u) * HPX };
}

/** The widest frame (the lake on the left, the palace's west gate pinned at 0.8 of the width). */
export function widestShot(W: number): Shot {
  const w = cam.widest;
  return { zoom: w.zoom, anchor: w.anchor, horizon: w.horizon, cx: w.pin.xH * HPX - (w.pin.at - 0.5) * (W / w.zoom) };
}

export interface CameraInputs {
  /** Her world x now (px). */
  x: number;
  /** The frame's width (frame px). */
  W: number;
  /** The world's tracks at x with the opening's reveal on, and with it off (the hand-back's target). */
  reveal: (x: number) => Framed;
  world: (x: number) => Framed;
  /** T at which the widest frame was let go early (she ran past the tunnel's first gate), if it was. */
  released?: number;
  reduced?: boolean;
}

/**
 * The camera at T, or null once the opening has handed the frame back to the world's tracks.
 *   to the walk:   authored shots on T (the postcard, the lazy follow, the push-in, the close band)
 *   the walk:      the reveal track keyed to her x, blended in over one beat
 *   drop 1:        the whip-out, time-locked: zoom eased in log space (u^2.2), a hard stop on the crash
 *   drop 2:        the widest frame, pinned, to TESU's fade (or until she passes the tunnel's first gate)
 *   then:          eased back in to the world's own framing at her x, which owns the frame at the hand-back
 */
export function cameraAt(T: number, k: CameraInputs): Shot | null {
  if (k.reduced) return reducedAt(T, k);
  const { x, W } = k;
  if (T < cam.reveal.from) return authored(Math.max(0, T));
  const xBreak = her.xBreakH * HPX;
  if (T < cam.whip.from) {
    const r = shotOf(k.reveal(x), x, W);
    const u = (T - cam.reveal.from) / cam.reveal.blend;
    return u < 1 ? mixShot(authored(cam.reveal.from), r, smooth(u)) : r;
  }
  const easeFrom = Math.min(cam.easeIn.from, k.released ?? Infinity);
  if (T < cam.widest.from) {
    // the whip starts where the reveal stood at the break (time-locked: the same frame whatever she does)
    const f0 = k.reveal(xBreak);
    const e = clamp01((T - cam.whip.from) / (cam.whip.to - cam.whip.from)) ** cam.whip.exp;
    const zoom = logLerp(f0.zoom, cam.whip.toZoom, e);
    const follow = x + f0.lead * (W / Math.min(1, zoom));
    const pin = cam.widest.pin.xH * HPX - (cam.widest.pin.at - 0.5) * (W / zoom);
    return { zoom, anchor: lerp(f0.anchor, cam.whip.anchor[1], e), horizon: lerp(f0.horizon, cam.whip.horizon[1], e), cx: lerp(follow, pin, e) };
  }
  if (T < easeFrom) return widestShot(W);
  const end = easeFrom + (cam.easeIn.to - cam.easeIn.from);
  if (T >= end) return null;
  return mixShot(widestShot(W), shotOf(k.world(x), x, W), smooth((T - easeFrom) / (end - easeFrom)));
}

/** Reduced motion: held frames, cut (the game cross-fades each cut) on the plan's beats. */
function reducedAt(T: number, k: CameraInputs): Shot | null {
  if (T >= BEATS.ui.handBack) return null;
  let h: (typeof cam.reduced)[number] = cam.reduced[0]!;
  for (const r of cam.reduced) if (r.from <= T) h = r;
  if (h.zoom === 0.125) return widestShot(k.W);
  if (h.zoom === 2) return { ...authored(cam.reveal.from), zoom: 2 };
  if (h.zoom === 0.5 && !h.follow) return authored(0);
  const f = k.reveal(k.x);
  return { zoom: h.zoom, anchor: f.anchor, horizon: f.horizon, cx: k.x + f.lead * k.W };
}

/** Which reduced-motion hold T is in (a change is a cut). */
export function reducedHold(T: number): number {
  let n = 0;
  cam.reduced.forEach((r, i) => { if (r.from <= T) n = i; });
  return n;
}

// --- words and bars -----------------------------------------------------------------------------------

/** The caption showing at T, if any. */
export function captionAt(T: number): string | null {
  for (const c of BEATS.captions) if (T >= c.from && T < c.to) return c.text;
  return null;
}

/** How far the cinematic bars are in (0..1), stepped as the plan asks (three steps in, two out). */
export function barsAt(T: number, reduced = false): number {
  const b = BEATS.ui.bars;
  const drop = her.drop1;
  if (T < 0) return 0;
  if (T < drop) {
    const u = clamp01(T / b.in);
    return reduced ? u : Math.max(0, Math.ceil(u * 3 - 1e-9) / 3);
  }
  const u = clamp01((T - drop) / b.out);
  return reduced ? 1 - u : 1 - Math.max(0, Math.ceil(u * 2 - 1e-9) / 2);
}

/** The page fall's progress (0 at the press, 1 on bar 2 where the world window lands), eased in and out. */
export function fallAt(T: number): number {
  const land = BEATS.bars[2]!;
  const u = clamp01(T / land);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

// --- the talisman's air ---------------------------------------------------------------------------------

/**
 * The ambient wind on the talisman at T (H/s along x, + toward the palace side is negative: the east wind
 * blows right to left), and how gusty it is (0..1): gusty until the hush, dying over a second into it,
 * the inhale swelling from nothing into the drop, a breeze after.
 */
export function windAt(T: number): { base: number; gust: number } {
  const o = BEATS.ofuda, hush = BEATS.hush;
  if (T < o.hush) return { base: -0.35, gust: 1 };
  if (T < o.hush + hush.over) {
    const u = 1 - (T - o.hush) / hush.over;
    return { base: -0.35 * u, gust: u };
  }
  if (T < o.inhale) return { base: 0, gust: 0 };
  if (T < her.drop1) {
    const u = (T - o.inhale) / (her.drop1 - o.inhale);
    return { base: -0.6 * u * u, gust: 0.6 * u };
  }
  return { base: -0.25, gust: 0.5 };
}

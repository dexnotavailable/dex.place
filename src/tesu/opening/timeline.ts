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

/** The authored shots before the walk (held frames and moves eased in log zoom), as the plan keys them. */
function authored(T: number): Shot {
  let s: (typeof shots)[number] = shots[0]!;
  for (const k of shots) if (k.from <= T) s = k;
  const u = s.to === null ? 1 : smooth((T - s.from) / (s.to - s.from));
  return { zoom: logLerp(s.zoom[0], s.zoom[1], u), anchor: lerp(s.anchor[0], s.anchor[1], u), horizon: lerp(s.horizon[0], s.horizon[1], u), cx: lerp(s.cx[0], s.cx[1], u) * HPX };
}

// --- the authored shots at any window ------------------------------------------------------------------
//
// The plan composes its shots on a 1536 x 864 frame (PLAN.md section 3: 1.25 screen px per art px at 1x on a
// 1080p screen). The world draws whole pixels instead (1 art px per screen px at 720p and at 1080p), so a window
// shows more or less of the world than the plan's frame. Two rules keep the plan's composition at every size:
//   - her place across the frame is the plan's share: the camera's lead on her scales with the frame's width
//     (the close band has her at 37.5% of the width on every screen, as section 3.4 says);
//   - the lazy follow follows the letter: while it is the subject (from bar 1 into the push-in) the frame moves
//     just enough to keep the bake's letter inside the bars' safe area (the bars are 11% each, plus a margin),
//     eased (the most it needs within half a second, averaged over a second, so it never chases the tumble).
//     Before the notice (bar 5) she may slide to the frame's edge or out of it (section 5, portrait phones);
//     from it on she stays above the bottom bar and inside the sides, and the push-in lands on the plan's
//     close band exactly. On the plan's frame and larger the letter never needs it: the shots are the keys.

/** The plan's frame width (art px). */
const REF_W = 1536;
const SAFE = { bars: BEATS.ui.bars.vh / 100, top: 0.04, hard: 0.012, side: 0.06, feet: 0.015, pad: 3, herHalfH: 0.3 };
const catchX = her.catchXH * HPX;
const letter = BEATS.ofuda.letter;
const bars = BEATS.bars;
/** The safe follow eases in over bar 1 (the letter enters the sky at T 0.64 by design), is full from the landing (bar 2), and is gone when the push-in lands. */
const safeIn = [bars[1]!, bars[2]!] as const;
const safeOut = [shots[shots.length - 1]!.from - 0.6, shots[shots.length - 1]!.from] as const;
/** From the notice (bar 5) she is kept in frame; the rule tightens over bar 4. */
const herIn = [bars[4]!, bars[5]!] as const;

/** The letter's box (px at 96 from her pivot) at T, while the bake is the subject; null outside it. */
export function letterBox(T: number): readonly [number, number, number, number] | null {
  const u = (T - letter.t0) / letter.dt;
  const n = letter.box.length;
  if (u < 0 || u > n - 1) return null;
  const i = Math.min(n - 2, Math.floor(u)), f = u - i;
  const a = letter.box[i]!, b = letter.box[i + 1]!;
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f)];
}

/** An authored shot with the camera's lead on her scaled to the frame's width. */
function widthShot(s: Shot, W: number): Shot {
  return { ...s, cx: catchX + (s.cx - catchX) * (W / REF_W) };
}

/**
 * How far (frame px) a shot has to move the picture so the letter at T is inside the safe area, and how far it
 * may move before she leaves hers: [dx, dy, dxMin, dxMax, dyMax] (+x right, +y down).
 */
function safeNeed(s: Shot, T: number, W: number, Hf: number): [number, number, number, number, number] {
  const z = s.zoom;
  const feet = s.anchor * Hf, herCol = W / 2 + (catchX - s.cx) * z;
  // her limits, full from the notice
  const r = smooth((T - herIn[0]) / (herIn[1] - herIn[0]));
  const half = SAFE.herHalfH * HPX * z;
  const loose = (1 - r) * (W + Hf);
  const capY = (1 - SAFE.bars - SAFE.feet) * Hf - feet;
  const dyMax = capY + loose;
  const dxMin = SAFE.side * W + half - herCol - loose;
  const dxMax = (1 - SAFE.side) * W - half - herCol + loose;
  const box = letterBox(T);
  if (!box) return [0, 0, dxMin, dxMax, dyMax];
  const top = feet + box[1] * z - SAFE.pad;
  const left = W / 2 + (catchX + box[0] - s.cx) * z - SAFE.pad, right = W / 2 + (catchX + box[2] - s.cx) * z + SAFE.pad;
  // comfortably clear of the top bar if she can stay clear of the bottom one; before the notice the letter wins,
  // down to just clear of the bar (on a short window she then sits at the frame's foot, or below it)
  const want = Math.max(0, (SAFE.bars + SAFE.top) * Hf - top), must = Math.max(0, (SAFE.bars + SAFE.hard) * Hf - top);
  const fit = Math.min(want, Math.max(0, capY));
  const dy = lerp(Math.max(fit, must), fit, r);
  const dx = right > (1 - SAFE.side) * W ? (1 - SAFE.side) * W - right : left < SAFE.side * W ? SAFE.side * W - left : 0;
  return [dx, dy, dxMin, dxMax, dyMax];
}

const GRID = 1 / 30;
const EASE = 0.5;
interface SafeTrack { from: number; dx: Float64Array; dy: Float64Array }
const safeCache = new Map<string, SafeTrack>();

/** The eased shift for every 1/30 s from bar 1 to the close band, for a frame size. */
function safeTrack(W: number, Hf: number): SafeTrack {
  const k = `${W}x${Hf}`;
  let t = safeCache.get(k);
  if (t) return t;
  const from = safeIn[0] - 2 * EASE, to = safeOut[1] + 2 * EASE;
  const n = Math.ceil((to - from) / GRID) + 1;
  const nx = new Float64Array(n), px = new Float64Array(n), ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const T = from + i * GRID;
    const [dx, dy] = safeNeed(widthShot(authored(T), W), T, W, Hf);
    ny[i] = dy;
    px[i] = Math.max(0, dx);
    nx[i] = Math.max(0, -dx);
  }
  // the most it needs within EASE, then averaged over 2 EASE: never less than it needs, never a jerk
  const w = Math.round(EASE / GRID);
  const ease = (a: Float64Array): Float64Array => {
    const m = new Float64Array(n), o = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) v = Math.max(v, a[j]!);
      m[i] = v;
    }
    for (let i = 0; i < n; i++) {
      let v = 0, c = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++, c++) v += m[j]!;
      o[i] = v / c;
    }
    return o;
  };
  const ey = ease(ny), ep = ease(px), en = ease(nx);
  const dx = new Float64Array(n);
  for (let i = 0; i < n; i++) dx[i] = ep[i]! - en[i]!;
  t = { from, dx, dy: ey };
  if (safeCache.size > 8) safeCache.clear();
  safeCache.set(k, t);
  return t;
}

/** The safe follow's shift (frame px) at T for a shot, with her limits applied. */
function safeShift(s: Shot, T: number, W: number, Hf: number): [number, number] {
  if (T <= safeIn[0] || T >= safeOut[1]) return [0, 0];
  const t = safeTrack(W, Hf);
  const u = (T - t.from) / GRID, i = Math.min(t.dx.length - 2, Math.max(0, Math.floor(u))), f = u - i;
  const wgt = smooth((T - safeIn[0]) / (safeIn[1] - safeIn[0])) * smooth((safeOut[1] - T) / (safeOut[1] - safeOut[0]));
  let dx = lerp(t.dx[i]!, t.dx[i + 1]!, f) * wgt, dy = lerp(t.dy[i]!, t.dy[i + 1]!, f) * wgt;
  const [, , dxMin, dxMax, dyMax] = safeNeed(s, T, W, Hf);
  dy = Math.min(dy, Math.max(0, dyMax));
  dx = Math.min(Math.max(dx, Math.min(0, dxMin)), Math.max(0, dxMax));
  return [dx, dy];
}

/** Moves a shot's picture by (dx, dy) frame px. */
function shifted(s: Shot, dx: number, dy: number, Hf: number): Shot {
  if (!dx && !dy) return s;
  return { zoom: s.zoom, anchor: s.anchor + dy / Hf, horizon: s.horizon + dy / Hf, cx: s.cx - dx / s.zoom };
}

/** The authored shot at T for a frame W x Hf (Hf unknown: the plan's keys, the lead scaled to the width). */
export function authoredAt(T: number, W: number, Hf?: number): Shot {
  const s = widthShot(authored(Math.max(0, T)), W);
  if (!Hf) return s;
  const [dx, dy] = safeShift(s, T, W, Hf);
  return shifted(s, dx, dy, Hf);
}

/** Reduced motion's held postcard: one shift for the whole hold, the most the letter needs in it (still a held frame). */
function heldShift(s: Shot, a: number, b: number, W: number, Hf: number): [number, number] {
  let dy = 0, dxp = 0, dxn = 0, dyMax = Infinity, dxMin = -Infinity, dxMax = Infinity;
  for (let T = Math.max(a, safeIn[1]); T < b; T += 0.1) {
    const [dx, ndy] = safeNeed(s, T, W, Hf);
    dy = Math.max(dy, ndy);
    dxp = Math.max(dxp, dx);
    dxn = Math.min(dxn, dx);
  }
  // a held frame keeps her in it throughout (the hold runs past the notice)
  const [, , lo, hi, ym] = safeNeed(s, herIn[1], W, Hf);
  dyMax = Math.min(dyMax, ym);
  dxMin = Math.max(dxMin, lo);
  dxMax = Math.min(dxMax, hi);
  const dx = dxp + dxn;
  return [Math.min(Math.max(dx, Math.min(0, dxMin)), Math.max(0, dxMax)), Math.min(dy, Math.max(0, dyMax))];
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
  /** The frame's height (frame px): the safe follow keeps the letter out from under the bars (unknown: the plan's keys). */
  H?: number;
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
  if (T < cam.reveal.from) return authoredAt(T, W, k.H);
  const xBreak = her.xBreakH * HPX;
  if (T < cam.whip.from) {
    const r = shotOf(k.reveal(x), x, W);
    const u = (T - cam.reveal.from) / cam.reveal.blend;
    return u < 1 ? mixShot(authoredAt(cam.reveal.from, W, k.H), r, smooth(u)) : r;
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
  if (h.zoom === 2) return { ...authoredAt(cam.reveal.from, k.W), zoom: 2 };
  if (h.zoom === 0.5 && !h.follow) {
    const s = authoredAt(0, k.W);
    if (!k.H) return s;
    const next = cam.reduced.find((r) => r.from > h.from)?.from ?? BEATS.ui.handBack;
    const [dx, dy] = heldShift(s, h.from, next, k.W, k.H);
    return shifted(s, dx, dy, k.H);
  }
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

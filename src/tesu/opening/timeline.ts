// The opening's timeline as pure functions of T (Track 1's time as heard, seconds from the press): where
// Zhusha is and which drawing of the catch she shows, what the camera frames, where the falling ofuda is on
// the frame, which caption shows, how far the bars are in. Everything comes from BEATS (beats.ts, the chart),
// so a new chart drops in there. Shared by the page (captions, bars) and the world (the camera, her, the
// paper); no DOM, no GL, so node's tests read it directly.

import { BEATS } from "./beats.ts";

export { BEATS };

/** World px per H (config.ts; repeated so this module needs nothing from the engine). */
const HPX = 96;

/** How the visitor came in (the website's four ways; motion/enter.ts). Ways 1-3 play the fall; 4 the jetty's catch. */
export type Way = "continue" | "corner" | "top" | "bottom";

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

/** Where the opening starts for a way in: T 0 (the fall), or bar 6 for the jetty's way (way 4). */
export function startT(way: Way): number {
  return way === "bottom" ? BEATS.camera.bottom.from : 0;
}

// --- a monotone curve through keys (Fritsch-Carlson): no overshoot, flat where keys repeat ---------------

/** Value at t on the monotone cubic through (ts[i], vs[i]). */
export function monotone(ts: readonly number[], vs: readonly number[], t: number): number {
  const n = ts.length;
  if (t <= ts[0]!) return vs[0]!;
  if (t >= ts[n - 1]!) return vs[n - 1]!;
  let i = 0;
  while (i < n - 2 && t >= ts[i + 1]!) i++;
  const d = (k: number): number => (vs[k + 1]! - vs[k]!) / (ts[k + 1]! - ts[k]!);
  const m = (k: number): number => {
    if (k === 0) return d(0);
    if (k === n - 1) return d(n - 2);
    const a = d(k - 1), b = d(k);
    if (a * b <= 0) return 0;
    // the harmonic mean, weighted by the spans (keeps it monotone)
    const ha = ts[k]! - ts[k - 1]!, hb = ts[k + 1]! - ts[k]!;
    const w1 = 2 * hb + ha, w2 = hb + 2 * ha;
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const h = ts[i + 1]! - ts[i]!, u = (t - ts[i]!) / h;
  const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
  return h00 * vs[i]! + h10 * h * m(i) + h01 * vs[i + 1]! + h11 * h * m(i + 1);
}

// --- her path, hands-free -----------------------------------------------------------------------------

export type HerPhase = "hold" | "walk" | "break" | "run" | "skid" | "stand";

const her = BEATS.her;
/** The walk is solved, not set: from the walk's start at the catch to the pickup's mark. */
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
      // a cubic from full speed to standing at the overlook (monotone)
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

// --- the catch: worker 1's opening_ofuda, retimed so the slap (f007) lands on bar 9 -----------------------

const clip = her.clip;
/** T at which each drawing of the catch starts (f000 is held from the start until f001). */
export const CLIP_AT: readonly number[] = (() => {
  // whole ticks from the slap's drawing (f007), so it lands on the slap exactly; the jam (f`jamDrawing`) holds until
  // line 6's push mark, and the push-up (the next drawing on) plays from there in its own ticks
  const slapI = 7, jamI = clip.jamDrawing;
  const tick: number[] = [0];
  for (let i = 1; i < clip.ticks.length; i++) tick.push(tick[i - 1]! + clip.ticks[i]!);
  const at: number[] = [-Infinity];
  for (let i = 1; i <= clip.ticks.length; i++) {
    if (i <= jamI) at.push(i === slapI ? clip.slap : clip.slap + (tick[i - 1]! - tick[slapI - 1]!) / 60);
    else at.push(Math.max(clip.push, at[jamI]! + clip.ticks[jamI]! / 60) + (tick[i - 1]! - tick[jamI]!) / 60);
  }
  return at;
})();

/** When the catch's last drawing is done (then the idle). */
export const CLIP_END = CLIP_AT[CLIP_AT.length - 1]!;

/** The catch's drawing at T and the clip tick that shows it (anim.json's own), or null once it has played. */
export function clipAt(T: number): { index: number; tick: number } | null {
  if (T >= CLIP_END) return null;
  let i = 0;
  while (i < clip.ticks.length - 1 && T >= CLIP_AT[i + 1]!) i++;
  return { index: i, tick: clip.starts[i]! };
}

/** T at which the paper becomes the drawing's (f001): before it the world draws it. */
export const HANDOFF_T = CLIP_AT[clip.handoffDrawing]!;

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

interface Key { T: number; zoom: number; anchor: number; horizon: number; alt: number; cx: number; follow: boolean }

/**
 * The paper's start scale: a key with zoom 0 is "the page's own": the zoom at which her ofuda (in the world, at her
 * drawing's pixel size) is exactly as big on screen as the page's loader drew it, so the press hands it over without a
 * jump (game.ts sets it each tick from the screen; 1 until then).
 */
let startZoom = 1;
export function setStartZoom(z: number): void {
  if (Number.isFinite(z) && z > 0) startZoom = z;
}
export function getStartZoom(): number {
  return startZoom;
}

/** The keys a way plays: ways 1-3 the fall; way 4 its own opening keys, then the shared ones after them. */
function keysFor(way: Way): readonly Key[] {
  const ks: readonly Key[] = way !== "bottom" ? cam.keys : (() => {
    const b = cam.bottom.keys, last = b[b.length - 1]!.T;
    return [...b, ...cam.keys.filter((k) => k.T > last)];
  })();
  return ks.some((k) => k.zoom === 0) ? ks.map((k) => (k.zoom === 0 ? { ...k, zoom: startZoom } : k)) : ks;
}

/** The black slab's bottom edge on the frame (row px from the top) for a camera, or -1 when it is above the frame. */
export function ceilingRow(feetY: number, s: number, offY: number): number {
  return (feetY - BEATS.ceiling.altH * HPX) * s + offY;
}

/**
 * The authored shot at T, for her at x (px) on a frame W x Hf. `alt` lifts the frame's middle that many H above
 * her feet (the fall: her feet far below the frame); `follow` keys put the centre at her x plus their cx.
 */
export function keysAt(T: number, x: number, W: number, Hf: number, way: Way = "continue"): Shot {
  void W;
  const ks = keysFor(way);
  const ts = ks.map((k) => k.T);
  const ch = (f: (k: Key) => number): number => monotone(ts, ks.map(f), T);
  const zoom = Math.exp(ch((k) => Math.log(k.zoom)));
  const alt = ch((k) => k.alt);
  const cxH = ch((k) => (k.follow ? x / HPX + k.cx : k.cx));
  // the fall: the frame's middle `alt` H above her feet (her feet's row below the frame's foot)
  const anchor = ch((k) => k.anchor) + (alt * HPX * zoom) / Hf;
  return { zoom, anchor, horizon: ch((k) => k.horizon), cx: cxH * HPX };
}

/** The widest frame (the lake on the left, the palace's west gate pinned at 0.8 of the width). */
export function widestShot(W: number): Shot {
  const w = cam.widest;
  return { zoom: w.zoom, anchor: w.anchor, horizon: w.horizon, cx: w.pin.xH * HPX - (w.pin.at - 0.5) * (W / w.zoom) };
}

export interface CameraInputs {
  /** Her world x now (px). */
  x: number;
  /** The frame's size (frame px). */
  W: number;
  H: number;
  /** The world's framing at x (the hand-back's target). */
  world: (x: number) => Framed;
  /** T at which the widest frame was let go early (she ran past the tunnel's first gate), if it was. */
  released?: number;
  reduced?: boolean;
  way?: Way;
}

/**
 * The camera at T, or null once the opening has handed the frame back to the world's tracks.
 *   to the crash:  the authored keys (the fall, the break-out over Kagami, the push-in, the close band, the walk,
 *                  following her run from drop 1)
 *   the crash:     the whip-out, time-locked: zoom eased in log space (u^2.2), from where the keys stood at its
 *                  start (her hands-free place) to the widest frame on 0:32
 *   0:32:          the widest frame, pinned, under TESU (until it fades, or until she passes the tunnel's first gate)
 *   then:          eased back in to the world's own framing at her x, which owns the frame at the hand-back
 */
export function cameraAt(T: number, k: CameraInputs): Shot | null {
  if (k.reduced) return reducedAt(T, k);
  const { x, W, H: Hf } = k;
  const way = k.way ?? "continue";
  const w = cam.whip;
  if (T < w.from) return keysAt(T, x, W, Hf, way);
  const easeFrom = Math.min(cam.easeIn.from, k.released ?? Infinity);
  if (T < cam.widest.from) {
    const f0 = keysAt(w.from, herXH(w.from) * HPX, W, Hf, way);
    const e = clamp01((T - w.from) / (w.to - w.from)) ** w.exp;
    const zoom = logLerp(f0.zoom, w.toZoom, e);
    const lead = f0.cx - herXH(w.from) * HPX;
    const follow = x + lead * (f0.zoom / zoom) ** 0.5;
    const pin = cam.widest.pin.xH * HPX - (cam.widest.pin.at - 0.5) * (W / zoom);
    return { zoom, anchor: lerp(f0.anchor, w.anchor[1], e), horizon: lerp(f0.horizon, w.horizon[1], e), cx: lerp(follow, pin, e) };
  }
  if (T < easeFrom) return widestShot(W);
  const end = easeFrom + (cam.easeIn.to - cam.easeIn.from);
  if (T >= end) return null;
  return mixShot(widestShot(W), shotOf(k.world(x), x, W), smooth((T - easeFrom) / (end - easeFrom)));
}

/** Reduced motion: held frames, cut (the game cross-fades each cut) on the plan's beats. */
function reducedAt(T: number, k: CameraInputs): Shot | null {
  if (T >= BEATS.ui.handBack) return null;
  const h = cam.reduced[reducedHold(T)]!;
  if (h.hold === "widest") return widestShot(k.W);
  if (h.hold === "follow") return keysAt(h.T, k.x, k.W, k.H, "continue");
  // a held key: her at the catch spot (she has not moved yet in these)
  return keysAt(h.T, her.catchXH * HPX, k.W, k.H, k.way ?? "continue");
}

/** Which reduced-motion hold T is in (a change is a cut). */
export function reducedHold(T: number): number {
  let n = 0;
  cam.reduced.forEach((r, i) => { if (r.from <= T) n = i; });
  return n;
}

// --- the falling ofuda: where it is on the frame --------------------------------------------------------

const of = BEATS.ofuda;

/**
 * The paper's place on the frame at T (shares of the width and height) before it is drawn on to her: the keyed
 * flight, a pendulum sway (falling paper rocks side to side), the east wind's gusts. Null before it enters.
 */
export function paperScreenAt(T: number, way: Way = "continue"): [number, number] | null {
  const path = way === "bottom" ? of.pathBottom : of.path;
  if (T < path[0]!.T) return null;
  const ts = path.map((p) => p.T);
  let fx = monotone(ts, path.map((p) => p.fx), T);
  let fy = monotone(ts, path.map((p) => p.fy), T);
  // past the last key it keeps its last velocity a while (the blend to her takes it from there)
  const last = path[path.length - 1]!;
  if (T > last.T) {
    const e = 0.05, a = monotone(ts, path.map((p) => p.fx), last.T - e), b = monotone(ts, path.map((p) => p.fy), last.T - e);
    fx += ((last.fx - a) / e) * (T - last.T);
    fy += ((last.fy - b) / e) * (T - last.T);
  }
  const sw = of.sway;
  if (way !== "bottom" && T < sw.until) {
    const fade = smooth((sw.until - T) / 1.5) * smooth((T - path[0]!.T) / 1.2);
    fx += sw.amp * Math.sin((2 * Math.PI * (T - path[0]!.T)) / sw.period) * fade;
    // a rocking paper sinks a little at each end of its swing
    fy += sw.amp * 0.35 * Math.cos((4 * Math.PI * (T - path[0]!.T)) / sw.period) * fade;
  }
  if (way !== "bottom") {
    for (const g of of.gusts) {
      const u = (T - g.T) / g.dur;
      if (u <= 0 || u >= 1) continue;
      const b = Math.sin(Math.PI * u) ** 2;
      fx += g.dx * b;
      fy += g.dy * b;
    }
  }
  return [fx, fy];
}

/** How far (0..1) the paper is drawn on from its frame place to her hand-off point. */
export function paperBlendAt(T: number, way: Way = "continue"): number {
  const [a, b] = way === "bottom" ? of.blendBottom : of.blend;
  return smooth((T - a) / (b - a));
}

/** The air on the falling paper at T (art px / s, its own sim's wind): the east wind, gustier in the gusts. */
export function paperAirAt(T: number, way: Way = "continue"): { x: number; gust: number } {
  let x = -18, gust = 0.55;
  if (way !== "bottom") {
    for (const g of of.gusts) {
      const u = (T - g.T) / g.dur;
      if (u > 0 && u < 1) {
        const b = Math.sin(Math.PI * u);
        x -= 70 * b;
        gust += 0.4 * b;
      }
    }
  } else x = -45;
  // it slows into her hands: the air calms over the blend
  const calm = paperBlendAt(T, way);
  return { x: x * (1 - 0.7 * calm), gust: gust * (1 - 0.6 * calm) };
}

// --- words and bars -----------------------------------------------------------------------------------

/** One line of her voice: when its file starts and its speech (T), its subtitles (Japanese, English; T). */
export interface VoiceLine {
  n: number;
  cue: string;
  at: number;
  len: number;
  from: number;
  to: number;
  parts: { from: number; to: number; jp: string; en: string }[];
}

/** Her lines on T (the chart's `voice`). */
export const VOICE: readonly VoiceLine[] = BEATS.voice.lines.map((l) => ({
  n: l.n, cue: l.cue, at: l.at, len: l.len, from: l.at + l.speech[0], to: l.at + l.speech[1],
  parts: l.parts.map((p) => ({ from: l.at + p.from, to: l.at + p.to, jp: p.jp, en: p.en })),
}));

/** A subtitle shows from just before its words to a moment after them (never over the next one). */
export const SUB_LEAD = 0.1, SUB_TAIL = 0.45;

/** Every subtitle in order: the line it belongs to and its words. */
const SUBS = VOICE.flatMap((v) => v.parts.map((p) => ({ n: v.n, ...p })));

/**
 * The subtitle showing at T, if any: the words being spoken (Japanese, English) and their line. Inside one line its
 * words hold through its pauses until the next words take over (line 6's set-up hangs there through the slap).
 */
export function subtitleAt(T: number): { n: number; jp: string; en: string } | null {
  for (let i = 0; i < SUBS.length; i++) {
    const p = SUBS[i]!, next = SUBS[i + 1];
    const end = next && next.n === p.n ? next.from - SUB_LEAD : Math.min(p.to + SUB_TAIL, next ? next.from - SUB_LEAD - 0.02 : Infinity);
    if (T >= p.from - SUB_LEAD && T < end) return { n: p.n, jp: p.jp, en: p.en };
  }
  return null;
}

/** The caption showing at T, if any (the subtitle's English; tools and older checks). */
export function captionAt(T: number): string | null {
  return subtitleAt(T)?.en ?? null;
  return null;
}

/** How far the cinematic bars are in (0..1), stepped (three steps in, two out). */
export function barsAt(T: number, reduced = false, from = 0): number {
  const b = BEATS.ui.bars;
  const drop = her.drop1;
  if (T < from) return 0;
  if (T < drop) {
    const u = clamp01((T - from) / b.in);
    return reduced ? u : Math.max(0, Math.ceil(u * 3 - 1e-9) / 3);
  }
  const u = clamp01((T - drop) / b.out);
  return reduced ? 1 - u : 1 - Math.max(0, Math.ceil(u * 2 - 1e-9) / 2);
}

// --- the air on her hat ---------------------------------------------------------------------------------

/**
 * The ambient wind on the ofuda on her hat at T (H/s along x; the east wind blows right to left, so negative),
 * and how gusty it is (0..1): gusty until the hush, dying over a second into it, the inhale swelling from nothing
 * into the drop, a breeze after.
 */
export function windAt(T: number): { base: number; gust: number } {
  const hush = BEATS.hush;
  if (T < of.hush) return { base: -0.35, gust: 1 };
  if (T < of.hush + hush.over) {
    const u = 1 - (T - of.hush) / hush.over;
    return { base: -0.35 * u, gust: u };
  }
  if (T < of.inhale) return { base: 0, gust: 0 };
  if (T < her.drop1) {
    const u = (T - of.inhale) / (her.drop1 - of.inhale);
    return { base: -0.6 * u * u, gust: 0.6 * u };
  }
  return { base: -0.25, gust: 0.5 };
}

// The dex mark intro: the first thing a visitor sees on a fresh visit to "/".
//
// Black, then lowercase "dex" (Daniel Bold, as hand-cleaned pixel art) writes
// itself stroke by stroke, holds long enough to be read, and is blown away left to
// right as pixel dust on a wind straight to the right. About 3 seconds; a click,
// tap or key skips it. With the system's reduced-motion setting it is a plain
// fade in and out.
//
// It never pads loading: start loading first, call playIntro() alongside, and
// let whichever finishes last decide what comes next. The host page provides
// the black; this module only draws the mark on a transparent canvas.
//
// Pixel-crisp at every size: everything is drawn into a small art buffer, one
// texel per mark pixel, and blown up by a whole number of device pixels with
// nearest sampling (the site's presentation rule; no bilinear anywhere).

import { MARK_MIN_WIDTH_PORTRAIT, MARK_WIDTH_OF_VIEW_H } from "../title-font/sizes.ts";
import { MARK_H, MARK_ROWS, MARK_STROKES, MARK_W } from "./mark.ts";

/** Timings in seconds. */
export const INTRO_TIMING = {
  /** A breath of black before the pen touches down. */
  start: 0.08,
  /** The four strokes, pen lifts included (Dex: a little slower than first cut). */
  write: 0.9,
  /** Pause between strokes (part of `write`). */
  lift: 0.05,
  /** Fresh ink glows this long before it settles. */
  heat: 0.2,
  /** The finished mark holds so it can be read (Dex: about a second longer than first cut). */
  hold: 1.15,
  /** The left-to-right release sweeps across the mark in this time. */
  sweep: 0.5,
  /** Each dust pixel lives this long (min, max). */
  dustLife: [0.14, 0.45] as const,
  /** Reduced motion: fade in, hold, fade out. */
  calm: [0.35, 0.8, 0.45] as const,
  /** A skip fades whatever is on screen out this fast. */
  skipFade: 0.18,
} as const;

/** Colours (RGB). The ink is a warm paper white; the dust cools to pale rose as it goes. */
const INK: Rgb = [246, 238, 233];
const HOT: Rgb = [255, 250, 236];
const DUST_END: Rgb = [236, 190, 198];

/** The wind's push to the right, art px per second squared. */
const GUST = 260;

type Rgb = readonly [number, number, number];

export interface DustParticle {
  /** Position and velocity in CSS pixels (relative to the intro canvas), per second. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived and seconds it would live. */
  age: number;
  life: number;
}

export interface DustHandoff {
  particles: DustParticle[];
  /** Size of one dust pixel in CSS pixels. */
  pixel: number;
  canvas: HTMLCanvasElement;
}

export interface IntroOptions {
  /** Element to cover (must be positioned). Default: the whole viewport. */
  parent?: HTMLElement;
  /** Click, tap or any key skips (default true). */
  skippable?: boolean;
  /** Where skip clicks and keys are listened for (default: the window). */
  skipTarget?: EventTarget;
  /** How long the finished mark holds, s (default INTRO_TIMING.hold; the opening plan: 1.5 first visit, 0.8 return). */
  hold?: number;
  /** Force reduced motion on or off; default follows the operating system. */
  reducedMotion?: boolean;
  /**
   * Hand-off hook: called once, when the last of the mark has turned to dust,
   * with the live particles. Return true to take them over; the intro then
   * stops drawing them and finishes at once.
   */
  onDust?: (dust: DustHandoff) => boolean | void;
}

export interface IntroResult {
  skipped: boolean;
  reducedMotion: boolean;
  handedOff: boolean;
}

export interface IntroHandle {
  readonly canvas: HTMLCanvasElement;
  /** Resolves when the beat is over (played, skipped or handed off). */
  readonly done: Promise<IntroResult>;
  skip(): void;
  /** Stop at once and remove the canvas (no result beyond `done` resolving as skipped). */
  destroy(): void;
}

export interface Px {
  x: number;
  y: number;
  /** When the pen reaches it. */
  inkAt: number;
  /** When it lets go as dust. */
  dustAt: number;
  life: number;
  /** Per-pixel random numbers in [0, 1). */
  h1: number;
  h2: number;
  h3: number;
}

// inverse of the pen's ease (2u^2 up to the middle, mirrored after): progress -> time
const smoothInv = (v: number): number => (v <= 0.5 ? Math.sqrt(v / 2) : 1 - Math.sqrt((1 - v) / 2));
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The pen's timing for one stroke, seconds from the start of the intro. */
export interface StrokeTiming {
  start: number;
  dur: number;
  /** Path length in art pixels. */
  len: number;
}

/**
 * Half the brush width in art pixels. Every pixel within this distance of a
 * stretch of the pen's path is inked when the pen passes that stretch, so each
 * stroke draws solid on its own, crossings and self-overlaps included (the x's
 * first stroke has its centre before the second stroke crosses it).
 */
const BRUSH_R = 2.6;
/** Ink lands this far ahead of the pen's centre (art px). */
const BRUSH_LEAD = 1.4;

/** The pen's ease: slow start, fast middle, slow finish. Progress in, progress out. */
export const penEase = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

/** Every ink pixel of the mark with its writing and dusting times (pure; exported for checks). */
export function planMark(hold: number = INTRO_TIMING.hold): { pixels: Px[]; strokes: StrokeTiming[]; written: number } {
  const T = INTRO_TIMING;
  const lens = MARK_STROKES.map((s) => s.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - s[i - 1]![0], p[1] - s[i - 1]![1]) : 0), 0));
  const total = lens.reduce((a, b) => a + b, 0);
  const drawTime = T.write - T.lift * (MARK_STROKES.length - 1);
  const strokes: StrokeTiming[] = [];
  let t = T.start;
  lens.forEach((len) => {
    const dur = Math.max(0.09, (drawTime * len) / total);
    strokes.push({ start: t, dur, len });
    t += dur + T.lift;
  });
  const written = t - T.lift;
  const sweepAt = written + hold;
  // an upright front: the mark goes strictly left to right (slant > 0 would lead with the top)
  const slant = 0;
  const span = MARK_W + slant * MARK_H + 4;

  const out: Px[] = [];
  for (let y = 0; y < MARK_H; y++) {
    const row = MARK_ROWS[y]!;
    for (let x = 0; x < MARK_W; x++) {
      if (row[x] !== "#") continue;
      // The earliest moment any stretch of any stroke covers this pixel with the
      // brush. Checked per segment, so a stroke that crosses itself or another
      // stroke inks the shared pixels the first time it passes them.
      let inkAt = Infinity;
      let nearest = Infinity;
      let nearestAt = 0;
      MARK_STROKES.forEach((s, si) => {
        const { start, dur, len } = strokes[si]!;
        let acc = 0;
        for (let i = 1; i < s.length; i++) {
          const [ax, ay] = s[i - 1]!;
          const [bx, by] = s[i]!;
          const dx = bx - ax;
          const dy = by - ay;
          const l = Math.hypot(dx, dy);
          const u = l ? clamp01(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / (l * l)) : 0;
          const d = Math.hypot(x + 0.5 - (ax + dx * u), y + 0.5 - (ay + dy * u));
          const at = start + dur * smoothInv(clamp01((acc + u * l - BRUSH_LEAD) / len));
          if (d <= BRUSH_R) inkAt = Math.min(inkAt, at);
          if (d < nearest) {
            nearest = d;
            nearestAt = at;
          }
          acc += l;
        }
      });
      // a pixel outside every brush (the odd corner) comes with its nearest stroke
      if (inkAt === Infinity) inkAt = nearestAt;
      const h1 = hash(x, y, 1);
      const h2 = hash(x, y, 2);
      const h3 = hash(x, y, 3);
      const front = (x + slant * y + (h1 - 0.5) * 4 + 2) / span;
      const dustAt = sweepAt + T.sweep * clamp01(front);
      // most dust is brief and a few motes travel: the trail thins out instead of clouding
      const life = T.dustLife[0] + (T.dustLife[1] - T.dustLife[0]) * Math.pow(hash(x, y, 4), 1.4);
      out.push({ x, y, inkAt, dustAt, life, h1, h2, h3 });
    }
  }
  return { pixels: out, strokes, written };
}

/** Device pixels per mark pixel for a w x h device-pixel box. */
export function markScale(w: number, h: number): number {
  const viewH = Math.min(h, (w * 9) / 16);
  let target = MARK_WIDTH_OF_VIEW_H * viewH;
  if (w < h) target = Math.max(target, MARK_MIN_WIDTH_PORTRAIT * w);
  target = Math.min(target, 0.8 * w);
  return Math.max(1, Math.round(target / MARK_W));
}

export function playIntro(opts: IntroOptions = {}): IntroHandle {
  const parent = opts.parent ?? document.body;
  const fixed = parent === document.body;
  const reduced = opts.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const T = INTRO_TIMING;
  const skipTarget: EventTarget = opts.skipTarget ?? window;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "dex-intro";
  Object.assign(canvas.style, {
    position: fixed ? "fixed" : "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    imageRendering: "pixelated",
    zIndex: "10",
    transition: `opacity ${T.skipFade}s linear`,
  } satisfies Partial<CSSStyleDeclaration>);
  parent.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  const art = document.createElement("canvas");
  const actx = art.getContext("2d")!;
  let img: ImageData | null = null;
  let k = 1;
  let ox = 0;
  let oy = 0;

  function fit(): void {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    const cw = Math.max(1, Math.round(r.width * dpr));
    const chh = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== cw || canvas.height !== chh) {
      canvas.width = cw;
      canvas.height = chh;
    }
    k = markScale(cw, chh);
    const bw = Math.ceil(cw / k);
    const bh = Math.ceil(chh / k);
    if (art.width !== bw || art.height !== bh) {
      art.width = bw;
      art.height = bh;
      img = actx.createImageData(bw, bh);
    }
    // centred, nudged a touch above the middle like a title card
    ox = Math.floor((bw - MARK_W) / 2);
    oy = Math.floor((bh - MARK_H) / 2 - bh * 0.02);
  }

  const pixels = reduced ? [] : planMark(opts.hold).pixels;
  const lastDust = pixels.reduce((m, p) => Math.max(m, p.dustAt), 0);
  const endAt = reduced ? T.calm[0] + T.calm[1] + T.calm[2] : pixels.reduce((m, p) => Math.max(m, p.dustAt + p.life), 0);

  let resolve!: (r: IntroResult) => void;
  const done = new Promise<IntroResult>((res) => (resolve = res));
  let finished = false;
  let raf = 0;
  let t0 = -1;
  let handedOff = false;
  let dustOffered = false;
  let stopDust = false;

  function finish(skipped: boolean): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    skipTarget.removeEventListener("pointerdown", onSkip, true);
    skipTarget.removeEventListener("keydown", onSkip, true);
    removeEventListener("resize", fit);
    canvas.remove();
    resolve({ skipped, reducedMotion: reduced, handedOff });
  }

  /** Dust particle state at time t (art px, relative to the mark's top left). */
  function dustState(p: Px, t: number): { x: number; y: number; vx: number; vy: number; age: number } {
    const a = t - p.dustAt;
    // wind straight to the right, gusting harder as it goes; each pixel a little
    // faster or slower than its neighbours
    const vx0 = 80 + 200 * p.h2;
    const x = p.x + vx0 * a + 0.5 * GUST * a * a;
    // a slight, erratic flutter up and down that grows in over the first moments
    const amp = (1.2 + 2 * p.h3) * Math.min(1, a * 7);
    const w = 14 + 12 * p.h1;
    const y = p.y + (p.h3 - 0.5) * 8 * a + amp * Math.sin(p.h2 * 37 + a * w);
    return { x, y, vx: vx0 + GUST * a, vy: (p.h3 - 0.5) * 8 + amp * w * Math.cos(p.h2 * 37 + a * w), age: a };
  }

  function put(data: Uint8ClampedArray, bw: number, bh: number, x: number, y: number, c: Rgb, alpha: number): void {
    if (x < 0 || y < 0 || x >= bw || y >= bh || alpha <= 0) return;
    const i = (y * bw + x) * 4;
    // keep the brightest/most opaque write when two pixels land on one texel
    const a = Math.round(alpha * 255);
    if (a <= data[i + 3]!) return;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = a;
  }

  function draw(t: number): void {
    if (!img) return;
    const bw = img.width;
    const bh = img.height;
    const data = img.data;
    data.fill(0);

    if (reduced) {
      const [fi, ho, fo] = T.calm;
      const a = t < fi ? t / fi : t < fi + ho ? 1 : 1 - (t - fi - ho) / fo;
      for (let y = 0; y < MARK_H; y++) {
        const row = MARK_ROWS[y]!;
        for (let x = 0; x < MARK_W; x++) if (row[x] === "#") put(data, bw, bh, ox + x, oy + y, INK, clamp01(a));
      }
    } else {
      for (const p of pixels) {
        if (t < p.inkAt) continue;
        if (t < p.dustAt) {
          // ink: hot when fresh, then settled; brightening just before it lets go
          const heat = 1 - clamp01((t - p.inkAt) / T.heat);
          let c = mix(INK, HOT, heat * heat);
          const pre = clamp01(1 - (p.dustAt - t) / 0.09);
          if (pre > 0) c = mix(c, HOT, pre);
          put(data, bw, bh, ox + p.x, oy + p.y, c, 1);
          continue;
        }
        if (stopDust) continue;
        const s = dustState(p, t);
        const u = s.age / p.life;
        if (u >= 1) continue;
        const c = u < 0.2 ? mix(HOT, INK, u / 0.2) : mix(INK, DUST_END, (u - 0.2) / 0.8);
        // three clean steps of brightness, then gone: no long grey smear
        const alpha = u < 0.5 ? 1 : u < 0.78 ? 0.62 : 0.3;
        put(data, bw, bh, ox + Math.round(s.x), oy + Math.round(s.y), c, alpha);
      }
    }
    actx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art, 0, 0, bw * k, bh * k);
  }

  function offerDust(t: number): void {
    dustOffered = true;
    if (!opts.onDust) return;
    const dpr = window.devicePixelRatio || 1;
    const css = k / dpr;
    const particles: DustParticle[] = [];
    for (const p of pixels) {
      const s = dustState(p, t);
      if (s.age >= p.life) continue;
      particles.push({ x: (ox + s.x + 0.5) * css, y: (oy + s.y + 0.5) * css, vx: s.vx * css, vy: s.vy * css, age: s.age, life: p.life });
    }
    if (opts.onDust({ particles, pixel: css, canvas }) === true) {
      handedOff = true;
      stopDust = true;
    }
  }

  function frame(now: number): void {
    if (finished) return;
    if (t0 < 0) t0 = now;
    const t = (now - t0) / 1000;
    if (!reduced && !dustOffered && t >= lastDust) offerDust(t);
    draw(t);
    if (handedOff || t >= endAt) {
      finish(false);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function onSkip(e: Event): void {
    if (finished) return;
    if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey || e.altKey)) return;
    skip();
  }

  let skipping = false;
  function skip(): void {
    if (finished || skipping) return;
    skipping = true;
    canvas.style.opacity = "0";
    setTimeout(() => finish(true), T.skipFade * 1000);
  }

  fit();
  addEventListener("resize", fit);
  if (opts.skippable !== false) {
    skipTarget.addEventListener("pointerdown", onSkip, true);
    skipTarget.addEventListener("keydown", onSkip, true);
  }
  raf = requestAnimationFrame(frame);

  return {
    canvas,
    done,
    skip,
    destroy: () => finish(true),
  };
}

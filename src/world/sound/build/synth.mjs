// Sound sources for the beds and effects: each returns mono Float32 clips (or
// [L, R] for wide layers). Original synthesis only; recorded material comes in
// through sources.mjs.

import { SR, add, brown, chirp, env, filt, lfo, mul, pink, scale, sec, shape, smooth, white, zeros } from "./dsp.mjs";

/** A water bubble: a sine rising in pitch as it decays (Minnaert). */
export function bubble(r, f = r.range(600, 2400), dur = r.range(0.02, 0.07), amp = 1) {
  const n = sec(dur * 1.6);
  const o = new Float32Array(n);
  const rise = r.range(0.8, 2.2);
  let ph = r() * 6.28;
  const k = Math.exp(-1 / (dur * SR * 0.45));
  let a = amp;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f * (1 + rise * t / dur * 0.3)) / SR;
    o[i] = Math.sin(ph) * a * Math.min(1, i / 24);
    a *= k;
  }
  return o;
}

/** A lap of water against wood or stone: a soft band-passed slosh with a few bubbles. */
export function lap(r, amp = 1) {
  const dur = r.range(0.35, 0.9);
  const n = sec(dur);
  const x = pink(n, r);
  filt(x, "bp", r.range(350, 800), 0.9);
  filt(x, "lp", 2200, 0.7);
  const e = new Float32Array(n);
  const peakAt = r.range(0.12, 0.3);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    e[i] = t < peakAt ? Math.pow(t / peakAt, 1.5) : Math.pow(1 - (t - peakAt) / (1 - peakAt), 2.2);
  }
  mul(x, e);
  scale(x, amp * 2.2);
  const nb = Math.floor(r.range(2, 7));
  for (let b = 0; b < nb; b++) add(x, bubble(r, r.range(500, 1500), r.range(0.02, 0.06), amp * r.range(0.02, 0.06)), 1, Math.floor(r.range(0.1, 0.7) * n));
  return x;
}

/** A rope or timber creak: an irregular friction pulse train through wood resonances. */
export function creak(r, dur = r.range(0.4, 1.1), amp = 1) {
  const n = sec(dur);
  const x = zeros(n);
  let t = 0;
  const f0 = r.range(22, 55), f1 = f0 * r.range(0.7, 1.6);
  while (t < n) {
    const u = t / n;
    const f = f0 + (f1 - f0) * u;
    x[t] = (r() * 0.4 + 0.8) * Math.sin(Math.PI * u) ** 0.7;
    t += Math.max(1, Math.round((SR / f) * r.range(0.85, 1.15)));
  }
  const y = Float32Array.from(x);
  filt(x, "bp", r.range(550, 900), 7);
  filt(y, "bp", r.range(1300, 2100), 9);
  add(x, y, 0.6);
  filt(x, "hp", 180, 0.7);
  return scale(x, amp * 3);
}

/** A far gull: two falling calls, soft and distant (no detail survives the distance). */
export function gull(r, amp = 1) {
  const calls = 2 + Math.floor(r() * 2);
  const out = zeros(sec(1.6));
  let at = 0;
  for (let c = 0; c < calls; c++) {
    const dur = r.range(0.22, 0.34);
    const n = sec(dur);
    const x = new Float32Array(n);
    let ph = 0;
    const f0 = r.range(1500, 1800), f1 = f0 * r.range(0.62, 0.72);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const f = f0 * Math.pow(f1 / f0, Math.pow(u, 0.6)) * (1 + 0.012 * Math.sin(i * 0.0035));
      ph += (2 * Math.PI * f) / SR;
      // a buzzy, slightly nasal source
      const s = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.18 * Math.sin(3 * ph);
      x[i] = s * Math.sin(Math.PI * Math.min(1, u * 1.25)) ** 1.5;
    }
    filt(x, "bp", 2100, 1.2);
    add(out, x, amp * 0.5, at);
    at += n + sec(r.range(0.06, 0.14));
  }
  filt(out, "lp", 3200, 0.7);
  return out;
}

/** A clock tick from a recorded wood tap (already pitched), shortened. */
export function tickFrom(tap, len = 0.05) {
  const n = Math.min(tap.length, sec(len));
  const o = tap.slice(0, n);
  for (let i = 0; i < n; i++) o[i] *= Math.pow(1 - i / n, 2);
  return o;
}

/** Fire: a low roar with flicker plus bursty crackle. Stereo, periodic. */
export function fire(n, r, { roar = 1, crackle = 1, rate = 7 } = {}) {
  const out = [zeros(n), zeros(n)];
  for (let c = 0; c < 2; c++) {
    const b = brown(n, r);
    filt(b, "lp", 260, 0.7, { loop: 1 });
    mul(b, shape(lfo(n, r, n / SR / 1.5, n / SR / 0.3, 8), 0.5, 1));
    add(out[c], b, roar * 1.6);
  }
  // crackle: clusters of clicks with little resonances
  let t = 0;
  while (t < n) {
    t += Math.floor(r.range(0.2, 2) * (SR / rate));
    const burst = r() < 0.25 ? Math.floor(r.range(2, 6)) : 1;
    for (let b = 0; b < burst; b++) {
      const m = sec(r.range(0.004, 0.02));
      const k = white(m, r);
      filt(k, "bp", r.range(1500, 5500), r.range(1.5, 4));
      for (let i = 0; i < m; i++) k[i] *= Math.pow(1 - i / m, 3);
      const p = r.range(-0.6, 0.6);
      const g = crackle * r.range(0.3, 1) * 0.9;
      add(out[0], k, g * (1 - p) * 0.7, t + b * sec(r.range(0.005, 0.03)), true);
      add(out[1], k, g * (1 + p) * 0.7, t + b * sec(r.range(0.005, 0.03)), true);
    }
  }
  return out;
}

/** Simmer (a kettle below the boil): a soft hiss with a stream of small bubbles. */
export function simmer(n, r, amp = 1) {
  const x = pink(n, r);
  filt(x, "bp", 1800, 0.8, { loop: 1 });
  mul(x, shape(lfo(n, r, 2, 12, 5), 0.6, 1));
  scale(x, amp * 0.25);
  let t = 0;
  while (t < n) {
    add(x, bubble(r, r.range(900, 3200), r.range(0.008, 0.025), amp * r.range(0.01, 0.04)), 1, t, true);
    t += sec(r.range(0.01, 0.09));
  }
  return x;
}

/**
 * Crowd murmur with no words: buzz voices through wandering vowel formants,
 * syllables at 3 to 6 per second in phrases, far and low-passed. Stereo.
 */
export function murmur(n, r, voices = 10) {
  const out = [zeros(n), zeros(n)];
  for (let v = 0; v < voices; v++) {
    const x = zeros(n);
    const f0 = r.range(95, 230);
    let ph = 0;
    // intonation: slow periodic curve
    const into = shape(lfo(n, r, 6, 40, 4), 0.85, 1.15);
    for (let i = 0; i < n; i++) {
      ph += (2 * Math.PI * f0 * into[i]) / SR;
      const p = ph % (2 * Math.PI);
      x[i] = (p / Math.PI - 1) * 0.6 + (r() * 2 - 1) * 0.15; // saw + breath
    }
    // syllable envelope in phrases
    const e = zeros(n);
    let t = Math.floor(r() * n);
    let placed = 0;
    while (placed < n * 0.55) {
      const phrase = sec(r.range(0.8, 3));
      let u = 0;
      while (u < phrase) {
        const syl = sec(r.range(0.12, 0.28));
        for (let i = 0; i < syl; i++) e[(t + u + i) % n] = Math.max(e[(t + u + i) % n], Math.sin((Math.PI * i) / syl) ** 1.3 * r.range(0.6, 1));
        u += syl + sec(r.range(0.01, 0.06));
      }
      placed += phrase;
      t = (t + phrase + sec(r.range(0.6, 3.5))) % n;
    }
    smooth(e, 30, { loop: 1 });
    // formants wander between vowels
    const f1 = shape(lfo(n, r, n / SR * 2, n / SR * 4.5, 6), 300, 750);
    const f2 = shape(lfo(n, r, n / SR * 2, n / SR * 4.5, 6), 900, 2000);
    const a = Float32Array.from(x), b = Float32Array.from(x);
    filt(a, "bp", f1, 5, { loop: 1 });
    filt(b, "bp", f2, 7, { loop: 1 });
    const y = zeros(n);
    add(y, a, 1);
    add(y, b, 0.5);
    mul(y, e);
    const pan = r.range(-0.8, 0.8), g = r.range(0.5, 1);
    add(out[0], y, g * (1 - pan) * 0.5);
    add(out[1], y, g * (1 + pan) * 0.5);
  }
  for (const c of out) {
    filt(c, "lp", 1800, 0.7, { loop: 1 });
    filt(c, "hp", 140, 0.7, { loop: 1 });
  }
  return out;
}

/** Steam: a hissing burst that swells and trails off. */
export function steam(r, dur = r.range(1, 2.4), amp = 1) {
  const n = sec(dur);
  const x = white(n, r);
  filt(x, "hp", 1800, 0.7);
  filt(x, "lp", 9000, 0.7);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    e[i] = t < 0.08 ? t / 0.08 : Math.pow(1 - (t - 0.08) / 0.92, 1.6);
  }
  mul(x, e);
  return scale(x, amp * 0.5);
}

/** A long low horn (the freighter, the ferry's horn): detuned saws through a closed formant, slow attack. */
export function horn(r, dur = 3, f0 = 73, amp = 1, sr = SR) {
  const n = Math.round(dur * sr);
  const x = new Float32Array(n);
  const ph = [0, 0, 0];
  const det = [1, 1.004, 1.5 * 0.998];
  const w = [1, 0.8, 0.35];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const vib = 1 + 0.003 * Math.sin((2 * Math.PI * 4.5 * i) / sr) * Math.min(1, t * 3);
    let s = 0;
    for (let k = 0; k < 3; k++) {
      ph[k] += (f0 * det[k] * vib) / sr;
      ph[k] -= Math.floor(ph[k]);
      s += (ph[k] * 2 - 1) * w[k];
    }
    const a = t < 0.18 ? Math.pow(t / 0.18, 1.8) : t > 0.78 ? Math.pow((1 - t) / 0.22, 1.3) : 1;
    x[i] = s * a;
  }
  filt(x, "lp", f0 * 7, 1.2, { sr });
  filt(x, "peak", f0 * 3.2, 1.5, { gain: 6, sr });
  filt(x, "hp", f0 * 0.7, 0.7, { sr });
  return scale(x, amp * 0.35);
}

/** A distant roll of thunder: a slow, rolling low rumble. */
export function farThunder(r, dur = r.range(3.5, 6), amp = 1) {
  const n = sec(dur);
  const x = brown(n, r);
  filt(x, "lp", 140, 0.7);
  const rolls = lfo(n, r, 3, 9, 5);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    e[i] = (t < 0.1 ? t / 0.1 : Math.pow(1 - (t - 0.1) / 0.9, 1.4)) * (0.45 + 0.55 * rolls[i]);
  }
  mul(x, e);
  return scale(x, amp * 4);
}

/** A drip: a small plip (a quick falling-then-rising sine) with a tiny splash. */
export function drip(r, amp = 1) {
  const n = sec(0.09);
  const f = r.range(1200, 3200);
  const x = chirp(n, f * 0.8, f * r.range(1.3, 1.9), 1, SR, r() * 6);
  const e = env(n, 0.001, 0.018);
  mul(x, e);
  const s = white(sec(0.012), r);
  filt(s, "hp", 3000, 0.7);
  for (let i = 0; i < s.length; i++) s[i] *= 1 - i / s.length;
  add(x, s, 0.08);
  return scale(x, amp);
}

/** Rain: a bed of broadband rain plus dense drop ticks. Stereo, periodic. */
export function rain(n, r, { density = 600, bright = 1, body = 1 } = {}) {
  const out = [zeros(n), zeros(n)];
  for (let c = 0; c < 2; c++) {
    const x = pink(n, r);
    filt(x, "hp", 400, 0.7, { loop: 1 });
    filt(x, "lp", 7000 * bright, 0.7, { loop: 1 });
    mul(x, shape(lfo(n, r, 3, 20, 6), 0.75, 1));
    add(out[c], x, body * 0.6);
  }
  const count = Math.floor((density * n) / SR);
  for (let d = 0; d < count; d++) {
    const m = sec(r.range(0.002, 0.008));
    const k = white(m, r);
    filt(k, "bp", r.range(1500, 7000) * bright, r.range(1, 3));
    for (let i = 0; i < m; i++) k[i] *= Math.pow(1 - i / m, 2);
    const t = Math.floor(r() * n), p = r.range(-1, 1), g = r.range(0.05, 0.5);
    add(out[0], k, g * (1 - p) * 0.5, t, true);
    add(out[1], k, g * (1 + p) * 0.5, t, true);
  }
  return out;
}

/** A ping of rain on metal: a short inharmonic ring. */
export function plink(r, amp = 1) {
  const n = sec(0.16);
  const x = zeros(n);
  const f = r.range(2200, 5200);
  for (const [m, a, d] of [[1, 1, 0.05], [2.76, 0.5, 0.03], [5.4, 0.25, 0.02]]) {
    const s = chirp(n, f * m, f * m, a, SR, r() * 6);
    mul(s, env(n, 0.0005, d));
    add(x, s, 1);
  }
  return scale(x, amp);
}

/** Cloth flapping in a gust: noise chopped at a flutter rate, band-limited. */
export function flap(r, dur = r.range(0.8, 2), amp = 1) {
  const n = sec(dur);
  const x = white(n, r);
  filt(x, "bp", r.range(700, 1600), 0.8);
  const rateHz = r.range(9, 16);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const fl = Math.pow(Math.max(0, Math.sin((2 * Math.PI * rateHz * i) / SR * (1 + 0.3 * Math.sin(i / 9000)))), 3);
    e[i] = fl * Math.sin(Math.PI * t) ** 0.8;
  }
  mul(x, e);
  return scale(x, amp * 1.4);
}

/** Wind: a low body with gusts and an optional whistle band. Stereo, periodic. */
export function wind(n, r, { low = 1, whistle = 0.25, hiss = 0.3, gustCycles = [3, 10], calm = 0.3 } = {}) {
  const out = [zeros(n), zeros(n)];
  // gusts: a slow swell (1 to 3 per loop) carrying irregular medium gusts and a little flutter,
  // so the wind never pumps at a steady rate
  const slow = lfo(n, r, 1, 3, 3), mid = lfo(n, r, gustCycles[0], gustCycles[1], 9), fast = lfo(n, r, 40, 90, 6);
  const mixc = new Float32Array(n);
  for (let i = 0; i < n; i++) mixc[i] = Math.min(1, Math.max(0, 0.55 * slow[i] + 0.35 * mid[i] * (0.4 + 0.6 * slow[i]) + 0.1 * fast[i]));
  const gust = shape(mixc, calm, 1, 1.5);
  for (let c = 0; c < 2; c++) {
    const b = brown(n, r);
    const cut = shape(gust, 180, 520);
    filt(b, "lp", cut, 0.8, { loop: 1 });
    mul(b, gust);
    add(out[c], b, low * 1.4);
    if (whistle > 0) {
      const w = pink(n, r);
      const f = shape(lfo(n, r, 2, 8, 4), 480, 950);
      filt(w, "bp", f, 9, { loop: 1 });
      const g2 = Float32Array.from(gust);
      for (let i = 0; i < n; i++) g2[i] = Math.pow(g2[i], 2.5);
      mul(w, g2);
      add(out[c], w, whistle * 0.9);
    }
    if (hiss > 0) {
      const h = white(n, r);
      filt(h, "hp", 2500, 0.7, { loop: 1 });
      filt(h, "lp", 9000, 0.7, { loop: 1 });
      mul(h, gust);
      add(out[c], h, hiss * 0.12);
    }
  }
  out.gust = gust;
  return out;
}

/** Rustle: tiny noise grains whose density follows a curve (reeds, grass, leaves). Stereo. */
export function rustle(n, r, curve, { rate = 250, lo = 2500, hi = 7000, amp = 1 } = {}) {
  const out = [zeros(n), zeros(n)];
  let t = 0;
  while (t < n) {
    const d = Math.max(0.02, curve[t] ?? 0);
    t += Math.max(1, Math.floor((SR / rate / d) * r.range(0.3, 1.7)));
    if (t >= n) break;
    const m = sec(r.range(0.004, 0.018));
    const k = white(m, r);
    filt(k, "bp", r.range(lo, hi), r.range(0.8, 2.5));
    for (let i = 0; i < m; i++) k[i] *= Math.sin((Math.PI * i) / m);
    const p = r.range(-1, 1), g = amp * r.range(0.2, 1) * (curve[t] ?? 0);
    add(out[0], k, g * (1 - p) * 0.5, t, true);
    add(out[1], k, g * (1 + p) * 0.5, t, true);
  }
  return out;
}

/** A mains-fed hum: a fundamental and harmonics with slow beating. */
export function hum(n, r, f0, parts, amp = 1) {
  const x = zeros(n);
  const L = n / SR;
  for (const [m, a] of parts) {
    // whole cycles over the loop for every partial, so the seam is clean
    const f = Math.round(f0 * m * L) / L;
    const ph = r() * 6.28;
    const trem = lfo(n, r, 1, 6, 3);
    for (let i = 0; i < n; i++) x[i] += Math.sin((2 * Math.PI * f * i) / SR + ph) * a * (0.8 + 0.2 * trem[i]);
  }
  return scale(x, amp);
}

/** A buzz with sharp harmonics (a fluorescent ballast), periodic. */
export function buzz(n, r, f0 = 100, amp = 1) {
  const x = zeros(n);
  const L = n / SR;
  const f = Math.round(f0 * L) / L;
  for (let i = 0; i < n; i++) {
    const p = ((f * i) / SR) % 1;
    x[i] = Math.pow(Math.abs(Math.sin(Math.PI * p)), 12) - 0.2;
  }
  filt(x, "bp", 2400, 0.6, { loop: 1 });
  return scale(x, amp);
}

/** A soft cloth swish: noise swept through a band, with a light flutter. */
export function swish(r, dur = 0.28, amp = 1, f0 = 700, f1 = 2600) {
  const n = sec(dur);
  const x = white(n, r);
  const f = new Float32Array(n);
  for (let i = 0; i < n; i++) f[i] = f0 * Math.pow(f1 / f0, Math.sin((Math.PI / 2) * (i / n)));
  filt(x, "bp", f, 1.1);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    e[i] = Math.sin(Math.PI * Math.pow(t, 0.7)) ** 1.4 * (0.75 + 0.25 * Math.sin(2 * Math.PI * 23 * t * dur));
  }
  mul(x, e);
  return scale(x, amp * 1.2);
}

/** A tear: fibres ripping, noise gated by a crackle of tiny breaks. */
export function tear(r, dur = 0.45, amp = 1) {
  const n = sec(dur);
  const x = white(n, r);
  filt(x, "bp", 2600, 0.9);
  const e = zeros(n);
  let t = 0;
  while (t < n) {
    const m = sec(r.range(0.002, 0.012));
    const g = r.range(0.4, 1) * Math.pow(1 - t / n, 0.6);
    for (let i = 0; i < m && t + i < n; i++) e[t + i] = Math.max(e[t + i], g * (1 - i / m));
    t += sec(r.range(0.002, 0.018));
  }
  smooth(e, 900);
  mul(x, e);
  return scale(x, amp * 1.6);
}

/**
 * A struck bell by modal synthesis: the classic partial ratios of a cast bell
 * (hum, prime, tierce, quint, nominal and the upper partials), each with its
 * own decay and a slow beat, plus a short metallic strike.
 */
export function bell(r, { f = 440, decay = 3, dur = 4, bright = 1, amp = 1, sr = SR } = {}) {
  const n = Math.round(dur * sr);
  const x = new Float32Array(n);
  const modes = [
    [0.5, 0.55, 1.0],
    [1.0, 0.7, 0.75],
    [1.19, 0.5, 0.6],
    [1.5, 0.3, 0.45],
    [2.0, 0.65, 0.4],
    [2.51, 0.3, 0.3],
    [2.66, 0.22, 0.28],
    [3.01, 0.18, 0.22],
    [4.1, 0.14 * bright, 0.15],
    [5.43, 0.1 * bright, 0.1],
    [6.8, 0.06 * bright, 0.07],
  ];
  for (const [m, a, d] of modes) {
    const fm = f * m * r.range(0.997, 1.003);
    const beat = r.range(0.3, 1.6);
    const ph = r() * 6.28;
    const k = Math.exp(-1 / (decay * d * sr));
    let v = a;
    for (let i = 0; i < n; i++) {
      const b = 1 - 0.18 * (0.5 + 0.5 * Math.sin((2 * Math.PI * beat * i) / sr));
      x[i] += Math.sin((2 * Math.PI * fm * i) / sr + ph) * v * b;
      v *= k;
    }
  }
  // strike: a few ms of bright noise
  const s = Math.round(0.006 * sr);
  const r2 = r;
  for (let i = 0; i < s; i++) x[i] += (r2() * 2 - 1) * 0.5 * (1 - i / s) * bright;
  const fi = Math.round(0.0015 * sr);
  for (let i = 0; i < fi; i++) x[i] *= i / fi;
  const fo = Math.round(0.25 * sr);
  for (let i = 0; i < fo; i++) x[n - 1 - i] *= i / fo;
  return scale(x, amp * 0.35);
}

/** The colossus's footfall: a sub-bass thud, a ground knock, then a long settling wash. */
export function footfall(r, { dur = 5, amp = 1, sr = 24000 } = {}) {
  const n = Math.round(dur * sr);
  const x = new Float32Array(n);
  // sub thud: a sine falling 38 -> 24 Hz
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 24 + 14 * Math.exp(-t * 3);
    ph += (2 * Math.PI * f) / sr;
    const a = Math.min(1, t / 0.035) * Math.exp(-t / 0.9);
    x[i] += Math.sin(ph) * a * 1.0;
  }
  // body knock: low noise burst
  const kn = Math.round(0.35 * sr);
  const k = brown(kn, r);
  filt(k, "lp", 180, 0.8, { sr });
  for (let i = 0; i < kn; i++) k[i] *= Math.min(1, i / (0.01 * sr)) * Math.exp(-i / (0.09 * sr));
  add(x, k, 3.5);
  // wash: water and grit settling, a long darkening tail
  const w = pink(n, r);
  const cut = new Float32Array(n);
  for (let i = 0; i < n; i++) cut[i] = 200 + 900 * Math.exp(-(i / sr) / 1.2);
  filt(w, "lp", cut, 0.7, { sr });
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    w[i] *= (t < 0.25 ? Math.pow(t / 0.25, 1.5) : Math.exp(-(t - 0.25) / 1.4)) * (0.8 + 0.2 * Math.sin(t * 9));
  }
  add(x, w, 0.55);
  const fo = Math.round(0.4 * sr);
  for (let i = 0; i < fo; i++) x[n - 1 - i] *= i / fo;
  return scale(x, amp * 0.8);
}

/** A slow sift of grit from a ceiling: sparse tiny grains, fading. */
export function sift(r, dur = 1.4, amp = 1) {
  const n = sec(dur);
  const x = zeros(n);
  let t = 0;
  while (t < n) {
    const m = sec(r.range(0.001, 0.004));
    const k = white(m, r);
    filt(k, "bp", r.range(3000, 8000), 1.5);
    add(x, k, r.range(0.2, 1) * Math.pow(1 - t / n, 1.2), t);
    t += sec(r.range(0.002, 0.03) * (1 + 2 * (t / n)));
  }
  return scale(x, amp);
}

/** A neon buzz with a crackle: a harmonic-rich 100 Hz hum, gated. */
export function neonBuzz(r, dur = 0.6, amp = 1) {
  const n = sec(dur);
  const x = zeros(n);
  for (let i = 0; i < n; i++) {
    const p = ((100 * i) / SR) % 1;
    x[i] = Math.pow(Math.abs(Math.sin(Math.PI * p)), 8) - 0.25;
  }
  filt(x, "bp", 1800, 0.7);
  const e = zeros(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    e[i] = (t < 0.05 ? t / 0.05 : 1) * (t > 0.8 ? (1 - t) / 0.2 : 1) * (r() < 0.002 ? 0 : 1);
  }
  smooth(e, 400);
  mul(x, e);
  return scale(x, amp);
}

/** A ratchet crank: evenly spaced pawl clicks with a low gear grind under them. */
export function crank(r, click, { clicks = 9, dur = 1.3, amp = 1 } = {}) {
  const n = sec(dur);
  const x = zeros(n);
  for (let c = 0; c < clicks; c++) {
    const at = Math.floor(((c + 0.3 + r.range(-0.08, 0.08)) / clicks) * n * 0.92);
    add(x, click, r.range(0.7, 1), at);
  }
  const g = brown(n, r);
  filt(g, "bp", 260, 1.2);
  for (let i = 0; i < n; i++) g[i] *= Math.sin((Math.PI * i) / n) * (0.7 + 0.3 * Math.sin((2 * Math.PI * clicks * i) / n));
  add(x, g, 0.9);
  return scale(x, amp);
}

/** A splash: a bright burst, a cloud of bubbles, then drops falling back. */
export function splash(r, { size = 1, amp = 1 } = {}) {
  const n = sec(0.55 + 0.35 * size);
  const x = zeros(n);
  const bn = sec(0.06 + 0.05 * size);
  const b = white(bn, r);
  filt(b, "bp", 1400, 0.6);
  for (let i = 0; i < bn; i++) b[i] *= Math.min(1, i / 40) * Math.pow(1 - i / bn, 1.5);
  add(x, b, 0.6 * size);
  const nb = Math.floor(10 + 25 * size);
  for (let i = 0; i < nb; i++) add(x, bubble(r, r.range(500, 2600) / Math.sqrt(size), r.range(0.015, 0.06), r.range(0.05, 0.18)), 1, Math.floor(Math.pow(r(), 1.8) * n * 0.5));
  for (let i = 0; i < 4 + 6 * size; i++) add(x, drip(r, r.range(0.04, 0.12)), 1, Math.floor(r.range(0.25, 0.85) * n));
  const s = pink(n, r);
  filt(s, "bp", 600, 0.8);
  for (let i = 0; i < n; i++) s[i] *= Math.exp(-i / (0.12 * SR)) * Math.min(1, i / 200);
  add(x, s, 1.2 * size);
  return scale(x, amp);
}

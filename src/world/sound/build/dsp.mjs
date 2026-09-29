// Small offline DSP kit for the world's sound build (lane S1). Node only; not
// part of the page bundle (hooks.ts only globs src/world/sound/**/*.ts).
//
// Everything is deterministic: seeded noise, no clocks. Beds are built as exact
// loops: continuous layers are made periodic (noise buffers of the loop length,
// periodic LFOs with whole cycles per loop) and every stateful filter or
// reverb is run over the loop several times so its output is the steady state
// of a circular signal. Events (drips, ticks, hammer blows) are placed with
// wrap-around, so their tails continue at the start of the loop.

import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const SR = 48000;

/** mulberry32: a seeded PRNG in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.gauss = () => {
    let u = 0;
    for (let i = 0; i < 6; i++) u += r();
    return (u - 3) / Math.sqrt(0.5);
  };
  return r;
}

export const db = (v) => Math.pow(10, v / 20);
export const todb = (v) => 20 * Math.log10(Math.max(1e-12, v));
export const sec = (s, sr = SR) => Math.round(s * sr);

// --- files ---------------------------------------------------------------------------

/** Decode any audio file to Float32 channels at `sr` (ffmpeg). */
export function decode(path, { sr = SR, ch = 1 } = {}) {
  const b = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-ac", String(ch), "-ar", String(sr), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  const all = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const n = all.length / ch;
  const out = [];
  for (let c = 0; c < ch; c++) {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = all[i * ch + c];
    out.push(x);
  }
  return out;
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** 16-bit PCM WAV with TPDF dither. */
export function writeWav(path, chans, sr = SR, seed = 1) {
  const r = rng(seed);
  const n = chans[0].length;
  const ch = chans.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * ch * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = chans[c][i] * 32767 + (r() - r());
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), o);
      o += 2;
    }
  writeFileSync(path, buf);
}

/** Encode a WAV to Opus and AAC (m4a) next to `base`. */
export function encodeBed(wav, base, { opus = 56, aac = 80 } = {}) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-c:a", "libopus", "-b:a", `${opus}k`, "-vbr", "on", "-application", "audio", "-map_metadata", "-1", `${base}.opus`]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", `${aac}k`, "-map_metadata", "-1", "-movflags", "+faststart", `${base}.m4a`]);
}

// --- signals --------------------------------------------------------------------------

export const zeros = (n) => new Float32Array(n);

export function white(n, r) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}

/** Pink-ish noise (Kellet's filter), run over the buffer twice so it is periodic. */
export function pink(n, r) {
  const w = white(n, r);
  const x = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < n; i++) {
      const v = w[i];
      b0 = 0.99886 * b0 + v * 0.0555179;
      b1 = 0.99332 * b1 + v * 0.0750759;
      b2 = 0.969 * b2 + v * 0.153852;
      b3 = 0.8665 * b3 + v * 0.3104856;
      b4 = 0.55 * b4 + v * 0.5329522;
      b5 = -0.7616 * b5 - v * 0.016898;
      x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + v * 0.5362) * 0.11;
      b6 = v * 0.115926;
    }
  return x;
}

/** Brown noise (leaky integrator), periodic. */
export function brown(n, r) {
  const w = white(n, r);
  const x = new Float32Array(n);
  let s = 0;
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < n; i++) {
      s = s * 0.996 + w[i] * 0.06;
      x[i] = s;
    }
  // remove the DC the leak leaves (keeps the loop seam clean)
  let m = 0;
  for (let i = 0; i < n; i++) m += x[i];
  m /= n;
  for (let i = 0; i < n; i++) x[i] -= m;
  return x;
}

/**
 * A smooth periodic random curve over `n` samples: a sum of sines with whole
 * cycles per loop between `lo` and `hi` cycles, normalised to [0, 1].
 */
export function lfo(n, r, lo, hi, parts = 6) {
  const x = new Float64Array(n);
  for (let k = 0; k < parts; k++) {
    const cyc = Math.max(1, Math.round(r.range(lo, hi)));
    const ph = r() * Math.PI * 2;
    const a = r.range(0.4, 1) / (1 + k * 0.3);
    const w = (2 * Math.PI * cyc) / n;
    for (let i = 0; i < n; i++) x[i] += a * Math.sin(w * i + ph);
  }
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < n; i++) {
    mn = Math.min(mn, x[i]);
    mx = Math.max(mx, x[i]);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (x[i] - mn) / (mx - mn || 1);
  return out;
}

export function mul(x, y) {
  for (let i = 0; i < x.length; i++) x[i] *= y[i];
  return x;
}
export function scale(x, g) {
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}
export function add(dst, src, g = 1, at = 0, wrap = false) {
  const n = dst.length;
  for (let i = 0; i < src.length; i++) {
    let j = i + at;
    if (wrap) j = ((j % n) + n) % n;
    else if (j < 0 || j >= n) continue;
    dst[j] += src[i] * g;
  }
  return dst;
}
/** Map a 0..1 curve into [a, b] with an optional power. */
export function shape(c, a, b, pow = 1) {
  const o = new Float32Array(c.length);
  for (let i = 0; i < c.length; i++) o[i] = a + (b - a) * Math.pow(c[i], pow);
  return o;
}

// --- filters --------------------------------------------------------------------------

/** RBJ biquad coefficients. */
export function biquad(type, f, q = 0.707, gainDb = 0, sr = SR) {
  const w = (2 * Math.PI * Math.min(f, sr * 0.49)) / sr;
  const cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case "lp": b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case "hp": b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case "bp": b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case "peak": b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break;
    case "hs": {
      const s2 = 2 * Math.sqrt(A) * al;
      b0 = A * (A + 1 + (A - 1) * cs + s2); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - s2);
      a0 = A + 1 - (A - 1) * cs + s2; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s2;
      break;
    }
    case "ls": {
      const s2 = 2 * Math.sqrt(A) * al;
      b0 = A * (A + 1 - (A - 1) * cs + s2); b1 = 2 * A * (A - 1 - (A + 1) * cs); b2 = A * (A + 1 - (A - 1) * cs - s2);
      a0 = A + 1 + (A - 1) * cs + s2; a1 = -2 * (A - 1 + (A + 1) * cs); a2 = A + 1 + (A - 1) * cs - s2;
      break;
    }
    default: throw new Error(type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/**
 * Filter in place. `loop` runs the filter over the buffer that many times first
 * (a circular signal: the output is periodic). `f` may be a Float32Array of
 * per-sample cutoffs (updated every 32 samples).
 */
export function filt(x, type, f, q = 0.707, { loop = 0, gain = 0, sr = SR } = {}) {
  let c = typeof f === "number" ? biquad(type, f, q, gain, sr) : null;
  let z1 = 0, z2 = 0;
  const run = (write) => {
    for (let i = 0; i < x.length; i++) {
      if (!c || (typeof f !== "number" && (i & 31) === 0)) c = biquad(type, f[i], q, gain, sr);
      const v = x[i];
      const y = c[0] * v + z1;
      z1 = c[1] * v - c[3] * y + z2;
      z2 = c[2] * v - c[4] * y;
      if (write) x[i] = y;
    }
  };
  for (let p = 0; p < loop; p++) run(false);
  run(true);
  return x;
}

/** One-pole low-pass (smoothing), periodic when `loop`. */
export function smooth(x, f, { loop = 0, sr = SR } = {}) {
  const a = Math.exp((-2 * Math.PI * f) / sr);
  let s = 0;
  for (let p = 0; p < loop; p++) for (let i = 0; i < x.length; i++) s = a * s + (1 - a) * x[i];
  for (let i = 0; i < x.length; i++) x[i] = s = a * s + (1 - a) * x[i];
  return x;
}

// --- reverb -------------------------------------------------------------------------------

/**
 * A stereo feedback-delay-network reverb (8 lines, Householder mix, damped).
 * `t60` decay seconds, `size` scales the delay lengths, `damp` Hz (high cut in
 * the loop), `pre` pre-delay seconds. Returns [L, R] wet only. With `loop` the
 * input is treated as circular (beds); otherwise the output is extended by
 * `tail` seconds.
 */
export function reverb(input, { t60 = 2, size = 1, damp = 5000, pre = 0.01, loop = false, tail = 0, seed = 7, sr = SR } = {}) {
  const r = rng(seed);
  const base = [1433, 1601, 1867, 2053, 2251, 2399, 2617, 2797];
  const lens = base.map((b) => Math.max(8, Math.round(b * size * (sr / 48000) * r.range(0.97, 1.03))));
  const g = lens.map((L) => Math.pow(10, (-3 * L) / (t60 * sr)));
  const da = Math.exp((-2 * Math.PI * damp) / sr);
  const lines = lens.map((L) => new Float32Array(L));
  const idx = lens.map(() => 0);
  const lp = lens.map(() => 0);
  const inL = input[0], inR = input[1] ?? input[0];
  const n = inL.length;
  const total = loop ? n : n + sec(tail, sr);
  const preN = sec(pre, sr);
  const outL = new Float32Array(total), outR = new Float32Array(total);
  const passes = loop ? Math.max(2, Math.ceil((t60 * sr) / n) + 1) : 1;
  const vals = new Float64Array(8);
  for (let p = 0; p < passes; p++) {
    const write = p === passes - 1;
    for (let i = 0; i < total; i++) {
      let j = i - preN;
      if (loop) j = ((j % n) + n) % n;
      const xl = j >= 0 && j < n ? inL[j] : 0;
      const xr = j >= 0 && j < n ? inR[j] : 0;
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        const v = lines[k][idx[k]];
        lp[k] = (1 - da) * v + da * lp[k];
        vals[k] = lp[k] * g[k];
        sum += vals[k];
      }
      const h = (2 / 8) * sum;
      let yl = 0, yr = 0;
      for (let k = 0; k < 8; k++) {
        const fb = vals[k] - h + (k & 1 ? xr : xl) * 0.35;
        lines[k][idx[k]] = fb;
        idx[k] = (idx[k] + 1) % lens[k];
        if (k < 4) yl += vals[k] * (k & 1 ? -1 : 1);
        else yr += vals[k] * (k & 1 ? -1 : 1);
      }
      if (write) {
        outL[i] = yl * 0.5;
        outR[i] = yr * 0.5;
      }
    }
  }
  return [outL, outR];
}

// --- clips ----------------------------------------------------------------------------------

/** Resample a mono clip by `rate` (pitch and speed together), linear interpolation. */
export function rate(x, k) {
  const n = Math.floor(x.length / k);
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * k, a = Math.floor(p), f = p - a;
    o[i] = (x[a] ?? 0) * (1 - f) + (x[a + 1] ?? 0) * f;
  }
  return o;
}

/** Trim to `len` seconds with a `fade` seconds cosine fade-out (and a 1 ms fade-in). */
export function trim(x, len, fade = 0.03, sr = SR, startAt = 0) {
  const a = sec(startAt, sr);
  const n = Math.min(x.length - a, sec(len, sr));
  const o = x.slice(a, a + n);
  const fn = Math.min(n, sec(fade, sr));
  for (let i = 0; i < fn; i++) o[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fn);
  const fi = Math.min(n, sec(0.001, sr));
  for (let i = 0; i < fi; i++) o[i] *= i / fi;
  return o;
}

/** Strip leading silence below `thresh` dBFS (keeps 2 ms before the onset). */
export function onset(x, thresh = -50, sr = SR) {
  const t = db(thresh);
  let i = 0;
  while (i < x.length && Math.abs(x[i]) < t) i++;
  return x.slice(Math.max(0, i - sec(0.002, sr)));
}

export function reverse(x) {
  return Float32Array.from(x).reverse();
}

/** An exponential decay envelope with a linear attack. */
export function env(n, attack, decay, sr = SR) {
  const o = new Float32Array(n);
  const a = Math.max(1, sec(attack, sr));
  const k = Math.exp(-1 / Math.max(1, decay * sr));
  let v = 1;
  for (let i = 0; i < n; i++) {
    if (i < a) o[i] = i / a;
    else {
      v *= k;
      o[i] = v;
    }
  }
  return o;
}

/** A sine sweep (exponential from f0 to f1) under an envelope. */
export function chirp(n, f0, f1, amp = 1, sr = SR, phase = 0) {
  const o = new Float32Array(n);
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const f = f0 * Math.pow(f1 / f0, i / n);
    ph += (2 * Math.PI * f) / sr;
    o[i] = Math.sin(ph) * amp;
  }
  return o;
}

/** Equal-power pan of a mono clip into [L, R] buffers. */
export function panAdd(L, R, clip, at, g, pan, wrap = true) {
  const a = ((pan + 1) * Math.PI) / 4;
  add(L, clip, g * Math.cos(a), at, wrap);
  add(R, clip, g * Math.sin(a), at, wrap);
}

// --- measuring ------------------------------------------------------------------------------

export function peak(chans) {
  let p = 0;
  for (const x of chans) for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return p;
}
export function rms(chans) {
  let s = 0, n = 0;
  for (const x of chans) {
    for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    n += x.length;
  }
  return Math.sqrt(s / Math.max(1, n));
}
/** The 95th percentile of 20 ms frame RMS: the level of the loud part of a short clip. */
export function loud(x, sr = SR) {
  const w = sec(0.02, sr), fr = [];
  for (let i = 0; i + w <= x.length; i += w) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += x[j] * x[j];
    fr.push(Math.sqrt(s / w));
  }
  if (!fr.length) return rms([x]);
  fr.sort((a, b) => a - b);
  return fr[Math.floor(fr.length * 0.95)] ?? fr[fr.length - 1];
}

/** Scale channels so their RMS is `target` dBFS; then soft-limit peaks to `ceil` dBFS. */
export function level(chans, target, ceil = -6) {
  const g = db(target) / Math.max(1e-9, rms(chans));
  for (const x of chans) scale(x, g);
  const c = db(ceil);
  for (const x of chans)
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      if (Math.abs(v) > c * 0.8) {
        const s = Math.sign(v), e = Math.abs(v) - c * 0.8;
        x[i] = s * (c * 0.8 + (c * 0.2) * Math.tanh(e / (c * 0.2)));
      }
    }
  return chans;
}

/** The biggest jump across the loop seam relative to the typical sample-to-sample step. */
export function seam(chans) {
  let worst = 0;
  for (const x of chans) {
    let d = 0;
    for (let i = 1; i < x.length; i++) d += Math.abs(x[i] - x[i - 1]);
    d /= x.length - 1;
    worst = Math.max(worst, Math.abs(x[0] - x[x.length - 1]) / (d || 1e-9));
  }
  return worst;
}

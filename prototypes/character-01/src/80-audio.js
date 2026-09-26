// ---------------------------------------------------------------------------
// Audio: small synthesized SFX (no files). Starts on the first input.
// ---------------------------------------------------------------------------
const AUDIO = (() => {
  let ctx = null, master = null, muted = false, noiseBuf = null;
  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { return false; }
  }
  const now = () => ctx.currentTime;
  function noise(dur, f0, f1, q, gain, type = 'bandpass') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, now()); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now() + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(gain, now() + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(); src.stop(now() + dur + 0.05);
  }
  function tone(type, f0, f1, dur, gain, delay = 0) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, now() + delay); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now() + delay + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now() + delay); g.gain.exponentialRampToValueAtTime(gain, now() + delay + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, now() + delay + dur);
    o.connect(g); g.connect(master); o.start(now() + delay); o.stop(now() + delay + dur + 0.05);
  }
  const SFX = {
    swish: () => noise(0.16, 3200, 700, 1.2, 0.5),
    swishHeavy: () => { noise(0.28, 1800, 260, 1.0, 0.7); tone('sine', 180, 70, 0.25, 0.15); },
    hit: () => { noise(0.08, 2400, 900, 0.8, 0.6, 'lowpass'); tone('square', 220, 90, 0.07, 0.12); tone('sine', 120, 50, 0.12, 0.3); },
    hitHeavy: () => { noise(0.18, 1600, 200, 0.7, 0.8, 'lowpass'); tone('sine', 90, 35, 0.3, 0.5); tone('square', 160, 60, 0.12, 0.15); },
    clang: () => { [1, 2.76, 5.4, 8.93].forEach((m, i) => tone('triangle', 900 * m, 900 * m * 0.98, 0.5 - i * 0.08, 0.14 / (i + 1))); noise(0.05, 6000, 3000, 1, 0.4); },
    cut: () => { noise(0.05, 7000, 4000, 2, 0.35); tone('square', 1400, 900, 0.04, 0.05); },
    fire: () => { tone('square', 880, 330, 0.08, 0.06); noise(0.05, 5000, 2000, 1.5, 0.15); },
    boom: () => { noise(0.6, 900, 60, 0.6, 0.9, 'lowpass'); tone('sine', 70, 28, 0.6, 0.6); },
    dodge: () => noise(0.22, 600, 2400, 0.7, 0.35),
    slow: () => { tone('sine', 660, 110, 0.9, 0.18); noise(0.6, 400, 2000, 3, 0.1); },
    step: () => noise(0.04, 900, 400, 1, 0.08, 'lowpass'),
    land: () => { noise(0.1, 700, 200, 0.8, 0.3, 'lowpass'); },
    hurt: () => { tone('sawtooth', 300, 120, 0.15, 0.12); noise(0.1, 1200, 400, 0.8, 0.4, 'lowpass'); },
    charge: () => tone('sine', 220, 880, 0.35, 0.08),
    burst: () => { tone('sine', 55, 30, 1.4, 0.6); noise(1.2, 200, 4000, 0.5, 0.25); },
    burstHit: () => { noise(0.4, 3000, 200, 0.6, 0.9, 'lowpass'); tone('sine', 110, 30, 0.6, 0.6); [1, 3, 5].forEach((m) => tone('triangle', 440 * m, 400 * m, 0.4, 0.05)); },
    detonate: () => { noise(0.25, 4000, 500, 0.8, 0.7); tone('square', 300, 80, 0.2, 0.12); },
  };
  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    play(name) { if (muted || !ctx || ctx.state !== 'running') return; const f = SFX[name]; if (f) f(); },
    set muted(v) { muted = v; }, get muted() { return muted; },
  };
})();

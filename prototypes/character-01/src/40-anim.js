// ---------------------------------------------------------------------------
// Animation: pose library, keyframed moves, procedural locomotion.
// Timing is in frames at 60fps. Keys ease INTO their pose. The shapes follow
// action-game practice: slow anticipation (inQuad/inBack), a strike that
// lands in 2-4 frames (outExpo), a follow-through that overshoots and
// settles (outCubic/outBack), then a recovery that is cancelable.
// The blade lives in the far hand (gr 2); gr 3 adds the near hand.
// ---------------------------------------------------------------------------
const P = {};
P.idle = mkPose({ yaw: 1, rx: -4.2, ry: -67.8, hp: 0.22, sp: -0.18, hd: 0.28, fx: -2, bx: 9, bt: 0.55, fa: 1.5, fr: 0.7, fe: 1, hf: 1, gr: 2, bz: 0, ba: 1.3, br: 0.84, be: -1, bd: 0.62, gp: 10 });
P.ready = mkPose({ yaw: 0.62, rx: 1, ry: -62, hp: 0.04, sp: 0.2, hd: -0.06, fx: -12, bx: 15, bt: 0.2, ft: 0.1, gr: 3, g2: 1, bz: 1, ba: 0.5, br: 0.62, be: 1, fe: 1, bd: -0.38, gp: 12, fc: 1 });
P.lowIdle = mkPose({ yaw: 0.8, rx: -2, ry: -63, hp: 0.12, sp: 0.3, hd: 0.3, fx: -6, bx: 10, bt: 0.4, kb: -1, fa: 1.1, fr: 0.5, fe: 1, hf: 1, gr: 2, bz: 0, ba: 1.45, br: 0.95, be: -1, bd: 1.1, gp: 10, fc: 3 });

// jump
P.squat = mkPose({ yaw: 0.55, ry: -57, sp: 0.26, hd: -0.05, fx: -8, bx: 9, bt: 0.3, fa: 1.9, fr: 0.9, ba: 2.3, br: 0.9, be: 1, gr: 2, bz: 0, bd: 2.9, gp: 11, fc: 1 });
P.rise = mkPose({ yaw: 0.5, ry: -70, sp: 0.06, hd: -0.12, fx: 7, fy: -15, ft: 0.6, bx: -6, by: -3, bt: 0.9, fa: -0.7, fr: 0.8, fe: -1, ba: 2.5, br: 0.95, be: 1, gr: 2, bz: 0, bd: 2.95, gp: 11, fc: 1 });
P.fall = mkPose({ yaw: 0.5, ry: -70, sp: -0.04, hd: 0.05, fx: 5, fy: -3, ft: 0.5, bx: -7, by: -7, bt: 0.8, fa: 0.4, fr: 0.9, ba: 2.2, br: 0.9, be: 1, gr: 2, bz: 0, bd: 2.6, gp: 11, fc: 0 });
P.land = mkPose({ yaw: 0.55, ry: -54, sp: 0.34, hd: -0.1, fx: -10, bx: 11, bt: 0.2, fa: 1.8, fr: 0.9, ba: 2.2, br: 0.9, be: 1, gr: 2, bz: 0, bd: 2.9, gp: 11, fc: 1 });

// light string -------------------------------------------------------------
P.a1w = mkPose({ yaw: 0.85, rx: -2, ry: -64, hp: 0.02, sp: -0.1, hd: 0.05, fx: -12, bx: 10, bt: 0.2, fa: 0.9, fr: 0.7, fe: 1, hf: 1, gr: 2, g2: 0, bz: 0, ba: -2.25, br: 0.78, be: 1, bd: -2.55, gp: 12, fc: 1 });
P.a1s = mkPose({ yaw: 0.5, rx: 6, ry: -60, hp: 0.05, sp: 0.32, hd: -0.08, fx: -15, bx: 20, bt: 0.4, fa: 1.9, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 1, bz: 1, ba: 0.5, br: 1.0, be: 1, bd: 0.72, gp: 12, fc: 4 });
P.a1f = mkPose({ yaw: 0.5, rx: 8, ry: -59, hp: 0.05, sp: 0.38, hd: -0.05, fx: -15, bx: 20, bt: 0.4, fa: 2.0, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 1, bz: 1, ba: 1.25, br: 0.88, be: 1, bd: 1.85, gp: 12, fc: 1 });

P.a2w = mkPose({ yaw: 0.6, rx: 4, ry: -58, hp: 0.05, sp: 0.36, hd: -0.05, fx: -14, bx: 18, bt: 0.4, fa: 2.1, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 0, bz: 0, ba: 1.95, br: 0.92, be: 1, bd: 2.75, gp: 12, fc: 1 });
P.a2s = mkPose({ yaw: 0.55, rx: 8, ry: -66, hp: -0.04, sp: -0.02, hd: -0.18, fx: -10, bx: 20, bt: 0.6, fa: 2.3, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 1, bz: 1, ba: -1.05, br: 0.96, be: -1, bd: -1.0, gp: 12, fc: 4 });
P.a2f = mkPose({ yaw: 0.6, rx: 9, ry: -67, hp: -0.04, sp: -0.12, hd: -0.2, fx: -10, bx: 20, bt: 0.6, fa: 2.3, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 1, bz: 0, ba: -1.75, br: 0.92, be: -1, bd: -1.95, gp: 12, fc: 1 });

P.a3w = mkPose({ yaw: 0.9, rx: 2, ry: -62, hp: 0.06, sp: 0.1, hd: 0.1, fx: -12, bx: 12, bt: 0.3, fa: 0.6, fr: 0.7, fe: 1, hf: 1, gr: 2, g2: 0, bz: 0, ba: 2.9, br: 0.95, be: 1, bd: 3.1, gp: 12, fc: 1 });
P.a3s1 = mkPose({ yaw: 0.3, rx: 8, ry: -61, hp: 0.04, sp: 0.24, hd: -0.05, fx: -14, bx: 18, bt: 0.4, fa: 2.4, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 1, bz: 1, ba: 0.08, br: 1.0, be: 1, bd: 0.04, gp: 12, fc: 4 });
P.a3m = mkPose({ yaw: 0.15, rx: 9, ry: -62, hp: 0.04, sp: 0.2, hd: -0.05, fx: -12, bx: 16, bt: 0.4, fa: 2.2, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 0, bz: 0, ba: -1.4, br: 0.7, be: -1, bd: -1.6, bl: 0.35, gp: 12, fc: 1 });
P.a3s2 = mkPose({ yaw: 0.35, rx: 12, ry: -60, hp: 0.04, sp: 0.3, hd: -0.05, fx: -14, bx: 20, bt: 0.4, fa: 2.4, fr: 0.8, fe: 1, hf: 1, gr: 2, g2: 1, bz: 1, ba: 0.3, br: 1.0, be: 1, bd: 0.28, bl: 1, gp: 12, fc: 4 });

P.a4w = mkPose({ yaw: 0.8, rx: 0, ry: -74, hp: -0.04, sp: -0.16, hd: -0.2, fx: -8, fy: -2, bx: 10, by: -4, bt: 0.6, gr: 3, g2: 1, bz: 1, fe: -1, ba: -1.62, br: 0.92, be: -1, bd: -2.2, gp: 12, fc: 1 });
P.a4s = mkPose({ yaw: 0.5, rx: 10, ry: -50, hp: 0.08, sp: 0.58, hd: -0.2, fx: -18, bx: 24, bt: 0.6, gr: 3, g2: 1, bz: 1, fe: 1, ba: 0.62, br: 1.0, be: 1, bd: 0.92, gp: 12, fc: 4 });
P.a4h = mkPose({ yaw: 0.5, rx: 10, ry: -49, hp: 0.08, sp: 0.62, hd: -0.26, fx: -18, bx: 24, bt: 0.6, gr: 3, g2: 1, bz: 1, fe: 1, ba: 0.7, br: 1.0, be: 1, bd: 0.98, gp: 12, fc: 1 });

// charge (the reference crouch) and the lunge it releases into
P.charge = mkPose({ yaw: 0.45, rx: 2, ry: -41, hp: 0.1, sp: 0.72, hd: -0.5, fx: 17, bx: -19, bt: 0.85, fa: 1.22, fr: 1.0, fe: 1, hf: 0, gr: 2, g2: 0, bz: 0, ba: -2.45, br: 0.82, be: 1, bd: -2.78, gp: 12, fc: 1 });
P.lunge = mkPose({ yaw: 0.25, rx: 16, ry: -54, hp: 0.06, sp: 0.5, hd: -0.12, fx: -22, bx: 26, bt: 0.8, gr: 3, g2: 1, bz: 1, fe: 1, ba: 0.04, br: 1.0, be: 1, bd: 0.02, gp: 12, fc: 4 });
P.lungeF = mkPose({ yaw: 0.35, rx: 14, ry: -58, hp: 0.06, sp: 0.36, hd: -0.05, fx: -18, bx: 22, bt: 0.6, gr: 3, g2: 1, bz: 1, fe: 1, ba: 0.25, br: 0.9, be: 1, bd: 0.2, gp: 12, fc: 1 });

// air
P.airW = mkPose({ yaw: 0.6, ry: -70, sp: -0.05, hd: -0.1, fx: 6, fy: -12, ft: 0.6, bx: -6, by: -4, bt: 0.8, fa: 0.6, fr: 0.8, gr: 2, g2: 0, bz: 0, ba: -2.1, br: 0.8, be: 1, bd: -2.4, gp: 12, fc: 1 });
P.airS = mkPose({ yaw: 0.45, ry: -70, sp: 0.3, hd: -0.1, fx: 8, fy: -8, ft: 0.6, bx: -8, by: -6, bt: 0.8, fa: 2.0, fr: 0.8, gr: 2, g2: 1, bz: 1, ba: 0.75, br: 1.0, be: 1, bd: 1.05, gp: 12, fc: 4 });
P.plungeUp = mkPose({ yaw: 0.6, ry: -74, sp: -0.1, hd: -0.2, fx: 6, fy: -18, ft: 0.7, bx: -4, by: -10, bt: 0.9, gr: 3, g2: 1, bz: 1, fe: -1, ba: -1.5, br: 0.9, be: -1, bd: -1.75, gp: 12, fc: 1 });
P.plunge = mkPose({ yaw: 0.55, ry: -70, sp: 0.2, hd: 0.2, fx: 8, fy: -14, ft: 0.7, bx: -6, by: -12, bt: 0.9, gr: 3, g2: 1, bz: 1, fe: 1, ba: 1.25, br: 0.9, be: 1, bd: 1.57, gp: 12, fc: 4 });

// defence
P.dash = mkPose({ yaw: 0.25, rx: 4, ry: -56, hp: 0.05, sp: 0.6, hd: -0.2, fx: 14, bx: -22, bt: 0.9, fa: 2.6, fr: 0.9, fe: 1, hf: 1, gr: 2, g2: 0, bz: 0, ba: 2.75, br: 0.95, be: 1, bd: 3.05, gp: 11, fc: 1 });
P.hop = mkPose({ yaw: 0.7, rx: -6, ry: -70, hp: -0.06, sp: -0.28, hd: 0.08, fx: 10, fy: -6, ft: 0.4, bx: -2, by: -2, bt: 0.8, fa: 0.4, fr: 0.9, gr: 2, bz: 0, ba: 1.9, br: 0.95, be: 1, bd: 2.5, gp: 11, fc: 1 });
P.guard = mkPose({ yaw: 0.65, rx: -1, ry: -63, hp: 0.02, sp: 0.06, hd: -0.05, fx: -12, bx: 14, bt: 0.3, gr: 3, g2: 1, bz: 1, fe: 1, ba: 0.25, br: 0.55, be: 1, bd: -1.32, gp: 13, fc: 1 });
P.deflect = mkPose({ yaw: 0.55, rx: 5, ry: -61, hp: 0.04, sp: 0.2, hd: -0.05, fx: -14, bx: 18, bt: 0.4, gr: 3, g2: 1, bz: 1, fe: 1, ba: 0.4, br: 0.9, be: 1, bd: 0.55, gp: 12, fc: 4 });

// taking hits
P.flinch = mkPose({ yaw: 0.75, rx: -5, ry: -64, hp: -0.1, sp: -0.3, hd: -0.32, fx: -8, bx: 12, bt: 0.3, fa: 2.2, fr: 0.8, fe: 1, gr: 2, bz: 0, ba: 2.3, br: 0.9, be: 1, bd: 2.9, gp: 11, fc: 3 });
P.airHit = mkPose({ yaw: 0.7, rx: -6, ry: -64, hp: -0.2, sp: -0.6, hd: -0.3, fx: 10, fy: -10, ft: 0.6, bx: 4, by: -18, bt: 0.8, fa: 2.6, fr: 0.9, gr: 2, bz: 0, ba: -2.6, br: 0.9, be: 1, bd: -2.9, gp: 11, fc: 3 });
P.down = mkPose({ yaw: 0.6, rx: -14, ry: -9, hp: -1.25, sp: -1.45, hd: 0.2, fx: 30, fy: 0, ft: -0.2, bx: 22, by: -6, bt: 0.2, kb: 1, fa: 2.4, fr: 0.9, fe: 1, gr: 2, bz: 0, ba: 1.6, br: 0.9, be: 1, bd: 0.2, gp: 11, fc: 2 });
P.kneel = mkPose({ yaw: 0.6, rx: -2, ry: -40, hp: 0.1, sp: 0.5, hd: -0.3, fx: 14, bx: -16, by: 0, bt: 1.2, fa: 1.3, fr: 0.95, fe: 1, hf: 0, gr: 2, bz: 0, ba: 1.8, br: 0.9, be: 1, bd: 2.4, gp: 11, fc: 1 });

// skill: Red Line (dash-cut, delayed detonation)
P.skW = mkPose({ yaw: 0.5, rx: -2, ry: -50, hp: 0.08, sp: 0.55, hd: -0.3, fx: 14, bx: -16, bt: 0.9, fa: 1.8, fr: 0.9, gr: 2, bz: 0, ba: 2.7, br: 0.95, be: 1, bd: 3.0, gp: 12, fc: 1 });
P.skD = mkPose({ yaw: 0.22, rx: 10, ry: -50, hp: 0.05, sp: 0.62, hd: -0.2, fx: -22, bx: 22, bt: 0.9, fa: 2.4, fr: 0.9, gr: 2, g2: 1, bz: 1, ba: 0.1, br: 1.0, be: 1, bd: 0.08, gp: 12, fc: 4 });
P.skE = mkPose({ yaw: 0.45, rx: 6, ry: -58, hp: 0.05, sp: 0.36, hd: -0.35, fx: -18, bx: 16, bt: 0.6, fa: 1.0, fr: 0.8, gr: 2, g2: 0, bz: 0, ba: 2.45, br: 0.98, be: 1, bd: 2.95, gp: 12, fc: 1 });

// burst: Halo
P.buUp = mkPose({ yaw: 1, rx: 0, ry: -70, hp: 0, sp: -0.14, hd: -0.3, fx: -6, bx: 7, bt: 0.2, gr: 3, g2: 1, bz: 1, fe: -1, ba: -1.57, br: 0.95, be: -1, bd: -1.57, gp: 12, fc: 2 });
P.buCut = mkPose({ yaw: 0.45, rx: 12, ry: -48, hp: 0.08, sp: 0.66, hd: -0.3, fx: -20, bx: 26, bt: 0.7, gr: 3, g2: 1, bz: 1, fe: 1, ba: 0.75, br: 1.0, be: 1, bd: 1.05, gp: 12, fc: 4 });

// idle flourish: rest the blade on the shoulder, flick the hair
P.flA = mkPose({ yaw: 1, rx: -3, ry: -68, hp: 0.15, sp: -0.12, hd: 0.15, fx: -2, bx: 8, bt: 0.5, fa: -1.1, fr: 0.5, fe: -1, hf: 0, gr: 2, g2: 1, bz: 0, ba: -0.35, br: 0.4, be: 1, bd: -2.6, gp: 11, fc: 0 });
P.flB = mkPose({ yaw: 1, rx: -3.5, ry: -68, hp: 0.18, sp: -0.14, hd: 0.25, fx: -2, bx: 8.5, bt: 0.5, fa: 1.5, fr: 0.7, fe: 1, hf: 1, gr: 2, g2: 1, bz: 0, ba: -0.35, br: 0.4, be: 1, bd: -2.62, gp: 11, fc: 2 });

// key helper: [frame, pose, ease]
const K_ = (t, p, e = 'inOutSine') => ({ t, p, e });

// Move table. hit: [from, to, {dmg, kb, stop, shake, kind}], move: [[f0, f1, px]]
const ANIM = {
  atk1: { len: 30, cancel: 13, next: 'atk2', keys: [K_(0, P.ready), K_(5, P.a1w, 'inQuad'), K_(9, P.a1s, 'outExpo'), K_(17, P.a1f, 'outCubic'), K_(30, P.ready, 'inOutSine')],
    hit: [[6, 10, { dmg: 118, kb: 70, stop: 4, shake: 2 }]], move: [[4, 9, 22]], swing: 5 },
  atk2: { len: 28, cancel: 13, next: 'atk3', keys: [K_(0, P.a1f), K_(5, P.a2w, 'inQuad'), K_(9, P.a2s, 'outExpo'), K_(16, P.a2f, 'outCubic'), K_(28, P.ready, 'inOutSine')],
    hit: [[6, 10, { dmg: 132, kb: 60, stop: 4, shake: 2, lift: 160 }]], move: [[4, 9, 16]], swing: 5 },
  atk3: { len: 34, cancel: 20, next: 'atk4', keys: [K_(0, P.a2f), K_(5, P.a3w, 'inBack'), K_(9, P.a3s1, 'outExpo'), K_(13, P.a3m, 'lin'), K_(17, P.a3s2, 'outExpo'), K_(34, P.ready, 'inOutSine')],
    hit: [[7, 10, { dmg: 86, kb: 40, stop: 3, shake: 1 }], [15, 18, { dmg: 104, kb: 90, stop: 5, shake: 2 }]], move: [[4, 9, 14], [13, 17, 14]], swing: 5, swing2: 13 },
  atk4: { len: 46, cancel: 30, next: null, keys: [K_(0, P.a3s2), K_(9, P.a4w, 'outCubic'), K_(13, P.a4s, 'inExpo'), K_(22, P.a4h, 'lin'), K_(46, P.ready, 'inOutSine')],
    hit: [[11, 15, { dmg: 320, kb: 260, stop: 10, shake: 7, heavy: true }]], move: [[6, 13, 30]], swing: 10, impact: 13 },
  lunge: { len: 34, cancel: 22, keys: [K_(0, P.charge), K_(3, P.lunge, 'outExpo'), K_(14, P.lunge, 'lin'), K_(20, P.lungeF, 'outCubic'), K_(34, P.ready, 'inOutSine')],
    hit: [[2, 13, { dmg: 460, kb: 300, stop: 8, shake: 6, heavy: true, pierce: true }]], move: [[1, 12, 150]], swing: 1 },
  airAtk: { len: 22, cancel: 14, keys: [K_(0, P.fall), K_(4, P.airW, 'inQuad'), K_(8, P.airS, 'outExpo'), K_(22, P.fall, 'inOutSine')],
    hit: [[5, 9, { dmg: 110, kb: 60, stop: 4, shake: 2 }]], swing: 4 },
  dodge: { len: 22, keys: [K_(0, P.ready), K_(3, P.dash, 'outCubic'), K_(15, P.dash, 'lin'), K_(22, P.ready, 'inOutSine')], iframes: [0, 14] },
  backstep: { len: 20, keys: [K_(0, P.ready), K_(3, P.hop, 'outCubic'), K_(13, P.hop, 'lin'), K_(20, P.ready, 'inOutSine')], iframes: [0, 12] },
  parry: { len: 28, keys: [K_(0, P.ready), K_(3, P.guard, 'outExpo'), K_(24, P.guard, 'lin'), K_(28, P.ready, 'inOutSine')], perfect: [0, 10] },
  deflect: { len: 22, cancel: 10, keys: [K_(0, P.guard), K_(4, P.deflect, 'outExpo'), K_(22, P.ready, 'inOutSine')] },
  flinch: { len: 18, keys: [K_(0, P.ready), K_(3, P.flinch, 'outExpo'), K_(18, P.ready, 'inOutSine')] },
  getup: { len: 34, keys: [K_(0, P.down), K_(14, P.kneel, 'outCubic'), K_(34, P.ready, 'inOutSine')] },
  skill: { len: 50, cancel: 38, keys: [K_(0, P.ready), K_(6, P.skW, 'inQuad'), K_(9, P.skD, 'outExpo'), K_(16, P.skD, 'lin'), K_(22, P.skE, 'outBack'), K_(50, P.ready, 'inOutSine')],
    hit: [[7, 16, { dmg: 150, kb: 30, stop: 3, shake: 3, pierce: true }]], move: [[7, 16, 170]], swing: 7 },
  burst: { len: 96, keys: [K_(0, P.ready), K_(18, P.buUp, 'outCubic'), K_(52, P.buUp, 'lin'), K_(58, P.buCut, 'inExpo'), K_(74, P.buCut, 'lin'), K_(96, P.ready, 'inOutSine')], iframes: [0, 80] },
  land: { len: 10, keys: [K_(0, P.land), K_(10, P.ready, 'outCubic')] },
  flourish: { len: 150, keys: [K_(0, P.idle), K_(22, P.flA, 'inOutCubic'), K_(60, P.flA, 'inOutSine'), K_(80, P.flB, 'inOutSine'), K_(118, P.flB, 'lin'), K_(150, P.idle, 'inOutCubic')] },
  toIdle: { len: 24, keys: [K_(0, P.ready), K_(24, P.idle, 'inOutCubic')] },
};

const _poseTmp = mkPose({});
function sampleKeys(keys, t, out) {
  if (t <= keys[0].t) return copyPose(out, keys[0].p);
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b.t) {
      const a = keys[i - 1];
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return lerpPose(out, a.p, b.p, (EASE[b.e] || EASE.inOutSine)(clamp(u, 0, 1)));
    }
  }
  return copyPose(out, keys[keys.length - 1].p);
}

// ---------------------------------------------------------------------------
// Locomotion: feet planted by distance travelled (no sliding), gait blended by
// speed, stairs handled by the rig's ground callback per foot.
// ---------------------------------------------------------------------------
const GAIT = {
  walk: { D: 104, stance: 0.6, lift: 6, kick: 2, bob: 1.4, lean: 0.05, yaw: 0.7, arm: 0.35 },
  run: { D: 172, stance: 0.36, lift: 13, kick: 12, bob: 3.0, lean: 0.24, yaw: 0.38, arm: 0.9 },
  sprint: { D: 212, stance: 0.3, lift: 16, kick: 17, bob: 3.4, lean: 0.36, yaw: 0.28, arm: 1.1 },
};
function gaitMix(speed) {
  const W = 110, R = 290, S = 430;
  if (speed <= W) return [GAIT.walk, GAIT.walk, 0];
  if (speed <= R) return [GAIT.walk, GAIT.run, smoothstep(W, R, speed)];
  return [GAIT.run, GAIT.sprint, smoothstep(R, S, speed)];
}
function locoPose(out, phase, speed, accel, time) {
  const [ga, gb, w] = gaitMix(speed);
  const g = {};
  for (const k of Object.keys(ga)) g[k] = lerp(ga[k], gb[k], w);
  const run = smoothstep(110, 290, speed);
  const Sd = g.stance * g.D; // stance travel
  const foot = (ph) => {
    const p = ((ph % 1) + 1) % 1;
    if (p < g.stance) {
      const s = p / g.stance;
      return [Sd / 2 - Sd * s + 4 * run, 0, 0.55 * smoothstep(0.62, 1, s) * (0.5 + run)];
    }
    const s = (p - g.stance) / (1 - g.stance);
    const x = -Sd / 2 + Sd * EASE.inOutSine(s) + 4 * run;
    const y = -(g.lift * Math.sin(Math.PI * s)) - g.kick * Math.max(0, Math.sin(Math.PI * Math.min(1, s * 1.6))) * (1 - s);
    const toe = lerp(0.7, -0.05, s) * (0.5 + 0.5 * run);
    return [x, y, toe];
  };
  const fF = foot(phase), fB = foot(phase + 0.5);
  // pelvis: walk rises at mid-stance, run dips at mid-stance
  const c2 = Math.cos(TAU * 2 * (phase - g.stance / 2));
  const bob = lerp(g.bob * c2, -g.bob * c2, run);
  const sw = Math.sin(TAU * phase);
  copyPose(out, POSE0);
  out.yaw = g.yaw;
  out.rx = lerp(0, 2, run);
  out.ry = -67.4 + lerp(0.6, 3.2, run) - bob;
  out.hp = 0.05 * sw * (1 - run * 0.5);
  out.sp = g.lean + clamp(accel * 0.00012, -0.12, 0.16) + 0.02 * Math.cos(TAU * 2 * phase);
  out.hd = -out.sp * 0.45 + 0.03 * c2;
  out.fx = fF[0]; out.fy = fF[1]; out.ft = fF[2];
  out.bx = fB[0]; out.by = fB[1]; out.bt = fB[2];
  // blade trails in the far hand; the near arm swings against the near leg
  out.gr = 2; out.bz = 0; out.g2 = 0; out.gp = 11;
  out.ba = lerp(1.95, 2.62, run) + 0.08 * sw * g.arm;
  out.br = lerp(0.97, 0.95, run);
  out.be = 1;
  out.bd = lerp(2.72, 3.05, run) + 0.05 * sw;
  out.fa = lerp(1.5, 1.55, run) - sw * g.arm * lerp(0.7, 1.1, run);
  out.fr = lerp(0.97, 0.78, run);
  out.fe = 1; out.hf = run > 0.5 ? 1 : 0;
  out.fc = run > 0.6 ? 1 : 0;
  return out;
}

// ---------------------------------------------------------------------------
// Animator: plays a move or procedural pose, cross-fading between them.
// ---------------------------------------------------------------------------
class Animator {
  constructor() {
    this.name = null; this.t = 0; this.anim = null;
    this.pose = mkPose({}); this.from = mkPose({}); this.blend = 0; this.blendLen = 0;
    this.tmp = mkPose({});
  }
  play(name, blendFrames = 4) {
    copyPose(this.from, this.pose);
    this.name = name; this.anim = ANIM[name] || null; this.t = 0;
    this.blend = blendFrames; this.blendLen = blendFrames;
  }
  // target: pose computed by caller for procedural states (locomotion, idle)
  update(dtFrames, target) {
    this.t += dtFrames;
    const src = this.anim ? sampleKeys(this.anim.keys, this.t, this.tmp) : target;
    if (this.blend > 0) {
      this.blend = Math.max(0, this.blend - dtFrames);
      const k = 1 - this.blend / Math.max(1, this.blendLen);
      lerpPose(this.pose, this.from, src, EASE.outQuad(k));
    } else copyPose(this.pose, src);
    return this.pose;
  }
  get done() { return this.anim ? this.t >= this.anim.len : false; }
}

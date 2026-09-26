'use strict';
// ---------------------------------------------------------------------------
// core: math, easing, input
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const sgn = (v) => (v < 0 ? -1 : 1);
const hypot = Math.hypot;
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; };
const approach = (v, target, rate) => (v < target ? Math.min(v + rate, target) : Math.max(v - rate, target));

// Easing set. Attack keys lean on outExpo/outQuart for the strike and
// inQuad/inBack for anticipation, the same shapes action games use.
const EASE = {
  lin: (t) => t,
  hold: () => 0,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBackSoft: (t) => { const c1 = 0.8, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: (t) => { const c1 = 1.4, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

// ---------------------------------------------------------------------------
// Input. Buffered presses so a button tapped a few frames early still counts,
// which is most of what makes action-game inputs feel responsive.
// ---------------------------------------------------------------------------
const Input = (() => {
  const held = new Set();
  const pressedAt = {}; // action -> frame index of last press
  const releasedAt = {};
  const downAt = {}; // action -> frame it went down (not consumed by buffers)
  let frame = 0;
  const BIND = {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    jump: ['Space', 'KeyW', 'ArrowUp'],
    attack: ['KeyJ', 'Mouse0'],
    dodge: ['ShiftLeft', 'ShiftRight', 'KeyL', 'Mouse2'],
    skill: ['KeyE', 'KeyU'],
    burst: ['KeyQ', 'KeyI'],
    parry: ['KeyF', 'KeyO'],
    walk: ['KeyC'],
  };
  const actionsFor = (code) => Object.keys(BIND).filter((a) => BIND[a].includes(code));
  const virt = new Set(); // actions held by touch / demo scripts

  function press(code) {
    if (held.has(code)) return;
    held.add(code);
    for (const a of actionsFor(code)) { if (!isDown(a, code)) downAt[a] = frame; pressedAt[a] = frame; }
  }
  function release(code) {
    if (!held.has(code)) return;
    held.delete(code);
    for (const a of actionsFor(code)) releasedAt[a] = frame;
  }
  function vpress(a) { if (!virt.has(a)) { if (!isDown(a)) downAt[a] = frame; virt.add(a); pressedAt[a] = frame; } }
  function vrelease(a) { if (virt.has(a)) { virt.delete(a); releasedAt[a] = frame; } }
  function isDown(a, except) {
    if (virt.has(a)) return true;
    for (const c of BIND[a]) if (c !== except && held.has(c)) return true;
    return false;
  }
  // true if pressed within the last `buf` frames and not yet consumed
  function pressed(a, buf = 8) {
    const f = pressedAt[a];
    return f !== undefined && frame - f <= buf;
  }
  function consume(a) { pressedAt[a] = undefined; }
  function heldFrames(a) {
    if (!isDown(a)) return 0;
    const f = downAt[a];
    return f === undefined ? 0 : frame - f;
  }
  function releasedRecently(a, buf = 1) { const f = releasedAt[a]; return f !== undefined && frame - f <= buf; }
  function tick() { frame++; }
  function clearAll() { held.clear(); virt.clear(); }
  return { press, release, vpress, vrelease, isDown, pressed, consume, heldFrames, releasedRecently, tick, clearAll, get frame() { return frame; }, BIND };
})();

// ---------------------------------------------------------------------------
// World: test range with stairs, one-way platforms, sentinel turrets and a
// slow, vast background (layered peaks, drifting mist, falling ash).
// ---------------------------------------------------------------------------
const WORLD = { w: 2640, h: 540, floor: 472 };
const STAIRS = [
  { x0: 900, n: 8, rise: 12, run: 20, up: true },
  { x0: 1400, n: 8, rise: 12, run: 20, up: false },
];
const MESA = { x0: 1060, x1: 1400, y: WORLD.floor - 96 };
const PLATFORMS = [
  { x0: 250, x1: 420, y: 372 },
  { x0: 470, x1: 640, y: 300 },
  { x0: 1810, x1: 1990, y: 384 },
  { x0: 2090, x1: 2280, y: 318 },
];

// true top surface (steps are steps)
function groundTop(x) {
  const F = WORLD.floor;
  for (const s of STAIRS) {
    const x1 = s.x0 + s.n * s.run;
    if (x >= s.x0 && x < x1) {
      const i = Math.floor((x - s.x0) / s.run);
      return s.up ? F - (i + 1) * s.rise : MESA.y + (i + 1) * s.rise;
    }
  }
  if (x >= MESA.x0 && x < MESA.x1) return MESA.y;
  return F;
}
// smoothed surface the body rides on (box filter of the steps)
function groundSmooth(x) {
  let s = 0;
  for (let k = -2; k <= 2; k++) s += groundTop(x + k * 6);
  return s / 5;
}
function platformAt(x, yPrev, yNext) {
  // one-way: only land when crossing the top from above
  for (const p of PLATFORMS) if (x >= p.x0 && x <= p.x1 && yPrev <= p.y + 0.5 && yNext >= p.y) return p;
  return null;
}
function onPlatform(x, y) {
  for (const p of PLATFORMS) if (x >= p.x0 && x <= p.x1 && Math.abs(y - p.y) < 1.5) return p;
  return null;
}

// ---------------------------------------------------------------------------
// Background: generated once into canvases, scrolled by parallax.
// ---------------------------------------------------------------------------
const BG = {
  sky: ['#bfbecb', '#c6c5d1', '#cccbd6', '#d2d1db', '#d8d7e0', '#dddce4', '#e2e1e8'],
  layers: [],
  init(vw, vh) {
    this.vw = vw; this.vh = vh;
    this.layers = [];
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    let rs = 7;
    const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
    const ridge = (W, amp, rough, minStep) => {
      const N = 1 << Math.ceil(Math.log2(W + 1));
      const h = new Float32Array(N + 1);
      h[0] = rnd(); h[N] = rnd();
      for (let step = N; step > minStep; step >>= 1) {
        const a = Math.pow(rough, Math.log2(N / step));
        for (let i = step >> 1; i < N; i += step) h[i] = (h[i - (step >> 1)] + h[i + (step >> 1)]) / 2 + (rnd() - 0.5) * a;
      }
      // fill the gaps below minStep linearly (smooth, large shapes)
      for (let step = minStep; step > 1; step >>= 1) for (let i = step >> 1; i < N; i += step) h[i] = (h[i - (step >> 1)] + h[i + (step >> 1)]) / 2;
      let lo = 1e9, hi = -1e9; for (let i = 0; i <= N; i++) { lo = Math.min(lo, h[i]); hi = Math.max(hi, h[i]); }
      for (let i = 0; i <= N; i++) h[i] = ((h[i] - lo) / (hi - lo || 1)) * amp;
      return h;
    };
    // three ranges, far to near: pale and vast, then closer and colder
    const specs = [
      { par: 0.06, base: 380, amp: 250, rough: 0.52, min: 16, col: '#c3c2ce', lit: '#cfced9', snow: '#e8e7ef', shade: '#b9b8c6', spire: true },
      { par: 0.16, base: 410, amp: 170, rough: 0.55, min: 8, col: '#afaebd', lit: '#bebdca', snow: '#dddce6', shade: '#a3a2b3', arches: true },
      { par: 0.32, base: 450, amp: 110, rough: 0.58, min: 4, col: '#9896aa', lit: '#a8a6b8', snow: '#cfcedb', shade: '#8c8a9f' },
    ];
    for (const sp of specs) {
      const W = Math.ceil(vw + (WORLD.w - vw) * sp.par) + 8, H = 540;
      const c = mk(W, H), cx = c.getContext('2d');
      const img = cx.createImageData(W, H), u = new Uint32Array(img.data.buffer);
      const h = ridge(W, sp.amp, sp.rough, sp.min);
      const C = { col: hex32(sp.col), lit: hex32(sp.lit), snow: hex32(sp.snow), shade: hex32(sp.shade) };
      // flat range colour, a lit ridge line, snowcaps on the high peaks,
      // and mist gathering at the foot of each range (dithered)
      for (let x = 0; x < W; x++) {
        const top = Math.round(sp.base - h[x]);
        const high = h[x] > sp.amp * 0.62;
        const rightFalling = h[Math.min(W, x + 3)] < h[x];
        for (let y = Math.max(0, top); y < H; y++) {
          const d = y - top;
          let v = C.col;
          if (d === 0) v = high ? C.snow : C.lit;
          else if (d === 1 && rightFalling) v = C.lit;
          else if (high && d < 3 + (h[x] - sp.amp * 0.62) * 0.08) v = rightFalling ? C.snow : C.lit;
          const fogStart = sp.base - 20;
          if (y > fogStart) { const k = (y - fogStart) / 60; if (k > 1 || ((x * 7 + y * 3) % 5) / 5 < k) v = C.lit; }
          u[y * W + x] = v;
        }
      }
      cx.putImageData(img, 0, 0);
      if (sp.spire) {
        // a needle tower on a far peak, and a ring hanging beside it that should not be able to hang there
        let px = 0, best = 1e9;
        for (let x = Math.floor(W * 0.55); x < W * 0.75; x++) { const t = sp.base - h[x]; if (t < best) { best = t; px = x; } }
        cx.fillStyle = sp.lit;
        cx.fillRect(px - 1, best - 150, 3, 150); cx.fillRect(px - 3, best - 110, 7, 3); cx.fillRect(px - 2, best - 156, 5, 7);
        cx.fillStyle = sp.snow; cx.fillRect(px - 1, best - 150, 1, 150);
        cx.strokeStyle = sp.lit; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(px + 46, best - 118, 26, 7, -0.25, 0, TAU); cx.stroke();
      }
      if (sp.arches) {
        // an aqueduct far too large for the valley, broken in the middle
        const ax0 = Math.round(W * 0.34), top = sp.base - 96;
        for (let i = 0; i < 8; i++) {
          if (i === 5) continue;
          const ax = ax0 + i * 22;
          cx.fillStyle = sp.shade; cx.fillRect(ax, top, 4, 96);
          if (i < 7 && i !== 4) cx.fillRect(ax, top, 22, 3);
        }
      }
      this.layers.push({ c, par: sp.par });
    }
    // soft cloud banks (dithered), drawn once
    const cw = 1400, cc = mk(cw, 120), cctx = cc.getContext('2d');
    const blob = (x, y, rx, ry, col) => { cctx.fillStyle = col; cctx.beginPath(); cctx.ellipse(x, y, rx, ry, 0, 0, TAU); cctx.fill(); };
    for (let i = 0; i < 9; i++) {
      const x = rnd() * cw, y = 40 + rnd() * 50, w = 80 + rnd() * 160;
      for (let k = 0; k < 5; k++) blob(x + (k - 2) * w * 0.28, y - Math.sin((k / 4) * Math.PI) * 10, w * 0.3, 9 + rnd() * 6, 'rgba(236,235,241,0.55)');
      blob(x, y + 4, w * 0.7, 6, 'rgba(236,235,241,0.45)');
    }
    this.clouds = cc;
  },
  draw(ctx, camX, camY, t) {
    const { vw, vh } = this;
    const bands = this.sky.length;
    for (let i = 0; i < bands; i++) { ctx.fillStyle = this.sky[i]; ctx.fillRect(0, Math.floor((i * vh) / bands), vw, Math.ceil(vh / bands) + 1); }
    // clouds drift on their own, very slowly
    const cw = this.clouds.width;
    const off = -((t * 4 + camX * 0.02) % cw);
    for (let k = -1; k < Math.ceil(vw / cw) + 1; k++) ctx.drawImage(this.clouds, Math.round(off + k * cw), Math.round(18 - camY * 0.03));
    const yoff = Math.round(vh - 540 - camY * 0.08);
    for (const L of this.layers) ctx.drawImage(L.c, Math.round(-camX * L.par), yoff);
    // valley mist: soft bands between the ranges
    for (let i = 0; i < 3; i++) {
      const y = Math.round(vh - 190 + i * 30 - camY * (0.1 + i * 0.05));
      const g = ctx.createLinearGradient(0, y - 14, 0, y + 14);
      g.addColorStop(0, 'rgba(232,231,238,0)'); g.addColorStop(0.5, `rgba(232,231,238,${0.5 - i * 0.1})`); g.addColorStop(1, 'rgba(232,231,238,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y - 14, vw, 28);
    }
  },
};
function hex32(h) { const [r, g, b] = hexRGB(h); return (255 << 24) | (b << 16) | (g << 8) | r; }

// geometry drawing (stone, clean pixel edges)
function drawWorld(ctx, camX, camY, vw, vh) {
  const X = (x) => Math.round(x - camX), Y = (y) => Math.round(y - camY);
  const stone = '#5d5b6b', stoneD = '#4a4857', stoneL = '#77758a', edge = '#8e8ca0', ink = '#2a2933';
  const block = (x0, y0, x1, y1) => {
    ctx.fillStyle = ink; ctx.fillRect(X(x0) - 1, Y(y0) - 1, x1 - x0 + 2, y1 - y0 + 2);
    ctx.fillStyle = stone; ctx.fillRect(X(x0), Y(y0), x1 - x0, y1 - y0);
    ctx.fillStyle = edge; ctx.fillRect(X(x0), Y(y0), x1 - x0, 2);
    ctx.fillStyle = stoneL; ctx.fillRect(X(x0), Y(y0) + 2, x1 - x0, 1);
  };
  // floor and brick courses
  const F = WORLD.floor;
  block(-40, F, WORLD.w + 40, WORLD.h + 60);
  ctx.fillStyle = stoneD;
  for (let y = F + 14; y < WORLD.h + 40; y += 14) {
    ctx.fillRect(X(-40), Y(y), WORLD.w + 80, 1);
    const shift = ((y - F) / 14) % 2 ? 24 : 0;
    for (let x = -40 + shift; x < WORLD.w + 40; x += 48) ctx.fillRect(X(x), Y(y - 13), 1, 13);
  }
  // mesa + stairs
  block(MESA.x0, MESA.y, MESA.x1, F);
  for (const s of STAIRS) for (let i = 0; i < s.n; i++) {
    const x = s.x0 + i * s.run;
    const top = s.up ? F - (i + 1) * s.rise : MESA.y + (i + 1) * s.rise;
    block(x, top, x + s.run, F);
  }
  ctx.fillStyle = stoneD;
  for (let y = MESA.y + 16; y < F; y += 16) ctx.fillRect(X(MESA.x0 + 4), Y(y), MESA.x1 - MESA.x0 - 8, 1);
  // one-way platforms: thin slabs with chains up into the dark
  for (const p of PLATFORMS) {
    block(p.x0, p.y, p.x1, p.y + 9);
    ctx.fillStyle = stoneD; ctx.fillRect(X(p.x0 + 4), Y(p.y + 9), p.x1 - p.x0 - 8, 3);
    ctx.fillStyle = '#6d6b7c';
    for (const cx of [p.x0 + 14, p.x1 - 14]) for (let y = p.y - 1; y > p.y - 400 && y > camY - 10; y -= 6) ctx.fillRect(X(cx), Y(y - 4), 2, 4);
  }
  // walls
  block(-60, -200, 20, F); block(WORLD.w - 20, -200, WORLD.w + 60, F);
}

// ---------------------------------------------------------------------------
// Sentinel: a floating ring with a cold eye. Telegraphs, then fires.
// ---------------------------------------------------------------------------
const PATTERNS = ['aimed', 'burst', 'spread', 'orb'];
class Sentinel {
  constructor(x, y, phase) {
    this.x = x; this.baseY = y; this.y = y - 40; this.phase = phase || 0;
    this.maxHp = 2400; this.hp = this.maxHp; this.dead = 0; this.flash = 0; this.stagger = 0; this.shakeT = 0;
    this.cool = 1.6 + (phase || 0); this.charge = 0; this.aim = Math.PI; this.shots = 0; this.pat = 0;
    this.r = 15;
  }
  get cx() { return this.x; }
  get cy() { return this.y; }
  update(dt, game) {
    const pl = game.player;
    this.phase += dt;
    this.y = this.baseY - 40 + Math.sin(this.phase * 1.6) * 3;
    if (this.flash > 0) this.flash -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) { this.hp = this.maxHp; game.fx.ring(this.x, this.y, 30, [120, 230, 255], 0.5); }
      return;
    }
    const tx = pl.x, ty = pl.y - 70;
    const want = Math.atan2(ty - this.y, tx - this.x);
    this.aim = angLerp(this.aim, want, Math.min(1, dt * 5));
    if (game.opts.turret === 'off') { this.charge = 0; return; }
    if (this.stagger > 0) { this.stagger -= dt; this.charge = Math.max(0, this.charge - dt * 2); return; }
    const mode = game.opts.turret === 'cycle' ? PATTERNS[this.pat % PATTERNS.length] : game.opts.turret;
    if (this.shots > 0) {
      this.cool -= dt;
      if (this.cool <= 0) { this.fire(game, mode, true); this.shots--; this.cool = 0.12; if (!this.shots) { this.cool = 1.5; this.pat++; } }
      return;
    }
    this.cool -= dt;
    if (this.cool < 0.5) this.charge = Math.min(1, this.charge + dt * 2);
    if (this.cool <= 0) {
      this.charge = 0;
      if (mode === 'burst') { this.shots = 3; this.cool = 0; }
      else { this.fire(game, mode, false); this.cool = mode === 'orb' ? 2.4 : mode === 'spread' ? 1.9 : 1.2; this.pat++; }
    }
  }
  fire(game, mode, burst) {
    const a = this.aim, sx = this.x + Math.cos(a) * 16, sy = this.y + Math.sin(a) * 16;
    const shot = (ang, sp, r, dmg, kind) => game.bullets.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r, dmg, kind, owner: 'enemy', life: 5, trail: [], id: game.bid++ });
    if (mode === 'spread') for (let i = -2; i <= 2; i++) shot(a + i * 0.16, 250, 4, 90, 'shot');
    else if (mode === 'orb') shot(a, 170, 9, 240, 'orb');
    else shot(a, burst ? 330 : 290, 4, 100, 'shot');
    game.fx.muzzle(sx, sy, a);
    AUDIO.play('fire');
  }
  hit(dmg, game) {
    if (this.dead > 0) return false;
    this.hp -= dmg; this.flash = 0.09; this.shakeT = 0.15; this.stagger = Math.max(this.stagger, 0.25);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = 2.6; this.shots = 0;
      game.fx.explode(this.x, this.y);
      game.shake(8, 0.35);
      AUDIO.play('boom');
    }
    return true;
  }
  draw(ctx, camX, camY, game) {
    const X = Math.round(this.x - camX), Y = Math.round(this.y - camY);
    const B = Math.round(this.baseY - camY);
    // pedestal
    ctx.fillStyle = '#2a2933'; ctx.fillRect(X - 13, B - 13, 26, 13);
    ctx.fillStyle = '#6a6879'; ctx.fillRect(X - 12, B - 12, 24, 11);
    ctx.fillStyle = '#8d8b9f'; ctx.fillRect(X - 12, B - 12, 24, 2);
    if (this.dead > 0) {
      ctx.fillStyle = '#3a3945'; ctx.fillRect(X - 6, B - 18, 12, 5);
      return;
    }
    const sx = this.shakeT > 0 ? Math.round(rand(-2, 2)) : 0;
    const flash = this.flash > 0;
    // ring (stone), eye (cold light)
    const ringC = flash ? '#ffffff' : '#7d7b90', ringD = flash ? '#ffffff' : '#4b4a59';
    ctx.fillStyle = '#2a2933';
    ctx.beginPath(); ctx.ellipse(X + sx, Y, 16, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = ringD; ctx.beginPath(); ctx.ellipse(X + sx, Y, 15, 15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = ringC; ctx.beginPath(); ctx.ellipse(X + sx, Y - 1, 14, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1a22'; ctx.beginPath(); ctx.ellipse(X + sx, Y, 9, 9, 0, 0, TAU); ctx.fill();
    const ex = X + sx + Math.round(Math.cos(this.aim) * 3), ey = Y + Math.round(Math.sin(this.aim) * 3);
    const glow = 0.5 + this.charge * 0.5;
    ctx.fillStyle = `rgba(120,230,255,${0.25 * glow})`; ctx.beginPath(); ctx.arc(ex, ey, 7 + this.charge * 4, 0, TAU); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#7fe6ff'; ctx.fillRect(ex - 3, ey - 3, 6, 6);
    ctx.fillStyle = '#e8fbff'; ctx.fillRect(ex - 1, ey - 2, 2, 2);
    // hp pip bar
    if (this.hp < this.maxHp) {
      const w = 30, f = this.hp / this.maxHp;
      ctx.fillStyle = '#1b1a22'; ctx.fillRect(X - w / 2 - 1, Y - 28, w + 2, 4);
      ctx.fillStyle = '#7fe6ff'; ctx.fillRect(X - w / 2, Y - 27, Math.round(w * f), 2);
    }
    // telegraph: thin aim line while charging
    if (this.charge > 0.05) {
      ctx.strokeStyle = `rgba(127,230,255,${0.15 + this.charge * 0.45})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex + 0.5, ey + 0.5); ctx.lineTo(ex + Math.cos(this.aim) * 420, ey + Math.sin(this.aim) * 420); ctx.stroke();
    }
  }
}

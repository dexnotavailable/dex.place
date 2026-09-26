// ---------------------------------------------------------------------------
// Game: loop, camera, render pipeline, HUD, lab panel, demos, touch.
// ---------------------------------------------------------------------------
const VIEWS = { close: [640, 360], wide: [960, 540] };

class Game {
  constructor() {
    this.opts = { turret: 'aimed', training: true, walk: false, boxes: false, rim: true, view: 'close', timeScale: 1, paused: false, stepOnce: false };
    this.screen = document.getElementById('screen');
    this.sctx = this.screen.getContext('2d');
    this.buf = new PixBuf(540, 420);
    this.fx = new FX();
    this.time = 0; this.hitstop = 0;
    this.bullets = []; this.bid = 1;
    this.sentinels = [new Sentinel(1250, MESA.y, 0), new Sentinel(2190, 318, 0.8)];
    this.player = new Player(this);
    this.time = 0; this.hitstop = 0; this.slowT = 0; this.shakeA = 0; this.shakeT = 0; this.burst = null;
    this.camX = 0; this.camY = 0; this.acc = 0; this.last = performance.now();
    this.timers = []; this.demo = null; this.ash = [];
    this.setView(this.opts.view);
    for (let i = 0; i < 40; i++) this.ash.push({ x: rand(0, 1), y: rand(0, 1), s: rand(0.3, 1), ph: rand(0, TAU) });
    requestAnimationFrame((t) => this.frame(t));
  }
  setView(v) {
    this.opts.view = v;
    [this.vw, this.vh] = VIEWS[v];
    this.view = document.createElement('canvas'); this.view.width = this.vw; this.view.height = this.vh;
    this.vctx = this.view.getContext('2d'); this.vctx.imageSmoothingEnabled = false;
    this.world = document.createElement('canvas'); this.world.width = this.vw; this.world.height = this.vh;
    this.wctx = this.world.getContext('2d'); this.wctx.imageSmoothingEnabled = false;
    BG.init(this.vw, this.vh);
    this.resize();
  }
  resize() {
    const wrap = this.screen.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    // integer scale when it is at least 2x; otherwise fit (slightly uneven pixels beat a tiny view)
    let s = Math.floor(Math.min(W / this.vw, H / this.vh));
    if (s < 2) s = Math.min(W / this.vw, H / this.vh);
    const dpr = window.devicePixelRatio || 1;
    this.screen.style.width = Math.floor(this.vw * s) + 'px';
    this.screen.style.height = Math.floor(this.vh * s) + 'px';
    this.screen.width = Math.floor(this.vw * s * dpr); this.screen.height = Math.floor(this.vh * s * dpr);
    this.sctx.imageSmoothingEnabled = false;
  }
  shake(a, t) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
  later(delay, fn) { this.timers.push({ t: delay, fn }); }
  onScreen(x, y) { return x > this.camX - 20 && x < this.camX + this.vw + 20 && y > this.camY - 40 && y < this.camY + this.vh + 40; }
  damage(s, dmg, x, y, heavy, info) {
    const crit = Math.random() < 0.22;
    const v = Math.round(dmg * (crit ? 1.9 : 1) * rand(0.95, 1.05));
    if (!s.hit(v, this)) return;
    this.fx.num(x, y - 18, v, crit);
    this.fx.impact(x, y, rand(0, TAU), heavy || crit);
    AUDIO.play(heavy || crit ? 'hitHeavy' : 'hit');
  }
  spawnAfterimage(col, life, alpha) {
    const pl = this.player, b = this.buf;
    if (b.maxX < 0) return;
    const sil = b.silhouette(col, 255);
    const w = sil.cv.width;
    const x = pl.dir > 0 ? pl.x - 270 + sil.ox : pl.x - (sil.ox + w - 270);
    this.fx.afterimage({ cv: sil.cv, w }, x, pl.y - 330 + sil.oy, pl.dir, col, life, alpha);
  }
  // ---------------------------------------------------------------- loop
  frame(now) {
    const real = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.opts.paused || this.opts.stepOnce) {
      this.acc += this.opts.stepOnce ? 1 / 60 : real * this.opts.timeScale;
      this.opts.stepOnce = false;
      let n = 0;
      while (this.acc >= 1 / 60 && n < 6) { this.step(1 / 60); this.acc -= 1 / 60; n++; }
    }
    this.render(real);
    requestAnimationFrame((t) => this.frame(t));
  }
  step(dt) {
    this.runDemo();
    Input.tick();
    this.time += dt;
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
    if (this.hitstop > 0) { this.hitstop--; this.fx.update(dt * 0.15); return; }
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    let wscale = 1;
    if (this.slowT > 0) { this.slowT -= dt; wscale = 0.22; }
    if (this.burst && this.burst.t > 16 && this.burst.t < 60) wscale = 0;
    this.player.update(dt);
    const wdt = dt * wscale;
    for (const s of this.sentinels) s.update(wdt, this);
    this.updateBullets(wdt);
    this.fx.update(dt * (wscale < 1 ? 0.6 : 1));
    // camera
    const pl = this.player;
    const tx = clamp(pl.x - this.vw / 2 + pl.dir * 70, 0, WORLD.w - this.vw);
    const ty = clamp(pl.y - this.vh * 0.68, 0, Math.max(0, WORLD.h - this.vh));
    this.camX += (tx - this.camX) * Math.min(1, dt * 5);
    this.camY += (ty - this.camY) * Math.min(1, dt * 3.5);
  }
  updateBullets(dt) {
    const pl = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.shift();
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const kill = () => this.bullets.splice(i, 1);
      if (b.life <= 0 || b.x < 20 || b.x > WORLD.w - 20 || b.y < -40) { kill(); continue; }
      if (b.y > groundTop(b.x) - 1 || PLATFORMS.some((p) => b.x > p.x0 && b.x < p.x1 && b.y > p.y && b.y < p.y + 9)) {
        this.fx.sparks(b.x, b.y, -Math.PI / 2, 5, b.owner === 'enemy' ? [160, 240, 255] : [255, 90, 110], 160, 1);
        kill(); continue;
      }
      if (b.owner === 'player') {
        for (const s of this.sentinels) if (s.dead <= 0 && Math.hypot(s.x - b.x, s.y - b.y) < s.r + b.r) {
          this.damage(s, b.dmg, b.x, b.y, true); this.hitstop = Math.max(this.hitstop, 5); this.shake(4, 0.2); kill(); break;
        }
        continue;
      }
      if (!pl.checkBullet(b)) continue;
      // parry: the first 10 frames of guard deflect; later frames block
      if (pl.state === 'parry') {
        if (pl.st <= ANIM.parry.perfect[1]) this.deflect(b); else this.block(b);
        kill(); continue;
      }
      if (pl.iframes > 0) {
        if (pl.state === 'dodge' && !pl.dodgeFlag) this.perfectDodge();
        continue;
      }
      pl.hurt(b.dmg, b); kill();
    }
  }
  deflect(b) {
    const pl = this.player, fx = this.fx;
    // send it back at whoever fired it, faster and heavier
    let tgt = null, best = 1e9;
    for (const s of this.sentinels) { const d = Math.hypot(s.x - b.x, s.y - b.y); if (s.dead <= 0 && d < best) { best = d; tgt = s; } }
    const a = tgt ? Math.atan2(tgt.y - b.y, tgt.x - b.x) : Math.atan2(-b.vy, -b.vx);
    const sp = Math.hypot(b.vx, b.vy) * 1.9;
    this.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r + 1, dmg: b.dmg * 4, kind: b.kind, owner: 'player', life: 3, trail: [], id: this.bid++ });
    pl.anim.play('deflect', 1); pl.state = 'attack'; pl.st = 0; pl.hitIndex = -1;
    pl.energy = Math.min(100, pl.energy + 20);
    this.hitstop = 10; this.shake(5, 0.25);
    fx.flash(0.35, '#fff4d6'); fx.impact(b.x, b.y, a, true); fx.ring(b.x, b.y, 10, [255, 230, 170], 0.3);
    fx.word(pl.x, pl.y - 150, 'PARRY', '#ffe6a8');
    AUDIO.play('clang');
  }
  block(b) {
    const pl = this.player;
    pl.x -= pl.dir * 6;
    this.fx.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx), 8, [255, 255, 255], 200, 0.7);
    this.fx.word(pl.x, pl.y - 150, 'BLOCK', '#d9d7e4');
    this.hitstop = 3;
    AUDIO.play('clang');
  }
  perfectDodge() {
    const pl = this.player;
    pl.dodgeFlag = true; pl.perfectT = 1.3; this.slowT = 1.3;
    this.fx.flash(0.2, '#ffffff');
    this.fx.word(pl.x, pl.y - 150, 'PERFECT', '#ff9aa6');
    this.spawnAfterimage([255, 255, 255], 0.5, 0.7);
    AUDIO.play('slow');
  }
  // ---------------------------------------------------------------- render
  render(real) {
    const c = this.vctx, w = this.wctx, pl = this.player;
    let sx = 0, sy = 0;
    if (this.shakeA > 0) { sx = Math.round(rand(-1, 1) * this.shakeA); sy = Math.round(rand(-1, 1) * this.shakeA * 0.7); }
    const cx = Math.round(this.camX) + sx, cy = Math.round(this.camY) + sy;
    // world layer
    BG.draw(w, cx, cy, this.time);
    drawWorld(w, cx, cy, this.vw, this.vh);
    for (const s of this.sentinels) s.draw(w, cx, cy, this);
    // soft glows from lights onto the world
    w.save(); w.globalCompositeOperation = 'lighter';
    for (const L of this.fx.collectLights(this)) {
      if (L.i <= 0.05) continue;
      const g = w.createRadialGradient(L.x - cx, L.y - cy, 0, L.x - cx, L.y - cy, L.r * 0.8);
      g.addColorStop(0, `rgba(${L.c[0]},${L.c[1]},${L.c[2]},${0.18 * Math.min(1, L.i)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      w.fillStyle = g; w.fillRect(L.x - cx - L.r, L.y - cy - L.r, L.r * 2, L.r * 2);
    }
    w.restore();
    c.drawImage(this.world, 0, 0);
    // witch time / burst: desaturate the world, keep her in colour
    if (this.slowT > 0 || this.burst) {
      const k = this.burst ? smoothstep(10, 22, this.burst.t) * (1 - smoothstep(56, 70, this.burst.t)) : Math.min(1, this.slowT * 3);
      c.save();
      c.globalCompositeOperation = 'saturation'; c.globalAlpha = 0.85 * k; c.fillStyle = '#808080'; c.fillRect(0, 0, this.vw, this.vh);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = (this.burst ? 0.62 : 0.18) * k; c.fillStyle = this.burst ? '#07060b' : '#20283a'; c.fillRect(0, 0, this.vw, this.vh);
      c.restore();
    }
    this.fx.drawBack(c, cx, cy);
    // heroine
    const b = this.buf;
    b.reset();
    drawHeroine(b, pl.J, pl.hero, 270, 330, Math.round(pl.x), Math.round(pl.y), pl.dir, { time: this.time });
    const lights = [];
    if (this.opts.rim) for (const L of this.fx.lights) lights.push({ x: (L.x - pl.x) * pl.dir + 270, y: L.y - pl.y + 330, r: L.r, i: L.i, c: L.c });
    if (this.burst && this.burst.t > 14 && this.burst.t < 60) lights.push({ x: 270 + (pl.J.hx || 0) - 12, y: 330 + (pl.J.hy || -100) - 30, r: 160, i: 1.3, c: [255, 60, 80] });
    const blink = pl.iframes > 0 && pl.state === 'move' && Math.floor(this.time * 20) % 2;
    b.finish(lights, { flash: pl.hurtFlash > 0 ? 0.85 : blink ? 0.25 : 0, flashColor: pl.hurtFlash > 0 ? [255, 255, 255] : [255, 180, 190] });
    const px = Math.round(pl.x) - cx, py = Math.round(pl.y) - cy;
    if (pl.dir > 0) c.drawImage(b.canvas, px - 270, py - 330);
    else { c.save(); c.translate(px + 270, py - 330); c.scale(-1, 1); c.drawImage(b.canvas, 0, 0); c.restore(); }
    this.fx.drawBullets(c, cx, cy, this.bullets);
    this.fx.drawFront(c, cx, cy, this.time);
    // foreground ash drifting slowly across the vastness
    c.fillStyle = 'rgba(240,238,246,0.8)';
    for (const a of this.ash) {
      const x = ((a.x * this.vw + this.time * 12 * a.s - cx * 0.15 * a.s) % this.vw + this.vw) % this.vw;
      const y = ((a.y * this.vh + this.time * 18 * a.s + Math.sin(this.time + a.ph) * 6) % this.vh + this.vh) % this.vh;
      c.fillRect(Math.round(x), Math.round(y), a.s > 0.8 ? 2 : 1, 1);
    }
    if (this.opts.boxes) this.drawBoxes(c, cx, cy);
    this.drawHUD(c);
    this.fx.drawScreen(c, this.vw, this.vh);
    // present
    this.sctx.imageSmoothingEnabled = false;
    this.sctx.drawImage(this.view, 0, 0, this.screen.width, this.screen.height);
  }
  drawBoxes(c, cx, cy) {
    const pl = this.player;
    const [x0, y0, x1, y1, r] = pl.hurtbox();
    c.strokeStyle = pl.iframes > 0 ? '#7fe6ff' : '#40ff90'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0 - cx, y0 - cy); c.lineTo(x1 - cx, y1 - cy); c.stroke();
    c.strokeRect(x0 - r - cx, y1 - r - cy, r * 2, y0 - y1 + r * 2);
    const bw = pl.bladeWorld();
    c.strokeStyle = '#ffe24a'; c.beginPath(); c.moveTo(bw.base[0] - cx, bw.base[1] - cy); c.lineTo(bw.tip[0] - cx, bw.tip[1] - cy); c.stroke();
    for (const s of this.sentinels) { c.strokeStyle = '#ff5a5a'; c.beginPath(); c.arc(s.x - cx, s.y - cy, s.r, 0, TAU); c.stroke(); }
  }
  drawHUD(c) {
    const pl = this.player;
    const x = 12, y = 12;
    // HP
    c.fillStyle = '#16131b'; c.fillRect(x - 1, y - 1, 124, 8);
    c.fillStyle = '#3a2a33'; c.fillRect(x, y, 122, 6);
    const hpW = Math.round(122 * clamp(pl.hp / pl.maxHp, 0, 1));
    const low = pl.low && Math.floor(this.time * 4) % 2;
    c.fillStyle = low ? '#ff95a0' : '#d0132e'; c.fillRect(x, y, hpW, 6);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, y, hpW, 1);
    // energy (Halo) and skill (Red Line)
    const ready = pl.energy >= 100;
    c.fillStyle = '#16131b'; c.fillRect(x - 1, y + 9, 84, 5);
    c.fillStyle = ready ? (Math.floor(this.time * 6) % 2 ? '#ffe6e9' : '#ff4150') : '#8a0b25'; c.fillRect(x, y + 10, Math.round(82 * pl.energy / 100), 3);
    const cd = clamp(pl.skillCd / 3, 0, 1);
    c.fillStyle = '#16131b'; c.fillRect(x + 90, y + 9, 34, 5);
    c.fillStyle = cd > 0 ? '#5a3a44' : '#ff9aa6'; c.fillRect(x + 91, y + 10, Math.round(32 * (1 - cd)), 3);
    c.font = '8px "Silkscreen", monospace'; c.fillStyle = '#f2f0f6';
    c.fillText('HALO', x, y + 24); c.fillText('RED LINE', x + 90, y + 24);
    if (this.slowT > 0) { c.fillStyle = '#ff9aa6'; c.fillText('WITCH TIME', x, y + 36); }
    if (pl.perfectT > 0) { c.fillStyle = '#ffffff'; c.fillText('ATTACK: COUNTER', x, y + 46); }
    if (this.opts.paused) { c.fillStyle = '#ffffff'; c.fillText('PAUSED', this.vw - 60, y + 8); }
  }
  // ---------------------------------------------------------------- demos
  playDemo(name) {
    const S = {
      combo: [[0, 'attack', 3], [16, 'attack', 3], [32, 'attack', 3], [56, 'attack', 3]],
      charge: [[0, 'attack', 70]],
      air: [[0, 'jump', 10], [16, 'attack', 3], [34, 'attack', 3], [58, 'down', 30], [60, 'attack', 3]],
      skill: [[0, 'skill', 3]],
      burst: [[0, 'burst', 3]],
      dodge: [[0, 'right', 40], [4, 'dodge', 3], [30, 'dodge', 3]],
      parry: [[0, 'parry', 3]],
      run: [[0, 'right', 140], [150, 'left', 140]],
      walk: [[0, 'walk', 200], [0, 'right', 200]],
      flourish: [],
    }[name];
    if (name === 'flourish') { this.player.idleT = 20; return; }
    if (name === 'hurt') { this.player.hurt(90, { vx: -200, vy: 0 }); return; }
    if (name === 'knock') { this.player.hurt(260, { vx: -200, vy: 0 }); return; }
    this.demo = { t: 0, script: S.map(([t, a, d]) => ({ t, a, d, on: false, off: false })) };
  }
  runDemo() {
    const d = this.demo;
    if (!d) return;
    for (const e of d.script) {
      if (!e.on && d.t >= e.t) { e.on = true; Input.vpress(e.a); }
      if (e.on && !e.off && d.t >= e.t + e.d) { e.off = true; Input.vrelease(e.a); }
    }
    d.t++;
    if (d.script.every((e) => e.off)) this.demo = null;
  }
}

// ---------------------------------------------------------------- boot
function boot() {
  const game = new Game();
  window.__game = game;
  const hint = document.getElementById('hint');
  const hideHint = () => { if (hint) hint.hidden = true; };
  const onKey = (e, down) => {
    const code = e.code;
    hideHint();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
    if (down && !e.repeat) {
      AUDIO.unlock();
      if (code === 'KeyP') { game.opts.paused = !game.opts.paused; syncUI(); return; }
      if (code === 'Period') { game.opts.stepOnce = true; return; }
      if (code === 'KeyH') { game.opts.boxes = !game.opts.boxes; syncUI(); return; }
    }
    if (down) Input.press(code); else Input.release(code);
  };
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => Input.clearAll());
  const scr = game.screen;
  scr.addEventListener('mousedown', (e) => { hideHint(); AUDIO.unlock(); Input.press('Mouse' + e.button); e.preventDefault(); scr.focus(); });
  scr.addEventListener('touchstart', hideHint, { passive: true });
  document.querySelectorAll('[data-demo]').forEach((el) => el.addEventListener('click', hideHint));
  window.addEventListener('mouseup', (e) => Input.release('Mouse' + e.button));
  scr.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => game.resize());
  // touch pad
  document.querySelectorAll('[data-act]').forEach((el) => {
    const a = el.dataset.act;
    const on = (e) => { e.preventDefault(); AUDIO.unlock(); Input.vpress(a); el.classList.add('on'); };
    const off = (e) => { e.preventDefault(); Input.vrelease(a); el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
  });
  // lab panel
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('[data-demo]').forEach((el) => el.addEventListener('click', () => { AUDIO.unlock(); game.playDemo(el.dataset.demo); scr.focus(); }));
  $('ts').addEventListener('input', (e) => { game.opts.timeScale = +e.target.value; $('tsv').textContent = (+e.target.value).toFixed(2) + '×'; });
  $('pause').addEventListener('click', () => { game.opts.paused = !game.opts.paused; syncUI(); });
  $('step').addEventListener('click', () => { game.opts.paused = true; game.opts.stepOnce = true; syncUI(); });
  $('turret').addEventListener('change', (e) => { game.opts.turret = e.target.value; scr.focus(); });
  $('costume').addEventListener('change', (e) => { COSTUME = COSTUMES[e.target.value]; scr.focus(); });
  $('view').addEventListener('change', (e) => { game.setView(e.target.value); scr.focus(); });
  $('boxes').addEventListener('change', (e) => { game.opts.boxes = e.target.checked; });
  $('rim').addEventListener('change', (e) => { game.opts.rim = e.target.checked; });
  $('walk').addEventListener('change', (e) => { game.opts.walk = e.target.checked; });
  $('training').addEventListener('change', (e) => { game.opts.training = e.target.checked; });
  $('sound').addEventListener('change', (e) => { AUDIO.muted = !e.target.checked; AUDIO.unlock(); });
  document.querySelectorAll('[data-hp]').forEach((el) => el.addEventListener('click', () => { game.player.hp = game.player.maxHp * +el.dataset.hp; scr.focus(); }));
  $('respawn').addEventListener('click', () => { game.player.reset(160, WORLD.floor); game.camX = 0; scr.focus(); });
  function syncUI() { $('pause').textContent = game.opts.paused ? 'Resume' : 'Pause'; $('boxes').checked = game.opts.boxes; }
  window.syncUI = syncUI;
  scr.focus();
}
window.addEventListener('load', boot);

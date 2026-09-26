// ---------------------------------------------------------------------------
// Player: movement, the move set, hit detection and defence.
// Frame units are 60fps frames; physics in px/s.
// ---------------------------------------------------------------------------
ANIM.plungeLand = { len: 30, cancel: 16, keys: [K_(0, P.a4s), K_(8, P.a4h, 'lin'), K_(30, P.ready, 'inOutSine')] };
ANIM.counter = { len: 34, cancel: 22, keys: [K_(0, P.dash), K_(3, P.lunge, 'outExpo'), K_(14, P.lunge, 'lin'), K_(20, P.lungeF, 'outCubic'), K_(34, P.ready, 'inOutSine')],
  hit: [[2, 13, { dmg: 380, kb: 200, stop: 7, shake: 5, heavy: true, pierce: true }]], move: [[1, 12, 150]], swing: 1 };

const MOVE = { walk: 105, run: 285, sprint: 420, accel: 2600, decel: 3200, air: 1500, jump: 575, gUp: 1500, gDown: 2300, term: 800 };

class Player {
  constructor(game) {
    this.game = game;
    this.hero = new Heroine();
    this.anim = new Animator();
    this.J = {};
    this.reset(160, WORLD.floor);
  }
  reset(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.dir = 1;
    this.grounded = true; this.coyote = 0; this.dropT = 0;
    this.state = 'move'; this.st = 0; this.phase = 0; this.idleT = 0; this.readyT = 0;
    this.maxHp = 1000; this.hp = this.maxHp; this.energy = 100; this.skillCd = 0;
    this.iframes = 0; this.hurtFlash = 0; this.hitIndex = -1; this.hitSet = new Set();
    this.chain = 'atk1'; this.airAtks = 0; this.chargeT = 0; this.sprinting = false;
    this.perfectT = 0; this.dodgeFlag = false; this.prevBlade = null; this.moveAcc = 0;
    this.anim.play(null, 0);
    this.hero.resetPhysics();
    this.stepSound = 0;
    this.pose(1 / 60); // solve once so the first render has a skeleton
  }
  get low() { return this.hp / this.maxHp < 0.3; }
  // ------------------------------------------------------------------ helpers
  enter(state, anim, blend = 4) {
    this.state = state; this.st = 0; this.hitIndex = -1; this.hitSet.clear(); this.moveAcc = 0;
    if (anim !== undefined) this.anim.play(anim, blend);
  }
  inputDir() { return (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0); }
  groundAt(x) { return groundSmooth(x); }
  // ------------------------------------------------------------------ update
  update(dt) {
    const game = this.game, f = dt * 60;
    this.st += f;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.skillCd > 0) this.skillCd -= dt * (game.opts.training ? 6 : 1);
    if (game.opts.training) this.energy = Math.min(100, this.energy + dt * 40);
    if (this.perfectT > 0) this.perfectT -= dt;
    if (this.readyT > 0) this.readyT -= dt;
    if (this.dropT > 0) this.dropT -= f;
    const ix = this.inputDir();
    const s = this.state;
    const actionable = s === 'move' || s === 'land';
    // universal buffered actions -------------------------------------------
    if (s === 'move' || s === 'land' || s === 'air' || this.canCancel()) {
      if (Input.pressed('burst', 6) && this.energy >= 100 && this.grounded) { Input.consume('burst'); return this.startBurst(); }
      if (Input.pressed('skill', 6) && this.skillCd <= 0 && this.grounded) { Input.consume('skill'); return this.startSkill(); }
      if (Input.pressed('dodge', 6) && (this.grounded || s === 'air')) { Input.consume('dodge'); return this.startDodge(ix); }
      if (Input.pressed('parry', 6) && this.grounded) { Input.consume('parry'); return this.startParry(); }
    }
    switch (this.state) {
      case 'move': this.updMove(dt, ix); break;
      case 'land': this.updMove(dt, ix); if (this.anim.done || ix) { this.state = 'move'; this.anim.play(null, 6); } break;
      case 'air': this.updAir(dt, ix); break;
      case 'attack': this.updAttack(dt, ix); break;
      case 'charge': this.updCharge(dt, ix); break;
      case 'dodge': this.updDodge(dt, ix); break;
      case 'parry': this.updParry(dt); break;
      case 'plunge': this.updPlunge(dt); break;
      case 'hit': this.updHit(dt); break;
      case 'down': this.updDown(dt); break;
      case 'burst': this.updBurst(dt); break;
    }
    this.physics(dt);
    this.pose(dt);
  }
  canCancel() {
    if (this.state !== 'attack') return false;
    const a = this.anim.anim;
    if (!a) return true;
    // dodge-cancel any time after the hit lands; everything else after the cancel frame
    const firstHit = a.hit ? a.hit[0][0] : 0;
    if (Input.pressed('dodge', 6) && this.st >= firstHit + 1) return true;
    return a.cancel !== undefined && this.st >= a.cancel;
  }
  // ------------------------------------------------------------------ locomotion
  updMove(dt, ix) {
    const g = this.game;
    if (!this.grounded) { this.enter('air', null, 6); return; }
    // attack: tap chains, hold charges
    if (Input.pressed('attack', 8)) {
      Input.consume('attack');
      if (this.perfectT > 0) return this.startAttack('counter');
      return this.startAttack('atk1');
    }
    if (Input.heldFrames('attack') > 16 && this.state === 'move') return this.startCharge();
    if (Input.pressed('jump', 6)) {
      Input.consume('jump');
      if (Input.isDown('down') && onPlatform(this.x, this.y)) { this.dropT = 14; this.grounded = false; this.y += 2; return; }
      return this.jump();
    }
    const walk = g.opts.walk ^ Input.isDown('walk');
    let target = ix * (this.sprinting ? MOVE.sprint : walk ? MOVE.walk : MOVE.run);
    if (!ix) this.sprinting = false;
    if (ix && ix !== this.dir) {
      // quick turn; at speed the body skids first
      if (Math.abs(this.vx) > 200) { g.fx.dust(this.x, this.y, 4, -ix); AUDIO.play('step'); }
      this.dir = ix; this.sprinting = false;
    }
    const acc = Math.abs(target) > Math.abs(this.vx) ? MOVE.accel : MOVE.decel;
    this.vx = approach(this.vx, target, acc * dt);
    if (Math.abs(this.vx) > 20) { this.idleT = 0; } else this.idleT += dt;
    if (this.idleT > 9 && !this.low && this.anim.name !== 'flourish') { this.anim.play('flourish', 10); }
    if (this.anim.name === 'flourish' && (this.anim.done || Math.abs(this.vx) > 20)) { this.anim.play(null, 8); this.idleT = 0; }
    if (this.anim.name === 'toIdle' && (this.anim.done || Math.abs(this.vx) > 20)) this.anim.play(null, 6);
  }
  jump() {
    this.vy = -MOVE.jump; this.grounded = false; this.coyote = 0;
    this.enter('air', null, 3);
    this.game.fx.dust(this.x, this.y, 6);
    AUDIO.play('dodge');
  }
  updAir(dt, ix) {
    if (this.grounded) {
      this.enter('land', 'land', 2);
      this.game.fx.dust(this.x, this.y, 8);
      AUDIO.play('land');
      return;
    }
    if (this.coyote > 0 && Input.pressed('jump', 6)) { Input.consume('jump'); return this.jump(); }
    if (Input.pressed('attack', 8)) {
      Input.consume('attack');
      if (Input.isDown('down')) return this.startPlunge();
      if (this.airAtks < 2) { this.airAtks++; this.vy = Math.min(this.vy, 40); return this.startAttack('airAtk'); }
    }
    const target = ix * MOVE.run;
    this.vx = approach(this.vx, target, MOVE.air * dt);
    if (ix) this.dir = ix;
    // variable jump height
    if (this.vy < 0 && !Input.isDown('jump') && this.st > 4) this.vy *= 0.85;
  }
  // ------------------------------------------------------------------ attacks
  startAttack(name) {
    const a = ANIM[name];
    const ix = this.inputDir();
    if (ix) this.dir = ix;
    this.enter('attack', name, name === 'atk1' || name === 'airAtk' ? 3 : 2);
    this.readyT = 2.2; this.idleT = 0;
    if (name !== 'airAtk') this.vx *= 0.3;
    AUDIO.play(a.hit && a.hit[0][2].heavy ? 'swishHeavy' : 'swish');
  }
  updAttack(dt, ix) {
    const a = this.anim.anim, f = this.st;
    if (!a) { this.enter('move', null, 6); return; }
    this.rootMotion(a);
    if (a.swing2 && Math.abs(f - a.swing2) < 0.5) AUDIO.play('swish');
    if (this.anim.name === 'atk4' && a.impact && f >= a.impact && !this._impacted) {
      this._impacted = true;
      const tip = this.bladeWorld().tip;
      this.game.fx.shock(tip[0], groundTop(tip[0]), true);
      this.game.shake(6, 0.3);
      AUDIO.play('hitHeavy');
    }
    if (f < 1) this._impacted = false;
    // chain / charge after the cancel frame
    if (a.cancel !== undefined && f >= a.cancel) {
      if (this.anim.name.startsWith('atk') && Input.heldFrames('attack') > a.cancel + 6) return this.startCharge();
      if (Input.pressed('attack', 12)) {
        Input.consume('attack');
        if (this.perfectT > 0) return this.startAttack('counter');
        if (this.anim.name === 'airAtk') { if (!this.grounded && this.airAtks < 2) { this.airAtks++; return this.startAttack('airAtk'); } }
        else { const next = a.next || 'atk1'; return this.startAttack(this.grounded ? next : 'airAtk'); }
      }
      if (Input.pressed('jump', 6) && this.grounded) { Input.consume('jump'); return this.jump(); }
      if (ix && this.grounded && f >= a.cancel + 4) { this.enter('move', null, 8); return; }
    }
    if (this.anim.done) {
      if (!this.grounded) this.enter('air', null, 8);
      else { this.enter('move', null, 8); }
    }
  }
  rootMotion(a) {
    if (!a.move) return;
    const f = this.st;
    for (const [f0, f1, px] of a.move) {
      if (f < f0 || f > f1 + 1) continue;
      const k = clamp((f - f0) / (f1 - f0), 0, 1);
      const target = px * EASE.outQuad(k);
      const d = target - (this.moveAcc || 0);
      this.moveAcc = target;
      const pass = this.anim.name === 'skill' || this.anim.name === 'lunge' || this.anim.name === 'counter';
      this.moveX(d * this.dir, !pass);
      if (k >= 1) this.moveAcc = 0;
    }
  }
  moveX(dx, solid = true) {
    let nx = clamp(this.x + dx, 30, WORLD.w - 30);
    // bodies do not pass through a sentinel's pedestal while grounded
    if (solid && this.grounded) for (const s of this.game.sentinels) {
      if (s.dead > 0 || Math.abs(s.baseY - this.y) > 30) continue;
      const lim = 22;
      if (dx > 0 && this.x <= s.x - lim && nx > s.x - lim) nx = s.x - lim;
      if (dx < 0 && this.x >= s.x + lim && nx < s.x + lim) nx = s.x + lim;
    }
    this.x = nx;
  }
  startCharge() {
    this.enter('charge', null, 8);
    this.chargeT = 0;
    AUDIO.play('charge');
  }
  updCharge(dt) {
    this.chargeT += dt;
    this.vx = approach(this.vx, 0, MOVE.decel * dt);
    if (this.chargeT > 0.2 && Math.random() < 0.5) this.game.fx.embers(this.x - this.dir * 10, this.y - 60, 1);
    if (!Input.isDown('attack')) {
      const full = this.chargeT > 0.55;
      this.enter('attack', 'lunge', 2);
      this.lungeMul = full ? 1.5 : 1;
      if (full) { this.game.fx.flash(0.12, '#ff4a5c'); this.game.fx.word(this.x, this.y - 150, 'FULL CHARGE', '#ff9aa6'); }
      AUDIO.play('swishHeavy');
      this.iframes = Math.max(this.iframes, 0.18);
    }
  }
  startPlunge() {
    this.enter('plunge', null, 3);
    this.vy = -160; this.vx *= 0.3;
    AUDIO.play('swishHeavy');
  }
  updPlunge(dt) {
    if (this.st > 8) this.vy = 980;
    if (this.grounded) {
      this.enter('attack', 'plungeLand', 1);
      const g = this.game;
      g.fx.shock(this.x + this.dir * 20, this.y, true);
      g.shake(7, 0.3); g.hitstop = 7;
      AUDIO.play('hitHeavy');
      for (const s of g.sentinels) if (s.dead <= 0 && Math.abs(s.x - this.x) < 90 && Math.abs(s.baseY - this.y) < 60) g.damage(s, 380, s.x, s.y, true);
    }
  }
  // ------------------------------------------------------------------ defence
  startDodge(ix) {
    const g = this.game;
    if (ix) this.dir = ix;
    const back = !ix && this.grounded;
    this.enter('dodge', back ? 'backstep' : 'dodge', 2);
    this.dodgeBack = back; this.dodgeFlag = false;
    this.iframes = Math.max(this.iframes, (back ? 12 : 14) / 60);
    this.vx = 0; if (!this.grounded) this.vy = Math.min(this.vy, 0) * 0.3;
    g.fx.dust(this.x, this.y, 6, back ? this.dir : -this.dir);
    AUDIO.play('dodge');
  }
  updDodge(dt, ix) {
    const f = this.st, dur = this.dodgeBack ? 13 : 15;
    if (f <= dur) {
      const sp = this.dodgeBack ? 380 : 700;
      const k = 1 - EASE.inQuad(clamp(f / dur, 0, 1));
      this.moveX((this.dodgeBack ? -this.dir : this.dir) * sp * k * dt * 1.4, false);
      if ((f | 0) % 3 === 0) this.game.spawnAfterimage([255, 70, 90], 0.25, 0.45);
      if (!this.grounded) this.vy = Math.min(this.vy, 40);
    }
    if (f > dur - 2 && !this.dodgeBack && ix === this.dir && this.grounded) { this.sprinting = true; this.vx = this.dir * MOVE.sprint; this.enter('move', null, 6); return; }
    if (this.anim.done) this.enter(this.grounded ? 'move' : 'air', null, 6);
  }
  startParry() { this.enter('parry', 'parry', 1); this.vx = 0; }
  updParry() { if (this.anim.done) this.enter('move', null, 6); }
  // ------------------------------------------------------------------ skill: Red Line
  startSkill() {
    this.enter('attack', 'skill', 2);
    this.skillCd = 3; this.skillStart = [this.x, this.y - 70];
    this.iframes = Math.max(this.iframes, 0.35);
    this.readyT = 2.2;
    AUDIO.play('swishHeavy');
  }
  // ------------------------------------------------------------------ burst: Halo
  startBurst() {
    this.enter('burst', 'burst', 4);
    this.energy = 0; this.iframes = 1.6; this.vx = 0;
    this.game.burst = { t: 0 };
    AUDIO.play('burst');
  }
  updBurst() {
    const g = this.game, f = this.st;
    if (g.burst) g.burst.t = f;
    // screen-wide cuts while the world holds its breath
    for (const cf of [26, 32, 38, 44]) if (Math.abs(f - cf) < 0.5) {
      const vx = g.camX, vy = g.camY, vw = g.vw, vh = g.vh;
      const a = rand(-0.6, 0.6) + (cf % 12 ? 0.3 : -0.3);
      const cx = vx + vw * rand(0.3, 0.7), cy = vy + vh * rand(0.3, 0.6);
      const L = vw;
      g.fx.lines.push({ x0: cx - Math.cos(a) * L, y0: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, t: 1, delay: 0, life: 0.3, fired: true });
      g.fx.flash(0.15, '#ff2a40');
      AUDIO.play('cut');
      for (const s of g.sentinels) if (s.dead <= 0 && g.onScreen(s.x, s.y)) g.damage(s, 180, s.x, s.y, false);
    }
    if (Math.abs(f - 58) < 0.5) {
      g.fx.flash(0.9, '#ffffff'); g.shake(10, 0.5); g.hitstop = 12;
      AUDIO.play('burstHit');
      for (const s of g.sentinels) if (s.dead <= 0 && g.onScreen(s.x, s.y)) g.damage(s, 1400, s.x, s.y, true);
      const tip = this.bladeWorld().tip;
      g.fx.shock(tip[0], groundTop(tip[0]), true);
    }
    if (this.anim.done) { g.burst = null; this.enter('move', null, 8); }
  }
  // ------------------------------------------------------------------ taking hits
  hurt(dmg, from) {
    const g = this.game;
    this.hp -= dmg; this.hurtFlash = 0.12;
    g.fx.num(this.x, this.y - 130, dmg, false);
    g.fx.sparks(this.x, this.y - 70, Math.atan2(-from.vy, -from.vx), 10, [255, 255, 255], 260, 0.8);
    g.shake(4, 0.2); g.hitstop = 4;
    AUDIO.play('hurt');
    if (from.vx) this.dir = from.vx > 0 ? -1 : 1;
    if (this.hp <= 0 || dmg >= 200) {
      this.enter('hit', null, 2);
      this.knock = true; this.vy = -360; this.vx = -this.dir * 240; this.grounded = false;
      this.iframes = 2.2;
    } else {
      this.enter('hit', 'flinch', 1);
      this.knock = false; this.vx = -this.dir * 180;
      this.iframes = 0.6;
    }
  }
  updHit(dt) {
    if (this.knock) {
      if (this.grounded && this.st > 6) {
        this.enter('down', null, 3); this.vx = 0;
        this.game.fx.dust(this.x, this.y, 10); this.game.shake(3, 0.15);
        AUDIO.play('land');
      }
      return;
    }
    this.vx = approach(this.vx, 0, 1400 * dt);
    if (this.anim.done) this.enter('move', null, 6);
  }
  updDown() {
    if (this.st > 40 && !this.anim.anim) this.anim.play('getup', 6);
    if (this.anim.name === 'getup' && this.anim.done) {
      if (this.hp <= 0) this.hp = this.maxHp; // training: stand back up restored
      this.enter('move', null, 6); this.iframes = 0.5;
    }
  }
  // ------------------------------------------------------------------ physics
  physics(dt) {
    const g = this.game;
    const s = this.state;
    const airborne = !this.grounded;
    // horizontal
    if (s === 'move' || s === 'air' || s === 'hit' || s === 'land') this.moveX(this.vx * dt);
    else if (s === 'attack' && !this.grounded) this.moveX(this.vx * dt * 0.6);
    // vertical
    if (airborne || this.vy < 0) {
      let gr = this.vy < 0 ? MOVE.gUp : MOVE.gDown;
      if (s === 'attack' && this.anim.name === 'airAtk') gr *= 0.35;
      if (s === 'dodge') gr *= 0.2;
      if (s === 'burst') gr = 0;
      this.vy = Math.min(MOVE.term * (s === 'plunge' ? 1.4 : 1), this.vy + gr * dt);
      const y0 = this.y, y1 = this.y + this.vy * dt;
      const gy = this.groundAt(this.x);
      let landed = false;
      if (this.vy >= 0) {
        const p = this.dropT > 0 ? null : platformAt(this.x, y0, y1);
        if (p) { this.y = p.y; landed = true; }
        else if (y1 >= gy) { this.y = gy; landed = true; }
      }
      if (!landed) this.y = y1;
      if (landed) { this.vy = 0; this.grounded = true; this.airAtks = 0; } else this.grounded = false;
      if (this.y < 20) { this.y = 20; this.vy = Math.max(0, this.vy); }
    } else {
      // stay glued to steps and platforms; walk off edges into a fall
      const plat = onPlatform(this.x, this.y);
      if (plat && this.dropT <= 0) this.y = plat.y;
      else {
        const gy = this.groundAt(this.x);
        if (gy - this.y > 18) { this.grounded = false; this.coyote = 6; }
        else this.y = gy;
      }
    }
    if (this.coyote > 0) this.coyote -= dt * 60;
    // footsteps
    if (this.grounded && s === 'move' && Math.abs(this.vx) > 60) {
      const ph = this.phase % 0.5;
      if (ph < this.stepSound) AUDIO.play('step');
      this.stepSound = ph;
    }
  }
  // ------------------------------------------------------------------ pose + hits
  pose(dt) {
    const f = dt * 60;
    let target = null;
    const s = this.state;
    if (!this.anim.anim) {
      if (s === 'move' || s === 'land') {
        const sp = Math.abs(this.vx);
        this.phase += (sp * dt) / lerp(104, 172, smoothstep(110, 290, sp));
        if (sp > 12) target = locoPose(this._loco || (this._loco = mkPose({})), this.phase, sp, 0, this.game.time);
        else {
          const base = this.readyT > 0 ? P.ready : this.low ? P.lowIdle : P.idle;
          target = copyPose(this._idle || (this._idle = mkPose({})), base);
          const t = this.game.time, br = this.low ? 2.6 : 1.4; // breathing
          target.sp += Math.sin(t * br * 2) * (this.low ? 0.03 : 0.012);
          target.hd += Math.sin(t * br * 2 + 0.6) * 0.02;
          target.ry += Math.sin(t * br * 2) * (this.low ? 0.8 : 0.35);
          target.ba += Math.sin(t * br * 2 + 1) * 0.015;
          this.phase = 0;
        }
      } else if (s === 'air' || s === 'hit') {
        if (s === 'hit' && this.knock) target = P.airHit;
        else target = lerpPose(this._air || (this._air = mkPose({})), P.rise, P.fall, smoothstep(-250, 300, this.vy));
      } else if (s === 'charge') {
        target = copyPose(this._ch || (this._ch = mkPose({})), P.charge);
        target.ry += Math.sin(this.game.time * 30) * 0.3 * Math.min(1, this.chargeT * 2);
      } else if (s === 'plunge') target = this.st < 8 ? P.plungeUp : P.plunge;
      else if (s === 'down') target = P.down;
      else target = P.ready;
    }
    const pose = this.anim.update(f, target);
    // skid lean when reversing at speed
    const gnd = (fx) => groundTop(this.x + fx * this.dir) - this.y;
    this.J = solveRig(pose, this.grounded ? gnd : null, this.J);
    this.hero.simulate(this.J, this.x, this.y, this.dir, dt, {
      wind: -this.vx * 0.8 - 14 + Math.sin(this.game.time * 0.7) * 10,
      lift: this.vy < 0 ? 400 : this.vy > 200 ? -900 : 0,
      groundY: (x) => groundTop(x),
      skirt: { grounded: this.grounded, vx: this.vx, vy: this.vy, phase: this.phase, state: s },
    });
    this.bladeHits(f);
  }
  bladeWorld() {
    const J = this.J, d = this.dir;
    return { base: [this.x + J.bbx * d, this.y + J.bby], tip: [this.x + J.tpx * d, this.y + J.tpy] };
  }
  bladeHits() {
    const g = this.game, a = this.anim.anim;
    const bw = this.bladeWorld();
    const swinging = this.state === 'attack' && a && a.hit && a.hit.some(([f0, f1]) => this.st >= f0 - 3 && this.st <= f1 + 2);
    if (swinging || this.state === 'burst' && this.st > 52 && this.st < 62) g.fx.pushTrail(bw.base[0], bw.base[1], bw.tip[0], bw.tip[1]);
    if (!a || !a.hit || this.state !== 'attack') { this.prevBlade = bw; return; }
    a.hit.forEach(([f0, f1, info], hi) => {
      if (this.st < f0 || this.st > f1) return;
      if (this.hitIndex !== hi) { this.hitIndex = hi; this.hitSet.clear(); }
      const segs = [];
      const pb = this.prevBlade || bw;
      for (let k = 0; k <= 3; k++) {
        const t = k / 3;
        segs.push([lerp(pb.base[0], bw.base[0], t), lerp(pb.base[1], bw.base[1], t), lerp(pb.tip[0], bw.tip[0], t), lerp(pb.tip[1], bw.tip[1], t)]);
      }
      const near = (px, py, r) => {
        for (const [x0, y0, x1, y1] of segs) {
          const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
          const t = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1);
          const cx = x0 + dx * t, cy = y0 + dy * t;
          if (Math.hypot(px - cx, py - cy) <= r + 4) return [cx, cy];
        }
        return null;
      };
      // lunge/skill: the body itself carries the hit too
      const bodyHit = info.pierce ? (px, py, r) => (Math.abs(px - this.x) < r + 28 && Math.abs(py - (this.y - 60)) < r + 60 ? [px, py] : null) : () => null;
      for (const s of g.sentinels) {
        if (s.dead > 0 || this.hitSet.has(s)) continue;
        const c = near(s.x, s.y, s.r) || bodyHit(s.x, s.y, s.r);
        if (c) {
          this.hitSet.add(s);
          const dmg = info.dmg * (this.anim.name === 'lunge' ? this.lungeMul || 1 : 1);
          g.damage(s, dmg, c[0], c[1], info.heavy, info);
          this.energy = Math.min(100, this.energy + 7);
          g.hitstop = Math.max(g.hitstop, info.stop);
          g.shake(info.shake, 0.12 + info.shake * 0.02);
          const ang = Math.atan2(bw.tip[1] - pb.tip[1], bw.tip[0] - pb.tip[0]);
          g.fx.arc(c[0], c[1], 26 + (info.heavy ? 14 : 0), ang - 1.3, ang + 1.3, info.heavy ? 9 : 6, 0.14);
        }
      }
      // cut bullets out of the air
      for (let i = g.bullets.length - 1; i >= 0; i--) {
        const b = g.bullets[i];
        if (b.owner !== 'enemy') continue;
        const c = near(b.x, b.y, b.r);
        if (c) {
          g.bullets.splice(i, 1);
          g.fx.sparks(b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI, 8, [170, 240, 255], 260, 0.8);
          g.fx.ring(b.x, b.y, 4, [170, 240, 255], 0.14);
          g.hitstop = Math.max(g.hitstop, 2);
          AUDIO.play('cut');
          this.energy = Math.min(100, this.energy + 3);
        }
      }
    });
    // skill: leave the red line when the dash ends
    if (this.anim.name === 'skill' && Math.abs(this.st - 16) < 0.5 && this.skillStart) {
      const [sx, sy] = this.skillStart, ex = this.x, ey = this.y - 70;
      this.skillStart = null;
      g.fx.cutLine(sx - this.dir * 20, sy, ex + this.dir * 30, ey, 0.42, () => {
        g.fx.flash(0.2, '#ff2a40'); g.shake(5, 0.25); g.hitstop = 5;
        AUDIO.play('detonate');
        for (const s of g.sentinels) {
          if (s.dead > 0) continue;
          // distance to the line
          const dx = ex - sx, dy = ey - sy, L2 = dx * dx + dy * dy || 1;
          const t = clamp(((s.x - sx) * dx + (s.y - sy) * dy) / L2, 0, 1);
          if (Math.hypot(s.x - (sx + dx * t), s.y - (sy + dy * t)) < s.r + 36) {
            for (let k = 0; k < 5; k++) g.later(k * 0.045, () => g.damage(s, 84, s.x + rand(-8, 8), s.y + rand(-8, 8), false));
          }
        }
      });
    }
    this.prevBlade = bw;
  }
  // ------------------------------------------------------------------ bullets vs body
  hurtbox() { return [this.x, this.y - 18, this.x + this.dir * 2, this.y - 118, 11]; }
  checkBullet(b) {
    const [x0, y0, x1, y1, r] = this.hurtbox();
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    const t = clamp(((b.x - x0) * dx + (b.y - y0) * dy) / L2, 0, 1);
    return Math.hypot(b.x - (x0 + dx * t), b.y - (y0 + dy * t)) < r + b.r;
  }
}

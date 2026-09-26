// ---------------------------------------------------------------------------
// FX: blade trails, slash crescents, sparks, shockwaves, afterimages, damage
// numbers and the lights they cast (which rim-light the heroine).
// ---------------------------------------------------------------------------
const GLYPH = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
};
const WORDS = {}; // pre-rendered small word sprites (PARRY etc.) via canvas text at load

class FX {
  constructor() {
    this.parts = []; this.arcs = []; this.rings = []; this.nums = []; this.after = []; this.lines = []; this.words = [];
    this.trail = []; this.trailOn = false; this.trailCol = 0;
    this.flashA = 0; this.flashC = '#ffffff';
    this.lights = [];
    this.smears = []; this.marks = []; this.glints = []; this.cracks = []; this.impactF = null;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  // ---- emitters
  sparks(x, y, ang, n, col = [255, 220, 200], spd = 260, spread = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-spread, spread), s = spd * rand(0.4, 1.2);
      this.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.12, 0.3), max: 0.3, col, drag: 5, grav: 500 });
    }
  }
  embers(x, y, n, col = [255, 70, 90]) {
    for (let i = 0; i < n; i++) this.parts.push({ kind: 'ember', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-60, 60), vy: rand(-120, -20), life: rand(0.3, 0.8), max: 0.8, col, drag: 2, grav: -20 });
  }
  dust(x, y, n, dir = 0) {
    for (let i = 0; i < n; i++) this.parts.push({ kind: 'dust', x: x + rand(-4, 4), y: y - rand(0, 3), vx: rand(-40, 40) + dir * rand(20, 90), vy: rand(-50, -10), life: rand(0.25, 0.55), max: 0.55, col: [200, 198, 210], drag: 4, grav: 60, size: randi(1, 3) });
  }
  muzzle(x, y, a) {
    this.rings.push({ x, y, r: 2, vr: 90, life: 0.12, max: 0.12, col: [127, 230, 255], flat: 1, w: 2 });
    this.sparks(x, y, a, 4, [160, 240, 255], 180, 0.4);
  }
  ring(x, y, r, col, life = 0.3, flat = 1) { this.rings.push({ x, y, r, vr: r * 5, life, max: life, col, flat, w: 2 }); }
  shock(x, y, big) {
    this.rings.push({ x, y, r: 6, vr: big ? 520 : 320, life: 0.35, max: 0.35, col: [255, 90, 110], flat: 0.22, w: 3 });
    this.rings.push({ x, y, r: 4, vr: big ? 300 : 200, life: 0.28, max: 0.28, col: [255, 230, 235], flat: 0.22, w: 2 });
    for (let i = 0; i < (big ? 18 : 10); i++) this.parts.push({ kind: 'shard', x: x + rand(-20, 20), y: y - 2, vx: rand(-220, 220), vy: rand(-320, -120), life: rand(0.4, 0.8), max: 0.8, col: [120, 118, 134], drag: 1, grav: 1100, size: randi(2, 3) });
    this.dust(x, y, big ? 16 : 8);
  }
  impact(x, y, ang, heavy) {
    this.rings.push({ x, y, r: 3, vr: heavy ? 420 : 260, life: heavy ? 0.22 : 0.16, max: heavy ? 0.22 : 0.16, col: [255, 240, 244], flat: 1, w: heavy ? 3 : 2 });
    this.sparks(x, y, ang, heavy ? 16 : 9, [255, 200, 210], heavy ? 420 : 300, 0.7);
    this.embers(x, y, heavy ? 10 : 4);
    this.parts.push({ kind: 'star', x, y, life: 0.08, max: 0.08, size: heavy ? 26 : 16, ang: rand(0, 1) });
  }
  explode(x, y) {
    this.flash(0.35, '#e8fbff');
    this.rings.push({ x, y, r: 6, vr: 300, life: 0.4, max: 0.4, col: [127, 230, 255], flat: 1, w: 3 });
    this.sparks(x, y, -Math.PI / 2, 30, [160, 240, 255], 420, Math.PI);
    for (let i = 0; i < 14; i++) this.parts.push({ kind: 'shard', x, y, vx: rand(-260, 260), vy: rand(-380, -60), life: rand(0.5, 1.1), max: 1.1, col: [110, 108, 124], drag: 0.6, grav: 900, size: randi(2, 4) });
  }
  // ---- frame-authored effects: each is a short sequence of held drawings, not a tween
  // slash smear around a pivot on a tilted ellipse (sq flattens, rot tilts, s = swing sense)
  smear(o) { this.smears.push(Object.assign({ age: 0, hold: o.heavy ? 3 : 2, ember: false }, o)); }
  // crossed hit mark at the contact point
  mark(x, y, ang, heavy) { this.marks.push({ x, y, ang, heavy, age: 0, hold: heavy ? 3 : 2 }); }
  glint(x, y, big) { this.glints.push({ x, y, big, age: 0 }); }
  crack(x, y) {
    const mk = (d) => { const pts = [[x, y]]; let px = x, py = y; for (let i = 0; i < 6; i++) { px += d * rand(10, 22); py = y + rand(-2, 2); pts.push([px, py]); } return pts; };
    this.cracks.push({ lines: [mk(1), mk(-1), mk(0.6), mk(-0.6)], life: 0.9, max: 0.9 });
  }
  // anime impact frame: two ticks of negative + radial lines, then lines over the real image
  impactFrame(x, y) { if (this.impactCd > 0) return; this.impactF = { x, y, t: 0, seed: Math.random() * 1000 }; this.impactCd = 24; }
  realTick() { if (this.impactCd > 0) this.impactCd--; if (this.impactF && ++this.impactF.t > 6) this.impactF = null; }
  arc(x, y, r, a0, a1, w, life = 0.16, col = 'red') { this.arcs.push({ x, y, r, a0, a1, w, life, max: life, col }); }
  num(x, y, v, crit) { this.nums.push({ x: x + rand(-8, 8), y, v: Math.round(v), crit, life: 0.9, max: 0.9, vy: -130 }); }
  word(x, y, text, col) { this.words.push({ x, y, text, col, life: 0.8, max: 0.8 }); }
  flash(a, c = '#ffffff') { this.flashA = Math.max(this.flashA, a); this.flashC = c; }
  afterimage(sprite, x, y, flip, col, life = 0.3, a = 0.6) { this.after.push({ s: sprite, x, y, flip, col, life, max: life, a }); }
  cutLine(x0, y0, x1, y1, delay, onDetonate) { this.lines.push({ x0, y0, x1, y1, t: 0, delay, life: delay + 0.35, onDetonate, fired: false }); }

  // blade trail: push the blade segment each simulation step while swinging
  pushTrail(bx, by, tx, ty, arr = this.trail) {
    const last = arr[arr.length - 1];
    if (last) {
      // subdivide long sweeps so arcs stay round
      const d = Math.hypot(tx - last.tx, ty - last.ty);
      const n = arr === this.trail ? Math.min(6, Math.floor(d / 14)) : Math.min(14, Math.floor(d / 6));
      for (let i = 1; i <= n; i++) {
        const k = i / (n + 1);
        // rotate around the base: interpolate angle and length
        const a0 = Math.atan2(last.ty - last.by, last.tx - last.bx), a1 = Math.atan2(ty - by, tx - bx);
        const L0 = Math.hypot(last.tx - last.bx, last.ty - last.by), L1 = Math.hypot(tx - bx, ty - by);
        const a = angLerp(a0, a1, k), L = lerp(L0, L1, k), cx = lerp(last.bx, bx, k), cy = lerp(last.by, by, k);
        arr.push({ bx: cx, by: cy, tx: cx + Math.cos(a) * L, ty: cy + Math.sin(a) * L, age: 0 });
      }
    }
    arr.push({ bx, by, tx, ty, age: 0 });
    if (arr === this.trail && arr.length > 40) arr.splice(0, arr.length - 40);
  }

  update(dt) {
    const step = (arr, f) => { for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; o.life -= dt; if (o.life <= 0) arr.splice(i, 1); else if (f) f(o); } };
    step(this.parts, (p) => {
      if (p.vx !== undefined) { p.vx *= Math.exp(-p.drag * dt); p.vy = p.vy * Math.exp(-p.drag * dt) + p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    });
    for (const o of this.smears) o.age += dt;
    this.smears = this.smears.filter((o) => {
      const f = Math.floor(o.age * 60 / o.hold);
      if (f >= 3 && !o.ember) { o.ember = true; for (let i = 0; i < (o.heavy ? 10 : 5); i++) { const q = o.thrust ? [o.x + o.dir * o.len * rand(0.4, 1), o.y + rand(-4, 4)] : this.smearPt(o, rand(0.5, 1), rand(0.7, 1.1)); this.parts.push({ kind: 'ember', x: q[0], y: q[1], vx: rand(-50, 50), vy: rand(-90, -10), life: rand(0.3, 0.7), max: 0.7, col: [255, 80, 100], drag: 2, grav: -30 }); } }
      return f < 4;
    });
    for (const o of this.marks) o.age += dt;
    this.marks = this.marks.filter((o) => o.age * 60 / o.hold < 3);
    for (const o of this.glints) o.age += dt;
    this.glints = this.glints.filter((o) => o.age < (o.big ? 0.2 : 0.14));
    step(this.cracks);
    step(this.arcs); step(this.rings, (r) => { r.r += r.vr * dt; r.vr *= Math.exp(-6 * dt); });
    step(this.nums, (n) => { n.y += n.vy * dt; n.vy *= Math.exp(-5 * dt); });
    step(this.after); step(this.words, (w) => { w.y -= 24 * dt; });
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i]; L.t += dt; L.life -= dt;
      if (!L.fired && L.t >= L.delay) { L.fired = true; L.onDetonate && L.onDetonate(L); }
      if (L.life <= 0) this.lines.splice(i, 1);
    }
    for (const s of this.trail) s.age += dt;
    while (this.trail.length && this.trail[0].age > 0.09) this.trail.shift();
    this.flashA = Math.max(0, this.flashA - dt * 4);
  }

  // lights that rim-light the heroine this frame (world space)
  collectLights(game) {
    const L = this.lights; L.length = 0;
    for (const b of game.bullets) L.push({ x: b.x, y: b.y, r: b.kind === 'orb' ? 90 : 60, i: b.owner === 'enemy' ? 1.0 : 1.1, c: b.owner === 'enemy' ? [130, 235, 255] : [255, 80, 100] });
    if (this.trail.length > 2) { const s = this.trail[this.trail.length - 1]; L.push({ x: (s.bx + s.tx) / 2, y: (s.by + s.ty) / 2, r: 120, i: 1.1, c: [255, 70, 90] }); }
    for (const o of this.smears) { const q = o.thrust ? [o.x + o.dir * o.len * 0.7, o.y] : this.smearPt(o, 0.8, 1); L.push({ x: q[0], y: q[1], r: o.heavy ? 170 : 130, i: 1.3 * Math.max(0, 1 - o.age * 60 / (o.hold * 4)), c: [255, 70, 90] }); }
    for (const a of this.arcs) L.push({ x: a.x + Math.cos((a.a0 + a.a1) / 2) * a.r, y: a.y + Math.sin((a.a0 + a.a1) / 2) * a.r, r: 110, i: 1.2 * (a.life / a.max), c: [255, 90, 110] });
    for (const r of this.rings) L.push({ x: r.x, y: r.y, r: 90 + r.r, i: 0.9 * (r.life / r.max), c: r.col });
    for (const s of game.sentinels) if (s.dead <= 0 && s.charge > 0.2) L.push({ x: s.x, y: s.y, r: 150, i: 0.6 * s.charge, c: [130, 235, 255] });
    for (const l of this.lines) if (l.fired) L.push({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2, r: 200, i: 1.4 * (l.life / 0.35), c: [255, 60, 80] });
    return L;
  }

  // point on a path smear: s along the swing (0 oldest, 1 newest), u along the blade (1 = tip)
  smearPt(o, sAlong, u) {
    const P = o.path, f = clamp(sAlong, 0, 1) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), k = f - i;
    const A = P[i], B = P[i + 1];
    const bx = lerp(A.bx, B.bx, k), by = lerp(A.by, B.by, k), tx = lerp(A.tx, B.tx, k), ty = lerp(A.ty, B.ty, k);
    return [bx + (tx - bx) * u, by + (ty - by) * u];
  }
  drawSmears(ctx, X, Y) {
    // one crescent band between radius rOut and rOut - w(u), u from u0 to 1 (1 = leading edge)
    // crescent band: outer edge past the tip (the slash reads bigger than the blade), inner edge
    // eats toward the hilt by a width profile that peaks just behind the leading edge
    const band = (o, s0, s1, off, wk, col) => {
      const N = Math.max(8, o.path.length * 2), W = o.th;
      const prof = (t) => Math.pow(t, 0.65) * Math.pow(Math.max(0, 1 - t), 0.2) * 1.25;
      const out = (t) => 1.1 + 0.08 * prof(t) - off * W;
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const t = lerp(s0, s1, i / N), q = this.smearPt(o, t, out(t)); ctx.lineTo(X(q[0]), Y(q[1])); }
      for (let i = N; i >= 0; i--) { const t = lerp(s0, s1, i / N), q = this.smearPt(o, t, out(t) - W * wk * prof(t)); ctx.lineTo(X(q[0]), Y(q[1])); }
      ctx.fill();
    };
    const spear = (o, x0k, halfW, col) => {
      const L = o.len, N = 12;
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const t = i / N, hw = halfW * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.8); ctx.lineTo(X(o.x + o.dir * lerp(L * x0k, L, t)), Y(o.y - hw)); }
      for (let i = N; i >= 0; i--) { const t = i / N, hw = halfW * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.8); ctx.lineTo(X(o.x + o.dir * lerp(L * x0k, L, t)), Y(o.y + hw)); }
      ctx.fill();
    };
    for (const o of this.smears) {
      const f = Math.floor(o.age * 60 / o.hold);
      if (o.thrust) {
        if (f === 0) { spear(o, 0, 9, '#b80d2a'); spear(o, 0.15, 5.5, '#ff3c52'); spear(o, 0.35, 2, '#ffffff'); }
        else if (f === 1) { spear(o, 0.3, 6, '#d4163a'); spear(o, 0.45, 2, '#ff8796'); }
        else if (f === 2) { spear(Object.assign({}, o, { y: o.y - 5 }), 0.5, 1.2, '#ff5064'); spear(Object.assign({}, o, { y: o.y + 4 }), 0.6, 1, '#d4163a'); }
        else spear(o, 0.75, 0.8, '#ff8796');
        continue;
      }
      if (f === 0) {
        if (o.heavy) band(o, 0.05, 1, -0.12, 0.12, '#ffffff');
        band(o, 0, 1, 0, 1, '#b80d2a');
        band(o, 0.08, 1, 0, 0.62, '#ff3c52');
        band(o, 0.3, 1, 0, 0.26, '#fff3f5');
      } else if (f === 1) {
        band(o, 0.25, 1, 0.05, 0.8, '#d4163a');
        band(o, 0.35, 1, 0.05, 0.36, '#ff8796');
        band(o, 0.55, 1, 0.05, 0.12, '#ffffff');
      } else if (f === 2) {
        band(o, 0.42, 1, 0.0, 0.14, '#ff5064');
        band(o, 0.52, 0.97, 0.34, 0.12, '#ff3c52');
        band(o, 0.62, 0.95, 0.66, 0.1, '#d4163a');
      } else {
        band(o, 0.66, 1, 0.1, 0.07, '#ff8796');
      }
    }
  }
  drawMarks(ctx, X, Y) {
    const dia = (x, y, a, L, w, col) => {
      const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(X(x + c * L), Y(y + s * L)); ctx.lineTo(X(x + nx * w), Y(y + ny * w));
      ctx.lineTo(X(x - c * L), Y(y - s * L)); ctx.lineTo(X(x - nx * w), Y(y - ny * w)); ctx.fill();
    };
    for (const m of this.marks) {
      const f = Math.floor(m.age * 60 / m.hold), big = m.heavy ? 1.5 : 1;
      const L = [34, 42, 48][f] * big, w = [4.5, 2.6, 1][f] * big;
      const a2 = m.ang + 1.15;
      dia(m.x, m.y, m.ang, L, w + 1.5, f < 2 ? '#e0163c' : '#ff5064');
      dia(m.x, m.y, a2, L * 0.62, (w + 1.5) * 0.8, f < 2 ? '#e0163c' : '#ff5064');
      if (f < 2) { dia(m.x, m.y, m.ang, L * 0.92, w * 0.55, '#ffffff'); dia(m.x, m.y, a2, L * 0.56, w * 0.45, '#ffffff'); }
    }
    for (const g of this.glints) {
      const t = g.age / (g.big ? 0.2 : 0.14), k = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      const L = (g.big ? 30 : 18) * k, w = 2.2 * k;
      dia(g.x, g.y, 0, L, w, '#ffffff'); dia(g.x, g.y, Math.PI / 2, L * 0.55, w, '#ffffff');
      dia(g.x, g.y, Math.PI / 4, L * 0.25, w * 0.7, '#ffd0d6'); dia(g.x, g.y, -Math.PI / 4, L * 0.25, w * 0.7, '#ffd0d6');
    }
  }
  drawCracks(ctx, X, Y) {
    for (const c of this.cracks) {
      const k = c.life / c.max;
      for (const ln of c.lines) {
        const n = Math.max(2, Math.ceil(ln.length * Math.min(1, (1 - k) * 8)));
        ctx.strokeStyle = `rgba(20,12,18,${Math.min(1, k * 2)})`; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < n; i++) ctx.lineTo(Math.round(X(ln[i][0])), Math.round(Y(ln[i][1])));
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,60,80,${k})`; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i < n; i++) ctx.lineTo(Math.round(X(ln[i][0])), Math.round(Y(ln[i][1])) - 1);
        ctx.stroke();
      }
    }
  }
  // ---- drawing (world space, native canvas)
  drawBack(ctx, cx, cy) {
    // afterimages behind the heroine
    for (const a of this.after) {
      const k = a.life / a.max;
      ctx.globalAlpha = a.a * k;
      const s = a.s;
      if (a.flip < 0) { ctx.save(); ctx.translate(Math.round(a.x - cx), 0); ctx.scale(-1, 1); ctx.drawImage(s.cv, -s.w, Math.round(a.y - cy)); ctx.restore(); }
      else ctx.drawImage(s.cv, Math.round(a.x - cx), Math.round(a.y - cy));
    }
    ctx.globalAlpha = 1;
  }
  drawFront(ctx, cx, cy, time) {
    const X = (x) => x - cx, Y = (y) => y - cy;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // blade trail: a crisp crescent swept by the outer half of the blade,
    // saturated red body, white-hot leading edge, gone in ~5 frames
    ctx.globalCompositeOperation = 'source-over';
    const T = this.trail;
    const seg = (a, b, u0, u1, col) => {
      const p = (s, u) => [lerp(s.bx, s.tx, u), lerp(s.by, s.ty, u)];
      const [a0x, a0y] = p(a, u0), [a1x, a1y] = p(a, u1), [b0x, b0y] = p(b, u0), [b1x, b1y] = p(b, u1);
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(X(a0x), Y(a0y)); ctx.lineTo(X(a1x), Y(a1y)); ctx.lineTo(X(b1x), Y(b1y)); ctx.lineTo(X(b0x), Y(b0y)); ctx.fill();
    };
    // opaque crescent that thins as it ages (no alpha wash); never below the floor
    ctx.save();
    if (this.floorY !== undefined) { ctx.beginPath(); ctx.rect(0, 0, 4096, Y(this.floorY) + 1); ctx.clip(); }
    for (let i = 1; i < T.length; i++) {
      const a = T[i - 1], b = T[i];
      if (b.age > 0.09) continue;
      // taper by position along the sweep (ages arrive in batches, which would make stairs)
      const pos = i / (T.length - 1), kn = 1 - T[T.length - 1].age / 0.09, k = Math.pow(pos, 0.9) * kn;
      seg(a, b, lerp(0.98, 0.6, k), 1.04, '#c8102e');
      seg(a, b, lerp(1.0, 0.8, k), 1.04, '#ff4a5e');
      if (k > 0.55) seg(a, b, 0.94, 1.04, '#fff3f5');
    }
    ctx.restore();
    this._cx = cx; this._cy = cy;
    this.drawCracks(ctx, X, Y);
    ctx.save();
    if (this.floorY !== undefined) { ctx.beginPath(); ctx.rect(0, 0, 4096, Y(this.floorY) + 1); ctx.clip(); }
    this.drawSmears(ctx, X, Y);
    ctx.restore();
    this.drawMarks(ctx, X, Y);
    ctx.globalCompositeOperation = 'lighter';
    // stylised slash crescents
    for (const s of this.arcs) {
      const k = s.life / s.max, e = 1 - k;
      const r = s.r * (0.9 + 0.2 * e), w = s.w * k;
      const a0 = s.a0, a1 = s.a1;
      const N = 18;
      const col = s.col === 'red' ? [255, 60, 80] : [255, 255, 255];
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.75 * k})`;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const a = lerp(a0, a1, i / N), ww = Math.sin((i / N) * Math.PI) * w; ctx.lineTo(X(s.x + Math.cos(a) * (r + ww)), Y(s.y + Math.sin(a) * (r + ww))); }
      for (let i = N; i >= 0; i--) { const a = lerp(a0, a1, i / N); ctx.lineTo(X(s.x + Math.cos(a) * (r - 1)), Y(s.y + Math.sin(a) * (r - 1))); }
      ctx.fill();
      ctx.fillStyle = `rgba(255,245,248,${0.9 * k})`;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const a = lerp(a0, a1, i / N), ww = Math.sin((i / N) * Math.PI) * w * 0.35; ctx.lineTo(X(s.x + Math.cos(a) * (r + ww)), Y(s.y + Math.sin(a) * (r + ww))); }
      for (let i = N; i >= 0; i--) { const a = lerp(a0, a1, i / N); ctx.lineTo(X(s.x + Math.cos(a) * r), Y(s.y + Math.sin(a) * r)); }
      ctx.fill();
    }
    // rings
    for (const r of this.rings) {
      const k = r.life / r.max;
      ctx.strokeStyle = `rgba(${r.col[0]},${r.col[1]},${r.col[2]},${k})`; ctx.lineWidth = Math.max(1, r.w * k);
      ctx.beginPath(); ctx.ellipse(X(r.x), Y(r.y), r.r, r.r * r.flat, 0, 0, TAU); ctx.stroke();
    }
    // delayed cut lines (skill)
    for (const l of this.lines) {
      if (!l.fired) {
        const k = Math.min(1, l.t / 0.08);
        const blink = (Math.floor(l.t * 30) % 2) ? 0.9 : 0.6;
        ctx.strokeStyle = `rgba(255,70,90,${blink * k})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(l.x0), Y(l.y0)); ctx.lineTo(X(l.x1), Y(l.y1)); ctx.stroke();
      } else {
        const k = l.life / 0.35;
        ctx.strokeStyle = `rgba(255,60,80,${k})`; ctx.lineWidth = 2 + 10 * k;
        ctx.beginPath(); ctx.moveTo(X(l.x0), Y(l.y0)); ctx.lineTo(X(l.x1), Y(l.y1)); ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,244,${k})`; ctx.lineWidth = 1 + 3 * k;
        ctx.beginPath(); ctx.moveTo(X(l.x0), Y(l.y0)); ctx.lineTo(X(l.x1), Y(l.y1)); ctx.stroke();
      }
    }
    // particles
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.kind === 'spark') {
        ctx.strokeStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${k})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(X(p.x)), Math.round(Y(p.y))); ctx.lineTo(Math.round(X(p.x - p.vx * 0.025)), Math.round(Y(p.y - p.vy * 0.025))); ctx.stroke();
      } else if (p.kind === 'ember') {
        ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${k})`; ctx.fillRect(Math.round(X(p.x)), Math.round(Y(p.y)), 1, 1);
      } else if (p.kind === 'star') {
        ctx.fillStyle = `rgba(255,255,255,${k})`;
        const s = p.size * (0.6 + 0.4 * k);
        ctx.save(); ctx.translate(Math.round(X(p.x)), Math.round(Y(p.y))); ctx.rotate(p.ang);
        ctx.fillRect(-s, -1, s * 2, 2); ctx.fillRect(-1, -s * 0.6, 2, s * 1.2); ctx.restore();
      }
    }
    ctx.restore();
    // non-additive particles
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.kind === 'dust') { ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${0.8 * k})`; ctx.fillRect(Math.round(X(p.x)), Math.round(Y(p.y)), p.size, p.size); }
      else if (p.kind === 'shard') { ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${Math.min(1, k * 2)})`; ctx.fillRect(Math.round(X(p.x)), Math.round(Y(p.y)), p.size, p.size); }
    }
    // damage numbers: bitmap digits with a pop
    for (const n of this.nums) {
      const k = n.life / n.max;
      const t = 1 - k;
      const sc = n.crit ? (t < 0.08 ? 3 : 2) : (t < 0.06 ? 2 : 1);
      const txt = String(n.v) + (n.crit ? '!' : '');
      const w = txt.length * 6 * sc;
      let x0 = Math.round(X(n.x) - w / 2), y0 = Math.round(Y(n.y));
      ctx.globalAlpha = Math.min(1, k * 3);
      for (const ch of txt) {
        const g = GLYPH[ch];
        if (g) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') {
          ctx.fillStyle = '#16131b'; ctx.fillRect(x0 + c * sc - 1, y0 + r * sc - 1, sc + 2, sc + 2);
        }
        x0 += 6 * sc;
      }
      x0 = Math.round(X(n.x) - w / 2);
      for (const ch of txt) {
        const g = GLYPH[ch];
        if (g) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') {
          ctx.fillStyle = n.crit ? (r < 3 ? '#ffd1d6' : '#ff3b50') : (r < 3 ? '#ffffff' : '#d9d7e4');
          ctx.fillRect(x0 + c * sc, y0 + r * sc, sc, sc);
        }
        x0 += 6 * sc;
      }
      ctx.globalAlpha = 1;
    }
    // callout words
    ctx.font = '8px "Silkscreen", monospace'; ctx.textAlign = 'center';
    for (const w of this.words) {
      const k = w.life / w.max;
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.fillStyle = '#16131b'; ctx.fillText(w.text, Math.round(X(w.x)) + 1, Math.round(Y(w.y)) + 1);
      ctx.fillStyle = w.col; ctx.fillText(w.text, Math.round(X(w.x)), Math.round(Y(w.y)));
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  drawBullets(ctx, cx, cy, bullets) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      const enemy = b.owner === 'enemy';
      const c = enemy ? [127, 230, 255] : [255, 70, 90];
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i], k = (i + 1) / b.trail.length;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.25 * k})`;
        const r = b.r * k;
        ctx.fillRect(Math.round(t.x - cx - r), Math.round(t.y - cy - r), Math.round(r * 2), Math.round(r * 2));
      }
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.35)`;
      ctx.beginPath(); ctx.arc(b.x - cx, b.y - cy, b.r * 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    for (const b of bullets) {
      const enemy = b.owner === 'enemy';
      const X = Math.round(b.x - cx), Y = Math.round(b.y - cy), r = Math.round(b.r);
      ctx.fillStyle = enemy ? '#1a4a5c' : '#5c0a1a'; ctx.fillRect(X - r - 1, Y - r + 1, r * 2 + 2, r * 2 - 2); ctx.fillRect(X - r + 1, Y - r - 1, r * 2 - 2, r * 2 + 2);
      ctx.fillStyle = enemy ? '#7fe6ff' : '#ff3b50'; ctx.fillRect(X - r, Y - r + 1, r * 2, r * 2 - 2); ctx.fillRect(X - r + 1, Y - r, r * 2 - 2, r * 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(X - Math.ceil(r / 2), Y - Math.ceil(r / 2), Math.max(1, r), Math.max(1, r));
    }
  }
  drawScreen(ctx, vw, vh) {
    const I = this.impactF;
    if (this.flashA > 0 && !(I && I.t <= 2)) { ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1; }
    if (I) {
      const x = I.x - (this._cx || 0), y = I.y - (this._cy || 0);
      if (I.t <= 2 && !this.reduced) {
        ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, vw, vh); ctx.restore();
      }
      let sd = I.seed + (I.t >> 1) * 97;
      const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
      ctx.fillStyle = I.t <= 2 ? '#ffffff' : '#ff3b50';
      const R = Math.hypot(vw, vh);
      for (let i = 0; i < 34; i++) {
        const a = rnd() * TAU, r0 = 46 + rnd() * 70, w = 1 + rnd() * 3.5;
        const c = Math.cos(a), s = Math.sin(a);
        ctx.beginPath(); ctx.moveTo(x + c * r0, y + s * r0);
        ctx.lineTo(x + c * R - s * w * 3, y + s * R + c * w * 3); ctx.lineTo(x + c * R + s * w * 3, y + s * R - c * w * 3); ctx.fill();
      }
    }
  }
}

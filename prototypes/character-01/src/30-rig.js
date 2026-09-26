// ---------------------------------------------------------------------------
// Rig: skeleton, IK, secondary motion and the character's drawing.
// Authoring units are "base" pixels (128px tall figure); K scales everything
// to native pixels. Facing space: +x forward, +y down, origin at the ground
// point under the pelvis. Proportions follow gacha adult body types
// (~7.3 heads, legs ~52% of height, narrow waist, long shins).
// ---------------------------------------------------------------------------
const K = 1.2;
const HK = 1.3; // head scale: pixel art needs a bigger head than the body math suggests
const RIG = {
  thigh: 33 * K, shin: 31 * K, ankle: 4 * K,
  spine: 34, neck: 3.6 * K,
  upper: 18.5 * K, fore: 16.5 * K,
  handle: 22 * K, ring: 24.5 * K, bladeBase: 27 * K, blade: 104 * K,
};
const POSE_KEYS = ['rx', 'ry', 'hp', 'sp', 'hd', 'fx', 'fy', 'ft', 'bx', 'by', 'bt', 'fa', 'fr', 'ba', 'br', 'bd', 'bl', 'gp'];
const POSE_DISC = ['fe', 'be', 'bz', 'gr', 'g2', 'fc', 'hf', 'hb'];
const POSE0 = {
  rx: 0, ry: -68.6, hp: 0, sp: 0, hd: 0,
  fx: 6, fy: 0, ft: 0, bx: -6, by: 0, bt: 0,
  fa: 1.5, fr: 0.97, ba: 1.62, br: 0.97,
  bd: 2.62, bl: 1, gp: 11,
  fe: 1, be: 1, bz: 1, gr: 0, g2: 0, fc: 0, hf: 0, hb: 0,
};
// fe/be: elbow bend direction; bz: blade in front(1)/behind(0) the body;
// gr: 0 front hand, 1 two-handed, 2 back hand; g2: back arm drawn in front;
// fc: face 0 calm, 1 focused, 2 closed, 3 pain; hf/hb: hand open(0)/fist(1).
function mkPose(o) { return Object.assign({}, POSE0, o); }
function lerpPose(out, a, b, t) {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of POSE_DISC) out[k] = t < 0.5 ? a[k] : b[k];
  return out;
}
function copyPose(out, a) { for (const k of POSE_KEYS) out[k] = a[k]; for (const k of POSE_DISC) out[k] = a[k]; return out; }

const fwdV = (a) => [Math.cos(a), Math.sin(a)];
const upV = (a) => [Math.sin(a), -Math.cos(a)];

function ik2(ax, ay, tx, ty, l1, l2, bend, out) {
  const dx = tx - ax, dy = ty - ay;
  const d = Math.hypot(dx, dy) || 1e-6;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
  const ang = base - bend * A;
  out[0] = ax + Math.cos(ang) * l1; out[1] = ay + Math.sin(ang) * l1;
  out[2] = ax + (dx / d) * dd; out[3] = ay + (dy / d) * dd;
  return out;
}

// torso point: a = forward, b = up from pelvis (base units). Bends at the waist.
function torsoPt(J, a, b) {
  a *= K;
  if (b <= 6) {
    const bb = b * K, c = Math.cos(J.hp), s = Math.sin(J.hp);
    return [J.px + c * a + s * bb, J.py + s * a - c * bb];
  }
  const c0 = Math.cos(J.hp), s0 = Math.sin(J.hp);
  const wx = J.px + s0 * 6 * K, wy = J.py - c0 * 6 * K;
  const ang = lerp(J.hp, J.sp, clamp((b - 6) / 8, 0, 1));
  const c = Math.cos(ang), s = Math.sin(ang), bb = (b - 6) * K;
  return [wx + c * a + s * bb, wy + s * a - c * bb];
}
function pelvisPt(J, a, b) {
  a *= K; b *= K;
  const c = Math.cos(J.hp), s = Math.sin(J.hp);
  return [J.px + c * a + s * b, J.py + s * a - c * b];
}
function headPt(J, x, y) {
  x *= K * HK; y *= K * HK;
  const c = Math.cos(J.ha), s = Math.sin(J.ha);
  return [J.hx + c * x - s * y, J.hy + s * x + c * y];
}
// facing-space point -> spine frame (a,b) in base units
function toSpine(J, fx, fy) {
  const c = Math.cos(J.sp), s = Math.sin(J.sp);
  const dx = fx - J.px, dy = fy - J.py;
  return [(dx * c + dy * s) / K, (dx * s - dy * c) / K];
}

// Solve joints. ground(fxFacing) -> ground height offset for feet, or null in air.
function solveRig(p, ground, J = {}) {
  J.pose = p;
  J.px = p.rx * K; J.py = p.ry * K; J.hp = p.hp; J.sp = p.sp;
  const [nx, ny] = torsoPt(J, 0, RIG.spine);
  J.nx = nx; J.ny = ny;
  const na = p.sp + p.hd * 0.5;
  const [ux, uy] = upV(na);
  J.ntx = nx + ux * RIG.neck; J.nty = ny + uy * RIG.neck;
  J.ha = p.sp + p.hd;
  const [hux, huy] = upV(J.ha), [hfx, hfy] = fwdV(J.ha);
  J.hx = J.ntx + (hux * 7.6 + hfx * 0.5) * K * HK; J.hy = J.nty + (huy * 7.6 + hfy * 0.5) * K * HK;
  [J.sfx, J.sfy] = torsoPt(J, -1.2, 30.2);
  [J.sbx, J.sby] = torsoPt(J, 1.6, 30.8);
  [J.hfx, J.hfy] = pelvisPt(J, 1.4, -1.2);
  [J.hbx, J.hby] = pelvisPt(J, -1.6, -0.4);
  const tmp = [0, 0, 0, 0];
  const foot = (fx, fy, ft, hipx, hipy, key) => {
    fx *= K; fy *= K;
    let ax = fx, ay = fy - RIG.ankle;
    let g = 0;
    if (ground) { g = ground(fx); ay += g; }
    const planted = fy > -1;
    if (planted && ft > 0) ay -= Math.sin(ft) * 8 * K; // heel lift pivots on the toe
    if (planted && ft < 0) ay -= Math.sin(-ft) * 3 * K; // toe lift pivots on the heel
    ik2(hipx, hipy, ax, ay, RIG.thigh, RIG.shin, 1, tmp);
    J[key + 'kx'] = tmp[0]; J[key + 'ky'] = tmp[1]; J[key + 'ax'] = tmp[2]; J[key + 'ay'] = tmp[3];
    J[key + 'g'] = g;
  };
  foot(p.fx, p.fy, p.ft, J.hfx, J.hfy, 'F');
  foot(p.bx, p.by, p.bt, J.hbx, J.hby, 'B');
  J.Fft = p.ft; J.Bft = p.bt;
  const armLen = RIG.upper + RIG.fore;
  const [fax, fay] = fwdV(p.fa);
  const tfx = J.sfx + fax * armLen * p.fr, tfy = J.sfy + fay * armLen * p.fr;
  const [bax, bay] = fwdV(p.ba);
  let tbx = J.sbx + bax * armLen * p.br, tby = J.sby + bay * armLen * p.br;
  J.bdx = Math.cos(p.bd); J.bdy = Math.sin(p.bd); J.bl = p.bl;
  const bl = p.bl;
  if (p.gr === 2) {
    ik2(J.sbx, J.sby, tbx, tby, RIG.upper, RIG.fore, -p.be, tmp);
    J.ebx = tmp[0]; J.eby = tmp[1]; J.wbx = tmp[2]; J.wby = tmp[3];
    J.gx = J.wbx + J.bdx * 2 * K; J.gy = J.wby + J.bdy * 2 * K;
    ik2(J.sfx, J.sfy, tfx, tfy, RIG.upper, RIG.fore, -p.fe, tmp);
    J.efx = tmp[0]; J.efy = tmp[1]; J.wfx = tmp[2]; J.wfy = tmp[3];
  } else {
    ik2(J.sfx, J.sfy, tfx, tfy, RIG.upper, RIG.fore, -p.fe, tmp);
    J.efx = tmp[0]; J.efy = tmp[1]; J.wfx = tmp[2]; J.wfy = tmp[3];
    // the fist sits a little past the wrist along the forearm
    J.gx = J.wfx + (J.wfx - J.efx) / RIG.fore * 2.2 * K; J.gy = J.wfy + (J.wfy - J.efy) / RIG.fore * 2.2 * K;
    if (p.gr === 1) { tbx = J.gx - J.bdx * 7.5 * K * bl; tby = J.gy - J.bdy * 7.5 * K * bl; }
    ik2(J.sbx, J.sby, tbx, tby, RIG.upper, RIG.fore, -p.be, tmp);
    J.ebx = tmp[0]; J.eby = tmp[1]; J.wbx = tmp[2]; J.wby = tmp[3];
  }
  J.pmx = J.gx - J.bdx * p.gp * K * bl; J.pmy = J.gy - J.bdy * p.gp * K * bl;
  J.rgx = J.pmx + J.bdx * RIG.ring * bl; J.rgy = J.pmy + J.bdy * RIG.ring * bl;
  J.bbx = J.pmx + J.bdx * RIG.bladeBase * bl; J.bby = J.pmy + J.bdy * RIG.bladeBase * bl;
  J.tpx = J.bbx + J.bdx * RIG.blade * bl; J.tpy = J.bby + J.bdy * RIG.blade * bl;
  return J;
}

// ---------------------------------------------------------------------------
// Secondary motion. Chains live in world space so they react to real motion.
// ---------------------------------------------------------------------------
class Chain {
  constructor(n, seg, opt) {
    this.n = n; this.seg = seg;
    this.x = new Float64Array(n); this.y = new Float64Array(n);
    this.ox = new Float64Array(n); this.oy = new Float64Array(n);
    this.stiff = opt.stiff || [0.3, 0.02];
    this.damp = opt.damp ?? 0.9;
    this.grav = opt.grav ?? 900;
    this.drag = opt.drag ?? 1;
    this.rest = opt.rest ?? Math.PI / 2;
    this.curl = opt.curl || 0;
    this.init = false;
  }
  reset(ax, ay, dirX) {
    const a = dirX > 0 ? this.rest : Math.PI - this.rest;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.ox[i] = ax + Math.cos(a) * this.seg * i;
      this.y[i] = this.oy[i] = ay + Math.sin(a) * this.seg * i;
    }
    this.init = true;
  }
  step(ax, ay, frameAng, dirX, dt, dtPrev, env) {
    if (!this.init) this.reset(ax, ay, dirX);
    const n = this.n, X = this.x, Y = this.y, OX = this.ox, OY = this.oy;
    X[0] = ax; Y[0] = ay; OX[0] = ax; OY[0] = ay;
    const k = dtPrev > 0 ? dt / dtPrev : 1;
    const dt2 = dt * dt;
    const wind = env.wind || 0;
    for (let i = 1; i < n; i++) {
      const vx = (X[i] - OX[i]) * this.damp * k, vy = (Y[i] - OY[i]) * this.damp * k;
      OX[i] = X[i]; OY[i] = Y[i];
      const f = i / (n - 1);
      X[i] += vx + wind * this.drag * (0.4 + f) * dt2;
      Y[i] += vy + this.grav * dt2 + (env.lift || 0) * this.drag * f * dt2;
    }
    const restA = dirX > 0 ? this.rest + frameAng : Math.PI - this.rest - frameAng;
    const L = this.seg;
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < n; i++) {
        const s = lerp(this.stiff[0], this.stiff[1], (i - 1) / Math.max(1, n - 2));
        const ra = restA + this.curl * (i / n) * (dirX > 0 ? 1 : -1);
        const tx = X[i - 1] + Math.cos(ra) * L, ty = Y[i - 1] + Math.sin(ra) * L;
        X[i] += (tx - X[i]) * s; Y[i] += (ty - Y[i]) * s;
        const dx = X[i] - X[i - 1], dy = Y[i] - Y[i - 1];
        const d = Math.hypot(dx, dy) || 1e-6;
        X[i] = X[i - 1] + (dx / d) * L; Y[i] = Y[i - 1] + (dy / d) * L;
        if (env.collide) env.collide(X, Y, i);
      }
    }
  }
}

// Damped spring for small masses (chest, skirt hem), facing space, native px.
class Spring2 {
  constructor(k, c, lim) { this.k = k; this.c = c; this.lim = lim; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; }
  step(ax, ay, tx, ty, dt) {
    this.vx += (-(this.x - tx) * this.k - this.vx * this.c - ax) * dt;
    this.vy += (-(this.y - ty) * this.k - this.vy * this.c - ay) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const L = this.lim;
    if (this.x > L) { this.x = L; this.vx *= -0.3; } if (this.x < -L) { this.x = -L; this.vx *= -0.3; }
    if (this.y > L) { this.y = L; this.vy *= -0.3; } if (this.y < -L) { this.y = -L; this.vy *= -0.3; }
  }
}

// skirt hem rest points (pelvis frame, base units: a forward, b up)
const HEM = [[-15.0, -10.6], [-11.2, -13.2], [-5.8, -14.6], [0.2, -15.0], [5.8, -14.6], [10.8, -13.0], [14.4, -10.4]];
// hair roots (head-local), node counts, widths
const HAIR = [
  { at: [-3.4, -8.8], len: 7, w0: 7, wm: 8.5, tone: 's' },
  { at: [-6.6, -5.0], len: 9, w0: 7.5, wm: 9.5, tone: 'b' },
  { at: [-7.6, -0.6], len: 10, w0: 7.5, wm: 9, tone: 's' },
  { at: [-6.6, 3.4], len: 9, w0: 7, wm: 8, tone: 'b' },
  { at: [-4.4, 5.6], len: 8, w0: 6, wm: 7, tone: 'd' },
  { at: [-2.2, 6.4], len: 5, w0: 4.5, wm: 5.5, tone: 'b' },
];
// cloak tails hang from the back cape (torso frame)
const TAILS = [
  { at: [-13.6, 24], len: 8, w0: 10, m: 'cloak' },
  { at: [-14.0, 18], len: 11, w0: 10.5, m: 'cloakS' },
  { at: [-12.4, 13], len: 9, w0: 9.5, m: 'cloak' },
  { at: [-8.6, 11.6], len: 10, w0: 8.5, m: 'lining' },
];
const SEG_HAIR = 7.8 * K, SEG_TAIL = 7.0 * K;

class Heroine {
  constructor() {
    this.hair = HAIR.map((h, i) => new Chain(h.len, SEG_HAIR * (i === 5 ? 0.85 : 1), { stiff: [0.44, 0.03], damp: 0.93, grav: 760, drag: 1.1, rest: Math.PI / 2 + 0.05, curl: 0.1 }));
    this.tails = TAILS.map((t, i) => new Chain(t.len, SEG_TAIL, { stiff: [0.36, 0.02], damp: 0.94, grav: 640, drag: 1.6, rest: Math.PI / 2 + 0.3 - i * 0.12, curl: 0.12 }));
    this.ribbon = [0, 1].map((i) => new Chain(4, 3.2 * K, { stiff: [0.25, 0.1], damp: 0.9, grav: 600, drag: 1.8, rest: Math.PI / 2 + 0.55 + i * 0.35 }));
    this.tie = new Chain(4, 3.3 * K, { stiff: [0.35, 0.2], damp: 0.88, grav: 800, drag: 0.8, rest: Math.PI / 2 - 0.05 });
    this.hem = HEM.map(() => new Spring2(240, 15, 9 * K));
    this.chest = new Spring2(300, 10, 1.9 * K);
    this.prevPel = null; this.prevVel = [0, 0];
    this.prevChest = null; this.prevChestVel = [0, 0];
    this.dtPrev = 1 / 60;
    this.blink = 0; this.blinkT = 2;
  }
  simulate(J, rootX, rootY, dir, dt, env) {
    if (dt <= 0) return;
    const W = (x, y) => [rootX + x * dir, rootY + y];
    const dtPrev = this.dtPrev; this.dtPrev = dt;
    const pel = W(J.px, J.py);
    let ax = 0, ay = 0, vx = 0, vy = 0;
    if (this.prevPel) {
      vx = (pel[0] - this.prevPel[0]) / dt; vy = (pel[1] - this.prevPel[1]) / dt;
      ax = (vx - this.prevVel[0]) / dt; ay = (vy - this.prevVel[1]) / dt;
      if (Math.abs(vx) > 2500 || Math.abs(vy) > 2500) { ax = ay = 0; vx = vy = 0; }
    }
    this.prevPel = pel; this.prevVel = [vx, vy];
    const fvx = vx * dir, fax = clamp(ax * dir, -6000, 6000), fay = clamp(ay, -6000, 6000);
    for (let i = 0; i < this.hem.length; i++) {
      const s = this.hem[i];
      const side = (i / (this.hem.length - 1)) * 2 - 1;
      const tx = clamp(-fvx * 0.012, -5, 5) * K * (0.6 + 0.4 * Math.abs(side));
      const ty = clamp(-Math.abs(fvx) * 0.004 - Math.max(0, vy) * 0.005, -3.2, 0) * K;
      s.step(fax * 0.0022, fay * 0.0016, tx, ty, dt);
    }
    const [cx, cy] = torsoPt(J, 9, 21);
    const cw = W(cx, cy);
    let cax = 0, cay = 0;
    if (this.prevChest) {
      const cvx = (cw[0] - this.prevChest[0]) / dt, cvy = (cw[1] - this.prevChest[1]) / dt;
      cax = (cvx - this.prevChestVel[0]) / dt; cay = (cvy - this.prevChestVel[1]) / dt;
      if (Math.abs(cvx) > 2500 || Math.abs(cvy) > 2500) cax = cay = 0;
      this.prevChestVel = [cvx, cvy];
    }
    this.prevChest = cw;
    this.chest.step(clamp(cax * dir, -8000, 8000) * 0.0011, clamp(cay, -8000, 8000) * 0.0016, 0, 0, dt);

    const groundAt = env.groundY || (() => 1e9);
    // back plane of the body in spine-frame base units (hair & cloak stay behind it)
    const backEdge = (b) => (b > 30 ? -6.5 : b > 20 ? lerp(-8.6, -6.5, (b - 20) / 10) : b > 12 ? lerp(-7.4, -8.6, (b - 12) / 8) : b > 3 ? lerp(-9.6, -7.4, (b - 3) / 9) : b > -6 ? lerp(-12.8, -9.6, (b + 6) / 9) : lerp(-15, -12.8, clamp((b + 16) / 10, 0, 1)));
    const c = Math.cos(J.sp), s = Math.sin(J.sp);
    const mkCollide = (margin, soft) => (X, Y, i) => {
      const [a, b] = toSpine(J, (X[i] - rootX) * dir, Y[i] - rootY);
      if (b > -18 && b < 42) {
        const lim = backEdge(b) - margin;
        if (a > lim) {
          const push = (lim - a) * soft * K;
          X[i] += c * push * dir; Y[i] += s * push;
        }
      }
      const gy = groundAt(X[i]) - 1;
      if (Y[i] > gy) Y[i] = gy;
    };
    const hairEnv = { wind: env.wind * 0.8, lift: env.lift || 0, collide: mkCollide(1.2, 0.35) };
    const tailEnv = { wind: env.wind, lift: env.lift || 0, collide: mkCollide(2.2, 0.3) };
    for (let i = 0; i < HAIR.length; i++) {
      const [hx, hy] = headPt(J, HAIR[i].at[0], HAIR[i].at[1]);
      const w = W(hx, hy);
      this.hair[i].step(w[0], w[1], J.ha * 0.5, dir, dt, dtPrev, hairEnv);
    }
    for (let i = 0; i < TAILS.length; i++) {
      const [tx, ty] = torsoPt(J, TAILS[i].at[0], TAILS[i].at[1]);
      const w = W(tx, ty);
      this.tails[i].step(w[0], w[1], J.sp * 0.6, dir, dt, dtPrev, tailEnv);
    }
    const [kx, ky] = headPt(J, -6.4, -5.6);
    const kw = W(kx, ky);
    for (const r of this.ribbon) r.step(kw[0], kw[1], J.ha * 0.3, dir, dt, dtPrev, { wind: env.wind * 1.2, lift: env.lift || 0 });
    const [tx0, ty0] = torsoPt(J, 6.6 + this.chest.x / K, 29.6);
    const tw = W(tx0, ty0);
    const ch = this.chest;
    this.tie.step(tw[0], tw[1], J.sp, dir, dt, dtPrev, {
      wind: env.wind * 0.5,
      collide: (X, Y, i) => {
        const [a, b] = toSpine(J, (X[i] - rootX) * dir, Y[i] - rootY);
        const front = b > 25 ? lerp(9.8, 6.6, (b - 25) / 5) : b > 19.5 ? 12.2 + ch.x / K : b > 16 ? lerp(7.4, 12.2, (b - 16) / 3.5) : 6.2;
        if (a < front + 0.9) { const push = (front + 0.9 - a) * K; X[i] += c * push * dir; Y[i] += s * push; }
      },
    });
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = rand(2.2, 4.8); }
    if (this.blink > 0) this.blink -= dt;
  }
  resetPhysics() {
    for (const c of [...this.hair, ...this.tails, ...this.ribbon, this.tie]) c.init = false;
    this.prevPel = null; this.prevChest = null;
    for (const h of this.hem) { h.x = h.y = h.vx = h.vy = 0; }
  }
}

// Costume variants the preview can switch between.
const COSTUMES = {
  ref: { name: 'Reference', top: 'shirt', legs: 'sock', halo: true },
  split: { name: 'Death over angel', top: 'blouseDk', legs: 'sockW', halo: true },
  mono: { name: 'All dark', top: 'blouseDk', legs: 'sock', halo: true },
};
let COSTUME = COSTUMES.ref;

// ---------------------------------------------------------------------------
// The figure. Every mass is ONE contour through landmarks (see 25-shape.js).
// Entries: [bone, t along bone, offset across in base units (+ = front), sharp?]
// 'J' = the joint between the two bones, offset along their bisector.
// These tables are the formula: change a number, the silhouette follows.
// ---------------------------------------------------------------------------
const FIG = {
  legFront: [['T', -0.14, 3.0], ['T', 0.0, 6.0], ['T', 0.2, 6.9], ['T', 0.5, 6.2], ['T', 0.8, 5.0], ['J', 0, 4.1], ['S', 0.14, 3.6], ['S', 0.5, 3.0], ['S', 0.84, 2.3], ['S', 1.0, 2.1], ['S', 1.08, 0]],
  legBack: [['S', 1.0, -2.1], ['S', 0.86, -2.4], ['S', 0.58, -3.4], ['S', 0.3, -5.0], ['S', 0.1, -4.3], ['J', 0, -3.7], ['T', 0.8, -4.8], ['T', 0.5, -6.3], ['T', 0.2, -7.8], ['T', 0.0, -8.4], ['T', -0.14, -5.0]],
  thighW: [[6.0, 6.8, 6.1, 5.1, 4.1], [8.4, 7.5, 6.3, 5.0, 3.8]],
  shinW: [[3.8, 3.4, 3.0, 2.6, 2.1], [4.3, 5.0, 3.7, 2.7, 2.1]],
  sockTop: 0.74,
  armFront: [['U', -0.1, 2.9], ['U', 0.2, 3.2], ['U', 0.55, 2.6], ['U', 0.86, 2.3], ['J', 0, 2.2], ['F', 0.24, 2.5], ['F', 0.55, 2.1], ['F', 0.78, 2.3], ['F', 1.0, 3.3, 0]],
  armBack: [['F', 1.0, -3.1, 0], ['F', 0.78, -2.1], ['F', 0.45, -2.1], ['F', 0.12, -2.4], ['J', 0, -2.4], ['U', 0.8, -2.4], ['U', 0.45, -2.8], ['U', 0.12, -3.1], ['U', -0.14, -1.8]],
  armW: [[3.0, 3.2, 2.6, 2.3, 2.2], [3.1, 2.9, 2.6, 2.4, 2.3]],
  foreW: [[2.4, 2.4, 2.1, 2.3, 3.3], [2.4, 2.3, 2.1, 2.1, 3.1]],
  // torso in the spine frame: [a forward, b up]
  torsoFront: [[7.2, -5], [7.4, 1.5], [6.8, 6.5], [5.8, 11.5], [6.5, 15.2], [8.7, 17.2], [11.2, 19.0], [12.3, 21.2], [11.7, 23.4], [9.8, 25.6], [8.0, 28.0], [6.5, 30.9], [4.4, 33.2], [3.2, 34.4]],
  torsoBack: [[-3.2, 34.4], [-6.0, 32.4], [-7.6, 28.5], [-7.8, 23], [-7.0, 18], [-5.7, 13], [-6.4, 8.5], [-8.8, 3.4], [-11.4, -2.4], [-11.2, -7.4], [-8, -10.5], [0, -11]],
  // face in head space (x forward, y down), chin is the sharp point
  face: [[-4.4, -3.6], [-3.6, -8.0], [1.0, -9.6], [4.9, -7.2], [6.0, -3.6], [6.1, -0.8], [6.6, 1.3], [6.1, 2.8], [5.4, 4.8], [4.0, 7.0], [2.5, 8.7, 0], [0.9, 8.4], [-1.2, 7.0], [-3.0, 5.0], [-4.4, 2.4], [-4.8, -0.4]],
  bangs: [[-5.4, -4.2], [-6.0, -8.8], [-3.2, -12.2], [1.8, -12.6], [5.9, -9.4], [7.0, -5.0], [7.1, -2.8, 0], [6.1, -3.3, 0], [5.2, -2.6, 0], [4.3, -3.6, 0], [3.2, -2.8, 0], [2.1, -3.8, 0], [1.0, -3.0, 0], [-0.1, -3.9, 0], [-1.3, -3.4, 0], [-2.7, -5.2]],
};
let LMK_DEBUG = null; // set to [] to collect landmark points for the formula overlay
function contourPts(list, bones) {
  const out = [];
  if (LMK_DEBUG) for (const b of Object.values(bones)) LMK_DEBUG.push({ bone: [b.ax, b.ay, b.bx, b.by] });
  for (const [b, t, off, sharp] of list) {
    const q = b === 'J' ? lmkJoint(bones.J1, bones.J2, off) : lmk(bones[b], t, off);
    if (sharp === 0) q.push(0);
    out.push(q);
    if (LMK_DEBUG) LMK_DEBUG.push({ p: [q[0], q[1]], j: b === 'J' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawing. Rendered facing right into a PixBuf; the blit flips.
// ---------------------------------------------------------------------------
const G = { tails: 1, capeB: 2, halo: 3, hair: 4, armB: 5, bladeB: 6, legB: 7, shoeB: 8, legF: 9, shoeF: 10, torso: 11, collar: 12, corset: 13, skirt: 14, tie: 15, capelet: 16, armB2: 17, neck: 18, face: 19, hairF: 20, bow: 21, armF: 22, cap: 23, blade: 24, handF: 25 };

function drawHeroine(buf, J, hero, ox, oy, rootX, rootY, dir, opts = {}) {
  const p = J.pose;
  const T = (a, b) => { const q = torsoPt(J, a, b); return [q[0] + ox, q[1] + oy]; };
  const Pp = (a, b) => { const q = pelvisPt(J, a, b); return [q[0] + ox, q[1] + oy]; };
  const Hd = (x, y) => { const q = headPt(J, x, y); return [q[0] + ox, q[1] + oy]; };
  const toB = (wx, wy) => [(wx - rootX) * dir + ox, wy - rootY + oy];
  const cS = Math.cos(J.sp), sS = Math.sin(J.sp);
  const spineAB = (x, y) => { const dx = x + 0.5 - (J.px + ox), dy = y + 0.5 - (J.py + oy); return [(dx * cS + dy * sS) / K, (dx * sS - dy * cS) / K]; };
  const cP = Math.cos(J.hp), sP = Math.sin(J.hp);
  const pelvisAB = (x, y) => { const dx = x + 0.5 - (J.px + ox), dy = y + 0.5 - (J.py + oy); return [(dx * cP + dy * sP) / K, (dx * sP - dy * cP) / K]; };
  const cH = Math.cos(J.ha), sH = Math.sin(J.ha);
  const headXY = (x, y) => { const dx = x + 0.5 - (J.hx + ox), dy = y + 0.5 - (J.hy + oy); return [(dx * cH + dy * sH) / (K * HK), (-dx * sH + dy * cH) / (K * HK)]; };
  const ex = hero.chest.x / K, ey = hero.chest.y / K;
  const TM = M[COSTUME.top], SM = M[COSTUME.legs];

  // ---- cape tails: tattered panels, one smooth outline each
  for (let t = 0; t < TAILS.length; t++) {
    const chn = hero.tails[t];
    const sp = [], ws = [];
    for (let i = 0; i < chn.n; i++) {
      sp.push(toB(chn.x[i], chn.y[i]));
      const f = i / (chn.n - 1);
      let w = f < 0.5 ? lerp(TAILS[t].w0, TAILS[t].w0 * 0.82, f / 0.5) : f < 0.8 ? lerp(TAILS[t].w0 * 0.82, TAILS[t].w0 * 0.42, (f - 0.5) / 0.3) : lerp(TAILS[t].w0 * 0.42, 0.3, (f - 0.8) / 0.2);
      ws.push(w * K);
    }
    const out = ribbonOutline(sp, ws, 'point');
    // notch the edges to read as torn cloth
    for (let i = 0; i < out.length; i++) { const f = (i % chn.n) / chn.n; if (f > 0.4 && i % 3 === 1) { out[i] = [out[i][0], out[i][1], 0]; } }
    const m = TAILS[t].m;
    const col = m === 'lining' ? M.lining.s : m === 'cloakS' ? M.cloak.s : M.cloak.b;
    buf.poly(spline(out, true, 3), col, G.tails);
  }
  // ---- back cape
  buf.poly(spline([T(-3.6, 40.5), T(-8.6, 37.4), T(-13.2, 31.5), T(-14.6, 24), T(-14.4, 17), T(-12.4, 12.4), T(-8, 11.4), T(-3, 12.6), T(1, 20), T(2, 30), T(1.2, 38.5)], true, 3), (x, y) => {
    const [a] = spineAB(x, y);
    return a < -11.5 ? M.cloak.b : M.cloak.s;
  }, G.capeB);
  // ---- halo
  if (COSTUME.halo) {
    const hq = Hd(-3.4, -14.0);
    const t = (opts.time || 0) * 1.3;
    buf.ellipse(hq[0], hq[1] + Math.sin(t) * 0.8, 9.6 * K, 3.0 * K, J.ha - 0.3, (u, v) => {
      const d = Math.hypot(u, v);
      if (d < 0.8) return 0;
      return v < -0.3 ? M.red.l : M.red.s;
    }, G.halo);
  }
  // ---- long hair: smooth strands that merge into one mass
  for (let s = 0; s < HAIR.length; s++) {
    const chn = hero.hair[s];
    const sp = [], ws = [];
    for (let i = 0; i < chn.n; i++) {
      sp.push(toB(chn.x[i], chn.y[i]));
      const f = i / (chn.n - 1);
      const w = f < 0.22 ? lerp(HAIR[s].w0, HAIR[s].wm, f / 0.22) : f < 0.62 ? HAIR[s].wm : HAIR[s].wm * Math.pow(1 - (f - 0.62) / 0.38, 0.9);
      ws.push(Math.max(0.5, w * K * 1.12));
    }
    const tn = HAIR[s].tone;
    buf.poly(spline(ribbonOutline(sp, ws, 'point'), true, 3), tn === 's' ? M.hair.s : tn === 'd' ? M.hair.d : M.hair.b, G.hair);
  }
  // strand lines: a dark parting and a sheen along the outer strands
  for (const [si, i0, i1, off, c1, c2] of [[1, 1, 6, -1.4, M.hair.l, M.hair.h], [3, 1, 5, -1.1, M.hair.l, M.hair.l], [2, 2, 7, 1.6, M.hair.d, M.hair.d]]) {
    const chn = hero.hair[si];
    const sp = [];
    for (let i = i0; i <= Math.min(i1, chn.n - 1); i++) { const q = toB(chn.x[i], chn.y[i]); sp.push([q[0] + off, q[1]]); }
    const pl = spline(sp, false, 3);
    for (let i = 0; i + 3 < pl.length; i += 2) buf.line(pl[i], pl[i + 1], pl[i + 2], pl[i + 3], i < 6 ? c2 : c1, G.hair);
  }

  const drawHand = (wx, wy, ux, uy, mode, g, dim) => {
    const ang = Math.atan2(uy, ux);
    const H = (x, y) => lmkFrame(wx, wy, ang, x, y);
    const pts = mode === 1
      ? [H(-0.6, -2.3), H(1.8, -2.7), H(3.9, -1.9), H(4.6, 0.1), H(3.8, 2.2), H(1.2, 2.6), H(-0.7, 2.0)]
      : [H(-0.5, -2.0), H(2.0, -2.4), H(4.6, -1.7), H(6.3, -0.9), H(6.6, 0.1, 0), H(5.1, 0.7), H(3.4, 1.8), H(1.0, 2.3), H(-0.5, 1.8)];
    buf.poly(spline(pts, true, 3), (x, y) => {
      const rx = (x + 0.5 - wx) / K, ry = (y + 0.5 - wy) / K;
      const ly = -Math.sin(ang) * rx + Math.cos(ang) * ry;
      const lx = Math.cos(ang) * rx + Math.sin(ang) * ry;
      if (mode === 1 && lx > 3.0 && lx < 3.8) return M.skin.s; // knuckles
      return ly > 0.9 || dim > 0.3 ? M.skin.s : M.skin.b;
    }, g);
  };

  const drawArm = (sx, sy, exx, eyy, wx, wy, g, handMode, dim) => {
    const U = bone(sx, sy, exx, eyy), F = bone(exx, eyy, wx, wy);
    const pts = contourPts([...FIG.armFront, ...FIG.armBack], { U, F, J1: U, J2: F });
    buf.poly(spline(pts, true, 4), (x, y) => {
      const rx = x + 0.5 - U.ax, ry = y + 0.5 - U.ay;
      const tu = (rx * U.ux + ry * U.uy) / U.L;
      if (tu < 0.98) {
        const [, s] = boneShadeCoords(U, x, y, FIG.armW[0], FIG.armW[1]);
        return tone(M.sleeve, s * 0.7 + 0.18 - dim);
      }
      const [t, s] = boneShadeCoords(F, x, y, FIG.foreW[0], FIG.foreW[1]);
      if (t > 0.93) return M.red.b; // cuff trim
      if (t > 0.8) return s > 0.3 ? M.sleeve.l : M.sleeve.b;
      if (t < 0.08 && s < 0) return M.sleeve.d; // elbow crease
      return tone(M.sleeve, s * 0.7 + 0.18 - dim);
    }, g);
    drawHand(wx + F.ux * 0.6 * K, wy + F.uy * 0.6 * K, F.ux, F.uy, handMode, g, dim);
  };

  const drawBlade = (g) => {
    const bl = J.bl;
    const dx = J.bdx, dy = J.bdy, nx = -dy, ny = dx;
    const pm = [J.pmx + ox, J.pmy + oy];
    const hEnd = [pm[0] + dx * RIG.handle * bl, pm[1] + dy * RIG.handle * bl];
    buf.capsule(pm[0], pm[1], 1.9 * K, hEnd[0], hEnd[1], 1.7 * K, (t) => ((Math.floor(t * 8) % 2) ? M.red.s : M.metal.s), g);
    const bb = [J.bbx + ox, J.bby + oy];
    const Lb = RIG.blade * bl;
    const edge = [], spine = [];
    const N = 14;
    const bendAt = (u) => -u * u * 7 * K * bl;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const cx = bb[0] + dx * Lb * u + nx * bendAt(u), cy = bb[1] + dy * Lb * u + ny * bendAt(u);
      let wE = (u < 0.86 ? lerp(3.4, 2.5, u) : lerp(2.5, 0, (u - 0.86) / 0.14)) * K;
      let wS = (u < 0.9 ? lerp(2.1, 1.6, u) : lerp(1.6, 0, (u - 0.9) / 0.1)) * K;
      if (bl < 0.6) { wE *= 1.25; wS *= 1.25; }
      edge.push([cx + nx * wE, cy + ny * wE]);
      spine.push([cx - nx * wS, cy - ny * wS]);
    }
    const P = [];
    for (const q of edge) P.push(q[0], q[1]);
    for (let i = spine.length - 1; i >= 0; i--) P.push(spine[i][0], spine[i][1]);
    const glint = opts.glint ?? -1;
    buf.poly(P, (x, y) => {
      const rx = x + 0.5 - bb[0], ry = y + 0.5 - bb[1];
      const along = (rx * dx + ry * dy) / Lb;
      const across = (rx * nx + ry * ny - bendAt(along)) / K;
      if (glint >= 0 && Math.abs(along - glint) < 0.03) return C.white;
      if (across > 1.5) return M.red.l;
      if (across < -0.7) return M.red.s;
      return M.red.b;
    }, g);
    for (let i = 1; i < edge.length - 1; i++) {
      const a = edge[i], b = edge[i + 1];
      buf.line(a[0] - nx, a[1] - ny, b[0] - nx, b[1] - ny, i % 4 === 1 ? M.red.h : M.red.l, g);
    }
    const rc = [J.rgx + ox, J.rgy + oy];
    const rr = 5.4 * K;
    buf.ellipse(rc[0], rc[1], rr, rr, 0, (u, v) => {
      const d = Math.hypot(u, v);
      if (d < 0.6) return 0;
      return v < -0.25 ? M.red.l : d > 0.86 ? M.metal.l : M.red.b;
    }, g);
  };

  const drawLeg = (hip, knee, ankle, ft, g, gShoe, back) => {
    const dim = back ? 0.42 : 0;
    const Tb = bone(hip[0], hip[1], knee[0], knee[1]), Sb = bone(knee[0], knee[1], ankle[0], ankle[1]);
    const pts = contourPts([...FIG.legFront, ...FIG.legBack], { T: Tb, S: Sb, J1: Tb, J2: Sb });
    const st = FIG.sockTop;
    buf.poly(spline(pts, true, 4), (x, y) => {
      const rx = x + 0.5 - Tb.ax, ry = y + 0.5 - Tb.ay;
      const tr = (rx * Tb.ux + ry * Tb.uy) / Tb.L;
      if (tr < 1.0) {
        const [t, s] = boneShadeCoords(Tb, x, y, FIG.thighW[0], FIG.thighW[1]);
        const band = st + 0.035 * s * s; // the band wraps the thigh
        if (t < band - 0.005) return tone(M.skin, s * 0.5 + 0.2 - dim - (t > band - 0.07 ? 0.1 : 0));
        if (t < band + 0.045) return s > 0.25 ? M.red.l : M.red.b;
        return tone(SM, s * 0.62 + 0.1 - dim);
      }
      const [t, s] = boneShadeCoords(Sb, x, y, FIG.shinW[0], FIG.shinW[1]);
      if (t < 0.14 && s > 0.35 && !back) return SM.l; // kneecap highlight
      return tone(SM, s * 0.62 + 0.1 - dim);
    }, g);
    // garter ring on the near thigh
    if (!back) {
      const a0 = lmk(Tb, 0.5, 6.35), a1 = lmk(Tb, 0.535, 6.3), b1 = lmk(Tb, 0.535, -6.45), b0 = lmk(Tb, 0.5, -6.5);
      buf.poly([...a0, ...a1, ...b1, ...b0], (x, y) => {
        const [, s] = boneShadeCoords(Tb, x, y, FIG.thighW[0], FIG.thighW[1]);
        return s > 0.3 ? M.red.l : s < -0.4 ? M.red.s : M.red.b;
      }, g);
    }
    // loafer: its own outline so it reads against the sock
    const c = Math.cos(ft), s = Math.sin(ft);
    const A = ankle;
    const F = (x, y, sh) => { const q = [A[0] + (c * x - s * y) * K, A[1] + (s * x + c * y) * K]; if (sh === 0) q.push(0); return q; };
    const shoe = [F(-2.5, -1.3), F(1.6, -1.6), F(3.9, -0.4), F(6.8, 1.0), F(8.0, 2.3), F(7.6, 3.3, 0), F(-0.6, 3.4), F(-1.2, 4.0, 0), F(-3.0, 4.0, 0), F(-3.3, 0.6)];
    buf.poly(spline(shoe, true, 3), (x, y) => {
      const rx = (x + 0.5 - A[0]) / K, ry = (y + 0.5 - A[1]) / K;
      const fx = c * rx + s * ry, fy = -s * rx + c * ry;
      if (fy > 3.0) return M.shoe.s;
      if (fx > 3 && fx < 6.8 && fy < 1.3 && fy > -0.2 && !back) return M.shoe.h;
      if (fy < 0.2) return back ? M.shoe.b : M.shoe.l;
      return M.shoe.b;
    }, gShoe);
  };

  // ---- back arm (behind body) and a blade held behind
  const armBehind = p.g2 !== 1;
  if (armBehind) drawArm(J.sbx + ox, J.sby + oy, J.ebx + ox, J.eby + oy, J.wbx + ox, J.wby + oy, G.armB, p.gr === 2 ? 1 : p.hb, 0.45);
  if (p.bz === 0) drawBlade(G.bladeB);

  // ---- legs
  drawLeg([J.hbx + ox, J.hby + oy], [J.Bkx + ox, J.Bky + oy], [J.Bax + ox, J.Bay + oy], J.Bft, G.legB, G.shoeB, true);
  drawLeg([J.hfx + ox, J.hfy + oy], [J.Fkx + ox, J.Fky + oy], [J.Fax + ox, J.Fay + oy], J.Fft, G.legF, G.shoeF, false);

  // ---- torso
  const front = FIG.torsoFront.map(([a, b], i) => (b > 16 && b < 26 ? [a + ex * (1 - Math.abs(b - 21) / 5), b + ey * (1 - Math.abs(b - 21) / 5)] : [a, b]));
  const frontAt = (b) => {
    for (let i = 1; i < front.length; i++) if (front[i][1] >= b) { const [a0, b0] = front[i - 1], [a1, b1] = front[i]; return lerp(a0, a1, (b - b0) / (b1 - b0 || 1)); }
    return 3;
  };
  buf.poly(spline([...front, ...FIG.torsoBack].map(([a, b]) => T(a, b)), true, 4), (x, y) => {
    const [a, b] = spineAB(x, y);
    if (a < -4.4) return TM.s;
    if (b > 15 && b < 18.2 && a > 3.4) return TM.s; // under-bust shade
    if (b > 17.5 && b < 30 && frontAt(b) - a < 1.4) return TM.l; // lit front edge
    if (b > 19.6 && b < 23.2 && a > 8.8 && a < 10.8) return TM.l;
    if (b > 21 && b < 22.4 && a > 9.8 && a < 10.9) return TM.h;
    if (a > -1.2 && a < -0.2 && b > 18 && b < 29) return TM.s; // side fold
    return TM.b;
  }, G.torso);
  // sailor collar tips
  buf.poly(spline([T(1.6, 34.6), T(5.8, 33.6), T(7.4, 30.2, 0), T(4.6, 30.8), T(2.2, 32.2)].map((q, i) => (i === 2 ? [...q, 0] : q)), true, 3), M.shirt.l, G.collar);
  // corset
  buf.poly(spline([T(7.0, 15.0), T(6.1, 11.5), T(6.9, 6.5), T(7.6, 4.8), T(-8.9, 4.8), T(-6.5, 8.5), T(-5.9, 13), T(-6.6, 16.5), T(-1, 17.6), T(3.4, 16.4)], true, 3), (x, y) => {
    const [a, b] = spineAB(x, y);
    if (a > 3.4 && ((Math.round(b * 1.2) + Math.round(a)) % 3 === 0)) return M.red.s; // lacing
    if (a < -4.6) return M.skirt.d;
    return b > 13.6 ? M.skirt.l : M.skirt.b;
  }, G.corset);
  // ---- skirt: smooth hips, pleated hem
  {
    const hemPts = HEM.map(([a, b], i) => Pp(a + hero.hem[i].x / K, b + hero.hem[i].y / K));
    const thighs = [[J.hfx, J.hfy, J.Fkx, J.Fky], [J.hbx, J.hby, J.Bkx, J.Bky]];
    for (const q of hemPts) {
      for (const [ax, ay, kx, ky] of thighs) {
        const Ax = ax + ox, Ay = ay + oy, Kx = kx + ox, Ky = ky + oy;
        const dx = Kx - Ax, dy = Ky - Ay, L2 = dx * dx + dy * dy || 1;
        const t = clamp(((q[0] - Ax) * dx + (q[1] - Ay) * dy) / L2, 0, 1);
        const cx = Ax + dx * t, cy = Ay + dy * t;
        const exx = q[0] - cx, eyy = q[1] - cy, d = Math.hypot(exx, eyy), r = lerp(8.2, 5.0, t) * K;
        if (d < r && t > 0.05) { const k = (r - d) / (d || 1); q[0] += exx * k; q[1] += eyy * k; }
      }
    }
    const pts = [Pp(7.6, 5.8), Pp(-8.8, 5.8), Pp(-11.4, 1.2), Pp(-13.3, -3.8)];
    for (let i = 0; i < hemPts.length; i++) {
      pts.push([...hemPts[i], 0]);
      if (i < hemPts.length - 1) {
        const a = hemPts[i], b = hemPts[i + 1];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        pts.push([mx + (dy / L) * 1.4 * K, my - (dx / L) * 1.4 * K, 0]);
      }
    }
    pts.push(Pp(11.4, -4.0), Pp(8.9, 2.0));
    buf.poly(spline(pts, true, 3), (x, y) => {
      const [a, b] = pelvisAB(x, y);
      if (b > 4.2) return M.skirt.s; // waistband
      const tb = clamp((5 - b) / 20, 0, 1);
      const half = lerp(8.4, 14.2, tb);
      const u = (a + half) / (2 * half);
      const pleat = Math.floor(u * 7 + 0.4 * (1 - tb));
      if (b < -12.0 - Math.abs(a) * 0.08 && b > -13.4 - Math.abs(a) * 0.08) return M.red.s; // hem stripe
      if (u < 0.14) return M.skirt.d;
      const fu = u * 7 + 0.4 * (1 - tb) - pleat;
      if (pleat % 2 === 0 && fu < 0.28 && tb > 0.2) return M.skirt.l;
      return pleat % 2 ? M.skirt.s : M.skirt.b;
    }, G.skirt);
  }
  // ---- sailor tie
  {
    const t = hero.tie;
    const sp = [T(5.2, 31.4)], ws = [2.2 * K];
    for (let i = 0; i < t.n; i++) { sp.push(toB(t.x[i], t.y[i])); ws.push(lerp(3.0, 2.2, i / (t.n - 1)) * K); }
    buf.poly(spline(ribbonOutline(sp, ws, 'flat'), true, 3), (x, y) => ((x + y) % 5 === 0 ? M.red.s : M.red.b), G.tie);
    const k0 = sp[0];
    buf.ellipse(k0[0] + 0.5, k0[1] - 0.3, 2.3 * K, 1.6 * K, J.sp, M.red.l, G.tie);
  }
  // ---- capelet + high collar, tattered hem
  {
    const P = [T(4.6, 40.8), T(5.4, 36.8), T(4.6, 34.4), T(1.6, 31.2), T(-0.8, 27.4), [...T(-1.8, 24.6), 0], [...T(-3.2, 26.2), 0], [...T(-4.6, 23.2), 0], [...T(-6.0, 25.6), 0], [...T(-7.8, 22.6), 0], [...T(-9.2, 25.0), 0], [...T(-11.0, 23.2), 0], [...T(-12.4, 25.4), 0], [...T(-13.9, 23.8), 0], T(-13.8, 28.8), T(-12.4, 33.8), T(-8.4, 37.8), T(-3.6, 41.6)];
    buf.poly(spline(P, true, 3), (x, y) => {
      const [a, b] = spineAB(x, y);
      if (b > 35.6) return a > 2 ? M.cloak.b : M.cloak.l; // collar
      if (a > -0.2 - (32 - b) * 0.45 && b < 34) return M.lining.b; // lining at the opening
      if (a < -11) return M.cloak.s;
      return b < 27.2 ? M.cloak.s : M.cloak.b;
    }, G.capelet);
    const cc = T(4.3, 34.9);
    buf.ellipse(cc[0], cc[1], 2.0 * K, 2.0 * K, 0, (u, v) => (Math.hypot(u, v) < 0.45 ? 0 : v < 0 ? M.red.l : M.red.b), G.capelet);
  }
  if (!armBehind) drawArm(J.sbx + ox, J.sby + oy, J.ebx + ox, J.eby + oy, J.wbx + ox, J.wby + oy, G.armB2, 1, 0.2);

  // ---- neck + head
  {
    const n0 = [J.nx + ox, J.ny + oy];
    const n1 = Hd(-0.8, 6.0);
    buf.capsule(n0[0], n0[1] + K, 2.5 * K, n1[0], n1[1], 2.3 * K, (t, s) => (s < -0.35 ? M.skin.s : M.skin.b), G.neck);
    {
      const ca = [lerp(n0[0], n1[0], 0.3), lerp(n0[1], n1[1], 0.3)], cb = [lerp(n0[0], n1[0], 0.46), lerp(n0[1], n1[1], 0.46)];
      buf.capsule(ca[0], ca[1], 2.75 * K, cb[0], cb[1], 2.6 * K, (t, s) => (s > 0.45 ? M.sleeve.l : M.sleeve.b), G.neck);
      buf.pset(ca[0] + 2.4 * K, (ca[1] + cb[1]) / 2 + 1, M.red.l, G.neck);
    }
    const hc = Hd(-1.6, -2.6);
    buf.ellipse(hc[0], hc[1], 8.7 * K * HK, 10.2 * K * HK, J.ha, (u, v) => (u < -0.5 && v > -0.3 && v < 0.5 ? M.hair.b : M.hair.s), G.hairF);
    buf.poly(spline(FIG.face.map(([x, y, sh]) => { const q = Hd(x, y); if (sh === 0) q.push(0); return q; }), true, 4), (x, y) => {
      const [lx, ly] = headXY(x, y);
      if (lx < -2.6 && ly > 1.6) return M.skin.s; // jaw side plane
      if (lx > 4.8 && ly > 3.6) return M.skin.s; // under the far cheek
      return M.skin.b;
    }, G.face);
    const EYES = {
      near: {
        open: ['..LLL.', 'LLLLLL', 'LDDDWe', '.IPPIe', '.IPPI.', '.iiiI.', '..ll..'],
        focus: ['......', '......', 'LLLLLL', 'LDPPWe', '.IPPI.', '.iiiI.', '..ll..'],
        closed: ['......', '......', '......', 'L....L', '.LLLL.', '......', '......'],
        pain: ['......', 'L.....', '.LL...', '...LL.', '.LL...', 'L.....', '......'],
      },
      far: {
        open: ['.LL.', 'LLLL', 'eDWL', '.PI.', '.PI.', '.ii.', '..l.'],
        focus: ['....', '....', 'LLLL', 'ePWL', '.PI.', '.ii.', '..l.'],
        closed: ['....', '....', '....', 'L..L', '.LL.', '....', '....'],
        pain: ['....', '...L', '.LL.', 'L...', '.LL.', '...L', '....'],
      },
    };
    const MAP = { L: C.lash, D: C.irisDk, I: C.iris, i: C.irisLt, P: C.pupil, W: C.white, e: C.eyeWhite, l: M.skin.line };
    const expr = p.fc === 3 ? 'pain' : hero.blink > 0 || p.fc === 2 ? 'closed' : p.fc === 1 || p.fc === 4 ? 'focus' : 'open';
    const stamp = (lx, ly, rows) => {
      const q = Hd(lx, ly);
      const x0 = Math.round(q[0]), y0 = Math.round(q[1]);
      for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (ch !== '.') buf.pset(x0 + c, y0 + r, MAP[ch], G.face);
      }
    };
    stamp(-3.2, -3.6, EYES.near[expr]);
    stamp(2.2, -3.5, EYES.far[expr]);
    const mq = Hd(3.4, 5.0);
    const mx = Math.round(mq[0]), my = Math.round(mq[1]);
    if (p.fc === 3 || p.fc === 4) {
      buf.pset(mx - 1, my, C.mouth, G.face); buf.pset(mx, my, C.mouth, G.face);
      buf.pset(mx - 1, my + 1, C.mouthIn, G.face); buf.pset(mx, my + 1, C.mouthIn, G.face);
    } else {
      buf.pset(mx, my, C.mouth, G.face);
      buf.pset(mx - 1, my, p.fc === 1 ? C.mouth : M.skin.s, G.face);
    }
    const nq = Hd(6.0, 1.3); buf.pset(nq[0], nq[1], M.skin.s, G.face);
    const bq = Hd(-1.6, 2.6); for (let i = 0; i < 3; i++) buf.pset(bq[0] + i, bq[1], C.blush, G.face);
    const bq2 = Hd(3.9, 2.7); buf.pset(bq2[0], bq2[1], C.blush, G.face); buf.pset(bq2[0] + 1, bq2[1], C.blush, G.face);
    buf.poly(spline(FIG.bangs.map(([x, y, sh]) => { const q = Hd(x, y); if (sh === 0) q.push(0); return q; }), true, 3), (x, y) => {
      const [lx, ly] = headXY(x, y);
      if (ly > -9.4 && ly < -8.0 && lx > -4.2 && lx < 3.9) return M.hair.l; // angel ring
      if (ly > -8.0 && ly < -7.2 && lx > -2.2 && lx < 1.8) return M.hair.h;
      if (ly > -4.6) return M.hair.s;
      return M.hair.b;
    }, G.hairF);
    const lock = (x0, y0, x1, y1, w0, w1) => {
      const pts = ribbonOutline([Hd(x0, y0), Hd((x0 + x1) / 2 - 0.2, (y0 + y1) / 2), Hd(x1, y1)], [w0 * 2 * K * HK, w0 * 1.9 * K * HK, w1 * 2 * K * HK], 'flat');
      buf.poly(spline(pts, true, 3), M.hair.b, G.hairF);
    };
    lock(-3.8, -5.2, -3.4, 8.2, 1.4, 1.3); // near hime lock, cut at the jaw
    lock(6.0, -3.9, 6.0, 5.0, 0.5, 0.45); // far lock
    for (const r of hero.ribbon) {
      const sp = [];
      for (let i = 0; i < r.n; i++) sp.push(toB(r.x[i], r.y[i]));
      buf.poly(spline(ribbonOutline(sp, [2.2 * K, 2.0 * K, 1.6 * K, 0.8 * K], 'point'), true, 3), M.red.b, G.bow);
    }
    const k = Hd(-6.4, -5.6), l1 = Hd(-8.0, -7.6), l2 = Hd(-8.4, -3.8);
    buf.ellipse(l1[0], l1[1], 2.4 * K, 1.4 * K, J.ha - 0.7, M.red.b, G.bow);
    buf.ellipse(l2[0], l2[1], 2.3 * K, 1.3 * K, J.ha + 0.6, M.red.s, G.bow);
    buf.ellipse(k[0], k[1], 1.2 * K, 1.2 * K, 0, M.red.l, G.bow);
  }
  // ---- front arm, then the capelet's near shoulder over its root
  const frontFist = p.gr === 0 || p.gr === 1 ? 1 : p.hf;
  drawArm(J.sfx + ox, J.sfy + oy, J.efx + ox, J.efy + oy, J.wfx + ox, J.wfy + oy, G.armF, frontFist, 0);
  buf.poly(spline([T(-5.8, 35.6), T(0.8, 35.4), T(2.0, 31.8), [...T(0.2, 29.0), 0], [...T(-1.8, 27.6), 0], [...T(-3.6, 29.0), 0], [...T(-5.6, 27.8), 0], T(-7.4, 31.0)], true, 3), (x, y) => {
    const [a, b] = spineAB(x, y);
    if (b < 28.4) return M.cloak.s;
    if (a > 0.2 && b > 30) return M.cloak.l;
    return M.cloak.b;
  }, G.cap);
  if (p.bz === 1) {
    drawBlade(G.blade);
    if (p.gr !== 2) drawHand(J.wfx + ox, J.wfy + oy, J.bdx, J.bdy, 1, G.handF, 0);
    if (p.gr === 1) drawHand(J.wbx + ox, J.wby + oy, J.bdx, J.bdy, 1, G.handF, 0);
  }
  if (p.gr === 2 && p.bz === 1) drawHand(J.wbx + ox, J.wby + oy, J.bdx, J.bdy, 1, G.handF, 0);

  // ---- cast shadows (anime cel shadows that follow the real shapes)
  buf.castShadow([G.skirt, G.corset], [G.legF, G.legB], Math.round(3 * K));
  buf.castShadow([G.hairF], [G.face], Math.round(2.2 * K));
  buf.castShadow([G.face, G.hairF], [G.neck], Math.round(3 * K));
  buf.castShadow([G.capelet, G.cap, G.collar], [G.torso, G.armF, G.armB2], Math.round(1.8 * K));
  buf.castShadow([G.corset], [G.torso], Math.round(1 * K), 0, 1);
}

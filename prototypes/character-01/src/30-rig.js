// ---------------------------------------------------------------------------
// Rig: skeleton, IK, secondary motion and the character's drawing.
// Authoring units are base pixels; K scales to native pixels (1.0 = the
// reference sprites' density). Facing space: +x forward, +y down, origin at
// the ground point under the pelvis.
// yaw turns the body between side profile (0) and a fighting-game 3/4 view
// (1): every contour has a table for both and is blended by yaw.
// ---------------------------------------------------------------------------
const K = 1.0;
const HK = 1.35; // head scale: pixel art needs a bigger head than the body math suggests
const RIG = {
  thigh: 33 * K, shin: 31 * K, ankle: 4 * K,
  spine: 34, neck: 3.4 * K,
  upper: 18.5 * K, fore: 16.5 * K,
  handle: 22 * K, ring: 24.5 * K, bladeBase: 27 * K, blade: 104 * K,
};
const POSE_KEYS = ['rx', 'ry', 'hp', 'sp', 'hd', 'fx', 'fy', 'ft', 'bx', 'by', 'bt', 'fa', 'fr', 'ba', 'br', 'bd', 'bl', 'gp', 'yaw'];
const POSE_DISC = ['fe', 'be', 'bz', 'gr', 'g2', 'fc', 'hf', 'hb', 'kf', 'kb'];
const POSE0 = {
  rx: 0, ry: -68.6, hp: 0, sp: 0, hd: 0,
  fx: 6, fy: 0, ft: 0, bx: -6, by: 0, bt: 0,
  fa: 1.5, fr: 0.97, ba: 1.62, br: 0.97,
  bd: 2.62, bl: 1, gp: 11, yaw: 0.85,
  fe: 1, be: 1, bz: 1, gr: 0, g2: 0, fc: 0, hf: 0, hb: 0, kf: 1, kb: 1,
};
// fe/be: elbow bend direction; bz: blade in front(1)/behind(0) the body;
// gr: 0 front hand, 1 two-handed, 2 back hand; g2: back arm drawn in front;
// fc: face 0 calm, 1 focused, 2 closed, 3 pain, 4 shout; hf/hb: hand open(0)/fist(1).
function mkPose(o) { return Object.assign({}, POSE0, o); }
function lerpPose(out, a, b, t) {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of POSE_DISC) out[k] = t < 0.5 ? a[k] : b[k];
  return out;
}
function copyPose(out, a) { for (const k of POSE_KEYS) out[k] = a[k]; for (const k of POSE_DISC) out[k] = a[k]; return out; }

const fwdV = (a) => [Math.cos(a), Math.sin(a)];
const upV = (a) => [Math.sin(a), -Math.cos(a)];
const yl = (s, q, y) => s + (q - s) * y; // yaw blend
const ylPt = (s, q, y) => { const r = [s[0] + (q[0] - s[0]) * y, s[1] + (q[1] - s[1]) * y]; if (s[2] === 0 || q[2] === 0) r.push(0); return r; };

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

// torso point: a = across (+ forward/far side), b = up from pelvis (base units). Bends at the waist.
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
function toSpine(J, fx, fy) {
  const c = Math.cos(J.sp), s = Math.sin(J.sp);
  const dx = fx - J.px, dy = fy - J.py;
  return [(dx * c + dy * s) / K, (dx * s - dy * c) / K];
}

// ---------------------------------------------------------------------------
// The figure. Numbers here ARE her shape. Two views per table: side / 3q.
// ---------------------------------------------------------------------------
const FIG = {
  // torso: left contour bottom->top, right contour top->bottom (spine frame a,b)
  torsoL: {
    b: [-9.5, -6.5, -2, 3.5, 8.5, 12.5, 16, 20, 24, 28, 31, 33.5, 35.2],
    side: [-7.5, -10.8, -11.4, -8.8, -6.4, -5.8, -6.4, -7.2, -7.9, -7.8, -6.8, -4.8, -3.2],
    q: [-8.6, -10.8, -11.4, -9.2, -6.6, -5.6, -6.2, -7.6, -8.4, -9.2, -10.2, -8.2, -2.2],
  },
  torsoR: {
    b: [35.2, 33.5, 31, 28, 25.6, 23.2, 21, 18.8, 16.5, 12.5, 8, 3, -2, -6.5, -9.5],
    side: [3.2, 4.8, 6.6, 8.0, 9.8, 11.7, 12.3, 11.0, 7.4, 5.8, 6.6, 7.4, 7.6, 7.3, 5.0],
    q: [3.9, 6.3, 7.6, 8.8, 10.7, 12.3, 12.4, 10.4, 6.8, 5.0, 6.2, 8.4, 9.6, 8.2, 5.0],
  },
  shoulderF: { side: [-1.2, 30.2], q: [-8.4, 30.4] }, // near arm
  shoulderB: { side: [1.6, 30.8], q: [5.8, 30.8] }, // far arm
  hipF: { side: [1.4, -1.2], q: [-4.8, -1.0] }, // near leg
  hipB: { side: [-1.6, -0.4], q: [4.4, -0.6] }, // far leg
  neck: { side: 0, q: 0.9 },
  legFront: [['T', -0.14, 3.0], ['T', 0.0, 6.0], ['T', 0.2, 6.9], ['T', 0.5, 6.2], ['T', 0.8, 5.0], ['J', 0, 4.1], ['S', 0.14, 3.6], ['S', 0.5, 3.0], ['S', 0.84, 2.3], ['S', 1.0, 2.1], ['S', 1.08, 0]],
  legBack: [['S', 1.0, -2.1], ['S', 0.86, -2.4], ['S', 0.58, -3.4], ['S', 0.3, -5.0], ['S', 0.1, -4.3], ['J', 0, -3.7], ['T', 0.8, -4.8], ['T', 0.5, -6.3], ['T', 0.2, -7.8], ['T', 0.0, -8.4], ['T', -0.14, -5.0]],
  thighW: [[6.0, 6.8, 6.1, 5.1, 4.1], [8.4, 7.5, 6.3, 5.0, 3.8]],
  shinW: [[3.8, 3.4, 3.0, 2.6, 2.1], [4.3, 5.0, 3.7, 2.7, 2.1]],
  sockTop: 1.2, // >1: knee socks; the top then sits at sockShin along the shin
  sockShin: 0.2,
  armFront: [['U', -0.12, 3.0], ['U', 0.14, 3.6], ['U', 0.4, 2.8], ['U', 0.68, 2.2], ['U', 0.9, 1.9], ['J', 0, 1.8], ['F', 0.2, 2.3], ['F', 0.5, 1.9], ['F', 0.74, 1.8], ['F', 0.86, 2.4], ['F', 1.0, 3.3, 0]],
  armBack: [['F', 1.0, -3.1, 0], ['F', 0.86, -2.2], ['F', 0.74, -1.7], ['F', 0.45, -1.9], ['F', 0.12, -2.2], ['J', 0, -2.1], ['U', 0.82, -2.1], ['U', 0.45, -2.8], ['U', 0.16, -3.5], ['U', -0.14, -2.4]],
  armW: [[3.0, 3.2, 2.6, 2.3, 2.2], [3.1, 2.9, 2.6, 2.4, 2.3]],
  foreW: [[2.4, 2.4, 2.1, 2.3, 3.3], [2.4, 2.3, 2.1, 2.1, 3.1]],
  face: [[-6.6, -3.8], [-5.6, -8.2], [0.4, -9.8], [4.9, -7.6], [6.4, -3.8], [6.7, -1.0], [7.0, 0.8], [6.5, 2.2], [5.6, 4.0], [4.2, 5.8], [2.8, 7.0, 0], [1.0, 6.6], [-1.8, 5.4], [-4.4, 3.4], [-6.2, 1.0], [-6.9, -1.0]],
  bangs: [[-7.4, -4.4], [-7.6, -9.0], [-3.8, -12.6], [1.8, -12.8], [6.0, -9.8], [7.3, -5.6], [7.4, -3.8, 0], [6.3, -4.4, 0], [5.3, -3.7, 0], [4.3, -4.6, 0], [3.1, -3.8, 0], [1.9, -4.8, 0], [0.7, -4.0, 0], [-0.6, -4.9, 0], [-1.9, -4.2, 0], [-3.2, -5.0, 0], [-4.6, -4.3, 0], [-5.8, -5.4]],
  // skirt (pelvis frame): hips upper points, then hem springs
  skirtTop: {
    side: [[7.6, 5.8], [-8.8, 5.8], [-11.4, 1.2], [-13.3, -3.8]],
    q: [[6.6, 5.6], [-8.0, 5.6], [-12.4, 0.4], [-14.8, -4.6]],
  },
  skirtFront: { side: [[11.4, -4.0], [8.9, 2.0]], q: [[14.4, -4.6], [11.0, 0.4]] },
  hem: {
    side: [[-15.0, -10.6], [-11.2, -13.2], [-5.8, -14.6], [0.2, -15.0], [5.8, -14.6], [10.8, -13.0], [14.4, -10.4]],
    q: [[-16.2, -11.0], [-11.8, -13.6], [-6.0, -14.9], [0.0, -15.3], [5.9, -14.9], [11.2, -13.4], [15.6, -11.0]],
  },
  corset: {
    side: [[7.0, 15.0], [6.1, 11.5], [6.9, 6.5], [7.6, 4.8], [-8.9, 4.8], [-6.5, 8.5], [-5.9, 13], [-6.6, 16.5], [-1, 17.6], [3.4, 16.4]],
    q: [[7.2, 16.6], [4.9, 11.0], [6.6, 6.5], [7.9, 4.6], [-9.6, 4.6], [-7.0, 8.0], [-5.5, 12.0], [-6.9, 16.8], [-1.4, 17.8], [3.6, 16.0]],
  },
  capeB: {
    side: [[-3.6, 40.5], [-8.6, 37.4], [-13.2, 31.5], [-14.6, 24], [-14.4, 17], [-12.4, 12.4], [-8, 11.4], [-3, 12.6], [1, 20], [2, 30], [1.2, 38.5]],
    q: [[-2.0, 40.5], [-8.8, 37.8], [-12.2, 33], [-12.6, 28], [-11.8, 24.5], [-10.6, 22.5], [-9.6, 22], [-8.4, 23], [-7.6, 26], [-5.0, 32], [-1.2, 38.5]],
  },
  capelet: {
    side: [[4.6, 40.8], [5.4, 36.8], [4.6, 34.4], [1.6, 31.2], [-0.8, 27.4], [-1.8, 24.6, 0], [-3.2, 26.2, 0], [-4.6, 23.2, 0], [-6.0, 25.6, 0], [-7.8, 22.6, 0], [-9.2, 25.0, 0], [-11.0, 23.2, 0], [-12.4, 25.4, 0], [-13.9, 23.8, 0], [-13.8, 28.8], [-12.4, 33.8], [-8.4, 37.8], [-3.6, 41.6]],
    q: [[1.8, 41.0], [2.2, 37.2], [1.2, 34.4], [-0.6, 31.0], [-2.0, 27.6], [-2.8, 24.8, 0], [-4.0, 26.6, 0], [-5.4, 23.6, 0], [-6.8, 25.8, 0], [-8.4, 22.8, 0], [-9.8, 25.2, 0], [-11.4, 23.4, 0], [-12.8, 25.6, 0], [-13.6, 24.2, 0], [-13.4, 28.8], [-12.4, 33.6], [-8.8, 38.0], [-3.6, 41.4]],
  },
  capFar: [[3.6, 40.4], [6.4, 38.2], [8.7, 34.4], [9.9, 30.6], [9.1, 28.4, 0], [7.9, 29.8, 0], [6.8, 28.2, 0], [5.6, 31.2], [4.2, 34.6]],
  shoulderCap: {
    side: [[-5.8, 35.6], [0.8, 35.4], [2.0, 31.8], [0.2, 29.0, 0], [-1.8, 27.6, 0], [-3.6, 29.0, 0], [-5.6, 27.8, 0], [-7.4, 31.0]],
    q: [[-12.2, 35.2], [-4.8, 35.6], [-3.8, 31.8], [-5.4, 28.4, 0], [-7.4, 27.2, 0], [-9.2, 28.8, 0], [-11.4, 27.4, 0], [-13.2, 31.2]],
  },
  tie: { side: [5.2, 31.4], q: [2.7, 32.0] },
  tieAnchor: { side: [6.6, 29.6], q: [2.9, 30.4] },
  clasp: { side: [4.3, 34.9], q: [1.6, 35.4] },
};
const ylTable = (t, y) => t.side.map((s, i) => ylPt(s, t.q[i], y));
const LIGHT_DIR = (() => { const v = [0.5, -0.55, 0.67], l = Math.hypot(...v); return v.map((x) => x / l); })();

// Solve joints. ground(fxFacing) -> ground height offset for feet, or null in air.
function solveRig(p, ground, J = {}) {
  J.pose = p;
  const yaw = clamp(p.yaw ?? 0.85, 0, 1);
  J.yaw = yaw;
  J.px = p.rx * K; J.py = p.ry * K; J.hp = p.hp; J.sp = p.sp;
  const [nx, ny] = torsoPt(J, yl(FIG.neck.side, FIG.neck.q, yaw), RIG.spine);
  J.nx = nx; J.ny = ny;
  const na = p.sp + p.hd * 0.5;
  const [ux, uy] = upV(na);
  J.ntx = nx + ux * RIG.neck; J.nty = ny + uy * RIG.neck;
  J.ha = p.sp + p.hd;
  const [hux, huy] = upV(J.ha), [hfx, hfy] = fwdV(J.ha);
  J.hx = J.ntx + (hux * 6.6 + hfx * 0.5) * K * HK; J.hy = J.nty + (huy * 6.6 + hfy * 0.5) * K * HK;
  const sF = ylPt(FIG.shoulderF.side, FIG.shoulderF.q, yaw), sB = ylPt(FIG.shoulderB.side, FIG.shoulderB.q, yaw);
  [J.sfx, J.sfy] = torsoPt(J, sF[0], sF[1]);
  [J.sbx, J.sby] = torsoPt(J, sB[0], sB[1]);
  const hF = ylPt(FIG.hipF.side, FIG.hipF.q, yaw), hB = ylPt(FIG.hipB.side, FIG.hipB.q, yaw);
  [J.hfx, J.hfy] = pelvisPt(J, hF[0], hF[1]);
  [J.hbx, J.hby] = pelvisPt(J, hB[0], hB[1]);
  const tmp = [0, 0, 0, 0];
  const foot = (fx, fy, ft, hipx, hipy, key, kb) => {
    fx *= K; fy *= K;
    let ax = fx, ay = fy - RIG.ankle;
    let g = 0;
    if (ground) { g = ground(fx); ay += g; }
    const planted = fy > -1;
    if (planted && ft > 0) ay -= Math.sin(ft) * 8 * K; // heel lift pivots on the toe
    if (planted && ft < 0) ay -= Math.sin(-ft) * 3 * K; // toe lift pivots on the heel
    ik2(hipx, hipy, ax, ay, RIG.thigh, RIG.shin, kb, tmp);
    J[key + 'kx'] = tmp[0]; J[key + 'ky'] = tmp[1]; J[key + 'ax'] = tmp[2]; J[key + 'ay'] = tmp[3];
    J[key + 'g'] = g;
  };
  foot(p.fx, p.fy, p.ft, J.hfx, J.hfy, 'F', p.kf ?? 1);
  foot(p.bx, p.by, p.bt, J.hbx, J.hby, 'B', p.kb ?? 1);
  J.Fft = p.ft; J.Bft = p.bt;
  const armLen = RIG.upper + RIG.fore;
  const [fax, fay] = fwdV(p.fa);
  const tfx = J.sfx + fax * armLen * p.fr, tfy = J.sfy + fay * armLen * p.fr;
  const [bax, bay] = fwdV(p.ba);
  let tbx = J.sbx + bax * armLen * p.br, tby = J.sby + bay * armLen * p.br;
  J.bdx = Math.cos(p.bd); J.bdy = Math.sin(p.bd); J.bl = p.bl;
  const bl = p.bl;
  if (p.gr === 2 || p.gr === 3) {
    // far hand is the main grip; gr 3 brings the near hand onto the handle below it
    ik2(J.sbx, J.sby, tbx, tby, RIG.upper, RIG.fore, -p.be, tmp);
    J.ebx = tmp[0]; J.eby = tmp[1]; J.wbx = tmp[2]; J.wby = tmp[3];
    J.gx = J.wbx + J.bdx * 2 * K; J.gy = J.wby + J.bdy * 2 * K;
    let nfx = tfx, nfy = tfy;
    if (p.gr === 3) { nfx = J.gx - J.bdx * 8 * K * bl; nfy = J.gy - J.bdy * 8 * K * bl; }
    ik2(J.sfx, J.sfy, nfx, nfy, RIG.upper, RIG.fore, -p.fe, tmp);
    J.efx = tmp[0]; J.efy = tmp[1]; J.wfx = tmp[2]; J.wfy = tmp[3];
  } else {
    ik2(J.sfx, J.sfy, tfx, tfy, RIG.upper, RIG.fore, -p.fe, tmp);
    J.efx = tmp[0]; J.efy = tmp[1]; J.wfx = tmp[2]; J.wfy = tmp[3];
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

// hair roots (head-local), node counts, widths
const HAIR = [
  { at: [-3.4, -8.8], len: 6, w0: 7, wm: 9.5, tone: 's', wave: 0.12 },
  { at: [-6.6, -5.0], len: 10, w0: 8, wm: 10.5, tone: 'b', wave: -0.16 },
  { at: [-7.6, -0.6], len: 11, w0: 8, wm: 10, tone: 's', wave: 0.14 },
  { at: [-6.6, 3.4], len: 9, w0: 7, wm: 9, tone: 'b', wave: -0.12 },
  { at: [-4.4, 5.6], len: 7, w0: 6, wm: 7.5, tone: 'd', wave: 0.1 },
];
// cloak tails hang from the back cape (torso frame)
const TAILS = [
  { at: [-9.6, 7.0], len: 8, w0: 11, m: 'cloakS', rest: 0.3 },
  { at: [-6.0, 6.0], len: 9, w0: 11, m: 'lining', rest: 0.12 },
  { at: [-1.0, 5.6], len: 8, w0: 11, m: 'cloak', rest: 0.0 },
  { at: [4.0, 5.8], len: 7, w0: 10, m: 'cloakS', rest: -0.12 },
  { at: [8.2, 6.6], len: 6, w0: 9, m: 'lining', rest: -0.26 },
];
const SEG_HAIR = 7.8 * K, SEG_TAIL = 7.0 * K;

// left body contour at height b (spine frame), for hair/cape collision
function leftEdgeAt(yaw, b) {
  const T = FIG.torsoL;
  if (b <= T.b[0]) return yl(T.side[0], T.q[0], yaw) - Math.max(0, T.b[0] - b) * 0.2;
  for (let i = 1; i < T.b.length; i++) if (T.b[i] >= b) {
    const f = (b - T.b[i - 1]) / (T.b[i] - T.b[i - 1]);
    return lerp(yl(T.side[i - 1], T.q[i - 1], yaw), yl(T.side[i], T.q[i], yaw), f);
  }
  return yl(T.side[T.b.length - 1], T.q[T.b.length - 1], yaw);
}

// Skirt frames: the hem is animated like hand-drawn cloth, not simulated. Each frame is an
// offset per hem point [forward, up] in pelvis units (back -> front); frames are held on
// twos/threes and chosen by what the body is doing. Rig drives limbs; frames drive cloth.
const SKIRT = {
  rest: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
  rise: [[1.2, -1.2], [0.6, -1.6], [0, -1.6], [0, -1.6], [0, -1.6], [-0.6, -1.6], [-1.2, -1.2]],
  apex: [[-3.4, 3.0], [-2.2, 2.6], [-0.8, 2.0], [0, 1.8], [0.8, 2.0], [2.2, 2.6], [3.4, 3.0]],
  fallA: [[-6.0, 6.4], [-4.2, 6.0], [-1.6, 5.0], [0, 4.6], [1.6, 5.0], [4.2, 5.8], [6.0, 6.2]],
  fallB: [[-6.4, 5.8], [-3.8, 6.6], [-1.4, 4.6], [0, 5.2], [1.8, 4.6], [4.4, 6.4], [6.4, 5.6]],
  land0: [[-2.2, -2.2], [-1.2, -2.6], [0, -2.6], [0, -2.6], [0, -2.6], [1.2, -2.6], [2.2, -2.2]],
  land1: [[-1.6, 2.2], [-1.0, 2.6], [0, 2.0], [0, 1.8], [0, 2.0], [1.0, 2.6], [1.6, 2.2]],
  land2: [[-0.6, -0.8], [-0.3, -0.8], [0, -0.6], [0, -0.6], [0, -0.6], [0.3, -0.8], [0.6, -0.8]],
  // run cycle, 4 drawings: contact / passing / contact / passing
  run0: [[-3.0, 2.6], [-2.0, 1.6], [-1.0, 0.6], [-0.5, 0], [0.2, 0.6], [1.2, 1.8], [1.8, 2.8]],
  run1: [[-3.6, 3.2], [-2.6, 2.4], [-1.6, 1.2], [-1.0, 0.4], [-0.8, 0], [-0.4, -0.4], [0, 0]],
  run2: [[-4.2, 3.8], [-3.2, 2.8], [-1.6, 1.2], [-1.0, 0], [-0.6, -0.4], [0, 0], [0.2, 0.6]],
  run3: [[-3.2, 2.2], [-2.6, 2.8], [-2.0, 1.8], [-1.0, 0.6], [-0.4, 0.2], [0.2, 0.6], [0.6, 1.2]],
  dashA: [[-5.2, 4.2], [-4.0, 3.2], [-2.6, 2.0], [-1.6, 1.0], [-1.0, 0.6], [-0.6, 0.6], [0, 1.2]],
  dashB: [[-5.0, 3.4], [-4.2, 3.8], [-2.4, 2.6], [-1.8, 1.4], [-1.0, 0.4], [-0.4, 1.0], [0, 0.8]],
  // turn / spin: swings the old way, bells out, swings through
  flare0: [[-5.2, 3.0], [-4.0, 2.6], [-3.0, 1.6], [-2.0, 1.0], [-1.0, 1.0], [0, 1.6], [1.0, 2.2]],
  flare1: [[-4.2, 4.6], [-2.6, 3.2], [-1.0, 2.0], [0, 1.6], [1.0, 2.0], [2.6, 3.2], [4.2, 4.6]],
  flare2: [[-1.0, 1.0], [0, 0.6], [0.6, 0], [1.0, 0], [1.6, 0.6], [2.2, 1.2], [2.6, 1.6]],
};
const SKIRT_SEQ = {
  land: [['land0', 4], ['land1', 4], ['land2', 4]],
  turn: [['flare0', 3], ['flare1', 4], ['flare2', 4]],
};

// Keep the blade out of the floor: pivot it at the grip so the tip stops at floorY - margin
// (floorY in the same local space as J). Slams pass margin 0 so the tip lands exactly on it.
function clampBlade(J, floorY, margin) {
  const Lt = J.tpy - J.gy, len = Math.hypot(J.tpx - J.gx, J.tpy - J.gy);
  if (!(len > 1) || J.gy + Lt <= floorY - margin) return false;
  const sn = clamp((floorY - margin - J.gy) / len, -1, 1);
  const a = J.bdx >= 0 ? Math.asin(sn) : Math.PI - Math.asin(sn);
  const bl = J.bl ?? 1, k = len;
  J.bdx = Math.cos(a); J.bdy = Math.sin(a);
  const pmD = Math.hypot(J.pmx - J.gx, J.pmy - J.gy), rgD = RIG.ring * bl, bbD = RIG.bladeBase * bl;
  J.pmx = J.gx - J.bdx * pmD; J.pmy = J.gy - J.bdy * pmD;
  J.rgx = J.pmx + J.bdx * rgD; J.rgy = J.pmy + J.bdy * rgD;
  J.bbx = J.pmx + J.bdx * bbD; J.bby = J.pmy + J.bdy * bbD;
  J.tpx = J.gx + J.bdx * k; J.tpy = J.gy + J.bdy * k;
  return true;
}

class Heroine {
  constructor() {
    this.hair = HAIR.map((h, i) => new Chain(h.len, SEG_HAIR, { stiff: [0.46, 0.04], damp: 0.93, grav: 760, drag: 1.1, rest: Math.PI / 2 + 0.12 + i * 0.02, curl: h.wave }));
    this.tails = TAILS.map((t, i) => new Chain(t.len, SEG_TAIL, { stiff: [0.3, 0.02], damp: 0.95, grav: 640, drag: 2.1, rest: Math.PI / 2 + t.rest, curl: (i % 2 ? -0.1 : 0.1) }));
    this.ribbon = [0, 1].map((i) => new Chain(4, 3.2 * K, { stiff: [0.25, 0.1], damp: 0.9, grav: 600, drag: 1.8, rest: Math.PI / 2 + 0.55 + i * 0.35 }));
    this.front = [0, 1].map((i) => new Chain(6 + i, 6.0 * K, { stiff: [0.55, 0.06], damp: 0.92, grav: 760, drag: 1.2, rest: Math.PI / 2 - 0.16 - i * 0.06, curl: -0.08 }));
    this.tie = new Chain(4, 3.3 * K, { stiff: [0.35, 0.2], damp: 0.88, grav: 800, drag: 0.8, rest: Math.PI / 2 - 0.05 });
    this.hem = FIG.hem.side.map(() => new Spring2(170, 8.5, 10 * K));
    this.hemLine = FIG.hem.side.map(() => 0); // lining shown under a lifted hem, px
    this.sk = { frame: 'rest', hold: 0, seq: null, si: 0, st: 0, wasGround: true, airT: 0, dir: 1, yaw: null, tick: 0 };
    this.skForce = null;
    this.chest = new Spring2(300, 10, 1.9 * K);
    this.prevPel = null; this.prevVel = [0, 0];
    this.prevChest = null; this.prevChestVel = [0, 0];
    this.dtPrev = 1 / 60;
    this.blink = 0; this.blinkT = 2;
  }
  simulate(J, rootX, rootY, dir, dt, env) {
    if (!(dt > 0)) return;
    if (!Number.isFinite(env.wind)) env.wind = 0;
    if (!Number.isFinite(env.lift || 0)) env.lift = 0;
    // self-heal: a single bad value must never stick in the simulation
    if (!Number.isFinite(this.chest.x + this.chest.y + this.hem[0].y + this.hair[0].x[1] + this.tails[0].y[1])) this.resetPhysics();
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
    this.skirtFrames(J, dir, dt, env.skirt);
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
    const c = Math.cos(J.sp), s = Math.sin(J.sp);
    const yaw = J.yaw;
    const mkCollide = (margin, soft) => (X, Y, i) => {
      const [a, b] = toSpine(J, (X[i] - rootX) * dir, Y[i] - rootY);
      if (b > -18 && b < 42) {
        const lim = leftEdgeAt(yaw, b) - margin;
        if (a > lim) {
          const push = (lim - a) * soft * K;
          X[i] += c * push * dir; Y[i] += s * push;
        }
      }
      const gy = groundAt(X[i]) - 1;
      if (Y[i] > gy) Y[i] = gy;
    };
    const hairEnv = { wind: env.wind * 0.8, lift: env.lift || 0, collide: mkCollide(1.2, 0.35) };
    const tailEnv = { wind: env.wind, lift: env.lift || 0, collide: (X, Y, i) => { const gy = groundAt(X[i]) - 1; if (Y[i] > gy) Y[i] = gy; } };
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
    for (let i = 0; i < this.front.length; i++) {
      const [fx0, fy0] = headPt(J, [-6.2, -4.8][i], [3.2, 5.6][i]);
      const fw = W(fx0, fy0);
      this.front[i].step(fw[0], fw[1], J.ha * 0.4, dir, dt, dtPrev, { wind: env.wind * 0.6, lift: env.lift || 0 });
    }
    const [kx, ky] = headPt(J, -6.4, -5.6);
    const kw = W(kx, ky);
    for (const r of this.ribbon) r.step(kw[0], kw[1], J.ha * 0.3, dir, dt, dtPrev, { wind: env.wind * 1.2, lift: env.lift || 0 });
    const ta = ylPt(FIG.tieAnchor.side, FIG.tieAnchor.q, yaw);
    const [tx0, ty0] = torsoPt(J, ta[0] + (this.chest.x / K) * (1 - yaw), ta[1]);
    const tw = W(tx0, ty0);
    const ch = this.chest;
    this.tie.step(tw[0], tw[1], J.sp, dir, dt, dtPrev, {
      wind: env.wind * 0.5,
      collide: (X, Y, i) => {
        if (yaw > 0.5) return; // in 3/4 the tie lies down the centre of the chest
        const [a, b] = toSpine(J, (X[i] - rootX) * dir, Y[i] - rootY);
        const front = b > 25 ? lerp(9.8, 6.6, (b - 25) / 5) : b > 19.5 ? 12.2 + ch.x / K : b > 16 ? lerp(7.4, 12.2, (b - 16) / 3.5) : 6.2;
        if (a < front + 0.9) { const push = (front + 0.9 - a) * K; X[i] += c * push * dir; Y[i] += s * push; }
      },
    });
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = rand(2.2, 4.8); }
    if (this.blink > 0) this.blink -= dt;
  }
  skirtFrames(J, dir, dt, e) {
    const k = this.sk, f = dt * 60;
    k.tick += f;
    const yawV = k.yaw === null ? 0 : (J.yaw - k.yaw) / dt;
    k.yaw = J.yaw;
    let name = 'rest', amp = 1;
    if (this.skForce) name = this.skForce;
    else if (e) {
      const speed = Math.abs(e.vx);
      if (e.grounded && !k.wasGround && k.airT > 8) { k.seq = SKIRT_SEQ.land; k.si = 0; k.st = 0; }
      if (dir !== k.dir && (speed > 60 || !e.grounded || e.state === 'attack')) { k.seq = SKIRT_SEQ.turn; k.si = 0; k.st = 0; }
      else if (Math.abs(yawV) > 7 && !k.seq) { k.seq = SKIRT_SEQ.turn; k.si = 0; k.st = 0; }
      k.dir = dir; k.wasGround = e.grounded; k.airT = e.grounded ? 0 : k.airT + f;
      if (k.seq) {
        k.st += f;
        while (k.seq && k.st >= k.seq[k.si][1]) { k.st -= k.seq[k.si][1]; if (++k.si >= k.seq.length) k.seq = null; }
      }
      if (k.seq) name = k.seq[k.si][0];
      else if (!e.grounded) name = e.vy < -140 ? 'rise' : e.vy < 110 ? 'apex' : (Math.floor(k.tick / 5) % 2 ? 'fallB' : 'fallA');
      else if (e.state === 'move' && speed > 40) {
        name = 'run' + (Math.floor((((e.phase % 1) + 1) % 1) * 4) % 4);
        amp = clamp(speed / 260, 0.4, 1.15);
      } else if (speed > 170) name = Math.floor(k.tick / 3) % 2 ? 'dashB' : 'dashA';
    }
    // held drawings: a new frame shows for at least two ticks
    if (name !== k.frame && k.hold > 0 && !k.seq) name = k.frame;
    if (name !== k.frame) { k.frame = name; k.hold = 2; k.amp = amp; } else { k.hold -= f; if (!k.seq) k.amp = amp; }
    const fr = SKIRT[k.frame] || SKIRT.rest, am = k.amp || 1;
    for (let i = 0; i < this.hem.length; i++) {
      const h = this.hem[i];
      h.x = fr[i][0] * am * K; h.y = fr[i][1] * am * K; h.vx = h.vy = 0;
      this.hemLine[i] = clamp((fr[i][1] * am - 1.4) * 0.9, 0, 4.2) * K;
    }
  }
  resetPhysics() {
    for (const c of [...this.hair, ...this.tails, ...this.ribbon, ...this.front, this.tie]) c.init = false;
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
let COSTUME = COSTUMES.split;

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
const G = { tails: 1, capeB: 2, halo: 3, hair: 4, armB: 5, bladeB: 6, legB: 7, shoeB: 8, legF: 9, shoeF: 10, torso: 11, collar: 12, corset: 13, skirt: 14, tie: 15, capelet: 16, armB2: 17, neck: 18, face: 19, hairF: 20, bow: 21, armF: 22, cap: 23, blade: 24, handF: 25, capFar: 26, hairFront: 27 };

// Face frames, 3/4 facing right. Pixel-authored: at this size a rig can't place
// eyes/mouth well enough, so these are drawn like sprite frames and swapped by expression.
const FACE = {
  skin: [
    '...22222222222...',
    '..2222222222222..',
    '.222222222222222.',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '32222222222222222',
    '.3222222222222222',
    '.322222222222222.',
    '..32222222222222.',
    '...332222222222..',
    '....3322222222...',
    '.....33222222....',
    '......332222.....',
    '.......3322......',
  ],
  // eyes as pixel-anime refs draw them at this size: 3 rows, wider than tall, a thick lash bar
  // running past the outer corner, dark iris top, bright bottom, one highlight, a soft lower lid
  near: {
    open:   ['LLLLLL.', '.LDDPWD', '.eIPPIe', '..IiiI.', '...kk..'],
    focus:  ['.......', 'LLLLLL.', '.LDIWIe', '..IiiI.', '...kk..'],
    closed: ['.......', '.......', 'L.....L', '.LLLLL.', '.......'],
    pain:   ['LL.....', '..LL...', 'LL.....', '.......', '.......'],
  },
  far: {
    open:   ['.LLLLL', 'DDPWL.', 'eIPIe.', '.Ii...', '..k...'],
    focus:  ['......', '.LLLLL', 'DIWIe.', '.Ii...', '..k...'],
    closed: ['......', '......', 'L...L.', '.LLL..'],
    pain:   ['...LL.', '.LL...', '...LL.', '......'],
  },
  blush: ['.bbb.....bb'],
  mouth: { smirk: ['mm'], open: ['mm', 'nn'] },
  nose: ['s'],
};
const FACE_AT = { near: [0, 9], far: [11, 9], blush: [1, 14], mouth: [8, 18], nose: [11, 15] };
const FACE_W = 17, FACE_CX = 9, FACE_CY = 12;
// feature stamps stay upright (pixel-exact); only their anchors follow the head
function faceFrame(expr, mouth) {
  return [[FACE.near[expr], FACE_AT.near], [FACE.far[expr], FACE_AT.far], [FACE.blush, FACE_AT.blush], [FACE.mouth[mouth], FACE_AT.mouth], [FACE.nose, FACE_AT.nose]];
}

function drawHeroine(buf, J, hero, ox, oy, rootX, rootY, dir, opts = {}) {
  let faceDecal = null;
  const p = J.pose, yaw = J.yaw;
  const T = (a, b, sh) => { const q = torsoPt(J, a, b); const r = [q[0] + ox, q[1] + oy]; if (sh === 0) r.push(0); return r; };
  const Pp = (a, b, sh) => { const q = pelvisPt(J, a, b); const r = [q[0] + ox, q[1] + oy]; if (sh === 0) r.push(0); return r; };
  const Hd = (x, y) => { const q = headPt(J, x, y); return [q[0] + ox, q[1] + oy]; };
  const Tt = (tbl) => ylTable(tbl, yaw).map(([a, b, sh]) => T(a, b, sh));
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
      const w = f < 0.55 ? lerp(TAILS[t].w0, TAILS[t].w0 * 1.15, f / 0.55) : lerp(TAILS[t].w0 * 1.15, 0.4, Math.pow((f - 0.55) / 0.45, 0.8));
      ws.push(w * K);
    }
    const out = ribbonOutline(sp, ws, 'point');
    for (let i = 0; i < out.length; i++) { const f = (i % chn.n) / chn.n; if (f > 0.4 && i % 3 === 1) out[i] = [out[i][0], out[i][1], 0]; }
    const m = TAILS[t].m;
    buf.litR = 2.6;
    const tipY = sp[sp.length - 1][1], topY = sp[0][1];
    buf.poly(spline(out, true, 3), (x, y) => {
      const f = (y - topY) / ((tipY - topY) || 1);
      if (f > 0.72) return m === 'lining' ? M.lining.b : M.lining.s; // torn edge shows the red lining
      return m === 'lining' ? M.lining.s : m === 'cloakS' ? M.cloak.s : M.cloak.b;
    }, G.tails);
    buf.litR = 0;
  }
  // ---- back cape
  buf.litR = 3;
  buf.poly(spline(Tt(FIG.capeB), true, 3), M.cloak.s, G.capeB);
  buf.litR = 0;
  // ---- halo
  if (COSTUME.halo) {
    // a clean 1px ring floating above the crown
    const hq = Hd(-2.2, -15.2);
    const t = (opts.time || 0) * 1.3;
    const rx = 10.5 * K, ry = 2.8 * K, rot = J.ha * 0.6 - 0.12, cy = hq[1] + Math.sin(t) * 0.8;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    let lastX = null, lastY = null;
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU, ex_ = Math.cos(a) * rx, ey_ = Math.sin(a) * ry;
      const x = Math.round(hq[0] + ex_ * cs - ey_ * sn), y = Math.round(cy + ex_ * sn + ey_ * cs);
      if (x === lastX && y === lastY) continue;
      buf.pset(x, y, Math.sin(a) < 0 ? M.red.s : M.red.l, G.halo);
      lastX = x; lastY = y;
    }
    buf.bump();
  }
  // ---- long hair: smooth strands that merge into one mass
  for (let s = 0; s < HAIR.length; s++) {
    const chn = hero.hair[s];
    const sp = [], ws = [];
    for (let i = 0; i < chn.n; i++) {
      sp.push(toB(chn.x[i], chn.y[i]));
      const f = i / (chn.n - 1);
      const w = f < 0.25 ? lerp(HAIR[s].w0, HAIR[s].wm, f / 0.25) : f < 0.5 ? HAIR[s].wm : HAIR[s].wm * Math.pow(1 - (f - 0.5) / 0.5, 1.15);
      ws.push(Math.max(0.4, w * K * 1.1));
    }
    const tn = HAIR[s].tone;
    buf.litR = 3.2;
    buf.poly(spline(ribbonOutline(sp, ws, 'point'), true, 3), tn === 's' ? M.hair.s : tn === 'd' ? M.hair.d : M.hair.b, G.hair);
    buf.litR = 0;
  }
  // one clean sheen per clump, strongest near the crown, fading down the length
  for (const [si, i0, i1, off] of [[1, 1, 4, -2.0], [3, 1, 3, -1.6]]) {
    const chn = hero.hair[si];
    const sp = [];
    for (let i = i0; i <= Math.min(i1, chn.n - 1); i++) { const q = toB(chn.x[i], chn.y[i]); sp.push([q[0] + off, q[1]]); }
    const pl = spline(sp, false, 3);
    for (let i = 0; i + 3 < pl.length; i += 2) buf.line(pl[i], pl[i + 1], pl[i + 2], pl[i + 3], i < pl.length * 0.35 ? M.hair.h : M.hair.l, G.hair);
  }

  const drawHand = (wx, wy, ux, uy, mode, g, dim) => {
    const ang = Math.atan2(uy, ux);
    const H = (x, y, sh) => { const q = lmkFrame(wx, wy, ang, x, y); if (sh === 0) q.push(0); return q; };
    const pts = mode === 1
      ? [H(-0.6, -2.3), H(1.8, -2.7), H(3.9, -1.9), H(4.6, 0.1), H(3.8, 2.2), H(1.2, 2.6), H(-0.7, 2.0)]
      : [H(-0.5, -2.0), H(2.0, -2.4), H(4.6, -1.7), H(6.3, -0.9), H(6.6, 0.1, 0), H(5.1, 0.7), H(3.4, 1.8), H(1.0, 2.3), H(-0.5, 1.8)];
    buf.poly(spline(pts, true, 3), (x, y) => {
      const rx = (x + 0.5 - wx) / K, ry = (y + 0.5 - wy) / K;
      const ly = -Math.sin(ang) * rx + Math.cos(ang) * ry;
      const lx = Math.cos(ang) * rx + Math.sin(ang) * ry;
      if (mode === 1 && lx > 3.0 && lx < 3.8) return M.skin.s;
      return ly > 0.9 || dim > 0.3 ? M.skin.s : M.skin.b;
    }, g);
  };

  const drawArm = (sx, sy, exx, eyy, wx, wy, g, handMode, dim) => {
    const U = bone(sx, sy, exx, eyy), F = bone(exx, eyy, wx, wy);
    const pts = contourPts([...FIG.armFront, ...FIG.armBack], { U, F, J1: U, J2: F });
    buf.litR = 3.2;
    buf.poly(spline(pts, true, 4), (x, y) => {
      const rx = x + 0.5 - U.ax, ry = y + 0.5 - U.ay;
      const tu = (rx * U.ux + ry * U.uy) / U.L;
      if (tu < 0.98) return dim > 0.3 ? M.sleeve.s : M.sleeve.b;
      const [t, s] = boneShadeCoords(F, x, y, FIG.foreW[0], FIG.foreW[1]);
      if (t > 0.93) return M.red.b;
      if (t > 0.8) return M.sleeve.l;
      if (t < 0.08 && s < 0) return M.sleeve.s;
      // soft folds bunching above the cuff and at the elbow
      if ((Math.abs(t - 0.66 + s * 0.06) < 0.035 || Math.abs(t - 0.18 - s * 0.05) < 0.035) && buf.curD > 1.2) return M.sleeve.s;
      return dim > 0.3 ? M.sleeve.s : M.sleeve.b;
    }, g);
    buf.litR = 0;
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
    const Kn0 = lmkJoint(Tb, Sb, 1.2);
    const st = FIG.sockTop;
    buf.litR = 6.5;
    const skinB = back ? M.skin.s : M.skin.b, sockB = back ? SM.s : SM.b;
    const segD = (b, x, y) => {
      const rx = x + 0.5 - b.ax, ry = y + 0.5 - b.ay;
      const t = clamp((rx * b.ux + ry * b.uy) / b.L, 0, 1);
      return Math.hypot(rx - b.ux * b.L * t, ry - b.uy * b.L * t);
    };
    buf.poly(spline(pts, true, 4), (x, y) => {
      const rx = x + 0.5 - Tb.ax, ry = y + 0.5 - Tb.ay;
      const tr = (rx * Tb.ux + ry * Tb.uy) / Tb.L;
      if (tr < 1.0 && segD(Tb, x, y) <= segD(Sb, x, y) + 0.5) {
        const [t, s] = boneShadeCoords(Tb, x, y, FIG.thighW[0], FIG.thighW[1]);
        if (st > 1) return skinB;
        const band = st + 0.035 * s * s;
        if (t < band - 0.005) return skinB;
        if (t < band + 0.045) return M.red.b;
        return sockB;
      }
      if (st > 1) {
        const [t, s] = boneShadeCoords(Sb, x, y, FIG.shinW[0], FIG.shinW[1]);
        const band = FIG.sockShin + 0.04 * s * s;
        if (t < band - 0.01) return skinB;
        if (t < band + 0.05) return M.red.b;
      }
      return sockB;
    }, g);
    buf.litR = 0;
    buf.addBump(Kn0[0], Kn0[1], 3.6 * K, 3.0 * K, 0, 2.2, g);
    if (!back) {
      const a0 = lmk(Tb, 0.42, 6.5), a1 = lmk(Tb, 0.455, 6.45), b1 = lmk(Tb, 0.455, -6.9), b0 = lmk(Tb, 0.42, -7.0);
      buf.poly([...a0, ...a1, ...b1, ...b0], (x, y) => {
        const [, s] = boneShadeCoords(Tb, x, y, FIG.thighW[0], FIG.thighW[1]);
        return s > 0.3 ? M.red.l : s < -0.4 ? M.red.s : M.red.b;
      }, g);
    }
    const c = Math.cos(ft), s = Math.sin(ft);
    const A = ankle;
    const F = (x, y, sh) => { const q = [A[0] + (c * x - s * y) * K, A[1] + (s * x + c * y) * K]; if (sh === 0) q.push(0); return q; };
    const shoe = [F(-2.5, -1.3), F(1.6, -1.6), F(3.9, -0.4), F(6.8, 1.0), F(8.0, 2.3), F(7.6, 3.3, 0), F(-0.6, 3.4), F(-1.2, 4.0, 0), F(-3.0, 4.0, 0), F(-3.3, 0.6)];
    buf.litR = 2.2;
    buf.poly(spline(shoe, true, 3), (x, y) => {
      const rx = (x + 0.5 - A[0]) / K, ry = (y + 0.5 - A[1]) / K;
      const fx = c * rx + s * ry, fy = -s * rx + c * ry;
      if (fy > 3.0) return M.shoe.s;
      if (!back && fx > 3.2 && fx < 6.4 && fy > -0.2 && fy < 1.2) return M.shoe.l; // toe cap shine
      return M.shoe.b;
    }, gShoe);
    buf.litR = 0;
  };

  // ---- far arm (behind body) and a blade held behind
  const armBehind = p.g2 !== 1;
  if (armBehind) drawArm(J.sbx + ox, J.sby + oy, J.ebx + ox, J.eby + oy, J.wbx + ox, J.wby + oy, G.armB, p.gr === 2 ? 1 : p.hb, 0.45);
  if (p.bz === 0) drawBlade(G.bladeB);

  // ---- legs
  drawLeg([J.hbx + ox, J.hby + oy], [J.Bkx + ox, J.Bky + oy], [J.Bax + ox, J.Bay + oy], J.Bft, G.legB, G.shoeB, true);
  drawLeg([J.hfx + ox, J.hfy + oy], [J.Fkx + ox, J.Fky + oy], [J.Fax + ox, J.Fay + oy], J.Fft, G.legF, G.shoeF, false);

  // ---- torso: contour blended between profile and 3/4
  const TL = FIG.torsoL, TR = FIG.torsoR;
  const left = TL.b.map((b, i) => [yl(TL.side[i], TL.q[i], yaw), b]);
  const right = TR.b.map((b, i) => {
    const a = yl(TR.side[i], TR.q[i], yaw);
    const w = b > 16 && b < 26 ? 1 - Math.abs(b - 21) / 5 : 0;
    return [a + ex * w, b + ey * w];
  });
  const at = (pts, b) => {
    for (let i = 1; i < pts.length; i++) {
      const [a0, b0] = pts[i - 1], [a1, b1] = pts[i];
      if ((b0 - b) * (b1 - b) <= 0) return lerp(a0, a1, (b - b0) / ((b1 - b0) || 1));
    }
    return pts[0][0];
  };
  buf.litR = 8;
  buf.poly(spline([...left, ...right, [yl(0, -1.5, yaw), -11]].map(([a, b]) => T(a, b)), true, 4), (x, y) => {
    const [a, b] = spineAB(x, y);
    if (yaw > 0.5) {
      const cl = 4.4 - (b - 18.5) * 0.12; // cleavage line
      if (b > 18.8 && b < 25.2 && Math.abs(a - cl) < 0.5) return TM.s;
    }
    return TM.b;
  }, G.torso);
  buf.litR = 0;
  if (yaw > 0.4) {
    const k = (yaw - 0.4) / 0.6;
    const c1 = T(1.4 + ex * 0.8, 21.2 + ey * 0.8), c2 = T(8.0 + ex * 0.8, 21.1 + ey * 0.8);
    buf.addBump(c1[0], c1[1], 5.8 * K, 5.0 * K, J.sp, 6.8 * k, G.torso);
    buf.addBump(c2[0], c2[1], 4.4 * K, 4.4 * K, J.sp, 4.5 * k, G.torso);
  }
  // sailor collar tips
  if (yaw > 0.5) {
    for (const tip of [[[-1.2, 34.8], [1.8, 34.0], [1.2, 30.6, 0], [0.0, 31.6], [-1.2, 33.2]], [[3.4, 34.4], [6.0, 33.8], [5.8, 30.4, 0], [4.4, 31.4], [3.4, 32.8]]]) {
      buf.poly(spline(tip.map(([a, b, sh]) => T(a, b, sh)), true, 3), M.shirt.l, G.collar);
    }
  } else {
    buf.poly(spline([T(1.6, 34.6), T(5.8, 33.6), T(7.4, 30.2, 0), T(4.6, 30.8), T(2.2, 32.2)], true, 3), M.shirt.l, G.collar);
  }
  // corset
  buf.litR = 4.5;
  buf.poly(spline(Tt(FIG.corset), true, 3), (x, y) => {
    const [a, b] = spineAB(x, y);
    const mid = yl(4.2, 2.6, yaw);
    if (a > mid - 0.8 && a < mid + 1.6 && ((Math.round(b * 1.2) + Math.round(a)) % 3 === 0)) return M.red.s; // lacing
    return M.skirt.b;
  }, G.corset);
  buf.litR = 0;
  // ---- skirt: smooth hips, pleated hem
  {
    const hemRest = ylTable(FIG.hem, yaw);
    const hemPts = hemRest.map(([a, b], i) => Pp(a + hero.hem[i].x / K, b + hero.hem[i].y / K));
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
    const pts = ylTable(FIG.skirtTop, yaw).map(([a, b]) => Pp(a, b));
    for (let i = 0; i < hemPts.length; i++) {
      pts.push([...hemPts[i], 0]);
      if (i < hemPts.length - 1) {
        const a = hemPts[i], b = hemPts[i + 1];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        pts.push([mx + (dy / L) * 1.4 * K, my - (dx / L) * 1.4 * K, 0]);
      }
    }
    pts.push(...ylTable(FIG.skirtFront, yaw).map(([a, b]) => Pp(a, b)));
    // flipped-up hem: the crimson lining shows as a band under the edge
    if (hero.hemLine.some((d) => d > 0.4)) {
      const top = hemPts.map((q) => [q[0], q[1]]);
      const bot = hemPts.map((q, i) => { const d = hero.hemLine[i]; const u = Pp(0, 0), v = Pp(0, -1); return [q[0] + (v[0] - u[0]) * d / K, q[1] + (v[1] - u[1]) * d / K]; });
      buf.poly(spline([...top, ...bot.reverse()], true, 3), (x, y) => (buf.curD < 1.1 ? M.red.b : M.red.d), G.skirt);
    }
    buf.litR = 7;
    buf.poly(spline(pts, true, 3), (x, y) => {
      const [a, b] = pelvisAB(x, y);
      if (b > 4.2) return M.skirt.s;
      const tb = clamp((5 - b) / 20, 0, 1);
      const half = lerp(8.4, 14.6, tb);
      const u = (a + half) / (2 * half);
      const pleat = Math.floor(u * 8 + 0.4 * (1 - tb));
      if (buf.curD < 2.2 && b < -8.5) return buf.curD < 1.1 ? M.red.s : M.red.b; // hem trim along the real edge
      if (u < 0.14) return M.skirt.d;
      const fu = u * 8 + 0.4 * (1 - tb) - pleat;
      if (pleat % 2 === 0 && fu < 0.3 && tb > 0.2) return M.skirt.l;
      return pleat % 2 ? M.skirt.s : M.skirt.b;
    }, G.skirt);
    buf.litR = 0;
  }
  // ---- sailor tie
  {
    const t = hero.tie;
    const k0v = ylPt(FIG.tie.side, FIG.tie.q, yaw);
    const sp = [T(k0v[0], k0v[1])], ws = [2.2 * K];
    for (let i = 0; i < t.n; i++) { sp.push(toB(t.x[i], t.y[i])); ws.push(lerp(3.0, 2.2, i / (t.n - 1)) * K); }
    buf.poly(spline(ribbonOutline(sp, ws, 'flat'), true, 3), (x, y) => ((x + y) % 5 === 0 ? M.red.s : M.red.b), G.tie);
    buf.ellipse(sp[0][0] + 0.5, sp[0][1] - 0.3, 2.3 * K, 1.6 * K, J.sp, M.red.l, G.tie);
  }
  // ---- capelet (near side) + far shoulder cap + collar
  buf.litR = 3.5;
  if (yaw > 0.3) buf.poly(spline(FIG.capFar.map(([a, b, sh]) => T(a, b, sh)), true, 3), M.cloak.b, G.capFar);
  buf.poly(spline(Tt(FIG.capelet), true, 3), (x, y) => {
    const [a, b] = spineAB(x, y);
    if (b > 35.6) return a > 1 ? M.cloak.b : M.cloak.l;
    const edge = yl(-0.2, -1.8, yaw) - (32 - b) * 0.45;
    if (a > edge && b < 34) return M.lining.b;
    return M.cloak.b;
  }, G.capelet);
  buf.litR = 0;
  {
    const cq = ylPt(FIG.clasp.side, FIG.clasp.q, yaw), cc = T(cq[0], cq[1]);
    buf.ellipse(cc[0], cc[1], 2.0 * K, 2.0 * K, 0, (u, v) => (Math.hypot(u, v) < 0.45 ? 0 : v < 0 ? M.red.l : M.red.b), G.capelet);
  }
  if (!armBehind) drawArm(J.sbx + ox, J.sby + oy, J.ebx + ox, J.eby + oy, J.wbx + ox, J.wby + oy, G.armB2, 1, 0.2);
  // ---- front locks falling over the near shoulder
  for (let s = 0; s < hero.front.length; s++) {
    const chn = hero.front[s];
    const sp = [], ws = [];
    for (let i = 0; i < chn.n; i++) {
      sp.push(toB(chn.x[i], chn.y[i]));
      const f = i / (chn.n - 1);
      ws.push(Math.max(0.5, (f < 0.5 ? lerp(5.4, 6.4, f / 0.5) : 6.4 * Math.pow(1 - (f - 0.5) / 0.5, 1.1)) * K));
    }
    buf.litR = 2.6;
    buf.poly(spline(ribbonOutline(sp, ws, 'point'), true, 3), s ? M.hair.s : M.hair.b, G.hairFront);
    buf.litR = 0;
  }

  // ---- neck + head
  {
    const n0 = [J.nx + ox, J.ny + oy];
    const n1 = Hd(-0.6, 4.8);
    buf.capsule(n0[0], n0[1] + K, 2.5 * K, n1[0], n1[1], 2.3 * K, (t, s) => (s < -0.35 ? M.skin.s : M.skin.b), G.neck);
    {
      const ca = [lerp(n0[0], n1[0], 0.3), lerp(n0[1], n1[1], 0.3)], cb = [lerp(n0[0], n1[0], 0.46), lerp(n0[1], n1[1], 0.46)];
      buf.capsule(ca[0], ca[1], 2.75 * K, cb[0], cb[1], 2.6 * K, (t, s) => (s > 0.45 ? M.sleeve.l : M.sleeve.b), G.neck);
      buf.pset(ca[0] + 2.4 * K, (ca[1] + cb[1]) / 2 + 1, M.red.l, G.neck);
    }
    const hc = Hd(-1.6, -2.6);
    const capPts = [];
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; capPts.push(Hd(-1.6 + Math.cos(a) * 8.7, -2.6 + Math.sin(a) * 10.2)); }
    buf.litR = 5;
    buf.poly(spline(capPts, true, 2), (x, y) => {
      const [lx, ly] = headXY(x, y);
      const ang = Math.atan2(ly + 11, lx + 1.5); // strands radiate from the crown
      const st = (ang * 9 + 50) % 1;
      if (st < 0.22) return M.hair.s;
      return M.hair.b;
    }, G.hairF);
    // face: authored pixel frames, not rig. Skin sprite now, features after lighting.
    const expr = p.fc === 3 ? 'pain' : hero.blink > 0 || p.fc === 2 ? 'closed' : p.fc === 1 || p.fc === 4 ? 'focus' : 'open';
    const mouth = p.fc === 3 || p.fc === 4 ? 'open' : 'smirk';
    const stamps = faceFrame(expr, mouth);
    // the skin shape turns with the head (nearest pixel) once the tilt is visible; level-ish stays exact
    const h0 = Hd(0, 0), h1 = Hd(10, 0), tilt = Math.atan2(h1[1] - h0[1], h1[0] - h0[0]);
    const rot = Math.abs(tilt) < 0.24 ? 0 : clamp(tilt, -0.6, 0.6), cr = Math.cos(rot), sr = Math.sin(rot);
    const cx0 = Math.round(h0[0]), cy0 = Math.round(h0[1]);
    const FS = { 1: M.face.l, 2: M.face.b, 3: M.face.s, 4: M.face.d };
    for (let y = cy0 - 18; y <= cy0 + 18; y++) for (let x = cx0 - 18; x <= cx0 + 18; x++) {
      const dx = x - cx0, dy = y - cy0;
      const c = Math.round(dx * cr + dy * sr) + FACE_CX, r = Math.round(-dx * sr + dy * cr) + FACE_CY;
      if (r < 0 || r >= FACE.skin.length || c < 0 || c >= FACE_W) continue;
      const ch = FACE.skin[r][c];
      if (ch === '.' || x < 0 || y < 0 || x >= buf.w || y >= buf.h) continue;
      buf.put(x, y, FS[ch], G.face);
    }
    buf.bump();
    const feats = [];
    for (const [rows, [ax, ay]] of stamps) {
      const u = ax - FACE_CX, v = ay - FACE_CY;
      const x0 = cx0 + Math.round(u * cr - v * sr), y0 = cy0 + Math.round(u * sr + v * cr);
      rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== '.') feats.push(x0 + c, y0 + r, row[c]); });
    }
    faceDecal = () => {
      const MAP = { b: C.blush, L: C.lash, D: C.irisDk, I: C.iris, i: C.irisLt, P: C.pupil, W: C.white, e: C.eyeWhite, k: M.face.d, s: M.face.s, m: C.lip, n: C.mouthIn, l: M.face.l };
      for (let i = 0; i < feats.length; i += 3) {
        if (feats[i] < 0 || feats[i + 1] < 0 || feats[i] >= buf.w || feats[i + 1] >= buf.h) continue;
        const j = feats[i + 1] * buf.w + feats[i];
        if (buf.grp[j] === G.face && buf.col[j]) buf.col[j] = MAP[feats[i + 2]];
      }
    };
    buf.litR = 3.5;
    buf.poly(spline(FIG.bangs.map(([x, y, sh]) => { const q = Hd(x, y); if (sh === 0) q.push(0); return q; }), true, 3), (x, y) => {
      const [lx, ly] = headXY(x, y);
      // strands fan from the crown toward the blunt cut
      const ang = Math.atan2(ly + 13, lx + 0.5);
      const st = (ang * 10 + 50) % 1;
      const ring = ly > -9.8 && ly < -7.9 && lx > -5.4 && lx < 4.8;
      if (ring) return st < 0.3 ? M.hair.b : (st < 0.7 && lx > -3 && lx < 2 ? M.hair.h : M.hair.l); // clumped angel ring
      if (st < 0.2 && ly > -7.9) return M.hair.d; // parting between strands
      if (st > 0.2 && st < 0.36 && ly > -7.4 && ly < -5.2) return M.hair.l; // lower sheen
      return M.hair.b;
    }, G.hairF);
    buf.litR = 0;
    const lock = (x0, y0, x1, y1, w0, w1) => {
      const pts = ribbonOutline([Hd(x0, y0), Hd((x0 + x1) / 2 - 0.2, (y0 + y1) / 2), Hd(x1, y1)], [w0 * 2 * K * HK, w0 * 1.9 * K * HK, w1 * 2 * K * HK], 'flat');
      buf.poly(spline(pts, true, 3), M.hair.b, G.hairF);
    };
    lock(-6.9, -5.4, -6.4, 8.8, 1.3, 1.25);
    lock(7.0, -4.2, 6.9, 5.8, 0.45, 0.4);
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
  // ---- near arm, then its shoulder cap
  const frontFist = p.gr === 0 || p.gr === 1 || p.gr === 3 ? 1 : p.hf;
  drawArm(J.sfx + ox, J.sfy + oy, J.efx + ox, J.efy + oy, J.wfx + ox, J.wfy + oy, G.armF, frontFist, 0);
  if (yaw < 0.5) {
    buf.litR = 3;
    buf.poly(spline(Tt(FIG.shoulderCap), true, 3), M.cloak.b, G.cap);
    buf.litR = 0;
  }
  if (p.bz === 1) {
    drawBlade(G.blade);
    if (p.gr !== 2) drawHand(J.wfx + ox, J.wfy + oy, J.bdx, J.bdy, 1, G.handF, 0);
    if (p.gr === 1) drawHand(J.wbx + ox, J.wby + oy, J.bdx, J.bdy, 1, G.handF, 0);
  }
  if ((p.gr === 2 || p.gr === 3) && p.bz === 1) drawHand(J.wbx + ox, J.wby + oy, J.bdx, J.bdy, 1, G.handF, 0);

  // ---- form lighting from the height fields (key light: top-right-front)
  const lit = (o) => Object.assign({ up: 0.09, dn: 0.1, dn2: 0.36 }, o);
  const cfg = {};
  for (const g of [G.legF, G.legB]) cfg[g] = lit({ shine: 0.955, pow: 40 });
  for (const g of [G.armF, G.armB, G.armB2]) cfg[g] = lit({});
  cfg[G.torso] = lit({ shine: 0.975, pow: 30 });
  cfg[G.corset] = lit({ shine: 0.95, pow: 30 });
  cfg[G.skirt] = lit({ dn2: 0.55 });
  cfg[G.hair] = lit({ up: 0.16, dn: 0.12, dn2: 0.45, str: 0.8 });
  cfg[G.hairFront] = lit({ shine: 0.9, pow: 18 });
  cfg[G.hairF] = lit({ up: 0.45, dn: 0.1, dn2: 0.4, str: 0.7 });
  for (const g of [G.tails, G.capeB, G.capelet, G.cap, G.capFar]) cfg[g] = lit({});
  for (const g of [G.shoeF, G.shoeB]) cfg[g] = lit({ shine: 0.85, pow: 14 });
  buf.light(cfg, LIGHT_DIR);
  buf.despeckle([G.skirt, G.hair, G.hairFront, G.hairF, G.torso, G.corset, G.legF, G.legB, G.armF, G.armB, G.armB2, G.tails, G.capelet, G.capeB]);

  // ---- cast shadows (anime cel shadows that follow the real shapes)
  buf.castShadow([G.skirt, G.corset], [G.legF, G.legB], Math.round(3 * K));
  buf.castShadow([G.hairF], [G.face], Math.round(2.2 * K));
  buf.castShadow([G.face, G.hairF], [G.neck], Math.round(3 * K));
  buf.castShadow([G.capelet, G.cap, G.collar, G.capFar], [G.torso, G.armF, G.armB2], Math.round(1.8 * K));
  buf.castShadow([G.corset], [G.torso], Math.round(1 * K), 0, 1);
  if (faceDecal) faceDecal();
}

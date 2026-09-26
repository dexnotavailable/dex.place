// ---------------------------------------------------------------------------
// Contour toolkit. The character is drawn as smooth outlines through named
// landmarks bound to bones (the way a figure is drawn), not as stacked sticks.
//   landmark = (bone, t along bone, offset across bone)   -- limbs
//   joint landmark = offset along the bisector of two bones -- knees, elbows
// Landmarks are joined with a centripetal Catmull-Rom spline, so every mass
// has one continuous curved silhouette that bends with the skeleton.
// ---------------------------------------------------------------------------

// bone frame: origin a, unit axis u (a->b), front normal n (+x for a bone pointing down)
function bone(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / L, uy = dy / L;
  return { ax, ay, bx, by, L, ux, uy, nx: uy, ny: -ux };
}
// point along a bone: t in bone lengths, off in base units (scaled by K)
function lmk(b, t, off) {
  return [b.ax + (b.bx - b.ax) * t + b.nx * off * K, b.ay + (b.by - b.ay) * t + b.ny * off * K];
}
// joint point between two bones sharing b1.b == b2.a, offset along the bisector
function lmkJoint(b1, b2, off, miter = true) {
  let nx = b1.nx + b2.nx, ny = b1.ny + b2.ny;
  const L = Math.hypot(nx, ny) || 1e-6;
  nx /= L; ny /= L;
  const c = Math.max(0.55, nx * b1.nx + ny * b1.ny); // cos of half-bend
  const k = miter ? 1 / c : 1;
  return [b1.bx + nx * off * K * k, b1.by + ny * off * K * k];
}
// frame point (rotated local coordinates, base units)
function lmkFrame(ox, oy, ang, x, y, s = K) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  return [ox + (c * x - sn * y) * s, oy + (sn * x + c * y) * s];
}

// Centripetal Catmull-Rom through points [[x,y],...]; returns a flat polygon.
// A point may carry a third value: 0 = sharp corner (no rounding), default smooth.
function spline(pts, closed = true, seg = 5) {
  const n = pts.length;
  if (n < 3) return pts.flat();
  const out = [];
  const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const sharp1 = p1[2] === 0, sharp2 = p2[2] === 0;
    if (sharp1 && sharp2) { out.push(p1[0], p1[1]); continue; }
    // centripetal parameterisation
    const d01 = Math.pow(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1e-3, 0.5);
    const d12 = Math.pow(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1e-3, 0.5);
    const d23 = Math.pow(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) || 1e-3, 0.5);
    // tangents (zeroed at sharp corners)
    let m1x = 0, m1y = 0, m2x = 0, m2y = 0;
    if (!sharp1) {
      m1x = (p2[0] - p1[0]) + d12 * ((p1[0] - p0[0]) / d01 - (p2[0] - p0[0]) / (d01 + d12));
      m1y = (p2[1] - p1[1]) + d12 * ((p1[1] - p0[1]) / d01 - (p2[1] - p0[1]) / (d01 + d12));
    }
    if (!sharp2) {
      m2x = (p2[0] - p1[0]) + d12 * ((p3[0] - p2[0]) / d23 - (p3[0] - p1[0]) / (d12 + d23));
      m2y = (p2[1] - p1[1]) + d12 * ((p3[1] - p2[1]) / d23 - (p3[1] - p1[1]) / (d12 + d23));
    }
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push(h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x, h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y);
    }
  }
  if (!closed) out.push(pts[n - 1][0], pts[n - 1][1]);
  return out;
}

// smooth ribbon: a spine polyline with widths -> one closed spline outline
// tip: 'point' (tapers to a point) or 'flat'
function ribbonOutline(spine, widths, tip = 'point') {
  const n = spine.length;
  const Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = widths[i] * 0.5;
    Lp.push([spine[i][0] - dy * w, spine[i][1] + dx * w]);
    Rp.push([spine[i][0] + dy * w, spine[i][1] - dx * w]);
  }
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(Lp[i]);
  if (tip === 'point') pts.push([spine[n - 1][0], spine[n - 1][1], 0]);
  for (let i = n - 1; i >= 0; i--) pts.push(Rp[i]);
  return pts;
}

// nearest-bone query for shading: returns [t, side] with side in [-1,1]
// widthsFront/back are landmark width tables sampled at t = 0..1 (base units)
function boneShadeCoords(b, x, y, wF, wB) {
  const rx = x + 0.5 - b.ax, ry = y + 0.5 - b.ay;
  const t = clamp((rx * b.ux + ry * b.uy) / b.L, 0, 1);
  const s = rx * b.nx + ry * b.ny;
  const f = t * (wF.length - 1), i = Math.min(wF.length - 2, Math.floor(f));
  const w = (s >= 0 ? lerp(wF[i], wF[i + 1], f - i) : lerp(wB[i], wB[i + 1], f - i)) * K;
  return [t, s / (w || 1)];
}

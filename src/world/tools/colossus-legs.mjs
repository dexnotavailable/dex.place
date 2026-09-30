// Colossus leg clearance check: the CPU twin of the walk and IK (colossus-plain/colossus.ts, the
// same numbers the shader and the dust and footfall systems read) over every stride the scenes use.
//
//   node src/world/tools/colossus-legs.mjs [--margin 0] [--verbose]
//
// For every moment of the gait (40 samples a step over three loops) it takes the lower bones of the
// eight legs (knee to ankle and the femur's knee) and reports the smallest gap between any two legs:
// near against far, and near against near or far against far for neighbouring legs, less 75% of the
// two bones' radii (the drawn limb is thicker than its axis). A gap below the margin is a clip: the
// two limbs fuse into one lump or pass through each other. The hip and upper femur are left out:
// they are inside the body, which covers them. Exit code 1 on any clip.
import { createServer } from "vite";

globalThis.window ??= globalThis;
const args = process.argv.slice(2);
const mi = args.indexOf("--margin");
const margin = mi >= 0 ? Number(args[mi + 1]) : 0;
const verbose = args.includes("--verbose");

// every stride (vd x T) the scenes use: arrival, ghost, plain, causeway, reed shallows
const GAITS = [["arrival main", 18, 4.4], ["ghosts", 13, 5.6], ["plain main", 16.5, 4.8], ["causeway main", 21, 4.6], ["reed shallows main", 22, 4.4]];

const server = await createServer({ root: process.cwd(), configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, logLevel: "error", optimizeDeps: { noDiscovery: true, include: [] } });
const C = await server.ssrLoadModule("/src/scenes/scenes/colossus-plain/colossus.ts");
await server.close();

const ik = (h, ft, a, b, bend) => {
  const dx = ft[0] - h[0], dy = ft[1] - h[1];
  const n = Math.hypot(dx, dy) || 1e-5;
  const l = Math.min(Math.max(n, Math.abs(a - b) + 0.5), a + b - 0.5);
  const dn = [dx / n, dy / n];
  const al = (a * a - b * b + l * l) / (2 * l);
  const hh = Math.sqrt(Math.max(0, a * a - al * al));
  return { kn: [h[0] + dn[0] * al - dn[1] * hh * bend, h[1] + dn[1] * al + dn[0] * hh * bend], end: [h[0] + dn[0] * l, h[1] + dn[1] * l] };
};
const pd = (p, s0, s1) => {
  const vx = s1[0] - s0[0], vy = s1[1] - s0[1];
  const L = vx * vx + vy * vy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - s0[0]) * vx + (p[1] - s0[1]) * vy) / L));
  return Math.hypot(p[0] - s0[0] - vx * t, p[1] - s0[1] - vy * t);
};
const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
const segDist = (a, b, c, d) => (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 ? 0 : Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b)));

function legs(c, tl) {
  const out = [];
  const list = C.legList(c);
  const bx = C.bodyX(c, tl), bob = C.bobAt(c, tl);
  list.forEach(({ leg, phase, far, hx }, n) => {
    const k = far ? c.far.scale : 1;
    const i = n % c.legs.length;
    const fo = far ? (C.FAR_LEGS?.[i] ?? { dx: c.far.dx, dy: c.far.dy }) : { dx: 0, dy: 0 };
    const hw = C.toWorld([leg.hip[0] + fo.dx, leg.hip[1] + fo.dy]);
    const f = C.foot(c, tl, phase, hx);
    const hip = [hw[0], hw[1] - bob];
    const lw = f.sw < 0 ? 0 : Math.min(1, f.sw / 0.2) * (1 - Math.max(0, (f.sw - 0.8) / 0.2));
    const k0 = leg.fem ? [hip[0] + leg.fem.len * Math.cos(leg.fem.ang + 0.12 * lw), hip[1] + leg.fem.len * Math.sin(leg.fem.ang + 0.12 * lw)] : hip;
    const { kn, end } = ik(k0, [f.x - bx, f.y], leg.a, leg.b, leg.bend);
    out.push({ far, i, pts: [k0, kn, end], r: [leg.r[1] * k, leg.r[2] * k] });
  });
  return out;
}

let fails = 0;
for (const [name, vd, T] of GAITS) {
  const c = { S: 1, ground: 0, x0: 0, period: 1e9, t0: 0, vd, T, duty: 0.64, lift: 22, bob: 3, legs: C.LEGS, far: { dx: 18, dy: 6, phase: 0.5, scale: 0.84 }, dendrites: false, seed: 1 };
  let worst = { gap: Infinity };
  let reach = -Infinity;
  let clips = 0;
  const N = Math.round(T * 3 * 13.3);
  for (let s = 0; s < N; s++) {
    const t = (s * T * 3) / N;
    const g = legs(c, t);
    // the rearmost drawn pixel: a knee joint swells to ~1.4 radii, the planted toes reach ~18 back
    for (const l of g) { reach = Math.max(reach, l.pts[1][0] + l.r[0] * 1.6, l.pts[2][0] + 18 * (l.far ? c.far.scale : 1)); }
    for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) {
      const A = g[a], B = g[b];
      if (A.far === B.far && Math.abs(A.i - B.i) > 1) continue;
      let gap = Infinity;
      for (let p = 1; p < 3; p++) for (let q = 1; q < 3; q++) gap = Math.min(gap, segDist(A.pts[p - 1], A.pts[p], B.pts[q - 1], B.pts[q]) - (A.r[p - 1] + B.r[q - 1]) * 0.75);
      if (gap < margin) clips++;
      if (gap < worst.gap) worst = { gap, a: `${A.far ? "far" : "near"}${A.i}`, b: `${B.far ? "far" : "near"}${B.i}`, t };
    }
  }
  if (clips) fails++;
  console.log(`${name.padEnd(20)} stride ${(vd * T).toFixed(0).padStart(3)}  tightest gap ${worst.gap.toFixed(1).padStart(6)} (${worst.a} / ${worst.b} at t ${worst.t.toFixed(2)})  clips ${clips}${verbose ? `  rearmost pixel at body x ${reach.toFixed(0)} (clip ${C.EXTENT.x1})` : ""}`);
}
console.log(fails ? `CLIPS in ${fails} gait(s)` : "no two legs come within the margin in any gait");
process.exit(fails ? 1 : 0);

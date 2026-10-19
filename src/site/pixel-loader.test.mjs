// node --test: the homepage's pixel loader and the paper ofuda (motion/pixel-loader.ts; Dex 10-18: "a smooth
// pixelized loading pixel graphic, then it forms into the ofuda ... simulate it and animate it like real paper").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import {
  BOX_H, BOX_W, COLORS, LoaderCore, OFUDA_BACK, OFUDA_FRONT, OFUDA_H, OFUDA_IN_IDLE, OFUDA_ROWS, OFUDA_W, PaperOfuda, TIE,
  TIMING, createPixelLoader, paperShift, toRGBA,
} from "./motion/pixel-loader.ts";

/** RGBA pixels of a non-interlaced 8-bit RGBA PNG. */
function readPng(file) {
  const b = readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  assert.equal(b[24], 8);
  assert.equal(b[25], 6);
  const idat = [];
  for (let o = 8; o < b.length;) {
    const len = b.readUInt32BE(o), type = b.toString("latin1", o + 4, o + 8);
    if (type === "IDAT") idat.push(b.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(w * h * 4), stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  return { w, h, px };
}

const frame = (core) => {
  const buf = new Uint8Array(BOX_W * BOX_H);
  core.render(buf);
  return buf;
};
const ofudaAtRest = () => {
  const want = new Uint8Array(BOX_W * BOX_H);
  for (let y = 0; y < OFUDA_H; y++) for (let x = 0; x < OFUDA_W; x++) {
    const c = OFUDA_FRONT[y * OFUDA_W + x];
    if (c) want[(TIE.y + y) * BOX_W + TIE.x - OFUDA_W / 2 + x] = c;
  }
  return want;
};
const lum = (c) => 0.2126 * COLORS[c][0] + 0.7152 * COLORS[c][1] + 0.0722 * COLORS[c][2];
const run = async (core, seconds, dt = 1 / 60, each) => {
  for (let t = 0; t < seconds; t += dt) {
    core.step(dt);
    each?.(t);
    await null; // let land()'s promise settle
  }
};

// ------------------------------------------------------------------------------------------------ the sprite

test("the ofuda is the paper on her hat in her idle, exact to the pixel: the idle's crop = ofuda.png = the sprite (Dex 10-19)", () => {
  // "whatever is on her hat right now, that's the ofuda for the opening and the website and everything, exact down to
  // the pixel": cut from public/assets/zhusha/idle/f000.png at OFUDA_IN_IDLE (lanes/ship/ofuda/ofuda.png for lane A)
  assert.equal(OFUDA_ROWS.length, OFUDA_H);
  assert.ok(OFUDA_ROWS.every((r) => r.length === OFUDA_W && /^[.a-z]+$/.test(r)));
  const png = readPng(new URL("../../public/site/loader/ofuda.png", import.meta.url));
  const idle = readPng(new URL(`../../public/assets/zhusha/idle/${OFUDA_IN_IDLE.file}`, import.meta.url));
  assert.deepEqual([png.w, png.h], [OFUDA_W, OFUDA_H]);
  let paper = 0;
  for (let y = 0; y < OFUDA_H; y++) for (let x = 0; x < OFUDA_W; x++) {
    const c = OFUDA_FRONT[y * OFUDA_W + x], i = (y * png.w + x) * 4;
    const j = ((OFUDA_IN_IDLE.y + y) * idle.w + OFUDA_IN_IDLE.x + x) * 4;
    if (!c) { assert.equal(png.px[i + 3], 0, `${x},${y} empty`); continue; }
    paper++;
    assert.equal(png.px[i + 3], 255);
    assert.deepEqual([png.px[i], png.px[i + 1], png.px[i + 2]], [...COLORS[c]], `ofuda.png ${x},${y}`);
    assert.equal(idle.px[j + 3], 255, `idle ${x},${y} opaque`);
    assert.deepEqual([idle.px[j], idle.px[j + 1], idle.px[j + 2]], [...COLORS[c]], `the idle's hat ${x},${y}`);
  }
  assert.equal(paper, 56);
});

test("the ofuda: nothing added (only her hat's own colours, no outline), its back darker, turned it steps darker or lighter", () => {
  const hat = new Set();
  OFUDA_FRONT.forEach((c) => { if (c) hat.add(COLORS[c].join()); });
  assert.equal(hat.size, 19, "her hat's paper has 19 colours");
  const mean = (t) => { let s = 0, n = 0; t.forEach((c) => { if (c) { s += lum(c); n++; } }); return s / n; };
  assert.ok(mean(OFUDA_BACK) < mean(OFUDA_FRONT) - 5, "the back is darker");
  for (const c of OFUDA_FRONT) {
    if (!c) continue;
    assert.equal(paperShift(c, 0), c);
    for (let s = -6; s < 4; s++) assert.ok(lum(paperShift(c, s)) <= lum(paperShift(c, s + 1)) + 1e-9, `step ${s} -> ${s + 1}`);
    assert.ok(lum(paperShift(c, -2)) < lum(c) && lum(paperShift(c, 2)) > lum(c), "darker and lighter");
  }
});

// ------------------------------------------------------------------------------------------------ the loader

test("crisp: every frame of every phase is whole palette pixels, hard alpha, inside the box", async () => {
  const core = new LoaderCore({ seed: 3 });
  const check = () => {
    const rgba = toRGBA(frame(core));
    for (let i = 3; i < rgba.length; i += 4) assert.ok(rgba[i] === 0 || rgba[i] === 255);
  };
  await run(core, 4, 1 / 30, check);
  void core.land();
  await run(core, 2.5, 1 / 30, check);
  assert.equal(core.phase, "paper");
  core.paper.wind.x = 40;
  await run(core, 3, 1 / 30, check);
});

test("loading: three ribbons in her scarlet, gold and azure keep moving, smoothly (a pixel or two a frame)", async () => {
  const core = new LoaderCore({ seed: 5 });
  const fams = new Set();
  let prev = null, changed = 0, last = null;
  for (let i = 0; i < 600; i++) {
    core.step(1 / 60);
    const px = core.ribbonPixels(core.t);
    for (const p of px) fams.add(p[3]);
    // the three heads move at most ~1.5 art px between 60 fps frames
    const heads = [0, 1, 2].map((k) => px.find((p) => p[3] === k && p[2] === 1));
    if (prev) for (let k = 0; k < 3; k++) assert.ok(Math.hypot(heads[k][0] - prev[k][0], heads[k][1] - prev[k][1]) < 1.6);
    prev = heads;
    if (i % 10 === 0) {
      const f = frame(core);
      if (last && f.some((v, j) => v !== last[j])) changed++;
      last = f;
    }
  }
  assert.deepEqual([...fams].sort(), [0, 1, 2]);
  assert.ok(changed >= 55, "it never stands still while loading");
  assert.equal(core.phase, "loading");
});

test("landOnOfuda: the pixels gather into the ofuda, a glint runs down it, and it lands on exactly the sprite", async () => {
  const core = new LoaderCore({ seed: 9 });
  await run(core, 2.3);
  let landed = 0, at = null;
  const p = core.land().then(() => { landed++; at = core.t; });
  const t0 = core.t;
  const seen = new Set();
  await run(core, 3, 1 / 60, () => seen.add(core.phase));
  await p;
  assert.equal(landed, 1);
  assert.ok(seen.has("gathering") && seen.has("glint") && seen.has("paper"));
  const took = at - t0;
  const want = TIMING.gatherSpread + 0.1 + TIMING.gatherFly + TIMING.glint;
  assert.ok(Math.abs(took - want) < 0.1, `landed in ${took.toFixed(2)} s`);
  // the first moment of paper is the sprite itself (no pop from the gather to the paper)
  const core2 = new LoaderCore({ seed: 9 });
  await run(core2, 2.3);
  void core2.land();
  let first = null;
  while (core2.phase !== "paper") { core2.step(1 / 60); await null; }
  first = frame(core2);
  const want2 = ofudaAtRest();
  // the glow left over from the ribbons may still be fading around it; the paper's own pixels must be the sprite
  for (let i = 0; i < want2.length; i++) if (want2[i]) assert.equal(first[i], want2[i], `pixel ${i % BOX_W},${(i / BOX_W) | 0}`);
});

test("the ofuda keeps living after it lands: it sways in the box's breeze, and a gust blows it aside", async () => {
  const core = new LoaderCore({ seed: 2 });
  core.settle();
  const xs = [];
  await run(core, 3, 1 / 60, () => xs.push(core.paper.p[30]));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.5, "it sways");
  core.paper.wind.x = 50;
  await run(core, 1.5);
  const bottom = (core.paper.p[30] + core.paper.p[33]) / 2;
  assert.ok(bottom > TIE.x + 5, `blown to the right (${bottom.toFixed(1)})`);
});

test("reduced motion: a static ofuda from the first frame; nothing moves; landing is immediate", async () => {
  const core = new LoaderCore({ seed: 4, reduced: { matches: true } });
  const want = ofudaAtRest();
  for (let i = 0; i < 120; i++) {
    core.step(1 / 30);
    assert.deepEqual(frame(core), want);
  }
  let ok = false;
  await core.land().then(() => { ok = true; });
  assert.ok(ok);
  core.paper.wind.x = 80;
  for (let i = 0; i < 60; i++) core.step(1 / 30);
  assert.deepEqual(frame(core), want);
});

test("the same seed gives the same frames (checks and recordings replay)", async () => {
  const a = new LoaderCore({ seed: 11 }), b = new LoaderCore({ seed: 11 });
  for (let i = 0; i < 200; i++) {
    a.step(1 / 60);
    b.step(1 / 60);
    if (i === 90) { void a.land(); void b.land(); }
    await null;
  }
  assert.deepEqual(frame(a), frame(b));
});

test("light enough for a phone: 10 s of loader + landing + paper, stepped and drawn at 60 fps, in well under a second", async () => {
  const core = new LoaderCore({ seed: 1 });
  const buf = new Uint8Array(BOX_W * BOX_H);
  const t0 = performance.now();
  for (let i = 0; i < 600; i++) {
    core.step(1 / 60);
    core.render(buf);
    if (i === 300) void core.land();
    await null;
  }
  const ms = performance.now() - t0;
  assert.ok(ms < 900, `${ms.toFixed(0)} ms for 600 frames`);
});

test("the page's side: createPixelLoader works without a canvas until start() (tick + phase + paper)", async () => {
  const L = createPixelLoader({ seed: 1 });
  assert.equal(L.phase, "loading");
  L.tick(0.5);
  const p = L.landOnOfuda();
  for (let i = 0; i < 120; i++) { L.tick(1 / 60); await null; }
  await p;
  assert.equal(L.phase, "paper");
  assert.ok(L.paper instanceof PaperOfuda);
});

// ------------------------------------------------------------------------------------------------ the paper

const linkLengthsOk = (paper) => {
  const P = paper.p, d = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  for (let r = 0; r <= 5; r++) {
    assert.ok(Math.abs(d(r * 2, r * 2 + 1) - OFUDA_W) < 0.6, `width at row ${r}: ${d(r * 2, r * 2 + 1)}`);
    if (r < 5) for (const c of [0, 1]) assert.ok(Math.abs(d(r * 2 + c, r * 2 + 2 + c) - OFUDA_H / 5) < 0.15 * OFUDA_H / 5, `length row ${r}`);
  }
};

test("paper: still air and no gusts -> it hangs as the sprite, exactly", () => {
  const paper = new PaperOfuda({ tie: { x: 10, y: 4 } });
  paper.gust = 0;
  for (let i = 0; i < 120; i++) paper.step(1 / 60);
  const r = paper.render();
  for (let y = 0; y < OFUDA_H; y++) for (let x = 0; x < OFUDA_W; x++) {
    const c = OFUDA_FRONT[y * OFUDA_W + x];
    const X = Math.round(10 - OFUDA_W / 2) + x - r.x0, Y = 4 + y - r.y0;
    assert.equal(r.idx[Y * r.w + X], c, `${x},${y}`);
  }
  let n = 0;
  r.idx.forEach((v) => { if (v) n++; });
  assert.equal(n, OFUDA_FRONT.filter((v) => v).length, "nothing else drawn");
});

test("paper: it never stretches or tears, through gusts, a fast carry and a release (and never goes NaN)", () => {
  const paper = new PaperOfuda({ tie: { x: 40, y: 6 }, seed: 5 });
  paper.gust = 1;
  for (let i = 0; i < 900; i++) {
    const t = i / 60;
    paper.wind.x = 30 * Math.sin(t * 0.7) + (i % 200 < 30 ? 80 : 0);
    paper.wind.z = 20 * Math.sin(t * 1.3);
    if (i < 400) paper.moveTie(40 + 30 * Math.sin(t * 2), 6 + 10 * Math.sin(t * 3));
    if (i === 400) paper.release();
    if (i === 700) paper.pin();
    paper.step(1 / 60);
    assert.ok(paper.p.every(Number.isFinite));
    if (i % 25 === 0) linkLengthsOk(paper);
  }
});

test("paper: pinned at a point it trails behind its tie when carried, and swings back under it", () => {
  const paper = new PaperOfuda({ tie: { x: 60, y: 5 } });
  paper.gust = 0;
  for (let i = 0; i < 30; i++) {
    paper.moveTie(60 - i * 1.2, 5);
    paper.step(1 / 60);
  }
  const bottomX = (paper.p[30] + paper.p[33]) / 2;
  assert.ok(bottomX > paper.tie.x + 3, `it trails to the right of a tie moving left (${(bottomX - paper.tie.x).toFixed(1)})`);
  for (let i = 0; i < 400; i++) paper.step(1 / 60);
  assert.ok(Math.abs((paper.p[30] + paper.p[33]) / 2 - paper.tie.x) < 1, "then hangs under it");
});

test("paper: held by its top edge (on the brim) the edge stays put while the rest flutters", () => {
  const paper = new PaperOfuda({ tie: { x: 20, y: 5 } });
  paper.hold = "edge";
  paper.wind.x = 40;
  paper.gust = 1;
  for (let i = 0; i < 240; i++) paper.step(1 / 60);
  const L = 20 - OFUDA_W / 2, R = 20 + OFUDA_W / 2, foot = 5 + OFUDA_H;
  assert.deepEqual([...paper.p.slice(0, 6)].map((v) => +v.toFixed(6)), [L, 5, 0, R, 5, 0]);
  // the bottom corners have left their resting places (rest: x L / R, y foot, z 0)
  const moved = Math.hypot(paper.p[30] - L, paper.p[31] - foot, paper.p[32]) + Math.hypot(paper.p[33] - R, paper.p[34] - foot, paper.p[35]);
  assert.ok(moved > 2, `the foot flutters (${moved.toFixed(1)})`);
});

test("paper: released it falls like paper, much slower than a stone, and drifts with the wind", () => {
  const paper = new PaperOfuda({ tie: { x: 20, y: 0 }, seed: 3 });
  paper.release();
  paper.wind.x = 20;
  for (let i = 0; i < 120; i++) paper.step(1 / 60);
  const y = (paper.p[1] + paper.p[4]) / 2, x = (paper.p[0] + paper.p[3]) / 2;
  const stone = 0.5 * paper.gravity * 2 * 2;
  assert.ok(y > 3 && y < stone * 0.35, `fell ${y.toFixed(1)} art px in 2 s (a stone: ${stone})`);
  assert.ok(x > 22, "carried downwind");
});

test("paper: seen edge-on it is still a line of paper (no vanishing), and turned over it shows its darker back", () => {
  const paper = new PaperOfuda({ tie: { x: 10, y: 2 } });
  const P = paper.p;
  // edge-on: the width turned into depth
  for (let r = 0; r <= 5; r++) {
    P[(r * 2) * 3] = 10; P[(r * 2) * 3 + 2] = -3;
    P[(r * 2 + 1) * 3] = 10; P[(r * 2 + 1) * 3 + 2] = 3;
  }
  let r = paper.render();
  const rowsWithInk = new Set();
  r.idx.forEach((v, i) => { if (v) rowsWithInk.add(Math.floor(i / r.w)); });
  assert.ok(rowsWithInk.size >= OFUDA_H - 1, `${rowsWithInk.size} rows drawn edge-on`);
  // turned over: mirror the two edges
  paper.reset();
  for (let r2 = 0; r2 <= 5; r2++) {
    const a = r2 * 2 * 3, b = (r2 * 2 + 1) * 3;
    const xa = P[a];
    P[a] = P[b];
    P[b] = xa;
  }
  r = paper.render();
  const mean = (idx) => { let s = 0, n = 0; idx.forEach((v) => { if (v) { s += lum(v); n++; } }); return s / n; };
  paper.reset();
  const front = paper.render();
  assert.ok(mean(r.idx) < mean(front.idx) - 4, "its back is darker");
});

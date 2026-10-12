// Tesu engine checks that need no browser: the continuous ground (slopes, edges, one-way
// planks, walls, mass), the camera projection (dolly and lens, plane levels) and plate
// painting (deterministic, seamless across tiles).
import test from "node:test";
import assert from "node:assert/strict";
import { Collision, walkY } from "./collide.ts";
import { planeScale, planeArtScale, planeLevels, levelFor, planeXf, project, unproject, rowOf } from "./render/view.ts";
import { buildWorld } from "./world/index.ts";
import { PlateIndex, paintRegion, paintTile } from "./plates/paint.ts";
import { PALETTE_SIZE } from "./art/palette.ts";
import { H, TILE } from "./config.ts";

const body = (x, y) => ({ x, y, w: 12, h: 44, vx: 0, vy: 0, grounded: false, dropThrough: 0 });

test("a walk is a polyline: y between its points, null outside", () => {
  const w = { id: 1, pts: [0, 100, 100, 50, 200, 50], surface: "stone", oneWay: false, depth: Infinity };
  assert.equal(walkY(w, 50), 75);
  assert.equal(walkY(w, 150), 50);
  assert.equal(walkY(w, -1), null);
  assert.equal(walkY(w, 201), null);
});

test("walking follows a slope up and down, and steps off the end into a fall", () => {
  const c = new Collision([{ id: 1, pts: [0, 500, 300, 400, 600, 400], surface: "stone", oneWay: false, depth: 200 }], []);
  const b = body(10, 490);
  c.move(b, 0, 20);
  assert.ok(b.grounded);
  for (let i = 0; i < 100; i++) c.move(b, 3, 0.5);
  assert.ok(b.grounded, "still on the slope");
  assert.ok(Math.abs(b.y - walkY(c.walks[0], b.x)) < 0.01, "feet on the ground line");
  for (let i = 0; i < 120; i++) { b.vy = Math.min(8, b.vy + 0.6); c.move(b, 3, b.vy); }
  assert.ok(!b.grounded && b.y > 400, "walked off the end and fell");
});

test("solid mass blocks from the side; a wall stops her; a one-way plank drops through", () => {
  const c = new Collision([
    { id: 1, pts: [0, 500, 1000, 500], surface: "stone", oneWay: false, depth: Infinity },
    { id: 2, pts: [300, 470, 400, 470], surface: "stone", oneWay: false, depth: 300 },
    { id: 3, pts: [600, 440, 700, 440], surface: "wood", oneWay: true, depth: 8 },
  ], [{ x: 900, y0: 380, y1: 500, reason: "rail" }]);
  const b = body(250, 500);
  c.move(b, 0, 1);
  for (let i = 0; i < 40; i++) c.move(b, 3, 0.5);
  assert.ok(b.x < 300, `blocked by the 30 px ledge (x ${b.x})`);
  const k = body(850, 500);
  c.move(k, 0, 1);
  for (let i = 0; i < 40; i++) c.move(k, 3, 0.5);
  assert.ok(k.x <= 900 - 6 + 0.01, `stopped at the rail (x ${k.x})`);
  const p = body(650, 430);
  c.move(p, 0, 20);
  assert.equal(c.standingOn?.id, 3);
  assert.ok(c.onOneWay(p));
  p.dropThrough = 10;
  p.grounded = false;
  for (let i = 0; i < 20; i++) c.move(p, 0, 6);
  assert.equal(c.standingOn?.id, 1, "dropped through the plank onto the ground");
});

test("camera planes: a dolly keeps far planes steady; planes in front take a lens zoom above 1", () => {
  assert.equal(planeScale(1, 0.5), 0.5);
  assert.ok(Math.abs(planeScale(0.08, 1) - 0.08) < 1e-9);
  assert.ok(planeArtScale(0.08, 0.125) > 0.6, "far ranges stay large in the widest frame");
  assert.ok(planeArtScale(0.62, 0.125) < 0.25);
  assert.ok(Math.abs(planeScale(0.5, 2) - 2 / 3) < 1e-9, "a dolly in: the middle distance grows a little");
  assert.ok(Math.abs(planeScale(1.35, 2) - 2.7) < 1e-9, "near planes zoom like a lens");
  const lv = planeLevels(1);
  assert.deepEqual(lv, [2, 1, 0.5, 0.25, 0.125]);
  assert.equal(levelFor(lv, 0.7), 1);
  assert.equal(levelFor(lv, 0.5), 0.5);
  assert.equal(levelFor(lv, 3), 2);
});

test("projection: her feet sit on the anchor row at every zoom, and unproject inverts it", () => {
  for (const zoom of [2, 1, 0.5, 0.125]) {
    const c = { cx: 9600, cy: 5952, zoom, anchor: 0.66, horizon: 0.38, W: 1536, H: 864 };
    const [x, y] = project(c, 1, 9600, 5952);
    assert.ok(Math.abs(x - 768) <= 1 && Math.abs(y - 0.66 * 864) <= 1, `zoom ${zoom}: ${x},${y}`);
    for (const r of [0.08, 0.62, 1.35]) {
      const [fx, fy] = project(c, r, 9000, 6000);
      const [ux, uy] = unproject(c, r, fx, fy);
      assert.ok(Math.abs(ux - 9000) < 20 / planeXf(c, r).s && Math.abs(uy - 6000) < 20 / planeXf(c, r).s);
    }
    // a far plane's waterline sits nearer the horizon than the play plane's
    assert.ok(rowOf(c, 0.08, 6010) < rowOf(c, 1, 6010));
  }
});

test("the world builds, every walk is valid, and the opening is continuous", () => {
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  assert.ok(w.pieces.length > 10);
  assert.ok(PALETTE_SIZE <= 256);
  // from the catch to the hall door there is ground at every step with no step over 0.3 H
  const catchS = w.spawns.find((s) => s.id === "catch");
  let prev = null;
  for (let x = catchS.x; x <= 145.5 * H; x += 8) {
    const g = c.groundBelow(x, catchS.y - 12 * H, false);
    assert.ok(g, `ground at ${(x / H).toFixed(1)} H`);
    if (prev !== null) assert.ok(Math.abs(g.y - prev) < 0.3 * H, `smooth at ${(x / H).toFixed(1)} H`);
    prev = g.y;
  }
});

test("plates: tiles are deterministic and join seamlessly with a one-region paint", () => {
  const idx = new PlateIndex(buildWorld());
  const tx = Math.floor((100 * H) / TILE), ty = Math.floor((62.2 * H) / TILE);
  const a = paintTile(idx, "play", 1, tx, ty);
  const b = paintTile(idx, "play", 1, tx, ty);
  assert.ok(a && b);
  assert.deepEqual(a, b);
  const big = paintRegion(idx, "play", 1, tx * TILE, ty * TILE, TILE * 2, TILE);
  const right = paintTile(idx, "play", 1, tx + 1, ty);
  for (let y = 0; y < TILE; y += 7) {
    for (let x = 0; x < TILE; x += 5) {
      assert.equal(big.px[y * TILE * 2 + x], a[y * TILE + x]);
      assert.equal(big.px[y * TILE * 2 + TILE + x], right ? right[y * TILE + x] : 0);
    }
  }
});

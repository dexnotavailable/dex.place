// env-hall library checks: node --test src/tesu/art/library/hall/hall.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../../../world/index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";
import { HALL_MANIFEST, gongFrame } from "./index.ts";

test("every manifest asset is a registered painter and is placed in the world", () => {
  const w = buildWorld();
  for (const a of HALL_MANIFEST) {
    assert.ok(painter(a.kind), a.kind);
    const placed = a.as === "piece" ? w.pieces.some((p) => p.kind === a.kind) : w.sprites.some((s) => s.kind === a.kind);
    assert.ok(placed, `${a.kind} placed`);
  }
});

test("the dressing adds no ground, walls or usables (layout stays the builder's)", () => {
  const w = buildWorld();
  for (const u of w.usables) assert.ok(!u.id.startsWith("hall-dress"), u.id);
  assert.ok(w.sprites.some((s) => s.id === "gong"), "the gong sprite exists for the bout's hook");
});

test("the Prow Stair's dressed last run lies on the stair's walk", () => {
  const w = buildWorld();
  const walk = w.walks.find((x) => x.name === "prow-stair");
  const run = w.pieces.find((p) => p.kind === "court.stairrun");
  assert.ok(walk && run, "both exist");
  const [ax, ay, bx, by] = walk.pts;
  const yAt = (x) => ay + ((by - ay) * (x - ax)) / (bx - ax);
  assert.ok(Math.abs(run.y - yAt(run.x)) < 1.5, `start ${run.y} vs ${yAt(run.x)}`);
  assert.ok(Math.abs(run.x + run.p.x1 - bx) < 1.5 && Math.abs(run.y + run.p.y1 - by) < 1.5, "the mouth");
});

test("gongFrame: at rest before and after the strike, 11 frames of swing", () => {
  assert.equal(gongFrame(null), 0);
  assert.equal(gongFrame(-5), 0);
  assert.equal(gongFrame(0), 1);
  assert.equal(gongFrame(54), 11);
  assert.equal(gongFrame(55), 0);
});

test("pieces paint deterministically at every level they are used", () => {
  const w = buildWorld();
  const kinds = new Set();
  for (const pc of w.pieces) {
    if (!pc.kind.startsWith("hall.") && !pc.kind.startsWith("court.")) continue;
    if (kinds.has(pc.kind)) continue;
    kinds.add(pc.kind);
    const pt = painter(pc.kind);
    const [x0, y0] = pt.bounds(pc.p);
    for (const d of [1, 0.5]) {
      const paint = () => {
        const buf = new IdxBuf(64, 64, Math.floor(x0 * d), Math.floor(y0 * d) + 8, d);
        pt.paint(ctxFor(buf, d, 0, 0, pc.seed), pc.p);
        return buf.px;
      };
      assert.deepEqual(paint(), paint(), `${pc.kind} at ${d}`);
    }
  }
  assert.ok(kinds.size >= 20, `${kinds.size} kinds checked`);
});

test("Dex's 10-14 layout: the court's gate in the middle, the desk right on its left, the map right on its right, every service with room", () => {
  const w = buildWorld();
  const H = 96;
  const hall = w.places.find((p) => p.id === "hall-of-works");
  const floor = w.walks.find((k) => k.name === "hall-floor");
  const FY = floor.pts[1];
  const U = (id) => w.usables.find((u) => u.id === id);
  const door = U("great-doors"), desk = U("hanko-desk"), map = U("map-pillar"), box = U("offering-box");
  const at = ((door.x0 + door.x1) / 2 - hall.x0) / (hall.x1 - hall.x0);
  assert.ok(at > 0.45 && at < 0.55, `the gate at ${at.toFixed(3)} of the hall`);
  const ground = w.usables.filter((u) => u.y1 === FY && !u.id.startsWith("art-frame")).sort((a, b) => a.x0 - b.x0);
  const i = ground.indexOf(door);
  assert.equal(ground[i - 1], desk, "the desk is the service right left of the gate");
  assert.equal(ground[i + 1], map, "the map is the service right right of the gate");
  for (let k = 1; k < ground.length; k++) assert.ok(ground[k].x0 - ground[k - 1].x1 >= 1.39 * H, `${ground[k - 1].id} | ${ground[k].id}: ${((ground[k].x0 - ground[k - 1].x1) / H).toFixed(2)} H`);
  assert.ok(box.x1 < desk.x0, "the offering box stands on its own, off the desk");
  // her size at charScale 0.88 is about 0.98 H: the counter at her waist
  const hanko = w.sprites.find((s) => s.id === "hanko");
  const top = (FY - hanko.y + 4) / H;
  assert.ok(top > 0.5 && top < 0.62, `the counter top at ${top.toFixed(2)} H`);
});

test("the court's ring is drawn side-on (no seal on the floor) and the bout frames it", () => {
  const w = buildWorld();
  const floor = w.pieces.find((p) => p.kind === "court.floor");
  assert.ok(floor.p.seal[1] < 1, "the perspective seal is gone");
  const ring = w.pieces.find((p) => p.kind === "court.ring");
  assert.ok(ring, "the side-on ring is placed");
  const bout = w.tracks.find((t) => t.id === "bout");
  const mid = ring.x + ring.p.w / 2;
  assert.ok(Math.abs(bout.keys[0].fixX - mid) < 2, `the bout holds on the ring's middle (${bout.keys[0].fixX} vs ${mid})`);
});

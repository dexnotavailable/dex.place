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

test("every door leads to a spawn, and the Prize Court stands on ground between its walls", () => {
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  for (const u of w.usables) {
    if (u.action.kind !== "door") continue;
    assert.ok(w.spawns.some((s) => s.id === u.action.to), `door ${u.id} -> ${u.action.to}`);
  }
  const gate = w.spawns.find((s) => s.id === "court-gate");
  assert.ok(gate, "the court's gate spawn");
  for (let x = gate.x; x <= 191.6 * H; x += 8) {
    const g = c.groundBelow(x, gate.y - 2 * H, false);
    // (the Prow Stair's mouth is bridged by its grate, so the floor runs all the way)
    assert.ok(g && Math.abs(g.y - gate.y) < 0.01, `court floor at ${(x / H).toFixed(1)} H`);
  }
  for (const id of ["bao", "stands", "champion", "install-bar", "glint", "champion-hp"]) assert.ok(w.sprites.some((s) => s.id === id), `sprite ${id}`);
});

test("prizes come from the downloads data: an entry's own file, or the file of the entry that installs it, else none", async () => {
  // (Dex 10-26: the site's one download is YUKI, its file from GitHub Releases once the first release is out; dexCode
  // and dexClient are retired, so their plaques win nothing until the world's props are updated)
  const { prizeFor } = await import("./court.ts");
  const { downloads } = await import("../site/data/downloads.ts");
  for (const d of downloads) {
    const prize = prizeFor(d.id);
    const owner = d.file ? d : downloads.find((x) => x.id === d.installedBy);
    if (owner?.file) {
      assert.equal(prize.owner.id, owner.id);
      assert.equal(prize.file.href, owner.file.href);
    } else {
      assert.equal(prize, null, `${d.id}: no file, no prize`);
    }
  }
  for (const gone of ["dexclient", "dexcode", "nothing"]) assert.equal(prizeFor(gone), null, gone);
});

test("destruction: a broken crate's pieces and the jar it carried all come to rest on real ground", async () => {
  const { Props } = await import("./props.ts");
  const w = buildWorld();
  const col = new Collision(w.walks, w.walls);
  const sprites = new Map(w.sprites.map((s) => [s.id, { ...s }]));
  const crate = w.props.find((p) => p.id === "terrace-crate");
  const jar = w.props.find((p) => p.id === "terrace-jar");
  assert.equal(jar.on, "terrace-crate");
  let swing = [{ box: { x: crate.x - 20, y: crate.y - 30, w: 40, h: 30 }, hb: { damage: 10, knockback: [2, -1], hitstop: 4, group: "a", x: 0, y: 0, w: 0, h: 0 } }];
  const player = { body: { x: crate.x - 60, y: crate.y }, facing: 1, clip: { index: 0, hitGroups: new Map(), hit: false }, hitboxes: () => swing };
  const noop = () => {};
  const props = new Props({
    player, vfx: { spawn: noop }, feel: { freeze: noop, sound: noop }, camera: { shake: noop },
    ground: (x, y) => col.groundBelow(x, y)?.y ?? null,
    addSprite: (s) => sprites.set(s.id, s), removeSprite: (id) => sprites.delete(id),
    setFlag: noop, hasFlag: () => false, usables: () => [], bottom: w.h + 400,
  }, w.props, (id) => sprites.get(id));
  props.takeHits(player);
  swing = [];
  assert.match(props.state()["terrace-crate"], /^broken/);
  for (let i = 0; i < 600; i++) props.tick();
  assert.equal(props.airborne(), 0, "nothing left in the air");
  // the jar fell with its support: it is no longer standing on the crate's top
  const js = sprites.get("prop:terrace-jar");
  const gy = col.groundBelow(js.x, js.y - 60)?.y ?? 0;
  assert.ok(js.hidden || Math.abs(js.y + 1 - gy) < 1.5, `the jar is on the ground or broken (${js.y} vs ${gy}, ${props.state()["terrace-jar"]})`);
  // every piece of the crate rests on the ground under it (its pixels' bottom on the ground line)
  const live = props.list.find((l) => l.d.id === "terrace-crate");
  assert.ok(live.pieces.length >= 3);
  for (const pc of live.pieces) {
    const bottom = live.y + pc.dy + pc.box[3];
    const cx = live.x + pc.dx + (pc.box[0] + pc.box[2]) / 2;
    const g = col.groundBelow(cx, bottom - 3)?.y;
    assert.ok(pc.rest && g !== undefined && Math.abs(bottom - g) < 1.5, `piece ${pc.def.id} rests on the ground (${bottom} vs ${g})`);
  }
});

test("pieces: every pixel of a prop belongs to exactly one piece, the same at any density", async () => {
  const { pieceOf } = await import("./art/painters/props.ts");
  const b = [-20, -40, 20, 0];
  const seen = new Set();
  for (let y = -40; y < 0; y += 2) for (let x = -20; x < 20; x += 2) {
    const i = pieceOf(x + 0.5, y + 0.5, b, 5, 77);
    assert.ok(i >= 0 && i < 5);
    assert.equal(pieceOf(x + 0.5, y + 0.5, b, 5, 77), i);
    seen.add(i);
  }
  assert.ok(seen.size >= 3, "a prop really comes apart");
});

test("Shiraito joins the court both ways: the Prow Stair from the path's top to the court floor, the path down to the village", () => {
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  const stair = w.walks.find((k) => k.name === "prow-stair");
  assert.ok(stair && stair.stair, "the Prow Stair is a stair");
  const path = w.walks.find((k) => k.name === "shiraito");
  const village = w.walks.find((k) => k.name === "shiraito-village");
  // the stair's foot meets the path's top, its top the court floor
  assert.ok(Math.abs(stair.pts[0] - path.pts[path.pts.length - 2]) < 1 && Math.abs(stair.pts[1] - path.pts[path.pts.length - 1]) < 1);
  const tip = w.walks.find((k) => k.name === "prize-court-tip");
  assert.ok(Math.abs(stair.pts[stair.pts.length - 2] - tip.pts[0]) < 1 && Math.abs(stair.pts[stair.pts.length - 1] - tip.pts[1]) < 1);
  // the path's foot meets the village
  assert.ok(Math.abs(village.pts[village.pts.length - 2] - path.pts[0]) < 1 && Math.abs(village.pts[village.pts.length - 1] - path.pts[1]) < 1);
  // no wall across the way between them
  for (const wall of w.walls) assert.ok(!(wall.x > path.pts[0] && wall.x < tip.pts[0] && wall.y1 > stair.pts[1] - 96 && wall.y0 < path.pts[1]) || wall.x > 186 * H, `no wall at ${(wall.x / H).toFixed(1)} H`);
  // a body walked up the stair from its foot ends on the court
  const body = { x: stair.pts[0] - 20, y: stair.pts[1], w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
  c.move(body, 0, 1);
  for (let i = 0; i < 2000 && body.x < tip.pts[0] + 40; i++) { c.move(body, 3, 0); c.move(body, 0, 2); }
  assert.ok(Math.abs(body.y - tip.pts[1]) < 2, `on the court floor at the top (${(body.x / H).toFixed(1)} H, ${(body.y / H).toFixed(2)} H)`);
});

test("Hoài Phố: the drops land on its ground, the pool's steps lead out, the lift opens from below", () => {
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  const quay = w.walks.find((k) => k.name === "hoai-pho");
  const pool = w.walks.find((k) => k.name === "splash-pool");
  const village = w.walks.find((k) => k.name === "shiraito-village");
  // stepping off the village's west lip falls onto the West Shore
  const lipX = village.pts[0] - 0.6 * H;
  const g1 = c.groundBelow(lipX, village.pts[1], false);
  assert.ok(g1 && g1.walk === quay, `the West Shore under the village's lip (${g1?.walk.name})`);
  // off the end of the Prow Leap falls into the splash pool
  const leap = w.walks.find((k) => k.name === "prow-leap");
  const g2 = c.groundBelow(leap.pts[leap.pts.length - 2] + 0.4 * H, leap.pts[1] + H, false);
  assert.ok(g2 && g2.walk === pool, `the splash pool under the Prow Leap (${g2?.walk.name})`);
  // out of the pool by its west steps, walking left
  const body = { x: pool.pts[0] + 0.5 * H, y: pool.pts[1], w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
  c.move(body, 0, 1);
  for (let i = 0; i < 400 && body.x > 186 * H; i++) { c.move(body, -3, 0); c.move(body, 0, 2); }
  assert.ok(Math.abs(body.y - quay.pts[1]) < 2, `up the steps onto the quay (${(body.x / H).toFixed(1)} H, ${(body.y / H).toFixed(2)} H)`);
  // the lift: the lower station opens it, the upper one needs it
  const low = w.usables.find((u) => u.id === "lift-low"), top = w.usables.find((u) => u.id === "lift-top");
  assert.equal(low.action.opens, "lift:waterwheel");
  assert.equal(top.action.needs, "lift:waterwheel");
  assert.ok(w.spawns.some((s) => s.id === "lift-top") && w.spawns.some((s) => s.id === "lift-low"));
});

test("the Prow Stair's mouth: walked across both ways on its grate, and the stair still climbs to the tip", () => {
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  const tip = w.walks.find((k) => k.name === "prize-court-tip");
  const main = w.walks.find((k) => k.name === "prize-court");
  const body = { x: tip.pts[0] + 0.6 * H, y: tip.pts[1], w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
  c.move(body, 0, 1);
  for (let i = 0; i < 300 && body.x > main.pts[2] - 1.5 * H; i++) { c.move(body, -3, 0); c.move(body, 0, 2); }
  assert.ok(Math.abs(body.y - main.pts[1]) < 1, `from the tip across to the court (${(body.x / H).toFixed(1)} H, ${(body.y / H).toFixed(2)} H)`);
  for (let i = 0; i < 300 && body.x < tip.pts[0] + 1 * H; i++) { c.move(body, 3, 0); c.move(body, 0, 2); }
  assert.ok(Math.abs(body.y - tip.pts[1]) < 1, `and back to the tip (${(body.x / H).toFixed(1)} H)`);
  assert.ok(w.spawns.some((s) => s.id === "prow-stair-in"), "F at the mouth sets her on the stair");
});

test("the Silk Line: a car waits at each station, the ride carries her up to Kumoji and back down", async () => {
  const { Rides, along } = await import("./ride.ts");
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  const def = w.rides.find((r) => r.id === "silk-line");
  assert.ok(def, "the Silk Line exists");
  const sprites = new Map(w.sprites.map((s) => [s.id, { ...s }]));
  const rides = new Rides(w.rides, { sprite: (id) => sprites.get(id) });
  // each station has its usable, on ground, with a car docked over it
  const low = w.usables.find((u) => u.id === "silk-line"), top = w.usables.find((u) => u.id === "silk-line-top");
  assert.deepEqual([low.action.kind, low.action.dir, top.action.kind, top.action.dir], ["ride", 1, "ride", -1]);
  const [lx, ly] = along(def.pts, 0), [tx, ty] = along(def.pts, 1);
  const gLow = c.groundBelow(lx, ly + def.hang - 4, false), gTop = c.groundBelow(tx, ty + def.hang - 4, false);
  assert.equal(gLow?.walk.name, "east-quay", "the low dock is over the east quay");
  assert.equal(gTop?.walk.name, "kumoji", "the high dock is over Kumoji");
  assert.ok(Math.abs(gLow.y - (ly + def.hang)) < 2 && Math.abs(gTop.y - (ty + def.hang)) < 2, "the cars' floors are level with the stations");
  assert.ok(lx >= low.x0 && lx <= low.x1 && tx >= top.x0 && tx <= top.x1, "the docks are inside the stations' usables");
  // up: board at the low station, ride the whole way, step off on Kumoji
  const body = { x: lx, y: ly + def.hang, w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
  assert.ok(rides.board("silk-line", 1, body));
  let done = null, n = 0, minY = Infinity, mid = null;
  while (!done && n < 60 * 60) {
    done = rides.tick(body);
    rides.world.move(body, 0, 1);
    minY = Math.min(minY, body.y);
    if (n === 20 * 60) mid = [rides.carAt("silk-line", 0), rides.carAt("silk-line", 1)];
    n++;
  }
  assert.ok(done && Math.abs(n / 60 - def.secs) < 0.1, `about ${def.secs} s up (${(n / 60).toFixed(1)} s)`);
  assert.ok(Math.abs(body.x - tx) < 1 && Math.abs(body.y - (ty + def.hang)) < 1, "set down at the top dock");
  // the two cars pass each other half way
  assert.ok(Math.hypot(mid[0][0] - mid[1][0], mid[0][1] - mid[1][1]) < 2 * H, "the cars meet midway");
  body.grounded = false;
  c.move(body, 0, 2);
  assert.equal(c.standingOn?.name, "kumoji", "she stands on Kumoji");
  // on along Kumoji to its gate, never falling
  for (let i = 0; i < 4000 && body.x < 338 * H; i++) { c.move(body, 4, 0); c.move(body, 0, 2); }
  assert.ok(body.x > 337 * H && c.standingOn?.name === "kumoji", `Kumoji walks to its gate (${(body.x / H).toFixed(1)} H)`);
  assert.ok(!w.voids.some((v) => body.x >= v.x0 && body.x <= v.x1 && body.y > v.y && (v.y1 === undefined || body.y < v.y1)), "the road is above the sea of mist's void");
  // and down again in the car now waiting at the top
  body.x = tx; body.y = ty + def.hang; body.grounded = true;
  assert.ok(rides.board("silk-line", -1, body));
  done = null; n = 0;
  while (!done && n < 60 * 60) { done = rides.tick(body); rides.world.move(body, 0, 1); n++; }
  assert.ok(Math.abs(body.x - lx) < 1 && Math.abs(body.y - (ly + def.hang)) < 1, "set down at the low dock");
  assert.ok(minY < 90 * H, "the ride climbed to Kumoji's height");
});

test("every wall is a real edge: walking into it from the ground at its foot leaves her standing", () => {
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  const bad = [];
  for (const wall of w.walls) {
    for (const side of [1, -1]) {
      // side 1: she stands to the right and walks left into it
      if ((side === 1 && wall.from === "left") || (side === -1 && wall.from === "right")) continue;
      const x = wall.x + side * 1.5 * H;
      const g = c.groundBelow(x, wall.y0, false);
      if (!g || g.y > wall.y1 + 0.3 * H || g.y < wall.y0) continue;
      const body = { x, y: g.y, w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
      c.move(body, 0, 1);
      for (let i = 0; i < 120; i++) { c.move(body, -side * 3, 0); c.move(body, 0, 2); }
      // (still on ground, not fallen: the way to the wall may climb, or go down a stair to its landing)
      if (!body.grounded || body.y - g.y > 2 * H) bad.push(`${wall.reason} at ${(wall.x / H).toFixed(2)} H from the ${side > 0 ? "right" : "left"}: fell to ${(body.y / H).toFixed(1)} H`);
    }
  }
  assert.deepEqual(bad, []);
});

test("the Kumo-bashi: rolled up until cut from Kumoji, then a deck walked both ways between the court and Kumoji", async () => {
  const { BRIDGE_FLAG } = await import("./world/sections/shanshui.ts");
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  const bridge = w.walks.find((k) => k.name === "kumo-bashi");
  assert.ok(bridge && bridge.when === BRIDGE_FLAG && bridge.oneWay, "a one-way deck, gated by the cut");
  const x0 = bridge.pts[0], x1 = bridge.pts[bridge.pts.length - 2];
  // before the cut: no deck; off the tip is the Prow Leap's fall
  assert.equal(c.groundBelow(x0 + 4 * H, bridge.pts[1] - 2, false)?.walk.name === "kumo-bashi", false);
  // the cut is a permanent prop on the Kumoji side whose breaking sets the flag
  assert.ok(w.props.some((p) => p.id === "kumo-bashi-lashing" && p.cls === "permanent"));
  c.gate((f) => f === BRIDGE_FLAG);
  // from Kumoji's platform west across the deck to the court
  const body = { x: x1 + 1.5 * H, y: w.walks.find((k) => k.name === "kumoji").pts[1], w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
  c.move(body, 0, 1);
  for (let i = 0; i < 4000 && body.x > x0 - 0.8 * H; i++) { c.move(body, -3, 0); c.move(body, 0, 2); }
  assert.ok(body.grounded && /prize-court|prow-leap|kumo-bashi/.test(c.standingOn?.name ?? ""), `across to the court (${(body.x / H).toFixed(1)} H on ${c.standingOn?.name})`);
  for (let i = 0; i < 4000 && body.x < x1 + 1 * H; i++) { c.move(body, 3, 0); c.move(body, 0, 2); }
  assert.equal(c.standingOn?.name, "kumoji", "and back to Kumoji");
});

test("the Pillar Hop: every gap needs its charms, every charm is in Q's reach, every perch jumps to the next ground", async () => {
  const { HOP_PILLARS, HOP_CHARMS, bridgeY } = await import("./world/sections/shanshui.ts");
  const { CHARM_PERCH } = await import("./config.ts");
  const w = buildWorld();
  assert.equal(w.charms.length, HOP_CHARMS.length);
  const court = w.walks.find((k) => k.name === "prow-leap"), kumoji = w.walks.find((k) => k.name === "kumoji");
  // the grounds in order: the plank's end, the pillars, Kumoji's edge ([left x, right x, y] in px)
  const grounds = [[court.pts[0], court.pts[2], court.pts[1]], ...HOP_PILLARS.map(([a, b, t]) => [a * H, b * H, t * H]), [kumoji.pts[0], kumoji.pts[2], kumoji.pts[1]]];
  // the charms between each pair of grounds, by x
  for (let g = 0; g + 1 < grounds.length; g++) {
    const [, from, fy] = grounds[g], [to, , ty] = grounds[g + 1];
    assert.ok(to - from > 4.5 * H, `gap ${g + 1} is past a plain jump (${((to - from) / H).toFixed(1)} H)`);
    const cs = w.charms.filter((c) => c.x > from && c.x < to).sort((a, b) => a.x - b.x);
    assert.ok(cs.length >= 1, `gap ${g + 1} has a charm`);
    // Q's reach from the edge, then from perch to perch
    let px = from, py = fy;
    for (const ch of cs) {
      const dx = ch.x - px, dy = ch.y + CHARM_PERCH - py;
      assert.ok(dx >= 0.5 * H && dx <= 7 * H && dy >= -4.5 * H && dy <= 4 * H, `charm ${ch.id} in reach (${(dx / H).toFixed(1)}, ${(dy / H).toFixed(1)} H)`);
      [px, py] = [ch.x, ch.y + CHARM_PERCH];
    }
    // from the last perch a jump (with the double jump and the air dash) reaches the next ground
    assert.ok(to - px <= 3.4 * H && py - ty <= 1.1 * H, `from the last perch to ground ${g + 2} (${((to - px) / H).toFixed(1)} H across, ${((py - ty) / H).toFixed(1)} H up)`);
  }
  // the bridge's deck passes over every pillar and charm with room
  for (const [a, b, t] of HOP_PILLARS) for (const x of [a, b]) assert.ok(t * H - bridgeY(x * H) > 1.5 * H, `deck over pillar at ${x} H`);
  for (const ch of w.charms) assert.ok(ch.y - bridgeY(ch.x) > 0.3 * H, `deck over ${ch.id}`);
  // a missed hop falls into the sea of mist (tugged back), never onto ground far below
  for (const [, b, t] of HOP_PILLARS) assert.ok(w.voids.some((v) => b * H + 2 * H >= v.x0 && b * H + 2 * H <= v.x1 && v.y < 120 * H), `a void under the gap after the pillar at ${b} H`);
});

test("atmos: the world's entries switch exactly as before, and a blend width makes a change gradual in x and y", async () => {
  const { blendAtmos, DEFAULT_WATER } = await import("./atmos-blend.ts");
  const { INTERIOR_Y } = await import("./config.ts");
  const w = buildWorld();
  // the old hard switch, for comparison, over the world's entries that have no blend width
  const list0 = w.atmos.filter((e) => !e.blend);
  const old = (x, y) => {
    const list = list0.filter((e) => (e.y0 === undefined || y >= e.y0) && (e.y1 === undefined || y <= e.y1) && (e.y0 !== undefined || y < INTERIOR_Y));
    let a = list[0] ?? list0[0];
    for (const e of list) if (e.x <= x) a = e;
    return a;
  };
  for (let x = 0; x <= 480 * H; x += 7 * H) for (const y of [40 * H, 60 * H, 120 * H, 196 * H, 290 * H]) {
    const a = old(x, y), b = blendAtmos(list0, x, y, INTERIOR_Y);
    assert.deepEqual([b.sky, b.haze, b.mist, b.mistColour, b.sun, b.water, b.grade], [a.sky, a.haze, a.mist, a.mistColour, a.sun, a.water ?? DEFAULT_WATER, a.grade ?? [1, 1, 1, 0]], `same light at ${x / H}, ${y / H} H`);
  }
  // a warmer, darker place laid over with a 20 H blend: no step bigger than a hair along x or y
  const A = { x: 0, sky: ["#8fb6cf", "#d3e6e3", "#edf5ef"], haze: "#dfe9e6", mist: 0.4, mistColour: "#eef4f0", sun: [0.2, 0.11] };
  const B = { x: 100 * H, y0: 150 * H, blend: 20 * H, sky: ["#6a7fa0", "#e8c9a0", "#f0d9b8"], haze: "#c9b8a0", mist: 0.7, mistColour: "#d9cbb8", sun: [0.3, 0.2], water: { deep: "#0f2a33", body: "#1f4a50", shallow: "#6f9a98", glint: "#ffe6b0" }, grade: [1, 0.92, 0.8, 0.3] };
  const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
  let prev = null, maxStep = 0;
  for (let x = 80 * H; x <= 120 * H; x += 0.25 * H) {
    const a = blendAtmos([A, B], x, 170 * H, INTERIOR_Y);
    if (prev) maxStep = Math.max(maxStep, Math.abs(lum(a.sky[1]) - lum(prev.sky[1])), Math.abs(lum(a.water.deep) - lum(prev.water.deep)));
    prev = a;
  }
  assert.ok(maxStep <= 12, `gradual along x (largest step ${maxStep} over 0.25 H)`);
  assert.equal(blendAtmos([A, B], 85 * H, 170 * H, INTERIOR_Y).haze, A.haze, "before the blend: the first place");
  assert.equal(blendAtmos([A, B], 115 * H, 170 * H, INTERIOR_Y).haze, B.haze, "past it: the second");
  prev = null; maxStep = 0;
  for (let y = 130 * H; y <= 170 * H; y += 0.25 * H) {
    const a = blendAtmos([A, B], 120 * H, y, INTERIOR_Y);
    if (prev) maxStep = Math.max(maxStep, Math.abs(lum(a.haze) - lum(prev.haze)));
    prev = a;
  }
  assert.ok(maxStep <= 12, `gradual along y, across its band's edge (largest step ${maxStep})`);
});

// Round 5 (Kagami's sky lane): a place's own plane hazes (Kagami's mid plane keeps its darks) and
// its glow's plain flag blend like the rest of its light: a gradual change, the plane's own haze
// where neither place has one.
test("atmos: a place's own plane hazes blend gradually into the plane's standard haze", async () => {
  const { blendAtmos } = await import("./atmos-blend.ts");
  const { INTERIOR_Y } = await import("./config.ts");
  const { PLANES } = await import("./world/types.ts");
  const A = { x: 0, sky: ["#8fb6cf", "#d3e6e3", "#edf5ef"], haze: "#dfe9e6", mist: 0, mistColour: "#eef4f0", sun: [0.2, 0.11], fades: { mid: 0.16 }, glow: { radius: 0.26, strength: 0.5, colour: "#fff1d8" } };
  const B = { x: 100 * H, blend: 20 * H, sky: ["#8fb6cf", "#d3e6e3", "#edf5ef"], haze: "#dfe9e6", mist: 0.8, mistColour: "#eef4f0", sun: [0.2, 0.11], glow: { radius: 0.26, strength: 0.5, colour: "#fff1d8", plain: true } };
  assert.equal(blendAtmos([A, B], 50 * H, 60 * H, INTERIOR_Y).fades.mid, 0.16);
  assert.equal(blendAtmos([A, B], 150 * H, 60 * H, INTERIOR_Y).fades?.mid ?? PLANES.mid.fade, PLANES.mid.fade);
  assert.equal(blendAtmos([A, B], 150 * H, 60 * H, INTERIOR_Y).glow.plain, true);
  let prev = null;
  for (let x = 85 * H; x <= 115 * H; x += 0.5 * H) {
    const f = blendAtmos([A, B], x, 60 * H, INTERIOR_Y).fades?.mid ?? PLANES.mid.fade;
    if (prev !== null) assert.ok(f >= prev - 1e-9 && f - prev < 0.02, `gradual at ${x / H} H (${prev} -> ${f})`);
    prev = f;
  }
  assert.equal(blendAtmos([A, B], 50 * H, 60 * H, INTERIOR_Y).fades.far, undefined, "a plane it does not name keeps its own");
});

test("Tsuji's Chain Stair and the East Pavilion's galleries: zigzag up to the top and back down to the street", async () => {
  const { TSUJI_Y } = await import("./world/sections/shanshui.ts");
  const { PEAK_Y } = await import("./world/sections/tsuji.ts");
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  // walk one way until stopped by a rail, then the other, until she reaches the height wanted
  const zigzag = (body, dir, goal, up) => {
    let stuck = 0;
    for (let i = 0; i < 20000; i++) {
      const x = body.x;
      c.move(body, dir * 3, 0); c.move(body, 0, 2);
      if (!body.grounded) return `fell at ${(body.x / H).toFixed(1)}, ${(body.y / H).toFixed(1)} H`;
      if ((up && body.y <= goal + 1) || (!up && body.y >= goal - 1)) return null;
      if (Math.abs(body.x - x) < 0.01) { if (++stuck > 2) { dir = -dir; stuck = 0; } } else stuck = 0;
    }
    return `stuck at ${(body.x / H).toFixed(1)}, ${(body.y / H).toFixed(1)} H`;
  };
  // the Chain Stair: hop onto its first step from the street, climb to the Peak, then walk back down
  const f1 = w.walks.find((k) => k.name === "chain-stair-1");
  const body = { x: f1.pts[0] + 0.3 * H, y: 0, w: 12, h: 44, vx: 0, vy: 0, grounded: false, dropThrough: 0 };
  body.y = c.groundBelow(body.x, f1.pts[1] - 0.5 * H, false).y;
  c.move(body, 0, 1);
  assert.equal(c.standingOn?.name, "chain-stair-1", "on the first flight (a hop up from the street)");
  assert.equal(zigzag(body, 1, PEAK_Y, true), null, "up the Chain Stair");
  for (let i = 0; i < 400 && c.standingOn?.name !== "the-peak"; i++) { c.move(body, -3, 0); c.move(body, 0, 2); }
  assert.equal(c.standingOn?.name, "the-peak", "out on the Peak");
  assert.equal(zigzag(body, 1, TSUJI_Y - 0.35 * H, false), null, "and down it again, landing by landing");
  // the street passes under the first step: walking along Tsuji is not diverted up the needle
  const street = { x: 364 * H, y: TSUJI_Y, w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
  c.move(street, 0, 1);
  for (let i = 0; i < 600 && street.x < 380 * H; i++) { c.move(street, 3, 0); c.move(street, 0, 2); }
  assert.equal(c.standingOn?.name, "tsuji", "along the street past the needle");
  // the East Pavilion: from its bridge up the galleries to the kite station, and back down
  const pav = { x: 455.6 * H - 60, y: 0, w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
  pav.y = w.walks.find((k) => k.name === "pavilion-1").pts[1];
  c.move(pav, 0, 1);
  const top = w.walks.find((k) => k.name === "pavilion-4");
  assert.equal(zigzag(pav, 1, top.pts[1], true), null, "up the pavilion's stairs");
  assert.equal(zigzag(pav, -1, w.walks.find((k) => k.name === "pavilion-1").pts[1] - 1, false), null, "and down");
});

test("the flume from Tsuji to Yuemen and the Kite Line to the Peak: one-way rides that set her down on ground", async () => {
  const { Rides, along, slideTable } = await import("./ride.ts");
  const { ringTop, RING_CX, RING_R } = await import("./world/sections/yuemen.ts");
  const w = buildWorld();
  const c = new Collision(w.walks, w.walls);
  const sprites = new Map(w.sprites.map((s) => [s.id, { ...s }]));
  const rides = new Rides(w.rides, { sprite: (id) => sprites.get(id) }, H);
  for (const [id, from, to] of [["flume", "tsuji", "yuemen"], ["kite-line", "pavilion-4", "the-peak"]]) {
    const def = w.rides.find((r) => r.id === id);
    assert.ok(def && def.oneWay, `${id} is one way`);
    const [sx, sy] = along(def.pts, 0), [ex, ey] = along(def.pts, 1);
    assert.equal(c.groundBelow(sx, sy + def.hang - 4, false)?.walk.name, from, `${id} starts over ${from}`);
    assert.equal(c.groundBelow(ex, ey + def.hang - 4, false)?.walk.name, to, `${id} ends over ${to}`);
    const body = { x: sx, y: sy + def.hang, w: 12, h: 44, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
    assert.equal(rides.board(id, -1, body), false, `${id} cannot be ridden back`);
    assert.ok(rides.board(id, 1, body));
    let done = null, n = 0;
    while (!done && n < 4000) { done = rides.tick(body); rides.world.move(body, 0, 1); n++; }
    assert.ok(done && Math.abs(n / 60 - def.secs) < 0.2, `${id} takes about ${def.secs} s (${(n / 60).toFixed(1)})`);
    body.grounded = false; body.y -= 4; c.move(body, 0, 8);
    assert.equal(c.standingOn?.name, to, `set down on ${to}`);
  }
  // the flume is a slide: fast on its drops, slow on its runs; it stays above the ring until it lands
  const fl = w.rides.find((r) => r.id === "flume");
  const tab = slideTable(fl.pts, fl.secs, fl.slide.min, fl.slide.gain, H);
  const speeds = [];
  for (let i = 1; i < tab.t.length; i++) speeds.push((tab.u[i] - tab.u[i - 1]) / (tab.t[i] - tab.t[i - 1]));
  assert.ok(Math.max(...speeds) / Math.min(...speeds) > 2, "its speed swings with the drops");
  for (let s = 0; s < 0.97; s += 0.01) {
    const [x, y] = along(fl.pts, s);
    if (Math.abs(x - RING_CX) < RING_R) assert.ok(y < ringTop(x) - 1.5 * H, `above the ring at ${(x / H).toFixed(1)} H`);
  }
});

// env-hall library checks: node --test src/tesu/art/library/hall/hall.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../../../world/index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";
import { HALL_MANIFEST, gongFrame } from "./index.ts";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

test("every art piece hangs as a pixelized preview made at its exact size (python -I tools/hall/pixelize_art.py)", () => {
  const w = buildWorld();
  const pub = fileURLToPath(new URL("../../../../../public", import.meta.url));
  const art = w.sprites.filter((s) => s.id.startsWith("art-"));
  assert.ok(art.length >= 9, `${art.length} pieces`);
  for (const s of art) {
    const src = String(s.p.src);
    assert.match(src, /^\/tesu\/hall-art\/\w+-\d+x\d+\.png$/, s.id);
    assert.ok(src.endsWith(`-${s.p.w}x${s.p.h}.png`), `${s.id}: ${src} vs ${s.p.w}x${s.p.h}`);
    assert.ok(existsSync(pub + src), `${src} missing: run python -I tools/hall/pixelize_art.py`);
  }
});

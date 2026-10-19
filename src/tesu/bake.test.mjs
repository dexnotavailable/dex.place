// The build's bake (engine, perf 10-18): the baked world and tiles are the game's own, byte for byte.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { buildWorld } from "./world/index.ts";
import { PlateIndex, paintTile } from "./plates/paint.ts";
import { bakeKeys, parseKey, worldFromJson, worldToJson, BAKE_SIZES } from "./plates/bake.ts";
import { openingTiles, planeLevelTable } from "./plates/span.ts";
import { Collision } from "./collide.ts";

test("bake: the world survives the JSON trip exactly (infinite depths, undefined fields)", () => {
  const w = buildWorld();
  assert.deepStrictEqual(worldFromJson(worldToJson(w)), w);
});

test("bake: it covers every tile the opening draws at each baked frame size", () => {
  const w = buildWorld();
  const keys = new Set(bakeKeys(w));
  const c = new Collision(w.walks, w.walls);
  c.minX = 0; c.maxX = w.w;
  for (const [fw, fh] of BAKE_SIZES) {
    const { span } = openingTiles(w, c, fw, fh, false, planeLevelTable());
    for (const k of span.keys()) assert.ok(keys.has(k), `${fw}x${fh}: ${k} not baked`);
  }
  assert.deepEqual(bakeKeys(w), [...keys], "the same keys every time");
});

test("bake: a baked tile is the painter's tile, byte for byte", () => {
  const dir = mkdtempSync(join(tmpdir(), "tesu-bake-test-"));
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL("./tools/bake.mjs", import.meta.url)), dir, "--limit", "120", "--threads", "2"], { stdio: "ignore" });
    const index = JSON.parse(readFileSync(join(dir, "plates.json"), "utf8"));
    const idx = new PlateIndex(buildWorld());
    const packs = index.packs.map((f) => readFileSync(join(dir, f)));
    let n = 0;
    for (const [k, [pi, off, len]] of Object.entries(index.tiles)) {
      const { plane, level, tx, ty } = parseKey(k);
      const baked = inflateRawSync(packs[pi].subarray(off, off + len));
      const painted = paintTile(idx, plane, level, tx, ty);
      assert.ok(painted, `${k} paints something`);
      assert.ok(Buffer.from(painted).equals(baked), `${k} differs`);
      n++;
    }
    assert.ok(n > 10, `compared ${n} tiles`);
    assert.deepStrictEqual(worldFromJson(readFileSync(join(dir, "world.json"), "utf8")), buildWorld());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

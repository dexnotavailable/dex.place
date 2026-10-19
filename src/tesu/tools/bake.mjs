// The build's bake (plates/bake.ts): paints the plate tiles the opening needs and the world description, at build
// time, with the game's own painters, and writes them as compressed packs.
//   node src/tesu/tools/bake.mjs <out dir> [--threads n] [--limit n]
// Writes <out>/world.json, <out>/plates-<plane>-<level>.bin (deflate-raw tiles one after another) and
// <out>/plates.json ({ packs: [file names], tiles: { key: [pack, offset, length] } }); empty tiles are left out (the
// workers find those empty at once). Exit 0 with a summary line.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

if (isMainThread) {
  const a = process.argv.slice(2);
  const opt = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d; };
  const out = a[0];
  if (!out) { console.error("usage: node bake.mjs <out dir> [--threads n] [--limit n]"); process.exit(2); }
  const t0 = performance.now();
  const { buildWorld } = await import("../world/index.ts");
  const { bakeKeys, packOf, worldToJson } = await import("../plates/bake.ts");
  const world = buildWorld();
  let keys = bakeKeys(world);
  const limit = Number(opt("limit", "0"));
  if (limit) keys = keys.slice(0, limit);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "world.json"), worldToJson(world));
  const n = Math.max(1, Math.min(Number(opt("threads", "0")) || availableParallelism() - 1, 12));
  // the workers paint and compress; tiles come back as [key, bytes | null]
  const results = new Map();
  let next = 0;
  await new Promise((resolve, reject) => {
    let live = 0;
    for (let i = 0; i < n; i++) {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: {} });
      live++;
      const feed = () => {
        if (next >= keys.length) { w.postMessage(null); return; }
        const batch = keys.slice(next, next + 8);
        next += batch.length;
        w.postMessage(batch);
      };
      w.on("message", (m) => {
        if (m === "ready") { feed(); return; }
        for (const [k, b] of m) results.set(k, b);
        feed();
      });
      w.on("error", reject);
      w.on("exit", () => { if (--live === 0) resolve(); });
    }
  });
  // packs: per plane and level, tiles in key order
  const packs = new Map();
  for (const k of keys) {
    const b = results.get(k);
    if (!b) continue;
    const p = packOf(k);
    if (!packs.has(p)) packs.set(p, []);
    packs.get(p).push([k, b]);
  }
  const index = { v: 1, tile: 256, packs: [], tiles: {} };
  let bytes = 0, tiles = 0;
  for (const [p, list] of [...packs].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const file = `plates-${p}.bin`;
    const pi = index.packs.length;
    index.packs.push(file);
    let off = 0;
    const parts = [];
    for (const [k, b] of list) {
      index.tiles[k] = [pi, off, b.length];
      parts.push(b);
      off += b.length;
      tiles++;
    }
    bytes += off;
    writeFileSync(join(out, file), Buffer.concat(parts));
  }
  writeFileSync(join(out, "plates.json"), JSON.stringify(index));
  console.log(`[bake] ${tiles} painted tiles of ${keys.length} asked (${keys.length - tiles} empty), ${index.packs.length} packs, ${(bytes / 1e6).toFixed(2)} MB, ${n} threads, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
} else {
  const { buildWorld } = await import("../world/index.ts");
  const { PlateIndex, paintTile } = await import("../plates/paint.ts");
  const { parseKey } = await import("../plates/bake.ts");
  const idx = new PlateIndex(buildWorld());
  parentPort.on("message", (batch) => {
    if (!batch) { process.exit(0); }
    const outb = [];
    for (const k of batch) {
      const { plane, level, tx, ty } = parseKey(k);
      const px = paintTile(idx, plane, level, tx, ty);
      outb.push([k, px ? deflateRawSync(px, { level: 9 }) : null]);
    }
    parentPort.postMessage(outb);
  });
  parentPort.postMessage("ready");
  void workerData;
}

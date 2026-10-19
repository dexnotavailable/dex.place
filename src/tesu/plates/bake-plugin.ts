// The build's bake as a Vite plugin (engine, perf 10-18; plates/bake.ts says why). On `vite build` it runs
// src/tesu/tools/bake.mjs (the game's own painters, in Node worker threads) and emits the world description, the tile
// index and the tile packs as content-hashed files under assets/ (cached for good: the server marks assets/ immutable).
// The page reads where they are from the virtual module "virtual:tesu-bake". On the dev server it is empty: everything
// is painted live, as before (so a painter change shows at once).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";

const ID = "virtual:tesu-bake";
const RESOLVED = "\0" + ID;

export function tesuBake(): Plugin {
  let build = false;
  let root = process.cwd();
  let urls: { index: string | null; world: string | null } = { index: null, world: null };
  return {
    name: "tesu-bake",
    configResolved(c) {
      build = c.command === "build" && process.env.TESU_BAKE !== "0";
      root = c.root;
    },
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    buildStart() {
      if (!build) return;
      const dir = mkdtempSync(join(tmpdir(), "tesu-bake-"));
      try {
        const script = join(root, "src/tesu/tools/bake.mjs");
        const out = execFileSync(process.execPath, [script, dir], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 16 << 20 });
        process.stdout.write(out.split("\n").filter((l) => l.startsWith("[bake]")).join("\n") + "\n");
        const hash = (b: Buffer): string => createHash("sha256").update(b).digest("hex").slice(0, 10);
        const index = JSON.parse(readFileSync(join(dir, "plates.json"), "utf8")) as { packs: string[] };
        // packs under their content hash, the index pointing at those names
        index.packs = index.packs.map((f) => {
          const b = readFileSync(join(dir, f));
          const fileName = `assets/${f.replace(/\.bin$/, "")}-${hash(b)}.bin`;
          this.emitFile({ type: "asset", fileName, source: b });
          return "/" + fileName;
        });
        const ib = Buffer.from(JSON.stringify(index));
        const indexName = `assets/plates-${hash(ib)}.json`;
        this.emitFile({ type: "asset", fileName: indexName, source: ib });
        const wb = readFileSync(join(dir, "world.json"));
        const worldName = `assets/world-${hash(wb)}.json`;
        this.emitFile({ type: "asset", fileName: worldName, source: wb });
        urls = { index: "/" + indexName, world: "/" + worldName };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    load(id) {
      if (id !== RESOLVED) return null;
      return `export default ${JSON.stringify(urls)};`;
    },
  };
}

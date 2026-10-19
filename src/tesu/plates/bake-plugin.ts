// The build's bake as a Vite plugin (engine, perf 10-18; plates/bake.ts says why). On `vite build` it runs
// src/tesu/tools/bake.mjs (the game's own painters, in Node worker threads) and emits the world description, the tile
// index and the tile packs as content-hashed files under assets/ (cached for good: the server marks assets/ immutable).
// The page reads where they are from the virtual module "virtual:tesu-bake". On the dev server it is empty: everything
// is painted live, as before (so a painter change shows at once).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";

const ID = "virtual:tesu-bake";
const RESOLVED = "\0" + ID;
const ART_ID = "virtual:tesu-art";
const ART_RESOLVED = "\0" + ART_ID;

/**
 * (lane C 10-19) Content versions of the drawings the game fetches by name from public/assets (her slots, the cast's,
 * the effects'): one hash per folder that holds an anim.json or fx.json, over every file in it. The server and
 * Cloudflare keep everything under /assets/ for a year (immutable), so a re-slotted move under the same file names
 * would show its old drawings; the loaders add `?v=<hash>` (zhusha/anims.ts artQuery), a new URL whenever a drawing
 * changes. Keyed by the folder's URL ("/assets/zhusha/idle").
 */
export function artVersions(publicDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, url: string, depth: number): void => {
    if (!existsSync(dir) || depth > 3) return;
    const names = readdirSync(dir).sort();
    if (names.includes("anim.json") || names.includes("fx.json")) {
      const h = createHash("sha256");
      for (const n of names) {
        const f = join(dir, n);
        if (!statSync(f).isFile()) continue;
        h.update(n).update("\0").update(readFileSync(f)).update("\0");
      }
      out[url] = h.digest("hex").slice(0, 10);
    }
    for (const n of names) if (statSync(join(dir, n)).isDirectory()) walk(join(dir, n), `${url}/${n}`, depth + 1);
  };
  for (const top of ["zhusha", "cast", "fx"]) walk(join(publicDir, "assets", top), `/assets/${top}`, 0);
  return out;
}

export function tesuBake(): Plugin {
  let build = false;
  let root = process.cwd();
  let urls: { index: string | null; world: string | null } = { index: null, world: null };
  let art: Record<string, string> = {};
  return {
    name: "tesu-bake",
    configResolved(c) {
      build = c.command === "build" && process.env.TESU_BAKE !== "0";
      root = c.root;
      // the art's versions on every build (the dev server serves the files fresh: no versions there)
      art = c.command === "build" && c.publicDir ? artVersions(c.publicDir) : {};
    },
    resolveId(id) {
      return id === ID ? RESOLVED : id === ART_ID ? ART_RESOLVED : null;
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
      if (id === ART_RESOLVED) return `export default ${JSON.stringify(art)};`;
      if (id !== RESOLVED) return null;
      return `export default ${JSON.stringify(urls)};`;
    },
  };
}

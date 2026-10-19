// The page's own code stays free of the world's art (engine, perf 10-19): the art libraries, painters and sections load
// only where the world is built or painted (the plate workers, the build's bake, Node tools, ?manual captures, which
// import them dynamically). This walks src/tesu/main.ts's static imports and fails if one reaches them.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const IMPORT = /^\s*(import|export)\s(?!type\b)[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm;
// allowed small pieces: the gong's frames, the court's numbers, the props' painters (breaking props paint on the page)
const ALLOWED = new Set(["art/library/hall/gong.ts", "world/sections/court-marks.ts", "art/painters/props.ts"]);
const isArt = (rel) => /^art\/library\/|^art\/painters\/|^world\/sections\//.test(rel) || rel === "world/index.ts" || rel === "render/sprite-paint.ts";

test("split: the page's static imports never reach the world's art libraries, painters or sections", () => {
  const seen = new Set(), bad = [];
  const walk = (file, from) => {
    if (seen.has(file) || !file.endsWith(".ts") || !existsSync(file)) return;
    seen.add(file);
    const rel = relative(here, file).replaceAll("\\", "/");
    if (isArt(rel) && !ALLOWED.has(rel)) { bad.push(`${from} -> ${rel}`); return; }
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const spec = m[2] ?? m[3];
      if (!spec || !spec.startsWith(".")) continue;
      walk(resolve(dirname(file), spec.split("?")[0]), rel);
    }
  };
  walk(resolve(here, "main.ts"), "(entry)");
  assert.deepEqual(bad, []);
  assert.ok(seen.size > 30, `walked ${seen.size} modules`);
});

// (lane C 10-19) props.ts measures and breaks the world's props on the page (painter(kind) in its constructor): the
// built page failed to start ("no painter called op.bucket") until main.ts loaded art/page-painters.ts. Every prop's
// painter must come from what the page loads before the game starts (else main.ts falls back to every painter).
test("split: every prop's painter is among the ones the page loads before the game starts", async () => {
  const { painterKinds } = await import("./art/painter.ts");
  await import("./art/page-painters.ts");
  const page = new Set(painterKinds());
  const { buildWorld } = await import("./world/index.ts");
  const missing = [...new Set(buildWorld().props.map((p) => p.kind))].filter((k) => !page.has(k));
  assert.deepEqual(missing, []);
  const main = readFileSync(resolve(here, "main.ts"), "utf8");
  assert.match(main, /import\("\.\/art\/page-painters\.ts"\)/);
});

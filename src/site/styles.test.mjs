// node --test: stylesheet invariants that a browser would fail silently on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("./styles/", import.meta.url);
const sheets = readdirSync(dir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => ({ file: f, css: readFileSync(new URL(f, dir), "utf8") }));

test("no @keyframes name is defined twice across src/site/styles", () => {
  // All sheets land in one bundle; a later duplicate silently replaces the
  // earlier one everywhere (this once flattened every floating shape's drift).
  const seen = new Map();
  const dupes = [];
  for (const { file, css } of sheets) {
    for (const [, name] of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
      if (seen.has(name)) dupes.push(`${name}: ${seen.get(name)} and ${file}`);
      else seen.set(name, file);
    }
  }
  assert.deepEqual(dupes, []);
});

test("every animation name used has a matching @keyframes", () => {
  const defined = new Set(sheets.flatMap(({ css }) => [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])));
  const missing = [];
  for (const { file, css } of sheets) {
    for (const [, name] of css.matchAll(/(?:^|[;{\s])animation:\s*([a-z][\w-]*)/g)) {
      if (["none", "inherit", "initial", "unset"].includes(name)) continue;
      if (!defined.has(name)) missing.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("per-frame motion values are never written as custom properties on :root", () => {
  // An inherited custom property on <html> restyles the whole page each frame.
  const root = sheets.map(({ css }) => css).join("\n").match(/:root\s*\{[^}]*\}/g) ?? [];
  for (const block of root) {
    for (const name of ["--world-progress", "--mx", "--my", "--sy", "--tx", "--ty"]) {
      assert.ok(!block.includes(`${name}:`), `${name} declared on :root`);
    }
  }
  const motion = new URL("./motion/", import.meta.url);
  for (const f of readdirSync(motion).filter((n) => n.endsWith(".ts"))) {
    const ts = readFileSync(new URL(f, motion), "utf8");
    assert.doesNotMatch(ts, /documentElement\.style\.setProperty|root\.style\.setProperty/, `${f} writes on <html>`);
  }
});

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
      // (a var(): the names come from the page, e.g. the card rigs' --anim, render/cardart.ts motionCss; checked below)
      if (["none", "inherit", "initial", "unset", "var"].includes(name)) continue;
      if (!defined.has(name)) missing.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(missing, []);
  // the rigs' motions only ever name keyframes that exist
  for (const name of ["rig-sway", "rig-breathe", "rig-bob", "rig-glow", "rig-flicker", "rig-drift", "rig-drift-fade"]) assert.ok(defined.has(name), name);
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

test("Departure Mono (Dex 10-19: yes): in the repo with its OFL licence beside it, on its own 11 px grid, credited", async () => {
  const { existsSync, statSync } = await import("node:fs");
  const dir = new URL("../../public/fonts/departure-mono/", import.meta.url);
  const font = new URL("DepartureMono-Regular.woff2", dir);
  assert.ok(existsSync(font) && statSync(font).size > 10000, "the woff2 is in");
  const lic = readFileSync(new URL("LICENSE.txt", dir), "utf8");
  assert.match(lic, /SIL Open Font License, Version 1\.1/);
  assert.match(lic, /Helena Zhang/);
  const v2 = readFileSync(new URL("./styles/v2.css", import.meta.url), "utf8");
  const face = v2.match(/@font-face \{[^}]*font-family: "Departure Mono";[^}]*\}/)?.[0] ?? "";
  assert.match(face, /src: url\("\/fonts\/departure-mono\/DepartureMono-Regular\.woff2"\) format\("woff2"\)/);
  // drawn on 11 px, the site's text on 16 px: scaled 11 / 16 so its font pixels land on whole screen pixels
  assert.match(face, /size-adjust: 68\.75%/);
  assert.equal(11 / 16, 0.6875);
  // the stacks name it first for labels and code; code never shrinks off its grid or gets a fake bold
  assert.match(v2, /--f-label: "Departure Mono"/);
  assert.match(v2, /--f-mono: "Departure Mono"/);
  assert.match(v2, /code, kbd, pre, \.prose code, \.prose kbd, \.verify__line code \{ font-size: 1em; font-synthesis: none; \}/);
  const { footer } = await import("./render/layout.ts");
  assert.match(footer("home"), /<a href="\/fonts\/departure-mono\/LICENSE\.txt">Departure Mono<\/a> by Helena Zhang/);
});

test("the retired looks left nothing behind (Dex 10-19, the redesign: dust abandoned)", () => {
  const all = sheets.map((s) => s.css).join("\n");
  assert.doesNotMatch(all, /look-dust|look-cut|data-motion="(?:dust|cuts)"/);
});

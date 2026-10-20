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

test("the home's places stay fixed: nothing above a fixed scene takes a transform, filter, perspective, will-change, contain, container-type or content-visibility (DESIGN-1019 2.3, 6.4)", async () => {
  const banned = /(?:^|[;{\s])(transform|filter|perspective|will-change|contain|container-type|content-visibility|backdrop-filter)\s*:/;
  const above = /(?:^|\s)(?:html|body|\.sheet(?:--[\w-]+)*|\.main|\.band(?:--[\w-]+)*(?:\.sec)?|\.band__world)(?:\.[\w-]+)*(?::[\w-]+(?:\([^)]*\))?)*$/;
  const bad = [];
  for (const { file, css } of sheets) {
    const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of flat.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const sels = m[1].split(",").map((x) => x.trim()).filter(Boolean);
      if (sels.some((sel) => above.test(sel)) && banned.test(m[2])) bad.push(`${file}: ${m[1].trim()} { ${m[2].trim().slice(0, 60)} }`);
    }
  }
  assert.deepEqual(bad, []);
  const bands = sheets.find((s) => s.file === "bands.css").css;
  assert.match(bands, /\.band__scene \{\s*position: fixed;/);
  assert.match(bands, /clip-path: inset\(var\(--strip-h\) 0 calc\(-1 \* var\(--strip-h\)\) 0\)/, "a change of place always happens under a strip");
  assert.match(bands, /@media \(prefers-reduced-motion: reduce\) \{\s*\.band__scene \{ position: absolute;/, "reduced motion: the places scroll with the page");
});

test("the bands never widen the page (K's ask, 10-20: a phone's cards slide in from 60% of the screen's width): overflow-x clip on every band, never hidden / auto / scroll (that would make the band a scroll container and unstick its place)", () => {
  const bands = sheets.find((s) => s.file === "bands.css").css;
  assert.match(bands, /\.sheet \.band\.sec \{[^}]*overflow-x: clip;/);
  const all = sheets.map((s) => s.css.replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
  for (const m of all.matchAll(/([^{}]*\.band(?![\w-])[^{}]*)\{([^{}]*)\}/g)) {
    assert.doesNotMatch(m[2], /overflow(?:-[xy])?\s*:\s*(?:hidden|auto|scroll)/, `${m[1].trim()}: a band must not scroll`);
  }
});

test("way 4, live (lane F): the world in the jetty's window under the question, its button and the corner ofuda; the clicks go to the page", () => {
  const css = readFileSync(new URL("./styles/column.css", import.meta.url), "utf8");
  const z = (sel) => Number(css.match(new RegExp(String.raw`html\.world-window ${sel.replace(/[.]/g, "\\.")} \{[^}]*z-index: (\d+)`))?.[1] ?? NaN);
  const world = z(".world"), paper = z(".jetty__paper"), layer = z(".ofuda-layer");
  assert.ok(world > 0 && paper > world, `the question and its button over the world (${paper} > ${world})`);
  assert.ok(layer > 40, "the corner ofuda over the header (z 40), as over the whole sheet before");
  // the sheet is no layer of its own meanwhile, or nothing in it could stand over the world
  assert.match(css, /html\.world-window \.sheet \{[^}]*z-index: auto;[^}]*isolation: auto;/);
  assert.match(css, /html\.world-window \.world \{[^}]*clip-path: inset\(var\(--win-t/);
});

// node --test: YUKI on dex.place (Dex 10-26, YUKI docs/build/PHASE2-SCOPE.md W12): pixel Yuki (yuki-sprite.ts), her
// stage (render/yukiart.ts), her page /yuki/ in both states (render/yuki.ts), the live link that stays off
// (data/yuki.ts), and the motion's rules (motion/yuki.ts, styles/yuki.css).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { YUKI_AHOGE, YUKI_BASE, YUKI_EYES, YUKI_MOUTHS, YUKI_PALETTE, validateLayer, yukiSprite } from "./yuki-sprite.ts";
import { ringCells, yukiArt, yukiStage } from "./render/yukiart.ts";
import { YUKI_SAYS, yukiPage } from "./render/yuki.ts";
import { latestAsset, yukiEntry } from "./data/downloads.ts";
import { readLinkStatus, YUKI_FACTS, YUKI_LINK, YUKI_TIERS } from "./data/yuki.ts";
import { routes } from "./render/routes.ts";

const SAMPLE = { version: "0.2.0", file: "YUKI-Setup-0.2.0.exe", bytes: 312_456_789, sha256: "ab".repeat(32) };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// ------------------------------------------------------------------ the sprite

test("pixel Yuki: every layer 32 x 32 in her own palette; outlines never pure black; red only on the pin and the gem", () => {
  validateLayer("base", YUKI_BASE);
  for (const [k, v] of Object.entries(YUKI_EYES)) validateLayer(`eyes ${k}`, v);
  for (const [k, v] of Object.entries(YUKI_MOUTHS)) validateLayer(`mouth ${k}`, v);
  YUKI_AHOGE.forEach((rows, i) => validateLayer(`ahoge ${i}`, [...rows, ...Array.from({ length: 29 }, () => ".".repeat(32))]));
  assert.notEqual(YUKI_PALETTE.o.toLowerCase(), "#000000");
  assert.notEqual(YUKI_PALETTE.q.toLowerCase(), "#000000");
  for (const c of Object.values(YUKI_PALETTE)) assert.match(c, /^#[0-9a-f]{6}$/);
  // red (R, r, G) only in the hairpin (rows 9-11, right side) and the collar gem (rows 28-29, the middle)
  YUKI_BASE.forEach((row, y) => [...row].forEach((ch, x) => {
    if ("RrG".includes(ch)) assert.ok((y >= 9 && y <= 11 && x >= 23 && x <= 25) || (y >= 28 && y <= 29 && x >= 15 && x <= 16), `red at ${x},${y}`);
  }));
});

test("pixel Yuki: the face's layers sit over plain skin, so a blink or a glance never leaves a hole", () => {
  // the base under the eyes (rows 15-20 between the side hair) and the mouth is skin and blush only
  for (let y = 15; y <= 20; y++) for (let x = 7; x <= 24; x++) assert.ok("SB".includes(YUKI_BASE[y][x]), `base ${x},${y} is ${YUKI_BASE[y][x]}`);
  for (let y = 21; y <= 22; y++) for (let x = 13; x <= 18; x++) assert.equal(YUKI_BASE[y][x], "S", `mouth ${x},${y}`);
  // every eye layer draws only inside rows 15-20, one pixel in from the side hair (room for a one-pixel glance)
  for (const [k, rows] of Object.entries(YUKI_EYES)) rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== ".") assert.ok(y >= 15 && y <= 20 && x >= 7 && x <= 24, `eyes ${k} at ${x},${y}`);
  }));
  // the open eyes: a lid, a three-tone iris (dark on top, bright below), a white highlight; mirrored left to right
  const open = YUKI_EYES.open;
  assert.match(open[15], /K{5}.*K{5}/);
  assert.ok(open[17].includes("W") && open[18].includes("W"));
  assert.ok(open.slice(16, 18).join("").includes("I") && open[19].includes("j"));
  for (let y = 15; y <= 20; y++) assert.equal(open[y].replace(/W/g, "I").replace(/[ij]/g, "i"), [...open[y].replace(/W/g, "I").replace(/[ij]/g, "i")].reverse().join(""), `row ${y} mirrored`);
});

test("pixel Yuki as SVG: every face in the markup, the attributes pick one; crisp; decorative unless named", () => {
  const svg = yukiSprite({ scale: 3, eyes: "happy", mouth: "smile" });
  assert.match(svg, /^<svg class="yk" xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32" width="96" height="96" shape-rendering="crispEdges" data-eyes="happy" data-mouth="smile" aria-hidden="true" focusable="false">/);
  for (const k of Object.keys(YUKI_EYES)) assert.ok(svg.includes(`class="yk__e yk__e--${k}"`), k);
  for (const k of Object.keys(YUKI_MOUTHS)) assert.ok(svg.includes(`class="yk__m yk__m--${k}"`), k);
  assert.ok(svg.includes('class="yk__ahoge yk__ahoge--0"') && svg.includes('class="yk__ahoge yk__ahoge--1"'));
  assert.match(yukiSprite({ label: "Yuki" }), /role="img" aria-label="Yuki"/);
  assert.doesNotMatch(svg, /<image|<img|href=/, "drawn, never a picture file");
});

// ------------------------------------------------------------------ the stage

test("her stage: a crisp night in whole cells, her orb's ring closed all round, seeded, decorative", () => {
  const a = yukiStage({ cols: 72, rows: 50, seed: "t" });
  assert.equal(a, yukiStage({ cols: 72, rows: 50, seed: "t" }), "the same on every build");
  assert.match(a, /^<svg class="ykstage" [^>]*viewBox="0 0 72 50" shape-rendering="crispEdges" preserveAspectRatio="xMidYMax slice" aria-hidden="true"/);
  assert.match(a, /<g class="ykstage__ring" /);
  assert.match(a, /<g class="ykstage__her" [^>]*><svg x="20" y="18" width="32" height="32"/);
  assert.doesNotMatch(yukiStage({ cols: 72, rows: 50, seed: "t", layer: "back" }), /ykstage__her/);
  assert.doesNotMatch(yukiStage({ cols: 72, rows: 50, seed: "t", layer: "her" }), /<rect /);
  // the ring: every cell has a neighbour on both sides (no gaps), and it is symmetric
  const cells = ringCells(10, 10, 6);
  const has = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) {
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([dx, dy]) => has.has(`${x + dx},${y + dy}`)).length;
    assert.ok(n >= 2, `ring cell ${x},${y} is joined`);
    assert.ok(has.has(`${20 - x},${y}`) && has.has(`${x},${20 - y}`), "symmetric");
  }
  // the art box: a picture only with a name; with a numeral, the numeral between her night and her
  assert.match(yukiArt(), /^<div class="cart cart--code ykart" aria-hidden="true"/);
  assert.match(yukiArt({ label: "Yuki" }), /^<div class="cart cart--code ykart" role="img" aria-label="Yuki"/);
  const card = yukiArt({ numeral: "01", card: true });
  assert.ok(card.indexOf("cart__num") > card.indexOf("ykart__stage") && card.indexOf("cart__num") < card.indexOf("ykart__stage--her"));
});

// ------------------------------------------------------------------ the page

test("/yuki/ is a route under Downloads, its description plain", () => {
  const r = routes({ docs: [], posts: [], gallery: [] }).find((x) => x.path === "/yuki/");
  assert.ok(r);
  const { head, body } = r.render();
  assert.match(head, /<title>YUKI · dex<\/title>/);
  assert.match(body, /class="nav__link" href="\/#downloads" aria-current="true"/);
  assert.equal(body.match(/<h1[\s>]/g).length, 1);
});

test("/yuki/, not released: she sleeps, no file link, the guide still reads in full", () => {
  const html = yukiPage(yukiEntry(null));
  assert.match(html, /data-release="none"/);
  assert.match(html, /<h1 class="ykh__title" id="page-title">YUKI<\/h1>/);
  assert.match(html, /data-eyes="sleepy"/);
  assert.ok(html.includes(YUKI_SAYS.none));
  assert.match(html, /No public download yet/);
  assert.doesNotMatch(html, /href="[^"]+\.exe"|yuki-releases|class="[^"]*ykh__dl/);
  assert.doesNotMatch(html, /id="yuki-verify"/);
  assert.equal(html.match(/<li class="ykstep" data-step="\d">/g).length, 4);
  assert.match(html, /<section class="yks yks--install" id="install"/);
});

test("/yuki/, released: one key straight to the release asset, then the guide with the Windows prompt and the checksum", () => {
  const html = yukiPage(yukiEntry(SAMPLE));
  const href = latestAsset(SAMPLE.file);
  assert.match(html, /data-release="ready"/);
  const keys = html.match(new RegExp(`<a class="btn btn--mint btn--l btn--dl ykh__dl" href="${href.replaceAll(".", "\\.")}" download aria-label="Download YUKI 0\\.2\\.0 for Windows, [^"]+">`, "g")) ?? [];
  assert.equal(keys.length, 1, "one download key");
  assert.match(html, /href="#install"/);
  assert.ok(html.includes(YUKI_SAYS.ready));
  assert.ok(html.includes(`data-say-guide="${YUKI_SAYS.guide}"`));
  assert.match(html, /<p class="ykh__after" data-yuki-after role="status"><\/p>/);
  // the Windows prompt, both faces: the words a visitor has to find, and the file's own name
  const ss = html.slice(html.indexOf('<figure class="ss"'), html.indexOf("</figure>"));
  for (const words of ["Windows protected your PC", "More info", "Run anyway", "Don't run", "Unknown publisher", SAMPLE.file]) assert.ok(ss.includes(words), words);
  assert.match(ss, /<figcaption class="ss__cap" id="ss-cap">/);
  assert.match(html, /id="yuki-verify"/);
  assert.ok(html.replace(/<\/?span>/g, "").includes(SAMPLE.sha256));
  // made with code: no picture files anywhere on her page
  assert.doesNotMatch(html, /<img /);
});

test("what it is and the tiers come from YUKI's docs (data/yuki.ts): four facts, four tiers S to C", () => {
  assert.equal(YUKI_FACTS.length, 4);
  assert.deepEqual(YUKI_TIERS.map((t) => t.rank), ["S", "A", "B", "C"]);
  for (const t of YUKI_TIERS) assert.ok(t.name && t.pc && t.gets, t.rank);
  const html = yukiPage(yukiEntry(null));
  for (const t of YUKI_TIERS) assert.ok(html.includes(`<span class="sr">${t.rank} tier: </span>`), `${t.rank}: its rank read out`);
  for (const f of YUKI_FACTS) assert.ok(html.includes(f.title.replaceAll("'", "&#39;")) || html.includes(f.title), f.title);
});

// ------------------------------------------------------------------ the live link

test("the live link stays off: no markup, no request, until the engine answers dex.place", () => {
  assert.equal(YUKI_LINK.enabled, false);
  assert.equal(YUKI_LINK.base, "http://127.0.0.1:47800");
  assert.doesNotMatch(yukiPage(yukiEntry(SAMPLE)), /data-yuki-link/);
  const ts = read("./motion/yuki.ts");
  assert.match(ts, /if \(!YUKI_LINK\.enabled \|\| !box\) return;/);
  // the answer is read tolerantly: anything unknown is "none", progress is clamped, versions are short
  assert.deepEqual(readLinkStatus(null), { kind: "none" });
  assert.deepEqual(readLinkStatus({ ok: false }), { kind: "none" });
  assert.deepEqual(readLinkStatus("<html>"), { kind: "none" });
  assert.deepEqual(readLinkStatus({ ok: true, engineVersion: "0.2.0" }), { kind: "ready", version: "0.2.0" });
  assert.deepEqual(readLinkStatus({ ok: true, stage: "setup", progress: 1.7 }), { kind: "setup", progress: 1, version: null });
  assert.deepEqual(readLinkStatus({ ok: true, stage: "downloading", progress: "x" }), { kind: "setup", progress: null, version: null });
  assert.equal(readLinkStatus({ ok: true, engineVersion: "v".repeat(99) }).version.length, 32);
});

// ------------------------------------------------------------------ motion

test("motion: the click never stops the download, the chunk loads only where she is, every loop waits for motion and rests off screen", () => {
  const ts = read("./motion/yuki.ts");
  assert.doesNotMatch(ts, /preventDefault\(\)/, "the Download click's default action (the file) always runs");
  assert.match(ts, /if \(e\.defaultPrevented \|\| e\.button !== 0 \|\| e\.metaKey/);
  const main = read("./main.ts");
  assert.match(main, /if \(!document\.querySelector\("svg\.yk"\)\) return;\n\s*import\("\.\/motion\/yuki\.ts"\)/);
  const css = read("./styles/yuki.css");
  const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/g, "");
  assert.doesNotMatch(outside, /animation:/, "every loop and entrance waits for motion to be allowed");
  assert.match(css, /:is\(\.pban__in, \[data-yuki-stage\], \.dlf, \.ss\)\.is-off :is\(\.yk \*, \.ykstage \*, \.ykfx i, \.ss \*\) \{ animation-play-state: paused; \}/);
  // idles step on whole pixels
  for (const name of ["yk-open", "yk-shut", "yk-bob", "yk-shard", "yk-ah0"]) assert.match(css, new RegExp(`${name} [^;]*steps\\(`), name);
  assert.doesNotMatch(css, /border-radius|backdrop-filter/);
  // the sheet sits before the deep pages' sheet (pages.test.mjs: that one loads last)
  const site = read("./styles/site.css");
  assert.ok(site.indexOf('@import "./yuki.css";') > site.indexOf('@import "./bands.css";'));
});

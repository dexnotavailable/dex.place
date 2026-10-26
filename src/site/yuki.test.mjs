// node --test: YUKI on dex.place (Dex 10-26, YUKI docs/build/PHASE2-SCOPE.md W12): pixel Yuki (yuki-sprite.ts), her
// stage (render/yukiart.ts), her page /yuki/ in both states (render/yuki.ts), the live link that stays off
// (data/yuki.ts), and the motion's rules (motion/yuki.ts, styles/yuki.css).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blinkVars, YUKI_AHOGE, YUKI_BASE, YUKI_EYES, YUKI_MOUTHS, YUKI_PALETTE, validateLayer, yukiSprite } from "./yuki-sprite.ts";
import { ringCells, yukiArt, yukiStage } from "./render/yukiart.ts";
import { smartScreen, YUKI_SAYS, yukiPage } from "./render/yuki.ts";
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

test("pixel Yuki's blink: a seeded clock per stage and per Yuki (4.1 to 6.3 s), so two on one screen blink out of step", () => {
  const clock = (html) => {
    const m = html.match(/--blink:([\d.]+)s;--blink-at:(-?[\d.]+)s/);
    return m ? [+m[1], +m[2]] : null;
  };
  // the stages where she shows (render/cardart.ts, downloads.ts and yuki.ts seed them by place)
  const seeds = ["yuki-page", "yuki-dl", "yuki-card", "yuki-pban__cart"];
  const clocks = seeds.map((seed) => clock(yukiStage({ cols: 72, rows: 50, seed })));
  for (const [i, c] of clocks.entries()) {
    assert.ok(c, `${seeds[i]}: a clock`);
    assert.ok(c[0] >= 4.1 && c[0] <= 6.3, `${seeds[i]}: ${c[0]} s`);
    assert.ok(c[1] <= 0 && -c[1] <= c[0], `${seeds[i]}: starts inside its period`);
  }
  assert.equal(new Set(clocks.map((c) => c[0])).size, seeds.length, "each place its own period");
  assert.deepEqual(clock(yukiStage({ cols: 72, rows: 50, seed: "yuki-page" })), clocks[0], "the same on every build");
  // a night with no Yuki has no clock; a Yuki on her own takes hers from her seed, else her stage's
  assert.equal(clock(yukiStage({ cols: 72, rows: 50, seed: "x", layer: "back" })), null);
  assert.ok(clock(yukiSprite({ seed: "tile" })));
  assert.equal(clock(yukiSprite()), null);
  assert.equal(blinkVars("a"), blinkVars("a"));
  // the CSS reads both (period and start) on the open eyes and the shut ones alike
  const css = read("./styles/yuki.css");
  for (const k of ["open", "blink"]) {
    assert.match(css, new RegExp(`\\.yk__e--${k} \\{[^}]*animation: yk-\\w+ var\\(--blink, 4\\.7s\\) steps\\(1, end\\) var\\(--blink-at, 0s\\) infinite;`), k);
  }
  // the page's tiles and the prompt's peek each have their own
  const page = yukiPage(yukiEntry(null));
  const all = [...page.matchAll(/<svg class="yk[" ][^>]*>/g)].map((m) => clock(m[0])).filter(Boolean);
  assert.ok(all.length >= 3, `${all.length} Yukis with a clock`);
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

test("the Windows prompt: each cursor sits inside what it taps, placed in percent of it, so its tip stays on it at any width", () => {
  const ss = smartScreen("YUKI-Setup-0.2.0.exe");
  // (Don't run sits beside Run anyway and the row wraps on phones: a cursor placed from the window landed on Don't run)
  assert.match(ss, /<span class="ss__target">More info<span class="ss__cursor ss__cursor--a" aria-hidden="true">/);
  assert.match(ss, /<span class="ss__btn ss__btn--go ss__target">Run anyway<span class="ss__cursor ss__cursor--b" aria-hidden="true">/);
  assert.equal(ss.match(/class="ss__cursor /g).length, 2);
  assert.doesNotMatch(ss, /<span class="ss__btn">Don't run<span class="ss__cursor/);
  const css = read("./styles/yuki.css");
  assert.match(css, /\n\.ss__target \{ position: relative; display: inline-block; \}/, "the target is the cursor's frame");
  for (const k of ["a", "b"]) {
    const m = css.match(new RegExp(`\\n\\.ss__cursor--${k} \\{ left: (\\d+)%; top: (\\d+)%; \\}`));
    assert.ok(m, `cursor ${k}: placed in percent of its target`);
    // its tip (the icon's top-left pixel) well inside the target, not on an edge
    for (const v of [+m[1], +m[2]]) assert.ok(v >= 25 && v <= 75, `cursor ${k}: ${v}%`);
  }
  assert.doesNotMatch(css, /\.ss__cursor--[ab] \{[^}]*(right|bottom):/, "never from the window's edges");
  // both moves end on the target: the resting keyframes are translate 0
  assert.match(css, /@keyframes ss-a \{[^\n]*30%, 50% \{ translate: 0 0; opacity: 1; \}/);
  assert.match(css, /@keyframes ss-b \{[^\n]*80%, 96% \{ translate: 0 0; opacity: 1; \}/);
});

test("motion after the hatch: her hop and a new line's pop win over the hatch's own rules, and both replay", () => {
  const css = read("./styles/yuki.css");
  // specificity of a plain selector (ids, classes / attributes / pseudo-classes, types)
  const spec = (sel) => [
    (sel.match(/#[\w-]+/g) ?? []).length,
    (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length,
    (sel.replace(/\[[^\]]+\]|[.#:][\w-]+/g, " ").match(/(^|\s)[a-z][\w-]*/g) ?? []).length,
  ];
  const beats = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const anim = (sel) => {
    const m = css.match(new RegExp(`\\n  ${sel.replace(/[.[\]]/g, "\\$&")} \\{ animation: ([^;]+); \\}`));
    assert.ok(m, sel);
    return m[1].split(/,(?![^(]*\))/).map((a) => a.trim());
  };
  const name = (a) => a.split(/\s+/)[0];
  const hatchHer = "html.js [data-hatch] .ykstage__her", hop = "html.js [data-hatch] .ykstage__her.is-hop";
  const hatchSay = "html.js .ykh__say", line = "html.js .ykh__say.is-new";
  assert.ok(beats(spec(hop), spec(hatchHer)) > 0, "the hop wins over the pop");
  assert.ok(beats(spec(line), spec(hatchSay)) > 0, "a new line wins over the first");
  // the hop keeps the pop as it was (matched by name, it never replays) and plays after it, so it owns translate
  assert.deepEqual(anim(hop).map(name), ["yk-pop", "yk-hop"]);
  assert.equal(anim(hop)[0], anim(hatchHer)[0]);
  // a new line pops under its own keyframes' name (the same name as the hatch's would never replay)
  assert.notEqual(name(anim(line)[0]), name(anim(hatchSay)[0]));
  assert.match(css, new RegExp(`@keyframes ${name(anim(line)[0])} \\{`));
  assert.match(css, /@keyframes yk-hop \{[\s\S]*?translate: 0 -\d+px;/);
  // nothing else in the sheet animates her or the bubble, so nothing later takes them back
  assert.equal(css.match(/\.ykstage__her[^{,]*\{[^}]*animation:/g).length, 2);
  assert.equal(css.match(/\.ykh__say[^{,]*\{[^}]*animation:/g).length, 2);
  // the script restarts each: off, a reflow, on
  const ts = read("./motion/yuki.ts");
  assert.match(ts, /g\.classList\.remove\("is-hop"\);\n\s*void g\.getBoundingClientRect\(\);\n\s*g\.classList\.add\("is-hop"\);/);
  assert.match(ts, /bubble\.classList\.remove\("is-new"\);\n\s*void bubble\.offsetWidth;\n\s*bubble\.classList\.add\("is-new"\);/);
});

test("/yuki/ on a tablet: the stacked stage is tall enough for her ring and her line (a cell is set by its width there)", () => {
  const css = read("./styles/yuki.css");
  // her line's foot sits 35 cells up, just over the ring, and never above the stage's top
  const clamp = css.match(/bottom: min\(calc\(35 \* var\(--u\)\), calc\(100% - (\d+)px\)\);/);
  assert.ok(clamp, "the bubble stays in the stage");
  // stacked, the stage is at least those 35 cells plus the bubble
  const m = css.match(/@media \(max-width: 899px\) \{\n    \.ykh__box \{ container-type: inline-size; \}\n    \.ykh__stage \{ height: max\(clamp\(240px, 62vw, 380px\), calc\(35 \* round\(up, 100cqw \/ var\(--cols\), 1px\) \+ (\d+)px\)\); \}/);
  assert.ok(m, "the stacked stage's height follows its cells");
  const room = +m[1], at = +clamp[1];
  // (the bubble: 43 px tall with its border, 4 more of shadow; the stage's 2 px foot border)
  assert.ok(room - 2 >= at && at >= 47 + 8, `room ${room}, clamp ${at}`);
  assert.match(css, /\.ykh__stage \{\n  --cols: 72;\n  --rows: 50;/);
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

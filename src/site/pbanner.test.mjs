// node --test: the project banners (Dex 10-22: "make the projects more like banners, have them going in strips all the
// way down"; lanes\site-art-1022\PLAN.md 5.4): markup (render/pbanner.ts), Dex's layers (public/site/banners/), styles
// (styles/pbanner.css, the band's placement in styles/bands.css) and motion (motion/pbanner.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { landing, projectPage, projectsIndex } from "./render/landing.ts";
import { bannerArt } from "./render/pbanner.ts";
import { projects, projectHref } from "./data/projects.ts";

const content = { docs: [], posts: [], gallery: [] };
const pub = (p) => new URL(`../../public${p}`, import.meta.url);
const css = readFileSync(new URL("./styles/pbanner.css", import.meta.url), "utf8");
const bands = readFileSync(new URL("./styles/bands.css", import.meta.url), "utf8");

/** A webp's RIFF chunks (VP8 / VP8L / VP8X / ALPH / ICCP / EXIF / XMP ...). */
function chunks(path) {
  const b = readFileSync(path);
  assert.equal(b.toString("latin1", 0, 4), "RIFF");
  assert.equal(b.toString("latin1", 8, 12), "WEBP");
  const out = [];
  for (let at = 12; at + 8 <= b.length;) {
    const id = b.toString("latin1", at, at + 4), n = b.readUInt32LE(at + 4);
    out.push(id.trim());
    at += 8 + n + (n % 2);
  }
  return out;
}
/** A webp's canvas size (VP8X, VP8 or VP8L). */
function sizeOf(path) {
  const b = readFileSync(path);
  const id = b.toString("latin1", 12, 16);
  if (id === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (id === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  const v = b.readUInt32LE(21);
  return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)];
}

test("home and /projects/ show three banner strips, in Dex's order, each linking its page, its docs and its one action", () => {
  for (const [html, h] of [[landing(content), "h3"], [projectsIndex(), "h2"]]) {
    const list = html.slice(html.indexOf('<ul class="pbans"'), html.indexOf("</ul>", html.indexOf('<ul class="pbans"')));
    const ids = [...list.matchAll(/<li class="pban" data-pcard="([\w-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, projects.map((p) => p.id));
    for (const p of projects) {
      const li = list.slice(list.indexOf(`data-pcard="${p.id}"`), list.indexOf("</li>", list.indexOf(`data-pcard="${p.id}"`)));
      assert.match(li, new RegExp(`<${h} class="pban__name" id="p-${p.id}-name"><a class="pban__link" href="${projectHref(p)}">`));
      assert.ok(li.includes(`href="${p.docs.href}"`), `${p.id} docs`);
      assert.match(li, /class="btn [^"]*pban__main /);
      // one link for keyboards: the name; the art is a pointer shortcut
      assert.match(li, /<a class="pban__hit" href="[^"]+" tabindex="-1" aria-hidden="true">/);
    }
  }
});

test("a banner's layers, back to front (PLAN 5.4): ink base, Dex's plate, the numeral, his ink slash, the hero window, his fx, the scrim, then the words", () => {
  const html = landing(content);
  for (const p of projects) {
    const at = html.indexOf(`<li class="pban" data-pcard="${p.id}"`);
    const li = html.slice(at, html.indexOf("</li>", at) + 5);
    const no = String(projects.indexOf(p) + 1).padStart(2, "0");
    // outside in: one owner per wrapper (the deck, the touch tilt, the hover lift)
    assert.match(li, new RegExp(`^<li class="pban" data-pcard="${p.id}" style="--i:\\d"><div class="pban__in" data-tone="${p.tone}"><div class="pban__tilt"><div class="pban__lift"><span class="pban__plate" aria-hidden="true"></span><article class="pban__b pban--${p.tone}" id="p-${p.id}"`));
    const order = ["pban__back", "pban__num", "pban__slash", "pban__hero", "pban__cart", "pban__front", "pban__scrim", "pban__info", "pban__brackets"];
    const where = order.map((k) => li.indexOf(`class="${k}`) >= 0 ? li.indexOf(`class="${k}`) : li.indexOf(` ${k}`));
    for (let i = 0; i < order.length; i++) {
      if (order[i] === "pban__back" && !bannerArt(p).back) continue;
      assert.ok(where[i] >= 0, `${p.id}: ${order[i]}`);
      if (i) assert.ok(where[i] > where[i - 1] || where[i - 1] < 0, `${p.id}: ${order[i]} after ${order[i - 1]}`);
    }
    assert.match(li, new RegExp(`<span class="pban__num">${no}</span>`));
    // the hero is the card's own art (its rig, pixels unchanged), decorative here
    assert.match(li, new RegExp(`<div class="pban__hero" aria-hidden="true">.*<div class="cart cart--rig[^"]* pban__cart" data-rig="/site/cards/${p.id}/"[^>]* aria-hidden="true"`));
    // every Dex layer is lazy and decorative, with its phone cut
    for (const [img] of li.matchAll(/<img class="pban__(?:back|slash|fx)"[^>]*>/g)) {
      assert.match(img, /alt="" width="2400" height="720" loading="lazy" decoding="async"/);
      assert.match(img, /srcset="\/site\/banners\/[\w/-]+-p\.webp 800w, \/site\/banners\/[\w/-]+\.webp 2400w" sizes="\(max-width: 699px\) 100vw, 64vw"/);
    }
  }
});

test("Dex's banner layers: web cuts only (2400 x 720 and 800 x 340 webp, no metadata), within the budget, every one he drew", () => {
  const BUDGET = { back: 140, "back-p": 45, fx: 60, "fx-p": 30, ink: 90, "ink-p": 30 };
  const files = [];
  for (const p of projects) {
    const a = bannerArt(p);
    assert.ok(a.back, `${p.id}: Dex's plate`);
    assert.ok(a.ink, "the ink slash");
    for (const base of [a.back, a.fx, a.ink].filter(Boolean)) for (const f of [`${base}.webp`, `${base}-p.webp`]) files.push(f);
  }
  for (const f of new Set(files)) {
    assert.ok(existsSync(pub(f)), `${f} exists`);
    const kind = f.match(/\/([\w]+(?:-p)?)\.webp$/)[1];
    const kb = statSync(pub(f)).size / 1024;
    assert.ok(kb <= BUDGET[kind], `${f}: ${kb.toFixed(0)} KB (budget ${BUDGET[kind]})`);
    assert.deepEqual(sizeOf(pub(f)), kind.endsWith("-p") ? [800, 340] : [2400, 720], f);
    const c = chunks(pub(f));
    assert.ok(!c.some((id) => id === "EXIF" || id === "XMP"), `${f}: no metadata (${c.join(" ")})`);
  }
  // the banners' own files only: no sources, nothing else in the folder
  const all = readdirSync(pub("/site/banners/"), { recursive: true }).filter((f) => /\.\w+$/.test(f));
  for (const f of all) assert.match(f.replaceAll("\\", "/"), /^(?:[\w-]+\/)?(?:back|fx|ink)(?:-p)?\.webp$/, f);
});

test("sizes (PLAN 5.4): ~10:3 strips sized off their own width, the hero a 4:5 window lifted 8% and slanted, a phone's art strip 168 tall with the words under it", () => {
  assert.match(css, /--ban-h: clamp\(240px, 30cqw, 340px\);/);
  assert.match(css, /--hero-h: calc\(var\(--ban-h\) \* 1\.08\);/);
  assert.match(css, /--hero-w: calc\(var\(--hero-h\) \* 0\.8\);/);
  assert.match(css, /--slant: polygon\(22% 0, 100% 0, 100% 100%, 0 100%\);/);
  assert.match(css, /@container pban \(max-width: 559px\) \{\n  \.pban__lift \{ --ban-h: 168px; --hero-w: calc\(var\(--hero-h\) \* 2 \/ 3\);/);
  // the numeral on whole font pixels (25 font px an em), outlined one font pixel in ink
  for (const [, px] of css.matchAll(/\.pban__num \{[^}]*?font(?:-size)?:[^;]*?(\d+)px/g)) assert.equal(+px % 25, 0, px);
  for (const [, np, px] of css.matchAll(/\.pban__num \{ --np: (\d+)px; font-size: (\d+)px/g)) assert.equal(+np * 25, +px, `${np} a font pixel at ${px}`);
  // the band places the list only: the overhang onto the world (12 / 0 / 64 / 96 px) and the stepped middle strip
  assert.match(bands, /\.band--projects \{\n  --ban-over: 12px;\n  --ban-gap: 24px;/);
  assert.match(bands, /\.band--projects \{ --ban-over: 0px; --ban-gap: 28px; --ban-step: 4vw; \}/);
  assert.match(bands, /\.band--projects \{ --ban-over: 64px; --ban-gap: 28px; \}/);
  assert.match(bands, /\.band--projects \{ --ban-over: 96px; --ban-gap: 36px; \}/);
  assert.match(bands, /margin: 0 calc\(-1 \* \(var\(--edge-in\) \+ var\(--ban-over\)\)\) 0 0;/);
  assert.match(bands, /\.band--projects \.pbans > :nth-child\(2\) \{ margin-inline: var\(--ban-step\) calc\(-1 \* var\(--ban-step\)\); \}/);
  assert.doesNotMatch(bands, /\.pban__/, "G never reaches inside a banner");
});

test("the plate (PLAN 5.3, Dex 10-22 'a little more dominant'): wider papers on a desktop, a deeper shade, a 6 px spine, whole strip numerals", () => {
  const wide = bands.slice(bands.indexOf("@media (min-width: 1600px) {\n  .band--projects"));
  const lap = bands.slice(bands.indexOf("@media (min-width: 1100px) {\n  .band--projects"));
  for (const [sheet, want] of [[lap, { projects: 62, docs: 64, gallery: 70, donate: 62 }], [wide, { projects: 60, docs: 62, gallery: 68, donate: 58 }]]) {
    for (const [id, vw] of Object.entries(want)) assert.match(sheet.slice(0, 400), new RegExp(`\\.band--${id}[^{]*\\{ --panel-w: ${vw}vw; \\}`), `${id} ${vw}vw`);
  }
  assert.match(bands, /\.band--downloads, \.band--docs \{ --panel-w: 64vw; \}/);
  assert.match(bands, /\.band--downloads, \.band--docs \{ --panel-w: 62vw; \}/);
  assert.match(bands, /\.band__spine \{ position: absolute; top: 0; bottom: 0; right: 0; width: 6px;/);
  assert.match(bands, /\.band__shade \{ position: absolute; inset: 0; z-index: 1; box-shadow: 32px 24px 72px -26px var\(--panel-shade-c\); \}/);
  // the strip numerals: whole (no clip, nothing sunk past the hem)
  const num = bands.slice(bands.indexOf(".band--r .band__strip-paper::before {\n    margin-left: max("));
  assert.doesNotMatch(num.slice(0, num.indexOf("}")), /clip-path|margin-bottom: -/);
});

test("motion (PLAN 5.4): the deck's entrance as timed, the idle loops on the compositor and paused off screen, nothing under reduced motion; code <= 10 KB gzip", () => {
  const ts = readFileSync(new URL("./motion/pbanner.ts", import.meta.url), "utf8");
  for (const fn of ["settle", "prime", "entrance"]) {
    const body = ts.slice(ts.indexOf(`function ${fn}(`), ts.indexOf(`function ${fn}(`) + 300);
    assert.match(body, /if \(!motion\) return/, `${fn} does nothing under reduced motion`);
  }
  for (const bit of [
    "x: s * 0.24 * vw, rotation: s * 2", "duration: 1.1 * D", // the banner from its side, expo.out 1100 ms
    "ft(b.bk, { x: s * 48 }", "duration: 1.3 * D", // the plate lags
    "scaleX: 0, transformOrigin", "at + 0.15 * D", // the slash drawn 150 ms in
    "ft(b.num, { x: -s * 80 }", // the numeral counter-moves
    "ft(b.hero, { x: -s * 64, autoAlpha: 0 }", "at + 0.3 * D", // the hero from the world side
    "at + 0.45 * D", "at + 0.55 * D", // the fx, the name's letters
  ]) assert.ok(ts.includes(bit), bit);
  const tick = ts.slice(ts.indexOf("const tick = "), ts.indexOf("const wake = "));
  assert.doesNotMatch(tick, /getBoundingClientRect|offsetWidth|offsetHeight|clientWidth/);
  // idle: the plate drifts +-6 px over 12 s, the hero floats +-3 px; all within no-preference, paused off screen
  const idle = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  .pban__back"));
  assert.match(idle, /pban-drift 12s/);
  assert.match(idle, /pban-float 6\.4s/);
  assert.match(css, /@keyframes pban-drift \{ from \{ translate: -6px 0; \} to \{ translate: 6px 0; \} \}/);
  assert.match(css, /\.pban__in\.is-off :is\(\.pban__back, \.pban__hfloat, \.pban__shine, \.btn__ic, \.rig__p\) \{ animation-play-state: paused; \}/);
  const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/g, "");
  assert.doesNotMatch(outside, /animation:/, "every loop waits for motion to be allowed");
  assert.doesNotMatch(css, /animation:[^;]*(?:box-shadow|filter)|transition:[^;]*box-shadow|backdrop-filter/);
  // the budget: the banners' code, both halves, gzipped (TypeScript source: an upper bound on what ships)
  const render = readFileSync(new URL("./render/pbanner.ts", import.meta.url), "utf8");
  assert.ok(gzipSync(ts).length <= 10 * 1024, `motion ${gzipSync(ts).length} B gzip`);
  assert.ok(gzipSync(css).length <= 10 * 1024, `css ${gzipSync(css).length} B gzip`);
  assert.ok(render.length > 0);
});

test("a project's page: its banner is the header (P2), the name its h1, the art its picture", () => {
  for (const p of projects) {
    const html = projectPage(p);
    assert.match(html, /^<div class="page page--project"><div class="wrap"><header class="pbans pbans--head" data-pcards="page" data-pban>/);
    assert.match(html, new RegExp(`<h1 class="pban__name" id="p-${p.id}-name">${p.name.replace(".", "\\.")}</h1>`));
    assert.equal(html.match(/<h1\b/g).length, 1);
    assert.match(html, /<div class="pban__hero"><span class="pban__hplate"[^>]*><\/span><div class="pban__win"><div class="pban__hfloat"><div class="cart cart--rig[^"]*" data-rig="[^"]+"(?: data-lines)? role="img" aria-label="[^"]+"/);
    assert.match(html, /<nav class="dh__crumbs" aria-label="Breadcrumb"><a href="\/projects\/">Projects<\/a><\/nav>/);
  }
});

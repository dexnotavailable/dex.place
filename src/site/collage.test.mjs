// node --test: the gallery collage layout and the gallery pages built on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collageLayouts, compose, LAYOUTS, packOrder, WIDTH } from "./collage.ts";
import { loadContent, loadGallery } from "./build/content.ts";
import { artSrcset, collageSizes, galleryOrder, galleryPage, PIECE_PHONE_BUDGET, phoneCap, piecePage, piecePhoneCap } from "./render/gallery.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const content = loadContent(ROOT);

const L = { width: 16, height: 9 };
const P = { width: 9, height: 16 };

function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function checkLayout(pieces, name, comp) {
  assert.equal(comp.boxes.length, pieces.length, `${name}: one box per piece`);
  for (const [i, b] of comp.boxes.entries()) {
    assert.ok(b.x >= 0 && b.x + b.w <= WIDTH + 0.01, `${name} #${i} inside the width: ${JSON.stringify(b)}`);
    assert.ok(b.y >= 0 && b.y + b.h <= comp.height, `${name} #${i} inside the height`);
    assert.ok(b.w >= 8, `${name} #${i} not a sliver`);
    assert.ok(Math.abs(b.tilt) <= LAYOUTS[name].tilt + 1e-9, `${name} #${i} tilt within range`);
    // The frame keeps the art's aspect ratio (no cropping).
    const m = LAYOUTS[name].mat;
    const ratio = (b.h - 2 * m) / (b.w - 2 * m);
    const want = pieces[i].height / pieces[i].width;
    assert.ok(Math.abs(ratio - want) < 0.02, `${name} #${i} aspect ${ratio} vs ${want}`);
  }
  // Collage, not a pile: frames never cover more than a sliver of each other.
  for (let a = 0; a < comp.boxes.length; a += 1) {
    for (let c = a + 1; c < comp.boxes.length; c += 1) {
      const A = comp.boxes[a];
      const C = comp.boxes[c];
      const share = overlap(A, C) / Math.min(A.w * A.h, C.w * C.h);
      assert.ok(share < 0.06, `${name}: #${a} and #${c} overlap ${(share * 100).toFixed(1)}%`);
    }
  }
}

test("collage: every layout keeps pieces inside, uncropped and apart", () => {
  for (const pieces of [content.gallery, [L], [P, P], [L, P, L, P, L, L, P, P, L, L, P, L, P, P, L, L]]) {
    const layouts = collageLayouts(pieces);
    for (const name of Object.keys(LAYOUTS)) checkLayout(pieces, name, layouts[name]);
  }
});

test("collage: deterministic, and empty is empty", () => {
  assert.deepEqual(collageLayouts(content.gallery), collageLayouts(content.gallery));
  assert.deepEqual(compose([], { ...LAYOUTS.wide, seed: "x" }), { boxes: [], height: 0 });
});

test("collage: the first piece leads and shapes alternate by pattern", () => {
  const order = packOrder([L, L, L, P, P], ["P", "L"]);
  assert.deepEqual(order, [0, 3, 1, 4, 2]);
  const wide = collageLayouts(content.gallery).wide.boxes;
  assert.deepEqual([wide[0].x, wide[0].y], [0, 0]);
});

test("gallery page: every piece framed and linked, alt text kept, no visible titles", () => {
  const html = galleryPage(content);
  const { placed } = galleryOrder(content.gallery);
  assert.equal(placed.length, content.gallery.length);
  for (const item of content.gallery) {
    assert.ok(html.includes(`href="/gallery/${item.id}/"`), `links ${item.id}`);
    assert.ok(html.includes(`alt="${item.alt.replaceAll('"', "&quot;")}"`), `alt for ${item.id}`);
  }
  assert.doesNotMatch(html, /<figcaption|<h[2-6][^>]*class="art/);
  assert.match(html, /<dialog class="viewer" data-viewer/);
  assert.equal((html.match(/loading="lazy"/g) ?? []).length + (html.match(/loading="eager"/g) ?? []).length, content.gallery.length);
});

test("piece pages: prev/next follow the collage's reading order, in a ring", () => {
  const { placed } = galleryOrder(content.gallery);
  content.gallery.forEach((item, i) => {
    const html = piecePage(content, i);
    const at = placed.findIndex((p) => p.item.id === item.id);
    const next = placed[(at + 1) % placed.length].item.id;
    const prev = placed[(at - 1 + placed.length) % placed.length].item.id;
    assert.match(html, new RegExp(`href="/gallery/${next}/" rel="next"`));
    assert.match(html, new RegExp(`href="/gallery/${prev}/" rel="prev"`));
    // The visible number is the catalogue id, so the URL and counter agree.
    assert.match(html, new RegExp(`piece ${item.id} of ${String(placed.length).padStart(2, "0")}`));
    assert.match(html, new RegExp(`class="counter piece__count"><b>${item.id}</b>`));
  });
});

// ------------------------------------------------------- responsive images

const PUBLIC = path.join(ROOT, "public");
const urls = (srcset) => srcset.split(",").map((c) => c.trim().split(/\s+/));
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

test("gallery images: every srcset candidate exists at its stated width, display file on top", () => {
  for (const item of content.gallery) {
    const list = urls(artSrcset(item)).map(([u, w]) => [u, Number(w.slice(0, -1))]);
    assert.deepEqual(list.map(([, w]) => w), [...item.widths, item.width], item.id);
    assert.equal(list.at(-1)[0], item.src);
    for (const [u] of list) assert.ok(fs.existsSync(path.join(PUBLIC, u)), `${u} exists`);
    assert.ok(item.bytes && item.bytes.size === list.length, `${item.id} sizes read from disk`);
  }
});

test("gallery page: only the lead piece loads at once; the rest wait, with a no-JS copy", () => {
  const html = galleryPage(content);
  const { placed } = galleryOrder(content.gallery);
  const imgs = [...html.matchAll(/<img class="art__img"[^>]*>/g)].map((m) => m[0]);
  const live = imgs.filter((t) => / srcset="/.test(t));
  const waiting = imgs.filter((t) => / data-srcset="/.test(t));
  // Lead: one live image with high priority. Others: one waiting image + one <noscript> copy each.
  assert.equal(waiting.length, placed.length - 1);
  assert.equal(live.length, 1 + (placed.length - 1));
  assert.equal((html.match(/fetchpriority="high"/g) ?? []).length, 1);
  assert.equal((html.match(/loading="eager"/g) ?? []).length, 1);
  const lead = imgs.find((t) => /fetchpriority="high"/.test(t));
  assert.equal(attr(lead, "alt"), placed[0].item.alt.replaceAll('"', "&quot;"));
  assert.equal((html.match(/<picture class="art__pic" data-defer>/g) ?? []).length, placed.length - 1);
  assert.equal((html.match(/<noscript><picture class="art__pic">/g) ?? []).length, placed.length - 1);
  // Nothing on the page points at the 2048px display file except the viewer's data-src.
  for (const t of imgs) assert.doesNotMatch(attr(t, "src") ?? attr(t, "data-src") ?? "", /\/gallery\/\d{2}\.webp$/);
});

test("gallery page: phones are capped near 2x of their tile; sizes follow the layout", () => {
  const html = galleryPage(content);
  const sources = [...html.matchAll(/<source media="\(max-width: 659px\)" (?:data-)?srcset="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(sources.length, 2 * content.gallery.length - 1);
  for (const s of sources) assert.ok(Math.max(...urls(s).map(([, w]) => parseInt(w))) <= 640, s);
  const { placed } = galleryOrder(content.gallery);
  // The lead is half the wide collage: 48% of 1200px (mat 1 unit a side) from 1296px.
  assert.match(collageSizes(placed[0].boxes), /^\(min-width: 1296px\) 576px, /);
  // And full width on a phone: (390 - 36) * 94.8% = 336 CSS px, capped at the 640 copy.
  assert.equal(phoneCap(placed[0].item, (390 - 36) * 0.948), 640);
});

test("piece pages: srcset with a phone cap inside the byte budget, deferred film strip", () => {
  content.gallery.forEach((item, i) => {
    const html = piecePage(content, i);
    const img = html.match(/<img class="piece__img"[^>]*>/)[0];
    assert.match(img, /fetchpriority="high"/);
    assert.equal(urls(attr(img, "srcset")).at(-1)[0], item.src);
    assert.doesNotMatch(attr(img, "src"), /\/gallery\/\d{2}\.webp$/);
    const phone = html.match(/<source media="\(max-width: 699px\)" srcset="([^"]*)"/)[1];
    const cap = Math.max(...urls(phone).map(([, w]) => parseInt(w)));
    assert.equal(cap, piecePhoneCap(item));
    const capBytes = item.bytes.get(cap);
    const within = [...item.bytes].filter(([w, b]) => w > cap && w <= 2 * 324 * 1.2 && b <= PIECE_PHONE_BUDGET);
    assert.deepEqual(within, [], `${item.id}: no sharper copy fits the budget`);
    assert.ok(cap >= 1.5 * 324 * 0.75, `${item.id}: cap ${cap} (${capBytes} B) keeps at least ~1.5x`);
    assert.equal((html.match(/<img data-defer="lead" data-src="/g) ?? []).length, content.gallery.length);
    assert.equal((html.match(/<noscript><img src="/g) ?? []).length, content.gallery.length);
  });
});

test("gallery manifest: a piece without its smaller copies fails the build", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dex-gallery-"));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "gallery", "manifest.json"), "utf8"));
  const file = path.join(dir, "manifest.json");
  const bare = { ...manifest, items: manifest.items.map(({ widths, ...rest }) => rest) };
  fs.writeFileSync(file, JSON.stringify(bare));
  assert.throws(() => loadGallery(file), /no widths; run npm run gallery:derive/);
  const missing = { ...manifest, items: [{ ...manifest.items[0], widths: [100] }] };
  fs.writeFileSync(file, JSON.stringify(missing));
  assert.throws(() => loadGallery(file, PUBLIC), /public\/gallery\/01-100\.webp is missing/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("gallery css: a waiting image (data-src, no src) is not painted, so no broken-image glyph shows", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/site/styles/gallery.css"), "utf8");
  // Chromium paints a broken-image icon on <img alt="..."> without src; colour alone does not hide it.
  assert.match(css, /img\[data-src\]:not\(\[src\]\)\s*\{\s*opacity:\s*0;\s*\}/);
  // The grey card the waiting tile shows comes from the <picture>, which stays painted.
  assert.match(css, /\.art__pic\s*\{[^}]*background:\s*var\(--panel\)/);
  // Every waiting collage <img> carries data-src, so the rule covers all of them.
  const html = galleryPage(content);
  for (const t of [...html.matchAll(/<img class="art__img"[^>]*>/g)].map((m) => m[0]))
    if (!/ src="/.test(t)) assert.match(t, / data-src="/);
});

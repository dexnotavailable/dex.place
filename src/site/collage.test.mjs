// node --test: the gallery collage layout and the gallery pages built on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { breakRows, collage, imageWidth, LAYOUTS } from "./collage.ts";
import { loadContent, loadGallery } from "./build/content.ts";
import { artSrcset, collageBlock, collageSizes, DESKTOP_PIECE, galleryArrival, galleryOrder, galleryPage, gallerySection, leadPhoneCaps, leadTabletCaps, leadTiles, leadWideCaps, PIECE_PHONE_BUDGET, phoneCap, pieceDesktopCap, piecePage, piecePhoneCap, pieceTabletCap, pieceWidthAt, tabletCap, tabletLeadTiles, TABLET_COLLAGE, TABLET_PIECE, WIDE_1X } from "./render/gallery.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const content = loadContent(ROOT);

const L = { width: 16, height: 9 };
const P = { width: 9, height: 16 };
const aspect = (p) => p.width / p.height;

function checkCollage(pieces) {
  const c = collage(pieces);
  // A reading order: every piece exactly once, the first piece leads.
  assert.deepEqual([...c.order].sort((a, b) => a - b), pieces.map((_, i) => i));
  if (pieces.length) assert.equal(c.order[0], 0);
  for (const name of Object.keys(LAYOUTS)) {
    const { rows, slots } = c.layouts[name];
    // Rows cover the order in sequence (flex rows follow the DOM order).
    assert.deepEqual(rows.flat(), c.order.map((_, i) => i), `${name}: rows in order`);
    assert.equal(slots.length, pieces.length);
    for (const row of rows) {
      // Every row fills the width exactly, and every piece in it has the
      // same height: its share follows its own aspect ratio (no cropping).
      const sum = row.reduce((s, i) => s + slots[i].share, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${name}: row shares sum to 1 (${sum})`);
      const heights = row.map((i) => slots[i].share / aspect(pieces[c.order[i]]));
      for (const h of heights) assert.ok(Math.abs(h - heights[0]) < 1e-9, `${name}: one height per row`);
      for (const i of row) assert.equal(slots[i].gaps, row.length - 1);
    }
  }
  return c;
}

test("collage: justified rows, full width, one height per row, nothing cropped", () => {
  for (const pieces of [content.gallery, [L], [P, P], [L, P, L, P, L, L, P, P, L, L, P, L, P, P, L, L]]) checkCollage(pieces);
});

test("collage: rows stay near the target height; no lone portrait on a wide row", () => {
  const c = checkCollage(content.gallery);
  for (const [name, spec] of Object.entries(LAYOUTS)) {
    for (const row of c.layouts[name].rows) {
      const h = c.layouts[name].slots[row[0]].height;
      assert.ok(h > spec.target * 0.55 && h < spec.target * 1.8, `${name}: row height ${h.toFixed(3)} near ${spec.target}`);
      if (name !== "narrow") assert.ok(!(row.length === 1 && aspect(content.gallery[c.order[row[0]]]) < 1), `${name}: lone portrait`);
    }
  }
});

test("collage: deterministic, and empty is empty", () => {
  assert.deepEqual(collage(content.gallery), collage(content.gallery));
  const empty = collage([]);
  assert.deepEqual(empty.order, []);
  assert.deepEqual(empty.layouts.wide.rows, []);
  assert.deepEqual(breakRows([], LAYOUTS.wide), { rows: [], cost: 0 });
});

test("collage: image width is the share of the row after its gaps and every frame edge", () => {
  const slot = { share: 0.5, gaps: 1, row: 0, height: 0.28 };
  assert.equal(imageWidth(slot, 1200), (1200 - 3 - 2 * 4) * 0.5);
  // One height per row in CSS px too: pictures of a mixed row (portrait next
  // to landscape) come out the same height once the frames are counted.
  const { layouts, order } = collage(content.gallery);
  for (const name of Object.keys(LAYOUTS)) {
    for (const row of layouts[name].rows) {
      const hs = row.map((i) => imageWidth(layouts[name].slots[i], 1200) / aspect(content.gallery[order[i]]));
      for (const h of hs) assert.ok(Math.abs(h - hs[0]) < 1e-6, `${name}: picture heights ${hs.map((x) => x.toFixed(2))}`);
    }
  }
});

test("gallery section on the home page: same collage, every tile waits, links the full page", () => {
  const html = gallerySection(content);
  assert.match(html, /<section class="sec sec--gallery" id="gallery"/);
  assert.match(html, /href="\/gallery\/"/);
  assert.doesNotMatch(html, /fetchpriority="high"/);
  assert.equal((html.match(/<picture class="art__pic" data-defer>/g) ?? []).length, content.gallery.length);
  assert.equal(collageBlock({ ...content, gallery: [] }, true), `<p class="empty">Nothing here yet.</p>`);
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
  // One lazy image per <noscript> copy; eager only on the lead tiles.
  assert.equal((html.match(/loading="lazy"/g) ?? []).length, (html.match(/<noscript><picture/g) ?? []).length);
  const leads = new Set([...leadTiles(placed), ...tabletLeadTiles(placed)]);
  assert.equal((html.match(/loading="eager"/g) ?? []).length, leads.size);
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
    // The visible number is the piece's place on the wall (reading order), so
    // stepping with the arrows counts 01, 02, 03 and never looks like a skip.
    const pos = String(at + 1).padStart(2, "0");
    assert.match(html, new RegExp(`piece ${pos} of ${String(placed.length).padStart(2, "0")}`));
    assert.match(html, new RegExp(`class="counter piece__count"><b>${pos}</b>`));
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

// Which <source> (or the <img>) a browser picks for a tile's picture, as the
// HTML picture algorithm does: the first source whose media matches and that
// has a srcset (one still in data-srcset is skipped), else the <img>. Returns
// the pick's srcset, or null when nothing loads yet.
const SCREENS = {
  phone: { w: 390, dpr: 3 },
  tablet: { w: 820, dpr: 2 },
  tablet768: { w: 768, dpr: 2 },
  midWindow: { w: 1000, dpr: 1 },
  wide: { w: 1440, dpr: 1 },
  wide2x: { w: 1440, dpr: 2 },
};
function mediaMatches(media, { w, dpr }) {
  return media.split(/\s+and\s+/).every((q) => {
    const m = q.match(/^\((min|max)-(width|resolution): ([\d.]+)(px|dppx)\)$/);
    assert.ok(m, `known media feature: ${q}`);
    const v = m[2] === "width" ? w : dpr;
    return m[1] === "min" ? v >= Number(m[3]) : v <= Number(m[3]);
  });
}
function pick(picture, screen) {
  for (const s of picture.match(/<source [^>]*>/g) ?? []) {
    if (!mediaMatches(attr(s, "media"), screen)) continue;
    const srcset = attr(s, "srcset");
    if (srcset !== undefined) return srcset;
  }
  return attr(picture.match(/<img [^>]*>/)[0], "srcset") ?? null;
}
/** Each tile's live picture (not its <noscript> copy), by piece id. */
function pictures(html) {
  return new Map([...html.matchAll(/data-piece="(\d+)"[^>]*>(<picture class="art__pic"[^]*?<\/picture>)/g)].map((m) => [m[1], m[2]]));
}
const maxWidth = (srcset) => Math.max(...urls(srcset).map(([, w]) => parseInt(w)));

test("gallery page: each layout's lead tiles load at once; the rest wait, with a no-JS copy", () => {
  const html = galleryPage(content);
  const { placed } = galleryOrder(content.gallery);
  const phoneLeads = leadTiles(placed);
  const tabletLeads = tabletLeadTiles(placed);
  const leads = placed.filter((p) => phoneLeads.includes(p) || tabletLeads.includes(p));
  const byId = pictures(html);
  assert.equal(byId.size, placed.length);
  // A tile loads at once exactly on the screens where it leads: the phone's
  // pair on phones and on desktop (as before), the tablet's lead on tablets
  // and 1x windows of the same layout. Nothing else loads before the script.
  for (const p of placed) {
    const pic = byId.get(p.item.id);
    const want = { phone: phoneLeads.includes(p), tablet: tabletLeads.includes(p), tablet768: tabletLeads.includes(p), midWindow: tabletLeads.includes(p), wide: phoneLeads.includes(p), wide2x: phoneLeads.includes(p) };
    for (const [name, screen] of Object.entries(SCREENS)) assert.equal(pick(pic, screen) !== null, want[name], `${p.item.id} on ${name}`);
    const lead = leads.includes(p);
    assert.equal(/fetchpriority="high"/.test(pic), lead, `${p.item.id}: high priority iff it leads somewhere`);
    assert.equal(/loading="eager"/.test(pic), lead);
  }
  assert.equal((html.match(/fetchpriority="high"/g) ?? []).length, leads.length);
  const high = [...html.matchAll(/<img class="art__img"[^>]*fetchpriority="high"[^>]*>/g)].map((m) => attr(m[0], "alt"));
  assert.equal(high[0], placed[0].item.alt.replaceAll('"', "&quot;"), "the first piece leads");
  // Today the phone's pair (01, 02) and the tablet's big second-row piece (03) differ.
  assert.ok(!tabletLeads.includes(placed[0]), "the tablet's lead is not the phone's");
  // Every tile that waits anywhere is a deferred picture with a <noscript> copy.
  const deferred = placed.filter((p) => !(phoneLeads.includes(p) && tabletLeads.includes(p)));
  assert.equal((html.match(/<picture class="art__pic" data-defer>/g) ?? []).length, deferred.length);
  assert.equal((html.match(/<noscript><picture class="art__pic">/g) ?? []).length, deferred.length);
  // Nothing on the page points at the 2048px display file except the viewer's data-src.
  const imgs = [...html.matchAll(/<img class="art__img"[^>]*>/g)].map((m) => m[0]);
  for (const t of imgs) assert.doesNotMatch(attr(t, "src") ?? attr(t, "data-src") ?? "", /\/gallery\/\d{2}\.webp$/);
});

test("gallery page: the lead's same-size twin on a phone loads with it, inside one byte budget", () => {
  const { placed } = galleryOrder(content.gallery);
  const leads = leadTiles(placed);
  // The phone layout's first two rows are 01 and 02, both full width and the
  // same shape: one size, so the second must not load after the first.
  assert.equal(leads[0], placed[0]);
  const w = (p) => imageWidth(p.slots.narrow, 390 - 36);
  for (const p of placed.slice(1)) {
    const twin = p.slots.narrow.row <= 1 && w(p) ** 2 * (p.item.height / p.item.width) >= 0.97 * w(placed[0]) ** 2 * (placed[0].item.height / placed[0].item.width);
    assert.equal(leads.includes(p), twin, `${p.item.id}: twin ${twin}`);
  }
  assert.ok(leads.length >= 2, "the current wall has a phone twin");
  const caps = leadPhoneCaps(leads);
  const bytes = leads.reduce((sum, p) => sum + p.item.bytes.get(caps.get(p)), 0);
  assert.ok(bytes <= PIECE_PHONE_BUDGET, `lead tiles ${bytes} B on a phone`);
  for (const p of leads) {
    const cap = caps.get(p);
    assert.ok(cap >= 1.5 * w(p) * 0.95, `${p.item.id}: cap ${cap} keeps ~1.5x`);
    assert.ok(cap <= phoneCap(p.item, w(p)), `${p.item.id}: never above the plain cap`);
  }
  // A lone lead that fits keeps its plain cap.
  assert.equal(leadPhoneCaps([placed[0]]).get(placed[0]), phoneCap(placed[0].item, w(placed[0])));
  // The same budgeted copies on both pages: /gallery/ (live) and the home section (waiting).
  for (const html of [galleryPage(content), gallerySection(content)]) {
    for (const p of leads) {
      const src = html.match(new RegExp(`data-piece="${p.item.id}"[^]*?<source media="\\(max-width: 659px\\)" (?:data-)?srcset="([^"]*)"`))[1];
      assert.equal(Math.max(...urls(src).map(([, x]) => parseInt(x))), caps.get(p), p.item.id);
    }
  }
});

test("gallery page: phones are capped near 2x of their tile; sizes follow the layout", () => {
  const html = galleryPage(content);
  const sources = [...html.matchAll(/<source media="\(max-width: 659px\)" (?:data-)?srcset="([^"]*)"/g)].map((m) => m[1]);
  const { placed } = galleryOrder(content.gallery);
  // One per tile, and one per <noscript> copy.
  assert.equal(sources.length, content.gallery.length + (html.match(/<noscript>/g) ?? []).length);
  for (const s of sources) assert.ok(Math.max(...urls(s).map(([, w]) => parseInt(w))) <= 640, s);
  // The lead shares the first wide row with another landscape: half of 1200px
  // less one 3px gap, less the 2px frame a side, from 1296px.
  assert.equal(placed[0].slots.wide.gaps, 1);
  assert.match(collageSizes(placed[0].slots), /^\(min-width: 1296px\) 595px, /);
  // And full width on a phone: 390 - 36 less the frame = 350 CSS px, capped at the 640 copy.
  assert.equal(placed[0].slots.narrow.share, 1);
  assert.equal(phoneCap(placed[0].item, imageWidth(placed[0].slots.narrow, 390 - 36)), 640);
});

test("gallery page: tablets are capped near 1.5x of their tile; the tablet's lead fits the byte budget", () => {
  const { placed } = galleryOrder(content.gallery);
  // The mid layout's image width on an 820px tablet (91vw box).
  const w = (p) => imageWidth(p.slots.mid, 0.91 * 820);
  const all = (item) => [...item.widths, item.width];
  for (const p of placed) {
    const cap = tabletCap(p.item, w(p));
    // At most 1.5x, unless that would drop under 1x (then the first copy at or above 1x).
    const oneX = all(p.item).find((x) => x >= w(p));
    assert.ok(cap <= 1.5 * w(p) || cap === oneX, `${p.item.id}: cap ${cap} for ${w(p).toFixed(0)} px`);
    assert.ok(cap >= w(p), `${p.item.id}: never under 1x`);
    assert.ok(!all(p.item).some((x) => x > cap && x <= 1.5 * w(p)), `${p.item.id}: the largest copy within 1.5x`);
  }
  // The tablet's lead: the largest picture in the mid layout's first two
  // rows (today 03, the big second-row piece), alone on the line.
  const leads = tabletLeadTiles(placed);
  const area = (p) => w(p) ** 2 * (p.item.height / p.item.width);
  const top = placed.filter((p) => p.slots.mid.row <= 1);
  const most = Math.max(...top.map(area));
  assert.deepEqual(leads, top.filter((p) => area(p) >= 0.97 * most));
  assert.deepEqual(leads.map((p) => p.item.id), ["03"]);
  // They share the byte budget, but never drop under 1x: an upscaled lead
  // counts only its own pixels toward Largest Contentful Paint, so the next
  // big tile to land would take the largest paint from it.
  const caps = leadTabletCaps(leads);
  const bytes = leads.reduce((sum, p) => sum + p.item.bytes.get(caps.get(p)), 0);
  const floor = (p) => all(p.item).find((x) => x >= w(p));
  assert.ok(bytes <= PIECE_PHONE_BUDGET || leads.every((p) => caps.get(p) === floor(p)), `tablet lead tiles ${bytes} B`);
  for (const p of leads) {
    assert.ok(caps.get(p) <= tabletCap(p.item, w(p)), `${p.item.id}: never above the plain tablet cap`);
    assert.ok(caps.get(p) >= floor(p), `${p.item.id}: cap ${caps.get(p)} at least 1x on an 820px tablet`);
    // And at least 1x on a 768px tablet too (its tiles are a little smaller).
    assert.ok(caps.get(p) >= imageWidth(p.slots.mid, 0.91 * 768), `${p.item.id}: 1x at 768px`);
  }
  // On the first screen of a 768 or 820px tablet no other tile, at its
  // tablet cap, scores a larger paint than the lead (min of its drawn area
  // and its own pixels), so none can take the largest paint after it.
  for (const vw of [768, 820]) {
    const box = 0.91 * vw;
    const score = (p, cap) => {
      const dw = imageWidth(p.slots.mid, box);
      const drawn = dw * dw * (p.item.height / p.item.width);
      return Math.min(drawn, cap * cap * (p.item.height / p.item.width));
    };
    const lead = Math.max(...leads.map((p) => score(p, caps.get(p))));
    for (const p of placed.filter((q) => q.slots.mid.row <= 2 && !leads.includes(q)))
      assert.ok(score(p, tabletCap(p.item, w(p))) < lead, `${p.item.id} at ${vw}px scores under the lead`);
  }
  // In the markup: a 2x tablet picks from the capped srcset, on /gallery/ and
  // in the home section alike (the same copies); a 1x window at the same
  // widths and every desktop keep every copy.
  for (const html of [galleryPage(content), gallerySection(content)]) {
    const tablet = [...html.matchAll(/<source media="([^"]*)" (?:data-)?srcset="([^"]*)"/g)].filter((m) => m[1] === TABLET_COLLAGE);
    assert.equal(tablet.length, content.gallery.length + (html.match(/<noscript>/g) ?? []).length);
    assert.match(TABLET_COLLAGE, /\(min-resolution: 1\.5dppx\)/);
    for (const p of placed) {
      const src = html.match(new RegExp(`data-piece="${p.item.id}"[^]*?<source media="${TABLET_COLLAGE.replace(/[()]/g, "\\$&")}" (?:data-)?srcset="([^"]*)"`))[1];
      assert.equal(maxWidth(src), caps.get(p) ?? tabletCap(p.item, w(p)), `${p.item.id} tablet cap in the markup`);
      assert.ok(maxWidth(src) < p.item.width, `${p.item.id}: a tablet never pulls the display file`);
    }
  }
  const byId = pictures(galleryPage(content));
  for (const p of leads) {
    const pic = byId.get(p.item.id);
    assert.equal(maxWidth(pick(pic, SCREENS.tablet)), caps.get(p));
    assert.equal(maxWidth(pick(pic, SCREENS.midWindow)), p.item.width, "1x windows keep every copy");
  }
});

test("arriving at /#gallery: the head preloads each layout's first-screen lead, the very copy its tile picks", () => {
  const script = galleryArrival(content);
  assert.match(script, /^<script>if\(location\.hash==="#gallery"\)\[\[/);
  assert.doesNotMatch(script.slice("<script".length, -"</script>".length), /<\//, "nothing closes the script early");
  // Run it: only #gallery adds preloads.
  const run = (hash) => {
    const added = [];
    const document = {
      createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }),
      head: { appendChild: (l) => added.push({ rel: l.rel, as: l.as, media: l.media, ...l.attrs }) },
    };
    new Function("location", "document", script.slice("<script>".length, -"</script>".length))({ hash }, document);
    return added;
  };
  assert.deepEqual(run(""), []);
  assert.deepEqual(run("#donate"), []);
  const links = run("#gallery");
  for (const l of links) {
    assert.equal(l.rel, "preload");
    assert.equal(l.as, "image");
    assert.equal(l.fetchpriority, "high");
  }
  // Per screen: the preloads that apply there are exactly the tiles ARRIVAL
  // starts first on that screen, with the srcset and sizes each tile's
  // picture uses once released (its data-srcset moved into place).
  const { placed } = galleryOrder(content.gallery);
  const byId = pictures(gallerySection(content));
  const released = (p) => byId.get(p.item.id).replaceAll("data-srcset=", "srcset=").replaceAll("data-src=", "src=");
  const sizesOf = (pic, screen) => {
    for (const s of pic.match(/<source [^>]*>/g) ?? []) if (mediaMatches(attr(s, "media"), screen)) return attr(s, "sizes");
    return attr(pic.match(/<img [^>]*>/)[0], "sizes");
  };
  const want = { phone: [placed[0]], tablet: tabletLeadTiles(placed), tablet768: tabletLeadTiles(placed), midWindow: [], wide: leadTiles(placed), wide2x: leadTiles(placed) };
  for (const [name, screen] of Object.entries(SCREENS)) {
    const here = links.filter((l) => mediaMatches(l.media, screen));
    assert.equal(here.length, want[name].length, `${name}: ${here.length} preloads`);
    want[name].forEach((p, i) => {
      const pic = released(p);
      assert.equal(here[i].imagesrcset, pick(pic, screen), `${name}: ${p.item.id} srcset`);
      const sizes = sizesOf(pic, screen);
      // On a dense wide screen the <img> covers the wide layout with every
      // layout's sizes; the preload carries just the wide ones, the same length there.
      if (name === "wide2x") {
        const [top, rest] = here[i].imagesizes.split(/, (?=calc)/);
        assert.ok(sizes.startsWith(`${top}, (min-width: 1096px) ${rest}, `), `${name}: ${p.item.id} sizes`);
      } else assert.equal(here[i].imagesizes, sizes, `${name}: ${p.item.id} sizes`);
    });
  }
  // A tablet's preload is its capped lead, not a 960 or 1280 copy.
  for (const l of links.filter((x) => x.media === TABLET_COLLAGE)) assert.ok(maxWidth(l.imagesrcset) <= 640, l.imagesrcset);
  // A 1x desktop's preloads are the wide lead tiles at their desktop caps.
  const wideCaps = leadWideCaps(leadTiles(placed));
  for (const l of links.filter((x) => x.media === WIDE_1X)) assert.ok([...wideCaps.values()].includes(maxWidth(l.imagesrcset)), l.imagesrcset);
  // No pieces, no script.
  assert.equal(galleryArrival({ ...content, gallery: [] }), "");
});

test("gallery page: a 1x desktop's lead pair comes from copies of 0.9-1x, the same on both pages", () => {
  const { placed } = galleryOrder(content.gallery);
  const leads = leadTiles(placed);
  const caps = leadWideCaps(leads);
  // The first wide row's pair, 595 CSS px each on a 1440px desktop.
  const w = (p) => imageWidth(p.slots.wide, 1200);
  const all = (item) => [...item.widths, item.width];
  const bytes = leads.reduce((sum, p) => sum + p.item.bytes.get(caps.get(p)), 0);
  const floor = (p) => all(p.item).find((x) => x >= 0.9 * w(p));
  assert.ok(bytes <= PIECE_PHONE_BUDGET || leads.every((p) => caps.get(p) === floor(p)), `wide lead tiles ${bytes} B`);
  for (const p of leads) {
    const cap = caps.get(p);
    assert.ok(cap >= 0.9 * w(p), `${p.item.id}: cap ${cap} at least 0.9x of ${w(p).toFixed(0)} px`);
    assert.ok(cap <= all(p.item).find((x) => x >= w(p)), `${p.item.id}: never above 1x`);
  }
  // Today: both 560 (the 640 pair, 277 KB, held LCP at 2.52-2.56 s), and one
  // shape from one copy, so both score the same area for LCP.
  assert.deepEqual(leads.map((p) => caps.get(p)), [560, 560]);
  for (const html of [galleryPage(content), gallerySection(content)]) {
    const byId = pictures(html);
    for (const p of leads) {
      const pic = byId.get(p.item.id).replaceAll("data-srcset=", "srcset=");
      assert.equal(maxWidth(pick(pic, SCREENS.wide)), caps.get(p), `${p.item.id} on a 1x desktop`);
      assert.equal(maxWidth(pick(pic, SCREENS.wide2x)), p.item.width, `${p.item.id}: a dense desktop keeps every copy`);
    }
    // Only the lead pair carries a desktop cap.
    assert.equal((html.split(`<source media="${WIDE_1X}"`).length - 1), leads.length * (html.includes("<noscript>") ? 2 : 1));
  }
});

test("piece pages: tablets and desktops start from a copy inside the byte budget, and can sharpen", () => {
  const all = (item) => [...item.widths, item.width];
  const want = {};
  content.gallery.forEach((item, i) => {
    const html = piecePage(content, i);
    const img = html.match(/<img class="piece__img"[^>]*>/)[0];
    const source = (media) => html.match(new RegExp(`<source media="${media.replace(/[()]/g, "\\$&")}" srcset="([^"]*)" sizes="([^"]*)" data-cap />`));
    const tablet = source(TABLET_PIECE);
    const desktop = source(DESKTOP_PIECE);
    assert.ok(tablet && desktop, `${item.id}: tablet and desktop sources`);
    // In selection order: phone, tablet (dense), desktop; the <img> keeps every copy.
    assert.ok(html.indexOf("(max-width: 699px)") < html.indexOf(TABLET_PIECE) && html.indexOf(TABLET_PIECE) < html.indexOf(`"${DESKTOP_PIECE}"`));
    assert.equal(maxWidth(tablet[1]), pieceTabletCap(item));
    assert.equal(maxWidth(desktop[1]), pieceDesktopCap(item));
    assert.equal(tablet[2], attr(img, "sizes"));
    assert.equal(desktop[2], attr(img, "sizes"));
    assert.equal(attr(img, "srcset"), artSrcset(item));
    // Byte counts in srcset order, for motion/piece.ts.
    assert.deepEqual(attr(img, "data-bytes").split(" ").map(Number), all(item).map((w) => item.bytes.get(w)));
    for (const [name, cap, css, top] of [
      ["tablet", pieceTabletCap(item), pieceWidthAt(item, 820, 1180), tabletCap(item, pieceWidthAt(item, 820, 1180))],
      ["desktop", pieceDesktopCap(item), pieceWidthAt(item, 1440, 900), all(item).find((w) => w >= pieceWidthAt(item, 1440, 900)) ?? item.width],
    ]) {
      assert.ok(item.bytes.get(cap) <= PIECE_PHONE_BUDGET, `${item.id} ${name}: ${cap} is ${item.bytes.get(cap)} B`);
      assert.ok(cap <= top, `${item.id} ${name}: never above its top (${top})`);
      assert.ok(cap >= css / 2, `${item.id} ${name}: ${cap} at least half of ${css.toFixed(0)} px`);
      const sharper = all(item).filter((w) => w > cap && w <= top && item.bytes.get(w) <= PIECE_PHONE_BUDGET);
      assert.deepEqual(sharper, [], `${item.id} ${name}: the sharpest copy that fits`);
    }
    want[item.id] = [pieceTabletCap(item), pieceDesktopCap(item)];
  });
  // Today, [tablet, desktop]: landscapes 512-640, portraits 384-640.
  assert.deepEqual(want, { "01": [640, 640], "02": [640, 640], "03": [512, 512], "04": [640, 640], "05": [512, 512], "06": [640, 512], "07": [640, 384], "08": [640, 384], "09": [384, 384] });
  // The drawn width matches the page's sizes: 768 and 820 tablets, a 1440x900 desktop.
  const five = content.gallery.find((x) => x.id === "05");
  assert.equal(pieceWidthAt(five, 768, 1024).toFixed(1), "668.9");
  assert.equal(pieceWidthAt(five, 1440, 900).toFixed(1), "1013.3");
});

test("piece pages: srcset with a phone cap inside the byte budget, deferred film strip", () => {
  content.gallery.forEach((item, i) => {
    const html = piecePage(content, i);
    const img = html.match(/<img class="piece__img"[^>]*>/)[0];
    assert.match(img, /fetchpriority="high"/);
    assert.equal(urls(attr(img, "srcset")).at(-1)[0], item.src);
    assert.doesNotMatch(attr(img, "src"), /\/gallery\/\d{2}\.webp$/);
    const phone = html.match(/<source media="\(max-width: 699px\)" srcset="([^"]*)" sizes="[^"]*" data-cap \/>/)[1];
    const cap = Math.max(...urls(phone).map(([, w]) => parseInt(w)));
    assert.equal(cap, piecePhoneCap(item));
    const capBytes = item.bytes.get(cap);
    assert.ok(capBytes <= PIECE_PHONE_BUDGET, `${item.id}: cap ${cap} is ${capBytes} B`);
    const within = [...item.bytes].filter(([w, b]) => w > cap && w <= 2 * 324 * 1.2 && b <= PIECE_PHONE_BUDGET);
    assert.deepEqual(within, [], `${item.id}: no sharper copy fits the budget`);
    // 1.5x or more for all but the grainiest (09: 384, 1.2x; its 512 copy is 296 KB), never under 1x.
    assert.ok(cap >= 324, `${item.id}: cap ${cap} at least 1x`);
    if (item.id !== "09") assert.ok(cap >= 1.5 * 324 * 0.95, `${item.id}: cap ${cap} (${capBytes} B) keeps ~1.5x`);
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
  assert.match(css, /\.art__pic\s*\{[^}]*background:\s*var\(--panel(-2)?\)/);
  // Every waiting collage <img> carries data-src, so the rule covers all of them.
  const html = galleryPage(content);
  for (const t of [...html.matchAll(/<img class="art__img"[^>]*>/g)].map((m) => m[0]))
    if (!/ src="/.test(t)) assert.match(t, / data-src="/);
});

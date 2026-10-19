// node --test: the landing, /projects/ and project pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cardArt } from "./render/cardart.ts";
import { landing, projectPage, projectsIndex } from "./render/landing.ts";
import { routes } from "./render/routes.ts";
import { projects, projectHref } from "./data/projects.ts";
import { downloads } from "./data/downloads.ts";

const content = { docs: [], posts: [], gallery: [] };

test("card art (Dex 10-19): every project's layers fill its card, back to front, lazily, decorative, and the files exist", () => {
  for (const p of projects) {
    const html = cardArt(p);
    assert.match(html, /^<div class="cart" data-tilt-scene(?: data-rig="[^"]+")? aria-hidden="true" style="--aw:\d+;--ah:\d+">/);
    const imgs = [...html.matchAll(/<img class="cart__l" data-depth="(\d)" src="([^"]+)" alt="" width="(\d+)" height="(\d+)" loading="lazy" decoding="async"/g)];
    assert.equal(imgs.length, p.art.layers, `${p.id} layers`);
    assert.ok(p.art.layers >= 2, `${p.id}: layers to pan`);
    // back to front: the far layer moves least
    const depths = imgs.map((m) => +m[1]);
    assert.deepEqual(depths, [...depths].sort((a, b) => a - b), `${p.id} depths rise to the front`);
    assert.ok(depths[0] < depths[depths.length - 1]);
    imgs.forEach((m, i) => {
      assert.equal(m[2], `/site/cards/${p.id}/${i}.png`);
      assert.ok(existsSync(new URL(`../../public${m[2]}`, import.meta.url)), `${m[2]} exists`);
      assert.equal(+m[3], p.art.w);
      assert.equal(+m[4], p.art.h);
    });
    assert.match(html, /<span class="cart__shine"><\/span><\/div>$/);
  }
});

test("every project has a page route, a doc link and at least one fact", () => {
  const paths = routes(content).map((r) => r.path);
  assert.ok(paths.includes("/projects/"));
  for (const p of projects) {
    assert.ok(paths.includes(projectHref(p)), `${p.id} route`);
    assert.match(p.docs.href, /^\/docs\/[\w-]+\/$/);
    assert.ok(p.facts.length > 0);
  }
});

test("landing lists the projects in Dex's order and links each page", () => {
  const html = landing(content);
  assert.deepEqual(projects.map((p) => p.name), ["dexCode", "dexClient", "dex.place"]);
  let at = -1;
  for (const p of projects) {
    const i = html.indexOf(`id="p-${p.id}"`);
    assert.ok(i > at, `${p.id} in order`);
    at = i;
    assert.ok(html.includes(`href="${projectHref(p)}"`));
  }
  // the cards carry their art (no code-drawn placeholder scenes, no "placeholder art" plates)
  assert.equal(html.match(/<div class="cart" data-tilt-scene/g)?.length, projects.length);
  assert.doesNotMatch(html, /Placeholder art/i);
});

test("home cards: every project leads to its page, its docs and the one action that matters", () => {
  const html = landing(content);
  for (const p of projects) {
    const start = html.indexOf(`id="p-${p.id}"`);
    const cardHtml = html.slice(start, html.indexOf("</article>", start));
    assert.ok(cardHtml.includes(`href="${projectHref(p)}"`), `${p.id} details`);
    assert.ok(cardHtml.includes(`href="${p.docs.href}"`), `${p.id} docs`);
    const entry = downloads.find((d) => d.id === p.id);
    if (entry?.file) assert.ok(cardHtml.includes(`href="${entry.file.href}" download`), `${p.id} direct file`);
    else if (entry?.installedBy) assert.ok(cardHtml.includes(`href="#${entry.installedBy}"`), `${p.id} points at its installer`);
    else assert.ok(cardHtml.includes(`href="#world"`), `${p.id} leads up to the world`);
  }
});

test("download state comes from data/downloads.ts, never invented", () => {
  for (const p of projects) {
    const entry = downloads.find((d) => d.id === p.id);
    // The project's own part of its page; "Other projects" cards carry their own state.
    const page = projectPage(p);
    const html = page.slice(0, page.indexOf('class="others"'));
    if (entry?.file) {
      assert.ok(html.includes(`href="${entry.file.href}"`), `${p.id} links its real file`);
    } else {
      assert.ok(!/\.exe"/.test(html), `${p.id} links no installer`);
    }
  }
});

test("no Dex art outside the gallery, and #world only on the root page", () => {
  for (const html of [landing(content), projectsIndex(), ...projects.map(projectPage)]) {
    assert.ok(!/src="\/gallery\//.test(html));
    // the only pictures are the projects' own card art
    for (const [, src] of html.matchAll(/<img [^>]*src="([^"]+)"/g)) assert.match(src, /^\/site\/cards\//);
  }
  for (const html of [projectsIndex(), ...projects.map(projectPage)]) {
    assert.ok(!/href="#world"/.test(html));
  }
});

// ----------------------------------------------------- the one-scroll home

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "./build/content.ts";
import { NAV } from "./data/nav.ts";
import { shell } from "./render/layout.ts";

const real = loadContent(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));

test("home: every section in Dex's order, each with the anchor the nav jumps to", () => {
  const html = landing(real);
  const order = ["projects", "downloads", "gallery", "docs", "blog", "donate"];
  let at = -1;
  for (const id of order) {
    const i = html.indexOf(`id="${id}"`);
    assert.ok(i > at, `#${id} after the one before it`);
    at = i;
  }
  assert.deepEqual(NAV.map((n) => n.id), order);
  // Each section is usable in place: the file, the collage, the docs, the QR.
  assert.match(html, /href="\/downloads\/dexClient-Setup-[\d.]+\.exe"/);
  assert.match(html, /data-collage/);
  assert.match(html, /data-donate/);
  for (const d of real.docs) assert.ok(html.includes(`href="${d.url}"`), d.url);
  for (const p of real.posts) assert.ok(html.includes(`href="${p.url}"`), p.url);
});

test("home: Dex's art appears only inside the collage", () => {
  const html = landing(real);
  const start = html.indexOf(`<div class="collage-box">`);
  const end = html.indexOf(`</ul></div>`, start);
  assert.ok(start > 0 && end > start);
  const outside = html.slice(0, start) + html.slice(end);
  // (The viewer dialog has two empty <img> slots it fills from the collage.)
  // (and the projects' card art is our own pixel art from /site/cards/, never Dex's)
  assert.doesNotMatch(outside.replace(/<img class="viewer__(lo|hi)" alt="" data-viewer-(lo|hi) \/>/g, "").replace(/<img class="cart__l" [^>]*src="\/site\/cards\/[^>]*>/g, ""), /<img /);
  assert.doesNotMatch(outside, /(src|srcset)="\/gallery\//);
});

test("nav: anchors on the home page, home + anchor elsewhere; inner pages mark their section", () => {
  const meta = (page, path) => ({ path, title: page, page, description: "" });
  const home = shell({ meta: meta("home", "/"), main: "" }).body;
  for (const n of NAV) assert.ok(home.includes(`class="nav__link" href="${n.anchor}"`), n.id);
  assert.doesNotMatch(home, /class="nav__link"[^>]*aria-current/);
  const docs = shell({ meta: meta("docs", "/docs/"), main: "" }).body;
  for (const n of NAV) assert.ok(docs.includes(`class="nav__link" href="/${n.anchor}"`), n.id);
  assert.match(docs, /class="nav__link" href="\/#docs" aria-current="true"/);
});

test("card rigs (Dex 10-19): every rigged card's card.svg + rig.json keep the agreed format, and the motions stay small", async () => {
  const { readFileSync } = await import("node:fs");
  const { pose, coverOf } = await import("./motion/cardrig.ts");
  const rigged = projects.filter((p) => p.art.rig);
  assert.ok(rigged.length >= 1, "at least one card plays a rig");
  for (const p of rigged) {
    assert.match(cardArt(p), new RegExp(`data-rig="/site/cards/${p.id}/"`));
    const svg = readFileSync(new URL(`../../public/site/cards/${p.id}/card.svg`, import.meta.url), "utf8");
    const rig = JSON.parse(readFileSync(new URL(`../../public/site/cards/${p.id}/rig.json`, import.meta.url), "utf8"));
    assert.equal(rig.v, 1);
    const vb = /^<svg [^>]*viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
    assert.ok(vb, `${p.id}: an svg with a viewBox from 0 0`);
    assert.deepEqual(rig.size.map(Number), [+vb[1], +vb[2]], `${p.id}: rig.size is the viewBox`);
    assert.doesNotMatch(svg, /<(image|text|script|filter|mask|foreignObject|style)\b|href="http|url\(http/i, `${p.id}: plain shapes only`);
    assert.ok(svg.length <= 400 * 1024, `${p.id}: card.svg ${Math.round(svg.length / 1024)} KB`);
    // every rig part is a top-level group of the svg, and their order is the drawing order
    const top = [...svg.matchAll(/<g id="([a-z0-9-]+)"/g)].map((m) => m[1]);
    for (const id of Object.keys(rig.parts)) assert.ok(top.includes(id), `${p.id}: part ${id} is a group`);
    for (const [id, part] of Object.entries(rig.parts)) {
      assert.ok((part.depth ?? 0.5) >= 0 && (part.depth ?? 0.5) <= 1, `${p.id} ${id}: depth 0..1`);
      for (const m of part.motion ?? []) assert.ok(["sway", "breathe", "bob", "glow", "drift", "flicker"].includes(m.kind) && m.period > 0, `${p.id} ${id}: ${m.kind}`);
    }
  }
  // the poses: a sway swings both ways within its degrees, a breath never shrinks below 1 tall, a glow stays in range,
  // a drift fades in and out
  const sw = [0, 0.5, 1, 1.5, 2].map((t) => pose([{ kind: "sway", deg: 3, period: 2 }], t).rot);
  assert.ok(Math.max(...sw) <= 3 && Math.min(...sw) >= -3 && Math.max(...sw) > 2 && Math.min(...sw) < -2);
  for (let t = 0; t < 4; t += 0.25) {
    const b = pose([{ kind: "breathe", scale: 0.02, period: 4 }], t);
    assert.ok(b.sy >= 1 && b.sy <= 1.02 && b.sx <= 1);
    const g = pose([{ kind: "glow", min: 0.6, max: 1, period: 2 }], t).alpha;
    assert.ok(g >= 0.6 - 1e-9 && g <= 1 + 1e-9);
  }
  assert.ok(pose([{ kind: "drift", dy: -10, period: 1, fade: true }], 0.01).alpha < 0.2);
  assert.equal(pose([{ kind: "drift", dy: -10, period: 1, fade: true }], 0.5).alpha, 1);
  // the cover: the art always covers the card with room to pan
  const c = coverOf({ v: 1, size: [1152, 2048], parts: {} }, 240, 427);
  assert.ok(1152 * c.s >= 240 + 28 - 1e-6 && 2048 * c.s >= 427 + 28 - 1e-6);
  assert.ok(c.left <= -14 + 1e-6 && c.top <= 0);
});

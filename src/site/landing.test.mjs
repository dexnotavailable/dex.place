// node --test: the landing, /projects/ and project pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Canvas, SCENE_FILL, SCENE_H, SCENE_W, SPRITES, projectArt, validateSprite } from "./render/art.ts";
import { landing, projectPage, projectsIndex } from "./render/landing.ts";
import { routes } from "./render/routes.ts";
import { projects, projectHref } from "./data/projects.ts";
import { downloads } from "./data/downloads.ts";

const content = { docs: [], posts: [], gallery: [] };

test("scene sprites are well-formed grids in the scene palette", () => {
  for (const [name, grid] of Object.entries(SPRITES)) validateSprite(name, grid);
  assert.throws(() => validateSprite("bad", ["ab", "a"]));
  assert.throws(() => validateSprite("bad", ["Z"]));
});

test("the canvas draws whole cells: one rectangle per run, one path per colour", () => {
  const c = new Canvas(4, 2).rect(0, 0, 3, 1, "t").set(3, 1, "K");
  assert.equal(c.paths(), '<path fill="var(--shadow)" d="M3 1h1v1h-1z"/><path fill="var(--tone)" d="M0 0h3v1h-3z"/>');
  // Out of bounds is ignored, never wraps.
  assert.equal(new Canvas(2, 2).set(2, 0, "f").set(-1, 1, "f").paths(), "");
});

test("project scenes: decorative pixel SVG on the 80 x 50 grid, three depth layers, palette only", () => {
  for (const p of projects) {
    const html = projectArt(p);
    assert.match(html, /^<div class="scene [^"]*" data-tilt-scene aria-hidden="true">/);
    assert.equal(html.match(/class="sc-it[ "]/g)?.length, 3, `${p.id} layers`);
    assert.equal(html.match(new RegExp(`viewBox="0 0 ${SCENE_W} ${SCENE_H}"`, "g"))?.length, 3);
    assert.match(html, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(html, /rotate|skew|gradient|<img|<image/);
    const fills = new Set(Object.values(SCENE_FILL));
    for (const [, f] of html.matchAll(/<path fill="([^"]+)"/g)) assert.ok(fills.has(f), `${p.id} fill ${f}`);
    // Every rectangle starts on a whole cell inside the frame.
    for (const [, x, y] of html.matchAll(/M(-?\d+) (-?\d+)h/g)) {
      assert.ok(+x >= 0 && +x < SCENE_W && +y >= 0 && +y < SCENE_H, `${p.id} cell ${x},${y}`);
    }
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
  // Every code-drawn scene is labelled as placeholder art.
  assert.equal(html.match(/Placeholder art/g)?.length, projects.length);
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
    assert.ok(!/<img /.test(html));
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
  assert.doesNotMatch(outside.replace(/<img class="viewer__(lo|hi)" alt="" data-viewer-(lo|hi) \/>/g, ""), /<img /);
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

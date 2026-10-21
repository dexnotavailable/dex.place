// node --test: the landing, /projects/ and project pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { landing, projectPage, projectsIndex } from "./render/landing.ts";
import { routes } from "./render/routes.ts";
import { projects, projectHref } from "./data/projects.ts";
import { downloads } from "./data/downloads.ts";

const content = { docs: [], posts: [], gallery: [] };

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
  assert.equal(html.match(/<div class="cart[ "]/g)?.length, projects.length);
  assert.doesNotMatch(html, /Placeholder art/i);
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
  const order = ["projects", "downloads", "gallery", "donate", "docs", "blog"];
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
  const start = html.indexOf(`<div class="collage-box"`);
  const end = html.indexOf(`</ul></div>`, start);
  assert.ok(start > 0 && end > start);
  const outside = html.slice(0, start) + html.slice(end);
  // (The viewer dialog has two empty <img> slots it fills from the collage.)
  // (and the projects' card art is our own pixel art from /site/cards/, never Dex's)
  assert.doesNotMatch(outside.replace(/<img class="viewer__(lo|hi)" alt="" data-viewer-(lo|hi) \/>/g, "").replace(/<img class="(?:cart__l|rig__p)" [^>]*src="\/site\/cards\/[^>]*>/g, ""), /<img /);
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

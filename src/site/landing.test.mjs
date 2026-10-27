// node --test: the landing, /projects/ and project pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { landing, projectPage, projectsIndex } from "./render/landing.ts";
import { routes } from "./render/routes.ts";
import { projects, projectHref } from "./data/projects.ts";
import { downloads, RETIRED, YUKI_RELEASE } from "./data/downloads.ts";

const content = { docs: [], posts: [], gallery: [] };

test("every project has a page route, a doc link and at least one fact", () => {
  const paths = routes(content).map((r) => r.path);
  assert.ok(paths.includes("/projects/"));
  for (const p of projects) {
    assert.ok(paths.includes(projectHref(p)), `${p.id} route`);
    // a doc page, or (YUKI, Dex 10-26) the install guide on its own page
    if (p.page) assert.ok(p.docs.href.startsWith(`${p.page}#`), `${p.id}: its guide`);
    else assert.match(p.docs.href, /^\/docs\/[\w-]+\/$/);
    assert.ok(p.facts.length > 0);
  }
  // YUKI's page is /yuki/ (under Downloads), not /projects/yuki/; the retired projects' old pages say where they went
  assert.equal(projectHref(projects[0]), "/yuki/");
  assert.ok(!paths.includes("/projects/yuki/"));
  for (const r of RETIRED) assert.ok(paths.includes(`/projects/${r.id}/`), `/projects/${r.id}/ kept`);
});

test("landing lists the projects in Dex's order and links each page", () => {
  const html = landing(content);
  // Dex 10-26: YUKI the big one, the dex.place world smaller below it
  assert.deepEqual(projects.map((p) => p.name), ["YUKI", "dex.place"]);
  assert.deepEqual(projects.map((p) => p.size), ["lead", "minor"]);
  let at = -1;
  for (const p of projects) {
    const i = html.indexOf(`id="p-${p.id}"`);
    assert.ok(i > at, `${p.id} in order`);
    at = i;
    assert.ok(html.includes(`href="${projectHref(p)}"`));
  }
  // the banners carry their art (no "placeholder art" plates): YUKI's drawn in code, the others' picked
  const strips = html.slice(html.indexOf('<ul class="pbans"'), html.indexOf("</ul>", html.indexOf('<ul class="pbans"')));
  assert.equal(strips.match(/<div class="cart[ "]/g)?.length, projects.length);
  assert.doesNotMatch(html, /Placeholder art/i);
  // dexCode and dexClient: one small line under the strips, nothing else
  assert.match(html, /<p class="retired retired--projects">/);
  assert.doesNotMatch(strips, /dexCode|dexClient/);
});

test("download state comes from data/downloads.ts, never invented", () => {
  const all = routes(content);
  for (const p of projects) {
    const entry = downloads.find((d) => d.id === p.id);
    // The project's own part of its page; "Other projects" cards carry their own state. (YUKI: /yuki/.)
    const page = p.page ? all.find((r) => r.path === p.page).render().body : projectPage(p);
    const html = page.includes('class="others"') ? page.slice(0, page.indexOf('class="others"')) : page;
    if (entry?.file) {
      assert.ok(html.includes(`href="${entry.file.href}"`), `${p.id} links its real file`);
    } else {
      assert.ok(!/\.exe"/.test(html), `${p.id} links no installer`);
    }
  }
});

test("no gallery pieces outside the gallery, and #world only on the root page", () => {
  const pages = projects.filter((p) => !p.page).map(projectPage);
  for (const html of [landing(content), projectsIndex(), ...pages]) {
    assert.ok(!/src="\/gallery\//.test(html));
    // the only pictures are the projects' own card art and, since Dex 10-22 ("The art can be used for both gallery and
    // on background layers"), his own layers around it on the project banners (web cuts, decorative)
    for (const [, src] of html.matchAll(/<img [^>]*src="([^"]+)"/g)) assert.match(src, /^\/site\/(cards|banners)\//);
    for (const [img] of html.matchAll(/<img [^>]*src="\/site\/banners\/[^>]*>/g)) assert.match(img, /alt="" width="2400" height="720" loading="lazy" decoding="async"/);
  }
  for (const html of [projectsIndex(), ...pages]) {
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
  if (YUKI_RELEASE) assert.ok(html.includes(`href="${downloads[0].file.href}"`), "YUKI's file, in one click");
  else assert.match(html, /<article class="dlf"[^>]* id="yuki" data-yuki="none"/);
  assert.match(html, /data-collage/);
  assert.match(html, /data-donate/);
  for (const d of real.docs) assert.ok(html.includes(`href="${d.url}"`), d.url);
  for (const p of real.posts) assert.ok(html.includes(`href="${p.url}"`), p.url);
});

test("home: the gallery's pieces appear only inside the collage; Dex's layers elsewhere only as decor", () => {
  const html = landing(real);
  const start = html.indexOf(`<div class="collage-box"`);
  const end = html.indexOf(`</ul></div>`, start);
  assert.ok(start > 0 && end > start);
  const outside = html.slice(0, start) + html.slice(end);
  // (The viewer dialog has two empty <img> slots it fills from the collage.)
  // (and the projects' card art is the picks from /site/cards/)
  // (Dex 10-22: "The art can be used for both gallery and on background layers": the project banners' layers, his plate,
  // ink slash and fx, from /site/banners/, decorative)
  assert.doesNotMatch(
    outside
      .replace(/<img class="viewer__(lo|hi)" alt="" data-viewer-(lo|hi) \/>/g, "")
      .replace(/<img class="(?:cart__l|rig__p)" [^>]*src="\/site\/cards\/[^>]*>/g, "")
      .replace(/<img class="pban__(?:back|slash|fx)" src="\/site\/banners\/[^>]*alt=""[^>]*>/g, ""),
    /<img /,
  );
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

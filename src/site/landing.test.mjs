// node --test: the landing, /projects/ and project pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SPRITES, sprite } from "./render/art.ts";
import { landing, projectPage, projectsIndex } from "./render/landing.ts";
import { routes } from "./render/routes.ts";
import { projects, projectHref } from "./data/projects.ts";
import { downloads } from "./data/downloads.ts";
import { validateIcon } from "./pixels.ts";

const content = { docs: [], posts: [], gallery: [] };

test("scene sprites are well-formed grids and render decorative SVG", () => {
  for (const [name, grid] of Object.entries(SPRITES)) {
    validateIcon(name, grid);
    const svg = sprite(name);
    assert.match(svg, /aria-hidden="true"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
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

test("download state comes from data/downloads.ts, never invented", () => {
  for (const p of projects) {
    const entry = downloads.find((d) => d.id === p.id);
    const html = projectPage(p);
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

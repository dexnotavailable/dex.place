import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { worldFrameUrl } from "../world/mount.ts";
import { embedHref } from "./motion/embed.ts";
import { head, world } from "./render/layout.ts";

test("homepage world URL carries room/spawn, never destructive or automation flags", () => {
  const url = new URL(worldFrameUrl("https://dex.place/?room=C2&spawn=east&world=test&fresh&go&manual&mute&debug#world"), "https://dex.place");
  assert.equal(url.pathname, "/world/");
  assert.equal(url.searchParams.get("room"), "C2");
  assert.equal(url.searchParams.get("spawn"), "east");
  assert.equal(url.searchParams.get("world"), "test");
  assert.equal(url.searchParams.get("embed"), "site");
  for (const flag of ["fresh", "go", "manual", "mute", "debug"]) assert.equal(url.searchParams.has(flag), false);
});

test("world-panel page navigation keeps embed; files, external links and fragments stay intact", () => {
  const current = "https://dex.place/docs/writing-docs/?embed=world";
  assert.equal(embedHref("/gallery/05/", current), "/gallery/05/?embed=world");
  assert.equal(embedHref("/docs/dexcode/?q=one#code", current), "/docs/dexcode/?q=one&embed=world#code");
  assert.equal(embedHref("/#gallery", current), "/?embed=world#gallery");
  for (const href of ["#code", "/gallery/05.webp", "/downloads/setup.exe", "/blog/feed.xml", "https://ko-fi.com/dexdonation", "/#world"])
    assert.equal(embedHref(href, current), null, href);
});

test("embed chrome flag applies only to framed world pages; copied URLs stay standalone", () => {
  const html = head({ page: "docs", path: "/docs/", title: "Docs", description: "d" });
  const flag = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find((m) => m[1].includes('setAttribute("data-embed"'))[1];
  for (const [framed, search, expected] of [[true, "?embed=world", true], [false, "?embed=world", false], [true, "?embed=other", false]]) {
    const marks = [];
    const w = {}; w.parent = framed ? {} : w;
    vm.runInNewContext(flag, { window: w, location: { search }, URLSearchParams,
      document: { documentElement: { setAttribute: (...args) => marks.push(args) } } });
    assert.deepEqual(marks, expected ? [["data-embed", "world"]] : []);
  }
});

test("homepage retains a useful direct world route without scripts", () => {
  assert.match(world(), /class="world__fallback"[^]*href="\/world\/"/);
  assert.match(world(), /href="#site"/);
});

// node --test: /downloads/ and the home page's downloads section list only
// real files, one click each, and say plainly when a project has no public
// file (CANON: never invent binaries).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { downloads, formatBytes } from "../data/downloads.ts";
import { downloadsPage, downloadsSection } from "../render/downloads.ts";

// The host's downloads folder (ops/README.md). Only checked where it exists.
const HOST_DOWNLOADS = process.env.DEX_DOWNLOADS_DIR || "D:/Dex/Servers/dex.place/downloads";

const html = downloadsPage();
const published = downloads.filter((d) => d.file);

test("data: published files are well formed", () => {
  assert.ok(published.length >= 1);
  for (const d of published) {
    const f = d.file;
    assert.match(f.href, /^\/downloads\/[\w.-]+$/, d.id);
    assert.match(f.sha256, /^[0-9a-f]{64}$/, d.id);
    assert.ok(Number.isInteger(f.bytes) && f.bytes > 0, d.id);
  }
});

test("page: each published file is one direct download with size and checksum", () => {
  for (const d of published) {
    const f = d.file;
    const links = html.match(new RegExp(`<a [^>]*href="${f.href.replaceAll(".", "\\.")}"[^>]*>`, "g")) ?? [];
    assert.equal(links.length, 1, `${d.id}: one download key`);
    assert.match(links[0], / download\b/);
    assert.match(links[0], /aria-label="Download [^"]+"/);
    assert.ok(html.includes(`href="${f.href}.sha256"`), `${d.id}: sidecar link`);
    assert.ok(html.includes(formatBytes(f.bytes)), `${d.id}: size`);
    // Full hash readable without JS (groups are adjacent spans, no spaces).
    assert.ok(html.replace(/<\/?span>/g, "").includes(f.sha256), `${d.id}: full hash`);
    assert.match(html, new RegExp(`id="${d.id}"`));
  }
});

test("page: the SHA-256 is shown by the key and jumps to the full check", () => {
  for (const html_ of [html, downloadsSection()]) {
    for (const d of published) {
      const sha = d.file.sha256;
      const link = html_.match(new RegExp(`<a class="spec__link" href="#${d.id}-verify"[^>]*>`));
      assert.ok(link, `${d.id}: checksum chip`);
      assert.match(link[0], new RegExp(`aria-label="SHA-256 ${sha.slice(0, 8)}…${sha.slice(-6)}, check the file"`));
      assert.ok(html_.includes(`id="${d.id}-verify"`), `${d.id}: jump target exists`);
    }
  }
});

test("page: projects without a file say so and link nothing that looks like a binary", () => {
  for (const d of downloads.filter((x) => !x.file)) {
    const block = html.slice(html.indexOf(`id="${d.id}"`));
    const end = block.indexOf("</article>");
    const section = block.slice(0, end);
    assert.match(section, /Not yet/);
    assert.doesNotMatch(section, /\.(exe|msi|zip|dmg)"/);
    if (d.installedBy) {
      assert.ok(published.some((p) => p.id === d.installedBy), `${d.id}: installedBy is a published entry`);
      assert.ok(section.includes(`href="#${d.installedBy}"`));
    }
  }
  const exeLinks = html.match(/href="[^"]+\.exe"/g) ?? [];
  assert.equal(exeLinks.length, published.length);
});

test("home section: the same blocks one heading level down, linking the full page", () => {
  const section = downloadsSection();
  assert.match(section, /<section class="sec sec--downloads" id="downloads"/);
  assert.match(section, /href="\/downloads\/"/);
  for (const d of published) {
    const links = section.match(new RegExp(`href="${d.file.href.replaceAll(".", "\\.")}"`, "g")) ?? [];
    assert.equal(links.length, 1, `${d.id}: one download key`);
    assert.match(section, new RegExp(`<h3 class="dlf__name" id="${d.id}-name">`));
  }
  assert.match(html, /<h2 class="dlf__name"/);
});

test("download folder: sizes, sidecars and computed SHA-256 match the real files", { skip: !fs.existsSync(HOST_DOWNLOADS) && "no downloads folder here" }, async () => {
  for (const d of published) {
    const name = d.file.href.slice("/downloads/".length);
    const file = path.join(HOST_DOWNLOADS, name);
    assert.ok(fs.existsSync(file), `${name} is in the downloads folder`);
    assert.equal(fs.statSync(file).size, d.file.bytes, `${name} size`);
    const sidecar = fs.readFileSync(`${file}.sha256`, "utf8").trim().split(/\s+/)[0].toLowerCase();
    assert.equal(sidecar, d.file.sha256, `${name} sidecar hash`);
    const hash = createHash("sha256");
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    assert.equal(hash.digest("hex"), d.file.sha256, `${name} executable hash`);
  }
});

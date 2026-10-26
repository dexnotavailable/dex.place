// node --test: /downloads/ and the home page's downloads section list only
// real files, one click each, and say plainly when a project has no public
// file (CANON: never invent binaries). Since Dex 10-26 the one entry is YUKI,
// whose installer comes from GitHub Releases; until its first release the data
// says null, so the released state is checked with a sample release passed in.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { downloads, formatBytes, latestAsset, RELEASES_REPO, RETIRED, YUKI_RELEASE, yukiEntry } from "../data/downloads.ts";
import { downloadsPage, downloadsSection } from "../render/downloads.ts";

// The host's downloads folder (ops/README.md). Only checked where it exists.
const HOST_DOWNLOADS = process.env.DEX_DOWNLOADS_DIR || "D:/Dex/Servers/dex.place/downloads";

/** What a release looks like once the integrator fills data/downloads.ts YUKI_RELEASE (not a real file). */
const SAMPLE = { version: "0.2.0", file: "YUKI-Setup-0.2.0.exe", bytes: 312_456_789, sha256: "ab".repeat(32) };
const released = [yukiEntry(SAMPLE)];
const unreleased = [yukiEntry(null)];

test("data: YUKI is the one entry, its file from the releases repo's latest release, filled in one place", () => {
  assert.deepEqual(downloads.map((d) => d.id), ["yuki"]);
  assert.equal(RELEASES_REPO, "https://github.com/dexnotavailable/yuki-releases");
  assert.equal(latestAsset("YUKI-Setup-0.2.0.exe"), "https://github.com/dexnotavailable/yuki-releases/releases/latest/download/YUKI-Setup-0.2.0.exe");
  // the site's entry follows YUKI_RELEASE: no file until it is filled
  assert.equal(downloads[0].file === null, YUKI_RELEASE === null);
  if (YUKI_RELEASE) {
    assert.match(YUKI_RELEASE.version, /^\d+\.\d+\.\d+/);
    assert.match(YUKI_RELEASE.file, /^[\w.-]+\.exe$/);
    assert.match(YUKI_RELEASE.sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isInteger(YUKI_RELEASE.bytes) && YUKI_RELEASE.bytes > 0);
  }
  const f = released[0].file;
  assert.equal(f.href, latestAsset(SAMPLE.file));
  assert.equal(f.platform, "Windows");
  assert.equal(f.sidecar, undefined, "no checksum file unless the release publishes one");
  assert.equal(yukiEntry({ ...SAMPLE, sidecar: true }).file.sidecar, `${f.href}.sha256`);
  // the retired ones are not downloads
  for (const r of RETIRED) assert.ok(!downloads.some((d) => d.id === r.id), r.id);
});

test("page, released: one direct download with size, the full checksum and how to check it", () => {
  const html = downloadsPage(released);
  const f = released[0].file;
  const links = html.match(new RegExp(`<a [^>]*href="${f.href.replaceAll(".", "\\.")}"[^>]*>`, "g")) ?? [];
  assert.equal(links.length, 1, "one download key");
  assert.match(links[0], / download\b/);
  assert.match(links[0], /aria-label="Download YUKI 0\.2\.0 for Windows, [^"]+"/);
  assert.ok(html.includes(formatBytes(f.bytes)), "size");
  assert.ok(html.replace(/<\/?span>/g, "").includes(f.sha256), "full hash, readable without JS");
  assert.match(html, /id="yuki"/);
  assert.match(html, /from GitHub/);
  assert.ok(!html.includes(".sha256\""), "no sidecar link when the release has none");
  assert.ok(html.includes('href="/yuki/#install"'), "the full guide on YUKI's page");
  for (const html_ of [html, downloadsSection(released)]) {
    const sha = f.sha256;
    const link = html_.match(/<a class="spec__link" href="#yuki-verify"[^>]*>/);
    assert.ok(link, "checksum chip");
    assert.match(link[0], new RegExp(`aria-label="SHA-256 ${sha.slice(0, 8)}…${sha.slice(-6)}, check the file"`));
    assert.ok(html_.includes('id="yuki-verify"'));
  }
  assert.ok(downloadsPage([yukiEntry({ ...SAMPLE, sidecar: true })]).includes(`href="${f.href}.sha256"`), "the sidecar when there is one");
});

test("page, not released: says so plainly, links nothing that looks like a binary, sends you to meet her", () => {
  for (const html of [downloadsPage(unreleased), downloadsSection(unreleased)]) {
    const block = html.slice(html.indexOf('id="yuki"'), html.indexOf("</article>", html.indexOf('id="yuki"')));
    assert.match(block, /Not yet/);
    assert.match(block, /No public download yet\./);
    assert.match(block, /href="\/yuki\/"/);
    assert.doesNotMatch(html, /href="[^"]+\.(exe|msi|zip|dmg)"/);
    assert.doesNotMatch(html, /yuki-releases/);
  }
});

test("retired: one small line where dexCode and dexClient were, keeping their old addresses", () => {
  for (const html of [downloadsPage(unreleased), downloadsPage(released), downloadsSection(released)]) {
    const line = html.match(/<p class="retired retired--downloads">[\s\S]*?<\/p>/);
    assert.ok(line, "the retired line");
    for (const r of RETIRED) assert.ok(line[0].includes(`id="${r.id}"`), `#${r.id} still lands`);
    assert.match(line[0], /dexCode and dexClient: <a class="link" href="\/yuki\/">YUKI<\/a> replaces both\./);
    assert.equal(html.match(/class="retired /g).length, 1, "said once");
  }
});

test("home section: the same blocks one heading level down, linking the full page", () => {
  for (const list of [released, unreleased]) {
    const section = downloadsSection(list);
    assert.match(section, /<section class="sec sec--downloads" id="downloads"/);
    assert.match(section, /href="\/downloads\/"/);
    assert.match(section, /<h3 class="dlf__name" id="yuki-name">YUKI<\/h3>/);
    // the band hangs the first block off its paper (render/landing.ts HOME_BANDS stitch: the exact class)
    assert.match(section, /<article class="dlf" id="yuki"/);
  }
  assert.match(downloadsPage(released), /<h2 class="dlf__name"/);
  assert.match(downloadsSection(released), /01 file/);
  assert.match(downloadsSection(unreleased), /00 files/);
});

test("download folder: sizes, sidecars and computed SHA-256 match the real files (site-served files only)", { skip: !fs.existsSync(HOST_DOWNLOADS) && "no downloads folder here" }, async () => {
  for (const d of downloads.filter((x) => x.file && x.file.href.startsWith("/downloads/"))) {
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

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
import { downloads, formatBytes, releaseAsset, RELEASES_REPO, RETIRED, YUKI_RELEASE, yukiEntry } from "../data/downloads.ts";
import { downloadsPage, downloadsSection } from "../render/downloads.ts";

// The host's downloads folder (ops/README.md). Only checked where it exists.
const HOST_DOWNLOADS = process.env.DEX_DOWNLOADS_DIR || "D:/Dex/Servers/dex.place/downloads";

/** What a release looks like once the integrator fills data/downloads.ts YUKI_RELEASE (not a real file). */
const SAMPLE = { version: "0.2.0", file: "YUKI-Setup-0.2.0.exe", bytes: 312_456_789, sha256: "ab".repeat(32) };
const released = [yukiEntry(SAMPLE)];
const unreleased = [yukiEntry(null)];

test("data: YUKI is the one entry, its file from the release it names in the releases repo, filled in one place", () => {
  assert.deepEqual(downloads.map((d) => d.id), ["yuki"]);
  assert.equal(RELEASES_REPO, "https://github.com/dexnotavailable/yuki-releases");
  // the release's own tag (YUKI scripts/publish.ts: v<version>), so the next release never breaks the link and the file
  // is always the one whose size and SHA-256 the page lists
  assert.equal(releaseAsset(SAMPLE), "https://github.com/dexnotavailable/yuki-releases/releases/download/v0.2.0/YUKI-Setup-0.2.0.exe");
  assert.equal(releaseAsset({ ...SAMPLE, tag: "yuki-0.2.0" }), "https://github.com/dexnotavailable/yuki-releases/releases/download/yuki-0.2.0/YUKI-Setup-0.2.0.exe");
  assert.doesNotMatch(releaseAsset(SAMPLE), /\/latest\//);
  // the site's entry follows YUKI_RELEASE: no file until it is filled
  assert.equal(downloads[0].file === null, YUKI_RELEASE === null);
  if (YUKI_RELEASE) {
    assert.match(YUKI_RELEASE.version, /^\d+\.\d+\.\d+/);
    assert.match(YUKI_RELEASE.file, /^[\w.-]+\.exe$/);
    assert.match(YUKI_RELEASE.sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isInteger(YUKI_RELEASE.bytes) && YUKI_RELEASE.bytes > 0);
  }
  const f = released[0].file;
  assert.equal(f.href, releaseAsset(SAMPLE));
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
    assert.match(block, /<p class="dl-state"><span class="dl-state__dot" aria-hidden="true"><\/span>No public download yet<\/p>/);
    assert.match(block, /href="\/yuki\/"/);
    // the specs say what isn't out, never a made-up version, size or hash: a stand-in of the released shape is only the
    // room the value will take (a data-room attribute the stylesheet lays out unseen), never page text
    assert.match(block, /<dt>Version<\/dt><dd>Not out yet<\/dd>/);
    assert.match(block, /<dt>SHA-256<\/dt><dd><span class="spec__link"><code class="later" data-room="[^"]+"><span class="later__text">With the release<\/span><\/code>/);
    assert.doesNotMatch(block.replace(/ data-room="[^"]*"/g, ""), /\d+(\.\d+)? (MB|GB)|\bv?\d+\.\d+\.\d+\b|[0-9a-f]{8}/);
    assert.doesNotMatch(html, /href="[^"]+\.(exe|msi|zip|dmg)"/);
    assert.doesNotMatch(html, /yuki-releases/);
  }
});

test("not released, the section keeps its shape (Dex 10-26: a short band ran its hanging banners fast): the same parts in the same order, the guide there too, only the checksum waiting", () => {
  const parts = (html) => {
    const block = html.slice(html.indexOf('id="yuki"'), html.indexOf("</article>", html.indexOf('id="yuki"')));
    return [...block.matchAll(/class="(dl-state[^"]*|dlf__name|dlf__line|dlf__cta|btn [^"]*btn--l[^"]*|dlf__file|spec|dl-notes|dlf__guide)"/g)].map((m) => m[1].split(" ")[0]);
  };
  for (const [none, rel] of [[downloadsPage(unreleased), downloadsPage(released)], [downloadsSection(unreleased), downloadsSection(released)]]) {
    assert.deepEqual(parts(none), parts(rel), "the block's parts");
    assert.equal((none.match(/<dt>/g) ?? []).length, (rel.match(/<dt>/g) ?? []).length, "as many specs");
    assert.equal((none.match(/<li class="step"/g) ?? []).length, 4, "the four steps");
    assert.match(none, /<section class="dlg" aria-labelledby="yuki-install">/);
    // check the file: its place kept, the hash's place saying it comes with the release, the PowerShell line there
    const v = none.slice(none.indexOf('class="verify'));
    assert.match(v, /^class="verify verify--later" id="yuki-verify"/);
    assert.match(v, /<code class="hash hash--later">(<i><\/i>){8}<span class="later__text">Not out yet<\/span><\/code><span class="later__key" aria-hidden="true" inert>/);
    assert.doesNotMatch(v.slice(0, v.indexOf("</section>")).replace(/ data-room="[^"]*"/g, ""), /[0-9a-f]{8}|\d+\.\d+\.\d+/, "no stand-in hash or version in the page");
    assert.ok(v.includes("Get-FileHash .\\YUKI-Setup-*.exe -Algorithm SHA256"));
    // the line holds the room of the released one (the wildcard, a few characters shorter, wrapped a line short at 320)
    assert.ok(v.includes('<code class="cmd cmd--later" data-room="&gt; Get-FileHash .\\YUKI-Setup-0.0.0.exe -Algorithm SHA256"><span class="cmd__text">'));
    assert.equal((none.match(/class="verify__(line|row)"/g) ?? []).length, (rel.match(/class="verify__(line|row)"/g) ?? []).length, "as many lines");
  }
});

test("the steps: each browser's own words for keeping the file, and a first open that promises only what YUKI does today", () => {
  const steps = yukiEntry(SAMPLE).steps;
  const ways = steps[0].ways;
  assert.deepEqual(ways.map((w) => w.who), ["Chrome", "Edge", "Firefox"]);
  // (the tested words of content/docs/installing-dexclient.md: an unsigned setup gets the same warnings)
  assert.match(ways[0].how, /Suspicious download blocked.*Download suspicious file/);
  assert.match(ways[1].how, /Keep, Show more, Keep anyway/);
  assert.match(ways[2].how, /Allow download/);
  // the tier-picked setup and Hugging Face downloads are the W7 first run, after v0.2 (PHASE2-SCOPE "Order")
  const meet = steps[3];
  assert.equal(meet.title, "Meet Yuki");
  assert.doesNotMatch(meet.text, /picks|setup that fits|Hugging Face|licen[cs]e|download/i);
  const html = downloadsPage(released);
  const guide = html.slice(html.indexOf('<section class="dlg"'));
  assert.equal(guide.match(/<ul class="ways step__ways">/g).length, 1, "the browsers under step one");
  // the home band's four narrow cards leave them to the full guide, which its link opens
  const home = downloadsSection(released);
  assert.doesNotMatch(home, /class="ways/);
  assert.ok(home.includes('href="/yuki/#install"'));
  assert.match(guide, /<li><b class="ways__who">Chrome<\/b><span>/);
});

test("the Downloads guide's Meet Yuki step shows her face, not the site's generic mascot", () => {
  for (const html of [downloadsPage(released), downloadsSection(released)]) {
    const guide = html.slice(html.indexOf('<section class="dlg"'));
    const step = guide.split('<li class="step"').find((x) => x.includes(">Meet Yuki<"));
    assert.ok(step, "the Meet Yuki step");
    assert.match(step, /<span class="tile tile--cyan tile--m yktile" aria-hidden="true"><svg class="yk/);
    assert.equal(guide.match(/yktile/g).length, 1, "only the step that names her");
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
  // the anchors stay out of the line's flow (a flex gap opened before the tag): absolute, inside a positioned line
  const css = fs.readFileSync(new URL("../styles/yuki.css", import.meta.url), "utf8");
  assert.match(css, /\n\.retired__at \{ position: absolute; top: 0; left: 0;/);
  assert.match(css, /\n\.retired--downloads \{ position: relative;/);
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

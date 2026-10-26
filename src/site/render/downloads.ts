// Downloads: a home-page section and /downloads/. One block per project. A
// published file gets the big key (one click, straight to the file), its
// specs and checksum; a project with no public file says so plainly and
// points at whatever installs it, or at its own page. Only real files from
// data/downloads.ts (CANON: never invent binaries). Styles: styles/downloads.css
// (and styles/yuki.css for YUKI's art). No page JS: reveal, scene depth and copy
// come from the shared motion primitives.
//
// Since Dex 10-26 the one entry is YUKI (its installer comes from GitHub
// Releases); dexCode and dexClient are retired, said once in a small line where
// their entries were, which keeps their old #dexcode / #dexclient addresses.

import { downloads, formatBytes, RETIRED, type DownloadEntry, type DownloadFile } from "../data/downloads.ts";
import { projects } from "../data/projects.ts";
import { button, copyButton, hanko, icon, pageHead, sectionHead, sticker, tile } from "./glyphs.ts";
import { esc, pad2 } from "./html.ts";
import { yukiArt } from "./yukiart.ts";

type Level = 2 | 3;

export const fileName = (f: DownloadFile): string => decodeURIComponent(f.href.slice(f.href.lastIndexOf("/") + 1));
const lineOf = (id: string): string => projects.find((p) => p.id === id)?.line ?? "";
const nameOf = (id: string): string => projects.find((p) => p.id === id)?.name ?? id;
const filesCount = (list: readonly DownloadEntry[]): string => {
  const n = list.filter((d) => d.file !== null).length;
  return `${pad2(n)} ${n === 1 ? "file" : "files"}`;
};
/** Served from somewhere other than this site (YUKI: GitHub Releases). */
const external = (f: DownloadFile): boolean => /^https?:\/\//.test(f.href);

/** The code-drawn setup file: a square file block on a pixel field, in depth layers. */
function fileArt(f: DownloadFile): string {
  const ext = fileName(f).split(".").pop()?.toUpperCase() ?? "";
  return (
    `<div class="dlf__art" data-tilt-scene aria-hidden="true">` +
    `<span class="dlf-back" data-depth="1"></span>` +
    `<span class="dlf-file" data-depth="2"><span class="dlf-file__sheet">` +
    `<span class="dlf-file__ic">${icon("download", 6)}</span>` +
    `<span class="dlf-file__ext">${esc(ext)}</span>` +
    `<span class="dlf-bar">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</span>` +
    `<span class="dlf-file__fold"></span>` +
    `</span></span>` +
    `<span class="dlf-st dlf-st--a" data-depth="3">${sticker("sparkle", { scale: 3, tone: "yellow", reveal: false })}</span>` +
    `<span class="dlf-st dlf-st--c" data-depth="3">${sticker("blob", { scale: 3, tone: "yellow", reveal: false })}</span>` +
    `</div>`
  );
}

/** YUKI's block art: pixel Yuki in her night (render/yukiart.ts), the file's tag in the corner. */
function yukiFileArt(f: DownloadFile | null): string {
  const ext = f ? fileName(f).split(".").pop()?.toUpperCase() ?? "" : "";
  return (
    `<div class="dlf__art dlf__art--yuki" aria-hidden="true">` +
    // (a wide stage: a tall column on a desktop crops its sides, a phone's short strip keeps her whole)
    yukiArt({ className: "dlf__yuki", seed: "yuki-dl", cols: 96, rows: 64, eyes: f ? "open" : "sleepy", mouth: f ? "smile" : "calm" }) +
    (f ? `<span class="dlf__tag">${icon("download", 2)}<span>${esc(ext)}</span></span>` : `<span class="dlf__zz"><i>z</i><i>z</i><i>Z</i></span>`) +
    `</div>`
  );
}

function published(d: DownloadEntry, f: DownloadFile, level: Level): string {
  const name = fileName(f);
  const size = formatBytes(f.bytes);
  const h = `h${level}`;
  const short = `${f.sha256.slice(0, 8)}…${f.sha256.slice(-6)}`;
  return (
    // (class="dlf" stays exact: the home band hangs the first one off its paper, render/landing.ts HOME_BANDS stitch)
    `<article class="dlf" id="${d.id}"${d.id === "yuki" ? ' data-yuki="ready"' : ""} aria-labelledby="${d.id}-name" data-reveal="pop-block">` +
    hanko() +
    (d.id === "yuki" ? yukiFileArt(f) : fileArt(f)) +
    `<div class="dlf__body">` +
    // Phones: the big drawn file is dropped and this small tile heads the
    // block instead, so the Download key sits near the top of the section.
    `<div class="dlf__head">` +
    `<span class="dlf__badge">${tile("download", "mint", "l")}</span>` +
    `<div class="dlf__title">` +
    `<p class="dl-state dl-state--ready"><span class="dl-state__dot" aria-hidden="true"></span>Available</p>` +
    `<${h} class="dlf__name" id="${d.id}-name">${esc(d.name)}</${h}>` +
    `</div></div>` +
    `<p class="dlf__line">${esc(lineOf(d.id))}</p>` +
    `<div class="dlf__cta">` +
    button({
      href: f.href, label: "Download", icon: "download", tone: "mint", size: "l", download: true,
      className: "btn--dl", ariaLabel: `Download ${d.name} ${f.version} for ${f.platform}, ${size}`,
    }) +
    `<span class="dlf__file"><code>${esc(name)}</code><span>${size}${external(f) ? " · from GitHub" : ""}</span></span>` +
    `</div>` +
    `<dl class="spec">` +
    `<div><dt>Version</dt><dd>${esc(f.version)}</dd></div>` +
    `<div><dt>Platform</dt><dd>${esc(f.platform)}</dd></div>` +
    // The checksum in short; the chip jumps to the full hash and how to check it.
    `<div class="spec__sha"><dt>SHA-256</dt><dd><a class="spec__link" href="#${d.id}-verify" aria-label="SHA-256 ${short}, check the file">` +
    `<code>${short}</code>${icon("arrow-down", 2)}</a></dd></div>` +
    `</dl>` +
    (d.notes.length ? `<ul class="dl-notes">${d.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "") +
    (d.guide ? `<p class="dlf__guide"><a class="link" href="${esc(d.guide)}#install">The install guide, step by step</a></p>` : "") +
    `</div></article>`
  );
}

function pending(d: DownloadEntry, i: number, level: Level): string {
  const via = d.installedBy ? downloads.find((x) => x.id === d.installedBy && x.file) : undefined;
  const h = `h${level}`;
  // an entry with a page of its own (YUKI) keeps its big block, asleep until there is a file
  if (d.guide) {
    return (
      `<article class="dlf" id="${d.id}" data-yuki="none" aria-labelledby="${d.id}-name" data-reveal="pop-block">` +
      hanko() +
      yukiFileArt(null) +
      `<div class="dlf__body">` +
      `<div class="dlf__head"><div class="dlf__title">` +
      `<p class="dl-state"><span class="dl-state__dot" aria-hidden="true"></span>Not yet</p>` +
      `<${h} class="dlf__name" id="${d.id}-name">${esc(d.name)}</${h}>` +
      `</div></div>` +
      `<p class="dlf__line">${esc(lineOf(d.id))}</p>` +
      d.notes.map((n) => `<p class="dlp__note">${esc(n)}</p>`).join("") +
      `<div class="dlf__cta">${button({ href: d.guide, label: `Meet ${projects.find((p) => p.id === d.id)?.hero ?? d.name}`, icon: "arrow", size: "m" })}</div>` +
      `</div></article>`
    );
  }
  return (
    `<article class="dlp" id="${d.id}" aria-labelledby="${d.id}-name" data-reveal style="--i:${i}">` +
    `<span class="dlp__tile" aria-hidden="true">${tile("window", "paper", "l")}` +
    `${sticker("sleepy", { scale: 2, reveal: false, className: "dlp__zz" })}</span>` +
    `<div class="dlp__body">` +
    `<p class="dl-state"><span class="dl-state__dot" aria-hidden="true"></span>Not yet</p>` +
    `<${h} class="dlp__name" id="${d.id}-name">${esc(d.name)}</${h}>` +
    `<p class="dlp__line">${esc(lineOf(d.id))}</p>` +
    d.notes.map((n) => `<p class="dlp__note">${esc(n)}</p>`).join("") +
    `</div>` +
    (via
      ? `<div class="dlp__cta">${button({ href: `#${via.id}`, label: `Get ${via.name}`, icon: "up", size: "m" })}</div>`
      : "") +
    `</article>`
  );
}

/** SHA-256 in 8 groups of 8 (spans, no spaces, so selecting it copies the plain hash). */
export function hashGroups(sha: string): string {
  const groups = sha.match(/.{1,8}/g) ?? [sha];
  return groups.map((g) => `<span>${g}</span>`).join("");
}

/** "Check the file": the full hash, the PowerShell line that prints it, and the checksum file when there is one. */
export function verifyBlock(d: DownloadEntry, f: DownloadFile, level: Level): string {
  const name = fileName(f);
  const cmd = `Get-FileHash .\\${name} -Algorithm SHA256`;
  const h2 = `h${level + 1}`;
  return (
    `<div class="verify" id="${d.id}-verify" data-reveal>` +
    `<${h2} class="verify__title">${tile("qr", "paper", "s")}<span>Check the file</span></${h2}>` +
    `<p class="verify__line">The SHA-256 of <code>${esc(name)}</code> is:</p>` +
    `<div class="verify__row"><code class="hash">${hashGroups(f.sha256)}</code>${copyButton(f.sha256, "SHA-256")}</div>` +
    `<p class="verify__line">To compare, run this in PowerShell in the folder with the file. It prints the same code in capitals.</p>` +
    `<div class="verify__row"><code class="cmd"><span aria-hidden="true">&gt; </span>${esc(cmd)}</code>${copyButton(cmd, "PowerShell command")}</div>` +
    (f.sidecar ? `<p class="verify__line"><a class="link" href="${esc(f.sidecar)}">${esc(name)}.sha256</a></p>` : "") +
    `</div>`
  );
}

function guide(d: DownloadEntry, f: DownloadFile, level: Level): string {
  const steps = d.steps ?? [];
  const h = `h${level}`;
  const h2 = `h${level + 1}`;
  return (
    `<section class="dlg" aria-labelledby="${d.id}-install">` +
    `<${h} class="sub" id="${d.id}-install">${tile("check", "mint", "s")}<span>Install ${esc(d.name)}</span>` +
    `<span class="sub__aside">${pad2(steps.length)} steps</span></${h}>` +
    (steps.length
      ? `<ol class="steps">` +
        steps
          .map(
            (s, i) =>
              `<li class="step" data-reveal="pop" style="--i:${i}">` +
              `<span class="step__no" aria-hidden="true">${pad2(i + 1)}</span>` +
              tile(s.icon, i % 2 ? "yellow" : "mint", "m") +
              `<${h2} class="step__title">${esc(s.title)}</${h2}>` +
              `<p class="step__text">${esc(s.text)}</p></li>`,
          )
          .join("") +
        `</ol>`
      : "") +
    (d.caveat ? `<p class="dlg__caveat">${icon("warn", 2)}<span>${esc(d.caveat)}</span></p>` : "") +
    (d.guide ? `<p class="dlg__more"><a class="link" href="${esc(d.guide)}#install">More on installing, with pictures of the Windows prompt</a></p>` : "") +
    verifyBlock(d, f, level) +
    `</section>`
  );
}

/**
 * The retired projects, one small line where their entries were (Dex 10-26): on Downloads it keeps their old addresses
 * (/downloads/#dexcode, #dexclient: the docs and old links point there), on Projects it is plain text.
 */
export function retiredNote(where: "downloads" | "projects"): string {
  if (!RETIRED.length) return "";
  const names = RETIRED.map((r) => r.name);
  const by = nameOf(RETIRED[0]!.replacedBy);
  const href = projects.find((p) => p.id === RETIRED[0]!.replacedBy)?.page ?? "/projects/";
  const anchors = where === "downloads" ? RETIRED.map((r) => `<span class="retired__at" id="${r.id}"></span>`).join("") : "";
  return (
    `<p class="retired retired--${where}">${anchors}` +
    `<span class="retired__tag">Retired</span>` +
    `<span>${esc(names.join(" and "))}: <a class="link" href="${esc(href)}">${esc(by)}</a> replaces ${names.length > 1 ? "both" : "it"}.</span></p>`
  );
}

/** Every download block, then the install guide; item headings at `level`. `list`: the site's own unless a test
 *  passes another (a release that isn't out yet). */
export function downloadsBody(level: Level, list: readonly DownloadEntry[] = downloads): string {
  const files = list.filter((d) => d.file !== null);
  const blocks = list.map((d, i) => (d.file ? published(d, d.file, level) : pending(d, i, level))).join("");
  return (
    `<div class="dl-list">${blocks}${retiredNote("downloads")}</div>` +
    files.filter((d) => d.steps).map((d) => guide(d, d.file as DownloadFile, level)).join("")
  );
}

export function downloadsSection(list: readonly DownloadEntry[] = downloads): string {
  return (
    `<section class="sec sec--downloads" id="downloads" aria-labelledby="downloads-title">` +
    `<div class="wrap">` +
    sectionHead({ id: "downloads-title", kicker: "downloads", title: "Downloads", tone: "mint", icon: "download", aside: filesCount(list), more: { href: "/downloads/", label: "Downloads page" } }) +
    downloadsBody(3, list) +
    `</div></section>`
  );
}

export function downloadsPage(list: readonly DownloadEntry[] = downloads): string {
  return (
    `<div class="page page--downloads">` +
    `<div class="wrap">` +
    pageHead({ kicker: "downloads", title: "Downloads", tone: "mint", icon: "download", aside: filesCount(list) }) +
    downloadsBody(2, list) +
    `</div></div>`
  );
}

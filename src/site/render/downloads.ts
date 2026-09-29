// /downloads/: one block per project. A published file gets the big key
// (one click, straight to the file), its specs and checksum; a project with
// no public file says so plainly and points at whatever installs it. Only
// real files from data/downloads.ts (CANON: never invent binaries).
// Styles: styles/downloads.css. No page JS: reveal, magnet, scene tilt and
// copy come from the shared motion primitives (DESIGN-SYSTEM.md §3).

import { downloads, formatBytes, type DownloadEntry, type DownloadFile } from "../data/downloads.ts";
import { projects } from "../data/projects.ts";
import { floats } from "./floats.ts";
import { button, copyButton, icon, pageHead, sectionHead, sticker, tile } from "./glyphs.ts";
import { esc, pad2 } from "./html.ts";

const fileName = (f: DownloadFile): string => f.href.slice(f.href.lastIndexOf("/") + 1);
const lineOf = (id: string): string => projects.find((p) => p.id === id)?.line ?? "";

/** The code-drawn setup file: a folded-corner file block, a pixel bar and stickers, in layers. */
function fileArt(f: DownloadFile): string {
  const ext = fileName(f).split(".").pop()?.toUpperCase() ?? "";
  return (
    `<div class="dlf__art" data-tilt-scene aria-hidden="true">` +
    `<span class="dlf-disc" data-depth="1"></span>` +
    `<span class="dlf-file" data-depth="2"><span class="dlf-file__sheet">` +
    `<span class="dlf-file__ic">${icon("download", 7)}</span>` +
    `<span class="dlf-file__ext">${esc(ext)}</span>` +
    `<span class="dlf-bar">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</span>` +
    `<span class="dlf-file__fold"></span>` +
    `</span></span>` +
    `<span class="dlf-st dlf-st--a" data-depth="3">${sticker("sparkle", { scale: 4, tilt: 12, tone: "yellow", reveal: false })}</span>` +
    `<span class="dlf-st dlf-st--b" data-depth="3">${sticker("star", { scale: 3, tilt: -10, tone: "magenta", reveal: false })}</span>` +
    `<span class="dlf-st dlf-st--c" data-depth="2">${sticker("blob", { scale: 4, tilt: -6, reveal: false })}</span>` +
    `</div>`
  );
}

function published(d: DownloadEntry, f: DownloadFile): string {
  const name = fileName(f);
  const size = formatBytes(f.bytes);
  return (
    `<section class="dlf" id="${d.id}" aria-labelledby="${d.id}-name" data-reveal="pop-block">` +
    fileArt(f) +
    `<div class="dlf__body">` +
    `<p class="dl-state dl-state--ready"><span class="dl-state__dot" aria-hidden="true"></span>Available</p>` +
    `<h2 class="dlf__name" id="${d.id}-name">${esc(d.name)}</h2>` +
    `<p class="dlf__line">${esc(lineOf(d.id))}</p>` +
    `<div class="dlf__cta">` +
    button({
      href: f.href, label: "Download", icon: "download", tone: "mint", size: "l", download: true, magnet: true,
      className: "btn--dl", ariaLabel: `Download ${d.name} ${f.version} for ${f.platform}, ${size}`,
    }) +
    `<span class="dlf__file"><code>${esc(name)}</code><span>${size}</span></span>` +
    `</div>` +
    `<dl class="spec">` +
    `<div><dt>Version</dt><dd>${esc(f.version)}</dd></div>` +
    `<div><dt>Size</dt><dd>${size}</dd></div>` +
    `<div><dt>Platform</dt><dd>${esc(f.platform)}</dd></div>` +
    `</dl>` +
    (d.notes.length ? `<ul class="dl-notes">${d.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "") +
    `</div></section>`
  );
}

function pending(d: DownloadEntry, i: number): string {
  const via = d.installedBy ? downloads.find((x) => x.id === d.installedBy && x.file) : undefined;
  return (
    `<section class="dlp" id="${d.id}" aria-labelledby="${d.id}-name" data-reveal style="--i:${i}">` +
    `<span class="dlp__tile" aria-hidden="true">${tile("window", "paper", "l")}` +
    `${sticker("sleepy", { scale: 3, tilt: 8, reveal: false, className: "dlp__zz" })}</span>` +
    `<div class="dlp__body">` +
    `<p class="dl-state"><span class="dl-state__dot" aria-hidden="true"></span>Not yet</p>` +
    `<h2 class="dlp__name" id="${d.id}-name">${esc(d.name)}</h2>` +
    `<p class="dlp__line">${esc(lineOf(d.id))}</p>` +
    d.notes.map((n) => `<p class="dlp__note">${esc(n)}</p>`).join("") +
    `</div>` +
    (via
      ? `<div class="dlp__cta">${button({ href: `#${via.id}`, label: `Get ${via.name}`, icon: "up", size: "m" })}</div>`
      : "") +
    `</section>`
  );
}

/** SHA-256 in 8 groups of 8 (spans, no spaces, so selecting it copies the plain hash). */
function hashGroups(sha: string): string {
  const groups = sha.match(/.{1,8}/g) ?? [sha];
  return groups.map((g) => `<span>${g}</span>`).join("");
}

function guide(d: DownloadEntry, f: DownloadFile): string {
  const steps = d.steps ?? [];
  const name = fileName(f);
  const cmd = `Get-FileHash .\\${name}`;
  return (
    `<section class="dlg" aria-labelledby="${d.id}-install">` +
    sectionHead({ id: `${d.id}-install`, kicker: d.name, title: "Install", tone: "mint", variant: "line", aside: `${pad2(steps.length)} steps` }) +
    (steps.length
      ? `<ol class="steps">` +
        steps
          .map(
            (s, i) =>
              `<li class="step" data-reveal="pop" style="--i:${i}">` +
              `<span class="step__no" aria-hidden="true">${pad2(i + 1)}</span>` +
              tile(s.icon, i % 2 ? "yellow" : "mint", "m") +
              `<h3 class="step__title">${esc(s.title)}</h3>` +
              `<p class="step__text">${esc(s.text)}</p></li>`,
          )
          .join("") +
        `</ol>`
      : "") +
    (d.caveat ? `<p class="dlg__caveat">${icon("sleepy", 2)}<span>${esc(d.caveat)}</span></p>` : "") +
    `<div class="verify" id="${d.id}-verify" data-reveal>` +
    `<h3 class="verify__title">${tile("check", "mint", "s")}<span>Check the file</span></h3>` +
    `<p class="verify__line">The SHA-256 of <code>${esc(name)}</code> is:</p>` +
    `<div class="verify__row"><code class="hash">${hashGroups(f.sha256)}</code>${copyButton(f.sha256, "SHA-256")}</div>` +
    `<p class="verify__line">To compare, run this in PowerShell in the folder with the file. It prints the same code in capitals.</p>` +
    `<div class="verify__row"><code class="cmd"><span aria-hidden="true">&gt; </span>${esc(cmd)}</code>${copyButton(cmd, "PowerShell command")}</div>` +
    `<p class="verify__line"><a class="link" href="${esc(f.href)}.sha256">${esc(name)}.sha256</a></p>` +
    `</div>` +
    `</section>`
  );
}

export function downloadsPage(): string {
  const files = downloads.filter((d) => d.file !== null);
  const blocks = downloads.map((d, i) => (d.file ? published(d, d.file) : pending(d, i))).join("");
  return (
    `<div class="page page--downloads">` +
    floats("downloads", { tone: "mint", stickers: ["download", "star", "sparkle"] }) +
    `<div class="wrap">` +
    pageHead({ kicker: "downloads", title: "Downloads", tone: "mint", aside: `${pad2(files.length)} ${files.length === 1 ? "file" : "files"}`, stickers: ["download", "sparkle"] }) +
    `<div class="dl-list">${blocks}</div>` +
    files.filter((d) => d.steps).map((d) => guide(d, d.file as DownloadFile)).join("") +
    `</div></div>`
  );
}

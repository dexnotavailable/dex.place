// The home page (/), the projects index (/projects/) and one page per project
// (/projects/<id>/). Styles: styles/landing.css.
//
// The home page is one continuous scroll (Dex, 2026-09-29): the world on top,
// then every section in order, each fully usable in place: projects ->
// downloads -> gallery -> docs & blog -> donate. The nav jumps between them
// (motion/nav.ts); each section also has its own full page for deep links.
// Every page is complete without JavaScript; motion only adds reveal and pops.

import { downloads, formatBytes, type DownloadFile } from "../data/downloads.ts";
import { projectHref, projects, type Project } from "../data/projects.ts";
import { artTag, projectArt } from "./art.ts";
import { docsSection } from "./docs.ts";
import { donateSection } from "./donate.ts";
import { downloadsSection } from "./downloads.ts";
import { floats } from "./floats.ts";
import { gallerySection } from "./gallery.ts";
import { button, chip, counter, pageHead, sectionHead, strip, tile, type ButtonOptions } from "./glyphs.ts";
import { cx, esc, pad2 } from "./html.ts";
import type { SiteContent } from "./types.ts";

// ------------------------------------------------------------------- facts

/** The published file for a project, if there is one (data/downloads.ts). */
const fileOf = (p: Project): DownloadFile | null => downloads.find((d) => d.id === p.id)?.file ?? null;
const hasDownloadEntry = (p: Project): boolean => downloads.some((d) => d.id === p.id);

/** Short state chips: platform, then version and size, or "no download". */
function chipsOf(p: Project): string {
  const f = fileOf(p);
  const state = f
    ? [chip(`v${f.version}`, "value"), chip(formatBytes(f.bytes), "value")]
    : hasDownloadEntry(p) ? [chip("No public download yet", "value")] : [];
  return `<p class="chips">${[chip(p.platform, "key"), ...state].join("")}</p>`;
}

/** The one action that matters most for each project. */
function primaryAction(p: Project, size: "m" | "l", here: "home" | "page"): ButtonOptions {
  const f = fileOf(p);
  if (f) {
    return {
      href: f.href, label: "Download", icon: "download", tone: p.tone, size, download: true,
      ariaLabel: `Download ${p.name} ${f.version} for ${f.platform}, ${formatBytes(f.bytes)}`,
    };
  }
  const via = downloads.find((d) => d.id === p.id)?.installedBy;
  if (via) {
    // No standalone file: point at the download that installs it.
    const name = downloads.find((d) => d.id === via)?.name ?? via;
    return { href: here === "home" ? `#${via}` : `/downloads/#${via}`, label: `Get ${name}`, icon: "arrow", size };
  }
  if (hasDownloadEntry(p)) {
    return { href: here === "home" ? `#${p.id}` : `/downloads/#${p.id}`, label: "Download status", icon: "arrow", size };
  }
  // dex.place itself: the way up into the world.
  return { href: here === "home" ? "#world" : "/#world", label: "World", icon: "up", iconFirst: true, tone: "ink", size };
}

// -------------------------------------------------------------------- cards
// One card per project: the scene, the facts, and three ways on (the one
// action that matters, the project page, its docs). The card pops as a whole
// (DESIGN-SYSTEM.md §3); its keys pop on their own.

function card(p: Project, i: number, level: 2 | 3, here: "home" | "page"): string {
  const h = `h${level}`;
  const href = projectHref(p);
  return (
    `<li class="pcards__it" data-reveal style="--i:${Math.min(i, 5)}">` +
    `<article class="${cx("pcard", `pcard--${p.tone}`)}" id="p-${p.id}" aria-labelledby="p-${p.id}-name">` +
    // The art is a pointer shortcut to the project page; keyboard and screen
    // readers get the same link once, on the name.
    `<div class="pcard__art"><a class="pcard__hit" href="${href}" tabindex="-1" aria-hidden="true">${projectArt(p)}</a>${artTag(p)}</div>` +
    `<div class="pcard__body">` +
    `<p class="pcard__top"><span class="pcard__no" aria-hidden="true">${pad2(projects.indexOf(p) + 1)}</span><span class="pcard__rule" aria-hidden="true"></span></p>` +
    `<${h} class="pcard__name" id="p-${p.id}-name"><a class="pcard__link" href="${href}">${esc(p.name)}</a></${h}>` +
    `<p class="pcard__line">${esc(p.line)}</p>` +
    chipsOf(p) +
    `</div>` +
    `<div class="pcard__acts">` +
    button({ ...primaryAction(p, "m", here), className: "pcard__main" }) +
    button({ href, label: "Details", icon: "arrow", size: "s", ariaLabel: `${p.name} details` }) +
    button({ href: p.docs.href, label: "Docs", icon: "book", size: "s", ariaLabel: `${p.name} docs` }) +
    `</div></article></li>`
  );
}

const cards = (list: readonly Project[], level: 2 | 3, here: "home" | "page", className?: string): string =>
  `<ul class="${cx("pcards", className)}">${list.map((p, i) => card(p, i, level, here)).join("")}</ul>`;

// ------------------------------------------------------------------ home

/** The first section: the mark (the page's h1), the head, one card per project. */
function projectsSection(): string {
  return (
    `<section class="sec sec--projects" id="projects" aria-labelledby="projects-title">` +
    floats("home-projects", { tone: "yellow", count: 3, glyph: "sparkle" }) +
    `<div class="wrap">` +
    `<div class="intro">` +
    `<div class="intro__mark" data-reveal="pop-block"><h1 class="mark">dex</h1></div>` +
    `<div class="intro__side">` +
    sectionHead({ id: "projects-title", kicker: "projects", title: "Projects", tone: "yellow", icon: "grid", aside: `${pad2(projects.length)} items`, more: { href: "/projects/", label: "Projects page" } }) +
    `</div></div>` +
    cards(projects, 3, "home") +
    `</div></section>`
  );
}

export function landing(content: SiteContent): string {
  return projectsSection() + downloadsSection() + gallerySection(content) + docsSection(content) + donateSection();
}

// ----------------------------------------------------------- /projects/

export function projectsIndex(): string {
  return (
    `<div class="page page--projects">` +
    floats("projects", { tone: "yellow", count: 3, glyph: "sparkle" }) +
    `<div class="wrap">` +
    pageHead({ kicker: "projects", title: "Projects", tone: "yellow", icon: "grid", aside: `${pad2(projects.length)} items` }) +
    cards(projects, 2, "page") +
    `</div></div>`
  );
}

// ------------------------------------------------------ /projects/<id>/

function getIt(p: Project): string {
  const entry = downloads.find((d) => d.id === p.id);
  if (!entry) return "";
  const f = entry.file;
  const notes = entry.notes.map((n) => `<li>${esc(n)}</li>`).join("");
  const body = f
    ? `<dl class="pspec">` +
      `<div><dt>Version</dt><dd>${esc(f.version)}</dd></div>` +
      `<div><dt>Size</dt><dd>${formatBytes(f.bytes)}</dd></div>` +
      `<div><dt>Platform</dt><dd>${esc(f.platform)}</dd></div></dl>` +
      `<ul class="get__notes">${notes}</ul>` +
      `<div class="get__actions">${button(primaryAction(p, "l", "page"))}` +
      `<a class="link" href="/downloads/#${p.id}">SHA-256 and all downloads</a></div>`
    : `<ul class="get__notes">${notes}</ul>` +
      `<div class="get__actions">${button({ href: `/downloads/#${p.id}`, label: "Downloads", icon: "arrow", size: "m" })}</div>`;
  return (
    `<section class="${cx("get", f ? "get--file" : "get--none")}" aria-labelledby="get-title" data-reveal>` +
    `<h2 class="proj__h2" id="get-title">${tile(f ? "download" : "window", f ? p.tone : "paper", "s")}<span>Download</span></h2>` +
    body +
    `</section>`
  );
}

function others(p: Project): string {
  return (
    `<nav class="others" aria-labelledby="others-title">` +
    `<h2 class="proj__h2" id="others-title">${tile("grid", "paper", "s")}<span>Other projects</span></h2>` +
    cards(projects.filter((o) => o.id !== p.id), 3, "page", "pcards--two") +
    `</nav>`
  );
}

export function projectPage(p: Project): string {
  const at = projects.indexOf(p);
  return (
    `<div class="page page--project">` +
    floats(`project-${p.id}`, { tone: p.tone, count: 3, glyph: "star" }) +
    `<div class="wrap">` +
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/projects/">Projects</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav>` +
    `<header class="proj proj--${p.tone}">` +
    `<div class="proj__art" data-reveal="pop-block">${projectArt(p, "hero")}${artTag(p)}</div>` +
    `<div class="proj__head">` +
    `<p class="sh__kicker" data-reveal><span class="sh__slash" aria-hidden="true">//</span><span>project</span>` +
    `<span class="sh__rule" aria-hidden="true"></span>${counter(at + 1, projects.length, "sh__aside")}</p>` +
    `<h1 class="proj__title" data-reveal="pop-block">${esc(p.name)}</h1>` +
    `<p class="proj__line" data-reveal style="--i:1">${esc(p.line)}</p>` +
    `<div data-reveal style="--i:2">${chipsOf(p)}</div>` +
    `<div class="proj__actions" data-reveal style="--i:3">${button(primaryAction(p, "m", "page"))}` +
    `${button({ href: p.docs.href, label: p.docs.label, icon: "book", size: "m" })}</div>` +
    `</div></header>` +
    `<div class="proj__grid">` +
    `<section class="facts-wrap" aria-labelledby="facts-title">` +
    `<h2 class="proj__h2" id="facts-title">${tile("star", p.tone, "s")}<span>What it does</span></h2>` +
    `<ul class="facts">${p.facts.map((f, i) =>
      `<li class="fact" data-reveal style="--i:${i}">${tile(f.icon, i === 0 ? p.tone : "paper", "m")}<p>${esc(f.text)}</p></li>`,
    ).join("")}</ul>` +
    strip("facts__strip") +
    `</section>` +
    getIt(p) +
    `</div>` +
    others(p) +
    `</div></div>`
  );
}

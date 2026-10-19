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
import { cardArt } from "./cardart.ts";
import { docsSection } from "./docs.ts";
import { donateSection } from "./donate.ts";
import { downloadsSection } from "./downloads.ts";
import { gallerySection } from "./gallery.ts";
import { moreSection } from "./stubs.ts";
import { button, chip, counter, icon, pageHead, sectionHead, tile, type ButtonOptions } from "./glyphs.ts";
import { cx, esc, pad2 } from "./html.ts";
import type { SiteContent } from "./types.ts";

// ------------------------------------------------------------------- facts

/** The published file for a project, if there is one (data/downloads.ts). */
const fileOf = (p: Project): DownloadFile | null => downloads.find((d) => d.id === p.id)?.file ?? null;
const hasDownloadEntry = (p: Project): boolean => downloads.some((d) => d.id === p.id);

/** The download's state as chips: version and size, or "no download". */
function stateChips(p: Project): string[] {
  const f = fileOf(p);
  return f
    ? [chip(`v${f.version}`, "value"), chip(formatBytes(f.bytes), "value")]
    : hasDownloadEntry(p) ? [chip("No public download yet", "value")] : [];
}

/** Short state chips: platform, then version and size, or "no download". */
function chipsOf(p: Project): string {
  return `<p class="chips">${[chip(p.platform, "key"), ...stateChips(p)].join("")}</p>`;
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
// One card per project: its splash art over the whole card (render/cardart.ts: layers that pan, a shine), the
// platform and the download's state at the top, and at its foot on a calm band the name (the way to the project's page),
// the line, the one action that matters and its docs. The card pops as a whole
// (DESIGN-SYSTEM.md §3); its keys pop on their own.

function card(p: Project, i: number, level: 2 | 3, here: "home" | "page"): string {
  const h = `h${level}`;
  const href = projectHref(p);
  // (the name and the art already lead to the project's page)
  const small = (label: string, ic: "book", to: string): string =>
    `<a class="btn btn--paper btn--s btn--icon" href="${esc(to)}" aria-label="${esc(`${p.name} ${label.toLowerCase()}`)}" title="${label}"><span class="btn__ic">${icon(ic, 2)}</span></a>`;
  return (
    `<li class="pcards__it" data-reveal style="--i:${Math.min(i, 5)}">` +
    `<article class="${cx("pcard", `pcard--${p.tone}`)}" id="p-${p.id}" aria-labelledby="p-${p.id}-name">` +
    // The art is a pointer shortcut to the project page; keyboard and screen
    // readers get the same link once, on the name.
    `<a class="pcard__hit" href="${href}" tabindex="-1" aria-hidden="true">${cardArt(p)}</a>` +
    `<div class="pcard__top"><span class="pcard__no" aria-hidden="true">${pad2(projects.indexOf(p) + 1)}</span>` +
    `<p class="pcard__tags">${[chip(p.platform, "key"), ...stateChips(p)].join("")}</p></div>` +
    `<div class="pcard__info">` +
    `<${h} class="pcard__name" id="p-${p.id}-name"><a class="pcard__link" href="${href}">${esc(p.name)}</a></${h}>` +
    `<p class="pcard__line">${esc(p.line)}</p>` +
    `<div class="pcard__acts">` +
    button({ ...primaryAction(p, "m", here), className: "pcard__main" }) +
    small("Docs", "book", p.docs.href) +
    `</div></div></article></li>`
  );
}

const cards = (list: readonly Project[], level: 2 | 3, here: "home" | "page", className?: string): string =>
  `<ul class="${cx("pcards", className)}">${list.map((p, i) => card(p, i, level, here)).join("")}</ul>`;

// ------------------------------------------------------------------ home

/** The first section of the website: the head, one card per project. (The page's h1, "dex", is on the game screen.) */
function projectsSection(): string {
  return (
    `<section class="sec sec--projects" id="projects" aria-labelledby="projects-title">` +
    `<div class="wrap">` +
    sectionHead({ id: "projects-title", kicker: "projects", title: "Projects", tone: "yellow", icon: "grid", aside: `${pad2(projects.length)} items`, more: { href: "/projects/", label: "Projects page" } }) +
    cards(projects, 3, "home") +
    `</div></section>`
  );
}

/**
 * A section on the white with a window into the world (Dex 10-18: "patches of the world punched into a white page";
 * 10-19: the windows felt tiny, the world dominates): "l" the content left of a tall window that fills the rest of the
 * screen's width, "r" mirrored, "w" a wide window spanning the page above the section. Each onto a different place
 * (styles/v2.css `.band`, motion/windows.ts).
 */
export type BandKind = "l" | "r" | "w";
export const band = (kind: BandKind, html: string, scene = "sky"): string =>
  `<div class="band band--${kind}">${html}<div class="band__win" data-window="${scene}" aria-hidden="true"></div></div>`;

/** Which place of the world each section's window looks onto (motion/windows.ts SCENES). */
export const SECTION_SCENES = ["sky", "palace", "isles", "lake", "pine", "door"] as const;

/**
 * How the home page's sections meet the world, in order: a tall window beside the content, then a wide one across
 * the page, the tall ones alternating sides (projects | downloads across | gallery | docs across | donate | more
 * across: "opens later" under the hall's door).
 */
export const SECTION_BANDS: readonly BandKind[] = ["l", "w", "r", "w", "l", "w"];

export function landing(content: SiteContent): string {
  const parts = [projectsSection(), downloadsSection(), gallerySection(content), docsSection(content), donateSection(), moreSection()];
  return parts.map((html, i) => band(SECTION_BANDS[i % SECTION_BANDS.length]!, html, SECTION_SCENES[i % SECTION_SCENES.length])).join("");
}

// ----------------------------------------------------------- /projects/

export function projectsIndex(): string {
  return (
    `<div class="page page--projects">` +
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
    `<div class="wrap">` +
    `<header class="proj proj--${p.tone}">` +
    `<div class="proj__art" data-reveal="pop-block">${cardArt(p)}</div>` +
    `<div class="proj__head">` +
    // the deep pages' kicker (render/deep.ts): the way back as breadcrumbs, the project's place among the three
    `<div class="dh__kicker">${tile("grid", p.tone, "s")}<span class="dh__slash" aria-hidden="true">//</span>` +
    `<nav class="dh__crumbs" aria-label="Breadcrumb"><a href="/projects/">Projects</a></nav>` +
    `<span class="dh__rule" aria-hidden="true"></span>${counter(at + 1, projects.length, "dh__aside")}</div>` +
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
    `</section>` +
    getIt(p) +
    `</div>` +
    others(p) +
    `</div></div>`
  );
}

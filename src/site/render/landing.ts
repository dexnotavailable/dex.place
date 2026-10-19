// The home page (/), the projects index (/projects/) and one page per project
// (/projects/<id>/). Styles: styles/landing.css.
//
// The home page is one continuous scroll (Dex, 2026-09-29): the world on top,
// then every section in order, each fully usable in place: projects ->
// downloads -> gallery -> docs & blog -> donate. The nav jumps between them
// (motion/nav.ts); each section also has its own full page for deep links.
// Every page is complete without JavaScript; motion only adds reveal and pops.

import { downloads, formatBytes } from "../data/downloads.ts";
import { projects, type Project } from "../data/projects.ts";
import { cardArt } from "./cardart.ts";
import { docsSection } from "./docs.ts";
import { donateSection } from "./donate.ts";
import { downloadsSection } from "./downloads.ts";
import { gallerySection } from "./gallery.ts";
import { moreSection } from "./stubs.ts";
import { button, counter, pageHead, sectionHead, tile } from "./glyphs.ts";
import { chipsOf, primaryAction, projectCards } from "./pcard.ts";
import { cx, esc, pad2 } from "./html.ts";
import type { SiteContent } from "./types.ts";

// ------------------------------------------------------------------ home

/** The first section of the website: the head, one card per project. (The page's h1, "dex", is on the game screen.) */
function projectsSection(): string {
  return (
    `<section class="sec sec--projects" id="projects" aria-labelledby="projects-title">` +
    `<div class="wrap">` +
    sectionHead({ id: "projects-title", kicker: "projects", title: "Projects", tone: "yellow", icon: "grid", aside: `${pad2(projects.length)} items`, more: { href: "/projects/", label: "Projects page" } }) +
    projectCards(projects, { level: 3, here: "home" }) +
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
    projectCards(projects, { level: 2, here: "page" }) +
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
    projectCards(projects.filter((o) => o.id !== p.id), { level: 3, here: "page", className: "pcards--two" }) +
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

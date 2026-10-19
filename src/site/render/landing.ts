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
 * A section's own page: its window into the world beside it (the band system from before the redesign, kept for the
 * deep pages until lane P moves them onto the new paper; styles/v2.css .pband, motion/windows.ts).
 */
export const pageBand = (html: string, scene = "sky"): string =>
  `<div class="pband pband--l">${html}<div class="pband__win" data-window="${scene}" aria-hidden="true"></div></div>`;

// ---------------------------------------------- the home page's bands (the redesign)
// Dex 10-19 (lanes/roadmap/SITE-SCROLL.md, last section; built to lanes/motion/DESIGN-1019.md 2.2 / 2.3, "Paper over
// Tesu"): the world is painted edge to edge behind the website, one place per section, fixed to the screen; each
// section is white paper over it: a full-width strip with its title, then a panel docked to one side (L R L R L) with
// the place on the other side and a stretch of world only (the breath) after it. One thing per section hangs off the
// paper onto the world (the stitch), and a piece of the world laps back over the paper's open corner (the fore).
// Styles: styles/bands.css. The scenes: motion/windows.ts (data-watch="band"). The motion: motion/stage.ts (G2).

export type Side = "l" | "r";
export interface HomeBand {
  id: string;
  /** The side the paper docks to (the world shows on the other). */
  side: Side;
  /** The place behind it (motion/windows.ts SCENES). */
  scene: string;
  /** The paper's spine (a token in styles/tokens.css). */
  tone: string;
  /** The opening tag of the thing that hangs off the paper (the first one), or none (projects: its cards do). */
  stitch?: string;
}

/** The sections, in order, and how each meets the world. */
export const HOME_BANDS: readonly HomeBand[] = [
  { id: "projects", side: "l", scene: "sky", tone: "gold" },
  { id: "downloads", side: "r", scene: "palace", tone: "mint", stitch: '<article class="dlf"' },
  { id: "gallery", side: "l", scene: "isles", tone: "cyan", stitch: '<div class="collage-box"' },
  { id: "docs", side: "r", scene: "lake", tone: "azure", stitch: '<section class="dgroup ' },
  { id: "donate", side: "l", scene: "pine", tone: "magenta", stitch: '<div class="qr"' },
];

/** A section as its renderer gives it, split: its classes, id, label, head (for the strip) and body (for the panel). */
export function splitSection(html: string): { cls: string; id: string; label: string; head: string; body: string } {
  const m = /^<section class="([^"]+)" id="([^"]+)" aria-labelledby="([^"]+)"><div class="wrap">(<header class="sh[\s\S]*?<\/header>)([\s\S]*)<\/div><\/section>$/.exec(html);
  if (!m) throw new Error(`splitSection: not a section (${html.slice(0, 60)})`);
  return { cls: m[1]!, id: m[2]!, label: m[3]!, head: m[4]!, body: m[5]! };
}

/** The section's head as the strip carries it: its place in the page ("01/05_") before the kicker. */
function stripHead(head: string, i: number, n: number): string {
  return head
    .replace(/^<header class="sh /, '<header class="sh sh--strip ')
    .replace(
      /<p class="sh__kicker"([^>]*)>/,
      `<p class="sh__kicker"$1><span class="sh__index" aria-hidden="true">${pad2(i + 1)}/${pad2(n)}<i class="sh__caret">_</i></span>`,
    );
}

/** The head's "page" key, again at the panel's top (phones show it there; the strip keeps the aside). */
function panelMore(head: string): string {
  const m = /<a [^>]*class="[^"]*\bsh__more\b[^"]*"[^>]*>[\s\S]*?<\/a>/.exec(head);
  return m ? `<p class="band__more">${m[0].replace(/\bsh__more\b/, "band__more-key")}</p>` : "";
}

/** One section as a band: the world behind (fixed), the strip and the panel (the paper), the fore in front. */
export function homeBand(b: HomeBand, i: number, n: number, section: string): string {
  const s = splitSection(section);
  const body = b.stitch ? s.body.replace(b.stitch, `${b.stitch} data-stitch`) : s.body;
  const open: Side = b.side === "l" ? "r" : "l";
  return (
    `<section class="band band--${b.side} band--${b.id} ${s.cls}" id="${s.id}" aria-labelledby="${s.label}" data-scene="${b.scene}" style="--band-i:${i};--tone:var(--${b.tone})">` +
    `<div class="band__world" aria-hidden="true"><div class="band__scene" data-window="${b.scene}" data-side="${open}" data-edge="none" data-watch="band"></div></div>` +
    `<div class="band__site">` +
    `<div class="band__strip"><i class="band__strip-paper"></i><i class="band__strip-shade"></i><div class="band__in">${stripHead(s.head, i, n)}</div></div>` +
    `<div class="band__panel"><i class="band__paper"><b class="band__spine"></b></i><i class="band__shade"></i>` +
    `<div class="wrap">${panelMore(s.head)}${body}</div></div>` +
    `</div>` +
    `<div class="band__fore" data-window="${b.scene}" data-fore data-watch="band" aria-hidden="true"></div>` +
    `</section>`
  );
}

export function landing(content: SiteContent): string {
  const sections = [projectsSection(), downloadsSection(), gallerySection(content), docsSection(content), donateSection()];
  return sections.map((html, i) => homeBand(HOME_BANDS[i]!, i, sections.length, html)).join("");
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

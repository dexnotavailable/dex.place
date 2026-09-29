// The landing (/), the projects index (/projects/) and one page per project
// (/projects/<id>/). Styles: styles/landing.css. Every page is complete
// without JavaScript; motion only adds reveal, parallax and pops.

import { downloads, formatBytes, type DownloadFile } from "../data/downloads.ts";
import { NAV } from "../data/nav.ts";
import { projectHref, projects, type Project } from "../data/projects.ts";
import { artTag, projectArt } from "./art.ts";
import { floats } from "./floats.ts";
import { button, chip, counter, icon, pageHead, sectionHead, sticker, strip, tile, type ButtonOptions } from "./glyphs.ts";
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
      href: f.href, label: "Download", icon: "download", tone: p.tone, size, download: true, magnet: true,
      ariaLabel: `Download ${p.name} ${f.version} for ${f.platform}, ${formatBytes(f.bytes)}`,
    };
  }
  if (hasDownloadEntry(p)) {
    // No standalone file: say where it comes from instead of inventing one.
    return { href: `/downloads/#${p.id}`, label: "Download status", icon: "arrow", tone: "paper", size };
  }
  // dex.place itself: the way up into the world.
  return { href: here === "home" ? "#world" : "/#world", label: "World", icon: "up", iconFirst: true, tone: "ink", size };
}

// ----------------------------------------------------------------- showcase

function show(p: Project, i: number, level: 2 | 3, here: "home" | "page"): string {
  const h = `h${level}`;
  const secondary = button({ href: projectHref(p), label: "Details", icon: "arrow", size: "m", className: "show__more" });
  return (
    `<article class="${cx("pcard", "show", `show--${p.tone}`, i % 2 ? "show--flip" : "")}" id="p-${p.id}" aria-labelledby="p-${p.id}-name" data-reveal>` +
    // The art is a pointer shortcut to the project page; keyboard and screen
    // readers get the same link once, on the name.
    `<div class="show__art"><a class="show__hit" href="${projectHref(p)}" tabindex="-1" aria-hidden="true">${projectArt(p)}</a>${artTag(p)}</div>` +
    `<div class="show__body">` +
    `<p class="show__no" aria-hidden="true"><span>${pad2(i + 1)}</span><span class="show__rule"></span>${icon("sparkle", 2)}</p>` +
    `<${h} class="show__name" id="p-${p.id}-name"><a class="show__link" href="${projectHref(p)}">${esc(p.name)}</a></${h}>` +
    `<p class="show__line">${esc(p.line)}</p>` +
    chipsOf(p) +
    `<div class="show__actions">${button(primaryAction(p, "m", here))}${secondary}</div>` +
    `</div></article>`
  );
}

const shows = (level: 2 | 3, here: "home" | "page"): string =>
  `<div class="shows">${projects.map((p, i) => show(p, i, level, here)).join("")}</div>`;

/** Jump list beside the slab: one row per project. */
function projectIndex(): string {
  return (
    `<ol class="pindex">` +
    projects.map((p, i) =>
      `<li data-reveal style="--i:${i + 1}"><a class="pindex__link pindex__link--${p.tone}" href="#p-${p.id}">` +
      `<span class="pindex__no">${pad2(i + 1)}</span>` +
      `<span class="pindex__name">${esc(p.name)}</span>` +
      `<span class="pindex__go" aria-hidden="true">${icon("arrow-down", 2)}</span></a></li>`,
    ).join("") +
    `</ol>`
  );
}

// -------------------------------------------------------------- band, doors

function band(): string {
  const words = ["Downloads", "Gallery", "Docs", "Blog", "Donate"];
  const run = words.map((w) => `<span class="band__word">${w}</span>${icon("sparkle", 3, "band__star")}`).join("");
  return (
    `<div class="band" aria-hidden="true"><div class="band__track">` +
    `<div class="band__run">${run}</div><div class="band__run">${run}</div>` +
    `</div></div>`
  );
}

function doors(content: SiteContent): string {
  const files = downloads.filter((d) => d.file !== null);
  const bytes = files.reduce((sum, d) => sum + (d.file?.bytes ?? 0), 0);
  const facts: Record<string, string> = {
    downloads: `${pad2(files.length)} ${files.length === 1 ? "file" : "files"} · ${formatBytes(bytes)}`,
    gallery: `${pad2(content.gallery.length)} pieces`,
    docs: `${pad2(content.docs.length)} docs · ${pad2(content.posts.length)} ${content.posts.length === 1 ? "post" : "posts"}`,
    donate: "Ko-fi · MB Bank",
  };
  const items = NAV.filter((n) => n.id !== "blog").map((n, i) => {
    const title = n.id === "docs" ? "Docs & blog" : n.label;
    return (
      `<li><a class="door door--${n.tone}" href="${n.href}" data-reveal="pop" style="--i:${i}">` +
      `${tile(n.icon, n.tone, "l")}` +
      `<span class="door__title">${esc(title)}</span>` +
      `<span class="door__fact">${esc(facts[n.id] ?? "")}</span>` +
      `<span class="door__go" aria-hidden="true">${icon("arrow", 3)}</span></a></li>`
    );
  });
  return `<ul class="doors__list">${items.join("")}</ul>`;
}

// ------------------------------------------------------------------ landing

export function landing(content: SiteContent): string {
  return (
    `<section class="hero" aria-labelledby="projects">` +
    // Stickers only up by the slab; the showcase rows get quieter shapes so
    // nothing drifts into the text beside the scenes. The showcase set starts
    // below the slab so its big tints never land on the hero's stickers, and
    // the hero's own tint is pink so the two never read as one mint blob.
    floats("home-hero", { tone: "yellow", stickers: ["sparkle", "blob", "star"], far: 1, mid: 2, near: 2, span: 0.16, farTone: "magenta" }) +
    floats("home-shows", { tone: "mint", far: 2, mid: 2, near: 0, from: 0.26 }) +
    `<div class="wrap">` +
    `<div class="hero__grid">` +
    `<div class="hero__slab" data-reveal="slab">` +
    `<h1 class="hero__mark mark">dex</h1>` +
    sticker("sparkle", { scale: 4, tilt: 10, tone: "mint", className: "hero__st hero__st--a" }) +
    sticker("star", { scale: 3, tilt: -14, tone: "magenta", className: "hero__st hero__st--b" }) +
    `</div>` +
    `<div class="hero__head">` +
    sectionHead({ id: "projects", no: 1, kicker: "projects", title: "Projects", tone: "yellow", variant: "line", aside: `${pad2(projects.length)} items` }) +
    projectIndex() +
    `</div></div>` +
    shows(3, "home") +
    `</div></section>` +
    band() +
    `<section class="doors" aria-labelledby="doors-title">` +
    floats("home-doors", { far: 1, mid: 2, near: 2, stickers: ["heart", "coin"] }) +
    `<div class="wrap">` +
    `<h2 class="sr" id="doors-title">Sections</h2>` +
    doors(content) +
    `</div></section>`
  );
}

// ----------------------------------------------------------- /projects/

export function projectsIndex(): string {
  return (
    `<div class="page page--projects">` +
    floats("projects", { tone: "yellow", stickers: ["sparkle", "blob", "star"] }) +
    `<div class="wrap">` +
    pageHead({ kicker: "projects", title: "Projects", tone: "paper", aside: `${pad2(projects.length)} items`, stickers: ["window", "sparkle"] }) +
    shows(2, "page") +
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
  const rest = projects.filter((o) => o.id !== p.id);
  return (
    `<nav class="others" aria-labelledby="others-title">` +
    `<h2 class="proj__h2" id="others-title">${tile("grid", "paper", "s")}<span>Other projects</span></h2>` +
    `<ul class="others__list">` +
    rest.map((o, i) =>
      `<li data-reveal="pop" style="--i:${i}"><a class="other other--${o.tone}" href="${projectHref(o)}">` +
      `<span class="other__art">${projectArt(o)}</span>` +
      `<span class="other__text"><span class="other__name">${esc(o.name)}</span>` +
      `<span class="other__line">${esc(o.line)}</span></span>` +
      `<span class="other__go" aria-hidden="true">${icon("arrow", 3)}</span></a></li>`,
    ).join("") +
    `</ul></nav>`
  );
}

export function projectPage(p: Project): string {
  const at = projects.indexOf(p);
  return (
    `<div class="page page--project">` +
    floats(`project-${p.id}`, { tone: p.tone, far: 2, mid: 2, near: 2, stickers: ["sparkle", "star"] }) +
    `<div class="wrap">` +
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/projects/">Projects</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav>` +
    `<header class="proj proj--${p.tone}">` +
    `<div class="proj__art" data-reveal="pop-block">${projectArt(p, "hero")}${artTag(p)}</div>` +
    `<div class="proj__head">` +
    `<p class="sh__kicker" data-reveal><span class="sh__slash" aria-hidden="true">//</span><span>project</span>` +
    `<span class="sh__rule" aria-hidden="true"></span>${counter(at + 1, projects.length, "sh__aside")}</p>` +
    `<h1 class="proj__title"><span class="slab slab--${p.tone}" data-reveal="wipe">${esc(p.name)}</span></h1>` +
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

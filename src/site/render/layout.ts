// The shell every page shares: <head> extras, header with nav, footer, and on
// the root page the world mount with its cinematic bars (DESIGN-SYSTEM.md §4).

import { KOFI_URL, NAV, type NavItem } from "../data/nav.ts";
import { button, icon, strip, tile } from "./glyphs.ts";
import { cx, esc } from "./html.ts";
import type { PageId, PageMeta, Rendered } from "./types.ts";

export const ORIGIN = "https://dex.place";

// Adds the `js` class before first paint so reveal styles apply only when
// scripts run. If main.ts never marks the page ready (a script error, a
// blocked module), the class is removed again and everything shows, and any
// deferred images (render/gallery.ts, motion/defer.ts) get their sources.
const JS_FLAG =
  `<script>(function(d){d.classList.add("js");setTimeout(function(){if(d.classList.contains("ready"))return;` +
  `d.classList.remove("js");var q=function(s){return[].slice.call(d.querySelectorAll(s))};` +
  `q("[data-defer][data-srcset],[data-defer] [data-srcset]").forEach(function(e){e.srcset=e.getAttribute("data-srcset")});` +
  `q("img[data-defer][data-src],[data-defer] img[data-src]").forEach(function(e){e.src=e.getAttribute("data-src")});` +
  `q("[data-defer]").forEach(function(e){e.removeAttribute("data-defer")})},3000)})(document.documentElement)</script>`;

export function head(meta: PageMeta): string {
  const title = meta.title ? `${meta.title} · dex` : "dex";
  const url = `${ORIGIN}${meta.path}`;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:site_name" content="dex" />`,
    meta.noindex ? `<meta name="robots" content="noindex" />` : "",
    `<meta name="theme-color" content="${meta.page === "home" ? "#0a0b0f" : "#ffffff"}" />`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`,
    `<link rel="alternate" type="application/rss+xml" title="dex blog" href="/blog/feed.xml" />`,
    `<link rel="preload" href="/fonts/Daniel-Regular.otf" as="font" type="font/otf" crossorigin />`,
    `<!--site:preload-->`,
    JS_FLAG,
  ].filter(Boolean).join("\n    ");
}

function navLink(item: NavItem, current: PageId, variant: "bar" | "menu"): string {
  const here = item.id === current;
  const aria = here ? ` aria-current="page"` : "";
  if (variant === "menu") {
    return (
      `<li><a class="menu__link" href="${item.href}"${aria} data-tone="${item.tone}">` +
      `${tile(item.icon, item.tone, "m")}<span>${esc(item.label)}</span>${icon("arrow", 3, "menu__arrow")}</a></li>`
    );
  }
  return `<li><a class="nav__link" href="${item.href}"${aria} data-tone="${item.tone}">${icon(item.icon, 2)}<span>${esc(item.label)}</span></a></li>`;
}

export function header(current: PageId): string {
  const worldHref = current === "home" ? "#world" : "/#world";
  return (
    `<header class="hdr" data-hdr>` +
    `<div class="hdr__in">` +
    `<a class="hdr__mark" href="/"${current === "home" ? ` aria-current="page"` : ""}><span class="mark">dex</span><span class="sr">home</span></a>` +
    `<nav class="nav" aria-label="Main"><ul class="nav__list" data-nav>` +
    NAV.map((item) => navLink(item, current, "bar")).join("") +
    `</ul><span class="nav__ind" aria-hidden="true" data-nav-ind></span></nav>` +
    button({ href: worldHref, label: "World", icon: "up", iconFirst: true, tone: "ink", size: "s", className: "hdr__world" }) +
    `<button class="btn btn--paper btn--s hdr__menu" type="button" popovertarget="menu">` +
    `<span class="btn__ic">${icon("menu", 2)}</span><span class="btn__label">Menu</span></button>` +
    `</div>` +
    `<div class="menu" id="menu" popover aria-label="Menu">` +
    `<div class="menu__top"><span class="mark" aria-hidden="true">dex</span>` +
    `<button class="btn btn--paper btn--s btn--icon" type="button" popovertarget="menu" popovertargetaction="hide" aria-label="Close menu" autofocus>` +
    `<span class="btn__ic">${icon("close", 3)}</span></button></div>` +
    `<nav aria-label="Menu"><ul class="menu__list">` +
    NAV.map((item) => navLink(item, current, "menu")).join("") +
    `</ul></nav>` +
    `<div class="menu__foot">${button({ href: worldHref, label: "World", icon: "up", iconFirst: true, tone: "ink", size: "m" })}` +
    `${button({ href: "/", label: "Home", size: "m" })}</div>` +
    strip("menu__strip", false) +
    `</div>` +
    `</header>`
  );
}

export function footer(current: PageId): string {
  const links = NAV.map(
    (item) => `<li><a href="${item.href}"${item.id === current ? ` aria-current="page"` : ""}>${icon(item.icon, 2)}<span>${esc(item.label)}</span></a></li>`,
  ).join("");
  return (
    `<footer class="ftr">` +
    strip("ftr__strip", false) +
    `<div class="ftr__in wrap">` +
    `<a class="ftr__mark" href="/"><span class="mark">dex</span><span class="sr">home</span></a>` +
    `<nav class="ftr__nav" aria-label="Footer"><ul>${links}` +
    `<li><a href="${current === "home" ? "#world" : "/#world"}">${icon("up", 2)}<span>World</span></a></li></ul></nav>` +
    `<div class="ftr__side">` +
    `<a class="ftr__kofi" href="${KOFI_URL}" rel="noopener">${icon("heart", 2)}<span>Ko-fi</span>${icon("external", 2)}</a>` +
    `<span class="ftr__sleepy" aria-hidden="true">${icon("sleepy", 4)}</span>` +
    `</div></div>` +
    `<div class="ftr__base wrap"><p>Type: <a href="/fonts/Daniel-license.txt">Daniel</a> by Daniel Midgley, ` +
    `<a href="/fonts/OFL-Anybody.txt">Anybody</a>, <a href="/fonts/OFL-SpaceGrotesk.txt">Space Grotesk</a> and ` +
    `<a href="/fonts/OFL-Silkscreen.txt">Silkscreen</a> (SIL OFL).</p></div>` +
    `</footer>`
  );
}

/** Top of the root page: the mount point for the 2D world (built elsewhere).
 *  The #world target is an empty anchor at document offset 0, not the sticky
 *  section: a sticky element always counts as "in view", so a link to it would
 *  never scroll back up. motion/world.ts moves focus into the section. */
export function world(): string {
  return (
    `<div id="world" class="world-top"></div>` +
    `<section class="world" data-world-mount tabindex="-1" aria-label="World">` +
    `<a class="skip" href="#site">Skip to site</a>` +
    `<div class="world__stage" data-world-stage>` +
    // Still frame drawn in code; the world module replaces it when it mounts.
    `<div class="world__still" aria-hidden="true"><span class="world__stars"></span><span class="world__ring"></span>` +
    `<span class="world__ground"></span><span class="world__floor"></span></div>` +
    `</div>` +
    `<div class="world__bars" aria-hidden="true"><span class="world__bar world__bar--top"></span><span class="world__bar world__bar--bottom"></span></div>` +
    `<a class="world__cue" href="#site"><span>Site</span>${icon("arrow-down", 2)}</a>` +
    `</section>`
  );
}

export interface ShellOptions {
  meta: PageMeta;
  main: string;
}

/** Assembles head + body for one page. */
export function shell({ meta, main }: ShellOptions): Rendered {
  const home = meta.page === "home";
  const body =
    (home ? world() : `<a class="skip" href="#main">Skip to content</a>`) +
    `<div class="${cx("sheet", home ? "sheet--home" : "sheet--page")}" id="site" data-page="${meta.page}">` +
    (home ? strip("sheet__pills", false) : strip("sheet__top", false)) +
    header(meta.page) +
    `<main id="main" class="main" tabindex="-1">${main}</main>` +
    footer(meta.page) +
    `</div>`;
  return { head: head(meta), body };
}

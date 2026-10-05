// The shell every page shares: <head> extras, header with nav, footer, and on
// the root page the world mount with its cinematic bars (DESIGN-SYSTEM.md §4).

import { KOFI_URL, NAV, navHref, type NavItem } from "../data/nav.ts";
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

// Cross-document view transitions (styles/shell.css `@view-transition`) are
// CSS-only; this keeps them from ever surfacing as errors. It runs in <head>,
// before the first frame, as `pagereveal` requires.
// - The transition's promises get a no-op catch on both sides, so an aborted
//   or skipped transition never becomes an uncaught rejection.
// - Leaving for a page that does not opt in (the lab, the scenes, plain files)
//   skips the transition on the way out instead of letting the next page abort it.
// - A transition the browser aborts before the page can see it (Chromium:
//   "Transition was aborted because of invalid state") is an expected outcome,
//   not a fault: its rejection is marked handled. Nothing else is filtered.
// Browsers without view transitions never fire these events. Navigation is
// never blocked or delayed: nothing here waits on a transition.
const EMBED_FLAG = `<script>if(window.parent!==window&&new URLSearchParams(location.search).get("embed")==="world")document.documentElement.setAttribute("data-embed","world")</script>`;

const VT_GUARD =
  `<script>(function(w){var q=function(t){if(!t)return t;[t.ready,t.finished,t.updateCallbackDone].forEach(function(p){if(p&&p.catch)p.catch(function(){})});return t};` +
  `w.addEventListener("pageswap",function(e){var t=q(e.viewTransition);if(!t)return;var a=e.activation,u=null;` +
  `try{u=new URL(a&&a.entry&&a.entry.url)}catch(x){}` +
  `if(!u||u.origin!==location.origin||/^\\/(lab|scenes)(\\/|$)/.test(u.pathname)||/\\.(?!html$)\\w+$/.test(u.pathname))try{t.skipTransition()}catch(x){}});` +
  `w.addEventListener("pagereveal",function(e){q(e.viewTransition)});` +
  `w.addEventListener("unhandledrejection",function(e){var r=e.reason;` +
  `if(r&&/^(AbortError|InvalidStateError|TimeoutError)$/.test(r.name)&&/transition/i.test(r.message))e.preventDefault()})})(window)</script>`;

// The first screen of a page with deferred collage tiles (render/gallery.ts,
// motion/defer.ts), wherever the page opens: at the top (/gallery/), or at a
// section (/#gallery from a Gallery link, a shared /#donate), where the
// browser scrolls straight there. The images that will be on screen are the
// page's largest paint, but deferred tiles would wait for main.ts. This runs
// at the end of <body>, as soon as the stylesheet is in, and works out which
// images will be in view once the page has come to rest.
// - The largest of them, and any within 3% of it, load at once, eagerly, with
//   fetchpriority="high". Largest Contentful Paint takes the last largest
//   image to paint, and two tiles of one size (the phone collage's first two
//   rows, a desktop row of two) measure a pixel apart depending on where they
//   snap, so a same-size tile left to load later would become the page's
//   largest paint whenever it lands. On a slow phone line they only make the
//   2.5 s budget if they have the line (nearly) to themselves.
// - The others in view are marked data-defer="lead" (eager): motion/defer.ts
//   releases them the moment every high-priority image has landed, and the
//   rest of the wall only after those.
// A lead image already in the markup (the first tile on /gallery/) counts
// among them. For /#gallery the home page's <head> has usually started each
// layout's lead already (render/gallery.ts galleryArrival); the tile picks the
// same copy here and takes it from that preload. Nothing in view (the home
// page opens on the world): nothing changes.
// Where the page will rest: the target's top less html's scroll-padding-top and
// its own scroll-margin-top, clamped to the bottom of the page; without a
// target, where it is now.
export const ARRIVAL =
  `<script>(function(d,w){var h=location.hash.slice(1),t=null;if(h)try{t=d.getElementById(decodeURIComponent(h))}catch(x){}` +
  `var H=w.innerHeight,px=function(v){return parseFloat(v)||0},y0=w.scrollY||0,` +
  `top=t?Math.max(0,Math.min(t.getBoundingClientRect().top+y0-px(getComputedStyle(d.documentElement).scrollPaddingTop)-px(getComputedStyle(t).scrollMarginTop),d.documentElement.scrollHeight-H)):y0,` +
  `shown=function(i){var r=i.getBoundingClientRect(),a=r.top+y0-top,b=a+r.height;return r.width<1||b<=0||a>=H?0:r.width*(Math.min(b,H)-Math.max(a,0))},` +
  `seen=[],most=0;` +
  `[].forEach.call(d.querySelectorAll("img[fetchpriority=high]"),function(i){most=Math.max(most,shown(i))});` +
  `[].forEach.call(d.querySelectorAll("[data-defer]:not([data-defer=lead])"),function(el){var i=el.tagName==="IMG"?el:el.querySelector("img"),a=i?shown(i):0;` +
  `if(a>0){seen.push([el,i,a]);most=Math.max(most,a)}});` +
  `seen.forEach(function(s){var el=s[0],i=s[1];i.loading="eager";if(s[2]<most*0.97){el.setAttribute("data-defer","lead");return}` +
  `i.setAttribute("fetchpriority","high");el.removeAttribute("data-defer");` +
  `[el].concat([].slice.call(el.querySelectorAll("source,img"))).forEach(function(n){var v=n.getAttribute("data-srcset");` +
  `if(v!==null){n.srcset=v;n.removeAttribute("data-srcset")}v=n.getAttribute("data-src");if(v!==null&&n.tagName==="IMG"){n.src=v;n.removeAttribute("data-src")}})})` +
  `})(document,window)</script>`;

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
    meta.noindex || meta.nsfw
      ? `<meta name="robots" content="${[meta.noindex && "noindex", meta.nsfw && "noimageindex"].filter(Boolean).join(", ")}" />`
      : "",
    meta.nsfw ? `<meta name="rating" content="adult" />` : "",
    `<meta name="theme-color" content="#0f1015" />`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`,
    `<link rel="alternate" type="application/rss+xml" title="dex blog" href="/blog/feed.xml" />`,
    `<link rel="preload" href="/fonts/Daniel-Regular.otf" as="font" type="font/otf" crossorigin />`,
    `<!--site:preload-->`,
    EMBED_FLAG,
    JS_FLAG,
    VT_GUARD,
    meta.headEnd ?? "",
  ].filter(Boolean).join("\n    ");
}

function navLink(item: NavItem, current: PageId, variant: "bar" | "menu"): string {
  const onHome = current === "home";
  // Inner pages mark the section they belong to (blog posts under Blog, a
  // project page under Projects, ...). On the home page motion/nav.ts moves
  // the mark with the scroll; without JS nothing is marked there.
  const here = !onHome && sectionOf(current) === item.id;
  const aria = here ? ` aria-current="true"` : "";
  const href = navHref(item, onHome);
  if (variant === "menu") {
    return (
      `<li><a class="menu__link" href="${href}"${aria} data-spy="${item.id}" data-tone="${item.tone}">` +
      `${tile(item.icon, item.tone, "m")}<span>${esc(item.label)}</span>${icon("arrow", 3, "menu__arrow")}</a></li>`
    );
  }
  return `<li><a class="nav__link" href="${href}"${aria} data-spy="${item.id}" data-tone="${item.tone}">${icon(item.icon, 2)}<span>${esc(item.label)}</span></a></li>`;
}

/** Which nav section a page belongs to. */
function sectionOf(page: PageId): NavItem["id"] | null {
  return page === "home" || page === "notfound" ? null : page;
}

export function header(current: PageId): string {
  const onHome = current === "home";
  const worldHref = onHome ? "#world" : "/#world";
  return (
    `<header class="hdr" data-hdr>` +
    `<div class="hdr__in">` +
    `<a class="hdr__mark pop" href="${onHome ? "#site" : "/"}"><span class="mark">dex</span><span class="sr">home</span></a>` +
    `<nav class="nav" aria-label="Sections"><ul class="nav__list" data-nav>` +
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
    `<nav aria-label="Sections (menu)"><ul class="menu__list">` +
    NAV.map((item) => navLink(item, current, "menu")).join("") +
    `</ul></nav>` +
    `<div class="menu__foot">${button({ href: worldHref, label: "World", icon: "up", iconFirst: true, tone: "ink", size: "m" })}` +
    (onHome ? "" : button({ href: "/", label: "Home", icon: "arrow", size: "m" })) +
    `</div>` +
    strip("menu__strip", false) +
    `</div>` +
    `</header>`
  );
}

export function footer(current: PageId): string {
  const onHome = current === "home";
  const links = NAV.map(
    (item) => `<li><a href="${navHref(item, onHome)}">${icon(item.icon, 2)}<span>${esc(item.label)}</span></a></li>`,
  ).join("");
  return (
    `<footer class="ftr">` +
    strip("ftr__strip", false) +
    `<div class="ftr__in wrap">` +
    `<a class="ftr__mark" href="${onHome ? "#site" : "/"}"><span class="mark">dex</span><span class="sr">home</span></a>` +
    `<nav class="ftr__nav" aria-label="Footer"><ul>${links}` +
    `<li><a href="${onHome ? "#world" : "/#world"}">${icon("up", 2)}<span>World</span></a></li></ul></nav>` +
    `<div class="ftr__side">` +
    `<a class="ftr__kofi pop" href="${KOFI_URL}" rel="noopener">${icon("heart", 2)}<span>Ko-fi</span>${icon("external", 2)}</a>` +
    `<span class="ftr__sleepy" aria-hidden="true">${icon("sleepy", 3)}</span>` +
    `</div></div>` +
    `<div class="ftr__base wrap"><p>Type: <a href="/fonts/Daniel-license.txt">Daniel</a> by Daniel Midgley, ` +
    `<a href="/fonts/OFL-Jersey15.txt">Jersey 15</a>, <a href="/fonts/OFL-SpaceGrotesk.txt">Space Grotesk</a> and ` +
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
    `<div class="world__fallback">${button({ href: "/world/", label: "World", icon: "up", iconFirst: true, tone: "ink", size: "s" })}</div>` +
    `<p class="world__hint" data-world-failure role="status" hidden></p>` +
    `<noscript><p class="world__hint">The world needs JavaScript. <a href="#site">Visit the site</a>.</p></noscript>` +
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
    strip("sheet__top", false) +
    header(meta.page) +
    `<main id="main" class="main" tabindex="-1">${main}</main>` +
    footer(meta.page) +
    `</div>` +
    // Only pages with deferred collage tiles need the arrival script.
    (/\sdata-defer[\s>]/.test(main) ? ARRIVAL : "");
  return { head: head(meta), body };
}

// The project banners (Dex 10-22: "make the projects more like banners, have them going in strips all the way down";
// lanes\site-art-1022\PLAN.md 5.4; Dex 10-26: YUKI the big one, the dex.place world smaller below it, `pban--lead` /
// `pban--minor`). Strips stacked down the projects panel, each overhanging the paper onto the
// world, each layered with Dex's own art: his painted plate behind (public/site/banners/<id>/back.webp), a giant
// numeral, his ink slash across (public/site/banners/ink.webp), the picked card art in a slanted window at the world end
// (the card's rig, pixels unchanged, cropped only), his front fx (public/site/banners/<id>/fx.webp) and a scrim the
// words sit on. The words (number, platform, name, state, line, the one action and the docs) are the K2 card's.
// Styles: styles/pbanner.css; motion: motion/pbanner.ts (the same CardDeck contract as the cards: motion/pcard.ts hands a
// banner list over to it, so the choreography and main.ts call it as before).
//
// DOM, outside in (one owner per transform):
//   li.pban[data-pcard]        G (styles/bands.css): placement, the zig-zag step
//     div.pban__in             the deck: entrance + scroll-speed skew (GSAP); the banner's container
//       div.pban__tilt         touch: a view-timeline tilt (CSS)
//         div.pban__lift       hover: the lift (CSS)
//           span.pban__plate   the hard offset block in the hero accent
//           article.pban__b    art (clipped), hero window, front (clipped), words, brackets

import { existsSync } from "node:fs";
import { projectHref, projects, type Project } from "../data/projects.ts";
import { cardArt } from "./cardart.ts";
import { button, chip, icon } from "./glyphs.ts";
import { cx, esc, pad2 } from "./html.ts";
import { fileOf, primaryAction, stateText } from "./pcard.ts";
import { snowFx, yukiBack } from "./yukiart.ts";

const BANNERS = "/site/banners/";
const has = (path: string): boolean => existsSync(new URL(`../../../public${path}`, import.meta.url));

/** A banner's own art files (Dex's layers), the ones that exist: the build never points at a missing file. Each a wide
 *  2400 x 720 and a phone 800 x 340 cut. */
export function bannerArt(p: Project): { back: string | null; fx: string | null; ink: string | null } {
  const at = (f: string): string | null => (has(`${BANNERS}${f}.webp`) ? `${BANNERS}${f}` : null);
  return { back: at(`${p.id}/back`), fx: at(`${p.id}/fx`), ink: at("ink") };
}

/** One of those layers as a lazy, decorative img: the phone cut where it exists. */
function layerImg(cls: string, base: string): string {
  const phone = has(`${base}-p.webp`) ? ` srcset="${base}-p.webp 800w, ${base}.webp 2400w" sizes="(max-width: 699px) 100vw, 64vw"` : "";
  return `<img class="${cls}" src="${base}.webp"${phone} alt="" width="2400" height="720" loading="lazy" decoding="async">`;
}

/** The banner's art layers, back to front (inside the clipped art box): ink base, Dex's plate, the numeral, his ink
 *  slash. Every image lazy and decorative. */
function artLayers(p: Project, no: string): string {
  const a = bannerArt(p);
  // YUKI's plate is drawn in code (Dex 10-26): her snowy night in the plate's place, Dex's ink slash still across it
  const back = p.art.code === "yuki"
    ? `<span class="pban__bk">${yukiBack()}</span>`
    : a.back ? `<span class="pban__bk">${layerImg("pban__back", a.back)}</span>` : "";
  const slash = a.ink ? `<span class="pban__sl">${layerImg("pban__slash", a.ink)}</span>` : "";
  return `<span class="pban__art">${back}<span class="pban__num">${esc(no)}</span>${slash}</span>`;
}

/** The hero window: the picked card art (its rig, pixels unchanged) in a slanted 4:5 window at the world end; on a
 *  project's page it is the page's picture (its alt text and credit), elsewhere decorative. In a list it is a pointer
 *  shortcut to the project's page like the rest of the art (the card's art was its link; the window sits above
 *  .pban__hit and its top lifts over the banner's edge, so it carries the link itself); keyboards and screen readers
 *  keep the one link on the name. */
function heroWindow(p: Project, picture = false): string {
  const tag = picture ? "div" : "a";
  const attrs = picture ? "" : ` href="${projectHref(p)}" tabindex="-1" aria-hidden="true"`;
  return (
    `<${tag} class="pban__hero"${attrs}><span class="pban__hplate" aria-hidden="true"></span>` +
    `<div class="pban__win"><div class="pban__hfloat">${cardArt(p, "pban__cart", picture ? {} : { decor: true })}</div></div></${tag}>`
  );
}

/** In front of the hero, clipped to the banner: Dex's fx, the scrim the words sit on, the shine. */
function front(p: Project): string {
  const { fx } = bannerArt(p);
  return (
    `<span class="pban__front" aria-hidden="true">` +
    (fx ? layerImg("pban__fx", fx) : "") +
    (p.art.code === "yuki" ? snowFx(`${p.id}-front`, 22, "pban__snow") : "") +
    `<span class="pban__scrim"></span><span class="pban__shine"></span></span>`
  );
}

/** One banner (a list item). level: the name's heading level; here: home (in-page anchors) or a page of its own. */
function banner(p: Project, i: number, level: 2 | 3, here: "home" | "page"): string {
  const h = `h${level}`;
  const href = projectHref(p);
  const no = pad2(projects.indexOf(p) + 1);
  const state = stateText(p);
  const act = primaryAction(p, "m", here);
  const docs =
    `<a class="btn btn--paper btn--s btn--icon pban__docs" href="${esc(p.docs.href)}" aria-label="${esc(`${p.name} docs`)}" title="Docs">` +
    `<span class="btn__ic">${icon("book", 2)}</span></a>`;
  return (
    `<li class="${cx("pban", p.size && `pban--${p.size}`)}" data-pcard="${p.id}" style="--i:${Math.min(i, 5)}">` +
    `<div class="pban__in" data-tone="${p.tone}"><div class="pban__tilt"><div class="pban__lift">` +
    `<span class="pban__plate" aria-hidden="true"></span>` +
    `<article class="${cx("pban__b", `pban--${p.tone}`)}" id="p-${p.id}" aria-labelledby="p-${p.id}-name">` +
    // the art is a pointer shortcut to the project's page; keyboards and screen readers get the same link once, on the name
    `<a class="pban__hit" href="${href}" tabindex="-1" aria-hidden="true">${artLayers(p, no)}</a>` +
    heroWindow(p) +
    front(p) +
    `<div class="pban__info">` +
    `<div class="pban__top"><span class="pban__no" aria-hidden="true">${no}</span><p class="pban__plat">${esc(p.platform)}</p>` +
    `<span class="pban__cap" aria-hidden="true">${esc(`${p.hero} // ${p.name}`.toUpperCase())}</span></div>` +
    `<${h} class="pban__name" id="p-${p.id}-name"><a class="pban__link" href="${href}">${esc(p.name)}</a></${h}>` +
    (state ? `<p class="pban__state">${esc(state)}</p>` : "") +
    `<p class="pban__line">${esc(p.line)}</p>` +
    `<div class="pban__acts">${button({ ...act, className: `pban__main pban__main--${act.icon ?? "arrow"}` })}${docs}</div>` +
    `</div>` +
    `<i class="pban__brackets" aria-hidden="true"></i>` +
    `</article></div></div></div></li>`
  );
}

export interface ProjectBannersOptions {
  readonly level: 2 | 3;
  readonly here: "home" | "page";
  readonly className?: string;
}

/** The banner strips, `ul.pbans[data-pcards][data-pban]`: the choreography and main.ts find it as the cards' list
 *  (data-pcards) and motion/pcard.ts hands it to the banner deck (data-pban). */
export const projectBanners = (list: readonly Project[], { level, here, className }: ProjectBannersOptions): string =>
  `<ul class="${cx("pbans", className)}" data-pcards="${here}" data-pban>${list.map((p, i) => banner(p, i, level, here)).join("")}</ul>`;

/** A project page's header as its banner (P2): the same layers, the name as the page's h1, its chips and both keys. */
export function bannerHeader(p: Project, crumbs: string): string {
  const no = pad2(projects.indexOf(p) + 1);
  const act = primaryAction(p, "m", "page");
  const f = fileOf(p);
  const chips = [chip(p.platform, "key"), ...(f ? [chip(`v${f.version}`, "value")] : [])].join("");
  return (
    `<header class="pbans pbans--head" data-pcards="page" data-pban>` +
    `<div class="pban pban--head" data-pcard="${p.id}" style="--i:0">` +
    `<div class="pban__in" data-tone="${p.tone}"><div class="pban__tilt"><div class="pban__lift">` +
    `<span class="pban__plate" aria-hidden="true"></span>` +
    `<div class="${cx("pban__b", `pban--${p.tone}`)}">` +
    `<span class="pban__hit" aria-hidden="true">${artLayers(p, no)}</span>` +
    heroWindow(p, true) +
    front(p) +
    `<div class="pban__info">` +
    `<div class="pban__top">${crumbs}</div>` +
    `<h1 class="pban__name" id="p-${p.id}-name">${esc(p.name)}</h1>` +
    `<p class="pban__line">${esc(p.line)}</p>` +
    `<p class="chips pban__chips">${chips}</p>` +
    `<div class="pban__acts">${button({ ...act, className: `pban__main pban__main--${act.icon ?? "arrow"}` })}` +
    `${button({ href: p.docs.href, label: p.docs.label, icon: "book", size: "m", className: "pban__docs-l" })}</div>` +
    `</div>` +
    `<i class="pban__brackets" aria-hidden="true"></i>` +
    `</div></div></div></div></div></header>`
  );
}

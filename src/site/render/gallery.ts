// The gallery: /gallery/ (the collage) and /gallery/<id>/ (one piece).
//
// Dex: "dont name them, frame them nicely, maybe a collage? stuff transforms,
// shrinks and grows as ur cursor moves/hovers over them and as u click into
// and out of stuff." So: no visible titles (alt text stays), every piece in a
// white mat with an ink outline and a strip of coloured tape, laid out as a
// collage computed at build time (src/site/collage.ts). The cursor field and
// the click-in viewer are progressive (motion/gallery.ts); without JS every
// piece is a plain link to its own page. Styles: styles/gallery.css.
//
// Display only: Dex's art never appears outside this page and its piece pages.

import { collageLayouts, LAYOUTS, type Box, type LayoutName } from "../collage.ts";
import type { Tone } from "../data/projects.ts";
import { floats } from "./floats.ts";
import { button, counter, icon, pageHead } from "./glyphs.ts";
import { esc, pad2 } from "./html.ts";
import type { GalleryItem, SiteContent } from "./types.ts";

// Tape and hover-shadow colours, cycled through the reading order.
const TONES: readonly Tone[] = ["yellow", "magenta", "mint", "cyan"];
// Where the tape sits on the frame, cycled with a different period so tone
// and position don't repeat together.
const TAPES = ["tc", "tl", "tr", "tc", "tr"] as const;

const LAYOUT_KEYS: Readonly<Record<LayoutName, string>> = { wide: "w", mid: "m", narrow: "n" };

const orderCache = new WeakMap<readonly GalleryItem[], { placed: Placed[]; heights: Record<LayoutName, number> }>();

export interface Placed {
  readonly item: GalleryItem;
  /** Position in the reading order (0-based). */
  readonly at: number;
  readonly tone: Tone;
  readonly boxes: Readonly<Record<LayoutName, Box>>;
}

/**
 * The gallery in reading order (top to bottom, then left to right in the
 * wide collage). The collage, the viewer and the piece pages all step
 * through pieces in this order, so "next" always means the same thing.
 */
export function galleryOrder(g: readonly GalleryItem[]): { placed: Placed[]; heights: Record<LayoutName, number> } {
  // Every piece page asks for the same order; compute it once per content load.
  const cached = orderCache.get(g);
  if (cached) return cached;
  const layouts = collageLayouts(g);
  const wide = layouts.wide.boxes;
  // Pieces whose tops are within a band of each other read as one row.
  const band = 8;
  const order = g.map((_, i) => i).sort((a, b) => {
    const pa = wide[a]!;
    const pb = wide[b]!;
    return Math.abs(pa.y - pb.y) < band ? pa.x - pb.x : pa.y - pb.y;
  });
  const placed = order.map((index, at) => ({
    item: g[index]!,
    at,
    tone: TONES[at % TONES.length]!,
    boxes: { wide: wide[index]!, mid: layouts.mid.boxes[index]!, narrow: layouts.narrow.boxes[index]! },
  }));
  const result = { placed, heights: { wide: layouts.wide.height, mid: layouts.mid.height, narrow: layouts.narrow.height } };
  orderCache.set(g, result);
  return result;
}

function boxVars(boxes: Readonly<Record<LayoutName, Box>>): string {
  return (Object.keys(LAYOUT_KEYS) as LayoutName[])
    .map((name) => {
      const k = LAYOUT_KEYS[name];
      const b = boxes[name];
      return `--x${k}:${b.x};--y${k}:${b.y};--w${k}:${b.w};--t${k}:${b.tilt};--z${k}:${b.z}`;
    })
    .join(";");
}

// ------------------------------------------------------- responsive images
//
// Every piece ships as its lossless display file plus smaller lossless copies
// (manifest `widths`, made by npm run gallery:derive). `sizes` states the
// width each image is actually drawn at, so the browser picks the smallest
// copy that is sharp on the screen in hand.
//
// The layout maths behind the numbers (styles/tokens.css, base.css,
// gallery.css): the collage box is the wrap, min(1200px, 100vw - 2 * --pad)
// with --pad = clamp(18px, 4.5vw, 48px), so it is 100vw - 36px below 400px,
// 91vw from 400px to 1066px, 100vw - 96px above that and 1200px from 1296px.
// Its container queries switch layouts at 600px and 1000px of box width, i.e.
// at 660px and 1096px of viewport. An image is its frame's width less the mat
// on both sides, all in box units (collage.ts `mat`).
//
// Phones get a cap: browsers take the smallest copy at or above the screen's
// full density, so a 3x phone would pull the 960/1280 copies (lossless, up to
// ~0.9 MB each) for tiles about 340 CSS px wide. Below the phone breakpoints
// the srcset stops at the copy nearest 2x of the image's width on a 390px
// phone: crisp at that size, a fraction of the bytes, and the full file is one
// tap away in the viewer.

/** URL of a piece's smaller lossless copy, `w` pixels wide. */
export const galleryVariant = (src: string, w: number): string => src.replace(/\.webp$/, `-${w}.webp`);

/** Every width a piece comes in, ascending: its copies, then the display file. */
const allWidths = (item: GalleryItem): number[] => [...item.widths, item.width];
const urlAt = (item: GalleryItem, w: number): string => (w === item.width ? item.src : galleryVariant(item.src, w));
/** The smallest copy: film-strip thumbnails and the piece page's first paint. */
const thumb = (item: GalleryItem): string => urlAt(item, allWidths(item)[0]!);

/** srcset over a piece's copies and its display file, up to `max` pixels wide. */
export function artSrcset(item: GalleryItem, max = Infinity): string {
  const list = allWidths(item).filter((w) => w <= max);
  return (list.length ? list : [allWidths(item)[0]!]).map((w) => `${urlAt(item, w)} ${w}w`).join(", ");
}

/** The `src` for browsers without srcset: a mid-size copy, never the display file. */
function fallbackSrc(item: GalleryItem): string {
  return urlAt(item, [...item.widths].reverse().find((x) => x <= 640) ?? item.widths[0] ?? item.width);
}

/** The width nearest (on a log scale) to 2x a CSS width: the phone cap. */
export function phoneCap(item: GalleryItem, cssWidth: number): number {
  return nearest(item, 2 * cssWidth);
}

/** Viewport the phone caps are sized for. */
const PHONE_W = 390;
const PHONE_H = 844;
/** Below this the collage is its narrow (phone) layout. */
export const PHONE_COLLAGE = "(max-width: 659px)";
/** Below this the piece page uses its phone layout (gallery.css). */
export const PHONE_PIECE = "(max-width: 699px)";

const k4 = (n: number): string => n.toFixed(4);
const vw2 = (n: number): string => `${+n.toFixed(2)}vw`;

/** Image width as a share of the collage box in one layout (frame less its mat). */
const share = (boxes: Readonly<Record<LayoutName, Box>>, name: LayoutName): number => (boxes[name].w - 2 * LAYOUTS[name].mat) / 100;

function narrowSizes(boxes: Readonly<Record<LayoutName, Box>>): string {
  const n = share(boxes, "narrow");
  return [`(min-width: 400px) ${vw2(91 * n)}`, `calc((100vw - 36px) * ${k4(n)})`].join(", ");
}

/** `sizes` for a collage tile across all three layouts. */
export function collageSizes(boxes: Readonly<Record<LayoutName, Box>>): string {
  const w = share(boxes, "wide");
  const m = share(boxes, "mid");
  return [
    `(min-width: 1296px) ${Math.ceil(1200 * w)}px`,
    `(min-width: 1096px) calc((100vw - 96px) * ${k4(w)})`,
    `(min-width: 660px) ${vw2(91 * m)}`,
    narrowSizes(boxes),
  ].join(", ");
}

/**
 * `sizes` for the big image on a piece page (.piece__img in gallery.css): as
 * wide as the wrap less the frame (12px padding + 3px border a side), and no
 * taller than the viewport less the page chrome.
 */
export function pieceSizes(item: GalleryItem, phone: boolean): string {
  const a = k4(item.width / item.height);
  const tall = item.height > item.width ? 320 : 330;
  // The height cap, but never below the 220px min-height floor.
  const byHeight = (chrome: number) => `max(calc((100vh - ${chrome}px) * ${a}), ${Math.round((220 * item.width) / item.height)}px)`;
  const small = [`(min-width: 400px) min(calc(91vw - 30px), ${byHeight(260)})`, `min(calc(100vw - 66px), ${byHeight(260)})`];
  if (phone) return small.join(", ");
  return [
    `(min-width: 1296px) min(1170px, ${byHeight(tall)})`,
    `(min-width: 1067px) min(calc(100vw - 126px), ${byHeight(tall)})`,
    `(min-width: 700px) min(calc(91vw - 30px), ${byHeight(tall)})`,
    ...small,
  ].join(", ");
}

/** Width of the piece-page image on the reference phone (see pieceSizes). */
const piecePhoneWidth = (item: GalleryItem): number => Math.min(PHONE_W - 66, ((PHONE_H - 260) * item.width) / item.height);

/**
 * A piece page is often the first page a phone opens (a shared link), and its
 * big image is what the visitor waits for. On a slow phone line (Slow 4G,
 * ~200 KB/s) the image has to be about 200 KB to be on screen by 2.5 s, so
 * the phone cap here is the sharpest copy between 1.5x and 2x that fits that
 * budget, or the 1.5x copy when none does (the grainiest pieces).
 */
export const PIECE_PHONE_BUDGET = 200 * 1024;

function nearest(item: GalleryItem, want: number): number {
  return allWidths(item).reduce((best, w) => (Math.abs(Math.log(w / want)) < Math.abs(Math.log(best / want)) ? w : best));
}

export function piecePhoneCap(item: GalleryItem): number {
  const css = piecePhoneWidth(item);
  const top = nearest(item, 2 * css);
  const floor = nearest(item, 1.5 * css);
  if (!item.bytes) return top;
  const fits = allWidths(item).filter((w) => w >= floor && w <= top && (item.bytes!.get(w) ?? Infinity) <= PIECE_PHONE_BUDGET);
  return fits.length ? fits[fits.length - 1]! : floor;
}

/** Width of a collage tile's image on the reference phone (see narrowSizes). */
const tilePhoneWidth = (boxes: Readonly<Record<LayoutName, Box>>): number => (PHONE_W - 36) * share(boxes, "narrow");

// Collage tiles other than the lead one are deferred: their sources sit in
// data-srcset / data-src and motion/defer.ts moves them into srcset / src once
// the lead image has landed and the tile is within half a screen of view. A
// phone's first load is then the first screen, not the whole wall (native lazy
// loading fetches ~1250px ahead, which on a phone is every tile). <noscript>
// carries the plain image, and the head script (layout.ts) releases them if
// main.ts never runs.

function tileImage(p: Placed, lead: boolean): string {
  const { item } = p;
  const cap = phoneCap(item, tilePhoneWidth(p.boxes));
  const set = (attr: string) => (lead ? attr : `data-${attr}`);
  const dims = `width="${item.width}" height="${item.height}"`;
  const picture =
    `<picture class="art__pic"${lead ? "" : " data-defer"}>` +
    `<source media="${PHONE_COLLAGE}" ${set("srcset")}="${artSrcset(item, cap)}" sizes="${narrowSizes(p.boxes)}" />` +
    `<img class="art__img" ${set("src")}="${fallbackSrc(item)}" ${set("srcset")}="${artSrcset(item)}" sizes="${collageSizes(p.boxes)}" ` +
    `${dims} alt="${esc(item.alt)}" ` +
    (lead ? `loading="eager" fetchpriority="high" ` : "") +
    `decoding="async" style="view-transition-name:art-${item.id};aspect-ratio:${item.width}/${item.height}" /></picture>`;
  if (lead) return picture;
  return (
    picture +
    `<noscript><picture class="art__pic">` +
    `<source media="${PHONE_COLLAGE}" srcset="${artSrcset(item, cap)}" sizes="${narrowSizes(p.boxes)}" />` +
    `<img class="art__img" src="${fallbackSrc(item)}" srcset="${artSrcset(item)}" sizes="${collageSizes(p.boxes)}" ` +
    `${dims} alt="${esc(item.alt)}" loading="lazy" decoding="async" /></picture></noscript>`
  );
}

function artTile(p: Placed, total: number): string {
  const { item } = p;
  const portrait = item.height > item.width;
  // Only the lead piece (top left in every layout, the LCP image) loads at
  // once and first.
  return (
    `<li class="art ${portrait ? "art--p" : "art--l"} art--${p.tone}" style="${boxVars(p.boxes)};--i:${p.at % 6}" data-reveal="pop">` +
    `<a class="art__link" href="/gallery/${item.id}/" aria-label="Open piece ${item.id} of ${pad2(total)}" data-piece="${item.id}" ` +
    `data-src="${item.src}" data-srcset="${artSrcset(item)}" data-w="${item.width}" data-h="${item.height}">` +
    tileImage(p, p.at === 0) +
    `<span class="art__tape art__tape--${TAPES[p.at % TAPES.length]}" aria-hidden="true"></span>` +
    `<span class="art__open" aria-hidden="true">${icon("plus", 3)}</span>` +
    `</a></li>`
  );
}

/** The click-in viewer. A closed <dialog> never renders, so without JS it is inert. */
function viewer(): string {
  return (
    `<dialog class="viewer" data-viewer aria-label="Piece viewer">` +
    `<div class="viewer__bg" aria-hidden="true">` +
    `<span class="viewer__blk viewer__blk--a"></span><span class="viewer__blk viewer__blk--b"></span>` +
    `<span class="viewer__blk viewer__blk--c"></span><span class="viewer__blk viewer__blk--d"></span></div>` +
    `<div class="viewer__stage" data-viewer-stage>` +
    `<figure class="viewer__frame" data-viewer-frame>` +
    `<img class="viewer__lo" alt="" data-viewer-lo />` +
    `<img class="viewer__hi" alt="" data-viewer-hi />` +
    `</figure></div>` +
    `<div class="viewer__bar">` +
    `<p class="viewer__count counter" data-viewer-count aria-live="polite"></p>` +
    `<button class="btn btn--paper btn--m btn--icon viewer__close" type="button" data-viewer-close aria-label="Close" autofocus>` +
    `<span class="btn__ic">${icon("close", 3)}</span></button>` +
    `</div>` +
    `<button class="btn btn--paper btn--m btn--icon viewer__nav viewer__nav--prev" type="button" data-viewer-go="-1" aria-label="Previous piece">` +
    `<span class="btn__ic">${icon("arrow-left", 3)}</span></button>` +
    `<button class="btn btn--paper btn--m btn--icon viewer__nav viewer__nav--next" type="button" data-viewer-go="1" aria-label="Next piece">` +
    `<span class="btn__ic">${icon("arrow", 3)}</span></button>` +
    `</dialog>`
  );
}

export function galleryPage(content: SiteContent): string {
  const g = content.gallery;
  const { placed, heights } = galleryOrder(g);
  return (
    `<div class="page page--gallery">` +
    floats("gallery", { far: 2, mid: 3, near: 2, stickers: ["frame", "sparkle"] }) +
    `<div class="wrap">` +
    pageHead({ kicker: "gallery", title: "Gallery", tone: "paper", aside: `${pad2(g.length)} pieces`, stickers: ["frame", "sparkle"] }) +
    `<div class="collage-box">` +
    `<ul class="collage" data-collage style="--hw:${heights.wide};--hm:${heights.mid};--hn:${heights.narrow}">` +
    placed.map((p) => artTile(p, g.length)).join("") +
    `</ul></div>` +
    `</div>` +
    viewer() +
    `</div>`
  );
}

/** One piece at its own URL: shareable, readable without JS. */
export function piecePage(content: SiteContent, index: number): string {
  const g = content.gallery;
  const { placed } = galleryOrder(g);
  const at = placed.findIndex((p) => p.item === g[index]);
  const here = placed[at]!;
  const prev = placed[(at - 1 + placed.length) % placed.length]!;
  const next = placed[(at + 1) % placed.length]!;
  const item = here.item;
  const strip = placed
    .map((p) => {
      const current = p.at === at;
      return (
        `<li><a class="film__link${current ? " is-here" : ""}" href="/gallery/${p.item.id}/"${current ? ' aria-current="page"' : ""} ` +
        `aria-label="Piece ${p.item.id} of ${pad2(placed.length)}">` +
        // Thumbnails are 42px tall: the smallest copy is already 2x or more.
        // Deferred (motion/defer.ts) until the big image has landed, so they
        // don't race it.
        `<img data-defer="lead" data-src="${thumb(p.item)}" width="${p.item.width}" height="${p.item.height}" alt="" decoding="async" style="aspect-ratio:${p.item.width}/${p.item.height}" />` +
        `<noscript><img src="${thumb(p.item)}" width="${p.item.width}" height="${p.item.height}" alt="" loading="lazy" decoding="async" /></noscript></a></li>`
      );
    })
    .join("");
  return (
    `<div class="page page--piece">` +
    `<div class="wrap">` +
    `<nav class="piece__top" aria-label="Gallery">` +
    button({ href: "/gallery/", label: "Gallery", icon: "arrow-left", iconFirst: true, size: "s" }) +
    // The piece's catalogue number (its URL id); the arrows walk the wall.
    counter(Number(item.id), g.length, "piece__count") +
    `</nav>` +
    `<h1 class="sr">Gallery, piece ${item.id} of ${pad2(g.length)}</h1>` +
    `<figure class="piece ${item.height > item.width ? "piece--p" : "piece--l"} piece--${here.tone}" data-reveal="pop-block">` +
    `<div class="piece__frame">` +
    // The smallest copy paints first as the image's own background, so the
    // piece is on screen within a moment even on a slow phone; the sharp copy
    // then draws over it.
    `<picture class="piece__pic">` +
    `<source media="${PHONE_PIECE}" srcset="${artSrcset(item, piecePhoneCap(item))}" sizes="${pieceSizes(item, true)}" />` +
    `<img class="piece__img" src="${fallbackSrc(item)}" srcset="${artSrcset(item)}" sizes="${pieceSizes(item, false)}" ` +
    `width="${item.width}" height="${item.height}" alt="${esc(item.alt)}" fetchpriority="high" decoding="async" ` +
    `style="view-transition-name:art-${item.id};--ar:${k4(item.width / item.height)};background-image:url(${thumb(item)})" /></picture>` +
    `<span class="art__tape art__tape--tc" aria-hidden="true"></span>` +
    `</div></figure>` +
    `<nav class="piece__pager" aria-label="More pieces">` +
    `<a class="btn btn--paper btn--m btn--icon" href="/gallery/${prev.item.id}/" rel="prev" data-key="ArrowLeft" aria-label="Previous piece">` +
    `<span class="btn__ic">${icon("arrow-left", 3)}</span></a>` +
    `<ul class="film">${strip}</ul>` +
    `<a class="btn btn--paper btn--m btn--icon" href="/gallery/${next.item.id}/" rel="next" data-key="ArrowRight" aria-label="Next piece">` +
    `<span class="btn__ic">${icon("arrow", 3)}</span></a>` +
    `</nav>` +
    `</div></div>`
  );
}

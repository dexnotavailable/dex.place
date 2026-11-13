// The gallery: the collage (a home-page section and /gallery/) and
// /gallery/<id>/ (one piece).
//
// Dex: "dont name them, frame them nicely" and (2026-09-29) "arranged more
// close in a grid like a collage with adjustment for different aspect ratios,
// stuff shrink and grow as u hover". So: no visible titles (alt text stays),
// every piece in a sharp 2px frame, packed into justified rows with a 3px gap
// (src/site/collage.ts, build time). The hover field and the click-in viewer
// are progressive (motion/gallery.ts); without JS every piece is a plain link
// to its own page. Styles: styles/gallery.css.
//
// Display only: Dex's art never appears outside the gallery and its piece pages.

import { collage, imageWidth, rowChrome, type LayoutName, type Slot } from "../collage.ts";
import { floats } from "./floats.ts";
import { button, counter, icon, pageHead, sectionHead } from "./glyphs.ts";
import { esc, pad2 } from "./html.ts";
import type { GalleryItem, SiteContent } from "./types.ts";

const LAYOUT_KEYS: Readonly<Record<LayoutName, string>> = { wide: "w", mid: "m", narrow: "n" };

const orderCache = new WeakMap<readonly GalleryItem[], { placed: Placed[] }>();

export interface Placed {
  readonly item: GalleryItem;
  /** Position in the reading order (0-based). */
  readonly at: number;
  readonly slots: Readonly<Record<LayoutName, Slot>>;
}

/**
 * The gallery in reading order (row by row, left to right; the same order at
 * every width). The collage, the viewer and the piece pages all step through
 * pieces in this order, so "next" always means the same thing.
 */
export function galleryOrder(g: readonly GalleryItem[]): { placed: Placed[] } {
  // Every piece page asks for the same order; compute it once per content load.
  const cached = orderCache.get(g);
  if (cached) return cached;
  const c = collage(g);
  const placed = c.order.map((index, at) => ({
    item: g[index]!,
    at,
    slots: { wide: c.layouts.wide.slots[at]!, mid: c.layouts.mid.slots[at]!, narrow: c.layouts.narrow.slots[at]! },
  }));
  const result = { placed };
  orderCache.set(g, result);
  return result;
}

function slotVars(slots: Readonly<Record<LayoutName, Slot>>): string {
  return (Object.keys(LAYOUT_KEYS) as LayoutName[])
    .map((name) => `--fw${LAYOUT_KEYS[name]}:${slots[name].share.toFixed(5)};--gn${LAYOUT_KEYS[name]}:${slots[name].gaps}`)
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
// at 660px and 1096px of viewport. An image is its share of its row after the
// row's 3px gaps and every piece's 2px frame edges (collage.ts imageWidth).
//
// Phones get a cap: browsers take the smallest copy at or above the screen's
// full density, so a 3x phone would pull the 960/1280 copies (lossless, up to
// ~0.9 MB each) for tiles about 340 CSS px wide. Below the phone breakpoints
// the srcset stops at the copy nearest 2x of the image's width on a 390px
// phone: crisp at that size, a fraction of the bytes, and the full file is one
// tap away in the viewer.
//
// Tablets get one too. A 2x screen in the mid layout (660-1095px) would pull
// the 960/1280 copies for tiles 340-560 CSS px wide (13-15 s to the largest
// paint on a slow line), so there the srcset stops at the largest copy within
// 1.5x of the image's width on an 820px tablet, and never under 1x there. The
// cap sits behind `min-resolution: 1.5dppx`: a 1x window at those widths
// (a narrow desktop browser) keeps picking from every copy, as before.

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
/** Viewport width the tablet caps are sized for (iPad Air portrait; 768px tablets sit just under it). */
const TABLET_W = 820;
/** The collage's mid layout (container 600-999px, gallery.css) at any density. */
export const MID_COLLAGE = "(min-width: 660px) and (max-width: 1095px)";
/** The mid layout on a 1.5x-or-denser screen: a tablet. Its tiles are capped (tabletCap). */
export const TABLET_COLLAGE = `${MID_COLLAGE} and (min-resolution: 1.5dppx)`;
/** The collage's wide layout. */
export const WIDE_COLLAGE = "(min-width: 1096px)";

const k4 = (n: number): string => n.toFixed(4);

const px = (n: number): string => `${Math.ceil(n)}px`;
/** calc() for an image in a slot when the collage box is `box` (a CSS length). */
const calcFor = (slot: Slot, box: string): string =>
  `calc((${box} - ${rowChrome(slot)}px) * ${k4(slot.share)})`;

function narrowSizes(slots: Readonly<Record<LayoutName, Slot>>): string {
  return [`(min-width: 400px) ${calcFor(slots.narrow, "91vw")}`, calcFor(slots.narrow, "100vw - 36px")].join(", ");
}

/** `sizes` in the mid layout. */
const midSizes = (slots: Readonly<Record<LayoutName, Slot>>): string => calcFor(slots.mid, "91vw");

/** `sizes` in the wide layout. */
function wideSizes(slots: Readonly<Record<LayoutName, Slot>>): string {
  return [`(min-width: 1296px) ${px(imageWidth(slots.wide, 1200))}`, calcFor(slots.wide, "100vw - 96px")].join(", ");
}

/** `sizes` for a collage tile across all three layouts. */
export function collageSizes(slots: Readonly<Record<LayoutName, Slot>>): string {
  return [
    `(min-width: 1296px) ${px(imageWidth(slots.wide, 1200))}`,
    `(min-width: 1096px) ${calcFor(slots.wide, "100vw - 96px")}`,
    `(min-width: 660px) ${midSizes(slots)}`,
    narrowSizes(slots),
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
 * budget, or the 1.5x copy when none does (the grainiest pieces). The lead
 * tiles on /gallery/ share the same budget between them (leadPhoneCaps).
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
const tilePhoneWidth = (slots: Readonly<Record<LayoutName, Slot>>): number => imageWidth(slots.narrow, PHONE_W - 36);
/** Width of a collage tile's image on the reference tablet (the mid layout's 91vw box). */
const tileTabletWidth = (slots: Readonly<Record<LayoutName, Slot>>): number => imageWidth(slots.mid, 0.91 * TABLET_W);

/**
 * The tablet cap for an image `cssWidth` wide on the reference tablet: the
 * largest copy within 1.5x of that width, but never a copy under 1x of it.
 */
export function tabletCap(item: GalleryItem, cssWidth: number): number {
  const all = allWidths(item);
  const oneX = all.find((w) => w >= cssWidth) ?? item.width;
  const within = all.filter((w) => w <= 1.5 * cssWidth);
  return Math.max(oneX, within[within.length - 1] ?? all[0]!);
}

// ------------------------------------------------------- the lead tiles
//
// On /gallery/ the collage is the page's main image, so its largest tiles on
// the first screen load at once, with high priority, straight from the markup
// (the browser's preload scanner starts them before the stylesheet is in).
// Which tiles those are depends on the layout, so each layout gets its own:
// a <picture> has one <source> per layout, and a tile's source is live (its
// srcset in place) only in the layouts where it leads. Elsewhere its sources
// wait in data-srcset like any deferred tile, so a tile that leads on a phone
// never costs a tablet a byte on its first load, and the other way round.
// - Phone (narrow): the lead (first in reading order) and its twin, the next
//   piece, the same shape, full width in the next row. The two are one size,
//   and which measures a pixel larger depends only on where their edges snap,
//   so a twin left to load after the lead became the page's largest paint
//   whenever it landed (6 s on a slow phone line). The pair loads together.
// - Tablet (mid): the largest picture in the first two rows, and any within
//   3% of it (today the big second-row piece, 03, which the phone pair's 960
//   copies used to hold back to 13-15 s).
// - Desktop (wide): the phone's lead tiles, as before (the first row's pair).
// Each device class's lead tiles share one byte budget on its first load
// (PIECE_PHONE_BUDGET, 200 KB: about 2.5 s on a slow line), on /gallery/ and
// in the home section alike, so both pages share the same copies. Any larger
// tile the markup did not pick (a wider tablet, a page opened scrolled) is
// promoted when the stylesheet is in (render/layout.ts ARRIVAL).

/** Area of a piece's picture in the phone layout on the reference phone. */
function phoneArea(p: Placed): number {
  const w = tilePhoneWidth(p.slots);
  return (w * w * p.item.height) / p.item.width;
}

/** Area of a piece's picture in the mid layout on the reference tablet. */
function tabletArea(p: Placed): number {
  const w = tileTabletWidth(p.slots);
  return (w * w * p.item.height) / p.item.width;
}

/**
 * The tiles that load at once on a phone: the lead (first in reading order)
 * and every piece in the phone layout's first two rows that is at least as
 * large there as the lead, within 3% (a pixel's snapping either way).
 */
export function leadTiles(placed: readonly Placed[]): Placed[] {
  const lead = placed[0];
  if (!lead) return [];
  return placed.filter((p) => p === lead || (p.slots.narrow.row <= 1 && phoneArea(p) >= 0.97 * phoneArea(lead)));
}

/**
 * The tiles that load at once on a tablet: the largest picture in the mid
 * layout's first two rows (on screen on a 768x1024 or 820x1180 tablet) and
 * every piece there within 3% of it.
 */
export function tabletLeadTiles(placed: readonly Placed[]): Placed[] {
  const top = placed.filter((p) => p.slots.mid.row <= 1);
  const most = Math.max(0, ...top.map(tabletArea));
  return top.filter((p) => tabletArea(p) >= 0.97 * most);
}

/** A piece's copies from `top` down to `floor` (or just `top` when the floor is above it), sharpest first. */
const ladder = (item: GalleryItem, top: number, floor: number): number[] =>
  allWidths(item).filter((w) => w >= Math.min(floor, top) && w <= top).reverse();

/**
 * Caps for tiles that share the line on a first load: every tile steps down
 * its ladder one copy at a time, all together, until the lot fits
 * PIECE_PHONE_BUDGET, or every tile is on its last rung.
 */
function sharedCaps(tiles: readonly Placed[], ladders: readonly number[][]): Map<Placed, number> {
  const steps = Math.max(1, ...ladders.map((l) => l.length));
  for (let k = 0; k < steps; k++) {
    const caps = ladders.map((l) => l[Math.min(k, l.length - 1)]!);
    const bytes = tiles.reduce((sum, p, i) => sum + (p.item.bytes?.get(caps[i]!) ?? 0), 0);
    if (bytes <= PIECE_PHONE_BUDGET || k === steps - 1) return new Map(tiles.map((p, i) => [p, caps[i]!]));
  }
  return new Map();
}

/**
 * Phone caps for the phone's lead tiles: the sharpest copies between 1.5x
 * and 2x of each tile's width that together fit the budget, or the 1.5x
 * copies when nothing sharper fits. A lone lead keeps its plain cap
 * (phoneCap) whenever that fits.
 */
export function leadPhoneCaps(tiles: readonly Placed[]): Map<Placed, number> {
  return sharedCaps(
    tiles,
    tiles.map((p) => {
      const css = tilePhoneWidth(p.slots);
      return ladder(p.item, phoneCap(p.item, css), nearest(p.item, 1.5 * css));
    }),
  );
}

/**
 * Tablet caps for the tablet's lead tiles: the sharpest copies between 1x
 * and the tablet cap (1.5x) of each tile's width on the reference tablet
 * that together fit the budget, or the 1x copies when nothing sharper fits.
 * The floor is the first copy at or above 1x, never one just under it: a
 * browser scores an upscaled image by its own pixels for Largest Contentful
 * Paint, so a lead drawn from fewer pixels than it covers would lose the
 * largest paint to the next big tile to land (a slightly smaller 1.2x piece
 * on an 820px tablet), and it looks soft at 2x besides.
 */
export function leadTabletCaps(tiles: readonly Placed[]): Map<Placed, number> {
  return sharedCaps(
    tiles,
    tiles.map((p) => {
      const css = tileTabletWidth(p.slots);
      return ladder(p.item, tabletCap(p.item, css), allWidths(p.item).find((w) => w >= css) ?? p.item.width);
    }),
  );
}

// Collage tiles that do not lead are deferred: their sources sit in
// data-srcset / data-src and motion/defer.ts moves them into srcset / src once
// the lead images have landed and the tile is within half a screen of view. A
// phone's first load is then the first screen, not the whole wall (native lazy
// loading fetches ~1250px ahead, which on a phone is every tile). <noscript>
// carries the plain image, and the head script (layout.ts) releases them if
// main.ts never runs. A tile that leads in some layouts only (the lead tiles)
// is deferred as a whole too, with only those layouts' sources live.

/** The layouts a tile loads at once in (the lead tiles on /gallery/). */
interface Live {
  readonly phone: boolean;
  readonly tablet: boolean;
  readonly wide: boolean;
}

const NONE: Live = { phone: false, tablet: false, wide: false };
const ALL: Live = { phone: true, tablet: true, wide: true };

/** A tile's phone and tablet caps. */
interface Caps {
  readonly phone: number;
  readonly tablet: number;
}

/**
 * A tile's <source>s and <img>, in selection order: phone, tablet, then
 * the mid (1x) and wide layouts where their liveness differs from the <img>
 * (which is live only when the tile leads everywhere); elsewhere the <img>
 * covers them with the same srcset.
 */
function tileSources(p: Placed, caps: Caps, live: Live, tail: string): string {
  const { item, slots } = p;
  const img = live.phone && live.tablet && live.wide;
  const at = (attr: string, on: boolean) => (on ? attr : `data-${attr}`);
  const source = (media: string, srcset: string, sizes: string, on: boolean) =>
    `<source media="${media}" ${at("srcset", on)}="${srcset}" sizes="${sizes}" />`;
  return (
    source(PHONE_COLLAGE, artSrcset(item, caps.phone), narrowSizes(slots), live.phone) +
    source(TABLET_COLLAGE, artSrcset(item, caps.tablet), midSizes(slots), live.tablet) +
    (live.tablet !== img ? source(MID_COLLAGE, artSrcset(item), midSizes(slots), live.tablet) : "") +
    (live.wide !== img ? source(WIDE_COLLAGE, artSrcset(item), wideSizes(slots), live.wide) : "") +
    `<img class="art__img" ${at("src", img)}="${fallbackSrc(item)}" ${at("srcset", img)}="${artSrcset(item)}" sizes="${collageSizes(slots)}" ` +
    `width="${item.width}" height="${item.height}" alt="${esc(item.alt)}" ${tail}/>`
  );
}

/** A tile's picture. `caps`: its phone and tablet caps; `live`: the layouts it loads at once in. */
function tileImage(p: Placed, caps: Caps, live: Live): string {
  const { item } = p;
  const lead = live.phone || live.tablet || live.wide;
  const all = live.phone && live.tablet && live.wide;
  const picture =
    `<picture class="art__pic"${all ? "" : " data-defer"}>` +
    tileSources(
      p,
      caps,
      live,
      (lead ? `loading="eager" fetchpriority="high" ` : "") +
        `decoding="async" style="view-transition-name:art-${item.id};aspect-ratio:${item.width}/${item.height}" `,
    ) +
    `</picture>`;
  if (all) return picture;
  return picture + `<noscript><picture class="art__pic">${tileSources(p, caps, ALL, `loading="lazy" decoding="async" `)}</picture></noscript>`;
}

function artTile(p: Placed, total: number, caps: Caps, live: Live): string {
  const { item } = p;
  const portrait = item.height > item.width;
  return (
    `<li class="art ${portrait ? "art--p" : "art--l"}" style="${slotVars(p.slots)};--ar:${k4(item.width / item.height)}">` +
    `<a class="art__link" href="/gallery/${item.id}/" aria-label="Open piece ${pad2(p.at + 1)} of ${pad2(total)}" data-piece="${item.id}" ` +
    `data-src="${item.src}" data-srcset="${artSrcset(item)}" data-w="${item.width}" data-h="${item.height}">` +
    tileImage(p, caps, live) +
    `<span class="art__open" aria-hidden="true">${icon("plus", 2)}</span>` +
    `</a></li>`
  );
}

/** The click-in viewer. A closed <dialog> never renders, so without JS it is inert. */
function viewer(): string {
  return (
    `<dialog class="viewer" data-viewer aria-label="Piece viewer">` +
    `<div class="viewer__bg" aria-hidden="true"></div>` +
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

/** Each layout's lead tiles and every tile's caps. */
interface LeadPlan {
  readonly phone: readonly Placed[];
  readonly tablet: readonly Placed[];
  caps(p: Placed): Caps;
}

/**
 * The lead tiles and their shared budgets, the same on /gallery/ and in the
 * home section: arriving at /#gallery puts the same tiles on a phone's or a
 * tablet's first screen (ARRIVAL), and the two pages then share the same
 * copies.
 */
function leadPlan(placed: readonly Placed[]): LeadPlan {
  const phone = leadTiles(placed);
  const tablet = tabletLeadTiles(placed);
  const phoneCaps = leadPhoneCaps(phone);
  const tabletCaps = leadTabletCaps(tablet);
  return {
    phone,
    tablet,
    caps: (p) => ({
      phone: phoneCaps.get(p) ?? phoneCap(p.item, tilePhoneWidth(p.slots)),
      tablet: tabletCaps.get(p) ?? tabletCap(p.item, tileTabletWidth(p.slots)),
    }),
  };
}

// ------------------------------------------------ arriving at /#gallery
//
// A Gallery link from any page opens the home page at its gallery section.
// There every tile is deferred, and ARRIVAL (render/layout.ts) can only start
// the first screen's tiles once the whole body is parsed and laid out, over a
// second into a slow line. A phone's lead (77 KB) landed at 2.2-2.6 s from
// there, a tablet's (03's 640 copy, 262 KB) at 2.7-3.3 s.
// So the home page's <head> ends with a script that, only when the address
// ends in #gallery, adds a preload for each layout's lead on that screen. It
// runs as soon as the stylesheet is in, before the body is even parsed. (Put
// ahead of the stylesheet it won a tablet nothing, the line being full from
// the start either way, and cost every screen its first paint: 1.5-2.1 s
// against 1.3-1.8 s.) It starts:
// - phone: the first tile, atop the section on every phone (its twin sits
//   below the fold on most, and ARRIVAL still starts it when it is in view);
// - tablet: the tablet lead tiles (tabletLeadTiles), with their shared caps;
// - desktop: the first row's pair (the phone's lead tiles, as on /gallery/).
// Each preload carries its tile's <source> media, srcset and sizes, so the
// browser picks the very copy the tile will pick, and the tile reuses it.
// A 1x window in the mid layout (a narrow desktop browser) gets none: its
// lead is a 960 copy that no head start brings under 2.5 s, and it would hold
// back everything else.

/**
 * The script that closes the home page's <head> (see above): preloads each layout's
 * first-screen lead when the page opens at #gallery. Empty without pieces.
 */
export function galleryArrival(content: SiteContent): string {
  const { placed } = galleryOrder(content.gallery);
  const first = placed[0];
  if (!first) return "";
  const plan = leadPlan(placed);
  const links: [string, string, string][] = [
    [PHONE_COLLAGE, artSrcset(first.item, plan.caps(first).phone), narrowSizes(first.slots)],
    ...plan.tablet.map((p): [string, string, string] => [TABLET_COLLAGE, artSrcset(p.item, plan.caps(p).tablet), midSizes(p.slots)]),
    ...plan.phone.map((p): [string, string, string] => [WIDE_COLLAGE, artSrcset(p.item), wideSizes(p.slots)]),
  ];
  // JSON is valid JS; "<" is escaped so no value can close the <script>.
  const data = JSON.stringify(links).replace(/</g, "\\u003c");
  return (
    `<script>if(location.hash==="#gallery")${data}.forEach(function(p){var l=document.createElement("link");` +
    `l.rel="preload";l.as="image";l.media=p[0];l.setAttribute("imagesrcset",p[1]);l.setAttribute("imagesizes",p[2]);` +
    `l.setAttribute("fetchpriority","high");document.head.appendChild(l)})</script>`
  );
}

/**
 * The collage and its viewer. `lead`: each layout's lead tiles (leadTiles,
 * tabletLeadTiles) load at once with high priority (only where the collage is
 * the page's main image, /gallery/); otherwise every tile waits for its turn.
 */
export function collageBlock(content: SiteContent, lead: boolean): string {
  const g = content.gallery;
  if (!g.length) return `<p class="empty">Nothing here yet.</p>`;
  const { placed } = galleryOrder(g);
  const plan = leadPlan(placed);
  const tile = (p: Placed): string => {
    // Desktop keeps the phone's lead tiles (the first row's pair there).
    const live: Live = lead ? { phone: plan.phone.includes(p), tablet: plan.tablet.includes(p), wide: plan.phone.includes(p) } : NONE;
    return artTile(p, g.length, plan.caps(p), live);
  };
  return (
    `<div class="collage-box">` +
    `<ul class="collage" data-collage>` +
    placed.map(tile).join("") +
    `</ul></div>` +
    viewer()
  );
}

/** The gallery as a home-page section (h2), all tiles deferred. */
export function gallerySection(content: SiteContent): string {
  const n = content.gallery.length;
  return (
    `<section class="sec sec--gallery" id="gallery" aria-labelledby="gallery-title">` +
    floats("home-gallery", { tone: "yellow", count: 2, glyph: "sparkle" }) +
    `<div class="wrap">` +
    sectionHead({ id: "gallery-title", kicker: "gallery", title: "Gallery", tone: "yellow", icon: "frame", aside: `${pad2(n)} pieces`, more: { href: "/gallery/", label: "Gallery page" } }) +
    collageBlock(content, false) +
    `</div></section>`
  );
}

export function galleryPage(content: SiteContent): string {
  const g = content.gallery;
  return (
    `<div class="page page--gallery">` +
    floats("gallery", { tone: "yellow", count: 2, glyph: "sparkle" }) +
    `<div class="wrap">` +
    pageHead({ kicker: "gallery", title: "Gallery", tone: "yellow", icon: "frame", aside: `${pad2(g.length)} pieces` }) +
    collageBlock(content, true) +
    `</div></div>`
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
        `aria-label="Piece ${pad2(p.at + 1)} of ${pad2(placed.length)}">` +
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
    // The piece's place on the wall (reading order), like the viewer's
    // counter; the arrows walk the wall in the same order. The URL keeps the
    // catalogue id, so shared links never move.
    counter(at + 1, g.length, "piece__count") +
    `</nav>` +
    `<h1 class="sr">Gallery, piece ${pad2(at + 1)} of ${pad2(g.length)}</h1>` +
    `<figure class="piece ${item.height > item.width ? "piece--p" : "piece--l"}" data-reveal="pop-block">` +
    `<div class="piece__frame">` +
    // The smallest copy paints first as the image's own background, so the
    // piece is on screen within a moment even on a slow phone; the sharp copy
    // then draws over it.
    `<picture class="piece__pic">` +
    `<source media="${PHONE_PIECE}" srcset="${artSrcset(item, piecePhoneCap(item))}" sizes="${pieceSizes(item, true)}" />` +
    `<img class="piece__img" src="${fallbackSrc(item)}" srcset="${artSrcset(item)}" sizes="${pieceSizes(item, false)}" ` +
    `width="${item.width}" height="${item.height}" alt="${esc(item.alt)}" fetchpriority="high" decoding="async" ` +
    `style="view-transition-name:art-${item.id};--ar:${k4(item.width / item.height)};background-image:url(${thumb(item)})" /></picture>` +
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

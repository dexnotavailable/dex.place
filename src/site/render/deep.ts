// The deep pages' head (lane P, 10-19): a doc, a post, the 404. The home page's kit carried onto a reading page:
// a kicker line (a tone tile, `//`, the way back as breadcrumbs, a rule, a real count), the title in the pixel face
// with its tone bar, a short line, and beside them a window into the world (Dex 10-18: "punch in some windows into
// the world, each window showing something different"; motion/windows.ts paints any [data-window], on approach).
// On phones the window opens above the head as a band, as the home page's windows do. Styles: styles/pages-v2.css.

import type { Tone } from "../data/projects.ts";
import type { IconName } from "../pixels.ts";
import { hanko, tile } from "./glyphs.ts";
import { cx, esc } from "./html.ts";

/** The places a window can look onto (motion/windows.ts SCENES). */
export type Place = "sky" | "palace" | "isles" | "lake" | "pine" | "door";

/**
 * Which place each kind of deep page looks onto: a doc looks onto the same place as /docs/ (Kagami's lake), a post
 * onto /blog/'s (the pine at dusk), the 404 onto the high sky where the Walker wades (render/layout.ts PAGE_SCENES).
 */
export const DEEP_PLACES = { doc: "lake", post: "pine", notfound: "sky" } as const satisfies Record<string, Place>;

export interface Crumb {
  readonly label: string;
  /** Omitted for a crumb that is not a page of its own (a docs group). */
  readonly href?: string;
}

export interface DeepHeadOptions {
  tone: Tone;
  icon: IconName;
  /** The way back up, shown as the kicker (e.g. Docs / dexClient). The page itself is the title. */
  crumbs: readonly Crumb[];
  /** A real count or fact on the rule's right (reading time, a position). */
  aside?: string;
  /** Escaped title. */
  title: string;
  /** "px" (DotGothic16, long titles) or "display" (Tesu Display, short ones). */
  face?: "px" | "display";
  /** Markup above the title (a date row, tags). */
  before?: string;
  /** One plain line under the title. */
  sum?: string;
  /** Markup after the line (keys). */
  after?: string;
  place: Place;
  /** Hanko on the window's corner (one mascot to a page). */
  withHanko?: boolean;
  /** The page puts the window beside its whole body instead (deepWindow): the head is text only. */
  noWindow?: boolean;
}

/** The kicker: tone tile, `//`, the breadcrumbs, a rule, the aside. */
function kicker(o: DeepHeadOptions): string {
  const parts = o.crumbs.map((c) => (c.href ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`));
  return (
    `<div class="dh__kicker">` +
    tile(o.icon, o.tone, "s") +
    `<span class="dh__slash" aria-hidden="true">//</span>` +
    `<nav class="dh__crumbs" aria-label="Breadcrumb">${parts.join(`<span class="dh__sep" aria-hidden="true">/</span>`)}</nav>` +
    `<span class="dh__rule" aria-hidden="true"></span>` +
    (o.aside ? `<span class="dh__aside">${esc(o.aside)}</span>` : "") +
    `</div>`
  );
}

export function deepHead(o: DeepHeadOptions): string {
  return (
    `<header class="${cx("dh", `dh--${o.tone}`)}">` +
    `<div class="dh__text">` +
    kicker(o) +
    (o.before ?? "") +
    `<h1 class="${cx("dh__title", o.face === "display" && "dh__title--display")}" id="page-title">${o.title}</h1>` +
    (o.sum ? `<p class="dh__sum">${esc(o.sum)}</p>` : "") +
    (o.after ?? "") +
    `</div>` +
    // the window (and Hanko on its corner: the window clips its own canvas, so she sits beside it, not in it)
    (o.noWindow ? "" : `<div class="dh__side">${win(o.place)}${o.withHanko ? hanko() : ""}</div>`) +
    `</header>`
  );
}

const win = (place: Place, className?: string): string =>
  `<div class="${cx("dh__win", className)}" data-window="${place}" aria-hidden="true"></div>`;

/**
 * A one-column reading page (a post) beside a tall window that stays in view while it scrolls by, as the home page's
 * sections sit beside theirs; on narrower screens the window opens above the page as a band.
 */
export function deepBand(body: string, place: Place): string {
  return `<div class="dband"><div class="dband__main">${body}</div><div class="dband__side">${win(place, "dh__win--tall")}</div></div>`;
}

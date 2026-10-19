// The project cards (lane K, lanes\motion\DESIGN-1019.md section 5): dexCode = Yuki, dexClient = Bao, dex.place =
// Zhusha. One card per project: its splash art over the whole card (render/cardart.ts), the number and platform at the
// top, and at its foot the name (the way to the project's page), the download's state, the line, the one action that
// matters and its docs. Styles: styles/pcard.css; motion: motion/pcard.ts (initCards, the deck lane G drives).
//
// The list is `ul.pcards[data-pcards]`; lane G places it and its `li.pcards__it` (width, step, scroll parallax) and
// never styles anything inside the li (DESIGN-1019 7.3).

import { downloads, formatBytes, type DownloadFile } from "../data/downloads.ts";
import { projectHref, projects, type Project } from "../data/projects.ts";
import { cardArt } from "./cardart.ts";
import { button, chip, icon, type ButtonOptions } from "./glyphs.ts";
import { cx, esc, pad2 } from "./html.ts";

// ------------------------------------------------------------------- facts

/** The published file for a project, if there is one (data/downloads.ts). */
export const fileOf = (p: Project): DownloadFile | null => downloads.find((d) => d.id === p.id)?.file ?? null;
const hasDownloadEntry = (p: Project): boolean => downloads.some((d) => d.id === p.id);

/** The download's state as chips: version and size, or "no download". */
function stateChips(p: Project): string[] {
  const f = fileOf(p);
  return f
    ? [chip(`v${f.version}`, "value"), chip(formatBytes(f.bytes), "value")]
    : hasDownloadEntry(p) ? [chip("No public download yet", "value")] : [];
}

/** The download's state as one short line (a card's foot): "v0.4.23 · 102.9 MB", or "No public download yet". */
export function stateText(p: Project): string {
  const f = fileOf(p);
  return f ? `v${f.version} · ${formatBytes(f.bytes)}` : hasDownloadEntry(p) ? "No public download yet" : "";
}

/** Short state chips: platform, then version and size, or "no download". */
export function chipsOf(p: Project): string {
  return `<p class="chips">${[chip(p.platform, "key"), ...stateChips(p)].join("")}</p>`;
}

/** The one action that matters most for each project. */
export function primaryAction(p: Project, size: "m" | "l", here: "home" | "page"): ButtonOptions {
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
    `<p class="pcard__tags">${chip(p.platform, "key")}</p></div>` +
    `<div class="pcard__info">` +
    `<${h} class="pcard__name" id="p-${p.id}-name"><a class="pcard__link" href="${href}">${esc(p.name)}</a></${h}>` +
    (stateText(p) ? `<p class="pcard__state">${esc(stateText(p))}</p>` : "") +
    `<p class="pcard__line">${esc(p.line)}</p>` +
    `<div class="pcard__acts">` +
    button({ ...primaryAction(p, "m", here), className: "pcard__main" }) +
    small("Docs", "book", p.docs.href) +
    `</div></div></article></li>`
  );
}

export interface ProjectCardsOptions {
  /** The heading level of each card's name. */
  readonly level: 2 | 3;
  /** Where the list sits: the home page (in-page anchors) or a page of its own. */
  readonly here: "home" | "page";
  readonly className?: string;
}

/** The list of cards, `ul.pcards[data-pcards]` (motion/pcard.ts initCards takes this element). */
export const projectCards = (list: readonly Project[], { level, here, className }: ProjectCardsOptions): string =>
  `<ul class="${cx("pcards", className)}" data-pcards="${here}">${list.map((p, i) => card(p, i, level, here)).join("")}</ul>`;

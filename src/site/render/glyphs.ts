// The glyph system and small shared components (DESIGN-SYSTEM.md §5).
// Every function returns an HTML string; styles live in styles/components.css.
// Everything is square: no radius, no tilt. Blocks pop by lifting off a hard
// pixel shadow, never by rotating.

import { pixelSvg, type IconName } from "../pixels.ts";
import type { Tone } from "../data/projects.ts";
import { cx, esc, pad2 } from "./html.ts";

export function icon(name: IconName, scale = 2, className?: string): string {
  return pixelSvg(name, { scale, ...(className ? { className } : {}) });
}

/** The four-colour pixel strip (yellow, magenta, mint, cyan). Decorative. */
export function strip(className?: string, reveal = true): string {
  return `<span class="${cx("strip", className)}" aria-hidden="true"${reveal ? ' data-reveal="strip"' : ""}><i></i><i></i><i></i><i></i></span>`;
}

/** Fraction counter, e.g. 03 / 09. */
export function counter(n: number, total: number, className?: string): string {
  return `<span class="${cx("counter", className)}"><b>${pad2(n)}</b><span aria-hidden="true"> / </span><span class="sr"> of </span>${pad2(total)}</span>`;
}

/** Square glyph tile: a pixel icon on a tone fill with a hard edge. */
export function tile(name: IconName, tone: Tone, size: "s" | "m" | "l" = "m"): string {
  const scale = size === "l" ? 4 : size === "m" ? 3 : 2;
  return `<span class="tile tile--${tone} tile--${size}" aria-hidden="true">${icon(name, scale)}</span>`;
}

/** A small pixel mascot or sparkle, sitting square on the grid. Decorative. */
export function sticker(name: IconName, opts: { scale?: number; tone?: Tone; className?: string; reveal?: boolean } = {}): string {
  return (
    `<span class="${cx("sticker", opts.tone && `sticker--${opts.tone}`, opts.className)}" aria-hidden="true"` +
    `${opts.reveal === false ? "" : ' data-reveal="pop"'}>${icon(name, opts.scale ?? 3)}</span>`
  );
}

export function chip(text: string, variant: "key" | "value" | "ph" | "tone" = "value", tone?: Tone): string {
  return `<span class="${cx("chip", `chip--${variant}`, tone && `chip--${tone}`)}">${esc(text)}</span>`;
}

/** Visible "placeholder" tag for content Dex will replace. */
export const placeholderTag = (text = "Placeholder"): string => `<span class="tag tag--ph">${esc(text)}</span>`;

export interface ButtonOptions {
  href: string;
  label: string;
  icon?: IconName;
  /** Icon before the label (default after). */
  iconFirst?: boolean;
  tone?: Tone;
  size?: "s" | "m" | "l";
  download?: boolean;
  external?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** The key: square block, 2px edge, hard shadow; pops on hover, shrinks on press. */
export function button(o: ButtonOptions): string {
  const ic = o.icon ? `<span class="btn__ic">${icon(o.icon, o.size === "l" ? 3 : 2)}</span>` : "";
  const label = `<span class="btn__label">${esc(o.label)}</span>`;
  const attrs = [
    `class="${cx("btn", `btn--${o.tone ?? "paper"}`, `btn--${o.size ?? "m"}`, o.className)}"`,
    `href="${esc(o.href)}"`,
    o.download ? "download" : "",
    o.external ? 'rel="noopener"' : "",
    o.ariaLabel ? `aria-label="${esc(o.ariaLabel)}"` : "",
  ].filter(Boolean);
  return `<a ${attrs.join(" ")}>${o.iconFirst ? ic + label : label + ic}</a>`;
}

/** Copy-to-clipboard button; hidden without JS (styles: [data-copy]). */
export function copyButton(value: string, what: string): string {
  return (
    `<button class="btn btn--paper btn--s btn--icon" type="button" data-copy="${esc(value)}" aria-label="Copy ${esc(what)}">` +
    `<span class="btn__ic">${icon("copy", 2)}</span><span class="btn__done" aria-hidden="true">${icon("check", 2)}</span></button>`
  );
}

export interface SectionHeadOptions {
  id: string;
  kicker: string;
  title: string;
  tone: Tone;
  icon?: IconName;
  /** Real counts only, e.g. "03 items". */
  aside?: string;
  level?: 1 | 2 | 3;
  /** The section's own full page, linked from the head ("Open page"). */
  more?: { href: string; label: string };
}

/**
 * Section header: a tone tile, `// kicker` and a real count on a rule, the
 * title in the pixel face, and optionally a small link to the section's own
 * page. Used by home sections and inner pages alike, so they read as one site.
 */
export function sectionHead(o: SectionHeadOptions): string {
  const h = `h${o.level ?? 2}`;
  return (
    `<header class="sh sh--${o.tone}">` +
    `<p class="sh__kicker" data-reveal>` +
    (o.icon ? tile(o.icon, o.tone, "s") : "") +
    `<span class="sh__slash" aria-hidden="true">//</span><span>${esc(o.kicker)}</span>` +
    `<span class="sh__rule" aria-hidden="true"></span>${o.aside ? `<span class="sh__aside">${esc(o.aside)}</span>` : ""}</p>` +
    `<div class="sh__row">` +
    `<${h} class="sh__title" id="${esc(o.id)}" data-reveal="pop-block">${esc(o.title)}</${h}>` +
    (o.more ? button({ href: o.more.href, label: o.more.label, icon: "arrow", size: "s", tone: "paper", className: "sh__more" }) : "") +
    `</div>` +
    `</header>`
  );
}

export interface PageHeadOptions {
  kicker: string;
  title: string;
  tone: Tone;
  icon?: IconName;
  /** Short functional line (never a tagline). */
  lead?: string;
  aside?: string;
}

/** Inner-page header: the same kit as a section head, at h1, with room above. */
export function pageHead(o: PageHeadOptions): string {
  return (
    `<div class="phead">` +
    sectionHead({ id: "page-title", kicker: o.kicker, title: o.title, tone: o.tone, level: 1, ...(o.icon ? { icon: o.icon } : {}), ...(o.aside ? { aside: o.aside } : {}) }) +
    (o.lead ? `<p class="phead__lead">${esc(o.lead)}</p>` : "") +
    `</div>`
  );
}

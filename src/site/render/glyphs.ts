// The coloured glyph system and small shared components (DESIGN-SYSTEM.md §5).
// Every function returns an HTML string; styles live in styles/components.css.

import { pixelSvg, type IconName } from "../pixels.ts";
import type { Tone } from "../data/projects.ts";
import { cx, esc, pad2 } from "./html.ts";

export function icon(name: IconName, scale = 2, className?: string): string {
  return pixelSvg(name, { scale, ...(className ? { className } : {}) });
}

/** The three-colour strip (magenta, yellow, mint in equal thirds). Decorative. */
export function strip(className?: string, reveal = true): string {
  return `<span class="${cx("strip", className)}" aria-hidden="true"${reveal ? ' data-reveal="strip"' : ""}><i></i><i></i><i></i></span>`;
}

/** Fraction counter, e.g. 03 / 09. */
export function counter(n: number, total: number, className?: string): string {
  return `<span class="${cx("counter", className)}"><b>${pad2(n)}</b><span aria-hidden="true"> / </span><span class="sr"> of </span>${pad2(total)}</span>`;
}

/** Square glyph tile: a pixel icon on a tone fill with an ink outline. */
export function tile(name: IconName, tone: Tone, size: "s" | "m" | "l" = "m"): string {
  const scale = size === "l" ? 4 : size === "m" ? 3 : 2;
  return `<span class="tile tile--${tone} tile--${size}" aria-hidden="true">${icon(name, scale)}</span>`;
}

/** Die-cut pixel sticker (white outline, hard shadow), tilted. Decorative. */
export function sticker(name: IconName, opts: { scale?: number; tilt?: number; tone?: Tone; className?: string; reveal?: boolean } = {}): string {
  const style = [`--tilt:${opts.tilt ?? -6}deg`];
  return (
    `<span class="${cx("sticker", opts.tone && `sticker--${opts.tone}`, opts.className)}" style="${style.join(";")}" aria-hidden="true"` +
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
  magnet?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** The blocky key: rounded block, ink outline, hard shadow; lifts and presses. */
export function button(o: ButtonOptions): string {
  const ic = o.icon ? `<span class="btn__ic">${icon(o.icon, o.size === "l" ? 3 : 2)}</span>` : "";
  const label = `<span class="btn__label">${esc(o.label)}</span>`;
  const attrs = [
    `class="${cx("btn", `btn--${o.tone ?? "paper"}`, `btn--${o.size ?? "m"}`, o.className)}"`,
    `href="${esc(o.href)}"`,
    o.download ? "download" : "",
    o.external ? 'rel="noopener"' : "",
    o.magnet ? "data-magnet" : "",
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
  no?: number;
  kicker: string;
  title: string;
  tone: Tone;
  /** slab: title on a tilted tone block. line: plain title with an underline block. */
  variant?: "slab" | "line";
  /** Real counts only, e.g. "03 items". */
  aside?: string;
  level?: 1 | 2;
}

/** Section header kit: // kicker, rule, aside, big wide title, strip. */
export function sectionHead(o: SectionHeadOptions): string {
  const h = `h${o.level ?? 2}`;
  const title = o.variant === "line"
    ? `<span class="sh__line sh__line--${o.tone}">${esc(o.title)}</span>`
    : `<span class="slab slab--${o.tone}" data-reveal="wipe">${esc(o.title)}</span>`;
  return (
    `<header class="sh">` +
    `<p class="sh__kicker" data-reveal>${o.no ? `<span class="sh__no">${pad2(o.no)}</span>` : ""}` +
    `<span class="sh__slash" aria-hidden="true">//</span><span>${esc(o.kicker)}</span>` +
    `<span class="sh__rule" aria-hidden="true"></span>${o.aside ? `<span class="sh__aside">${esc(o.aside)}</span>` : ""}</p>` +
    `<${h} class="sh__title" id="${esc(o.id)}">${title}</${h}>` +
    `</header>`
  );
}

export interface PageHeadOptions {
  kicker: string;
  title: string;
  tone: Tone;
  /** Short functional line (never a tagline). */
  lead?: string;
  stickers?: readonly IconName[];
  aside?: string;
}

/** Page header: a big tone panel with a faint grid, wide title, pixel stickers. */
export function pageHead(o: PageHeadOptions): string {
  const stickers = (o.stickers ?? [])
    .map((name, i) => sticker(name, { scale: i === 0 ? 5 : 4, tilt: i % 2 ? 8 : -7, className: `phead__st phead__st--${i}` }))
    .join("");
  return (
    `<header class="phead phead--${o.tone}" data-reveal="pop-block">` +
    `<p class="sh__kicker"><span class="sh__slash" aria-hidden="true">//</span><span>${esc(o.kicker)}</span>` +
    `${o.aside ? `<span class="sh__rule" aria-hidden="true"></span><span class="sh__aside">${esc(o.aside)}</span>` : ""}</p>` +
    `<h1 class="phead__title">${esc(o.title)}</h1>` +
    (o.lead ? `<p class="phead__lead">${esc(o.lead)}</p>` : "") +
    `<div class="phead__stickers" aria-hidden="true">${stickers}</div>` +
    `</header>`
  );
}

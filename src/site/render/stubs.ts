// The services that open later (GDK 3.7's table): support (the Crane Desk), the dex account (Hanko's desk),
// the map, the forums (the Teahouse) and commissions. Each is an honest stub: it says plainly that it opens
// later and never fakes a form, a session or a count. Each has its address kept (/support/, /account/, /map/,
// /forums/; commissions at /gallery/#commissions) and a card on the home page.

import { hanko, icon, pageHead, sectionHead, tile } from "./glyphs.ts";
import { esc } from "./html.ts";
import type { IconName } from "../pixels.ts";
import type { Tone } from "../data/projects.ts";

export interface Stub {
  id: "support" | "account" | "map" | "forums" | "commissions";
  title: string;
  /** Its own address. */
  href: string;
  icon: IconName;
  tone: Tone;
  /** What it will be, in one plain line. */
  line: string;
  /** Where it is in the world. */
  place: string;
}

export const STUBS: readonly Stub[] = [
  { id: "support", title: "Support", href: "/support/", icon: "page", tone: "cyan", line: "Write to Dex about a bug or a question.", place: "the Crane Desk in the Hall of Works" },
  { id: "account", title: "dex account", href: "/account/", icon: "star", tone: "yellow", line: "One account for dex.place, dexCode and dexClient.", place: "Hanko's desk in the Hall of Works" },
  { id: "map", title: "Map", href: "/map/", icon: "grid", tone: "mint", line: "The whole of Tesu on one banner.", place: "the hall's central pillar" },
  { id: "forums", title: "Forums", href: "/forums/", icon: "window", tone: "cyan", line: "A place to talk with other visitors.", place: "the Teahouse, upstairs, shuttered for now" },
  { id: "commissions", title: "Commissions", href: "/gallery/#commissions", icon: "frame", tone: "magenta", line: "Ask Dex for a piece of your own.", place: "a corner of the Long Gallery" },
];

const later = `<p class="stub__later"><span class="stub__dot" aria-hidden="true"></span>Opens later</p>`;

function stubCard(s: Stub, level: 2 | 3): string {
  const h = `h${level}`;
  return (
    `<li class="stub" id="${s.id === "commissions" ? "commissions-card" : `stub-${s.id}`}">` +
    hanko() +
    `<${h} class="stub__title">${tile(s.icon, s.tone, "s")}<a class="stub__link" href="${s.href}">${esc(s.title)}</a></${h}>` +
    `<p class="stub__line">${esc(s.line)}</p>` +
    later +
    `</li>`
  );
}

/** Home: the services still to come, as small honest cards. */
export function moreSection(): string {
  return (
    `<section class="sec sec--more" id="more" aria-labelledby="more-title">` +
    `<div class="wrap">` +
    sectionHead({ id: "more-title", kicker: "more", title: "Opens later", tone: "cyan", icon: "plus" }) +
    `<ul class="stubs">${STUBS.map((s) => stubCard(s, 3)).join("")}</ul>` +
    `</div></section>`
  );
}

/** A stub's own page (/support/, /account/, /map/, /forums/). */
export function stubPage(id: Stub["id"]): string {
  const s = STUBS.find((x) => x.id === id)!;
  const others = STUBS.filter((x) => x.id !== id);
  return (
    `<div class="page page--stub">` +
    `<div class="wrap">` +
    pageHead({ kicker: s.id === "account" ? "account" : s.id, title: s.title, tone: s.tone, icon: s.icon }) +
    `<div class="stubpage">` +
    hanko() +
    `<p class="stubpage__line">${esc(s.line)}</p>` +
    later +
    `<p class="stubpage__place">${icon("info", 2)}<span>In the world: ${esc(s.place)}.</span></p>` +
    `</div>` +
    `<h2 class="stubpage__more">Also opening later</h2>` +
    `<ul class="stubs">${others.map((o) => stubCard(o, 3)).join("")}</ul>` +
    `</div></div>`
  );
}

/** The commissions corner inside the gallery (/gallery/#commissions). */
export function commissionsBlock(level: 2 | 3): string {
  const s = STUBS.find((x) => x.id === "commissions")!;
  const h = `h${level}`;
  return (
    `<div class="commissions" id="commissions">` +
    hanko() +
    `<${h} class="commissions__title">${tile(s.icon, s.tone, "s")}<span>${esc(s.title)}</span></${h}>` +
    `<p class="stub__line">${esc(s.line)}</p>` +
    later +
    `</div>`
  );
}

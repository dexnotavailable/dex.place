// Page bodies that don't have a file of their own: the 404. The home page and
// project pages live in landing.ts, downloads in downloads.ts, the gallery in
// gallery.ts, docs and blog in docs.ts, donate in donate.ts.

import { NAV } from "../data/nav.ts";
import { floats } from "./floats.ts";
import { button, pageHead } from "./glyphs.ts";

export function notFoundPage(): string {
  return (
    `<div class="page">` +
    floats("notfound", { count: 2, glyph: "sparkle" }) +
    `<div class="wrap">` +
    pageHead({ kicker: "404", title: "Not found", tone: "yellow", icon: "warn" }) +
    `<ul class="nf__links">${[{ href: "/", label: "Home", icon: "arrow" as const }, ...NAV.map((n) => ({ href: n.page, label: n.label, icon: n.icon }))]
      .map((n) => `<li>${button({ href: n.href, label: n.label, icon: n.icon, iconFirst: true, size: "m" })}</li>`)
      .join("")}</ul>` +
    `</div></div>`
  );
}

// Page bodies that don't have a file of their own: the 404. The home page and
// project pages live in landing.ts, downloads in downloads.ts, the gallery in
// gallery.ts, docs and blog in docs.ts, donate in donate.ts.

import { NAV } from "../data/nav.ts";
import { DEEP_PLACES, deepHead } from "./deep.ts";
import { button } from "./glyphs.ts";

export function notFoundPage(): string {
  const links = [{ href: "/", label: "Home", icon: "arrow" as const }, ...NAV.map((n) => ({ href: n.page, label: n.label, icon: n.icon }))];
  return (
    `<div class="page page--nf">` +
    `<div class="wrap">` +
    // the deep head (render/deep.ts): a window onto the high sky, the Walker wading far off in it, Hanko on its corner
    deepHead({
      tone: "yellow",
      icon: "warn",
      crumbs: [{ label: "404" }],
      title: "Not found",
      face: "display",
      sum: "Nothing lives at this address. Try one of these:",
      after: `<ul class="nf__links">${links
        .map((n) => `<li>${button({ href: n.href, label: n.label, icon: n.icon, iconFirst: true, size: "m" })}</li>`)
        .join("")}</ul>`,
      place: DEEP_PLACES.notfound,
      withHanko: true,
    }) +
    `</div></div>`
  );
}

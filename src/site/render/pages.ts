// Page bodies. Each returns the <main> content for one route; layout.ts wraps
// it in the shell. Every page is complete without JavaScript.

import { NAV } from "../data/nav.ts";
import { floats } from "./floats.ts";
import { button, pageHead } from "./glyphs.ts";

// ------------------------------------------------------------------ landing
// The landing and the project pages live in render/landing.ts.

// ---------------------------------------------------------------- downloads
// The /downloads/ page lives in render/downloads.ts.

// ------------------------------------------------------------------ gallery
// The collage and the piece pages live in render/gallery.ts.

// Docs and blog pages live in docs.ts.

// ---------------------------------------------------------------------- 404

export function notFoundPage(): string {
  return (
    `<div class="page">` +
    floats("notfound", { far: 2, mid: 2, near: 1, stickers: ["sleepy"] }) +
    `<div class="wrap">` +
    pageHead({ kicker: "404", title: "Not found", tone: "yellow", stickers: ["sleepy", "blob"] }) +
    `<ul class="nf__links">${[{ href: "/", label: "Home", icon: "arrow" as const }, ...NAV]
      .map((n) => `<li>${button({ href: n.href, label: n.label, icon: n.icon, iconFirst: true, size: "m" })}</li>`)
      .join("")}</ul>` +
    `</div></div>`
  );
}

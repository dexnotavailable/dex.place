// Shared browser code for every website page. Small on purpose: pages are
// complete without it (prerendered HTML); this only adds motion and a few
// conveniences. Budget: ~12 kB gzipped shared JS (TECH-PLAN.md).

import "./styles/site.css";
import { initCopy } from "./motion/copy.ts";
import { initDefer } from "./motion/defer.ts";
import { initFloats } from "./motion/floats.ts";
import { initKeys } from "./motion/keys.ts";
import { initScenes } from "./motion/magnet.ts";
import { initMenu, initNav, initStuck } from "./motion/nav.ts";
import { initSharpen } from "./motion/piece.ts";
import { initIdle, initReveal } from "./motion/reveal.ts";
import { initWorld } from "./motion/world.ts";

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");

// A chunk import cut off by leaving the page (Safari rejects it with
// "Importing a module script failed" as the next page starts loading) is not
// a fault. The report waits a moment: by then a page that is leaving has
// fired pagehide (or is gone), and anything else is logged.
let leaving = false;
window.addEventListener("pagehide", () => { leaving = true; });
window.addEventListener("pageshow", () => { leaving = false; });
const failed = (name: string) => (error: unknown): void => {
  setTimeout(() => {
    if (!leaving) console.error(`[site] ${name} failed`, error);
  }, 1000);
};

const steps: [string, () => void][] = [
  // Gallery tiles past the first screen (render/gallery.ts).
  ["defer", () => initDefer()],
  // Piece pages: a sharper copy of the big image when the line allows (render/gallery.ts).
  ["sharpen", () => initSharpen()],
  ["reveal", () => initReveal()],
  ["idle", () => initIdle()],
  ["world", () => initWorld(reduced)],
  ["nav", () => initNav()],
  ["stuck", () => initStuck()],
  ["menu", () => initMenu()],
  ["floats", () => initFloats(reduced)],
  ["scenes", () => initScenes(reduced, fine)],
  ["copy", () => initCopy()],
  ["keys", () => initKeys()],
  // Docs and posts only: contents scroll-spy and heading-link copy, own chunk.
  ["toc", () => {
    if (!document.querySelector(".prose")) return;
    import("./motion/toc.ts").then(
      (m) => m.initToc(reduced),
      failed("toc"),
    );
  }],
  // The donate section (home, /donate/): the amount slider and QR encoder, own chunk.
  ["donate", () => {
    if (!document.querySelector("[data-donate]")) return;
    import("./motion/donate.ts").then(
      (m) => m.initDonate(reduced),
      failed("donate"),
    );
  }],
  // The collage (home, /gallery/): the hover field and the click-in viewer, own chunk.
  ["gallery", () => {
    if (!document.querySelector("[data-collage]")) return;
    import("./motion/gallery.ts").then(
      (m) => m.initGallery(reduced, fine),
      failed("gallery"),
    );
  }],
];

for (const [name, run] of steps) {
  try {
    run();
  } catch (error) {
    // One broken enhancement must not take the others (or the content) down.
    console.error(`[site] ${name} failed`, error);
  }
}

root.classList.add("ready");

// Smooth in-page jumps start only once the page has loaded and any
// load-time #fragment scroll is done, so a deep link lands instead of
// riding the page (base.css html[data-smooth]).
const smooth = (): void => {
  requestAnimationFrame(() => requestAnimationFrame(() => root.setAttribute("data-smooth", "")));
};
if (document.readyState === "complete") smooth();
else window.addEventListener("load", smooth, { once: true });

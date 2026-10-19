// Shared browser code for every website page. Small on purpose: pages are
// complete without it (prerendered HTML); this only adds motion and a few
// conveniences. Budget: ~12 kB gzipped shared JS (TECH-PLAN.md).

import "./styles/site.css";
import { initCopy } from "./motion/copy.ts";
import { initDefer } from "./motion/defer.ts";
import { initEmbed } from "./motion/embed.ts";
import { initKeys } from "./motion/keys.ts";
import { finishOfPage } from "./motion/finish-mode.ts";
import { lookOfPage } from "./motion/look-mode.ts";
import { initScenes } from "./motion/magnet.ts";
import { initMenu, initNav, initStuck } from "./motion/nav.ts";
import { initNsfw } from "./motion/nsfw.ts";
import { initSharpen } from "./motion/piece.ts";
import { initIdle, initReveal } from "./motion/reveal.ts";
import { initScatter } from "./motion/scatter.ts";
import { afterMark } from "./motion/quiet.ts";
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

// the look the page moves in (motion/look-mode.ts): the CSS keys off html[data-motion]
try { lookOfPage(); } catch { /* the page simply keeps still */ }
// how the cards' rigged art is finished (motion/finish-mode.ts): vector by CSS, pixel by motion/cardrig.ts
let cardFinish = "vector";
try { cardFinish = finishOfPage(); } catch { /* vector */ }

const steps: [string, () => void][] = [
  ["embed", () => initEmbed()],
  // Gallery tiles past the first screen (render/gallery.ts).
  ["defer", () => initDefer()],
  // Piece pages: a sharper copy of the big image when the line allows (render/gallery.ts).
  ["sharpen", () => initSharpen()],
  ["reveal", () => initReveal()],
  ["idle", () => initIdle()],
  ["world", () => initWorld(reduced)],
  // the page column (the game screen, "dex", the loader and the ofuda, the four ways in), own chunk
  ["column", () => {
    if (!document.querySelector("[data-gs-title]")) return;
    import("./motion/column.ts").then(
      (m) => m.initColumn(reduced),
      failed("column"),
    );
  }],
  // the white paper's pixel edge (styles/v2.css .band)
  ["scatter", () => initScatter()],
  // the windows into the world beside the sections and the jetty at the bottom, painted once the page has loaded
  // and "dex" has written itself (motion/quiet.ts), own chunk (and workers)
  ["sky", () => {
    if (!document.querySelector("[data-window], [data-jetty]")) return;
    const go = (): void => {
      afterMark().then(() => import("./motion/sky.ts")).then((m) => m.initSky(reduced), failed("sky"));
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }],
  ["nav", () => initNav()],
  ["stuck", () => initStuck()],
  ["menu", () => initMenu()],
  ["scenes", () => initScenes(reduced, fine)],
  // the project cards' rigged art in the pixel finish (render/cardart.ts data-rig), own chunk, loaded only for that
  // finish and when a card has a rig (the default vector finish is CSS)
  ["cardrig", () => {
    if (cardFinish !== "pixel" || !document.querySelector("[data-rig]")) return;
    import("./motion/cardrig.ts").then((m) => m.initCardRigs(reduced, fine), failed("cardrig"));
  }],
  // the page's stage (motion/stage.ts: the smooth wheel, the entrances, the lean; GSAP + ScrollTrigger + Lenis), own
  // chunk, once the "dex" mark has written itself and the page is idle; never with reduced motion, Save-Data or in an
  // embed (the page is all there without it)
  ["stage", () => {
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduced.matches || saveData || root.dataset.embed) return;
    const idle = (): Promise<void> => new Promise((done) => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => done(), { timeout: 1200 });
      else setTimeout(done, 200);
    });
    afterMark().then(idle).then(() => import("./motion/stage.ts")).then((m) => m.initStage(fine), failed("stage"));
  }],
  ["copy", () => initCopy()],
  // NSFW image spoilers in posts (render/nsfw.ts).
  ["nsfw", () => initNsfw()],
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

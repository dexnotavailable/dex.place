// Shared browser code for every website page. Small on purpose: pages are
// complete without it (prerendered HTML); this only adds motion and a few
// conveniences. Budget: ~12 kB gzipped shared JS (TECH-PLAN.md).

import "./styles/site.css";
import { initCopy } from "./motion/copy.ts";
import { initDefer } from "./motion/defer.ts";
import { initFloats } from "./motion/floats.ts";
import { initKeys } from "./motion/keys.ts";
import { initMagnet, initScenes } from "./motion/magnet.ts";
import { initHeadroom, initMenu, initNav } from "./motion/nav.ts";
import { initIdle, initReveal } from "./motion/reveal.ts";
import { initWorld } from "./motion/world.ts";

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");

const steps: [string, () => void][] = [
  // Gallery tiles past the first screen (render/gallery.ts).
  ["defer", () => initDefer()],
  ["reveal", () => initReveal()],
  ["idle", () => initIdle()],
  ["world", () => initWorld(reduced)],
  ["nav", () => initNav()],
  ["headroom", () => initHeadroom()],
  ["menu", () => initMenu()],
  ["floats", () => initFloats(reduced, fine)],
  ["magnet", () => initMagnet(reduced, fine)],
  ["scenes", () => initScenes(reduced, fine)],
  ["copy", () => initCopy()],
  ["keys", () => initKeys()],
  // Docs and posts only: contents scroll-spy and heading-link copy, own chunk.
  ["toc", () => {
    if (!document.querySelector(".prose")) return;
    import("./motion/toc.ts").then(
      (m) => m.initToc(reduced),
      (error: unknown) => console.error("[site] toc failed", error),
    );
  }],
  // /donate/ only: the amount slider and QR encoder load as their own chunk.
  ["donate", () => {
    if (!document.querySelector("[data-donate]")) return;
    import("./motion/donate.ts").then(
      (m) => m.initDonate(reduced),
      (error: unknown) => console.error("[site] donate failed", error),
    );
  }],
  // /gallery/ only: the cursor field and the click-in viewer, own chunk.
  ["gallery", () => {
    if (!document.querySelector("[data-collage]")) return;
    import("./motion/gallery.ts").then(
      (m) => m.initGallery(reduced, fine),
      (error: unknown) => console.error("[site] gallery failed", error),
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

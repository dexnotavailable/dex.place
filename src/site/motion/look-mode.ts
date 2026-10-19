// Which look the website moves in (motion/looks.ts has them): ?motion=<look> keeps it for the visit, else the default.
// Small on purpose: main.ts sets html[data-motion] with it before anything draws (the CSS keys off it); the looks
// themselves load with the windows.

export type Look = "depth" | "diorama";
export const LOOKS: readonly Look[] = ["depth", "diorama"];
/**
 * The look the site ships with. Dex 10-19 (the redesign, lanes/roadmap/SITE-SCROLL.md): "as you scroll down the world
 * is already there" - depth (the world moves with the scroll by nearness, nothing covers it). The old tear-open stays
 * one ?motion=diorama away; dust and cuts are retired.
 */
export const DEFAULT_LOOK: Look = "depth";

/** The look this page shows; sets html[data-motion]. */
export function lookOfPage(): Look {
  let look: Look = DEFAULT_LOOK;
  try {
    const q = new URLSearchParams(location.search).get("motion");
    if (q && (LOOKS as readonly string[]).includes(q)) sessionStorage.setItem("dex-motion", q);
    const kept = sessionStorage.getItem("dex-motion");
    if (kept && (LOOKS as readonly string[]).includes(kept)) look = kept as Look;
  } catch {
    // (storage blocked: the default)
  }
  document.documentElement.dataset.motion = look;
  return look;
}

// Which look the website moves in (motion/looks.ts has them): ?motion=<look> keeps it for the visit, else the default.
// Small on purpose: main.ts sets html[data-motion] with it before anything draws (the CSS keys off it); the looks
// themselves load with the windows.

export type Look = "diorama" | "dust" | "cuts";
export const LOOKS: readonly Look[] = ["diorama", "dust", "cuts"];
/** The look the site ships with (the other two stay one ?motion= away, for comparing). */
export const DEFAULT_LOOK: Look = "dust"; // Dex 10-19: "probably dust"

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

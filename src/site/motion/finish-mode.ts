// How the project cards' rigged art is finished (Dex 10-19: "vector is best; some web elements don't necessarily need
// to be pixel"): ?finish=<finish> keeps one for the visit, else vector. Small on purpose, like look-mode.ts: main.ts
// sets html[data-cardfinish] with it before anything draws.
// - vector (the default): the card-art lane's layers themselves, moved by CSS (styles/landing.css .rig__p), no script.
// - pixel: motion/cardrig.ts (own chunk, fetched only for this finish) draws the layers onto the site's pixel grid.

export type Finish = "pixel" | "vector";
export const FINISHES: readonly Finish[] = ["vector", "pixel"];
/** The finish the cards ship with (the other stays one ?finish= away, for comparing). */
export const DEFAULT_FINISH: Finish = "vector";

/** The finish this page shows; sets html[data-cardfinish]. */
export function finishOfPage(): Finish {
  let f: Finish = DEFAULT_FINISH;
  try {
    const q = new URLSearchParams(location.search).get("finish");
    if (q && (FINISHES as readonly string[]).includes(q)) sessionStorage.setItem("dex-finish", q);
    const kept = sessionStorage.getItem("dex-finish");
    if (kept && (FINISHES as readonly string[]).includes(kept)) f = kept as Finish;
  } catch {
    // (storage blocked: the default)
  }
  document.documentElement.dataset.cardfinish = f;
  return f;
}

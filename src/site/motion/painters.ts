// The painter workers (one each, shared by every window and the jetty). Started once the page is idle after its first
// paint, so a jump down the page never finds a window still waiting for its painters; with the browser's data saver on,
// only when a place that needs one comes near. The worker URLs are written out so the build bundles each entry with just
// its painters.

export type PainterEntry = "sky" | "palace" | "kagami";

const workers: Partial<Record<PainterEntry, Worker>> = {};

export function painterWorker(e: PainterEntry): Worker {
  const have = workers[e];
  if (have) return have;
  const w =
    e === "sky" ? new Worker(new URL("./paint-sky.ts", import.meta.url), { type: "module" })
      : e === "palace" ? new Worker(new URL("./paint-palace.ts", import.meta.url), { type: "module" })
        : new Worker(new URL("./paint-kagami.ts", import.meta.url), { type: "module" });
  workers[e] = w;
  return w;
}

/** Start every painter worker after the first paint, when the page is idle (never before it has painted). */
export function warmPainters(): void {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
  // only the page column jumps between windows onto every place; a deep page's one window starts its own painter
  if (!document.querySelector(".sheet--column")) return;
  const idle = (f: () => void): void => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(f, { timeout: 3000 });
    else setTimeout(f, 200);
  };
  requestAnimationFrame(() => setTimeout(() => idle(() => {
    for (const e of ["sky", "palace", "kagami"] as const) painterWorker(e);
  }), 0));
}

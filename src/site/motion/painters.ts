// The painter workers, started only when a place that needs one comes near (one each, shared by every window and the
// jetty). The worker URLs are written out so the build bundles each entry with just its painters.

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

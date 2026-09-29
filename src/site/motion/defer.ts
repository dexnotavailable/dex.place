// Deferred images (render/gallery.ts: collage tiles after the lead one, and
// the film strip on piece pages).
// Their sources wait in data-srcset / data-src so a phone's first load is the
// first screen, not the whole wall. They are released once the page's lead
// images (fetchpriority="high": the lead tile, or the largest on the first
// screen, render/layout.ts ARRIVAL) have landed, so they never compete with
// them, and then only as they come within half a screen of view; those marked
// data-defer="lead" (the film strip, small and inside its own scroller, where
// the page's scroll position says nothing; and the other tiles on the first
// screen, ARRIVAL) as soon as the lead images have landed, and the rest only
// once those have landed too.
// Without this module the <noscript> copies show, and if main.ts never runs
// the head script (render/layout.ts) releases them all.

/** Moves a deferred <picture>'s (or <img>'s) sources into place; the browser then picks and loads. */
export function release(el: Element | null): void {
  if (!el?.hasAttribute("data-defer")) return;
  el.removeAttribute("data-defer");
  const all = [el, ...Array.from(el.querySelectorAll("source, img"))] as (HTMLSourceElement | HTMLImageElement)[];
  for (const node of all) {
    if (node.dataset.srcset !== undefined) {
      node.srcset = node.dataset.srcset;
      delete node.dataset.srcset;
    }
    if (node instanceof HTMLImageElement && node.dataset.src !== undefined) {
      node.src = node.dataset.src;
      delete node.dataset.src;
    }
  }
}

/** Calls `done` once every image has loaded or failed, or after `wait` ms, whichever is first. */
function settle(imgs: readonly HTMLImageElement[], done: () => void, wait = 2500): void {
  let left = imgs.length;
  let called = false;
  const finish = (): void => {
    if (called) return;
    called = true;
    done();
  };
  const one = (): void => {
    if (--left <= 0) finish();
  };
  for (const img of imgs) {
    img.addEventListener("load", one, { once: true });
    img.addEventListener("error", one, { once: true });
  }
  setTimeout(finish, wait);
}

export function initDefer(): void {
  const pictures = Array.from(document.querySelectorAll<HTMLElement>("[data-defer]"));
  if (!pictures.length) return;
  if (!("IntersectionObserver" in window)) {
    pictures.forEach(release);
    return;
  }
  let started = false;
  const start = (): void => {
    if (started) return;
    started = true;
    const first: HTMLImageElement[] = [];
    const rest = pictures.filter((el) => {
      if (el.dataset.defer !== "lead") return true;
      release(el);
      const img = el instanceof HTMLImageElement ? el : el.querySelector("img");
      if (img && !img.complete) first.push(img);
      return false;
    });
    // The "lead" group (an arrival's in-view tiles, render/layout.ts ARRIVAL;
    // the film strip) lands before the rest of the wall starts.
    if (!first.length) watch(rest);
    else settle(first, () => watch(rest));
  };
  const watch = (rest: HTMLElement[]): void => {
    if (!rest.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          release(entry.target);
        }
      },
      { rootMargin: "50% 0px 50% 0px" },
    );
    for (const picture of rest) io.observe(picture);
  };
  // Every high-priority image: more than one when tiles of one size share the
  // first screen (ARRIVAL). A stalled one holds the rest back 2.5 s at most.
  const leads = Array.from(document.querySelectorAll<HTMLImageElement>('img[fetchpriority="high"]')).filter((img) => !img.complete);
  if (!leads.length) start();
  else settle(leads, start);
}

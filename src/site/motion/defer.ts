// Deferred images (render/gallery.ts: collage tiles after the lead one, and
// the film strip on piece pages).
// Their sources wait in data-srcset / data-src so a phone's first load is the
// first screen, not the whole wall. They are released once the page's lead
// image (fetchpriority="high") has landed, so they never compete with it,
// and then only as they come within half a screen of view; those marked
// data-defer="lead" (the film strip, small and inside its own scroller, where
// the page's scroll position says nothing) as soon as the lead has landed.
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
    const rest = pictures.filter((el) => {
      if (el.dataset.defer !== "lead") return true;
      release(el);
      return false;
    });
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
  const lead = document.querySelector<HTMLImageElement>('img[fetchpriority="high"]');
  if (!lead || (lead.complete && lead.naturalWidth > 0)) {
    start();
    return;
  }
  lead.addEventListener("load", start, { once: true });
  lead.addEventListener("error", start, { once: true });
  // A stalled lead image must not hold the rest back for long.
  setTimeout(start, 2500);
}

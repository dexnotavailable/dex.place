// Keyboard shortcuts on gallery piece pages: arrows follow the prev/next
// links ([data-key]), Escape returns to the collage. Ignored while typing.
// Also opens the film strip with the current piece in view.

export function initKeys(): void {
  const targets = document.querySelectorAll<HTMLAnchorElement>("a[data-key]");
  if (!targets.length) return;
  // The film strip scrolls sideways on narrow screens; open it with the
  // current piece centred in view rather than scrolled off to the right.
  const here = document.querySelector<HTMLElement>(".film__link.is-here");
  const film = here?.closest<HTMLElement>(".film");
  if (here && film && film.scrollWidth > film.clientWidth) {
    const f = film.getBoundingClientRect();
    const h = here.getBoundingClientRect();
    film.scrollLeft += h.left + h.width / 2 - (f.left + f.width / 2);
  }
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === "Escape" && document.querySelector(".page--piece")) {
      e.preventDefault();
      window.location.assign(document.documentElement.dataset.embed === "world" ? "/gallery/?embed=world" : "/gallery/");
      return;
    }
    const link = Array.from(targets).find((a) => a.dataset.key === e.key);
    if (link) {
      e.preventDefault();
      link.click();
    }
  });
}

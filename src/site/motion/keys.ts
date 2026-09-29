// Keyboard shortcuts on gallery piece pages: arrows follow the prev/next
// links ([data-key]), Escape returns to the collage. Ignored while typing.

export function initKeys(): void {
  const targets = document.querySelectorAll<HTMLAnchorElement>("a[data-key]");
  if (!targets.length) return;
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === "Escape" && document.querySelector(".page--piece")) {
      window.location.assign("/gallery/");
      return;
    }
    const link = Array.from(targets).find((a) => a.dataset.key === e.key);
    if (link) {
      e.preventDefault();
      link.click();
    }
  });
}

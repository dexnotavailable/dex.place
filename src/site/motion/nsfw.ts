// NSFW image spoilers (render/nsfw.ts): "Show image" opens one image, "Hide
// image" closes it again. Both are real buttons, so Enter and Space work.
// Nothing is remembered: each page load starts with every image blurred.
// The real alt text lives in data-alt and is only put on the <img> while it is
// open, so a screen reader hears nothing about the picture before the viewer
// chooses to see it. Focus moves to the button that replaces the one pressed.

function set(root: HTMLElement, open: boolean): void {
  const img = root.querySelector<HTMLImageElement>(".nsfw__img");
  if (!img) return;
  root.toggleAttribute("data-shown", open);
  img.alt = open ? (img.dataset.alt ?? "") : "";
  root.querySelector<HTMLElement>(open ? "[data-nsfw-hide]" : "[data-nsfw-show]")?.focus({ preventScroll: true });
}

export function initNsfw(): void {
  if (!document.querySelector(".nsfw")) return;
  document.addEventListener("click", (e) => {
    const button = (e.target as Element | null)?.closest<HTMLElement>("[data-nsfw-show], [data-nsfw-hide]");
    const root = button?.closest<HTMLElement>(".nsfw");
    if (button && root) set(root, button.hasAttribute("data-nsfw-show"));
  });
}

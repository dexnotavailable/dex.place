// The quiet background layer (render/floats.ts, floats.css). The shapes'
// slow step drift is pure CSS; this only marks each layer `.is-vis` while it
// is on screen, so off-screen layers rest. No parallax, no cursor tracking:
// the background stays calm (Dex, 2026-09-29: "tone that down").
// Nothing runs under reduced motion (the CSS drift is off there too).

export function initFloats(reduced: MediaQueryList): void {
  if (reduced.matches) return;
  const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-floats]"));
  if (!layers.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle("is-vis", entry.isIntersecting);
  });
  for (const layer of layers) io.observe(layer);
}

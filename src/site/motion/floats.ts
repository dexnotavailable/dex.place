// Parallax for the floating background layers (render/floats.ts, floats.css).
// Scroll: each shape moves by 0.04/0.08/0.14 (far/mid/near) of its layer
// centre's offset from the viewport centre.
// Cursor (fine pointers only): -1..1, eased with a lerp, 4/8/14 px per depth.
//
// Both are written as an inline `translate` on each .fl shape of a visible
// layer, never as a custom property on <html> or on the layer: an inherited
// property on an ancestor restyles its whole subtree every frame (on <html>
// that was the entire ~750-element page, ~15 fps under a 4x CPU throttle).
// A non-inherited property on the shape restyles only that shape.
// Off-screen layers are skipped and pause their idle drift (.is-vis).
// Nothing runs under reduced motion.

interface Shape {
  el: HTMLElement;
  /** Cursor travel in px; scroll factor is k / 100. */
  k: number;
  last: string;
}

const depthOf = (el: HTMLElement): number =>
  el.classList.contains("fl--near") ? 14 : el.classList.contains("fl--mid") ? 8 : 4;

export function initFloats(reduced: MediaQueryList, fine: MediaQueryList): void {
  if (reduced.matches) return;
  const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-floats]"));
  if (!layers.length || !("IntersectionObserver" in window)) return;
  const shapes = new Map<HTMLElement, Shape[]>();
  for (const layer of layers) {
    shapes.set(
      layer,
      Array.from(layer.querySelectorAll<HTMLElement>(":scope > .fl"), (el) => ({ el, k: depthOf(el), last: "" })),
    );
  }
  const visible = new Set<HTMLElement>();
  let raf = 0;
  let mx = 0;
  let my = 0;
  let tx = 0;
  let ty = 0;
  let off = false;

  const tick = (): void => {
    raf = 0;
    if (off) return;
    mx += (tx - mx) * 0.1;
    my += (ty - my) * 0.1;
    const vh = window.innerHeight;
    for (const layer of visible) {
      const r = layer.getBoundingClientRect();
      const sy = r.top + r.height / 2 - vh / 2;
      for (const s of shapes.get(layer) ?? []) {
        const x = -mx * s.k;
        const y = -(sy * s.k) / 100 - my * s.k;
        const value = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
        if (value === s.last) continue;
        s.last = value;
        s.el.style.translate = value;
      }
    }
    if (Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002) kick();
  };
  const kick = (): void => {
    if (!raf && !off) raf = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      el.classList.toggle("is-vis", entry.isIntersecting);
      if (entry.isIntersecting) el.classList.add("seen");
      if (entry.isIntersecting) visible.add(el);
      else visible.delete(el);
    }
    kick();
  });
  for (const layer of layers) io.observe(layer);

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  if (fine.matches) {
    window.addEventListener(
      "pointermove",
      (e) => {
        tx = (e.clientX / window.innerWidth) * 2 - 1;
        ty = (e.clientY / window.innerHeight) * 2 - 1;
        kick();
      },
      { passive: true },
    );
  }
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    off = true;
    io.disconnect();
    visible.clear();
    for (const list of shapes.values()) for (const s of list) s.el.style.removeProperty("translate");
  });
}

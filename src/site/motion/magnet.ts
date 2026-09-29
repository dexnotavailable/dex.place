// Placeholder scenes ([data-tilt-scene], render/art.ts and the downloads file
// art): fine pointers only, never touch, never under reduced motion.
//
// Scenes also get `.is-vis` while on screen; CSS pauses their idle loops
// (caret, orb, clouds, drop, fill, tap) when off screen, like the floats.
//
// Tilt: each depth layer gets its own inline `translate` (a non-inherited
// property, so only that layer restyles). Writing --tx/--ty on the panel made
// every pointer frame restyle the whole scene subtree. The pointer is snapped
// to 0.05 steps and written once per frame; the layers' 700ms translate
// transition smooths the steps.
//   .sc-it (landing scenes, depth --d 1..4): 1.1cqi x 0.8cqi per depth unit
//   [data-depth] (downloads art, 1..3): fixed px per depth
const DEPTH_PX: Record<string, readonly [number, number]> = { "1": [6, 4], "2": [14, 9], "3": [24, 16] };

interface TiltItem { el: HTMLElement; kx: number; ky: number; unit: "cqi" | "px" }

function tiltItems(panel: HTMLElement): TiltItem[] {
  const items: TiltItem[] = [];
  for (const el of panel.querySelectorAll<HTMLElement>(".sc-it, [data-depth]")) {
    if (el.classList.contains("sc-it")) {
      const d = Number(el.style.getPropertyValue("--d")) || 1;
      items.push({ el, kx: d * 1.1, ky: d * 0.8, unit: "cqi" });
    } else {
      const k = DEPTH_PX[el.dataset.depth ?? ""];
      if (k) items.push({ el, kx: k[0], ky: k[1], unit: "px" });
    }
  }
  return items;
}

const snap = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 20) / 20;

export function initScenes(reduced: MediaQueryList, fine: MediaQueryList): void {
  if (reduced.matches) return;
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt-scene]"));
  if (!panels.length) return;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.classList.toggle("is-vis", entry.isIntersecting);
    });
    for (const panel of panels) io.observe(panel);
  } else {
    for (const panel of panels) panel.classList.add("is-vis");
  }
  if (!fine.matches) return;
  for (const panel of panels) {
    const card = panel.closest<HTMLElement>(".pcard, .dlf") ?? panel;
    let items: TiltItem[] | null = null;
    let raf = 0;
    let x = 0;
    let y = 0;
    const write = (): void => {
      raf = 0;
      items ??= tiltItems(panel);
      for (const it of items) {
        it.el.style.translate = x === 0 && y === 0
          ? ""
          : `${(-x * it.kx).toFixed(2)}${it.unit} ${(-y * it.ky).toFixed(2)}${it.unit}`;
      }
    };
    const queue = (nx: number, ny: number): void => {
      if (nx === x && ny === y) return;
      x = nx;
      y = ny;
      if (!raf) raf = requestAnimationFrame(write);
    };
    card.addEventListener("pointermove", (e) => {
      const r = panel.getBoundingClientRect();
      queue(snap(((e.clientX - r.left) / r.width) * 2 - 1), snap(((e.clientY - r.top) / r.height) * 2 - 1));
    });
    card.addEventListener("pointerleave", () => queue(0, 0));
  }
}

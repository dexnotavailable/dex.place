// Way 4's slide-off (lane F's ask, lanes/motion/NOTEBOOK.md ASKS 0000b; Dex 10-19: the world takes the screen without a
// cut). When the player presses at the jetty, lane F opens the live world from the jetty's window to the whole screen and
// tells the page, by events on `document` (neither lane imports the other):
// - "dex:slideoff" { rect, duration, ease }: every website surface slides off screen away from the window (what is left
//   of it goes left, right goes right, above goes up, below goes down; what overlaps it goes the way its centre leans),
//   on F's duration and ease, and stays hidden. The window ([data-jetty-scene]) and the world (.world) are F's: never
//   touched. Reduced motion: nothing slides; everything is hidden at the end.
// - "dex:slideback": everything back at once (the page is then at its top behind the full-screen world). The home's
//   choreography (motion/choreo.ts) re-arms its bands off the same event.
// Small on purpose (it rides in the main bundle, so it works with or without the choreography): the browser's own
// animations, on `translate` (it adds to whatever GSAP is doing with a transform, never replaces it).

export const SLIDEOFF_EVENT = "dex:slideoff";
export const SLIDEBACK_EVENT = "dex:slideback";

export interface Box { left: number; top: number; width: number; height: number }
export interface SlideOff { rect: Box; duration: number; ease?: string }

/** The website's surfaces: the header, each band's paper and its place and fore piece, the footer, the jetty's paper. */
export const SURFACES = ".hdr, .band__site, .band__world, .band__fore, .ftr, .jetty__paper";
/** GSAP's expo.inOut as a CSS curve (the one ease F names). */
const EASES: Readonly<Record<string, string>> = { "expo.inOut": "cubic-bezier(0.87, 0, 0.13, 1)" };
/** How far past the screen's edge a surface goes (css px). */
const PAD = 16;

/**
 * Where a surface goes to leave the screen away from the window (css px, translate). Pure.
 * Wholly on one side of the window: that way. Overlapping it: the way its centre leans most (as a share of the window).
 */
export function awayFrom(el: Box, rect: Box, vw: number, vh: number): [number, number] {
  const right = el.left + el.width, bottom = el.top + el.height;
  const go = {
    left: [-right - PAD, 0] as [number, number],
    right: [vw - el.left + PAD, 0] as [number, number],
    up: [0, -bottom - PAD] as [number, number],
    down: [0, vh - el.top + PAD] as [number, number],
  };
  if (right <= rect.left) return go.left;
  if (el.left >= rect.left + rect.width) return go.right;
  if (bottom <= rect.top) return go.up;
  if (el.top >= rect.top + rect.height) return go.down;
  const nx = (el.left + el.width / 2 - (rect.left + rect.width / 2)) / Math.max(1, rect.width);
  const ny = (el.top + el.height / 2 - (rect.top + rect.height / 2)) / Math.max(1, rect.height);
  if (Math.abs(nx) >= Math.abs(ny)) return nx < 0 ? go.left : go.right;
  return ny < 0 ? go.up : go.down;
}

export function initSlideoff(reduced: MediaQueryList): void {
  let moved: { el: HTMLElement; anim: Animation | null }[] = [];
  let timer = 0;
  const hideAll = (): void => { for (const m of moved) m.el.style.visibility = "hidden"; };
  document.addEventListener(SLIDEOFF_EVENT, (e) => {
    const d = (e as CustomEvent<SlideOff>).detail;
    if (!d?.rect) return;
    clearTimeout(timer);
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const duration = Math.max(0, d.duration || 0);
    const still = reduced.matches || duration === 0 || typeof Element.prototype.animate !== "function";
    moved = Array.from(document.querySelectorAll<HTMLElement>(SURFACES))
      .filter((el) => !el.closest("[data-jetty-scene], .world") && !el.querySelector("[data-jetty-scene], .world"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const onScreen = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
        if (still || !onScreen) return { el, anim: null };
        const [x, y] = awayFrom({ left: r.left, top: r.top, width: r.width, height: r.height }, d.rect, vw, vh);
        const anim = el.animate([{ translate: "0 0" }, { translate: `${Math.round(x)}px ${Math.round(y)}px` }], {
          duration, easing: EASES[d.ease ?? "expo.inOut"] ?? EASES["expo.inOut"], fill: "forwards",
        });
        return { el, anim };
      });
    // everything hidden once the slide is over (at once with reduced motion and no duration)
    if (duration === 0) hideAll();
    else timer = window.setTimeout(hideAll, duration);
  });
  document.addEventListener(SLIDEBACK_EVENT, () => {
    clearTimeout(timer);
    for (const m of moved) {
      m.anim?.cancel();
      m.el.style.visibility = "";
    }
    moved = [];
  });
}

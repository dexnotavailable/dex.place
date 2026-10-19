// What the page's entrances, breathing and lean are (pure: no DOM, no GSAP; motion/stage.ts plays them). Dex 10-19 (the
// redesign, lanes/roadmap/SITE-SCROLL.md): "as you scroll down the world is already there; the white backgrounds slide
// in from their direction, then the content comes in too; each card slides in with an ease; the white bands between the
// alternating sections slide in too" ... "everything alive as you move it, everything breathing subtly even when you
// don't". Pixel is for the assets; these are web motion: smooth, eased, premium.
//
// The page says what enters how with attributes (the DOM contract, lanes/motion/NOTEBOOK.md):
//   data-enter="paper|band|rise|card|fade"   the kind (below)
//   data-enter-from="left|right|up|down"     where it comes from (paper / band: its side; default left)
//   data-enter-i="<n>"                        its place in a row (staggers cards that arrive together)
//   data-enter-item                           inside a paper: comes in after the paper, in order
//   data-lean="lag|skew" (+ data-lean-k)      moves a little with the scroll's speed, settles when it stops
//   data-breathe="float|sway|pulse|glow"      breathes on its own (CSS, styles/stage.css)
// Nothing is hidden by the HTML or the CSS: only what is still below the screen when the stage starts is set back to
// its start, so a page without the script (or reduced motion) is simply all there.

export type EnterKind = "paper" | "band" | "rise" | "card" | "fade";
export type EnterFrom = "left" | "right" | "up" | "down";
export const ENTER_KINDS: readonly EnterKind[] = ["paper", "band", "rise", "card", "fade"];

/** Where a thing starts (GSAP's from-vars: px, percent of its own size, degrees). */
export interface FromVars {
  x?: number;
  xPercent?: number;
  y?: number;
  yPercent?: number;
  opacity?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  transformOrigin?: string;
}

export interface EnterPlan {
  from: FromVars;
  /** Seconds. */
  duration: number;
  /** A GSAP ease name. */
  ease: string;
  /** Seconds between neighbours arriving together (a row of cards, a paper's items). */
  stagger: number;
  /** When it starts: its top this far down the screen (0 top .. 1 foot). */
  at: number;
}

/** The ease everything premium here shares: fast off the mark, a long soft landing. */
export const EASE_IN = "expo.out";
export const EASE_ITEM = "power3.out";

/**
 * A kind's plan. paper: the white ground slides in from its side, the whole width; band: the white strip between
 * sections draws across from its side; rise: a block comes up and in; card: a card slides up with a little turn from
 * its side and lands; fade: just in.
 */
export function planOf(kind: EnterKind, from: EnterFrom = "left"): EnterPlan {
  const side = from === "right" ? 1 : -1;
  switch (kind) {
    case "paper":
      return from === "up" || from === "down"
        ? { from: { yPercent: from === "up" ? -100 : 100 }, duration: 1.1, ease: EASE_IN, stagger: 0, at: 0.92 }
        : { from: { xPercent: side * 104 }, duration: 1.15, ease: EASE_IN, stagger: 0, at: 0.92 };
    case "band":
      return { from: { scaleX: 0, transformOrigin: from === "right" ? "100% 50%" : "0% 50%" }, duration: 1, ease: EASE_IN, stagger: 0, at: 0.95 };
    case "rise":
      return { from: { y: 56, opacity: 0 }, duration: 0.9, ease: EASE_ITEM, stagger: 0.08, at: 0.9 };
    case "card":
      return { from: { y: 120, x: side * 24, rotate: side * 2.5, opacity: 0, scale: 0.94 }, duration: 1.2, ease: EASE_IN, stagger: 0.1, at: 0.94 };
    case "fade":
      return { from: { opacity: 0 }, duration: 0.8, ease: "power2.out", stagger: 0.06, at: 0.92 };
  }
}

/** Where every entrance ends: the thing as the page has it (no offset, no turn, full size, opaque). */
export function restOf(from: FromVars): FromVars {
  const rest: FromVars = {};
  for (const key of Object.keys(from) as (keyof FromVars)[]) {
    if (key === "transformOrigin") continue;
    (rest as Record<string, number>)[key] = key === "opacity" || key.startsWith("scale") ? 1 : 0;
  }
  return rest;
}

/** A paper's items: they come in once the paper is most of the way across. */
export const ITEMS = { plan: planOf("rise"), after: 0.45 } as const;

/** Reads data-enter / data-enter-from (null: not an entrance this stage knows). */
export function parseEnter(kind: string | undefined, from: string | undefined): { kind: EnterKind; from: EnterFrom } | null {
  if (!kind || !(ENTER_KINDS as readonly string[]).includes(kind)) return null;
  const f = from === "right" || from === "up" || from === "down" ? from : "left";
  return { kind: kind as EnterKind, from: f };
}

/**
 * Whether a thing still has its entrance ahead of it when the stage starts: its top is below where it would start
 * (anything already on the screen, or above it, is simply there: it never disappears to come in again).
 */
export function isAhead(top: number, vh: number, plan: EnterPlan): boolean {
  return top > vh * plan.at;
}

/** GSAP's start for a plan: clamped, so a thing near the page's foot that can never reach its line still comes in. */
export function startOf(plan: EnterPlan): string {
  return `clamp(top ${Math.round(plan.at * 100)}%)`;
}

export type LeanKind = "lag" | "skew";
/**
 * How far a leaning thing is pushed by the scroll's speed (px a second; down positive): lag trails the scroll (moves
 * against it, px), skew shears with it (deg). Small, clamped, and 0 when the page is still.
 */
export function leanOf(kind: LeanKind, velocity: number, k = 1): number {
  if (!Number.isFinite(velocity) || velocity === 0) return 0;
  if (kind === "skew") return clampAbs((velocity / 1000) * 1.6 * k, 3 * k);
  return clampAbs((-velocity / 1000) * 10 * k, 22 * k);
}

const clampAbs = (v: number, m: number): number => (v > m ? m : v < -m ? -m : v);

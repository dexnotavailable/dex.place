// The stage's handle for code outside it (lane K's project cards, a page's own choreography), without pulling the
// libraries into the main bundle: `onStage(cb)` calls back once motion/stage.ts has started (at once if it already
// has), with the same GSAP, ScrollTrigger and Lenis it runs. It never calls back when the stage does not start
// (reduced motion, Save-Data, an embed): the page is then simply all there and needs nothing more.

import type { EnterFrom, EnterKind } from "./stage-plan.ts";

export const STAGE_EVENT = "dex:stage";

export interface Stage {
  /** GSAP (gsap.core), registered with ScrollTrigger. */
  gsap: typeof import("gsap").gsap;
  ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger;
  /** The smooth wheel (desktop pointers only; null on touch screens, which keep their own scroll). */
  lenis: import("lenis").default | null;
  /** Gives elements an entrance from code, as data-enter would (only what is still below the screen moves). */
  enter(els: Element | readonly Element[], kind: EnterKind, from?: EnterFrom): void;
  /** Measures every trigger again (after a layout change the page did itself). */
  refresh(): void;
}

let current: Stage | null = null;
const waiting: ((s: Stage) => void)[] = [];

/** motion/stage.ts: the stage is up. */
export function stageStarted(s: Stage): void {
  current = s;
  waiting.splice(0).forEach((cb) => cb(s));
  document.dispatchEvent(new CustomEvent<Stage>(STAGE_EVENT, { detail: s }));
}

/** motion/stage.ts: the stage is down again (reduced motion switched on). */
export function stageStopped(): void {
  current = null;
}

/** Calls back with the stage once it has started (at once if it has). */
export function onStage(cb: (s: Stage) => void): void {
  if (current) cb(current);
  else waiting.push(cb);
}

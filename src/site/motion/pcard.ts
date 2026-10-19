// The project cards' motion (lane K, lanes\motion\DESIGN-1019.md 5.5-5.7 and the contract in 7.3). Lane G calls
// initCards on the home page (its choreography decides when the entrance plays); main.ts's "cards" step calls it on
// pages without that choreography. K never imports G, and never uses ScrollTrigger (the touch tilt is CSS).
//
// Commit 0 (the seam): the contract with no-op bodies; the timelines are empty.

import { gsap } from "gsap";

export interface CardHost {
  /** prefers-reduced-motion: reduce */
  reduced: boolean;
  /** (hover: hover) and (pointer: fine) */
  fine: boolean;
  /** G: smoothed scroll speed n, -1..1, 0 at rest (DESIGN-1019 4.3); K reads it in gsap.ticker. */
  velocity?: () => number;
}

export interface CardDeck {
  /** Pre-entrance pose for every card (hidden). G calls it in the same tick it creates the trigger, and only when
   *  the deck is wholly below the fold. No-op under reduced motion. */
  prime(): void;
  /** A paused timeline of the entrance (5.5). side: where the cards come from. index: one card only (phones);
   *  without it, all three with K's stagger. Empty timeline under reduced motion. */
  entrance(o: { side: "l" | "r"; index?: number }): gsap.core.Timeline;
  /** The landed pose now, no motion (deep links, bands already passed, focus inside, the watchdog). */
  settle(): void;
  /** Back to the primed pose (the band dropped wholly below the viewport again). */
  reset(): void;
  /** Idle loops and rig life on or off (G: band visibility). K also pauses itself off screen. */
  live(on: boolean): void;
  destroy(): void;
}

/** list = the ul[data-pcards]. Without a host.velocity (deep pages), there is no skew. */
export function initCards(list: HTMLElement, host: CardHost): CardDeck {
  void list;
  void host;
  return {
    prime() {},
    entrance: () => gsap.timeline({ paused: true }),
    settle() {},
    reset() {},
    live() {},
    destroy() {},
  };
}

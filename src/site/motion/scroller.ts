// The one way the page scrolls itself (lanes/motion/DESIGN-1019.md 6.1, 6.4 item 2). Tiny on purpose, so lane F's
// column.ts can use it without pulling anything in: without the smooth wheel (touch screens, reduced motion, before
// phase G3) `scroller.to` is exactly window.scrollTo; once motion/choreo.ts has Lenis running it registers it here and
// every jump goes through the same glide, never fighting it.

export interface ScrollTarget {
  /** Land at once (no glide). */
  immediate?: boolean;
  /** Seconds of glide (Lenis only). */
  duration?: number;
  /** css px added to the target (e.g. -64 for the header). */
  offset?: number;
}

/** What a smooth scroller (Lenis) offers here. */
export interface Smooth {
  scrollTo(target: number | HTMLElement, o?: ScrollTarget & { force?: boolean }): void;
  stop(): void;
  start(): void;
}

let smooth: Smooth | null = null;

/** motion/choreo.ts: the smooth wheel is on (or off again: null). */
export function useSmooth(s: Smooth | null): void {
  smooth = s;
}

export const scroller = {
  to(target: number | HTMLElement, o: ScrollTarget = {}): void {
    if (smooth) {
      smooth.scrollTo(target, { ...o, force: true });
      return;
    }
    const top = typeof target === "number" ? target + (o.offset ?? 0) : target.getBoundingClientRect().top + window.scrollY + (o.offset ?? 0);
    window.scrollTo({ top, behavior: o.immediate ? "instant" : "smooth" });
  },
  /** Holds the page still (the cutscene, an open dialog); start() lets it go. Nothing without the smooth wheel. */
  stop(): void {
    smooth?.stop();
  },
  start(): void {
    smooth?.start();
  },
};

// The page column's world window (GDK 3.7, 3.8): Tesu framed on the website's pages. A
// same-origin frame keeps the world's styles and ids apart from the website's. The page
// scrolls on through the frame (the wheel, a vertical swipe and Page Up or Down all move the
// page, never the world), links from the world's panels open in the page itself, and the
// page holds the world while the website covers it.
//
// On "/" the world waits for PLAY (or the "continue" fall) with Kagami still; on a section's
// page it stands at that section's place (a spawn), so scrolling up finds her there.

import type { WorldHandle } from "../site/motion/world.ts";
import type { OpeningLink } from "./opening/conductor.ts";

/** What the opening needs in memory before "continue" (main.ts openingSet). */
export interface OpeningSet {
  /** Plates along the opening camera's path (0..1). */
  plates: number;
  close: boolean;
  font: boolean;
  ofuda: boolean;
  warming: boolean;
}

interface Runtime {
  game: {
    loading: boolean;
    holding: boolean;
    setAway(away: boolean): void;
    titles: { show(text: string, big: boolean): void };
  };
  panels: { open: boolean };
  play(link?: OpeningLink): void;
  audio(ctx: AudioContext): void;
  openingSet?(): OpeningSet;
  holdFor?(way: "top" | "bottom", fx?: number, fy?: number, artCss?: number): void;
}
type TesuWindow = Window & { __tesu?: Runtime };

export interface TesuMountOptions {
  /** "/": hold for PLAY. */
  hold?: boolean;
  /** A section's page: the spawn she stands at. */
  at?: string;
}

export interface TesuHandle extends WorldHandle {
  /** The press (PLAY or "continue"): the opening starts on the page's conductor (its clock, its audio). */
  play(link?: OpeningLink): void;
  /** The opening set's state (null until the world's code runs). */
  openingSet(): OpeningSet | null;
  /** A big title in the world window (TESU for a visitor who scrolls on past PLAY). */
  title(text: string): void;
  /** Still waiting for PLAY. */
  holding(): boolean;
  /**
   * (lane F, way 4) What the held world shows: the black slab over the sky (top), or the website's jetty window
   * (bottom): way 4's first frame with her at frame point (fx, fy), shares of this frame, `artCss` css px per art px.
   */
  hold(way: "top" | "bottom", fx?: number, fy?: number, artCss?: number): void;
  /**
   * (engine 10-18) How far the world has loaded, 0..1, never going back: ~0.05 once its frame starts loading, ~0.15
   * when its code runs, ~0.4 when its first scene is drawn, then the opening set's share; 1 when it is playable AND the
   * opening set is in (when the loader may land on the ofuda).
   */
  progress(): number;
}

/**
 * (engine) The loader's progress for a world in this state, 0..1: ~0.05 once its frame loads, 0.15 when its code
 * runs, 0.4 when its first scene is drawn, then the opening set's share up to 0.99, and exactly 1 when it is playable
 * with the whole set in. (Counted in tenths: 0.7 + 0.1 + 0.1 + 0.1 in floating point is 0.9999999999999999.)
 */
export function progressValue(s: { started: boolean; booted: boolean; drawn: boolean; playable: boolean; set: OpeningSet | null }): number {
  let p = s.started ? 0.05 : 0;
  if (s.booted) p = 0.15;
  if (s.drawn) p = 0.4;
  if (s.drawn && s.set) {
    const tenths = Math.min(1, Math.max(0, s.set.plates)) * 7 + (s.set.close ? 1 : 0) + (s.set.font ? 1 : 0) + (s.set.ofuda ? 1 : 0);
    p = s.playable && tenths >= 10 - 1e-9 ? 1 : Math.min(0.99, 0.4 + 0.059 * tenths);
  } else if (s.playable && !s.set) p = 1;
  return p;
}

export function tesuFrameUrl(opts: TesuMountOptions): string {
  const url = new URL("/tesu/", location.href);
  url.searchParams.set("embed", "site");
  if (opts.hold) url.searchParams.set("hold", "");
  if (opts.at) url.searchParams.set("at", opts.at);
  return url.pathname + url.search.replace(/=(?=&|$)/g, "");
}

export function mount(stage: HTMLElement, opts: TesuMountOptions = {}): TesuHandle {
  const frame = document.createElement("iframe");
  frame.className = "world__frame";
  frame.title = "Tesu, the world";
  frame.inert = true;
  frame.tabIndex = -1;
  frame.setAttribute("data-world-frame", "");
  frame.setAttribute("allow", "autoplay");
  // (engine 10-18, loading) the frame starts loading once the page has loaded and has a quiet moment, so "dex" and
  // the website get the line and the thread first; the world's own boot then works in short slices (main.ts)
  let started = false;
  const begin = (): void => {
    if (started || destroyed) return;
    started = true;
    waited = 0;
    last = performance.now();
    frame.src = tesuFrameUrl(opts);
  };
  const idle = (): void => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(begin, { timeout: 600 });
    else setTimeout(begin, 100);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
  let paused = false;
  let destroyed = false;
  let configured = false;
  let playable = false;
  let waitingFocus = false;
  let pendingPlay: OpeningLink | null | undefined;
  const cleanups: (() => void)[] = [];
  const win = (): TesuWindow | null => frame.contentWindow as TesuWindow | null;
  const runtime = (): Runtime | undefined => win()?.__tesu;
  const sync = (): void => runtime()?.game.setAway(paused);
  const listen = (target: EventTarget, name: string, fn: EventListener, options?: AddEventListenerOptions): void => {
    target.addEventListener(name, fn, options);
    cleanups.push(() => target.removeEventListener(name, fn, options));
  };
  const focus = (): void => {
    // asked while paused (the "continue" fall ends as the world comes into view) or still
    // loading: kept, and done on resume or once playable
    waitingFocus = true;
    if (paused || !playable) return;
    const view = win()?.document.getElementById("view");
    if (!view) return;
    view.focus({ preventScroll: true });
    if (win()?.document.activeElement === view) waitingFocus = false;
  };
  const configure = (): void => {
    const child = win();
    if (!child || configured) return;
    const doc = child.document;
    if (!doc.getElementById("view")) return;
    configured = true;
    const inPanel = (target: EventTarget | null): boolean => {
      const el = target as Element | null;
      return !!runtime()?.panels.open || (typeof el?.closest === "function" && !!el.closest("#panel-layer"));
    };
    // the wheel moves the page, never the world
    listen(doc, "wheel", ((event: WheelEvent) => {
      if (inPanel(event.target) || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      window.scrollBy({ top: event.deltaY * unit, behavior: "instant" });
    }) as EventListener, { passive: false });
    // a vertical swipe on the world (not on its controls) moves the page too
    let touch: { x: number; y: number } | null = null;
    listen(doc, "touchstart", ((event: TouchEvent) => {
      const target = event.target as Element | null;
      if (target?.id !== "view" || inPanel(event.target) || event.touches.length !== 1) { touch = null; return; }
      touch = { x: event.touches[0]!.screenX, y: event.touches[0]!.screenY };
    }) as EventListener, { passive: true });
    listen(doc, "touchmove", ((event: TouchEvent) => {
      if (!touch || inPanel(event.target) || event.touches.length !== 1) return;
      const next = event.touches[0]!;
      const dy = touch.y - next.screenY;
      if (Math.abs(dy) > Math.abs(touch.x - next.screenX) * 1.5 && Math.abs(dy) > 6) {
        event.preventDefault();
        window.scrollBy({ top: dy, behavior: "instant" });
        touch = { x: next.screenX, y: next.screenY };
      }
    }) as EventListener, { passive: false });
    // links in the world's panels open the website itself, not a website inside the frame
    listen(doc, "click", ((event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const el = event.target as Element | null;
      const link = typeof el?.closest === "function" ? el.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/tesu/")) return;
      event.preventDefault();
      location.assign(url.href);
    }) as EventListener);
  };
  listen(frame, "load", configure as EventListener);
  stage.append(frame);

  let markReady: () => void = () => {};
  let failReady: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => { markReady = resolve; failReady = reject; });
  let markShown: () => void = () => {};
  const shown = new Promise<void>((resolve) => { markShown = resolve; });
  let markBooted: () => void = () => {};
  const booted = new Promise<void>((resolve) => { markBooted = resolve; });
  let drawn = false;
  let settled = false;
  let waited = 0;
  let last = performance.now();
  const stop = (): void => { settled = true; clearInterval(poll); };
  const check = (): void => {
    if (destroyed || settled) return;
    const now = performance.now();
    if (started && !paused && document.visibilityState === "visible") waited += now - last;
    last = now;
    configure();
    sync();
    const fail = win()?.document.getElementById("fail");
    if (fail && !fail.hidden) { stop(); failReady(new Error(fail.textContent || "The world failed to load")); return; }
    const rt = runtime();
    if (rt) markBooted();
    if (rt && !rt.game.loading && !drawn) {
      drawn = true;
      frame.style.opacity = "1";
      markShown();
    }
    if (rt && !rt.game.loading) {
      stop();
      playable = true;
      frame.inert = false;
      frame.tabIndex = 0;
      if (pendingPlay !== undefined) doPlay(pendingPlay);
      if (waitingFocus && !paused) focus();
      markReady();
    } else if (waited > 60000) {
      stop();
      failReady(new Error("The world took too long to load"));
    }
  };
  const poll = window.setInterval(check, 100);
  const watch = (): void => {
    check();
    if (!destroyed && !settled) requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);

  const doPlay = (link: OpeningLink | null): void => {
    const rt = runtime();
    if (!rt) { pendingPlay = link; return; }
    pendingPlay = undefined;
    rt.play(link ?? undefined);
    focus();
  };

  let progressed = 0;
  const progress = (): number => {
    const p = progressValue({ started, booted: !!runtime(), drawn, playable, set: runtime()?.openingSet?.() ?? null });
    progressed = Math.max(progressed, p);
    return progressed;
  };

  return {
    ready, shown, booted, focus, progress,
    play: (link) => doPlay(link ?? null),
    openingSet: () => runtime()?.openingSet?.() ?? null,
    title: (text) => runtime()?.game.titles.show(text, true),
    holding: () => runtime()?.game.holding ?? true,
    hold: (w, fx, fy, artCss) => runtime()?.holdFor?.(w, fx, fy, artCss),
    pause: () => { paused = true; waitingFocus = false; sync(); },
    resume: () => { paused = false; last = performance.now(); sync(); if (waitingFocus) focus(); },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      stop();
      for (const c of cleanups) c();
      frame.remove();
      failReady(new Error("The world window closed"));
    },
  };
}

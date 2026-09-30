// Thin homepage adapter: /world/ continues to own gameplay, panels and saves.
// The same-origin frame isolates world CSS/IDs from the authored website.
import type { WorldHandle } from "../site/motion/world.ts";

interface Runtime {
  game: { loading: boolean; fade: number; setAway(away: boolean): void;
    room: { backdrop?: { ready(): boolean } }; panels: { open: boolean } };
}
type WorldWindow = Window & { __world?: Runtime };

/** Shareable room/spawn links work on the homepage; test/destructive flags do not propagate. */
export function worldFrameUrl(current: string): string {
  const url = new URL("/world/", current);
  const query = new URL(current).searchParams;
  for (const key of ["room", "spawn", "world"]) {
    if (query.has(key)) url.searchParams.set(key, query.get(key) ?? "");
  }
  url.searchParams.set("embed", "site");
  return url.pathname + url.search;
}

export function mount(stage: HTMLElement): WorldHandle {
  const frame = document.createElement("iframe");
  frame.className = "world__frame";
  frame.title = "World";
  frame.inert = true;
  frame.tabIndex = -1;
  frame.setAttribute("data-world-frame", "");
  frame.src = worldFrameUrl(location.href);
  let paused = false;
  let destroyed = false;
  let configured = false;
  let waitingFocus = false;
  let playable = false;
  let visibleWait = 0;
  let last = performance.now();
  const cleanups: (() => void)[] = [];
  const win = (): WorldWindow | null => frame.contentWindow as WorldWindow | null;
  const runtime = (): Runtime | undefined => win()?.__world;
  const sync = (): void => { runtime()?.game.setAway(paused); };
  const focus = (): void => {
    if (paused) return;
    waitingFocus = true;
    if (!playable) return;
    const doc = win()?.document;
    const target = runtime()?.game.panels.open ? doc?.querySelector<HTMLElement>("#panel .close") : doc?.getElementById("view");
    if (target) { target.focus({ preventScroll: true }); waitingFocus = false; }
  };
  const listen = (target: EventTarget, name: string, fn: EventListener, options?: AddEventListenerOptions): void => {
    target.addEventListener(name, fn, options);
    cleanups.push(() => target.removeEventListener(name, fn, options));
  };
  const configure = (): void => {
    const child = win();
    if (!child || configured) return;
    const doc = child.document;
    if (!doc.getElementById("view")) return;
    configured = true;
    const style = doc.createElement("style");
    style.textContent = "html,body{height:100%;overflow:hidden}#site{display:none}#stage{position:relative;height:100%}";
    doc.head.append(style);
    const inPanel = (target: EventTarget | null): boolean => {
      const el = target as Element | null;
      return !!runtime()?.game.panels.open || typeof el?.closest === "function" && !!el.closest("#panel");
    };
    listen(doc, "wheel", ((event: WheelEvent) => {
      if (inPanel(event.target) || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      window.scrollBy({ top: event.deltaY * unit, behavior: "instant" });
    }) as EventListener, { passive: false });
    let touch: { x: number; y: number } | null = null;
    listen(doc, "touchstart", ((event: TouchEvent) => {
      const target = event.target as Element | null;
      if (target?.id !== "view" || inPanel(event.target) || event.touches.length !== 1) { touch = null; return; }
      // The frame's inset changes as the bars recede. Screen coordinates keep
      // that layout movement from feeding back into the finger's delta.
      touch = { x: event.touches[0]!.screenX, y: event.touches[0]!.screenY };
    }) as EventListener, { passive: true });
    listen(doc, "touchmove", ((event: TouchEvent) => {
      if (!touch || inPanel(event.target) || event.touches.length !== 1) return;
      const next = event.touches[0]!;
      const dy = touch.y - next.screenY;
      if (Math.abs(dy) > Math.abs(touch.x - next.screenX) && Math.abs(dy) > 4) {
        event.preventDefault();
        window.scrollBy({ top: dy, behavior: "instant" });
        touch = { x: next.screenX, y: next.screenY };
      }
    }) as EventListener, { passive: false });
    // A panel's "Open as a page" link opens the full website, not a website
    // inside the world viewport. Inner docs frames keep their own navigation.
    listen(doc, "click", ((event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const el = event.target as Element | null;
      const link = typeof el?.closest === "function" ? el.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target && link.target !== "_self" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/world/")) return;
      event.preventDefault();
      location.assign(url.href);
    }) as EventListener);
    if (waitingFocus && !paused && playable) focus();
  };
  listen(frame, "load", configure as EventListener);
  stage.append(frame);
  let resolveReady: () => void = () => {};
  let rejectReady: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const poll = window.setInterval(() => {
    if (destroyed) return;
    const now = performance.now();
    if (!paused) visibleWait += now - last;
    last = now;
    configure(); sync();
    const fail = win()?.document.getElementById("fail");
    if (fail && !fail.hidden) {
      clearInterval(poll); rejectReady(new Error(fail.textContent || "World failed to load")); return;
    }
    const game = runtime()?.game;
    if (game && !game.loading && game.fade < 0.01 && (game.room.backdrop?.ready() ?? true)) {
      clearInterval(poll);
      playable = true;
      frame.inert = false;
      frame.tabIndex = 0;
      if (waitingFocus && !paused) focus();
      resolveReady();
    } else if (visibleWait > 60000) {
      clearInterval(poll); rejectReady(new Error("World loading timed out"));
    }
  }, 100);
  return {
    ready, focus,
    pause: () => { paused = true; waitingFocus = false; sync(); },
    resume: () => { paused = false; last = performance.now(); sync(); },
    destroy: () => {
      if (destroyed) return;
      destroyed = true; clearInterval(poll);
      for (const cleanup of cleanups) cleanup();
      frame.remove();
      rejectReady(new Error("World mount closed"));
    },
  };
}

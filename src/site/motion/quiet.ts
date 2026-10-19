// The "dex" mark's moment is its own (Dex 10-19: "when it draws 'dex' at the start it lags"). The world's frame boots
// on the page's own thread (same origin), and the website's windows paint as their results land, so while the mark
// writes itself (~1.4 s) nothing heavy may start: they wait for `afterMark()`.
//
// The page column (motion/column.ts) calls markStart() as the pen touches down and markDone() once the mark is
// written, or at once when it does not draw it now (the game screen covered: a deep link, a restored scroll). A page
// without the game screen has no mark. If the column never says (its chunk failed), the wait gives up after a few
// seconds (and a started mark gets a little longer than its draw): the world always loads.

export const MARKED_EVENT = "dex:marked";
/** The longest the heavy work waits for the mark (ms): for the column to start it, then for its draw (~1.4 s). */
export const MARK_WAIT_MS = 4000;
export const DRAW_WAIT_MS = 2500;

let marked = false;
let waiters: (() => void)[] = [];
let timer = 0;
const settle = (): void => {
  if (marked) return;
  marked = true;
  clearTimeout(timer);
  document.documentElement.setAttribute("data-marked", "");
  waiters.splice(0).forEach((f) => f());
};

/** The column: the pen touches down (the wait now lasts at most the draw and a little). */
export function markStart(): void {
  if (marked) return;
  clearTimeout(timer);
  timer = window.setTimeout(settle, DRAW_WAIT_MS);
}

/** The column: the mark is written (or is not being drawn now). */
export function markDone(): void {
  if (marked) return;
  settle();
  document.dispatchEvent(new CustomEvent(MARKED_EVENT));
}

/** Resolves once the "dex" mark has written itself, at once on a page without one (or after MARK_WAIT_MS). */
export function afterMark(): Promise<void> {
  if (marked || !document.querySelector("[data-gs-title]")) return Promise.resolve();
  return new Promise((res) => {
    waiters.push(res);
    if (waiters.length === 1) {
      document.addEventListener(MARKED_EVENT, settle, { once: true });
      if (!timer) timer = window.setTimeout(settle, MARK_WAIT_MS);
    }
  });
}

/** (checks) Back to the start. */
export function resetMark(): void {
  marked = false;
  waiters = [];
  clearTimeout(timer);
  timer = 0;
}

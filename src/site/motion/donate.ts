// /donate/ amount slider and quick picks (code-split: main.ts loads this only
// when the page has [data-donate]). The prerendered page already shows the
// account-only QR; this redraws it live with the chosen amount.
//
// State: 0 = no amount (the default, and what "Any amount" returns to), or a
// stop from 100,000 to 10,000,000 VND (src/site/donate.ts).

import { STOPS, amountAt, donateQr, fineText, formatVnd, groupVnd, indexOf } from "../donate.ts";

const LAST = STOPS.length - 1;
const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/** Restarts a one-shot CSS animation class. */
function replay(el: Element | null, name: string): void {
  if (!el) return;
  el.classList.remove(name);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(name);
  el.addEventListener("animationend", () => el.classList.remove(name), { once: true });
}

export function initDonate(reduced: MediaQueryList): void {
  const card = document.querySelector<HTMLElement>("[data-donate]");
  const range = card?.querySelector<HTMLInputElement>("[data-amt-range]");
  if (!card || !range) return;
  const slider = range.parentElement as HTMLElement;
  const qr = card.querySelector<HTMLElement>("[data-qr]");
  const code = card.querySelector<HTMLElement>("[data-qr-code]");
  const tag = card.querySelector<HTMLElement>("[data-qr-tag]");
  const num = card.querySelector<HTMLElement>("[data-amt-num]");
  const fine = card.querySelector<HTMLElement>("[data-amt-fine]");
  const live = card.querySelector<HTMLElement>("[data-amt-live]");
  const picks = [...card.querySelectorAll<HTMLButtonElement>("[data-pick]")];

  let amount = 0;
  let drawn = 0;
  let frame = 0;
  let tween = 0;
  const cache = new Map<number, string>([[0, code?.innerHTML ?? donateQr(0)]]);

  const draw = (): void => {
    frame = 0;
    if (!code || drawn === amount) return;
    let svg = cache.get(amount);
    if (!svg) cache.set(amount, (svg = donateQr(amount)));
    code.innerHTML = svg;
    drawn = amount;
  };

  const showNumber = (from: number, to: number, animate: boolean): void => {
    if (!num) return;
    cancelAnimationFrame(tween);
    if (to === 0) { num.textContent = "Any amount"; return; }
    if (!animate || from === 0 || reduced.matches) { num.textContent = groupVnd(to); return; }
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / 420);
      const e = 1 - (1 - t) ** 3;
      num.textContent = groupVnd(t < 1 ? Math.round((from + (to - from) * e) / 1000) * 1000 : to);
      if (t < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  };

  const say = (text: string): void => {
    if (!live) return;
    live.textContent = "";
    requestAnimationFrame(() => (live.textContent = text));
  };

  function set(next: number, from: "slider" | "pick"): void {
    if (next === amount) return;
    const prev = amount;
    const flip = (prev > 0) !== (next > 0);
    amount = next;

    card!.dataset.state = next > 0 ? "amount" : "none";
    slider.style.setProperty("--pos", next > 0 ? (indexOf(next) / LAST).toFixed(4) : "0");
    range!.value = String(next > 0 ? indexOf(next) : 0);
    range!.setAttribute("aria-valuetext", next > 0 ? formatVnd(next) : "No amount set");
    for (const b of picks) b.setAttribute("aria-pressed", String(Number(b.dataset.pick) === next));
    if (tag) tag.textContent = next > 0 ? formatVnd(next) : "Any amount";
    if (fine) fine.textContent = fineText(next);
    showNumber(prev, next, from === "pick");

    // Redraw on the next frame, so a fast drag draws once per frame.
    if (!frame) frame = requestAnimationFrame(draw);
    if (flip) {
      replay(qr, "is-flip");
      replay(tag, "is-pop");
    } else if (from === "pick") {
      replay(code, "is-swap");
    }
  }

  // Browsers may restore a range value on back/forward; the page always
  // starts with no amount, like its prerendered QR.
  range.value = "0";

  range.addEventListener("input", () => set(amountAt(range.valueAsNumber), "slider"));
  range.addEventListener("change", () => replay(code, "is-swap"));

  // The untouched slider sits on 100,000 and shows "Any amount". Pressing the
  // thumb there fires no input event, so a tap chooses that stop; so does the
  // first step key (except End, which goes to the top natively).
  range.addEventListener("pointerup", () => {
    requestAnimationFrame(() => {
      if (amount === 0) set(amountAt(range.valueAsNumber), "slider");
    });
  });
  range.addEventListener("keydown", (e) => {
    if (amount !== 0 || !NAV_KEYS.has(e.key) || e.key === "End") return;
    e.preventDefault();
    set(amountAt(0), "slider");
  });

  for (const b of picks) {
    b.addEventListener("click", () => {
      const next = Number(b.dataset.pick);
      replay(b, "is-pop");
      set(next, "pick");
      say(next > 0 ? `QR code updated: ${formatVnd(next)} prefilled.` : "QR code reset: no amount.");
    });
  }
}

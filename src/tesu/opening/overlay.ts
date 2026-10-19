// What the opening lays over the page (or over the world when /tesu/ runs it on its own): the cinematic
// bars (11% of the height each, in over 0.3 s in steps; out at drop 1 over 0.25 s), the letter's three lines
// as captions on a paper strip in the bottom bar, the skip chip in the bottom bar ("skip · esc", touch:
// "skip", at least 44 px to tap; it leaves WITH the bottom bar and is then removed from the page), and the
// "tap for sound" chip. Reduced motion: the bars fade instead of sliding. It brings its own styles, so it
// works in any document.

const CSS = `
.op { position: fixed; inset: 0; z-index: 45; pointer-events: none; }
.op-bar { position: absolute; left: 0; right: 0; height: VAR_BARvh; background: #000; will-change: transform; }
.op-top { top: 0; }
.op-bot { bottom: 0; display: flex; align-items: center; justify-content: center; }
.op-cap { margin: 0 auto; max-width: min(88vw, 640px); padding: 6px 14px; text-align: center; background: #fff4f1; color: #2b2233;
  box-shadow: 0 0 0 2px #2b2233; font: 400 15px / 1.4 var(--f-body, "Space Grotesk Variable", system-ui, sans-serif); visibility: hidden; }
.op-cap.on { visibility: inherit; }
.op-chip, .op-sound { position: absolute; top: 50%; translate: 0 -50%; min-height: 44px; min-width: 44px; padding: 0 14px; border: 0; cursor: pointer;
  pointer-events: auto; background: #fff4f1; color: #2b2233; box-shadow: 0 0 0 2px #2b2233, 3px 3px 0 2px rgba(0, 0, 0, 0.35);
  font: 400 13px / 1 var(--f-label, "Silkscreen", ui-monospace, monospace); letter-spacing: 0.08em; text-transform: lowercase; }
.op-chip { right: max(16px, env(safe-area-inset-right)); }
.op-sound { left: max(16px, env(safe-area-inset-left)); }
.op-chip:focus-visible, .op-sound:focus-visible { outline: 3px solid #ffc857; outline-offset: 2px; }
.op-chip[hidden], .op-sound[hidden] { display: none; }
.op-fade { position: absolute; inset: 0; background: #000; opacity: 0; }
`;

export class Overlay {
  readonly root: HTMLDivElement;
  private top: HTMLDivElement;
  private bot: HTMLDivElement;
  private cap: HTMLParagraphElement;
  readonly chip: HTMLButtonElement;
  readonly sound: HTMLButtonElement;
  readonly fade: HTMLDivElement;
  private shownBars = -1;
  private shownCap: string | null = null;
  private chipGone = false;
  private chipGoneReady = false;
  private readonly reduced: boolean;

  constructor(doc: Document, opts: { reduced: boolean; barVh: number }) {
    this.reduced = opts.reduced;
    if (!doc.getElementById("op-style")) {
      const st = doc.createElement("style");
      st.id = "op-style";
      st.textContent = CSS.replace("VAR_BAR", String(opts.barVh));
      doc.head.append(st);
    }
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] => {
      const e = doc.createElement(tag);
      e.className = cls;
      return e;
    };
    this.root = el("div", "op");
    this.root.hidden = true;
    this.fade = el("div", "op-fade");
    this.top = el("div", "op-bar op-top");
    this.bot = el("div", "op-bar op-bot");
    this.cap = el("p", "op-cap");
    this.cap.setAttribute("aria-live", "polite");
    this.chip = el("button", "op-chip");
    this.chip.type = "button";
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    this.chip.textContent = coarse ? "skip" : "skip · esc";
    this.chip.setAttribute("aria-label", "Skip the opening");
    this.chip.hidden = true;
    this.sound = el("button", "op-sound");
    this.sound.type = "button";
    this.sound.textContent = "tap for sound";
    this.sound.hidden = true;
    this.bot.append(this.cap, this.chip, this.sound);
    this.root.append(this.fade, this.top, this.bot);
    doc.body.append(this.root);
    this.bars(0);
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  /** The bars, 0 (out) to 1 (in). */
  bars(c: number): void {
    if (c === this.shownBars) return;
    this.shownBars = c;
    if (this.reduced) {
      this.top.style.opacity = this.bot.style.opacity = String(c);
      this.top.style.transform = this.bot.style.transform = "none";
    } else {
      this.top.style.transform = `translateY(${-(1 - c) * 100}%)`;
      this.bot.style.transform = `translateY(${(1 - c) * 100}%)`;
    }
    // the chip leaves with the bottom bar: once it is out the chip is gone for good (not focusable, not announced)
    if (c === 0 && this.chipGoneReady) this.removeChip();
  }

  /** After drop 1: the chip slides out with the bar, then it is removed. */
  retireChip(): void {
    this.chipGoneReady = true;
    if (this.shownBars === 0) this.removeChip();
  }

  private removeChip(): void {
    if (this.chipGone) return;
    this.chipGone = true;
    this.chip.remove();
    this.sound.remove();
  }

  caption(text: string | null): void {
    if (text === this.shownCap) return;
    this.shownCap = text;
    if (text) this.cap.textContent = text;
    this.cap.classList.toggle("on", !!text);
  }

  chipShown(on: boolean): void {
    if (this.chipGone) return;
    if (this.chip.hidden === !on) return;
    // a focused chip that hides hands focus back to the page, never to nothing
    if (!on && this.chip.ownerDocument.activeElement === this.chip) this.chip.blur();
    this.chip.hidden = !on;
  }

  soundShown(on: boolean): void {
    if (!this.chipGone) this.sound.hidden = !on;
  }

  /** A full-screen black for the reduced-motion cross-fades (0..1). */
  black(a: number): void {
    this.fade.style.opacity = String(a);
  }

  destroy(): void {
    this.root.remove();
  }
}

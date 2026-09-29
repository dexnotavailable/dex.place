// Touch controls for phones and tablets (the lab's layout plus a use button):
// a move pad bottom-left, action buttons bottom-right, small and translucent
// so the player (who stays near the middle) is never covered. The use button
// only shows while something usable is near.

import type { Action, Input } from "../lab/engine/input.ts";

interface Btn {
  el: HTMLButtonElement;
  action: Action | "use";
}

export class Touch {
  private buttons: Btn[] = [];
  shown = false;
  onUse: () => void = () => {};
  private useBtn: HTMLButtonElement | null = null;

  constructor(private input: Input, private root: HTMLElement) {
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (coarse) this.show();
    window.addEventListener("touchstart", () => this.show(), { once: true, passive: true });
  }

  show(): void {
    if (this.shown) return;
    this.shown = true;
    this.root.hidden = false;
    const make = (action: Action | "use", label: string, aria: string, css: Partial<CSSStyleDeclaration>, pad = false): HTMLButtonElement => {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = label;
      el.setAttribute("aria-label", aria);
      if (pad) el.className = "pad";
      Object.assign(el.style, css);
      const id = `touch-${action}`;
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add("on");
        if (action === "use") this.onUse();
        else this.input.down(action, id);
      };
      const up = (e: PointerEvent): void => {
        e.preventDefault();
        el.classList.remove("on");
        if (action !== "use") this.input.up(action, id);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("lostpointercapture", () => {
        el.classList.remove("on");
        if (action !== "use") this.input.up(action, id);
      });
      this.root.appendChild(el);
      this.buttons.push({ el, action });
      return el;
    };
    const safe = "max(14px, env(safe-area-inset-bottom))";
    const L = "max(14px, env(safe-area-inset-left))";
    make("left", "◀", "move left", { left: L, bottom: safe }, true);
    make("right", "▶", "move right", { left: `calc(${L} + 74px)`, bottom: safe }, true);
    make("down", "▼", "down", { left: `calc(${L} + 37px)`, bottom: `calc(${safe} + 66px)` }, true);
    const R = "max(14px, env(safe-area-inset-right))";
    make("jump", "▲", "jump", { right: R, bottom: safe });
    make("m1", "✦", "attack", { right: `calc(${R} + 64px)`, bottom: safe });
    make("m2", "»", "dash", { right: R, bottom: `calc(${safe} + 64px)` });
    make("skill", "Q", "skill", { right: `calc(${R} + 64px)`, bottom: `calc(${safe} + 64px)` });
    make("ult", "R", "ultimate", { right: `calc(${R} + 128px)`, bottom: safe });
    this.useBtn = make("use", "E", "use", { right: `calc(${R} + 128px)`, bottom: `calc(${safe} + 64px)` });
    this.useBtn.hidden = true;
  }

  /** Show the use button while something usable is near. */
  usable(on: boolean): void {
    if (this.useBtn) this.useBtn.hidden = !on;
  }

  cooldowns(skillReady: boolean, ultReady: boolean): void {
    for (const b of this.buttons) {
      if (b.action === "skill") b.el.classList.toggle("cool", !skillReady);
      if (b.action === "ult") b.el.classList.toggle("cool", !ultReady);
    }
  }
}

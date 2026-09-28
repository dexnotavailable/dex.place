// Minimal touch controls for phones and iPad: a move pad bottom-left and
// action buttons bottom-right, small and translucent so the character (who
// stays near the middle of the frame) is never covered.

import type { Action, Input } from "../engine/input.ts";

interface Btn {
  el: HTMLButtonElement;
  action: Action;
}

export class Touch {
  private buttons: Btn[] = [];
  private root: HTMLElement;
  shown = false;

  constructor(private input: Input, root: HTMLElement) {
    this.root = root;
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (coarse) this.show();
    window.addEventListener("touchstart", () => this.show(), { once: true, passive: true });
  }

  private show(): void {
    if (this.shown) return;
    this.shown = true;
    this.root.hidden = false;
    const make = (action: Action, label: string, aria: string, css: Partial<CSSStyleDeclaration>, pad = false): void => {
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
        this.input.down(action, id);
      };
      const up = (e: PointerEvent): void => {
        e.preventDefault();
        el.classList.remove("on");
        this.input.up(action, id);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("lostpointercapture", () => {
        el.classList.remove("on");
        this.input.up(action, id);
      });
      this.root.appendChild(el);
      this.buttons.push({ el, action });
    };
    const safe = "max(14px, env(safe-area-inset-bottom))";
    make("left", "◀", "move left", { left: "max(14px, env(safe-area-inset-left))", bottom: safe }, true);
    make("right", "▶", "move right", { left: "calc(max(14px, env(safe-area-inset-left)) + 74px)", bottom: safe }, true);
    const R = "max(14px, env(safe-area-inset-right))";
    make("jump", "▲", "jump", { right: R, bottom: safe });
    make("m1", "M1", "attack", { right: `calc(${R} + 64px)`, bottom: safe });
    make("m2", "M2", "dash", { right: R, bottom: `calc(${safe} + 64px)` });
    make("skill", "Q", "skill", { right: `calc(${R} + 64px)`, bottom: `calc(${safe} + 64px)` });
    make("ult", "R", "ultimate", { right: `calc(${R} + 128px)`, bottom: safe });
  }

  /** Dim Q / R while they recover. */
  cooldowns(skillReady: boolean, ultReady: boolean): void {
    for (const b of this.buttons) {
      if (b.action === "skill") b.el.classList.toggle("cool", !skillReady);
      if (b.action === "ult") b.el.classList.toggle("cool", !ultReady);
    }
  }
}

// Touch controls for phones and tablets (the lab's layout plus a use button):
// a move pad bottom-left, action buttons bottom-right, small and translucent
// so the player (who stays near the middle) is never covered. The use button
// only shows while something usable is near.

import type { Action, Input } from "../lab/engine/input.ts";

interface Btn {
  el: HTMLButtonElement;
  action: Action | "use";
  normalStyle: string;
}

export class Touch {
  private buttons: Btn[] = [];
  shown = false;
  onUse: () => void = () => {};
  private useBtn: HTMLButtonElement | null = null;
  private presentationKey = "";
  private insets = { left: 0, right: 0 };
  private pointers = new Set<number>();

  constructor(private input: Input, private root: HTMLElement) {
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (coarse) this.show();
    window.addEventListener("touchstart", () => this.show(), { once: true, passive: true });
    window.addEventListener("resize", () => { this.presentationKey = ""; });
    // E can hide after sitting and lose capture before the finger lifts.
    // Keep that physical pointer in the layout guard until its actual end.
    const ended = (e: PointerEvent): void => { this.pointers.delete(e.pointerId); };
    window.addEventListener("pointerup", ended);
    window.addEventListener("pointercancel", ended);
    window.addEventListener("blur", () => { this.pointers.clear(); });
  }

  show(): void {
    if (this.shown) return;
    this.shown = true;
    this.presentationKey = "";
    this.root.hidden = false;
    const make = (action: Action | "use", label: string, aria: string, css: Partial<CSSStyleDeclaration>, pad = false): HTMLButtonElement => {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = label;
      el.setAttribute("aria-label", aria);
      el.dataset.action = action;
      if (pad) el.className = "pad";
      Object.assign(el.style, css);
      const id = `touch-${action}`;
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        this.pointers.add(e.pointerId);
        el.setPointerCapture(e.pointerId);
        el.classList.add("on");
        if (action === "use") this.onUse();
        else this.input.down(action, id);
      };
      const up = (e: PointerEvent): void => {
        e.preventDefault();
        this.pointers.delete(e.pointerId);
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
      this.buttons.push({ el, action, normalStyle: el.style.cssText });
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

  /** Keep the full controls outside a held vista, without moving a held target.
   * Returned insets describe the APPLIED layout, including pointer deferral. */
  present(scenic: boolean, width: number, height: number): { left: number; right: number } {
    if (!this.shown) return this.insets;
    const key = `${scenic}:${width}:${height}`;
    if (key === this.presentationKey || this.pointers.size > 0) return this.insets;
    const css = getComputedStyle(this.root);
    const safe = (side: string): number => Math.max(0, parseFloat(css.getPropertyValue(`--touch-safe-${side}`)) || 0);
    const left = safe("left"), right = safe("right"), top = Math.max(10, safe("top")), bottom = Math.max(14, safe("bottom"));
    let layout = "normal";
    if (scenic && width > height) {
      // A single row fits the tablet's existing lower letterbox. The E slot
      // stays reserved even while hidden, so no other target shifts.
      if (width - left - right >= 640 && (height - width * 9 / 16) / 2 >= bottom + 64) layout = "row";
      // Five 54px actions on the right; three 64px pads and E on the left,
      // with room above E for sound. Never clip controls on short viewports.
      else if (width - left - right >= 600 && height - top - bottom >= 296) layout = "rails";
      // The homepage's authored bars shorten its iframe. Wider side gutters
      // fit a two-column pad/action arrangement without removing controls.
      else if (width - left - right >= 700 && height - top - bottom >= 240) layout = "compact-rails";
    }
    const railWidth = layout === "compact-rails" ? 146 : 76;
    const railLeft = left + railWidth, railRight = right + railWidth;
    for (const b of this.buttons) {
      b.el.style.cssText = b.normalStyle;
      if (layout === "compact-rails") {
        const pads: Record<string, [number, number]> = { left: [6, 0], right: [80, 0], down: [43, 70], use: [48, 140] };
        const actions: Record<string, [number, number]> = { jump: [11, 0], m1: [75, 0], m2: [11, 60], skill: [75, 60], ult: [43, 120] };
        const l = pads[b.action], r = actions[b.action];
        if (l) Object.assign(b.el.style, { left: `${left + l[0]}px`, right: "auto", bottom: `${bottom + l[1]}px` });
        else if (r) Object.assign(b.el.style, { left: "auto", right: `${right + r[0]}px`, bottom: `${bottom + r[1]}px` });
      } else if (layout === "rails") {
        const l = ["left", "right", "down", "use"].indexOf(b.action);
        if (l >= 0) Object.assign(b.el.style, { left: `${left + (b.action === "use" ? 11 : 6)}px`, right: "auto", bottom: `${bottom + l * 70}px` });
        else {
          const r = ["jump", "m1", "m2", "skill", "ult"].indexOf(b.action);
          Object.assign(b.el.style, { left: "auto", right: `${right + 11}px`, bottom: `${bottom + r * 60}px` });
        }
      } else if (layout === "row") {
        const l = ["left", "right", "down"].indexOf(b.action);
        if (l >= 0) Object.assign(b.el.style, { left: `${Math.max(14, left) + l * 74}px`, right: "auto", bottom: `${bottom}px` });
        else {
          const r = ["jump", "m1", "ult", "m2", "skill", "use"].indexOf(b.action);
          Object.assign(b.el.style, { left: "auto", right: `${Math.max(14, right) + r * 64}px`, bottom: `${bottom}px` });
        }
      }
    }
    this.root.dataset.layout = layout;
    if (this.root.parentElement) {
      this.root.parentElement.dataset.touchLayout = layout;
      this.root.parentElement.style.setProperty("--touch-safe-left", `${left}px`);
    }
    this.insets = layout.endsWith("rails") ? { left: railLeft, right: railRight } : { left: 0, right: 0 };
    this.presentationKey = key;
    return this.insets;
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

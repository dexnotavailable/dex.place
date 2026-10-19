// The controls card (Dex 10-19: he had "no clue how to dash in game"). The first time she is playable (after the
// opening's hand-back, or at once on a ?at= start) a small card lists her keys, read from the game's own key map so it
// can never disagree with it; it fades after a few seconds or on the first game input (after a short grace, so a key
// already held through the hand-back does not wipe it unread). Holding H, or the "?" in the corner, brings it back.
// On touch the buttons carry their own labels instead (touch.ts), so the card stays away.

import type { Action, KeyMap } from "../lab/engine/input.ts";

/** What the card lists, in order: a name and the actions whose keys it shows (and keys the map does not hold). */
const ROWS: { what: string; acts: Action[]; extra?: string[] }[] = [
  { what: "move", acts: ["left", "right"] },
  { what: "jump", acts: ["jump"] },
  { what: "attack", acts: ["m1"], extra: ["click"] },
  { what: "dash", acts: ["m2"] },
  { what: "skill", acts: ["skill"] },
  { what: "ofuda", acts: ["e"] },
  { what: "ult", acts: ["ult"] },
  { what: "use", acts: [], extra: ["F"] },
];

/** How long the card stays the first time (ms), and the grace before an input may dismiss it. */
const SHOW_MS = 7000;
const GRACE_MS = 1500;

/** A key code as a keycap ("KeyA" -> "A", "ShiftLeft" -> "Shift", the arrows as arrows). */
export function capOf(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Shift")) return "Shift";
  const arrows: Record<string, string> = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };
  return arrows[code] ?? code;
}

/** The card's rows from a key map: each action's keys as caps, letters first, no repeats. */
export function controlRows(keys: KeyMap): { what: string; caps: string[] }[] {
  return ROWS.map((r) => {
    const codes = Object.keys(keys).filter((c) => r.acts.some((a) => keys[c]!.includes(a)));
    // letters and Shift / Space before the arrows (the arrows read as a pair after them)
    const caps = [...new Set(codes.map(capOf))].sort((a, b) => Number(/[←→↑↓]/.test(a)) - Number(/[←→↑↓]/.test(b)));
    return { what: r.what, caps: [...caps, ...(r.extra ?? [])] };
  });
}

export class ControlsHint {
  readonly card: HTMLElement;
  readonly button: HTMLButtonElement;
  /** When it first showed by itself (null: not yet), and until when that showing lasts. */
  private firstAt: number | null = null;
  private until = 0;
  private held = false;
  private pinned = false;

  constructor(stage: HTMLElement, keys: KeyMap, canvas: HTMLElement) {
    const card = document.createElement("div");
    card.className = "controls";
    card.setAttribute("role", "note");
    card.setAttribute("aria-label", "Controls");
    const list = document.createElement("ul");
    for (const r of controlRows(keys)) {
      const li = document.createElement("li");
      const k = document.createElement("span");
      k.className = "keys";
      for (const c of r.caps) {
        const kbd = document.createElement("kbd");
        kbd.textContent = c;
        k.append(kbd);
      }
      const w = document.createElement("span");
      w.className = "what";
      w.textContent = r.what;
      li.append(k, w);
      list.append(li);
    }
    const again = document.createElement("p");
    again.className = "again";
    again.innerHTML = "hold <kbd>H</kbd> to see this again";
    card.append(list, again);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "controls-q";
    button.textContent = "?";
    button.setAttribute("aria-label", "Controls (or hold H)");
    button.hidden = true;
    button.addEventListener("click", () => {
      this.pinned = !this.pinned;
      this.until = 0;
      canvas.focus();
    });
    stage.append(card, button);
    this.card = card;
    this.button = button;
    const isGame = (code: string): boolean => code in keys || code === "KeyF" || code === "Enter";
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyH") {
        if (!e.repeat) this.held = true;
        return;
      }
      if (e.code === "Escape") this.pinned = false;
      if (isGame(e.code)) this.dismiss();
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "KeyH") this.held = false;
    });
    window.addEventListener("blur", () => { this.held = false; });
    canvas.addEventListener("pointerdown", () => this.dismiss());
  }

  /** A game input: the first showing ends (after its grace); a pinned card stays until "?" or Esc. */
  private dismiss(): void {
    if (this.firstAt !== null && performance.now() - this.firstAt > GRACE_MS) this.until = 0;
  }

  /** Every frame: playable = she is in the player's hands and the world is on screen; touch: the touch buttons are up. */
  tick(now: number, playable: boolean, touch: boolean): void {
    if (this.firstAt === null && playable && !touch) {
      this.firstAt = now;
      this.until = now + SHOW_MS;
    }
    const on = !touch && playable && (this.held || this.pinned || now < this.until);
    this.card.classList.toggle("on", on);
    this.button.hidden = touch || this.firstAt === null || !playable;
    this.button.classList.toggle("on", on);
  }

  /** Debug and tests. */
  get shown(): boolean {
    return this.card.classList.contains("on");
  }
}

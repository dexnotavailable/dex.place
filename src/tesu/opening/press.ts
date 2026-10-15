// "continue" without accidents (the opening plan, section 1.4; CHECK-1 item 12). The press starts the music,
// so it must never happen by accident:
//
// - a click or tap on the item stage (today the letter, which pokes) never continues, before or after the
//   button appears: a visitor poking it when the button shows up gets a poke, not the cinematic;
// - continue is the button, Space or Enter, or a click or tap anywhere else on the title;
// - for 300 ms after the button appears nothing continues, and a press that began before it appeared never
//   continues on its release; a held key's auto-repeat never counts, only a fresh key press;
// - Space or Enter while focus is on another control (the skip link) is that control's;
// - Esc does nothing here (there is no opening to skip yet, and it never starts one).

export interface PressFacts {
  /** The button is showing (the opening set is in and the mark is done). */
  ready: boolean;
  /** When the button appeared (ms, the page's clock). */
  readyAt: number;
  /** The guard after it appears (ms). */
  guardMs: number;
  /** When the press began: the pointer went down, or the key went down (ms). */
  downAt: number;
  /** The press began on the item stage / the letter. */
  onStage: boolean;
  /** The press is on (or focus is on) another control: a link, another button. */
  onOtherControl: boolean;
  /** A key's auto-repeat. */
  repeat?: boolean;
  /** The key, for keyboard presses. */
  key?: string;
}

/** Whether this press continues (starts the opening). */
export function pressContinues(f: PressFacts): boolean {
  if (!f.ready || f.onOtherControl || f.repeat) return false;
  if (f.key !== undefined && f.key !== "Enter" && f.key !== " ") return false;
  if (f.onStage && f.key === undefined) return false;
  return f.downAt >= f.readyAt + f.guardMs;
}

// Her keys in Tesu (main.ts binds them; controls.ts shows them).

import type { KeyMap } from "../lab/engine/input.ts";

/**
 * The fixed keys (GDK 5.4, Appendix B): WASD and the arrows both move from the start;
 * J, Z or click attack; Shift, K or X dash; Q, E, R her kit; F (or Enter) uses things; holding H shows the controls.
 * Shift dashes too since 10-19 (Dex had "no clue how to dash": Shift is the key most players try first); the GDK had
 * kept it off Shift because five quick Shift presses can raise Windows' Sticky Keys prompt (K and X never do).
 */
export const KEYS: KeyMap = {
  KeyA: ["left"],
  ArrowLeft: ["left"],
  KeyD: ["right"],
  ArrowRight: ["right"],
  KeyW: ["up", "jump"],
  ArrowUp: ["up", "jump"],
  Space: ["jump"],
  KeyS: ["down"],
  ArrowDown: ["down"],
  KeyJ: ["m1"],
  KeyZ: ["m1"],
  ShiftLeft: ["m2"],
  ShiftRight: ["m2"],
  KeyK: ["m2"],
  KeyX: ["m2"],
  KeyQ: ["skill"],
  KeyE: ["e"],
  KeyR: ["ult"],
};

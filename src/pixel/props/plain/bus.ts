// The plain's controller channel (lane R-B). Two halves meet here:
//
// - the room's keeper (a stub-engine prop, src/world/rooms/plain/keeper.ts)
//   sees what pixel props can't: the player, the save, and the backdrop's
//   walk feed (the colossus's footfalls, in step with what is drawn);
// - the rumble (a pixel-matter prop, plainRumble) can do what stub props
//   can't: shake the camera through the host's `shake` event (the host
//   turns it off in reduced motion), blow the room's grass and reeds flat,
//   and feed the pixel world its actor (the player) so reeds and grass part
//   around her feet.
//
// Only the current room simulates, so one channel serves every plain room.

export interface PlainEvent {
  type: "shake" | "wash" | "sound";
  /** shake: amplitude in px; wash: strength 0..1. */
  amp?: number;
  /** Seconds (shake duration, wash duration). */
  dur?: number;
  /** Room x where it happens (a wash blows around here). */
  x?: number;
  y?: number;
  /** Which way the wash pushes (+1 toward +x). */
  dir?: number;
  id?: string;
  volume?: number;
}

export const PLAIN = {
  /** The player this tick (room px, feet), or null outside the plain. */
  player: null as null | { x: number; y: number; vx: number; h: number; room: string },
  /** Events from the keeper, drained by the rumble each step. */
  queue: [] as PlainEvent[],
  /** The last events with the backdrop clock they happened at (for captures and checks). */
  log: [] as (PlainEvent & { t: number })[],
  /** The backdrop clock of the latest keeper step. */
  t: 0,
};

export function plainEmit(e: PlainEvent): void {
  PLAIN.queue.push(e);
  if (PLAIN.queue.length > 64) PLAIN.queue.splice(0, PLAIN.queue.length - 64);
  PLAIN.log.push({ ...e, t: PLAIN.t });
  if (PLAIN.log.length > 200) PLAIN.log.splice(0, PLAIN.log.length - 200);
}

// visible to the capture tools (src/world/rooms/plain/_tools/): read-only use
(globalThis as { __plain?: typeof PLAIN }).__plain = PLAIN;

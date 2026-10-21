// Where things stand on the Prize Court (the world builder's numbers, moved out of court.ts unchanged by the engine's
// perf pass so the court's game code can read them without loading the section and the hall's art; court.ts
// re-exports them).

import { h } from "../../config.ts";

export const COURT_X0 = h(176.2);
export const COURT_X1 = h(192.6);
/** Where things stand on the court (world px). */
export const BOARD_X = h(178.8);
export const BAO_X = h(180.5);
export const GONG_X = h(182.2);
export const LION_X = h(187.6);
/** The ring she and the champion move in. (Hall loop round 3, W1-2: the bout is staged east of the gong tower, on
 *  clear ground in front of the stands, so the ring runs on over the Prow Stair's timber grate to the mouth's east
 *  end; was h(186.6), when the fight stood inside the gong tower's frame.) */
export const RING_X0 = h(177.4);
export const RING_X1 = h(189.2);
/** Where the ring is drawn from: just past the gong tower's east post (round 3; it was BOARD_X + 1.5 H, so the
 *  tower stood inside the ring and the gong hung over her head). The gong stays at the ring's west edge. */
export const RING_SHOW_X0 = GONG_X + h(1.75);
/** The court's middle, where the camera holds during a bout: the drawn ring's middle, so the bout is framed with
 *  the ring centred and whole (hall loop round 1, L14; round 3: the ring moved east of the tower). */
export const COURT_MID = Math.round((RING_SHOW_X0 + RING_X1) / 2);
/** The Prow Stair's mouth: an opening in the court floor near the tip (GDK A.4), the stair
 *  running down under the court and the palace cliff to the top of Shiraito's path. */
export const STAIRWELL_X0 = h(186.8);
export const STAIRWELL_X1 = h(189.2);

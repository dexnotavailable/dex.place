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
/** The court's middle, where the camera holds during a bout. */
export const COURT_MID = h(185.6);
/** The ring she and the champion move in. */
export const RING_X0 = h(177.4);
export const RING_X1 = h(186.6);
/** The Prow Stair's mouth: an opening in the court floor near the tip (GDK A.4), the stair
 *  running down under the court and the palace cliff to the top of Shiraito's path. */
export const STAIRWELL_X0 = h(186.8);
export const STAIRWELL_X1 = h(189.2);

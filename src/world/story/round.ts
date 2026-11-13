// The Round's story glue (lane I1; WORLD-PLAN sections 2, 8, 11, 13).
//
// The regions carry their own beats (R-A the keeper, her lines, the lamp board,
// the evening, the two cups; R-B the culvert that wakes the ferryman; R-C the
// archivist's hum; R-D the storm break and the Blade's lamps; R-E the latch,
// the bell and round:done). This hook joins them into one round:
//
// - The evening arrives everywhere at once. The sky door sets round:done as you
//   step through, but the lodge on the other side (and any other Ringwater room
//   the stream kept warm) was built in the morning, so the evening's first room
//   kept morning windows. When round:done is set this visit, the session flag
//   `evening` is set and every warm Ringwater room that isn't the current one is
//   let go, so it is built again as evening when you get there (an honest short
//   load behind the door's fade, never a fake wait).
// - Home is the dock. Once the round is done, the next visit starts on the dock
//   in the morning ("the first impression is canon", section 2), not at the
//   last shrine rested at (the chapel porch). Resting at a shrine later moves
//   the start again, as the runtime always does.
// - The lamps you lit stand in a line across the valley: Ringwater's lake
//   backdrops show the save's lit shrines on the far strand (lamps.ts), so the
//   ending at Pier's End has them, the colossus walking in front.
//
// Both go through the story API (WorldApi.rebuild and WorldApi.setRest), not the
// page's world handle.

import type { StoryHooks, WorldApi } from "../hooks.ts";
import type { RoomDef } from "../room/types.ts";
import { ringwater } from "../rooms/ringwater/_lib.ts";
import { balconyLamps, ringwaterLamps } from "./lamps.ts";

/** Ringwater's rooms (the lake and the lodge): they show the evening after the round. */
const RINGWATER = ["A0", "A1", "A2", "A3", "A4", "S2"];

/** What this lane did this visit (read by its tools; the world shows no text). */
export const roundLog: { evening: number | null; rebuilt: string[]; home: boolean } = { evening: null, rebuilt: [], home: false };

function eveningNow(api: WorldApi): void {
  if (!api.session("evening")) api.setSession("evening", true);
  // R-A's rooms decide morning or evening when they are built; tell them now, not on the
  // next tick of a room state prop (the door's fade is shorter than their save cache)
  ringwater.forced = true;
  ringwater.flags["round:done"] = true;
  roundLog.evening = api.time();
  // every warm Ringwater room but the one you are in is built again as evening when you get there
  for (const id of RINGWATER) if (api.rebuild(id)) roundLog.rebuilt.push(id);
  // the next visit begins where the world began: the dock, in the morning
  api.setRest("A1", "start");
  roundLog.home = true;
}

export const theRound: StoryHooks = {
  id: "the-round",
  flag(key: string, value: boolean, api: WorldApi): void {
    if (key === "round:done" && value) eveningNow(api);
  },
  room(def: RoomDef): RoomDef | void {
    return ringwaterLamps(def) ?? balconyLamps(def);
  },
};

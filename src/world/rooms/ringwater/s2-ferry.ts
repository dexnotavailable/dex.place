// S2 the ferry ride (WORLD-PLAN section 5, S2): from Pier's End out across the
// lake to the culvert under the causeway, 16 s, the colossus seen from the
// water. The ride's mechanics are the grey-box's (the runtime's carrier, the
// same stops and spawns); Ringwater gives it the lake: the arrival backdrop
// from out on the water, no dock, the ring and the colossus ahead, the dock's
// lamp behind. The culvert end belongs to the plain (lane R-B).

import { arrivalScene } from "../../../scenes/scenes/arrival.ts";
import { geo as arrivalGeo } from "../../../scenes/scenes/arrival/geo.ts";
import { h, SCALE } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { geoCtx } from "../common.ts";
import { ringwater as greybox } from "../_blockout/a-ringwater.ts";
import { sessionRoom } from "./_lib.ts";
import { EVENING_LIGHT, MORNING_LIGHT } from "./a1-dock.ts";

const base = greybox.find((r) => r.id === "S2")!;
const g = arrivalGeo(geoCtx(base.w - SCALE.viewW));

const lake = (evening: boolean): RoomDef["backdrop"] => ({
  scene: arrivalScene({ title: evening ? "S2 the ferry (evening)" : "S2 the ferry", dock: "none", bias: -h(2), without: ["foreground"], evening }),
  vertical: 0,
  weather: true,
});

const morning: RoomDef = {
  ...base,
  // the ride's two landings stay collision only; the lake is the backdrop's
  terrain: base.terrain.map((t) => ({ ...t, art: "wood", ramp: ["#08090c", "#0f1115", "#191b20", "#2a2a2c", "#4c4238"] })),
  backdrop: lake(false),
  lighting: MORNING_LIGHT,
  ambient: { dust: 8 },
  waterline: g.wl,
};

export const ferryRide: RoomDef = sessionRoom(morning, () => ({ backdrop: lake(true), lighting: EVENING_LIGHT, weather: { state: "serene", time: "dusk" } }));

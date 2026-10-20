// The env-hall library: the Hall of Works and the Prize Court. Importing this module registers
// its painters (all named "hall.*" or "court.*"). The dressing (dress.ts) places them from the
// world builder's layout; the manifest says how each one moves, reflects, shows through,
// glows and breaks.

import "./backwall.ts";
import "./room.ts";
import "./roof.ts";
import "./stair.ts";
import "./deep.ts";
import "./glow.ts";
import "./furniture.ts";
import "./near.ts";
import "./services.ts";
import "./court.ts";
import "./prow.ts";
import "./court-light.ts";
import "./hall-light.ts";
import "./life.ts";

export { gongFrame } from "./court.ts";
export { HALL_MANIFEST, type HallAsset } from "./manifest.ts";

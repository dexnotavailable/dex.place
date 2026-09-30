// D1 the Lift Ride (lane R-D; WORLD-PLAN section 4, D1): a 6 x 117 H shaft,
// 72 H in 16 s (4.5 H/s) from the Lift Foot to the break at y 40, where
// lightning broke the rail; once the express lever is thrown (lever:express),
// 108 H in 18 s straight to the Crown. The camera rides locked to the car.
// Amber in the hollow, about 3 s of dark through its ceiling, then the spire's
// cold side light with the pale planet behind and rain beginning on the car;
// the counterweight passes the other way halfway up; window slits stream past;
// the car's beacon turns while it moves. The music opens up as you leave the
// hollow (the runtime's muffle ramp along the shaft).

import { Spire, LIGHT, RAMP } from "./_build.ts";
import { liftScene } from "./_scenes/lift.ts";

const d1 = new Spire({
  id: "D1",
  title: "D1 Lift Ride",
  x0: 262,
  x1: 268,
  top: 81,
  bottom: -36.2,
  // the ride keeps its design framing (the shaft scene is composed for it)
  camera: { mode: "locked", anchor: 0.6, zoom: 1.2 },
  audio: { music: "theme", bed: "shaft", weatherThrough: 0.6, muffle: 1, surface: "metal" },
  weather: { state: "rain", time: "day" },
  neighbours: ["C3", "D2", "D3"],
  lighting: LIGHT.shaft,
  surface: "metal",
  ramp: RAMP.iron,
  art: "none",
});
// the muffled theme opens up along the shaft as the car climbs out of the hollow
d1.s.audio.muffle = { y0: d1.Y(-32), y1: d1.Y(30), from: 1, to: 0 };

// the landings at the three stops (the Lift Foot's side, the break, the Crown)
d1.floor(262, 263.5, -32, 1.0, { surface: "tile" });
d1.floor(266.5, 268, 40, 0.5, { surface: "metal" });
d1.floor(266.5, 268, 76, 0.5, { surface: "metal" });
d1.px("spireDeck", "landing-foot", 262, -32, { width: 1.5 * 80, depth: 0.6, kind: "landing", lip: "none" });
d1.px("spireDeck", "landing-break", 266.5, 40, { width: 1.5 * 80, depth: 0.5, kind: "landing", lip: "none" });
d1.px("spireDeck", "landing-crown", 266.5, 76, { width: 1.5 * 80, depth: 0.5, kind: "landing", lip: "none" });

// the car, its stops, its cables up out of the shaft
d1.prop("spire-lift", "spire-lift", 265, -32, {
  stops: [
    { x: d1.X(265), y: d1.Y(-32) },
    { x: d1.X(265), y: d1.Y(40) },
    { x: d1.X(265), y: d1.Y(76), flag: "lever:express", speed: 6 },
  ],
  speed: 4.5,
  w: 3.0,
  top: 0,
});
// the counterweight: at the top of its channel while the car waits below; they pass halfway (y 4)
d1.px("counterweight", "counterweight", 262.7, 42.4, { mode: "ride", cable: 40, liftBottom: d1.Y(-32) });
// warning lights at the stops (the break's hangs where the rail broke)
d1.px("warningLight", "beacon-foot", 263.2, -29.6, { mode: "blink", mount: "wall", phase: 0.1 });
d1.px("warningLight", "beacon-break", 267.6, 42.8, { mode: "blink", mount: "wall", phase: 0.5 });
d1.px("warningLight", "beacon-crown", 267.6, 78.8, { mode: "blink", mount: "wall", phase: 0.9 });
// the storm's clock (the rain and the pennant-free shaft share the spire's one gust program)
d1.prop("spire-storm", "storm", 262.2, 80, { strength: 1 }, { engine: "stub" });

d1.spawn("bottom", 265, -32, 1, { prop: "spire-lift", stop: 0, go: -1 });
d1.spawn("break", 266.9, 40, -1, { prop: "spire-lift", stop: 1 });
d1.spawn("top", 266.9, 76, -1, { prop: "spire-lift", stop: 2 });
d1.exit("left", "C3", "lift", -33, -30).exit("right", "D2", "lift", 39.5, 42).exit("right", "D3", "lift", 75.5, 78);

export const ride = d1.build(
  liftScene({ w: d1.W, h: d1.Ht, floor: d1.Y(-32), ground: d1.Y(-4), rockTop: d1.Y(-4.5), rockBottom: d1.Y(-18.5), rainFrom: d1.Y(14), rainFull: d1.Y(30), shaftX: d1.X(265), breakCam: d1.Y(40) - 0.6 * 720 }),
  { hide: ["wx-rain-far", "wx-rain-near"], vertical: 1 },
);

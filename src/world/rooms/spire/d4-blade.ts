// D4 the Blade (lane R-D; WORLD-PLAN section 4, D4): 32 x 16.6 H along the
// monolith's top edge, rising 8 H to the tip. You step out of the Crown in the
// storm; at x 292 the cloud tears open in stepped bands over about 4 s
// (blade:cleared, kept for the save: the Blade stays clear), the rain stops,
// the storm's sound cuts off, two seconds of silence, then the theme enters
// under a 5 s swell from 48 s into the cue (the runtime's grand-passage
// state). Wet iron goes gold. From above the weather you see the colossi
// below you for the first time, the lake and the ring with the sun in its
// hole, the lodge's cliff, and the lamps you have lit. At the tip a bench and
// a vista hold; a step down onto the fallen ring segment begins the Pilgrim
// Path (E1).

import { Spire, LIGHT, RAMP } from "./_build.ts";
import { bladeScene } from "./_scenes/blade.ts";
import { fromLight } from "../../render/blend.ts";

const d4 = new Spire({
  id: "D4",
  title: "D4 The Blade",
  x0: 284,
  x1: 316,
  top: 90,
  bottom: 73.4,
  camera: { mode: "rail", anchor: 0.62, slack: 2 },
  audio: { music: "none", bed: "storm", weatherThrough: 1, surface: "metal" },
  weather: {
    zones: [
      { x0: 0, x1: 0.25, state: "rain" },
      { x0: 0.25, x1: 1, state: "after" },
    ],
    feather: 0.03,
    time: "dusk",
  },
  neighbours: ["D3", "E1"],
  lighting: LIGHT.dusk,
  surface: "metal",
  ramp: RAMP.bladeDusk,
  art: "none",
});
const H80 = 80;

// the edge: a landing out of the Crown, a steady slope rising 8 H over 26.5 H (17 degrees; the collision
// is 160 small steps of 0.05 H, so the feet never float more than 4 px over the drawn slope), then the
// tip: a flat deck 3.3 H long (312.7 to 316) with room for the bench and a step either side of it
const E0 = 286.2, EL = 26.5, ER = 8, STEPS = 160;
d4.floor(284, E0, 76);
for (let i = 0; i < STEPS; i++) d4.floor(E0 + (EL / STEPS) * i, E0 + (EL / STEPS) * (i + 1), 76 + (ER / STEPS) * (i + 0.5));
d4.floor(E0 + EL, 316, 84);
/** The walking height of the edge at world x. */
const edgeY = (x: number): number => (x <= E0 ? 76 : x >= E0 + EL ? 84 : 76 + (ER / STEPS) * (Math.floor((x - E0) / (EL / STEPS)) + 0.5));
d4.px("spireDeck", "landing", 284, 76, { width: (E0 - 284) * H80, depth: 0.5, kind: "landing", lip: "none" });
d4.px("bladeEdge", "edge", E0, 76, { length: EL, rise: ER, plate: 0.9, depth: 0.55 });
// (the tip is a solid block as deep as the blade under it, so the ramp runs into it with one shared
// underside: no spikes or underside sticking out below its west end)
d4.px("spireDeck", "tip", E0 + EL, 84, { width: (316 - E0 - EL) * H80, depth: 1.0, kind: "landing", lip: "none" });

// the storm (its strength follows the rain: gone once the sky clears) and its hand (still air here)
d4.prop("spire-storm", "storm", 284.5, 88, { strength: "rain" }, { engine: "stub" });
d4.px("stormDirector", "storm-hand", 284.5, 88, { mode: "storm" });

// the storm breaks at x 292 (kept for the save); the theme's grand passage from 48 s under a 5 s swell
d4.trigger(292, 293.5, { flag: "blade:cleared" });
// (the first time you cross, the storm's sound cuts off: rain, wind and thunder stop, 2 s of silence, then
// the dusk bed and the theme's swell; the theme's own 2 s delay lines up with the silence)
d4.area({ id: "D4-break", title: "D4 the storm breaks", x0: 292, x1: 317.5, audio: { music: "theme", enter: { at: 48, rise: 5, delay: 2 }, bed: "dusk", cut: { silence: 2, unless: "blade:cleared" } } });
// once cleared the whole Blade is above the weather: the west part hears the dusk too, and the theme carries on there
d4.extra = {
  // one light over everything: the dusk's warm cast, a veil on far iron, a soft band where the blade's
  // top meets the open sky, the lamps' halos
  blend: fromLight(LIGHT.dusk, { amount: 0.16, haze: 0.25, band: 0.7 }),
  weatherIf: { flag: "blade:cleared", program: { state: "after", time: "dusk" } },
  audioIf: { flag: "blade:cleared", audio: { bed: "dusk", music: "theme" } },
};

// pennants (they whip in the storm by the Crown, then hang still), rubble, moss on the edge, the bench at the tip
d4.px("clothHanging", "pennant-1", 285.4, 76, { kind: "pennant", colour: "red" });
d4.px("clothHanging", "pennant-2", 297.4, edgeY(297.4), { kind: "pennant", colour: "red" });
// (rubble on the slope is laid stone by stone, each small piece on the slope under its own x, so no end
// hangs over the downhill side)
for (const [x0, n, k] of [[289.7, 3, 1], [304.2, 3, 2]] as const)
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 0.34;
    d4.px("rubble", `rubble-${k}-${i}`, x, edgeY(x), { kind: "stone", width: 0.26 + (i % 2) * 0.06, height: 0.14 + ((i + k) % 3) * 0.04 });
  }
// (every piece sits on the surface under its whole width: the moss on the slope is laid in tufts 0.45 H
// wide, each on the slope under it, so no end floats more than 5 px; the tip's moss and the bench stand
// on the flat deck, 313.5 to 315.1 and 315.3 to 315.9)
for (const [x, w] of [[300.2, 1.4], [307.6, 1.8]] as const) {
  const n = Math.round(w / 0.45);
  for (let k = 0; k < n; k++) {
    const tx = x - w / 2 + (w / n) * (k + 0.5);
    d4.px("grass", `moss-${x}-${k}`, tx, edgeY(tx), { kind: "grass", width: w / n + 0.04, height: 0.16, density: 5 });
  }
}
// (the tip's moss grows in the lee of the slope's last plate, west of the bench, where the deck is
// whole under every blade; east of the bench a third of it had nothing to root in)
d4.px("grass", "moss-tip", 313.05, 84, { kind: "grass", width: 0.6, height: 0.14, density: 5 });
d4.px("bench", "blade-bench", 314.3, 84, { kind: "stone", length: 1.6 });
// at the tip, looking out: the view settles so the world below fills the frame
d4.vista(308, 316, 309.5, 82.8, 0.06);

d4.spawn("west", 284.6, 76, 1).spawn("east", 315.4, 84, -1);
d4.exit("left", "D3", "east").exit("right", "E1", "west");

export const blade = d4.build(
  bladeScene({ w: d4.W, h: d4.Ht, camY: d4.Y(80) - 0.62 * 720, edge: [d4.X(E0), d4.Y(76), d4.X(E0 + EL), d4.Y(84)] }),
  { hide: ["wx-rain-far", "wx-rain-near"] },
);

// Ringwater's own materials (lane R-A): the keeper and the ferryman, the
// glazed cups, the ferry's faded paint, the reeds' seed heads. Muted like the
// rest of the world ramps, below Rosace's W1 white, so she stays the brightest
// thing on screen. Loaded with any Ringwater recipe (module-level defines).

import { defineMaterial } from "../../materials.ts";

const T_SOFT: [number, number, number] = [0.14, 0.42, 0.8];

defineMaterial("ringSkin", { ramp: ["#4a2e2c", "#7a4e44", "#a8766a", "#c89a88"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringHairGrey", { ramp: ["#26242c", "#433f48", "#686270", "#908898"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringHairDark", { ramp: ["#15121a", "#241e28", "#3a3038", "#54464c"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringDress", { ramp: ["#18222a", "#253540", "#374c58", "#4e6670"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringShawl", { ramp: ["#2a1620", "#46242e", "#66363c", "#865048"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringApron", { ramp: ["#4a4640", "#6e685e", "#948c7e", "#b4aa98"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringCoat", { ramp: ["#1e1a16", "#342c22", "#4e4230", "#6a5a40"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringHat", { ramp: ["#241c14", "#3e3020", "#5c4830", "#7c6444"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringGlaze", { ramp: ["#4a4a4e", "#7a7874", "#aaa498", "#cfc6b2"], t: [0.12, 0.4, 0.84], glint: true, spec: { colour: "#e8e2d2", thr: 0.965 }, behaviour: "shatter", hardness: 30, sound: "glass", bounce: 0.3, debris: 0.4 });
defineMaterial("ringGlazeBlue", { ramp: ["#1a2232", "#26344a", "#3a506a", "#587490"], t: [0.12, 0.4, 0.84], behaviour: "shatter", hardness: 30, sound: "glass", bounce: 0.3, debris: 0.4 });
defineMaterial("ringBoat", { ramp: ["#162224", "#223638", "#34504e", "#4c6c66"], t: [0.14, 0.42, 0.8], behaviour: "splinter", hardness: 60, sound: "wood", debris: 0.25, bounce: 0.3 });
defineMaterial("ringReedHead", { ramp: ["#20150f", "#382418", "#543826", "#6e4c34"], t: T_SOFT, behaviour: "tear", hardness: 8, sound: "leaf", debris: 0.6 });
defineMaterial("ringReed", { ramp: ["#1e2418", "#303a24", "#4a5634", "#687448"], t: T_SOFT, behaviour: "tear", hardness: 8, sound: "leaf", debris: 0.6 });
defineMaterial("ringInk", { ramp: ["#120e14", "#1c1820", "#28222c", "#342c36"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth", ink: false });
defineMaterial("ringSpeech", { ramp: ["#8a8070", "#b8ae98", "#ded4bc", "#efe6d0"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringSpeechBack", { ramp: ["#0c0b10", "#111016", "#16141c", "#1c1a22"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("ringLampOff", { ramp: ["#141218", "#1e1a20", "#2a2428", "#383034"], t: [0.14, 0.42, 0.8], behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("ringLampOn", { ramp: ["#7a3e18", "#c87a30", "#f2b456", "#ffe0a0"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });

/** Nothing to call: importing this module defines the materials. */
export const RINGWATER_MATERIALS = true;

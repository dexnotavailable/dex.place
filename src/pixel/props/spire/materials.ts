// The spire's materials (lane R-D): its black iron, wet and cold under the
// storm (a sheen band where the key light catches the water on it), the
// darker iron of girders and undersides, the route's red paint, and the
// warning lamps' lenses (emissive, amber and red). Loaded with the spire's
// recipes (the registry imports every file in this folder).

import { defineMaterial } from "../../materials.ts";

const T_METAL: [number, number, number] = [0.12, 0.34, 0.7];

/** Plate iron: blue-black, a wet sheen. */
defineMaterial("spireIron", { ramp: ["#0b0e15", "#161b25", "#262e3b", "#3f4a5b"], t: T_METAL, behaviour: "dent", hardness: 320, sound: "metal", glint: true, spec: { colour: "#7f97b8", thr: 0.955 }, bounce: 0.35, debris: 0.05 });
/** The alcove's plating: the same iron, warmed by years of candle smoke (a browner ramp). */
defineMaterial("spireIronWarm", { ramp: ["#100c0f", "#21191b", "#362a29", "#54423a"], t: T_METAL, behaviour: "dent", hardness: 320, sound: "metal", glint: true, spec: { colour: "#a08068", thr: 0.96 }, bounce: 0.35, debris: 0.05 });
/** Girders and undersides. */
defineMaterial("spireIronDark", { ramp: ["#07090d", "#0e1219", "#181e28", "#283140"], t: T_METAL, behaviour: "dent", hardness: 360, sound: "metal", spec: { colour: "#5a6e8c", thr: 0.97 }, bounce: 0.3, debris: 0.05 });
/** The route's red, painted on the lips and posts (muted, like the dock's floor line). */
defineMaterial("routeRed", { ramp: ["#2c0f15", "#4a1820", "#6a2229", "#8a3434"], t: T_METAL, behaviour: "dent", hardness: 300, sound: "metal", bounce: 0.3, debris: 0.05 });
/** Warning lamp lenses. */
defineMaterial("lampAmber", { ramp: ["#4a2006", "#a2520e", "#f0942e", "#ffd892"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("lampRed", { ramp: ["#3e0810", "#8c1624", "#e03848", "#ffb4ac"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
/** An unlit lens (the lamp between blinks). */
defineMaterial("lampOff", { ramp: ["#140b0b", "#231314", "#341c1c", "#4a2826"], t: [0.1, 0.35, 0.85], glint: true, ink: false, behaviour: "none", hardness: 999, sound: "glass", spec: { colour: "#8a6660", thr: 0.96 } });
/** Warden armour: old dark bronze-iron plates. */
defineMaterial("wardenPlate", { ramp: ["#120f14", "#221c22", "#352b30", "#524246"], t: T_METAL, behaviour: "dent", hardness: 280, sound: "metal", glint: true, spec: { colour: "#a88f86", thr: 0.96 }, bounce: 0.4, debris: 0.05 });

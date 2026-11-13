// The Hollow's materials (region C). Loaded with the region folder by the
// registry's glob; every name is prefixed "hollow" so no other lane's
// material can collide. Ramps: deep, shadow, lit, highlight (shadows cooler,
// lights warmer), kept below Rosace's white like the shared kit.

import { defineMaterial } from "../../materials.ts";

const T_METAL: [number, number, number] = [0.18, 0.46, 0.84];
const T_STONE: [number, number, number] = [0.16, 0.44, 0.8];
const T_SOFT: [number, number, number] = [0.12, 0.4, 0.78];

/** The route's red underground: the pipe along the market walkway. */
defineMaterial("hollowPipeRed", { ramp: ["#2e0f12", "#51191a", "#7a2a22", "#9c4430"], t: T_METAL, behaviour: "dent", hardness: 240, sound: "metal", glint: true, spec: { colour: "#d88a64", thr: 0.965 }, bounce: 0.3, debris: 0.05 });
/** Grating and walkway steel: soot-dark, warm in the lamp light. */
defineMaterial("hollowSteel", { ramp: ["#141216", "#221e22", "#342d2d", "#4f433c"], t: T_METAL, behaviour: "dent", hardness: 300, sound: "metal", glint: true, spec: { colour: "#a08a70", thr: 0.97 }, bounce: 0.3, debris: 0.05 });
/** The market street's flagstones. */
defineMaterial("hollowStone", { ramp: ["#1a1516", "#2b221f", "#3d3128", "#524334"], t: T_STONE, behaviour: "crumble", hardness: 90, sound: "stone", debris: 0.35, bounce: 0.25 });
defineMaterial("hollowStoneDark", { ramp: ["#100c0e", "#191413", "#241c19", "#30251f"], t: T_STONE, behaviour: "crumble", hardness: 110, sound: "stone", debris: 0.3, bounce: 0.2 });
/** Unnamed people working: silhouettes, one value family, with a warm rim from the lamps. */
defineMaterial("hollowShade", { ramp: ["#08070a", "#0f0d10", "#1a1516", "#2e2320"], t: [0.2, 0.55, 0.9], behaviour: "none", hardness: 999, sound: "cloth", selout: "#3a2618" });
defineMaterial("hollowShadeCloth", { ramp: ["#0b090c", "#151114", "#221a19", "#3a2a22"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth", selout: "#40291a" });
/** The archivist: a warm brown coat, grey hair, pale hands in the lamp light. */
defineMaterial("hollowCoat", { ramp: ["#1c1216", "#2e1d1c", "#46302a", "#624636"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("hollowHair", { ramp: ["#2a2628", "#48423f", "#6e6660", "#958b80"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
defineMaterial("hollowSkin", { ramp: ["#3a2420", "#5e3a2e", "#86584a", "#a87a64"], t: T_SOFT, behaviour: "none", hardness: 999, sound: "cloth" });
/** Book cloth and spines. */
defineMaterial("hollowSpineRed", { ramp: ["#2a0e12", "#46181a", "#682824", "#8a3e30"], t: T_SOFT, behaviour: "tear", hardness: 40, sound: "cloth", debris: 0.1 });
defineMaterial("hollowSpineGreen", { ramp: ["#0e1a14", "#18291e", "#253c2a", "#3a5638"], t: T_SOFT, behaviour: "tear", hardness: 40, sound: "cloth", debris: 0.1 });
defineMaterial("hollowSpineBlue", { ramp: ["#121428", "#1c2040", "#2a305a", "#404a78"], t: T_SOFT, behaviour: "tear", hardness: 40, sound: "cloth", debris: 0.1 });
defineMaterial("hollowSpineOchre", { ramp: ["#2a1e0c", "#463214", "#684c20", "#8a6a32"], t: T_SOFT, behaviour: "tear", hardness: 40, sound: "cloth", debris: 0.1 });
/** The reading lamp's green glass shade (lit from inside). */
defineMaterial("hollowLampGreen", { ramp: ["#0c2218", "#15402a", "#26684a", "#5aa27a"], t: [0.1, 0.35, 0.9], glow: 0.75, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#c4f0d4", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
/** Emissive lights: the hearth, dials, digits, beacons, fluorescent tubes. */
defineMaterial("hollowFire", { ramp: ["#6a1a08", "#c24410", "#f58a2a", "#ffd27a"], emissive: true, ink: false, behaviour: "gutter", hardness: 1, sound: "flame" });
defineMaterial("hollowDial", { ramp: ["#4a2a0c", "#9a5a18", "#e89a3a", "#ffd88a"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("hollowDigit", { ramp: ["#2a0806", "#6a140e", "#d2361e", "#ff8a5a"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("hollowDigitOff", { ramp: ["#120a0a", "#1c1010", "#261616", "#301c1a"], t: T_METAL, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("hollowAmber", { ramp: ["#4a2606", "#a2580e", "#f29a24", "#ffd680"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("hollowRed", { ramp: ["#3a0606", "#86100c", "#e0301e", "#ff9a7a"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("hollowTube", { ramp: ["#6a7a78", "#a8bab4", "#d6e6de", "#f2fbf6"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("hollowTubeOff", { ramp: ["#2a302e", "#3c4442", "#525c58", "#6c7672"], t: T_METAL, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
/** Waiting-room chairs: moulded seats on steel frames, a cold teal gone grey. */
defineMaterial("hollowSeat", { ramp: ["#122024", "#1c3034", "#2a4448", "#3e5e5e"], t: [0.14, 0.42, 0.8], behaviour: "dent", hardness: 120, sound: "wood", bounce: 0.3, debris: 0.1 });
/** The lift foot's cold tile. */
defineMaterial("hollowTile", { ramp: ["#161b1c", "#222a2b", "#313c3b", "#465350"], t: T_STONE, behaviour: "crumble", hardness: 100, sound: "stone", debris: 0.3 });
/** Market goods: tarnished copper pots, a bolt of dyed cloth, bread and roots. */
defineMaterial("hollowGoods", { ramp: ["#2a1a10", "#4a2e18", "#72482a", "#9a6a3c"], t: T_SOFT, behaviour: "crumble", hardness: 30, sound: "wood", debris: 0.4 });

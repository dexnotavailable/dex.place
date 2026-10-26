// Materials for region B (Shore and Plain, lane R-B). The shore and the plain
// are cooler and greyer than the kit's warm woods and stones: weathered,
// wet, under a white sky. Every ramp stays below Rosace's W1 white.

import { defineMaterial } from "../../materials.ts";

const T_WOOD: [number, number, number] = [0.14, 0.42, 0.8];
const T_STONE: [number, number, number] = [0.16, 0.44, 0.8];
const T_SOFT: [number, number, number] = [0.12, 0.4, 0.78];
const T_METAL: [number, number, number] = [0.12, 0.34, 0.7];

defineMaterial("plainWood", { ramp: ["#161b1c", "#262e2e", "#3d4642", "#5f6658"], t: T_WOOD, behaviour: "splinter", hardness: 60, sound: "wood", debris: 0.25, bounce: 0.3 });
defineMaterial("plainWoodDark", { ramp: ["#0f1314", "#1a2122", "#283131", "#3b4643"], t: T_WOOD, behaviour: "splinter", hardness: 60, sound: "wood", debris: 0.25, bounce: 0.3 });
defineMaterial("plainRope", { ramp: ["#29241d", "#433b2d", "#62563f", "#837557"], t: T_SOFT, behaviour: "tear", hardness: 18, sound: "cloth", debris: 0.2 });
defineMaterial("plainStone", { ramp: ["#1c2123", "#2d3537", "#46504e", "#69736c"], t: T_STONE, behaviour: "crumble", hardness: 110, sound: "stone", debris: 0.35, bounce: 0.25 });
defineMaterial("plainStoneDark", { ramp: ["#121618", "#1d2325", "#2b3335", "#3f4847"], t: T_STONE, behaviour: "crumble", hardness: 120, sound: "stone", debris: 0.3, bounce: 0.2 });
defineMaterial("plainStoneWarm", { ramp: ["#221f20", "#363132", "#524a47", "#756b63"], t: T_STONE, behaviour: "crumble", hardness: 110, sound: "stone", debris: 0.35, bounce: 0.25 });
defineMaterial("plainLichen", { ramp: ["#2c3024", "#454b33", "#646a45", "#868a5a"], t: T_SOFT, behaviour: "crumble", hardness: 110, sound: "stone", debris: 0.3 });
defineMaterial("reedStem", { ramp: ["#141c17", "#1f2b20", "#2f3d29", "#465434"], t: T_SOFT, behaviour: "tear", hardness: 6, sound: "leaf", debris: 0.6 });
defineMaterial("reedDry", { ramp: ["#211f1a", "#343024", "#4c4531", "#665c40"], t: T_SOFT, behaviour: "tear", hardness: 6, sound: "leaf", debris: 0.6 });
defineMaterial("reedHead", { ramp: ["#23160f", "#3a2517", "#573822", "#744c2f"], t: T_SOFT, behaviour: "tear", hardness: 8, sound: "leaf", debris: 0.6 });
defineMaterial("plainBone", { ramp: ["#48463f", "#6a665c", "#8f897b", "#b4ac99"], t: T_STONE, behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.35, bounce: 0.2 });
defineMaterial("plainBoneDark", { ramp: ["#2c2a27", "#403d37", "#5a564d", "#78725f"], t: T_STONE, behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.3, bounce: 0.2 });
defineMaterial("plainIron", { ramp: ["#121518", "#1f2429", "#333a41", "#525b63"], t: T_METAL, behaviour: "dent", hardness: 320, sound: "metal", glint: true, spec: { colour: "#8e9aa4", thr: 0.965 }, bounce: 0.35, debris: 0.05 });
defineMaterial("plainPaint", { ramp: ["#1c2a2a", "#2b3f3d", "#3f5854", "#5a7670"], t: T_SOFT, behaviour: "dent", hardness: 200, sound: "metal", bounce: 0.3, debris: 0.05 });
defineMaterial("plainConcrete", { ramp: ["#1f2225", "#32363a", "#4b5053", "#6c7171"], t: T_STONE, behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.35, bounce: 0.2 });
defineMaterial("plainGlass", { ramp: ["#15191e", "#222a31", "#353f47", "#58646b"], t: [0.1, 0.35, 0.9], glow: 0.15, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#d4e6e6", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("plainSignFace", { ramp: ["#3a3c38", "#565852", "#76776d", "#9a998a"], t: T_SOFT, behaviour: "dent", hardness: 160, sound: "metal", bounce: 0.3, debris: 0.05 });
defineMaterial("plainBrass", { ramp: ["#35281a", "#5a4428", "#836536", "#aa8a52"], t: T_METAL, behaviour: "dent", hardness: 260, sound: "metal", glint: true, spec: { colour: "#e2cc92", thr: 0.955 }, bounce: 0.35, debris: 0.05 });

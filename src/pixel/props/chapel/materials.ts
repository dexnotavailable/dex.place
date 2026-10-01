// Materials for the chapel region (lane R-E): the gilt of the art frames, the
// dark board behind each work, the chapel's warm limestone, sunset-backlit
// rose glass (brighter and warmer than the kit's, since the rose window is
// the biggest light in the world), the shutter's old oak and the dusty
// stoneware cup. Ramps stay below Rosace's W1 white like the rest of the
// world. Imported by every chapel recipe so they exist before a build.

import { defineMaterial } from "../../materials.ts";

const T_METAL: [number, number, number] = [0.16, 0.46, 0.84];
const T_GLASS: [number, number, number] = [0.1, 0.35, 0.9];

/** Old gilt on the frames: warm, a little worn, with a glint. */
defineMaterial("gilt", { ramp: ["#3b2614", "#6b4a20", "#a27a34", "#d2ac5c"], t: T_METAL, behaviour: "none", hardness: 999, sound: "metal", glint: true, spec: { colour: "#f3dd9c", thr: 0.955 } });
/** Tarnished gilt for the inner lip and corners. */
defineMaterial("giltDark", { ramp: ["#241710", "#3f2a18", "#62441f", "#86632f"], t: T_METAL, behaviour: "none", hardness: 999, sound: "metal" });
/** The board behind each work (the DOM thumbnail sits exactly on it). Never lit up: a quiet dark. */
defineMaterial("artBoard", { ramp: ["#0d0b0f", "#121016", "#18151c", "#1e1a22"], t: [0.14, 0.42, 0.8], behaviour: "none", hardness: 999, sound: "wood", ink: false });
/** Warm limestone of the chapel (niche sills, the lectern, the crank post). */
defineMaterial("limestone", { ramp: ["#2d2428", "#4a3c3e", "#6d5a57", "#917a70"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 110, sound: "stone", debris: 0.3 });
/**
 * The chapel's own ashlar for anything built into its walls (door frames, the threshold): the same
 * violet-to-warm-grey family as the walls the backdrops draw (chapel.ts stone, outside.ts wall), so a
 * door's jambs and arch read as cut from the wall around them, not a grey frame stuck on (the DOOR RULE).
 */
defineMaterial("chapelStone", { ramp: ["#1e171f", "#33272f", "#4e3d41", "#715850"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.3 });
defineMaterial("chapelStoneLight", { ramp: ["#2a2027", "#45363a", "#655048", "#8c6e5c"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.3 });
defineMaterial("chapelStoneDark", { ramp: ["#120d13", "#1c151c", "#2a2028", "#3b2e34"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.3 });
/** The fallen ring's hull on the pilgrim path: the window surrounds set in its fins are cut from it. */
defineMaterial("hullStone", { ramp: ["#120f19", "#1d1727", "#2b2335", "#3f3248"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.3 });
defineMaterial("hullStoneDark", { ramp: ["#100d16", "#1a1522", "#272030", "#382e40"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 140, sound: "stone", debris: 0.3 });
/** Old oak (easels, shutter leaves, the broom's handle). */
defineMaterial("oak", { ramp: ["#1f1418", "#35221f", "#523426", "#704a31"], t: [0.14, 0.42, 0.8], behaviour: "splinter", hardness: 60, sound: "wood", debris: 0.25, bounce: 0.3 });
/** Rose-window glass, lit by the sunset behind it. */
defineMaterial("roseCrimson", { ramp: ["#3a0f1c", "#6e1c2e", "#b0364a", "#f08a86"], t: T_GLASS, glow: 0.92, glint: true, behaviour: "none", hardness: 999, sound: "glass", ink: false, spec: { colour: "#ffe0d4", thr: 0.97 } });
defineMaterial("roseGold", { ramp: ["#46300e", "#8a6018", "#d69a32", "#fbd88a"], t: T_GLASS, glow: 0.92, glint: true, behaviour: "none", hardness: 999, sound: "glass", ink: false, spec: { colour: "#fff2cc", thr: 0.97 } });
defineMaterial("roseViolet", { ramp: ["#1f1236", "#3c2266", "#6a45a8", "#b294e2"], t: T_GLASS, glow: 0.9, glint: true, behaviour: "none", hardness: 999, sound: "glass", ink: false, spec: { colour: "#efe4ff", thr: 0.97 } });
defineMaterial("roseBlue", { ramp: ["#101c38", "#1e3466", "#34589e", "#7ea4dc"], t: T_GLASS, glow: 0.9, glint: true, behaviour: "none", hardness: 999, sound: "glass", ink: false, spec: { colour: "#e2eeff", thr: 0.97 } });
defineMaterial("roseAmber", { ramp: ["#4a2210", "#8e421a", "#d6743a", "#f6b47c"], t: T_GLASS, glow: 0.92, glint: true, behaviour: "none", hardness: 999, sound: "glass", ink: false, spec: { colour: "#ffe6cc", thr: 0.97 } });
/** Glazed stoneware (the dusty second cup), with a dust bloom on top. */
defineMaterial("stoneware", { ramp: ["#2a2630", "#46404c", "#6a626c", "#908690"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 80, sound: "stone", debris: 0.3 });
defineMaterial("dustBloom", { ramp: ["#5a5258", "#716870", "#8a8088", "#a39aa0"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 20, sound: "stone", ink: false });
/** Broom straw gone grey with use. */
defineMaterial("broomStraw", { ramp: ["#3c3022", "#5e4c34", "#86704a", "#a89066"], t: [0.12, 0.4, 0.78], behaviour: "tear", hardness: 25, sound: "cloth", debris: 0.3 });
/** The shawl: a faded rose wool. */
defineMaterial("shawlRose", { ramp: ["#3a1c26", "#5c2c36", "#834446", "#a4645a"], t: [0.12, 0.4, 0.78], behaviour: "tear", hardness: 30, sound: "cloth", debris: 0.15 });

export const CHAPEL_MATERIALS = ["gilt", "giltDark", "artBoard", "limestone", "oak", "roseCrimson", "roseGold", "roseViolet", "roseBlue", "roseAmber", "stoneware", "dustBloom", "broomStraw", "shawlRose", "chapelStone", "chapelStoneLight", "chapelStoneDark", "hullStone", "hullStoneDark"] as const;

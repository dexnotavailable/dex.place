// How big titles and the dex mark are on screen, decided together (Dex,
// 2026-10-12: the mark is "decently large, a little smaller than the title text").
//
// Big titles (TESU, SHANSHUI, DOWNLOADS...) are drawn in world pixels at a
// whole-number scale of the font's pixel grid. The world view is 1280 x 720.

/** Cap height of Tesu Display in font pixels. */
export const TITLE_CAP = 20;

/** World pixels per font pixel for big titles: a 120 px cap, 1/6 of the view height. */
export const BIG_TITLE_SCALE = 6;

/** Place names (small, lower left) use a 2x scale: a 40 px cap. */
export const PLACE_TITLE_SCALE = 2;

/** Height of the world view the scales above are measured against. */
export const WORLD_VIEW_H = 720;

/**
 * The dex mark's width as a fraction of the 16:9 view height. TESU at the big
 * scale is 73 font px x 6 = 438 world px wide (0.608 of the view height); the
 * mark is 0.9 of that wide, so beside TESU it reads a little smaller. On a 1080p
 * screen that is 8 device px per mark pixel (the 74 px mark is 592 px wide).
 */
export const MARK_VS_TESU = 0.9;
export const MARK_WIDTH_OF_VIEW_H = MARK_VS_TESU * ((73 * BIG_TITLE_SCALE) / WORLD_VIEW_H);

/** On a portrait screen the mark is at least this share of the screen width. */
export const MARK_MIN_WIDTH_PORTRAIT = 0.55;

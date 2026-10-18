// The ofuda is the game's state (Dex 10-16; roadmap SITE-SCROLL.md, "The ofuda is the game's state"). This is
// that table as code, pure, so the page (motion/column.ts) and the checks read the same thing:
//
// | state      | top of the page                                  | website corner     | bottom of the website          |
// | loading    | "dex" drawn (it stays); the chibi icons cycle     | the cycling loader | the jetty, Zhusha; no button   |
// | loaded     | the ofuda in its original place, "click to continue" | the ofuda      | the jetty, Zhusha + the button |
// | in game    | the game world, live, as you left it              | nothing            | the jetty WITHOUT Zhusha       |
//
// "Corner" is where the loader / ofuda goes once the website covers the game screen: it trails down with the
// scroll and settles in the website's top-right corner; scrolling all the way back up brings it home.

export type FlowState = "loading" | "loaded" | "ingame";

export interface TopView {
  /** "dex" on the game screen (it stays until the press). */
  mark: boolean;
  /** The chibi loader cycling under it. */
  loader: boolean;
  /** The ofuda in its original place. */
  ofuda: boolean;
  /** "click to continue". */
  cont: boolean;
  /** The game itself shows (the black cover is gone). */
  game: boolean;
}

export interface BottomView {
  /** Zhusha on the jetty. */
  zhusha: boolean;
  /** "experience the world we made" (way 4). */
  button: boolean;
}

export type CornerView = "loader" | "ofuda" | "none";

export function topView(s: FlowState): TopView {
  return {
    mark: s !== "ingame",
    loader: s === "loading",
    ofuda: s === "loaded",
    cont: s === "loaded",
    game: s === "ingame",
  };
}

export function cornerView(s: FlowState): CornerView {
  return s === "loading" ? "loader" : s === "loaded" ? "ofuda" : "none";
}

export function bottomView(s: FlowState): BottomView {
  return { zhusha: s !== "ingame", button: s === "loaded" };
}

/**
 * How far the loader / ofuda has gone from its home on the game screen to the website's corner (0 home .. 1
 * corner), from how much of the game screen the website covers (0 .. 1). It sets off once the website starts
 * to come up and is in the corner before the game screen is half covered, so it never rides under the header.
 */
export function trail(cover: number): number {
  const u = Math.min(1, Math.max(0, (cover - 0.04) / 0.46));
  return u * u * (3 - 2 * u);
}

/** Where it is (css px, the viewport), between home and the corner, with a sway on the way like paper on wind. */
export function trailPoint(
  f: number,
  home: { x: number; y: number },
  corner: { x: number; y: number },
  vw: number,
): { x: number; y: number } {
  const sway = Math.sin(f * Math.PI) * vw * 0.06;
  return { x: home.x + (corner.x - home.x) * f + sway, y: home.y + (corner.y - home.y) * f };
}

/** Way 4: the corner ofuda drifts right to left down into the jetty scene to her hands (0..1 along). */
export function driftPoint(u: number, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
  // a falling leaf: side to side on the way down, wider at first
  const wob = Math.sin(u * Math.PI * 3) * (1 - u) * Math.abs(to.x - from.x) * 0.12;
  return { x: from.x + (to.x - from.x) * e + wob, y: from.y + (to.y - from.y) * (u * u * 0.35 + e * 0.65) };
}

// The home page's choreography as numbers (pure: no DOM, no GSAP; motion/choreo.ts plays it). Built to
// lanes/motion/DESIGN-1019.md 3 ("Paper over Tesu", Dex 10-19: "as you scroll down the world is already there; the
// white backgrounds slide in from their direction, then the content comes in too ... each card slides in with an ease;
// the white bands between the alternating sections slide in too"). s = a band's side sign: its paper docks left (-1)
// or right (+1); "from its side" = from s.

export type Side = -1 | 1;

/** A strip (full-width white with the title) is fully in when its top is this far above the screen's foot (its own
 *  height): exactly as the change of place under its bottom edge comes into view. */
export const STRIP_START = "top bottom";
export const stripEnd = (stripH: number): string => `top bottom-=${Math.round(stripH)}`;
/** A panel (the section's paper) is a triggered slide, not a scrub (site loop round 1: a scrubbed panel stalled short of
 *  its place, blank, whenever the reader stopped scrolling with a band half way up the screen): it plays once its top
 *  crosses this line, and never goes back (until the band is set back). */
// (site loop v3 round 3: the paper leads, it starts the moment its top shows, so stopping mid-entry never leaves bare
// world between a strip and its own paper)
export const PANEL_AT = (phone: boolean): string => (phone ? "top 94%" : "top bottom");
/** The panel's slide (s): its paper and its shade together, expo.out. */
export const PANEL_TIME = 0.6;
/** The content's gate opens this far through the panel's slide (a share of its time). Site loop v3 round 1 (Dex 10-20:
 *  "have the white background go in first, then the UI elements like cards and stuff come in from under the top one"):
 *  the paper lands first (expo.out: ~88% of its way by then), then the content slides out from under the strip above
 *  it, staggered; never on bare world, never on long-empty paper (~0.18 s). */
export const CONTENT_GATE = 0.3;
/** A band entered at this scroll speed (|n|) or faster gets its content with its paper at once (one landing). */
export const FAST_N = 0.5;
/** The spine (the panel's open edge) draws this far through the slide. */
export const SPINE_AT = 0.55;
/** A band on screen that a jump, a focus or the watchdog settles plays the rest of its entrance in this long (s); only
 *  bands off the screen are simply set. */
export const SETTLE_TIME = 0.45;
/** (v2) The stitch was opaque this soon (s); since v3 round 1 it is never see-through at all (it unrolls, solid). */
export const STITCH_FADE = 0.14;
/** Phones run every duration at this share. */
export const PHONE_TIME = 0.8;

export const expoOut = (p: number): number => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
export const power2Out = (p: number): number => 1 - (1 - p) * (1 - p);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A latched progress: follows the scroll on the way in, never goes back (until the band is reset). */
export const latch = (prev: number, raw: number): number => Math.max(prev, clamp01(raw));

/** The strip's paper at progress p: across from its side, sheared, landing square (no lag: it must cover the cut). Its
 *  shade takes the same pose (it is the paper's shadow: never cast where the paper is not), only its opacity ramps. */
export function stripPose(p: number, s: Side, phone = false): { xPercent: number; skewX: number; shade: number } {
  const e = expoOut(clamp01(p));
  return { xPercent: s * 101 * (1 - e) || 0, skewX: -s * (phone ? 4 : 6) * (1 - e) || 0, shade: e };
}

/** The panel's paper (and its shade, the same pose) off its own side, before its slide. */
export const panelFrom = (s: Side): number => s * 101;

/** How content lands (from-vars): drop (out from under the layer above it: down and in), rise (up and in), side (in
 *  from the band's side), pop (pixel keys). */
export type Variant = "drop" | "rise" | "side" | "pop";
export function contentFrom(v: Variant, s: Side, phone = false): Record<string, number> {
  if (v === "drop") return { y: phone ? -32 : -48, autoAlpha: 0 };
  if (v === "side") return { x: s * (phone ? 32 : 48), autoAlpha: 0 };
  if (v === "pop") return { scale: 0.8, autoAlpha: 0 };
  return { y: phone ? 28 : 40, autoAlpha: 0 };
}

/** The stitch (what hangs off the paper onto the world) slides out from under the strip with the content, square and
 *  solid once its paper is behind it (site loop v3 round 1: flown in from the world side it crossed bare world half
 *  see-through, tilted like a glitch). */
export function stitchFrom(phone = false): { y: number; autoAlpha: number; clipPath: string } {
  return { y: phone ? -32 : -48, autoAlpha: 1, clipPath: "inset(-24px -100vw 100% -100vw)" };
}

/** The scroll's speed as -1..1 from the scroll's change in one ticker frame (css px), 0 at rest. A finger moves the
 *  page fewer px a frame than a wheel flick does: phones read it at a higher gain (site loop v2 round 1: a fling peaked
 *  at a third of the cards' lean). */
export const speedOf = (dy: number, phone = false): number => (Number.isFinite(dy) ? Math.max(-1, Math.min(1, dy / (phone ? 14 : 40))) : 0);

/** The world under the pointer (DESIGN-1019 4.2): its shift against the pointer at -1..1 across the screen, in whole art
 *  pixels (an art px is `px` css px), at most ax / ay css px each way. */
export function worldShift(p: number, a: number, px: number): number {
  const v = -Math.max(-1, Math.min(1, p)) * a;
  return Math.round(v / px) * px || 0;
}

/** A key's magnetic pull toward the pointer (4.2): from the key's centre to the pointer (css px), capped at `max`. */
export function pull(dx: number, dy: number, max = 6, gain = 0.2): [number, number] {
  let x = dx * gain, y = dy * gain;
  const l = Math.hypot(x, y);
  if (l > max) { x = (x / l) * max; y = (y / l) * max; }
  return [x, y];
}

/** The fore piece rides the scroll a little faster than the paper (it is nearer): y over the band's passage. */
export function foreY(p: number, phone = false): number {
  const [a, b] = phone ? [30, -60] : [60, -120];
  return Math.round(a + (b - a) * clamp01(p));
}

/** At arm time a band whose top is already above the screen's foot is simply there (deep links, a reload mid-page,
 *  a scroll before the chunk arrived); only bands wholly below are set back to play. */
export const isBelow = (bandTop: number, vh: number): boolean => bandTop >= vh;

/** A box (its top and bottom on the screen) any part of which is on the screen: a settle there plays out, never pops. */
export const onScreen = (top: number, bottom: number, vh: number): boolean => bottom > 0 && top < vh;

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
export const PANEL_AT = (phone: boolean): string => (phone ? "top 94%" : "top 92%");
/** The panel's slide (s): its paper and its shade together, expo.out. */
export const PANEL_TIME = 0.75;
/** The content's gate opens this far through the panel's slide (a share of its time). Site loop v2 round 1: the content
 *  rides in on the moving paper (its column slides with the paper, one pose, so it is never on bare world), so the
 *  first batch lands while the paper is still coming (expo.out: ~57% of its way), never on long-empty paper. */
export const CONTENT_GATE = 0.12;
/** A band entered at this scroll speed (|n|) or faster gets its content with its paper at once (one landing). */
export const FAST_N = 0.5;
/** The spine (the panel's open edge) draws this far through the slide. */
export const SPINE_AT = 0.55;
/** A band on screen that a jump, a focus or the watchdog settles plays the rest of its entrance in this long (s); only
 *  bands off the screen are simply set. */
export const SETTLE_TIME = 0.45;
/** The stitch is opaque this soon (s): it flies in solid, never a see-through slab over the world. */
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

/** How content lands (from-vars): rise (up and in), side (in from the band's side), pop (pixel keys). */
export type Variant = "rise" | "side" | "pop";
export function contentFrom(v: Variant, s: Side, phone = false): Record<string, number> {
  if (v === "side") return { x: s * (phone ? 32 : 48), autoAlpha: 0 };
  if (v === "pop") return { scale: 0.8, autoAlpha: 0 };
  return { y: phone ? 28 : 40, autoAlpha: 0 };
}

/** The stitch comes from the world side (the other side from its paper), turning as it lands. */
export function stitchFrom(s: Side, vw: number, phone = false): { x: number; rotation: number; autoAlpha: number } {
  return { x: -s * vw * (phone ? 0.4 : 0.18), rotation: -s * 3, autoAlpha: 0 };
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

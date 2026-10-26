// Pixel Yuki: YUKI's mascot as the app draws her, a 32 x 32 chibi bust (Dex 10-26: the site's Yuki stays the app's).
// Her pixels are the app's own, synced as data into yuki-faces.ts (tools/yuki-faces/sync.mjs, which checks them against
// the app's faces pixel for pixel); this draws them. One SVG unit a pixel and one <path> per colour per layer, so she
// stays crisp at any whole-number scale. DOM-free: it renders at build time and runs under `node --test`.
//
// Layers, as the app animates them (YUKI ui/Mascot.tsx): the back hair and the head bob a pixel over still shoulders;
// the eyes, blush and mouth sit on the head as layers of their own, so a blink, a glance or a new face is one attribute
// and never a redraw; the ahoge sways on two sprite frames. Which face shows: `data-eyes` and `data-mouth` on the svg;
// the blush turns strong with the eyes that call for it (happy, wide, squeeze), as in the app's expressions; the open
// eyes glance with `data-look` (-1, 0, 1), or on their own idle clock without it. Asleep, the app's zz floats by her.
// A hop lands on the app's squash frame: her long hair splayed a pixel and her open eyes turned to the app's (LAND).
// styles/yuki.css shows and moves them; motion/yuki.ts changes them.

import { rng } from "./render/html.ts";
import { BACK, BLUSH, BODY, EYES, FACE, FRONT, HEAD, LAND, MOUTHS, PALETTE, PROPS, TIMING, type FaceKey, type Layer } from "./yuki-faces.ts";

/** Her palette (the app's look "yuki"). */
export const YUKI_PALETTE = PALETTE;

/** The eyes the site shows (the app has more: focused, sad). "open" also carries its glances. */
export const YUKI_EYES = ["open", "half", "closed", "happy", "sleepy", "wide", "squeeze"] as const;
export type YukiEyes = (typeof YUKI_EYES)[number];
/** Eyes that open: she blinks and glances only with these, and a new face arrives behind a blink before them. */
export const OPEN_EYES: readonly YukiEyes[] = ["open", "wide"];
/** Eyes whose face has the strong blush (the app's happy, surprised and boop). */
export const STRONG_BLUSH: readonly YukiEyes[] = ["happy", "wide", "squeeze"];

/** The mouths the site shows: small (at rest), smile (open, happy), open (a little "o": mid-word, surprised). */
export const YUKI_MOUTHS = ["small", "smile", "open"] as const;
export type YukiMouth = (typeof YUKI_MOUTHS)[number];

/** The app's timings, for the stylesheet and the script (tests keep styles/yuki.css in step with them). */
export const YUKI_TIMING = TIMING;

/** One <path> per colour, one rectangle per horizontal run. */
export function layerPaths(layer: Layer): string {
  const runs = new Map<string, string>();
  layer.rows.forEach((row, i) => {
    const y = layer.y + i;
    for (let x = 0; x < row.length;) {
      const ch = row[x] as string;
      if (ch === ".") { x += 1; continue; }
      const start = x;
      while (x < row.length && row[x] === ch) x += 1;
      runs.set(ch, (runs.get(ch) ?? "") + `M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  });
  let out = "";
  for (const [ch, d] of runs) out += `<path fill="${PALETTE[ch as FaceKey]}" d="${d}"/>`;
  return out;
}

const same = (a: Layer, b: Layer): boolean => a.y === b.y && a.rows.join("|") === b.rows.join("|");

/**
 * Her blink's and her idle glance's clocks, seeded (styles/yuki.css reads them): a blink every 4.1 to 6.3 s (the app
 * blinks every 3-6 s at random) and a look aside every 13 to 19 s, each from its own start, so two Yukis on one screen
 * never blink or look in step. A stage sets them for the Yuki inside it (render/yukiart.ts); a lone one takes its seed.
 */
export function blinkVars(seed: string): string {
  const r = rng(`${seed}-blink`);
  const period = 4.1 + r() * 2.2;
  const at = -r() * period;
  const look = 13 + r() * 6;
  return `--blink:${period.toFixed(2)}s;--blink-at:${at.toFixed(2)}s;--look:${look.toFixed(2)}s;--look-at:${(-r() * look).toFixed(2)}s`;
}

export interface YukiSpriteOptions {
  /** Screen pixels per sprite pixel (whole numbers keep it crisp); omit to size it in CSS. */
  scale?: number;
  /** The face she starts with (styles/yuki.css shows it; motion/yuki.ts changes it). */
  eyes?: YukiEyes;
  mouth?: YukiMouth;
  className?: string;
  /** Accessible name; without it she is decorative. */
  label?: string;
  /** Seeds her clocks (blinkVars); without it she follows her stage's, or the stylesheet's defaults. */
  seed?: string;
}

/**
 * Pixel Yuki as inline SVG: `svg.yk[data-eyes][data-mouth]`. Every face she shows is in the markup; the attributes pick
 * one, so a change of face is an attribute and never a fetch.
 */
export function yukiSprite(o: YukiSpriteOptions = {}): string {
  const scale = o.scale;
  const size = scale ? ` width="${FACE * scale}" height="${FACE * scale}"` : "";
  const a11y = o.label
    ? `role="img" aria-label="${o.label.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"`
    : `aria-hidden="true" focusable="false"`;
  const g = (cls: string, inner: string): string => `<g class="${cls}">${inner}</g>`;
  // two sprite frames, or one layer when they are the same (her long hair hangs still; the ahoge sways)
  const frames = (cls: string, [a, b]: readonly [Layer, Layer]): string =>
    same(a, b) ? g(cls, layerPaths(a)) : g(cls, g("yk__fa", layerPaths(a)) + g("yk__fb", layerPaths(b)));
  const eyes = YUKI_EYES.map((k) =>
    k === "open"
      ? g("yk__e yk__e--open", g("yk__look yk__look--0", layerPaths(EYES.open)) + g("yk__look yk__look--l", layerPaths(EYES["open-l"])) + g("yk__look yk__look--r", layerPaths(EYES["open-r"])))
      : g(`yk__e yk__e--${k}`, layerPaths(EYES[k])),
  ).join("");
  const land = LAND.head.rows.length ? g("yk__land", layerPaths(LAND.head)) : "";
  return (
    `<svg class="yk${o.className ? ` ${o.className}` : ""}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACE} ${FACE}"${size} ` +
    `shape-rendering="crispEdges" data-eyes="${o.eyes ?? "open"}" data-mouth="${o.mouth ?? "small"}" ${a11y}` +
    `${o.seed ? ` style="${blinkVars(o.seed)}"` : ""}>` +
    `<g class="yk__hop">` +
    g("yk__bob yk__back", frames("yk__bk", BACK) + g("yk__land", layerPaths(LAND.back))) +
    g("yk__body", layerPaths(BODY)) +
    `<g class="yk__bob yk__head">` +
    layerPaths(HEAD) +
    land +
    g("yk__eyes", eyes) +
    g("yk__land-eyes", layerPaths(EYES[LAND.eyes])) +
    g("yk__bl yk__bl--soft", layerPaths(BLUSH.soft)) + g("yk__bl yk__bl--strong", layerPaths(BLUSH.strong)) +
    YUKI_MOUTHS.map((k) => g(`yk__m yk__m--${k}`, layerPaths(MOUTHS[k]))).join("") +
    frames("yk__front", FRONT) +
    frames("yk__zz", [PROPS.zz, PROPS["zz-up"]]) +
    `</g></g></svg>`
  );
}

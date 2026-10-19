// A project's card art (Dex 10-19: "it'll look better if it takes up the whole item card instead of just the text
// window on top, give it a shine, make it look attractive, layer it so the art pans and moves within the card").
//
// The layers (public/site/cards/<project id>/0.png the back .. n-1 the front, all one size) are stacked over the whole
// card, each blown up by a whole number of pixels (styles/landing.css .cart: CSS round(), no script) and loaded lazily.
// They pan: with the pointer on a desktop (motion/magnet.ts moves every [data-depth] layer of a [data-tilt-scene]),
// with the scroll everywhere (a CSS view timeline), and in a slow drift on touch screens; a shine sweeps across the
// art. Reduced motion: all of it still. Decorative (aria-hidden): the card's name and line say what it is.

import type { Project } from "../data/projects.ts";

/** The pan of each layer, back to front (css px at full sway): the far sky barely moves, the subject most. */
const DEPTHS = [1, 2, 3] as const;

export function cardArt(p: Project, className?: string): string {
  const { w, h, layers } = p.art;
  let imgs = "";
  for (let i = 0; i < layers; i++) {
    const d = DEPTHS[Math.min(DEPTHS.length - 1, Math.round((i / Math.max(1, layers - 1)) * (DEPTHS.length - 1)))] ?? 1;
    imgs +=
      `<img class="cart__l" data-depth="${d}" src="/site/cards/${p.id}/${i}.png" alt="" width="${w}" height="${h}" ` +
      `loading="lazy" decoding="async" style="--pd:${d * 5}">`;
  }
  return (
    `<div class="cart${className ? ` ${className}` : ""}" data-tilt-scene aria-hidden="true" style="--aw:${w};--ah:${h}">` +
    `${imgs}<span class="cart__shine"></span></div>`
  );
}

// A project's card art (Dex 10-19: "it'll look better if it takes up the whole item card instead of just the text
// window on top, give it a shine, make it look attractive, layer it so the art pans and moves within the card").
//
// Two kinds, both layered over the whole card, both loaded lazily and decorative (aria-hidden: the card's name and line
// say what it is):
// - a rig (Dex 10-19: the card-art lane traces each splash, labels its parts and ships each part as a webp layer with a
//   rig.json; format in lanes\motion\NOTEBOOK.md ASKS 00): public/site/cards/<id>/rig.json + <part>.webp. The parts are
//   plain <img> in an art box that CSS places from the rig's face focus (styles/landing.css .cart--rig), so the card
//   shows without a script; the vector finish animates them with CSS (each part's motions become its --anim), the
//   pixel finish draws them onto the site's pixel grid (motion/cardrig.ts).
// - the plain layers (until a card has its rig): public/site/cards/<id>/0.png (back) .. n-1.png (front), all one size,
//   each blown up by a whole number of pixels (CSS round(), no script).
// Both pan: with the pointer on a desktop (motion/magnet.ts moves every [data-depth] layer of a [data-tilt-scene]),
// with the scroll everywhere (a CSS view timeline) and in a slow drift on touch screens; a shine sweeps across.
// Reduced motion: all of it still.

import { readFileSync } from "node:fs";
import type { Project } from "../data/projects.ts";
import { normaliseRig, type RigPartV2, type RigV2 } from "../motion/rig-read.ts";
import { esc } from "./html.ts";

export type { RigMotion, RigPartV2, RigV2 } from "../motion/rig-read.ts";

/** The pan of each layer, back to front (css px at full sway): the far sky barely moves, the subject most. */
const DEPTHS = [1, 2, 3] as const;

/** A card's rig, read from public/ when the page is built (null: none, or unreadable). */
export function rigOf(p: Project): RigV2 | null {
  if (!p.art.rig) return null;
  try {
    return normaliseRig(JSON.parse(readFileSync(new URL(`../../../public/site/cards/${p.id}/rig.json`, import.meta.url), "utf8")));
  } catch {
    return null;
  }
}

const pct = (v: number): string => `${+(v * 100).toFixed(3)}%`;
const depthBucket = (d: number): number => (d < 0.34 ? 1 : d < 0.67 ? 2 : 3);

/**
 * A part's motions as CSS: the animation list (--anim) and the values its keyframes read (styles/landing.css rig-*).
 * Moves are in percent of the part's own box (translate %), so they scale with the card.
 */
export function motionCss(part: RigPartV2): string {
  const [, , w, h] = part.box;
  const anims: string[] = [];
  const vars: string[] = [];
  for (const m of part.motion ?? []) {
    const per = Math.max(0.2, m.period), delay = `${+(-(m.phase ?? 0) * per).toFixed(3)}s`, half = `${+(per / 2).toFixed(3)}s`;
    if (m.kind === "sway") { vars.push(`--rig-deg:${m.deg ?? 2}deg`); anims.push(`rig-sway ${half} ease-in-out ${delay} infinite alternate`); }
    else if (m.kind === "breathe") { vars.push(`--rig-s:${m.scale ?? 0.01}`); anims.push(`rig-breathe ${half} ease-in-out ${delay} infinite alternate`); }
    else if (m.kind === "bob" || m.kind === "drift") {
      vars.push(`--rig-bx:${pct((m.dx ?? 0) / w)}`, `--rig-by:${pct((m.dy ?? (m.kind === "bob" ? 2 : -10)) / h)}`);
      anims.push(m.kind === "bob" ? `rig-bob ${half} ease-in-out ${delay} infinite alternate` : `${m.fade ? "rig-drift-fade" : "rig-drift"} ${per}s linear ${delay} infinite`);
    } else if (m.kind === "glow") { vars.push(`--rig-lo:${m.min ?? 0.6}`, `--rig-hi:${m.max ?? 1}`); anims.push(`rig-glow ${half} ease-in-out ${delay} infinite alternate`); }
    else if (m.kind === "flicker") { vars.push(`--rig-lo:${m.min ?? 0.5}`, `--rig-hi:${m.max ?? 1}`); anims.push(`rig-flicker ${per}s steps(1, end) ${delay} infinite`); }
  }
  return anims.length ? `${vars.join(";")};--anim:${anims.join(", ")}` : "";
}

function rigArt(p: Project, rig: RigV2, className?: string): string {
  const [W, H] = rig.size;
  const [fx, fy] = rig.focus ?? [W / 2, H * 0.3];
  let layers = "";
  for (const part of rig.parts) {
    const [x, y, w, h] = part.box;
    const pv = part.pivot ?? [x + w / 2, y + h / 2];
    const d = part.depth ?? 0.5;
    const style = [
      `left:${pct(x / W)}`, `top:${pct(y / H)}`, `width:${pct(w / W)}`, `height:${pct(h / H)}`,
      `transform-origin:${pct((pv[0] - x) / w)} ${pct((pv[1] - y) / h)}`, motionCss(part),
    ].filter(Boolean).join(";");
    layers +=
      `<div class="rig__l" data-depth="${depthBucket(d)}" style="--pd:${Math.round(d * 15)}">` +
      `<img class="rig__p" src="/site/cards/${p.id}/${esc(part.src)}" alt="" loading="lazy" decoding="async" data-part="${esc(part.id)}" style="${style}"></div>`;
  }
  return (
    `<div class="cart cart--rig${rig.pixelated ? " cart--px" : ""}${className ? ` ${className}` : ""}" data-tilt-scene data-rig="/site/cards/${p.id}/" aria-hidden="true" ` +
    `style="--aw:${W};--ah:${H};--fx:${+(fx / W).toFixed(4)};--fy:${+(fy / H).toFixed(4)}">` +
    `<div class="rig__box">${layers}</div><span class="cart__shine"></span></div>`
  );
}

export function cardArt(p: Project, className?: string): string {
  const rig = rigOf(p);
  if (rig) return rigArt(p, rig, className);
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

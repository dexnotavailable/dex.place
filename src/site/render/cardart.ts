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
// Both pan with the scroll everywhere (a CSS view timeline) and in a slow drift on touch screens; a shine sweeps across.
// The pointer's tilt and depth are the card's own (motion/pcard.ts, lane K), not motion/magnet.ts's.
// Reduced motion: all of it still.

import { existsSync, readFileSync } from "node:fs";
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

/** Extras the project cards add to their art (render/pcard.ts); the project page's framed picture has none. */
export interface CardArtExtras {
  /** The giant numeral ("01") between the back parts and the figure (DESIGN-1019 5.3). */
  numeral?: string;
  /** The card's foot scrim and the pointer glare. */
  card?: boolean;
  /** A banner's hero window (render/pbanner.ts): decorative (the banner's name says what it is), no chrome of its own. */
  decor?: boolean;
}

/** One rig part as a layer: the wrapper (motion/pcard.ts moves it by depth) and the part (CSS plays its motions). */
function rigLayer(p: Project, rig: RigV2, part: RigPartV2, pop = false): string {
  const [W, H] = rig.size;
  const [x, y, w, h] = part.box;
  const pv = part.pivot ?? [x + w / 2, y + h / 2];
  const d = part.depth ?? 0.5;
  const style = [
    `left:${pct(x / W)}`, `top:${pct(y / H)}`, `width:${pct(w / W)}`, `height:${pct(h / H)}`,
    `transform-origin:${pct((pv[0] - x) / w)} ${pct((pv[1] - y) / h)}`, motionCss(part),
  ].filter(Boolean).join(";");
  return (
    `<div class="rig__l" data-z="${+d.toFixed(2)}"${part.pop && !pop ? " data-pop" : ""} style="--pd:${Math.round(d * 15)}">` +
    `<img class="rig__p" src="/site/cards/${p.id}/${esc(part.src)}" alt="" loading="lazy" decoding="async" data-part="${esc(part.id)}" style="${style}"></div>`
  );
}

/** Where the numeral goes: after the part rig.json names, else after the last part shallower than 0.34. */
export function numeralAt(rig: RigV2): number {
  const named = rig.numeral ? rig.parts.findIndex((q) => q.id === rig.numeral) : -1;
  if (named >= 0) return named + 1;
  let at = 0;
  rig.parts.forEach((q, i) => { if ((q.depth ?? 0.5) < 0.34) at = i + 1; });
  return at;
}

const artVars = (rig: RigV2): string => {
  const [W, H] = rig.size;
  const [fx, fy] = rig.focus ?? [W / 2, H * 0.3];
  return `--aw:${W};--ah:${H};--fx:${+(fx / W).toFixed(4)};--fy:${+(fy / H).toFixed(4)}`;
};

/** The card has line art for its entrance (public/site/cards/<id>/lines.svg): the deck fetches it only then. */
const hasLines = (p: Project): boolean => existsSync(new URL(`../../../public/site/cards/${p.id}/lines.svg`, import.meta.url));

/** On a card the art is decorative (the card's name says what it is); elsewhere (the project page) it is a picture. */
const a11y = (p: Project, extras: CardArtExtras): string =>
  !extras.card && !extras.decor && p.art.alt
    ? `role="img" aria-label="${esc(`${p.art.alt}${p.art.credit ? ` ${p.art.credit}.` : ""}`)}"`
    : `aria-hidden="true"`;

function rigArt(p: Project, rig: RigV2, className?: string, extras: CardArtExtras = {}): string {
  const layers = rig.parts.map((part) => rigLayer(p, rig, part));
  let art: string;
  if (extras.numeral !== undefined) {
    const at = numeralAt(rig);
    art =
      `<div class="rig__box">${layers.slice(0, at).join("")}</div>` +
      `<span class="cart__num">${esc(extras.numeral)}</span>` +
      `<div class="rig__box">${layers.slice(at).join("")}</div>`;
  } else {
    art = `<div class="rig__box">${layers.join("")}</div>`;
  }
  return (
    `<div class="cart cart--rig${rig.pixelated ? " cart--px" : ""}${className ? ` ${className}` : ""}" data-rig="/site/cards/${p.id}/"${hasLines(p) ? " data-lines" : ""} ${a11y(p, extras)} ` +
    `style="${artVars(rig)}">` +
    `<div class="cart__art">${art}</div>` +
    (extras.card ? `<span class="cart__scrim"></span><span class="cart__glare"></span>` : "") +
    (extras.decor ? "" : `<span class="cart__shine"></span>`) + `</div>`
  );
}

/**
 * The pop part (rig.json `pop: true`) drawn again outside the card's clip, so the character steps out of her frame
 * (DESIGN-1019 5.3): `div.pcard__pop`, placed exactly like the art box. Empty when the rig has none.
 */
export function popArt(p: Project): string {
  const rig = rigOf(p);
  const part = rig?.parts.find((q) => q.pop);
  if (!rig || !part) return "";
  return (
    `<div class="pcard__pop${rig.pixelated ? " cart--px" : ""}" aria-hidden="true" style="${artVars(rig)}">` +
    `<div class="cart__art"><div class="rig__box">${rigLayer(p, rig, part, true)}</div></div></div>`
  );
}

export function cardArt(p: Project, className?: string, extras: CardArtExtras = {}): string {
  const rig = rigOf(p);
  if (rig) return rigArt(p, rig, className, extras);
  const { w, h, layers } = p.art;
  const imgs: string[] = [];
  for (let i = 0; i < layers; i++) {
    const d = DEPTHS[Math.min(DEPTHS.length - 1, Math.round((i / Math.max(1, layers - 1)) * (DEPTHS.length - 1)))] ?? 1;
    imgs.push(
      `<img class="cart__l" data-depth="${d}" src="/site/cards/${p.id}/${i}.png" alt="" width="${w}" height="${h}" ` +
      `loading="lazy" decoding="async" style="--pd:${d * 5}">`,
    );
  }
  // (the numeral after the back layer)
  if (extras.numeral !== undefined) imgs.splice(1, 0, `<span class="cart__num">${esc(extras.numeral)}</span>`);
  return (
    `<div class="cart${className ? ` ${className}` : ""}" aria-hidden="true" style="--aw:${w};--ah:${h}">` +
    `${imgs.join("")}` +
    (extras.card ? `<span class="cart__scrim"></span><span class="cart__glare"></span>` : "") +
    `<span class="cart__shine"></span></div>`
  );
}

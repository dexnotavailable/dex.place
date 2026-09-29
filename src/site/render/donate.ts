// Donate: a home-page section and /donate/. Ko-fi, and an MB Bank VietQR whose
// amount can be prefilled.
//
// Everything is prerendered. Without JS the page shows the Ko-fi link, the
// account-only QR (no amount) and the bank details as selectable text. With
// JS, motion/donate.ts wakes the amount slider and quick picks, which redraw
// the QR live. Styles: styles/donate.css.

import { KOFI_URL } from "../data/nav.ts";
import { QR_TAG_NONE, QUICK_PICKS, STOPS, TICKS, donateQr, fineText, formatVnd, shortVnd, trackPos } from "../donate.ts";
import { pathsMarkup, type PixelGrid } from "../pixels.ts";
import { MB_BANK, TRANSFER_NOTE } from "../vietqr.ts";
import { floats } from "./floats.ts";
import { copyButton, icon, pageHead, sectionHead, tile } from "./glyphs.ts";
import { esc } from "./html.ts";

type Level = 2 | 3;

// Ko-fi's stage: a pixel cup with a heart on it, drawn here (CANON: assets are
// drawn in code). w off-white body, k the coffee, p the heart, g the saucer
// shadow and the steam. Two steam frames alternate in steps (donate.css).
const CUP: PixelGrid = [
  "..wwwwwwwwwwwww.....",
  "..wkkkkkkkkkkkwwww..",
  "..wwwwwwwwwwwww..w..",
  "..wwwwppwppwwww..w..",
  "..wwwpppppppwww..w..",
  "..wwwwpppppwwwwwww..",
  "..wwwwwpppwwwww.....",
  "...wwwwwpwwwww......",
  "....wwwwwwwww.......",
  "wwwwwwwwwwwwwwwww...",
  ".ggggggggggggggg....",
];
const STEAM: readonly PixelGrid[] = [
  [".......g...g........", "......g...g.........", ".......g...g........", "......g...g........."],
  ["......g...g.........", ".......g...g........", "......g...g.........", ".......g...g........"],
];

function cup(scale: number): string {
  const w = 20;
  const h = 16;
  return (
    `<svg class="px kofi__cup" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" ` +
    `shape-rendering="crispEdges" aria-hidden="true" focusable="false">` +
    STEAM.map((g, i) => `<g class="kofi__steam kofi__steam--${i}">${pathsMarkup(g)}</g>`).join("") +
    `<g transform="translate(0 5)">${pathsMarkup(CUP)}</g></svg>`
  );
}

/** Card header shared by both cards: tone tile, pixel name, one plain line. */
function head(ic: "heart" | "bank", name: string, line: string, tag: "span" | "h2" | "h3", id?: string): string {
  return (
    `<span class="dhead">${tile(ic, "magenta", "l")}` +
    `<span class="dhead__text"><${tag} class="dhead__name"${id ? ` id="${id}"` : ""}>${esc(name)}</${tag}>` +
    `<span class="dhead__line">${esc(line)}</span></span></span>`
  );
}

function kofiCard(): string {
  return (
    `<a class="card kofi" href="${KOFI_URL}" rel="noopener" data-reveal>` +
    head("heart", "Ko-fi", "ko-fi.com/dexdonation", "span") +
    `<span class="kofi__stage" aria-hidden="true">${cup(8)}</span>` +
    `<span class="btn btn--magenta btn--l kofi__cta"><span class="btn__label">Open Ko-fi</span><span class="btn__ic">${icon("external", 3)}</span></span>` +
    `</a>`
  );
}

function amountPanel(): string {
  const last = STOPS.length - 1;
  const ticks = TICKS.map((t) => `<span style="--at:${trackPos(t).toFixed(4)}">${shortVnd(t)}</span>`).join("");
  const picks = QUICK_PICKS.map(
    (n) => `<button class="pick pop" type="button" data-pick="${n}" aria-pressed="false" aria-label="${esc(formatVnd(n))}">${shortVnd(n)}</button>`,
  ).join("");
  return (
    // Hidden without JS (styles: html:not(.js) .amt); the static QR works alone.
    `<div class="amt" data-donate-amount>` +
    `<p class="amt__label" id="amt-label">Amount</p>` +
    `<p class="amt__readout"><span class="amt__num" data-amt-num>Any amount</span><span class="amt__unit">VND</span></p>` +
    `<div class="amt__slider" style="--pos:0">` +
    `<span class="amt__track" aria-hidden="true"><i class="amt__fill"></i></span>` +
    `<input class="amt__range" type="range" autocomplete="off" min="0" max="${last}" step="1" value="0" data-amt-range ` +
    `aria-labelledby="amt-label" aria-valuetext="No amount set" aria-describedby="amt-hint" />` +
    `<span class="amt__ticks" aria-hidden="true">${ticks}</span>` +
    `</div>` +
    `<p class="sr" id="amt-hint">From 100,000 to 10,000,000 VND. Moving it puts the amount in the QR code.</p>` +
    `<div class="amt__picks" role="group" aria-label="Quick amounts">` +
    `<button class="pick pick--none pop" type="button" data-pick="0" aria-pressed="true">${icon("close", 2)}<span>Any amount</span></button>` +
    picks +
    `</div>` +
    `</div>`
  );
}

/** The QR in a square window: a magenta title bar with the amount tag, then
    the code, black on white with its full quiet zone (it must scan). */
function qrWindow(): string {
  return (
    `<div class="qr" data-qr>` +
    `<p class="qr__bar"><span class="qr__name">${icon("qr", 2)}<span>VietQR</span></span>` +
    `<span class="qr__tag" data-qr-tag>${QR_TAG_NONE}</span></p>` +
    `<div class="qr__code" data-qr-code>${donateQr(0)}</div>` +
    `</div>`
  );
}

function bankCard(level: Level): string {
  return (
    `<section class="card bank" aria-labelledby="bank-title" data-donate data-state="none" data-reveal style="--i:1">` +
    head("bank", "MB Bank", "Bank transfer by QR", `h${level}`, "bank-title") +
    `<div class="bank__grid">` +
    qrWindow() +
    amountPanel() +
    `<dl class="kv bank__kv">` +
    `<div><dt>Bank</dt><dd><span>${esc(MB_BANK.bank)}</span></dd></div>` +
    `<div><dt>Account</dt><dd><span class="kv__mono">${esc(MB_BANK.account)}</span>${copyButton(MB_BANK.account, "account number")}</dd></div>` +
    `<div><dt>Recipient</dt><dd><span>${esc(MB_BANK.holder)}</span>${copyButton(MB_BANK.holder, "recipient name")}</dd></div>` +
    `<div><dt>Note</dt><dd><span>${esc(TRANSFER_NOTE)}</span>${copyButton(TRANSFER_NOTE, "transfer note")}</dd></div>` +
    `</dl>` +
    `</div>` +
    `<p class="fine bank__fine" data-amt-fine>${esc(fineText(0))}</p>` +
    `<p class="sr" aria-live="polite" data-amt-live></p>` +
    `</section>`
  );
}

/** Ko-fi and the bank card; the bank card's title at `level`. */
export function donateBody(level: Level): string {
  return `<div class="donate">${kofiCard()}${bankCard(level)}</div>`;
}

export function donateSection(): string {
  return (
    `<section class="sec sec--donate" id="donate" aria-labelledby="donate-title">` +
    floats("home-donate", { tone: "magenta", count: 2, glyph: "heart" }) +
    `<div class="wrap">` +
    sectionHead({ id: "donate-title", kicker: "donate", title: "Donate", tone: "magenta", icon: "heart", aside: "Ko-fi · MB Bank", more: { href: "/donate/", label: "Donate page" } }) +
    donateBody(3) +
    `</div></section>`
  );
}

export function donatePage(): string {
  return (
    `<div class="page page--donate">` +
    floats("donate", { tone: "magenta", count: 3, glyph: "heart" }) +
    `<div class="wrap">` +
    pageHead({ kicker: "donate", title: "Donate", tone: "magenta", icon: "heart", aside: "Ko-fi · MB Bank" }) +
    donateBody(2) +
    `</div></div>`
  );
}

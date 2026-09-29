// /donate/: Ko-fi, and an MB Bank VietQR whose amount can be prefilled.
//
// Everything is prerendered. Without JS the page shows the Ko-fi link, the
// account-only QR (no amount) and the bank details as selectable text. With
// JS, motion/donate.ts wakes the amount slider and quick picks, which redraw
// the QR live. Styles: styles/donate.css.

import { KOFI_URL } from "../data/nav.ts";
import { QUICK_PICKS, STOPS, TICKS, donateQr, fineText, formatVnd, shortVnd, trackPos } from "../donate.ts";
import { MB_BANK, TRANSFER_NOTE } from "../vietqr.ts";
import { floats } from "./floats.ts";
import { copyButton, icon, pageHead, sticker, tile } from "./glyphs.ts";
import { esc } from "./html.ts";

function kofiCard(): string {
  const stage = [
    sticker("heart", { scale: 6, tilt: -8, className: "kofi__st kofi__st--0" }),
    sticker("coin", { scale: 4, tilt: 10, className: "kofi__st kofi__st--1" }),
    sticker("sparkle", { scale: 3, tilt: 0, className: "kofi__st kofi__st--2" }),
    sticker("star", { scale: 3, tilt: -12, className: "kofi__st kofi__st--3" }),
  ].join("");
  return (
    `<a class="card kofi" href="${KOFI_URL}" rel="noopener" data-reveal>` +
    `<span class="kofi__top">${tile("heart", "magenta", "l")}` +
    `<span class="kofi__text"><span class="kofi__name">Ko-fi</span><span class="kofi__line">ko-fi.com/dexdonation</span></span></span>` +
    `<span class="kofi__stage" aria-hidden="true"><span class="kofi__disc"></span>${stage}</span>` +
    `<span class="btn btn--magenta btn--l kofi__cta"><span class="btn__label">Open Ko-fi</span><span class="btn__ic">${icon("external", 3)}</span></span>` +
    `</a>`
  );
}

function amountPanel(): string {
  const last = STOPS.length - 1;
  const ticks = TICKS.map((t) => `<span style="--at:${trackPos(t).toFixed(4)}">${shortVnd(t)}</span>`).join("");
  const picks = QUICK_PICKS.map(
    (n) => `<button class="pick" type="button" data-pick="${n}" aria-pressed="false" aria-label="${esc(formatVnd(n))}">${shortVnd(n)}</button>`,
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
    `<button class="pick pick--none" type="button" data-pick="0" aria-pressed="true">${icon("close", 2)}<span>Any amount</span></button>` +
    picks +
    `</div>` +
    `</div>`
  );
}

function bankCard(): string {
  return (
    `<section class="card bank" aria-labelledby="bank-title" data-donate data-state="none" data-reveal style="--i:1">` +
    `<h2 class="bank__title" id="bank-title">${tile("bank", "magenta", "s")}<span>MB Bank transfer</span></h2>` +
    `<div class="bank__grid">` +
    `<div class="qr" data-qr><span class="qr__corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>` +
    `<div class="qr__code" data-qr-code>${donateQr(0)}</div>` +
    `<span class="qr__tag" data-qr-tag>Any amount</span></div>` +
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

export function donatePage(): string {
  return (
    `<div class="page">` +
    floats("donate", { tone: "magenta", stickers: ["heart", "coin", "sparkle"] }) +
    `<div class="wrap">` +
    pageHead({ kicker: "donate", title: "Donate", tone: "magenta", aside: "Ko-fi · MB Bank", stickers: ["heart", "coin"] }) +
    `<div class="donate">` +
    kofiCard() +
    bankCard() +
    `</div></div></div>`
  );
}

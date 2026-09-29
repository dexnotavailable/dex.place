// Donation amounts and QR text for the MB Bank card on /donate/. DOM-free, so
// the page prerenders the slider, chips and default QR at build time and the
// browser module (motion/donate.ts) redraws with the same code.
//
// Dex (2026-09-29): by default the QR carries no amount. The slider runs from
// 100,000 to 10,000,000 VND (never 0); moving it prefills that amount. The
// no-amount default is always one press away ("Any amount").
//
// The slider is a native <input type="range"> over stop indexes 0..N-1, so
// arrow keys move exactly one sensible step and every stop is a round number:
//   100,000 to 1,000,000 in 50,000s, then to 5,000,000 in 250,000s,
//   then to 10,000,000 in 500,000s.

import { qrSvg } from "./qr.ts";
import { MAX_VND, MB_BANK, vietQrPayload } from "./vietqr.ts";

export const SLIDER_MIN_VND = 100_000;
export const SLIDER_MAX_VND = MAX_VND; // 10,000,000

const SEGMENTS: readonly { to: number; step: number }[] = [
  { to: 1_000_000, step: 50_000 },
  { to: 5_000_000, step: 250_000 },
  { to: 10_000_000, step: 500_000 },
];

function buildStops(): number[] {
  const out = [SLIDER_MIN_VND];
  let at = SLIDER_MIN_VND;
  for (const { to, step } of SEGMENTS) {
    while (at < to) {
      at += step;
      out.push(at);
    }
  }
  return out;
}

/** Every amount the slider can land on, ascending. */
export const STOPS: readonly number[] = buildStops();

/** Quick picks shown as chips (all are stops). */
export const QUICK_PICKS: readonly number[] = [100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

/** Labels under the slider track. */
export const TICKS: readonly number[] = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000];

/** Amount at a slider index (clamped). */
export function amountAt(index: number): number {
  const i = Math.min(STOPS.length - 1, Math.max(0, Math.round(index)));
  return STOPS[i]!;
}

/** Slider index for an amount: the nearest stop. */
export function indexOf(amount: number): number {
  let best = 0;
  for (let i = 1; i < STOPS.length; i += 1) {
    if (Math.abs(STOPS[i]! - amount) < Math.abs(STOPS[best]! - amount)) best = i;
  }
  return best;
}

/** Position of an amount along the track, 0..1. */
export const trackPos = (amount: number): number => indexOf(amount) / (STOPS.length - 1);

/** "500,000" (grouped digits; the unit is shown separately as VND). */
export const groupVnd = (amount: number): string => new Intl.NumberFormat("en-US").format(amount);

/** "500,000 VND": for labels and screen readers. */
export const formatVnd = (amount: number): string => `${groupVnd(amount)} VND`;

/** Short chip / tick label: 100k, 1M, 2.5M, 10M. */
export function shortVnd(amount: number): string {
  if (amount >= 1_000_000) return `${+(amount / 1_000_000).toFixed(2)}M`;
  return `${+(amount / 1_000).toFixed(1)}k`;
}

/** The QR window's tag with no amount set (the tag shows the amount otherwise). */
export const QR_TAG_NONE = "No amount";

/** Accessible name of the QR. */
export function qrLabel(amount: number): string {
  const what = amount > 0 ? `${formatVnd(amount)} prefilled` : "no amount set";
  return `VietQR code: ${MB_BANK.bank}, account ${MB_BANK.account}, ${MB_BANK.holder}, ${what}`;
}

/** The QR as crisp SVG; 0 = the account-only code. Literal colours so it scans the same everywhere. */
export function donateQr(amount: number): string {
  return qrSvg(vietQrPayload(amount), { dark: "#191919", light: "#ffffff", label: qrLabel(amount) });
}

/** Sentence under the bank card. */
export function fineText(amount: number): string {
  const filled = amount > 0 ? `with ${formatVnd(amount)} filled in` : "with no amount filled in";
  return `Scan it in any Vietnamese banking app. It opens ${filled}; check the recipient name there before you confirm.`;
}

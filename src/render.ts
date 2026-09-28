// Build-time HTML for the downloads list. vite.config.ts injects it into
// index.html, so the shipped page is static and needs no JavaScript.
import { downloads, type Download } from "./downloads.ts";

const UNITS = ["B", "kB", "MB", "GB"] as const;

/** Decimal (SI) size with one decimal place, e.g. 665563123 -> "665.6 MB". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (unit < UNITS.length - 1 && Math.round(value * 10) / 10 >= 1000) {
    value /= 1000;
    unit += 1;
  }
  const amount = unit === 0 ? String(bytes) : value.toFixed(1);
  return `${amount}\u00a0${UNITS[unit]}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderRow(item: Download): string {
  const name = escapeHtml(item.name);
  const href = escapeHtml(item.href);
  return [
    `<li class="row">`,
    `<a class="name" href="${href}" download>${name}</a>`,
    `<span class="meta">`,
    `<span class="size">${formatBytes(item.bytes)}</span>`,
    `<a class="sum" href="${href}.sha256" aria-label="sha256 for ${name}">sha256</a>`,
    `</span>`,
    `</li>`,
  ].join("");
}

export function renderDownloads(): string {
  return downloads.map(renderRow).join("\n          ");
}

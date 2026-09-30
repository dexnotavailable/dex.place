// What can be downloaded. Only real, published files (CANON: don't invent
// binaries). The file itself lives in the host's downloads folder
// (D:\Dex\Servers\dex.place\downloads, see ops/README.md), never in git.
// To publish a new build: copy the setup and its .sha256 sidecar there, then
// update the entry below (version, file name, exact bytes, SHA-256).

import type { IconName } from "../pixels.ts";

export interface DownloadFile {
  /** Site path. The checksum sidecar is served at `${href}.sha256`. */
  readonly href: string;
  readonly version: string;
  /** Exact size in bytes; shown rounded. */
  readonly bytes: number;
  /** Lowercase hex, as in the .sha256 sidecar. */
  readonly sha256: string;
  readonly platform: string;
}

export interface DownloadEntry {
  /** Anchor id on /downloads/ and key into projects. */
  readonly id: string;
  readonly name: string;
  /** The published file, or null when there is no public download. */
  readonly file: DownloadFile | null;
  /** Plain facts shown with the entry (from the project's own docs). */
  readonly notes: readonly string[];
  /** When there is no file: the entry (id) whose download installs this one. */
  readonly installedBy?: string;
  /** Install steps shown under the list, from the project's own docs. */
  readonly steps?: readonly InstallStep[];
  /** One honest caveat shown under the steps. */
  readonly caveat?: string;
}

export interface InstallStep {
  readonly title: string;
  readonly text: string;
  readonly icon: IconName;
}

export const downloads: readonly DownloadEntry[] = [
  {
    id: "dexclient",
    name: "dexClient",
    file: {
      href: "/downloads/dexClient-Setup-0.4.21.exe",
      version: "0.4.21",
      bytes: 102_920_157,
      sha256: "d9a35b2f6da5b9e9fc41decc96c9fd3dc2472087a6a7bba5ee9d74963c4a6530",
      platform: "Windows",
    },
    // dexClient README: per-user installer, no admin prompt, unsigned.
    notes: ["Installs per user, no admin prompt.", "Unsigned for now, so Windows asks once."],
    // Steps and caveat: dexClient docs/TESTERS.md (sections 1-3 and 5) and README.
    steps: [
      { icon: "download", title: "Download", text: "Your browser may ask before keeping it, because the file isn't signed yet. Choose Keep." },
      { icon: "window", title: "Run it", text: "Windows shows “Windows protected your PC”. Click More info, then Run anyway." },
      { icon: "check", title: "Install", text: "It installs for your Windows user only, with no admin prompt, then checks your PC." },
      { icon: "star", title: "Pick and play", text: "Choose what to install. dexClient installs dexCode, opens it and keeps it up to date." },
    ],
    caveat: "If Smart App Control is on (Windows Security, App & browser control), this build can't run until it is signed.",
  },
  {
    id: "dexcode",
    name: "dexCode",
    file: null,
    // dexCode canon: no standalone public download; dexClient installs it.
    notes: ["No standalone download yet. dexClient installs it."],
    installedBy: "dexclient",
  },
];

const UNITS = ["B", "kB", "MB", "GB"] as const;

/** Decimal (SI) size with one decimal place, e.g. 102781000 -> "102.8 MB". */
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

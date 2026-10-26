// What can be downloaded. Only real, published files (CANON: don't invent binaries).
//
// Since 2026-10-26 (Dex, YUKI docs/build/PHASE2-SCOPE.md W12) the one product is YUKI: it replaces dexCode, and
// dexClient (the installer app) is retired. YUKI's installer is not in the host's downloads folder: GitHub Releases
// serves it, from the public releases repo, through its "latest release" address, so the visitor clicks once on
// dex.place and the file comes from GitHub.
//
// To publish a release: fill YUKI_RELEASE below with the release's installer (its asset name, the version, the exact
// size in bytes and the SHA-256, read from the release asset itself). Until then it is null, and every page says
// plainly that there is no public download yet.

import type { IconName } from "../pixels.ts";

/** The public releases repo (installers, update manifests, the model catalogue). */
export const RELEASES_REPO = "https://github.com/dexnotavailable/yuki-releases";

/** The release on the site: fill at release time, all four from the release asset. Null: nothing is out yet. */
export interface YukiRelease {
  /** e.g. "0.2.0". */
  readonly version: string;
  /** The installer's asset name on the release, e.g. "YUKI-Setup-0.2.0.exe". */
  readonly file: string;
  /** Exact size in bytes; shown rounded. */
  readonly bytes: number;
  /** Lowercase hex. */
  readonly sha256: string;
  /** The checksum's own asset on the release (`<file>.sha256`), when the release publishes one. */
  readonly sidecar?: boolean;
}

export const YUKI_RELEASE: YukiRelease | null = null;

/** GitHub's address for an asset of the latest release (it redirects to the file; the page stays on dex.place). */
export const latestAsset = (file: string): string => `${RELEASES_REPO}/releases/latest/download/${encodeURIComponent(file)}`;

export interface DownloadFile {
  /** Where the file is: a site path, or a release asset's address. */
  readonly href: string;
  readonly version: string;
  /** Exact size in bytes; shown rounded. */
  readonly bytes: number;
  /** Lowercase hex. */
  readonly sha256: string;
  readonly platform: string;
  /** The checksum file beside it (`${href}.sha256`), when there is one. */
  readonly sidecar?: string;
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
  /** Its own page with the full install guide (YUKI: /yuki/). */
  readonly guide?: string;
}

export interface InstallStep {
  readonly title: string;
  readonly text: string;
  readonly icon: IconName;
}

/** The release as a download, or null. */
export function releaseFile(r: YukiRelease | null): DownloadFile | null {
  if (!r) return null;
  const href = latestAsset(r.file);
  return { href, version: r.version, bytes: r.bytes, sha256: r.sha256, platform: "Windows", ...(r.sidecar ? { sidecar: `${href}.sha256` } : {}) };
}

/**
 * YUKI's entry for a release (the site's own uses YUKI_RELEASE; tests pass others). Steps and caveat: YUKI's
 * electron-builder.yml (per-user NSIS, no admin prompt, opens when done, unsigned) and the W7 brief.
 */
export function yukiEntry(r: YukiRelease | null): DownloadEntry {
  return {
    id: "yuki",
    name: "YUKI",
    file: releaseFile(r),
    notes: r
      ? ["Installs for your Windows user, no admin prompt.", "Unsigned, so Windows asks once."]
      : ["No public download yet."],
    steps: [
      { icon: "download", title: "Download", text: "Your browser may ask before keeping it, because the file isn't signed. Choose Keep." },
      { icon: "window", title: "Run it", text: "Windows shows “Windows protected your PC”. Click More info, then Run anyway." },
      { icon: "check", title: "Install", text: "It installs for your Windows user only, with no admin prompt, and opens YUKI when it's done." },
      { icon: "blob", title: "Meet Yuki", text: "She reads your PC and picks the setup that fits it. Models download from Hugging Face; each one's licence shows first." },
    ],
    caveat: "If Smart App Control is on (Windows Security, App & browser control), Windows won't run an unsigned installer.",
    guide: "/yuki/",
  };
}

export const downloads: readonly DownloadEntry[] = [yukiEntry(YUKI_RELEASE)];

/** Retired projects: shown only where their entries were, as one small line that points at what replaced them. */
export interface RetiredEntry {
  readonly id: string;
  readonly name: string;
  readonly replacedBy: string;
}

export const RETIRED: readonly RetiredEntry[] = [
  { id: "dexcode", name: "dexCode", replacedBy: "yuki" },
  { id: "dexclient", name: "dexClient", replacedBy: "yuki" },
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
  return `${amount} ${UNITS[unit]}`;
}

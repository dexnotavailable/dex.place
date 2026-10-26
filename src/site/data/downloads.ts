// What can be downloaded. Only real, published files (CANON: don't invent binaries).
//
// Since 2026-10-26 (Dex, YUKI docs/build/PHASE2-SCOPE.md W12) the one product is YUKI: it replaces dexCode, and
// dexClient (the installer app) is retired. YUKI's installer is not in the host's downloads folder: GitHub Releases
// serves it, from the public releases repo, so the visitor clicks once on dex.place and the file comes from GitHub.
//
// To publish a release: fill YUKI_RELEASE below with the release's installer (its asset name, the version, the exact
// size in bytes and the SHA-256, read from the release asset itself). Until then it is null, and every page says
// plainly that there is no public download yet. Refill it with every stable release: the link names the release's own
// tag, so it always serves the file whose size and SHA-256 the page lists (a "latest" link to a versioned file name
// breaks on the next release, and one to a fixed name would serve a newer file than the listed hash). A copy installed
// from an older release updates itself, so a late refill costs nobody the newest version.
//
// At a release, in one commit (YUKI's packages/desktop/scripts/publish.ts tags it v<version> and uploads
// YUKI-Setup-<version>.exe, its .blockmap and latest.yml; no .sha256 file, so `sidecar` and `tag` stay unset):
//   1. YUKI_RELEASE = { version: "0.2.0", file: "YUKI-Setup-0.2.0.exe", bytes: <exact size>, sha256: "<64 lowercase
//      hex>" }, read from the published asset: `gh release view v0.2.0 --repo dexnotavailable/yuki-releases --json
//      assets` gives its name, size and digest ("sha256:..."); publish.ts also writes the SHA-256 into
//      release/submit-to-microsoft-<version>.txt. Check the link: releaseAsset() must answer (a 302 to GitHub's file).
//   2. data/yuki.ts YUKI_TIERS_LIVE = true, once YUKI_TIERS and YUKI_FACTS read true against that build's
//      engine/src/catalogue/hardware.ts and brains.ts (the brain that fits is p2/small-brain's).
//   3. content/docs/yuki.md and installing-yuki.md: drop the lines that say the first release isn't out yet
//      (build/downloads.test.mjs fails while they remain).
//   4. npm test, npm run build, then look at /yuki/, /downloads/ and the home page at 1440 and 390 wide.

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
  /** The release's tag, when it isn't `v<version>` (YUKI's scripts/publish.ts tags `v${version}`). */
  readonly tag?: string;
}

export const YUKI_RELEASE: YukiRelease | null = null;

/** GitHub's address for the release's installer (it redirects to the file; the page stays on dex.place). */
export const releaseAsset = (r: Pick<YukiRelease, "version" | "file" | "tag">): string =>
  `${RELEASES_REPO}/releases/download/${encodeURIComponent(r.tag ?? `v${r.version}`)}/${encodeURIComponent(r.file)}`;

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
  /** Before its file is out: what the installer will do (true of the build that ships), listed where the file's notes
   *  go, so the block keeps its shape and height. */
  readonly installer?: readonly string[];
}

export interface InstallStep {
  readonly title: string;
  readonly text: string;
  readonly icon: IconName;
  /** Where it differs by browser: one short line each, shown under the text. */
  readonly ways?: readonly { readonly who: string; readonly how: string }[];
}

/** The release as a download, or null. */
export function releaseFile(r: YukiRelease | null): DownloadFile | null {
  if (!r) return null;
  const href = releaseAsset(r);
  return { href, version: r.version, bytes: r.bytes, sha256: r.sha256, platform: "Windows", ...(r.sidecar ? { sidecar: `${href}.sha256` } : {}) };
}

/**
 * YUKI's entry for a release (the site's own uses YUKI_RELEASE; tests pass others). Steps and caveat: YUKI's
 * electron-builder.yml (a one-click per-user NSIS installer: no wizard, no admin prompt, opens YUKI when done;
 * unsigned); the browsers' words from the tested content/docs/installing-dexclient.md (an unsigned setup gets the same
 * warnings); step 4 from the W7 first run on the YUKI main line (desktop renderer firstrun/FirstRun.tsx: the hatch, the
 * stat sheet, the setup that fits, nothing downloaded before the user picks a setup and accepts its licences).
 */
export function yukiEntry(r: YukiRelease | null): DownloadEntry {
  const installer = ["Installs for your Windows user, no admin prompt.", "Unsigned, so Windows asks once."];
  return {
    id: "yuki",
    name: "YUKI",
    file: releaseFile(r),
    notes: r ? installer : ["No public download yet."],
    ...(r ? {} : { installer }),
    steps: [
      {
        icon: "download", title: "Download", text: "Your browser may hold it back at first, because the file isn't signed.",
        ways: [
          { who: "Chrome", how: "Click “Suspicious download blocked”, then Download suspicious file." },
          { who: "Edge", how: "Click … on the file, then Keep, Show more, Keep anyway." },
          { who: "Firefox", how: "Open the downloads list and choose Allow download." },
        ],
      },
      { icon: "window", title: "Run it", text: "Windows shows “Windows protected your PC”. Click More info, then Run anyway." },
      { icon: "check", title: "Install", text: "It installs for your Windows user only, with no admin prompt, and opens YUKI when it's done." },
      { icon: "blob", title: "Meet Yuki", text: "She hatches, looks over your PC and offers the setup that fits it. Nothing downloads before you accept its licences." },
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

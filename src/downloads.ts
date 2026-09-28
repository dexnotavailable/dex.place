export interface Download {
  /** Visible label. */
  name: string;
  /** Site path of the file. Its checksum sidecar is served at `${href}.sha256`. */
  href: string;
  /** Exact size in bytes; shown rounded. */
  bytes: number;
}

export const downloads: readonly Download[] = [
  {
    name: "dexClient",
    href: "/downloads/dexClient-Setup-0.1.0.exe",
    bytes: 665_563_123,
  },
  {
    name: "dexSMP Fabric friend installer",
    href: "/downloads/dexSMP-Fabric-26.1.2-Friend-Installer.zip",
    bytes: 994_485,
  },
  {
    name: "Hoshikawa Haven brand pack",
    href: "/downloads/Hoshikawa-Haven-Brand-v1.zip",
    bytes: 43_157,
  },
];

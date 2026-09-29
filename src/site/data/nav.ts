// Site navigation, in the order of Dex's brief (landing, downloads, gallery,
// docs and blog, donate). CANON's wayfinding priority (downloads, donate,
// illustrations, documentation) is an open question; reorder here.

import type { IconName } from "../pixels.ts";
import type { Tone } from "./projects.ts";

export interface NavItem {
  readonly id: "downloads" | "gallery" | "docs" | "blog" | "donate";
  readonly label: string;
  readonly href: string;
  readonly icon: IconName;
  /** Section accent (VISUAL-RESEARCH §3: one lead accent per section). */
  readonly tone: Tone;
}

export const NAV: readonly NavItem[] = [
  { id: "downloads", label: "Downloads", href: "/downloads/", icon: "download", tone: "mint" },
  { id: "gallery", label: "Gallery", href: "/gallery/", icon: "frame", tone: "paper" },
  { id: "docs", label: "Docs", href: "/docs/", icon: "book", tone: "yellow" },
  { id: "blog", label: "Blog", href: "/blog/", icon: "page", tone: "cyan" },
  { id: "donate", label: "Donate", href: "/donate/", icon: "heart", tone: "magenta" },
];

export const KOFI_URL = "https://ko-fi.com/dexdonation";

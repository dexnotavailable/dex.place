// Site navigation. The home page is one continuous scroll with every section
// in this order (Dex, 2026-09-29: projects -> downloads -> gallery -> docs &
// blog -> donate); the nav jumps to each section and highlights the one being
// read (motion/nav.ts), but scrolling is the main path. Each section also
// keeps its own full page at `page` for deep links and no-JS readers.
// CANON's wayfinding priority (downloads, donate, illustrations,
// documentation) is still open; reorder here.

import type { IconName } from "../pixels.ts";
import type { Tone } from "./projects.ts";

export type SectionId = "projects" | "downloads" | "gallery" | "docs" | "blog" | "donate";

export interface NavItem {
  readonly id: SectionId;
  readonly label: string;
  /** Anchor of the section on the home page. */
  readonly anchor: `#${SectionId}`;
  /** Its own full page (deep links, no JS). */
  readonly page: string;
  readonly icon: IconName;
  /** Section accent (one lead accent per section). */
  readonly tone: Tone;
}

export const NAV: readonly NavItem[] = [
  { id: "projects", label: "Projects", anchor: "#projects", page: "/projects/", icon: "grid", tone: "yellow" },
  { id: "downloads", label: "Downloads", anchor: "#downloads", page: "/downloads/", icon: "download", tone: "mint" },
  { id: "gallery", label: "Gallery", anchor: "#gallery", page: "/gallery/", icon: "frame", tone: "yellow" },
  { id: "docs", label: "Docs", anchor: "#docs", page: "/docs/", icon: "book", tone: "cyan" },
  { id: "blog", label: "Blog", anchor: "#blog", page: "/blog/", icon: "page", tone: "cyan" },
  { id: "donate", label: "Donate", anchor: "#donate", page: "/donate/", icon: "heart", tone: "magenta" },
];

/** Where a nav item points: the anchor on the home page, or home + anchor elsewhere. */
export const navHref = (item: NavItem, onHome: boolean): string => (onHome ? item.anchor : `/${item.anchor}`);

export const KOFI_URL = "https://ko-fi.com/dexdonation";

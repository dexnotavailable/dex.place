// Documentation groups, in the landing's project order, the retired projects last. A doc joins a group
// with `group: <id>` in its frontmatter (content/README.md); the build fails on
// an unknown id so a typo never hides a page. Tones match each project's card.

import type { IconName } from "../pixels.ts";
import type { Tone } from "./projects.ts";

export interface DocGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly tone: Tone;
  /** A retired project (Dex 10-26: YUKI replaces dexCode and dexClient): its docs stay for people who have it, last,
   *  tagged "Retired". */
  readonly retired?: true;
}

export const DOC_GROUPS: readonly DocGroup[] = [
  { id: "yuki", label: "YUKI", icon: "sparkle", tone: "cyan" },
  { id: "dex-place", label: "dex.place", icon: "grid", tone: "magenta" },
  { id: "dexcode", label: "dexCode", icon: "window", tone: "yellow", retired: true },
  { id: "dexclient", label: "dexClient", icon: "download", tone: "mint", retired: true },
];

/**
 * Docs that are gone, and where their readers go now (Dex 10-26: YUKI replaces dexCode, and dexClient is retired; the
 * YUKI docs replace theirs). Their old addresses stay as small retired pages (noindex), as the retired projects' do.
 */
export interface RetiredDoc {
  readonly slug: string;
  readonly title: string;
  /** The project it documented, as the retired line names it. */
  readonly project: string;
  /** The doc that replaces it. */
  readonly to: string;
}

export const RETIRED_DOCS: readonly RetiredDoc[] = [
  { slug: "dexcode", title: "dexCode overview", project: "dexCode", to: "yuki" },
  { slug: "installing-dexclient", title: "Installing dexClient", project: "dexClient", to: "installing-yuki" },
];

/** Docs without a `group` land here, after the named groups. */
export const OTHER_GROUP: DocGroup = { id: "other", label: "Other", icon: "page", tone: "cyan" };

export function docGroup(id: string | null): DocGroup {
  return DOC_GROUPS.find((g) => g.id === id) ?? OTHER_GROUP;
}

/** Sort position of a group id (unknown and null last). */
export function groupRank(id: string | null): number {
  const at = DOC_GROUPS.findIndex((g) => g.id === id);
  return at < 0 ? DOC_GROUPS.length : at;
}

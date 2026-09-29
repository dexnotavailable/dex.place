// Documentation groups, in the landing's project order. A doc joins a group
// with `group: <id>` in its frontmatter (content/README.md); the build fails on
// an unknown id so a typo never hides a page. Tones match each project's card.

import type { IconName } from "../pixels.ts";
import type { Tone } from "./projects.ts";

export interface DocGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly tone: Tone;
}

export const DOC_GROUPS: readonly DocGroup[] = [
  { id: "dexcode", label: "dexCode", icon: "window", tone: "yellow" },
  { id: "dexclient", label: "dexClient", icon: "download", tone: "mint" },
  { id: "dex-place", label: "dex.place", icon: "grid", tone: "magenta" },
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

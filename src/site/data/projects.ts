// Projects on the landing and their pages (/projects/<id>/), in Dex's order.
// Every line and fact comes from the project's own docs (read-only sources,
// nothing invented; wording shortened, never extended):
//   dexCode   D:\Dex\Temp\dexcode-tool-runtime-parity-20260830\docs\product-canon.md §2, §4
//   dexClient D:\Dex\Projects\dexClient\README.md ("dexClient is...", "Run it", "Where things go")
//   dex.place CANON.md ("What it is for", "Shape")
// Download state is not repeated here: it is read from data/downloads.ts, so a
// new build only needs updating in one place.
// Imagery is a placeholder scene drawn in code (render/art.ts), flagged with
// `placeholder: true` so it is easy to find and replace. Never Dex's art here.

import type { IconName } from "../pixels.ts";

export type Tone = "yellow" | "mint" | "magenta" | "cyan" | "ink" | "paper";

export interface ProjectFact {
  readonly icon: IconName;
  readonly text: string;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  /** One factual line (landing card, project page, downloads page). */
  readonly line: string;
  /** Platform chip. */
  readonly platform: string;
  /** Short facts for the project page. Keep to what the source docs say. */
  readonly facts: readonly ProjectFact[];
  /** The project's doc on this site. */
  readonly docs: { readonly href: string; readonly label: string };
  readonly tone: Tone;
  /** Which code-drawn placeholder scene to show (render/art.ts). */
  readonly art: "terminal" | "installer" | "site";
  readonly placeholder: true;
}

export const projectHref = (p: Project): string => `/projects/${p.id}/`;

export const projects: readonly Project[] = [
  {
    id: "dexcode",
    name: "dexCode",
    line: "A Windows app that runs an AI agent on your own PC.",
    platform: "Windows",
    facts: [
      { icon: "window", text: "The agent edits files, runs commands, browses the web and controls the PC." },
      { icon: "grid", text: "The chat model runs locally through llama.cpp; image and video models run through ComfyUI." },
      { icon: "blob", text: "Yuki is its companion, in one continuous thread." },
    ],
    docs: { href: "/docs/dexcode/", label: "dexCode docs" },
    tone: "yellow",
    art: "terminal",
    placeholder: true,
  },
  {
    id: "dexclient",
    name: "dexClient",
    line: "The launcher and installer for dexCode.",
    platform: "Windows",
    facts: [
      { icon: "download", text: "One setup file. It checks your PC, asks what you want, installs dexCode and opens it." },
      { icon: "up", text: "It keeps dexCode up to date and repairs it when something breaks." },
      { icon: "external", text: "Models download from where their makers publish them, such as Hugging Face." },
    ],
    docs: { href: "/docs/installing-dexclient/", label: "Installing dexClient" },
    tone: "mint",
    art: "installer",
    placeholder: true,
  },
  {
    id: "dex-place",
    name: "dex.place",
    line: "This site: downloads, docs, the gallery and donations.",
    platform: "Web",
    facts: [
      { icon: "grid", text: "A 2D pixel world on top, and this website underneath." },
      { icon: "download", text: "Every file is reachable directly, with no game and no sign-in in the way." },
    ],
    docs: { href: "/docs/about-dex-place/", label: "About dex.place" },
    tone: "magenta",
    art: "site",
    placeholder: true,
  },
];

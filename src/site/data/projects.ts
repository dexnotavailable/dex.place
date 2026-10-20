// Projects on the landing and their pages (/projects/<id>/), in Dex's order.
// Every line and fact comes from the project's own docs (read-only sources,
// nothing invented; wording shortened, never extended):
//   dexCode   D:\Dex\Temp\dexcode-tool-runtime-parity-20260830\docs\product-canon.md §2, §4
//   dexClient D:\Dex\Projects\dexClient\README.md ("dexClient is...", "Run it", "Where things go")
//   dex.place CANON.md ("What it is for", "Shape")
// Download state is not repeated here: it is read from data/downloads.ts, so a
// new build only needs updating in one place.
// Imagery: each project's card art (Dex 10-19: splash art filling the whole card): Yuki for dexCode, Bao for dexClient,
// Zhusha for dex.place. Since 10-20 the pictures Dex picked (GPT Image 2.5, AI-generated), each as a one-layer rig in
// public/site/cards/<id>/ (art.webp + rig.json, lanes\cards\tools\picks_rig.py). The old stand-ins' plain layers
// (0..2.png) stay as the fallback the build uses only if a rig cannot be read. Never Dex's own art here.

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
  /** The hero accent of its card (lane K, DESIGN-1019 5.2): Yuki cyan, Bao gold, Zhusha sakura. Existing tokens. */
  readonly tone: Tone;
  /** The character on its card (Dex: dexCode = Yuki, dexClient = Bao, dex.place = Zhusha). */
  readonly hero: string;
  /** The card art (render/cardart.ts): its size in art px and how many layers, back first. */
  readonly art: CardArt;
}

export interface CardArt {
  readonly w: number;
  readonly h: number;
  readonly layers: number;
  /** Still the stand-in, until the card-art lane's splash art replaces it. */
  readonly standin: boolean;
  /** What the picture shows, for the pages that present it as a picture (the project page); on the card it is
   *  decorative (the card's name says what it is). */
  readonly alt?: string;
  /** Where the picture comes from. */
  readonly credit?: string;
  /** A rig is in (rig.json + one webp per part, lanes\motion\NOTEBOOK.md ASKS 00): the card plays it. Until lane H's
   *  art lands, the stand-ins are rigs too (lanes\cards\tools\standin_rig.py cuts the plain layers into parts). */
  readonly rig?: boolean;
}

const STANDIN: CardArt = { w: 160, h: 240, layers: 3, standin: true };
const PICKED = "AI-generated illustration (GPT Image 2.5), picked by Dex";

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
    tone: "cyan",
    hero: "Yuki",
    art: {
      ...STANDIN, standin: false, rig: true, credit: PICKED,
      alt: "Yuki, dexCode's companion: a white-haired woman in a fur-trimmed white hooded cloak, holding a book of ice, ice shards around her.",
    },
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
    tone: "yellow",
    hero: "Bao",
    art: {
      ...STANDIN, standin: false, rig: true, credit: PICKED,
      alt: "Bao, dexClient's character: a masked figure in a wide black hat and a high-collared black coat, a red-tasselled sword and a bell, golden light behind.",
    },
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
    hero: "Zhusha",
    art: {
      ...STANDIN, standin: false, rig: true, credit: PICKED,
      alt: "Zhusha, dex.place's character: a black-haired woman in red and black with a talisman hat, swinging a glowing sword over a karst river at sunset.",
    },
  },
];

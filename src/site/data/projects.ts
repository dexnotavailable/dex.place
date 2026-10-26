// Projects on the landing and their pages, in Dex's order. Every line and fact comes from the project's own docs
// (read-only sources, nothing invented; wording shortened, never extended):
//   YUKI      YUKI README.md and docs/DECISIONS.md (the private repo dexnotavailable/yuki), through data/yuki.ts
//   dex.place CANON.md ("What it is for", "Shape")
// Dex 2026-10-26 (YUKI docs/build/PHASE2-SCOPE.md W12): YUKI is the big one and the dex.place world sits smaller below
// it. YUKI replaces dexCode, and dexClient (the installer app) is retired (data/downloads.ts RETIRED).
// Download state is not repeated here: it is read from data/downloads.ts, so a new build only needs updating in one
// place.
// Imagery: dex.place keeps its card art (Dex 10-19: splash art filling the whole card, Zhusha; since 10-20 the picture
// Dex picked (GPT Image 2.5, AI-generated) as a one-layer rig in public/site/cards/<id>/, art.webp + rig.json; Dex
// 10-22: his own drawings layered around it on its banner, render/pbanner.ts). YUKI's art is made with code (Dex 10-26:
// "materials are made with code", no image generation): pixel Yuki (yuki-sprite.ts) in a code-drawn snowy night
// (render/yukiart.ts).

import type { IconName } from "../pixels.ts";
import { YUKI_FACTS, YUKI_LINE } from "./yuki.ts";

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
  /** The project's doc on this site (or its own install guide). */
  readonly docs: { readonly href: string; readonly label: string };
  /** The hero accent of its card (lane K, DESIGN-1019 5.2): Yuki cyan, Zhusha sakura. Existing tokens. */
  readonly tone: Tone;
  /** The character on its card (Dex: YUKI = Yuki, dex.place = Zhusha). */
  readonly hero: string;
  /** The card art (render/cardart.ts): its size in art px and how many layers, back first. */
  readonly art: CardArt;
  /** Its own page outside /projects/ (YUKI: /yuki/, Dex 10-26), in place of /projects/<id>/. */
  readonly page?: string;
  /** Its weight in the list (Dex 10-26): the lead banner, or a smaller one below it. */
  readonly size?: "lead" | "minor";
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
  /** Art made with code instead of files (render/yukiart.ts): no rig, nothing on disk. */
  readonly code?: "yuki";
}

const STANDIN: CardArt = { w: 160, h: 240, layers: 3, standin: true };
const PICKED = "AI-generated illustration (GPT Image 2.5), picked by Dex";

export const projectHref = (p: Project): string => p.page ?? `/projects/${p.id}/`;

export const projects: readonly Project[] = [
  {
    id: "yuki",
    name: "YUKI",
    line: YUKI_LINE,
    platform: "Windows",
    facts: YUKI_FACTS.map((f) => ({ icon: f.icon, text: f.text })),
    docs: { href: "/yuki/#install", label: "Install guide" },
    tone: "cyan",
    hero: "Yuki",
    art: {
      w: 160, h: 240, layers: 0, standin: false, code: "yuki", credit: "Pixel art drawn in code",
      alt: "Yuki, YUKI's face, in pixel art: a girl with white hair, blue eyes and a red hairpin, in a white cloak with a fur collar, snow falling around her.",
    },
    page: "/yuki/",
    size: "lead",
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
    size: "minor",
  },
];

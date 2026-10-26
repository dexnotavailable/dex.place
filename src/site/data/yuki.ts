// YUKI's page (/yuki/): what it is, which PC gets which setup, and the optional live link. Every line comes from
// YUKI's own docs (the private repo dexnotavailable/yuki; wording shortened, never extended):
//   what it is   README.md (first paragraph, "Principles"), docs/DECISIONS.md 2026-10-22 "Tiers and the swarm"
//   tiers        docs/DECISIONS.md 2026-10-22 "Strata's reach", "Engines per machine", "Tiers and the swarm" (in plain
//                words for visitors: the engines' names, Strata, llama.cpp and Vulkan, stay in the docs)
//   first run    docs/build/PHASE2-SCOPE.md W7 (reads the PC, picks the setup; models from Hugging Face, licence first)
// The release itself (version, file, size, SHA-256) is data/downloads.ts YUKI_RELEASE: one place to fill.

import type { IconName } from "../pixels.ts";

export const YUKI_LINE = "A local AI agent for your own PC.";

export interface YukiFact {
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
}

export const YUKI_FACTS: readonly YukiFact[] = [
  { icon: "window", title: "Any task on your PC", text: "Files, the shell, the browser and your logins, desktop apps, games, and other AI models. Even the roundabout jobs." },
  { icon: "sparkle", title: "Models are tools", text: "Her brain can call an image, video or language model with its own settings, take what it makes, and keep working." },
  { icon: "blob", title: "Yuki never goes busy", text: "You talk to Yuki. She hands the work to her helper agents and keeps talking with you while they run." },
  { icon: "heart", title: "Your machine, your data", text: "It runs on your own PC and keeps your chats there. Models run as they ship: YUKI adds no filters of its own." },
];

/** A class of PC and the setup YUKI picks for it. `rank` is the badge on its card (the first run's stat sheet). */
export interface YukiTier {
  readonly rank: "S" | "A" | "B" | "C";
  readonly name: string;
  /** The machine, in plain words. */
  readonly pc: string;
  /** What YUKI runs there. */
  readonly gets: string;
  readonly tone: "cyan" | "mint" | "yellow" | "magenta";
}

export const YUKI_TIERS: readonly YukiTier[] = [
  {
    rank: "S", name: "Big rig", tone: "magenta",
    pc: "A 24 GB NVIDIA or AMD card and 64 GB of RAM or more.",
    gets: "The biggest brain YUKI runs, and the longest memory the machine can hold. Images and video take turns on the card.",
  },
  {
    rank: "A", name: "Gaming PC", tone: "cyan",
    pc: "An NVIDIA or AMD card with 12 GB or more, and 32 GB of RAM.",
    gets: "A full local brain on YUKI's fastest engine. One model plays every role.",
  },
  {
    rank: "B", name: "16 GB of RAM", tone: "mint",
    pc: "Say an RTX 3060 12 GB with 16 GB of RAM: many people's PC.",
    gets: "A smaller brain that still runs well. A setup YUKI is built for, not a cut-down mode.",
  },
  {
    rank: "C", name: "Laptops and small machines", tone: "yellow",
    pc: "Intel or AMD integrated graphics, smaller cards, or no graphics card.",
    gets: "A small brain that runs on the graphics chip or the processor. Heavy image and video work isn't for this machine.",
  },
];

/** Under the tiers. */
export const YUKI_TIERS_NOTE = "YUKI reads your PC on its first run and picks the setup itself. Windows 10 or 11, 64-bit.";

/**
 * The live link (Dex 10-26: "optional live link where YUKI answers a status ping from the dex.place origin only"):
 * after the Download click, the page asks YUKI's engine on this PC how its first run is going and greets when it
 * is ready. Off until the engine answers dex.place: its /health route needs CORS for https://dex.place and the
 * private-network preflight (Access-Control-Allow-Private-Network), and browsers may ask the visitor first. While
 * `enabled` is false the page carries no link markup and never sends a request.
 */
export const YUKI_LINK = {
  enabled: false,
  /** The engine's address on the visitor's own PC (YUKI packages/engine: 127.0.0.1, port 47800 first). */
  base: "http://127.0.0.1:47800",
  /** Its unauthenticated health route: { ok, engineVersion } today; `stage` / `progress` once first-run reports them. */
  path: "/health",
  /** How often to ask, and when to stop asking. */
  everyMs: 4000,
  giveUpMs: 20 * 60 * 1000,
} as const;

export type YukiLinkState =
  | { readonly kind: "none" }
  | { readonly kind: "setup"; readonly progress: number | null; readonly version: string | null }
  | { readonly kind: "ready"; readonly version: string | null };

/** Reads the engine's answer. Tolerant: anything it doesn't recognise is "none" (the page then keeps waiting). */
export function readLinkStatus(body: unknown): YukiLinkState {
  if (!body || typeof body !== "object") return { kind: "none" };
  const b = body as Record<string, unknown>;
  if (b["ok"] !== true) return { kind: "none" };
  const version = typeof b["engineVersion"] === "string" ? (b["engineVersion"] as string).slice(0, 32) : null;
  const stage = b["stage"];
  if (stage === "setup" || stage === "downloading") {
    const p = typeof b["progress"] === "number" && Number.isFinite(b["progress"]) ? Math.max(0, Math.min(1, b["progress"] as number)) : null;
    return { kind: "setup", progress: p, version };
  }
  return { kind: "ready", version };
}

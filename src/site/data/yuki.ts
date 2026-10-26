// YUKI's page (/yuki/): what it is, which PC gets which setup, and the optional live link. Every line comes from
// YUKI's own docs and code (the private repo dexnotavailable/yuki; wording shortened, never extended):
//   what it is   README.md (first paragraph, "Principles"), docs/DECISIONS.md 2026-10-22 "Tiers and the swarm"
//   tiers        packages/engine/src/catalogue/hardware.ts TIER_RULES and its reasons (W7, branch p2/w7-releases,
//                10-26), in plain words for visitors; the engines' names stay in the docs. They are the W7 first run's,
//                which comes after the first release (PHASE2-SCOPE "Order" 3 and 4), so they stay off the page until a
//                release has that first run (YUKI_TIERS_LIVE).
//   needs        packages/desktop/electron-builder.yml (an x64 NSIS installer; Electron runs on Windows 10 and 11)
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

/** A class of PC and the setup YUKI's first run picks for it. `rank` is the badge on its card (the app's stat sheet). */
export interface YukiTier {
  readonly rank: "S" | "A" | "B" | "C" | "D";
  readonly name: string;
  /** The machine, in plain words. */
  readonly pc: string;
  /** What YUKI runs there. */
  readonly gets: string;
  readonly tone: "cyan" | "mint" | "yellow" | "magenta" | "paper";
}

/** The app's own tiers (hardware.ts TIER_RULES: the best NVIDIA card's memory, then RAM; only NVIDIA counts for now). */
export const YUKI_TIERS: readonly YukiTier[] = [
  {
    rank: "S", name: "Big rig", tone: "magenta",
    pc: "An NVIDIA card with 24 GB of graphics memory, and 64 GB of RAM.",
    gets: "Everything runs here: the big brain, pictures, video and music.",
  },
  {
    rank: "A", name: "Big card", tone: "cyan",
    pc: "An NVIDIA card with 20 GB or more, and 32 GB of RAM.",
    gets: "A smaller brain, pictures and video, all on this PC.",
  },
  {
    rank: "B", name: "Gaming PC", tone: "mint",
    pc: "An NVIDIA card with 12 GB or more, like an RTX 3060 12 GB.",
    gets: "Pictures are made here. The brain runs on a free cloud model.",
  },
  {
    rank: "C", name: "Smaller card", tone: "yellow",
    pc: "An NVIDIA card with 8 GB or more.",
    gets: "Pictures are made here, a little slower. The brain runs on a free cloud model.",
  },
  {
    rank: "D", name: "Any other PC", tone: "paper",
    pc: "AMD or Intel graphics, a smaller card, or none.",
    gets: "The brain runs on a free cloud model.",
  },
];

/** Under the tiers. */
export const YUKI_TIERS_NOTE = "YUKI checks your PC on its first run and sets up for its tier. For now only NVIDIA cards run models on the PC itself.";

/**
 * The tiers are on the page only once a release has the first run that picks them (PHASE2-SCOPE W7 "first run", wave
 * 2, after v0.2). Turn on with that release, after checking YUKI_TIERS and the note against its hardware.ts.
 */
export const YUKI_TIERS_LIVE = false;

/** What the installer needs, on the page whatever the tiers say. */
export const YUKI_NEEDS = "For Windows 10 or 11, 64-bit.";

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

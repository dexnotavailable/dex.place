// YUKI's page (/yuki/): what it is, which PC gets which setup, and the optional live link. Every line comes from
// YUKI's own docs and code (the private repo dexnotavailable/yuki; wording shortened, never extended):
//   what it is   README.md (first paragraph, "Principles"), docs/DECISIONS.md 2026-10-22 "Tiers and the swarm"
//   v0.2's extras the YUKI main line (codex/phase1-finish-20261023, 10-27): the hand and the deck (p2/w6a-picker),
//                the free radar (engine/src/routing/radar.ts), dex inference (engine/src/dex; the pool shut until Dex
//                opens it, friends first: packages/cloud README); a brain that fits (p2/small-brain, 10-27:
//                engine/src/catalogue/brains.ts adviseBrain and the catalogue's brain.small entries)
//   tiers        packages/engine/src/catalogue/hardware.ts TIER_RULES with brains.ts's words (p2/small-brain, 10-27), in
//                plain words for visitors; the engines' names stay in the docs. On the page with the release that has
//                that first run (YUKI_TIERS_LIVE).
//   needs        packages/desktop/electron-builder.yml (an x64 NSIS installer; Electron runs on Windows 10 and 11)
// The release itself (version, file, size, SHA-256) is data/downloads.ts YUKI_RELEASE: one place to fill.

import type { IconName } from "../pixels.ts";

export const YUKI_LINE = "A local AI agent for your own PC.";

export interface YukiFact {
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
}

/**
 * The hand and the deck (YUKI PHASE2-SCOPE W6 "The hand", Dex 10-26): on the YUKI main line since 10-27 (merge 78dc72e,
 * p2/w6a-picker), so in v0.2 (Dex 10-26: mention them only as far as v0.2 really ships them).
 */
export const YUKI_HAND_LIVE = true;

/** The hand and the deck, among what she does (after "Models are tools") once YUKI_HAND_LIVE. */
export const YUKI_HAND: YukiFact = {
  icon: "cards", title: "A hand of models",
  text: "Every model YUKI can reach is a card in your deck. The cards in your hand are the ones Yuki and her helpers use.",
};

export const YUKI_FACTS: readonly YukiFact[] = [
  { icon: "window", title: "Any task on your PC", text: "Files, the shell, the browser and your logins, desktop apps, games, and other AI models. Even the roundabout jobs." },
  { icon: "sparkle", title: "Models are tools", text: "Her brain can call an image, video or language model with its own settings, take what it makes, and keep working." },
  // (routing/radar.ts: stealth models, free sources not added yet, free models new this week; one offer a day at most,
  // never in a chat, a Settings switch; provider.add: a key's cards come free first)
  { icon: "rss", title: "A free radar", text: "YUKI keeps a list of free AI sources and spots new free models, with one tip a day at most. Paste a key and its models join your deck, free ones first." },
  // (brains.ts adviseBrain: the best catalogue brain that fits the PC's NVIDIA card and RAM, a new brain being one
  // catalogue entry; brain.small, Huihui Qwen3 30B-A3B, down to 6 GB cards with 16 GB of RAM; none fits: a free cloud
  // brain)
  { icon: "grid", title: "A brain that fits", text: "First run offers the best brain in YUKI's catalogue that fits your PC, down to a small one for a 6 GB NVIDIA card with 16 GB of RAM. Where none fits, the brain runs on a free cloud model." },
  { icon: "blob", title: "Yuki never goes busy", text: "You talk to Yuki. She hands the work to her helper agents and keeps talking with you while they run." },
  // (Dex 10-26: routing can send a chat to a free or API cloud model, so the chats stay on the PC unless you pick one)
  { icon: "heart", title: "Your machine, your data", text: "It runs on your own PC, and your chats stay there unless you pick a cloud model. Models run as they ship: YUKI adds no filters of its own." },
  // dex inference as v0.2 has it (YUKI engine/src/dex, routing catalog "dex": a chat model source, text only, no tools or
  // pictures; hosting is a switch, each host approved by Dex; the pool opens invite-only to friends first, PHASE2-SCOPE
  // "Order" 5). Its usage policy applies there only, never on the user's own PC.
  { icon: "hosts", title: "dex inference", text: "Optional: sign in with a dex account to chat on models that run on PCs the community hosts, or to host from yours. Invite-only for now, friends first." },
];

/** What she does, as the page lists it: the hand and the deck after "Models are tools" while YUKI_HAND_LIVE. */
export const yukiFacts = (hand: boolean = YUKI_HAND_LIVE): readonly YukiFact[] =>
  hand ? [...YUKI_FACTS.slice(0, 2), YUKI_HAND, ...YUKI_FACTS.slice(2)] : YUKI_FACTS;

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
    gets: "Pictures are made here, and a small brain too when there's RAM for it. If not, the brain runs on a free cloud model.",
  },
  {
    rank: "C", name: "Smaller card", tone: "yellow",
    pc: "An NVIDIA card with 8 GB or more.",
    gets: "Pictures are made here, a little slower, and a small brain when there's RAM for it. If not, the brain runs on a free cloud model.",
  },
  {
    rank: "D", name: "Any other PC", tone: "paper",
    pc: "AMD or Intel graphics, a smaller card, or none.",
    gets: "A small brain on a 6 GB NVIDIA card with 16 GB of RAM. If not, the brain runs on a free cloud model.",
  },
];

/** Under the tiers. */
export const YUKI_TIERS_NOTE = "YUKI checks your PC on its first run and offers the setup that fits it. For now only NVIDIA cards run models on the PC itself.";

/**
 * The tiers are on the page only once a release has the first run that picks them (PHASE2-SCOPE W7 "first run", on the
 * YUKI main line since 10-27, and p2/small-brain's brains). Turn on with that release, after checking YUKI_TIERS and the
 * note against its hardware.ts and brains.ts.
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

// The env-sky proof page (dev server only, not a site page): the builder's real /tesu/
// world with the env-sky set composited in. ?orig shows the builder's world unchanged
// through the same page, for before and after. Plates paint on the main thread here
// (?sync), because the plate workers build their own copy of the world.

import "../index.ts";
import { buildWorld } from "../../../../world/index.ts";
import { applySkyProof } from "./apply.ts";
import { KEYS } from "../keys.ts";

const q = new URLSearchParams(location.search);
if (!q.has("sync") && !q.has("manual")) {
  q.set("sync", "");
  history.replaceState(null, "", `${location.pathname}?${q.toString().replace(/=(&|$)/g, "$1")}`);
}
if (!q.has("orig")) applySkyProof(buildWorld(), KEYS[(q.get("key") ?? "morning") as keyof typeof KEYS] ?? KEYS.morning);
await import("../../../../main.ts");

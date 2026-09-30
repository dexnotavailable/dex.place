---
name: dex-place-codex-coordination
description: How Claude works on dex.place alongside Codex's parallel dex.place goal (shared gate, worktrees, coordination note, publishing)
metadata:
  type: project
---

Since 2026-09-30, Codex also runs a dex.place goal: a website, World, Rosace and pipeline chat, plus stage chats. Its plan and state live in `D:\Dex\Automation\reports\dex-suite-resumption-20260930\` (DEXPLACE-GOAL-20260930.md, STAGES.md, GATE.md, policy.json). Its delivery chat treats itself as the only publisher to main, and it is deep in Rosace micro-diagnostics. Dex said he "didn't see progress" there.

**Why:** Dex hands Claude direct scopes (e.g. "finish the website", World bugs) while Codex lanes keep running. Colliding writes or pushes would break the live site.

**How to apply:**
- Work in a git worktree off origin/main under `D:\Dex\Temp\`. Never touch Dex's dirty canonical checkout `D:\Dex\Projects\dex.place`.
- Leave a note listing the owned paths in that reports folder (e.g. CLAUDE-SITE-LANE-20260930.md), and append the outcome.
- Run every build, test and browser run through `resource-gate.ps1 -Owner 'claude-site'`, with software WebGL only (no -Exclusive).
- Stay out of art/, tools/, docs/character/, lanes/ and src/world/player/ (Codex's Rosace/character lanes).
- Publish by fast-forward only after independent verification, with a fetch check right before the push.
- Dex games while agents run: keep our processes at BelowNormal (D:\Dex\Temp\claude-lowprio.ps1).

See [[dex-place-live-repo]] and [[workflow-resume-gotchas]].

---
name: dex-place-live-repo
description: dex.place source of truth moved to the public GitHub repo on 2026-09-28; old sources/hosting paths are superseded
metadata:
  node_type: memory
  type: project
  originSessionId: 5562f87c-2ca6-46da-b895-2c48f7f0d7d2
  modified: 2026-09-28T14:29:26.654Z
---

On 2026-09-28 Dex made the public repo dexnotavailable/dex.place the single source of truth for https://dex.place, replacing the Sep 8 "inhabited v2" site (old source D:\Dex\Projects\dex-place-world\site, old origin D:\Dex\Projects\SUMMER PROJECT 3\dex-client\site on 127.0.0.1:8088 via the "\Dex\Dex Site Origin" scheduled task + existing Cloudflare Tunnel). The repo's `ops/` holds a puller that builds `main` and serves it on 8088; deploy root D:\Dex\Servers\dex.place. Old v1/v2/Registry code+docs were imported to `legacy/` (raw art and the 665 MB installer stay on disk). Third-party reference images live only in git-ignored `review/`.

**Why:** Dex works from cloud sessions, this PC and with others; one repo must decide what's live, 24/7, even unfinished.
**How to apply:** resolve dex.place work to D:\Dex\Projects\dex.place, not the old paths; verify the cutover state live before claiming it (check https://dex.place/__deploy). Related: [[dex-place-working-mode]].

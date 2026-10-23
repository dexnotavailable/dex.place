---
name: dex-place-blog-source
description: "Where dex.place blog posts really live (live clone, not the stale local checkout) and which files are placeholders"
metadata:
  node_type: memory
  type: reference
  originSessionId: d7d96afc-167f-4ade-9920-68a9fe65db1b
  modified: 2026-09-30T21:32:14.182Z
---

dex.place blog posts are `content/blog/<slug>.md` in github `dexnotavailable/dex.place` (public), images in `public/blog/<slug>/`. `main` is what is live.

- The local checkout `D:\Dex\Projects\dex.place` can be dozens of commits **behind** `origin/main` (was 26 behind on 2026-10-01) and dirty, so its blog files can be stale placeholders. Read the live clone `D:\Dex\Servers\dex.place\repo` or `gh`/GitHub API instead, and never pull/reset the local checkout to "fix" it.
- `first-post.md` and `second-post.md` are `placeholder: true` stubs. The real posts on 2026-10-01 were the two CharacterForge devlogs (`characterforge-01-...`, `characterforge-02-...`), which get quick "Devlog update" follow-up commits after the first push.
- Frontmatter: `title`, `summary`, `date` (YYYY-MM-DD), `placeholder`. Body is GitHub-flavoured markdown with `> [!NOTE]` callouts, tables, `<img>` figures with italic captions. See `content/README.md` in that repo.

Consumed by the Discord bot: [[devbot-blog-feature-uncommitted]].

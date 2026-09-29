# Website content

The website builds its pages from these files (`src/site/build/content.ts`).
Every page is prerendered at a real URL; nothing here needs JavaScript.

| Folder | Becomes |
|---|---|
| `docs/<slug>.md` | `/docs/<slug>/`, listed on `/docs/` by `order`, then title |
| `blog/<slug>.md` | `/blog/<slug>/`, listed on `/blog/` newest first, and in `/blog/feed.xml` |
| `gallery/manifest.json` | `/gallery/` and `/gallery/<id>/` (images in `public/gallery/`) |

File names are lowercase-kebab-case; the name is the URL. Files starting with `_`
are ignored (drafts you don't want built).

## Frontmatter

```text
---
title: Installing dexClient       required
summary: One line for the index   optional
date: 2026-09-29                  optional, YYYY-MM-DD, blog posts; never invent one
order: 1                          optional, docs only, lower first
group: dexclient                  optional, docs only: dexcode, dexclient or dex-place
placeholder: true                 shows a "Placeholder" tag, adds noindex, keeps it out of the feed
---
```

Docs are listed by group (`src/site/data/docs.ts`), then `order`, then title; an
unknown group fails the build. Posts are listed newest first by `date`, grouped
by year; undated posts are listed as drafts.

The body is Markdown (GitHub flavour). Start sections at `##`; the page title is
the `#`. Headings get anchor ids for deep links, and pages with two or more
sections get an "On this page" list. Also supported:

- Code fences name their language and get a copy button; add a caption with
  ```` ```powershell title="Check the file" ````. Shell and PowerShell prompts
  (`$ `, `PS> `) are shown but not copied.
- `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` callouts.
- Tables (they scroll sideways on small screens), `<kbd>` keys, task lists.

`docs/writing-docs.md` shows all of it on one page.

## Gallery

Dex's illustrations, display only: never reuse them as decoration anywhere else.
No visible titles (alt text stays for screen readers). Ids are two digits, never
names. Add a piece: copy the display file to `public/gallery/<id>.webp` and a
~512 px thumbnail to `public/gallery/<id>-t.webp`, then add an item with its
exact pixel sizes and alt text. The collage places it automatically (`src/site/collage.ts`); the
order in the manifest decides which piece leads (the first one).

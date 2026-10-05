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
sequence: 10                      optional, blog posts on the same date; higher first
order: 1                          optional, docs only, lower first
group: dexclient                  optional, docs only: dexcode, dexclient or dex-place
placeholder: true                 shows a "Placeholder" tag, adds noindex, keeps it out of the feed
nsfw: true                        blog posts: shows an NSFW tag, marks the feed item, no image indexing
---
```

Docs are listed by group (`src/site/data/docs.ts`), then `order`, then title; an
unknown group fails the build. Posts are listed newest first by `date`, grouped
by year. Same-date posts use `sequence` (a non-negative safe integer), higher
first; without it, numbered slugs such as `characterforge-10-title` supply the
sequence. Remaining ties sort by title, then slug. Undated posts are listed as
drafts in title order. Dates are never filled in from file modification times.

The body is Markdown (GitHub flavour). Start sections at `##`; the page title is
the `#`. Headings get anchor ids for deep links, and pages with two or more
sections get an "On this page" list. Also supported:

- Code fences name their language and get a copy button; add a caption with
  ```` ```powershell title="Check the file" ````. Shell and PowerShell prompts
  (`$ `, `PS> `) are shown but not copied.
- `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` callouts.
- Tables (they scroll sideways on small screens), `<kbd>` keys, task lists.

`docs/writing-docs.md` shows all of it on one page.

## NSFW posts and images

Devlog posts may carry adult images (Dex, 2026-10-06), always tagged and spoiler-blurred.

- **Tag the post:** `nsfw: true` in the frontmatter. The post page and its blog and home
  cards show an NSFW tag, the feed item says so in its title, a category and its
  description, and the page asks search engines not to index images.
- **Mark each image:** the title is the word `nsfw`: `![alt text](/blog/<slug>/file.webp "nsfw")`.
  A raw `<img ... data-nsfw>` works the same (the publisher writes that form). Any marked
  image in a post without `nsfw: true` fails the build.
- **What the reader gets:** the image is blurred hard and clipped, under an "NSFW" veil with a
  "Show image" button. Click, Enter or Space opens that one image; "Hide image" closes it.
  Print keeps it blurred, and so does a page without JavaScript. The real alt text is only
  set once the image is open. Give the `<img>` its `width` and `height` so the page does not jump.
- **Never leaked:** an NSFW file must not be a summary, social or meta image, an index
  thumbnail, a feed image or a link target (an NSFW image inside a link fails the build). The
  build checks every page and the feed for the file names (`nsfwLeaks` in `render/routes.ts`)
  and stops if one shows up outside its own post's spoiler.
- Adult characters only, never any nude image of a child or young-looking body.

## Gallery

Dex's illustrations, display only: never reuse them as decoration anywhere else.
No visible titles (alt text stays for screen readers). Ids are two digits, never
names. Add a piece: copy the display file to `public/gallery/<id>.webp` and a
~512 px thumbnail to `public/gallery/<id>-t.webp`, then add an item with its
exact pixel sizes and alt text. The collage places it automatically (`src/site/collage.ts`); the
order in the manifest decides which piece leads (the first one).

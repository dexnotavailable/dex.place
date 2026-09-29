---
title: Writing docs and posts
summary: How a markdown file in content/ becomes a page on this site.
group: dex-place
order: 2
placeholder: true
---

A sample page that shows every piece of formatting the docs and blog support. Dex will replace or remove it.

## Where files go

Every page is a markdown file. The file name is the address.

| File | Page |
|---|---|
| `content/docs/<name>.md` | `/docs/<name>/` |
| `content/blog/<name>.md` | `/blog/<name>/` |

Names are lowercase with hyphens. A file whose name starts with `_` is not built.

## Frontmatter

Each file starts with a few `key: value` lines between `---` fences.

```yaml title="content/docs/installing-dexclient.md"
---
title: Installing dexClient
summary: One line for the index
group: dexclient
order: 1
placeholder: true
---
```

- `title` is required.
- `summary` shows under the title on index pages.
- `date` (posts, `YYYY-MM-DD`) sets the order on the blog. Undated posts are listed as drafts.
- `group` (docs) is one of `dexcode`, `dexclient` or `dex-place`.
- `placeholder: true` shows the Placeholder tag, hides the page from search engines and keeps it out of the feed.

### Groups and order

Docs are listed by group, then by `order`, then by title.

## Formatting

Headings from `##` down get a link and appear under **On this page**. Links to other sites, like [the Ko-fi page](https://ko-fi.com/dexdonation), are marked for screen readers. Keys look like <kbd>Ctrl</kbd> + <kbd>C</kbd>.

> [!NOTE]
> A quote that starts with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` becomes a callout.

> [!WARNING]
> Never put secrets, tokens or personal data in `content/`. The repository is public.

Code blocks name their language and get a copy button:

```sh
$ npm run dev
$ npm run build
```

1. Write the file.
2. Run `npm run dev` and open the page.
3. Commit when it reads right.

---

A plain quote:

> Short text either helps someone use something or gives a real character a small voice.

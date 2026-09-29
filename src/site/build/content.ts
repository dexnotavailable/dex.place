// Loads the website's content from disk at build time (Node only):
//   content/docs/*.md, content/blog/*.md   markdown with a small frontmatter
//   content/gallery/manifest.json          Dex's illustrations (display only)
//
// Frontmatter is plain `key: value` lines between `---` fences:
//   title: Installing dexClient        (required)
//   summary: One line for index pages  (optional)
//   date: 2026-09-29                   (optional, YYYY-MM-DD; never invent one)
//   order: 1                           (docs only, lower first)
//   group: dexclient                   (docs only, an id from data/docs.ts)
//   placeholder: true                  (visible tag, noindex, kept out of the feed)

import fs from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";
import { DOC_GROUPS, groupRank } from "../data/docs.ts";
import { copyButton, icon } from "../render/glyphs.ts";
import { esc } from "../render/html.ts";
import { galleryVariant } from "../render/gallery.ts";
import type { Entry, GalleryItem, Heading, SiteContent } from "../render/types.ts";
import { highlight, langLabel } from "./highlight.ts";

export function parseFrontmatter(raw: string, file: string): { meta: Record<string, string>; body: string } {
  const text = raw.replace(/^﻿/, "").replaceAll("\r\n", "\n");
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) throw new Error(`${file}: missing --- frontmatter ---`);
  const meta: Record<string, string> = {};
  for (const line of (m[1] ?? "").split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const at = line.indexOf(":");
    if (at < 1) throw new Error(`${file}: bad frontmatter line "${line}"`);
    meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
}

// GitHub-style callouts: a blockquote whose first line is [!NOTE] etc.
const CALLOUTS = {
  NOTE: { label: "Note", icon: "info", tone: "cyan" },
  TIP: { label: "Tip", icon: "sparkle", tone: "mint" },
  IMPORTANT: { label: "Important", icon: "star", tone: "yellow" },
  WARNING: { label: "Warning", icon: "warn", tone: "magenta" },
  CAUTION: { label: "Caution", icon: "warn", tone: "magenta" },
} as const;

interface Parser {
  parser: { parse(tokens: Tokens.Generic[]): string; parseInline(tokens: Tokens.Generic[]): string };
}

/** Words in a markdown body (code included), for reading time. */
export function countWords(body: string): number {
  return body.replace(/[#>*_`[\]()!|-]+/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length;
}

/** Whole minutes at 220 words a minute, never less than 1. */
export const readingMinutes = (words: number): number => Math.max(1, Math.round(words / 220));

/**
 * Markdown to HTML. Headings get ids for deep links; h1 is demoted (the page
 * owns h1). Code blocks get a label bar, a copy button and build-time colours;
 * tables scroll inside their own region; [!NOTE]-style quotes become callouts;
 * links to other sites get rel="noopener".
 */
export function renderMarkdown(body: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading(this: Parser, token: Tokens.Heading) {
        const depth = Math.min(6, Math.max(2, token.depth + (token.depth === 1 ? 1 : 0)));
        const inner = this.parser.parseInline(token.tokens);
        const text = stripTags(inner).trim();
        const base = slugify(text);
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        const id = n ? `${base}-${n + 1}` : base;
        headings.push({ depth, id, text });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
      },

      code(token: Tokens.Code) {
        // Info string: ```ps1 title="Check the download"
        const info = (token.lang ?? "").trim();
        const lang = info.split(/\s+/)[0] ?? "";
        const title = /title="([^"]*)"/.exec(info)?.[1] ?? "";
        const label = langLabel(lang);
        const text = token.text.replace(/\n$/, "");
        // Prompts ("$ ", "PS> ") are shown but not copied.
        const copy = text.replace(/^(?:\$ |PS[^>\n]*> )/gm, "");
        const bar =
          `<figcaption class="code__bar">` +
          `<span class="code__dots" aria-hidden="true"><i></i><i></i><i></i></span>` +
          (label ? `<span class="code__lang">${esc(label)}</span>` : "") +
          (title ? `<span class="code__title">${esc(title)}</span>` : "") +
          `<span class="code__copy">${copyButton(copy, title ? `code: ${title}` : "code")}</span>` +
          `</figcaption>`;
        // The block scrolls sideways, so it takes keyboard focus; a focusable
        // box needs a role and a name to be announced, and a <pre> may only
        // carry aria-label with a role. So it is a named region, like the
        // scrolling tables (below).
        const name = title || (label ? `${label} code` : "Code");
        return (
          `<figure class="code"${lang ? ` data-lang="${esc(lang.toLowerCase())}"` : ""}>${bar}` +
          `<pre tabindex="0" role="region" aria-label="${esc(name)}"><code>${highlight(text, lang)}</code></pre></figure>\n`
        );
      },

      blockquote(this: Parser, token: Tokens.Blockquote) {
        const inner = this.parser.parse(token.tokens);
        const m = /^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/.exec(inner);
        if (!m) return `<blockquote>\n${inner}</blockquote>\n`;
        const c = CALLOUTS[m[1] as keyof typeof CALLOUTS];
        const rest = `<p>${inner.slice(m[0].length)}`.replace(/^<p><\/p>\n?/, "");
        return (
          `<div class="callout callout--${c.tone}" role="note">` +
          `<p class="callout__label">${icon(c.icon, 2)}<span>${c.label}</span></p>` +
          `<div class="callout__body">${rest}</div></div>\n`
        );
      },

      link(this: Parser, token: Tokens.Link) {
        const inner = this.parser.parseInline(token.tokens);
        const external = /^https?:\/\//.test(token.href) && !token.href.startsWith("https://dex.place");
        const title = token.title ? ` title="${esc(token.title)}"` : "";
        return external
          ? `<a class="ext" href="${esc(token.href)}"${title} rel="noopener">${inner}<span class="sr"> (another site)</span></a>`
          : `<a href="${esc(token.href)}"${title}>${inner}</a>`;
      },
    },
  });
  const html = md
    .parse(body, { async: false })
    // Wide tables scroll in their own focusable region instead of the page.
    .replaceAll("<table>", `<div class="table" role="region" tabindex="0" aria-label="Table"><table>`)
    .replaceAll("</table>", "</table></div>");
  return { html, headings };
}

export function loadEntries(dir: string, kind: Entry["kind"]): Entry[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort();
  const entries = files.map((f): Entry => {
    const file = path.join(dir, f);
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"), file);
    const slug = f.slice(0, -3);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${file}: file name must be lowercase-kebab-case`);
    if (!meta.title) throw new Error(`${file}: frontmatter needs a title`);
    const date = meta.date || null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${file}: date must be YYYY-MM-DD`);
    const group = kind === "docs" ? meta.group || null : null;
    if (group && !DOC_GROUPS.some((g) => g.id === group)) {
      throw new Error(`${file}: group "${group}" is not one of ${DOC_GROUPS.map((g) => g.id).join(", ")} (src/site/data/docs.ts)`);
    }
    const { html, headings } = renderMarkdown(body);
    return {
      group,
      minutes: readingMinutes(countWords(body)),
      kind,
      slug,
      url: `/${kind}/${slug}/`,
      title: meta.title,
      summary: meta.summary ?? "",
      date,
      placeholder: meta.placeholder === "true",
      order: meta.order ? Number(meta.order) : 100,
      html,
      headings,
    };
  });
  if (kind === "docs") {
    // Grouped in data/docs.ts order, then by `order`, then title.
    return entries.sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.order - b.order || a.title.localeCompare(b.title));
  }
  // Newest first; undated drafts after dated posts.
  return entries.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title));
}

/**
 * Reads content/gallery/manifest.json. With `publicDir`, also checks that the
 * display file, thumbnail and every listed smaller copy exist, so a piece
 * added without running `npm run gallery:derive` fails the build instead of
 * shipping 2048px files to phones.
 */
export function loadGallery(file: string, publicDir?: string): GalleryItem[] {
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { items: GalleryItem[] };
  for (const item of data.items) {
    if (!/^\d{2}$/.test(item.id)) throw new Error(`${file}: gallery id "${item.id}" must be two digits (no names)`);
    for (const key of ["alt", "src", "thumb"] as const) {
      if (!item[key]) throw new Error(`${file}: item ${item.id} is missing ${key}`);
    }
    for (const key of ["width", "height", "thumbWidth", "thumbHeight"] as const) {
      if (!Number.isInteger(item[key]) || item[key] <= 0) throw new Error(`${file}: item ${item.id} has a bad ${key}`);
    }
    if (!/\.webp$/.test(item.src)) throw new Error(`${file}: item ${item.id} src must be a .webp file`);
    const widths = item.widths;
    if (!Array.isArray(widths) || !widths.length) {
      throw new Error(`${file}: item ${item.id} has no widths; run npm run gallery:derive`);
    }
    widths.forEach((w, i) => {
      if (!Number.isInteger(w) || w <= 0 || w >= item.width || (i > 0 && w <= widths[i - 1]!)) {
        throw new Error(`${file}: item ${item.id} widths must be ascending whole numbers below its width (${item.width})`);
      }
    });
  }
  if (!publicDir) return data.items;
  return data.items.map((item) => {
    for (const url of [item.src, item.thumb]) {
      if (!fs.existsSync(path.join(publicDir, url))) throw new Error(`${file}: item ${item.id}: public${url} is missing`);
    }
    // Sizes on disk, so the piece page can hold a phone's first view to a byte budget.
    const bytes = new Map<number, number>();
    for (const [w, url] of [...item.widths.map((w) => [w, galleryVariant(item.src, w)] as const), [item.width, item.src] as const]) {
      const at = path.join(publicDir, url);
      if (!fs.existsSync(at)) throw new Error(`${file}: item ${item.id}: public${url} is missing; run npm run gallery:derive`);
      bytes.set(w, fs.statSync(at).size);
    }
    return { ...item, bytes };
  });
}

export function loadContent(root: string): SiteContent {
  const dir = path.join(root, "content");
  return {
    docs: loadEntries(path.join(dir, "docs"), "docs"),
    posts: loadEntries(path.join(dir, "blog"), "blog"),
    gallery: loadGallery(path.join(dir, "gallery", "manifest.json"), path.join(root, "public")),
  };
}

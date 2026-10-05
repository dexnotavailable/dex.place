// NSFW posts and images (CANON.md, "Blog content"; Dex, 2026-10-06).
//
// Adult images may appear in blog posts, always tagged and spoiler-blurred.
// Two marks exist, and both are plain source:
//   frontmatter   nsfw: true                      the post is tagged NSFW
//   an image      ![alt](file.webp "nsfw")        markdown: the title is the word nsfw
//                 <img ... data-nsfw>             raw HTML (what the publisher writes)
//
// build/content.ts calls wrapNsfwImages() on every rendered body. Each marked
// image becomes the spoiler below: the picture heavily blurred under an
// "NSFW" veil with a real "Show image" button (motion/nsfw.ts reveals one
// image at a time; styles/docs.css `.nsfw*` does the blur). Without JavaScript
// it stays blurred. The real alt text is held in data-alt and only put back
// when the viewer opens the image, so nothing is described before then.
//
// The other half of this file is the leak guard. An NSFW image file must
// appear only inside a spoiler on its own post's page; never in the feed, a
// meta tag, an index card or any other page. findNsfwLeaks() checks that, and
// the build (build/plugin.ts) and the tests both run it.
//
// DOM-free: string in, string out.

import { esc } from "./html.ts";

/** Visible "NSFW" tag, same shape as the Placeholder tag (glyphs.ts). */
export const nsfwTag = (): string => `<span class="tag tag--nsfw">NSFW</span>`;

// One <img ...> tag; quoted attribute values may contain ">".
const IMG_TAG = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function attributes(tag: string): Map<string, string> {
  const out = new Map<string, string>();
  const inner = tag.slice(4, tag.endsWith("/>") ? -2 : -1);
  for (const m of inner.matchAll(ATTR)) {
    const name = m[1]!.toLowerCase();
    if (!out.has(name)) out.set(name, m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

/** `data-nsfw` and `data-nsfw="true"` mark an image; `data-nsfw="false"` does not. */
const isMarked = (attrs: Map<string, string>): boolean => attrs.has("data-nsfw") && attrs.get("data-nsfw")!.toLowerCase() !== "false";

// Values from the source are already HTML-escaped text; only quotes need care.
const q = (value: string): string => value.replaceAll('"', "&quot;");

// Attributes the spoiler rewrites itself; everything else (src, srcset,
// sizes, width, height, loading, decoding) is kept as written.
const OWN = new Set(["alt", "title", "class", "style", "data-nsfw", "data-alt"]);

/**
 * The blur, strong enough that nothing anatomical reads at any size: about 4.5%
 * of the viewport width, between 32 and 56 px (the post column is at most
 * ~760 px, so that is 4 to 8% of the image's width). It is written inline on the
 * <img>, so the image is still blurred if the stylesheet fails to load;
 * styles/docs.css only clips, scales and reveals. Keep print's copy in sync.
 */
export const NSFW_BLUR = "blur(clamp(32px,4.5vw,56px))";

/** The spoiler for one image tag. */
export function spoilerImage(attrs: Map<string, string>): string {
  const kept = [...attrs]
    .filter(([name]) => !OWN.has(name))
    .map(([name, value]) => `${name}="${q(value)}"`);
  if (!attrs.has("loading")) kept.push('loading="lazy"');
  if (!attrs.has("decoding")) kept.push('decoding="async"');
  const alt = attrs.get("alt") ?? "";
  return (
    `<span class="nsfw"><span class="nsfw__frame">` +
    `<img class="nsfw__img" ${kept.join(" ")} alt="" data-alt="${q(alt)}" style="filter:${NSFW_BLUR}">` +
    `<span class="nsfw__veil">${nsfwTag()}` +
    `<button class="btn btn--yellow btn--s nsfw__show" type="button" data-nsfw-show>Show image<span class="sr"> (NSFW)</span></button>` +
    `<span class="nsfw__nojs">Turn on JavaScript to show this image.</span></span>` +
    `<button class="btn btn--paper btn--s nsfw__hide" type="button" data-nsfw-hide>Hide image<span class="sr"> (NSFW)</span></button>` +
    `</span></span>`
  );
}

/**
 * Turns every marked <img> in rendered HTML into its spoiler. An NSFW image
 * inside a link throws: the link would open the unblurred file.
 */
export function wrapNsfwImages(html: string): string {
  const out = html.replace(IMG_TAG, (tag) => {
    const attrs = attributes(tag);
    return isMarked(attrs) ? spoilerImage(attrs) : tag;
  });
  if (out === html) return html;
  if (/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*class="nsfw__img"/i.test(out)) {
    throw new Error("an NSFW image is inside a link; the link would open the unblurred file");
  }
  return out;
}

const SPOILER = /<span class="nsfw"><span class="nsfw__frame">[\s\S]*?<\/button><\/span><\/span>/g;
const SPOILER_IMG = /<img class="nsfw__img"[^>]*>/g;

/**
 * For feeds and any other copy of a post body: every spoiler becomes one line
 * of text and a link, so no image tag and no file name leaves the page.
 */
export function hideNsfwImages(html: string, link: string): string {
  return html.replace(SPOILER, `<p>NSFW image hidden: <a href="${q(link)}">view on dex.place</a></p>`);
}

/** Every file URL (src and srcset) of the NSFW images in a rendered body. */
export function nsfwImageUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const tag of html.match(SPOILER_IMG) ?? []) {
    const attrs = attributes(tag);
    const src = attrs.get("src");
    if (src) urls.add(src);
    for (const part of (attrs.get("srcset") ?? "").split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

/**
 * NSFW image URLs that appear in `html` where they must not. On the post's own
 * page (`own`) they may sit inside a spoiler <img>; everywhere else, nowhere.
 * Meta tags, link hints, thumbnails and feed items all count as "elsewhere".
 */
export function findNsfwLeaks(html: string, urls: readonly string[], own: boolean): string[] {
  const text = own ? html.replace(SPOILER_IMG, "") : html;
  // Entities and percent-encoding of the same file name still count.
  return urls.filter((url) => [url, esc(url), encodeURI(url)].some((form) => text.includes(form)));
}

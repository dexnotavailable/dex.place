// Shapes shared by the build plugin (which loads content from disk) and the
// DOM-free page renderers.

export interface Heading {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
}

/** One markdown file from content/docs or content/blog. */
export interface Entry {
  readonly kind: "docs" | "blog";
  readonly slug: string;
  readonly url: string;
  readonly title: string;
  /** One line for index pages; empty when the file has none. */
  readonly summary: string;
  /** ISO date (YYYY-MM-DD) from frontmatter, or null. Never invented. */
  readonly date: string | null;
  /** Blog date tie break: frontmatter `sequence` or the numbered slug; higher first. */
  readonly sequence: number;
  /** Frontmatter `placeholder: true`: visible tag, noindex, kept out of feeds. */
  readonly placeholder: boolean;
  /** Frontmatter `nsfw: true`: visible NSFW tag, adult images spoiler-blurred, no image indexing, flagged in the feed. */
  readonly nsfw: boolean;
  /** File URLs of the NSFW images in the body (render/nsfw.ts). They may appear only on this entry's own page, inside spoilers. */
  readonly nsfwImages: readonly string[];
  /** Sort key for docs (frontmatter `order`), lower first. */
  readonly order: number;
  /** Docs only: group id from frontmatter (data/docs.ts), or null. */
  readonly group: string | null;
  /** Reading time in whole minutes (at least 1), from the word count. */
  readonly minutes: number;
  readonly html: string;
  readonly headings: readonly Heading[];
}

export interface GalleryItem {
  /** Neutral id, "01".."09". Never a name (Dex: "dont name them"). */
  readonly id: string;
  readonly alt: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly thumb: string;
  readonly thumbWidth: number;
  readonly thumbHeight: number;
  /**
   * Widths of the smaller lossless copies at /gallery/<id>-<w>.webp, ascending
   * and all below `width` (npm run gallery:derive). The display file is the
   * largest srcset candidate.
   */
  readonly widths: readonly number[];
  /** File size of each width (copies and display file), filled in by the build from public/. */
  readonly bytes?: ReadonlyMap<number, number>;
}

export interface SiteContent {
  readonly docs: readonly Entry[];
  readonly posts: readonly Entry[];
  readonly gallery: readonly GalleryItem[];
}

export type PageId = "home" | "projects" | "downloads" | "gallery" | "docs" | "blog" | "donate" | "notfound";

export interface PageMeta {
  readonly path: string;
  /** Document title without the " · dex" suffix; null for the root. */
  readonly title: string | null;
  readonly description: string;
  readonly page: PageId;
  readonly noindex?: boolean;
  /** An NSFW post: adds the adult rating and a "no image indexing" robots hint. */
  readonly nsfw?: boolean;
  /**
   * Markup that closes <head>, after the stylesheet and the head scripts:
   * the home page's /#gallery image preloads (render/gallery.ts
   * galleryArrival).
   */
  readonly headEnd?: string;
}

/** What a route renders into the page shell's slots. */
export interface Rendered {
  readonly head: string;
  readonly body: string;
}

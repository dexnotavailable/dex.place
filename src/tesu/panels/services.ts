// The Hall of Works' services, on the website's own data (GDK 3.7): the Notice Wall (the
// blog), the docs shelf, the offering box (Ko-fi and the personal bank QR, the ticket wheel drawn
// idle), Hanko's desk (accounts open later; the ledger slip carries progress between
// devices), the Crane Desk, the patrons' scroll and the gallery's frames. Only real data:
// posts and docs come from content/, the art from the gallery manifest, the Ko-fi and bank
// details from the website's donate module.

import { DOC_GROUPS } from "../../site/data/docs.ts";
import { KOFI_URL } from "../../site/data/nav.ts";
import { QUICK_PICKS, formatVnd } from "../../site/donate.ts";
import { qrGrid } from "../../site/qr.ts";
import { vietQrPayload } from "../../site/vietqr.ts";
import gallery from "../../../content/gallery/manifest.json";
import { el, type PanelSpec } from "./panels.ts";

// --- the content files, loaded when a panel opens --------------------------------------

const BLOG = import.meta.glob("/content/blog/*.md", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const DOCS = import.meta.glob("/content/docs/*.md", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;

interface Front {
  slug: string;
  title: string;
  summary?: string;
  date?: string;
  sequence?: number;
  order?: number;
  group?: string;
  placeholder?: boolean;
  nsfw?: boolean;
}

function front(path: string, raw: string): Front {
  const slug = path.split("/").pop()!.replace(/\.md$/, "");
  const f: Front = { slug, title: slug };
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (m) {
    for (const line of m[1]!.split(/\r?\n/)) {
      const kv = /^([a-z]+):\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const [, k, v] = kv as unknown as [string, string, string];
      const val = v.replace(/^["']|["']$/g, "");
      if (k === "title") f.title = val;
      else if (k === "summary") f.summary = val;
      else if (k === "date") f.date = val;
      else if (k === "sequence") f.sequence = Number(val);
      else if (k === "order") f.order = Number(val);
      else if (k === "group") f.group = val;
      else if (k === "placeholder") f.placeholder = val === "true";
      else if (k === "nsfw") f.nsfw = val === "true";
    }
  }
  if (f.sequence === undefined) {
    const n = /-(\d+)-/.exec(slug);
    if (n) f.sequence = Number(n[1]);
  }
  return f;
}

async function loadAll(src: Record<string, () => Promise<string>>): Promise<Front[]> {
  const out: Front[] = [];
  for (const [path, load] of Object.entries(src)) {
    const name = path.split("/").pop()!;
    if (name.startsWith("_")) continue;
    out.push(front(path, await load()));
  }
  return out;
}

const link = (href: string, text: string, cls = "btn"): HTMLAnchorElement => {
  const a = el("a", cls, text);
  a.href = href;
  return a;
};

// --- the Notice Wall: the emperor's proclamations (the blog) ----------------------------

export const noticeWall: PanelSpec = {
  title: "Notice Wall",
  look: "board",
  async body(b) {
    const posts = (await loadAll(BLOG)).filter((p) => !p.placeholder);
    posts.sort((a, c) => (c.date ?? "").localeCompare(a.date ?? "") || (c.sequence ?? 0) - (a.sequence ?? 0) || a.title.localeCompare(c.title));
    b.append(el("p", "lede", "Proclamations, newest first. Each one is pasted up in the towns too."));
    const list = el("ul", "notices");
    for (const p of posts.slice(0, 12)) {
      const li = el("li", "notice");
      const h = el("h3", "", p.title);
      const meta = el("p", "meta", p.date ?? "undated");
      if (p.nsfw) meta.append(el("span", "tag", "NSFW"));
      li.append(h, meta);
      if (p.summary) li.append(el("p", "", p.summary));
      li.append(link(`/blog/${p.slug}/`, "Read it"));
      list.append(li);
    }
    b.append(list, el("p", "foot", link("/blog/", "Every proclamation, on the website", "plain")));
  },
};

// --- the docs shelf: one row of books per product (Archivist Seo) -----------------------

export const docsShelf: PanelSpec = {
  title: "The docs shelf",
  look: "shelf",
  async body(b) {
    const docs = (await loadAll(DOCS)).filter((d) => !d.placeholder);
    b.append(el("p", "lede", "Seo keeps one book for each of the emperor's works. Take one down."));
    for (const g of DOC_GROUPS) {
      const books = docs.filter((d) => d.group === g.id).sort((a, c) => (a.order ?? 99) - (c.order ?? 99) || a.title.localeCompare(c.title));
      if (!books.length) continue;
      const row = el("section", "shelf-row", el("h3", "", g.label));
      const ul = el("ul", "books");
      for (const d of books) ul.append(el("li", "book", link(`/docs/${d.slug}/`, d.title, "book-title"), d.summary ? el("p", "", d.summary) : null));
      row.append(ul);
      b.append(row);
    }
    b.append(el("p", "foot", link("/docs/", "The whole library, on the website", "plain")));
  },
};

// --- the offering box: Ko-fi, the personal bank QR, the ticket wheel (idle) -------------

function qrCanvas(text: string, px: number): HTMLCanvasElement {
  const grid = qrGrid(text);
  const quiet = 4;
  const n = grid.size + quiet * 2;
  const c = document.createElement("canvas");
  c.width = c.height = n * px;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fffaf0";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#1b1922";
  for (let y = 0; y < grid.size; y++) for (let x = 0; x < grid.size; x++) if (grid.get(x, y)) g.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
  return c;
}

export const offeringBox: PanelSpec = {
  title: "Offering box",
  look: "box",
  body(b) {
    b.append(el("p", "lede", "Gifts keep the emperor's works going. Nothing here is sold, and a gift buys nothing in Tesu."));
    const kofi = link(KOFI_URL, "Give on Ko-fi", "btn big");
    kofi.target = "_blank";
    kofi.rel = "noopener";
    b.append(el("section", "give", el("h3", "", "Ko-fi"), el("p", "", "Card or PayPal, any amount."), kofi));
    // the bank QR: no amount by default; a pick fills one in
    const qrBox = el("div", "qr");
    const tag = el("p", "qr-tag");
    const draw = (amount: number): void => {
      qrBox.replaceChildren(qrCanvas(vietQrPayload(amount), 4));
      qrBox.setAttribute("role", "img");
      qrBox.setAttribute("aria-label", amount ? `Personal bank QR for ${formatVnd(amount)}` : "Personal bank QR, any amount");
      tag.textContent = amount ? formatVnd(amount) : "Any amount (your bank app asks)";
    };
    const picks = el("div", "picks");
    const any = el("button", "chip", "Any amount");
    any.type = "button";
    any.addEventListener("click", () => draw(0));
    picks.append(any);
    for (const a of QUICK_PICKS) {
      const bt = el("button", "chip", formatVnd(a));
      bt.type = "button";
      bt.addEventListener("click", () => draw(a));
      picks.append(bt);
    }
    draw(0);
    b.append(el("section", "give", el("h3", "", "Personal bank"), el("p", "", "Vietnamese banking. Scan with any banking app."), qrBox, tag, picks));
    // the ticket wheel under the box, drawn idle until dex accounts exist
    b.append(el("section", "wheel", el("h3", "", "The ticket wheel"), el("p", "", "No tickets yet. Donation tickets start when dex accounts open.")));
    b.append(el("p", "foot", link("/donate/", "The same, on the website", "plain")));
  },
};

// --- Hanko's desk: accounts later, the ledger slip now ------------------------------------

export interface SlipHost {
  /** A short text code of this device's progress. */
  writeSlip(): string;
  /** Reads a slip; returns an error message or null when stamped in. */
  readSlip(code: string): string | null;
}

export function hankoDesk(host: SlipHost): PanelSpec {
  return {
    title: "Hanko's desk",
    look: "ledger",
    body(b) {
      b.append(el("p", "lede", "\"Registration opens later. Until then, a ledger slip: your progress, written down, to carry to another device.\""));
      const code = host.writeSlip();
      const out = el("input", "slip-code");
      out.readOnly = true;
      out.value = code;
      out.setAttribute("aria-label", "Your ledger slip");
      const copy = el("button", "btn", "Copy the slip");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code);
          copy.textContent = "Copied";
        } catch {
          out.select();
        }
      });
      b.append(el("section", "slip", el("h3", "", "Your slip"), out, copy));
      const inp = el("input", "slip-code");
      inp.placeholder = "Paste a slip here";
      inp.setAttribute("aria-label", "A slip from another device");
      const stamp = el("button", "btn", "Stamp it in");
      stamp.type = "button";
      const msg = el("p", "msg");
      msg.setAttribute("role", "status");
      stamp.addEventListener("click", () => {
        const err = host.readSlip(inp.value.trim());
        msg.textContent = err ?? "Stamped. Your progress is on this device now.";
      });
      b.append(el("section", "slip", el("h3", "", "Hand her a slip"), inp, stamp, msg));
    },
  };
}

// --- the Crane Desk, the patrons' scroll -------------------------------------------------

export const craneDesk: PanelSpec = {
  title: "The Crane Desk",
  look: "slip",
  body(b) {
    b.append(el("p", "lede", "Write a note and it folds into a paper crane. The cranes start flying when support threads open."));
    b.append(el("p", "", "Something wrong with dexCode or dexClient? They send Dex an error report themselves; if you write about it, quote the reference that starts with r_."));
    b.append(el("p", "", link("/docs/error-reports/", "Error reports and privacy", "btn")));
  },
};

export const patronsScroll: PanelSpec = {
  title: "A hanging scroll",
  look: "scroll",
  body(b) {
    b.append(el("p", "lede", "Behind the desk, a plain scroll where the emperor's patrons will be named on wooden plaques, from the first real one on."));
    b.append(el("p", "", link("/donate/", "Become the first", "plain")));
  },
};

// --- the gallery: each frame shows its piece, only ever as itself -------------------------

export interface GalleryItem {
  id: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  thumb: string;
  thumbWidth: number;
  thumbHeight: number;
}

export const GALLERY: readonly GalleryItem[] = (gallery as { items: GalleryItem[] }).items;

export function galleryFrame(id: string): PanelSpec {
  const item = GALLERY.find((g) => g.id === id);
  return {
    title: "From the emperor's hand",
    look: "frame",
    wide: true,
    body(b) {
      if (!item) {
        b.append(el("p", "", "This frame is empty."));
        return;
      }
      const img = el("img", "art");
      img.src = item.src;
      img.alt = item.alt;
      img.width = item.width;
      img.height = item.height;
      img.decoding = "async";
      b.append(el("figure", "piece", img), el("p", "foot", link(`/gallery/${item.id}/`, "Open it on the website", "plain")));
    },
  };
}

/** A small "say" panel: inspecting something with no service (yet). */
export function saySpec(title: string, text: string): PanelSpec {
  return { title, look: "slip", body: (b) => { b.append(el("p", "lede", text)); } };
}

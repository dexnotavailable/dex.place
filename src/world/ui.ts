// In-world panels: real, accessible DOM (focus moves in, Esc or the close
// button returns you to the world, focus goes back to the canvas). They call
// the website's own pages, so the world and the site show the same thing:
// donate, the archive (docs), downloads; the gallery shows one of Dex's
// pieces on its own from content/gallery/manifest.json. Nothing here fakes
// data: donor records and dex account aren't connected yet and say so.

import galleryRaw from "../../content/gallery/manifest.json?raw";
import { DOC_GROUPS } from "../site/data/docs.ts";

interface GalleryItem {
  id: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  widths?: number[];
  thumb?: string;
  thumbWidth?: number;
  thumbHeight?: number;
}

const GALLERY = (JSON.parse(galleryRaw) as { items: GalleryItem[] }).items;

/**
 * The website's documentation pages, read from the same markdown the site
 * builds them from (content/docs/*.md: `/docs/<name>/`; `_` files are not
 * built), so an archive bay opens its own product's pages and nothing else.
 */
interface DocPage {
  url: string;
  title: string;
  group: string | null;
  order: number;
}
const DOCS: DocPage[] = Object.entries(import.meta.glob("../../content/docs/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>)
  .map(([file, raw]) => {
    const name = file.slice(file.lastIndexOf("/") + 1, -3);
    if (name.startsWith("_")) return null;
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw.replace(/^\uFEFF/, ""));
    const meta: Record<string, string> = {};
    for (const line of (m?.[1] ?? "").split(/\r?\n/)) {
      const at = line.indexOf(":");
      if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    return { url: `/docs/${name}/`, title: meta["title"] ?? name, group: meta["group"] || null, order: meta["order"] ? Number(meta["order"]) : 100 };
  })
  .filter((d): d is DocPage => !!d)
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

/** A bay's pages: `arg` is "g-<group>" (the /docs/ group id), in the site's order. */
export function bayDocs(arg: string | undefined): { label: string; pages: DocPage[] } | null {
  const id = arg?.startsWith("g-") ? arg.slice(2) : null;
  if (!id) return null;
  const pages = DOCS.filter((d) => d.group === id);
  return pages.length ? { label: DOC_GROUPS.find((g) => g.id === id)?.label ?? id, pages } : null;
}

/** Website pages the world's panels load. The website lane owns these routes. */
export const SITE = {
  donate: "/donate/",
  archive: "/docs/",
  downloads: "/downloads/",
  gallery: "/gallery/",
} as const;

export type PanelKind = "donate" | "donors" | "map" | "archive" | "account" | "gallery" | "summoned" | "downloads";

export class Panels {
  open = false;
  kind: PanelKind | null = null;
  onClose: (kind: PanelKind) => void = () => {};
  private root: HTMLElement;
  private body: HTMLElement;
  private title: HTMLElement;
  private closeBtn: HTMLButtonElement;
  /** The map panel draws the route it is given: the rooms at their world positions (side view), where you are, where you've been, the shrines you've lit. */
  mapInfo: {
    rooms: { id: string; label: string; origin?: [number, number]; w?: number; h?: number }[];
    here: string;
    visited?: Set<string>;
    shrines?: number[];
  } = { rooms: [], here: "" };

  constructor(private canvas: HTMLCanvasElement) {
    const root = document.createElement("div");
    root.id = "panel";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "panel-title");
    root.innerHTML = `<div class="frame"><header><h2 id="panel-title"></h2><button type="button" class="close" aria-label="Close">×</button></header><div class="body"></div></div>`;
    document.body.appendChild(root);
    this.root = root;
    this.body = root.querySelector(".body") as HTMLElement;
    this.title = root.querySelector("h2") as HTMLElement;
    this.closeBtn = root.querySelector(".close") as HTMLButtonElement;
    this.closeBtn.addEventListener("click", () => this.close());
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
      if (e.key === "Tab") this.trap(e);
      e.stopPropagation();
    });
    root.addEventListener("pointerdown", (e) => {
      if (e.target === root) this.close();
    });
  }

  private trap(e: KeyboardEvent): void {
    const f = [...this.root.querySelectorAll<HTMLElement>("button, a[href], iframe, input, [tabindex]")].filter((x) => !x.hidden);
    if (!f.length) return;
    const first = f[0]!;
    const last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private frame(src: string, label: string): string {
    // ?embed=world lets the website show the page without its own chrome inside the panel
    const embed = `${src}${src.includes("?") ? "&" : "?"}embed=world`;
    return `<iframe src="${embed}" title="${label}" loading="lazy"></iframe><p class="alt"><a href="${src}">Open ${label.toLowerCase()} as a page</a></p>`;
  }

  show(kind: PanelKind, arg?: string): void {
    this.kind = kind;
    this.root.dataset.kind = kind;
    let title = "";
    let html = "";
    switch (kind) {
      case "donate":
        title = "Donate";
        html = this.frame(SITE.donate, "Donate");
        break;
      case "archive": {
        // the index lectern: every doc; a product's bay: that product's own pages (the first open,
        // the others one press away), straight from the site
        const bay = bayDocs(arg);
        if (!bay) {
          title = "Archive";
          html = this.frame(SITE.archive, "Documentation");
          break;
        }
        const first = bay.pages[0]!;
        title = `Archive: ${bay.label}`;
        // the bay's other pages sit above the page, so a phone sees them without scrolling
        html = "";
        if (bay.pages.length > 1)
          html += `<nav class="bay" aria-label="${bay.label} documentation">${bay.pages.map((d, i) => `<button type="button" data-doc="${d.url}" aria-pressed="${i === 0}">${d.title}</button>`).join("")}</nav>`;
        html += this.frame(first.url, first.title);
        break;
      }
      case "downloads":
        title = "Downloads";
        html = this.frame(SITE.downloads, "Downloads");
        break;
      case "donors":
        title = "Donors";
        html = `<p>Donor records aren't connected to the world yet, so there's no one to show here. Nothing is listed until it's real.</p>`;
        break;
      case "account":
        title = "dex account";
        html = `<p>The dex account isn't open yet. When it is, this counter shows the same account as the website.</p>`;
        break;
      case "summoned":
        title = "The terminal";
        html = `<p>No warden answers yet. Downloads are always direct on the website.</p><p><a class="go" href="${SITE.downloads}">Downloads</a></p>`;
        break;
      case "gallery": {
        if (arg === "all") {
          // the catalogue: every piece, each opening on its own (real thumbnails from the manifest, alt text kept)
          title = "Illustrations";
          html = `<ul class="catalogue">${GALLERY.map((g) => `<li><button type="button" data-art="${g.id}"><img src="${g.thumb ?? g.src}" alt="${g.alt.replace(/"/g, "&quot;")}" width="${g.thumbWidth ?? g.width}" height="${g.thumbHeight ?? g.height}" loading="lazy"></button></li>`).join("")}</ul><p class="alt"><a href="${SITE.gallery}">All illustrations on the website</a></p>`;
          break;
        }
        const it = GALLERY.find((g) => g.id === arg) ?? GALLERY[0];
        title = "Illustration";
        if (it) {
          const srcset = (it.widths ?? []).map((w) => `${it.src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`).join(", ");
          html = `<figure><img src="${it.src}" ${srcset ? `srcset="${srcset}, ${it.src} ${it.width}w" sizes="80vw"` : ""} width="${it.width}" height="${it.height}" alt="${it.alt.replace(/"/g, "&quot;")}"></figure><p class="alt"><a href="${SITE.gallery}">All illustrations</a></p>`;
        }
        break;
      }
      case "map": {
        title = "Map";
        const rooms = this.mapInfo.rooms;
        if (rooms.some((r) => r.origin)) {
          html = this.sideMap();
          break;
        }
        const step = 100 / Math.max(1, rooms.length);
        html = `<svg viewBox="0 0 100 40" role="img" aria-label="The route: ${rooms.map((r) => r.label).join(", then ")}. You are at ${rooms.find((r) => r.id === this.mapInfo.here)?.label ?? "the route"}.">
          <path d="M ${step / 2} 26 ${rooms.map((_, i) => `L ${step / 2 + i * step} ${26 - (i % 2) * 8}`).join(" ")}" stroke="#b9a37a" stroke-width="0.6" fill="none" stroke-dasharray="1.2 0.8"/>
          ${rooms
            .map(
              (r, i) =>
                `<g><rect x="${step / 2 + i * step - 2.5}" y="${23.5 - (i % 2) * 8}" width="5" height="5" fill="${r.id === this.mapInfo.here ? "#e8c068" : "#6b5a44"}"/><text x="${step / 2 + i * step}" y="${34 - (i % 2) * 8}" font-size="3" text-anchor="middle" fill="#d8ccb0">${r.label}</text></g>`,
            )
            .join("")}
        </svg>`;
        break;
      }
    }
    this.title.textContent = title;
    this.body.innerHTML = html;
    for (const b of this.body.querySelectorAll<HTMLButtonElement>("button[data-art]")) b.addEventListener("click", () => this.show("gallery", b.dataset.art));
    for (const b of this.body.querySelectorAll<HTMLButtonElement>("button[data-doc]"))
      b.addEventListener("click", () => {
        const url = b.dataset.doc!;
        const frame = this.body.querySelector("iframe");
        const link = this.body.querySelector<HTMLAnchorElement>("p.alt a");
        if (frame) {
          frame.src = `${url}?embed=world`;
          frame.title = b.textContent ?? "";
        }
        if (link) {
          link.href = url;
          link.textContent = `Open ${(b.textContent ?? "").toLowerCase()} as a page`;
        }
        for (const o of this.body.querySelectorAll("button[data-doc]")) o.setAttribute("aria-pressed", String(o === b));
      });
    // Keys inside a frame do not bubble to the parent dialog. Bind after
    // each same-origin page loads, and let its own widgets consume Escape
    // first; an unhandled Escape returns to the world like the Close button.
    for (const frame of this.body.querySelectorAll<HTMLIFrameElement>("iframe"))
      frame.addEventListener("load", () => {
        try {
          frame.contentWindow?.addEventListener("keydown", (e) => {
            if (e.key !== "Escape" || e.defaultPrevented || !this.open || !this.root.contains(frame)) return;
            const child = frame.contentDocument;
            // Native light-dismiss/cancel is a default action after keydown;
            // it need not set defaultPrevented. Let that child overlay close
            // on this press before returning from the parent world dialog.
            if (child?.querySelector("dialog[open]") || (CSS.supports("selector(:popover-open)") && child?.querySelector(":popover-open"))) return;
            e.preventDefault();
            e.stopPropagation();
            this.close();
          });
        } catch {
          // A page that navigated off-site remains browser-owned; the
          // parent dialog's Close button still provides the return path.
        }
      });
    this.root.hidden = false;
    this.open = true;
    this.closeBtn.focus();
  }

  /**
   * The side view of the round from the rooms' world positions (in H): a
   * box per room, brighter where you've been, marked where you are, a lamp
   * for each shrine you've lit. Only real save data; nothing is invented.
   */
  private sideMap(): string {
    const H = 80;
    const info = this.mapInfo;
    const rs = info.rooms.filter((r) => r.origin && r.w && r.h);
    if (!rs.length) return "<p>No map yet.</p>";
    const x0 = Math.min(...rs.map((r) => r.origin![0])) - 4;
    const x1 = Math.max(...rs.map((r) => r.origin![0] + r.w! / H)) + 4;
    const y1 = Math.max(...rs.map((r) => r.origin![1])) + 4;
    const y0 = Math.min(...rs.map((r) => r.origin![1] - r.h! / H)) - 4;
    const W = x1 - x0;
    const Ht = y1 - y0;
    const shrineRooms: Record<number, string> = { 1: "A4", 2: "B2", 3: "C1", 4: "D2", 5: "E1", 6: "E2" };
    const lit = new Set(info.shrines ?? []);
    const boxes = rs
      .map((r) => {
        const x = r.origin![0] - x0;
        const y = y1 - r.origin![1];
        const w = r.w! / H;
        const h = r.h! / H;
        const here = info.here === r.id;
        const seen = info.visited?.has(r.id) ?? false;
        return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${here ? "#6b5530" : seen ? "#3a3328" : "#1d1b18"}" stroke="${here ? "#e8c068" : "#6b5a44"}" stroke-width="${W / 400}"/><text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2).toFixed(1)}" font-size="${(W / 90).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="#d8ccb0">${r.id}</text></g>`;
      })
      .join("");
    const lamps = [...lit]
      .map((n) => {
        const r = rs.find((q) => q.id === shrineRooms[n]);
        if (!r) return "";
        const x = r.origin![0] - x0 + r.w! / H / 2;
        const y = y1 - r.origin![1] - W / 120;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(W / 220).toFixed(2)}" fill="#f0b060"/>`;
      })
      .join("");
    const water = `<rect x="0" y="${(y1 - 0).toFixed(1)}" width="${W.toFixed(1)}" height="${(W / 300).toFixed(2)}" fill="#2a5250"/>`;
    const names = rs.map((r) => r.label).join(", ");
    return `<svg viewBox="0 0 ${W.toFixed(1)} ${Ht.toFixed(1)}" role="img" aria-label="Side view of the round: ${names}. You are at ${rs.find((r) => r.id === info.here)?.label ?? "the route"}. Shrines lit: ${lit.size} of 6.">${water}${boxes}${lamps}</svg><p class="alt">Shrines lit: ${lit.size} of 6.</p>`;
  }

  close(): void {
    if (!this.open) return;
    const k = this.kind!;
    this.root.hidden = true;
    this.body.innerHTML = "";
    this.open = false;
    this.kind = null;
    this.canvas.focus();
    this.onClose(k);
  }
}

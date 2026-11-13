// In-world panels: real, accessible DOM (focus moves in, Esc or the close
// button returns you to the world, focus goes back to the canvas). They call
// the website's own pages, so the world and the site show the same thing:
// donate, the archive (docs), downloads; the gallery shows one of Dex's
// pieces on its own from content/gallery/manifest.json. Nothing here fakes
// data: donor records and dex account aren't connected yet and say so.

import galleryRaw from "../../content/gallery/manifest.json?raw";

interface GalleryItem {
  id: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  widths?: number[];
}

const GALLERY = (JSON.parse(galleryRaw) as { items: GalleryItem[] }).items;

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
  /** The map panel draws the route it is given. */
  mapInfo: { rooms: { id: string; label: string }[]; here: string } = { rooms: [], here: "" };

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
      case "archive":
        title = "Archive";
        html = this.frame(SITE.archive, "Documentation");
        break;
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
    this.root.hidden = false;
    this.open = true;
    this.closeBtn.focus();
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

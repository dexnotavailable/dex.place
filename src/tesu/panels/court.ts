// The Prize Court's panels (GDK 5.1): the Prize Board (one plaque per real product, from the
// website's own downloads data, the same list /downloads/ shows), the phone warning asked in
// the board's own panel, and the note after a bout, "it's in your downloads", drawn as a slip
// of Bao's paper with the product, version, size, checksum, the docs and a plain link.

import { downloads, formatBytes, type DownloadEntry } from "../../site/data/downloads.ts";
import { prizeFor, type Prize } from "../court.ts";
import { el, type PanelSpec, type Panels } from "./panels.ts";

/**
 * Whether this is a Windows PC, from the platform (never the pointer), so iPads with a
 * trackpad and Samsung DeX still count as not-a-PC.
 */
export function isWindowsPC(): boolean {
  const uad = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uad?.platform) return uad.platform === "Windows";
  const ua = navigator.userAgent;
  return /Windows NT/.test(ua) && !/Windows Phone|Xbox/.test(ua);
}

/** Starts a file download. Call it synchronously inside the input event that earned it. */
export function startDownload(href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = href.split("/").pop() ?? "";
  a.rel = "noopener";
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
}

const link = (href: string, text: string, cls = ""): HTMLAnchorElement => {
  const a = el("a", cls, text);
  a.href = href;
  return a;
};

function facts(e: DownloadEntry): HTMLElement {
  const f = e.file;
  if (!f) return el("p", "meta", e.notes[0] ?? "");
  return el("p", "meta", `Version ${f.version} · ${formatBytes(f.bytes)} · ${f.platform}`);
}

/** The Prize Board: pick a prize, and Bao strikes the gong. */
export function prizeBoard(summon: (p: Prize) => void): PanelSpec {
  return {
    title: "The Prize Board",
    look: "board",
    body(b, panels) {
      b.append(el("p", "lede", "Pick a prize. Bao strikes the gong, its champion comes out, and your last hit brings the prize home."));
      const list = el("ul", "notices plaques");
      for (const e of downloads) {
        const prize = prizeFor(e.id);
        const li = el("li", "notice plaque");
        li.append(el("h3", "", e.name));
        // the main action first, so it shows without scrolling on a short screen
        if (prize) {
          const go = el("button", "btn big", e.installedBy ? `Install (through ${prize.owner.name})` : "Install");
          go.type = "button";
          go.addEventListener("click", () => pick(prize, b, panels, summon));
          li.append(go);
        }
        li.append(facts(e));
        if (!e.installedBy) for (const n of e.notes) li.append(el("p", "meta", n));
        list.append(li);
      }
      b.append(list);
      b.append(el("p", "foot", "Every file is also on the website below, directly: ", link("/downloads/", "Downloads"), "."));
    },
  };
}

/** A pick: on anything but a Windows PC, ask first, in the board's own panel. */
function pick(prize: Prize, b: HTMLElement, panels: Panels, summon: (p: Prize) => void): void {
  const go = (): void => {
    panels.close();
    summon(prize);
  };
  if (isWindowsPC()) return go();
  b.replaceChildren();
  b.append(el("p", "lede", "This download is PC only, continue to boss?"));
  b.append(el("p", "", `${prize.owner.name} is a ${prize.file.platform} program. The file will land in this device's downloads; open dex.place on your PC to install it.`));
  const yes = el("button", "btn big", "Yes, to the boss");
  yes.type = "button";
  yes.addEventListener("click", go);
  const no = el("button", "btn", "No");
  no.type = "button";
  no.addEventListener("click", () => panels.close());
  b.append(yes, no);
  yes.focus();
}

/** The note after the bow: a slip of Bao's paper. */
export function celebrationNote(prize: Prize): PanelSpec {
  return {
    title: "It's in your downloads",
    look: "slip",
    body(b) {
      const f = prize.file;
      b.append(el("p", "lede", `${prize.owner.name} ${f.version}, ${formatBytes(f.bytes)}.`));
      if (prize.picked.id !== prize.owner.id) {
        b.append(el("p", "", `${prize.picked.name} installs through ${prize.owner.name}: run it and pick ${prize.picked.name}.`));
      }
      if (!isWindowsPC()) b.append(el("p", "", `This file is for a ${f.platform} PC. Open dex.place on your PC to install it.`));
      const steps = prize.owner.steps ?? [];
      if (steps.length) {
        const ol = el("ol", "steps");
        for (const s of steps) ol.append(el("li", "", el("strong", "", `${s.title}:`), ` ${s.text}`));
        b.append(ol);
      }
      if (prize.owner.caveat) b.append(el("p", "meta", prize.owner.caveat));
      const sum = el("code", "sum", f.sha256);
      b.append(el("p", "meta", "SHA-256: ", sum));
      const again = link(f.href, "Download it here");
      again.download = f.href.split("/").pop() ?? "";
      const docs = prize.owner.id === "dexclient" ? [" · ", link("/docs/installing-dexclient/", "Install guide"), " · ", link("/docs/updates-and-repair/", "Updates and repair")] : [" · ", link("/docs/", "Docs")];
      b.append(el("p", "foot", "Didn't start? ", again, ...docs));
    },
  };
}

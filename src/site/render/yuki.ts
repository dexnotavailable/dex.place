// YUKI's page, /yuki/ (Dex 10-26, YUKI docs/build/PHASE2-SCOPE.md W12: "plain and useful + a real showcase once it
// exists; download button = GitHub latest release asset; after the click the page becomes the install guide
// (SmartScreen "More info -> Run anyway"); optional live link where YUKI answers a status ping"). It belongs to
// Downloads. Styles: styles/yuki.css; motion: motion/yuki.ts (own chunk).
//
// Top to bottom: the stage (her orb hatches and pixel Yuki says hi; the name, the line, the one key), what it is (as far
// as the release it lists has it: the hand and the deck wait for data/yuki.ts YUKI_HAND_LIVE), which
// PC gets which setup (only once a release has the first run that picks it: data/yuki.ts YUKI_TIERS_LIVE), then the
// install guide with the Windows prompt drawn out step by step and the file's checksum.
// Complete without JavaScript: the key downloads the file and the guide is simply there below it. With it, the click
// turns the page into the guide (data-stage="guide": she cheers, the page goes to the steps, step one ticks).
// Not released yet (data/downloads.ts YUKI_RELEASE null): she is asleep, there is no file link, the guide still reads.

import { downloads, formatBytes, type DownloadEntry, type DownloadFile } from "../data/downloads.ts";
import { YUKI_FACTS, YUKI_HAND, YUKI_HAND_LIVE, YUKI_LINE, YUKI_LINK, YUKI_NEEDS, YUKI_TIERS, YUKI_TIERS_LIVE, YUKI_TIERS_NOTE } from "../data/yuki.ts";
import { yukiSprite } from "../yuki-sprite.ts";
import { fileName, verifyBlock, waysList } from "./downloads.ts";
import { button, chip, icon, tile } from "./glyphs.ts";
import { cx, esc, pad2 } from "./html.ts";
import { snowLayer, yukiStage, yukiTileOr as tileOr, type StageOptions } from "./yukiart.ts";

/** YUKI's download entry (always there; its file only once released). */
export const yukiDownload = (): DownloadEntry => downloads.find((d) => d.id === "yuki") as DownloadEntry;

/** What she says on the stage, by state (a real character's small voice, CANON "Brand and words"). */
export const YUKI_SAYS = {
  ready: "hi! i'm Yuki.",
  none: "zz... not out yet.",
  guide: "open it when it lands!",
} as const;

// ------------------------------------------------------------------ the stage

function hero(f: DownloadFile | null): string {
  const crumbs =
    `<div class="dh__kicker ykh__kicker">${tile("download", "cyan", "s")}<span class="dh__slash" aria-hidden="true">//</span>` +
    `<nav class="dh__crumbs" aria-label="Breadcrumb"><a href="/downloads/">Downloads</a></nav>` +
    `<span class="dh__rule" aria-hidden="true"></span><span class="dh__aside">Windows</span></div>`;
  const chips = [chip("Windows", "key"), ...(f ? [chip(`v${f.version}`, "value"), chip(formatBytes(f.bytes), "value")] : [])].join("");
  const acts = f
    ? button({
        href: f.href, label: "Download", icon: "download", tone: "mint", size: "l", download: true,
        className: "btn--dl ykh__dl", ariaLabel: `Download YUKI ${f.version} for ${f.platform}, ${formatBytes(f.bytes)}`,
      }) + button({ href: "#install", label: "Install guide", icon: "arrow-down", size: "l", className: "ykh__guide" })
    : `<p class="ykh__soon"><span class="dl-state__dot" aria-hidden="true"></span>No public download yet</p>` +
      button({ href: "#install", label: "How installing works", icon: "arrow-down", size: "m", className: "ykh__guide" });
  const say = f ? YUKI_SAYS.ready : YUKI_SAYS.none;
  const stage: StageOptions = { cols: 72, rows: 50, seed: "yuki-page", yuki: { eyes: f ? "open" : "asleep", mouth: "small" }, shards: 6, at: { lift: 0 }, hatch: true };
  return (
    `<header class="ykh" aria-labelledby="page-title">` +
    `<span class="ykh__plate" aria-hidden="true"></span>` +
    `<div class="ykh__box">` +
    `<div class="ykh__stage" data-yuki-stage aria-hidden="true">` +
    // her night, the snow falling behind her, then her (and the hatch's flash and pixels in front of her)
    `<div class="ykh__art" data-hatch>` +
    yukiStage({ ...stage, layer: "back" }) +
    snowLayer("yuki-page", 72, 50, 22) +
    yukiStage({ ...stage, layer: "her" }) +
    `</div>` +
    `<p class="ykh__say" data-yuki-say><span data-yuki-line>${esc(say)}</span></p>` +
    `</div>` +
    `<div class="ykh__text">` +
    crumbs +
    `<h1 class="ykh__title" id="page-title">YUKI</h1>` +
    `<p class="ykh__line">${esc(YUKI_LINE)}</p>` +
    `<p class="chips ykh__chips">${chips}</p>` +
    `<div class="ykh__acts">${acts}</div>` +
    (f ? `<p class="ykh__file"><code>${esc(fileName(f))}</code> · from GitHub · <a class="link" href="#yuki-verify">SHA-256</a></p>` : "") +
    // after the Download click (motion/yuki.ts): one plain line, read out once
    (f ? `<p class="ykh__after" data-yuki-after role="status"></p>` : "") +
    `</div>` +
    `</div>` +
    `</header>`
  );
}

// ------------------------------------------------------------------ what it is

function what(hand: boolean): string {
  const facts = hand ? [...YUKI_FACTS.slice(0, 2), YUKI_HAND, ...YUKI_FACTS.slice(2)] : YUKI_FACTS;
  return (
    `<section class="yks yks--what" aria-labelledby="yk-what">` +
    `<h2 class="yks__h" id="yk-what">${tile("star", "cyan", "s")}<span>What she does</span></h2>` +
    `<ul class="ykfacts">` +
    facts.map((x, i) =>
      `<li class="ykfact" data-reveal="pop" style="--i:${i}">${tileOr(x.icon, i === 0 ? "cyan" : "paper", "m", `fact-${i}`)}` +
      `<h3 class="ykfact__t">${esc(x.title)}</h3><p class="ykfact__p">${esc(x.text)}</p></li>`,
    ).join("") +
    `</ul></section>`
  );
}

// ------------------------------------------------------------------ the tiers

function tiers(): string {
  return (
    `<section class="yks yks--tiers" aria-labelledby="yk-tiers">` +
    `<h2 class="yks__h" id="yk-tiers">${tile("grid", "cyan", "s")}<span>Your PC, your setup</span>` +
    `<span class="sub__aside">${pad2(YUKI_TIERS.length)} tiers</span></h2>` +
    `<ol class="yktiers">` +
    YUKI_TIERS.map((t, i) =>
      `<li class="yktier yktier--${t.tone}" data-reveal="pop" style="--i:${i}">` +
      `<span class="yktier__rank" aria-hidden="true">${esc(t.rank)}</span>` +
      `<h3 class="yktier__name"><span class="sr">${esc(t.rank)} tier: </span>${esc(t.name)}</h3>` +
      `<p class="yktier__pc">${esc(t.pc)}</p>` +
      `<p class="yktier__gets">${icon("arrow", 2)}<span>${esc(t.gets)}</span></p></li>`,
    ).join("") +
    `</ol>` +
    `<p class="yks__note">${icon("info", 2)}<span>${esc(YUKI_TIERS_NOTE)}</span></p>` +
    `</section>`
  );
}

// ------------------------------------------------------------------ the Windows prompt

/**
 * The Windows prompt an unsigned installer gets (SmartScreen), drawn in code, both of its faces: the first ("More
 * info") and the opened one ("Run anyway"). A pixel cursor taps each in turn (styles/yuki.css, while in view), and a
 * small Yuki says why. Only the words a visitor has to find are written out; the rest are lines. Each cursor sits
 * inside the word or button it taps, so its tip stays on it at any width (the buttons move as the window narrows).
 */
export function smartScreen(file: string | null): string {
  const lines = (n: number): string => `<span class="ss__lines" aria-hidden="true">${Array.from({ length: n }, () => "<i></i>").join("")}</span>`;
  const cursor = (cls: string): string => `<span class="ss__cursor ${cls}" aria-hidden="true">${icon("cursor", 3)}<i class="ss__tap"></i></span>`;
  return (
    `<figure class="ss" data-ss aria-labelledby="ss-cap">` +
    `<div class="ss__pair">` +
    `<div class="ss__win ss__win--a">` +
    `<p class="ss__no" aria-hidden="true">1</p>` +
    `<p class="ss__title">Windows protected your PC</p>` + lines(3) +
    `<p class="ss__more"><span class="ss__target">More info${cursor("ss__cursor--a")}</span></p>` +
    `<p class="ss__btns"><span class="ss__btn">Don't run</span></p>` +
    `</div>` +
    `<span class="ss__arrow" aria-hidden="true">${icon("arrow", 3)}</span>` +
    `<div class="ss__win ss__win--b">` +
    `<p class="ss__no" aria-hidden="true">2</p>` +
    `<p class="ss__title">Windows protected your PC</p>` + lines(2) +
    `<p class="ss__app">App: <span>${esc(file ?? "YUKI-Setup.exe")}</span><br>Publisher: <span>Unknown publisher</span></p>` +
    `<p class="ss__btns"><span class="ss__btn ss__btn--go ss__target">Run anyway${cursor("ss__cursor--b")}</span><span class="ss__btn">Don't run</span></p>` +
    `</div>` +
    `</div>` +
    `<figcaption class="ss__cap" id="ss-cap"><span class="ss__peek" aria-hidden="true">${yukiSprite({ scale: 2, eyes: "happy", mouth: "smile", className: "ss__yuki", seed: "ss-peek" })}</span>` +
    `<span><b>Click More info, then Run anyway.</b> Windows doesn't know YUKI yet because the installer isn't signed; it asks once, the first time.</span></figcaption>` +
    `</figure>`
  );
}

// ------------------------------------------------------------------ the install guide

function install(d: DownloadEntry, f: DownloadFile | null): string {
  const steps = d.steps ?? [];
  return (
    `<section class="yks yks--install" id="install" aria-labelledby="yk-install" tabindex="-1">` +
    `<h2 class="yks__h" id="yk-install">${tile("check", "mint", "s")}<span>Install YUKI</span>` +
    `<span class="sub__aside">${pad2(steps.length)} steps</span></h2>` +
    `<p class="yks__note yks__note--needs">${icon("window", 2)}<span>${esc(YUKI_NEEDS)}</span></p>` +
    `<ol class="yksteps">` +
    steps.map((s, i) =>
      `<li class="ykstep" data-step="${i + 1}">` +
      `<span class="ykstep__no" aria-hidden="true">${pad2(i + 1)}<i class="ykstep__tick">${icon("check", 2)}</i></span>` +
      `<div class="ykstep__body"><h3 class="ykstep__t">${tileOr(s.icon, i % 2 ? "yellow" : "mint", "s", `step-${i}`)}<span>${esc(s.title)}</span></h3>` +
      `<p class="ykstep__p">${esc(s.text)}</p>` +
      waysList(s, "ykstep__ways") +
      (i === 1 ? smartScreen(f ? fileName(f) : null) : "") +
      `</div></li>`,
    ).join("") +
    `</ol>` +
    (d.caveat ? `<p class="dlg__caveat">${icon("warn", 2)}<span>${esc(d.caveat)}</span></p>` : "") +
    (f ? verifyBlock(d, f, 2) : `<p class="yks__note">${icon("info", 2)}<span>The file, its size and its SHA-256 show here once the first release is out.</span></p>`) +
    // the live link (data/yuki.ts YUKI_LINK): only in the page when it is switched on
    (YUKI_LINK.enabled && f
      ? `<div class="yklink" data-yuki-link data-base="${esc(YUKI_LINK.base)}" data-path="${esc(YUKI_LINK.path)}" hidden>` +
        `<span class="yklink__dot" aria-hidden="true"></span><p class="yklink__text" data-yuki-link-text role="status"></p></div>`
      : "") +
    `</section>`
  );
}

/** The whole page. `d`: YUKI's download entry (a test passes one for a release); `o.tiers`: the tiers section; `o.hand`:
 *  the hand and the deck among what she does (data/yuki.ts YUKI_HAND_LIVE). */
export function yukiPage(d: DownloadEntry = yukiDownload(), o: { tiers?: boolean; hand?: boolean } = {}): string {
  const f = d.file;
  return (
    `<div class="${cx("page page--yuki", !f && "page--yuki-none")}" data-yuki-page data-stage="start" data-release="${f ? "ready" : "none"}"` +
    ` data-say-guide="${esc(YUKI_SAYS.guide)}">` +
    `<div class="wrap">` +
    hero(f) +
    what(o.hand ?? YUKI_HAND_LIVE) +
    ((o.tiers ?? YUKI_TIERS_LIVE) ? tiers() : "") +
    install(d, f) +
    `</div></div>`
  );
}

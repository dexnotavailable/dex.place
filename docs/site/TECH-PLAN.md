# dex.place website: technical plan

The website that takes over when you scroll past the world. This page records what was
checked, what was decided and why, and what still needs Dex. Research date: 2026-09-29.
`CANON.md` and Dex's newest words win over anything here.

## The short version

- **Build it as plain Vite pages plus one small build plugin, not Astro.** The plugin turns
  markdown and data files into real prerendered HTML pages. A throwaway prototype on this
  repo's exact Vite (8.3.1) produced `/docs/<slug>/` pages in both `vite build` and the dev
  server, next to a `/lab/` page, with hashed CSS and JS in each one. Astro would force the
  lab and scenes pages (owned by other work) into its own page system, and its type checker
  doesn't support this repo's TypeScript 7.
- **Page-to-page animation comes from the browser, not from a JS router.** One CSS rule
  (`@view-transition { navigation: auto }`) morphs between pages on Samsung Internet 28+ and
  iPad Safari 18.2+. Both of Dex's review browsers are past those versions today (Samsung
  Internet 30, iPadOS 27). Firefox just navigates normally.
- **The donation QR is solved and tested.** `src/site/vietqr.ts` builds the bank payload.
  For every amount the old site could make, it matches the old code, which Dex checked in
  his MB Bank app, character for character. At 0 VND it makes a "no amount" code, so the
  banking app asks how much. `src/site/qr.ts` turns that into a crisp SVG. It uses the
  `lean-qr` library (about 3.7 kB gzipped), and the whole donate QR code adds about 4.8 kB
  gzipped. Tests read every generated QR back with a decoder. So did screenshots from real
  WebKit (the engine behind iPad Safari) and Edge: 48 of 48 decoded to the right payload.
- **`/downloads/` needs a six-line change to the ops server.** Today that server sends every
  `/downloads/...` request to the installer folder, so a page at `/downloads/` can only ever
  get a 404. The change: serve the file if the folder has it, otherwise hand the request to
  the build. The exact diff and its tests are below. Nothing in `ops/` has been changed.
- **The inventory has four surprises.** The gallery has **9** pieces, not 10. The public
  dexClient file is the July 0.1.0 build, and newer 0.4.x setups exist but aren't
  published. dexCode has no public download. The old documentation editions are internal
  specs for the old site, not docs for visitors.

## 1. VietQR: what the old code makes, and what the new module does

### The old generator

`legacy/site/src/worldsite/sections/Donate.tsx` exports `vietQrPayload(amount)`.
(`content/index.ts` only holds documentation text about it, and `pages.tsx` re-exports it.)
It builds an EMVCo "merchant-presented" QR string: a chain of fields, each written as a
two-digit tag, a two-digit length and the value.

| Tag | Value | Meaning |
|---|---|---|
| `00` | `01` | payload format |
| `01` | `12` **always** | point of initiation: `12` = dynamic (carries an amount) |
| `38` | template below | merchant account info, VietQR layout |
| `38/00` | `A000000727` | NAPAS ID |
| `38/01/00` | `970422` | MB Bank's BIN (bank ID number) |
| `38/01/01` | `0585739325` | account number (a string, so the leading 0 stays) |
| `38/02` | `QRIBFTTA` | service: NAPAS 247 transfer to an account |
| `53` | `704` | currency: VND (ISO 4217) |
| `54` | `String(amount)` **always** | amount in whole VND |
| `58` | `VN` | country |
| `62/08` | `dex support` | transfer note ("purpose of transaction") |
| `63` | 4 hex digits | CRC-16/CCITT-FALSE over everything before it, `6304` included, uppercase |

It sets no merchant name or city (tags 59/60). The banking app looks up the account
holder's name itself. That's normal for VietQR person-to-person codes, and it's the form Dex
confirmed on 2026-09-07: MB Bank, `0585739325`, THIEU GIA MINH, 100,000 VND. That check was
display only, with no transfer. It rendered the QR with the npm `qrcode` package at error
correction M.

**The old code never handled 0.** Its slider started at 100,000. Called with 0, it would
have produced a dynamic code with an amount of zero (`01`=`12`, `54`=`0`), which is not "no
amount". So "tag 54 only above 0, and 11 vs 12" is new behaviour this module adds. It isn't
something to copy from the old code.

### The new module: `src/site/vietqr.ts`

- `vietQrPayload(amount)` takes a whole number of VND from 0 to 10,000,000.
  - **Above 0:** exactly the old layout (`01`=`12`, tag `54` present). A test compares all
    991 slider amounts the old site allowed (100,000 to 10,000,000 in steps of 10,000),
    plus a few odd amounts, against a verbatim copy of the old function. They're equal
    character for character.
  - **0:** the static form. `01` is `11` and there is no tag `54`. Everything else stays the
    same, including the note, and the CRC is recomputed. The test builds this from the old
    output by making exactly those two edits.
  - Anything else throws a `RangeError`: negative, fractional, NaN, or over 10,000,000.
- The module also exports `crc16` (checked against the standard test value
  `"123456789"` → `29B1`), `tlv`, `isDonationAmount`, `MB_BANK` (bank, BIN, account,
  holder), `TRANSFER_NOTE`, `MIN_VND` and `MAX_VND`.
- It has no DOM and no dependencies, so the same code runs in the browser, at build time
  (to put the default QR into the HTML) and under `node --test`.

Pinned outputs (also written into the tests as golden values):

```text
0          00020101021138540010A00000072701240006970422011005857393250208QRIBFTTA53037045802VN62150811dex support6304BA1A
100000     00020101021238540010A00000072701240006970422011005857393250208QRIBFTTA530370454061000005802VN62150811dex support630480C7
10000000   00020101021238540010A00000072701240006970422011005857393250208QRIBFTTA53037045408100000005802VN62150811dex support6304FE96
```

The 100,000 line is identical to what the old generator gives for the code Dex checked.

### QR encoder: `lean-qr`

These are the bundle sizes for encoding one string, minified and bundled with esbuild:

| Package | License | Min | Gzip | Notes |
|---|---|---|---|---|
| **lean-qr 2.7.4** (chosen) | MIT | 6.9 kB | **3.7 kB** | no dependencies, ESM, types included, gives the module grid, updated Sep 2026 |
| lean-qr/nano | MIT | 3.8 kB | 2.1 kB | fewer options; fine too, but the full build costs only 1.6 kB more |
| uqr 0.1.3 | MIT | 10.2 kB | 3.9 kB | good, but one release since 2023 |
| qrcode-generator 2.0.4 | MIT | 20.9 kB | 7.6 kB | |
| qrcode 1.5.4 (the old site's) | MIT | 24.9 kB | 9.6 kB | pulls in dijkstrajs |

`src/site/qr.ts` wraps it:

- `qrGrid(text)` encodes at error correction **M or higher**. lean-qr raises the level when
  the same code size has room for it, which only helps scanning.
- `qrPath(grid)` turns the dark squares into one SVG path, one rectangle per horizontal run.
- `qrSvg(text, { quiet, dark, light, label })` gives a standalone SVG with the standard
  4-module light border and crisp edges. With a label it has `role="img"`; without one it's
  hidden from screen readers.

All three amounts above encode as QR version 5 (37×37 modules). The SVG is about 5 kB of
inline markup. lean-qr mixes numeric, alphanumeric and byte segments to keep the code small.
The old `qrcode` package did the same, and any standard reader handles it. The whole
browser-side donate QR code (payload + SVG + lean-qr) is **8.9 kB minified, 4.8 kB gzipped**.

### How it was verified

- `npm test` runs `node --test "src/site/*.test.mjs"`. Node 24 strips the TypeScript types
  itself, so there's no build step. Result: 8 tests pass.
  - Golden payloads, equality with the old generator, and the 0 VND static form.
  - The field structure is re-parsed tag by tag, including the nested `38` and `62`.
  - Bad amounts are rejected.
  - **Decoding.** For 0, 100k, 250k, 1m, 4.56m and 10m VND, the code is drawn to pixels and
    read back with **jsQR 1.4.0** (Apache-2.0, dev dependency only). This is done twice:
    once from the module grid and once from the SVG path the page will show. Each read has
    to equal the payload exactly.
- **Real browsers** (a scratch script, not a repo test):
  - The engines: Playwright-core 1.62.0, which matches the installed `webkit-2336` in
    `D:\Dex\Tools\playwright-browsers`, drove WebKit. Chromium ran through the `msedge`
    channel.
  - The render: each QR in the site's near-black on off-white (`#14121a` on `#fffdf5`) at
    148, 211 and 264 CSS px, at 1× and 2× pixel density, for 4 amounts.
  - The check: each render was screenshotted and decoded with jsQR. **48/48 decoded to the
    exact payload.**
- `npm run check` (tsc 7) passes with the new files. A `vite build` into a scratch folder
  still produces `index.html` and `lab/`.

### What Dex still needs to check (no transfer, just scan and look)

1. The **0 VND** code in the MB Bank app. It should show MB Bank, `0585739325` and
   THIEU GIA MINH, with no amount filled in. This static form has never been checked in a
   banking app.
2. One slider amount other than 100,000, for example 1,000,000.
3. Both on Samsung Internet (Android) and iPad Safari, by camera scan and by saving the
   image and importing it into the app. The 2026-09-07 check didn't say which method it
   used.

### Donate page notes for the builder

- **Without JS**, the page still shows the 0 VND QR, the bank, account and holder, and the
  Ko-fi link (`https://ko-fi.com/dexdonation`, a plain link with no embed). The QR is
  rendered into the HTML at build time.
- **With JS**, the slider (0 to 10,000,000 VND) redraws the QR on every change. Payload
  plus SVG took 0.33 ms per code on Dex's PC in Node, so drawing needs no debounce; do it
  once per animation frame. Screen-reader announcements should be debounced.
- The slider should not be linear. Suggested stops: 0 · 100k · 500k · 1m · 5m · 10m at
  equal distances along the track. Round to 10,000 below 1m and 100,000 above. Snap the
  left end to exactly 0.
- Keyboard use: arrow keys and Page Up/Down, plus Home/End. The label should read
  `aria-valuetext="1,000,000 VND"`. A plain number field sits next to the slider for exact
  amounts.
- "Save QR" draws the SVG onto a canvas with a white border and saves it as a PNG. Keep the
  QR dark on light and never inverted, because some bank scanners fail on light-on-dark
  codes.
- Always show THIEU GIA MINH as the account holder. The page can say something like
  "donate dex" in its heading, but not in the account-holder field.
- **Canon update needed.** `CANON.md` says the slider runs "from 100,000 to 10,000,000
  VND". Dex's newest brief says 0 to 10 million, with the plain bank QR (no amount) as the
  default. Update that line when the donate page lands.

## 2. Content inventory

### Gallery: 9 pieces (not 10)

The source is `legacy/site/public/content/illustrations/`: `manifest.json` (9 items), the
`display-exports.json` processing record, and 9 `-display.webp` plus 9 `-thumbnail.webp`
files. The processing record says: "aspect-preserving Lanczos downscale; lossless WebP; no
crop or recolor". The old registry's `art-content.json` also has 9, and the old docs say "all
nine gallery records". The originals folder `D:\Dex\Media\Images\Inbox` is a mixed inbox
(`.clip` project files, other artists' images and references), so it's not a source to pull
from without Dex.

| # | Current id | Shape | Display | Thumb |
|---|---|---|---|---|
| 0 | shot-18-2 | 2048×1152 (16:9) | 812 kB | 80 kB |
| 1 | shot-23 | 2048×1152 | 1,039 kB | 113 kB |
| 2 | inshot-20260620-… | 2048×1152 | 1,659 kB | 176 kB |
| 3 | inshot-20260826-… | 2048×1152 | 662 kB | 101 kB |
| 4 | inshot-20260721-… | 2048×1152 | 1,819 kB | 195 kB |
| 5 | inshot-20260708-060051952 | 1366×2048 (2:3) | 441 kB | 72 kB |
| 6 | inshot-20260708-055457338 | 1151×2048 (~9:16) | 354 kB | 51 kB |
| 7 | kaizen | 1152×2048 (9:16) | 394 kB | 55 kB |
| 8 | towaki | 1152×2048 (9:16) | 942 kB | 131 kB |

That's 5 landscape and 4 portrait pieces, which suits a collage. Thumbnails total 0.97 MB and
display files 8.1 MB. Every item has width, height and alt text, so the layout can reserve
exact space (no layout shift) and stays accessible.

- **"Don't name them":** no visible titles. But the current ids and file names carry names
  (`kaizen`, `towaki`, `shot_23`), and those would show in URLs and image paths. Copy the
  files to neutral names (for example `art-01.webp`) and use neutral page URLs
  (`/gallery/1/` or a short hash). Keep the alt text. The ids are an open question below.
- Copying the files into the new site costs nothing in repo size. They're already tracked in
  git, and git stores identical content once.
- The thumbnails are lossless and 512 px on the long side. That's fine for a collage tile
  up to about 256 CSS px on a 2× screen. A tile that grows bigger on hover will need the
  display file, or a new mid-size (~1024 px) export. A lossy mid-size export would be a new
  treatment of Dex's art, so ask first.
- Display only. Never reuse these images as decoration, backgrounds or placeholders
  anywhere else on the site (`CANON.md`, Illustrations).

### Project facts (read-only sources, summarized, nothing invented)

Order on the landing: dexCode, dexClient, dex.place.

- **dexCode.** The product canon
  (`D:\Dex\Temp\dexcode-tool-runtime-parity-20260830\docs\product-canon.md` §2) says it's
  "a Windows desktop app that runs a Codex- or Claude-Code-class AI agent entirely on your
  own PC". Yuki is its companion. A safe one-liner: *a Windows app that runs an AI agent on
  your own PC.*
  - Don't write "uncensored" or NSFW on the site (DL-20260922-09).
  - Don't describe Yuki's personality: that wording isn't approved (canon §4).
  - No taglines (canon §4, which reuses dex.place's rule).
  - The README's first paragraph dates from 2026-08-22 and loses to the canon where they
    differ.
  - The canon's current state: C33b/C35 builds, installed through dexClient 0.4.5 on Dex's
    PC, with "No current public download".
- **dexClient.** Its README (`D:\Dex\Projects\dexClient\README.md`) calls it "the
  launcher and installer for dexCode". It checks your PC, installs dexCode and keeps it up
  to date. It's a per-user Windows installer, needs no admin, and is **unsigned**, so
  Windows warns once. A safe one-liner: *the launcher and installer for dexCode.* That
  README describes 0.4.x, though. The public file is 0.1.0 (see Downloads), so check with
  Dex before stating behaviour.
- **dex.place.** `CANON.md` says it's Dex's home for his projects: downloads and installs,
  documentation, his illustrations, and donations. This site.

Project imagery: placeholders for now, drawn in code (pixel grids or SVG shapes). Mark them
`placeholder: true` in the project data so they're easy to find and replace. No generated
images, and none of Dex's art.

### Downloads (what is real)

| File | Bytes | SHA-256 | State |
|---|---|---|---|
| `/downloads/dexClient-Setup-0.1.0.exe` | 665,563,123 | `2b4bbf33…8e22` | live. Hashed on disk today and matches the `.sha256` sidecar and the dexCode README's recorded setup hash. Live headers checked: `200`, attachment, `private, no-store`, ranges. Built 2026-07-24, unsigned (README: "Authenticode remains NotSigned"). Windows x64. |
| dexCode | none | n/a | No standalone public download (dexCode canon). Show that honestly, for example "no public download yet". Whether "installed through dexClient" is true of the 0.1.0 file is a question for Dex. |

- `src/downloads.ts` already lists only dexClient 0.1.0 (commit `4b787cd`). The downloads
  folder also holds `Hoshikawa-Haven-Brand-v1.zip` and a dexSMP Fabric installer. Both are
  deliberately not listed.
- Newer setups sit in `D:\Dex\Releases\dexClient`, from 0.4.0 up to 0.4.6, about 100 MB
  each. They're bootstrappers that fetch dexCode from `updates.dex.place`. None is on
  dex.place. Publishing one is Dex's call, and it isn't part of this website work.

### Documentation and blog seeds

- The old documentation editions (`legacy/site/public/content/documentation/v1.0`, `v1.1`,
  and the ZIPs in `legacy/site/public/files/`) are the old site's design specifications.
  They cover world, audio, QA gates and so on: agent-written, long, and about building the
  site, not using the products. `legacy/` is never served (`CANON.md`). **Don't seed
  `/docs` with them.**
- Real visitor-facing material exists only for dexClient: `docs/TESTERS.md` in the
  dexClient repo. It's a clear install walkthrough covering SmartScreen, "Run anyway",
  antivirus and uninstall. But it's written for 0.4.0 testers ("the link Dex sent you"), so
  it only fits once a 0.4.x setup is public.
- Seed with **clearly marked placeholders** that Dex replaces: frontmatter
  `placeholder: true`, a visible "placeholder" tag, and `noindex`. For example: docs
  "Installing dexClient", "dexCode" and "About dex.place"; one blog post "First post". Each
  has a title and a one-line "to be written" body, and no invented facts.

### The `/downloads/` route (ops)

- **What happens now.** In `ops/server.mjs` `route()`, any path starting with
  `/downloads` is looked up in the downloads folder only. `/downloads` and `/downloads/` (no
  file name) go straight to 404. A missing file gives 404 without ever looking at the
  build. Live check today: `https://dex.place/downloads/` → 404.
- **Proposed minimal change** (not applied). Serve a real file from the downloads folder
  when it exists there; otherwise fall through to the normal build handling:

```diff
   if (parsed.segments[0] === 'downloads') {
     const rest = parsed.segments.slice(1);
     const found = rest.length && rest[rest.length - 1] !== ''
       ? await resolveFile(ctx.downloadsDir, rest, false)
       : null;
-    if (!found) { await notFound(ctx, req, res, root); return; }
-    await sendFile(req, res, found, {
-      cache: CACHE.download,
-      conditional: false,
-      disposition: contentDisposition(path.basename(found.file)),
-    });
-    return;
+    if (found) {
+      await sendFile(req, res, found, {
+        cache: CACHE.download,
+        conditional: false,
+        disposition: contentDisposition(path.basename(found.file)),
+      });
+      return;
+    }
+    // Not a published file (for example the /downloads/ page itself): the build answers.
   }
```

- **Tests to add** in `ops/test/ops.test.mjs` (fixture: `dist/downloads/index.html` and a
  decoy `dist/downloads/setup.exe`):
  - `/downloads/` and `/downloads` return the page: 200, `text/html`, `no-cache, no-transform`.
  - `/downloads/setup.exe` still returns the downloads-folder bytes as an attachment with
    `private, no-store`. The folder wins over the build.
  - `/downloads/nope.exe` returns the build's 404 page.
  - The existing traversal and dotfile cases still give 404.
  - Run: `node --test ops/test/ops.test.mjs`. It takes 3–4 minutes and needs git.
- **Side effects.**
  - A commit that touches `ops/` runs the puller's extra ops checks, and the origin
    restarts once, which leaves about 2 s with no server (`ops/README.md`).
  - If a file named `index.html` is ever put in the downloads folder, it would be served
    at `/downloads/index.html` as an attachment.
  - Update `ops/README.md`'s Downloads section in the same change.
- **Alternative with no ops change:** put the page at another URL, such as `/get/`. That's
  worse: `/downloads/` is where people will look, and where the file links already live.
  **Recommendation:** make the ops change.

## 3. Architecture

### Compared

| | Vite pages + build plugin (recommended) | Astro 7.3.5 | 11ty + Vite |
|---|---|---|---|
| One `npm run build` → `dist/` incl. `dist/index.html` | yes (as today) | yes | two builds to orchestrate |
| `/lab/` and later `/scenes/` (plain HTML + TS entries owned by other workflows) | unchanged: they stay Vite inputs | must be ported into `src/pages` or prebuilt into `public/`. Astro has no arbitrary HTML inputs | separate Vite build merged by hand |
| Prerendered HTML, readable without JS | yes (build plugin) | yes | yes |
| Cross-page transitions | native CSS `@view-transition` | same native CSS; its optional JS router is unneeded on the target browsers | native CSS |
| JS shipped | only what we write | ~0 by default | only what we write |
| Toolchain fit | already installed; would add one build-time dev dependency (`marked`) | Vite ^8.0.13 (ok), 53 direct deps, telemetry on by default; `@astrojs/check` needs TypeScript 5 or 6, but the repo is on **7.0.2** | a second templating language |
| For agents | HTML templates + TS modules + markdown; one plugin file to read | `.astro` syntax and conventions to learn | Nunjucks/Liquid + two configs |

**Decision: Vite pages + one build plugin.** It builds everything in one pass, doesn't touch
the other workflows' pages, ships nothing we don't write, and there's one plugin file to
understand.

### How the plugin works (proved in a throwaway prototype)

The prototype lives at `D:\Dex\Temp\dexplace-site-research\proto` and is not part of the
repo. Its `vite.config.ts` is about 50 lines.

1. **Templates are Vite inputs.** An HTML template (for example
   `src/site/pages/page.html`) is listed in `build.rolldownOptions.input` beside `main`
   and `lab`. Vite processes it like any page: CSS and JS get hashed and linked.
2. **Pages are cloned from the processed template.** In `generateBundle` (with
   `enforce: "post"`), the plugin reads the processed template from the bundle and fills
   its slots (`<!--title-->`, `<!--body-->` and so on). It then emits one HTML file per
   page with `this.emitFile({ type: "asset", fileName: "docs/<slug>/index.html" })` and
   deletes the template from the bundle. `fileName` sets the URL freely, so no top-level
   page folders are needed. That matters because the repo's own `docs/` folder is internal
   documentation and must not become a page folder.
3. **Dev server.** A `configureServer` middleware matches the page URLs, fills the raw
   template, runs it through `server.transformIndexHtml`, and serves it. `appType: "mpa"`
   keeps unknown URLs as real 404s.
4. **The root page** (`index.html`, the world plus the website) keeps its role and gets its
   shared header, footer and prerendered sections through `transformIndexHtml` markers. The
   existing `<!--downloads-->` prerender already works this way.

Prototype result, Vite 8.3.1: `vite build` gave `dist/index.html`, `dist/lab/index.html`,
`dist/docs/faq/index.html` and `dist/docs/install/index.html`. Each generated page linked
the hashed `/assets/main-*.css` and `/assets/main-*.js`, and the template file wasn't in
`dist`. In dev, `/`, `/lab/` and `/docs/install/` returned 200; `/docs/nope/` returned 404.

Markdown: `marked` 18 (MIT, no dependencies, build-time only, so it adds nothing to the
site's JS). Frontmatter is a tiny `key: value` reader, with no YAML library. Headings get
`id`s for deep links, and docs get a small table of contents.

### Proposed layout

```text
index.html                      root: world mount + website (Vite input "main", as today)
src/site/pages/page.html        shared page template (Vite input, removed from dist)
src/site/build/                 build plugin: pages, markdown, prerendered QR, pixel icons
src/site/data/projects.ts       landing projects (typed; placeholder images flagged)
src/site/data/downloads.ts      move of src/downloads.ts
src/site/vietqr.ts, qr.ts       done (this research)
src/site/pixels.ts              pixel grid (rows of palette keys) -> SVG path per colour
src/site/main.ts                shared browser JS: reveal-on-scroll, nav, transitions
src/site/donate.ts, gallery.ts  page JS, dynamically imported only where needed
src/site/styles/*.css
content/docs/*.md, content/blog/*.md
content/gallery/manifest.json + art-NN-*.webp (neutral names)
```

`vite.config.ts`: read it, change it, write it back. Keep `main` and `lab` (and `scenes`
once another workflow adds it). Add the template input and the site plugin. Replace
`prerenderDownloads` with the site plugin's root markers. Keep `appType: "mpa"` and
`outDir: "dist"`. Consider `build.modulePreload: { polyfill: false }`: every target browser
has native modulepreload, and the polyfill costs 0.4 kB per page.

### URLs (every one a real, shareable, prerendered page)

| URL | Page |
|---|---|
| `/` | world on top (mount point), then the website: projects landing and short previews of each section |
| `/downloads/` | downloads (needs the ops change above) |
| `/gallery/`, `/gallery/<id>/` | collage; one page per piece (the no-JS path and the share link) |
| `/docs/`, `/docs/<slug>/` | documentation index and pages |
| `/blog/`, `/blog/<slug>/`, `/blog/feed.xml` | blog index, posts, feed |
| `/donate/` | Ko-fi and MB Bank |
| `/lab/`, `/scenes/` | other workflows; untouched |

### Motion and interaction: what each target browser supports

The source is MDN browser-compat-data 8.1.3. Its current versions are Samsung Internet 30
(Blink 143) and iOS/iPadOS Safari 27.

| Feature | Use | Samsung Internet | iPad Safari | Firefox | Fallback |
|---|---|---|---|---|---|
| `@view-transition { navigation: auto }` | morph between pages (for example a gallery tile → its page, via a shared `view-transition-name`) | 28+ | 18.2+ | no | normal navigation |
| `document.startViewTransition` | in-page morphs (QR swap, lightbox) | 22+ | 18+ | 144+ | plain swap / Web Animations FLIP |
| `view-transition-class`, `:active-view-transition-type` | styling groups and directions | 27+ | 18.2+ | 144+ / 147+ | none needed |
| CSS `linear()` easing | springy pop-outs | 23+ | 17.2+ | 112+ | `cubic-bezier` |
| `@starting-style`, `transition-behavior` | entry animations for popovers and menus | 24+ | 17.5+ / 17.4+ | 129+ | appears without animating |
| `popover` attribute | menus and tooltips | 23+ | 18.3+ | 125+ | `<details>` |
| `:has()` | hover one collage tile, the others shrink (CSS only) | 20+ | 15.4+ | 121+ | none |
| `animation-timeline: scroll()/view()` | scroll-linked bars and parallax | 23+ | **26+** | not shipped | IntersectionObserver + `requestAnimationFrame`, or static |
| `interpolate-size` | animate to `auto` | 28+ | **no** | no | avoid |
| `text-wrap: balance / pretty` | headings / paragraphs | 23+ / 24+ | 17.5+ / 26+ | 121+ / no | normal wrapping |

- **Reveal on scroll:** IntersectionObserver adds a class, and CSS transitions do the rest.
  It works everywhere. Content is visible by default. A tiny inline script adds the `js`
  class to `<html>`, and only `html.js` hides elements before they reveal, so no-JS
  visitors see everything.
- **Reduced motion:** wrap `@view-transition` and every movement in
  `@media (prefers-reduced-motion: no-preference)`. Under `reduce`, keep only opacity
  changes or none. Pause the floating layers and the cursor effects.
- **Cursor effects** (collage grow and shrink, parallax) run only on
  `(hover: hover) and (pointer: fine)`. They use `requestAnimationFrame`-throttled
  `pointermove`, which writes two CSS variables. Touch gets tap-to-open and the page
  transitions.
- **Floating background layers:** a few inline SVG or CSS shapes animated with
  `transform`/`translate` only. Keep them to roughly a dozen per view on phones. Don't blur
  large layers, because blur is expensive on mid-range Android GPUs.

### Pixel icons and coloured glyphs (made in code, as the canon requires)

- Icons are small pixel grids stored as data, for example `["..##..", ".#yy#."]` plus a
  palette. `src/site/pixels.ts` turns each colour into one SVG path, one rectangle per run
  (the same technique as `qrPath`). The paths are rendered at build time into inline SVG
  or a `<symbol>` sprite with `shape-rendering="crispEdges"`.
- No image files and no generation. Tests can check that each grid is rectangular and uses
  only palette keys.

### Fonts (self-hosted, no runtime network)

- **Daniel** (`public/fonts/Daniel-Regular.otf`, 64.6 kB) is for the `dex` mark only. Its
  license notice forbids distributing modified copies, so no subsetting or conversion to
  woff2. Preload it only on pages that show the mark large.
- **Pixel heading font**, from the OFL fonts on npm `@fontsource`. Latin woff2 sizes:
  Pixelify Sans 7.7 kB per weight, Silkscreen 8.4 / 7.5 kB, Tiny5 9.0 kB, Press Start 2P
  12.5 kB. Importing the `@fontsource` CSS through Vite puts hashed copies in `/assets/`.
- **Body text:** the system UI stack (0 kB) keeps long text, docs, forms and bank details
  plainly readable (`CANON.md`). If a brand sans is wanted, Space Grotesk (variable) is
  22.3 kB.

### Budgets and checks

- **JS:** at most about 12 kB gzipped shared, plus the page's own module. The donate QR
  module measured 4.8 kB gzipped. The world bundle is separate and loads only on `/`.
- **CSS:** at most about 20 kB gzipped.
- **No layout shift:**
  - every image gets `width`/`height` (the manifest has them);
  - the world mount reserves its height (`100svh`);
  - the pixel heading font uses `font-display: swap` with a metric-matched fallback;
  - Daniel keeps `block`, since it's a single short word.
- **WCAG AA:** saturated colours go behind dark text, never as text on white; for example
  acid yellow is a fill with near-black text on it. Visible focus rings. Real buttons and
  links. The slider has a text value. Alt text on every artwork.
- **Tests:**
  - `npm test` for units.
  - A Playwright script: playwright-core **1.62.0** matches the installed WebKit build;
    Chromium runs through the `msedge` channel. It checks:
    - each page with JS off (content present);
    - reduced motion;
    - 375, 768, 1024 and 1440 px widths;
    - no horizontal overflow;
    - layout shift, via a `layout-shift` observer (Chromium only).
  - Real Samsung Internet and iPad Safari checks are Dex's, reported separately from
    emulation (`CANON.md`).

### World mount contract (for the world workflow)

- `/` has a `<section id="world" data-world-mount>` above the website. Its height is
  reserved, and before the world loads it shows a still frame drawn in code (no art).
- It has a "skip to site" link as its first focusable element.
- The site sets `--world-progress` (0 to 1) on `<html>` while the user scrolls past it. The
  black bars can recede from that value. It's CSS scroll timeline where supported, and a
  `requestAnimationFrame` fallback elsewhere.
- The world is loaded with a dynamic `import()` from the root page only. It must export
  `mount(el: HTMLElement): { pause(): void; resume(): void; destroy(): void }`.
- The site calls `pause()` when the mount leaves the viewport (IntersectionObserver). Under
  reduced motion it also skips any autoplay. The website must work fully if the world fails
  to load or is absent.

## 4. Open questions for Dex

1. **Canon updates.**
   - Donate slider 0–10m, with no amount by default (CANON says 100k–10m).
   - The new sections: a projects landing, and a blog next to documentation.
   - The nav order. CANON's wayfinding priority is downloads, donate, illustrations,
     documentation. The brief lists landing, downloads, gallery, docs/blog, donate.
2. **Gallery naming and URLs.** "Gallery" (his word now) or "Illustrations" (CANON)? Page
   ids: plain numbers (`/gallery/3/`) or short hashes? Neither carries a name.
3. **Gallery is 9 pieces, not 10.** Is there a tenth to add, and from where?
4. **Downloads.** Keep dexClient **0.1.0** (July, 665 MB) as the public file, or publish a
   0.4.x setup? And is it true that the 0.1.0 installer installs dexCode, so the site can
   say so?
5. **dexCode one-liner.** Is "a Windows app that runs an AI agent on your own PC" right,
   and is anything else OK to say?
6. **The ops change** for `/downloads/`: approve it, or use another URL.
7. **Bank-app check** of the 0 VND and 1,000,000 VND codes (scan only, no transfer).

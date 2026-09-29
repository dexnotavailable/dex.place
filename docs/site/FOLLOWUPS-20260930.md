# Website follow-up candidate — September 30, 2026

Recovered `582abba` from `claude/awesome-goldberg-gh8rz4`, based on live/main `d5d21c8`.
The website commit is independent of the cloud branch's world and character commits.
PC world, character and website WIP in `D:/Dex/Projects/dex.place` was left intact.

The recovery includes 560px lossless exports, responsive caps for single-artwork pages,
desktop gallery lead caps, corresponding home-arrival preloads and named code regions.
The completion patch adds Full size links to the existing viewer and piece pages, keeps
cached previews capped when throughput is unknown, and limits automatic sharpening to
the active media source. The explicit regression pins piece `05` to the final wall tile
and counter `09 / 09`. Content, images, dark pixel composition, sharp borders, Jersey 15,
long scroll, collage interaction and viewer motion are preserved.

## Source and browser acceptance

- `npm test`: 76 passed, 0 failed. Production build and both TypeScript checks passed.
- Independent source review: two recovered gaps corrected; final review found no
  blocking source issue. This review did not launch an app or device.
- Installed external headless Brave `154.0.8037.58`, Playwright core `1.62.0`, axe-core
  `4.13.0`. Isolated D-backed browser temporary state; no Codex IAB.
- Local build served by the repository's real `ops/server.mjs` with a fixed root,
  empty isolated downloads/SP13 roots, and no production-state writes.
- Six viewport/DPR profiles: 320×740@3, 390×844@3, 768×1024@2, 820×1180@2,
  1024×1366@2 and 1440×900@1. Eight routes per profile, including `/#gallery`,
  gallery, piece `05`, code docs, downloads, donate and blog.
- No horizontal overflow or runtime/console error. Eighteen axe scans across gallery,
  piece and code-doc routes returned no violations. This is automated coverage,
  not complete accessibility certification.
- Full size opens the actual 2048px piece `05` file. Last-piece next wraps to first.
  Viewer URL/counter/full-size link follow the active piece; Esc closes and restores
  tile focus. Code regions receive keyboard focus, and real clipboard copy succeeds.
  Four routes also work with JavaScript disabled, including the direct full-size link.

## Local performance observations

One paired cold-cache run per route/profile on the same PC and browser, with 150ms RTT,
1.6Mbps down, 750kbps up and 4× CPU throttling. These are raw loopback-origin lab values;
they include no Cloudflare compression/CDN effect, field data or physical device timing.
Baseline and candidate use the same production-origin server code and separate builds.

| Route / emulated profile | Main `d5d21c8` LCP | Candidate LCP | Candidate image |
|---|---:|---:|---|
| `/gallery/05/`, phone 390×844@3 | 4144ms | 2600ms | `05-512.webp` |
| `/gallery/05/`, tablet 768×1024@2 | 11732ms | 2600ms | `05-512.webp` |
| `/gallery/05/`, desktop 1440×900@1 | 7228ms | 2604ms | `05-512.webp` |
| `/gallery/`, phone 390×844@3 | 3644ms | 3672ms | `02-512.webp` |
| `/gallery/`, tablet 768×1024@2 | 2952ms | 2696ms | `03-560.webp` |
| `/gallery/`, desktop 1440×900@1 | 3036ms | 2504ms | `01-560.webp` |

CLS was 0 in every measured run. Phone gallery loading keeps its original source choice;
the 28ms difference in one run does not establish a regression or improvement. The
2.5-second target is not proven by this raw-origin run. The tablet/desktop artwork
transfer reduction is observed, and capped slow-line detail remains available through
Full size. Delivery owns public-edge and physical Samsung Internet/iPad Safari checks.

## Evidence and integration

Local proof directory: `D:/Dex/Temp/dexplace-site-followups-20260930/review/acceptance/`.
`journeys.json` and `performance.json` contain exact conditions/results; before/after
piece and viewer PNGs preserve the authored UI baseline. Source check logs are in the
same worktree as `review-source-tests.log` and `review-source-build.log`.

Integrate the website recovery commit plus this completion commit only. Do not merge
the cloud branch wholesale: its world and character work have separate owners. No main
push, deployment, installed-product change or physical-device claim is made here.

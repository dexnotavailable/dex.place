# Browser zoom and accessibility evidence · 2026-09-08

This lane proved real browser200% zoom and repaired a monetary-context gap in the accessible donation slider. Actual Narrator speech remains untested. The initial timing constraint was superseded by Dex's explicit permission to run it; subsequent native attempts stopped on control failures, as recorded below.

## Latest native attempts

The 13:24 attempt is recorded in `narrator-attempt-1324.json`: automatic approval review rejected the isolated browser shell launch with only "blocked by policy"; later native capture disagreed with the selected window. No Narrator speech ran.

The later existing-browser attempt is recorded in `narrator-attempt-1426.json`. A dedicated public dex.place tab and its Menu worked through the Brave extension. Native window activation/capture then agreed, but selecting that observed test tab was stopped because Computer Use could not reliably determine the current browser URL for policy enforcement. Native input ended immediately; no alternate input route or Narrator launch followed. This is a control-surface blocker, not a failed website speech assertion. The required speech proof is still missing.

## Real browser zoom

A tiny ManifestV3 extension loaded only in a temporary headless Brave profile uses the documented `chrome.tabs.setZoomSettings({mode:'automatic',scope:'per-tab'})`, `setZoom(tabId,2)` and `getZoom(tabId)` APIs. It can access only the local5188 origin. The user's Brave profile and installed extensions are untouched. Chrome documents these as tab zoom controls: https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom.

`zoom-proof.json` records browser getZoom changing1→2. CSS innerWidth changes1904→952, devicePixelRatio1→2; visualViewport.scale stays1, body CSSzoom stays1 and the root font remains16px. CDP layout metrics separately report actual visualViewport.zoom2 and CSS width952. This is neither CSS/font enlargement nor pageScaleFactor/pinch emulation. `true-200-home-full.png` is the full actual compositor viewport. Default Playwright screenshot handling initially cropped to CSS dimensions after native zoom; final screenshots use `Page.captureScreenshot` without a clip and preserve the full1904×991 physical viewport.

`ax-journey.json` contains64 passing scoped checks across browser zoom1 and2, with30 AX states and matching full viewport images. It covers the optional world label and absence of image/prop-node clutter inside that world, Tab exiting gameplay capture, Menu/Settings and Motion listbox role/selection/focus, Downloads, documentation search/empty status/reader, gallery catalog/world links/viewer, donation method/amount/invalid draft/QR. Forward Tab traversals stayed inside open dialogs; long document traversal samples are bounded to36Tabs and are not claimed as every article-control permutation. No page overflow or page exceptions occurred. Browser200% uses952×495 CSS layout; content stays in its scrollable panel and close controls remain visible in inspected captures. Direct gallery links retain their meaningful names.

These are browser accessibility-tree and keyboard-layout observations, not evidence of a screen reader's speech output. Unnamed decorative Lucide icon nodes remain under some already-labelled controls; no functional claim is made that a particular screen reader suppresses their extra graphic wording.

All task-created browser contexts closed. The two isolated test profiles total approximately88.2MB and contain only this local test browsing state. An optional cleanup command, with resolved paths checked inside this proof root, was rejected by automatic approval review with only `blocked by policy` as its stated reason. The profiles remain; no alternate deletion route was attempted. This does not block the website work or invalidate the saved proof.

## Narrow source fixes

1. `Donate.tsx` retains the native nonlinear slider's0–100 value and real monetary aria-valuetext, and adds `aria-describedby="bank-current-amount"`. The referenced non-live text gives the current exact VND amount. The fresh Chromium AX probe exposed raw position0/0.6 as valuedtext even while the DOM had100,000/110,000VND. After the fix, AX description contains the correct amount. No claim is made that the browser-valuedtext discrepancy itself was repaired.
2. `WorldPreview.tsx` uses a lowercase native `fetchpriority` prop spread compatible with React18. Its loading=eager, fetchpriority=high and decoding=async behavior is unchanged; the previous React camelCase warning is gone.

Docs04 records the donation description semantics before the source change. `bank-description-check.json` has18 passing checks: initial amount, keyboard increment, unchanged committed description during an unapplied draft, Apply synchronization, live drag preview amount, drag cancellation restoration, release commit, no new live region, unchanged native positional range and exact preview attributes. No React/browser console errors were recorded in that run. `bank-ax-probe.json` preserves the original discrepancy. `final-source-hashes.json` identifies the three changed source/doc files. TypeScript passes. No ui.tsx, CSS, game, map, audio, generated content/export, server or build changes were made in this lane.

## Actual screen-reader route still available

Windows Narrator is installed at `C:/Windows/System32/Narrator.exe`, version10.0.26100.8521; registry reports Windows25H2 build26200.8875. Narrator and NVDA were not running. No NVDA installation was found in standard program paths, installed-app registry, its usual user config path or the bounded local-tools search. No installer was run.

Microsoft's current Narrator documentation provides Speech Recap with Narrator+Alt+X, including history and live transcription: https://support.microsoft.com/en-us/accessibility/windows/narrator/complete-guide-to-narrator. Its2025accessibility recap describes the last500spoken strings: https://blogs.windows.com/windowsexperience/2025/12/03/2025-a-year-in-recap-windows-accessibility/. Availability of that UI on this installed Narrator version still needs an actual owner-app check.

Once root coordinates desktop availability, the bounded proof route is: open one isolated local site window, start Narrator normally, open Speech Recap, navigate Main links and one sample from each content family through actual keyboard/screen-reader commands, capture only the new task-related recap strings for names/roles/amounts and status announcements, then close the task-owned Narrator and browser. Do not enable screen curtain, change global shortcuts/voices, install tools or collect unrelated prior speech history. Screen-reader scan/browse behavior through modal dialogs and the amount's spoken output remain the material unproven items; AX checks alone do not close them.

# V2 first impression and settled-page audit

2026-09-08. One actual five-profile first-impression pass, one desktop/phone content pass, and bounded corrections. No login, payment, microphone, public deployment or generated art was performed.

## First impression

1600×1000 desktop,390×844 coarse phone,844×390 coarse landscape,768×1024 coarse tablet and3440×1440 ultrawide each showed a selected real v11 preview while the actual game module request was held. Releasing that same request produced a ready canvas; native Enter immediately acquired movement. No personal-art requests occurred before entry. Hero feet, entry actions and ground were inside the cinematic bars; all game canvases matched their viewport dimensions.

Actual pixels were inspected in the loading/ready pairs. The small hero against the large cropped arcade/spire reads as the intended monumental pixel environment. Phone and tablet retain the vertical height relationship; compact landscape still gives a clear hero/ground line. UI size is modest and the margins remain broad. This judges first-frame composition, not every room or the complete movement/audio experience.

The first1600 capture used the1920-aspect wide plate, reprojected1777.77px wide at x−71.23. Hero/floor aligned but parallax architecture shifted roughly15–30px. Root added a real1600×1000 desktop profile. `desktop-exact-loading.png` / `desktop-exact-ready.png` now visibly align architecture, floor and hero; actual image geometry is x0/y0/1600×1000. Followup receipt records the selected `home-desktop-v11.webp`. Other profile captures did not need repetition.

## Settled pages and corrections

Downloads, MB Bank method controls, a full artwork, documentation and guest account were captured at1600×1000 and390×844. No horizontal document overflow or duplicate IDs were observed in these direct-page states. Desktop AX controls had names. Phone initially had one unnamed link in every page: the account icon's hidden text did not supply its accessible name.

Root requested three corrections after the read-only findings:

1. Added explicit `aria-label="dex account"` to the icon link. Final desktop/phone AX inspection has zero unnamed links.
2. Made sticky navigation's backing opaque. The previous translucent backing visibly showed unrelated Download/File details/treasury text through the logo/nav; final screenshots have clean navigation.
3. Replaced the unmeasured390px gallery placeholder with invisible metadata-only tiles that use the same grid, fixed media heights, title lengths and typography as the real collection. There are no image URLs or fetches in those blank tiles. Measured height remains only for individual viewer withdrawal. Visibility now observes the actual content slot below the sticky navigation, rather than the section's blank padding.

Before correction, direct desktop Docs settled with its section at y742 and article at y1037 while gallery rows occupied the screen. Final Docs settles at section y175/article y470 desktop and y170/y472 phone; both positions remain unchanged after fonts/load settle. The gallery stays inactive with zero images and zero art requests on these direct Docs landings. Entering/leaving the actual gallery still preserves its942px desktop/1265px phone height and exact footer positions5366/6102. `fix-proof.json` contains the measurements and native route/scroll verification. TypeScript passes.

## Contrast and remaining narrow note

The updated94% ivory paper veil and normal blending visibly improve form/background separation. Computed body color#4e594a at12–13px has an estimated5.04:1 ratio against base#ded5c0; labels#4e5747 at11px estimate5.18:1; reader16px#273236 estimates9.01:1. These base-color calculations supplement actual screenshot inspection; textured/composited pixels can vary and this is not a whole-page automated WCAG certification.

One remaining readable-secondary-color issue was reported to root: reader edition/TOC/Copy link text still uses#69716c at12–14px, about3.44:1 against that base. Use the stronger muted body color for those labels/controls. No redesign or extra material is needed.

The pre-fix owner receipt screenshot was opened and judged genuinely low contrast/noisy. Current shared paper/account/treasury styling was inspected, but no new owner login/fixture run occurred here; do not call an old owner screenshot current proof. The guest account repeats its section heading inside the panel, a minor hierarchy inefficiency rather than a blocked flow.

## Receipts and scope

- `capture-receipt.json`: five first-impression profiles; the attempted content continuation stopped on an overly exact MB Bank locator (`MB Bank` versus its actual `MB Bank VND` accessible name). This harness failure did not affect the five first-frame passes.
- `content-receipt.json`: corrected ten-page read-only capture/DOM/AX/computed-style pass.
- `followup-receipt.json`: exact desktop preview correction and direct-doc displacement diagnosis.
- `fix-proof.json`: final two-profile layout/no-art-fetch/AX/navigation and withdrawal verification.
- `source-handoff.json`: handed-back main/CSS hashes. Root owns refreshing preview renderer-source evidence after these UI-only changes; unchanged canvas captures do not need regeneration solely because CSS source changed.

Desktop/phone/tablet labels identify viewport contexts, not physical devices. No modal duplicate-ID matrix, final screen-reader speech, audio taste or public TLS/service acceptance is implied. Earlier UI/game/service receipts retain their own scope. The original artwork and all world source assets remain unchanged by these three fixes.

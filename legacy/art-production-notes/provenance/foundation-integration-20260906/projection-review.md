# Current art is preliminary and requires flat 2D replacement review

The native pixel scale and independent terminal state integration work, but **neither current source clears Dex's latest flat 2D direction**.

The platform's 448px interior crop removes the angled endcaps. It still retains a broad bright top surface above a darker front fascia, with the top plane's fixed view baked into the source. Cropping the ends therefore does not make this a purely side-on platform.

The terminal has a shaded right-side face and a stepped/sloped head/cap. Those planes imply a fixed oblique viewpoint while the traveler and camera move. Restoring its native25×96 size and putting the screen into a separate graphics object correctly solves scale/state registration, but does not solve viewpoint.

Fresh actual Vite5188 view at1280×1024, DPR1: `proof/projection-review-normal.png` (2026-09-06T08:57:46Z). The normal image shows the current result beside the authored hero; the described projection features are also visible in the exact source derivatives. No new art or reroll was made.

Both FG01/P02 inventory rows are now `preliminary-needs-2d-review`, with production acceptance false. The working physics, cap alignment, native pixel grid and E/DOM flow are preserved. Root chooses whether to replace these sources; dedicated flat endcaps and backgrounds remain outstanding.

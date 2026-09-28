# Transparent DOM banner integration

Read-only native check of current live5188 source with frozen private two-room map and scene JSON overrides. Three fresh isolated Brave contexts used1600×900,412×915 and844×390. No source/data edits. E and J were actual keyboard actions; Close was the actual DOM button. This is viewport testing, not a physical phone/browser certification.

The new transparent DOM shares the physical320×368 cloth rectangle. It is visibly one banner on desktop and short landscape, and the footer weight ends at the floor. The earlier enlarged-paper-popup mismatch is fixed.

| Viewport | Camera zoom | DOM dimensions | Largest native/DOM delta | Result |
| --- | ---: | --- | ---: | --- |
|1600×900 |0.819608 |262.266×301.609 |0.385px |pass |
|412×915 |0.847778 |271.281×311.969 |0.417px |partial: right edge clipped |
|844×390 |0.65 |208×239.188 |0.400px |pass |

All four links measured44px tall in all three views. Header, Close and links stayed inside their own DOM panel. All three panels had transparent backgrounds and no shadow. E opened to100%; Close rewound and restored focus; J reopened. Zero page errors and no tracked source hash drift.

## Phone correction needed

`phone-open.png`: at100% open, panelx142+width271.281 =>right413.281, beyond the412px viewport. The right cloth edge and roller cap are clipped. `phone-opening.png` shows a larger transient clipping of Close/right side during camera adjustment. This fails the whole-banner-inside-view requirement even though all control heights are correct.

The phone camera snapshot wasx1959,y336,zoom0.847778. World canvas top152,height763; the measured DOM origin agrees with the native transformed surface to less than half a pixel. The defect is camera framing, not DOM/sprite registration. Root should bound the whole assembly footprint, including roller overhang, and ensure any camera ease reaches that bounded position before exposing clipped header controls. No fix was applied by this reviewer.

Evidence: `desktop-{closed,opening,open}.png`, `phone-{closed,opening,open}.png`, `short-landscape-{closed,opening,open}.png`, `results.json`. The full-open screenshots and phone opening screenshot were visually inspected. Raw metrics and hashes are retained in the JSON.

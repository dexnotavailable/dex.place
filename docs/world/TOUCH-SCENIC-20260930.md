# Touch controls at held vistas

The native D4 phone capture at 844×390 put the sixth lit shrine under Q and another
near E. The gameplay controls now move into letterbox gutters while the player
sits or an authored vista hold is active. Q/R, jump, attack, dash, all movement
pads and the contextual E button retain their original nodes, bindings, target
sizes and cooldowns. Ordinary exploration and portrait retain the original
layout. Movement or jump still exits sitting.

Tall landscape views use one-column rails; the shorter homepage iframe uses two
columns inside its wider side gutters. A 4:3 tablet uses a single row in its
existing bottom letterbox when it fits. E's slot stays reserved while hidden.
Fit checks include safe-area margins and 54/64 CSS-pixel border-box targets.
Very small views that cannot fit these arrangements retain the original controls.

The canvas and stage remain full-size. Optional horizontal Presenter insets make
room only as needed, keeping the unchanged 1280×720 scene and shared integer/
sharp-bilinear scale rule. The camera, world landmarks, lamps, story, assets,
parent website layout and cinematic bars are unchanged. Fixed canvas coordinates
also preserve the Chapel artwork overlay mapping. The Chapel DOM projection now
uses Presenter's already top-left Y directly; a second Y flip caused a measured
one-device-pixel artwork/mask offset at odd-width scenic insets.

Both button placement and Presenter insets defer until all held control pointers
end. A hidden E can lose pointer capture before the finger lifts, so a physical
pointer registry persists through that capture loss until pointer-up/cancel or
blur. Reflow does not release input or replace buttons.

Source qualification records actual trusted CDP touch on a production preview,
with the real GL renderer recorded as SwiftShader. Phone/tablet before and after,
rotation, ordinary restoration, Q/R activation, sitting exits, multiple touches,
hidden-E capture loss, cancellation, Chapel artwork and scrolling are separate
source observations. A modeled safe-inset case is explicitly synthetic; these
runs do not establish native D3D11, physical Samsung/iPad, listening or public
acceptance. Delivery owns that qualification. Prior native failure imagery and
all original source READY records remain preserved.

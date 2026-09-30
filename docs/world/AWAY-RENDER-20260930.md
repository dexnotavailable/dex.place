# World work while scrolling the website

The homepage already calls `setAway` when the site covers the World. Previously
that stopped simulation and faded audio, but every animation frame still drew
the hidden World, polled neighbour shaders and warmed rooms.

`WorldGame.frame` now skips all of those calls while away. The cheap RAF clock
remains available; no renderer, shader poll or neighbour warm is submitted from
that path. `setAway` clears the partial tick and timing counters on either
transition, preventing elapsed hidden time from advancing the game on return.
It still releases held controls and calls the existing audio fade exactly once.
No scene, controls, save, music selection or visible rendering is removed.

Source proof: `node src/world/tools/away-regressions.mjs` executes the actual
methods with counted collaborators. It checks visible activity, absent hidden
work, repeated notification, return after a large clock gap and manual mode.
This is source behavior evidence, not a measured whole-device GPU idle claim.

Delivery acceptance: play, scroll down and read the site; confirm stable player
state and no World render/warm submissions, audio fade, then scroll back and
move/use without a time jump. Repeat page visibility/return and narrow touch.
Keep the authored World and normal website fully usable. Existing browser
compositing, outstanding shader compilation or resource retention are separate
from new World work; this change does not destroy/recreate the scene.

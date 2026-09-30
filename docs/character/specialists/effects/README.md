# Liturgy N1→N2 effects — authored source candidate

Owner `rosace-effects`; base `bcb220de03c0b84e8fa68851328cd1d799a11de5`.
Source lives only in `art/rosace/specialists/effects`. No shared world/runtime/builder,
R2 asset, frozen native request, main or rollback was changed. This packet supplies
one complete phrase module and a delivery raster adapter. It has not been rendered,
integrated, played, scored or visually accepted.

Inspected private human ref10 and ref11: filled crescents with taper/decay, broad
floor response and visible body. Their palette, characters and pixels are never
copied. All17 human refs remain fixed9 anchors. These two stills give shape guidance;
they carry no observed motion timing or approval for this candidate.

## Source interface

`n1_n2_fx.py` accepts explicit `Strike` and actual `Contact` events and emits palette
polygons/lines, depth order and rim/light cues. `planner_adapter.py` consumes
`rosace.choreography-ticks/1` from the attacks lane, validates the exact H96 hit-box
ratios/windows against `rosace.choreography/1`, and preserves its one-based wall and
actor clocks. Earliest route completes N1f15, then N2f1;53 whiff ticks,59 with two
3-tick freezes. Source checks may use labeled synthetic collision points; a native
or runtime candidate must supply real impact positions and per-frame native tips.

Host calls `beat_cues` once when an actor drawing frame advances. It emits N1's f7
silk/swish and N2's flutter, low back swish f7 and high front swish f8. Contact chime,
star, pane and1/96H camera push require real collision. The host rounds a camera push
to whole output pixels and disables it in reduced motion. No hitstop is authored
by FX; planner/controller owns one freeze per damage group and per-target damage.

Panes use the actual world tip supplied on the collision event, separately from the
strike snapshot. Missing collision-time tips remain labeled guide/snapshot fallbacks.
Native tip depth takes precedence for the N2 rim pass; actor frame7 stays rear during
an early held S1 and changes to front only at actor frame8. Decay still uses wall time.
Only the nearest two live panes to the current actor root supply light, plus one tip.

Strike is emitted on N1f8/N2f7, before same-tick contact. Contact carries the actual
active actor frame, because later targets can connect while an early strike drawing
is held. Instance ids distinguish repeated moves; target ids deduplicate group hits.
FX age uses60Hz wall ticks throughout actor freeze, including decay mid-hold. Current
lab global freeze and frozen-offset tip attachment do not provide this behavior.
Integrator must wire the independent FX clock and live tip anchors; those are explicit
dependencies, not claims that the current runtime already supports them.

## Shape and timing

| Element | Authored range, without hitstop | Geometry |
|---|---|---|
| N1 full→leaded→shards→slivers | f8 /9–14 /15–24 /25–26 | smooth J,2.5H width,1.75H rise; 12/96H peak band |
| N1 furrow | full8 /leaded9–20 /shards21–32 |150/96H×4/96H on the floor |
| N1 dust | f8–26 | simultaneous2.9H band,4/96H deep |
| N2 full→leaded→shards→slivers | f7 /8–13 /14–24 /25–26 | separate front/back ellipse halves,2.6H×0.5H |
| N2 dust | f7–20 | simultaneous2.9H band |
| Actual contact | first2 wall ticks after collision |9/96H local8-point star; victim shards and gold motes |
| Pane |150 wall ticks, then18-tick decay |7/96H×13/96H lancet; max6 plus max2 retiring |

The N2 rear half is one azure step dimmer. Its authored band is1/96H thinner;
delivery must inspect quantized one-pixel separation at each target. A0 divides glass
cells only; it never outlines the full smear, sparks or star. Every point remains in
H-space until native categorical rasterization. The module uses its own11-code FX
palette from DESIGN, including A0/A1 that are deliberately absent on the sprite.

Both actual hit spans are2.5H:200px at H80 and360px at H144. N2's2.6H cosmetic overscan
is0.05H per end and carries no damage. Dust2.9H becomes232/417.6px. N1 conservative
floor/ceil collision raster bounds can span201px at80; that rounding is separate from
the exact200px continuous geometry. Width is simultaneous box union, never root travel
or a trail. Live active-root input keeps smear placement aligned with current-root
collision boxes; crystallized FX then remain world-anchored. Ground remains anchored
where the scrape began. This first request is for a flat plain room; delivery must
clip ground response at floor/platform edges before using it in other rooms.

The N1 geometric high tip uses the exact high-front hit box endpoint124/96H, while
the planner's unsolved spatial guide ends around1.46H. Native rigid tip/pose/shape
reconciliation belongs to the integrator. Neither that guide nor this curve proves
physical grip, arc contact or baked body motion. Delivery should reject a floating
head or mismatch, then request one scoped source correction.

## Visibility, caps and settings

`raster_adapter.py` accepts the exact unchanged native control sprite and binary
per-frame body/feature masks on the same canvas. It never substitutes a procedural
body or derives a fake grip mask. Back FX are composited behind the sprite. Front
FX paint only the same quarter of body grid sites for every primitive; overlapping
layers cannot progressively obscure the body. Face/head silhouette, chest window,
hands/shaft gaps, feet and chosen lead cloth are fully protected, including marked
negative space. A quarter-grid bound is a source guarantee about permitted sites,
not a claim of measured25% coverage or observed visual quality on a real sprite.

Masks must be explicit binary1/L; RGBA/RGB masks are rejected rather than interpreting
transparent RGB as coverage. The body mask must cover every opaque control pixel.
Clipping diagnostics include a conservative quantized stroke envelope, not vertices
alone; actual delivered pixels establish whether a flagged boundary truly clipped.

No antialiasing, gradients, additive blending or non-palette alpha. Integer raster
coordinates, fixed trajectories and one glint per shard prevent random pixel boiling.
Shards stop at the flat floor. Output cap:2 smears,4 victim-contact sets,6 panes,
2 retiring panes,160 primitive commands,4096 points and3 lights. When scene geometry
exceeds caps, decoration drops before full bodies/contact stars. Peak command count
is source evidence only; frame-time cost is delivery-measured. There are no fullscreen
flashes, zoom or camera rotation in this phrase.

Reduced motion suppresses shard travel, glints, motes and slivers; keeps a steady
readable smear/contact marker; pane bob is off; camera push is removed by adapter.
Reduce flashing lowers white edge/star toA4, suppresses glints and lowers the tip-light
intensity. Normal contact stars are local steady2-tick markers with no alternation.
Native playback must still assess flashes and transitions. The renderer passes light
cues through and reports `lights_applied:false`; it cannot establish rim travel without
native normals/edge masks and live tip anchors.

## Review and integration

Run finite geometry/clock checks through the shared packet resource gate:

```powershell
& 'D:/Dex/Automation/reports/dex-suite-resumption-20260930/resource-gate.ps1' -Owner rosace-effects -ScriptBlock {
  python -B art/rosace/specialists/effects/check_fx.py
  if ($LASTEXITCODE) { throw 'FX source checks failed' }
}
```

The namespace contains no production image. Sole Rosace integrator cherry-picks
reviewed source, reconciles planner and native tip contracts, and writes shared
PIPELINE/MOVESET updates. Delivery owns the finite native comparison described in
DELIVERY.md. No PREVIEW is emitted until exact rendered control/candidate paths exist.
Source rollback is a revert of this namespace's commits on an isolated integration
branch. Existing exact native/R2 rollback bundles remain their sole rollback owners.

Required integrator PIPELINE note: this namespace implements authored glass cells,
decay/furrow/front-back sweep and conditional contact feedback; geometry/clock checks
are distinct from native tip, physical cloth, baked motion, rim, pixels, performance
and runtime acceptance. Link the exact merged source head and resulting delivery
receipt. Do not revise the frozen bcb/794/62/72/322 requests to a moving head.

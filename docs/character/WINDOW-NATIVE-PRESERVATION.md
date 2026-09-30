# Native window preservation correction (2026-09-30)

Actual frozen bcb delivery under Blender5.1.2 rendered control and closed
construction at144/80. Control finished still/ground match0px. Opening mode
stopped before rendering at the retained-face/UV/corner assertion, exit1.
It was not a timeout. Delivery reports unchanged2blends/7maps/217R2reference
files/4160rollback files and owned process cleanup. No complete opening or
finished integrated candidate exists from that attempt.

The old assertion compared polygon arrays positionally and corner payloads
in their raw starting order. The trace did not record the differing values,
so reordering is a hypothesis, not a confirmed cause. True material, smooth,
UV, attribute schema or payload loss remains possible.

The correction compares complete typed face records by oriented vertex-loop
multisets. Only polygon-array permutation and cyclic starts are normalized.
Every UV/corner payload rotates by that same corner offset. Winding reversal,
missing/extra faces, duplicate-count changes, material/smooth differences,
schema/domain/datatype changes or reassigned corner values still fail exactly.
No floating tolerance, independently sorted UVs or attribute waiver.

Point/face/corner snapshots include names, domains, data types and typed RNA
fields, including internal dot-prefixed attributes. Unsupported payload
schemas/nonfinite values stop qualification. The required `.corner_edge`
index retains its raw storage index in diagnostics; semantic comparison
checks the associated edge vertex pair, not an incidental edge-array address.
Named/user attributes remain exact. This is a storage-reference interpretation,
not a relaxation of UV/corner association. Vertex/key/weight/group/point,
protectedbody/collar/cross/plate, closed-loop and rim checks remain mandatory.

New native `mesh-preservation/retained-face-preservation.json` records raw and
semantic hashes/equality, counts, schema additions/deletions, duplicate
identities and bounded first exact/canonical mismatches. A true content
mismatch still stops before ring/pose/render; use that recorded difference to
repair transfer, never loosen equality or paint skin over a closed mesh.

Source fixtures accept face permutation/consistent cyclic rotation and edge
storage reindex with the same association. They reject reversed winding,
UV reassignment, even a1e-7 corner-color change, value/type/domain changes,
internal attribute loss, duplicate count, retained deletion, degeneration and
corner-edge reassociation. This proves comparison behavior, not installed
BMesh correctness or art acceptance. API attribute metadata is documented in
the [Blender5.1 attribute reference](https://docs.blender.org/api/5.1/bpy.types.Attribute.html).

The new exact-source repair request keeps frozen bcb and older794/62/72/322
inputs untouched. Existing bcb control/closed raw can be reused only under
explicit identical model/pose/finish/render/settings/artifact guards, copied
byte-exact into the new executing private output. Re-render those modes if
that identity cannot be established. Render only the missing opening pair
first; then run the unchanged integrated postprocess and actual skin/rim/
framing/contact guards. The independent rosace-critics chat owns new qualified
candidate panels. No fresh full-candidate wave on unfinished4x raw beauty.

Source integrator owns this shared correction; refinement's cuff work and all
other specialist namespaces remain independent. Native/runtime/motion/cloth
acceptance stays with delivery and critics; no canonical/default/main/deploy
changes or model launch occurs in this source correction.

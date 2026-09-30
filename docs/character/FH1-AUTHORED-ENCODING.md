# FH1: original head field with authored normal encoding

FH1 is a separate source candidate over bd94059. It uses the original orbital,
midface/bridge and jaw field at its original amplitudes/tapers, identically on
head_skin and all nine hidden feature meshes. No support-plane expansion,
normal setter/reset, topology, rig, renderer or default asset change is included.
The whole authored native INT16_2D normal array must stay exact through owned
Mesh.copy/update; canonical head readback requires all5120 pairs and full typed
schema. Geometry still uses .35<det<2, <=.17span displacement and original
triangle area/orientation bounds on actual float32 coordinate readback.

This candidate explicitly changes the normal contract. Retained relative
encoding may decode differently on deformed NONanatomical head vertices,
including stationary vertices whose surrounding geometry changed. The actual
old418 no-setter experiment changed1798 decoded corners,412 stationary; that
does not prove unchanged shading. FH1 records every changed corner, original
and actual vectors/pairs/deltas/region and complete hashes. It does not inherit
or waive the old941 P0 decoded-normal contract, and does not claim all corners
at a neck height are anatomical. bd and expanded97 remain failed artifacts.
Accepted witness65c3f8ad/artifactbe705 measures positive det0.006129979 at
vertex55 in97: local compression below the unchanged .35 bound, not foldproof.

The mandatory exact anatomical boundary is every positive Neck-weight vertex
plus one explicit edge neighborhood, and the construction-defined shared cut
ring/body bridge. head.py weld creates30 cut vertices and a46-triangle zipper
to the16 body ring, then split duplicates cut coordinates/weights while keeping
head part1 and body parts0+2. Runtime derives membership from exactly30 unique
shared finite float32 coordinate keys, closed oriented boundary cycles with
one incoming/outgoing edge, opposite mapped halfedges and exact named positive
Head/Neck weight maps. The body faces incident to shared30 must be46 triangles
using exactly30+16 vertices with two strip boundary cycles. Rounded build
weight.363 is not a target. No nearest tolerance or generated index map is used.
Ambiguity or count/topology/weight drift rejects before any candidate image.

Each object's OWN original encoded pairs and protected decoded corner values
remain exact. Head/body corner bytes are not compared cross-object: their loop
bases differ. The whole body and every original scene mesh are rechecked with
typed attributes/counts, topology/UV/weights/materials, keys, decoded/encoded
normals and coordinates. UV legacy access precedes complete schema snapshots.
Only Modifier.execution_time, a derived read-only evaluation duration, is
measured separately before installation/after cleanup; its field schema remains
bound. All other readable RNA scalar/array/pointer settings remain exact,
including read-only authored fields. No typed mesh attribute/value RNA is omitted.
Head/refs must be unkeyed with sole canonical Armature and exact transforms;
hidden flags, rest rig/eye bones/head metrics remain exact. Owned mesh pointers
and all modified hooks are restored on success/failure; every owned deletion is
attempted after restoring all pointers. Fresh private rejection receipts retain
membership/config/schema/full encoding SHAs and complete normal mismatches.

The first native request is only four matched idle stills: control/FH1 at144/80,
closed/default R2 hand1.0/head1.10. The existing nx_hands driver supplies7 maps,
including depth2; frozen R2 provides6, and failedbd control is the separately
bound seventh-pass provenance. The58 input binding574ecde6 and9 metadata-source
binding66ca81de are reused byte exact, including the model-only execution-root
portability fix. Historical fixed data paths remain fixed. Native source/head
identity and witness/build/method evidence have their own exact source binding.
The tools/pixel-pipeline and tools/art-construct Python/JSON supersets include
the shared finish's lazy wh2_px dependency; recipes/finish source remain unchanged.
ROOT commits runtime, freezes that exact live head, commits manifest/metadata,
then externally admits final executingHEAD. Native verify permits descendants
only with the same source fingerprint and required ancestry.

Post requires exact decoded RGBA8 control replay, every raw dimension before ROI,
full frozenR2/failedbd metadata equivalence and exact matched bone matrices. The
only source serialization equivalence is same filename and CRLF-to-LF bytes,
with raw SHAs and each actual raw pose_sha1 checked. Head change scope is the
actual categorical head union plus4 raw subpixel edge and2 native finish support,
with measured literal XYXY bounds. All7 raw and both finished still/ground
outside-scope differences must be zero. Adaptive finish spill is retained and
rejected, never composited away. Raw/finished whole/native/enlarged face panels
must demonstrate useful144 eye/cheek/jaw rhythm and80 feature separation while
preserving fringe clearance. Source counters or invisible displacement do not
prove appearance. Three new fixed9 critics follow only qualified new pixels.

CPU fixtures prove source helper contracts, imports, cleanup and comparison
behavior, not actual Blender membership, geometry bounds, encoding readback or
art. No native run, new pixels, back/profile/motion/full-character acceptance,
art9 or promotion has occurred here. Old modules/defaults and all failed
evidence are unchanged. Use the existing rosace-source CPU resource gate;
sole delivery owns later exclusive/GPU execution after independent source review.

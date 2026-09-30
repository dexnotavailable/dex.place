# FC1 protected-normal cause probe

Actual FC1 on source bd94059 rendered its four R2 control stills, then failed
before the first candidate render: protected decoded welded/crown normals
changed. The strict guard and failed source/output remain unchanged. The
current trace contains no affected corner indices or before/after vectors.

This finite probe opens the exact canonical scene read-only, applies the same
R2 model preparation as that failed construction stage, and operates on five
disposable head mesh copies. It renders zero images. The private head object's
data pointer temporarily uses each copy before decoded read, matching FC1's
exact adapter order, then restores the untouched original on every path.
Copy-only and update-only
controls establish baseline data behavior. A zero-deformation normal roundtrip
tests native re-encoding. Real deformation with old encoded normals isolates
geometric basis changes; real deformation with the exact existing FC1 transport
and setter reproduces the failed normal path.

Every mismatch records corner/vertex identity, decoded and encoded values,
component/angular deltas, explicit neck/crown/back classification, all incident
source faces and adjacent changed vertices. Zero displacement is recorded
separately from explicit anatomical protection. Incident topology is evidence;
it is not claimed to be Blender's exact smoothing fan. No comparison tolerance
or old assertion is removed. Zero-length decoded normals have undefined angles
and retain their exact component comparison.

Source fixtures test exact tiny corruption, opposite/zero/nonfinite vectors,
classification and adjacency. Actual native API results determine whether the
next correction must preserve encoded data differently, protect a broader
normal-support region or correct an overbroad measurement. No candidate pixels,
new visual scores or normalization workaround are inferred from this probe.

Entry and finite request: `art/rosace/integration/facecage_normals/`. Sole
delivery owns the native lease, bounded process and cleanup. Source review and
an exact frozen READY precede the zero-render run. Canonical data, R2 controls,
the failed FC1 bytes, both rollback bundles and the independent C2/AO trials
remain intact.

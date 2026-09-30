# Native sharp_face preservation repair

Frozen c138 native execution on Blender 5.1.2 retained all 4,737 oriented
faces and passed the vertex, weights, shape keys, point-data and material
guard. Its recorded schema dropped only `sharp_face`, a non-required
`FACE/BOOLEAN` attribute. The first semantic mismatch was that missing field;
the complete post-repair comparison remains the proof for every retained face.

The opt-in repair recreates this missing attribute on the copied bodice only.
Each retained value comes from its unique, oriented original face identity;
cyclic loop start and polygon order do not change its association. Mixed true
and false values are preserved. Existing attributes are never overwritten,
and ambiguous, reversed, missing or extra face identities fail. The complete
typed UV/corner/face comparison and independent point guard still run after
restoration with zero tolerance. No other dropped attribute is repaired.

`check_sharp_face_restore.py` verifies mixed-value reassociation and rejects
corruption of UVs, corner values, smoothing and other schema, as well as
duplicate/deleted/reversed faces and wrong original types. The inherited
construction and preservation source checks pass. Native RNA creation/readback
and actual opening pixels remain pending the sole delivery executor.

The finite request is `art/rosace/next/sharp-face-preservation-request.json`.
It needs only two new opening renders if fresh c138 controls qualify for exact
reuse; otherwise six. Frozen c138 artifacts, baseline scenes and all prior
controls remain intact. A successful opening result must bind the actual
constructed body before the new N1-to-N2 motion trial.

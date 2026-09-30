# Motion capability inventory — inspected September30

This inventory comes from local primary source, installed checkpoint/config and
distribution metadata, plus saved run JSON. No model, torch, CUDA, Blender or app
was launched. Runtime health and motion quality remain unverified in this lane.
The exact research evidence stays in the assigned motion report directory.

| Route | Current inspected source/checkpoint | Input and output contract |
|---|---|---|
| NVIDIA Kimodo | Clean source58e781898b3d7e328a676a75d3e338c45dce3ad9; SOMA-RP-v1.1 checkpoint1,133,185,036bytes, cached revision6c9233af1180b8151e3c4703477104af5dce9dd5 | Text and/or fullbody FK-position, hand/foot, end-effector and root2d constraints. Model works on SOMA30 and expands to77 joints. Wrapper generates1..300frames at30fps; outputs NPZ/BVH/runJSON. No image, sprite-sheet or arbitrary-rig conditioning flag. |
| Kimodo text encoder | Llama3 8B shards16,060,556,376bytes; two167,829,552byte adapters, existing D-backed cache | CPU default LLM2Vec text route; NullTextEncoder for no-text constraints. Cache revisions match wrapper constants. Presence is verified, no fresh loading or speed claim. |
| NVIDIA GEM-X | Clean source32992550dba114c62243fb55e361311972dce8f9; GEM541,758,499byte/SAM3D2,109,129,346byte/ViTPose3,388,483,384byte checkpoints | Single-person fixed-camera video resampled30fps; detector/keypoints/image features/regression. Outputs motion_soma.npz, BVH, raw prediction and overlayMP4/report. Finger keypoints are removed. The local moving-camera flag falls back to static camera when VO is unavailable. |
| SOMA adapter | Existing soma_to_bvh.py and bone_map_vrm.json | Local rotation matrices T×77×3×3 plus hips T×3 in metres/Y-up. Kimodo BVH writer uses centimetres and78bones including Root. Direct Rosace retarget uses NPZ,22 mapped body bones, axis(x,y,z)→(x,-z,y), rest/world rotations and leg-length scaling. |
| Authored action | retime.py, hero_layer.py, blender_apply.py and N1/N5 r3c timing/keys |60Hz game timing, stepped exposures, authored glaive/hand IK/socket slide, planted ankle targets and secondary spring chains. Glaive/fingers are not model outputs. Mesh cloth installer exists separately and needs moving acceptance. |

Kimodo/SOMA standard coordinates are Y-up, facing+Z, left+X; Rosace is Z-up,
facing-Y, left+X. Fullbody constraints use rotations to derive FK target positions;
they do not directly enforce exact local rotations. Frame indices are zero-based.
Bone-map fingers/eye/jaw and Neck2 are unmapped. Right/left grips are authored
anatomically; a plain VRM lacks Rosace glaive, sockets, IK/poles and cloth chains.

Installed D-backed venv metadata is present: Kimodo Python3.10.20,
torch2.10.0+cu126/numpy2.2.6/transformers5.1.0/peft0.21.0 and MotionCorrection1.0.0;
GEM-X Python3.12.14, torch2.10.0+cu126/torchvision0.25.0+cu126,
onnxruntime_gpu1.23.2/opencv5.0.0.93/warp1.17.0. No import or native extension
readiness is inferred. GEM-X's soma-retargeter submodule is uninitialized; the
inspected wrapper intentionally exports through Kimodo's writer instead.

Llama cache revision8afb486c1db24fe5011ec46dfbe5b5dccdb575c2 and adapter revisions
31474e395ada192e8ed1586db6be79fb3b70c9c0/baa8ebf04a1c2500e61288e7dad65e8ae42601a7
match local cache refs. Prior provenance exists;16GB weights were not rehashed.
Bounded source/model/venv roots expose only Kimodo/GEM-X motion routes. HY-Motion,
ARDY, MotionBricks, ProtoMotions and older alternatives were not found in those
roots; this is not a whole-machine absence claim or a request to install them.

Saved reports establish prior constraints/text+pose/video executions. N1/N5
generated picks, direct retarget, hero/retime source and action files are reusable.
Exact r3c144 metadata records19/53rendered frames at yaw60/elev8. Exact r3c80
siblings are absent in the inspected render directories. Other80px work exists.
Saved maximum hand gaps2.4/1.32cm and foot drift0.01/0cm are historic diagnostics,
never visual/native acceptance. One N1 f8 source image was actually inspected by
the implementor; one still cannot establish timing, view coverage or physical cloth.

MODELS is initial research; its not-installed/Llama-decision wording is stale.
SETUP's retarget-unverified, text+keys-untested and Muybridge-only bullets are
superseded by actual source/run/catalogue evidence. Original measured speed/VRAM
and disk figures are historical. The focused authored N1→N2 route needs no new
model generation or dependency on dexCode/dexClient ownership. Delivery may
validate a model later only under its finite native route; source still owns exact
spin/contact, root/foot/weapon, grip and transition authoring.

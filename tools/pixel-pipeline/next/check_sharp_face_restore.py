"""Mixed native attribute restoration and independently strict corruption checks."""
import copy
import json
import check_mesh_preservation as fixtures
import mesh_preservation as P

before = [copy.deepcopy(fixtures.face), copy.deepcopy(fixtures.second)]
for f, value in zip(before, (True, False)):
    f["attributes"]["sharp_face"] = {"name":"sharp_face", "domain":"FACE",
        "dataType":"BOOLEAN", "required":False, "rows":[{"value":fixtures.field(value,"BOOLEAN")} ]}
after = [fixtures.rotate(before[1], 2), fixtures.rotate(before[0], 1)]
for f in after:
    del f["attributes"]["sharp_face"]
plan = P.sharp_face_restore_plan(before, after)
assert plan["values"] == [False, True] and plan["trueCount"] == 1
for f, value in zip(after, plan["values"]):
    f["attributes"]["sharp_face"] = copy.deepcopy(before[0]["attributes"]["sharp_face"])
    f["attributes"]["sharp_face"]["rows"][0]["value"]["value"] = value
assert P.compare(before,after)["exactSemanticEqual"]
assert P.sharp_face_restore_plan(before,after) is None
after[1]["attributes"]["sharp_face"]["rows"][0]["value"]["value"] = False
assert P.sharp_face_restore_plan(before,after) is None
assert not P.compare(before,after)["exactSemanticEqual"], "present corruption cannot be hidden"
for mutation in ("UV", "corner", "smooth", "otherDrop"):
    candidate = copy.deepcopy(before)
    for f in candidate:
        del f["attributes"]["sharp_face"]
    if mutation == "UV": candidate[0]["uv"]["UVMap"][0][0] += .0000001
    if mutation == "corner": candidate[0]["attributes"]["color"]["rows"][0]["color"]["value"][0] += .0000001
    if mutation == "smooth": candidate[0]["smooth"] = False
    if mutation == "otherDrop": del candidate[0]["attributes"]["tag"]
    restored = P.sharp_face_restore_plan(before,candidate)
    for f, value in zip(candidate,restored["values"]):
        f["attributes"]["sharp_face"] = copy.deepcopy(before[0]["attributes"]["sharp_face"])
        f["attributes"]["sharp_face"]["rows"][0]["value"]["value"] = value
    assert not P.compare(before,candidate)["exactSemanticEqual"], mutation
for candidate in ([after[0],after[0]], [after[0]], [dict(after[0],vertices=list(reversed(after[0]["vertices"]))),after[1]]):
    try: P.sharp_face_restore_plan(before,candidate)
    except ValueError: pass
    else: raise AssertionError("ambiguous/deleted/reversed identity accepted")
invalid = copy.deepcopy(before)
invalid[0]["attributes"]["sharp_face"]["dataType"] = "INT"
try: P.sharp_face_restore_plan(invalid,after)
except ValueError: pass
else: raise AssertionError("wrong original schema accepted")
print(json.dumps({"sharpFaceSourceChecks":"pass", "mixedValuesReassociated":True,
    "strictOtherGuards":True, "nativeRNAReadback":"pending sole delivery execution"}))

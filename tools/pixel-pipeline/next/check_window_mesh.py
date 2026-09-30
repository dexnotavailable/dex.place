"""Source tests of the actual aperture plan; not a Blender qualification."""
import ast
import json
from pathlib import Path
import window_mesh_recipe as R


def grid(y):
    vertices = [[(x-12)*.01, y, 1.24+z*.01] for z in range(21) for x in range(25)]
    faces = [[z*25+x,z*25+x+1,(z+1)*25+x+1,(z+1)*25+x] for z in range(20) for x in range(24)]
    return vertices, faces


v, f = grid(-.1)
bv, bf = grid(.1)
offset = len(v)
vertices = v+bv
faces = f+[[i+offset for i in face] for face in bf]
before_vertices = json.dumps(vertices)
before_faces = json.dumps(faces)
p = R.plan(vertices, faces, [0,-.1,1.42], [0,-.1,1.302])
assert p["removedFaces"] and max(p["removedFaces"]) < len(f), "cut must exclude back faces"
assert json.dumps(vertices) == before_vertices and json.dumps(faces) == before_faces, "plan must be immutable"
assert len(p["loop"]) >= 4 and len(set(p["loop"])) == len(p["loop"])
assert p["rimWidthMeters"] == .005
for a,b in zip(p["inner"],p["outer"]):
    assert abs(((b[0]-a[0])**2+(b[2]-a[2])**2)**.5-.005)<1e-12
assert all(i in p["retainedFaces"] for i in range(len(f),len(faces)))
for bad in ([(0,1),(1,2)],[(0,1),(1,2),(2,0),(3,4),(4,5),(5,3)]):
    try:
        R.closed_loop(bad)
    except ValueError:
        pass
    else:
        raise AssertionError("open/multiple boundaries must fail")
for filename in ("nx_window_mesh_blender.py", "face2_trial.py", "window_mesh_recipe.py", "window_mesh_post.py"):
    path=Path(__file__).with_name(filename)
    if path.exists():
        ast.parse(path.read_text(encoding="utf-8"))
request=json.loads((Path(__file__).resolve().parents[3]/"art/rosace/next/window-mesh-request.json").read_text())
assert request["windowModes"] == ["control","mesh"]
assert request["canonicalChanges"] is False and request["allowArtPromotion"] is False
print(json.dumps({"sourceChecks":"pass","frontFacesRemoved":len(p["removedFaces"]),"singleClosedLoopVertices":len(p["loop"]),
    "backFacesUntouched":len(bf),"rimWidthMeters":p["rimWidthMeters"],"nativeQualification":"pending delivery"}))

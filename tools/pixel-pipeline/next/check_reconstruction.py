"""Validate authored recipe dispatch/preservation; no native or9claim."""
import ast
import copy
import json
from pathlib import Path
import reconstruction_recipe as R
import reconstruction_native_post as P
import numpy as np

source={"name":"idle_appeal","bones":{"J_Bip_C_Hips":[6.5,19.5,5.2]},
    "figure":{"torso":{"bend":[-15.6,0,-6.5]},"joints":{"upper_chest":[0,8,0]},
        "hands":{"R":{"rel":"hips","pos":[-.21,.09,1.1],"fdir":[.15,-.65,-.75],"palm":[1,.1,.1]}},
        "look":{"tilt":16,"chin":10},"weight":{"leg":"R","knee":178},"feet":{"L":{"toe":28}}},
    "weapon":{"dir":[-.2435,.2435,1]},"feet":{"R":{"pos":[-.05,0,.06]}}}
before=copy.deepcopy(source)
R.MODE="control"
assert R.apply(source,1.0)==source
R.MODE="reconstruction"
candidate=R.apply(source,1.3)
assert source==before
assert candidate["figure"]["hands"]["R"]["pos"]==[-.15,-.015,1.22]
assert candidate["figure"]["look"]==source["figure"]["look"]
assert candidate["figure"]["weight"]==source["figure"]["weight"]
assert candidate["feet"]==source["feet"] and candidate["weapon"]==source["weapon"]
assert candidate["figure"]["hands"]["R"]["fdir"]==source["figure"]["hands"]["R"]["fdir"]
assert R.scale_for(candidate,"L")==1.3 and R.scale_for(candidate,"R")==1.3
assert R.apply({},1.3)==R.BASE.apply({},1.3),"inherited nativeguard preflight must still validate"
try:
    R.apply(source,1.0)
except ValueError:
    pass
else:
    raise AssertionError("candidate must not silently use scale1 bypass")
R.MODE="control"
here=Path(__file__).resolve().parent
for name in ("reconstruction_recipe.py","nx_reconstruction_blender.py","reconstruction_finish.py","reconstruction_native_post.py"):
    ast.parse((here/name).read_text())
request=json.loads((here.parents[2]/"art/rosace/next/reconstruction1-request.json").read_text())
assert [m["name"] for m in request["modes"]]==["control","construction-control","reconstruction"]
assert [m["handScale"] for m in request["modes"]]==["1.0","1.3","1.3"]
assert request["canonicalChanges"] is False and request["allowArtPromotion"] is False
# An auto-fit canvas shift must not become a pose/scale difference in A/B.
first=np.zeros((5,4,4),dtype=np.uint8)
second=np.zeros((7,7,4),dtype=np.uint8)
first[2,1]=[50,80,120,255]
second[3,3]=[50,80,120,255]
basis={"right":[1,0,0],"up":[0,1,0],"fwd":[0,0,-1]}
meta_a={"canvas":[4,5],"anchor":[1,2],"ppm":80.0,"cam":basis}
meta_b={"canvas":[7,7],"anchor":[3,3],"ppm":80.0,"cam":basis}
images,alignment=P.align([first,second],[meta_a,meta_b])
assert np.array_equal(images[0],images[1]),"anchor translation must align same world point"
try:
    P.align([first,second],[meta_a,dict(meta_b,ppm=81.0)])
except AssertionError:
    pass
else:
    raise AssertionError("different actual pixel scale must fail")
print(json.dumps({"sourceChecks":"pass","changedPoseFields":list(R.CHANGES),"headTiltPreserved":16,
    "handScale":1.3,"nativeModes":3,"integerAnchorAlignment":"pass","nativeQualification":"pending delivery"}))

"""Exact diagnostic classification and corruption fixtures; no native inspection."""
import json
import math
import probe as P

cfg={"neckProtectedThrough":.1,"crownProtectedFrom":.8,"eyeY":0.,"span":.1}
points=[(0,0,0),(0,0,.5),(0,.2,.5),(0,0,.9)]
normals=[(0.,-1.,0.)]*4
loops=[(i,i) for i in range(4)]
incident=[[0],[0],[1],[1]]
faces=[[0,1,2],[1,2,3]]
encoded=[{"value":[0,0]}]*4
base=P.report_case("copy",normals,normals,loops,points,cfg,{0},{0},{1},incident,faces,encoded,encoded)
assert base["mismatchCount"]==0 and base["currentFC1StrictGuardWouldPass"]
assert base["encodedExact"] and base["encodedMismatchCount"]==0
reencoded=[{"value":[1,0]}]+encoded[1:]
same=P.report_case("sameDecoded",normals,normals,loops,points,cfg,{0},{0},{1},incident,faces,encoded,reencoded)
assert same["mismatchCount"]==0 and not same["encodedExact"] and same["encodedMismatchCount"]==1
after=normals[:];after[0]=(1e-8,-1.,0.);after[1]=(0.,1.,0.)
r=P.report_case("corrupt",normals,after,loops,points,cfg,{0},{0},{1},incident,faces,encoded,encoded)
assert r["mismatchCount"]==2 and r["currentStrictFailureCorners"]==[0]
assert "explicit-neck-weight" in r["completeMismatches"][0]["regions"]
assert r["completeMismatches"][1]["angularDegrees"]==180
assert r["completeMismatches"][0]["adjacentChangedVertexIndices"]==[1]
assert not P.vector_delta((0,1,0),(1e-8,1,0))["exact"]
try:
    P.report_case("shortencoded",normals,after,loops,points,cfg,{0},{0},{1},incident,faces,encoded,encoded[:2])
except ValueError: pass
else: raise AssertionError("short encoded data truncated exact mismatches")
assert P.vector_delta((0,0,0),(0,1,0))["angularDegrees"] is None
assert "crown-region" in P.regions(points[3],3,cfg,set(),set(),{1})
assert "back-region" in P.regions(points[2],2,cfg,set(),set(),{1})
for row in ((float("nan"),0,0),(float("inf"),0,0)):
    try: P.vector_delta(row,(0,1,0))
    except ValueError: pass
    else: raise AssertionError("nonfinite normal accepted")
print(json.dumps({"sourceChecks":"pass","scope":"exact normal deltas/zero-length/angular/category/adjacency reporting",
    "nativeExecuted":False,"guardRelaxed":False,"knownNativeCause":"pending five disposable native cases"}))

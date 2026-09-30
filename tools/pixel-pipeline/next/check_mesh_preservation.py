"""Test exact association guards with ordering changes and real corruption."""
import copy
import json
import mesh_preservation as P


def field(value,kind="FLOAT",array=False):
    return {"rnaType":kind,"array":array,"value":value}


face={"vertices":[7,3,9,12],"material":1,"smooth":True,
      "uv":{"UVMap":[[.1,.2],[.3,.4],[.5,.6],[.7,.8]]},
      "attributes":{
          "tag":{"name":"tag","domain":"FACE","dataType":"INT","required":False,
                 "rows":[{"value":field(42,"INT")}]},
          ".corner_vert":{"name":".corner_vert","domain":"CORNER","dataType":"INT","required":True,
                           "rows":[{"value":field(v,"INT")} for v in (7,3,9,12)]},
          "color":{"name":"color","domain":"CORNER","dataType":"FLOAT_COLOR","required":False,
                   "rows":[{"color":field([i/4,0,1,1],array=True)} for i in range(4)]}}}
second=copy.deepcopy(face)
second["vertices"]=[17,13,19,22]
second["attributes"][".corner_vert"]["rows"]=[{"value":field(v,"INT")} for v in second["vertices"]]


def rotate(f,n):
    r=copy.deepcopy(f)
    r["vertices"]=r["vertices"][n:]+r["vertices"][:n]
    for k,rows in r["uv"].items():
        r["uv"][k]=rows[n:]+rows[:n]
    for attr in r["attributes"].values():
        if attr["domain"]=="CORNER":
            attr["rows"]=attr["rows"][n:]+attr["rows"][:n]
    return r


valid=P.compare([face,second],[rotate(second,3),rotate(face,1)])
assert valid["exactSemanticEqual"] and not valid["rawRecordsEqual"]
bad=[]
r=copy.deepcopy(face);r["vertices"].reverse();bad.append(("winding",r))
r=copy.deepcopy(face);r["uv"]["UVMap"][0],r["uv"]["UVMap"][1]=r["uv"]["UVMap"][1],r["uv"]["UVMap"][0];bad.append(("UVassociation",r))
r=copy.deepcopy(face);r["attributes"]["color"]["rows"][0]["color"]["value"][0]+=.0000001;bad.append(("cornerValue",r))
r=copy.deepcopy(face);r["attributes"]["tag"]["dataType"]="FLOAT";bad.append(("datatype",r))
r=copy.deepcopy(face);r["attributes"]["tag"]["domain"]="CORNER";r["attributes"]["tag"]["rows"]*=4;bad.append(("domain",r))
r=copy.deepcopy(face);r["material"]=0;bad.append(("material",r))
r=copy.deepcopy(face);r["smooth"]=False;bad.append(("smooth",r))
r=copy.deepcopy(face);del r["attributes"][".corner_vert"];bad.append(("internalAttributeDrop",r))
for label,r in bad:
    assert not P.compare([face],[r])["exactSemanticEqual"],label
assert not P.compare([face,face],[face])["exactSemanticEqual"]
assert not P.compare([face,second],[face])["exactSemanticEqual"]
edge_face=copy.deepcopy(face)
edge_face["attributes"][".corner_edge"]={"name":".corner_edge","domain":"CORNER","dataType":"INT","required":True,
    "rows":[{"value":field({"edgeArrayIndex":i,"edgeVertexPair":sorted(pair)},"INT")}
            for i,pair in enumerate(((7,3),(3,9),(9,12),(12,7)))]}
edge_reindexed=copy.deepcopy(edge_face)
for row in edge_reindexed["attributes"][".corner_edge"]["rows"]:
    row["value"]["value"]["edgeArrayIndex"]+=10
assert P.compare([edge_face],[edge_reindexed])["exactSemanticEqual"]
edge_reindexed["attributes"][".corner_edge"]["rows"][0]["value"]["value"]["edgeVertexPair"]=[3,12]
assert not P.compare([edge_face],[edge_reindexed])["exactSemanticEqual"]
try:
    P.canonical(dict(face,vertices=[7,3,7,12]))
except ValueError:
    pass
else:
    raise AssertionError("degenerate identity not rejected")
print(json.dumps({"sourceChecks":"pass","validFaceOrderAndCyclicStart":True,
    "rejected": [name for name,_ in bad]+["duplicateCount","retainedDeletion","degenerate","cornerEdgeReassociation"],
    "tolerance":0,"nativeCause":"unconfirmed until recorded native comparison"}))

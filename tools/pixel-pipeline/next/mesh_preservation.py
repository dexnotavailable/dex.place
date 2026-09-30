"""Exact mesh attribute/face preservation by oriented semantic association.

Polygon-array order and cyclic loop start are storage choices. Winding,
vertex identity, every typed field and its associated corner are not. No
rounding/tolerance, independently sorted UVs or attribute waivers.
"""
import collections
import copy
import hashlib
import json
import math


def plain(value):
    if isinstance(value,(str,bool,int)) or value is None:
        return value
    if isinstance(value,float):
        if not math.isfinite(value):
            raise ValueError("nonfinite preservation data")
        return value
    if isinstance(value,set):
        return sorted(plain(v) for v in value)
    try:
        return [plain(v) for v in value]
    except TypeError as error:
        raise ValueError(f"unsupported preservation value {type(value).__name__}") from error


def typed_value(value):
    result={}
    for prop in value.bl_rna.properties:
        name=prop.identifier
        if name in ("rna_type","id_data"):
            continue
        if prop.type not in ("BOOLEAN","INT","FLOAT","STRING","ENUM"):
            raise ValueError(f"unsupported attribute RNA field {name}/{prop.type}")
        result[name]={"rnaType":prop.type,"array":bool(getattr(prop,"is_array",False)),"value":plain(getattr(value,name))}
    if not result:
        raise ValueError("attribute exposes no supported typed payload fields")
    return result


def attribute_rows(me,attribute,indices):
    rows=[typed_value(attribute.data[i]) for i in indices]
    # This required Blender storage attribute points to an edge-array slot.
    # Preserve the actual edge identity, not an incidental array address.
    if attribute.name==".corner_edge" and attribute.is_required:
        for row in rows:
            if set(row)!={"value"} or row["value"]["rnaType"]!="INT":
                raise ValueError("unexpected required .corner_edge schema")
            index=row["value"]["value"]
            if not 0<=index<len(me.edges):
                raise ValueError("invalid required corner edge reference")
            row["value"]["value"]={"edgeArrayIndex":index,"edgeVertexPair":sorted(me.edges[index].vertices)}
    return rows


def attributes(me,domain,indices):
    return {a.name:{"name":a.name,"domain":a.domain,"dataType":a.data_type,
                    "required":bool(a.is_required),"rows":attribute_rows(me,a,indices)}
            for a in me.attributes if a.domain==domain}


def face_data(me,face):
    # Read UV data before the complete schema snapshot: Blender's legacy UV
    # accessor may materialize internal selection data. Do not drop dot names.
    uv={layer.name:[[float(v) for v in layer.data[i].uv] for i in face.loop_indices]
        for layer in me.uv_layers}
    attrs=attributes(me,"FACE",[face.index])
    attrs.update(attributes(me,"CORNER",face.loop_indices))
    return {"vertices":list(face.vertices),"material":face.material_index,
            "smooth":bool(face.use_smooth),"uv":uv,"attributes":attrs}


def canonical(face):
    result=copy.deepcopy(face)
    vertices=result["vertices"]
    if len(vertices)<3 or len(set(vertices))!=len(vertices):
        raise ValueError("degenerate/repeated-vertex face identity")
    start=min(range(len(vertices)),key=lambda i:tuple(vertices[i:]+vertices[:i]))
    rotate=lambda rows:rows[start:]+rows[:start]
    result["vertices"]=rotate(vertices)
    for name,rows in result["uv"].items():
        if len(rows)!=len(vertices):
            raise ValueError(f"UV/corner count differs: {name}")
        result["uv"][name]=rotate(rows)
    for name,attr in result["attributes"].items():
        if attr["domain"]=="CORNER":
            if len(attr["rows"])!=len(vertices):
                raise ValueError(f"attribute/corner count differs: {name}")
            attr["rows"]=rotate(attr["rows"])
            if name==".corner_edge" and attr["required"]:
                for row in attr["rows"]:
                    value=row["value"]["value"]
                    row["value"]["value"]={"edgeVertexPair":value["edgeVertexPair"]}
        elif attr["domain"]!="FACE" or len(attr["rows"])!=1:
            raise ValueError(f"unexpected face attribute domain/count: {name}")
    return result


def encoded(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False)


def hash_records(records):
    return hashlib.sha256(encoded(records).encode()).hexdigest()


def compare(before,after):
    left=[canonical(f) for f in before]
    right=[canonical(f) for f in after]
    lcount=collections.Counter(encoded(f) for f in left)
    rcount=collections.Counter(encoded(f) for f in right)
    identities=lambda rows:collections.Counter(tuple(f["vertices"]) for f in rows)
    lid,rid=identities(left),identities(right)
    report={"rawRecordsEqual":before==after,"exactSemanticEqual":lcount==rcount,
        "comparison":"full typed oriented-loop multiset; cyclic start/order only; zero tolerance",
        "beforeFaceCount":len(before),"afterFaceCount":len(after),
        "beforeRawSha256":hash_records(before),"afterRawSha256":hash_records(after),
        "beforeSemanticSha256":hash_records(sorted(lcount.items())),
        "afterSemanticSha256":hash_records(sorted(rcount.items())),
        "missingOrientedIdentities":[{"vertices":list(k),"count":v} for k,v in (lid-rid).items()][:5],
        "extraOrientedIdentities":[{"vertices":list(k),"count":v} for k,v in (rid-lid).items()][:5],
        "duplicateIdentitiesBefore":[{"vertices":list(k),"count":v} for k,v in lid.items() if v>1][:5],
        "duplicateIdentitiesAfter":[{"vertices":list(k),"count":v} for k,v in rid.items() if v>1][:5]}
    def schema(rows):
        return sorted({(name,a["domain"],a["dataType"],a["required"])
                       for f in rows for name,a in f["attributes"].items()})
    lschema,rschema=set(schema(before)),set(schema(after))
    report["schemaAdded"]=sorted(rschema-lschema)
    report["schemaDropped"]=sorted(lschema-rschema)
    if before!=after:
        index=next((i for i,(a,b) in enumerate(zip(before,after)) if a!=b),min(len(before),len(after)))
        report["firstRawMismatch"]={"index":index,
            "before":before[index] if index<len(before) else None,
            "after":after[index] if index<len(after) else None}
    if lcount!=rcount:
        missing=[json.loads(s) for s,count in (lcount-rcount).items() for _ in range(min(count,1))]
        extra=[json.loads(s) for s,count in (rcount-lcount).items() for _ in range(min(count,1))]
        report["missingExactRecords"]=missing[:3]
        report["extraExactRecords"]=extra[:3]
        if missing:
            matched=next((f for f in extra if f["vertices"]==missing[0]["vertices"]),None)
            if matched:
                first=missing[0]
                report["firstSemanticMismatch"]={"vertices":first["vertices"],
                    "fieldsChanged":[k for k in ("material","smooth","uv","attributes") if first[k]!=matched[k]],
                    "attributeSchemaAdded":sorted(set(matched["attributes"])-set(first["attributes"])),
                    "attributeSchemaDropped":sorted(set(first["attributes"])-set(matched["attributes"])),
                    "before":first,"after":matched}
    return report

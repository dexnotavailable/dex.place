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


def sharp_face_restore_plan(before, after):
    """Restore only a missing native FACE/BOOLEAN sharp_face by oriented identity.

    Do not overwrite an existing field, substitute all-false, or repair other
    corruption. The caller must run the complete comparison after restoration.
    This pure plan preserves mixed true/false values and rejects ambiguous faces.
    """
    left = [canonical(f) for f in before]
    right = [canonical(f) for f in after]
    def indexed(rows):
        result = {}
        for i, f in enumerate(rows):
            key = tuple(f["vertices"])
            if key in result:
                raise ValueError("ambiguous oriented face identity; cannot restore sharp_face")
            result[key] = (i, f)
        return result
    source, target = indexed(left), indexed(right)
    if set(source) != set(target):
        raise ValueError("retained face identity changed; cannot restore sharp_face")
    expected = ("sharp_face", "FACE", "BOOLEAN", False)
    values = []
    present = []
    for key, (i, f) in target.items():
        attr = source[key][1]["attributes"].get("sharp_face")
        if attr is None:
            if "sharp_face" in f["attributes"]:
                raise ValueError("unexpected sharp_face added by native conversion")
            values.append(None)
            present.append(False)
            continue
        if tuple(attr[k] for k in ("name", "domain", "dataType", "required")) != expected:
            raise ValueError("unsupported original sharp_face schema")
        rows = attr["rows"]
        if len(rows) != 1 or set(rows[0]) != {"value"}:
            raise ValueError("unsupported sharp_face payload")
        field = rows[0]["value"]
        if field.get("rnaType") != "BOOLEAN" or field.get("array") is not False or type(field.get("value")) is not bool:
            raise ValueError("sharp_face requires an exact typed scalar Boolean")
        values.append(field["value"])
        present.append("sharp_face" in f["attributes"])
    if not values or all(v is None for v in values):
        return None
    if any(v is None for v in values) or (any(present) and not all(present)):
        raise ValueError("inconsistent sharp_face schema across retained faces")
    # Present but corrupted data stays visible to the unmodified strict guard.
    if all(present):
        return None
    return {"name": "sharp_face", "domain": "FACE", "dataType": "BOOLEAN",
            "values": values, "faceCount": len(values),
            "trueCount": sum(values), "association": "unique oriented original face identity"}


def restore_sharp_face(me, before, after):
    plan = sharp_face_restore_plan(before, after)
    if plan is None:
        return {"restored": False, "reason": "field absent in original or already present"}
    if me.attributes.get(plan["name"]) is not None:
        raise ValueError("refuse to overwrite existing native sharp_face")
    attr = me.attributes.new(name=plan["name"], type=plan["dataType"], domain=plan["domain"])
    if attr.name != "sharp_face" or attr.is_required or len(attr.data) != plan["faceCount"]:
        raise ValueError("native sharp_face creation differs from exact original schema")
    for row, value in zip(attr.data, plan["values"]):
        row.value = value
    me.update()
    actual = [typed_value(row) for row in attr.data]
    expected = [{"value": {"rnaType": "BOOLEAN", "array": False, "value": v}} for v in plan["values"]]
    if actual != expected:
        raise AssertionError("native sharp_face values failed exact typed readback")
    return {k: v for k, v in dict(plan, restored=True).items() if k != "values"}


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

"""Actual INT16_2D preservation after deformation and setter roundtrip."""
import hashlib
import json
import math
import sys
from pathlib import Path
import facecage_geometry as G

sys.path.insert(0,str(Path(__file__).resolve().parents[5]/'tools/pixel-pipeline/next'))
import mesh_preservation as P


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()


class NormalFailure(AssertionError):
    def __init__(self,message,report):
        super().__init__(message); self.report=report


def encoded(mesh):
    attrs=[a for a in mesh.attributes if a.name in ('custom_normal','.custom_normal')]
    if len(attrs)!=1:
        raise ValueError('one actual encoded custom-normal attribute required')
    a=attrs[0]
    schema={'name':a.name,'domain':a.domain,'dataType':a.data_type,'required':bool(a.is_required),'count':len(a.data)}
    if a.domain!='CORNER' or a.data_type!='INT16_2D' or len(a.data)!=len(mesh.loops):
        raise ValueError('unsupported actual normal attribute schema: '+repr(schema))
    values=[]
    for row in a.data:
        typed=P.typed_value(row)
        if set(typed)!={'value'} or typed['value']['rnaType']!='INT' or typed['value']['array'] is not True:
            raise ValueError('unsupported native INT16_2D value RNA')
        pair=typed['value']['value']
        if len(pair)!=2 or any(type(v)!=int or not -32768<=v<=32767 for v in pair):
            raise ValueError('invalid encoded signed16 pair')
        values.append(tuple(pair))
    return schema,values


def decoded(mesh):
    rows=[tuple(n.vector) for n in mesh.corner_normals]
    if len(rows)!=len(mesh.loops) or any(len(n)!=3 or not all(math.isfinite(v) for v in n) for n in rows):
        raise ValueError('finite actual decoded corner normals/count required')
    return rows


def preservable(before,deform,target):
    if not len(before)==len(deform)==len(target):
        raise ValueError('normal support/target count changed')
    return [i for i,(a,b,c) in enumerate(zip(before,deform,target)) if a==b and a==c]


def correct(obj,original,candidate,points,final_cfg,protected_vertices):
    schema,old_pairs=encoded(original); old=decoded(original)
    protected=[l.index for l in original.loops if l.vertex_index in protected_vertices]
    obj.data=candidate; candidate.update()
    ds,deform_pairs=encoded(candidate); deform=decoded(candidate)
    target=[tuple(G.transport_normal(points[l.vertex_index],n,final_cfg)) for l,n in zip(original.loops,old)]
    if any(len(n)!=3 or not all(math.isfinite(v) for v in n) for n in target):
        raise ValueError('nonfinite intended final-field target normal')
    keep=preservable(old,deform,target)
    candidate.normals_split_custom_set(target); candidate.update(); obj.data=candidate
    ss,setter_pairs=encoded(candidate); setter=decoded(candidate)
    attr=candidate.attributes.get(schema['name'])
    if ds!=schema or ss!=schema:
        raise ValueError('normal setter changed native encoded schema')
    for i in keep:
        attr.data[i].value=old_pairs[i]
    candidate.update(); obj.data=candidate
    fs,final_pairs=encoded(candidate); actual=decoded(candidate)
    if fs!=schema:
        raise ValueError('normal pair restoration changed native schema')
    mismatch=lambda a,b:[i for i,(x,y) in enumerate(zip(a,b)) if x!=y]
    differences={'deformOnlyDecoded':mismatch(old,deform),'setterDecoded':mismatch(old,setter),
                 'finalDecoded':mismatch(old,actual),'targetVsFinalDecoded':mismatch(target,actual),
                 'deformOnlyEncoded':mismatch(old_pairs,deform_pairs),'setterEncoded':mismatch(old_pairs,setter_pairs),
                 'finalEncoded':mismatch(old_pairs,final_pairs)}
    rows=sorted(set().union(*(set(v) for v in differences.values())))
    report={'schema':schema,'cornerCount':len(old),'protectedOriginalCornerIndices':protected,
            'preservableCornerIndices':keep,'preservableEncodedOnlySetterChanges':[i for i in keep if setter_pairs[i]!=old_pairs[i] and setter[i]==old[i]],
            'decodedHashes':{k:digest(v) for k,v in (('original',old),('deformOnly',deform),('target',target),('setter',setter),('final',actual))},
            'fullEncodedHashes':{k:digest(v) for k,v in (('original',old_pairs),('deformOnly',deform_pairs),('setter',setter_pairs),('final',final_pairs))},
            'mismatchIndices':differences,'mismatchCounts':{k:len(v) for k,v in differences.items()},
            'completeMismatches':[{'cornerIndex':i,'vertexIndex':original.loops[i].vertex_index,'originalPoint':points[original.loops[i].vertex_index],
                'original':old[i],'deformOnly':deform[i],'target':target[i],'setter':setter[i],'final':actual[i],
                'encodedOriginal':old_pairs[i],'encodedDeformOnly':deform_pairs[i],'encodedSetter':setter_pairs[i],'encodedFinal':final_pairs[i]} for i in rows],
            'originalProtectedDecodedMismatchIndices':[i for i in protected if actual[i]!=old[i]],
            'originalProtectedEncodedMismatchIndices':[i for i in protected if final_pairs[i]!=old_pairs[i]],
            'preservableDecodedMismatchIndices':[i for i in keep if actual[i]!=old[i]],
            'preservableEncodedMismatchIndices':[i for i in keep if final_pairs[i]!=old_pairs[i]],
            'targetMethod':'G.transport_normal with the same FINAL continuous config used for head and hidden refs',
            'guardContract':'exact decoded+encoded ALL ORIGINAL P0/anatomy; newly pinned originally active support stays within ORIGINAL active normal footprint; no tolerance/omission waiver'}
    failures=[key for key in ('originalProtectedDecodedMismatchIndices','originalProtectedEncodedMismatchIndices',
                              'preservableDecodedMismatchIndices','preservableEncodedMismatchIndices') if report[key]]
    report['passed']=not failures
    if failures:
        raise NormalFailure('actual original/P0 or complete preservable normal guard failed: '+','.join(failures),report)
    return report

"""Original P0 is immutable; conservative full-polygon stars set one field."""
import copy
import math
import facecage_geometry as G


class SupportFailure(ValueError):
    def __init__(self,message,report):
        super().__init__(message); self.report=report


def plan(points,faces,original,anatomy):
    if any(len(p)!=3 or not all(math.isfinite(v) for v in p) for p in points):
        raise ValueError('nonfinite actual source head coordinates')
    if any(len(f)<3 or len(set(f))!=len(f) or any(type(i)!=int or not 0<=i<len(points) for i in f) for f in faces):
        raise ValueError('invalid actual oriented polygon source identities')
    if not anatomy or any(type(i)!=int or not 0<=i<len(points) for i in anatomy):
        raise ValueError('explicit actual neck anatomy required')
    p0={i for i,p in enumerate(points) if G.move(tuple(p),original)==tuple(p)}
    back=original.get('backProtectionY',original['eyeY']+.60*original['span'])
    regions={'neck':{i for i in p0 if points[i][2]<=original['neckProtectedThrough']}|set(anatomy),
             'crown':{i for i in p0 if points[i][2]>=original['crownProtectedFrom']},
             'back':{i for i in p0 if points[i][1]>=back}}
    stars={}; star_faces={}
    for region,vertices in regions.items():
        star_faces[region]=[i for i,f in enumerate(faces) if set(f)&vertices]
        stars[region]=vertices|{v for i in star_faces[region] for v in faces[i]}
        if not stars[region]:
            raise ValueError('actual original protected '+region+' polygon star absent')
    final=copy.deepcopy(original)
    final['neckProtectedThrough']=max(original['neckProtectedThrough'],max(points[i][2] for i in stars['neck']))
    final['crownProtectedFrom']=min(original['crownProtectedFrom'],min(points[i][2] for i in stars['crown']))
    final['backProtectionY']=min(back,min(points[i][1] for i in stars['back']))
    protected=p0|set(anatomy)
    record={'originalConfig':original,'finalConfig':final,'originalP0VertexIndices':sorted(p0),
            'explicitNeckAnatomyIndices':sorted(anatomy),'protectedOriginalVertexIndices':sorted(protected),
            'originalRegionVertexIndices':{k:sorted(v) for k,v in regions.items()},
            'fullPolygonStarVertexIndices':{k:sorted(v) for k,v in stars.items()},
            'fullPolygonStarFaceIndices':star_faces,
            'uncategorizedOriginalP0':sorted(p0-set().union(*regions.values())),
            'newlyPinnedOriginallyActiveSupportIndices':sorted(set().union(*stars.values())-protected),
            'normalGuardContract':'ALL original P0 plus explicit neck anatomy remain exact decoded and encoded; newly pinned originally active support stays in ORIGINAL active normal footprint, with complete preservable-pair restoration; no original protected corner removed',
            'hypothesis':'full original polygon stars are conservative support, not an inferred Blender smoothing fan; actual strict native guard decides'}
    def reject(message):
        record.update(status='support-plane-rejected',failure=message)
        raise SupportFailure(message,record)
    if not all(math.isfinite(v) for v in final.values()):
        reject('nonfinite final continuous field config')
    if final['neckProtectedThrough']>=final['eyeZ']-.20*final['span']:
        reject('neck support leaves insufficient facial space')
    if final['crownProtectedFrom']<=final['eyeZ']+.30*final['span']:
        reject('crown support consumes orbital-to-crown taper space')
    if final['backProtectionY']<=final['eyeY']-.10*final['span']:
        reject('back support consumes front/back taper space')
    if any(G.move(points[i],final)!=points[i] for i in protected|set().union(*stars.values())):
        reject('final shared field moves protected original/support vertices')
    record['status']='source-support-plan-derived-native-guard-pending'
    return final,record

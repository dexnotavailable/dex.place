"""Finite rest-geometry eligibility; no raster, guide or guessed chest box."""
import math


def finite(values):
    if not all(math.isfinite(float(x)) for x in values):
        raise ValueError("nonfinite geometry/ray payload")


def cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def area(poly):
    return sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1]))*.5


def intersect_segments(a,b,c,d):
    def on(a,b,p):
        return cross(a,b,p)==0 and all(min(a[k],b[k])<=p[k]<=max(a[k],b[k]) for k in (0,1))
    u,v,w,z=cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)
    return u*v<0 and w*z<0 or any((on(a,b,c),on(a,b,d),on(c,d,a),on(c,d,b)))


def triangles(points):
    """Ear clipping a simple X/Z projection, retaining actual source indices."""
    for p in points:
        finite(p)
    p=[(q[0],q[2]) for q in points]
    n=len(p)
    if n<3 or len(set(p))!=n or area(p)==0:
        raise ValueError("degenerate projected polygon")
    for i in range(n):
        for j in range(i+1,n):
            if j in (i,(i+1)%n) or i==(j+1)%n:
                continue
            if intersect_segments(p[i],p[(i+1)%n],p[j],p[(j+1)%n]):
                raise ValueError("non-simple projected polygon")
    left=list(range(n)) if area(p)>0 else list(reversed(range(n)))
    out=[]
    while len(left)>3:
        found=False
        for k,b in enumerate(left):
            a,c=left[k-1],left[(k+1)%len(left)]
            if cross(p[a],p[b],p[c])<=0:
                continue
            if any(all(cross(p[u],p[v],p[t])>=0 for u,v in ((a,b),(b,c),(c,a)))
                   for t in left if t not in (a,b,c)):
                continue
            out.append((a,b,c)); left.pop(k); found=True; break
        if not found:
            # Collinear perimeter samples may be removed for triangulation only.
            k=next((k for k,b in enumerate(left) if cross(p[left[k-1]],p[b],p[left[(k+1)%len(left)]])==0),None)
            if k is None:
                raise ValueError("projected triangulation is ambiguous")
            left.pop(k)
    if len(left)!=3 or cross(*(p[i] for i in left))<=0:
        raise ValueError("invalid final projected triangle")
    return out+[tuple(left)]


def clip(subject, target):
    """Positive-area convex intersection; touching edges/points are ineligible."""
    out=list(subject)
    for a,b in zip(target,target[1:]+target[:1]):
        src,out=out,[]
        if not src:
            break
        prev=src[-1]; dp=cross(a,b,prev)
        for cur in src:
            dc=cross(a,b,cur)
            if (dc>=0)!=(dp>=0):
                t=dp/(dp-dc)
                out.append(tuple(prev[k]+t*(cur[k]-prev[k]) for k in (0,1)))
            if dc>=0:
                out.append(cur)
            prev,dp=cur,dc
    return out if len(out)>=3 and abs(area(out))>0 else []


def depth(tri, p):
    q=[(v[0],v[2]) for v in tri]
    den=cross(*q)
    if den==0:
        raise ValueError("zero-area depth triangle")
    weights=(cross(q[1],q[2],p)/den,cross(q[2],q[0],p)/den,cross(q[0],q[1],p)/den)
    return sum(w*v[1] for w,v in zip(weights,tri))


def select(vertices, faces, normals, inner, distance):
    """Front body faces whose projected area lies strictly behind the real rim.

    Every positive-area triangle intersection has its depth checked at all
    clipped vertices. Reject ties, opposite faces and any mixed-depth overlap.
    Selected POINT samples are exactly all vertices of eligible polygons;
    support is the complete incident-face set needed for interpolation.
    """
    finite([distance])
    if distance<=0 or len(faces)!=len(normals):
        raise ValueError("invalid distance/normal source")
    for p in vertices:
        finite(p)
    for n in normals:
        finite(n)
    rimtris=[[inner[i] for i in t] for t in triangles(inner)]
    selected=[]; intersections=0
    for index,(face,normal) in enumerate(zip(faces,normals)):
        if len(face)<3 or len(set(face))!=len(face) or any(type(i)!=int or not 0<=i<len(vertices) for i in face):
            raise ValueError("invalid source polygon identity/index")
        if normal[1]>=0:
            continue
        points=[vertices[i] for i in face]
        xs=[p[0] for p in points]; zs=[p[2] for p in points]
        if max(xs)<min(p[0] for p in inner) or min(xs)>max(p[0] for p in inner) or max(zs)<min(p[2] for p in inner) or min(zs)>max(p[2] for p in inner):
            continue
        eligible=False; invalid=False
        for t in triangles(points):
            bodytri=[points[i] for i in t]
            for rimtri in rimtris:
                overlap=clip([(p[0],p[2]) for p in bodytri],[(p[0],p[2]) for p in rimtri])
                if not overlap:
                    continue
                gaps=[depth(bodytri,p)-depth(rimtri,p) for p in overlap]
                finite(gaps)
                if any(g<=0 or g>distance for g in gaps):
                    invalid=True
                else:
                    eligible=True; intersections+=1
        if eligible and not invalid:
            selected.append(index)
    points=sorted({i for f in selected for i in faces[f]})
    support=[i for i,f in enumerate(faces) if set(f)&set(points)]
    if not selected or len(selected)==len(faces) or not points or len(points)==len(vertices):
        raise ValueError("opening needs a finite strict-subset front-body patch")
    return {"selectedFaces":selected,"selectedPoints":points,"supportFaces":support,
            "positiveAreaIntersections":intersections,
            "method":"actual rest ring X/Z polygon intersection; front -Y normals; strict 0<bodyY-ringY<=actual body AO distance; all selected-face vertices and incident interpolation faces"}


def ray_value(distances, distance, strength, crease):
    finite([distance,strength,crease])
    if distance<=0 or not 0<=strength<=1 or not 0<=crease<=1 or len(distances)!=24:
        raise ValueError("canonical 24-ray body AO settings required")
    hits=[d for d in distances if d is not None]
    finite(hits)
    if any(d<0 or d>distance for d in hits):
        raise ValueError("ray distance outside declared segment")
    occurrence=sum(1-(d/distance)**2 for d in hits)
    return max(0.0,min(1.0,(1-strength*occurrence/24)*(1-crease)))

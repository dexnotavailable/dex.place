"""FC1 semantic orbital/midface/jaw cage, in preserved head rest space.

Same field for skin and hidden placement refs; never changes rig or pixels.
"""
import math


def smooth(a,b,v):
    t = min(1.0,max(0.0,(v-a)/(b-a)))
    return t*t*(3-2*t)


def config(chin, top, eyes, neck_top=None):
    if len(eyes)!=2 or any(len(e)!=3 for e in eyes):
        raise ValueError("two real rest eye anchors required")
    if not all(math.isfinite(v) for v in (chin,top,*eyes[0],*eyes[1])):
        raise ValueError("finite rest landmarks required")
    ex,ey,ez = [sum(e[j] for e in eyes)/2 for j in range(3)]
    span = ez-chin
    if not .06<span<.18 or not ez+.05<top<chin+.40 or abs(ex)>.003 or eyes[0][0]*eyes[1][0]>=0:
        raise ValueError("unexpected canonical adult anime rest landmark proportions")
    protected = max(chin+.025*span,neck_top if neck_top is not None else chin+.025*span)
    if not math.isfinite(protected) or protected>=ez-.20*span:
        raise ValueError("neck protection leaves insufficient facial cage space")
    return {"chin":chin,"top":top,"eyeY":ey,"eyeZ":ez,"span":span,
        "orbitalLiftSpan":.14,"orbitalWidthGain":.03,"jawWidthReduction":.10,
        "bridgeForwardSpan":.02,"neckProtectedThrough":protected,
        "crownProtectedFrom":min(top-.02,ez+.65*span)}


def move(p,c,enabled=True):
    if not enabled:
        return p
    if len(p)!=3 or not all(math.isfinite(v) for v in p):
        raise ValueError("invalid face point")
    x,y,z = p
    d = c["span"]
    if z<=c["neckProtectedThrough"] or z>=c["crownProtectedFrom"] or y>=c["eyeY"]+.60*d:
        return p
    gate = smooth(c["neckProtectedThrough"],max(c["neckProtectedThrough"]+.12*d,c["chin"]+.20*d),z)
    gate *= 1-smooth(c["eyeZ"]+.30*d,c["crownProtectedFrom"],z)
    gate *= smooth(c["eyeY"]+.60*d,c["eyeY"]-.10*d,y)
    orbit = math.exp(-((z-c["eyeZ"])/(.36*d))**2)
    jaw = math.exp(-((z-(c["chin"]+.34*d))/(.26*d))**2)
    bridge = math.exp(-((z-(c["chin"]+.61*d))/(.21*d))**2)*math.exp(-(x/(.21*d))**2)
    return (x*(1+gate*(c["orbitalWidthGain"]*orbit-c["jawWidthReduction"]*jaw)),
        y-gate*c["bridgeForwardSpan"]*d*bridge,
        z+gate*c["orbitalLiftSpan"]*d*orbit)


def jacobian(p,c):
    # Transport the existing decoded custom normal; do not regenerate normals.
    if move(p,c)==p:
        return ((1.,0.,0.),(0.,1.,0.),(0.,0.,1.))
    eps = 1e-6
    cols = []
    for j in range(3):
        a,b = list(p),list(p)
        a[j]-=eps
        b[j]+=eps
        fa,fb = move(a,c),move(b,c)
        cols.append(tuple((fb[i]-fa[i])/(2*eps) for i in range(3)))
    return tuple(tuple(cols[j][i] for j in range(3)) for i in range(3))


def determinant(m):
    a,b,c = m
    return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0])


def transport_normal(p,n,c):
    j = jacobian(p,c)
    det = determinant(j)
    if not math.isfinite(det) or not .35<det<2.0:
        raise ValueError("cage Jacobian folded or overstrained")
    a,b,d = j
    # Cofactor matrix = inverse transpose times determinant.
    cof = ((b[1]*d[2]-b[2]*d[1],b[2]*d[0]-b[0]*d[2],b[0]*d[1]-b[1]*d[0]),
           (a[2]*d[1]-a[1]*d[2],a[0]*d[2]-a[2]*d[0],a[1]*d[0]-a[0]*d[1]),
           (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]))
    if move(p,c)==p:
        return n
    v = tuple(sum(row[i]*n[i] for i in range(3)) for row in cof)
    length = math.sqrt(sum(x*x for x in v))
    if not math.isfinite(length) or length<1e-8:
        raise ValueError("invalid normal transport")
    return tuple(x/length for x in v)


def validate(points,triangles,c,require_change=True):
    candidate = tuple(move(p,c) for p in points)
    changed = [i for i,(a,b) in enumerate(zip(points,candidate)) if a!=b]
    if not changed and require_change:
        raise ValueError("cage changes no geometry")
    for i in changed:
        displacement = math.dist(points[i],candidate[i])
        if displacement>.17*c["span"]:
            raise ValueError("fixed cage exceeds its declared displacement")
        det = determinant(jacobian(points[i],c))
        if not .35<det<2.0:
            raise ValueError("cage Jacobian folded or overstrained")
    def normal(a,b,d):
        u = [b[i]-a[i] for i in range(3)]
        v = [d[i]-a[i] for i in range(3)]
        return (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    for tri in triangles:
        if len(tri)!=3 or any(not 0<=i<len(points) for i in tri):
            raise ValueError("invalid actual triangulation")
        if not any(i in changed for i in tri):
            continue
        a,b,d = tri
        old = normal(points[a],points[b],points[d])
        new = normal(candidate[a],candidate[b],candidate[d])
        aa,bb = sum(x*x for x in old),sum(x*x for x in new)
        if aa<=1e-18 or bb<.20*aa or sum(x*y for x,y in zip(old,new))<=0:
            raise ValueError("actual head triangle degenerates/flips")
    return candidate,{"changedVertices":len(changed),"changedIndices":changed,
        "maxDisplacementM":max((math.dist(points[i],candidate[i]) for i in changed),default=0),
        "method":"FC1 fixed smooth rest-space orbital/midface/jaw cage; no pixel or rig edit"}

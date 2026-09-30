"""Bounded orthographic projection/sample mathematics; not a renderer."""
import math
import numpy as np

MAX_SAMPLES = 8192


def check_shot(actual, expected):
    for key in ("px", "ss", "canvas", "anchor"):
        if actual[key] != expected[key]:
            raise ValueError("frozen camera field differs: "+key)
    if actual["px"] != 144 or actual["ss"] != 4:
        raise ValueError("one first144/ss4 camera required")
    for key in ("ppm", "height_m"):
        if not math.isfinite(actual[key]) or abs(actual[key]-expected[key]) > 1e-6:
            raise ValueError("frozen camera field differs: "+key)
    for key in ("loc", "right", "up", "fwd"):
        a, b = np.asarray(actual["cam"][key],float), np.asarray(expected["cam"][key],float)
        if a.shape != (3,) or not np.isfinite(a).all() or np.max(np.abs(a-b)) > 1e-6:
            raise ValueError("frozen camera basis differs: "+key)


def project(points, shot):
    p = np.asarray(points,float)
    if p.ndim != 2 or p.shape[1] != 3 or not np.isfinite(p).all():
        raise ValueError("finite world coordinates required")
    x = shot["anchor"][0]+p@np.asarray(shot["cam"]["right"])*shot["ppm"]
    y = shot["anchor"][1]-p@np.asarray(shot["cam"]["up"])*shot["ppm"]
    return np.column_stack((x,y))


def footprint(triangles, shot):
    """Union of triangle-covered ss4 pixel centres, bounded to the canvas.

    Triangle edges/raster jitter are explicitly not GPU coverage proof.
    """
    ts = np.asarray(triangles,float)
    if ts.ndim != 3 or ts.shape[1:] != (3,2) or not len(ts) or not np.isfinite(ts).all():
        raise ValueError("finite projected hand triangles required")
    ss = shot["ss"]
    lo = np.maximum(0,np.floor(ts.min((0,1))*ss).astype(int))
    hi = np.minimum(np.asarray(shot["canvas"])*ss,np.ceil(ts.max((0,1))*ss).astype(int))
    if np.any(hi<=lo) or int(np.prod(hi-lo)) > MAX_SAMPLES:
        raise ValueError("hand footprint empty/outside or exceeds bounded sample budget")
    yy,xx = np.mgrid[lo[1]:hi[1],lo[0]:hi[0]]
    samples = np.column_stack((xx.ravel(),yy.ravel()))
    centres = (samples+.5)/ss
    covered = np.zeros(len(samples),bool)
    projected_area = 0.0
    degenerate = 0
    for a,b,c in ts:
        u,v = b-a,c-a
        denominator = u[0]*v[1]-u[1]*v[0]
        if denominator == 0:
            degenerate += 1
            continue
        projected_area += abs(denominator)/2
        delta = centres-a
        s = (delta[:,0]*v[1]-delta[:,1]*v[0])/denominator
        t = (u[0]*delta[:,1]-u[1]*delta[:,0])/denominator
        covered |= (s>=0)&(t>=0)&(s+t<=1)
    hits = samples[covered]
    native_counts = {}
    for x,y in hits:
        cell = (int(x//ss),int(y//ss))
        native_counts[cell] = native_counts.get(cell,0)+1
    return hits, {"boundsNative": [*ts.min((0,1)).tolist(),*ts.max((0,1)).tolist()],
        "centreCoveredSupersamples":len(hits),"anyCentreCoveredNativeCells":len(native_counts),
        "handOnlyCentreAlpha45NativeCells":sum(n/(ss*ss)>=.45 for n in native_counts.values()),
        "summedTriangleAreaNativePx2OverlapCounted":projected_area,"zeroAreaProjectedTriangles":degenerate,
        "limits":"centre samples and summed areas are diagnostics, not exact raster/jitter or visibility-floor acceptance"}


def ray_for(sample, shot, clip_start):
    x,y = (np.asarray(sample,float)+.5)/shot["ss"]
    w,h = shot["canvas"]
    right,up,fwd = (np.asarray(shot["cam"][k],float) for k in ("right","up","fwd"))
    origin = np.asarray(shot["cam"]["loc"],float)+right*((x-w/2)/shot["ppm"])+up*((h/2-y)/shot["ppm"])+fwd*clip_start
    return origin,fwd


def render_policy(record):
    if record["hideRender"] or record["renderLayerExcluded"]:
        return "excluded", []
    uncertainty = []
    if record["cameraVisible"] is False:
        if record.get("cameraVisibilitySupported") is True:
            return "excluded", []
        uncertainty.append("camera-ray visibility semantics not proven for active renderer")
    if not record["viewportVisible"]:
        uncertainty.append("viewport-hidden render-visible geometry may differ in the viewport depsgraph")
    if record["modifierVisibilityMismatch"]:
        uncertainty.append("viewport/render modifier flags differ")
    return "possible", uncertainty


def classify_hits(hits):
    ordered = sorted(hits,key=lambda row:row["depthM"])
    known = next((row for row in ordered if row["opacity"]=="categorical-opaque" and not row["uncertainties"]),None)
    before = [row for row in ordered if known is None or row["depthM"]<=known["depthM"]]
    ambiguous = any(row["opacity"]!="categorical-opaque" or row["uncertainties"] for row in before)
    return {"nearestGeometricHit":ordered[0] if ordered else None,
            "knownOpaqueCentreCandidate":known,"possibleBlockers":before[:8],
            "ambiguousBeforeKnownCandidate":ambiguous,
            "truncatedPossibleBlockers":len(before)>8}

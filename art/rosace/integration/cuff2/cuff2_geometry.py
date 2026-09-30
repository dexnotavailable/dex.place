"""Cuff2 fixed 55 mm upper-loft refit, measured in the parent axial span.

Pure source coordinates. Row 0 and sin(phi)<=-.35 are exact; rows 1..22
in the other sectors may move. No topology, radial or pose reconstruction.
"""
import math

ROWS, COLUMNS = 22, 30
RETREAT_M = 0.055
MIN_GAP_M = 1e-5


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def sector(column):
    value = math.sin(2*math.pi*column/COLUMNS)
    t = min(1.0, max(0.0, (value+0.35)/0.70))
    return t*t*(3.0-2.0*t)


def loft_faces():
    return tuple((i*COLUMNS+k, i*COLUMNS+(k+1)%COLUMNS,
                  (i+1)*COLUMNS+(k+1)%COLUMNS, (i+1)*COLUMNS+k)
                 for i in range(ROWS) for k in range(COLUMNS))


def validate_loft(points, faces, axis):
    if len(points) != (ROWS+1)*COLUMNS or len(faces) != ROWS*COLUMNS:
        raise ValueError("Cuff2 requires the unique F3 22x30 indexed loft")
    if any(len(p) != 3 or not all(type(v) in (int, float) and math.isfinite(v) for v in p) for p in points):
        raise ValueError("finite three-component rest coordinates required")
    if len(axis) != 3 or not all(type(v) in (int, float) and math.isfinite(v) for v in axis) or abs(dot(axis, axis)-1.0) > 1e-6:
        raise ValueError("finite unit shoulder-to-wrist axis required")
    cells = {frozenset(face): face for face in loft_faces()}
    seen = set()
    for face in faces:
        if len(face) != 4 or any(type(v) is not int or not 0 <= v < len(points) for v in face):
            raise ValueError("integer quad corner schema required")
        key = frozenset(face)
        if key not in cells or key in seen:
            raise ValueError("missing, duplicate or wrong ring cell")
        seen.add(key)
        cell = cells[key]
        reverse = tuple(reversed(cell))
        allowed = {cell[i:]+cell[:i] for i in range(4)} | {reverse[i:]+reverse[:i] for i in range(4)}
        if tuple(face) not in allowed:
            raise ValueError("bow-tie quad corner order")
    gaps = tuple(dot(sub(points[(i+1)*COLUMNS+k], points[i*COLUMNS+k]), axis)
                 for i in range(ROWS) for k in range(COLUMNS))
    if any(not math.isfinite(g) or g <= MIN_GAP_M for g in gaps):
        raise ValueError("parent axial gaps must be finite, positive and above 10 micrometres")
    return gaps


def validate_azimuth(points, axis, shoulder):
    """F3 uses world front=-Y/up=+Z; verify every source ring's order.

    Project those basis vectors orthogonal to the actual source axis and solve
    for h/v. F3's elliptical/fluted radii may vary, their signs and winding may
    not. This rejects an index shift/reflection without relying on face count.
    """
    if len(shoulder) != 3 or not all(math.isfinite(v) for v in shoulder):
        raise ValueError("finite source shoulder required")
    front, up = (0.0, -1.0, 0.0), (0.0, 0.0, 1.0)
    f = tuple(v-dot(front, axis)*a for v, a in zip(front, axis))
    u = tuple(v-dot(up, axis)*a for v, a in zip(up, axis))
    ff, uu, fu = dot(f, f), dot(u, u), dot(f, u)
    determinant = ff*uu-fu*fu
    if determinant <= 1e-12:
        raise ValueError("source F3 front/up basis collapses around this axis")
    for row in range(ROWS+1):
        radial = []
        for k in range(COLUMNS):
            delta = sub(points[row*COLUMNS+k], shoulder)
            df, du = dot(delta, f), dot(delta, u)
            h, v = (df*uu-du*fu)/determinant, (du*ff-df*fu)/determinant
            if not all(math.isfinite(x) for x in (*delta, df, du, h, v)):
                raise ValueError("nonfinite computed azimuth coordinates")
            phi = 2*math.pi*k/COLUMNS
            # Cardinal zeros are float32 in the native source mesh. Sign checks
            # on all non-cardinal components remain strict.
            if (abs(math.cos(phi)) > 1e-12 and h*math.cos(phi) <= 0) or (abs(math.sin(phi)) > 1e-12 and v*math.sin(phi) <= 0):
                raise ValueError("source azimuth signs/index semantics differ")
            radial.append((h, v))
        for a, b in zip(radial, radial[1:]+radial[:1]):
            orientation = a[0]*b[1]-a[1]*b[0]
            if not math.isfinite(orientation) or orientation <= 0:
                raise ValueError("nonfinite, duplicate or reversed source azimuth order")


def positive_orientation(before, after, kind):
    if not all(math.isfinite(v) for v in (*before, *after)):
        raise ValueError("nonfinite computed cuff "+kind)
    values = (dot(before,before), dot(after,after), dot(before,after))
    if not all(math.isfinite(v) for v in values):
        raise ValueError("nonfinite computed cuff "+kind)
    if any(v <= 0 for v in values):
        raise ValueError("degenerate or reversed cuff "+kind)


def audit(points, candidate, faces, axis):
    """Reject axial compression, either diagonal's triangles, or corner folds."""
    gaps = validate_loft(points, faces, axis)
    if len(candidate) != len(points) or any(len(p) != 3 or not all(math.isfinite(v) for v in p) for p in candidate):
        raise ValueError("invalid candidate coordinate schema")
    ratios, minimum = [], float("inf")
    for i in range(ROWS):
        for k in range(COLUMNS):
            gap = dot(sub(candidate[(i+1)*COLUMNS+k], candidate[i*COLUMNS+k]), axis)
            before = gaps[i*COLUMNS+k]
            if not math.isfinite(gap) or gap < max(MIN_GAP_M, 0.25*before):
                raise ValueError("Cuff2 axial compression/reversal: reject fixed 55 mm, do not retune")
            ratios.append(gap/before)
            minimum = min(minimum, gap)
    triangles = 0
    for face in faces:
        # Both possible native quad diagonals, plus all four bilinear corners.
        tri_indices = ((0,1,2), (0,2,3), (0,1,3), (1,2,3))
        for ia, ib, ic in tri_indices:
            a, b, c = face[ia], face[ib], face[ic]
            before = cross(sub(points[b], points[a]), sub(points[c], points[a]))
            after = cross(sub(candidate[b], candidate[a]), sub(candidate[c], candidate[a]))
            positive_orientation(before,after,"triangle/Jacobian")
            triangles += 1
        for k in range(4):
            a, b, c = face[k], face[(k+1)%4], face[(k-1)%4]
            before = cross(sub(points[b], points[a]), sub(points[c], points[a]))
            after = cross(sub(candidate[b], candidate[a]), sub(candidate[c], candidate[a]))
            positive_orientation(before,after,"corner Jacobian")
    return {"minAxialGapM": minimum, "minAxialGapRatio": min(ratios),
            "trianglesChecked": triangles, "cornerJacobiansChecked": 4*len(faces)}


def deform(points, faces, axis, enabled):
    if type(enabled) is not bool:
        raise ValueError("explicit boolean Cuff2 mode required")
    if not enabled:
        return points, {"enabled": False, "changedVertices": 0, "maxRetreatM": 0.0, "construction": "cuff2"}
    validate_loft(points, faces, axis)
    spans = [dot(sub(points[ROWS*COLUMNS+k], points[k]), axis) for k in range(COLUMNS)]
    if any(not math.isfinite(span) or span <= 0 for span in spans):
        raise ValueError("finite positive actual column span required")
    factors = [1.0-RETREAT_M*sector(k)/spans[k] for k in range(COLUMNS)]
    if any(not math.isfinite(factor) or factor < 0.25 for factor in factors):
        raise ValueError("actual span cannot retain 25 percent of each axial gap at fixed 55 mm")
    candidate, changed, shifts = [], [], []
    for index, point in enumerate(points):
        row, column = divmod(index, COLUMNS)
        progress = dot(sub(point, points[column]), axis)/spans[column]
        if row == 0 or sector(column) == 0:
            amount, result = 0.0, point
        else:
            amount = RETREAT_M*sector(column)*progress
            result = tuple(v-amount*a for v, a in zip(point, axis))
        candidate.append(result)
        if amount:
            changed.append(index)
            shifts.append(amount)
    report = audit(points, candidate, faces, axis)
    report.update(enabled=True, construction="cuff2", changedVertices=len(changed), changedIndices=changed,
                  requestedRetreatM=RETREAT_M, maxRetreatM=max(shifts),
                  actualColumnSpansM=spans, retainedColumnFactors=factors,
                  protectedRows=[0], refittedRows=[1, ROWS],
                  protectedSector="sin(phi)<=-0.35: lower bell, cross and anchor",
                  method="55mm * azimuth sector * normalized actual axial progress; whole upper loft",
                  radialMethod="coordinate displacement is parallel to supplied shoulder-wrist axis")
    return candidate, report

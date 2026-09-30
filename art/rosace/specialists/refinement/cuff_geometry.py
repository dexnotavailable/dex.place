"""C1: retreat the upper cuff mouth, retaining the hanging bell.

Pure rest-space coordinate construction; no bpy, image input or pose edits.
Indices are the preserved F3 sleeve loft's row/azimuth order, not screen space.
"""
import math

ROWS = 22
COLUMNS = 30
RETREAT_M = 0.055
START_T = 0.65


def smooth(a, b, value):
    t = min(1.0, max(0.0, (value - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def loft_faces():
    return [tuple((i*COLUMNS+k, i*COLUMNS+(k+1)%COLUMNS,
                   (i+1)*COLUMNS+(k+1)%COLUMNS, (i+1)*COLUMNS+k))
            for i in range(ROWS) for k in range(COLUMNS)]


def validate_loft(points, faces, axis):
    if len(points) != (ROWS+1)*COLUMNS or len(faces) != ROWS*COLUMNS:
        raise ValueError("C1 requires the preserved F3 22x30 sleeve loft")
    if any(len(p) != 3 or not all(math.isfinite(v) for v in p) for p in points):
        raise ValueError("invalid rest coordinates")
    if len(axis) != 3 or not all(math.isfinite(v) for v in axis) or abs(dot(axis, axis)-1) > 1e-6:
        raise ValueError("unit finite shoulder-to-wrist rest axis required")
    expected = {frozenset(face) for face in loft_faces()}
    actual = [frozenset(face) for face in faces]
    if len(set(actual)) != len(actual) or set(actual) != expected:
        raise ValueError("unexpected ring connectivity or vertex order")
    cells = {frozenset(face): face for face in loft_faces()}
    for face in faces:
        if len(face) != 4:
            raise ValueError("quad loft required")
        cell = cells[frozenset(face)]
        cyclic = {cell[i:]+cell[:i] for i in range(4)}
        reverse = tuple(reversed(cell))
        cyclic.update(reverse[i:]+reverse[:i] for i in range(4))
        if tuple(face) not in cyclic:
            raise ValueError("bow-tie corner order")
    gaps = [dot(sub(points[(i+1)*COLUMNS+k], points[i*COLUMNS+k]), axis)
            for i in range(ROWS) for k in range(COLUMNS)]
    if min(gaps) <= 1e-5:
        raise ValueError("parent loft does not advance along its source axis")
    return gaps


def deform(points, faces, axis, enabled):
    """No-op returns the original container; enabled construction is fixed C1."""
    if type(enabled) is not bool:
        raise ValueError("explicit bool mode required")
    if not enabled:
        return points, {"enabled": False, "changedVertices": 0, "maxRetreatM": 0.0}
    gaps = validate_loft(points, faces, axis)
    candidate, changed, shifts = [], [], []
    for index, point in enumerate(points):
        row, column = divmod(index, COLUMNS)
        phi = 2*math.pi*column/COLUMNS
        amount = RETREAT_M * smooth(START_T, 1.0, row/ROWS) * smooth(-0.35, 0.35, math.sin(phi))
        result = tuple(value-amount*direction for value, direction in zip(point, axis)) if amount else point
        candidate.append(result)
        if amount:
            changed.append(index)
            shifts.append(amount)
    ratios, minimum = [], float("inf")
    for i in range(ROWS):
        for k in range(COLUMNS):
            gap = dot(sub(candidate[(i+1)*COLUMNS+k], candidate[i*COLUMNS+k]), axis)
            before = gaps[i*COLUMNS+k]
            if gap < max(1e-5, 0.25*before):
                raise ValueError("C1 compresses/reverses a longitudinal row; reject, do not retune")
            ratios.append(gap/before)
            minimum = min(minimum, gap)
    # Preserve each triangle's orientation; no face-index or winding rewrite.
    for face in faces:
        for tri in ((face[0],face[1],face[2]), (face[0],face[2],face[3])):
            a,b,c = tri
            before = cross(sub(points[b],points[a]), sub(points[c],points[a]))
            after = cross(sub(candidate[b],candidate[a]), sub(candidate[c],candidate[a]))
            if dot(before,before) <= 1e-16 or dot(after,after) <= 1e-16 or dot(before,after) <= 0:
                raise ValueError("degenerate or reversed cuff triangle")
    if not changed or max(shifts) > RETREAT_M+1e-12:
        raise ValueError("invalid C1 displacement")
    return candidate, {"enabled": True, "changedVertices": len(changed),
        "changedIndices": changed, "maxRetreatM": max(shifts),
        "minAxialGapM": minimum, "minAxialGapRatio": min(ratios),
        "proximalThroughRow": math.floor(START_T*ROWS),
        "protectedSector": "sin(phi)<=-0.35: lower bell, cross and anchor untouched",
        "method": "axial retreat only, smooth upper mouth; fixed rest-space C1"}

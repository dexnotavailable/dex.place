"""Pure topology plan for an actual chest aperture, without native execution."""
import math
from collections import defaultdict


def edge_counts(faces):
    result = defaultdict(int)
    for face in faces:
        for a, b in zip(face, face[1:] + face[:1]):
            result[tuple(sorted((a, b)))] += 1
    return result


def closed_loop(edges):
    adjacent = defaultdict(list)
    for a, b in edges:
        adjacent[a].append(b)
        adjacent[b].append(a)
    if not adjacent or any(len(n) != 2 for n in adjacent.values()):
        raise ValueError("aperture must make one closed boundary, separate from existing garment borders")
    start = min(adjacent)
    loop, previous, current = [], None, start
    while current not in loop:
        loop.append(current)
        nxt = [n for n in adjacent[current] if n != previous][0]
        previous, current = current, nxt
    if current != start or len(loop) != len(adjacent):
        raise ValueError("aperture has multiple loops or a non-simple boundary")
    return loop


def plan(vertices, faces, top, bottom, half_width=.044, rim_width=.005):
    height = top[2] - bottom[2]
    if not .08 < height < .16 or abs(top[0]) > .01 or abs(bottom[0]) > .01:
        raise ValueError("expected the preserved sternum anchors and their118mm span")
    centre = [(a+b)*.5 for a, b in zip(top, bottom)]
    removed = []
    for i, face in enumerate(faces):
        p = [sum(vertices[j][k] for j in face)/len(face) for k in range(3)]
        diamond = abs(p[0]-centre[0])/half_width + abs(p[2]-centre[2])/(height*.5)
        # The X/Z diamond alone would also cut a back panel. Anchors sit at
        # the front sternum; restrict the cut to that anterior surface.
        if diamond < 1 and p[1] <= centre[1] + .025:
            removed.append(i)
    if not removed:
        raise ValueError("no front bodice faces intersect the intended opening")
    kill = set(removed)
    retained = [face for i, face in enumerate(faces) if i not in kill]
    before, after = edge_counts(faces), edge_counts(retained)
    boundary = [edge for edge, count in after.items() if count == 1 and before[edge] == 2]
    if any(after.get(e, 0) != n for e, n in before.items() if n == 1):
        raise ValueError("cut joins an existing garment edge; not an enclosed window")
    loop = closed_loop(boundary)
    # The gold strip overlaps cloth only, outside the actual cut edge. Both
    # loops share corresponding vertex weights and shape-key deltas.
    inner = [vertices[i] for i in loop]
    outer = []
    for p in inner:
        dx, dz = p[0]-centre[0], p[2]-centre[2]
        length = math.hypot(dx, dz)
        if length <= rim_width:
            raise ValueError("degenerate aperture boundary")
        outer.append([p[0]+rim_width*dx/length, p[1]-.0008, p[2]+rim_width*dz/length])
    return {"removedFaces": removed, "retainedFaces": [i for i in range(len(faces)) if i not in kill],
            "loop": loop, "inner": inner, "outer": outer, "centre": centre,
            "halfWidthMeters": half_width, "heightMeters": height, "rimWidthMeters": rim_width}

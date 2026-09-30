"""Exact construction interface, never nearest-coordinate membership."""
import collections
import math
import struct


class BoundaryFailure(AssertionError):
    def __init__(self, message, report):
        super().__init__(message)
        self.report = report


def point_key(point):
    if len(point) != 3 or any(not math.isfinite(v) for v in point):
        raise ValueError('finite three-dimensional native point required')
    # Native coordinates are stored float32. Reject a higher precision guessed
    # point rather than round it into a match; signed zero remains byte exact.
    packed = struct.pack('<3f', *point)
    if tuple(struct.unpack('<3f', packed)) != tuple(point):
        raise ValueError('actual float32 coordinates required')
    return packed


def boundary(points, polygons):
    usage = collections.defaultdict(list)
    for fi, face in enumerate(polygons):
        if len(face) < 3 or len(set(face)) != len(face) or any(type(i) is not int or not 0 <= i < len(points) for i in face):
            raise ValueError('actual unique polygon vertices required')
        for a, b in zip(face, (*face[1:], face[0])):
            usage[tuple(sorted((a, b)))].append((a, b, fi))
    if any(len(v) > 2 for v in usage.values()):
        raise ValueError('nonmanifold construction mesh')
    for rows in usage.values():
        if len(rows) == 2 and rows[0][:2] != rows[1][:2][::-1]:
            raise ValueError('inconsistent polygon orientation')
    directed = {(v[0][0], v[0][1]): v[0][2] for v in usage.values() if len(v) == 1}
    adjacent = collections.defaultdict(set)
    for a, b in directed:
        adjacent[a].add(b); adjacent[b].add(a)
    if any(len(v) != 2 for v in adjacent.values()):
        raise ValueError('boundary is not disjoint closed simple rings')
    outgoing=collections.Counter(a for a,b in directed)
    incoming=collections.Counter(b for a,b in directed)
    if any(outgoing[i]!=1 or incoming[i]!=1 for i in adjacent):
        raise ValueError('boundary needs exactly one incoming and outgoing halfedge')
    components = []
    left = set(adjacent)
    while left:
        seed = min(left); todo = [seed]; found = set()
        while todo:
            i = todo.pop()
            if i in found: continue
            found.add(i); todo.extend(adjacent[i] - found)
        left -= found
        components.append(sorted(found))
    return directed, components


def identify(head_points, head_faces, body_points, body_faces, head_weights, body_weights, expected_cut_count=30):
    report = {'expectedCutCount': expected_cut_count, 'membershipMethod': 'unique full float32 coordinate bijection of construction boundary rings; opposite oriented edges; exact Head/Neck weights', 'tolerance': 0}
    try:
        hd, hc = boundary(head_points, head_faces)
        bd, bc = boundary(body_points, body_faces)
        report.update(headBoundaryComponents=hc, bodyBoundaryComponents=bc)
        def index(points):
            result = collections.defaultdict(list)
            for i, p in enumerate(points): result[point_key(p)].append(i)
            return result
        hi, bi = index(head_points), index(body_points)
        shared = set(hi) & set(bi)
        if any(len(hi[k]) != 1 or len(bi[k]) != 1 for k in shared):
            raise ValueError('ambiguous coincident vertex identity')
        mapping = {hi[k][0]: bi[k][0] for k in shared}
        report['allExactSharedVertexPairs'] = sorted(mapping.items())
        matches = [(h, b) for h in hc for b in bc if len(h) == expected_cut_count and set(h) <= set(mapping) and {mapping[i] for i in h} == set(b)]
        if len(matches) != 1:
            raise ValueError('one unambiguous construction cut-ring required')
        head_ring, body_ring = matches[0]
        if set(mapping) != set(head_ring):
            raise ValueError('unexpected exact shared vertices outside cut-ring')
        ring_set = set(head_ring)
        for a, b in hd:
            if a not in ring_set: continue
            if (mapping[b], mapping[a]) not in bd:
                raise ValueError('split interface lacks opposite boundary orientation')
        for i in head_ring:
            h, b = head_weights[i], body_weights[mapping[i]]
            if set(h) != {'J_Bip_C_Head', 'J_Bip_C_Neck'} or h != b or any(not math.isfinite(v) or not 0 < v < 1 for v in h.values()):
                raise ValueError('cut-ring exact mixed Head/Neck weight construction identity differs')
        # The body boundary's only incident faces must be the construction
        # zipper triangles. Their other vertices form the 16-vertex body ring.
        bridge_faces = {fi for (a, b), fi in bd.items() if a in set(body_ring)}
        bridge = [body_faces[i] for i in sorted(bridge_faces)]
        other = set().union(*(set(f) for f in bridge)) - set(body_ring)
        if any(len(f) != 3 for f in bridge):
            raise ValueError('body-side cut interface is not triangular zipper bridge')
        # Some zipper triangles touch only one cut vertex, not an interface
        # edge; derive the full strip by adjacency to the exact cut ring.
        all_bridge = {i for i, f in enumerate(body_faces) if set(f) & set(body_ring)}
        full = [body_faces[i] for i in sorted(all_bridge)]
        other = set().union(*(set(f) for f in full)) - set(body_ring)
        if len(full) != 46 or len(other) != 16 or any(len(f) != 3 or not 1 <= len(set(f) & set(body_ring)) <= 2 for f in full):
            raise ValueError('canonical 30/16/46 zipper construction membership differs')
        _, strip_components = boundary(body_points, full)
        if {frozenset(c) for c in strip_components} != {frozenset(body_ring), frozenset(other)}:
            raise ValueError('zipper strip lacks exact 30/16 closed boundary cycles')
        report.update(headCutRingIndices=head_ring, bodyCutRingIndices=body_ring, headToBodyVertexPairs=sorted(mapping.items()), bodyBridgeFaceIndices=sorted(all_bridge), bodyLowerRingIndices=sorted(other), constructionCounts={'cut': len(head_ring), 'bodyRing': len(other), 'bridgeTriangles': len(full)}, passed=True)
        return report
    except (ValueError, AssertionError) as error:
        report.update(passed=False, failure=str(error))
        raise BoundaryFailure(str(error), report) from error


def anatomy(points, edges, weights):
    seam = {i for i, row in enumerate(weights) if row.get('J_Bip_C_Neck', 0) > 0}
    protected = set(seam)
    for edge in edges:
        if set(edge) & seam: protected.update(edge)
    if not seam: raise ValueError('actual positive Neck-weight anatomy missing')
    return seam, protected

"""Small pure validation for actual fabric simulation/baked-sprite evidence."""
import math


def validate(config):
    if config.get("contract") != "dex.cloth/1" or config.get("fps") != 60:
        raise ValueError("cloth contract must be dex.cloth/1 at60fps")
    if config.get("warmupFrames", 0) < 30:
        raise ValueError("cloth requires chronological warmup before export")
    if config["settings"].get("use_dynamic_mesh") is not False:
        raise ValueError("free hems may not inherit animated rest-shape targets")
    for name in ("use_collision", "use_self_collision"):
        if not config["collisions"].get(name):
            raise ValueError(f"missing fabric collision requirement {name}")
    if len(config["garments"]) != 3 or len({g["object"] for g in config["garments"]}) != 3:
        raise ValueError("tabard and two bell sleeves must be separate declared fabric pieces")
    if config["pinFractionMaximum"] > 0.15 or config["pinToleranceMeters"] <= 0:
        raise ValueError("pins must be restricted to attachment seams")
    for value in (*config["gravity"], *config["settings"].values(), *config["wind"]["direction"]):
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("nonfinite fabric setting")
    clips = set(config["requiredClips"])
    for transition in config["requiredTransitions"]:
        if any(part not in clips for part in transition.split("->")):
            raise ValueError("fabric transition endpoint has no required clip")
    return True


def boundary_vertices(edges):
    counts = {}
    for face in edges:
        for i, a in enumerate(face):
            edge = tuple(sorted((a, face[(i + 1) % len(face)])))
            counts[edge] = counts.get(edge, 0) + 1
    return sorted({i for edge, n in counts.items() if n == 1 for i in edge})


def boundary_components(faces):
    counts = {}
    for face in faces:
        for i, a in enumerate(face):
            edge = tuple(sorted((a, face[(i + 1) % len(face)])))
            counts[edge] = counts.get(edge, 0) + 1
    graph = {}
    for (a, b), count in counts.items():
        if count == 1:
            graph.setdefault(a, set()).add(b)
            graph.setdefault(b, set()).add(a)
    components = []
    remaining = set(graph)
    while remaining:
        stack, seen = [min(remaining)], set()
        while stack:
            vertex = stack.pop()
            if vertex not in seen:
                seen.add(vertex)
                stack.extend(graph[vertex] - seen)
        remaining -= seen
        components.append(sorted(seen))
    return components


def seam_indices(vertices, boundary, kind, tolerance, shoulder=None, axis=None, components=None):
    if kind == "top-boundary":
        top = max(vertices[i][2] for i in boundary)
        return [i for i in boundary if vertices[i][2] >= top - tolerance]
    if kind == "upper-arm-opening" and shoulder is not None and axis is not None:
        if not components or len(components) != 2:
            raise ValueError("sleeve needs two separate complete boundary loops")
        def mean_axis(loop):
            return sum(sum((a - b) * d for a, b, d in zip(vertices[i], shoulder, axis))
                       for i in loop) / len(loop)
        return min(components, key=mean_axis)
    raise ValueError("unknown/missing attachment seam frame")

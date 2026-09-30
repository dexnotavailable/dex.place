"""Liturgy N1/N2 geometry and clocks. No GPU, app, asset writes or renderer imports.

Host emits strike/contact once, with current root and actual contact/tip coordinates.
All geometry is authored H-space (skull-to-sole), +x facing, +y down from feet.
FX ticks are monotonic wall ticks at 60 Hz; actor clocks may stop independently.
Output is a capped palette scene, not a baked sprite or damage definition.
"""
from dataclasses import dataclass, replace
import math

PALETTE = {
    "A0": "#0d1240", "A1": "#1a2f8c", "A2": "#2a62d0",
    "A3": "#4aa8f0", "A4": "#a0e6ff", "A5": "#f0fcff",
    "G0": "#fff3c4", "G1": "#ecc96f", "G2": "#d1a452",
    "W3": "#b7aecb", "W4": "#8b80a6",
}
CLIPS = {
    "m1_1": {"strike": 8, "active": (8, 10), "contact": 9,
             "boxes": ((-100/96, -44/96, 150/96, 44/96),
                       (40/96, -120/96, 100/96, 120/96),
                       (20/96, -168/96, 104/96, 48/96)),
             "dust": (-1.3, 1.6), "dust_life": 19, "particle_life": 22},
    "m1_2": {"strike": 7, "active": (7, 9), "contact": 8,
             "boxes": ((-120/96, -82/96, 240/96, 58/96),),
             "dust": (-1.45, 1.45), "dust_life": 14, "particle_life": 23},
}
CAPS = {"smears": 2, "contacts": 4, "panes": 6,
        "commands": 160, "points": 4096, "lights": 3}


def lerp(a, b, t):
    return tuple(x + (y-x)*t for x, y in zip(a, b))


def cubic(a, b, c, d, n=16):
    return [tuple((1-t)**3*a[k] + 3*(1-t)**2*t*b[k] +
                  3*(1-t)*t*t*c[k] + t**3*d[k] for k in (0, 1))
            for t in (i/n for i in range(n+1))]


def n1_path():
    # A smooth floor scrape, rising face, and hooked tip. No L-corner/slab.
    p = cubic((-100/96, -.025), (-.6, -.025), (.15, -.025), (.52, -.16))
    p += cubic((.52, -.16), (1.0, -.34), (140/96, -.56), (140/96, -.9))[1:]
    p += cubic((140/96, -.9), (140/96, -1.2), (1.4, -1.6),
               (124/96, -168/96))[1:]
    return p


def ellipse_path(front):
    # MOVESET cosmetic span 2.6H; the hit remains 2.5H. No damage overscan.
    angles = [i*math.pi/32 for i in range(33)]
    if not front:
        angles = [-a for a in angles]
    cy = (-82/96 - 24/96)/2
    return [(1.3*math.cos(a), cy + .25*math.sin(a)) for a in angles]


def ribbon(path, peak_width, centre):
    """Inner edge points toward the hips; width tapers at both ends."""
    distances = [0.0]
    for a, b in zip(path, path[1:]):
        distances.append(distances[-1] + math.dist(a, b))
    total = distances[-1]
    left, right = min(p[0] for p in path), max(p[0] for p in path)
    top = min(p[1] for p in path)
    inner = []
    for i, p in enumerate(path):
        age = 1-distances[i]/total
        peak = .16
        profile = (age/peak)**.55 if age < peak else ((1-age)/(1-peak))**1.5
        width = max(1/144, peak_width*profile)
        a, b = path[max(0, i-1)], path[min(len(path)-1, i+1)]
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = math.hypot(dx, dy)
        nx, ny = -dy/length, dx/length
        if nx*(centre[0]-p[0]) + ny*(centre[1]-p[1]) < 0:
            nx, ny = -nx, -ny
        inner.append((min(right, max(left, p[0]+nx*width)),
                      max(top, min(-.005, p[1]+ny*width))))
    return inner


def stage(age):
    if age == 0:
        return "full"
    if age <= 6:
        return "leaded"
    if age <= 17:
        return "shards"
    return "slivers"


@dataclass(frozen=True)
class Strike:
    instance: str
    clip: str
    tick: int
    root_h: tuple
    facing: int = 1
    tip_h: tuple | None = None  # root-relative, already in world-facing orientation


@dataclass(frozen=True)
class Contact:
    instance: str
    clip: str
    tick: int
    target: str
    point_h: tuple  # actual world contact, never an inferred arc endpoint
    actor_frame: int  # 1-based active frame; wall age can exceed2 during hitstop
    tip_h: tuple | None = None  # actual world tip at this collision, not strike time


class LiturgyFX:
    """One per actor. Keep this state across N1->N2/cancels; reset on actor despawn.

    Input events use stable move-instance ids, not clip ids. Dedup history lasts 180
    ticks, so repeating an old event is invalid; hosts must not replay stale events.
    Call emit_strike before emit_contact on the same wall tick.
    """
    def __init__(self):
        self.strikes = []
        self.contacts = []
        self.panes = []
        self.retiring_panes = []
        self.seen = {}
        self.last_tick = -1
        self.dropped = 0
        self.smear_roots = {}
        self.actor_root_h = (0, 0)

    def emit_strike(self, event):
        if event.clip not in CLIPS or event.facing not in (-1, 1):
            raise ValueError("supported clip/facing required")
        self._validate_event(event.tick, event.root_h)
        if event.tip_h is not None:
            self._validate_point(event.tip_h)
        key = ("strike", event.instance)
        if key in self.seen:
            return []
        self.seen[key] = event.tick
        self.strikes.append(event)
        self.strikes = self.strikes[-CAPS["smears"]:]
        self.smear_roots[event.instance] = event.root_h
        self.actor_root_h = event.root_h
        return []  # actor-timed swishes come from beat_cues(), not the collision clock

    def emit_contact(self, event):
        self._validate_event(event.tick, event.point_h)
        if event.tip_h is not None:
            self._validate_point(event.tip_h)
        parent = next((s for s in reversed(self.strikes) if s.instance == event.instance), None)
        if parent is None or event.clip != parent.clip:
            raise ValueError("contact requires matching emitted strike")
        lo, hi = CLIPS[event.clip]["active"]
        if event.tick < parent.tick or not lo <= event.actor_frame <= hi:
            raise ValueError("contact outside active actor window; emit on real collision")
        key = ("contact", event.instance, event.target)
        if key in self.seen:
            return []
        self.seen[key] = event.tick
        first = ("group", event.instance) not in self.seen
        self.contacts.append((event, parent))
        self.contacts = self.contacts[-CAPS["contacts"]:]
        cues = []
        if first:
            self.seen[("group", event.instance)] = event.tick
            tip = parent.tip_h or ((124/96, -168/96) if parent.clip == "m1_1"
                                        else (1.3, -53/96))
            # One decorative pane per connecting move, never per target.
            pane_point = (parent.root_h[0]+tip[0], parent.root_h[1]+tip[1]) if parent.tip_h else (
                parent.root_h[0]+tip[0]*parent.facing, parent.root_h[1]+tip[1])
            if event.tip_h is not None:
                pane_point, source = event.tip_h, "actual-contact-tip"
            else:
                source = "strike-tip-snapshot" if parent.tip_h else "authored-guide-not-live"
            self.panes.append((event.tick, pane_point, event.instance, source))
            if len(self.panes) > CAPS["panes"]:
                oldest = self.panes.pop(0)
                self.retiring_panes.append((event.tick-150, oldest[1], oldest[2], oldest[3]))
                self.retiring_panes = self.retiring_panes[-2:]
                self.dropped += 1
            cues = [{"kind": "sound", "id": "glass.chime.1" if event.clip == "m1_1"
                     else "glass.chime.2", "instance": event.instance, "route": "contact"},
                    {"kind": "camera", "push_h": parent.facing/96,
                     "instance": event.instance, "route": "contact"}]
        return cues

    @staticmethod
    def _validate_point(p):
        if len(p) != 2 or not all(math.isfinite(v) for v in p):
            raise ValueError("finite H point required")

    def _validate_event(self, tick, p):
        if not isinstance(tick, int) or tick < 0 or tick < self.last_tick:
            raise ValueError("events require current/future monotonic integer wall tick")
        self._validate_point(p)

    def sample(self, tick, *, reduced_motion=False, reduce_flashing=False, live_tip_h=None,
               active_instance=None, active_root_h=None, active_actor_frame=None,
               actor_root_h=None, live_tip_depth=None):
        if not isinstance(tick, int) or tick < self.last_tick or tick < 0:
            raise ValueError("monotonic nonnegative wall tick required")
        if live_tip_h is not None:
            self._validate_point(live_tip_h)
        if live_tip_depth not in (None, "front", "back"):
            raise ValueError("native tip depth must be front/back")
        if actor_root_h is not None:
            self._validate_point(actor_root_h)
            self.actor_root_h = actor_root_h
        if active_root_h is not None:
            self._validate_point(active_root_h)
            parent = next((s for s in self.strikes if s.instance == active_instance), None)
            if parent is None or active_actor_frame is None:
                raise ValueError("active root requires emitted instance and actor frame")
            lo, hi = CLIPS[parent.clip]["active"]
            if lo <= active_actor_frame <= hi:
                self.smear_roots[active_instance] = active_root_h
            self.actor_root_h = active_root_h
        self.last_tick = tick
        self.strikes = [s for s in self.strikes if tick-s.tick <= 24]
        self.smear_roots = {s.instance: self.smear_roots[s.instance] for s in self.strikes}
        self.contacts = [(c, s) for c, s in self.contacts
                         if tick-c.tick < CLIPS[c.clip]["particle_life"]]
        self.panes = [p for p in self.panes if tick-p[0] < 168]
        self.retiring_panes = [p for p in self.retiring_panes if tick-p[0] < 168]
        self.seen = {k: t for k, t in self.seen.items() if tick-t <= 180}
        scene = {"schema": "rosace.fx.scene/1", "fx_tick": tick,
                 "coordinates": "world-H/+y-down", "commands": [], "lights": [],
                 "damage": [], "fullscreen_flash": False,
                 "reduced_motion": reduced_motion, "reduce_flashing": reduce_flashing,
                 "pane_evictions": self.dropped, "pane_anchors": []}
        for s in self.strikes:
            age = tick-s.tick
            if age < 0:
                continue
            self._smear(scene, replace(s, root_h=self.smear_roots[s.instance]), age,
                        reduced_motion, reduce_flashing)
            self._ground(scene, s, age, reduced_motion)
        for c, s in self.contacts:
            if tick < c.tick:
                continue
            self._contact(scene, c, s, tick-c.tick, reduced_motion, reduce_flashing)
        for born, p, instance, source in self.panes+self.retiring_panes:
            if tick >= born:
                self._pane(scene, p, tick-born, instance, source, reduced_motion)
        scene["lights"] = sorted(scene["lights"],
                                 key=lambda light: math.dist(light["point_h"], self.actor_root_h))[:2]
        # Latest strike owns the moving tip/rim cue. This needs live native anchors.
        active = [s for s in self.strikes if 0 <= tick-s.tick < 16]
        if active:
            s = active[-1]
            age = tick-s.tick
            if live_tip_h is not None:
                point = live_tip_h
                source = "live-tip"
            elif s.tip_h is not None:
                point = (s.root_h[0]+s.tip_h[0], s.root_h[1]+s.tip_h[1])
                source = "strike-snapshot-not-live"
            else:
                point = (s.root_h[0]+s.facing*(124/96 if s.clip == "m1_1" else 1.25),
                         s.root_h[1]+(-1.75 if s.clip == "m1_1" else -53/96))
                source = "authored-guide-not-live"
            if live_tip_depth is not None:
                rim_pass = live_tip_depth
            elif s.clip == "m1_1":
                rim_pass = "front"
            elif active_instance == s.instance and active_actor_frame is not None:
                rim_pass = "back" if active_actor_frame <= 7 else "front"
            else:
                rim_pass = "guide-unresolved-depth"
            scene["lights"].insert(0, {"kind": "tip-rim", "point_h": point,
                "color": "A4", "radius_h": (90 if s.clip == "m1_1" else 100)/96,
                "intensity": .6 if reduce_flashing else (1.4 if s.clip == "m1_1" else 1.0),
                "anchor_source": source, "requires_native_normal_or_edge_mask": True,
                "pass": rim_pass})
        scene["lights"] = scene["lights"][:CAPS["lights"]]
        # Deterministic degradation: keep main bodies/contacts, discard decoration first.
        commands = scene["commands"]
        if len(commands) > CAPS["commands"] or sum(len(c["points"]) for c in commands) > CAPS["points"]:
            budget, kept = 0, []
            for c in sorted(commands, key=lambda c: c["priority"], reverse=True):
                if len(kept) < CAPS["commands"] and budget+len(c["points"]) <= CAPS["points"]:
                    kept.append(c)
                    budget += len(c["points"])
            scene["commands"] = sorted(kept, key=lambda c: c["order"])
        scene["budget"] = {"commands": len(scene["commands"]),
                           "points": sum(len(c["points"]) for c in scene["commands"])}
        return scene

    @staticmethod
    def _put(scene, points, color, tag, *, layer="front", kind="polygon", width=1/96,
             priority=2, root=(0, 0), facing=1):
        scene["commands"].append({"kind": kind,
            "points": [(root[0]+x*facing, root[1]+y) for x, y in points],
            "color": color, "layer": layer, "width_h": width,
            "protect": "body-and-features" if layer == "front" else "behind-body",
            "tag": tag, "priority": priority, "order": len(scene["commands"])})

    def _smear(self, scene, s, age, reduced, flash):
        if age > (18 if s.clip == "m1_1" else 19):
            return
        paths = [(n1_path(), "front")] if s.clip == "m1_1" else [
            (ellipse_path(False), "back"), (ellipse_path(True), "front")]
        st = stage(age) if s.clip == "m1_2" or age < 17 else "slivers"
        for path, layer in paths:
            width = 12/96 if s.clip == "m1_1" else (11 if layer == "back" else 12)/96
            inner = ribbon(path, width, (0, -.53))
            n = len(path)-1
            if st in ("full", "leaded"):
                for cell in range(6):
                    a, b = cell*n//6, (cell+1)*n//6
                    code = ["A1", "A2", "A2", "A3", "A3", "A3"][cell]
                    if layer == "back" and code != "A1":
                        code = "A"+str(int(code[1:])-1)
                    mid = [lerp(path[i], inner[i], .55) for i in range(a, b+1)]
                    self._put(scene, path[a:b+1]+list(reversed(mid)), code, f"{s.clip}-{st}-body",
                              root=s.root_h, facing=s.facing, layer=layer, priority=5)
                    lower = "A"+str(max(1, int(code[1:])-1))
                    self._put(scene, mid+list(reversed(inner[a:b+1])), lower, f"{s.clip}-{st}-inner",
                              root=s.root_h, facing=s.facing, layer=layer, priority=5)
                    if st == "leaded" and cell > 0:
                        self._put(scene, [path[a], inner[a]], "A0", "glass-leading",
                                  kind="line", layer=layer, root=s.root_h, facing=s.facing)
                # A0 occurs only inside glass. Full smear has no dark outline.
                edge = "A4" if st == "leaded" or layer == "back" else "A5"
                if flash:
                    edge = "A4"
                self._put(scene, path[n//3:], edge, "cutting-edge", kind="line",
                          width=(2 if layer == "front" else 1)/96,
                          root=s.root_h, facing=s.facing, layer=layer, priority=5)
            elif st == "shards":
                for cell in range(6):
                    idx = (2*cell+1)*n//12
                    x, y = path[idx]
                    t = age-7
                    # Fixed per-cell trajectories; no frame-random sparkle/boiling.
                    if not reduced:
                        x += (cell-2.5)*.003*t
                        y += -.014*t + .002*t*t
                    half = (2+(cell % 2))/192
                    y = min(-half, y)  # collision with the floor; never fall through it
                    self._put(scene, [(x-half, y), (x, y-half*1.5), (x+half, y),
                                      (x+.3*half, y+half)],
                              "A2" if cell % 2 else "A3", "glass-shard",
                              root=s.root_h, facing=s.facing, layer=layer)
                    if not reduced and not flash and t == cell+1:
                        self._put(scene, [(x, y-half), (x, y-half+1/96)], "A5", "single-glint",
                                  kind="line", root=s.root_h, facing=s.facing, layer=layer, priority=1)
            elif not reduced:
                self._put(scene, path[-4:], "G1", "last-leading-sliver", kind="line",
                          root=s.root_h, facing=s.facing, layer=layer, priority=1)
            if not reduced and age <= 4:
                if s.clip == "m1_1":
                    for off, color in ((3/96, "G1"), (6/96, "G2")):
                        outside = []
                        for i in range(2*n//3, n+1):
                            dx, dy = path[i][0]-inner[i][0], path[i][1]-inner[i][1]
                            length = math.hypot(dx, dy) or 1
                            outside.append((path[i][0]+off*dx/length, path[i][1]+off*dy/length))
                        self._put(scene, outside, color, "gold-sliver", kind="line", root=s.root_h,
                                  facing=s.facing, layer=layer, priority=1)
                else:
                    # One upper/rear and one lower/front arc:0.65H total visible height.
                    offset = -.075 if layer == "back" else .075
                    self._put(scene, [(x, y+offset) for x, y in path], "G1", "gold-sliver",
                              kind="line", root=s.root_h, facing=s.facing, layer=layer, priority=1)

    def _ground(self, scene, s, age, reduced):
        spec = CLIPS[s.clip]
        if age < spec["dust_life"]:
            lo, hi = spec["dust"]
            # Whole simultaneous 2.9H band, with stepped tongues, no accumulated trail claim.
            pts = [(lo, 0), (lo+.06, -2/96), (lo+.25, -4/96),
                   (hi-.25, -4/96), (hi-.06, -2/96), (hi, 0)]
            self._put(scene, pts, "W4" if age > 7 else "W3", "ground-dust-2.9H",
                      root=s.root_h, facing=s.facing, layer="back", priority=3)
        if s.clip != "m1_1" or age > 24:
            return
        lo, hi = -100/96, 50/96
        for cell in range(6):
            a, b = lo+(hi-lo)*cell/6, lo+(hi-lo)*(cell+1)/6
            if age <= 12:
                self._put(scene, [(a, 0), (a, -4/96), (b, -4/96), (b, 0)],
                          "A2" if cell % 2 else "A3", "glass-furrow",
                          root=s.root_h, facing=s.facing, layer="back", priority=3)
                if age > 0 and cell > 0:
                    self._put(scene, [(a, 0), (a, -4/96)], "A0", "furrow-leading",
                              kind="line", root=s.root_h, facing=s.facing, layer="back")
            elif not reduced:
                t = age-13
                x, y = (a+b)/2, min(-.005, -.03-.01*t+.0015*t*t)
                self._put(scene, [(x-.012, y), (x, y-.018), (x+.012, y+.005)],
                          "A2", "furrow-shard", root=s.root_h, facing=s.facing, layer="back")

    def _contact(self, scene, c, s, age, reduced, flash):
        if age < 2:
            outer, inner = 4.5/96, 1.8/96
            points = []
            for i in range(16):
                r = outer if i % 2 == 0 else inner
                a = i*math.pi/8
                points.append((math.cos(a)*r, math.sin(a)*r))
            self._put(scene, points, "A4" if flash or reduced else "A5", "actual-contact-star",
                      root=c.point_h, priority=6)
        if reduced:
            return
        # Contact shards: distinct from the smear's glass cells, actual enemy origin.
        side = 1 if c.point_h[0] >= s.root_h[0] else -1
        for i in range(6):
            t = age
            vx = (.011+i*.002)*side
            vy = -.025-i*.003
            x, y = vx*t, vy*t+.0018*t*t
            half = (2+i % 2)/192
            y = min(y, s.root_h[1]-c.point_h[1]-half)
            self._put(scene, [(x-half, y), (x, y-half), (x+half, y), (x, y+half)],
                      "A2" if i % 2 else "A3", "contact-shard", root=c.point_h, priority=2)
        for i in range(3):
            x, y = (i-1)*.035, -.009*age-.02*i
            self._put(scene, [(x, y), (x, y+1/96)], "G0", "rising-mote", kind="line",
                      root=c.point_h, priority=1)

    def _pane(self, scene, p, age, instance, source, reduced):
        # 7x13 at H96, exact ratio at80/144; categorical palette raster downstream.
        w, h = 7/96, 13/96
        scene["pane_anchors"].append({"instance": instance, "point_h": p, "source": source})
        bob = 0 if reduced else (1/96 if age % 40 >= 20 else 0)
        if age >= 156:
            if not reduced and age < 166:
                t = age-156
                self._put(scene, [(-w/2, -h/2+.002*t*t), (0, -.012+.002*t*t),
                                  (w/2, .002*t*t)], "A2", "pane-decay-shard", root=p, priority=1)
            return
        shape = [(-w/2, bob), (-w/2, -h*.65+bob), (0, -h+bob),
                 (w/2, -h*.65+bob), (w/2, bob)]
        self._put(scene, shape, "A1", "contact-pane", root=p, priority=2)
        self._put(scene, [(-w/2, -h*.45+bob), (0, -h*.78+bob),
                          (w/2, -h*.45+bob), (0, bob)], "A3", "pane-cell", root=p)
        self._put(scene, [(0, -h+bob), (0, bob)], "A0", "pane-leading",
                  kind="line", root=p, priority=2)
        if age >= 150:
            self._put(scene, [(-w/2, -h*.45+bob), (w/2, -h*.45+bob)],
                      "A0", "pane-decay-leading", kind="line", root=p, priority=1)
        if age < 150:
            scene["lights"].append({"kind": "pane", "point_h": p, "color": "A4",
                                    "radius_h": 60/96, "intensity": .6, "instance": instance,
                                    "anchor_source": source})


def hit_boxes(clip, root_h=(0, 0), facing=1):
    """Reference-only collision boxes; the planner/controller remains damage owner."""
    if facing not in (-1, 1):
        raise ValueError("facing must be -1 or1")
    return [(root_h[0]+(x if facing == 1 else -x-w), root_h[1]+y, w, h)
            for x, y, w, h in CLIPS[clip]["boxes"]]


def raster_bounds(box, height_px):
    x, y, w, h = box
    return (math.floor(x*height_px), math.floor(y*height_px),
            math.ceil((x+w)*height_px), math.ceil((y+h)*height_px))


def beat_cues(clip, actor_frame):
    """Emit once on entry to an actor frame; never again on frozen clock samples."""
    sounds = {("m1_1", 7): ("silk.whoosh", "blade.swish"),
              ("m1_2", 1): ("silk.flutter.long",),
              ("m1_2", 7): ("blade.swish.low",),
              ("m1_2", 8): ("blade.swish.high",)}
    return [{"kind": "sound", "id": name, "route": "actor-beat"}
            for name in sounds.get((clip, actor_frame), ())]

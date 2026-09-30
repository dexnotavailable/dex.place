"""Delivery-only categorical raster/composite adapter. Importing it renders nothing.

Call only on a finite delivery-owned native request. Native sprite and body/feature
masks must share this canvas, foot origin and exact height. Never manufacture masks
from a stand-in. Source checks intentionally do not invoke this renderer.
"""
import math
from n1_n2_fx import PALETTE

BAYER4 = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


def nearest(value):
    return math.floor(value+.5) if value >= 0 else math.ceil(value-.5)


def validate_mask_bytes(alpha, body, feature, *, body_mode="L", feature_mode="L"):
    """Pure source guard; no image library/rendering needed to test unsafe masks."""
    if body_mode not in ("1", "L") or feature_mode not in ("1", "L"):
        raise ValueError("native masks must be explicit1/L binary masks, not RGB/RGBA")
    if not len(alpha) == len(body) == len(feature) or not alpha:
        raise ValueError("native alpha/masks must share a nonempty canvas")
    if any(v not in (0, 255) for channel in (alpha, body, feature) for v in channel):
        raise ValueError("native alpha/masks must be binary")
    if not any(body) or not any(feature):
        raise ValueError("actual body and protected-feature masks required")
    if any(a == 255 and b != 255 for a, b in zip(alpha, body)):
        raise ValueError("body mask must cover every opaque control-sprite pixel")


def primitive_bounds(xy, *, stroke_width=0):
    """Conservative envelope, including stroke thickness and its quantization."""
    radius = stroke_width/2
    return (min(x for x, y in xy)-radius, min(y for x, y in xy)-radius,
            max(x for x, y in xy)+radius, max(y for x, y in xy)+radius)


def composite(scene, sprite, body_mask, feature_mask, *, height_px, foot_px,
              camera_h=(0, 0)):
    """Returns (comparison images, measured overlap report); no files are written.

    Inputs are PIL Images supplied by delivery. Masks include alpha-opaque body,
    sleeves/tabards/weapon and protected face/hair silhouette/chest window/hands/
    grip/feet/lead-cloth feature pixels derived from native part ids. The features
    mask may extend beyond body alpha. Require actual per-frame part provenance.
    No lighting is applied here; live-anchor light cues are passed to integration.
    """
    from PIL import Image, ImageDraw  # dependency loaded only by the delivery renderer
    if height_px not in (80, 144):
        raise ValueError("this finite acceptance adapter supports H80/H144")
    sprite = sprite.convert("RGBA")
    if body_mask.size != sprite.size or feature_mask.size != sprite.size:
        raise ValueError("native sprite/masks must share exact canvas")
    body = body_mask.convert("L")
    feature = feature_mask.convert("L")
    validate_mask_bytes(sprite.getchannel("A").tobytes(), body.tobytes(), feature.tobytes(),
                        body_mode=body_mask.mode, feature_mode=feature_mask.mode)
    size = sprite.size
    back, front = Image.new("RGBA", size), Image.new("RGBA", size)
    touched = Image.new("L", size)
    clipped = []
    for cmd in scene["commands"]:
        if cmd["color"] not in PALETTE or cmd["kind"] not in ("line", "polygon"):
            raise ValueError("unknown categorical primitive")
        xy = [(nearest(foot_px[0]+(x-camera_h[0])*height_px),
               nearest(foot_px[1]+(y-camera_h[1])*height_px)) for x, y in cmd["points"]]
        width = max(1, nearest(cmd["width_h"]*height_px)) if cmd["kind"] == "line" else 0
        left, top, right, bottom = primitive_bounds(xy, stroke_width=width)
        if left < 0 or top < 0 or right >= size[0] or bottom >= size[1]:
            clipped.append(cmd["tag"])
        mask = Image.new("L", size)
        draw = ImageDraw.Draw(mask)
        if cmd["kind"] == "polygon":
            draw.polygon(xy, fill=255)
        else:
            draw.line(xy, fill=255, width=width)
        if cmd["layer"] == "front":
            pixels, bp, fp, tp = mask.load(), body.load(), feature.load(), touched.load()
            box = mask.getbbox()
            if box:
                for y in range(box[1], box[3]):
                    for x in range(box[0], box[2]):
                        if not pixels[x, y]:
                            continue
                        # Same screen-anchored quarter mask for every front primitive:
                        # overlaps can never accumulate beyond25% of body grid sites.
                        if fp[x, y] or (bp[x, y] and BAYER4[y % 4][x % 4] >= 4):
                            pixels[x, y] = 0
                        elif bp[x, y]:
                            tp[x, y] = 255
            front.paste(PALETTE[cmd["color"]], (0, 0), mask)
        elif cmd["layer"] == "back":
            mask.paste(0, (0, 0), feature)  # preserve protected negative space too
            back.paste(PALETTE[cmd["color"]], (0, 0), mask)
        else:
            raise ValueError("unknown depth layer")
    # The same control sprite is drawn between depth-separated FX layers.
    candidate = Image.alpha_composite(Image.alpha_composite(back, sprite), front)
    sp, cp, bp, fp, tp = (im.load() for im in (sprite, candidate, body, feature, touched))
    feature_changed = body_changed = body_count = features_count = 0
    body_grid_allowed = 0
    for y in range(size[1]):
        for x in range(size[0]):
            if bp[x, y]:
                body_count += 1
                body_changed += bool(tp[x, y])
                body_grid_allowed += not fp[x, y] and BAYER4[y % 4][x % 4] < 4
            if fp[x, y] and sp[x, y][3] == 255:
                features_count += 1
                feature_changed += sp[x, y] != cp[x, y]
    report = {"height_px": height_px, "foot_px": foot_px,
              "body_pixels": body_count, "front_fx_body_pixels": body_changed,
              "body_grid_allowed_pixels": body_grid_allowed,
              "opaque_feature_pixels": features_count,
              "opaque_feature_changed_pixels": feature_changed,
              "clipped_tags": sorted(set(clipped)), "clipping_kind": "conservative-stroke-envelope",
              "lights_applied": False,
              "alpha_filter": "binary palette masks; no resampling",
              "source_only_adapter": True}
    return {"control": sprite, "candidate": candidate, "back_fx": back,
            "front_fx": front, "touched_body": touched}, report

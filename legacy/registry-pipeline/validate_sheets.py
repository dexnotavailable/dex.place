"""Measure PNG animation sheets and export unchanged pixel crops for review.

Only writes into a NEW --output directory below this script's directory.
JSON measurements and native-size PNG crops are evidence; GIFs are lossy previews.
No resize, key removal, alpha thresholding, repaint, quantization of source/crops,
or runtime/public-asset publication is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw


REVIEW_ROOT = Path(__file__).resolve().parent
MAX_PREVIEW_EDGE = 4096
MAX_GIF_PIXELS = 32_000_000
MATTES = {"dark": (24, 35, 43), "light": (220, 226, 218)}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def bbox(mask: np.ndarray) -> list[int] | None:
    ys, xs = np.nonzero(mask)
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if len(xs) else None


def pair(text: str) -> tuple[int, int]:
    values = text.split(",")
    if len(values) != 2:
        raise argparse.ArgumentTypeError("Use two integer coordinates: x,y")
    try:
        return int(values[0]), int(values[1])
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Pivot coordinates must be integers") from exc


def checked_output(value: str) -> Path:
    raw = Path(value).absolute()
    resolved = raw.resolve()
    # resolve() follows existing symlinks/junctions as well as '..'. A newly
    # requested directory must remain inside the explicit production owner.
    if resolved == REVIEW_ROOT or not resolved.is_relative_to(REVIEW_ROOT):
        raise ValueError(f"Output must be a new subdirectory of {REVIEW_ROOT}")
    if raw.exists() or raw.is_symlink() or resolved.exists():
        raise ValueError("Output already exists; choose a new review directory")
    return resolved


def checker_candidates(rgba: np.ndarray) -> list[dict]:
    """Bounded opaque-corner heuristic. Absence is NOT a clean-alpha verdict."""
    h, w = rgba.shape[:2]
    candidates = []
    for block in (2, 4, 8, 16, 32):
        size = block * 2
        if size > min(w, h):
            continue
        for label, x, y in (("tl", 0, 0), ("tr", w-size, 0), ("bl", 0, h-size), ("br", w-size, h-size)):
            patch = rgba[y:y+size, x:x+size]
            if np.mean(patch[:, :, 3] >= 250) < .98:
                continue
            quads = [patch[dy:dy+block, dx:dx+block, :3].astype(np.float32)
                     for dy, dx in ((0, 0), (0, block), (block, 0), (block, block))]
            medians = [np.median(q.reshape(-1, 3), axis=0) for q in quads]
            uniform = all(np.mean(np.max(np.abs(q-m), axis=2) <= 12) >= .90 for q, m in zip(quads, medians))
            same = max(np.max(np.abs(medians[0]-medians[3])), np.max(np.abs(medians[1]-medians[2]))) <= 12
            contrast = float(np.max(np.abs(medians[0]-medians[1])))
            if uniform and same and contrast >= 16:
                candidates.append({"corner": label, "blockSize": block, "rgbContrast": contrast})
    return candidates


def measurements(frame: Image.Image, index: int, crop_rect: list[int]) -> dict:
    rgba = np.asarray(frame.convert("RGBA"))
    alpha = rgba[:, :, 3]
    count = alpha.size
    weights = alpha.astype(np.float64)
    total = float(weights.sum())
    ys, xs = np.indices(alpha.shape)
    corners = {label: rgba[y, x].tolist() for label, x, y in
               (("tl", 0, 0), ("tr", frame.width-1, 0), ("bl", 0, frame.height-1), ("br", frame.width-1, frame.height-1))}
    return {
        "index": index, "sourceRectXYXY": crop_rect,
        "rgbaPixelSha256": digest(rgba.tobytes()),
        "alphaBoundsXYXY": bbox(alpha > 0),
        "alpha128BoundsXYXY": bbox(alpha >= 128),
        "transparentPixels": int(np.sum(alpha == 0)),
        "partialAlphaPixels": int(np.sum((alpha > 0) & (alpha < 255))),
        "opaquePixels": int(np.sum(alpha == 255)),
        "alphaRange": [int(alpha.min()), int(alpha.max())],
        "coverageFraction": float(np.mean(alpha > 0)),
        "partialAlphaFraction": float(np.mean((alpha > 0) & (alpha < 255))),
        "rgbaCornerSamples": corners,
        "nonzeroRgbUnderZeroAlphaPixels": int(np.sum((alpha == 0) & np.any(rgba[:, :, :3] != 0, axis=2))),
        "alphaWeightedCentroidXY": [float((weights*xs).sum()/total), float((weights*ys).sum()/total)] if total else None,
        "edgeAlphaPixelCounts": {"top": int(np.sum(alpha[0] > 0)), "bottom": int(np.sum(alpha[-1] > 0)),
                                "left": int(np.sum(alpha[:, 0] > 0)), "right": int(np.sum(alpha[:, -1] > 0))},
        "possibleCheckerPatterns": checker_candidates(rgba), "pixelCount": count,
    }


def transition(a: Image.Image, b: Image.Image) -> dict:
    one, two = (np.asarray(im.convert("RGBA")).astype(np.float32) / 255 for im in (a, b))
    # Measure visible RGB rather than hidden RGB in transparent margins.
    one[:, :, :3] *= one[:, :, 3:4]
    two[:, :, :3] *= two[:, :, 3:4]
    delta = np.abs(one-two)
    return {"visiblePixelChangeFraction": float(np.mean(np.max(delta, axis=2) > 1/255)),
            "meanPremultipliedRgbaDelta": float(delta.mean())}


def contact_sheets(frames: list[Image.Image], output: Path, pivot: tuple[int, int]) -> list[str]:
    w, h = frames[0].size
    cellw, cellh = max(120, w+16), h+38
    if max(cellw, cellh) > MAX_PREVIEW_EDGE:
        return []
    cols = max(1, min(6, MAX_PREVIEW_EDGE // cellw))
    rows = max(1, MAX_PREVIEW_EDGE // cellh)
    per_page = cols * rows
    paths = []
    for matte_name, color in MATTES.items():
        for start in range(0, len(frames), per_page):
            group = frames[start:start+per_page]
            page_rows = (len(group)+cols-1)//cols
            page_cols = min(cols, len(group))
            sheet = Image.new("RGBA", (page_cols*cellw, page_rows*cellh), color+(255,))
            draw = ImageDraw.Draw(sheet)
            ink = (242, 244, 236) if matte_name == "dark" else (24, 35, 43)
            for number, frame in enumerate(group):
                x, y = (number % cols)*cellw+8, (number // cols)*cellh+24
                draw.text((x, y-18), f"{start+number:03d} / {w}x{h}", fill=ink)
                sheet.alpha_composite(frame.convert("RGBA"), (x, y))
                # Marks sit outside frame area; extracted PNGs have no overlays.
                px, py = x+pivot[0], y+pivot[1]
                draw.line((px, y+h+3, px, y+h+8), fill=(215, 65, 83), width=1)
                draw.line((x-6, py, x-2, py), fill=(215, 65, 83), width=1)
            name = f"contact-{matte_name}-{start//per_page+1:02d}.png"
            sheet.convert("RGB").save(output/name)
            paths.append(name)
    return paths


def gif_previews(frames: list[Image.Image], output: Path, durations: list[int], once: bool) -> list[str]:
    paths = []
    for matte_name, color in MATTES.items():
        images = []
        for frame in frames:
            matte = Image.new("RGBA", frame.size, color+(255,))
            matte.alpha_composite(frame.convert("RGBA"))
            images.append(matte.convert("RGB"))
        name = f"playback-{matte_name}.gif"
        options = {} if once else {"loop": 0}
        images[0].save(output/name, save_all=True, append_images=images[1:], duration=durations,
                       disposal=2, optimize=False, **options)
        paths.append(name)
    return paths


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Source PNG; never modified")
    parser.add_argument("--output", required=True, help="Fresh directory below this script's directory")
    parser.add_argument("--frame-width", required=True, type=int)
    parser.add_argument("--frame-height", required=True, type=int)
    parser.add_argument("--frames", "--count", required=True, type=int)
    parser.add_argument("--columns", type=int, help="Declared columns; otherwise derived from PNG width")
    parser.add_argument("--pivot", type=pair, help="Integer cell-space x,y; default bottom centre")
    parser.add_argument("--alpha-mode", choices=("hard", "soft", "opaque"), required=True)
    timing = parser.add_mutually_exclusive_group()
    timing.add_argument("--durations-ms", help="One duration per frame, comma separated")
    timing.add_argument("--frame-ms", type=int, default=125)
    parser.add_argument("--gif", action="store_true", help="Also make lossy dark/light native-size GIF previews")
    parser.add_argument("--once", action="store_true", help="Preview a non-looping clip; still report end-to-start delta")
    args = parser.parse_args(argv)
    try:
        output = checked_output(args.output)
        source = Path(args.input).resolve(strict=True)
        if not source.is_file():
            raise ValueError("Input must be a PNG file")
        if min(args.frame_width, args.frame_height, args.frames) < 1 or args.frames > 1024:
            raise ValueError("Cell dimensions must be positive; frames must be 1..1024")
        if args.columns is not None and args.columns < 1:
            raise ValueError("Columns must be positive")
        durations = [int(v.strip()) for v in args.durations_ms.split(",")] if args.durations_ms else [args.frame_ms]*args.frames
        if len(durations) != args.frames or any(d < 1 or d > 60000 for d in durations):
            raise ValueError("Provide exactly one duration per frame, each 1..60000 ms")
        pivot = args.pivot or (args.frame_width//2, args.frame_height)
        if not (0 <= pivot[0] <= args.frame_width and 0 <= pivot[1] <= args.frame_height):
            raise ValueError("Pivot must lie within or on the boundary of the frame cell")
        encoded = source.read_bytes()
        with Image.open(source) as opened:
            if opened.format != "PNG" or getattr(opened, "n_frames", 1) != 1:
                raise ValueError("Input must be a single-image PNG sheet, not APNG or another format")
            opened.load()
            sheet = opened.copy()
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        print(json.dumps({"status": "rejected", "error": str(exc)}), file=sys.stderr)
        return 2

    report = {
        "schemaVersion": 1, "source": str(source), "sourceEncodedSha256": digest(encoded),
        "sourceMode": sheet.mode, "sourceSize": list(sheet.size), "output": str(output),
        "cellSize": [args.frame_width, args.frame_height], "declaredFrames": args.frames,
        "pivotXY": list(pivot), "alphaMode": args.alpha_mode, "durationsMs": durations,
        "totalDurationMs": sum(durations), "loop": not args.once,
        "decodedRgbaBytes": sheet.width*sheet.height*4,
        "errors": [], "warnings": [], "frames": [], "transitions": [], "artifacts": {},
        "visualAcceptance": "pending: inspect actual pixels, frame registration, motion and integrated scene",
        "checkerHeuristic": "Opaque-corner two-colour pattern detector; absence never proves a clean cutout.",
        "cropContract": "Original source mode/pixels retained in crop PNGs; decoded RGBA equality rechecked. PNG encoded bytes differ.",
    }
    if sheet.width % args.frame_width or sheet.height % args.frame_height:
        report["errors"].append({"code": "grid_not_divisible"})
    cols, rows = sheet.width//args.frame_width, sheet.height//args.frame_height
    report["columns"], report["rows"] = cols, rows
    if args.columns is not None and args.columns != cols:
        report["errors"].append({"code": "column_count_mismatch", "actual": cols, "declared": args.columns})
    if args.frames > cols*rows:
        report["errors"].append({"code": "insufficient_grid_cells", "capacity": cols*rows})

    # No overwrite and no destructive cleanup, even on malformed sheets.
    output.mkdir(parents=True, exist_ok=False)
    if not report["errors"]:
        frames = []
        crops = output/"frames"
        crops.mkdir()
        for i in range(cols*rows):
            x, y = (i % cols)*args.frame_width, (i // cols)*args.frame_height
            rect = [x, y, x+args.frame_width, y+args.frame_height]
            frame = sheet.crop(tuple(rect))
            if i >= args.frames:
                if frame.convert("RGBA").getchannel("A").getbbox():
                    report["errors"].append({"code": "unused_nonempty_grid_cell", "index": i})
                continue
            row = measurements(frame, i, rect)
            if row["alphaBoundsXYXY"] is None:
                report["errors"].append({"code": "empty_frame", "frame": i})
            if args.alpha_mode == "hard" and row["partialAlphaPixels"]:
                report["errors"].append({"code": "soft_pixels_in_hard_asset", "frame": i, "count": row["partialAlphaPixels"]})
            if args.alpha_mode == "opaque" and row["opaquePixels"] != row["pixelCount"]:
                report["errors"].append({"code": "nonopaque_pixels_in_opaque_asset", "frame": i})
            if args.alpha_mode != "opaque" and row["transparentPixels"] == 0:
                report["warnings"].append({"code": "no_fully_transparent_pixels_in_cutout", "frame": i})
            if row["possibleCheckerPatterns"]:
                report["warnings"].append({"code": "possible_baked_checkerboard", "frame": i})
            name = f"frames/frame-{i:03d}.png"
            frame.save(output/name)
            with Image.open(output/name) as reopened:
                if reopened.convert("RGBA").tobytes() != frame.convert("RGBA").tobytes():
                    report["errors"].append({"code": "crop_pixel_roundtrip_failed", "frame": i})
            row["crop"] = name
            report["frames"].append(row)
            frames.append(frame)
        for i in range(len(frames)-1):
            report["transitions"].append({"from": i, "to": i+1, **transition(frames[i], frames[i+1])})
        report["loopSeam"] = {"from": len(frames)-1, "to": 0, **transition(frames[-1], frames[0])}
        report["artifacts"]["contactSheets"] = contact_sheets(frames, output, pivot)
        if not report["artifacts"]["contactSheets"]:
            report["warnings"].append({"code": "contact_sheet_skipped_large_cell", "note": "Review original-size frame crops; no automatic resize"})
        if args.gif:
            effective = [max(10, ((d+5)//10)*10) for d in durations]
            report["gifPreview"] = {"lossy": True, "alphaComposited": True, "effectiveDurationsMs": effective,
                                    "note": "GIF quantizes colours and timing and may merge duplicate frames; crop PNGs remain authoritative."}
            if effective != durations:
                report["warnings"].append({"code": "gif_timing_rounded_to_centiseconds"})
            if args.frame_width*args.frame_height*args.frames > MAX_GIF_PIXELS:
                report["warnings"].append({"code": "gif_skipped_decoded_pixel_limit", "limit": MAX_GIF_PIXELS})
            else:
                report["artifacts"]["gifPreviews"] = gif_previews(frames, output, effective, args.once)
    report["sourceUnchanged"] = digest(source.read_bytes()) == report["sourceEncodedSha256"]
    if not report["sourceUnchanged"]:
        report["errors"].append({"code": "source_changed_during_review"})
    report["status"] = "invalid" if report["errors"] else "measurements-ready-visual-review-required"
    (output/"report.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "report": str(output/"report.json"),
                      "frames": len(report["frames"]), "errors": len(report["errors"]),
                      "warnings": len(report["warnings"]), "sourceUnchanged": report["sourceUnchanged"]}))
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())

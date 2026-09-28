"""Extract an opaque magenta-keyed STRUCTURE plate without weakening interiors.

True background is a near-key/high-dominance mask. By default only its narrow
adjacent band receives soft alpha/key-colour unmixing. Explicit --spill-roi
permits separately reviewed foliage-gap correction. Everything outside the
declared regions retains source RGB and alpha255. Clouds are outside scope.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent


def integers(value: str) -> tuple[int, ...]:
    try:
        return tuple(int(item.strip()) for item in value.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Use comma-separated integers") from exc


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_output(value: str) -> Path:
    raw = Path(value).absolute()
    resolved = raw.resolve()
    if resolved == ROOT or not resolved.is_relative_to(ROOT):
        raise ValueError(f"Output must be a fresh subdirectory of {ROOT}")
    if raw.exists() or raw.is_symlink() or resolved.exists():
        raise ValueError("Output already exists; choose a new review directory")
    return resolved


def nearest_clean_rgb(rgb: np.ndarray, clean: np.ndarray, band: np.ndarray, radius: int) -> tuple[np.ndarray, np.ndarray]:
    """Find nearest unchanged foreground sample; no blur/repaint of interiors."""
    ys, xs = np.nonzero(band)
    found = np.zeros(len(xs), dtype=bool)
    values = np.zeros((len(xs), 3), dtype=np.float32)
    h, w = clean.shape
    offsets = sorted(((dy, dx) for dy in range(-radius, radius+1)
                      for dx in range(-radius, radius+1)), key=lambda p: p[0]*p[0]+p[1]*p[1])
    for dy, dx in offsets:
        todo = np.flatnonzero(~found)
        if not len(todo):
            break
        yy, xx = ys[todo]+dy, xs[todo]+dx
        valid = (yy >= 0) & (yy < h) & (xx >= 0) & (xx < w)
        todo, yy, xx = todo[valid], yy[valid], xx[valid]
        chosen = clean[yy, xx]
        values[todo[chosen]] = rgb[yy[chosen], xx[chosen]]
        found[todo[chosen]] = True
    return values, found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True, help="New review folder below this script's owner")
    parser.add_argument("--key-rgb", type=integers, default=(255, 0, 255))
    parser.add_argument("--key-tolerance", type=int, default=32,
                        help="Maximum per-channel distance from nominated magenta key")
    parser.add_argument("--min-dominance", type=int, default=220,
                        help="Minimum min(R,B)-G for true background, not for foreground")
    parser.add_argument("--edge-band", type=int, choices=(1, 2, 3), default=3)
    parser.add_argument("--clean-dominance", type=int, default=35,
                        help="Nearby foreground below this magenta dominance is preserved")
    parser.add_argument("--protect-rect", type=integers, action="append", default=[], metavar="X1,Y1,X2,Y2",
                        help="Known opaque structure area; source RGB and alpha255 preserved exactly")
    parser.add_argument("--measure-rect", type=integers, action="append", default=[], metavar="X1,Y1,X2,Y2",
                        help="Report source-RGB equality and alpha within an inspection ROI")
    parser.add_argument("--spill-roi", type=integers, action="append", default=[], metavar="X1,Y1,X2,Y2",
                        help="Explicit visually reviewed foliage/key-gap ROI; permits local magenta-island unmix beyond the narrow edge. Never use on floor reflections.")
    args = parser.parse_args(argv)
    try:
        output = safe_output(args.output)
        source = Path(args.input).resolve(strict=True)
        if "cloud" in source.name.lower():
            raise ValueError("This helper is for structural plates, not clouds")
        if len(args.key_rgb) != 3 or any(c < 0 or c > 255 for c in args.key_rgb):
            raise ValueError("Key RGB must have three channel values in0..255")
        if not (0 <= args.key_tolerance <= 48 and 190 <= args.min_dominance <= 255 and 0 <= args.clean_dominance <= 100):
            raise ValueError("Key settings exceed the deliberately bounded structural-key range")
        if min(args.key_rgb[0], args.key_rgb[2])-args.key_rgb[1] < 190:
            raise ValueError("Structural helper requires a magenta key; do not pass the green cloud method")
        before_sha = sha(source)
        with Image.open(source) as opened:
            if opened.format != "PNG" or getattr(opened, "n_frames", 1) != 1:
                raise ValueError("Input must be a single-image PNG")
            rgba = np.array(opened.convert("RGBA"))
        if np.any(rgba[:, :, 3] != 255):
            raise ValueError("Input already contains alpha; use the original opaque keyed structure PNG")
        h, w = rgba.shape[:2]
        for rect in args.protect_rect+args.measure_rect+args.spill_roi:
            if len(rect) != 4 or not (0 <= rect[0] < rect[2] <= w and 0 <= rect[1] < rect[3] <= h):
                raise ValueError("Every rectangle must be valid image-local XYXY bounds")
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        print(json.dumps({"status": "rejected", "error": str(exc)}), file=sys.stderr)
        return 2

    rgb = rgba[:, :, :3].astype(np.float32)
    key = np.array(args.key_rgb, dtype=np.float32)
    dominance = np.minimum(rgb[:, :, 0], rgb[:, :, 2])-rgb[:, :, 1]
    protected = np.zeros((h, w), dtype=bool)
    for x1, y1, x2, y2 in args.protect_rect:
        protected[y1:y2, x1:x2] = True
    near_key = (np.max(np.abs(rgb-key), axis=2) <= args.key_tolerance) & (dominance >= args.min_dominance)
    background = near_key & ~protected
    if not background.any():
        print(json.dumps({"status": "rejected", "error": "No near-key background found; review source/key settings"}), file=sys.stderr)
        return 2
    # Actual plate key is often slightly off255,0,255. Estimate only from its
    # true background samples; this is not a foreground palette operation.
    actual_key = np.median(rgb[background], axis=0)
    expanded = np.asarray(Image.fromarray(background.astype("uint8")*255).filter(
        ImageFilter.MaxFilter(args.edge_band*2+1))) > 0
    band = expanded & ~background & ~protected
    spill_region = np.zeros((h,w), dtype=bool)
    for x1,y1,x2,y2 in args.spill_roi:
        spill_region[y1:y2,x1:x2] = True
    # Reference comparison established these as small keyed sky gaps/leaf-edge
    # mixtures lacking a near-pure-key core. This is an explicit local exception
    # to the3px band, not a global hue cleanup or a floor-reflection remover.
    spill_islands = spill_region & ~background & ~band & ~protected & (dominance>65) & (rgb[:,:,0]>120) & (rgb[:,:,2]>120)
    candidates = (band & (dominance > args.clean_dominance)) | spill_islands
    # A pink spill patch outside the band must stay unchanged, but it is not
    # a trustworthy foreground colour for unmixing a neighbouring edge.
    clean = ~background & (dominance <= args.clean_dominance)
    guesses, found = nearest_clean_rgb(rgb, clean, candidates, radius=20 if args.spill_roi else args.edge_band+7)
    ys, xs = np.nonzero(candidates)
    result = rgba.copy()
    result[background, 3] = 0
    # Keep source RGB under alpha0; only reviewed edge pixels need new RGB.
    y, x = ys[found], xs[found]
    observed = rgb[y, x]
    estimate = guesses[found]
    vector = estimate-actual_key
    denominator = np.sum(vector*vector, axis=1)
    valid = denominator > 1
    y, x, observed, vector, denominator = y[valid], x[valid], observed[valid], vector[valid], denominator[valid]
    alpha = np.clip(np.sum((observed-actual_key)*vector, axis=1)/denominator, 0, 1)
    # Standard straight-alpha reconstruction C = aF + (1-a)K, with alpha
    # estimated against a nearby unchanged foreground pixel.
    foreground = np.clip((observed-(1-alpha[:, None])*actual_key)/np.maximum(alpha[:, None], 1/255), 0, 255)
    result[y, x, :3] = np.rint(foreground).astype("uint8")
    result[y, x, 3] = np.rint(alpha*255).astype("uint8")
    untouched = ~background & ~band & ~spill_islands
    assert np.array_equal(result[untouched], rgba[untouched]), "Opaque interior invariant failed"
    assert np.array_equal(result[protected], rgba[protected]), "Protected ROI invariant failed"
    assert np.all(result[untouched, 3] == 255)
    assert np.all(result[background, 3] == 0)
    changed_rgb = np.any(result[:, :, :3] != rgba[:, :, :3], axis=2)
    assert not np.any(changed_rgb & ~band & ~spill_islands), "RGB changed outside declared correction region"

    output.mkdir(parents=True, exist_ok=False)
    image = Image.fromarray(result)
    image.save(output/"alpha.png")
    Image.fromarray(background.astype("uint8")*255).save(output/"true-background-mask.png")
    Image.fromarray(band.astype("uint8")*255).save(output/"edge-band-mask.png")
    if args.spill_roi:Image.fromarray(spill_islands.astype('uint8')*255).save(output/'spill-island-mask.png')
    for label, color in (("dark", (24, 35, 43)), ("light", (220, 226, 218))):
        matte = Image.new("RGBA", (w, h), color+(255,))
        matte.alpha_composite(image)
        matte.convert("RGB").save(output/f"composite-{label}.png")
    roi_reports = []
    for n, rect in enumerate(args.measure_rect):
        x1, y1, x2, y2 = rect
        original_roi, out_roi = rgba[y1:y2, x1:x2], result[y1:y2, x1:x2]
        entry = {"rectXYXY": list(rect), "rgbUnchanged": bool(np.array_equal(original_roi[:, :, :3], out_roi[:, :, :3])),
                 "allOpaque": bool(np.all(out_roi[:, :, 3] == 255)), "alphaMin": int(out_roi[:, :, 3].min())}
        roi_reports.append(entry)
        crop = image.crop(rect)
        plate = Image.new("RGB", (max(320, crop.width*2), crop.height+30), (24, 35, 43))
        ImageDraw.Draw(plate).text((6, 7), "native dark | light / source RGB preserved outside edge", fill="white")
        for i, color in enumerate(((24, 35, 43), (220, 226, 218))):
            matte = Image.new("RGBA", crop.size, color+(255,))
            matte.alpha_composite(crop)
            plate.paste(matte.convert("RGB"), (i*crop.width, 30))
        plate.save(output/f"roi-{n:02d}.png")
    remaining_purple = (dominance > args.clean_dominance) & ~background & ~band & ~spill_islands
    report = {
        "status": "converted-invariants-pass-visual-review-required",
        "source": str(source), "sourceSha256": before_sha, "output": str(output/"alpha.png"),
        "toolSha256": sha(Path(__file__).resolve()),
        "outputSha256": sha(output/"alpha.png"), "size": [w, h],
        "settings": {"keyRgb": list(args.key_rgb), "keyTolerance": args.key_tolerance,
                     "minDominance": args.min_dominance, "edgeBandPx": args.edge_band,
                     "cleanDominance": args.clean_dominance, "actualKeyMedianRgb": actual_key.tolist(),
                     "protectRects": args.protect_rect, "explicitSpillRois": args.spill_roi},
        "trueBackgroundPixels": int(background.sum()), "edgeBandPixels": int(band.sum()),
        "edgeCandidates": int(candidates.sum()), "edgeCandidatesWithoutCleanNeighbour": int((~found).sum()),
        "edgeRgbChangedPixels": int(changed_rgb.sum()),
        "outsideBandInteriorPixels": int((~background & ~band).sum()),
        "outsideBandInteriorUnchanged": bool(np.array_equal(result[~background & ~band],rgba[~background & ~band])),
        "outsideDeclaredCorrectionRegionUnchanged": True,
        "explicitSpillIslandPixels": int(spill_islands.sum()),
        "protectedUnchangedAndOpaque": True, "protectedNearKeyPixelsKept": int((near_key & protected).sum()),
        "remainingPurpleInteriorPixels": int(remaining_purple.sum()),
        "remainingPurpleInteriorPolicy": "Unselected interiors preserved. Legitimate purple and painted key reflections cannot be distinguished by hue alone; explicit foliage ROIs need reference inspection and floor reflections need separate retouch.",
        "sourceUnchanged": sha(source) == before_sha, "roiReports": roi_reports,
        "limits": "Near-key false positives remain possible; inspect masks. No cloud processing, global desaturation, interior softening, or runtime publication.",
    }
    assert report["sourceUnchanged"], "Source changed during conversion"
    (output/"report.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "report": str(output/"report.json"),
                      "trueBackgroundPixels": report["trueBackgroundPixels"],
                      "edgeCandidatesWithoutCleanNeighbour": report["edgeCandidatesWithoutCleanNeighbour"],
                      "sourceUnchanged": report["sourceUnchanged"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

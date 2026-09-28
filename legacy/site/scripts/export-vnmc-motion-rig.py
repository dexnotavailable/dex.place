from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image
from psd_tools import PSDImage


CANVAS = (15360, 8640)
TARGET = (2400, 1350)

MOTION = {
    "yosemite-hair": {
        "pivot": (0.51, 0.88),
        "motion": {"x": 2.2, "y": 1.2, "rotate": 0.34, "duration": 7.8, "delay": -2.1, "depth": 0.34},
    },
    "director-hair": {
        "pivot": (0.5, 0.88),
        "motion": {"x": 1.4, "y": 0.8, "rotate": 0.48, "duration": 6.4, "delay": -4.2, "depth": 0.22},
    },
    "towaki-hair": {
        "pivot": (0.49, 0.14),
        "motion": {"x": 3.8, "y": 1.4, "rotate": 0.38, "duration": 8.6, "delay": -1.7, "depth": 0.5},
    },
    "towaki-ribbon": {
        "pivot": (0.83, 0.29),
        "motion": {"x": 5.4, "y": 2.1, "rotate": 0.62, "duration": 9.4, "delay": -5.6, "depth": 0.62},
    },
    "ena-cape": {
        "pivot": (0.3, 0.12),
        "motion": {"x": 3.1, "y": 1.6, "rotate": 0.28, "duration": 10.2, "delay": -6.3, "depth": 0.42},
    },
    "ena-hair": {
        "pivot": (0.5, 0.8),
        "motion": {"x": 2.4, "y": 1.0, "rotate": 0.46, "duration": 7.1, "delay": -3.5, "depth": 0.38},
    },
    "kaizen-hair": {
        "pivot": (0.52, 0.84),
        "motion": {"x": 1.8, "y": 0.9, "rotate": 0.42, "duration": 6.9, "delay": -4.8, "depth": 0.3},
    },
}

STACK = (
    {"id": "backdrop", "paths": (("Group 85",),)},
    {
        "id": "yosemite-under",
        "paths": (
            ("YOSEMITE", "YOSEMITE JACKET 2"),
            ("YOSEMITE", "YOSEMITE FACE"),
        ),
    },
    {
        "id": "yosemite-hair",
        "paths": (("YOSEMITE", "YOSEMITE HAIR"),),
        "motion": True,
    },
    {
        "id": "yosemite-over",
        "paths": (
            ("YOSEMITE", "YOSEMITE INNER SHIRT"),
            ("YOSEMITE", "YOSEMITE JACKET 1"),
            ("YOSEMITE", "YOSEMITE HAND"),
        ),
    },
    {
        "id": "yosemite-director-atmosphere",
        "paths": (("Paint Layer 93",), ("Group 89",)),
    },
    {
        "id": "director-under",
        "paths": (
            ("DIRECTOR", "Paint Layer 23"),
            ("DIRECTOR", "DIRECTOR FACE"),
            ("DIRECTOR", "DIRECTOR FACE PARTS"),
        ),
    },
    {
        "id": "director-hair",
        "paths": (("DIRECTOR", "DIRECTOR HAIR"),),
        "motion": True,
    },
    {
        "id": "director-over",
        "paths": (
            ("DIRECTOR", "DIRECTOR SUIT"),
            ("DIRECTOR", "DIRECTOR COAT"),
        ),
    },
    {"id": "director-towaki-shadows", "paths": (("Group 88",),)},
    {
        "id": "towaki-under",
        "paths": (
            ("TOWAKI", "TOWAKI FACE"),
            ("TOWAKI", "Paint Layer 76"),
            ("TOWAKI", "TOWAKI DRESS"),
        ),
    },
    {
        "id": "towaki-hair",
        "paths": (("TOWAKI", "TOWAKI HAIR"),),
        "motion": True,
    },
    {"id": "towaki-body", "paths": (("TOWAKI", "TOWAKI BODY"),)},
    {
        "id": "towaki-ribbon",
        "paths": (("TOWAKI", "TOWAKI RIBBON"),),
        "motion": True,
    },
    {"id": "towaki-ena-streaks", "paths": (("Group 87",),)},
    {
        "id": "ena-cape",
        "paths": (("ENA", "ENA CAPE"),),
        "motion": True,
    },
    {
        "id": "ena-body",
        "paths": (
            ("ENA", "ENA FACE"),
            ("ENA", "ENA FACE PARTS"),
            ("ENA", "ENA SUIT"),
        ),
    },
    {
        "id": "ena-hair",
        "paths": (("ENA", "ENA HAIR"),),
        "motion": True,
    },
    {"id": "ena-kaizen-shadows", "paths": (("Group 86",),)},
    {
        "id": "kaizen-under",
        "paths": (
            ("KAIZEN", "KAIZEN FACE"),
            ("KAIZEN", "Paint Layer 40"),
            ("KAIZEN", "Paint Layer 38"),
            ("KAIZEN", "Paint Layer 39"),
            ("KAIZEN", "Paint Layer 37"),
            ("KAIZEN", "KAIZEN CLOTHING"),
        ),
    },
    {
        "id": "kaizen-hair",
        "paths": (("KAIZEN", "KAIZEN HAIR"),),
        "motion": True,
    },
    {
        "id": "foreground-ink",
        "paths": (("Paint Layer 92",), ("Paint Layer 24",), ("Paint Layer 91",)),
    },
)


def clean(name: str) -> str:
    return name.rstrip("\x00").strip()


def find_layer(node, path: tuple[str, ...]):
    current = node
    for part in path:
        current = next(layer for layer in current if clean(layer.name) == part)
    return current


def resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.LANCZOS)


def scaled_size(bbox: tuple[int, int, int, int]) -> tuple[int, int]:
    width = max(1, round((bbox[2] - bbox[0]) * TARGET[0] / CANVAS[0]))
    height = max(1, round((bbox[3] - bbox[1]) * TARGET[1] / CANVAS[1]))
    return width, height


def normalized_bbox(bbox: tuple[int, int, int, int]) -> dict[str, float]:
    return {
        "left": round(bbox[0] / CANVAS[0] * 100, 5),
        "top": round(bbox[1] / CANVAS[1] * 100, 5),
        "width": round((bbox[2] - bbox[0]) / CANVAS[0] * 100, 5),
        "height": round((bbox[3] - bbox[1]) / CANVAS[1] * 100, 5),
    }


def walk(node):
    for layer in node:
        yield layer
        if layer.is_group():
            yield from walk(layer)


def ancestors(layer):
    current = layer.parent
    while current is not None and not isinstance(current, PSDImage):
        yield current
        current = current.parent


def union_bbox(layers) -> tuple[int, int, int, int]:
    boxes = [tuple(layer.bbox) for layer in layers]
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )


def export_plate(psd: PSDImage, layers, destination: Path, lossless: bool):
    bbox = union_bbox(layers)
    if not lossless:
        bbox = (
            max(0, bbox[0]),
            max(0, bbox[1]),
            min(CANVAS[0], bbox[2]),
            min(CANVAS[1], bbox[3]),
        )
    selected = {id(layer) for layer in layers}
    allowed = set(selected)
    for layer in layers:
        allowed.update(id(item) for item in walk([layer]))
        allowed.update(id(item) for item in ancestors(layer))

    image = psd.composite(
        viewport=bbox,
        color=(1.0, 1.0, 1.0),
        alpha=0.0,
        force=True,
        layer_filter=lambda layer: layer.visible and id(layer) in allowed,
        ignore_preview=True,
        apply_icc=False,
    )
    if image is None:
        raise RuntimeError(f"Plate {destination.stem} returned no pixels")

    resized = resize(image.convert("RGBA"), scaled_size(bbox))
    save_options = {"lossless": True, "method": 6} if lossless else {
        "quality": 92,
        "alpha_quality": 100,
        "method": 6,
        "exact": True,
    }
    resized.save(destination, "WEBP", **save_options)
    return bbox


def export(source: Path, output: Path, manifest_output: Path) -> None:
    psd = PSDImage.open(source)
    if (psd.width, psd.height) != CANVAS:
        raise RuntimeError(
            f"Unexpected canvas {psd.width}x{psd.height}; expected {CANVAS[0]}x{CANVAS[1]}"
        )

    output.mkdir(parents=True, exist_ok=True)
    plates = []
    for spec in STACK:
        layers = [find_layer(psd, path) for path in spec["paths"]]
        filename = f"{spec['id']}.webp"
        bbox = export_plate(psd, layers, output / filename, bool(spec.get("motion")))
        plate = {
            "id": spec["id"],
            "src": f"/assets/portfolio/vnmc-banner-2026/motion/{filename}",
            "kind": "motion" if spec.get("motion") else "static",
            **normalized_bbox(bbox),
        }
        if spec.get("motion"):
            motion = MOTION[spec["id"]]
            plate.update(
                {
                    "pivotX": motion["pivot"][0] * 100,
                    "pivotY": motion["pivot"][1] * 100,
                    **motion["motion"],
                }
            )
        plates.append(plate)

    manifest = {
        "canvas": {"width": TARGET[0], "height": TARGET[1]},
        "fallback": "/assets/portfolio/vnmc-banner-2026/banner.webp",
        "plates": plates,
    }
    manifest_json = json.dumps(manifest, indent=2) + "\n"
    (output / "rig.json").write_text(manifest_json, encoding="ascii")
    manifest_output.parent.mkdir(parents=True, exist_ok=True)
    manifest_output.write_text(manifest_json, encoding="ascii")

    for plate in plates:
        destination = output / Path(plate["src"]).name
        print(f"{destination.name}\t{destination.stat().st_size} bytes")
    print(f"rig.json\t{len(plates)} ordered plates")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the VNMC banner ambient motion rig.")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(r"A:\VNMC BANNER 2026.psd"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(
            r"D:\Dex\Projects\SUMMER PROJECT 3\dex-client\site"
            r"\public\assets\portfolio\vnmc-banner-2026\motion"
        ),
    )
    parser.add_argument(
        "--manifest-output",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "src"
        / "app"
        / "data"
        / "vnmcMotionRig.generated.json",
    )
    args = parser.parse_args()
    export(args.source, args.output, args.manifest_output)


if __name__ == "__main__":
    main()

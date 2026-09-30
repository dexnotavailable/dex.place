"""PNG byte bridge for Node's existing atlas packer. Pillow, no resize/render.

Input/output is JSON on stdin/stdout. Original albedo bytes are preserved.
Normal green-axis conversion is explicit; ink-mask alpha is preserved.
"""
import base64
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image

MAX_BYTES = 256 * 1024 * 1024


def main():
    request = json.load(sys.stdin)
    if request["op"] == "decode":
        result, total = [], 0
        for row in request["files"]:
            path = Path(row["path"])
            source_bytes = path.read_bytes()
            if len(source_bytes) > MAX_BYTES:
                raise ValueError("bounded PNG file byte limit exceeded")
            with Image.open(io.BytesIO(source_bytes)) as source:
                if source.format != "PNG" or getattr(source, "n_frames", 1) != 1:
                    raise ValueError("single-frame PNG required")
                width, height = source.size
                if not 1 <= width <= 8192 or not 1 <= height <= 8192:
                    raise ValueError("PNG dimensions outside contract limits")
                total += width * height * 4
                if total > MAX_BYTES:
                    raise ValueError("bounded decoder byte limit exceeded")
                data = bytearray(source.convert("RGBA").tobytes())
            conversion = row.get("normalSpace")
            if conversion not in (None, "sprite-y-down", "camera-y-up"):
                raise ValueError("unsupported normal coordinate convention")
            if conversion == "camera-y-up":
                for offset in range(0, len(data), 4):
                    if data[offset + 3] >= 128:
                        data[offset + 1] = 255 - data[offset + 1]
            result.append({"key": row["key"], "width": width, "height": height,
                           "fileSha256": hashlib.sha256(source_bytes).hexdigest(),
                           "rgba": base64.b64encode(data).decode("ascii")})
        json.dump(result, sys.stdout, separators=(",", ":"))
    elif request["op"] == "encode":
        result = []
        for row in request["images"]:
            width, height = row["width"], row["height"]
            data = base64.b64decode(row["rgba"], validate=True)
            if len(data) != width * height * 4 or len(data) > MAX_BYTES:
                raise ValueError("RGBA byte count differs from declared dimensions")
            target = Path(row["path"])
            if target.exists():
                raise ValueError("never overwrite an existing atlas")
            target.parent.mkdir(parents=True, exist_ok=True)
            Image.frombytes("RGBA", (width, height), data).save(target, format="PNG", compress_level=9)
            with Image.open(target) as saved:
                if saved.size != (width, height) or saved.convert("RGBA").tobytes() != data:
                    raise ValueError("PNG round-trip changed pixels")
            result.append({"file": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                           "width": width, "height": height})
        json.dump(result, sys.stdout, separators=(",", ":"))
    else:
        raise ValueError("unknown codec operation")


if __name__ == "__main__":
    main()

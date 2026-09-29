"""Build labelled contact sheets from YouTube's scrub-bar storyboard thumbnails.

Purpose: check which timestamps of a reference video hold clean full-body action
*before* anything is downloaded. It fetches only the small preview sprites the
YouTube player shows when you hover the progress bar (plus the metadata JSON), never
the video stream.

Output (third-party frames, so it lands in the git-ignored review folder):
    review/motion/_storyboards/<video_id>/meta.json
    review/motion/_storyboards/<video_id>/sheet_XX.png   (tiles labelled mm:ss)

Usage:
    python storyboard_sheet.py VIDEO_ID [VIDEO_ID ...] [--level sb1|sb0] [--cols 8]
        [--start SECONDS] [--end SECONDS]
    Put options first and "--" before ids that start with "-", e.g.
    python storyboard_sheet.py --level sb0 --cols 4 -- -iJ_d5z5m3o

sb1 tiles are 80x45 or 160x90 px, sb0 up to 320x180; YouTube spaces them ~1 s apart on
short videos and 2-5 s apart on long ones, so timestamps are only good to that step.

Needs: yt-dlp on PATH, Pillow.
"""

from __future__ import annotations

import argparse
import io
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[2]
OUT_ROOT = REPO / "review" / "motion" / "_storyboards"


def fetch_meta(video_id: str, out_dir: Path) -> dict:
    meta_path = out_dir / "meta.json"
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--dump-json",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        raise RuntimeError(f"yt-dlp failed for {video_id}: {res.stderr[-400:]}")
    meta = json.loads(res.stdout)
    meta_path.write_text(json.dumps(meta), encoding="utf-8")
    return meta


def summary(meta: dict) -> dict:
    vids = [f for f in meta.get("formats", []) if f.get("vcodec") not in (None, "none")]
    best = max(vids, key=lambda f: ((f.get("height") or 0), (f.get("fps") or 0)), default={})
    fps_max = max((f.get("fps") or 0) for f in vids) if vids else None
    return {
        "id": meta.get("id"),
        "title": meta.get("title"),
        "channel": meta.get("channel"),
        "upload_date": meta.get("upload_date"),
        "duration_s": meta.get("duration"),
        "license": meta.get("license"),
        "max_height": best.get("height"),
        "max_fps": fps_max,
        "chapters": [(c.get("start_time"), c.get("title")) for c in (meta.get("chapters") or [])],
        "url": meta.get("webpage_url"),
    }


def build_sheets(meta: dict, out_dir: Path, level: str, cols: int, start: float, end: float) -> list[Path]:
    fmt = next((f for f in meta.get("formats", []) if f.get("format_id") == level), None)
    if fmt is None:
        raise RuntimeError(f"no storyboard level {level} for {meta.get('id')}")
    rows, columns = fmt["rows"], fmt["columns"]
    tw, th = fmt["width"], fmt["height"]
    interval = 1.0 / fmt["fps"] if fmt.get("fps") else None
    tiles: list[tuple[float, Image.Image]] = []
    t_cursor = 0.0
    for frag in fmt.get("fragments", []):
        frag_dur = frag.get("duration") or 0.0
        per_tile = interval or (frag_dur / (rows * columns))
        frag_end = t_cursor + frag_dur
        if frag_end < start or t_cursor > end:
            t_cursor = frag_end
            continue
        with urllib.request.urlopen(frag["url"], timeout=30) as r:
            sheet = Image.open(io.BytesIO(r.read())).convert("RGB")
        for i in range(rows * columns):
            t = t_cursor + i * per_tile
            if t >= frag_end - 1e-6 or t > (meta.get("duration") or 1e9):
                break
            if t < start or t > end:
                continue
            x, y = (i % columns) * tw, (i // columns) * th
            tiles.append((t, sheet.crop((x, y, x + tw, y + th))))
        t_cursor = frag_end
    label_h = 14
    per_sheet = cols * 6
    paths = []
    for s in range(0, len(tiles), per_sheet):
        chunk = tiles[s : s + per_sheet]
        n_rows = (len(chunk) + cols - 1) // cols
        img = Image.new("RGB", (cols * tw, n_rows * (th + label_h)), (20, 20, 20))
        d = ImageDraw.Draw(img)
        for k, (t, tile) in enumerate(chunk):
            x, y = (k % cols) * tw, (k // cols) * (th + label_h)
            img.paste(tile, (x, y + label_h))
            d.text((x + 3, y + 1), f"{int(t // 60)}:{int(t % 60):02d}", fill=(255, 230, 80))
        p = out_dir / f"sheet_{level}_{s // per_sheet:02d}.png"
        img.save(p)
        paths.append(p)
    return paths


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--level", default="sb1")
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=1e9)
    args = ap.parse_args()
    for vid in args.ids:
        out_dir = OUT_ROOT / vid
        out_dir.mkdir(parents=True, exist_ok=True)
        try:
            meta = fetch_meta(vid, out_dir)
            info = summary(meta)
            (out_dir / "summary.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
            sheets = build_sheets(meta, out_dir, args.level, args.cols, args.start, args.end)
            print(json.dumps(info, ensure_ascii=False))
            for p in sheets:
                print("  ", p)
        except Exception as exc:  # keep going through the list
            print(f"{vid}: ERROR {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

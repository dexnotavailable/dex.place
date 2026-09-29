"""Fetch, verify and unpack the third-party inputs listed in third_party.json.

usage: python fetch_third_party.py [--only id,id] [--pin]
  --pin   record size/sha256 for items that have none yet (first fetch); otherwise a
          hash mismatch is an error and the existing file is left alone.

Files land in DEXPLACE_DOWNLOADS (default D:/Dex/Inbox/Downloads/dexplace-character), never
in the repo. Supports plain URLs and itch.io free ("name your own price", $0) downloads.
Stdlib only.
"""
import fnmatch
import hashlib
import http.cookiejar
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, "third_party.json")
ROOT = os.environ.get("DEXPLACE_DOWNLOADS", r"D:\Dex\Inbox\Downloads\dexplace-character")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) dexplace-pixel-pipeline"

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def request(url, data=None, headers=None):
    h = {"User-Agent": UA}
    h.update(headers or {})
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    return opener.open(urllib.request.Request(url, data=body, headers=h), timeout=120)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def stream_to(resp, path):
    tmp = path + ".part"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(tmp, "wb") as f:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    return tmp


def csrf(html):
    m = re.search(r'name="csrf_token" value="([^"]+)"', html) or \
        re.search(r'name="csrf_token" content="([^"]+)"', html)
    if not m:
        raise RuntimeError("itch: csrf_token not found")
    return m.group(1)


def itch_url(spec):
    """Walk itch's free download flow; returns a short-lived signed file URL."""
    page = f"https://{spec['user']}.itch.io/{spec['game']}"
    html = request(page).read().decode("utf-8", "replace")
    xhr = {"X-Requested-With": "XMLHttpRequest", "Referer": page}
    dl = json.load(request(page + "/download_url", {"csrf_token": csrf(html)}, xhr))["url"]
    html = request(dl).read().decode("utf-8", "replace")
    ids = re.findall(r'data-upload_id="(\d+)".*?title="([^"]+)" class="name"', html, re.S)
    upload = next((i for i, name in ids if name == spec["upload"]), None)
    if not upload:
        raise RuntimeError(f"itch: upload {spec['upload']!r} not offered; saw {[n for _, n in ids]}")
    xhr["Referer"] = dl
    r = json.load(request(f"{page}/file/{upload}?source=game_download&as_props=1",
                          {"csrf_token": csrf(html)}, xhr))
    return r["url"]


def extract(item, archive):
    dest = os.path.join(ROOT, item["extract_to"])
    pats = item.get("extract_members")
    out = []
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            name = info.filename
            if pats and not any(fnmatch.fnmatch(name, p) or fnmatch.fnmatch(os.path.basename(name), p)
                                for p in pats):
                continue
            if pats:  # flat: keep only the file name
                target = os.path.join(dest, os.path.basename(name))
                os.makedirs(dest, exist_ok=True)
                with z.open(info) as src, open(target, "wb") as f:
                    f.write(src.read())
            else:
                z.extract(info, dest)
                target = os.path.join(dest, name)
            out.append(target)
    return out


def main():
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        only = set(args[args.index("--only") + 1].split(","))
    pin = "--pin" in args
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    changed = False
    for item in manifest["items"]:
        if only and item["id"] not in only:
            continue
        path = os.path.join(ROOT, item["dest"])
        want = item.get("sha256")
        if os.path.isfile(path) and want and sha256_file(path) == want:
            print(f"ok       {item['id']}")
        else:
            url = itch_url(item["itch"]) if item["kind"] == "itch" else item["url"]
            tmp = stream_to(request(url), path)
            got, size = sha256_file(tmp), os.path.getsize(tmp)
            if want and got != want:
                os.remove(tmp)
                sys.exit(f"MISMATCH {item['id']}: got {got}, manifest {want} (upstream changed?)")
            if not want:
                if not pin:
                    os.remove(tmp)
                    sys.exit(f"UNPINNED {item['id']}: sha256 {got}; rerun with --pin to record it")
                item["sha256"], item["size"] = got, size
                changed = True
            os.replace(tmp, path)
            print(f"fetched  {item['id']}  {size} B  sha256 {got}")
        if item.get("extract_to"):
            files = extract(item, path)
            print(f"         extracted {len(files)} file(s) -> {item['extract_to']}")
    if changed:
        with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print("manifest pinned:", MANIFEST)


if __name__ == "__main__":
    main()

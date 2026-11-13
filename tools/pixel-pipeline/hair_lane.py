"""Hair lane driver (host side): build variants, render the stills, crop the hair, measure it.

  python tools/pixel-pipeline/hair_lane.py build v3 [control ...]
  python tools/pixel-pipeline/hair_lane.py stills v3 [--hi 640]
  python tools/pixel-pipeline/hair_lane.py all v3 control

Builds go to D:/Dex/Projects/dex-place-art/rosace/build/lanes/hair/<variant>.blend, stills to
.../lanes/hair/renders/<variant>/ (stills_v2.py layout: <still>/px<N>/still.png). Never touches
rosace.blend.
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
LANE = os.environ.get("HAIR_LANE_DIR", r"D:\Dex\Projects\dex-place-art\rosace\build\lanes\hair")


def blend(v):
    return os.path.join(LANE, f"{v}.blend")


def renders(v):
    return os.path.join(LANE, "renders", v)


def run(cmd):
    t = time.time()
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-4000:])
        raise SystemExit(f"failed: {cmd[:4]}")
    for ln in out.splitlines():
        if "HAIR_LANE" in ln or "Traceback" in ln:
            print("   ", ln[:300])
    print(f"  {time.time() - t:5.1f} s")
    return out


def build(v):
    os.makedirs(LANE, exist_ok=True)
    print("build", v)
    run([sys.executable, os.path.join(HERE, "blender_env.py"), "run", "--python-exit-code", "1", "--python",
         os.path.join(HERE, "hair_lane_build.py"), "--", "--variant", v, "--out", blend(v)])


def stills(v, hi=0):
    print("stills", v)
    run([sys.executable, os.path.join(HERE, "stills_v2.py"), "--blend", blend(v), "--out", renders(v),
         "--hi", str(hi), "--only", "idle_hero,n1_contact,q_stamp,n2_pivot_black", "--plain"])


STILLS = ["idle_hero", "n1_contact", "q_stamp", "n2_pivot_black"]
BG = (118, 116, 128, 255)


def load(v, still, px):
    import json
    import numpy as np
    from PIL import Image
    d = os.path.join(renders(v), still, f"px{px}")
    m = json.load(open(os.path.join(d, "meta.json")))
    im = Image.open(os.path.join(d, "still.png")).convert("RGBA")
    ids = np.asarray(Image.open(os.path.join(d, "noface_id.png")))
    return m, im, ids


def head_box(m, ids, px, kind="head"):
    """head crop: a fixed box (at 144: 44 x 52) round the head anchor, its top at the hair's top;
    'hair' crop: the bbox of hair, hairtip, veil and the hair gold"""
    import numpy as np
    mats = m["materials"]
    hid = [mats[n]["id"] for n in ("hair", "hairtip", "veil") if n in mats]
    hm = np.isin(ids[..., 0], hid) & (ids[..., 3] > 0)
    hx, hy = m["anchors"]["head"][0] / m["ss"], m["anchors"]["head"][1] / m["ss"]
    k = px / 144
    if kind == "hair":
        ys, xs = np.nonzero(hm)
        return (int(xs.min()) - 2, int(ys.min()) - 2, int(xs.max()) + 3, int(ys.max()) + 3)
    w, h = (int(round(46 * k)), int(round(54 * k))) if kind == "head" else (int(round(40 * k)), int(round(42 * k)))
    near = hm[:, max(0, int(hx - w / 2)):int(hx + w / 2)]
    ys = np.nonzero(near.any(1))[0]
    top = int(ys.min()) - 2 if len(ys) else int(hy - h * 0.45)
    return (int(round(hx - w / 2)), top, int(round(hx - w / 2)) + w, top + h)


def crop(im, box):
    from PIL import Image
    c = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), BG)
    c.alpha_composite(im.crop(box).convert("RGBA"))
    return c


def sheet(out, vs, zoom=5, kind="head", pxs=(144, 80)):
    """variants side by side: one row per still and px, one column per variant (head crops)"""
    from PIL import Image, ImageDraw
    rows = []
    for px in pxs:
        z = zoom if px == 144 else max(1, round(zoom * 144 / px))
        for st in STILLS:
            row = []
            for v in vs:
                m, im, ids = load(v, st, px)
                c = crop(im, head_box(m, ids, px, kind))
                row.append(c.resize((c.width * z, c.height * z), Image.NEAREST))
            rows.append(row)
    W = max(sum(t.width for t in r) + 8 * (len(r) + 1) for r in rows)
    Hh = sum(max(t.height for t in r) + 8 for r in rows) + 30
    S = Image.new("RGBA", (W, Hh), (50, 50, 56, 255))
    d = ImageDraw.Draw(S)
    x = 8
    for v, t in zip(vs, rows[0]):
        d.text((x, 8), v, fill=(255, 255, 255, 255))
        x += t.width + 8
    y = 26
    for r in rows:
        x = 8
        for t in r:
            S.paste(t, (x, y))
            x += t.width + 8
        y += max(t.height for t in r) + 8
    S.save(out)
    print("  ", out)


# ---------------------------------------------------------------------------- measurement
ART_PART = {"veil": "veil", "head": "face", "body": "torso", "collar": "collar", "collar_cross": "cross",
            "collar_plate": "cross", "glaive": "weapon", "glaive_glass": "weapon", "tabard": "tabard",
            "sleeves": "sleeve_near", "boots": "boot_near", "stockings": "leg_near"}


def sprite_dir(v, st, px):
    """a rules_check sprite folder from a render still: sprite.png (the still), sprite_ids.png
    (R = material id, the palette.json ids the checker also uses), sprite_parts.png (render parts
    mapped to art-construct PART names: every hair clump -> hair_back), a minimal pose.json"""
    import json
    import numpy as np
    from PIL import Image
    sys.path.insert(0, os.path.join(os.path.dirname(HERE), "art-construct"))
    import artlib as A
    m, im, ids = load(v, st, px)
    d = os.path.join(renders(v), "_check", f"{st}_{px}")
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, "sprite.png"))
    a = ids[..., 3] > 0
    mat = np.where(a, ids[..., 0], 0).astype(np.uint8)
    inv = {pid: n for n, pid in m["parts"].items()}
    part = np.zeros(mat.shape, np.uint8)
    for pid in np.unique(ids[..., 1][a]):
        n = inv.get(int(pid), "")
        an = "hair_back" if n.startswith("hair") else ART_PART.get(n)
        if an:
            part[a & (ids[..., 1] == pid)] = A.PART[an]
    for arr, name in ((mat, "sprite_ids.png"), (part, "sprite_parts.png")):
        Image.fromarray(np.stack([arr, arr * 0, arr * 0, (arr > 0).astype(np.uint8) * 255], -1), "RGBA").save(
            os.path.join(d, name))
    json.dump({"landmarks": {}, "source": "hair_lane render adapter"}, open(os.path.join(d, "pose.json"), "w"))
    return d


def rules(v, st="idle_hero", px=144):
    """rules_check (HR, PX) on a render still; rules that need a painted face record or a gesture
    wireframe error out on a render and are reported as n/a"""
    import json
    d = sprite_dir(v, st, px)
    js = os.path.join(d, "rules.json")
    subprocess.run([sys.executable, os.path.join(os.path.dirname(HERE), "art-construct", "rules_check.py"),
                    "--sprite", d, "--only", "HR,PX", "--json", js], capture_output=True)
    R = json.load(open(js))["rules"]
    out = {}
    for r in R:
        st_ = r["status"]
        if "ERROR" in str(r["measured"]) or st_ in ("SKIP", "CRITIC"):
            continue
        out[r["id"]] = (st_, r["measured"])
    return out


def metrics(v, st, px):
    """hair measurements on the post-processed still that need no painted face record:
      tones      share of hair-material px per code (HR-P07: I1+I2 >= 33%, I4 <= 15%)
      i4_patch   largest 4-connected I4 patch in the hair (HR-N03: <= 20)
      specks     I0/I1 hair px with no I0/I1 8-neighbour (HR-N02: <= 2)
      breaks     head-silhouette hair px (above the chin) with >= 5 of 8 neighbours empty, by tone:
                 lit (I0-I2, HR-P13 wants >= 1) and dark (I3/I4/OL-lined, HR-N05 wants 0)
      cross      hair px lying on the face (head skin both left and right of it in its row) from the
                 eye row to the chin: a lock across the cheek or down the face (FC-N17: 0)
      width      head width with its hair / face-skin width, at the eye row (volume past the skull)
      dash_rows  distinct rows holding I0 in the hair (HR-P08: >= 3 when the ring shows)"""
    import numpy as np
    sys.path.insert(0, os.path.join(os.path.dirname(HERE), "art-construct"))
    import artlib as A
    m, im, ids = load(v, st, px)
    rgba = np.asarray(im)
    rgb, alpha = rgba[..., :3].astype(int), rgba[..., 3] > 0
    code = np.full(alpha.shape, "", object)
    for k, h in m["colors"].items():
        c = tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
        code[(rgb == c).all(-1) & alpha] = k
    mats, parts = m["materials"], m["parts"]
    mid = ids[..., 0]
    ida = ids[..., 3] > 0
    hair = ida & np.isin(mid, [mats["hair"]["id"], mats["hairtip"]["id"]])
    hmat = ida & (mid == mats["hair"]["id"]) & alpha
    tot = max(1, int(hmat.sum()))
    tones = {k: round(float((hmat & (code == k)).sum()) / tot, 3) for k in ("I0", "I1", "I2", "I3", "I4", "OL")}
    lab, sizes = A.components(hmat & (code == "I4"))
    i4 = max([n for _, n in sizes], default=0)
    li = hmat & np.isin(code, ["I0", "I1"])
    nb8 = sum(A.shift(li, dx, dy).astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
    specks = int((li & (nb8 == 0)).sum())
    ss = m["ss"]
    head_part = parts.get("head")
    skin_head = ida & (ids[..., 1] == head_part) & (mid == mats["skin"]["id"])
    eyes = [m["anchors"][k] for k in ("eye_L", "eye_R") if k in m["anchors"]]
    eye_y = int(round(sum(e[1] for e in eyes) / len(eyes) / ss)) if eyes else None
    ys = np.nonzero(skin_head.any(1))[0]
    chin_y = int(ys.max()) if len(ys) else alpha.shape[0]
    empty = ~alpha | (code == "OL")            # the post-process outlines the silhouette in OL
    nbe = sum(A.shift(empty, dx, dy).astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
    sil = hair & alpha & (nbe >= 5)
    sil[chin_y:] = False
    lit = int((sil & np.isin(code, ["I0", "I1", "I2", "A3", "A4"])).sum())
    dark = int((sil & np.isin(code, ["I3", "I4", "OL"])).sum())
    cross = 0
    width = None
    if eye_y is not None:
        for y in range(eye_y, chin_y + 1):
            xs = np.nonzero(skin_head[y])[0]
            if len(xs) < 2:
                continue
            seg = hair[y, xs.min():xs.max() + 1]
            cross += int(seg.sum())
        row = skin_head[eye_y]
        hr = (hair | skin_head)[eye_y]
        if row.any():
            sx = np.nonzero(row)[0]
            hx = np.nonzero(hr)[0]
            width = round((hx.max() - hx.min() + 1) / (sx.max() - sx.min() + 1), 2)
    dash_rows = len(set(np.nonzero(hmat & (code == "I0"))[0].tolist()))
    vm = ida & (mid == mats["veil"]["id"]) & alpha if "veil" in mats else np.zeros_like(alpha)
    vy, vx = np.nonzero(vm)
    veil = [int(vx.max() - vx.min() + 1), int(vy.max() - vy.min() + 1), int(vm.sum())] if len(vx) else [0, 0, 0]
    # HR-P14: the ramp's shadow step under the unoccluded ambient term (materials.py: 0.16 x ao)
    ramp_t1 = hair_t1(v)
    # HR-P15: hair part ids visible on the head (the separation lines fall between parts)
    hb = head_box(m, ids, px, "face")
    sub = ids[max(0, hb[1]):hb[3], max(0, hb[0]):hb[2]]
    inv = {pid: n for n, pid in parts.items()}
    hp = {int(q) for q in np.unique(sub[..., 1][(sub[..., 3] > 0) & np.isin(sub[..., 0], [mats["hair"]["id"], mats["hairtip"]["id"]])])}
    head_parts = len([q for q in hp if inv.get(q, "").startswith("hair")])
    return {"ramp_t1": ramp_t1, "head_parts": head_parts, "tones": tones, "I1+I2": round(tones["I1"] + tones["I2"], 3), "i4_patch": i4, "specks": specks,
            "breaks_lit": lit, "breaks_dark": dark, "cross": cross, "width": width, "dash_rows": dash_rows,
            "hair_px": int(hair.sum()), "veil": veil}


def hair_t1(v):
    """the hair ramp's shadow step as built: the lane sidecar (<variant>_hair.json, written by
    hair_lane_build.py), else palette.json (the v2 hair keeps palette.json's ramp)"""
    import json
    sc = os.path.join(LANE, f"{v}_hair.json")
    if os.path.exists(sc):
        mt = json.load(open(sc)).get("spec", {}).get("materials", {}).get("hair", {})
        if "t" in mt:
            return mt["t"][1]
    elif v != "control":
        return None                    # built before the sidecar existed: not recorded
    pal = json.load(open(os.path.join(os.path.dirname(os.path.dirname(HERE)), "art", "rosace", "palette.json")))
    return pal["materials"]["hair"]["t"][1]


def hr_checks(d):
    """the hair lane's render checks (ART-RULES HR-P14..P17) from one variant's metrics"""
    i = d["idle_hero_144"]
    out = {
        "HR-P14": (None if i["ramp_t1"] is None else i["ramp_t1"] < 0.16, f"hair t[1] = {i['ramp_t1']} (ambient 0.16)"),
        "HR-P15": (max(d[k]["head_parts"] for k in d if k.endswith("_144")) <= 14,
                   "hair part ids on the head: " + ", ".join(f"{k.split('_')[0]} {d[k]['head_parts']}" for k in d if k.endswith("_144"))),
        "HR-P16": (min(d[k]["width"] or 0 for k in ("idle_hero_144", "q_stamp_144")) >= 1.8,
                   f"idle {d['idle_hero_144']['width']}, q {d['q_stamp_144']['width']}"),
        "HR-P17": (16 <= d["n2_pivot_black_144"]["veil"][0] <= 20 and 22 <= d["n2_pivot_black_144"]["veil"][1] <= 26
                   and i["veil"][2] >= 12,
                   f"back view {d['n2_pivot_black_144']['veil'][:2]}, idle veil px {i['veil'][2]}"),
    }
    return {k: ("n/a" if ok is None else "PASS" if ok else "FAIL", v) for k, (ok, v) in out.items()}


def report(vs, pxs=(144, 80)):
    import json
    out = {}
    for v in vs:
        out[v] = {}
        for px in pxs:
            for st in STILLS:
                out[v][f"{st}_{px}"] = metrics(v, st, px)
        out[v]["hr_lane"] = hr_checks(out[v])
        try:
            out[v]["rules_idle_144"] = rules(v)
        except Exception as e:      # the checker is another lane's tool: report, don't stop
            out[v]["rules_idle_144"] = {"error": str(e)}
    return out


SHOTS = ("f:0:5:J_Bip_C_Head:0.62;q:30:8:J_Bip_C_Head:0.62;s:90:5:J_Bip_C_Head:0.62;"
         "b:180:5:J_Bip_C_Head:0.62;bb:160:5:0,0.05,1.25:1.3")


def look(v, pose=None):
    """hi-res close-ups (rest pose or a pose file), glaive hidden, and one montage"""
    out = os.path.join(LANE, "look", v + ("_" + os.path.basename(pose)[:-5] if pose else ""))
    cmd = [sys.executable, os.path.join(HERE, "blender_env.py"), "run", "--python",
           os.path.join(HERE, "rosace_v2", "closeup.py"), "--", "--blend", blend(v), "--out", out,
           "--shots", SHOTS, "--res", "420", "--hide", "glaive,glaive_glass"]
    if pose:
        cmd += ["--pose", pose]
    run(cmd)
    from PIL import Image
    ims = [Image.open(os.path.join(out, n + ".png")).convert("RGBA") for n in ("f", "q", "s", "b", "bb")]
    W = sum(i.width for i in ims) + 6 * 4
    S = Image.new("RGBA", (W, max(i.height for i in ims)), (128, 128, 136, 255))
    x = 0
    for i in ims:
        bg = Image.new("RGBA", i.size, (128, 128, 136, 255))
        bg.alpha_composite(i)
        S.paste(bg, (x, 0))
        x += i.width + 6
    S.save(out + ".png")
    print("  ", out + ".png")


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:]
    if cmd == "metrics":
        import json
        R = report(rest)
        for v, d in R.items():
            print(v)
            for k, x in d.items():
                if k.startswith("rules"):
                    print("  rules", {i: s_[0] for i, s_ in x.items()} if "error" not in x else x)
                elif k == "hr_lane":
                    for rid, (st_, val) in x.items():
                        print(f"  {rid} {st_}  {val}")
                else:
                    print(f"  {k:22} I1+I2 {x['I1+I2']:.2f} I4 {x['tones']['I4']:.2f} I0 {x['tones']['I0']:.2f} "
                          f"i4patch {x['i4_patch']:3} specks {x['specks']:2} lit {x['breaks_lit']:2} dark {x['breaks_dark']:2} "
                          f"cross {x['cross']:3} width {x['width']} dashrows {x['dash_rows']} veil {x['veil']}")
            json.dump(d, open(os.path.join(renders(v), "_metrics.json"), "w"), indent=1)
        raise SystemExit
    if cmd == "sheet":
        out, *vs = rest
        kind = "head"
        if vs and vs[0] in ("head", "hair"):
            kind, vs = vs[0], vs[1:]
        sheet(out, vs, 5 if kind == "head" else 3, kind)
        raise SystemExit
    hi = 0
    if "--hi" in rest:
        i = rest.index("--hi")
        hi = int(rest[i + 1])
        rest = rest[:i] + rest[i + 2:]
    for v in rest:
        if cmd in ("build", "all"):
            build(v)
        if cmd in ("stills", "all"):
            stills(v, hi)
        if cmd in ("look", "all"):
            look(v)

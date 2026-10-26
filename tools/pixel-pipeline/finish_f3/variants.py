"""Route F3, "mass and silhouette": the variant table (plain data, no bpy).

Why (finish-gap.md 2.5): her silhouette area per height^2 is 0.23 against 0.28-0.35 on refs 07/08/09
(04, a slim 9, is 0.17), and the lower body is 0.21 H wide where 07/08/09 run 0.25-0.65 H. Ref 14 (the
costume source) draws much bigger bells than ours (hanging lips to mid-thigh) and a front tabard to
the ankle. So F3 gives her big cloth shapes inside DESIGN 1 and 3: bell sleeves with the indigo lining
turned out at the mouth, a longer and wider tabard (optionally split into two tails that can flutter),
hair and veil volume past the skull, and fold accents that start at tension points (CL-P01).

Each variant is a dict of overrides; overrides.py applies them after rosace/outfit.py,
rosace/outfit_art.py and rosace/hair_v3.py are imported, without editing those files:
  sleeve  replaces outfit_art.sleeves_r2 with a parameterised copy (keys in SLEEVE_BASE)
  tabard  replaces outfit_art.tabard_r2 with a parameterised copy (keys in TABARD_BASE)
  hair    a hair_v3 variant dict merged over the integrated pick r2f (hair_v3.spec() semantics:
          a dict value updates the SPEC dict of that name, anything else replaces it); 'scale'
          keys (mantle_w, layer_w, tail_w, tail_dx) multiply r2f's clump tables
Everything not named keeps the integrated build's value (art/rosace/integrated.json 'build').
"""

# the integrated build's values (outfit R2Q: outfit.SLEEVE_*, sleeves_r2's constants, lip 0.022 'slvf')
SLEEVE_BASE = dict(bell=0.092, lip_hang=0.17, short=0.065, rh=0.050, rt=0.012, flute=0.13, scallop=0.018,
                   lip=0.022, crease=0.9, r_arm0=0.047, r_arm1=0.055, el_off=0.04)
# the integrated build's tabard (outfit_art.tabard_r2 with TAB, fold -1, hem2, tabx)
TABARD_BASE = dict(bot_t=0.52, w_top=0.060, w_bot=0.092, v_point=0.105, turn=0.034, bulge=0.010,
                   pipes=0.0, pipe_u=0.40, pipe_crease=0.0, slit_t=None, slit_w=0.2, cross_t=None)

# F3 variants. 'control' = the integrated build as it is (no overrides): every sheet carries it.
VARIANTS = {
    "control": {},
    # A: cloth only. Bells to ref 14's proportion (a ~27 px mouth hanging, lining turned out), the
    # tabard to the boot top and 40% wider at the hem, one pipe fold per side from the hip band
    "A": {
        "sleeve": dict(bell=0.125, lip_hang=0.21, rh=0.072, rt=0.016, flute=0.17, lip=0.040, el_off=0.07,
                       crease=1.0),
        "tabard": dict(bot_t=0.80, w_top=0.064, w_bot=0.128, v_point=0.13, pipes=0.012, pipe_crease=0.7,
                       cross_t=0.62),
    },
    # B: A + hair and veil volume past the skull (crown/ear radius, mantle and layer clumps wider,
    # the shoulder flicks further out, the tail ribbons fuller and swinging wider, the veil hem wider)
    "B": {
        "sleeve": dict(bell=0.125, lip_hang=0.21, rh=0.072, rt=0.016, flute=0.17, lip=0.040, el_off=0.07,
                       crease=1.0),
        "tabard": dict(bot_t=0.80, w_top=0.064, w_bot=0.128, v_point=0.13, pipes=0.012, pipe_crease=0.7,
                       cross_t=0.62),
        "hair": {"crown_k": 1.28, "ear_k": 1.33, "layer_flick": 1.85, "mantle_s": 0.065, "tail_s": 0.085,
                 "scale": {"mantle_w": 1.25, "layer_w": 1.2, "tail_w": 1.4, "tail_dx": 1.35},
                 "veil": {"k": 1.34, "k_hang": 1.50, "az_hem": 76, "flare": 0.12}},
    },
    # C: B with the tabard split into two pointed tails from 55% down (each tail its own point, a
    # 3 px slit between them), so the hem can flutter as two flags, and the widest hem
    "C": {
        "sleeve": dict(bell=0.125, lip_hang=0.21, rh=0.072, rt=0.016, flute=0.17, lip=0.040, el_off=0.07,
                       crease=1.0),
        "tabard": dict(bot_t=0.82, w_top=0.064, w_bot=0.140, v_point=0.12, pipes=0.012, pipe_crease=0.7,
                       slit_t=0.55, slit_w=0.22, cross_t=0.40),
        "hair": {"crown_k": 1.28, "ear_k": 1.33, "layer_flick": 1.85, "mantle_s": 0.065, "tail_s": 0.085,
                 "scale": {"mantle_w": 1.25, "layer_w": 1.2, "tail_w": 1.4, "tail_dx": 1.35},
                 "veil": {"k": 1.34, "k_hang": 1.50, "az_hem": 76, "flare": 0.12}},
    },
    # D: the push. B's hair, bells a step past ref 14's (bell 0.15, lip to 0.25), the tabard as C
    "D": {
        "sleeve": dict(bell=0.150, lip_hang=0.25, rh=0.090, rt=0.020, flute=0.19, lip=0.050, el_off=0.09,
                       crease=1.0),
        "tabard": dict(bot_t=0.82, w_top=0.064, w_bot=0.140, v_point=0.12, pipes=0.012, pipe_crease=0.7,
                       slit_t=0.55, slit_w=0.22, cross_t=0.40),
        "hair": {"crown_k": 1.30, "ear_k": 1.36, "layer_flick": 1.95, "mantle_s": 0.075, "tail_s": 0.10,
                 "scale": {"mantle_w": 1.3, "layer_w": 1.25, "tail_w": 1.5, "tail_dx": 1.45},
                 "veil": {"k": 1.36, "k_hang": 1.56, "az_hem": 80, "flare": 0.14}},
    },
}

# round 2 (after the round-1 look sheets, review/rosace/art/finish/F3/look/): the round-1 tabards filled
# the idle's leg gap (the lambda went, A) or split into gold-edged spikes that read as extra legs (C, D),
# and the back view's longer tabard read as a third leg (CL-N05). The mass has to go outside the legs:
# ref 14-size bells, hair and veil fanned out behind the figure (a drape patch, drape_f3.json), and a
# tabard only a little longer and wider, one point, pipe folds
SLEEVE_BIG = dict(bell=0.160, lip_hang=0.30, rh=0.090, rt=0.020, flute=0.19, lip=0.050, el_off=0.09, crease=1.0)
TABARD_MID = dict(bot_t=0.70, w_top=0.064, w_bot=0.118, v_point=0.13, pipes=0.012, pipe_crease=0.7, cross_t=0.66)
HAIR_B = VARIANTS["B"]["hair"]
HAIR_D = VARIANTS["D"]["hair"]
VARIANTS.update({
    # E: ref 14-size bells, the mid tabard, B's hair, the p1 drape (hair and near bell fanned behind the hip)
    "E": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_B, "drape": "p1"},
    # F: E without the drape patch (what the drape alone buys)
    "F": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_B},
    # G: E with D's bigger hair and veil
    "G": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_D, "drape": "p1"},
})
# round 3 (after the round-2 look: E's veil point stood out as a horn, its tail left the back hair as a
# separate ribbon with a claw of azure tips): drape p2 (hair mass continuous, veil as posed, bell half
# as far back) and p3 (the bell only)
VARIANTS.update({
    "H": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_B, "drape": "p2"},
    "J": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_B, "drape": "p3"},
})
# round 4 (N1 look: the bigger far bell, flung forward, covered the chest and bust in E-G): N1 drape trials
VARIANTS.update({
    "K": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_B, "drape": "p4"},
    "L": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_B, "drape": "p5"},
})
# round 5, the blind set: L (the pick candidate) against its two nearest neighbours on the axes still open
VARIANTS.update({
    # M: L with D's bigger hair and veil (does more hair volume past the skull help, or clutter the head?)
    "M": {"sleeve": SLEEVE_BIG, "tabard": TABARD_MID, "hair": HAIR_D, "drape": "p5"},
    # N: L with round 1's medium bells (A-D's), to test the ref 14-size bells against a step smaller
    "N": {"sleeve": VARIANTS["A"]["sleeve"], "tabard": TABARD_MID, "hair": HAIR_B, "drape": "p5"},
})


def get(name):
    if name not in VARIANTS:
        raise SystemExit(f"finish_f3: no variant '{name}' (have {sorted(VARIANTS)})")
    return VARIANTS[name]

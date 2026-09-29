# Art rules: the finish gap, measured

What separates Rosace's integrated stills (5.7/10 from the whole-character critics) from the
finish-bar refs (07, 08, 09, 04; about 9), in numbers. Every measure is taken the same way on
the refs and on our idle, N1 contact and back stills at 144 px, and each one is checked against a
**codec control**: our own still pushed through the same kind of lossy WebP compression the refs
went through. Without that control, several of the "soft painted hi-bit" measures would mislead.

Companions: `ART-RULES.md` (the rules this feeds: PX-P17, PX-P39–PX-P41, WF-P16),
`pixel.md` (the earlier ref measurements), `face.md` (the face grid), `pose.md` (the figure-pose
lane), `REF-BREAKDOWN.md`, `CRITIQUE-PARAMS.md`. The refs are other people's art: they stay in the
git-ignored `review/refs/character/` and are named by filename only.

Tags as in `ART-RULES.md`: **[M]** measured by script (commands in section 6), **[visible]** seen
at zoom, **[I]** inference or estimate. Every expected score gain in this file is **[I]**.

---

## The short answer

**The driver's diagnosis is half right.** The gap is structural, but two of its four levers
don't survive measurement, and the biggest measured gap is one it didn't name.

1. **The biggest measured gap is colour saturation, and the diagnosis missed it.** Rosace is
   coloured almost everywhere. 87–91% of her pixels are chromatic, against 35–67% on the refs.
   Her median saturation is 0.43–0.51, against 0.15–0.42. 12–15% of her pixels are loud accent
   colours, against 0.4–3% on three of the four refs. The refs build big areas out of
   near-neutral darks and greys (blue-black, plum-black, grey) and keep strong colour for small
   accents. Rosace's darks are saturated indigo, her white cloth shades to lavender, and gold
   covers about 20% of the sprite. Of everything measured, this is the clearest case where she
   sits outside the range of every ref. It also holds at 80 px. [M]
2. **"Soft hi-bit painted pixels" is mostly compression.** 07, 08 and 09 are lossy WebP files.
   Put our 34-colour sprite through WebP at quality 90 and it measures 5,000 unique colours, 43–51
   colour groups (the refs measure 32–46), 7–8 colours in every 3×3 patch of a flat area (the refs
   8.6–8.9), and 3–9% of its edge pixels become in-between colours (the refs 9–14%). So the
   32-colour cap (PX-P15) is **not** what holds her back: the refs' own palettes are probably no
   larger than hers. [M] A real but smaller difference remains in how the tones are *used*: the
   refs put about **5 tones on skin and 3–4 on dark cloth**. Rosace uses 3 on skin and 2 on the
   stockings and boots. Her colour patches are also bigger and cleaner than the Amber Owl refs'
   (07, 08, 09) even after the codec, and she has more banding. [M]
3. **"The refs have bigger heads" is false.** Measured from the hair top to the chin, her head
   is 28 px of a 141 px figure (0.20). That matches 07 (0.20) and is bigger than 08 (0.18), 09
   (0.17) and 04 (about 0.14). Her eyes are the refs' width (6–7 px near, 5–6 px far). A bigger
   head would move her away from the refs. [M]
4. **"The refs have more mass" is true for three refs, not the fourth.** Her silhouette area per
   height² is 0.23. For 07, 08 and 09 it is 0.28–0.35, from baggy trousers, a jacket with a tail,
   and a robe. But 04, a 9 with a slim figure, measures 0.17. Mass helps as costume design (a
   wider tabard, sleeves, veil and hair), not as a rule. [M]
5. **The outline is too complete.** 90% of her idle silhouette edge is near-black. The refs run
   30–73%, lighting the lit side with the material's own colour. This is the one other measure
   where the idle and back stills sit outside every ref. [M]

**Ranked levers (section 4):** chroma budget (+0.8), pose from the running lane (+0.6), tone
density on skin and darks (+0.5), selective outline (+0.3), cloth mass (+0.3), value register
(+0.2, mostly delivered by the chroma work), fair sheet presentation (+0.1). Raising the colour
cap, anti-aliasing the silhouette or enlarging the head: about 0. These are estimates [I] and
they don't simply add up. A realistic target after the top five is **7.3–8.0**. Reaching 9 also
needs face and hand drawing quality, which these metrics don't capture.

---

## 1. What was measured and how

- **Ref crops:** the round-2 whole-character crops from
  `review/rosace/art/whole/round-2/key.json`: `07_idle` (07 bonus 1x), `08_idle` (08 bonus 1x),
  `09_idle` (09 1x) and `04_c` (04 native grid p2.158, which is resampled, so read it as
  approximate).
- **Ours:** `still.png` from `<build>/renders/integrated/{idle_hero, n1_contact,
  n2_pivot_black}/px144`: the same stills the round-2 critics saw, which are also the ones in
  `review/rosace/art/integrated/`. Material and part come from the `id.png` map (R = material, G =
  part; 4× supersampled, majority vote per pixel).
- **Figure masks:** the refs' backgrounds are flood-filled from the crop border using their
  measured background colours, with the drawn ground shadow `#606068` and its halo ring removed
  in the bottom rows, and enclosed background pockets of 6 px or more removed. 07's studio logo
  corner is cut. 04's white ground can't be told apart from its white skirt, so for 04 only the
  border flood is used. Masks were checked by eye at 3×. Ours comes from alpha.
- **Body without weapon:** for mass, bbox fill and banding. The refs' weapons are cut with
  hand-drawn polygons, approximate by ±5% of area (07's wrench crosses her head and arm). Ours
  drops the glaive parts (ids 33 and 34).
- **Material masks on the refs:** a hand-placed region per material (for example the face and
  arms for skin), filtered by a hue, saturation and L* rule. Ours use the material ids: skin 1,
  hair 5+6, light cloth 2, dark cloth 3+9 (stockings and boots), gold 4, steel 11+12.
- **Codec control:** our still on 09's grey (123,120,110), round-tripped through Pillow WebP
  at quality 60, 75 and 90, then measured with the same code. The refs' flat backgrounds are
  noisier than our round trip at any quality (local L* std 0.5–2.0 against 0.01–0.04), so they
  went through at least as much degradation as quality 90. The control is therefore a
  **lower bound** on how much compression inflates each ref number.
- **Units:** L* is CIE lightness (0 black, 100 white). "rel L" is relative luminance as in
  PIPELINE 3.4. S is HSV saturation (0 grey, 1 pure colour). "Chromatic" means S > 0.15 and
  V > 0.15. "Accent" means S > 0.6 and V > 0.3. H is the figure height from the hair top to the
  sole.

## 2. The table: refs against ours

How to read it: each row is one measure. The ref columns are the finish bar. The three "ours"
columns are the current integrated stills. The last column is our idle after the codec round
trip, the fair comparison for any measure the refs' compression inflates. The **Gap?** column
says whether ours sits outside the refs' range after allowing for the codec.

### 2.1 Colour count, clusters, texture and edges

| Measure | 07 | 08 | 09 | 04 | ours idle | ours N1 | ours back | ours idle, WebP q90 | Gap? |
|---|---|---|---|---|---|---|---|---|---|
| Figure px (with weapon) | 8,622 | 8,764 | 11,942 | 4,429 | 6,232 | 5,623 | 5,898 | – | – |
| Unique exact colours | 6,271 | 7,177 | 10,074 | 3,237 | 34 | 33 | 34 | 5,022 (N1 4,597, back 4,750) | **no**: codec |
| Colour groups for 95% of px (per-channel tol 16) | 37 | 32 | 46 | 39 | 18 | 20 | 19 | 43 (N1 51, back 46) | **no**: the refs measure *fewer* than our codec'd sprite |
| Colour groups for 95% (tol 8) | 184 | 169 | 235 | 177 | 23 | 24 | 23 | 192 | no: codec |
| Colours per 3×3 inside flat areas | 8.7 | 8.6 | 8.9 | 4.5 | 1.4 | 1.3 | 1.3 | 7.5 (N1 7.7, back 7.0) | small: ~1 more on the refs |
| Banding: hugging run pairs per 1,000 body px (refs and control despeckled) | 2.05 | 2.34 | 2.33 | 1.58 | 5.69 raw | 6.48 raw | 6.25 raw | 2.19 (N1 4.32, back 3.57) | **yes, partly**: 1.0–1.9× the refs on the same footing |
| Cluster size, pixel-weighted mean (despeckled) | 27.1 | 21.6 | 18.2 | 53.9 | 56.9 raw | 31.9 raw | 55.5 raw | 41.9 (N1 35.4, back 42.2) | **yes** vs 07/08/09 (1.5–2× larger patches); no vs 04 |
| Singleton px share (despeckled) | 22% | 23% | 23% | 17% | 8% | 12% | 10% | 14% (N1 17%, back 17%) | small |
| Silhouette ring px that are in-between (AA or halo) colours | 11.6% | 9.3% | 14.4% | 13.0% | 0.1% | 0% | 0.1% | 3.3% (N1 9.3%, back 7.7%) | **mostly codec**; real residual ≤ ~5 points |

### 2.2 Outline

| Measure | 07 | 08 | 09 | 04 | ours idle | ours N1 | ours back | Gap? |
|---|---|---|---|---|---|---|---|---|
| Ring px near-black (rel L < 0.06) | 59% | 39% | 30% | 73% | **90%** | 73% | **81%** | **yes**: idle and back above every ref |
| Ring px darkest (rel L < 0.03, PX-P17's measure) | 55% | 35% | 28% | 64% | 90% | 73% | 81% | yes |
| Edge px with a dark line within 1 px | 85% | 78% | 64% | 94% | 92% | 77% | 85% | no: the refs do have a line, they just break it |
| Interior near-black px (rel L < 0.03, lines inside) | 28% | 27% | 19% | 30% | 20% | 29% | 22% | no |

Treatment [visible, M]: 07 and 04 use a mostly full blue-black or black line. 08 and 09 are
selective: the lit side and the white hair take a coloured or light edge (09's white hair has
almost no dark line). Rosace is full navy OL, with PX-P38's red-umber only beside skin.

### 2.3 Value and saturation

| Measure | 07 | 08 | 09 | 04 | ours idle | ours N1 | ours back | Gap? |
|---|---|---|---|---|---|---|---|---|
| L* median | 26.5 | 27.8 | 33.2 | 42.7 | 47.4 | 38.9 | 38.9 | vs 07/08/09 yes; vs 04 no |
| L* 10th / 90th percentile | 6 / 68 | 7 / 82 | 10 / 76 | 1 / 97 | 7 / 88 | 7 / 87 | 7 / 87 | no |
| Share at L* 0–20 | 31% | 28% | 20% | 34% | 30% | 37% | 31% | no |
| Share at L* 20–35 (the dark-mid register) | **41%** | **37%** | **35%** | 11% | **8%** | **6%** | **10%** | vs 07/08/09 yes; 04 has the same gap |
| Share at L* 35–50 | 11% | 10% | 24% | 9% | 16% | 17% | 21% | – |
| Share at L* 50–65 | 5% | 5% | 7% | 7% | 14% | 8% | 10% | – |
| Share at L* 65–80 | 8% | 8% | 6% | 12% | 11% | 14% | 12% | – |
| Share at L* 80–100 | 3% | 12% | 8% | 28% | 21% | 18% | 16% | – |
| rel L < 0.10 / > 0.50 (PX-P32's terms) | 76% / 5% | 69% / 15% | 61% / 10% | 46% / 31% | 38% / 21% | 43% / 18% | 41% / 16% | – |
| HSV S: 5th / median / 95th percentile | 0.04 / **0.21** / 0.71 | 0.04 / **0.20** / 0.87 | 0.04 / 0.42 / 0.88 | 0.00 / **0.15** / 1.00 | 0.03 / **0.43** / 0.77 | 0.09 / **0.51** / 0.70 | 0.11 / **0.49** / 0.77 | **yes** |
| Chromatic share (S > 0.15, V > 0.15) | 53% | 52% | 67% | 35% | **87%** | **89%** | **91%** | **yes: above every ref** |
| Accent share (S > 0.6, V > 0.3) | 0.4% | 2.2% | 20% (the red robe is the costume) | 3.1% | **11.8%** | **14.7%** | **11.9%** | **yes** vs 3 of 4 |
| Hue families (30° bins holding ≥ 3% of chromatic px) | 7 | 6 | 3 | 3 | 4 | 5 | 4 | no: "many hues" only fits 07/08 |
| Hue entropy, bits | 2.61 | 2.27 | 0.98 | 1.41 | 1.85 | 1.99 | 1.85 | no |
| Codec control, idle q90: median S / chromatic share | – | – | – | – | 0.36 / 77% | – | – | compression *lowers* our saturation, so the refs' true figures are if anything higher than measured, and still below ours |

Where our chroma sits (idle, share of all sprite px) [M]: accent px are gold 7.9%, lavender
white 1.2%, glaive glass 1.4%, other 1.1% (skin, steel, hair). Chromatic px by material: gold 19.5%, white 12.8%
(the W3/W4 lavender shadows), indigo hair 12.4%, skin 10.2%, indigo haft 9.6%, stockings 8.4%,
boots 3.3%. Gold covers 19.6% of the sprite, glaive included, against PX-P32's ≤ 10%.

At 80 px the same pattern holds [M]: median S 0.49–0.51, chromatic share 89–94%, the L* 20–35
register 6–10%, and near-black ring 76–88%.

### 2.4 Tones per material

How to read it: "tones" is the number of distinct lightness steps (1-D greedy clusters of ±5 L*)
that cover 90% of the material's pixels, with outline pixels left out. Compression adds at most
one tone: the control's skin goes from 3 to 4 and its dark cloth stays at 2. "Hue shift" is the
hue of the lightest quarter minus the darkest quarter, in degrees. "S dark / light" is the mean
saturation of the darkest and lightest quarters.

| Material | 07 | 08 | 09 | 04 | ours idle (N1, back the same unless noted) | Gap? |
|---|---|---|---|---|---|---|
| Skin: tones | **5** | **5** | **5** | **5** | **3** (codec control 4) | **yes** |
| Skin: L* 5th–95th percentile | 41–89 | 38–90 | 41–92 | 57–96 | 49–95 | no |
| Skin: hue shift, dark to light | +12° | +9° | +7° | +21° | +17° (back +15°) | no |
| Skin: S dark / light | 0.25 / 0.20 | 0.31 / 0.16 | 0.20 / 0.14 | 0.29 / 0.13 | **0.43** / 0.23 | yes: saturated shadows |
| Hair: tones | 3 | 3 | 3 (white) | 7 (pink; resampled, noisy) | 3 (back 4) | no |
| Hair: L* range | 11–39 | 11–33 | 70–97 | 18–73 | 25–69 | only vs the dark-haired 07/08 |
| Hair: hue shift | −17° | −3° | +12° | +7° | −1° (N1 −5°, back −7°) | no |
| Hair: S dark / light | 0.29 / 0.15 | 0.68 / 0.43 | 0.10 / 0.05 | 0.62 / 0.38 | 0.58 / 0.50 | vs 07/09 |
| Light cloth: tones | – | 4 | – | 3 | 4 | no |
| Light cloth: S dark / light | – | 0.06 / 0.09 | – | 0.05 / 0.01 | **0.30** / 0.03 | **yes**: lavender shadows vs near-neutral |
| Dark cloth: tones | **4** | **4** | **3** | **3** | **2** (L* 12 and 19) | **yes** |
| Dark cloth: L* range | 12–36 | 12–35 | 16–34 | 10–28 | 12–36 (most px at 12 and 19) | – |
| Dark cloth: S dark / light | 0.31 / 0.17 | 0.31 / 0.17 | 0.19 / 0.13 | 0.20 / 0.21 | **0.40 / 0.39** | **yes** |
| Metal: tones | 5 (knee pads) | 7 (sword; noisy) | 5 (katana) | – (gold trim too thin to sample) | gold 4 (N1 3), steel 3 | slightly |
| Metal: S dark | 0.43 | 0.15 | 0.59 | – | gold **0.76**, steel 0.39 | gold is louder |

The refs' hue shifts are the same size as ours (PX-P05 already works). What differs is **how
many steps** the skin and the darks use, and **how grey** the shadows and dark materials are.

### 2.5 Proportion, face and mass

| Measure | 07 | 08 | 09 | 04 | ours idle | Gap? |
|---|---|---|---|---|---|---|
| Figure height H, hair top to sole (px) | ~142 | ~149 (under the bun) | ~164 (between the ears) | ~150 (skull under the hat) | 141 | – |
| Head, hair top to chin (px) | ~28 | ~27 | ~28 | ~21 (skull) | 28 | – |
| **Head ÷ H** | **0.20** | **0.18** | **0.17** | **~0.14** | **0.20** | **no: ours is at the top of the range** |
| Head ÷ H, skull top (REF-BREAKDOWN) | 24/137 = 0.18 | 25/150 = 0.17 | 25/158 = 0.16 | 21–23/~150 | about 25–26/141 = 0.18 [visible, the hair shell is 2–3 px] | no |
| Near / far eye width (px) | 5–7 / 5–6 (face.md) | 5–7 / 5–6 | 5–7 / 5–6 | 3–4 (REF-BREAKDOWN) | 6–7 / 5–6 | no |
| Lash top to chin (px) | 14.5 | 13 | 13.5 | – | 13–14 (the R4fix 11 has since been corrected) | no |
| Body bbox (w × h, weapon out) | 82 × 139 | 95 × 160 | 143 × 175 | 55 × 164 | 83 × 141 (N1 177 × 113, back 90 × 140) | – |
| Body bbox fill (area ÷ bbox) | 0.51 | 0.48 | 0.43 | 0.49 | **0.39** (back 0.36) | yes, modest |
| Sprite bbox fill (with weapon) | 0.44 | 0.35 | 0.48 | 0.49 | 0.31 (N1 0.19, back 0.24) | the glaive's long diagonal |
| **Mass: body area ÷ H²** | **0.30** | **0.28** | **0.35** | **0.17** | **0.23** (back 0.23; N1 0.29 crouched) | vs 07/08/09 yes; vs 04 no |
| Row width ÷ H at 0.5 / 0.6 / 0.7 / 0.8 H (hips to calves) | .36 / .46 / .36 / .26 | .25 / .33 / .37 / .28 | .41 / .44 / .55 / .65 | .22 / .20 / .12 / .07 | .21 / .21 / .21 / .22 | the lower body is where she is thin vs 07/08/09 |

Head measurements are ±1–2 px (chin rows read by eye on 10× grids, which are in
`review/rosace/art/finish-gap/gh_*.png`).

## 3. Testing the driver's four levers

1. **FINISH: hi-bit painted pixels on a self-imposed 32-colour cap.** *Partly refuted.* The
   refs' many colours, soft edges and flat-area texture are mostly the WebP codec: the same codec
   gives our 34-colour sprite a comparable count (43–51 groups against the refs' 32–46), 7–8
   colours per 3×3 flat patch (refs 8.6–8.9) and 3–9% in-between edge pixels (refs 9–14%). Raising
   the cap buys nothing by itself. **What survives:** skin 5 tones vs our 3, dark cloth 3–4 vs
   our 2, patches 1.5–2× larger than 07/08/09's, and banding 1.0–1.9× the refs' on the same
   footing. That's a *tone-placement* lever (more steps where forms turn, smaller clusters), and
   it needs about 4–6 more colours, which fit in PX-P15 if the saturated indigo and azure steps
   give some up. Low-key values fit 07/08/09 but not 04, which is white-costumed like Rosace
   and sits at our key.
2. **PROPORTION: ref heads are 1/6, ours is a taller model.** *Refuted.* Head ÷ H is 0.20 for
   her and for 07, and 0.14–0.18 for the others. Her eye widths match. Don't enlarge the head.
   Any face-appeal gap is in the drawing (the critics' face notes), not the size.
3. **MASS: big cloth shapes vs thin strips.** *Confirmed against 07/08/09, contradicted by 04.*
   Mass 0.23 vs 0.28–0.35, with the lower body at 0.21 H wide where the others are 0.25–0.65. 04
   shows a slim, 0.17-mass figure can be a 9, so treat this as a costume-design lever (wider
   tabard panels, fuller sleeves and veil, hair mass), not a hard rule.
4. **POSE.** Not measured here; the figure-pose lane owns it. Body bbox fill (0.39 vs 0.43–0.51)
   is the one number here a pose moves: a wider stance and an arm on the hip fill the box.

**What the diagnosis missed:**

- **Chroma** (section 2.3): the one measure where all three of our stills sit outside all four
  refs, it can't be explained by the codec (the codec makes it look *smaller*), and it matches
  the sourced rule we already hold but don't meet ("big low-saturation areas, small
  high-saturation accents", `pixel.md` 1.2).
- **Outline completeness** (section 2.2): 90% near-black on the idle ring against 30–73%.
- **Presentation parity:** on the round-2 sheets, 07, 08 and 09 stand on their own painted
  ground shadows and are seen through their codec, while ours is shown without its contact
  shadow (`still.png`, key.json) and losslessly. That changes how the finish reads, though not
  the art itself.

## 4. Ranked levers

The gains are the driver's estimates [I] of how much each lever moves the whole-character
score from 5.7, judged on the critique parameters it touches. They overlap and do not add up
linearly.

| Rank | Lever | Measured now → target | Params moved | Expected gain |
|---|---|---|---|---|
| 1 | **Chroma budget.** Neutralise the big areas: stockings and boots into near-neutral blue-black (S ≤ 0.30), white cloth shadows toward grey-lavender (S ≤ 0.12), the indigo hair and haft darker and greyer (S ≤ 0.40), gold under 10% of the sprite with its dark step desaturated. Saturated colour stays on the eyes, the gem, the azure tips and a thin gold line | chromatic 87–91% → ≤ 70%; median S 0.43–0.51 → ≤ 0.35; accent 12–15% → ≤ 5% (PX-P39) | 14, 15, 1 | **+0.8** (0.5–1.1) |
| 2 | **Pose** (figure-pose lane, concept A; not measured here) | body bbox fill 0.39 → ≥ 0.45 | 9, 10, 12, 1 | +0.6 (0.4–1.0) |
| 3 | **Tone density on skin and darks.** Skin 5 tones (add a warm reflected-light step and a cast-shadow core); dark cloth 3–4 tones between L* 10 and 36; smaller clusters and fewer hugging bands where forms turn | skin 3 → ≥ 4 (PX-P41); dark 2 → ≥ 3 (PX-P40); weighted cluster size (raw) 32–57 → ≤ 30; banding → ≤ 3.5 raw | 14, 16 | +0.5 (0.3–0.7) |
| 4 | **Selective outline.** The lit side of the silhouette takes the material's darkest tone (not OL) on hair, cloth and gold, as PX-P38 already does on skin | near-black ring 73–90% → ≤ 75% on every still (PX-P17 changed) | 16, 14 | +0.3 (0.2–0.4) |
| 5 | **Cloth mass.** Wider tabard panels that flare, fuller sleeves, veil and back hair (outfit and hair lanes, after the pose) | mass 0.23 → 0.27–0.30; lower-body width 0.21 H → ≥ 0.26 H | 13, 10, 1 | +0.3 (0.1–0.5) |
| 6 | **Value register.** Mostly a side effect of 1 and 3: greyer, darker indigo lands in L* 20–35 | L* 20–35 share 6–10% → 20%+ (not a rule: 04 has 11%) | 15 | +0.2 (0.1–0.3) |
| 7 | **Fair presentation (WF-P16).** Show ours with its contact shadow when the refs stand on one; one diagnostic sheet with ours through the refs' codec, to learn how much of "finish" is codec. It changes no art and doesn't count as progress | – | 1, 16 | +0.1 (the codec panel: diagnostic only) |
| 8 | Raise the colour cap (PX-P15), anti-alias the silhouette, add texture noise | the refs measure no higher than us once the codec is allowed for | 16 | ~0 (0–0.1) |
| 9 | Bigger head | ours is already at the top of the refs' range | 4, 5 | ~0; risks a chibi read (negative) |

If 1, 3, 4 and 5 land together with the pose, the realistic result is **7.3–8.0**. The rest of
the way to 9 is drawing quality these numbers can't see: the face (critique param 2), hands (6)
and the costume read (13).

## 5. The round-2 critics' material

`review/rosace/art/whole/round-2/` holds the sheets and `key.json` (letters A = 04, B = 09, C =
control, D = 07, E = ours, F = 08; seed 20261006) and no written verdicts. The critics' zoom
crops are in `whole/_crit-7-8-13/` and `whole/critic-14-17/r2/`. Their names (`idle_C_torso`,
`idle_E_torso`, `n1_*_body`, `e_face`, `E_*_80x6`, and in round 1 `orph_C`, `orph_F`) show where
they looked: torsos, bodies, faces, the 80 px stills and orphan pixels, almost all on ours and the
control. The 5.7 and the parameters the refs won came back to the driver, not to disk, so this
file doesn't quote them. **Next time, save each critic's sheet (scores per parameter plus notes)
beside `key.json`** (WF-P16).

## 6. Reproduce

Ref side (reads the third-party refs, so it lives in the git-ignored review folder):

```sh
cd review/rosace/art/finish-gap
python crops.py        # the key.json crops, native 1x
python masks.py        # figure masks -> masks_all.png (check by eye)
python measure.py      # sections 2.1-2.3, 2.5 -> metrics.json
python webpctl.py      # codec control -> webp_control.json
python materials.py    # section 2.4 -> materials.json
python banding.py      # banding and clusters (pixel_metrics.py) -> banding.json
```

Our side, for checks and later rounds (committed):

```sh
python tools/art-construct/finish_metrics.py <build>/renders/integrated/idle_hero/px144 \
    <build>/renders/integrated/n1_contact/px144 <build>/renders/integrated/n2_pivot_black/px144
```

## 7. Limits

- The ref material masks are hand-placed regions plus a colour rule, so a few AA or neighbouring
  pixels leak in (08's metal is its sword, whose noisy blade gives 7 "tones"). Read the tone
  counts ±1.
- The weapon polygons are approximate (±5% of body area on 07).
- 04 is resampled from a non-integer grid, so its clusters are the least trustworthy; its values
  and saturation are fine.
- The chin and hair-top rows are read by eye, ±1–2 px.
- The integrated stills predate the figure-pose lane's winning pose. Chroma, outline and tone
  counts don't depend on the pose; mass and bbox fill do.

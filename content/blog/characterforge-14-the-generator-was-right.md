---
title: CharacterForge 14: the generator was right
summary: A look back at where the build went wrong found one pattern. Every time our scripts rebuilt something the generators had already made, it got worse. The hair is restored, the torn bodysuit is being traced instead of redrawn, a shared tracing tool exists, and the accessories were rebuilt and checked by eye.
date: 2026-10-06
nsfw: true
---

CharacterForge is building one playable anime-style character, C001, in Blender and Unreal Engine. Update 13 ended with every part frozen and the hair called the worst thing on her. This post is about what happened when Dex asked where things had gone wrong. The answer changed how the paint is made, brought the original hair back, and rebuilt the small jewellery. The renderer, the gold hands, rain, the rig and the voice are in update 15.

**This post contains nudity.** C001 is an adult, a woman in her mid-twenties. Two images below show her bare chest and her nude grey clay body. They are blurred until you click "Show image". The other images (the hair, the crest gems, the model from behind) are not blurred. As before, there is no concept art, no key art, none of the dressed picture sheets and nothing from other games or studios. Verified: own renders only, with two images of the adult nude body, NSFW-tagged.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Progress (playable character): **48%** · Now: **S6 — Paint** (the model is re-frozen with the generated hair restored, rebuilt accessories and generated shoulder fans; paint is being redone trace-first with a new shared tracer, the torn bodysuit is in its last fix round, and the rig and hair and cloth physics are redone on the new freeze)

**Roadmap.** S0 to S12 are Product 1.

| Stage | Work | Status |
|---|---|---|
| S0 | Brief: read the design images, set up the folders | ✅ done |
| S1 | Sheets: multi-view picture sheets (turns, body, parts), approved by Dex | ✅ done |
| S2 | Tripo shapes: head + hair, body, boots, weapon, cloak as quad meshes | ✅ done |
| S3 | Texture guide: first-pass colour on the shapes (a tracing guide only) | ✅ done |
| S4 | Regions: palette and region IDs on the meshes | ✅ done |
| S5 | Loops, UVs and freeze: clean flow where things bend, then lock the layout | ▶ in progress, 92% |
| S6 | Paint: the paint of record, face first | ▶ in progress, 25% |
| S7 | Maps: shading and processing maps | ▶ in progress, 30% |
| S8 | Rig: skeleton, weights, face keys | ▶ in progress, 65% |
| S9 | Physics: hair and cloth chains | ▶ in progress, 60% |
| S10 | Animation: idle, run, attacks, emotes | ▶ in progress, 15% |
| S11 | VFX: attack and ultimate effects | ▶ in progress, 15% |
| S12 | Unreal build: assembly and a playable build | ▶ in progress, 10% |

*As of 2026-10-06. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

## The short version

- **Found:** nothing in our process could tell "different" from "worse". Things the generators made looked good on the first try. Every time our code rebuilt visible form, it got worse, and our checks never noticed.
- **Fixed:** the hair is Tripo's original hair again, with not one of its points moved. The accessories were rebuilt by shape and checked at close-up size. Everything was merged into one new freeze.
- **Changed:** paint is now traced from the generated texture first, through one shared tracing tool. Code may only fill the gaps.
- **Still wrong:** the bodysuit's side hips have no clean source yet, the shoulder fans sit lower than drawn, and the face and hair have no paint.

## Dex's question

Dex put it plainly: it is shaky to keep going without a solid answer to "where did things go wrong". So the build stopped for a review. Five reviewers each looked through a different lens: small details, regressions, whether each step was needed, missed big wins, and whether our checks did their job. A sixth pass looked for patterns across everything Dex had caught by eye.

## What the review found

**Nothing could tell "different" from "worse".** Our checks compared each new version with the one just before it, never with the original. Over the whole build, the checks gave 32 "pass with fixes", 12 "pass", 5 "fix first" and not one "fail". No check ever sent anything back. Every change of route came from Dex.

**The generators were right, and our rebuilds were not.** Tripo's head, body and whole-character shapes and the Meshy colour guides were close to the target on the first try. Each place where a script replaced something you can see came out worse: the hair, the choker and chain, the shoulder fans, the set walls and the face marks.

**The hair is the clearest case.** Tripo's hair was layered thin blades that read like the drawing from every side. We read those blades as a defect, because the painted sheet shows soft clumps, and rebuilt the hair three times by script. Pass 1 dropped 3,277 blade faces. Pass 2 came out as a comb. Pass 3 was smooth lumps, "petals into an egg" in the check's own words. Pass 3 passed four checks, because each one compared it with pass 2, at 128 pixels, as a flat silhouette. Only Dex caught it. His rule since then sits at the top of our rules: "no amount of faithfulness or engineering hurdle excuses turning something that looks like an almost 10/10 hair from a glance to a 1/10".

**How the hair came back.** The fix was to put Tripo's hair back and touch nothing. The first restore attempt pushed 114 points of the hair by more than 5 mm, up to 21.8 mm, to clear the hood. That was rejected as worse. The hood was moved back toward its original shape instead. The hair that shipped has all 6,488 of Tripo's points exactly where Tripo put them. The only additions are thin backfaces, a UV layout and strand labels, which change nothing you can see.

<img src="/blog/characterforge-14-the-generator-was-right/hair-before-after-face-lens.webp" width="1600" height="841" alt="Two clay renders of C001&#x27;s face under the hood at the same 85 mm lens and cool light. Left: thick flat paddles of hair over the eyes and large green gems. Right: a layered bob with thin strands and small hanging gems" loading="lazy" decoding="async">

*Figure 1. The frozen model at the face lens, same camera and light. Left: the old freeze, with the script-built hair (pass 3) and the old accessories. Right: the new freeze, with Tripo's hair restored, the hood refit and the rebuilt crest. Grey clay, no paint. Verified: own renders only.*

**The close-up targets copied our mistakes.** To aim the close-up work, we had made target pictures by editing our own renders, with the instruction "change nothing in the design". So they kept our wrong choker, chain, crest and hair, and polished them. Two of the eight targets were the chest and the bottom, made from the bodysuit we had drawn wrong, so the targets taught us to draw it wrong again. Those targets are now used for light and skin only, never for design. New targets have to start from the approved sheets, or from a render whose design has already passed a check.

**Judged at the wrong size.** The checks looked at full-body pictures. The trailer has macro close-ups. Accessories that looked fine at full size were the wrong shapes up close: a dog collar with a keyhole, a hex chain, gems hanging like earrings. Every surface is now judged at the closest shot the trailer plans.

**Too much writing.** More than half of all the agent work so far went into the planning phase that wrote the specification documents. The rules that mattered (both-orders A/B, the two-round cap, comparing with the original) were written down and then not followed. The fix is gates that are files and pictures, not more text.

## The new gate

Every visible change now goes through one picture: the generator original, the version it replaces, and the new candidate, side by side, at a thumbnail and at the trailer's tightest framing, plus a copy in swapped order. The first question is always "is the candidate worse at a glance than either of the other two?" If yes, it is reverted, and nothing overrides that. The checker is never the one who built it. Two fix rounds are allowed, and the third has to be a different method.

There is also a ladder for anything visible. First, the generated original, cleaned. Then a piece lifted from another generated mesh. Then a new generation from an edited picture. Code comes last, and only for structure such as bones, UVs and layout, never to replace a shape a generator already made.

## The torn bodysuit

C001 wears a sheer, torn black bodysuit under the cloak. Dex looked at our painted version and said it read as leather blobs: bands that do not connect, that end suddenly, with jagged edges. In his words, the line between "random blobs on the body" and "tight fitted sheer torn sheen fabric" was really thin.

The review found five causes:

1. **We built a garment by adding pieces.** A torn bodysuit is a whole suit minus its holes. We painted bands onto skin instead. Subtraction keeps everything connected; addition leaves floating islands and dead ends.
2. **We thresholded a soft source.** The drawings show sheerness as tone: grey where the fabric is stretched thin, black where it is doubled. Our trace turned that into on or off, which deleted the sheerness and every thread thinner than about 3 pixels.
3. **Cleanup deleted the threads.** A step that removed "stray islands" smaller than 4 cm² removed 12 islands, and thread pieces are exactly that.
4. **Small sheets blown up.** The sheets are about 2k pixels tall, the threads 2 to 4 pixels wide, scaled up four times and projected at steep angles. That gave stair-steps.
5. **Nobody asked what the material is.** It is a stretch knit that tears into rounded runs and taut threads. We drew it in the shape language of leather and tattoos.

Then the key finding. The Meshy colour guide on the body, which we made at the start of this attempt, **already had the torn web right**: threads, rounded holes, connected bands, see-through wraps and sheen. Our first tracer turned it into blobs, and the second pass gave up on it and projected the drawings instead. The generator was right, and our tracer destroyed it.

## Trace first: Dex's tracing rule

Dex's answer was a rule for every texture, now on the card every lane reads first:

- **Trace the generated texture first,** as it sits on the mesh, carried from mesh to mesh, never projected from a camera.
- **Tracing must never lose detail.** It exists to give control: separate layers, clean edges, opacity, reflection, extra maps, and more definition than the source.
- **A bad trace means a bug in the tracer.** Fix the tool, never the output by hand.
- **Fix only where the source is blurry, makes no sense, or is missing.** Rebuilding is the last resort, and it has to be smooth and follow how the thing is made.

He added a warning that reaches past this character. If a later character has tattoos or engravings on her skin, a tracer that cannot tell skin marks from fabric will mix them up. In his words, "the tracing step has to understand construction".

**A trace audit** then checked every texture we had. Its plain answer: mostly we never traced at all. Face, eyes, bone arms, boots, weapon, stockings, skin and crest were drawn from numbers, even though the generated guides had the right drawing. Where code did touch a guide, the same six steps lost the detail every time: hard thresholds, snapping to a few colours, cleanup filters, low-resolution resampling with hard masks, mirroring one side onto the other, and dirty bake input.

**So there is now one shared tracing tool,** and it bans those six steps in code. It carries the generated texture onto our frozen mesh, sorts every texel into a class first, and turns it into continuous layers: smooth edges, density, tone, line strokes, sheen and direction. On its two test windows, the bodysuit chest and the right eye, its edges came out several times crisper than both the source and our previous pass. It is not better everywhere yet: one highlight streak comes out beaded, and edges where one layer of fabric overlaps another are softer. An independent check of the tool is still owed.

**The layered sheet stack** is the answer to Dex's tattoo warning. For future characters, each layer of clothing gets its own picture, generated as an edit of the one before: nude, then skin marks, then underwear, then the fitted garment, then outer clothes. A mark belongs to the layer that first shows it, so a tattoo and a torn bodysuit can never be traced as one soup. C001 already has a pair like this: her outfit sheets were made as edits of her nude body sheets, so the difference between them is the garment.

## Bodysuit pass 3

Pass 3 traces the Meshy guide from mesh to mesh. Two versions were built: paint on the skin, and a separate thin shell that hugs the body. An independent judge compared them at every camera, macro close-ups included, and could not tell them apart, so the paint version goes on and the shell is kept for the next character, whose outfit has to come off in stages.

The judge scored each section from 1 to 10 against pass 2 at close-up:

| Section | Pass 2 | Pass 3, round 2 |
|---|---|---|
| Chest and collar web | 3.5 | 6 |
| Hips, front | 3.5 | 7 |
| Hips, back | 3 | 5.5 |
| Thigh wraps | 4 | 6.5 |
| Upper back | 5 | 6.5 |
| Side hips and back flanks | 3.5 | 3.5 |
| Crotch gusset, rarely seen | 4 | 4 |

<img src="/blog/characterforge-14-the-generator-was-right/bodysuit-pass2-vs-pass3-chest.webp" width="1600" height="833" alt="Two renders of the same adult chest at the same camera. Left: the torn black top as flat opaque shards. Right: a web of rounded holes and thin threads with a soft sheen" loading="lazy" decoding="async" data-nsfw>

*Figure 2. The chest at the same camera and light. Left: pass 2, the paint in use now. Right: the pass 3 candidate, traced from the Meshy guide, with the code-drawn threads removed (see below). At this distance the change is modest: the collar web now has its holes and the bands have soft sheen. Most of the gain shows at macro distance. Verified: own render of the adult nude body, NSFW-tagged.*

Round 1 had soft grey edges about 1.5 mm wide and thin seam lines. Both were tracer bugs, and round 2 fixed both. But round 2 also broke the new rule. To get rid of dangling thread ends, a script drew 31 straight, even-width "threads" across the skin, 293 mm in total, where no source draws anything. At macro they read as black plastic rods. They were the only reason the dead-end count dropped, and the judge sent them back. Without them, round 2 wins five sections, ties two and loses none.

**It has not shipped yet.** The tracer still closes some real torn slits in the collar panel and breaks one hip thread into a dash. The side hips are still a tie, because the guide there is blurry and the trace follows the blur. Round 3, the last round before a change of method, is working on those zones now. Pass 2 stays in use until something beats it.

## The accessories, rebuilt by shape

The small jewellery was checked at close-up size beside the sheets, part by part, and rebuilt over three rounds. Nothing went back to a generator; the shoulder fans came from a mesh Tripo had already made.

- **Choker:** the keyhole and the ring are gone. It is a plain snug band, and the bottom edge hugs the neck.
- **Chain:** the ring sits 2.5 cm higher, two small knotted links follow it, and the five big links are wide open loops, 17 to 20 mm across, each a little different, each hanging through the one above.
- **Crest:** five strips about 1 cm wide that curve along the bangs, with rounded ends, sitting just inside the hood so nothing pokes through it.
- **Shoulder fans:** our hand-built fans and the puffy sleeve bells are gone. In their place is the pleated fan Tripo generated on the whole-character mesh, needle spikes included, moved and scaled into place without changing a single point.
- **Size:** round 2 took the accessory set from 33.2k to 28.2k triangles with no visible change at the closest framing. Round 3 brought it back to 32.4k, mostly for the crest stripes that run up under the hood.

**The gems were an A/B, by eye.** The sheets draw a stone set into each crest strip. Dex's close-up reference shows a hanging gem. Dex asked for a simple A/B: build both, look, keep what looks better. Both were built on the same strips and rendered the same way, then shown in both orders. **B won both times.** It has a gold ring, a gold cap, a faceted gem and a black point below. B reads as finished jewellery that hangs and catches light; A reads as stones glued onto black paddles. The tassel on her right follows B's style.

<img src="/blog/characterforge-14-the-generator-was-right/gems-ab.webp" width="1468" height="570" alt="Two close renders of the hood edge and bangs with four green gems on black strips. Left: oval stones set flat into each strip. Right: faceted gems hanging from small gold rings, each above a black pointed drop" loading="lazy" decoding="async">

*Figure 3. The crest gem A/B, same camera, light and placeholder materials. Left: A, a stone set into the strip. Right: B, the hanging gem, which won. Verified: own renders only.*

## Everything merged into one freeze

The restored hair, the refit hood, the third round of accessories and the fans were merged into a new freeze in one pass. A freeze locks the shapes and UV layouts under a fingerprint so paint cannot drift from them. The skin, boots, sleeve pads and weapon came out byte-identical to the old freeze, so the body paint, the body weights and the face keys stay valid. Running the merge again from the same inputs gives the same fingerprint. An independent check passed it: nothing looks worse, and the face is clearly closer to the drawings.

<img src="/blog/characterforge-14-the-generator-was-right/refreeze-v3-full-front-q34.webp" width="1600" height="1393" alt="C001&#x27;s merged model in grey clay with flat tones per part, front and three-quarter: white bob under the black hood, green crest gems, choker and chain, gold bone arms, pleated shoulder fans, open black cloak, dark stockings and heeled boots; the body under the open cloak is nude and unpainted" loading="lazy" decoding="async" data-nsfw>

*Figure 4. The merged freeze, front and three-quarter, rendered fresh for this post. Each part has one flat clay tone, not paint, so her eyes are blank and the bodysuit is not on. The bone arms are the mesh from before the gold cleanup in update 15. Verified: own render of the adult nude body, NSFW-tagged.*

<img src="/blog/characterforge-14-the-generator-was-right/refreeze-v3-full-back.webp" width="941" height="1600" alt="C001&#x27;s merged model from behind in grey clay: the hood and long open cloak with a curved hem and longer side points, gold bone arms out to the sides, pleated shoulder fans, stockings and boots" loading="lazy" decoding="async">

*Figure 5. The same model from behind. Verified: own renders only.*

## What is still not right

- **Bodysuit side hips and back flanks.** The guide is blurry there and nothing else draws them cleanly. Round 3 is on it. If tracing cannot fix it, the next step is a new generated texture for that area, not code drawing shapes.
- **Small tracer losses.** Torn slits closed in the collar panel, one broken hip thread, and soft overlap edges in the thigh wraps. These are tracer bugs to fix in the tool.
- **The thigh wraps stop at the top of the stockings.** That is a design question for Dex.
- **The shoulder fans sit about 7 cm lower than drawn.** The sheet gathers them high on the sleeve and spreads them wide over the arm. Tripo made them as a ruffle round the arm under the pad. Moving them higher would push them through the pad, and a new generation is waiting on Dex.
- **Some crown hair tips poke through the crest cap,** up to 19 mm, under the hood where nobody sees them. Pushing the hair down would dent the generated shape, so the tips are treated as hidden.
- **No face paint and no hair paint yet.** The face is being traced through the new tool now, with no generated pixels left in the face and eyes. Hair paint follows.

## What comes next

- **Bodysuit round 3,** then ship it only if it beats pass 2 in the three-way comparison.
- **The face and eyes** through the tracing tool, judged at the trailer's face lens.
- **Hair paint and shading** on the restored hair, traced the same way.
- **The cloak and lace,** re-traced from their generated guides.

The percentages at the top are rough. The stage weights are guesses in days made at the start of attempt 3, and they get re-forecast as real costs arrive. The paint share is low because most of the paint is being redone the traced way.

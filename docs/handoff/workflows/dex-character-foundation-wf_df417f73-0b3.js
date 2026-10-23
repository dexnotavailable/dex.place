export const meta = {
  name: 'dex-character-foundation',
  description: 'Character foundation: ref breakdown, AAA attack research, motion sources, 3D-to-pixel spike, judged moveset + design docs',
  phases: [
    { title: 'Research', detail: 'ref breakdown, AAA research, motion/model sources (parallel)' },
    { title: 'Spike', detail: 'Blender 3D-to-pixel pipeline proof + blind A/B critique' },
    { title: 'Concepts', detail: '3 competing moveset/design concepts from different angles' },
    { title: 'Judge', detail: '3 judges with distinct lenses' },
    { title: 'Synthesize', detail: 'winner + grafts -> MOVESET.md / DESIGN.md, adversarial critic, one revise round' },
  ],
}

const CTX = `
Project context:
- dex.place is Dex's personal site; its top layer is a 2D side-view pixel-art action world. We are designing the PLAYER CHARACTER. Repo: D:\\Dex\\Projects\\dex.place (public GitHub repo; do not commit or push; the coordinator does).
- Dex's brief (verbatim essentials): "imagine AAA game characters from studios like Kuro, HoYo, Gryphline but in 2D form - the latest characters where their attack animations and sequences are much more creative, the skill effects, etc - should have this level of quality." Prefers VERY WIDE area AOE attacks with wide effects. Moves needed: M1 (basic attack string), M2 (dash), Q skill, R ultimate — "all of them should feel wide, grand, fluid". Expects rim lighting and good particle effects. Outfit: the priest/sister costume ref (white + gold, high collar with cross, detached long flared sleeves with gold trim, long front tabard with gold cross, garter straps with cross charms) — "decently revealing but still in theme". Weapon: a big glaive or sword. Enemies: red/black/white limited-palette armored figures (ref 13).
- Quality method: A/B "which looks better" against the refs, repeated until critics split 50/50 or prefer ours. A previous attempt (a 2D procedural contour rig drawn in code, branch claude/magical-meitner-ea41go, "character-01 / crimson halo") was rated 3/10 by Dex; do not repeat that approach as the main route.
- Chosen production route (coordinator decision, being proven by a spike): Dead Cells-style 3D-to-pixel. Model + rig + animate in Blender (5.1.2 installed at C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe, VRM add-on installed, no MMD Tools add-on yet), render each frame at low native resolution with toon shading and no anti-aliasing, post-process to clean pixel art, hand-author the face and 2D VFX on top, and export per-frame normal maps so the game can do real rim lighting. Timing may be borrowed from MMD motions / mocap and then altered.
- HARD RULE: no image generation of any kind (no GPT image, Higgsfield, Stable Diffusion, the Blender "stablegen" extension, etc.).
- References (third-party images, local only, never commit them): D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\
  01-style-catgirl-shrine.png, 02-style-bunny.png, 03-style-blonde.png, 04-style-grid9.webp (pixel character STYLE refs)
  05-anim-sailormars-sheet.webp (ripped fighting-game sprite sheet: animation phases), 06-anim-domesticfox-slash.png, 07-anim-amberowl-wrench.webp, 08-anim-amberowl-lys-lightning.webp, 09-anim-amberowl-katana-cats.webp, 10-anim-sword-smear-sheet.webp (ATTACK stages / smears / feel)
  11-vfx-wide-arcs.png, 12-vfx-lol-skills.png (WIDE AOE effects Dex prefers)
  13-enemies-red-black-white.webp (ENEMY style), 14-outfit-priest-sister.png (OUTFIT)
- Target: player character roughly 96 px tall at native resolution (head to toe, weapon excluded) in a 640x360 internal view, integer-scaled; this is a working assumption to test, not locked.
- Write in plain language. Separate measured facts, sourced claims, and your own inference. Never invent statistics.
`

const DOC_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    keyFindings: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'keyFindings'],
}

const RESEARCH = [
  {
    key: 'refs',
    prompt: `${CTX}
Task: break down every reference image (open each file with Read and look carefully) into a production reference and an A/B quality rubric.
For each ref: what job it serves; recover its native pixel grid (estimate the scale factor/pitch by measuring runs of identical pixels with Python/PIL — Python is on PATH; state confidence) and the character height in native pixels; head-to-body ratio; outline treatment (black, coloured, selective outline, none); number of shading bands per material; approximate palette size; rim/back light usage; face construction (eye rows, iris tones, highlight, mouth, blush); hair clump strategy; for animation refs: frame counts per move, key poses (anticipation, strike, contact, follow-through, recovery), smear/trail shapes and how many frames they last, how effects are layered (core flash, main arc, secondary slivers, particles, debris, ground decal/crack, glow), effect width relative to character height; for VFX refs: shape language and colour ramps; for enemies: silhouette/palette rules; for the outfit: a component list and how to keep it "decently revealing but in theme" at pixel scale.
Also make native-grid versions of the pixel refs: downscale each pixel ref by its recovered pitch with nearest-neighbour into D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\native\\ (keep originals untouched) so later A/B sheets can show refs and our work at the same pixel size.
Write: D:\\Dex\\Projects\\dex.place\\docs\\character\\REF-BREAKDOWN.md and D:\\Dex\\Projects\\dex.place\\docs\\character\\QUALITY-RUBRIC.md (the A/B dimensions a critic must judge: silhouette, proportion/appeal, face, shading/form, outline, palette, pixel cleanliness, motion arcs/spacing/timing, smear and VFX quality, AOE width/grandeur, rim light, readability at 1x game size — each with what "ref-level" looks like, citing specific refs). Docs are text only (they go in the public repo): refer to refs by filename, never embed them.`,
  },
  {
    key: 'aaa',
    prompt: `${CTX}
Task: research how the LATEST characters from Kuro Games (Wuthering Waves), HoYoverse (Zenless Zone Zero, Honkai: Star Rail, Genshin Impact) and Gryphline (Arknights: Endfield) stage their basic attack strings, dodges/dashes, skills and ultimates, and what makes them feel creative, wide, grand and fluid. Use WebSearch/WebFetch: official character trailers' descriptions, developer interviews, GDC/CEDEC talks (e.g. Genshin/HoYo VFX and animation talks, ZZZ combat design, Kuro action design), community frame-data wikis and animation-cancel guides that publish frame or second timings, VFX breakdown articles. Then translate to 2D pixel action: study how Dead Cells (Motion Twin's 3D-to-pixel pipeline, their Gamasutra/Game Developer articles), Blasphemous 1/2, Nine Sols, Katana Zero, The Last Faith, Skul, Hollow Knight, and 2D fighting games (Guilty Gear Xrd GDC talk on 2D-look 3D animation, limited animation / frame holds) handle anticipation, hitstop, smears, screen shake, camera zoom, slow-mo, cut-ins, and rim/normal-map lighting.
Deliver D:\\Dex\\Projects\\dex.place\\docs\\character\\RESEARCH.md: (1) per studio, 3-5 concrete recent character examples with what their M1/dodge/skill/ult actually do visually and why they read as creative (cite sources); (2) extracted principles with any published numbers (frame counts, seconds, hitstop durations, shake amplitudes), each marked sourced/measured/inferred; (3) a "2D translation" section: how each principle survives at ~96 px character height in 640x360 pixel art, and what must change; (4) a technique section on 3D-to-pixel pipelines (Dead Cells and Guilty Gear specifics: frame rate choices, holds, normal maps, outlines, no-AA rendering, cel shading, per-frame corrections). Include source URLs.`,
  },
  {
    key: 'sources',
    prompt: `${CTX}
Task: find the motion and model sources we could use to derive timing and perspective, WITHOUT downloading anything (downloads need Dex's approval first; produce a shortlist he can approve in one go).
1. MMD motion data (.vmd) made by fans for sword / katana / naginata / glaive / spear / polearm combat, anime action, spins and dramatic poses — search BowlRoll, Nico Nico 3D/Seiga, DeviantArt, Booth.pm, GitHub, MMD motion DL lists (Japanese queries help: "MMD モーション配布 刀", "薙刀 モーション 配布", "槍 モーション MMD", "戦闘モーション 配布"). For each candidate: URL, author, what moves it contains, format, approximate size, and the EXACT usage terms quoted (credit required? modification allowed? non-commercial only? redistribution forbidden?). dex.place is a personal non-commercial site that accepts donations — flag anything where that is ambiguous.
2. Mocap/animation libraries: Mixamo (terms + that it needs an Adobe login), CMU Graphics Lab mocap, Bandai Namco Research Motion Dataset (check its actual license on GitHub), any other reputable free datasets with polearm/sword or dance motion. Quote licenses.
3. 3D anime base models usable as the base/mannequin for our own original character (we will redesign outfit, hair and weapon): VRoid Studio sample avatars and their official terms, VRoid Hub models whose conditions allow modification, CC0/CC-BY anime-style models on Sketchfab, and whether VRoid Studio is installed on this PC (check Program Files, Steam library folders on C: and D:). Quote terms.
4. Blender tooling: MMD Tools as a Blender 5.1 extension (source, license), retargeting options from MMD/Mixamo/BVH to a VRM or custom armature in Blender 5.1. Don't install anything.
Deliver D:\\Dex\\Projects\\dex.place\\docs\\character\\MOTION-SOURCES.md with a ranked shortlist (top ~8 motions/datasets + top ~3 base models), each with URL, size, license summary, risk level, and what we'd use it for (timing only vs retarget-and-alter). Also give a single "download batch" list (filename/URL/source/size) for Dex to approve.`,
  },
]

const SPIKE = `${CTX}
Task: PROVE OR DISPROVE the 3D-to-pixel route with a technical spike. Work in D:\\Dex\\Projects\\dex.place\\tools\\pixel-pipeline\\ (scripts, will be committed later) and put all rendered output in D:\\Dex\\Projects\\dex.place\\review\\spike-3d-pixel\\ (git-ignored). Run Blender headless: "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup --python <script> (don't use the Blender MCP; don't touch any open Blender GUI). No downloads, no image generation.
1. Build a stand-in figure in Blender with Python: anime proportions (~6.5 heads, long legs, slightly large head), simple but clean volumes (metaballs/skin modifier/subdivided primitives are fine), long hair as a few clumped cards/volumes, a long front tabard cloth panel and detached flared sleeves (so cloth/secondary motion is represented), and a big glaive (long shaft, crescent blade). White/gold outfit materials, dark hair, skin. Armature with basic bones.
2. Keyframe one glaive attack: a wide horizontal sweep of about 16-24 frames at 60 fps with clear anticipation (wind-up and hold), a 2-3 frame strike, overshoot follow-through, and settle; hair/sleeves/tabard lag behind (simple bone lag or a quick cloth/soft approach).
3. Render every frame at native pixel size (character ~96 px tall) with: toon shading (Shader to RGB -> constant colour ramp, 3-4 bands per material, hue-shifted shadows), NO anti-aliasing (Eevee/Workbench with filter size 0 / pixel filter off, or render at native size), orthographic or long-lens camera from the side at a slight 3/4 so it reads like the style refs, an outline (inverted hull or Freestyle or post-process), and separate passes: albedo/colour, world or view-space NORMAL pass (for runtime rim light), and an alpha/material-ID mask.
4. Post-process with Python (PIL/numpy; install nothing global — use a venv under D:\\Dex\\Tools\\venvs\\ if you need packages): per-material palette snapping, coloured outline with selective (lit-side lighter) outline, orphan-pixel cleanup, consistent 1px lines. Output: a sprite strip PNG, a normal-map strip PNG, an animated GIF/APNG at 1x and 4x, and one A/B sheet placing (a) our best frame, (b) a crop of 07-anim-amberowl-wrench.webp and 09-anim-amberowl-katana-cats.webp downscaled to their native pixel grid (measure it), all shown at the same zoom factor.
5. Also produce a quick rim-light demo: composite one frame lit by a coloured rim light computed from the normal pass (simple Lambert/rim in numpy) to show the runtime-lighting idea works.
Iterate on your own a few rounds (look at your outputs with Read) until it is the best you can get in this spike. Then be brutally honest in the report: what looks good, what looks bad (mushy faces, noisy clusters, stiff cloth, etc.), and what the full pipeline needs (face overlays, hand cleanup passes, better model). List every output file path.`

const SPIKE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    outputs: { type: 'array', items: { type: 'string' } },
    whatWorks: { type: 'array', items: { type: 'string' } },
    whatFails: { type: 'array', items: { type: 'string' } },
    pipelineNeeds: { type: 'array', items: { type: 'string' } },
    abSheet: { type: 'string' },
  },
  required: ['summary', 'outputs', 'whatWorks', 'whatFails', 'abSheet'],
}

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    perDimension: { type: 'array', items: { type: 'object', properties: { dimension: { type: 'string' }, winner: { type: 'string' }, gap: { type: 'string' } }, required: ['dimension', 'winner', 'gap'] } },
    overallScoreOutOf10: { type: 'number' },
    prefersOursShare: { type: 'string' },
    topFixes: { type: 'array', items: { type: 'string' } },
    viable: { type: 'boolean' },
  },
  required: ['perDimension', 'overallScoreOutOf10', 'topFixes', 'viable'],
}

// Spike runs alongside research
const spikeP = agent(SPIKE, { label: 'spike:3d-to-pixel', phase: 'Spike', schema: SPIKE_SCHEMA })
  .then(spike => {
    if (!spike) return { spike: null, critics: [] }
    const lenses = ['still-frame pixel quality (silhouette, face, shading, outline, palette, cleanliness)', 'motion quality (arcs, spacing, timing, secondary motion, smear readiness)', 'production viability (can this route reach ref quality with more work, and what is the biggest risk)']
    return parallel(lenses.map((lens, i) => () => agent(`${CTX}
You are an independent, skeptical A/B critic. Judge "which looks better" between OUR spike output and the reference pixel art, through this lens: ${lens}.
Look at the A/B sheet ${spike.abSheet} and the other spike outputs: ${JSON.stringify(spike.outputs).slice(0, 2000)} (open the PNG/GIF files with Read), and at the refs 07, 08, 09 and 04 in D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\ (and native/ crops if they exist). Do not trust the builder's self-assessment: ${JSON.stringify(spike.whatWorks).slice(0, 800)}.
For each relevant dimension say who wins (ours / ref / tie) and the concrete gap. Give an overall score out of 10 where the refs are 9, estimate what share of viewers would prefer ours, list the top fixes in priority order, and say whether this route is viable for reaching ref quality.`, { label: `spike-critic:${i + 1}`, phase: 'Spike', schema: CRITIC_SCHEMA, effort: 'high' })))
      .then(critics => ({ spike, critics: critics.filter(Boolean) }))
  })

phase('Research')
const research = await parallel(RESEARCH.map(r => () => agent(r.prompt, { label: `research:${r.key}`, phase: 'Research', schema: DOC_SCHEMA })))
const researchSummary = JSON.stringify(RESEARCH.map((r, i) => ({ key: r.key, result: research[i] }))).slice(0, 12000)

const DOCS = `Read these first: D:\\Dex\\Projects\\dex.place\\docs\\character\\REF-BREAKDOWN.md, QUALITY-RUBRIC.md, RESEARCH.md, MOTION-SOURCES.md (same folder), and look at the refs in D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\. Research summaries: ${researchSummary}`

const CONCEPT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    file: { type: 'string' },
    pitch: { type: 'string' },
    moves: { type: 'array', items: { type: 'object', properties: { move: { type: 'string' }, oneLine: { type: 'string' } }, required: ['move', 'oneLine'] } },
  },
  required: ['name', 'file', 'pitch', 'moves'],
}

const ANGLES = [
  { key: 'judgment', angle: 'JUDGMENT — an executioner-saint. Heavy, weighty glaive arcs; crosses of light slam into the ground; bell tolls; sentences carried out. Ult: a colossal cross-shaped blade of light that cleaves the whole screen.' },
  { key: 'liturgy', angle: 'LITURGY — a ritual dance. Fluid, continuous spinning sweeps where the detached sleeves and tabards trail like ribbons; stained-glass shards and rose-window geometry; each hit flows into the next. Ult: a rose-window mandala unfolds across the arena and every pane sweeps outward.' },
  { key: 'halo', angle: 'HALO — celestial mechanics. Halos, orbiting rings, gravity and weightlessness; wide ring and arc AOEs that expand outward; the glaive leaves orbital trails. Ult: the sky opens, a giant halo descends and pillars of light rain across its circumference.' },
]

phase('Concepts')
const concepts = await parallel(ANGLES.map(a => () => agent(`${CTX}
${DOCS}
Design a complete character + moveset concept from this angle: ${a.angle}
Write D:\\Dex\\Projects\\dex.place\\docs\\character\\concepts\\${a.key}.md containing:
1. Character design at pixel scale: silhouette, proportions, the outfit adapted from 14-outfit-priest-sister.png (components, what is shown vs covered so it is "decently revealing but in theme"), hair, face, palette (white/gold outfit; choose hair and eye colours and a signature VFX colour that reads against red/black/white enemies), weapon (big glaive or sword — choose and justify; design its silhouette).
2. Moveset — M1 string (3-5 hits, last one wide), M2 dash (plus what happens if you attack out of the dash), Q skill, R ultimate. For EACH move: the idea in one sentence; a phase table in frames at 60 fps (anticipation, strike, contact/hitstop, follow-through, recovery, cancel windows, i-frames) with drawn-frame counts and holds; root motion; hitbox/AOE shape and size measured in character heights (make them WIDE); VFX layers per phase (core flash, main arc/smear, secondary slivers, particles, ground decal/cracks, lingering glyphs, light emission for rim light) with colours; camera (shake, zoom, slow-mo, cut-in); SFX cues; which reference or researched AAA example informs it and which motion source could supply its timing.
3. What makes it feel like a latest-gen Kuro/HoYo/Gryphline character rather than a generic pixel swordfighter.
Be specific and bold; no filler.`, { label: `concept:${a.key}`, phase: 'Concepts', schema: CONCEPT_SCHEMA })))

const conceptList = concepts.filter(Boolean)
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    ranking: { type: 'array', items: { type: 'object', properties: { concept: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['concept', 'score', 'why'] } },
    bestIdeasToGraft: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
  },
  required: ['ranking', 'bestIdeasToGraft', 'weaknesses'],
}
const LENSES = [
  'FEEL: grandeur, width, fluidity and creativity compared with the latest Kuro/HoYo/Gryphline characters. Would a player feel this is a premium character?',
  'FEASIBILITY: can this actually look ref-quality at ~96 px in 640x360 pixel art through a Blender 3D-to-pixel pipeline plus hand-authored 2D VFX, within reasonable effort? Are timings plausible and readable?',
  'BRIEF FIDELITY: very wide AOE, grand, fluid, rim lighting, particles, the priest/sister outfit "decently revealing but in theme", big glaive or sword, contrast with red/black/white enemies, and Dex\'s refs.',
]

phase('Judge')
const judged = await parallel(LENSES.map((lens, i) => () => agent(`${CTX}
${DOCS}
You are judge ${i + 1}. Read the three concept files: ${conceptList.map(c => c.file).join(', ')}. Score each out of 10 through this lens only: ${lens}
Return a ranking, the best specific ideas worth grafting from any concept, and the weaknesses.`, { label: `judge:${i + 1}`, phase: 'Judge', schema: JUDGE_SCHEMA, effort: 'high' })))

phase('Synthesize')
const judgedOk = judged.filter(Boolean)
const synth = await agent(`${CTX}
${DOCS}
Concepts: ${JSON.stringify(conceptList)}. Judges: ${JSON.stringify(judgedOk).slice(0, 8000)}.
Pick the strongest concept by the judges' combined view, graft the best ideas from the others where they genuinely improve it, and write the two canonical docs:
- D:\\Dex\\Projects\\dex.place\\docs\\character\\DESIGN.md — the character at pixel scale (silhouette, proportions, native height, outfit components, palette with hex ramps per material, face spec, weapon design, what stays consistent across frames).
- D:\\Dex\\Projects\\dex.place\\docs\\character\\MOVESET.md — M1 string, M2 dash (+ dash attack), Q, R with full phase/timing tables at 60 fps, drawn frames and holds, cancel windows, i-frames, root motion, AOE shapes/sizes in character heights, VFX layer stack per phase with colours, rim-light events, camera, SFX cues, and the timing source for each (ref / research / motion source).
Also add a short "Why this concept" section at the top of MOVESET.md naming what was grafted from which concept. Keep the rejected concept files as they are.`, { label: 'synthesize', phase: 'Synthesize', schema: DOC_SCHEMA, effort: 'high' })

const critic = await agent(`${CTX}
${DOCS}
Adversarially critique D:\\Dex\\Projects\\dex.place\\docs\\character\\DESIGN.md and MOVESET.md against Dex's brief. Hunt for: anything generic or "pixel swordfighter" rather than latest-gen gacha; AOEs that aren't actually wide; timings that would feel sluggish or unreadable; VFX that would turn to noise at pixel scale; missing rim-light/particle specifics; outfit choices that break "decently revealing but in theme"; anything infeasible for the 3D-to-pixel pipeline. Mark "blocking" only for things that would clearly fail the brief.`, { label: 'critic', phase: 'Synthesize', schema: { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'blocking', 'notes'] }, effort: 'high' })

let revise = null
if (critic && critic.verdict === 'blocking' && critic.blocking.length) {
  revise = await agent(`${CTX}
${DOCS}
Revise D:\\Dex\\Projects\\dex.place\\docs\\character\\DESIGN.md and MOVESET.md to resolve these blocking critique points properly: ${JSON.stringify(critic.blocking)}. Also consider these notes: ${JSON.stringify(critic.notes).slice(0, 3000)}. Report what changed.`, { label: 'revise', phase: 'Synthesize', schema: DOC_SCHEMA })
}

const spikeResult = await spikeP
return { research, concepts: conceptList, judged: judgedOk, synth, critic, revise, spike: spikeResult }

export const meta = {
  name: 'artist-construction-pipeline',
  description: 'Artist-like construction pipeline: research legit art tutorials into measurable rules (+ negative rules), build construction tools, apply design fixes, then trial-and-error rounds on Rosace face library and idle figure with a learning log',
  phases: [
    { title: 'Research', detail: 'face construction, figure/gesture/hands, pixel rendering — from real tutorials' },
    { title: 'Rules', detail: 'ART-RULES.md + machine-checkable checklist; design spec fixes' },
    { title: 'Tools', detail: 'face constructor, figure constructor, rule checker, construction sheets' },
    { title: 'Artist loop', detail: 'attempt -> self-check -> critics -> record discoveries -> adjust' },
  ],
}

const CTX = `
Project: dex.place player character "Rosace" (docs/character/DESIGN.md, PIPELINE.md, CRITIQUE-PARAMS.md, QUALITY-RUBRIC.md, REF-BREAKDOWN.md; refs in D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\ and native-grid copies in native/ — the finish bar is refs 07, 08, 09 and 04). Repo D:\\Dex\\Projects\\dex.place (public; no commits/pushes; third-party images never leave the git-ignored review/).
Where we are: a 3D-to-pixel route (Blender render + hand face stamps + override layers) plateaued at ~5.7/10 over 4 critic rounds (refs = 9). Critics repeat: the face has no charisma (a blank half-lidded stare), she stands like a mannequin, flat 3D banding instead of rich hand-placed clusters, white-on-white legs, block hands, flagpole grip, missing collar cross. Latest sheets: review/rosace/round-4/ and round-4-fix/.
Dex's direction (verbatim essentials): "we MUST be able to construct a decent looking face and figure REGARDLESS of whether we have a good 3D base. The 3D helps with reference once we have anims — timing and perspective. Push harder on a workflow which mimics an artist — trial and error before discovering good construction / perspective / guidelines — negative parts where shit shouldn't be and where it should be — establish these params by looking up art tutorials, legit art tutorials. The 3D is still crucial, but this helps establish a pipeline." Also: apply design fixes.
HARD RULES: no image generation of any kind. Pixel art is authored in code/data (pixel grids, parametric construction), using the 3D render only as a perspective/proportion reference layer. Cite every tutorial source (URL, author). Prefer reputable, widely used teaching sources (e.g. Loomis/Proko head and figure methods, Michael Hampton/gesture, Disney/animation appeal principles, Pixel Logic (Michael Azzi), Pedro Medeiros/Saint11, Slynyrd, Brandon James Greer, AdamCYounis, MortMort, Lospec tutorials, well-known anime face/figure construction guides). Measured facts vs sourced claims vs inference must be tagged.
Paths you may write: docs/character/ART-RULES.md, docs/character/art-rules/**, docs/character/DESIGN.md (design-fix edits only), tools/art-construct/**, art/rosace/construct/** (new faces/figure; do NOT delete the old art/rosace/faces or overrides — mark them superseded), review/rosace/construct/** (sheets with refs). Another lane edits tools/motion-ai/ and art/rosace/poses/motion/ — don't touch. Read-only: D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\ (use a snapshot copy if you need the .blend; absolute paths for any Blender render; isolated Blender env via tools/pixel-pipeline/blender.ps1).
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, findings: { type: 'array', items: { type: 'string' } }, media: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'findings'] }

phase('Research')
const AREAS = [
  { key: 'face', q: `ANIME FACE CONSTRUCTION, then at PIXEL SCALE. From real tutorials: head construction (Loomis ball + plane, center line, brow/eye/nose/mouth/chin lines as ratios of head height), front / three-quarter / profile construction including far-eye foreshortening and cheek contour in 3/4, anime-specific proportions (eye height and width vs head, spacing, iris size, lash shapes, brows, small mouth, jaw and chin shape), expressions (what changes for confident, focused/attacking, smiling), hair as clumps around the skull (hairline, parting, volume beyond the skull, strand flow), and appeal (what makes a face cute or beautiful vs blank). Then pixel-scale face rules for ~22-26 px tall heads (as in refs 07/08/09 — measure their faces from review/refs/character/native/): eye pixel budgets, iris tone count, highlight placement, lash bar and flick, whether to outline the face interior, mouth size, nose indication, blush, cheek shading, where clusters go. NEGATIVE rules: common mistakes and what makes faces look blank, dead, uncanny or wonky (eyes too high or low, symmetric eyes in 3/4, same-size eyes in 3/4, pupils looking nowhere, mouths too wide, noses too drawn, pillow shading, stray pixels).` },
  { key: 'figure', q: `FIGURE, GESTURE, POSING, HANDS, WEAPON GRIP. From real tutorials: gesture and line of action, rhythm (C and S curves), contrapposto (hip and shoulder tilt, weight leg under the neck and head), balance and centre of gravity, silhouette readability and negative space (gaps between limbs and body), twist and foreshortening, stylised anime and gacha proportions (heads tall, leg length, hourglass) and how to push appeal and attitude, cloth that shows the body and the motion, hand construction (mitten plus thumb, simplified for pixel scale) and how two hands grip a long polearm (spacing, wrists, the line of the weapon relative to the body). Idle and hero pose design for fighting and gacha characters (what makes an idle feel alive and characterful). NEGATIVE rules: stiff mannequin tells (symmetry, even weight, arms hanging straight, twins), tangents, flat silhouettes, floating weapons, broken wrists. Include measurable parameters (angles, ratios, px at 144 px character height).` },
  { key: 'pixel', q: `PIXEL RENDERING AND CRAFT for character sprites at ~140-160 px tall, from real pixel-art tutorials: palette ramps and hue shifting, how many tones per material and where, cluster rules (shape, size, avoiding noise), light direction and form shading on skin, white cloth, gold and metal, hair (clumps plus specular band), selective outline (sel-out) and interior lines, manual anti-aliasing, dithering use and abuse, readability at 1x, and how pro sprites avoid the 3D-render look. NEGATIVE rules: pillow shading, banding, jaggies, doubles, orphan pixels, over-dithering, low contrast between materials (white-on-white), muddy darks. Measure what refs 07/08/09 actually do (tones per material, cluster sizes, outline colours) from review/refs/character/native/ to ground the rules.` },
]
const research = await parallel(AREAS.map(a => () => agent(`${CTX}
Research area: ${a.q}
Write docs/character/art-rules/${a.key}.md: (1) sourced principles with URLs, (2) MEASURABLE parameters (ratios, px counts at our 144 px character / ~24 px head, angles, tone counts), (3) NEGATIVE rules (never / avoid, with why), (4) a self-check list an artist would run before calling a drawing done, (5) what our current round-4 Rosace violates (look at review/rosace/round-4/ and round-4-fix/ sheets). Text only in the doc; any study crops of refs go to review/rosace/construct/research/.`, { label: `research:${a.key}`, phase: 'Research', schema: DOC, effort: 'high' })))

phase('Rules')
const rules = await agent(`${CTX}
Research outputs: ${JSON.stringify(research.filter(Boolean)).slice(0, 12000)}
1. Merge docs/character/art-rules/*.md into docs/character/ART-RULES.md: construction method (face, figure, hands, grip, hair), the parameter tables, the NEGATIVE rules, and the artist self-check. Add a "Learning log" section (empty table: round, what was tried, what failed, why, the rule it produced) that later rounds fill in.
2. Write docs/character/art-rules/checklist.json: every rule with id, severity, and HOW TO CHECK — automated metric where possible (e.g. eye-line position ratio, eye size in px, 3/4 far-eye width ratio, symmetry test, contrast between adjacent materials, orphan-pixel count, banding and staircase detection, silhouette negative-space area, line-of-action angle, hip and shoulder tilt, hand-on-shaft distance) or "critic" if only a human or critic eye can judge.
3. Apply Dex-approved design fixes to docs/character/DESIGN.md: replace the "calm half-lidded" face spec with bright, confident, charismatic eyes per ART-RULES (keep a half-lid only as one expression); dark thigh-highs (use the outfit dark tone) so the legs separate from the white tabard; restore the collar cross; real constructed hands and a proper two-hand grip; an idle with attitude (contrapposto, weight leg, glaive angled away with negative space). Note each change in the DESIGN.md revision log.`, { label: 'rules+design', phase: 'Rules', schema: DOC, effort: 'high' })

phase('Tools')
const tools = await agent(`${CTX}
Rules: ${JSON.stringify(rules).slice(0, 5000)}
Build tools/art-construct/ (Python + numpy/PIL is fine; document in tools/art-construct/README.md):
- face_construct: from parameters (head size px, yaw bucket front/3q/profile, pitch, expression) build the construction layers an artist would draw (head ball, center line, brow/eye/nose/mouth/chin lines, jaw, hairline and hair mass) using ART-RULES ratios, then place pixel features from a small authored feature library (eyes per yaw and expression, brows, mouths, nose marks, blush) — all authored as pixel data, tunable by parameters. Output: final pixels plus a CONSTRUCTION SHEET showing underdrawing layers, block-in and final side by side.
- figure_construct: from a gesture spec (line of action curve, hip and shoulder tilts, weight leg, limb angles, twist) or from a 3D pose render used as reference, build the gesture line, a 2D mannequin (head, ribcage, pelvis boxes, limb cylinders), silhouette with negative-space analysis, then contour, clothing and shading guides; output a construction sheet. The 3D render may be a reference layer; the figure must be constructible without it.
- rule_check: runs every automated check in docs/character/art-rules/checklist.json on a sprite (plus its construction params) and prints pass/fail with measured values.
- sheets: A/B sheets vs refs at native grid (reuse the tools/pixel-pipeline ab_sheet conventions: same zoom, shuffled A/B, key.json).
Prove each tool on one example and look at the outputs.`, { label: 'tools', phase: 'Tools', schema: DOC, effort: 'high' })

const CRIT = { type: 'object', properties: { params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, winner: { type: 'string', enum: ['ours', 'ref', 'tie'] }, gap: { type: 'string' }, fix: { type: 'string' } }, required: ['param', 'winner', 'gap', 'fix'] } }, scoreOutOf10: { type: 'number' }, prefersOurs: { type: 'string', enum: ['yes', 'no', 'cant-choose'] }, ruleViolations: { type: 'array', items: { type: 'string' } }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['params', 'scoreOutOf10', 'prefersOurs', 'topFixes'] }
const LENSES = [
  { k: 'face', l: `FACE AND GENUINE ATTRACTIVENESS (CRITIQUE-PARAMS 2, 3, 4) and the face rules in ART-RULES.md.` },
  { k: 'figure', l: `FIGURE, POSTURE, POSING, HANDS, GRIP, STYLISATION, SEX APPEAL IN THEME (CRITIQUE-PARAMS 5-12) and the figure rules in ART-RULES.md.` },
  { k: 'craft', l: `PIXEL CRAFT, SHADING, PALETTE AND VALUE, OUTFIT READ (CRITIQUE-PARAMS 13-17) and the pixel rules in ART-RULES.md; also the donation test.` },
]

let history = [], critique = null, attempt = null
for (let round = 1; round <= 6; round++) {
  phase('Artist loop')
  attempt = await agent(`${CTX}
Tools: ${JSON.stringify(tools).slice(0, 3000)}
Round ${round}. ${critique ? 'Critique from last round (address first): ' + JSON.stringify(critique).slice(0, 8000) : ''}
Work like an artist: for the FACE LIBRARY at 144 px character height (front, 3/4, profile x confident, focused/attack, smile) and the IDLE HERO FIGURE (full body with glaive, per the updated DESIGN.md), do several quick trial variants first (thumbnails and construction sketches), pick the best by the self-check and rule_check, then refine to final pixels. Composite the face onto the figure. Show your process: construction sheets for each, the variants you rejected and why. Then build A/B sheets vs refs 07/08/09 (face crops at the same native grid, full figure) in review/rosace/construct/round-${round}/ with key.json. Append to the ART-RULES.md Learning log what you tried, what failed, why, and the rule it produced (new rules also go into checklist.json). Look at everything before reporting.`, { label: `attempt:r${round}`, phase: 'Artist loop', schema: DOC, effort: 'high' })
  if (!attempt) break
  const crits = await parallel(LENSES.map(c => () => agent(`${CTX}
Independent, demanding critic (gacha fan and pixel artist). Lens: ${c.l}
Open the sheets in D:\\Dex\\Projects\\dex.place\\review\\rosace\\construct\\round-${round}\\ (Read the PNGs); write A/B verdicts before opening key.json, then map. Per param: winner, gap, fix. Score out of 10 (refs = 9), prefers ours?, which ART-RULES rules are still violated, top fixes.`, { label: `critic:${c.k}:r${round}`, phase: 'Artist loop', schema: CRIT, effort: 'high' })))
  const ok = crits.filter(Boolean)
  const avg = ok.length ? ok.reduce((s, c) => s + c.scoreOutOf10, 0) / ok.length : 0
  const prefer = ok.filter(c => c.prefersOurs !== 'no').length
  history.push({ round, avg, scores: ok.map(c => c.scoreOutOf10), prefer })
  log(`round ${round}: avg ${avg.toFixed(1)} (${ok.map(c => c.scoreOutOf10).join('/')}), ${prefer}/${ok.length} prefer or cannot choose`)
  if (avg >= 7.5 && prefer * 2 >= ok.length) break
  critique = ok.map(c => ({ score: c.scoreOutOf10, lost: c.params.filter(p => p.winner === 'ref'), violations: c.ruleViolations, topFixes: c.topFixes }))
  if (history.length >= 3) {
    const last3 = history.slice(-3).map(h => h.avg)
    if (last3[2] <= last3[0] + 0.2) { log('plateau across 3 rounds, stopping to report instead of looping'); break }
  }
}
return { research, rules, tools, attempt, history }

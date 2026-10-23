export const meta = {
  name: 'rosace-model-and-stills',
  description: 'Build the real player character (Rosace) in Blender from a CC0 base, render stills at 96/128/144 px, hand-author face/overrides, A/B critic loop until ref parity',
  phases: [
    { title: 'Setup', detail: 'isolated Blender env, downloads, provenance' },
    { title: 'Model', detail: 'Rosace base body, hair, outfit, glaive, materials, rig' },
    { title: 'Stills', detail: 'render key stills at 3 heights + face library + overrides + A/B sheets' },
    { title: 'Critique', detail: '5-lens critic panel per round (31-part checklist)' },
    { title: 'Fix', detail: 'integrator applies fixes; loop until pass or 6 rounds' },
  ],
}

const CTX = `
Project: dex.place — Dex's personal site whose top layer is a 2D side-view pixel-art action world. We are producing the PLAYER CHARACTER. Quality bar from Dex: "make her good enough that a 3D gacha gamer (Wuthering Waves / Genshin / Star Rail / ZZZ / Arknights: Endfield) would see it and consider donating." A previous 2D code-drawn attempt scored 3/10. Dex's standing instructions: download what you need and assemble/iterate automatically; critique every part separately (face, genuine attractiveness, arms, weapon, grip, posture, posing, stylisation/exaggeration, sex appeal, movement...), not just overall.
HARD RULES: no image generation of any kind (no GPT image, Higgsfield, Stable Diffusion, Meshy, the Blender stablegen/higgsfield/meshy add-ons). No commits/pushes (coordinator does). Third-party reference images never leave the git-ignored review/ folder. Nothing large or third-party-raw goes in the repo.
Repo: D:\\Dex\\Projects\\dex.place (public). Read first: CANON.md, docs/character/DESIGN.md (the character: "Rosace", Liturgy concept — stained-glass ritual-dance priestess, processional glaive "Lancet" ~1.35 H, veil, indigo sleeve lining, ref 14's thong-cut back KEPT (Dex's explicit call for appeal: gold-edged thong + garter harness, glutes shaded as real form, never a flat skin blob), thigh-highs, indigo boots, 29-colour palette with hex ramps, face spec, rim-light-on-outline spec), docs/character/MOVESET.md, docs/character/REF-BREAKDOWN.md, docs/character/QUALITY-RUBRIC.md, docs/character/CRITIQUE-PARAMS.md (31 parts), docs/character/RESEARCH.md (Dead Cells / Guilty Gear Xrd techniques), docs/character/MOTION-SOURCES.md.
References (look at them): D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\ (01-04 style, 05-10 animation, 11-12 wide VFX, 13 enemies, 14 outfit) and pixel-true copies in review\\refs\\character\\native\\. The finish bar is refs 07, 08, 09 (Amber Owl, 138-163 px tall characters, ~24 px heads, hand-drawn faces) and 04.
Proven spike (reuse, don't restart): tools/pixel-pipeline/blender_spike.py, postprocess.py, ab_sheet.py, rimlight_demo.py, measure_grid.py. Measured facts: EEVEE with Raw view transform, filter size 0, 1 sample, dither 0 writes exact palette bytes; camera-space normals via Vector Transform; post-process gives 1 px sel-out outlines, inner overlap lines, palette snapping; cast shadows made noise (selective only). Spike critics (3.5-4/10) said the gap is: (1) primitive stand-in body — use a real anime base, build ref-14 outfit as real geometry (flared detached sleeves, high collar + cross, tabard, garter harness + cross charms, gold trim bands); (2) hand-authored face per head angle + hand paint-over on key frames (hands, hair highlights, fold lines) kept as override layers so re-renders don't wipe them; (3) more form: fold/crease lines, painted AO, hair specular band, gold/blade glints, stronger deep band, better value contrast; (4) value planning for a white/gold figure (dark accents); (5) push poses: line of action, torso twist, foreshortening, extended arms; (6) 96 px is too small for the brief — refs sit at 138-163 px.
Paths:
- Pipeline scripts (committed later): D:\\Dex\\Projects\\dex.place\\tools\\pixel-pipeline\\ . Make the character build REPRODUCIBLE from scripts (base file + scripts -> .blend), so scripts are the source of truth.
- Authored small art we own (committed later): D:\\Dex\\Projects\\dex.place\\art\\rosace\\ (face library PNGs, override layers, palette JSON, pose data JSON).
- Heavy/regenerable build output (NOT in repo): D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\ .
- Review sheets with refs (git-ignored): D:\\Dex\\Projects\\dex.place\\review\\rosace\\ .
- Downloads land in D:\\Dex\\Inbox\\Downloads\\dexplace-character\\ (a previous, stopped run may have left partial downloads there — reuse what is valid).
Blender: "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" 5.1.2, always headless (-b). Use an ISOLATED Blender user environment (env BLENDER_USER_CONFIG / BLENDER_USER_SCRIPTS / BLENDER_USER_EXTENSIONS / BLENDER_USER_DATAFILES pointing under D:\\Dex\\Tools\\blender-dexplace\\) via a wrapper script tools/pixel-pipeline/blender.ps1 (or .sh) so Dex's own Blender preferences and his enabled generative add-ons are never touched or used. Never use the Blender MCP or any open Blender GUI. GPU: RTX 4090 (24 GB); another workflow may be using the GPU for motion-model tests — keep Blender renders modest.
`

const DOC = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'result'] } },
    sheets: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'checks', 'openIssues'],
}

phase('Setup')
const setup = await agent(`${CTX}
Task: set up the production toolchain and download what the character needs.
1. Isolated Blender env + wrapper (see paths above). Install into the ISOLATED extensions dir only: the VRM add-on (official "VRM format" / saturday06, from extensions.blender.org or its GitHub releases, MIT), and MMD Tools 4.5.x + the "Retarget" extension only if you judge them useful for Quaternius/CMU/MMD/SMPL retargeting later. Prove the wrapper imports a VRM headless.
2. Downloads (you are authorised; data files only, no executables; verify licenses on the source page and record them):
   - A CC0 anime VRM base body: the VRM Consortium sample "Seed-san" (vrm-c/vrm-specification repo samples, check its license file says CC0) — or another verifiably CC0/permissive anime VRM if Seed-san is unavailable. VRoid Studio 2.3.0 is installed at D:\\Dex\\Apps\\Relocated\\UserPrograms\\VRoidStudio\\2.3.0 but it is a GUI app; don't drive it.
   - Quaternius Universal Animation Library 1 and 2 (free standard versions, CC0) — sword combos, sword dash, air attack, ground pound, spell cast, locomotion.
   - CMU mocap BVH for swordplay trials 02_07-09 and subject 88 (spin kicks/flips) if a reasonable-size BVH source exists (skip the big zip if > 100 MB).
   Record everything in D:\\Dex\\Projects\\dex.place\\tools\\pixel-pipeline\\THIRD_PARTY.md (name, URL, license quote, size, sha256, local path, what we use it for). Raw third-party files stay outside the repo.
3. Import-check each download in the isolated Blender (armature, bone names, clip names/lengths) and write a short inventory to D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\inventory.md.`, { label: 'setup', phase: 'Setup', schema: DOC })

phase('Model')
let model = await agent(`${CTX}
Setup report: ${JSON.stringify(setup).slice(0, 3000)}
Task: build Rosace as a production 3D model for the pixel pipeline, reproducibly from scripts (tools/pixel-pipeline/build_rosace.py + helpers) into D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\rosace.blend.
- Start from the CC0 VRM base body and its humanoid armature. Restyle proportions to DESIGN.md: ~6 heads, long legs, slightly large head, clear hourglass (waist/hip/bust), anime stylisation pushed (read "stylised and exaggerated" and "sex appeal in theme" in CRITIQUE-PARAMS). Flatten face normals so toon shading doesn't smear the face (the face will be hand-authored pixel overlays, but the head shape and jaw must be clean).
- Hair per DESIGN.md: authored clump geometry (not a helmet), bangs, side locks, long back hair with clear clumps that will read at pixel scale, plus the veil; bones or spring chains for secondary motion.
- Outfit as real geometry per DESIGN.md + ref 14 (look at it): high collar with gold cross, bodice with the chest window, bare shoulders, detached long flared sleeves with indigo lining, long front tabard with gold cross, open back with halter yoke, the thong-cut back exactly as ref 14 (kept for appeal — gold edge, attractive shaping), gold trim bands, garter harness with cross charms, thigh-highs, indigo heeled boots. Model the folds/pleats so cloth reads as fabric. The front tabard, sleeves and veil get bone chains (or a baked cloth approach) for lag; they must never go edge-on into a 1 px ribbon — give them thickness/curvature.
- Glaive "Lancet" per DESIGN.md (~1.35 H): silhouette readable at 128 px, gold fittings, blade with glass motif cells.
- Materials: exact palette per DESIGN.md hex ramps through the spike's toon method (Raw view, constant ramps, 3-4 bands, hue-shifted shadows), plus the spike critics' asks: hair specular band, gold/blade glint band, a strong deep band, painted/baked AO or crease masks where folds meet, value planning with dark accents so a white/gold figure doesn't wash out.
- Rig: humanoid armature (keep VRM humanoid bone mapping so SMPL/Quaternius/CMU motions can be retargeted later) with IK for hands on the glaive (two grip sockets on the shaft) and feet; a pose library JSON (art/rosace/poses/*.json) with at least: idle hero stance (3/4 facing screen-right, weight on one leg, glaive planted or held diagonally, attitude), N1 contact pose, Q stamp pose, and a back/over-the-shoulder pivot pose (N2) showing the open back.
- Render function reusable by stills and animation: target character heights 96, 128 and 144 px (head to toe, weapon excluded), passes: albedo (palette-exact), camera-space normals, material/ID mask, depth; then the spike post-process.
Look at your renders (Read the PNGs) at 1x/3x/6x and iterate until the model itself is clearly an attractive anime priestess with a readable silhouette before handing over. Report honestly.`, { label: 'model', phase: 'Model', schema: DOC, effort: 'high' })

const STILLS = (round, prev) => `${CTX}
Model report: ${JSON.stringify(model).slice(0, 3000)}
${prev ? 'Previous round critique to address (highest priority first): ' + JSON.stringify(prev).slice(0, 9000) : ''}
Task (stills round ${round}): produce the still frames the critics judge.
1. Render four poses (idle hero stance, N1 contact, Q stamp, and a back/over-the-shoulder view such as the N2 pivot that shows the open back and thong-cut seat) at 96, 128 and 144 px through the pipeline.
2. Hand-author (as pixel art, in code or pixel-by-pixel editing — no image generation) a FACE LIBRARY in art/rosace/faces/: for each height, eye/brow/mouth/blush/highlight stamps for yaw buckets (front, 3/4, profile) and expressions (neutral-confident, focus/attack, smile), designed like refs 07/08/09 at their pixel budget (and simplified like ref 05 at 96 px). Composite them with the anchor tracking from the spike, masked to visible skin, drawn after lighting.
3. Hand OVERRIDE layers in art/rosace/overrides/<pose>_<height>.png for each key still: hands wrapped on the shaft, hair highlight shapes, fold lines, silhouette cleanup, rim-light-on-outline pixels per DESIGN.md section 9. Keep overrides as separate layers composited over renders so re-renders don't wipe them; note which pixels they touch.
4. Build A/B sheets in review/rosace/round-${round}/: for each height, one sheet per comparison (ours idle vs ref 07 idle and ref 09 idle; ours attack pose vs ref 07/08 attack frames; ours back view vs the closest ref view), every panel on its own native pixel grid at the SAME zoom (3x and 6x versions), left/right order randomised per sheet and labelled only "A" and "B" (write the key to review/rosace/round-${round}/key.json). Also one sheet showing our three heights side by side, and one "in-context" frame at 1x game size on a plain 640x360 and 960x540 canvas.
Look at everything you produce and fix obvious problems before reporting. List every sheet path.`

const CRIT_SCHEMA = {
  type: 'object',
  properties: {
    params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, winner: { type: 'string', enum: ['ours', 'ref', 'tie'] }, gap: { type: 'string' }, fix: { type: 'string' } }, required: ['param', 'winner', 'gap', 'fix'] } },
    prefersOurs: { type: 'string', enum: ['yes', 'no', 'cant-choose'] },
    scoreOutOf10: { type: 'number' },
    bestHeight: { type: 'string' },
    topFixes: { type: 'array', items: { type: 'string' } },
    donationTest: { type: 'string' },
  },
  required: ['params', 'prefersOurs', 'scoreOutOf10', 'topFixes'],
}
const LENSES = [
  { key: 'face', lens: 'FACE, GENUINE ATTRACTIVENESS, HEAD AND HAIR (CRITIQUE-PARAMS 2, 3, 4). Is she actually cute/beautiful at game size? Eyes, iris, highlights, lashes, brows, mouth, blush, chin at 3/4, hair framing, clumps, sheen, tips.' },
  { key: 'body', lens: 'BODY: proportions, arms and hands, posture, posing, stylisation and exaggeration, sex appeal in theme (CRITIQUE-PARAMS 5, 6, 9, 10, 11, 12). Line of action, contrapposto, hourglass, leg length, silhouette negative space, attitude; pushed past realistic; the back view and thong-cut seat read as attractive shaped form, not a blob; still clearly a priest.' },
  { key: 'gear', lens: 'WEAPON, GRIP AND OUTFIT (CRITIQUE-PARAMS 7, 8, 13). Glaive silhouette/scale/design tie-in, hand placement and wrists, no floating; collar/cross, bodice, sleeves, front tabard, open back, thong and garter harness, thigh-highs, boots, gold trim readable at pixel scale.' },
  { key: 'craft', lens: 'CRAFT: materials and shading, palette and value, pixel craft, rim light (CRITIQUE-PARAMS 14, 15, 16, 17). Hue-shifted shadows, band count, form lighting, value structure, outline/sel-out, clusters, orphans, banding, rim on outline pixels.' },
  { key: 'overall', lens: 'OVERALL: first impression, originality, donation test (CRITIQUE-PARAMS 1, 18, 31) and which height (96/128/144) best serves the brief in the in-context frames. Would a 3D gacha player screenshot her and consider donating? Why or why not.' },
]

let rounds = []
let critique = null
let stills = null
for (let round = 1; round <= 6; round++) {
  phase('Stills')
  stills = await agent(STILLS(round, critique), { label: `stills:r${round}`, phase: 'Stills', schema: DOC, effort: 'high' })
  if (!stills) break
  phase('Critique')
  const reviews = await parallel(LENSES.map(l => () => agent(`${CTX}
You are an independent, demanding A/B critic (a 3D gacha fan and a pixel artist). Lens: ${l.lens}
Look at every sheet (open the PNGs with Read) in D:\\Dex\\Projects\\dex.place\\review\\rosace\\round-${round}\\ — sheets are labelled A/B only; do NOT open key.json until you have written down your A/B verdicts, then use it to map A/B to ours/ref. Builder's sheet list: ${JSON.stringify(stills.sheets || []).slice(0, 2500)}.
For each CRITIQUE-PARAMS item in your lens: winner (ours/ref/tie), the concrete gap in pixels/shapes/colours, and the specific fix. Then: do you prefer ours overall (yes/no/can't choose), score out of 10 (refs = 9), best height, top fixes in priority order, and the donation test in 1-2 sentences. Don't be polite; be precise.`, { label: `critic:${l.key}:r${round}`, phase: 'Critique', schema: CRIT_SCHEMA, effort: 'high' })))
  const ok = reviews.filter(Boolean)
  const losing = ok.flatMap(r => r.params.filter(p => p.winner === 'ref'))
  const prefer = ok.filter(r => r.prefersOurs !== 'no').length
  const avg = ok.length ? ok.reduce((s, r) => s + (r.scoreOutOf10 || 0), 0) / ok.length : 0
  rounds.push({ round, sheets: stills.sheets, scores: ok.map(r => r.scoreOutOf10), prefer, losing: losing.length, reviews: ok })
  log(`round ${round}: avg ${avg.toFixed(1)}/10, ${prefer}/${ok.length} critics prefer ours or can't choose, ${losing.length} params still lost to refs`)
  if (losing.length === 0 && prefer * 2 >= ok.length) break
  critique = ok.map((r, i) => ({ lens: LENSES[i] ? LENSES[i].key : '', score: r.scoreOutOf10, lost: r.params.filter(p => p.winner === 'ref'), topFixes: r.topFixes }))
  if (round < 6) {
    phase('Fix')
    const fixed = await agent(`${CTX}
Model report: ${JSON.stringify(model).slice(0, 2000)}
Round ${round} critique (every lost parameter with its fix): ${JSON.stringify(critique).slice(0, 12000)}
Task: you are the single integrator. Apply the fixes to the MODEL, MATERIALS, POSES and render/post-process scripts (tools/pixel-pipeline/, D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\). Prioritise what the most critics flagged and what most affects attractiveness and first impression. If the critics agree on a best height, focus the effort there (keep the others rendering). Don't touch the face library/overrides unless the model change requires it — the next stills round rebuilds those. Re-render and look at the results before reporting.`, { label: `fix:r${round}`, phase: 'Fix', schema: DOC, effort: 'high' })
    if (fixed) model = fixed
  }
}
return { setup, model, stills, rounds: rounds.map(r => ({ round: r.round, sheets: r.sheets, scores: r.scores, prefer: r.prefer, losing: r.losing })), finalReviews: rounds.length ? rounds[rounds.length - 1].reviews : [] }

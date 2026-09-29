export const meta = {
  name: 'dex-scene-vibe-prototypes',
  description: 'Four atmospheric parallax scene prototypes from Dex world refs (colossus loop, monolith, ring lake, amber hollow) at /scenes/, with vibe critique and fixes',
  phases: [
    { title: 'Engine', detail: 'shared layered-scene renderer + /scenes/ page + arrival scene as reference' },
    { title: 'Scenes', detail: 'colossus plain, monolith spire, amber hollow in parallel' },
    { title: 'Critique', detail: 'vibe A/B vs each ref + craft + character readability' },
    { title: 'Fix', detail: 'up to 2 fix rounds per scene' },
  ],
}

const CTX = `
Project: dex.place (repo D:\\Dex\\Projects\\dex.place, public; read CANON.md, AGENTS.md, docs/world/REFS.md, docs/world/MAP-AND-STORY.md, docs/props/PIXEL-MATTER.md). Top layer of the site is a 2D side-view pixel-art world. Dex is choosing a NEW world look from refs and wants to "decide what looks best before we commit the lanes", so these are VIBE PROTOTYPES: quick but genuinely atmospheric scenes he can open in a browser and compare. Refs (other artists' images; look at them; never commit them): D:\\Dex\\Projects\\dex.place\\review\\refs\\world\\ w01-colossus-plain.png, w02-monolith-planet.png, w03-ring-over-lake.png, w04-amber-foundry-hollow.png.
Dex's asks for these scenes: "a background with the huge colossal monster passing by, loopable"; "make sure the parallax works, maybe a little animated here and there, some subtle flashes of light as accents, proper fog and cloud movement". Feel: megalophobia, one enormous partly cropped thing, haze between it and the viewer, small character, stillness, slow large motion, rare small light accents (CANON "Arrival" and "Feel").
HARD RULES: no image generation of any kind. Prefer everything generated in code at runtime (procedural silhouettes/shape grammars, noise-driven clouds and fog, light shafts, water, particles) so every pixel stays manipulable (Dex: no images in general for things that should react). If a hero element genuinely needs organic 3D form (the colossus), you may build it in Blender from scratch in code (headless "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b with an isolated user env under D:\\Dex\\Tools\\blender-dexplace\\; never Dex's own prefs, never the Blender MCP) and render pixel frames WITH normal and depth passes so runtime lighting and fog still act on it — but try runtime-procedural first. No commits/pushes. Ports 19500-19999 for local servers. Another workflow is editing src/lab/** and vite.config.ts — don't touch them; your scope is scenes/index.html (served at /scenes/ by the Vite dev server), src/scenes/**, public/scenes/** (only generated data you truly need), tools/scene-pipeline/**, docs/world/SCENES.md, and screenshots/GIFs under review/scenes/.
Pixel rules (match the character pipeline in docs/character/DESIGN.md and src/lab): everything renders into a low-res buffer (640x360 "near" / 960x540 "far", toggle Z) upscaled by the largest integer factor with nearest filtering, letterboxed; no bilinear anywhere; camera and layers snap to whole pixels (parallax offsets rounded per layer); 3-4 band colour ramps with hue-shifted shadows; far layers use finer, lower-contrast detail, near layers chunkier; fog and haze are stepped/dithered, not smooth gradients smeared across pixels. A player character ~128-144 px tall (use a simple dark silhouette stand-in with a glaive) must stay readable in front of every scene.
Every scene must have: 5-8 parallax layers with correct relative speeds, animated clouds/mist with real drift and shape change, fog between depth layers, a few small animated details, rare subtle light-flash accents (never strobing: max 3 flashes per second, and a reduced-motion mode), and a slow automatic camera drift plus manual pan with arrow keys/A-D (and touch drag) so parallax can be judged. Target 60 fps on a normal laptop.
`

const DOC = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'result'] } },
    media: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'checks', 'media'],
}

phase('Engine')
const engine = await agent(`${CTX}
Build the shared scene engine and the first scene.
1. src/scenes/engine/**: WebGL2 layered-scene renderer following the pixel rules; a layer model (depth value -> parallax factor and fog amount), procedural generators (noise-based cloud/mist fields that animate by domain-warped drift, stepped fog bands, light shafts with dust, starfields, planet/moon discs with atmospheric rim, water with reflections and ripples, silhouette shape grammars for megastructures and skylines, particle systems for embers/dust/birds), a light-flash accent system, a camera (auto drift + manual pan, whole-pixel snapping), a stand-in character silhouette toggle, near/far resolution toggle, reduced-motion support, and an FPS readout (toggle with backquote). Scenes register via import.meta.glob('./scenes/*.ts') so each scene is one file and other workers can add scenes without editing shared files.
2. scenes/index.html + src/scenes/main.ts: a minimal page that lists scenes (1-4 keys or a tiny selector) and shows the current one full-window. No marketing text; page title "dex".
3. Scene "ring-lake" (src/scenes/scenes/ring-lake.ts) from w03: the arrival composition — a colossal tilted ring megastructure partly cropped, a volumetric light shaft through it, still lake with reflections and slow ripples, mist over the water, dark rocky shores/cliffs as near layers, a tiny figure on a dock (the stand-in). Nothing else.
4. docs/world/SCENES.md: how the engine and a scene file work (so the other scene workers follow it).
Verify with npm run dev on a 195xx port and Playwright screenshots + a short frame sequence/GIF (ffmpeg at D:\\Dex\\Tools\\ffmpeg-9.0.1-full_build) into review/scenes/ring-lake/. Look at them against w03 and iterate until it genuinely feels like the ref's mood in pixel art.`, { label: 'engine+ring-lake', phase: 'Engine', schema: DOC, effort: 'high' })

const SCENES = [
  { key: 'colossus-plain', ref: 'w01-colossus-plain.png', brief: 'a dark, flat plain/causeway in the foreground, layered haze, and a COLOSSAL pale creature (many-limbed, tentacled head like the ref, but our own design — do not trace) walking slowly across the far distance on a seamless loop (it crosses the view over ~60-90 s at the default camera drift, exits, and a new crossing begins — or a procession of two at different depths); its legs lift and plant with weight, dust/debris kicked up where feet land, the haze swallows its far side. It must read as enormous: tiny details, soft edges from haze, very slow motion. Rare small flashes (distant lightning inside the haze) as accents.' },
  { key: 'monolith-planet', ref: 'w02-monolith-planet.png', brief: 'a huge pale planet/moon disc with a thin atmospheric rim filling much of the sky, stars, a black angular megastructure leaning diagonally up across it with a few lit windows (some flicker), small ships or birds drifting, low cloud banks sliding past its base, blue glow rising from below, occasional soft light pulses along its surface.' },
  { key: 'amber-hollow', ref: 'w04-amber-foundry-hollow.png', brief: 'the inside of a vast hollow with an industrial city: stacked dark silhouettes of towers and cranes at several depths in warm amber haze, a bright opening in the far wall, thousands of tiny window lights, cranes that slowly swing, sparks and embers rising, a ship with headlights crossing, steam plumes, flickering signs. Warm, lived-in, enormous.' },
]

phase('Scenes')
const built = await parallel(SCENES.map(s => () => agent(`${CTX}
Engine report: ${JSON.stringify(engine).slice(0, 4000)}
Read docs/world/SCENES.md and the existing scene src/scenes/scenes/ring-lake.ts, then build ONE scene file src/scenes/scenes/${s.key}.ts (plus any scene-specific helper files under src/scenes/scenes/${s.key}/ and, only if truly required, tools/scene-pipeline/${s.key}/ and public/scenes/${s.key}/). Do not edit the shared engine; if you need an engine feature, implement it inside your scene folder and note it in your report.
Scene "${s.key}" from ${s.ref}: ${s.brief}
Verify with the dev server (a 196xx-199xx port), Playwright screenshots and a short GIF into review/scenes/${s.key}/. Look at them against the ref and iterate until it genuinely feels like the ref's mood in pixel art.`, { label: `scene:${s.key}`, phase: 'Scenes', schema: DOC, effort: 'high' })))

const ALL = [{ key: 'ring-lake', ref: 'w03-ring-over-lake.png', result: engine }, ...SCENES.map((s, i) => ({ key: s.key, ref: s.ref, result: built[i] }))]
const CRIT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] },
    vibeScoreOutOf10: { type: 'number' },
    params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, verdict: { type: 'string' }, fix: { type: 'string' } }, required: ['param', 'verdict', 'fix'] } },
    blocking: { type: 'array', items: { type: 'string' } },
    topFixes: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'vibeScoreOutOf10', 'params', 'blocking', 'topFixes'],
}

const results = await pipeline(
  ALL.filter(x => x.result),
  async (sc) => {
    let current = sc.result
    let reviews = []
    for (let round = 1; round <= 3; round++) {
      const review = await agent(`${CTX}
Independent critic for scene "${sc.key}" (ref ${sc.ref}). Builder report: ${JSON.stringify(current).slice(0, 3000)}
Run the dev server (a 19xxx port), open /scenes/ in Playwright, select this scene, capture your own screenshots at near and far resolutions and a 10-20 s frame sequence (sample frames with Read) into review/scenes/${sc.key}/critic-r${round}/, and compare with the ref. Judge: (1) vibe match — scale/megalophobia, composition, atmosphere, mood (score out of 10 where 10 = feels as good as the ref in its own medium); (2) parallax correctness and depth read; (3) fog, cloud and mist motion; (4) animated details and light-flash accents (tasteful, not strobing); (5) pixel craft (single pixel size, no blur/sub-pixel jitter, stepped fog not smeared); (6) the stand-in character's readability in front of it; (7) loop seamlessness where relevant; (8) fps. "blocking" = looks broken, off-style, or clearly fails the ref's mood.`, { label: `critic:${sc.key}:r${round}`, phase: 'Critique', schema: CRIT, effort: 'high' })
      if (!review) break
      reviews.push(review)
      if (review.verdict !== 'blocking' && review.vibeScoreOutOf10 >= 7) break
      if (round === 3) break
      const fixed = await agent(`${CTX}
Fix scene "${sc.key}" (ref ${sc.ref}) in its own files only (src/scenes/scenes/${sc.key}.ts and its folders; for ring-lake you may also adjust the shared engine carefully without breaking the other scenes — run all four after). Critique: ${JSON.stringify(review).slice(0, 6000)}. Re-verify with fresh screenshots/GIF and look at them before reporting.`, { label: `fix:${sc.key}:r${round}`, phase: 'Fix', schema: DOC, effort: 'high' })
      if (fixed) current = fixed
    }
    return { key: sc.key, final: current, reviews }
  },
)
return { engine, results }

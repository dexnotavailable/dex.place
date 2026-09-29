export const meta = {
  name: 'dex-lab-runtime',
  description: 'Build the /lab blank map: WebGL pixel renderer with normal-map rim light, data-driven moves, turret, platforms; critic panel + fix loop',
  phases: [
    { title: 'Build', detail: 'one coherent builder for the lab runtime + runtime contract' },
    { title: 'Critique', detail: 'game feel, rendering/pixel craft, robustness/contract critics' },
    { title: 'Fix', detail: 'fix rounds until critics pass (max 2)' },
  ],
}

const CTX = `
Context:
- Repo D:\\Dex\\Projects\\dex.place (public GitHub repo dexnotavailable/dex.place; main is the live site https://dex.place). Do NOT commit or push; the coordinator does. Vite + TypeScript (vanilla) project already scaffolded at the root with npm (Node 24; pnpm not available). Read CANON.md and AGENTS.md at the repo root first.
- Your scope: lab/** (lab/index.html -> served at /lab/), src/lab/**, public/lab/**, docs/character/RUNTIME-CONTRACT.md, and a minimal edit to vite.config.ts to add lab/index.html as a second build input (keep the existing root page working). Do not touch ops/**, legacy/**, the root placeholder page files, docs/character/* other than RUNTIME-CONTRACT.md, or review/ except to write your own screenshots under review/lab/. No new npm dependencies unless truly essential (explain if so). Use ports 19000-19999 for any local servers.
- HARD RULE: no image generation. Any art you need (turret, platforms, stand-in) is authored in code as pixel art.
- This lab is the first production for the player character: a BLANK MAP with just the character, a turret and some platforms. The character's real sprites come later from a Blender 3D-to-pixel pipeline (per-frame albedo + per-frame normal map + data); until then, use a clean procedural stand-in so every system is exercised. The main goal later is a character so good that a 3D gacha player (Wuthering Waves / Genshin / ZZZ / Endfield) would consider donating, so the runtime must support premium feel: rim light, particles, wide AOE effects, hitstop, camera work, ultimate cut-in.
`

const BUILD = `${CTX}
Build the lab runtime.

1. docs/character/RUNTIME-CONTRACT.md + src/lab/contracts.ts — the data format the character pipeline will export and the runtime consumes: texture atlases (albedo PNG + matching normal-map PNG, nearest filtering), clip JSON (frames with atlas rect, pivot/foot anchor, duration in 60 Hz ticks, holds), per-frame events (phase: anticipation/active/recovery; hitboxes and hurtboxes in pixels relative to the pivot; i-frames; cancel windows; root motion; VFX spawns with id/offset/rotation/scale/colour; light emissions with colour/radius/intensity/duration; camera events: shake amplitude+duration, zoom punch, slow-mo factor+duration, cut-in trigger; sound cue ids). Make it the single contract; include a JSON Schema or TS types with validation on load.

2. Renderer (WebGL2, src/lab/engine/**): the whole scene renders into a low-res framebuffer (internal resolution 640x360 "near" or 960x540 "far", toggle with Z and a small UI control) then upscales with nearest neighbour at the largest integer scale that fits, letterboxed with black bars. Camera follows the player smoothly but positions snap to whole pixels. Sprite shader with normal maps: ambient + key light + up to ~16 dynamic point lights (from VFX/events) + a RIM term (light from behind/side lights the silhouette edge using the normal map; tunable colour/width/intensity). Additive glow/VFX pass drawn at the same low resolution (so effects are pixel art by construction, same pixel size as sprites). Palette-friendly: no bilinear filtering anywhere, no sub-pixel sprite drawing.

3. VFX system (src/lab/engine/vfx*): procedural pixel primitives that real moves will combine with hand-authored frames: crescent/arc smears (thickness curve, white core -> colour ramp -> fade, splitting into slivers), wide ground shockwave rings, pillars/columns of light, radial bursts, spear streaks, particles (sparks, embers, feathers/shards) with gravity/drag and colour-over-life, ground decals/cracks, afterimages (for dash), screen-space impact frames (1-2 tick inverted/flash frames, disabled under prefers-reduced-motion). Every VFX can emit a light for the rim/normal lighting.

4. Game (src/lab/game/**): fixed 60 Hz simulation. Player controller: A/D or arrows to move; Space/W/Up to jump with buffer + coyote time + variable height; double jump; M1 = left click or J (attack string driven by clip data with cancel windows); M2 = right click or K or Shift (dash with i-frames, afterimages; attacking out of a dash = dash attack); Q skill; R ultimate (with a cooldown shown very quietly); hitstop on hit, knockback, screen shake, slow-mo and a simple ultimate cut-in overlay hook. Provisional clip data for M1 (3-4 hits, last one wide), dash, dash attack, Q (wide ground AOE), R (screen-wide AOE with cut-in) that exercises every event type — these will be replaced by the real MOVESET timings, so keep them in data files (src/lab/data/*.json), not code.
   Procedural stand-in character: an appealing clean silhouette (not a box) ~96 px tall at native res with a long polearm, generated as pixel frames at runtime or baked once, WITH a generated normal map so rim light is visible. Make its poses follow the provisional clip phases so timing can be judged.
   Turret enemy: authored pixel art in the style of the enemy ref D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\13-enemies-red-black-white.webp (look at it: strict red/black/white palette, ornate armored silhouettes) — a mounted sentinel turret on a platform that tracks the player, telegraphs, fires readable projectiles on an interval, has HP, hit flash + recoil, is staggered by heavy hits, breaks apart when destroyed (debris particles), and respawns after a few seconds. Projectiles damage the player (knockback, brief invulnerability, respawn at a checkpoint if HP hits 0 — keep a simple HP value, no big HUD).
   Blank map: a few flat side-view platforms at different heights plus a floor, wide enough to test dashes and wide AOEs; neutral quiet backdrop (soft gradient, maybe one very faint distant layer) so the character reads; the platforms are clean pixel art, flat 2D (no fake 3D edges), not Lego-like repeated blocks.
   Debug overlay toggled with the backquote key: hitboxes, hurtboxes, current clip/frame/phase, fps, light count. Minimal touch controls for phones/iPad (move pad, jump, M1, M2, Q, R) that don't cover the character. No marketing text anywhere; the page title is "dex" and the only permanent UI is what's needed to play.
   Asset loading path: if an atlas + clip JSON exists at public/lab/character/ use it, else use the stand-in. Same for public/lab/turret/.

5. Verify for real: npm run build passes (both pages); run vite preview on a 19xxx port; with Playwright (npx playwright or playwright-cli; browsers may already exist under D:\\Dex\\Tools\\playwright-browsers — set PLAYWRIGHT_BROWSERS_PATH accordingly) load /lab/, check zero console errors, simulate: walk, jump, double jump, dash, M1 string on the turret, Q, R, taking a projectile; capture screenshots at key moments (including a rim-lit frame and a wide AOE frame) into D:\\Dex\\Projects\\dex.place\\review\\lab\\ and a short frame sequence of the M1 string. Look at your screenshots (Read the PNGs) and fix anything ugly, blurry, mixed-pixel-size, cramped or broken before reporting. Report fps measured in headless if possible (note headless limits).`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'result'] } },
    screenshots: { type: 'array', items: { type: 'string' } },
    knownGaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'checks', 'screenshots', 'knownGaps'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] },
    blocking: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['issue', 'fix'] } },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'blocking', 'notes'],
}

const CRITICS = [
  { key: 'feel', lens: `GAME FEEL. Actually play it through Playwright (scripted inputs, capture frame sequences) and judge: input responsiveness, run acceleration, jump arc and variable height, coyote/buffer, double jump, dash distance/i-frames/afterimage, M1 cancel windows, hitstop length, shake strength, knockback, turret telegraph readability and fairness, projectile readability, respawn. Compare against Hollow Knight / Dead Cells conventions. Blocking = something that makes it feel bad or unplayable.` },
  { key: 'render', lens: `RENDERING AND PIXEL CRAFT. Inspect screenshots you capture yourself at both "near" and "far" zooms: every element at the same pixel size (no mixed resolutions, no blur, no sub-pixel jitter), camera snapping, letterbox, rim light actually visible and attractive on the stand-in, normal-map lighting from VFX lights, VFX pixel-consistent and wide, turret matches the red/black/white enemy ref (13-enemies-red-black-white.webp) in palette and ornament, platforms read as flat 2D and not Lego-like, backdrop quiet enough that the character reads. Blocking = visibly broken or off-style rendering.` },
  { key: 'robust', lens: `ROBUSTNESS AND CONTRACT. Build from clean (delete dist, npm run build), zero console errors, the RUNTIME-CONTRACT is complete and actually enforced on load (feed it a malformed clip JSON and a valid sample atlas to prove the real-character path works, then remove your test files), the character/turret asset swap path works, fixed timestep is correct under frame drops, no memory leaks from VFX/particles over a long run (run 2+ minutes of scripted combat and compare heap), touch controls work in a mobile viewport (390x844 and 1024x1366 iPad), prefers-reduced-motion honoured, the root placeholder page still builds and is untouched. Blocking = crashes, broken builds, contract not enforced, leaks.` },
]

phase('Build')
let build = await agent(BUILD, { label: 'build:lab', phase: 'Build', schema: BUILD_SCHEMA })
if (!build) return { build: null }

let rounds = []
for (let round = 1; round <= 3; round++) {
  phase('Critique')
  const reviews = await parallel(CRITICS.map(c => () => agent(`${CTX}
You are an independent critic. Do not edit source files (throwaway test scripts under D:\\Dex\\Temp\\dex-lab-critic-${c.key}\\ are fine). Builder report: ${JSON.stringify(build).slice(0, 3500)}
Lens: ${c.lens}
Open the lab yourself (npm run build; vite preview on a 19xxx port; Playwright), look at real screenshots (Read the PNGs), and report. Save your screenshots under D:\\Dex\\Projects\\dex.place\\review\\lab\\critic-${c.key}-r${round}\\.`, { label: `critic:${c.key}:r${round}`, phase: 'Critique', schema: REVIEW_SCHEMA, effort: 'high' })))
  const ok = reviews.filter(Boolean)
  const blocking = ok.flatMap(r => r.blocking || [])
  rounds.push({ round, reviews: ok })
  if (!blocking.length) { log(`round ${round}: no blocking findings`); break }
  if (round === 3) { log(`round ${round}: ${blocking.length} blocking findings remain after max rounds`); break }
  phase('Fix')
  log(`round ${round}: fixing ${blocking.length} blocking findings`)
  const notes = ok.flatMap(r => r.notes || []).slice(0, 30)
  const fixed = await agent(`${CTX}
Fix these blocking findings in the lab runtime properly (no weakening of checks): ${JSON.stringify(blocking).slice(0, 8000)}
Also address these notes where cheap and clearly beneficial: ${JSON.stringify(notes).slice(0, 4000)}
Previous build report: ${JSON.stringify(build).slice(0, 2500)}
Re-run the build and Playwright verification, look at fresh screenshots, and report.`, { label: `fix:r${round}`, phase: 'Fix', schema: BUILD_SCHEMA })
  if (fixed) build = fixed
}
return { build, rounds }

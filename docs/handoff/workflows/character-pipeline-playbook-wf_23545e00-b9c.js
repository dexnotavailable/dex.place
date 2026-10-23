export const meta = {
  name: 'character-pipeline-playbook',
  description: 'Distil the Rosace work into a reusable character pipeline playbook (formulas, settings, commands, gates, pitfalls), then test it by planning a second character from the doc alone',
  phases: [
    { title: 'Extract', detail: 'parallel readers over design docs, pixel pipeline, motion + runtime, critique protocol' },
    { title: 'Write', detail: 'synthesize docs/character/PIPELINE.md' },
    { title: 'Test', detail: 'a fresh reader plans character #2 from the doc alone; gaps fixed' },
  ],
}

const CTX = `
Repo D:\\Dex\\Projects\\dex.place (public; no commits/pushes — the coordinator commits). We are producing dex.place's player character "Rosace" with a 3D-to-pixel pipeline (Blender -> palette-exact toon renders -> pixel post-process -> hand-authored face library and override layers -> runtime with normal-map rim light), AI motion (NVIDIA Kimodo text/keypose-to-motion, GEM-X video-to-motion, retarget + our own retiming), and A/B critic loops against Dex's refs. Dex asked: "record any relevant formulas or whatnot so that in the future if we create another character we can use this pipeline."
Other workflows are ACTIVELY editing tools/pixel-pipeline/, art/rosace/, tools/motion-ai/ and D:\\Dex\\Projects\\dex-place-art\\rosace\\ right now: READ ONLY there. Your only write target is docs/character/PIPELINE.md (and scratch notes under D:\\Dex\\Temp\\pipeline-playbook\\).
Rules for extraction: record concrete, reusable things — numbers, formulas, settings, file formats, commands, thresholds, decision rules, pass criteria, and the pitfalls that cost us time. Tag each as proven (measured/verified, cite the file), in progress, or proposed. Never invent numbers. Plain language.
`
const EXTRACT = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    recipes: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, detail: { type: 'string' }, status: { type: 'string' }, source: { type: 'string' } }, required: ['name', 'detail', 'status', 'source'] } },
    pitfalls: { type: 'array', items: { type: 'string' } },
    genericityGaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['area', 'recipes', 'pitfalls'],
}
const AREAS = [
  { key: 'design', prompt: 'DESIGN AND REFERENCES: docs/character/DESIGN.md, REF-BREAKDOWN.md (native pixel-grid/pitch recovery method and tools in review/refs/character/native/_*.py — read the scripts), QUALITY-RUBRIC.md, RESEARCH.md, MOVESET.md, concepts/*.md and how the concept judge panel chose. Extract: how to turn refs into measurable targets (pitch, heights, head ratio, eye pixel budgets, band counts, palette sizes, outline rules), height decision rule (the critics converged on 144 px; why 96 failed), proportion targets, palette/ramp construction with hue-shifted shadows, the rim-on-outline formula and contrast numbers, VFX width rule (hit span >= 2.2 H etc.), timing tables and sourced frame numbers, the flash cap, the concept -> judges -> synthesis -> critic process.' },
  { key: 'pixel', prompt: 'PIXEL RENDER PIPELINE: tools/pixel-pipeline/ (all scripts incl. blender_env.py / blender.ps1 / blender.sh wrappers, build_rosace.py and helpers, postprocess.py, face library and override compositing code, ab_sheet.py, rimlight_demo.py, measure_grid.py, THIRD_PARTY.md), art/rosace/ (poses JSON, faces, overrides, palette JSON), D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\inventory.md, review/spike-3d-pixel/meta_*.json and the spike facts (EEVEE Raw view, filter size 0, 1 sample, dither 0 -> exact palette bytes; camera-space normals via Vector Transform; supersampling results; cast-shadow noise). Extract: the isolated Blender env recipe; base-model sourcing (Seed-san CC0 VRM) and how proportions/outfit/hair/weapon are built reproducibly from scripts; material/toon ramp setup; render passes and camera; post-process steps and parameters (outline/sel-out, palette snap, orphan cleanup); face library structure (yaw buckets x expressions x heights) and anchor tracking; override layers; A/B sheet construction rules (same native grid, same zoom, shuffled A/B + key.json); which parts are Rosace-specific vs generic and what must be parameterised for a new character.' },
  { key: 'motion-runtime', prompt: 'MOTION AND RUNTIME: tools/motion-ai/ (SETUP.md, MODELS.md, VIDEO-TO-MOTION.md, THIRD_PARTY.md, kimodo_gen.py, gemx_capture.py, soma_to_bvh.py, bvh_tools.py, motion_qc.py, text_encoder_check.py and anything newer), docs/character/MOTION-SOURCES.md (incl. Dex decisions), docs/character/RUNTIME-CONTRACT.md and src/lab/contracts.ts + src/lab/data/*.json. Extract: model setup and env (per-run HF env, CPU text encoder, VRAM notes and the GPU-sharing caveat), how to generate from text/keyposes/video, the SOMA skeleton and BVH conventions, retarget approach, the retime/timing-sheet idea (holds, snap, ease, overshoot, exaggeration multipliers, stepped playback), QC metrics, licensing rules, and the runtime export contract (atlas + normal atlas + clip JSON, events, validation, pool limits). Note what is still in progress (retime tool may not exist yet).' },
  { key: 'process', prompt: 'PROCESS AND QUALITY GATES: docs/character/CRITIQUE-PARAMS.md, QUALITY-RUBRIC.md, and how the critic loops work in practice — read the workflow journals in C:\\Users\\sanic\\.claude\\projects\\C--Users-sanic-AppData-Roaming-Claude-scratch-workspaces-1adae8be-e7e3-4f28-8136-ee8b11923346-d1aafaed-4da9-4c8e-9264-38227006b68f-scratch-2026-09-28-eba4f5\\5562f87c-2ca6-46da-b895-2c48f7f0d7d2\\subagents\\workflows\\ (wf_df417f73-0b3 foundation, wf_12179d17-dce rosace stills, wf_8a4bde92-826 lab) — each line of journal.jsonl is JSON; "result" lines hold agents\' returns. Extract: the critic lenses and how the 31 params were split across them, pass criteria (every param tie-or-better, >= half prefer ours or can\'t choose), score trajectory so far (spike 3.5-4; round 1 4.5-5.5), what fixes moved scores, the donation-test framing, the spike-first rule (prove the route before committing), pivot rule (switch method when a route plateaus), crash-resilience (workflows resume from cached steps; PC crashes happened), and the file layout conventions (what goes in the public repo vs review/ vs D:\\Dex\\Projects\\dex-place-art).' },
]

phase('Extract')
const ex = await parallel(AREAS.map(a => () => agent(`${CTX}\nYour area: ${a.prompt}`, { label: `extract:${a.key}`, phase: 'Extract', schema: EXTRACT, effort: 'high' })))
const E = JSON.stringify(ex.filter(Boolean)).slice(0, 60000)

phase('Write')
const write = await agent(`${CTX}
Extracted recipes, pitfalls and genericity gaps from four readers: ${E}
Write D:\\Dex\\Projects\\dex.place\\docs\\character\\PIPELINE.md — the reusable playbook for making ANY new character (player, NPC or boss) with this pipeline. Structure:
1. One-paragraph summary of the route and why (3D-to-pixel + hand layers + AI motion + critic loops), with the evidence that led here (2D code-drawn rig 3/10; spike findings).
2. "New character in N steps" checklist, each step with inputs, outputs, exact commands/scripts, and the gate that must pass before the next step.
3. Formulas and numbers (tables): ref measurement (pitch recovery), height rule and pixel budgets (head, eyes), proportions, palette/ramp construction, outline and sel-out, rim-on-outline, render settings, post-process parameters, VFX width and flash cap, timing tables and hitstop numbers, retime parameters, runtime contract limits.
4. File layout and what goes where (public repo vs review/ vs dex-place-art vs D:\\Dex\\Models), licensing rules for refs/motions/models.
5. Critique protocol: lenses, the 31 params, A/B sheet rules, pass criteria, how to run rounds, pivot rule.
6. What's Rosace-specific in the scripts today and must be parameterised for a new character (a short refactor list).
7. Pitfalls and lessons (each one line + the fix).
8. Status: what's proven vs in progress vs proposed, with dates; a note that each lane must update this file when it finishes.
Be concrete and compact; tables where they help; cite files. Plain language, no filler.`, { label: 'write:playbook', phase: 'Write', schema: { type: 'object', properties: { summary: { type: 'string' }, sections: { type: 'array', items: { type: 'string' } } }, required: ['summary'] }, effort: 'high' })

phase('Test')
const test = await agent(`${CTX}
You have NOT seen the Rosace work. Read ONLY D:\\Dex\\Projects\\dex.place\\docs\\character\\PIPELINE.md (and files it explicitly points to if needed) and plan how you would produce a SECOND character with it: a boss "warden" — a tall armoured construct in the strict red/black/white enemy style (ref 13 in review/refs/character/), ~1.6x the player's height, with a greatsword and 4 attacks. Write the concrete plan step by step as the doc instructs. Then list every point where the doc was ambiguous, missing a number/command/file, assumed Rosace-specific knowledge, or would lead you wrong. Be adversarial.`, { label: 'test:second-character', phase: 'Test', schema: { type: 'object', properties: { plan: { type: 'array', items: { type: 'string' } }, gaps: { type: 'array', items: { type: 'object', properties: { gap: { type: 'string' }, where: { type: 'string' }, fix: { type: 'string' } }, required: ['gap', 'fix'] } } }, required: ['plan', 'gaps'] }, effort: 'high' })

let fix = null
if (test && test.gaps && test.gaps.length) {
  fix = await agent(`${CTX}
A fresh reader tried to plan a second character (a boss warden) from docs/character/PIPELINE.md alone and found these gaps: ${JSON.stringify(test.gaps).slice(0, 12000)}
Fix the doc: fill each gap from the sources (tools/pixel-pipeline, tools/motion-ai, docs/character/*, art/rosace, the workflow journals) or mark it clearly as unknown/in-progress. Keep it compact. Report what changed.`, { label: 'fix:playbook', phase: 'Test', schema: { type: 'object', properties: { summary: { type: 'string' }, changed: { type: 'array', items: { type: 'string' } } }, required: ['summary'] }, effort: 'high' })
}
return { extract: ex.map(x => x && ({ area: x.area, recipes: x.recipes.length, pitfalls: x.pitfalls.length })), write, test: test && { planSteps: test.plan.length, gaps: test.gaps.length }, fix }

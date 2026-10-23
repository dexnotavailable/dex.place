export const meta = {
  name: 'rosace-motion-ai',
  description: 'Find/install AI motion models (NVIDIA + alternatives), feed references (text, keyframes, video), retarget to VRM, build our own retime/easing tool, A/B critique',
  phases: [
    { title: 'Research', detail: 'motion-generation models + video-to-motion models + reference videos' },
    { title: 'Install', detail: 'set up top routes locally on the RTX 4090' },
    { title: 'Generate', detail: 'text / keyframe / video-conditioned motions for glaive moves' },
    { title: 'Retime', detail: 'retarget to VRM humanoid + retime/easing/exaggeration tool + pixel test' },
    { title: 'Critique', detail: 'motion critics: raw vs retimed vs hand-keyed spike' },
  ],
}

const CTX = `
Project: dex.place player character "Rosace" — a 2D side-view pixel-art action character produced Dead Cells-style: a 3D model in Blender, animated, rendered each frame to pixel art. Read D:\\Dex\\Projects\\dex.place\\docs\\character\\DESIGN.md, MOVESET.md (M1 five-hit glaive string N1-N5, dash / perfect dash / dash attack, Q, R — wide, grand, fluid; frame tables at 60 fps), RESEARCH.md (measured AAA timing) and MOTION-SOURCES.md.
Dex's new instruction: "for the animation i suggest pulling that one animator from nvidia or like one of those animation models, feed them references then tune the timing and easing ourselves." So: use AI motion models (NVIDIA's if one is available, or the best open alternatives) to GENERATE body motion from references (text descriptions, keyframe poses, and/or reference VIDEO of the kind of attack we want), then we retime and ease it ourselves (pose-to-pose holds, snap, overshoot, rebound — the timing in MOVESET.md) and push the poses.
Rules: no IMAGE generation (motion models are fine — this is Dex's explicit call). You're authorised to download models/code/data and install into isolated environments (python venvs under D:\\Dex\\Tools\\venvs\\, model weights under D:\\Dex\\Models\\ — check free space first; D: has ~65 GB free; don't exceed ~30 GB total). Never create accounts or sign in anywhere; if a model needs a gated login (e.g. SMPL/SMPL-X body-model registration, gated Hugging Face repos, Adobe), note it as a Dex-needed step and use a route that doesn't need it meanwhile. No commits/pushes. Third-party reference videos/frames stay in the git-ignored D:\\Dex\\Projects\\dex.place\\review\\motion\\ folder. Record every download with license in D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\THIRD_PARTY.md. Hardware: RTX 4090 24 GB, Windows 11, Blender 5.1.2 at "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" (headless only; use an isolated user env like the one in tools/pixel-pipeline if it exists, never Dex's own prefs; never the Blender MCP). Another workflow is building the Rosace model concurrently in D:\\Dex\\Projects\\dex-place-art\\rosace\\ and tools/pixel-pipeline/ — don't edit its files; for retarget tests use a CC0 VRM humanoid (e.g. VRM Consortium "Seed-san", possibly already downloaded under D:\\Dex\\Inbox\\Downloads\\dexplace-character\\) or the Rosace rig read-only if it exists. Your code goes in D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\ .
Plain language in reports; separate measured facts, sourced claims and inference.
`

const DOC = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: { type: 'string' } },
    dexNeeded: { type: 'array', items: { type: 'string' } },
    outputs: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'findings'],
}

phase('Research')
const research = await parallel([
  () => agent(`${CTX}
Survey AI human-motion GENERATION models, NVIDIA first. Identify which NVIDIA animation/motion model Dex most likely means and whether it is usable locally (search NVIDIA Research / NVlabs / Hugging Face nvidia org for 2024-2026 motion generation: e.g. GENMO, MaskedMimic/ProtoMotions, any newer text/keyframe-to-motion or animation model, Omniverse/ACE animation tools). Then the best open alternatives (e.g. Tencent HY-Motion, MoMask, MDM, MotionLCM, T2M-GPT, MotionGPT variants, anything newer and stronger). For each: conditioning (text, keyframes/in-betweening, trajectory, style, music), output format and skeleton (SMPL/SMPL-X/HumanML3D joints/BVH), quality on athletic/stylised/weapon motions (spins, big sweeps, lunges — cite demos/papers), license for code AND weights (commercial/non-commercial — dex.place is a personal site with a donate button), gated downloads/registration needs, Windows + RTX 4090 feasibility, disk/VRAM. Rank the top 3 for our use and write D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\MODELS.md.`, { label: 'research:generation', phase: 'Research', schema: DOC }),
  () => agent(`${CTX}
Survey VIDEO-TO-MOTION (monocular 3D human motion capture from video) models usable locally: e.g. GVHMR, WHAM, TRAM, PromptHMR, NVIDIA GENMO (it also estimates from video), 4DHumans, any newer. Same criteria: quality on fast athletic motion, world-grounded trajectory, output skeleton, license, gated body-model downloads (SMPL/SMPL-X registration — note which need it), Windows + RTX 4090 feasibility.
Then find REFERENCE VIDEOS to feed them: official character demo/trailer videos of recent gacha characters who fight with a glaive/naginata/spear/polearm or do wide sweeping weapon spins (e.g. ZZZ Yanagi, Genshin polearm users like Xiao/Hu Tao/Arlecchino, Wuthering Waves and Arknights: Endfield polearm or wide-sweep characters, Honkai Star Rail), plus real-world naginata/spear kata footage (clean full-body side views are best for capture). For each: URL, which timestamps contain full-body attack sequences, camera angle quality for capture. Do NOT download yet; write D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\VIDEO-TO-MOTION.md with a ranked shortlist of models and 8-12 clip segments.`, { label: 'research:video', phase: 'Research', schema: DOC }),
])

phase('Install')
const install = await agent(`${CTX}
Research: ${JSON.stringify(research.filter(Boolean)).slice(0, 12000)}
Pick the best 1-2 generation models and the best video-to-motion model that can run here WITHOUT gated logins (if the best one needs a login, still pick the best non-gated one now and list the gated one as a Dex-needed upgrade). Install them in isolated venvs, download weights, and prove each runs on the 4090 with a trivial sample. Write D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\SETUP.md (exact commands, versions, disk used, VRAM measured) and small wrapper scripts that output motion as BVH (or FBX/NPZ plus a converter to BVH) with a documented skeleton.`, { label: 'install', phase: 'Install', schema: DOC, effort: 'high' })

phase('Generate')
const gen = await agent(`${CTX}
Install report: ${JSON.stringify(install).slice(0, 5000)}
Generate candidate body motions for Rosace's moves (see MOVESET.md) with the installed models, feeding references:
- TEXT/keyframe prompts written from MOVESET.md for: N1 (rising scoop sweep from behind to high front), N3 (twirling glaive spins), N5 (wide spinning finisher), the dash + dash-attack pass-through, the Q stamp (glaive planted), and an idle breathing stance and a run cycle. Use keyframe/in-betweening conditioning where the model supports it (e.g. key poses from MOVESET's key drawings).
- VIDEO: download 2-4 of the best clip segments from VIDEO-TO-MOTION.md (yt-dlp into review/motion/clips/, trimmed to the attack segments), run video-to-motion, export BVH.
Generate several variants per move. Save all motions under D:\\Dex\\Projects\\dex-place-art\\rosace\\motion-ai\\raw\\ with a catalogue (move, source, prompt/clip, model, length, notes) at D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\CATALOGUE.md. Render quick stick-figure/turntable previews (GIF/MP4 via ffmpeg at D:\\Dex\\Tools\\ffmpeg-9.0.1-full_build) into review/motion/previews/ and look at them (sample frames with Read) — reject garbage (foot sliding, jitter, broken wrists, no weapon intent) and say which variants are strongest per move.`, { label: 'generate', phase: 'Generate', schema: DOC, effort: 'high' })

phase('Retime')
const retime = await agent(`${CTX}
Generation report: ${JSON.stringify(gen).slice(0, 6000)}
Build our own "tune the timing and easing ourselves" layer in D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\:
1. Retarget: generated skeleton -> VRM humanoid in headless Blender (bone mapping file, rest-pose alignment, root motion handling, foot locking/IK cleanup, hand IK to two grip sockets on a glaive prop so both hands stay on the shaft).
2. Retime tool (Python, data-driven): extract key poses (extremes/contacts) from a motion, then rebuild the clip from a TIMING SHEET JSON: per key its target frame, hold length, easing curve into it (ease-in/out, snap = 1-2 frame transition, overshoot + rebound/settle), per-bone or per-chain exaggeration multipliers (push rotations past the source, add torso twist / line-of-action), and "on 2s/3s" stepped playback for the pixel look. Output: an action ready for the pixel render. Include timing sheets for N1 and N5 following MOVESET.md's frame tables.
3. Pixel test: render N1 and N5 (raw-generated vs retimed+pushed) on the CC0 VRM base (or read-only Rosace rig if available) through the pixel pipeline in tools/pixel-pipeline (read-only use of its scripts; copy into tools/motion-ai if you need changes), at ~144 px, with the hand-keyed spike sweep for comparison. Produce side-by-side animated GIFs at 1x and 3x plus contact sheets in review/motion/ab/, labelled A/B/C only, key in key.json.
4. A short doc tools/motion-ai/RETIME.md: how Dex and I tune a move (edit timing sheet -> re-render in seconds). Look at your outputs before reporting.`, { label: 'retime', phase: 'Retime', schema: DOC, effort: 'high' })

phase('Critique')
const CRIT = { type: 'object', properties: { ranking: { type: 'array', items: { type: 'object', properties: { variant: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['variant', 'score', 'why'] } }, params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, best: { type: 'string' }, gap: { type: 'string' } }, required: ['param', 'best', 'gap'] } }, topFixes: { type: 'array', items: { type: 'string' } }, routeVerdict: { type: 'string' } }, required: ['ranking', 'topFixes', 'routeVerdict'] }
const critics = await parallel(['motion quality: arcs, spacing, timing, snap/ease/rebound, weight, line of action, exaggeration (CRITIQUE-PARAMS 11, 19-25)', 'fit to brief: wide, grand, fluid, AAA gacha feel vs refs 05 / 09 / 10 motion and RESEARCH.md timing; does the AI source add value over hand-keying?'].map((lens, i) => () => agent(`${CTX}
Independent motion critic. Lens: ${lens}. Retime report: ${JSON.stringify(retime).slice(0, 4000)}
Watch the A/B/C GIFs and contact sheets in D:\\Dex\\Projects\\dex.place\\review\\motion\\ab\\ (sample frames with Read; step through frames), write verdicts BEFORE opening key.json, then map. Compare with refs 05, 09, 10 in D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\. Rank variants, give per-parameter best + gap, top fixes, and a verdict on the route (AI generation + our retime) for this character.`, { label: `critic:${i + 1}`, phase: 'Critique', schema: CRIT, effort: 'high' })))

return { research, install, gen, retime, critics: critics.filter(Boolean) }

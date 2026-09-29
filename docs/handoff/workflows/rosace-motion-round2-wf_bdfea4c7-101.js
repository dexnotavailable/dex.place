export const meta = {
  name: 'rosace-motion-round2',
  description: 'Motion round 2: hand-posed hero keys + stronger pushes + strike-weighted drawing picks + secondary motion on N1/N5, blind A/B/C vs round 1 and spike, loop to beat the spike',
  phases: [
    { title: 'Push', detail: 'hero keys hand-posed on the rig, amplitude pushes, re-picked drawings, secondary motion' },
    { title: 'Critique', detail: 'blind A/B/C motion critics' },
    { title: 'Fix', detail: 'iterate up to 3 rounds' },
  ],
}

const CTX = `
Project: dex.place player character "Rosace" (docs/character/DESIGN.md, MOVESET.md, PIPELINE.md — read PIPELINE.md sections 3.13-3.14 and 5 first). Repo D:\\Dex\\Projects\\dex.place (public; no commits/pushes). Motion route: NVIDIA Kimodo fills in between our MOVESET key poses -> tools/motion-ai retarget onto Rosace's VRoid rig (glaive IK, planted feet) -> retime from a timing sheet (holds, snap, ease, overshoot, push, stepped drawings) -> pixel render at 144 px through tools/pixel-pipeline. Read tools/motion-ai/RETIME.md and SETUP.md for how to run everything, and review/motion/ab/key.json + the round-1 A/B outputs in review/motion/ab/ and review/motion/retime/.
Round-1 motion critics (both kept the route "as a blocking and in-between layer, not the finished motion"): retimed 4.5-5.5, raw AI 3-3.5, and the crude hand-keyed spike still out-snaps it on N1 (5.5) because the AI poses are realistic and tame: peaks 1.1-1.4 H wide, upright, narrow stance; pushes of 1.15-1.4 added ~0% width on N5; strike-frame pixel change ~1:1 vs anticipation (spike 5.4:1); no secondary motion on holds.
Their fixes, all required this round:
1. Hand-pose the HERO KEYS on Rosace's rig (coil, release, contact, kneel/follow-through) as authored pose data, matching refs 05, 09, 10 in D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\ (look at them): hips low, torso twisted 60-90 degrees, line of action diagonal, stance 1.5-2 shoulder widths, weapon far behind at wind-up (N1 A2: tip ~1 H behind the heel; N5 A3: deep heels-down crouch, glaive flat ~1.35 H behind the hip; N5 C1: low lunge, arms fully extended). Keep AI motion only for in-betweens and weight shifts.
2. Amplitude pushes 1.6-2.0 on legs/root/spine at coil and contact keys, lean 20-35 degrees into contact; N5 release stays low.
3. Re-pick which frames become drawings so the big travel lands on the strike: acceptance = pixel change on strike frames >= 3x the anticipation steps.
4. Secondary motion that actually moves on holds: hair, sleeves, front tabard, veil lag 1-3 frames and settle (spring chains or baked), per DESIGN.md's lag order.
5. Width: the swing's visible horizontal span at contact >= 1.7 H (beat the spike), consistent with MOVESET's AOE widths.
Constraints: use a read-only SNAPSHOT copy of the current rosace.blend (another workflow keeps saving the live file in D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\ — never write it); absolute paths only for every Blender render (a round-1 run leaked frames to C:\\review); one Blender process at a time; outputs under D:\\Dex\\Projects\\dex.place\\review\\motion\\r2\\ (git-ignored) and D:\\Dex\\Projects\\dex-place-art\\rosace\\motion-ai\\; code/data in tools/motion-ai/ and art/rosace/poses/. When done, update docs/character/PIPELINE.md sections 3.14 and 8 with what was proven (AGENTS.md rule).
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, metrics: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } }, abFiles: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'metrics', 'abFiles'] }
const CRIT = { type: 'object', properties: { ranking: { type: 'array', items: { type: 'object', properties: { variant: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['variant', 'score', 'why'] } }, beatsSpike: { type: 'boolean' }, params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, best: { type: 'string' }, gap: { type: 'string' } }, required: ['param', 'best', 'gap'] } }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['ranking', 'beatsSpike', 'topFixes'] }

let build = null, history = [], critique = null
for (let round = 1; round <= 3; round++) {
  phase('Push')
  build = await agent(`${CTX}
Round ${round}. ${critique ? 'Previous critique to address first: ' + JSON.stringify(critique).slice(0, 8000) : ''}
Do the five fixes for N1 and N5, render, and build blind A/B/C comparisons (round-1 retimed vs this round vs the hand-keyed spike, labelled A/B/C only with a key.json) as 1x and 3x GIF/MP4 plus contact sheets into review/motion/r2/round-${round}/. Measure and report: strike-to-anticipation pixel-change ratio, horizontal span at contact in H, stance width, max hip twist, lean at contact, foot drift, hand-to-shaft error, and secondary-motion displacement on holds. Look at the outputs frame by frame before reporting.`, { label: `push:r${round}`, phase: 'Push', schema: DOC, effort: 'high' })
  if (!build) break
  phase('Critique')
  const crits = await parallel([
    'MOTION CRAFT: arcs, spacing, timing, snap/ease/rebound, weight, line of action, exaggeration, secondary motion (CRITIQUE-PARAMS 11, 19-25)',
    'BRIEF FIT: wide, grand, fluid, latest-gen gacha feel vs refs 05, 09, 10 and RESEARCH.md timing; does it now beat the hand-keyed spike?',
  ].map((lens, i) => () => agent(`${CTX}
Independent motion critic. Lens: ${lens}. Builder report: ${JSON.stringify(build).slice(0, 3500)}
Watch the A/B/C GIFs/MP4s and sheets in D:\\Dex\\Projects\\dex.place\\review\\motion\\r2\\round-${round}\\ (step through frames by sampling with Read), write verdicts BEFORE opening key.json, then map. Rank variants 0-10 (refs = 9), say whether this round beats the spike, per-parameter best + gap, and top fixes.`, { label: `critic:${i + 1}:r${round}`, phase: 'Critique', schema: CRIT, effort: 'high' })))
  const ok = crits.filter(Boolean)
  history.push({ round, metrics: build.metrics, crits: ok.map(c => ({ ranking: c.ranking, beatsSpike: c.beatsSpike })) })
  log(`round ${round}: beats spike ${ok.filter(c => c.beatsSpike).length}/${ok.length}`)
  if (ok.length && ok.every(c => c.beatsSpike)) break
  critique = ok.map(c => ({ ranking: c.ranking, params: c.params, topFixes: c.topFixes }))
}
return { build, history }

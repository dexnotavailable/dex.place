export const meta = {
  name: 'kimodo-text-encoder',
  description: 'Install the ungated Llama 3 8B Instruct copy (16 GB) as Kimodo text encoder under the official repo id, enable text prompts, verify',
  phases: [
    { title: 'Install', detail: 'download, cache under official id, verify hashes, wire Kimodo text mode' },
    { title: 'Verify', detail: 'independent check that text conditioning works and nothing else broke' },
  ],
}

const CTX = `
Context: Kimodo (NVIDIA text/keypose-to-motion) is installed per D:\\Dex\\Projects\\dex.place\\tools\\motion-ai\\SETUP.md (venv D:\\Dex\\Tools\\venvs\\kimodo, source D:\\Dex\\Tools\\src\\kimodo, weights D:\\Dex\\Models\\kimodo, generator script tools/motion-ai/kimodo_gen.py). Its text prompts are off because its text encoder (LLM2Vec over meta-llama/Meta-Llama-3-8B-Instruct) is gated and Meta hasn't approved Dex's request yet. Dex's decision (2026-09-29): don't wait — download the licence-permitted UNGATED copy NousResearch/Meta-Llama-3-8B-Instruct (~16 GB); Dex accepts the Meta Llama 3 Community License and acceptable-use policy for this use. Record that in tools/motion-ai/THIRD_PARTY.md.
Important detail: kimodo/model/llm2vec/llm2vec.py special-cases config._name_or_path == "meta-llama/Meta-Llama-3-8B-Instruct". So the weights must be resolvable UNDER THAT OFFICIAL REPO ID (e.g. populate a Hugging Face hub cache with the proper models--meta-llama--Meta-Llama-3-8B-Instruct/snapshots/<rev>/ + refs/main layout, then run with HF_HUB_OFFLINE=1 for that repo), not via a local path that changes _name_or_path. Find any other repos LLM2Vec/Kimodo pulls (e.g. McGill-NLP LLM2Vec adapters) and fetch those too (ungated only).
GPU: shared with dexClient's local llama-server (~22 GB, a 27B Qwen). Kimodo supports TEXT_ENCODER_DEVICE=cpu (<3 GB VRAM). Default to CPU for the encoder unless the GPU is genuinely free; check system RAM first.
Disk: D: has ~45 GB free. Put the HF cache under D:\\Dex\\Models\\hf (never C:). Download only what's needed (config, tokenizer files, *.safetensors; skip original/ consolidated .pth duplicates). Stop and report if free space would drop below 15 GB.
Another agent may be running Kimodo generations right now (tools/motion-ai, D:\\Dex\\Projects\\dex-place-art\\rosace\\motion-ai\\) — don't delete or overwrite its outputs, don't kill its processes; keep your tests small. No commits/pushes. Never print, log or commit tokens (no token is needed for the ungated repo).
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'result'] } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'checks'] }

phase('Install')
const install = await agent(`${CTX}
Do it:
1. Check RAM, VRAM use and D: space. Compare the NousResearch repo's file list and LFS sha256 values with the official meta-llama repo's public metadata (the model-info API usually lists sibling files and LFS hashes even for gated repos) and report whether the weights are identical.
2. Download into the hub cache layout under the official id, verify every file's sha256 after download.
3. Wire Kimodo: environment variables (HF_HOME or HF_HUB_CACHE -> D:\\Dex\\Models\\hf, HF_HUB_OFFLINE=1, TEXT_ENCODER_DEVICE as appropriate) set per-run inside tools/motion-ai (e.g. kimodo_gen.py sets them or a small wrapper), not machine-wide; add a --text option to kimodo_gen.py (keeping the no-text keypose mode working).
4. Prove text conditioning: generate the same 5 s clip with (a) no text, (b) "a woman swings a long glaive in a wide horizontal arc, then spins and plants it", (c) "a woman walks calmly forward"; show the motions differ in the expected way (joint-trajectory stats + a quick stick-figure contact sheet via the existing storyboard_sheet.py into D:\\Dex\\Projects\\dex.place\\review\\motion\\text-encoder\\ — look at it).
5. Update SETUP.md (what's where, sizes, env, how to run with text) and THIRD_PARTY.md.`, { label: 'install:text-encoder', phase: 'Install', schema: DOC, effort: 'high' })

phase('Verify')
const verify = await agent(`${CTX}
Independently verify the builder's work: ${JSON.stringify(install).slice(0, 5000)}
Check: files and sha256 in the cache; that _name_or_path resolves to "meta-llama/Meta-Llama-3-8B-Instruct" at load time (instrument or inspect); offline loading works with no network access to that repo; text vs no-text generations differ sensibly (look at the contact sheets yourself); the no-text keypose mode still works; D: free space; SETUP.md and THIRD_PARTY.md are accurate; nothing on C: grew (HF cache not on C:). Return pass / blocking with evidence.`, { label: 'verify', phase: 'Verify', schema: { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'blocking', 'notes'] }, effort: 'high' })

return { install, verify }

# Obsolete candidate f/g archived · 2026-09-08

Archived only `preparation-20260908-f` and `preparation-20260908-g` from the private D-backed release-staging folder to `A:/Dex/Archives/dex-place/release-staging`. Their former D paths now contain directory junctions to the verified A copies, preserving historical proof references. CandidateH remains an ordinary directory on D and was not moved or modified.

| Candidate | Regular files | Content bytes | Canonical content-tree SHA256 |
|---|---:|---:|---|
| preparation-20260908-f |251|690,638,183|7525cf62aecd0dbd3f359129ffe9bcf8561de8f47fdfd6fd623473c10f7cc870|
| preparation-20260908-g |250|690,923,133|acecc5ec61a9fed6166f50b302484027a7d67134d318c8a130adb65aaccc26b1|

Total:501 regular files,1,381,561,316content bytes. Every source file was hashed before copying; every A copy and source was checked against that identity. The finalize step independently checked both complete file sets, byte sizes and all hashes again before deleting any original copy. The tree hash covers sorted relative paths, lengths and SHA256 values; `obsolete-f-g-copy.json` retains the per-file inventory and junction records.

Each candidate contained two test junctions into its own HTTP-fixture `outside` directory. These were not followed while inventorying/copying. Their A equivalents point within their corresponding archive. Before any recursive source cleanup, the four original junction links were removed **without recursion**, their target directories were confirmed to remain present, and each source subtree was checked to contain no remaining reparse points. Only then were the exact whitelisted, proven D copies removed. New D-root reference junctions were created afterward and their A targets verified.

Both root paths and existing ancestor directories were checked: no unexpected ancestor reparse points, and resolved source/archive paths remain within their explicitly named owners. Process metadata searches found no active command-line references to either obsolete candidate before copying and immediately before cleanup; command lines themselves were not printed or archived.

## Space and preserved current candidate

D free space immediately before removal was6,674,456,576bytes and immediately after was8,057,077,760bytes: an increase of1,382,621,184allocated bytes. Initial preflight had6,701,961,216free bytes; other active work can change free space during an operation, so the immediate removal measurement is the relevant comparison. A free space after verified copies/removal was9,344,924,426,240bytes.

H's verified identities were unchanged before/after:

- `preparation-20260908-h/preparation-proof.json`:9a9e2b8620c1068157b48e6058236aa3996c20d88f3ddb28dc155555fb98d8ff
- `preparation-20260908-h/site/release-manifest.json`:fcf4fbd1065db951536f83a49c189c6dcd526e38509c4bd6684e0f63048c67a3

No public origin/tunnel task, other candidate, user source, browser profile, account or unrelated project was changed. No age-based cleanup or unverified deletion occurred. These authorized mutations were accepted; no automatic-approval rejection occurred in this archival task. Earlier unrelated temporary-browser-profile deletion rejections were not retried.

## Receipt and reversibility

- `obsolete-f-g-copy.json`: per-file hashes, exact source/archive paths, link rebasing, before/after copy and H identities. SHA256 a9d5e50df57ce2a69762699dba9f10e8f6ee9446159d59e5856bc9d788a10cfe.
- `obsolete-f-g-final.json`: revalidation, per-root removal/junction success, free space and unchanged H checks. SHA256 e9882794d99b03713e4059ff0016e84490cf0313a78ca89a5e3b7e117b7b92bb.
- `copy-obsolete-f-g.ps1` and `finalize-obsolete-f-g.ps1`: bounded scripts. Do not rerun blindly; archive existence and final state deliberately prevent duplicate operations.

The old paths remain readable now. To restore physical copies on D later, remove only the two root reference junctions without recursion, copy the corresponding A archives back into those exact D locations, rebase the four internal test junctions to the restored local fixture targets, then verify against the stored content inventory. Do not delete the A archive until that separate restoration is fully verified. No restoration is required for the active H runtime.

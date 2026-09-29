---
name: workflow-resume-gotchas
description: Workflow tool resume/relaunch pitfalls seen on Dex's Windows box (prefix cache vs pipeline order, CRLF "control characters", null caching)
metadata:
  type: reference
---

Learned 2026-09-29 while pausing and resuming the dex.place lanes for account switches:

- **Resume caches only a strict prefix, in call order.** Inside `pipeline()`, items finish in a different order on resume, because cached steps return instantly. So the cache breaks at the first reordered call and everything after it runs again.
  - Stop runs at phase boundaries when possible.
  - Before resuming, write digests of the interrupted and redone agents' work to a file their prompts point to, so the reruns continue from it. dex.place keeps these in `review/resume/`.
- **"script contains control characters" on a scriptPath relaunch means CRLF.** Python's text-mode `open(p,'w')` on Windows writes CRLF. Always write with `newline='\n'`, or convert back with `b.replace(b'\r\n', b'\n')`. The same bug silently turns repo docs into CRLF.
- **Never let usage run out mid-run.** An agent that dies on an API error returns null, and resume may reuse that null instead of redoing the step. Stop the runs with TaskStop before an account switch.
- When patching a prompt for resume, add a conditional suffix that evaluates to `''` for every call that already finished, so their text stays byte-identical. Use forward slashes in paths inside JS strings, because `\r` in `\review` becomes a carriage return.

Related: [[dex-place-working-mode]]

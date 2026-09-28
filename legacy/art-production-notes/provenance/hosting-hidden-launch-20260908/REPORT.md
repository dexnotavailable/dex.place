# Hosting tasks: hidden future starts

2026-09-08. **The two existing hosting task definitions are corrected, with current processes unchanged.** No task was started/stopped, no process was killed, no terminal was manipulated and no new task/startup owner was created.

Exact targets:

- `\Dex\Dex Site Origin`
- `\Dex\Dex Site Cloudflare Tunnel`

Each existing PowerShell action received only ` -WindowStyle Hidden` immediately before ` -File `. Execute path, script path, working directory, action ID, triggers, principal, settings and every other normalized XML field are unchanged. Both tasks remain Running. The child launchers already used hidden Start-Process; this correction covers the persistent parent PowerShell launched by Task Scheduler. Root separately owns the registration-script correction so a future re-registration preserves the flag; neither registration script was executed by this lane.

## Evidence

- `patch-hosting-hidden.ps1`: Prepare exports both exact definitions/process identities before Apply; Apply uses supported `Set-ScheduledTask -InputObject` and verifies argument-only readback after each change.
- `before-0.xml`, `before-1.xml`, `after-0.xml`, `after-1.xml`: unchanged strings returned by Export-ScheduledTask serialized as UTF-8. Because the returned strings declare UTF-16, use the additional correctly encoded `before-0-native.xml` / `before-1-native.xml` for file-based restoration, or read the original proof strings explicitly as UTF-8 before supplying an XML string to the supported API. No original proof file was overwritten.
- `independent-verification.json` and `verify-result.py`: independent normalized XML comparison finds exactly one changed Arguments leaf per task, consisting solely of the reviewed insertion. All other XML values/hierarchy/attributes agree. Native restoration-copy hashes are recorded.
- `before-processes.json` / `after-processes.json`: exact PID, parent PID, executable and creation-time values agree for cloudflared5196, origin Node28168 and parent PowerShell32860/56752. The listener remains127.0.0.1:8088 owned by28168.
- `public-health.json`: the single public health request returns200`ok`, with normal authorized TLS1.3 through Cloudflare.

The first script comparison marked process identity false because PowerShell's ConvertFrom-Json interpreted ISO timestamp strings as DateTime before reserialization. Its original `mutation-receipt.json` is retained. Independent parsing of the saved before/after strings confirms exact identities. A separate first XML-parser attempt rejected the proof files' declaration/serialization mismatch; explicit string decoding and additional native UTF-16 copies resolve that proof-format issue without another task mutation. Neither observation was evidence of a restarted service or changed task field.

This verifies future-start configuration and non-disruption of the running site. It does not claim that a new launch was visually observed hidden, or identify any currently visible terminal as a hosting window. The change intentionally does not hide or close an already-running window. No automatic approval rejection occurred during the task mutation; no alternate mutation route was needed. Shared hosting docs and ledger remain root-owned.

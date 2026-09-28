# Production mount audit — current source

2026-09-08. **Final canonical-origin mounted proof:17/17 pass.** This is an isolated loopback proof, not a public promotion, TLS/browser-cookie acceptance test, or real media/account lifecycle test.

## Current verified behavior

- Freshly bundled current factory attaches behind the actual static origin. `/api` stays JSON and no-store, including unavailable503 and unknown404 states; it never falls through to the SPA.
- Logical origin `https://dex.place`, exact request Host `dex.place`, and loopback HTTP match the reverse-proxy origin shape. The service issues `__Host-dex_session` with Path=/, Secure, HttpOnly, SameSite=Lax,1800-second lifetime and no Domain. A prior HTTP-origin variant proved the deliberate local cookie variant separately.
- Guest cookies preserve their CSRF state; wrong Origin or missing token rejects POST403. A same-origin guest sign-out rotates only this fixture's cookie/CSRF. Protected progress/social/history routes return401. No real sign-in, signup, email, recovery or account mutation occurred.
- The allowed shared-identity capability read reported providerReady=true/password=true; signup, Google, recovery and confirmation=false. This is readiness metadata, not a verified login or delivered email.
- Static GET/HEAD/gzip/304, HTML no-transform, ZIP attachment and identity byte ranges, canonical WWW redirects, private/source-path denial, zero-byte files and static POST405 pass. SP13 allowlist/current/immutable/compressed-WASM rules pass on harmless private fixtures; real SP13 files were untouched.
- Explicit trusted-loopback proxy mode separates valid visitor IP rate buckets: one fixture address exhausted its600-request anonymous budget while a second remained independent. This did not send traffic through the public proxy.
- Service close is idempotent, clears its one tracked interval and invokes the inactive voice cleanup spy once. The ephemeral origin port50662 is closed and the dedicated fixture data directory contains zero persistent files. No original task/origin/tunnel was started or stopped.

Proof: `mount-proof-https-final/mounted-http-proof.json`. All tracked source hashes stayed stable during the final run. Earlier16-check HTTP/HTTPS receipts retain their older bundle scope.

## Findings corrected by root

1. Bootstrap selected `cloud`, while the actual voice adapter accepts `native` or `forwarded`. Current bootstrap selects the reviewed forwarded topology.
2. Disabled voice could inherit prior LIVEKIT environment configuration. Current bootstrap clears CONFIG/URL/API_KEY/API_SECRET/MODE before selecting its configured provider, and explicitly clears OAuth readiness.
3. The old data-root substring guard missed exact `/site` and separator edge cases. Current bootstrap requires the normalized exact private production-data directory.
4. Launcher health accepted an existing static H process using only `/healthz`. Current launcher additionally checks `/api/health` with Host dex.place and the expected service/identity. Exact release identity still belongs to promotion verification.

Current scripts pass Node/PowerShell syntax checks. Production configuration was not read, copied, enabled or run by this audit.

## Private frozen owner packet

`mount-proof-final` contains:

- `server/runtime.mjs`:547470bytes, SHA256 `ba4acb3e2fd2f5dee0d1a01c14e596c0b205fc846419098b8f4d600074286eb8`.
- Exact SDK licences/source receipt beside the runtime; the bundle now explicitly admits the reviewed `server/livekit-config.mjs` source module, while excluding actual configuration, tests/pilots and credentials.
- `reviewed-server/serve-production.mjs`: SHA256 `630b839ef9da64f90d4f4833b0a22b58a34f2bd7bb0834095348afb2377b0d6b`.
- `reviewed-server/run-production.mjs`: SHA256 `c7400efa36ad066ed9eb68c40a6e07a2e9c832132d7239aead6e3e2bd31c3c99`.
- `reviewed-server/start-production-origin.ps1`: SHA256 `b933234ced3ea7cde284c5ad63895585b8035eb0c47ba1b00d305e8664167e53`.
- `owner-packet.json` records those identities and explicitly says production config/data/credentials were not copied.

Preparation now freezes all three origin-owner files and the private Node module together in each new candidate. The verifier checks their hashes and their exclusion from the public manifest. Preserve the existing primary reviewedServer fields for older tooling compatibility. Root will hash the reviewed enabled production metadata at actual promotion; no metadata hash is invented here.

`HOSTING.md` still identifies public preparation-20260908-h and frozen documentation1.0. Chapter26 correctly identifies v2 as a local candidate. Neither was edited by this audit, and H remains untouched.

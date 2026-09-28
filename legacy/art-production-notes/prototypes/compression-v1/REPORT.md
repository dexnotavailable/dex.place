# Negotiated text compression

Implemented only in `site/scripts/serve-production.mjs`. Server SHA256: `e88bf0f3aa8222ca301f5153f026bbdc924f5bc9154e0c5658cb2fd9e6b38245`.

## Actual transfer and first-impression result

The same prior-built dist used by the baseline was served by the changed production server on isolated loopback5196. Its index, JS/CSS, scene/map/hero manifest identities match the baseline and remained unchanged. No build or public-origin/tunnel action occurred.

| Measurement | Baseline | With negotiated gzip |
|---|---:|---:|
| JS/CSS HTTP body bytes | 2,444,987 | 663,309 |
| First observed usable navigation | 4.844 s | 1.916 s |
| First observed decoded preview | 13.982 s | 13.404 s |
| World ready | 29.641 s | 19.589 s |

The actual three JS/CSS responses are 72.9% smaller; independent raw HTTP reads, Content-Length and decompressed source hashes agree. This is measured encoded delivery, not the earlier local gzip estimate. `actual-transfers.json` contains each response's headers and hashes.

The single cold browser run uses the same1.6Mbps down/750kbps up/150ms latency/4×CPU lab settings as baseline. There were no page errors or failed requests. It is one reproducible comparison, not a statistical result, actual Samsung/iPad timing or public-edge proof. Preview delay remains poor: compression does not fix its size/priority. The visual source continues to change separately, so rerun performance on the final build. Full timing/resource data and unchanged-dist receipts are at `D:/Dex/Automation/Proofs/dex-place/20260907-compression-cold/receipt.json`.

## Recorded decisions for chapter07

- Negotiate gzip level6 for HTML, JS, CSS, JSON, SVG, Markdown and related plain-text extensions. Files above4MiB use the existing identity stream. Ordinary files below256bytes remain identity unless the client explicitly excludes identity.
- Use Node's built-in asynchronous zlib API, at most two compression jobs, shared in-flight work per exact source revision, and a16MiB/64-entry LRU of compressed bodies. Source reads allocate no more than the capped stat size and validate the file before/after reading. There is no unbounded compression job queue. These are application buffer/work bounds, not a claim that browser, HTTP sockets or Node's total RSS is16MiB. Node documents thread-pool/resource considerations for zlib. [Node zlib documentation](https://nodejs.org/download/release/v24.2.0/docs/api/zlib.html)
- Matching gzip responses use a strong hash ETag for the encoded bytes, `Content-Encoding:gzip`, `Vary:Accept-Encoding` and the actual encoded Content-Length. HEAD and304 describe that same selected representation. Existing identity metadata ETags remain weak.
- Explicit valid/invalid Range requests select identity before ETag and If-Range evaluation. Existing206,416, suffix range, conditional304 precedence, weak If-Range rejection and date If-Range behavior remain. A mismatching If-Range returns the full identity body.
- Respect gzip quality values, explicit identity preference/refusal and wildcard entries. Unsupported compression choices fall back to identity when accepted. If every available representation is explicitly refused, return406. If a gzip-only request arrives while both bounded jobs are occupied, return uncached503 with Retry-After1 rather than creating an unbounded queue. Negotiation follows the available representation semantics in [RFC9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.3).
- Binary archives/installers/images/audio and explicitly precompressed `.gz`/`.br` resources retain their exact payload and existing headers. Unity data/wasm/unityweb do not receive another compression layer. SP13's allowlist, cache policy and external-root containment remain unchanged.

## Validation and cleanup

`http-verification.json`:13 real HTTP groups cover six text types and exact decoding; HEAD; compressed/identity validators; q-values/wildcards/refusal; identity Range/If-Range/416; unchanged ZIP/installer/audio/image bytes; precompressed Unity and SP13 rules; canonical redirects, SPA MIME, security headers, malformed paths, methods and real Windows-junction escape rejection; empty/oversize sources; source revision invalidation; concurrent cold fallback; gzip-only saturation; actual cache byte/entry eviction bounds. Harmless private fixtures are retained beside this report.

`node --check scripts/serve-production.mjs` passes. The measured origin child PID7936 exited; the module-owned fixture/transfer servers closed in finally blocks. A final listener check found no5196 listener. Public8088, hosting tasks, user browser profiles and dist contents were untouched. Root owns rebuilding/restaging and final public delivery verification.

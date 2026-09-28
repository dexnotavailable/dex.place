# Source-rate decode proposal

Read-only production investigation, 2026-09-07. No site source, manifest, account, Suno or release changes.

## Recommendation

Retain decoded music at the reviewed master sample rate. For the current 48 kHz masters, use one lazily created `OfflineAudioContext(2, 1, 48000)` solely as the owner of `decodeAudioData()`. Never call `startRendering()`. Play its returned AudioBuffer directly through the existing live context, whatever that context's output rate is. Keep the authored music duration and the 64 MiB decoded-cache limit.

This removes unnecessary application-cache expansion at 96/192 kHz. It is not a license to assume every long Suno output fits, and it is not a reduction from the 48 kHz source master's quality.

## Primary documentation

The Web Audio specification requires decodeAudioData to resample to the decoding BaseAudioContext's rate. It permits an AudioBuffer to be shared between offline and real-time contexts. AudioBufferSourceNode playback compensates for differing buffer and context sample rates; loop points use the buffer's time base. An offline rendered output is allocated by startRendering, which this design does not call. See [decodeAudioData](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata), [AudioBuffer](https://webaudio.github.io/web-audio-api/#AudioBuffer), [buffer playback](https://webaudio.github.io/web-audio-api/#playback-AudioBufferSourceNode), and [OfflineAudioContext](https://webaudio.github.io/web-audio-api/#OfflineAudioContext).

The same specification allows implementation-dependent resampling strategies. It does not promise an absence of browser-internal decoder/resampler scratch allocations. The correct claim is one application-retained source-rate AudioBuffer per asset; total native process memory was not measured.

## Native probe

`probe.mjs` and `proof.json` use a fresh private page on the already running localhost:5188 server. They change no site implementation. One native live context per profile and one one-frame suspended offline decoder are used. Initial activation uses a native button; output is connected through zero gain to avoid playing diagnostic tones into the room.

Four Brave profiles pass all 40 assertions:

| Live context | Codec | Retained decoded cache | Theme's last second | Diagnostic 440 Hz tone |
| --- | --- | ---: | ---: | ---: |
| 96 kHz | Opus | 31,846,132 bytes | 1.00267 seconds | 439.453 Hz |
| 96 kHz | AAC | 31,846,132 bytes | 1.00267 seconds | 439.453 Hz |
| 192 kHz | Opus | 31,846,132 bytes | 1.00267 seconds | 439.453 Hz |
| 192 kHz | AAC | 31,846,132 bytes | 1.00267 seconds | 439.453 Hz |

Frequency deviation is within the analyser's FFT-bin resolution. The same support AudioBuffer object is assigned directly to the high-rate source. Its rate stays 48 kHz and its frame length stays unchanged. No second full-track decoded/rendered buffer is requested. All sixteen active clips decode at 48 kHz; the offline context remains suspended and unrendered. The theme's declared full duration remains 68.571458 seconds. This is a timing/pitch probe, not a full-track audition or production-manager integration test.

At 96 kHz this halves the current application cache from 63,692,264 to 31,846,132 bytes. At 192 kHz it avoids the otherwise approximately fourfold expansion from the 48 kHz source cache.

## Forecasts, not tests of an unknown Suno output

Current non-music decoded assets total 5,514,692 bytes. A 48 kHz stereo float buffer costs 384,000 bytes per second. Keeping the current other assets:

| Music duration | Approximate combined decoded cache | 64 MiB limit |
| --- | ---: | --- |
| 73.714 seconds | 33.82 MB | Fits before small codec padding |
| 90 seconds | 40.07 MB | Fits before small codec padding |
| 120 seconds | 51.59 MB | Fits before small codec padding |
| 180 seconds | 74.63 MB | Exceeds |

New stems, two concurrently cached long music cues, different channel counts, encoder padding or a master with a different source sample rate change these numbers. Actual chosen outputs must be measured. Long cues that exceed the cache contract should lead to a separately designed streamed-media route, not an arbitrary edit that damages the composition. Two 120-second stereo cues together exceed the limit even though one fits.

## Tight implementation delta for root approval

1. Add one lazy private decoder reference to the audio manager, initialized only inside the existing post-gesture load path. For this asset family it is a one-frame 48 kHz OfflineAudioContext; validate the selected source metadata against that rate. Future higher-rate masters require deliberate source-rate handling, not silent downsampling.
2. Reserve decoded bytes using the decoder/source sample rate rather than `context.sampleRate`. Preserve existing serialized decode, cache eviction, cap checks and cancellation revision guards.
3. Replace only the decode owner: `decoder.decodeAudioData(encoded)`. Put that returned buffer in the existing cache. Do not clone it with live-context createBuffer or offline rendering.
4. Keep existing frame-based loopBounds: it already derives loop positions from `buffer.sampleRate`. Keep offsets measured in seconds, playbackRate at 1, current fade/quiet logic and exactly one live context.
5. On dispose, invalidate in-flight loads and drop the offline decoder reference; OfflineAudioContext has no close() equivalent. An already-started decoder task may finish privately, but revision/dispose checks must prevent any cache commit or playback.
6. Re-run actual-manager rate/codec, cancellation, quiet-transition, cache and loop tests. Add decoder-rate evidence. Re-audit the loader contract guard only after implementation passes. Repeat exact-media checks once Suno supplies the chosen exported music.

Do not silently fall back to unbounded hardware-rate decoding if this route fails. Preserve an explicit recoverable Sound error or a separately proved bounded fallback. Remaining portability checks include real Samsung Internet/iPad Safari; only native Brave was probed here.

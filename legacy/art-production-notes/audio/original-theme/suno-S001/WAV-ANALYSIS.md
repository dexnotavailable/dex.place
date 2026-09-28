# S001 original WAV audit

Lossless download measurements are separate from the preserved MP3 audit. No source or site files were changed. No listening judgment is claimed.

| Export | WAV duration / frames | MP3 decoded duration | WAV loudness | WAV true peak | Alignment |
| --- | ---: | ---: | ---: | ---: | --- |
| S001-A-WAV | 56.5200 s / 2,712,960 | 56.3335 s | -15.14 LUFS | -4.12 dBTP | +0 frames; correlation 0.997937 |
| S001-B-WAV | 81.1200 s / 3,893,760 | 80.9335 s | -13.40 LUFS | -2.78 dBTP | +0 frames; correlation 0.998145 |

## S001-A-WAV

WAV is 0.1865 seconds longer than its MP3 decode. The main audio aligns, but unmatched boundary audio is not all below -60 dBFS. Do not describe the entire duration difference as silence or encoder padding.
First sustained energy above -50 dBFS: 0.0 s. First 2 seconds RMS: -15.82 dBFS. Last 0.1 seconds RMS: -52.15 dBFS.
Finite samples: True; samples at/above full scale: 0. Measured ending falls to a low level / quiet tail, consistent with decay or a deliberate fade; natural musical resolution is not established.
WAV SHA256: `0b3e8cf09d9b9959c4f4d364dfda79f22f83a6cd11c408a472ce0deda3738440`. Original file hashes unchanged: True.
WAV-to-MP3 gain difference: 0.9771 dB. MP3 residual relative to its signal after alignment/gain fit: -23.85 dB.
Unmatched wavTrailing: 8952 frames / 0.186500 s, RMS -53.60 dBFS, peak -37.34 dBFS.

## S001-B-WAV

WAV is 0.1865 seconds longer than its MP3 decode. The main audio aligns, but unmatched boundary audio is not all below -60 dBFS. Do not describe the entire duration difference as silence or encoder padding.
First sustained energy above -50 dBFS: 0.0 s. First 2 seconds RMS: -23.13 dBFS. Last 0.1 seconds RMS: -54.69 dBFS.
Finite samples: True; samples at/above full scale: 0. Measured ending falls to a low level / quiet tail, consistent with decay or a deliberate fade; natural musical resolution is not established.
WAV SHA256: `6966aa7dc1b43c9ab1483a0e013873349a1df30c5d2e7d21d4d403aa5e8d4383`. Original file hashes unchanged: True.
WAV-to-MP3 gain difference: 0.9808 dB. MP3 residual relative to its signal after alignment/gain fit: -24.31 dB.
Unmatched wavTrailing: 8952 frames / 0.186500 s, RMS -56.04 dBFS, peak -41.78 dBFS.

## Use of results

For further lossless authoring, preserve the full actual WAV duration and its own frame count. A file extension or requested generation duration does not determine musical endpoints. Do not truncate the WAV merely to match the MP3 or the prompt.
Cross-correlation can verify that paired files contain matching audio with a consistent timing offset. It cannot establish ownership, pleasing orchestration, emotional quality or musical resolution. The exact reason for provider boundary differences remains unverified unless the measurements support it.

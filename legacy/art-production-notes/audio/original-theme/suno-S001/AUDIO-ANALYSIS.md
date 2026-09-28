# S001 signal analysis

Read-only measurements. No listening or aesthetic approval is claimed. Sources were hash-checked before and after decoding; originals are unchanged.

| Source | Decoded length | Frames at 48 kHz | Integrated loudness | True peak | First 100 ms above −50 dBFS | Trailing below −60 dBFS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| authored-upload-reference-v2 | 73.7143 s | 3,538,287 | -21.27 LUFS | -5.10 dBTP | 2.65 s | 2.414 s |
| S001-A | 56.3335 s | 2,704,008 | -14.14 LUFS | -1.76 dBTP | 0.0 s | 0.000 s |
| S001-B | 80.9335 s | 3,884,808 | -12.40 LUFS | -0.13 dBTP | 0.0 s | 0.000 s |

## Opening and ending evidence

### authored-upload-reference-v2

First 2 / 5 / 10 seconds RMS: -159.32 / -26.95 / -28.34 dBFS.
Last 5 / 1 / 0.1 seconds RMS: -35.87 / -110.65 / -149.49 dBFS. Last-five-second envelope slope: -18.88 dB per second.
Measured ending falls to a low level / quiet tail, consistent with decay or a deliberate fade; natural musical resolution is not established.
Finite PCM: True. Samples at/above full scale: 0. SHA256: `ba9adf2e0a66a3d2706676bcff1c30f3db47cac0513d60563034740bf1add158`.

### S001-A

First 2 / 5 / 10 seconds RMS: -14.83 / -13.60 / -13.96 dBFS.
Last 5 / 1 / 0.1 seconds RMS: -34.87 / -52.30 / -56.15 dBFS. Last-five-second envelope slope: -5.65 dB per second.
Measured ending falls to a low level / quiet tail, consistent with decay or a deliberate fade; natural musical resolution is not established.
Finite PCM: True. Samples at/above full scale: 0. SHA256: `c9bc64ed8fb2cd1b8f3f9382108bc25c266bcfb5d5a7a1066a483798e59496b4`.

### S001-B

First 2 / 5 / 10 seconds RMS: -22.31 / -18.71 / -16.14 dBFS.
Last 5 / 1 / 0.1 seconds RMS: -41.31 / -56.32 / -58.07 dBFS. Last-five-second envelope slope: -5.02 dB per second.
Measured ending falls to a low level / quiet tail, consistent with decay or a deliberate fade; natural musical resolution is not established.
Finite PCM: True. Samples at/above full scale: 0. SHA256: `542ff10c570beb0dd514d0dddb97fa45728091a2fed8e01d2883fa4ca1fbceda`.

## Interpretation limits

An early energy onset can reveal that the upload’s opening quiet time was not retained. It cannot tell whether the first sound is melody, reverb, strings or accompaniment. A low-energy tail can reflect either a natural decay or an editorial fade; an active endpoint is a reason to inspect, not automatic rejection.
Judge the melody, register, spacing, instrument entrance and emotional effect by listening against the uploaded reference. No tempo, phrase matching, string entrance, musical conclusion or preference is inferred from RMS alone.
These files are original provider exports. No trimming to a requested duration, normalization, looping, site integration or model inference occurred. The 50 ms envelope and exact measurements are retained in audio-analysis.json.

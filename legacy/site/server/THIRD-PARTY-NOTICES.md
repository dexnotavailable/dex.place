# Service and voice source notices

The website remains an independently authored Phaser/React application. The voice integration uses these Apache License2.0 components:

- LiveKit client SDK2.22.1 — LiveKit, Inc.; installed package `livekit-client`. Source: https://github.com/livekit/client-sdk-js . The package's complete license is retained beside this notice as `LICENSE-APACHE-2.0.txt`.
- LiveKit server SDK2.18.0 — LiveKit, Inc.; installed package `livekit-server-sdk`. Source: https://github.com/livekit/node-sdks . Used only in the private Node service.
- LiveKit server v1.13.6 — LiveKit, Inc.; pinned upstream source commit `3cfbd1242618a61178f7a05b126d6c0c4cac3731`, https://github.com/livekit/livekit/tree/v1.13.6 . Original full license/source notices are retained in the isolated source archive. The optional locally built server differs from upstream in three marked production Go files and one focused test, to support authenticated per-track admin subscription grants and race-safe revocation while general client subscription stays denied. It is not an official upstream binary.

Source, original files, reproducible modification script, unified patch, toolchain pin, hashes and actual protocol receipts are kept with the private voice-repair proof. Preserve applicable upstream copyright/license notices when distributing the SDK bundle or repaired server. The root publication lane must include the full Apache license on its public software-attribution surface when it ships the browser SDK. This notice does not claim rights over unrelated example artwork, fonts or music.

The focused server changes and local integration/test code were authored for dex on2026-09-08. No upstream contributor endorsement is implied.

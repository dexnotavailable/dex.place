# Finite Narrator loopback preparation

Existing recorder: FFmpeg9.0.1 DirectShow. The installed driver exposes **Loopback (MOTU M Series)** separately from Loopback Mix and physical inputs. The [official MOTU M Series guide](https://cdn-data.motu.com/manuals/usb-c-audio/M_Series_User_Guide.pdf) documents plain Loopback as computer output; Mix adds live inputs. This script selects only plain Loopback. It never chooses a microphone or changes audio routing.

Existing CPU ASR: `D:/Dex/AI/Runtimes/stt.whisper-cpp/bin/whisper-cli.exe`; model `D:/Dex/AI/Models/WhisperCpp/ggml-base-q5_1.bin` is59,707,625 bytes. CLI supports `--no-gpu`; the finite script uses that flag, two CPU threads, below-normal priority and no initial textual transcription prompt. No installs, models, GPU work or external upload is needed.

Run only after root coordinates actual Narrator speech and confirms its output uses the MOTU output endpoint. `record-and-transcribe.py TAKE-NAME` captures15 seconds, enforces a25-second process deadline, retains the original48k stereoPCM capture and produces a16k mono derivative for CPU transcription. The ASR has a90-second deadline. A nonzero capture exit aborts the route without a microphone fallback.

Read-only discovery does not establish successful recording. Recording is not started merely by preparing this script. System output could include other computer sounds; root must coordinate a quiet Narrator-only test window. A transcript without spoken labels, roles or state is not a screen-reader acceptance claim.

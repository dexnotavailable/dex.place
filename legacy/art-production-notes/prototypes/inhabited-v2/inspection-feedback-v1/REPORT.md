# Physical inspection feedback and normal-play check — 2026-09-08

The terminal/product, folder, art frame and donation plinth now hold their own presentation state for an actual inspection, then return when its panel closes or browses away. The folder uses separately cropped P12 back/pages/cover; no new raster sheet or artwork edit was needed. Terminal product objects now share the existing terminal lighting path. The independent160ms opening /220ms return timeline runs while gameplay is paused, and does not change cut, bridge or lift states.

Grounded E also settles an unhurt, non-attacking hero into its existing idle pose facing the source. A sword swing already in progress is preserved and completes after the panel closes. Room replacement/disposal clear held and returning inspection visuals. The exact rules and source-to-UI mapping are in STATE-CONTRACT.md.

## Verification

- `proof.json` / `feedback-before-pose.json`:16 actual App checks passed across product terminal, physical folder, Archive terminal, donation plinth and artwork frame. Native E, close buttons and Escape drive the real UI. Each source stays held while gameplay steps are frozen, starts returning on close, and settles without hardware changes.
- `pose-proof.json`:11 focused actual App checks passed after the pose correction. Product/folder E faces the source in idle; an existing native J attack is neither truncated nor advanced while its panel is paused, then finishes after close. No source drift in this captured window.
- `*-closed.png`, `*-held.png`, `*-returning.png`, `*-returned.png`: unscaled crops captured from the actual canvas during RAF. These are captures, not repainted sprite outputs. The full `*-ui.png` screenshots show the actual inspection panels. Personal artwork remains DOM-only; generated frame feedback is what changes in canvas.
- `pnpm exec tsc --noEmit`: passed after the final game change.

Both native runs restored only actual browser storage saved by prior native runs. They did not inject positions, inspection or victory state.

## One ordinary boss attempt

`normal-boss-proof.json` records one bounded native-input attempt with Combat assistance explicitly disabled. It lasted31.6 seconds before defeat, reached4/8 boss HP, and returned to the existing safe retry flow. No retry was made and no download occurred. This is not an ordinary-victory claim.

The pilot read diagnostic phase/clip/frame and player position to time ordinary keys; it is not a blind human difficulty test. It successfully dodged the ground-strike pattern and made recovery hits. Three late jumps were hit by close-range projectiles, roughly0.56–0.63 seconds after their windups were observed. At about49–54px separation, the projectile spawns close to the hurt region; reacting to the emerging projectile leaves little time, so the visible windup needs to be the clear cue. The recorded pilot jumped late. No combat numbers were changed on the strength of that failure. A normal-difficulty victory and broader player difficulty judgment remain unproven.

## Development-server incident

The dev server temporarily served an old assemblies module without `holdAssemblyInspection`, even though the disk file and TypeScript build contained the export. `stale-vite-import.json` preserves the mismatch and handled import error. The first batched process restart was rejected by automatic approval review before execution. Root then used the original owned Vite exec session's normal Ctrl+C shutdown and restarted the same source/127.0.0.1:5188. Fresh import/create and TypeScript passed afterward; public hosting/auth services were not restarted by this lane.

The failed stale-import lifecycle attempt is preserved separately. A subsequent fresh16-check hydration/frame/bat/map lifecycle run passed again under `../room-streaming-v1/lifecycle-proof.json`.

The `prepared` phase is now announced for every hydrated passage, independent of focus. UI gates loading, permits prepared Resume and suppresses its one-frame label during ordinary play. This closes the pause-between-hydration-and-opening race; the UI lane owns its final prepared/loading edge proof.

No public publication, physical-device acceptance or new audio listening approval is claimed here.

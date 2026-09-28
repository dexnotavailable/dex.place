/** Selected complete Suno B theme; the integrated ambience/effects mix remains under review. */
export const AUDIO_DIRECTION = 'suno-b-chamber-v2' as const;
export const AUDIO_DIRECTION_STATUS = 'music-selected-mix-review' as const;
export const FOOTSTEP_TRIAL = 'recorded-steps-v1' as const;
export const FOOTSTEP_TRIAL_STATUS = 'comparison-unapproved' as const;
/** Stable gameplay IDs resolve to versioned files so the rejected sounds cannot mask the trial in HTTP cache. */
export const FOOTSTEP_ASSET_URLS: Readonly<Record<string, string | undefined>> = {
  'step-concrete-1': '/audio/world-v1/recorded-steps-v1/step-concrete-1.wav',
  'step-concrete-2': '/audio/world-v1/recorded-steps-v1/step-concrete-2.wav',
  'step-metal-1': '/audio/world-v1/recorded-steps-v1/step-metal-1.wav',
  'step-metal-2': '/audio/world-v1/recorded-steps-v1/step-metal-2.wav',
};
export type AudioRegion = 'arrival' | 'dispatch' | 'archive' | 'gallery' | 'support' | 'transition' | 'boss';
export type AudioContent = 'none' | 'reader' | 'panel' | 'art';
export type MusicCue = 'support' | 'arena-chamber';
export type AmbienceCue = 'exterior' | 'interior';
export interface AudioDirection {
  music: MusicCue | null;
  ambience: AmbienceCue | null;
  musicLevel: number;
  ambienceLevel: number;
  effects: boolean;
  quietReason: 'dispatch' | 'archive' | 'transition' | 'reader' | 'art' | 'arena-score-deferred' | null;
}

const regions: Readonly<Record<AudioRegion, Readonly<AudioDirection>>> = {
  arrival: { music: 'support', ambience: 'exterior', musicLevel: 1, ambienceLevel: .5, effects: true, quietReason: null },
  support: { music: 'support', ambience: 'interior', musicLevel: 1, ambienceLevel: .5, effects: true, quietReason: null },
  gallery: { music: 'support', ambience: 'exterior', musicLevel: .55, ambienceLevel: .35, effects: true, quietReason: null },
  dispatch: { music: null, ambience: 'interior', musicLevel: 0, ambienceLevel: .55, effects: true, quietReason: 'dispatch' },
  archive: { music: null, ambience: 'interior', musicLevel: 0, ambienceLevel: .45, effects: true, quietReason: 'archive' },
  transition: { music: null, ambience: 'interior', musicLevel: 0, ambienceLevel: .3, effects: true, quietReason: 'transition' },
  boss: { music: 'arena-chamber', ambience: 'interior', musicLevel: .85, ambienceLevel: .25, effects: true, quietReason: null },
};

export function resolveAudioDirection(scene: { region: AudioRegion; content: AudioContent }): Readonly<AudioDirection> {
  if (scene.content === 'reader' || scene.content === 'art') {
    return { music: null, ambience: null, musicLevel: 0, ambienceLevel: 0, effects: false, quietReason: scene.content };
  }
  return regions[scene.region];
}

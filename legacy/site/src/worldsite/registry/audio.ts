/** One live context and a lazy source-rate decoder. Neither exists before opt-in. */
import { AUDIO_DIRECTION, AUDIO_DIRECTION_STATUS, FOOTSTEP_TRIAL, FOOTSTEP_TRIAL_STATUS, resolveAudioDirection, type AudioContent, type AudioRegion } from '../audio-direction';
import runtimeSelection from '../audio-runtime-selection.json';
export type { AudioRegion, AudioContent } from '../audio-direction';
export type AudioEffect = 'step-concrete-1' | 'step-concrete-2' | 'step-metal-1' | 'step-metal-2' | 'slash-1' | 'slash-2' | 'hit-metal' | 'cable-cut' | 'paper-open' | 'paper-cut' | 'lift-start' | 'lift-dock' | 'telegraph' | 'landing' | 'hurt' | 'confirm' | 'victory' | 'defeat';
export interface AudioGains { master: number; music: number; effects: number; ambience: number }
export interface AudioScene { region: AudioRegion; content: AudioContent; paused: boolean }
export interface AudioDiagnostics {
  enabled: boolean; muted: boolean; paused: boolean; needsGesture: boolean;
  contextState: string; region: AudioRegion; playingMusic: string | null;
  musicSources: number; ambienceSources: number; effectVoices: number;
  decodedBytes: number; reservedBytes: number; decodedCapBytes: number;
  cachedMusicBuffers: number; sampleRate: number | null; decodeSampleRate: number | null; lastError: string | null;
  offsets: Record<string, number>; gains: AudioGains;
  direction: typeof AUDIO_DIRECTION; directionStatus: typeof AUDIO_DIRECTION_STATUS;
  content: AudioContent; musicPlan: string | null; ambiencePlan: string | null;
  quietReason: ReturnType<typeof resolveAudioDirection>['quietReason'];
  musicStartedAt: number | null; musicPositionSeconds: number | null;
  footstepTrial: typeof FOOTSTEP_TRIAL; footstepTrialStatus: typeof FOOTSTEP_TRIAL_STATUS;
  runtimeSelection: string; activeEffects: string[]; voiceActive: boolean;
}
export interface WorldAudio {
  enableFromGesture(): Promise<void>;
  resumeFromGesture(): Promise<void>;
  setScene(scene: Partial<AudioScene>): void;
  setGains(gains: Partial<AudioGains>): void;
  /** Pass true only while an admitted, unmuted remote speaker is actually audible. */
  setVoiceActivity(active: boolean): void;
  mute(): void;
  pause(): void;
  playEffect(id: AudioEffect, eventId?: string): void;
  diagnostics(): AudioDiagnostics;
  dispose(): void;
}

const CAP = 64 * 1024 * 1024;
const EFFECTS = new Set<AudioEffect>(['step-concrete-1', 'step-concrete-2', 'step-metal-1', 'step-metal-2', 'slash-1', 'slash-2', 'hit-metal', 'cable-cut', 'paper-open', 'paper-cut', 'lift-start', 'lift-dock', 'telegraph', 'landing', 'hurt', 'confirm', 'victory', 'defeat']);
type Bus = 'music' | 'ambience' | 'effects';
const ACTIVE_AUDIO: Record<Bus, ReadonlySet<string>> = { music: new Set(runtimeSelection.music), ambience: new Set(runtimeSelection.ambience), effects: new Set(runtimeSelection.effects) };
const RUNTIME_FILES = runtimeSelection.files as Record<string, Partial<Record<'wav' | 'opus' | 'm4a', string>>>;
type BufferSpec = { sampleRate: number; channels: number; frameCount: number; loopStartFrame?: number; loopEndFrame?: number };
const RUNTIME_BUFFERS = runtimeSelection.buffers as Record<string, BufferSpec>;
type Stored = { buffer: AudioBuffer; bus: Bus; touched: number };
type Voice = { source: AudioBufferSourceNode; gain: GainNode; mix?: GainNode; key: string; start: number; offset: number; duration: number; tailUntil?: number };
const clamp = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/** Explicit Registry geography; rooms sharing a cue retain one musical transport. */
export function audioRegionFor(value: string): AudioRegion {
  const regions:Record<string,AudioRegion>={arrival:'arrival',rest:'arrival',registry:'support',junction:'support',vestibule:'dispatch',dispatch:'dispatch',arena:'boss',archive:'archive','low-passage':'transition',pool:'arrival','sky-walk':'arrival',exhibit:'gallery',gallery:'gallery',courtyard:'gallery'};
  return regions[value]||'arrival';
}

class WorldAudioManager implements WorldAudio {
  private context: AudioContext | null = null;
  private decoder: OfflineAudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private scene: AudioScene = { region: 'arrival', content: 'none', paused: false };
  private gains: AudioGains = { master: .6, music: .45, effects: .6, ambience: .4 };
  private enabled = false;
  private muted = true;
  private explicitPause = false;
  private needsGesture = false;
  private revision = 0;
  private loading = new AbortController();
  private queue: Promise<void> = Promise.resolve();
  private cache = new Map<string, Stored>();
  private reserved = 0;
  private music: Voice | null = null;
  private ambience: Voice | null = null;
  private effects = new Set<Voice>();
  private fading = new Map<Voice, 'music' | 'ambience'>();
  private eventIds = new Map<string, number>();
  private offsets: Record<string, number> = {};
  private lastError: string | null = null;
  private disposed = false;
  private voiceActive = false;
  private musicHasStarted = false;
  private format: 'opus' | 'm4a' = 'm4a';
  private readonly blur = () => {
    if (!this.enabled || this.muted) return;
    this.needsGesture = true;
    this.invalidate();
    this.stopEffects();
    this.enqueue(() => this.reconcile(this.revision));
    this.notify();
  };
  private readonly visibility = () => { if (document.hidden) this.blur(); };

  private createContext() {
    if (this.context) return this.context;
    const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) throw new Error('Sound is unavailable in this browser.');
    const ctx = new Constructor();
    this.context = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    for (const bus of ['music', 'ambience', 'effects'] as Bus[]) {
      const node = ctx.createGain();
      node.connect(this.master);
      this.buses[bus] = node;
    }
    this.format = document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') ? 'opus' : 'm4a';
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.applyGains();
    return ctx;
  }

  async enableFromGesture() {
    if (this.disposed) throw new Error('Sound has been closed.');
    let activationRevision = this.revision;
    try {
      const context = this.createContext();
      // Invoke resume in the caller's user-gesture stack, before any fetch/await.
      const resumed = context.resume();
      this.enabled = true;
      this.muted = false;
      this.explicitPause = false;
      this.needsGesture = false;
      this.lastError = null;
      const rev = this.invalidate();
      activationRevision = rev;
      await resumed;
      if (context.state !== 'running') throw new Error('Sound could not start. Try Sound again.');
      if (rev !== this.revision) return;
      this.applyGains();
      await this.enqueue(() => this.reconcile(rev), true);
      this.notify();
    } catch (error) {
      // A newer navigation/mute owns the state; cancellation is not a load failure.
      if (activationRevision !== this.revision || (error instanceof DOMException && error.name === 'AbortError')) return;
      this.mute();
      this.report(error);
      throw error;
    }
  }

  resumeFromGesture() { return this.enableFromGesture(); }

  setScene(scene: Partial<AudioScene>) {
    const next = { ...this.scene, ...scene };
    if (next.region === this.scene.region && next.content === this.scene.content && next.paused === this.scene.paused) return;
    const before = resolveAudioDirection(this.scene), after = resolveAudioDirection(next);
    const changedTransport = before.music !== after.music || before.ambience !== after.ambience || next.paused !== this.scene.paused;
    this.scene = next;
    this.applyGains();
    if (changedTransport && this.enabled && !this.muted) {
      const rev = this.invalidate();
      if (next.paused) this.stopEffects(this.inspectionExit());
      void this.enqueue(() => this.reconcile(rev));
    }
    this.notify();
  }

  setGains(gains: Partial<AudioGains>) {
    for (const key of Object.keys(gains) as (keyof AudioGains)[]) this.gains[key] = clamp(gains[key]!);
    this.applyGains();
    this.notify();
  }

  setVoiceActivity(active: boolean) {
    if (this.voiceActive === active) return;
    this.voiceActive = active;
    this.applyGains();
    this.notify();
  }

  mute() {
    this.muted = true;
    this.invalidate();
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(0, this.context.currentTime);
    }
    this.stopEffects();
    this.stopVoice('music', 0);
    this.stopVoice('ambience', 0);
    for (const voice of this.fading.keys()) {
      try { voice.source.stop(); } catch { /* already ended */ }
      voice.source.disconnect(); voice.gain.disconnect(); voice.mix?.disconnect();
    }
    this.fading.clear();
    this.notify();
  }

  pause() {
    this.explicitPause = true;
    const rev = this.invalidate();
    this.stopEffects();
    void this.enqueue(() => this.reconcile(rev));
    this.notify();
  }

  private silent() { return !this.enabled || this.muted || this.explicitPause || this.scene.paused || this.needsGesture || document.hidden; }
  private invalidate() { this.loading.abort(); this.loading = new AbortController(); return ++this.revision; }
  private valid(rev: number) { return rev === this.revision && !this.disposed && !this.silent(); }
  private enqueue(action: () => Promise<void>, propagate = false): Promise<void> {
    const task = this.queue.then(action);
    this.queue = task.catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) this.report(error); });
    return propagate ? task : this.queue;
  }
  private report(error: unknown) { this.lastError = error instanceof Error ? error.message : 'Sound could not load.'; this.notify(); }
  private notify() { window.dispatchEvent(new CustomEvent('world-audio-status', { detail: this.diagnostics() })); }

  private applyGains() {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const set = (node: GainNode | undefined, value: number, seconds = .08) => {
      if (!node) return;
      node.gain.cancelScheduledValues(ctx.currentTime);
      node.gain.setTargetAtTime(value, ctx.currentTime, seconds);
    };
    if (this.muted) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(0, ctx.currentTime);
    } else set(this.master, this.gains.master);
    const direction = resolveAudioDirection(this.scene);
    // User volume belongs to the bus. Region levels belong to each live voice,
    // so a quiet destination cannot zero the outgoing voice before its fade.
    const duckTime = this.voiceActive ? .06 : .45;
    set(this.buses.music, this.gains.music * (this.voiceActive ? .5012 : 1), duckTime);
    set(this.buses.effects, this.gains.effects * (this.voiceActive ? .85 : 1), duckTime);
    set(this.buses.ambience, this.gains.ambience * (this.voiceActive ? .65 : 1), duckTime);
    if (this.music && this.music.key === direction.music) set(this.music.mix, direction.musicLevel, .55);
    if (this.ambience && this.ambience.key === direction.ambience) set(this.ambience.mix, direction.ambienceLevel, .4);
  }

  private inspectionExit() {
    return this.scene.content !== 'none' && this.enabled && !this.muted && !this.explicitPause && !this.needsGesture && !document.hidden;
  }

  private stopEffects(inspectionExit = false) {
    const ctx = this.context;
    for (const voice of this.effects) {
      // The E cue is emitted immediately before its reader pauses the world.
      // Finish only that already-started transient, with an absolute deadline;
      // never restart a late decode or retain footsteps/combat under a reader.
      const until = voice.start + Math.min(.18, voice.duration);
      if (inspectionExit && ctx?.state === 'running' && ['paper-open', 'confirm'].includes(voice.key) && ctx.currentTime < until) {
        if (voice.tailUntil === undefined) {
          voice.tailUntil = until;
          const level = voice.gain.gain.value;
          voice.gain.gain.cancelScheduledValues(ctx.currentTime);
          voice.gain.gain.setValueAtTime(level, ctx.currentTime);
          voice.gain.gain.setValueAtTime(level, Math.max(ctx.currentTime, until - .045));
          voice.gain.gain.linearRampToValueAtTime(0, until);
          try { voice.source.stop(until); } catch { /* already ended */ }
        }
        continue;
      }
      try { voice.source.stop(); } catch { /* already ended */ }
      voice.source.disconnect(); voice.gain.disconnect(); this.effects.delete(voice);
    }
  }

  private stopVoice(bus: 'music' | 'ambience', seconds: number) {
    const voice = this[bus], ctx = this.context;
    if (!voice || !ctx) return;
    this[bus] = null;
    const fade = ctx.state === 'running' ? seconds : 0;
    const stopAt = ctx.currentTime + fade;
    if (voice.mix) {
      const outgoingLevel = voice.mix.gain.value;
      voice.mix.gain.cancelScheduledValues(ctx.currentTime);
      voice.mix.gain.setValueAtTime(outgoingLevel, ctx.currentTime);
    }
    this.offsets[voice.key] = (voice.offset + Math.max(0, stopAt - voice.start)) % voice.duration;
    const outgoingEnvelope = voice.gain.gain.value;
    voice.gain.gain.cancelScheduledValues(ctx.currentTime);
    voice.gain.gain.setValueAtTime(outgoingEnvelope, ctx.currentTime);
    voice.gain.gain.linearRampToValueAtTime(0, stopAt);
    try { voice.source.stop(stopAt); } catch { /* already stopped */ }
    if (fade) this.fading.set(voice, bus);
    voice.source.onended = () => { voice.source.disconnect(); voice.gain.disconnect(); voice.mix?.disconnect(); this.fading.delete(voice); };
    if (!fade) { voice.source.disconnect(); voice.gain.disconnect(); voice.mix?.disconnect(); }
  }

  private loopBounds(key: string, buffer: AudioBuffer) {
    const spec = RUNTIME_BUFFERS[key];
    if (!spec || spec.loopStartFrame === undefined || spec.loopEndFrame === undefined) throw new Error('Sound loop metadata is missing.');
    const start = Math.round(spec.loopStartFrame * buffer.sampleRate / spec.sampleRate);
    const end = Math.round(spec.loopEndFrame * buffer.sampleRate / spec.sampleRate);
    if (start < 0 || end <= start || end > buffer.length) throw new Error('Decoded sound is shorter than its declared loop.');
    return { start, end, startSeconds: start / buffer.sampleRate, endSeconds: end / buffer.sampleRate, duration: (end - start) / buffer.sampleRate };
  }

  private startVoice(key: string, buffer: AudioBuffer, bus: 'music' | 'ambience', fade: number, offset: number, breath = 0) {
    const ctx = this.context!;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), mix = ctx.createGain();
    const bounds = this.loopBounds(key, buffer), duration = bounds.duration;
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = bounds.startSeconds;
    source.loopEnd = bounds.endSeconds;
    source.connect(gain);
    gain.connect(mix);
    mix.connect(this.buses[bus]!);
    const direction = resolveAudioDirection(this.scene);
    mix.gain.value = bus === 'music' ? direction.musicLevel : direction.ambienceLevel;
    const start = ctx.currentTime + breath;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0, start);
    if (bus === 'music') {
      // Gentle at both ends. Linear ramps reached near full volume during B's
      // recorded lead-in, then made its first note and resumed phrases jump in.
      // Short native ramp segments remain safely cancellable midway through.
      for (let i = 1; i <= 96; i++) {
        const t = i / 96, level = t * t * t * (t * (t * 6 - 15) + 10);
        gain.gain.linearRampToValueAtTime(level, start + fade * t);
      }
    } else gain.gain.linearRampToValueAtTime(1, start + fade);
    source.start(start, bounds.startSeconds + offset % duration);
    this[bus] = { source, gain, mix, key, start, offset: offset % duration, duration };
  }

  private async reconcile(rev: number) {
    if (rev !== this.revision || !this.context) return;
    if (this.silent()) {
      this.stopEffects(this.inspectionExit()); this.stopVoice('music', .2); this.stopVoice('ambience', .2);
      // Serialize the stop before another gesture can allocate/start a replacement.
      if (this.fading.size) await delay(210);
      this.notify();
      return;
    }
    const direction = resolveAudioDirection(this.scene), { music, ambience } = direction;
    const changeMusic = (this.music?.key ?? null) !== music;
    const changeAmbience = (this.ambience?.key ?? null) !== ambience;
    const hadMusic = changeMusic && !!this.music, hadAmbience = changeAmbience && !!this.ambience;
    const reading = this.scene.content === 'reader' || this.scene.content === 'art';
    const exitFade = reading ? .18 : 1.1;
    if (changeMusic) this.stopVoice('music', exitFade);
    if (changeAmbience) this.stopVoice('ambience', reading ? .18 : .65);
    // Reading becomes genuinely silent promptly. Geography and new cues breathe
    // between phrases; no two music buffers play over each other.
    if (reading) this.stopEffects(this.inspectionExit());
    if (hadMusic || hadAmbience || this.fading.size) await delay(reading ? 190 : hadMusic ? 1200 : 670);
    if (!this.valid(rev)) return;
    // Inspection can happen while a longer music file is still arriving. Prime
    // its two tiny transients first so opening a reader need not wait on music.
    for (const cue of ['confirm', 'paper-open']) {
      if (!direction.effects || !this.valid(rev)) break;
      await this.load(cue, 'effects', rev);
    }
    // Establish the room's air before fetching/decoding its much larger score.
    // Decoding stays serialized under the existing memory reservation contract.
    if (ambience && !this.ambience) {
      const buffer = await this.load(ambience, 'ambience', rev);
      if (!buffer || !this.valid(rev)) return;
      this.startVoice(ambience, buffer, 'ambience', 1.6, this.offsets[ambience] || 0);
      this.notify();
    }
    // Null means no source exists. A quiet region never fetches a silent WAV.
    // Shared support playback remains untouched across ordinary audible regions.
    if (music && !this.music) {
      const buffer = await this.load(music, 'music', rev);
      if (!buffer || !this.valid(rev)) return;
      const first = !this.musicHasStarted;
      const arena = music === 'arena-chamber';
      // The accepted B already has 2.65s of silence at its first offset.
      this.startVoice(music, buffer, 'music', arena ? 5.5 : 8.5, this.offsets[music] || 0, arena ? 1.1 : first ? .35 : 1);
      this.musicHasStarted = true;
    }
    // Short, bounded WAVs are warmed after opt-in so the first sword/landing event
    // is not delayed by its first network request. Decodes remain serialized.
    for (const effect of ACTIVE_AUDIO.effects) {
      if (!direction.effects || !this.valid(rev)) break;
      await this.load(effect, 'effects', rev);
    }
    this.notify();
  }

  private bytes() { return [...this.cache.values()].reduce((sum, entry) => sum + entry.buffer.length * entry.buffer.numberOfChannels * 4, 0); }
  private reserve(bytes: number, bus: Bus) {
    const protectedKeys = new Set([this.music?.key, this.ambience?.key, ...[...this.effects].map(effect => effect.key), ...[...this.fading.keys()].map(voice => voice.key)]);
    const oldest = [...this.cache.entries()].sort((a, b) => a[1].touched - b[1].touched);
    const musicCount = () => [...this.cache.values()].filter(entry => entry.bus === 'music').length;
    for (const [key, entry] of oldest) {
      if (protectedKeys.has(key)) continue;
      if (this.bytes() + bytes > CAP || (bus === 'music' && musicCount() >= 2 && entry.bus === 'music')) this.cache.delete(key);
    }
    if (this.bytes() + bytes > CAP) throw new Error('Sound needs more memory than this device allows.');
    this.reserved = bytes;
  }

  private async load(key: string, bus: Bus, rev: number) {
    if (!ACTIVE_AUDIO[bus].has(key)) throw new Error('Sound selection does not include this asset: ' + key);
    const existing = this.cache.get(key);
    if (existing) { existing.touched = performance.now(); return existing.buffer; }
    if (!this.valid(rev)) return null;
    const spec = RUNTIME_BUFFERS[key];
    if (!spec) throw new Error('Sound buffer metadata is missing.');
    // This reviewed asset family is mastered at 48 kHz. A future higher-rate
    // master needs a deliberate route, rather than an implicit quality change.
    if (spec.sampleRate !== 48000) throw new Error('Sound source rate is not supported by this build.');
    // Reserve declared frames plus codec/resampler padding before decoding.
    const seconds = spec.frameCount / spec.sampleRate + (bus === 'effects' ? .03 : .2);
    this.reserve(Math.ceil(seconds * spec.sampleRate * spec.channels * 4), bus);
    try {
      const ext = bus === 'effects' ? 'wav' : this.format;
      const url = RUNTIME_FILES[key]?.[ext];
      if (!url) throw new Error('Sound selection is missing a compatible file.');
      const response = await fetch(url, { signal: this.loading.signal });
      if (!response.ok) throw new Error('Sound could not load. Try Sound again.');
      const encoded = await response.arrayBuffer();
      if (!this.valid(rev)) return null;
      if (!this.decoder) {
        const Constructor = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
        if (!Constructor) throw new Error('Sound decoding is unavailable in this browser.');
        // Decode only: never render an offline song or allocate a second live-
        // rate copy. AudioBufferSourceNode handles output-rate conversion.
        this.decoder = new Constructor(2, 1, 48000);
      }
      const buffer = await this.decoder.decodeAudioData(encoded);
      if (!this.valid(rev)) return null;
      if (buffer.sampleRate !== spec.sampleRate) throw new Error('Decoded sound sample rate differs.');
      if (buffer.numberOfChannels !== spec.channels) throw new Error('Decoded sound channel metadata differs.');
      const measured = buffer.length * buffer.numberOfChannels * 4;
      if (this.bytes() + measured > CAP) throw new Error('Decoded sound exceeds this device’s memory allowance.');
      if (bus !== 'effects') {
        // Lossy codec priming/resampling can reintroduce a tiny boundary jump even
        // when the WAV endpoints match. Blend in place, using no second buffer.
        const { start, end } = this.loopBounds(key, buffer);
        const count = Math.min(128, end - start);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel), last = samples[end - 1];
          for (let i = 0; i < count; i++) {
            const weight = .5 - .5 * Math.cos(Math.PI * i / (count - 1));
            samples[start + i] = last * (1 - weight) + samples[start + i] * weight;
          }
        }
      }
      this.cache.set(key, { buffer, bus, touched: performance.now() });
      return buffer;
    } finally { this.reserved = 0; }
  }

  playEffect(id: AudioEffect, eventId?: string) {
    if (!EFFECTS.has(id) || !resolveAudioDirection(this.scene).effects || this.silent() || !this.context || this.effects.size >= 12) return;
    if (!ACTIVE_AUDIO.effects.has(id)) { this.report(new Error('Sound for this action is not included in this build.')); return; }
    if (eventId) {
      if (this.eventIds.has(eventId)) return;
      this.eventIds.set(eventId, performance.now());
      if (this.eventIds.size > 512) this.eventIds.delete(this.eventIds.keys().next().value!);
    }
    const rev = this.revision, requested = performance.now();
    const play = (buffer: AudioBuffer) => {
      if (!this.valid(rev) || !resolveAudioDirection(this.scene).effects || this.effects.size >= 12 || performance.now() - requested > 200) return;
      const ctx = this.context!, source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.buses.effects!);
      gain.gain.value = 1;
      const voice: Voice = { source, gain, key: id, start: ctx.currentTime, offset: 0, duration: buffer.duration };
      this.effects.add(voice);
      source.onended = () => { source.disconnect(); gain.disconnect(); this.effects.delete(voice); };
      source.start();
    };
    const cached = this.cache.get(id);
    if (cached) {
      cached.touched = performance.now();
      // An existing sword/impact/resolve buffer must not queue behind a music fade.
      play(cached.buffer);
    } else {
      void this.enqueue(async () => { const buffer = await this.load(id, 'effects', rev); if (buffer) play(buffer); });
    }
  }

  diagnostics(): AudioDiagnostics {
    const direction = resolveAudioDirection(this.scene);
    const musicPositionSeconds = this.music && this.context ? (this.music.offset + Math.max(0, this.context.currentTime - this.music.start)) % this.music.duration : null;
    return { enabled: this.enabled, muted: this.muted, paused: this.explicitPause || this.scene.paused, needsGesture: this.needsGesture, contextState: this.context?.state || 'uninitialized', region: this.scene.region, playingMusic: this.music?.key || null, musicSources: (this.music ? 1 : 0) + [...this.fading.values()].filter(bus => bus === 'music').length, ambienceSources: (this.ambience ? 1 : 0) + [...this.fading.values()].filter(bus => bus === 'ambience').length, effectVoices: this.effects.size, decodedBytes: this.bytes(), reservedBytes: this.reserved, decodedCapBytes: CAP, cachedMusicBuffers: [...this.cache.values()].filter(entry => entry.bus === 'music').length, sampleRate: this.context?.sampleRate || null, decodeSampleRate: this.decoder?.sampleRate || null, lastError: this.lastError, offsets: { ...this.offsets }, gains: { ...this.gains }, direction: AUDIO_DIRECTION, directionStatus: AUDIO_DIRECTION_STATUS, content: this.scene.content, musicPlan: direction.music, ambiencePlan: direction.ambience, quietReason: direction.quietReason, musicStartedAt: this.music?.start ?? null, musicPositionSeconds, footstepTrial: FOOTSTEP_TRIAL, footstepTrialStatus: FOOTSTEP_TRIAL_STATUS, runtimeSelection: runtimeSelection.id, activeEffects: [...ACTIVE_AUDIO.effects], voiceActive: this.voiceActive };
  }

  dispose() {
    if (this.disposed) return;
    this.mute();
    this.disposed = true;
    this.cache.clear();
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    void this.context?.close();
    this.context = null;
    // OfflineAudioContext has no close(); stale decode results are rejected by
    // the revision/disposed checks above, and no result is retained here.
    this.decoder = null;
    if (singleton === this) singleton = undefined;
  }
}

let singleton: WorldAudio | undefined;
export function getWorldAudio(): WorldAudio {
  return singleton ??= new WorldAudioManager();
}

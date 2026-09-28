// Plays one contract clip in 60 Hz ticks. Frame events fire on the tick a
// frame starts. Holds extend a frame; cancel windows are read from the
// current frame by the controller.

import { frameTicks, type Clip, type Frame } from "../contracts.ts";

export class ClipPlayer {
  clip: Clip;
  index = 0;
  tick = 0;
  elapsed = 0;
  done = false;
  /** Set by combat when any hitbox of this play connected. */
  hit = false;
  /** hit group -> targets already hit this play */
  readonly hitGroups = new Map<string, Set<object>>();
  private entered: Frame | null = null;

  constructor(clip: Clip) {
    this.clip = clip;
    this.play(clip);
  }

  play(clip: Clip): void {
    this.clip = clip;
    this.index = 0;
    this.tick = 0;
    this.elapsed = 0;
    this.done = false;
    this.hit = false;
    this.hitGroups.clear();
    this.entered = clip.frames[0]!;
  }

  get frame(): Frame {
    return this.clip.frames[this.index]!;
  }

  /** The frame that started since the last call (events to fire), once. */
  takeEntered(): Frame | null {
    const f = this.entered;
    this.entered = null;
    return f;
  }

  /** Advance one tick. */
  step(): void {
    if (this.done) return;
    this.tick++;
    this.elapsed++;
    if (this.tick < frameTicks(this.frame)) return;
    this.tick = 0;
    if (this.index + 1 < this.clip.frames.length) {
      this.index++;
      this.entered = this.frame;
    } else if (this.clip.loop) {
      this.index = 0;
      this.entered = this.frame;
    } else {
      this.done = true;
    }
  }

  /** Root motion for the current tick (facing-relative). */
  rootMotion(): [number, number] | null {
    const rm = this.frame.rootMotion;
    if (!rm) return null;
    const n = frameTicks(this.frame);
    return [rm[0] / n, rm[1] / n];
  }

  hasTag(tag: string): boolean {
    return this.clip.tags?.includes(tag) ?? false;
  }
}

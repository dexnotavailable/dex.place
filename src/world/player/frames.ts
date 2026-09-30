import { frameTicks, type Frame } from "../../lab/contracts.ts";

/** World resting poses use the same exposure + hold ticks as action clips. */
export function loopFrameAt(frames: readonly Frame[], ticks: number): Frame {
  if (!frames.length) throw new Error("a looping pose needs at least one frame");
  const total = frames.reduce((sum, frame) => sum + frameTicks(frame), 0);
  let remaining = ticks % total;
  for (const frame of frames) {
    if (remaining < frameTicks(frame)) return frame;
    remaining -= frameTicks(frame);
  }
  return frames[0]!;
}

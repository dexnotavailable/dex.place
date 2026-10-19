// The card rigs' format, read the same way by the page's build (render/cardart.ts) and by the pixel finish in the
// browser (motion/cardrig.ts): lanes/motion/NOTEBOOK.md ASKS 00 (agreed with the card-art lane). No node, no DOM.

export interface RigMotion {
  kind: "sway" | "breathe" | "bob" | "glow" | "drift" | "flicker";
  period: number;
  phase?: number;
  deg?: number;
  scale?: number;
  dx?: number;
  dy?: number;
  min?: number;
  max?: number;
  fade?: boolean;
}
export interface RigPartV2 {
  id: string;
  src: string;
  /** Where the layer sits in the frame: x, y, w, h (frame units). */
  box: [number, number, number, number];
  depth?: number;
  pivot?: [number, number];
  motion?: RigMotion[];
  /** Drawn a second time outside the card's clip, so the character steps out of her frame (DESIGN-1019 5.3). At most
   *  one per card, overflowing the frame's top by at most 8% of the card's height. */
  pop?: boolean;
}
export interface RigV2 {
  v: 2;
  /** The art's whole frame (frame units), 9:16. */
  size: [number, number];
  /** The centre of the face: every crop keeps it in view. */
  focus?: [number, number];
  /** Pixel art (the stand-in): never smoothed when it is scaled. */
  pixelated?: boolean;
  /** The giant numeral sits right after this part (DESIGN-1019 5.3); without it, after the last part shallower than
   *  0.34. */
  numeral?: string;
  parts: RigPartV2[];
}

/**
 * A rig as read (pure): its parts as a list back to front, whichever way the file gives them: a list of parts with
 * their ids, or (the card-art lane's files) an object of parts by id with an `order`. Null if it is not a v2 rig.
 */
export function normaliseRig(raw: unknown): RigV2 | null {
  const r = raw as { v?: number; size?: [number, number]; parts?: unknown; order?: string[] } | null;
  if (!r || r.v !== 2 || !Array.isArray(r.size) || !r.parts) return null;
  let parts: RigPartV2[];
  if (Array.isArray(r.parts)) parts = r.parts as RigPartV2[];
  else {
    const byId = r.parts as Record<string, Omit<RigPartV2, "id">>;
    parts = (r.order ?? Object.keys(byId)).filter((id) => byId[id]).map((id) => ({ id, ...byId[id]! }));
  }
  return { ...(r as RigV2), parts };
}


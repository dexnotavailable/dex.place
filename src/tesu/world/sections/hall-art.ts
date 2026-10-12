// The gallery's pieces, from the website's manifest (content/gallery/manifest.json): the
// Hall of Works hangs every one of them, each only ever as itself, in a frame of its shape.
import manifest from "../../../../content/gallery/manifest.json" with { type: "json" };

export interface Piece { id: string; width: number; height: number }

export const GALLERY_PIECES: readonly Piece[] = (manifest as { items: Piece[] }).items.map((i) => ({ id: i.id, width: i.width, height: i.height }));
export const GALLERY_IDS: readonly string[] = GALLERY_PIECES.map((p) => p.id);
